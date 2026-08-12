// ==========================================
// CONFIGURATION SUPABASE OFFICIELLE
// ==========================================
const SUPABASE_URL = "https://qfwhzuhwldurnmhirgil.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFmd2h6dWh3bGR1cm5taGlyZ2lsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU0OTQ0MTgsImV4cCI6MjEwMTA3MDQxOH0.Lt7eU9UBVY94tIIMUNOzLeJOpWnkGkvszy_gENkUkLg";

// Initialisation du client Supabase
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Variables globales
let allTransactions = [];
const defaultPlanComptable = [
    { code: "706000", label: "Honoraires / Recettes Soins", type: "Recette (Classe 7)" },
    { code: "622600", label: "Rétrocessions / Soins Infirmiers", type: "Charge (Classe 6)" },
    { code: "645100", label: "Cotisations URSSAF", type: "Charge (Classe 6)" },
    { code: "645200", label: "Cotisations CARPIMKO", type: "Charge (Classe 6)" },
    { code: "606000", label: "Achats / Fournitures médicales", type: "Charge (Classe 6)" }
];

// ==========================================
// INITIALISATION AU CHARGEMENT DE LA PAGE
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    // Initialise la date d'aujourd'hui dans le formulaire
    const dateInput = document.getElementById('tx-date');
    if (dateInput) dateInput.valueAsDate = new Date();

    // Écouteurs de formulaires
    const txForm = document.getElementById('transaction-form');
    if (txForm) txForm.addEventListener('submit', handleAddTransaction);

    const pcForm = document.getElementById('pc-form');
    if (pcForm) pcForm.addEventListener('submit', handleAddPlanComptable);

    // Chargement initial des données depuis Supabase
    loadTransactions();
    loadPlanComptable();
});

// ==========================================
// GESTION DES TRANSACTIONS
// ==========================================
async function loadTransactions() {
    const statusElement = document.getElementById('connection-status');

    try {
        const { data: transactions, error } = await supabaseClient
            .from('transactions')
            .select('*')
            .order('date', { ascending: false });

        if (error) throw error;

        // Statut de connexion réussi
        if (statusElement) {
            statusElement.textContent = "Connecté à Supabase";
            statusElement.style.background = "#dcfce7";
            statusElement.style.color = "#166534";
        }

        allTransactions = transactions || [];
        renderTransactionsTable(allTransactions);

    } catch (err) {
        console.error("Erreur lors du chargement des transactions :", err.message);
        if (statusElement) {
            statusElement.textContent = "Erreur Supabase (Table non trouvée ou accès restreint)";
            statusElement.style.background = "#fecaca";
            statusElement.style.color = "#991b1b";
        }
        
        const tbody = document.getElementById('transactions-list');
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="6" class="text-center" style="color:red;">Erreur de chargement : ${err.message}</td></tr>`;
        }
    }
}

function renderTransactionsTable(transactions) {
    const tbody = document.getElementById('transactions-list');
    if (!tbody) return;

    if (transactions.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center">Aucune transaction enregistrée dans Supabase.</td></tr>';
        return;
    }

    let html = '';
    transactions.forEach(tx => {
        const color = tx.type === 'Recette' ? '#10b981' : '#ef4444';
        html += `
            <tr>
                <td>${tx.date || ''}</td>
                <td><strong>${tx.type || ''}</strong></td>
                <td>${tx.category || ''}</td>
                <td>${tx.description || ''}</td>
                <td style="color: ${color}; font-weight: bold;">${(parseFloat(tx.amount) || 0).toFixed(2)} €</td>
                <td><button onclick="deleteTransaction('${tx.id}')" class="btn btn-danger">Supprimer</button></td>
            </tr>
        `;
    });
    tbody.innerHTML = html;
}

async function handleAddTransaction(event) {
    event.preventDefault();

    const date = document.getElementById('tx-date').value;
    const type = document.getElementById('tx-type').value;
    const category = document.getElementById('tx-category').value;
    const description = document.getElementById('tx-description').value;
    const amountVal = parseFloat(document.getElementById('tx-amount').value);

    const newTransaction = {
        date: date,
        type: type,
        category: category,
        description: description,
        amount: amountVal
    };

    const { error } = await supabaseClient.from('transactions').insert([newTransaction]);

    if (error) {
        alert("Erreur lors de l'enregistrement dans Supabase : " + error.message);
    } else {
        document.getElementById('transaction-form').reset();
        document.getElementById('tx-date').valueAsDate = new Date();
        loadTransactions();
    }
}

async function deleteTransaction(id) {
    if (!confirm("Voulez-vous vraiment supprimer cette transaction de Supabase ?")) return;

    const { error } = await supabaseClient.from('transactions').delete().eq('id', id);

    if (error) {
        alert("Erreur lors de la suppression : " + error.message);
    } else {
        loadTransactions();
    }
}

// ==========================================
// GESTION DU PLAN COMPTABLE
// ==========================================
async function loadPlanComptable() {
    try {
        const { data: planComptable, error } = await supabaseClient
            .from('plan_comptable')
            .select('*')
            .order('code', { ascending: true });

        if (error || !planComptable || planComptable.length === 0) {
            renderPlanComptableTable(defaultPlanComptable);
        } else {
            renderPlanComptableTable([...defaultPlanComptable, ...planComptable]);
        }
    } catch (err) {
        renderPlanComptableTable(defaultPlanComptable);
    }
}

function renderPlanComptableTable(accounts) {
    const tbody = document.getElementById('pc-list');
    if (!tbody) return;

    let html = '';
    accounts.forEach(acc => {
        html += `
            <tr>
                <td><strong>${acc.code}</strong></td>
                <td>${acc.label || acc.libelle}</td>
                <td>${acc.type}</td>
            </tr>
        `;
    });
    tbody.innerHTML = html;
}

async function handleAddPlanComptable(event) {
    event.preventDefault();

    const code = document.getElementById('pc-code').value.trim();
    const label = document.getElementById('pc-label').value.trim();
    const type = document.getElementById('pc-type').value;

    const newAccount = { code, label, type };

    const { error } = await supabaseClient.from('plan_comptable').insert([newAccount]);

    if (error) {
        alert("Erreur lors de l'ajout du compte dans Supabase : " + error.message);
    } else {
        document.getElementById('pc-form').reset();
        loadPlanComptable();
    }
}

// ==========================================
// NAVIGATION PAR ONGLETS
// ==========================================
function switchTab(tabId, element) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));

    const selectedTab = document.getElementById(`tab-${tabId}`);
    if (selectedTab) selectedTab.classList.add('active');
    if (element) element.classList.add('active');

    if (tabId === 'transactions') loadTransactions();
    if (tabId === 'plan-comptable') loadPlanComptable();
}
