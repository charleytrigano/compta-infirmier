// ============================================================================
// passages.js — Facturation des passages infirmiers
// Feuille de soins, historique, export CPAM, tableau de bord
// ============================================================================

var PASS = {
    patientId: null, cabinetId: null,
    patient: null, cabinet: null,
    actes: [], majorations: []
};

var PASS_ACTES_RAPIDES = [
    {code:'AMI 1',   label:'Injection SC/IM',              coeff:1,    type:'ami', idx:0},
    {code:'AMI 1,5', label:'Prélèvement sanguin',          coeff:1.5,  type:'ami', idx:1},
    {code:'AMI 2',   label:'Injection IV',                 coeff:2,    type:'ami', idx:2},
    {code:'AMI 2',   label:'Pansement simple',             coeff:2,    type:'ami', idx:3},
    {code:'AMI 2',   label:'Soins stomie',                 coeff:2,    type:'ami', idx:4},
    {code:'AMI 3',   label:'Pansement complexe',           coeff:3,    type:'ami', idx:5},
    {code:'AMI 3',   label:'Sondage vésical F.',           coeff:3,    type:'ami', idx:6},
    {code:'AMI 3,5', label:'Sondage vésical H.',           coeff:3.5,  type:'ami', idx:7},
    {code:'AMI 4',   label:'SSI / Soins complets',         coeff:4,    type:'ami', idx:8},
    {code:'AMI 4',   label:'Pansement très complexe',      coeff:4,    type:'ami', idx:9},
    {code:'AMI 6',   label:'Soins palliatifs',             coeff:6,    type:'ami', idx:10},
    {code:'AMI 8',   label:'Perfusion IV < 1h',            coeff:8,    type:'ami', idx:11},
    {code:'AMI 12',  label:'Perfusion IV > 1h',            coeff:12,   type:'ami', idx:12},
    {code:'AIS 3',   label:'Psy standard',                 coeff:3,    type:'ami', idx:13},
    {code:'AIS 5',   label:'Psy lourd',                    coeff:5,    type:'ami', idx:14},
    {code:'BSI Init.',label:'BSI Initial',                 coeff:null, type:'bsiInit',  idx:15},
    {code:'BSI Inter.',label:'BSI Intermédiaire',          coeff:null, type:'bsiInter', idx:16},
    {code:'BSI Fin', label:'BSI Fin',                      coeff:null, type:'bsiFin',   idx:17},
];

var PASS_MAJORATIONS = [
    {code:'MAU', label:'Acte Unique',     type:'mau'},
    {code:'MIE', label:'IDE Exclusive',   type:'mie'},
    {code:'MDD', label:'Dimanche/Férié', type:'mdd'},
    {code:'MN',  label:'Nuit 20h-8h',    type:'mn'},
    {code:'MSN', label:'Nuit 0h-6h',     type:'msn'},
];

// ── Tarifs ────────────────────────────────────────────────────────────────────
function passT() {
    var annee = new Date().getFullYear();
    var saved = localStorage.getItem('ngap_tarifs_' + annee);
    if (saved) { try { return JSON.parse(saved); } catch(e){} }
    return { ami:3.15, bsiInit:65.69, bsiInter:32.85, bsiFin:32.85,
             mau:3.50, mie:3.15, mdd:8.35, mn:9.15, msn:19.50 };
}

function passTarifActe(acte) {
    var t = passT();
    if (acte.type === 'ami') return +(acte.coeff * t.ami).toFixed(2);
    return +(t[acte.type] || 0).toFixed(2);
}

function passCalcTotal() {
    var t = passT();
    var total = 0;
    PASS.actes.forEach(function(a){ total += passTarifActe(a) * (a.qte||1); });
    PASS.majorations.forEach(function(m){ total += t[m.type]||0; });
    return +total.toFixed(2);
}

function passGetTauxRetro() {
    if (typeof window.getTauxRetrocession === 'function' && PASS.cabinetId)
        return window.getTauxRetrocession(PASS.cabinetId) / 100;
    return 0.35;
}

function passEstRemplacant() {
    return typeof window.getStatutFacturation === 'function'
        ? window.getStatutFacturation() === 'remplacant' : false;
}

var passNumFacture = function() {
    var d = new Date();
    return 'F' + d.getFullYear() + ('0'+(d.getMonth()+1)).slice(-2)
        + ('0'+d.getDate()).slice(-2) + '-' + Math.floor(Math.random()*9000+1000);
};

// ── Ouvrir le modal ───────────────────────────────────────────────────────────
window.ouvrirNouveauPassage = function(patientId) {
    PASS.patientId = patientId;
    PASS.actes = [];
    PASS.majorations = [];

    var p = (window.PT && PT.patients)
        ? PT.patients.find(function(x){ return x.id===patientId; }) : null;
    PASS.patient = p;
    PASS.cabinetId = p ? p.cabinet_id : null;
    PASS.cabinet = (window.PT && PT.cabinets && PASS.cabinetId)
        ? PT.cabinets.find(function(c){ return c.id===PASS.cabinetId; }) : null;

    // En-tête patient
    var hdr = document.getElementById('passPatientInfo');
    if (hdr && p) {
        hdr.innerHTML = '<strong style="font-size:15px;">'+(p.nom||'').toUpperCase()+' '+(p.prenom||'')+'</strong>'
            + (p.ald ? ' <span style="background:#fef2f2;color:#dc2626;padding:2px 8px;border-radius:8px;font-size:11px;font-weight:600;">ALD 100%</span>' : '')
            + '<br><span style="font-size:12px;color:#64748b;">'
            + (PASS.cabinet ? '🏥 '+PASS.cabinet.nom+' — ' : '')
            + (p.telephone||'')+'</span>';
    }

    // Date + heure par défaut
    var now = new Date();
    var dtEl = document.getElementById('passDate');
    if (dtEl) dtEl.value = now.toISOString().split('T')[0];
    var hEl = document.getElementById('passHeure');
    if (hEl) hEl.value = ('0'+now.getHours()).slice(-2)+':'+('0'+now.getMinutes()).slice(-2);

    // ALD auto
    var aldEl = document.getElementById('passALD');
    if (aldEl) aldEl.checked = p && p.ald;

    passRenduActes();
    passRenduMajorations();
    passCalculer();

    var m = document.getElementById('passModal');
    if (m) m.style.display = 'flex';
};

