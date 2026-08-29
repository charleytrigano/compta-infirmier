// ============================================================================
// patients.js — Gestion patients & cabinets
// ============================================================================

var PT = { cabinets:[], patients:[], cabinetEdite:null, patientEdite:null };

// ── Client Supabase ───────────────────────────────────────────────────────────
function ptSC() {
    return window.supabaseClient || null;
}

// ── Utilitaires ───────────────────────────────────────────────────────────────
function ptFmt(date) {
    if (!date) return '—';
    try { return new Date(date).toLocaleDateString('fr-FR'); } catch(e){ return date; }
}
function ptAge(dn) {
    if (!dn) return '';
    var diff = Date.now() - new Date(dn).getTime();
    return Math.floor(diff / (365.25*24*3600*1000)) + ' ans';
}
function ptEl(id) { return document.getElementById(id); }
function ptHtml(id, html) { var e=ptEl(id); if(e) e.innerHTML=html; }

// ── CHARGEMENT CABINETS ───────────────────────────────────────────────────────
async function ptChargerCabinets() {
    console.log('[patients] ptChargerCabinets start, supabaseClient=', !!ptSC());
    var el = ptEl('ptListeCabinets');

    if (!ptSC()) {
        if (el) el.innerHTML = '<p style="color:#f59e0b;">⏳ Connexion Supabase en attente...</p>';
        return false;
    }

    try {
        var r = await ptSC().from('cabinets').select('*').order('nom');
        console.log('[patients] cabinets result:', r);

        if (r.error) {
            if (el) el.innerHTML = '<p style="color:#ef4444;">❌ Erreur cabinets : ' + r.error.message + '</p>';
            return false;
        }

        PT.cabinets = r.data || [];
        console.log('[patients] cabinets chargés:', PT.cabinets.length);
        ptRenouvellerSelectCabinets();
        ptRenduCabinets();
        return true;

    } catch(e) {
        console.error('[patients] exception cabinets:', e);
        if (el) el.innerHTML = '<p style="color:#ef4444;">❌ Exception : ' + e.message + '</p>';
        return false;
    }
}

// ── CHARGEMENT PATIENTS ───────────────────────────────────────────────────────
async function ptChargerPatients() {
    console.log('[patients] ptChargerPatients start');
    var el = ptEl('ptListePatients');

    if (!ptSC()) {
        if (el) el.innerHTML = '<p style="color:#f59e0b;">⏳ Connexion Supabase en attente...</p>';
        return false;
    }

    try {
        var r = await ptSC().from('patients').select('*').order('nom');
        console.log('[patients] patients result:', r);

        if (r.error) {
            if (el) el.innerHTML = '<p style="color:#ef4444;">❌ Erreur patients : ' + r.error.message + '</p>';
            return false;
        }

        // Associer les infos cabinet manuellement
        PT.patients = (r.data || []).map(function(p) {
            var cab = PT.cabinets.find(function(c){ return c.id === p.cabinet_id; });
            p._cabinet = cab || null;
            return p;
        });

        console.log('[patients] patients chargés:', PT.patients.length);
        ptRenduPatients();
        ptRenduCabinets();
        ptMAJCompteurs();
        return true;

    } catch(e) {
        console.error('[patients] exception patients:', e);
        if (el) el.innerHTML = '<p style="color:#ef4444;">❌ Exception : ' + e.message + '</p>';
        return false;
    }
}

