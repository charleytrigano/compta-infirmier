// ==========================================
// CONFIGURATION ET INITIALISATION SUPABASE
// ==========================================

// URL racine exacte du projet (Sans /rest/v1/)
const SUPABASE_URL = "https://qfwhzuhwldurnmhirgil.supabase.co"; 

// Clé d'accès anonyme publique exacte
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFmd2h6dWh3bGR1cm5taGlyZ2lsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU0OTQ0MTgsImV4cCI6MjEwMTA3MDQxOH0.Lt7eU9UBVY94tIIMUNOzLeJOpWnkGkvszy_gENkUkLg";

// Initialisation du client officiel Supabase
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Nom du Bucket Storage dans Supabase pour les pièces jointes
const BUCKET_NAME = 'documents';

// ==========================================
// INITIALISATION DE L'APPLICATION
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    // 1. Définir la date par défaut du formulaire sur aujourd'hui
    const dateInput = document.getElementById('tx-date');
    if (dateInput) {
        dateInput.valueAsDate = new Date();
    }
    
    // 2. Écouter la soumission du formulaire d'ajout
    const form = document.getElementById('transaction-form');
    if (form) {
        form.addEventListener('submit', handleAddTransaction);
    }

    // 3. Charger la liste des transactions au démarrage
    loadTransactions();
});

/**
 * Permet de basculer d'un onglet à un autre
 * @param {string} tabId - L'identifiant de l'onglet à afficher
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
 * Téléverse un fichier vers Supabase Storage
 * @param {File} file - Fichier sélectionné par l'utilisateur
 * @returns {Promise<string|null>} Chemin relatif du fichier stocké
 */
async function uploadFile(file) {
    if (!file) return null;

    // Nom unique basé sur l'horodatage pour éviter toute collision
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
 * Génère l'URL publique de consultation d'une pièce jointe
 * @param {string} filePath - Chemin relatif dans Supabase Storage
 * @returns {string|null} URL d'accès direct au fichier
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
 * Enregistre une nouvelle transaction
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
 * Charge les transactions depuis Supabase et met à jour l'état de connexion
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
 * Génère le tableau HTML des écritures comptables
 * @param {Array} transactions - Liste des objets transactions reçus de Supabase
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
 * Supprime une transaction de la base de données
 * @param {string|number} id - Identifiant de la transaction
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
