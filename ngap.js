// ============================================================================
// ngap.js — Nomenclature NGAP Infirmières Libérales — Multi-années
// ============================================================================

var NGAP_TARIFS = {
    2022: { ami:3.15, bsiInit:62.50, bsiInter:31.25, bsiFin:31.25, mau:3.50, mie:3.15, mdd:8.00, mn:9.15, msn:19.00, ikPlaine:0.35, ikMontagne:0.50 },
    2023: { ami:3.15, bsiInit:65.69, bsiInter:32.85, bsiFin:32.85, mau:3.50, mie:3.15, mdd:8.35, mn:9.15, msn:19.50, ikPlaine:0.35, ikMontagne:0.50 },
    2024: { ami:3.15, bsiInit:65.69, bsiInter:32.85, bsiFin:32.85, mau:3.50, mie:3.15, mdd:8.35, mn:9.15, msn:19.50, ikPlaine:0.35, ikMontagne:0.50 },
    2025: { ami:3.15, bsiInit:65.69, bsiInter:32.85, bsiFin:32.85, mau:3.50, mie:3.15, mdd:8.35, mn:9.15, msn:19.50, ikPlaine:0.35, ikMontagne:0.50 },
    2026: { ami:3.15, bsiInit:65.69, bsiInter:32.85, bsiFin:32.85, mau:3.50, mie:3.15, mdd:8.35, mn:9.15, msn:19.50, ikPlaine:0.35, ikMontagne:0.50 }
};

var NGAP_ACTES = [
    {code:'AMI 1',   cat:'soins',      desc:'Injection sous-cutanée ou intramusculaire (insuline, anticoagulant...)',  coeff:1,    type:'ami'},
    {code:'AMI 1,5', cat:'soins',      desc:'Prélèvement sanguin veineux au domicile du patient',                      coeff:1.5,  type:'ami'},
    {code:'AMI 2',   cat:'soins',      desc:'Injection intraveineuse directe',                                          coeff:2,    type:'ami'},
    {code:'AMI 2',   cat:'soins',      desc:'Pansement simple — plaie superficielle, ablation de points',              coeff:2,    type:'ami'},
    {code:'AMI 2',   cat:'soins',      desc:'Soins de stomie urinaire ou digestive',                                    coeff:2,    type:'ami'},
    {code:'AMI 3',   cat:'soins',      desc:'Pansement complexe — escarre stade 1-2, plaie chronique simple',          coeff:3,    type:'ami'},
    {code:'AMI 3',   cat:'soins',      desc:'Sondage vésical aller-retour chez la femme',                               coeff:3,    type:'ami'},
    {code:'AMI 3',   cat:'soins',      desc:'Pose de sonde naso-gastrique',                                             coeff:3,    type:'ami'},
    {code:'AMI 3',   cat:'soins',      desc:'Lavement évacuateur',                                                      coeff:3,    type:'ami'},
    {code:'AMI 3,5', cat:'soins',      desc:'Sondage vésical à demeure (homme) — pose et surveillance',                coeff:3.5,  type:'ami'},
    {code:'AMI 4',   cat:'soins',      desc:'Séance de soins infirmiers (SSI) — soins de base complets',               coeff:4,    type:'ami'},
    {code:'AMI 4',   cat:'soins',      desc:'Pansement très complexe — escarre stade 3-4, brûlure étendue',           coeff:4,    type:'ami'},
    {code:'AMI 4',   cat:'soins',      desc:'Pansement chirurgical complexe post-opératoire évolutif',                  coeff:4,    type:'ami'},
    {code:'AMI 4',   cat:'soins',      desc:'Soins de trachéotomie (aspiration, pansement)',                            coeff:4,    type:'ami'},
    {code:'AMI 6',   cat:'soins',      desc:'Séance de soins palliatifs à domicile — nursing lourd',                   coeff:6,    type:'ami'},
    {code:'AMI 4',   cat:'perfusion',  desc:'Perfusion simple sous-cutanée (hypodermoclyse)',                            coeff:4,    type:'ami'},
    {code:'AMI 8',   cat:'perfusion',  desc:'Perfusion IV périphérique (durée inférieure à 1h)',                        coeff:8,    type:'ami'},
    {code:'AMI 12',  cat:'perfusion',  desc:'Perfusion IV longue durée (supérieure à 1h) ou nutrition parentérale',     coeff:12,   type:'ami'},
    {code:'AMI 1,5', cat:'prelevement',desc:'Prélèvement sanguin veineux à domicile',                                   coeff:1.5,  type:'ami'},
    {code:'AMI 1',   cat:'prelevement',desc:'Prélèvement capillaire (glycémie, INR, bandelette...)',                    coeff:1,    type:'ami'},
    {code:'AMI 2',   cat:'prelevement',desc:'Prélèvement bactériologique (ECBU, plaie, gorge...)',                      coeff:2,    type:'ami'},
    {code:'AIS 3',   cat:'psychiatrie',desc:'Séance de soins infirmiers psychiatriques (GIR 4-5-6)',                    coeff:3,    type:'ami'},
    {code:'AIS 5',   cat:'psychiatrie',desc:'Séance soins psychiatriques — dépendance lourde (GIR 1-2-3)',              coeff:5,    type:'ami'},
    {code:'BSI Init.',cat:'bilan',     desc:'Bilan de Soins Infirmiers — Evaluation initiale de la dépendance',         coeff:null, type:'bsiInit'},
    {code:'BSI Inter.',cat:'bilan',    desc:'Bilan de Soins Infirmiers — Réévaluation intermédiaire',                   coeff:null, type:'bsiInter'},
    {code:'BSI Fin', cat:'bilan',      desc:'Bilan de Soins Infirmiers — Fin de prise en charge',                       coeff:null, type:'bsiFin'},
    {code:'MAU',     cat:'majoration', desc:'Majoration Acte Unique — seul acte lors du passage',                       coeff:null, type:'mau'},
    {code:'MIE',     cat:'majoration', desc:'Majoration Infirmière Exclusive',                                           coeff:null, type:'mie'},
    {code:'MDD',     cat:'majoration', desc:'Majoration Dimanche et Jours Fériés',                                      coeff:null, type:'mdd'},
    {code:'MN',      cat:'majoration', desc:'Majoration Nuit (20h-minuit et 6h-8h)',                                    coeff:null, type:'mn'},
    {code:'MSN',     cat:'majoration', desc:'Majoration Nuit Profonde (minuit-6h)',                                      coeff:null, type:'msn'},
    {code:'IK Plaine',  cat:'indemnite',desc:'Indemnité kilométrique — zone plate ou urbaine (par km)',                  coeff:null, type:'ikPlaine'},
    {code:'IK Montagne',cat:'indemnite',desc:'Indemnité kilométrique — zone montagneuse (par km)',                       coeff:null, type:'ikMontagne'}
];

