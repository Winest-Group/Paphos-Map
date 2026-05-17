const PAPHOS_CENTER = [34.7720, 32.4297];
const DEFAULT_ZOOM = 12;
const SIMILAR_PRICE_THRESHOLD = 0.10; // ±10%

const STATUS_LABELS = {
    active: 'פעיל',
    on_hold: 'מוקפא',
    sold_out: 'נמכר'
};

const PHASE_LABELS = {
    planned: '📐 מתוכנן',
    construction: '🏗️ בבנייה',
    near_delivery: '🔑 מסירה קרובה',
    completed: '✅ מאוכלס'
};

const CATEGORY_LABELS = {
    studio: 'סטודיו',
    apartment: 'דירה',
    penthouse: 'פנטהאוז',
    villa: 'וילה',
    townhouse: 'טאון-האוס',
    bungalow: 'בנגלו'
};

// All property_types loaded once so we can compute similar prices client-side
let ALL_PROPERTY_TYPES = [];
let PROJECTS_BY_ID = {};
let ALL_PROJECTS = [];

const BUDGET_RANGES = {
    '0-250000':       { min: 0,      max: 250000 },
    '250000-350000':  { min: 250000, max: 350000 },
    '350000-500000':  { min: 350000, max: 500000 },
    '500000+':        { min: 500000, max: Infinity }
};

const map = L.map('map', { zoomControl: false }).setView(PAPHOS_CENTER, DEFAULT_ZOOM);
L.control.zoom({ position: 'topleft' }).addTo(map);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap contributors'
}).addTo(map);

const markersLayer = L.layerGroup().addTo(map);

