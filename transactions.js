// ==========================================
// MODULE : JOURNAL ET GESTION DES TRANSACTIONS
// ==========================================

// Initialisation au chargement de la page
window.initTransactions = function() {
    var container = document.getElementById('transactions-container') || 
                    document.getElementById('view-transactions') || 
                    document.querySelector('.transactions-view');

    if (!container) {
        var elements = document.querySelectorAll('div, section');
        elements.forEach(function(el) {
            if (el.textContent.includes('Transactions') && !el.textContent.includes('Grand Livre')) {
                container = el;
            }
        });
    }

    if (!container) return;

    window.afficherModuleTransactions(container);
};

// Affichage principal du journal des transactions
window.afficherModuleTransactions = function(container) {
    var transactions = window.allTransactions || [];

    var rowsHtml = transactions.map(function(tx, index) {
        var txId = tx.id || ('tx-' + index);
        var montant = parseFloat(tx.amount) || 0;
        var estRecette = tx.type === 'recette' || montant > 0;
        var montantAbs = Math.abs(montant).toFixed(2);
        var categorie = tx.categorie || tx.category || 'Non classé';
        var description = tx.label || tx.description || tx.libelle || 'Sans description';
        var dateOp = tx.date || '-';

        return `
            <tr>
                <td>${dateOp}</td>
                <td><span class="tx-badge-cat">${categorie}</span></td>
                <td><strong>${description}</strong></td>
                <td><span class="${estRecette ? 'tx-type-recette' : 'tx-type-depense'}">${estRecette ? 'Recette' : 'Dépense'}</span></td>
                <td style="text-align:right; font-weight:bold; color: ${estRecette ? '#16a34a' : '#dc2626'};">
                    ${estRecette ? '+' : '-'}${montantAbs} €
                </td>
                <td style="text-align:center;">
                    <button class="btn-tx-edit" onclick="window.ouvrirModalEditTx('${txId}')">✏️ Modifier</button>
                    <button class="btn-tx-del" onclick="window.supprimerTx('${txId}')">🗑️</button>
                </td>
            </tr>
        `;
    }).join('');

    container.innerHTML = `
        <style>
            .tx-box { font-family: system-ui, -apple-system, sans-serif; }
            .tx-card { background: #ffffff; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0; margin-bottom: 20px; box-shadow: 0 1px 2px rgba(0,0,0,0.05); }
            .tx-table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 14px; }
            .tx-table th, .tx-table td { padding: 12px 10px; border-bottom: 1px solid #f1f5f9; text-align: left; }
            .tx-table th { background: #f8fafc; color: #475569; font-weight: 600; }
            
            .tx-badge-cat { background: #f1f5f9; color: #334155; padding: 3px 8px; border-radius: 6px; font-size: 12px; font-weight: 500; }
            .tx-type-recette { background: #dcfce7; color: #15803d; padding: 3px 8px; border-radius: 6px; font-size: 12px; font-weight: 600; }
            .tx-type-depense { background: #fee2e2; color: #b91c1c; padding: 3px 8px; border-radius: 6px; font-size: 12px; font-weight: 600; }
            
            .btn-tx-edit { background: #eab308; color: white; border: none; padding: 5px 10px; border-radius: 4px; font-weight: 600; cursor: pointer; font-size: 12px; }
            .btn-tx-del { background: #ef4444; color: white; border: none; padding: 5px 8px; border-radius: 4px; font-weight: 600; cursor: pointer; font-size: 12px; margin-left: 4px; }
            
            /* Fenêtre modale */
            .tx-modal-overlay { position: fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); display:none; justify-content:center; align-items:center; z-index:9999; }
            .tx-modal-content { background:#fff; padding:25px; border-radius:8px; width:420px; max-width:90%; box-shadow:0 10px 25px rgba(0,0,0,0.2); }
            .tx-modal-group { margin-bottom: 15px; }
            .tx-modal-group label { display:block; font-weight:bold; margin-bottom:5px; font-size:13px; color:#334155; }
            .tx-modal-group input, .tx-modal-group select { width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:4px; box-sizing:border-box; }
        </style>

        <div class="tx-box">
            <div class="tx-card">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <h2 style="margin:0;">📋 Journal des Transactions</h2>
                    <span style="color:#64748b; font-size:14px;">Total : <strong>${transactions.length}</strong> opération(s)</span>
                </div>

                <table class="tx-table">
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Catégorie</th>
                            <th>Description</th>
                            <th>Type</th>
                            <th style="text-align:right;">Montant</th>
                            <th style="text-align:center;">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsHtml || '<tr><td colspan="6" style="text-align:center; color:#94a3b8; padding:20px;">Aucune transaction enregistrée.</td></tr>'}
                    </tbody>
                </table>
            </div>
        </div>

        <!-- FENÊTRE MODALE D'ÉDITION -->
        <div id="tx-modal-edit" class="tx-modal-overlay">
            <div class="tx-modal-content">
                <h3 style="margin-top:0; color:#1e293b;">✏️ Modifier la Transaction</h3>
                <input type="hidden" id="tx-edit-id">

                <div class="tx-modal-group">
                    <label for="tx-edit-type">Type d'opération :</label>
                    <select id="tx-edit-type">
                        <option value="depense">🔴 Dépense</option>
                        <option value="recette">🟢 Recette</option>
                    </select>
                </div>

                <div class="tx-modal-group">
                    <label for="tx-edit-date">Date :</label>
                    <input type="date" id="tx-edit-date">
                </div>

                <div class="tx-modal-group">
                    <label for="tx-edit-cat">Catégorie :</label>
                    <input type="text" id="tx-edit-cat" placeholder="ex: URSSAF, CARPIMKO, Honoraires, Materiel...">
                </div>

                <div class="tx-modal-group">
                    <label for="tx-edit-label">Description / Libellé :</label>
                    <input type="text" id="tx-edit-label" placeholder="ex: Paiement matériel de soin">
                </div>

                <div class="tx-modal-group">
                    <label for="tx-edit-amount">Montant (€) :</label>
                    <input type="number" step="0.01" id="tx-edit-amount">
                </div>

                <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:20px;">
                    <button style="background:#f1f5f9; border:none; padding:8px 16px; border-radius:6px; cursor:pointer; font-weight:600;" onclick="window.fermerModalEditTx()">Annuler</button>
                    <button style="background:#16a34a; color:white; border:none; padding:8px 16px; border-radius:6px; cursor:pointer; font-weight:600;" onclick="window.sauvegarderTx()">💾 Enregistrer</button>
                </div>
            </div>
        </div>
    `;
};

