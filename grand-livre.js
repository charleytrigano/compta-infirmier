// grand-livre.js — Grand Livre avec vrais comptes tiers (table tiers)
(function () {
    window.anneeGrandLivre = window.anneeGrandLivre || new Date().getFullYear().toString();

    function sc() { return window.supabaseClient || null; }
    function fmt(n) { return new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR'}).format(n||0); }

    // ── Compte de gestion selon catégorie (classe 6/7) ────────────────────────
    function codeGestion(type, cat, desc) {
        var c = (cat||'').toLowerCase(), d = (desc||'').toLowerCase();
        if ((type||'').toLowerCase()==='recette') return {code:'706000', lib:'Honoraires / Soins infirmiers'};
        if (c.includes('carpimko') || d.includes('carpimko')) {
            if (c.includes('prévoyance') || d.includes('prévoyance')) return {code:'646200', lib:'CARPIMKO — Prévoyance'};
            if (c.includes('invalidité') || d.includes('invalidité')) return {code:'646200', lib:'CARPIMKO — Invalidité'};
            return {code:'646200', lib:'CARPIMKO — Retraite'};
        }
        if (c.includes('urssaf')         || d.includes('urssaf'))      return {code:'646100', lib:'Cotisations URSSAF'};
        if (c.includes('rétrocession')   || d.includes('rétrocession')) return {code:'621000', lib:'Rétrocession honoraires'};
        if (c.includes('impôt')          || d.includes('impôt'))        return {code:'695000', lib:'Impôt sur le revenu'};
        if (c.includes('matériel')       || c.includes('achat'))        return {code:'606000', lib:'Achats matériel/fournitures'};
        if (c.includes('assurance'))                                     return {code:'616000', lib:'Assurances professionnelles'};
        if (c.includes('loyer'))                                         return {code:'613200', lib:'Loyers'};
        if (c.includes('kilométri')      || c.includes('déplacement'))  return {code:'625100', lib:'Frais kilométriques'};
        if (c.includes('formation'))                                     return {code:'625600', lib:'Formations / DPC'};
        if (c.includes('bancaire'))                                      return {code:'627000', lib:'Frais bancaires'};
        return {code:'628000', lib:'Charges diverses'};
    }

    // ── Compte tiers de REPLI (quand pas de tiers_id sur la transaction) ──────
    function codeTiersRepli(type, cat, desc) {
        var c = (cat||'').toLowerCase(), d = (desc||'').toLowerCase();
        if ((type||'').toLowerCase()==='recette') return {code:'411000', lib:'Clients / Patients / CPAM'};
        if (c.includes('carpimko') || d.includes('carpimko')) {
            if (c.includes('prévoyance') || d.includes('prévoyance')) return {code:'437200', lib:'CARPIMKO — Prévoyance santé'};
            if (c.includes('invalidité') || d.includes('invalidité')) return {code:'437300', lib:'CARPIMKO — Invalidité-décès'};
            return {code:'437100', lib:'CARPIMKO — Retraite de base'};
        }
        if (c.includes('urssaf')       || d.includes('urssaf'))       return {code:'431000', lib:'URSSAF'};
        if (c.includes('rétrocession') || d.includes('rétrocession')) return {code:'421000', lib:'Rétrocession Titulaire'};
        if (c.includes('impôt')        || d.includes('impôt'))        return {code:'441000', lib:'DGFiP — Impôts'};
        if (c.includes('matériel')     || c.includes('achat'))        return {code:'401000', lib:'Fournisseurs matériel'};
        if (c.includes('assurance'))                                   return {code:'401000', lib:'Fournisseurs — Assurance'};
        if (c.includes('kilométri'))   return null; // pas de tiers pour IK
        return null;
    }

    function ajouterLigne(comptes, code, lib, ligne) {
        if (!code) return;
        code = String(code).trim();
        if (!comptes[code]) comptes[code] = {code:code, lib:lib, lignes:[]};
        comptes[code].lignes.push(ligne);
    }

    async function chargerEtAfficherGrandLivre() {
        var container = document.getElementById('grandlivre-contenu');
        if (!container) return;
        container.innerHTML = '<p style="color:#64748b;padding:20px;text-align:center;">⏳ Chargement...</p>';

        var supabase = sc();
        if (!supabase) { setTimeout(chargerEtAfficherGrandLivre, 600); return; }

        // Charger transactions ET tiers en parallèle
        var res = await Promise.all([
            supabase.from('transactions').select('*').order('date',{ascending:true}),
            supabase.from('tiers').select('*').eq('actif',true)
        ]);

        if (res[0].error) {
            container.innerHTML = '<p style="color:#dc2626;padding:20px;">Erreur : '+res[0].error.message+'</p>';
            return;
        }

        var transactions = res[0].data || [];

        // Index des tiers par id ET par compte
        var tiersParId = {};
        (res[1].data || []).forEach(function(t) { tiersParId[t.id] = t; });

        // Années disponibles
        var anneesSet = {};
        transactions.forEach(function(t){ if(t.date) anneesSet[new Date(t.date).getFullYear()]=true; });
        var annees = Object.keys(anneesSet).sort(function(a,b){return b-a;});
        if (!annees.length) annees = [new Date().getFullYear().toString()];
        var anneeActive = parseInt(window.anneeGrandLivre || annees[0]);
        if (!anneesSet[anneeActive]) anneeActive = parseInt(annees[0]);

        var tx = transactions.filter(function(t){
            return t.date && new Date(t.date).getFullYear()===anneeActive;
        });

        var optAnnees = annees.map(function(a){
            return '<option value="'+a+'"'+(parseInt(a)===anneeActive?' selected':'')+'>'+a+'</option>';
        }).join('');

        var header = '<div style="display:flex;justify-content:space-between;align-items:center;'
            +'background:white;padding:12px 16px;border:1px solid #e2e8f0;border-radius:8px;margin-bottom:15px;">'
            +'<span style="font-weight:700;font-size:15px;">📚 Grand Livre — Exercice '+anneeActive
            +' <small style="color:#64748b;font-size:12px;font-weight:400;">('+tx.length+' transactions)</small></span>'
            +'<div style="display:flex;align-items:center;gap:8px;">'
            +'<label style="font-size:12px;color:#64748b;font-weight:600;">Année :</label>'
            +'<select onchange="window.changerAnneeGrandLivre(this.value)" '
            +'style="padding:4px 8px;border-radius:6px;border:1px solid #cbd5e1;font-weight:700;">'
            +optAnnees+'</select></div></div>';

        if (!tx.length) {
            container.innerHTML = header+'<p style="padding:20px;text-align:center;color:#64748b;background:#f8fafc;border-radius:8px;">Aucune transaction pour '+anneeActive+'.</p>';
            return;
        }

        // ── Construire les comptes ────────────────────────────────────────────
        var comptes = {};

        tx.forEach(function(t) {
            var montant    = parseFloat(t.amount || t.montant || 0);
            var estRecette = (t.type||'').toLowerCase()==='recette';
            var desc       = t.description || '—';
            var date       = t.date || '—';
            var cat        = t.category || t.categorie || '';

            // ── Compte de gestion (6xx ou 7xx) ───────────────────────────────
            var g = codeGestion(t.type, cat, desc);
            if (t.compte_code) g = {code: t.compte_code, lib: t.compte_libelle || g.lib};

            ajouterLigne(comptes, g.code, g.lib, {
                date:date, journal:'BQ', desc:desc, tiers:t.nom_tiers||'',
                debit:  estRecette ? 0       : montant,
                credit: estRecette ? montant : 0,
            });

            // ── Compte TIERS (4xx) ────────────────────────────────────────────
            var tiersCompte = null;
            var tiersLib    = null;

            // Priorité 1 : tiers_id → vrai compte depuis la table tiers (ex: 411Abadie)
            if (t.tiers_id && tiersParId[t.tiers_id]) {
                var tObj = tiersParId[t.tiers_id];
                tiersCompte = tObj.compte;        // ex: "411Abadie"
                tiersLib    = tObj.nom;            // ex: "Abadie"
            }
            // Priorité 2 : compte_tiers_code stocké directement sur la transaction
            else if (t.compte_tiers_code) {
                tiersCompte = t.compte_tiers_code;
                tiersLib    = t.nom_tiers || t.compte_tiers_libelle || tiersCompte;
            }
            // Priorité 3 : déduction depuis catégorie (repli)
            else {
                var repli = codeTiersRepli(t.type, cat, desc);
                if (repli) { tiersCompte = repli.code; tiersLib = repli.lib; }
            }

            if (tiersCompte) {
                ajouterLigne(comptes, tiersCompte, tiersLib, {
                    date:date, journal:'BQ', desc:desc, tiers:tiersLib||'',
                    debit:  estRecette ? 0       : montant,
                    credit: estRecette ? montant : 0,
                });
            }

            // ── Compte banque 512000 ──────────────────────────────────────────
            ajouterLigne(comptes, '512000', 'Banque / Compte Courant', {
                date:date, journal:'BQ', desc:desc, tiers:t.nom_tiers||'',
                debit:  estRecette ? montant : 0,
                credit: estRecette ? 0       : montant,
            });
        });

        // ── Rendu HTML ────────────────────────────────────────────────────────
        var html = header+'<div style="display:flex;flex-direction:column;gap:16px;">';

        Object.keys(comptes).sort(function(a,b){
            var na=parseInt(a)||0, nb=parseInt(b)||0;
            if (na!==nb) return na-nb;
            return a.localeCompare(b);
        }).forEach(function(code) {
            var c=comptes[code], totD=0, totC=0;
            var isBilan=['1','2','3','4','5'].includes(code.charAt(0));

            var rows=c.lignes.map(function(l){
                totD+=l.debit; totC+=l.credit;
                return '<tr style="border-bottom:1px solid #f1f5f9;">'
                    +'<td style="padding:7px 10px;white-space:nowrap;">'+l.date+'</td>'
                    +'<td style="padding:7px 10px;font-weight:600;white-space:nowrap;color:#1e293b;">'+code+'</td>'
                    +'<td style="padding:7px 10px;color:#64748b;">'+l.journal+'</td>'
                    +'<td style="padding:7px 10px;">'+l.desc
                    +(l.tiers?' <em style="font-size:11px;color:#64748b;">('+l.tiers+')</em>':'')+'</td>'
                    +'<td style="padding:7px 10px;text-align:right;color:#dc2626;white-space:nowrap;">'+(l.debit >0?fmt(l.debit) :'—')+'</td>'
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
                +(isBilan?'Bilan':'Gestion '+anneeActive)+'</span></div>'
                +'<span style="font-size:12px;padding:4px 10px;border-radius:6px;background:#f8fafc;">'+soldeTxt+'</span>'
                +'</div>'
                +'<div style="overflow-x:auto;">'
                +'<table style="width:100%;border-collapse:collapse;font-size:13px;">'
                +'<thead><tr style="background:#f1f5f9;color:#475569;text-align:left;">'
                +'<th style="padding:7px 10px;white-space:nowrap;">Date</th>'
                +'<th style="padding:7px 10px;white-space:nowrap;">Compte</th>'
                +'<th style="padding:7px 10px;">Journal</th>'
                +'<th style="padding:7px 10px;">Description / Tiers</th>'
                +'<th style="padding:7px 10px;text-align:right;white-space:nowrap;">Débit (€)</th>'
                +'<th style="padding:7px 10px;text-align:right;white-space:nowrap;">Crédit (€)</th>'
                +'</tr></thead><tbody>'+rows+'</tbody>'
                +'<tfoot><tr style="background:#f8fafc;font-weight:700;border-top:2px solid #e2e8f0;">'
                +'<td colspan="4" style="padding:7px 10px;text-align:right;">Total '+code+' :</td>'
                +'<td style="padding:7px 10px;text-align:right;color:#dc2626;">'+fmt(totD)+'</td>'
                +'<td style="padding:7px 10px;text-align:right;color:#16a34a;">'+fmt(totC)+'</td>'
                +'</tr></tfoot></table></div></div>';
        });

        html+='</div>';
        container.innerHTML=html;
    }

    window.changerAnneeGrandLivre      = function(a){ window.anneeGrandLivre=String(a); chargerEtAfficherGrandLivre(); };
    window.afficherGrandLivre          = chargerEtAfficherGrandLivre;
    window.chargerEtAfficherGrandLivre = chargerEtAfficherGrandLivre;
})();
