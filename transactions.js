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
    const typeTransaction = isEncaissement ? 'recette' : 'dépense';

    // Extraction du compte de contrepartie (ex: 411Abadie)
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
        has_attachments: false
    };

    const { data: parentData, error: parentError } = await supabase
        .from('transactions')
        .insert([payloadParent])
        .select();

    if (parentError || !parentData || parentData.length === 0) {
        alert("Erreur lors de la création de la transaction parent : " + (parentError ? parentError.message : "Données non renvoyées"));
        return;
    }

    const realTransactionId = parentData[0].id;

    // 2. Écriture Banque STRICTEMENT sur le 512000
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

    // 3. Écriture Contrepartie Tiers (ex: 411Abadie)
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
        
        await chargerJournalBanque();
        if (typeof window.chargerGrandLivre === 'function') {
            await window.chargerGrandLivre();
        }
        window.dispatchEvent(new CustomEvent('ecritureAjoutee'));

        alert("Paiement enregistré avec succès !");
    }
}
