// Seeds one property_type per Domenica project (the starting price from website)
// Skips projects that already have property_types defined.
// Also fixes Oculus GPS overlap with Universal Ariad.
import { supabase } from './supabase-admin.js';

// Starting prices scraped from domenicagroup.com — one entry per project
const STARTING_PRICES = [
    { name: 'VIRGO Villas',                type_name: 'דירת 2 חד״ש (מחיר התחלתי)',  category: 'apartment',  bedrooms: 2, price: 275000, size_min: 93,  size_max: 130 },
    { name: 'Mesogi Residence 8',          type_name: 'וילה 3 חד״ש (מחיר התחלתי)',  category: 'villa',      bedrooms: 3, price: 395000, size_min: 120, size_max: 219 },
    { name: 'Lyra',                        type_name: 'וילה 3 חד״ש',                 category: 'townhouse',  bedrooms: 3, price: 470000, size_min: 132, size_max: 208 },
    { name: 'Absolute Villas',             type_name: 'וילה 3 חד״ש',                 category: 'villa',      bedrooms: 3, price: 480000, size_min: 325, size_max: 485 },
    { name: 'Aqua Villas',                 type_name: 'וילה 3 חד״ש דטאצ׳ד',          category: 'villa',      bedrooms: 3, price: 670000, size_min: 255, size_max: 295 },
    { name: 'Montes Villas',               type_name: 'וילה 3 חד״ש (מחיר התחלתי)',  category: 'villa',      bedrooms: 3, price: 760000, size_min: 520, size_max: 620 },
    { name: 'Orion Villas',                type_name: 'בנגלו (מחיר התחלתי)',         category: 'bungalow',   bedrooms: 3, price: 855000, size_min: 191, size_max: 268 },
    { name: 'Riverside',                   type_name: 'סטודיו (מחיר התחלתי)',        category: 'studio',     bedrooms: 0, price: 180000, size_min: 42,  size_max: 60  },
    { name: 'Thea Residences',             type_name: 'דירת 1 חד״ש (מחיר התחלתי)',  category: 'apartment',  bedrooms: 1, price: 210000, size_min: 57,  size_max: 70  },
    { name: 'La Bella',                    type_name: 'סטודיו (מחיר התחלתי)',        category: 'studio',     bedrooms: 0, price: 215000, size_min: 42,  size_max: 50  },
    { name: 'Aura Konia',                  type_name: 'דירת 1 חד״ש (מחיר התחלתי)',  category: 'apartment',  bedrooms: 1, price: 215000, size_min: 73,  size_max: 85  },
    { name: 'Elements',                    type_name: 'דירת 1 חד״ש (מחיר התחלתי)',  category: 'apartment',  bedrooms: 1, price: 270000, size_min: 63,  size_max: 80  },
    { name: 'Universal Ariad',             type_name: 'דירה (מחיר התחלתי)',          category: 'apartment',  bedrooms: 1, price: 275000, size_min: 42,  size_max: 60  },
    { name: 'Oculus',                      type_name: 'סטודיו (מחיר התחלתי)',        category: 'studio',     bedrooms: 0, price: 345000, size_min: 44,  size_max: 55  },
    { name: 'Cirvis',                      type_name: 'דירת 1 חד״ש (מחיר התחלתי)',  category: 'apartment',  bedrooms: 1, price: 365000, size_min: 57,  size_max: 75  },
    { name: 'Eniko Mare',                  type_name: 'דירת 1 חד״ש (מחיר התחלתי)',  category: 'apartment',  bedrooms: 1, price: 430000, size_min: 63,  size_max: 75  },
    { name: 'Artemis Villas',              type_name: 'וילה 3 חד״ש (מחיר התחלתי)',  category: 'villa',      bedrooms: 3, price: 750000, size_min: 200, size_max: 200 },
    { name: 'Premier Villas',              type_name: 'וילה דטאצ׳ד (מחיר התחלתי)',   category: 'villa',      bedrooms: 3, price: 505000, size_min: 340, size_max: 415 },
    { name: 'Mare Villas',                 type_name: 'וילה 3 חד״ש (מחיר התחלתי)',  category: 'villa',      bedrooms: 3, price: 560000, size_min: 136, size_max: 136 },
    { name: 'The Edge',                    type_name: 'דירת 1 חד״ש (מחיר התחלתי)',  category: 'apartment',  bedrooms: 1, price: 225000, size_min: 63,  size_max: 80  },
    { name: 'La Reina',                    type_name: 'דירת 1 חד״ש (מחיר התחלתי)',  category: 'apartment',  bedrooms: 1, price: 175000, size_min: 53,  size_max: 65  },
    { name: 'Quattro',                     type_name: 'דירה (מחיר התחלתי)',          category: 'apartment',  bedrooms: 1, price: 290000, size_min: 62,  size_max: 80  },
    { name: 'Lofos Heights',               type_name: 'וילה 3 חד״ש (מחיר התחלתי)',  category: 'villa',      bedrooms: 3, price: 1200000, size_min: 240, size_max: 325 },
    { name: 'Aquilla Villas',              type_name: 'וילה 3 חד״ש (מחיר התחלתי)',  category: 'villa',      bedrooms: 3, price: 740000, size_min: 212, size_max: 212 },
    { name: 'Capella',                     type_name: 'סטודיו (מחיר התחלתי)',        category: 'studio',     bedrooms: 0, price: 245000, size_min: 41,  size_max: 50  },
    { name: 'Original',                    type_name: 'דירה (מחיר התחלתי)',          category: 'apartment',  bedrooms: 1, price: 240000, size_min: 47,  size_max: 60  },
    { name: 'Aquarius',                    type_name: 'דירת 1 חד״ש (מחיר התחלתי)',  category: 'apartment',  bedrooms: 1, price: 400000, size_min: 43,  size_max: 60  }
];

