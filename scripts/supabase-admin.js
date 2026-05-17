// Supabase admin client — uses service_role key from .env (bypasses RLS)
// IMPORTANT: never logs or echoes the key
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, '..', '.env');

config({ path: envPath });

function loadCredentials() {
    let url = process.env.SUPABASE_URL;
    let key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    // Reject placeholder
    if (key && key.startsWith('PASTE_')) key = null;

    // Fallback: if key missing or placeholder, look for a standalone sb_secret_ or eyJ line
    if (!key && existsSync(envPath)) {
        const content = readFileSync(envPath, 'utf8');
        for (const line of content.split('\n')) {
            const trimmed = line.trim();
            if (trimmed.startsWith('sb_secret_') || trimmed.startsWith('eyJ')) {
                key = trimmed;
                break;
            }
        }
    }

    if (!url) {
        throw new Error('SUPABASE_URL is missing from .env');
    }
    if (!key) {
        throw new Error('Service role key is missing from .env (looked for SUPABASE_SERVICE_ROLE_KEY= or a standalone sb_secret_ line)');
    }
    return { url, key };
}

const { url, key } = loadCredentials();

export const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false }
});

export const SUPABASE_URL = url;
