/**
 * balance.js - Balance Générale avec filtre Année et règles de report (1-5 origine, 6-9 année)
 */

window.anneeBalanceSelectionnee = window.anneeBalanceSelectionnee || new Date().getFullYear();

function formatEuro(valeur) {
  if (valeur === 0 || valeur === null || valeur === undefined) return '-';
  return Number(valeur).toLocaleString('fr-FR', {
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
    const d = new Date(tx.date || tx.date_transaction);
    if (!isNaN(d.getTime())) {
      annees.add(d.getFullYear());
    }
  });

  return Array.from(annees).sort((a, b) => b - a);
}

/**
 * Calcul selon les règles comptables :
 * - Classes 1 à 5 : cumul depuis l'origine jusqu'à l'année cible (<= anneeCible)
 * - Classes 6 à 9 : uniquement l'année cible (== anneeCible)
 */
function calculerBalanceComptable(transactions = [], anneeCible = new Date().getFullYear()) {
  const comptes = {};

  transactions.forEach(tx => {
    const dateTx = new Date(tx.date || tx.date_transaction);
    if (isNaN(dateTx.getTime())) return;

    const txAnnee = dateTx.getFullYear();
    if (txAnnee > anneeCible) return; // Ignore le futur

    const numCompte = (tx.compte || tx.code_compte || tx.num_compte || '512000').toString();
    const libelleCompte = tx.libelle_compte || tx.intitule || tx.categorie || 'Compte Général';
    
    const debit = parseFloat(tx.debit || (tx.montant < 0 ? Math.abs(tx.montant) : 0) || 0);
    const credit = parseFloat(tx.credit || (tx.montant > 0 ? tx.montant : 0) || 0);

    const classe = numCompte.charAt(0);
    const estCompteBilan = ['1', '2', '3', '4', '5'].includes(classe);

    // Filtrage selon la classe du compte
    if (estCompteBilan && txAnnee <= anneeCible) {
      // Cumul depuis l'origine jusqu'à l'année sélectionnée
      if (!comptes[numCompte]) {
        comptes[numCompte] = { num: numCompte, libelle: libelleCompte, debit: 0, credit: 0 };
      }
      comptes[numCompte].debit += debit;
      comptes[numCompte].credit += credit;
    } else if (!estCompteBilan && txAnnee === anneeCible) {
      // Uniquement l'année sélectionnée
      if (!comptes[numCompte]) {
        comptes[numCompte] = { num: numCompte, libelle: libelleCompte, debit: 0, credit: 0 };
      }
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

/**
 * Localise la carte exacte où se trouve le titre de la Balance dans l'application
 */
function ciblerConteneurBalance() {
  const tousLesTitres = Array.from(document.querySelectorAll('h1, h2, h3, h4, div, span'));
  const titreBalance = tousLesTitres.find(el => 
    el.children.length === 0 && el.textContent.includes('Balance Générale des Comptes')
  );

  if (titreBalance) {
    const carte = titreBalance.closest('.bg-white') || titreBalance.closest('.card') || titreBalance.parentElement;
    if (carte) return carte;
  }

  return document.getElementById('balance-container') || 
         document.getElementById('balance') || 
         document.getElementById('vue-balance') || 
         document.querySelector('main') || document.body;
}

function renderBalanceUI(transactions = []) {
  window.transactionsBalanceCache = transactions;

  const container = ciblerConteneurBalance();
  if (!container) return;

  const annees = obtenirAnneesDisponibles(transactions);
  const anneeActive = parseInt(window.anneeBalanceSelectionnee, 10);
  const { comptes, totaux } = calculerBalanceComptable(transactions, anneeActive);

  container.innerHTML = `
    <div class="space-y-4">
      
      <!-- ENTÊTE AVEC SÉLECTEUR D'ANNÉE INSÉRÉ -->
      <div class="flex flex-wrap justify-between items-center gap-4 pb-2 border-b border-slate-100">
        <h2 class="text-base font-semibold text-slate-700 flex items-center gap-2">
          ⚖️ Balance Générale des Comptes
        </h2>

        <div class="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg">
          <label for="select-annee-balance" class="text-xs font-bold text-slate-600">Filtrer par Exercice :</label>
          <select id="select-annee-balance" onchange="changerAnneeBalance(this.value)" class="bg-white border border-slate-300 text-slate-900 text-xs rounded font-bold px-2 py-1 focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer">
            ${annees.map(a => `<option value="${a}" ${a === anneeActive ? 'selected' : ''}>${a}</option>`).join('')}
          </select>
        </div>
      </div>

      <!-- TABLEAU CONFORME À L'INTERFACE -->
      <div class="overflow-x-auto">
        <table class="w-full text-xs text-left border-collapse">
          <thead>
            <tr class="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
              <th class="py-3 px-4 w-32">Numéro</th>
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
                  Aucun mouvement enregistré pour l'exercice ${anneeActive}.
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
