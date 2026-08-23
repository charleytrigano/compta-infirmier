// transactions.js - Gestion des Transactions et du Journal de Banque

// Déclaration globale de getSupabase au sommet du fichier
function getSupabase() {
    return window.supabaseClient || (window.supabase && typeof window.supabase.from === 'function' ? window.supabase : null);
}

function formatEuro(amount) {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount || 0);
}

function getCompteCode(type, categorie) {
    const cat = (categorie || '').toLowerCase();
    if (type.toLowerCase() === 'recette') return '706000';
    if (cat.includes('carpimko')) return '646200';
    if (cat.includes('urssaf')) return '646100';
    if (cat.includes('matériel') || cat.includes('fourniture')) return '606000';
    if (cat.includes('loyer') || cat.includes('local')) return '613200';
    if (cat.includes('assurance')) return '616000';
    if (cat.includes('formation')) return '625600';
    return '628000';
}

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
 * Enregistre une transaction classique (Dépense / Recette)
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
    const estRecette = typeValeur.toLowerCase() === 'recette';
    const codeJournal = estRecette ? 'VT' : 'HA';

    const supabase = getSupabase();
    if (supabase) {
        const payloadTransactions = {
            date: dateVal,
            type: typeValeur.toLowerCase(),
            category: categorieValeur,
            journal: codeJournal,
            description: descValeur,
            amount: montantVal,
            justificatif_url: justificatifUrl,
            file_path: justificatifUrl,
            has_attachments: Boolean(justificatifUrl)
        };

        const { data: parentData, error: parentError } = await supabase
            .from('transactions')
            .insert([payloadTransactions])
            .select();

        if (parentError || !parentData || parentData.length === 0) {
            alert("Erreur lors de la création de la transaction : " + (parentError ? parentError.message : "Erreur inconnue"));
            return;
        }

        const realTxId = parentData[0].id;
        const codeCategorie = getCompteCode(typeValeur, categorieValeur);

        const ligneBanque = {
            transaction_id: realTxId,
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
            transaction_id: realTxId,
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
            alert("Erreur lors de l'enregistrement des écritures comptables : " + resEcritures.error.message);
            return;
        }
    }

    if (descInput) descInput.value = '';
    if (montantInput) montantInput.value = '';
    if (fileInput) fileInput.value = '';

    await chargerTransactionsListe();

    if (typeof window.chargerGrandLivre === 'function') {
        await window.chargerGrandLivre();
    }
    window.dispatchEvent(new CustomEvent('ecritureAjoutee'));

    alert("Transaction enregistrée avec succès !");
}

/**
 * Enregistrement d'un paiement depuis le Journal de Banque
 */
