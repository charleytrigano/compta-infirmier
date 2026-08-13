// ==========================================
// COMPTABILITÉ LIBÉRALE - SCRIPT PRINCIPAL
// Gestion du Journal de Banque et Grand Livre Complet
// ==========================================

window.listeTransactions = [];

// Liste de référence du Plan Comptable (pour afficher tous les comptes dans le Grand Livre)
const PLAN_COMPTABLE_REFERENCE = [
    "Soins infirmiers",
    "Cotisations CARPIMKO",
    "URSSAF",
    "Assurances & RCP",
    "Frais de déplacement / Carburant",
    "Petit matériel médical",
    "Frais de comptabilité & Logiciels",
    "Loyer & Charges locatives",
    "Frais bancaires",
    "Divers / Général"
];

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
    let cat = tx.category || tx.categorie || 'Divers / Général';
    return cat.trim();
}

function ExtraireDescription(tx) {
    let desc = tx.description || tx.libelle || '-';
    return desc.trim();
}

function ExtraireType(tx) {
    let t = (tx.type || '').toString().toLowerCase().trim();
    if (t === 'recette' || t === 'credit') return 'recette';
    if (t === 'depense' || t === 'dépense' || t === 'debit') return 'depense';
    
    let cat = ExtraireCategorie(tx).toLowerCase();
    if (cat.includes('urssaf') || cat.includes('carpimko') || cat.includes('frais') || cat.includes('achat') || cat.includes('assurance')) {
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
// 2. ACTIONS SUR LE STATUT ENCAISSÉ
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
        const estRecette = ExtraireType(tx) === 'recette';
        const montantNum = Math.abs(ExtraireMontant(tx));
        const estEncaisse = tx.encaisse === true;

        let boutonAction = estEncaisse
            ? `<span style="color:#16a34a; font-weight:bold;">✅ ${estRecette ? 'Encaissé' : 'Payé'}</span>
               <button style="margin-left:5px; background:none; border:none; cursor:pointer;" onclick="window.annulerReglement('${tx.id}')" title="Annuler">↩️</button>`
            : `<button style="background:${estRecette ? '#16a34a' : '#dc2626'}; color:white; border:none; padding:6px 12px; border-radius:4px; cursor:pointer; font-weight:bold;" onclick="window.validerReglement('${tx.id}')">
                ${estRecette ? '💰 Encaisser' : '💳 Payer'}
               </button>`;

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
// 4. ONGLET : JOURNAL DE BANQUE (AMÉLIORÉ)
// ------------------------------------------
window.afficherBanque = function(transactions) {
    const tbody = document.getElementById('body-tableau-banque');
    const elSolde = document.getElementById('solde-banque');
    let totalBanque = 0;

    if (!tbody) return;
    tbody.innerHTML = '';

    // Si aucune écriture n'est marquée comme encaissée, on affiche tout par défaut
    const aDesEncaissements = transactions.some(tx => tx.encaisse === true);
    const listeAffichée = aDesEncaissements 
        ? transactions.filter(tx => tx.encaisse === true)
        : transactions;

    if (listeAffichée.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:#94a3b8; padding:20px;">Aucune opération bancaire.</td></tr>`;
        return;
    }

    listeAffichée.forEach(tx => {
        const estRecette = ExtraireType(tx) === 'recette';
        const montantNum = Math.abs(ExtraireMontant(tx));
        const estEncaisse = tx.encaisse === true;

        if (estEncaisse || !aDesEncaissements) {
            if (estRecette) totalBanque += montantNum;
            else totalBanque -= montantNum;
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${tx.date || ''}</td>
            <td><strong>${estRecette ? 'Encaissement' : 'Décaissement'}</strong></td>
            <td>${ExtraireCategorie(tx)}</td>
            <td>${ExtraireDescription(tx)}</td>
            <td style="color:#dc2626; font-weight:bold;">${estRecette ? '' : '- ' + montantNum.toFixed(2) + ' €'}</td>
            <td style="color:#16a34a; font-weight:bold;">${estRecette ? '+ ' + montantNum.toFixed(2) + ' €' : ''}</td>
            <td>
                ${estEncaisse 
                    ? `<button style="background:none; border:none; cursor:pointer; color:#64748b;" onclick="window.annulerReglement('${tx.id}')">↩️ Annuler</button>`
                    : `<button style="background:#2563eb; color:white; border:none; padding:4px 8px; border-radius:4px; cursor:pointer;" onclick="window.validerReglement('${tx.id}')">Valider</button>`
                }
            </td>
        `;
        tbody.appendChild(tr);
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
// 6. ONGLET : GRAND LIVRE (COMPLET AVEC PLAN COMPTABLE)
// ------------------------------------------
window.afficherGrandLivre = function(transactions) {
    let conteneur = document.getElementById('vue-grandlivre') || document.getElementById('grand-livre');
    if (!conteneur) return;

    const groupes = {};

    // 1. Initialiser tous les comptes du Plan Comptable
    PLAN_COMPTABLE_REFERENCE.forEach(nomCompte => {
        groupes[nomCompte.toLowerCase()] = { titre: nomCompte, items: [] };
    });

    // 2. Classer les transactions dans les comptes correspondants
    transactions.forEach(tx => {
        let catPropre = ExtraireCategorie(tx);
        const cle = catPropre.toLowerCase();

        if (!groupes[cle]) {
            groupes[cle] = { titre: catPropre, items: [] };
        }
        groupes[cle].items.push(tx);
    });

    let htmlComplet = `<h2 style="margin-bottom:20px;">📖 Grand Livre des comptes</h2>`;

    // 3. Afficher chaque compte
    Object.keys(groupes).sort().forEach(cle => {
        const groupe = groupes[cle];
        let totalRecettes = 0;
        let totalDepenses = 0;
        let lignesHtml = '';

        if (groupe.items.length === 0) {
            lignesHtml = `<tr><td colspan="3" style="padding:10px; color:#94a3b8; font-style:italic;">Aucune écriture pour ce compte.</td></tr>`;
        } else {
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
        }

        const soldeGlobal = totalRecettes - totalDepenses;

        htmlComplet += `
            <div style="margin-bottom:20px; background:#fff; border:1px solid #cbd5e1; border-radius:8px; overflow:hidden;">
                <div style="background:#f1f5f9; padding:10px 16px; border-bottom:1px solid #cbd5e1; display:flex; justify-content:space-between; align-items:center;">
                    <h3 style="margin:0; font-size:1rem; color:#1e293b;">📂 Compte : ${groupe.titre}</h3>
                    <span style="font-weight:bold; color:${soldeGlobal >= 0 ? '#16a34a' : '#dc2626'};">
                        Solde : ${soldeGlobal >= 0 ? '+' : ''}${soldeGlobal.toFixed(2)} €
                    </span>
                </div>
                <table style="width:100%; border-collapse:collapse; text-align:left;">
                    <thead>
                        <tr style="background:#f8fafc; font-size:0.85rem; color:#475569;">
                            <th style="padding:8px 10px;">Date</th>
                            <th style="padding:8px 10px;">Description</th>
                            <th style="padding:8px 10px;">Montant</th>
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
