// ==========================================
// CONFIGURATION SUPABASE ET CONSTANTES GLOBALES
// ==========================================

const SUPABASE_URL = "https://qfwhzuhwldurnmhirgil.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFmd2h6dWh3bGR1cm5taGlyZ2lsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3M00QxO0.Lt7eU9UBVY94tIIMUNOzLeJOpWn"; // Ta clé anon

// Nom du bucket Supabase Storage pour les pièces jointes
window.BUCKET_NAME = 'documents';

// Initialisation unique et globale du client Supabase
if (typeof supabase !== 'undefined') {
    window.supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    console.log("✅ Client Supabase initialisé avec succès.");
} else {
    console.error("❌ Erreur : La librairie Supabase JS n'est pas chargée dans index.html avant config.js !");
}

// Plan comptable par défaut pour la profession libérale (BNC)
window.defaultPlanComptable = [
    { code: "706000", label: "Honoraires & Prestations de soins", type: "Recette" },
    { code: "606000", label: "Achats de petit matériel & fournitures", type: "Dépense" },
    { code: "613200", label: "Locations immobilières / Loyer pro", type: "Dépense" },
    { code: "625100", label: "Frais de déplacements & carburant", type: "Dépense" },
    { code: "626000", label: "Frais postaux et télécommunications", type: "Dépense" },
    { code: "645100", label: "Cotisations sociales URSSAF", type: "Dépense" },
    { code: "645200", label: "Cotisations retraite CARPIMKO", type: "Dépense" },
    { code: "622600", label: "Honoraires comptables & AGA", type: "Dépense" }
];
