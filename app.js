// ==========================================
// 1. CONFIGURATION SUPABASE
// ==========================================
const SUPABASE_URL = 'https://qfwhzuhwldurnmhirgil.supabase.co';

// ⚠️ REMPLACEZ CETTE VALEUR PAR VOTRE CLÉ "anon public" RÉCUPÉRÉE DANS SUPABASE (Settings > API)
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFmd2h6dWh3bGR1cm5taGlyZ2lsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU0OTQ0MTgsImV4cCI6MjEwMTA3MDQxOH0.Lt7eU9UBVY94tIIMUNOzLeJOpWnkGkvszy_gENkUkLg';

let supabaseClient = null;
let currentTransactions = [];

document.addEventListener('DOMContentLoaded', async () => {
    try {
        if (window.supabase) {
            supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        } else {
            afficherErreur('La bibliothèque Supabase est introuvable.');
            return;
        }

        const loadingEl = document.getElementById('loading');
        const appEl = document.getElementById('app');
        if (loadingEl) loadingEl.classList.add('hidden');
        if (appEl) appEl.classList.remove('hidden');

        const syncStatus = document.getElementById('syncStatus');
        if (syncStatus) syncStatus.textContent = '☁️ Connecté à Supabase';

        // Vue par défaut
        showTab('profil');
        updateCategories();

        // Chargement initial des données
        await chargerProfil();
        await chargerTransactions();

    } catch (err) {
        console.error('Erreur au démarrage :', err);
        afficherErreur('Erreur lors de la connexion à la base de données.');
    }
});

// ==========================================
// 2. NAVIGATION ENTRE ONGLETS
// ==========================================
function showTab(tabName) {
    const allTabs = document.querySelectorAll('[id^="tab-"]');
    allTabs.forEach(tab => tab.style.display = 'none');

    const buttons = document.querySelectorAll('.tab');
    buttons.forEach(btn => btn.classList.remove('active'));

    const target = document.getElementById(`tab-${tabName}`);
    if (target) target.style.display = 'block';

    const activeBtn = Array.from(buttons).find(btn => 
        btn.getAttribute('onclick') && btn.getAttribute('onclick').includes(tabName)
    );
    if (activeBtn) activeBtn.classList.add('active');
}

function afficherErreur(message) {
    const container = document.getElementById('transactions');
    if (container) {
        container.innerHTML = `<div style="color: #dc3545; background: #fdf7f7; padding: 15px; border-radius: 6px; border: 1px solid #dc3545;">
            <strong>Erreur :</strong> ${message}
        </div>`;
    }
}

// ==========================================
// 3. GESTION DU PROFIL
// ==========================================
async function chargerProfil() {
    if (!supabaseClient) return;

    const { data, error } = await supabaseClient
        .from('profile')
        .select('*')
        .maybeSingle();

    if (error) {
        console.warn('Erreur lors du chargement du profil :', error.message);
        return;
    }

    if (data) {
        const fields = ['nom', 'prenom', 'siret', 'rpps', 'telephone', 'email'];
        fields.forEach(field => {
            const el = document.getElementById(field);
            if (el && data[field] !== undefined && data[field] !== null) {
                el.value = data[field];
            }
        });
    }
}

async function saveProfile() {
    if (!supabaseClient) return;

    const profilData = {
        nom: document.getElementById('nom')?.value || '',
        prenom: document.getElementById('prenom')?.value || '',
        siret: document.getElementById('siret')?.value || null,
        rpps: document.getElementById('rpps')?.value || null,
        telephone: document.getElementById('telephone')?.value || '',
        email: document.getElementById('email')?.value || ''
    };

    const { error } = await supabaseClient
        .from('profile')
        .upsert(profilData);

    if (error) {
        alert('Erreur enregistrement profil : ' + error.message);
    } else {
        alert('✅ Profil enregistré avec succès !');
    }
}

// ==========================================
// 4. GESTION DES TRANSACTIONS
// ==========================================
async function chargerTransactions() {
    if (!supabaseClient) return;

    const { data, error } = await supabaseClient
        .from('transactions')
        .select('*')
        .order('date', { ascending: false });

    if (error) {
        afficherErreur(error.message);
        return;
    }

    currentTransactions = data || [];
    afficherTransactions(currentTransactions);
    calculerStatistiques(currentTransactions);
}

