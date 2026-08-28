// ============================================================================
// patients.js — Gestion des patients et cabinets infirmiers
// ============================================================================

var PT = {
    cabinets: [],
    patients: [],
    cabinetActif: null,
    patientActif: null,
    vue: 'liste'  // 'liste' | 'fiche' | 'cabinet'
};

// ── Utilitaires ──────────────────────────────────────────────────────────────

function ptFmt(date) {
    if (!date) return '—';
    return new Date(date).toLocaleDateString('fr-FR');
}

function ptAge(dateNaissance) {
    if (!dateNaissance) return '';
    var diff = Date.now() - new Date(dateNaissance).getTime();
    return Math.floor(diff / (365.25 * 24 * 3600 * 1000)) + ' ans';
}

function ptSC() { return window.supabaseClient; }

// ── CABINETS ─────────────────────────────────────────────────────────────────

async function ptChargerCabinets() {
    if (!ptSC()) return;
    var r = await ptSC().from('cabinets').select('*').order('nom');
    if (!r.error) {
        PT.cabinets = r.data || [];
        ptRenouvellerSelectCabinets();
    }
}

function ptRenouvellerSelectCabinets() {
    var sels = ['ptFiltreCABINET','ptCabinetPatient','ptCabinetPassage'];
    sels.forEach(function(id) {
        var el = document.getElementById(id);
        if (!el) return;
        var val = el.value;
        el.innerHTML = (id === 'ptFiltreCABINET')
            ? '<option value="">Tous les cabinets</option>'
            : '<option value="">-- Sélectionner un cabinet --</option>';
        PT.cabinets.filter(function(c){ return c.actif; }).forEach(function(c) {
            el.innerHTML += '<option value="' + c.id + '">' + c.nom + ' — ' + (c.ville || '') + '</option>';
        });
        if (val) el.value = val;
    });
}

async function ptSauvegarderCabinet(e) {
    if (e) e.preventDefault();
    if (!ptSC()) return;
    var data = {
        nom:         document.getElementById('ptCabNom').value.trim(),
        adresse:     document.getElementById('ptCabAdresse').value.trim(),
        code_postal: document.getElementById('ptCabCP').value.trim(),
        ville:       document.getElementById('ptCabVille').value.trim(),
        telephone:   document.getElementById('ptCabTel').value.trim(),
        email:       document.getElementById('ptCabEmail').value.trim(),
        siret:       document.getElementById('ptCabSiret').value.trim(),
        responsable: document.getElementById('ptCabResponsable').value.trim(),
        actif: true
    };
    if (!data.nom) { alert('Le nom du cabinet est obligatoire'); return; }
    var r;
    if (PT.cabinetEdite) {
        r = await ptSC().from('cabinets').update(data).eq('id', PT.cabinetEdite);
    } else {
        r = await ptSC().from('cabinets').insert([data]);
    }
    if (r.error) { alert('Erreur : ' + r.error.message); return; }
    PT.cabinetEdite = null;
    document.getElementById('ptFormCabinet').reset();
    document.getElementById('ptModalCabinet').style.display = 'none';
    await ptChargerCabinets();
    await ptChargerPatients();
    ptRenduCabinets();
}

function ptRenduCabinets() {
    var el = document.getElementById('ptListeCabinets');
    if (!el) return;
    if (!PT.cabinets.length) {
        el.innerHTML = '<p style="color:#94a3b8;text-align:center;padding:20px;">Aucun cabinet enregistré. Cliquez sur "Nouveau cabinet" pour commencer.</p>';
        return;
    }
    el.innerHTML = PT.cabinets.map(function(c) {
        var nbPt = PT.patients.filter(function(p){ return p.cabinet_id === c.id; }).length;
        return '<div style="display:flex;justify-content:space-between;align-items:center;padding:12px;border:1px solid #e2e8f0;border-radius:8px;margin-bottom:8px;background:white;cursor:pointer;" onclick="ptFiltrerParCabinet(\'' + c.id + '\')">'
            + '<div>'
            + '<div style="font-weight:600;color:#1e293b;">' + c.nom + '</div>'
            + '<div style="font-size:13px;color:#64748b;">' + [c.adresse, c.code_postal, c.ville].filter(Boolean).join(', ') + '</div>'
            + '<div style="font-size:12px;color:#94a3b8;margin-top:2px;">' + (c.responsable ? 'Dr/IDE ' + c.responsable + ' — ' : '') + (c.telephone || '') + '</div>'
            + '</div>'
            + '<div style="display:flex;gap:8px;align-items:center;">'
            + '<span style="background:#eff6ff;color:#2563eb;padding:4px 10px;border-radius:12px;font-size:12px;font-weight:600;">' + nbPt + ' patient' + (nbPt > 1 ? 's' : '') + '</span>'
            + '<button onclick="event.stopPropagation();ptEditerCabinet(\'' + c.id + '\')" style="background:#f8fafc;border:1px solid #e2e8f0;padding:4px 10px;border-radius:6px;cursor:pointer;font-size:12px;">✏️</button>'
            + '</div>'
            + '</div>';
    }).join('');
}

