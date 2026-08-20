/**
 * balance.js - Correction Ultime :
 * 1. Verrouillage du DOM contre la duplication par d'autres scripts.
 * 2. Détection dynamique de tous les comptes (6xx charges, 7xx recettes, 5xx banque, 4xx tiers).
 * 3. Ventilation correcte Débit / Crédit et calcul exact du solde.
 */

(function () {
  window.anneeBalanceSelectionnee = window.anneeBalanceSelectionnee || new Date().getFullYear();
  let enCoursDeRendu = false;

  function parseMontant(val) {
    if (val === null || val === undefined) return 0;
    if (typeof val === 'number') return isNaN(val) ? 0 : val;
    if (typeof val === 'string') {
      const propre = val.replace(/\s/g, '').replace('€', '').replace(',', '.').trim();
      const num = parseFloat(propre);
      return isNaN(num) ? 0 : num;
    }
    return 0;
  }

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
    if (typeof dateVal === 'number') return dateVal;
    if (typeof dateVal === 'string') {
      const match = dateVal.match(/(19|20)\d{2}/);
      if (match) return parseInt(match[0], 10);
    }
    const d = new Date(dateVal);
    return isNaN(d.getTime()) ? null : d.getFullYear();
  }

  function determinerCompte(tx) {
    let num = tx.compte || tx.code_compte || tx.num_compte || tx.compte_num || tx.compte_comptable || tx.account || tx.code;
    let libelle = tx.libelle_compte || tx.intitule || tx.categorie || tx.label || tx.description || tx.libelle || tx.poste || tx.nom_compte || tx.remarque;

    // Si pas de compte explicite, déduction automatique selon le type ou montant
    if (!num) {
      const type = String(tx.type || tx.nature || '').toLowerCase();
      const m = parseMontant(tx.montant || tx.amount || tx.solde);
      const isCredit = parseMontant(tx.credit) > 0 || m > 0 || type.includes('recette') || type.includes('honor');

      if (isCredit) {
        num = '706000';
        libelle = libelle || 'Prestations de services / Honoraires';
      } else {
        num = '606000';
        libelle = libelle || 'Achats & Charges';
      }
    }

    return {
      num: String(num).trim(),
      libelle: String(libelle || 'Compte général').trim()
    };
  }

  function recupererToutesLesTransactions() {
    let txs = window.listeTransactions || window.transactions || window.state?.transactions || window.appData?.transactions || [];
    if (!Array.isArray(txs) || txs.length === 0) {
      try {
        const local = localStorage.getItem('transactions') || localStorage.getItem('compta_transactions') || localStorage.getItem('ecritures');
        if (local) txs = JSON.parse(local);
      } catch (e) {}
    }
    return Array.isArray(txs) ? txs : [];
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
      const txAnnee = extraireAnnee(dateVal) || anneeCible;

      if (txAnnee > anneeCible) return;

      const { num, libelle } = determinerCompte(tx);

      let debit = parseMontant(tx.debit || tx.montant_debit || tx.debit_eur);
      let credit = parseMontant(tx.credit || tx.montant_credit || tx.credit_eur);

      if (debit === 0 && credit === 0) {
        const m = parseMontant(tx.montant || tx.amount || tx.solde || tx.valeur);
        if (m < 0) debit = Math.abs(m);
        else credit = m;
      }

      const classe = num.charAt(0);
      const estCompteBilan = ['1', '2', '3', '4', '5'].includes(classe);

      // Regle comptable : Bilan (1 à 5) <= année | Gestion (6 à 9) == année
      const doitInclure = estCompteBilan ? (txAnnee <= anneeCible) : (txAnnee === anneeCible);

      if (doitInclure) {
        if (!comptes[num]) {
          comptes[num] = { num: num, libelle: libelle, debit: 0, credit: 0 };
        }
        comptes[num].debit += debit;
        comptes[num].credit += credit;
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

  async function afficherBalanceUnifiee() {
    if (enCoursDeRendu) return;
    enCoursDeRendu = true;

    let transactions = recupererToutesLesTransactions();

    if (transactions.length === 0 && window.supabaseClient) {
      const tables = ['transactions', 'ecritures', 'journal', 'mouvements'];
      for (const t of tables) {
        try {
          const { data } = await window.supabaseClient.from(t).select('*');
          if (data && data.length > 0) {
            transactions = data;
            window.listeTransactions = data;
            break;
          }
        } catch (e) {}
      }
    }

    // 1. Détection de tous les blocs Balance présent dans le DOM
    const tousTitres = Array.from(document.querySelectorAll('*')).filter(
      el => el.children.length === 0 && el.textContent.includes('Balance Générale des Comptes')
    );

    if (tousTitres.length === 0) {
      enCoursDeRendu = false;
      return;
    }

    const conteneurPrincipal = tousTitres[0].closest('.bg-white') || tousTitres[0].closest('.card') || tousTitres[0].parentElement;

    // Suppression physique de tous les blocs parasites en doublons
    tousTitres.forEach((t, i) => {
      if (i > 0) {
        const d = t.closest('.bg-white') || t.closest('.card') || t.parentElement;
        if (d && d !== conteneurPrincipal) d.remove();
      }
    });

    const annees = obtenirAnneesDisponibles(transactions);
    const anneeActive = parseInt(window.anneeBalanceSelectionnee, 10);
    const { comptes, totaux } = calculerBalanceComptable(transactions, anneeActive);

    // 2. Rendu propre du tableau unique
    conteneurPrincipal.innerHTML = `
      <div class="space-y-4" id="balance-unique-root">
        
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
                    Aucune donnée comptable pour l'exercice ${anneeActive}.
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

    setTimeout(() => { enCoursDeRendu = false; }, 200);
  }

  window.changerAnneeBalance = function(annee) {
    window.anneeBalanceSelectionnee = parseInt(annee, 10);
    afficherBalanceUnifiee();
  };

  // Neutralisation globale des fonctions concurrentes
  window.renderBalance = afficherBalanceUnifiee;
  window.renderBalanceModule = afficherBalanceUnifiee;
  window.afficherBalance = afficherBalanceUnifiee;
  window.initBalanceModule = afficherBalanceUnifiee;
  window.initBalance = afficherBalanceUnifiee;

  // Anti-écrasement automatique : ré-exécute si un autre script tente de réinjecter des cartes
  const observer = new MutationObserver(() => {
    const cartes = document.querySelectorAll('#balance-unique-root');
    if (cartes.length === 0 && !enCoursDeRendu) {
      afficherBalanceUnifiee();
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', afficherBalanceUnifiee);
  } else {
    afficherBalanceUnifiee();
  }
})();