function afficherTransactions(liste) {
    const container = document.getElementById('transactions');
    if (!container) return;

    if (liste.length === 0) {
        container.innerHTML = '<p style="color:#666;">Aucune opération enregistrée.</p>';
        return;
    }

    container.innerHTML = liste.map(t => `
        <div class="transaction ${t.type}">
            <div>
                <strong>${t.date}</strong> - <span>${t.description || 'Sans libellé'}</span><br>
                <small><em>${t.category || ''}</em></small>
            </div>
            <div>
                <strong style="font-size: 1.1em;">${Number(t.amount).toFixed(2)} €</strong>
                <button class="btn btn-danger" style="padding: 4px 8px; margin-left: 10px;" onclick="supprimerTransaction('${t.id}')">🗑️</button>
            </div>
        </div>
    `).join('');
}

async function addTransaction() {
    if (!supabaseClient) return;

    const date = document.getElementById('date')?.value;
    const type = document.getElementById('type')?.value;
    const category = document.getElementById('category')?.value;
    const description = document.getElementById('description')?.value;
    const amount = parseFloat(document.getElementById('amount')?.value);

    if (!date || isNaN(amount)) {
        alert('Veuillez saisir au moins une date et un montant valide.');
        return;
    }

    const nouvelleOperation = {
        date,
        type,
        category,
        description,
        amount
    };

    const { error } = await supabaseClient
        .from('transactions')
        .insert([nouvelleOperation]);

    if (error) {
        alert('Erreur lors de l\'ajout : ' + error.message);
    } else {
        document.getElementById('description').value = '';
        document.getElementById('amount').value = '';
        await chargerTransactions();
    }
}

async function supprimerTransaction(id) {
    if (!supabaseClient || !confirm('Voulez-vous supprimer cette opération ?')) return;

    const { error } = await supabaseClient
        .from('transactions')
        .delete()
        .eq('id', id);

    if (!error) await chargerTransactions();
}

function calculerStatistiques(liste) {
    let recettes = 0;
    let depenses = 0;

    liste.forEach(t => {
        const val = Number(t.amount || 0);
        if (t.type === 'recette') recettes += val;
        if (t.type === 'depense') depenses += val;
    });

    if (document.getElementById('statRecettes')) document.getElementById('statRecettes').textContent = recettes.toFixed(2) + ' €';
    if (document.getElementById('statDepenses')) document.getElementById('statDepenses').textContent = depenses.toFixed(2) + ' €';
}

function updateCategories() {
    const type = document.getElementById('type')?.value;
    const catSelect = document.getElementById('category');
    if (!catSelect) return;

    if (type === 'recette') {
        catSelect.innerHTML = `
            <option>Honoraires Soins / PAI</option>
            <option>Honoraires Mutuelles</option>
            <option>Honoraires Patients Directs</option>
            <option>Autre recette</option>
        `;
    } else {
        catSelect.innerHTML = `
            <option>Cotisations URSSAF</option>
            <option>Matériel / Consommables</option>
            <option>Frais de déplacement / Carburant</option>
            <option>Assurance Pro</option>
            <option>Autre dépense</option>
        `;
    }
}

// ==========================================
// 5. SIMULATEUR DE CHARGES MICRO-ENTREPRISE
// ==========================================
function changerModeImpot() {
    const mode = document.getElementById('modeImpot')?.value;
    const groupLiberatoire = document.getElementById('groupLiberatoire');
    const groupAbattement = document.getElementById('groupAbattement');
    const groupParts = document.getElementById('groupParts');
    const groupBaremeTable = document.getElementById('groupBaremeTable');

    if (mode === 'liberatoire') {
        if (groupLiberatoire) groupLiberatoire.style.display = 'block';
        if (groupAbattement) groupAbattement.style.display = 'none';
        if (groupParts) groupParts.style.display = 'none';
        if (groupBaremeTable) groupBaremeTable.style.display = 'none';
    } else {
        if (groupLiberatoire) groupLiberatoire.style.display = 'none';
        if (groupAbattement) groupAbattement.style.display = 'block';
        if (groupParts) groupParts.style.display = 'block';
        if (groupBaremeTable) groupBaremeTable.style.display = 'block';
    }
}

