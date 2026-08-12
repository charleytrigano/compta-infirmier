// ==========================================
// CORE APPLICATION - TRANSACTIONS & PLAN COMPTABLE
// ==========================================
var SUPABASE_URL = "https://qfwhzuhwldurnmhirgil.supabase.co";
var SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFmd2h6dWh3bGR1cm5taGlyZ2lsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU0OTQ0MTgsImV4cCI6MjEwMTA3MDQxOH0.Lt7eU9UBVY94tIIMUNOzLeJOpWnkGkvszy_gENkUkLg";

// Variable globale partagée avec tous les autres fichiers JS
window.supabaseClient = null;
window.allTransactions = [];

var defaultPlanComptable = [
    { code: "706000", label: "Honoraires / Recettes Soins", type: "Recette (Classe 7)" },
    { code: "622600", label: "Rétrocessions / Soins Infirmiers", type: "Charge (Classe 6)" },
    { code: "645100", label: "Cotisations URSSAF", type: "Charge (Classe 6)" },
    { code: "645200", label: "Cotisations CARPIMKO", type: "Charge (Classe 6)" },
    { code: "606000", label: "Achats / Fournitures médicales", type: "Charge (Classe 6)" }
];

// Initialisation au chargement de la page
document.addEventListener('DOMContentLoaded', function() {
    initApp();
});

function initApp() {
    var statusElement = document.getElementById('connection-status');

    if (window.supabase && typeof window.supabase.createClient === 'function') {
        window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    } else {
        if (statusElement) {
            statusElement.textContent = "Erreur : CDN Supabase non chargé";
            statusElement.style.background = "#fecaca";
            statusElement.style.color = "#991b1b";
        }
        return;
    }

    var dateInput = document.getElementById('tx-date');
    if (dateInput) dateInput.valueAsDate = new Date();

    var txForm = document.getElementById('transaction-form');
    if (txForm) txForm.addEventListener('submit', handleAddTransaction);

    var pcForm = document.getElementById('pc-form');
    if (pcForm) pcForm.addEventListener('submit', handleAddPlanComptable);

    loadTransactions();
    loadPlanComptable();
}

// ------------------------------------------
// MODULE 1 : TRANSACTIONS (VERROUILLÉ)
// ------------------------------------------
async function loadTransactions() {
    if (!window.supabaseClient) return;

    var statusElement = document.getElementById('connection-status');

    try {
        var response = await window.supabaseClient
            .from('transactions')
            .select('*')
            .order('date', { ascending: false });

        if (response.error) throw response.error;

        if (statusElement) {
            statusElement.textContent = "Connecté à Supabase";
            statusElement.style.background = "#dcfce7";
            statusElement.style.color = "#166534";
        }

        window.allTransactions = response.data || [];
        renderTransactionsTable(window.allTransactions);

    } catch (err) {
        console.error("Erreur Supabase Transactions :", err.message);
        if (statusElement) {
            statusElement.textContent = "Erreur Supabase (" + err.message + ")";
            statusElement.style.background = "#fecaca";
            statusElement.style.color = "#991b1b";
        }
    }
}

function renderTransactionsTable(transactions) {
    var tbody = document.getElementById('transactions-list');
    if (!tbody) return;

    if (transactions.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center">Aucune transaction enregistrée.</td></tr>';
        return;
    }

    var html = '';
    transactions.forEach(function(tx) {
        var color = tx.type === 'Recette' ? '#10b981' : '#ef4444';
        html += '<tr>' +
            '<td>' + (tx.date || '') + '</td>' +
            '<td><strong>' + (tx.type || '') + '</strong></td>' +
            '<td>' + (tx.category || '') + '</td>' +
            '<td>' + (tx.description || '') + '</td>' +
            '<td style="color: ' + color + '; font-weight: bold;">' + (parseFloat(tx.amount) || 0).toFixed(2) + ' €</td>' +
            '<td><button onclick="deleteTransaction(\'' + tx.id + '\')" class="btn btn-danger">Supprimer</button></td>' +
            '</tr>';
    });
    tbody.innerHTML = html;
}

