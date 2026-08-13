// ==========================================
// CONFIGURATION ET INITIALISATION SUPABASE
// ==========================================

// 1. URL de ton projet Supabase
const SUPABASE_URL = 'https://qfwhzuhwldurnmhirgil.supabase.co';

// 2. Clé publique d'API (anon public key)
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFmd2h6dWh3bGR1cm5taGlyZ2lsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU0OTQ0MTgsImV4cCI6MjEwMTA3MDQxOH0.Lt7eU9UBVY94tIIMUNOzLeJOpWnkGkvszy_gENkUkLg';

// 3. Initialisation du client Supabase
if (typeof supabase !== 'undefined') {
    window.supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log("✅ Client Supabase initialisé avec succès.");
} else {
    console.error("❌ La bibliothèque Supabase JS n'est pas chargée. Vérifiez l'ordre des scripts dans index.html.");
}
