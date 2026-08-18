// transactions.js - Gestion intégrale des Transactions et du Journal de Banque

(function () {
    function getSupabase() {
        return window.supabaseClient || (window.supabase && typeof window.supabase.from === 'function' ? window.supabase : null);
    }

    function formatEuro(amount) {
        return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount || 0);
    }

    /**
     * Mappage automatique des catégories vers les comptes du Plan Comptable IDEL
     */
    function getCompteCode(type, categorie) {
        const cat = (categorie || '').toLowerCase();
        if (type.toLowerCase() === 'recette') return '706000';
        if (cat.includes('carpimko')) return '646200';
        if (cat.includes('urssaf')) return '646100';
        if (cat.includes('matériel') || cat.includes('fourniture')) return '606000';
        if (cat.includes('loyer') || cat.includes('local')) return '613200';
        if (cat.includes('assurance')) return '616000';
        if (cat.includes('formation')) return '625600';
        return '628000'; // Dépenses diverses
    }

    /**
     * Téléversement du fichier justificatif sur Supabase Storage
     */
    async function uploaderJustificatif(fileInput) {
        if (!fileInput || !fileInput.files || fileInput.files.length === 0) return null;
        const file = fileInput.files[0];
        const supabase = getSupabase();
        if (!supabase) return null;

        const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;

        try {
            const { data, error } = await supabase.storage
                .from('justificatifs')
                .upload(fileName, file);

            if (error) {
                console.warn("Erreur Supabase Storage :", error.message);
                return null;
            }

            const { data: publicData } = supabase.storage
                .from('justificatifs')
                .getPublicUrl(fileName);

            return publicData ? publicData.publicUrl : null;
        } catch (e) {
            console.error("Exception upload justificatif :", e);
            return null;
        }
    }

    /**
     * Enregistre une nouvelle transaction ET ses écritures comptables associées
     */
    async function ajouterTransaction() {
        const dateInput = document.getElementById('tx-date');
        const typeInput = document.getElementById('tx-type');
        const catInput = document.getElementById('tx-categorie');
        const descInput = document.getElementById('tx-description');
        const montantInput = document.getElementById('tx-montant');
        const fileInput = document.getElementById('tx-justificatif');

        const dateVal = dateInput ? dateInput.value : '';
        const montantVal = montantInput ? parseFloat(montantInput.value) : 0;

        if (!dateVal || isNaN(montantVal) || montantVal <= 0) {
            alert("Veuillez remplir une date valide et un montant supérieur à 0.");
            return;
        }

        let justificatifUrl = null;
        if (fileInput && fileInput.files.length > 0) {
            justificatifUrl = await uploaderJustificatif(fileInput);
        }

        const categorieValeur = catInput ? catInput.value : 'Soins infirmiers';
        const typeValeur = typeInput ? typeInput.value : 'Dépense';
        const descValeur = descInput ? descInput.value.trim() : '';
        const txId = crypto.randomUUID ? crypto.randomUUID() : 'tx_' + Date.now();

        const estRecette = typeValeur.toLowerCase() === 'recette';
        const codeJournal = estRecette ? 'VT' : 'HA';

        const supabase = getSupabase();
        if (supabase) {
            // 1. Enregistrement dans la table transactions
            const payloadTransactions = {
                id: txId,
                date: dateVal,
                type: typeValeur.toLowerCase(),
                category: categorieValeur,
                journal: codeJournal,
                description: descValeur,
                amount: montantVal,
                file_path: justificatifUrl,
                has_attachments: Boolean(justificatifUrl)
            };

            const resTx = await supabase.from('transactions').insert([payloadTransactions]);
            if (resTx.error) {
                alert("Erreur d'enregistrement dans Transactions : " + resTx.error.message);
                return;
            }

            // 2. Enregistrement dans ecritures_comptables (Partie double)
            const codeCategorie = getCompteCode(typeValeur, categorieValeur);

            const ligneBanque = {
                transaction_id: txId,
                date: dateVal,
                compte_code: '512000',
                compte_libelle: '512000 - Banque / Compte Courant',
                category: categorieValeur,
                journal: 'BQ',
                description: (estRecette ? 'Encaissement : ' : 'Décaissement : ') + (descValeur || categorieValeur),
                debit: estRecette ? montantVal : 0,
                credit: estRecette ? 0 : montantVal
            };

            const ligneContrepartie = {
                transaction_id: txId,
                date: dateVal,
                compte_code: codeCategorie,
                compte_libelle: `${codeCategorie} - ${categorieValeur}`,
                category: categorieValeur,
                journal: codeJournal,
                description: descValeur || categorieValeur,
                debit: estRecette ? 0 : montantVal,
                credit: estRecette ? montantVal : 0
            };

            const resEcritures = await supabase.from('ecritures_comptables').insert([ligneBanque, ligneContrepartie]);
            if (resEcritures.error) {
                alert("Erreur d'enregistrement dans la comptabilité : " + resEcritures.error.message);
                return;
            }
        }

        // Réinitialisation du formulaire
        if (descInput) descInput.value = '';
        if (montantInput) montantInput.value = '';
        if (fileInput) fileInput.value = '';

        await chargerTransactionsListe();
        alert("Transaction enregistrée avec succès dans toutes les tables !");
    }

    /**
     * Charge et affiche l'historique des transactions
     */
    async function chargerTransactionsListe() {
        const tbody = document.getElementById('body-tableau-transactions');
        if (!tbody) return;

        let list = [];
        const supabase = getSupabase();

        if (supabase) {
            const { data } = await supabase
                .from('transactions')
                .select('*')
                .neq('category', 'Opération Diverse')
                .order('date', { ascending: false });
            if (data && data.length > 0) list = data;
        }

        if (list.length === 0) {
            list = JSON.parse(localStorage.getItem('allTransactions') || '[]')
                .filter(t => t.category !== 'Opération Diverse');
        }

        window.allTransactions = list;

        if (list.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #94a3b8; padding: 20px;">Aucune transaction enregistrée.</td></tr>`;
            return;
        }

        tbody.innerHTML = list.map(tx => {
            const estRecette = (tx.type || '').toLowerCase() === 'recette';
            const valMontant = tx.amount !== undefined ? tx.amount : tx.montant;
            const montantFormatted = Math.abs(parseFloat(valMontant) || 0).toFixed(2);
            const fileUrl = tx.file_path || tx.justificatif_url;

            const docLink = fileUrl 
                ? `<a href="${fileUrl}" target="_blank" style="color:#2563eb; font-weight:600; text-decoration:underline;">📎 Voir</a>` 
                : `<span style="color:#94a3b8;">-</span>`;

            return `
                <tr>
                    <td>${tx.date || ''}</td>
                    <td><strong>${tx.type || 'Recette'}</strong></td>
                    <td>${tx.category || tx.categorie || ''}</td>
                    <td>${tx.description || ''}</td>
                    <td style="font-weight: bold; color: ${estRecette ? '#16a34a' : '#dc2626'};">${montantFormatted} €</td>
                    <td style="text-align: center;">${docLink}</td>
                    <td>
                        <button class="btn-edit-tx" onclick="window.ouvrirModalModification('${tx.id}')">Modifier</button>
                        <button class="btn-delete-tx" onclick="window.supprimerTransaction('${tx.id}')">Supprimer</button>
                    </td>
                </tr>
            `;
        }).join('');
    }

    /**
     * Supprime une transaction et ses écritures liées
     */
    async function supprimerTransaction(id) {
        if (!confirm("Voulez-vous vraiment supprimer cette transaction ?")) return;

        const supabase = getSupabase();
        if (supabase) {
            await supabase.from('transactions').delete().eq('id', id);
            await supabase.from('ecritures_comptables').delete().eq('transaction_id', id);
        }

        window.allTransactions = (window.allTransactions || []).filter(t => (t.id || '').toString() !== id.toString());
        localStorage.setItem('allTransactions', JSON.stringify(window.allTransactions));

        await chargerTransactionsListe();
    }

    /**
     * Charge et affiche le journal de banque
     */
    async function chargerJournalBanque() {
        await chargerTransactionsListe();

        const vueBanque = document.getElementById('vue-banque');
        const tbody = document.getElementById('body-tableau-banque') || (vueBanque ? vueBanque.querySelector('tbody') : null);
        const soldeEl = document.getElementById('solde-banque') || (vueBanque ? vueBanque.querySelector('span') : null);

        if (!tbody) return;

        const supabase = getSupabase();
        if (!supabase) return;

        try {
            let { data, error } = await supabase
                .from('ecritures_comptables')
                .select('*')
                .or('compte_code.eq.512000,compte_code.like.512%')
                .neq('category', 'Opération Diverse')
                .order('date', { ascending: false });

            if (error || !data || data.length === 0) {
                const resTrans = await supabase
                    .from('transactions')
                    .select('*')
                    .neq('category', 'Opération Diverse')
                    .order('date', { ascending: false });
                if (!resTrans.error && resTrans.data && resTrans.data.length > 0) {
                    data = resTrans.data;
                }
            }

            if (!data || data.length === 0) {
                tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #94a3b8; padding: 20px;">Aucun mouvement bancaire enregistré.</td></tr>`;
                if (soldeEl) soldeEl.textContent = "0,00 €";
                return;
            }

            let totalDebit = 0;
            let totalCredit = 0;

            const html = data.map(row => {
                const debit = parseFloat(row.debit || 0);
                const credit = parseFloat(row.credit || 0);
                
                const isEncaissement = debit > 0 || (row.sens && row.sens.toLowerCase().includes('encaissement'));
                const valMontant = row.amount !== undefined ? row.amount : row.montant;
                const montant = isEncaissement ? (debit || parseFloat(valMontant || 0)) : (credit || parseFloat(valMontant || 0));

                if (isEncaissement) {
                    totalDebit += montant;
                } else {
                    totalCredit += montant;
                }

                const sensLabel = isEncaissement ? 'Encaissement' : 'Décaissement';
                const sensBadge = isEncaissement 
                    ? `<span style="background: #dcfce7; color: #15803d; padding: 3px 8px; border-radius: 4px; font-weight: 600; font-size: 0.8rem;">${sensLabel}</span>`
                    : `<span style="background: #fee2e2; color: #b91c1c; padding: 3px 8px; border-radius: 4px; font-weight: 600; font-size: 0.8rem;">${sensLabel}</span>`;

                return `
                    <tr style="border-bottom: 1px solid #f1f5f9;">
                        <td style="padding: 10px; color: #334155;">${row.date || '-'}</td>
                        <td style="padding: 10px;">${sensBadge}</td>
                        <td style="padding: 10px; color: #475569;">${row.category || row.categorie || 'Soins infirmiers'}</td>
                        <td style="padding: 10px; color: #1e293b; font-weight: 500;">${row.description || row.libelle || '-'}</td>
                        <td style="padding: 10px; color: #dc2626; font-weight: 600; text-align: right;">${!isEncaissement ? formatEuro(montant) : '-'}</td>
                        <td style="padding: 10px; color: #16a34a; font-weight: 600; text-align: right;">${isEncaissement ? formatEuro(montant) : '-'}</td>
                        <td style="padding: 10px; text-align: center;">
                            <button onclick="window.supprimerMouvementBanque('${row.id}', '${row.transaction_id || ''}')" style="background: none; border: none; color: #ef4444; cursor: pointer; font-size: 0.9rem;" title="Supprimer">🗑️</button>
                        </td>
                    </tr>
                `;
            }).join('');

            tbody.innerHTML = html;

            if (soldeEl) {
                soldeEl.textContent = formatEuro(totalDebit - totalCredit);
            }

        } catch (err) {
            console.error("Erreur lors du chargement du journal de banque :", err);
        }
    }

    /**
     * Saisie manuelle directe dans le Journal de Banque
     */
    async function ajouterPaiement(e) {
        if (e) e.preventDefault();

        const vueBanque = document.getElementById('vue-banque');
        if (!vueBanque) return;

        const dateInput = vueBanque.querySelector('input[type="date"]') || document.getElementById('pay-date');
        const selects = vueBanque.querySelectorAll('select');
        const sensSelect = selects[0] || document.getElementById('pay-type');
        const catSelect = selects.length > 1 ? selects[1] : sensSelect;
        const inputs = vueBanque.querySelectorAll('input');
        const libelleInput = inputs.length > 1 ? inputs[1] : null;
        const montantInput = inputs.length > 2 ? inputs[2] : null;

        const dateVal = dateInput ? dateInput.value : '';
        const sensVal = sensSelect ? sensSelect.value : 'Encaissement (Recette)';
        const catVal = catSelect ? catSelect.value : 'Soins infirmiers';
        const libelleVal = libelleInput ? libelleInput.value.trim() : '';
        const montantVal = montantInput ? parseFloat(montantInput.value) : 0;

        if (!dateVal || !montantVal || montantVal <= 0) {
            alert("Veuillez renseigner une date valide et un montant supérieur à 0.");
            return;
        }

        const supabase = getSupabase();
        if (!supabase) return;

        const isEncaissement = sensVal.toLowerCase().includes('encaissement') || sensVal.toLowerCase().includes('recette');
        const transactionId = crypto.randomUUID ? crypto.randomUUID() : 'trans_' + Date.now();
        const typeTransaction = isEncaissement ? 'recette' : 'dépense';

        // 1. Enregistrement préalable de la transaction parent
        const payloadParent = {
            id: transactionId,
            date: dateVal,
            type: typeTransaction,
            category: catVal,
            journal: 'BQ',
            description: libelleVal || catVal,
            amount: montantVal,
            has_attachments: false
        };

        const resParent = await supabase.from('transactions').insert([payloadParent]);
        if (resParent.error) {
            alert("Erreur lors de la création de la transaction bancaire : " + resParent.error.message);
            return;
        }

        // 2. Enregistrement de la ligne comptable
        const ligneBanque = {
            transaction_id: transactionId,
            date: dateVal,
            compte_code: '512000',
            compte_libelle: '512000 - Banque / Compte Courant',
            category: catVal,
            journal: 'BQ',
            description: (isEncaissement ? 'Encaissement : ' : 'Décaissement : ') + (libelleVal || catVal),
            debit: isEncaissement ? montantVal : 0,
            credit: isEncaissement ? 0 : montantVal
        };

        const { error } = await supabase.from('ecritures_comptables').insert([ligneBanque]);

        if (error) {
            alert("Erreur lors de l'enregistrement de l'écriture bancaire : " + error.message);
        } else {
            if (libelleInput) libelleInput.value = '';
            if (montantInput) montantInput.value = '';
            await chargerJournalBanque();
        }
    }

    /**
     * Supprime une ligne spécifique du Journal de Banque
     */
    async function supprimerMouvementBanque(id, transactionId) {
        if (!confirm("Voulez-vous vraiment supprimer cet enregistrement ?")) return;

        const supabase = getSupabase();
        if (!supabase) return;

        let query = supabase.from('ecritures_comptables').delete();
        if (transactionId && transactionId !== 'undefined' && transactionId !== '') {
            query = query.eq('transaction_id', transactionId);
        } else {
            query = query.eq('id', id);
        }

        const { error } = await query;
        if (error) {
            alert("Erreur lors de la suppression : " + error.message);
        } else {
            if (transactionId && transactionId !== 'undefined' && transactionId !== '') {
                await supabase.from('transactions').delete().eq('id', transactionId);
            }
            await chargerJournalBanque();
        }
    }

    // Exposition globale des fonctions
    window.ajouterTransaction = ajouterTransaction;
    window.chargerTransactionsListe = chargerTransactionsListe;
    window.supprimerTransaction = supprimerTransaction;
    window.chargerJournalBanque = chargerJournalBanque;
    window.chargerTransactions = chargerJournalBanque;
    window.ajouterPaiement = ajouterPaiement;
    window.supprimerMouvementBanque = supprimerMouvementBanque;

    // Initialisation
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        setTimeout(chargerJournalBanque, 200);
    } else {
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(chargerJournalBanque, 200);
        });
    }
})();
