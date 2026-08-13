// ==========================================
// GESTION DES TRANSACTIONS, JOURNAL & GRAND LIVRE
// ==========================================

window.listeTransactions = [];

// Schéma de correspondance par défaut
window.schemaColonnes = {
    date: 'date',
    type: 'type',
    categorie: 'categorie',
    description: 'description',
    montant: 'montant'
};

/**
 * Détecte automatiquement les noms de colonnes réels dans Supabase
 */
window.detecterSchema = function(premierObjet) {
    if (!premierObjet) return;

    if ('montant' in premierObjet) window.schemaColonnes.montant = 'montant';
    else if ('amount' in premierObjet) window.schemaColonnes.montant = 'amount';
    else if ('valeur' in premierObjet) window.schemaColonnes.montant = 'valeur';

    if ('categorie' in premierObjet) window.schemaColonnes.categorie = 'categorie';
    else if ('category' in premierObjet) window.schemaColonnes.categorie = 'category';
    else if ('catégorie' in premierObjet) window.schemaColonnes.categorie = 'catégorie';

    if ('description' in premierObjet) window.schemaColonnes.description = 'description';
    else if ('libelle' in premierObjet) window.schemaColonnes.description = 'libelle';
    else if ('libellé' in premierObjet) window.schemaColonnes.description = 'libellé';
};

// ------------------------------------------
// 1. CHARGER LES TRANSACTIONS DEPUIS SUPABASE
// ------------------------------------------
window.chargerTransactions = async function() {
    if (!window.supabaseClient) {
        console.error("❌ Supabase n'est pas prêt.");
        return;
    }

    try {
        const { data, error } = await window.supabaseClient
            .from('transactions')
            .select('*')
            .order('date', { ascending: false });

        if (error) throw error;

        window.listeTransactions = data || [];

        if (window.listeTransactions.length > 0) {
            window.detecterSchema(window.listeTransactions[0]);
        }

        // Rafraîchissement simultané des 3 vues
        window.afficherTransactions(window.listeTransactions);
        window.afficherJournal(window.listeTransactions);
        window.afficherGrandLivre(window.listeTransactions);

    } catch (err) {
        console.error("Erreur lors de la récupération des transactions :", err.message);
    }
};

