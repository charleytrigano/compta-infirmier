// ============================================================================
// tiers.js — Gestion des comptes tiers dans le Journal de Banque
// ============================================================================

// ── Référentiel des comptes tiers (Plan Comptable BNC infirmier) ─────────────
var TIERS_COMPTES = [
    // Classe 4 — Comptes de tiers
    { groupe: '--- Clients & Organismes payeurs ---' },
    { code: '411000', libelle: '411000 — CPAM / Sécurité Sociale', type: 'recette' },
    { code: '411100', libelle: '411100 — Mutuelle / Complémentaire santé', type: 'recette' },
    { code: '411200', libelle: '411200 — Patient (part patient)', type: 'recette' },
    { code: '411300', libelle: '411300 — Tiers payant complémentaire', type: 'recette' },

    { groupe: '--- Organismes sociaux ---' },
    { code: '431000', libelle: '431000 — URSSAF', type: 'depense' },
    { code: '437100', libelle: '437100 — CARPIMKO (retraite)', type: 'depense' },
    { code: '437200', libelle: '437200 — CARPIMKO (prévoyance santé)', type: 'depense' },
    { code: '437300', libelle: '437300 — CARPIMKO (invalidité-décès)', type: 'depense' },

    { groupe: '--- Fournisseurs & Prestataires ---' },
    { code: '401000', libelle: '401000 — Fournisseur (matériel médical)', type: 'depense' },
    { code: '401100', libelle: '401100 — Laboratoire / Analyses', type: 'depense' },
    { code: '401200', libelle: '401200 — Pharmacie', type: 'depense' },
    { code: '401300', libelle: '401300 — Prestataire informatique / Logiciel', type: 'depense' },
    { code: '401400', libelle: '401400 — Expert-comptable / Honoraires', type: 'depense' },
    { code: '401500', libelle: '401500 — Ordre Infirmier (cotisation)', type: 'depense' },

    { groupe: '--- État & Impôts ---' },
    { code: '441000', libelle: '441000 — État (Impôt sur le Revenu)', type: 'depense' },
    { code: '443000', libelle: '443000 — Taxes diverses', type: 'depense' },

    { groupe: '--- Titulaire (remplaçante) ---' },
    { code: '421000', libelle: '421000 — Rétrocession titulaire', type: 'depense' },
    { code: '455000', libelle: '455000 — Exploitant (prélèvement personnel)', type: 'both' },
];

// ── Injecter les champs tiers dans le formulaire Journal de Banque ───────────
window.initTiersJournalBanque = function() {
    // Trouver le formulaire du journal de banque
    var form = document.querySelector('#vue-banque form') || document.getElementById('form-journal-banque');
    if (!form || document.getElementById('pay-tiers-bloc')) return;

    // Chercher le champ description/libellé pour insérer après
    var descParent = (document.getElementById('pay-description') || document.getElementById('pay-libelle') || {}).parentElement;
    if (!descParent) return;

    var bloc = document.createElement('div');
    bloc.id = 'pay-tiers-bloc';
    bloc.style.cssText = 'margin-top:10px;';
    bloc.innerHTML = tiersHtml();
    descParent.parentElement.insertBefore(bloc, descParent.nextSibling);

    // Écouter changement de type (recette/dépense) pour filtrer les tiers
    var typeSelect = document.getElementById('pay-type') || document.querySelector('#vue-banque select');
    if (typeSelect) {
        typeSelect.addEventListener('change', function() {
            tiersMAJFiltreType(this.value);
        });
    }
};

function tiersHtml() {
    var opts = '<option value="">-- Aucun tiers --</option>';
    TIERS_COMPTES.forEach(function(t) {
        if (t.groupe) {
            opts += '<optgroup label="' + t.groupe + '"></optgroup>';
        } else {
            opts += '<option value="' + t.code + '" data-type="' + t.type + '">'
                + t.libelle + '</option>';
        }
    });

    return '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">'
        + '<div>'
        + '<label style="display:block;font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px;">Compte Tiers (optionnel)</label>'
        + '<select id="pay-tiers-code" onchange="tiersMAJNom()" style="width:100%;padding:8px 11px;border:1px solid #e2e8f0;border-radius:6px;font-size:13px;background:white;">'
        + opts + '</select>'
        + '</div>'
        + '<div>'
        + '<label style="display:block;font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px;">Nom du Tiers</label>'
        + '<input type="text" id="pay-nom-tiers" placeholder="Ex: URSSAF Côte d\'Azur, CPAM 06..." '
        + 'style="width:100%;padding:8px 11px;border:1px solid #e2e8f0;border-radius:6px;font-size:13px;">'
        + '</div>'
        + '</div>'
        + '<div id="pay-tiers-info" style="display:none;margin-top:6px;padding:7px 12px;background:#eff6ff;border-radius:6px;font-size:12px;color:#1d4ed8;border-left:3px solid #2563eb;">'
        + '</div>';
}

