// ==========================================
// MODULE INDÉPENDANT : DÉCLARATION FISCALE 2035
// ==========================================

window.init2035 = function() {
    var container = document.getElementById('declaration-2035-container') || document.getElementById('2035-container');
    
    // Si aucun conteneur direct n'est trouvé, recherche dynamique dans la page
    if (!container) {
        var elements = document.querySelectorAll('div, section');
        elements.forEach(function(el) {
            if (el.textContent.includes('Chargement') || el.textContent.includes('2035')) {
                container = el;
            }
        });
    }

    if (!container) return;

    var transactions = window.allTransactions || [];

    // 1. Dictionnaire de correspondance des lignes du formulaire 2035
    var lignes2035 = {
        // RECETTES
        'AA': { libelle: 'Honoraires encaissés (conventionnés)', type: 'recette', total: 0 },
        'AC': { libelle: 'Gains divers / Rétrocessions reçues', type: 'recette', total: 0 },
        
        // DEPENSES (CHARGES)
        'AK': { libelle: 'Achats de produits et petit matériel médical', type: 'depense', total: 0 },
        'BA': { libelle: 'Loyer et charges locatives professionnelles', type: 'depense', total: 0 },
        'BT': { libelle: 'Cotisations sociales URSSAF', type: 'depense', total: 0 },
        'BV': { libelle: 'Cotisations retraites CARPIMKO', type: 'depense', total: 0 },
        'CC': { libelle: 'Assurances (RCP, locaux, prévoyance)', type: 'depense', total: 0 },
        'CH': { libelle: 'Frais de déplacements et véhicules', type: 'depense', total: 0 },
        'CL': { libelle: 'Frais de gestion, comptabilité et honoraires', type: 'depense', total: 0 },
        'CR': { libelle: 'Autres dépenses déductibles (Frais généraux)', type: 'depense', total: 0 }
    };

    var totalRecettes2035 = 0;
    var totalDepenses2035 = 0;

    // 2. Traitement et ventilation des transactions selon les lignes
    transactions.forEach(function(tx) {
        var montant = Math.abs(parseFloat(tx.amount) || 0);
        var type = (tx.type || '').toLowerCase();
        var cat = (tx.category || '').toLowerCase();

        if (type === 'recette' || parseFloat(tx.amount) > 0) {
            lignes2035['AA'].total += montant;
            totalRecettes2035 += montant;
        } else {
            totalDepenses2035 += montant;

            // Mapping automatique vers les lignes 2035
            if (cat.includes('urssaf')) {
                lignes2035['BT'].total += montant;
            } else if (cat.includes('carpimko')) {
                lignes2035['BV'].total += montant;
            } else if (cat.includes('loyer') || cat.includes('location')) {
                lignes2035['BA'].total += montant;
            } else if (cat.includes('matériel') || cat.includes('fourniture')) {
                lignes2035['AK'].total += montant;
            } else if (cat.includes('assurance') || cat.includes('rcp')) {
                lignes2035['CC'].total += montant;
            } else if (cat.includes('essence') || cat.includes('auto') || cat.includes('deplacement')) {
                lignes2035['CH'].total += montant;
            } else if (cat.includes('compta') || cat.includes('honoraires')) {
                lignes2035['CL'].total += montant;
            } else {
                lignes2035['CR'].total += montant;
            }
        }
    });

    var beneficeFiscal = totalRecettes2035 - totalDepenses2035;

    // 3. Construction du tableau d'affichage
    var htmlRows = '';
    for (var code in lignes2035) {
        var ligne = lignes2035[code];
        var couleur = ligne.type === 'recette' ? '#16a34a' : '#dc2626';
        var signe = ligne.type === 'recette' ? '+' : '-';

        htmlRows += `
            <tr>
                <td style="font-weight: bold; color: #475569;">Ligne ${code}</td>
                <td>${ligne.libelle}</td>
                <td style="text-align: right; font-weight: 600; color: ${couleur};">
                    ${ligne.total > 0 ? signe : ''}${ligne.total.toFixed(2)} €
                </td>
            </tr>
        `;
    }

    // 4. Injection HTML dans la page
    container.innerHTML = `
        <style>
            .decl-card {
                background: #ffffff; padding: 20px; border-radius: 8px;
                box-shadow: 0 1px 3px rgba(0,0,0,0.08); margin-bottom: 20px;
                border: 1px solid var(--border, #e2e8f0); font-family: system-ui, -apple-system, sans-serif;
            }
            .decl-grid-3 { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 20px; }
            .decl-kpi { background: #f8fafc; padding: 15px; border-radius: 6px; border: 1px solid #e2e8f0; text-align: center; }
            .decl-kpi-val { font-size: 1.5em; font-weight: bold; margin-top: 4px; }
            .decl-table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            .decl-table th, .decl-table td { padding: 10px 12px; border-bottom: 1px solid #e2e8f0; text-align: left; font-size: 14px; }
            .decl-table th { background: #f8fafc; font-weight: 600; }
        </style>

        <div class="decl-card" style="border-left: 5px solid #0284c7;">
            <h2 style="margin-top:0; color:#0369a1; font-size:18px;">📄 Déclaration Fiscale 2035 (BNC)</h2>
            <p style="color:#64748b; font-size:14px; margin-bottom:15px;">Récapitulatif ventilé selon la nomenclature officielle des impôts.</p>

            <div class="decl-grid-3">
                <div class="decl-kpi">
                    <small style="color: #64748b;">Total Recettes (Ligne AG)</small>
                    <div class="decl-kpi-val" style="color: #16a34a;">+${totalRecettes2035.toFixed(2)} €</div>
                </div>
                <div class="decl-kpi">
                    <small style="color: #64748b;">Total Dépenses (Ligne CS)</small>
                    <div class="decl-kpi-val" style="color: #dc2626;">-${totalDepenses2035.toFixed(2)} €</div>
                </div>
                <div class="decl-kpi">
                    <small style="color: #64748b;">Bénéfice / Déficit (Ligne CP)</small>
                    <div class="decl-kpi-val" style="color: ${beneficeFiscal >= 0 ? '#0284c7' : '#dc2626'};">
                        ${beneficeFiscal.toFixed(2)} €
                    </div>
                </div>
            </div>

            <table class="decl-table">
                <thead>
                    <tr>
                        <th style="width: 100px;">Code 2035</th>
                        <th>Intitulé du poste fiscal</th>
                        <th style="text-align: right;">Montant Total</th>
                    </tr>
                </thead>
                <tbody>
                    ${htmlRows}
                    <tr style="background:#f0fdf4; font-weight:bold; font-size:15px;">
                        <td colspan="2">RÉSULTAT FISCAL NET (BNC)</td>
                        <td style="text-align: right; color:#0284c7;">${beneficeFiscal.toFixed(2)} €</td>
                    </tr>
                </tbody>
            </table>
        </div>
    `;
};

// Aliases pour garantir la compatibilité selon le nom d'appel
window.initDeclaration2035 = window.init2035;
