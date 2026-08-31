// grand-livre.js — Grand Livre complet avec déduction automatique des tiers
(function () {
    window.anneeGrandLivre = window.anneeGrandLivre || new Date().getFullYear().toString();

    function sc() { return window.supabaseClient || null; }
    function fmt(n) { return new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR'}).format(n||0); }

    // ── Mapper transaction → comptes comptables (gestion + tiers) ─────────────
    function getComptes(t) {
        var cat        = (t.category || t.categorie || '').toLowerCase();
        var desc       = (t.description || '').toLowerCase();
        var estRecette = (t.type||'').toLowerCase() === 'recette';

        // Compte de gestion (classe 6 ou 7)
        var gestion, tiers;

        if (estRecette) {
            // Toutes les recettes → 706000 Honoraires
            gestion = {code:'706000', lib:'Prestations de soins / Honoraires'};
            // Tiers recette → déduire depuis description ou tiers explicite
            var codeTiersExplicite = t.compte_tiers_code;
            if (codeTiersExplicite) {
                tiers = {code: codeTiersExplicite, lib: t.nom_tiers || t.compte_tiers_libelle || codeTiersExplicite};
            } else if (desc.includes('cpam') || desc.includes('assurance maladie') || desc.includes('sécurité')) {
                tiers = {code:'411000', lib:'CPAM / Sécurité Sociale'};
            } else if (desc.includes('mutuelle') || desc.includes('complémentaire')) {
                tiers = {code:'411100', lib:'Mutuelle / Complémentaire'};
            } else if (desc.includes('patient') || cat.includes('soins')) {
                tiers = {code:'411000', lib:'Clients / Patients / CPAM'};
            } else {
                tiers = {code:'411000', lib:'Clients / Patients / CPAM'};
            }
        } else {
            // Dépenses — déduire depuis catégorie
            if (cat.includes('carpimko') || desc.includes('carpimko')) {
                if (cat.includes('prévoyance') || desc.includes('prévoyance')) {
                    gestion = {code:'646200', lib:'Cotisations prévoyance CARPIMKO'};
                    tiers   = {code:'437200', lib:'CARPIMKO — Prévoyance santé'};
                } else if (cat.includes('invalidité') || desc.includes('invalidité')) {
                    gestion = {code:'646200', lib:'Cotisations invalidité CARPIMKO'};
                    tiers   = {code:'437300', lib:'CARPIMKO — Invalidité-décès'};
                } else {
                    gestion = {code:'646200', lib:'Cotisations retraite CARPIMKO'};
                    tiers   = {code:'437100', lib:'CARPIMKO — Retraite'};
                }
            } else if (cat.includes('urssaf') || desc.includes('urssaf')) {
                gestion = {code:'646100', lib:'Cotisations sociales URSSAF'};
                tiers   = {code:'431000', lib:'URSSAF'};
            } else if (cat.includes('rétrocession') || desc.includes('rétrocession')) {
                gestion = {code:'621000', lib:'Rétrocession honoraires'};
                tiers   = {code:'421000', lib:'Rétrocession Titulaire'};
            } else if (cat.includes('impôt') || desc.includes('impôt') || desc.includes('ir ') || cat.includes(' ir')) {
                gestion = {code:'695000', lib:'Impôt sur le revenu'};
                tiers   = {code:'441000', lib:'Direction Générale des Finances Publiques'};
            } else if (cat.includes('matériel') || cat.includes('achat') || cat.includes('fourniture')) {
                gestion = {code:'606000', lib:'Achats matériel et fournitures'};
                tiers   = {code:'401000', lib:'Fournisseurs matériel médical'};
            } else if (cat.includes('assurance')) {
                gestion = {code:'616000', lib:'Assurances professionnelles'};
                tiers   = {code:'401000', lib:'Fournisseurs — Assurance'};
            } else if (cat.includes('loyer')) {
                gestion = {code:'613200', lib:'Loyers et charges locatives'};
                tiers   = {code:'401000', lib:'Fournisseurs — Loyer'};
            } else if (cat.includes('kilométri') || cat.includes('déplacement')) {
                gestion = {code:'625100', lib:'Frais kilométriques'};
                tiers   = null; // pas de tiers pour les IK
            } else if (cat.includes('formation') || desc.includes('dpc')) {
                gestion = {code:'625600', lib:'Formations / DPC'};
                tiers   = {code:'401000', lib:'Fournisseur — Formation'};
            } else if (cat.includes('bancaire') || desc.includes('frais bancaire')) {
                gestion = {code:'627000', lib:'Frais bancaires'};
                tiers   = null;
            } else {
                gestion = {code:'628000', lib:'Charges diverses'};
                tiers   = null;
            }

            // Tiers explicite dans la transaction prioritaire sur la déduction
            if (t.compte_tiers_code) {
                tiers = {code: t.compte_tiers_code, lib: t.nom_tiers || t.compte_tiers_libelle || t.compte_tiers_code};
            }
        }

        // Utiliser le compte_code explicite si renseigné
        if (t.compte_code) gestion = {code: t.compte_code, lib: t.compte_libelle || gestion.lib};

        return {gestion: gestion, tiers: tiers};
    }

    function ajouterLigne(comptes, code, lib, ligne) {
        if (!code) return;
        code = String(code).trim();
        if (!comptes[code]) comptes[code] = {code:code, lib:lib, lignes:[]};
        else if (!comptes[code].lib || comptes[code].lib === code) comptes[code].lib = lib;
        comptes[code].lignes.push(ligne);
    }

    async function chargerEtAfficherGrandLivre() {
        var container = document.getElementById('grandlivre-contenu');
        if (!container) return;
        container.innerHTML = '<p style="color:#64748b;padding:20px;text-align:center;">⏳ Chargement...</p>';

        var supabase = sc();
        if (!supabase) {
            setTimeout(chargerEtAfficherGrandLivre, 600);
            return;
        }

        var r = await supabase.from('transactions').select('*').order('date',{ascending:true});
        if (r.error) {
            container.innerHTML = '<p style="color:#dc2626;padding:20px;">Erreur : '+r.error.message+'</p>';
            return;
        }
        var transactions = r.data || [];

        // Années
        var anneesSet = {};
        transactions.forEach(function(t){ if(t.date) anneesSet[new Date(t.date).getFullYear()]=true; });
        var annees = Object.keys(anneesSet).sort(function(a,b){return b-a;});
        if (!annees.length) annees = [new Date().getFullYear().toString()];
        var anneeActive = parseInt(window.anneeGrandLivre || annees[0]);
        if (!anneesSet[anneeActive]) anneeActive = parseInt(annees[0]);

        var tx = transactions.filter(function(t){
            return t.date && new Date(t.date).getFullYear() === anneeActive;
        });

        var optAnnees = annees.map(function(a){
            return '<option value="'+a+'"'+(parseInt(a)===anneeActive?' selected':'')+'>'+a+'</option>';
        }).join('');

        var header = '<div style="display:flex;justify-content:space-between;align-items:center;'
            +'background:white;padding:12px 16px;border:1px solid #e2e8f0;border-radius:8px;margin-bottom:15px;">'
            +'<span style="font-weight:700;font-size:15px;">📚 Grand Livre — Exercice '+anneeActive+'</span>'
            +'<div style="display:flex;align-items:center;gap:8px;">'
            +'<label style="font-size:12px;color:#64748b;font-weight:600;">Année :</label>'
            +'<select onchange="window.changerAnneeGrandLivre(this.value)" '
            +'style="padding:4px 8px;border-radius:6px;border:1px solid #cbd5e1;font-weight:700;">'
            +optAnnees+'</select></div></div>';

        if (!tx.length) {
            container.innerHTML = header+'<p style="padding:20px;text-align:center;color:#64748b;">Aucune transaction pour '+anneeActive+'.</p>';
            return;
        }

        // ── Construire les comptes ────────────────────────────────────────────
        var comptes = {};
        tx.forEach(function(t) {
            var montant    = parseFloat(t.amount || t.montant || 0);
            var estRecette = (t.type||'').toLowerCase() === 'recette';
            var desc       = t.description || '—';
            var date       = t.date || '—';
            var c          = getComptes(t);

            // 1. Compte de gestion (7xx recettes, 6xx dépenses)
            ajouterLigne(comptes, c.gestion.code, c.gestion.lib, {
                date: date, journal:'BQ', desc: desc, tiers: t.nom_tiers||'',
                debit:  estRecette ? 0       : montant,
                credit: estRecette ? montant : 0,
            });

            // 2. Compte tiers (4xx) — TOUJOURS généré même si pas renseigné
            if (c.tiers) {
                ajouterLigne(comptes, c.tiers.code, c.tiers.lib, {
                    date: date, journal:'BQ', desc: desc, tiers: t.nom_tiers||'',
                    debit:  estRecette ? 0       : montant,
                    credit: estRecette ? montant : 0,
                });
            }

            // 3. Compte banque 512000
            ajouterLigne(comptes, '512000', 'Banque / Compte Courant', {
                date: date, journal:'BQ', desc: desc, tiers: t.nom_tiers||'',
                debit:  estRecette ? montant : 0,
                credit: estRecette ? 0       : montant,
            });
        });

        // ── Rendu ─────────────────────────────────────────────────────────────
        var html = header+'<div style="display:flex;flex-direction:column;gap:16px;">';

        // Trier : 4xx → 5xx → 6xx → 7xx
        var codesTriés = Object.keys(comptes).sort(function(a,b){
            // Trier numériquement en extrayant le préfixe numérique
            var na = parseInt(a)||0, nb = parseInt(b)||0;
            return na - nb || a.localeCompare(b);
        });

        codesTriés.forEach(function(code) {
            var c    = comptes[code];
            var totD = 0, totC = 0;
            var isBilan = ['1','2','3','4','5'].includes(code.charAt(0));

            var rows = c.lignes.map(function(l){
                totD += l.debit; totC += l.credit;
                return '<tr style="border-bottom:1px solid #f1f5f9;">'
                    +'<td style="padding:7px 10px;white-space:nowrap;">'+l.date+'</td>'
                    +'<td style="padding:7px 10px;font-weight:600;white-space:nowrap;">'+code+'</td>'
                    +'<td style="padding:7px 10px;color:#64748b;">'+l.journal+'</td>'
                    +'<td style="padding:7px 10px;">'+l.desc
                    +(l.tiers?' <em style="font-size:11px;color:#64748b;">('+l.tiers+')</em>':'')
                    +'</td>'
                    +'<td style="padding:7px 10px;text-align:right;color:#dc2626;white-space:nowrap;">'+(l.debit  >0 ? fmt(l.debit)  :'—')+'</td>'
                    +'<td style="padding:7px 10px;text-align:right;color:#16a34a;white-space:nowrap;">'+(l.credit >0 ? fmt(l.credit) :'—')+'</td>'
                    +'</tr>';
            }).join('');

            var solde = totD - totC;
            var soldeTxt = Math.abs(solde) < 0.005
                ? '<span style="color:#16a34a;">Soldé ✓</span>'
                : solde > 0
                    ? '<span style="color:#dc2626;">Solde débiteur : '+fmt(solde)+'</span>'
                    : '<span style="color:#16a34a;">Solde créditeur : '+fmt(Math.abs(solde))+'</span>';

            html += '<div style="background:white;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.05);">'
                +'<div style="background:#f8fafc;padding:10px 14px;border-bottom:1px solid #e2e8f0;'
                +'display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">'
                +'<div style="display:flex;align-items:center;gap:8px;">'
                +'<strong>📁 '+code+' — '+c.lib+'</strong>'
                +'<span style="font-size:11px;padding:2px 7px;border-radius:4px;font-weight:600;'
                +'background:'+(isBilan?'#e0f2fe':'#fef3c7')+';color:'+(isBilan?'#0369a1':'#b45309')+';">'
                +(isBilan?'Bilan':'Gestion '+anneeActive)+'</span>'
                +'</div>'
                +'<span style="font-size:12px;background:#f8fafc;padding:4px 10px;border-radius:6px;">'+soldeTxt+'</span>'
                +'</div>'
                +'<div style="overflow-x:auto;">'
                +'<table style="width:100%;border-collapse:collapse;font-size:13px;">'
                +'<thead><tr style="background:#f1f5f9;color:#475569;text-align:left;">'
                +'<th style="padding:7px 10px;white-space:nowrap;">Date</th>'
                +'<th style="padding:7px 10px;white-space:nowrap;">Compte</th>'
                +'<th style="padding:7px 10px;">Journal</th>'
                +'<th style="padding:7px 10px;">Description</th>'
                +'<th style="padding:7px 10px;text-align:right;white-space:nowrap;">Débit (€)</th>'
                +'<th style="padding:7px 10px;text-align:right;white-space:nowrap;">Crédit (€)</th>'
                +'</tr></thead>'
                +'<tbody>'+rows+'</tbody>'
                +'<tfoot><tr style="background:#f8fafc;font-weight:700;border-top:2px solid #e2e8f0;">'
                +'<td colspan="4" style="padding:7px 10px;text-align:right;">Total '+code+' :</td>'
                +'<td style="padding:7px 10px;text-align:right;color:#dc2626;">'+fmt(totD)+'</td>'
                +'<td style="padding:7px 10px;text-align:right;color:#16a34a;">'+fmt(totC)+'</td>'
                +'</tr></tfoot>'
                +'</table></div></div>';
        });

        html += '</div>';
        container.innerHTML = html;
    }

    window.changerAnneeGrandLivre          = function(a){ window.anneeGrandLivre = String(a); chargerEtAfficherGrandLivre(); };
    window.afficherGrandLivre              = chargerEtAfficherGrandLivre;
    window.chargerEtAfficherGrandLivre     = chargerEtAfficherGrandLivre;
})();
