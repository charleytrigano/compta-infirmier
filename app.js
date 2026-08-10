// ==========================================
// 1. CONFIGURATION SUPABASE ET VARIABLES
// ==========================================
const SUPABASE_URL = 'https://qfwhzuhwldurnmhirgil.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFmd2h6dWh3bGR1cm5taGlyZ2lsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU0OTQ0MTgsImV4cCI6MjEwMTA3MDQxOH0.Lt7eU9UBVY94tIIMUNOzLeJOpWnkGkvszy_gENkUkLg';

let supabaseClient = null;
let currentTransactions = [];
let currentProfile = {};

// Helper sécurisé pour écrire du texte dans le DOM sans erreur JS
function setTxt(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}

// Helper pour extraire l'année et le mois
function parseDate(dateStr) {
    if (!dateStr) return { year: null, month: null };
    if (dateStr.includes('-')) {
        const parts = dateStr.split('-');
        if (parts.length >= 2) return { year: parts[0], month: parseInt(parts[1], 10) };
    } else if (dateStr.includes('/')) {
        const parts = dateStr.split('/');
        if (parts.length >= 3) return { year: parts[2].substring(0, 4), month: parseInt(parts[1], 10) };
    }
    return { year: null, month: null };
}

// Initialisation au chargement de la page
window.addEventListener('load', async () => {
    const loadingEl = document.getElementById('loading');
    const appEl = document.getElementById('app');

    try {
        if (window.supabase && window.supabase.createClient) {
            supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        } else {
            throw new Error("La bibliothèque Supabase n'a pas pu être chargée.");
        }

        if (loadingEl) loadingEl.classList.add('hidden');
        if (appEl) appEl.classList.remove('hidden');
        setTxt('syncStatus', '☁️ Connecté à Supabase');

        showTab('profil');
        updateCategories();
        await chargerProfil();
        await chargerTransactions();

    } catch (err) {
        console.error('Erreur initialisation :', err);
        if (loadingEl) {
            loadingEl.innerHTML = `<p style="color:red; font-weight:bold;">⚠️ Erreur lors du chargement : ${err.message}</p>
            <p>Veuillez rafraîchir la page (F5) ou vérifier votre connexion internet.</p>`;
        }
    }
});
