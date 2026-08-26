/**
 * statistiques.js - Statistiques graphiques par poste (recettes / dépenses) +
 * prévisionnel de revenu net moyen, avant et après impôt sur le revenu.
 *
 * Données 100% réelles issues de `ecritures_comptables` (mêmes comptes 6xxx /
 * 7xxx que le Grand Livre / la Balance / la 2035). Le BNC (recettes - dépenses)
 * est déjà net des cotisations sociales obligatoires (URSSAF, CARPIMKO), qui
 * sont elles-mêmes des dépenses professionnelles déductibles enregistrées en
 * comptabilité : "revenu net avant impôts" = ce BNC ; "revenu net après
 * impôts" = ce BNC moins l'Impôt sur le Revenu estimé (barème IR modifiable,
 * voir bareme_ir.js / window.calculerIR dans ir.js), pour la situation
 * familiale indiquée ci-dessous (par défaut : célibataire, 0 enfant).
 *
 * Si l'année affichée est l'année civile en cours et incomplète, les totaux
 * sont projetés en "année pleine" au prorata des mois déjà enregistrés (voir
 * bandeau "Prévisionnel").
 */

(function () {
  window.anneeStatsSelectionnee = window.anneeStatsSelectionnee || new Date().getFullYear();

  // Palette catégorielle validée (accessible daltonisme), ordre fixe.
  const PALETTE = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948'];
  const MOIS_LABEL = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];

  function formatEuro(valeur) {
    return Number(valeur || 0).toLocaleString('fr-FR', {
      style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0
    });
  }
  function esc(s) {
    return window.escapeHtml ? window.escapeHtml(String(s == null ? '' : s)) : String(s == null ? '' : s);
  }

  function extraireAnnee(dateVal) {
    if (!dateVal) return null;
    const d = new Date(dateVal);
    return isNaN(d.getTime()) ? null : d.getFullYear();
  }
  function extraireMois(dateVal) {
    if (!dateVal) return null;
    const d = new Date(dateVal);
    return isNaN(d.getTime()) ? null : d.getMonth() + 1; // 1 = janvier
  }

  function obtenirConteneur() {
    return document.getElementById('stats-container');
  }

  // --- Graphique en barres horizontales : répartition par poste ---
  function graphiqueBarresPoste(postes, labelSansDonnees) {
    if (!postes || postes.length === 0) {
      return `<p class="text-xs text-slate-400 italic py-6 text-center">${esc(labelSansDonnees)}</p>`;
    }
    const maxVal = Math.max(1, ...postes.map(p => p.total));
    const barH = 24, gapY = 12, leftW = 200, chartW = 380, rightPad = 90, topPad = 6;
    const svgW = leftW + chartW + rightPad;
    const svgH = topPad * 2 + postes.length * (barH + gapY);

    const bars = postes.map((p, i) => {
      const y = topPad + i * (barH + gapY);
      const w = Math.max(3, (p.total / maxVal) * chartW);
      const color = PALETTE[i % PALETTE.length];
      return `
        <text x="${leftW - 10}" y="${y + barH / 2 + 4}" text-anchor="end" font-size="11" fill="#52514e">${esc(p.libelle)}</text>
        <rect x="${leftW}" y="${y}" width="${w}" height="${barH}" rx="4" fill="${color}">
          <title>${esc(p.libelle)} : ${formatEuro(p.total)}</title>
        </rect>
        <text x="${leftW + w + 8}" y="${y + barH / 2 + 4}" font-size="11" font-weight="700" fill="#0b0b0b">${formatEuro(p.total)}</text>
      `;
    }).join('');

    return `<svg viewBox="0 0 ${svgW} ${svgH}" width="100%" height="${svgH}" role="img" aria-label="Répartition par poste">${bars}</svg>`;
  }

  // Regroupe les postes au-delà des 7 premiers dans "Autres", pour garder
  // une palette catégorielle lisible (8 couleurs max, ordre fixe).
  function limiterEtRegrouperPostes(map) {
    const liste = Object.values(map).sort((a, b) => b.total - a.total);
    if (liste.length <= 8) return liste;
    const tete = liste.slice(0, 7);
    const resteTotal = liste.slice(7).reduce((s, p) => s + p.total, 0);
    tete.push({ libelle: `Autres (${liste.length - 7} postes)`, total: resteTotal });
    return tete;
  }

  // --- Graphique en barres groupées : évolution mensuelle recettes/dépenses ---
  function graphiqueEvolutionMensuelle(recettesParMois, depensesParMois, dernierMoisReel) {
    const maxVal = Math.max(1, ...recettesParMois, ...depensesParMois);
    const chartH = 180, axisPad = 8, colW = 44, barW = 16, baseY = chartH + 20;
    const svgW = 20 + 12 * colW;
    const svgH = baseY + 22;

    let gridlines = '';
    for (let g = 1; g <= 3; g++) {
      const y = axisPad + (chartH - axisPad) * (1 - g / 4);
      gridlines += `<line x1="14" y1="${y}" x2="${svgW - 6}" y2="${y}" stroke="#e1e0d9" stroke-width="1" />`;
    }

    let bars = '';
    recettesParMois.forEach((rec, i) => {
      const dep = depensesParMois[i];
      const estProjete = dernierMoisReel !== null && (i + 1) > dernierMoisReel;
      if (estProjete) return; // pas de données réelles au-delà du dernier mois enregistré : rien à tracer
      const x = 20 + i * colW;
      const hRec = (rec / maxVal) * (chartH - axisPad);
      const hDep = (dep / maxVal) * (chartH - axisPad);
      bars += `
        <rect x="${x}" y="${baseY - hRec}" width="${barW / 2 - 1}" height="${Math.max(0, hRec)}" fill="${PALETTE[0]}" rx="2">
          <title>${MOIS_LABEL[i]} — Recettes : ${formatEuro(rec)}</title>
        </rect>
        <rect x="${x + barW / 2 + 1}" y="${baseY - hDep}" width="${barW / 2 - 1}" height="${Math.max(0, hDep)}" fill="${PALETTE[1]}" rx="2">
          <title>${MOIS_LABEL[i]} — Dépenses : ${formatEuro(dep)}</title>
        </rect>
        <text x="${x + barW / 2}" y="${baseY + 14}" text-anchor="middle" font-size="9" fill="#898781">${MOIS_LABEL[i]}</text>
      `;
    });

    return `
      <div class="flex items-center gap-4 mb-2 text-[11px] text-slate-600">
        <span class="flex items-center gap-1.5"><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${PALETTE[0]}"></span>Recettes</span>
        <span class="flex items-center gap-1.5"><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${PALETTE[1]}"></span>Dépenses</span>
      </div>
      <svg viewBox="0 0 ${svgW} ${svgH}" width="100%" height="${svgH + 10}" role="img" aria-label="Évolution mensuelle recettes et dépenses">
        <line x1="14" y1="${baseY}" x2="${svgW - 6}" y2="${baseY}" stroke="#c3c2b7" stroke-width="1" />
        ${gridlines}
        ${bars}
      </svg>
    `;
  }

  async function chargerEtCalculer(anneeActive) {
    const supabase = window.supabaseClient;
    if (!supabase) return null;

    const { data: ecritures } = await supabase.from('ecritures_comptables').select('*');
    const toutes = ecritures || [];

    const anneesDispo = Array.from(new Set([new Date().getFullYear(), ...toutes.map(e => extraireAnnee(e.date)).filter(Boolean)])).sort((a, b) => b - a);

    const ecrituresAnnee = toutes.filter(e => extraireAnnee(e.date) === parseInt(anneeActive, 10));

    const recettesParMois = new Array(12).fill(0);
    const depensesParMois = new Array(12).fill(0);
    const posteRecettesMap = {};
    const posteDepensesMap = {};
    let dernierMois = 0;

    ecrituresAnnee.forEach(e => {
      const code = String(e.compte_code || '').trim();
      const mois = extraireMois(e.date);
      const debit = parseFloat(e.debit || 0) || 0;
      const credit = parseFloat(e.credit || 0) || 0;
      if (mois && mois > dernierMois) dernierMois = mois;
      const libelle = e.compte_libelle || e.description || `Compte ${code || '?'}`;

      if (code.startsWith('7')) {
        const montant = credit - debit;
        if (mois) recettesParMois[mois - 1] += montant;
        if (!posteRecettesMap[code]) posteRecettesMap[code] = { libelle, total: 0 };
        posteRecettesMap[code].total += montant;
      } else if (code.startsWith('6')) {
        const montant = debit - credit;
        if (mois) depensesParMois[mois - 1] += montant;
        if (!posteDepensesMap[code]) posteDepensesMap[code] = { libelle, total: 0 };
        posteDepensesMap[code].total += montant;
      }
    });

    const anneeEstCourante = parseInt(anneeActive, 10) === new Date().getFullYear();
    const inclureProjection = anneeEstCourante && dernierMois > 0 && dernierMois < 12;
    const moisBase = anneeEstCourante ? Math.max(1, dernierMois) : 12;
    const facteurProjection = inclureProjection ? 12 / moisBase : 1;

    const recettesTotalReel = recettesParMois.reduce((s, v) => s + v, 0);
    const depensesTotalReel = depensesParMois.reduce((s, v) => s + v, 0);
    const recettesProjetees = recettesTotalReel * facteurProjection;
    const depensesProjetees = depensesTotalReel * facteurProjection;
    const bncProjete = recettesProjetees - depensesProjetees;

    return {
      anneesDispo, ecrituresAnnee, recettesParMois, depensesParMois,
      posteRecettes: limiterEtRegrouperPostes(posteRecettesMap),
      posteDepenses: limiterEtRegrouperPostes(posteDepensesMap),
      dernierMois: dernierMois || null,
      inclureProjection, moisBase,
      recettesTotalReel, depensesTotalReel, recettesProjetees, depensesProjetees, bncProjete
    };
  }

  window.changerAnneeStats = function (nouvelleAnnee) {
    window.anneeStatsSelectionnee = parseInt(nouvelleAnnee, 10);
    renderStatsUI();
  };

  window.actualiserRevenuNetStats = async function () {
    const calc = window.statsCalculActif;
    if (!calc) return;

    const situation = document.getElementById('stats-select-situation')?.value || 'celibataire';
    const enfants = parseInt(document.getElementById('stats-input-enfants')?.value) || 0;

    const bareme = window.obtenirBaremeIR
      ? await window.obtenirBaremeIR(window.anneeStatsSelectionnee)
      : { plafond_tranche1: 11600, taux_tranche1: 0, plafond_tranche2: 29579, taux_tranche2: 11, plafond_tranche3: 84577, taux_tranche3: 30, plafond_tranche4: 181917, taux_tranche4: 41, taux_tranche5: 45 };

    const bncPourIR = Math.max(0, calc.bncProjete);
    const resIR = window.calculerIR ? window.calculerIR(bncPourIR, situation, enfants, 'reel', 0, bareme) : { impotTotalDu: 0 };
    const irEstime = resIR.impotTotalDu || 0;

    const revenuAvant = calc.bncProjete;
    const revenuApres = calc.bncProjete - irEstime;

    const setTxt = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };
    setTxt('stats-tile-avant-mensuel', formatEuro(revenuAvant / 12));
    setTxt('stats-tile-apres-mensuel', formatEuro(revenuApres / 12));
    setTxt('stats-tile-avant-annuel', `${formatEuro(revenuAvant)} / an`);
    setTxt('stats-tile-apres-annuel', `${formatEuro(revenuApres)} / an (dont ${formatEuro(irEstime)} d'IR estimé)`);
  };

  async function renderStatsUI() {
    const container = obtenirConteneur();
    if (!container) return;

    const anneeActive = window.anneeStatsSelectionnee;
    container.innerHTML = `<p style="color:#64748b;padding:16px;">Chargement des statistiques ${anneeActive}...</p>`;

    if (!window.supabaseClient) {
      container.innerHTML = `<div style="padding:20px;color:#ef4444;text-align:center;">Erreur : Supabase indisponible.</div>`;
      return;
    }

    const calc = await chargerEtCalculer(anneeActive);
    if (!calc) return;
    window.statsCalculActif = calc;

    const annees = calc.anneesDispo.length > 0 ? calc.anneesDispo : [anneeActive];

    container.innerHTML = `
      <div class="space-y-6 max-w-6xl mx-auto p-4 font-sans text-slate-800">

        <div class="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex flex-wrap justify-between items-center gap-4">
          <div>
            <h2 class="text-xl font-bold text-slate-800 flex items-center gap-2">📊 Statistiques & Prévisionnel</h2>
            <p class="text-xs text-slate-500 mt-1">Répartition des recettes et dépenses par poste, évolution mensuelle, et revenu net moyen estimé (avant / après impôt sur le revenu).</p>
          </div>
          <div class="flex items-center gap-2">
            <label for="select-annee-stats" class="text-xs font-semibold text-slate-700">Année :</label>
            <select id="select-annee-stats" onchange="changerAnneeStats(this.value)" class="form-select bg-slate-50 border border-slate-300 text-slate-900 text-xs rounded-lg font-bold p-2 focus:ring-blue-500 focus:border-blue-500">
              ${annees.map(a => `<option value="${a}" ${a === anneeActive ? 'selected' : ''}>${a}</option>`).join('')}
            </select>
          </div>
        </div>

        ${calc.inclureProjection ? `
        <div class="bg-amber-50 border border-amber-300 text-amber-900 text-xs p-3 rounded-lg">
          📈 <strong>Prévisionnel :</strong> ${anneeActive} n'a que ${calc.moisBase} mois de données enregistrées à ce jour. Les totaux ci-dessous (recettes, dépenses, revenu net) sont <strong>projetés sur 12 mois pleins</strong> au même rythme (recettes/dépenses réelles ÷ ${calc.moisBase} × 12), à titre d'estimation — pas les montants réels de fin d'année.
        </div>` : ''}

        <!-- REVENU NET MOYEN -->
        <div class="bg-white p-5 rounded-xl shadow-sm border border-slate-200 space-y-4">
          <div class="flex flex-wrap justify-between items-center gap-3">
            <h3 class="text-xs font-bold uppercase tracking-wider text-blue-700">Revenu Net Moyen Mensuel${calc.inclureProjection ? ' (Prévisionnel)' : ''}</h3>
            <div class="flex items-center gap-3 text-xs">
              <div class="flex items-center gap-1.5">
                <label for="stats-select-situation" class="font-semibold text-slate-600">Situation :</label>
                <select id="stats-select-situation" onchange="actualiserRevenuNetStats()" class="text-xs border border-slate-300 rounded-lg p-1.5 bg-slate-50">
                  <option value="celibataire">Célibataire / Divorcé(e)</option>
                  <option value="marie">Marié(e) / PACS</option>
                  <option value="parent_isole">Parent Isolé</option>
                </select>
              </div>
              <div class="flex items-center gap-1.5">
                <label for="stats-input-enfants" class="font-semibold text-slate-600">Enfants :</label>
                <input type="number" min="0" id="stats-input-enfants" value="0" oninput="actualiserRevenuNetStats()" class="w-14 text-xs border border-slate-300 rounded-lg p-1.5 bg-slate-50">
              </div>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
              <span class="text-xs text-blue-800 uppercase font-bold">Avant Impôt sur le Revenu</span>
              <p id="stats-tile-avant-mensuel" class="text-2xl font-black text-blue-700 mt-1">0 €</p>
              <span id="stats-tile-avant-annuel" class="text-[10px] text-blue-600 font-medium">0 € / an</span>
            </div>
            <div class="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center">
              <span class="text-xs text-emerald-800 uppercase font-bold">Après Impôt sur le Revenu (estimé)</span>
              <p id="stats-tile-apres-mensuel" class="text-2xl font-black text-emerald-700 mt-1">0 €</p>
              <span id="stats-tile-apres-annuel" class="text-[10px] text-emerald-600 font-medium">0 € / an</span>
            </div>
          </div>
          <p class="text-[11px] text-slate-500 italic">
            "Avant impôts" = BNC réel${calc.inclureProjection ? ' (projeté)' : ''} — recettes moins dépenses professionnelles déductibles, cotisations sociales URSSAF/CARPIMKO déjà comprises dans ces dépenses. "Après impôts" y déduit l'Impôt sur le Revenu estimé au barème progressif (régime réel), pour la situation familiale ci-dessus. Barème modifiable dans l'onglet <strong>⚙️ Barème IR</strong>.
          </p>
        </div>

        <!-- REPARTITION PAR POSTE -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div class="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
            <h3 class="text-xs font-bold uppercase tracking-wider text-blue-700 mb-3">Recettes par Poste (${anneeActive})</h3>
            ${graphiqueBarresPoste(calc.posteRecettes, `Aucune recette enregistrée pour ${anneeActive}.`)}
          </div>
          <div class="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
            <h3 class="text-xs font-bold uppercase tracking-wider text-blue-700 mb-3">Dépenses par Poste (${anneeActive})</h3>
            ${graphiqueBarresPoste(calc.posteDepenses, `Aucune dépense enregistrée pour ${anneeActive}.`)}
          </div>
        </div>

        <!-- EVOLUTION MENSUELLE -->
        <div class="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
          <h3 class="text-xs font-bold uppercase tracking-wider text-blue-700 mb-3">Évolution Mensuelle (${anneeActive})</h3>
          ${graphiqueEvolutionMensuelle(calc.recettesParMois, calc.depensesParMois, calc.dernierMois)}
          ${calc.inclureProjection ? `<p class="text-[11px] text-slate-400 italic mt-2">Seuls les mois avec des écritures enregistrées sont affichés (jusqu'à ${MOIS_LABEL[calc.dernierMois - 1]} ${anneeActive}). Les mois suivants ne sont pas encore représentés ici ; voir le bandeau "Prévisionnel" ci-dessus pour l'estimation en année pleine.</p>` : ''}
        </div>

      </div>
    `;

    actualiserRevenuNetStats();
  }

  window.initStatsModule = function () {
    renderStatsUI();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', window.initStatsModule);
  } else {
    window.initStatsModule();
  }
})();
