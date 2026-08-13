// ==========================================
// MODULE COMPTABLE : DÉPENSES, JOURNAL & ÉDITION (VE / HA / BQ)
// ==========================================

// 1. Répertoire des comptes de tiers
window.comptesTiersClients = JSON.parse(localStorage.getItem('comptesTiersClients')) || [
    { id: '1', nom: 'Abadie', code: '411ABADIE' },
    { id: '2', nom: 'Saint-André', code: '411STANDRE' }
];

window.comptesTiersAutres = JSON.parse(localStorage.getItem('comptesTiersAutres')) || [
    { id: 's1', nom: 'URSSAF', code: '438URSSAF', type: 'social' },
    { id: 's2', nom: 'CARPIMKO', code: '438CARPIMKO', type: 'social' },
    { id: 'f1', nom: 'Impôts (CFE / PAS)', code: '447IMPOTS', type: 'fiscal' },
    { id: 'm1', nom: 'Matériel Médical', code: '401MATERIEL', type: 'fournisseur' }
];

window.encaissementsValides = JSON.parse(localStorage.getItem('encaissementsValides')) || [];
window.decaissementsValides = JSON.parse(localStorage.getItem('decaissementsValides')) || [];

window.initJournal = function() {
    var container = document.getElementById('journal-container') || document.querySelector('.card, .container');

    if (!container) {
        var elements = document.querySelectorAll('div, section');
        elements.forEach(function(el) {
            if (el.textContent.includes('Journal') || el.textContent.includes('Journaux')) {
                container = el;
            }
        });
    }

    if (!container) return;

    window.afficherModuleJournaux(container);
};

// Fonction d'analyse basée en PRIORITÉ sur la catégorie
window.analyserDepense = function(categorie, description, dateOp) {
    var catClean = (categorie || '').trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    var descClean = (description || '').trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    
    var texteAnalyse = catClean || descClean;

    var anneeEnCours = new Date().getFullYear();
    var anneeTx = dateOp ? new Date(dateOp).getFullYear() : anneeEnCours;
    var isAnneeNMinus1 = (anneeTx < anneeEnCours) || texteAnalyse.includes('n-1') || texteAnalyse.includes('regul');
    var mentionExercice = isAnneeNMinus1 ? " (Charges année N-1)" : " (Charges année N)";

    // 1. CARPIMKO
    if (texteAnalyse.includes('carpimko') || texteAnalyse.includes('carp') || texteAnalyse.includes('retraite')) {
        return {
            compteCharge: '646200',
            libelleCharge: 'Cotisations Retraite CARPIMKO' + mentionExercice,
            codeTiers: '438CARPIMKO',
            nomTiers: 'CARPIMKO',
            type: 'social'
        };
    }

    // 2. URSSAF
    if (texteAnalyse.includes('urssaf') || texteAnalyse.includes('urss') || texteAnalyse.includes('cotis')) {
        return {
            compteCharge: '646100',
            libelleCharge: 'Cotisations Sociales URSSAF' + mentionExercice,
            codeTiers: '438URSSAF',
            nomTiers: 'URSSAF',
            type: 'social'
        };
    }

    // 3. IMPÔTS ET TAXES
    if (texteAnalyse.includes('impot') || texteAnalyse.includes('taxe') || texteAnalyse.includes('cfe') || texteAnalyse.includes('pas')) {
        return {
            compteCharge: '635000',
            libelleCharge: 'Impôts et Taxes' + mentionExercice,
            codeTiers: '447IMPOTS',
            nomTiers: 'Impôts',
            type: 'fiscal'
        };
    }

    // 4. AUTRES DÉPENSES
    var nomAffichage = categorie || description || 'Fournisseur';
    var codeClean = nomAffichage.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().substring(0, 8);
    return {
        compteCharge: '606000',
        libelleCharge: 'Achats / Fournitures - ' + nomAffichage,
        codeTiers: '401' + (codeClean || 'FOURNISSEUR'),
        nomTiers: nomAffichage,
        type: 'fournisseur'
    };
};

