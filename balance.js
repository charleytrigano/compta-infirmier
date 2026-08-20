/**
 * balance.js - Correction du mapping automatique par catégorie
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

  // Dictionnaire de correspondance Catégorie -> Compte PCG 2035
  function determinerCompteEtLibelle(category, type, description) {
    const catClean = (category || '').toLowerCase().trim();
    const descClean = (description || '').toLowerCase().trim();

    if (type === 'recette' || catClean.includes('soins') || catClean.includes('honoraire') || catClean.includes('tiers')) {
      return { num: '706000', libelle: 'Honoraires conventionnés (706000)' };
    }

    // Mapping des dépenses
    if (catClean.includes('urssaf') || descClean.includes('urssaf')) {
      return { num: '645000', libelle: 'Charges sociales / URSSAF (645000)' };
    }
    if (catClean.includes('carpimko') || descClean.includes('carpimko')) {
      return { num: '646000', libelle: 'Cotisations retraite CARPIMKO (646000)' };
    }
    if (catClean.includes('fourniture') || catClean.includes('materiel') || catClean.includes('pharmacie') || catClean.includes('soin')) {
      return { num: '606000', libelle: 'Achats de fournitures / Petit matériel (606000)' };
    }
    if (catClean.includes('loyer') || catClean.includes('location') || catClean.includes('bureau')) {
      return { num: '613000', libelle: 'Locations immobilières / Charges (613000)' };
    }
    if (catClean.includes('assurance') || catClean.includes('rcp')) {
      return { num: '616000', libelle: 'Assurances professionnelles (616000)' };
    }
    if (catClean.includes('banque') || catClean.includes('frais banc')) {
      return { num: '627000', libelle: 'Frais bancaires (627000)' };
    }
    if (catClean.includes('deplacement') || catClean.includes('carburant') || catClean.includes('auto') || catClean.includes('km')) {
      return { num: '625100', libelle: 'Frais de déplacements / Carburant (625100)' };
    }
    if (catClean.includes('compta') || catClean.includes('expert') || catClean.includes('honoraires divers')) {
      return { num: '622600', libelle: 'Honoraires comptables et juridiques (622600)' };
    }
    if (catClean.includes('telephone') || catClean.includes('internet') || catClean.includes('frais postaux')) {
      return { num: '626000', libelle: 'Frais postaux et télécommunications (626000)' };
    }
    if (catClean.includes('formation')) {
      return { num: '618000', libelle: 'Documentation et formation (618000)' };
    }

    // Par défaut si non catégorisé
    if (type === 'depense') {
      return { num: '606800', libelle: `Autres charges - ${category || 'Divers'} (606800)` };
    }
    
    return { num: '471000', libelle: `Compte d'attente - ${category || 'Divers'} (471000)` };
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

    transactions.forEach(tx => {
      const txAnnee = extraireAnnee(tx.date) || anneeCible;

      if (txAnnee === anneeCible) {
        const m = parseMontant(tx.amount || tx.montant);
        const type = (tx.type || '').toLowerCase();
        
        const { num, libelle } = determinerCompteEtLibelle(tx.category, type, tx.description);

        if (!comptes[num]) {
          comptes[num] = { num: num, libelle: libelle, debit: 0, credit: 0 };
        }

        if (type === 'recette') {
          comptes[num].credit += m;
        } else {
          comptes[num].debit += m;
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
