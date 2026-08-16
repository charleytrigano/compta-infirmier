/* ==========================================================================
   MODULE PLAN COMPTABLE BNC & COMPTES AUXILIAIRES 411
   ========================================================================== */

window.PLAN_COMPTABLE_DEFAUT = [
    { id: 1, code: '108000', intitule: 'Compte de l exploitant (Prélèvements / Apports)', type: 'Bilan' },
    { id: 2, code: '215400', intitule: 'Matériel médical et biomédical', type: 'Immobilisation' },
    { id: 3, code: '218200', intitule: 'Matériel de transport / Véhicule', type: 'Immobilisation' },
    { id: 4, code: '218300', intitule: 'Matériel informatique et de bureau', type: 'Immobilisation' },
    { id: 5, code: '281500', intitule: 'Amortissements du matériel', type: 'Amortissement' },
    { id: 6, code: '401000', intitule: 'Fournisseurs et Dettes à régler', type: 'Tiers' },
    { id: 7, code: '411000', intitule: 'Patients & Caisses (Compte Collectif)', type: 'Tiers' },
    { id: 8, code: '437000', intitule: 'Organismes sociaux (URSSAF, CARPIMKO)', type: 'Tiers' },
    { id: 9, code: '445700', intitule: 'TVA collectée', type: 'Tiers' },
    { id: 10, code: '445660', intitule: 'TVA déductible sur autres biens et services', type: 'Tiers' },
    { id: 11, code: '512000', intitule: 'Compte Bancaire Professionnel', type: 'Banque' },
    { id: 12, code: '530000', intitule: 'Caisse Espèces', type: 'Caisse' },
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
    { id: 24, code: '706000', intitule: 'Soins infirmiers / Honoraires conventionnés', type: 'Recette' },
    { id: 25, code: '708000', intitule: 'Produits annexes (Indemnités horokilométriques...)', type: 'Recette' },
    { id: 26, code: '709000', intitule: 'Rétrocessions d honoraires reçues', type: 'Recette' }
];

window.PLAN_AUXILIAIRE_411_DEFAUT = [
    { id: 1, code: '411200', intitule: 'CPAM / Assurance Maladie (Tiers-Payant)', categorie: 'Caisse Sécurité Sociale' },
    { id: 2, code: '411300', intitule: 'Mutuelles / Complémentaires Santé', categorie: 'Mutuelle' },
    { id: 3, code: '411100', intitule: 'Patients - Règlements Directs', categorie: 'Patient Direct' },
    { id: 4, code: '411400', intitule: 'SSIAD / HAD / Structures de soins', categorie: 'Etablissement' },
    { id: 5, code: '411ABADIE', intitule: 'ABADIE (Patient / Tiers)', categorie: 'Patient Direct' },
    { id: 6, code: '411SAINTANDRE', intitule: 'SAINT-ANDRE (Patient / Tiers)', categorie: 'Patient Direct' }
];

if (!window.ongletActifPlan) {
    window.ongletActifPlan = 'general';
}

window.chargerDonneesComptables = function() {
    var general = localStorage.getItem('PLAN_COMPTABLE_BNC_CUSTOM');
    window.PLAN_COMPTABLE_BNC = general ? JSON.parse(general) : window.PLAN_COMPTABLE_DEFAUT;

    var aux = localStorage.getItem('PLAN_AUXILIAIRE_411_CUSTOM');
    var listeAux = aux ? JSON.parse(aux) : window.PLAN_AUXILIAIRE_411_DEFAUT;

    // Récupération des tiers existants dans la session/transactions si présents
    if (window.TRANSACTIONS && Array.isArray(window.TRANSACTIONS)) {
        window.TRANSACTIONS.forEach(function(t) {
            if (t.compte_num && String(t.compte_num).startsWith('411')) {
                var existe = listeAux.some(function(a) { return a.code === t.compte_num; });
                if (!existe) {
                    listeAux.push({
                        id: listeAux.length + 1,
                        code: String(t.compte_num),
                        intitule: t.tiers || t.description || 'Tiers 411',
                        categorie: 'Patient Direct'
                    });
                }
            }
        });
    }

    window.PLAN_AUXILIAIRE_411 = listeAux;
};
window.chargerDonneesComptables();

window.changerOngletPlan = function(type) {
    window.ongletActifPlan = type;
    window.afficherPlanComptable();
};

