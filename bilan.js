// bilan.js - Compte de Résultat / Déclaration 2035 & Bilan Simplifié

(function () {
    let anneeSelectionnee = '2026';

    function getSupabase() {
        return window.supabaseClient || (window.supabase && typeof window.supabase.from === 'function' ? window.supabase : null);
    }

    function formatEuro(amount) {
        return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount || 0);
    }

    async function chargerBilanEtCE() {
        // Identification du conteneur de la vue Bilan
        let container = document.getElementById('vue-bilan');
        
        if (!container) {
            const candidate = document.querySelector('[data-view="bilan"]') || 
                              Array.from(document.querySelectorAll('div')).find(el => el.textContent.includes('Présentation Fiscale'));
            if (candidate) {
                container = candidate.closest('.card, .bg-white, main, section') || candidate.parentElement;
            }
        }

        if (!container) return;

        const supabase = getSupabase();
        if (!supabase) {
            container.innerHTML = `<div style="padding: 20px; color: #ef4444; text-align: center;">Erreur : Supabase non connecté.</div>`;
            return;
        }

        try {
            // Filtrage par année civile d'exercice
            const dateDebut = `${anneeSelectionnee}-01-01`;
            const dateFin = `${anneeSelectionnee}-12-31`;

            const { data, error } = await supabase
                .from('ecritures_comptables')
                .select('*')
                .or('compte_code.eq.512000,compte_code.like.512%')
                .gte('date', dateDebut)
                .lte('date', dateFin);

            if (error) {
                console.error("Erreur Supabase Bilan:", error);
                return;
            }

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

            const resultat = totalRecettes - totalDepenses;

            // Construction du HTML pour les recettes
            let htmlRecettesRows = '';
            if (recMap.size === 0) {
                htmlRecettesRows = `<tr><td colspan="3" style="text-align: center; color: #94a3b8; padding: 15px;">Aucune recette enregistrée pour l'exercice ${anneeSelectionnee}.</td></tr>`;
            } else {
                recMap.forEach((montant, cat) => {
                    htmlRecettesRows += `
                        <tr style="border-bottom: 1px solid #f1f5f9;">
                            <td style="padding: 10px; color: #64748b; font-weight: 600; width: 100px;">AG</td>
                            <td style="padding: 10px; color: #334155;">${cat}</td>
                            <td style="padding: 10px; text-align: right; font-weight: 600; color: #16a34a;">${formatEuro(montant)}</td>
                        </tr>`;
                });
            }

            // Construction du HTML pour les dépenses
            let htmlDepensesRows = '';
            if (depMap.size === 0) {
                htmlDepensesRows = `<tr><td colspan="3" style="text-align: center; color: #94a3b8; padding: 15px;">Aucune dépense enregistrée pour l'exercice ${anneeSelectionnee}.</td></tr>`;
            } else {
                depMap.forEach((montant, cat) => {
                    const codeLigne = cat.toLowerCase().includes('carpimko') || cat.toLowerCase().includes('urssaf') ? 'BT' : 'CH';
                    htmlDepensesRows += `
                        <tr style="border-bottom: 1px solid #f1f5f9;">
                            <td style="padding: 10px; color: #64748b; font-weight: 600; width: 100px;">${codeLigne}</td>
                            <td style="padding: 10px; color: #334155;">${cat}</td>
                            <td style="padding: 10px; text-align: right; font-weight: 600; color: #dc2626;">${formatEuro(montant)}</td>
                        </tr>`;
                });
            }

            // Injection du gabarit complet
            container.innerHTML = `
                <div style="background: white; border-radius: 12px; padding: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); margin-top: 10px;">
                    <!-- Barre de titre & Filtre -->
                    <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 15px; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px solid #e2e8f0;">
                        <h2 style="font-size: 1.25rem; font-weight: 700; color: #1e293b; margin: 0; display: flex; align-items: center; gap: 8px;">
                            📋 Présentation Fiscale - Déclaration 2035 & Bilan
                        </h2>
                        <div style="display: flex; align-items: center; gap: 10px; background: #f8fafc; padding: 6px 14px; border-radius: 8px; border: 1px solid #cbd5e1;">
                            <label for="select-exercice-annee" style="font-weight: 600; color: #475569; font-size: 0.9rem;">📅 Exercice fiscal :</label>
                            <select id="select-exercice-annee" style="padding: 4px 10px; border-radius: 6px; border: 1px solid #94a3b8; font-weight: 700; color: #0f172a; background: white; cursor: pointer;">
                                <option value="2026" ${anneeSelectionnee === '2026' ? 'selected' : ''}>2026</option>
                                <option value="2025" ${anneeSelectionnee === '2025' ? 'selected' : ''}>2025</option>
                                <option value="2024" ${anneeSelectionnee === '2024' ? 'selected' : ''}>2024</option>
                            </select>
                        </div>
                    </div>

                    <!-- Carte Compte de Résultat 2035 -->
                    <div style="border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; margin-bottom: 24px;">
                        <div style="background: #f8fafc; padding: 12px 16px; border-bottom: 1px solid #e2e8f0; font-weight: 700; color: #1e293b;">
                            📊 Compte de Résultat / Dépenses et Recettes (Formulaire 2035)
                        </div>
                        <div style="padding: 16px;">
                            <div style="font-weight: 700; color: #16a34a; font-size: 0.9rem; margin-bottom: 8px;">
                                🟢 RECETTES BRUTES
                            </div>
                            <table style="width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 0.95rem;">
                                <thead>
                                    <tr style="background: #f8fafc; color: #64748b; text-align: left; font-size: 0.85rem;">
                                        <th style="padding: 8px 10px;">Ligne 2035</th>
                                        <th style="padding: 8px 10px;">Rubrique Fiscale</th>
                                        <th style="padding: 8px 10px; text-align: right;">Montant (€)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${htmlRecettesRows}
                                </tbody>
                            </table>
                            <div style="background: #dcfce7; color: #14532d; padding: 12px 16px; border-radius: 6px; font-weight: 700; display: flex; justify-content: space-between; margin-bottom: 24px;">
                                <span>TOTAL RECETTES BRUTES (Ligne AG) :</span>
                                <span>${formatEuro(totalRecettes)}</span>
                            </div>

                            <div style="font-weight: 700; color: #dc2626; font-size: 0.9rem; margin-bottom: 8px;">
                                🔴 DÉPENSES PROFESSIONNELLES
                            </div>
                            <table style="width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 0.95rem;">
                                <thead>
                                    <tr style="background: #f8fafc; color: #64748b; text-align: left; font-size: 0.85rem;">
                                        <th style="padding: 8px 10px;">Ligne 2035</th>
                                        <th style="padding: 8px 10px;">Rubrique Fiscale</th>
                                        <th style="padding: 8px 10px; text-align: right;">Montant (€)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${htmlDepensesRows}
                                </tbody>
                            </table>
                            <div style="background: #fee2e2; color: #7f1d1d; padding: 12px 16px; border-radius: 6px; font-weight: 700; display: flex; justify-content: space-between; margin-bottom: 20px;">
                                <span>TOTAL DÉPENSES DÉDUCTIBLES (Ligne CH) :</span>
                                <span>${formatEuro(totalDepenses)}</span>
                            </div>

                            <div style="background: #f0fdf4; border: 2px solid #22c55e; color: #15803d; padding: 16px; border-radius: 8px; font-weight: 800; font-size: 1.1rem; display: flex; justify-content: space-between; align-items: center;">
                                <span>RÉSULTAT FISCAL : BÉNÉFICE (Ligne CP)</span>
                                <span style="font-size: 1.25rem;">${formatEuro(resultat)}</span>
                            </div>
                        </div>
                    </div>

                    <!-- Carte Bilan Simplifié -->
                    <div style="border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
                        <div style="background: #f8fafc; padding: 12px 16px; border-bottom: 1px solid #e2e8f0; font-weight: 700; color: #1e293b;">
                            ⚖️ Bilan Simplifié (Actif / Passif au 31/12/${anneeSelectionnee})
                        </div>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; padding: 16px;">
                            <div style="background: #f8fafc; padding: 14px; border-radius: 6px; border: 1px solid #e2e8f0;">
                                <h4 style="margin: 0 0 10px 0; color: #1e293b; border-bottom: 2px solid #3b82f6; padding-bottom: 4px;">ACTIF</h4>
                                <div style="display: flex; justify-content: space-between; padding: 6px 0; color: #334155;">
                                    <span>Trésorerie / Compte Banque (512)</span>
                                    <span style="font-weight: 600;">${formatEuro(resultat)}</span>
                                </div>
                                <div style="display: flex; justify-content: space-between; padding: 8px 0; margin-top: 10px; border-top: 1px solid #cbd5e1; font-weight: 700; color: #1e293b;">
                                    <span>TOTAL ACTIF</span>
                                    <span>${formatEuro(resultat)}</span>
                                </div>
                            </div>
                            <div style="background: #f8fafc; padding: 14px; border-radius: 6px; border: 1px solid #e2e8f0;">
                                <h4 style="margin: 0 0 10px 0; color: #1e293b; border-bottom: 2px solid #3b82f6; padding-bottom: 4px;">PASSIF</h4>
                                <div style="display: flex; justify-content: space-between; padding: 6px 0; color: #334155;">
                                    <span>Situation Nette / Résultat de l'exercice</span>
                                    <span style="font-weight: 600;">${formatEuro(resultat)}</span>
                                </div>
                                <div style="display: flex; justify-content: space-between; padding: 8px 0; margin-top: 10px; border-top: 1px solid #cbd5e1; font-weight: 700; color: #1e293b;">
                                    <span>TOTAL PASSIF</span>
                                    <span>${formatEuro(resultat)}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            // Réactivation de l'événement sur le sélecteur d'année
            const selectEl = document.getElementById('select-exercice-annee');
            if (selectEl) {
                selectEl.addEventListener('change', (e) => {
                    anneeSelectionnee = e.target.value;
                    chargerBilanEtCE();
                });
            }

        } catch (err) {
            console.error("Erreur générale Bilan:", err);
        }
    }

    window.chargerBilanEtCE = chargerBilanEtCE;

    document.addEventListener('click', (e) => {
        const el = e.target.closest('button, a, div');
        if (el && el.textContent && el.textContent.trim().toLowerCase().includes('bilan')) {
            setTimeout(chargerBilanEtCE, 50);
            setTimeout(chargerBilanEtCE, 200);
        }
    });

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        setTimeout(chargerBilanEtCE, 200);
    } else {
        document.addEventListener('DOMContentLoaded', chargerBilanEtCE);
    }
})();
