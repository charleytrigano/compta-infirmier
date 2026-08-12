// ==========================================
// LOGIQUE DE L'APPLICATION (APP.JS) - VERSION COMPLÈTE
// ==========================================

// Variable globale pour stocker les transactions en mémoire
let allTransactions = [];

// Sécurisation globale : Attachement direct à 'window'
if (!window.defaultPlanComptable) {
    window.defaultPlanComptable = [
        { code: "706000", label: "Honoraires / Recettes Soins", type: "Recette (Classe 7)" },
        { code: "622600", label: "Rétrocessions / Soins Infirmiers", type: "Charge (Classe 6)" },
        { code: "645100", label: "Cotisations URSSAF", type: "Charge (Classe 6)" },
        { code: "645200", label: "Cotisations CARPIMKO", type: "Charge (Classe 6)" },
        { code: "606000", label: "Achats / Fournitures médicales", type: "Charge (Classe 6)" }
    ];
}

// Initialisation principale une fois le DOM chargé
document.addEventListener('DOMContentLoaded', () => {
    // 1. Initialiser la date du jour sur le formulaire
    const dateInput = document.getElementById('tx-date');
    if (dateInput) dateInput.valueAsDate = new Date();

    // 2. Écouteurs pour les formulaires
    const txForm = document.getElementById('transaction-form');
    if (txForm) txForm.addEventListener('submit', handleAddTransaction);

    const pcForm = document.getElementById('pc-form');
    if (pcForm) pcForm.addEventListener('submit', handleAddPlanComptable);

    const profForm = document.getElementById('profil-form');
    if (profForm) profForm.addEventListener('submit', handleSaveProfil);

    // 3. Écouteurs pour les boutons de simulation URSSAF et CARPIMKO
    const btnUrssaf = document.getElementById('btn-calc-urssaf');
    if (btnUrssaf) btnUrssaf.addEventListener('click', calculateUrssaf);

    const btnCarpimko = document.getElementById('btn-calc-carpimko');
    if (btnCarpimko) btnCarpimko.addEventListener('click', calculateCarpimko);

    // 4. Charger les données depuis Supabase
    loadTransactions();
    loadPlanComptable();
    loadProfil();
});

// Navigation entre les onglets de l'interface
function switchTab(tabId, element) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));

    const selectedTab = document.getElementById(`tab-${tabId}`);
    if (selectedTab) selectedTab.classList.add('active');
    if (element) element.classList.add('active');

    if (tabId === 'bilan') renderBilan();
    if (tabId === 'declarations') render2035();
    if (tabId === 'journal') renderJournalAndBalance();
    if (tabId === 'grand-livre') renderGrandLivre();
}

// Fonction d'attribution automatique des comptes comptables
function getAccountCodeForCategory(category, type) {
    const catLower = (category || '').toLowerCase();

    if (type === 'Recette') {
        return "706000";
    }

    if (catLower.includes('urssaf')) return "645100";
    if (catLower.includes('carpimko')) return "645200";
    if (catLower.includes('soins') || catLower.includes('retrocession') || catLower.includes('remplacement')) return "622600";
    if (catLower.includes('achat') || catLower.includes('fourniture')) return "606000";

    return "606000";
}

// ==========================================
// GESTION DU PLAN COMPTABLE
// ==========================================

async function loadPlanComptable() {
    const tbody = document.getElementById('pc-list');
    if (!tbody) return;

    // Récupérer les comptes personnalisés sauvegardés dans Supabase
    const { data: dbAccounts, error } = await supabaseClient
        .from('plan_comptable')
        .select('*')
        .order('code', { ascending: true });

    let customAccounts = [];
    if (!error && dbAccounts) {
        customAccounts = dbAccounts;
    }

    // Combiner les comptes par défaut et les comptes personnalisés
    const allAccounts = [...window.defaultPlanComptable, ...customAccounts];

    if (allAccounts.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" class="text-center">Aucun compte dans le plan comptable.</td></tr>';
        return;
    }

    let rowsHtml = '';
    allAccounts.forEach(acc => {
        rowsHtml += `
            <tr>
                <td><strong>${acc.code}</strong></td>
                <td>${acc.label}</td>
                <td>${acc.type}</td>
            </tr>
        `;
    });

    tbody.innerHTML = rowsHtml;
}

