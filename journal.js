/* ==========================================================================
   MODULE JOURNAL, SOUS-ONGLETS & VALIDATION DE COMPTABILITÉ
   ========================================================================== */

// Sous-onglet actif par défaut
window.sousOngletJournalActif = window.sousOngletJournalActif || 'encaissements-valider';

/**
 * Point d'entrée principal pour charger le Journal
 */
window.afficherJournal = function() {
    window.injecterBarreOngletsJournal();
    window.mettreAJourCompteursJournal();
    window.afficherJournalSelonOnglet(window.sousOngletJournalActif);
};

/**
 * Injecte la barre de sous-onglets au-dessus du tableau si elle n'est pas présente
 */
window.injecterBarreOngletsJournal = function() {
    var container = document.getElementById('journal-container') || document.querySelector('.journal-section') || document.getElementById('vue-journal');
    if (!container) return;

    var barreExistante = document.getElementById('barre-sous-onglets-journal');
    if (!barreExistante) {
        var divNav = document.createElement('div');
        divNav.id = 'barre-sous-onglets-journal';
        divNav.style.cssText = 'display: flex; gap: 10px; margin-bottom: 20px; flex-wrap: wrap; align-items: center;';
        divNav.innerHTML = `
            <button id="btn-tab-encaissements" onclick="window.changerSousOngletJournal('encaissements-valider', this)" style="padding: 8px 16px; border-radius: 8px; border: 1px solid #cbd5e1; background: #2563eb; color: #fff; font-weight: 600; cursor: pointer;">
                🟢 Encaissements à Valider
            </button>
            <button id="btn-tab-depenses" onclick="window.changerSousOngletJournal('depenses-regler', this)" style="padding: 8px 16px; border-radius: 8px; border: 1px solid #cbd5e1; background: #f8fafc; color: #334155; font-weight: 600; cursor: pointer;">
                🔴 Dépenses à Régler
            </button>
            <button id="btn-tab-ventes" onclick="window.changerSousOngletJournal('ventes-ve', this)" style="padding: 8px 16px; border-radius: 8px; border: 1px solid #cbd5e1; background: #f8fafc; color: #334155; font-weight: 600; cursor: pointer;">
                Journal Ventes (VE)
            </button>
            <button id="btn-tab-depenses-ha" onclick="window.changerSousOngletJournal('depenses-ha', this)" style="padding: 8px 16px; border-radius: 8px; border: 1px solid #cbd5e1; background: #f8fafc; color: #334155; font-weight: 600; cursor: pointer;">
                Journal Dépenses (HA)
            </button>
            <button id="btn-tab-banque" onclick="window.changerSousOngletJournal('banque-bq', this)" style="padding: 8px 16px; border-radius: 8px; border: 1px solid #cbd5e1; background: #f8fafc; color: #334155; font-weight: 600; cursor: pointer;">
                Journal Banque (BQ)
            </button>
        `;
        container.insertBefore(divNav, container.firstChild);
    }
};

/**
 * Calcule et rafraîchit les compteurs (11 encaissements, 1 dépense)
 */
window.mettreAJourCompteursJournal = function() {
    var liste = window.transactions || [];

    var encaissementsAValider = liste.filter(function(tx) {
        var typeRaw = (tx.type || '').toString().toLowerCase();
        return (typeRaw.includes('recette') || typeRaw.includes('encaissement')) &&
               (tx.encaisse === false || tx.encaisse === undefined || tx.encaisse === null);
    });

    var depensesARegler = liste.filter(function(tx) {
        var typeRaw = (tx.type || '').toString().toLowerCase();
        return (typeRaw.includes('dépense') || typeRaw.includes('depense')) &&
               (tx.encaisse === false || tx.encaisse === undefined || tx.encaisse === null);
    });

    var btnEnc = document.getElementById('btn-tab-encaissements') || document.getElementById('btn-encaissements-valider');
    if (btnEnc) btnEnc.innerHTML = `🟢 Encaissements à Valider (${encaissementsAValider.length})`;

    var btnDep = document.getElementById('btn-tab-depenses') || document.getElementById('btn-depenses-regler');
    if (btnDep) btnDep.innerHTML = `🔴 Dépenses à Régler (${depensesARegler.length})`;
};

/**
 * Change le sous-onglet actif
 */
window.changerSousOngletJournal = function(nomOnglet, btnElement) {
    window.sousOngletJournalActif = nomOnglet;

    var barre = document.getElementById('barre-sous-onglets-journal') || document;
    var boutons = barre.querySelectorAll('button');
    boutons.forEach(function(b) {
        b.style.backgroundColor = '#f8fafc';
        b.style.color = '#334155';
    });

    if (btnElement) {
        btnElement.style.backgroundColor = '#2563eb';
        btnElement.style.color = '#ffffff';
    }

    window.afficherJournalSelonOnglet(nomOnglet);
};

/**
 * Filtre les transactions selon l'onglet choisi
 */