// ── Actes ─────────────────────────────────────────────────────────────────────
window.passAjouterActe = function(idx) {
    var mod = PASS_ACTES_RAPIDES[idx];
    if (!mod) return;
    PASS.actes.push({code:mod.code, label:mod.label, coeff:mod.coeff, type:mod.type, qte:1});
    passRenduActes();
    passCalculer();
};

window.passSupprimerActe = function(i) {
    PASS.actes.splice(i,1);
    passRenduActes();
    passCalculer();
};

window.passChangerQte = function(i, val) {
    PASS.actes[i].qte = parseInt(val)||1;
    passCalculer();
};

function passRenduActes() {
    var el = document.getElementById('passListeActes');
    if (!el) return;
    if (!PASS.actes.length) {
        el.innerHTML = '<p style="color:#94a3b8;font-size:13px;text-align:center;padding:10px;">Cliquez sur les actes ci-dessus pour les ajouter</p>';
        return;
    }
    el.innerHTML = '<table><thead><tr><th>Code</th><th>Acte</th><th style="width:70px;text-align:center;">Qté</th><th style="text-align:right;width:90px;">Tarif</th><th style="text-align:right;width:90px;">Total</th><th style="width:30px;"></th></tr></thead><tbody>'
        + PASS.actes.map(function(a,i) {
            var t = passTarifActe(a);
            return '<tr>'
                +'<td><code style="background:#e2e8f0;padding:2px 6px;border-radius:4px;font-size:11px;">'+a.code+'</code></td>'
                +'<td style="font-size:12px;">'+a.label+'</td>'
                +'<td style="text-align:center;"><input type="number" min="1" max="10" value="'+a.qte+'" onchange="passChangerQte('+i+',this.value)" style="width:45px;text-align:center;padding:3px;border:1px solid #e2e8f0;border-radius:4px;"></td>'
                +'<td style="text-align:right;color:#2563eb;font-size:12px;">'+t.toFixed(2).replace('.',',')+' €</td>'
                +'<td style="text-align:right;font-weight:600;font-size:12px;">'+(t*a.qte).toFixed(2).replace('.',',')+' €</td>'
                +'<td><button onclick="passSupprimerActe('+i+')" style="background:none;border:none;cursor:pointer;color:#dc2626;font-size:15px;padding:0;">×</button></td>'
                +'</tr>';
        }).join('') + '</tbody></table>';
}

// ── Majorations ───────────────────────────────────────────────────────────────
window.passToggleMajoration = function(type) {
    var idx = PASS.majorations.findIndex(function(m){ return m.type===type; });
    if (idx>=0) PASS.majorations.splice(idx,1);
    else { var m=PASS_MAJORATIONS.find(function(x){ return x.type===type; }); if(m) PASS.majorations.push(m); }
    passRenduMajorations();
    passCalculer();
};

function passRenduMajorations() {
    PASS_MAJORATIONS.forEach(function(m) {
        var btn = document.getElementById('passMaj_'+m.type);
        if (!btn) return;
        var actif = PASS.majorations.some(function(x){ return x.type===m.type; });
        btn.style.background = actif ? '#2563eb' : '#f1f5f9';
        btn.style.color = actif ? 'white' : '#334155';
        btn.style.borderColor = actif ? '#2563eb' : '#cbd5e1';
    });
}

// ── Calcul ────────────────────────────────────────────────────────────────────
window.passCalculer = function() {
    var t = passT();
    var estALD = (document.getElementById('passALD')||{}).checked;
    var totalActes = PASS.actes.reduce(function(s,a){ return s+passTarifActe(a)*(a.qte||1); },0);
    var totalMajo  = PASS.majorations.reduce(function(s,m){ return s+(t[m.type]||0); },0);
    var total = +(totalActes+totalMajo).toFixed(2);
    var partSS = +(total*(estALD?1.0:0.6)).toFixed(2);
    var reste  = +(total-partSS).toFixed(2);
    var fmt = function(n){ return n.toFixed(2).replace('.',',')+' €'; };
    var el = function(id){ return document.getElementById(id); };
    if(el('passTotalActes'))  el('passTotalActes').textContent  = fmt(totalActes);
    if(el('passTotalMajo'))   el('passTotalMajo').textContent   = fmt(totalMajo);
    if(el('passTotalBrut'))   el('passTotalBrut').textContent   = fmt(total);
    if(el('passPartSS'))      el('passPartSS').textContent      = fmt(partSS)+(estALD?' (ALD 100%)'  :' (60%)');
    if(el('passReste'))       el('passReste').textContent       = fmt(reste);
    if(el('passMontantFinal'))el('passMontantFinal').textContent = fmt(total);

    // Bloc rétrocession
    var secR = el('passBlockRetrocession');
    if (secR) {
        if (passEstRemplacant() && PASS.cabinetId) {
            var tR = passGetTauxRetro();
            var mR = +(total*tR).toFixed(2);
            var netR = +(total-mR).toFixed(2);
            secR.style.display = 'block';
            if(el('passTauxRetro'))    el('passTauxRetro').textContent    = (tR*100).toFixed(0)+'%';
            if(el('passMontantRetro')) el('passMontantRetro').textContent = fmt(mR);
            if(el('passNetRemplacant'))el('passNetRemplacant').textContent = fmt(netR);
        } else { secR.style.display='none'; }
    }
};

