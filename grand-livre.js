// grand_livre.js - Génération dynamique du Grand Livre depuis Supabase

(function () {
    function getSupabase() {
        return window.supabaseClient || (window.supabase && typeof window.supabase.from === 'function' ? window.supabase : null);
    }

    async function chargerEtAfficherGrandLivre() {
        const conteneurGrandLivre = document.getElementById('grand-livre-container') || document.querySelector('#grand-livre') || document.querySelector('.grand-livre-content');
        
        // Fallback : recherche du conteneur sous le titre "Grand Livre"
        let zoneGL = conteneurGrandLivre;
        if (!zoneGL) {
            const elTitre = Array.from(document.querySelectorAll('h1, h2, h3, h4, div, span'))
                .find(el => el.textContent && el.textContent.trim().toLowerCase() === 'grand livre');
            if (elTitre) zoneGL = elTitre.closest('div.card, div.bg-white, section, main') || elTitre.parentElement;
        }

        if (!zoneGL) return;

        zoneGL.innerHTML = '<div style="text-align: center; padding: 30px; color: #64748b;">Chargement du Grand Livre...</div>';

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
            zoneGL.innerHTML = '<div style="text-align: center; padding: 30px; color: #94a3b8;">Aucune écriture trouvée.</div>';
            return;
        }

        // Regroupement des écritures par numéro de compte
        const comptesGroupes = {};

        ecritures.forEach(row => {
            // Lecture unifiée du compte (priorité compte_code puis account_number)
            let codeCompte = String(row.compte_code || row.account_number || '').trim();
            
            // Attribution par défaut si vide selon la nature de l'opération
            if (!codeCompte) {
                const amt = parseFloat(row.amount || row.debit || row.credit || 0);
                const isRec = String(row.type || '').toLowerCase().includes('rec') || String(row.category || '').toLowerCase().includes('soins');
                codeCompte = isRec ? '706000' : '600000';
            }

            if (!comptesGroupes[codeCompte]) {
                comptesGroupes[codeCompte] = {
                    code: codeCompte,
                    libelle: row.compte_libelle || row.category || 'Compte ' + codeCompte,
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

        // Rendu HTML
        let htmlContent = '<div style="display: flex; flex-direction: column; gap: 20px;">';

        // Tri des comptes par numéro croissant
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
                        <td style="padding: 8px 12px; text-align: right; color: #dc2626;">${l.debit > 0 ? l.debit.toFixed(2) + ' €' : '-'}</td>
                        <td style="padding: 8px 12px; text-align: right; color: #16a34a;">${l.credit > 0 ? l.credit.toFixed(2) + ' €' : '-'}</td>
                    </tr>
                `;
            }).join('');

            const solde = totalDebit - totalCredit;

            htmlContent += `
                <div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
                    <div style="background-color: #f8fafc; padding: 10px 16px; border-bottom: 1px solid #e2e8f0; font-weight: 600; color: #1e293b; display: flex; justify-content: space-between;">
                        <span>📁 ${code} - ${groupe.libelle}</span>
                        <span>Solde : ${solde.toFixed(2)} €</span>
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
                                <td style="padding: 8px 12px; text-align: right; color: #dc2626;">${totalDebit.toFixed(2)} €</td>
                                <td style="padding: 8px 12px; text-align: right; color: #16a34a;">${totalCredit.toFixed(2)} €</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            `;
        });

        htmlContent += '</div>';
        zoneGL.innerHTML = htmlContent;
    }

    // Ré-actualisation lors du clic sur l'onglet "Grand Livre"
    document.addEventListener('click', (e) => {
        const btn = e.target.closest('button, a, div');
        if (btn && btn.textContent && btn.textContent.trim().toLowerCase().includes('grand livre')) {
            setTimeout(chargerEtAfficherGrandLivre, 150);
            setTimeout(chargerEtAfficherGrandLivre, 400);
        }
    });

    window.chargerEtAfficherGrandLivre = chargerEtAfficherGrandLivre;

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        setTimeout(chargerEtAfficherGrandLivre, 200);
    } else {
        document.addEventListener('DOMContentLoaded', chargerEtAfficherGrandLivre);
    }
})();
