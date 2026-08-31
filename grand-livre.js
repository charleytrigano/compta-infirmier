/**
 * balance.js - Balance des comptes depuis transactions (+ fallback ecritures_comptables)
 */
(function () {
    window.anneeBalanceSelectionnee = window.anneeBalanceSelectionnee || new Date().getFullYear();

    function parseMontant(val) {
        if (val === null || val === undefined) return 0;
        if (typeof val === 'number') return isNaN(val) ? 0 : Math.abs(val);
        if (typeof val === 'string') {
            var propre = val.replace(/\s/g,'').replace('€','').replace(',','.').trim();
            var num = parseFloat(propre);
            return isNaN(num) ? 0 : Math.abs(num);
        }
        return 0;
    }

    function formatEuro(valeur) {
        if (!valeur || Math.abs(valeur) < 0.001) return '-';
        return Number(valeur).toLocaleString('fr-FR', {
            style:'currency', currency:'EUR',
            minimumFractionDigits:2, maximumFractionDigits:2
        });
    }

    function extraireAnnee(dateVal) {
        if (!dateVal) return null;
        if (typeof dateVal === 'number') return dateVal;
        var m = String(dateVal).match(/(19|20)\d{2}/);
        if (m) return parseInt(m[0], 10);
        var d = new Date(dateVal);
        return isNaN(d.getTime()) ? null : d.getFullYear();
    }

    // ── Convertir une transaction en écritures débit/crédit ───────────────────
    function txVersEcritures(t, tiersParId) {
        var montant    = parseMontant(t.amount || t.montant);
        var estRecette = (t.type||'').toLowerCase() === 'recette';
        var cat        = (t.category || t.categorie || '').toLowerCase();
        var desc       = (t.description || '').toLowerCase();
        var date       = t.date;
        var ecritures  = [];

        // Compte de gestion (6xx / 7xx)
        var codeG, libG;
        if (estRecette) {
            codeG = t.compte_code || '706000';
            libG  = t.compte_libelle || 'Honoraires / Soins infirmiers';
        } else {
            if      (cat.includes('carpimko') || desc.includes('carpimko')) { codeG='646200'; libG='Cotisations CARPIMKO'; }
            else if (cat.includes('urssaf')   || desc.includes('urssaf'))   { codeG='646100'; libG='Cotisations URSSAF'; }
            else if (cat.includes('rétrocession'))  { codeG='621000'; libG='Rétrocession honoraires'; }
            else if (cat.includes('impôt'))         { codeG='695000'; libG='Impôt sur le revenu'; }
            else if (cat.includes('matériel') || cat.includes('achat')) { codeG='606000'; libG='Achats matériel'; }
            else if (cat.includes('assurance'))     { codeG='616000'; libG='Assurances'; }
            else if (cat.includes('loyer'))         { codeG='613200'; libG='Loyers'; }
            else if (cat.includes('kilométri'))     { codeG='625100'; libG='Frais kilométriques'; }
            else if (cat.includes('formation'))     { codeG='625600'; libG='Formations / DPC'; }
            else if (cat.includes('bancaire'))      { codeG='627000'; libG='Frais bancaires'; }
            else                                    { codeG='628000'; libG='Charges diverses'; }
            if (t.compte_code) { codeG = t.compte_code; libG = t.compte_libelle || libG; }
        }

        ecritures.push({date:date, compte_code:codeG, compte_libelle:libG,
            debit: estRecette ? 0 : montant, credit: estRecette ? montant : 0});

        // Compte tiers (4xx) — tiers_id → table tiers → compte exact
        var codeT = null, libT = null;
        if (t.tiers_id && tiersParId[t.tiers_id]) {
            codeT = tiersParId[t.tiers_id].compte;
            libT  = tiersParId[t.tiers_id].nom;
        } else if (t.compte_tiers_code) {
            codeT = t.compte_tiers_code;
            libT  = t.nom_tiers || t.compte_tiers_libelle || codeT;
        } else {
            // Déduction par catégorie
            if      (estRecette)                    { codeT='411000'; libT='Clients / Patients / CPAM'; }
            else if (cat.includes('carpimko') && (cat.includes('prévoyance')||desc.includes('prévoyance'))) { codeT='437200'; libT='CARPIMKO Prévoyance'; }
            else if (cat.includes('carpimko') && (cat.includes('invalidité')||desc.includes('invalidité'))) { codeT='437300'; libT='CARPIMKO Invalidité'; }
            else if (cat.includes('carpimko')|| desc.includes('carpimko')) { codeT='437100'; libT='CARPIMKO Retraite'; }
            else if (cat.includes('urssaf')  || desc.includes('urssaf'))   { codeT='431000'; libT='URSSAF'; }
            else if (cat.includes('rétrocession'))  { codeT='421000'; libT='Rétrocession Titulaire'; }
            else if (cat.includes('impôt'))         { codeT='441000'; libT='DGFiP'; }
            else if (cat.includes('matériel') || cat.includes('achat') || cat.includes('assurance')) { codeT='401000'; libT='Fournisseurs'; }
            else if (!cat.includes('kilométri') && !cat.includes('bancaire')) { codeT='401000'; libT='Fournisseurs divers'; }
        }
        if (codeT) {
            ecritures.push({date:date, compte_code:codeT, compte_libelle:libT,
                debit: estRecette ? 0 : montant, credit: estRecette ? montant : 0});
        }

        // Compte banque 512000
        ecritures.push({date:date, compte_code:'512000', compte_libelle:'Banque / Compte Courant',
            debit: estRecette ? montant : 0, credit: estRecette ? 0 : montant});

        return ecritures;
    }

    // ── Récupérer toutes les écritures ────────────────────────────────────────
    async function recupererEcritures() {
        var sc = window.supabaseClient;
        if (!sc) return [];

        // 1. Essayer ecritures_comptables
        try {
            var r1 = await sc.from('ecritures_comptables').select('*');
            if (!r1.error && r1.data && r1.data.length > 0) return r1.data;
        } catch(e) {}

        // 2. Fallback : générer depuis transactions + tiers
        var res = await Promise.all([
            sc.from('transactions').select('*').order('date',{ascending:true}),
            sc.from('tiers').select('*').eq('actif',true)
        ]);

        var tiersParId = {};
        (res[1].data || []).forEach(function(t){ tiersParId[t.id] = t; });

        var ecritures = [];
        (res[0].data || []).forEach(function(t) {
            txVersEcritures(t, tiersParId).forEach(function(e){ ecritures.push(e); });
        });
        return ecritures;
    }

    function calculerBalance(ecritures, annee) {
        var comptes = {};
        ecritures.forEach(function(e) {
            if (extraireAnnee(e.date) !== annee) return;
            var code = e.compte_code || '471000';
            var lib  = e.compte_libelle || ('Compte ' + code);
            if (!comptes[code]) comptes[code] = {num:code, libelle:lib, debit:0, credit:0};
            comptes[code].debit  += parseMontant(e.debit);
            comptes[code].credit += parseMontant(e.credit);
        });

        var totaux = {debit:0, credit:0, soldeDebit:0, soldeCredit:0};
        var liste = Object.values(comptes).map(function(c) {
            var diff = c.debit - c.credit;
            var sd = diff > 0 ? diff : 0;
            var sc2 = diff < 0 ? Math.abs(diff) : 0;
            totaux.debit       += c.debit;
            totaux.credit      += c.credit;
            totaux.soldeDebit  += sd;
            totaux.soldeCredit += sc2;
            return {num:c.num, libelle:c.libelle, debit:c.debit, credit:c.credit, soldeDebit:sd, soldeCredit:sc2};
        }).sort(function(a,b){ return a.num.localeCompare(b.num, undefined, {numeric:true}); });

        return {comptes:liste, totaux:totaux};
    }

    async function afficherBalanceFinale() {
        var conteneur = document.getElementById('balance-container') ||
                        document.getElementById('balance-contenu');
        if (!conteneur) {
            // Fallback : injecter dans vue-balance mais après le titre
            var section = document.getElementById('vue-balance');
            if (!section) return;
            var existing = section.querySelector('#balance-contenu');
            if (!existing) {
                var div = document.createElement('div');
                div.id = 'balance-contenu';
                section.appendChild(div);
            }
            conteneur = section.querySelector('#balance-contenu');
        }
        if (!conteneur) return;

        conteneur.innerHTML = '<p style="color:#64748b;padding:20px;text-align:center;">⏳ Chargement de la balance...</p>';

        var sc = window.supabaseClient;
        if (!sc) { setTimeout(afficherBalanceFinale, 600); return; }

        var ecritures = await recupererEcritures();
        var anneesSet = {};
        ecritures.forEach(function(e){ var a=extraireAnnee(e.date); if(a) anneesSet[a]=true; });
        var annees = Object.keys(anneesSet).map(Number).sort(function(a,b){return b-a;});
        if (!annees.length) annees = [new Date().getFullYear()];
        var anneeActive = parseInt(window.anneeBalanceSelectionnee, 10);
        if (!anneesSet[anneeActive]) anneeActive = annees[0];

        var bal = calculerBalance(ecritures, anneeActive);
        var comptes = bal.comptes, totaux = bal.totaux;

        var rows = comptes.length === 0
            ? '<tr><td colspan="6" style="padding:30px;text-align:center;color:#94a3b8;font-style:italic;">Aucune écriture pour l\'exercice '+anneeActive+'.</td></tr>'
            : comptes.map(function(c) {
                var eq = Math.abs(c.debit - c.credit) < 0.005;
                return '<tr style="border-bottom:1px solid #f1f5f9;transition:background .1s;" '
                    +'onmouseover="this.style.background=\'#f8fafc\'" onmouseout="this.style.background=\'white\'">'
                    +'<td style="padding:9px 14px;font-weight:700;color:#1e293b;white-space:nowrap;">'+c.num+'</td>'
                    +'<td style="padding:9px 14px;color:#475569;">'+c.libelle+'</td>'
                    +'<td style="padding:9px 14px;text-align:right;color:#dc2626;font-weight:600;">'+formatEuro(c.debit)+'</td>'
                    +'<td style="padding:9px 14px;text-align:right;color:#16a34a;font-weight:600;">'+formatEuro(c.credit)+'</td>'
                    +'<td style="padding:9px 14px;text-align:right;color:#2563eb;font-weight:700;">'+formatEuro(c.soldeDebit)+'</td>'
                    +'<td style="padding:9px 14px;text-align:right;color:'+(eq?'#16a34a':'#dc2626')+';font-weight:700;">'+formatEuro(c.soldeCredit)+'</td>'
                    +'</tr>';
              }).join('');

        var optAnnees = annees.map(function(a){
            return '<option value="'+a+'"'+(a===anneeActive?' selected':'')+'>'+a+'</option>';
        }).join('');

        conteneur.innerHTML =
            '<div style="background:white;border:1px solid #e2e8f0;border-radius:10px;padding:20px;margin:8px 0;">'
            // En-tête
            +'<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;padding-bottom:12px;border-bottom:1px solid #f1f5f9;margin-bottom:14px;">'
            +'<h2 style="margin:0;font-size:15px;font-weight:700;color:#1e293b;">⚖️ Balance Générale des Comptes</h2>'
            +'<div style="display:flex;align-items:center;gap:8px;background:#f8fafc;border:1px solid #e2e8f0;padding:6px 12px;border-radius:8px;">'
            +'<label style="font-size:12px;font-weight:700;color:#64748b;">Exercice :</label>'
            +'<select onchange="window.changerAnneeBalance(this.value)" '
            +'style="background:white;border:1px solid #cbd5e1;border-radius:4px;padding:3px 8px;font-weight:700;font-size:12px;cursor:pointer;">'
            +optAnnees+'</select>'
            +(ecritures.length===0?'<span style="font-size:11px;color:#f59e0b;margin-left:8px;">⚠️ Données reconstruites depuis transactions</span>':'')
            +'</div></div>'
            // Tableau
            +'<div style="overflow-x:auto;">'
            +'<table style="width:100%;border-collapse:collapse;font-size:13px;">'
            +'<thead><tr style="background:#f1f5f9;color:#475569;">'
            +'<th style="padding:10px 14px;text-align:left;font-weight:700;white-space:nowrap;">Numéro</th>'
            +'<th style="padding:10px 14px;text-align:left;font-weight:700;">Intitulé du compte</th>'
            +'<th style="padding:10px 14px;text-align:right;font-weight:700;color:#dc2626;white-space:nowrap;">Total Débit (€)</th>'
            +'<th style="padding:10px 14px;text-align:right;font-weight:700;color:#16a34a;white-space:nowrap;">Total Crédit (€)</th>'
            +'<th style="padding:10px 14px;text-align:right;font-weight:700;color:#2563eb;white-space:nowrap;">Solde Débiteur (€)</th>'
            +'<th style="padding:10px 14px;text-align:right;font-weight:700;color:#dc2626;white-space:nowrap;">Solde Créditeur (€)</th>'
            +'</tr></thead>'
            +'<tbody>'+rows+'</tbody>'
            +'<tfoot><tr style="background:#1e293b;color:white;font-weight:700;">'
            +'<td colspan="2" style="padding:10px 14px;text-align:right;font-size:12px;letter-spacing:.05em;text-transform:uppercase;">TOTAUX</td>'
            +'<td style="padding:10px 14px;text-align:right;font-size:14px;">'+formatEuro(totaux.debit)+'</td>'
            +'<td style="padding:10px 14px;text-align:right;font-size:14px;">'+formatEuro(totaux.credit)+'</td>'
            +'<td style="padding:10px 14px;text-align:right;font-size:14px;">'+formatEuro(totaux.soldeDebit)+'</td>'
            +'<td style="padding:10px 14px;text-align:right;font-size:14px;">'+formatEuro(totaux.soldeCredit)+'</td>'
            +'</tr></tfoot>'
            +'</table></div></div>';
    }

    window.changerAnneeBalance = function(annee) {
        window.anneeBalanceSelectionnee = parseInt(annee, 10);
        afficherBalanceFinale();
    };

    window.initBalanceModule = afficherBalanceFinale;
})();
