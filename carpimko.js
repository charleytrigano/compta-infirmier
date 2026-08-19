/**
 * carpimko.js - Module CARPIMKO avec saisie poste par poste de l'Appel Officiel,
 * comparaison dynamique avec le calcul réel et filtre par année.
 */

window.anneeCarpimkoSelectionnee = new Date().getFullYear();

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
    baseProv = 840.00;
    compProv = 1856.00;
    asvProv = conventionne ? 224.00 : 600.00;
    regulN1 = 0.00;
  } else if (statut === 'annee2') {
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

function obtenirAnneesDisponibles(transactions = []) {
  const annees = new Set();
  const anneeCourante = new Date().getFullYear();
  annees.add(anneeCourante);

  transactions.forEach(tx => {
    if (tx.date) {
      const d = new Date(tx.date);
      if (!isNaN(d.getTime())) {
        annees.add(d.getFullYear());
      }
    }
  });

  return Array.from(annees).sort((a, b) => b - a);
}

function changerAnneeCarpimko(nouvelleAnnee) {
  window.anneeCarpimkoSelectionnee = parseInt(nouvelleAnnee, 10);
  window.actualiserCarpimko();
}

function obtenirConteneurCARPIMKO() {
  let target = document.getElementById('carpimko') || 
               document.getElementById('vue-carpimko') || 
               document.getElementById('carpimko-content') || 
               document.getElementById('carpimko-container') ||
               document.querySelector('[data-tab="carpimko"]');

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
  window.transactionsCarpimkoCache = transactions;
  const container = obtenirConteneurCARPIMKO();
  if (!container) return;

  // Mémorisation de l'élément actif pour éviter la perte de focus durant la saisie
  const activeElId = document.activeElement?.id;
  const activeSelectionStart = document.activeElement?.selectionStart;

  const annees = obtenirAnneesDisponibles(transactions);
  const anneeActive = window.anneeCarpimkoSelectionnee;

  // Lecture des saisies de l'Appel Officiel poste par poste (ou valeurs par défaut)
  const offBaseT1 = parseFloat(document.getElementById('carp-off-base-t1')?.value) ?? 4125.00;
  const offBaseT2 = parseFloat(document.getElementById('carp-off-base-t2')?.value) ?? 884.00;
  const offComp = parseFloat(document.getElementById('carp-off-comp')?.value) ?? 2091.00;
  const offAsv = parseFloat(document.getElementById('carp-off-asv')?.value) ?? 243.00;
  const offPrev = parseFloat(document.getElementById('carp-off-prev')?.value) ?? 1022.00;
  const offRegul = parseFloat(document.getElementById('carp-off-regul')?.value) ?? 1248.86;

  const totalProvOfficiel = offBaseT1 + offBaseT2 + offComp + offAsv + offPrev;
  const totalGeneralOfficiel = totalProvOfficiel + offRegul;

  let payeBanque = 0;
  let nbPaiements = 0;

  transactions.forEach(tx => {
    const cat = (tx.category || tx.categorie || '').toLowerCase();
    const desc = (tx.description || tx.libelle || '').toLowerCase();
    
    if (cat.includes('carpimko') || desc.includes('carpimko')) {
      const dateTx = new Date(tx.date);
      if (!isNaN(dateTx.getTime()) && dateTx.getFullYear() === parseInt(anneeActive, 10)) {
        payeBanque += Math.abs(parseFloat(tx.amount || tx.montant || tx.debit || 0));
        nbPaiements++;
      }
    }
  });

  const statutSelect = document.getElementById('carp-select-statut')?.value || 'croisiere';
  const bncN2Val = parseFloat(document.getElementById('carp-input-bnc-n2')?.value) ?? 47252;
  const bncN1Val = parseFloat(document.getElementById('carp-input-bnc-n1')?.value) ?? 11813;
  const conventionneVal = document.getElementById('carp-input-conv')?.checked ?? true;

  const simu = calculerCarpimko(statutSelect, bncN2Val, bncN1Val, conventionneVal);
  const baseCompare = payeBanque > 0 ? payeBanque : totalGeneralOfficiel;
  const tropCotise = baseCompare - simu.totalExigibleReel;

  container.innerHTML = `
    <div class="space-y-6 max-w-5xl mx-auto p-4 font-sans text-slate-800">

      <!-- ENTÊTE DE LA SECTION + FILTRE PAR ANNÉE -->
      <div class="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex flex-wrap justify-between items-center gap-4">
        <div>
          <h2 class="text-xl font-bold text-slate-800 flex items-center gap-2">
            🏥 Cotisations CARPIMKO (${anneeActive})
          </h2>
          <p class="text-xs text-slate-500 mt-1">Calculateur dynamique avec saisie de l'appel officiel</p>
        </div>

        <div class="flex items-center gap-4">
          <div class="flex items-center gap-2">
            <label for="select-annee-carpimko" class="text-xs font-semibold text-slate-700">Année :</label>
            <select id="select-annee-carpimko" onchange="changerAnneeCarpimko(this.value)" class="form-select bg-slate-50 border border-slate-300 text-slate-900 text-xs rounded-lg font-bold p-2 focus:ring-blue-500 focus:border-blue-500">
              ${annees.map(a => `<option value="${a}" ${a === anneeActive ? 'selected' : ''}>${a}</option>`).join('')}
            </select>
          </div>

          <div class="bg-blue-50 text-blue-800 text-xs px-3 py-2 rounded-lg font-semibold border border-blue-200">
            Banque : ${formatEuro(payeBanque)} (${nbPaiements} versement(s))
          </div>
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
                ? `Vous avez trop cotisé de <strong>${formatEuro(tropCotise)}</strong> selon vos revenus réels de ${anneeActive}.` 
                : `Vos cotisations recalculées prévoient un complément de <strong>${formatEuro(Math.abs(tropCotise))}</strong> pour ${anneeActive}.`}
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
          1. Sélection de votre Statut & Base de Revenus (${anneeActive})
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

      <!-- TABLEAU COMPARATIF APPEL OFFICIEL (SAISISSABLE) VS RECALCULÉ -->
      <div class="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
        <div class="flex justify-between items-center mb-3">
          <h3 class="text-xs font-bold uppercase tracking-wider text-blue-700">
            2. Appel Officiel CARPIMKO (${anneeActive}) vs Calcul Réel
          </h3>
          <span class="text-[11px] text-slate-400 italic">Modifiez les montants de la colonne "Appel Officiel" selon votre document</span>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full text-xs text-left border-collapse">
            <thead>
              <tr class="bg-slate-100 text-slate-700 font-bold border-b">
                <th class="py-2 px-3">Poste de Cotisation</th>
                <th class="py-2 px-3 text-right w-44">Appel Officiel (€)</th>
                <th class="py-2 px-3 text-right text-blue-700">Recalculé (€)</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr class="bg-slate-50/50 font-semibold">
                <td colspan="3" class="py-1.5 px-3 text-slate-600">RÉGIME DE BASE PROVISIONNEL</td>
              </tr>
              <tr>
                <td class="py-1.5 px-3 pl-6 text-slate-500">Tranche 1 (0 à 1 PASS - 8,73%)</td>
                <td class="py-1 px-3 text-right">
                  <input type="number" step="0.01" id="carp-off-base-t1" value="${offBaseT1}" oninput="window.actualiserCarpimko()" class="w-32 text-right p-1 bg-slate-50 border border-slate-300 rounded font-semibold text-xs focus:bg-white focus:ring-1 focus:ring-blue-500">
                </td>
                <td class="py-1.5 px-3 text-right font-bold text-blue-600" rowspan="2">${formatEuro(simu.baseProv)}</td>
              </tr>
              <tr>
                <td class="py-1.5 px-3 pl-6 text-slate-500">Tranche 2 (1 PASS à 5 PASS - 1,87%)</td>
                <td class="py-1 px-3 text-right">
                  <input type="number" step="0.01" id="carp-off-base-t2" value="${offBaseT2}" oninput="window.actualiserCarpimko()" class="w-32 text-right p-1 bg-slate-50 border border-slate-300 rounded font-semibold text-xs focus:bg-white focus:ring-1 focus:ring-blue-500">
                </td>
              </tr>
              <tr class="bg-slate-50/50 font-semibold">
                <td class="py-1.5 px-3">RÉGIME COMPLÉMENTAIRE</td>
                <td class="py-1 px-3 text-right">
                  <input type="number" step="0.01" id="carp-off-comp" value="${offComp}" oninput="window.actualiserCarpimko()" class="w-32 text-right p-1 bg-slate-50 border border-slate-300 rounded font-semibold text-xs focus:bg-white focus:ring-1 focus:ring-blue-500">
                </td>
                <td class="py-1.5 px-3 text-right font-bold text-blue-600">${formatEuro(simu.compProv)}</td>
              </tr>
              <tr class="bg-slate-50/50 font-semibold">
                <td class="py-1.5 px-3">AVANTAGE SOCIAL VIEILLESSE (ASV)</td>
                <td class="py-1 px-3 text-right">
                  <input type="number" step="0.01" id="carp-off-asv" value="${offAsv}" oninput="window.actualiserCarpimko()" class="w-32 text-right p-1 bg-slate-50 border border-slate-300 rounded font-semibold text-xs focus:bg-white focus:ring-1 focus:ring-blue-500">
                </td>
                <td class="py-1.5 px-3 text-right font-bold text-blue-600">${formatEuro(simu.asvProv)}</td>
              </tr>
              <tr class="bg-slate-50/50 font-semibold">
                <td class="py-1.5 px-3">RÉGIME INVALIDITÉ DÉCÈS</td>
                <td class="py-1 px-3 text-right">
                  <input type="number" step="0.01" id="carp-off-prev" value="${offPrev}" oninput="window.actualiserCarpimko()" class="w-32 text-right p-1 bg-slate-50 border border-slate-300 rounded font-semibold text-xs focus:bg-white focus:ring-1 focus:ring-blue-500">
                </td>
                <td class="py-1.5 px-3 text-right font-bold text-blue-600">${formatEuro(simu.prevProv)}</td>
              </tr>
              <tr class="font-bold bg-slate-100">
                <td class="py-2 px-3">TOTAL PROVISIONNEL N</td>
                <td class="py-2 px-3 text-right text-slate-800 font-bold">${formatEuro(totalProvOfficiel)}</td>
                <td class="py-2 px-3 text-right text-blue-700 font-bold">${formatEuro(simu.totalProv)}</td>
              </tr>
              <tr class="bg-amber-50 font-bold text-amber-900">
                <td class="py-2 px-3">RÉGULARISATION N-1</td>
                <td class="py-1 px-3 text-right">
                  <input type="number" step="0.01" id="carp-off-regul" value="${offRegul}" oninput="window.actualiserCarpimko()" class="w-32 text-right p-1 bg-amber-100/60 border border-amber-300 rounded font-bold text-xs focus:bg-white focus:ring-1 focus:ring-amber-500">
                </td>
                <td class="py-2 px-3 text-right text-amber-700">${formatEuro(simu.regulN1)}</td>
              </tr>
              <tr class="bg-slate-800 text-white font-bold text-sm">
                <td class="py-2.5 px-3">TOTAL GÉNÉRAL DÛ</td>
                <td class="py-2.5 px-3 text-right font-extrabold text-slate-100">${formatEuro(totalGeneralOfficiel)}</td>
                <td class="py-2.5 px-3 text-right text-emerald-400 font-extrabold">${formatEuro(simu.totalExigibleReel)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

    </div>
  `;

  // Restauration du focus et du curseur pour permettre une saisie continue
  if (activeElId) {
    const el = document.getElementById(activeElId);
    if (el) {
      el.focus();
      if (typeof el.setSelectionRange === 'function' && activeSelectionStart !== null) {
        try { el.setSelectionRange(activeSelectionStart, activeSelectionStart); } catch (e) {}
      }
    }
  }
}

window.actualiserCarpimko = function() {
  const transactions = window.transactionsCarpimkoCache || window.listeTransactions || window.state?.transactions || [];
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

window.initCarpimkoModule = initCarpimkoModule;
window.initCarpimko = initCarpimkoModule;
window.changerAnneeCarpimko = changerAnneeCarpimko;

document.addEventListener('DOMContentLoaded', initCarpimkoModule);

document.addEventListener('click', (e) => {
  if (e.target && e.target.innerText && e.target.innerText.includes('CARPIMKO')) {
    setTimeout(initCarpimkoModule, 100);
  }
});
