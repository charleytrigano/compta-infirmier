// ==========================================
// COMPTABILITÉ LIBÉRALE - SCRIPT PRINCIPAL
// Transactions, Journal de Banque, Journal & Grand Livre
// ==========================================

window.listeTransactions = [];

// Schéma de correspondance dynamique des colonnes Supabase
window.schemaColonnes = {
    date: 'date',
    type: 'type',
    categorie: 'categorie',
    description: 'description',
    montant: 'montant'
};

window.detecterSchema = function(premierObjet) {
    if (!premierObjet) return;

    if ('montant' in premierObjet) window.schemaColonnes.montant = 'montant';
    else if ('amount' in premierObjet) window.schemaColonnes.montant = 'amount';

    if ('categorie' in premierObjet) window.schemaColonnes.categorie = 'categorie';
    else if ('category' in premierObjet) window.schemaColonnes.categorie = 'category';

    if ('description' in premierObjet) window.schemaColonnes.description = 'description';
    else if ('libelle' in premierObjet) window.schemaColonnes.description = 'libelle';
};

// ------------------------------------------
// 1. CHARGEMENT DEPUIS SUPABASE
// ------------------------------------------
window.chargerTransactions = async function() {
    if (!window.supabaseClient) {
        console.error("❌ Supabase n'est pas initialisé.");
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

        window.rafraichirToutesLesVues();

    } catch (err) {
        console.error("Erreur lors du chargement des transactions :", err.message);
    }
};

window.rafraichirToutesLesVues = function() {
    window.afficherTransactions(window.listeTransactions);
    window.afficherBanque(window.listeTransactions);
    window.afficherJournal(window.listeTransactions);
    window.afficherGrandLivre(window.listeTransactions);
};

