const PAPHOS_CENTER = [34.7720, 32.4297];
const STATUS_LABELS = { active: 'פעיל', on_hold: 'מוקפא', sold_out: 'נמכר' };
const CATEGORY_OPTIONS = [
    { value: 'studio', label: 'סטודיו' },
    { value: 'apartment', label: 'דירה' },
    { value: 'penthouse', label: 'פנטהאוז' },
    { value: 'villa', label: 'וילה' },
    { value: 'townhouse', label: 'טאון-האוס' },
    { value: 'bungalow', label: 'בנגלו' }
];

let allProjects = [];
let selectedProjectId = null;
let isNewProject = false;
let locationMap = null;
let locationMarker = null;
let propertyTypesState = []; // {id?, type_name, category, bedrooms, price, size_min, size_max, _isNew}
let sidebarMap = null;
let sidebarMarkers = {}; // id -> marker
let currentTab = 'list';
let allDevelopers = []; // {id, name, default_drive_link}
let developersByName = {}; // name -> developer record

// ----- Toast notifications -----
function showToast(message, type = 'success', duration = 3000) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = 'show ' + type;
    setTimeout(() => toast.classList.remove('show'), duration);
}

function filterProjects(filter = '') {
    const term = filter.toLowerCase().trim();
    return !term
        ? allProjects
        : allProjects.filter(p =>
            p.name.toLowerCase().includes(term) ||
            p.developer.toLowerCase().includes(term) ||
            p.area.toLowerCase().includes(term)
          );
}

// ----- Project list rendering -----
function renderProjectList(filter = '') {
    const list = document.getElementById('project-list');
    const filtered = filterProjects(filter);
    const term = filter.toLowerCase().trim();

    if (filtered.length === 0) {
        list.innerHTML = `<div class="loading-state">${term ? 'אין תוצאות' : 'אין פרויקטים עדיין'}</div>`;
        return;
    }

    list.innerHTML = filtered.map(p => `
        <div class="project-item ${p.id === selectedProjectId ? 'selected' : ''}" data-id="${p.id}">
            <div class="project-item-header">
                <div>
                    <div class="project-item-name">${escapeHtml(p.name)}</div>
                    <div class="project-item-developer">${escapeHtml(p.developer)}</div>
                    <div class="project-item-area">📍 ${escapeHtml(p.area)}</div>
                </div>
                <span class="status-pill ${p.status}">${STATUS_LABELS[p.status]}</span>
            </div>
        </div>
    `).join('');

    list.querySelectorAll('.project-item').forEach(el => {
        el.addEventListener('click', () => selectProject(el.dataset.id));
    });
}

// ----- Sidebar map -----
function initSidebarMap() {
    if (sidebarMap) return;

    sidebarMap = L.map('sidebar-map', { zoomControl: true }).setView(PAPHOS_CENTER, 11);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OSM'
    }).addTo(sidebarMap);
}