function ptEditerCabinet(id) {
    var c = PT.cabinets.find(function(x){ return x.id === id; });
    if (!c) return;
    PT.cabinetEdite = id;
    var champs = {ptCabNom:c.nom, ptCabAdresse:c.adresse, ptCabCP:c.code_postal,
                  ptCabVille:c.ville, ptCabTel:c.telephone, ptCabEmail:c.email,
                  ptCabSiret:c.siret, ptCabResponsable:c.responsable};
    Object.keys(champs).forEach(function(k) {
        var el = document.getElementById(k);
        if (el) el.value = champs[k] || '';
    });
    document.getElementById('ptModalCabinet').style.display = 'flex';
}

function ptFiltrerParCabinet(cabinetId) {
    var sel = document.getElementById('ptFiltreCABINET');
    if (sel) sel.value = cabinetId;
    ptRenduPatients();
    // Scroll vers la liste patients
    var el = document.getElementById('ptSectionPatients');
    if (el) el.scrollIntoView({behavior:'smooth'});
}

// ── PATIENTS ─────────────────────────────────────────────────────────────────

async function ptChargerPatients() {
    if (!ptSC()) return;
    var r = await ptSC().from('patients').select('*, cabinets(nom, ville)').order('nom');
    if (!r.error) {
        PT.patients = r.data || [];
        ptRenduPatients();
        ptRenduCabinets();
        ptMAJCompteurs();
    }
}

function ptMAJCompteurs() {
    var el = document.getElementById('ptNbTotal');
    if (el) el.textContent = PT.patients.filter(function(p){ return p.actif; }).length;
    var elA = document.getElementById('ptNbALD');
    if (elA) elA.textContent = PT.patients.filter(function(p){ return p.ald && p.actif; }).length;
}

function ptRenduPatients() {
    var el = document.getElementById('ptListePatients');
    if (!el) return;
    var recherche = ((document.getElementById('ptRecherchePatient')||{}).value||'').toLowerCase().trim();
    var cabinetFil = ((document.getElementById('ptFiltreCABINET')||{}).value||'');
    var aldFil = ((document.getElementById('ptFiltreALD')||{}).value||'');

    var liste = PT.patients.filter(function(p) {
        if (!p.actif) return false;
        if (cabinetFil && p.cabinet_id !== cabinetFil) return false;
        if (aldFil === 'ald' && !p.ald) return false;
        if (aldFil === 'noald' && p.ald) return false;
        if (recherche) {
            var txt = (p.nom + ' ' + p.prenom + ' ' + (p.num_secu||'')).toLowerCase();
            if (txt.indexOf(recherche) < 0) return false;
        }
        return true;
    });

    if (!liste.length) {
        el.innerHTML = '<p style="color:#94a3b8;text-align:center;padding:30px;">Aucun patient trouvé.</p>';
        return;
    }

    el.innerHTML = '<table><thead><tr>'
        + '<th>Patient</th><th>Né(e) le</th><th>N° Sécu</th>'
        + '<th>Cabinet</th><th>Médecin traitant</th><th>ALD</th><th>Actions</th>'
        + '</tr></thead><tbody>'
        + liste.map(function(p) {
            var cab = p.cabinets ? p.cabinets.nom + (p.cabinets.ville ? ' (' + p.cabinets.ville + ')' : '') : '<span style="color:#f59e0b;">⚠️ Sans cabinet</span>';
            var ald = p.ald ? '<span style="background:#fef2f2;color:#dc2626;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600;">ALD ✓</span>' : '';
            return '<tr style="cursor:pointer;" onclick="ptOuvrirFiche(\'' + p.id + '\')">'
                + '<td><strong>' + p.nom.toUpperCase() + ' ' + p.prenom + '</strong><br><small style="color:#64748b;">' + ptAge(p.date_naissance) + '</small></td>'
                + '<td>' + ptFmt(p.date_naissance) + '</td>'
                + '<td style="font-family:monospace;font-size:12px;">' + (p.num_secu || '—') + '</td>'
                + '<td>' + cab + '</td>'
                + '<td>' + (p.medecin_traitant || '—') + '</td>'
                + '<td>' + ald + '</td>'
                + '<td onclick="event.stopPropagation();">'
                + '<button onclick="ptOuvrirFiche(\'' + p.id + '\')" style="background:#eff6ff;border:1px solid #bfdbfe;color:#2563eb;padding:4px 10px;border-radius:6px;cursor:pointer;font-size:12px;margin-right:4px;">📋 Fiche</button>'
                + '<button onclick="ptSupprimerPatient(\'' + p.id + '\')" style="background:#fef2f2;border:1px solid #fecaca;color:#dc2626;padding:4px 10px;border-radius:6px;cursor:pointer;font-size:12px;">🗑️</button>'
                + '</td></tr>';
        }).join('')
        + '</tbody></table>';
}

