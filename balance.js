/**
 * balance.js - Correction définitive : suppression doublons, extraction universelle des données, filtre N/<=N
 */

window.anneeBalanceSelectionnee = window.anneeBalanceSelectionnee || new Date().getFullYear();

function formatEuro(valeur) {
  if (!valeur || Math.abs(valeur) < 0.001) return '-';
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
 * Récupère les transactions de n'importe quel stockage global de l'application
 */
function recupererToutesLesTransactions() {
  if (Array.isArray(window.transactionsBalanceCache) && window.transactionsBalanceCache.length > 0) return window.transactionsBalanceCache;
  if (Array.isArray(window.listeTransactions) && window.listeTransactions.length > 0) return window.listeTransactions;
  if (Array.isArray(window.transactions) && window.transactions.length > 0) return window.transactions;
  if (Array.isArray(window.state?.transactions) && window.state.transactions.length > 0) return window.state.transactions;
  if (Array.isArray(window.appData?.transactions) && window.appData.transactions.length > 0) return window.appData.transactions;
  
  // Tentative de récupération dans le LocalStorage
  try {
    const local = localStorage.getItem('transactions') || localStorage.getItem('compta_transactions');
    if (local) {
      const parsed = JSON.parse(local);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {}

  return [];
}

function obtenirAnneesDisponibles(transactions = []) {
  const annees = new Set();
  const anneeCourante = new Date().getFullYear();
  annees.add(anneeCourante);

  transactions.forEach(tx => {
    const dateVal = tx.date || tx.date_transaction || tx.created_at || tx.date_ecriture;
    const y = extraireAnnee(dateVal);
    if (y) annees.add(y);
  });

  return Array.from(annees).sort((a, b) => b - a);
}

function calculerBalanceComptable(transactions = [], anneeCible = new Date().getFullYear()) {
  const comptes = {};

  transactions.forEach(tx => {
    const dateVal = tx.date || tx.date_transaction || tx.created_at || tx.date_ecriture;
    const txAnnee = extraireAnnee(dateVal);

    if (!txAnnee || txAnnee > anneeCible) return; // Ignore le futur

    // Identification du compte
    const numCompte = String(tx.compte || tx.code_compte || tx.num_compte || tx.compte_num || '512000').trim();
    const libelleCompte = tx.libelle_compte || tx.intitule || tx.categorie || tx.label || tx.description || 'Compte Général';

    // Déduction des débits / crédits
    let debit = parseFloat(tx.debit || 0);
    let credit = parseFloat(tx.credit || 0);

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

function renderBalanceUI() {
  const transactions = recupererToutesLesTransactions();
  window.transactionsBalanceCache = transactions;

  // Repérage du conteneur unique et suppression des réplications
  const tousTitres = Array.from(document.querySelectorAll('h1, h2, h3, h4, div, span'));
  const titresBalance = tousTitres.filter(t => t.children.length === 0 && t.textContent.trim().includes('Balance Générale des Comptes'));

  if (titresBalance.length === 0) return;

  // On prend la toute première occurrence et on supprime les doublons éventuels
  const titrePrincipal = titresBalance[0];
  const conteneurParent = titrePrincipal.closest('.bg-white') || titrePrincipal.parentElement;

  // Nettoyage des cartes en doublon si l'injecteur a tourné plusieurs fois
  titresBalance.slice(1).forEach(t => {
    const carteDoublon = t.closest('.bg-white') || t.parentElement;
    if (carteDoublon && carteDoublon !== conteneurParent) {
      carteDoublon.remove();
    }
  });

  const annees = obtenirAnneesDisponibles(transactions);
  const anneeActive = parseInt(window.anneeBalanceSelectionnee, 10);
  const { comptes, totaux } = calculerBalanceComptable(transactions, anneeActive);

  // Remplacement HTML propre sans dupliquer
  conteneurParent.innerHTML = `
    <div class="space-y-4">
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
                  Aucun mouvement trouvé pour l'exercice ${anneeActive}.
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

async function initBalanceModule() {
  if (window.supabaseClient) {
    try {
      const { data } = await window.supabaseClient.from('transactions').select('*');
      if (data && data.length > 0) {
        window.transactionsBalanceCache = data;
      }
    } catch (e) {}
  }
  renderBalanceUI();
}

window.initBalanceModule = initBalanceModule;
window.initBalance = initBalanceModule;
window.changerAnneeBalance = changerAnneeBalance;
window.actualiserBalance = renderBalanceUI;

document.addEventListener('click', (e) => {
  if (e.target && e.target.innerText && e.target.innerText.includes('Balance')) {
    setTimeout(initBalanceModule, 80);
  }
});

document.addEventListener('DOMContentLoaded', initBalanceModule);