function createSidebarPinIcon(status, isSelected) {
    return L.divIcon({
        className: 'sidebar-pin-wrapper',
        html: `<div class="sidebar-pin ${status} ${isSelected ? 'selected' : ''}"></div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 24]
    });
}

function renderSidebarMapMarkers(filter = '') {
    if (!sidebarMap) return;

    const filtered = filterProjects(filter);
    const filteredIds = new Set(filtered.map(p => p.id));

    // Remove markers not in filtered list
    Object.keys(sidebarMarkers).forEach(id => {
        if (!filteredIds.has(id)) {
            sidebarMap.removeLayer(sidebarMarkers[id]);
            delete sidebarMarkers[id];
        }
    });

    // Add or update markers for filtered projects
    filtered.forEach(p => {
        const isSelected = p.id === selectedProjectId;
        if (sidebarMarkers[p.id]) {
            sidebarMarkers[p.id].setIcon(createSidebarPinIcon(p.status, isSelected));
            sidebarMarkers[p.id].setLatLng([p.lat, p.lng]);
        } else {
            const marker = L.marker([p.lat, p.lng], {
                icon: createSidebarPinIcon(p.status, isSelected)
            });
            marker.bindTooltip(`<strong>${escapeHtml(p.name)}</strong><br>${escapeHtml(p.developer)}`, {
                className: 'sidebar-map-tooltip',
                direction: 'top',
                offset: [0, -20]
            });
            marker.on('click', () => selectProject(p.id));
            marker.addTo(sidebarMap);
            sidebarMarkers[p.id] = marker;
        }
    });
}

function switchTab(tab) {
    currentTab = tab;
    document.querySelectorAll('.tab-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.tab === tab);
    });

    const listContainer = document.getElementById('project-list-container');
    const mapContainer = document.getElementById('sidebar-map-container');

    if (tab === 'list') {
        listContainer.classList.remove('hidden');
        mapContainer.classList.remove('active');
    } else {
        listContainer.classList.add('hidden');
        mapContainer.classList.add('active');
        initSidebarMap();
        setTimeout(() => {
            sidebarMap.invalidateSize();
            renderSidebarMapMarkers(document.getElementById('search-input').value);
        }, 50);
    }
}

function escapeHtml(s) {
    if (s == null) return '';
    return String(s).replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[c]);
}

// ----- Data loading -----
async function loadAreas() {
    const { data, error } = await window.sb.from('areas').select('name').order('display_order');
    if (error) {
        showToast('שגיאה בטעינת אזורים: ' + error.message, 'error');
        return [];
    }
    const select = document.getElementById('f-area');
    select.innerHTML = '<option value="">-- בחר אזור --</option>' +
        data.map(a => `<option value="${a.name}">${a.name}</option>`).join('');
    return data;
}

async function loadDevelopers() {
    const { data, error } = await window.sb
        .from('developers')
        .select('*')
        .order('name');
    if (error) {
        showToast('שגיאה בטעינת קבלנים: ' + error.message, 'error');
        return [];
    }
    allDevelopers = data || [];
    developersByName = {};
    allDevelopers.forEach(d => { developersByName[d.name] = d; });

    const datalist = document.getElementById('developers-datalist');
    if (datalist) {
        datalist.innerHTML = allDevelopers.map(d =>
            `<option value="${escapeHtml(d.name)}">`
        ).join('');
    }
    return allDevelopers;
}

async function loadProjects() {
    const { data, error } = await window.sb.from('projects').select('*').order('name');
    if (error) {
        showToast('שגיאה בטעינת פרויקטים: ' + error.message, 'error');
        return [];
    }
    allProjects = data || [];
    const filter = document.getElementById('search-input').value;
    renderProjectList(filter);
    if (sidebarMap) renderSidebarMapMarkers(filter);
    return data;
}

async function loadPropertyTypesForProject(projectId) {
    const { data, error } = await window.sb
        .from('property_types')
        .select('*')
        .eq('project_id', projectId)
        .order('price');

    if (error) {
        showToast('שגיאה בטעינת סוגי נכסים: ' + error.message, 'error');
        return [];
    }
    return data || [];
}

// ----- Form handling -----
function showEmptyForm() {
    document.getElementById('empty-form').style.display = 'flex';
    document.getElementById('form-container').style.display = 'none';
    selectedProjectId = null;
    isNewProject = false;
}

function showForm() {
    document.getElementById('empty-form').style.display = 'none';
    document.getElementById('form-container').style.display = 'block';
    setTimeout(() => {
        if (locationMap) locationMap.invalidateSize();
    }, 100);
}

function resetForm() {
    document.getElementById('project-form').reset();
    document.getElementById('coords-display').textContent = 'לא נבחר מיקום';
    propertyTypesState = [];
    renderPropertyTypes();
    if (locationMarker) {
        locationMap.removeLayer(locationMarker);
        locationMarker = null;
    }
    locationMap.setView(PAPHOS_CENTER, 12);
}

function fillForm(project, propertyTypes) {
    document.getElementById('f-name').value = project.name || '';
    document.getElementById('f-developer').value = project.developer || '';
    document.getElementById('f-area').value = project.area || '';
    document.getElementById('f-status').value = project.status || 'active';
    document.getElementById('f-phase').value = project.project_phase || '';
    document.getElementById('f-delivery').value = project.delivery_date || '';
    document.getElementById('f-floors').value = project.floors ?? '';
    document.getElementById('f-vat').value = project.vat_rate ?? '';
    document.getElementById('f-parking').checked = !!project.parking;
    document.getElementById('f-pool').checked = !!project.pool;
    document.getElementById('f-gym').checked = !!project.gym;
    document.getElementById('f-additional-facilities').value = project.additional_facilities || '';
    document.getElementById('f-distance-m').value = project.distance_from_sea_m ?? '';
    document.getElementById('f-drive-time').value = project.drive_time_to_sea_minutes ?? '';
    document.getElementById('f-contact-name').value = project.contact_person_name || '';
    document.getElementById('f-contact-phone').value = project.contact_person_phone || '';
    document.getElementById('f-contact-email').value = project.contact_person_email || '';
    document.getElementById('f-website').value = project.developer_website || '';
    document.getElementById('f-drive').value = project.drive_link || '';
    document.getElementById('f-notes').value = project.notes || '';

    setLocationOnMap(parseFloat(project.lat), parseFloat(project.lng));

    propertyTypesState = (propertyTypes || []).map(pt => ({ ...pt, _isNew: false }));
    renderPropertyTypes();
}

async function selectProject(id) {
    const project = allProjects.find(p => p.id === id);
    if (!project) return;

    selectedProjectId = id;
    isNewProject = false;

    document.getElementById('form-title').textContent = project.name;
    document.getElementById('delete-btn').style.display = 'inline-flex';

    showForm();
    const types = await loadPropertyTypesForProject(id);
    fillForm(project, types);

    const filter = document.getElementById('search-input').value;
    renderProjectList(filter);
    if (sidebarMap) renderSidebarMapMarkers(filter);
}

function startNewProject() {
    selectedProjectId = null;
    isNewProject = true;

    document.getElementById('form-title').textContent = 'פרויקט חדש';
    document.getElementById('delete-btn').style.display = 'none';

    showForm();
    resetForm();

    const filter = document.getElementById('search-input').value;
    renderProjectList(filter);
    if (sidebarMap) renderSidebarMapMarkers(filter);
}

// ----- Location map (inside form) -----
function initLocationMap() {
    locationMap = L.map('location-map').setView(PAPHOS_CENTER, 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap'
    }).addTo(locationMap);

    locationMap.on('click', (e) => {
        setLocationOnMap(e.latlng.lat, e.latlng.lng);
    });
}

function setLocationOnMap(lat, lng) {
    if (isNaN(lat) || isNaN(lng)) return;

    if (locationMarker) {
        locationMarker.setLatLng([lat, lng]);
    } else {
        locationMarker = L.marker([lat, lng], { draggable: true }).addTo(locationMap);
        locationMarker.on('dragend', (e) => {
            const pos = e.target.getLatLng();
            updateCoordsDisplay(pos.lat, pos.lng);
        });
    }

    locationMap.panTo([lat, lng]);
    updateCoordsDisplay(lat, lng);
}

function updateCoordsDisplay(lat, lng) {
    document.getElementById('coords-display').textContent =
        `📍 ${lat.toFixed(6)}, ${lng.toFixed(6)}`;
}

function getCurrentLocation() {
    if (!locationMarker) return null;
    const pos = locationMarker.getLatLng();
    return { lat: pos.lat, lng: pos.lng };
}

// ----- Property types sub-table -----
function renderPropertyTypes() {
    const tbody = document.getElementById('property-types-tbody');

    if (propertyTypesState.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #aaa; padding: 16px; font-size: 12px;">אין סוגי נכסים — לחץ "הוסף סוג נכס" למטה</td></tr>`;
        return;
    }

    tbody.innerHTML = propertyTypesState.map((pt, idx) => `
        <tr>
            <td><input type="text" value="${escapeHtml(pt.type_name || '')}" data-idx="${idx}" data-field="type_name" placeholder="למשל: דירת 2 חדרי שינה"></td>
            <td>
                <select data-idx="${idx}" data-field="category">
                    ${CATEGORY_OPTIONS.map(c => `<option value="${c.value}" ${pt.category === c.value ? 'selected' : ''}>${c.label}</option>`).join('')}
                </select>
            </td>
            <td><input type="number" min="0" value="${pt.bedrooms ?? ''}" data-idx="${idx}" data-field="bedrooms"></td>
            <td><input type="number" min="1" value="${pt.price ?? ''}" data-idx="${idx}" data-field="price" placeholder="250000"></td>
            <td><input type="number" min="0" value="${pt.size_min ?? ''}" data-idx="${idx}" data-field="size_min"></td>
            <td><input type="number" min="0" value="${pt.size_max ?? ''}" data-idx="${idx}" data-field="size_max"></td>
            <td><button type="button" class="remove-type-btn" data-idx="${idx}" title="מחק">✕</button></td>
        </tr>
    `).join('');

    tbody.querySelectorAll('input, select').forEach(el => {
        el.addEventListener('change', (e) => {
            const idx = parseInt(e.target.dataset.idx);
            const field = e.target.dataset.field;
            let value = e.target.value;
            if (['bedrooms', 'price', 'size_min', 'size_max'].includes(field)) {
                value = value === '' ? null : parseInt(value);
            }
            propertyTypesState[idx][field] = value;
        });
    });

    tbody.querySelectorAll('.remove-type-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const idx = parseInt(btn.dataset.idx);
            propertyTypesState.splice(idx, 1);
            renderPropertyTypes();
        });
    });
}

