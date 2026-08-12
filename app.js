// ==========================================
// CONFIGURATION ET INITIALISATION SUPABASE
// ==========================================

const SUPABASE_URL = "https://qfwhzuhwldurnmhirgil.supabase.co"; 
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFmd2h6dWh3bGR1cm5taGlyZ2lsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU0OTQ0MTgsImV4cCI6MjEwMTA3MDQxOH0.Lt7eU9UBVY94tIIMUNOzLeJOpWnkGkvszy_gENkUkLg";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const BUCKET_NAME = 'documents';

// Données globales en mémoire
let allTransactions = [];
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

// ==========================================
// INITIALISATION DE L'APPLICATION
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    // 1. Initialiser la date par défaut
    const dateInput = document.getElementById('tx-date');
    if (dateInput) dateInput.valueAsDate = new Date();

    // 2. Associer les formulaires
    const txForm = document.getElementById('transaction-form');
    if (txForm) txForm.addEventListener('submit', handleAddTransaction);

    const pcForm = document.getElementById('pc-form');
    if (pcForm) pcForm.addEventListener('submit', handleAddPlanComptable);

    const profForm = document.getElementById('profil-form');
    if (profForm) profForm.addEventListener('submit', handleSaveProfil);

    // 3. Charger les données initiales
    loadTransactions();
    loadPlanComptable();
    loadProfil();
});

/**
 * Changement d'onglet
 */
function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));

    const selectedTab = document.getElementById(`tab-${tabId}`);
    if (selectedTab) selectedTab.classList.add('active');

    if (window.event && window.event.currentTarget) {
        window.event.currentTarget.classList.add('active');
    }

    // Actualisation des vues spécifiques lors du clic sur l'onglet
    if (tabId === 'bilan') renderBilan();
    if (tabId === 'declarations') render2035();
    if (tabId === 'journal') renderJournalAndBalance();
    if (tabId === 'grand-livre') renderGrandLivre();
}

// ==========================================
// GESTION DU STORAGE SUPABASE (SCANS)
// ==========================================

async function uploadFile(file) {
    if (!file) return null;
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

    const { data, error } = await supabaseClient
        .storage
        .from(BUCKET_NAME)
        .upload(fileName, file);

    if (error) {
        console.error("Erreur d'envoi du fichier :", error);
        alert("Téléversement du justificatif échoué : " + error.message);
        return null;
    }
    return data.path;
}

function getDocumentUrl(filePath) {
    if (!filePath) return null;
    const { data } = supabaseClient.storage.from(BUCKET_NAME).getPublicUrl(filePath);
    return data.publicUrl;
}

// ==========================================
// ONGLET 1 : TRANSACTIONS
// ==========================================

async function handleAddTransaction(event) {
    event.preventDefault();

    const date = document.getElementById('tx-date').value;
    const type = document.getElementById('tx-type').value;
    const category = document.getElementById('tx-category').value;
    const description = document.getElementById('tx-description').value;
    const amountVal = parseFloat(document.getElementById('tx-amount').value);
    const fileInput = document.getElementById('tx-file');

    if (!date || !type || !category || !description || isNaN(amountVal)) {
        alert("Veuillez remplir correctement les champs.");
        return;
    }

    let filePath = null;
    if (fileInput && fileInput.files.length > 0) {
        filePath = await uploadFile(fileInput.files[0]);
    }

    const newTransaction = {
        date, type, category, description, amount: amountVal, file_path: filePath
    };

    const { error } = await supabaseClient.from('transactions').insert([newTransaction]);

    if (error) {
        alert("Erreur lors de l'enregistrement : " + error.message);
    } else {
        alert("Écriture enregistrée avec succès !");
        document.getElementById('transaction-form').reset();
        document.getElementById('tx-date').valueAsDate = new Date();
        loadTransactions();
    }
}

async function loadTransactions() {
    const statusElement = document.getElementById('connection-status');

    const { data: transactions, error } = await supabaseClient
        .from('transactions')
        .select('*')
        .order('date', { ascending: false });

    if (error) {
        if (statusElement) {
            statusElement.textContent = "Erreur Connexion";
            statusElement.style.background = "#fecaca";
            statusElement.style.color = "#991b1b";
        }
        return;
    }

    if (statusElement) {
        statusElement.textContent = "Connecté à Supabase";
        statusElement.style.background = "#dcfce7";
        statusElement.style.color = "#166534";
    }

    allTransactions = transactions || [];
    renderTransactionsTable(allTransactions);
}