// ── Enregistrer ───────────────────────────────────────────────────────────────
window.enregistrerPassage = async function() {
    if (!PASS.actes.length) { alert('Ajoutez au moins un acte'); return; }
    var date = (document.getElementById('passDate')||{}).value;
    if (!date) { alert('Date obligatoire'); return; }
    var sc = window.supabaseClient;
    if (!sc) { alert('Non connecté à Supabase'); return; }

    var estALD = (document.getElementById('passALD')||{}).checked;
    var notes  = (document.getElementById('passNotes')||{}).value||'';
    var heure  = (document.getElementById('passHeure')||{}).value||'';
    var t = passT();
    var total   = passCalcTotal();
    var partSS  = +(total*(estALD?1.0:0.6)).toFixed(2);
    var numF    = passNumFacture();
    var p = PASS.patient;
    var nomPt   = p ? (p.nom||'').toUpperCase()+' '+(p.prenom||'') : 'Patient';
    var descActes = PASS.actes.map(function(a){ return a.code+(a.qte>1?' x'+a.qte:''); }).join(', ')
        + (PASS.majorations.length ? ' + '+PASS.majorations.map(function(m){return m.code;}).join('+') : '');

    // 1. Enregistrer le passage
    var rPass = await sc.from('passages').insert([{
        patient_id: PASS.patientId,
        cabinet_id: PASS.cabinetId,
        date_passage: date,
        heure_passage: heure,
        actes: JSON.stringify(PASS.actes),
        majorations: JSON.stringify(PASS.majorations),
        montant_total: total,
        remboursement_ss: partSS,
        type_remboursement: estALD ? 'ald' : 'normal',
        notes: notes,
        facture_numero: numF
    }]);
    if (rPass.error) { alert('Erreur passage : '+rPass.error.message); return; }

    // 2. Transaction recette
    await sc.from('transactions').insert([{
        date: date, type: 'recette',
        category: 'Honoraires / Soins infirmiers',
        description: nomPt+' — '+descActes+(estALD?' [ALD]':''),
        amount: total,
        notes: 'N° '+numF+' | SS: '+partSS.toFixed(2)+'€'+(estALD?' (ALD 100%)':' (60%)')
    }]);

    // 3. Rétrocession si remplaçant
    var msgRetro = '';
    if (passEstRemplacant() && PASS.cabinetId) {
        var tR = passGetTauxRetro();
        var mR = +(total*tR).toFixed(2);
        var nomCab = PASS.cabinet ? (PASS.cabinet.nom_titulaire||PASS.cabinet.nom) : 'Titulaire';
        await sc.from('transactions').insert([{
            date: date, type: 'depense',
            category: 'Rétrocession honoraires',
            description: 'Rétrocession '+(tR*100).toFixed(0)+'% — '+nomCab+' ('+nomPt+')',
            amount: mR,
            notes: 'N° '+numF+' — Automatique'
        }]);
        msgRetro = '\nRétrocession ('+(tR*100).toFixed(0)+'%) : -'+mR.toFixed(2)+' €\nVotre net : '+(total-mR).toFixed(2)+' €';
    }

    document.getElementById('passModal').style.display = 'none';
    alert('✅ Passage enregistré !\n\nN° : '+numF+'\nTotal : '+total.toFixed(2)+' €\nPart SS : '+partSS.toFixed(2)+' €'+msgRetro);

    if (typeof window.chargerTransactions === 'function') window.chargerTransactions();

    // Proposer la feuille de soins
    if (confirm('Voulez-vous générer la feuille de soins PDF ?')) {
        window.genererFdS({
            patient: p, cabinet: PASS.cabinet,
            date: date, heure: heure,
            actes: PASS.actes, majorations: PASS.majorations,
            total: total, partSS: partSS, estALD: estALD, numF: numF
        });
    }
};

window.fermerPassage = function() {
    var m = document.getElementById('passModal');
    if (m) m.style.display='none';
};

