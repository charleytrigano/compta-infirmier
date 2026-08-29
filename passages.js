// ============================================================================
// passages.js — Facturation des passages infirmiers
// Lien Patient → Actes NGAP → Transaction comptable
// ============================================================================

var PASS = {
    patientId: null,
    cabinetId: null,
    patient: null,
    actes: [],       // actes sélectionnés
    majorations: []  // majorations sélectionnées
};

// Actes NGAP simplifiés pour sélection rapide (reprend NGAP_TARIFS de ngap.js)
var PASS_ACTES_RAPIDES = [
    // Soins courants
    { code:'AMI 1',   label:'Injection SC/IM',                coeff:1,   type:'ami', cat:'soins' },
    { code:'AMI 1,5', label:'Prélèvement sanguin',            coeff:1.5, type:'ami', cat:'soins' },
    { code:'AMI 2',   label:'Injection IV / Pansement simple',coeff:2,   type:'ami', cat:'soins' },
    { code:'AMI 3',   label:'Pansement complexe',             coeff:3,   type:'ami', cat:'soins' },
    { code:'AMI 3',   label:'Sondage vésical F.',             coeff:3,   type:'ami', cat:'soins' },
    { code:'AMI 3,5', label:'Sondage vésical H.',             coeff:3.5, type:'ami', cat:'soins' },
    { code:'AMI 4',   label:'Séance soins (SSI)',             coeff:4,   type:'ami', cat:'soins' },
    { code:'AMI 4',   label:'Pansement très complexe',        coeff:4,   type:'ami', cat:'soins' },
    { code:'AMI 6',   label:'Soins palliatifs',               coeff:6,   type:'ami', cat:'soins' },
    { code:'AMI 8',   label:'Perfusion IV < 1h',              coeff:8,   type:'ami', cat:'soins' },
    { code:'AMI 12',  label:'Perfusion IV > 1h',              coeff:12,  type:'ami', cat:'soins' },
    // Psychiatrie
    { code:'AIS 3',   label:'Soins psychiatriques std',       coeff:3,   type:'ami', cat:'psy' },
    { code:'AIS 5',   label:'Soins psychiatriques lourds',    coeff:5,   type:'ami', cat:'psy' },
    // BSI
    { code:'BSI Init.',label:'BSI Initial',                   coeff:null,type:'bsiInit',  cat:'bsi' },
    { code:'BSI Inter.',label:'BSI Intermédiaire',            coeff:null,type:'bsiInter', cat:'bsi' },
    { code:'BSI Fin', label:'BSI Fin',                        coeff:null,type:'bsiFin',   cat:'bsi' },
];

var PASS_MAJORATIONS = [
    { code:'MAU', label:'Acte Unique (MAU)',      type:'mau' },
    { code:'MIE', label:'Infirmière Exclusive (MIE)', type:'mie' },
    { code:'MDD', label:'Dimanche / Férié (MDD)', type:'mdd' },
    { code:'MN',  label:'Nuit 20h-8h (MN)',       type:'mn'  },
    { code:'MSN', label:'Nuit profonde 0h-6h (MSN)', type:'msn' },
];

function passGetTarifs() {
    var annee = new Date().getFullYear();
    var t = (typeof NGAP_TARIFS !== 'undefined' && NGAP_TARIFS[annee])
        ? NGAP_TARIFS[annee] : { ami:3.15, bsiInit:65.69, bsiInter:32.85, bsiFin:32.85, mau:3.50, mie:3.15, mdd:8.35, mn:9.15, msn:19.50 };
    var saved = localStorage.getItem('ngap_tarifs_' + annee);
    if (saved) { try { return JSON.parse(saved); } catch(e){} }
    return t;
}

function passTarifActe(acte) {
    var t = passGetTarifs();
    if (acte.type === 'ami') return +(acte.coeff * t.ami).toFixed(2);
    return +(t[acte.type] || 0).toFixed(2);
}

