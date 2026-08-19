/**
 * urssaf.js - Module URSSAF pour Infirmier Libéral (PAMC)
 * Gestion trimestrielle (T1, T2, T3, T4), plafonds Tranche A et Tranche B modifiables par année,
 * et recalcul dynamique sans rechargement lourd du DOM.
 */

window.anneeUrssafSelectionnee = new Date().getFullYear();

// Plafonds par défaut ajustables
const PLAFONDS_DEFAUT = {
  2024: { pass: 46368, trB: 185472 },
  2025: { pass: 47100, trB: 188400 },
  2026: { pass: 47252, trB: 189008 }
};

function formatEuro(valeur) {
  return Number(valeur || 0).toLocaleString('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

/**
 * Calcul détaillé des cotisations URSSAF (Régime PAMC)
 */
function calculerUrssaf(bnc = 47252, passTrA = 47252, maxTrB = 189008, conventionne = true) {
  // Tranchage du BNC
  const partTrA = Math.min(Math.max(bnc, 0), passTrA);
  const partTrB = Math.min(Math.max(bnc - passTrA, 0), maxTrB - passTrA);
  const horsTranches = Math.max(bnc - maxTrB, 0);

  // 1. Maladie / Maternité (PAMC) - Prise en charge CPAM si conventionné
  // Taux conventionné : 0,10 % sur TrA (CPAM prend en charge le reste), 9,80 % sur le surplus
  let maladieProv = 0;
  let maladieDetail = "";
  if (conventionne) {
    maladieProv = (partTrA * 0.0010) + (partTrB * 0.0980);
    maladieDetail = `Tr A (0,10 % avec prise en charge CPAM) + Tr B (9,80 %)`;
  } else {
    maladieProv = bnc * 0.065;
    maladieDetail = `Taux plein non-conventionné (6,50 %)`;
  }

  // 2. Allocations Familiales (Taux progressif de 0 % à 3,10 % selon BNC / PASS)
  let tauxAllocFam = 0;
  const ratioPASS = bnc / passTrA;
  if (ratioPASS <= 1.10) {
    tauxAllocFam = 0;
  } else if (ratioPASS <= 1.40) {
    tauxAllocFam = ((ratioPASS - 1.10) / 0.30) * 0.0310;
  } else {
    tauxAllocFam = 0.0310;
  }
  const allocFamProv = bnc * tauxAllocFam;
  const allocFamDetail = `Taux effectif de ${(tauxAllocFam * 100).toFixed(2)} % (selon barème BNC/PASS)`;

  // 3. CSG / CRDS (Base = BNC + Cotisations obligatoires environ ~1,15 x BNC)
  const assietteCSG = bnc * 1.15;
  const csgDeductible = assietteCSG * 0.0680;
  const csgNonDeductible = assietteCSG * 0.0240;
  const crds = assietteCSG * 0.0050;
  const totalCsgCrds = csgDeductible + csgNonDeductible + crds;
  const csgDetail = `Base majorée (~115 % du BNC = ${formatEuro(assietteCSG)}) : CSG 9,2 % + CRDS 0,5 %`;

  // 4. Formation Professionnelle (CFP) - Forfait 0,25 % du PASS
  const cfpProv = passTrA * 0.0025;
  const cfpDetail = `Forfait fixe 0,25 % du PASS Tranche A (${formatEuro(passTrA)})`;

  // 5. Curateur / Contribution Additionnelle (si applicable)
  const totalAnnuel = maladieProv + allocFamProv + totalCsgCrds + cfpProv;

  // Découpage Trimestriel
  const t1 = totalAnnuel / 4;
  const t2 = totalAnnuel / 4;
  const t3 = totalAnnuel / 4;
  const t4 = totalAnnuel / 4;

  return {
    tranches: { partTrA, partTrB, horsTranches },
    postes: {
      maladie: { montant: +maladieProv.toFixed(2), detail: maladieDetail },
      allocFam: { montant: +allocFamProv.toFixed(2), detail: allocFamDetail },
      csgCrds: { montant: +totalCsgCrds.toFixed(2), detail: csgDetail },
      cfp: { montant: +cfpProv.toFixed(2), detail: cfpDetail }
    },
    totalAnnuel: +totalAnnuel.toFixed(2),
    trimestres: {
      t1: +t1.toFixed(2),
      t2: +t2.toFixed(2),
      t3: +t3.toFixed(2),
      t4: +t4.toFixed(2)
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

function obtenirConteneurURSSAF() {
  let target = document.getElementById('urssaf') || 
               document.getElementById('vue-urssaf') || 
               document.getElementById('urssaf-content') || 
               document.getElementById('urssaf-container') ||
               document.querySelector('[data-tab="urssaf"]');

  if (!target) {
    const main = document.querySelector('main') || document.querySelector('.content') || document.body;
    if (main) {
      target = document.createElement('div');
      target.id = 'urssaf-container';
      main.appendChild(target);
    }
  }
  return target;
}

// Mise à jour fluide ciblée sur les cellules texte uniquement
window.actualiserCalculsUrssaf = function() {
  const parseFloatOrZero = (id) => {
    const el = document.getElementById(id);
    if (!el) return 0;
    const val = parseFloat(el.value);
    return isNaN(val) ? 0 : val;
  };

  const bncVal = parseFloatOrZero('urs-input-bnc');
  const passTrAVal = parseFloatOrZero('urs-input-pass-tra');
  const maxTrBVal = parseFloatOrZero('urs-input-pass-trb');
  const convVal = document.getElementById('urs-input-conv')?.checked ?? true;

  // Calcul réel des cotisations
  const simu = calculerUrssaf(bncVal, passTrAVal, maxTrBVal, convVal);

  // Saisie de l'Appel Officiel par trimestre
  const offT1 = parseFloatOrZero('urs-off-t1');
  const offT2 = parseFloatOrZero('urs-off-t2');
  const offT3 = parseFloatOrZero('urs-off-t3');
  const offT4 = parseFloatOrZero('urs-off-t4');
  const totalOffTrimestres = offT1 + offT2 + offT3 + offT4;

  // Saisie de l'Appel Officiel par poste
  const offMaladie = parseFloatOrZero('urs-off-maladie');
  const offAlloc = parseFloatOrZero('urs-off-alloc');
  const offCsg = parseFloatOrZero('urs-off-csg');
  const offCfp = parseFloatOrZero('urs-off-cfp');
  const totalOffPostes = offMaladie + offAlloc + offCsg + offCfp;

  const totalOfficielRetenu = totalOffTrimestres > 0 ? totalOffTrimestres : totalOffPostes;

  const payeBanque = window.payeBanqueUrssafActuel || 0;
  const baseCompare = payeBanque > 0 ? payeBanque : totalOfficielRetenu;
  const tropCotise = baseCompare - simu.totalAnnuel;

  // Mise à jour de l'affichage des tranches BNC
  const txtTrA = document.getElementById('urs-txt-part-tra');
  if (txtTrA) txtTrA.textContent = formatEuro(simu.tranches.partTrA);
  const txtTrB = document.getElementById('urs-txt-part-trb');
  if (txtTrB) txtTrB.textContent = formatEuro(simu.tranches.partTrB);

  // Mise à jour des totaux trimestriels
  const txtTotOffTrim = document.getElementById('urs-txt-tot-off-trim');
  if (txtTotOffTrim) txtTotOffTrim.textContent = formatEuro(totalOffTrimestres);

  const txtTotSimuTrim = document.getElementById('urs-txt-tot-simu-trim');
  if (txtTotSimuTrim) txtTotSimuTrim.textContent = formatEuro(simu.totalAnnuel);

  const mapSimuTrim = {
    'urs-simu-t1': simu.trimestres.t1,
    'urs-simu-t2': simu.trimestres.t2,
    'urs-simu-t3': simu.trimestres.t3,
    'urs-simu-t4': simu.trimestres.t4
  };
  for (const [id, val] of Object.entries(mapSimuTrim)) {
    const el = document.getElementById(id);
    if (el) el.textContent = formatEuro(val);
  }

  // Mise à jour du tableau poste par poste
  const mapSimuPostes = {
    'urs-simu-maladie': simu.postes.maladie.montant,
    'urs-simu-alloc': simu.postes.allocFam.montant,
    'urs-simu-csg': simu.postes.csgCrds.montant,
    'urs-simu-cfp': simu.postes.cfp.montant,
    'urs-simu-tot-postes': simu.totalAnnuel
  };
  for (const [id, val] of Object.entries(mapSimuPostes)) {
    const el = document.getElementById(id);
    if (el) el.textContent = formatEuro(val);
  }

  const txtTotOffPostes = document.getElementById('urs-txt-tot-off-postes');
  if (txtTotOffPostes) txtTotOffPostes.textContent = formatEuro(totalOffPostes);

  // Mise à jour des détails
  const mapDetails = {
    'urs-detail-maladie': simu.postes.maladie.detail,
    'urs-detail-alloc': simu.postes.allocFam.detail,
    'urs-detail-csg': simu.postes.csgCrds.detail,
    'urs-detail-cfp': simu.postes.cfp.detail
  };
  for (const [id, txt] of Object.entries(mapDetails)) {
    const el = document.getElementById(id);
    if (el) el.textContent = txt;
  }

  // Bandeau supérieur
  const banner = document.getElementById('urs-banner-trop-cotise');
  const title = document.getElementById('urs-banner-title');
  const desc = document.getElementById('urs-banner-desc');
  const badge = document.getElementById('urs-banner-badge');
  const anneeActive = window.anneeUrssafSelectionnee;

  if (banner && title && desc && badge) {
    if (tropCotise >= 0) {
      banner.className = "bg-gradient-to-r from-emerald-50 to-green-50 border-emerald-500 text-emerald-900 border-l-4 p-4 rounded-r-xl shadow-sm border";
      title.innerHTML = "⚖️ Trop-Cotisé URSSAF Décelé !";
      desc.innerHTML = `Vous avez trop versé de <strong>${formatEuro(tropCotise)}</strong> à l'URSSAF selon votre BNC réel de ${anneeActive}.`;
      badge.className = "text-lg font-black text-emerald-600";
      badge.textContent = `+${formatEuro(tropCotise)}`;
    } else {
      banner.className = "bg-gradient-to-r from-amber-50 to-orange-50 border-amber-500 text-amber-900 border-l-4 p-4 rounded-r-xl shadow-sm border";
      title.innerHTML = "⚖️ Régularisation URSSAF à Prévoir";
      desc.innerHTML = `Vos cotisations recalculées prévoient un ajustement de <strong>${formatEuro(Math.abs(tropCotise))}</strong> pour ${anneeActive}.`;
      badge.className = "text-lg font-black text-amber-600";
      badge.textContent = formatEuro(tropCotise);
    }
  }
};

function renderUrssafUI(transactions = []) {
  window.transactionsUrssafCache = transactions;
  const container = obtenirConteneurURSSAF();
  if (!container) return;

  const annees = obtenirAnneesDisponibles(transactions);
  const anneeActive = window.anneeUrssafSelectionnee;
  const plafondsAnnee = PLAFONDS_DEFAUT[anneeActive] || { pass: 47252, trB: 189008 };

  let payeBanque = 0;
  let nbPaiements = 0;

  transactions.forEach(tx => {
    const cat = (tx.category || tx.categorie || '').toLowerCase();
    const desc = (tx.description || tx.libelle || '').toLowerCase();
    
    if (cat.includes('urssaf') || desc.includes('urssaf')) {
      const dateTx = new Date(tx.date);
      if (!isNaN(dateTx.getTime()) && dateTx.getFullYear() === parseInt(anneeActive, 10)) {
        payeBanque += Math.abs(parseFloat(tx.amount || tx.montant || tx.debit || 0));
        nbPaiements++;
      }
    }
  });

  window.payeBanqueUrssafActuel = payeBanque;

  container.innerHTML = `
    <div class="space-y-6 max-w-6xl mx-auto p-4 font-sans text-slate-800">

      <!-- ENTÊTE ET FILTRE ANNÉE -->
      <div class="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex flex-wrap justify-between items-center gap-4">
        <div>
          <h2 class="text-xl font-bold text-slate-800 flex items-center gap-2">
            🏛️ Cotisations URSSAF (${anneeActive})
          </h2>
          <p class="text-xs text-slate-500 mt-1">Calculateur avec gestion trimestrielle et ajustement des plafonds Tr A & Tr B</p>
        </div>

        <div class="flex items-center gap-4">
          <div class="flex items-center gap-2">
            <label for="select-annee-urssaf" class="text-xs font-semibold text-slate-700">Année :</label>
            <select id="select-annee-urssaf" onchange="changerAnneeUrssaf(this.value)" class="form-select bg-slate-50 border border-slate-300 text-slate-900 text-xs rounded-lg font-bold p-2 focus:ring-blue-500 focus:border-blue-500">
              ${annees.map(a => `<option value="${a}" ${a === anneeActive ? 'selected' : ''}>${a}</option>`).join('')}
            </select>
          </div>

          <div class="bg-blue-50 text-blue-800 text-xs px-3 py-2 rounded-lg font-semibold border border-blue-200">
            Prélèvements Banque : ${formatEuro(payeBanque)} (${nbPaiements} opération(s))
          </div>
        </div>
      </div>

      <!-- BANDEAU TROP-COTISÉ -->
      <div id="urs-banner-trop-cotise" class="bg-gradient-to-r from-emerald-50 to-green-50 border-emerald-500 text-emerald-900 border-l-4 p-4 rounded-r-xl shadow-sm border">
        <div class="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h3 id="urs-banner-title" class="font-bold text-sm md:text-base">⚖️ Trop-Cotisé Décelé !</h3>
            <p id="urs-banner-desc" class="text-xs mt-0.5 opacity-90"></p>
          </div>
          <div class="bg-white/90 backdrop-blur px-3 py-1.5 rounded-lg border border-slate-200 text-right">
            <span class="text-[10px] text-slate-500 block uppercase font-bold">Écart / Trop-Cotisé</span>
            <span id="urs-banner-badge" class="text-lg font-black text-emerald-600">--</span>
          </div>
        </div>
      </div>

      <!-- REVENUS ET CONFIGURATION DES TRANCHES MODIFIABLES -->
      <div class="bg-white p-5 rounded-xl shadow-sm border border-slate-200 space-y-4">
        <h3 class="text-xs font-bold uppercase tracking-wider text-blue-700">
          1. Base de Calcul & Plafonds d'Imposition (${anneeActive})
        </h3>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label class="block text-xs font-semibold text-slate-700 mb-1">BNC Réel / Estime (€) :</label>
            <input type="number" id="urs-input-bnc" value="47252" class="w-full text-xs border border-slate-300 rounded-lg p-2 bg-slate-50 focus:bg-white font-bold" oninput="actualiserCalculsUrssaf()">
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-700 mb-1">Plafond Tranche A - 1 PASS (€) :</label>
            <input type="number" id="urs-input-pass-tra" value="${plafondsAnnee.pass}" class="w-full text-xs border border-slate-300 rounded-lg p-2 bg-slate-50 focus:bg-white text-blue-700 font-semibold" oninput="actualiserCalculsUrssaf()">
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-700 mb-1">Plafond Tranche B - 4 PASS (€) :</label>
            <input type="number" id="urs-input-pass-trb" value="${plafondsAnnee.trB}" class="w-full text-xs border border-slate-300 rounded-lg p-2 bg-slate-50 focus:bg-white text-blue-700 font-semibold" oninput="actualiserCalculsUrssaf()">
          </div>
        </div>

        <div class="flex items-center justify-between flex-wrap gap-2 pt-2 border-t border-slate-100 text-xs">
          <div class="flex items-center gap-2">
            <input type="checkbox" id="urs-input-conv" checked class="rounded text-blue-600" onchange="actualiserCalculsUrssaf()">
            <label for="urs-input-conv" class="text-slate-600 font-medium">
              Praticien Médical Conventionné PAMC (Tarif réduit Maladie sur Tr A)
            </label>
          </div>
          <div class="text-slate-500">
            Ventilation BNC : Tr A = <strong id="urs-txt-part-tra" class="text-slate-700">--</strong> | Tr B = <strong id="urs-txt-part-trb" class="text-slate-700">--</strong>
          </div>
        </div>
      </div>

      <!-- TABLEAU 1 : DÉTAIL PAR TRIMESTRE (T1, T2, T3, T4) -->
      <div class="bg-white p-5 rounded-xl shadow-sm border border-slate-200 space-y-3">
        <div class="flex justify-between items-center">
          <h3 class="text-xs font-bold uppercase tracking-wider text-blue-700">
            2. Échéancier Trimestriel URSSAF (${anneeActive})
          </h3>
          <span class="text-[11px] text-slate-400 italic">Entrez vos montants prélevés par trimestre</span>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full text-xs text-left border-collapse">
            <thead>
              <tr class="bg-slate-100 text-slate-700 font-bold border-b">
                <th class="py-2 px-3">Trimestre</th>
                <th class="py-2 px-3">Échéance</th>
                <th class="py-2 px-3 text-right w-40">Appel Officiel (€)</th>
                <th class="py-2 px-3 text-right text-blue-700 w-36">Recalculé (€)</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr>
                <td class="py-2 px-3 font-semibold">1er Trimestre (T1)</td>
                <td class="py-2 px-3 text-slate-500">5 Février</td>
                <td class="py-1 px-3 text-right">
                  <input type="number" step="0.01" id="urs-off-t1" value="0.00" oninput="actualiserCalculsUrssaf()" class="w-32 text-right p-1 bg-slate-50 border border-slate-300 rounded font-semibold text-xs focus:bg-white focus:ring-1 focus:ring-blue-500">
                </td>
                <td id="urs-simu-t1" class="py-2 px-3 text-right font-bold text-blue-600">--</td>
              </tr>
              <tr>
                <td class="py-2 px-3 font-semibold">2ème Trimestre (T2)</td>
                <td class="py-2 px-3 text-slate-500">5 Mai</td>
                <td class="py-1 px-3 text-right">
                  <input type="number" step="0.01" id="urs-off-t2" value="0.00" oninput="actualiserCalculsUrssaf()" class="w-32 text-right p-1 bg-slate-50 border border-slate-300 rounded font-semibold text-xs focus:bg-white focus:ring-1 focus:ring-blue-500">
                </td>
                <td id="urs-simu-t2" class="py-2 px-3 text-right font-bold text-blue-600">--</td>
              </tr>
              <tr>
                <td class="py-2 px-3 font-semibold">3ème Trimestre (T3)</td>
                <td class="py-2 px-3 text-slate-500">5 Août (Ajustement)</td>
                <td class="py-1 px-3 text-right">
                  <input type="number" step="0.01" id="urs-off-t3" value="0.00" oninput="actualiserCalculsUrssaf()" class="w-32 text-right p-1 bg-slate-50 border border-slate-300 rounded font-semibold text-xs focus:bg-white focus:ring-1 focus:ring-blue-500">
                </td>
                <td id="urs-simu-t3" class="py-2 px-3 text-right font-bold text-blue-600">--</td>
              </tr>
              <tr>
                <td class="py-2 px-3 font-semibold">4ème Trimestre (T4)</td>
                <td class="py-2 px-3 text-slate-500">5 Novembre</td>
                <td class="py-1 px-3 text-right">
                  <input type="number" step="0.01" id="urs-off-t4" value="0.00" oninput="actualiserCalculsUrssaf()" class="w-32 text-right p-1 bg-slate-50 border border-slate-300 rounded font-semibold text-xs focus:bg-white focus:ring-1 focus:ring-blue-500">
                </td>
                <td id="urs-simu-t4" class="py-2 px-3 text-right font-bold text-blue-600">--</td>
              </tr>
              <tr class="bg-slate-800 text-white font-bold text-sm">
                <td colspan="2" class="py-2.5 px-3">TOTAL ANNUEL TRIMESTRIEL DÛ</td>
                <td id="urs-txt-tot-off-trim" class="py-2.5 px-3 text-right text-slate-100 font-extrabold">--</td>
                <td id="urs-txt-tot-simu-trim" class="py-2.5 px-3 text-right text-emerald-400 font-extrabold">--</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- TABLEAU 2 : DÉTAIL POSTE PAR POSTE (AVEC DÉTAIL DES FORMULES) -->
      <div class="bg-white p-5 rounded-xl shadow-sm border border-slate-200 space-y-3">
        <div class="flex justify-between items-center">
          <h3 class="text-xs font-bold uppercase tracking-wider text-blue-700">
            3. Ventilation Annuelle Poste par Poste
          </h3>
          <span class="text-[11px] text-slate-400 italic">Détail des taux et prises en charge</span>
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
              <tr>
                <td class="py-2 px-3 font-semibold">Maladie - Maternité (PAMC)</td>
                <td id="urs-detail-maladie" class="py-2 px-3 text-slate-500 italic">--</td>
                <td class="py-1 px-3 text-right">
                  <input type="number" step="0.01" id="urs-off-maladie" value="0.00" oninput="actualiserCalculsUrssaf()" class="w-28 text-right p-1 bg-slate-50 border border-slate-300 rounded font-semibold text-xs focus:bg-white focus:ring-1 focus:ring-blue-500">
                </td>
                <td id="urs-simu-maladie" class="py-2 px-3 text-right font-bold text-blue-600">--</td>
              </tr>
              <tr>
                <td class="py-2 px-3 font-semibold">Allocations Familiales</td>
                <td id="urs-detail-alloc" class="py-2 px-3 text-slate-500 italic">--</td>
                <td class="py-1 px-3 text-right">
                  <input type="number" step="0.01" id="urs-off-alloc" value="0.00" oninput="actualiserCalculsUrssaf()" class="w-28 text-right p-1 bg-slate-50 border border-slate-300 rounded font-semibold text-xs focus:bg-white focus:ring-1 focus:ring-blue-500">
                </td>
                <td id="urs-simu-alloc" class="py-2 px-3 text-right font-bold text-blue-600">--</td>
              </tr>
              <tr>
                <td class="py-2 px-3 font-semibold">CSG (9,2 %) / CRDS (0,5 %)</td>
                <td id="urs-detail-csg" class="py-2 px-3 text-slate-500 italic">--</td>
                <td class="py-1 px-3 text-right">
                  <input type="number" step="0.01" id="urs-off-csg" value="0.00" oninput="actualiserCalculsUrssaf()" class="w-28 text-right p-1 bg-slate-50 border border-slate-300 rounded font-semibold text-xs focus:bg-white focus:ring-1 focus:ring-blue-500">
                </td>
                <td id="urs-simu-csg" class="py-2 px-3 text-right font-bold text-blue-600">--</td>
              </tr>
              <tr>
                <td class="py-2 px-3 font-semibold">Formation Professionnelle (CFP)</td>
                <td id="urs-detail-cfp" class="py-2 px-3 text-slate-500 italic">--</td>
                <td class="py-1 px-3 text-right">
                  <input type="number" step="0.01" id="urs-off-cfp" value="0.00" oninput="actualiserCalculsUrssaf()" class="w-28 text-right p-1 bg-slate-50 border border-slate-300 rounded font-semibold text-xs focus:bg-white focus:ring-1 focus:ring-blue-500">
                </td>
                <td id="urs-simu-cfp" class="py-2 px-3 text-right font-bold text-blue-600">--</td>
              </tr>
              <tr class="bg-slate-800 text-white font-bold text-sm">
                <td class="py-2.5 px-3">TOTAL ANNUEL PAR POSTES</td>
                <td class="py-2.5 px-3 text-slate-300 font-normal italic text-xs">Somme globale de l'année</td>
                <td id="urs-txt-tot-off-postes" class="py-2.5 px-3 text-right text-slate-100 font-extrabold">--</td>
                <td id="urs-simu-tot-postes" class="py-2.5 px-3 text-right text-emerald-400 font-extrabold">--</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

    </div>
  `;

  actualiserCalculsUrssaf();
}

function changerAnneeUrssaf(nouvelleAnnee) {
  window.anneeUrssafSelectionnee = parseInt(nouvelleAnnee, 10);
  window.actualiserUrssaf();
}

window.actualiserUrssaf = function() {
  const transactions = window.transactionsUrssafCache || window.listeTransactions || window.state?.transactions || [];
  renderUrssafUI(transactions);
};

async function initUrssafModule() {
  let transactions = window.listeTransactions || window.state?.transactions || [];

  if (transactions.length === 0 && window.supabaseClient) {
    try {
      const { data } = await window.supabaseClient.from('transactions').select('*');
      if (data) transactions = data;
    } catch (e) {
      console.warn("Supabase non disponible pour URSSAF.");
    }
  }

  renderUrssafUI(transactions);
}

window.initUrssafModule = initUrssafModule;
window.initUrssaf = initUrssafModule;
window.changerAnneeUrssaf = changerAnneeUrssaf;

document.addEventListener('DOMContentLoaded', initUrssafModule);

document.addEventListener('click', (e) => {
  if (e.target && e.target.innerText && e.target.innerText.includes('URSSAF')) {
    setTimeout(initUrssafModule, 100);
  }
});
