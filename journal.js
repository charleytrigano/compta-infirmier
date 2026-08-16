/* ==========================================================================
   MODULE JOURNAL, SOUS-ONGLETS & VALIDATION DE COMPTABILITÉ
   ========================================================================== */

// Variable d'état globale pour suivre le sous-onglet actif du Journal
window.sousOngletJournalActif = window.sousOngletJournalActif || 'encaissements-valider';

/**
 * Fonction principale appelée pour rafraîchir le Journal
 */
window.afficherJournal = function() {
    window.mettreAJourCompteursJournal();
    window.afficherJournalSelonOnglet(window.sousOngletJournalActif);
};

/**
 * Recalcule et met à jour tous les badges et compteurs (X) des onglets du Journal
 */
window.mettreAJourCompteursJournal = function() {
    var liste = window.transactions || [];

    // 1. Encaissements à valider (non encaissés)
    var encaissementsAValider = liste.filter(function(tx) {
        var typeRaw = (tx.type || '').toString().toLowerCase();
        var isRecette = typeRaw.includes('recette') || typeRaw.includes('encaissement');
        return isRecette && (tx.encaisse === false || tx.encaisse === undefined || tx.encaisse === null);
    });

    // 2. Dépenses à régler (non réglées)
    var depensesARegler = liste.filter(function(tx) {
        var typeRaw = (tx.type || '').toString().toLowerCase();
        var isDepense = typeRaw.includes('dépense') || typeRaw.includes('depense');
        return isDepense && (tx.encaisse === false || tx.encaisse === undefined || tx.encaisse === null);
    });

    // 3. Mise à jour des éléments HTML de compteurs s'ils existent dans le DOM
    var badgeEnc = document.getElementById('count-encaissements-valider') || document.getElementById('badge-encaissements');
    if (badgeEnc) badgeEnc.textContent = encaissementsAValider.length;

    var badgeDep = document.getElementById('count-depenses-regler') || document.getElementById('badge-depenses');
    if (badgeDep) badgeDep.textContent = depensesARegler.length;

    // Mise à jour si le texte est directement dans le bouton
    var btnEnc = document.getElementById('btn-encaissements-valider');
    if (btnEnc) {
        btnEnc.innerHTML = `🟢 Encaissements à Valider (${encaissementsAValider.length})`;
    }

    var btnDep = document.getElementById('btn-depenses-regler');
    if (btnDep) {
        btnDep.innerHTML = `🔴 Dépenses à Régler (${depensesARegler.length})`;
    }
};

/**
 * Change de sous-onglet dans la section Journal et met à jour l'affichage
 */
window.changerSousOngletJournal = function(nomOnglet, btnElement) {
    window.sousOngletJournalActif = nomOnglet;

    // Gestion du style visuel des boutons sous-onglets
    var container = document.getElementById('journal-container') || document;
    var tousLesBoutons = container.querySelectorAll('.btn-sous-onglet-journal, [onclick*="changerSousOngletJournal"]');
    
    tousLesBoutons.forEach(function(b) {
        b.classList.remove('active', 'bg-blue-600', 'text-white');
        b.style.backgroundColor = '';
        b.style.color = '';
    });

    if (btnElement) {
        btnElement.classList.add('active');
        btnElement.style.backgroundColor = '#2563eb';
        btnElement.style.color = '#ffffff';
    }

    window.afficherJournalSelonOnglet(nomOnglet);
};

/**
 * Filtre et affiche les enregistrements dans le tableau en fonction du sous-onglet sélectionné
 */
