// ==========================================
// COMPTABILITÉ LIBÉRALE - SCRIPT PRINCIPAL
// Grand Livre aux normes du Plan Comptable Général (PCG)
// ==========================================

window.listeTransactions = [];

// Table de correspondance des catégories vers la numérotation PCG
const MAPPING_PCG = {
    "soins infirmiers": { code: "706000", nom: "706000 - Prestations de services / Honoraires (Classe 7)" },
    "cotisations carpimko": { code: "645200", nom: "645200 - Cotisations CARPIMKO (Classe 6)" },
    "urssaf": { code: "645100", nom: "645100 - Cotisations URSSAF (Classe 6)" },
    "assurances & rcp": { code: "616000", nom: "616000 - Primes d'assurances (Classe 6)" },
    "frais de déplacement / carburant": { code: "625100", nom: "625100 - Voyages et déplacements (Classe 6)" },
    "petit matériel médical": { code: "606300", nom: "606300 - Fournitures d'entretien et petit équipement (Classe 6)" },
    "frais de comptabilité & logiciels": { code: "622600", nom: "622600 - Honoraires comptables & Logiciels (Classe 6)" },
    "loyer & charges locatives": { code: "613200", nom: "613200 - Locations immobilières (Classe 6)" },
    "frais bancaires": { code: "627000", nom: "627000 - Services bancaires (Classe 6)" }
};

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
        console.error("Erreur de validation du règlement :", err.message);
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
        console.error("Erreur d'annulation du règlement :", err.message);
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
// 4. ONGLET : JOURNAL DE BANQUE
// ------------------------------------------
window.afficherBanque = function(transactions) {
    const tbody = document.getElementById('body-tableau-banque');
    const elSolde = document.getElementById('solde-banque');
    let totalBanque = 0;

    if (!tbody) return;
    tbody.innerHTML = '';

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
// 6. ONGLET : GRAND LIVRE NORME PCG (CLASSES 4, 5, 6, 7)
// ------------------------------------------
window.afficherGrandLivre = function(transactions) {
    let conteneur = document.getElementById('vue-grandlivre') || document.getElementById('grand-livre');
    if (!conteneur) return;

    const comptes = {};

    // A. Initialiser le compte 512000 (Banque)
    comptes["512000"] = { nom: "512000 - Banque (Classe 5)", items: [] };

    // B. Classer chaque écriture dans son compte de Charges/Produits ET dans le compte 512 (Banque)
    transactions.forEach(tx => {
        let catBrute = ExtraireCategorie(tx);
        let cleNorme = catBrute.toLowerCase();
        
        let pcgInfo = MAPPING_PCG[cleNorme] || { 
            code: "471000", 
            nom: `471000 - ${catBrute} (Compte d'attente / Tiers)` 
        };

        let codeCompte = pcgInfo.code;

        if (!comptes[codeCompte]) {
            comptes[codeCompte] = { nom: pcgInfo.nom, items: [] };
        }

        // Ajout dans le compte de nature (6, 7 ou 4)
        comptes[codeCompte].items.push(tx);

        // Ajout automatique dans le compte 512000 (Banque)
        comptes["512000"].items.push(tx);
    });

    let htmlComplet = `<h2 style="margin-bottom:20px;">📖 Grand Livre des Comptes (Norme PCG)</h2>`;

    // C. Affichage trié par numéro de compte
    Object.keys(comptes).sort().forEach(codeCompte => {
        const compte = comptes[codeCompte];
        let totalDebit = 0;
        let totalCredit = 0;
        let lignesHtml = '';

        compte.items.forEach(tx => {
            const estRecette = ExtraireType(tx) === 'recette';
            const montantNum = Math.abs(ExtraireMontant(tx));

            let debit = 0;
            let credit = 0;

            // Règles de comptabilité en partie double
            if (codeCompte === "512000") {
                // Pour la Banque : Recette = Débit (+), Dépense = Crédit (-)
                if (estRecette) debit = montantNum;
                else credit = montantNum;
            } else if (codeCompte.startsWith('7')) {
                // Compte de Produit : Recette = Crédit
                credit = montantNum;
            } else {
                // Compte de Charge / Tiers : Dépense = Débit
                debit = montantNum;
            }

            totalDebit += debit;
            totalCredit += credit;

            lignesHtml += `
                <tr style="border-bottom:1px solid #f1f5f9;">
                    <td style="padding:8px 10px;">${tx.date || ''}</td>
                    <td style="padding:8px 10px;">${ExtraireDescription(tx)}</td>
                    <td style="padding:8px 10px; color:#dc2626; font-weight:bold; text-align:right;">${debit > 0 ? debit.toFixed(2) + ' €' : ''}</td>
                    <td style="padding:8px 10px; color:#16a34a; font-weight:bold; text-align:right;">${credit > 0 ? credit.toFixed(2) + ' €' : ''}</td>
                </tr>
            `;
        });

        let solde = totalDebit - totalCredit;
        let libelleSolde = codeCompte.startsWith('7') || (codeCompte === "512000" && solde < 0)
            ? `Solde Créditeur : ${Math.abs(solde).toFixed(2)} €`
            : `Solde Débiteurs : ${Math.abs(solde).toFixed(2)} €`;

        htmlComplet += `
            <div style="margin-bottom:20px; background:#fff; border:1px solid #cbd5e1; border-radius:8px; overflow:hidden;">
                <div style="background:#f1f5f9; padding:10px 16px; border-bottom:1px solid #cbd5e1; display:flex; justify-content:space-between; align-items:center;">
                    <h3 style="margin:0; font-size:1rem; color:#1e293b;">📂 ${compte.nom}</h3>
                    <span style="font-weight:bold; color:#0f172a;">${libelleSolde}</span>
                </div>
                <table style="width:100%; border-collapse:collapse; text-align:left;">
                    <thead>
                        <tr style="background:#f8fafc; font-size:0.85rem; color:#475569;">
                            <th style="padding:8px 10px;">Date</th>
                            <th style="padding:8px 10px;">Description</th>
                            <th style="padding:8px 10px; text-align:right; color:#dc2626;">Débit</th>
                            <th style="padding:8px 10px; text-align:right; color:#16a34a;">Crédit</th>
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
