// ==========================================
// COMPTABILITÉ LIBÉRALE - MODULE PLAN COMPTABLE
// Fichier : planComptable.js
// ==========================================

// Liste par défaut des comptes BNC Infirmiers Libéraux
const PLAN_COMPTABLE_DEFAUT = [
    { code: '706000', nom: 'Soins infirmiers / Honoraires', type: 'Recette', ligne2035: 'Ligne 1 (AA)' },
    { code: '708000', nom: 'Remboursements de frais et débours', type: 'Recette', ligne2035: 'Ligne 3 (AC)' },
    { code: '606300', nom: 'Achats et petit matériel médical', type: 'Dépense', ligne2035: 'Ligne 8 (BA)' },
    { code: '606400', nom: 'Fournitures de bureau, documentation, PT', type: 'Dépense', ligne2035: 'Ligne 9 (BB)' },
    { code: '613200', nom: 'Loyer professionnel et charges locatives', type: 'Dépense', ligne2035: 'Ligne 11 (BT)' },
    { code: '616000', nom: 'Assurances (RCP, locaux, véhicules)', type: 'Dépense', ligne2035: 'Ligne 14 (BV)' },
    { code: '622600', nom: 'Honoraires comptables, logiciels, expertises', type: 'Dépense', ligne2035: 'Ligne 22 (CC)' },
    { code: '625100', nom: 'Frais de déplacement, carburant, transport', type: 'Dépense', ligne2035: 'Ligne 19 (CA)' },
    { code: '627000', nom: 'Frais bancaires et agios', type: 'Dépense', ligne2035: 'Ligne 25 (CF)' },
    { code: '645100', nom: 'Cotisations sociales obligatoires : URSSAF', type: 'Dépense', ligne2035: 'Ligne 16 (BX)' },
    { code: '645200', nom: 'Cotisations sociales obligatoires : CARPIMKO', type: 'Dépense', ligne2035: 'Ligne 15 (BW)' },
    { code: '658000', nom: 'Diverses dépenses à déduire', type: 'Dépense', ligne2035: 'Ligne 26 (CG)' }
];

// Fonction d'affichage dynamique du plan comptable
window.afficherPlanComptable = async function() {
    const conteneur = document.getElementById('conteneur-plan-comptable');
    if (!conteneur) return;

    let comptes = PLAN_COMPTABLE_DEFAUT;

    // Récupération dynamique depuis Supabase si disponible
    if (window.supabaseClient) {
        try {
            const { data, error } = await window.supabaseClient
                .from('plan_comptable')
                .select('*');
            
            if (!error && data && data.length > 0) {
                comptes = data;
            }
        } catch (e) {
            console.warn("Utilisation du plan comptable par défaut.", e);
        }
    }

    window.listePlanComptable = comptes;

    conteneur.innerHTML = `
        <div style="background:#ffffff; border-radius:8px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; flex-wrap:wrap; gap:15px;">
                <div>
                    <h3 style="margin:0; color:#0f172a; font-size:1.25rem;">📊 Plan Comptable BNC - Infirmiers Libéraux</h3>
                    <span style="color:#64748b; font-size:0.875rem;">Nomenclature des comptes et correspondances avec la Déclaration 2035</span>
                </div>
                <input type="text" id="recherche-plan" class="form-control" placeholder="🔍 Rechercher par code ou libellé..." style="max-width:300px; padding:8px 12px; border:1px solid #cbd5e1; border-radius:6px;" oninput="window.filtrerPlanComptable()">
            </div>

            <table style="width:100%; border-collapse:collapse;">
                <thead>
                    <tr style="background:#f1f5f9; text-align:left;">
                        <th style="padding:12px; width:130px; border-bottom:2px solid #e2e8f0;">Code Compte</th>
                        <th style="padding:12px; border-bottom:2px solid #e2e8f0;">Intitulé du compte</th>
                        <th style="padding:12px; width:130px; border-bottom:2px solid #e2e8f0;">Type</th>
                        <th style="padding:12px; width:180px; border-bottom:2px solid #e2e8f0;">Ligne 2035</th>
                    </tr>
                </thead>
                <tbody id="body-tableau-plan">
                    ${window.genererLignesPlanComptable(comptes)}
                </tbody>
            </table>
        </div>
    `;
};

// Génération HTML des lignes de tableau
window.genererLignesPlanComptable = function(liste) {
    if (!liste || liste.length === 0) {
        return `<tr><td colspan="4" style="text-align:center; color:#64748b; padding:20px;">Aucun compte trouvé.</td></tr>`;
    }

    return liste.map(item => {
        const estRecette = (item.type || '').toLowerCase() === 'recette';
        return `
            <tr style="border-bottom:1px solid #e2e8f0;">
                <td style="padding:12px; font-weight:bold; color:#2563eb;">${item.code || item.num_compte || ''}</td>
                <td style="padding:12px; font-weight:500; color:#1e293b;">${item.nom || item.libelle || ''}</td>
                <td style="padding:12px;">
                    <span style="padding:4px 10px; border-radius:12px; font-size:12px; font-weight:600; background:${estRecette ? '#dcfce7' : '#fee2e2'}; color:${estRecette ? '#15803d' : '#b91c1c'};">
                        ${item.type || 'Dépense'}
                    </span>
                </td>
                <td style="padding:12px; font-weight:600; color:#475569;">${item.ligne2035 || item.code_2035 || '-'}</td>
            </tr>
        `;
    }).join('');
};

// Filtrage en direct
window.filtrerPlanComptable = function() {
    const champ = document.getElementById('recherche-plan');
    if (!champ) return;

    const filtre = champ.value.toLowerCase();
    const liste = window.listePlanComptable || PLAN_COMPTABLE_DEFAUT;

    const listeFiltree = liste.filter(c => {
        const code = (c.code || c.num_compte || '').toLowerCase();
        const nom = (c.nom || c.libelle || '').toLowerCase();
        const ligne = (c.ligne2035 || c.code_2035 || '').toLowerCase();
        return code.includes(filtre) || nom.includes(filtre) || ligne.includes(filtre);
    });

    const body = document.getElementById('body-tableau-plan');
    if (body) {
        body.innerHTML = window.genererLignesPlanComptable(listeFiltree);
    }
};
