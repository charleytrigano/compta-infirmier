// declaration2035.js - Rendu complet et calcul dynamique 2035 depuis ecritures_comptables

(function () {
    let anneeExercice = '2026';

    function getSupabase() {
        return window.supabaseClient || (window.supabase && typeof window.supabase.from === 'function' ? window.supabase : null);
    }

    function formatEuro(amount) {
        return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount || 0);
    }

    async function chargerDeclaration2035() {
        let container = document.getElementById('vue-2035');
        if (!container) {
            const candidates = Array.from(document.querySelectorAll('div, section, main'));
            container = candidates.find(el => el.textContent.includes('Chargement de la déclaration 2035') || el.getAttribute('data-view') === '2035');
        }

        if (!container) return;

        const supabase = getSupabase();
        if (!supabase) {
            container.innerHTML = `<div style="padding:20px; color:#ef4444; text-align:center;">Erreur : Connexion Supabase indisponible.</div>`;
            return;
        }

        try {
            const dateDebut = `${anneeExercice}-01-01`;
            const dateFin = `${anneeExercice}-12-31`;

            // Récupération stricte de toutes les écritures de l'exercice
            const { data, error } = await supabase
                .from('ecritures_comptables')
                .select('*')
                .gte('date', dateDebut)
                .lte('date', dateFin);

            if (error) {
                console.error("Erreur Supabase 2035:", error);
                return;
            }

            let aaHonoraires = 0;
            let bwCarpimko = 0;
            let bxUrssaf = 0;
            let autresDepenses = 0;

            (data || []).forEach(row => {
                const debit = parseFloat(row.debit || 0);
                const credit = parseFloat(row.credit || 0);
                const code = String(row.compte_code || '').trim();

                // Recettes : Classe 7 (Honoraires)
                if (code.startsWith('7')) {
                    aaHonoraires += (credit - debit);
                } 
                // Charges : Classe 6
                else if (code.startsWith('6')) {
                    const montantCharge = debit - credit;
                    if (code === '646100' || code.includes('CARPIMKO')) {
                        bwCarpimko += montantCharge;
                    } else if (code === '646200' || code.includes('URSSAF')) {
                        bxUrssaf += montantCharge;
                    } else {
                        autresDepenses += montantCharge;
                    }
                }
            });

            const totalRecettesAG = aaHonoraires;
            const totalDepensesCH = bwCarpimko + bxUrssaf + autresDepenses;
            const beneficeCP = totalRecettesAG - totalDepensesCH;

            container.innerHTML = `
                <div style="background: white; border-radius: 12px; padding: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); margin-top: 10px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 15px; margin-bottom: 20px; padding-bottom: 16px; border-bottom: 1px solid #e2e8f0;">
                        <div>
                            <h2 style="font-size: 1.25rem; font-weight: 700; color: #1e293b; margin: 0;">
                                📄 Déclaration des Bénéfices Non Commerciaux (2035)
                            </h2>
                            <p style="margin: 4px 0 0 0; color: #64748b; font-size: 0.875rem;">
                                Régime de la déclaration contrôlée - Exercice ${anneeExercice}
                            </p>
                        </div>
                        <button onclick="window.print()" style="background: #4f46e5; color: white; border: none; padding: 10px 18px; border-radius: 8px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 8px;">
                            🖨️ Imprimer la 2035
                        </button>
                    </div>

                    <!-- I. RECETTES BRUTES -->
                    <div style="margin-bottom: 24px;">
                        <h3 style="color: #16a34a; font-size: 1rem; font-weight: 700; margin-bottom: 12px;">I. RECETTES BRUTES</h3>
                        <table style="width: 100%; border-collapse: collapse; border: 1px solid #e2e8f0; font-size: 0.9rem;">
                            <thead>
                                <tr style="background: #f8fafc; border-bottom: 1px solid #e2e8f0; text-align: left; color: #64748b;">
                                    <th style="padding: 10px; width: 60px;">Ligne</th>
                                    <th style="padding: 10px; width: 60px;">Code</th>
                                    <th style="padding: 10px;">Intitulé de la rubrique fiscale</th>
                                    <th style="padding: 10px; text-align: right; width: 140px;">Montant (€)</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr style="border-bottom: 1px solid #f1f5f9;">
                                    <td style="padding: 10px;">1</td>
                                    <td style="padding: 10px; font-weight: 700; color: #16a34a;">AA</td>
                                    <td style="padding: 10px; color: #334155;">Honoraires encaissés (y compris dépassements)</td>
                                    <td style="padding: 10px; text-align: right; font-weight: 600;">${formatEuro(aaHonoraires)}</td>
                                </tr>
                                <tr style="border-bottom: 1px solid #f1f5f9;">
                                    <td style="padding: 10px;">3</td>
                                    <td style="padding: 10px; font-weight: 700; color: #16a34a;">AC</td>
                                    <td style="padding: 10px; color: #334155;">Remboursements de frais et débours</td>
                                    <td style="padding: 10px; text-align: right; font-weight: 600;">0,00 €</td>
                                </tr>
                            </tbody>
                        </table>
                        <div style="background: #dcfce7; color: #14532d; padding: 12px 16px; border-radius: 6px; font-weight: 700; display: flex; justify-content: space-between; margin-top: 8px;">
                            <span>TOTAL DES RECETTES BRUTES (Ligne 6 / Code AG) :</span>
                            <span>${formatEuro(totalRecettesAG)}</span>
                        </div>
                    </div>

                    <!-- II. DÉPENSES PROFESSIONNELLES -->
                    <div style="margin-bottom: 24px;">
                        <h3 style="color: #dc2626; font-size: 1rem; font-weight: 700; margin-bottom: 12px;">II. DÉPENSES PROFESSIONNELLES</h3>
                        <table style="width: 100%; border-collapse: collapse; border: 1px solid #e2e8f0; font-size: 0.9rem;">
                            <thead>
                                <tr style="background: #f8fafc; border-bottom: 1px solid #e2e8f0; text-align: left; color: #64748b;">
                                    <th style="padding: 10px; width: 60px;">Ligne</th>
                                    <th style="padding: 10px; width: 60px;">Code</th>
                                    <th style="padding: 10px;">Intitulé de la rubrique fiscale</th>
                                    <th style="padding: 10px; text-align: right; width: 140px;">Montant (€)</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr style="border-bottom: 1px solid #f1f5f9;">
                                    <td style="padding: 10px;">15</td>
                                    <td style="padding: 10px; font-weight: 700; color: #dc2626;">BW</td>
                                    <td style="padding: 10px; color: #334155;">Cotisations sociales obligatoires : CARPIMKO</td>
                                    <td style="padding: 10px; text-align: right; font-weight: 600;">${formatEuro(bwCarpimko)}</td>
                                </tr>
                                <tr style="border-bottom: 1px solid #f1f5f9;">
                                    <td style="padding: 10px;">16</td>
                                    <td style="padding: 10px; font-weight: 700; color: #dc2626;">BX</td>
                                    <td style="padding: 10px; color: #334155;">Cotisations sociales obligatoires : URSSAF</td>
                                    <td style="padding: 10px; text-align: right; font-weight: 600;">${formatEuro(bxUrssaf)}</td>
                                </tr>
                            </tbody>
                        </table>
                        <div style="background: #fee2e2; color: #7f1d1d; padding: 12px 16px; border-radius: 6px; font-weight: 700; display: flex; justify-content: space-between; margin-top: 8px;">
                            <span>TOTAL DES DÉPENSES DÉDUCTIBLES (Code CH) :</span>
                            <span>${formatEuro(totalDepensesCH)}</span>
                        </div>
                    </div>

                    <!-- RÉSULTAT FISCAL -->
                    <div style="background: #f0fdf4; border: 2px solid #22c55e; color: #15803d; padding: 16px; border-radius: 8px; font-weight: 800; font-size: 1.1rem; display: flex; justify-content: space-between; align-items: center;">
                        <span>BÉNÉFICE FISCAL (Ligne 46 / Code CP)</span>
                        <span style="font-size: 1.25rem;">${formatEuro(beneficeCP)}</span>
                    </div>
                </div>
            `;

        } catch (err) {
            console.error("Erreur 2035:", err);
        }
    }

    window.chargerDeclaration2035 = chargerDeclaration2035;

    document.addEventListener('click', (e) => {
        const el = e.target.closest('button, a, div');
        if (el && el.textContent && el.textContent.trim().includes('2035')) {
            setTimeout(chargerDeclaration2035, 50);
            setTimeout(chargerDeclaration2035, 200);
        }
    });

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        setTimeout(chargerDeclaration2035, 200);
    } else {
        document.addEventListener('DOMContentLoaded', chargerDeclaration2035);
    }
})();
