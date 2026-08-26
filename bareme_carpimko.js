/**
 * bareme_carpimko.js - Barème CARPIMKO modifiable, année par année.
 *
 * Même principe que bareme_urssaf.js : les plafonds/taux du Régime de Base
 * (Tranche 1 / Tranche 2), du Régime Complémentaire et de l'Invalidité-Décès
 * (RID) viennent de la table Supabase `bareme_carpimko`, partagée entre tous
 * les infirmiers, consultable et modifiable depuis cet écran.
 *
 * window.obtenirBaremeCarpimko(annee) est exposé pour que carpimko.js puisse
 * récupérer le barème d'une année sans dupliquer la logique Supabase.
 */

(function () {
  var BAREME_PAR_DEFAUT = {
    annee: new Date().getFullYear(),
    pass: 48060,
    taux_base_tranche1: 8.73,
    plafond_base_tranche1: 48060,
    taux_base_tranche2: 1.87,
    plafond_base_tranche2: 240300,
    forfait_complementaire: 2090.61,
    taux_complementaire: 8.70,
    seuil_complementaire: 24030,
    plafond_excedent_complementaire: 120150,
    rid_montant: 1022.00,
    forfait_debut_activite_pct: 19.00,
    asv_forfait: 224.00,
    asv_taux: 0.40,
    notes: 'Valeur de secours (table bareme_carpimko injoignable).'
  };

  var CHAMPS = [
    { id: 'pass', label: 'PASS de l\'année (€)', type: 'number', step: '1' },
    { id: 'taux_base_tranche1', label: 'Régime de Base - Taux Tranche 1 (%)', type: 'number', step: '0.01' },
    { id: 'plafond_base_tranche1', label: 'Régime de Base - Plafond Tranche 1 (€)', type: 'number', step: '1' },
    { id: 'taux_base_tranche2', label: 'Régime de Base - Taux Tranche 2 (%)', type: 'number', step: '0.01' },
    { id: 'plafond_base_tranche2', label: 'Régime de Base - Plafond Tranche 2 (€)', type: 'number', step: '1' },
    { id: 'forfait_complementaire', label: 'Complémentaire - Forfait (€)', type: 'number', step: '0.01' },
    { id: 'taux_complementaire', label: 'Complémentaire - Taux proportionnel (%)', type: 'number', step: '0.01' },
    { id: 'seuil_complementaire', label: 'Complémentaire - Seuil de déclenchement (€)', type: 'number', step: '1' },
    { id: 'plafond_excedent_complementaire', label: 'Complémentaire - Plafond de l\'excédent soumis au taux (€)', type: 'number', step: '1' },
    { id: 'rid_montant', label: 'RID - Invalidité-Décès (€ / an)', type: 'number', step: '0.01' },
    { id: 'forfait_debut_activite_pct', label: 'Forfait 1ère/2ème année (% du PASS)', type: 'number', step: '0.01' },
    { id: 'asv_forfait', label: 'ASV - Forfait (€, conventionnés)', type: 'number', step: '0.01' },
    { id: 'asv_taux', label: 'ASV - Taux proportionnel (%, conventionnés)', type: 'number', step: '0.01' },
    { id: 'notes', label: 'Notes (facultatif)', type: 'text', step: null }
  ];

  window.baremeCarpimkoCache = window.baremeCarpimkoCache || null;
  window.anneeBaremeCarpimkoEnEdition = window.anneeBaremeCarpimkoEnEdition || null;

  function formatEuro(valeur) {
    return Number(valeur || 0).toLocaleString('fr-FR', {
      style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2
    });
  }
  function formatPct(valeur) {
    return Number(valeur || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' %';
  }

  function obtenirConteneur() {
    return document.getElementById('bareme-carpimko-container');
  }

  async function chargerLignesBareme(forcerRechargement) {
    if (window.baremeCarpimkoCache && !forcerRechargement) return window.baremeCarpimkoCache;
    if (!window.supabaseClient) {
      window.baremeCarpimkoCache = [BAREME_PAR_DEFAUT];
      return window.baremeCarpimkoCache;
    }
    try {
      const { data, error } = await window.supabaseClient
        .from('bareme_carpimko')
        .select('*')
        .order('annee', { ascending: false });
      if (error) throw error;
      window.baremeCarpimkoCache = (data && data.length > 0) ? data : [BAREME_PAR_DEFAUT];
    } catch (e) {
      console.error('❌ Impossible de charger le barème CARPIMKO :', e.message);
      window.baremeCarpimkoCache = [BAREME_PAR_DEFAUT];
    }
    return window.baremeCarpimkoCache;
  }

  window.obtenirBaremeCarpimko = async function (annee) {
    const lignes = await chargerLignesBareme(false);
    const exact = lignes.find(l => parseInt(l.annee, 10) === parseInt(annee, 10));
    if (exact) return exact;
    const anterieures = lignes.filter(l => parseInt(l.annee, 10) <= parseInt(annee, 10));
    if (anterieures.length > 0) return anterieures[0];
    return lignes[0] || BAREME_PAR_DEFAUT;
  };

  window.modifierLigneBaremeCarpimko = function (annee) {
    window.anneeBaremeCarpimkoEnEdition = annee;
    renderBaremeCarpimkoUI();
  };

  window.annulerEditionBaremeCarpimko = function () {
    window.anneeBaremeCarpimkoEnEdition = null;
    renderBaremeCarpimkoUI();
  };

  window.ajouterAnneeBaremeCarpimko = function () {
    const lignes = window.baremeCarpimkoCache || [];
    const derniereAnnee = lignes.length > 0 ? Math.max(...lignes.map(l => parseInt(l.annee, 10))) : (new Date().getFullYear() - 1);
    const nouvelleAnnee = derniereAnnee + 1;
    if (lignes.some(l => parseInt(l.annee, 10) === nouvelleAnnee)) {
      alert(`L'année ${nouvelleAnnee} existe déjà dans le barème.`);
      return;
    }
    const modele = lignes[0] || BAREME_PAR_DEFAUT;
    const nouvelleLigne = Object.assign({}, modele, { annee: nouvelleAnnee, notes: 'Nouvelle année : à vérifier et compléter.' });
    window.baremeCarpimkoCache = [nouvelleLigne].concat(lignes);
    window.anneeBaremeCarpimkoEnEdition = nouvelleAnnee;
    renderBaremeCarpimkoUI();
  };

  window.enregistrerLigneBaremeCarpimko = async function (annee) {
    if (!window.supabaseClient) {
      alert('Connexion à Supabase indisponible : impossible d\'enregistrer.');
      return;
    }
    const ligne = { annee: parseInt(annee, 10) };
    for (const champ of CHAMPS) {
      const el = document.getElementById('bareme-carp-input-' + champ.id);
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
        .from('bareme_carpimko')
        .upsert(ligne, { onConflict: 'annee' });
      if (error) throw error;
      window.anneeBaremeCarpimkoEnEdition = null;
      await chargerLignesBareme(true);
      renderBaremeCarpimkoUI();
      alert(`✅ Barème CARPIMKO ${annee} enregistré.`);
    } catch (e) {
      alert('❌ Échec de l\'enregistrement : ' + e.message);
    }
  };

  window.supprimerLigneBaremeCarpimko = async function (annee) {
    if (!confirm(`Supprimer le barème CARPIMKO de l'année ${annee} ? Cette action est irréversible.`)) return;
    if (!window.supabaseClient) return;
    try {
      const { error } = await window.supabaseClient.from('bareme_carpimko').delete().eq('annee', annee);
      if (error) throw error;
      await chargerLignesBareme(true);
      renderBaremeCarpimkoUI();
    } catch (e) {
      alert('❌ Échec de la suppression : ' + e.message);
    }
  };

  function ligneAffichage(ligne) {
    return `
      <tr class="border-b divide-x divide-slate-100">
        <td class="py-2 px-3 font-bold text-slate-800">${ligne.annee}</td>
        <td class="py-2 px-3 text-right">${formatEuro(ligne.pass)}</td>
        <td class="py-2 px-3 text-right">${formatEuro(ligne.plafond_base_tranche1)}<br><span class="text-[10px] text-slate-500">${formatPct(ligne.taux_base_tranche1)}</span></td>
        <td class="py-2 px-3 text-right">${formatEuro(ligne.plafond_base_tranche2)}<br><span class="text-[10px] text-slate-500">${formatPct(ligne.taux_base_tranche2)}</span></td>
        <td class="py-2 px-3 text-right">${formatEuro(ligne.forfait_complementaire)} + <span class="text-[10px] text-slate-500">${formatPct(ligne.taux_complementaire)} au-delà de ${formatEuro(ligne.seuil_complementaire)} (max ${formatEuro(ligne.plafond_excedent_complementaire)})</span></td>
        <td class="py-2 px-3 text-right">${formatEuro(ligne.rid_montant)}</td>
        <td class="py-2 px-3 text-right">${formatPct(ligne.forfait_debut_activite_pct)}</td>
        <td class="py-2 px-3 text-right">${formatEuro(ligne.asv_forfait)} + <span class="text-[10px] text-slate-500">${formatPct(ligne.asv_taux)}</span></td>
        <td class="py-2 px-3 text-slate-500 italic text-[11px] max-w-xs">${ligne.notes || ''}</td>
        <td class="py-2 px-3 text-right whitespace-nowrap">
          <button onclick="modifierLigneBaremeCarpimko(${ligne.annee})" class="text-blue-600 hover:underline text-xs font-semibold">✏️ Modifier</button>
          <button onclick="supprimerLigneBaremeCarpimko(${ligne.annee})" class="text-red-500 hover:underline text-xs font-semibold ml-2">🗑️</button>
        </td>
      </tr>`;
  }

  function ligneEdition(ligne) {
    const champsHtml = CHAMPS.map(champ => `
      <div>
        <label class="block text-[11px] font-semibold text-slate-600 mb-0.5">${champ.label}</label>
        <input type="${champ.type}" ${champ.step ? `step="${champ.step}"` : ''} id="bareme-carp-input-${champ.id}"
               value="${ligne[champ.id] !== null && ligne[champ.id] !== undefined ? ligne[champ.id] : ''}"
               class="w-full text-xs border border-blue-300 rounded-lg p-2 bg-blue-50 focus:bg-white">
      </div>`).join('');

    return `
      <tr>
        <td colspan="10" class="p-4 bg-blue-50/60 border border-blue-200 rounded-xl">
          <h4 class="text-xs font-bold uppercase tracking-wider text-blue-700 mb-3">Barème CARPIMKO ${ligne.annee}</h4>
          <div class="grid grid-cols-2 md:grid-cols-4 gap-3">${champsHtml}</div>
          <div class="mt-3 flex gap-2">
            <button onclick="enregistrerLigneBaremeCarpimko(${ligne.annee})" class="bg-blue-600 text-white text-xs font-bold px-4 py-2 rounded-lg hover:bg-blue-700">💾 Enregistrer</button>
            <button onclick="annulerEditionBaremeCarpimko()" class="bg-slate-200 text-slate-700 text-xs font-bold px-4 py-2 rounded-lg hover:bg-slate-300">Annuler</button>
          </div>
        </td>
      </tr>`;
  }

  async function renderBaremeCarpimkoUI() {
    const container = obtenirConteneur();
    if (!container) return;

    const lignes = await chargerLignesBareme(false);
    const anneeEdition = window.anneeBaremeCarpimkoEnEdition;

    const corpsTableau = lignes.map(ligne => {
      if (parseInt(ligne.annee, 10) === parseInt(anneeEdition, 10)) return ligneEdition(ligne);
      return ligneAffichage(ligne);
    }).join('');

    container.innerHTML = `
      <div class="space-y-4 max-w-7xl mx-auto p-4 font-sans text-slate-800">
        <div class="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex flex-wrap justify-between items-center gap-4">
          <div>
            <h2 class="text-xl font-bold text-slate-800 flex items-center gap-2">⚙️ Barème CARPIMKO (par année)</h2>
            <p class="text-xs text-slate-500 mt-1">Régime de Base (Tranche 1 / 2), Régime Complémentaire et RID. Modifiable chaque année, sans intervention technique.</p>
          </div>
          <button onclick="ajouterAnneeBaremeCarpimko()" class="bg-emerald-600 text-white text-xs font-bold px-4 py-2 rounded-lg hover:bg-emerald-700">➕ Ajouter une année</button>
        </div>

        <div class="bg-amber-50 border border-amber-300 text-amber-900 text-xs p-3 rounded-lg">
          ⚠️ La réforme CARPIMKO 2026 change le calcul (Tranche 1 relevée à 8,73 %, Régime Complémentaire devenu intégralement proportionnel avec plancher/plafond au lieu d'un forfait fixe, RID relevé à 1 022 €). Les valeurs affichées ici pour 2026 sont une estimation de départ — vérifiez-les avec votre relevé CARPIMKO officiel ou votre expert-comptable avant de vous en servir pour vos paiements, puis corrigez-les directement ici si besoin.
        </div>

        <div class="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
          <div class="overflow-x-auto">
            <table class="w-full text-xs text-left border-collapse">
              <thead>
                <tr class="bg-slate-100 text-slate-700 font-bold border-b">
                  <th class="py-2 px-3">Année</th>
                  <th class="py-2 px-3 text-right">PASS</th>
                  <th class="py-2 px-3 text-right">Base Tranche 1 (plafond / taux)</th>
                  <th class="py-2 px-3 text-right">Base Tranche 2 (plafond / taux)</th>
                  <th class="py-2 px-3 text-right">Complémentaire</th>
                  <th class="py-2 px-3 text-right">RID</th>
                  <th class="py-2 px-3 text-right">Forfait 1ère/2ème année</th>
                  <th class="py-2 px-3 text-right">ASV (Conventionnés)</th>
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

  window.initBaremeCarpimkoModule = function () {
    renderBaremeCarpimkoUI();
  };
})();