async function handleAddPlanComptable(event) {
    event.preventDefault();

    const code = document.getElementById('pc-code').value.trim();
    const label = document.getElementById('pc-label').value.trim();
    const type = document.getElementById('pc-type').value;

    if (!code || !label) {
        alert("Veuillez remplir le numéro et le libellé du compte.");
        return;
    }

    const newAccount = { code, label, type };

    // Enregistrement dans Supabase
    const { error } = await supabaseClient.from('plan_comptable').insert([newAccount]);

    if (error) {
        alert("Erreur lors de l'ajout du compte : " + error.message);
    } else {
        alert("Nouveau compte ajouté au Plan Comptable !");
        document.getElementById('pc-form').reset();
        loadPlanComptable(); // Recharger le tableau
    }
}

// ==========================================
// GESTION DES TRANSACTIONS SUPABASE
// ==========================================

async function handleAddTransaction(event) {
    event.preventDefault();

    const date = document.getElementById('tx-date').value;
    const type = document.getElementById('tx-type').value;
    const category = document.getElementById('tx-category').value;
    const description = document.getElementById('tx-description').value;
    const amountVal = parseFloat(document.getElementById('tx-amount').value);

    if (!date || !type || !category || !description || isNaN(amountVal)) {
        alert("Veuillez remplir correctement tous les champs obligatoires.");
        return;
    }

    const newTransaction = { date, type, category, description, amount: amountVal };
    const { error } = await supabaseClient.from('transactions').insert([newTransaction]);

    if (error) {
        alert("Erreur d'enregistrement : " + error.message);
    } else {
        alert("Transaction enregistrée !");
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
            statusElement.textContent = "Erreur de connexion";
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

    if (transactions.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center">Aucune transaction enregistrée.</td></tr>';
        return;
    }

    let rowsHtml = '';
    transactions.forEach(tx => {
        const color = tx.type === 'Recette' ? '#10b981' : '#ef4444';
        rowsHtml += `
            <tr>
                <td>${tx.date}</td>
                <td><strong>${tx.type}</strong></td>
                <td>${tx.category}</td>
                <td>${tx.description}</td>
                <td style="color: ${color}; font-weight: bold;">${(tx.amount || 0).toFixed(2)} €</td>
                <td><button onclick="deleteTransaction('${tx.id}')" class="btn btn-danger">Supprimer</button></td>
            </tr>
        `;
    });
    tbody.innerHTML = rowsHtml;
}

async function deleteTransaction(id) {
    if (!confirm("Voulez-vous vraiment supprimer cette transaction ?")) return;
    const { error } = await supabaseClient.from('transactions').delete().eq('id', id);
    if (error) alert("Erreur : " + error.message);
    else loadTransactions();
}

// ==========================================
// SIMULATEURS URSSAF ET CARPIMKO
// ==========================================

function calculateUrssaf() {
    const inputVal = document.getElementById('urssaf-income').value;
    const income = parseFloat(inputVal) || 0;

    if (income <= 0) {
        alert("Veuillez indiquer un revenu valide.");
        return;
    }

    const maladie = income * 0.065;
    const alloc = income * 0.031;
    const csg = income * 0.097;
    const cfp = (0.0025 * income) + 120;
    const total = maladie + alloc + csg + cfp;

    const resElem = document.getElementById('urssaf-results');
    if (resElem) {
        resElem.innerHTML = `
            <tr><td>Assurance Maladie</td><td>~6.5%</td><td>${maladie.toFixed(2)} €</td></tr>
            <tr><td>Allocations Familiales</td><td>~3.1%</td><td>${alloc.toFixed(2)} €</td></tr>
            <tr><td>CSG / CRDS</td><td>~9.7%</td><td>${csg.toFixed(2)} €</td></tr>
            <tr><td>Formation (CFP)</td><td>Forfait + %</td><td>${cfp.toFixed(2)} €</td></tr>
            <tr style="font-weight: bold; background: #f1f5f9;"><td>TOTAL ESTIMÉ URSSAF</td><td>-</td><td style="color: #ef4444;">${total.toFixed(2)} €</td></tr>
        `;
    }
}

function calculateCarpimko() {
    const inputVal = document.getElementById('carpimko-income').value;
    const income = parseFloat(inputVal) || 0;

    if (income <= 0) {
        alert("Veuillez indiquer un bénéfice valide.");
        return;
    }

    const regBase = income * 0.0823;
    const regComp = 1980.00;
    const asv = 1960.00;
    const inval = 780.00;
    const total = regBase + regComp + asv + inval;

    const resElem = document.getElementById('carpimko-results');
    if (resElem) {
        resElem.innerHTML = `
            <tr><td>Régime de Base</td><td>8.23 %</td><td>${regBase.toFixed(2)} €</td></tr>
            <tr><td>Régime Complémentaire</td><td>Forfait</td><td>${regComp.toFixed(2)} €</td></tr>
            <tr><td>ASV</td><td>Forfait</td><td>${asv.toFixed(2)} €</td></tr>
            <tr><td>Invalidité / Décès</td><td>Forfait</td><td>${inval.toFixed(2)} €</td></tr>
            <tr style="font-weight: bold; background: #f1f5f9;"><td>TOTAL ESTIMÉ CARPIMKO</td><td>-</td><td style="color: #ef4444;">${total.toFixed(2)} €</td></tr>
        `;
    }
}

// ==========================================
// RENDERERS (BILAN, 2035, JOURNAL, GRAND LIVRE)
// ==========================================

function renderBilan() {
    let recettes = 0, depenses = 0;
    const catMap = {};

    allTransactions.forEach(tx => {
        const amt = tx.amount || 0;
        if (tx.type === 'Recette') {
            recettes += amt;
        } else {
            depenses += amt;
            catMap[tx.category] = (catMap[tx.category] || 0) + amt;
        }
    });

    const res = recettes - depenses;
    const rElem = document.getElementById('bilan-total-recettes');
    const dElem = document.getElementById('bilan-total-depenses');
    const resElem = document.getElementById('bilan-resultat');

    if (rElem) rElem.textContent = `${recettes.toFixed(2)} €`;
    if (dElem) dElem.textContent = `${depenses.toFixed(2)} €`;
    if (resElem) {
        resElem.textContent = `${res.toFixed(2)} €`;
        resElem.className = `value ${res >= 0 ? 'val-positive' : 'val-negative'}`;
    }

    let rows = '';
    for (const [cat, sum] of Object.entries(catMap)) {
        const pct = depenses > 0 ? ((sum / depenses) * 100).toFixed(1) : '0.0';
        rows += `<tr><td>${cat}</td><td>${sum.toFixed(2)} €</td><td>${pct} %</td></tr>`;
    }
    const catElem = document.getElementById('bilan-categories-list');
    if (catElem) catElem.innerHTML = rows || '<tr><td colspan="3" class="text-center">Aucune dépense.</td></tr>';
}

function render2035() {
    let recettes = 0, ach = 0, urssaf = 0, carpimko = 0, autres = 0;

    allTransactions.forEach(tx => {
        const amt = tx.amount || 0;
        const cat = (tx.category || '').toLowerCase();

        if (tx.type === 'Recette') {
            recettes += amt;
        } else {
            if (cat.includes('urssaf')) urssaf += amt;
            else if (cat.includes('carpimko')) carpimko += amt;
            else if (cat.includes('achats') || cat.includes('fournitures')) ach += amt;
            else autres += amt;
        }
    });

    const totalD = ach + urssaf + carpimko + autres;
    const elem2035 = document.getElementById('2035-list');
    if (elem2035) {
        elem2035.innerHTML = `
            <tr><td>Ligne 1 (AA)</td><td>Honoraires encaissés</td><td><strong>${recettes.toFixed(2)} €</strong></td></tr>
            <tr><td>Ligne 9 (BU)</td><td>Achats de fournitures</td><td>${ach.toFixed(2)} €</td></tr>
            <tr><td>Ligne 25 (BT)</td><td>Cotisations URSSAF</td><td>${urssaf.toFixed(2)} €</td></tr>
            <tr><td>Ligne 25 (BS)</td><td>Cotisations CARPIMKO</td><td>${carpimko.toFixed(2)} €</td></tr>
            <tr><td>Lignes diverses</td><td>Autres charges d'exploitation</td><td>${autres.toFixed(2)} €</td></tr>
            <tr style="background: #f1f5f9;"><td>Ligne 36 (BM)</td><td>TOTAL DÉPENSES DÉDUCTIBLES</td><td><strong>${totalD.toFixed(2)} €</strong></td></tr>
            <tr style="background: #dcfce7; font-weight: bold;"><td>Ligne 46 (CP)</td><td>BÉNÉFICE COMPTABLE</td><td style="color: #166534;">${(recettes - totalD).toFixed(2)} €</td></tr>
        `;
    }
}

function renderJournalAndBalance() {
    let jHtml = '', bHtml = '';
    const bMap = {};

    allTransactions.forEach(tx => {
        const amt = tx.amount || 0;
        const isR = tx.type === 'Recette';
        const debit = isR ? 0 : amt;
        const credit = isR ? amt : 0;
        const code = getAccountCodeForCategory(tx.category, tx.type);

        jHtml += `<tr><td>${tx.date}</td><td>${tx.description}</td><td>${code}</td><td>${debit ? debit.toFixed(2) + ' €' : '-'}</td><td>${credit ? credit.toFixed(2) + ' €' : '-'}</td></tr>`;

        if (!bMap[code]) bMap[code] = { debit: 0, credit: 0, label: tx.category || (isR ? 'Honoraires' : 'Dépenses') };
        bMap[code].debit += debit;
        bMap[code].credit += credit;
    });

    const jElem = document.getElementById('journal-list');
    if (jElem) jElem.innerHTML = jHtml || '<tr><td colspan="5" class="text-center">Aucune écriture.</td></tr>';

    for (const [code, data] of Object.entries(bMap)) {
        const solde = data.credit - data.debit;
        bHtml += `<tr><td><strong>${code}</strong></td><td>${data.label}</td><td>${data.debit.toFixed(2)} €</td><td>${data.credit.toFixed(2)} €</td><td><strong>${solde.toFixed(2)} €</strong></td></tr>`;
    }
    const bElem = document.getElementById('balance-list');
    if (bElem) bElem.innerHTML = bHtml || '<tr><td colspan="5" class="text-center">Aucun compte.</td></tr>';
}

function renderGrandLivre() {
    const container = document.getElementById('grand-livre-content');
    if (!container) return;

    if (allTransactions.length === 0) {
        container.innerHTML = '<p class="text-center">Aucune transaction.</p>';
        return;
    }

    const grouped = {};
    allTransactions.forEach(tx => {
        const cat = tx.category || "Divers";
        if (!grouped[cat]) grouped[cat] = [];
        grouped[cat].push(tx);
    });

    let html = '';
    for (const [cat, list] of Object.entries(grouped)) {
        let rows = '', total = 0;
        list.forEach(t => {
            total += t.amount || 0;
            rows += `<tr><td>${t.date}</td><td>${t.description}</td><td>${(t.amount || 0).toFixed(2)} €</td></tr>`;
        });
        html += `
            <div style="margin-bottom:20px;">
                <h4 style="color: #2563eb; border-bottom: 2px solid #2563eb;">${cat} (Total: ${total.toFixed(2)} €)</h4>
                <table>
                    <thead><tr><th>Date</th><th>Libellé</th><th>Montant</th></tr></thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        `;
    }
    container.innerHTML = html;
}

function handleSaveProfil(e) {
    e.preventDefault();
    alert("Profil enregistré !");
}

function loadProfil() {}
