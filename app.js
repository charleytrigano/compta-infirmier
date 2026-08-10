// ==========================================
// 1. CONFIGURATION SUPABASE ET VARIABLES
// ==========================================
const SUPABASE_URL = 'https://qfwhzuhwldurnmhirgil.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFmd2h6dWh3bGR1cm5taGlyZ2lsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU0OTQ0MTgsImV4cCI6MjEwMTA3MDQxOH0.Lt7eU9UBVY94tIIMUNOzLeJOpWnkGkvszy_gENkUkLg';

let supabaseClient = null;
let currentTransactions = [];
let currentProfile = {};

document.addEventListener('DOMContentLoaded', async () => {
    try {
        if (window.supabase) {
            supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        } else {
            alert('Erreur : Bibliothèque Supabase non chargée.');
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
// 2. NAVIGATION ET INTERFACE
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

    if (tabName === 'bilan') genererBilanEtCE();
    if (tabName === 'declarations') genererDeclarations();
}

// ==========================================
// 3. PROFIL
// ==========================================
async function chargerProfil() {
    if (!supabaseClient) return;

    const { data } = await supabaseClient.from('profile').select('*').maybeSingle();
    if (data) {
        currentProfile = data;
        ['nom', 'prenom', 'siret', 'rpps', 'email'].forEach(field => {
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
        email: document.getElementById('email')?.value || ''
    };

    const { error } = await supabaseClient.from('profile').upsert(profilData);
    if (error) {
        alert('Erreur lors de l\'enregistrement : ' + error.message);
    } else {
        alert('✅ Profil mis à jour avec succès !');
        currentProfile = profilData;
    }
}

// ==========================================
// 4. TRANSACTIONS & ENVOI AU BUCKET "justificatifs"
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
        genererBilanEtCE();
        genererDeclarations();
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
                ${t.receipt_url ? `<br><a href="${t.receipt_url}" target="_blank">📎 Voir le scan / justificatif</a>` : ''}
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
        alert('Veuillez saisir la date, le montant ET le libellé.');
        return;
    }

    let receiptUrl = null;

    // Envoi du fichier dans le bucket "justificatifs"
    if (fileInput && fileInput.files.length > 0) {
        const file = fileInput.files[0];
        const fileName = `${Date.now()}_${file.name}`;

        const { data: uploadData, error: uploadError } = await supabaseClient
            .storage
            .from('justificatifs') // Utilisation directe du dossier "justificatifs"
            .upload(fileName, file);

        if (!uploadError && uploadData) {
            const { data: publicUrlData } = supabaseClient
                .storage
                .from('justificatifs')
                .getPublicUrl(fileName);

            receiptUrl = publicUrlData.publicUrl;
        } else if (uploadError) {
            console.error('Erreur Storage :', uploadError);
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
    if (!confirm('Voulez-vous supprimer cette opération ?')) return;
    await supabaseClient.from('transactions').delete().eq('id', id);
    await chargerTransactions();
}

function updateCategories() {
    const type = document.getElementById('type')?.value;
    const catSelect = document.getElementById('category');
    if (!catSelect) return;

    if (type === 'recette') {
        catSelect.innerHTML = `
            <option value="honoraires">Honoraires Soins / PAI / Mutuelles</option>
            <option value="autre_recette">Autre recette</option>
        `;
    } else {
        catSelect.innerHTML = `
            <option value="cotisations">Cotisations Sociale / URSSAF / CARPIMKO</option>
            <option value="materiel">Matériel / Consommables Médicaux</option>
            <option value="deplacement">Frais de Déplacement / Carburant</option>
            <option value="assurance">Assurance Pro / RCP</option>
            <option value="autre_depense">Autre dépense</option>
        `;
    }
}

// ==========================================
// 5. BILAN ET COMPTE D'EXPLOITATION PAR EXERCICE
// ==========================================
function genererBilanEtCE() {
    const anneeSelect = document.getElementById('exerciceSelect')?.value || '2026';

    let totHonoraires = 0, totAutresRecettes = 0;
    let totCotis = 0, totMateriel = 0, totDeplacement = 0, totAssurance = 0, totAutresDepenses = 0;

    currentTransactions.forEach(t => {
        if (!t.date) return;
        const anneeTransac = t.date.substring(0, 4);

        if (anneeSelect !== 'all' && anneeTransac !== anneeSelect) return;

        const m = Number(t.amount || 0);
        if (t.type === 'recette') {
            if (t.category === 'honoraires') totHonoraires += m;
            else totAutresRecettes += m;
        } else if (t.type === 'depense') {
            if (t.category === 'cotisations') totCotis += m;
            else if (t.category === 'materiel') totMateriel += m;
            else if (t.category === 'deplacement') totDeplacement += m;
            else if (t.category === 'assurance') totAssurance += m;
            else totAutresDepenses += m;
        }
    });

    const totalProduits = totHonoraires + totAutresRecettes;
    const totalCharges = totCotis + totMateriel + totDeplacement + totAssurance + totAutresDepenses;
    const resultat = totalProduits - totalCharges;

    document.getElementById('ceHonoraires').textContent = totHonoraires.toFixed(2) + ' €';
    document.getElementById('ceAutresRecettes').textContent = totAutresRecettes.toFixed(2) + ' €';
    document.getElementById('ceProduits').textContent = totalProduits.toFixed(2) + ' €';

    document.getElementById('ceCotis').textContent = totCotis.toFixed(2) + ' €';
    document.getElementById('ceMateriel').textContent = totMateriel.toFixed(2) + ' €';
    document.getElementById('ceFraisDeplacement').textContent = totDeplacement.toFixed(2) + ' €';
    document.getElementById('ceAssurances').textContent = totAssurance.toFixed(2) + ' €';
    document.getElementById('ceAutresCharges').textContent = totAutresDepenses.toFixed(2) + ' €';
    document.getElementById('ceCharges').textContent = totalCharges.toFixed(2) + ' €';

    document.getElementById('ceResultat').textContent = resultat.toFixed(2) + ' €';

    document.getElementById('bilanActifTresorerie').textContent = resultat.toFixed(2) + ' €';
    document.getElementById('bilanTotalActif').textContent = resultat.toFixed(2) + ' €';
    document.getElementById('bilanPassifResultat').textContent = resultat.toFixed(2) + ' €';
    document.getElementById('bilanTotalPassif').textContent = resultat.toFixed(2) + ' €';
}

// ==========================================
// 6. DÉCLARATIONS TRIMESTRIELLES ET COMPARATIF
// ==========================================
function genererDeclarations() {
    const anneeSelect = document.getElementById('exerciceDeclSelect')?.value || '2026';

    let caT1 = 0, caT2 = 0, caT3 = 0, caT4 = 0;
    let totalRecettes = 0;
    let totalDepenses = 0;

    currentTransactions.forEach(t => {
        if (!t.date) return;
        const annee = t.date.substring(0, 4);
        if (annee !== anneeSelect) return;

        const mois = parseInt(t.date.substring(5, 7), 10);
        const m = Number(t.amount || 0);

        if (t.type === 'recette') {
            totalRecettes += m;
            if (mois >= 1 && mois <= 3) caT1 += m;
            else if (mois >= 4 && mois <= 6) caT2 += m;
            else if (mois >= 7 && mois <= 9) caT3 += m;
            else if (mois >= 10 && mois <= 12) caT4 += m;
        } else if (t.type === 'depense') {
            totalDepenses += m;
        }
    });

    document.getElementById('declCA').textContent = totalRecettes.toFixed(2) + ' €';

    // URSSAF Trimestriel (~14.5%)
    document.getElementById('caT1').textContent = caT1.toFixed(2) + ' €';
    document.getElementById('urssafT1').textContent = (caT1 * 0.145).toFixed(2) + ' €';

    document.getElementById('caT2').textContent = caT2.toFixed(2) + ' €';
    document.getElementById('urssafT2').textContent = (caT2 * 0.145).toFixed(2) + ' €';

    document.getElementById('caT3').textContent = caT3.toFixed(2) + ' €';
    document.getElementById('urssafT3').textContent = (caT3 * 0.145).toFixed(2) + ' €';

    document.getElementById('caT4').textContent = caT4.toFixed(2) + ' €';
    document.getElementById('urssafT4').textContent = (caT4 * 0.145).toFixed(2) + ' €';

    // CARPIMKO Estimé (~8.8%)
    document.getElementById('estCARPIMKO').textContent = (totalRecettes * 0.088).toFixed(2) + ' €';

    // OPTION A : MICRO-BNC
    document.getElementById('microCA').textContent = totalRecettes.toFixed(2) + ' €';
    document.getElementById('microAbattement').textContent = (totalRecettes * 0.34).toFixed(2) + ' €';
    document.getElementById('microImposable').textContent = (totalRecettes * 0.66).toFixed(2) + ' €';

    // OPTION B : RÉEL / 2035
    document.getElementById('reelCA').textContent = totalRecettes.toFixed(2) + ' €';
    document.getElementById('reelDepenses').textContent = totalDepenses.toFixed(2) + ' €';
    document.getElementById('reelBenefice').textContent = Math.max(0, totalRecettes - totalDepenses).toFixed(2) + ' €';
}
