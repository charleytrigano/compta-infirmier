// ==========================================
// CONFIGURATION SUPABASE
// ==========================================
const SUPABASE_URL = "https://qfwhzuhwldurnmhirgil.supabase.co/rest/v1/";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFmd2h6dWh3bGR1cm5taGlyZ2lsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU0OTQ0MTgsImV4cCI6MjEwMTA3MDQxOH0.Lt7eU9UBVY94tIIMUNOzLeJOpWnkGkvszy_gENkUkLg"; // Clé anonyme d'origine

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const BUCKET_NAME = 'documents'; // Nom du bucket dans Supabase Storage

// ==========================================
// INITIALISATION
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    // Initialiser la date par défaut sur la date du jour
    document.getElementById('tx-date').valueAsDate = new Date();
    
    // Écouteur sur le formulaire
    document.getElementById('transaction-form').addEventListener('submit', handleAddTransaction);

    // Charger les transactions
    loadTransactions();
});

// Switcher d'onglets
function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));

    const selectedTab = document.getElementById(`tab-${tabId}`);
    if (selectedTab) selectedTab.classList.add('active');

    event.currentTarget.classList.add('active');
}

// ==========================================
// GESTION DU STORAGE SUPABASE (FICHIERS)
// ==========================================

/**
 * Téléverse un fichier sélectionné dans Supabase Storage
 * @param {File} file - Le fichier scanné
 * @returns {Promise<string|null>} Le chemin du fichier enregistré
 */
async function uploadFile(file) {
    if (!file) return null;

    // Nom unique basé sur la date/heure actuelle
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

    const { data, error } = await supabaseClient
        .storage
        .from(BUCKET_NAME)
        .upload(fileName, file);

    if (error) {
        console.error("Erreur lors de l'envoi du fichier :", error);
        alert("Attention : impossible de téléverser le fichier scanné : " + error.message);
        return null;
    }

    return data.path;
}

/**
 * Récupère l'URL publique de visualisation d'un fichier scanné
 * @param {string} filePath - Le nom du fichier dans le bucket
 * @returns {string|null} URL d'accès direct au document
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
// CRUD TRANSACTIONS
// ==========================================

/**
 * Ajoute une écriture comptable dans Supabase
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
        alert("Veuillez remplir tous les champs obligatoires.");
        return;
    }

    let filePath = null;
    if (fileInput.files.length > 0) {
        filePath = await uploadFile(fileInput.files[0]);
    }

    // Préparation de l'objet à insérer dans Supabase
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
        console.error("Erreur Supabase insert :", error);
        alert("Erreur lors de l'enregistrement : " + error.message);
    } else {
        alert("Écriture enregistrée avec succès !");
        document.getElementById('transaction-form').reset();
        document.getElementById('tx-date').valueAsDate = new Date();
        loadTransactions();
    }
}

/**
 * Charge et affiche l'ensemble des transactions
 */
async function loadTransactions() {
    const statusElement = document.getElementById('connection-status');

    const { data: transactions, error } = await supabaseClient
        .from('transactions')
        .select('*')
        .order('date', { ascending: false });

    if (error) {
        console.error("Erreur chargement transactions :", error);
        statusElement.textContent = "Erreur Connexion";
        statusElement.style.background = "#fecaca";
        statusElement.style.color = "#991b1b";
        return;
    }

    statusElement.textContent = "Connecté à Supabase";
    statusElement.style.background = "#dcfce7";
    statusElement.style.color = "#166534";

    renderTransactionsTable(transactions);
}

/**
 * Génère le tableau HTML des écritures
 */
function renderTransactionsTable(transactions) {
    const tbody = document.getElementById('transactions-list');
    tbody.innerHTML = '';

    if (!transactions || transactions.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7">Aucune transaction enregistrée.</td></tr>';
        return;
    }

    transactions.forEach(tx => {
        const tr = document.createElement('tr');

        // Génération du lien de consultation du document
        let docHtml = '-';
        if (tx.file_path) {
            const fileUrl = getDocumentUrl(tx.file_path);
            docHtml = `<a href="${fileUrl}" target="_blank" class="btn-view-doc">📄 Voir</a>`;
        }

        tr.innerHTML = `
            <td>${tx.date}</td>
            <td><strong>${tx.type}</strong></td>
            <td>${tx.category}</td>
            <td>${tx.description}</td>
            <td style="color: ${tx.type === 'Recette' ? '#10b981' : '#ef4444'}; font-weight: bold;">
                ${tx.amount.toFixed(2)} €
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
 * Supprime une transaction
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
