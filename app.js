// ==========================================
// 1. CONFIGURATION SUPABASE ET VARIABLES
// ==========================================
const SUPABASE_URL = 'https://qfwhzuhwldurnmhirgil.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFmd2h6dWh3bGR1cm5taGlyZ2lsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU0OTQ0MTgsImV4cCI6MjEwMTA3MDQxOH0.Lt7eU9UBVY94tIIMUNOzLeJOpWnkGkvszy_gENkUkLg';

let supabaseClient = null;
let currentTransactions = [];
let currentProfile = {};

// Fonction utilitaire pour mettre à jour du texte HTML de manière sécurisée
function setTxt(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}

// Extraction robuste de l'année et du mois
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

window.addEventListener('load', async () => {
    const loadingEl = document.getElementById('loading');
    const appEl = document.getElementById('app');

    try {
        if (window.supabase && window.supabase.createClient) {
            supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        } else {
            throw new Error("La bibliothèque Supabase n'est pas disponible.");
        }

        if (loadingEl) loadingEl.classList.add('hidden');
        if (appEl) appEl.classList.remove('hidden');
        setTxt('syncStatus', '☁️ Connecté à Supabase');

        showTab('profil');
        updateCategories();
        await chargerProfil();
        await chargerTransactions();

    } catch (err) {
        console.error('Erreur d\'initialisation :', err);
        if (loadingEl) {
            loadingEl.innerHTML = `<p style="color:red; font-weight:bold;">⚠️ Erreur de connexion : ${err.message}</p>`;
        }
    }
});

// ==========================================
// 2. NAVIGATION ET GESTION DES ONGLETS
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

    // Rafraîchissement automatique des vues à chaque changement d'onglet
    if (tabName === 'bilan') genererBilanEtCE();
    if (tabName === 'declarations') genererDeclarations();
    if (tabName === 'carpimko') calculerCarpimkoTab();
    if (tabName === 'journal') afficherJournalEtBalance();
}

// ==========================================
// 3. PROFIL INFIRMIER
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
        alert('Erreur de sauvegarde : ' + error.message);
    } else {
        alert('✅ Profil mis à jour avec succès !');
        currentProfile = profilData;
    }
}

// ==========================================
// 4. TRANSACTIONS & SÉLECTEURS D'ANNÉES
// ==========================================
async function chargerTransactions() {
    if (!supabaseClient) return;

    const { data, error } = await supabaseClient
        .from('transactions')
        .select('*')
        .order('date', { ascending: false });

    if (!error) {
        currentTransactions = data || [];
        alimenterSelecteursAnnees();
        afficherTransactions(currentTransactions);
        genererBilanEtCE();
        genererDeclarations();
        calculerCarpimkoTab();
        afficherJournalEtBalance();
    }
}

