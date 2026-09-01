/**
 * comptes-selector.js
 * Charge le plan comptable et permet de sélectionner débit/crédit
 * sur les transactions du Journal de Banque et Journal OD
 */
(function() {
    var PLAN_COMPTES = []; // [{code, nom, type}]

    // ── Charger le plan comptable ──────────────────────────────────────────────
    async function chargerPlanComptable() {
        var sc = window.supabaseClient;
        if (!sc) { setTimeout(chargerPlanComptable, 500); return; }
        var r = await sc.from('plan_comptable').select('code,nom,type').order('code');
        if (r.error || !r.data) return;
        PLAN_COMPTES = r.data;
        remplirSelecteurs();
    }

    // ── Remplir tous les selects de comptes ───────────────────────────────────
    function remplirSelecteurs() {
        ['pay-compte-debit','pay-compte-credit','od-compte-debit','od-compte-credit','edit-compte-debit','edit-compte-credit'].forEach(function(id) {
            var sel = document.getElementById(id);
            if (!sel) return;
            var val = sel.value;
            sel.innerHTML = '<option value="">-- Choisir un compte --</option>';
            var groupes = {
                '4':'Comptes de Tiers (4xx)',
                '5':'Comptes Financiers (5xx)',
                '6':'Charges (6xx)',
                '7':'Produits (7xx)',
            };
            Object.keys(groupes).forEach(function(prefix) {
                var liste = PLAN_COMPTES.filter(function(c){ return c.code.charAt(0)===prefix; });
                if (!liste.length) return;
                var grp = document.createElement('optgroup');
                grp.label = groupes[prefix];
                liste.forEach(function(c) {
                    var opt = document.createElement('option');
                    opt.value = c.code;
                    opt.textContent = c.code + ' — ' + c.nom;
                    if (c.code === val) opt.selected = true;
                    grp.appendChild(opt);
                });
                sel.appendChild(grp);
            });
            if (val) sel.value = val;
        });
    }

    // ── Auto-remplir débit/crédit selon le sens ───────────────────────────────
    window.autoComptesSens = function(sens, prefixDebit, prefixCredit) {
        // sens = 'Recette' ou 'Dépense'
        // Pour recette : D=512000 (banque), C=706000 (honoraires)
        // Pour dépense : D=646xxx (charge), C=512000 (banque)
        var selD = document.getElementById(prefixDebit);
        var selC = document.getElementById(prefixCredit);
        if (sens === 'Recette') {
            if (selD && !selD.value) selD.value = '512000';
            if (selC && !selC.value) selC.value = '706000';
        } else {
            if (selD && !selD.value) selD.value = '646200'; // défaut charge
            if (selC && !selC.value) selC.value = '512000';
        }
    };

    // ── MODAL ÉDITION D'UNE ÉCRITURE ──────────────────────────────────────────
    window.ouvrirEditTransaction = async function(id) {
        var sc = window.supabaseClient; if (!sc) return;
        var r = await sc.from('transactions').select('*').eq('id',id).single();
        if (r.error || !r.data) { alert('Transaction introuvable'); return; }
        var t = r.data;

        // Remplir le modal
        document.getElementById('edit-tx-id').value          = id;
        document.getElementById('edit-tx-date').value         = t.date || '';
        document.getElementById('edit-tx-desc').value         = t.description || '';
        document.getElementById('edit-tx-montant').value      = t.amount || t.montant || '';
        document.getElementById('edit-tx-type').value         = t.type || 'Recette';

        // Remplir les selects comptes après avoir chargé le plan
        remplirSelecteurs();
        setTimeout(function() {
            var selD = document.getElementById('edit-compte-debit');
            var selC = document.getElementById('edit-compte-credit');
            var selT = document.getElementById('edit-tiers-id');

            // Débit = compte_code (charge/produit) OU 512000 si recette
            var cDebit = t.compte_code || (t.type==='Recette'?'512000':'');
            var cCredit= t.compte_tiers_code || (t.type==='Recette'?'706000':'512000');

            if (selD) selD.value = cDebit;
            if (selC) selC.value = cCredit;

            // Tiers
            if (selT) {
                // Remplir depuis TIERS_DATA si disponible
                if (window.TIERS_DATA && window.TIERS_DATA.length) {
                    selT.innerHTML = '<option value="">-- Aucun tiers --</option>';
                    window.TIERS_DATA.forEach(function(ti) {
                        var opt = document.createElement('option');
                        opt.value = ti.id;
                        opt.textContent = ti.nom + ' (' + ti.compte + ')';
                        if (ti.id === t.tiers_id) opt.selected = true;
                        selT.appendChild(opt);
                    });
                }
            }
        }, 100);

        document.getElementById('editTransactionModal').style.display = 'flex';
    };

    window.fermerEditTransaction = function() {
        document.getElementById('editTransactionModal').style.display = 'none';
    };

    window.sauvegarderEditTransaction = async function(e) {
        if (e) e.preventDefault();
        var sc = window.supabaseClient; if (!sc) return;

        var id      = document.getElementById('edit-tx-id').value;
        var cDebit  = document.getElementById('edit-compte-debit').value;
        var cCredit = document.getElementById('edit-compte-credit').value;
        var tiersId = document.getElementById('edit-tiers-id').value || null;
        var desc    = document.getElementById('edit-tx-desc').value;
        var date    = document.getElementById('edit-tx-date').value;
        var montant = parseFloat(document.getElementById('edit-tx-montant').value);
        var type    = document.getElementById('edit-tx-type').value;

        if (!cDebit || !cCredit) { alert('Sélectionnez le compte débité ET crédité'); return; }

        // Logique comptable : pour une recette D=512(banque) C=706+411
        // compte_code = compte de gestion, compte_tiers_code = compte tiers
        var compteGestion = type==='Recette' ? cCredit : cDebit;  // 706xxx ou 6xxxxx
        var compteTiers   = type==='Recette' ? cDebit !== '512000' ? cDebit : cCredit !== '706000' ? cCredit : null
                                             : cCredit !== '512000' ? cCredit : null;

        // Si l'utilisateur a bien choisi un 4xx comme tiers
        if (cDebit && cDebit.charAt(0)==='4') compteTiers = cDebit;
        if (cCredit && cCredit.charAt(0)==='4') compteTiers = cCredit;

        var libDebit  = PLAN_COMPTES.find(function(c){return c.code===cDebit;});
        var libCredit = PLAN_COMPTES.find(function(c){return c.code===cCredit;});
        var libTiers  = compteTiers ? PLAN_COMPTES.find(function(c){return c.code===compteTiers;}) : null;

        var nomTiers = null;
        if (tiersId && window.TIERS_DATA) {
            var ti = window.TIERS_DATA.find(function(x){return x.id===tiersId;});
            if (ti) { nomTiers = ti.nom; compteTiers = ti.compte; }
        }

        var update = {
            date:                 date,
            type:                 type,
            description:          desc,
            amount:               montant,
            compte_code:          compteGestion,
            compte_libelle:       compteGestion ? (PLAN_COMPTES.find(function(c){return c.code===compteGestion;})||{}).nom||'' : null,
            compte_tiers_code:    compteTiers   || null,
            compte_tiers_libelle: libTiers ? libTiers.nom : null,
            nom_tiers:            nomTiers,
            tiers_id:             tiersId,
        };

        var r = await sc.from('transactions').update(update).eq('id', id);
        if (r.error) { alert('Erreur : '+r.error.message); return; }

        window.fermerEditTransaction();
        alert('✅ Écriture mise à jour');
        // Recharger la vue active
        if (typeof window.chargerJournalBanque==='function') window.chargerJournalBanque();
        if (typeof window.chargerJournalOD==='function') window.chargerJournalOD();
    };

    // Démarrage
    document.addEventListener('DOMContentLoaded', chargerPlanComptable);
    window.chargerPlanComptableSelectors = chargerPlanComptable;
    window.remplirSelecteursComptes = remplirSelecteurs;
})();