window.afficherModuleJournaux = function(container) {
    var transactions = window.allTransactions || [];

    var ecrituresVE = [];
    var ecrituresHA = [];
    var prestationsEnAttente = [];
    var depensesEnAttente = [];

    transactions.forEach(function(tx, index) {
        var montant = parseFloat(tx.amount) || 0;
        var type = (tx.type || '').toLowerCase();
        
        var categorie = tx.categorie || tx.category || '';
        var description = tx.label || tx.description || tx.libelle || 'Opération';
        var dateOp = tx.date || new Date().toISOString().split('T')[0];
        var txId = tx.id || ('tx-' + index);

        // RECETTES (VE)
        if (type === 'recette' || (type === '' && montant > 0)) {
            var valMontant = Math.abs(montant);
            var tiersC = window.comptesTiersClients.find(t => description.toLowerCase().includes(t.nom.toLowerCase()));
            var codeTiersC = tiersC ? tiersC.code : ('411' + description.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().substring(0, 8));
            var nomTiersC = tiersC ? tiersC.nom : description;

            ecrituresVE.push({ txId: txId, date: dateOp, journal: 'VE', piece: 'FAC-' + (1000 + index), compte: codeTiersC, libelle: 'Prestation - ' + nomTiersC, debit: valMontant, credit: 0 });
            ecrituresVE.push({ txId: txId, date: dateOp, journal: 'VE', piece: 'FAC-' + (1000 + index), compte: '706000', libelle: 'Honoraires BNC', debit: 0, credit: valMontant });

            if (!window.encaissementsValides.find(e => e.txId === txId)) {
                prestationsEnAttente.push({ txId: txId, date: dateOp, categorie: categorie, nomTiers: nomTiersC, codeTiers: codeTiersC, label: description, montant: valMontant, piece: 'FAC-' + (1000 + index) });
            }
        } 
        // DÉPENSES (HA)
        else if (type === 'depense' || montant < 0 || (type === '' && montant < 0)) {
            var valMontantD = Math.abs(montant);
            var analyse = window.analyserDepense(categorie, description, dateOp);

            ecrituresHA.push({ txId: txId, date: dateOp, journal: 'HA', piece: 'DEP-' + (2000 + index), compte: analyse.compteCharge, libelle: analyse.libelleCharge, debit: valMontantD, credit: 0 });
            ecrituresHA.push({ txId: txId, date: dateOp, journal: 'HA', piece: 'DEP-' + (2000 + index), compte: analyse.codeTiers, libelle: 'Appel / Facture - ' + analyse.nomTiers, debit: 0, credit: valMontantD });

            if (!window.decaissementsValides.find(d => d.txId === txId)) {
                depensesEnAttente.push({ txId: txId, date: dateOp, categorie: categorie, nomTiers: analyse.nomTiers, codeTiers: analyse.codeTiers, label: description, montant: valMontantD, piece: 'DEP-' + (2000 + index) });
            }
        }
    });

    // JOURNAL DE BANQUE (BQ)
    var ecrituresBQ = [];
    window.encaissementsValides.forEach(function(enc, index) {
        ecrituresBQ.push({ txId: enc.txId, date: enc.dateBQ, journal: 'BQ', piece: 'ENC-' + (5000 + index), compte: '512000', libelle: 'Encaissement - ' + enc.nomTiers, debit: enc.montant, credit: 0 });
        ecrituresBQ.push({ txId: enc.txId, date: enc.dateBQ, journal: 'BQ', piece: 'ENC-' + (5000 + index), compte: enc.codeTiers, libelle: 'Règlement ' + enc.piece, debit: 0, credit: enc.montant });
    });

    window.decaissementsValides.forEach(function(dec, index) {
        ecrituresBQ.push({ txId: dec.txId, date: dec.dateBQ, journal: 'BQ', piece: 'DEC-' + (6000 + index), compte: dec.codeTiers, libelle: 'Règlement - ' + dec.nomTiers, debit: dec.montant, credit: 0 });
        ecrituresBQ.push({ txId: dec.txId, date: dec.dateBQ, journal: 'BQ', piece: 'DEC-' + (6000 + index), compte: '512000', libelle: 'Prélèvement / Virement - ' + dec.piece, debit: 0, credit: dec.montant });
    });

    // RENDU DU JOURNAL EN HTML
    container.innerHTML = `
        <style>
            .jrn-box { font-family: system-ui, -apple-system, sans-serif; }
            .jrn-card { background: #ffffff; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0; margin-bottom: 20px; box-shadow: 0 1px 2px rgba(0,0,0,0.05); }
            .jrn-tabs { display: flex; gap: 8px; margin-bottom: 20px; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; flex-wrap: wrap; }
            .jrn-tab-btn { background: #f1f5f9; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-weight: 600; color: #475569; }
            .jrn-tab-btn.active { background: #2563eb; color: #ffffff; }
            
            .jrn-table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 13px; }
            .jrn-table th, .jrn-table td { padding: 10px; border-bottom: 1px solid #f1f5f9; text-align: left; }
            .jrn-table th { background: #f8fafc; font-weight: 600; color: #475569; }
            
            .btn-green { background: #16a34a; color: white; border: none; padding: 6px 12px; border-radius: 4px; font-weight: 600; cursor: pointer; }
            .btn-red { background: #dc2626; color: white; border: none; padding: 6px 12px; border-radius: 4px; font-weight: 600; cursor: pointer; }
            .btn-edit { background: #eab308; color: white; border: none; padding: 5px 10px; border-radius: 4px; font-weight: 600; cursor: pointer; font-size: 12px; }
            .input-date { padding: 5px 8px; border: 1px solid #cbd5e1; border-radius: 4px; }

            .badge-social { background: #fef3c7; color: #92400e; padding: 3px 8px; border-radius: 12px; font-size: 11px; font-weight: 600; }
            .badge-fiscal { background: #e0e7ff; color: #3730a3; padding: 3px 8px; border-radius: 12px; font-size: 11px; font-weight: 600; }
            .badge-fournisseur { background: #f1f5f9; color: #475569; padding: 3px 8px; border-radius: 12px; font-size: 11px; font-weight: 600; }

            /* Boîte modale d'édition */
            .modal-overlay { position: fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); display:none; justify-content:center; align-items:center; z-index:9999; }
            .modal-content { background:#fff; padding:25px; border-radius:8px; width:400px; max-width:90%; box-shadow:0 10px 25px rgba(0,0,0,0.2); }
            .modal-group { margin-bottom: 15px; }
            .modal-group label { display:block; font-weight:bold; margin-bottom:5px; font-size:13px; color:#334155; }
            .modal-group input { width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:4px; box-sizing:border-box; }
        </style>

        <div class="jrn-box">
            <h2>📘 Journaux Comptables & Tiers Individuels</h2>

            <div class="jrn-card">
                <h4 style="margin-top:0;">👥 Plan des Comptes Tiers Individuels</h4>
                <div style="display:flex; gap: 8px; flex-wrap: wrap;">
                    ${window.comptesTiersAutres.map(t => {
                        var classBadge = t.type === 'social' ? 'badge-social' : (t.type === 'fiscal' ? 'badge-fiscal' : 'badge-fournisseur');
                        return `<span class="${classBadge}">${t.nom} (${t.code})</span>`;
                    }).join('')}
                </div>
            </div>

            <div class="jrn-tabs">
                <button class="jrn-tab-btn" id="btn-tab-enc" onclick="window.changerOnglet('enc')">🟢 Encaissements à Valider (${prestationsEnAttente.length})</button>
                <button class="jrn-tab-btn" id="btn-tab-dec" onclick="window.changerOnglet('dec')">🔴 Dépenses à Régler (${depensesEnAttente.length})</button>
                <button class="jrn-tab-btn" id="btn-tab-ve" onclick="window.changerOnglet('ve')">Journal Ventes (VE)</button>
                <button class="jrn-tab-btn active" id="btn-tab-ha" onclick="window.changerOnglet('ha')">Journal Dépenses (HA)</button>
                <button class="jrn-tab-btn" id="btn-tab-bq" onclick="window.changerOnglet('bq')">Journal Banque (BQ)</button>
            </div>

            <div id="vue-enc" class="jrn-card" style="display:none;">
                <h4 style="color:#16a34a;">🟢 Encaissements de Prestations à Valider</h4>
                ${window.genererTableauAttente(prestationsEnAttente, 'recette')}
            </div>

            <div id="vue-dec" class="jrn-card" style="display:none;">
                <h4 style="color:#dc2626;">🔴 Dépenses & Charges à Valider</h4>
                ${window.genererTableauAttente(depensesEnAttente, 'depense')}
            </div>

            <div id="vue-ve" class="jrn-card" style="display:none;">
                <h4>Journal des Ventes (VE)</h4>
                ${window.genererTableauJournal(ecrituresVE, true)}
            </div>

            <div id="vue-ha" class="jrn-card">
                <h4>Journal des Dépenses (HA)</h4>
                ${window.genererTableauJournal(ecrituresHA, true)}
            </div>

            <div id="vue-bq" class="jrn-card" style="display:none;">
                <h4>Journal de Banque (BQ)</h4>
                ${window.genererTableauJournal(ecrituresBQ, false)}
            </div>
        </div>

        <!-- FENÊTRE MODALE D'ÉDITION -->
        <div id="modal-edit-tx" class="modal-overlay">
            <div class="modal-content">
                <h3 style="margin-top:0; color:#1e293b;">✏️ Modifier la Transaction</h3>
                <input type="hidden" id="edit-tx-id">
                
                <div class="modal-group">
                    <label for="edit-tx-date">Date de l'opération :</label>
                    <input type="date" id="edit-tx-date">
                </div>

                <div class="modal-group">
                    <label for="edit-tx-cat">Catégorie :</label>
                    <input type="text" id="edit-tx-cat" placeholder="ex: URSSAF, CARPIMKO, Matériel...">
                </div>

                <div class="modal-group">
                    <label for="edit-tx-label">Libellé / Description :</label>
                    <input type="text" id="edit-tx-label" placeholder="ex: Cotisation trimestrielle">
                </div>

                <div class="modal-group">
                    <label for="edit-tx-amount">Montant (€) :</label>
                    <input type="number" step="0.01" id="edit-tx-amount">
                </div>

                <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:20px;">
                    <button class="jrn-tab-btn" onclick="window.fermerModalEdit()">Annuler</button>
                    <button class="btn-green" onclick="window.sauvegarderModificationTx()">💾 Enregistrer</button>
                </div>
            </div>
        </div>
    `;
};

