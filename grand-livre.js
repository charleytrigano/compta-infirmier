// grand-livre.js - Module d'affichage du Grand Livre basé uniquement sur ecritures_comptables

(function () {
    function getSupabase() {
        return window.supabaseClient || (window.supabase && typeof window.supabase.from === 'function' ? window.supabase : null);
    }

    function formatEuro(amount) {
        return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount || 0);
    }

    async function chargerEtAfficherGrandLivre() {
        const container = document.getElementById('grandlivre-contenu');
        if (!container) return;

        const supabase = getSupabase();
        let ecritures = [];

        if (supabase) {
            try {
                const { data: ecrData, error } = await supabase
                    .from('ecritures_comptables')
                    .select('*')
                    .order('date', { ascending: true });
                
                if (!error && ecrData) {
                    ecritures = ecrData;
                }
            } catch (err) {
                console.error("Erreur Supabase Grand Livre:", err);
            }
        }

        if (!ecritures || ecritures.length === 0) {
            container.innerHTML = `
                <div style="padding: 20px;">
                    <p style="color: #64748b; background: #f8fafc; padding: 20px; border-radius: 6px; border: 1px solid #e2e8f0; text-align: center;">
                        Aucune écriture comptable enregistrée.
                    </p>
                </div>`;
            return;
        }

        const comptes = {};

        ecritures.forEach(row => {
            const code = String(row.compte_code || '471000').trim();

            if (!comptes[code]) {
                comptes[code] = {
                    code: code,
                    libelle: row.compte_libelle || ('Compte ' + code),
                    lignes: []
                };
            }

            const debit = parseFloat(row.debit || 0);
            const credit = parseFloat(row.credit || 0);

            comptes[code].lignes.push({
                date: row.date || '-',
                journal: row.journal || 'OD',
                description: row.description || '-',
                debit: debit,
                credit: credit
            });
        });

        let html = '<div style="display: flex; flex-direction: column; gap: 20px; margin-top: 15px;">';

        Object.keys(comptes).sort().forEach(code => {
            const c = comptes[code];
            let totDebit = 0;
            let totCredit = 0;

            const rowsHtml = c.lignes.map(l => {
                totDebit += l.debit;
                totCredit += l.credit;
                return `
                    <tr style="border-bottom: 1px solid #f1f5f9;">
                        <td style="padding: 8px 12px; color: #334155;">${l.date}</td>
                        <td style="padding: 8px 12px; font-weight: 600; color: #1e293b;">${code}</td>
                        <td style="padding: 8px 12px; color: #334155;">${l.journal}</td>
                        <td style="padding: 8px 12px; color: #334155;">${l.description}</td>
                        <td style="padding: 8px 12px; text-align: right; color: #dc2626;">${l.debit > 0 ? formatEuro(l.debit) : '-'}</td>
                        <td style="padding: 8px 12px; text-align: right; color: #16a34a;">${l.credit > 0 ? formatEuro(l.credit) : '-'}</td>
                    </tr>`;
            }).join('');

            const solde = totDebit - totCredit;
            const soldeTxt = Math.abs(solde) < 0.01 ? 'Solde Soldé : 0,00 €' : (solde > 0 ? `Solde Débiteur : ${formatEuro(solde)}` : `Solde Créditeur : ${formatEuro(Math.abs(solde))}`);

            html += `
                <div style="background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                    <div style="background: #f8fafc; padding: 10px 16px; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; font-weight: 600; align-items: center;">
                        <span>📁 ${code} - ${c.libelle}</span>
                        <span style="color: #2563eb; font-size: 0.85rem; background: #eff6ff; padding: 4px 8px; border-radius: 4px;">${soldeTxt}</span>
                    </div>
                    <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem;">
                        <thead>
                            <tr style="background: #f1f5f9; color: #475569; text-align: left;">
                                <th style="padding: 8px 12px;">Date</th>
                                <th style="padding: 8px 12px;">Compte</th>
                                <th style="padding: 8px 12px;">Journal</th>
                                <th style="padding: 8px 12px;">Description</th>
                                <th style="padding: 8px 12px; text-align: right;">Débit (€)</th>
                                <th style="padding: 8px 12px; text-align: right;">Crédit (€)</th>
                            </tr>
                        </thead>
                        <tbody>${rowsHtml}</tbody>
                        <tfoot>
                            <tr style="background: #f8fafc; font-weight: 600; border-top: 2px solid #e2e8f0;">
                                <td colspan="4" style="padding: 8px 12px; text-align: right;">Sous-total (${code}) :</td>
                                <td style="padding: 8px 12px; text-align: right; color: #dc2626;">${formatEuro(totDebit)}</td>
                                <td style="padding: 8px 12px; text-align: right; color: #16a34a;">${formatEuro(totCredit)}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>`;
        });

        html += '</div>';
        container.innerHTML = html;
    }

    window.afficherGrandLivre = chargerEtAfficherGrandLivre;
    window.chargerEtAfficherGrandLivre = chargerEtAfficherGrandLivre;
})();
