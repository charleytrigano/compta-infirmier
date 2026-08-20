/**
 * balance.js - Balance Générale des Comptes avec Filtrage par Année et À-Nouveau
 */

window.anneeBalanceSelectionnee = window.anneeBalanceSelectionnee || new Date().getFullYear();

function formatEuro(valeur) {
  if (valeur === 0 || valeur === null || valeur === undefined) return '-';
  return Number(valeur).toLocaleString('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).replace('€', '€');
}

function obtenirAnneesDisponibles(transactions = []) {
  const annees = new Set();
  const anneeCourante = new Date().getFullYear();
  annees.add(anneeCourante);

  transactions.forEach(tx => {
    const d = new Date(tx.date || tx.date_transaction);
    if (!isNaN(d.getTime())) {
      annees.add(d.getFullYear());
    }
  });

  return Array.from(annees).sort((a, b) => b - a);
}

function calculerBalanceComptable(transactions = [], anneeCible = new Date().getFullYear()) {
  const comptes = {};

  transactions.forEach(tx => {
    const dateTx = new Date(tx.date || tx.date_transaction);
    if (isNaN(dateTx.getTime())) return;

    const txAnnee = dateTx.getFullYear();
    if (txAnnee > anneeCible) return; // On ignore les écritures des années futures

    const numCompte = tx.compte || tx.code_compte || tx.num_compte || '512000';
    const libelleCompte = tx.libelle_compte || tx.intitule || tx.categorie || 'Compte Général';
    
    const debit = parseFloat(tx.debit || (tx.montant < 0 ? Math.abs(tx.montant) : 0) || 0);
    const credit = parseFloat(tx.credit || (tx.montant > 0 ? tx.montant : 0) || 0);

    if (!comptes[numCompte]) {
      comptes[numCompte] = {
        num: numCompte,
        libelle: libelleCompte,
        debit: 0,
        credit: 0
      };
    }

    const classe = numCompte.toString().charAt(0);

    // Reprise des À-Nouveaux (exercices passés) uniquement pour les comptes de bilan (1 à 5)
    if (txAnnee < anneeCible) {
      if (['1', '2', '3', '4', '5'].includes(classe)) {
        comptes[numCompte].debit += debit;
        comptes[numCompte].credit += credit;
      }
    } else if (txAnnee === anneeCible) {
      // Mouvements de l'année en cours pour TOUS les comptes (1 à 7)
      comptes[numCompte].debit += debit;
      comptes[numCompte].credit += credit;
    }
  });

  let totaux = { debit: 0, credit: 0, soldeDebit: 0, soldeCredit: 0 };

  const listeComptes = Object.values(comptes).map(c => {
    const soldeNett = c.debit - c.credit;
    const soldeDebit = soldeNett > 0 ? soldeNett : 0;
    const soldeCredit = soldeNett < 0 ? Math.abs(soldeNett) : 0;

    totaux.debit += c.debit;
    totaux.credit += c.credit;
    totaux.soldeDebit += soldeDebit;
    totaux.soldeCredit += soldeCredit;

    return {
      ...c,
      soldeDebit,
      soldeCredit
    };
  }).sort((a, b) => a.num.localeCompare(b.num));

  return { comptes: listeComptes, totaux };
}

function renderBalanceUI(transactions = []) {
  window.transactionsBalanceCache = transactions;

  // Recherche du conteneur cible
  let container = document.getElementById('balance-container') || 
                    document.getElementById('balance') || 
                    document.getElementById('vue-balance');

  if (!container) {
    const main = document.querySelector('main') || document.querySelector('.content') || document.body;
    container = document.createElement('div');
    container.id = 'balance-container';
    main.appendChild(container);
  }

  const annees = obtenirAnneesDisponibles(transactions);
  const anneeActive = window.anneeBalanceSelectionnee;
  const { comptes, totaux } = calculerBalanceComptable(transactions, anneeActive);

  container.innerHTML = `
    <div class="bg-white p-6 rounded-xl shadow-sm border border-slate-200 max-w-7xl mx-auto space-y-4">
      
      <!-- ENTÊTE AVEC FILTRE PAR ANNÉE -->
      <div class="flex flex-wrap justify-between items-center gap-4 pb-2 border-b border-slate-100">
        <h2 class="text-lg font-medium text-slate-700 flex items-center gap-2">
          ⚖️ Balance Générale des Comptes
        </h2>

        <div class="flex items-center gap-3">
          <label for="select-annee-balance" class="text-xs font-semibold text-slate-600">Exercice :</label>
          <select id="select-annee-balance" onchange="changerAnneeBalance(this.value)" class="bg-slate-50 border border-slate-300 text-slate-800 text-xs rounded-lg font-bold p-2 focus:ring-blue-500 focus:border-blue-500">
            ${annees.map(a => `<option value="${a}" ${a === parseInt(anneeActive, 10) ? 'selected' : ''}>${a}</option>`).join('')}
          </select>
        </div>
      </div>

      <!-- TABLEAU CONFORME À L'INTERFACE -->
      <div class="overflow-x-auto">
        <table class="w-full text-xs text-left border-collapse">
          <thead>
            <tr class="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
              <th class="py-3 px-4 w-28">Numéro</th>
              <th class="py-3 px-4">Intitulé du compte</th>
              <th class="py-3 px-4 text-right text-red-600 font-semibold w-36">Total Débit (€)</th>
              <th class="py-3 px-4 text-right text-emerald-600 font-semibold w-36">Total Crédit (€)</th>
              <th class="py-3 px-4 text-right text-blue-600 font-semibold w-36">Solde Débiteurs (€)</th>
              <th class="py-3 px-4 text-right text-emerald-600 font-semibold w-36">Solde Créditeurs (€)</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            ${comptes.length === 0 ? `
              <tr>
                <td colspan="6" class="py-8 text-center text-slate-400 italic">
                  Aucun mouvement enregistré pour l'année ${anneeActive}.
                </td>
              </tr>
            ` : comptes.map(c => `
              <tr class="hover:bg-slate-50/50 transition">
                <td class="py-3 px-4 font-bold text-slate-800">${c.num}</td>
                <td class="py-3 px-4 text-slate-600">${c.num} - ${c.libelle}</td>
                <td class="py-3 px-4 text-right font-medium text-red-600">${formatEuro(c.debit)}</td>
                <td class="py-3 px-4 text-right font-medium text-emerald-600">${formatEuro(c.credit)}</td>
                <td class="py-3 px-4 text-right font-bold text-blue-600">${formatEuro(c.soldeDebit)}</td>
                <td class="py-3 px-4 text-right font-bold text-emerald-600">${formatEuro(c.soldeCredit)}</td>
              </tr>
            `).join('')}
          </tbody>
          <tfoot>
            <tr class="bg-slate-50 text-slate-800 font-bold border-t-2 border-slate-200">
              <td colspan="2" class="py-3.5 px-4 text-right uppercase tracking-wider text-slate-700">TOTAUX :</td>
              <td class="py-3.5 px-4 text-right text-red-600 font-extrabold text-sm">${formatEuro(totaux.debit)}</td>
              <td class="py-3.5 px-4 text-right text-emerald-600 font-extrabold text-sm">${formatEuro(totaux.credit)}</td>
              <td class="py-3.5 px-4 text-right text-blue-600 font-extrabold text-sm">${formatEuro(totaux.soldeDebit)}</td>
              <td class="py-3.5 px-4 text-right text-emerald-600 font-extrabold text-sm">${formatEuro(totaux.soldeCredit)}</td>
            </tr>
          </tfoot>
        </table>
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
      console.warn("Supabase non disponible.");
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
    setTimeout(initBalanceModule, 50);
  }
});
