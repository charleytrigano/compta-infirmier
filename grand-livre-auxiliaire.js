/**
 * grand-livre-auxiliaire.js — Grand Livre Auxiliaire des Tiers
 * Détail chronologique des mouvements par compte tiers (4xx)
 */
(function () {
    window.anneeGLAux = window.anneeGLAux || new Date().getFullYear();

    function fmt(n) {
        if (!n || Math.abs(n) < 0.001) return '—';
        return Number(n).toLocaleString('fr-FR', {style:'currency', currency:'EUR', minimumFractionDigits:2});
    }
    function anneeOf(d) {
        var m = String(d||'').match(/(20\d{2})/);
        return m ? parseInt(m[1]) : null;
    }
    function fmtDate(d) {
        if (!d) return '—';
        try { return new Date(d).toLocaleDateString('fr-FR'); } catch(e) { return d; }
    }

    // ── Déterminer le compte tiers d'une transaction ──────────────────────────
    function getTiers(t, tiersParId) {
        if (t.tiers_id && tiersParId[t.tiers_id]) return {
            code: tiersParId[t.tiers_id].compte,
            nom:  tiersParId[t.tiers_id].nom
        };
        if (t.compte_tiers_code) return {
            code: t.compte_tiers_code,
            nom:  t.nom_tiers || t.compte_tiers_libelle || t.compte_tiers_code
        };
        var c=(t.category||t.categorie||'').toLowerCase(), d=(t.description||'').toLowerCase();
        var isR=(t.type||'').toLowerCase()==='recette';
        if (isR)                                               return {code:'411000',nom:'Clients / CPAM (collectif)'};
        if (c.includes('carpimko')&&(c.includes('prévoyance')||d.includes('prévoyance'))) return {code:'437200',nom:'CARPIMKO — Prévoyance'};
        if (c.includes('carpimko')&&(c.includes('invalidité')||d.includes('invalidité'))) return {code:'437300',nom:'CARPIMKO — Invalidité'};
        if (c.includes('carpimko')||d.includes('carpimko'))    return {code:'437100',nom:'CARPIMKO — Retraite'};
        if (c.includes('urssaf')  ||d.includes('urssaf'))      return {code:'431000',nom:'URSSAF'};
        if (c.includes('rétrocession'))                        return {code:'421000',nom:'Rétrocession Titulaire'};
        if (c.includes('impôt')   ||d.includes('impôt'))      return {code:'441000',nom:'État — Impôts'};
        if (c.includes('assurance')||d.includes('matmut')||d.includes('macsf')) return {code:'401001',nom:'Assurance professionnelle'};
        if (c.includes('matériel')||c.includes('achat'))       return {code:'401000',nom:'Fournisseurs matériel'};
        if (c.includes('loyer')||c.includes('formation'))      return {code:'401000',nom:'Fournisseurs'};
        return null;
    }

    var GROUPES = {
        '411':'🧑‍⚕️ Clients — Patients & Caisses',
        '421':'🔄 Rétrocession Titulaire',
        '431':'🏛️ URSSAF',
        '437':'🏥 CARPIMKO',
        '441':'🏦 État & Impôts',
        '401':'📦 Fournisseurs',
        '438':'📋 Charges à payer',
        '445':'💶 TVA',
    };

    async function afficherGLAux() {
        var el = document.getElementById('gl-aux-contenu');
        if (!el) return;
        el.innerHTML = '<p style="padding:20px;text-align:center;color:#64748b;">⏳ Chargement...</p>';

        var sc = window.supabaseClient;
        if (!sc) { setTimeout(afficherGLAux, 500); return; }

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
            var anneeActive=parseInt(window.anneeGLAux);
            if (!anneesSet[anneeActive]) anneeActive=annees[0];

            // Regrouper les transactions par compte tiers
            var comptes = {};
            transactions.forEach(function(t) {
                if (anneeOf(t.date) !== anneeActive) return;
                var m    = Math.abs(parseFloat(t.amount||t.montant||0));
                var isR  = (t.type||'').toLowerCase()==='recette';
                var ct   = getTiers(t, tiersParId);
                if (!ct) return;

                var code = ct.code;
                var nom  = planTiers[code] || ct.nom;
                if (!comptes[code]) comptes[code] = {code:code, nom:nom, lignes:[]};

                // Pour le GL auxiliaire : on montre le mouvement NET du tiers
                // Recette  → le tiers (client) est crédité (il nous payait)
                // Dépense  → le tiers (fournisseur) est débité (on lui payait)
                comptes[code].lignes.push({
                    date:  t.date,
                    desc:  t.description || '—',
                    ref:   t.facture_numero || '—',
                    debit: isR ? 0 : m,
                    credit:isR ? m : 0,
                });
            });

            var optAnnees = annees.map(function(a){
                return '<option value="'+a+'"'+(a===anneeActive?' selected':'')+'>'+a+'</option>';
            }).join('');

            var html = '<div style="background:white;border:1px solid #e2e8f0;border-radius:10px;padding:20px;">'
                +'<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;padding-bottom:12px;border-bottom:1px solid #f1f5f9;margin-bottom:16px;">'
                +'<h2 style="margin:0;font-size:15px;font-weight:700;">📖 Grand Livre Auxiliaire des Tiers — '+anneeActive+'</h2>'
                +'<div style="display:flex;align-items:center;gap:8px;background:#f8fafc;border:1px solid #e2e8f0;padding:6px 12px;border-radius:8px;">'
                +'<label style="font-size:12px;font-weight:700;color:#64748b;">Exercice :</label>'
                +'<select onchange="window.changerAnneeGLAux(this.value)" style="background:white;border:1px solid #cbd5e1;border-radius:4px;padding:3px 8px;font-weight:700;font-size:12px;cursor:pointer;">'
                +optAnnees+'</select></div></div>';

            if (!Object.keys(comptes).length) {
                html += '<p style="text-align:center;color:#94a3b8;padding:30px;">Aucun mouvement de tiers pour '+anneeActive+'.</p></div>';
                el.innerHTML = html;
                return;
            }

            // Afficher par groupe
            var prefixesTries = Object.keys(GROUPES);
            prefixesTries.forEach(function(prefix) {
                var liste = Object.values(comptes)
                    .filter(function(c){ return String(c.code).substring(0,3)===prefix; })
                    .sort(function(a,b){ return a.code.localeCompare(b.code,undefined,{numeric:true}); });
                if (!liste.length) return;

                html += '<div style="margin-bottom:24px;">'
                    +'<div style="font-size:12px;font-weight:800;color:#1e293b;text-transform:uppercase;'
                    +'letter-spacing:.06em;padding:9px 14px;background:#1e293b;color:white;border-radius:6px 6px 0 0;">'
                    +GROUPES[prefix]+'</div>';

                liste.forEach(function(c) {
                    var lignes = c.lignes.slice().sort(function(a,b){ return a.date.localeCompare(b.date); });
                    var totD=0, totC=0, solde=0;

                    var rows = lignes.map(function(l) {
                        totD   += l.debit;
                        totC   += l.credit;
                        solde  += l.credit - l.debit; // pour client: crédit = positif
                        var soldeTxt = Math.abs(solde)<0.005
                            ? '<span style="color:#16a34a;">Soldé</span>'
                            : solde > 0
                                ? '<span style="color:#16a34a;">'+fmt(solde)+' C</span>'
                                : '<span style="color:#dc2626;">'+fmt(-solde)+' D</span>';
                        return '<tr style="border-bottom:1px solid #f1f5f9;" onmouseover="this.style.background=\'#f8fafc\'" onmouseout="this.style.background=\'white\'">'
                            +'<td style="padding:8px 12px;white-space:nowrap;color:#475569;">'+fmtDate(l.date)+'</td>'
                            +'<td style="padding:8px 12px;color:#334155;">'+l.desc+'</td>'
                            +'<td style="padding:8px 12px;text-align:right;color:#dc2626;white-space:nowrap;">'+(l.debit >0.001?fmt(l.debit) :'—')+'</td>'
                            +'<td style="padding:8px 12px;text-align:right;color:#16a34a;white-space:nowrap;">'+(l.credit>0.001?fmt(l.credit):'—')+'</td>'
                            +'<td style="padding:8px 12px;text-align:right;white-space:nowrap;">'+soldeTxt+'</td>'
                            +'</tr>';
                    }).join('');

                    var soldeF = totC - totD;
                    var soldeFTxt = Math.abs(soldeF)<0.005
                        ? '<span style="color:#16a34a;font-weight:700;">✓ Soldé</span>'
                        : soldeF>0
                            ? '<span style="color:#16a34a;font-weight:700;">'+fmt(soldeF)+' Créditeur</span>'
                            : '<span style="color:#dc2626;font-weight:700;">'+fmt(-soldeF)+' Débiteur</span>';

                    html += '<div style="border:1px solid #e2e8f0;border-top:none;margin-bottom:12px;overflow:hidden;">'
                        // En-tête du compte
                        +'<div style="background:#f8fafc;padding:9px 14px;border-bottom:1px solid #e2e8f0;'
                        +'display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">'
                        +'<span style="font-weight:700;font-size:13px;">📁 '+c.code+' — '+c.nom+'</span>'
                        +'<span style="font-size:12px;padding:4px 12px;background:'
                        +(Math.abs(soldeF)<0.005?'#dcfce7':'#fef2f2')+';border-radius:20px;">'+soldeFTxt+'</span>'
                        +'</div>'
                        // Tableau des mouvements
                        +'<div style="overflow-x:auto;">'
                        +'<table style="width:100%;border-collapse:collapse;font-size:13px;">'
                        +'<thead><tr style="background:#f1f5f9;color:#475569;text-align:left;">'
                        +'<th style="padding:7px 12px;white-space:nowrap;">Date</th>'
                        +'<th style="padding:7px 12px;">Description</th>'
                        +'<th style="padding:7px 12px;text-align:right;color:#dc2626;white-space:nowrap;">Débit (€)</th>'
                        +'<th style="padding:7px 12px;text-align:right;color:#16a34a;white-space:nowrap;">Crédit (€)</th>'
                        +'<th style="padding:7px 12px;text-align:right;white-space:nowrap;">Solde</th>'
                        +'</tr></thead>'
                        +'<tbody>'+rows+'</tbody>'
                        +'<tfoot><tr style="background:#f8fafc;font-weight:700;border-top:2px solid #e2e8f0;">'
                        +'<td colspan="2" style="padding:7px 12px;text-align:right;color:#475569;">TOTAL '+c.code+' :</td>'
                        +'<td style="padding:7px 12px;text-align:right;color:#dc2626;">'+fmt(totD)+'</td>'
                        +'<td style="padding:7px 12px;text-align:right;color:#16a34a;">'+fmt(totC)+'</td>'
                        +'<td style="padding:7px 12px;text-align:right;">'+soldeFTxt+'</td>'
                        +'</tr></tfoot>'
                        +'</table></div></div>';
                });
                html += '</div>';
            });

            html += '</div>';
            el.innerHTML = html;

        } catch(err) {
            el.innerHTML='<div style="padding:20px;background:#fef2f2;border-radius:8px;color:#dc2626;">❌ Erreur : '+err.message+'</div>';
        }
    }

    window.changerAnneeGLAux     = function(a){ window.anneeGLAux=parseInt(a); afficherGLAux(); };
    window.initGLAuxModule       = afficherGLAux;
})();