function addPropertyType() {
    propertyTypesState.push({
        type_name: '',
        category: 'apartment',
        bedrooms: null,
        price: null,
        size_min: null,
        size_max: null,
        _isNew: true
    });
    renderPropertyTypes();
}

// ----- Save / Delete -----
function collectFormData() {
    const loc = getCurrentLocation();
    if (!loc) {
        showToast('יש לבחור מיקום על המפה', 'error');
        return null;
    }

    const requiredFields = [
        ['f-name', 'שם הפרויקט'],
        ['f-developer', 'שם הקבלן'],
        ['f-area', 'אזור'],
        ['f-website', 'אתר הקבלן'],
        ['f-notes', 'הערות']
    ];
    for (const [id, label] of requiredFields) {
        if (!document.getElementById(id).value.trim()) {
            showToast(`שדה חובה חסר: ${label}`, 'error');
            document.getElementById(id).focus();
            return null;
        }
    }

    const get = (id) => document.getElementById(id).value.trim();
    const getNum = (id) => {
        const v = document.getElementById(id).value.trim();
        return v === '' ? null : parseInt(v);
    };
    const getCheck = (id) => document.getElementById(id).checked;

    return {
        name: get('f-name'),
        developer: get('f-developer'),
        area: get('f-area'),
        lat: loc.lat,
        lng: loc.lng,
        status: get('f-status'),
        project_phase: get('f-phase') || null,
        delivery_date: get('f-delivery') || null,
        floors: getNum('f-floors'),
        vat_rate: getNum('f-vat'),
        parking: getCheck('f-parking'),
        pool: getCheck('f-pool'),
        gym: getCheck('f-gym'),
        additional_facilities: get('f-additional-facilities') || null,
        distance_from_sea_m: getNum('f-distance-m'),
        drive_time_to_sea_minutes: getNum('f-drive-time'),
        contact_person_name: get('f-contact-name') || null,
        contact_person_phone: get('f-contact-phone') || null,
        contact_person_email: get('f-contact-email') || null,
        developer_website: get('f-website'),
        drive_link: get('f-drive') || null,
        notes: get('f-notes')
    };
}