// ── HISTORIQUE DES PASSAGES ───────────────────────────────────────────────────
window.chargerHistoriquePassages = async function(patientId, containerId) {
    var sc = window.supabaseClient;
    if (!sc || !patientId) return;
    var el = document.getElementById(containerId||'passHistorique');
    if (!el) return;
    el.innerHTML = '<p style="color:#94a3b8;">Chargement...</p>';

    var r = await sc.from('passages')
        .select('*').eq('patient_id', patientId)
        .order('date_passage', {ascending:false});

    if (r.error || !r.data || !r.data.length) {
        el.innerHTML = '<p style="color:#94a3b8;font-size:13px;">Aucun passage enregistré.</p>';
        return;
    }

    var fmt = function(n){ return parseFloat(n).toFixed(2).replace('.',',')+' €'; };
    el.innerHTML = '<table><thead><tr>'
        +'<th>Date</th><th>Heure</th><th>Actes</th><th style="text-align:right;">Total</th>'
        +'<th style="text-align:right;">Part SS</th><th>Type</th><th>N° Facture</th><th>Actions</th>'
        +'</tr></thead><tbody>'
        + r.data.map(function(p) {
            var actes = [];
            try { actes = JSON.parse(p.actes||'[]'); } catch(e){}
            var descActes = actes.map(function(a){ return a.code; }).join(', ')||'—';
            return '<tr>'
                +'<td>'+p.date_passage+'</td>'
                +'<td>'+(p.heure_passage||'—')+'</td>'
                +'<td style="font-size:12px;">'+descActes+'</td>'
                +'<td style="text-align:right;font-weight:600;color:#2563eb;">'+fmt(p.montant_total)+'</td>'
                +'<td style="text-align:right;color:#16a34a;">'+fmt(p.remboursement_ss)+'</td>'
                +'<td><span style="background:'+(p.type_remboursement==='ald'?'#fef2f2':'#f0fdf4')+';color:'+(p.type_remboursement==='ald'?'#dc2626':'#16a34a')+';padding:2px 8px;border-radius:8px;font-size:11px;">'+(p.type_remboursement==='ald'?'ALD 100%':'Std 60%')+'</span></td>'
                +'<td style="font-size:11px;font-family:monospace;">'+(p.facture_numero||'—')+'</td>'
                +'<td><button onclick="genererFdSPassage(\''+p.id+'\')" style="background:#eff6ff;border:1px solid #bfdbfe;color:#2563eb;padding:3px 8px;border-radius:4px;font-size:11px;cursor:pointer;">📄 PDF</button></td>'
                +'</tr>';
        }).join('')+'</tbody></table>';
};

// ── TABLEAU DE BORD PASSAGES ──────────────────────────────────────────────────
window.chargerDashboardPassages = async function() {
    var sc = window.supabaseClient;
    if (!sc) return;

    var today = new Date().toISOString().split('T')[0];
    var firstDay = today.substring(0,7)+'-01';

    // Passages du jour
    var rJ = await sc.from('passages').select('*, patients(nom,prenom)')
        .eq('date_passage', today).order('heure_passage');
    // Passages du mois
    var rM = await sc.from('passages').select('montant_total')
        .gte('date_passage', firstDay);

    var elJ = document.getElementById('dashPassagesJour');
    var elM = document.getElementById('dashPassagesMois');
    var elCA = document.getElementById('dashCAJour');
    var elCAM = document.getElementById('dashCAMois');

    var passJour = rJ.data||[];
    var passMois = rM.data||[];
    var caJour = passJour.reduce(function(s,p){ return s+(parseFloat(p.montant_total)||0); },0);
    var caMois = passMois.reduce(function(s,p){ return s+(parseFloat(p.montant_total)||0); },0);
    var fmt = function(n){ return n.toLocaleString('fr-FR',{minimumFractionDigits:2})+' €'; };

    if(elJ) elJ.textContent = passJour.length;
    if(elM) elM.textContent = passMois.length;
    if(elCA) elCA.textContent = fmt(caJour);
    if(elCAM) elCAM.textContent = fmt(caMois);

    // Liste du jour
    var elListe = document.getElementById('dashListePassagesJour');
    if (elListe) {
        if (!passJour.length) {
            elListe.innerHTML = '<p style="color:#94a3b8;text-align:center;padding:20px;">Aucun passage aujourd\'hui.</p>';
        } else {
            elListe.innerHTML = '<table><thead><tr><th>Heure</th><th>Patient</th><th style="text-align:right;">Montant</th><th>Type</th></tr></thead><tbody>'
                + passJour.map(function(p) {
                    var nom = p.patients ? (p.patients.nom||'').toUpperCase()+' '+(p.patients.prenom||'') : '—';
                    var fmt2 = function(n){ return parseFloat(n).toFixed(2).replace('.',',')+' €'; };
                    return '<tr><td>'+(p.heure_passage||'—')+'</td><td>'+nom+'</td>'
                        +'<td style="text-align:right;font-weight:600;color:#2563eb;">'+fmt2(p.montant_total)+'</td>'
                        +'<td><span style="font-size:11px;background:'+(p.type_remboursement==='ald'?'#fef2f2':'#f0fdf4')+';color:'+(p.type_remboursement==='ald'?'#dc2626':'#16a34a')+';padding:2px 6px;border-radius:6px;">'+(p.type_remboursement==='ald'?'ALD':'Std')+'</span></td>'
                        +'</tr>';
                }).join('')+'</tbody></table>';
        }
    }
};

