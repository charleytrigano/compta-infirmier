/**
 * carpimko.js - Module CARPIMKO avec saisie poste par poste, 
 * affichage détaillé des bases de calcul et mise à jour dynamique.
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

  let baseDetail = "";
  let compDetail = "";
  let asvDetail = "";
  let prevDetail = "Forfait fixe obligatoire (Classe C)";
  let regulDetail = "";

  const PASS = 47252;

  if (statut === 'annee1') {
    baseProv = 840.00;
    baseDetail = "Forfait début de 1ère année d'installation";

    compProv = 1856.00;
    compDetail = "Forfait début de 1ère année (19 points)";

    asvProv = conventionne ? 224.00 : 600.00;
    asvDetail = conventionne ? "Forfait fixe (60% pris en charge par l'Assurance Maladie)" : "Forfait fixe non conventionné";

    regulN1 = 0.00;
    regulDetail = "Aucune régularisation en 1ère année";

  } else if (statut === 'annee2') {
    baseProv = 1250.00;
    baseDetail = "Forfait début de 2ème année d'installation";

    compProv = 1856.00;
    compDetail = "Forfait début de 2ème année (19 points)";

    asvProv = conventionne ? 224.00 : 600.00;
    asvDetail = conventionne ? "Forfait fixe (60% pris en charge par l'Assurance Maladie)" : "Forfait fixe non conventionné";

    if (bncN1 <= 11775) {
      regulN1 = bncN1 * 0.0873;
    } else if (bncN1 <= PASS) {
      regulN1 = (11775 * 0.0873) + (bncN1 - 11775) * 0.0873;
    } else {
      regulN1 = (11775 * 0.0873) + (bncN1 - 11775) * 0.0187;
    }
    regulDetail = `Ajustement calculé sur BNC N-1 réel (${formatEuro(bncN1)})`;

  } else {
    // CROISIÈRE (3ème année et +)
    const baseT1 = Math.min(bncN2, PASS) * 0.0873;
    const baseT2 = Math.max(0, bncN2 - PASS) * 0.0187;
    baseProv = baseT1 + baseT2;

    if (bncN2 <= PASS) {
      baseDetail = `8,73 % sur BNC N-2 (${formatEuro(bncN2)})`;
    } else {
      baseDetail = `8,73 % sous 1 PASS (${formatEuro(PASS)}) + 1,87 % sur le surplus`;
    }

    if (bncN2 <= 24030) {
      compProv = 2091.00;
      compDetail = "Cotisation minimale forfaitaire (BNC N-2 ≤ 24 030 €)";
    } else {
      const surplusComp = Math.min(bncN2 - 24030, 150000) * 0.0870;
      compProv = 2091.00 + surplusComp;
      compDetail = `2 091,00 € + 8,70 % sur tranche [24 030 € - ${formatEuro(bncN2)}]`;
    }

    const partProp = conventionne ? (bncN1 * 0.004 * 0.40) : (bncN1 * 0.004);
    asvProv = 224.00 + partProp;
    asvDetail = conventionne 
      ? `Forfait 224 € + 0,16 % part net BNC N-1 (${formatEuro(bncN1)})` 
      : `Forfait 224 € + 0,40 % part net BNC N-1 (${formatEuro(bncN1)})`;

    if (bncN1 <= 11775) {
      regulN1 = bncN1 * 0.0873;
    } else {
      regulN1 = (11775 * 0.0873) + (bncN1 - 11775) * 0.0187;
    }
    regulDetail = `Régularisation définitive sur BNC N-1 (${formatEuro(bncN1)})`;
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
    totalExigibleReel: +totalExigibleReel.toFixed(2),
    details: {
      baseProv: baseDetail,
      compProv: compDetail,
      asvProv: asvDetail,
      prevProv: prevDetail,
      regulN1: regulDetail
    }
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

// Mise à jour ciblée du DOM pour les totaux et les détails explicatifs sans réinitialiser les <input>
window.actualiserCalculsCarpimko = function() {
  const parseFloatOrZero = (id) => {
    const el = document.getElementById(id);
    if (!el) return 0;
    const val = parseFloat(el.value);
    return isNaN(val) ? 0 : val;
  };

  const offBaseT1 = parseFloatOrZero('carp-off-base-t1');
  const offBaseT2 = parseFloatOrZero('carp-off-base-t2');
  const offComp = parseFloatOrZero('carp-off-comp');
  const offAsv = parseFloatOrZero('carp-off-asv');
  const offPrev = parseFloatOrZero('carp-off-prev');
  const offRegul = parseFloatOrZero('carp-off-regul');

  const totalProvOfficiel = offBaseT1 + offBaseT2 + offComp + offAsv + offPrev;
  const totalGeneralOfficiel = totalProvOfficiel + offRegul;

  const statutSelect = document.getElementById('carp-select-statut')?.value || 'croisiere';
  const bncN2Val = parseFloatOrZero('carp-input-bnc-n2');
  const bncN1Val = parseFloatOrZero('carp-input-bnc-n1');
  const conventionneVal = document.getElementById('carp-input-conv')?.checked ?? true;

  const simu = calculerCarpimko(statutSelect, bncN2Val, bncN1Val, conventionneVal);
  const payeBanque = window.payeBanqueCarpimkoActuel || 0;
  const baseCompare = payeBanque > 0 ? payeBanque : totalGeneralOfficiel;
  const tropCotise = baseCompare - simu.totalExigibleReel;

  // Injection des totaux officiels
  const txtProvOff = document.getElementById('carp-txt-prov-off');
  if (txtProvOff) txtProvOff.textContent = formatEuro(totalProvOfficiel);

  const txtTotalOff = document.getElementById('carp-txt-total-off');
  if (txtTotalOff) txtTotalOff.textContent = formatEuro(totalGeneralOfficiel);

  // Injection des valeurs recalculées
  const mapSimu = {
    'carp-txt-base-simu': simu.baseProv,
    'carp-txt-comp-simu': simu.compProv,
    'carp-txt-asv-simu': simu.asvProv,
    'carp-txt-prev-simu': simu.prevProv,
    'carp-txt-prov-simu': simu.totalProv,
    'carp-txt-regul-simu': simu.regulN1,
    'carp-txt-total-simu': simu.totalExigibleReel
  };

  for (const [id, val] of Object.entries(mapSimu)) {
    const el = document.getElementById(id);
    if (el) el.textContent = formatEuro(val);
  }

  // Injection des explications de calcul poste par poste
  const mapDetails = {
    'carp-detail-base': simu.details.baseProv,
    'carp-detail-comp': simu.details.compProv,
    'carp-detail-asv': simu.details.asvProv,
    'carp-detail-prev': simu.details.prevProv,
    'carp-detail-regul': simu.details.regulN1
  };

  for (const [id, txt] of Object.entries(mapDetails)) {
    const el = document.getElementById(id);
    if (el) el.textContent = txt;
  }

  // Mise à jour du bandeau supérieur
  const banner = document.getElementById('carp-banner-trop-cotise');
  const title = document.getElementById('carp-banner-title');
  const desc = document.getElementById('carp-banner-desc');
  const badge = document.getElementById('carp-banner-badge');
  const anneeActive = window.anneeCarpimkoSelectionnee;

  if (banner && title && desc && badge) {
    if (tropCotise >= 0) {
      banner.className = "bg-gradient-to-r from-emerald-50 to-green-50 border-emerald-500 text-emerald-900 border-l-4 p-4 rounded-r-xl shadow-sm border";
      title.innerHTML = "⚖️ Trop-Cotisé Décelé !";
      desc.innerHTML = `Vous avez trop cotisé de <strong>${formatEuro(tropCotise)}</strong> selon vos revenus réels de ${anneeActive}.`;
      badge.className = "text-lg font-black text-emerald-600";
      badge.textContent = `+${formatEuro(tropCotise)}`;
    } else {
      banner.className = "bg-gradient-to-r from-amber-50 to-orange-50 border-amber-500 text-amber-900 border-l-4 p-4 rounded-r-xl shadow-sm border";
      title.innerHTML = "⚖️ Complément de Cotisation";
      desc.innerHTML = `Vos cotisations recalculées prévoient un complément de <strong>${formatEuro(Math.abs(tropCotise))}</strong> pour ${anneeActive}.`;
      badge.className = "text-lg font-black text-amber-600";
      badge.textContent = formatEuro(tropCotise);
    }
  }
};

function renderCarpimkoUI(transactions = []) {
  window.transactionsCarpimkoCache = transactions;
  const container = obtenirConteneurCARPIMKO();
  if (!container) return;

  const annees = obtenirAnneesDisponibles(transactions);
  const anneeActive = window.anneeCarpimkoSelectionnee;

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

  window.payeBanqueCarpimkoActuel = payeBanque;

  container.innerHTML = `
    <div class="space-y-6 max-w-6xl mx-auto p-4 font-sans text-slate-800">

      <!-- ENTÊTE ET FILTRE ANNÉE -->
      <div class="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex flex-wrap justify-between items-center gap-4">
        <div>
          <h2 class="text-xl font-bold text-slate-800 flex items-center gap-2">
            🏥 Cotisations CARPIMKO (${anneeActive})
          </h2>
          <p class="text-xs text-slate-500 mt-1">Calculateur dynamique avec détail des bases d'imposition</p>
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
      <div id="carp-banner-trop-cotise" class="bg-gradient-to-r from-emerald-50 to-green-50 border-emerald-500 text-emerald-900 border-l-4 p-4 rounded-r-xl shadow-sm border">
        <div class="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h3 id="carp-banner-title" class="font-bold text-sm md:text-base">⚖️ Trop-Cotisé Décelé !</h3>
            <p id="carp-banner-desc" class="text-xs mt-0.5 opacity-90"></p>
          </div>
          <div class="bg-white/90 backdrop-blur px-3 py-1.5 rounded-lg border border-slate-200 text-right">
            <span class="text-[10px] text-slate-500 block uppercase font-bold">Écart / Trop-Cotisé</span>
            <span id="carp-banner-badge" class="text-lg font-black text-emerald-600">--</span>
          </div>
        </div>
      </div>

      <!-- REVENUS ET REGIME -->
      <div class="bg-white p-5 rounded-xl shadow-sm border border-slate-200 space-y-4">
        <h3 class="text-xs font-bold uppercase tracking-wider text-blue-700">
          1. Sélection de votre Statut & Base de Revenus (${anneeActive})
        </h3>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label class="block text-xs font-semibold text-slate-700 mb-1">Ancienneté / Régime :</label>
            <select id="carp-select-statut" class="w-full text-xs border border-slate-300 rounded-lg p-2 bg-slate-50 focus:bg-white" onchange="actualiserCalculsCarpimko()">
              <option value="croisiere" selected>3ème Année et + (Régime de Croisière)</option>
              <option value="annee1">1ère Année d'installation (Forfait début)</option>
              <option value="annee2">2ème Année d'installation (Ajustement)</option>
            </select>
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-700 mb-1">BNC N-2 (€) :</label>
            <input type="number" id="carp-input-bnc-n2" value="47252" class="w-full text-xs border border-slate-300 rounded-lg p-2 bg-slate-50 focus:bg-white" oninput="actualiserCalculsCarpimko()">
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-700 mb-1">BNC Réel N-1 (€) :</label>
            <input type="number" id="carp-input-bnc-n1" value="11813" class="w-full text-xs border border-slate-300 rounded-lg p-2 bg-slate-50 focus:bg-white" oninput="actualiserCalculsCarpimko()">
          </div>
        </div>

        <div class="flex items-center gap-2 pt-1">
          <input type="checkbox" id="carp-input-conv" checked class="rounded text-blue-600" onchange="actualiserCalculsCarpimko()">
          <label for="carp-input-conv" class="text-xs text-slate-600 font-medium">
            Infirmier Libéral Conventionné (Prise en charge ASV de 60%)
          </label>
        </div>
      </div>

      <!-- TABLEAU COMPARATIF AVEC BASE / FORMULE DE CALCUL -->
      <div class="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
        <div class="flex justify-between items-center mb-3">
          <h3 class="text-xs font-bold uppercase tracking-wider text-blue-700">
            2. Appel Officiel CARPIMKO (${anneeActive}) vs Calcul Réel
          </h3>
          <span class="text-[11px] text-slate-400 italic">Bases de calcul mises à jour en temps réel</span>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full text-xs text-left border-collapse">
            <thead>
              <tr class="bg-slate-100 text-slate-700 font-bold border-b">
                <th class="py-2 px-3">Poste de Cotisation</th>
                <th class="py-2 px-3">Base / Formule appliquée</th>
                <th class="py-2 px-3 text-right w-36">Appel Officiel (€)</th>
                <th class="py-2 px-3 text-right text-blue-700 w-32">Recalculé (€)</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr class="bg-slate-50/50 font-semibold">
                <td colspan="4" class="py-1.5 px-3 text-slate-600">RÉGIME DE BASE PROVISIONNEL</td>
              </tr>
              <tr>
                <td class="py-1.5 px-3 pl-6 text-slate-500">Tranche 1 (0 à 1 PASS - 8,73%)</td>
                <td id="carp-detail-base" class="py-1.5 px-3 text-slate-500 italic" rowspan="2">--</td>
                <td class="py-1 px-3 text-right">
                  <input type="number" step="0.01" id="carp-off-base-t1" value="4125.00" oninput="actualiserCalculsCarpimko()" class="w-28 text-right p-1 bg-slate-50 border border-slate-300 rounded font-semibold text-xs focus:bg-white focus:ring-1 focus:ring-blue-500">
                </td>
                <td id="carp-txt-base-simu" class="py-1.5 px-3 text-right font-bold text-blue-600" rowspan="2">--</td>
              </tr>
              <tr>
                <td class="py-1.5 px-3 pl-6 text-slate-500">Tranche 2 (1 PASS à 5 PASS - 1,87%)</td>
                <td class="py-1 px-3 text-right">
                  <input type="number" step="0.01" id="carp-off-base-t2" value="884.00" oninput="actualiserCalculsCarpimko()" class="w-28 text-right p-1 bg-slate-50 border border-slate-300 rounded font-semibold text-xs focus:bg-white focus:ring-1 focus:ring-blue-500">
                </td>
              </tr>
              <tr class="bg-slate-50/50">
                <td class="py-1.5 px-3 font-semibold">RÉGIME COMPLÉMENTAIRE</td>
                <td id="carp-detail-comp" class="py-1.5 px-3 text-slate-500 italic">--</td>
                <td class="py-1 px-3 text-right">
                  <input type="number" step="0.01" id="carp-off-comp" value="2091.00" oninput="actualiserCalculsCarpimko()" class="w-28 text-right p-1 bg-slate-50 border border-slate-300 rounded font-semibold text-xs focus:bg-white focus:ring-1 focus:ring-blue-500">
                </td>
                <td id="carp-txt-comp-simu" class="py-1.5 px-3 text-right font-bold text-blue-600">--</td>
              </tr>
              <tr class="bg-slate-50/50">
                <td class="py-1.5 px-3 font-semibold">AVANTAGE SOCIAL VIEILLESSE (ASV)</td>
                <td id="carp-detail-asv" class="py-1.5 px-3 text-slate-500 italic">--</td>
                <td class="py-1 px-3 text-right">
                  <input type="number" step="0.01" id="carp-off-asv" value="243.00" oninput="actualiserCalculsCarpimko()" class="w-28 text-right p-1 bg-slate-50 border border-slate-300 rounded font-semibold text-xs focus:bg-white focus:ring-1 focus:ring-blue-500">
                </td>
                <td id="carp-txt-asv-simu" class="py-1.5 px-3 text-right font-bold text-blue-600">--</td>
              </tr>
              <tr class="bg-slate-50/50">
                <td class="py-1.5 px-3 font-semibold">RÉGIME INVALIDITÉ DÉCÈS</td>
                <td id="carp-detail-prev" class="py-1.5 px-3 text-slate-500 italic">--</td>
                <td class="py-1 px-3 text-right">
                  <input type="number" step="0.01" id="carp-off-prev" value="1022.00" oninput="actualiserCalculsCarpimko()" class="w-28 text-right p-1 bg-slate-50 border border-slate-300 rounded font-semibold text-xs focus:bg-white focus:ring-1 focus:ring-blue-500">
                </td>
                <td id="carp-txt-prev-simu" class="py-1.5 px-3 text-right font-bold text-blue-600">--</td>
              </tr>
              <tr class="font-bold bg-slate-100">
                <td class="py-2 px-3">TOTAL PROVISIONNEL N</td>
                <td class="py-2 px-3 text-slate-400 font-normal italic">Somme des régimes provisionnels</td>
                <td id="carp-txt-prov-off" class="py-2 px-3 text-right text-slate-800 font-bold">--</td>
                <td id="carp-txt-prov-simu" class="py-2 px-3 text-right text-blue-700 font-bold">--</td>
              </tr>
              <tr class="bg-amber-50 font-bold text-amber-900">
                <td class="py-2 px-3">RÉGULARISATION N-1</td>
                <td id="carp-detail-regul" class="py-2 px-3 text-amber-800 font-normal italic">--</td>
                <td class="py-1 px-3 text-right">
                  <input type="number" step="0.01" id="carp-off-regul" value="1248.86" oninput="actualiserCalculsCarpimko()" class="w-28 text-right p-1 bg-amber-100/60 border border-amber-300 rounded font-bold text-xs focus:bg-white focus:ring-1 focus:ring-amber-500">
                </td>
                <td id="carp-txt-regul-simu" class="py-2 px-3 text-right text-amber-700">--</td>
              </tr>
              <tr class="bg-slate-800 text-white font-bold text-sm">
                <td class="py-2.5 px-3">TOTAL GÉNÉRAL DÛ</td>
                <td class="py-2.5 px-3 text-slate-300 font-normal italic text-xs">Total Provisionnel N + Régularisation N-1</td>
                <td id="carp-txt-total-off" class="py-2.5 px-3 text-right font-extrabold text-slate-100">--</td>
                <td id="carp-txt-total-simu" class="py-2.5 px-3 text-right text-emerald-400 font-extrabold">--</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

    </div>
  `;

  actualiserCalculsCarpimko();
}

function changerAnneeCarpimko(nouvelleAnnee) {
  window.anneeCarpimkoSelectionnee = parseInt(nouvelleAnnee, 10);
  window.actualiserCarpimko();
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
