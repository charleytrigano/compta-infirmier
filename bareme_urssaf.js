/**
 * bareme_urssaf.js - Barème URSSAF modifiable, année par année.
 *
 * Remplace les plafonds/taux "en dur" qui étaient auparavant codés dans
 * urssaf.js par une vraie table Supabase (`bareme_urssaf`), partagée entre
 * tous les infirmiers (comme le plan comptable) puisque ce sont des taux
 * officiels, pas une donnée personnelle.
 *
 * Cet écran permet de consulter et modifier, pour chaque année : le plafond
 * Tranche A, le plafond Tranche B, les taux Maladie de Tranche A / B / C
 * (C = au-delà de la Tranche B), le taux Maladie non-conventionné, les taux
 * CSG/CRDS, le taux plafond des Allocations Familiales et le montant annuel
 * de la Contribution Formation Professionnelle (CFP).
 *
 * window.obtenirBaremeUrssaf(annee) est exposé pour que urssaf.js (et tout
 * autre module) puisse récupérer le barème d'une année sans dupliquer la
 * logique d'accès à Supabase.
 */

(function () {
  // Valeurs de secours si la table est vide ou injoignable (mode hors-ligne).
  var BAREME_PAR_DEFAUT = {
    annee: new Date().getFullYear(),
    pass: 48060,
    plafond_tranche_a: 48060,
    taux_maladie_tranche_a: 0.10,
    plafond_tranche_b: 192240,
    taux_maladie_tranche_b: 0.10,
    taux_maladie_tranche_c: 0.10,
    taux_maladie_non_conventionne: 8.50,
    taux_csg_deductible: 6.80,
    taux_csg_non_deductible: 2.40,
    taux_crds: 0.50,
    taux_alloc_fam_max: 3.10,
    cfp_montant_annuel: 137.00,
    notes: 'Valeur de secours (table bareme_urssaf injoignable).'
  };

  var CHAMPS = [
    { id: 'pass', label: 'PASS de l\'année (€)', type: 'number', step: '1' },
    { id: 'plafond_tranche_a', label: 'Plafond Tranche A (€)', type: 'number', step: '1' },
    { id: 'taux_maladie_tranche_a', label: 'Taux Maladie Tranche A (%)', type: 'number', step: '0.01' },
    { id: 'plafond_tranche_b', label: 'Plafond Tranche B (€)', type: 'number', step: '1' },
    { id: 'taux_maladie_tranche_b', label: 'Taux Maladie Tranche B (%)', type: 'number', step: '0.01' },
    { id: 'taux_maladie_tranche_c', label: 'Taux Maladie Tranche C — au-delà de B (%)', type: 'number', step: '0.01' },
    { id: 'taux_maladie_non_conventionne', label: 'Taux Maladie non-conventionné (%)', type: 'number', step: '0.01' },
    { id: 'taux_csg_deductible', label: 'Taux CSG déductible (%)', type: 'number', step: '0.01' },
    { id: 'taux_csg_non_deductible', label: 'Taux CSG non-déductible (%)', type: 'number', step: '0.01' },
    { id: 'taux_crds', label: 'Taux CRDS (%)', type: 'number', step: '0.01' },
    { id: 'taux_alloc_fam_max', label: 'Taux plafond Allocations Familiales (%)', type: 'number', step: '0.01' },
    { id: 'cfp_montant_annuel', label: 'CFP - Formation Professionnelle (€ / an)', type: 'number', step: '0.01' },
    { id: 'notes', label: 'Notes (facultatif)', type: 'text', step: null }
  ];

  window.baremeUrssafCache = window.baremeUrssafCache || null; // tableau des lignes, trié par année décroissante
  window.anneeBaremeEnEdition = window.anneeBaremeEnEdition || null;

  function formatEuro(valeur) {
    return Number(valeur || 0).toLocaleString('fr-FR', {
      style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2
    });
  }
  function formatPct(valeur) {
    return Number(valeur || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' %';
  }

  function obtenirConteneur() {
    return document.getElementById('bareme-urssaf-container');
  }

  async function chargerLignesBareme(forcerRechargement) {
    if (window.baremeUrssafCache && !forcerRechargement) return window.baremeUrssafCache;
    if (!window.supabaseClient) {
      window.baremeUrssafCache = [BAREME_PAR_DEFAUT];
      return window.baremeUrssafCache;
    }
    try {
      const { data, error } = await window.supabaseClient
        .from('bareme_urssaf')
        .select('*')
        .order('annee', { ascending: false });
      if (error) throw error;
      window.baremeUrssafCache = (data && data.length > 0) ? data : [BAREME_PAR_DEFAUT];
    } catch (e) {
      console.error('❌ Impossible de charger le barème URSSAF :', e.message);
      window.baremeUrssafCache = [BAREME_PAR_DEFAUT];
    }
    return window.baremeUrssafCache;
  }

  // Exposé pour les autres modules (urssaf.js) : renvoie le barème de l'année
  // demandée, ou à défaut celui de l'année connue la plus proche en dessous,
  // ou à défaut la valeur de secours.
  window.obtenirBaremeUrssaf = async function (annee) {
    const lignes = await chargerLignesBareme(false);
    const exact = lignes.find(l => parseInt(l.annee, 10) === parseInt(annee, 10));
    if (exact) return exact;
    const anterieures = lignes.filter(l => parseInt(l.annee, 10) <= parseInt(annee, 10));
    if (anterieures.length > 0) return anterieures[0];
    return lignes[0] || BAREME_PAR_DEFAUT;
  };

  window.modifierLigneBareme = function (annee) {
    window.anneeBaremeEnEdition = annee;
    renderBaremeUrssafUI();
  };

  window.annulerEditionBareme = function () {
    window.anneeBaremeEnEdition = null;
    renderBaremeUrssafUI();
  };

  window.ajouterAnneeBareme = function () {
    const lignes = window.baremeUrssafCache || [];
    const derniereAnnee = lignes.length > 0 ? Math.max(...lignes.map(l => parseInt(l.annee, 10))) : (new Date().getFullYear() - 1);
    const nouvelleAnnee = derniereAnnee + 1;
    if (lignes.some(l => parseInt(l.annee, 10) === nouvelleAnnee)) {
      alert(`L'année ${nouvelleAnnee} existe déjà dans le barème.`);
      return;
    }
    const modele = lignes[0] || BAREME_PAR_DEFAUT;
    const nouvelleLigne = Object.assign({}, modele, { annee: nouvelleAnnee, notes: 'Nouvelle année : à vérifier et compléter.' });
    window.baremeUrssafCache = [nouvelleLigne].concat(lignes);
    window.anneeBaremeEnEdition = nouvelleAnnee;
    renderBaremeUrssafUI();
  };

  window.enregistrerLigneBareme = async function (annee) {
    if (!window.supabaseClient) {
      alert('Connexion à Supabase indisponible : impossible d\'enregistrer.');
      return;
    }
    const ligne = { annee: parseInt(annee, 10) };
    for (const champ of CHAMPS) {
      const el = document.getElementById('bareme-input-' + champ.id);
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
        .from('bareme_urssaf')
        .upsert(ligne, { onConflict: 'annee' });
      if (error) throw error;
      window.anneeBaremeEnEdition = null;
      await chargerLignesBareme(true);
      renderBaremeUrssafUI();
      alert(`✅ Barème ${annee} enregistré.`);
    } catch (e) {
      alert('❌ Échec de l\'enregistrement : ' + e.message);
    }
  };

  window.supprimerLigneBareme = async function (annee) {
    if (!confirm(`Supprimer le barème de l'année ${annee} ? Cette action est irréversible.`)) return;
    if (!window.supabaseClient) return;
    try {
      const { error } = await window.supabaseClient.from('bareme_urssaf').delete().eq('annee', annee);
      if (error) throw error;
      await chargerLignesBareme(true);
      renderBaremeUrssafUI();
    } catch (e) {
      alert('❌ Échec de la suppression : ' + e.message);
    }
  };

  function ligneAffichage(ligne) {
    return `
      <tr class="border-b divide-x divide-slate-100">
        <td class="py-2 px-3 font-bold text-slate-800">${ligne.annee}</td>
        <td class="py-2 px-3 text-right">${formatEuro(ligne.pass)}</td>
        <td class="py-2 px-3 text-right">${formatEuro(ligne.plafond_tranche_a)}<br><span class="text-[10px] text-slate-500">${formatPct(ligne.taux_maladie_tranche_a)}</span></td>
        <td class="py-2 px-3 text-right">${formatEuro(ligne.plafond_tranche_b)}<br><span class="text-[10px] text-slate-500">${formatPct(ligne.taux_maladie_tranche_b)}</span></td>
        <td class="py-2 px-3 text-right"><span class="text-[10px] text-slate-500">au-delà :</span> ${formatPct(ligne.taux_maladie_tranche_c)}</td>
        <td class="py-2 px-3 text-right">${formatPct(ligne.taux_maladie_non_conventionne)}</td>
        <td class="py-2 px-3 text-right">${formatPct(ligne.taux_csg_deductible)} / ${formatPct(ligne.taux_csg_non_deductible)} / ${formatPct(ligne.taux_crds)}</td>
        <td class="py-2 px-3 text-right">${formatPct(ligne.taux_alloc_fam_max)}</td>
        <td class="py-2 px-3 text-right">${formatEuro(ligne.cfp_montant_annuel)}</td>
        <td class="py-2 px-3 text-slate-500 italic text-[11px] max-w-xs">${ligne.notes || ''}</td>
        <td class="py-2 px-3 text-right whitespace-nowrap">
          <button onclick="modifierLigneBareme(${ligne.annee})" class="text-blue-600 hover:underline text-xs font-semibold">✏️ Modifier</button>
          <button onclick="supprimerLigneBareme(${ligne.annee})" class="text-red-500 hover:underline text-xs font-semibold ml-2">🗑️</button>
        </td>
      </tr>`;
  }

  function ligneEdition(ligne) {
    const champsHtml = CHAMPS.map(champ => `
      <div>
        <label class="block text-[11px] font-semibold text-slate-600 mb-0.5">${champ.label}</label>
        <input type="${champ.type}" ${champ.step ? `step="${champ.step}"` : ''} id="bareme-input-${champ.id}"
               value="${ligne[champ.id] !== null && ligne[champ.id] !== undefined ? ligne[champ.id] : ''}"
               class="w-full text-xs border border-blue-300 rounded-lg p-2 bg-blue-50 focus:bg-white">
      </div>`).join('');

    return `
      <tr>
        <td colspan="11" class="p-4 bg-blue-50/60 border border-blue-200 rounded-xl">
          <h4 class="text-xs font-bold uppercase tracking-wider text-blue-700 mb-3">Barème ${ligne.annee}</h4>
          <div class="grid grid-cols-2 md:grid-cols-4 gap-3">${champsHtml}</div>
          <div class="mt-3 flex gap-2">
            <button onclick="enregistrerLigneBareme(${ligne.annee})" class="bg-blue-600 text-white text-xs font-bold px-4 py-2 rounded-lg hover:bg-blue-700">💾 Enregistrer</button>
            <button onclick="annulerEditionBareme()" class="bg-slate-200 text-slate-700 text-xs font-bold px-4 py-2 rounded-lg hover:bg-slate-300">Annuler</button>
          </div>
        </td>
      </tr>`;
  }

  async function renderBaremeUrssafUI() {
    const container = obtenirConteneur();
    if (!container) return;

    const lignes = await chargerLignesBareme(false);
    const anneeEdition = window.anneeBaremeEnEdition;

    const corpsTableau = lignes.map(ligne => {
      if (parseInt(ligne.annee, 10) === parseInt(anneeEdition, 10)) return ligneEdition(ligne);
      return ligneAffichage(ligne);
    }).join('');

    container.innerHTML = `
      <div class="space-y-4 max-w-7xl mx-auto p-4 font-sans text-slate-800">
        <div class="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex flex-wrap justify-between items-center gap-4">
          <div>
            <h2 class="text-xl font-bold text-slate-800 flex items-center gap-2">⚙️ Barème URSSAF (par année)</h2>
            <p class="text-xs text-slate-500 mt-1">Plafonds Tranche A / B, taux Maladie (A, B et au-delà = Tranche C), CSG-CRDS, Allocations Familiales et CFP. Modifiable chaque année, sans intervention technique.</p>
          </div>
          <button onclick="ajouterAnneeBareme()" class="bg-emerald-600 text-white text-xs font-bold px-4 py-2 rounded-lg hover:bg-emerald-700">➕ Ajouter une année</button>
        </div>

        <div class="bg-amber-50 border border-amber-300 text-amber-900 text-xs p-3 rounded-lg">
          ⚠️ La réforme URSSAF 2026 change en profondeur le calcul (nouvelle assiette unique, taux Maladie potentiellement ramené à un taux plat pour les conventionnés). Les valeurs affichées ici pour 2026 sont une estimation de départ — vérifiez-les avec votre avis URSSAF officiel ou votre expert-comptable avant de vous en servir pour vos paiements, puis corrigez-les directement ici si besoin.
        </div>

        <div class="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
          <div class="overflow-x-auto">
            <table class="w-full text-xs text-left border-collapse">
              <thead>
                <tr class="bg-slate-100 text-slate-700 font-bold border-b">
                  <th class="py-2 px-3">Année</th>
                  <th class="py-2 px-3 text-right">PASS</th>
                  <th class="py-2 px-3 text-right">Tranche A (plafond / taux)</th>
                  <th class="py-2 px-3 text-right">Tranche B (plafond / taux)</th>
                  <th class="py-2 px-3 text-right">Tranche C (taux)</th>
                  <th class="py-2 px-3 text-right">Non-conv.</th>
                  <th class="py-2 px-3 text-right">CSG déd. / non-déd. / CRDS</th>
                  <th class="py-2 px-3 text-right">Alloc. Fam. (max)</th>
                  <th class="py-2 px-3 text-right">CFP</th>
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

  window.initBaremeUrssafModule = function () {
    renderBaremeUrssafUI();
  };
})();
