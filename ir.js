/**
 * ir.js - Module de calcul de l'Impôt sur le Revenu (IR) pour TNS / Infirmier Libéral / Micro-Entreprise
 */

// Barème de l'Impôt sur le Revenu 2026 (Revenus 2025)
const TRANCHES_IR = [
  { min: 0, max: 11294, taux: 0 },
  { min: 11294, max: 28797, taux: 0.11 },
  { min: 28797, max: 82341, taux: 0.30 },
  { min: 82341, max: 177106, taux: 0.41 },
  { min: 177106, max: Infinity, taux: 0.45 }
];

function formatEuroIR(valeur) {
  return Number(valeur || 0).toLocaleString('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function calculerIR(caOuBnc = 45000, situation = 'celibataire', enfants = 0, regimeFisc = 'reel', revenusAutres = 0) {
  let reventeBNCImposable = 0;
  let impotVersementLiberatoire = 0;

  // 1. Détermination de la base imposable selon le régime fiscal
  if (regimeFisc === 'micro_vl') {
    // Micro-Entreprise avec Option Versement Libératoire (2,2 % du CA HT pour BNC)
    impotVersementLiberatoire = caOuBnc * 0.022;
    reventeBNCImposable = 0; // Exonéré du barème progressif (libéré par le virement forfaitaire)
  } else if (regimeFisc === 'micro') {
    // Micro-BNC Classique : Abattement forfaitaire de 34% (minimum 305 €)
    const abattement = Math.max(305, caOuBnc * 0.34);
    reventeBNCImposable = Math.max(0, caOuBnc - abattement);
  } else {
    // Régime Réel (Déclaration 2035)
    reventeBNCImposable = caOuBnc;
  }

  const revenuNetGlobal = reventeBNCImposable + revenusAutres;

  // 2. Calcul du nombre de parts fiscales (Quotient Familial)
  let nbParts = 1;
  if (situation === 'marie' || situation === 'pacs') {
    nbParts = 2;
  }

  if (enfants === 1) nbParts += 0.5;
  else if (enfants === 2) nbParts += 1;
  else if (enfants > 2) nbParts += 1 + (enfants - 2) * 1;

  if (situation === 'parent_isole' && enfants > 0) {
    nbParts += 0.5;
  }

  // 3. Application du quotient familial & barème progressif
  const revenuParPart = revenuNetGlobal / nbParts;
  let impotParPart = 0;
  let detailTranches = [];

  TRANCHES_IR.forEach(tranche => {
    if (revenuParPart > tranche.min) {
      const assiette = Math.min(revenuParPart, tranche.max) - tranche.min;
      const impotTranche = assiette * tranche.taux;
      impotParPart += impotTranche;

      if (assiette > 0) {
        detailTranches.push({
          min: tranche.min,
          max: tranche.max,
          taux: tranche.taux * 100,
          assietteParPart: assiette,
          impotParPart: impotTranche,
          impotTotal: impotTranche * nbParts
        });
      }
    }
  });

  const impotBaremeTotal = Math.round(impotParPart * nbParts);
  const impotTotalDu = impotBaremeTotal + Math.round(impotVersementLiberatoire);

  // Taux Moyen et Taux Marginal d'Imposition (TMI)
  const tmi = detailTranches.length > 0 ? detailTranches[detailTranches.length - 1].taux : 0;
  const totalRevenuFoyer = caOuBnc + revenusAutres;
  const tauxMoyen = totalRevenuFoyer > 0 ? ((impotTotalDu / totalRevenuFoyer) * 100).toFixed(2) : 0;

  return {
    caOuBnc,
    regimeFisc,
    reventeBNCImposable: +reventeBNCImposable.toFixed(2),
    revenuNetGlobal: +revenuNetGlobal.toFixed(2),
    impotVersementLiberatoire: +impotVersementLiberatoire.toFixed(2),
    impotBaremeTotal,
    impotTotalDu,
    nbParts,
    tmi,
    tauxMoyen,
    detailTranches
  };
}

function renderIRUI() {
  const container = document.getElementById('ir-container');
  if (!container) return;

  const bncInput = parseFloat(document.getElementById('ir-input-bnc')?.value) || 45000;
  const regimeSelect = document.getElementById('ir-select-regime')?.value || 'reel';
  const situationSelect = document.getElementById('ir-select-situation')?.value || 'celibataire';
  const enfantsInput = parseInt(document.getElementById('ir-input-enfants')?.value) || 0;
  const autresRevInput = parseFloat(document.getElementById('ir-input-autres')?.value) || 0;

  const res = calculerIR(bncInput, situationSelect, enfantsInput, regimeSelect, autresRevInput);

  container.innerHTML = `
    <div class="space-y-6 max-w-5xl mx-auto p-4 font-sans text-slate-800">

      <!-- ENTÊTE -->
      <div class="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex flex-wrap justify-between items-center gap-4">
        <div>
          <h2 class="text-xl font-bold text-slate-800 flex items-center gap-2">
            🧮 Simulateur Impôt sur le Revenu (IR & Micro-Entreprise)
          </h2>
          <p class="text-xs text-slate-500 mt-1">Comparateur Régime Réel, Micro-BNC et Versement Libératoire</p>
        </div>
        <div class="bg-blue-50 text-blue-800 text-xs px-3 py-1.5 rounded-lg font-semibold border border-blue-200">
          Base Imposable au Barème : ${formatEuroIR(res.revenuNetGlobal)}
        </div>
      </div>

      <!-- CARTE RÉSULTATS CLÉS -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm text-center">
          <span class="text-xs text-slate-500 uppercase font-bold">Impôt Total Dû</span>
          <p class="text-2xl font-black text-blue-600 mt-1">${formatEuroIR(res.impotTotalDu)}</p>
          ${res.impotVersementLiberatoire > 0 ? `<span class="text-[10px] text-emerald-600 font-medium">(dont ${formatEuroIR(res.impotVersementLiberatoire)} de V.L.)</span>` : ''}
        </div>
        <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm text-center">
          <span class="text-xs text-slate-500 uppercase font-bold">Taux Marginal (TMI)</span>
          <p class="text-2xl font-black text-amber-600 mt-1">${res.tmi}%</p>
        </div>
        <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm text-center">
          <span class="text-xs text-slate-500 uppercase font-bold">Pression Fiscale Effective</span>
          <p class="text-2xl font-black text-emerald-600 mt-1">${res.tauxMoyen}%</p>
        </div>
      </div>

      <!-- FORMULAIRE DE PARAMÈTRES -->
      <div class="bg-white p-5 rounded-xl shadow-sm border border-slate-200 space-y-4">
        <h3 class="text-xs font-bold uppercase tracking-wider text-blue-700">
          1. Paramètres Fiscaux et Régime de L'Entreprise
        </h3>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label class="block text-xs font-semibold text-slate-700 mb-1">
              ${regimeSelect.startsWith('micro') ? 'Chiffre d\'Affaires / Recettes (€) :' : 'BNC / Bénéfice Annuel (€) :'}
            </label>
            <input type="number" id="ir-input-bnc" value="${bncInput}" class="w-full text-xs border border-slate-300 rounded-lg p-2 bg-slate-50 focus:bg-white" oninput="window.actualiserIR()">
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-700 mb-1">Régime Fiscal :</label>
            <select id="ir-select-regime" class="w-full text-xs border border-slate-300 rounded-lg p-2 bg-slate-50 focus:bg-white" onchange="window.actualiserIR()">
              <option value="reel" ${res.regimeFisc === 'reel' ? 'selected' : ''}>Déclaration 2035 (Régime Réel)</option>
              <option value="micro" ${res.regimeFisc === 'micro' ? 'selected' : ''}>Micro-BNC Standard (Abattement 34%)</option>
              <option value="micro_vl" ${res.regimeFisc === 'micro_vl' ? 'selected' : ''}>Micro-Entreprise (Versement Libératoire 2,2%)</option>
            </select>
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-700 mb-1">Situation Familiale :</label>
            <select id="ir-select-situation" class="w-full text-xs border border-slate-300 rounded-lg p-2 bg-slate-50 focus:bg-white" onchange="window.actualiserIR()">
              <option value="celibataire" ${situationSelect === 'celibataire' ? 'selected' : ''}>Célibataire / Divorcé(e)</option>
              <option value="marie" ${situationSelect === 'marie' ? 'selected' : ''}>Marié(e) / PACS</option>
              <option value="parent_isole" ${situationSelect === 'parent_isole' ? 'selected' : ''}>Parent Isolé</option>
            </select>
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-700 mb-1">Nombre d'enfants à charge :</label>
            <input type="number" min="0" id="ir-input-enfants" value="${enfantsInput}" class="w-full text-xs border border-slate-300 rounded-lg p-2 bg-slate-50 focus:bg-white" oninput="window.actualiserIR()">
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-700 mb-1">Autres revenus net du foyer (€) :</label>
            <input type="number" id="ir-input-autres" value="${autresRevInput}" class="w-full text-xs border border-slate-300 rounded-lg p-2 bg-slate-50 focus:bg-white" oninput="window.actualiserIR()">
          </div>

          <div class="flex items-center pt-4 text-xs font-bold text-slate-600">
            <span>Parts fiscales : <strong class="text-blue-600 text-sm">${res.nbParts} part(s)</strong></span>
          </div>
        </div>
      </div>

      <!-- DETAIL DU BAREME PAR TRANCHES -->
      <div class="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
        <h3 class="text-xs font-bold uppercase tracking-wider text-blue-700 mb-3">
          2. Détail du Calcul de l'Impôt
        </h3>

        ${res.regimeFisc === 'micro_vl' ? `
          <div class="p-3 mb-4 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800">
            <strong>Option Versement Libératoire activée :</strong> L'impôt sur l'activité professionnelle est réglé directement au taux forfaitaire de <strong>2,2 %</strong> de votre Chiffre d'Affaires (${formatEuroIR(res.impotVersementLiberatoire)}).
          </div>
        ` : ''}

        <div class="overflow-x-auto">
          <table class="w-full text-xs text-left border-collapse">
            <thead>
              <tr class="bg-slate-100 text-slate-700 font-bold border-b">
                <th class="py-2 px-3">Tranche d'Imposition (Barème IR)</th>
                <th class="py-2 px-3 text-center">Taux</th>
                <th class="py-2 px-3 text-right">Assiette Imposable (par part)</th>
                <th class="py-2 px-3 text-right">Impôt Barème</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              ${res.detailTranches.length > 0 ? res.detailTranches.map(t => `
                <tr>
                  <td class="py-2 px-3 font-medium">De ${formatEuroIR(t.min)} à ${t.max === Infinity ? 'au-delà' : formatEuroIR(t.max)}</td>
                  <td class="py-2 px-3 text-center font-bold ${t.taux > 0 ? 'text-amber-600' : 'text-slate-400'}">${t.taux}%</td>
                  <td class="py-2 px-3 text-right">${formatEuroIR(t.assietteParPart)}</td>
                  <td class="py-2 px-3 text-right font-bold text-blue-700">${formatEuroIR(t.impotTotal)}</td>
                </tr>
              `).join('') : `
                <tr>
                  <td colspan="4" class="py-3 text-center text-slate-500 italic">
                    ${res.regimeFisc === 'micro_vl' && autresRevInput === 0 
                      ? 'Aucun revenu soumis au barème progressif (activité couverte par le Versement Libératoire).' 
                      : 'Revenu imposable inférieur au seuil de la première tranche (0 %).'}
                  </td>
                </tr>
              `}
              
              ${res.impotVersementLiberatoire > 0 ? `
                <tr class="bg-emerald-50 text-emerald-900 font-semibold border-t">
                  <td colspan="3" class="py-2 px-3">Versement Libératoire Micro-Entreprise (2,2 % sur ${formatEuroIR(caOuBnc)})</td>
                  <td class="py-2 px-3 text-right font-bold text-emerald-700">${formatEuroIR(res.impotVersementLiberatoire)}</td>
                </tr>
              ` : ''}

              <tr class="bg-slate-800 text-white font-bold text-sm">
                <td colspan="3" class="py-2.5 px-3">TOTAL IMPÔT SUR LE REVENU DÛ</td>
                <td class="py-2.5 px-3 text-right text-emerald-400">${formatEuroIR(res.impotTotalDu)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

    </div>
  `;
}

window.actualiserIR = function() {
  renderIRUI();
};

window.initIRModule = function() {
  renderIRUI();
};

document.addEventListener('DOMContentLoaded', window.initIRModule);
