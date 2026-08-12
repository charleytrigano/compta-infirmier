// ==========================================
// MODULE INDÉPENDANT : CARPIMKO (AVEC RÉGULARISATION N-1)
// ==========================================

window.initCarpimko = function() {
    var container = document.getElementById('carpimko-container');
    if (!container) return;

    // 1. Récupération des paiements réels depuis les transactions bancaires
    var transactions = window.allTransactions || [];
    var totalPayeReel = 0;
    var nbVersements = 0;

    transactions.forEach(function(tx) {
        var cat = (tx.category || '').toLowerCase();
        if (cat.includes('carpimko')) {
            totalPayeReel += parseFloat(tx.amount) || 0;
            nbVersements++;
        }
    });

    // 2. Injection du style et de l'interface
    container.innerHTML = `
        <style>
            .carp-card {
                background: #ffffff; padding: 20px; border-radius: 8px;
                box-shadow: 0 1px 3px rgba(0,0,0,0.08); margin-bottom: 20px;
                border: 1px solid var(--border, #e2e8f0);
            }
            .carp-grid-2 { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 15px; }
            .carp-grid-3 { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 15px; }
            .carp-grid-4 { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; }
            .carp-form-group { margin-bottom: 15px; }
            .carp-form-group label { display: block; margin-bottom: 5px; font-weight: 600; font-size: 14px; }
            .carp-form-group input, .carp-form-group select {
                width: 100%; padding: 10px; border: 1px solid #ced4da;
                border-radius: 6px; box-sizing: border-box; font-size: 14px;
            }
            .carp-kpi {
                background: #f8fafc; padding: 15px; border-radius: 6px;
                border: 1px solid var(--border, #e2e8f0); text-align: center;
            }
            .carp-kpi-val { font-size: 1.4em; font-weight: bold; margin-top: 4px; }
            .carp-table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            .carp-table th, .carp-table td { padding: 10px 12px; border-bottom: 1px solid #e2e8f0; text-align: left; font-size: 14px; }
            .carp-table th { background: #f8fafc; font-weight: 600; }
        </style>

        <!-- BANDEAU SYNTHÈSE & RAPPROCHEMENT -->
        <div class="carp-card" style="background: #f0f9ff; border-left: 5px solid #0284c7;">
            <h3 style="margin-top: 0; color: #0369a1; font-size: 16px;">📊 Synthèse & Rapprochement Bancaire</h3>
            <div class="carp-grid-4" style="margin-top: 10px;">
                <div class="carp-kpi" style="background: #ffffff;">
                    <small style="color: #64748b;">Déjà Prélevé (Banque)</small>
                    <div class="carp-kpi-val" style="color: #ef4444;">${totalPayeReel.toFixed(2)} €</div>
                    <small style="font-size: 11px; color: #94a3b8;">${nbVersements} versement(s)</small>
                </div>
                <div class="carp-kpi" style="background: #ffffff;">
                    <small style="color: #64748b;">Total Exigible Calculé</small>
                    <div class="carp-kpi-val" id="carp-kpi-total-exigible" style="color: #0284c7;">0.00 €</div>
                    <small style="font-size: 11px; color: #94a3b8;">Provision N + Reg) N-1</small>
                </div>
                <div class="carp-kpi" style="background: #ffffff;">
                    <small style="color: #64748b;">Écart Restant</small>
                    <div class="carp-kpi-val" id="carp-kpi-ecart">0.00 €</div>
                </div>
                <div class="carp-kpi" style="background: #ffffff;">
                    <small style="color: #64748b;">Solde Régularisation N-1</small>
                    <div class="carp-kpi-val" id="carp-kpi-solde-n1" style="color: #334155;">0.00 €</div>
                </div>
            </div>
        </div>

        <!-- SECTION 1 : ACOMPTE PROVISIONNEL (ANNÉE N SUR BASE N-2) -->
        <div class="carp-card">
            <h3 style="margin-top: 0; color: #0f172a; border-bottom: 2px solid #0284c7; padding-bottom: 8px;">1. Acompte Provisionnel (Basé sur BNC N-2)</h3>
            <div class="carp-grid-2">
                <div class="carp-form-group">
                    <label for="carp-bnc-n2">BNC N-2 (€) :</label>
                    <input type="number" id="carp-bnc-n2" value="40000" step="500" oninput="window.calculerCarpimkoSimulateur(${totalPayeReel})">
                    <small style="color:#64748b; font-size: 12px;">Base de calcul pour les acomptes de l'année en cours.</small>
                </div>
                <div class="carp-form-group">
                    <label for="carp-statut">Statut / Ancienneté :</label>
                    <select id="carp-statut" onchange="window.calculerCarpimkoSimulateur(${totalPayeReel})">
                        <option value="croisiere">Régime de Croisière (Année 3 et +)</option>
                        <option value="annee1">1ère Année d'installation (Forfait)</option>
                        <option value="annee2">2ème Année d'installation (Forfait)</option>
                    </select>
                </div>
            </div>
            <div class="carp-form-group">
                <label style="font-weight: normal; cursor: pointer;">
                    <input type="checkbox" id="carp-conventionne" checked onchange="window.calculerCarpimkoSimulateur(${totalPayeReel})"> 
                    Infirmier Libéral Conventionné (Prise en charge partielle de l'ASV)
                </label>
            </div>
        </div>

        <!-- SECTION 2 : RÉGULARISATION DE L'ANNÉE N-1 -->
        <div class="carp-card" style="border-left: 4px solid #f59e0b;">
            <h3 style="margin-top: 0; color: #d97706; border-bottom: 2px solid #f59e0b; padding-bottom: 8px;">2. Régularisation Définitive Année N-1</h3>
            <div class="carp-grid-2">
                <div class="carp-form-group">
                    <label for="carp-bnc-n1">BNC Réel N-1 (€) :</label>
                    <input type="number" id="carp-bnc-n1" value="42000" step="500" oninput="window.calculerCarpimkoSimulateur(${totalPayeReel})">
                    <small style="color:#64748b; font-size: 12px;">Bénéfice définitif déclaré sur la 2035 de l'année N-1.</small>
                </div>
                <div class="carp-form-group">
                    <label for="carp-prov-n1">Acomptes déjà versés en N-1 (€) :</label>
                    <input type="number" id="carp-prov-n1" value="7000" step="100" oninput="window.calculerCarpimkoSimulateur(${totalPayeReel})">
                    <small style="color:#64748b; font-size: 12px;">Total des cotisations provisionnelles payées au titre de N-1.</small>
                </div>
            </div>
        </div>

        <!-- SECTION 3 : TABLEAU RÉCAPITULATIF ET DÉTAIL -->
        <div class="carp-card">
            <h3 style="margin-top: 0; color: #0f172a; border-bottom: 2px solid #0284c7; padding-bottom: 8px;">3. Décomposition des Cotisations</h3>
            <table class="carp-table">
                <thead>
                    <tr>
                        <th>Poste de Cotisation</th>
                        <th style="text-align:right;">Provisionnel N (€)</th>
                        <th style="text-align:right;">Définitif N-1 (€)</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td><strong>1. Régime de Base</strong></td>
                        <td style="text-align:right;" id="carp-base-n">0.00 €</td>
                        <td style="text-align:right;" id="carp-base-n1">0.00 €</td>
                    </tr>
                    <tr>
                        <td><strong>2. Régime Complémentaire</strong></td>
                        <td style="text-align:right;" id="carp-comp-n">0.00 €</td>
                        <td style="text-align:right;" id="carp-comp-n1">0.00 €</td>
                    </tr>
                    <tr>
                        <td><strong>3. Prévoyance (Incapacité / Décès)</strong></td>
                        <td style="text-align:right;" id="carp-prev-n">0.00 €</td>
                        <td style="text-align:right;" id="carp-prev-n1">0.00 €</td>
                    </tr>
                    <tr>
                        <td><strong>4. ASV (Avantages Sociaux)</strong></td>
                        <td style="text-align:right;" id="carp-asv-n">0.00 €</td>
                        <td style="text-align:right;" id="carp-asv-n1">0.00 €</td>
                    </tr>
                    <tr style="background:#f8fafc; font-weight:bold;">
                        <td>Sous-Total Cotisations</td>
                        <td style="text-align:right; color:#0284c7;" id="carp-total-n">0.00 €</td>
                        <td style="text-align:right; color:#d97706;" id="carp-total-n1">0.00 €</td>
                    </tr>
                    <tr style="background:#fffbe0; font-weight:bold;">
                        <td colspan="2">Solde de Régularisation N-1 (Définitif N-1 − Provisionnel versé N-1)</td>
                        <td style="text-align:right; color:#d97706;" id="carp-solde-reg-n1">0.00 €</td>
                    </tr>
                    <tr style="background:#f0fdf4; font-weight:bold; font-size:15px;">
                        <td colspan="2">TOTAL GÉNÉRAL EXIGIBLE (Provisionnel N + Régularisation N-1)</td>
                        <td style="text-align:right; color:#16a34a;" id="carp-total-exigible-table">0.00 €</td>
                    </tr>
                </tbody>
            </table>
        </div>
    `;

    // Lancement du premier calcul
    window.calculerCarpimkoSimulateur(totalPayeReel);
};

