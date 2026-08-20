/**
 * balance.js - Module de Balance Comptable pour Infirmier Libéral
 * Filtrage par année et gestion des À-Nouveau (comptes 1 à 5 rapportés des exercices passés).
 */

window.anneeBalanceSelectionnee = new Date().getFullYear();

function formatEuro(valeur) {
  return Number(valeur || 0).toLocaleString('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
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

/**
 * Calcul de la balance pour une année donnée en incluant les À-Nouveau
 */
function calculerBalanceParAnnee(transactions = [], anneeCible = new Date().getFullYear()) {
  const comptes = {};

  const initialiserCompte = (num, libelle) => {
    if (!comptes[num]) {
      comptes[num] = {
        num,
        libelle,
        debitANouveau: 0,
        creditANouveau: 0,
        debitMouvement: 0,
        creditMouvement: 0
      };
    }
  };

  // 1. Parcours global pour ventiler À-Nouveau (années < anneeCible) et Mouvements (année == anneeCible)
  transactions.forEach(tx => {
    if (!tx.date) return;
    const dateTx = new Date(tx.date);
    if (isNaN(dateTx.getTime())) return;

    const txAnnee = dateTx.getFullYear();
    if (txAnnee > anneeCible) return; // On ignore le futur

    const numCompte = tx.compte || tx.code_compte || '512000';
    const libelleCompte = tx.libelle_compte || tx.categorie || 'Compte Général';
    const debit = parseFloat(tx.debit || (tx.montant < 0 ? Math.abs(tx.montant) : 0) || 0);
    const credit = parseFloat(tx.credit || (tx.montant > 0 ? tx.montant : 0) || 0);

    initialiserCompte(numCompte, libelleCompte);

    // Bilan (classes 1 à 5) : On accumule les À-Nouveau des années antérieures
    // Compte de résultat (classes 6 et 7) : Pas d'À-Nouveau (remis à zéro chaque 1er janvier)
    const classe = numCompte.toString().charAt(0);

    if (txAnnee < anneeCible) {
      if (['1', '2', '3', '4', '5'].includes(classe)) {
        comptes[numCompte].debitANouveau += debit;
        comptes[numCompte].creditANouveau += credit;
      }
    } else if (txAnnee === anneeCible) {
      comptes[numCompte].debitMouvement += debit;
      comptes[numCompte].creditMouvement += credit;
    }
  });

  // 2. Transformer les comptes en tableau et calculer les soldes débits/crédits finaux
  let totalDebitANouveau = 0;
  let totalCreditANouveau = 0;
  let totalDebitMouvement = 0;
  let totalCreditMouvement = 0;
  let totalSoldeDebit = 0;
  let totalSoldeCredit = 0;

  const listeComptes = Object.values(comptes).map(c => {
    // Report net de l'À-nouveau
    const diffAN = c.debitANouveau - c.creditANouveau;
    const debitAN = diffAN > 0 ? diffAN : 0;
    const creditAN = diffAN < 0 ? Math.abs(diffAN) : 0;

    const totalDebitGlobal = debitAN + c.debitMouvement;
    const totalCreditGlobal = creditAN + c.creditMouvement;
    const soldeNett = totalDebitGlobal - totalCreditGlobal;

    const soldeDebit = soldeNett > 0 ? soldeNett : 0;
    const soldeCredit = soldeNett < 0 ? Math.abs(soldeNett) : 0;

    totalDebitANouveau += debitAN;
    totalCreditANouveau += creditAN;
    totalDebitMouvement += c.debitMouvement;
    totalCreditMouvement += c.creditMouvement;
    totalSoldeDebit += soldeDebit;
    totalSoldeCredit += soldeCredit;

    return {
      ...c,
      debitANouveauNet: debitAN,
      creditANouveauNet: creditAN,
      soldeDebit,
      soldeCredit
    };
  }).sort((a, b) => a.num.localeCompare(b.num));

  return {
    comptes: listeComptes,
    totaux: {
      debitAN: totalDebitANouveau,
      creditAN: totalCreditANouveau,
      debitMvt: totalDebitMouvement,
      creditMvt: totalCreditMouvement,
      soldeDebit: totalSoldeDebit,
      soldeCredit: totalSoldeCredit
    }
  };
}

function obtenirConteneurBalance() {
  let target = document.getElementById('balance') || 
               document.getElementById('vue-balance') || 
               document.getElementById('balance-content') || 
               document.getElementById('balance-container') ||
               document.querySelector('[data-tab="balance"]');

  if (!target) {
    const main = document.querySelector('main') || document.querySelector('.content') || document.body;
    if (main) {
      target = document.createElement('div');
      target.id = 'balance-container';
      main.appendChild(target);
    }
  }
  return target;
}

function renderBalanceUI(transactions = []) {
  window.transactionsBalanceCache = transactions;
  const container = obtenirConteneurBalance();
  if (!container) return;

  const annees = obtenirAnneesDisponibles(transactions);
  const anneeActive = window.anneeBalanceSelectionnee;

  const { comptes, totaux } = calculerBalanceParAnnee(transactions, anneeActive);

  container.innerHTML = `
    <div class="space-y-6 max-w-6xl mx-auto p-4 font-sans text-slate-800">

      <!-- ENTÊTE ET SÉLECTEUR D'ANNÉE -->
      <div class="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex flex-wrap justify-between items-center gap-4">
        <div>
          <h2 class="text-xl font-bold text-slate-800 flex items-center gap-2">
            📊 Balance Générales des Comptes (${anneeActive})
          </h2>
          <p class="text-xs text-slate-500 mt-1">
            Calcul avec reprise automatique des <strong>À-nouveaux (soldes reportés N-1)</strong> sur les comptes de bilan.
          </p>
        </div>

        <div class="flex items-center gap-4">
          <div class="flex items-center gap-2">
            <label for="select-annee-balance" class="text-xs font-semibold text-slate-700">Année :</label>
            <select id="select-annee-balance" onchange="changerAnneeBalance(this.value)" class="form-select bg-slate-50 border border-slate-300 text-slate-900 text-xs rounded-lg font-bold p-2 focus:ring-blue-500 focus:border-blue-500">
              ${annees.map(a => `<option value="${a}" ${a === parseInt(anneeActive, 10) ? 'selected' : ''}>${a}</option>`).join('')}
            </select>
          </div>

          <button onclick="window.print()" class="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs px-3 py-2 rounded-lg font-semibold border border-slate-300 transition">
            🖨️ Imprimer
          </button>
        </div>
      </div>

      <!-- TABLEAU DE BALANCE -->
      <div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-xs text-left border-collapse">
            <thead>
              <tr class="bg-slate-100 text-slate-700 font-bold border-b text-center">
                <th class="py-3 px-3 text-left w-20" rowspan="2">Compte</th>
                <th class="py-3 px-3 text-left" rowspan="2">Intitulé du Compte</th>
                <th class="py-1.5 px-3 border-l border-slate-200" colspan="2">À-Nouveau (Report N-1)</th>
                <th class="py-1.5 px-3 border-l border-slate-200" colspan="2">Mouvements de l'Année</th>
                <th class="py-1.5 px-3 border-l border-slate-200" colspan="2">Solde Final</th>
              </tr>
              <tr class="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <th class="py-1.5 px-2 text-right border-l border-slate-200 w-24">Débit</th>
                <th class="py-1.5 px-2 text-right w-24">Crédit</th>
                <th class="py-1.5 px-2 text-right border-l border-slate-200 w-24">Débit</th>
                <th class="py-1.5 px-2 text-right w-24">Crédit</th>
                <th class="py-1.5 px-2 text-right border-l border-slate-200 w-24">Solde Débit</th>
                <th class="py-1.5 px-2 text-right w-24">Solde Crédit</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              ${comptes.length === 0 ? `
                <tr>
                  <td colspan="8" class="py-8 text-center text-slate-400 italic">
                    Aucune écriture enregistrée pour l'année ${anneeActive}.
                  </td>
                </tr>
              ` : comptes.map(c => `
                <tr class="hover:bg-slate-50/80 transition">
                  <td class="py-2 px-3 font-mono font-bold text-slate-700">${c.num}</td>
                  <td class="py-2 px-3 font-medium text-slate-800">${c.libelle}</td>
                  <td class="py-2 px-2 text-right border-l border-slate-100 font-mono text-slate-500">${c.debitANouveauNet ? formatEuro(c.debitANouveauNet) : '-'}</td>
                  <td class="py-2 px-2 text-right font-mono text-slate-500">${c.creditANouveauNet ? formatEuro(c.creditANouveauNet) : '-'}</td>
                  <td class="py-2 px-2 text-right border-l border-slate-100 font-mono text-slate-700">${c.debitMouvement ? formatEuro(c.debitMouvement) : '-'}</td>
                  <td class="py-2 px-2 text-right font-mono text-slate-700">${c.creditMouvement ? formatEuro(c.creditMouvement) : '-'}</td>
                  <td class="py-2 px-2 text-right border-l border-slate-100 font-mono font-bold text-blue-700">${c.soldeDebit ? formatEuro(c.soldeDebit) : '-'}</td>
                  <td class="py-2 px-2 text-right font-mono font-bold text-emerald-700">${c.soldeCredit ? formatEuro(c.soldeCredit) : '-'}</td>
                </tr>
              `).join('')}
            </tbody>
            <tfoot>
              <tr class="bg-slate-800 text-white font-bold text-xs border-t-2 border-slate-900">
                <td colspan="2" class="py-3 px-3 uppercase tracking-wider">Total Général</td>
                <td class="py-3 px-2 text-right border-l border-slate-700 font-mono text-slate-200">${formatEuro(totaux.debitAN)}</td>
                <td class="py-3 px-2 text-right font-mono text-slate-200">${formatEuro(totaux.creditAN)}</td>
                <td class="py-3 px-2 text-right border-l border-slate-700 font-mono text-slate-200">${formatEuro(totaux.debitMvt)}</td>
                <td class="py-3 px-2 text-right font-mono text-slate-200">${formatEuro(totaux.creditMvt)}</td>
                <td class="py-3 px-2 text-right border-l border-slate-700 font-mono text-blue-300 font-extrabold">${formatEuro(totaux.soldeDebit)}</td>
                <td class="py-3 px-2 text-right font-mono text-emerald-300 font-extrabold">${formatEuro(totaux.soldeCredit)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

    </div>
  `;
}

function changerAnneeBalance(nouvelleAnnee) {
  window.anneeBalanceSelectionnee = parseInt(nouvelleAnnee, 10);
  window.actualiserBalance();
}

window.actualiserBalance = function() {
  const transactions = window.transactionsBalanceCache || window.listeTransactions || window.state?.transactions || [];
  renderBalanceUI(transactions);
};

async function initBalanceModule() {
  let transactions = window.listeTransactions || window.state?.transactions || [];

  if (transactions.length === 0 && window.supabaseClient) {
    try {
      const { data } = await window.supabaseClient.from('transactions').select('*');
      if (data) transactions = data;
    } catch (e) {
      console.warn("Supabase non disponible pour la Balance.");
    }
  }

  renderBalanceUI(transactions);
}

window.initBalanceModule = initBalanceModule;
window.initBalance = initBalanceModule;
window.changerAnneeBalance = changerAnneeBalance;

document.addEventListener('DOMContentLoaded', initBalanceModule);

document.addEventListener('click', (e) => {
  if (e.target && e.target.innerText && e.target.innerText.includes('Balance')) {
    setTimeout(initBalanceModule, 100);
  }
});
