// grand-livre.js — Grand Livre Général depuis journal_banque + journal_od
(function () {
    window.anneeGrandLivre = window.anneeGrandLivre || new Date().getFullYear().toString();

    function sc()  { return window.supabaseClient || null; }
    function fmt(n){ return new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR'}).format(n||0); }
    function anneeOf(d){ var m=String(d||'').match(/(20\d{2})/); return m?parseInt(m[1]):null; }

    function libPlan(code){ return window._PLAN_GL ? (window._PLAN_GL[code]||('Compte '+code)) : ('Compte '+code); }

    function ajouterLigne(comptes, code, lib, ligne) {
        if (!code) return;
        code = String(code).trim();
        if (!comptes[code]) comptes[code] = {code:code, lib:lib||libPlan(code), lignes:[]};
        comptes[code].lignes.push(ligne);
    }

    async function chargerEtAfficherGrandLivre() {
        var container = document.getElementById('grandlivre-contenu');
        if (!container) return;
        container.innerHTML = '<p style="color:#64748b;padding:20px;text-align:center;">⏳ Chargement...</p>';

        var supabase = sc();
        if (!supabase) { setTimeout(chargerEtAfficherGrandLivre, 600); return; }

        try {
            // Charger plan comptable, journal_banque et journal_od
            var res = await Promise.all([
                supabase.from('journal_banque').select('*').order('date',{ascending:true}).order('created_at',{ascending:true}),
                supabase.from('journal_od').select('*').order('date',{ascending:true}).order('created_at',{ascending:true}),
                supabase.from('plan_comptable').select('code,nom')
            ]);

            if (res[0].error) throw new Error(res[0].error.message);

            // Indexer le plan comptable
            var plan = {};
            (res[2].data||[]).forEach(function(r){ plan[r.code]=r.nom; });
            window._PLAN_GL = plan;

            // Fusionner banque + OD
            var bq = (res[0].data||[]).map(function(l){ return Object.assign({}, l, {_journal:'BQ'}); });
            var od = (res[1].data||[]).map(function(l){ return Object.assign({}, l, {_journal:'OD'}); });
            var all = bq.concat(od);

            // Années
            var anneesSet = {};
            all.forEach(function(l){ var a=anneeOf(l.date); if(a) anneesSet[a]=true; });
            var annees = Object.keys(anneesSet).map(Number).sort(function(a,b){return b-a;});
            if (!annees.length) annees = [new Date().getFullYear()];
            var anneeActive = parseInt(window.anneeGrandLivre||annees[0]);
            if (!anneesSet[anneeActive]) anneeActive = annees[0];

            var lignes = all.filter(function(l){ return anneeOf(l.date)===anneeActive; });

            var optAnnees = annees.map(function(a){
                return '<option value="'+a+'"'+(a===anneeActive?' selected':'')+'>'+a+'</option>';
            }).join('');

            var header = '<div style="display:flex;justify-content:space-between;align-items:center;'
                +'background:white;padding:12px 16px;border:1px solid #e2e8f0;border-radius:8px;margin-bottom:15px;">'
                +'<span style="font-weight:700;font-size:15px;">📚 Grand Livre — Exercice '+anneeActive
                +' <small style="color:#64748b;font-weight:400;">('+lignes.length+' écritures)</small></span>'
                +'<div style="display:flex;align-items:center;gap:8px;">'
                +'<label style="font-size:12px;color:#64748b;font-weight:600;">Année :</label>'
                +'<select onchange="window.changerAnneeGrandLivre(this.value)" '
                +'style="padding:4px 8px;border-radius:6px;border:1px solid #cbd5e1;font-weight:700;">'
                +optAnnees+'</select></div></div>';

            if (!lignes.length) {
                container.innerHTML = header+'<p style="padding:20px;text-align:center;color:#64748b;background:#f8fafc;border-radius:8px;">Aucune écriture pour '+anneeActive+'.</p>';
                return;
            }

            // Construire les comptes directement depuis compte_debit/compte_credit
            var comptes = {};

            // ── Soldes à nouveau (comptes 1-5) ───────────────────────────────────
            var resHGL = await Promise.all([
                supabase.from('journal_banque').select('compte_debit,compte_credit,montant')
                    .lt('date', anneeActive+'-01-01'),
                supabase.from('journal_od').select('compte_debit,compte_credit,montant')
                    .lt('date', anneeActive+'-01-01')
            ]);
            var sanGL = {};
            (resHGL[0].data||[]).concat(resHGL[1].data||[]).forEach(function(l) {
                var m = Math.abs(parseFloat(l.montant||0));
                [['d',l.compte_debit],['c',l.compte_credit]].forEach(function(p) {
                    var code=p[1];
                    if (!code || !['1','2','3','4','5'].includes(code.charAt(0))) return;
                    if (!sanGL[code]) sanGL[code]={d:0,c:0};
                    if (p[0]==='d') sanGL[code].d+=m; else sanGL[code].c+=m;
                });
            });
            // Créer les lignes SAN
            Object.keys(sanGL).forEach(function(code) {
                var s=sanGL[code], solde=s.d-s.c;
                if (Math.abs(solde)<0.005) return;
                var lib = plan[code]||code;
                ajouterLigne(comptes, code, lib, {
                    date:'01/01/'+anneeActive, journal:'SAN',
                    desc:'★ Solde à Nouveau',  tiers:'',
                    debit: solde>0?solde:0, credit:solde<0?-solde:0
                });
            });

            lignes.forEach(function(l) {
                var m = Math.abs(parseFloat(l.montant||0));
                var cD = l.compte_debit, cC = l.compte_credit;
                var desc = l.libelle||'—', tiers = l.nom_tiers||'', jnl = l._journal;
                var date = l.date||'—';

                ajouterLigne(comptes, cD, plan[cD]||cD, {date:date,journal:jnl,desc:desc,tiers:tiers,debit:m,credit:0});
                ajouterLigne(comptes, cC, plan[cC]||cC, {date:date,journal:jnl,desc:desc,tiers:tiers,debit:0,credit:m});
            });

            // Rendu
            var html = header+'<div style="display:flex;flex-direction:column;gap:16px;">';
            Object.keys(comptes).sort(function(a,b){
                var na=parseInt(a)||0, nb=parseInt(b)||0;
                return na!==nb ? na-nb : a.localeCompare(b);
            }).forEach(function(code) {
                var c=comptes[code], totD=0, totC=0;
                var isBilan=['1','2','3','4','5'].includes(code.charAt(0));

                var rows=c.lignes.map(function(l){
                    totD+=l.debit; totC+=l.credit;
                    return '<tr style="border-bottom:1px solid #f1f5f9;">'
                        +'<td style="padding:7px 10px;white-space:nowrap;">'+l.date+'</td>'
                        +'<td style="padding:7px 10px;font-weight:600;white-space:nowrap;color:#1e293b;">'+l.journal+'</td>'
                        +'<td style="padding:7px 10px;">'+l.desc
                        +(l.tiers?' <em style="font-size:11px;color:#64748b;">('+l.tiers+')</em>':'')+'</td>'
                        +'<td style="padding:7px 10px;text-align:right;color:#dc2626;white-space:nowrap;">'+(l.debit>0?fmt(l.debit):'—')+'</td>'
                        +'<td style="padding:7px 10px;text-align:right;color:#16a34a;white-space:nowrap;">'+(l.credit>0?fmt(l.credit):'—')+'</td>'
                        +'</tr>';
                }).join('');

                var solde=totD-totC;
                var soldeTxt=Math.abs(solde)<0.005
                    ?'<span style="color:#16a34a;">✓ Soldé</span>'
                    :solde>0?'<span style="color:#dc2626;">Débiteur : '+fmt(solde)+'</span>'
                    :'<span style="color:#16a34a;">Créditeur : '+fmt(Math.abs(solde))+'</span>';

                html+='<div style="background:white;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.05);">'
                    +'<div style="background:#f8fafc;padding:10px 14px;border-bottom:1px solid #e2e8f0;'
                    +'display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">'
                    +'<div style="display:flex;align-items:center;gap:8px;">'
                    +'<strong style="font-size:14px;">📁 '+code+' — '+c.lib+'</strong>'
                    +'<span style="font-size:11px;padding:2px 7px;border-radius:4px;font-weight:600;'
                    +'background:'+(isBilan?'#e0f2fe':'#fef3c7')+';color:'+(isBilan?'#0369a1':'#b45309')+';">'
                    +(isBilan?'Bilan':'Gestion '+anneeActive)+'</span>'
                    +'</div>'
                    +'<span style="font-size:12px;padding:4px 10px;border-radius:6px;background:#f8fafc;">'+soldeTxt+'</span>'
                    +'</div>'
                    +'<div style="overflow-x:auto;">'
                    +'<table style="width:100%;border-collapse:collapse;font-size:13px;">'
                    +'<thead><tr style="background:#f1f5f9;color:#475569;text-align:left;">'
                    +'<th style="padding:7px 10px;white-space:nowrap;">Date</th>'
                    +'<th style="padding:7px 10px;">Journal</th>'
                    +'<th style="padding:7px 10px;">Description / Tiers</th>'
                    +'<th style="padding:7px 10px;text-align:right;white-space:nowrap;">Débit (€)</th>'
                    +'<th style="padding:7px 10px;text-align:right;white-space:nowrap;">Crédit (€)</th>'
                    +'</tr></thead><tbody>'+rows+'</tbody>'
                    +'<tfoot><tr style="background:#f8fafc;font-weight:700;border-top:2px solid #e2e8f0;">'
                    +'<td colspan="3" style="padding:7px 10px;text-align:right;">Total '+code+' :</td>'
                    +'<td style="padding:7px 10px;text-align:right;color:#dc2626;">'+fmt(totD)+'</td>'
                    +'<td style="padding:7px 10px;text-align:right;color:#16a34a;">'+fmt(totC)+'</td>'
                    +'</tr></tfoot></table></div></div>';
            });
            html+='</div>';
            container.innerHTML = html;

        } catch(err) {
            container.innerHTML='<div style="padding:20px;background:#fef2f2;border-radius:8px;color:#dc2626;">❌ Erreur : '+err.message+'</div>';
        }
    }

    window.changerAnneeGrandLivre      = function(a){ window.anneeGrandLivre=String(a); chargerEtAfficherGrandLivre(); };
    window.afficherGrandLivre          = chargerEtAfficherGrandLivre;
    window.chargerEtAfficherGrandLivre = chargerEtAfficherGrandLivre;
})();