// ------------------------------------------
// 2. ONGLET : TRANSACTIONS
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
// 3. ONGLET : JOURNAL DE BANQUE
// ------------------------------------------
window.afficherBanque = function(transactions) {
    const tbody = document.getElementById('body-tableau-banque');
    const elSolde = document.getElementById('solde-banque');

    let totalBanque = 0;

    if (tbody) tbody.innerHTML = '';

    transactions.forEach(tx => {
        const typeBrut = (tx[window.schemaColonnes.type] || tx.type || '').toString().toLowerCase();
        const estRecette = typeBrut === 'recette';

        let valeurMontant = tx[window.schemaColonnes.montant] !== undefined ? tx[window.schemaColonnes.montant] : (tx.montant || tx.amount || 0);
        if (typeof valeurMontant === 'string') valeurMontant = valeurMontant.replace(',', '.');
        const montantNum = Math.abs(parseFloat(valeurMontant) || 0);

        if (estRecette) totalBanque += montantNum;
        else totalBanque -= montantNum;

        if (tbody) {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${tx[window.schemaColonnes.date] || tx.date || ''}</td>
                <td><strong>${estRecette ? 'Encaissement' : 'Décaissement'}</strong></td>
                <td>${tx[window.schemaColonnes.categorie] || tx.categorie || '-'}</td>
                <td>${tx[window.schemaColonnes.description] || tx.description || ''}</td>
                <td style="color:#dc2626; font-weight:bold;">${estRecette ? '' : '- ' + montantNum.toFixed(2) + ' €'}</td>
                <td style="color:#16a34a; font-weight:bold;">${estRecette ? '+ ' + montantNum.toFixed(2) + ' €' : ''}</td>
                <td>
                    <button class="btn-edit" onclick="window.ouvrirModalModification('${tx.id}')">✏️</button>
                    <button class="btn-delete" onclick="window.supprimerTransaction('${tx.id}')">🗑️</button>
                </td>
            `;
            tbody.appendChild(tr);
        }
    });

    if (elSolde) {
        elSolde.textContent = totalBanque.toFixed(2) + ' €';
        elSolde.style.color = totalBanque >= 0 ? '#16a34a' : '#dc2626';
    }
};

window.ajouterPaiement = async function() {
    const date = document.getElementById('pay-date').value;
    const type = document.getElementById('pay-type').value;
    const categorie = document.getElementById('pay-categorie').value;
    const description = document.getElementById('pay-description').value;
    const montantInput = parseFloat(document.getElementById('pay-montant').value) || 0;

    if (!date || !description || isNaN(montantInput)) {
        alert("Veuillez remplir tous les champs du paiement.");
        return;
    }

    const montantFinal = type.toLowerCase() === 'dépense' ? -Math.abs(montantInput) : Math.abs(montantInput);

    const objetPayload = {};
    objetPayload[window.schemaColonnes.date] = date;
    objetPayload[window.schemaColonnes.type] = type;
    objetPayload[window.schemaColonnes.categorie] = categorie;
    objetPayload[window.schemaColonnes.description] = description;
    objetPayload[window.schemaColonnes.montant] = montantFinal;

    try {
        const { error } = await window.supabaseClient
            .from('transactions')
            .insert([objetPayload]);

        if (error) throw error;

        const form = document.getElementById('form-ajouter-paiement');
        if (form) form.reset();

        await window.chargerTransactions();
    } catch (err) {
        console.error("Erreur d'enregistrement du paiement :", err.message);
        alert("Erreur lors du paiement : " + err.message);
    }
};

// ------------------------------------------
// 4. ONGLET : JOURNAL COMPTABLE
// ------------------------------------------
window.afficherJournal = function(transactions) {
    let conteneur = document.getElementById('journal') || 
                    document.getElementById('section-journal') || 
                    document.getElementById('tab-journal') ||
                    document.querySelector('[data-tab="journal"]');

    if (!conteneur) {
        const tousLesTitres = document.querySelectorAll('h2, h3');
        tousLesTitres.forEach(el => {
            if (el.textContent.includes('Journal')) conteneur = el.parentElement;
        });
    }

    if (!conteneur) return;

    let tbody = document.getElementById('body-tableau-journal');
    if (!tbody) {
        conteneur.innerHTML = `
            <h2 style="color:#1e293b; margin-bottom:15px;">Journal des écritures</h2>
            <div style="overflow-x:auto; background:#fff; border-radius:8px; border:1px solid #e2e8f0; padding:15px;">
                <table style="width:100%; border-collapse:collapse; text-align:left;">
                    <thead>
                        <tr style="background:#f8fafc; border-bottom:2px solid #e2e8f0; color:#475569;">
                            <th style="padding:10px;">Date</th>
                            <th style="padding:10px;">Catégorie</th>
                            <th style="padding:10px;">Description</th>
                            <th style="padding:10px; color:#dc2626;">Débit (Dépense)</th>
                            <th style="padding:10px; color:#16a34a;">Crédit (Recette)</th>
                            <th style="padding:10px;">Actions</th>
                        </tr>
                    </thead>
                    <tbody id="body-tableau-journal"></tbody>
                </table>
            </div>
        `;
        tbody = document.getElementById('body-tableau-journal');
    }

    tbody.innerHTML = '';

    if (transactions.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:#94a3b8; padding:20px;">Le journal est vide.</td></tr>`;
        return;
    }

    const transactionsTriees = [...transactions].reverse();

    transactionsTriees.forEach(tx => {
        const typeBrut = (tx[window.schemaColonnes.type] || tx.type || '').toString().toLowerCase();
        const estRecette = typeBrut === 'recette';

        let valeurMontant = tx[window.schemaColonnes.montant] !== undefined ? tx[window.schemaColonnes.montant] : (tx.montant || tx.amount || 0);
        if (typeof valeurMontant === 'string') valeurMontant = valeurMontant.replace(',', '.');
        const montant = Math.abs(parseFloat(valeurMontant) || 0).toFixed(2);

        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid #f1f5f9';
        tr.innerHTML = `
            <td style="padding:10px;">${tx[window.schemaColonnes.date] || tx.date || ''}</td>
            <td style="padding:10px;">${tx[window.schemaColonnes.categorie] || tx.categorie || '-'}</td>
            <td style="padding:10px;">${tx[window.schemaColonnes.description] || tx.description || ''}</td>
            <td style="padding:10px; color:#dc2626; font-weight:bold;">${estRecette ? '' : montant + ' €'}</td>
            <td style="padding:10px; color:#16a34a; font-weight:bold;">${estRecette ? montant + ' €' : ''}</td>
            <td style="padding:10px;">
                <button class="btn-edit" onclick="window.ouvrirModalModification('${tx.id}')">✏️</button>
                <button class="btn-delete" onclick="window.supprimerTransaction('${tx.id}')">🗑️</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
};

// ------------------------------------------
// 5. ONGLET : GRAND LIVRE
// ------------------------------------------
window.afficherGrandLivre = function(transactions) {
    let conteneur = document.getElementById('grand-livre') || 
                    document.getElementById('section-grand-livre') || 
                    document.getElementById('tab-grand-livre') ||
                    document.querySelector('[data-tab="grand-livre"]');

    if (!conteneur) {
        const tousLesTitres = document.querySelectorAll('h2, h3');
        tousLesTitres.forEach(el => {
            if (el.textContent.includes('Grand Livre')) conteneur = el.parentElement;
        });
    }

    if (!conteneur) return;

    if (transactions.length === 0) {
        conteneur.innerHTML = `
            <h2 style="color:#1e293b; margin-bottom:15px;">Grand Livre</h2>
            <p style="text-align:center; color:#94a3b8; padding:20px;">Le Grand Livre est vide.</p>
        `;
        return;
    }

    const groupes = {};
    const nomsCatOriginal = {};

    transactions.forEach(tx => {
        let catBrute = tx[window.schemaColonnes.categorie] || tx.categorie || tx.category || 'Non classé';
        const cleNormale = catBrute.toString().toLowerCase().replace(/\s+/g, ' ').trim();

        if (!groupes[cleNormale]) {
            groupes[cleNormale] = [];
            nomsCatOriginal[cleNormale] = catBrute.toString().replace(/\s+/g, ' ').trim();
        }
        groupes[cleNormale].push(tx);
    });

    let htmlComplet = `<h2 style="color:#1e293b; margin-bottom:15px;">Grand Livre des comptes</h2>`;

    Object.keys(groupes).sort().forEach(cle => {
        const nomAffiche = nomsCatOriginal[cle] || cle;
        let totalCategorie = 0;
        let lignesHtml = '';

        groupes[cle].forEach(tx => {
            const typeBrut = (tx[window.schemaColonnes.type] || tx.type || '').toString().toLowerCase();
            const estRecette = typeBrut === 'recette';

            let valeurMontant = tx[window.schemaColonnes.montant] !== undefined ? tx[window.schemaColonnes.montant] : (tx.montant || tx.amount || 0);
            if (typeof valeurMontant === 'string') valeurMontant = valeurMontant.replace(',', '.');
            const montantNum = parseFloat(valeurMontant) || 0;

            if (estRecette) totalCategorie += Math.abs(montantNum);
            else totalCategorie -= Math.abs(montantNum);

            lignesHtml += `
                <tr style="border-bottom:1px solid #f1f5f9;">
                    <td style="padding:8px 12px;">${tx[window.schemaColonnes.date] || tx.date || ''}</td>
                    <td style="padding:8px 12px;">${tx[window.schemaColonnes.description] || tx.description || ''}</td>
                    <td style="padding:8px 12px; color:${estRecette ? '#16a34a' : '#dc2626'}; font-weight:bold;">
                        ${estRecette ? '+' : '-'} ${Math.abs(montantNum).toFixed(2)} €
                    </td>
                    <td style="padding:8px 12px;">
                        <button class="btn-edit" onclick="window.ouvrirModalModification('${tx.id}')">✏️</button>
                        <button class="btn-delete" onclick="window.supprimerTransaction('${tx.id}')">🗑️</button>
                    </td>
                </tr>
            `;
        });

        const couleurTotal = totalCategorie >= 0 ? '#16a34a' : '#dc2626';

        htmlComplet += `
            <div style="margin-bottom:20px; background:#fff; border:1px solid #e2e8f0; border-radius:8px; overflow:hidden;">
                <div style="background:#f8fafc; padding:12px 16px; border-bottom:1px solid #e2e8f0; display:flex; justify-content:space-between; align-items:center;">
                    <h3 style="margin:0; font-size:1.05rem; color:#1e293b;">📂 ${nomAffiche}</h3>
                    <span style="font-weight:bold; color:${couleurTotal};">Solde : ${totalCategorie.toFixed(2)} €</span>
                </div>
                <table style="width:100%; border-collapse:collapse; text-align:left;">
                    <thead>
                        <tr style="background:#f1f5f9; font-size:0.85rem; color:#64748b;">
                            <th style="padding:8px 12px;">Date</th>
                            <th style="padding:8px 12px;">Description</th>
                            <th style="padding:8px 12px;">Montant</th>
                            <th style="padding:8px 12px;">Actions</th>
                        </tr>
                    </thead>
                    <tbody>${lignesHtml}</tbody>
                </table>
            </div>
        `;
    });

    conteneur.innerHTML = htmlComplet;
};

// ------------------------------------------
// 6. FONCTIONS DE MODALE & ÉDITION
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

    const objetPayload = {};
    objetPayload[window.schemaColonnes.date] = date;
    objetPayload[window.schemaColonnes.type] = type;
    objetPayload[window.schemaColonnes.categorie] = categorie;
    objetPayload[window.schemaColonnes.description] = description;
    objetPayload[window.schemaColonnes.montant] = montantFinal;

    try {
        const { error } = await window.supabaseClient
            .from('transactions')
            .insert([objetPayload]);

        if (error) throw error;

        const form = document.getElementById('form-ajouter-transaction');
        if (form) form.reset();

        await window.chargerTransactions();
    } catch (err) {
        console.error("Erreur d'ajout dans Supabase :", err.message);
        alert("Erreur lors de l'enregistrement : " + err.message);
    }
};

window.sauvegarderModification = async function() {
    const elId = document.getElementById('edit-id');
    const elDate = document.getElementById('edit-date');
    const elType = document.getElementById('edit-type');
    const elCat = document.getElementById('edit-categorie');
    const elDesc = document.getElementById('edit-description');
    const elMontant = document.getElementById('edit-montant');

    if (!elId || !elId.value) return;

    const id = elId.value;
    const date = elDate ? elDate.value : '';
    const type = elType ? elType.value : 'Recette';
    const categorie = elCat ? elCat.value : '';
    const description = elDesc ? elDesc.value : '';
    const montantInput = elMontant ? parseFloat(elMontant.value) : 0;

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

window.ouvrirModalModification = function(id) {
    const tx = window.listeTransactions.find(t => t.id.toString() === id.toString());
    if (!tx) return;

    const elId = document.getElementById('edit-id');
    if (elId) elId.value = tx.id;

    const elDate = document.getElementById('edit-date');
    if (elDate) elDate.value = tx[window.schemaColonnes.date] || tx.date || '';

    const elType = document.getElementById('edit-type');
    if (elType) elType.value = tx[window.schemaColonnes.type] || tx.type || 'Recette';

    const elCat = document.getElementById('edit-categorie');
    if (elCat) elCat.value = tx[window.schemaColonnes.categorie] || tx.categorie || '';

    const elDesc = document.getElementById('edit-description');
    if (elDesc) elDesc.value = tx[window.schemaColonnes.description] || tx.description || '';

    const elMontant = document.getElementById('edit-montant');
    if (elMontant) {
        let m = tx[window.schemaColonnes.montant] !== undefined ? tx[window.schemaColonnes.montant] : (tx.montant || tx.amount || 0);
        if (typeof m === 'string') m = m.replace(',', '.');
        elMontant.value = Math.abs(parseFloat(m) || 0);
    }

    const modal = document.getElementById('modal-modifier');
    if (modal) modal.style.display = 'flex';
};

window.fermerModal = function() {
    const modal = document.getElementById('modal-modifier');
    if (modal) modal.style.display = 'none';
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

// ------------------------------------------
// 7. ÉCOUTEURS & INITIALISATION
// ------------------------------------------
document.addEventListener('click', function(e) {
    const cible = e.target.closest('button, a, .nav-link, .tab-btn');
    if (cible) {
        setTimeout(function() {
            window.rafraichirToutesLesVues();
        }, 100);
    }
});

document.addEventListener('DOMContentLoaded', function() {
    setTimeout(function() {
        if (window.supabaseClient) {
            window.chargerTransactions();
        }
    }, 300);
});
