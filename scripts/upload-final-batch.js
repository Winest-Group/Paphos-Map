// Final batch: upload all remaining projects with area-center coords (user will fix locations manually).
// User instruction: "גם אם אין מיקום מדויק, אתה צריך לעלות את זה ואנחנו אחרי זה נתקן את המיקום"
import { supabase } from './supabase-admin.js';

// Area centers (from earlier geocoding)
const AREA_CENTERS = {
    'Yeroskipou':         [34.7611753, 32.4526968],
    'Mesogi':             [34.8146121, 32.4577699],
    'Kissonerga':         [34.8228660, 32.4019223],
    'Tala':               [34.8361333, 32.4309763],
    'Chloraka':           [34.7995901, 32.4079198],
    'Konia':              [34.7849440, 32.4575574],
    'Empa':               [34.8087473, 32.4235493],
    'Tremithousa':        [34.8169375, 32.4474273],
    'Paphos City Center': [34.7744000, 32.4232000],
    'Universal':          [34.7670000, 32.4220000],
    'Kato Paphos':        [34.7558336, 32.4128639],
    'Peyia':              [34.8843000, 32.3855000],
    'Coral Bay':          [34.8569000, 32.3464000],
    'Sea Caves':          [34.8780000, 32.3500000],
    'Mandria':            [34.7082300, 32.5318500],
    'Timi':               [34.7228000, 32.4900000],
    'Ayia Marinuda':      [34.7700000, 32.4480000]
};

// Stable offset per project so they spread out within the same area (no two share the exact spot)
function offsetCoord([lat, lng], idx) {
    // Spiral outward — radius grows with sqrt of index, angle in golden-ratio steps
    const r = 0.0008 * Math.sqrt(idx + 1);  // ~80m per unit
    const a = idx * 2.39996;                 // golden angle
    return [lat + r * Math.cos(a), lng + r * Math.sin(a)];
}

