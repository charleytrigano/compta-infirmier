// ==========================================
// COMPTABILITÉ LIBÉRALE - MODULE DÉCLARATION FISCALE 2035
// Fichier : declaration2035.js
// ==========================================

// Configuration des lignes officielles du Cerfa 2035 BNC
const STRUCTURE_2035 = {
    recettes: [
        { ligne: '1', code: 'AA', libelle: 'Honoraires encaissés (y compris dépassements)', comptes: ['706000'] },
        { ligne: '3', code: 'AC', libelle: 'Remboursements de frais et débours', comptes: ['708000'] },
        { ligne: '5', code: 'AF', libelle: 'Gain sur cessions d’éléments d’actif', comptes: ['770000'] }
    ],
    depenses: [
        { ligne: '8', code: 'BA', libelle: 'Achats et petit matériel médical', comptes: ['606300'] },
        { ligne: '9', code: 'BB', libelle: 'Fournitures de bureau, documentation, PT', comptes: ['606400'] },
        { ligne: '11', code: 'BT', libelle: 'Loyer professionnel et charges locatives', comptes: ['613200'] },
        { ligne: '14', code: 'BV', libelle: 'Assurances (RCP, locaux, véhicules)', comptes: ['616000'] },
        { ligne: '15', code: 'BW', libelle: 'Cotisations sociales obligatoires : CARPIMKO', comptes: ['645200'] },
        { ligne: '16', code: 'BX', libelle: 'Cotisations sociales obligatoires : URSSAF', comptes: ['645100'] },
        { ligne: '19', code: 'CA', libelle: 'Frais de déplacement, carburant et transports', comptes: ['625100'] },
        { ligne: '22', code: 'CC', libelle: 'Honoraires ne constituant pas des rétrocessions (Comptable, Logiciel)', comptes: ['622600'] },
        { ligne: '25', code: 'CF', libelle: 'Frais financiers et frais bancaires', comptes: ['627000'] },
        { ligne: '26', code: 'CG', libelle: 'Diverses dépenses à déduire', comptes: ['658000'] }
    ]
};

