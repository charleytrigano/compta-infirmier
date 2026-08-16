// grand_livre.js - Version sécurisée (ne touche qu'à sa propre zone)

(function () {
    function getSupabaseClient() {
        return window.supabaseClient || (window.supabase && typeof window.supabase.from === 'function' ? window.supabase : null);
    }

    let state = {
        transactions: [],
        planComptable: [],
        compteFiltre: 'TOUS'
    };

    async function initGrandLivre() {
        // Cible un conteneur spécifique au Grand Livre (ex: #grand-livre-content ou .main-content)
        const container = document.getElementById('grand-livre-content') || document.querySelector('main') || document.body.firstElementChild;
        
        if (!container) {
            console.error("❌ Conteneur du Grand Livre introuvable.");
            return;
        }

        container.innerHTML = `
            <div style="padding: 20px; background: white; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); margin-top: 20px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 10px;">
                    <h2 style="font-size: 1.25rem; font-weight: bold; margin: 0;">Grand Livre</h2>
                    <div style="min-width: 280px;">
                        <label for="filtreCompte" style="font-weight: 600; font-size: 0.875rem; margin-right: 8px;">Filtrer par compte :</label>
                        <select id="filtreCompte" style="padding: 6px 12px; border: 1px solid #ccc; border-radius: 6px; width: 100%;">
                            <option value="TOUS">Tous les comptes (Vue globale)</option>
                        </select>
                    </div>
                </div>

                <div style="overflow-x: auto;">
                    <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.9rem;">
                        <thead>
                            <tr style="background-color: #f8f9fa; border-bottom: 2px solid #dee2e6;">
                                <th style="padding: 10px;">Date</th>
                                <th style="padding: 10px;">Compte</th>
                                <th style="padding: 10px;">Catégorie</th>
                                <th style="padding: 10px;">Description</th>
                                <th style="padding: 10px; text-align: right;">Débit (€)</th>
                                <th style="padding: 10px; text-align: right;">Crédit (€)</th>
                            </tr>
                        </thead>
                        <tbody id="grandLivreTableBody">
                            <tr><td colspan="6" style="text-align: center; padding: 20px;">Chargement des données...</td></tr>
                        </tbody>
                        <tfoot>
                            <tr style="border-top: 2px solid #dee2e6; font-weight: bold; background: #fafafa;">
                                <td colspan="4" style="text-align: right; padding: 10px;">Totaux :</td>
                                <td id="totalDebit" style="text-align: right; padding: 10px; color: #2e7d32;">0.00 €</td>
                                <td id="totalCredit" style="text-align: right; padding: 10px; color: #c62828;">0.00 €</td>
                            </tr>
                            <tr style="font-weight: bold; background: #f0f4f8;">
                                <td colspan="4" style="text-align: right; padding: 10px;">Solde Général :</td>
                                <td id="soldeGlobal" colspan="2" style="text-align: right; padding: 10px; font-size: 1rem;">0.00 €</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        `;

        await chargerDonnees();
        initialiserFiltres();
        afficherGrandLivre();
    }

    async function chargerDonnees() {
        const supabase = getSupabaseClient();
        if (supabase) {
            try {
                const { data: txData } = await supabase.from('transactions').select('*').order('date', { ascending: true });
                state.transactions = txData || JSON.parse(localStorage.getItem('transactions') || '[]');

                const { data: planData } = await supabase.from('plan_comptable').select('*');
                state.planComptable = planData || JSON.parse(localStorage.getItem('plan_comptable') || '[]');
            } catch (err) {
                recupererLocal();
            }
        } else {
            recupererLocal();
        }
    }

    function recupererLocal() {
        state.transactions = JSON.parse(localStorage.getItem('transactions') || '[]');
        state.planComptable = JSON.parse(localStorage.getItem('plan_comptable') || '[]');
    }

    function determinerCompte(tx) {
        let code = tx.compte_code || '411000';
        let nom = tx.categorie || 'Soins infirmiers';

        if (code === '411000' || tx.type === 'Recette' || nom === 'Soins infirmiers') {
            const desc = (tx.description || '').trim();
            if (desc) {
                code = desc.startsWith('411') ? desc : `411 ${desc}`;
                nom = `411 ${desc} (Patient / Tiers)`;
            }
        }
        return { code, nom };
    }

    function initialiserFiltres() {
        const select = document.getElementById('filtreCompte');
        if (!select) return;

        const comptesMap = new Map();
        state.transactions.forEach(tx => {
            const c = determinerCompte(tx);
            if (!comptesMap.has(c.code)) comptesMap.set(c.code, c.nom);
        });

        select.innerHTML = '<option value="TOUS">Tous les comptes (Vue globale)</option>';
        Array.from(comptesMap.entries())
            .sort((a, b) => a[0].localeCompare(b[0]))
            .forEach(([code, nom]) => {
                const opt = document.createElement('option');
                opt.value = code;
                opt.textContent = `${code} - ${nom}`;
                select.appendChild(opt);
            });

        select.addEventListener('change', (e) => {
            state.compteFiltre = e.target.value;
            afficherGrandLivre();
        });
    }

    function afficherGrandLivre() {
        const tbody = document.getElementById('grandLivreTableBody');
        const totalDebitEl = document.getElementById('totalDebit');
        const totalCreditEl = document.getElementById('totalCredit');
        const soldeGlobalEl = document.getElementById('soldeGlobal');

        if (!tbody) return;
        tbody.innerHTML = '';

        let totalDebit = 0;
        let totalCredit = 0;

        const txs = state.transactions.filter(tx => {
            if (state.compteFiltre === 'TOUS') return true;
            return determinerCompte(tx).code === state.compteFiltre;
        });

        if (txs.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 20px;">Aucune opération trouvée.</td></tr>';
            if (totalDebitEl) totalDebitEl.textContent = '0.00 €';
            if (totalCreditEl) totalCreditEl.textContent = '0.00 €';
            if (soldeGlobalEl) soldeGlobalEl.textContent = '0.00 €';
            return;
        }

        txs.forEach(tx => {
            const c = determinerCompte(tx);
            const m = parseFloat(tx.montant) || 0;
            const isRecette = tx.type === 'Recette';
            const debit = isRecette ? m : 0;
            const credit = !isRecette ? m : 0;

            totalDebit += debit;
            totalCredit += credit;

            const tr = document.createElement('tr');
            tr.style.borderBottom = '1px solid #eee';
            tr.innerHTML = `
                <td style="padding: 8px 10px;">${tx.date || '-'}</td>
                <td style="padding: 8px 10px;"><strong>${c.code}</strong></td>
                <td style="padding: 8px 10px;">${tx.categorie || '-'}</td>
                <td style="padding: 8px 10px;">${tx.description || '-'}</td>
                <td style="padding: 8px 10px; text-align: right; color: #2e7d32;">${debit > 0 ? debit.toFixed(2) + ' €' : '-'}</td>
                <td style="padding: 8px 10px; text-align: right; color: #c62828;">${credit > 0 ? credit.toFixed(2) + ' €' : '-'}</td>
            `;
            tbody.appendChild(tr);
        });

        if (totalDebitEl) totalDebitEl.textContent = totalDebit.toFixed(2) + ' €';
        if (totalCreditEl) totalCreditEl.textContent = totalCredit.toFixed(2) + ' €';
        if (soldeGlobalEl) {
            const solde = totalDebit - totalCredit;
            soldeGlobalEl.textContent = solde.toFixed(2) + ' €';
            soldeGlobalEl.style.color = solde >= 0 ? '#2e7d32' : '#c62828';
        }
    }

    window.initGrandLivre = initGrandLivre;
})();
