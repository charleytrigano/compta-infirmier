// ==========================================
// GESTION DES TRANSACTIONS SUPABASE
// ==========================================

// Variable locale pour conserver la liste des transactions chargées
window.listeTransactions = [];

/**
 * 1. Charger les transactions depuis Supabase
 */
window.chargerTransactions = async function() {
    if (!window.supabaseClient) {
        console.error("❌ Supabase n'est pas initialisé.");
        return;
    }

    try {
        // Requête Supabase : Récupérer toutes les lignes triées par date décroissante
        const { data, error } = await window.supabaseClient
            .from('transactions')
            .select('*')
            .order('date', { ascending: false });

        if (error) throw error;

        window.listeTransactions = data || [];
        window.afficherTransactions(window.listeTransactions);
    } catch (err) {
        console.error("Erreur de chargement Supabase :", err.message);
    }
};

/**
 * 2. Afficher les transactions dans le tableau HTML
 */
window.afficherTransactions = function(transactions) {
    const tbody = document.getElementById('body-tableau-transactions');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (transactions.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align:center; color:#94a3b8; padding:20px;">
                    Aucune transaction enregistrée dans la base de données.
                </td>
            </tr>`;
        return;
    }

    transactions.forEach(tx => {
        const estRecette = (tx.type || '').toLowerCase() === 'recette';
        const montantFormate = Math.abs(parseFloat(tx.montant) || 0).toFixed(2);
        const couleurMontant = estRecette ? '#16a34a' : '#dc2626';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${tx.date || ''}</td>
            <td><strong>${tx.type || ''}</strong></td>
            <td>${tx.categorie || ''}</td>
            <td>${tx.description || ''}</td>
            <td style="font-weight: bold; color: ${couleurMontant};">
                ${estRecette ? '+' : '-'} ${montantFormate} €
            </td>
            <td>
                <button class="btn-edit" onclick="window.ouvrirModalModification('${tx.id}')">✏️ Modifier</button>
                <button class="btn-delete" onclick="window.supprimerTransaction('${tx.id}')">🗑️ Supprimer</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
};

/**
 * 3. Ajouter une transaction
 */
window.ajouterTransaction = async function() {
    const date = document.getElementById('tx-date').value;
    const type = document.getElementById('tx-type').value;
    const categorie = document.getElementById('tx-categorie').value;
    const description = document.getElementById('tx-description').value;
    const montantInput = parseFloat(document.getElementById('tx-montant').value) || 0;

    if (!date || !description || isNaN(montantInput)) {
        alert("Veuillez remplir tous les champs obligatoires (*).");
        return;
    }

    // Une dépense est stockée sous forme de montant négatif
    const montantFinal = type.toLowerCase() === 'dépense' ? -Math.abs(montantInput) : Math.abs(montantInput);

    try {
        const { error } = await window.supabaseClient
            .from('transactions')
            .insert([{
                date: date,
                type: type,
                categorie: categorie,
                description: description,
                montant: montantFinal
            }]);

        if (error) throw error;

        // Vider le formulaire
        document.getElementById('form-ajouter-transaction').reset();

        // Rafraîchir l'affichage
        await window.chargerTransactions();
    } catch (err) {
        console.error("Erreur lors de l'ajout :", err.message);
        alert("Impossible d'ajouter l'opération : " + err.message);
    }
};

/**
 * 4. Supprimer une transaction
 */
window.supprimerTransaction = async function(id) {
    if (!confirm("Voulez-vous vraiment supprimer cette ligne ?")) return;

    try {
        const { error } = await window.supabaseClient
            .from('transactions')
            .delete()
            .eq('id', id);

        if (error) throw error;

        await window.chargerTransactions();
    } catch (err) {
        console.error("Erreur de suppression :", err.message);
        alert("Impossible de supprimer : " + err.message);
    }
};

/**
 * 5. Ouvrir la modale d'édition pré-remplie
 */
window.ouvrirModalModification = function(id) {
    const tx = window.listeTransactions.find(t => t.id.toString() === id.toString());
    if (!tx) return;

    document.getElementById('edit-id').value = tx.id;
    document.getElementById('edit-date').value = tx.date || '';
    document.getElementById('edit-type').value = tx.type || 'Recette';
    document.getElementById('edit-categorie').value = tx.categorie || '';
    document.getElementById('edit-description').value = tx.description || '';
    document.getElementById('edit-montant').value = Math.abs(parseFloat(tx.montant) || 0);

    document.getElementById('modal-modifier').style.display = 'flex';
};

/**
 * 6. Enregistrer les modifications
 */
window.sauvegarderModification = async function() {
    const id = document.getElementById('edit-id').value;
    const date = document.getElementById('edit-date').value;
    const type = document.getElementById('edit-type').value;
    const categorie = document.getElementById('edit-categorie').value;
    const description = document.getElementById('edit-description').value;
    const montantInput = parseFloat(document.getElementById('edit-montant').value) || 0;

    const montantFinal = type.toLowerCase() === 'dépense' ? -Math.abs(montantInput) : Math.abs(montantInput);

    try {
        const { error } = await window.supabaseClient
            .from('transactions')
            .update({
                date: date,
                type: type,
                categorie: categorie,
                description: description,
                montant: montantFinal
            })
            .eq('id', id);

        if (error) throw error;

        window.fermerModal();
        await window.chargerTransactions();
    } catch (err) {
        console.error("Erreur de mise à jour :", err.message);
        alert("Erreur lors de la mise à jour : " + err.message);
    }
};

// Initialisation automatique au chargement du DOM
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(function() {
        if (window.supabaseClient) {
            window.chargerTransactions();
        }
    }, 300);
});
