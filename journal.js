// ==========================================
// MODULE INDÉPENDANT : JOURNAL GÉNÉRAL
// ==========================================

window.initJournal = function() {
    var container = document.getElementById('journal-container');
    if (!container) return;

    // 1. Récupération des transactions
    var transactions = window.allTransactions || [];

    if (transactions.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 30px; color: var(--text-muted);">
                <p style="font-size: 16px;">📖 Aucune transaction disponible pour générer le Journal.</p>
                <p style="font-size: 13px; margin-top: 8px;">Ajoutez d'abord des opérations dans l'onglet <strong>Transactions</strong>.</p>
            </div>
        `;
        return;
    }

    // 2. Copie et tri des transactions par date (de la plus récente à la plus ancienne)
    var sortedTransactions = transactions.slice().sort(function(a, b) {
        return new Date(b.date) - new Date(a.date);
    });

    // 3. Calcul des totaux généraux
    var totalDebit = 0;
    var totalCredit = 0;

    sortedTransactions.forEach(function(tx) {
        var montant = parseFloat(tx.amount) || 0;
        var typeOp = (tx.type || '').toString().toLowerCase();

        if (typeOp.includes('recette')) {
            totalCredit += montant;
        } else {
            totalDebit += montant;
        }
    });

    // 4. Construction de l'interface HTML
    var html = `
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 20px;">
            <div style="background: #f8fafc; padding: 15px; border-radius: 8px; border: 1px solid var(--border);">
                <span style="font-size: 12px; color: var(--text-muted); font-weight: 600;">TOTAL DÉBITS (DÉPENSES)</span>
                <p style="font-size: 20px; font-weight: bold; color: #ef4444; margin-top: 4px;">${totalDebit.toFixed(2)} €</p>
            </div>
            <div style="background: #f8fafc; padding: 15px; border-radius: 8px; border: 1px solid var(--border);">
                <span style="font-size: 12px; color: var(--text-muted); font-weight: 600;">TOTAL CRÉDITS (RECETTES)</span>
                <p style="font-size: 20px; font-weight: bold; color: #10b981; margin-top: 4px;">${totalCredit.toFixed(2)} €</p>
            </div>
            <div style="background: #f8fafc; padding: 15px; border-radius: 8px; border: 1px solid var(--border);">
                <span style="font-size: 12px; color: var(--text-muted); font-weight: 600;">NOMBRE D'ÉCRITURES</span>
                <p style="font-size: 20px; font-weight: bold; color: var(--primary); margin-top: 4px;">${sortedTransactions.length}</p>
            </div>
        </div>

        <div style="background: #ffffff; border: 1px solid var(--border); border-radius: 8px; padding: 18px; box-shadow: 0 1px 2px rgba(0,0,0,0.03);">
            <table style="width: 100%; border-collapse: collapse;">
                <thead>
                    <tr style="background-color: #f8fafc; border-bottom: 2px solid var(--border);">
                        <th style="padding: 10px; text-align: left; font-size: 13px;">Date</th>
                        <th style="padding: 10px; text-align: left; font-size: 13px;">Compte / Catégorie</th>
                        <th style="padding: 10px; text-align: left; font-size: 13px;">Libellé / Description</th>
                        <th style="padding: 10px; text-align: right; font-size: 13px;">Débit (€)</th>
                        <th style="padding: 10px; text-align: right; font-size: 13px;">Crédit (€)</th>
                    </tr>
                </thead>
                <tbody>
    `;

    sortedTransactions.forEach(function(tx) {
        var montantVal = parseFloat(tx.amount) || 0;
        var montantFormatted = montantVal.toFixed(2) + ' €';
        var typeOp = (tx.type || '').toString().toLowerCase();
        var isRecette = typeOp.includes('recette');

        var debit = !isRecette ? montantFormatted : '-';
        var credit = isRecette ? montantFormatted : '-';

        html += `
            <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 10px; font-size: 14px; white-space: nowrap;">${tx.date || ''}</td>
                <td style="padding: 10px; font-size: 14px; font-weight: 500; color: #334155;">${tx.category || 'Non classé'}</td>
                <td style="padding: 10px; font-size: 14px;">${tx.description || ''}</td>
                <td style="padding: 10px; text-align: right; font-size: 14px; color: #ef4444; font-weight: 500;">${debit}</td>
                <td style="padding: 10px; text-align: right; font-size: 14px; color: #10b981; font-weight: 500;">${credit}</td>
            </tr>
        `;
    });

    html += `
                </tbody>
                <tfoot>
                    <tr style="font-weight: bold; background-color: #f8fafc; border-top: 2px solid var(--border);">
                        <td colspan="3" style="padding: 12px; text-align: right; font-size: 14px;">Totaux Généraux :</td>
                        <td style="padding: 12px; text-align: right; font-size: 14px; color: #ef4444;">${totalDebit.toFixed(2)} €</td>
                        <td style="padding: 12px; text-align: right; font-size: 14px; color: #10b981;">${totalCredit.toFixed(2)} €</td>
                    </tr>
                </tfoot>
            </table>
        </div>
    `;

    container.innerHTML = html;
};
