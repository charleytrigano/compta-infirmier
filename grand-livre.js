// ==========================================
// MODULE COMPTABLE : GRAND LIVRE DES COMPTES
// ==========================================

window.initGrandLivre = function() {
    // CIBLAGE STRICT : On cherche uniquement les conteneurs explicitement réservés au Grand Livre
    var container = document.getElementById('grandlivre-container') || 
                    document.getElementById('view-grandlivre') || 
                    document.getElementById('grand-livre-content');

    // Recherche alternative ciblée par texte dans les titres (sans toucher aux autres vues)
    if (!container) {
        var zones = document.querySelectorAll('[id*="grandlivre"], [id*="grand-livre"]');
        if (zones.length > 0) {
            container = zones[0];
        }
    }

    // Sécurité : Si aucun conteneur dédié n'est trouvé, on ne touche à rien pour préserver les autres onglets
    if (!container) {
        console.log("Grand Livre : En attente du conteneur spécifique (#grandlivre-container)");
        return;
    }

    window.afficherGrandLivre(container);
};

// Fonction d'analyse comptable
window.analyserDepenseGL = function(categorie, description, dateOp) {
    var catClean = (categorie || '').trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    var descClean = (description || '').trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    var texte = catClean || descClean;

    var anneeEnCours = new Date().getFullYear();
    var anneeTx = dateOp ? new Date(dateOp).getFullYear() : anneeEnCours;
    var isAnneeNMinus1 = (anneeTx < anneeEnCours) || texte.includes('n-1') || texte.includes('regul');
    var mentionExercice = isAnneeNMinus1 ? " (Charges année N-1)" : " (Charges année N)";

    // CARPIMKO
    if (texte.includes('carpimko') || texte.includes('carp') || texte.includes('retraite')) {
        return { charge: '646200', libelleCharge: 'Cotisations Retraite CARPIMKO' + mentionExercice, tiers: '438CARPIMKO', nomTiers: 'CARPIMKO' };
    }
    // URSSAF
    if (texte.includes('urssaf') || texte.includes('urss') || texte.includes('cotis')) {
        return { charge: '646100', libelleCharge: 'Cotisations Sociales URSSAF' + mentionExercice, tiers: '438URSSAF', nomTiers: 'URSSAF' };
    }
    // IMPOTS
    if (texte.includes('impot') || texte.includes('taxe') || texte.includes('cfe') || texte.includes('pas')) {
        return { charge: '635000', libelleCharge: 'Impôts et Taxes' + mentionExercice, tiers: '447IMPOTS', nomTiers: 'Impôts' };
    }
    // AUTRES
    var nomAffichage = categorie || description || 'Fournisseur';
    var codeClean = nomAffichage.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().substring(0, 8);
    return { charge: '606000', libelleCharge: 'Achats / Fournitures - ' + nomAffichage, tiers: '401' + (codeClean || 'FOURNISSEUR'), nomTiers: nomAffichage };
};

