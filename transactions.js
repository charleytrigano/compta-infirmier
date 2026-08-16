/* ==========================================================================
   MODULE TRANSACTIONS & JOURNAL
   ========================================================================== */

window.transactions = window.transactions || [];

/**
 * Charge les transactions depuis Supabase
 */
window.chargerTransactions = async function() {
    try {
        if (window.supabaseClient) {
            const { data, error } = await window.supabaseClient
                .from('transactions')
                .select('*')
                .order('date', { ascending: false });

            if (error) {
                console.warn("Erreur Supabase :", error.message);
            } else if (data) {
                window.transactions = data;
            }
        }
    } catch (err) {
        console.error("Erreur lors du chargement des transactions :", err);
    } finally {
        window.afficherTransactions();
        window.afficherJournal();
    }
};

/**
 * Affiche la liste des transactions dans l'historique
 */
window.afficherTransactions = function() {
    var tbody = document.getElementById('body-tableau-transactions');
    if (!tbody) return;

    tbody.innerHTML = '';
    var liste = window.transactions || [];

    if (!Array.isArray(liste) || liste.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#64748b; padding:15px;">Aucune transaction enregistrée.</td></tr>';
        return;
    }

    liste.forEach(function(tx) {
        var tr = document.createElement('tr');

        // Normalisation du type (recette vs dépense)
        var typeRaw = (tx.type || '').toString().toLowerCase();
        var isRecette = typeRaw.includes('recette') || typeRaw.includes('encaissement');
        var typeLabel = isRecette ? 'Recette' : 'Dépense';

        // Correspondance avec 'category' ou 'categorie'
        var categorie = tx.category || tx.categorie || tx.categorie_libelle || tx.compte || '-';

        // Correspondance avec 'amount' ou 'montant'
        var valMontant = tx.amount !== undefined && tx.amount !== null ? tx.amount : 
                        (tx.montant !== undefined && tx.montant !== null ? tx.montant : 0);
        
        var montantFormatted = parseFloat(valMontant || 0).toFixed(2) + ' €';
        var classMontant = isRecette ? 'color:#16a34a; font-weight:600;' : 'color:#dc2626; font-weight:600;';

        tr.innerHTML = `
            <td>${tx.date || ''}</td>
            <td><span style="background-color:${isRecette ? '#dcfce7' : '#fee2e2'}; color:${isRecette ? '#15803d' : '#b91c1c'}; padding:2px 8px; border-radius:12px; font-size:12px; font-weight:600;">${typeLabel}</span></td>
            <td>${categorie}</td>
            <td>${tx.description || tx.libelle || ''}</td>
            <td style="${classMontant}">${montantFormatted}</td>
            <td>
                <button onclick="window.ouvrirModalModification('${tx.id}')" style="background:none; border:none; cursor:pointer; color:#2563eb; font-weight:500;">✏️ Modifier</button>
                <button onclick="window.supprimerTransaction('${tx.id}')" style="background:none; border:none; cursor:pointer; color:#dc2626; font-weight:500; margin-left:8px;">🗑️ Supprimer</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
};

/**
 * Ajoute une nouvelle transaction dans Supabase
 */
window.ajouterTransaction = async function() {
    var dateInput = document.getElementById('tx-date');
    var typeInput = document.getElementById('tx-type');
    var catInput = document.getElementById('tx-categorie');
    var descInput = document.getElementById('tx-description');
    var montantInput = document.getElementById('tx-montant');

    if (!dateInput || !typeInput || !catInput || !descInput || !montantInput) return;

    var valMontant = parseFloat(montantInput.value) || 0;

    var nouvelleTx = {
        date: dateInput.value,
        type: typeInput.value,
        category: catInput.value,
        categorie: catInput.value,
        description: descInput.value,
        amount: valMontant,
        montant: valMontant
    };

    if (window.supabaseClient) {
        try {
            const { data, error } = await window.supabaseClient
                .from('transactions')
                .insert([{
                    date: nouvelleTx.date,
                    type: nouvelleTx.type,
                    category: nouvelleTx.category,
                    description: nouvelleTx.description,
                    amount: nouvelleTx.amount
                }])
                .select();

            if (error) console.error("Erreur d'insertion Supabase :", error.message);
            else if (data && data[0]) nouvelleTx.id = data[0].id;
        } catch (e) {
            console.error("Exception Supabase :", e);
        }
    }

    if (!nouvelleTx.id) nouvelleTx.id = 'tx_' + Date.now();

    window.transactions.unshift(nouvelleTx);
    
    descInput.value = '';
    montantInput.value = '';

    window.afficherTransactions();
    window.afficherJournal();
    if (typeof window.afficherGrandLivre === 'function') window.afficherGrandLivre();
};

/**
 * Supprime une transaction par son ID
 */
window.supprimerTransaction = async function(id) {
    if (!confirm("Voulez-vous vraiment supprimer cette opération ?")) return;

    if (window.supabaseClient) {
        try {
            await window.supabaseClient.from('transactions').delete().eq('id', id);
        } catch (e) {
            console.error("Erreur de suppression Supabase :", e);
        }
    }

    window.transactions = window.transactions.filter(function(tx) { return tx.id !== id; });
    
    window.afficherTransactions();
    window.afficherJournal();
    if (typeof window.afficherGrandLivre === 'function') window.afficherGrandLivre();
};

/**
 * Ouvre la modale de modification
 */
window.ouvrirModalModification = function(id) {
    var tx = (window.transactions || []).find(function(t) { return t.id === id; });
    if (!tx) return;

    var valMontant = tx.amount !== undefined ? tx.amount : (tx.montant !== undefined ? tx.montant : 0);
    var valCat = tx.category || tx.categorie || tx.categorie_libelle || tx.compte || '';

    var elId = document.getElementById('edit-id');
    var elDate = document.getElementById('edit-date');
    var elType = document.getElementById('edit-type');
    var elCat = document.getElementById('edit-categorie');
    var elDesc = document.getElementById('edit-description');
    var elMontant = document.getElementById('edit-montant');

    if (elId) elId.value = tx.id;
    if (elDate) elDate.value = tx.date || '';
    if (elType) elType.value = (tx.type || '').toString().toLowerCase().includes('recette') ? 'Recette' : 'Dépense';
    if (elCat) elCat.value = valCat;
    if (elDesc) elDesc.value = tx.description || tx.libelle || '';
    if (elMontant) elMontant.value = valMontant;

    var modal = document.getElementById('modal-modifier');
    if (modal) modal.style.display = 'flex';
};

/**
 * Enregistre les modifications apportées via la modale
 */
window.sauvegarderModification = async function() {
    var id = document.getElementById('edit-id').value;
    var tx = (window.transactions || []).find(function(t) { return t.id === id; });
    if (!tx) return;

    var valMontant = parseFloat(document.getElementById('edit-montant').value) || 0;

    tx.date = document.getElementById('edit-date').value;
    tx.type = document.getElementById('edit-type').value;
    tx.category = document.getElementById('edit-categorie').value;
    tx.categorie = tx.category;
    tx.description = document.getElementById('edit-description').value;
    tx.amount = valMontant;
    tx.montant = valMontant;

    if (window.supabaseClient) {
        try {
            await window.supabaseClient.from('transactions').update({
                date: tx.date,
                type: tx.type,
                category: tx.category,
                description: tx.description,
                amount: tx.amount
            }).eq('id', id);
        } catch (e) {
            console.error("Erreur de mise à jour Supabase :", e);
        }
    }

    if (typeof window.fermerModal === 'function') window.fermerModal();
    else {
        var modal = document.getElementById('modal-modifier');
        if (modal) modal.style.display = 'none';
    }

    window.afficherTransactions();
    window.afficherJournal();
    if (typeof window.afficherGrandLivre === 'function') window.afficherGrandLivre();
};

/**
 * Affiche le Journal des écritures
 */
window.afficherJournal = function() {
    var tbody = document.getElementById('body-tableau-journal');
    if (!tbody) return;

    tbody.innerHTML = '';
    var listeTransactions = window.transactions || [];

    if (!Array.isArray(listeTransactions) || listeTransactions.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#64748b; padding:15px;">Aucune écriture enregistrée dans le journal.</td></tr>';
        return;
    }

    listeTransactions.forEach(function(tx) {
        var tr = document.createElement('tr');
        
        var typeRaw = (tx.type || '').toString().toLowerCase();
        var isRecette = typeRaw.includes('recette') || typeRaw.includes('encaissement');

        var valMontant = tx.amount !== undefined && tx.amount !== null ? tx.amount : 
                        (tx.montant !== undefined && tx.montant !== null ? tx.montant : 0);

        var valCat = tx.category || tx.categorie || tx.categorie_libelle || tx.compte || '-';
        var valDesc = tx.description || tx.libelle || '';

        var debit = !isRecette ? parseFloat(valMontant || 0).toFixed(2) + ' €' : '-';
        var credit = isRecette ? parseFloat(valMontant || 0).toFixed(2) + ' €' : '-';

        tr.innerHTML = `
            <td>${tx.date || ''}</td>
            <td>${valCat}</td>
            <td>${valDesc}</td>
            <td style="color:#dc2626; font-weight:500;">${debit}</td>
            <td style="color:#16a34a; font-weight:500;">${credit}</td>
            <td><span style="background:#dcfce7; color:#15803d; padding:2px 8px; border-radius:12px; font-size:12px; font-weight:600;">Validé</span></td>
        `;
        tbody.appendChild(tr);
    });
};
