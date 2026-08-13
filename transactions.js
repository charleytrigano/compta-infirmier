// ==========================================
// COMPTABILITÉ LIBÉRALE - RÈGLEMENTS MANUELS
// Validation explicite des encaissements / décaissements
// ==========================================

window.listeTransactions = [];

// ------------------------------------------
// FONCTIONS UTILITAIRES DE LECTURE
// ------------------------------------------
function ObtenirValeurChamp(obj, motsCles, valeurParDefaut = '') {
    if (!obj) return valeurParDefaut;
    const clesObj = Object.keys(obj);
    for (let mot of motsCles) {
        const cleTrouvee = clesObj.find(k => k.toLowerCase() === mot.toLowerCase());
        if (cleTrouvee && obj[cleTrouvee] !== null && obj[cleTrouvee] !== undefined && obj[cleTrouvee] !== '') {
            return obj[cleTrouvee];
        }
    }
    return valeurParDefaut;
}

function ExtraireMontantNumerique(tx) {
    let val = ObtenirValeurChamp(tx, ['montant', 'amount', 'valeur', 'price', 'credit', 'debit', 'total'], 0);
    if (typeof val === 'string') {
        val = val.replace(',', '.').replace(/[^0-9.-]/g, '');
    }
    return parseFloat(val) || 0;
}

function ExtraireCategorie(tx) {
    return ObtenirValeurChamp(tx, ['categorie', 'category', 'cat', 'label'], 'Général');
}

function ExtraireDescription(tx) {
    return ObtenirValeurChamp(tx, ['description', 'libelle', 'nom', 'tiers'], '-');
}

function ExtraireType(tx) {
    let t = ObtenirValeurChamp(tx, ['type', 'sens', 'nature'], '').toString().toLowerCase();
    let m = ExtraireMontantNumerique(tx);
    if (t.includes('recette') || t.includes('credit') || t.includes('encaissement')) return 'recette';
    if (t.includes('depense') || t.includes('dépense') || t.includes('debit') || t.includes('decaissement')) return 'depense';
    return m >= 0 ? 'recette' : 'depense';
}

function ExtraireStatut(tx) {
    return ObtenirValeurChamp(tx, ['statut', 'status', 'etat'], 'en_attente').toLowerCase();
}

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
// 2. ACTION : VALIDER UN ENCAISSEMENT OU PAIEMENT
// ------------------------------------------
window.validerReglement = async function(idTx, typeTx) {
    const nouveauStatut = typeTx === 'recette' ? 'encaisse' : 'paye';

    try {
        const { error } = await window.supabaseClient
            .from('transactions')
            .update({ statut: nouveauStatut })
            .eq('id', idTx);

        if (error) throw error;

        await window.chargerTransactions();
    } catch (err) {
        console.error("Erreur de mise à jour du règlement :", err.message);
        alert("Impossible de valider le règlement. Vérifiez votre base Supabase.");
    }
};

window.annulerReglement = async function(idTx) {
    try {
        const { error } = await window.supabaseClient
            .from('transactions')
            .update({ statut: 'en_attente' })
            .eq('id', idTx);

        if (error) throw error;

        await window.chargerTransactions();
    } catch (err) {
        console.error("Erreur d'annulation :", err.message);
    }
};