function calculerSimulationMicro() {
    const ca = parseFloat(document.getElementById('simuRecettes')?.value || 0);
    const depenses = parseFloat(document.getElementById('simuDepenses')?.value || 0);

    if (ca <= 0) {
        document.getElementById('resCotisations').textContent = '0.00 €';
        document.getElementById('resImpot').textContent = '0.00 €';
        document.getElementById('resTotalPrélèvements').textContent = '0.00 €';
        document.getElementById('resRevenuNet').textContent = '0.00 €';
        return;
    }

    // 1. Calcul Cotisations Sociales + Formation Professionnelle
    const tauxSocial = parseFloat(document.getElementById('tauxSocial')?.value || 0) / 100;
    const tauxCFP = parseFloat(document.getElementById('tauxCFP')?.value || 0) / 100;
    const cotisationsSociales = ca * (tauxSocial + tauxCFP);

    // 2. Calcul Impôt sur le Revenu
    const mode = document.getElementById('modeImpot')?.value || 'bareme';
    let impotRevenu = 0;

    if (mode === 'liberatoire') {
        const tauxLib = parseFloat(document.getElementById('tauxLiberatoire')?.value || 0) / 100;
        impotRevenu = ca * tauxLib;
    } else {
        const abattementPct = parseFloat(document.getElementById('tauxAbattement')?.value || 0) / 100;
        const montantAbattement = Math.max(305, ca * abattementPct);
        const revenuImposableFoyer = Math.max(0, ca - montantAbattement);

        const parts = parseFloat(document.getElementById('nbParts')?.value || 1);
        const quotientFamilial = revenuImposableFoyer / parts;

        const t1_max = parseFloat(document.getElementById('t1_max')?.value || 11294);
        const t2_max = parseFloat(document.getElementById('t2_max')?.value || 28797);
        const t3_max = parseFloat(document.getElementById('t3_max')?.value || 82341);
        const t4_max = parseFloat(document.getElementById('t4_max')?.value || 177106);

        const r1 = parseFloat(document.getElementById('t1_rate')?.value || 0) / 100;
        const r2 = parseFloat(document.getElementById('t2_rate')?.value || 11) / 100;
        const r3 = parseFloat(document.getElementById('t3_rate')?.value || 30) / 100;
        const r4 = parseFloat(document.getElementById('t4_rate')?.value || 41) / 100;
        const r5 = parseFloat(document.getElementById('t5_rate')?.value || 45) / 100;

        let impotParPart = 0;

        if (quotientFamilial > 0) {
            const assiette1 = Math.min(quotientFamilial, t1_max);
            impotParPart += assiette1 * r1;

            if (quotientFamilial > t1_max) {
                const assiette2 = Math.min(quotientFamilial, t2_max) - t1_max;
                impotParPart += assiette2 * r2;
            }
            if (quotientFamilial > t2_max) {
                const assiette3 = Math.min(quotientFamilial, t3_max) - t2_max;
                impotParPart += assiette3 * r3;
            }
            if (quotientFamilial > t3_max) {
                const assiette4 = Math.min(quotientFamilial, t4_max) - t3_max;
                impotParPart += assiette4 * r4;
            }
            if (quotientFamilial > t4_max) {
                const assiette5 = quotientFamilial - t4_max;
                impotParPart += assiette5 * r5;
            }
        }

        impotRevenu = impotParPart * parts;
    }

    // 3. Synthèse des calculs
    const totalPrélèvements = cotisationsSociales + impotRevenu;
    const revenuNetFinal = ca - cotisationsSociales - impotRevenu - depenses;

    document.getElementById('resCotisations').textContent = cotisationsSociales.toFixed(2) + ' €';
    document.getElementById('resImpot').textContent = impotRevenu.toFixed(2) + ' €';
    document.getElementById('resTotalPrélèvements').textContent = totalPrélèvements.toFixed(2) + ' €';
    document.getElementById('resRevenuNet').textContent = revenuNetFinal.toFixed(2) + ' €';
}

function importerDonneesReelles() {
    let totalRecettes = 0;
    let totalDepenses = 0;

    currentTransactions.forEach(t => {
        const amount = Number(t.amount || 0);
        if (t.type === 'recette') totalRecettes += amount;
        if (t.type === 'depense') totalDepenses += amount;
    });

    const inputRecettes = document.getElementById('simuRecettes');
    const inputDepenses = document.getElementById('simuDepenses');

    if (inputRecettes) inputRecettes.value = totalRecettes.toFixed(2);
    if (inputDepenses) inputDepenses.value = totalDepenses.toFixed(2);

    calculerSimulationMicro();
}
