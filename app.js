// ==========================================
// CONFIGURATION ET INITIALISATION SUPABASE
// ==========================================

// URL officielle et fonctionnelle de votre projet Supabase
const SUPABASE_URL = "https://qfwhzuhwldurnmhirgil.supabase.co/rest/v1/"; 

// Clé d'accès publique anonyme (anon key)
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFmd2h6dWhsMmR1cm5taGlyZ2lsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDA5ODg1ODQsImV4cCI6MjA1NjU2NDU4NH0.L30G8Snp-u_l3P9JmU0E9wz4V-U4R3Yq_N8kL3I4_vU";

// Initialisation du client Supabase
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Nom du Bucket Supabase Storage où sont enregistrées les pièces jointes
const BUCKET_NAME = 'documents';

// ==========================================
// INITIALISATION DE L'APPLICATION
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    // 1. Initialiser la date du formulaire à la date du jour par défaut
    const dateInput = document.getElementById('tx-date');
    if (dateInput) {
        dateInput.valueAsDate = new Date();
    }
    
    // 2. Associer la soumission du formulaire à la fonction d'enregistrement
    const form = document.getElementById('transaction-form');
    if (form) {
        form.addEventListener('submit', handleAddTransaction);
    }

    // 3. Charger et afficher immédiatement les transactions enregistrées
    loadTransactions();
});

/**
 * Permet de basculer d'un onglet à un autre dans l'interface
 * @param {string} tabId - L'identifiant de l'onglet à afficher (ex: 'transactions', 'urssaf', etc.)
 */
function switchTab(tabId) {
    // Masquer tous les onglets
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));

    // Afficher l'onglet ciblé
    const selectedTab = document.getElementById(`tab-${tabId}`);
    if (selectedTab) {
        selectedTab.classList.add('active');
    }

    // Mettre le bouton cliqué en état actif
    if (window.event && window.event.currentTarget) {
        window.event.currentTarget.classList.add('active');
    }
}

// ==========================================
// GESTION DU STORAGE SUPABASE (PIÈCES JOINTES)
// ==========================================

/**
 * Envoyer un fichier scanné (image ou PDF) vers Supabase Storage
 * @param {File} file - Le fichier sélectionné dans le champ HTML
 * @returns {Promise<string|null>} Le chemin d'accès unique du fichier ou null en cas d'erreur
 */
async function uploadFile(file) {
    if (!file) return null;

    // Générer un nom de fichier unique basé sur le temps pour éviter les doublons
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

    // Téléversement du fichier dans le bucket Storage
    const { data, error } = await supabaseClient
        .storage
        .from(BUCKET_NAME)
        .upload(fileName, file);

    if (error) {
        console.error("Erreur lors du téléversement du fichier :", error);
        alert("Attention : la pièce jointe n'a pas pu être envoyée. " + error.message);
        return null;
    }

    // Renvoie le chemin relatif enregistré dans le bucket
    return data.path;
}

/**
 * Obtenir le lien web public pour consulter un document scanné
 * @param {string} filePath - Le chemin du fichier stocké dans Supabase
 * @returns {string|null} L'URL complète d'accès au fichier
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
 * Traite la création et l'enregistrement d'une nouvelle opération
 * @param {Event} event - L'événement de soumission du formulaire
 */
async function handleAddTransaction(event) {
    event.preventDefault();

    // Récupération des valeurs saisies dans le formulaire
    const date = document.getElementById('tx-date').value;
    const type = document.getElementById('tx-type').value;
    const category = document.getElementById('tx-category').value;
    const description = document.getElementById('tx-description').value;
    const amountVal = parseFloat(document.getElementById('tx-amount').value);
    const fileInput = document.getElementById('tx-file');

    // Validation des données obligatoires
    if (!date || !type || !category || !description || isNaN(amountVal)) {
        alert("Veuillez remplir correctement tous les champs obligatoires.");
        return;
    }

    // Gestion de la pièce jointe si un fichier est sélectionné
    let filePath = null;
    if (fileInput && fileInput.files.length > 0) {
        filePath = await uploadFile(fileInput.files[0]);
    }

    // Préparation de l'objet transaction envoyé à Supabase
    const newTransaction = {
        date: date,
        type: type,
        category: category,
        description: description,
        amount: amountVal,
        file_path: filePath
    };

    // Insertion dans la table 'transactions' de la base de données
    const { data, error } = await supabaseClient
        .from('transactions')
        .insert([newTransaction]);

    if (error) {
        console.error("Erreur d'insertion Supabase :", error);
        alert("Impossible d'enregistrer l'écriture : " + error.message);
    } else {
        alert("Écriture enregistrée avec succès !");
        
        // Réinitialisation du formulaire
        document.getElementById('transaction-form').reset();
        document.getElementById('tx-date').valueAsDate = new Date();
        
        // Rafraîchissement de la liste des transactions
        loadTransactions();
    }
}

/**
 * Charge les transactions depuis la base de données Supabase et met à jour l'interface
 */
async function loadTransactions() {
    const statusElement = document.getElementById('connection-status');

    // Requête vers Supabase : Récupère toutes les transactions triées par date décroissante
    const { data: transactions, error } = await supabaseClient
        .from('transactions')
        .select('*')
        .order('date', { ascending: false });

    // En cas d'erreur de connexion ou de requête
    if (error) {
        console.error("Erreur de chargement des transactions :", error);
        if (statusElement) {
            statusElement.textContent = "Erreur Connexion";
            statusElement.style.background = "#fecaca";
            statusElement.style.color = "#991b1b";
        }
        return;
    }

    // Si la connexion réussit
    if (statusElement) {
        statusElement.textContent = "Connecté à Supabase";
        statusElement.style.background = "#dcfce7";
        statusElement.style.color = "#166534";
    }

    // Génération du tableau dans le HTML
    renderTransactionsTable(transactions);
}

/**
 * Construit le tableau HTML affichant la liste des écritures
 * @param {Array} transactions - La liste des objets transactions reçus de Supabase
 */
function renderTransactionsTable(transactions) {
    const tbody = document.getElementById('transactions-list');
    if (!tbody) return;

    tbody.innerHTML = '';

    // Si aucune transaction n'existe en base de données
    if (!transactions || transactions.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;">Aucune transaction enregistrée pour le moment.</td></tr>';
        return;
    }

    // Parcourir chaque transaction et générer sa ligne dans le tableau
    transactions.forEach(tx => {
        const tr = document.createElement('tr');

        // Génération du bouton/lien pour la pièce jointe
        let docHtml = '-';
        if (tx.file_path) {
            const fileUrl = getDocumentUrl(tx.file_path);
            docHtml = `<a href="${fileUrl}" target="_blank" class="btn-view-doc">📄 Voir</a>`;
        }

        // Formatage du montant (Vert pour Recette, Rouge pour Dépense)
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
 * Supprime une transaction spécifique de la base de données
 * @param {string|number} id - L'identifiant unique de la transaction à supprimer
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
