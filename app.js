// ==========================================
// 1. CONFIGURATION SUPABASE
// ==========================================
const SUPABASE_URL = 'https://qfwhzuhwldurnmhirgil.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFmd2h6dWh3bGR1cm5taGlyZ2lsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU0OTQ0MTgsImV4cCI6MjEwMTA3MDQxOH0.Lt7eU9UBVY94tIIMUNOzLeJOpWnkGkvszy_gENkUkLg'; // Colle ta clé anon ici

let supabaseClient = null;
let currentTransactions = [];
let currentProfile = {};

document.addEventListener('DOMContentLoaded', async () => {
    try {
        if (window.supabase) {
            supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        } else {
            afficherErreur('Bibliothèque Supabase manquante.');
            return;
        }

        document.getElementById('loading')?.classList.add('hidden');
        document.getElementById('app')?.classList.remove('hidden');
        document.getElementById('syncStatus').textContent = '☁️ Connecté à Supabase';

        showTab('profil');
        updateCategories();
        await chargerProfil();
        await chargerTransactions();

    } catch (err) {
        console.error('Erreur initialisation :', err);
    }
});

// ==========================================
// 2. NAVIGATION ET UTILITAIRES
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

    if (tabName === 'bilan') genererEtatsComptables();
}

function afficherErreur(msg) {
    alert(msg);
}

// ==========================================
// 3. PROFIL ET REGIME FISCAL
// ==========================================
async function chargerProfil() {
    if (!supabaseClient) return;

    const { data } = await supabaseClient.from('profile').select('*').maybeSingle();
    if (data) {
        currentProfile = data;
        ['nom', 'prenom', 'siret', 'rpps', 'email', 'regimeFiscal'].forEach(field => {
            const el = document.getElementById(field);
            if (el && data[field]) el.value = data[field];
        });
    }
}

async function saveProfile() {
    if (!supabaseClient) return;

    const profilData = {
        nom: document.getElementById('nom')?.value || '',
        prenom: document.getElementById('prenom')?.value || '',
        siret: document.getElementById('siret')?.value || '',
        rpps: document.getElementById('rpps')?.value || '',
        email: document.getElementById('email')?.value || '',
        regimeFiscal: document.getElementById('regimeFiscal')?.value || 'micro'
    };

    const { error } = await supabaseClient.from('profile').upsert(profilData);
    if (error) {
        alert('Erreur enregistrement : ' + error.message);
    } else {
        alert('✅ Profil et Régime enregistrés !');
        currentProfile = profilData;
    }
}

// ==========================================
// 4. TRANSACTIONS ET JUSTIFICATIFS (SCANS)
// ==========================================
async function chargerTransactions() {
    if (!supabaseClient) return;

    const { data, error } = await supabaseClient
        .from('transactions')
        .select('*')
        .order('date', { ascending: false });

    if (!error) {
        currentTransactions = data || [];
        afficherTransactions(currentTransactions);
        calculerStatistiques(currentTransactions);
    }
}

function afficherTransactions(liste) {
    const container = document.getElementById('transactions');
    if (!container) return;

    if (liste.length === 0) {
        container.innerHTML = '<p style="color:#666;">Aucune transaction enregistrée.</p>';
        return;
    }

    container.innerHTML = liste.map(t => `
        <div class="transaction ${t.type}">
            <div>
                <strong>${t.date}</strong> - <span>${t.description || 'Sans libellé'}</span><br>
                <small><em>${t.category || ''}</em></small>
                ${t.receipt_url ? `<br><a href="${t.receipt_url}" target="_blank">📎 Voir le justificatif</a>` : ''}
            </div>
            <div>
                <strong style="font-size: 1.1em;">${Number(t.amount).toFixed(2)} €</strong>
                <button class="btn btn-danger" style="padding:4px 8px; margin-left:10px;" onclick="supprimerTransaction('${t.id}')">🗑️</button>
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
    const fileInput = document.getElementById('attachment');

    if (!date || isNaN(amount) || !description) {
        alert('Veuillez renseigner au minimum la date, le montant ET le libellé.');
        return;
    }

    let receiptUrl = null;

    // Gestion de l'envoi du fichier/scan sur Supabase Storage
    if (fileInput && fileInput.files.length > 0) {
        const file = fileInput.files[0];
        const fileName = `${Date.now()}_${file.name}`;

        const { data: uploadData, error: uploadError } = await supabaseClient
            .storage
            .from('attachments')
            .upload(fileName, file);

        if (!uploadError && uploadData) {
            const { data: publicUrlData } = supabaseClient
                .storage
                .from('attachments')
                .getPublicUrl(fileName);

            receiptUrl = publicUrlData.publicUrl;
        }
    }

    const nouvelleOp = {
        date,
        type,
        category,
        description,
        amount,
        receipt_url: receiptUrl
    };

    const { error } = await supabaseClient.from('transactions').insert([nouvelleOp]);

    if (!error) {
        document.getElementById('description').value = '';
        document.getElementById('amount').value = '';
        if (fileInput) fileInput.value = '';
        await chargerTransactions();
    } else {
        alert('Erreur lors de l\'enregistrement : ' + error.message);
    }
}

async function supprimerTransaction(id) {
    if (!confirm('Supprimer cette ligne ?')) return;
    await supabaseClient.from('transactions').delete().eq('id', id);
    await chargerTransactions();
}

function calculerStatistiques(liste) {
    let recettes = 0, depenses = 0;
    liste.forEach(t => {
        const m = Number(t.amount || 0);
        if (t.type === 'recette') recettes += m;
        if (t.type === 'depense') depenses += m;
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
            <option>Cotisations Sociale / URSSAF</option>
            <option>Matériel / Consommables</option>
            <option>Frais de Déplacement / Carburant</option>
            <option>Assurance Pro</option>
            <option>Autre dépense</option>
        `;
    }
}