async function findProjectId(name, developer) {
    const { data, error } = await supabase
        .from('projects')
        .select('id')
        .eq('name', name)
        .eq('developer', developer)
        .limit(1);
    if (error) throw error;
    return data && data.length > 0 ? data[0].id : null;
}

async function projectHasPropertyTypes(projectId) {
    const { count, error } = await supabase
        .from('property_types')
        .select('id', { count: 'exact', head: true })
        .eq('project_id', projectId);
    if (error) throw error;
    return (count || 0) > 0;
}

async function fixOculusOverlap() {
    const { data, error } = await supabase
        .from('projects')
        .select('id, lat, lng')
        .eq('name', 'Oculus')
        .eq('developer', 'Domenica Group')
        .limit(1);
    if (error) throw error;
    if (!data || data.length === 0) {
        console.log('  Oculus not found, skipping');
        return;
    }
    const o = data[0];
    // Only move if still at original overlapping coordinate
    if (Math.abs(o.lat - 34.757583) < 0.0001 && Math.abs(o.lng - 32.429333) < 0.0001) {
        // Move ~35m north + 25m east to separate from Universal Ariad
        const { error: upErr } = await supabase
            .from('projects')
            .update({ lat: 34.757900, lng: 32.429580 })
            .eq('id', o.id);
        if (upErr) throw upErr;
        console.log('  Oculus moved ~40m NE to avoid overlap with Universal Ariad');
    } else {
        console.log(`  Oculus already at adjusted coords (${o.lat}, ${o.lng}), leaving as is`);
    }
}

async function main() {
    console.log('1/2 Seeding starting prices...');
    let added = 0, skipped = 0, missing = 0;

    for (const sp of STARTING_PRICES) {
        const projectId = await findProjectId(sp.name, 'Domenica Group');
        if (!projectId) {
            console.log(`  MISS  ${sp.name}: project not in DB`);
            missing++;
            continue;
        }

        if (await projectHasPropertyTypes(projectId)) {
            console.log(`  SKIP  ${sp.name}: already has property_types`);
            skipped++;
            continue;
        }

        const { error } = await supabase.from('property_types').insert({
            project_id: projectId,
            type_name: sp.type_name,
            category: sp.category,
            bedrooms: sp.bedrooms,
            price: sp.price,
            size_min: sp.size_min,
            size_max: sp.size_max
        });
        if (error) {
            console.log(`  ERR   ${sp.name}: ${error.message}`);
        } else {
            console.log(`  OK    ${sp.name}: €${sp.price.toLocaleString()}`);
            added++;
        }
    }

    console.log('\n2/2 Fixing Oculus GPS overlap...');
    await fixOculusOverlap();

    console.log('\n========================================');
    console.log(`Property types added: ${added}`);
    console.log(`Skipped (existing):   ${skipped}`);
    console.log(`Missing projects:     ${missing}`);
    console.log('========================================');
}

main().catch(e => {
    console.error('FATAL:', e.message);
    process.exit(1);
});