// Generateur d'écritures brutes
window.obtenirToutesEcritures = function() {
    var transactions = window.allTransactions || [];
    var encaissementsValides = JSON.parse(localStorage.getItem('encaissementsValides')) || [];
    var decaissementsValides = JSON.parse(localStorage.getItem('decaissementsValides')) || [];
    
    var ecritures = [];

    // 1. Écritures HA et VE
    transactions.forEach(function(tx, index) {
        var montant = parseFloat(tx.amount) || 0;
        var type = (tx.type || '').toLowerCase();
        var categorie = tx.categorie || tx.category || '';
        var description = tx.label || tx.description || tx.libelle || 'Opération';
        var dateOp = tx.date || new Date().toISOString().split('T')[0];

        if (type === 'recette' || (type === '' && montant > 0)) {
            var valM = Math.abs(montant);
            var codeTiersC = '411' + description.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().substring(0, 8);
            ecritures.push({ compte: codeTiersC, nomCompte: 'Client - ' + description, date: dateOp, journal: 'VE', piece: 'FAC-' + (1000 + index), libelle: 'Facture Honoraires', debit: valM, credit: 0 });
            ecritures.push({ compte: '706000', nomCompte: 'Honoraires BNC', date: dateOp, journal: 'VE', piece: 'FAC-' + (1000 + index), libelle: 'Prestation - ' + description, debit: 0, credit: valM });
        } else if (type === 'depense' || montant < 0 || (type === '' && montant < 0)) {
            var valD = Math.abs(montant);
            var analyse = window.analyserDepenseGL(categorie, description, dateOp);

            ecritures.push({ compte: analyse.charge, nomCompte: analyse.libelleCharge, date: dateOp, journal: 'HA', piece: 'DEP-' + (2000 + index), libelle: analyse.libelleCharge, debit: valD, credit: 0 });
            ecritures.push({ compte: analyse.tiers, nomCompte: 'Tiers - ' + analyse.nomTiers, date: dateOp, journal: 'HA', piece: 'DEP-' + (2000 + index), libelle: 'Appel / Facture ' + analyse.nomTiers, debit: 0, credit: valD });
        }
    });

    // 2. Écritures Banque (BQ)
    encaissementsValides.forEach(function(enc, index) {
        ecritures.push({ compte: '512000', nomCompte: 'Banque (Compte Courant)', date: enc.dateBQ, journal: 'BQ', piece: 'ENC-' + (5000 + index), libelle: 'Encaissement ' + enc.nomTiers, debit: enc.montant, credit: 0 });
        ecritures.push({ compte: enc.codeTiers, nomCompte: 'Client - ' + enc.nomTiers, date: enc.dateBQ, journal: 'BQ', piece: 'ENC-' + (5000 + index), libelle: 'Règlement ' + enc.piece, debit: 0, credit: enc.montant });
    });

    decaissementsValides.forEach(function(dec, index) {
        ecritures.push({ compte: dec.codeTiers, nomCompte: 'Tiers - ' + dec.nomTiers, date: dec.dateBQ, journal: 'BQ', piece: 'DEC-' + (6000 + index), libelle: 'Règlement ' + dec.nomTiers, debit: dec.montant, credit: 0 });
        ecritures.push({ compte: '512000', nomCompte: 'Banque (Compte Courant)', date: dec.dateBQ, journal: 'BQ', piece: 'DEC-' + (6000 + index), libelle: 'Prélèvement / Virement', debit: 0, credit: dec.montant });
    });

    return ecritures;
};

// Rendu du Grand Livre
window.afficherGrandLivre = function(container) {
    var toutesEcritures = window.obtenirToutesEcritures();

    var comptesMap = {};
    toutesEcritures.forEach(function(e) {
        if (!comptesMap[e.compte]) {
            comptesMap[e.compte] = {
                numCompte: e.compte,
                nomCompte: e.nomCompte,
                ecritures: [],
                totalDebit: 0,
                totalCredit: 0
            };
        }
        comptesMap[e.compte].ecritures.push(e);
        comptesMap[e.compte].totalDebit += e.debit;
        comptesMap[e.compte].totalCredit += e.credit;
    });

    var listeComptesTries = Object.keys(comptesMap).sort();

    var htmlComptes = listeComptesTries.map(function(num) {
        var c = comptesMap[num];
        var solde = c.totalDebit - c.totalCredit;
        var isDebiteur = solde >= 0;

        var rows = c.ecritures.map(function(e) {
            return `
                <tr>
                    <td>${e.date}</td>
                    <td><span style="background:#f1f5f9; padding:2px 6px; border-radius:4px; font-weight:bold;">${e.journal}</span></td>
                    <td>${e.piece}</td>
                    <td>${e.libelle}</td>
                    <td style="text-align:right;">${e.debit > 0 ? e.debit.toFixed(2) + ' €' : '-'}</td>
                    <td style="text-align:right;">${e.credit > 0 ? e.credit.toFixed(2) + ' €' : '-'}</td>
                </tr>
            `;
        }).join('');

        return `
            <div class="gl-card-compte" data-compte="${c.numCompte}" data-nom="${c.nomCompte.toLowerCase()}">
                <div class="gl-header-compte">
                    <div>
                        <span class="gl-badge-num">${c.numCompte}</span>
                        <strong style="font-size: 15px; margin-left: 8px;">${c.nomCompte}</strong>
                    </div>
                    <div style="text-align: right;">
                        <small style="color:#64748b;">Solde : </small>
                        <strong style="color: ${isDebiteur ? '#16a34a' : '#dc2626'}; font-size: 14px;">
                            ${Math.abs(solde).toFixed(2)} € ${isDebiteur ? '(Débiteur)' : '(Créditeur)'}
                        </strong>
                    </div>
                </div>

                <table class="jrn-table">
                    <thead>
                        <tr>
                            <th>Date</th><th>Journal</th><th>Pièce</th><th>Libellé</th><th style="text-align:right;">Débit</th><th style="text-align:right;">Crédit</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                    <tfoot>
                        <tr style="background:#f8fafc; font-weight:bold;">
                            <td colspan="4" style="text-align:right;">Totaux Compte ${c.numCompte} :</td>
                            <td style="text-align:right; color:#2563eb;">${c.totalDebit.toFixed(2)} €</td>
                            <td style="text-align:right; color:#2563eb;">${c.totalCredit.toFixed(2)} €</td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        `;
    }).join('');

    container.innerHTML = `
        <style>
            .gl-box { font-family: system-ui, -apple-system, sans-serif; }
            .gl-card-compte { background: #ffffff; padding: 18px; border-radius: 8px; border: 1px solid #e2e8f0; margin-bottom: 20px; box-shadow: 0 1px 2px rgba(0,0,0,0.05); }
            .gl-header-compte { display: flex; justify-content: space-between; align-items: center; padding-bottom: 12px; border-bottom: 2px solid #cbd5e1; margin-bottom: 10px; }
            .gl-badge-num { background: #2563eb; color: #ffffff; padding: 4px 10px; border-radius: 6px; font-weight: bold; font-size: 14px; }
            .gl-search { width: 100%; padding: 10px; border: 1px solid #cbd5e1; border-radius: 6px; margin-bottom: 20px; font-size: 14px; }
        </style>

        <div class="gl-box">
            <h2>📖 Grand Livre des Comptes</h2>
            <input type="text" class="gl-search" placeholder="🔍 Rechercher un compte (ex: 646100, URSSAF, CARPIMKO, 512000)..." onkeyup="window.filtrerGrandLivre(this.value)">

            <div id="gl-liste-comptes">
                ${htmlComptes || '<p style="color:#64748b;">Aucune écriture comptable disponible.</p>'}
            </div>
        </div>
    `;
};