// Tableau des opérations en attente
window.genererTableauAttente = function(liste, type) {
    if (liste.length === 0) return `<p style="color:#64748b; font-style:italic;">Aucune opération en attente.</p>`;

    var hoy = new Date().toISOString().split('T')[0];
    var isRecette = type === 'recette';

    var rows = liste.map(function(item) {
        return `
            <tr>
                <td>${item.date}</td>
                <td><span class="badge-fournisseur">${item.categorie || 'Non classé'}</span></td>
                <td><strong>${item.nomTiers}</strong> <br/><small style="color:#2563eb;">${item.codeTiers}</small></td>
                <td>${item.label}</td>
                <td style="font-weight:bold; color:${isRecette ? '#16a34a' : '#dc2626'};">${item.montant.toFixed(2)} €</td>
                <td><input type="date" id="date-flux-${item.txId}" class="input-date" value="${hoy}" /></td>
                <td>
                    <button class="btn-edit" onclick="window.ouvrirModalEdit('${item.txId}')">✏️ Edit</button>
                    ${isRecette ? 
                        `<button class="btn-green" onclick="window.validerFlux('${item.txId}', '${item.nomTiers}', '${item.codeTiers}', ${item.montant}, '${item.piece}', 'recette')">✓ Valider</button>` :
                        `<button class="btn-red" onclick="window.validerFlux('${item.txId}', '${item.nomTiers}', '${item.codeTiers}', ${item.montant}, '${item.piece}', 'depense')">✓ Valider</button>`
                    }
                </td>
            </tr>
        `;
    }).join('');

    return `
        <table class="jrn-table">
            <thead>
                <tr>
                    <th>Date</th>
                    <th>Catégorie</th>
                    <th>Compte Tiers</th>
                    <th>Libellé</th>
                    <th>Montant</th>
                    <th>Date Banque</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>
    `;
};