window.afficherJournalSelonOnglet = function(nomOnglet) {
    var tbody = document.getElementById('body-tableau-journal');
    if (!tbody) return;

    var liste = window.transactions || [];

    if (nomOnglet === 'encaissements-valider') {
        var aValider = liste.filter(function(tx) {
            var typeRaw = (tx.type || '').toString().toLowerCase();
            return (typeRaw.includes('recette') || typeRaw.includes('encaissement')) &&
                   (tx.encaisse === false || tx.encaisse === undefined || tx.encaisse === null);
        });
        window.rendreTableauJournalValider(tbody, aValider, 'recette');
    } 
    else if (nomOnglet === 'depenses-regler') {
        var aRegler = liste.filter(function(tx) {
            var typeRaw = (tx.type || '').toString().toLowerCase();
            return (typeRaw.includes('dépense') || typeRaw.includes('depense')) &&
                   (tx.encaisse === false || tx.encaisse === undefined || tx.encaisse === null);
        });
        window.rendreTableauJournalValider(tbody, aRegler, 'depense');
    }
    else if (nomOnglet === 'ventes-ve') {
        var recettes = liste.filter(function(tx) {
            var typeRaw = (tx.type || '').toString().toLowerCase();
            return typeRaw.includes('recette') || typeRaw.includes('encaissement');
        });
        window.rendreTableauJournalComplet(tbody, recettes, 'VE');
    }
    else if (nomOnglet === 'depenses-ha') {
        var depenses = liste.filter(function(tx) {
            var typeRaw = (tx.type || '').toString().toLowerCase();
            return typeRaw.includes('dépense') || typeRaw.includes('depense');
        });
        window.rendreTableauJournalComplet(tbody, depenses, 'HA');
    }
    else {
        window.rendreTableauJournalComplet(tbody, liste, 'BQ');
    }
};

/**
 * Rendu pour les onglets de validation (Alignement exact 6 colonnes)
 */
window.rendreTableauJournalValider = function(tbody, liste, typeAction) {
    if (!tbody) return;

    if (!Array.isArray(liste) || liste.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:#64748b; padding:20px;">Aucune opération en attente.</td></tr>`;
        return;
    }

    var html = '';
    liste.forEach(function(tx) {
        var valMontant = tx.amount !== undefined && tx.amount !== null ? tx.amount : (tx.montant || 0);
        var valCat = tx.category || tx.categorie || tx.categorie_libelle || tx.compte || '-';
        var valDesc = tx.description || tx.libelle || '';
        var montantFormatted = parseFloat(valMontant || 0).toFixed(2) + ' €';

        var colDebit = (typeAction === 'depense') ? `<span style="color:#dc2626; font-weight:600;">${montantFormatted}</span>` : '-';
        var colCredit = (typeAction === 'recette') ? `<span style="color:#16a34a; font-weight:600;">${montantFormatted}</span>` : '-';

        html += `
            <tr>
                <td>${tx.date || ''}</td>
                <td>${valCat}</td>
                <td>${valDesc}</td>
                <td>${colDebit}</td>
                <td>${colCredit}</td>
                <td>
                    <button onclick="window.validerOperationJournal('${tx.id}')" style="background:#16a34a; color:#ffffff; border:none; padding:6px 12px; border-radius:6px; cursor:pointer; font-size:12px; font-weight:600;">
                        ✓ Valider ${typeAction === 'recette' ? "l'encaissement" : 'le règlement'}
                    </button>
                </td>
            </tr>
        `;
    });

    tbody.innerHTML = html;
};

/**
 * Rendu pour les journaux complets (VE, HA, BQ)
 */
window.rendreTableauJournalComplet = function(tbody, liste, codeJournal) {
    if (!tbody) return;

    if (!Array.isArray(liste) || liste.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:#64748b; padding:20px;">Aucune écriture enregistrée.</td></tr>`;
        return;
    }

    var html = '';
    liste.forEach(function(tx) {
        var typeRaw = (tx.type || '').toString().toLowerCase();
        var isRecette = typeRaw.includes('recette') || typeRaw.includes('encaissement');

        var valMontant = tx.amount !== undefined && tx.amount !== null ? tx.amount : (tx.montant || 0);
        var valCat = tx.category || tx.categorie || tx.categorie_libelle || tx.compte || '-';
        var valDesc = tx.description || tx.libelle || '';

        var debit = !isRecette ? parseFloat(valMontant || 0).toFixed(2) + ' €' : '-';
        var credit = isRecette ? parseFloat(valMontant || 0).toFixed(2) + ' €' : '-';

        html += `
            <tr>
                <td>${tx.date || ''}</td>
                <td>${valCat}</td>
                <td>${valDesc}</td>
                <td style="color:#dc2626; font-weight:500;">${debit}</td>
                <td style="color:#16a34a; font-weight:500;">${credit}</td>
                <td><span style="background:#dcfce7; color:#15803d; padding:2px 8px; border-radius:12px; font-size:12px; font-weight:600;">Enregistré</span></td>
            </tr>
        `;
    });

    tbody.innerHTML = html;
};

/**
 * Valide l'opération dans Supabase
 */
window.validerOperationJournal = async function(id) {
    var tx = (window.transactions || []).find(function(t) { return t.id === id; });
    if (tx) tx.encaisse = true;

    if (window.supabaseClient) {
        try {
            await window.supabaseClient
                .from('transactions')
                .update({ encaisse: true })
                .eq('id', id);
        } catch (e) {
            console.error("Erreur mise à jour Supabase :", e);
        }
    }

    window.afficherJournal();
};

// Initialisation automatique
if (window.transactions && window.transactions.length > 0) {
    window.afficherJournal();
}