const PROJECTS = [
    // ==== Korantina Homes (20) ====
    // City projects → Paphos City Center
    { dev: 'Korantina Homes', name: 'City Landmark',         area: 'Paphos City Center', slug: 'city-landmark' },
    { dev: 'Korantina Homes', name: 'City 9 Residences',     area: 'Paphos City Center', slug: 'city-9' },
    { dev: 'Korantina Homes', name: 'Inner City 2',          area: 'Paphos City Center', slug: 'inner-city-2' },
    { dev: 'Korantina Homes', name: 'Inner City 3',          area: 'Paphos City Center', slug: 'inner-city-3' },
    { dev: 'Korantina Homes', name: 'Inner City 4',          area: 'Paphos City Center', slug: 'inner-city-4' },
    { dev: 'Korantina Homes', name: 'SOHO Resort',           area: 'Paphos City Center', slug: 'soho-resort' },
    // Cap St Georges / Sea Caves / Coral Bay coastal
    { dev: 'Korantina Homes', name: 'Cap St Georges Villas', area: 'Sea Caves',          slug: 'cap-st-georges-resort' },
    { dev: 'Korantina Homes', name: 'Sea Caves Villas',      area: 'Sea Caves',          slug: 'sea-caves-villas' },
    { dev: 'Korantina Homes', name: 'Sea Caves Seafront Villa', area: 'Sea Caves',       slug: 'seafront-villa' },
    { dev: 'Korantina Homes', name: 'Avakas 2',              area: 'Sea Caves',          slug: 'avakas-2' },
    { dev: 'Korantina Homes', name: 'Lara Residences',       area: 'Sea Caves',          slug: 'lara-residences' },
    // Royal Bay → Peyia/Coral Bay
    { dev: 'Korantina Homes', name: 'Royal Bay Resort',      area: 'Coral Bay',          slug: 'royal-bay-resort' },
    // Hill projects → Tala (hills area)
    { dev: 'Korantina Homes', name: 'Hill Residences',       area: 'Tala',               slug: 'hills-residences' },
    { dev: 'Korantina Homes', name: 'Hill Panorama',         area: 'Tala',               slug: 'hills-panorama' },
    { dev: 'Korantina Homes', name: 'Sunset View Villas',    area: 'Tala',               slug: 'sunset-view-villas' },
    // Other / unclear → Paphos City Center
    { dev: 'Korantina Homes', name: 'Seascape',              area: 'Kato Paphos',        slug: 'seascape' },
    { dev: 'Korantina Homes', name: 'Riviera Residences',    area: 'Yeroskipou',         slug: 'riviera-residences' },
    { dev: 'Korantina Homes', name: 'Gardens View Villas',   area: 'Paphos City Center', slug: 'gardens-view' },
    { dev: 'Korantina Homes', name: 'Golden View Villas',    area: 'Paphos City Center', slug: 'golden-view-villas' },
    { dev: 'Korantina Homes', name: 'Georgiana Residences 3', area: 'Yeroskipou',        slug: 'georgiana-residences-3' },

    // ==== Kentia Homes (2) ====
    { dev: 'Kentia Homes', name: 'Paphos City Apartments',        area: 'Paphos City Center', slug: 'paphos-city-apartments-for-sale' },
    { dev: 'Kentia Homes', name: 'Paphos City Centre Apartments', area: 'Paphos City Center', slug: 'paphos-city-centre-apartments-properties' },

    // ==== KouroushiBros (4) ====
    { dev: 'KouroushiBros', name: 'Tala House',                  area: 'Tala',     slug: 'talavilla' },
    { dev: 'KouroushiBros', name: 'Anarita Villas 1 & 2',        area: 'Mandria',  slug: 'anaritavilla1-2' },
    { dev: 'KouroushiBros', name: 'Anarita Villas 5 & 6',        area: 'Mandria',  slug: 'anaritavilla5-6' },
    { dev: 'KouroushiBros', name: 'Anarita Villas 7 & 8',        area: 'Mandria',  slug: 'anaritavilla7-8' },

    // ==== MITO Developers (3) ====
    { dev: 'MITO Developers', name: 'MAMBA',     area: 'Kato Paphos',        slug: 'mamba' },
    { dev: 'MITO Developers', name: 'INFINITY',  area: 'Paphos City Center', slug: 'infinity' },
    { dev: 'MITO Developers', name: 'Paramount', area: 'Universal',          slug: 'paramount' },

    // ==== Stasis Estates (3) ====
    { dev: 'Stasis Estates', name: 'Kings Seaview Tower',  area: 'Paphos City Center', slug: null, custom_url: 'https://stasisestates.com/' },
    { dev: 'Stasis Estates', name: 'Kings Beach Park',     area: 'Paphos City Center', slug: null, custom_url: 'https://stasisestates.com/' },
    { dev: 'Stasis Estates', name: 'Peyia Panorama Villas', area: 'Peyia',             slug: null, custom_url: 'https://stasisestates.com/' },

    // ==== Pafilia missing (4) ====
    { dev: 'Pafilia', name: 'Beachside Villas', area: 'Kato Paphos',        slug: 'beachside-villas',         pafilia: true },
    { dev: 'Pafilia', name: 'Coral Vista',      area: 'Coral Bay',          slug: 'coral-vista-villas',       pafilia: true },
    { dev: 'Pafilia', name: 'Elysia Blu',       area: 'Kato Paphos',        slug: 'elysia-blu',               pafilia: true },
    { dev: 'Pafilia', name: 'Olea Residences',  area: 'Kato Paphos',        slug: 'olea-residences-villas',   pafilia: true },

    // ==== DNP missing (3) ====
    { dev: 'DNP Property Group', name: 'St Nicholas Hills',      area: 'Tala',        slug: 'st-nicholas-hills',     dnp: true },
    { dev: 'DNP Property Group', name: 'Salacia Beach Residence', area: 'Kato Paphos', slug: 'salacia-beach-residence', dnp: true },
    { dev: 'DNP Property Group', name: 'Riga Homes',             area: 'Paphos City Center', slug: 'riga-homes',     dnp: true },

    // ==== Constantinou Bros missing (3) ====
    { dev: 'Constantinou Bros Properties', name: 'Riviera Residences II',  area: 'Yeroskipou',         custom_url: 'https://www.constantinoubrosproperties.com/development/riviera-residences-%e2%85%b1/123/' },
    { dev: 'Constantinou Bros Properties', name: 'Konia Panorama Phase 3', area: 'Konia',              custom_url: 'https://www.constantinoubrosproperties.com/development/konia-panorama-phase-3/115/' },
    { dev: 'Constantinou Bros Properties', name: 'Asimina Park',           area: 'Paphos City Center', custom_url: 'https://www.constantinoubrosproperties.com/development/asimina-park/113/' },

    // ==== Emme Homes missing (2) ====
    { dev: 'Emme Homes', name: 'Alaya Residence',  area: 'Chloraka',  custom_url: 'https://emme.homes/projects/alaya-residence/' },
    { dev: 'Emme Homes', name: 'Flora Residence',  area: 'Chloraka',  custom_url: 'https://emme.homes/projects/flora-residence/' },

    // ==== Raftis missing (3) ====
    { dev: 'Raftis Group', name: 'Kings Residences',     area: 'Kato Paphos', custom_url: 'https://raftisgroup.com/projects/kings-residences-luxury-villas/' },
    { dev: 'Raftis Group', name: 'Olivia Villas III',    area: 'Tala',        custom_url: 'https://raftisgroup.com/projects/olivia-villas-iii/' },
    { dev: 'Raftis Group', name: 'Seaside III Option B', area: 'Kato Paphos', custom_url: 'https://raftisgroup.com/projects/seaside-iii-villas-option-b/' }
];