window.trouverZonePlan = function() {
    // Ne cible QUE le conteneur interne pour ne pas écraser la barre de navigation
    var el = document.getElementById('vue-plan-comptable') || 
             document.getElementById('plan-comptable-container');
    
    if (el) return el;

    var divs = document.querySelectorAll('div');
    for (var i = 0; i < divs.length; i++) {
        var txt = divs[i].textContent || '';
        if (txt.includes('Chargement du plan comptable...') || txt.includes('Comptes Généraux (Classes 1 à 7)')) {
            // S'assurer qu'il ne s'agit pas du grand conteneur racine avec les onglets généraux
            if (!divs[i].querySelector('button') || divs[i].id === 'vue-plan-comptable') {
                return divs[i];
            }
        }
    }
    return null;
};

window.afficherPlanComptable = function(filtreText) {
    window.chargerDonneesComptables();
    var container = window.trouverZonePlan();
    if (!container) return;

    var isGeneral = (window.ongletActifPlan === 'general');
    var liste = isGeneral ? window.PLAN_COMPTABLE_BNC : window.PLAN_AUXILIAIRE_411;

    if (filtreText && filtreText.trim() !== '') {
        var term = filtreText.toLowerCase().trim();
        liste = liste.filter(function(item) {
            var cat = item.categorie ? item.categorie.toLowerCase() : '';
            var type = item.type ? item.type.toLowerCase() : '';
            return item.code.toLowerCase().includes(term) || 
                   item.intitule.toLowerCase().includes(term) ||
                   cat.includes(term) || type.includes(term);
        });
    }

    var html = `
        <div style="background:#ffffff; border-radius:8px; border:1px solid #e2e8f0; padding:20px; box-shadow:0 1px 3px rgba(0,0,0,0.05); margin-top:10px;">
            
            <!-- Onglets d'alternance du Plan -->
            <div style="display:flex; border-bottom:2px solid #e2e8f0; margin-bottom:15px; gap:10px;">
                <button type="button" onclick="window.changerOngletPlan('general')" 
                        style="padding:10px 18px; font-weight:700; font-size:13px; border:none; background:none; cursor:pointer; border-bottom:3px solid ${isGeneral ? '#2563eb' : 'transparent'}; color:${isGeneral ? '#2563eb' : '#64748b'};">
                    Plan Comptable Général
                </button>
                <button type="button" onclick="window.changerOngletPlan('auxiliaire')" 
                        style="padding:10px 18px; font-weight:700; font-size:13px; border:none; background:none; cursor:pointer; border-bottom:3px solid ${!isGeneral ? '#2563eb' : 'transparent'}; color:${!isGeneral ? '#2563eb' : '#64748b'};">
                    Comptes Individuels Patients / Caisses (411 Auxiliaires)
                </button>
            </div>

            <!-- En-tête -->
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px; flex-wrap:wrap; gap:10px;">
                <div>
                    <h3 style="font-size:15px; font-weight:700; color:#0f172a; margin:0;">
                        ${isGeneral ? 'Comptes Généraux (Classes 1 à 7)' : 'Plan Auxiliaire - Comptes Individuels 411'}
                    </h3>
                    <p style="font-size:12px; color:#64748b; margin:2px 0 0 0;">
                        ${isGeneral ? 'Structure générale de votre comptabilité BNC' : 'Suivi individuel par patient, caisse CPAM ou mutuelle'}
                    </p>
                </div>
                <div style="display:flex; gap:10px;">
                    <input type="text" id="input-search-plan" placeholder="🔍 Rechercher..." 
                           oninput="window.afficherPlanComptable(this.value)" 
                           value="${filtreText || ''}"
                           style="padding:8px 12px; border:1px solid #cbd5e1; border-radius:6px; font-size:13px; width:200px; outline:none;" />
                    <button type="button" onclick="${isGeneral ? 'window.ouvrirModalNouveauCompte()' : 'window.ouvrirModalNouveau411()'}" 
                            style="background:#2563eb; color:#fff; border:none; padding:8px 14px; border-radius:6px; font-size:13px; font-weight:600; cursor:pointer;">
                        ${isGeneral ? '+ Nouveau compte général' : '+ Nouveau compte 411'}
                    </button>
                </div>
            </div>

            <!-- Tableau -->
            <div style="overflow-x:auto;">
                <table style="width:100%; border-collapse:collapse; font-size:13px; text-align:left;">
                    <thead>
                        <tr style="background:#f8fafc; color:#475569; border-bottom:1px solid #e2e8f0;">
                            <th style="padding:10px 15px; width:8%;">ID</th>
                            <th style="padding:10px 15px; width:22%;">Code Compte</th>
                            <th style="padding:10px 15px;">Intitulé / Nom du Tiers</th>
                            <th style="padding:10px 15px; text-align:center; width:22%;">${isGeneral ? 'Type' : 'Catégorie'}</th>
                        </tr>
                    </thead>
                    <tbody>
    `;

    liste.forEach(function(item) {
        var badgeColor = '#64748b';
        var badgeBg = '#f1f5f9';
        var labelType = isGeneral ? item.type : item.categorie;

        if (labelType === 'Recette' || labelType === 'Patient Direct') { badgeColor = '#15803d'; badgeBg = '#dcfce7'; }
        else if (labelType === 'Dépense') { badgeColor = '#b91c1c'; badgeBg = '#fee2e2'; }
        else if (labelType === 'Banque' || labelType === 'Caisse Sécurité Sociale') { badgeColor = '#0369a1'; badgeBg = '#e0f2fe'; }
        else if (labelType === 'Mutuelle' || labelType === 'Etablissement' || labelType === 'Tiers') { badgeColor = '#6b21a8'; badgeBg = '#f3e8ff'; }

        html += `
            <tr style="border-bottom:1px solid #f1f5f9;">
                <td style="padding:10px 15px; color:#94a3b8;">${item.id}</td>
                <td style="padding:10px 15px; font-weight:700; color:#0f172a;">${item.code}</td>
                <td style="padding:10px 15px; color:#334155;">${item.intitule}</td>
                <td style="padding:10px 15px; text-align:center;">
                    <span style="display:inline-block; padding:3px 10px; border-radius:12px; font-size:11px; font-weight:600; color:${badgeColor}; background:${badgeBg};">
                        ${labelType}
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

window.ouvrirModalNouveau411 = function() {
    var existingModal = document.getElementById('modal-nouveau-411');
    if (existingModal) existingModal.remove();

    var modal = document.createElement('div');
    modal.id = 'modal-nouveau-411';
    modal.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(15,23,42,0.5); display:flex; justify-content:center; align-items:center; z-index:9999;';

    modal.innerHTML = `
        <div style="background:#fff; border-radius:8px; padding:20px; width:400px; box-shadow:0 10px 25px rgba(0,0,0,0.15);">
            <h3 style="margin-top:0; color:#0f172a; font-size:16px;">Créer un compte individuel 411</h3>
            
            <label style="display:block; font-size:12px; font-weight:600; color:#475569; margin-top:10px;">Code Compte (ex: 411ABADIE)</label>
            <input type="text" id="add-code-411" style="width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:6px; margin-top:4px; box-sizing:border-box;" placeholder="411ABADIE" />

            <label style="display:block; font-size:12px; font-weight:600; color:#475569; margin-top:10px;">Nom du Patient / Mutuelle</label>
            <input type="text" id="add-nom-411" style="width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:6px; margin-top:4px; box-sizing:border-box;" placeholder="ABADIE" />

            <label style="display:block; font-size:12px; font-weight:600; color:#475569; margin-top:10px;">Catégorie</label>
            <select id="add-cat-411" style="width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:6px; margin-top:4px; box-sizing:border-box;">
                <option value="Patient Direct">Patient - Règlement Direct</option>
                <option value="Caisse Sécurité Sociale">CPAM / Caisse Primaire</option>
                <option value="Mutuelle">Mutuelle / Complémentaire</option>
                <option value="Etablissement">HAD / SSIAD / Clinique</option>
            </select>

            <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:20px;">
                <button type="button" onclick="document.getElementById('modal-nouveau-411').remove()" 
                        style="background:#f1f5f9; color:#475569; border:none; padding:8px 12px; border-radius:6px; cursor:pointer; font-size:12px;">Annuler</button>
                <button type="button" onclick="window.enregistrerNouveau411()" 
                        style="background:#16a34a; color:#fff; border:none; padding:8px 14px; border-radius:6px; cursor:pointer; font-size:12px; font-weight:600;">Créer le compte 411</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
};

window.enregistrerNouveau411 = function() {
    var code = document.getElementById('add-code-411').value.trim();
    var intitule = document.getElementById('add-nom-411').value.trim();
    var cat = document.getElementById('add-cat-411').value;

    if (!code || !intitule) {
        alert('Veuillez remplir le code et le nom du tiers.');
        return;
    }

    if (!code.startsWith('411')) {
        code = '411' + code;
    }

    var nouveau = {
        id: window.PLAN_AUXILIAIRE_411.length + 1,
        code: code.toUpperCase(),
        intitule: intitule,
        categorie: cat
    };

    window.PLAN_AUXILIAIRE_411.push(nouveau);
    localStorage.setItem('PLAN_AUXILIAIRE_411_CUSTOM', JSON.stringify(window.PLAN_AUXILIAIRE_411));

    document.getElementById('modal-nouveau-411').remove();
    window.afficherPlanComptable();
};

window.ouvrirModalNouveauCompte = function() {
    var existingModal = document.getElementById('modal-nouveau-compte');
    if (existingModal) existingModal.remove();

    var modal = document.createElement('div');
    modal.id = 'modal-nouveau-compte';
    modal.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(15,23,42,0.5); display:flex; justify-content:center; align-items:center; z-index:9999;';

    modal.innerHTML = `
        <div style="background:#fff; border-radius:8px; padding:20px; width:380px; box-shadow:0 10px 25px rgba(0,0,0,0.15);">
            <h3 style="margin-top:0; color:#0f172a; font-size:16px;">Créer un compte général</h3>
            
            <label style="display:block; font-size:12px; font-weight:600; color:#475569; margin-top:10px;">Code Compte (ex: 606100)</label>
            <input type="text" id="add-code-compte" style="width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:6px; margin-top:4px; box-sizing:border-box;" placeholder="606100" />

            <label style="display:block; font-size:12px; font-weight:600; color:#475569; margin-top:10px;">Intitulé du compte</label>
            <input type="text" id="add-libelle-compte" style="width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:6px; margin-top:4px; box-sizing:border-box;" placeholder="Fournitures informatiques" />

            <label style="display:block; font-size:12px; font-weight:600; color:#475569; margin-top:10px;">Type de compte</label>
            <select id="add-type-compte" style="width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:6px; margin-top:4px; box-sizing:border-box;">
                <option value="Dépense">Dépense (Classe 6)</option>
                <option value="Recette">Recette (Classe 7)</option>
                <option value="Tiers">Tiers / Patient (Classe 4)</option>
                <option value="Banque">Banque / Caisse (Classe 5)</option>
                <option value="Immobilisation">Immobilisation (Classe 2)</option>
                <option value="Bilan">Capital / Bilan (Classe 1)</option>
            </select>

            <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:20px;">
                <button type="button" onclick="document.getElementById('modal-nouveau-compte').remove()" 
                        style="background:#f1f5f9; color:#475569; border:none; padding:8px 12px; border-radius:6px; cursor:pointer; font-size:12px;">Annuler</button>
                <button type="button" onclick="window.enregistrerNouveauCompte()" 
                        style="background:#16a34a; color:#fff; border:none; padding:8px 14px; border-radius:6px; cursor:pointer; font-size:12px; font-weight:600;">Enregistrer</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
};

window.enregistrerNouveauCompte = function() {
    var code = document.getElementById('add-code-compte').value.trim();
    var intitule = document.getElementById('add-libelle-compte').value.trim();
    var type = document.getElementById('add-type-compte').value;

    if (!code || !intitule) {
        alert('Veuillez remplir le code et l-intitulé du compte.');
        return;
    }

    var nouvelId = window.PLAN_COMPTABLE_BNC.length + 1;
    var nouveauCompte = { id: nouvelId, code: code, intitule: intitule, type: type };

    window.PLAN_COMPTABLE_BNC.push(nouveauCompte);
    localStorage.setItem('PLAN_COMPTABLE_BNC_CUSTOM', JSON.stringify(window.PLAN_COMPTABLE_BNC));

    document.getElementById('modal-nouveau-compte').remove();
    window.afficherPlanComptable();
};

window.initialiserPlanComptable = function() {
    var retries = 0;
    var timer = setInterval(function() {
        var container = window.trouverZonePlan();
        if (container) {
            window.afficherPlanComptable();
            clearInterval(timer);
        }
        retries++;
        if (retries > 15) clearInterval(timer);
    }, 200);
};

if (document.readyState === 'complete' || document.readyState === 'interactive') {
    window.initialiserPlanComptable();
} else {
    document.addEventListener('DOMContentLoaded', window.initialiserPlanComptable);
}
