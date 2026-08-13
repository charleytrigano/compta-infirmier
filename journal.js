// ==========================================
// MODULE COMPTABLE : JOURNAUX & CHARGES SOCIALES (CARPIMKO / URSSAF)
// ==========================================

// 1. Répertoire fixe des comptes de tiers
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

// Fonction d'analyse comptable des dépenses
window.analyserDepense = function(label) {
    var cleanLabel = label.trim();
    var lower = cleanLabel.toLowerCase();

    // 1. Détection CARPIMKO
    if (lower.includes('carpimko') || (lower.includes('acompte') && lower.includes('paye')) || lower.includes('retraite')) {
        return {
            compteCharge: '646000',
            libelleCharge: 'Cotisations Retraite - CARPIMKO',
            codeTiers: '438CARPIMKO',
            nomTiers: 'CARPIMKO',
            type: 'social'
        };
    }

    // 2. Détection URSSAF
    if (lower.includes('urssaf') || lower.includes('cotis') || lower.includes('cnsd')) {
        return {
            compteCharge: '646000',
            libelleCharge: 'Cotisations Sociales - URSSAF',
            codeTiers: '438URSSAF',
            nomTiers: 'URSSAF',
            type: 'social'
        };
    }

    // 3. Détection Fiscalité
    if (lower.includes('impot') || lower.includes('taxe') || lower.includes('cfe') || lower.includes('pas')) {
        return {
            compteCharge: '635000',
            libelleCharge: 'Impôts et Taxes (CFE)',
            codeTiers: '447IMPOTS',
            nomTiers: 'Impôts',
            type: 'fiscal'
        };
    }

    // 4. Par défaut : Fournisseur / Achat
    var codeClean = cleanLabel.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().substring(0, 8);
    return {
        compteCharge: '606000',
        libelleCharge: 'Achats / Fournitures - ' + cleanLabel,
        codeTiers: '401' + (codeClean || 'FOURNISSEUR'),
        nomTiers: cleanLabel,
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
        var label = (tx.label || tx.description || 'Opération').trim();
        var dateOp = tx.date || new Date().toISOString().split('T')[0];
        var txId = tx.id || ('tx-' + index);

        // RECETTES (VE)
        if (type === 'recette' || montant > 0) {
            var valMontant = Math.abs(montant);
            var tiersC = window.comptesTiersClients.find(t => label.toLowerCase().includes(t.nom.toLowerCase()));
            var codeTiersC = tiersC ? tiersC.code : ('411' + label.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().substring(0, 8));
            var nomTiersC = tiersC ? tiersC.nom : label;

            ecrituresVE.push({ date: dateOp, journal: 'VE', piece: 'FAC-' + (1000 + index), compte: codeTiersC, libelle: 'Prestation - ' + nomTiersC, debit: valMontant, credit: 0 });
            ecrituresVE.push({ date: dateOp, journal: 'VE', piece: 'FAC-' + (1000 + index), compte: '706000', libelle: 'Honoraires BNC', debit: 0, credit: valMontant });

            if (!window.encaissementsValides.find(e => e.txId === txId)) {
                prestationsEnAttente.push({ txId: txId, date: dateOp, nomTiers: nomTiersC, codeTiers: codeTiersC, label: label, montant: valMontant, piece: 'FAC-' + (1000 + index) });
            }
        } 
        // DÉPENSES & CHARGES (HA)
        else if (type === 'depense' || montant < 0) {
            var valMontantD = Math.abs(montant);
            var analyse = window.analyserDepense(label);

            // Inscription au Journal HA
            ecrituresHA.push({ date: dateOp, journal: 'HA', piece: 'DEP-' + (2000 + index), compte: analyse.compteCharge, libelle: analyse.libelleCharge, debit: valMontantD, credit: 0 });
            ecrituresHA.push({ date: dateOp, journal: 'HA', piece: 'DEP-' + (2000 + index), compte: analyse.codeTiers, libelle: 'Appel / Facture - ' + analyse.nomTiers, debit: 0, credit: valMontantD });

            if (!window.decaissementsValides.find(d => d.txId === txId)) {
                depensesEnAttente.push({ txId: txId, date: dateOp, nomTiers: analyse.nomTiers, codeTiers: analyse.codeTiers, label: label, montant: valMontantD, piece: 'DEP-' + (2000 + index) });
            }
        }
    });

    // JOURNAL DE BANQUE (BQ)
    var ecrituresBQ = [];
    window.encaissementsValides.forEach(function(enc, index) {
        ecrituresBQ.push({ date: enc.dateBQ, journal: 'BQ', piece: 'ENC-' + (5000 + index), compte: '512000', libelle: 'Encaissement - ' + enc.nomTiers, debit: enc.montant, credit: 0 });
        ecrituresBQ.push({ date: enc.dateBQ, journal: 'BQ', piece: 'ENC-' + (5000 + index), compte: enc.codeTiers, libelle: 'Règlement ' + enc.piece, debit: 0, credit: enc.montant });
    });

    window.decaissementsValides.forEach(function(dec, index) {
        ecrituresBQ.push({ date: dec.dateBQ, journal: 'BQ', piece: 'DEC-' + (6000 + index), compte: dec.codeTiers, libelle: 'Règlement - ' + dec.nomTiers, debit: dec.montant, credit: 0 });
        ecrituresBQ.push({ date: dec.dateBQ, journal: 'BQ', piece: 'DEC-' + (6000 + index), compte: '512000', libelle: 'Prélèvement / Virement - ' + dec.piece, debit: 0, credit: dec.montant });
    });

    // RENDU HTML
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
            .input-date { padding: 5px 8px; border: 1px solid #cbd5e1; border-radius: 4px; }

            .badge-social { background: #fef3c7; color: #92400e; padding: 3px 8px; border-radius: 12px; font-size: 11px; font-weight: 600; }
            .badge-fiscal { background: #e0e7ff; color: #3730a3; padding: 3px 8px; border-radius: 12px; font-size: 11px; font-weight: 600; }
            .badge-fournisseur { background: #f1f5f9; color: #475569; padding: 3px 8px; border-radius: 12px; font-size: 11px; font-weight: 600; }
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
                ${window.genererTableauJournal(ecrituresVE)}
            </div>

            <div id="vue-ha" class="jrn-card">
                <h4>Journal des Dépenses (HA)</h4>
                ${window.genererTableauJournal(ecrituresHA)}
            </div>

            <div id="vue-bq" class="jrn-card" style="display:none;">
                <h4>Journal de Banque (BQ)</h4>
                ${window.genererTableauJournal(ecrituresBQ)}
            </div>
        </div>
    `;
};

window.genererTableauAttente = function(liste, type) {
    if (liste.length === 0) return `<p style="color:#64748b; font-style:italic;">Aucune opération en attente.</p>`;

    var hoy = new Date().toISOString().split('T')[0];
    var isRecette = type === 'recette';

    var rows = liste.map(function(item) {
        return `
            <tr>
                <td>${item.date}</td>
                <td><strong>${item.nomTiers}</strong> <br/><small style="color:#2563eb;">${item.codeTiers}</small></td>
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
                    <th>Compte Tiers Individuel</th>
                    <th>Libellé Transaction</th>
                    <th>Montant</th>
                    <th>Date Relevé Banque</th>
                    <th>Action</th>
                </tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>
    `;
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
                    <th>Date</th><th>Journal</th><th>N° Pièce</th><th>Compte Tiers / Charge</th><th>Libellé</th><th style="text-align:right;">Débit</th><th style="text-align:right;">Crédit</th>
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
