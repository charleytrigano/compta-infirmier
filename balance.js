/**
 * balance.js - Balance des comptes depuis transactions
 */
(function () {
    window.anneeBalanceSelectionnee = window.anneeBalanceSelectionnee || new Date().getFullYear();

    function fmt(n) {
        if (!n || Math.abs(n) < 0.001) return '-';
        return Number(n).toLocaleString('fr-FR', {style:'currency', currency:'EUR', minimumFractionDigits:2});
    }

    function annee(d) {
        if (!d) return null;
        var m = String(d).match(/(20\d{2})/);
        return m ? parseInt(m[1]) : null;
    }

    // ── Compte gestion (6xx/7xx) ──────────────────────────────────────────────
    function codeGestion(type, cat) {
        if ((type||'').toLowerCase()==='recette') return {code:'706000', lib:'Honoraires / Soins infirmiers'};
        if      (cat.includes('carpimko'))     return {code:'646200', lib:'Cotisations CARPIMKO'};
        else if (cat.includes('urssaf'))       return {code:'646100', lib:'Cotisations URSSAF'};
        else if (cat.includes('rétrocession')) return {code:'621000', lib:'Rétrocession'};
        else if (cat.includes('impôt'))        return {code:'695000', lib:'Impôt sur le revenu'};
        else if (cat.includes('matériel') || cat.includes('achat')) return {code:'606000', lib:'Achats matériel'};
        else if (cat.includes('assurance'))    return {code:'616000', lib:'Assurances'};
        else if (cat.includes('loyer'))        return {code:'613200', lib:'Loyers'};
        else if (cat.includes('kilométri'))    return {code:'625100', lib:'Frais kilométriques'};
        else if (cat.includes('formation'))    return {code:'625600', lib:'Formations'};
        else if (cat.includes('bancaire'))     return {code:'627000', lib:'Frais bancaires'};
        else                                   return {code:'628000', lib:'Charges diverses'};
    }

    // ── Compte tiers (4xx) ────────────────────────────────────────────────────
    function codeTiers(t, cat, tiersParId) {
        // Priorité 1 : tiers_id → vrai compte (ex: 411Abadie, 411St-André)
        if (t.tiers_id && tiersParId && tiersParId[t.tiers_id]) {
            return {code: tiersParId[t.tiers_id].compte, lib: tiersParId[t.tiers_id].nom};
        }
        // Priorité 2 : compte_tiers_code stocké sur la transaction
        if (t.compte_tiers_code) {
            return {code: t.compte_tiers_code, lib: t.nom_tiers || t.compte_tiers_libelle || t.compte_tiers_code};
        }
        // Priorité 3 : déduction par catégorie — PAS de 411000 générique par défaut
        var estRecette = (t.type||'').toLowerCase()==='recette';
        if      (cat.includes('carpimko') && cat.includes('prévoyance')) return {code:'437200', lib:'CARPIMKO Prévoyance'};
        else if (cat.includes('carpimko') && cat.includes('invalidité')) return {code:'437300', lib:'CARPIMKO Invalidité'};
        else if (cat.includes('carpimko'))    return {code:'437100', lib:'CARPIMKO Retraite'};
        else if (cat.includes('urssaf'))      return {code:'431000', lib:'URSSAF'};
        else if (cat.includes('rétrocession'))return {code:'421000', lib:'Rétrocession Titulaire'};
        else if (cat.includes('impôt'))       return {code:'441000', lib:'DGFiP'};
        // Pour les recettes et achats sans tiers explicite : pas de compte tiers
        return null;
    }

    // ── Générer les écritures double-entrée d'une transaction ────────────────
    // Règle : chaque tiers est TOUJOURS soldé (facture + règlement simultanés)
    //
    //  RECETTE :
    //    1. Facture  : DÉBIT  411xxx / CRÉDIT 706000
    //    2. Règlement: DÉBIT  512000 / CRÉDIT 411xxx
    //    → 411xxx soldé, net = DÉBIT 512000 / CRÉDIT 706000
    //
    //  DÉPENSE :
    //    1. Facture  : DÉBIT  646xxx / CRÉDIT 401xxx (ou 431xxx etc.)
    //    2. Règlement: DÉBIT  401xxx / CRÉDIT 512000
    //    → 4xxxx soldé, net = DÉBIT 646xxx / CRÉDIT 512000

    function getComptes(t, tiersParId) {
        var m    = Math.abs(parseFloat(t.amount || t.montant || 0));
        var isR  = (t.type||'').toLowerCase()==='recette';
        var cat  = (t.category || t.categorie || '').toLowerCase();
        var g    = codeGestion(t.type, cat);
        var tier = codeTiers(t, cat, tiersParId);
        var lignes = [];

        if (tier) {
            // Écriture avec tiers : 2 passes → le tiers est soldé
            if (isR) {
                // 1. Facture client : D/411xxx — C/706000
                lignes.push({code:tier.code, lib:tier.lib,    debit:m, credit:0});
                lignes.push({code:g.code,    lib:g.lib,       debit:0, credit:m});
                // 2. Règlement     : D/512000 — C/411xxx
                lignes.push({code:'512000',  lib:'Banque',    debit:m, credit:0});
                lignes.push({code:tier.code, lib:tier.lib,    debit:0, credit:m});
            } else {
                // 1. Facture fourn : D/646xxx — C/401xxx
                lignes.push({code:g.code,    lib:g.lib,       debit:m, credit:0});
                lignes.push({code:tier.code, lib:tier.lib,    debit:0, credit:m});
                // 2. Règlement     : D/401xxx — C/512000
                lignes.push({code:tier.code, lib:tier.lib,    debit:m, credit:0});
                lignes.push({code:'512000',  lib:'Banque',    debit:0, credit:m});
            }
        } else {
            // Sans tiers : écriture simple gestion ↔ banque
            lignes.push({code:g.code,   lib:g.lib,    debit:isR?0:m, credit:isR?m:0});
            lignes.push({code:'512000', lib:'Banque',  debit:isR?m:0, credit:isR?0:m});
        }
        return lignes;
    }

    // ── Affichage principal ───────────────────────────────────────────────────
    async function afficherBalance() {
        var el = document.getElementById('balance-contenu');
        if (!el) return;
        el.innerHTML = '<p style="padding:20px;text-align:center;color:#64748b;">⏳ Chargement...</p>';

        // Attendre Supabase
        var sc = window.supabaseClient;
        if (!sc) { setTimeout(afficherBalance, 500); return; }

        try {
            // Charger transactions
            var rTx = await sc.from('transactions').select('*').order('date', {ascending:true});
            if (rTx.error) throw new Error(rTx.error.message);

            // Charger tiers (optionnel — ne bloque pas si erreur)
            var tiersParId = {};
            try {
                var rT = await sc.from('tiers').select('id,compte,nom').eq('actif',true);
                if (!rT.error && rT.data) rT.data.forEach(function(t){ tiersParId[t.id]=t; });
            } catch(e) {}

            var transactions = rTx.data || [];

            // Années disponibles
            var anneesSet = {};
            transactions.forEach(function(t){ var a=annee(t.date); if(a) anneesSet[a]=true; });
            var annees = Object.keys(anneesSet).map(Number).sort(function(a,b){return b-a;});
            if (!annees.length) annees = [new Date().getFullYear()];

            var anneeActive = parseInt(window.anneeBalanceSelectionnee);
            if (!anneesSet[anneeActive]) anneeActive = annees[0];

            // Construire les comptes
            var comptes = {};
            transactions.forEach(function(t) {
                if (annee(t.date) !== anneeActive) return;
                getComptes(t, tiersParId).forEach(function(l) {
                    if (!comptes[l.code]) comptes[l.code] = {num:l.code, lib:l.lib, debit:0, credit:0};
                    comptes[l.code].debit  += l.debit;
                    comptes[l.code].credit += l.credit;
                });
            });

            var totD=0, totC=0, totSD=0, totSC=0;
            var liste = Object.values(comptes).map(function(c) {
                var diff = c.debit - c.credit;
                var sd = diff > 0 ? diff : 0;
                var sc2 = diff < 0 ? -diff : 0;
                totD+=c.debit; totC+=c.credit; totSD+=sd; totSC+=sc2;
                return {num:c.num, lib:c.lib, debit:c.debit, credit:c.credit, sd:sd, sc:sc2};
            }).sort(function(a,b){ return a.num.localeCompare(b.num, undefined, {numeric:true}); });

            var optAnnees = annees.map(function(a){
                return '<option value="'+a+'"'+(a===anneeActive?' selected':'')+'>'+a+'</option>';
            }).join('');

            var rows = !liste.length
                ? '<tr><td colspan="6" style="padding:30px;text-align:center;color:#94a3b8;">Aucune transaction pour '+anneeActive+'</td></tr>'
                : liste.map(function(c){
                    return '<tr style="border-bottom:1px solid #f1f5f9;" onmouseover="this.style.background=\'#f8fafc\'" onmouseout="this.style.background=\'white\'">'
                        +'<td style="padding:9px 14px;font-weight:700;color:#1e293b;">'+c.num+'</td>'
                        +'<td style="padding:9px 14px;color:#475569;">'+c.lib+'</td>'
                        +'<td style="padding:9px 14px;text-align:right;color:#dc2626;font-weight:600;">'+fmt(c.debit)+'</td>'
                        +'<td style="padding:9px 14px;text-align:right;color:#16a34a;font-weight:600;">'+fmt(c.credit)+'</td>'
                        +'<td style="padding:9px 14px;text-align:right;color:#2563eb;font-weight:700;">'+fmt(c.sd)+'</td>'
                        +'<td style="padding:9px 14px;text-align:right;color:#16a34a;font-weight:700;">'+fmt(c.sc)+'</td>'
                        +'</tr>';
                }).join('');

            el.innerHTML =
                '<div style="background:white;border:1px solid #e2e8f0;border-radius:10px;padding:20px;">'
                +'<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;padding-bottom:12px;border-bottom:1px solid #f1f5f9;margin-bottom:14px;">'
                +'<h2 style="margin:0;font-size:15px;font-weight:700;color:#1e293b;">⚖️ Balance Générale — '+anneeActive
                +' <small style="color:#64748b;font-weight:400;">('+transactions.filter(function(t){return annee(t.date)===anneeActive;}).length+' transactions)</small></h2>'
                +'<div style="display:flex;align-items:center;gap:8px;background:#f8fafc;border:1px solid #e2e8f0;padding:6px 12px;border-radius:8px;">'
                +'<label style="font-size:12px;font-weight:700;color:#64748b;">Exercice :</label>'
                +'<select onchange="window.changerAnneeBalance(this.value)" style="background:white;border:1px solid #cbd5e1;border-radius:4px;padding:3px 8px;font-weight:700;font-size:12px;cursor:pointer;">'
                +optAnnees+'</select></div></div>'
                +'<div style="overflow-x:auto;">'
                +'<table style="width:100%;border-collapse:collapse;font-size:13px;">'
                +'<thead><tr style="background:#f1f5f9;">'
                +'<th style="padding:10px 14px;text-align:left;font-weight:700;">Numéro</th>'
                +'<th style="padding:10px 14px;text-align:left;font-weight:700;">Intitulé</th>'
                +'<th style="padding:10px 14px;text-align:right;color:#dc2626;font-weight:700;white-space:nowrap;">Total Débit</th>'
                +'<th style="padding:10px 14px;text-align:right;color:#16a34a;font-weight:700;white-space:nowrap;">Total Crédit</th>'
                +'<th style="padding:10px 14px;text-align:right;color:#2563eb;font-weight:700;white-space:nowrap;">Solde Débiteur</th>'
                +'<th style="padding:10px 14px;text-align:right;color:#16a34a;font-weight:700;white-space:nowrap;">Solde Créditeur</th>'
                +'</tr></thead><tbody>'+rows+'</tbody>'
                +'<tfoot><tr style="background:#1e293b;color:white;font-weight:700;">'
                +'<td colspan="2" style="padding:10px 14px;text-align:right;font-size:12px;text-transform:uppercase;letter-spacing:.05em;">TOTAUX</td>'
                +'<td style="padding:10px 14px;text-align:right;font-size:14px;">'+fmt(totD)+'</td>'
                +'<td style="padding:10px 14px;text-align:right;font-size:14px;">'+fmt(totC)+'</td>'
                +'<td style="padding:10px 14px;text-align:right;font-size:14px;">'+fmt(totSD)+'</td>'
                +'<td style="padding:10px 14px;text-align:right;font-size:14px;">'+fmt(totSC)+'</td>'
                +'</tr></tfoot></table></div></div>';

        } catch(err) {
            el.innerHTML = '<div style="padding:20px;background:#fef2f2;border-radius:8px;color:#dc2626;">'
                +'❌ Erreur : '+err.message+'</div>';
        }
    }

    window.changerAnneeBalance = function(a) {
        window.anneeBalanceSelectionnee = parseInt(a);
        afficherBalance();
    };

    window.initBalanceModule = afficherBalance;
})();
