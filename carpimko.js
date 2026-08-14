/**
 * carpimko.js - Module CARPIMKO officiel avec comparateur
 */

// Données officielles extraites de votre appel de cotisation du 19/07/2026
const APPEL_OFFICIEL_2026 = {
  regimeBaseT1: 4125.00,
  regimeBaseT2: 884.00,
  regimeComp: 2091.00,
  asvForfait: 224.00,
  asvProp: 19.00,
  invaliditeDeces: 1022.00,
  totalProv2026: 8365.00,
  regulBase2025: 1248.86,
  totalGeneral: 9613.86,
  dejaPaye: 717.00,
  soldeARegler: 8896.86
};

function formatEuro(val) {
  return Number(val || 0).toLocaleString('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

/**
 * Calculateur temps réel basé sur le BNC de l'exercice
 */
function calculerCarpimkoReel(bnc2026 = 47252, bnc2025 = 11813) {
  // Tranches Régime de Base 2026 (Taux 8.73% et 1.87%)
  const baseT1 = +(Math.min(bnc2026, 47252) * 0.0873).toFixed(2);
  const baseT2 = +(bnc2026 * 0.0187).toFixed(2);
  
  // Régime Complémentaire (Exemple Taux 8.70% sur assiette spécifique)
  const comp = 2091.00; 
  
  // ASV & Invalidité
  const asvForfait = 224.00;
  const asvProp = +(bnc2025 * 0.004 * 0.40).toFixed(2);
  const invalidite = 1022.00;
  
  const totalProv = baseT1 + baseT2 + comp + asvForfait + asvProp + invalidite;

  // Régularisation 2025
  const regulT1 = +(Math.min(bnc2025, 11775) * 0.0873).toFixed(2);
  const regulT2 = +(bnc2025 * 0.0187).toFixed(2);
  const totalRegul = regulT1 + regulT2;

  const totalGeneral = totalProv + totalRegul;

  return {
    baseT1, baseT2, comp, asvForfait, asvProp, invalidite,
    totalProv, totalRegul, totalGeneral
  };
}

/**
 * Interface d'affichage identique à l'appel de cotisation
 */
function renderCarpimkoUI(transactions = []) {
  const container = document.getElementById('vue-carpimko') || 
                    document.getElementById('carpimko-container') ||
                    document.getElementById('carpimko-content') ||
                    document.getElementById('carpimko');

  if (!container) {
    console.error("Conteneur CARPIMKO introuvable.");
    return;
  }

  // Somme des cotisations CARPIMKO réglées en banque
  let payeBanque = 0;
  transactions.forEach(tx => {
    const cat = (tx.category || tx.categorie || '').toLowerCase();
    const desc = (tx.description || tx.libelle || '').toLowerCase();
    if (cat.includes('carpimko') || desc.includes('carpimko')) {
      payeBanque += Math.abs(parseFloat(tx.amount || tx.montant || 0));
    }
  });

  const officiel = APPEL_OFFICIEL_2026;
  const simu = calculerCarpimkoReel();
  const tropConssigne = payeBanque > officiel.totalGeneral ? (payeBanque - officiel.totalGeneral) : 0;
  const ecartAppelVsReel = officiel.totalGeneral - simu.totalGeneral;

  container.innerHTML = `
    <div class="space-y-6 max-w-5xl mx-auto p-2">
      
      <!-- BANDEAU DE COMPARATIF & TROP PERÇU -->
      <div class="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r-xl shadow-sm">
        <h3 class="text-amber-800 font-bold text-base flex items-center gap-2">
          ⚖️ Comparatif & Anomaly Check (Cotisé en Trop)
        </h3>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mt-3 text-sm">
          <div class="bg-white p-3 rounded-lg border border-amber-200">
            <span class="text-gray-500 text-xs block">Appel Officiel Reçu</span>
            <span class="font-bold text-slate-800 text-base">${formatEuro(officiel.totalGeneral)}</span>
          </div>
          <div class="bg-white p-3 rounded-lg border border-amber-200">
            <span class="text-gray-500 text-xs block">Déjà Réglé (Banque)</span>
            <span class="font-bold text-blue-600 text-base">${formatEuro(payeBanque || officiel.dejaPaye)}</span>
          </div>
          <div class="bg-white p-3 rounded-lg border border-amber-200">
            <span class="text-gray-500 text-xs block">Écart / Trop cotisé potentiel</span>
            <span class="font-bold ${ecartAppelVsReel >= 0 ? 'text-emerald-600' : 'text-red-600'} text-base">
              ${formatEuro(Math.abs(ecartAppelVsReel))} ${ecartAppelVsReel > 0 ? '(En votre faveur)' : ''}
            </span>
          </div>
        </div>
      </div>

      <!-- REPRODUCTION EXACTE DE L'APPEL DE COTISATION CARPIMKO -->
      <div class="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <div class="flex justify-between items-center border-b pb-4 mb-4">
          <div>
            <h2 class="text-xl font-bold text-slate-800">APPEL DE COTISATION CARPIMKO</h2>
            <p class="text-xs text-gray-500">Émis le 19/07/2026</p>
          </div>
          <span class="bg-slate-100 text-slate-700 px-3 py-1 rounded-full text-xs font-semibold">Exercice 2026</span>
        </div>

        <table class="w-full text-left border-collapse text-xs md:text-sm">
          <tbody>
            <!-- REGIME DE BASE PROVISIONNEL -->
            <tr class="bg-slate-50 font-bold text-slate-700">
              <td colspan="2" class="py-2 px-3">RÉGIME DE BASE PROVISIONNEL 2026</td>
            </tr>
            <tr class="border-b border-gray-100">
              <td class="py-2 px-3 pl-6">
                ▶ Tranche 1 <span class="text-xs text-gray-500">REVENUS ANNUALISÉS 47 252,00 X 8,73%</span>
              </td>
              <td class="py-2 px-3 text-right font-semibold">${formatEuro(officiel.regimeBaseT1)}</td>
            </tr>
            <tr class="border-b border-gray-100">
              <td class="py-2 px-3 pl-6">
                ▶ Tranche 2 <span class="text-xs text-gray-500">REVENUS ANNUALISÉS 47 252,00 X 1,87%</span>
              </td>
              <td class="py-2 px-3 text-right font-semibold">${formatEuro(officiel.regimeBaseT2)}</td>
            </tr>

            <!-- REGIME COMPLEMENTAIRE -->
            <tr class="bg-slate-50 font-bold text-slate-700">
              <td colspan="2" class="py-2 px-3">RÉGIME COMPLÉMENTAIRE 2026</td>
            </tr>
            <tr class="border-b border-gray-100">
              <td class="py-2 px-3 pl-6">
                ▶ Cotisation proportionnelle <span class="text-xs text-gray-500">24 030,00 X 8,70%</span>
              </td>
              <td class="py-2 px-3 text-right font-semibold">${formatEuro(officiel.regimeComp)}</td>
            </tr>

            <!-- AVANTAGE SOCIAL VIEILLESSE -->
            <tr class="bg-slate-50 font-bold text-slate-700">
              <td colspan="2" class="py-2 px-3">AVANTAGE SOCIAL VIEILLESSE 2026</td>
            </tr>
            <tr class="border-b border-gray-100">
              <td class="py-2 px-3 pl-6">▶ Cotisation forfaitaire</td>
              <td class="py-2 px-3 text-right font-semibold">${formatEuro(officiel.asvForfait)}</td>
            </tr>
            <tr class="border-b border-gray-100">
              <td class="py-2 px-3 pl-6">
                ▶ Cotisation proportionnelle <span class="text-xs text-gray-500">REVENUS CONVENTIONNÉS 2025 11 813,00 X 0,40% X 40%</span>
              </td>
              <td class="py-2 px-3 text-right font-semibold">${formatEuro(officiel.asvProp)}</td>
            </tr>

            <!-- INVALIDITE DECES -->
            <tr class="bg-slate-50 font-bold text-slate-700">
              <td class="py-2 px-3">RÉGIME INVALIDITÉ DÉCÈS 2026</td>
              <td class="py-2 px-3 text-right font-semibold">${formatEuro(officiel.invaliditeDeces)}</td>
            </tr>

            <!-- TOTAL PROVISIONNEL -->
            <tr class="font-bold border-t-2 border-slate-300 bg-slate-100">
              <td class="py-2 px-3 text-slate-800">TOTAL DES COTISATIONS 2026</td>
              <td class="py-2 px-3 text-right text-slate-900">${formatEuro(officiel.totalProv2026)}</td>
            </tr>

            <!-- REGULARISATION 2025 -->
            <tr class="bg-amber-50/50 font-bold text-amber-900">
              <td colspan="2" class="py-2 px-3">RÉGULARISATION DU RÉGIME DE BASE 2025</td>
            </tr>
            <tr class="border-b border-gray-100">
              <td class="py-2 px-3 pl-6">
                ▶ Tranche 1 <span class="text-xs text-gray-500">REVENUS PLAFONNÉS 11 775,00 X 8,73%</span>
              </td>
              <td class="py-2 px-3 text-right font-semibold">${formatEuro(1027.96)}</td>
            </tr>
            <tr class="border-b border-gray-100">
              <td class="py-2 px-3 pl-6">
                ▶ Tranche 2 <span class="text-xs text-gray-500">REVENUS 2025 11 813,00 X 1,87%</span>
              </td>
              <td class="py-2 px-3 text-right font-semibold">${formatEuro(220.90)}</td>
            </tr>
            <tr class="font-bold bg-amber-50/30 border-b border-amber-200">
              <td class="py-2 px-3 text-amber-900">TOTAL DE LA RÉGULARISATION DU REGIME DE BASE 2025</td>
              <td class="py-2 px-3 text-right text-amber-900">${formatEuro(officiel.regulBase2025)}</td>
            </tr>

            <!-- NET A PAYER -->
            <tr class="bg-emerald-600 text-white font-bold text-base">
              <td class="py-3 px-3 uppercase">TOTAL GÉNÉRAL DES COTISATIONS DUES</td>
              <td class="py-3 px-3 text-right">${formatEuro(officiel.totalGeneral)}</td>
            </tr>
            <tr class="bg-slate-100 text-slate-700">
              <td class="py-2 px-3 font-medium">À VOTRE COMPTE (déjà réglé)</td>
              <td class="py-2 px-3 text-right font-bold text-red-600">-${formatEuro(officiel.dejaPaye)}</td>
            </tr>
            <tr class="bg-slate-800 text-white font-bold text-lg">
              <td class="py-3 px-3">SOLDE À RÉGLER SUR L'ANNÉE 2026</td>
              <td class="py-3 px-3 text-right">${formatEuro(officiel.soldeARegler)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `;
}

async function initCarpimkoModule() {
  try {
    let transactions = [];
    if (window.supabaseClient) {
      const { data } = await window.supabaseClient.from('transactions').select('*');
      if (data) transactions = data;
    } else if (window.listeTransactions) {
      transactions = window.listeTransactions;
    }
    renderCarpimkoUI(transactions);
  } catch (err) {
    console.error("Erreur CARPIMKO :", err);
  }
}

// Aliases
window.initCarpimkoModule = initCarpimkoModule;
window.initCarpimko = initCarpimkoModule;
window.renderCarpimkoUI = renderCarpimkoUI;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initCarpimkoModule);
} else {
  initCarpimkoModule();
}
