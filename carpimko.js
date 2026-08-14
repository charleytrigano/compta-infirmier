/**
 * carpimko.js - Module CARPIMKO complet avec gestion des régimes (1ère, 2ème année et croisière)
 * et comparateur de trop-cotisé par rapport à l'appel officiel.
 */

// Données fixes tirées de l'appel de cotisation officiel CARPIMKO 2026 (du 19/07/2026)
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

// Formateur monétaire
function formatEuro(valeur) {
  return Number(valeur || 0).toLocaleString('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

/**
 * Moteur de calcul selon l'ancienneté (1ère année, 2ème année, 3ème année+)
 */
function calculerCarpimko(statut = 'croisiere', bncN2 = 47252, bncN1 = 11813, conventionne = true) {
  let baseProv = 0;
  let compProv = 0;
  let asvProv = 0;
  let prevProv = 1022.00; // Forfait Invalidité-Décès
  let regulN1 = 0;

  if (statut === 'annee1') {
    // --- 1ÈRE ANNÉE D'INSTALLATION (Forfaits de début d'activité) ---
    baseProv = 840.00;
    compProv = 1856.00;
    asvProv = conventionne ? 224.00 : 600.00;
    regulN1 = 0.00;

  } else if (statut === 'annee2') {
    // --- 2ÈME ANNÉE D'INSTALLATION ---
    baseProv = 1250.00;
    compProv = 1856.00;
    asvProv = conventionne ? 224.00 : 600.00;
    
    // Régularisation N-1 sur le BNC de la 1ère année
    const PASS = 47252;
    if (bncN1 <= 11775) {
      regulN1 = bncN1 * 0.0873;
    } else if (bncN1 <= PASS) {
      regulN1 = (11775 * 0.0873) + (bncN1 - 11775) * 0.0873;
    } else {
      regulN1 = (11775 * 0.0873) + (bncN1 - 11775) * 0.0187;
    }

  } else {
    // --- 3ÈME ANNÉE ET AU-DELÀ (Régime de Croisière / Calcul au réel) ---
    const PASS = 47252;
    
    // Régime de Base Provisionnel N (sur BNC N-2)
    if (bncN2 <= PASS) {
      baseProv = bncN2 * 0.0873;
    } else {
      baseProv = (PASS * 0.0873) + (bncN2 - PASS) * 0.0187;
    }

    // Régime Complémentaire N
    compProv = bncN2 <= 24030 ? 2091.00 : 2091.00 + Math.min(bncN2 - 24030, 150000) * 0.0870;

    // ASV N (Forfait 224€ + Part proportionnelle)
    const asvBrut = 224.00 + (bncN1 * 0.004);
    asvProv = conventionne ? (224.00 + (bncN1 * 0.004 * 0.40)) : asvBrut;

    // Régularisation Régime de Base N-1 (sur BNC N-1)
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

/**
 * Injection et rendu de l'interface graphique CARPIMKO
 */
function renderCarpimkoUI(transactions = []) {
  // Recherche dynamique de tous les conteneurs possibles dans le DOM
  const container = document.getElementById('carpimko') || 
                    document.getElementById('vue-carpimko') || 
                    document.getElementById('carpimko-content') || 
                    document.getElementById('carpimko-container') ||
                    document.querySelector('[data-tab="carpimko"]');

  if (!container) {
    console.error("Conteneur CARPIMKO introuvable dans le DOM.");
    return;
  }

  // Calcul du montant réel prélevé / payé dans vos transactions bancaires
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
  
  // Valeurs par défaut pour l'affichage initial
  const statutSelect = document.getElementById('carp-select-statut')?.value || 'croisiere';
  const bncN2Val = parseFloat(document.getElementById('carp-input-bnc-n2')?.value) || 47252;
  const bncN1Val = parseFloat(document.getElementById('carp-input-bnc-n1')?.value) || 11813;
  const conventionneVal = document.getElementById('carp-input-conv')?.checked ?? true;

  const simu = calculerCarpimko(statutSelect, bncN2Val, bncN1Val, conventionneVal);
  
  // Calcul de la différence (Cotisé en trop)
  const baseCompare = payeBanque > 0 ? payeBanque : officiel.totalGeneralDues;
  const tropCotise = baseCompare - simu.totalExigibleReel;

  container.innerHTML = `
    <div class="space-y-6 max-w-5xl mx-auto p-2 font-sans">

      <!-- EN-TÊTE DU MODULE -->
      <div class="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-wrap justify-between items-center gap-4">
        <div>
          <h2 class="text-xl font-bold text-slate-800 flex items-center gap-2">
            🏥 Déclaration & Simulation CARPIMKO 2026
          </h2>
          <p class="text-xs text-slate-500 mt-1">
            Calculateur pour Infirmiers Libéraux (1ère, 2ème année & Régime de Croisière)
          </p>
        </div>
        <div class="bg-blue-50 text-blue-800 text-xs px-3 py-1.5 rounded-lg font-semibold border border-blue-200">
          Rapprochement Bancaire : ${formatEuro(payeBanque)} (${nbPaiements} versement(s))
        </div>
      </div>

      <!-- BANDEAU COMPARATIF ET TROP-COTISÉ -->
      <div class="bg-gradient-to-r ${tropCotise >= 0 ? 'from-emerald-50 to-green-50 border-emerald-500 text-emerald-900' : 'from-amber-50 to-orange-50 border-amber-500 text-amber-900'} border-l-4 p-5 rounded-r-xl shadow-sm border">
        <div class="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h3 class="font-bold text-base flex items-center gap-2">
              ⚖️ Diagnostic Comparatif : ${tropCotise >= 0 ? 'Trop-Cotisé Détecté !' : 'Complément à Prévoir'}
            </h3>
            <p class="text-xs mt-1 opacity-90">
              ${tropCotise >= 0 
                ? `Selon votre BNC et statut réel, vous avez cotisé environ <strong>${formatEuro(tropCotise)}</strong> de trop par rapport au calcul recalculé.` 
                : `Vos cotisations recalculées sont supérieures de <strong>${formatEuro(Math.abs(tropCotise))}</strong> aux versements actuels.`}
            </p>
          </div>
          <div class="text-right bg-white/80 backdrop-blur-sm px-4 py-2 rounded-xl border border-slate-200">
            <span class="text-xs text-slate-500 block uppercase font-bold">Écart / Trop-Cotisé</span>
            <span class="text-xl font-black ${tropCotise >= 0 ? 'text-emerald-600' : 'text-amber-600'}">
              ${tropCotise >= 0 ? '+' : ''}${formatEuro(tropCotise)}
            </span>
          </div>
        </div>
      </div>

      <!-- FORMULAIRE COMPACT DE PARAMÉTRAGE -->
      <div class="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <h3 class="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4 text-blue-700">
          1. Sélection de votre Situation & Revenus
        </h3>
        
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label class="block text-xs font-semibold text-slate-700 mb-1">Ancienneté / Statut :</label>
            <select id="carp-select-statut" class="w-full text-sm border border-slate-300 rounded-lg p-2.5 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500" onchange="window.actualiserCarpimko()">
              <option value="croisiere" ${simu.statut === 'croisiere' ? 'selected' : ''}>3ème Année et + (Régime de Croisière)</option>
              <option value="annee1" ${simu.statut === 'annee1' ? 'selected' : ''}>1ère Année d'installation (Forfait début)</option>
              <option value="annee2" ${simu.statut === 'annee2' ? 'selected' : ''}>2ème Année d'installation (Réajustement)</option>
            </select>
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-700 mb-1">BNC N-2 / Estimé 2026 (€) :</label>
            <input type="number" id="carp-input-bnc-n2" value="${bncN2Val}" class="w-full text-sm border border-slate-300 rounded-lg p-2.5 bg-slate-50 focus:bg-white" oninput="window.actualiserCarpimko()">
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-700 mb-1">BNC Réel N-1 / 2025 (€) :</label>
            <input type="number" id="carp-input-bnc-n1" value="${bncN1Val}" class="w-full text-sm border border-slate-300 rounded-lg p-2.5 bg-slate-50 focus:bg-white" oninput="window.actualiserCarpimko()">
          </div>
        </div>

        <div class="mt-3 flex items-center gap-2">
          <input type="checkbox" id="carp-input-conv" ${conventionneVal ? 'checked' : ''} class="rounded text-blue-600" onchange="window.actualiserCarpimko()">
          <label for="carp-input-conv" class="text-xs text-slate-600 font-medium">
            Infirmier Libéral Conventionné (Prise en charge partielle de l'ASV par l'Assurance Maladie)
          </label>
        </div>
      </div>

      <!-- REPRODUCTION IDENTIQUE DE L'APPEL DE COTISATION OFFICIEL -->
      <div class="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <div class="flex justify-between items-center border-b border-slate-200 pb-3 mb-4">
          <h3 class="text-base font-bold text-slate-800">
            2. Appel de Cotisations Émis le 19/07/2026 (Document Officiel)
          </h3>
          <span class="text-xs bg-slate-100 text-slate-600 px-2.5 py-1 rounded font-mono">Appel CARPIMKO 2026</span>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse text-xs md:text-sm">
            <thead>
              <tr class="bg-slate-100 text-slate-700 font-bold border-b">
                <th class="py-2.5 px-3">Poste de Cotisation</th>
                <th class="py-2.5 px-3 text-right">Appel Officiel Reçu</th>
                <th class="py-2.5 px-3 text-right text-blue-700">Calcul Recalculé</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <!-- REGIME DE BASE -->
              <tr class="bg-slate-50/50 font-semibold text-slate-700">
                <td colspan="3" class="py-2 px-3">RÉGIME DE BASE PROVISIONNEL 2026</td>
              </tr>
              <tr>
                <td class="py-2 px-3 pl-6 text-slate-600">Tranche 1 (0 à 1 PASS - 8,73%)</td>
                <td class="py-2 px-3 text-right">${formatEuro(officiel.regimeBaseT1)}</td>
                <td class="py-2 px-3 text-right font-bold text-blue-600">${formatEuro(simu.baseProv)}</td>
              </tr>
              <tr>
                <td class="py-2 px-3 pl-6 text-slate-600">Tranche 2 (1 PASS à 5 PASS - 1,87%)</td>
                <td class="py-2 px-3 text-right">${formatEuro(officiel.regimeBaseT2)}</td>
                <td class="py-2 px-3 text-right font-semibold text-slate-400">-</td>
              </tr>

              <!-- REGIME COMPLEMENTAIRE -->
              <tr class="bg-slate-50/50 font-semibold text-slate-700">
                <td colspan="3" class="py-2 px-3">RÉGIME COMPLÉMENTAIRE 2026</td>
              </tr>
              <tr>
                <td class="py-2 px-3 pl-6 text-slate-600">Cotisation proportionnelle (8,70%)</td>
                <td class="py-2 px-3 text-right">${formatEuro(officiel.regimeComp)}</td>
                <td class="py-2 px-3 text-right font-bold text-blue-600">${formatEuro(simu.compProv)}</td>
              </tr>

              <!-- ASV -->
              <tr class="bg-slate-50/50 font-semibold text-slate-700">
                <td colspan="3" class="py-2 px-3">AVANTAGE SOCIAL VIEILLESSE 2026</td>
              </tr>
              <tr>
                <td class="py-2 px-3 pl-6 text-slate-600">Cotisations Forfaitaire & Proportionnelle</td>
                <td class="py-2 px-3 text-right">${formatEuro(officiel.asvForfait + officiel.asvProp)}</td>
                <td class="py-2 px-3 text-right font-bold text-blue-600">${formatEuro(simu.asvProv)}</td>
              </tr>

              <!-- INVALIDITE DECES -->
              <tr class="bg-slate-50/50 font-semibold text-slate-700">
                <td class="py-2 px-3">RÉGIME INVALIDITÉ DÉCÈS 2026</td>
                <td class="py-2 px-3 text-right">${formatEuro(officiel.invaliditeDeces)}</td>
                <td class="py-2 px-3 text-right font-bold text-blue-600">${formatEuro(simu.prevProv)}</td>
              </tr>

              <!-- SOUS TOTAL 2026 -->
              <tr class="font-bold bg-slate-100 border-t">
                <td class="py-2 px-3 text-slate-800">TOTAL PROVISIONNEL 2026</td>
                <td class="py-2 px-3 text-right text-slate-900">${formatEuro(officiel.totalProv2026)}</td>
                <td class="py-2 px-3 text-right text-blue-700">${formatEuro(simu.totalProv)}</td>
              </tr>

              <!-- REGULARISATION 2025 -->
              <tr class="bg-amber-50/40 font-bold text-amber-900">
                <td class="py-2 px-3">RÉGULARISATION RÉGIME DE BASE 2025</td>
                <td class="py-2 px-3 text-right text-amber-900">${formatEuro(officiel.regulBase2025)}</td>
                <td class="py-2 px-3 text-right font-bold text-amber-700">${formatEuro(simu.regulN1)}</td>
              </tr>

              <!-- TOTAL GENERAL -->
              <tr class="bg-slate-800 text-white font-bold text-base">
                <td class="py-3 px-3 uppercase">TOTAL GÉNÉRAL EXIGIBLE</td>
                <td class="py-3 px-3 text-right">${formatEuro(officiel.totalGeneralDues)}</td>
                <td class="py-3 px-3 text-right text-emerald-400">${formatEuro(simu.totalExigibleReel)}</td>
              </tr>

              <!-- SOLDE BANQUE -->
              <tr class="bg-slate-100 text-slate-700">
                <td class="py-2 px-3 font-medium">À VOTRE COMPTE (Déjà réglé)</td>
                <td class="py-2 px-3 text-right font-bold text-red-600">-${formatEuro(payeBanque || officiel.dejaPaye)}</td>
                <td class="py-2 px-3 text-right font-bold text-red-600">-${formatEuro(payeBanque || officiel.dejaPaye)}</td>
              </tr>

              <tr class="bg-blue-900 text-white font-bold text-base">
                <td class="py-3 px-3">SOLDE RESTANT À RÉGLER</td>
                <td class="py-3 px-3 text-right">${formatEuro(officiel.soldeARegler)}</td>
                <td class="py-3 px-3 text-right text-emerald-300">
                  ${formatEuro(Math.max(0, simu.totalExigibleReel - (payeBanque || officiel.dejaPaye)))}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

    </div>
  `;
}

/**
 * Fonction de mise à jour dynamique lors des changements dans les inputs
 */
window.actualiserCarpimko = function() {
  let transactions = [];
  if (window.listeTransactions) {
    transactions = window.listeTransactions;
  } else if (window.state && window.state.transactions) {
    transactions = window.state.transactions;
  }
  renderCarpimkoUI(transactions);
};

/**
 * Point d'entrée d'initialisation du module CARPIMKO
 */
async function initCarpimkoModule() {
  try {
    let transactions = [];
    
    // Charger depuis Supabase si connecté
    if (window.supabaseClient) {
      const { data, error } = await window.supabaseClient
        .from('transactions')
        .select('*');

      if (!error && data) {
        transactions = data;
      }
    }

    // Fallback sur variables globales ou localStorage
    if (transactions.length === 0 && window.listeTransactions) {
      transactions = window.listeTransactions;
    } else if (transactions.length === 0 && window.state && window.state.transactions) {
      transactions = window.state.transactions;
    } else if (transactions.length === 0) {
      const localData = localStorage.getItem('transactions');
      if (localData) {
        transactions = JSON.parse(localData);
      }
    }

    renderCarpimkoUI(transactions);
  } catch (err) {
    console.error("Erreur lors du chargement du module CARPIMKO :", err);
  }
}

// Aliases globaux pour compatibilité avec l'application web
window.initCarpimkoModule = initCarpimkoModule;
window.initCarpimko = initCarpimkoModule;
window.renderCarpimkoUI = renderCarpimkoUI;
window.calculerCarpimko = calculerCarpimko;

// Lancement automatique lors du chargement de la page
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initCarpimkoModule);
} else {
  initCarpimkoModule();
}
