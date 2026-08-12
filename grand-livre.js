// ==========================================
// MODULE INDÉPENDANT : GRAND LIVRE
// ==========================================

window.initGrandLivre = function() {
    var container = document.getElementById('grand-livre-container');
    if (!container) return;

    // 1. Récupération des transactions
    var transactions = window.allTransactions || [];

    if (transactions.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 30px; color: var(--text-muted);">
                <p style="font-size: 16px;">📖 Aucune transaction disponible pour générer le Grand Livre.</p>
                <p style="font-size: 13px; margin-top: 8px;">Ajoutez d'abord des opérations dans l'onglet <strong>Transactions</strong>.</p>
            </div>
        `;
        return;
    }

    // 2. Regroupement par catégorie
    var comptes = {};

    transactions.forEach(function(tx) {
        var categorie = tx.category || "Non classé";
        
        if (!comptes[categorie]) {
            comptes[categorie] = {
                nom: categorie,
                totalRecettes: 0,
                totalDepenses: 0,
                operations: []
            };
        }

        var montant = parseFloat(tx.amount) || 0;
        // Détection tolérante du type (majuscules/minuscules)
        var typeOp = (tx.type || '').toString().toLowerCase();

        if (typeOp.includes('recette')) {
            comptes[categorie].totalRecettes += montant;
        } else {
            comptes[categorie].totalDepenses += montant;
        }

        comptes[categorie].operations.push(tx);
    });

    // 3. Construction du HTML
    var html = `
        <div style="margin-bottom: 20px;">
            <p style="color: var(--text-muted); font-size: 14px;">
                Le Grand Livre détaille l'ensemble de vos écritures comptables regroupées par compte d'imputation.
            </p>
        </div>
    `;

    Object.keys(comptes).forEach(function(catKey) {
        var compte = comptes[catKey];
        var solde = compte.totalRecettes - compte.totalDepenses;
        var soldeColor = solde >= 0 ? '#10b981' : '#ef4444';
        var soldeTexte = solde >= 0 ? '+' + solde.toFixed(2) : solde.toFixed(2);

        html += `
            <div style="background: #ffffff; border: 1px solid var(--border); border-radius: 8px; padding: 18px; margin-bottom: 25px; box-shadow: 0 1px 2px rgba(0,0,0,0.03);">
                
                <!-- En-tête de compte -->
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; border-bottom: 2px solid #f1f5f9; padding-bottom: 10px;">
                    <h4 style="font-size: 16px; color: #0f172a; margin: 0;">
                        📁 Compte : <strong>${compte.nom}</strong>
                    </h4>
                    <span style="font-size: 14px; font-weight: bold; color: ${soldeColor}; background: #f8fafc; padding: 4px 10px; border-radius: 6px; border: 1px solid var(--border);">
                        Solde du compte : ${soldeTexte} €
                    </span>
                </div>

                <!-- Tableau du compte -->
                <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
                    <thead>
                        <tr style="background-color: #f8fafc; border-bottom: 1px solid var(--border);">
                            <th style="padding: 10px; text-align: left; font-size: 13px;">Date</th>
                            <th style="padding: 10px; text-align: left; font-size: 13px;">Description / Libellé</th>
                            <th style="padding: 10px; text-align: right; font-size: 13px;">Débit (Dépense)</th>
                            <th style="padding: 10px; text-align: right; font-size: 13px;">Crédit (Recette)</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        compte.operations.forEach(function(op) {
            var val = parseFloat(op.amount) || 0;
            var montantFormatted = val.toFixed(2) + ' €';
            var typeOp = (op.type || '').toString().toLowerCase();

            // Détection souple : Dépense vs Recette
            var isRecette = typeOp.includes('recette');
            
            var debit = !isRecette ? montantFormatted : '-';
            var credit = isRecette ? montantFormatted : '-';

            html += `
                <tr style="border-bottom: 1px solid #f1f5f9;">
                    <td style="padding: 10px; font-size: 14px;">${op.date || ''}</td>
                    <td style="padding: 10px; font-size: 14px;">${op.description || ''}</td>
                    <td style="padding: 10px; text-align: right; font-size: 14px; color: #ef4444; font-weight: 500;">${debit}</td>
                    <td style="padding: 10px; text-align: right; font-size: 14px; color: #10b981; font-weight: 500;">${credit}</td>
                </tr>
            `;
        });

        html += `
                    </tbody>
                    <tfoot>
                        <tr style="font-weight: bold; background-color: #f8fafc; border-top: 2px solid var(--border);">
                            <td colspan="2" style="padding: 10px; text-align: right; font-size: 13px;">Totaux du compte :</td>
                            <td style="padding: 10px; text-align: right; font-size: 14px; color: #ef4444;">${compte.totalDepenses.toFixed(2)} €</td>
                            <td style="padding: 10px; text-align: right; font-size: 14px; color: #10b981;">${compte.totalRecettes.toFixed(2)} €</td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        `;
    });

    container.innerHTML = html;
};
