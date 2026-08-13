// ==========================================
// COMPTABILITÉ LIBÉRALE - SCRIPT PRINCIPAL
// Correction dynamique de la lecture du formulaire HTML
// ==========================================

window.listeTransactions = [];

// MAPPING PCG ENRICHI (Classes 4, 5, 6, 7)
const MAPPING_PCG = {
    "soins infirmiers": {
        activite: { code: "706000", nom: "706000 - Prestations de services / Honoraires (Classe 7)" },
        tiers: { code: "411000", nom: "411000 - Patients / Mutuelles (Classe 4 - Tiers)" }
    },
    "cotisations carpimko": {
        activite: { code: "645200", nom: "645200 - Cotisations CARPIMKO (Classe 6)" },
        tiers: { code: "437000", nom: "437000 - CARPIMKO (Classe 4 - Organismes Sociaux)" }
    },
    "urssaf": {
        activite: { code: "645100", nom: "645100 - Cotisations URSSAF (Classe 6)" },
        tiers: { code: "431000", nom: "431000 - URSSAF (Classe 4 - Organismes Sociaux)" }
    },
    "assurances & rcp": {
        activite: { code: "616000", nom: "616000 - Primes d'assurances (Classe 6)" },
        tiers: { code: "401100", nom: "401100 - Assurances & Protection (Classe 4 - Tiers)" }
    },
    "frais de déplacement / carburant": {
        activite: { code: "625100", nom: "625100 - Voyages et déplacements (Classe 6)" },
        tiers: { code: "401200", nom: "401200 - Fournisseurs Carburant/Transports (Classe 4 - Tiers)" }
    },
    "petit matériel médical": {
        activite: { code: "606300", nom: "606300 - Petit équipement & fournitures (Classe 6)" },
        tiers: { code: "401300", nom: "401300 - Fournisseurs Matériel Médical (Classe 4 - Tiers)" }
    },
    "frais de comptabilité & logiciels": {
        activite: { code: "622600", nom: "622600 - Honoraires comptables & Logiciels (Classe 6)" },
        tiers: { code: "401400", nom: "401400 - Prestataires Informatique & Compta (Classe 4 - Tiers)" }
    },
    "loyer & charges locatives": {
        activite: { code: "613200", nom: "613200 - Locations immobilières (Classe 6)" },
        tiers: { code: "401500", nom: "401500 - Bailleurs & Immobilier (Classe 4 - Tiers)" }
    },
    "frais bancaires": {
        activite: { code: "627000", nom: "627000 - Services bancaires (Classe 6)" },
        tiers: { code: "401600", nom: "401600 - Etablissements Bancaires (Classe 4 - Tiers)" }
    }
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
    
    let m = ExtraireMontant(tx);
    if (m < 0) return 'depense';

    let cat = ExtraireCategorie(tx).toLowerCase();
    if (cat.includes('urssaf') || cat.includes('carpimko') || cat.includes('frais') || cat.includes('achat') || cat.includes('assurance')) {
        return 'depense';
    }
    
    return 'recette';
}

// ------------------------------------------
// 1. CHARGEMENT ET ENREGISTREMENT (SUPABASE)
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

// RECUPERATION ROBUSTE DU FORMULAIRE
window.ajouterTransaction = async function(event) {
    if (event) event.preventDefault();

    if (!window.supabaseClient) {
        alert("❌ Connexion à Supabase introuvable.");
        return;
    }

    // Recherche très flexible des éléments du formulaire
    const inputDate = document.getElementById('date') || 
                      document.querySelector('input[type="date"]') || 
                      document.querySelector('[name="date"]');

    const selectType = document.getElementById('type') || 
                       document.getElementById('type-operation') || 
                       document.querySelector('select[name="type"]') || 
                       document.querySelector('select');

    const selectCat = document.getElementById('categorie') || 
                      document.getElementById('category') || 
                      document.querySelector('[name="categorie"]') || 
                      document.querySelectorAll('select')[1];

    const inputDesc = document.getElementById('description') || 
                      document.querySelector('input[placeholder*="Acompte"]') || 
                      document.querySelector('[name="description"]');

    const inputMontant = document.getElementById('montant') || 
                        document.getElementById('amount') || 
                        document.querySelector('input[type="number"]') || 
                        document.querySelector('[name="montant"]');

    // Récupération des valeurs avec sécurité
    const dateVal = inputDate ? inputDate.value : '';
    const typeVal = selectType ? selectType.value : 'Dépense';
    const catVal = selectCat ? selectCat.value : 'Divers';
    const descVal = inputDesc ? inputDesc.value : '';
    
    let montant Brut = inputMontant ? inputMontant.value : '0';
    let montantVal = parseFloat(montantBrut.replace(',', '.')) || 0;

    if (!dateVal || isNaN(montantVal) || montantVal === 0) {
        alert("⚠️ Veuillez remplir au moins une date et un montant valide (non nul).");
        return;
    }

    // Préparation de l'enregistrement (On garde le nombre négatif ou positif saisi)
    const nouvelleEcriture = {
        date: dateVal,
        type: typeVal,
        category: catVal,
        description: descVal,
        amount: montantVal,
        encaisse: false
    };

    try {
        const { error } = await window.supabaseClient
            .from('transactions')
            .insert([nouvelleEcriture]);

        if (error) throw error;

        // Vider les champs texte après succès
        if (inputDesc) inputDesc.value = '';
        if (inputMontant) inputMontant.value = '';

        // Recharger les données
        await window.chargerTransactions();

    } catch (err) {
        console.error("Erreur lors de l'enregistrement :", err.message);
        alert("Erreur lors de l'enregistrement : " + err.message);
    }
};

