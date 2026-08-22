// journal_od.js - Gestion du Journal d'Opérations Diverses (OD) avec justificatifs, modification et suppression[cite: 9]

(function () {
    function getSupabase() {
        return window.supabaseClient || (window.supabase && typeof window.supabase.from === 'function' ? window.supabase : null);
    }

    function formatEuro(amount) {
        return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount || 0);
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

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        setTimeout(chargerJournalOD, 200);
    } else {
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(chargerJournalOD, 200);
        });
    }
})();
