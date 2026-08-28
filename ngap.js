// ============================================================================
// ngap.js — Nomenclature NGAP Infirmières Libérales — Multi-années
// ============================================================================

var NGAP_TARIFS = {
    2020: { ami:3.15, bsiInit:null,  bsiInter:null,  bsiFin:null,  dep:8.45,
            mau:3.15, mie:3.15, mdd:7.50, mn:8.50,  msn:18.00, ikPlaine:0.35, ikMontagne:0.50 },
    2021: { ami:3.15, bsiInit:null,  bsiInter:null,  bsiFin:null,  dep:8.45,
            mau:3.15, mie:3.15, mdd:7.50, mn:8.50,  msn:18.00, ikPlaine:0.35, ikMontagne:0.50 },
    2022: { ami:3.15, bsiInit:null,  bsiInter:null,  bsiFin:null,  dep:8.45,
            mau:3.50, mie:3.15, mdd:8.00, mn:9.15,  msn:19.00, ikPlaine:0.35, ikMontagne:0.50 },
    2023: { ami:3.15, bsiInit:65.69, bsiInter:32.85, bsiFin:32.85, dep:null,
            mau:3.50, mie:3.15, mdd:8.35, mn:9.15,  msn:19.50, ikPlaine:0.35, ikMontagne:0.50 },
    2024: { ami:3.15, bsiInit:65.69, bsiInter:32.85, bsiFin:32.85, dep:null,
            mau:3.50, mie:3.15, mdd:8.35, mn:9.15,  msn:19.50, ikPlaine:0.35, ikMontagne:0.50 },
    2025: { ami:3.15, bsiInit:65.69, bsiInter:32.85, bsiFin:32.85, dep:null,
            mau:3.50, mie:3.15, mdd:8.35, mn:9.15,  msn:19.50, ikPlaine:0.35, ikMontagne:0.50 },
    2026: { ami:3.15, bsiInit:65.69, bsiInter:32.85, bsiFin:32.85, dep:null,
            mau:3.50, mie:3.15, mdd:8.35, mn:9.15,  msn:19.50, ikPlaine:0.35, ikMontagne:0.50 }
};

// Résumé des changements par année (affiché dans l'encart)
var NGAP_CHANGEMENTS = {
    2020: ['AMI = 3,15 €', 'Cotation DEP encore en vigueur (avant BSI)', 'MDD = 7,50 €', 'MSN = 18,00 €'],
    2021: ['AMI = 3,15 € — pas de changement', 'DEP toujours en vigueur', 'MDD = 7,50 €'],
    2022: ['⬆️ MAU revalorisé : 3,50 €', '⬆️ MDD revalorisé : 8,00 €', '⬆️ MSN revalorisé : 19,00 €', 'AMI stable : 3,15 €', 'DEP toujours en vigueur'],
    2023: ['🆕 BSI Initial : 65,69 € (remplace la DEP)', '🆕 BSI Intermédiaire : 32,85 €', '🆕 BSI Fin : 32,85 €', '⬆️ MDD revalorisé : 8,35 €', '⬆️ MSN revalorisé : 19,50 €', 'AMI stable : 3,15 €'],
    2024: ['AMI stable : 3,15 €', 'BSI inchangé : 65,69 € / 32,85 €', 'Majorations stables'],
    2025: ['AMI stable : 3,15 €', 'BSI inchangé', 'Pas de revalorisation majeure'],
    2026: ['AMI stable : 3,15 €', '⚡ Réforme CARPIMKO complémentaire (externe à NGAP)', 'BSI et majorations inchangés']
};

