// ============================================================================
// passages.js — Facturation, historique, récapitulatif, PDF via print
// ============================================================================

var PASS = {
    patientId:null, cabinetId:null,
    patient:null, cabinet:null,
    actes:[], majorations:[]
};

var PASS_ACTES = [
    {code:'AMI 1',    label:'Injection SC/IM',           coeff:1,    type:'ami'},
    {code:'AMI 1,5',  label:'Prélèvement sanguin',       coeff:1.5,  type:'ami'},
    {code:'AMI 2',    label:'Injection IV',               coeff:2,    type:'ami'},
    {code:'AMI 2',    label:'Pansement simple',           coeff:2,    type:'ami'},
    {code:'AMI 2',    label:'Soins stomie',               coeff:2,    type:'ami'},
    {code:'AMI 3',    label:'Pansement complexe',         coeff:3,    type:'ami'},
    {code:'AMI 3',    label:'Sondage vésical F.',         coeff:3,    type:'ami'},
    {code:'AMI 3,5',  label:'Sondage vésical H.',         coeff:3.5,  type:'ami'},
    {code:'AMI 4',    label:'SSI / Soins complets',       coeff:4,    type:'ami'},
    {code:'AMI 4',    label:'Pansement très complexe',    coeff:4,    type:'ami'},
    {code:'AMI 6',    label:'Soins palliatifs',           coeff:6,    type:'ami'},
    {code:'AMI 8',    label:'Perfusion IV < 1h',          coeff:8,    type:'ami'},
    {code:'AMI 12',   label:'Perfusion IV > 1h',          coeff:12,   type:'ami'},
    {code:'AIS 3',    label:'Psy standard',               coeff:3,    type:'ami'},
    {code:'AIS 5',    label:'Psy lourd',                  coeff:5,    type:'ami'},
    {code:'BSI Init.',label:'BSI Initial',                coeff:null, type:'bsiInit'},
    {code:'BSI Inter.',label:'BSI Intermédiaire',         coeff:null, type:'bsiInter'},
    {code:'BSI Fin',  label:'BSI Fin',                    coeff:null, type:'bsiFin'},
];

var PASS_MAJO = [
    {code:'MAU',label:'Acte Unique',    type:'mau'},
    {code:'MIE',label:'IDE Exclusive',  type:'mie'},
    {code:'MDD',label:'Dim./Férié',     type:'mdd'},
    {code:'MN', label:'Nuit 20h-8h',   type:'mn'},
    {code:'MSN',label:'Nuit 0h-6h',    type:'msn'},
];

// -- Tarifs --------------------------------------------------------------------
window.passT = function() {
    var annee = new Date().getFullYear();
    var saved = localStorage.getItem('ngap_tarifs_'+annee);
    if (saved) { try{ return JSON.parse(saved); }catch(e){} }
    return {ami:3.15,bsiInit:65.69,bsiInter:32.85,bsiFin:32.85,
            mau:3.50,mie:3.15,mdd:8.35,mn:9.15,msn:19.50};
};

function pTarif(acte) {
    var t = window.passT();
    return acte.type==='ami' ? +(acte.coeff*t.ami).toFixed(2) : +(t[acte.type]||0).toFixed(2);
}

function pTotal() {
    var t = window.passT();
    return +(PASS.actes.reduce(function(s,a){return s+pTarif(a)*(a.qte||1);},0)
           + PASS.majorations.reduce(function(s,m){return s+(t[m.type]||0);},0)).toFixed(2);
}

function pRetroTaux() {
    if (typeof window.getTauxRetrocession==='function' && PASS.cabinetId)
        return window.getTauxRetrocession(PASS.cabinetId)/100;
    return 0.35;
}

function pEstRempl() {
    return typeof window.getStatutFacturation==='function'
        && window.getStatutFacturation()==='remplacant';
}

function pFmt(n) { return parseFloat(n||0).toFixed(2).replace('.',',')+' \u20ac'; }
function pEl(id) { return document.getElementById(id); }

function pNumF() {
    var d=new Date();
    return 'F'+d.getFullYear()+('0'+(d.getMonth()+1)).slice(-2)+('0'+d.getDate()).slice(-2)+'-'+Math.floor(Math.random()*9000+1000);
}

// -- OUVRIR MODAL PASSAGE ------------------------------------------------------
window.ouvrirNouveauPassage = function(patientId) {
    PASS.patientId = patientId;
    PASS.actes = []; PASS.majorations = [];
    var p = (window.PT&&PT.patients) ? PT.patients.find(function(x){return x.id===patientId;}) : null;
    PASS.patient = p;
    PASS.cabinetId = p ? p.cabinet_id : null;
    PASS.cabinet = (window.PT&&PT.cabinets&&PASS.cabinetId)
        ? PT.cabinets.find(function(c){return c.id===PASS.cabinetId;}) : null;

    var hdr = pEl('passPatientInfo');
    if (hdr && p) hdr.innerHTML = '<strong>'+(p.nom||'').toUpperCase()+' '+(p.prenom||'')+'</strong>'
        +(p.ald?' <span style="background:#fef2f2;color:#dc2626;padding:2px 8px;border-radius:8px;font-size:11px;font-weight:600;">ALD 100%</span>':'')
        +'<br><span style="font-size:12px;color:#64748b;">'+(PASS.cabinet?'🏥 '+PASS.cabinet.nom+' — ':'')+(p.telephone||'')+'</span>';

    var now = new Date();
    var d=pEl('passDate'); if(d) d.value=now.toISOString().split('T')[0];
    var h=pEl('passHeure'); if(h) h.value=('0'+now.getHours()).slice(-2)+':'+('0'+now.getMinutes()).slice(-2);
    var a=pEl('passALD'); if(a) a.checked=p&&p.ald;

    pRenduActes(); pRenduMajo(); passCalculer();
    var m=pEl('passModal'); if(m) m.style.display='flex';
};

// -- ACTES / MAJORATIONS -------------------------------------------------------
window.passAjouterActe = function(idx) {
    var mod = PASS_ACTES[idx]; if(!mod) return;
    PASS.actes.push({code:mod.code,label:mod.label,coeff:mod.coeff,type:mod.type,qte:1});
    pRenduActes(); passCalculer();
};
window.passSupprimerActe = function(i) { PASS.actes.splice(i,1); pRenduActes(); passCalculer(); };
window.passChangerQte = function(i,v) { PASS.actes[i].qte=parseInt(v)||1; passCalculer(); };
window.passToggleMajoration = function(type) {
    var idx = PASS.majorations.findIndex(function(m){return m.type===type;});
    if(idx>=0) PASS.majorations.splice(idx,1);
    else { var m=PASS_MAJO.find(function(x){return x.type===type;}); if(m) PASS.majorations.push(m); }
    pRenduMajo(); passCalculer();
};

