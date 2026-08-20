/**
 * balance.js - Lecture directe de la table ecritures_comptables
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

  async function recupererToutesLesEcritures() {
    // 1. Regarder en mémoire locale
    let ecritures = window.listeEcritures || window.ecrituresComptables || [];
    if (!Array.isArray(ecritures) || ecritures.length === 0) {
      try {
        const local = localStorage.getItem('ecritures_comptables') || localStorage.getItem('ecritures');
        if (local) ecritures = JSON.parse(local);
      } catch (e) {}
    }

    // 2. Interroger directement Supabase (table ecritures_comptables)
    if ((!ecritures || ecritures.length === 0) && window.supabaseClient) {
      try {
        const { data, error } = await window.supabaseClient.from('ecritures_comptables').select('*');
        if (!error && data && data.length > 0) {
          ecritures = data;
          window.listeEcritures = data;
        }
      } catch (e) {}
    }

    return Array.isArray(ecritures) ? ecritures : [];
  }

  function calculerBalanceComptable(ecritures = [], anneeCible = new Date().getFullYear()) {
    const comptes = {};

    ecritures.forEach(e => {
      const eAnnee = extraireAnnee(e.date) || anneeCible;

      if (eAnnee === anneeCible) {
        const code = e.compte_code || '471000';
        const libelle = e.compte_libelle || e.description || `Compte ${code}`;
        const debit = parseMontant(e.debit);
        const credit = parseMontant(e.credit);

        if (!comptes[code]) {
          comptes[code] = { num: code, libelle: libelle, debit: 0, credit: 0 };
        }

        comptes[code].debit += debit;
        comptes[code].credit += credit;
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

    const ecritures = await recupererToutesLesEcritures();
    const annees = Array.from(new Set([new Date().getFullYear(), ...ecritures.map(e => extraireAnnee(e.date)).filter(Boolean)])).sort((a,b)=>b-a);
    const anneeActive = parseInt(window.anneeBalanceSelectionnee, 10);
    const { comptes, totaux } = calculerBalanceComptable(ecritures, anneeActive);

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
                    Aucune écriture enregistrée dans le Grand Livre pour l'exercice ${anneeActive}.
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
