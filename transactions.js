// ==========================================
// GESTION DES TRANSACTIONS (SUPABASE)
// ==========================================

window.listeTransactions = [];

// ------------------------------------------
// 1. CHARGER LES TRANSACTIONS
// ------------------------------------------
window.chargerTransactions = async function() {
    if (!window.supabaseClient) {
        console.error("❌ Supabase n'est pas prêt.");
        return;
    }

    try {
        const { data, error } = await window.supabaseClient
            .from('transactions')
            .select('*')
            .order('date', { ascending: false });

        if (error) throw error;

        window.listeTransactions = data || [];
        window.afficherTransactions(window.listeTransactions);
    } catch (err) {
        console.error("Erreur lors de la récupération des transactions :", err.message);
    }
};

// ------------------------------------------
// 2. AFFICHER LES TRANSACTIONS DANS LE TABLEAU
// ------------------------------------------
window.afficherTransactions = function(transactions) {
    const tbody = document.getElementById('body-tableau-transactions');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (transactions.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:#94a3b8; padding:20px;">Aucune transaction enregistrée.</td></tr>`;
        return;
    }

    transactions.forEach(tx => {
        // 1. Gestion du Type (Recette / Dépense)
        const typeBrut = (tx.type || '').toString().toLowerCase();
        const estRecette = typeBrut === 'recette';
        const typeAffiche = estRecette ? 'Recette' : 'Dépense';

        // 2. Gestion et nettoyage du Montant (conversion des virgules éventuelles)
        let valeurMontant = tx.montant !== undefined ? tx.montant : (tx.amount || 0);
        if (typeof valeurMontant === 'string') {
            valeurMontant = valeurMontant.replace(',', '.');
        }
        const montantNumerique = parseFloat(valeurMontant) || 0;
        const montantFormate = Math.abs(montantNumerique).toFixed(2);
        const couleurMontant = estRecette ? '#16a34a' : '#dc2626';

        // 3. Gestion de la Catégorie
        const categorieAffichee = tx.categorie || tx.category || '-';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${tx.date || ''}</td>
            <td><strong>${typeAffiche}</strong></td>
            <td>${categorieAffichee}</td>
            <td>${tx.description || tx.libelle || ''}</td>
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

// ------------------------------------------
// 3. AJOUTER UNE TRANSACTION
// ------------------------------------------
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

        document.getElementById('form-ajouter-transaction').reset();
        await window.chargerTransactions();
    } catch (err) {
        console.error("Erreur d'ajout dans Supabase :", err.message);
        alert("Erreur lors de l'enregistrement : " + err.message);
    }
};

// ------------------------------------------
// 4. SUPPRIMER UNE TRANSACTION
// ------------------------------------------
window.supprimerTransaction = async function(id) {
    if (!confirm("Voulez-vous vraiment supprimer cette transaction ?")) return;

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

// ------------------------------------------
// 5. OUVRIR LA MODALE DE MODIFICATION
// ------------------------------------------
window.ouvrirModalModification = function(id) {
    const tx = window.listeTransactions.find(t => t.id.toString() === id.toString());
    if (!tx) return;

    document.getElementById('edit-id').value = tx.id;
    document.getElementById('edit-date').value = tx.date || '';
    document.getElementById('edit-type').value = tx.type || 'Recette';
    document.getElementById('edit-categorie').value = tx.categorie || tx.category || '';
    document.getElementById('edit-description').value = tx.description || tx.libelle || '';
    
    let montantBrut = tx.montant !== undefined ? tx.montant : (tx.amount || 0);
    if (typeof montantBrut === 'string') montantBrut = montantBrut.replace(',', '.');
    document.getElementById('edit-montant').value = Math.abs(parseFloat(montantBrut) || 0);

    document.getElementById('modal-modifier').style.display = 'flex';
};

// ------------------------------------------
// 6. SAUVEGARDER LA MODIFICATION
// ------------------------------------------
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
        alert("Erreur lors de la modification : " + err.message);
    }
};

// Initialisation au chargement de la page
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(function() {
        if (window.supabaseClient) {
            window.chargerTransactions();
        }
    }, 300);
});
