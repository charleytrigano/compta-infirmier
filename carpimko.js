/**
 * carpimko.js - Module CARPIMKO pour Infirmier Libéral
 * Inclus : Début d'activité (1ère et 2ème année) + Régime de croisière.
 *
 * Les plafonds/taux du Régime de Base, du Régime Complémentaire et du RID ne
 * sont plus codés en dur : ils viennent de la table Supabase
 * `bareme_carpimko`, modifiable depuis l'écran "⚙️ Barème CARPIMKO" (voir
 * bareme_carpimko.js). Le BNC est pré-rempli automatiquement à partir du
 * résultat réel de la comptabilité (même calcul que l'onglet URSSAF, voir
 * window.calculerBncReelUrssaf dans urssaf.js), et reste modifiable pour
 * simuler une estimation.
 */

(function () {
  window.anneeCarpimkoSelectionnee = window.anneeCarpimkoSelectionnee || new Date().getFullYear();
  window.baremeCarpimkoActif = window.baremeCarpimkoActif || null;

  function formatEuro(valeur) {
    return Number(valeur || 0).toLocaleString('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  // bareme = ligne renvoyée par window.obtenirBaremeCarpimko() (voir bareme_carpimko.js).
  //
  // Formule du Régime Complémentaire (unifiée, valable avant ET après la
  // réforme 2026 selon les paramètres du barème) :
  //   cotisation = forfait_complementaire
  //              + taux_complementaire × clamp(assiette - seuil_complementaire, 0, plafond_excedent_complementaire)
  // conventionne : l'ASV (Allocation Supplémentaire Vieillesse) n'existe que
  // pour les praticiens conventionnés (financée en partie par l'Assurance
  // Maladie pour eux) ; pour un praticien non-conventionné, l'ASV ne
  // s'applique pas.
  function calculerCarpimko(bncSaisi, bareme, pass, statut, conventionne) {
    bncSaisi = bncSaisi || 0;
    pass = pass || bareme.pass;
    conventionne = conventionne === undefined ? true : conventionne;

    let assietteBase = bncSaisi;
    let assietteComp = bncSaisi;

    if (statut === 'annee1' || statut === 'annee2') {
      const assietteForfait = pass * bareme.forfait_debut_activite_pct / 100;
      assietteBase = assietteForfait;
      assietteComp = assietteForfait;
    }

    // 1. Régime de Base
    const tr1Base = Math.min(Math.max(assietteBase, 0), bareme.plafond_base_tranche1);
    const tr2Base = Math.min(Math.max(assietteBase, 0), bareme.plafond_base_tranche2);
    const cotisBase = (tr1Base * bareme.taux_base_tranche1 / 100) + (tr2Base * bareme.taux_base_tranche2 / 100);

    // 2. Régime Complémentaire
    const excedentComp = Math.min(Math.max(assietteComp - bareme.seuil_complementaire, 0), bareme.plafond_excedent_complementaire);
    const cotisComp = bareme.forfait_complementaire + (excedentComp * bareme.taux_complementaire / 100);

    // 3. RID (Invalidation-Décès)
    const cotisRID = bareme.rid_montant;

    // 4. ASV (praticiens conventionnés uniquement) : forfait + part proportionnelle sur l'assiette de Base.
    const cotisASV = conventionne ? (bareme.asv_forfait + (assietteBase * bareme.asv_taux / 100)) : 0;

    const totalAnnuel = cotisBase + cotisComp + cotisRID + cotisASV;

    return {
      assietteRetenue: assietteBase,
      base: +cotisBase.toFixed(2),
      complementaire: +cotisComp.toFixed(2),
      rid: +cotisRID.toFixed(2),
      asv: +cotisASV.toFixed(2),
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
    if (!window.baremeCarpimkoActif) return;

    const elBnc = document.getElementById('car-input-bnc');
    const elPass = document.getElementById('car-input-pass');
    const elStatut = document.getElementById('car-select-statut');
    const elConv = document.getElementById('car-input-conv');

    const bncVal = elBnc ? parseFloat(elBnc.value) || 0 : 0;
    const passVal = elPass ? parseFloat(elPass.value) || 0 : window.baremeCarpimkoActif.pass;
    const statutVal = elStatut ? elStatut.value : 'croisiere';
    const convVal = elConv ? elConv.checked : true;

    const simu = calculerCarpimko(bncVal, window.baremeCarpimkoActif, passVal, statutVal, convVal);

    const mapIds = {
      'car-simu-base': simu.base,
      'car-simu-comp': simu.complementaire,
      'car-simu-rid': simu.rid,
      'car-simu-asv': simu.asv,
      'car-simu-total': simu.totalAnnuel,
      'car-simu-trim': simu.trimestre
    };

    for (const [id, val] of Object.entries(mapIds)) {
      const el = document.getElementById(id);
      if (el) el.textContent = formatEuro(val);
    }

    const elAssietteTxt = document.getElementById('car-txt-assiette');
    if (elAssietteTxt) {
      elAssietteTxt.textContent = `Assiette de calcul retenue : ${formatEuro(simu.assietteRetenue)}`;
    }
  };

  // Détermine automatiquement le bon statut CARPIMKO (1ère année / 2ème année
  // / régime de croisière) pour l'année affichée, à partir de la date
  // d'installation renseignée dans le Profil (profile.date_installation).
  // Règle usuelle (la même que l'URSSAF) : l'année civile d'installation
  // compte comme "1ère année", l'année suivante comme "2ème année", et le
  // régime de croisière (BNC réel) s'applique ensuite.
  async function determinerStatutCarpimko(anneeActive) {
    if (!window.supabaseClient) return 'croisiere';
    try {
      const { data, error } = await window.supabaseClient.from('profile').select('date_installation').limit(1);
      if (error || !data || data.length === 0 || !data[0].date_installation) return 'croisiere';
      const anneeInstallation = parseInt(String(data[0].date_installation).slice(0, 4), 10);
      if (isNaN(anneeInstallation)) return 'croisiere';
      if (anneeActive === anneeInstallation) return 'annee1';
      if (anneeActive === anneeInstallation + 1) return 'annee2';
      return 'croisiere';
    } catch (e) {
      return 'croisiere';
    }
  }

  // Exposés pour d'autres modules (statistiques.js) qui ont besoin de calculer
  // des cotisations CARPIMKO pour un BNC donné sans dupliquer la formule.
  window.calculerCarpimko = calculerCarpimko;
  window.determinerStatutCarpimko = determinerStatutCarpimko;

  window.reinitialiserBncReelCarpimko = function () {
    const el = document.getElementById('car-input-bnc');
    if (el && window.bncReelCarpimkoActuel) {
      el.value = window.bncReelCarpimkoActuel;
      actualiserCalculsCarpimko();
    }
  };

  async function renderCarpimkoUI() {
    const container = obtenirConteneurCarpimko();
    if (!container) return;

    const anneeActive = window.anneeCarpimkoSelectionnee;
    container.innerHTML = `<p style="color:#64748b;padding:16px;">Chargement du barème CARPIMKO ${anneeActive}...</p>`;

    const bareme = window.obtenirBaremeCarpimko
      ? await window.obtenirBaremeCarpimko(anneeActive)
      : { annee: anneeActive, pass: 48060, taux_base_tranche1: 8.73, plafond_base_tranche1: 48060, taux_base_tranche2: 1.87, plafond_base_tranche2: 240300, forfait_complementaire: 2090.61, taux_complementaire: 8.70, seuil_complementaire: 24030, plafond_excedent_complementaire: 120150, rid_montant: 1022, forfait_debut_activite_pct: 19, asv_forfait: 224.00, asv_taux: 0.40 };
    window.baremeCarpimkoActif = bareme;

    // Même calcul du BNC réel que l'onglet URSSAF (recettes - dépenses de la
    // comptabilité), pour ne pas avoir à ressaisir un chiffre déjà connu.
    const bncReel = window.calculerBncReelUrssaf ? await window.calculerBncReelUrssaf(anneeActive) : 0;
    window.bncReelCarpimkoActuel = bncReel;
    const bncInitial = bncReel > 0 ? bncReel : bareme.pass;

    const statutAuto = await determinerStatutCarpimko(anneeActive);
    const libellesStatut = { croisiere: 'Régime de Croisière (BNC Réel / Estimé)', annee1: '1ère Année d\'Activité (Forfait)', annee2: '2ème Année d\'Activité (Forfait)' };

    const baremeVientDeAnneeDifferente = parseInt(bareme.annee, 10) !== parseInt(anneeActive, 10);

    container.innerHTML = `
      <div class="space-y-6 max-w-6xl mx-auto p-4 font-sans text-slate-800">
        <div class="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex flex-wrap justify-between items-center gap-4">
          <div>
            <h2 class="text-xl font-bold text-slate-800 flex items-center gap-2">
              🏥 Cotisations CARPIMKO (${anneeActive})
            </h2>
            <p class="text-xs text-slate-500 mt-1">Caisse de retraite et de prévoyance des infirmiers libéraux. Barème modifiable dans l'onglet <strong>⚙️ Barème CARPIMKO</strong>.</p>
          </div>
          <div class="flex items-center gap-2">
            <label for="select-annee-carpimko" class="text-xs font-semibold text-slate-700">Année :</label>
            <select id="select-annee-carpimko" onchange="changerAnneeCarpimko(this.value)" class="form-select bg-slate-50 border border-slate-300 text-slate-900 text-xs rounded-lg font-bold p-2 focus:ring-blue-500 focus:border-blue-500">
              ${[anneeActive - 1, anneeActive, anneeActive + 1].map(a => `<option value="${a}" ${a === anneeActive ? 'selected' : ''}>${a}</option>`).join('')}
            </select>
          </div>
        </div>

        ${baremeVientDeAnneeDifferente ? `
        <div class="bg-amber-50 border border-amber-300 text-amber-900 text-xs p-3 rounded-lg">
          ⚠️ Aucun barème n'existe pour ${anneeActive} : les plafonds et taux de <strong>${bareme.annee}</strong> sont utilisés par défaut. Ajoutez l'année ${anneeActive} dans <strong>⚙️ Barème CARPIMKO</strong> pour des chiffres exacts.
        </div>` : ''}
        ${bareme.notes ? `
        <div class="bg-slate-50 border border-slate-200 text-slate-600 text-xs p-3 rounded-lg italic">📌 ${bareme.notes}</div>` : ''}

        <div class="bg-white p-5 rounded-xl shadow-sm border border-slate-200 space-y-4">
          <h3 class="text-xs font-bold uppercase tracking-wider text-blue-700">1. Situation & Assiette de Calcul</h3>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label class="block text-xs font-semibold text-slate-700 mb-1">Situation / Ancienneté :</label>
              <select id="car-select-statut" class="w-full text-xs border border-slate-300 rounded-lg p-2 bg-slate-50 font-bold text-slate-800" onchange="actualiserCalculsCarpimko()">
                <option value="croisiere" ${statutAuto === 'croisiere' ? 'selected' : ''}>Régime de Croisière (BNC Réel / Estimé)</option>
                <option value="annee1" ${statutAuto === 'annee1' ? 'selected' : ''}>1ère Année d'Activité (Forfait)</option>
                <option value="annee2" ${statutAuto === 'annee2' ? 'selected' : ''}>2ème Année d'Activité (Forfait)</option>
              </select>
              <p class="text-[10px] text-emerald-600 mt-1">✅ Sélection automatique (${libellesStatut[statutAuto]}) d'après la date d'installation renseignée dans le Profil. Modifiable librement.</p>
            </div>
            <div>
              <label class="block text-xs font-semibold text-slate-700 mb-1">BNC Estimé (€) :</label>
              <input type="number" id="car-input-bnc" value="${bncInitial}" class="w-full text-xs border border-slate-300 rounded-lg p-2 bg-slate-50 focus:bg-white font-bold" oninput="actualiserCalculsCarpimko()">
              <p class="text-[10px] mt-1 ${bncReel > 0 ? 'text-emerald-600' : 'text-slate-400'}">
                ${bncReel > 0
                  ? `✅ Pré-rempli avec le résultat réel ${anneeActive}. Modifiez-le librement pour tester une estimation. <button type="button" onclick="reinitialiserBncReelCarpimko()" class="underline font-semibold">↺ Revenir au réel</button>`
                  : `ℹ️ Aucune écriture comptable trouvée pour ${anneeActive} : valeur de départ arbitraire, à saisir vous-même.`}
              </p>
            </div>
            <div>
              <label class="block text-xs font-semibold text-slate-700 mb-1">PASS de l'Année (€) :</label>
              <input type="number" id="car-input-pass" value="${bareme.pass}" class="w-full text-xs border border-slate-300 rounded-lg p-2 bg-slate-50 focus:bg-white font-semibold text-blue-700" oninput="actualiserCalculsCarpimko()">
            </div>
          </div>
          <p id="car-txt-assiette" class="text-xs text-slate-500 font-medium italic pt-1">--</p>
          <div class="flex items-center gap-2 pt-2 border-t border-slate-100">
            <input type="checkbox" id="car-input-conv" checked class="rounded text-blue-600" onchange="actualiserCalculsCarpimko()">
            <label for="car-input-conv" class="text-xs text-slate-600 font-medium">Praticien Conventionné (ouvre droit à l'ASV, financée en partie par l'Assurance Maladie)</label>
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
                <tr>
                  <td class="py-2 px-3 font-semibold">ASV (Conventionnés)</td>
                  <td id="car-simu-asv" class="py-2 px-3 text-right font-bold text-slate-800">--</td>
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

  window.changerAnneeCarpimko = function(nouvelleAnnee) {
    window.anneeCarpimkoSelectionnee = parseInt(nouvelleAnnee, 10);
    renderCarpimkoUI();
  };

  window.initCarpimkoModule = renderCarpimkoUI;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderCarpimkoUI);
  } else {
    renderCarpimkoUI();
  }
})();
