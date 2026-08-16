// bilan.js - Compte de Résultat / Déclaration 2035 avec Filtre d'Exercice

(function () {
    function getSupabase() {
        return window.supabaseClient || (window.supabase && typeof window.supabase.from === 'function' ? window.supabase : null);
    }

    function formatEuro(amount) {
        return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount || 0);
    }

    // Année sélectionnée par défaut (année en cours ou dernière saisie)
    let anneeSelectionnee = new Date().getFullYear();

    async function chargerBilanEtCE() {
        const vueBilan = document.getElementById('vue-bilan') || document.querySelector('[data-view="bilan"]') || document.querySelector('[id*="bilan"]');
        if (!vueBilan && !document.body) return;

        const supabase = getSupabase();
        if (!supabase) return;

        // Inserer le filtre d'exercice dans la vue s'il n'existe pas encore
        injecterFiltreExercice(vueBilan);

        try {
            // Filtrer les ecritures par annee d'exercice (1er janv au 31 dec)
            const dateDebut = `${anneeSelectionnee}-01-01`;
            const dateFin = `${anneeSelectionnee}-12-31`;

            const { data, error } = await supabase
                .from('ecritures_comptables')
                .select('*')
                .or('compte_code.eq.512000,compte_code.like.512%')
                .gte('date', dateDebut)
                .lte('date', dateFin);

            if (error) return;

            let totalRecettes = 0;
            let totalDepenses = 0;

            const recMap = new Map();
            const depMap = new Map();

            (data || []).forEach(row => {
                const debit = parseFloat(row.debit || 0);
                const credit = parseFloat(row.credit || 0);
                const cat = row.category || 'Autres';

                if (debit > 0) {
                    totalRecettes += debit;
                    recMap.set(cat, (recMap.get(cat) || 0) + debit);
                } else if (credit > 0) {
                    totalDepenses += credit;
                    depMap.set(cat, (depMap.get(cat) || 0) + credit);
                }
            });

            // Affichage des Recettes
            const tbodies = vueBilan ? vueBilan.querySelectorAll('tbody') : document.querySelectorAll('tbody');
            const tbodyRecettes = tbodies[0];
            const tbodyDepenses = tbodies[1];

            if (tbodyRecettes) {
                if (recMap.size === 0) {
                    tbodyRecettes.innerHTML = `<tr><td colspan="3" style="text-align: center; color: #94a3b8; padding: 12px;">Aucune recette enregistrée pour l'exercice ${anneeSelectionnee}.</td></tr>`;
                } else {
                    let htmlRec = '';
                    recMap.forEach((montant, cat) => {
                        htmlRec += `
                            <tr style="border-bottom: 1px solid #f1f5f9;">
                                <td style="padding: 8px; color: #64748b; font-weight: 600;">AA</td>
                                <td style="padding: 8px; color: #334155;">${cat}</td>
                                <td style="padding: 8px; text-align: right; font-weight: 600; color: #16a34a;">${formatEuro(montant)}</td>
                            </tr>`;
                    });
                    tbodyRecettes.innerHTML = htmlRec;
                }
            }

            // Affichage des Dépenses
            if (tbodyDepenses) {
                if (depMap.size === 0) {
                    tbodyDepenses.innerHTML = `<tr><td colspan="3" style="text-align: center; color: #94a3b8; padding: 12px;">Aucune dépense enregistrée pour l'exercice ${anneeSelectionnee}.</td></tr>`;
                } else {
                    let htmlDep = '';
                    depMap.forEach((montant, cat) => {
                        htmlDep += `
                            <tr style="border-bottom: 1px solid #f1f5f9;">
                                <td style="padding: 8px; color: #64748b; font-weight: 600;">BT</td>
                                <td style="padding: 8px; color: #334155;">${cat}</td>
                                <td style="padding: 8px; text-align: right; font-weight: 600; color: #dc2626;">${formatEuro(montant)}</td>
                            </tr>`;
                    });
                    tbodyDepenses.innerHTML = htmlDep;
                }
            }

            // Totaux et Résultat
            const resultat = totalRecettes - totalDepenses;

            document.querySelectorAll('*').forEach(el => {
                if (el.children.length === 0) {
                    if (el.textContent.includes('TOTAL RECETTES BRUTES')) {
                        el.textContent = `TOTAL RECETTES BRUTES (Ligne AG) : ${formatEuro(totalRecettes)}`;
                    }
                    if (el.textContent.includes('TOTAL DÉPENSES DÉDUCTIBLES')) {
                        el.textContent = `TOTAL DÉPENSES DÉDUCTIBLES (Ligne CH) : ${formatEuro(totalDepenses)}`;
                    }
                    if (el.textContent.includes('RÉSULTAT FISCAL')) {
                        el.textContent = `RÉSULTAT FISCAL : BÉNÉFICE (Ligne CP) : ${formatEuro(resultat)}`;
                    }
                }
            });

        } catch (err) {
            console.error("Erreur Bilan:", err);
        }
    }

    /**
     * Injecte le menu déroulant de sélection d'exercice
     */
    function injecterFiltreExercice(vueBilan) {
        if (document.getElementById('select-exercice-annee')) return;

        const conteneur = vueBilan || document.querySelector('main') || document.body;
        const divFiltre = document.createElement('div');
        divFiltre.style.cssText = "display: flex; align-items: center; gap: 10px; margin-bottom: 15px; padding: 10px 15px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;";
        
        divFiltre.innerHTML = `
            <label for="select-exercice-annee" style="font-weight: 600; color: #334155;">📅 Exercice fiscal :</label>
            <select id="select-exercice-annee" style="padding: 6px 12px; border-radius: 6px; border: 1px solid #cbd5e1; font-weight: 600; color: #1e293b; background: white;">
                <option value="2026" selected>2026</option>
                <option value="2025">2025</option>
                <option value="2024">2024</option>
            </select>
        `;

        conteneur.insertBefore(divFiltre, conteneur.firstChild);

        document.getElementById('select-exercice-annee').addEventListener('change', (e) => {
            anneeSelectionnee = parseInt(e.target.value, 10);
            chargerBilanEtCE();
        });
    }

    window.chargerBilanEtCE = chargerBilanEtCE;

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
