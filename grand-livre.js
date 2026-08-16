// grand_livre.js - Chargement dynamique sécurisé et ventilation auxiliaire

(function () {
    function getSupabaseClient() {
        return window.supabaseClient || (window.supabase && typeof window.supabase.from === 'function' ? window.supabase : null);
    }

    let state = {
        transactions: [],
        planComptable: [],
        compteFiltre: 'TOUS'
    };

    // Détection précise du bloc "Chargement du grand livre..."
    function trouverConteneurGrandLivre() {
        const elements = document.querySelectorAll('div, section, main');
        for (let i = elements.length - 1; i >= 0; i--) {
            const el = elements[i];
            if (el.children.length <= 4 && el.textContent.includes('Chargement du grand livre...')) {
                return el;
            }
        }
        return document.getElementById('grand-livre-content') || document.querySelector('.card');
    }

    async function initGrandLivre() {
        const container = trouverConteneurGrandLivre();
        if (!container) return;

        // Injection du tableau dans la carte du Grand Livre uniquement
        container.innerHTML = `
            <div style="padding: 10px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 10px;">
                    <h2 style="font-size: 1.25rem; font-weight: bold; margin: 0; color: #1f2937;">Grand Livre</h2>
                    <div style="min-width: 280px;">
                        <label for="filtreCompte" style="font-weight: 600; font-size: 0.875rem; margin-right: 8px; color: #374151;">Filtrer par compte :</label>
                        <select id="filtreCompte" style="padding: 6px 12px; border: 1px solid #d1d5db; border-radius: 6px; width: 100%; background-color: #fff;">
                            <option value="TOUS">Tous les comptes (Vue globale)</option>
                        </select>
                    </div>
                </div>

                <div style="overflow-x: auto;">
                    <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.9rem;">
                        <thead>
                            <tr style="background-color: #f9fafb; border-bottom: 2px solid #e5e7eb;">
                                <th style="padding: 10px; color: #4b5563;">Date</th>
                                <th style="padding: 10px; color: #4b5563;">Compte</th>
                                <th style="padding: 10px; color: #4b5563;">Catégorie</th>
                                <th style="padding: 10px; color: #4b5563;">Description</th>
                                <th style="padding: 10px; text-align: right; color: #4b5563;">Débit (€)</th>
                                <th style="padding: 10px; text-align: right; color: #4b5563;">Crédit (€)</th>
                            </tr>
                        </thead>
                        <tbody id="grandLivreTableBody">
                            <tr><td colspan="6" style="text-align: center; padding: 20px; color: #6b7280;">Chargement des données Supabase...</td></tr>
                        </tbody>
                        <tfoot>
                            <tr style="border-top: 2px solid #e5e7eb; font-weight: bold; background: #f9fafb;">
                                <td colspan="4" style="text-align: right; padding: 10px; color: #374151;">Totaux :</td>
                                <td id="totalDebit" style="text-align: right; padding: 10px; color: #16a34a;">0.00 €</td>
                                <td id="totalCredit" style="text-align: right; padding: 10px; color: #dc2626;">0.00 €</td>
                            </tr>
                            <tr style="font-weight: bold; background: #f3f4f6;">
                                <td colspan="4" style="text-align: right; padding: 10px; color: #111827;">Solde Général :</td>
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

    // Ventilation automatique des comptes auxiliaires 411
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
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 20px; color: #6b7280;">Aucune opération enregistrée pour ce filtre.</td></tr>';
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
            tr.style.borderBottom = '1px solid #f3f4f6';
            tr.innerHTML = `
                <td style="padding: 8px 10px;">${tx.date || '-'}</td>
                <td style="padding: 8px 10px;"><strong>${c.code}</strong></td>
                <td style="padding: 8px 10px;">${tx.categorie || '-'}</td>
                <td style="padding: 8px 10px;">${tx.description || '-'}</td>
                <td style="padding: 8px 10px; text-align: right; color: #16a34a; font-weight: 500;">${debit > 0 ? debit.toFixed(2) + ' €' : '-'}</td>
                <td style="padding: 8px 10px; text-align: right; color: #dc2626; font-weight: 500;">${credit > 0 ? credit.toFixed(2) + ' €' : '-'}</td>
            `;
            tbody.appendChild(tr);
        });

        if (totalDebitEl) totalDebitEl.textContent = totalDebit.toFixed(2) + ' €';
        if (totalCreditEl) totalCreditEl.textContent = totalCredit.toFixed(2) + ' €';
        if (soldeGlobalEl) {
            const solde = totalDebit - totalCredit;
            soldeGlobalEl.textContent = solde.toFixed(2) + ' €';
            soldeGlobalEl.style.color = solde >= 0 ? '#16a34a' : '#dc2626';
        }
    }

    window.initGrandLivre = initGrandLivre;

    // Déclenchement automatique au chargement et au clic sur l'onglet Grand Livre
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        setTimeout(initGrandLivre, 100);
    } else {
        document.addEventListener('DOMContentLoaded', initGrandLivre);
    }

    document.addEventListener('click', (e) => {
        if (e.target && e.target.textContent && e.target.textContent.includes('Grand Livre')) {
            setTimeout(initGrandLivre, 100);
        }
    });
})();