window.tiersMAJNom = function() {
    var sel = document.getElementById('pay-tiers-code');
    var nomEl = document.getElementById('pay-nom-tiers');
    var infoEl = document.getElementById('pay-tiers-info');
    if (!sel) return;
    var code = sel.value;
    var libelle = sel.options[sel.selectedIndex] ? sel.options[sel.selectedIndex].text : '';

    if (!code) {
        if (infoEl) infoEl.style.display = 'none';
        return;
    }

    // Info comptable sur l'écriture
    var info = tiersGetInfo(code);
    if (infoEl && info) {
        infoEl.style.display = 'block';
        infoEl.innerHTML = '📒 <strong>Écriture :</strong> ' + info;
    } else if (infoEl) {
        infoEl.style.display = 'none';
    }
};

function tiersGetInfo(code) {
    var map = {
        '411000': 'Débit 512000 (Banque) / Crédit 706000 (Honoraires) + Crédit 411000 (CPAM)',
        '411100': 'Débit 512000 (Banque) / Crédit 706000 (Honoraires) + Crédit 411100 (Mutuelle)',
        '411200': 'Débit 512000 (Banque) / Crédit 411200 (Patient)',
        '431000': 'Débit 646100 (Cotis. URSSAF) / Crédit 431000 (URSSAF) + Crédit 512000 (Banque)',
        '437100': 'Débit 646200 (Cotis. CARPIMKO) / Crédit 437100 (CARPIMKO) + Crédit 512000',
        '437200': 'Débit 646200 (Prévoyance) / Crédit 437200 (CARPIMKO Prév.) + Crédit 512000',
        '401000': 'Débit 606000 (Fournitures) / Crédit 401000 (Fournisseur) + Crédit 512000',
        '401400': 'Débit 628000 (Honoraires expert) / Crédit 401400 (Expert-comptable)',
        '441000': 'Débit 695000 (IR) / Crédit 441000 (État) + Crédit 512000 (Banque)',
        '421000': 'Débit 621000 (Rétrocession) / Crédit 421000 (Titulaire) + Crédit 512000',
        '455000': 'Débit 455000 (Exploitant) / Crédit 512000 (Banque)',
    };
    return map[code] || null;
}

window.tiersMAJFiltreType = function(typeVal) {
    var sel = document.getElementById('pay-tiers-code');
    if (!sel) return;
    var type = (typeVal || '').toLowerCase();
    Array.from(sel.options).forEach(function(opt) {
        if (!opt.value) return;
        var t = opt.getAttribute('data-type');
        if (t === 'both' || !t) return;
        if (type.includes('recette') && t === 'depense') {
            opt.style.display = 'none';
        } else if (type.includes('dépense') || type.includes('depense')) {
            if (t === 'recette') opt.style.display = 'none';
            else opt.style.display = '';
        } else {
            opt.style.display = '';
        }
    });
};

// ── Patch de enregistrerPaiementBanque pour sauvegarder le tiers ─────────────
window.addEventListener('load', function() {
    // Attendre que transactions.js soit chargé
    setTimeout(function() {
        patcherEnregistrementBanque();
    }, 800);
});

function patcherEnregistrementBanque() {
    var origFn = window.enregistrerPaiementBanque;
    if (!origFn) return;

    window.enregistrerPaiementBanque = async function() {
        // Récupérer les données tiers avant l'enregistrement original
        var tiersCode  = (document.getElementById('pay-tiers-code') || {}).value || null;
        var tiersNom   = (document.getElementById('pay-nom-tiers') || {}).value || null;
        var tiersLib   = tiersCode
            ? ((document.getElementById('pay-tiers-code') || {}).options
                ? (document.getElementById('pay-tiers-code').options[document.getElementById('pay-tiers-code').selectedIndex] || {}).text
                : null)
            : null;

        // Appeler la fonction originale
        await origFn.apply(this, arguments);

        // Mettre à jour la dernière transaction avec les infos tiers
        if (tiersCode || tiersNom) {
            var sc = window.supabaseClient;
            if (!sc) return;
            // Récupérer la dernière transaction insérée
            var r = await sc.from('transactions')
                .select('id').order('created_at', {ascending:false}).limit(1);
            if (r.data && r.data.length) {
                await sc.from('transactions').update({
                    compte_tiers_code:    tiersCode,
                    compte_tiers_libelle: tiersLib,
                    nom_tiers:            tiersNom
                }).eq('id', r.data[0].id);
            }
            // Réinitialiser les champs tiers
            var tc = document.getElementById('pay-tiers-code');
            var tn = document.getElementById('pay-nom-tiers');
            var ti = document.getElementById('pay-tiers-info');
            if (tc) tc.value = '';
            if (tn) tn.value = '';
            if (ti) ti.style.display = 'none';
        }
    };
}

// ── Afficher le tiers dans le tableau des transactions ───────────────────────
// Override du rendu pour afficher le tiers si présent
window.tiersFormatCellule = function(t) {
    if (!t.compte_tiers_code && !t.nom_tiers) return '';
    return '<br><span style="font-size:11px;color:#64748b;">'
        + (t.compte_tiers_code ? '<code style="background:#f1f5f9;padding:1px 5px;border-radius:3px;font-size:10px;">'
            + t.compte_tiers_code + '</code> ' : '')
        + (t.nom_tiers || '')
        + '</span>';
};

// ── Init automatique ──────────────────────────────────────────────────────────
// S'appelle quand on navigue vers vue-banque
window.initTiersOnNav = function() {
    setTimeout(window.initTiersJournalBanque, 400);
};
