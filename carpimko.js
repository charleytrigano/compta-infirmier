/**
 * carpimko.js - Module CARPIMKO pour Infirmier Libéral
 * Calculs Retraite de Base, Retraite Complémentaire et Invalidation-Décès (RID).
 */

(function () {
  window.anneeCarpimkoSelectionnee = window.anneeCarpimkoSelectionnee || new Date().getFullYear();

  var PLAFONDS_CARPIMKO = window.PLAFONDS_CARPIMKO || {
    2024: { pass: 46368 },
    2025: { pass: 47100 },
    2026: { pass: 47252 }
  };
  window.PLAFONDS_CARPIMKO = PLAFONDS_CARPIMKO;

  function formatEuro(valeur) {
    return Number(valeur || 0).toLocaleString('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  function calculerCarpimko(bnc = 47252, pass = 47252) {
    // 1. Régime de Base (Tranche 1: 8,23% jusqu'à 1 PASS, Tranche 2: 1,87% jusqu'à 5 PASS)
    const tr1Base = Math.min(Math.max(bnc, 0), pass);
    const tr2Base = Math.min(Math.max(bnc, 0), 5 * pass);
    const cotisBase = (tr1Base * 0.0823) + (tr2Base * 0.0187);

    // 2. Régime Complémentaire (Forfait + Proportionnel)
    const cotisCompForfait = 1976.00; // Cotisation forfaitaire
    const cotisCompProp = Math.min(Math.max(bnc - (0.85 * pass), 0), 5 * pass) * 0.0304;
    const cotisComp = cotisCompForfait + cotisCompProp;

    // 3. Régime Invalidation-Décès (RID) - Forfaitaire selon classe (Classe 1 par défaut)
    const cotisRID = 880.00;

    const totalAnnuel = cotisBase + cotisComp + cotisRID;

    return {
      base: +cotisBase.toFixed(2),
      complementaire: +cotisComp.toFixed(2),
      rid: +cotisRID.toFixed(2),
      totalAnnuel: +totalAnnuel.toFixed(2),
      trimestre: +(totalAnnuel / 4).toFixed(2)
    };
  }

  function obtenirConteneurCarpimko() {
    let target = document.getElementById('carpimko') || 
                 document.getElementById('vue-carpimko') || 
                 document.getElementById('carpimko-container');

    if (!target) {
      const main = document.querySelector('main') || document.querySelector('.content') || document.body;
      if (main) {
        target = document.createElement('div');
        target.id = 'carpimko-container';
        main.appendChild(target);
      }
    }
    return target;
  }

  window.actualiserCalculsCarpimko = function() {
    const elBnc = document.getElementById('car-input-bnc');
    const elPass = document.getElementById('car-input-pass');
    
    const bncVal = elBnc ? parseFloat(elBnc.value) || 0 : 47252;
    const passVal = elPass ? parseFloat(elPass.value) || 0 : 47252;

    const simu = calculerCarpimko(bncVal, passVal);

    const mapIds = {
      'car-simu-base': simu.base,
      'car-simu-comp': simu.complementaire,
      'car-simu-rid': simu.rid,
      'car-simu-total': simu.totalAnnuel,
      'car-simu-trim': simu.trimestre
    };

    for (const [id, val] of Object.entries(mapIds)) {
      const el = document.getElementById(id);
      if (el) el.textContent = formatEuro(val);
    }
  };

  function renderCarpimkoUI() {
    const container = obtenirConteneurCarpimko();
    if (!container) return;

    const anneeActive = window.anneeCarpimkoSelectionnee;
    const passAnnee = (PLAFONDS_CARPIMKO[anneeActive] || { pass: 47252 }).pass;

    container.innerHTML = `
      <div class="space-y-6 max-w-6xl mx-auto p-4 font-sans text-slate-800">
        <div class="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex flex-wrap justify-between items-center gap-4">
          <div>
            <h2 class="text-xl font-bold text-slate-800 flex items-center gap-2">
              🏥 Cotisations CARPIMKO (${anneeActive})
            </h2>
            <p class="text-xs text-slate-500 mt-1">Caisse de retraite et de prévoyance des infirmiers libéraux</p>
          </div>
        </div>

        <div class="bg-white p-5 rounded-xl shadow-sm border border-slate-200 space-y-4">
          <h3 class="text-xs font-bold uppercase tracking-wider text-blue-700">1. Assiette de Calcul</h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-semibold text-slate-700 mb-1">BNC Estimé (€) :</label>
              <input type="number" id="car-input-bnc" value="47252" class="w-full text-xs border border-slate-300 rounded-lg p-2 bg-slate-50 focus:bg-white font-bold" oninput="actualiserCalculsCarpimko()">
            </div>
            <div>
              <label class="block text-xs font-semibold text-slate-700 mb-1">PASS de l'Année (€) :</label>
              <input type="number" id="car-input-pass" value="${passAnnee}" class="w-full text-xs border border-slate-300 rounded-lg p-2 bg-slate-50 focus:bg-white font-semibold text-blue-700" oninput="actualiserCalculsCarpimko()">
            </div>
          </div>
        </div>

        <div class="bg-white p-5 rounded-xl shadow-sm border border-slate-200 space-y-3">
          <h3 class="text-xs font-bold uppercase tracking-wider text-blue-700">2. Estimation des Cotisations Annuelles</h3>
          <div class="overflow-x-auto">
            <table class="w-full text-xs text-left border-collapse">
              <thead>
                <tr class="bg-slate-100 text-slate-700 font-bold border-b">
                  <th class="py-2 px-3">Régime</th>
                  <th class="py-2 px-3 text-right">Montant Estimé (€)</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                <tr>
                  <td class="py-2 px-3 font-semibold">Régime de Base (Tranche 1 + Tranche 2)</td>
                  <td id="car-simu-base" class="py-2 px-3 text-right font-bold text-slate-800">--</td>
                </tr>
                <tr>
                  <td class="py-2 px-3 font-semibold">Régime Complémentaire</td>
                  <td id="car-simu-comp" class="py-2 px-3 text-right font-bold text-slate-800">--</td>
                </tr>
                <tr>
                  <td class="py-2 px-3 font-semibold">Invalidation - Décès (RID)</td>
                  <td id="car-simu-rid" class="py-2 px-3 text-right font-bold text-slate-800">--</td>
                </tr>
                <tr class="bg-slate-800 text-white font-bold text-sm">
                  <td class="py-2.5 px-3">TOTAL ANNUEL CARPIMKO</td>
                  <td id="car-simu-total" class="py-2.5 px-3 text-right text-emerald-400 font-extrabold">--</td>
                </tr>
                <tr class="bg-slate-100 text-slate-700 font-semibold text-xs">
                  <td class="py-2 px-3">Appel Trimestriel Estimé (÷ 4)</td>
                  <td id="car-simu-trim" class="py-2 px-3 text-right text-blue-700 font-bold">--</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    actualiserCalculsCarpimko();
  }

  window.initCarpimkoModule = renderCarpimkoUI;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderCarpimkoUI);
  } else {
    renderCarpimkoUI();
  }
})();