// ── AFFICHAGE CABINETS ────────────────────────────────────────────────────────
function ptRenduCabinets() {
    var el = ptEl('ptListeCabinets');
    if (!el) return;

    if (!PT.cabinets.length) {
        el.innerHTML = '<p style="color:#94a3b8;text-align:center;padding:20px;">Aucun cabinet. Cliquez "Nouveau cabinet".</p>';
        return;
    }

    el.innerHTML = PT.cabinets.map(function(c) {
        var nbPt = PT.patients.filter(function(p){ return p.cabinet_id === c.id && p.actif; }).length;
        return '<div style="display:flex;justify-content:space-between;align-items:center;padding:12px;border:1px solid #e2e8f0;border-radius:8px;margin-bottom:8px;background:#fff;cursor:pointer;" onclick="ptFiltrerParCabinet(\'' + c.id + '\')">'
            + '<div>'
            + '<div style="font-weight:600;color:#1e293b;">' + (c.nom||'—') + '</div>'
            + '<div style="font-size:13px;color:#64748b;">' + [c.adresse,c.code_postal,c.ville].filter(Boolean).join(', ') + '</div>'
            + '<div style="font-size:12px;color:#94a3b8;margin-top:2px;">'
            + (c.nom_titulaire ? 'Titulaire : ' + c.nom_titulaire + ' — ' : '')
            + (c.telephone||'')
            + '</div>'
            + '</div>'
            + '<div style="display:flex;gap:8px;align-items:center;">'
            + '<span style="background:#eff6ff;color:#2563eb;padding:4px 10px;border-radius:12px;font-size:12px;font-weight:600;">' + nbPt + ' patient' + (nbPt>1?'s':'') + '</span>'
            + (c.taux_retrocession ? '<span style="background:#fffbeb;color:#92400e;padding:4px 10px;border-radius:12px;font-size:12px;font-weight:600;">Rétro. ' + c.taux_retrocession + '%</span>' : '')
            + '<button onclick="event.stopPropagation();ptEditerCabinet(\'' + c.id + '\')" style="background:#f8fafc;border:1px solid #e2e8f0;padding:4px 10px;border-radius:6px;cursor:pointer;font-size:12px;">✏️</button>'
            + '</div>'
            + '</div>';
    }).join('');
}

// ── SELECTS CABINETS ──────────────────────────────────────────────────────────
function ptRenouvellerSelectCabinets() {
    ['ptFiltreCABINET','ptCabinetPatient'].forEach(function(id) {
        var el = ptEl(id);
        if (!el) return;
        var val = el.value;
        el.innerHTML = (id==='ptFiltreCABINET')
            ? '<option value="">Tous les cabinets</option>'
            : '<option value="">-- Sélectionner un cabinet --</option>';
        PT.cabinets.filter(function(c){ return c.actif; }).forEach(function(c) {
            el.innerHTML += '<option value="' + c.id + '">' + c.nom + (c.ville?' — '+c.ville:'') + '</option>';
        });
        if (val) el.value = val;
    });
}

// ── COMPTEURS ─────────────────────────────────────────────────────────────────
function ptMAJCompteurs() {
    var actifs = PT.patients.filter(function(p){ return p.actif; });
    var ald    = actifs.filter(function(p){ return p.ald; });
    var e1=ptEl('ptNbTotal'); if(e1) e1.textContent=actifs.length;
    var e2=ptEl('ptNbALD');   if(e2) e2.textContent=ald.length;
}

// ── AFFICHAGE PATIENTS ────────────────────────────────────────────────────────
function ptRenduPatients() {
    var el = ptEl('ptListePatients');
    if (!el) return;

    var rech   = ((ptEl('ptRecherchePatient')||{}).value||'').toLowerCase().trim();
    var cabFil = ((ptEl('ptFiltreCABINET')||{}).value||'');
    var aldFil = ((ptEl('ptFiltreALD')||{}).value||'');

    var liste = PT.patients.filter(function(p) {
        if (!p.actif) return false;
        if (cabFil && p.cabinet_id !== cabFil) return false;
        if (aldFil === 'ald'   && !p.ald) return false;
        if (aldFil === 'noald' &&  p.ald) return false;
        if (rech) {
            var txt = (p.nom+' '+p.prenom+' '+(p.num_secu||'')).toLowerCase();
            if (txt.indexOf(rech) < 0) return false;
        }
        return true;
    });

    if (!liste.length) {
        el.innerHTML = '<p style="color:#94a3b8;text-align:center;padding:20px;">Aucun patient trouvé.</p>';
        return;
    }

    el.innerHTML = '<table><thead><tr>'
        + '<th>Patient</th><th>Né(e) le</th><th>N° Sécu</th><th>Cabinet</th><th>Médecin</th><th>ALD</th><th>Actions</th>'
        + '</tr></thead><tbody>'
        + liste.map(function(p) {
            var cab = p._cabinet;
            var cabNom = cab ? cab.nom : '<span style="color:#f59e0b;">⚠️ Sans cabinet</span>';
            var ald = p.ald ? '<span style="background:#fef2f2;color:#dc2626;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600;">ALD</span>' : '';
            return '<tr style="cursor:pointer;" onclick="ptOuvrirFiche(\'' + p.id + '\')">'
                + '<td><strong>' + (p.nom||'').toUpperCase() + ' ' + (p.prenom||'') + '</strong><br><small style="color:#64748b;">' + ptAge(p.date_naissance) + '</small></td>'
                + '<td>' + ptFmt(p.date_naissance) + '</td>'
                + '<td style="font-family:monospace;font-size:12px;">' + (p.num_secu||'—') + '</td>'
                + '<td>' + cabNom + '</td>'
                + '<td>' + (p.medecin_traitant||'—') + '</td>'
                + '<td>' + ald + '</td>'
                + '<td onclick="event.stopPropagation();">'
                + '<button onclick="ptOuvrirFiche(\'' + p.id + '\')" style="background:#eff6ff;border:1px solid #bfdbfe;color:#2563eb;padding:4px 10px;border-radius:6px;cursor:pointer;font-size:12px;margin-right:4px;">📋</button>'
                + '<button onclick="ptSupprimerPatient(\'' + p.id + '\')" style="background:#fef2f2;border:1px solid #fecaca;color:#dc2626;padding:4px 10px;border-radius:6px;cursor:pointer;font-size:12px;">🗑️</button>'
                + '</td></tr>';
        }).join('')
        + '</tbody></table>';
}

