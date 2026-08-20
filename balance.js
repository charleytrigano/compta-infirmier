/**
 * balance.js - Correction anti-doublon, détection automatique des champs et filtre exercice.
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

// Extraction robuste de l'année (chaîne YYYY-MM-DD ou objet Date)
function extraireAnnee(dateVal) {
  if (!dateVal) return null;
  if (typeof dateVal === 'string' && dateVal.length >= 4) {
    const y = parseInt(dateVal.substring(0, 4), 10);
    if (!isNaN(y) && y > 1900 && y < 2100) return y;
  }
  const d = new Date(dateVal);
  return isNaN(d.getTime()) ? null : d.getFullYear();
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
    
    // Si pas de date ou écriture dans le futur, on passe
    if (!txAnnee || txAnnee > anneeCible) return;

    // Détection souple du compte et du libellé
    const numCompte = String(tx.compte || tx.code_compte || tx.num_compte || tx.compte_num || '512000').trim();
    const libelleCompte = tx.libelle_compte || tx.intitule || tx.categorie || tx.label || tx.description || 'Compte Général';

    // Détection souple Débit / Crédit / Montant
    let debit = parseFloat(tx.debit || 0);
    let credit = parseFloat(tx.credit || 0);

    if (debit === 0 && credit === 0 && tx.montant !== undefined) {
      const m = parseFloat(tx.montant || 0);
      if (m < 0) debit = Math.abs(m);
      else credit = m;
    }

    const classe = numCompte.charAt(0);
    const estCompteBilan = ['1', '2', '3', '4', '5'].includes(classe);

    // Règle : Bilan (1 à 5) <= année | Gestion (6 à 9) == année
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

function viderEtObtenirConteneur() {
  // Cibler la carte contenant le titre de la Balance
  const tousTitres = Array.from(document.querySelectorAll('h1, h2, h3, h4, div'));
  const titre = tousTitres.find(t => t.children.length === 0 && t.textContent.trim().includes('Balance Générale des Comptes'));
  
  if (titre) {
    const carte = titre.closest('.bg-white') || titre.parentElement;
    if (carte) return carte;
  }

  return document.getElementById('balance-container') || 
         document.getElementById('balance') || 
         document.getElementById('vue-balance');
}

function renderBalanceUI(transactions = []) {
  window.transactionsBalanceCache = transactions;

  const container = viderEtObtenirConteneur();
  if (!container) return;

  const annees = obtenirAnneesDisponibles(transactions);
  const anneeActive = parseInt(window.anneeBalanceSelectionnee, 10);
  const { comptes, totaux } = calculerBalanceComptable(transactions, anneeActive);

  // Remplacement complet du contenu pour éviter toute duplication
  container.innerHTML = `
    <div class="space-y-4">
      
      <!-- ENTÊTE AVEC FILTRE SÉLECTIONNEUR D'EXERCICE -->
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

      <!-- TABLEAU DES COMPTES -->
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
  window.actualiserBalance();
}

window.actualiserBalance = function() {
  const transactions = window.transactionsBalanceCache || 
                     window.listeTransactions || 
                     window.state?.transactions || 
                     window.appData?.transactions || [];
  renderBalanceUI(transactions);
};

async function initBalanceModule() {
  let transactions = window.listeTransactions || window.state?.transactions || window.appData?.transactions || [];

  if ((!transactions || transactions.length === 0) && window.supabaseClient) {
    try {
      const { data } = await window.supabaseClient.from('transactions').select('*');
      if (data && data.length > 0) transactions = data;
    } catch (e) {
      console.warn("Supabase non disponible.");
    }
  }

  renderBalanceUI(transactions);
}

window.initBalanceModule = initBalanceModule;
window.initBalance = initBalanceModule;
window.changerAnneeBalance = changerAnneeBalance;

if (!window.balanceListenerActive) {
  document.addEventListener('click', (e) => {
    if (e.target && e.target.innerText && e.target.innerText.includes('Balance')) {
      setTimeout(initBalanceModule, 50);
    }
  });
  window.balanceListenerActive = true;
}

document.addEventListener('DOMContentLoaded', initBalanceModule);
