/* ==========================================================================
   MODULE GRAND LIVRE COMPLET (PARTIE DOUBLE : BILAN + GESTION)
   ========================================================================== */

/**
 * Détermine le compte de gestion (Classe 6 / 7)
 */
window.obtenirCompteGestion = function(tx) {
    var cat = (tx.category || tx.categorie || '').toString().toLowerCase();
    var typeRaw = (tx.type || '').toString().toLowerCase();
    var isRecette = typeRaw.includes('recette') || typeRaw.includes('encaissement');

    if (isRecette) {
        if (cat.includes('retrocession') || cat.includes('rétrocession')) {
            return { code: '709000', libelle: '709000 - Rétrocessions d honoraires reçues' };
        }
        return { code: '706000', libelle: '706000 - Prestations de soins / Honoraires' };
    }

    if (cat.includes('urssaf')) return { code: '645100', libelle: '645100 - Cotisations Sociales URSSAF' };
    if (cat.includes('carpimko')) return { code: '645200', libelle: '645200 - Cotisations Retraite CARPIMKO' };
    if (cat.includes('matériel') || cat.includes('materiel') || cat.includes('fourniture')) {
        return { code: '606400', libelle: '606400 - Achats de Matériel Médical et Fournitures' };
    }
    if (cat.includes('impôt') || cat.includes('impot') || cat.includes('cfe') || cat.includes('pas')) {
        return { code: '635000', libelle: '635000 - Impôts, Taxes et Versements Assimilés' };
    }
    if (cat.includes('loyer') || cat.includes('location')) return { code: '613200', libelle: '613200 - Locations Immobilières / Cabinet' };
    if (cat.includes('assurance')) return { code: '616000', libelle: '616000 - Primes d Assurances Professionnelles' };
    if (cat.includes('banque') || cat.includes('frais')) return { code: '627000', libelle: '627000 - Services Bancaires et Assimilés' };

    return { code: '600000', libelle: '600000 - Autres Charges Exploitation' };
};

/**
 * Détermine le compte de bilan (Classe 4 ou 5)
 */
window.obtenirCompteBilan = function(tx) {
    var isEncaisse = tx.encaisse === true || tx.encaisse === 'true' || tx.encaisse === 1;
    var typeRaw = (tx.type || '').toString().toLowerCase();
    var isRecette = typeRaw.includes('recette') || typeRaw.includes('encaissement');

    if (isEncaisse) {
        return { code: '512000', libelle: '512000 - Compte Banque' };
    } else {
        if (isRecette) {
            return { code: '411000', libelle: '411000 - Clients et Patients (Créances à valider)' };
        } else {
            return { code: '401000', libelle: '401000 - Fournisseurs et Organismes (Dettes à régler)' };
        }
    }
};

/**
 * Fonction principale : Calcule et affiche le Grand Livre complet
 */
