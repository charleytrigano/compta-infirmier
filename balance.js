/**
 * balance.js - Correction définitive : Nettoyage strict du DOM + Récupération Supabase + Règle comptable 1-5 (origine) et 6-9 (année)
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
 * Récupération exhaustive des transactions (Supabase + Variables globales)
 */
async function chargerTransactionsData() {
  let list = window.listeTransactions || window.transactions || window.state?.transactions || window.appData?.transactions || [];

  if ((!list || list.length === 0) && window.supabaseClient) {
    const tables = ['transactions', 'ecritures', 'journal', 'mouvements'];
    for (const t of tables) {
      try {
        const { data, error } = await window.supabaseClient.from(t).select('*');
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

    // Récupération souple du numéro et du libellé
    const numCompte = String(
      tx.compte || tx.code_compte || tx.num_compte || tx.compte_num || tx.code || '512000'
    ).trim();

    const libelleCompte = tx.libelle_compte || tx.intitule || tx.categorie || tx.label || tx.description || tx.libelle || 'Compte Général';

    // Récupération souple Débit / Crédit / Montant
    let debit = parseFloat(tx.debit || tx.montant_debit || 0);
    let credit = parseFloat(tx.credit || tx.montant_credit || 0);

    if (debit === 0 && credit === 0 && tx.montant !== undefined) {
      const m = parseFloat(tx.montant || 0);
      if (m < 0) debit = Math.abs(m);
      else credit = m;
    }

    const classe = numCompte.charAt(0);
    const estCompteBilan = ['1', '2', '3', '4', '5'].includes(classe);

    // Règle comptable : Bilan (1 à 5) <= année cible | Gestion (6 à 9) == année cible
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

async function exécuterRenduBalance() {
  const transactions = await chargerTransactionsData();
  
  // 1. Détection du conteneur parent principal
  const zoneOnglet = document.getElementById('view-balance') || 
                     document.getElementById('balance-container') || 
                     document.getElementById('content') || 
                     document.querySelector('main');

  if (!zoneOnglet) return;

  const annees = obtenirAnneesDisponibles(transactions);
  const anneeActive = parseInt(window.anneeBalanceSelectionnee, 10);
  const { comptes, totaux } = calculerBalanceComptable(transactions, anneeActive);

  // 2. VIDAGE COMPLET pour empêcher la duplication
  zoneOnglet.innerHTML = `
    <div class="bg-white p-6 rounded-xl shadow-sm border border-slate-200 max-w-7xl mx-auto space-y-4 my-4">
      
      <!-- ENTÊTE AVEC FILTRE SÉLECTEUR D'EXERCICE -->
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

      <!-- TABLEAU UNIQUE -->
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
  exécuterRenduBalance();
}

// Surcharge des méthodes globales de l'app pour neutraliser les rendus en doublon
window.renderBalance = exécuterRenduBalance;
window.renderBalanceModule = exécuterRenduBalance;
window.afficherBalance = exécuterRenduBalance;
window.initBalanceModule = exécuterRenduBalance;
window.initBalance = exécuterRenduBalance;
window.changerAnneeBalance = changerAnneeBalance;
window.actualiserBalance = exécuterRenduBalance;

// Déclenchement au clic sur le bouton d'onglet
document.addEventListener('click', (e) => {
  const target = e.target;
  if (target && target.innerText && target.innerText.includes('Balance')) {
    setTimeout(exécuterRenduBalance, 50);
  }
});

document.addEventListener('DOMContentLoaded', exécuterRenduBalance);
