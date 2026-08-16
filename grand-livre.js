// grand_livre.js - Mapping réel avec le Plan Comptable général libéral (BNC)

(function () {
    function getSupabaseClient() {
        return window.supabaseClient || (window.supabase && typeof window.supabase.from === 'function' ? window.supabase : null);
    }

    let state = {
        transactions: [],
        compteFiltre: 'TOUS'
    };

    // Table de correspondance officielle des catégories vers les numéros de comptes
    const MAPPING_COMPTES = {
        'soins infirmiers': { code: '706000', nom: 'Prestations de services / Honoraires (706000)' },
        'carpimko': { code: '646000', nom: 'Cotisations sociales CARPIMKO (646000)' },
        'urssaf': { code: '645000', nom: 'Cotisations URSSAF (645000)' },
        'achats': { code: '606000', nom: 'Achats de matériel et fournitures (606000)' },
        'frais de deplacement': { code: '625100', nom: 'Frais de déplacement / Carburant (625100)' },
        'frais bancaires': { code: '627000', nom: 'Frais bancaires (627000)' },
        'loyer': { code: '613200', nom: 'Loyer professionnel (613200)' },
        'assurance': { code: '616000', nom: 'Primes d\'assurances (616000)' }
    };

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

        container.innerHTML = `
            <div style="padding: 10px;">
                <div style="display: flex; justify-content: flex-end; align-items: center; margin-bottom: 15px;">
                    <div style="min-width: 320px; display: flex; align-items: center; gap: 8px;">
                        <label for="filtreCompte" style="font-weight: 600; font-size: 0.875rem; color: #374151; white-space: nowrap;">Filtrer par compte :</label>
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
                            <tr><td colspan="6" style="text-align: center; padding: 20px; color: #6b7280;">Chargement des données...</td></tr>
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
                state.transactions = txData || [];
            } catch (err) {
                state.transactions = JSON.parse(localStorage.getItem('transactions') || '[]');
            }
        } else {
            state.transactions = JSON.parse(localStorage.getItem('transactions') || '[]');
        }
    }

    function determinerCompte(tx) {
        if (tx.compte_code && tx.compte_code !== '411000') {
            return { code: tx.compte_code, nom: `${tx.compte_code} - ${tx.category || tx.categorie}` };
        }

        const cat = (tx.category || tx.categorie || '').toLowerCase();
        
        for (const key in MAPPING_COMPTES) {
            if (cat.includes(key)) {
                return MAPPING_COMPTES[key];
            }
        }

        // Si c'est un client/patient spécifique (ex: Tiers payant / Patient Abadie)
        const desc = (tx.description || '').trim();
        if (desc && (cat.includes('soins') || tx.type === 'recette')) {
            return { code: `411 ${desc}`, nom: `411 ${desc} (Compte auxiliaire Client)` };
        }

        return { code: '471000', nom: '471000 - Compte d\'attente / Divers' };
    }

    function extraireMontants(tx) {
        const val = Math.abs(parseFloat(tx.amount || tx.montant || 0));
        const type = (tx.type || '').toLowerCase();

        if (type.includes('recette') || type.includes('rec')) {
            return { debit: val, credit: 0 };
        } else {
            return { debit: 0, credit: val };
        }
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
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 20px; color: #6b7280;">Aucune opération trouvée.</td></tr>';
            if (totalDebitEl) totalDebitEl.textContent = '0.00 €';
            if (totalCreditEl) totalCreditEl.textContent = '0.00 €';
            if (soldeGlobalEl) soldeGlobalEl.textContent = '0.00 €';
            return;
        }

        txs.forEach(tx => {
            const c = determinerCompte(tx);
            const { debit, credit } = extraireMontants(tx);

            totalDebit += debit;
            totalCredit += credit;

            const tr = document.createElement('tr');
            tr.style.borderBottom = '1px solid #f3f4f6';
            tr.innerHTML = `
                <td style="padding: 8px 10px;">${tx.date || '-'}</td>
                <td style="padding: 8px 10px;"><strong>${c.code}</strong></td>
                <td style="padding: 8px 10px;">${tx.category || tx.categorie || '-'}</td>
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
