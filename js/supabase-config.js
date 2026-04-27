// =====================================================
// supabase-config.js — Supabase client initialization
// =====================================================
// ARAHAN: Ganti SUPABASE_URL dan SUPABASE_ANON_KEY
// dengan nilai dari projek Supabase anda.
// Dapatkan di: Supabase Dashboard → Settings → API
// =====================================================

const SUPABASE_URL  = 'https://ddwdwbhcnonbhmlipuvm.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_REOH4QcENBCviLSQJg3Tdg_N98y5CG7';

window.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
