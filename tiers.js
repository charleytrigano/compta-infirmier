// ============================================================================
// tiers.js — Gestion des comptes de tiers individuels
// ============================================================================

var TIERS_DATA = [];

var COMPTES_TIERS = [
    {compte:'411000', label:'411 — Clients / CPAM / Patients'},
    {compte:'411100', label:'411 — Mutuelle / Complémentaire'},
    {compte:'421000', label:'421 — Rétrocession Titulaire'},
    {compte:'431000', label:'431 — URSSAF'},
    {compte:'437100', label:'437 — CARPIMKO Retraite'},
    {compte:'437200', label:'437 — CARPIMKO Prévoyance'},
    {compte:'437300', label:'437 — CARPIMKO Invalidité-décès'},
    {compte:'441000', label:'441 — État / Impôts'},
    {compte:'401000', label:'401 — Fournisseurs matériel'},
    {compte:'401100', label:'401 — Laboratoire'},
    {compte:'401200', label:'401 — Pharmacie'},
    {compte:'401300', label:'401 — Informatique / Logiciel'},
    {compte:'401400', label:'401 — Expert-comptable / Honoraires'},
    {compte:'401500', label:'401 — Ordre National Infirmiers'},
    {compte:'455000', label:'455 — Exploitant (prélèvement perso)'},
];

// ── Charger les tiers depuis Supabase ─────────────────────────────────────────
async function tiersCharger() {
    var sc = window.supabaseClient;
    if (!sc) {
        // Réessayer dans 1 seconde
        setTimeout(tiersCharger, 1000);
        return;
    }
    try {
        var r = await sc.from('tiers').select('*').eq('actif', true).order('compte').order('nom');
        if (r.error) { console.error('tiers.js:', r.error); return; }
        TIERS_DATA = r.data || [];
        console.log('[tiers] chargés:', TIERS_DATA.length);

        // Ajouter les patients comme tiers 411200 automatiquement
        if (window.PT && PT.patients && PT.patients.length) {
            PT.patients.filter(function(p){ return p.actif; }).forEach(function(p) {
                var nom = (p.nom||'').toUpperCase() + ' ' + (p.prenom||'');
                // Vérifier qu'il n'est pas déjà dans TIERS_DATA
                var existe = TIERS_DATA.some(function(t){ return t.nom === nom && t.compte === '411200'; });
                if (!existe) {
                    TIERS_DATA.push({
                        id: 'patient_' + p.id,
                        compte: '411200',
                        nom: nom + (p.ald ? ' [ALD]' : ''),
                        _patient: true
                    });
                }
            });
        }

        tiersRenduSelect();
        tiersRenduListe();
    } catch(e) {
        console.error('[tiers] exception:', e);
    }
}

// ── Remplir le select du Journal de Banque ────────────────────────────────────
function tiersRenduSelect() {
    var sel = document.getElementById('pay-tiers-id');
    if (!sel) { console.warn('[tiers] pay-tiers-id introuvable'); return; }
    var val = sel.value;

    // Grouper par compte
    var groupes = {};
    TIERS_DATA.forEach(function(t) {
        if (!groupes[t.compte]) groupes[t.compte] = [];
        groupes[t.compte].push(t);
    });

    sel.innerHTML = '<option value="">-- Sélectionner un tiers --</option>';

    // Afficher d'abord les comptes définis dans COMPTES_TIERS (avec leur label)
    var comptesMontres = {};
    COMPTES_TIERS.forEach(function(c) {
        var liste = groupes[c.compte];
        if (!liste || !liste.length) return;
        comptesMontres[c.compte] = true;
        var grp = document.createElement('optgroup');
        grp.label = c.label;
        liste.forEach(function(t) {
            var opt = document.createElement('option');
            opt.value = t.id;
            opt.dataset.compte = t.compte;
            opt.dataset.nom = t.nom;
            opt.textContent = t.nom;
            grp.appendChild(opt);
        });
        sel.appendChild(grp);
    });

    // Afficher les autres comptes non définis dans COMPTES_TIERS
    Object.keys(groupes).sort().forEach(function(compte) {
        if (comptesMontres[compte]) return;
        var grp = document.createElement('optgroup');
        grp.label = compte;
        groupes[compte].forEach(function(t) {
            var opt = document.createElement('option');
            opt.value = t.id;
            opt.dataset.compte = t.compte;
            opt.dataset.nom = t.nom;
            opt.textContent = t.nom;
            grp.appendChild(opt);
        });
        sel.appendChild(grp);
    });

    if (val) sel.value = val;
    console.log('[tiers] select rempli:', TIERS_DATA.length, 'tiers');
}