// ── ACTIONS CABINETS ──────────────────────────────────────────────────────────
function ptFiltrerParCabinet(id) {
    var sel = ptEl('ptFiltreCABINET');
    if (sel) { sel.value = id; ptRenduPatients(); }
    var s = ptEl('ptSectionPatients');
    if (s) s.scrollIntoView({behavior:'smooth'});
}

async function ptSauvegarderCabinet(e) {
    if (e) e.preventDefault();
    if (!ptSC()) return;
    var data = {
        nom:              (ptEl('ptCabNom')||{}).value||'',
        adresse:          (ptEl('ptCabAdresse')||{}).value||'',
        code_postal:      (ptEl('ptCabCP')||{}).value||'',
        ville:            (ptEl('ptCabVille')||{}).value||'',
        telephone:        (ptEl('ptCabTel')||{}).value||'',
        email:            (ptEl('ptCabEmail')||{}).value||'',
        siret:            (ptEl('ptCabSiret')||{}).value||'',
        responsable:      (ptEl('ptCabResponsable')||{}).value||'',
        nom_titulaire:    (ptEl('ptCabNomTitulaire')||{}).value||null,
        taux_retrocession:parseFloat((ptEl('ptCabRetrocession')||{}).value)||35,
        iban:             (ptEl('ptCabIBAN')||{}).value||null,
        actif: true
    };
    if (!data.nom.trim()) { alert('Le nom du cabinet est obligatoire'); return; }
    var r = PT.cabinetEdite
        ? await ptSC().from('cabinets').update(data).eq('id', PT.cabinetEdite)
        : await ptSC().from('cabinets').insert([data]);
    if (r.error) { alert('Erreur : ' + r.error.message); return; }
    PT.cabinetEdite = null;
    if (ptEl('ptFormCabinet')) ptEl('ptFormCabinet').reset();
    if (ptEl('ptModalCabinet')) ptEl('ptModalCabinet').style.display = 'none';
    await ptChargerCabinets();
}

function ptEditerCabinet(id) {
    var c = PT.cabinets.find(function(x){ return x.id===id; });
    if (!c) return;
    PT.cabinetEdite = id;
    var m = {ptCabNom:c.nom, ptCabAdresse:c.adresse, ptCabCP:c.code_postal,
             ptCabVille:c.ville, ptCabTel:c.telephone, ptCabEmail:c.email,
             ptCabSiret:c.siret, ptCabResponsable:c.responsable,
             ptCabNomTitulaire:c.nom_titulaire, ptCabIBAN:c.iban};
    Object.keys(m).forEach(function(k){ var e=ptEl(k); if(e) e.value=m[k]||''; });
    var r=ptEl('ptCabRetrocession'); if(r) r.value=c.taux_retrocession||35;
    if (ptEl('ptModalCabinet')) ptEl('ptModalCabinet').style.display='flex';
}