var NGAP_ACTES = [
    // SOINS GÉNÉRAUX
    {code:'AMI 1',    cat:'soins',       desc:'Injection sous-cutanée ou intramusculaire (insuline, anticoagulant...)',  coeff:1,    type:'ami'},
    {code:'AMI 1,5',  cat:'soins',       desc:'Prélèvement sanguin veineux au domicile du patient',                      coeff:1.5,  type:'ami'},
    {code:'AMI 2',    cat:'soins',       desc:'Injection intraveineuse directe',                                          coeff:2,    type:'ami'},
    {code:'AMI 2',    cat:'soins',       desc:'Pansement simple — plaie superficielle, ablation de points',              coeff:2,    type:'ami'},
    {code:'AMI 2',    cat:'soins',       desc:'Soins de stomie urinaire ou digestive',                                    coeff:2,    type:'ami'},
    {code:'AMI 3',    cat:'soins',       desc:'Pansement complexe — escarre stade 1-2, plaie chronique simple',          coeff:3,    type:'ami'},
    {code:'AMI 3',    cat:'soins',       desc:'Sondage vésical aller-retour chez la femme',                               coeff:3,    type:'ami'},
    {code:'AMI 3',    cat:'soins',       desc:'Pose de sonde naso-gastrique',                                             coeff:3,    type:'ami'},
    {code:'AMI 3',    cat:'soins',       desc:'Lavement évacuateur',                                                      coeff:3,    type:'ami'},
    {code:'AMI 3,5',  cat:'soins',       desc:'Sondage vésical à demeure (homme) — pose et surveillance',                coeff:3.5,  type:'ami'},
    {code:'AMI 4',    cat:'soins',       desc:'Séance de soins infirmiers (SSI) — soins de base complets',               coeff:4,    type:'ami'},
    {code:'AMI 4',    cat:'soins',       desc:'Pansement très complexe — escarre stade 3-4, brûlure étendue',           coeff:4,    type:'ami'},
    {code:'AMI 4',    cat:'soins',       desc:'Pansement chirurgical complexe post-opératoire évolutif',                  coeff:4,    type:'ami'},
    {code:'AMI 4',    cat:'soins',       desc:'Soins de trachéotomie (aspiration, pansement)',                            coeff:4,    type:'ami'},
    {code:'AMI 6',    cat:'soins',       desc:'Séance de soins palliatifs à domicile — nursing lourd',                   coeff:6,    type:'ami'},
    // PERFUSIONS
    {code:'AMI 4',    cat:'perfusion',   desc:'Perfusion simple sous-cutanée (hypodermoclyse)',                           coeff:4,    type:'ami'},
    {code:'AMI 8',    cat:'perfusion',   desc:'Perfusion IV périphérique (durée inférieure à 1h)',                        coeff:8,    type:'ami'},
    {code:'AMI 12',   cat:'perfusion',   desc:'Perfusion IV longue durée (supérieure à 1h) ou nutrition parentérale',    coeff:12,   type:'ami'},
    // PRÉLÈVEMENTS
    {code:'AMI 1,5',  cat:'prelevement', desc:'Prélèvement sanguin veineux à domicile',                                  coeff:1.5,  type:'ami'},
    {code:'AMI 1',    cat:'prelevement', desc:'Prélèvement capillaire (glycémie, INR, bandelette...)',                    coeff:1,    type:'ami'},
    {code:'AMI 2',    cat:'prelevement', desc:'Prélèvement bactériologique (ECBU, plaie, gorge...)',                      coeff:2,    type:'ami'},
    // PSYCHIATRIE
    {code:'AIS 3',    cat:'psychiatrie', desc:'Séance de soins infirmiers psychiatriques (GIR 4-5-6)',                    coeff:3,    type:'ami'},
    {code:'AIS 5',    cat:'psychiatrie', desc:'Séance soins psychiatriques — dépendance lourde (GIR 1-2-3)',              coeff:5,    type:'ami'},
    // BILAN BSI (2023+) / DEP (avant 2023)
    {code:'BSI Init.',cat:'bilan',       desc:'Bilan de Soins Infirmiers — Evaluation initiale (depuis 2023)',            coeff:null, type:'bsiInit'},
    {code:'BSI Inter.',cat:'bilan',      desc:'Bilan de Soins Infirmiers — Réévaluation intermédiaire (depuis 2023)',     coeff:null, type:'bsiInter'},
    {code:'BSI Fin',  cat:'bilan',       desc:'Bilan de Soins Infirmiers — Fin de prise en charge (depuis 2023)',         coeff:null, type:'bsiFin'},
    {code:'DEP',      cat:'bilan',       desc:'Dépendance (cotation avant 2023 — remplacée par le BSI)',                  coeff:null, type:'dep'},
    // MAJORATIONS
    {code:'MAU',      cat:'majoration',  desc:'Majoration Acte Unique — seul acte lors du passage',                       coeff:null, type:'mau'},
    {code:'MIE',      cat:'majoration',  desc:'Majoration Infirmière Exclusive',                                           coeff:null, type:'mie'},
    {code:'MDD',      cat:'majoration',  desc:'Majoration Dimanche et Jours Fériés',                                      coeff:null, type:'mdd'},
    {code:'MN',       cat:'majoration',  desc:'Majoration Nuit (20h-minuit et 6h-8h)',                                    coeff:null, type:'mn'},
    {code:'MSN',      cat:'majoration',  desc:'Majoration Nuit Profonde (minuit-6h)',                                      coeff:null, type:'msn'},
    // INDEMNITÉS
    {code:'IK Plaine',   cat:'indemnite',desc:'Indemnité kilométrique — zone plate ou urbaine (par km)',                   coeff:null, type:'ikPlaine'},
    {code:'IK Montagne', cat:'indemnite',desc:'Indemnité kilométrique — zone montagneuse (par km)',                        coeff:null, type:'ikMontagne'}
];

