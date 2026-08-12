// ==========================================
// MODULE INDÉPENDANT : CFE & BILAN COMPTABLE BNC
// ==========================================

window.initCfeBilan = function() {
    var container = document.getElementById('cfe-bilan-container');
    if (!container) return;

    var transactions = window.allTransactions || [];

    // 1. Extraction des flux réels depuis les transactions
    var totalRecettes = 0;
    var totalDepensesOp = 0;
    var totalUrssaf = 0;
    var totalCarpimko = 0;
    var totalCfePayee = 0;

    transactions.forEach(function(tx) {
        var montant = parseFloat(tx.amount) || 0;
        var cat = (tx.category || '').toLowerCase();
        var type = (tx.type || '').toLowerCase();

        if (type === 'recette' || montant > 0) {
            totalRecettes += Math.abs(montant);
        } else {
            var depense = Math.abs(montant);
            if (cat.includes('urssaf')) {
                totalUrssaf += depense;
            } else if (cat.includes('carpimko')) {
                totalCarpimko += depense;
            } else if (cat.includes('cfe') || cat.includes('impot')) {
                totalCfePayee += depense;
            } else {
                totalDepensesOp += depense;
            }
        }
    });

    // 2. Structure HTML
    container.innerHTML = `
        <style>
            .bilan-card {
                background: #ffffff; padding: 20px; border-radius: 8px;
                box-shadow: 0 1px 3px rgba(0,0,0,0.08); margin-bottom: 20px;
                border: 1px solid var(--border, #e2e8f0);
            }
            .bilan-grid-2 { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 15px; }
            .bilan-grid-3 { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; }
            .bilan-form-group { margin-bottom: 15px; }
            .bilan-form-group label { display: block; margin-bottom: 5px; font-weight: 600; font-size: 14px; }
            .bilan-form-group input, .bilan-form-group select {
                width: 100%; padding: 10px; border: 1px solid #ced4da;
                border-radius: 6px; box-sizing: border-box; font-size: 14px;
            }
            .bilan-kpi {
                background: #f8fafc; padding: 15px; border-radius: 6px;
                border: 1px solid var(--border, #e2e8f0); text-align: center;
            }
            .bilan-kpi-val { font-size: 1.5em; font-weight: bold; margin-top: 4px; }
            .bilan-table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            .bilan-table th, .bilan-table td { padding: 10px 12px; border-bottom: 1px solid #e2e8f0; text-align: left; font-size: 14px; }
            .bilan-table th { background: #f8fafc; font-weight: 600; }
        </style>

        <!-- SECTION 1 : ESTIMATION CFE -->
        <div class="bilan-card" style="border-left: 5px solid #8b5cf6;">
            <h3 style="margin-top: 0; color: #6d28d9; font-size: 16px;">🏢 Cotisation Foncière des Entreprises (CFE)</h3>
            <div class="bilan-grid-2">
                <div class="bilan-form-group">
                    <label for="cfe-annee-creation">Année de création d'activité :</label>
                    <select id="cfe-annee-creation" onchange="window.calculerCfeBilan(${totalRecettes}, ${totalCfePayee})">
                        <option value="ancienne">Activité créée avant l'année en cours</option>
                        <option value="encours">1ère année d'installation (Exonération CFE)</option>
                    </select>
                </div>
                <div class="bilan-form-group">
                    <label for="cfe-base-commune">Cotisation CFE forfaitaire commune (€) :</label>
                    <input type="number" id="cfe-base-commune" value="500" step="50" oninput="window.calculerCfeBilan(${totalRecettes}, ${totalCfePayee})">
                    <small style="color:#64748b; font-size: 12px;">Dépend du barème vote par votre commune (moyenne : 300 € à 1000 €).</small>
                </div>
            </div>
            <div class="bilan-grid-3">
                <div class="bilan-kpi">
                    <small style="color: #64748b;">CFE Estimée Dûe</small>
                    <div class="bilan-kpi-val" id="cfe-kpi-estimee" style="color: #8b5cf6;">0.00 €</div>
                </div>
                <div class="bilan-kpi">
                    <small style="color: #64748b;">CFE Prélevée (Banque)</small>
                    <div class="bilan-kpi-val" style="color: #ef4444;">${totalCfePayee.toFixed(2)} €</div>
                </div>
                <div class="bilan-kpi">
                    <small style="color: #64748b;">Écart CFE</small>
                    <div class="bilan-kpi-val" id="cfe-kpi-ecart">0.00 €</div>
                </div>
            </div>
        </div>

        <!-- SECTION 2 : SYNTHÈSE COMPTABLE / BILAN BNC -->
        <div class="bilan-card">
            <h3 style="margin-top: 0; color: #0f172a; border-bottom: 2px solid #8b5cf6; padding-bottom: 8px;">📊 Bilan Synthétique Activité BNC</h3>
            <table class="bilan-table">
                <thead>
                    <tr>
                        <th>Poste Comptable</th>
                        <th style="text-align:right;">Montant Réel (Banque) (€)</th>
                    </tr>
                </thead>
                <tbody>
                    <tr style="background:#f0fdf4; font-weight:bold;">
                        <td>RECETTES BRUTES ENCAISSÉES</td>
                        <td style="text-align:right; color:#16a34a;">${totalRecettes.toFixed(2)} €</td>
                    </tr>
                    <tr>
                        <td>— Cotisations URSSAF réglées</td>
                        <td style="text-align:right; color:#dc2626;">-${totalUrssaf.toFixed(2)} €</td>
                    </tr>
                    <tr>
                        <td>— Cotisations CARPIMKO réglées</td>
                        <td style="text-align:right; color:#dc2626;">-${totalCarpimko.toFixed(2)} €</td>
                    </tr>
                    <tr>
                        <td>— Cotisation CFE réglée</td>
                        <td style="text-align:right; color:#dc2626;">-${totalCfePayee.toFixed(2)} €</td>
                    </tr>
                    <tr>
                        <td>— Autres Dépenses Professionnelles (Frais Généraux)</td>
                        <td style="text-align:right; color:#dc2626;">-${totalDepensesOp.toFixed(2)} €</td>
                    </tr>
                    <tr style="background:#f8fafc; font-weight:bold; font-size:15px;">
                        <td>BÉNÉFICE NET COMPTABLE (BNC ESTIMÉ)</td>
                        <td style="text-align:right; color:#2563eb;" id="bilan-bnc-net">0.00 €</td>
                    </tr>
                </tbody>
            </table>
        </div>
    `;

    // Premier calcul
    window.calculerCfeBilan(totalRecettes, totalCfePayee);
};

