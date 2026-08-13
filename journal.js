// ==========================================
// MODULE COMPTABLE : JOURNAUX, TIERS & ENCAISSEMENT MANUEL
// ==========================================

// 1. Répertoire des comptes de tiers
window.comptesTiers = JSON.parse(localStorage.getItem('comptesTiers')) || [
    { id: '1', nom: 'Abadie', code: '411ABADIE' },
    { id: '2', nom: 'Saint-André', code: '411STANDRE' }
];

// 2. Registre des encaissements enregistrés manuellement par l'utilisateur
window.encaissementsValides = JSON.parse(localStorage.getItem('encaissementsValides')) || [];

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
    var prestationsEnAttente = [];

    // 1. Génération des Ventes (VE) et préparation des attentes d'encaissement
    transactions.forEach(function(tx, index) {
        var montant = parseFloat(tx.amount) || 0;
        var type = (tx.type || '').toLowerCase();
        var label = (tx.label || tx.description || 'Prestation').trim();
        var datePrestation = tx.date || new Date().toISOString().split('T')[0];
        var txId = tx.id || ('tx-' + index);

        if (type === 'recette' || montant > 0) {
            var valMontant = Math.abs(montant);

            // Recherche du tiers dans le libellé
            var tiersTrouve = window.comptesTiers.find(function(t) {
                return label.toLowerCase().includes(t.nom.toLowerCase());
            });

            var codeTiers = tiersTrouve ? tiersTrouve.code : '411DIVERS';
            var nomTiers = tiersTrouve ? tiersTrouve.nom : 'Tiers Divers';

            // Inscription au Journal des Ventes (VE)
            ecrituresVE.push({
                id: txId,
                date: datePrestation,
                journal: 'VE',
                piece: 'FAC-' + (1000 + index),
                compte: codeTiers,
                libelle: 'Prestation / Facture - ' + nomTiers,
                debit: valMontant,
                credit: 0
            });
            ecrituresVE.push({
                id: txId,
                date: datePrestation,
                journal: 'VE',
                piece: 'FAC-' + (1000 + index),
                compte: '706000',
                libelle: 'Honoraires BNC',
                debit: 0,
                credit: valMontant
            });

            // Vérification si cette prestation a déjà été encaissée manuellement
            var encaissementExistant = window.encaissementsValides.find(function(e) {
                return e.txId === txId;
            });

            if (!encaissementExistant) {
                prestationsEnAttente.push({
                    txId: txId,
                    datePrestation: datePrestation,
                    nomTiers: nomTiers,
                    codeTiers: codeTiers,
                    label: label,
                    montant: valMontant,
                    piece: 'FAC-' + (1000 + index)
                });
            }
        }
    });

    // 2. Construction du Journal de Banque (BQ) uniquement à partir des validations manuelles
    var ecrituresBQ = [];
    window.encaissementsValides.forEach(function(enc, index) {
        ecrituresBQ.push({
            date: enc.dateEncaissement,
            journal: 'BQ',
            piece: 'ENC-' + (5000 + index),
            compte: '512000',
            libelle: 'Encaissement Banque - ' + enc.nomTiers,
            debit: enc.montant,
            credit: 0
        });
        ecrituresBQ.push({
            date: enc.dateEncaissement,
            journal: 'BQ',
            piece: 'ENC-' + (5000 + index),
            compte: enc.codeTiers,
            libelle: 'Règlement facture ' + enc.piece,
            debit: 0,
            credit: enc.montant
        });
    });

    // 3. Rendu HTML
    container.innerHTML = `
        <style>
            .jrn-box { font-family: system-ui, -apple-system, sans-serif; }
            .jrn-card { background: #ffffff; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0; box-shadow: 0 1px 2px rgba(0,0,0,0.05); margin-bottom: 20px; }
            .jrn-tabs { display: flex; gap: 8px; margin-bottom: 20px; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; }
            .jrn-tab-btn { background: #f1f5f9; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-weight: 600; color: #475569; }
            .jrn-tab-btn.active { background: #2563eb; color: #ffffff; }
            
            .jrn-table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 13px; }
            .jrn-table th, .jrn-table td { padding: 10px; border-bottom: 1px solid #f1f5f9; text-align: left; }
            .jrn-table th { background: #f8fafc; font-weight: 600; color: #475569; }
            
            .jrn-btn-validate { background: #16a34a; color: white; border: none; padding: 6px 12px; border-radius: 4px; font-weight: 600; cursor: pointer; font-size: 12px; }
            .jrn-btn-validate:hover { background: #15803d; }
            .jrn-input-date { padding: 5px 8px; border: 1px solid #cbd5e1; border-radius: 4px; font-size: 13px; }
            .jrn-form-inline { display: flex; gap: 10px; align-items: center; margin-top: 10px; }
            .jrn-form-inline input { padding: 8px; border: 1px solid #cbd5e1; border-radius: 6px; }
        </style>

        <div class="jrn-box">
            <div style="margin-bottom: 20px;">
                <h2 style="margin:0; color:#0f172a; font-size:20px;">📘 Journaux Comptables & Suivi des Encaissements</h2>
                <p style="margin:4px 0 0 0; color:#64748b; font-size:14px;">Enregistrement des ventes et validation manuelle des encaissements en banque.</p>
            </div>

            <!-- GESTION DES TIERS -->
            <div class="jrn-card" style="border-left: 4px solid #2563eb;">
                <h3 style="margin-top:0; font-size:15px; color:#1e40af;">👥 Répertoire des Comptes de Tiers</h3>
                <div class="jrn-form-inline">
                    <input type="text" id="jrn-nouveau-tiers" placeholder="Nom du tiers (ex: Abadie, Saint-André...)" />
                    <button class="jrn-btn-validate" style="background:#2563eb;" onclick="window.ajouterTiers()">+ Créer le Tiers</button>
                </div>
                <div style="margin-top: 12px; display:flex; gap: 8px; flex-wrap: wrap;">
                    ${window.comptesTiers.map(t => `<span style="background:#e0e7ff; color:#3730a3; padding: 4px 10px; border-radius:12px; font-size:12px; font-weight:600;">${t.nom} (${t.code})</span>`).join('')}
                </div>
            </div>

            <!-- ONGLETS -->
            <div class="jrn-tabs">
                <button class="jrn-tab-btn active" id="btn-tab-attente" onclick="window.changerOngletJournal('attente')">⏳ Encaissements à Valider (${prestationsEnAttente.length})</button>
                <button class="jrn-tab-btn" id="btn-tab-ve" onclick="window.changerOngletJournal('ve')">Journal des Ventes (VE)</button>
                <button class="jrn-tab-btn" id="btn-tab-bq" onclick="window.changerOngletJournal('bq')">Journal de Banque (BQ)</button>
            </div>

            <!-- VUE 1 : ENCAISSEMENTS À VALIDER PAR L'UTILISATEUR -->
            <div id="vue-journal-attente" class="jrn-card">
                <h4 style="margin-top:0; color:#0f172a;">Prestations en attente de règlement</h4>
                <p style="color:#64748b; font-size:13px;">Sélectionne la date réelle à laquelle le virement a été reçu en banque puis valide.</p>
                ${window.genererTableauAttente(prestationsEnAttente)}
            </div>

            <!-- VUE 2 : JOURNAL DES VENTES (VE) -->
            <div id="vue-journal-ve" class="jrn-card" style="display:none;">
                <h4 style="margin-top:0; color:#0f172a;">Écritures du Journal des Ventes (VE)</h4>
                ${window.genererTableauJournal(ecrituresVE)}
            </div>

            <!-- VUE 3 : JOURNAL DE BANQUE (BQ) -->
            <div id="vue-journal-bq" class="jrn-card" style="display:none;">
                <h4 style="margin-top:0; color:#0f172a;">Écritures du Journal de Banque (BQ - Encaissements Validés)</h4>
                ${window.genererTableauJournal(ecrituresBQ)}
            </div>
        </div>
    `;
};