// ── Sélection d'un tiers → auto-remplissage ───────────────────────────────────
window.bankTiersChange = function() {
    var sel  = document.getElementById('pay-tiers-id');
    var desc = document.getElementById('pay-description');
    var code = document.getElementById('pay-compte-code');
    var typeS = document.getElementById('pay-type');
    var catS  = document.getElementById('pay-categorie');
    if (!sel || !sel.value) return;

    var opt = sel.options[sel.selectedIndex];
    var compte = opt ? opt.dataset.compte : '';
    var nom    = opt ? opt.dataset.nom    : '';

    if (code) code.value = compte;
    if (desc && !desc.value) desc.value = nom;

    // Auto Sens et Catégorie
    var auto = {
        '411000': {type:'Recette', cat:'Soins infirmiers'},
        '411100': {type:'Recette', cat:'Soins infirmiers'},
        '411200': {type:'Recette', cat:'Soins infirmiers'},
        '431000': {type:'Dépense', cat:'URSSAF'},
        '437100': {type:'Dépense', cat:'Cotisations CARPIMKO'},
        '437200': {type:'Dépense', cat:'Cotisations CARPIMKO'},
        '437300': {type:'Dépense', cat:'Cotisations CARPIMKO'},
        '441000': {type:'Dépense', cat:'Autre'},
        '401400': {type:'Dépense', cat:'Autre'},
        '421000': {type:'Dépense', cat:'Autre'},
        '455000': {type:'Dépense', cat:'Autre'},
    };
    if (auto[compte]) {
        if (typeS) { for(var i=0;i<typeS.options.length;i++) { if(typeS.options[i].value===auto[compte].type){typeS.selectedIndex=i;break;} } }
        if (catS)  { for(var i=0;i<catS.options.length;i++)  { if(catS.options[i].value===auto[compte].cat) {catS.selectedIndex=i;break;}  } }
    }

    // Bulle d'info
    var info = document.getElementById('pay-tiers-info');
    if (info) {
        info.style.display = 'block';
        info.innerHTML = '<strong>' + compte + '</strong> — ' + nom;
    }
};

// ── Sauvegarder le tiers_id avec la transaction ───────────────────────────────
var _origAjouterPaiement = null;
window.addEventListener('load', function() {
    setTimeout(function() {
        if (typeof window.ajouterPaiement === 'function' && !window._tiersPatch) {
            window._tiersPatch = true;
            _origAjouterPaiement = window.ajouterPaiement;
            window.ajouterPaiement = async function() {
                var tiersId = (document.getElementById('pay-tiers-id') || {}).value || null;
                await _origAjouterPaiement.apply(this, arguments);
                if (tiersId) {
                    var sc = window.supabaseClient;
                    if (sc) {
                        var r = await sc.from('transactions').select('id').order('created_at',{ascending:false}).limit(1);
                        if (r.data && r.data.length) {
                            var t = TIERS_DATA.find(function(x){return x.id===tiersId;});
                            await sc.from('transactions').update({
                                tiers_id: tiersId,
                                compte_tiers_code: t ? t.compte : null,
                                nom_tiers: t ? t.nom : null
                            }).eq('id', r.data[0].id);
                        }
                    }
                    // Reset
                    var sel = document.getElementById('pay-tiers-id');
                    var inf = document.getElementById('pay-tiers-info');
                    if (sel) sel.value = '';
                    if (inf) inf.style.display = 'none';
                }
            };
        }
    }, 1000);
});

