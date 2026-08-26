
/**
 * urssaf.js - Module URSSAF pour Infirmier Libéral (PAMC)
 * Gestion trimestrielle (T1, T2, T3, T4) et ajustement des plafonds PASS.
 *
 * Les plafonds Tranche A / Tranche B et tous les taux (Maladie A/B/C,
 * non-conventionné, CSG-CRDS, Allocations Familiales, CFP) ne sont plus
 * codés en dur ici : ils viennent de la table Supabase `bareme_urssaf`,
 * consultable et modifiable depuis l'écran "⚙️ Barème URSSAF" (voir
 * bareme_urssaf.js). Ça permet de mettre à jour le barème chaque année sans
 * toucher au code.
 */
 
(function () {
  window.anneeUrssafSelectionnee = window.anneeUrssafSelectionnee || new Date().getFullYear();
  window.baremeUrssafActif = window.baremeUrssafActif || null; // barème (plafonds + taux) de l'année en cours d'affichage
 
  function formatEuro(valeur) {
    return Number(valeur || 0).toLocaleString('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }
 
  // bareme = ligne renvoyée par window.obtenirBaremeUrssaf() : plafonds Tranche A/B
  // et tous les taux de l'année (voir bareme_urssaf.js pour le détail des champs).
  function calculerUrssaf(bnc, bareme, passTrA, maxTrB, conventionne) {
    bnc = bnc || 0;
    passTrA = passTrA || bareme.plafond_tranche_a;
    maxTrB = maxTrB || bareme.plafond_tranche_b;
 
    const partTrA = Math.min(Math.max(bnc, 0), passTrA);
    const partTrB = Math.min(Math.max(bnc - passTrA, 0), Math.max(maxTrB - passTrA, 0));
    const partTrC = Math.max(bnc - maxTrB, 0);
 
    let maladieProv = 0;
    let maladieDetail = "";
    if (conventionne) {
      maladieProv = (partTrA * bareme.taux_maladie_tranche_a / 100)
                  + (partTrB * bareme.taux_maladie_tranche_b / 100)
                  + (partTrC * bareme.taux_maladie_tranche_c / 100);
      maladieDetail = `Tr A (${bareme.taux_maladie_tranche_a} %) + Tr B (${bareme.taux_maladie_tranche_b} %) + Tr C au-delà (${bareme.taux_maladie_tranche_c} %)`;
    } else {
      maladieProv = bnc * bareme.taux_maladie_non_conventionne / 100;
      maladieDetail = `Taux plein non-conventionné (${bareme.taux_maladie_non_conventionne} %)`;
    }
 
    let tauxAllocFam = 0;
    const ratioPASS = passTrA > 0 ? bnc / passTrA : 0;
    const tauxMaxAlloc = bareme.taux_alloc_fam_max / 100;
    if (ratioPASS <= 1.10) {
      tauxAllocFam = 0;
    } else if (ratioPASS <= 1.40) {
      tauxAllocFam = ((ratioPASS - 1.10) / 0.30) * tauxMaxAlloc;
    } else {
      tauxAllocFam = tauxMaxAlloc;
    }
    const allocFamProv = bnc * tauxAllocFam;
    const allocFamDetail = `Taux effectif de ${(tauxAllocFam * 100).toFixed(2)} % (plafond ${bareme.taux_alloc_fam_max} %, selon barème BNC/PASS)`;
 
    const assietteCSG = bnc * 1.15;
    const csgDeductible = assietteCSG * bareme.taux_csg_deductible / 100;
    const csgNonDeductible = assietteCSG * bareme.taux_csg_non_deductible / 100;
    const crds = assietteCSG * bareme.taux_crds / 100;
    const totalCsgCrds = csgDeductible + csgNonDeductible + crds;
    const csgDetail = `Base majorée (~115 % du BNC = ${formatEuro(assietteCSG)}) : CSG ${(bareme.taux_csg_deductible + bareme.taux_csg_non_deductible).toFixed(2)} % + CRDS ${bareme.taux_crds} %`;
 
    const cfpProv = bareme.cfp_montant_annuel;
    const cfpDetail = `Forfait annuel fixé par le barème ${bareme.annee}`;
 
    const totalAnnuel = maladieProv + allocFamProv + totalCsgCrds + cfpProv;
 
    return {
      tranches: { partTrA, partTrB, partTrC },
      postes: {
        maladie: { montant: +maladieProv.toFixed(2), detail: maladieDetail },
        allocFam: { montant: +allocFamProv.toFixed(2), detail: allocFamDetail },
        csgCrds: { montant: +totalCsgCrds.toFixed(2), detail: csgDetail },
        cfp: { montant: +cfpProv.toFixed(2), detail: cfpDetail }
      },
      totalAnnuel: +totalAnnuel.toFixed(2),
      trimestres: {
        t1: +(totalAnnuel / 4).toFixed(2),
        t2: +(totalAnnuel / 4).toFixed(2),
        t3: +(totalAnnuel / 4).toFixed(2),
        t4: +(totalAnnuel / 4).toFixed(2)
      }
    };
  }
 
  // Calcule le BNC réel de l'année à partir de la comptabilité (même logique que
  // l'onglet "Bilan / CE" : recettes - dépenses sur les écritures du compte
  // banque 512xxx). Sert à pré-remplir le champ BNC pour que l'utilisateur
  // n'ait pas à ressaisir un chiffre qu'on connaît déjà ; le champ reste
  // modifiable pour simuler une estimation différente.
  async function calculerBncReelAnnuel(annee) {
    if (!window.supabaseClient) return 0;
    try {
      const dateDebut = `${annee}-01-01`;
      const dateFin = `${annee}-12-31`;
      const { data, error } = await window.supabaseClient
        .from('ecritures_comptables')
        .select('*')
        .or('compte_code.eq.512000,compte_code.like.512%')
        .gte('date', dateDebut)
        .lte('date', dateFin);
      if (error) throw error;
 
      let totalRecettes = 0;
      let totalDepenses = 0;
      (data || []).forEach(row => {
        const debit = parseFloat(row.debit || 0);
        const credit = parseFloat(row.credit || 0);
        if (debit > 0) totalRecettes += debit;
        else if (credit > 0) totalDepenses += credit;
      });
      return +(totalRecettes - totalDepenses).toFixed(2);
    } catch (e) {
      console.error('❌ Impossible de calculer le BNC réel :', e.message);
      return 0;
    }
  }
  window.calculerBncReelUrssaf = calculerBncReelAnnuel;
 
  window.reinitialiserBncReelUrssaf = function () {
    const el = document.getElementById('urs-input-bnc');
    if (el && window.bncReelUrssafActuel) {
      el.value = window.bncReelUrssafActuel;
      actualiserCalculsUrssaf();
    }
  };
 
  function obtenirAnneesDisponibles(transactions = []) {
    const annees = new Set();
    annees.add(new Date().getFullYear());
    transactions.forEach(tx => {
      if (tx.date) {
        const d = new Date(tx.date);
        if (!isNaN(d.getTime())) annees.add(d.getFullYear());
      }
    });
    return Array.from(annees).sort((a, b) => b - a);
  }
 
  function obtenirConteneurURSSAF() {
    let target = document.getElementById('urssaf') ||
                 document.getElementById('vue-urssaf') ||
                 document.getElementById('urssaf-container');
 
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
 
  window.actualiserCalculsUrssaf = function() {
    if (!window.baremeUrssafActif) return; // barème pas encore chargé
 
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
 
    const simu = calculerUrssaf(bncVal, window.baremeUrssafActif, passTrAVal, maxTrBVal, convVal);
 
    const offT1 = parseFloatOrZero('urs-off-t1');
    const offT2 = parseFloatOrZero('urs-off-t2');
    const offT3 = parseFloatOrZero('urs-off-t3');
    const offT4 = parseFloatOrZero('urs-off-t4');
    const totalOffTrimestres = offT1 + offT2 + offT3 + offT4;
 
    const offMaladie = parseFloatOrZero('urs-off-maladie');
    const offAlloc = parseFloatOrZero('urs-off-alloc');
    const offCsg = parseFloatOrZero('urs-off-csg');
    const offCfp = parseFloatOrZero('urs-off-cfp');
    const totalOffPostes = offMaladie + offAlloc + offCsg + offCfp;
 
    const totalOfficielRetenu = totalOffTrimestres > 0 ? totalOffTrimestres : totalOffPostes;
    const payeBanque = window.payeBanqueUrssafActuel || 0;
    const baseCompare = payeBanque > 0 ? payeBanque : totalOfficielRetenu;
    const tropCotise = baseCompare - simu.totalAnnuel;
 
    const mapText = {
      'urs-txt-part-tra': formatEuro(simu.tranches.partTrA),
      'urs-txt-part-trb': formatEuro(simu.tranches.partTrB),
      'urs-txt-part-trc': formatEuro(simu.tranches.partTrC),
      'urs-txt-tot-off-trim': formatEuro(totalOffTrimestres),
      'urs-txt-tot-simu-trim': formatEuro(simu.totalAnnuel),
      'urs-simu-t1': formatEuro(simu.trimestres.t1),
      'urs-simu-t2': formatEuro(simu.trimestres.t2),
      'urs-simu-t3': formatEuro(simu.trimestres.t3),
      'urs-simu-t4': formatEuro(simu.trimestres.t4),
      'urs-simu-maladie': formatEuro(simu.postes.maladie.montant),
      'urs-simu-alloc': formatEuro(simu.postes.allocFam.montant),
      'urs-simu-csg': formatEuro(simu.postes.csgCrds.montant),
      'urs-simu-cfp': formatEuro(simu.postes.cfp.montant),
      'urs-simu-tot-postes': formatEuro(simu.totalAnnuel),
      'urs-txt-tot-off-postes': formatEuro(totalOffPostes),
      'urs-detail-maladie': simu.postes.maladie.detail,
      'urs-detail-alloc': simu.postes.allocFam.detail,
      'urs-detail-csg': simu.postes.csgCrds.detail,
      'urs-detail-cfp': simu.postes.cfp.detail
    };
 
    for (const [id, txt] of Object.entries(mapText)) {
      const el = document.getElementById(id);
      if (el) el.textContent = txt;
    }
 
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
 
  async function renderUrssafUI(transactions = []) {
    window.transactionsUrssafCache = transactions;
    const container = obtenirConteneurURSSAF();
    if (!container) return;
 
    const annees = obtenirAnneesDisponibles(transactions);
    const anneeActive = window.anneeUrssafSelectionnee;
 
    container.innerHTML = `<p style="color:#64748b;padding:16px;">Chargement du barème URSSAF ${anneeActive}...</p>`;
 
    const bareme = window.obtenirBaremeUrssaf
      ? await window.obtenirBaremeUrssaf(anneeActive)
      : { annee: anneeActive, pass: 48060, plafond_tranche_a: 48060, plafond_tranche_b: 192240, taux_maladie_tranche_a: 0.10, taux_maladie_tranche_b: 0.10, taux_maladie_tranche_c: 0.10, taux_maladie_non_conventionne: 8.50, taux_csg_deductible: 6.80, taux_csg_non_deductible: 2.40, taux_crds: 0.50, taux_alloc_fam_max: 3.10, cfp_montant_annuel: 137 };
    window.baremeUrssafActif = bareme;
 
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
 
    const bncReel = await calculerBncReelAnnuel(anneeActive);
    window.bncReelUrssafActuel = bncReel;
    const bncInitial = bncReel > 0 ? bncReel : bareme.pass;
 
    const baremeVientDeAnneeDifferente = parseInt(bareme.annee, 10) !== parseInt(anneeActive, 10);
 
    container.innerHTML = `
      <div class="space-y-6 max-w-6xl mx-auto p-4 font-sans text-slate-800">
        <div class="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex flex-wrap justify-between items-center gap-4">
          <div>
            <h2 class="text-xl font-bold text-slate-800 flex items-center gap-2">
              🏛️ Cotisations URSSAF (${anneeActive})
            </h2>
            <p class="text-xs text-slate-500 mt-1">Calculateur avec gestion trimestrielle et ajustement des plafonds Tr A, Tr B et Tr C. Barème modifiable dans l'onglet <strong>⚙️ Barème URSSAF</strong>.</p>
          </div>
          <div class="flex items-center gap-4">
            <div class="flex items-center gap-2">
              <label for="select-annee-urssaf" class="text-xs font-semibold text-slate-700">Année :</label>
              <select id="select-annee-urssaf" onchange="changerAnneeUrssaf(this.value)" class="form-select bg-slate-50 border border-slate-300 text-slate-900 text-xs rounded-lg font-bold p-2 focus:ring-blue-500 focus:border-blue-500">
                ${annees.map(a => `<option value="${a}" ${a === anneeActive ? 'selected' : ''}>${a}</option>`).join('')}
              </select>
            </div>
            <div class="bg-blue-50 text-blue-800 text-xs px-3 py-2 rounded-lg font-semibold border border-blue-200">
              Prélèvements Banque : ${formatEuro(payeBanque)} (${nbPaiements} op.)
            </div>
          </div>
        </div>
 
        ${baremeVientDeAnneeDifferente ? `
        <div class="bg-amber-50 border border-amber-300 text-amber-900 text-xs p-3 rounded-lg">
          ⚠️ Aucun barème n'existe pour ${anneeActive} : les plafonds et taux de <strong>${bareme.annee}</strong> sont utilisés par défaut. Ajoutez l'année ${anneeActive} dans <strong>⚙️ Barème URSSAF</strong> pour des chiffres exacts.
        </div>` : ''}
        ${bareme.notes ? `
        <div class="bg-slate-50 border border-slate-200 text-slate-600 text-xs p-3 rounded-lg italic">📌 ${bareme.notes}</div>` : ''}
 
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
 
        <div class="bg-white p-5 rounded-xl shadow-sm border border-slate-200 space-y-4">
          <h3 class="text-xs font-bold uppercase tracking-wider text-blue-700">1. Base de Calcul & Plafonds d'Imposition (${anneeActive})</h3>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label class="block text-xs font-semibold text-slate-700 mb-1">BNC Réel / Estimé (€) :</label>
              <input type="number" id="urs-input-bnc" value="${bncInitial}" class="w-full text-xs border border-slate-300 rounded-lg p-2 bg-slate-50 focus:bg-white font-bold" oninput="actualiserCalculsUrssaf()">
              <p class="text-[10px] mt-1 ${bncReel > 0 ? 'text-emerald-600' : 'text-slate-400'}">
                ${bncReel > 0
                  ? `✅ Pré-rempli avec le résultat réel ${anneeActive} (recettes − dépenses de la comptabilité). Modifiez-le librement pour tester une estimation. <button type="button" onclick="reinitialiserBncReelUrssaf()" class="underline font-semibold">↺ Revenir au réel</button>`
                  : `ℹ️ Aucune écriture comptable trouvée pour ${anneeActive} : valeur de départ arbitraire, à saisir vous-même.`}
              </p>
            </div>
            <div>
              <label class="block text-xs font-semibold text-slate-700 mb-1">Plafond Tranche A (€) :</label>
              <input type="number" id="urs-input-pass-tra" value="${bareme.plafond_tranche_a}" class="w-full text-xs border border-slate-300 rounded-lg p-2 bg-slate-50 focus:bg-white text-blue-700 font-semibold" oninput="actualiserCalculsUrssaf()">
            </div>
            <div>
              <label class="block text-xs font-semibold text-slate-700 mb-1">Plafond Tranche B (€) :</label>
              <input type="number" id="urs-input-pass-trb" value="${bareme.plafond_tranche_b}" class="w-full text-xs border border-slate-300 rounded-lg p-2 bg-slate-50 focus:bg-white text-blue-700 font-semibold" oninput="actualiserCalculsUrssaf()">
            </div>
          </div>
          <div class="flex items-center justify-between flex-wrap gap-2 pt-2 border-t border-slate-100 text-xs">
            <div class="flex items-center gap-2">
              <input type="checkbox" id="urs-input-conv" checked class="rounded text-blue-600" onchange="actualiserCalculsUrssaf()">
              <label for="urs-input-conv" class="text-slate-600 font-medium">Praticien Médical Conventionné PAMC</label>
            </div>
            <div class="text-slate-500">
              Ventilation BNC : Tr A = <strong id="urs-txt-part-tra" class="text-slate-700">--</strong> | Tr B = <strong id="urs-txt-part-trb" class="text-slate-700">--</strong> | Tr C (au-delà) = <strong id="urs-txt-part-trc" class="text-slate-700">--</strong>
            </div>
          </div>
        </div>
 
        <div class="bg-white p-5 rounded-xl shadow-sm border border-slate-200 space-y-3">
          <h3 class="text-xs font-bold uppercase tracking-wider text-blue-700">2. Échéancier Trimestriel URSSAF (${anneeActive})</h3>
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
                  <td class="py-1 px-3 text-right"><input type="number" step="0.01" id="urs-off-t1" value="0.00" oninput="actualiserCalculsUrssaf()" class="w-32 text-right p-1 bg-slate-50 border border-slate-300 rounded font-semibold text-xs"></td>
                  <td id="urs-simu-t1" class="py-2 px-3 text-right font-bold text-blue-600">--</td>
                </tr>
                <tr>
                  <td class="py-2 px-3 font-semibold">2ème Trimestre (T2)</td>
                  <td class="py-2 px-3 text-slate-500">5 Mai</td>
                  <td class="py-1 px-3 text-right"><input type="number" step="0.01" id="urs-off-t2" value="0.00" oninput="actualiserCalculsUrssaf()" class="w-32 text-right p-1 bg-slate-50 border border-slate-300 rounded font-semibold text-xs"></td>
                  <td id="urs-simu-t2" class="py-2 px-3 text-right font-bold text-blue-600">--</td>
                </tr>
                <tr>
                  <td class="py-2 px-3 font-semibold">3ème Trimestre (T3)</td>
                  <td class="py-2 px-3 text-slate-500">5 Août</td>
                  <td class="py-1 px-3 text-right"><input type="number" step="0.01" id="urs-off-t3" value="0.00" oninput="actualiserCalculsUrssaf()" class="w-32 text-right p-1 bg-slate-50 border border-slate-300 rounded font-semibold text-xs"></td>
                  <td id="urs-simu-t3" class="py-2 px-3 text-right font-bold text-blue-600">--</td>
                </tr>
                <tr>
                  <td class="py-2 px-3 font-semibold">4ème Trimestre (T4)</td>
                  <td class="py-2 px-3 text-slate-500">5 Novembre</td>
                  <td class="py-1 px-3 text-right"><input type="number" step="0.01" id="urs-off-t4" value="0.00" oninput="actualiserCalculsUrssaf()" class="w-32 text-right p-1 bg-slate-50 border border-slate-300 rounded font-semibold text-xs"></td>
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
 
        <div class="bg-white p-5 rounded-xl shadow-sm border border-slate-200 space-y-3">
          <h3 class="text-xs font-bold uppercase tracking-wider text-blue-700">3. Ventilation Annuelle Poste par Poste</h3>
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
                  <td class="py-1 px-3 text-right"><input type="number" step="0.01" id="urs-off-maladie" value="0.00" oninput="actualiserCalculsUrssaf()" class="w-28 text-right p-1 bg-slate-50 border border-slate-300 rounded font-semibold text-xs"></td>
                  <td id="urs-simu-maladie" class="py-2 px-3 text-right font-bold text-blue-600">--</td>
                </tr>
                <tr>
                  <td class="py-2 px-3 font-semibold">Allocations Familiales</td>
                  <td id="urs-detail-alloc" class="py-2 px-3 text-slate-500 italic">--</td>
                  <td class="py-1 px-3 text-right"><input type="number" step="0.01" id="urs-off-alloc" value="0.00" oninput="actualiserCalculsUrssaf()" class="w-28 text-right p-1 bg-slate-50 border border-slate-300 rounded font-semibold text-xs"></td>
                  <td id="urs-simu-alloc" class="py-2 px-3 text-right font-bold text-blue-600">--</td>
                </tr>
                <tr>
                  <td class="py-2 px-3 font-semibold">CSG / CRDS</td>
                  <td id="urs-detail-csg" class="py-2 px-3 text-slate-500 italic">--</td>
                  <td class="py-1 px-3 text-right"><input type="number" step="0.01" id="urs-off-csg" value="0.00" oninput="actualiserCalculsUrssaf()" class="w-28 text-right p-1 bg-slate-50 border border-slate-300 rounded font-semibold text-xs"></td>
                  <td id="urs-simu-csg" class="py-2 px-3 text-right font-bold text-blue-600">--</td>
                </tr>
                <tr>
                  <td class="py-2 px-3 font-semibold">Formation Professionnelle (CFP)</td>
                  <td id="urs-detail-cfp" class="py-2 px-3 text-slate-500 italic">--</td>
                  <td class="py-1 px-3 text-right"><input type="number" step="0.01" id="urs-off-cfp" value="0.00" oninput="actualiserCalculsUrssaf()" class="w-28 text-right p-1 bg-slate-50 border border-slate-300 rounded font-semibold text-xs"></td>
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
 
  window.changerAnneeUrssaf = function(nouvelleAnnee) {
    window.anneeUrssafSelectionnee = parseInt(nouvelleAnnee, 10);
    renderUrssafUI(window.transactionsUrssafCache || []);
  };
 
  window.initUrssafModule = async function() {
    let transactions = window.listeTransactions || window.state?.transactions || [];
    if (transactions.length === 0 && window.supabaseClient) {
      try {
        const { data } = await window.supabaseClient.from('transactions').select('*');
        if (data) transactions = data;
      } catch (e) {}
    }
    renderUrssafUI(transactions);
  };
 
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', window.initUrssafModule);
  } else {
    window.initUrssafModule();
  }
})();
 
