/* ==========================================================================
   MODULE PLAN COMPTABLE BNC / INFIRMIER (COMPLET : CLASSES 1 À 7)
   ========================================================================== */

window.PLAN_COMPTABLE_BNC = [
    // --- CLASSE 1 : CAPITAUX ---
    { id: 1, code: '108000', intitule: 'Compte de l exploitant (Prélèvements / Apports)', type: 'Bilan' },

    // --- CLASSE 2 : IMMOBILISATIONS ---
    { id: 2, code: '215400', intitule: 'Matériel médical et biomédical', type: 'Immobilisation' },
    { id: 3, code: '218200', intitule: 'Matériel de transport / Véhicule', type: 'Immobilisation' },
    { id: 4, code: '218300', intitule: 'Matériel informatique et de bureau', type: 'Immobilisation' },
    { id: 5, code: '281500', intitule: 'Amortissements du matériel', type: 'Amortissement' },

    // --- CLASSE 4 : COMPTES DE TIERS ---
    { id: 6, code: '401000', intitule: 'Fournisseurs et Dettes à régler', type: 'Tiers' },
    { id: 7, code: '411000', intitule: 'Patients & Caisses (Créances d honoraires)', type: 'Tiers' },
    { id: 8, code: '437000', intitule: 'Organismes sociaux (URSSAF, CARPIMKO)', type: 'Tiers' },
    { id: 9, code: '445700', intitule: 'TVA collectée', type: 'Tiers' },
    { id: 10, code: '445660', intitule: 'TVA déductible sur autres biens et services', type: 'Tiers' },

    // --- CLASSE 5 : COMPTES FINANCIERS ---
    { id: 11, code: '512000', intitule: 'Compte Bancaire Professionnel', type: 'Banque' },
    { id: 12, code: '530000', intitule: 'Caisse Espèces', type: 'Caisse' },

    // --- CLASSE 6 : CHARGES & DÉPENSES ---
    { id: 13, code: '606300', intitule: 'Petit matériel médical et fournitures de soins', type: 'Dépense' },
    { id: 14, code: '606400', intitule: 'Fournitures de bureau et documentation', type: 'Dépense' },
    { id: 15, code: '613200', intitule: 'Loyer et charges locatives du cabinet', type: 'Dépense' },
    { id: 16, code: '616000', intitule: 'Assurances professionnelles & RCP', type: 'Dépense' },
    { id: 17, code: '622600', intitule: 'Frais de comptabilité, logiciels & AGA', type: 'Dépense' },
    { id: 18, code: '625100', intitule: 'Frais de déplacement, carburant & véhicule', type: 'Dépense' },
    { id: 19, code: '627000', intitule: 'Frais bancaires et commissions', type: 'Dépense' },
    { id: 20, code: '635000', intitule: 'Impôts et taxes (CFE, Formations, etc.)', type: 'Dépense' },
    { id: 21, code: '645100', intitule: 'Cotisations sociales URSSAF', type: 'Dépense' },
    { id: 22, code: '645200', intitule: 'Cotisations retraite CARPIMKO', type: 'Dépense' },
    { id: 23, code: '681100', intitule: 'Dotations aux amortissements', type: 'Dépense' },

    // --- CLASSE 7 : PRODUITS & RECETTES ---
    { id: 24, code: '706000', intitule: 'Soins infirmiers / Honoraires conventionnés', type: 'Recette' },
    { id: 25, code: '708000', intitule: 'Produits annexes (Indemnités horokilométriques...)', type: 'Recette' },
    { id: 26, code: '709000', intitule: 'Rétrocessions d honoraires reçues', type: 'Recette' }
];

