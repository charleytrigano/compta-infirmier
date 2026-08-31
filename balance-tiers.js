/**
 * balance-tiers.js — Balance Auxiliaire Clients / Fournisseurs / Organismes
 * Affiche le détail par tiers individuel depuis les transactions
 */
(function () {
    window.anneeBTiers = window.anneeBTiers || new Date().getFullYear();

    function fmt(n) {
        if (!n || Math.abs(n) < 0.001) return '—';
        return Number(n).toLocaleString('fr-FR', {style:'currency', currency:'EUR', minimumFractionDigits:2});
    }
    function anneeOf(d) {
        var m = String(d||'').match(/(20\d{2})/);
        return m ? parseInt(m[1]) : null;
    }

    // Déterminer le compte tiers d'une transaction
    function getCodeTiers(t, tiersParId, cat) {
        // 1. tiers_id → compte exact depuis table tiers
        if (t.tiers_id && tiersParId[t.tiers_id]) return {
            code: tiersParId[t.tiers_id].compte,
            nom:  tiersParId[t.tiers_id].nom
        };
        // 2. compte_tiers_code explicit
        if (t.compte_tiers_code) return {
            code: t.compte_tiers_code,
            nom:  t.nom_tiers || t.compte_tiers_libelle || t.compte_tiers_code
        };
        // 3. Déduction catégorie
        var c = (cat||'').toLowerCase(), d = (t.description||'').toLowerCase();
        var isR = (t.type||'').toLowerCase()==='recette';
        if (isR) return {code:'411000', nom:'Clients / CPAM (collectif)'};
        if (c.includes('carpimko') && (c.includes('prévoyance')||d.includes('prévoyance'))) return {code:'437200', nom:'CARPIMKO — Prévoyance'};
        if (c.includes('carpimko') && (c.includes('invalidité')||d.includes('invalidité'))) return {code:'437300', nom:'CARPIMKO — Invalidité'};
        if (c.includes('carpimko')||d.includes('carpimko')) return {code:'437100', nom:'CARPIMKO — Retraite'};
        if (c.includes('urssaf')  ||d.includes('urssaf'))   return {code:'431000', nom:'URSSAF'};
        if (c.includes('rétrocession'))                      return {code:'421000', nom:'Rétrocession Titulaire'};
        if (c.includes('impôt')   ||d.includes('impôt'))    return {code:'441000', nom:'État — Impôts'};
        if (c.includes('assurance')||d.includes('matmut')||d.includes('macsf')) return {code:'401001', nom:'Assurance professionnelle'};
        if (c.includes('matériel')||c.includes('achat'))    return {code:'401000', nom:'Fournisseurs matériel'};
        if (c.includes('loyer')   ||c.includes('formation')) return {code:'401000', nom:'Fournisseurs'};
        return null;
    }

    async function afficherBalanceTiers() {
        var el = document.getElementById('balance-tiers-contenu');
        if (!el) return;
        el.innerHTML = '<p style="padding:20px;text-align:center;color:#64748b;">⏳ Chargement...</p>';

        var sc = window.supabaseClient;
        if (!sc) { setTimeout(afficherBalanceTiers, 500); return; }

        try {
            var res = await Promise.all([
                sc.from('transactions').select('*').order('date',{ascending:true}),
                sc.from('tiers').select('*').eq('actif',true),
                sc.from('plan_comptable').select('code,nom').eq('type','Tiers')
            ]);
            if (res[0].error) throw new Error(res[0].error.message);

            var transactions = res[0].data || [];
            var tiersParId   = {};
            (res[1].data||[]).forEach(function(t){ tiersParId[t.id]=t; });
            var planTiers = {};
            (res[2].data||[]).forEach(function(r){ planTiers[r.code]=r.nom; });

            // Années
            var anneesSet={};
            transactions.forEach(function(t){var a=anneeOf(t.date);if(a)anneesSet[a]=true;});
            var annees=Object.keys(anneesSet).map(Number).sort(function(a,b){return b-a;});
            if (!annees.length) annees=[new Date().getFullYear()];
            var anneeActive=parseInt(window.anneeBTiers);
            if (!anneesSet[anneeActive]) anneeActive=annees[0];

            // Construire les comptes tiers
            var comptes = {};
            transactions.forEach(function(t) {
                if (anneeOf(t.date) !== anneeActive) return;
                var m    = Math.abs(parseFloat(t.amount||t.montant||0));
                var isR  = (t.type||'').toLowerCase()==='recette';
                var cat  = t.category||t.categorie||'';
                var ct   = getCodeTiers(t, tiersParId, cat);
                if (!ct) return;

                var code = ct.code;
                var nom  = planTiers[code] || ct.nom;
                if (!comptes[code]) comptes[code]={code:code,nom:nom,debit:0,credit:0,detail:[]};

                // Double entrée tiers :
                // Recette  : D tiers / C tiers  (soldé) → mouvement = crédit net
                // Dépense  : D tiers / C tiers  (soldé) → mouvement = débit net
                // Pour la balance auxiliaire on affiche le mvt "net" du tiers
                if (isR) {
                    // Tiers client : créancier → crédit
                    comptes[code].credit += m;
                    comptes[code].debit  += m; // soldé
                } else {
                    // Tiers fournisseur : débiteur → débit
                    comptes[code].debit  += m;
                    comptes[code].credit += m; // soldé
                }

                comptes[code].detail.push({
                    date:t.date,
                    desc:t.description||'—',
                    cat: cat||'—',
                    isR: isR,
                    montant: m
                });
            });

            // Regrouper par classe
            var groupes = {
                '411':'🧑‍⚕️ Clients — Patients & Caisses',
                '421':'🔄 Rétrocession Titulaire',
                '431':'🏛️ URSSAF',
                '437':'🏥 CARPIMKO',
                '441':'🏦 État & Impôts',
                '401':'📦 Fournisseurs',
                '438':'📋 Charges à payer',
                '445':'💶 TVA',
            };

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
                html += '<p style="text-align:center;color:#94a3b8;padding:20px;">Aucun mouvement de tiers pour '+anneeActive+'.</p></div>';
                el.innerHTML = html;
                return;
            }

            // Afficher par groupe
            Object.keys(groupes).forEach(function(prefix) {
                var liste = Object.values(comptes)
                    .filter(function(c){ return c.code.substring(0,3)===prefix; })
                    .sort(function(a,b){ return a.code.localeCompare(b.code,undefined,{numeric:true}); });
                if (!liste.length) return;

                html += '<div style="margin-bottom:20px;">'
                    +'<div style="font-size:12px;font-weight:800;color:#1e293b;text-transform:uppercase;'
                    +'letter-spacing:.06em;padding:8px 12px;background:#f1f5f9;border-radius:6px;margin-bottom:8px;">'
                    +groupes[prefix]+'</div>'
                    +'<table style="width:100%;border-collapse:collapse;font-size:13px;">'
                    +'<thead><tr style="background:#f8fafc;color:#475569;">'
                    +'<th style="padding:8px 12px;text-align:left;">Compte</th>'
                    +'<th style="padding:8px 12px;text-align:left;">Nom</th>'
                    +'<th style="padding:8px 12px;text-align:center;">Nb mvts</th>'
                    +'<th style="padding:8px 12px;text-align:right;white-space:nowrap;">Total mouvements</th>'
                    +'<th style="padding:8px 12px;text-align:center;">Solde</th>'
                    +'</tr></thead><tbody>';

                liste.forEach(function(c) {
                    var uid='bt_'+c.code.replace(/\W/g,'_');
                    var total=Math.max(c.debit,c.credit); // montant net mouvementé
                    var solde=c.debit-c.credit;
                    var soldeTxt=Math.abs(solde)<0.005
                        ?'<span style="color:#16a34a;font-weight:600;">✓ Soldé</span>'
                        :'<span style="color:#dc2626;font-weight:600;">'+fmt(Math.abs(solde))+(solde>0?' D':' C')+'</span>';

                    var detailRows=c.detail.map(function(d){
                        return '<tr style="background:#f8fafc;font-size:11px;">'
                            +'<td style="padding:3px 12px 3px 30px;color:#64748b;">'+d.date+'</td>'
                            +'<td style="padding:3px 12px;color:#94a3b8;font-style:italic;">'+d.cat+'</td>'
                            +'<td colspan="2" style="padding:3px 12px;color:#475569;">'+d.desc+'</td>'
                            +'<td style="padding:3px 12px;text-align:center;color:'+(d.isR?'#16a34a':'#dc2626')+';font-weight:600;">'
                            +(d.isR?'+ ':'-')+fmt(d.montant)+'</td>'
                            +'</tr>';
                    }).join('');

                    html += '<tr style="border-bottom:1px solid #f1f5f9;cursor:pointer;" '
                        +'onclick="var d=document.getElementById(\''+uid+'\');if(d)d.style.display=d.style.display===\'none\'?\'table-row-group\':\'none\'">'
                        +'<td style="padding:9px 12px;font-weight:700;color:#1e293b;">'+c.code+'</td>'
                        +'<td style="padding:9px 12px;color:#334155;">'+c.nom
                        +' <span style="font-size:10px;color:#94a3b8;">('+c.detail.length+' mvts)</span></td>'
                        +'<td style="padding:9px 12px;text-align:center;color:#64748b;">'+c.detail.length+'</td>'
                        +'<td style="padding:9px 12px;text-align:right;font-weight:600;color:#2563eb;">'+fmt(total)+'</td>'
                        +'<td style="padding:9px 12px;text-align:center;">'+soldeTxt+'</td>'
                        +'</tr>'
                        +'<tbody id="'+uid+'" style="display:none;">'+detailRows+'</tbody>';
                });
                html += '</tbody></table></div>';
            });

            html += '</div>';
            el.innerHTML = html;

        } catch(err) {
            el.innerHTML='<div style="padding:20px;background:#fef2f2;border-radius:8px;color:#dc2626;">❌ Erreur : '+err.message+'</div>';
        }
    }

    window.changerAnneeBalanceTiers = function(a){ window.anneeBTiers=parseInt(a); afficherBalanceTiers(); };
    window.initBalanceTiersModule   = afficherBalanceTiers;
})();
