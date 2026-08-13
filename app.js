// ==========================================
// MODULE DE MODIFICATION DES TRANSACTIONS
// ==========================================

// 1. Fonction d'injection du bouton Modifier dans le tableau de l'historique
window.afficherHistoriqueTransactions = function(transactions) {
    var tbody = document.querySelector('#tableau-transactions tbody') || document.querySelector('tbody');
    if (!tbody) return;

    tbody.innerHTML = '';

    transactions.forEach(function(tx, index) {
        var txId = tx.id || index;
        var estRecette = (tx.type || '').toLowerCase() === 'recette' || parseFloat(tx.montant || tx.amount) > 0;
        var montantVal = Math.abs(parseFloat(tx.montant || tx.amount) || 0).toFixed(2);

        var tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${tx.date || ''}</td>
            <td><strong>${tx.type || (estRecette ? 'recette' : 'depense')}</strong></td>
            <td>${tx.categorie || tx.category || ''}</td>
            <td>${tx.description || tx.label || ''}</td>
            <td style="font-weight: bold; color: ${estRecette ? '#16a34a' : '#dc2626'};">
                ${montantVal} €
            </td>
            <td>
                <button class="btn-edit-tx" onclick="window.ouvrirModalModification('${txId}')">Modifier</button>
                <button class="btn-delete-tx" onclick="window.supprimerTransaction('${txId}')">Supprimer</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
};

// 2. Modale de modification générée dynamiquement
window.creerModalEditionSiInexistante = function() {
    if (document.getElementById('modal-edit-transaction')) return;

    var modalHtml = `
        <div id="modal-edit-transaction" class="modal-tx-overlay">
            <div class="modal-tx-content">
                <h3 style="margin-top:0; color:#1e293b;">✏️ Modifier l'opération</h3>
                <input type="hidden" id="edit-tx-id">

                <div class="form-group-tx">
                    <label>Date *</label>
                    <input type="date" id="edit-tx-date" class="input-tx">
                </div>

                <div class="form-group-tx">
                    <label>Type *</label>
                    <select id="edit-tx-type" class="input-tx">
                        <option value="recette">Recette</option>
                        <option value="depense">Dépense</option>
                    </select>
                </div>

                <div class="form-group-tx">
                    <label>Catégorie *</label>
                    <input type="text" id="edit-tx-cat" class="input-tx" placeholder="ex: Soins infirmiers, CARPIMKO, URSSAF...">
                </div>

                <div class="form-group-tx">
                    <label>Description *</label>
                    <input type="text" id="edit-tx-desc" class="input-tx" placeholder="ex: Patient X, Acompte...">
                </div>

                <div class="form-group-tx">
                    <label>Montant (€) *</label>
                    <input type="number" step="0.01" id="edit-tx-montant" class="input-tx">
                </div>

                <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:20px;">
                    <button type="button" class="btn-cancel-tx" onclick="window.fermerModalModification()">Annuler</button>
                    <button type="button" class="btn-save-tx" onclick="window.enregistrerModificationTransaction()">💾 Enregistrer</button>
                </div>
            </div>
        </div>

        <style>
            .btn-edit-tx { background-color: #2563eb; color: white; border: none; padding: 6px 12px; border-radius: 4px; font-weight: 600; cursor: pointer; margin-right: 5px; }
            .btn-delete-tx { background-color: #ef4444; color: white; border: none; padding: 6px 12px; border-radius: 4px; font-weight: 600; cursor: pointer; }
            
            .modal-tx-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: none; justify-content: center; align-items: center; z-index: 10000; }
            .modal-tx-content { background: white; padding: 25px; border-radius: 8px; width: 450px; max-width: 90%; box-shadow: 0 10px 25px rgba(0,0,0,0.3); font-family: system-ui, sans-serif; }
            .form-group-tx { margin-bottom: 12px; }
            .form-group-tx label { display: block; font-size: 13px; font-weight: bold; color: #475569; margin-bottom: 4px; }
            .input-tx { width: 100%; padding: 8px; border: 1px solid #cbd5e1; border-radius: 4px; box-sizing: border-box; }
            .btn-cancel-tx { background: #cbd5e1; color: #334155; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-weight: bold; }
            .btn-save-tx { background: #2563eb; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-weight: bold; }
        </style>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
};

// 3. Ouvrir la modale pré-remplie
window.ouvrirModalModification = function(txId) {
    window.creerModalEditionSiInexistante();

    var list = window.allTransactions || [];
    var tx = list.find(t => (t.id || '').toString() === txId.toString());

    if (!tx) return;

    document.getElementById('edit-tx-id').value = txId;
    document.getElementById('edit-tx-date').value = tx.date || '';
    document.getElementById('edit-tx-type').value = (tx.type || '').toLowerCase();
    document.getElementById('edit-tx-cat').value = tx.categorie || tx.category || '';
    document.getElementById('edit-tx-desc').value = tx.description || tx.label || '';
    document.getElementById('edit-tx-montant').value = Math.abs(parseFloat(tx.montant || tx.amount) || 0);

    document.getElementById('modal-edit-transaction').style.display = 'flex';
};

// 4. Fermer la modale
window.fermerModalModification = function() {
    var modal = document.getElementById('modal-edit-transaction');
    if (modal) modal.style.display = 'none';
};

// 5. Sauvegarder les modifications dans le tableau et Supabase/LocalStorage
window.enregistrerModificationTransaction = async function() {
    var txId = document.getElementById('edit-tx-id').value;
    var nouvelleDate = document.getElementById('edit-tx-date').value;
    var nouveauType = document.getElementById('edit-tx-type').value;
    var nouvelleCat = document.getElementById('edit-tx-cat').value;
    var nouvelleDesc = document.getElementById('edit-tx-desc').value;
    var nouveauMontant = parseFloat(document.getElementById('edit-tx-montant').value) || 0;

    var list = window.allTransactions || [];
    var tx = list.find(t => (t.id || '').toString() === txId.toString());

    if (tx) {
        tx.date = nouvelleDate;
        tx.type = nouveauType;
        tx.categorie = nouvelleCat;
        tx.category = nouvelleCat;
        tx.description = nouvelleDesc;
        tx.label = nouvelleDesc;
        tx.montant = nouveauMontant;
        tx.amount = (nouveauType === 'depense') ? -Math.abs(nouveauMontant) : Math.abs(nouveauMontant);

        // Sauvegarde Locale
        localStorage.setItem('allTransactions', JSON.stringify(window.allTransactions));

        // Si Supabase est connecté, mettre à jour dans la base
        if (window.supabaseClient) {
            try {
                await window.supabaseClient
                    .from('transactions')
                    .update({
                        date: tx.date,
                        type: tx.type,
                        categorie: tx.categorie,
                        description: tx.description,
                        montant: tx.montant
                    })
                    .eq('id', txId);
            } catch (e) {
                console.log("Mise à jour Supabase :", e);
            }
        }

        window.fermerModalModification();

        // Rafraîchir les affichages
        if (typeof window.afficherHistoriqueTransactions === 'function') {
            window.afficherHistoriqueTransactions(window.allTransactions);
        } else {
            location.reload();
        }
    }
};