// Tableau des prestations en attente de validation
window.genererTableauAttente = function(liste) {
    if (liste.length === 0) {
        return `<p style="color:#16a34a; font-weight:600;">✅ Toutes les prestations enregistrées ont été encaissées.</p>`;
    }

    var hoy = new Date().toISOString().split('T')[0];

    var rows = liste.map(function(item) {
        return `
            <tr>
                <td>${item.datePrestation}</td>
                <td><strong>${item.nomTiers}</strong> <span style="color:#64748b; font-size:11px;">(${item.codeTiers})</span></td>
                <td>${item.label}</td>
                <td style="font-weight:bold; color:#1e293b;">${item.montant.toFixed(2)} €</td>
                <td>
                    <input type="date" id="date-enc-${item.txId}" class="jrn-input-date" value="${hoy}" />
                </td>
                <td>
                    <button class="jrn-btn-validate" onclick="window.validerEncaissementManuel('${item.txId}', '${item.nomTiers}', '${item.codeTiers}', ${item.montant}, '${item.piece}')">
                        ✓ Valider l'encaissement
                    </button>
                </td>
            </tr>
        `;
    }).join('');

    return `
        <table class="jrn-table">
            <thead>
                <tr>
                    <th>Date Prestation</th>
                    <th>Tiers</th>
                    <th>Libellé</th>
                    <th>Montant</th>
                    <th>Date d'encaissement Banque</th>
                    <th>Action</th>
                </tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>
    `;
};