function validatePropertyTypes() {
    for (const pt of propertyTypesState) {
        if (!pt.type_name?.trim()) {
            showToast('שם סוג נכס חסר באחד הסוגים', 'error');
            return false;
        }
        if (pt.bedrooms == null || pt.bedrooms < 0) {
            showToast(`חדרי שינה חסר עבור "${pt.type_name}"`, 'error');
            return false;
        }
        if (pt.price == null || pt.price <= 0) {
            showToast(`מחיר חסר עבור "${pt.type_name}"`, 'error');
            return false;
        }
    }
    return true;
}

async function saveProject() {
    const data = collectFormData();
    if (!data) return;
    if (!validatePropertyTypes()) return;

    const saveBtn = document.getElementById('save-btn');
    saveBtn.disabled = true;
    saveBtn.textContent = 'שומר...';

    try {
        await ensureDeveloperExists(data.developer);

        let projectId;

        if (isNewProject) {
            const { data: inserted, error } = await window.sb
                .from('projects')
                .insert(data)
                .select()
                .single();
            if (error) throw error;
            projectId = inserted.id;
        } else {
            const { error } = await window.sb
                .from('projects')
                .update(data)
                .eq('id', selectedProjectId);
            if (error) throw error;
            projectId = selectedProjectId;
        }

        // Sync property_types: delete all existing, re-insert
        if (!isNewProject) {
            const { error: delError } = await window.sb
                .from('property_types')
                .delete()
                .eq('project_id', projectId);
            if (delError) throw delError;
        }

        if (propertyTypesState.length > 0) {
            const ptToInsert = propertyTypesState.map(pt => ({
                project_id: projectId,
                type_name: pt.type_name.trim(),
                category: pt.category,
                bedrooms: pt.bedrooms,
                price: pt.price,
                size_min: pt.size_min,
                size_max: pt.size_max
            }));
            const { error: ptError } = await window.sb
                .from('property_types')
                .insert(ptToInsert);
            if (ptError) throw ptError;
        }

        showToast(isNewProject ? 'פרויקט נוצר בהצלחה' : 'פרויקט עודכן בהצלחה', 'success');

        await loadProjects();
        selectedProjectId = projectId;
        isNewProject = false;
        const newProject = allProjects.find(p => p.id === projectId);
        if (newProject) {
            document.getElementById('form-title').textContent = newProject.name;
            document.getElementById('delete-btn').style.display = 'inline-flex';
        }
        renderProjectList(document.getElementById('search-input').value);
    } catch (error) {
        console.error('Save failed:', error);
        showToast('שגיאה בשמירה: ' + error.message, 'error');
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = '💾 שמור';
    }
}

