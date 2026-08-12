// ==========================================
// LOGIQUE DE L'APPLICATION (APP.JS)
// ==========================================

// Variable globale pour stocker les transactions en mémoire
let allTransactions = [];

// Initialisation au chargement de la page
document.addEventListener('DOMContentLoaded', () => {
    // Ajuster le champ date à la date du jour par défaut
    const dateInput = document.getElementById('tx-date');
    if (dateInput) dateInput.valueAsDate = new Date();

    // Attacher les événements aux formulaires
    const txForm = document.getElementById('transaction-form');
    if (txForm) txForm.addEventListener('submit', handleAddTransaction);

    const pcForm = document.getElementById('pc-form');
    if (pcForm) pcForm.addEventListener('submit', handleAddPlanComptable);

    const profForm = document.getElementById('profil-form');
    if (profForm) profForm.addEventListener('submit', handleSaveProfil);

    // Charger les données initiales
    loadTransactions();
    loadPlanComptable();
    loadProfil();
});

// Navigation entre les onglets
function switchTab(tabId, element) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));

    const selectedTab = document.getElementById(`tab-${tabId}`);
    if (selectedTab) selectedTab.classList.add('active');
    if (element) element.classList.add('active');

    // Mettre à jour la vue selon l'onglet affiché
    if (tabId === 'bilan') renderBilan();
    if (tabId === 'declarations') render2035();
    if (tabId === 'journal') renderJournalAndBalance();
    if (tabId === 'grand-livre') renderGrandLivre();
}

// Upload de document dans Supabase Storage
async function uploadFile(file) {
    if (!file) return null;
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

    const { data, error } = await supabaseClient.storage.from(BUCKET_NAME).upload(fileName, file);

    if (error) {
        console.error("Erreur d'envoi du fichier :", error);
        alert("Échec de l'envoi de la pièce jointe : " + error.message);
        return null;
    }
    return data.path;
}

function getDocumentUrl(filePath) {
    if (!filePath) return null;
    const { data } = supabaseClient.storage.from(BUCKET_NAME).getPublicUrl(filePath);
    return data.publicUrl;
}

// Associateur de catégorie vers numéro de compte du Plan Comptable
function getAccountCodeForCategory(category, type) {
    if (type === 'Recette') return "706000";
    
    const matchedAccount = defaultPlanComptable.find(acc => 
        acc.label.toLowerCase().includes(category.toLowerCase()) || 
        category.toLowerCase().includes(acc.label.toLowerCase())
    );

    if (matchedAccount) return matchedAccount.code;

    // Codes par défaut selon mots-clés courants
    const catLower = (category || '').toLowerCase();
    if (catLower.includes('urssaf')) return "645100";
    if (catLower.includes('carpimko')) return "645200";
    if (catLower.includes('soins') || catLower.includes('honoraires')) return "706000";
    if (catLower.includes('achat') || catLower.includes('fourniture')) return "606000";
    if (catLower.includes('loyer') || catLower.includes('location')) return "613200";
    if (catLower.includes('deplacement') || catLower.includes('carburant')) return "625100";

    return "606000"; // Compte de charge par défaut
}

// Gestion des transactions
async function handleAddTransaction(event) {
    event.preventDefault();

    const date = document.getElementById('tx-date').value;
    const type = document.getElementById('tx-type').value;
    const category = document.getElementById('tx-category').value;
    const description = document.getElementById('tx-description').value;
    const amountVal = parseFloat(document.getElementById('tx-amount').value);
    const fileInput = document.getElementById('tx-file');

    if (!date || !type || !category || !description || isNaN(amountVal)) {
        alert("Veuillez remplir correctement tous les champs obligatoires.");
        return;
    }

    let filePath = null;
    if (fileInput && fileInput.files.length > 0) {
        filePath = await uploadFile(fileInput.files[0]);
    }

    const newTransaction = { date, type, category, description, amount: amountVal, file_path: filePath };
    const { error } = await supabaseClient.from('transactions').insert([newTransaction]);

    if (error) {
        alert("Erreur lors de l'enregistrement : " + error.message);
    } else {
        alert("Transaction enregistrée avec succès !");
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
        tbody.innerHTML = '<tr><td colspan="7" class="text-center">Aucune transaction enregistrée.</td></tr>';
        return;
    }

    let rowsHtml = '';
    transactions.forEach(tx => {
        const docHtml = tx.file_path 
            ? `<a href="${getDocumentUrl(tx.file_path)}" target="_blank" class="btn-view-doc">📄 Voir</a>` 
            : '-';
        const color = tx.type === 'Recette' ? '#10b981' : '#ef4444';

        rowsHtml += `
            <tr>
                <td>${tx.date}</td>
                <td><strong>${tx.type}</strong></td>
                <td>${tx.category}</td>
                <td>${tx.description}</td>
                <td style="color: ${color}; font-weight: bold;">${(tx.amount || 0).toFixed(2)} €</td>
                <td>${docHtml}</td>
                <td><button onclick="deleteTransaction('${tx.id}')" class="btn btn-danger">Supprimer</button></td>
            </tr>
        `;
    });
    tbody.innerHTML = rowsHtml;
}