window.rafraichirToutesLesVues = function() {
    window.afficherTransactions(window.listeTransactions);
    window.afficherBanque(window.listeTransactions);
    window.afficherJournal(window.listeTransactions);
    window.afficherGrandLivre(window.listeTransactions);
};

// ------------------------------------------
// 2. ACTIONS : ENCAISSÉ / PAYÉ & SUPPRESSION
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

window.supprimerTransaction = async function(idTx) {
    const confirmation = confirm("Voulez-vous vraiment supprimer cette transaction ?");
    if (!confirmation) return;

    try {
        const { error } = await window.supabaseClient
            .from('transactions')
            .delete()
            .eq('id', idTx);

        if (error) throw error;

        await window.chargerTransactions();
    } catch (err) {
        console.error("Erreur lors de la suppression :", err.message);
        alert("Erreur de suppression : " + err.message);
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
                <button style="background:none; border:none; cursor:pointer; font-size:1.1rem;" onclick="window.supprimerTransaction('${tx.id}')" title="Supprimer">🗑️</button>
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
        const montantAbsolu = Math.abs(ExtraireMontant(tx));
        const estEncaisse = tx.encaisse === true;

        if (estEncaisse || !aDesEncaissements) {
            if (estRecette) {
                totalBanque += montantAbsolu;
            } else {
                totalBanque -= montantAbsolu;
            }
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${tx.date || ''}</td>
            <td><strong>${estRecette ? 'Encaissement' : 'Décaissement'}</strong></td>
            <td>${ExtraireCategorie(tx)}</td>
            <td>${ExtraireDescription(tx)}</td>
            <td style="color:#dc2626; font-weight:bold;">${estRecette ? '' : '- ' + montantAbsolu.toFixed(2) + ' €'}</td>
            <td style="color:#16a34a; font-weight:bold;">${estRecette ? '+ ' + montantAbsolu.toFixed(2) + ' €' : ''}</td>
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
// 6. ONGLET : GRAND LIVRE (COMPTES 4, 5, 6, 7)
// ------------------------------------------
window.afficherGrandLivre = function(transactions) {
    let conteneur = document.getElementById('vue-grandlivre') || document.getElementById('grand-livre');
    if (!conteneur) return;

    const comptes = {};

    comptes["512000"] = { nom: "512000 - Banque (Classe 5 - Trésorerie)", items: [] };

    transactions.forEach(tx => {
        let catBrute = ExtraireCategorie(tx);
        let cleNorme = catBrute.toLowerCase();
        
        let mapping = MAPPING_PCG[cleNorme] || {
            activite: { code: "471000", nom: `471000 - ${catBrute} (Compte d'attente)` },
            tiers: { code: "401000", nom: `401000 - Fournisseurs Divers (Classe 4 - Tiers)` }
        };

        let cActivite = mapping.activite;
        let cTiers = mapping.tiers;

        if (!comptes[cActivite.code]) {
            comptes[cActivite.code] = { nom: cActivite.nom, items: [] };
        }
        comptes[cActivite.code].items.push(tx);

        if (!comptes[cTiers.code]) {
            comptes[cTiers.code] = { nom: cTiers.nom, items: [] };
        }
        comptes[cTiers.code].items.push(tx);

        comptes["512000"].items.push(tx);
    });

    let htmlComplet = `<h2 style="margin-bottom:20px;">📖 Grand Livre des Comptes (Norme PCG)</h2>`;

    Object.keys(comptes).sort().forEach(codeCompte => {
        const compte = comptes[codeCompte];
        let totalDebit = 0;
        let totalCredit = 0;
        let lignesHtml = '';

        compte.items.forEach(tx => {
            const estRecette = ExtraireType(tx) === 'recette';
            const montantAbsolu = Math.abs(ExtraireMontant(tx));

            let debit = 0;
            let credit = 0;

            if (codeCompte === "512000") {
                if (estRecette) debit = montantAbsolu;
                else credit = montantAbsolu;
            } else if (codeCompte.startsWith('4')) {
                if (estRecette) debit = montantAbsolu;
                else credit = montantAbsolu;
            } else if (codeCompte.startsWith('7')) {
                credit = montantAbsolu;
            } else {
                debit = montantAbsolu;
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
        let libelleSolde = codeCompte.startsWith('7') || (codeCompte.startsWith('4') && !codeCompte.startsWith('411') && solde < 0) || (codeCompte === "512000" && solde < 0)
            ? `Solde Créditeur : ${Math.abs(solde).toFixed(2)} €`
            : `Solde Débiteur : ${Math.abs(solde).toFixed(2)} €`;

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
// 7. INITIALISATION DU FORMULAIRE
// ------------------------------------------
document.addEventListener('DOMContentLoaded', function() {
    const form = document.querySelector('form');
    if (form) {
        form.addEventListener('submit', window.ajouterTransaction);
    }

    setTimeout(function() {
        if (window.supabaseClient) {
            window.chargerTransactions();
        }
    }, 300);
});