window.filtrerGrandLivre = function(texte) {
    var query = (texte || '').toLowerCase().trim();
    var cartes = document.querySelectorAll('.gl-card-compte');

    cartes.forEach(function(card) {
        var num = card.getAttribute('data-compte').toLowerCase();
        var nom = card.getAttribute('data-nom');

        if (num.includes(query) || nom.includes(query)) {
            card.style.display = 'block';
        } else {
            card.style.display = 'none';
        }
    });
};

if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(window.initGrandLivre, 100);
} else {
    document.addEventListener('DOMContentLoaded', window.initGrandLivre);
}// ==========================================
// MODULE COMPTABLE : GRAND LIVRE DES COMPTES
// ==========================================

window.initGrandLivre = function() {
    // CIBLAGE STRICT : On cherche uniquement les conteneurs explicitement réservés au Grand Livre
    var container = document.getElementById('grandlivre-container') || 
                    document.getElementById('view-grandlivre') || 
                    document.getElementById('grand-livre-content');

    // Recherche alternative ciblée par texte dans les titres (sans toucher aux autres vues)
    if (!container) {
        var zones = document.querySelectorAll('[id*="grandlivre"], [id*="grand-livre"]');
        if (zones.length > 0) {
            container = zones[0];
        }
    }

    // Sécurité : Si aucun conteneur dédié n'est trouvé, on ne touche à rien pour préserver les autres onglets
    if (!container) {
        console.log("Grand Livre : En attente du conteneur spécifique (#grandlivre-container)");
        return;
    }

    window.afficherGrandLivre(container);
};

// Fonction d'analyse comptable
window.analyserDepenseGL = function(categorie, description, dateOp) {
    var catClean = (categorie || '').trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    var descClean = (description || '').trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    var texte = catClean || descClean;

    var anneeEnCours = new Date().getFullYear();
    var anneeTx = dateOp ? new Date(dateOp).getFullYear() : anneeEnCours;
    var isAnneeNMinus1 = (anneeTx < anneeEnCours) || texte.includes('n-1') || texte.includes('regul');
    var mentionExercice = isAnneeNMinus1 ? " (Charges année N-1)" : " (Charges année N)";

    // CARPIMKO
    if (texte.includes('carpimko') || texte.includes('carp') || texte.includes('retraite')) {
        return { charge: '646200', libelleCharge: 'Cotisations Retraite CARPIMKO' + mentionExercice, tiers: '438CARPIMKO', nomTiers: 'CARPIMKO' };
    }
    // URSSAF
    if (texte.includes('urssaf') || texte.includes('urss') || texte.includes('cotis')) {
        return { charge: '646100', libelleCharge: 'Cotisations Sociales URSSAF' + mentionExercice, tiers: '438URSSAF', nomTiers: 'URSSAF' };
    }
    // IMPOTS
    if (texte.includes('impot') || texte.includes('taxe') || texte.includes('cfe') || texte.includes('pas')) {
        return { charge: '635000', libelleCharge: 'Impôts et Taxes' + mentionExercice, tiers: '447IMPOTS', nomTiers: 'Impôts' };
    }
    // AUTRES
    var nomAffichage = categorie || description || 'Fournisseur';
    var codeClean = nomAffichage.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().substring(0, 8);
    return { charge: '606000', libelleCharge: 'Achats / Fournitures - ' + nomAffichage, tiers: '401' + (codeClean || 'FOURNISSEUR'), nomTiers: nomAffichage };
};

