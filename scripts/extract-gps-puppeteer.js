// Puppeteer-based GPS extractor for JS-rendered sites
// Handles Cloudflare bypass, iframe inspection, and dynamic Maps embeds
import puppeteer from 'puppeteer';

let browser = null;
let activeContexts = 0;

async function getBrowser() {
    if (!browser) {
        browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled']
        });
    }
    activeContexts++;
    return browser;
}

async function releaseBrowser() {
    activeContexts--;
    if (activeContexts === 0 && browser) {
        await browser.close();
        browser = null;
    }
}

export async function extractGPSPuppeteer(url, options = {}) {
    const { waitForSelector, timeout = 25000 } = options;
    await getBrowser();
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1280, height: 800 });

    try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout });
        // Give the page some time for JS to render maps
        await new Promise(r => setTimeout(r, 3000));
        if (waitForSelector) {
            try { await page.waitForSelector(waitForSelector, { timeout: 5000 }); } catch {}
        }

        const result = await page.evaluate(() => {
            // 1. Look for any iframe with Google Maps embed
            for (const iframe of document.querySelectorAll('iframe')) {
                const src = iframe.src || iframe.getAttribute('src') || iframe.dataset.src || '';
                if (src.includes('google.com/maps') || src.includes('maps.google')) {
                    const dec = src.match(/!2d(-?[0-9.]+)!3d(-?[0-9.]+)/);
                    if (dec) return { source: 'iframe_embed', lat: +dec[2], lng: +dec[1] };
                    const at = src.match(/@(-?3[0-9]\.[0-9]+),(-?3[0-9]\.[0-9]+)/);
                    if (at) return { source: 'iframe_at', lat: +at[1], lng: +at[2] };
                    const q = src.match(/[?&]q=(-?3[0-9]\.[0-9]+)[,%]+\s*(-?3[0-9]\.[0-9]+)/);
                    if (q) return { source: 'iframe_q', lat: +q[1], lng: +q[2] };
                }
            }
            // 2. Anchor tag to Google Maps
            for (const a of document.querySelectorAll('a[href*="google.com/maps"], a[href*="maps.app.goo.gl"]')) {
                const href = a.href;
                const at = href.match(/@(-?3[0-9]\.[0-9]+),(-?3[0-9]\.[0-9]+)/);
                if (at) return { source: 'anchor_at', lat: +at[1], lng: +at[2], href };
                const q = href.match(/[?&]q=(-?3[0-9]\.[0-9]+),\+?(-?3[0-9]\.[0-9]+)/);
                if (q) return { source: 'anchor_q', lat: +q[1], lng: +q[2], href };
                if (href.includes('maps.app.goo.gl')) return { source: 'anchor_short', href };
            }
            // 3. data-lat / data-lng attributes
            const dataLat = document.querySelector('[data-lat],[data-latitude]');
            const dataLng = document.querySelector('[data-lng],[data-longitude]');
            if (dataLat && dataLng) {
                const lat = +(dataLat.dataset.lat || dataLat.dataset.latitude);
                const lng = +(dataLng.dataset.lng || dataLng.dataset.longitude);
                if (!isNaN(lat) && !isNaN(lng)) return { source: 'data_attr', lat, lng };
            }
            // 4. window-level globals or Leaflet maps
            if (window.L && window.L.Map) {
                // Look for Leaflet maps in DOM
                for (const el of document.querySelectorAll('.leaflet-container')) {
                    const id = el.id;
                    // Maps have a _leaflet_id; cannot access from outside easily
                }
            }
            // 5. Schema.org PlaceMark / GeoCoordinates
            const ldjson = Array.from(document.querySelectorAll('script[type="application/ld+json"]'))
                .map(s => { try { return JSON.parse(s.textContent); } catch { return null; } })
                .filter(Boolean).flat();
            for (const obj of ldjson) {
                const stack = [obj];
                while (stack.length) {
                    const node = stack.shift();
                    if (node && typeof node === 'object') {
                        if (node['@type'] === 'GeoCoordinates' && node.latitude && node.longitude) {
                            return { source: 'jsonld_geo', lat: +node.latitude, lng: +node.longitude };
                        }
                        for (const v of Object.values(node)) {
                            if (v && typeof v === 'object') stack.push(v);
                        }
                    }
                }
            }
            return { source: 'NOT_FOUND', lat: null, lng: null };
        });

        // If anchor pointed to short URL, follow it
        if (result.source === 'anchor_short' && result.href) {
            const fullPage = await browser.newPage();
            try {
                await fullPage.goto(result.href, { waitUntil: 'domcontentloaded', timeout: 15000 });
                const finalUrl = fullPage.url();
                const dec = finalUrl.match(/!3d(-?[0-9.]+)!4d(-?[0-9.]+)/);
                if (dec) {
                    await fullPage.close();
                    return { source: 'pup_goo_gl_dec', lat: +dec[1], lng: +dec[2] };
                }
                const at = finalUrl.match(/@(-?3[0-9]\.[0-9]+),(-?3[0-9]\.[0-9]+)/);
                if (at) {
                    await fullPage.close();
                    return { source: 'pup_goo_gl_at', lat: +at[1], lng: +at[2] };
                }
                const search = finalUrl.match(/maps\/search\/(-?3[0-9]\.[0-9]+),\+?(-?3[0-9]\.[0-9]+)/);
                if (search) {
                    await fullPage.close();
                    return { source: 'pup_goo_gl_search', lat: +search[1], lng: +search[2] };
                }
            } finally { await fullPage.close().catch(()=>{}); }
        }

        return result;
    } finally {
        await page.close().catch(()=>{});
        await releaseBrowser();
    }
}

export async function closeBrowser() {
    if (browser) { await browser.close(); browser = null; activeContexts = 0; }
}