async function ptSauvegarderPatient(e) {
    if (e) e.preventDefault();
    if (!ptSC()) return;
    var cabinetId = document.getElementById('ptCabinetPatient').value;
    if (!cabinetId) { alert('Veuillez sélectionner un cabinet infirmier'); return; }
    var data = {
        cabinet_id:      cabinetId,
        nom:             (document.getElementById('ptNom').value||'').trim().toUpperCase(),
        prenom:          (document.getElementById('ptPrenom').value||'').trim(),
        date_naissance:  document.getElementById('ptDtNaissance').value || null,
        num_secu:        (document.getElementById('ptNumSecu').value||'').replace(/\s/g,''),
        adresse:         (document.getElementById('ptAdresse').value||'').trim(),
        code_postal:     (document.getElementById('ptCP').value||'').trim(),
        ville:           (document.getElementById('ptVille').value||'').trim(),
        telephone:       (document.getElementById('ptTel').value||'').trim(),
        email:           (document.getElementById('ptEmail').value||'').trim(),
        medecin_traitant:(document.getElementById('ptMedecin').value||'').trim(),
        ald:             document.getElementById('ptALD').checked,
        ald_motif:       (document.getElementById('ptALDMotif').value||'').trim(),
        mutuelle:        (document.getElementById('ptMutuelle').value||'').trim(),
        num_mutuelle:    (document.getElementById('ptNumMutuelle').value||'').trim(),
        notes:           (document.getElementById('ptNotes').value||'').trim(),
        actif: true
    };
    if (!data.nom || !data.prenom) { alert('Nom et prénom obligatoires'); return; }
    var r;
    if (PT.patientEdite) {
        r = await ptSC().from('patients').update(data).eq('id', PT.patientEdite);
    } else {
        r = await ptSC().from('patients').insert([data]);
    }
    if (r.error) { alert('Erreur : ' + r.error.message); return; }
    PT.patientEdite = null;
    document.getElementById('ptModalPatient').style.display = 'none';
    await ptChargerPatients();
}

async function ptSupprimerPatient(id) {
    if (!confirm('Archiver ce patient ?')) return;
    if (!ptSC()) return;
    await ptSC().from('patients').update({actif:false}).eq('id', id);
    await ptChargerPatients();
}