function passCalcTotal() {
    var t = passGetTarifs();
    var total = 0;
    PASS.actes.forEach(function(a) { total += passTarifActe(a) * (a.qte || 1); });
    PASS.majorations.forEach(function(m) { total += t[m.type] || 0; });
    return +total.toFixed(2);
}

function passCalcSS(total, estALD) {
    return +(total * (estALD ? 1.0 : 0.6)).toFixed(2);
}

function passGetTauxRetro() {
    // Récupérer le taux réel du cabinet si disponible
    if (typeof window.getTauxRetrocession === 'function' && PASS.cabinetId) {
        return window.getTauxRetrocession(PASS.cabinetId) / 100;
    }
    return 0.35; // 35% par défaut
}

// ── OUVRIR LE MODAL ──────────────────────────────────────────────────────────

window.ouvrirNouveauPassage = function(patientId) {
    PASS.patientId = patientId;
    PASS.actes = [];
    PASS.majorations = [];

    // Récupérer le patient
    var p = (window.PT && PT.patients) ? PT.patients.find(function(x){ return x.id === patientId; }) : null;
    PASS.patient = p;
    PASS.cabinetId = p ? p.cabinet_id : null;

    // Remplir l'en-tête
    var hdr = document.getElementById('passPatientInfo');
    if (hdr && p) {
        var cab = (window.PT && PT.cabinets) ? PT.cabinets.find(function(c){ return c.id === p.cabinet_id; }) : null;
        hdr.innerHTML = '<strong>' + p.nom + ' ' + p.prenom + '</strong>'
            + (p.ald ? ' <span style="background:#fef2f2;color:#dc2626;padding:2px 8px;border-radius:8px;font-size:11px;font-weight:600;">ALD 100%</span>' : '')
            + '<br><span style="font-size:13px;color:#64748b;">'
            + (cab ? '🏥 ' + cab.nom : '') + ' — ' + (p.telephone || '') + '</span>';
    }

    // Date du jour par défaut
    var dtEl = document.getElementById('passDate');
    if (dtEl) dtEl.value = new Date().toISOString().split('T')[0];

    // Cocher ALD auto si patient ALD
    var aldEl = document.getElementById('passALD');
    if (aldEl) aldEl.checked = p && p.ald;

    passRenduActes();
    passRenduMajorations();
    passCalculer();

    document.getElementById('passModal').style.display = 'flex';
};

// ── GESTION DES ACTES ────────────────────────────────────────────────────────

function passAjouterActe(idx) {
    var modele = PASS_ACTES_RAPIDES[idx];
    if (!modele) return;
    PASS.actes.push({ code:modele.code, label:modele.label, coeff:modele.coeff, type:modele.type, qte:1 });
    passRenduActes();
    passCalculer();
}

function passSupprimerActe(i) {
    PASS.actes.splice(i, 1);
    passRenduActes();
    passCalculer();
}

function passChangerQte(i, val) {
    PASS.actes[i].qte = parseInt(val) || 1;
    passCalculer();
}

function passToggleMajoration(type) {
    var idx = PASS.majorations.findIndex(function(m){ return m.type === type; });
    if (idx >= 0) {
        PASS.majorations.splice(idx, 1);
    } else {
        var mod = PASS_MAJORATIONS.find(function(m){ return m.type === type; });
        if (mod) PASS.majorations.push(mod);
    }
    passRenduMajorations();
    passCalculer();
}

