/**
 * urssaf.js - Module URSSAF complet avec injection automatique du modèle HTML et filtre par année
 */

// Variable globale pour stocker l'année sélectionnée
window.anneeUrssafSelectionnee = new Date().getFullYear();

// 1. Helper pour extraire de façon sécurisée le montant numérique d'une transaction
function getMontantTransaction(tx) {
  const val = tx.amount ?? tx.montant ?? tx.credit ?? 0;
  if (typeof val === 'string') {
    const cleaned = val.replace(',', '.').replace(/[^0-9.-]/g, '');
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
  }
  return typeof val === 'number' && !isNaN(val) ? val : 0;
}

// 2. Helper pour vérifier si une transaction est une recette
function isTransactionRecette(tx) {
  const typeStr = (tx.type || '').toLowerCase();
  const catStr = (tx.category || tx.categorie || '').toLowerCase();
  return typeStr === 'recette' || 
         typeStr === 'credit' || 
         catStr.includes('soins') || 
         catStr.includes('honoraires');
}

// 3. Helper pour formater les montants en Euros (€)
function formatEuro(valeur) {
  return Number(valeur || 0).toLocaleString('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

/**
 * Moteur de calcul des bases et cotisations URSSAF
 */
function calculerUrssaf(transactions = [], anneeFiltre = window.anneeUrssafSelectionnee) {
  const basesTrimestrielles = [0, 0, 0, 0];
  let totalRecettesAnnuelles = 0;

  transactions.forEach(tx => {
    if (isTransactionRecette(tx)) {
      const montant = getMontantTransaction(tx);
      const dateTx = new Date(tx.date);
      
      if (!isNaN(dateTx.getTime())) {
        const anneeTx = dateTx.getFullYear();

        // Filtrage strict par année
        if (anneeTx === parseInt(anneeFiltre, 10)) {
          const mois = dateTx.getMonth(); // 0 à 11
          const trimestreIndex = Math.floor(mois / 3);

          if (trimestreIndex >= 0 && trimestreIndex < 4) {
            basesTrimestrielles[trimestreIndex] += montant;
            totalRecettesAnnuelles += montant;
          }
        }
      }
    }
  });

  const acomptesTrimestriels = basesTrimestrielles.map(base => {
    return base > 0 ? +(base * 0.15).toFixed(2) : 15.00;
  });

  const maladie = +(totalRecettesAnnuelles * 0.001).toFixed(2);
  const allocFamiliales = 0.00;
  const csgCrds = 0.00;
  const cfp = 60.00;
  const totalCotisations = maladie + allocFamiliales + csgCrds + cfp;
  const totalAcomptes = acomptesTrimestriels.reduce((a, b) => a + b, 0);

  return {
    basesTrimestrielles,
    totalRecettesAnnuelles,
    acomptesTrimestriels,
    totalAcomptes,
    cotisations: {
      maladie,
      allocFamiliales,
      csgCrds,
      cfp,
      total: totalCotisations
    }
  };
}

/**
 * Extrait la liste complète des années disponibles à partir des transactions
 */
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

/**
 * Changement manuel de l'année
 */
function changerAnneeUrssaf(nouvelleAnnee) {
  window.anneeUrssafSelectionnee = parseInt(nouvelleAnnee, 10);
  if (window.transactionsUrssafCache) {
    renderUrssafUI(window.transactionsUrssafCache);
  }
}

/**
 * Génère et injecte le composant HTML complet dans la page
 */
function renderUrssafUI(transactions = []) {
  window.transactionsUrssafCache = transactions;

  const container = document.getElementById('vue-urssaf') || 
                    document.getElementById('urssaf-content') || 
                    document.getElementById('tab-urssaf') || 
                    document.getElementById('urssaf') || 
                    document.querySelector('[data-tab="urssaf"]');

  if (!container) {
    console.error("Conteneur URSSAF introuvable dans le DOM.");
    return;
  }

  const annees = obtenirAnneesDisponibles(transactions);
  const anneeActive = window.anneeUrssafSelectionnee;

  // Filtrer les transactions pour l'inspecteur
  const transactionsFiltrees = transactions.filter(tx => {
    const d = new Date(tx.date);
    return !isNaN(d.getTime()) && d.getFullYear() === parseInt(anneeActive, 10);
  });

  const res = calculerUrssaf(transactions, anneeActive);

  // Construction du template HTML complet
  container.innerHTML = `
    <div class="space-y-6 max-w-5xl mx-auto p-2 font-sans text-slate-800">

      <!-- Barres de contrôle : Sélecteur d'année -->
      <div class="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-wrap justify-between items-center gap-4">
        <h2 class="text-xl font-bold text-slate-800 flex items-center gap-2">
          🏛️ Cotisations & Déclarations URSSAF
        </h2>
        <div class="flex items-center gap-3">
          <label for="select-annee-urssaf" class="text-sm font-semibold text-slate-700">Année d'exercice :</label>
          <select id="select-annee-urssaf" onchange="changerAnneeUrssaf(this.value)" class="form-select bg-slate-50 border border-slate-300 text-slate-900 text-sm rounded-lg font-bold p-2 focus:ring-blue-500 focus:border-blue-500">
            ${annees.map(a => `<option value="${a}" ${a === anneeActive ? 'selected' : ''}>${a}</option>`).join('')}
          </select>
        </div>
      </div>

      <!-- Section 1 : Bases trimestrielles -->
      <div class="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h3 class="text-lg font-bold text-slate-800 mb-4">1. Recettes / Bases trimestrielles réalisées (${anneeActive})</h3>
        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse">
            <thead>
              <tr class="bg-slate-50 border-b border-gray-200 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                <th class="py-3 px-4">Période</th>
                <th class="py-3 px-4 text-right">Base retenue (€)</th>
                <th class="py-3 px-4 text-right">Acompte trimestriel estimé (€)</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100 text-sm">
              <tr>
                <td class="py-3 px-4 font-medium text-gray-700">1er Trimestre (Jan - Mar)</td>
                <td class="py-3 px-4 text-right font-bold text-slate-800">${formatEuro(res.basesTrimestrielles[0])}</td>
                <td class="py-3 px-4 text-right font-bold text-blue-600">${formatEuro(res.acomptesTrimestriels[0])}</td>
              </tr>
              <tr>
                <td class="py-3 px-4 font-medium text-gray-700">2ème Trimestre (Avr - Juin)</td>
                <td class="py-3 px-4 text-right font-bold text-slate-800">${formatEuro(res.basesTrimestrielles[1])}</td>
                <td class="py-3 px-4 text-right font-bold text-blue-600">${formatEuro(res.acomptesTrimestriels[1])}</td>
              </tr>
              <tr>
                <td class="py-3 px-4 font-medium text-gray-700">3ème Trimestre (Juil - Sept)</td>
                <td class="py-3 px-4 text-right font-bold text-slate-800">${formatEuro(res.basesTrimestrielles[2])}</td>
                <td class="py-3 px-4 text-right font-bold text-blue-600">${formatEuro(res.acomptesTrimestriels[2])}</td>
              </tr>
              <tr>
                <td class="py-3 px-4 font-medium text-gray-700">4ème Trimestre (Oct - Déc)</td>
                <td class="py-3 px-4 text-right font-bold text-slate-800">${formatEuro(res.basesTrimestrielles[3])}</td>
                <td class="py-3 px-4 text-right font-bold text-blue-600">${formatEuro(res.acomptesTrimestriels[3])}</td>
              </tr>
              <tr class="bg-slate-50 font-bold border-t-2 border-slate-200">
                <td class="py-3 px-4 text-slate-900 uppercase">TOTAL ANNUEL ${anneeActive}</td>
                <td class="py-3 px-4 text-right text-slate-900 text-base">${formatEuro(res.totalRecettesAnnuelles)}</td>
                <td class="py-3 px-4 text-right text-blue-700 text-base">${formatEuro(res.totalAcomptes)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Section 2 : Cotisations dues -->
      <div class="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h3 class="text-lg font-bold text-slate-800 mb-4">2. Détail estimatif des cotisations dues (${anneeActive})</h3>
        <div class="space-y-3 text-sm">
          <div class="flex justify-between py-2 border-b border-gray-100 text-gray-700">
            <span>Assurance Maladie-Maternité :</span>
            <span class="font-bold text-slate-900">${formatEuro(res.cotisations.maladie)}</span>
          </div>
          <div class="flex justify-between py-2 border-b border-gray-100 text-gray-700">
            <span>Allocations Familiales :</span>
            <span class="font-bold text-slate-900">${formatEuro(res.cotisations.allocFamiliales)}</span>
          </div>
          <div class="flex justify-between py-2 border-b border-gray-100 text-gray-700">
            <span>CSG / CRDS :</span>
            <span class="font-bold text-slate-900">${formatEuro(res.cotisations.csgCrds)}</span>
          </div>
          <div class="flex justify-between py-2 border-b border-gray-100 text-gray-700">
            <span>Contribution Formation Professionnelle (CFP) :</span>
            <span class="font-bold text-slate-900">${formatEuro(res.cotisations.cfp)}</span>
          </div>
          <div class="flex justify-between py-3 font-bold text-blue-900 text-base bg-blue-50/50 px-4 rounded-lg mt-2">
            <span>ESTIMATION TOTAL ANNUEL URSSAF ${anneeActive} :</span>
            <span>${formatEuro(res.cotisations.total)}</span>
          </div>
        </div>
      </div>

      <!-- Section 3 : Inspecteur de données Supabase -->
      <div class="bg-slate-50 border border-slate-200 rounded-xl p-4">
        <details class="group">
          <summary class="flex items-center justify-between cursor-pointer font-semibold text-slate-700 text-sm select-none">
            <span class="flex items-center gap-2">
              🔍 Inspecter les données Supabase de l'année ${anneeActive} (${transactionsFiltrees.length} opération(s))
            </span>
            <span class="text-xs text-slate-400 group-open:rotate-180 transition-transform">▼</span>
          </summary>
          <div class="mt-4 overflow-x-auto bg-white rounded-lg border border-slate-200">
            <table class="w-full text-left border-collapse text-xs">
              <thead>
                <tr class="bg-slate-100 border-b border-slate-200 text-slate-600 font-semibold">
                  <th class="py-2 px-3">Date</th>
                  <th class="py-2 px-3">Type / Catégorie</th>
                  <th class="py-2 px-3">Description</th>
                  <th class="py-2 px-3 text-right">Montant</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                ${transactionsFiltrees.length === 0 ? `
                  <tr><td colspan="4" class="text-center py-4 text-gray-500">Aucune transaction trouvée pour l'année ${anneeActive}</td></tr>
                ` : transactionsFiltrees.map(tx => {
                  const m = getMontantTransaction(tx);
                  const isRec = isTransactionRecette(tx);
                  const d = tx.date ? new Date(tx.date).toLocaleDateString('fr-FR') : '-';
                  return `
                    <tr class="${isRec ? 'bg-blue-50/30' : ''}">
                      <td class="py-2 px-3 text-slate-600">${d}</td>
                      <td class="py-2 px-3 text-slate-600">${tx.type || '-'} / ${tx.category || tx.categorie || '-'}</td>
                      <td class="py-2 px-3 text-slate-600">${tx.description || tx.libelle || '-'}</td>
                      <td class="py-2 px-3 text-right font-semibold ${isRec ? 'text-blue-700' : 'text-slate-900'}">
                        ${formatEuro(m)}
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </details>
      </div>
    </div>
  `;
}

/**
 * Point d'entrée pour l'initialisation du module URSSAF
 */
async function initUrssafModule() {
  try {
    let transactions = [];
    
    // 1. Charger depuis Supabase si disponible
    if (window.supabaseClient) {
      const { data, error } = await window.supabaseClient
        .from('transactions')
        .select('*')
        .order('date', { ascending: true });

      if (!error && data) {
        transactions = data;
      }
    }

    // 2. Fallback sur les variables globales ou le localStorage
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

    // 3. Injecter l'IHM et afficher les chiffres calculés
    renderUrssafUI(transactions);
  } catch (err) {
    console.error("Erreur lors du chargement du module URSSAF :", err);
  }
}

// 4. Aliases de compatibilité et exposition globale
window.initUrssafModule = initUrssafModule;
window.afficherDeclarationURSSAF = initUrssafModule;
window.renderUrssafUI = renderUrssafUI;
window.calculerUrssaf = calculerUrssaf;
window.changerAnneeUrssaf = changerAnneeUrssaf;

// Exécution automatique au chargement
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initUrssafModule);
} else {
  initUrssafModule();
}
