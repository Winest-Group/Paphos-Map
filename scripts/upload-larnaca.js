// Extract GPS for all 95 Larnaca projects (static first, puppeteer fallback for the rest)
// then upload everything with city='Larnaca'.
import { supabase } from './supabase-admin.js';
import { extractGPS } from './extract-gps.js';
import { LARNACA_PROJECTS, LARNACA_AREA_CENTERS } from './larnaca-data.js';
import { writeFileSync } from 'fs';

const BATCH_SIZE = 8; // parallel fetches

function offsetCoord([lat, lng], idx) {
    const r = 0.0008 * Math.sqrt(idx + 1);
    const a = idx * 2.39996;
    return [lat + r * Math.cos(a), lng + r * Math.sin(a)];
}

async function extractAll() {
    console.log(`[1/3] Extracting GPS from ${LARNACA_PROJECTS.length} URLs (static)...`);
    const results = [];
    for (let i = 0; i < LARNACA_PROJECTS.length; i += BATCH_SIZE) {
        const batch = LARNACA_PROJECTS.slice(i, i + BATCH_SIZE);
        const batchResults = await Promise.all(batch.map(async (p) => {
            try { return { ...p, ...(await extractGPS(p.url)) }; }
            catch (e) { return { ...p, source: 'ERR', error: e.message }; }
        }));
        results.push(...batchResults);
    }
    const withGPS = results.filter(r => r.lat).length;
    console.log(`  Found GPS for ${withGPS}/${results.length}`);
    return results;
}

async function tryPuppeteer(missing) {
    console.log(`\n[2/3] Trying puppeteer for ${missing.length} missing...`);
    const { extractGPSPuppeteer, closeBrowser } = await import('./extract-gps-puppeteer.js');
    let recovered = 0;
    for (const p of missing) {
        try {
            const r = await extractGPSPuppeteer(p.url);
            if (r.lat) { p.lat = r.lat; p.lng = r.lng; p.source = 'puppeteer:' + r.source; recovered++; }
        } catch (e) { p.error = e.message; }
    }
    await closeBrowser();
    console.log(`  Puppeteer recovered ${recovered} more`);
    return recovered;
}

function applyAreaFallback(missing) {
    console.log(`\n[2.5/3] Applying area-center fallback for ${missing.length} still-missing...`);
    // Track index per area for unique offsets
    const areaCount = {};
    for (const p of missing) {
        const center = LARNACA_AREA_CENTERS[p.area];
        if (!center) {
            console.log(`  WARN no center for area "${p.area}" (${p.name})`);
            continue;
        }
        const i = areaCount[p.area] || 0;
        const [lat, lng] = offsetCoord(center, i);
        p.lat = lat; p.lng = lng;
        p.source = 'area_fallback';
        areaCount[p.area] = i + 1;
    }
    return missing.length;
}

async function uploadAll(projects) {
    console.log(`\n[3/3] Uploading ${projects.length} projects to DB...`);
    const developers = [...new Set(projects.map(p => p.dev))];
    for (const d of developers) {
        await supabase.from('developers').upsert({ name: d }, { onConflict: 'name', ignoreDuplicates: true });
    }

    let added = 0, skipped = 0, errors = 0;
    const errorDetails = [];

    for (const p of projects) {
        if (!p.lat) { skipped++; continue; }

        const { count } = await supabase.from('projects').select('id', { count: 'exact', head: true })
            .eq('name', p.name).eq('developer', p.dev);
        if ((count || 0) > 0) { skipped++; continue; }

        const sourceNote = p.source === 'area_fallback' ? '⚠ מיקום משוער (מרכז ' + p.area + ') — תקן ידנית בפאנל.' : '';
        const row = {
            name: p.name,
            developer: p.dev,
            area: p.area,
            city: 'Larnaca',
            lat: p.lat,
            lng: p.lng,
            developer_website: p.url,
            notes: `${p.dev} — פרויקט פעיל בלרנקה. ${sourceNote} אתר: ${p.url}`,
            status: 'active',
            parking: false, pool: false, gym: false
        };
        const { error } = await supabase.from('projects').insert(row);
        if (error) {
            console.log(`  ERR ${p.name}: ${error.message}`);
            errorDetails.push({ name: p.name, error: error.message });
            errors++;
        } else {
            added++;
        }
    }

    console.log(`\n========================================`);
    console.log(`Added:   ${added}`);
    console.log(`Skipped: ${skipped}`);
    console.log(`Errors:  ${errors}`);

    if (errorDetails.length > 0) {
        console.log('\nError details:');
        for (const e of errorDetails) console.log(`  - ${e.name}: ${e.error}`);
    }

    const { count: total } = await supabase.from('projects').select('id', { count: 'exact', head: true });
    const { count: paphos } = await supabase.from('projects').select('id', { count: 'exact', head: true }).eq('city', 'Paphos');
    const { count: larnaca } = await supabase.from('projects').select('id', { count: 'exact', head: true }).eq('city', 'Larnaca');
    console.log(`\nTotal projects in DB: ${total} (${paphos} Paphos + ${larnaca} Larnaca)`);
}

async function main() {
    const results = await extractAll();
    const missing = results.filter(r => !r.lat);
    if (missing.length > 0) await tryPuppeteer(missing);
    const stillMissing = results.filter(r => !r.lat);
    if (stillMissing.length > 0) applyAreaFallback(stillMissing);

    writeFileSync('./scripts/larnaca-results.json', JSON.stringify(results, null, 2));

    // Summary of GPS sources
    const sourceCounts = {};
    for (const r of results) {
        const key = r.source || 'unknown';
        sourceCounts[key] = (sourceCounts[key] || 0) + 1;
    }
    console.log('\nGPS sources:');
    for (const [k, v] of Object.entries(sourceCounts).sort((a, b) => b[1] - a[1])) {
        console.log(`  ${k.padEnd(25)} ${v}`);
    }

    await uploadAll(results);
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
