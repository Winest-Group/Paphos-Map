// Uploads 22 projects from Medousa Developers + Kuutio Homes as skeletons with accurate GPS.
// Details (prices, sizes, facilities) can be enriched later via admin panel.
import { supabase } from './supabase-admin.js';

const PROJECTS = [
    // ===== MEDOUSA (11) =====
    { dev: 'Medousa Developers', name: 'Azure Living',         area: 'Chloraka',           lat: 34.8061310, lng: 32.4052105, phase: 'planned',      url_slug: 'azure-living' },
    { dev: 'Medousa Developers', name: 'Aurelia Homes',        area: 'Tala',               lat: 34.8306836, lng: 32.4216069, phase: 'planned',      url_slug: 'aurelia-homes' },
    { dev: 'Medousa Developers', name: 'Royal Horizon',        area: 'Tala',               lat: 34.8408363, lng: 32.4242537, phase: 'planned',      url_slug: 'royal-horizon' },
    { dev: 'Medousa Developers', name: 'Cypress Park Living',  area: 'Yeroskipou',         lat: 34.7628985, lng: 32.4648682, phase: 'planned',      url_slug: 'cypress-park-living' },
    { dev: 'Medousa Developers', name: 'Marelia Valley',       area: 'Konia',              lat: 34.7818496, lng: 32.4609024, phase: 'planned',      url_slug: 'marelia-valley' },
    { dev: 'Medousa Developers', name: 'Michelle Park',        area: 'Universal',          lat: 34.7643571, lng: 32.4312386, phase: 'planned',      url_slug: 'michelle-park' },
    { dev: 'Medousa Developers', name: 'M.B.C',                area: 'Paphos City Center', lat: 34.7821395, lng: 32.4450174, phase: 'planned',      url_slug: 'mbc' },
    { dev: 'Medousa Developers', name: 'Golden Hills',         area: 'Yeroskipou',         lat: 34.7671320, lng: 32.4612330, phase: 'construction', url_slug: 'golden-hills' },
    { dev: 'Medousa Developers', name: 'Infinity Residences',  area: 'Peyia',              lat: 34.8848060, lng: 32.3729720, phase: 'construction', url_slug: 'infinity-residences' },
    { dev: 'Medousa Developers', name: 'Adonidos Gardens',     area: 'Yeroskipou',         lat: 34.7629166, lng: 32.4650975, phase: 'planned',      url_slug: 'adonidos-gardens' },
    { dev: 'Medousa Developers', name: 'Panorama Apartments',  area: 'Yeroskipou',         lat: 34.7543375, lng: 32.4601148, phase: 'construction', url_slug: 'panorama-apartments' },
    // ===== KUUTIO (11) =====
    { dev: 'Kuutio Homes', name: 'New Gallery',         area: 'Chloraka',           lat: 34.802556,   lng: 32.404194,   phase: 'planned',      url_slug: 'new-gallery' },
    { dev: 'Kuutio Homes', name: 'Nirvana Residences',  area: 'Peyia',              lat: 34.872639,   lng: 32.386444,   phase: 'planned',      url_slug: 'nirvana-residences-2' },
    { dev: 'Kuutio Homes', name: 'Twins',               area: 'Paphos City Center', lat: 34.7728611,  lng: 32.4172778,  phase: 'planned',      url_slug: 'twins-2' },
    { dev: 'Kuutio Homes', name: 'AION',                area: 'Kato Paphos',        lat: 34.7558336,  lng: 32.4128639,  phase: 'planned',      url_slug: 'aion' },
    { dev: 'Kuutio Homes', name: 'Noble',               area: 'Kato Paphos',        lat: 34.780389,   lng: 32.413389,   phase: 'planned',      url_slug: 'noble' },
    { dev: 'Kuutio Homes', name: 'Baia',                area: 'Kato Paphos',        lat: 34.733105,   lng: 32.451610,   phase: 'planned',      url_slug: 'baia' },
    { dev: 'Kuutio Homes', name: 'Atrium',              area: 'Kato Paphos',        lat: 34.7553333,  lng: 32.4331944,  phase: 'planned',      url_slug: 'atrium' },
    { dev: 'Kuutio Homes', name: 'Trees',               area: 'Kato Paphos',        lat: 34.769333,   lng: 32.415333,   phase: 'planned',      url_slug: 'trees' },
    { dev: 'Kuutio Homes', name: 'Kuunal',              area: 'Kato Paphos',        lat: 34.769028,   lng: 32.407500,   phase: 'planned',      url_slug: 'kuunal' },
    { dev: 'Kuutio Homes', name: 'Quatroo',             area: 'Kato Paphos',        lat: 34.769103,   lng: 32.413617,   phase: 'planned',      url_slug: 'quatrro' },
    { dev: 'Kuutio Homes', name: 'Zeus',                area: 'Sea Caves',          lat: 34.881278,   lng: 32.346111,   phase: 'planned',      url_slug: 'zeus' }
];

function urlFor(p) {
    if (p.dev === 'Medousa Developers') return `https://medousadevelopers.com/en/project/${p.url_slug}/`;
    if (p.dev === 'Kuutio Homes') return `https://kuutiohomes.com/portfolio/${p.url_slug}/`;
    return '';
}

async function ensureDeveloper(name) {
    const { error } = await supabase
        .from('developers')
        .upsert({ name }, { onConflict: 'name', ignoreDuplicates: true });
    if (error && error.code !== '23505') throw error;
}

async function projectExists(name, developer) {
    const { count } = await supabase
        .from('projects')
        .select('id', { count: 'exact', head: true })
        .eq('name', name)
        .eq('developer', developer);
    return (count || 0) > 0;
}

async function main() {
    console.log('Ensuring developers...');
    const developers = [...new Set(PROJECTS.map(p => p.dev))];
    for (const d of developers) {
        await ensureDeveloper(d);
        console.log('  OK ' + d);
    }

    console.log(`\nInserting ${PROJECTS.length} projects...`);
    let added = 0, skipped = 0, errors = 0;

    for (const p of PROJECTS) {
        if (await projectExists(p.name, p.dev)) {
            console.log(`  SKIP ${p.name} (${p.dev}) — already exists`);
            skipped++;
            continue;
        }

        const url = urlFor(p);
        const notes = `${p.dev} — פרויקט פעיל. פרטים מלאים (מחירים, סוגי נכסים, פסיליטיז) ניתן להוסיף בפאנל הניהול. עמוד הפרויקט: ${url}`;

        const row = {
            name: p.name,
            developer: p.dev,
            area: p.area,
            lat: p.lat,
            lng: p.lng,
            developer_website: url,
            notes,
            status: 'active',
            project_phase: p.phase,
            parking: false,
            pool: false,
            gym: false
        };

        const { error } = await supabase.from('projects').insert(row);
        if (error) {
            console.log(`  ERR  ${p.name}: ${error.message}`);
            errors++;
        } else {
            console.log(`  OK   ${p.name.padEnd(28)} (${p.dev.replace(' Developers', '').replace(' Homes', '').padEnd(8)}) → ${p.area}`);
            added++;
        }
    }

    console.log('\n========================================');
    console.log(`Inserted: ${added} | Skipped: ${skipped} | Errors: ${errors}`);
    console.log('========================================');
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
