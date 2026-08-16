// bilan.js - Compte de Résultat / Déclaration 2035 & Bilan

(function () {
    function getSupabase() {
        return window.supabaseClient || (window.supabase && typeof window.supabase.from === 'function' ? window.supabase : null);
    }

    function formatEuro(amount) {
        return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount || 0);
    }

    async function chargerBilanEtCE() {
        const vueBilan = document.getElementById('vue-bilan') || document.querySelector('[data-view="bilan"]') || document.querySelector('[id*="bilan"]');
        if (!vueBilan && !document.querySelector('body')) return;

        const supabase = getSupabase();
        if (!supabase) return;

        try {
            // Lecture des écritures bancaires (Compte 512000)
            const { data, error } = await supabase
                .from('ecritures_comptables')
                .select('*')
                .or('compte_code.eq.512000,compte_code.like.512%');

            if (error || !data) return;

            let totalRecettes = 0;
            let totalDepenses = 0;

            const recMap = new Map();
            const depMap = new Map();

            data.forEach(row => {
                const debit = parseFloat(row.debit || 0);
                const credit = parseFloat(row.credit || 0);
                const cat = row.category || 'Autres';

                if (debit > 0) {
                    // Encaissement / Recette
                    totalRecettes += debit;
                    recMap.set(cat, (recMap.get(cat) || 0) + debit);
                } else if (credit > 0) {
                    // Décaissement / Dépense
                    totalDepenses += credit;
                    depMap.set(cat, (depMap.get(cat) || 0) + credit);
                }
            });

            // Mise à jour des blocs Recettes
            const elTotalRecettes = vueBilan ? vueBilan.querySelector('.recettes-total, [id*="total-recettes"]') : null;
            const tbodyRecettes = vueBilan ? vueBilan.querySelectorAll('tbody')[0] : null;

            if (tbodyRecettes) {
                if (recMap.size === 0) {
                    tbodyRecettes.innerHTML = `<tr><td colspan="3" style="text-align: center; color: #94a3b8; padding: 10px;">Aucune recette enregistrée.</td></tr>`;
                } else {
                    let htmlRec = '';
                    recMap.forEach((montant, cat) => {
                        htmlRec += `
                            <tr style="border-bottom: 1px solid #f1f5f9;">
                                <td style="padding: 8px; color: #64748b; font-weight: 600;">AA</td>
                                <td style="padding: 8px; color: #334155;">${cat}</td>
                                <td style="padding: 8px; text-align: right; font-weight: 600; color: #16a34a;">${formatEuro(montant)}</td>
                            </tr>
                        `;
                    });
                    tbodyRecettes.innerHTML = htmlRec;
                }
            }

            // Mise à jour des blocs Dépenses
            const tbodyDepenses = vueBilan ? vueBilan.querySelectorAll('tbody')[1] : null;
            if (tbodyDepenses) {
                if (depMap.size === 0) {
                    tbodyDepenses.innerHTML = `<tr><td colspan="3" style="text-align: center; color: #94a3b8; padding: 10px;">Aucune dépense enregistrée.</td></tr>`;
                } else {
                    let htmlDep = '';
                    depMap.forEach((montant, cat) => {
                        htmlDep += `
                            <tr style="border-bottom: 1px solid #f1f5f9;">
                                <td style="padding: 8px; color: #64748b; font-weight: 600;">BT</td>
                                <td style="padding: 8px; color: #334155;">${cat}</td>
                                <td style="padding: 8px; text-align: right; font-weight: 600; color: #dc2626;">${formatEuro(montant)}</td>
                            </tr>
                        `;
                    });
                    tbodyDepenses.innerHTML = htmlDep;
                }
            }

            // Mise à jour des Totaux généraux et Résultat
            const resultat = totalRecettes - totalDepenses;

            // Recherche dynamique des zones de texte de totaux
            document.querySelectorAll('*').forEach(el => {
                if (el.children.length === 0) {
                    if (el.textContent.includes('TOTAL RECETTES BRUTES')) {
                        const target = el.querySelector('span') || el.nextElementSibling || el;
                        if (target) target.textContent = `TOTAL RECETTES BRUTES (Ligne AG) : ${formatEuro(totalRecettes)}`;
                    }
                    if (el.textContent.includes('TOTAL DÉPENSES DÉDUCTIBLES')) {
                        const target = el.querySelector('span') || el.nextElementSibling || el;
                        if (target) target.textContent = `TOTAL DÉPENSES DÉDUCTIBLES (Ligne CH) : ${formatEuro(totalDepenses)}`;
                    }
                    if (el.textContent.includes('RÉSULTAT FISCAL')) {
                        const target = el.querySelector('span') || el.nextElementSibling || el;
                        if (target) target.textContent = `RÉSULTAT FISCAL : BÉNÉFICE (Ligne CP) : ${formatEuro(resultat)}`;
                    }
                }
            });

        } catch (err) {
            console.error("Erreur Bilan:", err);
        }
    }

    window.chargerBilanEtCE = chargerBilanEtCE;

    // Clic sur l'onglet Bilan / CE
    document.addEventListener('click', (e) => {
        const el = e.target.closest('button, a, div');
        if (el && el.textContent && el.textContent.trim().toLowerCase().includes('bilan')) {
            setTimeout(chargerBilanEtCE, 100);
            setTimeout(chargerBilanEtCE, 300);
        }
    });

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        setTimeout(chargerBilanEtCE, 200);
    } else {
        document.addEventListener('DOMContentLoaded', chargerBilanEtCE);
    }
})();