// Generateur d'écritures brutes
window.obtenirToutesEcritures = function() {
    var transactions = window.allTransactions || [];
    var encaissementsValides = JSON.parse(localStorage.getItem('encaissementsValides')) || [];
    var decaissementsValides = JSON.parse(localStorage.getItem('decaissementsValides')) || [];
    
    var ecritures = [];

    // 1. Écritures HA et VE
    transactions.forEach(function(tx, index) {
        var montant = parseFloat(tx.amount) || 0;
        var type = (tx.type || '').toLowerCase();
        var categorie = tx.categorie || tx.category || '';
        var description = tx.label || tx.description || tx.libelle || 'Opération';
        var dateOp = tx.date || new Date().toISOString().split('T')[0];

        if (type === 'recette' || (type === '' && montant > 0)) {
            var valM = Math.abs(montant);
            var codeTiersC = '411' + description.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().substring(0, 8);
            ecritures.push({ compte: codeTiersC, nomCompte: 'Client - ' + description, date: dateOp, journal: 'VE', piece: 'FAC-' + (1000 + index), libelle: 'Facture Honoraires', debit: valM, credit: 0 });
            ecritures.push({ compte: '706000', nomCompte: 'Honoraires BNC', date: dateOp, journal: 'VE', piece: 'FAC-' + (1000 + index), libelle: 'Prestation - ' + description, debit: 0, credit: valM });
        } else if (type === 'depense' || montant < 0 || (type === '' && montant < 0)) {
            var valD = Math.abs(montant);
            var analyse = window.analyserDepenseGL(categorie, description, dateOp);

            ecritures.push({ compte: analyse.charge, nomCompte: analyse.libelleCharge, date: dateOp, journal: 'HA', piece: 'DEP-' + (2000 + index), libelle: analyse.libelleCharge, debit: valD, credit: 0 });
            ecritures.push({ compte: analyse.tiers, nomCompte: 'Tiers - ' + analyse.nomTiers, date: dateOp, journal: 'HA', piece: 'DEP-' + (2000 + index), libelle: 'Appel / Facture ' + analyse.nomTiers, debit: 0, credit: valD });
        }
    });

    // 2. Écritures Banque (BQ)
    encaissementsValides.forEach(function(enc, index) {
        ecritures.push({ compte: '512000', nomCompte: 'Banque (Compte Courant)', date: enc.dateBQ, journal: 'BQ', piece: 'ENC-' + (5000 + index), libelle: 'Encaissement ' + enc.nomTiers, debit: enc.montant, credit: 0 });
        ecritures.push({ compte: enc.codeTiers, nomCompte: 'Client - ' + enc.nomTiers, date: enc.dateBQ, journal: 'BQ', piece: 'ENC-' + (5000 + index), libelle: 'Règlement ' + enc.piece, debit: 0, credit: enc.montant });
    });

    decaissementsValides.forEach(function(dec, index) {
        ecritures.push({ compte: dec.codeTiers, nomCompte: 'Tiers - ' + dec.nomTiers, date: dec.dateBQ, journal: 'BQ', piece: 'DEC-' + (6000 + index), libelle: 'Règlement ' + dec.nomTiers, debit: dec.montant, credit: 0 });
        ecritures.push({ compte: '512000', nomCompte: 'Banque (Compte Courant)', date: dec.dateBQ, journal: 'BQ', piece: 'DEC-' + (6000 + index), libelle: 'Prélèvement / Virement', debit: 0, credit: dec.montant });
    });

    return ecritures;
};

