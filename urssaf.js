// ==========================================
// MODULE INDÉPENDANT : URSSAF
// ==========================================

window.initUrssaf = function() {
    var container = document.getElementById('urssaf-container');
    if (!container) return;

    // Calcul du total des cotisations URSSAF déjà saisies dans les transactions
    var totalPaye = 0;
    if (window.allTransactions && window.allTransactions.length > 0) {
        window.allTransactions.forEach(function(tx) {
            if (tx.category === 'Cotisations URSSAF') {
                totalPaye += parseFloat(tx.amount) || 0;
            }
        });
    }

    container.innerHTML = `
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-top: 10px;">
            <div style="background: #f1f5f9; padding: 15px; border-radius: 8px;">
                <span style="font-size: 12px; color: var(--text-muted); font-weight: 600;">COTISATIONS REGLEES (ANNÉE EN COURS)</span>
                <p style="font-size: 22px; font-weight: bold; color: var(--primary); margin-top: 5px;">${totalPaye.toFixed(2)} €</p>
            </div>
            <div style="background: #f1f5f9; padding: 15px; border-radius: 8px;">
                <span style="font-size: 12px; color: var(--text-muted); font-weight: 600;">STATUT FISCAL</span>
                <p style="font-size: 16px; font-weight: bold; color: var(--success); margin-top: 8px;">BNC Libéral Infirmier</p>
            </div>
        </div>
    `;
};