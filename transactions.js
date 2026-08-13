// ==========================================
// COMPTABILITÉ LIBÉRALE - SCRIPT PRINCIPAL
// Synchronisation Supabase & Automatismes de Saisie
// ==========================================

window.listeTransactions = [];

// Correspondance automatique des champs
window.schemaColonnes = {
    date: 'date',
    type: 'type',
    categorie: 'categorie',
    description: 'description',
    montant: 'montant'
};

// ------------------------------------------
// 1. REGLES AUTOMATIQUES DE SAISIE
// ------------------------------------------
const REGLES_AUTOMATIQUES = [
    { motCle: 'cpam', categorie: 'Soins infirmiers', type: 'Recette' },
    { motCle: 'virement', categorie: 'Soins infirmiers', type: 'Recette' },
    { motCle: 'urssaf', categorie: 'URSSAF', type: 'Dépense' },
    { motCle: 'carpimko', categorie: 'Cotisations CARPIMKO', type: 'Dépense' },
    { motCle: 'essence', categorie: 'Frais de déplacement', type: 'Dépense' },
    { motCle: 'banque', categorie: 'Frais bancaires', type: 'Dépense' }
];

window.appliquerAutomatisation = function(inputId, typeId, catId) {
    const inputDesc = document.getElementById(inputId);
    if (!inputDesc) return;

    inputDesc.addEventListener('input', function() {
        const texte = this.value.toLowerCase();
        const regleTrouvee = REGLES_AUTOMATIQUES.find(r => texte.includes(r.motCle));

        if (regleTrouvee) {
            const elType = document.getElementById(typeId);
            const elCat = document.getElementById(catId);
            if (elType) elType.value = regleTrouvee.type;
            if (elCat) elCat.value = regleTrouvee.categorie;
        }
    });
};