async function deleteProject() {
    if (!selectedProjectId) return;
    const project = allProjects.find(p => p.id === selectedProjectId);
    if (!project) return;

    if (!confirm(`האם אתה בטוח שברצונך למחוק את הפרויקט "${project.name}"?\n\nהפעולה לא ניתנת לביטול.`)) return;

    const delBtn = document.getElementById('delete-btn');
    delBtn.disabled = true;

    try {
        const { error } = await window.sb
            .from('projects')
            .delete()
            .eq('id', selectedProjectId);
        if (error) throw error;

        showToast('הפרויקט נמחק', 'success');
        await loadProjects();
        showEmptyForm();
    } catch (error) {
        showToast('שגיאה במחיקה: ' + error.message, 'error');
    } finally {
        delBtn.disabled = false;
    }
}

// ----- Developers management modal -----
function openDevelopersModal() {
    document.getElementById('developers-modal').classList.add('show');
    renderDevelopersList();
}

function closeDevelopersModal() {
    document.getElementById('developers-modal').classList.remove('show');
}

function countProjectsForDeveloper(name) {
    return allProjects.filter(p => p.developer === name).length;
}

function renderDevelopersList() {
    const list = document.getElementById('developers-list');

    if (allDevelopers.length === 0) {
        list.innerHTML = `<div class="loading-state">אין קבלנים עדיין — לחץ "+ הוסף קבלן חדש" למעלה</div>`;
        return;
    }

    list.innerHTML = allDevelopers.map(dev => {
        const projectCount = countProjectsForDeveloper(dev.name);
        const disabledIfNoProjects = projectCount === 0 ? 'disabled' : '';
        return `
        <div class="developer-row" data-id="${dev.id}">
            <div class="dev-projects-count">
                <strong>${projectCount}</strong> פרויקטים במאגר
            </div>
            <div class="dev-form-grid">
                <div class="form-group">
                    <label>שם הקבלן</label>
                    <input type="text" data-field="name" value="${escapeHtml(dev.name)}">
                </div>
                <div class="form-group">
                    <label>קישור Drive ברירת מחדל</label>
                    <input type="url" data-field="default_drive_link" value="${escapeHtml(dev.default_drive_link || '')}" placeholder="https://drive.google.com/...">
                </div>
            </div>
            <div class="dev-contact-grid">
                <div class="dev-section-label">👤 איש קשר ברירת מחדל</div>
                <div class="form-group">
                    <label>שם</label>
                    <input type="text" data-field="default_contact_person_name" value="${escapeHtml(dev.default_contact_person_name || '')}">
                </div>
                <div class="form-group">
                    <label>טלפון</label>
                    <input type="tel" dir="ltr" data-field="default_contact_person_phone" value="${escapeHtml(dev.default_contact_person_phone || '')}">
                </div>
                <div class="form-group">
                    <label>אימייל</label>
                    <input type="email" dir="ltr" data-field="default_contact_person_email" value="${escapeHtml(dev.default_contact_person_email || '')}">
                </div>
            </div>
            <div class="dev-row-actions">
                <button class="btn btn-primary" data-action="save">💾 שמור</button>
                <button class="btn btn-secondary" data-action="apply-drive" ${disabledIfNoProjects}>🔄 החל דרייב על ${projectCount} פרויקטים</button>
                <button class="btn btn-secondary" data-action="apply-contact" ${disabledIfNoProjects}>👤 החל איש קשר על ${projectCount} פרויקטים</button>
                <button class="btn btn-danger" data-action="delete" ${projectCount > 0 ? 'disabled title="לא ניתן למחוק קבלן שיש לו פרויקטים"' : ''}>🗑️ מחק</button>
            </div>
        </div>
        `;
    }).join('');

    list.querySelectorAll('.developer-row').forEach(row => {
        const devId = row.dataset.id;
        row.querySelector('[data-action="save"]').addEventListener('click', () => saveDeveloperEdit(devId, row));
        row.querySelector('[data-action="apply-drive"]').addEventListener('click', () => applyDriveLinkToAll(devId, row));
        row.querySelector('[data-action="apply-contact"]').addEventListener('click', () => applyContactToAll(devId, row));
        row.querySelector('[data-action="delete"]').addEventListener('click', () => deleteDeveloper(devId));
    });
}