// Tableau du Journal (VE / HA / BQ) avec gestion de la colonne Action
window.genererTableauJournal = function(ecritures, estModifiable) {
    if (ecritures.length === 0) return `<p style="color:#94a3b8; font-style:italic;">Aucune écriture enregistrée.</p>`;

    var rows = ecritures.map(function(e) {
        return `
            <tr>
                <td>${e.date}</td>
                <td><span style="background:#f1f5f9; padding:2px 6px; border-radius:4px; font-weight:bold;">${e.journal}</span></td>
                <td>${e.piece}</td>
                <td style="font-weight:600; color:#2563eb;">${e.compte}</td>
                <td>${e.libelle}</td>
                <td style="text-align:right;">${e.debit > 0 ? e.debit.toFixed(2) + ' €' : '-'}</td>
                <td style="text-align:right;">${e.credit > 0 ? e.credit.toFixed(2) + ' €' : '-'}</td>
                ${estModifiable ? `
                    <td style="text-align:center;">
                        ${e.txId ? `<button class="btn-edit" onclick="window.ouvrirModalEdit('${e.txId}')">✏️ Edit</button>` : '-'}
                    </td>
                ` : ''}
            </tr>
        `;
    }).join('');

    return `
        <table class="jrn-table">
            <thead>
                <tr>
                    <th>Date</th>
                    <th>Journal</th>
                    <th>N° Pièce</th>
                    <th>Compte Tiers / Charge</th>
                    <th>Libellé</th>
                    <th style="text-align:right;">Débit</th>
                    <th style="text-align:right;">Crédit</th>
                    ${estModifiable ? '<th style="text-align:center;">Action</th>' : ''}
                </tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>
    `;
};

// ==========================================
// FONCTIONS DE LA MODALE D'ÉDITION
// ==========================================

window.ouvrirModalEdit = function(txId) {
    var transactions = window.allTransactions || [];
    var tx = transactions.find(function(t, idx) {
        return (t.id || ('tx-' + idx)) === txId;
    });

    if (!tx) return;

    document.getElementById('edit-tx-id').value = txId;
    document.getElementById('edit-tx-date').value = tx.date || '';
    document.getElementById('edit-tx-cat').value = tx.categorie || tx.category || '';
    document.getElementById('edit-tx-label').value = tx.label || tx.description || tx.libelle || '';
    document.getElementById('edit-tx-amount').value = Math.abs(parseFloat(tx.amount) || 0);

    document.getElementById('modal-edit-tx').style.display = 'flex';
};

window.fermerModalEdit = function() {
    document.getElementById('modal-edit-tx').style.display = 'none';
};

window.sauvegarderModificationTx = function() {
    var txId = document.getElementById('edit-tx-id').value;
    var nouvelleDate = document.getElementById('edit-tx-date').value;
    var nouvelleCat = document.getElementById('edit-tx-cat').value;
    var nouveauLabel = document.getElementById('edit-tx-label').value;
    var nouveauMontant = parseFloat(document.getElementById('edit-tx-amount').value) || 0;

    var transactions = window.allTransactions || [];
    var tx = transactions.find(function(t, idx) {
        return (t.id || ('tx-' + idx)) === txId;
    });

    if (tx) {
        tx.date = nouvelleDate;
        tx.categorie = nouvelleCat;
        tx.category = nouvelleCat;
        tx.label = nouveauLabel;
        tx.description = nouveauLabel;
        
        var ancienMontant = parseFloat(tx.amount) || 0;
        tx.amount = (ancienMontant < 0 || tx.type === 'depense') ? -Math.abs(nouveauMontant) : Math.abs(nouveauMontant);

        localStorage.setItem('allTransactions', JSON.stringify(window.allTransactions));

        window.fermerModalEdit();
        
        // Rafraîchissement automatique du Journal et du Grand Livre
        window.initJournal();
        if (typeof window.initGrandLivre === 'function') {
            window.initGrandLivre();
        }
    }
};

window.validerFlux = function(txId, nomTiers, codeTiers, montant, piece, type) {
    var inputDate = document.getElementById('date-flux-' + txId);
    var dateBQ = inputDate ? inputDate.value : new Date().toISOString().split('T')[0];

    var objetFlux = { txId: txId, nomTiers: nomTiers, codeTiers: codeTiers, montant: montant, piece: piece, dateBQ: dateBQ };

    if (type === 'recette') {
        window.encaissementsValides.push(objetFlux);
        localStorage.setItem('encaissementsValides', JSON.stringify(window.encaissementsValides));
    } else {
        window.decaissementsValides.push(objetFlux);
        localStorage.setItem('decaissementsValides', JSON.stringify(window.decaissementsValides));
    }

    window.initJournal();
    if (typeof window.initGrandLivre === 'function') {
        window.initGrandLivre();
    }
};

window.changerOnglet = function(onglet) {
    ['enc', 'dec', 've', 'ha', 'bq'].forEach(o => {
        var el = document.getElementById('vue-' + o);
        var btn = document.getElementById('btn-tab-' + o);
        if (el) el.style.display = (o === onglet) ? 'block' : 'none';
        if (btn) btn.classList.toggle('active', o === onglet);
    });
};

