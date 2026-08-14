/**
 * urssaf.js
 * Module complet de gestion, calcul et inspection des cotisations URSSAF
 */

// 1. Helper pour extraire de façon sécurisée le montant numérique d'une transaction
function getMontantTransaction(tx) {
  // Prise en charge prioritaire du champ 'amount' (Supabase), puis 'montant' / 'credit'
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
  const catStr = (tx.category || '').toLowerCase();
  
  return typeStr === 'recette' || 
         typeStr === 'credit' || 
         catStr.includes('soins') || 
         catStr.includes('honoraires');
}

/**
 * Algorithme principal de calcul des cotisations URSSAF et des bases trimestrielles
 * @param {Array} transactions - Liste des transactions (Supabase / local)
 * @param {Object} profile - Profil de l'utilisateur
 */
function calculerUrssaf(transactions = [], profile = {}) {
  // Bases cumulées par trimestre [T1, T2, T3, T4]
  const basesTrimestrielles = [0, 0, 0, 0];
  let totalRecettesAnnuelles = 0;

  // Calcul et répartition par trimestre
  transactions.forEach(tx => {
    if (isTransactionRecette(tx)) {
      const montant = getMontantTransaction(tx);
      const dateTx = new Date(tx.date);
      
      if (!isNaN(dateTx.getTime())) {
        const mois = dateTx.getMonth(); // 0 (Janvier) à 11 (Décembre)
        const trimestreIndex = Math.floor(mois / 3);

        if (trimestreIndex >= 0 && trimestreIndex < 4) {
          basesTrimestrielles[trimestreIndex] += montant;
          totalRecettesAnnuelles += montant;
        }
      }
    }
  });

  // Calcul estimatif des acomptes trimestriels (15% ou forfait minimum)
  const acomptesTrimestriels = basesTrimestrielles.map(base => {
    return base > 0 ? +(base * 0.15).toFixed(2) : 15.00;
  });

  // Cotisations estimées (PAMC / Indépendant)
  const maladie = +(totalRecettesAnnuelles * 0.001).toFixed(2);
  const allocFamiliales = 0.00;
  const csgCrds = 0.00;
  const cfp = 60.00; // Contribution Formation Professionnelle (forfait)

  const totalCotisations = maladie + allocFamiliales + csgCrds + cfp;

  return {
    basesTrimestrielles,
    totalRecettesAnnuelles,
    acomptesTrimestriels,
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
 * Mise à jour globale de l'interface utilisateur (UI)
 */
function renderUrssafUI(transactions = [], profile = {}) {
  const resultats = calculerUrssaf(transactions, profile);

  // 1. Mise à jour du tableau des bases trimestrielles
  resultats.basesTrimestrielles.forEach((base, idx) => {
    const elBase = document.getElementById(`urssaf-base-t${idx + 1}`);
    if (elBase) {
      elBase.textContent = base.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
    }

    const elAcompte = document.getElementById(`urssaf-acompte-t${idx + 1}`);
    if (elAcompte) {
      elAcompte.textContent = resultats.acomptesTrimestriels[idx].toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
    }
  });

  // 2. Totaux annuels
  const elTotalBase = document.getElementById('urssaf-total-base');
  if (elTotalBase) {
    elTotalBase.textContent = resultats.totalRecettesAnnuelles.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
  }

  const elTotalAcompte = document.getElementById('urssaf-total-acompte');
  if (elTotalAcompte) {
    const sumAcomptes = resultats.acomptesTrimestriels.reduce((a, b) => a + b, 0);
    elTotalAcompte.textContent = sumAcomptes.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
  }

  // 3. Détail estimatif des cotisations
  const elMaladie = document.getElementById('urssaf-cot-maladie');
  if (elMaladie) elMaladie.textContent = resultats.cotisations.maladie.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });

  const elAlloc = document.getElementById('urssaf-cot-alloc');
  if (elAlloc) elAlloc.textContent = resultats.cotisations.allocFamiliales.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });

  const elCsg = document.getElementById('urssaf-cot-csg');
  if (elCsg) elCsg.textContent = resultats.cotisations.csgCrds.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });

  const elCfp = document.getElementById('urssaf-cot-cfp');
  if (elCfp) elCfp.textContent = resultats.cotisations.cfp.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });

  const elTotalCotisations = document.getElementById('urssaf-total-estimatif');
  if (elTotalCotisations) elTotalCotisations.textContent = resultats.cotisations.total.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });

  // 4. Rendu de la table d'inspection Supabase
  renderInspectionTable(transactions);
}

/**
 * Génère le tableau d'inspection des données Supabase détectées
 */
function renderInspectionTable(transactions) {
  const container = document.getElementById('urssaf-supabase-inspect-list');
  const countBadge = document.getElementById('urssaf-tx-count');

  if (countBadge) {
    countBadge.textContent = `${transactions.length} opération(s)`;
  }

  if (!container) return;

  if (!transactions || transactions.length === 0) {
    container.innerHTML = `<tr><td colspan="4" class="text-center py-4 text-gray-500">Aucune transaction détectée</td></tr>`;
    return;
  }

  container.innerHTML = transactions.map(tx => {
    const montant = getMontantTransaction(tx);
    const dateFormatted = tx.date ? new Date(tx.date).toLocaleDateString('fr-FR') : '-';
    const isRec = isTransactionRecette(tx);

    return `
      <tr class="${isRec ? 'bg-blue-50/40' : ''}">
        <td class="px-4 py-2 text-sm text-gray-700">${dateFormatted}</td>
        <td class="px-4 py-2 text-sm text-gray-700">${tx.type || '-'} / ${tx.category || '-'}</td>
        <td class="px-4 py-2 text-sm text-gray-700">${tx.description || '-'}</td>
        <td class="px-4 py-2 text-sm font-semibold text-right ${isRec ? 'text-green-600' : 'text-gray-900'}">
          ${montant.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
        </td>
      </tr>
    `;
  }).join('');
}

/**
 * Fonction d'initialisation appelée lors de l'accès à l'onglet URSSAF
 */
async function initUrssafModule() {
  try {
    let transactions = [];
    
    // 1. Chargement depuis Supabase si initialisé
    if (typeof supabase !== 'undefined' && window.supabaseClient) {
      const { data, error } = await window.supabaseClient
        .from('transactions')
        .select('*')
        .order('date', { ascending: true });

      if (!error && data) {
        transactions = data;
      }
    }

    // 2. Fallback sur le state local ou localStorage
    if (transactions.length === 0 && window.state && window.state.transactions) {
      transactions = window.state.transactions;
    } else if (transactions.length === 0) {
      const localData = localStorage.getItem('transactions');
      if (localData) {
        transactions = JSON.parse(localData);
      }
    }

    // 3. Exécution du rendu
    renderUrssafUI(transactions, window.state?.profile || {});
  } catch (err) {
    console.error("Erreur lors de l'initialisation du module URSSAF:", err);
  }
}

// Rendre les fonctions accessibles globalement
window.initUrssafModule = initUrssafModule;
window.renderUrssafUI = renderUrssafUI;
window.calculerUrssaf = calculerUrssaf;