function alimenterSelecteursAnnees() {
    const annees = new Set();
    const currentYear = new Date().getFullYear().toString();
    annees.add(currentYear);

    currentTransactions.forEach(t => {
        const { year } = parseDate(t.date);
        if (year) annees.add(year);
    });

    const anneesTriees = Array.from(annees).sort().reverse();

    const selectBilan = document.getElementById('exerciceSelect');
    const selectDecl = document.getElementById('exerciceDeclSelect');
    const selectJournal = document.getElementById('exerciceJournalSelect');

    const optionsHtml = `<option value="all">Toutes les années (Cumul)</option>` + 
        anneesTriees.map(y => `<option value="${y}">Exercice ${y}</option>`).join('');

    if (selectBilan) {
        const val = selectBilan.value;
        selectBilan.innerHTML = optionsHtml;
        if (val) selectBilan.value = val;
    }

    if (selectDecl) {
        const val = selectDecl.value;
        selectDecl.innerHTML = optionsHtml;
        if (val) selectDecl.value = val;
    }

    if (selectJournal) {
        const val = selectJournal.value;
        selectJournal.innerHTML = optionsHtml;
        if (val) selectJournal.value = val;
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
                ${t.receipt_url ? `<br><a href="${t.receipt_url}" target="_blank">📎 Voir la pièce jointe</a>` : ''}
            </div>
            <div>
                <strong style="font-size: 1.1em;">${Number(t.amount || 0).toFixed(2)} €</strong>
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
        alert('Veuillez remplir la date, le montant ET le libellé.');
        return;
    }

    let receiptUrl = null;

    if (fileInput && fileInput.files.length > 0) {
        const file = fileInput.files[0];
        const fileName = `${Date.now()}_${file.name}`;

        const { data: uploadData, error: uploadError } = await supabaseClient
            .storage
            .from('justificatifs')
            .upload(fileName, file);

        if (!uploadError && uploadData) {
            const { data: publicUrlData } = supabaseClient
                .storage
                .from('justificatifs')
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
        alert('Erreur d\'enregistrement : ' + error.message);
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
// 5. BILAN ET COMPTE D'EXPLOITATION
// ==========================================
function genererBilanEtCE() {
    const selectEl = document.getElementById('exerciceSelect');
    const anneeSelect = selectEl ? selectEl.value : 'all';

    let totHonoraires = 0, totAutresRecettes = 0;
    let totCotis = 0, totMateriel = 0, totDeplacement = 0, totAssurance = 0, totAutresDepenses = 0;

    currentTransactions.forEach(t => {
        if (!t.date) return;
        const { year } = parseDate(t.date);

        if (anneeSelect !== 'all' && year !== anneeSelect) return;

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

    setTxt('ceHonoraires', totHonoraires.toFixed(2) + ' €');
    setTxt('ceAutresRecettes', totAutresRecettes.toFixed(2) + ' €');
    setTxt('ceProduits', totalProduits.toFixed(2) + ' €');

    setTxt('ceCotis', totCotis.toFixed(2) + ' €');
    setTxt('ceMateriel', totMateriel.toFixed(2) + ' €');
    setTxt('ceFraisDeplacement', totDeplacement.toFixed(2) + ' €');
    setTxt('ceAssurances', totAssurance.toFixed(2) + ' €');
    setTxt('ceAutresCharges', totAutresDepenses.toFixed(2) + ' €');
    setTxt('ceCharges', totalCharges.toFixed(2) + ' €');

    setTxt('ceResultat', resultat.toFixed(2) + ' €');

    setTxt('bilanActifTresorerie', resultat.toFixed(2) + ' €');
    setTxt('bilanTotalActif', resultat.toFixed(2) + ' €');
    setTxt('bilanPassifResultat', resultat.toFixed(2) + ' €');
    setTxt('bilanTotalPassif', resultat.toFixed(2) + ' €');
}

// ==========================================
// 6. DÉCLARATIONS TRIMESTRIELLES ET COMPARATIF
// ==========================================
/**
 * Calcule et met à jour l'ensemble du tableau URSSAF et des impôts
 * @param {boolean} saisieManuelle - Indique si l'utilisateur a tapé une valeur à la main
 */
function genererDeclarations(saisieManuelle = false) {
    const selectEl = document.getElementById('exerciceDeclSelect');
    const inputBnc = document.getElementById('inputBncUrssaf');
    const anneeSelect = selectEl ? selectEl.value : 'all';
    const estRemplacant = document.getElementById('urssafRemplacant')?.checked || false;

    let bncFinal = 0;

    if (saisieManuelle && inputBnc && inputBnc.value !== '') {
        // L'utilisateur saisit directement une valeur dans le champ
        bncFinal = parseFloat(inputBnc.value) || 0;
    } else {
        // Sinon, on calcule automatiquement la différence Recettes - Dépenses
        let totalRecettes = 0;
        let totalDepenses = 0;

        currentTransactions.forEach(t => {
            if (!t.date) return;
            const { year } = parseDate(t.date);

            if (anneeSelect !== 'all' && year !== anneeSelect) return;

            const m = Number(t.amount || 0);
            if (t.type === 'recette') totalRecettes += m;
            else if (t.type === 'depense') totalDepenses += m;
        });

        bncFinal = Math.max(0, totalRecettes - totalDepenses);
        if (inputBnc) inputBnc.value = bncFinal > 0 ? bncFinal : '';
    }

    // Calcul détaillé via le moteur de calcul URSSAF
    const res = calculerDetailURSSAF(bncFinal, estRemplacant);

    // Mettre à jour les affichages
    setTxt('urssafBncAssiette', res.bncAssiette.toFixed(2) + ' €');

    setTxt('uBaseCsg', res.baseCsg.toFixed(2) + ' €');
    setTxt('uMontantCsg', res.mCsg.toFixed(2) + ' €');

    setTxt('uBaseMaladie', res.baseMaladie.toFixed(2) + ' €');
    setTxt('uMontantMaladie', res.mMaladie.toFixed(2) + ' €');

    setTxt('uBaseIj', res.baseIj.toFixed(2) + ' €');
    setTxt('uMontantIj', res.mIj.toFixed(2) + ' €');

    setTxt('uBaseAlloc', res.baseAlloc.toFixed(2) + ' €');
    setTxt('uTauxAlloc', (res.tauxAlloc * 100).toFixed(2) + ' %');
    setTxt('uMontantAlloc', res.mAlloc.toFixed(2) + ' €');

    setTxt('uBaseCurps', res.baseCurps.toFixed(2) + ' €');
    setTxt('uMontantCurps', res.mCurps.toFixed(2) + ' €');

    setTxt('uMontantCfp', res.mCfp.toFixed(2) + ' €');

    setTxt('uTotalAnnuel', res.totalAnnuel.toFixed(2) + ' €');

    // Échéances trimestrielles
    const trim = res.totalTrimestriel;
    setTxt('urssafT1', trim.toFixed(2) + ' €');
    setTxt('urssafT2', trim.toFixed(2) + ' €');
    setTxt('urssafT3', trim.toFixed(2) + ' €');
    setTxt('urssafT4', trim.toFixed(2) + ' €');

    // Section Fiscale (Imposition)
    let caBrut = 0;
    currentTransactions.forEach(t => {
        if (t.type === 'recette') caBrut += Number(t.amount || 0);
    });
    
    setTxt('microCA', caBrut.toFixed(2) + ' €');
    setTxt('microAbattement', (caBrut * 0.34).toFixed(2) + ' €');
    setTxt('microImposable', (caBrut * 0.66).toFixed(2) + ' €');

    setTxt('reelCA', caBrut.toFixed(2) + ' €');
    setTxt('reelDepenses', (caBrut - bncFinal).toFixed(2) + ' €');
    setTxt('reelBenefice', bncFinal.toFixed(2) + ' €');
}

function actualiserCalculsUrssaf() {
    genererDeclarations(false);
}
// ==========================================
// 7. SIMULATION & DÉCLARATION CARPIMKO
// ==========================================
function calculerCarpimkoTab() {
    const elBnc = document.getElementById('carpBnc');
    const elStatut = document.getElementById('carpStatut');
    const elConv = document.getElementById('carpConventionne');

    const bnc = elBnc ? (parseFloat(elBnc.value) || 0) : 0;
    const statut = elStatut ? elStatut.value : 'annee1';
    const conventionne = elConv ? elConv.checked : false;

    let totalBase = 0;
    let totalComp = 0;
    let totalPrev = 890; 
    let totalASV = 0;

    if (statut === 'annee1') {
        totalBase = 840;
        totalComp = 1856;
        totalASV = conventionne ? 600 : 1800;
    } else if (statut === 'annee2') {
        totalBase = 1250;
        totalComp = 1856;
        totalASV = conventionne ? 600 : 1800;
    } else {
        const PASS = 46368;
        if (bnc <= PASS) {
            totalBase = bnc * 0.0823;
        } else {
            totalBase = (PASS * 0.0823) + Math.min(bnc - PASS, PASS * 4) * 0.0187;
        }

        const partFixeComp = 1856;
        const partPropComp = bnc > 27000 ? Math.min(bnc - 27000, 150000) * 0.07 : 0;
        totalComp = partFixeComp + partPropComp;

        const asvBrut = 1950 + (bnc * 0.008);
        totalASV = conventionne ? (asvBrut * 0.33) : asvBrut;
    }

    const totalAnnuel = totalBase + totalComp + totalPrev + totalASV;
    const mensuel = totalAnnuel / 12;
    const trimestriel = totalAnnuel / 4;
    const tauxEffectif = bnc > 0 ? (totalAnnuel / bnc) * 100 : 0;

    setTxt('carpRegimeBase', totalBase.toFixed(2) + ' €');
    setTxt('carpRegimeComp', totalComp.toFixed(2) + ' €');
    setTxt('carpRegimePrev', totalPrev.toFixed(2) + ' €');
    setTxt('carpRegimeASV', totalASV.toFixed(2) + ' €');

    setTxt('carpTotal', totalAnnuel.toFixed(2) + ' €');
    setTxt('carpTableTotal', totalAnnuel.toFixed(2) + ' €');
    setTxt('carpMensuel', mensuel.toFixed(2) + ' €');
    setTxt('carpTrim', trimestriel.toFixed(2) + ' €');
    setTxt('carpTaux', tauxEffectif.toFixed(1) + ' %');
}

// ==========================================
// 8. INCORPORATION AUTOMATIQUE DES CHARGES
// ==========================================
async function incorporerChargesSociales(typeOrganisme) {
    if (!supabaseClient) {
        alert("Erreur : La connexion à Supabase n'est pas établie.");
        return;
    }

    const nouvellesOperations = [];

    if (typeOrganisme === 'URSSAF') {
        const selectEl = document.getElementById('exerciceDeclSelect');
        const annee = (selectEl && selectEl.value !== 'all') ? selectEl.value : new Date().getFullYear().toString();

        const t1 = parseFloat(document.getElementById('urssafT1')?.textContent) || 0;
        const t2 = parseFloat(document.getElementById('urssafT2')?.textContent) || 0;
        const t3 = parseFloat(document.getElementById('urssafT3')?.textContent) || 0;
        const t4 = parseFloat(document.getElementById('urssafT4')?.textContent) || 0;

        const echeances = [
            { nom: 'Trimestre 1', date: `${annee}-03-31`, montant: t1 },
            { nom: 'Trimestre 2', date: `${annee}-06-30`, montant: t2 },
            { nom: 'Trimestre 3', date: `${annee}-09-30`, montant: t3 },
            { nom: 'Trimestre 4', date: `${annee}-12-31`, montant: t4 }
        ];

        echeances.forEach(e => {
            if (e.montant > 0) {
                nouvellesOperations.push({
                    date: e.date,
                    type: 'depense',
                    category: 'cotisations',
                    description: `Cotisation URSSAF ${e.nom} ${annee}`,
                    amount: e.montant
                });
            }
        });

    } else if (typeOrganisme === 'CARPIMKO') {
        const totalAnnuel = parseFloat(document.getElementById('carpTotal')?.textContent) || 0;
        const trimestriel = totalAnnuel / 4;
        const anneeCourante = new Date().getFullYear();

        if (trimestriel > 0) {
            const echeances = [
                { nom: 'Échéance T1', date: `${anneeCourante}-02-05` },
                { nom: 'Échéance T2', date: `${anneeCourante}-05-05` },
                { nom: 'Échéance T3', date: `${anneeCourante}-08-05` },
                { nom: 'Échéance T4', date: `${anneeCourante}-11-05` }
            ];

            echeances.forEach(e => {
                nouvellesOperations.push({
                    date: e.date,
                    type: 'depense',
                    category: 'cotisations',
                    description: `Cotisation CARPIMKO ${e.nom} ${anneeCourante}`,
                    amount: Number(trimestriel.toFixed(2))
                });
            });
        }
    }

    if (nouvellesOperations.length === 0) {
        alert(`Aucun montant calculé à intégrer pour ${typeOrganisme}. Saisissez d'abord des recettes.`);
        return;
    }

    const confirmation = confirm(`Voulez-vous intégrer automatiquement ${nouvellesOperations.length} écritures de cotisations ${typeOrganisme} dans votre comptabilité ?`);
    if (!confirmation) return;

    const { error } = await supabaseClient
        .from('transactions')
        .insert(nouvellesOperations);

    if (!error) {
        alert(`✅ Les écritures ${typeOrganisme} ont été ajoutées avec succès !`);
        await chargerTransactions();
    } else {
        alert(`Erreur d'enregistrement : ${error.message}`);
    }
}

/**
 * Calcule le détail complet des cotisations URSSAF pour un auxiliaire médical (PAMC)
 * @param {number} bncRevenu - Bénéfice Non Commercial (Recettes - Dépenses)
 * @param {Object} options - Options d'exonération ou statut (ex: estRemplacant, passAnnuel)
 * @returns {Object} Détail des rubriques et total des cotisations
 */
function calculerDetailURSSAF(bncRevenu, options = {}) {
    // Valeurs de référence (PASS - Plafond Annuel de la Sécurité Sociale)
    const PASS = options.passAnnuel || 48060; 
    const estRemplacant = options.estRemplacant || false;

    // Assiette avec abattement social de 26% (plafonné)
    const abattementMax = PASS * 1.3;
    const montantAbattement = Math.min(bncRevenu * 0.26, abattementMax);
    const assietteSocialeCSG = Math.max(0, bncRevenu - montantAbattement);

    // 1. CSG / CRDS (9.70%)
    const csgCrds = assietteSocialeCSG * 0.097;

    // 2. Assurance Maladie (0.10% reste à charge infirmier conventionné)
    const maladie = bncRevenu * 0.001;

    // 3. Indemnités Journalières (0.30% avec plancher et plafond)
    const assietteMinIJ = PASS * 0.40;
    const assietteMaxIJ = PASS * 3.00;
    const assietteIJ = Math.min(Math.max(bncRevenu, assietteMinIJ), assietteMaxIJ);
    const indemnitesJournalieres = assietteIJ * 0.003;

    // 4. Allocations Familiales (Taux progressif entre 110% et 140% du PASS)
    let tauxAllocFam = 0;
    const seuilExoneration = PASS * 1.10;
    const seuilTauxPlein = PASS * 1.40;

    if (bncRevenu > seuilTauxPlein) {
        tauxAllocFam = 0.031;
    } else if (bncRevenu > seuilExoneration) {
        tauxAllocFam = 0.031 * ((bncRevenu - seuilExoneration) / (seuilTauxPlein - seuilExoneration));
    }
    const allocationsFamiliales = bncRevenu * tauxAllocFam;

    // 5. CURPS (0.10% plafonné à 0.5% du PASS)
    let curps = 0;
    if (!estRemplacant) {
        const plafondCurps = PASS * 0.005;
        curps = Math.min(bncRevenu * 0.001, plafondCurps);
    }

    // 6. Formation Professionnelle CFP (0.25% du PASS)
    const cfp = PASS * 0.0025;

    // Total général URSSAF
    const totalURSSAF = csgCrds + maladie + indemnitesJournalieres + allocationsFamiliales + curps + cfp;

    return {
        assietteCalculee: Number(bncRevenu.toFixed(2)),
        rubriques: {
            csgCrds: Number(csgCrds.toFixed(2)),
            maladie: Number(maladie.toFixed(2)),
            indemnitesJournalieres: Number(indemnitesJournalieres.toFixed(2)),
            allocationsFamiliales: Number(allocationsFamiliales.toFixed(2)),
            curps: Number(curps.toFixed(2)),
            cfp: Number(cfp.toFixed(2))
        },
        totalAnnuel: Number(totalURSSAF.toFixed(2)),
        totalTrimestriel: Number((totalURSSAF / 4).toFixed(2))
    };
}

// Exemple d'utilisation dans la console :
// const resultat = calculerDetailURSSAF(45000);
// console.log(resultat);

// ==========================================
// 9. LIVRE-JOURNAL & BALANCE COMPTABLE
// ==========================================
function genererLivreJournal(exercice = 'all') {
    const entries = [];

    currentTransactions.forEach(t => {
        if (!t.date) return;
        const { year } = parseDate(t.date);
        if (exercice !== 'all' && year !== exercice) return;

        const m = Number(t.amount || 0);

        if (t.type === 'recette') {
            entries.push({ date: t.date, compte: '512000', libelle: `[Banque] ${t.description}`, debit: m, credit: 0 });
            entries.push({ date: t.date, compte: '706000', libelle: `[Recette] ${t.description}`, debit: 0, credit: m });
        } else if (t.type === 'depense') {
            let compte = '658000';
            
            if (t.category === 'cotisations') {
                const descLower = (t.description || '').toLowerCase();
                if (descLower.includes('urssaf')) {
                    compte = '645100'; // Compte PCG Cotisations URSSAF
                } else if (descLower.includes('carpimko')) {
                    compte = '645200'; // Compte PCG Cotisations CARPIMKO
                } else {
                    compte = '645000'; // Charges Sociales Générales
                }
            } else if (t.category === 'materiel') compte = '606000';
            else if (t.category === 'deplacement') compte = '625000';
            else if (t.category === 'assurance') compte = '616000';

            entries.push({ date: t.date, compte: compte, libelle: `[Charge] ${t.description}`, debit: m, credit: 0 });
            entries.push({ date: t.date, compte: '512000', libelle: `[Banque] ${t.description}`, debit: 0, credit: m });
        }
    });

    return entries;
}

function genererBalanceComptable(exercice = 'all') {
    const journal = genererLivreJournal(exercice);
    const map = {};

    const nomsComptes = {
        '512000': 'Banque / Trésorerie',
        '606000': 'Matériel & Consommables Médicaux',
        '616000': 'Assurances Professionnelles',
        '625000': 'Frais de Déplacement',
        '645000': 'Cotisations Sociales Générales',
        '645100': 'Cotisations URSSAF',
        '645200': 'Cotisations CARPIMKO (Retraite/Prévoyance)',
        '658000': 'Autres Charges de Gestion',
        '706000': 'Honoraires & Prestations de Soins'
    };

    journal.forEach(e => {
        if (!map[e.compte]) {
            map[e.compte] = {
                compte: e.compte,
                intitule: nomsComptes[e.compte] || 'Compte Divers',
                debit: 0,
                credit: 0
            };
        }
        map[e.compte].debit += e.debit;
        map[e.compte].credit += e.credit;
    });

    return Object.values(map).map(c => {
        const solde = c.debit - c.credit;
        return {
            ...c,
            soldeDebiteur: solde > 0 ? solde : 0,
            soldeCrediteur: solde < 0 ? Math.abs(solde) : 0
        };
    });
}

function afficherJournalEtBalance() {
    const selectEl = document.getElementById('exerciceJournalSelect');
    const anneeSelect = selectEl ? selectEl.value : 'all';

    const journalData = genererLivreJournal(anneeSelect);
    const tbodyJournal = document.getElementById('tbodyJournal');

    if (tbodyJournal) {
        if (journalData.length === 0) {
            tbodyJournal.innerHTML = '<tr><td colspan="5" style="text-align:center;">Aucune écriture enregistrée.</td></tr>';
        } else {
            let totDebit = 0, totCredit = 0;
            const rows = journalData.map(e => {
                totDebit += e.debit;
                totCredit += e.credit;
                return `<tr>
                    <td>${e.date}</td>
                    <td><strong>${e.compte}</strong></td>
                    <td>${e.libelle}</td>
                    <td style="text-align:right;">${e.debit > 0 ? e.debit.toFixed(2) + ' €' : '-'}</td>
                    <td style="text-align:right;">${e.credit > 0 ? e.credit.toFixed(2) + ' €' : '-'}</td>
                </tr>`;
            }).join('');

            tbodyJournal.innerHTML = rows + `
                <tr style="font-weight:bold; background:#e9ecef;">
                    <td colspan="3">TOTAL ÉCRITURES</td>
                    <td style="text-align:right;">${totDebit.toFixed(2)} €</td>
                    <td style="text-align:right;">${totCredit.toFixed(2)} €</td>
                </tr>
            `;
        }
    }

    const balanceData = genererBalanceComptable(anneeSelect);
    const tbodyBalance = document.getElementById('tbodyBalance');

    if (tbodyBalance) {
        if (balanceData.length === 0) {
            tbodyBalance.innerHTML = '<tr><td colspan="6" style="text-align:center;">Aucune donnée disponible.</td></tr>';
        } else {
            let totD = 0, totC = 0, totSD = 0, totSC = 0;
            const rows = balanceData.map(b => {
                totD += b.debit;
                totC += b.credit;
                totSD += b.soldeDebiteur;
                totSC += b.soldeCrediteur;

                return `<tr>
                    <td><strong>${b.compte}</strong></td>
                    <td>${b.intitule}</td>
                    <td style="text-align:right;">${b.debit.toFixed(2)} €</td>
                    <td style="text-align:right;">${b.credit.toFixed(2)} €</td>
                    <td style="text-align:right; font-weight:bold; color:var(--primary-color);">${b.soldeDebiteur > 0 ? b.soldeDebiteur.toFixed(2) + ' €' : '-'}</td>
                    <td style="text-align:right; font-weight:bold; color:var(--success-color);">${b.soldeCrediteur > 0 ? b.soldeCrediteur.toFixed(2) + ' €' : '-'}</td>
                </tr>`;
            }).join('');

            tbodyBalance.innerHTML = rows + `
                <tr style="font-weight:bold; background:#e9ecef;">
                    <td colspan="2">TOTAL GENERAL</td>
                    <td style="text-align:right;">${totD.toFixed(2)} €</td>
                    <td style="text-align:right;">${totC.toFixed(2)} €</td>
                    <td style="text-align:right;">${totSD.toFixed(2)} €</td>
                    <td style="text-align:right;">${totSC.toFixed(2)} €</td>
                </tr>
            `;
        }
    }
}
