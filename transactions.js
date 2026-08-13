// ==========================================
// GESTION COMPTA : TRANSACTIONS, JOURNAL & GRAND LIVRE
// ==========================================

window.listeTransactions = [];

// Schéma de correspondance dynamique
window.schemaColonnes = {
    date: 'date',
    type: 'type',
    categorie: 'categorie',
    description: 'description',
    montant: 'montant'
};

/**
 * Détecte les nom de colonnes utilisés dans la table Supabase
 */
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
// 1. CHARGEMENT DES DONNÉES
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

        // Mise à jour globale des 3 onglets
        window.rafraichirToutesLesVues();

    } catch (err) {
        console.error("Erreur lors du chargement des transactions :", err.message);
    }
};

window.rafraichirToutesLesVues = function() {
    window.afficherTransactions(window.listeTransactions);
    window.afficherJournal(window.listeTransactions);
    window.afficherGrandLivre(window.listeTransactions);
};

// ------------------------------------------
// 2. VUE TRANSACTIONS (ACCUEIL)
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
// 3. VUE JOURNAL (AUTO-CONSTRUCTION)
// ------------------------------------------
window.afficherJournal = function(transactions) {
    // 1. Recherche du conteneur parent du Journal
    let conteneur = document.getElementById('journal') || 
                    document.getElementById('section-journal') || 
                    document.getElementById('tab-journal') ||
                    document.querySelector('[data-tab="journal"]');

    // Recherche alternative : élément contenant le texte d'attente
    if (!conteneur) {
        const tousLesTitres = document.querySelectorAll('h2, h3');
        tousLesTitres.forEach(el => {
            if (el.textContent.includes('Journal')) conteneur = el.parentElement;
        });
    }

    if (!conteneur) return;

    // 2. Injection du squelette du tableau si absent
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
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:#94a3b8; padding:20px;">Le journal est vide.</td></tr>`;
        return;
    }

    // Ordre chronologique
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
        `;
        tbody.appendChild(tr);
    });
};

// ------------------------------------------
// 4. VUE GRAND LIVRE (AUTO-CONSTRUCTION)
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

    // Regroupement par catégorie
    const groupes = {};
    transactions.forEach(tx => {
        const cat = tx[window.schemaColonnes.categorie] || tx.categorie || tx.category || 'Non classé';
        if (!groupes[cat]) groupes[cat] = [];
        groupes[cat].push(tx);
    });

    let htmlComplet = `<h2 style="color:#1e293b; margin-bottom:15px;">Grand Livre des comptes</h2>`;

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
                <tr style="border-bottom:1px solid #f1f5f9;">
                    <td style="padding:8px 12px;">${tx[window.schemaColonnes.date] || tx.date || ''}</td>
                    <td style="padding:8px 12px;">${tx[window.schemaColonnes.description] || tx.description || ''}</td>
                    <td style="padding:8px 12px; color:${estRecette ? '#16a34a' : '#dc2626'}; font-weight:bold;">
                        ${estRecette ? '+' : '-'} ${Math.abs(montantNum).toFixed(2)} €
                    </td>
                </tr>
            `;
        });

        const couleurTotal = totalCategorie >= 0 ? '#16a34a' : '#dc2626';

        htmlComplet += `
            <div style="margin-bottom:20px; background:#fff; border:1px solid #e2e8f0; border-radius:8px; overflow:hidden;">
                <div style="background:#f8fafc; padding:12px 16px; border-bottom:1px solid #e2e8f0; display:flex; justify-content:space-between; align-items:center;">
                    <h3 style="margin:0; font-size:1.05rem; color:#1e293b;">📂 ${cat}</h3>
                    <span style="font-weight:bold; color:${couleurTotal};">Solde : ${totalCategorie.toFixed(2)} €</span>
                </div>
                <table style="width:100%; border-collapse:collapse; text-align:left;">
                    <thead>
                        <tr style="background:#f1f5f9; font-size:0.85rem; color:#64748b;">
                            <th style="padding:8px 12px;">Date</th>
                            <th style="padding:8px 12px;">Description</th>
                            <th style="padding:8px 12px;">Montant</th>
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
// 5. GESTION DES CLICS SUR LES ONGLETS
// ------------------------------------------
document.addEventListener('click', function(e) {
    const cible = e.target.closest('button, a, .nav-link, .tab-btn');
    if (cible) {
        setTimeout(function() {
            window.rafraichirToutesLesVues();
        }, 100);
    }
});

// Initialisation au chargement de la page
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(function() {
        if (window.supabaseClient) {
            window.chargerTransactions();
        }
    }, 300);
});