// ------------------------------------------
// 3. ONGLET : TRANSACTIONS (AVEC BOUTONS)
// ------------------------------------------
window.afficherTransactions = function(transactions) {
    const tbody = document.getElementById('body-tableau-transactions');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (transactions.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:#94a3b8; padding:20px;">Aucune transaction enregistrée.</td></tr>`;
        return;
    }

    transactions.forEach(tx => {
        const typeBrut = ExtraireType(tx);
        const estRecette = typeBrut === 'recette';
        const montantNum = Math.abs(ExtraireMontantNumerique(tx));
        const statut = ExtraireStatut(tx);
        const estRegle = statut === 'encaisse' || statut === 'paye';

        let boutonAction = '';
        if (estRegle) {
            boutonAction = `<span style="color:#16a34a; font-weight:bold; font-size:0.85rem;">✅ ${estRecette ? 'Encaissé' : 'Payé'}</span>
                            <button style="margin-left:5px; background:none; border:none; cursor:pointer; font-size:0.8rem;" onclick="window.annulerReglement('${tx.id}')" title="Annuler le règlement">↩️</button>`;
        } else {
            boutonAction = estRecette 
                ? `<button style="background:#16a34a; color:white; border:none; padding:5px 10px; border-radius:4px; cursor:pointer; font-weight:bold;" onclick="window.validerReglement('${tx.id}', 'recette')">💰 Encaisser</button>`
                : `<button style="background:#dc2626; color:white; border:none; padding:5px 10px; border-radius:4px; cursor:pointer; font-weight:bold;" onclick="window.validerReglement('${tx.id}', 'depense')">💳 Payer</button>`;
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${tx.date || ''}</td>
            <td><strong>${estRecette ? 'Recette' : 'Dépense'}</strong></td>
            <td>${ExtraireCategorie(tx)}</td>
            <td>${ExtraireDescription(tx)}</td>
            <td style="font-weight: bold; color: ${estRecette ? '#16a34a' : '#dc2626'};">
                ${estRecette ? '+' : '-'} ${montantNum.toFixed(2)} €
            </td>
            <td>${boutonAction}</td>
            <td>
                <button class="btn-delete" onclick="window.supprimerTransaction('${tx.id}')">🗑️</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
};

// ------------------------------------------
// 4. ONGLET : JOURNAL DE BANQUE (UNIQUEMENT RÉGLÉS)
// ------------------------------------------
window.afficherBanque = function(transactions) {
    const tbody = document.getElementById('body-tableau-banque');
    const elSolde = document.getElementById('solde-banque');
    let totalBanque = 0;

    if (tbody) tbody.innerHTML = '';

    // Filtrage : On ne garde QUE les transactions encaissées ou payées par l'utilisateur
    const transactionsValidees = transactions.filter(tx => {
        const st = ExtraireStatut(tx);
        return st === 'encaisse' || st === 'paye';
    });

    transactionsValidees.forEach(tx => {
        const estRecette = ExtraireType(tx) === 'recette';
        const montantNum = Math.abs(ExtraireMontantNumerique(tx));

        if (estRecette) totalBanque += montantNum;
        else totalBanque -= montantNum;

        if (tbody) {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${tx.date || ''}</td>
                <td><strong>${estRecette ? 'Encaissement' : 'Décaissement'}</strong></td>
                <td>${ExtraireCategorie(tx)}</td>
                <td>${ExtraireDescription(tx)}</td>
                <td style="color:#dc2626; font-weight:bold;">${estRecette ? '' : '- ' + montantNum.toFixed(2) + ' €'}</td>
                <td style="color:#16a34a; font-weight:bold;">${estRecette ? '+ ' + montantNum.toFixed(2) + ' €' : ''}</td>
                <td>
                    <button style="background:none; border:none; cursor:pointer;" onclick="window.annulerReglement('${tx.id}')" title="Annuler le règlement">↩️ Annuler</button>
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
                        <th style="padding:10px;">Statut</th>
                    </tr>
                </thead>
                <tbody id="body-tableau-journal"></tbody>
            </table>
        `;
        tbody = document.getElementById('body-tableau-journal');
    }

    tbody.innerHTML = '';

    transactions.forEach(tx => {
        const estRecette = ExtraireType(tx) === 'recette';
        const montant = Math.abs(ExtraireMontantNumerique(tx)).toFixed(2);
        const statut = ExtraireStatut(tx);

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="padding:10px; border-bottom:1px solid #e2e8f0;">${tx.date || ''}</td>
            <td style="padding:10px; border-bottom:1px solid #e2e8f0;">${ExtraireCategorie(tx)}</td>
            <td style="padding:10px; border-bottom:1px solid #e2e8f0;">${ExtraireDescription(tx)}</td>
            <td style="padding:10px; border-bottom:1px solid #e2e8f0; color:#dc2626; font-weight:bold;">${estRecette ? '' : montant + ' €'}</td>
            <td style="padding:10px; border-bottom:1px solid #e2e8f0; color:#16a34a; font-weight:bold;">${estRecette ? montant + ' €' : ''}</td>
            <td style="padding:10px; border-bottom:1px solid #e2e8f0;">
                ${statut === 'encaisse' || statut === 'paye' ? '✅ Réglé' : '⏳ En attente'}
            </td>
        `;
        tbody.appendChild(tr);
    });
};

// ------------------------------------------
// 6. ONGLET : GRAND LIVRE
// ------------------------------------------
window.afficherGrandLivre = function(transactions) {
    let conteneur = document.getElementById('vue-grandlivre') || document.getElementById('grand-livre');
    if (!conteneur) return;

    const groupes = {};

    transactions.forEach(tx => {
        let catBrute = ExtraireCategorie(tx);
        const cleNormale = catBrute.toString().toLowerCase().trim();

        if (!groupes[cleNormale]) {
            groupes[cleNormale] = { titre: catBrute, items: [] };
        }
        groupes[cleNormale].items.push(tx);
    });

    let htmlComplet = `<h2 style="margin-bottom:20px;">📖 Grand Livre des comptes</h2>`;

    Object.keys(groupes).sort().forEach(cle => {
        const groupe = groupes[cle];
        let total = 0;
        let lignesHtml = '';

        groupe.items.forEach(tx => {
            const estRecette = ExtraireType(tx) === 'recette';
            const montantNum = Math.abs(ExtraireMontantNumerique(tx));

            if (estRecette) total += montantNum;
            else total -= montantNum;

            lignesHtml += `
                <tr style="border-bottom:1px solid #f1f5f9;">
                    <td style="padding:10px;">${tx.date || ''}</td>
                    <td style="padding:10px;">${ExtraireDescription(tx)}</td>
                    <td style="padding:10px; color:${estRecette ? '#16a34a' : '#dc2626'}; font-weight:bold;">
                        ${estRecette ? '+' : '-'} ${montantNum.toFixed(2)} €
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
// 7. INITIALISATION
// ------------------------------------------
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(function() {
        if (window.supabaseClient) {
            window.chargerTransactions();
        }
    }, 300);
});
