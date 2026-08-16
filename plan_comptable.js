// plan_comptable.js - Gestion ciblée du Plan Comptable

(function () {
    function getSupabase() {
        if (window.supabaseClient && typeof window.supabaseClient.from === 'function') {
            return window.supabaseClient;
        }
        if (window.supabase && typeof window.supabase.from === 'function') {
            return window.supabase;
        }
        return null;
    }

    let ongletActif = 'GENERAL';

    async function initialiserPlanComptable() {
        // Ciblage strict de la zone de contenu principale pour éviter d'écraser la navigation
        let zoneCentrale = document.getElementById('main-content') || document.querySelector('main') || document.getElementById('content');

        if (!zoneCentrale) {
            const titres = Array.from(document.querySelectorAll('h1, h2, h3, div')).filter(el => 
                el.textContent && (el.textContent.includes('Plan Comptable') || el.textContent.includes('Chargement'))
            );
            if (titres.length > 0) {
                zoneCentrale = titres[0].closest('.card, .bg-white, section') || titres[0].parentElement;
            }
        }

        if (!zoneCentrale) return;

        // Structure HTML isolée
        zoneCentrale.innerHTML = `
            <div id="module-plan-comptable" style="padding: 20px; background-color: white; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 10px;">
                    <div style="display: flex; gap: 10px;">
                        <button id="btn-tab-general" style="padding: 8px 16px; border-radius: 6px; border: none; background-color: #2563eb; color: white; font-weight: 600; cursor: pointer;">
                            Plan Comptable Général
                        </button>
                        <button id="btn-tab-tiers" style="padding: 8px 16px; border-radius: 6px; border: 1px solid #cbd5e1; background-color: #f8fafc; color: #334155; font-weight: 500; cursor: pointer;">
                            Comptes Tiers (Patients/Organismes)
                        </button>
                    </div>
                    <button id="btn-ouvrir-modal-pc" style="padding: 8px 16px; border-radius: 6px; border: none; background-color: #2563eb; color: white; font-weight: 600; cursor: pointer;">
                        + Nouveau compte
                    </button>
                </div>

                <div style="overflow-x: auto;">
                    <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.95rem;">
                        <thead>
                            <tr style="border-bottom: 2px solid #e2e8f0; background-color: #f8fafc;">
                                <th style="padding: 12px; color: #475569;">ID</th>
                                <th style="padding: 12px; color: #475569;">Code Compte</th>
                                <th style="padding: 12px; color: #475569;">Intitulé du compte</th>
                                <th style="padding: 12px; color: #475569;">Type</th>
                            </tr>
                        </thead>
                        <tbody id="pc-table-body">
                            <tr><td colspan="4" style="text-align: center; padding: 20px; color: #64748b;">Chargement des comptes...</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- Modale de création -->
            <div id="modal-nouveau-compte-pc" style="display: none; position: fixed; inset: 0; background-color: rgba(0, 0, 0, 0.5); justify-content: center; align-items: center; z-index: 9999;">
                <div style="background-color: white; border-radius: 8px; padding: 24px; width: 100%; max-width: 420px; box-shadow: 0 10px 25px rgba(0,0,0,0.15);">
                    <h3 style="margin-top: 0; color: #1e293b; margin-bottom: 15px;">Créer un compte</h3>
                    
                    <div style="margin-bottom: 12px;">
                        <label style="display: block; font-size: 0.85rem; color: #475569; margin-bottom: 4px;">Code Compte (ex: 431000)</label>
                        <input type="text" id="pc-input-code" placeholder="431000" style="width: 100%; padding: 8px; border: 1px solid #cbd5e1; border-radius: 6px; box-sizing: border-box;" />
                    </div>

                    <div style="margin-bottom: 12px;">
                        <label style="display: block; font-size: 0.85rem; color: #475569; margin-bottom: 4px;">Intitulé du compte</label>
                        <input type="text" id="pc-input-intitule" placeholder="URSSAF" style="width: 100%; padding: 8px; border: 1px solid #cbd5e1; border-radius: 6px; box-sizing: border-box;" />
                    </div>

                    <div style="margin-bottom: 20px;">
                        <label style="display: block; font-size: 0.85rem; color: #475569; margin-bottom: 4px;">Type de compte</label>
                        <select id="pc-select-type" style="width: 100%; padding: 8px; border: 1px solid #cbd5e1; border-radius: 6px; box-sizing: border-box;">
                            <option value="Général">Général (Classe 1 à 7)</option>
                            <option value="Tiers">Tiers / Patient (Classe 4)</option>
                        </select>
                    </div>

                    <div style="display: flex; justify-content: flex-end; gap: 10px;">
                        <button id="pc-btn-annuler" style="padding: 8px 16px; border-radius: 6px; border: 1px solid #cbd5e1; background: #f1f5f9; cursor: pointer;">Annuler</button>
                        <button id="pc-btn-enregistrer" style="padding: 8px 16px; border-radius: 6px; border: none; background: #16a34a; color: white; font-weight: 600; cursor: pointer;">Enregistrer</button>
                    </div>
                </div>
            </div>
        `;

        // Événements
        const btnGen = document.getElementById('btn-tab-general');
        const btnTiers = document.getElementById('btn-tab-tiers');
        const modal = document.getElementById('modal-nouveau-compte-pc');

        btnGen.onclick = () => {
            ongletActif = 'GENERAL';
            btnGen.style.backgroundColor = '#2563eb'; btnGen.style.color = 'white'; btnGen.style.border = 'none';
            btnTiers.style.backgroundColor = '#f8fafc'; btnTiers.style.color = '#334155'; btnTiers.style.border = '1px solid #cbd5e1';
            chargerDonneesComptes();
        };

        btnTiers.onclick = () => {
            ongletActif = 'TIERS';
            btnTiers.style.backgroundColor = '#2563eb'; btnTiers.style.color = 'white'; btnTiers.style.border = 'none';
            btnGen.style.backgroundColor = '#f8fafc'; btnGen.style.color = '#334155'; btnGen.style.border = '1px solid #cbd5e1';
            chargerDonneesComptes();
        };

        document.getElementById('btn-ouvrir-modal-pc').onclick = () => { modal.style.display = 'flex'; };
        document.getElementById('pc-btn-annuler').onclick = () => { modal.style.display = 'none'; };
        document.getElementById('pc-btn-enregistrer').onclick = sauvegarderCompte;

        await chargerDonneesComptes();
    }

    async function chargerDonneesComptes() {
        const tbody = document.getElementById('pc-table-body');
        if (!tbody) return;

        const supabase = getSupabase();
        if (!supabase) {
            tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; padding: 20px; color: #ef4444;">Supabase indisponible.</td></tr>`;
            return;
        }

        // Lecture flexible sans spécifier order('code_compte') pour éviter l'erreur 400 Supabase
        const { data: comptes, error } = await supabase
            .from('plan_comptable')
            .select('*');

        if (error) {
            tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; padding: 20px; color: #ef4444;">Erreur : ${error.message}</td></tr>`;
            return;
        }

        const listeComptes = comptes || [];

        // Tri local Javascript
        listeComptes.sort((a, b) => {
            const codeA = String(a.code_compte || a.compte_code || a.code || '');
            const codeB = String(b.code_compte || b.compte_code || b.code || '');
            return codeA.localeCompare(codeB);
        });

        const comptesFiltres = listeComptes.filter(c => {
            const code = String(c.code_compte || c.compte_code || c.code || '');
            const type = String(c.type || '').toUpperCase();
            if (ongletActif === 'TIERS') return code.startsWith('4') || type.includes('TIERS');
            return !code.startsWith('4') && !type.includes('TIERS');
        });

        tbody.innerHTML = '';

        if (comptesFiltres.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; padding: 20px; color: #94a3b8;">Aucun compte trouvé.</td></tr>`;
            return;
        }

        comptesFiltres.forEach((item, idx) => {
            const codeVal = item.code_compte || item.compte_code || item.code || '-';
            const intituleVal = item.intitule || item.compte_libelle || item.label || '-';

            const tr = document.createElement('tr');
            tr.style.borderBottom = '1px solid #f1f5f9';
            tr.innerHTML = `
                <td style="padding: 10px 12px; color: #64748b;">${item.id || idx + 1}</td>
                <td style="padding: 10px 12px; font-weight: 700; color: #1e293b;">${codeVal}</td>
                <td style="padding: 10px 12px; color: #334155;">${intituleVal}</td>
                <td style="padding: 10px 12px;">
                    <span style="background-color: #f1f5f9; color: #475569; padding: 3px 8px; border-radius: 4px; font-size: 0.8rem; font-weight: 500;">
                        ${item.type || 'Général'}
                    </span>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    async function sauvegarderCompte() {
        const supabase = getSupabase();
        const code = document.getElementById('pc-input-code').value.trim();
        const intitule = document.getElementById('pc-input-intitule').value.trim();
        const typeCompte = document.getElementById('pc-select-type').value;

        if (!code || !intitule) {
            alert("Veuillez renseigner le code et l'intitulé.");
            return;
        }

        // Test de structure d'insertion
        let { error } = await supabase.from('plan_comptable').insert([{
            code_compte: code,
            intitule: intitule,
            type: typeCompte
        }]);

        if (error && error.message.includes('code_compte')) {
            // Fallback si la colonne s'appelle compte_code
            const res = await supabase.from('plan_comptable').insert([{
                compte_code: code,
                compte_libelle: intitule,
                type: typeCompte
            }]);
            error = res.error;
        }

        if (error) {
            alert("Erreur d'enregistrement : " + error.message);
        } else {
            alert("Compte " + code + " créé avec succès !");
            document.getElementById('modal-nouveau-compte-pc').style.display = 'none';
            document.getElementById('pc-input-code').value = '';
            document.getElementById('pc-input-intitule').value = '';
            chargerDonneesComptes();
        }
    }

    window.initialiserPlanComptable = initialiserPlanComptable;
})();