async function saveDeveloperEdit(devId, row) {
    const dev = allDevelopers.find(d => d.id === devId);
    if (!dev) return;

    const newName = row.querySelector('[data-field="name"]').value.trim();
    const newDrive = row.querySelector('[data-field="default_drive_link"]').value.trim() || null;
    const newContactName = row.querySelector('[data-field="default_contact_person_name"]').value.trim() || null;
    const newContactPhone = row.querySelector('[data-field="default_contact_person_phone"]').value.trim() || null;
    const newContactEmail = row.querySelector('[data-field="default_contact_person_email"]').value.trim() || null;

    if (!newName) {
        showToast('שם הקבלן חובה', 'error');
        return;
    }

    const oldName = dev.name;
    const nameChanged = oldName !== newName;
    const projectCount = countProjectsForDeveloper(oldName);

    if (nameChanged && projectCount > 0) {
        if (!confirm(`לשנות את השם מ-"${oldName}" ל-"${newName}"?\nהשם יתעדכן גם ב-${projectCount} פרויקטים של הקבלן.`)) return;
    }

    try {
        const { error } = await window.sb
            .from('developers')
            .update({
                name: newName,
                default_drive_link: newDrive,
                default_contact_person_name: newContactName,
                default_contact_person_phone: newContactPhone,
                default_contact_person_email: newContactEmail
            })
            .eq('id', devId);
        if (error) throw error;

        if (nameChanged && projectCount > 0) {
            const { error: updError } = await window.sb
                .from('projects')
                .update({ developer: newName })
                .eq('developer', oldName);
            if (updError) throw updError;
        }

        showToast('הקבלן נשמר', 'success');
        await loadDevelopers();
        await loadProjects();
        renderDevelopersList();
    } catch (error) {
        showToast('שגיאה: ' + error.message, 'error');
    }
}

