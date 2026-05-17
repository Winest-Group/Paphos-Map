// Scrapes 31 Paphos-area Leptos projects in parallel.
// For each: extracts GPS (embed iframe), status, and basic info.
import { extractGPS } from './extract-gps.js';
import https from 'node:https';

const PAPHOS_LEPTOS = [
    ['Armonia Beach Villas', 'Kissonerga', 'armonia-beach-villas'],
    ['Coral Seas Villas', 'Coral Bay', 'coral-seas-villas'],
    ['Venus Gardens Resort', 'Chloraka', 'venus-gardens-resort'],
    ['Adonis Beach Villas', 'Chloraka', 'adonis-beach-villas'],
    ['Akakia Villas', 'Tala', 'akakia-villas'],
    ['Akropolis 275', 'Yeroskipou', 'akropolis-275'],
    ['Aphrodite Gardens', 'Kato Paphos', 'aphrodite-gardens'],
    ['Aphrodite Springs', 'Yeroskipou', 'aphrodite-springs'],
    ['Apollo Beach Villas', 'Chloraka', 'apollo-beach-villas'],
    ['Belvedere Villas', 'Chloraka', 'belvedere-villas'],
    ['Coral Bay Villas', 'Coral Bay', 'coral-bay-villas'],
    ['Coral Gardens', 'Coral Bay', 'coral-gardens'],
    ['Fortuna Court I', 'Paphos City Center', 'fortuna-court-i'],
    ['Iasonas Beach Villas', 'Coral Bay', 'iasonas-beach-villas'],
    ['Kamares Village', 'Tala', 'kamares-village'],
    ['Kings Court', 'Kato Paphos', 'kings-court'],
    ['Kings Gardens', 'Kato Paphos', 'king-gardens'],
    ['Limnaria Gardens', 'Kato Paphos', 'limnaria-gardens'],
    ['Mandria Gardens', 'Mandria', 'mandria-gardens'],
    ['Maniki Beach Villas', 'Peyia', 'maniki-beach-villas'],
    ['Neapolis Smart EcoCity', 'Paphos City Center', 'neapolis-smart-ecocity'],
    ['Olympus Village', 'Tsada', 'olympus-village'],
    ['Paradise Gardens', 'Kato Paphos', 'paradise-gardens'],
    ['Perneri Villas', 'Tala', 'perneri-villas'],
    ['Peyia Gardens', 'Peyia', 'peyia-gardens'],
    ['Peyia Hills Apartments', 'Peyia', 'peyia-hills-apartments'],
    ['Regina Gardens', 'Kato Paphos', 'regina-gardens'],
    ['Sea Caves Villas', 'Sea Caves', 'sea-caves-villas'],
    ['Vikla Villas', 'Tsada', 'vikla-villas'],
    ['West Park Court', 'Paphos City Center', 'west-park-court'],
    ['Zelemenos Village', 'Tala', 'zelemenos-village']
];

function fetchHtml(url) {
    return new Promise((resolve, reject) => {
        const req = https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
            if ([301, 302, 303, 307, 308].includes(res.statusCode)) {
                return fetchHtml(res.headers.location).then(resolve, reject);
            }
            let data = '';
            res.on('data', (c) => data += c);
            res.on('end', () => resolve({ status: res.statusCode, html: data }));
        });
        req.on('error', reject);
        req.setTimeout(30000, () => { req.destroy(); reject(new Error('timeout')); });
    });
}

function detectStatus(html) {
    // Look for status indicators on Leptos pages
    if (/sold\s*out|all\s*sold/i.test(html)) return 'sold_out';
    if (/coming\s*soon/i.test(html)) return 'coming_soon';
    if (/under\s*construction/i.test(html)) return 'under_construction';
    if (/for\s*sale|available\s*units|enquire\s*now/i.test(html)) return 'for_sale';
    return 'unknown';
}

async function processOne(name, area, slug) {
    const url = `https://www.leptosestates.com/project/${slug}/`;
    try {
        const { status, html } = await fetchHtml(url);
        if (status !== 200) return { name, area, url, status: 'fetch_error_' + status };
        const statusText = detectStatus(html);
        const gps = await extractGPS(url);
        return { name, area, url, status: statusText, gps_source: gps.source, lat: gps.lat, lng: gps.lng };
    } catch (e) {
        return { name, area, url, error: e.message };
    }
}

async function main() {
    const results = await Promise.all(PAPHOS_LEPTOS.map(([n, a, s]) => processOne(n, a, s)));
    const byStatus = {};
    for (const r of results) {
        byStatus[r.status || r.error] = (byStatus[r.status || r.error] || 0) + 1;
    }
    console.log('Status distribution:');
    Object.entries(byStatus).forEach(([k, v]) => console.log('  ' + k + ': ' + v));
    console.log('');
    console.log('Per-project details:');
    for (const r of results) {
        const coords = r.lat ? `${r.lat.toFixed(5)}, ${r.lng.toFixed(5)}` : '-';
        console.log(`  ${r.name.padEnd(28)} | ${(r.status || 'ERR').padEnd(18)} | ${r.area.padEnd(20)} | ${coords}`);
    }
    // Save full results for next step
    const { writeFileSync } = await import('fs');
    writeFileSync('./scripts/leptos-results.json', JSON.stringify(results, null, 2));
    console.log('\nSaved → scripts/leptos-results.json');
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