function createCustomIcon(status) {
    return L.divIcon({
        className: 'custom-marker-wrapper',
        html: `<div class="custom-pin ${status}"></div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -32]
    });
}

function formatPrice(price) {
    return `€${price.toLocaleString('he-IL')}`;
}

function formatPriceRange(min, max) {
    if (!min && !max) return '—';
    if (min === max) return formatPrice(min);
    return `${formatPrice(min)} – ${formatPrice(max)}`;
}

function formatSizeRange(min, max) {
    if (!min && !max) return null;
    if (min === max) return `${min} מ"ר`;
    return `${min}-${max} מ"ר`;
}

function formatDistanceFromSea(project) {
    const parts = [];
    if (project.distance_from_sea_m) {
        if (project.distance_from_sea_m < 1000) {
            parts.push(`${project.distance_from_sea_m} מ׳`);
        } else {
            parts.push(`${(project.distance_from_sea_m / 1000).toFixed(1)} ק״מ`);
        }
    }
    if (project.drive_time_to_sea_minutes) {
        parts.push(`${project.drive_time_to_sea_minutes} דק׳ נסיעה`);
    }
    return parts.length > 0 ? parts.join(' / ') + ' מהים' : null;
}

function findSimilarPriced(propertyType, currentProjectId) {
    const lowerBound = propertyType.price * (1 - SIMILAR_PRICE_THRESHOLD);
    const upperBound = propertyType.price * (1 + SIMILAR_PRICE_THRESHOLD);

    return ALL_PROPERTY_TYPES
        .filter(pt =>
            pt.project_id !== currentProjectId &&
            pt.category === propertyType.category &&
            pt.bedrooms === propertyType.bedrooms &&
            pt.price >= lowerBound &&
            pt.price <= upperBound
        )
        .map(pt => ({
            ...pt,
            project: PROJECTS_BY_ID[pt.project_id]
        }))
        .filter(item => item.project) // skip if project missing
        .sort((a, b) => Math.abs(a.price - propertyType.price) - Math.abs(b.price - propertyType.price))
        .slice(0, 3); // up to 3 closest matches
}

function buildPropertyTypesTable(propertyTypes) {
    if (!propertyTypes || propertyTypes.length === 0) {
        return '<div class="popup-empty">אין סוגי נכסים מוגדרים</div>';
    }

    const rows = propertyTypes.map(pt => {
        const sizeText = formatSizeRange(pt.size_min, pt.size_max);
        return `
            <tr>
                <td>${pt.type_name}</td>
                <td class="price-cell">${formatPrice(pt.price)}</td>
                <td class="size-cell">${sizeText || '—'}</td>
            </tr>
        `;
    }).join('');

    return `
        <table class="types-table">
            <thead>
                <tr><th>סוג</th><th>מחיר</th><th>גודל</th></tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>
    `;
}

function buildSimilarSection(project) {
    if (!project.property_types || project.property_types.length === 0) return '';

    const sections = project.property_types.map(pt => {
        const similar = findSimilarPriced(pt, project.id);
        if (similar.length === 0) return '';

        const items = similar.map(s => `
            <div class="similar-item" data-project-id="${s.project_id}">
                <div class="similar-name">
                    <span class="status-dot ${s.project.status}"></span>
                    ${s.project.name}
                    <span class="similar-area">· ${s.project.area}</span>
                </div>
                <div class="similar-price">${formatPrice(s.price)}</div>
            </div>
        `).join('');

        return `
            <div class="similar-group">
                <div class="similar-group-title">${pt.type_name} <span>(${formatPrice(pt.price)})</span> דומה ל:</div>
                ${items}
            </div>
        `;
    }).filter(Boolean).join('');

    if (!sections) return '';

    return `
        <div class="popup-similar">
            <div class="popup-similar-title">🔍 פרויקטים דומים במחיר (±10%)</div>
            ${sections}
        </div>
    `;
}

function buildFacilitiesRow(project) {
    const items = [];
    if (project.parking) items.push('🚗 חניה');
    if (project.pool) items.push('🏊 בריכה');
    if (project.gym) items.push('🏋️ חדר כושר');
    if (project.additional_facilities) items.push(`✨ ${project.additional_facilities}`);

    if (items.length === 0) return '';

    return `
        <div class="popup-row" style="flex-direction: column; align-items: flex-start;">
            <span class="label" style="margin-bottom: 6px;">פסיליטיז</span>
            <div class="popup-types">${items.map(i => `<span class="type-chip">${i}</span>`).join('')}</div>
        </div>
    `;
}

function buildPopupContent(project) {
    const statusBanner = project.status !== 'active'
        ? `<div class="status-banner ${project.status}">⚠ פרויקט ${STATUS_LABELS[project.status]}</div>`
        : '';

    const notesSection = project.notes
        ? `<div class="popup-notes">💡 ${project.notes}</div>`
        : '';

    const phaseRow = project.project_phase
        ? `<div class="popup-row">
              <span class="label">שלב הפרויקט</span>
              <span class="value">${PHASE_LABELS[project.project_phase]}</span>
           </div>`
        : '';

    const deliveryRow = project.delivery_date
        ? `<div class="popup-row">
              <span class="label">תאריך מסירה</span>
              <span class="value">${project.delivery_date}</span>
           </div>`
        : '';

    const floorsRow = project.floors
        ? `<div class="popup-row">
              <span class="label">מספר קומות</span>
              <span class="value">${project.floors}</span>
           </div>`
        : '';

    const distanceText = formatDistanceFromSea(project);
    const distanceRow = distanceText
        ? `<div class="popup-row">
              <span class="label">מרחק מהים</span>
              <span class="value">${distanceText}</span>
           </div>`
        : '';

    const vatRow = project.vat_rate
        ? `<div class="popup-row">
              <span class="label">VAT</span>
              <span class="value">${project.vat_rate}%</span>
           </div>`
        : '';

    const contactRow = project.contact_person_name
        ? `<div class="popup-row">
              <span class="label">איש קשר</span>
              <span class="value">${project.contact_person_name}${project.contact_person_phone ? ' · ' + project.contact_person_phone : ''}</span>
           </div>`
        : '';

    const updatedDate = project.updated_at
        ? new Date(project.updated_at).toLocaleDateString('he-IL')
        : '';

    const driveBtn = project.drive_link
        ? `<a href="${project.drive_link}" target="_blank" rel="noopener" class="popup-btn primary">
              <span class="icon">📁</span> דרייב
           </a>`
        : '';

    const websiteBtn = project.developer_website
        ? `<a href="${project.developer_website}" target="_blank" rel="noopener" class="popup-btn secondary">
              <span class="icon">🌐</span> אתר הקבלן
           </a>`
        : '';

    return `
        <div class="popup-card">
            <div class="popup-header">
                <h3>${project.name}</h3>
                <div class="developer">${project.developer}</div>
                <span class="popup-badge">📍 ${project.area}</span>
            </div>
            ${statusBanner}
            <div class="popup-body">
                <div class="popup-row" style="flex-direction: column; align-items: flex-start;">
                    <span class="label" style="margin-bottom: 6px;">סוגי נכסים ומחירים</span>
                    ${buildPropertyTypesTable(project.property_types)}
                </div>
                ${phaseRow}
                ${deliveryRow}
                ${floorsRow}
                ${distanceRow}
                ${vatRow}
                ${contactRow}
                ${buildFacilitiesRow(project)}
                ${notesSection}
                ${updatedDate ? `<div class="popup-updated">עודכן לאחרונה: ${updatedDate}</div>` : ''}
            </div>
            ${buildSimilarSection(project)}
            <div class="popup-actions">
                ${driveBtn}
                ${websiteBtn}
            </div>
        </div>
    `;
}

function renderMarkers(projects) {
    markersLayer.clearLayers();

    projects.forEach(project => {
        const marker = L.marker([project.lat, project.lng], {
            icon: createCustomIcon(project.status)
        });

        marker.bindPopup(buildPopupContent(project), {
            maxWidth: 360,
            closeButton: true,
            autoPan: true
        });

        // jump to similar project when clicked
        marker.on('popupopen', () => {
            document.querySelectorAll('.similar-item').forEach(el => {
                el.addEventListener('click', () => {
                    const targetId = el.dataset.projectId;
                    const target = PROJECTS_BY_ID[targetId];
                    if (target) {
                        map.flyTo([target.lat, target.lng], 15);
                        setTimeout(() => {
                            const targetMarker = markersLayer.getLayers().find(l => {
                                const ll = l.getLatLng();
                                return ll.lat === parseFloat(target.lat) && ll.lng === parseFloat(target.lng);
                            });
                            if (targetMarker) targetMarker.openPopup();
                        }, 800);
                    }
                });
            });
        });

        marker.addTo(markersLayer);
    });

    updateProjectCount(projects.length);
}

function updateProjectCount(count) {
    const el = document.getElementById('project-count');
    el.textContent = count === 1 ? 'פרויקט אחד' : `${count} פרויקטים`;
}

async function loadAreas() {
    const { data, error } = await window.sb
        .from('areas')
        .select('name')
        .order('display_order');

    if (error) {
        console.error('Failed to load areas:', error);
        return [];
    }

    const filter = document.getElementById('area-filter');
    data.forEach(area => {
        const option = document.createElement('option');
        option.value = area.name;
        option.textContent = area.name;
        filter.appendChild(option);
    });

    return data;
}

async function loadProjects() {
    const { data: projects, error: projectsError } = await window.sb
        .from('projects_with_summary')
        .select('*')
        .order('name');

    if (projectsError) {
        console.error('Failed to load projects:', projectsError);
        alert('שגיאה בטעינת פרויקטים: ' + projectsError.message);
        return [];
    }

    const { data: propertyTypes, error: ptError } = await window.sb
        .from('property_types')
        .select('*');

    if (ptError) {
        console.error('Failed to load property types:', ptError);
        return projects;
    }

    ALL_PROPERTY_TYPES = propertyTypes || [];
    PROJECTS_BY_ID = {};

    // attach property types to each project
    projects.forEach(p => {
        p.property_types = ALL_PROPERTY_TYPES
            .filter(pt => pt.project_id === p.id)
            .sort((a, b) => a.price - b.price);
        PROJECTS_BY_ID[p.id] = p;
    });

    return projects;
}

function populateDeveloperFilter(allProjects) {
    const filter = document.getElementById('developer-filter');
    const developers = [...new Set(allProjects.map(p => p.developer))].sort();
    developers.forEach(dev => {
        const option = document.createElement('option');
        option.value = dev;
        option.textContent = dev;
        filter.appendChild(option);
    });
}

function getActiveFilters() {
    return {
        search: document.getElementById('search-input').value.trim().toLowerCase(),
        developer: document.getElementById('developer-filter').value,
        area: document.getElementById('area-filter').value,
        budget: document.getElementById('budget-filter').value
    };
}

function hasAnyActiveFilter(f) {
    return f.search || f.developer !== 'all' || f.area !== 'all' || f.budget !== 'all';
}

function applyFilters() {
    const f = getActiveFilters();
    let filtered = ALL_PROJECTS;

    if (f.search) {
        filtered = filtered.filter(p => p.name.toLowerCase().includes(f.search));
    }
    if (f.developer !== 'all') {
        filtered = filtered.filter(p => p.developer === f.developer);
    }
    if (f.area !== 'all') {
        filtered = filtered.filter(p => p.area === f.area);
    }
    if (f.budget !== 'all') {
        const range = BUDGET_RANGES[f.budget];
        filtered = filtered.filter(p => {
            if (p.price_min == null) return false; // exclude projects without price
            return p.price_min >= range.min && p.price_min < range.max;
        });
    }

    renderMarkers(filtered);

    const clearBtn = document.getElementById('clear-filters');
    clearBtn.classList.toggle('hidden', !hasAnyActiveFilter(f));

    if (filtered.length > 0 && hasAnyActiveFilter(f)) {
        const bounds = L.latLngBounds(filtered.map(p => [p.lat, p.lng]));
        map.fitBounds(bounds, { padding: [60, 60], maxZoom: 15 });
    } else if (!hasAnyActiveFilter(f)) {
        map.setView(PAPHOS_CENTER, DEFAULT_ZOOM);
    }
}

function clearAllFilters() {
    document.getElementById('search-input').value = '';
    document.getElementById('developer-filter').value = 'all';
    document.getElementById('area-filter').value = 'all';
    document.getElementById('budget-filter').value = 'all';
    applyFilters();
}

function setupFilters() {
    document.getElementById('search-input').addEventListener('input', applyFilters);
    document.getElementById('developer-filter').addEventListener('change', applyFilters);
    document.getElementById('area-filter').addEventListener('change', applyFilters);
    document.getElementById('budget-filter').addEventListener('change', applyFilters);
    document.getElementById('clear-filters').addEventListener('click', clearAllFilters);
}

async function init() {
    const session = await window.requireAuth();
    if (!session) return;

    const email = await window.getCurrentUserEmail();
    document.getElementById('user-email').textContent = email || '';

    await loadAreas();

    const projects = await loadProjects();
    ALL_PROJECTS = projects;

    document.getElementById('loading').style.display = 'none';

    if (projects.length === 0) {
        document.getElementById('empty-state').classList.add('show');
        updateProjectCount(0);
        return;
    }

    populateDeveloperFilter(projects);
    setupFilters();
    renderMarkers(projects);
}

init();