var NGAP_LABELS = {
    soins:'Soins généraux', perfusion:'Perfusion', prelevement:'Prélèvement',
    psychiatrie:'Psychiatrie', bilan:'Bilan / DEP', majoration:'Majoration', indemnite:'Indemnité'
};
var NGAP_COULEURS = {
    soins:'#eff6ff', perfusion:'#fff5f5', prelevement:'#fffbeb',
    psychiatrie:'#faf5ff', bilan:'#f0fdf4', majoration:'#f8fafc', indemnite:'#f8fafc'
};

var ngap = { annee:2026, statut:'titulaire' };

function ngapTarifs() {
    var saved = localStorage.getItem('ngap_tarifs_' + ngap.annee);
    if (saved) { try { return JSON.parse(saved); } catch(e){} }
    return NGAP_TARIFS[ngap.annee] || NGAP_TARIFS[2026];
}

function ngapFmt(n) {
    if (n === null || n === undefined) return '<span style="color:#94a3b8;font-style:italic;">N/A</span>';
    return n.toFixed(2).replace('.', ',') + ' \u20ac';
}

function ngapCalcTarif(acte) {
    var t = ngapTarifs();
    if (acte.type === 'ami') return acte.coeff * t.ami;
    var val = t[acte.type];
    return val !== undefined ? val : null;
}

function ngapMAJLabel() {
    var t = ngapTarifs();
    var el1 = document.getElementById('ngapAnneeLabel');
    var el2 = document.getElementById('ngapValeurAMI');
    if (el1) el1.textContent = ngap.annee;
    if (el2) el2.textContent = t.ami.toFixed(2).replace('.', ',') + ' \u20ac';
}

function ngapMAJChangements() {
    var el = document.getElementById('ngapChangements');
    if (!el) return;
    var changes = NGAP_CHANGEMENTS[ngap.annee] || [];
    el.innerHTML = '<strong>📋 Changements ' + ngap.annee + ' :</strong> '
        + changes.map(function(c) {
            return '<span style="background:#f1f5f9;padding:2px 8px;border-radius:10px;font-size:12px;margin:2px;display:inline-block;">' + c + '</span>';
        }).join(' ');
}