window.afficherJournalSelonOnglet = function(nomOnglet) {
    var tbody = document.getElementById('body-tableau-journal');
    var containerVue = document.getElementById('vue-journal-contenu');
    
    if (!tbody && !containerVue) return;

    var liste = window.transactions || [];

    // --- 1. SOUS-ONGLET : Encaissements à Valider ---
    if (nomOnglet === 'encaissements-valider') {
        var aValider = liste.filter(function(tx) {
            var typeRaw = (tx.type || '').toString().toLowerCase();
            var isRecette = typeRaw.includes('recette') || typeRaw.includes('encaissement');
            return isRecette && (tx.encaisse === false || tx.encaisse === undefined || tx.encaisse === null);
        });

        window.rendreTableauJournalValider(tbody || containerVue, aValider, 'recette');
    }
    // --- 2. SOUS-ONGLET : Dépenses à Régler ---
    else if (nomOnglet === 'depenses-regler') {
        var aRegler = liste.filter(function(tx) {
            var typeRaw = (tx.type || '').toString().toLowerCase();
            var isDepense = typeRaw.includes('dépense') || typeRaw.includes('depense');
            return isDepense && (tx.encaisse === false || tx.encaisse === undefined || tx.encaisse === null);
        });

        window.rendreTableauJournalValider(tbody || containerVue, aRegler, 'depense');
    }
    // --- 3. SOUS-ONGLET : Journal Ventes (VE) ---
    else if (nomOnglet === 'ventes-ve') {
        var recettes = liste.filter(function(tx) {
            var typeRaw = (tx.type || '').toString().toLowerCase();
            return typeRaw.includes('recette') || typeRaw.includes('encaissement');
        });
        window.rendreTableauJournalComplet(tbody || containerVue, recettes, 'VE');
    }
    // --- 4. SOUS-ONGLET : Journal Dépenses (HA) ---
    else if (nomOnglet === 'depenses-ha') {
        var depenses = liste.filter(function(tx) {
            var typeRaw = (tx.type || '').toString().toLowerCase();
            return typeRaw.includes('dépense') || typeRaw.includes('depense');
        });
        window.rendreTableauJournalComplet(tbody || containerVue, depenses, 'HA');
    }
    // --- 5. SOUS-ONGLET : Journal Banque (BQ) ---
    else if (nomOnglet === 'banque-bq') {
        window.rendreTableauJournalComplet(tbody || containerVue, liste, 'BQ');
    }
    // --- PAR DÉFAUT ---
    else {
        window.rendreTableauJournalComplet(tbody || containerVue, liste, 'ALL');
    }
};

/**
 * Affiche les éléments nécessitant une action de validation ("Valider l'encaissement" / "Régler")
 */
window.rendreTableauJournalValider = function(targetElement, liste, typeAction) {
    if (!targetElement) return;

    if (!Array.isArray(liste) || liste.length === 0) {
        targetElement.innerHTML = `<tr><td colspan="6" style="text-align:center; color:#64748b; padding:20px;">Aucune opération en attente.</td></tr>`;
        return;
    }

    var html = '';
    liste.forEach(function(tx) {
        var valMontant = tx.amount !== undefined && tx.amount !== null ? tx.amount : (tx.montant || 0);
        var valCat = tx.category || tx.categorie || tx.categorie_libelle || tx.compte || '-';
        var valDesc = tx.description || tx.libelle || '';
        var montantFormatted = parseFloat(valMontant || 0).toFixed(2) + ' €';

        html += `
            <tr>
                <td>${tx.date || ''}</td>
                <td>${valCat}</td>
                <td>${valDesc}</td>
                <td style="font-weight:600; color:${typeAction === 'recette' ? '#16a34a' : '#dc2626'};">${montantFormatted}</td>
                <td><span style="background:#fef3c7; color:#d97706; padding:2px 8px; border-radius:12px; font-size:12px; font-weight:600;">En attente</span></td>
                <td>
                    <button onclick="window.validerOperationJournal('${tx.id}')" style="background:#16a34a; color:#ffffff; border:none; padding:5px 10px; border-radius:6px; cursor:pointer; font-size:12px; font-weight:600;">
                        ✓ Valider ${typeAction === 'recette' ? "l'encaissement" : 'le règlement'}
                    </button>
                </td>
            </tr>
        `;
    });

    targetElement.innerHTML = html;
};

/**
 * Affiche les écritures comptables sous forme classique (Journal BQ/VE/HA)
 */
window.rendreTableauJournalComplet = function(targetElement, liste, codeJournal) {
    if (!targetElement) return;

    if (!Array.isArray(liste) || liste.length === 0) {
        targetElement.innerHTML = `<tr><td colspan="6" style="text-align:center; color:#64748b; padding:20px;">Aucune écriture enregistrée.</td></tr>`;
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
                <td><span style="font-family:monospace; font-weight:bold; background:#e2e8f0; padding:2px 6px; border-radius:4px;">${codeJournal}</span></td>
                <td>${valCat}</td>
                <td>${valDesc}</td>
                <td style="color:#dc2626; font-weight:500;">${debit}</td>
                <td style="color:#16a34a; font-weight:500;">${credit}</td>
            </tr>
        `;
    });

    targetElement.innerHTML = html;
};

/**
 * Action : Valider une opération (met à jour encaisse = true dans Supabase)
 */
window.validerOperationJournal = async function(id) {
    var tx = (window.transactions || []).find(function(t) { return t.id === id; });
    if (!tx) return;

    tx.encaisse = true;

    if (window.supabaseClient) {
        try {
            const { error } = await window.supabaseClient
                .from('transactions')
                .update({ encaisse: true })
                .eq('id', id);

            if (error) console.error("Erreur lors de la validation Supabase :", error.message);
        } catch (e) {
            console.error("Exception validation Supabase :", e);
        }
    }

    // Rafraîchir tout le journal
    window.afficherJournal();
};

// Exécution au chargement si des données existent déjà
if (window.transactions && window.transactions.length > 0) {
    window.afficherJournal();
}