// ── EXPORT CPAM ───────────────────────────────────────────────────────────────
window.exporterPassagesCPAM = async function() {
    var sc = window.supabaseClient;
    if (!sc) return;
    var debut = (document.getElementById('cpamDebut')||{}).value;
    var fin   = (document.getElementById('cpamFin')||{}).value;
    if (!debut||!fin) { alert('Sélectionnez une période'); return; }

    var r = await sc.from('passages').select('*, patients(nom,prenom,num_secu,date_naissance)')
        .gte('date_passage',debut).lte('date_passage',fin).order('date_passage');
    if (r.error||!r.data||!r.data.length) { alert('Aucun passage sur cette période'); return; }

    var header = 'Date;Heure;Patient;N°Sécu;DateNaiss;Actes;Montant;PartSS;Type;N°Facture\n';
    var csv = header + r.data.map(function(p) {
        var pt = p.patients||{};
        var actes = [];
        try { actes = JSON.parse(p.actes||'[]'); } catch(e){}
        var descActes = actes.map(function(a){ return a.code+(a.qte>1?'x'+a.qte:''); }).join(' + ');
        return [
            p.date_passage, p.heure_passage||'',
            (pt.nom||'').toUpperCase()+' '+(pt.prenom||''),
            pt.num_secu||'', pt.date_naissance||'',
            descActes,
            parseFloat(p.montant_total||0).toFixed(2),
            parseFloat(p.remboursement_ss||0).toFixed(2),
            p.type_remboursement==='ald'?'ALD 100%':'Standard 60%',
            p.facture_numero||''
        ].join(';');
    }).join('\n');

    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['\uFEFF'+csv], {type:'text/csv;charset=utf-8;'}));
    a.download = 'passages_CPAM_'+debut+'_'+fin+'.csv';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    alert('✅ Export CPAM téléchargé ('+r.data.length+' passages)');
};

// ── FEUILLE DE SOINS PDF ──────────────────────────────────────────────────────
window.genererFdS = async function(opts) {
    if (typeof PDFLib === 'undefined') { alert('pdf-lib non chargé'); return; }
    var { PDFDocument, rgb, StandardFonts } = PDFLib;
    var doc = await PDFDocument.create();
    var page = doc.addPage([595, 842]); // A4
    var fontB = await doc.embedFont(StandardFonts.HelveticaBold);
    var fontN = await doc.embedFont(StandardFonts.Helvetica);

    var profil = {};
    try { profil = JSON.parse(localStorage.getItem('profil_praticien')||'{}'); } catch(e){}

    var p = opts.patient||{};
    var cab = opts.cabinet||{};
    var fmt = function(n){ return parseFloat(n||0).toFixed(2)+' €'; };
    var y = 800; var left = 50;
    var draw = function(text, x, yy, size, bold) {
        page.drawText(String(text||''), {x:x, y:yy, size:size||10,
            font:bold?fontB:fontN, color:rgb(0.1,0.1,0.1)});
    };
    var line = function(y1) {
        page.drawLine({start:{x:left,y:y1},end:{x:545,y:y1},thickness:0.5,color:rgb(0.7,0.7,0.7)});
    };

    // En-tête
    draw('FEUILLE DE SOINS INFIRMIÈRE', left, y, 16, true); y-=25;
    line(y); y-=15;

    // Infirmière
    draw('INFIRMIÈRE LIBÉRALE', left, y, 9, true); y-=13;
    draw((profil.prenom||'')+' '+(profil.nom||''), left, y, 10, true); y-=13;
    draw('ADELI : '+(profil.adeli||'—')+'  |  RPPS : '+(profil.rpps||'—'), left, y, 9); y-=11;
    draw((profil.adresse||'')+' — '+(profil.code_postal||'')+' '+(profil.ville||''), left, y, 9); y-=11;
    draw('Cabinet : '+(cab.nom||'—'), left, y, 9); y-=20;
    line(y); y-=15;

    // Patient
    draw('PATIENT', left, y, 9, true);
    draw('Date : '+opts.date+(opts.heure?' à '+opts.heure:''), 350, y, 9, true); y-=13;
    draw((p.nom||'').toUpperCase()+' '+(p.prenom||''), left, y, 11, true); y-=13;
    draw('Né(e) le : '+(p.date_naissance||'—')+'   |   N° Sécu : '+(p.num_secu||'—'), left, y, 9); y-=11;
    draw('Médecin traitant : '+(p.medecin_traitant||'—'), left, y, 9); y-=20;
    line(y); y-=15;

    // Actes
    draw('ACTES RÉALISÉS', left, y, 10, true); y-=15;
    var t = passT();
    var actes = opts.actes||[];
    var majes = opts.majorations||[];
    actes.forEach(function(a) {
        var tarif = passTarifActe(a);
        draw(a.code, left, y, 9, true);
        draw(a.label, left+60, y, 9);
        draw('x'+a.qte, left+300, y, 9);
        draw(fmt(tarif*a.qte), left+370, y, 9);
        y-=12;
    });
    majes.forEach(function(m) {
        draw(m.code, left, y, 9, true);
        draw(m.label, left+60, y, 9);
        draw(fmt(t[m.type]||0), left+370, y, 9);
        y-=12;
    });
    y-=8; line(y); y-=15;

    // Totaux
    draw('TOTAL ACTES', 300, y, 10, true);
    draw(fmt(opts.total), 450, y, 11, true); y-=15;
    draw('Part Sécurité Sociale '+(opts.estALD?'(ALD 100%)':'(60%)'), 300, y, 9);
    draw(fmt(opts.partSS), 450, y, 10); y-=15;
    draw('Reste à charge patient/mutuelle', 300, y, 9);
    draw(fmt(opts.total-opts.partSS), 450, y, 10); y-=20;

    // N° facture
    draw('N° facture : '+(opts.numF||'—'), left, y, 8);
    draw('Taux : '+(opts.estALD?'100% (ALD)':'60%'), 300, y, 8); y-=30;

    // Signature
    line(y); y-=40;
    draw('Signature infirmière :', left, y, 9);
    draw('Signature patient :', 350, y, 9);

    // Footer
    draw('Document généré par Comptabilité Infirmière — charleytrigano.github.io/compta-infirmier', left, 30, 7);

    var bytes = await doc.save();
    var blob = new Blob([bytes], {type:'application/pdf'});
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'FdS_'+(p.nom||'patient')+'_'+opts.date+'.pdf';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
};

