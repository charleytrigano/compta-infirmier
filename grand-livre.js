// grand_livre.js - Correction des calculs de solde et rendu du Grand Livre

(function () {
    function getSupabase() {
        return window.supabaseClient || (window.supabase && typeof window.supabase.from === 'function' ? window.supabase : null);
    }

    function formatEuro(amount) {
        return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount || 0);
    }

    async function chargerEtAfficherGrandLivre() {
        const conteneurGrandLivre = document.getElementById('grand-livre-container') || 
                                    document.getElementById('vue-grand-livre') || 
                                    document.getElementById('conteneur-grand-livre') || 
                                    document.querySelector('#grand-livre') || 
                                    document.querySelector('.grand-livre-content');
        
        let zoneGL = conteneurGrandLivre;
        if (!zoneGL) {
            const elTitre = Array.from(document.querySelectorAll('h1, h2, h3, h4, div, span'))
                .find(el => el.textContent && el.textContent.trim().toLowerCase() === 'grand livre');
            if (elTitre) zoneGL = elTitre.closest('div.card, div.bg-white, section, main') || elTitre.parentElement;
        }

        if (!zoneGL) return;

        const supabase = getSupabase();
        let ecritures = [];

        if (supabase) {
            const { data: ecrData, error } = await supabase
                .from('ecritures_comptables')
                .select('*')
                .order('date', { ascending: true });

            if (!error && ecrData && ecrData.length > 0) {
                ecritures = ecrData;
            } else {
                const { data: txData } = await supabase.from('transactions').select('*').order('date', { ascending: true });
                ecritures = txData || [];
            }
        }

        if (ecritures.length === 0) {
            zoneGL.innerHTML = '<div style="text-align: center; padding: 30px; color: #94a3b8;">Aucune écriture trouvée dans le Grand Livre.</div>';
            return;
        }

        const comptesGroupes = {};

        ecritures.forEach(row => {
            let codeCompte = String(row.compte_code || row.account_number || '').trim();
            if (!codeCompte) {
                const isRec = String(row.type || '').toLowerCase().includes('rec') || String(row.category || '').toLowerCase().includes('soins');
                codeCompte = isRec ? '706000' : '600000';
            }

            if (!comptesGroupes[codeCompte]) {
                comptesGroupes[codeCompte] = {
                    code: codeCompte,
                    libelle: row.compte_libelle || row.category || ('Compte ' + codeCompte),
                    lignes: []
                };
            }

            let debitVal = parseFloat(row.debit || 0);
            let creditVal = parseFloat(row.credit || 0);

            if (!row.debit && !row.credit && row.amount) {
                const amt = Math.abs(parseFloat(row.amount));
                const isRec = String(row.type || '').toLowerCase().includes('rec') || String(row.category || '').toLowerCase().includes('soins');
                if (isRec) creditVal = amt;
                else debitVal = amt;
            }

            comptesGroupes[codeCompte].lignes.push({
                date: row.date || '-',
                category: row.category || '-',
                description: row.description || row.compte_libelle || '-',
                debit: debitVal,
                credit: creditVal
            });
        });

        let htmlContent = '<div style="display: flex; flex-direction: column; gap: 20px;">';
        const codesTries = Object.keys(comptesGroupes).sort();

        codesTries.forEach(code => {
            const groupe = comptesGroupes[code];
            let totalDebit = 0;
            let totalCredit = 0;

            let tableRows = groupe.lignes.map(l => {
                totalDebit += l.debit;
                totalCredit += l.credit;

                return `
                    <tr style="border-bottom: 1px solid #f1f5f9;">
                        <td style="padding: 8px 12px; color: #334155;">${l.date}</td>
                        <td style="padding: 8px 12px; font-weight: 600; color: #1e293b;">${code}</td>
                        <td style="padding: 8px 12px; color: #334155;">${l.category}</td>
                        <td style="padding: 8px 12px; color: #334155;">${l.description}</td>
                        <td style="padding: 8px 12px; text-align: right; color: #dc2626;">${l.debit > 0 ? formatEuro(l.debit) : '-'}</td>
                        <td style="padding: 8px 12px; text-align: right; color: #16a34a;">${l.credit > 0 ? formatEuro(l.credit) : '-'}</td>
                    </tr>
                `;
            }).join('');

            // Calcul rigoureux du solde
            const diff = totalDebit - totalCredit;
            let soldeFormatted = '';
            if (Math.abs(diff) < 0.001) {
                soldeFormatted = 'Solde Soldé : 0,00 €';
            } else if (diff > 0) {
                soldeFormatted = `Solde Débiteur : ${formatEuro(diff)}`;
            } else {
                soldeFormatted = `Solde Créditeur : ${formatEuro(Math.abs(diff))}`;
            }

            htmlContent += `
                <div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                    <div style="background-color: #f8fafc; padding: 10px 16px; border-bottom: 1px solid #e2e8f0; font-weight: 600; color: #1e293b; display: flex; justify-content: space-between; align-items: center;">
                        <span>📁 ${code} - ${groupe.libelle}</span>
                        <span style="font-size: 0.85rem; background: #eff6ff; color: #2563eb; padding: 4px 8px; border-radius: 4px;">${soldeFormatted}</span>
                    </div>
                    <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem;">
                        <thead>
                            <tr style="border-bottom: 1px solid #cbd5e1; background-color: #f1f5f9; color: #475569;">
                                <th style="padding: 8px 12px; text-align: left;">Date</th>
                                <th style="padding: 8px 12px; text-align: left;">Compte</th>
                                <th style="padding: 8px 12px; text-align: left;">Catégorie</th>
                                <th style="padding: 8px 12px; text-align: left;">Description</th>
                                <th style="padding: 8px 12px; text-align: right;">Débit (€)</th>
                                <th style="padding: 8px 12px; text-align: right;">Crédit (€)</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${tableRows}
                        </tbody>
                        <tfoot>
                            <tr style="background-color: #f8fafc; font-weight: 600; border-top: 2px solid #e2e8f0;">
                                <td colspan="4" style="padding: 8px 12px; text-align: right;">Sous-total (${code}) :</td>
                                <td style="padding: 8px 12px; text-align: right; color: #dc2626;">${formatEuro(totalDebit)}</td>
                                <td style="padding: 8px 12px; text-align: right; color: #16a34a;">${formatEuro(totalCredit)}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            `;
        });

        htmlContent += '</div>';
        zoneGL.innerHTML = htmlContent;
    }

    window.chargerEtAfficherGrandLivre = chargerEtAfficherGrandLivre;
    window.chargerGrandLivre = chargerEtAfficherGrandLivre;

    window.addEventListener('ecritureAjoutee', async () => {
        await chargerEtAfficherGrandLivre();
    });

    document.addEventListener('click', (e) => {
        const btn = e.target.closest('button, a, div, li');
        if (btn && btn.textContent && btn.textContent.trim().toLowerCase().includes('grand livre')) {
            setTimeout(chargerEtAfficherGrandLivre, 100);
        }
    });

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        setTimeout(chargerEtAfficherGrandLivre, 200);
    } else {
        document.addEventListener('DOMContentLoaded', chargerEtAfficherGrandLivre);
    }
})();
