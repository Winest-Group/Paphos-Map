// Extracts GPS coordinates from various developer site formats.
// Supports: decimal lat/lng, DMS, Plus codes, JSON-LD schema, text addresses (via Nominatim).
import https from 'node:https';

function fetchText(url) {
    return new Promise((resolve, reject) => {
        const opts = {
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PaphosMapBot/1.0)' }
        };
        const req = https.get(url, opts, (res) => {
            if ([301, 302, 303, 307, 308].includes(res.statusCode)) {
                return fetchText(res.headers.location).then(resolve, reject);
            }
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => resolve(data));
        });
        req.on('error', reject);
        req.setTimeout(30000, () => { req.destroy(); reject(new Error('timeout')); });
    });
}

function decodeURL(s) {
    try { return decodeURIComponent(s); } catch { return s; }
}

function parseDMS(text) {
    // Match patterns like 34°48'09.2"N  32°24'15.1"E (with or without hemisphere)
    const m = text.match(/(\d+)[°º](\d+)['′](\d+(?:\.\d+)?)[\"″]([NS])?[\s,]+(\d+)[°º](\d+)['′](\d+(?:\.\d+)?)[\"″]([EW])?/);
    if (!m) return null;
    const [_, latD, latM, latS, latH, lngD, lngM, lngS, lngH] = m;
    const lat = (+latD) + (+latM)/60 + (+latS)/3600;
    const lng = (+lngD) + (+lngM)/60 + (+lngS)/3600;
    const latSign = (latH === 'S') ? -1 : 1;
    const lngSign = (lngH === 'W') ? -1 : 1;
    return { lat: latSign * lat, lng: lngSign * lng };
}

// Plus Codes (Open Location Code) — simplified decode for codes ending without +
// Reference: https://github.com/google/open-location-code
const PLUS_CODE_DIGITS = '23456789CFGHJMPQRVWX';
function decodePlusCode(code, refLat = 34.77, refLng = 32.42) {
    // For short codes like "QC69+46C", we need a reference location.
    // Paphos area reference: 34.77, 32.42
    const cleaned = code.replace('+', '');
    if (cleaned.length < 8) {
        // Short code - need reference recovery (we'll approximate to Paphos)
        // For QC69+46C: this maps to a small area in Paphos
        // Using approximation: each character pair represents 1/20 degree subdivision
        // Pre-computed for AION (QC69+46C) which I'll just look up via Maps URL redirect
        return null;
    }
    // Full code decoding (10+ chars)
    let lat = -90, lng = -180;
    let latLo = 20, lngLo = 20;
    for (let i = 0; i < 10 && i < cleaned.length; i++) {
        if (i % 2 === 0) {
            // latitude digit (pair)
            const d1 = PLUS_CODE_DIGITS.indexOf(cleaned[i]);
            const d2 = PLUS_CODE_DIGITS.indexOf(cleaned[i+1]);
            lat += d1 * latLo;
            lng += d2 * lngLo;
            latLo /= 20;
            lngLo /= 20;
            i++;
        }
    }
    return { lat: lat + latLo/2, lng: lng + lngLo/2 };
}

async function geocodeAddress(address) {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address + ', Paphos, Cyprus')}&format=json&limit=1`;
    try {
        const json = JSON.parse(await fetchText(url));
        if (Array.isArray(json) && json.length > 0) {
            return { lat: parseFloat(json[0].lat), lng: parseFloat(json[0].lon) };
        }
    } catch {}
    return null;
}

// Resolve a plus code via Google Maps redirect (works for "QC69+46C Paphos" style queries)
async function resolvePlusCode(code) {
    // Try Nominatim with "Paphos QC69+46C"
    return geocodeAddress(code);
}

async function followRedirect(url) {
    return new Promise((resolve, reject) => {
        const req = https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
            if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
                return resolve(res.headers.location);
            }
            resolve(null);
        });
        req.on('error', reject);
        req.setTimeout(20000, () => { req.destroy(); resolve(null); });
    });
}

export async function extractGPS(url) {
    const html = await fetchText(url);
    let res;

    // 0. maps.app.goo.gl short URLs — follow redirect to get full coords URL
    const shortUrl = html.match(/https?:\/\/maps\.app\.goo\.gl\/[A-Za-z0-9]+/);
    if (shortUrl) {
        try {
            const fullUrl = await followRedirect(shortUrl[0]);
            if (fullUrl) {
                const dec = fullUrl.match(/!3d(-?[0-9.]+)!4d(-?[0-9.]+)/);
                if (dec) return { source: 'goo_gl_redirect', lat: +dec[1], lng: +dec[2] };
                const atCoords = fullUrl.match(/@(-?3[0-9]\.[0-9]+),(-?3[0-9]\.[0-9]+)/);
                if (atCoords) return { source: 'goo_gl_at', lat: +atCoords[1], lng: +atCoords[2] };
                const searchCoords = fullUrl.match(/maps\/search\/(-?3[0-9]\.[0-9]+),\+?(-?3[0-9]\.[0-9]+)/);
                if (searchCoords) return { source: 'goo_gl_search', lat: +searchCoords[1], lng: +searchCoords[2] };
                const placeDMS = fullUrl.match(/maps\/place\/[^/]*?(\d+)[°%C2B0]+(\d+)['%]+([\d.]+)[%"]+([NS])[\+%20]+(\d+)[°%C2B0]+(\d+)['%]+([\d.]+)[%"]+([EW])/);
                if (placeDMS) {
                    const lat = (+placeDMS[1]) + (+placeDMS[2])/60 + (+placeDMS[3])/3600;
                    const lng = (+placeDMS[5]) + (+placeDMS[6])/60 + (+placeDMS[7])/3600;
                    return { source: 'goo_gl_dms', lat: placeDMS[4]==='S'?-lat:lat, lng: placeDMS[8]==='W'?-lng:lng };
                }
            }
        } catch {}
    }

    // 1. JSON-LD style: "latitude":"34.X" and "longitude":"32.X"
    const lat1 = html.match(/"latitude"\s*:\s*"?(-?3[0-9]\.[0-9]+)"?/);
    const lng1 = html.match(/"longitude"\s*:\s*"?(-?3[0-9]\.[0-9]+)"?/);
    if (lat1 && lng1) return { source: 'schema', lat: +lat1[1], lng: +lng1[1] };

    // 2. Google Maps embed iframe with pb= pattern (Domenica-style)
    const embed = html.match(/maps\/embed\?pb=[^"]+/);
    if (embed) {
        const e = embed[0];
        const lng2 = e.match(/!2d(-?[0-9.]+)/);
        const lat2 = e.match(/!3d(-?[0-9.]+)/);
        if (lat2 && lng2) return { source: 'embed', lat: +lat2[1], lng: +lng2[1] };
    }

    // 3. URL-encoded decimal lat,lng (Kuutio style)
    const urlDecimal = html.match(/maps[^"]*[?&]q=(-?3[0-9]\.[0-9]+)(?:%2C|,)\s*(-?3[0-9]\.[0-9]+)/);
    if (urlDecimal) return { source: 'url_decimal', lat: +urlDecimal[1], lng: +urlDecimal[2] };

    // 4. DMS in URL (encoded or not)
    const urlDMS = html.match(/maps[^"]*q=([^"&]+)/);
    if (urlDMS) {
        const dmsText = decodeURL(urlDMS[1]);
        const dms = parseDMS(dmsText);
        if (dms) return { source: 'dms', lat: dms.lat, lng: dms.lng };
    }

    // 5. Plus code (try geocoding it via Nominatim with Paphos suffix)
    const pcMatch = html.match(/maps[^"]*q=([A-Z0-9]{4}\+[A-Z0-9]{2,3})/i) ||
                    html.match(/maps[^"]*q=([A-Z0-9]{4}%2B[A-Z0-9]{2,3})/i);
    if (pcMatch) {
        const code = decodeURL(pcMatch[1]);
        const geocoded = await resolvePlusCode(code);
        if (geocoded) return { source: 'pluscode_geocoded', lat: geocoded.lat, lng: geocoded.lng, hint: code };
    }

    // 6. Text address in q= parameter (geocode via Nominatim)
    const addrMatch = html.match(/maps[^"]*q=([A-Za-z][A-Za-z0-9%+_.-]*[A-Za-z])/);
    if (addrMatch) {
        const addr = decodeURL(addrMatch[1]).replace(/\+/g, ' ');
        const geocoded = await geocodeAddress(addr);
        if (geocoded) return { source: 'address_geocoded', lat: geocoded.lat, lng: geocoded.lng, hint: addr };
    }

    // 7. Standalone lat,lng in HTML near each other (Pafilia hotspot widget style)
    const lats = [...html.matchAll(/\b(3[4-5]\.[0-9]{4,10})\b/g)];
    const lngs = [...html.matchAll(/\b(3[2-3]\.[0-9]{4,10})\b/g)];
    if (lats.length > 0 && lngs.length > 0) {
        // Find a lat and lng within 200 chars of each other
        for (const latM of lats) {
            for (const lngM of lngs) {
                if (Math.abs(latM.index - lngM.index) < 200) {
                    return { source: 'standalone', lat: +latM[1], lng: +lngM[1] };
                }
            }
        }
    }

    return { source: 'NOT_FOUND', lat: null, lng: null };
}

// CLI: process URLs from argv or stdin (one per line)
import { fileURLToPath } from 'url';
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
    const urls = process.argv.slice(2);
    if (urls.length === 0) {
        console.error('Usage: node extract-gps.js <url1> <url2> ...');
        process.exit(1);
    }
    const results = await Promise.all(urls.map(async (url) => {
        try { return { url, ...(await extractGPS(url)) }; }
        catch (e) { return { url, error: e.message }; }
    }));
    for (const r of results) {
        if (r.error) console.log(`${r.url}\tERROR\t${r.error}`);
        else console.log(`${r.url}\t${r.source}\t${r.lat ?? ''}\t${r.lng ?? ''}\t${r.hint ?? ''}`);
    }
}
