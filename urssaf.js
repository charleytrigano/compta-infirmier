// ==========================================
// COMPTABILITÉ LIBÉRALE - MODULE URSSAF
// Fichier : urssaf.js
// ==========================================

// Barème et taux URSSAF modifiables par année (Exemple pour PAMC / Infirmier)
window.parametresURSSAF = {
    annee: 2026,
    taux: {
        maladie: 0.001,          // Cotisation Maladie PAMC après prise en charge CPAM
        allocationsFamiliales: 0.00, // Taux progressif (0% pour revenus modérés)
        csgCrds: 0.097,         // CSG (9.2%) + CRDS (0.5%)
        cfpForfait: 60.00       // Formation professionnelle (forfait annuel)
    }
};

// Fonction principale : Calcul et affichage de la déclaration URSSAF
window.afficherDeclarationURSSAF = async function() {
    const conteneur = document.getElementById('vue-urssaf');
    if (!conteneur) return;

    // 1. Récupération des transactions depuis Supabase
    let transactions = [];
    if (window.supabaseClient) {
        try {
            const { data, error } = await window.supabaseClient.from('transactions').select('*');
            if (error) {
                console.error("Erreur Supabase URSSAF :", error);
            } else if (data) {
                transactions = data;
            }
        } catch (e) {
            console.warn("Exception lors de la récupération des transactions pour URSSAF", e);
        }
    }

    // 2. Calcul des bases trimestrielles de recettes
    const basesTrimestrielles = window.calculerBasesTrimestrielles(transactions);

    // 3. Calcul du total annuel et des cotisations estimées
    const totalBaseAnnuelle = basesTrimestrielles.reduce((a, b) => a + b, 0);
    const cotisations = window.calculerCotisationsUrssaf(totalBaseAnnuelle);

    // 4. Génération de l'affichage HTML
    conteneur.innerHTML = `
        <div style="background:#ffffff; border-radius:8px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; flex-wrap:wrap; gap:10px;">
                <div>
                    <h2 style="margin:0; color:#0f172a;">🏛️ Déclaration & Estimation URSSAF (${window.parametresURSSAF.annee})</h2>
                    <span style="color:#64748b; font-size:0.875rem;">Praticiens et Auxiliaires Médicaux Conventionnés (PAMC)</span>
                </div>
                <button class="btn-primary" onclick="window.ouvrirParametresUrssaf()" style="background-color:#475569;">⚙️ Ajuster les taux (${window.parametresURSSAF.annee})</button>
            </div>

            <!-- TABLEAU DES BASES TRIMESTRIELLES -->
            <h3 style="color:#334155; margin-top:20px;">1. Recettes / Bases trimestrielles réalisées</h3>
            <table style="width:100%; border-collapse:collapse; margin-bottom:25px;">
                <thead>
                    <tr style="background:#f1f5f9;">
                        <th style="padding:10px; border-bottom:2px solid #cbd5e1;">Période</th>
                        <th style="padding:10px; border-bottom:2px solid #cbd5e1; text-align:right;">Base retenue (€)</th>
                        <th style="padding:10px; border-bottom:2px solid #cbd5e1; text-align:right;">Acompte trimestriel estimé (€)</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td style="padding:10px; border-bottom:1px solid #e2e8f0; font-weight:600;">1er Trimestre (Jan - Mar)</td>
                        <td style="padding:10px; border-bottom:1px solid #e2e8f0; text-align:right; font-weight:600; color:#0f172a;">${basesTrimestrielles[0].toFixed(2)} €</td>
                        <td style="padding:10px; border-bottom:1px solid #e2e8f0; text-align:right; font-weight:bold; color:#2563eb;">${(cotisations.total / 4).toFixed(2)} €</td>
                    </tr>
                    <tr>
                        <td style="padding:10px; border-bottom:1px solid #e2e8f0; font-weight:600;">2ème Trimestre (Avr - Juin)</td>
                        <td style="padding:10px; border-bottom:1px solid #e2e8f0; text-align:right; font-weight:600; color:#0f172a;">${basesTrimestrielles[1].toFixed(2)} €</td>
                        <td style="padding:10px; border-bottom:1px solid #e2e8f0; text-align:right; font-weight:bold; color:#2563eb;">${(cotisations.total / 4).toFixed(2)} €</td>
                    </tr>
                    <tr>
                        <td style="padding:10px; border-bottom:1px solid #e2e8f0; font-weight:600;">3ème Trimestre (Juil - Sept)</td>
                        <td style="padding:10px; border-bottom:1px solid #e2e8f0; text-align:right; font-weight:600; color:#0f172a;">${basesTrimestrielles[2].toFixed(2)} €</td>
                        <td style="padding:10px; border-bottom:1px solid #e2e8f0; text-align:right; font-weight:bold; color:#2563eb;">${(cotisations.total / 4).toFixed(2)} €</td>
                    </tr>
                    <tr>
                        <td style="padding:10px; border-bottom:1px solid #e2e8f0; font-weight:600;">4ème Trimestre (Oct - Déc)</td>
                        <td style="padding:10px; border-bottom:1px solid #e2e8f0; text-align:right; font-weight:600; color:#0f172a;">${basesTrimestrielles[3].toFixed(2)} €</td>
                        <td style="padding:10px; border-bottom:1px solid #e2e8f0; text-align:right; font-weight:bold; color:#2563eb;">${(cotisations.total / 4).toFixed(2)} €</td>
                    </tr>
                    <tr style="background:#f8fafc; font-weight:bold;">
                        <td style="padding:12px;">TOTAL ANNUEL</td>
                        <td style="padding:12px; text-align:right; color:#0f172a; font-size:1.05rem;">${totalBaseAnnuelle.toFixed(2)} €</td>
                        <td style="padding:12px; text-align:right; color:#1e40af; font-size:1.05rem;">${cotisations.total.toFixed(2)} €</td>
                    </tr>
                </tbody>
            </table>

            <!-- VENTILATION DES COTISATIONS -->
            <h3 style="color:#334155;">2. Détail estimatif des cotisations dues</h3>
            <div style="background:#f8fafc; padding:15px; border-radius:8px; border:1px solid #e2e8f0;">
                <div style="display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid #cbd5e1;">
                    <span>Assurance Maladie-Maternité :</span>
                    <strong>${cotisations.maladie.toFixed(2)} €</strong>
                </div>
                <div style="display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid #cbd5e1;">
                    <span>Allocations Familiales :</span>
                    <strong>${cotisations.allocations.toFixed(2)} €</strong>
                </div>
                <div style="display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid #cbd5e1;">
                    <span>CSG / CRDS :</span>
                    <strong>${cotisations.csg.toFixed(2)} €</strong>
                </div>
                <div style="display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid #cbd5e1;">
                    <span>Contribution Formation Professionnelle (CFP) :</span>
                    <strong>${cotisations.cfp.toFixed(2)} €</strong>
                </div>
                <div style="display:flex; justify-content:space-between; padding:12px 0; font-size:1.1rem; color:#1e3a8a;">
                    <strong>ESTIMATION TOTAL ANNUEL URSSAF :</strong>
                    <strong>${cotisations.total.toFixed(2)} €</strong>
                </div>
            </div>
        </div>
    `;
};

