// balance.js - Module d'affichage de la Balance des Comptes

(function () {
    function getSupabase() {
        return window.supabaseClient || (window.supabase && typeof window.supabase.from === 'function' ? window.supabase : null);
    }

    function formatEuro(amount) {
        return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount || 0);
    }

    async function chargerEtAfficherBalance() {
        const container = document.getElementById('balance-contenu');
        if (!container) return;

        const supabase = getSupabase();
        let ecritures = [];

        if (supabase) {
            try {
                const { data: ecrData } = await supabase.from('ecritures_comptables').select('*');
                if (ecrData && ecrData.length > 0) {
                    ecritures = ecrData;
                } else {
                    const { data: txData } = await supabase.from('transactions').select('*');
                    ecritures = txData || [];
                }
            } catch (err) {
                console.error("Erreur Supabase Balance:", err);
            }
        }

        if (!ecritures || ecritures.length === 0) {
            container.innerHTML = `
                <div style="padding: 20px;">
                    <p style="color: #64748b; background: #f8fafc; padding: 20px; border-radius: 6px; border: 1px solid #e2e8f0; text-align: center;">
                        Aucune donnée disponible pour établir la balance.
                    </p>
                </div>`;
            return;
        }

        const comptes = {};

        ecritures.forEach(row => {
            let code = String(row.compte_code || row.account_number || '').trim();
            if (!code) {
                const desc = String(row.description || row.category || '');
                const match = desc.match(/^([0-9]{3,6})/);
                code = match ? match[1] : (row.type === 'recette' ? '706000' : '600000');
            }

            if (!comptes[code]) {
                comptes[code] = {
                    code: code,
                    libelle: row.compte_libelle || row.category || ('Compte ' + code),
                    debit: 0,
                    credit: 0
                };
            }

            let debit = parseFloat(row.debit || 0);
            let credit = parseFloat(row.credit || 0);

            if (!row.debit && !row.credit && row.amount) {
                const val = Math.abs(parseFloat(row.amount));
                if (row.type === 'recette') credit = val;
                else debit = val;
            }

            comptes[code].debit += debit;
            comptes[code].credit += credit;
        });

        let totalDebit = 0;
        let totalCredit = 0;
        let totalSoldeDebiteur = 0;
        let totalSoldeCrediteur = 0;

        let rowsHtml = '';

        Object.keys(comptes).sort().forEach(code => {
            const c = comptes[code];
            const solde = c.debit - c.credit;
            const soldeDebiteur = solde > 0 ? solde : 0;
            const soldeCrediteur = solde < 0 ? Math.abs(solde) : 0;

            totalDebit += c.debit;
            totalCredit += c.credit;
            totalSoldeDebiteur += soldeDebiteur;
            totalSoldeCrediteur += soldeCrediteur;

            rowsHtml += `
                <tr style="border-bottom: 1px solid #e2e8f0;">
                    <td style="padding: 10px 12px; font-weight: 600; color: #1e293b;">${c.code}</td>
                    <td style="padding: 10px 12px; color: #334155;">${c.libelle}</td>
                    <td style="padding: 10px 12px; text-align: right; color: #dc2626;">${c.debit > 0 ? formatEuro(c.debit) : '-'}</td>
                    <td style="padding: 10px 12px; text-align: right; color: #16a34a;">${c.credit > 0 ? formatEuro(c.credit) : '-'}</td>
                    <td style="padding: 10px 12px; text-align: right; font-weight: 500; color: #2563eb;">${soldeDebiteur > 0 ? formatEuro(soldeDebiteur) : '-'}</td>
                    <td style="padding: 10px 12px; text-align: right; font-weight: 500; color: #059669;">${soldeCrediteur > 0 ? formatEuro(soldeCrediteur) : '-'}</td>
                </tr>`;
        });

        container.innerHTML = `
            <table style="width: 100%; border-collapse: collapse; margin-top: 10px; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                <thead>
                    <tr style="background-color: #f1f5f9; color: #475569;">
                        <th style="padding: 12px;">Numéro</th>
                        <th style="padding: 12px;">Intitulé du compte</th>
                        <th style="padding: 12px; text-align: right;">Total Débit (€)</th>
                        <th style="padding: 12px; text-align: right;">Total Crédit (€)</th>
                        <th style="padding: 12px; text-align: right;">Solde Débiteur (€)</th>
                        <th style="padding: 12px; text-align: right;">Solde Créditeur (€)</th>
                    </tr>
                </thead>
                <tbody>${rowsHtml}</tbody>
                <tfoot>
                    <tr style="background-color: #f8fafc; font-weight: bold; border-top: 2px solid #cbd5e1;">
                        <td colspan="2" style="padding: 12px; text-align: right;">TOTAUX :</td>
                        <td style="padding: 12px; text-align: right; color: #dc2626;">${formatEuro(totalDebit)}</td>
                        <td style="padding: 12px; text-align: right; color: #16a34a;">${formatEuro(totalCredit)}</td>
                        <td style="padding: 12px; text-align: right; color: #2563eb;">${formatEuro(totalSoldeDebiteur)}</td>
                        <td style="padding: 12px; text-align: right; color: #059669;">${formatEuro(totalSoldeCrediteur)}</td>
                    </tr>
                </tfoot>
            </table>`;
    }

    window.chargerEtAfficherBalance = chargerEtAfficherBalance;
})();
