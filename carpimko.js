/**
 * carpimko.js - Module CARPIMKO avec gestion 1ère, 2ème année, croisière
 * et injection sécurisée dans l'interface web.
 */

const APPEL_OFFICIEL_CARPIMKO_2026 = {
  regimeBaseT1: 4125.00,
  regimeBaseT2: 884.00,
  regimeComp: 2091.00,
  asvForfait: 224.00,
  asvProp: 19.00,
  invaliditeDeces: 1022.00,
  totalProv2026: 8365.00,
  regulBase2025: 1248.86,
  totalGeneralDues: 9613.86,
  dejaPaye: 717.00,
  soldeARegler: 8896.86
};

function formatEuro(valeur) {
  return Number(valeur || 0).toLocaleString('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function calculerCarpimko(statut = 'croisiere', bncN2 = 47252, bncN1 = 11813, conventionne = true) {
  let baseProv = 0;
  let compProv = 0;
  let asvProv = 0;
  let prevProv = 1022.00;
  let regulN1 = 0;

  if (statut === 'annee1') {
    // 1ÈRE ANNÉE D'INSTALLATION
    baseProv = 840.00;
    compProv = 1856.00;
    asvProv = conventionne ? 224.00 : 600.00;
    regulN1 = 0.00;

  } else if (statut === 'annee2') {
    // 2ÈME ANNÉE D'INSTALLATION
    baseProv = 1250.00;
    compProv = 1856.00;
    asvProv = conventionne ? 224.00 : 600.00;
    
    const PASS = 47252;
    if (bncN1 <= 11775) {
      regulN1 = bncN1 * 0.0873;
    } else if (bncN1 <= PASS) {
      regulN1 = (11775 * 0.0873) + (bncN1 - 11775) * 0.0873;
    } else {
      regulN1 = (11775 * 0.0873) + (bncN1 - 11775) * 0.0187;
    }

  } else {
    // 3ÈME ANNÉE ET + (CROISIÈRE)
    const PASS = 47252;
    if (bncN2 <= PASS) {
      baseProv = bncN2 * 0.0873;
    } else {
      baseProv = (PASS * 0.0873) + (bncN2 - PASS) * 0.0187;
    }

    compProv = bncN2 <= 24030 ? 2091.00 : 2091.00 + Math.min(bncN2 - 24030, 150000) * 0.0870;
    asvProv = conventionne ? (224.00 + (bncN1 * 0.004 * 0.40)) : (224.00 + (bncN1 * 0.004));

    if (bncN1 <= 11775) {
      regulN1 = bncN1 * 0.0873;
    } else {
      regulN1 = (11775 * 0.0873) + (bncN1 - 11775) * 0.0187;
    }
  }

  const totalProv = baseProv + compProv + asvProv + prevProv;
  const totalExigibleReel = totalProv + regulN1;

  return {
    statut,
    baseProv: +baseProv.toFixed(2),
    compProv: +compProv.toFixed(2),
    asvProv: +asvProv.toFixed(2),
    prevProv: +prevProv.toFixed(2),
    totalProv: +totalProv.toFixed(2),
    regulN1: +regulN1.toFixed(2),
    totalExigibleReel: +totalExigibleReel.toFixed(2)
  };
}

// Recherche du conteneur HTML d'injection
function obtenirConteneurCARPIMKO() {
  let target = document.getElementById('carpimko') || 
               document.getElementById('vue-carpimko') || 
               document.getElementById('carpimko-content') || 
               document.getElementById('carpimko-container') ||
               document.querySelector('[data-tab="carpimko"]');

  // Si non trouvé, on cherche une section principale dans la page
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

function renderCarpimkoUI(transactions = []) {
  const container = obtenirConteneurCARPIMKO();
  if (!container) return;

  let payeBanque = 0;
  let nbPaiements = 0;
  transactions.forEach(tx => {
    const cat = (tx.category || tx.categorie || '').toLowerCase();
    const desc = (tx.description || tx.libelle || '').toLowerCase();
    if (cat.includes('carpimko') || desc.includes('carpimko')) {
      payeBanque += Math.abs(parseFloat(tx.amount || tx.montant || tx.debit || 0));
      nbPaiements++;
    }
  });

  const officiel = APPEL_OFFICIEL_CARPIMKO_2026;
  const statutSelect = document.getElementById('carp-select-statut')?.value || 'croisiere';
  const bncN2Val = parseFloat(document.getElementById('carp-input-bnc-n2')?.value) || 47252;
  const bncN1Val = parseFloat(document.getElementById('carp-input-bnc-n1')?.value) || 11813;
  const conventionneVal = document.getElementById('carp-input-conv')?.checked ?? true;

  const simu = calculerCarpimko(statutSelect, bncN2Val, bncN1Val, conventionneVal);
  const baseCompare = payeBanque > 0 ? payeBanque : officiel.totalGeneralDues;
  const tropCotise = baseCompare - simu.totalExigibleReel;

  container.innerHTML = `
    <div class="space-y-6 max-w-5xl mx-auto p-4 font-sans text-slate-800">

      <!-- ENTÊTE DE LA SECTION -->
      <div class="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex flex-wrap justify-between items-center gap-4">
        <div>
          <h2 class="text-xl font-bold text-slate-800 flex items-center gap-2">
            🏥 Cotisations CARPIMKO (1ère, 2ème année & Croisière)
          </h2>
          <p class="text-xs text-slate-500 mt-1">Calculateur dynamique adapté aux infirmiers libéraux</p>
        </div>
        <div class="bg-blue-50 text-blue-800 text-xs px-3 py-1.5 rounded-lg font-semibold border border-blue-200">
          Banque : ${formatEuro(payeBanque)} (${nbPaiements} versement(s))
        </div>
      </div>

      <!-- BANDEAU TROP-COTISÉ -->
      <div class="bg-gradient-to-r ${tropCotise >= 0 ? 'from-emerald-50 to-green-50 border-emerald-500 text-emerald-900' : 'from-amber-50 to-orange-50 border-amber-500 text-amber-900'} border-l-4 p-4 rounded-r-xl shadow-sm border">
        <div class="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h3 class="font-bold text-sm md:text-base">
              ⚖️ ${tropCotise >= 0 ? 'Trop-Cotisé Décelé !' : 'Complément de Cotisation'}
            </h3>
            <p class="text-xs mt-0.5 opacity-90">
              ${tropCotise >= 0 
                ? `Vous avez trop cotisé de <strong>${formatEuro(tropCotise)}</strong> selon les calculs réels de votre activité.` 
                : `Vos cotisations recalculées prévoient un complément de <strong>${formatEuro(Math.abs(tropCotise))}</strong>.`}
            </p>
          </div>
          <div class="bg-white/90 backdrop-blur px-3 py-1.5 rounded-lg border border-slate-200 text-right">
            <span class="text-[10px] text-slate-500 block uppercase font-bold">Écart / Trop-Cotisé</span>
            <span class="text-lg font-black ${tropCotise >= 0 ? 'text-emerald-600' : 'text-amber-600'}">
              ${tropCotise >= 0 ? '+' : ''}${formatEuro(tropCotise)}
            </span>
          </div>
        </div>
      </div>

      <!-- SÉLECTION D'ANCIENNETÉ ET REVENUS -->
      <div class="bg-white p-5 rounded-xl shadow-sm border border-slate-200 space-y-4">
        <h3 class="text-xs font-bold uppercase tracking-wider text-blue-700">
          1. Sélection de votre Statut & Base de Revenus
        </h3>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label class="block text-xs font-semibold text-slate-700 mb-1">Ancienneté / Régime :</label>
            <select id="carp-select-statut" class="w-full text-xs border border-slate-300 rounded-lg p-2 bg-slate-50 focus:bg-white" onchange="window.actualiserCarpimko()">
              <option value="croisiere" ${simu.statut === 'croisiere' ? 'selected' : ''}>3ème Année et + (Régime de Croisière)</option>
              <option value="annee1" ${simu.statut === 'annee1' ? 'selected' : ''}>1ère Année d'installation (Forfait début)</option>
              <option value="annee2" ${simu.statut === 'annee2' ? 'selected' : ''}>2ème Année d'installation (Ajustement)</option>
            </select>
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-700 mb-1">BNC N-2 (€) :</label>
            <input type="number" id="carp-input-bnc-n2" value="${bncN2Val}" class="w-full text-xs border border-slate-300 rounded-lg p-2 bg-slate-50 focus:bg-white" oninput="window.actualiserCarpimko()">
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-700 mb-1">BNC Réel N-1 (€) :</label>
            <input type="number" id="carp-input-bnc-n1" value="${bncN1Val}" class="w-full text-xs border border-slate-300 rounded-lg p-2 bg-slate-50 focus:bg-white" oninput="window.actualiserCarpimko()">
          </div>
        </div>

        <div class="flex items-center gap-2 pt-1">
          <input type="checkbox" id="carp-input-conv" ${conventionneVal ? 'checked' : ''} class="rounded text-blue-600" onchange="window.actualiserCarpimko()">
          <label for="carp-input-conv" class="text-xs text-slate-600 font-medium">
            Infirmier Libéral Conventionné (Prise en charge ASV de 60%)
          </label>
        </div>
      </div>

      <!-- TABLEAU COMPARATIF APPEL OFFICIEL VS RECALCULÉ -->
      <div class="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
        <h3 class="text-xs font-bold uppercase tracking-wider text-blue-700 mb-3">
          2. Comparatif Appel Officiel CARPIMKO 2026 vs Calcul Réel
        </h3>

        <div class="overflow-x-auto">
          <table class="w-full text-xs text-left border-collapse">
            <thead>
              <tr class="bg-slate-100 text-slate-700 font-bold border-b">
                <th class="py-2 px-3">Poste de Cotisation</th>
                <th class="py-2 px-3 text-right">Appel Officiel</th>
                <th class="py-2 px-3 text-right text-blue-700">Recalculé</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr class="bg-slate-50/50 font-semibold">
                <td colspan="3" class="py-1.5 px-3 text-slate-600">RÉGIME DE BASE PROVISIONNEL</td>
              </tr>
              <tr>
                <td class="py-1.5 px-3 pl-6 text-slate-500">Tranche 1 (0 à 1 PASS - 8,73%)</td>
                <td class="py-1.5 px-3 text-right">${formatEuro(officiel.regimeBaseT1)}</td>
                <td class="py-1.5 px-3 text-right font-bold text-blue-600" rowspan="2">${formatEuro(simu.baseProv)}</td>
              </tr>
              <tr>
                <td class="py-1.5 px-3 pl-6 text-slate-500">Tranche 2 (1 PASS à 5 PASS - 1,87%)</td>
                <td class="py-1.5 px-3 text-right">${formatEuro(officiel.regimeBaseT2)}</td>
              </tr>
              <tr class="bg-slate-50/50 font-semibold">
                <td class="py-1.5 px-3">RÉGIME COMPLÉMENTAIRE</td>
                <td class="py-1.5 px-3 text-right">${formatEuro(officiel.regimeComp)}</td>
                <td class="py-1.5 px-3 text-right font-bold text-blue-600">${formatEuro(simu.compProv)}</td>
              </tr>
              <tr class="bg-slate-50/50 font-semibold">
                <td class="py-1.5 px-3">AVANTAGE SOCIAL VIEILLESSE (ASV)</td>
                <td class="py-1.5 px-3 text-right">${formatEuro(officiel.asvForfait + officiel.asvProp)}</td>
                <td class="py-1.5 px-3 text-right font-bold text-blue-600">${formatEuro(simu.asvProv)}</td>
              </tr>
              <tr class="bg-slate-50/50 font-semibold">
                <td class="py-1.5 px-3">RÉGIME INVALIDITÉ DÉCÈS</td>
                <td class="py-1.5 px-3 text-right">${formatEuro(officiel.invaliditeDeces)}</td>
                <td class="py-1.5 px-3 text-right font-bold text-blue-600">${formatEuro(simu.prevProv)}</td>
              </tr>
              <tr class="font-bold bg-slate-100">
                <td class="py-2 px-3">TOTAL PROVISIONNEL N</td>
                <td class="py-2 px-3 text-right">${formatEuro(officiel.totalProv2026)}</td>
                <td class="py-2 px-3 text-right text-blue-700">${formatEuro(simu.totalProv)}</td>
              </tr>
              <tr class="bg-amber-50 font-bold text-amber-900">
                <td class="py-2 px-3">RÉGULARISATION N-1</td>
                <td class="py-2 px-3 text-right">${formatEuro(officiel.regulBase2025)}</td>
                <td class="py-2 px-3 text-right text-amber-700">${formatEuro(simu.regulN1)}</td>
              </tr>
              <tr class="bg-slate-800 text-white font-bold text-sm">
                <td class="py-2.5 px-3">TOTAL GÉNÉRAL DÛ</td>
                <td class="py-2.5 px-3 text-right">${formatEuro(officiel.totalGeneralDues)}</td>
                <td class="py-2.5 px-3 text-right text-emerald-400">${formatEuro(simu.totalExigibleReel)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

    </div>
  `;
}

window.actualiserCarpimko = function() {
  const transactions = window.listeTransactions || window.state?.transactions || [];
  renderCarpimkoUI(transactions);
};

async function initCarpimkoModule() {
  let transactions = window.listeTransactions || window.state?.transactions || [];

  if (transactions.length === 0 && window.supabaseClient) {
    try {
      const { data } = await window.supabaseClient.from('transactions').select('*');
      if (data) transactions = data;
    } catch (e) {
      console.warn("Supabase non disponible, chargement secours.");
    }
  }

  renderCarpimkoUI(transactions);
}

// Initialisation résiliente (s'assure de s'exécuter dès que le DOM est prêt ou qu'un onglet est cliqué)
window.initCarpimkoModule = initCarpimkoModule;
window.initCarpimko = initCarpimkoModule;

document.addEventListener('DOMContentLoaded', initCarpimkoModule);

// Détection dynamique des clics sur les onglets pour re-rendre automatiquement
document.addEventListener('click', (e) => {
  if (e.target && e.target.innerText && e.target.innerText.includes('CARPIMKO')) {
    setTimeout(initCarpimkoModule, 100);
  }
});
