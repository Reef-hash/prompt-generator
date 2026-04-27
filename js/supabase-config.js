// =====================================================
// supabase-config.js — Supabase client initialization
// =====================================================
// ARAHAN: Ganti SUPABASE_URL dan SUPABASE_ANON_KEY
// dengan nilai dari projek Supabase anda.
// Dapatkan di: Supabase Dashboard → Settings → API
// =====================================================

const SUPABASE_URL  = 'https://YOUR_PROJECT_ID.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY_HERE';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