window.afficherPlanComptable = function(filtreText) {
    var container = document.getElementById('contenu-plan-comptable') || 
                      document.getElementById('plan-comptable-contenu') || 
                      document.getElementById('vue-plan-comptable') || 
                      document.getElementById('plan-comptable-container');

    if (!container) {
        var divs = document.querySelectorAll('div');
        divs.forEach(function(div) {
            if (div.textContent.includes('Chargement du plan comptable...')) {
                container = div;
            }
        });
    }

    if (!container) return;

    var liste = window.PLAN_COMPTABLE_BNC;

    if (filtreText && filtreText.trim() !== '') {
        var term = filtreText.toLowerCase().trim();
        liste = liste.filter(function(item) {
            return item.code.toLowerCase().includes(term) || item.intitule.toLowerCase().includes(term);
        });
    }

    var html = `
        <div style="background:#ffffff; border-radius:8px; border:1px solid #e2e8f0; padding:15px; margin-top:10px; box-shadow:0 1px 3px rgba(0,0,0,0.05);">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
                <div>
                    <h3 style="font-size:16px; font-weight:700; color:#0f172a; margin:0;">Plan Comptable - Infirmiers Libéraux</h3>
                    <p style="font-size:12px; color:#64748b; margin:2px 0 0 0;">Liste complète des comptes enregistrés (Classes 1 à 7)</p>
                </div>
                <input type="text" id="input-search-plan" placeholder="🔍 Rechercher par code ou libellé..." 
                       oninput="window.afficherPlanComptable(this.value)" 
                       value="${filtreText || ''}"
                       style="padding:8px 12px; border:1px solid #cbd5e1; border-radius:6px; font-size:13px; width:260px; outline:none;" />
            </div>

            <div style="overflow-x:auto;">
                <table style="width:100%; border-collapse:collapse; font-size:13px; text-align:left;">
                    <thead>
                        <tr style="background:#f8fafc; color:#475569; border-bottom:1px solid #e2e8f0;">
                            <th style="padding:10px 15px; width:10%;">ID</th>
                            <th style="padding:10px 15px; width:20%;">Code Compte</th>
                            <th style="padding:10px 15px;">Intitulé du compte</th>
                            <th style="padding:10px 15px; text-align:center; width:20%;">Type</th>
                        </tr>
                    </thead>
                    <tbody>
    `;

    liste.forEach(function(item) {
        var badgeColor = '#64748b';
        var badgeBg = '#f1f5f9';

        if (item.type === 'Recette') { badgeColor = '#15803d'; badgeBg = '#dcfce7'; }
        else if (item.type === 'Dépense') { badgeColor = '#b91c1c'; badgeBg = '#fee2e2'; }
        else if (item.type === 'Banque' || item.type === 'Caisse') { badgeColor = '#0369a1'; badgeBg = '#e0f2fe'; }
        else if (item.type === 'Tiers' || item.type === 'Bilan') { badgeColor = '#6b21a8'; badgeBg = '#f3e8ff'; }

        html += `
            <tr style="border-bottom:1px solid #f1f5f9;">
                <td style="padding:10px 15px; color:#94a3b8;">${item.id}</td>
                <td style="padding:10px 15px; font-weight:700; color:#0f172a;">${item.code}</td>
                <td style="padding:10px 15px; color:#334155;">${item.intitule}</td>
                <td style="padding:10px 15px; text-align:center;">
                    <span style="display:inline-block; padding:3px 10px; border-radius:12px; font-size:11px; font-weight:600; color:${badgeColor}; background:${badgeBg};">
                        ${item.type}
                    </span>
                </td>
            </tr>
        `;
    });

    html += `
                    </tbody>
                </table>
            </div>
        </div>
    `;

    container.innerHTML = html;

    var searchInput = document.getElementById('input-search-plan');
    if (searchInput && filtreText) {
        searchInput.focus();
        searchInput.setSelectionRange(filtreText.length, filtreText.length);
    }
};

// Execution automatique
setInterval(function() {
    var container = document.getElementById('contenu-plan-comptable') || 
                      document.getElementById('plan-comptable-container');
    if (container && container.innerHTML.includes('Chargement du plan comptable...')) {
        window.afficherPlanComptable();
    }
}, 300);
