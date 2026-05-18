// Aristo via puppeteer (their pages are JS-rendered SPA)
import { extractGPSPuppeteer, closeBrowser } from './extract-gps-puppeteer.js';
import { writeFileSync } from 'fs';

const ARISTO = [
    ['Viewpoint Hills', 'Peyia', 'viewpoint-hills-villas-for-sale-peyia-cyprus'],
    ['Zephyros Village 3', 'Mandria', 'mandria-cyprus-property-paphos-zephyros-village-3'],
    ['Pelagos Beachfront Villas', 'Kato Paphos', 'beachfront-property-paphos-pelagos'],
    ['Villa Superior', 'Peyia', 'seaside-villa-superior-paphos-cyprus'],
    ['Azalea Villas', 'Paphos City Center', 'city-centre-villas-azalea-paphos-cyprus'],
    ['Aquamarine Coastal Villas', 'Kato Paphos', 'seaside-villas-aquamarine-coastal-paphos-cyprus'],
    ['Pearl Park Residences', 'Paphos City Center', 'pearl-park-residences'],
    ['Onero Residences', 'Kato Paphos', 'onero-residences-property-for-sale-kato-paphos'],
    ['Galaxy Residences', 'Paphos City Center', 'galaxy-residences'],
    ['Angelonia Gardens 2', 'Paphos City Center', 'angelonia-gardens-2'],
    ['Serenity Court', 'Paphos City Center', 'serenity-court'],
    ['Meteora Residential Development', 'Paphos City Center', 'meteora-residential-development'],
    ['Andriana Court', 'Paphos City Center', 'andriana-court'],
    ['Avora Court', 'Paphos City Center', 'avora-court'],
    ['Melania - Begonia Residences', 'Paphos City Center', 'melania-begonia-residences'],
    ['Roseland Villas 1', 'Paphos City Center', 'roseland-villas-1'],
    ['Trinity Residences', 'Paphos City Center', 'trinity-residences']
];

const results = [];
for (const [name, area, slug] of ARISTO) {
    const url = `https://www.aristodevelopers.com/developments/${slug}`;
    try {
        const r = await extractGPSPuppeteer(url);
        const c = r.lat ? r.lat.toFixed(5) + ',' + r.lng.toFixed(5) : '-';
        console.log(`  ${name.padEnd(32)} ${(r.source||'ERR').padEnd(20)} ${c}`);
        results.push({ name, area, url, ...r });
    } catch (e) {
        console.log(`  ${name.padEnd(32)} ERR: ${e.message}`);
        results.push({ name, area, url, source: 'ERR', error: e.message });
    }
}

await closeBrowser();
const found = results.filter(r => r.lat).length;
console.log(`\nFound GPS for ${found}/${results.length}`);
writeFileSync('./scripts/aristo-pup-results.json', JSON.stringify(results, null, 2));
console.log('Saved → scripts/aristo-pup-results.json');
