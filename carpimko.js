// ==========================================
// MODULE INDÉPENDANT : CARPIMKO (SIMULATEUR & COMPARATIF)
// ==========================================

window.initCarpimko = function() {
    var container = document.getElementById('carpimko-container');
    if (!container) return;

    // 1. Récupération et calcul des paiements réels depuis les transactions
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

    // 2. Injection du style et de l'interface HTML
    container.innerHTML = `
        <style>
            .carp-card {
                background: #ffffff; padding: 20px; border-radius: 8px;
                box-shadow: 0 1px 3px rgba(0,0,0,0.08); margin-bottom: 20px;
                border: 1px solid var(--border, #e2e8f0);
            }
            .carp-grid-2 { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 15px; }
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
            .carp-kpi-val { font-size: 1.5em; font-weight: bold; margin-top: 4px; }
            .carp-table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            .carp-table th, .carp-table td { padding: 10px 12px; border-bottom: 1px solid #e2e8f0; text-align: left; font-size: 14px; }
            .carp-table th { background: #f8fafc; font-weight: 600; }
        </style>

        <!-- BANDEAU COMPARATIF (RÉEL VS THÉORIQUE) -->
        <div class="carp-card" style="background: #f0f9ff; border-left: 5px solid #0284c7;">
            <h3 style="margin-top: 0; color: #0369a1; font-size: 16px;">📊 Rapprochement Comptable CARPIMKO</h3>
            <div class="carp-grid-4" style="margin-top: 10px;">
                <div class="carp-kpi" style="background: #ffffff;">
                    <small style="color: #64748b;">Déjà Prélevé (Banque)</small>
                    <div class="carp-kpi-val" style="color: #ef4444;">${totalPayeReel.toFixed(2)} €</div>
                    <small style="font-size: 11px; color: #94a3b8;">${nbVersements} versement(s)</small>
                </div>
                <div class="carp-kpi" style="background: #ffffff;">
                    <small style="color: #64748b;">Théorique Estimé (BNC)</small>
                    <div class="carp-kpi-val" id="carp-kpi-theorique" style="color: #0284c7;">0.00 €</div>
                </div>
                <div class="carp-kpi" style="background: #ffffff;">
                    <small style="color: #64748b;">Écart / Régularisation</small>
                    <div class="carp-kpi-val" id="carp-kpi-ecart">0.00 €</div>
                </div>
                <div class="carp-kpi" style="background: #ffffff;">
                    <small style="color: #64748b;">Taux Effectif / BNC</small>
                    <div class="carp-kpi-val" id="carp-kpi-taux" style="color: #334155;">0.0 %</div>
                </div>
            </div>
        </div>

        <!-- SECTION 1 : PARAMÈTRES DU CALCUL -->
        <div class="carp-card">
            <h3 style="margin-top: 0; color: #0f172a; border-bottom: 2px solid #0284c7; padding-bottom: 8px;">1. Vos Données Financières (Base N-2)</h3>
            <div class="carp-grid-2">
                <div class="carp-form-group">
                    <label for="carp-bnc">Bénéfice Non Commercial - BNC (€) :</label>
                    <input type="number" id="carp-bnc" value="40000" step="500" oninput="window.calculerCarpimkoSimulateur(${totalPayeReel})">
                    <small style="color:#64748b; font-size: 12px;">Revenu net (Recettes moins Dépenses) de l'année N-2.</small>
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
                    Infirmier Libéral Conventionné (Prise en charge partielle de l'ASV par l'Assurance Maladie)
                </label>
            </div>
        </div>

        <!-- SECTION 2 : VENTILATION DÉTAILLÉE -->
        <div class="carp-card">
            <h3 style="margin-top: 0; color: #0f172a; border-bottom: 2px solid #0284c7; padding-bottom: 8px;">2. Ventilation Détaillée par Régime Obligatoire</h3>
            <table class="carp-table">
                <thead>
                    <tr>
                        <th>Régime</th>
                        <th>Description / Base de calcul</th>
                        <th style="text-align:right;">Montant Dû (€)</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td><strong>1. Régime de Base</strong></td>
                        <td>Cotisation Tranche 1 (8.23% jusqu'à 46 368 €) + Tranche 2 (1.87% jusqu'à 231 840 €)</td>
                        <td style="text-align:right; font-weight: 500;" id="carp-regimeBase">0.00 €</td>
                    </tr>
                    <tr>
                        <td><strong>2. Régime Complémentaire</strong></td>
                        <td>Forfait de base (1 856 €) + Cotisation proportionnelle sur le BNC</td>
                        <td style="text-align:right; font-weight: 500;" id="carp-regimeComp">0.00 €</td>
                    </tr>
                    <tr>
                        <td><strong>3. Prévoyance (Incapacité / Décès)</strong></td>
                        <td>Forfait annuel pour la couverture arrêt de travail et invalidité</td>
                        <td style="text-align:right; font-weight: 500;" id="carp-regimePrev">0.00 €</td>
                    </tr>
                    <tr>
                        <td><strong>4. ASV (Avantages Sociaux)</strong></td>
                        <td>Forfait + Part proportionnelle (Ajusté si conventionné)</td>
                        <td style="text-align:right; font-weight: 500;" id="carp-regimeASV">0.00 €</td>
                    </tr>
                    <tr style="background:#f8fafc; font-weight:bold;">
                        <td colspan="2">TOTAL COTISATIONS CARPIMKO THÉORIQUE</td>
                        <td style="text-align:right; color:#0284c7; font-size: 15px;" id="carp-tableTotal">0.00 €</td>
                    </tr>
                </tbody>
            </table>
        </div>
    `;

    // Lancement du premier calcul dynamique
    window.calculerCarpimkoSimulateur(totalPayeReel);
};