function renderTransactionsTable(transactions) {
    const tbody = document.getElementById('transactions-list');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (transactions.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;">Aucune transaction enregistrée.</td></tr>';
        return;
    }

    transactions.forEach(tx => {
        const tr = document.createElement('tr');
        let docHtml = '-';
        if (tx.file_path) {
            const fileUrl = getDocumentUrl(tx.file_path);
            docHtml = `<a href="${fileUrl}" target="_blank" class="btn-view-doc">📄 Voir</a>`;
        }

        const amountColor = tx.type === 'Recette' ? '#10b981' : '#ef4444';
        const formattedAmount = (tx.amount || 0).toFixed(2);

        tr.innerHTML = `
            <td>${tx.date}</td>
            <td><strong>${tx.type}</strong></td>
            <td>${tx.category}</td>
            <td>${tx.description}</td>
            <td style="color: ${amountColor}; font-weight: bold;">${formattedAmount} €</td>
            <td>${docHtml}</td>
            <td><button onclick="deleteTransaction('${tx.id}')" class="btn btn-danger">Supprimer</button></td>
        `;
        tbody.appendChild(tr);
    });
}

async function deleteTransaction(id) {
    if (!confirm("Voulez-vous supprimer cette écriture ?")) return;

    const { error } = await supabaseClient.from('transactions').delete().eq('id', id);
    if (error) {
        alert("Erreur : " + error.message);
    } else {
        loadTransactions();
    }
}

// ==========================================
// ONGLET 2 : PLAN COMPTABLE
// ==========================================

function loadPlanComptable() {
    const stored = localStorage.getItem('plan_comptable');
    if (stored) {
        defaultPlanComptable = JSON.parse(stored);
    }
    renderPlanComptable();
}

function renderPlanComptable() {
    const tbody = document.getElementById('plan-comptable-list');
    if (!tbody) return;
    tbody.innerHTML = '';

    defaultPlanComptable.forEach(acc => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${acc.code}</strong></td>
            <td>${acc.label}</td>
            <td>${acc.type}</td>
        `;
        tbody.appendChild(tr);
    });
}

function handleAddPlanComptable(e) {
    e.preventDefault();
    const code = document.getElementById('pc-code').value;
    const label = document.getElementById('pc-label').value;
    const type = document.getElementById('pc-type').value;

    defaultPlanComptable.push({ code, label, type });
    localStorage.setItem('plan_comptable', JSON.stringify(defaultPlanComptable));
    renderPlanComptable();
    document.getElementById('pc-form').reset();
    alert("Compte ajouté !");
}

// ==========================================
// ONGLET 3 : CALCULATION URSSAF
// ==========================================

function calculateUrssaf() {
    const incInput = document.getElementById('urssaf-income').value;
    const income = parseFloat(incInput) || 0;

    const maladie = income * 0.065;
    const alloc = income * 0.031;
    const csg = income * 0.097;
    const cfp = 0.0025 * income + 120;
    const total = maladie + alloc + csg + cfp;

    const tbody = document.getElementById('urssaf-results');
    tbody.innerHTML = `
        <tr><td>Assurance Maladie & Maternité</td><td>~6.5 %</td><td>${maladie.toFixed(2)} €</td></tr>
        <tr><td>Allocations Familiales</td><td>~3.1 %</td><td>${alloc.toFixed(2)} €</td></tr>
        <tr><td>CSG / CRDS (Déductible & Non déductible)</td><td>~9.7 %</td><td>${csg.toFixed(2)} €</td></tr>
        <tr><td>Formation Professionnelle (CFP)</td><td>Forfait + %</td><td>${cfp.toFixed(2)} €</td></tr>
        <tr style="font-weight: bold; background: #f1f5f9;"><td>TOTAL ESTIMÉ URSSAF</td><td>-</td><td style="color: var(--danger);">${total.toFixed(2)} €</td></tr>
    `;
}

// ==========================================
// ONGLET 4 : CALCULATION CARPIMKO
// ==========================================

function calculateCarpimko() {
    const income = parseFloat(document.getElementById('carpimko-income').value) || 0;

    const regBase = income * 0.0823;
    const regComp = 1980.00; // Forfaitaire moyen
    const asv = 1960.00;
    const inval = 780.00;
    const total = regBase + regComp + asv + inval;

    const tbody = document.getElementById('carpimko-results');
    tbody.innerHTML = `
        <tr><td>Régime de Base</td><td>8.23 % du bénéfice</td><td>${regBase.toFixed(2)} €</td></tr>
        <tr><td>Régime Complémentaire</td><td>Forfaitaire classe moyenne</td><td>${regComp.toFixed(2)} €</td></tr>
        <tr><td>ASV (Avantage Social Vieillesse)</td><td>Cotisation forfaitaire/proportionnelle</td><td>${asv.toFixed(2)} €</td></tr>
        <tr><td>Incapacité / Invalidité - Décès</td><td>Cotisation forfaitaire annuelle</td><td>${inval.toFixed(2)} €</td></tr>
        <tr style="font-weight: bold; background: #f1f5f9;"><td>TOTAL ESTIMÉ CARPIMKO</td><td>-</td><td style="color: var(--danger);">${total.toFixed(2)} €</td></tr>
    `;
}

// ==========================================
// ONGLET 5 : BILAN / COMPTE DE RÉSULTAT
// ==========================================

function renderBilan() {
    let recettes = 0;
    let depenses = 0;
    const categoriesMap = {};

    allTransactions.forEach(tx => {
        const amt = tx.amount || 0;
        if (tx.type === 'Recette') {
            recettes += amt;
        } else {
            depenses += amt;
            categoriesMap[tx.category] = (categoriesMap[tx.category] || 0) + amt;
        }
    });

    const resultat = recettes - depenses;

    document.getElementById('bilan-total-recettes').textContent = `${recettes.toFixed(2)} €`;
    document.getElementById('bilan-total-depenses').textContent = `${depenses.toFixed(2)} €`;
    
    const resElem = document.getElementById('bilan-resultat');
    resElem.textContent = `${resultat.toFixed(2)} €`;
    resElem.className = `value ${resultat >= 0 ? 'val-positive' : 'val-negative'}`;

    const tbody = document.getElementById('bilan-categories-list');
    tbody.innerHTML = '';

    for (const [cat, sum] of Object.entries(categoriesMap)) {
        const pct = depenses > 0 ? ((sum / depenses) * 100).toFixed(1) : '0.0';
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${cat}</td><td>${sum.toFixed(2)} €</td><td>${pct} %</td>`;
        tbody.appendChild(tr);
    }
}