async function deleteTransaction(id) {
    if (!confirm("Voulez-vous vraiment supprimer cette ligne ?")) return;
    const { error } = await supabaseClient.from('transactions').delete().eq('id', id);
    if (error) alert("Erreur : " + error.message);
    else loadTransactions();
}

// Plan comptable
function loadPlanComptable() {
    const stored = localStorage.getItem('plan_comptable');
    if (stored) defaultPlanComptable = JSON.parse(stored);
    renderPlanComptable();
}

function renderPlanComptable() {
    const tbody = document.getElementById('plan-comptable-list');
    if (!tbody) return;

    let html = '';
    defaultPlanComptable.forEach(acc => {
        html += `<tr><td><strong>${acc.code}</strong></td><td>${acc.label}</td><td>${acc.type}</td></tr>`;
    });
    tbody.innerHTML = html;
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

// Calculateurs URSSAF & CARPIMKO
function calculateUrssaf() {
    const inputVal = document.getElementById('urssaf-income').value;
    const income = parseFloat(inputVal) || 0;

    if (income <= 0) {
        alert("Veuillez indiquer un revenu supérieur à 0 €.");
        return;
    }

    const maladie = income * 0.065;
    const alloc = income * 0.031;
    const csg = income * 0.097;
    const cfp = 0.0025 * income + 120;
    const total = maladie + alloc + csg + cfp;

    document.getElementById('urssaf-results').innerHTML = `
        <tr><td>Assurance Maladie</td><td>~6.5%</td><td>${maladie.toFixed(2)} €</td></tr>
        <tr><td>Allocations Familiales</td><td>~3.1%</td><td>${alloc.toFixed(2)} €</td></tr>
        <tr><td>CSG / CRDS</td><td>~9.7%</td><td>${csg.toFixed(2)} €</td></tr>
        <tr><td>Formation (CFP)</td><td>Forfait + %</td><td>${cfp.toFixed(2)} €</td></tr>
        <tr style="font-weight: bold; background: #f1f5f9;"><td>TOTAL ESTIMÉ URSSAF</td><td>-</td><td style="color: var(--danger);">${total.toFixed(2)} €</td></tr>
    `;
}

function calculateCarpimko() {
    const inputVal = document.getElementById('carpimko-income').value;
    const income = parseFloat(inputVal) || 0;

    if (income <= 0) {
        alert("Veuillez indiquer un bénéfice supérieur à 0 €.");
        return;
    }

    const regBase = income * 0.0823;
    const regComp = 1980.00;
    const asv = 1960.00;
    const inval = 780.00;
    const total = regBase + regComp + asv + inval;

    document.getElementById('carpimko-results').innerHTML = `
        <tr><td>Régime de Base</td><td>8.23 %</td><td>${regBase.toFixed(2)} €</td></tr>
        <tr><td>Régime Complémentaire</td><td>Forfait</td><td>${regComp.toFixed(2)} €</td></tr>
        <tr><td>ASV</td><td>Forfait</td><td>${asv.toFixed(2)} €</td></tr>
        <tr><td>Invalidité / Décès</td><td>Forfait</td><td>${inval.toFixed(2)} €</td></tr>
        <tr style="font-weight: bold; background: #f1f5f9;"><td>TOTAL ESTIMÉ CARPIMKO</td><td>-</td><td style="color: var(--danger);">${total.toFixed(2)} €</td></tr>
    `;
}

// Bilan, 2035, Journal & Grand Livre
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
    document.getElementById('bilan-total-recettes').textContent = `${recettes.toFixed(2)} €`;
    document.getElementById('bilan-total-depenses').textContent = `${depenses.toFixed(2)} €`;
    
    const resElem = document.getElementById('bilan-resultat');
    resElem.textContent = `${res.toFixed(2)} €`;
    resElem.className = `value ${res >= 0 ? 'val-positive' : 'val-negative'}`;

    let rows = '';
    for (const [cat, sum] of Object.entries(catMap)) {
        const pct = depenses > 0 ? ((sum / depenses) * 100).toFixed(1) : '0.0';
        rows += `<tr><td>${cat}</td><td>${sum.toFixed(2)} €</td><td>${pct} %</td></tr>`;
    }
    document.getElementById('bilan-categories-list').innerHTML = rows || '<tr><td colspan="3" class="text-center">Aucune dépense.</td></tr>';
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
    document.getElementById('2035-list').innerHTML = `
        <tr><td>Ligne 1 (AA)</td><td>Honoraires encaissés</td><td><strong>${recettes.toFixed(2)} €</strong></td></tr>
        <tr><td>Ligne 9 (BU)</td><td>Achats de fournitures</td><td>${ach.toFixed(2)} €</td></tr>
        <tr><td>Ligne 25 (BT)</td><td>Cotisations URSSAF</td><td>${urssaf.toFixed(2)} €</td></tr>
        <tr><td>Ligne 25 (BS)</td><td>Cotisations CARPIMKO</td><td>${carpimko.toFixed(2)} €</td></tr>
        <tr><td>Lignes diverses</td><td>Autres charges d'exploitation</td><td>${autres.toFixed(2)} €</td></tr>
        <tr style="background: #f1f5f9;"><td>Ligne 36 (BM)</td><td>TOTAL DÉPENSES DÉDUCTIBLES</td><td><strong>${totalD.toFixed(2)} €</strong></td></tr>
        <tr style="background: #dcfce7; font-weight: bold;"><td>Ligne 46 (CP)</td><td>BÉNÉFICE COMPTABLE</td><td style="color: #166534;">${(recettes - totalD).toFixed(2)} €</td></tr>
    `;
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

    document.getElementById('journal-list').innerHTML = jHtml || '<tr><td colspan="5" class="text-center">Aucune écriture.</td></tr>';

    for (const [code, data] of Object.entries(bMap)) {
        bHtml += `<tr><td><strong>${code}</strong></td><td>${data.label}</td><td>${data.debit.toFixed(2)} €</td><td>${data.credit.toFixed(2)} €</td><td><strong>${(data.credit - data.debit).toFixed(2)} €</strong></td></tr>`;
    }
    document.getElementById('balance-list').innerHTML = bHtml || '<tr><td colspan="5" class="text-center">Aucun compte.</td></tr>';
}

function renderGrandLivre() {
    const container = document.getElementById('grand-livre-content');
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
                <h4 style="color: var(--primary); border-bottom: 2px solid var(--primary);">${cat} (Total: ${total.toFixed(2)} €)</h4>
                <table>
                    <thead><tr><th>Date</th><th>Libellé</th><th>Montant</th></tr></thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        `;
    }
    container.innerHTML = html;
}

// Profil utilisateur
function handleSaveProfil(e) {
    e.preventDefault();
    const data = {
        name: document.getElementById('prof-name').value,
        job: document.getElementById('prof-job').value,
        siret: document.getElementById('prof-siret').value,
        rpps: document.getElementById('prof-rpps').value
    };
    localStorage.setItem('user_profil', JSON.stringify(data));
    alert("Profil sauvegardé !");
}

function loadProfil() {
    const stored = localStorage.getItem('user_profil');
    if (stored) {
        const p = JSON.parse(stored);
        document.getElementById('prof-name').value = p.name || '';
        document.getElementById('prof-job').value = p.job || '';
        document.getElementById('prof-siret').value = p.siret || '';
        document.getElementById('prof-rpps').value = p.rpps || '';
    }
}
