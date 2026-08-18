// grand_livre.js - Injection ciblée sans supprimer la barre d'onglets

(function () {
    function getSupabase() {
        return window.supabaseClient || (window.supabase && typeof window.supabase.from === 'function' ? window.supabase : null);
    }

    function formatEuro(amount) {
        return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount || 0);
    }

    async function chargerEtAfficherGrandLivre() {
        // Ciblage strict du conteneur de contenu uniquement
        let container = document.getElementById('grand-livre-container');

        if (!container) {
            // Recherche du bloc spécifique "Chargement du grand livre..."
            const elms = Array.from(document.querySelectorAll('div, section, p'));
            const loader = elms.find(el => el.textContent && el.textContent.includes('Chargement du grand livre...'));
            if (loader) {
                // On remplace directement l'élément de chargement sans remonter au parent global
                container = loader;
            }
        }

        if (!container) return;

        const supabase = getSupabase();
        let ecritures = [];

        if (supabase) {
            try {
                const { data: ecrData } = await supabase.from('ecritures_comptables').select('*').order('date', { ascending: true });
                if (ecrData && ecrData.length > 0) {
                    ecritures = ecrData;
                } else {
                    const { data: txData } = await supabase.from('transactions').select('*').order('date', { ascending: true });
                    ecritures = txData || [];
                }
            } catch (err) {
                console.error("Erreur Supabase GL:", err);
            }
        }

        if (ecritures.length === 0) {
            container.innerHTML = `
                <div style="padding: 20px;">
                    <h3 style="font-size: 1.2rem; font-weight: 600; color: #1e293b; margin-bottom: 10px;">Grand Livre</h3>
                    <p style="color: #64748b; background: #f8fafc; padding: 20px; border-radius: 6px; border: 1px solid #e2e8f0;">Aucune écriture comptable trouvée.</p>
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
                    lignes: []
                };
            }

            let debit = parseFloat(row.debit || 0);
            let credit = parseFloat(row.credit || 0);

            if (!row.debit && !row.credit && row.amount) {
                const val = Math.abs(parseFloat(row.amount));
                if (row.type === 'recette') credit = val;
                else debit = val;
            }

            comptes[code].lignes.push({
                date: row.date || '-',
                category: row.category || '-',
                description: row.description || '-',
                debit: debit,
                credit: credit
            });
        });

        let html = '<div style="padding: 10px 0;"><h3 style="font-size: 1.25rem; font-weight: 600; margin-bottom: 15px; color: #1e293b;">Grand Livre</h3>';

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
                        <td style="padding: 8px 12px; color: #334155;">${l.category}</td>
                        <td style="padding: 8px 12px; color: #334155;">${l.description}</td>
                        <td style="padding: 8px 12px; text-align: right; color: #dc2626;">${l.debit > 0 ? formatEuro(l.debit) : '-'}</td>
                        <td style="padding: 8px 12px; text-align: right; color: #16a34a;">${l.credit > 0 ? formatEuro(l.credit) : '-'}</td>
                    </tr>`;
            }).join('');

            const solde = totDebit - totCredit;
            const soldeTxt = Math.abs(solde) < 0.01 ? 'Solde Soldé : 0,00 €' : (solde > 0 ? `Solde Débiteur : ${formatEuro(solde)}` : `Solde Créditeur : ${formatEuro(Math.abs(solde))}`);

            html += `
                <div style="background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 20px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                    <div style="background: #f8fafc; padding: 10px 16px; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; font-weight: 600; align-items: center;">
                        <span>📁 ${code} - ${c.libelle}</span>
                        <span style="color: #2563eb; font-size: 0.85rem; background: #eff6ff; padding: 4px 8px; border-radius: 4px;">${soldeTxt}</span>
                    </div>
                    <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem;">
                        <thead>
                            <tr style="background: #f1f5f9; color: #475569; text-align: left;">
                                <th style="padding: 8px 12px;">Date</th>
                                <th style="padding: 8px 12px;">Compte</th>
                                <th style="padding: 8px 12px;">Catégorie</th>
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

    window.chargerGrandLivre = chargerEtAfficherGrandLivre;
    window.chargerEtAfficherGrandLivre = chargerEtAfficherGrandLivre;

    document.addEventListener('click', (e) => {
        const btn = e.target.closest('button, a, div, li');
        if (btn && btn.textContent && btn.textContent.trim().toLowerCase().includes('grand livre')) {
            setTimeout(chargerEtAfficherGrandLivre, 50);
        }
    });

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        setTimeout(chargerEtAfficherGrandLivre, 150);
    } else {
        document.addEventListener('DOMContentLoaded', () => setTimeout(chargerEtAfficherGrandLivre, 150));
    }
})();