if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(window.initJournal, 100);
} else {
    document.addEventListener('DOMContentLoaded', window.initJournal);
}// ==========================================
// MODULE COMPTABLE : DÉPENSES, JOURNAL & ÉDITION (VE / HA / BQ)
// ==========================================

// 1. Répertoire des comptes de tiers
window.comptesTiersClients = JSON.parse(localStorage.getItem('comptesTiersClients')) || [
    { id: '1', nom: 'Abadie', code: '411ABADIE' },
    { id: '2', nom: 'Saint-André', code: '411STANDRE' }
];

window.comptesTiersAutres = JSON.parse(localStorage.getItem('comptesTiersAutres')) || [
    { id: 's1', nom: 'URSSAF', code: '438URSSAF', type: 'social' },
    { id: 's2', nom: 'CARPIMKO', code: '438CARPIMKO', type: 'social' },
    { id: 'f1', nom: 'Impôts (CFE / PAS)', code: '447IMPOTS', type: 'fiscal' },
    { id: 'm1', nom: 'Matériel Médical', code: '401MATERIEL', type: 'fournisseur' }
];

window.encaissementsValides = JSON.parse(localStorage.getItem('encaissementsValides')) || [];
window.decaissementsValides = JSON.parse(localStorage.getItem('decaissementsValides')) || [];

window.initJournal = function() {
    var container = document.getElementById('journal-container') || document.querySelector('.card, .container');

    if (!container) {
        var elements = document.querySelectorAll('div, section');
        elements.forEach(function(el) {
            if (el.textContent.includes('Journal') || el.textContent.includes('Journaux')) {
                container = el;
            }
        });
    }

    if (!container) return;

    window.afficherModuleJournaux(container);
};

// Fonction d'analyse basée en PRIORITÉ sur la catégorie
window.analyserDepense = function(categorie, description, dateOp) {
    var catClean = (categorie || '').trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    var descClean = (description || '').trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    
    var texteAnalyse = catClean || descClean;

    var anneeEnCours = new Date().getFullYear();
    var anneeTx = dateOp ? new Date(dateOp).getFullYear() : anneeEnCours;
    var isAnneeNMinus1 = (anneeTx < anneeEnCours) || texteAnalyse.includes('n-1') || texteAnalyse.includes('regul');
    var mentionExercice = isAnneeNMinus1 ? " (Charges année N-1)" : " (Charges année N)";

    // 1. CARPIMKO
    if (texteAnalyse.includes('carpimko') || texteAnalyse.includes('carp') || texteAnalyse.includes('retraite')) {
        return {
            compteCharge: '646200',
            libelleCharge: 'Cotisations Retraite CARPIMKO' + mentionExercice,
            codeTiers: '438CARPIMKO',
            nomTiers: 'CARPIMKO',
            type: 'social'
        };
    }

    // 2. URSSAF
    if (texteAnalyse.includes('urssaf') || texteAnalyse.includes('urss') || texteAnalyse.includes('cotis')) {
        return {
            compteCharge: '646100',
            libelleCharge: 'Cotisations Sociales URSSAF' + mentionExercice,
            codeTiers: '438URSSAF',
            nomTiers: 'URSSAF',
            type: 'social'
        };
    }

    // 3. IMPÔTS ET TAXES
    if (texteAnalyse.includes('impot') || texteAnalyse.includes('taxe') || texteAnalyse.includes('cfe') || texteAnalyse.includes('pas')) {
        return {
            compteCharge: '635000',
            libelleCharge: 'Impôts et Taxes' + mentionExercice,
            codeTiers: '447IMPOTS',
            nomTiers: 'Impôts',
            type: 'fiscal'
        };
    }

    // 4. AUTRES DÉPENSES
    var nomAffichage = categorie || description || 'Fournisseur';
    var codeClean = nomAffichage.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().substring(0, 8);
    return {
        compteCharge: '606000',
        libelleCharge: 'Achats / Fournitures - ' + nomAffichage,
        codeTiers: '401' + (codeClean || 'FOURNISSEUR'),
        nomTiers: nomAffichage,
        type: 'fournisseur'
    };
};