// Fonction d'affichage du formulaire 2035
window.afficherDeclaration2035 = function() {
    const conteneur = document.getElementById('conteneur-2035');
    if (!conteneur) return;

    const transactions = window.listeTransactions || [];
    const planComptable = window.listePlanComptable || [];

    let totalRecettes = 0;
    let totalDepenses = 0;

    // Helper pour calculer le montant d'une ligne 2035
    const calculerMontantLigne = (comptesCibles, esRecette) => {
        let totalLigne = 0;

        transactions.forEach(tx => {
            const typeOp = (tx.type || '').toLowerCase();
            const estTxRecette = typeOp === 'recette' || typeOp === 'recettes';

            if (estTxRecette === esRecette) {
                const categorie = tx.category || tx.categorie || '';
                const compteTrouve = planComptable.find(c => c.nom === categorie);
                const codeCompte = compteTrouve ? compteTrouve.code : '';

                if (comptesCibles.includes(codeCompte)) {
                    totalLigne += Math.abs(parseFloat(tx.amount || tx.montant) || 0);
                }
            }
        });

        return totalLigne;
    };

    // --- GENERATION DU HTML ---
    let html = `
        <div style="background:#ffffff; border:1px solid #cbd5e1; border-radius:8px; padding:24px; box-shadow:0 2px 4px rgba(0,0,0,0.05);">
            
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid #2563eb; padding-bottom:12px; margin-bottom:20px;">
                <div>
                    <h3 style="margin:0; color:#0f172a; font-size:1.25rem;">📑 Déclaration des Bénéfices Non Commerciaux (2035)</h3>
                    <span style="color:#64748b; font-size:0.875rem;">Régime de la déclaration contrôlée - Année fiscale en cours</span>
                </div>
                <button onclick="window.print()" class="btn-primary" style="background:#475569;">🖨️ Imprimer la 2035</button>
            </div>

            <!-- TABLEAU RECETTES -->
            <h4 style="color:#15803d; margin-bottom:10px;">I. RECETTES BRUTES</h4>
            <table style="width:100%; border-collapse:collapse; margin-bottom:25px;">
                <thead>
                    <tr style="background:#f0fdf4; color:#166534; text-align:left;">
                        <th style="padding:10px; border-bottom:2px solid #bbf7d0; width:80px;">Ligne</th>
                        <th style="padding:10px; border-bottom:2px solid #bbf7d0; width:70px;">Code</th>
                        <th style="padding:10px; border-bottom:2px solid #bbf7d0;">Intitulé de la rubrique fiscale</th>
                        <th style="padding:10px; border-bottom:2px solid #bbf7d0; text-align:right;">Montant (€)</th>
                    </tr>
                </thead>
                <tbody>
    `;

    STRUCTURE_2035.recettes.forEach(item => {
        const montantLigne = calculerMontantLigne(item.comptes, true);
        totalRecettes += montantLigne;

        html += `
            <tr style="border-bottom:1px solid #f1f5f9;">
                <td style="padding:10px; font-weight:bold; color:#475569;">${item.ligne}</td>
                <td style="padding:10px; font-weight:bold; color:#15803d;">${item.code}</td>
                <td style="padding:10px;">${item.libelle}</td>
                <td style="padding:10px; text-align:right; font-weight:600;">${montantLigne.toFixed(2)} €</td>
            </tr>
        `;
    });

    html += `
                </tbody>
                <tfoot>
                    <tr style="background:#dcfce7; font-weight:bold; font-size:1rem;">
                        <td colspan="3" style="padding:12px; text-align:right;">TOTAL DES RECETTES BRUTES (Ligne 6 / Code AG) :</td>
                        <td style="padding:12px; text-align:right; color:#15803d;">${totalRecettes.toFixed(2)} €</td>
                    </tr>
                </tfoot>
            </table>

            <!-- TABLEAU DÉPENSES -->
            <h4 style="color:#b91c1c; margin-bottom:10px;">II. DÉPENSES PROFESSIONNELLES</h4>
            <table style="width:100%; border-collapse:collapse; margin-bottom:25px;">
                <thead>
                    <tr style="background:#fef2f2; color:#991b1b; text-align:left;">
                        <th style="padding:10px; border-bottom:2px solid #fecaca; width:80px;">Ligne</th>
                        <th style="padding:10px; border-bottom:2px solid #fecaca; width:70px;">Code</th>
                        <th style="padding:10px; border-bottom:2px solid #fecaca;">Intitulé de la rubrique fiscale</th>
                        <th style="padding:10px; border-bottom:2px solid #fecaca; text-align:right;">Montant (€)</th>
                    </tr>
                </thead>
                <tbody>
    `;

    STRUCTURE_2035.depenses.forEach(item => {
        const montantLigne = calculerMontantLigne(item.comptes, false);
        totalDepenses += montantLigne;

        html += `
            <tr style="border-bottom:1px solid #f1f5f9;">
                <td style="padding:10px; font-weight:bold; color:#475569;">${item.ligne}</td>
                <td style="padding:10px; font-weight:bold; color:#b91c1c;">${item.code}</td>
                <td style="padding:10px;">${item.libelle}</td>
                <td style="padding:10px; text-align:right; font-weight:600;">${montantLigne.toFixed(2)} €</td>
            </tr>
        `;
    });

    const resultatFiscal = totalRecettes - totalDepenses;

    html += `
                </tbody>
                <tfoot>
                    <tr style="background:#fee2e2; font-weight:bold; font-size:1rem;">
                        <td colspan="3" style="padding:12px; text-align:right;">TOTAL DES DÉPENSES DÉDUCTIBLES (Ligne 36 / Code CH) :</td>
                        <td style="padding:12px; text-align:right; color:#b91c1c;">${totalDepenses.toFixed(2)} €</td>
                    </tr>
                </tfoot>
            </table>

            <!-- RÉSULTAT FISCAL FINAL -->
            <div style="background:${resultatFiscal >= 0 ? '#f0fdf4' : '#fef2f2'}; border:2px solid ${resultatFiscal >= 0 ? '#16a34a' : '#dc2626'}; padding:18px; border-radius:8px; display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <strong style="font-size:1.1rem; color:${resultatFiscal >= 0 ? '#15803d' : '#b91c1c'}; font-block:block;">
                        ${resultatFiscal >= 0 ? 'BÉNÉFICE FISCAL (Ligne 37 / Code CP)' : 'DÉFICIT FISCAL (Ligne 38 / Code CR)'}
                    </strong>
                    <span style="font-size:0.85rem; color:#64748b;">Montant à reporter sur votre déclaration de revenus complémentaires (2042-C-PRO)</span>
                </div>
                <span style="font-size:1.5rem; font-weight:bold; color:${resultatFiscal >= 0 ? '#15803d' : '#b91c1c'};">
                    ${resultatFiscal.toFixed(2)} €
                </span>
            </div>

        </div>
    `;

    conteneur.innerHTML = html;
};

// Chargement automatique
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(window.afficherDeclaration2035, 500);
});
