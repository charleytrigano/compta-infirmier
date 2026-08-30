// ============================================================================
// agenda.js — Calendrier & Carnet de RDV
// Alimente automatiquement les Passages du jour
// ============================================================================

var AGD = {
    annee: new Date().getFullYear(),
    mois:  new Date().getMonth(),   // 0-11
    rdvs:  [],
    rdvEdite: null
};

var MOIS_FR = ['Janvier','Février','Mars','Avril','Mai','Juin',
               'Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
var JOURS_FR = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'];

function agSC() { return window.supabaseClient || null; }
function agEl(id) { return document.getElementById(id); }
function agFmt(date) { try { return new Date(date).toLocaleDateString('fr-FR'); } catch(e) { return date; } }

// ── CHARGEMENT ────────────────────────────────────────────────────────────────
window.chargerAgenda = async function() {
    var sc = agSC(); if (!sc) return;

    // Charger le mois courant ± 1 mois
    var debut = new Date(AGD.annee, AGD.mois - 1, 1).toISOString().split('T')[0];
    var fin   = new Date(AGD.annee, AGD.mois + 2, 0).toISOString().split('T')[0];

    var r = await sc.from('rendez_vous')
        .select('*, patients(nom,prenom,telephone)')
        .gte('date_rdv', debut).lte('date_rdv', fin)
        .order('date_rdv').order('heure_rdv');

    AGD.rdvs = r.data || [];
    agRenduCalendrier();
    agRenduListeJour(new Date().toISOString().split('T')[0]);
};

// ── CALENDRIER ────────────────────────────────────────────────────────────────
window.agMoisPrecedent = function() {
    AGD.mois--;
    if (AGD.mois < 0) { AGD.mois = 11; AGD.annee--; }
    window.chargerAgenda();
};
window.agMoisSuivant = function() {
    AGD.mois++;
    if (AGD.mois > 11) { AGD.mois = 0; AGD.annee++; }
    window.chargerAgenda();
};
window.agAujourdhui = function() {
    var n = new Date();
    AGD.annee = n.getFullYear(); AGD.mois = n.getMonth();
    window.chargerAgenda();
};

function agRenduCalendrier() {
    var el = agEl('agCalendrier'); if (!el) return;

    var today = new Date().toISOString().split('T')[0];
    var premier = new Date(AGD.annee, AGD.mois, 1);
    var dernier = new Date(AGD.annee, AGD.mois + 1, 0);
    var nbJours = dernier.getDate();
    // Lundi=0...Dimanche=6
    var premierJour = (premier.getDay() + 6) % 7;

    // En-tête mois
    var titre = document.getElementById('agTitreMois');
    if (titre) titre.textContent = MOIS_FR[AGD.mois] + ' ' + AGD.annee;

    // RDVs indexés par date
    var rdvParDate = {};
    AGD.rdvs.forEach(function(r) {
        if (!rdvParDate[r.date_rdv]) rdvParDate[r.date_rdv] = [];
        rdvParDate[r.date_rdv].push(r);
    });

    var html = '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:1px;background:#e2e8f0;border-radius:8px;overflow:hidden;">';

    // En-têtes jours
    JOURS_FR.forEach(function(j, i) {
        var we = i >= 5;
        html += '<div style="background:'+(we?'#f1f5f9':'#1e293b')+';color:'+(we?'#64748b':'white')+';text-align:center;padding:8px 4px;font-size:11px;font-weight:700;">'+j+'</div>';
    });

    // Cases vides avant le 1er
    for (var v = 0; v < premierJour; v++) {
        html += '<div style="background:#f8fafc;min-height:80px;"></div>';
    }

    // Jours du mois
    for (var d = 1; d <= nbJours; d++) {
        var dateStr = AGD.annee + '-' + ('0'+(AGD.mois+1)).slice(-2) + '-' + ('0'+d).slice(-2);
        var rdvsJour = rdvParDate[dateStr] || [];
        var estAujourdhui = dateStr === today;
        var we = (new Date(AGD.annee, AGD.mois, d).getDay() + 6) % 7 >= 5;

        html += '<div onclick="agSelectionnerJour(\''+dateStr+'\')" style="background:'+(estAujourdhui?'#eff6ff':(we?'#fafafa':'white'))+';min-height:80px;padding:4px;cursor:pointer;transition:background 0.15s;" '
            +'onmouseover="this.style.background=\'#f0f9ff\'" onmouseout="this.style.background=\''+(estAujourdhui?'#eff6ff':(we?'#fafafa':'white'))+'\'"> '
            +'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:2px;">'
            +'<span style="font-size:13px;font-weight:'+(estAujourdhui?'700':'500')+';color:'+(estAujourdhui?'#2563eb':(we?'#94a3b8':'#1e293b'))+';'+(estAujourdhui?'background:#2563eb;color:white;border-radius:50%;width:22px;height:22px;display:flex;align-items:center;justify-content:center;':'')+'">'+(estAujourdhui?'<span style="font-size:12px;">'+d+'</span>':d)+'</span>'
            +(rdvsJour.length?'<span style="background:#2563eb;color:white;border-radius:8px;padding:0 5px;font-size:10px;font-weight:700;">'+rdvsJour.length+'</span>':'')
            +'</div>';

        // Afficher les 2 premiers RDVs
        rdvsJour.slice(0,2).forEach(function(r) {
            var pt = r.patients || {};
            var couleur = r.statut==='effectue'?'#dcfce7;color:#166534':r.statut==='annule'?'#fef2f2;color:#991b1b':'#dbeafe;color:#1d4ed8';
            html += '<div style="background:'+couleur+';border-radius:3px;padding:2px 4px;font-size:10px;margin-bottom:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'
                +r.heure_rdv+' '+(pt.nom||'').toUpperCase()+' '+(pt.prenom||'')
                +'</div>';
        });
        if (rdvsJour.length > 2) {
            html += '<div style="font-size:10px;color:#64748b;">+'+(rdvsJour.length-2)+' autre(s)</div>';
        }

        html += '</div>';
    }

    // Cases vides après le dernier
    var reste = (7 - (premierJour + nbJours) % 7) % 7;
    for (var i = 0; i < reste; i++) {
        html += '<div style="background:#f8fafc;min-height:80px;"></div>';
    }
    html += '</div>';
    el.innerHTML = html;
}

// ── SÉLECTION JOUR ────────────────────────────────────────────────────────────
var agJourSelectionne = null;
window.agSelectionnerJour = function(dateStr) {
    agJourSelectionne = dateStr;
    agRenduListeJour(dateStr);
    // Scroller vers la liste
    var el = agEl('agListeJour');
    if (el) el.scrollIntoView({behavior:'smooth', block:'nearest'});
};

function agRenduListeJour(dateStr) {
    var elTitre = agEl('agTitreJour');
    var elListe = agEl('agListeJour');
    if (!elListe) return;

    var rdvsJour = AGD.rdvs.filter(function(r){ return r.date_rdv === dateStr; })
        .sort(function(a,b){ return a.heure_rdv.localeCompare(b.heure_rdv); });

    if (elTitre) elTitre.textContent = agFmt(dateStr);

    // Bouton "Nouveau RDV" avec date pré-remplie
    var btnAdd = agEl('agBtnNouveauRdv');
    if (btnAdd) { btnAdd.onclick = function(){ agOuvrirModal(dateStr); }; }

    if (!rdvsJour.length) {
        elListe.innerHTML = '<p style="color:#94a3b8;font-size:13px;text-align:center;padding:20px;">Aucun rendez-vous ce jour.<br>Cliquez "Nouveau RDV" pour en ajouter un.</p>';
        return;
    }

    elListe.innerHTML = rdvsJour.map(function(r) {
        var pt = r.patients || {};
        var nomPt = (pt.nom||'').toUpperCase()+' '+(pt.prenom||'');
        var statutColor = r.statut==='effectue'?'#16a34a':r.statut==='annule'?'#dc2626':'#2563eb';
        var statutBg    = r.statut==='effectue'?'#dcfce7':r.statut==='annule'?'#fef2f2':'#dbeafe';
        var statutLabel = r.statut==='effectue'?'✅ Effectué':r.statut==='annule'?'❌ Annulé':'📅 Planifié';
        return '<div style="border:1px solid #e2e8f0;border-radius:8px;padding:12px;margin-bottom:8px;background:white;border-left:4px solid '+statutColor+';">'
            +'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">'
            +'<div>'
            +'<span style="font-size:16px;font-weight:700;color:#1e293b;">🕐 '+r.heure_rdv+'</span>'
            +' <span style="font-size:12px;color:#64748b;">('+r.duree_minutes+' min)</span>'
            +'</div>'
            +'<span style="background:'+statutBg+';color:'+statutColor+';padding:3px 10px;border-radius:10px;font-size:11px;font-weight:600;">'+statutLabel+'</span>'
            +'</div>'
            +'<div style="font-size:14px;font-weight:600;color:#1e293b;margin-bottom:4px;">👤 '+nomPt+'</div>'
            +(pt.telephone?'<div style="font-size:12px;color:#64748b;margin-bottom:4px;">📞 '+pt.telephone+'</div>':'')
            +(r.actes_prevus?'<div style="font-size:12px;color:#475569;margin-bottom:6px;">🩺 Actes prévus : '+r.actes_prevus+'</div>':'')
            +(r.notes?'<div style="font-size:12px;color:#64748b;background:#f8fafc;padding:6px 8px;border-radius:4px;margin-bottom:8px;">📝 '+r.notes+'</div>':'')
            +'<div style="display:flex;gap:6px;flex-wrap:wrap;">'
            +(r.statut==='planifie'?
                '<button onclick="agConvertirEnPassage(\''+r.id+'\')" style="background:#f0fdf4;border:1px solid #bbf7d0;color:#16a34a;padding:5px 12px;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;">➕ Démarrer le passage</button>'
                +'<button onclick="agChangerStatut(\''+r.id+'\',\'annule\')" style="background:#fef2f2;border:1px solid #fecaca;color:#dc2626;padding:5px 10px;border-radius:6px;font-size:12px;cursor:pointer;">❌ Annuler</button>'
                :'')
            +'<button onclick="agEditerRdv(\''+r.id+'\')" style="background:#f8fafc;border:1px solid #e2e8f0;color:#475569;padding:5px 10px;border-radius:6px;font-size:12px;cursor:pointer;">✏️ Modifier</button>'
            +'<button onclick="agSupprimerRdv(\''+r.id+'\')" style="background:#fef2f2;border:1px solid #fecaca;color:#dc2626;padding:5px 8px;border-radius:6px;font-size:12px;cursor:pointer;">🗑️</button>'
            +'</div></div>';
    }).join('');
}

// ── MODAL NOUVEAU RDV ─────────────────────────────────────────────────────────
function agOuvrirModal(dateStr) {
    AGD.rdvEdite = null;
    var m = agEl('agModal'); if (!m) return;
    var f = agEl('agFormRdv'); if (f) f.reset();

    // Pré-remplir la date et l'heure
    var date = agEl('agRdvDate'); if (date) date.value = dateStr || new Date().toISOString().split('T')[0];
    var heure = agEl('agRdvHeure');
    if (heure && !heure.value) heure.value = '08:00';

    // Remplir le select patients
    agRemplirSelectPatients();
    m.style.display = 'flex';
}

window.agOuvrirModalAujourdhui = function() { agOuvrirModal(new Date().toISOString().split('T')[0]); };

function agEditerRdv(id) {
    var r = AGD.rdvs.find(function(x){ return x.id===id; }); if (!r) return;
    AGD.rdvEdite = id;
    var m = agEl('agModal'); if (!m) return;
    agRemplirSelectPatients(r.patient_id);
    var f = {agRdvDate:r.date_rdv, agRdvHeure:r.heure_rdv, agRdvDuree:r.duree_minutes,
             agRdvActes:r.actes_prevus, agRdvNotes:r.notes};
    Object.keys(f).forEach(function(k){ var e=agEl(k); if(e) e.value=f[k]||''; });
    m.style.display = 'flex';
}

function agRemplirSelectPatients(selectedId) {
    var sel = agEl('agRdvPatient'); if (!sel) return;
    sel.innerHTML = '<option value="">-- Sélectionner un patient --</option>';
    if (window.PT && PT.patients) {
        PT.patients.filter(function(p){ return p.actif; }).forEach(function(p) {
            var opt = document.createElement('option');
            opt.value = p.id;
            opt.textContent = p.nom.toUpperCase()+' '+p.prenom;
            if (selectedId && p.id === selectedId) opt.selected = true;
            sel.appendChild(opt);
        });
    }
}

window.agFermerModal = function() { var m=agEl('agModal'); if(m) m.style.display='none'; };

window.agSauvegarderRdv = async function(e) {
    if (e) e.preventDefault();
    var sc = agSC(); if (!sc) return;
    var patientId = (agEl('agRdvPatient')||{}).value;
    if (!patientId) { alert('Sélectionnez un patient'); return; }
    var date = (agEl('agRdvDate')||{}).value;
    var heure = (agEl('agRdvHeure')||{}).value;
    if (!date || !heure) { alert('Date et heure obligatoires'); return; }

    // Trouver le cabinet du patient
    var patient = (window.PT && PT.patients) ? PT.patients.find(function(p){ return p.id===patientId; }) : null;

    var data = {
        patient_id:    patientId,
        cabinet_id:    patient ? patient.cabinet_id : null,
        date_rdv:      date,
        heure_rdv:     heure,
        duree_minutes: parseInt((agEl('agRdvDuree')||{}).value) || 30,
        actes_prevus:  (agEl('agRdvActes')||{}).value || null,
        notes:         (agEl('agRdvNotes')||{}).value || null,
        statut:        'planifie'
    };

    var r = AGD.rdvEdite
        ? await sc.from('rendez_vous').update(data).eq('id', AGD.rdvEdite)
        : await sc.from('rendez_vous').insert([data]);

    if (r.error) { alert('Erreur : '+r.error.message); return; }
    window.agFermerModal();
    await window.chargerAgenda();
    if (agJourSelectionne) agRenduListeJour(agJourSelectionne);
};

window.agSupprimerRdv = async function(id) {
    if (!confirm('Supprimer ce rendez-vous ?')) return;
    var sc = agSC(); if (!sc) return;
    await sc.from('rendez_vous').delete().eq('id', id);
    await window.chargerAgenda();
    if (agJourSelectionne) agRenduListeJour(agJourSelectionne);
};

window.agChangerStatut = async function(id, statut) {
    var sc = agSC(); if (!sc) return;
    await sc.from('rendez_vous').update({statut:statut}).eq('id', id);
    await window.chargerAgenda();
    if (agJourSelectionne) agRenduListeJour(agJourSelectionne);
};

// ── CONVERTIR RDV → PASSAGE ───────────────────────────────────────────────────
window.agConvertirEnPassage = async function(rdvId) {
    var r = AGD.rdvs.find(function(x){ return x.id===rdvId; }); if (!r) return;

    // S'assurer que les patients sont chargés
    if (typeof window.initPatients === 'function' && !(window.PT && PT.patients && PT.patients.length)) {
        await window.initPatients();
    }

    // Ouvrir le modal passage avec le patient pré-sélectionné
    if (typeof window.ouvrirNouveauPassage === 'function') {
        window.ouvrirNouveauPassage(r.patient_id);
        // Pré-remplir la date et l'heure
        setTimeout(function() {
            var d = document.getElementById('passDate');
            var h = document.getElementById('passHeure');
            if (d) d.value = r.date_rdv;
            if (h) h.value = r.heure_rdv;
        }, 200);

        // Marquer le RDV comme effectué après enregistrement du passage
        var _origEnregistrer = window.enregistrerPassage;
        window.enregistrerPassage = async function() {
            await _origEnregistrer();
            // Marquer RDV effectué
            var sc = agSC();
            if (sc) await sc.from('rendez_vous').update({statut:'effectue'}).eq('id', rdvId);
            window.enregistrerPassage = _origEnregistrer; // restaurer
            await window.chargerAgenda();
        };
    }
};

// ── PASSAGES DU JOUR ENRICHIS avec RDVs ───────────────────────────────────────
window.chargerRdvsDuJour = async function() {
    var sc = agSC(); if (!sc) return;
    var today = new Date().toISOString().split('T')[0];

    var r = await sc.from('rendez_vous')
        .select('*, patients(nom,prenom)')
        .eq('date_rdv', today)
        .eq('statut', 'planifie')
        .order('heure_rdv');

    var el = agEl('dashRdvsDuJour'); if (!el) return;
    var rdvs = r.data || [];

    if (!rdvs.length) {
        el.innerHTML = '<p style="color:#94a3b8;font-size:13px;text-align:center;padding:10px;">Aucun RDV planifié aujourd\'hui.</p>';
        return;
    }

    el.innerHTML = '<div style="display:flex;flex-direction:column;gap:6px;">'
        +rdvs.map(function(rdv) {
            var pt = rdv.patients || {};
            return '<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:#eff6ff;border-radius:6px;border-left:3px solid #2563eb;">'
                +'<div>'
                +'<span style="font-weight:700;color:#2563eb;">'+rdv.heure_rdv+'</span>'
                +' <strong>'+(pt.nom||'').toUpperCase()+' '+(pt.prenom||'')+'</strong>'
                +(rdv.actes_prevus?'<br><span style="font-size:11px;color:#64748b;">🩺 '+rdv.actes_prevus+'</span>':'')
                +'</div>'
                +'<button onclick="agConvertirEnPassage(\''+rdv.id+'\')" style="background:#2563eb;color:white;border:none;padding:5px 12px;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;white-space:nowrap;">▶ Démarrer</button>'
                +'</div>';
        }).join('')
        +'</div>';
};

// ── INIT ──────────────────────────────────────────────────────────────────────
window.initAgenda = async function() {
    agJourSelectionne = new Date().toISOString().split('T')[0];
    // Charger les patients si pas déjà fait
    if (typeof window.initPatients === 'function' && !(window.PT && PT.patients && PT.patients.length)) {
        await window.initPatients();
    }
    await window.chargerAgenda();
};
