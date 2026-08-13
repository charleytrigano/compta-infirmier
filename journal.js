// ==========================================
// MODULE COMPTABLE : JOURNAUX & COMPTES TIERS
// ==========================================

// Liste par défaut des comptes de tiers (stockée en mémoire ou localStorage)
window.comptesTiers = JSON.parse(localStorage.getItem('comptesTiers')) || [
    { id: '1', nom: 'Abadie', code: '411ABADIE' },
    { id: '2', nom: 'Saint-André', code: '411STANDRE' }
];

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

    // 1. Génération automatique des écritures de Ventes (VE) et Banque (BQ) avec Imputation
    var ecrituresVE = [];
    var ecrituresBQ = [];

    transactions.forEach(function(tx, index) {
        var montant = parseFloat(tx.amount) || 0;
        var type = (tx.type || '').toLowerCase();
        var label = (tx.label || tx.description || '').trim();
        var dateOp = tx.date || new Date().toISOString().split('T')[0];

        // Traitement des recettes (Virements / Encaissements)
        if (type === 'recette' || montant > 0) {
            var valMontant = Math.abs(montant);

            // Recherche automatique du compte de tiers dans le libellé du virement
            var tiersTrouve = window.comptesTiers.find(function(t) {
                return label.toLowerCase().includes(t.nom.toLowerCase());
            });

            var codeTiers = tiersTrouve ? tiersTrouve.code : '411DIVERS';
            var nomTiers = tiersTrouve ? tiersTrouve.nom : 'Tiers Divers';

            // Ecriture 1 : Journal des Ventes (Constatation de la recette)
            ecrituresVE.push({
                date: dateOp,
                journal: 'VE',
                piece: 'FAC-' + (1000 + index),
                compte: codeTiers,
                libelle: 'Facturation - ' + nomTiers,
                debit: valMontant,
                credit: 0
            });
            ecrituresVE.push({
                date: dateOp,
                journal: 'VE',
                piece: 'FAC-' + (1000 + index),
                compte: '706000',
                libelle: 'Honoraires / Prestations BNC',
                debit: 0,
                credit: valMontant
            });

            // Ecriture 2 : Journal de Banque (Encaissement & Imputation automatique)
            ecrituresBQ.push({
                date: dateOp,
                journal: 'BQ',
                piece: 'VIR-' + (5000 + index),
                compte: '512000',
                libelle: 'Virement reçu - ' + label,
                debit: valMontant,
                credit: 0
            });
            ecrituresBQ.push({
                date: dateOp,
                journal: 'BQ',
                piece: 'VIR-' + (5000 + index),
                compte: codeTiers,
                libelle: 'Imputation encaissement - ' + nomTiers,
                debit: 0,
                credit: valMontant
            });
        }
    });

    // 2. Construction de l'interface graphique
    container.innerHTML = `
        <style>
            .jrn-box { font-family: system-ui, -apple-system, sans-serif; }
            .jrn-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 10px; }
            .jrn-tabs { display: flex; gap: 8px; margin-bottom: 20px; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; }
            .jrn-tab-btn { background: #f1f5f9; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-weight: 600; color: #475569; }
            .jrn-tab-btn.active { background: #2563eb; color: #ffffff; }
            
            .jrn-card { background: #ffffff; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0; box-shadow: 0 1px 2px rgba(0,0,0,0.05); margin-bottom: 20px; }
            .jrn-table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 13px; }
            .jrn-table th, .jrn-table td { padding: 8px 10px; border-bottom: 1px solid #f1f5f9; text-align: left; }
            .jrn-table th { background: #f8fafc; font-weight: 600; color: #475569; }
            
            .jrn-form-inline { display: flex; gap: 10px; align-items: center; margin-top: 10px; flex-wrap: wrap; }
            .jrn-form-inline input { padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 14px; }
            .jrn-btn-add { background: #16a34a; color: white; border: none; padding: 8px 16px; border-radius: 6px; font-weight: 600; cursor: pointer; }
        </style>

        <div class="jrn-box">
            <div class="jrn-header">
                <div>
                    <h2 style="margin:0; color:#0f172a; font-size:20px;">📘 Journaux Comptables & Imputation</h2>
                    <p style="margin:4px 0 0 0; color:#64748b; font-size:14px;">Gestion du Journal des Ventes, de Banque et des Comptes de Tiers.</p>
                </div>
            </div>

            <!-- GESTION DES TIERS -->
            <div class="jrn-card" style="border-left: 4px solid #16a34a;">
                <h3 style="margin-top:0; font-size:15px; color:#166534;">👥 Répertoire des Comptes de Tiers (Clients / Mutuelles)</h3>
                <div class="jrn-form-inline">
                    <input type="text" id="jrn-nouveau-tiers" placeholder="Nom du tiers (ex: Abadie, MGEN...)" />
                    <button class="jrn-btn-add" onclick="window.ajouterTiers()">+ Ajouter le Tiers</button>
                </div>
                <div style="margin-top: 12px; display:flex; gap: 8px; flex-wrap: wrap;" id="jrn-liste-tiers">
                    ${window.comptesTiers.map(t => `<span style="background:#e0e7ff; color:#3730a3; padding: 4px 10px; border-radius:12px; font-size:12px; font-weight:600;">${t.nom} (${t.code})</span>`).join('')}
                </div>
            </div>

            <!-- ONGLETS DE NAVIGATION JOURNAUX -->
            <div class="jrn-tabs">
                <button class="jrn-tab-btn active" id="btn-tab-ve" onclick="window.changerOngletJournal('ve')">Journal des Ventes (VE)</button>
                <button class="jrn-tab-btn" id="btn-tab-bq" onclick="window.changerOngletJournal('bq')">Journal de Banque (BQ)</button>
            </div>

            <!-- TABLEAU DES ÉCRITURES -->
            <div class="jrn-card">
                <div id="vue-journal-ve">
                    <h4 style="margin:0 0 10px 0; color:#1e293b;">Opérations du Journal des Ventes (VE)</h4>
                    ${window.genererTableauJournal(ecrituresVE)}
                </div>
                <div id="vue-journal-bq" style="display:none;">
                    <h4 style="margin:0 0 10px 0; color:#1e293b;">Encaissements et Imputations - Journal de Banque (BQ)</h4>
                    ${window.genererTableauJournal(ecrituresBQ)}
                </div>
            </div>
        </div>
    `;
};

