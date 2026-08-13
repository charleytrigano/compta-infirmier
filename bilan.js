// ==========================================
// COMPTABILITÉ LIBÉRALE - BILAN & COMPTE D'EXPLOITATION (2035)
// Fichier complet : bilan.js
// ==========================================

// Correspondence entre comptes du Plan Comptable Infirmier et la Déclaration 2035
const MAPPING_2035 = {
    // RECETTES (Classe 7)
    '706000': { code: 'AA', libelle: 'Honoraires encaissements BNC' },
    '708000': { code: 'AC', libelle: 'Remboursements de frais et débours' },
    '770000': { code: 'AF', libelle: 'Gain sur cessions d’éléments d’actif' },

    // DÉPENSES (Classe 6)
    '606300': { code: 'BA', libelle: 'Petit matériel médical et fournitures' },
    '606400': { code: 'BB', libelle: 'Fournitures de bureau et documentation' },
    '613200': { code: 'BT', libelle: 'Loyer professionnel et charges locatives' },
    '616000': { code: 'BV', libelle: 'Assurances (RCP, locaux, véhicules)' },
    '645100': { code: 'BX', libelle: 'Charges sociales : URSSAF' },
    '645200': { code: 'BW', libelle: 'Charges sociales : CARPIMKO' },
    '625100': { code: 'CA', libelle: 'Frais de déplacement et carburant' },
    '622600': { code: 'CC', libelle: 'Honoraires comptables et logiciels' },
    '627000': { code: 'CF', libelle: 'Frais bancaires' },
    '658000': { code: 'CG', libelle: 'Diverses dépenses à déduire' }
};

