// Scrapes 17 Paphos-area Aristo projects for GPS coords.
import { extractGPS } from './extract-gps.js';

const ARISTO_PAPHOS = [
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

async function process(name, area, slug) {
    const url = `https://www.aristodevelopers.com/developments/${slug}`;
    try {
        const r = await extractGPS(url);
        return { name, area, url, ...r };
    } catch (e) {
        return { name, area, url, error: e.message };
    }
}

const results = await Promise.all(ARISTO_PAPHOS.map(([n, a, s]) => process(n, a, s)));
const found = results.filter(r => r.lat && r.lng).length;
console.log(`Found GPS for ${found}/${results.length} Aristo Paphos projects.\n`);
for (const r of results) {
    const coords = r.lat ? `${r.lat.toFixed(5)}, ${r.lng.toFixed(5)}` : '-';
    console.log(`  ${r.name.padEnd(32)} | ${(r.source || 'ERR').padEnd(18)} | ${r.area.padEnd(20)} | ${coords}`);
}

// Save
const { writeFileSync } = await import('fs');
writeFileSync('./scripts/aristo-results.json', JSON.stringify(results, null, 2));
console.log('\nSaved → scripts/aristo-results.json');