function pRenduActes() {
    var el=pEl('passListeActes'); if(!el) return;
    if(!PASS.actes.length){el.innerHTML='<p style="color:#94a3b8;font-size:13px;text-align:center;padding:10px;">Cliquez sur les actes ci-dessus</p>';return;}
    el.innerHTML='<table><thead><tr><th>Code</th><th>Acte</th><th style="width:60px;text-align:center;">Qté</th><th style="text-align:right;width:80px;">Tarif</th><th style="text-align:right;width:80px;">Total</th><th style="width:25px;"></th></tr></thead><tbody>'
        +PASS.actes.map(function(a,i){
            var t=pTarif(a);
            return '<tr><td><code style="background:#e2e8f0;padding:2px 5px;border-radius:3px;font-size:11px;">'+a.code+'</code></td>'
                +'<td style="font-size:12px;">'+a.label+'</td>'
                +'<td style="text-align:center;"><input type="number" min="1" max="10" value="'+a.qte+'" onchange="passChangerQte('+i+',this.value)" style="width:42px;text-align:center;padding:2px;border:1px solid #e2e8f0;border-radius:3px;"></td>'
                +'<td style="text-align:right;color:#2563eb;font-size:12px;">'+pFmt(t)+'</td>'
                +'<td style="text-align:right;font-weight:600;font-size:12px;">'+pFmt(t*(a.qte||1))+'</td>'
                +'<td><button onclick="passSupprimerActe('+i+')" style="background:none;border:none;cursor:pointer;color:#dc2626;font-size:14px;padding:0;">×</button></td></tr>';
        }).join('')+'</tbody></table>';
}

function pRenduMajo() {
    PASS_MAJO.forEach(function(m){
        var btn=pEl('passMaj_'+m.type); if(!btn) return;
        var actif=PASS.majorations.some(function(x){return x.type===m.type;});
        btn.style.background=actif?'#2563eb':'#f1f5f9';
        btn.style.color=actif?'white':'#334155';
        btn.style.borderColor=actif?'#2563eb':'#cbd5e1';
    });
}

// -- CALCUL --------------------------------------------------------------------
window.passCalculer = function() {
    var t=window.passT();
    var ald=(pEl('passALD')||{}).checked;
    var actesT=PASS.actes.reduce(function(s,a){return s+pTarif(a)*(a.qte||1);},0);
    var majoT =PASS.majorations.reduce(function(s,m){return s+(t[m.type]||0);},0);
    var total =+(actesT+majoT).toFixed(2);
    var partSS=+(total*(ald?1.0:0.6)).toFixed(2);
    var reste =+(total-partSS).toFixed(2);
    var el=function(id,v){var e=pEl(id);if(e)e.textContent=v;};
    el('passTotalActes',pFmt(actesT));el('passTotalMajo',pFmt(majoT));
    el('passTotalBrut',pFmt(total));el('passPartSS',pFmt(partSS)+(ald?' (ALD 100%)':' (60%)'));
    el('passReste',pFmt(reste));el('passMontantFinal',pFmt(total));
    var secR=pEl('passBlockRetrocession');
    if(secR){
        if(pEstRempl()&&PASS.cabinetId){
            var tR=pRetroTaux();var mR=+(total*tR).toFixed(2);
            secR.style.display='block';
            el('passTauxRetro',(tR*100).toFixed(0)+'%');
            el('passMontantRetro',pFmt(mR));
            el('passNetRemplacant',pFmt(total-mR));
        }else secR.style.display='none';
    }
};

// -- ENREGISTRER ---------------------------------------------------------------
window.enregistrerPassage = async function() {
    if(!PASS.actes.length){alert('Ajoutez au moins un acte');return;}
    var date=(pEl('passDate')||{}).value; if(!date){alert('Date obligatoire');return;}
    var sc=window.supabaseClient; if(!sc){alert('Non connecté à Supabase');return;}
    var ald=(pEl('passALD')||{}).checked;
    var notes=(pEl('passNotes')||{}).value||'';
    var heure=(pEl('passHeure')||{}).value||'';
    var t=window.passT();
    var total=pTotal();
    var partSS=+(total*(ald?1.0:0.6)).toFixed(2);
    var numF=pNumF();
    var p=PASS.patient;
    var nomPt=p?(p.nom||'').toUpperCase()+' '+(p.prenom||''):'Patient';
    var descActes=PASS.actes.map(function(a){return a.code+(a.qte>1?' x'+a.qte:'');}).join(', ')
        +(PASS.majorations.length?' + '+PASS.majorations.map(function(m){return m.code;}).join('+'):'');

    var rPass=await sc.from('passages').insert([{
        patient_id:PASS.patientId, cabinet_id:PASS.cabinetId,
        date_passage:date, heure_passage:heure,
        actes:JSON.stringify(PASS.actes),
        majorations:JSON.stringify(PASS.majorations),
        montant_total:total, remboursement_ss:partSS,
        type_remboursement:ald?'ald':'normal',
        notes:notes, facture_numero:numF,
        transmis:false
    }]);
    if(rPass.error){alert('Erreur passage : '+rPass.error.message);return;}

    await sc.from('transactions').insert([{
        date:date,type:'recette',
        category:'Honoraires / Soins infirmiers',
        description:nomPt+' — '+descActes+(ald?' [ALD]':''),
        amount:total,
        notes:'N° '+numF+' | SS: '+partSS.toFixed(2)+'€'+(ald?' (ALD 100%)':' (60%)')
    }]);

    var msgRetro='';
    if(pEstRempl()&&PASS.cabinetId){
        var tR=pRetroTaux();var mR=+(total*tR).toFixed(2);
        var nomCab=PASS.cabinet?(PASS.cabinet.nom_titulaire||PASS.cabinet.nom):'Titulaire';
        await sc.from('transactions').insert([{
            date:date,type:'depense',
            category:'Rétrocession honoraires',
            description:'Rétrocession '+(tR*100).toFixed(0)+'% — '+nomCab+' ('+nomPt+')',
            amount:mR,notes:'N° '+numF+' — Automatique'
        }]);
        msgRetro='\nRétrocession ('+(tR*100).toFixed(0)+'%) : -'+mR.toFixed(2)+' €\nNet : '+(total-mR).toFixed(2)+' €';
    }

    pEl('passModal').style.display='none';
    alert('Passage enregistré !\nN° '+numF+'\nTotal : '+total.toFixed(2)+' €\nSS : '+partSS.toFixed(2)+' €'+msgRetro);
    if(typeof window.chargerTransactions==='function') window.chargerTransactions();

    if(confirm('Générer la feuille de soins PDF ?')){
        genererFdSPrint({patient:p,cabinet:PASS.cabinet,date:date,heure:heure,
            actes:PASS.actes,majorations:PASS.majorations,
            total:total,partSS:partSS,estALD:ald,numF:numF,
            notes:notes});
    }
};

window.fermerPassage=function(){var m=pEl('passModal');if(m)m.style.display='none';};

