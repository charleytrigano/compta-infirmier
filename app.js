// ============================================================================
// 1. CONFIGURATION ET INITIALISATION SUPABASE
// ============================================================================
const SUPABASE_URL = 'https://qfwhzuhwldurnmhirgil.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFmd2h6dWh3bGR1cm5taGlyZ2lsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU0OTQ0MTgsImV4cCI6MjEwMTA3MDQxOH0.Lt7eU9UBVY94tIIMUNOzLeJOpWnkGkvszy_gENkUkLg';

let supabaseClient = null;
let currentTransactions = [];

document.addEventListener('DOMContentLoaded', async () => {
    console.log("🚀 Initialisation de l'application Compta...");

    const loadingEl = document.getElementById('loading');
    const appEl = document.getElementById('app');
    const syncStatus = document.getElementById('syncStatus');

    if (loadingEl) {
        loadingEl.style.display = 'none';
        loadingEl.classList.add('hidden');
    }
    if (appEl) {
        appEl.style.display = 'block';
        appEl.classList.remove('hidden');
    }

    try {
        if (window.supabase) {
            supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
            if (syncStatus) syncStatus.textContent = '☁️ Connecté à Supabase';
        } else {
            if (syncStatus) syncStatus.textContent = '⚠️ SDK Supabase manquant';
            return;
        }

        updateCategories();
        showTab('transactions');

        // Chargement initial des données
        await chargerProfil();
        await chargerTransactions();

    } catch (err) {
        console.error('Erreur d\'initialisation :', err);
        if (syncStatus) syncStatus.textContent = '⚠️ Erreur de chargement';
    }
});

// ============================================================================
// 2. GESTION DE LA NAVIGATION PAR ONGLETS
// ============================================================================
function showTab(tabName) {
    const allTabs = document.querySelectorAll('[id^="tab-"]');
    allTabs.forEach(tab => tab.style.display = 'none');

    const buttons = document.querySelectorAll('.tab');
    buttons.forEach(btn => btn.classList.remove('active'));

    const targetTab = document.getElementById(`tab-${tabName}`);
    if (targetTab) targetTab.style.display = 'block';

    const activeBtn = Array.from(buttons).find(btn => 
        btn.getAttribute('onclick') && btn.getAttribute('onclick').includes(tabName)
    );
    if (activeBtn) activeBtn.classList.add('active');

    actualiserTousLesCalculs();
}

// ============================================================================
// 3. TRANSACTIONS (LECTURE, AJOUT, SUPPRESSION)
// ============================================================================
async function chargerTransactions() {
    if (!supabaseClient) return;

    const container = document.getElementById('transactions');
    if (container) {
        container.innerHTML = '<p style="color:#666; padding:1rem;">⏳ Chargement des opérations...</p>';
    }

    try {
        const { data, error } = await supabaseClient
            .from('transactions')
            .select('*')
            .order('date', { ascending: false });

        if (error) {
            console.error('Erreur Supabase :', error.message);
            if (container) {
                container.innerHTML = `<p style="color:#cc0000; padding:1rem;">⚠️ Erreur : ${error.message}</p>`;
            }
            return;
        }

        currentTransactions = data || [];
        afficherTransactions(currentTransactions);
        actualiserTousLesCalculs();

    } catch (e) {
        console.error("Erreur réseau :", e);
    }
}