// ------------------------------------------
// 2. AFFICHER LE TABLEAU DES TRANSACTIONS
// ------------------------------------------
window.afficherTransactions = function(transactions) {
    const tbody = document.getElementById('body-tableau-transactions');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (transactions.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:#94a3b8; padding:20px;">Aucune transaction enregistrée.</td></tr>`;
        return;
    }

    transactions.forEach(tx => {
        const typeBrut = (tx[window.schemaColonnes.type] || tx.type || '').toString().toLowerCase();
        const estRecette = typeBrut === 'recette';

        let valeurMontant = tx[window.schemaColonnes.montant] !== undefined ? tx[window.schemaColonnes.montant] : (tx.montant || tx.amount || 0);
        if (typeof valeurMontant === 'string') valeurMontant = valeurMontant.replace(',', '.');
        
        const montantNumerique = parseFloat(valeurMontant) || 0;
        const montantFormate = Math.abs(montantNumerique).toFixed(2);
        const couleurMontant = estRecette ? '#16a34a' : '#dc2626';

        const categorieAffichee = tx[window.schemaColonnes.categorie] || tx.categorie || tx.category || '-';
        const descriptionAffichee = tx[window.schemaColonnes.description] || tx.description || tx.libelle || '';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${tx[window.schemaColonnes.date] || tx.date || ''}</td>
            <td><strong>${estRecette ? 'Recette' : 'Dépense'}</strong></td>
            <td>${categorieAffichee}</td>
            <td>${descriptionAffichee}</td>
            <td style="font-weight: bold; color: ${couleurMontant};">
                ${estRecette ? '+' : '-'} ${montantFormate} €
            </td>
            <td>
                <button class="btn-edit" onclick="window.ouvrirModalModification('${tx.id}')">✏️ Modifier</button>
                <button class="btn-delete" onclick="window.supprimerTransaction('${tx.id}')">🗑️ Supprimer</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
};

// ------------------------------------------
// 3. AFFICHER LE JOURNAL COMPTABLE
// ------------------------------------------
window.afficherJournal = function(transactions) {
    const tbody = document.getElementById('body-tableau-journal');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (transactions.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:#94a3b8; padding:20px;">Le journal est vide.</td></tr>`;
        return;
    }

    // Le journal s'affiche par ordre chronologique (du plus ancien au plus récent)
    const transactionsTriees = [...transactions].reverse();

    transactionsTriees.forEach(tx => {
        const typeBrut = (tx[window.schemaColonnes.type] || tx.type || '').toString().toLowerCase();
        const estRecette = typeBrut === 'recette';

        let valeurMontant = tx[window.schemaColonnes.montant] !== undefined ? tx[window.schemaColonnes.montant] : (tx.montant || tx.amount || 0);
        if (typeof valeurMontant === 'string') valeurMontant = valeurMontant.replace(',', '.');
        const montant = Math.abs(parseFloat(valeurMontant) || 0).toFixed(2);

        const debit = estRecette ? '' : `${montant} €`;
        const credit = estRecette ? `${montant} €` : '';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${tx[window.schemaColonnes.date] || tx.date || ''}</td>
            <td>${tx[window.schemaColonnes.categorie] || tx.categorie || '-'}</td>
            <td>${tx[window.schemaColonnes.description] || tx.description || ''}</td>
            <td style="color:#dc2626; font-weight:bold;">${debit}</td>
            <td style="color:#16a34a; font-weight:bold;">${credit}</td>
        `;
        tbody.appendChild(tr);
    });
};

// ------------------------------------------
// 4. AFFICHER LE GRAND LIVRE (PAR CATÉGORIE)
// ------------------------------------------
window.afficherGrandLivre = function(transactions) {
    const conteneur = document.getElementById('contenu-grand-livre') || document.getElementById('body-tableau-grand-livre');
    if (!conteneur) return;

    conteneur.innerHTML = '';

    if (transactions.length === 0) {
        conteneur.innerHTML = `<p style="text-align:center; color:#94a3b8; padding:20px;">Le Grand Livre est vide.</p>`;
        return;
    }

    // Regroupement par catégorie
    const groupes = {};
    transactions.forEach(tx => {
        const cat = tx[window.schemaColonnes.categorie] || tx.categorie || tx.category || 'Non classé';
        if (!groupes[cat]) groupes[cat] = [];
        groupes[cat].push(tx);
    });

    // Génération des blocs de comptes
    Object.keys(groupes).sort().forEach(cat => {
        let totalCategorie = 0;
        let lignesHtml = '';

        groupes[cat].forEach(tx => {
            const typeBrut = (tx[window.schemaColonnes.type] || tx.type || '').toString().toLowerCase();
            const estRecette = typeBrut === 'recette';

            let valeurMontant = tx[window.schemaColonnes.montant] !== undefined ? tx[window.schemaColonnes.montant] : (tx.montant || tx.amount || 0);
            if (typeof valeurMontant === 'string') valeurMontant = valeurMontant.replace(',', '.');
            const montantNum = parseFloat(valeurMontant) || 0;

            if (estRecette) totalCategorie += Math.abs(montantNum);
            else totalCategorie -= Math.abs(montantNum);

            lignesHtml += `
                <tr>
                    <td>${tx[window.schemaColonnes.date] || tx.date || ''}</td>
                    <td>${tx[window.schemaColonnes.description] || tx.description || ''}</td>
                    <td style="color:${estRecette ? '#16a34a' : '#dc2626'}; font-weight:bold;">
                        ${estRecette ? '+' : '-'} ${Math.abs(montantNum).toFixed(2)} €
                    </td>
                </tr>
            `;
        });

        const blocCompte = document.createElement('div');
        blocCompte.className = 'bloc-grand-livre';
        blocCompte.style.marginBottom = '25px';
        blocCompte.style.border = '1px solid #e2e8f0';
        blocCompte.style.borderRadius = '8px';
        blocCompte.style.overflow = 'hidden';

        const couleurTotal = totalCategorie >= 0 ? '#16a34a' : '#dc2626';

        blocCompte.innerHTML = `
            <div style="background:#f8fafc; padding:12px 16px; border-bottom:1px solid #e2e8f0; display:flex; justify-between; align-items:center;">
                <h3 style="margin:0; font-size:1.1rem; color:#1e293b;">📂 ${cat}</h3>
                <span style="font-weight:bold; color:${couleurTotal}; font-size:1.05rem;">Solde : ${totalCategorie.toFixed(2)} €</span>
            </div>
            <table style="width:100%; border-collapse:collapse;">
                <thead>
                    <tr style="background:#f1f5f9; text-align:left; font-size:0.85rem; color:#64748b;">
                        <th style="padding:8px 12px;">Date</th>
                        <th style="padding:8px 12px;">Description</th>
                        <th style="padding:8px 12px;">Montant</th>
                    </tr>
                </thead>
                <tbody>
                    ${lignesHtml}
                </tbody>
            </table>
        `;

        conteneur.appendChild(blocCompte);
    });
};

// ------------------------------------------
// 5. FONCTIONS D'EDITION & SUPPRESSION
// ------------------------------------------
window.ajouterTransaction = async function() {
    const date = document.getElementById('tx-date').value;
    const type = document.getElementById('tx-type').value;
    const categorie = document.getElementById('tx-categorie').value;
    const description = document.getElementById('tx-description').value;
    const montantInput = parseFloat(document.getElementById('tx-montant').value) || 0;

    if (!date || !description || isNaN(montantInput)) {
        alert("Veuillez remplir tous les champs obligatoires (*).");
        return;
    }

    const montantFinal = type.toLowerCase() === 'dépense' ? -Math.abs(montantInput) : Math.abs(montantInput);

    const objetPaylod = {};
    objetPaylod[window.schemaColonnes.date] = date;
    objetPaylod[window.schemaColonnes.type] = type;
    objetPaylod[window.schemaColonnes.categorie] = categorie;
    objetPaylod[window.schemaColonnes.description] = description;
    objetPaylod[window.schemaColonnes.montant] = montantFinal;

    try {
        const { error } = await window.supabaseClient
            .from('transactions')
            .insert([objetPaylod]);

        if (error) throw error;

        document.getElementById('form-ajouter-transaction').reset();
        await window.chargerTransactions();
    } catch (err) {
        console.error("Erreur d'ajout dans Supabase :", err.message);
        alert("Erreur lors de l'enregistrement : " + err.message);
    }
};

window.supprimerTransaction = async function(id) {
    if (!confirm("Voulez-vous vraiment supprimer cette transaction ?")) return;

    try {
        const { error } = await window.supabaseClient
            .from('transactions')
            .delete()
            .eq('id', id);

        if (error) throw error;

        await window.chargerTransactions();
    } catch (err) {
        console.error("Erreur de suppression :", err.message);
        alert("Impossible de supprimer : " + err.message);
    }
};

window.ouvrirModalModification = function(id) {
    const tx = window.listeTransactions.find(t => t.id.toString() === id.toString());
    if (!tx) return;

    document.getElementById('edit-id').value = tx.id;
    document.getElementById('edit-date').value = tx[window.schemaColonnes.date] || tx.date || '';
    document.getElementById('edit-type').value = tx[window.schemaColonnes.type] || tx.type || 'Recette';
    document.getElementById('edit-categorie').value = tx[window.schemaColonnes.categorie] || tx.categorie || '';
    document.getElementById('edit-description').value = tx[window.schemaColonnes.description] || tx.description || '';

    let montantBrut = tx[window.schemaColonnes.montant] !== undefined ? tx[window.schemaColonnes.montant] : (tx.montant || tx.amount || 0);
    if (typeof montantBrut === 'string') montantBrut = montantBrut.replace(',', '.');
    document.getElementById('edit-montant').value = Math.abs(parseFloat(montantBrut) || 0);

    document.getElementById('modal-modifier').style.display = 'flex';
};

window.sauvegarderModification = async function() {
    const id = document.getElementById('edit-id').value;
    const date = document.getElementById('edit-date').value;
    const type = document.getElementById('edit-type').value;
    const categorie = document.getElementById('edit-categorie').value;
    const description = document.getElementById('edit-description').value;
    const montantInput = parseFloat(document.getElementById('edit-montant').value) || 0;

    const montantFinal = type.toLowerCase() === 'dépense' ? -Math.abs(montantInput) : Math.abs(montantInput);

    const objetModification = {};
    objetModification[window.schemaColonnes.date] = date;
    objetModification[window.schemaColonnes.type] = type;
    objetModification[window.schemaColonnes.categorie] = categorie;
    objetModification[window.schemaColonnes.description] = description;
    objetModification[window.schemaColonnes.montant] = montantFinal;

    try {
        const { error } = await window.supabaseClient
            .from('transactions')
            .update(objetModification)
            .eq('id', id);

        if (error) throw error;

        window.fermerModal();
        await window.chargerTransactions();
    } catch (err) {
        console.error("Erreur de mise à jour :", err.message);
        alert("Erreur lors de la modification : " + err.message);
    }
};

// Initialisation au chargement de la page
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(function() {
        if (window.supabaseClient) {
            window.chargerTransactions();
        }
    }, 300);
});