window.genererFdSPassage = async function(passageId) {
    var sc = window.supabaseClient;
    if (!sc) return;
    var r = await sc.from('passages').select('*, patients(*)').eq('id', passageId).single();
    if (r.error||!r.data) { alert('Passage introuvable'); return; }
    var p = r.data;
    var actes=[],majes=[];
    try { actes=JSON.parse(p.actes||'[]'); } catch(e){}
    try { majes=JSON.parse(p.majorations||'[]'); } catch(e){}
    var cab = (window.PT&&PT.cabinets) ? PT.cabinets.find(function(c){ return c.id===p.cabinet_id; }) : null;
    window.genererFdS({
        patient: p.patients, cabinet: cab,
        date: p.date_passage, heure: p.heure_passage,
        actes: actes, majorations: majes,
        total: p.montant_total, partSS: p.remboursement_ss,
        estALD: p.type_remboursement==='ald',
        numF: p.facture_numero
    });
};

// ============================================================================
// RÉCAPITULATIF REMPLAÇANT → TITULAIRE
// Export PDF professionnel par période
// ============================================================================

window.chargerRecapitulatifRemplacant = async function() {
    var sc = window.supabaseClient;
    if (!sc) return;

    var periode = (document.getElementById('recapPeriode')||{}).value || 'mois';
    var cabinetId = (document.getElementById('recapCabinet')||{}).value || '';

    // Calculer les dates selon la période
    var today = new Date();
    var debut, fin;
    fin = today.toISOString().split('T')[0];

    switch(periode) {
        case 'jour':
            debut = fin;
            break;
        case 'semaine':
            var lundi = new Date(today);
            lundi.setDate(today.getDate() - today.getDay() + (today.getDay()===0?-6:1));
            debut = lundi.toISOString().split('T')[0];
            break;
        case 'quinzaine':
            var d15 = new Date(today);
            d15.setDate(today.getDate() - 14);
            debut = d15.toISOString().split('T')[0];
            break;
        case 'mois':
        default:
            debut = today.getFullYear() + '-' + ('0'+(today.getMonth()+1)).slice(-2) + '-01';
            break;
        case 'libre':
            debut = (document.getElementById('recapDebut')||{}).value || fin;
            fin   = (document.getElementById('recapFin')||{}).value   || fin;
            break;
    }

    // Afficher les dates
    var elD = document.getElementById('recapDateDebut'); if(elD) elD.textContent = new Date(debut).toLocaleDateString('fr-FR');
    var elF = document.getElementById('recapDateFin');   if(elF) elF.textContent = new Date(fin).toLocaleDateString('fr-FR');

    // Charger les passages
    var query = sc.from('passages')
        .select('*, patients(nom,prenom,num_secu,date_naissance,ald)')
        .gte('date_passage', debut)
        .lte('date_passage', fin)
        .order('date_passage');

    if (cabinetId) query = query.eq('cabinet_id', cabinetId);

    var r = await query;
    if (r.error) { console.error('Erreur récap:', r.error); return; }

    var passages = r.data || [];

    // Calculer les totaux
    var totalBrut    = passages.reduce(function(s,p){ return s+(parseFloat(p.montant_total)||0); }, 0);
    var totalSS      = passages.reduce(function(s,p){ return s+(parseFloat(p.remboursement_ss)||0); }, 0);
    var cab = (window.PT&&PT.cabinets&&cabinetId) ? PT.cabinets.find(function(c){ return c.id===cabinetId; }) : null;
    var taux = cab ? (cab.taux_retrocession||35) : 35;
    var totalRetro   = +(totalBrut * taux/100).toFixed(2);
    var totalNet     = +(totalBrut - totalRetro).toFixed(2);
    var fmt = function(n){ return parseFloat(n||0).toFixed(2).replace('.',',')+' €'; };

    // KPIs
    var el = function(id,v){ var e=document.getElementById(id); if(e)e.textContent=v; };
    el('recapNbPassages', passages.length);
    el('recapTotalBrut',  fmt(totalBrut));
    el('recapTotalRetro', fmt(totalRetro)+' ('+taux+'%)');
    el('recapTotalNet',   fmt(totalNet));

    // Tableau détaillé
    var tbody = document.getElementById('recapTableau');
    if (!tbody) return;

    if (!passages.length) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#94a3b8;padding:20px;">Aucun passage sur cette période.</td></tr>';
        return;
    }

    tbody.innerHTML = passages.map(function(p,i) {
        var pt = p.patients || {};
        var actes = [];
        try { actes = JSON.parse(p.actes||'[]'); } catch(e){}
        var descActes = actes.map(function(a){ return a.code+(a.qte>1?' x'+a.qte:''); }).join(', ') || '—';
        var brut = parseFloat(p.montant_total)||0;
        var retro = +(brut * taux/100).toFixed(2);
        var net   = +(brut - retro).toFixed(2);
        var ald   = p.type_remboursement === 'ald';
        return '<tr style="background:'+(i%2===0?'#fff':'#f8fafc')+'">'
            +'<td style="font-weight:600;">'+(p.date_passage||'—')+'</td>'
            +'<td>'+(p.heure_passage||'—')+'</td>'
            +'<td><strong>'+(pt.nom||'').toUpperCase()+' '+(pt.prenom||'')+'</strong>'
            +(ald?'<br><span style="font-size:10px;color:#dc2626;font-weight:600;">ALD 100%</span>':'')+'</td>'
            +'<td style="font-size:11px;">'+(pt.num_secu||'—')+'</td>'
            +'<td style="font-size:12px;">'+(descActes)+'</td>'
            +'<td style="text-align:right;font-weight:600;color:#2563eb;">'+fmt(brut)+'</td>'
            +'<td style="text-align:right;color:#dc2626;">-'+fmt(retro)+'</td>'
            +'<td style="text-align:right;font-weight:600;color:#16a34a;">'+fmt(net)+'</td>'
            +'</tr>';
    }).join('');

    // Stocker pour export PDF
    window._recapData = { passages, debut, fin, periode, totalBrut, totalRetro, totalNet, totalSS, taux, cab };
};