var NGAP_LABELS = {
    soins:'Soins généraux', perfusion:'Perfusion', prelevement:'Prélèvement',
    psychiatrie:'Psychiatrie', bilan:'Bilan BSI', majoration:'Majoration', indemnite:'Indemnité'
};

var NGAP_COULEURS = {
    soins:'#eff6ff', perfusion:'#fff5f5', prelevement:'#fffbeb',
    psychiatrie:'#faf5ff', bilan:'#f0fdf4', majoration:'#f8fafc', indemnite:'#f8fafc'
};

// État
var ngap = { annee:2026, statut:'titulaire' };

function ngapTarifs() {
    var saved = localStorage.getItem('ngap_tarifs_' + ngap.annee);
    if (saved) { try { return JSON.parse(saved); } catch(e){} }
    return NGAP_TARIFS[ngap.annee] || NGAP_TARIFS[2026];
}

function ngapFmt(n) { return n.toFixed(2).replace('.', ',') + ' \u20ac'; }

function ngapCalcTarif(acte) {
    var t = ngapTarifs();
    return acte.type === 'ami' ? acte.coeff * t.ami : (t[acte.type] || 0);
}

function ngapMAJLabel() {
    var t = ngapTarifs();
    var el1 = document.getElementById('ngapAnneeLabel');
    var el2 = document.getElementById('ngapValeurAMI');
    if (el1) el1.textContent = ngap.annee;
    if (el2) el2.textContent = t.ami.toFixed(2).replace('.', ',') + ' \u20ac';
}

