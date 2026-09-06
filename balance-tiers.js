/**
 * balance-tiers.js — Balance Auxiliaire des Tiers
 * Colonnes : Débit / Crédit / Solde Débiteur / Solde Créditeur
 */
(function () {
    window.anneeBTiers = window.anneeBTiers || new Date().getFullYear();

    function fmt(n) {
        if (!n || Math.abs(n) < 0.001) return '—';
        return Number(n).toLocaleString('fr-FR', {style:'currency', currency:'EUR', minimumFractionDigits:2});
    }
    function anneeOf(d) { var m=String(d||'').match(/(20\d{2})/); return m?parseInt(m[1]):null; }

    function getCodeTiers(t, tiersParId) {
        var cD = t.compte_debit||'', cC = t.compte_credit||'';
        if (cD && cD.charAt(0)==='4') return { code:cD, nom:t.nom_tiers||t.compte_tiers||cD };
        if (cC && cC.charAt(0)==='4') return { code:cC, nom:t.nom_tiers||t.compte_tiers||cC };
        if (t.tiers_id && tiersParId[t.tiers_id]) return { code:tiersParId[t.tiers_id].compte, nom:tiersParId[t.tiers_id].nom };
        if (t.compte_tiers) return { code:t.compte_tiers, nom:t.nom_tiers||t.compte_tiers };
        if (t.compte_tiers_code) return { code:t.compte_tiers_code, nom:t.nom_tiers||t.compte_tiers_code };
        var c=(t.category||t.categorie||'').toLowerCase(), d=(t.description||'').toLowerCase();
        var isR=(t.type||'').toLowerCase()==='recette';
        if (isR)                                                 return {code:'411000',nom:'Clients / CPAM'};
        if (c.includes('carpimko')&&c.includes('prévoyance'))    return {code:'437200',nom:'CARPIMKO Prévoyance'};
        if (c.includes('carpimko')&&c.includes('invalidité'))    return {code:'437300',nom:'CARPIMKO Invalidité'};
        if (c.includes('carpimko')||d.includes('carpimko'))      return {code:'437100',nom:'CARPIMKO Retraite'};
        if (c.includes('urssaf')  ||d.includes('urssaf'))        return {code:'431000',nom:'URSSAF'};
        if (c.includes('rétrocession'))                          return {code:'421000',nom:'Rétrocession'};
        if (c.includes('impôt')   ||d.includes('impôt'))         return {code:'441000',nom:'DGFiP'};
        if (c.includes('assurance')||d.includes('matmut'))       return {code:'401001',nom:'Assurance'};
        if (c.includes('matériel')||c.includes('achat'))         return {code:'401000',nom:'Fournisseurs'};
        return null;
    }

    var GROUPES = {
        '411':'🧑‍⚕️ Clients — Patients & Caisses',
        '421':'🔄 Rétrocession Titulaire',
        '431':'🏛️ URSSAF',
        '437':'🏥 CARPIMKO',
        '441':'🏦 État & Impôts',
        '401':'📦 Fournisseurs',
    };

    async function afficherBalanceTiers() {
        var el = document.getElementById('balance-tiers-contenu');
        if (!el) return;
        el.innerHTML = '<p style="padding:20px;text-align:center;color:#64748b;">⏳ Chargement...</p>';
        var sc = window.supabaseClient;
        if (!sc) { setTimeout(afficherBalanceTiers, 500); return; }

        try {
            var res = await Promise.all([
                sc.from('journal_banque').select('*').order('date',{ascending:true}).order('created_at',{ascending:true}),
                sc.from('journal_od').select('*').order('date',{ascending:true}).order('created_at',{ascending:true}),
                sc.from('tiers').select('*').eq('actif',true),
                sc.from('plan_comptable').select('code,nom').eq('type','Tiers')
            ]);
            if (res[0].error) throw new Error(res[0].error.message);

            var transactions = (res[0].data||[]).concat(res[1].data||[]);
            var tiersParId = {}; (res[2].data||[]).forEach(function(t){ tiersParId[t.id]=t; });
            var planTiers  = {}; (res[3].data||[]).forEach(function(r){ planTiers[r.code]=r.nom; });

            var anneesSet={};
            transactions.forEach(function(t){ var a=anneeOf(t.date); if(a) anneesSet[a]=true; });
            var annees=Object.keys(anneesSet).map(Number).sort(function(a,b){return b-a;});
            if (!annees.length) annees=[new Date().getFullYear()];
            var anneeActive=parseInt(window.anneeBTiers);
            if (!anneesSet[anneeActive]) anneeActive=annees[0];

            var comptes = {};
            transactions.forEach(function(t) {
                if (anneeOf(t.date) !== anneeActive) return;
                var m   = Math.abs(parseFloat(t.montant||t.amount||0));
                var ct  = getCodeTiers(t, tiersParId);
                if (!ct) return;

                var cD  = t.compte_debit||'', cC = t.compte_credit||'';
                var isR = (t.type||'').toLowerCase()==='recette';
                var code= ct.code;
                var nom = planTiers[code]||ct.nom;
                if (!comptes[code]) comptes[code]={code:code,nom:nom,debit:0,credit:0,detail:[]};

                // Sens du mouvement pour ce compte tiers
                var mvtDebit=0, mvtCredit=0;
                if      (cD===code)           { mvtDebit=m; }
                else if (cC===code)           { mvtCredit=m; }
                else if (cD.startsWith('512')){ mvtCredit=m; } // encaissement → crédit tiers
                else if (cC.startsWith('512')){ mvtDebit=m;  } // décaissement → débit tiers
                else if (isR)                 { mvtCredit=m; }
                else                          { mvtDebit=m;  }

                comptes[code].debit  += mvtDebit;
                comptes[code].credit += mvtCredit;
                comptes[code].detail.push({
                    date:  t.date||'—',
                    desc:  t.libelle||t.description||'—',
                    debit: mvtDebit,
                    credit:mvtCredit
                });
            });

            var optAnnees=annees.map(function(a){
                return '<option value="'+a+'"'+(a===anneeActive?' selected':'')+'>'+a+'</option>';
            }).join('');

            var html='<div style="background:white;border:1px solid #e2e8f0;border-radius:10px;padding:20px;">'
                +'<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;padding-bottom:12px;border-bottom:1px solid #f1f5f9;margin-bottom:14px;">'
                +'<h2 style="margin:0;font-size:15px;font-weight:700;">👥 Balance Auxiliaire des Tiers — '+anneeActive+'</h2>'
                +'<div style="display:flex;align-items:center;gap:8px;background:#f8fafc;border:1px solid #e2e8f0;padding:6px 12px;border-radius:8px;">'
                +'<label style="font-size:12px;font-weight:700;color:#64748b;">Exercice :</label>'
                +'<select onchange="window.changerAnneeBalanceTiers(this.value)" style="background:white;border:1px solid #cbd5e1;border-radius:4px;padding:3px 8px;font-weight:700;font-size:12px;cursor:pointer;">'
                +optAnnees+'</select></div></div>';

            if (!Object.keys(comptes).length) {
                html += '<p style="text-align:center;color:#94a3b8;padding:30px;">Aucun mouvement pour '+anneeActive+'.</p></div>';
                el.innerHTML = html; return;
            }

            Object.keys(GROUPES).forEach(function(prefix) {
                var liste = Object.values(comptes)
                    .filter(function(c){ return String(c.code).substring(0,3)===prefix; })
                    .sort(function(a,b){ return a.code.localeCompare(b.code,undefined,{numeric:true}); });
                if (!liste.length) return;

                html += '<div style="margin-bottom:20px;">'
                    +'<div style="font-size:12px;font-weight:800;color:white;text-transform:uppercase;'
                    +'letter-spacing:.06em;padding:8px 14px;background:#1e293b;border-radius:6px 6px 0 0;margin-bottom:0;">'
                    +GROUPES[prefix]+'</div>'
                    +'<table style="width:100%;border-collapse:collapse;font-size:13px;border:1px solid #e2e8f0;">'
                    +'<thead><tr style="background:#f1f5f9;color:#475569;">'
                    +'<th style="padding:9px 12px;text-align:left;">Compte</th>'
                    +'<th style="padding:9px 12px;text-align:left;">Intitulé</th>'
                    +'<th style="padding:9px 12px;text-align:right;color:#dc2626;white-space:nowrap;">Total Débit</th>'
                    +'<th style="padding:9px 12px;text-align:right;color:#16a34a;white-space:nowrap;">Total Crédit</th>'
                    +'<th style="padding:9px 12px;text-align:right;color:#dc2626;white-space:nowrap;">Solde Débiteur</th>'
                    +'<th style="padding:9px 12px;text-align:right;color:#16a34a;white-space:nowrap;">Solde Créditeur</th>'
                    +'</tr></thead><tbody>';

                liste.forEach(function(c) {
                    var uid   = 'bt_'+c.code.replace(/\W/g,'_');
                    var solde = c.debit - c.credit;
                    var sd    = solde > 0 ? solde : 0;
                    var sc2   = solde < 0 ? -solde : 0;
                    var soldé = Math.abs(solde) < 0.005;
                    var bgRow = soldé ? 'white' : '#fffbeb';

                    var detailRows = c.detail.map(function(d){
                        return '<tr style="background:#f8fafc;font-size:11px;">'
                            +'<td style="padding:3px 12px 3px 28px;color:#64748b;white-space:nowrap;">'+d.date+'</td>'
                            +'<td style="padding:3px 12px;color:#475569;" colspan="3">'+d.desc+'</td>'
                            +'<td style="padding:3px 12px;text-align:right;color:#dc2626;">'+(d.debit>0.001?fmt(d.debit):'—')+'</td>'
                            +'<td style="padding:3px 12px;text-align:right;color:#16a34a;">'+(d.credit>0.001?fmt(d.credit):'—')+'</td>'
                            +'</tr>';
                    }).join('');

                    html += '<tr style="border-bottom:1px solid #f1f5f9;background:'+bgRow+';cursor:pointer;" '
                        +'onclick="var d=document.getElementById(\''+uid+'\');if(d)d.style.display=d.style.display===\'none\'?\'table-row-group\':\'none\'">'
                        +'<td style="padding:9px 12px;font-weight:700;color:#1e293b;">'+c.code+'</td>'
                        +'<td style="padding:9px 12px;color:#334155;">'+c.nom
                        +' <span style="font-size:10px;color:#94a3b8;">('+c.detail.length+')</span>'
                        +(soldé?' <span style="color:#16a34a;font-size:10px;font-weight:600;">✓ Soldé</span>':'')+'</td>'
                        +'<td style="padding:9px 12px;text-align:right;color:#dc2626;font-weight:600;">'+(c.debit>0.001?fmt(c.debit):'—')+'</td>'
                        +'<td style="padding:9px 12px;text-align:right;color:#16a34a;font-weight:600;">'+(c.credit>0.001?fmt(c.credit):'—')+'</td>'
                        +'<td style="padding:9px 12px;text-align:right;font-weight:700;color:#dc2626;">'+(sd>0.001?fmt(sd):'—')+'</td>'
                        +'<td style="padding:9px 12px;text-align:right;font-weight:700;color:#16a34a;">'+(sc2>0.001?fmt(sc2):'—')+'</td>'
                        +'</tr>'
                        +'<tbody id="'+uid+'" style="display:none;">'+detailRows+'</tbody>';
                });
                // Ligne totaux du groupe
                var totD=0, totC=0, totSD=0, totSC=0;
                liste.forEach(function(c){
                    var s=c.debit-c.credit;
                    totD+=c.debit; totC+=c.credit;
                    totSD+=(s>0?s:0); totSC+=(s<0?-s:0);
                });
                html += '<tr style="background:#f1f5f9;font-weight:700;border-top:2px solid #e2e8f0;">'
                    +'<td colspan="2" style="padding:9px 12px;text-align:right;color:#475569;font-size:12px;text-transform:uppercase;">Total :</td>'
                    +'<td style="padding:9px 12px;text-align:right;color:#dc2626;">'+fmt(totD)+'</td>'
                    +'<td style="padding:9px 12px;text-align:right;color:#16a34a;">'+fmt(totC)+'</td>'
                    +'<td style="padding:9px 12px;text-align:right;color:#dc2626;">'+fmt(totSD)+'</td>'
                    +'<td style="padding:9px 12px;text-align:right;color:#16a34a;">'+fmt(totSC)+'</td>'
                    +'</tr>';
                html += '</tbody></table></div>';
            });

            // Grand total général
            var gtD=0, gtC=0, gtSD=0, gtSC=0;
            Object.values(comptes).forEach(function(c){
                var s=c.debit-c.credit;
                gtD+=c.debit; gtC+=c.credit;
                gtSD+=(s>0?s:0); gtSC+=(s<0?-s:0);
            });
            html += '<table style="width:100%;border-collapse:collapse;font-size:13px;margin-top:4px;border:2px solid #1e293b;border-radius:6px;">'
                +'<tr style="background:#1e293b;color:white;font-weight:700;">'
                +'<td colspan="2" style="padding:10px 14px;text-align:right;font-size:12px;text-transform:uppercase;letter-spacing:.05em;">TOTAUX GÉNÉRAUX</td>'
                +'<td style="padding:10px 14px;text-align:right;font-size:14px;">'+fmt(gtD)+'</td>'
                +'<td style="padding:10px 14px;text-align:right;font-size:14px;">'+fmt(gtC)+'</td>'
                +'<td style="padding:10px 14px;text-align:right;font-size:14px;">'+fmt(gtSD)+'</td>'
                +'<td style="padding:10px 14px;text-align:right;font-size:14px;">'+fmt(gtSC)+'</td>'
                +'</tr></table>';

            html += '</div>';
            el.innerHTML = html;

        } catch(err) {
            el.innerHTML='<div style="padding:20px;background:#fef2f2;border-radius:8px;color:#dc2626;">❌ Erreur : '+err.message+'</div>';
        }
    }

    window.changerAnneeBalanceTiers = function(a){ window.anneeBTiers=parseInt(a); afficherBalanceTiers(); };
    window.initBalanceTiersModule   = afficherBalanceTiers;
})();