/**
 * Calculateur central des cotisations CARPIMKO
 */
window.calculerCarpimkoSimulateur = function(totalPayeReel) {
    var bncN2 = parseFloat(document.getElementById('carp-bnc-n2')?.value) || 0;
    var bncN1 = parseFloat(document.getElementById('carp-bnc-n1')?.value) || 0;
    var provN1Verses = parseFloat(document.getElementById('carp-prov-n1')?.value) || 0;
    
    var statut = document.getElementById('carp-statut')?.value || 'croisiere';
    var conventionne = document.getElementById('carp-conventionne')?.checked ?? true;

    // Fonction interne : calcul de cotisation selon un BNC donné
    function calculerCotisation(bncVal) {
        var base = 0, comp = 0, prev = 890, asv = 0;

        if (statut === 'annee1') {
            base = 840; comp = 1856; asv = conventionne ? 600 : 1800;
        } else if (statut === 'annee2') {
            base = 1250; comp = 1856; asv = conventionne ? 600 : 1800;
        } else {
            var PASS = 46368;
            if (bncVal <= PASS) {
                base = bncVal * 0.0823;
            } else {
                base = (PASS * 0.0823) + Math.min(bncVal - PASS, PASS * 4) * 0.0187;
            }

            var partFixeComp = 1856;
            var partPropComp = bncVal > 27000 ? Math.min(bncVal - 27000, 150000) * 0.07 : 0;
            comp = partFixeComp + partPropComp;

            var asvBrut = 1950 + (bncVal * 0.008);
            asv = conventionne ? asvBrut * 0.33 : asvBrut;
        }

        var total = base + comp + prev + asv;
        return { base: base, comp: comp, prev: prev, asv: asv, total: total };
    }

    // Calculs pour l'année N (basé sur BNC N-2) et N-1 (basé sur BNC N-1)
    var resN = calculerCotisation(bncN2);
    var resN1 = calculerCotisation(bncN1);

    var soldeRegN1 = resN1.total - provN1Verses;
    var totalExigible = resN.total + soldeRegN1;
    var ecartRestant = totalPayeReel - totalExigible;

    // Mise à jour de l'affichage du tableau
    document.getElementById('carp-base-n').textContent = resN.base.toFixed(2) + ' €';
    document.getElementById('carp-comp-n').textContent = resN.comp.toFixed(2) + ' €';
    document.getElementById('carp-prev-n').textContent = resN.prev.toFixed(2) + ' €';
    document.getElementById('carp-asv-n').textContent = resN.asv.toFixed(2) + ' €';
    document.getElementById('carp-total-n').textContent = resN.total.toFixed(2) + ' €';

    document.getElementById('carp-base-n1').textContent = resN1.base.toFixed(2) + ' €';
    document.getElementById('carp-comp-n1').textContent = resN1.comp.toFixed(2) + ' €';
    document.getElementById('carp-prev-n1').textContent = resN1.prev.toFixed(2) + ' €';
    document.getElementById('carp-asv-n1').textContent = resN1.asv.toFixed(2) + ' €';
    document.getElementById('carp-total-n1').textContent = resN1.total.toFixed(2) + ' €';

    var soldeRegEl = document.getElementById('carp-solde-reg-n1');
    if (soldeRegEl) {
        soldeRegEl.textContent = (soldeRegN1 >= 0 ? '+' : '') + soldeRegN1.toFixed(2) + ' €';
    }

    document.getElementById('carp-total-exigible-table').textContent = totalExigible.toFixed(2) + ' €';

    // Mise à jour des KPI du bandeau supérieur
    document.getElementById('carp-kpi-total-exigible').textContent = totalExigible.toFixed(2) + ' €';

    var kpiSoldeN1 = document.getElementById('carp-kpi-solde-n1');
    if (kpiSoldeN1) {
        kpiSoldeN1.textContent = (soldeRegN1 >= 0 ? '+' : '') + soldeRegN1.toFixed(2) + ' €';
        kpiSoldeN1.style.color = soldeRegN1 >= 0 ? '#d97706' : '#10b981';
    }

    var ecartEl = document.getElementById('carp-kpi-ecart');
    if (ecartEl) {
        ecartEl.textContent = (ecartRestant >= 0 ? '+' : '') + ecartRestant.toFixed(2) + ' €';
        ecartEl.style.color = ecartRestant >= 0 ? '#10b981' : '#ef4444';
    }
};