window.afficherModuleJournaux = function(container) {
    var transactions = window.allTransactions || [];

    var ecrituresVE = [];
    var ecrituresHA = [];
    var prestationsEnAttente = [];
    var depensesEnAttente = [];

    transactions.forEach(function(tx, index) {
        var montant = parseFloat(tx.amount) || 0;
        var type = (tx.type || '').toLowerCase();
        
        var categorie = tx.categorie || tx.category || '';
        var description = tx.label || tx.description || tx.libelle || 'Opération';
        var dateOp = tx.date || new Date().toISOString().split('T')[0];
        var txId = tx.id || ('tx-' + index);

        // RECETTES (VE)
        if (type === 'recette' || (type === '' && montant > 0)) {
            var valMontant = Math.abs(montant);
            var tiersC = window.comptesTiersClients.find(t => description.toLowerCase().includes(t.nom.toLowerCase()));
            var codeTiersC = tiersC ? tiersC.code : ('411' + description.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().substring(0, 8));
            var nomTiersC = tiersC ? tiersC.nom : description;

            ecrituresVE.push({ txId: txId, date: dateOp, journal: 'VE', piece: 'FAC-' + (1000 + index), compte: codeTiersC, libelle: 'Prestation - ' + nomTiersC, debit: valMontant, credit: 0 });
            ecrituresVE.push({ txId: txId, date: dateOp, journal: 'VE', piece: 'FAC-' + (1000 + index), compte: '706000', libelle: 'Honoraires BNC', debit: 0, credit: valMontant });

            if (!window.encaissementsValides.find(e => e.txId === txId)) {
                prestationsEnAttente.push({ txId: txId, date: dateOp, categorie: categorie, nomTiers: nomTiersC, codeTiers: codeTiersC, label: description, montant: valMontant, piece: 'FAC-' + (1000 + index) });
            }
        } 
        // DÉPENSES (HA)
        else if (type === 'depense' || montant < 0 || (type === '' && montant < 0)) {
            var valMontantD = Math.abs(montant);
            var analyse = window.analyserDepense(categorie, description, dateOp);

            ecrituresHA.push({ txId: txId, date: dateOp, journal: 'HA', piece: 'DEP-' + (2000 + index), compte: analyse.compteCharge, libelle: analyse.libelleCharge, debit: valMontantD, credit: 0 });
            ecrituresHA.push({ txId: txId, date: dateOp, journal: 'HA', piece: 'DEP-' + (2000 + index), compte: analyse.codeTiers, libelle: 'Appel / Facture - ' + analyse.nomTiers, debit: 0, credit: valMontantD });

            if (!window.decaissementsValides.find(d => d.txId === txId)) {
                depensesEnAttente.push({ txId: txId, date: dateOp, categorie: categorie, nomTiers: analyse.nomTiers, codeTiers: analyse.codeTiers, label: description, montant: valMontantD, piece: 'DEP-' + (2000 + index) });
            }
        }
    });

    // JOURNAL DE BANQUE (BQ)
    var ecrituresBQ = [];
    window.encaissementsValides.forEach(function(enc, index) {
        ecrituresBQ.push({ txId: enc.txId, date: enc.dateBQ, journal: 'BQ', piece: 'ENC-' + (5000 + index), compte: '512000', libelle: 'Encaissement - ' + enc.nomTiers, debit: enc.montant, credit: 0 });
        ecrituresBQ.push({ txId: enc.txId, date: enc.dateBQ, journal: 'BQ', piece: 'ENC-' + (5000 + index), compte: enc.codeTiers, libelle: 'Règlement ' + enc.piece, debit: 0, credit: enc.montant });
    });

    window.decaissementsValides.forEach(function(dec, index) {
        ecrituresBQ.push({ txId: dec.txId, date: dec.dateBQ, journal: 'BQ', piece: 'DEC-' + (6000 + index), compte: dec.codeTiers, libelle: 'Règlement - ' + dec.nomTiers, debit: dec.montant, credit: 0 });
        ecrituresBQ.push({ txId: dec.txId, date: dec.dateBQ, journal: 'BQ', piece: 'DEC-' + (6000 + index), compte: '512000', libelle: 'Prélèvement / Virement - ' + dec.piece, debit: 0, credit: dec.montant });
    });

    // RENDU DU JOURNAL EN HTML
    container.innerHTML = `
        <style>
            .jrn-box { font-family: system-ui, -apple-system, sans-serif; }
            .jrn-card { background: #ffffff; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0; margin-bottom: 20px; box-shadow: 0 1px 2px rgba(0,0,0,0.05); }
            .jrn-tabs { display: flex; gap: 8px; margin-bottom: 20px; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; flex-wrap: wrap; }
            .jrn-tab-btn { background: #f1f5f9; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-weight: 600; color: #475569; }
            .jrn-tab-btn.active { background: #2563eb; color: #ffffff; }
            
            .jrn-table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 13px; }
            .jrn-table th, .jrn-table td { padding: 10px; border-bottom: 1px solid #f1f5f9; text-align: left; }
            .jrn-table th { background: #f8fafc; font-weight: 600; color: #475569; }
            
            .btn-green { background: #16a34a; color: white; border: none; padding: 6px 12px; border-radius: 4px; font-weight: 600; cursor: pointer; }
            .btn-red { background: #dc2626; color: white; border: none; padding: 6px 12px; border-radius: 4px; font-weight: 600; cursor: pointer; }
            .btn-edit { background: #eab308; color: white; border: none; padding: 5px 10px; border-radius: 4px; font-weight: 600; cursor: pointer; font-size: 12px; }
            .input-date { padding: 5px 8px; border: 1px solid #cbd5e1; border-radius: 4px; }

            .badge-social { background: #fef3c7; color: #92400e; padding: 3px 8px; border-radius: 12px; font-size: 11px; font-weight: 600; }
            .badge-fiscal { background: #e0e7ff; color: #3730a3; padding: 3px 8px; border-radius: 12px; font-size: 11px; font-weight: 600; }
            .badge-fournisseur { background: #f1f5f9; color: #475569; padding: 3px 8px; border-radius: 12px; font-size: 11px; font-weight: 600; }

            /* Boîte modale d'édition */
            .modal-overlay { position: fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); display:none; justify-content:center; align-items:center; z-index:9999; }
            .modal-content { background:#fff; padding:25px; border-radius:8px; width:400px; max-width:90%; box-shadow:0 10px 25px rgba(0,0,0,0.2); }
            .modal-group { margin-bottom: 15px; }
            .modal-group label { display:block; font-weight:bold; margin-bottom:5px; font-size:13px; color:#334155; }
            .modal-group input { width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:4px; box-sizing:border-box; }
        </style>

        <div class="jrn-box">
            <h2>📘 Journaux Comptables & Tiers Individuels</h2>

            <div class="jrn-card">
                <h4 style="margin-top:0;">👥 Plan des Comptes Tiers Individuels</h4>
                <div style="display:flex; gap: 8px; flex-wrap: wrap;">
                    ${window.comptesTiersAutres.map(t => {
                        var classBadge = t.type === 'social' ? 'badge-social' : (t.type === 'fiscal' ? 'badge-fiscal' : 'badge-fournisseur');
                        return `<span class="${classBadge}">${t.nom} (${t.code})</span>`;
                    }).join('')}
                </div>
            </div>

            <div class="jrn-tabs">
                <button class="jrn-tab-btn" id="btn-tab-enc" onclick="window.changerOnglet('enc')">🟢 Encaissements à Valider (${prestationsEnAttente.length})</button>
                <button class="jrn-tab-btn" id="btn-tab-dec" onclick="window.changerOnglet('dec')">🔴 Dépenses à Régler (${depensesEnAttente.length})</button>
                <button class="jrn-tab-btn" id="btn-tab-ve" onclick="window.changerOnglet('ve')">Journal Ventes (VE)</button>
                <button class="jrn-tab-btn active" id="btn-tab-ha" onclick="window.changerOnglet('ha')">Journal Dépenses (HA)</button>
                <button class="jrn-tab-btn" id="btn-tab-bq" onclick="window.changerOnglet('bq')">Journal Banque (BQ)</button>
            </div>

            <div id="vue-enc" class="jrn-card" style="display:none;">
                <h4 style="color:#16a34a;">🟢 Encaissements de Prestations à Valider</h4>
                ${window.genererTableauAttente(prestationsEnAttente, 'recette')}
            </div>

            <div id="vue-dec" class="jrn-card" style="display:none;">
                <h4 style="color:#dc2626;">🔴 Dépenses & Charges à Valider</h4>
                ${window.genererTableauAttente(depensesEnAttente, 'depense')}
            </div>

            <div id="vue-ve" class="jrn-card" style="display:none;">
                <h4>Journal des Ventes (VE)</h4>
                ${window.genererTableauJournal(ecrituresVE, true)}
            </div>

            <div id="vue-ha" class="jrn-card">
                <h4>Journal des Dépenses (HA)</h4>
                ${window.genererTableauJournal(ecrituresHA, true)}
            </div>

            <div id="vue-bq" class="jrn-card" style="display:none;">
                <h4>Journal de Banque (BQ)</h4>
                ${window.genererTableauJournal(ecrituresBQ, false)}
            </div>
        </div>

        <!-- FENÊTRE MODALE D'ÉDITION -->
        <div id="modal-edit-tx" class="modal-overlay">
            <div class="modal-content">
                <h3 style="margin-top:0; color:#1e293b;">✏️ Modifier la Transaction</h3>
                <input type="hidden" id="edit-tx-id">
                
                <div class="modal-group">
                    <label for="edit-tx-date">Date de l'opération :</label>
                    <input type="date" id="edit-tx-date">
                </div>

                <div class="modal-group">
                    <label for="edit-tx-cat">Catégorie :</label>
                    <input type="text" id="edit-tx-cat" placeholder="ex: URSSAF, CARPIMKO, Matériel...">
                </div>

                <div class="modal-group">
                    <label for="edit-tx-label">Libellé / Description :</label>
                    <input type="text" id="edit-tx-label" placeholder="ex: Cotisation trimestrielle">
                </div>

                <div class="modal-group">
                    <label for="edit-tx-amount">Montant (€) :</label>
                    <input type="number" step="0.01" id="edit-tx-amount">
                </div>

                <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:20px;">
                    <button class="jrn-tab-btn" onclick="window.fermerModalEdit()">Annuler</button>
                    <button class="btn-green" onclick="window.sauvegarderModificationTx()">💾 Enregistrer</button>
                </div>
            </div>
        </div>
    `;
};

