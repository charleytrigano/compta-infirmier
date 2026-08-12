// ==========================================
// CONFIGURATION SUPABASE ET CONSTANTES GLOBALES
// ==========================================

const SUPABASE_URL = "https://qfwhzuhwldurnmhirgil.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFmd2h6dWh3bGR1cm5taGlyZ2lsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU0OTQ0MTgsImV4cCI6MjEwMTA3MDQxOH0.Lt7eU9UBVY94tIIMUNOzLeJOpWnkGkvszy_gENkUkLg";

// Nom du bucket Supabase Storage pour les pièces jointes
const BUCKET_NAME = 'documents';

// Initialisation unique du client Supabase
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Plan comptable par défaut pour la profession libérale (BNC)
let defaultPlanComptable = [
    { code: "706000", label: "Honoraires & Prestations de soins", type: "Recette" },
    { code: "606000", label: "Achats de petit matériel & fournitures", type: "Dépense" },
    { code: "613200", label: "Locations immobilières / Loyer pro", type: "Dépense" },
    { code: "625100", label: "Frais de déplacements & carburant", type: "Dépense" },
    { code: "626000", label: "Frais postaux et télécommunications", type: "Dépense" },
    { code: "645100", label: "Cotisations sociales URSSAF", type: "Dépense" },
    { code: "645200", label: "Cotisations retraite CARPIMKO", type: "Dépense" },
    { code: "622600", label: "Honoraires comptables & AGA", type: "Dépense" }
];