// ── GESTION DES TIERS (CRUD) ──────────────────────────────────────────────────
function tiersRenduListe() {
    var el = document.getElementById('tiersListe'); if (!el) return;
    if (!TIERS_DATA.length) {
        el.innerHTML = '<p style="color:#94a3b8;text-align:center;padding:15px;">Aucun tiers. Cliquez "+ Nouveau tiers".</p>';
        return;
    }
    var groupes = {};
    TIERS_DATA.forEach(function(t) {
        if (!groupes[t.compte]) groupes[t.compte] = [];
        groupes[t.compte].push(t);
    });
    var html = '';
    Object.keys(groupes).sort().forEach(function(compte) {
        var labelCompte = (COMPTES_TIERS.find(function(c){return c.compte===compte;})||{label:compte}).label;
        html += '<div style="margin-bottom:12px;">'
            + '<div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.05em;padding:4px 0;border-bottom:1px solid #e2e8f0;margin-bottom:6px;">' + labelCompte + '</div>'
            + groupes[compte].map(function(t) {
                return '<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 10px;background:white;border:1px solid #e2e8f0;border-radius:6px;margin-bottom:4px;">'
                    + '<div>'
                    + '<span style="font-weight:600;font-size:13px;">' + t.nom + '</span>'
                    + (t.siret ? '<span style="font-size:11px;color:#64748b;margin-left:8px;">SIRET: ' + t.siret + '</span>' : '')
                    + (t.iban  ? '<span style="font-size:11px;color:#64748b;margin-left:8px;">IBAN: ' + t.iban + '</span>'  : '')
                    + '</div>'
                    + '<div style="display:flex;gap:6px;">'
                    + '<button onclick="tiersEditer(\'' + t.id + '\')" style="background:#f8fafc;border:1px solid #e2e8f0;padding:3px 8px;border-radius:4px;cursor:pointer;font-size:12px;">✏️</button>'
                    + '<button onclick="tiersSupprimer(\'' + t.id + '\')" style="background:#fef2f2;border:1px solid #fecaca;color:#dc2626;padding:3px 8px;border-radius:4px;cursor:pointer;font-size:12px;">🗑️</button>'
                    + '</div>'
                    + '</div>';
            }).join('') + '</div>';
    });
    el.innerHTML = html;
}

window.tiersOuvrirModal = function(id) {
    var m = document.getElementById('tiersModal'); if (!m) return;
    var f = document.getElementById('tiersForm'); if (f) f.reset();
    window._tiersEditeId = null;
    if (id) {
        var t = TIERS_DATA.find(function(x){return x.id===id;});
        if (t) {
            window._tiersEditeId = id;
            var champs = {tiersCompte:t.compte, tiersNom:t.nom,
                          tiersSiret:t.siret, tiersIban:t.iban, tiersNotes:t.notes};
            Object.keys(champs).forEach(function(k){
                var e=document.getElementById(k); if(e) e.value=champs[k]||'';
            });
        }
    }
    m.style.display = 'flex';
};

window.tiersFermerModal = function() {
    var m = document.getElementById('tiersModal'); if (m) m.style.display = 'none';
};

window.tiersSauvegarder = async function(e) {
    if (e) e.preventDefault();
    var sc = window.supabaseClient; if (!sc) return;
    var data = {
        compte: (document.getElementById('tiersCompte')||{}).value,
        nom:    (document.getElementById('tiersNom')||{}).value.trim(),
        siret:  (document.getElementById('tiersSiret')||{}).value.trim() || null,
        iban:   (document.getElementById('tiersIban')||{}).value.trim()  || null,
        notes:  (document.getElementById('tiersNotes')||{}).value.trim() || null,
        actif:  true
    };
    if (!data.compte || !data.nom) { alert('Compte et nom obligatoires'); return; }
    var r = window._tiersEditeId
        ? await sc.from('tiers').update(data).eq('id', window._tiersEditeId)
        : await sc.from('tiers').insert([data]);
    if (r.error) { alert('Erreur : ' + r.error.message); return; }
    window.tiersFermerModal();
    await tiersCharger();
};

window.tiersEditer    = function(id) { window.tiersOuvrirModal(id); };
window.tiersSupprimer = async function(id) {
    if (!confirm('Supprimer ce tiers ?')) return;
    var sc = window.supabaseClient; if (!sc) return;
    await sc.from('tiers').update({actif:false}).eq('id', id);
    await tiersCharger();
};

// ── Init ──────────────────────────────────────────────────────────────────────
window.initTiers = async function() {
    // Charger les patients d'abord si disponibles
    if (typeof window.initPatients === 'function' && !(window.PT && PT.patients && PT.patients.length)) {
        await window.initPatients();
    }
    await tiersCharger();
};

// Auto-init dès que Supabase est prêt
document.addEventListener('DOMContentLoaded', function() {
    var check = setInterval(function() {
        if (window.supabaseClient) {
            clearInterval(check);
            tiersCharger();
        }
    }, 500);
});
