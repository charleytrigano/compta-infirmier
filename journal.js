// Script pour la vue "Transactions"

(function () {
    function getSupabase() {
        return window.supabaseClient || (window.supabase && typeof window.supabase.from === 'function' ? window.supabase : null);
    }

    function formatEuro(amount) {
        return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount || 0);
    }

    /**
     * Charge et regroupe les transactions depuis ecritures_comptables
     */
    async function chargerHistoriqueTransactions() {
        const vueTrans = document.getElementById('vue-transactions') || document.querySelector('[data-view="transactions"]');
        const tbody = document.getElementById('body-tableau-transactions') || (vueTrans ? vueTrans.querySelector('tbody') : document.querySelector('tbody'));

        if (!tbody) return;

        const supabase = getSupabase();
        if (!supabase) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #ef4444; padding: 15px;">Erreur : Client Supabase non connecté.</td></tr>`;
            return;
        }

        try {
            const { data, error } = await supabase
                .from('ecritures_comptables')
                .select('*')
                .order('date', { ascending: false });

            if (error) {
                tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #ef4444; padding: 15px;">Erreur : ${error.message}</td></tr>`;
                return;
            }

            if (!data || data.length === 0) {
                tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #94a3b8; padding: 20px;">Aucune transaction enregistrée.</td></tr>`;
                return;
            }

            // Regroupement par transaction_id (ou affichage ligne par ligne)
            const transactionsMap = new Map();

            data.forEach(row => {
                const key = row.transaction_id || row.id;
                const debit = parseFloat(row.debit || 0);
                const credit = parseFloat(row.credit || 0);

                if (!transactionsMap.has(key)) {
                    const isRecette = debit > 0 || (row.description && row.description.toLowerCase().includes('encaissement'));
                    transactionsMap.set(key, {
                        id: row.id,
                        transaction_id: row.transaction_id,
                        date: row.date,
                        type: isRecette ? 'Recette' : 'Dépense',
                        categorie: row.category || 'Soins infirmiers',
                        description: row.description ? row.description.replace(/^(Encaissement : |Décaissement : |Règlement soins : )/, '') : '-',
                        montant: debit || credit
                    });
                }
            });

            const transactions = Array.from(transactionsMap.values());

            const html = transactions.map(t => {
                const isRecette = t.type === 'Recette';
                const typeBadge = isRecette
                    ? `<span style="background: #dcfce7; color: #15803d; padding: 3px 8px; border-radius: 4px; font-weight: 600; font-size: 0.8rem;">Recette</span>`
                    : `<span style="background: #fee2e2; color: #b91c1c; padding: 3px 8px; border-radius: 4px; font-weight: 600; font-size: 0.8rem;">Dépense</span>`;

                return `
                    <tr style="border-bottom: 1px solid #f1f5f9;">
                        <td style="padding: 10px; color: #334155;">${t.date || '-'}</td>
                        <td style="padding: 10px;">${typeBadge}</td>
                        <td style="padding: 10px; color: #475569;">${t.categorie}</td>
                        <td style="padding: 10px; color: #1e293b; font-weight: 500;">${t.description}</td>
                        <td style="padding: 10px; text-align: right; font-weight: 600; color: ${isRecette ? '#16a34a' : '#dc2626'};">
                            ${formatEuro(t.montant)}
                        </td>
                        <td style="padding: 10px; text-align: center;">
                            <button onclick="window.supprimerTransaction('${t.id}', '${t.transaction_id}')" style="background: none; border: none; color: #ef4444; cursor: pointer;" title="Supprimer">🗑️</button>
                        </td>
                    </tr>
                `;
            }).join('');

            tbody.innerHTML = html;

        } catch (err) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #ef4444; padding: 15px;">Erreur : ${err.message}</td></tr>`;
        }
    }

    /**
     * Supprimer une transaction globale
     */
    async function supprimerTransaction(id, transactionId) {
        if (!confirm("Voulez-vous supprimer cette transaction ?")) return;

        const supabase = getSupabase();
        if (!supabase) return;

        let query = supabase.from('ecritures_comptables').delete();
        if (transactionId && transactionId !== 'undefined' && transactionId !== '') {
            query = query.eq('transaction_id', transactionId);
        } else {
            query = query.eq('id', id);
        }

        const { error } = await query;
        if (error) {
            alert("Erreur lors de la suppression : " + error.message);
        } else {
            await chargerHistoriqueTransactions();
        }
    }

    window.chargerHistoriqueTransactions = chargerHistoriqueTransactions;
    window.supprimerTransaction = supprimerTransaction;

    // Écouteur sur l'onglet Transactions
    document.addEventListener('click', (e) => {
        const el = e.target.closest('button, a, div');
        if (el && el.textContent && el.textContent.trim().toLowerCase() === 'transactions') {
            setTimeout(chargerHistoriqueTransactions, 100);
        }
    });

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        setTimeout(chargerHistoriqueTransactions, 200);
    } else {
        document.addEventListener('DOMContentLoaded', chargerHistoriqueTransactions);
    }
})();