/**
 * Fonction de calcul algorithmique CARPIMKO
 */
window.calculerCarpimkoSimulateur = function(totalPayeReel) {
    var bncInput = document.getElementById('carp-bnc');
    var statutInput = document.getElementById('carp-statut');
    var conventionneInput = document.getElementById('carp-conventionne');

    if (!bncInput || !statutInput) return;

    var bnc = parseFloat(bncInput.value) || 0;
    var statut = statutInput.value;
    var conventionne = conventionneInput.checked;

    var totalBase = 0;
    var totalComp = 0;
    var totalPrev = 890; // Forfait prévoyance moyen
    var totalASV = 0;

    if (statut === 'annee1') {
        totalBase = 840;
        totalComp = 1856;
        totalASV = conventionne ? 600 : 1800;
    } else if (statut === 'annee2') {
        totalBase = 1250;
        totalComp = 1856;
        totalASV = conventionne ? 600 : 1800;
    } else {
        // REGIME DE CROISIERE
        var PASS = 46368; // Plafond Annuel Sécurité Sociale (Référence)
        if (bnc <= PASS) {
            totalBase = bnc * 0.0823;
        } else {
            totalBase = (PASS * 0.0823) + Math.min(bnc - PASS, PASS * 4) * 0.0187;
        }

        // Régime Complémentaire
        var partFixeComp = 1856;
        var partPropComp = 0;
        if (bnc > 27000) {
            partPropComp = Math.min(bnc - 27000, 150000) * 0.07;
        }
        totalComp = partFixeComp + partPropComp;

        // ASV (Avantage Social Vieillesse)
        var asvBrut = 1950 + (bnc * 0.008);
        if (conventionne) {
            totalASV = asvBrut * 0.33; // Prise en charge à 66%
        } else {
            totalASV = asvBrut;
        }
    }

    var totalAnnuelTheorique = totalBase + totalComp + totalPrev + totalASV;
    var tauxEffectif = bnc > 0 ? (totalAnnuelTheorique / bnc) * 100 : 0;
    var ecart = totalPayeReel - totalAnnuelTheorique;

    // Mise à jour de l'affichage du tableau
    document.getElementById('carp-regimeBase').textContent = totalBase.toFixed(2) + ' €';
    document.getElementById('carp-regimeComp').textContent = totalComp.toFixed(2) + ' €';
    document.getElementById('carp-regimePrev').textContent = totalPrev.toFixed(2) + ' €';
    document.getElementById('carp-regimeASV').textContent = totalASV.toFixed(2) + ' €';
    document.getElementById('carp-tableTotal').textContent = totalAnnuelTheorique.toFixed(2) + ' €';

    // Mise à jour des KPI du bandeau supérieur
    document.getElementById('carp-kpi-theorique').textContent = totalAnnuelTheorique.toFixed(2) + ' €';
    document.getElementById('carp-kpi-taux').textContent = tauxEffectif.toFixed(1) + ' %';

    var ecartEl = document.getElementById('carp-kpi-ecart');
    if (ecartEl) {
        if (ecart >= 0) {
            ecartEl.textContent = '+' + ecart.toFixed(2) + ' €';
            ecartEl.style.color = '#10b981'; // Vert : trop-perçu / avance
        } else {
            ecartEl.textContent = ecart.toFixed(2) + ' €';
            ecartEl.style.color = '#ef4444'; // Rouge : reste à payer / régularisation
        }
    }
};