// Fonction de calcul des recettes trimestrielles
window.calculerBasesTrimestrielles = function(transactions) {
    let q = [0, 0, 0, 0];
    if (!transactions || !Array.isArray(transactions)) return q;

    transactions.forEach(t => {
        if (!t.date) return;

        // Détection souple si la transaction est une recette
        const typeRecette = (t.type && t.type.toLowerCase() === 'recette') || 
                            (t.type_operation && t.type_operation.toLowerCase() === 'recette') ||
                            (t.categorie && t.categorie.toLowerCase().includes('soins'));

        if (typeRecette) {
            const dateObj = new Date(t.date);
            const mois = dateObj.getMonth(); // 0 (Janvier) à 11 (Décembre)
            const montant = parseFloat(t.montant) || 0;

            if (mois >= 0 && mois <= 2) q[0] += montant;       // Q1 (Jan-Mar)
            else if (mois >= 3 && mois <= 5) q[1] += montant;  // Q2 (Avr-Juin)
            else if (mois >= 6 && mois <= 8) q[2] += montant;  // Q3 (Juil-Sept)
            else if (mois >= 9 && mois <= 11) q[3] += montant; // Q4 (Oct-Déc)
        }
    });

    return q;
};

// Formule de calcul des cotisations
window.calculerCotisationsUrssaf = function(base) {
    const t = window.parametresURSSAF.taux;
    const maladie = base * t.maladie;
    const allocations = base * t.allocationsFamiliales;
    const csg = base * t.csgCrds;
    const cfp = t.cfpForfait;

    return {
        maladie: maladie,
        allocations: allocations,
        csg: csg,
        cfp: cfp,
        total: maladie + allocations + csg + cfp
    };
};

// Dialogue de paramétrage des taux
window.ouvrirParametresUrssaf = function() {
    const nouveauTauxCSG = prompt("Taux CSG/CRDS (ex: 0.097 pour 9.7%) :", window.parametresURSSAF.taux.csgCrds);
    if (nouveauTauxCSG !== null) {
        window.parametresURSSAF.taux.csgCrds = parseFloat(nouveauTauxCSG) || 0.097;
        window.afficherDeclarationURSSAF();
    }
};