// ── ACTIONS PATIENTS ──────────────────────────────────────────────────────────
async function ptSauvegarderPatient(e) {
    if (e) e.preventDefault();
    if (!ptSC()) return;
    var cabId = (ptEl('ptCabinetPatient')||{}).value;
    if (!cabId) { alert('Veuillez sélectionner un cabinet infirmier'); return; }
    var data = {
        cabinet_id:      cabId,
        nom:             ((ptEl('ptNom')||{}).value||'').trim().toUpperCase(),
        prenom:          ((ptEl('ptPrenom')||{}).value||'').trim(),
        date_naissance:  (ptEl('ptDtNaissance')||{}).value||null,
        num_secu:        ((ptEl('ptNumSecu')||{}).value||'').replace(/\s/g,''),
        adresse:         (ptEl('ptAdresse')||{}).value||'',
        code_postal:     (ptEl('ptCP')||{}).value||'',
        ville:           (ptEl('ptVille')||{}).value||'',
        telephone:       (ptEl('ptTel')||{}).value||'',
        email:           (ptEl('ptEmail')||{}).value||'',
        medecin_traitant:(ptEl('ptMedecin')||{}).value||'',
        ald:             (ptEl('ptALD')||{}).checked||false,
        ald_motif:       (ptEl('ptALDMotif')||{}).value||'',
        mutuelle:        (ptEl('ptMutuelle')||{}).value||'',
        num_mutuelle:    (ptEl('ptNumMutuelle')||{}).value||'',
        notes:           (ptEl('ptNotes')||{}).value||'',
        actif: true
    };
    if (!data.nom||!data.prenom) { alert('Nom et prénom obligatoires'); return; }
    var r = PT.patientEdite
        ? await ptSC().from('patients').update(data).eq('id', PT.patientEdite)
        : await ptSC().from('patients').insert([data]);
    if (r.error) { alert('Erreur : ' + r.error.message); return; }
    PT.patientEdite = null;
    if (ptEl('ptModalPatient')) ptEl('ptModalPatient').style.display='none';
    await ptChargerPatients();
}

async function ptSupprimerPatient(id) {
    if (!confirm('Archiver ce patient ?')||!ptSC()) return;
    await ptSC().from('patients').update({actif:false}).eq('id',id);
    await ptChargerPatients();
}

function ptEditerPatient(id) {
    var p = PT.patients.find(function(x){ return x.id===id; });
    if (!p) return;
    PT.patientEdite = id;
    var m = {ptCabinetPatient:p.cabinet_id, ptNom:p.nom, ptPrenom:p.prenom,
             ptDtNaissance:p.date_naissance, ptNumSecu:p.num_secu,
             ptAdresse:p.adresse, ptCP:p.code_postal, ptVille:p.ville,
             ptTel:p.telephone, ptEmail:p.email, ptMedecin:p.medecin_traitant,
             ptALDMotif:p.ald_motif, ptMutuelle:p.mutuelle,
             ptNumMutuelle:p.num_mutuelle, ptNotes:p.notes};
    Object.keys(m).forEach(function(k){ var e=ptEl(k); if(e) e.value=m[k]||''; });
    var a=ptEl('ptALD'); if(a) a.checked=p.ald;
    if (ptEl('ptModalPatient')) ptEl('ptModalPatient').style.display='flex';
}

