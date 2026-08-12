// ==========================================
// MODULE : BILAN & COMPTE DE RÉSULTAT (bilan.js)
// ==========================================

window.initBilan = async function() {
    // 1. Ciblage de l'élément d'affichage dans la page
    var container = document.getElementById('bilan-container') || document.querySelector('.card, .container');
    
    // Si aucun conteneur dédié n'est trouvé, on cherche là où est écrit "Chargement du bilan..."
    if (!container) {
        var elements = document.querySelectorAll('div, section');
        elements.forEach(function(el) {
            if (el.textContent.includes('Chargement du bilan...')) {
                container = el;
            }
        });
    }

    if (!container) return;

    // 2. Récupération sécurisée des transactions
    var transactions = window.allTransactions || [];
    
    // Tentative facultative de récupération du plan comptable (avec gestion d'erreur)
    var planComptable = [];
    if (window.supabaseClient) {
        try {
            var response = await window.supabaseClient.from('plan_comptable').select('*');
            if (!response.error && response.data) {
                planComptable = response.data;
            }
        } catch (err) {
            console.warn("Note : Récupération du plan comptable ignorée, calcul sur les transactions.", err);
        }
    }

    // 3. Calcul des masse budgétaires (Recettes vs Charges)
    var totalRecettes = 0;
    var totalDepenses = 0;
    var categories = {};

    transactions.forEach(function(tx) {
        var montant = parseFloat(tx.amount) || 0;
        var type = (tx.type || '').toLowerCase();
        var cat = tx.category || 'Non catégorisé';

        if (type === 'recette' || montant > 0) {
            totalRecettes += Math.abs(montant);
        } else {
            var depense = Math.abs(montant);
            totalDepenses += depense;

            if (!categories[cat]) {
                categories[cat] = 0;
            }
            categories[cat] += depense;
        }
    });

    var resultatNet = totalRecettes - totalDepenses;

    // 4. Génération de l'interface HTML
    var htmlCategories = '';
    for (var nomCat in categories) {
        htmlCategories += `
            <tr>
                <td>${nomCat}</td>
                <td style="text-align: right; color: #dc2626; font-weight: 500;">-${categories[nomCat].toFixed(2)} €</td>
            </tr>
        `;
    }

    if (Object.keys(categories).length === 0) {
        htmlCategories = `<tr><td colspan="2" style="text-align:center; color:#94a3b8;">Aucune dépense enregistrée</td></tr>`;
    }

    container.innerHTML = `
        <style>
            .bilan-wrapper { font-family: system-ui, -apple-system, sans-serif; }
            .bilan-header { margin-bottom: 20px; }
            .bilan-header h2 { margin: 0 0 5px 0; color: #0f172a; font-size: 20px; }
            .bilan-header p { margin: 0; color: #64748b; font-size: 14px; }
            
            .bilan-grid-3 { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 15px; margin-bottom: 25px; }
            .bilan-kpi-card { background: #ffffff; padding: 18px; border-radius: 8px; border: 1px solid #e2e8f0; text-align: center; box-shadow: 0 1px 2px rgba(0,0,0,0.05); }
            .bilan-kpi-title { font-size: 13px; color: #64748b; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
            .bilan-kpi-value { font-size: 22px; font-weight: bold; margin-top: 6px; }

            .bilan-card { background: #ffffff; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0; margin-bottom: 20px; box-shadow: 0 1px 2px rgba(0,0,0,0.05); }
            .bilan-card h3 { margin-top: 0; color: #1e293b; border-bottom: 2px solid #3b82f6; padding-bottom: 8px; font-size: 16px; }

            .bilan-table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            .bilan-table th, .bilan-table td { padding: 10px 12px; border-bottom: 1px solid #f1f5f9; text-align: left; font-size: 14px; }
            .bilan-table th { background: #f8fafc; font-weight: 600; color: #475569; }
        </style>

        <div class="bilan-wrapper">
            <div class="bilan-header">
                <h2>📊 Bilan & Compte de Résultat</h2>
                <p>Synthèse financière issue de vos transactions enregistrées.</p>
            </div>

            <!-- CARTE DES INDICATEURS CLÉS (KPI) -->
            <div class="bilan-grid-3">
                <div class="bilan-kpi-card">
                    <div class="bilan-kpi-title">Recettes Encaissées</div>
                    <div class="bilan-kpi-value" style="color: #16a34a;">+${totalRecettes.toFixed(2)} €</div>
                </div>
                <div class="bilan-kpi-card">
                    <div class="bilan-kpi-title">Total des Dépenses</div>
                    <div class="bilan-kpi-value" style="color: #dc2626;">-${totalDepenses.toFixed(2)} €</div>
                </div>
                <div class="bilan-kpi-card">
                    <div class="bilan-kpi-title">Bénéfice Net (BNC)</div>
                    <div class="bilan-kpi-value" style="color: ${resultatNet >= 0 ? '#2563eb' : '#dc2626'};">
                        ${resultatNet.toFixed(2)} €
                    </div>
                </div>
            </div>

            <!-- COMPTE DE RÉSULTAT DÉTAILLÉ -->
            <div class="bilan-card">
                <h3>Détail des Charges par Poste</h3>
                <table class="bilan-table">
                    <thead>
                        <tr>
                            <th>Poste de Dépense / Catégorie</th>
                            <th style="text-align: right;">Montant Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${htmlCategories}
                        <tr style="background: #f8fafc; font-weight: bold;">
                            <td>TOTAL DES CHARGES DÉDUCTIBLES</td>
                            <td style="text-align: right; color: #dc2626;">-${totalDepenses.toFixed(2)} €</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    `;
};

// Exécution automatique si le DOM est déjà prêt
if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(window.initBilan, 100);
} else {
    document.addEventListener('DOMContentLoaded', window.initBilan);
}
