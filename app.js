// ==========================================
// CONFIGURATION ET INITIALISATION SUPABASE
// ==========================================

// 1. URL racine exacte du projet (SANS le suffixe /rest/v1/)
const SUPABASE_URL = "https://qfwhzuhwldurnmhirgil.supabase.co"; 

// 2. Clé d'accès anonyme publique (anon key)
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFmd2h6dWh3bGR1cm5taGlyZ2lsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU0OTQ0MTgsImV4cCI6MjEwMTA3MDQxOH0.Lt7eU9UBVY94tIIMUNOzLeJOpWnkGkvszy_gENkUkLg";

// Initialisation du client officiel Supabase
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Nom du dossier (Bucket) dans Supabase Storage pour les justificatifs
const BUCKET_NAME = 'documents';

// ==========================================
// INITIALISATION DE L'APPLICATION
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    // 1. Définir la date par défaut sur la date du jour
    const dateInput = document.getElementById('tx-date');
    if (dateInput) {
        dateInput.valueAsDate = new Date();
    }
    
    // 2. Associer la soumission du formulaire d'enregistrement
    const form = document.getElementById('transaction-form');
    if (form) {
        form.addEventListener('submit', handleAddTransaction);
    }

    // 3. Charger les transactions au démarrage
    loadTransactions();
});

/**
 * Permet de basculer d'un onglet à un autre
 * @param {string} tabId - Identifiant de l'onglet (ex: 'transactions', 'urssaf')
 */
function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));

    const selectedTab = document.getElementById(`tab-${tabId}`);
    if (selectedTab) {
        selectedTab.classList.add('active');
    }

    if (window.event && window.event.currentTarget) {
        window.event.currentTarget.classList.add('active');
    }
}

// ==========================================
// GESTION DU STORAGE SUPABASE (FICHIERS SCANNÉS)
// ==========================================

/**
 * Envoie un fichier scanné vers Supabase Storage
 * @param {File} file - Le fichier à téléverser
 * @returns {Promise<string|null>} Chemin du fichier ou null en cas d'erreur
 */
async function uploadFile(file) {
    if (!file) return null;

    // Nom unique basé sur le temps présent pour éviter tout conflit de nom
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

    const { data, error } = await supabaseClient
        .storage
        .from(BUCKET_NAME)
        .upload(fileName, file);

    if (error) {
        console.error("Erreur lors de l'envoi du fichier :", error);
        alert("Attention : le fichier n'a pas pu être téléversé : " + error.message);
        return null;
    }

    return data.path;
}

/**
 * Récupère l'URL publique de consultation d'un fichier
 * @param {string} filePath - Chemin relatif du fichier
 * @returns {string|null} URL d'accès direct
 */
function getDocumentUrl(filePath) {
    if (!filePath) return null;

    const { data } = supabaseClient
        .storage
        .from(BUCKET_NAME)
        .getPublicUrl(filePath);

    return data.publicUrl;
}

// ==========================================
// GESTION DES TRANSACTIONS (BASE DE DONNÉES)
// ==========================================

/**
 * Traite la création d'une nouvelle transaction
 */
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

    const newTransaction = {
        date: date,
        type: type,
        category: category,
        description: description,
        amount: amountVal,
        file_path: filePath
    };

    const { data, error } = await supabaseClient
        .from('transactions')
        .insert([newTransaction]);

    if (error) {
        console.error("Erreur d'insertion Supabase :", error);
        alert("Impossible d'enregistrer l'écriture : " + error.message);
    } else {
        alert("Écriture enregistrée avec succès !");
        document.getElementById('transaction-form').reset();
        document.getElementById('tx-date').valueAsDate = new Date();
        loadTransactions();
    }
}

/**
 * Récupère les transactions depuis la base de données
 */
async function loadTransactions() {
    const statusElement = document.getElementById('connection-status');

    const { data: transactions, error } = await supabaseClient
        .from('transactions')
        .select('*')
        .order('date', { ascending: false });

    if (error) {
        console.error("Erreur de chargement des transactions :", error);
        if (statusElement) {
            statusElement.textContent = "Erreur Connexion";
            statusElement.style.background = "#fecaca";
            statusElement.style.color = "#991b1b";
        }
        return;
    }

    // Connexion réussie
    if (statusElement) {
        statusElement.textContent = "Connecté à Supabase";
        statusElement.style.background = "#dcfce7";
        statusElement.style.color = "#166534";
    }

    renderTransactionsTable(transactions);
}

/**
 * Affiche le tableau HTML des écritures
 */
function renderTransactionsTable(transactions) {
    const tbody = document.getElementById('transactions-list');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (!transactions || transactions.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;">Aucune transaction enregistrée pour le moment.</td></tr>';
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
        const formattedAmount = typeof tx.amount === 'number' ? tx.amount.toFixed(2) : '0.00';

        tr.innerHTML = `
            <td>${tx.date}</td>
            <td><strong>${tx.type}</strong></td>
            <td>${tx.category}</td>
            <td>${tx.description}</td>
            <td style="color: ${amountColor}; font-weight: bold;">
                ${formattedAmount} €
            </td>
            <td>${docHtml}</td>
            <td>
                <button onclick="deleteTransaction('${tx.id}')" class="btn btn-danger">Supprimer</button>
            </td>
        `;

        tbody.appendChild(tr);
    });
}

/**
 * Supprime une transaction spécifique
 */
async function deleteTransaction(id) {
    if (!confirm("Voulez-vous vraiment supprimer cette écriture ?")) return;

    const { error } = await supabaseClient
        .from('transactions')
        .delete()
        .eq('id', id);

    if (error) {
        alert("Erreur lors de la suppression : " + error.message);
    } else {
        loadTransactions();
    }
}
