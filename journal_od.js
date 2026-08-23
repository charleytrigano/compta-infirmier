// journal_od.js - Gestion du Journal d'Opérations Diverses (OD) avec justificatifs, modification, suppression et Plan Comptable

(function () {
    function getSupabase() {
        return window.supabaseClient || (window.supabase && typeof window.supabase.from === 'function' ? window.supabase : null);
    }

    function formatEuro(amount) {
        return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount || 0);
    }

    // Plan comptable BNC / Libéral de référence
    const PLAN_COMPTABLE_LIST = [
        { code: '108000', libelle: '108000 - Compte de l\'exploitant (Prélèvements / Apports)' },
        { code: '401000', libelle: '401000 - Fournisseurs' },
        { code: '411000', libelle: '411000 - Clients / Patients / Tiers Payant' },
        { code: '512000', libelle: '512000 - Banque / Compte Courant' },
        { code: '606000', libelle: '606000 - Achats de fournitures & petit matériel' },
        { code: '613200', libelle: '613200 - Loyer et charges locatives' },
        { code: '616000', libelle: '616000 - Assurances professionnelles (RCP, etc.)' },
        { code: '625100', libelle: '625100 - Voyages et déplacements' },
        { code: '625600', libelle: '625600 - Missions et formations (DPC...)' },
        { code: '627000', libelle: '627000 - Services bancaires et frais de carte' },
        { code: '628000', libelle: '628000 - Diverses prestations de services' },
        { code: '646100', libelle: '646100 - Cotisations sociales URSSAF' },
        { code: '646200', libelle: '646200 - Cotisations sociales CARPIMKO' },
        { code: '658000', libelle: '658000 - Charges diverses de gestion courante' },
        { code: '706000', libelle: '706000 - Prestations de soins / Recettes honoraires' },
        { code: '758000', libelle: '758000 - Produits divers de gestion courante' }
    ];

    // --- BOÎTE DE DIALOGUE INTERACTIVE DU PLAN COMPTABLE ---
    let cibleCompteCodeId = null;
    let cibleCompteLibelleId = null;

    function ouvrirModalPlanComptable(targetCodeInputId, targetLibelleInputId) {
        cibleCompteCodeId = targetCodeInputId;
        cibleCompteLibelleId = targetLibelleInputId;

        let modal = document.getElementById('modal-plan-comptable');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'modal-plan-comptable';
            modal.style.cssText = `
                position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
                background: rgba(15, 23, 42, 0.6); display: flex; align-items: center;
                justify-content: center; z-index: 9999; backdrop-filter: blur(4px);
            `;
            
            modal.innerHTML = `
                <div style="background: #ffffff; border-radius: 12px; width: 90%; max-width: 550px; padding: 24px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1); font-family: system-ui, sans-serif;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                        <h3 style="margin: 0; font-size: 1.25rem; color: #0f172a;">📖 Plan Comptable</h3>
                        <button onclick="fermerModalPlanComptable()" style="background: none; border: none; font-size: 1.5rem; cursor: pointer; color: #64748b;">&times;</button>
                    </div>
                    <input type="text" id="recherche-plan-comptable" placeholder="Rechercher un numéro ou libellé..." style="width: 100%; padding: 10px 14px; border: 1px solid #cbd5e1; border-radius: 8px; margin-bottom: 14px; font-size: 0.95rem; box-sizing: border-box;">
                    <div id="liste-plan-comptable" style="max-height: 320px; overflow-y: auto; border: 1px solid #e2e8f0; border-radius: 8px;"></div>
                </div>
            `;
            document.body.appendChild(modal);

            document.getElementById('recherche-plan-comptable').addEventListener('input', (e) => {
                afficherListePlanComptable(e.target.value);
            });
        }

        modal.style.display = 'flex';
        document.getElementById('recherche-plan-comptable').value = '';
        afficherListePlanComptable('');
    }

    function fermerModalPlanComptable() {
        const modal = document.getElementById('modal-plan-comptable');
        if (modal) modal.style.display = 'none';
    }

    function afficherListePlanComptable(filtre) {
        const conteneur = document.getElementById('liste-plan-comptable');
        if (!conteneur) return;

        const term = (filtre || '').toLowerCase();
        const filtrés = PLAN_COMPTABLE_LIST.filter(c => 
            c.code.toLowerCase().includes(term) || c.libelle.toLowerCase().includes(term)
        );

        if (filtrés.length === 0) {
            conteneur.innerHTML = `<div style="padding: 16px; text-align: center; color: #94a3b8;">Aucun compte trouvé.</div>`;
            return;
        }

        conteneur.innerHTML = filtrés.map(item => `
            <div onclick="selectionnerCompteComptable('${item.code}', '${item.libelle.replace(/'/g, "\\'")}')" 
                 style="padding: 12px 16px; border-bottom: 1px solid #f1f5f9; cursor: pointer; display: flex; justify-content: space-between; align-items: center; transition: background 0.15s;"
                 onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='transparent'">
                <span style="font-weight: 600; color: #1e293b;">${item.libelle}</span>
                <span style="font-size: 0.85rem; color: #2563eb; font-weight: 500;">Choisir ➔</span>
            </div>
        `).join('');
    }

    function selectionnerCompteComptable(code, libelle) {
        if (cibleCompteCodeId) {
            const elCode = document.getElementById(cibleCompteCodeId);
            if (elCode) elCode.value = code;
        }
        if (cibleCompteLibelleId) {
            const elLib = document.getElementById(cibleCompteLibelleId);
            if (elLib) elLib.value = libelle;
        }
        fermerModalPlanComptable();
    }

    // --- INJECTION AUTOMATIQUE DES BOUTONS LOUPE DANS LES CHAMPS DÉBIT / CRÉDIT ---
    function injecterBoutonsLoupeOD() {
        const champDebit = document.getElementById('od-compte-debit');
        const champCredit = document.getElementById('od-compte-credit');

        const ajouterLoupe = (inputEl, codeId, libelleId, btnId) => {
            if (!inputEl || document.getElementById(btnId)) return;

            const parent = inputEl.parentElement;
            if (!parent) return;

            const wrapper = document.createElement('div');
            wrapper.style.cssText = 'display: flex; align-items: center; width: 100%; gap: 6px;';

            inputEl.parentNode.insertBefore(wrapper, inputEl);
            wrapper.appendChild(inputEl);
            inputEl.style.flex = '1';

            const btnLoupe = document.createElement('button');
            btnLoupe.id = btnId;
            btnLoupe.type = 'button';
            btnLoupe.innerHTML = '🔍';
            btnLoupe.title = 'Rechercher un compte dans le Plan Comptable';
            btnLoupe.style.cssText = 'padding: 8px 10px; background: #e2e8f0; border: 1px solid #cbd5e1; border-radius: 6px; cursor: pointer; font-size: 0.9rem; line-height: 1;';

            btnLoupe.onclick = () => ouvrirModalPlanComptable(codeId, libelleId);
            wrapper.appendChild(btnLoupe);
        };

        ajouterLoupe(champDebit, 'od-compte-debit', 'od-libelle-debit', 'btn-loupe-debit');
        ajouterLoupe(champCredit, 'od-compte-credit', 'od-libelle-credit', 'btn-loupe-credit');
    }

    async function uploaderJustificatif(file) {
        const supabase = getSupabase();
        if (!supabase || !file) return null;

        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${fileExt}`;
        const filePath = `${fileName}`;

        const { error: uploadError } = await supabase.storage
            .from('justificatifs')
            .upload(filePath, file);

        if (uploadError) {
            console.error("Erreur d'upload :", uploadError.message);
            alert("Erreur lors de l'envoi du justificatif : " + uploadError.message);
            return null;
        }

        const { data: publicUrlData } = supabase.storage
            .from('justificatifs')
            .getPublicUrl(filePath);

        return {
            filePath: filePath,
            publicUrl: publicUrlData ? publicUrlData.publicUrl : null
        };
    }

    async function enregistrerEcritureOD(e) {
        if (e) e.preventDefault();

        const dateVal = document.getElementById('od-date')?.value;
        const compteDebit = document.getElementById('od-compte-debit')?.value.trim();
        const compteCredit = document.getElementById('od-compte-credit')?.value.trim();
        const libelleCompteDebit = document.getElementById('od-libelle-debit')?.value.trim() || `Compte ${compteDebit}`;
        const libelleCompteCredit = document.getElementById('od-libelle-credit')?.value.trim() || `Compte ${compteCredit}`;
        const libelleVal = document.getElementById('od-description')?.value.trim();
        const montantVal = parseFloat(document.getElementById('od-montant')?.value);
        const fileInput = document.getElementById('od-file') || document.getElementById('od-scan');

        if (!dateVal || !compteDebit || !compteCredit || isNaN(montantVal) || montantVal <= 0) {
            alert("Veuillez remplir correctement la date, les deux comptes et un montant valide supérieur à 0.");
            return;
        }

        if (compteDebit === compteCredit) {
            alert("Le compte de débit et le compte de crédit doivent être différents.");
            return;
        }

        const supabase = getSupabase();
        if (!supabase) {
            alert("Erreur de connexion à la base de données.");
            return;
        }

        let fileData = null;
        if (fileInput && fileInput.files && fileInput.files[0]) {
            fileData = await uploaderJustificatif(fileInput.files[0]);
        }

        const payloadParent = {
            date: dateVal,
            type: 'od',
            category: 'Opération Diverse',
            journal: 'OD',
            description: libelleVal || 'Écriture OD',
            amount: montantVal,
            has_attachments: !!fileData,
            file_path: fileData ? fileData.filePath : null,
            justificatif_url: fileData ? fileData.publicUrl : null
        };

        const { data: parentData, error: parentError } = await supabase
            .from('transactions')
            .insert([payloadParent])
            .select();

        if (parentError || !parentData || parentData.length === 0) {
            alert("Erreur lors de la création de la transaction OD : " + (parentError ? parentError.message : "Données non renvoyées"));
            return;
        }

        const realTransactionId = parentData[0].id;

        const ligneDebit = {
            transaction_id: realTransactionId,
            date: dateVal,
            compte_code: compteDebit,
            compte_libelle: `${compteDebit} - ${libelleCompteDebit}`,
            category: 'Opération Diverse',
            journal: 'OD',
            description: libelleVal || 'Écriture OD',
            debit: montantVal,
            credit: 0
        };

        const ligneCredit = {
            transaction_id: realTransactionId,
            date: dateVal,
            compte_code: compteCredit,
            compte_libelle: `${compteCredit} - ${libelleCompteCredit}`,
            category: 'Opération Diverse',
            journal: 'OD',
            description: libelleVal || 'Écriture OD',
            debit: 0,
            credit: montantVal
        };

        const { error: ecritureError } = await supabase
            .from('ecritures_comptables')
            .insert([ligneDebit, ligneCredit]);

        if (ecritureError) {
            alert("Erreur lors de l'enregistrement des écritures OD : " + ecritureError.message);
        } else {
            const descEl = document.getElementById('od-description');
            const montantEl = document.getElementById('od-montant');
            if (descEl) descEl.value = '';
            if (montantEl) montantEl.value = '';
            if (fileInput) fileInput.value = '';
            
            await chargerJournalOD();
            if (typeof window.chargerGrandLivre === 'function') {
                await window.chargerGrandLivre();
            }

            alert("Écriture OD enregistrée avec succès !");
        }
    }

    async function chargerJournalOD() {
        injecterBoutonsLoupeOD();

        const tbody = document.getElementById('body-tableau-od');
        if (!tbody) return;

        const supabase = getSupabase();
        if (!supabase) return;

        try {
            const { data: ecritures, error } = await supabase
                .from('ecritures_comptables')
                .select('*')
                .eq('category', 'Opération Diverse')
                .order('date', { ascending: false });

            if (error) {
                console.error("Erreur récupération OD :", error.message);
                return;
            }

            if (!ecritures || ecritures.length === 0) {
                tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: #94a3b8; padding: 20px;">Aucune écriture d'opération diverse enregistrée.</td></tr>`;
                return;
            }

            const transIds = Array.from(new Set(ecritures.map(e => e.transaction_id).filter(Boolean)));
            let transMap = new Map();
            if (transIds.length > 0) {
                const { data: transData } = await supabase
                    .from('transactions')
                    .select('id, justificatif_url, file_path')
                    .in('id', transIds);

                if (transData) {
                    transData.forEach(t => transMap.set(t.id, t));
                }
            }

            tbody.innerHTML = ecritures.map(row => {
                const debit = parseFloat(row.debit || 0);
                const credit = parseFloat(row.credit || 0);
                const trans = transMap.get(row.transaction_id);
                const justifUrl = trans ? trans.justificatif_url : null;

                const justifBtn = justifUrl
                    ? `<a href="${justifUrl}" target="_blank" style="color: #2563eb; text-decoration: none;" title="Voir le justificatif">📎 Scan</a>`
                    : `<span style="color: #cbd5e1;">-</span>`;

                const transIdStr = row.transaction_id ? `'${row.transaction_id}'` : 'null';

                return `
                    <tr style="border-bottom: 1px solid #f1f5f9;">
                        <td style="padding: 10px; color: #334155;">${row.date || '-'}</td>
                        <td style="padding: 10px; font-weight: 600; color: #1e293b;">${row.compte_code}</td>
                        <td style="padding: 10px; color: #475569;">${row.compte_libelle || '-'}</td>
                        <td style="padding: 10px; color: #1e293b;">${row.description || '-'}</td>
                        <td style="padding: 10px; color: #2563eb; font-weight: 600; text-align: right;">${debit > 0 ? formatEuro(debit) : '-'}</td>
                        <td style="padding: 10px; color: #dc2626; font-weight: 600; text-align: right;">${credit > 0 ? formatEuro(credit) : '-'}</td>
                        <td style="padding: 10px; text-align: center;">${justifBtn}</td>
                        <td style="padding: 10px; text-align: center; white-space: nowrap;">
                            <button onclick="window.ouvrirModalModifierOD('${row.id}')" style="background:none; border:none; cursor:pointer; font-size:1.1rem; margin-right:8px;" title="Modifier">✏️</button>
                            <button onclick="window.supprimerEcritureOD('${row.id}', ${transIdStr})" style="background:none; border:none; cursor:pointer; font-size:1.1rem;" title="Supprimer">🗑️</button>
                        </td>
                    </tr>
                `;
            }).join('');

        } catch (err) {
            console.error("Erreur d'affichage du journal OD :", err);
        }
    }

    async function supprimerEcritureOD(ecritureId, transactionId) {
        if (!confirm("Es-tu sûr(e) de vouloir supprimer cette écriture OD ? Si elle est liée à une transaction, l'opération complète sera supprimée.")) return;

        const supabase = getSupabase();
        if (!supabase) return;

        try {
            if (transactionId) {
                await supabase.from('ecritures_comptables').delete().eq('transaction_id', transactionId);
                await supabase.from('transactions').delete().eq('id', transactionId);
            } else {
                await supabase.from('ecritures_comptables').delete().eq('id', ecritureId);
            }

            alert("Écriture OD supprimée avec succès !");
            await chargerJournalOD();
            if (typeof window.chargerGrandLivre === 'function') await window.chargerGrandLivre();

        } catch (err) {
            console.error("Erreur de suppression OD :", err);
            alert("Erreur lors de la suppression.");
        }
    }

    async function ouvrirModalModifierOD(ecritureId) {
        const supabase = getSupabase();
        if (!supabase) return;

        try {
            const { data, error } = await supabase.from('ecritures_comptables').select('*').eq('id', ecritureId).single();
            if (error || !data) {
                alert("Impossible de charger l'écriture à modifier.");
                return;
            }

            const editId = document.getElementById('edit-id');
            const editTransId = document.getElementById('edit-transaction-id');
            const editDate = document.getElementById('edit-date');
            const editDesc = document.getElementById('edit-description');
            const editMontant = document.getElementById('edit-montant');
            const editType = document.getElementById('edit-type');
            const editCat = document.getElementById('edit-categorie');
            const editFile = document.getElementById('edit-file');

            if (editId) editId.value = data.id;
            if (editTransId) editTransId.value = data.transaction_id || '';
            if (editDate) editDate.value = data.date || '';
            if (editDesc) editDesc.value = data.description || '';
            if (editMontant) editMontant.value = data.debit || data.credit || 0;
            if (editCat) editCat.value = data.compte_libelle || data.category || '';
            if (editType) editType.value = (parseFloat(data.credit) > 0) ? 'Recette' : 'Dépense';
            if (editFile) editFile.value = '';

            const modal = document.getElementById('modal-modifier');
            if (modal) modal.style.display = 'flex';

        } catch (err) {
            console.error("Erreur d'ouverture modale OD :", err);
        }
    }

    window.enregistrerEcritureOD = enregistrerEcritureOD;
    window.chargerJournalOD = chargerJournalOD;
    window.supprimerEcritureOD = supprimerEcritureOD;
    window.ouvrirModalModifierOD = ouvrirModalModifierOD;

    // Fonctions du Plan Comptable exposées globalement
    window.ouvrirModalPlanComptable = ouvrirModalPlanComptable;
    window.fermerModalPlanComptable = fermerModalPlanComptable;
    window.selectionnerCompteComptable = selectionnerCompteComptable;

    const initOD = () => {
        setTimeout(() => {
            chargerJournalOD();
            injecterBoutonsLoupeOD();
        }, 200);
    };

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        initOD();
    } else {
        document.addEventListener('DOMContentLoaded', initOD);
    }
})();
