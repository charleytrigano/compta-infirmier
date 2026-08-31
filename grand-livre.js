// grand-livre.js — Grand Livre depuis la table transactions
(function () {
    window.anneeGrandLivre = window.anneeGrandLivre || new Date().getFullYear().toString();

    function getSupabase() {
        return window.supabaseClient || null;
    }
    function fmt(n) {
        return new Intl.NumberFormat('fr-FR', {style:'currency',currency:'EUR'}).format(n||0);
    }

    // Mapper catégorie → compte comptable (même logique que transactions.js)
    function getCompteCode(type, categorie) {
        var t   = (type||'').toLowerCase();
        var cat = (categorie||'').toLowerCase();
        if (t === 'recette' || cat.includes('soins') || cat.includes('honoraires')) return '706000';
        if (cat.includes('carpimko'))   return '646200';
        if (cat.includes('urssaf'))     return '646100';
        if (cat.includes('matériel') || cat.includes('fourniture')) return '606000';
        if (cat.includes('loyer'))      return '613200';
        if (cat.includes('assurance'))  return '616000';
        if (cat.includes('formation'))  return '625600';
        if (cat.includes('kilométri'))  return '625100';
        if (cat.includes('bancaire'))   return '627000';
        if (cat.includes('rétrocession')) return '621000';
        return '628000';
    }
    function getCompteLibelle(code) {
        var map = {
            '706000':'Prestations de soins / Honoraires',
            '646100':'Cotisations sociales URSSAF',
            '646200':'Cotisations sociales CARPIMKO',
            '621000':'Rétrocession honoraires',
            '606000':'Achats matériel et fournitures',
            '613200':'Loyers et charges locatives',
            '616000':'Assurances professionnelles',
            '625100':'Frais kilométriques',
            '625600':'Formations / DPC',
            '627000':'Frais bancaires',
            '628000':'Charges diverses',
        };
        return map[code] || ('Compte '+code);
    }

    async function chargerEtAfficherGrandLivre() {
        var container = document.getElementById('grandlivre-contenu');
        if (!container) return;
        container.innerHTML = '<p style="color:#64748b;padding:20px;text-align:center;">⏳ Chargement...</p>';

        var sc = getSupabase();
        if (!sc) {
            // Supabase pas encore prêt — réessayer dans 600ms
            container.innerHTML = '<p style="color:#64748b;padding:20px;text-align:center;">⏳ Connexion en cours...</p>';
            setTimeout(chargerEtAfficherGrandLivre, 600);
            return;
        }

        var r = await sc.from('transactions').select('*').order('date', {ascending:true});
        if (r.error) {
            container.innerHTML = '<p style="color:#dc2626;padding:20px;">Erreur : ' + r.error.message + '</p>';
            return;
        }
        var transactions = r.data || [];

        // Années disponibles
        var anneesSet = {};
        transactions.forEach(function(t) {
            if (t.date) anneesSet[new Date(t.date).getFullYear()] = true;
        });
        var annees = Object.keys(anneesSet).sort(function(a,b){return b-a;});
        if (!annees.length) annees = [new Date().getFullYear().toString()];
        var anneeActive = parseInt(window.anneeGlandLivre || window.anneeGrandLivre || annees[0]);
        if (!anneesSet[anneeActive]) anneeActive = parseInt(annees[0]);

        // Filtrer sur l'année
        var tx = transactions.filter(function(t) {
            return t.date && new Date(t.date).getFullYear() === anneeActive;
        });

        var optionsAnnees = annees.map(function(a) {
            return '<option value="' + a + '"' + (parseInt(a)===anneeActive?' selected':'') + '>' + a + '</option>';
        }).join('');

        var header = '<div style="display:flex;justify-content:space-between;align-items:center;background:white;padding:12px 16px;border:1px solid #e2e8f0;border-radius:8px;margin-bottom:15px;">'
            + '<span style="font-weight:700;color:#1e293b;">📚 Grand Livre — Exercice ' + anneeActive + '</span>'
            + '<div style="display:flex;align-items:center;gap:8px;">'
            + '<label style="font-size:12px;color:#64748b;font-weight:600;">Année :</label>'
            + '<select onchange="window.changerAnneeGrandLivre(this.value)" style="padding:4px 8px;border-radius:6px;border:1px solid #cbd5e1;font-weight:700;">' + optionsAnnees + '</select>'
            + '</div></div>';

        if (!tx.length) {
            container.innerHTML = header + '<div style="padding:20px;text-align:center;color:#64748b;background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;">Aucune transaction pour ' + anneeActive + '.</div>';
            return;
        }

        // Construire les comptes
        var comptes = {};
        tx.forEach(function(t) {
            var montant = parseFloat(t.amount || t.montant || 0);
            var estRecette = (t.type||'').toLowerCase() === 'recette';

            // Compte de contrepartie (706000, 646100, etc.)
            var codeContre = t.compte_code || getCompteCode(t.type, t.category || t.categorie || '');
            var libContre  = t.compte_libelle || getCompteLibelle(codeContre);

            // Compte banque 512000
            var code512 = '512000';
            var lib512  = 'Banque / Compte Courant';

            // Écriture côté produit/charge
            if (!comptes[codeContre]) comptes[codeContre] = {code:codeContre, libelle:libContre, lignes:[]};
            comptes[codeContre].lignes.push({
                date:        t.date || '-',
                journal:     'BQ',
                description: t.description || '-',
                tiers:       t.nom_tiers   || '',
                debit:       estRecette ? 0       : montant,
                credit:      estRecette ? montant : 0,
            });

            // Écriture côté banque 512000
            if (!comptes[code512]) comptes[code512] = {code:code512, libelle:lib512, lignes:[]};
            comptes[code512].lignes.push({
                date:        t.date || '-',
                journal:     'BQ',
                description: t.description || '-',
                tiers:       t.nom_tiers   || '',
                debit:       estRecette ? montant : 0,
                credit:      estRecette ? 0       : montant,
            });
        });

        var html = header + '<div style="display:flex;flex-direction:column;gap:16px;">';
        Object.keys(comptes).sort().forEach(function(code) {
            var c = comptes[code];
            var totD = 0, totC = 0;
            var isBilan = ['1','2','3','4','5'].includes(code.charAt(0));
            var rows = c.lignes.map(function(l) {
                totD += l.debit; totC += l.credit;
                return '<tr>'
                    + '<td style="padding:8px 10px;color:#334155;">' + l.date + '</td>'
                    + '<td style="padding:8px 10px;font-weight:600;color:#1e293b;">' + code + '</td>'
                    + '<td style="padding:8px 10px;color:#64748b;">' + l.journal + '</td>'
                    + '<td style="padding:8px 10px;color:#334155;">' + l.description + (l.tiers ? ' <span style="font-size:11px;color:#64748b;">(' + l.tiers + ')</span>' : '') + '</td>'
                    + '<td style="padding:8px 10px;text-align:right;color:#dc2626;">' + (l.debit>0 ? fmt(l.debit) : '—') + '</td>'
                    + '<td style="padding:8px 10px;text-align:right;color:#16a34a;">' + (l.credit>0 ? fmt(l.credit) : '—') + '</td>'
                    + '</tr>';
            }).join('');
            var solde = totD - totC;
            var soldeTxt = Math.abs(solde) < 0.005
                ? 'Soldé'
                : (solde > 0 ? 'Solde débiteur : ' + fmt(solde) : 'Solde créditeur : ' + fmt(Math.abs(solde)));

            html += '<div style="background:white;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.05);">'
                + '<div style="background:#f8fafc;padding:10px 14px;border-bottom:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center;">'
                + '<div><strong>📁 ' + code + ' — ' + c.libelle + '</strong>'
                + ' <span style="font-size:11px;padding:2px 6px;border-radius:4px;background:' + (isBilan?'#e0f2fe':'#fef3c7') + ';color:' + (isBilan?'#0369a1':'#b45309') + ';">' + (isBilan?'Bilan':'Gestion '+anneeActive) + '</span></div>'
                + '<span style="color:#2563eb;font-size:12px;background:#eff6ff;padding:4px 10px;border-radius:6px;font-weight:600;">' + soldeTxt + '</span>'
                + '</div>'
                + '<table style="width:100%;border-collapse:collapse;font-size:13px;">'
                + '<thead><tr style="background:#f1f5f9;color:#475569;">'
                + '<th style="padding:8px 10px;text-align:left;">Date</th><th style="padding:8px 10px;">Compte</th>'
                + '<th style="padding:8px 10px;">Journal</th><th style="padding:8px 10px;text-align:left;">Description</th>'
                + '<th style="padding:8px 10px;text-align:right;">Débit (€)</th><th style="padding:8px 10px;text-align:right;">Crédit (€)</th>'
                + '</tr></thead><tbody>' + rows + '</tbody>'
                + '<tfoot><tr style="background:#f8fafc;font-weight:700;border-top:2px solid #e2e8f0;">'
                + '<td colspan="4" style="padding:8px 10px;text-align:right;">Total ' + code + ' :</td>'
                + '<td style="padding:8px 10px;text-align:right;color:#dc2626;">' + fmt(totD) + '</td>'
                + '<td style="padding:8px 10px;text-align:right;color:#16a34a;">' + fmt(totC) + '</td>'
                + '</tr></tfoot></table></div>';
        });
        html += '</div>';
        container.innerHTML = html;
    }

    window.changerAnneeGrandLivre = function(annee) {
        window.anneeGrandLivre = String(annee);
        chargerEtAfficherGrandLivre();
    };
    window.afficherGrandLivre = chargerEtAfficherGrandLivre;
    window.chargerEtAfficherGrandLivre = chargerEtAfficherGrandLivre;
})();
