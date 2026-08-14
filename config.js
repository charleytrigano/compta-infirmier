// ==========================================
// CONFIGURATION ET INITIALISATION SUPABASE
// ==========================================

// 1. URL de ton projet Supabase
const SUPABASE_URL = 'https://qfwhzuhwldurnmhirgil.supabase.co';

// 2. Clé publique d'API (anon public key)
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFmd2h6dWh3bGR1cm5taGlyZ2lsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU0OTQ0MTgsImV4cCI6MjEwMTA3MDQxOH0.Lt7eU9UBVY94tIIMUNOzLeJOpWnkGkvszy_gENkUkLg';

// 3. Initialisation sécurisée du client Supabase
window.supabaseClient = null;

try {
    if (typeof supabase !== 'undefined' && supabase.createClient) {
        window.supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log("✅ Client Supabase initialisé avec succès.");

        // Mise à jour de l'indicateur visuel au chargement du DOM
        const majStatusConnecte = () => {
            const badge = document.getElementById('status-supabase');
            if (badge) {
                badge.textContent = 'Connecté à Supabase';
                badge.style.backgroundColor = '#dcfce7';
                badge.style.color = '#15803d';
            }
        };

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', majStatusConnecte);
        } else {
            majStatusConnecte();
        }
    } else {
        console.warn("⚠️ La bibliothèque Supabase JS n'a pas pu être chargée. Activation du mode local.");
        
        const majStatusHorsLigne = () => {
            const badge = document.getElementById('status-supabase');
            if (badge) {
                badge.textContent = 'Mode Hors-ligne (CDN non disponible)';
                badge.style.backgroundColor = '#fef3c7';
                badge.style.color = '#92400e';
            }
        };

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', majStatusHorsLigne);
        } else {
            majStatusHorsLigne();
        }
    }
} catch (error) {
    console.error("❌ Erreur lors de l'initialisation de Supabase :", error);
}