// ── EXPORT PDF RÉCAPITULATIF ──────────────────────────────────────────────────
window.exporterRecapPDF = async function() {
    if (typeof PDFLib === 'undefined') { alert('pdf-lib non disponible'); return; }
    var d = window._recapData;
    if (!d || !d.passages) { alert('Chargez d\'abord le récapitulatif'); return; }

    var { PDFDocument, rgb, StandardFonts } = PDFLib;
    var doc = await PDFDocument.create();
    var fontB = await doc.embedFont(StandardFonts.HelveticaBold);
    var fontN = await doc.embedFont(StandardFonts.Helvetica);

    var profil = {};
    try { profil = JSON.parse(localStorage.getItem('profil_praticien')||'{}'); } catch(e){}
    var nomRempl = (profil.prenom||'')+' '+(profil.nom||'');
    var nomTitul = d.cab ? (d.cab.nom_titulaire||d.cab.nom||'—') : '—';
    var nomCab   = d.cab ? d.cab.nom : '—';
    var fmt = function(n){ return parseFloat(n||0).toFixed(2)+' €'; };
    var fmtDate = function(s){ try{ return new Date(s).toLocaleDateString('fr-FR'); }catch(e){return s;} };

    var labels = {jour:'Journée',semaine:'Semaine',quinzaine:'Quinzaine',mois:'Mois',libre:'Période'};
    var periodeLabel = labels[d.periode]||'Période';

    // ── PAGE 1 : RÉCAPITULATIF ────────────────────────────────────────────────
    var page = doc.addPage([595, 842]);
    var y = 800; var L = 40; var R = 555;

    var draw = function(text,x,yy,size,bold,color) {
        var col = color || rgb(0.05,0.05,0.05);
        page.drawText(String(text||''), {x:x,y:yy,size:size||10,font:bold?fontB:fontN,color:col});
    };
    var hline = function(yy,thick,col) {
        page.drawLine({start:{x:L,y:yy},end:{x:R,y:yy},thickness:thick||0.5,color:col||rgb(0.8,0.8,0.8)});
    };
    var rect = function(x,yy,w,h,col) {
        page.drawRectangle({x:x,y:yy,width:w,height:h,color:col});
    };

    // Bandeau header bleu
    rect(0, 790, 595, 55, rgb(0.15,0.39,0.92));
    draw('RÉCAPITULATIF DES INTERVENTIONS', L, 820, 16, true, rgb(1,1,1));
    draw('Infirmière Remplaçante → Titulaire', L, 802, 10, false, rgb(0.8,0.9,1));
    draw(periodeLabel+' du '+fmtDate(d.debut)+' au '+fmtDate(d.fin), L, 793, 9, false, rgb(0.8,0.9,1));

    y = 770;

    // Deux colonnes : Remplaçante | Titulaire
    rect(L, y-75, 240, 80, rgb(0.97,0.98,1));
    rect(315, y-75, 240, 80, rgb(0.97,1,0.98));
    draw('INFIRMIÈRE REMPLAÇANTE', L+8, y-6, 8, true, rgb(0.15,0.39,0.92));
    draw(nomRempl||'—', L+8, y-18, 10, true);
    draw('ADELI : '+(profil.adeli||'—'), L+8, y-30, 8);
    draw('RPPS : '+(profil.rpps||'—'), L+8, y-41, 8);
    draw((profil.adresse||'')+' '+(profil.code_postal||''), L+8, y-52, 8);
    draw('Tél : '+(profil.telephone||'—'), L+8, y-63, 8);

    draw('CABINET / TITULAIRE', 323, y-6, 8, true, rgb(0.06,0.5,0.25));
    draw(nomCab, 323, y-18, 10, true);
    draw('Titulaire : '+nomTitul, 323, y-30, 8);
    draw((d.cab&&d.cab.adresse||''), 323, y-41, 8);
    draw('Taux rétrocession : '+d.taux+'%', 323, y-52, 9, true);
    draw((d.cab&&d.cab.iban?'IBAN : '+d.cab.iban:''), 323, y-63, 8);

    y -= 90;
    hline(y, 1, rgb(0.6,0.6,0.6)); y -= 15;

    // KPIs
    var kpis = [
        {label:'Passages', val:d.passages.length, color:rgb(0.15,0.39,0.92)},
        {label:'Total honoraires bruts', val:fmt(d.totalBrut), color:rgb(0.15,0.39,0.92)},
        {label:'Rétrocession ('+d.taux+'%)', val:fmt(d.totalRetro), color:rgb(0.86,0.15,0.15)},
        {label:'Votre net à percevoir', val:fmt(d.totalNet), color:rgb(0.06,0.5,0.25)},
    ];
    var kx = L;
    kpis.forEach(function(k) {
        rect(kx, y-40, 120, 45, rgb(0.97,0.97,0.97));
        draw(k.label, kx+5, y-10, 7, false, rgb(0.4,0.4,0.4));
        draw(k.val, kx+5, y-28, 11, true, k.color);
        kx += 130;
    });
    y -= 55; hline(y, 1, rgb(0.6,0.6,0.6)); y -= 12;

    // Tableau des passages
    draw('DÉTAIL DES INTERVENTIONS', L, y, 10, true, rgb(0.2,0.2,0.2)); y -= 15;

    // En-têtes colonnes
    var cols = [{l:'Date',x:L,w:55},{l:'Patient',x:L+58,w:95},{l:'Actes',x:L+156,w:140},
                {l:'Brut',x:L+299,w:55},{l:'Rétro.',x:L+357,w:55},{l:'Net',x:L+415,w:55}];
    rect(L, y-12, R-L, 16, rgb(0.15,0.39,0.92));
    cols.forEach(function(c){ draw(c.l, c.x+3, y-10, 8, true, rgb(1,1,1)); });
    y -= 14;

    // Lignes
    d.passages.forEach(function(p, i) {
        if (y < 60) {
            page = doc.addPage([595,842]);
            y = 800;
        }
        var pt = p.patients||{};
        var actes=[]; try{actes=JSON.parse(p.actes||'[]');}catch(e){}
        var descActes = actes.map(function(a){return a.code+(a.qte>1?'x'+a.qte:'');}).join('+') || '—';
        var brut = parseFloat(p.montant_total)||0;
        var retro = +(brut*d.taux/100).toFixed(2);
        var net = +(brut-retro).toFixed(2);
        var bg = i%2===0 ? rgb(1,1,1) : rgb(0.96,0.97,1);
        rect(L, y-11, R-L, 14, bg);
        draw(p.date_passage||'—', L+3, y-9, 7);
        draw((pt.nom||'').toUpperCase().substring(0,10)+' '+(pt.prenom||'').substring(0,8)
            +(p.type_remboursement==='ald'?' ★':''), L+61, y-9, 7, p.type_remboursement==='ald');
        draw(descActes.substring(0,28), L+159, y-9, 7);
        draw(fmt(brut), L+302, y-9, 7, false, rgb(0.15,0.39,0.92));
        draw('-'+fmt(retro), L+360, y-9, 7, false, rgb(0.8,0.15,0.15));
        draw(fmt(net), L+418, y-9, 7, true, rgb(0.06,0.5,0.25));
        y -= 14;
    });

    // ★ ALD légende
    y -= 5; draw('★ Patient ALD (100% Sécurité Sociale)', L, y, 7, false, rgb(0.5,0.5,0.5));

    // Ligne totaux
    y -= 12; hline(y+2, 1, rgb(0.15,0.39,0.92));
    rect(L, y-14, R-L, 17, rgb(0.15,0.39,0.92));
    draw('TOTAUX', L+3, y-11, 9, true, rgb(1,1,1));
    draw(fmt(d.totalBrut), L+302, y-11, 9, true, rgb(1,1,1));
    draw('-'+fmt(d.totalRetro), L+360, y-11, 9, true, rgb(1,0.8,0.8));
    draw(fmt(d.totalNet), L+418, y-11, 9, true, rgb(0.8,1,0.8));
    y -= 28;

    // Bloc de signature
    hline(y, 1); y -= 15;
    draw('RÉCAPITULATIF ÉTABLI PAR', L, y, 8, true); y -= 12;
    draw(nomRempl, L, y, 9); draw('Le : ___/___/______', 350, y, 9); y -= 25;
    draw('Signature remplaçante :', L, y, 8);
    draw('Signature titulaire :', 320, y, 8); y -= 40;
    hline(y+5, 0.5);

    // Pied de page
    draw('Document généré automatiquement — Comptabilité Infirmière', L, 25, 7, false, rgb(0.6,0.6,0.6));
    draw('ADELI : '+(profil.adeli||'—')+'  |  SIRET : '+(profil.siret||'—'), L, 15, 7, false, rgb(0.6,0.6,0.6));

    // Télécharger
    var bytes = await doc.save();
    var blob = new Blob([bytes], {type:'application/pdf'});
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'Recap_Retrocession_'+d.debut+'_'+d.fin+'.pdf';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
};