function ngapRendu() {
    var rech = ((document.getElementById('ngapSearch') || {}).value || '').toLowerCase().trim();
    var cat  = ((document.getElementById('ngapCategorie') || {}).value || '');
    var tbody = document.getElementById('ngapTbody');
    if (!tbody) return;

    var t = ngapTarifs();
    var annee = ngap.annee;

    var liste = NGAP_ACTES.filter(function(a) {
        // Masquer DEP si 2023+ et BSI si avant 2023
        if (a.type === 'dep'      && annee >= 2023) return false;
        if (a.type === 'bsiInit'  && annee < 2023)  return false;
        if (a.type === 'bsiInter' && annee < 2023)  return false;
        if (a.type === 'bsiFin'   && annee < 2023)  return false;
        var okCat  = !cat  || a.cat === cat;
        var okRech = !rech ||
            a.code.toLowerCase().indexOf(rech) >= 0 ||
            a.desc.toLowerCase().indexOf(rech) >= 0 ||
            (NGAP_LABELS[a.cat] || '').toLowerCase().indexOf(rech) >= 0;
        return okCat && okRech;
    });

    if (!liste.length) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#94a3b8;padding:20px;">Aucun acte pour ce filtre</td></tr>';
        return;
    }

    var retrocol = ngap.statut === 'remplacante';

    // Comparer avec année précédente pour surligner les changements
    var tPrec = NGAP_TARIFS[annee - 1];

    tbody.innerHTML = liste.map(function(a) {
        var tarif = ngapCalcTarif(a);
        var tarifPrec = null;
        if (tPrec) {
            if (a.type === 'ami') tarifPrec = a.coeff * tPrec.ami;
            else tarifPrec = tPrec[a.type] !== undefined ? tPrec[a.type] : null;
        }
        var changed = tarif !== null && tarifPrec !== null && Math.abs(tarif - tarifPrec) > 0.001;
        var newThisYear = tarif !== null && (tarifPrec === null || tarifPrec === undefined);
        var col = NGAP_COULEURS[a.cat] || '#fff';
        var rowStyle = changed ? 'background:#fefce8;border-left:3px solid #f59e0b;' : (newThisYear ? 'background:#f0fdf4;border-left:3px solid #22c55e;' : '');
        var badge = changed ? '<span style="background:#f59e0b;color:white;padding:1px 6px;border-radius:8px;font-size:10px;margin-left:4px;">⬆️ modifié</span>' :
                   (newThisYear ? '<span style="background:#22c55e;color:white;padding:1px 6px;border-radius:8px;font-size:10px;margin-left:4px;">🆕 nouveau</span>' : '');
        var tarifHtml = tarif !== null
            ? '<span style="font-weight:600;color:#2563eb;">' + tarif.toFixed(2).replace('.', ',') + ' \u20ac</span>' + badge
            : '<span style="color:#94a3b8;font-style:italic;">N/A cette année</span>';
        var rembHtml = tarif !== null
            ? '<span style="color:#16a34a;">' + (tarif * 0.60).toFixed(2).replace('.', ',') + ' \u20ac</span>'
            : '<span style="color:#94a3b8;">—</span>';
        var retro = (retrocol && tarif !== null)
            ? '<td style="text-align:right;color:#92400e;font-size:13px;">' + (tarif * 0.65).toFixed(2).replace('.', ',') + ' \u20ac</td>'
            : (retrocol ? '<td style="text-align:right;color:#94a3b8;">—</td>' : '');
        return '<tr style="border-bottom:1px solid #e2e8f0;' + rowStyle + '">'
            + '<td><code style="background:#e2e8f0;padding:2px 6px;border-radius:4px;font-size:12px;font-weight:bold;">' + a.code + '</code></td>'
            + '<td style="font-size:13px;">' + a.desc + '</td>'
            + '<td style="text-align:center;color:#94a3b8;">' + (a.coeff !== null ? '&times;' + a.coeff : '&mdash;') + '</td>'
            + '<td style="text-align:right;">' + tarifHtml + '</td>'
            + '<td style="text-align:right;">' + rembHtml + '</td>'
            + retro
            + '<td><span style="background:' + col + ';padding:2px 8px;border-radius:10px;font-size:11px;">' + (NGAP_LABELS[a.cat] || a.cat) + '</span></td>'
            + '</tr>';
    }).join('');

    ngapMAJLabel();
    ngapMAJChangements();
}

function ngapSimulateur() {
    var nb    = parseFloat((document.getElementById('simNbPassages')||{}).value) || 0;
    var tarif = parseFloat((document.getElementById('simActePrincipal')||{}).value) || 0;
    var jours = parseFloat((document.getElementById('simNbJours')||{}).value) || 0;
    var pct   = (parseFloat((document.getElementById('simPctMajo')||{}).value) || 0) / 100;
    var t = ngapTarifs();
    var mois  = (nb * tarif + nb * pct * ((t.mdd + t.mn) / 2)) * jours;
    var fmt = function(n) { return Math.round(n).toLocaleString('fr-FR') + ' \u20ac'; };
    var el = function(id) { return document.getElementById(id); };
    if (el('simCaMensuel'))  el('simCaMensuel').textContent  = fmt(mois);
    if (el('simCaAnnuel'))   el('simCaAnnuel').textContent   = fmt(mois * 12);
    if (el('simApresRetro')) el('simApresRetro').textContent = fmt(mois * 0.65) + '/mois';
}

// ── API window ───────────────────────────────────────────────────────────────

window.filtrerNGAP = ngapRendu;
window.calculerSimulateurNGAP = ngapSimulateur;