// Fonction utilitaire pour générer la table HTML des écritures
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
                    <th>Libellé de l'écriture</th>
                    <th style="text-align:right;">Débit</th>
                    <th style="text-align:right;">Crédit</th>
                </tr>
            </thead>
            <tbody>
                ${rows}
            </tbody>
        </table>
    `;
};

// Bascule entre l'onglet Ventes et Banque
window.changerOngletJournal = function(onglet) {
    document.getElementById('vue-journal-ve').style.display = onglet === 've' ? 'block' : 'none';
    document.getElementById('vue-journal-bq').style.display = onglet === 'bq' ? 'block' : 'none';
    
    document.getElementById('btn-tab-ve').classList.toggle('active', onglet === 've');
    document.getElementById('btn-tab-bq').classList.toggle('active', onglet === 'bq');
};

// Ajout dynamique d'un nouveau tiers
window.ajouterTiers = function() {
    var input = document.getElementById('jrn-nouveau-tiers');
    var nom = input ? input.value.trim() : '';

    if (!nom) return;

    var codeClean = nom.replace(/[^a-zA-Z0-0]/g, '').toUpperCase();
    var nouveauTiers = {
        id: Date.now().toString(),
        nom: nom,
        code: '411' + codeClean
    };

    window.comptesTiers.push(nouveauTiers);
    localStorage.setItem('comptesTiers', JSON.stringify(window.comptesTiers));

    // Rechargement du module
    window.initJournal();
};

// Exécution au chargement
if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(window.initJournal, 100);
} else {
    document.addEventListener('DOMContentLoaded', window.initJournal);
}