// ==========================================
// ONGLET 6 : DÉCLARATION 2035
// ==========================================

function render2035() {
    let recettesA1 = 0;
    let depensesAchat = 0;
    let depensesUrssaf = 0;
    let depensesCarpimko = 0;
    let depensesAutres = 0;

    allTransactions.forEach(tx => {
        const amt = tx.amount || 0;
        if (tx.type === 'Recette') {
            recettesA1 += amt;
        } else {
            if (tx.category.includes('URSSAF')) depensesUrssaf += amt;
            else if (tx.category.includes('CARPIMKO')) depensesCarpimko += amt;
            else if (tx.category.includes('Achats')) depensesAchat += amt;
            else depensesAutres += amt;
        }
    });

    const totalDepenses = depensesAchat + depensesUrssaf + depensesCarpimko + depensesAutres;
    const benefice = recettesA1 - totalDepenses;

    const tbody = document.getElementById('2035-list');
    tbody.innerHTML = `
        <tr><td>Ligne 1 (AA)</td><td>Honoraires encaissés (Recettes brutes)</td><td><strong>${recettesA1.toFixed(2)} €</strong></td></tr>
        <tr><td>Ligne 9 (BU)</td><td>Achats de fournitures et produits</td><td>${depensesAchat.toFixed(2)} €</td></tr>
        <tr><td>Ligne 25 (BT)</td><td>Cotisations sociales URSSAF</td><td>${depensesUrssaf.toFixed(2)} €</td></tr>
        <tr><td>Ligne 25 (BS)</td><td>Cotisations retraite CARPIMKO</td><td>${depensesCarpimko.toFixed(2)} €</td></tr>
        <tr><td>Lignes diverses</td><td>Autres charges d'exploitation</td><td>${depensesAutres.toFixed(2)} €</td></tr>
        <tr style="background: #f1f5f9;"><td>Ligne 36 (BM)</td><td>TOTAL DES DÉPENSES DÉDUCTIBLES</td><td><strong>${totalDepenses.toFixed(2)} €</strong></td></tr>
        <tr style="background: #dcfce7; font-weight: bold;"><td>Ligne 46 (CP)</td><td>BÉNÉFICE COMPTABLE (RÉSULTAT FISCAL)</td><td style="color: #166534;">${benefice.toFixed(2)} €</td></tr>
    `;
}