// -- HISTORIQUE DES PASSAGES ---------------------------------------------------
window.chargerHistoriquePassages = async function(patientId, containerId) {
    var sc=window.supabaseClient; if(!sc||!patientId) return;
    var el=pEl(containerId||'passHistorique'); if(!el) return;
    el.innerHTML='<p style="color:#94a3b8;font-size:13px;">Chargement...</p>';

    var r=await sc.from('passages').select('*')
        .eq('patient_id',patientId).order('date_passage',{ascending:false});

    if(r.error||!r.data||!r.data.length){
        el.innerHTML='<p style="color:#94a3b8;font-size:13px;text-align:center;padding:20px;">Aucun passage enregistré.</p>';
        return;
    }

    el.innerHTML='<table><thead><tr>'
        +'<th>Date</th><th>Heure</th><th>Actes</th>'
        +'<th style="text-align:right;">Total</th><th style="text-align:right;">Part SS</th>'
        +'<th>Type</th><th style="text-align:center;">Transmis</th><th>Actions</th>'
        +'</tr></thead><tbody>'
        +r.data.map(function(p){
            var actes=[]; try{actes=JSON.parse(p.actes||'[]');}catch(e){}
            var descA=actes.map(function(a){return a.code+(a.qte>1?' x'+a.qte:'');}).join(', ')||'—';
            var transmis=p.transmis;
            var badgeT=transmis
                ?'<span style="background:#dcfce7;color:#166534;padding:2px 8px;border-radius:8px;font-size:11px;font-weight:600;">✅ Transmis<br><small style="font-weight:400;">'+(p.date_transmission||'')+('</small></span>')
                :'<span style="background:#fef3c7;color:#92400e;padding:2px 8px;border-radius:8px;font-size:11px;font-weight:600;">⏳ En attente</span>';
            return '<tr>'
                +'<td style="font-weight:600;">'+p.date_passage+'</td>'
                +'<td>'+(p.heure_passage||'—')+'</td>'
                +'<td style="font-size:12px;">'+descA+'</td>'
                +'<td style="text-align:right;color:#2563eb;font-weight:600;">'+pFmt(p.montant_total)+'</td>'
                +'<td style="text-align:right;color:#16a34a;">'+pFmt(p.remboursement_ss)+'</td>'
                +'<td><span style="font-size:11px;background:'+(p.type_remboursement==='ald'?'#fef2f2':'#f0fdf4')+';color:'+(p.type_remboursement==='ald'?'#dc2626':'#16a34a')+';padding:2px 6px;border-radius:6px;">'+(p.type_remboursement==='ald'?'ALD':'Std')+'</span></td>'
                +'<td style="text-align:center;">'+badgeT+'</td>'
                +'<td style="display:flex;gap:4px;flex-wrap:wrap;">'
                +'<button onclick="genererFdSPassage(\''+p.id+'\')" style="background:#eff6ff;border:1px solid #bfdbfe;color:#2563eb;padding:3px 7px;border-radius:4px;font-size:11px;cursor:pointer;white-space:nowrap;">📄 PDF</button>'
                +(!transmis?'<button onclick="marquerTransmis(\''+p.id+'\',\''+patientId+'\',\''+containerId+'\')" style="background:#f0fdf4;border:1px solid #bbf7d0;color:#16a34a;padding:3px 7px;border-radius:4px;font-size:11px;cursor:pointer;white-space:nowrap;">✅ Transmis</button>':'')
                +'</td></tr>';
        }).join('')+'</tbody></table>';
};

window.marquerTransmis = async function(passageId, patientId, containerId) {
    var sc=window.supabaseClient; if(!sc) return;
    var today=new Date().toISOString().split('T')[0];
    var r=await sc.from('passages').update({
        transmis:true, date_transmission:today
    }).eq('id',passageId);
    if(r.error){alert('Erreur : '+r.error.message);return;}
    window.chargerHistoriquePassages(patientId, containerId);
};

// -- TABLEAU DE BORD PASSAGES --------------------------------------------------
window.chargerDashboardPassages = async function() {
    var sc=window.supabaseClient; if(!sc) return;
    var today=new Date().toISOString().split('T')[0];
    var firstDay=today.substring(0,7)+'-01';
    var rJ=await sc.from('passages').select('*, patients(nom,prenom)')
        .eq('date_passage',today).order('heure_passage');
    var rM=await sc.from('passages').select('montant_total').gte('date_passage',firstDay);
    var rNT=await sc.from('passages').select('id').eq('transmis',false);

    var pJ=rJ.data||[];var pM=rM.data||[];
    var caJ=pJ.reduce(function(s,p){return s+(parseFloat(p.montant_total)||0);},0);
    var caM=pM.reduce(function(s,p){return s+(parseFloat(p.montant_total)||0);},0);
    var fmt=function(n){return n.toLocaleString('fr-FR',{minimumFractionDigits:2})+' \u20ac';};
    var el=function(id,v){var e=pEl(id);if(e)e.textContent=v;};
    el('dashPassagesJour',pJ.length);el('dashPassagesMois',pM.length);
    el('dashCAJour',fmt(caJ));el('dashCAMois',fmt(caM));
    el('dashNonTransmis',(rNT.data||[]).length);

    var elL=pEl('dashListePassagesJour');
    if(!elL) return;
    if(!pJ.length){elL.innerHTML='<p style="color:#94a3b8;text-align:center;padding:20px;">Aucun passage aujourd\'hui.</p>';return;}
    elL.innerHTML='<table><thead><tr><th>Heure</th><th>Patient</th><th style="text-align:right;">Montant</th><th>Type</th><th>Transmis</th></tr></thead><tbody>'
        +pJ.map(function(p){
            var pt=p.patients||{};
            return '<tr><td>'+(p.heure_passage||'—')+'</td>'
                +'<td><strong>'+(pt.nom||'').toUpperCase()+' '+(pt.prenom||'')+'</strong></td>'
                +'<td style="text-align:right;font-weight:600;color:#2563eb;">'+pFmt(p.montant_total)+'</td>'
                +'<td><span style="font-size:11px;background:'+(p.type_remboursement==='ald'?'#fef2f2':'#f0fdf4')+';color:'+(p.type_remboursement==='ald'?'#dc2626':'#16a34a')+';padding:2px 6px;border-radius:6px;">'+(p.type_remboursement==='ald'?'ALD':'Std')+'</span></td>'
                +'<td>'+(p.transmis?'<span style="color:#16a34a;">✅</span>':'<span style="color:#f59e0b;">⏳</span>')+'</td></tr>';
        }).join('')+'</tbody></table>';
};