// ── EXPORT CSV RÉCAPITULATIF ──────────────────────────────────────────────────
window.exporterRecapCSV = function() {
    var d = window._recapData;
    if (!d || !d.passages) { alert('Chargez d\'abord le récapitulatif'); return; }
    var fmt = function(n){ return parseFloat(n||0).toFixed(2); };
    var header = 'Date;Heure;Patient;N°Sécu;ALD;Actes;Montant brut;Rétrocession '+d.taux+'%;Net remplaçante\n';
    var csv = header + d.passages.map(function(p) {
        var pt = p.patients||{};
        var actes=[]; try{actes=JSON.parse(p.actes||'[]');}catch(e){}
        var brut = parseFloat(p.montant_total)||0;
        var retro = +(brut*d.taux/100).toFixed(2);
        return [
            p.date_passage, p.heure_passage||'',
            (pt.nom||'').toUpperCase()+' '+(pt.prenom||''),
            pt.num_secu||'',
            p.type_remboursement==='ald'?'OUI':'NON',
            actes.map(function(a){return a.code+(a.qte>1?'x'+a.qte:'');}).join(' + '),
            fmt(brut), fmt(retro), fmt(brut-retro)
        ].join(';');
    }).join('\n');
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8;'}));
    a.download = 'Recap_Retrocession_'+d.debut+'_'+d.fin+'.csv';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
};
