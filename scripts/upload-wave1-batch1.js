// Wave 1 Batch 1: Upload 15 projects with reliable GPS (Pafilia, Island Blue, DNP partial, Olias)
import { supabase } from './supabase-admin.js';

const PROJECTS = [
    // Pafilia (3 with GPS, 4 missing → need puppeteer)
    { dev: 'Pafilia', name: 'Konia Green',           area: 'Konia',              lat: 34.78494, lng: 32.45756, url: 'https://www.pafilia.com/properties/all/paphos/konia-green/' },
    { dev: 'Pafilia', name: 'Minthis',               area: 'Tsada',              lat: 34.82334, lng: 32.49663, url: 'https://www.pafilia.com/properties/all/paphos/minthis/' },
    { dev: 'Pafilia', name: 'Pafilia Plaza',         area: 'Kato Paphos',        lat: 34.75828, lng: 32.41628, url: 'https://www.pafilia.com/properties/all/paphos/pafilia-plaza/' },
    // Island Blue (5, all)
    { dev: 'Island Blue', name: 'IBC Tower',         area: 'Universal',          lat: 34.76906, lng: 32.41714, url: 'https://www.islandbluecyprus.com/projects/ibc-tower' },
    { dev: 'Island Blue', name: 'Avalon Gardens 2',  area: 'Empa',               lat: 34.79414, lng: 32.42173, url: 'https://www.islandbluecyprus.com/projects/avalon-gardens-2' },
    { dev: 'Island Blue', name: 'Sapphire',          area: 'Kato Paphos',        lat: 34.74100, lng: 32.43552, url: 'https://www.islandbluecyprus.com/projects/sapphire' },
    { dev: 'Island Blue', name: 'The King Residences', area: 'Paphos City Center', lat: 34.77883, lng: 32.41278, url: 'https://www.islandbluecyprus.com/projects/the-king-residences' },
    { dev: 'Island Blue', name: 'Cityscape Residences', area: 'Paphos City Center', lat: 34.77658, lng: 32.42983, url: 'https://www.islandbluecyprus.com/projects/cityscape-resdidences' },
    // DNP (3 with reliable GPS, 4 missing)
    { dev: 'DNP Property Group', name: 'DNP Park View',     area: 'Konia',         lat: 34.76519, lng: 32.44643, url: 'https://www.dnp.com.cy/dnp-park-view/' },
    { dev: 'DNP Property Group', name: 'Ivy City Residence', area: 'Paphos City Center', lat: 34.78422, lng: 32.41747, url: 'https://www.dnp.com.cy/ivy-city-residence/' },
    { dev: 'DNP Property Group', name: 'Melrose Place',     area: 'Yeroskipou',    lat: 34.75219, lng: 32.47118, url: 'https://www.dnp.com.cy/melrose-place/' },
    // Olias (4, all)
    { dev: 'Olias Homes', name: 'The Triangle House', area: 'Kato Paphos',        lat: 34.78211, lng: 32.40755, url: 'https://oliashomes.com/project/the-triangle-house/' },
    { dev: 'Olias Homes', name: 'Pine Park',          area: 'Paphos City Center', lat: 34.77783, lng: 32.41623, url: 'https://oliashomes.com/project/pine-park-2bed-apartments-paphos/' },
    { dev: 'Olias Homes', name: 'Grato Homes Phase 2', area: 'Sea Caves',         lat: 34.88544, lng: 32.35950, url: 'https://oliashomes.com/project/grato-homes-phase-2/' },
    { dev: 'Olias Homes', name: 'Olivelia Homes',     area: 'Yeroskipou',         lat: 34.74756, lng: 32.46493, url: 'https://oliashomes.com/project/olivelia-park-villas-for-sale-paphos/' }
];

async function ensureDeveloper(name) {
    const { error } = await supabase.from('developers').upsert({ name }, { onConflict: 'name', ignoreDuplicates: true });
    if (error && error.code !== '23505') throw error;
}

async function projectExists(name, developer) {
    const { count } = await supabase.from('projects').select('id', { count: 'exact', head: true }).eq('name', name).eq('developer', developer);
    return (count || 0) > 0;
}

async function main() {
    const developers = [...new Set(PROJECTS.map(p => p.dev))];
    for (const d of developers) {
        await ensureDeveloper(d);
        console.log('Developer ensured: ' + d);
    }
    console.log('');

    let added = 0, skipped = 0, errors = 0;
    for (const p of PROJECTS) {
        if (await projectExists(p.name, p.dev)) {
            console.log(`  SKIP ${p.name}`);
            skipped++;
            continue;
        }
        const row = {
            name: p.name,
            developer: p.dev,
            area: p.area,
            lat: p.lat,
            lng: p.lng,
            developer_website: p.url,
            notes: `${p.dev} — פרויקט פעיל. פרטים מלאים (מחירים, סוגי נכסים) ניתן להוסיף בפאנל הניהול או באתר: ${p.url}`,
            status: 'active',
            parking: false, pool: false, gym: false
        };
        const { error } = await supabase.from('projects').insert(row);
        if (error) { console.log(`  ERR  ${p.name}: ${error.message}`); errors++; }
        else { console.log(`  OK   ${p.name.padEnd(28)} ${p.dev}`); added++; }
    }
    console.log('\n================');
    console.log(`Added: ${added} | Skipped: ${skipped} | Errors: ${errors}`);
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