// -- RÉCAPITULATIF REMPLAÇANT --------------------------------------------------
window.chargerRecapitulatifRemplacant = async function() {
    var sc=window.supabaseClient; if(!sc) return;
    var periode=(pEl('recapPeriode')||{}).value||'mois';
    var cabId=(pEl('recapCabinet')||{}).value||'';
    var today=new Date();
    var debut,fin=today.toISOString().split('T')[0];

    if(periode==='jour')      debut=fin;
    else if(periode==='semaine'){ var l=new Date(today); l.setDate(today.getDate()-today.getDay()+(today.getDay()===0?-6:1)); debut=l.toISOString().split('T')[0]; }
    else if(periode==='quinzaine'){ var q=new Date(today); q.setDate(today.getDate()-14); debut=q.toISOString().split('T')[0]; }
    else if(periode==='libre'){ debut=(pEl('recapDebut')||{}).value||fin; fin=(pEl('recapFin')||{}).value||fin; }
    else debut=today.getFullYear()+'-'+('0'+(today.getMonth()+1)).slice(-2)+'-01';

    var fmtD=function(s){try{return new Date(s).toLocaleDateString('fr-FR');}catch(e){return s;}};
    var d1=pEl('recapDateDebut'); if(d1) d1.textContent=fmtD(debut);
    var d2=pEl('recapDateFin');   if(d2) d2.textContent=fmtD(fin);

    var q=sc.from('passages').select('*, patients(nom,prenom,num_secu)')
        .gte('date_passage',debut).lte('date_passage',fin).order('date_passage');
    if(cabId) q=q.eq('cabinet_id',cabId);
    var r=await q;
    var passages=r.data||[];

    var cab=(window.PT&&PT.cabinets&&cabId)?PT.cabinets.find(function(c){return c.id===cabId;}):null;
    var taux=cab?(cab.taux_retrocession||35):35;
    var totalBrut=passages.reduce(function(s,p){return s+(parseFloat(p.montant_total)||0);},0);
    var totalRetro=+(totalBrut*taux/100).toFixed(2);
    var totalNet=+(totalBrut-totalRetro).toFixed(2);
    var nonTransmis=passages.filter(function(p){return !p.transmis;}).length;

    // Détail par code NGAP
    var detailCodes = {};
    passages.forEach(function(p) {
        var actes=[]; try{actes=JSON.parse(p.actes||'[]');}catch(e){}
        var majes=[]; try{majes=JSON.parse(p.majorations||'[]');}catch(e){}
        actes.forEach(function(a) {
            var k = a.code;
            if (!detailCodes[k]) detailCodes[k] = {code:k, nb:0, qte:0, total:0, type:'acte'};
            detailCodes[k].nb++;
            detailCodes[k].qte += (a.qte||1);
            detailCodes[k].total += pTarif(a)*(a.qte||1);
        });
        majes.forEach(function(m) {
            var t=window.passT();
            if (!detailCodes[m.code]) detailCodes[m.code] = {code:m.code, nb:0, qte:0, total:0, type:'majo'};
            detailCodes[m.code].nb++;
            detailCodes[m.code].qte++;
            detailCodes[m.code].total += (t[m.type]||0);
        });
    });

    // Afficher le détail par code
    var elDetail = pEl('recapDetailCodes');
    if (elDetail) {
        var codes = Object.values(detailCodes).sort(function(a,b){return b.total-a.total;});
        if (!codes.length) {
            elDetail.innerHTML = '<p style="color:#94a3b8;font-size:13px;">Aucun acte.</p>';
        } else {
            var totalActesSeuls = codes.filter(function(c){return c.type==='acte';}).reduce(function(s,c){return s+c.total;},0);
            elDetail.innerHTML = '<table><thead><tr>'
                +'<th>Code NGAP</th><th style="text-align:center;">Nb passages</th>'
                +'<th style="text-align:center;">Qté totale</th>'
                +'<th style="text-align:right;">Total brut</th>'
                +'<th style="text-align:right;">Rétrocession ('+taux+'%)</th>'
                +'<th style="text-align:right;">Votre net</th>'
                +'<th style="text-align:right;">% du CA</th>'
                +'</tr></thead><tbody>'
                +codes.map(function(c) {
                    var retro = +(c.total*taux/100).toFixed(2);
                    var net   = +(c.total-retro).toFixed(2);
                    var pct   = totalBrut>0 ? (c.total/totalBrut*100).toFixed(1) : '0';
                    var isMajo = c.type==='majo';
                    return '<tr style="background:'+(isMajo?'#f8fafc':'#fff')+'">'
                        +'<td><code style="background:#e2e8f0;padding:2px 8px;border-radius:4px;font-weight:bold;font-size:12px;">'+c.code+'</code>'
                        +(isMajo?' <span style="font-size:10px;color:#64748b;">(majoration)</span>':'')+'</td>'
                        +'<td style="text-align:center;">'+c.nb+'</td>'
                        +'<td style="text-align:center;font-weight:600;">'+c.qte+'</td>'
                        +'<td style="text-align:right;font-weight:600;color:#2563eb;">'+pFmt(c.total)+'</td>'
                        +'<td style="text-align:right;color:#dc2626;">'+pFmt(retro)+'</td>'
                        +'<td style="text-align:right;font-weight:700;color:#16a34a;">'+pFmt(net)+'</td>'
                        +'<td style="text-align:right;">'
                        +'<div style="display:flex;align-items:center;gap:6px;justify-content:flex-end;">'
                        +'<div style="width:60px;height:6px;background:#e2e8f0;border-radius:3px;overflow:hidden;">'
                        +'<div style="width:'+pct+'%;height:100%;background:'+(isMajo?'#f59e0b':'#2563eb')+';border-radius:3px;"></div></div>'
                        +pct+' %</div></td>'
                        +'</tr>';
                }).join('')
                +'<tr style="background:#1e293b;color:white;font-weight:700;">'
                +'<td colspan="3" style="padding:8px 12px;">TOTAL</td>'
                +'<td style="text-align:right;padding:8px 12px;">'+pFmt(totalBrut)+'</td>'
                +'<td style="text-align:right;padding:8px 12px;">'+pFmt(totalRetro)+'</td>'
                +'<td style="text-align:right;padding:8px 12px;">'+pFmt(totalNet)+'</td>'
                +'<td style="text-align:right;padding:8px 12px;">100 %</td>'
                +'</tr>'
                +'</tbody></table>';
        }
    }

    var el=function(id,v){var e=pEl(id);if(e)e.textContent=v;};
    el('recapNbPassages',passages.length);
    el('recapTotalBrut',pFmt(totalBrut));
    el('recapTotalRetro',pFmt(totalRetro)+' ('+taux+'%)');
    el('recapTotalNet',pFmt(totalNet));
    el('recapNonTransmis',nonTransmis);

    var tbody=pEl('recapTableau'); if(!tbody) return;
    if(!passages.length){tbody.innerHTML='<tr><td colspan="9" style="text-align:center;color:#94a3b8;padding:20px;">Aucun passage sur cette période.</td></tr>';return;}

    tbody.innerHTML=passages.map(function(p,i){
        var pt=p.patients||{};
        var actes=[]; try{actes=JSON.parse(p.actes||'[]');}catch(e){}
        var descA=actes.map(function(a){return a.code+(a.qte>1?' x'+a.qte:'');}).join(', ')||'—';
        var brut=parseFloat(p.montant_total)||0;
        var retro=+(brut*taux/100).toFixed(2);
        var transmis=p.transmis;
        return '<tr style="background:'+(i%2===0?'#fff':'#f8fafc')+'">'
            +'<td style="font-weight:600;">'+p.date_passage+'</td>'
            +'<td>'+(p.heure_passage||'—')+'</td>'
            +'<td><strong>'+(pt.nom||'').toUpperCase()+' '+(pt.prenom||'')+'</strong>'
            +(p.type_remboursement==='ald'?'<span style="color:#dc2626;font-size:10px;font-weight:600;"> ★ALD</span>':'')+'</td>'
            +'<td style="font-size:11px;">'+(pt.num_secu||'—')+'</td>'
            +'<td style="font-size:12px;">'+descA+'</td>'
            +'<td style="text-align:right;font-weight:600;color:#2563eb;">'+pFmt(brut)+'</td>'
            +'<td style="text-align:right;color:#dc2626;">'+pFmt(retro)+'</td>'
            +'<td style="text-align:right;font-weight:600;color:#16a34a;">'+pFmt(brut-retro)+'</td>'
            +'<td style="text-align:center;">'
            +(transmis?'<span style="color:#16a34a;font-size:11px;">✅<br><small>'+(p.date_transmission||'')+'</small></span>'
                :'<button onclick="marquerTransmisRecap(\''+p.id+'\')" style="background:#f0fdf4;border:1px solid #bbf7d0;color:#16a34a;padding:2px 6px;border-radius:4px;font-size:10px;cursor:pointer;">Marquer transmis</button>')
            +'</td></tr>';
    }).join('');

    window._recapData={passages,debut,fin,periode,totalBrut,totalRetro,totalNet,taux,cab,nonTransmis};
};

