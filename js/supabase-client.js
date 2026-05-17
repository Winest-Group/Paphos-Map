// Initialize Supabase client - exposes window.supabase
// Depends on @supabase/supabase-js loaded via CDN before this script

const { createClient } = window.supabase;

window.sb = createClient(
    window.SUPABASE_CONFIG.url,
    window.SUPABASE_CONFIG.publishableKey,
    {
        auth: {
            persistSession: true,
            autoRefreshToken: true,
            storage: window.localStorage
        }
    }
);
