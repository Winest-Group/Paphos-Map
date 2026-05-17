// Uploads 31 Leptos Estates projects (Paphos area, all for_sale)
import { supabase } from './supabase-admin.js';
import { readFileSync } from 'fs';

const DEVELOPER = 'Leptos Estates';
const results = JSON.parse(readFileSync('./scripts/leptos-results.json', 'utf8'));

async function ensureDeveloper() {
    const { error } = await supabase
        .from('developers')
        .upsert({ name: DEVELOPER }, { onConflict: 'name', ignoreDuplicates: true });
    if (error && error.code !== '23505') throw error;
}

async function projectExists(name) {
    const { count } = await supabase
        .from('projects')
        .select('id', { count: 'exact', head: true })
        .eq('name', name)
        .eq('developer', DEVELOPER);
    return (count || 0) > 0;
}

async function main() {
    console.log('Ensuring developer...');
    await ensureDeveloper();
    console.log('  OK ' + DEVELOPER);

    console.log(`\nInserting ${results.length} Leptos projects...`);
    let added = 0, skipped = 0, errors = 0;

    for (const r of results) {
        if (!r.lat || !r.lng) {
            console.log(`  SKIP ${r.name} — no GPS`);
            skipped++;
            continue;
        }
        if (await projectExists(r.name)) {
            console.log(`  SKIP ${r.name} — already exists`);
            skipped++;
            continue;
        }

        const notes = `Leptos Estates — פרויקט פעיל למכירה. פרטים מלאים (מחירים, סוגי נכסים, פסיליטיז) ניתן להוסיף בפאנל הניהול או באתר: ${r.url}`;

        const row = {
            name: r.name,
            developer: DEVELOPER,
            area: r.area,
            lat: r.lat,
            lng: r.lng,
            developer_website: r.url,
            notes,
            status: 'active',
            parking: false,
            pool: false,
            gym: false
        };

        const { error } = await supabase.from('projects').insert(row);
        if (error) {
            console.log(`  ERR  ${r.name}: ${error.message}`);
            errors++;
        } else {
            console.log(`  OK   ${r.name.padEnd(28)} → ${r.area}`);
            added++;
        }
    }

    console.log('\n========================================');
    console.log(`Inserted: ${added} | Skipped: ${skipped} | Errors: ${errors}`);
    console.log('========================================');
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