function passRenduActes() {
    var el = document.getElementById('passListeActes');
    if (!el) return;
    if (!PASS.actes.length) {
        el.innerHTML = '<p style="color:#94a3b8;font-size:13px;text-align:center;padding:10px;">Aucun acte sélectionné — cliquez sur les boutons ci-dessus</p>';
        return;
    }
    el.innerHTML = '<table><thead><tr><th>Code</th><th>Libellé</th><th style="width:80px;text-align:center;">Qté</th><th style="text-align:right;width:90px;">Tarif</th><th style="text-align:right;width:90px;">Total</th><th style="width:40px;"></th></tr></thead><tbody>'
        + PASS.actes.map(function(a, i) {
            var tarif = passTarifActe(a);
            var total = +(tarif * a.qte).toFixed(2);
            return '<tr>'
                + '<td><code style="background:#e2e8f0;padding:2px 6px;border-radius:4px;font-size:12px;">' + a.code + '</code></td>'
                + '<td style="font-size:13px;">' + a.label + '</td>'
                + '<td style="text-align:center;"><input type="number" min="1" max="10" value="' + a.qte + '" onchange="passChangerQte(' + i + ',this.value)" style="width:50px;text-align:center;padding:4px;border:1px solid #e2e8f0;border-radius:4px;"></td>'
                + '<td style="text-align:right;color:#2563eb;">' + tarif.toFixed(2).replace('.',',') + ' €</td>'
                + '<td style="text-align:right;font-weight:600;">' + total.toFixed(2).replace('.',',') + ' €</td>'
                + '<td><button onclick="passSupprimerActe(' + i + ')" style="background:none;border:none;cursor:pointer;color:#dc2626;font-size:16px;">×</button></td>'
                + '</tr>';
        }).join('')
        + '</tbody></table>';
}

function passRenduMajorations() {
    PASS_MAJORATIONS.forEach(function(m) {
        var btn = document.getElementById('passMaj_' + m.type);
        if (!btn) return;
        var actif = PASS.majorations.some(function(x){ return x.type === m.type; });
        btn.style.background = actif ? '#2563eb' : '#f1f5f9';
        btn.style.color = actif ? 'white' : '#334155';
        btn.style.borderColor = actif ? '#2563eb' : '#cbd5e1';
    });
}

function passCalculer() {
    var t = passGetTarifs();
    var estALD = (document.getElementById('passALD') || {}).checked;
    var totalActes = 0;
    PASS.actes.forEach(function(a){ totalActes += passTarifActe(a) * a.qte; });
    var totalMajo = 0;
    PASS.majorations.forEach(function(m){ totalMajo += t[m.type] || 0; });
    var total = +(totalActes + totalMajo).toFixed(2);
    var partSS = passCalcSS(total, estALD);
    var resteCharge = +(total - partSS).toFixed(2);
    var fmt = function(n){ return n.toFixed(2).replace('.',',') + ' €'; };
    var el = function(id){ return document.getElementById(id); };
    if (el('passTotalActes'))  el('passTotalActes').textContent  = fmt(totalActes);
    if (el('passTotalMajo'))   el('passTotalMajo').textContent   = fmt(totalMajo);
    if (el('passTotalBrut'))   el('passTotalBrut').textContent   = fmt(total);
    if (el('passPartSS'))      el('passPartSS').textContent      = fmt(partSS) + (estALD ? ' (ALD 100%)' : ' (60%)');
    if (el('passReste'))       el('passReste').textContent       = fmt(resteCharge);
    if (el('passMontantFinal'))el('passMontantFinal').textContent = fmt(total);

    // Afficher la section rétrocession si remplaçant
    var estRemplacant = (typeof window.getStatutFacturation === 'function')
        ? window.getStatutFacturation() === 'remplacant'
        : false;
    var secRetro = el('passBlockRetrocession');
    if (secRetro) {
        if (estRemplacant) {
            var tauxRetro = passGetTauxRetro();
            var montantRetro = +(total * tauxRetro).toFixed(2);
            var netRemplacant = +(total - montantRetro).toFixed(2);
            secRetro.style.display = 'block';
            if (el('passTauxRetro'))    el('passTauxRetro').textContent    = (tauxRetro * 100).toFixed(0) + '%';
            if (el('passMontantRetro')) el('passMontantRetro').textContent = fmt(montantRetro);
            if (el('passNetRemplacant'))el('passNetRemplacant').textContent = fmt(netRemplacant);
        } else {
            secRetro.style.display = 'none';
        }
    }
}

// ── ENREGISTRER ──────────────────────────────────────────────────────────────