// ------------------------------------------
// 2. CHARGEMENT DEPUIS SUPABASE
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
// 3. ONGLET : TRANSACTIONS
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
        const typeBrut = (tx.type || '').toString().toLowerCase();
        const estRecette = typeBrut === 'recette';
        const montantNum = Math.abs(parseFloat(tx.montant || tx.amount || 0));

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${tx.date || ''}</td>
            <td><strong>${estRecette ? 'Recette' : 'Dépense'}</strong></td>
            <td>${tx.categorie || '-'}</td>
            <td>${tx.description || ''}</td>
            <td style="font-weight: bold; color: ${estRecette ? '#16a34a' : '#dc2626'};">
                ${estRecette ? '+' : '-'} ${montantNum.toFixed(2)} €
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
// 4. ONGLET : JOURNAL DE BANQUE
// ------------------------------------------
window.afficherBanque = function(transactions) {
    const tbody = document.getElementById('body-tableau-banque');
    const elSolde = document.getElementById('solde-banque');
    let totalBanque = 0;

    if (tbody) tbody.innerHTML = '';

    transactions.forEach(tx => {
        const typeBrut = (tx.type || '').toString().toLowerCase();
        const estRecette = typeBrut === 'recette';
        const montantNum = Math.abs(parseFloat(tx.montant || tx.amount || 0));

        if (estRecette) totalBanque += montantNum;
        else totalBanque -= montantNum;

        if (tbody) {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${tx.date || ''}</td>
                <td><strong>${estRecette ? 'Encaissement' : 'Décaissement'}</strong></td>
                <td>${tx.categorie || '-'}</td>
                <td>${tx.description || ''}</td>
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

// Enregistrement manuel ou automatique d'un paiement
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

    try {
        const { error } = await window.supabaseClient
            .from('transactions')
            .insert([{ date, type, categorie, description, montant: montantFinal }]);

        if (error) throw error;

        const form = document.getElementById('form-ajouter-paiement');
        if (form) form.reset();

        await window.chargerTransactions();
    } catch (err) {
        console.error("Erreur d'enregistrement :", err.message);
        alert("Erreur : " + err.message);
    }
};

// ------------------------------------------
// 5. ONGLET : JOURNAL COMPTABLE
// ------------------------------------------
window.afficherJournal = function(transactions) {
    let conteneur = document.getElementById('vue-journal') || document.getElementById('journal');
    if (!conteneur) return;

    let tbody = document.getElementById('body-tableau-journal');
    if (!tbody) {
        conteneur.innerHTML = `
            <h2>📖 Journal des écritures</h2>
            <table style="width:100%; border-collapse:collapse; margin-top:15px; text-align:left;">
                <thead>
                    <tr style="background:#f1f5f9; color:#475569;">
                        <th style="padding:10px;">Date</th>
                        <th style="padding:10px;">Catégorie</th>
                        <th style="padding:10px;">Description</th>
                        <th style="padding:10px; color:#dc2626;">Débit (Dépense)</th>
                        <th style="padding:10px; color:#16a34a;">Crédit (Recette)</th>
                        <th style="padding:10px;">Action</th>
                    </tr>
                </thead>
                <tbody id="body-tableau-journal"></tbody>
            </table>
        `;
        tbody = document.getElementById('body-tableau-journal');
    }

    tbody.innerHTML = '';

    transactions.forEach(tx => {
        const estRecette = (tx.type || '').toLowerCase() === 'recette';
        const montant = Math.abs(parseFloat(tx.montant || 0)).toFixed(2);

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="padding:10px; border-bottom:1px solid #e2e8f0;">${tx.date || ''}</td>
            <td style="padding:10px; border-bottom:1px solid #e2e8f0;">${tx.categorie || '-'}</td>
            <td style="padding:10px; border-bottom:1px solid #e2e8f0;">${tx.description || ''}</td>
            <td style="padding:10px; border-bottom:1px solid #e2e8f0; color:#dc2626; font-weight:bold;">${estRecette ? '' : montant + ' €'}</td>
            <td style="padding:10px; border-bottom:1px solid #e2e8f0; color:#16a34a; font-weight:bold;">${estRecette ? montant + ' €' : ''}</td>
            <td style="padding:10px; border-bottom:1px solid #e2e8f0;">
                <button class="btn-edit" onclick="window.ouvrirModalModification('${tx.id}')">✏️</button>
                <button class="btn-delete" onclick="window.supprimerTransaction('${tx.id}')">🗑️</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
};

// ------------------------------------------
// 6. ONGLET : GRAND LIVRE (Comptes de tiers)
// ------------------------------------------
window.afficherGrandLivre = function(transactions) {
    let conteneur = document.getElementById('vue-grandlivre') || document.getElementById('grand-livre');
    if (!conteneur) return;

    const tablePlanComptable = {
        'urssaf': '438100 - URSSAF (Compte de Tiers)',
        'carpimko': '437100 - CARPIMKO (Compte de Tiers)',
        'cotisations carpimko': '437100 - CARPIMKO (Compte de Tiers)',
        'soins infirmiers': '706000 - Prestations de soins (Recettes)',
        'achats matériel': '606400 - Achats de petit matériel',
        'frais bancaires': '627000 - Services bancaires'
    };

    const groupes = {};

    transactions.forEach(tx => {
        let catBrute = tx.categorie || 'Non classé';
        const cleNormale = catBrute.toString().toLowerCase().trim();

        if (!groupes[cleNormale]) {
            groupes[cleNormale] = {
                titre: tablePlanComptable[cleNormale] || catBrute,
                items: []
            };
        }
        groupes[cleNormale].items.push(tx);
    });

    let htmlComplet = `<h2 style="margin-bottom:20px;">📖 Grand Livre des comptes</h2>`;

    Object.keys(groupes).sort().forEach(cle => {
        const groupe = groupes[cle];
        let total = 0;
        let lignesHtml = '';

        groupe.items.forEach(tx => {
            const estRecette = (tx.type || '').toLowerCase() === 'recette';
            const montantNum = parseFloat(tx.montant || 0);

            if (estRecette) total += Math.abs(montantNum);
            else total -= Math.abs(montantNum);

            lignesHtml += `
                <tr style="border-bottom:1px solid #f1f5f9;">
                    <td style="padding:10px;">${tx.date || ''}</td>
                    <td style="padding:10px;">${tx.description || ''}</td>
                    <td style="padding:10px; color:${estRecette ? '#16a34a' : '#dc2626'}; font-weight:bold;">
                        ${estRecette ? '+' : '-'} ${Math.abs(montantNum).toFixed(2)} €
                    </td>
                    <td style="padding:10px;">
                        <button class="btn-edit" onclick="window.ouvrirModalModification('${tx.id}')">✏️</button>
                        <button class="btn-delete" onclick="window.supprimerTransaction('${tx.id}')">🗑️</button>
                    </td>
                </tr>
            `;
        });

        htmlComplet += `
            <div style="margin-bottom:25px; background:#fff; border:1px solid #cbd5e1; border-radius:8px; overflow:hidden;">
                <div style="background:#f1f5f9; padding:12px 16px; border-bottom:1px solid #cbd5e1; display:flex; justify-content:space-between;">
                    <h3 style="margin:0; font-size:1.05rem;">📂 Compte ${groupe.titre}</h3>
                    <span style="font-weight:bold; color:${total >= 0 ? '#16a34a' : '#dc2626'};">Solde : ${total.toFixed(2)} €</span>
                </div>
                <table style="width:100%; border-collapse:collapse; text-align:left;">
                    <thead>
                        <tr style="background:#f8fafc; font-size:0.85rem; color:#475569;">
                            <th style="padding:10px;">Date</th>
                            <th style="padding:10px;">Description</th>
                            <th style="padding:10px;">Montant</th>
                            <th style="padding:10px;">Actions</th>
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
// 7. FONCTIONS DE MODALE & ACTIONS
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

    try {
        const { error } = await window.supabaseClient
            .from('transactions')
            .insert([{ date, type, categorie, description, montant: montantFinal }]);

        if (error) throw error;

        const form = document.getElementById('form-ajouter-transaction');
        if (form) form.reset();

        await window.chargerTransactions();
    } catch (err) {
        console.error("Erreur d'ajout :", err.message);
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

// ------------------------------------------
// 8. INITIALISATION
// ------------------------------------------
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(function() {
        if (window.supabaseClient) {
            window.chargerTransactions();
        }
        // Activation du remplissage automatique intelligent
        window.appliquerAutomatisation('tx-description', 'tx-type', 'tx-categorie');
        window.appliquerAutomatisation('pay-description', 'pay-type', 'pay-categorie');
    }, 300);
});