function ptOuvrirFiche(id) {
    var p = PT.patients.find(function(x){ return x.id === id; });
    if (!p) return;
    PT.patientActif = p;
    var el = document.getElementById('ptFicheContenu');
    if (!el) return;
    var cab = PT.cabinets.find(function(c){ return c.id === p.cabinet_id; });
    el.innerHTML = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;">'
        // Infos patient
        + '<div class="card" style="margin:0;">'
        + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:15px;">'
        + '<h3 style="margin:0;">👤 ' + p.nom + ' ' + p.prenom + '</h3>'
        + (p.ald ? '<span style="background:#fef2f2;color:#dc2626;padding:4px 12px;border-radius:12px;font-weight:600;">ALD — ' + (p.ald_motif||'') + '</span>' : '')
        + '</div>'
        + '<table><tbody>'
        + '<tr><td style="color:#64748b;width:160px;">Date de naissance</td><td><strong>' + ptFmt(p.date_naissance) + '</strong> (' + ptAge(p.date_naissance) + ')</td></tr>'
        + '<tr><td style="color:#64748b;">N° Sécurité Sociale</td><td><code style="font-size:13px;">' + (p.num_secu||'—') + '</code></td></tr>'
        + '<tr><td style="color:#64748b;">Téléphone</td><td>' + (p.telephone||'—') + '</td></tr>'
        + '<tr><td style="color:#64748b;">Adresse</td><td>' + [p.adresse, p.code_postal, p.ville].filter(Boolean).join(', ') + '</td></tr>'
        + '<tr><td style="color:#64748b;">Médecin traitant</td><td>' + (p.medecin_traitant||'—') + '</td></tr>'
        + '<tr><td style="color:#64748b;">Mutuelle</td><td>' + (p.mutuelle||'—') + (p.num_mutuelle ? ' n°' + p.num_mutuelle : '') + '</td></tr>'
        + '</tbody></table>'
        + (p.notes ? '<div style="margin-top:10px;padding:10px;background:#f8fafc;border-radius:6px;font-size:13px;color:#475569;">📝 ' + p.notes + '</div>' : '')
        + '</div>'
        // Infos cabinet
        + '<div class="card" style="margin:0;">'
        + '<h3 style="margin:0 0 15px;">🏥 Cabinet infirmier</h3>'
        + (cab ? '<table><tbody>'
            + '<tr><td style="color:#64748b;width:120px;">Cabinet</td><td><strong>' + cab.nom + '</strong></td></tr>'
            + '<tr><td style="color:#64748b;">Adresse</td><td>' + [cab.adresse, cab.code_postal, cab.ville].filter(Boolean).join(', ') + '</td></tr>'
            + '<tr><td style="color:#64748b;">Téléphone</td><td>' + (cab.telephone||'—') + '</td></tr>'
            + '<tr><td style="color:#64748b;">Responsable</td><td>' + (cab.responsable||'—') + '</td></tr>'
            + '</tbody></table>'
            : '<p style="color:#f59e0b;">⚠️ Aucun cabinet associé</p>')
        + '</div></div>'
        + '<div style="display:flex;gap:10px;margin-top:15px;">'
        + '<button onclick="ptEditerPatient(\'' + p.id + '\')" class="btn-primary" style="padding:8px 16px;">✏️ Modifier</button>'
        + '<button onclick="ptAjouterPassage(\'' + p.id + '\')" style="background:#f0fdf4;border:1px solid #bbf7d0;color:#16a34a;padding:8px 16px;border-radius:6px;font-weight:600;cursor:pointer;">➕ Nouveau passage</button>'
        + '<button onclick="ptFermerFiche()" style="background:#f8fafc;border:1px solid #e2e8f0;padding:8px 16px;border-radius:6px;cursor:pointer;">← Retour</button>'
        + '</div>';
    document.getElementById('ptSectionFiche').style.display = 'block';
    document.getElementById('ptSectionListe').style.display = 'none';
    el.scrollIntoView({behavior:'smooth'});
}

function ptFermerFiche() {
    document.getElementById('ptSectionFiche').style.display = 'none';
    document.getElementById('ptSectionListe').style.display = 'block';
}

function ptEditerPatient(id) {
    var p = PT.patients.find(function(x){ return x.id === id; });
    if (!p) return;
    PT.patientEdite = id;
    var champs = {
        ptCabinetPatient: p.cabinet_id, ptNom: p.nom, ptPrenom: p.prenom,
        ptDtNaissance: p.date_naissance, ptNumSecu: p.num_secu,
        ptAdresse: p.adresse, ptCP: p.code_postal, ptVille: p.ville,
        ptTel: p.telephone, ptEmail: p.email, ptMedecin: p.medecin_traitant,
        ptALDMotif: p.ald_motif, ptMutuelle: p.mutuelle, ptNumMutuelle: p.num_mutuelle, ptNotes: p.notes
    };
    Object.keys(champs).forEach(function(k) {
        var el = document.getElementById(k);
        if (el) el.value = champs[k] || '';
    });
    var ald = document.getElementById('ptALD');
    if (ald) ald.checked = p.ald;
    document.getElementById('ptModalPatient').style.display = 'flex';
}

function ptAjouterPassage(patientId) {
    // TODO : ouvrir modal passage avec NGAP
    alert('Fonctionnalité "Nouveau passage" à venir avec sélection des actes NGAP.');
}

// ── Init ─────────────────────────────────────────────────────────────────────

window.initPatients = async function() {
    // Filtres
    ['ptRecherchePatient','ptFiltreCABINET','ptFiltreALD'].forEach(function(id) {
        var el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', ptRenduPatients);
            el.addEventListener('change', ptRenduPatients);
        }
    });
    await ptChargerCabinets();
    await ptChargerPatients();
};

// Expose
window.ptSauvegarderCabinet  = ptSauvegarderCabinet;
window.ptEditerCabinet        = ptEditerCabinet;
window.ptFiltrerParCabinet    = ptFiltrerParCabinet;
window.ptSauvegarderPatient   = ptSauvegarderPatient;
window.ptSupprimerPatient     = ptSupprimerPatient;
window.ptOuvrirFiche          = ptOuvrirFiche;
window.ptFermerFiche          = ptFermerFiche;
window.ptEditerPatient        = ptEditerPatient;
window.ptAjouterPassage       = ptAjouterPassage;
window.ptRenduPatients        = ptRenduPatients;
