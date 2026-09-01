/**
 * comptes-selector.js — Plan comptable dans les selects débit/crédit
 */
(function() {
    var PLAN = [];
    var planCharge = false;
    var planEnCours = false;
    var callbacksEnAttente = [];

    // ── Charger le plan comptable (une seule fois) ──────────────────────────
    async function chargerPlan(callback) {
        if (planCharge) { if (callback) callback(); return; }
        if (callback) callbacksEnAttente.push(callback);
        if (planEnCours) return;
        planEnCours = true;

        var sc = window.supabaseClient;
        if (!sc) {
            setTimeout(function(){ planEnCours=false; chargerPlan(null); }, 500);
            return;
        }
        var r = await sc.from('plan_comptable').select('code,nom,type').order('code');
        if (!r.error && r.data) {
            PLAN = r.data;
            planCharge = true;
        }
        planEnCours = false;
        callbacksEnAttente.forEach(function(cb){ cb(); });
        callbacksEnAttente = [];
    }

    // ── Remplir un select à partir du plan ────────────────────────────────────
    function remplirSelect(id, valeurActuelle) {
        var sel = document.getElementById(id);
        if (!sel) return;
        sel.innerHTML = '<option value="">-- Choisir un compte --</option>';
        var groupes = {'4':'Comptes de Tiers (4xx)','5':'Comptes Financiers (5xx)','6':'Charges (6xx)','7':'Produits (7xx)'};
        Object.keys(groupes).forEach(function(p) {
            var liste = PLAN.filter(function(c){ return c.code.charAt(0)===p; });
            if (!liste.length) return;
            var grp = document.createElement('optgroup');
            grp.label = groupes[p];
            liste.forEach(function(c) {
                var opt = document.createElement('option');
                opt.value = c.code;
                opt.textContent = c.code + ' — ' + c.nom;
                grp.appendChild(opt);
            });
            sel.appendChild(grp);
        });
        if (valeurActuelle) sel.value = valeurActuelle;
    }

    // ── Remplir les selects du formulaire de saisie ────────────────────────
    function remplirFormulaires() {
        remplirSelect('pay-compte-debit',  '512000');
        remplirSelect('pay-compte-credit', '706000');
        remplirSelect('od-compte-debit',  '');
        remplirSelect('od-compte-credit', '');
    }

    // ── Auto-remplir selon le sens ─────────────────────────────────────────
    window.autoComptesSens = function(sens, idDebit, idCredit) {
        var selD = document.getElementById(idDebit);
        var selC = document.getElementById(idCredit);
        if (sens === 'Recette') {
            if (selD) selD.value = '512000';
            if (selC) selC.value = '706000';
        } else {
            if (selD) selD.value = '';
            if (selC) selC.value = '512000';
        }
    };

    // ── MODAL ÉDITION ─────────────────────────────────────────────────────
    window.ouvrirEditTransaction = function(id) {
        // Charger le plan si nécessaire, puis ouvrir le modal
        chargerPlan(function() { _ouvrirModalAvecDonnees(id); });
    };

    async function _ouvrirModalAvecDonnees(id) {
        var sc = window.supabaseClient; if (!sc) return;
        var r = await sc.from('transactions').select('*').eq('id', id).single();
        if (r.error || !r.data) { alert('Transaction introuvable'); return; }
        var t = r.data;

        // Afficher le modal AVANT de remplir pour qu'il soit dans le DOM
        var modal = document.getElementById('editTransactionModal');
        if (!modal) return;
        modal.style.display = 'flex';

        // Champs texte
        document.getElementById('edit-tx-id').value     = id;
        document.getElementById('edit-tx-date').value   = t.date || '';
        document.getElementById('edit-tx-desc').value   = t.description || '';
        document.getElementById('edit-tx-montant').value= t.amount || t.montant || '';
        var typeEl = document.getElementById('edit-tx-type');
        if (typeEl) typeEl.value = t.type || 'Recette';

        // Déterminer les comptes débit/crédit
        var isR = (t.type||'').toLowerCase() === 'recette';
        var cDebit, cCredit;

        if (t.compte_code && t.compte_tiers_code) {
            // Données déjà imputées
            cDebit  = isR ? '512000'       : t.compte_code;
            cCredit = isR ? t.compte_tiers_code !== t.compte_code ? '706000' : '706000' : '512000';
            // Si tiers 4xx : on le met dans le bon sens
            if (t.compte_tiers_code && t.compte_tiers_code.charAt(0)==='4') {
                cDebit  = isR ? t.compte_tiers_code : t.compte_code;
                cCredit = isR ? t.compte_code       : t.compte_tiers_code;
                // En réalité pour recette : D=512000 C=706000 (le tiers est auxiliaire)
                cDebit  = isR ? '512000'       : t.compte_code;
                cCredit = isR ? '706000'       : t.compte_tiers_code;
            }
        } else if (t.compte_code) {
            cDebit  = isR ? '512000'     : t.compte_code;
            cCredit = isR ? t.compte_code: '512000';
        } else {
            // Pas encore imputé : valeurs par défaut selon le sens
            cDebit  = isR ? '512000' : '';
            cCredit = isR ? '706000' : '512000';
        }

        // Remplir les selects avec les vraies valeurs
        remplirSelect('edit-compte-debit',  cDebit);
        remplirSelect('edit-compte-credit', cCredit);

        // Tiers
        var selTiers = document.getElementById('edit-tiers-id');
        if (selTiers) {
            selTiers.innerHTML = '<option value="">-- Aucun tiers --</option>';
            PLAN.filter(function(c){ return c.code.charAt(0)==='4'; }).forEach(function(c) {
                var opt = document.createElement('option');
                opt.value = c.code;
                opt.textContent = c.code + ' — ' + c.nom;
                if (c.code === t.compte_tiers_code) opt.selected = true;
                selTiers.appendChild(opt);
            });
            // Aussi les tiers individuels depuis TIERS_DATA
            if (window.TIERS_DATA && window.TIERS_DATA.length) {
                var grpT = document.createElement('optgroup');
                grpT.label = '── Tiers individuels (table tiers) ──';
                window.TIERS_DATA.forEach(function(ti) {
                    var opt = document.createElement('option');
                    opt.value = 'tiers:'+ti.id;
                    opt.textContent = ti.compte + ' — ' + ti.nom;
                    if (t.tiers_id && ti.id === t.tiers_id) opt.selected = true;
                    grpT.appendChild(opt);
                });
                selTiers.appendChild(grpT);
            }
        }

        // Info visuelle
        var info = document.getElementById('edit-info-comptes');
        if (info) {
            info.innerHTML = t.compte_code
                ? '✅ Déjà imputé : ' + (t.compte_code||'') + ' / ' + (t.compte_tiers_code||'512000')
                : '⚠️ Pas encore imputé — choisissez les comptes';
        }
    }

    window.fermerEditTransaction = function() {
        var m = document.getElementById('editTransactionModal');
        if (m) m.style.display = 'none';
    };

    window.sauvegarderEditTransaction = async function(e) {
        if (e) e.preventDefault();
        var sc = window.supabaseClient; if (!sc) return;

        var id      = document.getElementById('edit-tx-id').value;
        var cDebit  = document.getElementById('edit-compte-debit').value;
        var cCredit = document.getElementById('edit-compte-credit').value;
        var desc    = document.getElementById('edit-tx-desc').value;
        var date    = document.getElementById('edit-tx-date').value;
        var montant = parseFloat(document.getElementById('edit-tx-montant').value);
        var type    = (document.getElementById('edit-tx-type')||{}).value || 'Recette';

        if (!cDebit || !cCredit) { alert('Sélectionnez le compte débité ET le compte crédité'); return; }

        // Identifier le compte gestion (6xx/7xx) et le compte tiers (4xx)
        var compteGestion = null, compteTiers = null;
        [cDebit, cCredit].forEach(function(c) {
            if (c.charAt(0)==='4' || c.charAt(0)==='5') {
                if (c !== '512000') compteTiers = c;
            }
            if (c.charAt(0)==='6' || c.charAt(0)==='7') compteGestion = c;
            if (c === '512000' && !compteGestion) {} // banque = neutre
        });
        // Si pas de compte gestion trouvé, prendre le non-banque
        if (!compteGestion) compteGestion = cDebit !== '512000' ? cDebit : cCredit;

        // Tiers sélectionné
        var selTiers = document.getElementById('edit-tiers-id');
        var tiersVal = selTiers ? selTiers.value : '';
        var tiersId = null, nomTiers = null;
        if (tiersVal.startsWith('tiers:')) {
            tiersId = tiersVal.replace('tiers:','');
            if (window.TIERS_DATA) {
                var ti = window.TIERS_DATA.find(function(x){return x.id===tiersId;});
                if (ti) { nomTiers = ti.nom; compteTiers = ti.compte; }
            }
        } else if (tiersVal) {
            compteTiers = tiersVal;
            var cPlan = PLAN.find(function(c){return c.code===tiersVal;});
            if (cPlan) nomTiers = cPlan.nom;
        }

        var libG   = PLAN.find(function(c){return c.code===compteGestion;});
        var libT   = PLAN.find(function(c){return c.code===compteTiers;});

        var update = {
            date:                 date,
            type:                 type,
            description:          desc,
            amount:               montant,
            compte_code:          compteGestion,
            compte_libelle:       libG ? libG.nom : null,
            compte_tiers_code:    compteTiers || null,
            compte_tiers_libelle: libT ? libT.nom : null,
            nom_tiers:            nomTiers,
            tiers_id:             tiersId,
        };

        var r = await sc.from('transactions').update(update).eq('id', id);
        if (r.error) { alert('Erreur : ' + r.error.message); return; }

        window.fermerEditTransaction();
        if (typeof window.chargerJournalBanque === 'function') window.chargerJournalBanque();
        if (typeof window.chargerJournalOD === 'function') window.chargerJournalOD();
    };

    // ── Init ──────────────────────────────────────────────────────────────────
    window.chargerPlanComptableSelectors = function() { chargerPlan(remplirFormulaires); };

    // Patch du bouton ✏️ de transactions.js
    document.addEventListener('DOMContentLoaded', function() {
        chargerPlan(remplirFormulaires);
        var iv = setInterval(function() {
            if (window.ouvrirModalModificationBanque !== window.ouvrirEditTransaction) {
                window.ouvrirModalModificationBanque = window.ouvrirEditTransaction;
            }
        }, 800);
        setTimeout(function(){ clearInterval(iv); }, 10000);
    });
})();
