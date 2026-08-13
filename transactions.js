// ==========================================
// COMPTABILITÉ LIBÉRALE - TRANSACTIONS
// Fichier complet : Gestion des opérations
// ==========================================

window.listeTransactions = [];

// ------------------------------------------
// 1. CHARGEMENT ET SAISIE
// ------------------------------------------
window.chargerTransactions = async function() {
    if (!window.supabaseClient) return;

    try {
        const { data, error } = await window.supabaseClient
            .from('transactions')
            .select('*')
            .order('date', { ascending: false });

        if (error) throw error;

        window.listeTransactions = data || [];
        window.afficherTransactions();

    } catch (err) {
        console.error("Erreur chargement transactions :", err.message);
    }
};

let verrouEnregistrement = false;

window.ajouterTransaction = async function(event) {
    if (event) event.preventDefault();

    if (verrouEnregistrement) return;

    const inputDate = document.getElementById('date_transaction');
    const inputDesc = document.getElementById('description');
    const inputMontant = document.getElementById('montant');
    const selectType = document.getElementById('type_transaction');
    const selectCat = document.getElementById('categorie');

    const dateVal = inputDate ? inputDate.value : '';
    const descVal = inputDesc ? inputDesc.value.trim() : '';
    const montantVal = inputMontant ? parseFloat(inputMontant.value) : 0;
    const typeVal = selectType ? selectType.value : 'recette';
    const catVal = selectCat ? selectCat.value : 'Divers';

    if (!dateVal || isNaN(montantVal) || montantVal === 0 || !descVal) {
        alert("⚠️ Veuillez remplir tous les champs obligatoires (Date, Description, Montant).");
        return;
    }

    verrouEnregistrement = true;

    const nouvelleTransaction = {
        date: dateVal,
        description: descVal,
        amount: montantVal,
        type: typeVal,
        category: catVal,
        encaisse: true
    };

    try {
        if (window.supabaseClient) {
            const { error } = await window.supabaseClient
                .from('transactions')
                .insert([nouvelleTransaction]);

            if (error) throw error;
        }

        if (inputDesc) inputDesc.value = '';
        if (inputMontant) inputMontant.value = '';

        await window.chargerTransactions();

    } catch (err) {
        alert("Erreur d'enregistrement : " + err.message);
    } finally {
        verrouEnregistrement = false;
    }
};

// ------------------------------------------
// 2. AFFICHAGE DE L'HISTORIQUE
// ------------------------------------------
window.afficherTransactions = function() {
    const tbody = document.getElementById('body-tableau-transactions');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (window.listeTransactions.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:#94a3b8; padding:20px;">Aucune transaction enregistrée.</td></tr>`;
        return;
    }

    window.listeTransactions.forEach(tx => {
        const estRecette = (tx.type || '').toLowerCase() === 'recette';
        const montant = Math.abs(parseFloat(tx.amount) || 0).toFixed(2);

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${tx.date || ''}</td>
            <td><strong>${tx.description || '-'}</strong></td>
            <td>${tx.category || 'Divers'}</td>
            <td>
                <span class="${estRecette ? 'badge-recette' : 'badge-depense'}">
                    ${estRecette ? 'Recette' : 'Dépense'}
                </span>
            </td>
            <td style="font-weight:bold; color:${estRecette ? '#16a34a' : '#dc2626'};">
                ${estRecette ? '+' : '-'} ${montant} €
            </td>
            <td>
                <button style="background:none; border:none; cursor:pointer;" onclick="window.supprimerTransaction('${tx.id}')">🗑️</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
};

// ------------------------------------------
// 3. SUPPRESSION
// ------------------------------------------
window.supprimerTransaction = async function(id) {
    if (!confirm("Voulez-vous vraiment supprimer cette transaction ?")) return;

    try {
        if (window.supabaseClient) {
            const { error } = await window.supabaseClient
                .from('transactions')
                .delete()
                .eq('id', id);

            if (error) throw error;
        }

        await window.chargerTransactions();
    } catch (err) {
        alert("Erreur de suppression : " + err.message);
    }
};

// Chargement automatique au démarrage
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(window.chargerTransactions, 300);
});
