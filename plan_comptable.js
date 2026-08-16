// plan_comptable.js - Version autonome et sécurisée

(function () {
    function getSupabase() {
        return window.supabaseClient || (window.supabase && typeof window.supabase.from === 'function' ? window.supabase : null);
    }

    let ongletActif = 'GENERAL';

    async function chargerPlanComptable() {
        // Ciblage spécifique du bloc contenant le message de chargement
        const zoneCible = Array.from(document.querySelectorAll('div, section, main')).find(el => 
            el.children.length <= 2 && el.textContent && el.textContent.includes('Chargement du plan comptable...')
        ) || document.querySelector('#plan-comptable') || document.querySelector('.plan-comptable-content');

        if (!zoneCible) return;

        // Génération de l'interface
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
                            <tr><td colspan="4" style="text-align: center; padding: 20px; color: #64748b;">Connexion à Supabase...</td></tr>
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

        // Événements
        const btnGen = document.getElementById('pc-tab-gen');
        const btnTiers = document.getElementById('pc-tab-tiers');
        const modal = document.getElementById('pc-modal');

        btnGen.onclick = () => {
            ongletActif = 'GENERAL';
            btnGen.style.backgroundColor = '#2563eb'; btnGen.style.color = 'white'; btnGen.style.border = 'none';
            btnTiers.style.backgroundColor = '#f8fafc'; btnTiers.style.color = '#334155'; btnTiers.style.border = '1px solid #cbd5e1';
            chargerDonnees();
        };

        btnTiers.onclick = () => {
            ongletActif = 'TIERS';
            btnTiers.style.backgroundColor = '#2563eb'; btnTiers.style.color = 'white'; btnTiers.style.border = 'none';
            btnGen.style.backgroundColor = '#f8fafc'; btnGen.style.color = '#334155'; btnGen.style.border = '1px solid #cbd5e1';
            chargerDonnees();
        };

        document.getElementById('pc-btn-add').onclick = () => { modal.style.display = 'flex'; };
        document.getElementById('pc-btn-close').onclick = () => { modal.style.display = 'none'; };
        document.getElementById('pc-btn-save').onclick = enregistrerCompte;

        await chargerDonnees();
    }

    async function chargerDonnees() {
        const tbody = document.getElementById('pc-tbody');
        if (!tbody) return;

        try {
            const supabase = getSupabase();
            if (!supabase) {
                tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; padding: 20px; color: #ef4444;">Client Supabase non détecté.</td></tr>`;
                return;
            }

            const { data, error } = await supabase.from('plan_comptable').select('*');

            if (error) {
                tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; padding: 20px; color: #ef4444;">Erreur Supabase : ${error.message}</td></tr>`;
                return;
            }

            let liste = data || [];

            // Tri par code de compte
            liste.sort((a, b) => {
                const codeA = String(a.code_compte || a.compte_code || a.code || '');
                const codeB = String(b.code_compte || b.compte_code || b.code || '');
                return codeA.localeCompare(codeB);
            });

            // Filtrage par onglet (Général vs Tiers)
            const filtres = liste.filter(row => {
                const code = String(row.code_compte || row.compte_code || row.code || '');
                const type = String(row.type || '').toUpperCase();
                if (ongletActif === 'TIERS') return code.startsWith('4') || type.includes('TIERS');
                return !code.startsWith('4') && !type.includes('TIERS');
            });

            if (filtres.length === 0) {
                tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; padding: 20px; color: #94a3b8;">Aucun compte dans cette catégorie.</td></tr>`;
                return;
            }

            tbody.innerHTML = filtres.map((row, idx) => {
                const code = row.code_compte || row.compte_code || row.code || '-';
                const label = row.intitule || row.compte_libelle || row.label || '-';
                const type = row.type || 'Général';
                return `
                    <tr style="border-bottom: 1px solid #f1f5f9;">
                        <td style="padding: 10px; color: #64748b;">${row.id || idx + 1}</td>
                        <td style="padding: 10px; font-weight: 700; color: #1e293b;">${code}</td>
                        <td style="padding: 10px; color: #334155;">${label}</td>
                        <td style="padding: 10px;"><span style="background: #f1f5f9; padding: 3px 8px; border-radius: 4px; font-size: 0.8rem;">${type}</span></td>
                    </tr>
                `;
            }).join('');

        } catch (err) {
            tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; padding: 20px; color: #ef4444;">Erreur d'exécution : ${err.message}</td></tr>`;
        }
    }

    async function enregistrerCompte() {
        const supabase = getSupabase();
        const code = document.getElementById('pc-in-code').value.trim();
        const label = document.getElementById('pc-in-label').value.trim();
        const type = document.getElementById('pc-in-type').value;

        if (!code || !label) {
            alert("Veuillez remplir le code et l'intitulé.");
            return;
        }

        // Essai avec le champ standard
        let payload = { code_compte: code, intitule: label, type: type };
        let { error } = await supabase.from('plan_comptable').insert([payload]);

        if (error) {
            // Fallback si les noms de colonnes sont différents
            payload = { compte_code: code, compte_libelle: label, type: type };
            const res = await supabase.from('plan_comptable').insert([payload]);
            error = res.error;
        }

        if (error) {
            alert("Erreur lors de la sauvegarde : " + error.message);
        } else {
            document.getElementById('pc-modal').style.display = 'none';
            document.getElementById('pc-in-code').value = '';
            document.getElementById('pc-in-label').value = '';
            chargerDonnees();
        }
    }

    window.chargerPlanComptable = chargerPlanComptable;

    // Déclencheur au clic sur l'onglet
    document.addEventListener('click', (e) => {
        const el = e.target.closest('button, a, div');
        if (el && el.textContent && el.textContent.trim().toLowerCase().includes('plan comptable')) {
            setTimeout(chargerPlanComptable, 100);
            setTimeout(chargerPlanComptable, 300);
        }
    });

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        setTimeout(chargerPlanComptable, 200);
    } else {
        document.addEventListener('DOMContentLoaded', chargerPlanComptable);
    }
})();
