// declaration2035.js - Remplissage automatique du Cerfa 2035 depuis Supabase

(function () {
    let anneeExercice = '2026';

    function getSupabase() {
        return window.supabaseClient || (window.supabase && typeof window.supabase.from === 'function' ? window.supabase : null);
    }

    function formatEuro(amount) {
        return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount || 0);
    }

    async function chargerDeclaration2035() {
        const supabase = getSupabase();
        if (!supabase) return;

        try {
            const dateDebut = `${anneeExercice}-01-01`;
            const dateFin = `${anneeExercice}-12-31`;

            // Récupération des recettes/dépenses bancaires (compte 512)
            const { data, error } = await supabase
                .from('ecritures_comptables')
                .select('*')
                .or('compte_code.eq.512000,compte_code.like.512%')
                .gte('date', dateDebut)
                .lte('date', dateFin);

            if (error || !data) return;

            let aaHonoraires = 0;  // Ligne 1 - AA (Honoraires)
            let bwCarpimko = 0;    // Ligne 15 - BW (CARPIMKO)
            let bxUrssaf = 0;      // Ligne 16 - BX (URSSAF)
            let autresDepenses = 0;

            data.forEach(row => {
                const debit = parseFloat(row.debit || 0);
                const credit = parseFloat(row.credit || 0);
                const cat = (row.category || '').toLowerCase();

                if (debit > 0) {
                    aaHonoraires += debit;
                } else if (credit > 0) {
                    if (cat.includes('carpimko')) {
                        bwCarpimko += credit;
                    } else if (cat.includes('urssaf')) {
                        bxUrssaf += credit;
                    } else {
                        autresDepenses += credit;
                    }
                }
            });

            const totalRecettesAG = aaHonoraires;
            const totalDepensesCH = bwCarpimko + bxUrssaf + autresDepenses;
            const beneficeCP = totalRecettesAG - totalDepensesCH;

            // Parcours des lignes du tableau Cerfa 2035 affiché
            const trs = document.querySelectorAll('tr');
            trs.forEach(tr => {
                const text = tr.textContent || '';
                
                // Ligne 1 - AA : Honoraires
                if (text.includes('AA') || text.includes('Honoraires')) {
                    const lastCell = tr.cells[tr.cells.length - 1];
                    if (lastCell) lastCell.textContent = formatEuro(aaHonoraires);
                }
                
                // Ligne 15 - BW : CARPIMKO
                if (text.includes('BW') || text.includes('CARPIMKO')) {
                    const lastCell = tr.cells[tr.cells.length - 1];
                    if (lastCell) lastCell.textContent = formatEuro(bwCarpimko);
                }

                // Ligne 16 - BX : URSSAF
                if (text.includes('BX') || text.includes('URSSAF')) {
                    const lastCell = tr.cells[tr.cells.length - 1];
                    if (lastCell) lastCell.textContent = formatEuro(bxUrssaf);
                }
            });

            // Mise à jour des totaux (AG, CH, CP)
            document.querySelectorAll('*').forEach(el => {
                if (el.children.length === 0) {
                    const txt = el.textContent || '';
                    if (txt.includes('TOTAL DES RECETTES BRUTES') || txt.includes('AG')) {
                        el.textContent = `TOTAL DES RECETTES BRUTES (Ligne 6 / Code AG) : ${formatEuro(totalRecettesAG)}`;
                    }
                    if (txt.includes('TOTAL DES DÉPENSES') || txt.includes('CH')) {
                        el.textContent = `TOTAL DES DÉPENSES DÉDUCTIBLES (Code CH) : ${formatEuro(totalDepensesCH)}`;
                    }
                    if (txt.includes('BÉNÉFICE') || txt.includes('CP')) {
                        el.textContent = `BÉNÉFICE FISCAL (Ligne 46 / Code CP) : ${formatEuro(beneficeCP)}`;
                    }
                }
            });

        } catch (err) {
            console.error("Erreur declaration2035:", err);
        }
    }

    window.chargerDeclaration2035 = chargerDeclaration2035;

    // Déclenchement automatique au clic sur l'onglet 2035
    document.addEventListener('click', (e) => {
        const el = e.target.closest('button, a, div');
        if (el && el.textContent && el.textContent.trim().includes('2035')) {
            setTimeout(chargerDeclaration2035, 100);
            setTimeout(chargerDeclaration2035, 300);
        }
    });

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        setTimeout(chargerDeclaration2035, 200);
    } else {
        document.addEventListener('DOMContentLoaded', chargerDeclaration2035);
    }
})();
