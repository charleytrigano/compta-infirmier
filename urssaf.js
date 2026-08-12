// ==========================================
// MODULE INDÉPENDANT : URSSAF (DÉCLARATION OFFICIELLE PAMC)
// ==========================================

window.initUrssaf = function() {
    var container = document.getElementById('urssaf-container');
    if (!container) return;

    // 1. Extraction des paiements URSSAF dans l'historique bancaire
    var transactions = window.allTransactions || [];
    var totalPayeReel = 0;
    var nbVersements = 0;

    transactions.forEach(function(tx) {
        var cat = (tx.category || '').toLowerCase();
        if (cat.includes('urssaf')) {
            totalPayeReel += parseFloat(tx.amount) || 0;
            nbVersements++;
        }
    });

    // 2. Structure HTML et styles d'affichage officiel
    container.innerHTML = `
        <style>
            .urs-card {
                background: #ffffff; padding: 20px; border-radius: 8px;
                box-shadow: 0 1px 3px rgba(0,0,0,0.08); margin-bottom: 20px;
                border: 1px solid var(--border, #e2e8f0);
            }
            .urs-grid-2 { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 15px; }
            .urs-grid-4 { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; }
            .urs-form-group { margin-bottom: 15px; }
            .urs-form-group label { display: block; margin-bottom: 5px; font-weight: 600; font-size: 14px; }
            .urs-form-group input, .urs-form-group select {
                width: 100%; padding: 10px; border: 1px solid #ced4da;
                border-radius: 6px; box-sizing: border-box; font-size: 14px;
            }
            .urs-kpi {
                background: #f8fafc; padding: 15px; border-radius: 6px;
                border: 1px solid var(--border, #e2e8f0); text-align: center;
            }
            .urs-kpi-val { font-size: 1.4em; font-weight: bold; margin-top: 4px; }
            .urs-table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            .urs-table th, .urs-table td { padding: 10px 12px; border-bottom: 1px solid #e2e8f0; text-align: left; font-size: 13px; }
            .urs-table th { background: #f8fafc; font-weight: 600; }
            .urs-tag-cpam { background: #dcfce7; color: #166534; padding: 2px 6px; border-radius: 4px; font-size: 11px; font-weight: bold; }
        </style>

        <!-- BANDEAU SYNTHÈSE BANCATION ET EXIGIBLE -->
        <div class="urs-card" style="background: #f0fdf4; border-left: 5px solid #16a34a;">
            <h3 style="margin-top: 0; color: #15803d; font-size: 16px;">🏛️ Déclaration & Rapprochement URSSAF PAMC</h3>
            <div class="urs-grid-4" style="margin-top: 10px;">
                <div class="urs-kpi" style="background: #ffffff;">
                    <small style="color: #64748b;">Déjà Prélevé (Banque)</small>
                    <div class="urs-kpi-val" style="color: #ef4444;">${totalPayeReel.toFixed(2)} €</div>
                    <small style="font-size: 11px; color: #94a3b8;">${nbVersements} versement(s)</small>
                </div>
                <div class="urs-kpi" style="background: #ffffff;">
                    <small style="color: #64748b;">Net Dû Exigible</small>
                    <div class="urs-kpi-val" id="urs-kpi-net-exigible" style="color: #16a34a;">0.00 €</div>
                    <small style="font-size: 11px; color: #94a3b8;">Après déduction CPAM</small>
                </div>
                <div class="urs-kpi" style="background: #ffffff;">
                    <small style="color: #64748b;">Prise en Charge CPAM</small>
                    <div class="urs-kpi-val" id="urs-kpi-cpam" style="color: #2563eb;">0.00 €</div>
                    <small style="font-size: 11px; color: #94a3b8;">Avantage Social</small>
                </div>
                <div class="urs-kpi" style="background: #ffffff;">
                    <small style="color: #64748b;">Solde Restant</small>
                    <div class="urs-kpi-val" id="urs-kpi-solde">0.00 €</div>
                </div>
            </div>
        </div>

        <!-- PARAMÈTRES FINANCIERS -->
        <div class="urs-card">
            <h3 style="margin-top: 0; color: #0f172a; border-bottom: 2px solid #16a34a; padding-bottom: 8px;">1. Assiette de Calcul (BNC & Secteur)</h3>
            <div class="urs-grid-2">
                <div class="urs-form-group">
                    <label for="urs-bnc-n2">BNC N-2 (Provisionnel N) (€) :</label>
                    <input type="number" id="urs-bnc-n2" value="40000" step="500" oninput="window.calculerUrssafSimulateur(${totalPayeReel})">
                </div>
                <div class="urs-form-group">
                    <label for="urs-bnc-n1">BNC Réel N-1 (Régularisation) (€) :</label>
                    <input type="number" id="urs-bnc-n1" value="42000" step="500" oninput="window.calculerUrssafSimulateur(${totalPayeReel})">
                </div>
            </div>
            <div class="urs-grid-2">
                <div class="urs-form-group">
                    <label for="urs-prov-n1">Acomptes URSSAF versés en N-1 (€) :</label>
                    <input type="number" id="urs-prov-n1" value="8500" step="100" oninput="window.calculerUrssafSimulateur(${totalPayeReel})">
                </div>
                <div class="urs-form-group">
                    <label for="urs-taux-conv">Taux d'actes conventionnés (%) :</label>
                    <input type="number" id="urs-taux-conv" value="100" min="0" max="100" oninput="window.calculerUrssafSimulateur(${totalPayeReel})">
                </div>
            </div>
        </div>

        <!-- TABLEAU DE VENTILATION OFFICIEL -->
        <div class="urs-card">
            <h3 style="margin-top: 0; color: #0f172a; border-bottom: 2px solid #16a34a; padding-bottom: 8px;">2. Tableau de Ventilation Complète (Déclaration Officielle)</h3>
            <table class="urs-table">
                <thead>
                    <tr>
                        <th>Cotisation / Contribution</th>
                        <th style="text-align:right;">Brut N (€)</th>
                        <th style="text-align:right;">Prise en charge CPAM (€)</th>
                        <th style="text-align:right;">Net N (€)</th>
                        <th style="text-align:right;">Régul. N-1 (€)</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td><strong>Maladie-Maternité (PAMC)</strong></td>
                        <td style="text-align:right;" id="urs-brut-maladie">0.00 €</td>
                        <td style="text-align:right; color:#2563eb;" id="urs-cpam-maladie">-0.00 €</td>
                        <td style="text-align:right;" id="urs-net-maladie">0.00 €</td>
                        <td style="text-align:right;" id="urs-reg-maladie">0.00 €</td>
                    </tr>
                    <tr>
                        <td><strong>Allocations Familiales</strong></td>
                        <td style="text-align:right;" id="urs-brut-af">0.00 €</td>
                        <td style="text-align:right; color:#2563eb;">0.00 €</td>
                        <td style="text-align:right;" id="urs-net-af">0.00 €</td>
                        <td style="text-align:right;" id="urs-reg-af">0.00 €</td>
                    </tr>
                    <tr>
                        <td><strong>CSG Déductible (6.8%)</strong></td>
                        <td style="text-align:right;" id="urs-brut-csgded">0.00 €</td>
                        <td style="text-align:right; color:#2563eb;">0.00 €</td>
                        <td style="text-align:right;" id="urs-net-csgded">0.00 €</td>
                        <td style="text-align:right;" id="urs-reg-csgded">0.00 €</td>
                    </tr>
                    <tr>
                        <td><strong>CSG / CRDS non déductible (2.9%)</strong></td>
                        <td style="text-align:right;" id="urs-brut-csgcrds">0.00 €</td>
                        <td style="text-align:right; color:#2563eb;">0.00 €</td>
                        <td style="text-align:right;" id="urs-net-csgcrds">0.00 €</td>
                        <td style="text-align:right;" id="urs-reg-csgcrds">0.00 €</td>
                    </tr>
                    <tr>
                        <td><strong>Formation Professionnelle (CFP)</strong></td>
                        <td style="text-align:right;" id="urs-brut-cfp">0.00 €</td>
                        <td style="text-align:right; color:#2563eb;">0.00 €</td>
                        <td style="text-align:right;" id="urs-net-cfp">0.00 €</td>
                        <td style="text-align:right;" id="urs-reg-cfp">0.00 €</td>
                    </tr>
                    <tr>
                        <td><strong>CURPS (Unions Régionales)</strong></td>
                        <td style="text-align:right;" id="urs-brut-curps">0.00 €</td>
                        <td style="text-align:right; color:#2563eb;">0.00 €</td>
                        <td style="text-align:right;" id="urs-net-curps">0.00 €</td>
                        <td style="text-align:right;" id="urs-reg-curps">0.00 €</td>
                    </tr>
                    <tr style="background:#f8fafc; font-weight:bold;">
                        <td>TOTAL DES COTISATIONS</td>
                        <td style="text-align:right;" id="urs-total-brut">0.00 €</td>
                        <td style="text-align:right; color:#2563eb;" id="urs-total-cpam">0.00 €</td>
                        <td style="text-align:right; color:#16a34a;" id="urs-total-net-n">0.00 €</td>
                        <td style="text-align:right; color:#d97706;" id="urs-total-reg-n1">0.00 €</td>
                    </tr>
                    <tr style="background:#f0fdf4; font-weight:bold; font-size:15px;">
                        <td colspan="3">NET GLOBAL EXIGIBLE (Provisionnel N + Régularisation N-1)</td>
                        <td colspan="2" style="text-align:right; color:#16a34a;" id="urs-total-exigible-final">0.00 €</td>
                    </tr>
                </tbody>
            </table>
        </div>
    `;

    // Calcul initial
    window.calculerUrssafSimulateur(totalPayeReel);
};

