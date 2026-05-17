// Uploads 30 Domenica Group projects, ensuring areas and developer exist.
// Idempotent: skips projects that already exist (matched by name + developer).
import { supabase } from './supabase-admin.js';
import { DOMENICA_PROJECTS } from './domenica-projects-data.js';

const DEVELOPER = 'Domenica Group';

async function ensureArea(name, displayOrder) {
    const { error } = await supabase
        .from('areas')
        .upsert({ name, display_order: displayOrder }, { onConflict: 'name' });
    if (error) throw new Error(`areas upsert: ${error.message}`);
}

async function ensureDeveloper(name) {
    const { error } = await supabase
        .from('developers')
        .upsert({ name }, { onConflict: 'name', ignoreDuplicates: true });
    if (error) throw new Error(`developers upsert: ${error.message}`);
}

async function projectExists(name, developer) {
    const { count, error } = await supabase
        .from('projects')
        .select('id', { count: 'exact', head: true })
        .eq('name', name)
        .eq('developer', developer);
    if (error) throw new Error(`exists check: ${error.message}`);
    return (count || 0) > 0;
}

function buildRow(p) {
    return {
        name: p.name,
        developer: DEVELOPER,
        area: p.area,
        lat: p.lat,
        lng: p.lng,
        developer_website: `https://www.domenicagroup.com/portfolio/${p.url}`,
        notes: p.notes,
        status: 'active',
        project_phase: p.phase,
        floors: p.floors,
        parking: p.parking,
        pool: p.pool,
        gym: p.gym,
        additional_facilities: p.facilities,
        distance_from_sea_m: p.distance
    };
}

async function main() {
    console.log('1/3 Ensuring Tremithousa area...');
    await ensureArea('Tremithousa', 20);
    console.log('    OK');

    console.log('2/3 Ensuring Domenica Group developer...');
    await ensureDeveloper(DEVELOPER);
    console.log('    OK');

    console.log(`3/3 Inserting ${DOMENICA_PROJECTS.length} projects...`);

    let inserted = 0, skipped = 0, errors = 0;
    const errorDetails = [];

    for (const p of DOMENICA_PROJECTS) {
        try {
            const exists = await projectExists(p.name, DEVELOPER);
            if (exists) {
                console.log(`  SKIP  ${p.name} (already exists)`);
                skipped++;
                continue;
            }
            const row = buildRow(p);
            const { error } = await supabase.from('projects').insert(row);
            if (error) {
                console.log(`  ERR   ${p.name}: ${error.message}`);
                errors++;
                errorDetails.push({ name: p.name, message: error.message });
            } else {
                console.log(`  OK    ${p.name} (${p.area})`);
                inserted++;
            }
        } catch (e) {
            console.log(`  ERR   ${p.name}: ${e.message}`);
            errors++;
            errorDetails.push({ name: p.name, message: e.message });
        }
    }

    console.log('');
    console.log('========================================');
    console.log(`Inserted: ${inserted}`);
    console.log(`Skipped:  ${skipped}`);
    console.log(`Errors:   ${errors}`);
    console.log('========================================');

    if (errorDetails.length > 0) {
        console.log('Error details:');
        for (const e of errorDetails) console.log(`  - ${e.name}: ${e.message}`);
        process.exit(1);
    }
}

main().catch(e => {
    console.error('FATAL:', e.message);
    process.exit(1);
});