window.afficherGrandLivre = function() {
    var container = document.getElementById('contenu-grand-livre') || 
                      document.getElementById('grand-livre-contenu') || 
                      document.getElementById('vue-grand-livre') || 
                      document.getElementById('grand-livre-container');

    if (!container) {
        var toutLesDivs = document.querySelectorAll('div');
        toutLesDivs.forEach(function(div) {
            if (div.textContent.includes('Chargement du grand livre...')) {
                container = div;
            }
        });
    }

    if (!container) return;

    var transactions = window.transactions || [];

    if (!Array.isArray(transactions) || transactions.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding:30px; color:#64748b;">Aucune transaction disponible pour générer le Grand Livre.</div>';
        return;
    }

    var comptesMap = {};

    function ajouterEcriture(compteObj, date, desc, debit, credit) {
        var code = compteObj.code;
        if (!comptesMap[code]) {
            comptesMap[code] = {
                code: code,
                libelle: compteObj.libelle,
                ecritures: [],
                totalDebit: 0,
                totalCredit: 0
            };
        }
        comptesMap[code].totalDebit += debit;
        comptesMap[code].totalCredit += credit;
        comptesMap[code].ecritures.push({
            date: date,
            description: desc,
            debit: debit,
            credit: credit
        });
    }

    // Traitement en Partie Double de chaque transaction
    transactions.forEach(function(tx) {
        var valMontant = parseFloat(tx.amount !== undefined && tx.amount !== null ? tx.amount : (tx.montant || 0)) || 0;
        var typeRaw = (tx.type || '').toString().toLowerCase();
        var isRecette = typeRaw.includes('recette') || typeRaw.includes('encaissement');
        var date = tx.date || '';
        var desc = tx.description || tx.libelle || '';

        var compteGestion = window.obtenirCompteGestion(tx);
        var compteBilan = window.obtenirCompteBilan(tx);

        if (isRecette) {
            // Recette : Crédit Gestion (706) / Débit Bilan (512 Banque ou 411 Patients)
            ajouterEcriture(compteGestion, date, desc, 0, valMontant);
            ajouterEcriture(compteBilan, date, desc, valMontant, 0);
        } else {
            // Dépense : Débit Gestion (6xx) / Crédit Bilan (512 Banque ou 401 Fournisseurs)
            ajouterEcriture(compteGestion, date, desc, valMontant, 0);
            ajouterEcriture(compteBilan, date, desc, 0, valMontant);
        }
    });

    var codesTries = Object.keys(comptesMap).sort();

    var html = '<div style="display:flex; flex-direction:column; gap:25px; margin-top:15px;">';

    codesTries.forEach(function(code) {
        var compte = comptesMap[code];
        var solde = compte.totalCredit - compte.totalDebit;
        var soldeTexte = solde >= 0 ? `Créditeur : +${solde.toFixed(2)} €` : `Débitrice : ${solde.toFixed(2)} €`;

        html += `
            <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:8px; overflow:hidden; box-shadow:0 1px 3px rgba(0,0,0,0.05);">
                <div style="background:#f8fafc; padding:12px 20px; border-bottom:1px solid #e2e8f0; display:flex; justify-content:space-between; align-items:center;">
                    <span style="font-weight:700; color:#1e293b; font-size:15px;">Compte ${compte.libelle}</span>
                    <span style="font-size:13px; font-weight:600; color:${solde >= 0 ? '#16a34a' : '#dc2626'}; background:#fff; padding:4px 10px; border-radius:6px; border:1px solid #cbd5e1;">
                        Solde ${soldeTexte}
                    </span>
                </div>

                <table style="width:100%; border-collapse:collapse; text-align:left; font-size:13px;">
                    <thead>
                        <tr style="background:#f1f5f9; color:#475569; border-bottom:1px solid #e2e8f0;">
                            <th style="padding:8px 15px; width:15%;">Date</th>
                            <th style="padding:8px 15px;">Libellé / Description</th>
                            <th style="padding:8px 15px; text-align:right; width:20%;">Débit</th>
                            <th style="padding:8px 15px; text-align:right; width:20%;">Crédit</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        compte.ecritures.forEach(function(ecr) {
            html += `
                <tr style="border-bottom:1px solid #f1f5f9;">
                    <td style="padding:8px 15px; color:#64748b;">${ecr.date}</td>
                    <td style="padding:8px 15px; color:#334155;">${ecr.description}</td>
                    <td style="padding:8px 15px; text-align:right; color:#dc2626; font-weight:500;">${ecr.debit > 0 ? ecr.debit.toFixed(2) + ' €' : '-'}</td>
                    <td style="padding:8px 15px; text-align:right; color:#16a34a; font-weight:500;">${ecr.credit > 0 ? ecr.credit.toFixed(2) + ' €' : '-'}</td>
                </tr>
            `;
        });

        html += `
                    </tbody>
                    <tfoot>
                        <tr style="background:#fafafa; font-weight:700; border-top:2px solid #e2e8f0;">
                            <td colspan="2" style="padding:10px 15px; text-align:right; color:#334155;">Totaux du Compte :</td>
                            <td style="padding:10px 15px; text-align:right; color:#dc2626;">${compte.totalDebit.toFixed(2)} €</td>
                            <td style="padding:10px 15px; text-align:right; color:#16a34a;">${compte.totalCredit.toFixed(2)} €</td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        `;
    });

    html += '</div>';
    container.innerHTML = html;
};

if (window.transactions && window.transactions.length > 0) {
    window.afficherGrandLivre();
}
