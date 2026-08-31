/**
 * balance.js — Balance des comptes (plan comptable général, sans tiers automatiques)
 * Chaque transaction = 1 écriture gestion + 1 écriture banque 512000.
 * Les comptes tiers (411xxx, 431xxx...) n'apparaissent QUE si
 * explicitement renseignés sur la transaction (compte_code ou compte_tiers_code).
 */
(function () {
    window.anneeBalanceSelectionnee = window.anneeBalanceSelectionnee || new Date().getFullYear();

    function fmt(n) {
        if (!n || Math.abs(n) < 0.001) return '—';
        return Number(n).toLocaleString('fr-FR', {style:'currency', currency:'EUR', minimumFractionDigits:2});
    }
    function anneeOf(d) {
        if (!d) return null;
        var m = String(d).match(/(20\d{2})/);
        return m ? parseInt(m[1]) : null;
    }

    // ── Plan comptable de référence (libellés) ─────────────────────────────────
    var PLAN = {};  // chargé depuis Supabase

    // ── Compte de gestion selon catégorie ─────────────────────────────────────
    function compteGestion(type, cat, desc) {
        if ((type||'').toLowerCase() === 'recette') return '706000';
        var c = (cat||'').toLowerCase(), d = (desc||'').toLowerCase();
        if (c.includes('carpimko') || d.includes('carpimko')) return '646200';
        if (c.includes('urssaf')   || d.includes('urssaf'))   return '646100';
        if (c.includes('rétrocession'))  return '621000';
        if (c.includes('impôt') || d.includes('impôt'))       return '695000';
        if (c.includes('matériel') || c.includes('achat') || c.includes('fourniture')) return '606000';
        if (c.includes('assurance') || d.includes('assurance') || d.includes('matmut') || d.includes('macsf')) return '616000';
        if (c.includes('loyer'))         return '613200';
        if (c.includes('kilométri') || c.includes('déplacement')) return '625100';
        if (c.includes('formation') || d.includes('dpc'))     return '625600';
        if (c.includes('bancaire') || d.includes('frais banc')) return '627000';
        if (d.includes('ordre') || d.includes('cotisation pro')) return '625800';
        if (d.includes('téléphone') || d.includes('internet') || d.includes('sfr') || d.includes('orange')) return '626000';
        if (d.includes('expert') || d.includes('comptable'))  return '622000';
        return '628000';
    }

    function libelle(code) {
        if (PLAN[code]) return PLAN[code];
        var map = {
            '512000':'Banque / Compte Courant',
            '706000':'Honoraires / Soins infirmiers',
            '646100':'Cotisations sociales URSSAF',
            '646200':'Cotisations CARPIMKO',
            '621000':'Rétrocession honoraires',
            '695000':'Impôt sur le revenu',
            '606000':'Achats matériel et fournitures',
            '616000':'Assurances professionnelles',
            '613200':'Loyers',
            '625100':'Frais kilométriques',
            '625600':'Formations / DPC',
            '627000':'Frais bancaires',
            '625800':'Cotisations professionnelles',
            '626000':'Téléphone / Internet',
            '622000':'Honoraires expert-comptable',
            '628000':'Charges diverses',
        };
        return map[code] || ('Compte ' + code);
    }

    // ── Générer les écritures d'une transaction (SIMPLE : gestion + banque) ───
    function ecritures(t) {
        var m    = Math.abs(parseFloat(t.amount || t.montant || 0));
        var isR  = (t.type||'').toLowerCase() === 'recette';
        var cat  = t.category || t.categorie || '';
        var desc = t.description || '';
        var res  = [];

        // Compte explicitement renseigné sur la transaction ?
        var codeG = t.compte_code || compteGestion(t.type, cat, desc);

        // Écriture gestion (6xx/7xx)
        res.push({code:codeG, debit:isR?0:m, credit:isR?m:0});

        // Écriture banque 512000
        res.push({code:'512000', debit:isR?m:0, credit:isR?0:m});

        // Si un compte tiers est explicitement renseigné sur la transaction → l'inclure SOLDÉ
        var codeT = t.compte_tiers_code;
        if (codeT) {
            // Écriture tiers soldée : débit ET crédit du même montant
            res.push({code:codeT, debit:isR?m:m, credit:isR?m:m});
        }

        return res;
    }

    async function afficherBalance() {
        var el = document.getElementById('balance-contenu');
        if (!el) return;
        el.innerHTML = '<p style="padding:20px;text-align:center;color:#64748b;">⏳ Chargement...</p>';

        var sc = window.supabaseClient;
        if (!sc) { setTimeout(afficherBalance, 500); return; }

        try {
            // Charger plan comptable et transactions en parallèle
            var res = await Promise.all([
                sc.from('transactions').select('*').order('date', {ascending:true}),
                sc.from('plan_comptable').select('code, intitule')
            ]);

            if (res[0].error) throw new Error(res[0].error.message);

            // Indexer le plan comptable
            (res[1].data || []).forEach(function(r){ PLAN[r.code] = r.nom; });

            var transactions = res[0].data || [];

            // Années disponibles
            var anneesSet = {};
            transactions.forEach(function(t){ var a=anneeOf(t.date); if(a) anneesSet[a]=true; });
            var annees = Object.keys(anneesSet).map(Number).sort(function(a,b){return b-a;});
            if (!annees.length) annees = [new Date().getFullYear()];
            var anneeActive = parseInt(window.anneeBalanceSelectionnee);
            if (!anneesSet[anneeActive]) anneeActive = annees[0];

            // Construire les comptes
            var comptes = {};
            function addLigne(code, debit, credit, tx) {
                var lib = libelle(code);
                if (!comptes[code]) comptes[code] = {code:code, lib:lib, debit:0, credit:0, detail:[]};
                comptes[code].debit  += debit;
                comptes[code].credit += credit;
                if (tx && (debit > 0 || credit > 0)) {
                    comptes[code].detail.push({
                        date:tx.date, desc:tx.description||'—',
                        cat:tx.category||tx.categorie||'—',
                        debit:debit, credit:credit
                    });
                }
            }

            transactions.forEach(function(t) {
                if (anneeOf(t.date) !== anneeActive) return;
                ecritures(t).forEach(function(e){ addLigne(e.code, e.debit, e.credit, t); });
            });

            // Calculer totaux
            var totD=0, totC=0, totSD=0, totSC=0;
            var liste = Object.values(comptes).map(function(c) {
                var diff = c.debit - c.credit;
                var sd = diff > 0 ? diff : 0;
                var sc2 = diff < 0 ? -diff : 0;
                totD+=c.debit; totC+=c.credit; totSD+=sd; totSC+=sc2;
                return {code:c.code, lib:c.lib, debit:c.debit, credit:c.credit, sd:sd, sc:sc2, detail:c.detail};
            }).sort(function(a,b){
                return a.code.localeCompare(b.code, undefined, {numeric:true});
            });

            var optAnnees = annees.map(function(a){
                return '<option value="'+a+'"'+(a===anneeActive?' selected':'')+'>'+a+'</option>';
            }).join('');

            var nbTx = transactions.filter(function(t){return anneeOf(t.date)===anneeActive;}).length;

            // Rendu
            var rowsHtml = !liste.length
                ? '<tr><td colspan="6" style="padding:30px;text-align:center;color:#94a3b8;">Aucune transaction pour '+anneeActive+'</td></tr>'
                : liste.map(function(c) {
                    var uid = 'b_'+c.code.replace(/\W/g,'_');
                    var soldé = Math.abs(c.debit-c.credit) < 0.005;
                    var detailRows = c.detail.map(function(d){
                        return '<tr style="background:#f8fafc;">'
                            +'<td style="padding:3px 10px 3px 28px;color:#64748b;font-size:11px;">'+d.date+'</td>'
                            +'<td style="padding:3px 10px;color:#94a3b8;font-size:11px;font-style:italic;">'+d.cat+'</td>'
                            +'<td colspan="2" style="padding:3px 10px;color:#475569;font-size:11px;">'+d.desc+'</td>'
                            +'<td style="padding:3px 10px;text-align:right;font-size:11px;color:#dc2626;">'+(d.debit>0.001?fmt(d.debit):'')+'</td>'
                            +'<td style="padding:3px 10px;text-align:right;font-size:11px;color:#16a34a;">'+(d.credit>0.001?fmt(d.credit):'')+'</td>'
                            +'</tr>';
                    }).join('');
                    return '<tr style="border-bottom:1px solid #f1f5f9;cursor:pointer;" '
                        +'onclick="var d=document.getElementById(\''+uid+'\');if(d){d.style.display=d.style.display===\'none\'?\'table-row-group\':\'none\'}">'
                        +'<td style="padding:9px 14px;font-weight:700;color:#1e293b;">'+c.code+'</td>'
                        +'<td style="padding:9px 14px;color:#475569;">'+c.lib
                        +' <span style="font-size:10px;color:#94a3b8;">('+c.detail.length+')</span></td>'
                        +'<td style="padding:9px 14px;text-align:right;color:#dc2626;font-weight:600;">'+fmt(c.debit)+'</td>'
                        +'<td style="padding:9px 14px;text-align:right;color:#16a34a;font-weight:600;">'+fmt(c.credit)+'</td>'
                        +'<td style="padding:9px 14px;text-align:right;color:#2563eb;font-weight:700;">'+fmt(c.sd)+'</td>'
                        +'<td style="padding:9px 14px;text-align:right;color:'+(soldé?'#16a34a':'#2563eb')+';font-weight:700;">'+fmt(c.sc)+'</td>'
                        +'</tr>'
                        +'<tbody id="'+uid+'" style="display:none;">'+detailRows+'</tbody>';
                }).join('');

            el.innerHTML =
                '<div style="background:white;border:1px solid #e2e8f0;border-radius:10px;padding:20px;">'
                +'<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;padding-bottom:12px;border-bottom:1px solid #f1f5f9;margin-bottom:14px;">'
                +'<h2 style="margin:0;font-size:15px;font-weight:700;color:#1e293b;">⚖️ Balance Générale — '+anneeActive
                +' <small style="color:#64748b;font-weight:400;">('+nbTx+' transactions)</small></h2>'
                +'<div style="display:flex;align-items:center;gap:8px;background:#f8fafc;border:1px solid #e2e8f0;padding:6px 12px;border-radius:8px;">'
                +'<label style="font-size:12px;font-weight:700;color:#64748b;">Exercice :</label>'
                +'<select onchange="window.changerAnneeBalance(this.value)" style="background:white;border:1px solid #cbd5e1;border-radius:4px;padding:3px 8px;font-weight:700;font-size:12px;cursor:pointer;">'
                +optAnnees+'</select></div></div>'
                +'<p style="font-size:11px;color:#94a3b8;margin-bottom:10px;">💡 Cliquer sur une ligne pour voir le détail des écritures</p>'
                +'<div style="overflow-x:auto;">'
                +'<table style="width:100%;border-collapse:collapse;font-size:13px;">'
                +'<thead><tr style="background:#f1f5f9;">'
                +'<th style="padding:10px 14px;text-align:left;font-weight:700;">Numéro</th>'
                +'<th style="padding:10px 14px;text-align:left;font-weight:700;">Intitulé</th>'
                +'<th style="padding:10px 14px;text-align:right;color:#dc2626;font-weight:700;white-space:nowrap;">Total Débit</th>'
                +'<th style="padding:10px 14px;text-align:right;color:#16a34a;font-weight:700;white-space:nowrap;">Total Crédit</th>'
                +'<th style="padding:10px 14px;text-align:right;color:#2563eb;font-weight:700;white-space:nowrap;">Solde Débiteur</th>'
                +'<th style="padding:10px 14px;text-align:right;color:#16a34a;font-weight:700;white-space:nowrap;">Solde Créditeur</th>'
                +'</tr></thead><tbody>'+rowsHtml+'</tbody>'
                +'<tfoot><tr style="background:#1e293b;color:white;font-weight:700;">'
                +'<td colspan="2" style="padding:10px 14px;text-align:right;font-size:12px;text-transform:uppercase;letter-spacing:.05em;">TOTAUX</td>'
                +'<td style="padding:10px 14px;text-align:right;font-size:14px;">'+fmt(totD)+'</td>'
                +'<td style="padding:10px 14px;text-align:right;font-size:14px;">'+fmt(totC)+'</td>'
                +'<td style="padding:10px 14px;text-align:right;font-size:14px;">'+fmt(totSD)+'</td>'
                +'<td style="padding:10px 14px;text-align:right;font-size:14px;">'+fmt(totSC)+'</td>'
                +'</tr></tfoot></table></div></div>';

        } catch(err) {
            el.innerHTML = '<div style="padding:20px;background:#fef2f2;border-radius:8px;color:#dc2626;">❌ Erreur : '+err.message+'</div>';
        }
    }

    window.changerAnneeBalance = function(a) {
        window.anneeBalanceSelectionnee = parseInt(a);
        afficherBalance();
    };
    window.initBalanceModule = afficherBalance;
})();