async function applyDriveLinkToAll(devId, row) {
    const dev = allDevelopers.find(d => d.id === devId);
    if (!dev) return;

    const driveLink = row.querySelector('[data-field="default_drive_link"]').value.trim();
    if (!driveLink) {
        showToast('יש להזין קישור דרייב לפני החלה', 'error');
        return;
    }

    const projectCount = countProjectsForDeveloper(dev.name);
    if (projectCount === 0) {
        showToast('אין פרויקטים לקבלן זה', 'error');
        return;
    }

    if (!confirm(`להחיל את הקישור על כל ${projectCount} הפרויקטים של "${dev.name}"?\nהקישור הקיים בכל פרויקט יוחלף.`)) return;

    try {
        // Save the dev first (in case the user changed the link but didn't save)
        const { error: devErr } = await window.sb
            .from('developers')
            .update({ default_drive_link: driveLink })
            .eq('id', devId);
        if (devErr) throw devErr;

        // Apply to all projects
        const { error } = await window.sb
            .from('projects')
            .update({ drive_link: driveLink })
            .eq('developer', dev.name);
        if (error) throw error;

        showToast(`הקישור הוחל על ${projectCount} פרויקטים`, 'success');
        await loadDevelopers();
        await loadProjects();
        renderDevelopersList();

        if (selectedProjectId) {
            const sel = allProjects.find(p => p.id === selectedProjectId);
            if (sel) document.getElementById('f-drive').value = sel.drive_link || '';
        }
    } catch (error) {
        showToast('שגיאה: ' + error.message, 'error');
    }
}

async function applyContactToAll(devId, row) {
    const dev = allDevelopers.find(d => d.id === devId);
    if (!dev) return;

    const contactName = row.querySelector('[data-field="default_contact_person_name"]').value.trim() || null;
    const contactPhone = row.querySelector('[data-field="default_contact_person_phone"]').value.trim() || null;
    const contactEmail = row.querySelector('[data-field="default_contact_person_email"]').value.trim() || null;

    if (!contactName && !contactPhone && !contactEmail) {
        showToast('יש להזין לפחות שדה אחד של איש קשר', 'error');
        return;
    }

    const projectCount = countProjectsForDeveloper(dev.name);
    if (projectCount === 0) {
        showToast('אין פרויקטים לקבלן זה', 'error');
        return;
    }

    if (!confirm(`להחיל את פרטי איש הקשר על כל ${projectCount} הפרויקטים של "${dev.name}"?\nהפרטים הקיימים בכל פרויקט יוחלפו.`)) return;

    try {
        const { error: devErr } = await window.sb
            .from('developers')
            .update({
                default_contact_person_name: contactName,
                default_contact_person_phone: contactPhone,
                default_contact_person_email: contactEmail
            })
            .eq('id', devId);
        if (devErr) throw devErr;

        const { error } = await window.sb
            .from('projects')
            .update({
                contact_person_name: contactName,
                contact_person_phone: contactPhone,
                contact_person_email: contactEmail
            })
            .eq('developer', dev.name);
        if (error) throw error;

        showToast(`איש קשר הוחל על ${projectCount} פרויקטים`, 'success');
        await loadDevelopers();
        await loadProjects();
        renderDevelopersList();

        if (selectedProjectId) {
            const sel = allProjects.find(p => p.id === selectedProjectId);
            if (sel) {
                document.getElementById('f-contact-name').value = sel.contact_person_name || '';
                document.getElementById('f-contact-phone').value = sel.contact_person_phone || '';
                document.getElementById('f-contact-email').value = sel.contact_person_email || '';
            }
        }
    } catch (error) {
        showToast('שגיאה: ' + error.message, 'error');
    }
}

async function deleteDeveloper(devId) {
    const dev = allDevelopers.find(d => d.id === devId);
    if (!dev) return;

    const projectCount = countProjectsForDeveloper(dev.name);
    if (projectCount > 0) {
        showToast('לא ניתן למחוק קבלן שיש לו פרויקטים', 'error');
        return;
    }

    if (!confirm(`למחוק את הקבלן "${dev.name}"?`)) return;

    try {
        const { error } = await window.sb.from('developers').delete().eq('id', devId);
        if (error) throw error;
        showToast('הקבלן נמחק', 'success');
        await loadDevelopers();
        renderDevelopersList();
    } catch (error) {
        showToast('שגיאה: ' + error.message, 'error');
    }
}

