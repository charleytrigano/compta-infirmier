// ==========================================
// MODULE COMPTABLE : DÉCLARATION FISCALE 2035
// ==========================================

window.init2035 = async function() {
    // 1. Recherche intelligente du conteneur dans la page
    var container = document.getElementById('declaration-2035-container') || document.getElementById('2035-container');
    
    if (!container) {
        // Si aucun ID spécifique n'est trouvé, on cherche le conteneur affichant le texte temporaire
        var allCards = document.querySelectorAll('.card, section, div');
        allCards.forEach(function(el) {
            if (el.textContent.includes('prêt à être développé') || el.textContent.includes('Déclaration Fiscale 2035')) {
                container = el;
            }
        });
    }

    if (!container) return;

    // 2. Sécurisation de l'accès aux données (évite de bloquer sur l'erreur Supabase 400)
    var transactions = window.allTransactions || [];

    // 3. Structure des lignes officielles du formulaire 2035 BNC
    var lignes2035 = {
        'AA': { libelle: 'Honoraires encaissés (Actes conventionnés)', type: 'recette', total: 0 },
        'AC': { libelle: 'Gains divers et rétrocessions reçues', type: 'recette', total: 0 },
        'AK': { libelle: 'Achats de produits et petit matériel médical', type: 'depense', total: 0 },
        'BA': { libelle: 'Loyer et charges locatives professionnelles', type: 'depense', total: 0 },
        'BT': { libelle: 'Cotisations sociales obligatoires (URSSAF)', type: 'depense', total: 0 },
        'BV': { libelle: 'Cotisations retraite et prévoyance (CARPIMKO)', type: 'depense', total: 0 },
        'CC': { libelle: 'Assurances (RCP, locaux, matériel)', type: 'depense', total: 0 },
        'CH': { libelle: 'Frais de déplacements et véhicules', type: 'depense', total: 0 },
        'CL': { libelle: 'Frais de gestion et honoraires comptables', type: 'depense', total: 0 },
        'CR': { libelle: 'Autres dépenses professionnelles déductibles', type: 'depense', total: 0 }
    };

    var totalRecettes = 0;
    var totalDepenses = 0;

    // 4. Ventillation automatique des transactions dans les lignes 2035
    transactions.forEach(function(tx) {
        var montant = Math.abs(parseFloat(tx.amount) || 0);
        var type = (tx.type || '').toLowerCase();
        var cat = (tx.category || '').toLowerCase();

        if (type === 'recette' || parseFloat(tx.amount) > 0) {
            lignes2035['AA'].total += montant;
            totalRecettes += montant;
        } else {
            totalDepenses += montant;

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
            } else if (cat.includes('deplacement') || cat.includes('auto') || cat.includes('essence')) {
                lignes2035['CH'].total += montant;
            } else if (cat.includes('compta') || cat.includes('honoraire')) {
                lignes2035['CL'].total += montant;
            } else {
                lignes2035['CR'].total += montant;
            }
        }
    });

    var beneficeFiscal = totalRecettes - totalDepenses;

    // 5. Génération dynamique des lignes du tableau HTML
    var htmlTableRows = '';
    for (var code in lignes2035) {
        var item = lignes2035[code];
        var isRecette = item.type === 'recette';
        var color = isRecette ? '#16a34a' : '#dc2626';
        var prefix = isRecette ? '+' : '-';

        htmlTableRows += `
            <tr>
                <td style="font-weight: bold; color: #0284c7; width: 100px;">Ligne ${code}</td>
                <td>${item.libelle}</td>
                <td style="text-align: right; font-weight: 600; color: ${item.total > 0 ? color : '#64748b'};">
                    ${item.total > 0 ? prefix : ''}${item.total.toFixed(2)} €
                </td>
            </tr>
        `;
    }

    // 6. Injection de l'interface complète
    container.innerHTML = `
        <style>
            .decl2035-box { font-family: system-ui, -apple-system, sans-serif; }
            .decl2035-header { margin-bottom: 20px; }
            .decl2035-header h2 { margin: 0 0 5px 0; color: #0f172a; font-size: 20px; }
            .decl2035-header p { margin: 0; color: #64748b; font-size: 14px; }
            
            .decl2035-kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 25px; }
            .decl2035-kpi-card { background: #ffffff; padding: 16px; border-radius: 8px; border: 1px solid #e2e8f0; text-align: center; box-shadow: 0 1px 2px rgba(0,0,0,0.05); }
            .decl2035-kpi-label { font-size: 12px; color: #64748b; font-weight: 600; text-transform: uppercase; }
            .decl2035-kpi-val { font-size: 20px; font-weight: bold; margin-top: 5px; }

            .decl2035-table-card { background: #ffffff; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0; box-shadow: 0 1px 2px rgba(0,0,0,0.05); }
            .decl2035-table { width: 100%; border-collapse: collapse; }
            .decl2035-table th, .decl2035-table td { padding: 12px; border-bottom: 1px solid #f1f5f9; text-align: left; font-size: 14px; }
            .decl2035-table th { background: #f8fafc; font-weight: 600; color: #475569; }
        </style>

        <div class="decl2035-box">
            <div class="decl2035-header">
                <h2>📑 Déclaration Fiscale 2035 (BNC)</h2>
                <p>Ventilation automatique de vos dépenses et recettes selon la déclaration 2035.</p>
            </div>

            <div class="decl2035-kpis">
                <div class="decl2035-kpi-card">
                    <div class="decl2035-kpi-label">Recettes Brutes (Ligne AG)</div>
                    <div class="decl2035-kpi-val" style="color: #16a34a;">+${totalRecettes.toFixed(2)} €</div>
                </div>
                <div class="decl2035-kpi-card">
                    <div class="decl2035-kpi-label">Total Dépenses (Ligne CS)</div>
                    <div class="decl2035-kpi-val" style="color: #dc2626;">-${totalDepenses.toFixed(2)} €</div>
                </div>
                <div class="decl2035-kpi-card">
                    <div class="decl2035-kpi-label">Résultat Net / Bénéfice (Ligne CP)</div>
                    <div class="decl2035-kpi-val" style="color: ${beneficeFiscal >= 0 ? '#0284c7' : '#dc2626'};">
                        ${beneficeFiscal.toFixed(2)} €
                    </div>
                </div>
            </div>

            <div class="decl2035-table-card">
                <table class="decl2035-table">
                    <thead>
                        <tr>
                            <th>Case</th>
                            <th>Intitulé du Poste Fiscal</th>
                            <th style="text-align: right;">Montant Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${htmlTableRows}
                        <tr style="background: #f0fdf4; font-weight: bold; font-size: 15px;">
                            <td colspan="2">BÉNÉFICE COMPTABLE NET (LIGNE CP)</td>
                            <td style="text-align: right; color: #0284c7;">${beneficeFiscal.toFixed(2)} €</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    `;
};

// Aliases pour assurer l'exécution quel que soit le nom d'appel dans app.js
window.initDeclaration2035 = window.init2035;
window.load2035 = window.init2035;