/**
 * Calcul de la CFE et mise à jour du Bilan
 */
window.calculerCfeBilan = function(totalRecettes, totalCfePayee) {
    var anneeCreation = document.getElementById('cfe-annee-creation')?.value || 'ancienne';
    var baseCommune = parseFloat(document.getElementById('cfe-base-commune')?.value) || 0;

    var cfeEstimee = 0;

    if (anneeCreation === 'encours') {
        cfeEstimee = 0; // Exonération totale la 1ère année
    } else {
        cfeEstimee = baseCommune;
    }

    var ecartCfe = totalCfePayee - cfeEstimee;

    // Mise à jour CFE
    document.getElementById('cfe-kpi-estimee').textContent = cfeEstimee.toFixed(2) + ' €';
    
    var ecartEl = document.getElementById('cfe-kpi-ecart');
    if (ecartEl) {
        ecartEl.textContent = (ecartCfe >= 0 ? '+' : '') + ecartCfe.toFixed(2) + ' €';
        ecartEl.style.color = ecartCfe >= 0 ? '#10b981' : '#ef4444';
    }

    // Calcul du BNC Net
    var totalUrssaf = 0, totalCarpimko = 0, totalDepensesOp = 0;
    (window.allTransactions || []).forEach(function(tx) {
        var montant = parseFloat(tx.amount) || 0;
        var cat = (tx.category || '').toLowerCase();
        var type = (tx.type || '').toLowerCase();
        if (type !== 'recette' && montant < 0) {
            var depense = Math.abs(montant);
            if (cat.includes('urssaf')) totalUrssaf += depense;
            else if (cat.includes('carpimko')) totalCarpimko += depense;
            else if (!cat.includes('cfe') && !cat.includes('impot')) totalDepensesOp += depense;
        }
    });

    var bncNet = totalRecettes - (totalUrssaf + totalCarpimko + totalCfePayee + totalDepensesOp);
    document.getElementById('bilan-bnc-net').textContent = bncNet.toFixed(2) + ' €';
};