window.enregistrerPassage = async function() {
    if (!PASS.actes.length) { alert('Ajoutez au moins un acte'); return; }
    var date = (document.getElementById('passDate')||{}).value;
    if (!date) { alert('Date obligatoire'); return; }
    var estALD = (document.getElementById('passALD')||{}).checked;
    var notes = (document.getElementById('passNotes')||{}).value || '';
    var t = passGetTarifs();
    var total = passCalcTotal();
    var partSS = passCalcSS(total, estALD);
    var sc = window.supabaseClient;
    if (!sc) { alert('Non connecté à Supabase'); return; }

    // 1. Créer le passage
    var passage = {
        patient_id: PASS.patientId,
        cabinet_id: PASS.cabinetId,
        date_passage: date,
        actes: JSON.stringify(PASS.actes),
        majorations: JSON.stringify(PASS.majorations),
        montant_total: total,
        remboursement_ss: partSS,
        type_remboursement: estALD ? 'ald' : 'normal',
        notes: notes
    };
    var r1 = await sc.from('passages').insert([passage]);
    if (r1.error) { alert('Erreur passage : ' + r1.error.message); return; }

    // 2. Créer la transaction comptable (recette)
    var p = PASS.patient;
    var nomPatient = p ? p.nom + ' ' + p.prenom : 'Patient';
    var descActes = PASS.actes.map(function(a){ return a.code; }).join(', ');
    if (PASS.majorations.length) descActes += ' + ' + PASS.majorations.map(function(m){ return m.code; }).join('+');

    var transaction = {
        date: date,
        type: 'recette',
        category: 'Honoraires / Soins infirmiers',
        description: nomPatient + ' — ' + descActes + (estALD ? ' [ALD]' : ''),
        amount: total,
        payment_method: 'Virement SS',
        notes: 'SS: ' + partSS.toFixed(2) + '€' + (estALD ? ' (ALD 100%)' : ' (60%)')
    };
    var r2 = await sc.from('transactions').insert([transaction]);
    if (r2.error) { alert('Passage enregistré mais erreur transaction : ' + r2.error.message); }

    // Si remplaçant → créer automatiquement la dépense rétrocession
    var estRemplacant = (typeof window.getStatutFacturation === 'function')
        ? window.getStatutFacturation() === 'remplacant' : false;
    if (estRemplacant && PASS.cabinetId) {
        var tauxRetro = passGetTauxRetro();
        var montantRetro = +(total * tauxRetro).toFixed(2);
        var cab = (window.PT && PT.cabinets)
            ? PT.cabinets.find(function(c){ return c.id === PASS.cabinetId; }) : null;
        var nomCab = cab ? (cab.nom_titulaire || cab.nom) : 'Titulaire';
        var depRetro = {
            date: date,
            type: 'depense',
            category: 'Rétrocession honoraires',
            description: 'Rétrocession ' + (tauxRetro*100).toFixed(0) + '% — ' + nomCab + ' (passage ' + nomPatient + ')',
            amount: montantRetro,
            payment_method: 'Virement',
            notes: 'Rétrocession automatique passage du ' + date
        };
        var r3 = await sc.from('transactions').insert([depRetro]);
        if (!r3.error) {
            alert('✅ Passage enregistré !

Recette : ' + total.toFixed(2) + ' €
Rétrocession (' + (tauxRetro*100).toFixed(0) + '%) : -' + montantRetro.toFixed(2) + ' €
Net remplaçant : ' + (total - montantRetro).toFixed(2) + ' €
Part SS encaissée : ' + partSS.toFixed(2) + ' €');
            if (typeof window.chargerTransactions === 'function') window.chargerTransactions();
            return;
        }
    }

    // 3. Fermer et rafraîchir
    document.getElementById('passModal').style.display = 'none';
    alert('✅ Passage enregistré !\nMontant total : ' + total.toFixed(2) + ' €\nPart SS : ' + partSS.toFixed(2) + ' €');

    // Recharger les transactions si la fonction existe
    if (typeof window.chargerTransactions === 'function') window.chargerTransactions();
};

window.fermerPassage = function() {
    document.getElementById('passModal').style.display = 'none';
};
