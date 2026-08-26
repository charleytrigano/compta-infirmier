/**
 * bareme_ir.js - Barème Impôt sur le Revenu (IR) modifiable, année par année.
 *
 * Même principe que bareme_urssaf.js / bareme_carpimko.js : les tranches et
 * taux du barème progressif de l'IR, l'abattement Micro-BNC (34 %/305 €) et
 * le taux du Versement Libératoire (2,2 %) ne sont plus codés en dur dans
 * ir.js, mais viennent de la table Supabase `bareme_ir`, partagée entre tous
 * les infirmiers (ce sont des taux officiels, pas une donnée personnelle),
 * consultable et modifiable depuis cet écran.
 *
 * Convention : "annee" = année des revenus (ex. barème "2025" = celui qui
 * s'applique aux revenus 2025, déclarés en 2026), pour correspondre à
 * l'année d'activité déjà utilisée par les onglets URSSAF/CARPIMKO.
 *
 * window.obtenirBaremeIR(annee) est exposé pour que ir.js puisse récupérer
 * le barème d'une année sans dupliquer la logique Supabase.
 */

(function () {
  // Valeurs de secours si la table est vide ou injoignable (mode hors-ligne) :
  // barème officiel des revenus 2025 (déclaration 2026).
  var BAREME_PAR_DEFAUT = {
    annee: new Date().getFullYear(),
    plafond_tranche1: 11600,
    taux_tranche1: 0,
    plafond_tranche2: 29579,
    taux_tranche2: 11,
    plafond_tranche3: 84577,
    taux_tranche3: 30,
    plafond_tranche4: 181917,
    taux_tranche4: 41,
    taux_tranche5: 45,
    abattement_micro_bnc_pct: 34,
    abattement_micro_bnc_plancher: 305,
    taux_versement_liberatoire: 2.2,
    notes: 'Valeur de secours (table bareme_ir injoignable).'
  };

  var CHAMPS = [
    { id: 'plafond_tranche1', label: 'Tranche 1 - Plafond (€, taux 0 %)', type: 'number', step: '1' },
    { id: 'plafond_tranche2', label: 'Tranche 2 - Plafond (€)', type: 'number', step: '1' },
    { id: 'taux_tranche2', label: 'Tranche 2 - Taux (%)', type: 'number', step: '0.01' },
    { id: 'plafond_tranche3', label: 'Tranche 3 - Plafond (€)', type: 'number', step: '1' },
    { id: 'taux_tranche3', label: 'Tranche 3 - Taux (%)', type: 'number', step: '0.01' },
    { id: 'plafond_tranche4', label: 'Tranche 4 - Plafond (€)', type: 'number', step: '1' },
    { id: 'taux_tranche4', label: 'Tranche 4 - Taux (%)', type: 'number', step: '0.01' },
    { id: 'taux_tranche5', label: 'Tranche 5 - Taux au-delà (%)', type: 'number', step: '0.01' },
    { id: 'abattement_micro_bnc_pct', label: 'Micro-BNC - Abattement (%)', type: 'number', step: '0.01' },
    { id: 'abattement_micro_bnc_plancher', label: 'Micro-BNC - Abattement plancher (€)', type: 'number', step: '1' },
    { id: 'taux_versement_liberatoire', label: 'Versement Libératoire - Taux (%)', type: 'number', step: '0.01' },
    { id: 'notes', label: 'Notes (facultatif)', type: 'text', step: null }
  ];

  window.baremeIRCache = window.baremeIRCache || null;
  window.anneeBaremeIREnEdition = window.anneeBaremeIREnEdition || null;

  function formatEuro(valeur) {
    return Number(valeur || 0).toLocaleString('fr-FR', {
      style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0
    });
  }
  function formatPct(valeur) {
    return Number(valeur || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' %';
  }

  function obtenirConteneur() {
    return document.getElementById('bareme-ir-container');
  }

  async function chargerLignesBareme(forcerRechargement) {
    if (window.baremeIRCache && !forcerRechargement) return window.baremeIRCache;
    if (!window.supabaseClient) {
      window.baremeIRCache = [BAREME_PAR_DEFAUT];
      return window.baremeIRCache;
    }
    try {
      const { data, error } = await window.supabaseClient
        .from('bareme_ir')
        .select('*')
        .order('annee', { ascending: false });
      if (error) throw error;
      window.baremeIRCache = (data && data.length > 0) ? data : [BAREME_PAR_DEFAUT];
    } catch (e) {
      console.error('❌ Impossible de charger le barème IR :', e.message);
      window.baremeIRCache = [BAREME_PAR_DEFAUT];
    }
    return window.baremeIRCache;
  }

  // Exposé pour ir.js : renvoie le barème de l'année demandée, ou à défaut
  // celui de l'année connue la plus proche en dessous, ou à défaut la valeur
  // de secours.
  window.obtenirBaremeIR = async function (annee) {
    const lignes = await chargerLignesBareme(false);
    const exact = lignes.find(l => parseInt(l.annee, 10) === parseInt(annee, 10));
    if (exact) return exact;
    const anterieures = lignes.filter(l => parseInt(l.annee, 10) <= parseInt(annee, 10));
    if (anterieures.length > 0) return anterieures[0];
    return lignes[0] || BAREME_PAR_DEFAUT;
  };

  window.modifierLigneBaremeIR = function (annee) {
    window.anneeBaremeIREnEdition = annee;
    renderBaremeIRUI();
  };

  window.annulerEditionBaremeIR = function () {
    window.anneeBaremeIREnEdition = null;
    renderBaremeIRUI();
  };

  window.ajouterAnneeBaremeIR = function () {
    const lignes = window.baremeIRCache || [];
    const derniereAnnee = lignes.length > 0 ? Math.max(...lignes.map(l => parseInt(l.annee, 10))) : (new Date().getFullYear() - 1);
    const nouvelleAnnee = derniereAnnee + 1;
    if (lignes.some(l => parseInt(l.annee, 10) === nouvelleAnnee)) {
      alert(`L'année ${nouvelleAnnee} existe déjà dans le barème.`);
      return;
    }
    const modele = lignes[0] || BAREME_PAR_DEFAUT;
    const nouvelleLigne = Object.assign({}, modele, { annee: nouvelleAnnee, notes: 'Nouvelle année : à vérifier et compléter.' });
    window.baremeIRCache = [nouvelleLigne].concat(lignes);
    window.anneeBaremeIREnEdition = nouvelleAnnee;
    renderBaremeIRUI();
  };

  window.enregistrerLigneBaremeIR = async function (annee) {
    if (!window.supabaseClient) {
      alert('Connexion à Supabase indisponible : impossible d\'enregistrer.');
      return;
    }
    const ligne = { annee: parseInt(annee, 10) };
    for (const champ of CHAMPS) {
      const el = document.getElementById('bareme-ir-input-' + champ.id);
      if (!el) continue;
      if (champ.type === 'number') {
        const val = parseFloat(el.value);
        ligne[champ.id] = isNaN(val) ? 0 : val;
      } else {
        ligne[champ.id] = el.value || null;
      }
    }
    try {
      const { error } = await window.supabaseClient
        .from('bareme_ir')
        .upsert(ligne, { onConflict: 'annee' });
      if (error) throw error;
      window.anneeBaremeIREnEdition = null;
      await chargerLignesBareme(true);
      renderBaremeIRUI();
      alert(`✅ Barème IR ${annee} enregistré.`);
    } catch (e) {
      alert('❌ Échec de l\'enregistrement : ' + e.message);
    }
  };

  window.supprimerLigneBaremeIR = async function (annee) {
    if (!confirm(`Supprimer le barème IR de l'année ${annee} ? Cette action est irréversible.`)) return;
    if (!window.supabaseClient) return;
    try {
      const { error } = await window.supabaseClient.from('bareme_ir').delete().eq('annee', annee);
      if (error) throw error;
      await chargerLignesBareme(true);
      renderBaremeIRUI();
    } catch (e) {
      alert('❌ Échec de la suppression : ' + e.message);
    }
  };

  function ligneAffichage(ligne) {
    return `
      <tr class="border-b divide-x divide-slate-100">
        <td class="py-2 px-3 font-bold text-slate-800">${ligne.annee}</td>
        <td class="py-2 px-3 text-right">${formatEuro(0)} → ${formatEuro(ligne.plafond_tranche1)}<br><span class="text-[10px] text-slate-500">${formatPct(ligne.taux_tranche1)}</span></td>
        <td class="py-2 px-3 text-right">${formatEuro(ligne.plafond_tranche1)} → ${formatEuro(ligne.plafond_tranche2)}<br><span class="text-[10px] text-slate-500">${formatPct(ligne.taux_tranche2)}</span></td>
        <td class="py-2 px-3 text-right">${formatEuro(ligne.plafond_tranche2)} → ${formatEuro(ligne.plafond_tranche3)}<br><span class="text-[10px] text-slate-500">${formatPct(ligne.taux_tranche3)}</span></td>
        <td class="py-2 px-3 text-right">${formatEuro(ligne.plafond_tranche3)} → ${formatEuro(ligne.plafond_tranche4)}<br><span class="text-[10px] text-slate-500">${formatPct(ligne.taux_tranche4)}</span></td>
        <td class="py-2 px-3 text-right"><span class="text-[10px] text-slate-500">au-delà :</span> ${formatPct(ligne.taux_tranche5)}</td>
        <td class="py-2 px-3 text-right">${formatPct(ligne.abattement_micro_bnc_pct)}<br><span class="text-[10px] text-slate-500">plancher ${formatEuro(ligne.abattement_micro_bnc_plancher)}</span></td>
        <td class="py-2 px-3 text-right">${formatPct(ligne.taux_versement_liberatoire)}</td>
        <td class="py-2 px-3 text-slate-500 italic text-[11px] max-w-xs">${ligne.notes || ''}</td>
        <td class="py-2 px-3 text-right whitespace-nowrap">
          <button onclick="modifierLigneBaremeIR(${ligne.annee})" class="text-blue-600 hover:underline text-xs font-semibold">✏️ Modifier</button>
          <button onclick="supprimerLigneBaremeIR(${ligne.annee})" class="text-red-500 hover:underline text-xs font-semibold ml-2">🗑️</button>
        </td>
      </tr>`;
  }

  function ligneEdition(ligne) {
    const champsHtml = CHAMPS.map(champ => `
      <div>
        <label class="block text-[11px] font-semibold text-slate-600 mb-0.5">${champ.label}</label>
        <input type="${champ.type}" ${champ.step ? `step="${champ.step}"` : ''} id="bareme-ir-input-${champ.id}"
               value="${ligne[champ.id] !== null && ligne[champ.id] !== undefined ? ligne[champ.id] : ''}"
               class="w-full text-xs border border-blue-300 rounded-lg p-2 bg-blue-50 focus:bg-white">
      </div>`).join('');

    return `
      <tr>
        <td colspan="10" class="p-4 bg-blue-50/60 border border-blue-200 rounded-xl">
          <h4 class="text-xs font-bold uppercase tracking-wider text-blue-700 mb-3">Barème IR ${ligne.annee}</h4>
          <div class="grid grid-cols-2 md:grid-cols-4 gap-3">${champsHtml}</div>
          <div class="mt-3 flex gap-2">
            <button onclick="enregistrerLigneBaremeIR(${ligne.annee})" class="bg-blue-600 text-white text-xs font-bold px-4 py-2 rounded-lg hover:bg-blue-700">💾 Enregistrer</button>
            <button onclick="annulerEditionBaremeIR()" class="bg-slate-200 text-slate-700 text-xs font-bold px-4 py-2 rounded-lg hover:bg-slate-300">Annuler</button>
          </div>
        </td>
      </tr>`;
  }

  async function renderBaremeIRUI() {
    const container = obtenirConteneur();
    if (!container) return;

    const lignes = await chargerLignesBareme(false);
    const anneeEdition = window.anneeBaremeIREnEdition;

    const corpsTableau = lignes.map(ligne => {
      if (parseInt(ligne.annee, 10) === parseInt(anneeEdition, 10)) return ligneEdition(ligne);
      return ligneAffichage(ligne);
    }).join('');

    container.innerHTML = `
      <div class="space-y-4 max-w-7xl mx-auto p-4 font-sans text-slate-800">
        <div class="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex flex-wrap justify-between items-center gap-4">
          <div>
            <h2 class="text-xl font-bold text-slate-800 flex items-center gap-2">⚙️ Barème IR (par année)</h2>
            <p class="text-xs text-slate-500 mt-1">Tranches et taux du barème progressif, abattement Micro-BNC et taux du Versement Libératoire. "Année" = année des revenus (le barème "2025" s'applique aux revenus 2025, déclarés en 2026). Modifiable chaque année, sans intervention technique.</p>
          </div>
          <button onclick="ajouterAnneeBaremeIR()" class="bg-emerald-600 text-white text-xs font-bold px-4 py-2 rounded-lg hover:bg-emerald-700">➕ Ajouter une année</button>
        </div>

        <div class="bg-amber-50 border border-amber-300 text-amber-900 text-xs p-3 rounded-lg">
          ⚠️ Les tranches de l'IR sont revalorisées chaque année pour l'inflation par la loi de finances (généralement votée fin d'année pour les revenus de l'année écoulée). Le barème d'une année à venir n'est donc connu qu'une fois cette loi votée — les valeurs affichées pour une année non encore publiée sont une estimation provisoire (barème de l'année précédente repris), à corriger ici dès publication officielle.
        </div>

        <div class="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
          <div class="overflow-x-auto">
            <table class="w-full text-xs text-left border-collapse">
              <thead>
                <tr class="bg-slate-100 text-slate-700 font-bold border-b">
                  <th class="py-2 px-3">Année (revenus)</th>
                  <th class="py-2 px-3 text-right">Tranche 1</th>
                  <th class="py-2 px-3 text-right">Tranche 2</th>
                  <th class="py-2 px-3 text-right">Tranche 3</th>
                  <th class="py-2 px-3 text-right">Tranche 4</th>
                  <th class="py-2 px-3 text-right">Tranche 5</th>
                  <th class="py-2 px-3 text-right">Abatt. Micro-BNC</th>
                  <th class="py-2 px-3 text-right">Vers. Libératoire</th>
                  <th class="py-2 px-3">Notes</th>
                  <th class="py-2 px-3"></th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                ${corpsTableau}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  window.initBaremeIRModule = function () {
    renderBaremeIRUI();
  };
})();