function ngapRendu() {
    var rech = ((document.getElementById('ngapSearch') || {}).value || '').toLowerCase().trim();
    var cat  = ((document.getElementById('ngapCategorie') || {}).value || '');
    var tbody = document.getElementById('ngapTbody');
    if (!tbody) { return; }

    var liste = NGAP_ACTES.filter(function(a) {
        var okCat  = !cat  || a.cat === cat;
        var okRech = !rech ||
            a.code.toLowerCase().indexOf(rech) >= 0 ||
            a.desc.toLowerCase().indexOf(rech) >= 0 ||
            NGAP_LABELS[a.cat].toLowerCase().indexOf(rech) >= 0;
        return okCat && okRech;
    });

    if (!liste.length) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#94a3b8;padding:20px;">Aucun acte pour ce filtre</td></tr>';
        return;
    }

    var retrocol = ngap.statut === 'remplacante';
    tbody.innerHTML = liste.map(function(a) {
        var tarif = ngapCalcTarif(a);
        var col = NGAP_COULEURS[a.cat] || '#fff';
        var retro = retrocol ? '<td style="text-align:right;color:#92400e;font-size:13px;">' + ngapFmt(tarif * 0.65) + '</td>' : '';
        return '<tr style="border-bottom:1px solid #e2e8f0;">'
            + '<td><code style="background:#e2e8f0;padding:2px 6px;border-radius:4px;font-size:12px;font-weight:bold;">' + a.code + '</code></td>'
            + '<td style="font-size:13px;">' + a.desc + '</td>'
            + '<td style="text-align:center;color:#94a3b8;">' + (a.coeff !== null ? '&times;' + a.coeff : '&mdash;') + '</td>'
            + '<td style="text-align:right;font-weight:600;color:#2563eb;">' + ngapFmt(tarif) + '</td>'
            + '<td style="text-align:right;color:#16a34a;">' + ngapFmt(tarif * 0.60) + '</td>'
            + retro
            + '<td><span style="background:' + col + ';padding:2px 8px;border-radius:10px;font-size:11px;">' + NGAP_LABELS[a.cat] + '</span></td>'
            + '</tr>';
    }).join('');

    ngapMAJLabel();
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
    var styleActif   = 'background:#2563eb;color:white;border:none;padding:8px 16px;border-radius:6px;font-weight:600;cursor:pointer;';
    var styleInactif = 'background:#f1f5f9;border:1px solid #cbd5e1;color:#334155;padding:8px 16px;border-radius:6px;font-weight:600;cursor:pointer;';
    if (btnT) btnT.style.cssText = est ? styleActif : styleInactif;
    if (btnR) btnR.style.cssText = est ? styleInactif : styleActif;
    if (info) info.textContent = est
        ? '\u2139\uFE0F Titulaire : facturation directe à la CPAM'
        : '\u2139\uFE0F Remplaçante : facture sous n° titulaire — reverse 30-40% en rétrocession';
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
        if (el) el.value = t[c] !== undefined ? t[c] : '';
    });
    m.style.display = 'flex';
};

window.sauvegarderTarifsNGAP = function() {
    var val = function(id) { return parseFloat((document.getElementById(id)||{}).value)||0; };
    localStorage.setItem('ngap_tarifs_' + ngap.annee, JSON.stringify({
        ami:val('edit_ami'), bsiInit:val('edit_bsiInit'), bsiInter:val('edit_bsiInter'),
        bsiFin:val('edit_bsiFin'), mau:val('edit_mau'), mie:val('edit_mie'),
        mdd:val('edit_mdd'), mn:val('edit_mn'), msn:val('edit_msn'),
        ikPlaine:val('edit_ikPlaine'), ikMontagne:val('edit_ikMontagne')
    }));
    window.fermerModalNGAP();
    ngapRendu();
    ngapSimulateur();
};

window.resetTarifsNGAP = function() {
    if (!confirm('Réinitialiser les tarifs ' + ngap.annee + ' aux valeurs officielles ?')) return;
    localStorage.removeItem('ngap_tarifs_' + ngap.annee);
    window.fermerModalNGAP();
    ngapRendu();
};

window.fermerModalNGAP = function() {
    var m = document.getElementById('ngapModalTarifs');
    if (m) m.style.display = 'none';
};

window.initNGAP = function() {
    // Attacher les événements via JS (plus fiable que oninput/onchange inline)
    var search = document.getElementById('ngapSearch');
    var categorie = document.getElementById('ngapCategorie');
    var annee = document.getElementById('ngapAnnee');

    if (search) {
        search.oninput = null;
        search.addEventListener('input', function() { ngapRendu(); });
    }
    if (categorie) {
        categorie.onchange = null;
        categorie.addEventListener('change', function() { ngapRendu(); });
    }
    if (annee) {
        annee.onchange = null;
        annee.addEventListener('change', function() {
            ngap.annee = parseInt(annee.value, 10) || 2026;
            ngapRendu();
            ngapSimulateur();
        });
    }

    // Simulateur
    ['simNbPassages','simNbJours','simPctMajo'].forEach(function(id) {
        var el = document.getElementById(id);
        if (el) el.addEventListener('input', ngapSimulateur);
    });
    var actePrincipal = document.getElementById('simActePrincipal');
    if (actePrincipal) actePrincipal.addEventListener('change', ngapSimulateur);

    ngapRendu();
    ngapSimulateur();
};

// Auto-init quand l'onglet est ouvert
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(function() {
        if (typeof window.initNGAP === 'function') window.initNGAP();
    }, 1000);
});
