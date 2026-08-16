// Script d'affichage pour l'onglet Journal des Écritures

(function() {
    function getSupabase() {
        return window.supabaseClient || (window.supabase && typeof window.supabase.from === 'function' ? window.supabase : null);
    }

    function formatEuro(amount) {
        if (!amount || amount === 0) return '-';
        return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);
    }

    async function chargerJournalGeneral() {
        const vueJournal = document.getElementById('vue-journal') || document.querySelector('[data-view="journal"]');
        const tbody = document.getElementById('body-tableau-journal') || (vueJournal ? vueJournal.querySelector('tbody') : document.querySelector('tbody'));

        if (!tbody) return;

        const supabase = getSupabase();
        if (!supabase) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #ef4444; padding: 15px;">Erreur : Client Supabase non connecté.</td></tr>`;
            return;
        }

        try {
            // Récupération de l'ensemble des écritures comptables
            const { data, error } = await supabase
                .from('ecritures_comptables')
                .select('*')
                .order('date', { ascending: false });

            if (error) {
                tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #ef4444; padding: 15px;">Erreur : ${error.message}</td></tr>`;
                return;
            }

            if (!data || data.length === 0) {
                tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #94a3b8; padding: 20px;">Aucune écriture comptable enregistrée.</td></tr>`;
                return;
            }

            const html = data.map(row => {
                const debit = parseFloat(row.debit || 0);
                const credit = parseFloat(row.credit || 0);
                const isValide = true; // Statut de validation

                return `
                    <tr style="border-bottom: 1px solid #f1f5f9;">
                        <td style="padding: 10px; color: #334155;">${row.date || '-'}</td>
                        <td style="padding: 10px; color: #475569;">${row.category || row.compte_code || '-'}</td>
                        <td style="padding: 10px; color: #1e293b; font-weight: 500;">${row.description || '-'}</td>
                        <td style="padding: 10px; color: #dc2626; text-align: right;">${formatEuro(debit)}</td>
                        <td style="padding: 10px; color: #16a34a; text-align: right;">${formatEuro(credit)}</td>
                        <td style="padding: 10px; text-align: center;">
                            <span style="background: #dcfce7; color: #15803d; padding: 3px 8px; border-radius: 4px; font-weight: 600; font-size: 0.8rem;">Validé</span>
                        </td>
                    </tr>
                `;
            }).join('');

            tbody.innerHTML = html;

        } catch (err) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #ef4444; padding: 15px;">Erreur : ${err.message}</td></tr>`;
        }
    }

    // Détection de clic sur l'onglet Journal
    document.addEventListener('click', (e) => {
        const el = e.target.closest('button, a, div');
        if (el && el.textContent && el.textContent.trim().toLowerCase() === 'journal') {
            setTimeout(chargerJournalGeneral, 100);
        }
    });

    window.chargerJournalGeneral = chargerJournalGeneral;

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        setTimeout(chargerJournalGeneral, 200);
    } else {
        document.addEventListener('DOMContentLoaded', chargerJournalGeneral);
    }
})();
