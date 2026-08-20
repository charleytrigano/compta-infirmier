/**
 * balance.js - Correction définitive : Récupération Supabase multi-tables + Anti-doublon DOM + Filtres N/<=N
 */

window.anneeBalanceSelectionnee = window.anneeBalanceSelectionnee || new Date().getFullYear();

function formatEuro(valeur) {
  if (valeur === null || valeur === undefined || Math.abs(valeur) < 0.001) return '-';
  return Number(valeur).toLocaleString('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function extraireAnnee(dateVal) {
  if (!dateVal) return null;
  if (typeof dateVal === 'string' && dateVal.length >= 4) {
    const y = parseInt(dateVal.substring(0, 4), 10);
    if (!isNaN(y) && y > 1900 && y < 2100) return y;
  }
  const d = new Date(dateVal);
  return isNaN(d.getTime()) ? null : d.getFullYear();
}

/**
 * Récupère les données depuis Supabase ou la mémoire globale
 */
async function chargerTransactionsData() {
  let list = window.listeTransactions || window.transactions || window.state?.transactions || window.appData?.transactions || [];

  if ((!list || list.length === 0) && window.supabaseClient) {
    const tablesATester = ['transactions', 'ecritures', 'journal', 'mouvements'];
    for (const table of tablesATester) {
      try {
        const { data, error } = await window.supabaseClient.from(table).select('*');
        if (!error && data && data.length > 0) {
          list = data;
          break;
        }
      } catch (e) {}
    }
  }

  return list || [];
}

function obtenirAnneesDisponibles(transactions = []) {
  const annees = new Set();
  const anneeCourante = new Date().getFullYear();
  annees.add(anneeCourante);

  transactions.forEach(tx => {
    const dateVal = tx.date || tx.date_transaction || tx.created_at || tx.date_ecriture || tx.date_journal;
    const y = extraireAnnee(dateVal);
    if (y) annees.add(y);
  });

  return Array.from(annees).sort((a, b) => b - a);
}

function calculerBalanceComptable(transactions = [], anneeCible = new Date().getFullYear()) {
  const comptes = {};

  transactions.forEach(tx => {
    const dateVal = tx.date || tx.date_transaction || tx.created_at || tx.date_ecriture || tx.date_journal;
    const txAnnee = extraireAnnee(dateVal);

    if (!txAnnee || txAnnee > anneeCible) return;

    // Détection universelle du numéro et libellé de compte
    const numCompte = String(
      tx.compte || tx.code_compte || tx.num_compte || tx.compte_num || tx.code || '512000'
    ).trim();

    const libelleCompte = tx.libelle_compte || tx.intitule || tx.categorie || tx.label || tx.description || tx.libelle || 'Compte Général';

    // Détection universelle des montants Débit/Crédit
    let debit = parseFloat(tx.debit || tx.montant_debit || 0);
    let credit = parseFloat(tx.credit || tx.montant_credit || 0);

    if (debit === 0 && credit === 0 && tx.montant !== undefined) {
      const m = parseFloat(tx.montant || 0);
      if (m < 0) debit = Math.abs(m);
      else credit = m;
    }

    const classe = numCompte.charAt(0);
    const estCompteBilan = ['1', '2', '3', '4', '5'].includes(classe);

    // Règle comptable : Bilan (1 à 5) <= année | Gestion (6 à 9) == année
    const doitInclure = estCompteBilan ? (txAnnee <= anneeCible) : (txAnnee === anneeCible);

    if (doitInclure) {
      if (!comptes[numCompte]) {
        comptes[numCompte] = { num: numCompte, libelle: libelleCompte, debit: 0, credit: 0 };
      }
      comptes[numCompte].debit += debit;
      comptes[numCompte].credit += credit;
    }
  });

  let totaux = { debit: 0, credit: 0, soldeDebit: 0, soldeCredit: 0 };

  const listeComptes = Object.values(comptes).map(c => {
    const diff = c.debit - c.credit;
    const soldeDebit = diff > 0 ? diff : 0;
    const soldeCredit = diff < 0 ? Math.abs(diff) : 0;

    totaux.debit += c.debit;
    totaux.credit += c.credit;
    totaux.soldeDebit += soldeDebit;
    totaux.soldeCredit += soldeCredit;

    return { ...c, soldeDebit, soldeCredit };
  }).sort((a, b) => a.num.localeCompare(b.num, undefined, { numeric: true }));

  return { comptes: listeComptes, totaux };
}

async function renderBalanceUI() {
  const transactions = await chargerTransactionsData();
  window.transactionsBalanceCache = transactions;

  // 1. Détection de tous les blocs de balance existants dans la page
  const tousLesTitres = Array.from(document.querySelectorAll('*')).filter(
    el => el.children.length === 0 && el.textContent.includes('Balance Générale des Comptes')
  );

  if (tousLesTitres.length === 0) return;

  // On prend le premier bloc parent
  const conteneurCible = tousLesTitres[0].closest('.bg-white') || tousLesTitres[0].parentElement;

  // Nettoyage de TOUS les blocs frères en doublon créés par d'anciens rendus
  tousLesTitres.slice(1).forEach(t => {
    const blocEnTrop = t.closest('.bg-white') || t.parentElement;
    if (blocEnTrop && blocEnTrop !== conteneurCible) {
      blocEnTrop.remove();
    }
  });

  const annees = obtenirAnneesDisponibles(transactions);
  const anneeActive = parseInt(window.anneeBalanceSelectionnee, 10);
  const { comptes, totaux } = calculerBalanceComptable(transactions, anneeActive);

  // Injection unique dans le conteneur principal
  conteneurCible.innerHTML = `
    <div class="space-y-4">
      
      <!-- ENTÊTE DE BALANCE AVEC FILTRE -->
      <div class="flex flex-wrap justify-between items-center gap-4 pb-3 border-b border-slate-100">
        <h2 class="text-base font-semibold text-slate-700 flex items-center gap-2">
          ⚖️ Balance Générale des Comptes
        </h2>

        <div class="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg">
          <label for="select-annee-balance" class="text-xs font-bold text-slate-600">Exercice :</label>
          <select id="select-annee-balance" onchange="changerAnneeBalance(this.value)" class="bg-white border border-slate-300 text-slate-900 text-xs rounded font-bold px-2 py-1 focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer">
            ${annees.map(a => `<option value="${a}" ${a === anneeActive ? 'selected' : ''}>${a}</option>`).join('')}
          </select>
        </div>
      </div>

      <!-- TABLEAU DE BALANCE -->
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
  renderBalanceUI();
}

window.initBalanceModule = renderBalanceUI;
window.initBalance = renderBalanceUI;
window.changerAnneeBalance = changerAnneeBalance;
window.actualiserBalance = renderBalanceUI;

// Déclencheur sur le clic sur le bouton "Balance des Comptes"
document.addEventListener('click', (e) => {
  if (e.target && e.target.innerText && e.target.innerText.includes('Balance')) {
    setTimeout(renderBalanceUI, 100);
  }
});

document.addEventListener('DOMContentLoaded', renderBalanceUI);
