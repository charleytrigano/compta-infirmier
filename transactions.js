// ==========================================
// COMPTABILITÉ LIBÉRALE - SCRIPT PRINCIPAL
// Alignement complet Supabase & Grand Livre
// ==========================================

window.listeTransactions = [];

// ------------------------------------------
// FONCTIONS UTILITAIRES DE LECTURE
// ------------------------------------------
function ExtraireMontant(tx) {
    let m = tx.amount;
    if (m === null || m === undefined) return 0;
    if (typeof m === 'string') {
        m = m.replace(',', '.').replace(/[^0-9.-]/g, '');
    }
    return parseFloat(m) || 0;
}

function ExtraireCategorie(tx) {
    let cat = tx.category || tx.categorie || 'Général';
    return cat.trim(); // Supprime les espaces invisibles au début et à la fin
}

function ExtraireDescription(tx) {
    let desc = tx.description || tx.libelle || '-';
    return desc.trim();
}

function ExtraireType(tx) {
    let t = (tx.type || '').toString().toLowerCase().trim();
    if (t === 'recette' || t === 'credit') return 'recette';
    if (t === 'depense' || t === 'dépense' || t === 'debit') return 'depense';
    
    // Déduction automatique si le type n'est pas renseigné dans Supabase
    let cat = ExtraireCategorie(tx).toLowerCase();
    if (cat.includes('urssaf') || cat.includes('carpimko') || cat.includes('frais') || cat.includes('achat')) {
        return 'depense';
    }
    
    let m = ExtraireMontant(tx);
    return m < 0 ? 'depense' : 'recette';
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
// 2. ACTIONS SUR LE STATUT ENCAISSÉ (SUPABASE)
// ------------------------------------------
window.validerReglement = async function(idTx) {
    try {
        const { error } = await window.supabaseClient
            .from('transactions')
            .update({ encaisse: true })
            .eq('id', idTx);

        if (error) throw error;

        await window.chargerTransactions();
    } catch (err) {
        console.error("Erreur lors de la validation du règlement :", err.message);
        alert("Erreur de mise à jour Supabase : " + err.message);
    }
};

window.annulerReglement = async function(idTx) {
    try {
        const { error } = await window.supabaseClient
            .from('transactions')
            .update({ encaisse: false })
            .eq('id', idTx);

        if (error) throw error;

        await window.chargerTransactions();
    } catch (err) {
        console.error("Erreur lors de l'annulation du règlement :", err.message);
    }
};

// ------------------------------------------
// 3. ONGLET : TRANSACTIONS
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
        const montantNum = Math.abs(ExtraireMontant(tx));
        const estEncaisse = tx.encaisse === true;

        let boutonAction = '';
        if (estEncaisse) {
            boutonAction = `<span style="color:#16a34a; font-weight:bold; font-size:0.85rem;">✅ ${estRecette ? 'Encaissé' : 'Payé'}</span>
                            <button style="margin-left:5px; background:none; border:none; cursor:pointer; font-size:0.8rem;" onclick="window.annulerReglement('${tx.id}')" title="Annuler le règlement">↩️</button>`;
        } else {
            boutonAction = estRecette 
                ? `<button style="background:#16a34a; color:white; border:none; padding:6px 12px; border-radius:4px; cursor:pointer; font-weight:bold;" onclick="window.validerReglement('${tx.id}')">💰 Encaisser</button>`
                : `<button style="background:#dc2626; color:white; border:none; padding:6px 12px; border-radius:4px; cursor:pointer; font-weight:bold;" onclick="window.validerReglement('${tx.id}')">💳 Payer</button>`;
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
// 4. ONGLET : JOURNAL DE BANQUE (UNIQUEMENT ENCAISSÉS)
// ------------------------------------------
window.afficherBanque = function(transactions) {
    const tbody = document.getElementById('body-tableau-banque');
    const elSolde = document.getElementById('solde-banque');
    let totalBanque = 0;

    if (tbody) tbody.innerHTML = '';

    const transactionsEncaissees = transactions.filter(tx => tx.encaisse === true);

    transactionsEncaissees.forEach(tx => {
        const estRecette = ExtraireType(tx) === 'recette';
        const montantNum = Math.abs(ExtraireMontant(tx));

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
                    <button style="background:none; border:none; cursor:pointer; color:#64748b;" onclick="window.annulerReglement('${tx.id}')" title="Annuler le règlement">↩️ Annuler</button>
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
                        <th style="padding:10px;">Statut Règlement</th>
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
        const montant = Math.abs(ExtraireMontant(tx)).toFixed(2);
        const estEncaisse = tx.encaisse === true;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="padding:10px; border-bottom:1px solid #e2e8f0;">${tx.date || ''}</td>
            <td style="padding:10px; border-bottom:1px solid #e2e8f0;">${ExtraireCategorie(tx)}</td>
            <td style="padding:10px; border-bottom:1px solid #e2e8f0;">${ExtraireDescription(tx)}</td>
            <td style="padding:10px; border-bottom:1px solid #e2e8f0; color:#dc2626; font-weight:bold;">${estRecette ? '' : montant + ' €'}</td>
            <td style="padding:10px; border-bottom:1px solid #e2e8f0; color:#16a34a; font-weight:bold;">${estRecette ? montant + ' €' : ''}</td>
            <td style="padding:10px; border-bottom:1px solid #e2e8f0;">
                ${estEncaisse ? '✅ Réglé' : '⏳ En attente'}
            </td>
        `;
        tbody.appendChild(tr);
    });
};

// ------------------------------------------
// 6. ONGLET : GRAND LIVRE (TOUS LES COMPTES)
// ------------------------------------------
window.afficherGrandLivre = function(transactions) {
    let conteneur = document.getElementById('vue-grandlivre') || document.getElementById('grand-livre');
    if (!conteneur) return;

    const groupes = {};

    // 1. Regroupement par catégorie nettoyée
    transactions.forEach(tx => {
        let catPropre = ExtraireCategorie(tx);
        const cle = catPropre.toLowerCase();

        if (!groupes[cle]) {
            groupes[cle] = { titre: catPropre, items: [] };
        }
        groupes[cle].items.push(tx);
    });

    if (Object.keys(groupes).length === 0) {
        conteneur.innerHTML = `<h2>📖 Grand Livre des comptes</h2><p style="color:#64748b; margin-top:15px;">Aucune donnée enregistrée.</p>`;
        return;
    }

    let htmlComplet = `<h2 style="margin-bottom:20px;">📖 Grand Livre des comptes</h2>`;

    // 2. Génération de la vue pour chaque compte d'imputation
    Object.keys(groupes).sort().forEach(cle => {
        const groupe = groupes[cle];
        let totalRecettes = 0;
        let totalDepenses = 0;
        let lignesHtml = '';

        groupe.items.forEach(tx => {
            const estRecette = ExtraireType(tx) === 'recette';
            const montantNum = Math.abs(ExtraireMontant(tx));

            if (estRecette) totalRecettes += montantNum;
            else totalDepenses += montantNum;

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

        const soldeGlobal = totalRecettes - totalDepenses;

        htmlComplet += `
            <div style="margin-bottom:25px; background:#fff; border:1px solid #cbd5e1; border-radius:8px; overflow:hidden;">
                <div style="background:#f1f5f9; padding:12px 16px; border-bottom:1px solid #cbd5e1; display:flex; justify-content:space-between; align-items:center;">
                    <h3 style="margin:0; font-size:1.05rem; color:#1e293b;">📂 Compte : ${groupe.titre}</h3>
                    <span style="font-weight:bold; color:${soldeGlobal >= 0 ? '#16a34a' : '#dc2626'};">
                        Solde : ${soldeGlobal >= 0 ? '+' : ''}${soldeGlobal.toFixed(2)} €
                    </span>
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
// 7. INITIALISATION DU SCRIPT
// ------------------------------------------
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(function() {
        if (window.supabaseClient) {
            window.chargerTransactions();
        }
    }, 300);
});