// Action déclenchée PAR L'UTILISATEUR pour valider l'encaissement
window.validerEncaissementManuel = function(txId, nomTiers, codeTiers, montant, piece) {
    var inputDate = document.getElementById('date-enc-' + txId);
    var dateChoisie = inputDate ? inputDate.value : new Date().toISOString().split('T')[0];

    if (!dateChoisie) {
        alert("Veuillez sélectionner la date d'encaissement.");
        return;
    }

    // Enregistrement de l'encaissement manuellement validé
    window.encaissementsValides.push({
        txId: txId,
        nomTiers: nomTiers,
        codeTiers: codeTiers,
        montant: montant,
        piece: piece,
        dateEncaissement: dateChoisie
    });

    localStorage.setItem('encaissementsValides', JSON.stringify(window.encaissementsValides));

    // Rechargement de la vue
    window.initJournal();
};

// Générateur de tableau d'écritures
window.genererTableauJournal = function(ecritures) {
    if (ecritures.length === 0) {
        return `<p style="color:#94a3b8; font-style:italic;">Aucune écriture enregistrée dans ce journal.</p>`;
    }

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
                    <th>Date</th>
                    <th>Journal</th>
                    <th>N° Pièce</th>
                    <th>Compte</th>
                    <th>Libellé</th>
                    <th style="text-align:right;">Débit</th>
                    <th style="text-align:right;">Crédit</th>
                </tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>
    `;
};

window.changerOngletJournal = function(onglet) {
    document.getElementById('vue-journal-attente').style.display = onglet === 'attente' ? 'block' : 'none';
    document.getElementById('vue-journal-ve').style.display = onglet === 've' ? 'block' : 'none';
    document.getElementById('vue-journal-bq').style.display = onglet === 'bq' ? 'block' : 'none';
    
    document.getElementById('btn-tab-attente').classList.toggle('active', onglet === 'attente');
    document.getElementById('btn-tab-ve').classList.toggle('active', onglet === 've');
    document.getElementById('btn-tab-bq').classList.toggle('active', onglet === 'bq');
};

window.ajouterTiers = function() {
    var input = document.getElementById('jrn-nouveau-tiers');
    var nom = input ? input.value.trim() : '';
    if (!nom) return;

    var codeClean = nom.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    window.comptesTiers.push({
        id: Date.now().toString(),
        nom: nom,
        code: '411' + codeClean
    });
    localStorage.setItem('comptesTiers', JSON.stringify(window.comptesTiers));
    window.initJournal();
};

if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(window.initJournal, 100);
} else {
    document.addEventListener('DOMContentLoaded', window.initJournal);
}