// ==========================================
// 5. SIMULATEUR DE CHARGES
// ==========================================
function calculerSimulation() {
    const ca = parseFloat(document.getElementById('simuRecettes')?.value || 0);
    const depenses = parseFloat(document.getElementById('simuDepenses')?.value || 0);

    const isMicro = (currentProfile.regimeFiscal || 'micro') === 'micro';
    let cotis = 0, impot = 0;

    if (isMicro) {
        cotis = ca * 0.214; // ~21.4% Micro BNC
        impot = ca * 0.022; // ~2.2% Versement libératoire
    } else {
        const benefice = Math.max(0, ca - depenses);
        cotis = benefice * 0.40; // ~40% BNC réel
        impot = benefice * 0.11;
    }

    document.getElementById('resCotisations').textContent = cotis.toFixed(2) + ' €';
    document.getElementById('resImpot').textContent = impot.toFixed(2) + ' €';
    document.getElementById('resRevenuNet').textContent = (ca - cotisations - impot - depenses).toFixed(2) + ' €';
}

function importerDonneesReelles() {
    let rec = 0, dep = 0;
    currentTransactions.forEach(t => {
        const a = Number(t.amount || 0);
        if (t.type === 'recette') rec += a;
        if (t.type === 'depense') dep += a;
    });

    document.getElementById('simuRecettes').value = rec.toFixed(2);
    document.getElementById('simuDepenses').value = dep.toFixed(2);
    calculerSimulation();
}

// ==========================================
// 6. ETATS COMPTABLES & JOURNAUX
// ==========================================
function genererEtatsComptables() {
    let rec = 0, dep = 0;

    let htmlJournal = `<table><thead><tr><th>Date</th><th>Type</th><th>Catégorie</th><th>Libellé</th><th>Montant (€)</th><th>Justificatif</th></tr></thead><tbody>`;

    currentTransactions.forEach(t => {
        const m = Number(t.amount || 0);
        if (t.type === 'recette') rec += m;
        if (t.type === 'depense') dep += m;

        htmlJournal += `<tr>
            <td>${t.date}</td>
            <td>${t.type.toUpperCase()}</td>
            <td>${t.category || ''}</td>
            <td>${t.description || ''}</td>
            <td>${m.toFixed(2)} €</td>
            <td>${t.receipt_url ? `<a href="${t.receipt_url}" target="_blank">Oui</a>` : 'Non'}</td>
        </tr>`;
    });

    htmlJournal += `</tbody></table>`;

    document.getElementById('compteCA').textContent = rec.toFixed(2) + ' €';
    document.getElementById('compteDepenses').textContent = dep.toFixed(2) + ' €';
    document.getElementById('compteResultat').textContent = (rec - dep).toFixed(2) + ' €';

    document.getElementById('journalTableContainer').innerHTML = htmlJournal;

    // Fiche déclarative
    const regime = currentProfile.regimeFiscal === 'reel' ? 'Déclaration Contrôlée (2035 / Réel)' : 'Micro-Entreprise (Micro-BNC)';
    document.getElementById('ficheRegime').textContent = regime;

    if (currentProfile.regimeFiscal === 'reel') {
        document.getElementById('ficheDetails').innerHTML = `
            <ul>
                <li><strong>Base à déclarer sur la 2035 :</strong> Recettes Brutes: <strong>${rec.toFixed(2)} €</strong> | Dépenses: <strong>${dep.toFixed(2)} €</strong></li>
                <li><strong>Bénéfice Imposable (BNC) :</strong> <strong>${(rec - dep).toFixed(2)} €</strong></li>
            </ul>
        `;
    } else {
        document.getElementById('ficheDetails').innerHTML = `
            <ul>
                <li><strong>Chiffre d'affaires à déclarer à l'URSSAF :</strong> <strong>${rec.toFixed(2)} €</strong></li>
                <li><strong>Abattement forfaitaire BNC (34%) :</strong> <strong>${(rec * 0.34).toFixed(2)} €</strong></li>
                <li><strong>Revenu Net imposable estimé :</strong> <strong>${(rec * 0.66).toFixed(2)} €</strong></li>
            </ul>
        `;
    }
}

function imprimerJournal() {
    window.print();
}