window.changerAnneeNGAP = function() {
    var sel = document.getElementById('ngapAnnee');
    if (sel) ngap.annee = parseInt(sel.value, 10) || 2026;
    ngapRendu();
    ngapSimulateur();
};

window.setStatutNGAP = function(statut) {
    ngap.statut = statut;
    var btnT  = document.getElementById('btnTitulaire');
    var btnR  = document.getElementById('btnRemplacante');
    var info  = document.getElementById('ngapInfoStatut');
    var bande = document.getElementById('bandeauRemplacante');
    var colR  = document.getElementById('colRetro');
    var est   = statut === 'titulaire';
    var actif   = 'background:#2563eb;color:white;border:none;padding:8px 16px;border-radius:6px;font-weight:600;cursor:pointer;';
    var inactif = 'background:#f1f5f9;border:1px solid #cbd5e1;color:#334155;padding:8px 16px;border-radius:6px;font-weight:600;cursor:pointer;';
    if (btnT) btnT.style.cssText = est ? actif : inactif;
    if (btnR) btnR.style.cssText = est ? inactif : actif;
    if (info) info.textContent = est
        ? 'Titulaire : facturation directe à la CPAM'
        : 'Remplaçante : facture sous n° titulaire — reverse 30-40% en rétrocession';
    if (bande) bande.style.display = est ? 'none' : 'block';
    if (colR)  colR.style.display  = est ? 'none' : 'table-cell';
    ngapRendu();
};

window.ouvrirEditionTarifs = function() {
    var t = ngapTarifs();
    var m = document.getElementById('ngapModalTarifs');
    if (!m) return;
    var lbl = document.getElementById('ngapModalAnnee');
    if (lbl) lbl.textContent = ngap.annee;
    ['ami','bsiInit','bsiInter','bsiFin','mau','mie','mdd','mn','msn','ikPlaine','ikMontagne'].forEach(function(c) {
        var el = document.getElementById('edit_' + c);
        if (el) el.value = (t[c] !== undefined && t[c] !== null) ? t[c] : '';
    });
    m.style.display = 'flex';
};

window.sauvegarderTarifsNGAP = function() {
    var val = function(id) {
        var v = (document.getElementById(id)||{}).value;
        return v !== '' ? parseFloat(v) : null;
    };
    localStorage.setItem('ngap_tarifs_' + ngap.annee, JSON.stringify({
        ami:val('edit_ami'), bsiInit:val('edit_bsiInit'), bsiInter:val('edit_bsiInter'),
        bsiFin:val('edit_bsiFin'), mau:val('edit_mau'), mie:val('edit_mie'),
        mdd:val('edit_mdd'), mn:val('edit_mn'), msn:val('edit_msn'),
        ikPlaine:val('edit_ikPlaine'), ikMontagne:val('edit_ikMontagne')
    }));
    window.fermerModalNGAP();
    ngapRendu(); ngapSimulateur();
};

window.resetTarifsNGAP = function() {
    if (!confirm('Réinitialiser les tarifs ' + ngap.annee + ' ?')) return;
    localStorage.removeItem('ngap_tarifs_' + ngap.annee);
    window.fermerModalNGAP();
    ngapRendu();
};

window.fermerModalNGAP = function() {
    var m = document.getElementById('ngapModalTarifs');
    if (m) m.style.display = 'none';
};

window.initNGAP = function() {
    var search = document.getElementById('ngapSearch');
    var categorie = document.getElementById('ngapCategorie');
    var annee = document.getElementById('ngapAnnee');
    if (search)    search.addEventListener('input', ngapRendu);
    if (categorie) categorie.addEventListener('change', ngapRendu);
    if (annee)     annee.addEventListener('change', function() {
        ngap.annee = parseInt(annee.value, 10) || 2026;
        ngapRendu(); ngapSimulateur();
    });
    ['simNbPassages','simNbJours','simPctMajo'].forEach(function(id) {
        var el = document.getElementById(id);
        if (el) el.addEventListener('input', ngapSimulateur);
    });
    var ap = document.getElementById('simActePrincipal');
    if (ap) ap.addEventListener('change', ngapSimulateur);
    ngapRendu(); ngapSimulateur();
};

document.addEventListener('DOMContentLoaded', function() {
    setTimeout(function() { if (typeof window.initNGAP === 'function') window.initNGAP(); }, 1000);
});