// Rendu du Grand Livre
window.afficherGrandLivre = function(container) {
    var toutesEcritures = window.obtenirToutesEcritures();

    var comptesMap = {};
    toutesEcritures.forEach(function(e) {
        if (!comptesMap[e.compte]) {
            comptesMap[e.compte] = {
                numCompte: e.compte,
                nomCompte: e.nomCompte,
                ecritures: [],
                totalDebit: 0,
                totalCredit: 0
            };
        }
        comptesMap[e.compte].ecritures.push(e);
        comptesMap[e.compte].totalDebit += e.debit;
        comptesMap[e.compte].totalCredit += e.credit;
    });

    var listeComptesTries = Object.keys(comptesMap).sort();

    var htmlComptes = listeComptesTries.map(function(num) {
        var c = comptesMap[num];
        var solde = c.totalDebit - c.totalCredit;
        var isDebiteur = solde >= 0;

        var rows = c.ecritures.map(function(e) {
            return `
                <tr>
                    <td>${e.date}</td>
                    <td><span style="background:#f1f5f9; padding:2px 6px; border-radius:4px; font-weight:bold;">${e.journal}</span></td>
                    <td>${e.piece}</td>
                    <td>${e.libelle}</td>
                    <td style="text-align:right;">${e.debit > 0 ? e.debit.toFixed(2) + ' €' : '-'}</td>
                    <td style="text-align:right;">${e.credit > 0 ? e.credit.toFixed(2) + ' €' : '-'}</td>
                </tr>
            `;
        }).join('');

        return `
            <div class="gl-card-compte" data-compte="${c.numCompte}" data-nom="${c.nomCompte.toLowerCase()}">
                <div class="gl-header-compte">
                    <div>
                        <span class="gl-badge-num">${c.numCompte}</span>
                        <strong style="font-size: 15px; margin-left: 8px;">${c.nomCompte}</strong>
                    </div>
                    <div style="text-align: right;">
                        <small style="color:#64748b;">Solde : </small>
                        <strong style="color: ${isDebiteur ? '#16a34a' : '#dc2626'}; font-size: 14px;">
                            ${Math.abs(solde).toFixed(2)} € ${isDebiteur ? '(Débiteur)' : '(Créditeur)'}
                        </strong>
                    </div>
                </div>

                <table class="jrn-table">
                    <thead>
                        <tr>
                            <th>Date</th><th>Journal</th><th>Pièce</th><th>Libellé</th><th style="text-align:right;">Débit</th><th style="text-align:right;">Crédit</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                    <tfoot>
                        <tr style="background:#f8fafc; font-weight:bold;">
                            <td colspan="4" style="text-align:right;">Totaux Compte ${c.numCompte} :</td>
                            <td style="text-align:right; color:#2563eb;">${c.totalDebit.toFixed(2)} €</td>
                            <td style="text-align:right; color:#2563eb;">${c.totalCredit.toFixed(2)} €</td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        `;
    }).join('');

    container.innerHTML = `
        <style>
            .gl-box { font-family: system-ui, -apple-system, sans-serif; }
            .gl-card-compte { background: #ffffff; padding: 18px; border-radius: 8px; border: 1px solid #e2e8f0; margin-bottom: 20px; box-shadow: 0 1px 2px rgba(0,0,0,0.05); }
            .gl-header-compte { display: flex; justify-content: space-between; align-items: center; padding-bottom: 12px; border-bottom: 2px solid #cbd5e1; margin-bottom: 10px; }
            .gl-badge-num { background: #2563eb; color: #ffffff; padding: 4px 10px; border-radius: 6px; font-weight: bold; font-size: 14px; }
            .gl-search { width: 100%; padding: 10px; border: 1px solid #cbd5e1; border-radius: 6px; margin-bottom: 20px; font-size: 14px; }
        </style>

        <div class="gl-box">
            <h2>📖 Grand Livre des Comptes</h2>
            <input type="text" class="gl-search" placeholder="🔍 Rechercher un compte (ex: 646100, URSSAF, CARPIMKO, 512000)..." onkeyup="window.filtrerGrandLivre(this.value)">

            <div id="gl-liste-comptes">
                ${htmlComptes || '<p style="color:#64748b;">Aucune écriture comptable disponible.</p>'}
            </div>
        </div>
    `;
};

window.filtrerGrandLivre = function(texte) {
    var query = (texte || '').toLowerCase().trim();
    var cartes = document.querySelectorAll('.gl-card-compte');

    cartes.forEach(function(card) {
        var num = card.getAttribute('data-compte').toLowerCase();
        var nom = card.getAttribute('data-nom');

        if (num.includes(query) || nom.includes(query)) {
            card.style.display = 'block';
        } else {
            card.style.display = 'none';
        }
    });
};

if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(window.initGrandLivre, 100);
} else {
    document.addEventListener('DOMContentLoaded', window.initGrandLivre);
}
