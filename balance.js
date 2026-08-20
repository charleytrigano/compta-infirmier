/**
 * balance.js - Prise en charge des OD et des comptes Tiers (411)
 */

(function () {
  window.anneeBalanceSelectionnee = window.anneeBalanceSelectionnee || new Date().getFullYear();

  function parseMontant(val) {
    if (val === null || val === undefined) return 0;
    if (typeof val === 'number') return isNaN(val) ? 0 : Math.abs(val);
    if (typeof val === 'string') {
      const propre = val.replace(/\s/g, '').replace('€', '').replace(',', '.').trim();
      const num = parseFloat(propre);
      return isNaN(num) ? 0 : Math.abs(num);
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

  function determinerCompteEtLibelle(category, type, description) {
    const catClean = (category || '').toLowerCase().trim();
    const descClean = (description || '').trim();
    const descLower = descClean.toLowerCase();

    // 1. Détection des comptes 411 (Clients / Tiers) dans la description
    if (descClean.startsWith('411') || descLower.includes('abadie') || descLower.includes('st-andre')) {
      const nomClient = descClean.replace(/^411/, '').trim() || 'Patients';
      return { num: '411000', libelle: `Clients / Patients - ${nomClient} (411000)` };
    }

    // 2. Détection d'un numéro de compte explicite dans la description (ex: 645, 606, etc.)
    const matchCompte = descClean.match(/^([1-7]\d{5})/);
    if (matchCompte) {
      return { num: matchCompte[1], libelle: `Compte ${matchCompte[1]} - ${descClean}` };
    }

    // 3. Recettes et soins
    if (type === 'recette' || catClean.includes('soin') || catClean.includes('honoraire')) {
      return { num: '706000', libelle: 'Honoraires conventionnés (706000)' };
    }

    // 4. Mots-clés de charges (pour type depense ou od)
    if (descLower.includes('urssaf') || catClean.includes('urssaf')) {
      return { num: '645000', libelle: 'Charges sociales / URSSAF (645000)' };
    }
    if (descLower.includes('carpimko') || catClean.includes('carpimko')) {
      return { num: '646000', libelle: 'Cotisations retraite CARPIMKO (646000)' };
    }
    if (descLower.includes('secu') || descLower.includes('sécu')) {
      return { num: '645100', libelle: 'Cotisations Sécurité Sociale (645100)' };
    }
    if (descLower.includes('materiel') || descLower.includes('pharma') || catClean.includes('fournit')) {
      return { num: '606000', libelle: 'Achats de fournitures / Petit matériel (606000)' };
    }

    // Par défaut pour les OD non classées
    if (type === 'od') {
      return { num: '471000', libelle: `Opération Diverse - ${description || category || 'Attente'} (471000)` };
    }

    return { num: '471000', libelle: `Compte d'attente (471000)` };
  }

  function recupererToutesLesTransactions() {
    let txs = window.listeTransactions || window.transactions || [];
    if (!Array.isArray(txs) || txs.length === 0) {
      try {
        const local = localStorage.getItem('transactions') || localStorage.getItem('compta_transactions');
        if (local) txs = JSON.parse(local);
      } catch (e) {}
    }
    return Array.isArray(txs) ? txs : [];
  }

  function calculerBalanceComptable(transactions = [], anneeCible = new Date().getFullYear()) {
    const comptes = {};

    function ajouterEcriture(num, libelle, debit, credit) {
      if (!comptes[num]) {
        comptes[num] = { num: num, libelle: libelle, debit: 0, credit: 0 };
      }
      comptes[num].debit += debit;
      comptes[num].credit += credit;
    }

    transactions.forEach(tx => {
      const txAnnee = extraireAnnee(tx.date) || anneeCible;

      if (txAnnee === anneeCible) {
        const m = parseMontant(tx.amount || tx.montant);
        const type = (tx.type || '').toLowerCase();
        const { num, libelle } = determinerCompteEtLibelle(tx.category, type, tx.description);

        if (type === 'recette') {
          // Si la description spécifie un compte 411, l'écriture se fait sur le 411
          if (num === '411000') {
            ajouterEcriture('411000', libelle, 0, m);
            ajouterEcriture('512000', 'Banque (512000)', m, 0);
          } else {
            ajouterEcriture(num, libelle, 0, m);
            ajouterEcriture('512000', 'Banque (512000)', m, 0);
          }
        } else if (type === 'depense') {
          ajouterEcriture(num, libelle, m, 0);
          ajouterEcriture('512000', 'Banque (512000)', 0, m);
        } else if (type === 'od') {
          // Traitement des Opérations Diverses
          ajouterEcriture(num, libelle, m, 0);
          ajouterEcriture('512000', 'Banque (512000)', 0, m);
        }
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

  async function afficherBalanceFinale() {
    let conteneur = document.getElementById('vue-balance') || 
                    document.getElementById('balance-container') ||
                    document.getElementById('balance');

    if (!conteneur) {
      const main = document.querySelector('main') || document.querySelector('.content') || document.body;
      conteneur = main;
    }

    let transactions = recupererToutesLesTransactions();

    if (transactions.length === 0 && window.supabaseClient) {
      try {
        const { data } = await window.supabaseClient.from('transactions').select('*');
        if (data && data.length > 0) {
          transactions = data;
          window.listeTransactions = data;
        }
      } catch (e) {}
    }

    const annees = Array.from(new Set([new Date().getFullYear(), ...transactions.map(t => extraireAnnee(t.date)).filter(Boolean)])).sort((a,b)=>b-a);
    const anneeActive = parseInt(window.anneeBalanceSelectionnee, 10);
    const { comptes, totaux } = calculerBalanceComptable(transactions, anneeActive);

    conteneur.innerHTML = `
      <div class="space-y-4 bg-white p-5 rounded-xl shadow-sm border border-slate-200 max-w-6xl mx-auto my-4">
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
                <th class="py-3 px-4 w-24">Numéro</th>
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
                    Aucune écriture enregistrée pour l'exercice ${anneeActive}.
                  </td>
                </tr>
              ` : comptes.map(c => `
                <tr class="hover:bg-slate-50/50 transition">
                  <td class="py-3 px-4 font-bold text-slate-800">${c.num}</td>
                  <td class="py-3 px-4 text-slate-600">${c.libelle}</td>
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

  window.changerAnneeBalance = function(annee) {
    window.anneeBalanceSelectionnee = parseInt(annee, 10);
    afficherBalanceFinale();
  };

  window.initBalanceModule = afficherBalanceFinale;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', afficherBalanceFinale);
  } else {
    afficherBalanceFinale();
  }
})();