function ptOuvrirFiche(id) {
    window._ptFicheId = id; // mémoriser pour l'historique
    var p = PT.patients.find(function(x){ return x.id===id; });
    if (!p) return;
    var cab = p._cabinet;
    var el = ptEl('ptFicheContenu');
    if (!el) return;
    el.innerHTML = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;">'
        + '<div class="card" style="margin:0;">'
        + '<div style="display:flex;justify-content:space-between;margin-bottom:15px;">'
        + '<h3 style="margin:0;">' + (p.nom||'').toUpperCase() + ' ' + (p.prenom||'') + '</h3>'
        + (p.ald ? '<span style="background:#fef2f2;color:#dc2626;padding:4px 12px;border-radius:12px;font-size:12px;font-weight:600;">ALD — '+(p.ald_motif||'')+'</span>' : '')
        + '</div>'
        + '<table><tbody>'
        + '<tr><td style="color:#64748b;width:160px;">Date de naissance</td><td><strong>'+ptFmt(p.date_naissance)+'</strong> ('+ptAge(p.date_naissance)+')</td></tr>'
        + '<tr><td style="color:#64748b;">N° Sécu</td><td><code style="font-size:12px;">'+(p.num_secu||'—')+'</code></td></tr>'
        + '<tr><td style="color:#64748b;">Téléphone</td><td>'+(p.telephone||'—')+'</td></tr>'
        + '<tr><td style="color:#64748b;">Adresse</td><td>'+[p.adresse,p.code_postal,p.ville].filter(Boolean).join(', ')+'</td></tr>'
        + '<tr><td style="color:#64748b;">Médecin</td><td>'+(p.medecin_traitant||'—')+'</td></tr>'
        + '<tr><td style="color:#64748b;">Mutuelle</td><td>'+(p.mutuelle||'—')+(p.num_mutuelle?' n°'+p.num_mutuelle:'')+'</td></tr>'
        + '</tbody></table>'
        + (p.notes?'<div style="margin-top:10px;padding:10px;background:#f8fafc;border-radius:6px;font-size:13px;">📝 '+p.notes+'</div>':'')
        + '</div>'
        + '<div class="card" style="margin:0;">'
        + '<h3 style="margin:0 0 15px;">🏥 Cabinet</h3>'
        + (cab ? '<table><tbody>'
            + '<tr><td style="color:#64748b;width:120px;">Cabinet</td><td><strong>'+cab.nom+'</strong></td></tr>'
            + '<tr><td style="color:#64748b;">Adresse</td><td>'+[cab.adresse,cab.code_postal,cab.ville].filter(Boolean).join(', ')+'</td></tr>'
            + '<tr><td style="color:#64748b;">Titulaire</td><td>'+(cab.nom_titulaire||'—')+'</td></tr>'
            + '<tr><td style="color:#64748b;">Rétrocession</td><td>'+(cab.taux_retrocession||35)+' %</td></tr>'
            + '</tbody></table>'
            : '<p style="color:#f59e0b;">⚠️ Aucun cabinet associé</p>')
        + '</div></div>'
        + '<div style="display:flex;gap:10px;margin-top:15px;">'
        + '<button onclick="ptEditerPatient(\''+p.id+'\')" class="btn-primary" style="padding:8px 16px;">✏️ Modifier</button>'
        + '<button onclick="ouvrirNouveauPassage(\''+p.id+'\')" style="background:#f0fdf4;border:1px solid #bbf7d0;color:#16a34a;padding:8px 16px;border-radius:6px;font-weight:600;cursor:pointer;">➕ Nouveau passage</button>'
        + '<button onclick="ptFermerFiche()" style="background:#f8fafc;border:1px solid #e2e8f0;padding:8px 16px;border-radius:6px;cursor:pointer;">← Retour</button>'
        + '</div>';
    if (ptEl('ptSectionFiche')) ptEl('ptSectionFiche').style.display='block';
    // Charger l'historique automatiquement
    setTimeout(function() {
        if (typeof window.chargerHistoriquePassages === 'function')
            window.chargerHistoriquePassages(id, 'passHistoriquePatient');
    }, 300);
}

function ptFermerFiche() {
    if (ptEl('ptSectionFiche')) ptEl('ptSectionFiche').style.display='none';
}

function ptAjouterPassage(id) {
    if (typeof window.ouvrirNouveauPassage==='function') window.ouvrirNouveauPassage(id);
}

// ── RÉTROCESSION ──────────────────────────────────────────────────────────────
window.getTauxRetrocession = function(cabinetId) {
    if (!cabinetId) return 35;
    var cab = PT.cabinets.find(function(c){ return c.id===cabinetId; });
    return cab ? (cab.taux_retrocession||35) : 35;
};

// ── INIT ──────────────────────────────────────────────────────────────────────
window.ptSauvegarderCabinet  = ptSauvegarderCabinet;
window.ptEditerCabinet       = ptEditerCabinet;
window.ptFiltrerParCabinet   = ptFiltrerParCabinet;
window.ptSauvegarderPatient  = ptSauvegarderPatient;
window.ptSupprimerPatient    = ptSupprimerPatient;
window.ptOuvrirFiche         = ptOuvrirFiche;
window.ptFermerFiche         = ptFermerFiche;
window.ptEditerPatient       = ptEditerPatient;
window.ptRenduPatients       = ptRenduPatients;

window.initPatients = async function() {
    console.log('[patients] initPatients appelé, supabaseClient=', !!ptSC());

    // Attacher filtres (une fois)
    if (!window._ptFiltersOk) {
        window._ptFiltersOk = true;
        ['ptRecherchePatient','ptFiltreCABINET','ptFiltreALD'].forEach(function(id) {
            var e = ptEl(id);
            if (e) { e.addEventListener('input', ptRenduPatients); e.addEventListener('change', ptRenduPatients); }
        });
    }

    // Retry si Supabase pas encore prêt
    if (!ptSC()) {
        console.warn('[patients] Supabase pas encore prêt, retry dans 1.5s');
        ptHtml('ptListeCabinets', '<p style="color:#f59e0b;">⏳ Connexion en cours...</p>');
        setTimeout(window.initPatients, 1500);
        return;
    }

    await ptChargerCabinets();
    await ptChargerPatients();
};
