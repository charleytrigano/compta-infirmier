// grand-livre.js — Grand Livre complet (transactions + tiers)
(function () {
    window.anneeGrandLivre = window.anneeGrandLivre || new Date().getFullYear().toString();

    function sc() { return window.supabaseClient || null; }

    function fmt(n) {
        return new Intl.NumberFormat('fr-FR', {style:'currency', currency:'EUR'}).format(n || 0);
    }

    // ── Compte de gestion selon catégorie ────────────────────────────────────
    function codeGestion(type, cat) {
        var c = (cat || '').toLowerCase();
        if ((type||'').toLowerCase() === 'recette' || c.includes('soins') || c.includes('honoraires')) return {code:'706000', lib:'Prestations de soins / Honoraires'};
        if (c.includes('carpimko'))            return {code:'646200', lib:'Cotisations CARPIMKO'};
        if (c.includes('urssaf'))              return {code:'646100', lib:'Cotisations URSSAF'};
        if (c.includes('rétrocession'))        return {code:'621000', lib:'Rétrocession honoraires'};
        if (c.includes('matériel') || c.includes('achat')) return {code:'606000', lib:'Achats matériel/fournitures'};
        if (c.includes('loyer'))               return {code:'613200', lib:'Loyers et charges locatives'};
        if (c.includes('assurance'))           return {code:'616000', lib:'Assurances professionnelles'};
        if (c.includes('kilométri'))           return {code:'625100', lib:'Frais kilométriques'};
        if (c.includes('formation'))           return {code:'625600', lib:'Formations / DPC'};
        if (c.includes('bancaire'))            return {code:'627000', lib:'Frais bancaires'};
        return {code:'628000', lib:'Charges diverses'};
    }

    // ── Libellé d'un compte tiers ─────────────────────────────────────────────
    function libTiers(code, nom) {
        if (nom) return nom;
        var map = {
            '401':'Fournisseurs', '411':'Clients / Patients / CPAM',
            '421':'Rétrocession Titulaire', '431':'URSSAF',
            '437':'CARPIMKO', '441':'État / Impôts', '455':'Exploitant',
        };
        var p = String(code).substring(0,3);
        return map[p] || ('Compte ' + code);
    }

    // ── Ajouter une ligne dans un compte ──────────────────────────────────────
    function ajouterLigne(comptes, code, libelle, ligne) {
        if (!code) return;
        if (!comptes[code]) comptes[code] = {code:code, libelle:libelle, lignes:[]};
        comptes[code].lignes.push(ligne);
    }

    async function chargerEtAfficherGrandLivre() {
        var container = document.getElementById('grandlivre-contenu');
        if (!container) return;
        container.innerHTML = '<p style="color:#64748b;padding:20px;text-align:center;">⏳ Chargement...</p>';

        var supabase = sc();
        if (!supabase) {
            container.innerHTML = '<p style="color:#64748b;padding:20px;text-align:center;">⏳ Connexion en cours...</p>';
            setTimeout(chargerEtAfficherGrandLivre, 600);
            return;
        }

        // Charger les transactions ET les tiers
        var [rTx, rTiers] = await Promise.all([
            supabase.from('transactions').select('*').order('date', {ascending:true}),
            supabase.from('tiers').select('*').eq('actif', true)
        ]);

        if (rTx.error) {
            container.innerHTML = '<p style="color:#dc2626;padding:20px;">Erreur : ' + rTx.error.message + '</p>';
            return;
        }

        var transactions = rTx.data || [];
        var tiersMap = {};
        (rTiers.data || []).forEach(function(t) { tiersMap[t.id] = t; });

        // Années disponibles
        var anneesSet = {};
        transactions.forEach(function(t) { if (t.date) anneesSet[new Date(t.date).getFullYear()] = true; });
        var annees = Object.keys(anneesSet).sort(function(a,b){return b-a;});
        if (!annees.length) annees = [new Date().getFullYear().toString()];
        var anneeActive = parseInt(window.anneeGrandLivre || annees[0]);
        if (!anneesSet[anneeActive]) anneeActive = parseInt(annees[0]);

        var tx = transactions.filter(function(t) {
            return t.date && new Date(t.date).getFullYear() === anneeActive;
        });

        var optAnnees = annees.map(function(a) {
            return '<option value="'+a+'"'+(parseInt(a)===anneeActive?' selected':'')+'>'+a+'</option>';
        }).join('');

        var header = '<div style="display:flex;justify-content:space-between;align-items:center;background:white;'
            + 'padding:12px 16px;border:1px solid #e2e8f0;border-radius:8px;margin-bottom:15px;">'
            + '<span style="font-weight:700;color:#1e293b;">📚 Grand Livre — Exercice '+anneeActive+'</span>'
            + '<div style="display:flex;align-items:center;gap:8px;">'
            + '<label style="font-size:12px;color:#64748b;font-weight:600;">Année :</label>'
            + '<select onchange="window.changerAnneeGrandLivre(this.value)" '
            + 'style="padding:4px 8px;border-radius:6px;border:1px solid #cbd5e1;font-weight:700;">'
            + optAnnees + '</select></div></div>';

        if (!tx.length) {
            container.innerHTML = header + '<p style="padding:20px;text-align:center;color:#64748b;background:#f8fafc;border-radius:8px;">Aucune transaction pour '+anneeActive+'.</p>';
            return;
        }

        // ── Construire les comptes ────────────────────────────────────────────
        var comptes = {};

        tx.forEach(function(t) {
            var montant    = parseFloat(t.amount || t.montant || 0);
            var estRecette = (t.type||'').toLowerCase() === 'recette';
            var desc       = t.description || '—';
            var date       = t.date || '—';
            var journal    = 'BQ';

            // 1. Compte de gestion (706, 646, 621, 606...)
            var g = codeGestion(t.type, t.category || t.categorie || '');
            var codeG = t.compte_code || g.code;
            var libG  = t.compte_libelle || g.lib;
            ajouterLigne(comptes, codeG, libG, {
                date:   date,
                journal: journal,
                desc:   desc,
                tiers:  t.nom_tiers || '',
                debit:  estRecette ? 0       : montant,
                credit: estRecette ? montant : 0,
            });

            // 2. Compte banque 512000
            ajouterLigne(comptes, '512000', 'Banque / Compte Courant', {
                date:   date,
                journal: journal,
                desc:   desc,
                tiers:  t.nom_tiers || '',
                debit:  estRecette ? montant : 0,
                credit: estRecette ? 0       : montant,
            });

            // 3. Compte tiers (411, 431, 437, 401...) si présent
            var codeTiers = t.compte_tiers_code || (t.tiers_id && tiersMap[t.tiers_id] ? tiersMap[t.tiers_id].compte : null);
            var nomTiers  = t.nom_tiers || (t.tiers_id && tiersMap[t.tiers_id] ? tiersMap[t.tiers_id].nom : null);
            if (codeTiers) {
                var libT = libTiers(codeTiers, nomTiers);
                // Côté tiers : inverse de la banque pour les recettes, inverse du charge pour les dépenses
                ajouterLigne(comptes, codeTiers, libT, {
                    date:   date,
                    journal: journal,
                    desc:   desc,
                    tiers:  nomTiers || '',
                    debit:  estRecette ? 0       : montant,  // fournisseur = débiteur lors paiement
                    credit: estRecette ? montant : 0,         // client = créditeur lors encaissement
                });
            }
        });

        // ── Rendu ─────────────────────────────────────────────────────────────
        var html = header + '<div style="display:flex;flex-direction:column;gap:16px;">';

        Object.keys(comptes).sort().forEach(function(code) {
            var c = comptes[code];
            var totD = 0, totC = 0;
            var isBilan = ['1','2','3','4','5'].includes(code.charAt(0));

            var rows = c.lignes.map(function(l) {
                totD += l.debit; totC += l.credit;
                return '<tr style="border-bottom:1px solid #f1f5f9;">'
                    + '<td style="padding:7px 10px;color:#334155;white-space:nowrap;">'+l.date+'</td>'
                    + '<td style="padding:7px 10px;font-weight:600;color:#1e293b;white-space:nowrap;">'+code+'</td>'
                    + '<td style="padding:7px 10px;color:#64748b;">'+l.journal+'</td>'
                    + '<td style="padding:7px 10px;color:#334155;">'+l.desc
                    + (l.tiers ? ' <span style="font-size:11px;color:#64748b;font-style:italic;">('+l.tiers+')</span>' : '')
                    + '</td>'
                    + '<td style="padding:7px 10px;text-align:right;color:#dc2626;white-space:nowrap;">'+(l.debit  > 0 ? fmt(l.debit)  : '—')+'</td>'
                    + '<td style="padding:7px 10px;text-align:right;color:#16a34a;white-space:nowrap;">'+(l.credit > 0 ? fmt(l.credit) : '—')+'</td>'
                    + '</tr>';
            }).join('');

            var solde    = totD - totC;
            var soldeTxt = Math.abs(solde) < 0.005
                ? '<span style="color:#16a34a;">Soldé</span>'
                : solde > 0
                    ? '<span style="color:#dc2626;">Solde débiteur : '+fmt(solde)+'</span>'
                    : '<span style="color:#16a34a;">Solde créditeur : '+fmt(Math.abs(solde))+'</span>';

            html += '<div style="background:white;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.05);">'
                + '<div style="background:#f8fafc;padding:10px 14px;border-bottom:1px solid #e2e8f0;'
                + 'display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">'
                + '<div style="display:flex;align-items:center;gap:8px;">'
                + '<strong style="font-size:14px;">📁 '+code+' — '+c.libelle+'</strong>'
                + '<span style="font-size:11px;padding:2px 7px;border-radius:4px;font-weight:600;'
                + 'background:'+(isBilan?'#e0f2fe':'#fef3c7')+';color:'+(isBilan?'#0369a1':'#b45309')+'">'
                + (isBilan ? 'Bilan' : 'Gestion '+anneeActive)+'</span>'
                + '</div>'
                + '<span style="font-size:12px;background:#eff6ff;padding:4px 10px;border-radius:6px;">'+soldeTxt+'</span>'
                + '</div>'
                + '<div style="overflow-x:auto;">'
                + '<table style="width:100%;border-collapse:collapse;font-size:13px;">'
                + '<thead><tr style="background:#f1f5f9;color:#475569;text-align:left;">'
                + '<th style="padding:7px 10px;white-space:nowrap;">Date</th>'
                + '<th style="padding:7px 10px;white-space:nowrap;">Compte</th>'
                + '<th style="padding:7px 10px;">Journal</th>'
                + '<th style="padding:7px 10px;">Description</th>'
                + '<th style="padding:7px 10px;text-align:right;white-space:nowrap;">Débit (€)</th>'
                + '<th style="padding:7px 10px;text-align:right;white-space:nowrap;">Crédit (€)</th>'
                + '</tr></thead>'
                + '<tbody>'+rows+'</tbody>'
                + '<tfoot><tr style="background:#f8fafc;font-weight:700;border-top:2px solid #e2e8f0;">'
                + '<td colspan="4" style="padding:7px 10px;text-align:right;">Total '+code+' :</td>'
                + '<td style="padding:7px 10px;text-align:right;color:#dc2626;">'+fmt(totD)+'</td>'
                + '<td style="padding:7px 10px;text-align:right;color:#16a34a;">'+fmt(totC)+'</td>'
                + '</tr></tfoot>'
                + '</table></div></div>';
        });

        html += '</div>';
        container.innerHTML = html;
    }

    window.changerAnneeGrandLivre = function(annee) {
        window.anneeGrandLivre = String(annee);
        chargerEtAfficherGrandLivre();
    };
    window.afficherGrandLivre          = chargerEtAfficherGrandLivre;
    window.chargerEtAfficherGrandLivre = chargerEtAfficherGrandLivre;
})();
