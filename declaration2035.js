// declaration2035.js - Rendu complet Onglet 2035 / 2042 C PRO

(function () {
    window.annee2035Selectionnee = window.annee2035Selectionnee || new Date().getFullYear().toString();

    function getSupabase() {
        return window.supabaseClient || (window.supabase && typeof window.supabase.from === 'function' ? window.supabase : null);
    }

    function formatEuro(amount) {
        return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount || 0);
    }

    // --- CHARGEMENT PRINCIPAL ---
    async function chargerDeclaration2035() {
        let container = document.getElementById('vue-2035');
        if (!container) {
            const candidates = Array.from(document.querySelectorAll('div, section, main'));
            container = candidates.find(el => el.textContent.includes('Chargement de la déclaration 2035') || el.getAttribute('data-view') === '2035');
        }
        if (!container) return;

        const supabase = getSupabase();
        if (!supabase) {
            container.innerHTML = `<div style="padding:20px; color:#ef4444; text-align:center;">Erreur : Supabase indisponible.</div>`;
            return;
        }

        try {
            // Écritures comptables
            const { data: toutesEcritures } = await supabase.from('ecritures_comptables').select('*').order('date', { ascending: false });

            const anneesDispo = Array.from(new Set((toutesEcritures || []).map(e => e.date ? new Date(e.date).getFullYear().toString() : null).filter(Boolean))).sort((a, b) => b - a);
            if (anneesDispo.length > 0 && !anneesDispo.includes(window.annee2035Selectionnee)) {
                window.annee2035Selectionnee = anneesDispo[0];
            }
            const anneeActive = window.annee2035Selectionnee;

            const ecrituresAnnee = (toutesEcritures || []).filter(e => e.date && new Date(e.date).getFullYear().toString() === anneeActive);

            let aaHonoraires = 0;
            let bwCarpimko = 0;
            let bxUrssaf = 0;
            let autresDepenses = 0;

            ecrituresAnnee.forEach(row => {
                const debit = parseFloat(row.debit || 0);
                const credit = parseFloat(row.credit || 0);
                const code = String(row.compte_code || '').trim();

                if (code.startsWith('7')) {
                    aaHonoraires += (credit - debit);
                } else if (code.startsWith('6')) {
                    const charge = debit - credit;
                    if (code === '646100' || code.includes('CARPIMKO')) bwCarpimko += charge;
                    else if (code === '646200' || code.includes('URSSAF')) bxUrssaf += charge;
                    else autresDepenses += charge;
                }
            });

            const totalRecettesAG = aaHonoraires;
            const totalDepensesCH = bwCarpimko + bxUrssaf + autresDepenses;
            const beneficeCP = totalRecettesAG - totalDepensesCH;
            const beneficeArrondi = Math.round(Math.max(0, beneficeCP));

            const optionsAnnees = (anneesDispo.length > 0 ? anneesDispo : [anneeActive]).map(a => 
                `<option value="${a}" ${a === anneeActive ? 'selected' : ''}>${a}</option>`
            ).join('');

            // Rendu HTML sans le bouton d'export
            container.innerHTML = `
                <div style="background: white; border-radius: 12px; padding: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                    <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 15px; margin-bottom: 20px; padding-bottom: 16px; border-bottom: 1px solid #e2e8f0;">
                        <div>
                            <h2 style="font-size: 1.25rem; font-weight: 700; color: #1e293b; margin: 0;">📋 Déclarations 2035 & 2042 C PRO</h2>
                            <p style="margin: 4px 0 0 0; color: #64748b; font-size: 0.875rem;">Synthèse pour l'exercice ${anneeActive}</p>
                        </div>
                        <div>
                            <select id="select-annee-2035" onchange="window.changerAnnee2035(this.value)" style="padding: 6px 12px; border-radius: 6px; border: 1px solid #cbd5e1; font-weight: 700;">
                                ${optionsAnnees}
                            </select>
                        </div>
                    </div>

                    <!-- TABLEAU CERFA 2035 -->
                    <div style="margin-bottom: 24px;">
                        <h3 style="color: #1e293b; font-size: 1rem; font-weight: 700;">1. Lignes à remplir pour la Déclaration 2035</h3>
                        <table style="width: 100%; border-collapse: collapse; border: 1px solid #e2e8f0; font-size: 0.9rem; margin-top: 8px;">
                            <thead>
                                <tr style="background: #f8fafc; text-align: left; color: #64748b;">
                                    <th style="padding: 8px;">Cadre</th>
                                    <th style="padding: 8px;">Case</th>
                                    <th style="padding: 8px;">Libellé</th>
                                    <th style="padding: 8px; text-align: right;">Montant</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr style="border-bottom: 1px solid #f1f5f9;">
                                    <td style="padding: 8px;">Recettes</td>
                                    <td style="padding: 8px; font-weight: 700;">AA / AG</td>
                                    <td style="padding: 8px;">Honoraires encaissés / Total recettes brutes</td>
                                    <td style="padding: 8px; text-align: right; font-weight: 600;">${formatEuro(totalRecettesAG)}</td>
                                </tr>
                                <tr style="border-bottom: 1px solid #f1f5f9;">
                                    <td style="padding: 8px;">Dépenses</td>
                                    <td style="padding: 8px; font-weight: 700;">BW</td>
                                    <td style="padding: 8px;">CARPIMKO</td>
                                    <td style="padding: 8px; text-align: right;">${formatEuro(bwCarpimko)}</td>
                                </tr>
                                <tr style="border-bottom: 1px solid #f1f5f9;">
                                    <td style="padding: 8px;">Dépenses</td>
                                    <td style="padding: 8px; font-weight: 700;">BX</td>
                                    <td style="padding: 8px;">URSSAF</td>
                                    <td style="padding: 8px; text-align: right;">${formatEuro(bxUrssaf)}</td>
                                </tr>
                                <tr style="border-bottom: 1px solid #f1f5f9;">
                                    <td style="padding: 8px;">Dépenses</td>
                                    <td style="padding: 8px; font-weight: 700;">CH</td>
                                    <td style="padding: 8px;">Total des dépenses déductibles</td>
                                    <td style="padding: 8px; text-align: right; font-weight: 600;">${formatEuro(totalDepensesCH)}</td>
                                </tr>
                                <tr style="background: #f0fdf4; font-weight: 700;">
                                    <td style="padding: 8px; color: #166534;">Résultat</td>
                                    <td style="padding: 8px; color: #166534;">CP (Ligne 46)</td>
                                    <td style="padding: 8px; color: #166534;">BÉNÉFICE FISCAL</td>
                                    <td style="padding: 8px; text-align: right; color: #166534; font-size: 1rem;">${formatEuro(beneficeCP)}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <!-- MODULE REPORT 2042 C PRO -->
                    <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 16px;">
                        <h3 style="color: #1e40af; font-size: 1rem; font-weight: 700; margin: 0 0 8px 0;">
                            2. Cases à remplir sur la Déclaration 2042 C PRO (Impôt sur le revenu)
                        </h3>
                        <p style="font-size: 0.85rem; color: #1e3a8a; margin-bottom: 12px;">
                            Reportez ces données dans le cadre <strong>"Revenus non commerciaux professionnels - Régime de la déclaration contrôlée"</strong> :
                        </p>
                        <table style="width: 100%; border-collapse: collapse; background: white; border-radius: 6px; overflow: hidden; font-size: 0.9rem;">
                            <thead>
                                <tr style="background: #dbeafe; text-align: left; color: #1e40af;">
                                    <th style="padding: 8px;">Case</th>
                                    <th style="padding: 8px;">Description</th>
                                    <th style="padding: 8px; text-align: right;">Valeur à déclarer</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr style="border-bottom: 1px solid #e2e8f0;">
                                    <td style="padding: 8px; font-weight: 800; color: #1d4ed8;">5QC</td>
                                    <td style="padding: 8px;">Revenus imposables cas général (Déclarant 1)</td>
                                    <td style="padding: 8px; text-align: right; font-weight: 700; color: #0f172a;">${beneficeArrondi} €</td>
                                </tr>
                                <tr>
                                    <td style="padding: 8px; font-weight: 800; color: #1d4ed8;">5QI</td>
                                    <td style="padding: 8px;">Durée de l'exercice (en mois)</td>
                                    <td style="padding: 8px; text-align: right; font-weight: 700; color: #0f172a;">12</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            `;

        } catch (err) {
            console.error("Erreur chargement 2035 / 2042:", err);
        }
    }

    window.changerAnnee2035 = function(annee) {
        window.annee2035Selectionnee = String(annee);
        chargerDeclaration2035();
    };

    window.chargerDeclaration2035 = chargerDeclaration2035;

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        setTimeout(chargerDeclaration2035, 100);
    } else {
        document.addEventListener('DOMContentLoaded', chargerDeclaration2035);
    }
})();
