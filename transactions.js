// transactions.js - Gestion du tableau UI et synchronisation Supabase

(function () {
    function getSupabase() {
        return window.supabaseClient || (window.supabase && typeof window.supabase.from === 'function' ? window.supabase : null);
    }

    async function chargerEtAfficherTransactions() {
        const supabase = getSupabase();
        if (!supabase) return;

        // 1. Récupération des transactions depuis Supabase
        const { data: transactions, error } = await supabase
            .from('transactions')
            .select('*')
            .order('date', { ascending: false });

        if (error) {
            console.error("Erreur de chargement des transactions :", error);
            return;
        }

        afficherTableauUI(transactions || []);
    }

    function afficherTableauUI(liste) {
        // Ciblage dynamique du <tbody> de l'historique
        let tbody = document.querySelector('table tbody');
        
        if (!tbody) {
            const table = document.querySelector('table');
            if (table) {
                tbody = document.createElement('tbody');
                table.appendChild(tbody);
            }
        }

        if (!tbody) return;

        tbody.innerHTML = '';

        if (liste.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 20px; color: #6b7280;">Aucune transaction enregistrée dans Supabase.</td></tr>`;
            return;
        }

        liste.forEach(tx => {
            const tr = document.createElement('tr');
            tr.style.borderBottom = '1px solid #e2e8f0';

            const typeStr = String(tx.type || '').toLowerCase();
            const isRecette = typeStr.includes('recette') || typeStr.includes('rec');
            const montantVal = Math.abs(parseFloat(tx.amount || tx.montant || 0)).toFixed(2);

            tr.innerHTML = `
                <td style="padding: 10px 12px; color: #334155;">${tx.date || '-'}</td>
                <td style="padding: 10px 12px;">
                    <span style="background-color: ${isRecette ? '#dcfce7' : '#fee2e2'}; color: ${isRecette ? '#15803d' : '#b91c1c'}; padding: 3px 8px; border-radius: 4px; font-weight: 600; font-size: 0.8rem;">
                        ${tx.type || (isRecette ? 'Recette' : 'Dépense')}
                    </span>
                </td>
                <td style="padding: 10px 12px; color: #334155;">${tx.category || tx.categorie || '-'}</td>
                <td style="padding: 10px 12px; color: #334155;">${tx.description || '-'}</td>
                <td style="padding: 10px 12px; font-weight: bold; color: ${isRecette ? '#16a34a' : '#dc2626'}; text-align: right;">
                    ${isRecette ? '+' : '-'}${montantVal} €
                </td>
                <td style="padding: 10px 12px; text-align: center;">
                    <button onclick="supprimerTransaction('${tx.id}')" style="background-color: #ef4444; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; font-size: 0.75rem;">
                        Supprimer
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    // Gestion de la suppression
    window.supprimerTransaction = async function(id) {
        if (!confirm("Voulez-vous vraiment supprimer cette transaction ?")) return;
        const supabase = getSupabase();
        if (!supabase) return;

        await supabase.from('transactions').delete().eq('id', id);
        await supabase.from('ecritures_comptables').delete().eq('transaction_id', id);
        
        chargerEtAfficherTransactions();
    };

    window.chargerEtAfficherTransactions = chargerEtAfficherTransactions;

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        setTimeout(chargerEtAfficherTransactions, 200);
    } else {
        document.addEventListener('DOMContentLoaded', chargerEtAfficherTransactions);
    }
})();