// ==========================================
// ONGLET 7 : JOURNAL & BALANCE
// ==========================================

function renderJournalAndBalance() {
    const tbodyJ = document.getElementById('journal-list');
    const tbodyB = document.getElementById('balance-list');
    tbodyJ.innerHTML = '';
    tbodyB.innerHTML = '';

    const balanceMap = {};

    allTransactions.forEach(tx => {
        const amt = tx.amount || 0;
        const isRecette = tx.type === 'Recette';
        const debit = isRecette ? 0 : amt;
        const credit = isRecette ? amt : 0;
        const account = isRecette ? "706000" : "600000";

        // Ligne Journal
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${tx.date}</td>
            <td>${tx.description}</td>
            <td>${account}</td>
            <td>${debit > 0 ? debit.toFixed(2) + ' €' : '-'}</td>
            <td>${credit > 0 ? credit.toFixed(2) + ' €' : '-'}</td>
        `;
        tbodyJ.appendChild(tr);

        // Aggrégation Balance
        if (!balanceMap[account]) {
            balanceMap[account] = { debit: 0, credit: 0, label: isRecette ? 'Recettes Honoraires' : 'Dépenses Exploitation' };
        }
        balanceMap[account].debit += debit;
        balanceMap[account].credit += credit;
    });

    for (const [code, data] of Object.entries(balanceMap)) {
        const solde = data.credit - data.debit;
        const trB = document.createElement('tr');
        trB.innerHTML = `
            <td><strong>${code}</strong></td>
            <td>${data.label}</td>
            <td>${data.debit.toFixed(2)} €</td>
            <td>${data.credit.toFixed(2)} €</td>
            <td style="font-weight: bold;">${solde.toFixed(2)} €</td>
        `;
        tbodyB.appendChild(trB);
    }
}

// ==========================================
// ONGLET 8 : GRAND LIVRE
// ==========================================

function renderGrandLivre() {
    const container = document.getElementById('grand-livre-content');
    container.innerHTML = '';

    if (allTransactions.length === 0) {
        container.innerHTML = '<p>Aucune transaction disponible.</p>';
        return;
    }

    const grouped = {};
    allTransactions.forEach(tx => {
        const cat = tx.category || "Divers";
        if (!grouped[cat]) grouped[cat] = [];
        grouped[cat].push(tx);
    });

    for (const [cat, list] of Object.entries(grouped)) {
        const div = document.createElement('div');
        div.style.marginBottom = "20px";
        
        let rows = '';
        let total = 0;
        list.forEach(item => {
            total += item.amount || 0;
            rows += `<tr><td>${item.date}</td><td>${item.description}</td><td>${(item.amount || 0).toFixed(2)} €</td></tr>`;
        });

        div.innerHTML = `
            <h4 style="border-bottom: 2px solid var(--primary); padding-bottom: 5px; color: var(--primary);">${cat} (Total : ${total.toFixed(2)} €)</h4>
            <table>
                <thead><tr><th>Date</th><th>Libellé</th><th>Montant</th></tr></thead>
                <tbody>${rows}</tbody>
            </table>
        `;
        container.appendChild(div);
    }
}

// ==========================================
// ONGLET 9 : PROFIL
// ==========================================

function handleSaveProfil(e) {
    e.preventDefault();
    const profData = {
        name: document.getElementById('prof-name').value,
        job: document.getElementById('prof-job').value,
        siret: document.getElementById('prof-siret').value,
        rpps: document.getElementById('prof-rpps').value,
        regime: document.getElementById('prof-regime').value
    };
    localStorage.setItem('user_profil', JSON.stringify(profData));
    alert("Profil sauvegardé avec succès !");
}

function loadProfil() {
    const stored = localStorage.getItem('user_profil');
    if (stored) {
        const p = JSON.parse(stored);
        document.getElementById('prof-name').value = p.name || '';
        document.getElementById('prof-job').value = p.job || '';
        document.getElementById('prof-siret').value = p.siret || '';
        document.getElementById('prof-rpps').value = p.rpps || '';
        document.getElementById('prof-regime').value = p.regime || '';
    }
}