async function addNewDeveloper() {
    const name = prompt('שם הקבלן החדש:');
    if (!name || !name.trim()) return;

    try {
        const { error } = await window.sb
            .from('developers')
            .insert({ name: name.trim() });
        if (error) {
            if (error.code === '23505') {
                showToast('קבלן בשם זה כבר קיים', 'error');
            } else {
                throw error;
            }
            return;
        }
        showToast('קבלן נוסף', 'success');
        await loadDevelopers();
        renderDevelopersList();
    } catch (error) {
        showToast('שגיאה: ' + error.message, 'error');
    }
}

async function ensureDeveloperExists(name) {
    if (developersByName[name]) return;
    try {
        const { error } = await window.sb
            .from('developers')
            .insert({ name });
        if (error && error.code !== '23505') throw error;
        await loadDevelopers();
    } catch (error) {
        console.warn('Failed to auto-create developer:', error);
    }
}

function handleDeveloperFieldChange() {
    const name = document.getElementById('f-developer').value.trim();
    if (!name) return;
    const dev = developersByName[name];
    if (!dev) return;

    const filled = [];

    const driveField = document.getElementById('f-drive');
    if (dev.default_drive_link && !driveField.value.trim()) {
        driveField.value = dev.default_drive_link;
        filled.push('דרייב');
    }

    const contactNameField = document.getElementById('f-contact-name');
    if (dev.default_contact_person_name && !contactNameField.value.trim()) {
        contactNameField.value = dev.default_contact_person_name;
        filled.push('איש קשר');
    }

    const contactPhoneField = document.getElementById('f-contact-phone');
    if (dev.default_contact_person_phone && !contactPhoneField.value.trim()) {
        contactPhoneField.value = dev.default_contact_person_phone;
        if (!filled.includes('איש קשר')) filled.push('טלפון');
    }

    const contactEmailField = document.getElementById('f-contact-email');
    if (dev.default_contact_person_email && !contactEmailField.value.trim()) {
        contactEmailField.value = dev.default_contact_person_email;
        if (!filled.includes('איש קשר') && !filled.includes('טלפון')) filled.push('אימייל');
    }

    if (filled.length > 0) {
        showToast(`מולא אוטומטית מהקבלן ${name}: ${filled.join(', ')}`, 'success', 2200);
    }
}

// ----- Event listeners -----
function setupEventListeners() {
    document.getElementById('new-project-btn').addEventListener('click', startNewProject);
    document.getElementById('add-type-btn').addEventListener('click', addPropertyType);
    document.getElementById('save-btn').addEventListener('click', saveProject);
    document.getElementById('delete-btn').addEventListener('click', deleteProject);
    document.getElementById('cancel-btn').addEventListener('click', () => {
        if (selectedProjectId) {
            selectProject(selectedProjectId);
        } else {
            showEmptyForm();
        }
    });
    document.getElementById('search-input').addEventListener('input', (e) => {
        renderProjectList(e.target.value);
        if (sidebarMap) renderSidebarMapMarkers(e.target.value);
    });
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    document.getElementById('dev-mgmt-btn').addEventListener('click', openDevelopersModal);
    document.getElementById('dev-modal-close').addEventListener('click', closeDevelopersModal);
    document.getElementById('add-developer-btn').addEventListener('click', addNewDeveloper);
    document.getElementById('developers-modal').addEventListener('click', (e) => {
        if (e.target.id === 'developers-modal') closeDevelopersModal();
    });

    document.getElementById('f-developer').addEventListener('change', handleDeveloperFieldChange);
    document.getElementById('f-developer').addEventListener('blur', handleDeveloperFieldChange);
}

// ----- Init -----
async function init() {
    const session = await window.requireAuth();
    if (!session) return;

    const email = await window.getCurrentUserEmail();
    document.getElementById('user-email').textContent = email || '';

    initLocationMap();
    setupEventListeners();

    await Promise.all([
        loadAreas(),
        loadDevelopers(),
        loadProjects()
    ]);
}

init();
