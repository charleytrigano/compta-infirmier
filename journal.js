// journal.js - Gestion unifiée des vues "Transactions" et "Journal (Écritures)" avec affichage des scans, modification et suppression[cite: 8]

(function () {
    window.anneeJournalSelectionnee = window.anneeJournalSelectionnee || new Date().getFullYear().toString();

    function getSupabase() {
        return window.supabaseClient || (window.supabase && typeof window.supabase.from === 'function' ? window.supabase : null);
    }

    function formatEuro(amount) {
        if (amount === undefined || amount === null || isNaN(amount)) return '-';
        if (amount === 0) return '0,00 €';
        return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);
    }

    function injecterSelecteurAnnee(annees, idConteneur, idSelect) {
        let conteneur = document.getElementById(idConteneur);
        if (!conteneur) return;

        const options = annees.map(a => 
            `<option value="${a}" ${a === window.anneeJournalSelectionnee ? 'selected' : ''}>${a}</option>`
        ).join('');

        conteneur.innerHTML = `
            <div style="display: flex; justify-content: flex-end; align-items: center; gap: 8px; margin-bottom: 12px; background: #f8fafc; padding: 6px 12px; border-radius: 8px; border: 1px solid #e2e8f0;">
                <label for="${idSelect}" style="font-size: 0.85rem; font-weight: 700; color: #475569;">Exercice :</label>
                <select id="${idSelect}" onchange="window.changerAnneeJournal(this.value)" style="background: white; border: 1px solid #cbd5e1; font-weight: 700; color: #0f172a; padding: 3px 8px; border-radius: 4px; cursor: pointer; outline: none;">
                    ${options}
                </select>
            </div>
        `;
    }

    const MOIS_NOMS = [
        'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
        'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
    ];

    async function chargerHistoriqueTransactions() {
        const vueTrans = document.getElementById('vue-transactions') || document.querySelector('[data-view="transactions"]');
        const tbody = document.getElementById('body-tableau-transactions') || (vueTrans ? vueTrans.querySelector('tbody') : null);

        if (!tbody) return;

        if (!document.getElementById('filtre-annee-trans-container') && tbody.parentElement) {
            const divFiltre = document.createElement('div');
            divFiltre.id = 'filtre-annee-trans-container';
            tbody.parentElement.parentElement.insertBefore(divFiltre, tbody.parentElement);
        }

        const supabase = getSupabase();
        if (!supabase) {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #ef4444; padding: 15px;">Erreur : Client Supabase non connecté.</td></tr>`;
            return;
        }

        try {
            const { data, error } = await supabase
                .from('ecritures_comptables')
                .select('*')
                .order('date', { ascending: false });

            if (error) {
                tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #ef4444; padding: 15px;">Erreur : ${error.message}</td></tr>`;
                return;
            }

            if (!data || data.length === 0) {
                tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #94a3b8; padding: 20px;">Aucune écriture enregistrée.</td></tr>`;
                return;
            }

            // Charger les justificatifs depuis transactions
            const transIds = Array.from(new Set(data.map(e => e.transaction_id).filter(Boolean)));
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

            const anneesDispo = Array.from(new Set(data.map(e => e.date ? new Date(e.date).getFullYear().toString() : null).filter(Boolean))).sort((a, b) => b - a);
            if (anneesDispo.length > 0 && !anneesDispo.includes(window.anneeJournalSelectionnee)) {
                window.anneeJournalSelectionnee = anneesDispo[0];
            }

            injecterSelecteurAnnee(anneesDispo.length > 0 ? anneesDispo : [window.anneeJournalSelectionnee], 'filtre-annee-trans-container', 'select-annee-trans');

            const dataFiltree = data.filter(e => e.date && new Date(e.date).getFullYear().toString() === window.anneeJournalSelectionnee);

            if (dataFiltree.length === 0) {
                tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #94a3b8; padding: 20px;">Aucune transaction pour l'année ${window.anneeJournalSelectionnee}.</td></tr>`;
                return;
            }

            const transactionsMap = new Map();

            dataFiltree.forEach(row => {
                const key = row.transaction_id || row.id;
                const debit = parseFloat(row.debit || 0);
                const credit = parseFloat(row.credit || 0);

                if (!transactionsMap.has(key)) {
                    const isRecette = credit > 0 || (row.compte_code && row.compte_code.startsWith('7'));
                    const trans = transMap.get(row.transaction_id);
                    transactionsMap.set(key, {
                        id: row.id,
                        transaction_id: row.transaction_id,
                        date: row.date,
                        type: isRecette ? 'Recette' : 'Dépense',
                        categorie: row.compte_libelle || row.category || row.compte_code || 'Général',
                        description: row.description || '-',
                        montant: debit || credit,
                        justificatifUrl: trans ? trans.justificatif_url : null
                    });
                }
            });

            const transactions = Array.from(transactionsMap.values());

            const html = transactions.map(t => {
                const isRecette = t.type === 'Recette';
                const typeBadge = isRecette
                    ? `<span style="background: #dcfce7; color: #15803d; padding: 3px 8px; border-radius: 4px; font-weight: 600; font-size: 0.8rem;">Recette</span>`
                    : `<span style="background: #fee2e2; color: #b91c1c; padding: 3px 8px; border-radius: 4px; font-weight: 600; font-size: 0.8rem;">Dépense</span>`;

                const justifLink = t.justificatifUrl
                    ? `<a href="${escapeHtml(t.justificatifUrl)}" target="_blank" style="color: #2563eb; text-decoration: none;">📎 Scan</a>`
                    : `<span style="color: #cbd5e1;">-</span>`;

                const transIdStr = t.transaction_id ? `'${t.transaction_id}'` : 'null';

                return `
                    <tr style="border-bottom: 1px solid #f1f5f9;">
                        <td style="padding: 10px; color: #334155;">${escapeHtml(t.date || '-')}</td>
                        <td style="padding: 10px;">${typeBadge}</td>
                        <td style="padding: 10px; color: #475569;">${escapeHtml(t.categorie)}</td>
                        <td style="padding: 10px; color: #1e293b; font-weight: 500;">${escapeHtml(t.description)}</td>
                        <td style="padding: 10px; text-align: right; font-weight: 600; color: ${isRecette ? '#16a34a' : '#dc2626'};">
                            ${formatEuro(t.montant)}
                        </td>
                        <td style="padding: 10px; text-align: center;">${justifLink}</td>
                        <td style="padding: 10px; text-align: center; white-space: nowrap;">
                            <button onclick="window.modifierTransaction('${t.id}', ${transIdStr})" style="background: none; border: none; cursor: pointer; font-size: 1.1rem; margin-right: 6px;" title="Modifier">✏️</button>
                            <button onclick="window.supprimerTransaction('${t.id}', ${transIdStr})" style="background: none; border: none; color: #ef4444; cursor: pointer; font-size: 1.1rem;" title="Supprimer">🗑️</button>
                        </td>
                    </tr>
                `;
            }).join('');

            tbody.innerHTML = html;

        } catch (err) {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #ef4444; padding: 15px;">Erreur : ${err.message}</td></tr>`;
        }
    }

    async function modifierTransaction(id, transactionId) {
        const supabase = getSupabase();
        if (!supabase) return;

        try {
            if (typeof window.ouvrirModalModifierOD === 'function') {
                const { data: testOd } = await supabase.from('ecritures_comptables').select('category').eq('id', id).single();
                if (testOd && testOd.category === 'Opération Diverse') {
                    window.ouvrirModalModifierOD(id);
                    return;
                }
            }

            const { data, error } = await supabase.from('ecritures_comptables').select('*').eq('id', id).single();
            if (error || !data) {
                alert("Impossible de charger la transaction à modifier.");
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

            if (editId) editId.value = data.id || '';
            if (editTransId) editTransId.value = transactionId || data.transaction_id || '';
            if (editDate) editDate.value = data.date || '';
            if (editDesc) editDesc.value = data.description || '';
            if (editMontant) editMontant.value = data.debit || data.credit || 0;
            if (editCat) editCat.value = data.compte_libelle || data.category || '';
            if (editType) editType.value = (parseFloat(data.credit) > 0) ? 'Recette' : 'Dépense';
            if (editFile) editFile.value = '';

            const modal = document.getElementById('modal-modifier');
            if (modal) {
                modal.style.display = 'flex';
            } else {
                alert("La fenêtre de modification (modal-modifier) est introuvable dans le HTML.");
            }

        } catch (err) {
            console.error("Erreur lors de la modification :", err);
        }
    }

    async function enregistrerModificationOD(e) {
        if (e) e.preventDefault();

        const supabase = getSupabase();
        if (!supabase) return;

        const id = document.getElementById('edit-id')?.value;
        const transactionId = document.getElementById('edit-transaction-id')?.value;
        const dateVal = document.getElementById('edit-date')?.value;
        const descVal = document.getElementById('edit-description')?.value;
        const montantVal = parseFloat(document.getElementById('edit-montant')?.value);
        const typeVal = document.getElementById('edit-type')?.value;
        const catVal = document.getElementById('edit-categorie')?.value;
        const fileInput = document.getElementById('edit-file');

        if (!id || !dateVal || isNaN(montantVal)) {
            alert("Veuillez remplir correctement la date et le montant.");
            return;
        }

        try {
            let fileData = null;

            if (fileInput && fileInput.files && fileInput.files[0]) {
                const file = fileInput.files[0];
                const fileExt = file.name.split('.').pop();
                const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${fileExt}`;

                const { error: uploadError } = await supabase.storage
                    .from('justificatifs')
                    .upload(fileName, file);

                if (uploadError) {
                    alert("Erreur d'upload du scan : " + uploadError.message);
                    return;
                }

                const { data: publicUrlData } = supabase.storage
                    .from('justificatifs')
                    .getPublicUrl(fileName);

                fileData = {
                    filePath: fileName,
                    publicUrl: publicUrlData ? publicUrlData.publicUrl : null
                };
            }

            const isRecette = typeVal === 'Recette';
            const payloadEcriture = {
                date: dateVal,
                description: descVal,
                debit: isRecette ? 0 : montantVal,
                credit: isRecette ? montantVal : 0,
                compte_libelle: catVal
            };

            await supabase.from('ecritures_comptables').update(payloadEcriture).eq('id', id);

            if (transactionId && transactionId !== 'null' && transactionId !== 'undefined' && transactionId !== '') {
                const payloadTransaction = {
                    date: dateVal,
                    description: descVal,
                    amount: montantVal,
                    category: catVal
                };

                if (fileData) {
                    payloadTransaction.has_attachments = true;
                    payloadTransaction.file_path = fileData.filePath;
                    payloadTransaction.justificatif_url = fileData.publicUrl;
                }

                await supabase.from('transactions').update(payloadTransaction).eq('id', transactionId);
            }

            if (typeof window.fermerModal === 'function') {
                window.fermerModal();
            } else {
                const modal = document.getElementById('modal-modifier');
                if (modal) modal.style.display = 'none';
            }

            alert("Opération mise à jour avec succès !");

            if (typeof window.chargerHistoriqueTransactions === 'function') await window.chargerHistoriqueTransactions();
            if (typeof window.chargerJournalGeneral === 'function') await window.chargerJournalGeneral();
            if (typeof window.chargerJournalOD === 'function') await window.chargerJournalOD();

        } catch (err) {
            console.error("Erreur lors de la sauvegarde :", err);
            alert("Erreur lors de l'enregistrement.");
        }
    }

    async function supprimerTransaction(id, transactionId) {
        if (!confirm("Voulez-vous supprimer cette écriture comptable ?")) return;

        const supabase = getSupabase();
        if (!supabase) return;

        let query = supabase.from('ecritures_comptables').delete();
        if (transactionId && transactionId !== 'undefined' && transactionId !== 'null' && transactionId !== '') {
            query = query.eq('transaction_id', transactionId);
            await supabase.from('transactions').delete().eq('id', transactionId);
        } else {
            query = query.eq('id', id);
        }

        const { error } = await query;
        if (error) {
            alert("Erreur lors de la suppression : " + error.message);
        } else {
            await chargerHistoriqueTransactions();
            await chargerJournalGeneral();
        }
    }

    async function chargerJournalGeneral() {
        const vueJournal = document.getElementById('vue-journal') || document.querySelector('[data-view="journal"]') || document.querySelector('[id*="journal"]');
        const tbody = document.getElementById('body-tableau-journal') || (vueJournal ? vueJournal.querySelector('tbody') : null);

        if (!tbody) return;

        if (!document.getElementById('filtre-annee-journal-container') && tbody.parentElement) {
            const divFiltre = document.createElement('div');
            divFiltre.id = 'filtre-annee-journal-container';
            tbody.parentElement.parentElement.insertBefore(divFiltre, tbody.parentElement);
        }

        const supabase = getSupabase();
        if (!supabase) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #ef4444; padding: 15px;">Erreur : Client Supabase non initialisé.</td></tr>`;
            return;
        }

        try {
            const { data, error } = await supabase
                .from('ecritures_comptables')
                .select('*')
                .order('date', { ascending: false });

            if (error) {
                tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #ef4444; padding: 15px;">Erreur : ${error.message}</td></tr>`;
                return;
            }

            if (!data || data.length === 0) {
                tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #94a3b8; padding: 20px;">Aucune écriture enregistrée.</td></tr>`;
                return;
            }

            const anneesDispo = Array.from(new Set(data.map(e => e.date ? new Date(e.date).getFullYear().toString() : null).filter(Boolean))).sort((a, b) => b - a);
            if (anneesDispo.length > 0 && !anneesDispo.includes(window.anneeJournalSelectionnee)) {
                window.anneeJournalSelectionnee = anneesDispo[0];
            }

            injecterSelecteurAnnee(anneesDispo.length > 0 ? anneesDispo : [window.anneeJournalSelectionnee], 'filtre-annee-journal-container', 'select-annee-journ');

            const dataFiltree = data.filter(e => e.date && new Date(e.date).getFullYear().toString() === window.anneeJournalSelectionnee);

            if (dataFiltree.length === 0) {
                tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #94a3b8; padding: 20px;">Aucune écriture pour l'année ${window.anneeJournalSelectionnee}.</td></tr>`;
                return;
            }

            const ecrituresParMois = new Map();

            dataFiltree.forEach(row => {
                const dateObj = new Date(row.date);
                const moisIndex = dateObj.getMonth();
                const key = `${dateObj.getFullYear()}-${String(moisIndex + 1).padStart(2, '0')}`;

                if (!ecrituresParMois.has(key)) {
                    ecrituresParMois.set(key, {
                        moisIndex: moisIndex,
                        nomMois: MOIS_NOMS[moisIndex],
                        rows: []
                    });
                }
                ecrituresParMois.get(key).rows.push(row);
            });

            let html = '';
            let totalGeneralDebit = 0;
            let totalGeneralCredit = 0;

            const moisClesTries = Array.from(ecrituresParMois.keys()).sort().reverse();

            moisClesTries.forEach(key => {
                const groupe = ecrituresParMois.get(key);
                let totalMoisDebit = 0;
                let totalMoisCredit = 0;

                html += `
                    <tr style="background: #f1f5f9; font-weight: 700;">
                        <td colspan="6" style="padding: 10px 12px; color: #1e293b; font-size: 0.95rem; border-top: 2px solid #cbd5e1;">
                            📅 ${groupe.nomMois} ${window.anneeJournalSelectionnee}
                        </td>
                    </tr>
                `;

                groupe.rows.forEach(row => {
                    const debit = parseFloat(row.debit || 0);
                    const credit = parseFloat(row.credit || 0);
                    const compteCode = row.compte_code || '-';
                    const compteLibelle = row.compte_libelle || row.description || '-';

                    totalMoisDebit += debit;
                    totalMoisCredit += credit;

                    html += `
                        <tr style="border-bottom: 1px solid #f1f5f9;">
                            <td style="padding: 10px; color: #334155;">${escapeHtml(row.date || '-')}</td>
                            <td style="padding: 10px; color: #475569; font-weight: 600;">${escapeHtml(compteCode)}</td>
                            <td style="padding: 10px; color: #1e293b; font-weight: 500;">${escapeHtml(compteLibelle)}</td>
                            <td style="padding: 10px; color: #dc2626; text-align: right; font-weight: 500;">${formatEuro(debit)}</td>
                            <td style="padding: 10px; color: #16a34a; text-align: right; font-weight: 500;">${formatEuro(credit)}</td>
                            <td style="padding: 10px; text-align: center;">
                                <span style="background: #dcfce7; color: #15803d; padding: 3px 8px; border-radius: 4px; font-weight: 600; font-size: 0.8rem;">Validé</span>
                            </td>
                        </tr>
                    `;
                });

                totalGeneralDebit += totalMoisDebit;
                totalGeneralCredit += totalMoisCredit;

                const soldeMois = totalMoisCredit - totalMoisDebit;
                const couleurSoldeMois = soldeMois >= 0 ? '#16a34a' : '#dc2626';

                html += `
                    <tr style="background: #f8fafc; font-weight: 700; border-bottom: 2px solid #e2e8f0;">
                        <td colspan="3" style="padding: 10px; text-align: right; color: #475569;">
                            Total ${groupe.nomMois} (Solde : <span style="color: ${couleurSoldeMois}">${formatEuro(soldeMois)}</span>) :
                        </td>
                        <td style="padding: 10px; text-align: right; color: #b91c1c;">${formatEuro(totalMoisDebit)}</td>
                        <td style="padding: 10px; text-align: right; color: #15803d;">${formatEuro(totalMoisCredit)}</td>
                        <td></td>
                    </tr>
                `;
            });

            const soldeGeneral = totalGeneralCredit - totalGeneralDebit;

            html += `
                <tr style="background: #1e293b; color: white; font-weight: 800; font-size: 0.95rem;">
                    <td colspan="3" style="padding: 12px; text-align: right; text-transform: uppercase; letter-spacing: 0.5px;">
                        TOTAL GÉNÉRAL ${window.anneeJournalSelectionnee} (Solde : <span style="color: ${soldeGeneral >= 0 ? '#4ade80' : '#f87171'}">${formatEuro(soldeGeneral)}</span>) :
                    </td>
                    <td style="padding: 12px; text-align: right; color: #fca5a5;">${formatEuro(totalGeneralDebit)}</td>
                    <td style="padding: 12px; text-align: right; color: #86efac;">${formatEuro(totalGeneralCredit)}</td>
                    <td style="padding: 12px; text-align: center; color: #94a3b8; font-size: 0.8rem;">ANNÉE ${window.anneeJournalSelectionnee}</td>
                </tr>
            `;

            tbody.innerHTML = html;

        } catch (err) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #ef4444; padding: 15px;">Erreur : ${err.message}</td></tr>`;
        }
    }

    window.changerAnneeJournal = function (annee) {
        window.anneeJournalSelectionnee = String(annee);
        chargerHistoriqueTransactions();
        chargerJournalGeneral();
    };

    window.chargerHistoriqueTransactions = chargerHistoriqueTransactions;
    window.chargerTransactions = chargerHistoriqueTransactions;
    window.modifierTransaction = modifierTransaction;
    window.enregistrerModificationOD = enregistrerModificationOD;
    window.sauvegarderModification = enregistrerModificationOD;
    window.supprimerTransaction = supprimerTransaction;
    window.chargerJournalGeneral = chargerJournalGeneral;
    window.chargerJournal = chargerJournalGeneral;

    document.addEventListener('click', (e) => {
        const el = e.target.closest('button, a, div');
        if (!el || !el.textContent) return;

        const txt = el.textContent.trim().toLowerCase();
        if (txt === 'transactions') {
            setTimeout(chargerHistoriqueTransactions, 100);
        } else if (txt.includes('journal') && !txt.includes('banque')) {
            setTimeout(chargerJournalGeneral, 100);
        }
    });

    function init() {
        setTimeout(chargerHistoriqueTransactions, 150);
        setTimeout(chargerJournalGeneral, 250);
    }

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        init();
    } else {
        document.addEventListener('DOMContentLoaded', init);
    }
})();