// Tableau des opérations en attente
window.genererTableauAttente = function(liste, type) {
    if (liste.length === 0) return `<p style="color:#64748b; font-style:italic;">Aucune opération en attente.</p>`;

    var hoy = new Date().toISOString().split('T')[0];
    var isRecette = type === 'recette';

    var rows = liste.map(function(item) {
        return `
            <tr>
                <td>${item.date}</td>
                <td><span class="badge-fournisseur">${item.categorie || 'Non classé'}</span></td>
                <td><strong>${item.nomTiers}</strong> <br/><small style="color:#2563eb;">${item.codeTiers}</small></td>
                <td>${item.label}</td>
                <td style="font-weight:bold; color:${isRecette ? '#16a34a' : '#dc2626'};">${item.montant.toFixed(2)} €</td>
                <td><input type="date" id="date-flux-${item.txId}" class="input-date" value="${hoy}" /></td>
                <td>
                    <button class="btn-edit" onclick="window.ouvrirModalEdit('${item.txId}')">✏️ Edit</button>
                    ${isRecette ? 
                        `<button class="btn-green" onclick="window.validerFlux('${item.txId}', '${item.nomTiers}', '${item.codeTiers}', ${item.montant}, '${item.piece}', 'recette')">✓ Valider</button>` :
                        `<button class="btn-red" onclick="window.validerFlux('${item.txId}', '${item.nomTiers}', '${item.codeTiers}', ${item.montant}, '${item.piece}', 'depense')">✓ Valider</button>`
                    }
                </td>
            </tr>
        `;
    }).join('');

    return `
        <table class="jrn-table">
            <thead>
                <tr>
                    <th>Date</th>
                    <th>Catégorie</th>
                    <th>Compte Tiers</th>
                    <th>Libellé</th>
                    <th>Montant</th>
                    <th>Date Banque</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>
    `;
};