// ==========================================
// FONCTIONS DE GESTION DE LA MODALE & DÉLÉGATION
// ==========================================

window.ouvrirModalEditTx = function(txId) {
    var transactions = window.allTransactions || [];
    var tx = transactions.find(function(t, idx) {
        return (t.id || ('tx-' + idx)) === txId;
    });

    if (!tx) return;

    var montant = parseFloat(tx.amount) || 0;
    var estRecette = tx.type === 'recette' || montant > 0;

    document.getElementById('tx-edit-id').value = txId;
    document.getElementById('tx-edit-type').value = estRecette ? 'recette' : 'depense';
    document.getElementById('tx-edit-date').value = tx.date || '';
    document.getElementById('tx-edit-cat').value = tx.categorie || tx.category || '';
    document.getElementById('tx-edit-label').value = tx.label || tx.description || tx.libelle || '';
    document.getElementById('tx-edit-amount').value = Math.abs(montant);

    document.getElementById('tx-modal-edit').style.display = 'flex';
};

window.fermerModalEditTx = function() {
    var modal = document.getElementById('tx-modal-edit');
    if (modal) modal.style.display = 'none';
};

window.sauvegarderTx = function() {
    var txId = document.getElementById('tx-edit-id').value;
    var typeOp = document.getElementById('tx-edit-type').value;
    var nouvelleDate = document.getElementById('tx-edit-date').value;
    var nouvelleCat = document.getElementById('tx-edit-cat').value;
    var nouveauLabel = document.getElementById('tx-edit-label').value;
    var nouveauMontant = parseFloat(document.getElementById('tx-edit-amount').value) || 0;

    var transactions = window.allTransactions || [];
    var tx = transactions.find(function(t, idx) {
        return (t.id || ('tx-' + idx)) === txId;
    });

    if (tx) {
        tx.type = typeOp;
        tx.date = nouvelleDate;
        tx.categorie = nouvelleCat;
        tx.category = nouvelleCat;
        tx.label = nouveauLabel;
        tx.description = nouveauLabel;
        tx.amount = (typeOp === 'depense') ? -Math.abs(nouveauMontant) : Math.abs(nouveauMontant);

        // Sauvegarde locale
        localStorage.setItem('allTransactions', JSON.stringify(window.allTransactions));

        window.fermerModalEditTx();

        // Rafraîchissement global de toutes les vues
        window.refreshToutesLesVues();
    }
};

window.supprimerTx = function(txId) {
    if (!confirm("Es-tu sûr(e) de vouloir supprimer cette transaction ?")) return;

    window.allTransactions = (window.allTransactions || []).filter(function(t, idx) {
        return (t.id || ('tx-' + idx)) !== txId;
    });

    localStorage.setItem('allTransactions', JSON.stringify(window.allTransactions));
    window.refreshToutesLesVues();
};

// Fonction universelle pour rafraîchir toutes les vues comptables simultanément
window.refreshToutesLesVues = function() {
    if (typeof window.initTransactions === 'function') window.initTransactions();
    if (typeof window.initJournal === 'function') window.initJournal();
    if (typeof window.initGrandLivre === 'function') window.initGrandLivre();
};

if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(window.initTransactions, 100);
} else {
    document.addEventListener('DOMContentLoaded', window.initTransactions);
}