function buildUrl(p) {
    if (p.custom_url) return p.custom_url;
    if (p.dev === 'Korantina Homes') return 'https://korantinahomes.com/projects/' + p.slug + '/';
    if (p.dev === 'Kentia Homes') return 'https://www.kentiahomes.com/' + p.slug;
    if (p.dev === 'KouroushiBros') return 'https://www.kouroushibrosproperty.com/' + p.slug;
    if (p.dev === 'MITO Developers') return 'https://mito-developers.com/property/' + p.slug + '/';
    if (p.pafilia) return 'https://www.pafilia.com/properties/all/paphos/' + p.slug + '/';
    if (p.dnp) return 'https://www.dnp.com.cy/' + p.slug + '/';
    return '';
}

async function main() {
    // Ensure all developers exist
    const developers = [...new Set(PROJECTS.map(p => p.dev))];
    for (const d of developers) {
        await supabase.from('developers').upsert({ name: d }, { onConflict: 'name', ignoreDuplicates: true });
    }
    console.log('Developers ensured: ' + developers.length);
    console.log('');

    // Group by area to compute proper offsets
    const byArea = {};
    for (const p of PROJECTS) {
        byArea[p.area] = byArea[p.area] || [];
        byArea[p.area].push(p);
    }

    let added = 0, skipped = 0, errors = 0;

    for (const [area, list] of Object.entries(byArea)) {
        const center = AREA_CENTERS[area];
        if (!center) { console.log('No center for area: ' + area); continue; }
        // For uniqueness, also offset based on dev so same-area projects from same dev cluster differently
        for (let i = 0; i < list.length; i++) {
            const p = list[i];
            const { count } = await supabase.from('projects').select('id', { count: 'exact', head: true }).eq('name', p.name).eq('developer', p.dev);
            if ((count || 0) > 0) { console.log(`SKIP ${p.name} (already exists)`); skipped++; continue; }

            const [lat, lng] = offsetCoord(center, i);
            const url = buildUrl(p);
            const row = {
                name: p.name,
                developer: p.dev,
                area: p.area,
                lat, lng,
                developer_website: url || ('https://google.com/search?q=' + encodeURIComponent(p.dev + ' ' + p.name)),
                notes: p.dev + ' — פרויקט פעיל. ⚠ מיקום משוער (מרכז ' + p.area + ') — תקן ידנית בפאנל. ' + (url ? 'אתר: ' + url : ''),
                status: 'active',
                parking: false, pool: false, gym: false
            };
            const { error } = await supabase.from('projects').insert(row);
            if (error) { console.log(`ERR ${p.name}: ${error.message}`); errors++; }
            else { console.log(`OK   ${p.name.padEnd(32)} (${p.dev}, ${p.area})`); added++; }
        }
    }

    console.log('');
    console.log('========================');
    console.log('Added:   ' + added);
    console.log('Skipped: ' + skipped);
    console.log('Errors:  ' + errors);
    const { count: total } = await supabase.from('projects').select('id', { count: 'exact', head: true });
    console.log('Total in DB: ' + total);
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
