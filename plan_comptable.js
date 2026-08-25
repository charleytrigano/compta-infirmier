// plan_comptable.js - Version corrigée avec détection automatique des libellés et intégration HTML

(function () {
    /**
     * Récupération sécurisée du client Supabase
     */
    function getSupabase() {
        return window.supabaseClient || (window.supabase && typeof window.supabase.from === 'function' ? window.supabase : null);
    }

    let ongletActif = 'GENERAL';

    /**
     * Initialisation du module et injection de la structure HTML
     */
    async function chargerPlanComptable() {
        // Ciblage prioritaire du conteneur défini dans index.html
        const zoneCible = document.getElementById('conteneur-plan-comptable') || 
                          Array.from(document.querySelectorAll('div, section, main')).find(el => 
                              el.children.length <= 2 && el.textContent && el.textContent.includes('Chargement du plan comptable...')
                          ) || document.querySelector('#plan-comptable') || document.querySelector('.plan-comptable-content');

        if (!zoneCible) return;

        zoneCible.innerHTML = `
            <div style="background: white; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0; width: 100%; box-sizing: border-box;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 10px;">
                    <div style="display: flex; gap: 8px;">
                        <button id="pc-tab-gen" style="padding: 8px 16px; border-radius: 6px; border: none; background-color: #2563eb; color: white; font-weight: 600; cursor: pointer;">
                            Plan Comptable Général
                        </button>
                        <button id="pc-tab-tiers" style="padding: 8px 16px; border-radius: 6px; border: 1px solid #cbd5e1; background-color: #f8fafc; color: #334155; font-weight: 500; cursor: pointer;">
                            Comptes Tiers (Patients/Organismes)
                        </button>
                    </div>
                    <button id="pc-btn-add" style="padding: 8px 16px; border-radius: 6px; border: none; background-color: #2563eb; color: white; font-weight: 600; cursor: pointer;">
                        + Nouveau compte
                    </button>
                </div>

                <div style="overflow-x: auto;">
                    <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.9rem;">
                        <thead>
                            <tr style="border-bottom: 2px solid #e2e8f0; background-color: #f8fafc; color: #475569;">
                                <th style="padding: 10px;">ID</th>
                                <th style="padding: 10px;">Code Compte</th>
                                <th style="padding: 10px;">Intitulé du compte</th>
                                <th style="padding: 10px;">Type</th>
                            </tr>
                        </thead>
                        <tbody id="pc-tbody">
                            <tr><td colspan="4" style="text-align: center; padding: 20px; color: #64748b;">Chargement Supabase...</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- Modale de création -->
            <div id="pc-modal" style="display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.5); justify-content: center; align-items: center; z-index: 10000;">
                <div style="background: white; border-radius: 8px; padding: 24px; width: 100%; max-width: 420px; box-shadow: 0 10px 25px rgba(0,0,0,0.2);">
                    <h3 style="margin-top: 0; font-size: 1.1rem; color: #1e293b; margin-bottom: 15px;">Créer un compte</h3>
                    
                    <div style="margin-bottom: 12px;">
                        <label style="display: block; font-size: 0.8rem; color: #475569; margin-bottom: 4px;">Code Compte (ex: 431000)</label>
                        <input type="text" id="pc-in-code" placeholder="431000" style="width: 100%; padding: 8px; border: 1px solid #cbd5e1; border-radius: 6px; box-sizing: border-box;" />
                    </div>

                    <div style="margin-bottom: 12px;">
                        <label style="display: block; font-size: 0.8rem; color: #475569; margin-bottom: 4px;">Intitulé du compte</label>
                        <input type="text" id="pc-in-label" placeholder="URSSAF" style="width: 100%; padding: 8px; border: 1px solid #cbd5e1; border-radius: 6px; box-sizing: border-box;" />
                    </div>

                    <div style="margin-bottom: 20px;">
                        <label style="display: block; font-size: 0.8rem; color: #475569; margin-bottom: 4px;">Type de compte</label>
                        <select id="pc-in-type" style="width: 100%; padding: 8px; border: 1px solid #cbd5e1; border-radius: 6px; box-sizing: border-box;">
                            <option value="Général">Général (Classe 1 à 7)</option>
                            <option value="Tiers">Tiers / Patient (Classe 4)</option>
                        </select>
                    </div>

                    <div style="display: flex; justify-content: flex-end; gap: 8px;">
                        <button id="pc-btn-close" style="padding: 8px 14px; border-radius: 6px; border: 1px solid #cbd5e1; background: #f1f5f9; cursor: pointer;">Annuler</button>
                        <button id="pc-btn-save" style="padding: 8px 14px; border-radius: 6px; border: none; background: #16a34a; color: white; font-weight: 600; cursor: pointer;">Enregistrer</button>
                    </div>
                </div>
            </div>
        `;

        const btnGen = document.getElementById('pc-tab-gen');
        const btnTiers = document.getElementById('pc-tab-tiers');
        const modal = document.getElementById('pc-modal');

        if (btnGen) {
            btnGen.onclick = () => {
                ongletActif = 'GENERAL';
                btnGen.style.backgroundColor = '#2563eb'; btnGen.style.color = 'white'; btnGen.style.border = 'none';
                btnTiers.style.backgroundColor = '#f8fafc'; btnTiers.style.color = '#334155'; btnTiers.style.border = '1px solid #cbd5e1';
                chargerDonnees();
            };
        }

        if (btnTiers) {
            btnTiers.onclick = () => {
                ongletActif = 'TIERS';
                btnTiers.style.backgroundColor = '#2563eb'; btnTiers.style.color = 'white'; btnTiers.style.border = 'none';
                btnGen.style.backgroundColor = '#f8fafc'; btnGen.style.color = '#334155'; btnGen.style.border = '1px solid #cbd5e1';
                chargerDonnees();
            };
        }

        const btnAdd = document.getElementById('pc-btn-add');
        if (btnAdd) btnAdd.onclick = () => { modal.style.display = 'flex'; };

        const btnClose = document.getElementById('pc-btn-close');
        if (btnClose) btnClose.onclick = () => { modal.style.display = 'none'; };

        const btnSave = document.getElementById('pc-btn-save');
        if (btnSave) btnSave.onclick = enregistrerCompte;

        await chargerDonnees();
    }

    /**
     * Récupération des données depuis Supabase et affichage
     */
    async function chargerDonnees() {
        const tbody = document.getElementById('pc-tbody');
        if (!tbody) return;

        try {
            const supabase = getSupabase();
            if (!supabase) {
                tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; padding: 20px; color: #ef4444;">Erreur : Supabase non initialisé.</td></tr>`;
                return;
            }

            const { data, error } = await supabase.from('plan_comptable').select('*');
            if (error) {
                tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; padding: 20px; color: #ef4444;">Erreur : ${error.message}</td></tr>`;
                return;
            }

            let liste = data || [];

            // Tri par code
            liste.sort((a, b) => {
                const codeA = String(a.code_compte || a.compte_code || a.code || '');
                const codeB = String(b.code_compte || b.compte_code || b.code || '');
                return codeA.localeCompare(codeB);
            });

            // Filtrage onglet
            const filtres = liste.filter(row => {
                const code = String(row.code_compte || row.compte_code || row.code || '');
                const type = String(row.type || row.categorie || '').toUpperCase();
                if (ongletActif === 'TIERS') return code.startsWith('4') || type.includes('TIERS');
                return !code.startsWith('4') && !type.includes('TIERS');
            });

            if (filtres.length === 0) {
                tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; padding: 20px; color: #94a3b8;">Aucun compte dans cette catégorie.</td></tr>`;
                return;
            }

            tbody.innerHTML = filtres.map((row, idx) => {
                const code = row.code_compte || row.compte_code || row.code || '-';
                
                // Détection dynamique du champ de libellé
                const label = row.intitule || row.libelle || row.compte_libelle || row.nom || row.label || row.description || '-';
                const type = row.type || row.categorie || 'Général';

                return `
                    <tr style="border-bottom: 1px solid #f1f5f9;">
                        <td style="padding: 10px; color: #64748b;">${escapeHtml(row.id || idx + 1)}</td>
                        <td style="padding: 10px; font-weight: 700; color: #1e293b;">${escapeHtml(code)}</td>
                        <td style="padding: 10px; color: #334155;">${escapeHtml(label)}</td>
                        <td style="padding: 10px;"><span style="background: #f1f5f9; padding: 3px 8px; border-radius: 4px; font-size: 0.8rem;">${escapeHtml(type)}</span></td>
                    </tr>
                `;
            }).join('');

        } catch (err) {
            tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; padding: 20px; color: #ef4444;">Erreur : ${err.message}</td></tr>`;
        }
    }

    /**
     * Enregistrement d'un nouveau compte
     */
    async function enregistrerCompte() {
        const supabase = getSupabase();
        if (!supabase) {
            alert("Erreur : Client Supabase introuvable.");
            return;
        }

        const code = document.getElementById('pc-in-code').value.trim();
        const label = document.getElementById('pc-in-label').value.trim();
        const type = document.getElementById('pc-in-type').value;

        if (!code || !label) {
            alert("Veuillez remplir le code et l'intitulé.");
            return;
        }

        // Modèles d'insertion selon la structure exacte des colonnes
        const optionsInsertion = [
            { code_compte: code, intitule: label, type: type },
            { code_compte: code, libelle: label, type: type },
            { compte_code: code, compte_libelle: label, type: type },
            { code: code, libelle: label, type: type }
        ];

        let reussi = false;
        let dernierMessageErreur = '';

        for (const payload of optionsInsertion) {
            const { error } = await supabase.from('plan_comptable').insert([payload]);
            if (!error) {
                reussi = true;
                break;
            }
            dernierMessageErreur = error.message;
        }

        if (reussi) {
            document.getElementById('pc-modal').style.display = 'none';
            document.getElementById('pc-in-code').value = '';
            document.getElementById('pc-in-label').value = '';
            chargerDonnees();
        } else {
            alert("Erreur lors de la sauvegarde : " + dernierMessageErreur);
        }
    }

    // Export des fonctions vers le scope global (window)
    window.chargerPlanComptable = chargerPlanComptable;
    window.afficherPlanComptable = chargerPlanComptable;

    // Détection du clic sur l'onglet "Plan Comptable"
    document.addEventListener('click', (e) => {
        const el = e.target.closest('button, a, div');
        if (el && el.textContent && el.textContent.trim().toLowerCase().includes('plan comptable')) {
            setTimeout(chargerPlanComptable, 100);
            setTimeout(chargerPlanComptable, 300);
        }
    });

    // Déclenchement automatique au chargement initial
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        setTimeout(chargerPlanComptable, 200);
    } else {
        document.addEventListener('DOMContentLoaded', chargerPlanComptable);
    }
})();