// Tableau du Journal (VE / HA / BQ) avec gestion de la colonne Action
window.genererTableauJournal = function(ecritures, estModifiable) {
    if (ecritures.length === 0) return `<p style="color:#94a3b8; font-style:italic;">Aucune écriture enregistrée.</p>`;

    var rows = ecritures.map(function(e) {
        return `
            <tr>
                <td>${e.date}</td>
                <td><span style="background:#f1f5f9; padding:2px 6px; border-radius:4px; font-weight:bold;">${e.journal}</span></td>
                <td>${e.piece}</td>
                <td style="font-weight:600; color:#2563eb;">${e.compte}</td>
                <td>${e.libelle}</td>
                <td style="text-align:right;">${e.debit > 0 ? e.debit.toFixed(2) + ' €' : '-'}</td>
                <td style="text-align:right;">${e.credit > 0 ? e.credit.toFixed(2) + ' €' : '-'}</td>
                ${estModifiable ? `
                    <td style="text-align:center;">
                        ${e.txId ? `<button class="btn-edit" onclick="window.ouvrirModalEdit('${e.txId}')">✏️ Edit</button>` : '-'}
                    </td>
                ` : ''}
            </tr>
        `;
    }).join('');

    return `
        <table class="jrn-table">
            <thead>
                <tr>
                    <th>Date</th>
                    <th>Journal</th>
                    <th>N° Pièce</th>
                    <th>Compte Tiers / Charge</th>
                    <th>Libellé</th>
                    <th style="text-align:right;">Débit</th>
                    <th style="text-align:right;">Crédit</th>
                    ${estModifiable ? '<th style="text-align:center;">Action</th>' : ''}
                </tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>
    `;
};

// ==========================================
// FONCTIONS DE LA MODALE D'ÉDITION
// ==========================================

window.ouvrirModalEdit = function(txId) {
    var transactions = window.allTransactions || [];
    var tx = transactions.find(function(t, idx) {
        return (t.id || ('tx-' + idx)) === txId;
    });

    if (!tx) return;

    document.getElementById('edit-tx-id').value = txId;
    document.getElementById('edit-tx-date').value = tx.date || '';
    document.getElementById('edit-tx-cat').value = tx.categorie || tx.category || '';
    document.getElementById('edit-tx-label').value = tx.label || tx.description || tx.libelle || '';
    document.getElementById('edit-tx-amount').value = Math.abs(parseFloat(tx.amount) || 0);

    document.getElementById('modal-edit-tx').style.display = 'flex';
};

window.fermerModalEdit = function() {
    document.getElementById('modal-edit-tx').style.display = 'none';
};

window.sauvegarderModificationTx = function() {
    var txId = document.getElementById('edit-tx-id').value;
    var nouvelleDate = document.getElementById('edit-tx-date').value;
    var nouvelleCat = document.getElementById('edit-tx-cat').value;
    var nouveauLabel = document.getElementById('edit-tx-label').value;
    var nouveauMontant = parseFloat(document.getElementById('edit-tx-amount').value) || 0;

    var transactions = window.allTransactions || [];
    var tx = transactions.find(function(t, idx) {
        return (t.id || ('tx-' + idx)) === txId;
    });

    if (tx) {
        tx.date = nouvelleDate;
        tx.categorie = nouvelleCat;
        tx.category = nouvelleCat;
        tx.label = nouveauLabel;
        tx.description = nouveauLabel;
        
        var ancienMontant = parseFloat(tx.amount) || 0;
        tx.amount = (ancienMontant < 0 || tx.type === 'depense') ? -Math.abs(nouveauMontant) : Math.abs(nouveauMontant);

        localStorage.setItem('allTransactions', JSON.stringify(window.allTransactions));

        window.fermerModalEdit();
        
        // Rafraîchissement automatique du Journal et du Grand Livre
        window.initJournal();
        if (typeof window.initGrandLivre === 'function') {
            window.initGrandLivre();
        }
    }
};

window.validerFlux = function(txId, nomTiers, codeTiers, montant, piece, type) {
    var inputDate = document.getElementById('date-flux-' + txId);
    var dateBQ = inputDate ? inputDate.value : new Date().toISOString().split('T')[0];

    var objetFlux = { txId: txId, nomTiers: nomTiers, codeTiers: codeTiers, montant: montant, piece: piece, dateBQ: dateBQ };

    if (type === 'recette') {
        window.encaissementsValides.push(objetFlux);
        localStorage.setItem('encaissementsValides', JSON.stringify(window.encaissementsValides));
    } else {
        window.decaissementsValides.push(objetFlux);
        localStorage.setItem('decaissementsValides', JSON.stringify(window.decaissementsValides));
    }

    window.initJournal();
    if (typeof window.initGrandLivre === 'function') {
        window.initGrandLivre();
    }
};

window.changerOnglet = function(onglet) {
    ['enc', 'dec', 've', 'ha', 'bq'].forEach(o => {
        var el = document.getElementById('vue-' + o);
        var btn = document.getElementById('btn-tab-' + o);
        if (el) el.style.display = (o === onglet) ? 'block' : 'none';
        if (btn) btn.classList.toggle('active', o === onglet);
    });
};

if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(window.initJournal, 100);
} else {
    document.addEventListener('DOMContentLoaded', window.initJournal);
}