/**
 * Calculateur algorithmique des cotisations URSSAF PAMC
 */
window.calculerUrssafSimulateur = function(totalPayeReel) {
    var bncN2 = parseFloat(document.getElementById('urs-bnc-n2')?.value) || 0;
    var bncN1 = parseFloat(document.getElementById('urs-bnc-n1')?.value) || 0;
    var provN1Verses = parseFloat(document.getElementById('urs-prov-n1')?.value) || 0;
    var pctConv = (parseFloat(document.getElementById('urs-taux-conv')?.value) || 100) / 100;

    var PASS = 46368; // Plafond Annuel Sécurité Sociale

    // Fonction interne de calcul de la grille URSSAF PAMC
    function toutCalculer(bncVal) {
        // 1. Maladie-Maternité
        var brutMaladie = bncVal * 0.098; // Taux plein ~9.8%
        var priseEnChargeCpam = bncVal * 0.097 * pctConv; // CPAM prend en charge 9.7% sur la part conventionnée
        var netMaladie = Math.max(0, brutMaladie - priseEnChargeCpam);

        // 2. Allocations Familiales (Taux progressif de 0% à 3.10%)
        var tauxAF = 0;
        if (bncVal > PASS * 1.4) {
            tauxAF = 0.031;
        } else if (bncVal > PASS * 1.1) {
            tauxAF = ((bncVal - PASS * 1.1) / (PASS * 0.3)) * 0.031;
        }
        var netAF = bncVal * tauxAF;

        // 3. Assiette CSG/CRDS (BNC + Cotisations sociales estimées à ~15%)
        var assietteCSG = bncVal * 1.15;
        var csgDed = assietteCSG * 0.068;
        var csgCrdsNonDed = assietteCSG * 0.029;

        // 4. CFP (Formation professionnelle : ~0.25% du PASS)
        var cfp = PASS * 0.0025;

        // 5. CURPS (0.50% du BNC plafonné à 0.50% du PASS)
        var curps = Math.min(bncVal, PASS) * 0.005;

        var totalBrut = brutMaladie + netAF + csgDed + csgCrdsNonDed + cfp + curps;
        var totalNet = netMaladie + netAF + csgDed + csgCrdsNonDed + cfp + curps;

        return {
            brutMaladie: brutMaladie,
            cpam: priseEnChargeCpam,
            netMaladie: netMaladie,
            netAF: netAF,
            csgDed: csgDed,
            csgCrdsNonDed: csgCrdsNonDed,
            cfp: cfp,
            curps: curps,
            totalBrut: totalBrut,
            totalNet: totalNet
        };
    }

    var resN = toutCalculer(bncN2);
    var resN1 = toutCalculer(bncN1);

    var reguN1Total = resN1.totalNet - provN1Verses;
    var netExigibleFinal = resN.totalNet + reguN1Total;
    var soldeBancaire = totalPayeReel - netExigibleFinal;

    // Mise à jour du tableau
    document.getElementById('urs-brut-maladie').textContent = resN.brutMaladie.toFixed(2) + ' €';
    document.getElementById('urs-cpam-maladie').textContent = '-' + resN.cpam.toFixed(2) + ' €';
    document.getElementById('urs-net-maladie').textContent = resN.netMaladie.toFixed(2) + ' €';
    document.getElementById('urs-reg-maladie').textContent = (resN1.netMaladie - (resN.netMaladie)).toFixed(2) + ' €';

    document.getElementById('urs-brut-af').textContent = resN.netAF.toFixed(2) + ' €';
    document.getElementById('urs-net-af').textContent = resN.netAF.toFixed(2) + ' €';

    document.getElementById('urs-brut-csgded').textContent = resN.csgDed.toFixed(2) + ' €';
    document.getElementById('urs-net-csgded').textContent = resN.csgDed.toFixed(2) + ' €';

    document.getElementById('urs-brut-csgcrds').textContent = resN.csgCrdsNonDed.toFixed(2) + ' €';
    document.getElementById('urs-net-csgcrds').textContent = resN.csgCrdsNonDed.toFixed(2) + ' €';

    document.getElementById('urs-brut-cfp').textContent = resN.cfp.toFixed(2) + ' €';
    document.getElementById('urs-net-cfp').textContent = resN.cfp.toFixed(2) + ' €';

    document.getElementById('urs-brut-curps').textContent = resN.curps.toFixed(2) + ' €';
    document.getElementById('urs-net-curps').textContent = resN.curps.toFixed(2) + ' €';

    // Totaux tableau
    document.getElementById('urs-total-brut').textContent = resN.totalBrut.toFixed(2) + ' €';
    document.getElementById('urs-total-cpam').textContent = '-' + resN.cpam.toFixed(2) + ' €';
    document.getElementById('urs-total-net-n').textContent = resN.totalNet.toFixed(2) + ' €';
    document.getElementById('urs-total-reg-n1').textContent = (reguN1Total >= 0 ? '+' : '') + reguN1Total.toFixed(2) + ' €';
    document.getElementById('urs-total-exigible-final').textContent = netExigibleFinal.toFixed(2) + ' €';

    // KPI Supérieurs
    document.getElementById('urs-kpi-net-exigible').textContent = netExigibleFinal.toFixed(2) + ' €';
    document.getElementById('urs-kpi-cpam').textContent = resN.cpam.toFixed(2) + ' €';

    var kpiSolde = document.getElementById('urs-kpi-solde');
    if (kpiSolde) {
        kpiSolde.textContent = (soldeBancaire >= 0 ? '+' : '') + soldeBancaire.toFixed(2) + ' €';
        kpiSolde.style.color = soldeBancaire >= 0 ? '#10b981' : '#ef4444';
    }
};
