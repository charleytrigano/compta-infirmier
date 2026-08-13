// ==========================================
// MODULE COMPTABLE : JOURNAUX, TIERS, RECEPTIONS & DÉPENSES
// ==========================================

// 1. Comptes de tiers
window.comptesTiersClients = JSON.parse(localStorage.getItem('comptesTiersClients')) || [
    { id: '1', nom: 'Abadie', code: '411ABADIE' },
    { id: '2', nom: 'Saint-André', code: '411STANDRE' }
];

window.comptesTiersFournisseurs = JSON.parse(localStorage.getItem('comptesTiersFournisseurs')) || [
    { id: '101', nom: 'URSSAF', code: '401URSSAF' },
    { id: '102', nom: 'CARPIMKO', code: '401CARPIMKO' },
    { id: '103', nom: 'Fournisseur Matériel', code: '401MATERIEL' }
];

// 2. Registres des validations manuelles de l'utilisateur
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

window.afficherModuleJournaux = function(container) {
    var transactions = window.allTransactions || [];

    var ecrituresVE = [];
    var ecrituresHA = [];
    var prestationsEnAttente = [];
    var depensesEnAttente = [];

    // Traitement des transactions
    transactions.forEach(function(tx, index) {
        var montant = parseFloat(tx.amount) || 0;
        var type = (tx.type || '').toLowerCase();
        var label = (tx.label || tx.description || 'Opération').trim();
        var dateOp = tx.date || new Date().toISOString().split('T')[0];
        var txId = tx.id || ('tx-' + index);

        // --- RECETTES (VENTES - VE) ---
        if (type === 'recette' || montant > 0) {
            var valMontant = Math.abs(montant);
            var tiersC = window.comptesTiersClients.find(t => label.toLowerCase().includes(t.nom.toLowerCase()));
            var codeTiersC = tiersC ? tiersC.code : '411DIVERS';
            var nomTiersC = tiersC ? tiersC.nom : 'Client Divers';

            ecrituresVE.push({ date: dateOp, journal: 'VE', piece: 'FAC-' + (1000 + index), compte: codeTiersC, libelle: 'Prestation - ' + nomTiersC, debit: valMontant, credit: 0 });
            ecrituresVE.push({ date: dateOp, journal: 'VE', piece: 'FAC-' + (1000 + index), compte: '706000', libelle: 'Honoraires BNC', debit: 0, credit: valMontant });

            if (!window.encaissementsValides.find(e => e.txId === txId)) {
                prestationsEnAttente.push({ txId: txId, date: dateOp, nomTiers: nomTiersC, codeTiers: codeTiersC, label: label, montant: valMontant, piece: 'FAC-' + (1000 + index) });
            }
        } 
        // --- DÉPENSES (ACHATS - HA) ---
        else if (type === 'depense' || montant < 0) {
            var valMontantD = Math.abs(montant);
            var tiersF = window.comptesTiersFournisseurs.find(t => label.toLowerCase().includes(t.nom.toLowerCase()));
            var codeTiersF = tiersF ? tiersF.code : '401DIVERS';
            var nomTiersF = tiersF ? tiersF.nom : 'Fournisseur Divers';

            ecrituresHA.push({ date: dateOp, journal: 'HA', piece: 'DEP-' + (2000 + index), compte: '606000', libelle: 'Achats / Charges - ' + label, debit: valMontantD, credit: 0 });
            ecrituresHA.push({ date: dateOp, journal: 'HA', piece: 'DEP-' + (2000 + index), compte: codeTiersF, libelle: 'Facture Fournisseur - ' + nomTiersF, debit: 0, credit: valMontantD });

            if (!window.decaissementsValides.find(d => d.txId === txId)) {
                depensesEnAttente.push({ txId: txId, date: dateOp, nomTiers: nomTiersF, codeTiers: codeTiersF, label: label, montant: valMontantD, piece: 'DEP-' + (2000 + index) });
            }
        }
    });

    // --- JOURNAL DE BANQUE (BQ) ---
    var ecrituresBQ = [];
    
    // Encaissements
    window.encaissementsValides.forEach(function(enc, index) {
        ecrituresBQ.push({ date: enc.dateBQ, journal: 'BQ', piece: 'ENC-' + (5000 + index), compte: '512000', libelle: 'Encaissement - ' + enc.nomTiers, debit: enc.montant, credit: 0 });
        ecrituresBQ.push({ date: enc.dateBQ, journal: 'BQ', piece: 'ENC-' + (5000 + index), compte: enc.codeTiers, libelle: 'Règlement ' + enc.piece, debit: 0, credit: enc.montant });
    });

    // Décaissements
    window.decaissementsValides.forEach(function(dec, index) {
        ecrituresBQ.push({ date: dec.dateBQ, journal: 'BQ', piece: 'DEC-' + (6000 + index), compte: dec.codeTiers, libelle: 'Règlement Fournisseur - ' + dec.nomTiers, debit: dec.montant, credit: 0 });
        ecrituresBQ.push({ date: dec.dateBQ, journal: 'BQ', piece: 'DEC-' + (6000 + index), compte: '512000', libelle: 'Prélèvement / Virement - ' + dec.piece, debit: 0, credit: dec.montant });
    });

    // Interface HTML
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
            .btn-green:hover { background: #15803d; }
            .btn-red { background: #dc2626; color: white; border: none; padding: 6px 12px; border-radius: 4px; font-weight: 600; cursor: pointer; }
            .btn-red:hover { background: #b91c1c; }
            .input-date { padding: 5px 8px; border: 1px solid #cbd5e1; border-radius: 4px; }
        </style>

        <div class="jrn-box">
            <h2>📘 Journaux Comptables & Suivi des Flux</h2>

            <!-- ONGLETS -->
            <div class="jrn-tabs">
                <button class="jrn-tab-btn active" id="btn-tab-enc" onclick="window.changerOnglet('enc')">🟢 Encaissements à Valider (${prestationsEnAttente.length})</button>
                <button class="jrn-tab-btn" id="btn-tab-dec" onclick="window.changerOnglet('dec')">🔴 Dépenses à Régler (${depensesEnAttente.length})</button>
                <button class="jrn-tab-btn" id="btn-tab-ve" onclick="window.changerOnglet('ve')">Journal Ventes (VE)</button>
                <button class="jrn-tab-btn" id="btn-tab-ha" onclick="window.changerOnglet('ha')">Journal Dépenses (HA)</button>
                <button class="jrn-tab-btn" id="btn-tab-bq" onclick="window.changerOnglet('bq')">Journal Banque (BQ)</button>
            </div>

            <!-- VUE 1 : ENCAISSEMENT RECETTES -->
            <div id="vue-enc" class="jrn-card">
                <h4 style="color:#16a34a;">🟢 Encaissements de Prestations à Valider</h4>
                ${window.genererTableauAttente(prestationsEnAttente, 'recette')}
            </div>

            <!-- VUE 2 : DÉCAISSEMENT DÉPENSES -->
            <div id="vue-dec" class="jrn-card" style="display:none;">
                <h4 style="color:#dc2626;">🔴 Dépenses à Valider (Sorties de Banque)</h4>
                ${window.genererTableauAttente(depensesEnAttente, 'depense')}
            </div>

            <!-- VUE 3 : JOURNAL VE -->
            <div id="vue-ve" class="jrn-card" style="display:none;">
                <h4>Journal des Ventes (VE)</h4>
                ${window.genererTableauJournal(ecrituresVE)}
            </div>

            <!-- VUE 4 : JOURNAL HA -->
            <div id="vue-ha" class="jrn-card" style="display:none;">
                <h4>Journal des Dépenses / Achats (HA)</h4>
                ${window.genererTableauJournal(ecrituresHA)}
            </div>

            <!-- VUE 5 : JOURNAL BQ -->
            <div id="vue-bq" class="jrn-card" style="display:none;">
                <h4>Journal de Banque (BQ - Flux Validés)</h4>
                ${window.genererTableauJournal(ecrituresBQ)}
            </div>
        </div>
    `;
};

// Générateur de tableau pour la validation manuelle
window.genererTableauAttente = function(liste, type) {
    if (liste.length === 0) return `<p style="color:#64748b; font-style:italic;">Aucune opération en attente.</p>`;

    var hoy = new Date().toISOString().split('T')[0];
    var isRecette = type === 'recette';

    var rows = liste.map(function(item) {
        return `
            <tr>
                <td>${item.date}</td>
                <td><strong>${item.nomTiers}</strong> <small>(${item.codeTiers})</small></td>
                <td>${item.label}</td>
                <td style="font-weight:bold; color:${isRecette ? '#16a34a' : '#dc2626'};">${item.montant.toFixed(2)} €</td>
                <td><input type="date" id="date-flux-${item.txId}" class="input-date" value="${hoy}" /></td>
                <td>
                    ${isRecette ? 
                        `<button class="btn-green" onclick="window.validerFlux('${item.txId}', '${item.nomTiers}', '${item.codeTiers}', ${item.montant}, '${item.piece}', 'recette')">✓ Valider l'encaissement</button>` :
                        `<button class="btn-red" onclick="window.validerFlux('${item.txId}', '${item.nomTiers}', '${item.codeTiers}', ${item.montant}, '${item.piece}', 'depense')">✓ Valider le règlement</button>`
                    }
                </td>
            </tr>
        `;
    }).join('');

    return `
        <table class="jrn-table">
            <thead>
                <tr>
                    <th>Date Engagement</th>
                    <th>Tiers</th>
                    <th>Libellé</th>
                    <th>Montant</th>
                    <th>Date Relevé Banque</th>
                    <th>Action</th>
                </tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>
    `;
};

// Validation manuelle de l'utilisateur (Recette ou Dépense)
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
};

window.genererTableauJournal = function(ecritures) {
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
            </tr>
        `;
    }).join('');

    return `
        <table class="jrn-table">
            <thead>
                <tr>
                    <th>Date</th><th>Journal</th><th>N° Pièce</th><th>Compte</th><th>Libellé</th><th style="text-align:right;">Débit</th><th style="text-align:right;">Crédit</th>
                </tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>
    `;
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
