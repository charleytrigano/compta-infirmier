/**
 * balance.js — Balance des comptes avec plan comptable général
 * Double entrée : chaque transaction génère gestion + tiers (soldé) + banque
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

    // ── Plan comptable chargé depuis Supabase ─────────────────────────────────
    var PLAN = {};

    // ── Compte gestion (6xx/7xx) ──────────────────────────────────────────────
    function getGestion(type, cat, desc) {
        if ((type||'').toLowerCase() === 'recette') return '706000';
        var c = (cat||'').toLowerCase(), d = (desc||'').toLowerCase();
        if (c.includes('carpimko') || d.includes('carpimko')) return '646200';
        if (c.includes('urssaf')   || d.includes('urssaf'))   return '646100';
        if (c.includes('rétrocession'))                        return '621000';
        if (c.includes('impôt')    || d.includes('impôt'))    return '695000';
        if (c.includes('matériel') || c.includes('achat') || c.includes('fourniture')) return '606000';
        if (c.includes('assurance')|| d.includes('assurance') || d.includes('matmut') || d.includes('macsf')) return '616000';
        if (c.includes('loyer'))                               return '613200';
        if (c.includes('kilométri')|| c.includes('déplacement')) return '625100';
        if (c.includes('formation')|| d.includes('dpc'))      return '625600';
        if (c.includes('bancaire') || d.includes('frais banc')) return '627000';
        if (d.includes('ordre')    || d.includes('cotisation pro')) return '625800';
        if (d.includes('téléphone')|| d.includes('internet')  || d.includes('sfr') || d.includes('orange')) return '626000';
        if (d.includes('expert')   || d.includes('comptable')) return '622000';
        return null; // transaction non classée → apparaîtra dans la section dédiée
    }

    // ── Compte tiers (4xx) automatique selon catégorie ────────────────────────
    function getTiers(t, cat) {
        // Priorité 1 : compte_tiers_code explicite sur la transaction
        if (t.compte_tiers_code) return t.compte_tiers_code;
        // Priorité 2 : déduction par catégorie
        var c = (cat||'').toLowerCase(), d = (t.description||'').toLowerCase();
        var isR = (t.type||'').toLowerCase() === 'recette';
        if (isR)                          return '411000';  // Clients / CPAM collectif
        if (c.includes('carpimko') && (c.includes('prévoyance') || d.includes('prévoyance'))) return '437200';
        if (c.includes('carpimko') && (c.includes('invalidité') || d.includes('invalidité'))) return '437300';
        if (c.includes('carpimko')|| d.includes('carpimko')) return '437100';
        if (c.includes('urssaf')  || d.includes('urssaf'))   return '431000';
        if (c.includes('rétrocession'))                       return '421000';
        if (c.includes('impôt')   || d.includes('impôt'))    return '441000';
        if (c.includes('assurance')|| d.includes('matmut') || d.includes('macsf')) return '401001';
        if (c.includes('matériel')|| c.includes('achat'))    return '401000';
        if (c.includes('loyer')   || c.includes('formation') || c.includes('honoraires')) return '401000';
        return null; // pas de tiers (frais kilométriques, bancaires...)
    }

    function lib(code) {
        return PLAN[code] || ('Compte ' + code);
    }

    // ── Écritures double-entrée pour une transaction ──────────────────────────
    // Recette :  D/411xxx → C/706000  puis  D/512000 → C/411xxx  → 411xxx soldé
    // Dépense :  D/646xxx → C/431xxx  puis  D/431xxx → C/512000  → 431xxx soldé
    // Sans tiers (IK, frais banc.) : D/625xxx → C/512000  (2 écritures seulement)
    function getEcritures(t) {
        var m    = Math.abs(parseFloat(t.amount || t.montant || 0));
        var isR  = (t.type||'').toLowerCase() === 'recette';
        var cat  = t.category || t.categorie || '';
        var desc = t.description || '';
        var cG   = t.compte_code || getGestion(t.type, cat, desc);
        var cT   = getTiers(t, cat);
        var res  = [];

        if (!cG) return []; // transaction non classée → exclue de la balance

        if (cT) {
            if (isR) {
                res.push({code:cT,      debit:m, credit:0});
                res.push({code:cG,      debit:0, credit:m});
                res.push({code:'512000',debit:m, credit:0});
                res.push({code:cT,      debit:0, credit:m});
            } else {
                res.push({code:cG,      debit:m, credit:0});
                res.push({code:cT,      debit:0, credit:m});
                res.push({code:cT,      debit:m, credit:0});
                res.push({code:'512000',debit:0, credit:m});
            }
        } else {
            res.push({code:cG,      debit:isR?0:m, credit:isR?m:0});
            res.push({code:'512000',debit:isR?m:0, credit:isR?0:m});
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
            var res = await Promise.all([
                sc.from('transactions').select('*').order('date',{ascending:true}),
                sc.from('plan_comptable').select('code, nom')
            ]);
            if (res[0].error) throw new Error(res[0].error.message);

            // Indexer le plan comptable
            (res[1].data || []).forEach(function(r){ PLAN[r.code] = r.nom; });

            var transactions = res[0].data || [];

            // Années
            var anneesSet = {};
            transactions.forEach(function(t){ var a=anneeOf(t.date); if(a) anneesSet[a]=true; });
            var annees = Object.keys(anneesSet).map(Number).sort(function(a,b){return b-a;});
            if (!annees.length) annees = [new Date().getFullYear()];
            var anneeActive = parseInt(window.anneeBalanceSelectionnee);
            if (!anneesSet[anneeActive]) anneeActive = annees[0];

            // Construire les comptes
            var comptes = {};
            function add(code, debit, credit, tx) {
                if (!comptes[code]) comptes[code] = {code:code, lib:lib(code), debit:0, credit:0, detail:[]};
                comptes[code].debit  += debit;
                comptes[code].credit += credit;
                if (tx && (debit>0 || credit>0))
                    comptes[code].detail.push({date:tx.date, desc:tx.description||'—', cat:tx.category||'—', debit:debit, credit:credit});
            }

            var nonClassees = [];
            transactions.forEach(function(t) {
                if (anneeOf(t.date) !== anneeActive) return;
                var ecr = getEcritures(t);
                if (!ecr.length) {
                    nonClassees.push(t); // transaction sans compte gestion reconnu
                } else {
                    ecr.forEach(function(e){ add(e.code, e.debit, e.credit, t); });
                }
            });

            // Totaux et liste
            var totD=0,totC=0,totSD=0,totSC=0;
            var liste = Object.values(comptes).map(function(c) {
                var diff=c.debit-c.credit, sd=diff>0?diff:0, sc2=diff<0?-diff:0;
                totD+=c.debit; totC+=c.credit; totSD+=sd; totSC+=sc2;
                return {code:c.code,lib:c.lib,debit:c.debit,credit:c.credit,sd:sd,sc:sc2,detail:c.detail};
            }).sort(function(a,b){ return a.code.localeCompare(b.code,undefined,{numeric:true}); });

            var nbTx = transactions.filter(function(t){return anneeOf(t.date)===anneeActive;}).length;
            var optAnnees = annees.map(function(a){
                return '<option value="'+a+'"'+(a===anneeActive?' selected':'')+'>'+a+'</option>';
            }).join('');

            var rowsHtml = !liste.length
                ? '<tr><td colspan="6" style="padding:30px;text-align:center;color:#94a3b8;">Aucune transaction pour '+anneeActive+'</td></tr>'
                : liste.map(function(c) {
                    var uid  = 'b_'+c.code.replace(/\W/g,'_');
                    var soldé = Math.abs(c.debit-c.credit) < 0.005;
                    var bgRow = c.code.charAt(0)==='4' ? '#fffbeb' : 'white';
                    var detailRows = c.detail.map(function(d){
                        return '<tr style="background:#f8fafc;">'
                            +'<td style="padding:3px 10px 3px 28px;font-size:11px;color:#64748b;">'+d.date+'</td>'
                            +'<td style="padding:3px 10px;font-size:11px;color:#94a3b8;font-style:italic;">'+d.cat+'</td>'
                            +'<td colspan="2" style="padding:3px 10px;font-size:11px;color:#475569;">'+d.desc+'</td>'
                            +'<td style="padding:3px 10px;text-align:right;font-size:11px;color:#dc2626;">'+(d.debit>0.001?fmt(d.debit):'')+'</td>'
                            +'<td style="padding:3px 10px;text-align:right;font-size:11px;color:#16a34a;">'+(d.credit>0.001?fmt(d.credit):'')+'</td>'
                            +'</tr>';
                    }).join('');
                    return '<tr style="border-bottom:1px solid #f1f5f9;background:'+bgRow+';cursor:pointer;" '
                        +'onclick="var d=document.getElementById(\''+uid+'\');if(d)d.style.display=d.style.display===\'none\'?\'table-row-group\':\'none\'">'
                        +'<td style="padding:9px 14px;font-weight:700;color:#1e293b;">'+c.code+'</td>'
                        +'<td style="padding:9px 14px;color:#475569;">'+c.lib
                        +' <span style="font-size:10px;color:#94a3b8;">('+c.detail.length+')</span>'
                        +(soldé?' <span style="font-size:10px;color:#16a34a;font-weight:600;">✓ Soldé</span>':'')+'</td>'
                        +'<td style="padding:9px 14px;text-align:right;color:#dc2626;font-weight:600;">'+fmt(c.debit)+'</td>'
                        +'<td style="padding:9px 14px;text-align:right;color:#16a34a;font-weight:600;">'+fmt(c.credit)+'</td>'
                        +'<td style="padding:9px 14px;text-align:right;color:#2563eb;font-weight:700;">'+fmt(c.sd)+'</td>'
                        +'<td style="padding:9px 14px;text-align:right;font-weight:700;">'+fmt(c.sc)+'</td>'
                        +'</tr>'
                        +'<tbody id="'+uid+'" style="display:none;">'+detailRows+'</tbody>';
                }).join('');

            el.innerHTML =
                '<div style="background:white;border:1px solid #e2e8f0;border-radius:10px;padding:20px;">'
                +'<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;padding-bottom:12px;border-bottom:1px solid #f1f5f9;margin-bottom:14px;">'
                +'<h2 style="margin:0;font-size:15px;font-weight:700;">⚖️ Balance Générale — '+anneeActive
                +' <small style="color:#64748b;font-weight:400;">('+nbTx+' transactions)</small></h2>'
                +'<div style="display:flex;align-items:center;gap:8px;background:#f8fafc;border:1px solid #e2e8f0;padding:6px 12px;border-radius:8px;">'
                +'<label style="font-size:12px;font-weight:700;color:#64748b;">Exercice :</label>'
                +'<select onchange="window.changerAnneeBalance(this.value)" style="background:white;border:1px solid #cbd5e1;border-radius:4px;padding:3px 8px;font-weight:700;font-size:12px;cursor:pointer;">'
                +optAnnees+'</select></div></div>'
                +'<p style="font-size:11px;color:#94a3b8;margin-bottom:10px;">💡 Cliquer sur une ligne pour voir le détail — Les comptes 4xx (fond jaune) sont soldés automatiquement</p>'
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
            el.innerHTML='<div style="padding:20px;background:#fef2f2;border-radius:8px;color:#dc2626;">❌ Erreur : '+err.message+'</div>';
        }
    }

    window.changerAnneeBalance = function(a){ window.anneeBalanceSelectionnee=parseInt(a); afficherBalance(); };
    window.initBalanceModule = afficherBalance;
})();
