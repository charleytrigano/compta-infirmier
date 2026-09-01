/**
 * comptes-selector.js — Sélecteurs débit/crédit avec plan comptable
 */
(function() {
    // Comptes de base intégrés (fallback si plan_comptable vide)
    var PLAN_BASE = [
        // Tiers
        {code:'401000',nom:'Fournisseurs et dettes à régler',type:'Tiers'},
        {code:'401001',nom:'Matmut — Assurance Professionnelle',type:'Tiers'},
        {code:'411000',nom:'Patients & Caisses (Compte Collectif)',type:'Tiers'},
        {code:'411001',nom:'Abadie',type:'Tiers'},
        {code:'411002',nom:'Saint-André',type:'Tiers'},
        {code:'411100',nom:'Patients — Règlements Directs',type:'Tiers'},
        {code:'411200',nom:'CPAM / Assurance Maladie',type:'Tiers'},
        {code:'411300',nom:'Mutuelles / Complémentaires',type:'Tiers'},
        {code:'421000',nom:'Rétrocession Titulaire',type:'Tiers'},
        {code:'431000',nom:'URSSAF',type:'Tiers'},
        {code:'437000',nom:'CARPIMKO',type:'Tiers'},
        {code:'437100',nom:'CARPIMKO — Retraite de base',type:'Tiers'},
        {code:'437200',nom:'CARPIMKO — Prévoyance santé',type:'Tiers'},
        {code:'437300',nom:'CARPIMKO — Invalidité-décès',type:'Tiers'},
        {code:'441000',nom:'État — Impôt sur le Revenu',type:'Tiers'},
        // Financiers
        {code:'512000',nom:'Banque / Compte Courant',type:'Actif'},
        // Charges
        {code:'606000',nom:'Achats matériel médical',type:'Charge'},
        {code:'613200',nom:'Loyers',type:'Charge'},
        {code:'616000',nom:'Assurances professionnelles',type:'Charge'},
        {code:'621000',nom:'Rétrocession honoraires',type:'Charge'},
        {code:'622000',nom:'Honoraires expert-comptable',type:'Charge'},
        {code:'625100',nom:'Frais kilométriques',type:'Charge'},
        {code:'625600',nom:'Formations / DPC',type:'Charge'},
        {code:'625800',nom:'Cotisations professionnelles',type:'Charge'},
        {code:'626000',nom:'Téléphone / Internet',type:'Charge'},
        {code:'627000',nom:'Frais bancaires',type:'Charge'},
        {code:'646100',nom:'Cotisations URSSAF',type:'Charge'},
        {code:'646200',nom:'Cotisations CARPIMKO',type:'Charge'},
        {code:'695000',nom:'Impôt sur le Revenu',type:'Charge'},
        // Produits
        {code:'706000',nom:'Honoraires / Soins infirmiers',type:'Produit'},
    ];

    var PLAN = PLAN_BASE.slice(); // commence avec les comptes de base
    var planCharge = false;

    // Charger le plan depuis Supabase et fusionner
    async function chargerDepuisSupabase() {
        var sc = window.supabaseClient;
        if (!sc) { setTimeout(chargerDepuisSupabase, 500); return; }
        try {
            var r = await sc.from('plan_comptable').select('code,nom,type').order('code');
            if (!r.error && r.data && r.data.length > 0) {
                // Fusionner : plan Supabase prioritaire sur plan_base
                var codesBase = {};
                PLAN_BASE.forEach(function(c){ codesBase[c.code] = true; });
                r.data.forEach(function(c) {
                    if (!codesBase[c.code]) PLAN.push(c);
                    else {
                        var idx = PLAN.findIndex(function(x){ return x.code === c.code; });
                        if (idx >= 0) PLAN[idx] = c;
                    }
                });
            }
        } catch(e) {}
        planCharge = true;
        // Remplir les selects ouverts
        ['edit-compte-debit','edit-compte-credit','pay-compte-debit','pay-compte-credit','od-compte-debit','od-compte-credit'].forEach(function(id) {
            var sel = document.getElementById(id);
            if (sel) remplirSelect(id, sel.value);
        });
    }

    // Remplir un select
    function remplirSelect(id, valeurActuelle) {
        var sel = document.getElementById(id);
        if (!sel) return;
        var old = sel.value;
        sel.innerHTML = '<option value="">-- Choisir un compte --</option>';
        var groupes = {
            '4': 'Comptes de Tiers (4xx)',
            '5': 'Comptes Financiers (5xx)',
            '6': 'Charges (6xx)',
            '7': 'Produits (7xx)',
        };
        Object.keys(groupes).forEach(function(p) {
            var liste = PLAN.filter(function(c){ return c.code.charAt(0) === p; });
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
        var v = valeurActuelle || old;
        if (v) sel.value = v;
    }

    // Auto-complétion selon le sens
    window.autoComptesSens = function(sens, idD, idC) {
        var selD = document.getElementById(idD);
        var selC = document.getElementById(idC);
        if (sens === 'Recette') {
            if (selD) { if (!selD.value) selD.value = '512000'; }
            if (selC) { if (!selC.value) selC.value = '706000'; }
        } else {
            if (selC) { if (!selC.value) selC.value = '512000'; }
        }
    };
    window.modalEditTypeChange = function(sens) {
        window.autoComptesSens(sens, 'edit-compte-debit', 'edit-compte-credit');
    };

    // Enrichir le modal ouvert avec les données de la transaction
    window.enrichirModalComptes = function(id) {
        // Remplir immédiatement avec PLAN_BASE (toujours dispo)
        remplirSelect('edit-compte-debit',  '');
        remplirSelect('edit-compte-credit', '');

        // Remplir tiers
        var selT = document.getElementById('edit-tiers-id');
        if (selT) {
            selT.innerHTML = '<option value="">-- Aucun tiers --</option>';
            PLAN.filter(function(c){ return c.code.charAt(0)==='4'; }).forEach(function(c) {
                var opt = document.createElement('option');
                opt.value = c.code;
                opt.textContent = c.code + ' — ' + c.nom;
                selT.appendChild(opt);
            });
            if (window.TIERS_DATA && window.TIERS_DATA.length) {
                var grp = document.createElement('optgroup');
                grp.label = '── Tiers individuels ──';
                window.TIERS_DATA.forEach(function(ti) {
                    var opt = document.createElement('option');
                    opt.value = 'tiers:'+ti.id;
                    opt.textContent = ti.compte + ' — ' + ti.nom;
                    grp.appendChild(opt);
                });
                selT.appendChild(grp);
            }
        }

        // Pré-remplir avec les valeurs de la transaction
        var sc = window.supabaseClient;
        if (!sc || !id) return;
        sc.from('transactions').select('*').eq('id', id).single().then(function(r) {
            if (r.error || !r.data) return;
            var t = r.data;
            var isR = (t.type||'').toLowerCase() === 'recette';
            var cD = isR ? '512000' : (t.compte_code || '');
            var cC = isR ? (t.compte_code || '706000') : '512000';
            if (t.compte_code && t.compte_code.charAt(0) === '6') cD = t.compte_code;

            var selD = document.getElementById('edit-compte-debit');
            var selC = document.getElementById('edit-compte-credit');
            var selT2 = document.getElementById('edit-tiers-id');
            var statut = document.getElementById('edit-imputation-statut');

            if (selD) selD.value = cD;
            if (selC) selC.value = cC;
            if (selT2) {
                if (t.tiers_id) {
                    for (var i=0;i<selT2.options.length;i++) {
                        if (selT2.options[i].value==='tiers:'+t.tiers_id){ selT2.selectedIndex=i; break; }
                    }
                } else if (t.compte_tiers_code) {
                    selT2.value = t.compte_tiers_code;
                }
            }
            if (statut) {
                statut.innerHTML = t.compte_code
                    ? '<span style="color:#16a34a;font-weight:600;">✅ Déjà imputé : '+t.compte_code+(t.compte_tiers_code?' / '+t.compte_tiers_code:'')+'</span>'
                    : '<span style="color:#f59e0b;">⚠️ Non imputé</span>';
            }
        });
    };

    // Patch ouvrirModalModificationBanque
    function patcherModal() {
        if (typeof window.ouvrirModalModificationBanque === 'function' && !window._modalPatch) {
            window._modalPatch = true;
            var origFn = window.ouvrirModalModificationBanque;
            window.ouvrirModalModificationBanque = async function(id) {
                window._editTxId = id;
                await origFn(id);
                window.enrichirModalComptes(id);
            };
        } else if (!window._modalPatch) {
            setTimeout(patcherModal, 300);
        }
    }

    // Patch enregistrerModificationOD pour sauvegarder les comptes
    function patcherSauvegarde() {
        if (typeof window.enregistrerModificationOD === 'function' && !window._savePatch) {
            window._savePatch = true;
            var origSave = window.enregistrerModificationOD;
            window.enregistrerModificationOD = async function(e) {
                await origSave(e);
                var id = window._editTxId || (document.getElementById('edit-transaction-id')||{}).value;
                if (!id) return;
                var cD   = (document.getElementById('edit-compte-debit')||{}).value || '';
                var cC   = (document.getElementById('edit-compte-credit')||{}).value || '';
                var tvS  = (document.getElementById('edit-tiers-id')||{}).value || '';
                if (!cD && !cC) return;

                var type = ((document.getElementById('edit-type')||{}).value||'').toLowerCase();
                var isR  = type === 'recette';
                var compteG = isR ? (cC||'706000') : (cD||'');
                if (cD && cD.charAt(0)==='6') compteG = cD;
                if (cC && cC.charAt(0)==='7') compteG = cC;

                var compteTiers = null, tiersId = null, nomTiers = null;
                if (tvS.startsWith('tiers:')) {
                    tiersId = tvS.replace('tiers:','');
                    if (window.TIERS_DATA){ var ti=window.TIERS_DATA.find(function(x){return x.id===tiersId;}); if(ti){nomTiers=ti.nom;compteTiers=ti.compte;} }
                } else if (tvS && tvS.charAt(0)==='4') {
                    compteTiers = tvS;
                    var pC = PLAN.find(function(c){return c.code===tvS;}); if(pC) nomTiers=pC.nom;
                }

                var libG = PLAN.find(function(c){return c.code===compteG;});
                var libT = compteTiers ? PLAN.find(function(c){return c.code===compteTiers;}) : null;
                var sc = window.supabaseClient;
                if (sc) {
                    await sc.from('transactions').update({
                        compte_code:          compteG||null,
                        compte_libelle:       libG?libG.nom:null,
                        compte_tiers_code:    compteTiers||null,
                        compte_tiers_libelle: libT?libT.nom:null,
                        nom_tiers:            nomTiers,
                        tiers_id:             tiersId,
                    }).eq('id', id);
                }
            };
        } else if (!window._savePatch) {
            setTimeout(patcherSauvegarde, 400);
        }
    }

    // Remplir les selects du formulaire de saisie
    function remplirFormulaires() {
        remplirSelect('pay-compte-debit',  '512000');
        remplirSelect('pay-compte-credit', '706000');
    }

    document.addEventListener('DOMContentLoaded', function() {
        remplirFormulaires(); // immédiat avec PLAN_BASE
        chargerDepuisSupabase(); // enrichir depuis Supabase
        setTimeout(patcherModal,    600);
        setTimeout(patcherSauvegarde, 1200);
    });

    window.chargerPlanComptableSelectors = function(){ chargerDepuisSupabase(); };
})();
