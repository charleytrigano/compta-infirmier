// sync_ecritures.js - Synchronisation de la partie double dans la table Supabase 'ecritures_comptables'

async function synchroniserEcrituresSupabase() {
    const supabase = window.supabaseClient || (window.supabase && typeof window.supabase.from === 'function' ? window.supabase : null);
    if (!supabase) {
        console.error("Client Supabase non trouvé.");
        return;
    }

    // 1. Récupération des transactions brutes
    const { data: transactions, error: errTx } = await supabase.from('transactions').select('*');
    if (errTx) {
        console.error("Erreur récupération transactions :", errTx);
        return;
    }

    // 2. Génération des paires Débit / Crédit pour chaque transaction
    const nouvellesEcritures = [];

    transactions.forEach(tx => {
        const val = Math.abs(parseFloat(tx.amount || tx.montant || 0));
        const type = String(tx.type || '').toLowerCase();
        const cat = (tx.category || tx.categorie || '').toLowerCase();
        const desc = (tx.description || '').trim();
        const isRecette = type.includes('recette') || type.includes('rec') || cat.includes('soins');

        if (isRecette) {
            // Ligne Débit : Banque (512000)
            nouvellesEcritures.push({
                transaction_id: tx.id,
                date: tx.date,
                compte_code: '512000',
                compte_libelle: '512000 - Banque / Compte Courant',
                category: tx.category || 'Soins infirmiers',
                description: `Encaissement : ${desc || 'Patient'}`,
                debit: val,
                credit: 0
            });

            // Ligne Crédit : Patient / Tiers (411xxx)
            const codePatient = desc ? `411${desc.replace(/[^a-zA-Z0-9]/g, '').substring(0, 4).toUpperCase()}` : '411000';
            nouvellesEcritures.push({
                transaction_id: tx.id,
                date: tx.date,
                compte_code: codePatient,
                compte_libelle: `${codePatient} - Patient (${desc || 'Divers'})`,
                category: tx.category || 'Soins infirmiers',
                description: `Règlement soins : ${desc || 'Patient'}`,
                debit: 0,
                credit: val
            });
        } else {
            // Ligne Débit : Charge (6xxxx)
            let codeCharge = '606000';
            let libelleCharge = '606000 - Achats et fournitures';

            if (cat.includes('carpimko')) {
                codeCharge = '646000';
                libelleCharge = '646000 - Cotisations CARPIMKO';
            } else if (cat.includes('urssaf')) {
                codeCharge = '645000';
                libelleCharge = '645000 - Cotisations URSSAF';
            }

            nouvellesEcritures.push({
                transaction_id: tx.id,
                date: tx.date,
                compte_code: codeCharge,
                compte_libelle: libelleCharge,
                category: tx.category || 'Dépense',
                description: desc || 'Paiement charge',
                debit: val,
                credit: 0
            });

            // Ligne Crédit : Banque (512000)
            nouvellesEcritures.push({
                transaction_id: tx.id,
                date: tx.date,
                compte_code: '512000',
                compte_libelle: '512000 - Banque / Compte Courant',
                category: tx.category || 'Dépense',
                description: `Décaissement : ${desc || 'Charge'}`,
                debit: 0,
                credit: val
            });
        }
    });

    // 3. Réinitialisation et enregistrement dans Supabase
    await supabase.from('ecritures_comptables').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    const { data: inserted, error: errInsert } = await supabase.from('ecritures_comptables').insert(nouvellesEcritures);

    if (errInsert) {
        console.error("Erreur lors de l'insertion Supabase :", errInsert);
    } else {
        console.log(`✅ Synchronisation réussie : ${nouvellesEcritures.length} écritures insérées dans Supabase.`);
    }
}

// Exécution directe
synchroniserEcrituresSupabase();
