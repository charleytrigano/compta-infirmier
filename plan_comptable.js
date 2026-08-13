// ==========================================
// COMPTABILITÉ LIBÉRALE - MODULE PLAN COMPTABLE
// Fichier : plan_comptable.js
// ==========================================

// Liste exacte des comptes enregistrés dans Supabase
const PLAN_COMPTABLE_DEFAUT = [
    { id: 1, code: '706000', nom: 'Soins infirmiers / Honoraires', type: 'recette' },
    { id: 2, code: '645200', nom: 'Cotisations CARPIMKO', type: 'depense' },
    { id: 3, code: '645100', nom: 'Cotisations URSSAF', type: 'depense' },
    { id: 4, code: '616000', nom: 'Assurances & RCP', type: 'depense' },
    { id: 5, code: '625100', nom: 'Frais de déplacement / Carburant', type: 'depense' },
    { id: 6, code: '606300', nom: 'Petit matériel médical', type: 'depense' },
    { id: 7, code: '622600', nom: 'Frais de comptabilité & Logiciels', type: 'depense' },
    { id: 8, code: '613200', nom: 'Loyer & Charges locatives', type: 'depense' },
    { id: 9, code: '627000', nom: 'Frais bancaires', type: 'depense' }
];

// Fonction principale d'affichage dynamique du plan comptable
window.afficherPlanComptable = async function() {
    const conteneur = document.getElementById('conteneur-plan-comptable');
    if (!conteneur) return;

    let comptes = PLAN_COMPTABLE_DEFAUT;

    // Tentative de récupération directe depuis la base Supabase
    if (window.supabaseClient) {
        try {
            const { data, error } = await window.supabaseClient
                .from('plan_comptable')
                .select('*')
                .order('code', { ascending: true });
            
            if (!error && data && data.length > 0) {
                comptes = data;
            }
        } catch (e) {
            console.warn("Mise en fallback sur les données locales du plan comptable.", e);
        }
    }

    window.listePlanComptable = comptes;

    conteneur.innerHTML = `
        <div style="background:#ffffff; border-radius:8px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; flex-wrap:wrap; gap:15px;">
                <div>
                    <h3 style="margin:0; color:#0f172a; font-size:1.25rem;">📊 Plan Comptable - Infirmiers Libéraux</h3>
                    <span style="color:#64748b; font-size:0.875rem;">Liste complète des comptes enregistrés</span>
                </div>
                <input type="text" id="recherche-plan" class="form-control" placeholder="🔍 Rechercher par code ou libellé..." style="max-width:300px; padding:8px 12px; border:1px solid #cbd5e1; border-radius:6px;" oninput="window.filtrerPlanComptable()">
            </div>

            <table style="width:100%; border-collapse:collapse;">
                <thead>
                    <tr style="background:#f1f5f9; text-align:left;">
                        <th style="padding:12px; width:100px; border-bottom:2px solid #e2e8f0;">ID</th>
                        <th style="padding:12px; width:140px; border-bottom:2px solid #e2e8f0;">Code Compte</th>
                        <th style="padding:12px; border-bottom:2px solid #e2e8f0;">Intitulé du compte</th>
                        <th style="padding:12px; width:140px; border-bottom:2px solid #e2e8f0;">Type</th>
                    </tr>
                </thead>
                <tbody id="body-tableau-plan">
                    ${window.genererLignesPlanComptable(comptes)}
                </tbody>
            </table>
        </div>
    `;
};

// Fonction de rendu des lignes du tableau
window.genererLignesPlanComptable = function(liste) {
    if (!liste || liste.length === 0) {
        return `<tr><td colspan="4" style="text-align:center; color:#64748b; padding:20px;">Aucun compte trouvé.</td></tr>`;
    }

    return liste.map(item => {
        const typeStr = (item.type || '').toLowerCase();
        const estRecette = typeStr === 'recette';
        return `
            <tr style="border-bottom:1px solid #e2e8f0;">
                <td style="padding:12px; color:#64748b; font-size:13px;">${item.id || '-'}</td>
                <td style="padding:12px; font-weight:bold; color:#2563eb;">${item.code || ''}</td>
                <td style="padding:12px; font-weight:500; color:#1e293b;">${item.nom || ''}</td>
                <td style="padding:12px;">
                    <span style="padding:4px 10px; border-radius:12px; font-size:12px; font-weight:600; background:${estRecette ? '#dcfce7' : '#fee2e2'}; color:${estRecette ? '#15803d' : '#b91c1c'}; text-transform:capitalize;">
                        ${item.type || 'depense'}
                    </span>
                </td>
            </tr>
        `;
    }).join('');
};

// Fonction de filtrage par recherche
window.filtrerPlanComptable = function() {
    const champ = document.getElementById('recherche-plan');
    if (!champ) return;

    const filtre = champ.value.toLowerCase();
    const liste = window.listePlanComptable || PLAN_COMPTABLE_DEFAUT;

    const listeFiltree = liste.filter(c => {
        const code = String(c.code || '').toLowerCase();
        const nom = String(c.nom || '').toLowerCase();
        const type = String(c.type || '').toLowerCase();
        return code.includes(filtre) || nom.includes(filtre) || type.includes(filtre);
    });

    const body = document.getElementById('body-tableau-plan');
    if (body) {
        body.innerHTML = window.genererLignesPlanComptable(listeFiltree);
    }
};

// Exécution au chargement du document
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
        if (window.afficherPlanComptable) window.afficherPlanComptable();
    });
} else {
    window.afficherPlanComptable();
}
