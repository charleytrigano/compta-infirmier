/**
 * journal_od.js — Journal des Opérations Diverses (table journal_od)
 */
(function() {
    function getSupabase() { return window.supabaseClient || null; }
    function fmt(n) { return Number(n||0).toLocaleString('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2})+' €'; }

    // ── AFFICHAGE ─────────────────────────────────────────────
    async function chargerJournalOD() {
        var sc = getSupabase(); if (!sc) return;
        var container = document.getElementById('body-tableau-od') || document.getElementById('od-liste');
        if (!container) return;
        container.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:20px;color:#94a3b8;">Chargement...</td></tr>';

        var annee = window.anneeJournalOD || new Date().getFullYear();
        var debut = annee+'-01-01', fin = annee+'-12-31';

        var r = await sc.from('journal_od').select('*')
            .gte('date', debut).lte('date', fin)
            .order('date', {ascending:true})
            .order('created_at', {ascending:true});

        if (r.error) { container.innerHTML = '<tr><td colspan="8" style="color:#dc2626;padding:20px;">Erreur : '+r.error.message+'</td></tr>'; return; }

        var lignes = r.data || [];
        if (!lignes.length) {
            container.innerHTML = '<tr><td colspan="8" style="text-align:center;color:#94a3b8;padding:20px;">Aucune écriture OD pour '+annee+'.</td></tr>';
            return;
        }

        container.innerHTML = lignes.map(function(l, i) {
            return '<tr style="background:'+(i%2===0?'white':'#f8fafc')+';border-bottom:1px solid #f1f5f9;">'
                +'<td style="padding:8px 12px;">'+l.date+'</td>'
                +'<td style="padding:8px 12px;">'+l.libelle+'</td>'
                +'<td style="padding:8px 12px;"><code style="background:#fef3c7;padding:2px 6px;border-radius:4px;font-size:11px;color:#92400e;">'+l.compte_debit+'</code></td>'
                +'<td style="padding:8px 12px;"><code style="background:#dcfce7;padding:2px 6px;border-radius:4px;font-size:11px;color:#166534;">'+l.compte_credit+'</code></td>'
                +'<td style="padding:8px 12px;color:#64748b;font-size:12px;">'+(l.nom_tiers||l.compte_tiers||'')+'</td>'
                +'<td style="padding:8px 12px;text-align:right;font-weight:600;color:#1e293b;">'+fmt(l.montant)+'</td>'
                +'<td style="padding:8px 12px;color:#64748b;font-size:11px;">'+(l.reference||'')+'</td>'
                +'<td style="padding:8px 12px;text-align:center;white-space:nowrap;">'
                +'<button onclick="ouvrirEditOD(\''+l.id+'\')" style="background:none;border:none;cursor:pointer;font-size:1.1rem;" title="Modifier">✏️</button>'
                +'<button onclick="supprimerOD(\''+l.id+'\')" style="background:none;border:none;cursor:pointer;font-size:1.1rem;color:#ef4444;" title="Supprimer">🗑️</button>'
                +'</td></tr>';
        }).join('');
    }

    // ── AJOUT ─────────────────────────────────────────────────
    window.ajouterEcritureOD = async function(e) {
        if (e) e.preventDefault();
        var sc = getSupabase(); if (!sc) return;

        var date    = (document.getElementById('od-date')||{}).value;
        var libelle = (document.getElementById('od-description')||document.getElementById('od-libelle')||{}).value;
        var montant = parseFloat((document.getElementById('od-montant')||{}).value||0);
        var cD      = (document.getElementById('od-compte-debit')||{}).value;
        var cC      = (document.getElementById('od-compte-credit')||{}).value;
        var ref     = (document.getElementById('od-reference')||{}).value || null;
        var tiersId = (document.getElementById('od-tiers-id')||{}).value || null;

        if (!date || !montant || !cD || !cC) {
            alert('Remplissez : date, compte débité, compte crédité et montant');
            return;
        }
        if (!libelle) libelle = cD + ' / ' + cC; // libellé automatique si vide

        var nomTiers = null, compteTiers = null;
        if (tiersId && window.TIERS_DATA) {
            var ti = window.TIERS_DATA.find(function(x){return x.id===tiersId;});
            if (ti) { nomTiers = ti.nom; compteTiers = ti.compte; }
        }

        var r = await sc.from('journal_od').insert([{
            date:date, libelle:libelle, montant:montant,
            compte_debit:cD, compte_credit:cC,
            tiers_id:tiersId||null, compte_tiers:compteTiers, nom_tiers:nomTiers,
            reference:ref,
        }]);
        if (r.error) { alert('Erreur : '+r.error.message); return; }

        ['od-date','od-description','od-libelle','od-montant','od-compte-debit','od-libelle-debit',
          'od-compte-credit','od-libelle-credit','od-reference','od-tiers-id'].forEach(function(id){
            var el=document.getElementById(id); if(el) el.value='';
        });
        chargerJournalOD();
    };

    // ── ÉDITION ───────────────────────────────────────────────
    window.ouvrirEditOD = async function(id) {
        var sc = getSupabase(); if (!sc) return;
        var r = await sc.from('journal_od').select('*').eq('id',id).single();
        if (r.error || !r.data) return;
        var l = r.data;
        window._editODId = id;
        window._editBanqueId = null;

        document.getElementById('edit-tx-id').value      = id;
        document.getElementById('edit-tx-date').value    = l.date || '';
        document.getElementById('edit-tx-desc').value    = l.libelle || '';
        document.getElementById('edit-tx-montant').value = l.montant || '';
        document.getElementById('edit-tx-type').value    = 'od';

        if (typeof window.enrichirModalComptes === 'function') window.enrichirModalComptes(null);

        setTimeout(function() {
            var selD = document.getElementById('edit-compte-debit');
            var selC = document.getElementById('edit-compte-credit');
            if (selD) selD.value = l.compte_debit || '';
            if (selC) selC.value = l.compte_credit || '';
            var statut = document.getElementById('edit-imputation-statut');
            if (statut) statut.innerHTML = '<span style="color:#16a34a;">✅ '+l.compte_debit+' / '+l.compte_credit+'</span>';
        }, 150);

        document.getElementById('editTransactionModal').style.display = 'flex';
    };

    window.sauvegarderEditOD = async function() {
        var sc = getSupabase(); if (!sc) return;
        var id  = window._editODId; if (!id) return;
        var cD  = (document.getElementById('edit-compte-debit')||{}).value;
        var cC  = (document.getElementById('edit-compte-credit')||{}).value;
        var tvS = (document.getElementById('edit-tiers-id')||{}).value || '';

        if (!cD || !cC) { alert('Choisissez les comptes débité et crédité'); return; }

        var tiersId = null, nomTiers = null, compteTiers = null;
        if (tvS.startsWith('tiers:')) {
            tiersId = tvS.replace('tiers:','');
            if (window.TIERS_DATA){ var ti=window.TIERS_DATA.find(function(x){return x.id===tiersId;}); if(ti){nomTiers=ti.nom;compteTiers=ti.compte;} }
        } else if (tvS && tvS.charAt(0)==='4') {
            compteTiers = tvS;
        }

        var r = await sc.from('journal_od').update({
            date:         (document.getElementById('edit-tx-date')||{}).value,
            libelle:      (document.getElementById('edit-tx-desc')||{}).value,
            montant:      parseFloat((document.getElementById('edit-tx-montant')||{}).value||0),
            compte_debit: cD, compte_credit: cC,
            tiers_id:     tiersId, compte_tiers: compteTiers, nom_tiers: nomTiers,
        }).eq('id', id);

        if (r.error) { alert('Erreur : '+r.error.message); return; }
        document.getElementById('editTransactionModal').style.display = 'none';
        chargerJournalOD();
    };

    window.supprimerOD = async function(id) {
        if (!confirm('Supprimer cette écriture OD ?')) return;
        var sc = getSupabase(); if (!sc) return;
        await sc.from('journal_od').delete().eq('id', id);
        chargerJournalOD();
    };

    window.chargerJournalOD = chargerJournalOD;
    window.anneeJournalOD   = new Date().getFullYear();
})();
