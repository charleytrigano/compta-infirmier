// ==========================================
// MODULE INDÉPENDANT : CARPIMKO
// ==========================================

window.initCarpimko = function() {
    var container = document.getElementById('carpimko-container');
    if (!container) return;

    // 1. Récupération des transactions
    var transactions = window.allTransactions || [];

    // 2. Filtrage des cotisations CARPIMKO
    var carpimkoOps = [];
    var totalCarpimko = 0;

    transactions.forEach(function(tx) {
        var cat = (tx.category || '').toLowerCase();
        if (cat.includes('carpimko')) {
            var montant = parseFloat(tx.amount) || 0;
            totalCarpimko += montant;
            carpimkoOps.push(tx);
        }
    });

    // 3. Tri des opérations CARPIMKO par date (du plus récent au plus ancien)
    carpimkoOps.sort(function(a, b) {
        return new Date(b.date) - new Date(a.date);
    });

    // 4. Construction du contenu HTML
    var html = `
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 15px; margin-bottom: 25px;">
            <div style="background: #f8fafc; padding: 18px; border-radius: 8px; border: 1px solid var(--border);">
                <span style="font-size: 12px; color: var(--text-muted); font-weight: 600; text-transform: uppercase;">Total Cotisations Payées</span>
                <p style="font-size: 24px; font-weight: bold; color: #ef4444; margin-top: 6px;">${totalCarpimko.toFixed(2)} €</p>
            </div>
            <div style="background: #f8fafc; padding: 18px; border-radius: 8px; border: 1px solid var(--border);">
                <span style="font-size: 12px; color: var(--text-muted); font-weight: 600; text-transform: uppercase;">Nombre de Versements</span>
                <p style="font-size: 24px; font-weight: bold; color: var(--primary); margin-top: 6px;">${carpimkoOps.length}</p>
            </div>
            <div style="background: #f8fafc; padding: 18px; border-radius: 8px; border: 1px solid var(--border);">
                <span style="font-size: 12px; color: var(--text-muted); font-weight: 600; text-transform: uppercase;">Régime Général</span>
                <p style="font-size: 16px; font-weight: bold; color: var(--success); margin-top: 10px;">Retraite & Prévoyance BNC</p>
            </div>
        </div>

        <div style="background: #ffffff; border: 1px solid var(--border); border-radius: 8px; padding: 18px; box-shadow: 0 1px 2px rgba(0,0,0,0.03);">
            <h4 style="font-size: 16px; margin-bottom: 15px; color: #0f172a;">📜 Historique des versements CARPIMKO</h4>
    `;

    if (carpimkoOps.length === 0) {
        html += `
            <div style="text-align: center; padding: 25px; color: var(--text-muted);">
                <p style="font-size: 14px;">Aucune cotisation CARPIMKO enregistrée pour le moment.</p>
                <p style="font-size: 12px; margin-top: 5px;">Ajoutez vos règlements dans l'onglet <strong>Transactions</strong> avec la catégorie "Cotisations CARPIMKO".</p>
            </div>
        `;
    } else {
        html += `
            <table style="width: 100%; border-collapse: collapse;">
                <thead>
                    <tr style="background-color: #f8fafc; border-bottom: 2px solid var(--border);">
                        <th style="padding: 10px; text-align: left; font-size: 13px;">Date</th>
                        <th style="padding: 10px; text-align: left; font-size: 13px;">Libellé / Description</th>
                        <th style="padding: 10px; text-align: right; font-size: 13px;">Montant Déduit (€)</th>
                    </tr>
                </thead>
                <tbody>
        `;

        carpimkoOps.forEach(function(op) {
            var montant = (parseFloat(op.amount) || 0).toFixed(2);
            html += `
                <tr style="border-bottom: 1px solid #f1f5f9;">
                    <td style="padding: 10px; font-size: 14px;">${op.date || ''}</td>
                    <td style="padding: 10px; font-size: 14px;">${op.description || 'Cotisation CARPIMKO'}</td>
                    <td style="padding: 10px; text-align: right; font-size: 14px; color: #ef4444; font-weight: 600;">${montant} €</td>
                </tr>
            `;
        });

        html += `
                </tbody>
                <tfoot>
                    <tr style="font-weight: bold; background-color: #f8fafc; border-top: 2px solid var(--border);">
                        <td colspan="2" style="padding: 12px; text-align: right; font-size: 13px;">Total déductible 2035 :</td>
                        <td style="padding: 12px; text-align: right; font-size: 14px; color: #ef4444;">${totalCarpimko.toFixed(2)} €</td>
                    </tr>
                </tfoot>
            </table>
        `;
    }

    html += `</div>`;
    container.innerHTML = html;
};