async function ajouterPaiement(e) {
    if (e) e.preventDefault();

    const vueBanque = document.getElementById('vue-banque') || document.querySelector('.journal-banque') || document.body;

    const dateInput = document.getElementById('pay-date') || vueBanque.querySelector('input[type="date"]');
    const selects = vueBanque.querySelectorAll('select');
    const sensSelect = document.getElementById('pay-type') || selects[0];
    const catSelect = selects.length > 1 ? selects[1] : sensSelect;
    
    const inputs = vueBanque.querySelectorAll('input');
    const libelleInput = document.getElementById('pay-description') || (inputs.length > 1 ? inputs[1] : null);
    const montantInput = document.getElementById('pay-montant') || (inputs.length > 2 ? inputs[2] : null);
    const fileInput = document.getElementById('pay-justificatif') || document.getElementById('pay-file') || vueBanque.querySelector('input[type="file"]');

    const dateVal = dateInput ? dateInput.value : '';
    const sensVal = sensSelect ? sensSelect.value : 'Encaissement (Recette)';
    const catVal = catSelect ? catSelect.value : 'Soins infirmiers';
    const libelleVal = libelleInput ? libelleInput.value.trim() : '';
    const montantVal = montantInput ? parseFloat(montantInput.value) : 0;

    if (!dateVal || isNaN(montantVal) || montantVal <= 0) {
        alert("Veuillez renseigner une date valide et un montant supérieur à 0.");
        return;
    }

    const supabase = getSupabase();
    if (!supabase) {
        alert("Supabase n'est pas initialisé correctement.");
        return;
    }

    let justificatifUrl = null;
    if (fileInput && fileInput.files.length > 0) {
        justificatifUrl = await uploaderJustificatif(fileInput);
    }

    const isEncaissement = sensVal.toLowerCase().includes('encaissement') || sensVal.toLowerCase().includes('recette');
    const typeTransaction = isEncaissement ? 'recette' : 'dépense';

    // Extraction du compte tiers
    let compteContrepartie = getCompteCode(typeTransaction, catVal);
    let libelleContrepartie = catVal;

    if (libelleVal) {
        const matchCompte = libelleVal.match(/^([0-9]{3,6}[a-zA-Z0-9_-]*)/);
        if (matchCompte) {
            compteContrepartie = matchCompte[1];
            libelleContrepartie = libelleVal;
        }
    }

    // 1. Transaction parent
    const payloadParent = {
        date: dateVal,
        type: typeTransaction,
        category: catVal,
        journal: 'BQ',
        description: libelleVal || catVal,
        amount: montantVal,
        justificatif_url: justificatifUrl,
        file_path: justificatifUrl,
        has_attachments: Boolean(justificatifUrl)
    };

    const { data: parentData, error: parentError } = await supabase
        .from('transactions')
        .insert([payloadParent])
        .select();

    if (parentError || !parentData || parentData.length === 0) {
        alert("Erreur lors de la création de la transaction parent : " + (parentError ? parentError.message : "Erreur inconnue"));
        return;
    }

    const realTransactionId = parentData[0].id;

    // 2. Écriture Banque sur le 512000
    const ligneBanque = {
        transaction_id: realTransactionId,
        date: dateVal,
        compte_code: '512000',
        compte_libelle: '512000 - Banque / Compte Courant',
        category: catVal,
        journal: 'BQ',
        description: (isEncaissement ? 'Encaissement : ' : 'Décaissement : ') + (libelleVal || catVal),
        debit: isEncaissement ? montantVal : 0,
        credit: isEncaissement ? 0 : montantVal
    };

    // 3. Écriture Contrepartie sur le compte Tiers / Charge / Produits
    const ligneContrepartie = {
        transaction_id: realTransactionId,
        date: dateVal,
        compte_code: compteContrepartie,
        compte_libelle: `${compteContrepartie} - ${libelleContrepartie}`,
        category: catVal,
        journal: 'BQ',
        description: (isEncaissement ? 'Règlement reçu : ' : 'Règlement émis : ') + (libelleVal || catVal),
        debit: isEncaissement ? 0 : montantVal,
        credit: isEncaissement ? montantVal : 0
    };

    const { error: ecritureError } = await supabase
        .from('ecritures_comptables')
        .insert([ligneBanque, ligneContrepartie]);

    if (ecritureError) {
        alert("Erreur lors de l'enregistrement des écritures bancaires : " + ecritureError.message);
    } else {
        if (libelleInput) libelleInput.value = '';
        if (montantInput) montantInput.value = '';
        if (fileInput) fileInput.value = '';
        
        await chargerJournalBanque();
        if (typeof window.chargerGrandLivre === 'function') {
            await window.chargerGrandLivre();
        }
        window.dispatchEvent(new CustomEvent('ecritureAjoutee'));

        alert("Paiement enregistré avec succès !");
    }
}

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
        const fileUrl = tx.justificatif_url || tx.file_path;

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
                <td style="text-align: center; white-space: nowrap;">
                    <button onclick="window.ouvrirModalModificationBanque('${tx.id}')" style="background:none; border:none; cursor:pointer; font-size:1.1rem; margin-right:6px;" title="Modifier">✏️</button>
                    <button onclick="window.supprimerTransaction('${tx.id}')" style="background:none; border:none; color:#ef4444; cursor:pointer; font-size:1.1rem;" title="Supprimer">🗑️</button>
                </td>
            </tr>
        `;
    }).join('');
}

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
    if (typeof window.chargerGrandLivre === 'function') {
        await window.chargerGrandLivre();
    }
    window.dispatchEvent(new CustomEvent('ecritureAjoutee'));
}

async function chargerJournalBanque() {
    await chargerTransactionsListe();

    const vueBanque = document.getElementById('vue-banque') || document.querySelector('.journal-banque') || document.body;
    const tbody = document.getElementById('body-tableau-banque') || vueBanque.querySelector('tbody');
    const soldeEl = document.getElementById('solde-banque') || vueBanque.querySelector('span');

    if (!tbody) return;

    const supabase = getSupabase();
    if (!supabase) return;

    try {
        const { data: transactions, error } = await supabase
            .from('transactions')
            .select('*')
            .neq('category', 'Opération Diverse')
            .order('date', { ascending: false });

        if (error || !transactions || transactions.length === 0) {
            tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: #94a3b8; padding: 20px;">Aucun mouvement bancaire enregistré.</td></tr>`;
            if (soldeEl) soldeEl.textContent = "0,00 €";
            return;
        }

        let totalDebit = 0;
        let totalCredit = 0;

        const html = transactions.map(row => {
            const isEncaissement = (row.type || '').toLowerCase() === 'recette' || (row.type || '').toLowerCase() === 'income';
            const montant = parseFloat(row.amount || row.montant || 0);

            if (isEncaissement) {
                totalDebit += montant;
            } else {
                totalCredit += montant;
            }

            const sensLabel = isEncaissement ? 'Encaissement' : 'Décaissement';
            const sensBadge = isEncaissement 
                ? `<span style="background: #dcfce7; color: #15803d; padding: 3px 8px; border-radius: 4px; font-weight: 600; font-size: 0.8rem;">${sensLabel}</span>`
                : `<span style="background: #fee2e2; color: #b91c1c; padding: 3px 8px; border-radius: 4px; font-weight: 600; font-size: 0.8rem;">${sensLabel}</span>`;

            const fileUrl = row.justificatif_url || row.file_path;
            const docLink = fileUrl 
                ? `<a href="${fileUrl}" target="_blank" style="color: #2563eb; font-weight: 600; text-decoration: underline;">📎 Scan</a>` 
                : `<span style="color: #cbd5e1;">-</span>`;

            return `
                <tr style="border-bottom: 1px solid #f1f5f9;">
                    <td style="padding: 10px; color: #334155;">${row.date || '-'}</td>
                    <td style="padding: 10px;">${sensBadge}</td>
                    <td style="padding: 10px; color: #475569;">${row.category || row.categorie || 'Soins infirmiers'}</td>
                    <td style="padding: 10px; color: #1e293b; font-weight: 500;">${row.description || row.libelle || '-'}</td>
                    <td style="padding: 10px; color: #dc2626; font-weight: 600; text-align: right;">${!isEncaissement ? formatEuro(montant) : '-'}</td>
                    <td style="padding: 10px; color: #16a34a; font-weight: 600; text-align: right;">${isEncaissement ? formatEuro(montant) : '-'}</td>
                    <td style="padding: 10px; text-align: center;">${docLink}</td>
                    <td style="padding: 10px; text-align: center; white-space: nowrap;">
                        <button onclick="window.ouvrirModalModificationBanque('${row.id}')" style="background: none; border: none; cursor: pointer; font-size: 1.1rem; margin-right: 6px;" title="Modifier l'opération et le scan">✏️</button>
                        <button onclick="window.supprimerMouvementBanque('${row.id}', '${row.id}')" style="background: none; border: none; color: #ef4444; cursor: pointer; font-size: 1.1rem;" title="Supprimer">🗑️</button>
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

async function ouvrirModalModificationBanque(transactionId) {
    const supabase = getSupabase();
    if (!supabase) return;

    try {
        const { data, error } = await supabase.from('transactions').select('*').eq('id', transactionId).single();
        if (error || !data) {
            alert("Impossible de charger l'opération.");
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

        if (editId) editId.value = '';
        if (editTransId) editTransId.value = data.id;
        if (editDate) editDate.value = data.date || '';
        if (editDesc) editDesc.value = data.description || '';
        if (editMontant) editMontant.value = data.amount || data.montant || 0;
        if (editCat) editCat.value = data.category || data.categorie || '';
        if (editType) editType.value = (data.type || '').toLowerCase() === 'recette' ? 'Recette' : 'Dépense';
        if (editFile) editFile.value = '';

        const modal = document.getElementById('modal-modifier');
        if (modal) modal.style.display = 'flex';

    } catch (err) {
        console.error("Erreur ouverture modal banque :", err);
    }
}

async function supprimerMouvementBanque(id, transactionId) {
    if (!confirm("Voulez-vous vraiment supprimer cet enregistrement ?")) return;

    const supabase = getSupabase();
    if (!supabase) return;

    const realTxId = transactionId || id;

    await supabase.from('ecritures_comptables').delete().eq('transaction_id', realTxId);
    await supabase.from('transactions').delete().eq('id', realTxId);

    await chargerJournalBanque();
    if (typeof window.chargerGrandLivre === 'function') {
        await window.chargerGrandLivre();
    }
    window.dispatchEvent(new CustomEvent('ecritureAjoutee'));
}

// Exports globaux
window.getSupabase = getSupabase;
window.ajouterTransaction = ajouterTransaction;
window.chargerTransactionsListe = chargerTransactionsListe;
window.supprimerTransaction = supprimerTransaction;
window.chargerJournalBanque = chargerJournalBanque;
window.chargerTransactions = chargerJournalBanque;
window.ajouterPaiement = ajouterPaiement;
window.supprimerMouvementBanque = supprimerMouvementBanque;
window.ouvrirModalModificationBanque = ouvrirModalModificationBanque;

if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(chargerJournalBanque, 200);
} else {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(chargerJournalBanque, 200);
    });
}