window.marquerTransmisRecap = async function(passageId) {
    var sc=window.supabaseClient; if(!sc) return;
    var today=new Date().toISOString().split('T')[0];
    await sc.from('passages').update({transmis:true,date_transmission:today}).eq('id',passageId);
    window.chargerRecapitulatifRemplacant();
};

window.toggleRecapLibre=function(){
    var val=(pEl('recapPeriode')||{}).value;
    var bl=pEl('recapLibreBlock');
    if(bl) bl.style.display=val==='libre'?'flex':'none';
};

// -- EXPORT CPAM ---------------------------------------------------------------
window.exporterPassagesCPAM = async function() {
    var sc=window.supabaseClient; if(!sc) return;
    var debut=(pEl('cpamDebut')||{}).value;
    var fin=(pEl('cpamFin')||{}).value;
    if(!debut||!fin){alert('Sélectionnez une période');return;}
    var r=await sc.from('passages').select('*, patients(nom,prenom,num_secu,date_naissance)')
        .gte('date_passage',debut).lte('date_passage',fin).order('date_passage');
    if(r.error||!r.data||!r.data.length){alert('Aucun passage sur cette période');return;}
    var header='Date;Heure;Patient;N\u00b0S\u00e9cu;DateNaiss;Actes;Montant;PartSS;Type;N\u00b0Facture;Transmis\n';
    var csv=header+r.data.map(function(p){
        var pt=p.patients||{};
        var actes=[]; try{actes=JSON.parse(p.actes||'[]');}catch(e){}
        return [p.date_passage,p.heure_passage||'',
            (pt.nom||'').toUpperCase()+' '+(pt.prenom||''),
            pt.num_secu||'',pt.date_naissance||'',
            actes.map(function(a){return a.code+(a.qte>1?'x'+a.qte:'');}).join(' + '),
            parseFloat(p.montant_total||0).toFixed(2),
            parseFloat(p.remboursement_ss||0).toFixed(2),
            p.type_remboursement==='ald'?'ALD 100%':'Standard 60%',
            p.facture_numero||'',
            p.transmis?'OUI':'NON'
        ].join(';');
    }).join('\n');
    var a=document.createElement('a');
    a.href=URL.createObjectURL(new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8;'}));
    a.download='passages_CPAM_'+debut+'_'+fin+'.csv';
    document.body.appendChild(a);a.click();document.body.removeChild(a);
    alert('Export CPAM : '+r.data.length+' passages téléchargés');
};

// -- PDF VIA IMPRESSION NAVIGATEUR (100% fiable) -------------------------------
function genererFdSPrint(opts) {
    var profil={};
    try{profil=JSON.parse(localStorage.getItem('profil_praticien')||'{}');}catch(e){}
    var p=opts.patient||{};
    var cab=opts.cabinet||{};
    var t=window.passT();
    var fmtE=function(n){return parseFloat(n||0).toFixed(2)+' \u20ac';};
    var lignesActes=opts.actes.map(function(a){
        var tarif=a.type==='ami'?+(a.coeff*t.ami).toFixed(2):+(t[a.type]||0).toFixed(2);
        return '<tr><td style="padding:5px 8px;border:1px solid #ddd;">'+a.code+'</td>'
            +'<td style="padding:5px 8px;border:1px solid #ddd;">'+a.label+'</td>'
            +'<td style="padding:5px 8px;border:1px solid #ddd;text-align:center;">'+a.qte+'</td>'
            +'<td style="padding:5px 8px;border:1px solid #ddd;text-align:right;">'+fmtE(tarif)+'</td>'
            +'<td style="padding:5px 8px;border:1px solid #ddd;text-align:right;font-weight:bold;">'+fmtE(tarif*(a.qte||1))+'</td></tr>';
    }).join('');
    var lignesMajo=opts.majorations.map(function(m){
        return '<tr style="background:#fafafa;"><td style="padding:5px 8px;border:1px solid #ddd;">'+m.code+'</td>'
            +'<td style="padding:5px 8px;border:1px solid #ddd;">'+m.label+'</td>'
            +'<td style="padding:5px 8px;border:1px solid #ddd;text-align:center;">—</td>'
            +'<td style="padding:5px 8px;border:1px solid #ddd;text-align:right;">'+fmtE(t[m.type]||0)+'</td>'
            +'<td style="padding:5px 8px;border:1px solid #ddd;text-align:right;font-weight:bold;">'+fmtE(t[m.type]||0)+'</td></tr>';
    }).join('');

    var html='<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8">'
        +'<title>Feuille de Soins — '+((p.nom||'')+(p.prenom||''))+'</title>'
        +'<style>body{font-family:Arial,sans-serif;font-size:12px;margin:0;padding:20px;color:#1a1a1a;}'
        +'h1{font-size:16px;margin:0;}h2{font-size:13px;margin:8px 0 4px;color:#1d4ed8;border-bottom:2px solid #1d4ed8;padding-bottom:3px;}'
        +'.row{display:flex;gap:20px;margin-bottom:15px;}'
        +'.box{flex:1;padding:12px;border:1px solid #ddd;border-radius:6px;background:#f9fafb;}'
        +'.box p{margin:3px 0;}table{width:100%;border-collapse:collapse;}'
        +'.total-row{background:#1d4ed8;color:white;font-weight:bold;}'
        +'.sign{display:flex;gap:20px;margin-top:20px;}'
        +'.sign-box{flex:1;border-top:1px solid #333;padding-top:8px;min-height:60px;font-size:11px;color:#555;}'
        +'@media print{button{display:none!important;}@page{size:A4;margin:15mm;}}'
        +'</style></head><body>'
        +'<div style="background:#1d4ed8;color:white;padding:15px 20px;border-radius:8px;margin-bottom:15px;">'
        +'<h1>FEUILLE DE SOINS INFIRMIERE</h1>'
        +'<p style="margin:4px 0 0;font-size:11px;opacity:0.9;">Date : '+opts.date+(opts.heure?' — Heure : '+opts.heure:'')+'  |  N° '+opts.numF+'</p></div>'
        +'<div class="row">'
        +'<div class="box"><h2>👩‍⚕️ Infirmière libérale</h2>'
        +'<p><strong>'+(profil.prenom||'')+' '+(profil.nom||'')+'</strong></p>'
        +'<p>ADELI : '+(profil.adeli||'—')+'</p><p>RPPS : '+(profil.rpps||'—')+'</p>'
        +'<p>'+(profil.adresse||'')+' '+(profil.code_postal||'')+' '+(profil.ville||'')+'</p>'
        +'<p>Tél : '+(profil.telephone||'—')+'</p>'
        +'<p>Cabinet : '+(cab.nom||'—')+'</p></div>'
        +'<div class="box"><h2>👤 Patient</h2>'
        +'<p><strong>'+(p.nom||'').toUpperCase()+' '+(p.prenom||'')+'</strong>'
        +(opts.estALD?' <span style="background:#fef2f2;color:#dc2626;padding:1px 6px;border-radius:4px;font-size:10px;">ALD 100%</span>':'')+'</p>'
        +'<p>Né(e) le : '+(p.date_naissance||'—')+'</p>'
        +'<p>N° Sécu : '+(p.num_secu||'—')+'</p>'
        +'<p>Médecin : '+(p.medecin_traitant||'—')+'</p>'
        +'<p>Mutuelle : '+(p.mutuelle||'—')+(p.num_mutuelle?' n°'+p.num_mutuelle:'')+'</p></div>'
        +'</div>'
        +'<h2>Actes réalisés</h2>'
        +'<table><thead><tr style="background:#e2e8f0;">'
        +'<th style="padding:6px 8px;border:1px solid #ddd;text-align:left;">Code</th>'
        +'<th style="padding:6px 8px;border:1px solid #ddd;text-align:left;">Description</th>'
        +'<th style="padding:6px 8px;border:1px solid #ddd;text-align:center;">Qté</th>'
        +'<th style="padding:6px 8px;border:1px solid #ddd;text-align:right;">Tarif unit.</th>'
        +'<th style="padding:6px 8px;border:1px solid #ddd;text-align:right;">Total</th>'
        +'</tr></thead><tbody>'+lignesActes+lignesMajo+'</tbody>'
        +'<tfoot><tr class="total-row">'
        +'<td colspan="4" style="padding:7px 8px;border:1px solid #1d4ed8;">TOTAL</td>'
        +'<td style="padding:7px 8px;border:1px solid #1d4ed8;text-align:right;">'+fmtE(opts.total)+'</td></tr>'
        +'<tr style="background:#dcfce7;"><td colspan="4" style="padding:5px 8px;border:1px solid #ddd;">'
        +'Part Sécurité Sociale '+(opts.estALD?'(ALD — 100%)':'(60%)')+'</td>'
        +'<td style="padding:5px 8px;border:1px solid #ddd;text-align:right;font-weight:bold;color:#15803d;">'+fmtE(opts.partSS)+'</td></tr>'
        +'<tr style="background:#fef3c7;"><td colspan="4" style="padding:5px 8px;border:1px solid #ddd;">'
        +'Reste à charge patient / mutuelle</td>'
        +'<td style="padding:5px 8px;border:1px solid #ddd;text-align:right;font-weight:bold;color:#92400e;">'+fmtE(opts.total-opts.partSS)+'</td></tr>'
        +'</tfoot></table>'
        +'<div class="sign">'
        +'<div class="sign-box">Signature infirmière :<br><br><br></div>'
        +'<div class="sign-box">Signature patient :<br><br><br></div>'
        +'<div class="sign-box" style="font-size:10px;color:#888;">Généré le '+new Date().toLocaleDateString('fr-FR')+'<br>N° facture : '+opts.numF+'</div>'
        +'</div>'
        +(opts.notes?'<div style="margin-top:15px;padding:12px;background:#fffbeb;border:1px solid #fde68a;border-radius:6px;">'
        +'<strong style="font-size:12px;">📝 Notes / Observations :</strong>'
        +'<p style="margin:5px 0 0;font-size:12px;">'+opts.notes+'</p></div>':'')
        +'<div style="text-align:center;margin-top:15px;">'
        +'<button onclick="window.print()" style="background:#1d4ed8;color:white;border:none;padding:10px 30px;border-radius:6px;font-size:14px;font-weight:bold;cursor:pointer;">🖨️ Imprimer / Enregistrer en PDF</button></div>'
        +'</body></html>';

    var win=window.open('','_blank','width=800,height=900');
    win.document.write(html);
    win.document.close();
}

window.genererFdSPrint=genererFdSPrint;

window.genererFdSPassage = async function(passageId) {
    var sc=window.supabaseClient; if(!sc) return;
    var r=await sc.from('passages').select('*, patients(*)').eq('id',passageId).single();
    if(r.error||!r.data){alert('Passage introuvable');return;}
    var p=r.data;
    var actes=[],majes=[];
    try{actes=JSON.parse(p.actes||'[]');}catch(e){}
    try{majes=JSON.parse(p.majorations||'[]');}catch(e){}
    var cab=(window.PT&&PT.cabinets)?PT.cabinets.find(function(c){return c.id===p.cabinet_id;}):null;
    genererFdSPrint({patient:p.patients,cabinet:cab,
        date:p.date_passage,heure:p.heure_passage,
        actes:actes,majorations:majes,
        total:p.montant_total,partSS:p.remboursement_ss,
        estALD:p.type_remboursement==='ald',numF:p.facture_numero,
        notes:p.notes});
};

// -- PDF RÉCAPITULATIF RÉTROCESSION --------------------------------------------
window.exporterRecapPDF = function() {
    var d=window._recapData;
    if(!d||!d.passages){alert('Chargez d\'abord le récapitulatif');return;}
    var profil={};
    try{profil=JSON.parse(localStorage.getItem('profil_praticien')||'{}');}catch(e){}
    var nomR=(profil.prenom||'')+' '+(profil.nom||'');
    var nomT=d.cab?(d.cab.nom_titulaire||d.cab.nom||'—'):'—';
    var nomCab=d.cab?d.cab.nom:'—';
    var fmtE=function(n){return parseFloat(n||0).toFixed(2)+' \u20ac';};
    var fmtD=function(s){try{return new Date(s).toLocaleDateString('fr-FR');}catch(e){return s;}};
    var labels={jour:'Journée',semaine:'Semaine',quinzaine:'Quinzaine',mois:'Mois',libre:'Période'};

    // Tableau synthèse par code pour le PDF
    var detailPDF = {};
    d.passages.forEach(function(p) {
        var actes=[]; try{actes=JSON.parse(p.actes||'[]');}catch(e){}
        var majes=[]; try{majes=JSON.parse(p.majorations||'[]');}catch(e){}
        actes.forEach(function(a){ var k=a.code;
            if(!detailPDF[k]) detailPDF[k]={code:k,nb:0,qte:0,total:0};
            detailPDF[k].nb++; detailPDF[k].qte+=(a.qte||1); detailPDF[k].total+=parseFloat(a.tarif||(a.coeff*3.15)||0)*(a.qte||1);
        });
        majes.forEach(function(m){ var k=m.code;
            if(!detailPDF[k]) detailPDF[k]={code:k,nb:0,qte:0,total:0};
            detailPDF[k].nb++; detailPDF[k].qte++; detailPDF[k].total+=(window.passT()[m.type]||0);
        });
    });
    var lignesSynthese=Object.values(detailPDF).sort(function(a,b){return b.total-a.total;}).map(function(c,i){
        var retro=+(c.total*d.taux/100).toFixed(2);
        return '<tr style="background:'+(i%2===0?'#fff':'#f8fafc')+'">'
            +'<td style="padding:4px 7px;border:1px solid #e2e8f0;font-weight:bold;font-size:10px;">'+c.code+'</td>'
            +'<td style="padding:4px 7px;border:1px solid #e2e8f0;text-align:center;">'+c.nb+'</td>'
            +'<td style="padding:4px 7px;border:1px solid #e2e8f0;text-align:center;font-weight:600;">'+c.qte+'</td>'
            +'<td style="padding:4px 7px;border:1px solid #e2e8f0;text-align:right;color:#1d4ed8;font-weight:600;">'+fmtE(c.total)+'</td>'
            +'<td style="padding:4px 7px;border:1px solid #e2e8f0;text-align:right;color:#dc2626;">'+fmtE(retro)+'</td>'
            +'<td style="padding:4px 7px;border:1px solid #e2e8f0;text-align:right;color:#15803d;font-weight:700;">'+fmtE(c.total-retro)+'</td>'
            +'</tr>';
    }).join('');
    var tableSynthese='<h3 style="font-size:12px;margin:15px 0 6px;color:#1d4ed8;border-bottom:2px solid #1d4ed8;padding-bottom:3px;">SYNTHÈSE PAR CODE NGAP</h3>'
        +'<table style="width:100%;border-collapse:collapse;font-size:10px;margin-bottom:15px;"><thead>'
        +'<tr style="background:#1d4ed8;color:white;">'
        +'<th style="padding:5px 7px;text-align:left;">Code</th>'
        +'<th style="padding:5px 7px;text-align:center;">Passages</th>'
        +'<th style="padding:5px 7px;text-align:center;">Quantité</th>'
        +'<th style="padding:5px 7px;text-align:right;">Total brut</th>'
        +'<th style="padding:5px 7px;text-align:right;">Rétro. '+d.taux+'%</th>'
        +'<th style="padding:5px 7px;text-align:right;">Net</th></tr></thead>'
        +'<tbody>'+lignesSynthese+'</tbody>'
        +'<tfoot><tr style="background:#1e293b;color:white;font-weight:bold;">'
        +'<td colspan="3" style="padding:5px 7px;border:1px solid #ddd;">TOTAL</td>'
        +'<td style="padding:5px 7px;border:1px solid #ddd;text-align:right;">'+fmtE(d.totalBrut)+'</td>'
        +'<td style="padding:5px 7px;border:1px solid #ddd;text-align:right;">'+fmtE(d.totalRetro)+'</td>'
        +'<td style="padding:5px 7px;border:1px solid #ddd;text-align:right;">'+fmtE(d.totalNet)+'</td>'
        +'</tr></tfoot></table>';

    var lignes=d.passages.map(function(p,i){
        var pt=p.patients||{};
        var actes=[]; try{actes=JSON.parse(p.actes||'[]');}catch(e){}
        var desc=actes.map(function(a){return a.code+(a.qte>1?' x'+a.qte:'');}).join(', ')||'—';
        var brut=parseFloat(p.montant_total)||0;
        var retro=+(brut*d.taux/100).toFixed(2);
        var bg=i%2===0?'#ffffff':'#f8fafc';
        return '<tr style="background:'+bg+';">'
            +'<td style="padding:5px 7px;border:1px solid #e2e8f0;font-weight:600;">'+p.date_passage+'</td>'
            +'<td style="padding:5px 7px;border:1px solid #e2e8f0;">'+(p.heure_passage||'—')+'</td>'
            +'<td style="padding:5px 7px;border:1px solid #e2e8f0;font-weight:600;">'+(pt.nom||'').toUpperCase()+' '+(pt.prenom||'')
            +(p.type_remboursement==='ald'?' <span style="color:#dc2626;font-size:10px;font-weight:700;">★ALD</span>':'')+'</td>'
            +'<td style="padding:5px 7px;border:1px solid #e2e8f0;font-size:11px;">'+(pt.num_secu||'—')+'</td>'
            +'<td style="padding:5px 7px;border:1px solid #e2e8f0;font-size:11px;">'+desc+'</td>'
            +'<td style="padding:5px 7px;border:1px solid #e2e8f0;text-align:right;font-weight:600;color:#1d4ed8;">'+fmtE(brut)+'</td>'
            +'<td style="padding:5px 7px;border:1px solid #e2e8f0;text-align:right;color:#dc2626;">'+fmtE(retro)+'</td>'
            +'<td style="padding:5px 7px;border:1px solid #e2e8f0;text-align:right;font-weight:700;color:#15803d;">'+fmtE(brut-retro)+'</td>'
            +'<td style="padding:5px 7px;border:1px solid #e2e8f0;text-align:center;">'+(p.transmis?'<span style="color:#15803d;font-weight:bold;">✅</span>':'<span style="color:#f59e0b;">⏳</span>')+'</td>'
            +'</tr>';
    }).join('');

    var html='<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8">'
        +'<title>Récapitulatif Rétrocession</title>'
        +'<style>body{font-family:Arial,sans-serif;font-size:11px;margin:0;padding:15px;color:#1a1a1a;}'
        +'h1{font-size:15px;margin:0;}h2{font-size:11px;margin:6px 0 3px;color:#1d4ed8;}'
        +'.row{display:flex;gap:15px;margin-bottom:12px;}'
        +'.box{flex:1;padding:10px;border:1px solid #ddd;border-radius:5px;background:#f9fafb;}'
        +'.kpis{display:flex;gap:10px;margin-bottom:12px;}'
        +'.kpi{flex:1;padding:10px;border-radius:6px;text-align:center;}'
        +'table{width:100%;border-collapse:collapse;font-size:10px;}'
        +'.sign{display:flex;gap:20px;margin-top:20px;}'
        +'.sign-box{flex:1;border-top:2px solid #333;padding-top:8px;min-height:50px;}'
        +'@media print{button{display:none!important;}@page{size:A4 landscape;margin:10mm;}}</style>'
        +'</head><body>'
        +'<div style="background:#1d4ed8;color:white;padding:12px 15px;border-radius:6px;margin-bottom:12px;">'
        +'<h1>RÉCAPITULATIF DES INTERVENTIONS — '+(labels[d.periode]||'Période').toUpperCase()+'</h1>'
        +'<p style="margin:3px 0 0;font-size:10px;opacity:0.9;">Du '+fmtD(d.debut)+' au '+fmtD(d.fin)+'  |  Établi le '+new Date().toLocaleDateString('fr-FR')+'</p></div>'
        +'<div class="row">'
        +'<div class="box"><h2>INFIRMIÈRE REMPLAÇANTE</h2>'
        +'<p><strong>'+nomR+'</strong></p>'
        +'<p>ADELI : '+(profil.adeli||'—')+'  |  RPPS : '+(profil.rpps||'—')+'</p>'
        +'<p>'+(profil.adresse||'')+' '+(profil.code_postal||'')+' '+(profil.ville||'')+'</p>'
        +'<p>Tél : '+(profil.telephone||'—')+'  |  SIRET : '+(profil.siret||'—')+'</p></div>'
        +'<div class="box" style="border-color:#16a34a;">'
        +'<h2 style="color:#15803d;">CABINET / TITULAIRE</h2>'
        +'<p><strong>'+nomCab+'</strong></p>'
        +'<p>Titulaire : '+nomT+'</p>'
        +(d.cab&&d.cab.adresse?'<p>'+d.cab.adresse+' '+(d.cab.code_postal||'')+' '+(d.cab.ville||'')+'</p>':'')
        +'<p style="background:#fef3c7;padding:4px 8px;border-radius:4px;font-weight:bold;">Taux rétrocession : '+d.taux+' %</p>'
        +(d.cab&&d.cab.iban?'<p>IBAN : '+d.cab.iban+'</p>':'')+'</div></div>'
        +'<div class="kpis">'
        +'<div class="kpi" style="background:#eff6ff;"><div style="color:#64748b;font-size:9px;">PASSAGES</div><div style="font-size:18px;font-weight:bold;color:#1d4ed8;">'+d.passages.length+'</div></div>'
        +'<div class="kpi" style="background:#eff6ff;"><div style="color:#64748b;font-size:9px;">HONORAIRES BRUTS</div><div style="font-size:16px;font-weight:bold;color:#1d4ed8;">'+fmtE(d.totalBrut)+'</div></div>'
        +'<div class="kpi" style="background:#fef2f2;"><div style="color:#64748b;font-size:9px;">RÉTROCESSION ('+d.taux+'%)</div><div style="font-size:16px;font-weight:bold;color:#dc2626;">'+fmtE(d.totalRetro)+'</div></div>'
        +'<div class="kpi" style="background:#f0fdf4;"><div style="color:#64748b;font-size:9px;">NET REMPLAÇANTE</div><div style="font-size:16px;font-weight:bold;color:#15803d;">'+fmtE(d.totalNet)+'</div></div>'
        +(d.nonTransmis>0?'<div class="kpi" style="background:#fffbeb;"><div style="color:#64748b;font-size:9px;">NON TRANSMIS</div><div style="font-size:16px;font-weight:bold;color:#f59e0b;">'+d.nonTransmis+'</div></div>':'')
        +'</div>'
        +tableSynthese
        +'<h3 style="font-size:12px;margin:0 0 6px;color:#1d4ed8;border-bottom:2px solid #1d4ed8;padding-bottom:3px;">DÉTAIL DES PASSAGES</h3>'
        +'<table><thead><tr style="background:#1d4ed8;color:white;">'
        +'<th style="padding:6px 7px;text-align:left;">Date</th><th style="padding:6px 7px;text-align:left;">Heure</th>'
        +'<th style="padding:6px 7px;text-align:left;">Patient</th><th style="padding:6px 7px;text-align:left;">N° Sécu</th>'
        +'<th style="padding:6px 7px;text-align:left;">Actes</th>'
        +'<th style="padding:6px 7px;text-align:right;">Brut</th><th style="padding:6px 7px;text-align:right;">Rétro.</th>'
        +'<th style="padding:6px 7px;text-align:right;">Net</th><th style="padding:6px 7px;text-align:center;">Transmis</th>'
        +'</tr></thead><tbody>'+lignes+'</tbody>'
        +'<tfoot><tr style="background:#1d4ed8;color:white;font-weight:bold;">'
        +'<td colspan="5" style="padding:6px 7px;border:1px solid #ddd;">TOTAUX</td>'
        +'<td style="padding:6px 7px;border:1px solid #ddd;text-align:right;">'+fmtE(d.totalBrut)+'</td>'
        +'<td style="padding:6px 7px;border:1px solid #ddd;text-align:right;">'+fmtE(d.totalRetro)+'</td>'
        +'<td style="padding:6px 7px;border:1px solid #ddd;text-align:right;">'+fmtE(d.totalNet)+'</td>'
        +'<td style="padding:6px 7px;border:1px solid #ddd;text-align:center;">'+(d.passages.length-d.nonTransmis)+'/'+d.passages.length+'</td>'
        +'</tr></tfoot></table>'
        +'<div class="sign" style="margin-top:25px;">'
        +'<div class="sign-box"><strong>Signature remplaçante :</strong><br><br>'+nomR+'<br><br></div>'
        +'<div class="sign-box"><strong>Signature titulaire pour accord :</strong><br><br>'+nomT+'<br><br></div>'
        +'</div>'
        +'<div style="text-align:center;margin-top:15px;">'
        +'<button onclick="window.print()" style="background:#1d4ed8;color:white;border:none;padding:10px 30px;border-radius:6px;font-size:13px;font-weight:bold;cursor:pointer;">🖨️ Imprimer / Enregistrer en PDF</button></div>'
        +'</body></html>';

    var win=window.open('','_blank','width=1100,height=850');
    win.document.write(html);
    win.document.close();
};

window.exporterRecapCSV = function() {
    var d=window._recapData;
    if(!d||!d.passages){alert('Chargez d\'abord le récapitulatif');return;}
    var fmtE=function(n){return parseFloat(n||0).toFixed(2);};

    // ── Section 1 : Synthèse par code NGAP ───────────────────────────────────
    var detailCSV = {};
    d.passages.forEach(function(p) {
        var actes=[]; try{actes=JSON.parse(p.actes||'[]');}catch(e){}
        var majes=[]; try{majes=JSON.parse(p.majorations||'[]');}catch(e){}
        actes.forEach(function(a) {
            var k=a.code;
            if(!detailCSV[k]) detailCSV[k]={code:k,nb:0,qte:0,total:0};
            detailCSV[k].nb++; detailCSV[k].qte+=(a.qte||1);
            detailCSV[k].total+=pTarif(a)*(a.qte||1);
        });
        majes.forEach(function(m) {
            var t=window.passT();
            if(!detailCSV[m.code]) detailCSV[m.code]={code:m.code,nb:0,qte:0,total:0};
            detailCSV[m.code].nb++; detailCSV[m.code].qte++;
            detailCSV[m.code].total+=(t[m.type]||0);
        });
    });

    var synthese = 'SYNTHESE PAR CODE NGAP\n'
        +'Periode;Du '+d.debut+';Au '+d.fin+'\n'
        +'Cabinet;'+(d.cab?d.cab.nom:'Tous')+'\n'
        +'Taux retrocession;'+d.taux+'%\n\n'
        +'Code NGAP;Nb passages;Quantite totale;Total brut;Retrocession '+d.taux+'%;Votre net\n'
        +Object.values(detailCSV).sort(function(a,b){return b.total-a.total;}).map(function(c){
            var retro=+(c.total*d.taux/100).toFixed(2);
            return [c.code, c.nb, c.qte,
                fmtE(c.total), fmtE(retro), fmtE(c.total-retro)].join(';');
        }).join('\n')
        +'\n'
        +'TOTAL;;'+fmtE(d.passages.reduce(function(s,p){return s+(parseFloat(p.montant_total)||0);},0))
        +';'+fmtE(d.totalRetro)+';'+fmtE(d.totalNet)+'\n';

    // ── Section 2 : Détail des passages ──────────────────────────────────────
    var detail = '\nDETAIL DES PASSAGES\n'
        +'Date;Heure;Patient;N°Secu;ALD;Actes;Majorations;Brut;Retrocession '+d.taux+'%;Net;Transmis;Date transmission\n'
        +d.passages.map(function(p){
            var pt=p.patients||{};
            var actes=[]; try{actes=JSON.parse(p.actes||'[]');}catch(e){}
            var majes=[]; try{majes=JSON.parse(p.majorations||'[]');}catch(e){}
            var brut=parseFloat(p.montant_total)||0;
            return [
                p.date_passage, p.heure_passage||'',
                (pt.nom||'').toUpperCase()+' '+(pt.prenom||''),
                pt.num_secu||'',
                p.type_remboursement==='ald'?'OUI':'NON',
                actes.map(function(a){return a.code+(a.qte>1?'x'+a.qte:'');}).join(' + '),
                majes.map(function(m){return m.code;}).join(' + '),
                fmtE(brut), fmtE(brut*d.taux/100), fmtE(brut-brut*d.taux/100),
                p.transmis?'OUI':'NON', p.date_transmission||''
            ].join(';');
        }).join('\n');

    var csv = synthese + detail;
    var a=document.createElement('a');
    a.href=URL.createObjectURL(new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8;'}));
    a.download='Recap_Retrocession_'+d.debut+'_'+d.fin+'.csv';
    document.body.appendChild(a);a.click();document.body.removeChild(a);
};