async function handleAddTransaction(event) {
    event.preventDefault();
    if (!window.supabaseClient) return;

    var newTransaction = {
        date: document.getElementById('tx-date').value,
        type: document.getElementById('tx-type').value,
        category: document.getElementById('tx-category').value,
        description: document.getElementById('tx-description').value,
        amount: parseFloat(document.getElementById('tx-amount').value)
    };

    var res = await window.supabaseClient.from('transactions').insert([newTransaction]);

    if (res.error) {
        alert("Erreur lors de l'ajout : " + res.error.message);
    } else {
        document.getElementById('transaction-form').reset();
        document.getElementById('tx-date').valueAsDate = new Date();
        loadTransactions();
    }
}

async function deleteTransaction(id) {
    if (!window.supabaseClient) return;
    if (!confirm("Voulez-vous vraiment supprimer cette transaction ?")) return;

    var res = await window.supabaseClient.from('transactions').delete().eq('id', id);

    if (res.error) {
        alert("Erreur lors de la suppression : " + res.error.message);
    } else {
        loadTransactions();
    }
}

// ------------------------------------------
// MODULE 2 : PLAN COMPTABLE (VERROUILLÉ)
// ------------------------------------------
async function loadPlanComptable() {
    if (!window.supabaseClient) {
        renderPlanComptableTable(defaultPlanComptable);
        return;
    }

    try {
        // Nom de la table exacte en base : plan_comptable
        var res = await window.supabaseClient
            .from('plan_comptable')
            .select('*')
            .order('code', { ascending: true });

        if (res.error || !res.data || res.data.length === 0) {
            renderPlanComptableTable(defaultPlanComptable);
        } else {
            renderPlanComptableTable(defaultPlanComptable.concat(res.data));
        }
    } catch (err) {
        renderPlanComptableTable(defaultPlanComptable);
    }
}

function renderPlanComptableTable(accounts) {
    var tbody = document.getElementById('pc-list');
    if (!tbody) return;

    var html = '';
    accounts.forEach(function(acc) {
        html += '<tr>' +
            '<td><strong>' + acc.code + '</strong></td>' +
            '<td>' + (acc.label || acc.libelle || '') + '</td>' +
            '<td>' + acc.type + '</td>' +
            '</tr>';
    });
    tbody.innerHTML = html;
}

async function handleAddPlanComptable(event) {
    event.preventDefault();
    if (!window.supabaseClient) return;

    var newAccount = {
        code: document.getElementById('pc-code').value.trim(),
        label: document.getElementById('pc-label').value.trim(),
        type: document.getElementById('pc-type').value
    };

    var res = await window.supabaseClient.from('plan_comptable').insert([newAccount]);

    if (res.error) {
        alert("Erreur : " + res.error.message);
    } else {
        document.getElementById('pc-form').reset();
        loadPlanComptable();
    }
}

// ------------------------------------------
// NAVIGATION PAR ONGLETS & DÉCLENCHEMENT DES MODULES
// ------------------------------------------
function switchTab(tabId, element) {
    var tabs = document.querySelectorAll('.tab-content');
    for (var i = 0; i < tabs.length; i++) {
        tabs[i].classList.remove('active');
    }

    var btns = document.querySelectorAll('.tab-btn');
    for (var j = 0; j < btns.length; j++) {
        btns[j].classList.remove('active');
    }

    var selectedTab = document.getElementById('tab-' + tabId);
    if (selectedTab) selectedTab.classList.add('active');
    if (element) element.classList.add('active');

    // Déclenchement des fonctions propres à chaque fichier indépendant
    if (tabId === 'transactions') loadTransactions();
    if (tabId === 'plan-comptable') loadPlanComptable();
    if (tabId === 'urssaf' && typeof window.initUrssaf === 'function') window.initUrssaf();
    if (tabId === 'carpimko' && typeof window.initCarpimko === 'function') window.initCarpimko();
    if (tabId === 'bilan' && typeof window.initBilan === 'function') window.initBilan();
    if (tabId === 'declarations' && typeof window.init2035 === 'function') window.init2035();
    if (tabId === 'journal' && typeof window.initJournal === 'function') window.initJournal();
    if (tabId === 'grand-livre' && typeof window.initGrandLivre === 'function') window.initGrandLivre();
    if (tabId === 'profil' && typeof window.initProfil === 'function') window.initProfil();
}