function afficherTransactions(liste) {
    const container = document.getElementById('transactions');
    if (!container) return;

    if (liste.length === 0) {
        container.innerHTML = '<p style="color:#666; padding:1rem;">Aucune opération enregistrée.</p>';
        return;
    }

    container.innerHTML = liste.map(t => `
        <div class="transaction ${t.type}">
            <div>
                <strong>${t.date}</strong> - <span>${t.description || 'Sans libellé'}</span><br>
                <small><strong>${parseFloat(t.amount).toFixed(2)} €</strong> (${t.type.toUpperCase()}) - <em>${t.category || ''}</em></small>
                ${t.piece_jointe_url ? `<br><a href="${t.piece_jointe_url}" target="_blank" style="font-size:0.85rem; color:#0066cc;">📄 Voir le justificatif</a>` : ''}
            </div>
            <div>
                <button class="btn btn-danger" onclick="supprimerTransaction('${t.id}')">🗑️</button>
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
        alert('Veuillez renseigner la date, le montant et le libellé.');
        return;
    }

    let pieceJointeUrl = null;

    if (fileInput && fileInput.files && fileInput.files.length > 0) {
        const file = fileInput.files[0];
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `justificatifs/${fileName}`;

        const { error: uploadError } = await supabaseClient
            .storage
            .from('documents')
            .upload(filePath, file);

        if (!uploadError) {
            const { data: urlData } = supabaseClient
                .storage
                .from('documents')
                .getPublicUrl(filePath);
            pieceJointeUrl = urlData.publicUrl;
        }
    }

    const { error } = await supabaseClient
        .from('transactions')
        .insert([{
            date,
            type,
            category,
            description,
            amount,
            piece_jointe_url: pieceJointeUrl
        }]);

    if (error) {
        alert('Erreur lors de l\'enregistrement : ' + error.message);
    } else {
        if (document.getElementById('description')) document.getElementById('description').value = '';
        if (document.getElementById('amount')) document.getElementById('amount').value = '';
        if (fileInput) fileInput.value = '';

        await chargerTransactions();
    }
}

async function supprimerTransaction(id) {
    if (!supabaseClient || !confirm('Voulez-vous supprimer cette opération ?')) return;

    const { error } = await supabaseClient.from('transactions').delete().eq('id', id);
    if (!error) {
        await chargerTransactions();
    }
}

// ============================================================================
// 4. MOTEUR DE CALCULS GLOBAUX
// ============================================================================
function actualiserTousLesCalculs() {
    genererBilanEtCE();
    genererDeclarations();
    calculerCarpimkoTab();
    afficherJournalEtBalance();
}

// A. Compte d'Exploitation et Bilan Simplifié
function genererBilanEtCE() {
    let honoraires = 0;
    let autresRecettes = 0;
    let cotisations = 0;
    let materiel = 0;
    let deplacements = 0;
    let assurances = 0;
    let autresCharges = 0;

    currentTransactions.forEach(t => {
        const val = parseFloat(t.amount) || 0;
        const cat = (t.category || '').toLowerCase();
        const type = (t.type || '').toLowerCase();

        if (type.includes('recette')) {
            if (cat.includes('honoraires') || cat.includes('pai') || cat.includes('mutuelles') || cat.includes('patients')) {
                honoraires += val;
            } else {
                autresRecettes += val;
            }
        } else if (type.includes('depense') || type.includes('dépense')) {
            if (cat.includes('cotisation') || cat.includes('urssaf') || cat.includes('carpimko')) {
                cotisations += val;
            } else if (cat.includes('matériel') || cat.includes('materiel')) {
                materiel += val;
            } else if (cat.includes('carburant') || cat.includes('déplacement') || cat.includes('deplacement')) {
                deplacements += val;
            } else if (cat.includes('assurance')) {
                assurances += val;
            } else {
                autresCharges += val;
            }
        }
    });

    const totalProduits = honoraires + autresRecettes;
    const totalCharges = cotisations + materiel + deplacements + assurances + autresCharges;
    const resultatNet = totalProduits - totalCharges;

    // Mise à jour de la table du Compte d'Exploitation (Correction appliquée ici)
    remplir('ceProduits', totalProduits);
    remplir('ceHonoraires', honoraires);
    remplir('ceAutresRecettes', autresRecettes);

    remplir('ceCharges', totalCharges);
    remplir('ceCotis', cotisations);
    remplir('ceMateriel', materiel);
    remplir('ceFraisDeplacement', deplacements);
    remplir('ceAssurances', assurances);
    remplir('ceAutresCharges', autresCharges);

    remplir('ceResultat', resultatNet);

    // Bilan Simplifié
    remplir('bilanActifTresorerie', resultatNet);
    remplir('bilanTotalActif', resultatNet);
    remplir('bilanPassifResultat', resultatNet);
    remplir('bilanTotalPassif', resultatNet);
}

// B. URSSAF & Impôts
function genererDeclarations(depuisBncInput = false) {
    let totalCA = 0;
    let totalDepenses = 0;
    let t1 = 0, t2 = 0, t3 = 0, t4 = 0;

    currentTransactions.forEach(t => {
        const val = parseFloat(t.amount) || 0;
        const type = (t.type || '').toLowerCase();

        if (type.includes('recette')) {
            totalCA += val;
            const dateObj = new Date(t.date);
            const mois = dateObj.getMonth() + 1;

            if (mois >= 1 && mois <= 3) t1 += val;
            else if (mois >= 4 && mois <= 6) t2 += val;
            else if (mois >= 7 && mois <= 9) t3 += val;
            else if (mois >= 10 && mois <= 12) t4 += val;
        } else {
            totalDepenses += val;
        }
    });

    const estRemplacant = document.getElementById('urssafRemplacant')?.checked;
    const tauXUrssaf = estRemplacant ? 0.138 : 0.145;

    remplir('declCA', totalCA);
    remplir('caT1', t1);
    remplir('caT2', t2);
    remplir('caT3', t3);
    remplir('caT4', t4);

    remplir('urssafT1', t1 * tauXUrssaf);
    remplir('urssafT2', t2 * tauXUrssaf);
    remplir('urssafT3', t3 * tauXUrssaf);
    remplir('urssafT4', t4 * tauXUrssaf);

    // CARPIMKO Estimé rapide
    const bncEstim = totalCA - totalDepenses;
    const estCarpimko = Math.max(0, bncEstim * 0.14);
    remplir('estCARPIMKO', estCarpimko);

    // Comparatif Fiscal : Micro-BNC
    const abattement = totalCA * 0.34;
    const microImposable = totalCA - abattement;
    remplir('microCA', totalCA);
    remplir('microAbattement', abattement);
    remplir('microImposable', microImposable);

    // Option B: Réel 2035
    let bncReel = totalCA - totalDepenses;
    const inputBnc = parseFloat(document.getElementById('inputBncUrssaf')?.value);
    if (depuisBncInput && !isNaN(inputBnc)) {
        bncReel = inputBnc;
    } else {
        const inputEl = document.getElementById('inputBncUrssaf');
        if (inputEl) inputEl.value = bncReel > 0 ? bncReel.toFixed(0) : 0;
    }

    remplir('reelCA', totalCA);
    remplir('reelDepenses', totalDepenses);
    remplir('reelBenefice', bncReel);
}

function actualiserCalculsUrssaf() {
    genererDeclarations();
}

// C. Simulation CARPIMKO Détaillée
function calculerCarpimkoTab() {
    const inputBnc = parseFloat(document.getElementById('carpBnc')?.value);
    let bnc = !isNaN(inputBnc) ? inputBnc : 0;

    const statut = document.getElementById('carpStatut')?.value || 'croisiere';
    const isConventionne = document.getElementById('carpConventionne')?.checked;

    let regimeBase = 0;
    let regimeComp = 0;
    let prevoyance = 824;
    let asv = 0;

    if (statut === 'annee1') {
        regimeBase = 1200;
        regimeComp = 900;
        asv = 600;
    } else if (statut === 'annee2') {
        regimeBase = 2400;
        regimeComp = 1856;
        asv = 1000;
    } else {
        const pass = 46368;
        regimeBase = Math.min(bnc, pass) * 0.0823 + Math.max(0, bnc - pass) * 0.0187;
        regimeComp = 1856 + (bnc * 0.03);
        asv = 1500 + (bnc * 0.0125);
    }

    if (isConventionne) {
        asv = asv * 0.34;
    }

    const totalCarpimko = regimeBase + regimeComp + prevoyance + asv;
    const mensuel = totalCarpimko / 12;
    const trimestriel = totalCarpimko / 4;
    const tauxEffectif = bnc > 0 ? (totalCarpimko / bnc) * 100 : 0;

    remplir('carpTotal', totalCarpimko);
    remplir('carpMensuel', mensuel);
    remplir('carpTrim', trimestriel);
    const elTaux = document.getElementById('carpTaux');
    if (elTaux) elTaux.textContent = tauxEffectif.toFixed(1) + ' %';

    remplir('carpRegimeBase', regimeBase);
    remplir('carpRegimeComp', regimeComp);
    remplir('carpRegimePrev', prevoyance);
    remplir('carpRegimeASV', asv);
    remplir('carpTableTotal', totalCarpimko);
}

// D. Livre-Journal et Balance
function afficherJournalEtBalance() {
    const tbodyJournal = document.getElementById('tbodyJournal');
    const tbodyBalance = document.getElementById('tbodyBalance');

    if (!tbodyJournal) return;

    if (currentTransactions.length === 0) {
        tbodyJournal.innerHTML = '<tr><td colspan="5" style="text-align:center;">Aucune écriture comptable enregistrée.</td></tr>';
        if (tbodyBalance) tbodyBalance.innerHTML = '<tr><td colspan="6" style="text-align:center;">Balance vide.</td></tr>';
        return;
    }

    let journalHTML = '';
    let comptesMap = {};

    currentTransactions.forEach(t => {
        const val = parseFloat(t.amount) || 0;
        const type = (t.type || '').toLowerCase();
        const cat = (t.category || '').toLowerCase();

        let comptePCG = '628000';
        let intituleCompte = 'Autres charges';

        if (type.includes('recette')) {
            comptePCG = '706000';
            intituleCompte = 'Honoraires & Soins';
        } else if (cat.includes('cotisation') || cat.includes('urssaf') || cat.includes('carpimko')) {
            comptePCG = '645000';
            intituleCompte = 'Cotisations sociales';
        } else if (cat.includes('matériel') || cat.includes('materiel')) {
            comptePCG = '606000';
            intituleCompte = 'Achats matériel & consommables';
        } else if (cat.includes('carburant') || cat.includes('déplacement') || cat.includes('deplacement')) {
            comptePCG = '625100';
            intituleCompte = 'Frais de déplacements';
        } else if (cat.includes('assurance')) {
            comptePCG = '616000';
            intituleCompte = 'Assurances professionnelles';
        }

        const debit = type.includes('recette') ? 0 : val;
        const credit = type.includes('recette') ? val : 0;

        journalHTML += `
            <tr>
                <td>${t.date}</td>
                <td><strong>${comptePCG}</strong></td>
                <td>${t.description || intituleCompte}</td>
                <td style="text-align:right;">${debit ? debit.toFixed(2) + ' €' : '-'}</td>
                <td style="text-align:right;">${credit ? credit.toFixed(2) + ' €' : '-'}</td>
            </tr>
        `;

        if (!comptesMap[comptePCG]) {
            comptesMap[comptePCG] = { intitule: intituleCompte, debit: 0, credit: 0 };
        }
        comptesMap[comptePCG].debit += debit;
        comptesMap[comptePCG].credit += credit;
    });

    tbodyJournal.innerHTML = journalHTML;

    if (tbodyBalance) {
        let balanceHTML = '';
        Object.keys(comptesMap).forEach(code => {
            const c = comptesMap[code];
            const soldeDebit = c.debit > c.credit ? c.debit - c.credit : 0;
            const soldeCredit = c.credit > c.debit ? c.credit - c.credit : 0;

            balanceHTML += `
                <tr>
                    <td><strong>${code}</strong></td>
                    <td>${c.intitule}</td>
                    <td style="text-align:right;">${c.debit.toFixed(2)} €</td>
                    <td style="text-align:right;">${c.credit.toFixed(2)} €</td>
                    <td style="text-align:right;">${soldeDebit ? soldeDebit.toFixed(2) + ' €' : '-'}</td>
                    <td style="text-align:right;">${soldeCredit ? soldeCredit.toFixed(2) + ' €' : '-'}</td>
                </tr>
            `;
        });
        tbodyBalance.innerHTML = balanceHTML;
    }
}

// ============================================================================
// 5. PROFIL PROFESSIONNEL ET UTILITAIRES
// ============================================================================
async function chargerProfil() {
    if (!supabaseClient) return;

    try {
        const { data } = await supabaseClient.from('profil').select('*').maybeSingle();

        if (data) {
            ['nom', 'prenom', 'siret', 'rpps', 'email'].forEach(f => {
                const el = document.getElementById(f);
                if (el && data[f] !== undefined) el.value = data[f];
            });
        }
    } catch (e) {
        console.warn("Profil non chargé :", e);
    }
}

async function saveProfile() {
    if (!supabaseClient) return;

    const profilData = {
        id: 1,
        nom: document.getElementById('nom')?.value || '',
        prenom: document.getElementById('prenom')?.value || '',
        siret: document.getElementById('siret')?.value || '',
        rpps: document.getElementById('rpps')?.value || '',
        email: document.getElementById('email')?.value || ''
    };

    const { error } = await supabaseClient.from('profil').upsert(profilData);

    if (error) {
        alert('Erreur de sauvegarde : ' + error.message);
    } else {
        alert('✅ Profil enregistré avec succès !');
    }
}

function updateCategories() {
    const typeSelect = document.getElementById('type');
    const catSelect = document.getElementById('category');
    if (!typeSelect || !catSelect) return;

    const type = typeSelect.value;

    if (type === 'recette') {
        catSelect.innerHTML = `
            <option value="Honoraires PAI">Honoraires PAI / Mutuelles</option>
            <option value="Honoraires Patients">Honoraires Patients</option>
            <option value="Autre recette">Autre recette</option>
        `;
    } else {
        catSelect.innerHTML = `
            <option value="Cotisations URSSAF/CARPIMKO">Cotisations URSSAF/CARPIMKO</option>
            <option value="Matériel médical">Matériel médical</option>
            <option value="Loyer professionnel">Loyer professionnel</option>
            <option value="Assurance Pro">Assurance Pro</option>
            <option value="Carburant / Déplacements">Carburant / Déplacements</option>
            <option value="Autre dépense">Autre dépense</option>
        `;
    }
}

function incorporerChargesSociales(typeOrg) {
    alert(`Les cotisations calculées pour ${typeOrg} peuvent être saisies dans vos transactions pour impacter votre bilan.`);
}

// Fonction utilitaire de mise à jour sécurisée du DOM
function remplir(id, valeur) {
    const el = document.getElementById(id);
    if (!el) return;
    const valFormatee = typeof valeur === 'number' ? valeur.toFixed(2) + ' €' : valeur;
    if (el.tagName === 'INPUT' || el.tagName === 'SELECT') {
        el.value = typeof valeur === 'number' ? valeur.toFixed(2) : valeur;
    } else {
        el.textContent = valFormatee;
    }
}