window.afficherBilanEtCE = function() {
    const conteneurCE = document.getElementById('conteneur-compte-exploitation');
    const conteneurBilan = document.getElementById('conteneur-bilan');

    if (!conteneurCE) return;

    // Récupération des transactions de l'application
    const transactions = window.listeTransactions || [];

    const rubriquesRecettes = {};
    const rubriquesDepenses = {};

    let totalRecettes = 0;
    let totalDepenses = 0;

    // Parcours et agrégation des montants par rubrique 2035
    transactions.forEach(tx => {
        const montant = Math.abs(parseFloat(tx.amount || tx.montant) || 0);
        const typeOp = (tx.type || '').toLowerCase();
        const estRecette = typeOp === 'recette' || typeOp === 'recettes';
        const categorie = tx.category || tx.categorie || '';

        // Recherche du numéro de compte
        const compteTrouve = (window.listePlanComptable || []).find(c => c.nom === categorie);
        const codeCompte = compteTrouve ? compteTrouve.code : '';

        // Rubrique 2035 correspondante
        const mapping = MAPPING_2035[codeCompte] || {
            code: estRecette ? 'AG_AUTRE' : 'CG_AUTRE',
            libelle: categorie || 'Autres opérations'
        };

        if (estRecette) {
            totalRecettes += montant;
            if (!rubriquesRecettes[mapping.code]) {
                rubriquesRecettes[mapping.code] = { libelle: mapping.libelle, montant: 0 };
            }
            rubriquesRecettes[mapping.code].montant += montant;
        } else {
            totalDepenses += montant;
            if (!rubriquesDepenses[mapping.code]) {
                rubriquesDepenses[mapping.code] = { libelle: mapping.libelle, montant: 0 };
            }
            rubriquesDepenses[mapping.code].montant += montant;
        }
    });

    const beneficeOuPerte = totalRecettes - totalDepenses;

    // --- 1. TABLEAU DU COMPTE D'EXPLOITATION FISCAL (2035) ---
    let htmlCE = `
        <div style="background:#fff; border:1px solid #cbd5e1; border-radius:8px; padding:20px; margin-bottom:25px; box-shadow:0 1px 3px rgba(0,0,0,0.05);">
            <h3 style="margin-top:0; color:#1e293b; border-bottom:2px solid #2563eb; padding-bottom:8px;">
                📊 Compte de Résultat / Dépenses et Recettes (Formulaire 2035)
            </h3>
            
            <h4 style="color:#166534; margin-top:15px; margin-bottom:10px;">🟢 RECETTES BRUTES</h4>
            <table style="width:100%; border-collapse:collapse; margin-bottom:20px;">
                <thead>
                    <tr style="background:#f0fdf4; color:#166534; text-align:left;">
                        <th style="padding:8px;">Ligne 2035</th>
                        <th style="padding:8px;">Rubrique Fiscale</th>
                        <th style="padding:8px; text-align:right;">Montant (€)</th>
                    </tr>
                </thead>
                <tbody>
    `;

    if (Object.keys(rubriquesRecettes).length === 0) {
        htmlCE += `<tr><td colspan="3" style="padding:12px; text-align:center; color:#94a3b8;">Aucune recette enregistrée pour le moment.</td></tr>`;
    } else {
        Object.keys(rubriquesRecettes).forEach(code => {
            const item = rubriquesRecettes[code];
            htmlCE += `
                <tr style="border-bottom:1px solid #f1f5f9;">
                    <td style="padding:8px; font-weight:bold; color:#15803d;">${code.includes('_') ? '-' : code}</td>
                    <td style="padding:8px;">${item.libelle}</td>
                    <td style="padding:8px; text-align:right; font-weight:bold;">${item.montant.toFixed(2)} €</td>
                </tr>
            `;
        });
    }

    htmlCE += `
                </tbody>
                <tfoot>
                    <tr style="background:#dcfce7; font-weight:bold;">
                        <td colspan="2" style="padding:10px; text-align:right;">TOTAL RECETTES BRUTES (Ligne AG) :</td>
                        <td style="padding:10px; text-align:right; color:#15803d; font-size:1.05rem;">${totalRecettes.toFixed(2)} €</td>
                    </tr>
                </tfoot>
            </table>

            <h4 style="color:#991b1b; margin-top:20px; margin-bottom:10px;">🔴 DÉPENSES PROFESSIONNELLES</h4>
            <table style="width:100%; border-collapse:collapse; margin-bottom:20px;">
                <thead>
                    <tr style="background:#fef2f2; color:#991b1b; text-align:left;">
                        <th style="padding:8px;">Ligne 2035</th>
                        <th style="padding:8px;">Rubrique Fiscale</th>
                        <th style="padding:8px; text-align:right;">Montant (€)</th>
                    </tr>
                </thead>
                <tbody>
    `;

    if (Object.keys(rubriquesDepenses).length === 0) {
        htmlCE += `<tr><td colspan="3" style="padding:12px; text-align:center; color:#94a3b8;">Aucune dépense enregistrée pour le moment.</td></tr>`;
    } else {
        Object.keys(rubriquesDepenses).forEach(code => {
            const item = rubriquesDepenses[code];
            htmlCE += `
                <tr style="border-bottom:1px solid #f1f5f9;">
                    <td style="padding:8px; font-weight:bold; color:#b91c1c;">${code.includes('_') ? '-' : code}</td>
                    <td style="padding:8px;">${item.libelle}</td>
                    <td style="padding:8px; text-align:right; font-weight:bold;">${item.montant.toFixed(2)} €</td>
                </tr>
            `;
        });
    }

    htmlCE += `
                </tbody>
                <tfoot>
                    <tr style="background:#fee2e2; font-weight:bold;">
                        <td colspan="2" style="padding:10px; text-align:right;">TOTAL DÉPENSES DÉDUCTIBLES (Ligne CH) :</td>
                        <td style="padding:10px; text-align:right; color:#b91c1c; font-size:1.05rem;">${totalDepenses.toFixed(2)} €</td>
                    </tr>
                </tfoot>
            </table>

            <!-- RÉSULTAT FISCAL -->
            <div style="background:${beneficeOuPerte >= 0 ? '#f0fdf4' : '#fef2f2'}; border:2px solid ${beneficeOuPerte >= 0 ? '#16a34a' : '#dc2626'}; padding:15px; border-radius:6px; display:flex; justify-content:space-between; align-items:center;">
                <span style="font-size:1.05rem; font-weight:bold; color:${beneficeOuPerte >= 0 ? '#15803d' : '#b91c1c'};">
                    ${beneficeOuPerte >= 0 ? 'RÉSULTAT FISCAL : BÉNÉFICE (Ligne CP)' : 'RÉSULTAT FISCAL : DÉFICIT (Ligne CR)'}
                </span>
                <span style="font-size:1.25rem; font-weight:bold; color:${beneficeOuPerte >= 0 ? '#15803d' : '#b91c1c'};">
                    ${beneficeOuPerte.toFixed(2)} €
                </span>
            </div>
        </div>
    `;

    conteneurCE.innerHTML = htmlCE;

    // --- 2. TABLEAU DU BILAN SIMPLIFIÉ ---
    if (conteneurBilan) {
        let htmlBilan = `
            <div style="background:#fff; border:1px solid #cbd5e1; border-radius:8px; padding:20px; box-shadow:0 1px 3px rgba(0,0,0,0.05);">
                <h3 style="margin-top:0; color:#1e293b; border-bottom:2px solid #2563eb; padding-bottom:8px;">
                    ⚖️ Bilan Simplifié (Actif / Passif)
                </h3>
                <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap:20px;">
                    <!-- ACTIF -->
                    <div style="border:1px solid #e2e8f0; border-radius:6px; padding:12px;">
                        <h4 style="margin-top:0; background:#f8fafc; padding:8px; border-bottom:1px solid #e2e8f0; color:#0f172a;">ACTIF</h4>
                        <table style="width:100%; font-size:0.9rem;">
                            <tr><td style="padding:6px;">Trésorerie / Banque :</td><td style="text-align:right; font-weight:bold;">${beneficeOuPerte.toFixed(2)} €</td></tr>
                            <tr><td style="padding:6px;">Immobilisations :</td><td style="text-align:right;">0.00 €</td></tr>
                            <tr style="border-top:1px solid #cbd5e1; font-weight:bold;">
                                <td style="padding:6px;">TOTAL ACTIF :</td>
                                <td style="text-align:right; color:#2563eb;">${beneficeOuPerte.toFixed(2)} €</td>
                            </tr>
                        </table>
                    </div>

                    <!-- PASSIF -->
                    <div style="border:1px solid #e2e8f0; border-radius:6px; padding:12px;">
                        <h4 style="margin-top:0; background:#f8fafc; padding:8px; border-bottom:1px solid #e2e8f0; color:#0f172a;">PASSIF</h4>
                        <table style="width:100%; font-size:0.9rem;">
                            <tr><td style="padding:6px;">Compte de l'exploitant :</td><td style="text-align:right; font-weight:bold;">${beneficeOuPerte.toFixed(2)} €</td></tr>
                            <tr><td style="padding:6px;">Dettes / Emprunts :</td><td style="text-align:right;">0.00 €</td></tr>
                            <tr style="border-top:1px solid #cbd5e1; font-weight:bold;">
                                <td style="padding:6px;">TOTAL PASSIF :</td>
                                <td style="text-align:right; color:#2563eb;">${beneficeOuPerte.toFixed(2)} €</td>
                            </tr>
                        </table>
                    </div>
                </div>
            </div>
        `;
        conteneurBilan.innerHTML = htmlBilan;
    }
};

// Exécution au chargement du document
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(window.afficherBilanEtCE, 500);
});
