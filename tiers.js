// ============================================================================
// tiers.js — Comptes de tiers depuis la table 'tiers'
// ============================================================================

var TIERS_DATA = [];

var COMPTES_TIERS_LABELS = {
    '401': '401 — Fournisseurs',
    '411': '411 — Clients / Patients / CPAM',
    '421': '421 — Rétrocession Titulaire',
    '431': '431 — URSSAF',
    '437': '437 — CARPIMKO',
    '438': '438 — Charges à payer',
    '441': '441 — État / Impôts',
    '445': '445 — TVA',
    '455': '455 — Exploitant',
};

function tiersGroupeLabel(code) {
    if (!code) return 'Autres';
    // Prendre les 3 premiers caractères numériques
    var m = String(code).match(/^(\d{3})/);
    var prefix = m ? m[1] : code.substring(0,3);
    return COMPTES_TIERS_LABELS[prefix] || (prefix + ' — Autres');
}

// ── Charger depuis la table tiers ─────────────────────────────────────────────
async function tiersCharger() {
    var sc = window.supabaseClient;
    if (!sc) { setTimeout(tiersCharger, 500); return; }
    try {
        var r = await sc.from('tiers')
            .select('*')
            .eq('actif', true)
            .order('compte')
            .order('nom');
        if (r.error) { console.error('[tiers]', r.error.message); return; }
        TIERS_DATA = r.data || [];
        console.log('[tiers] chargés depuis table tiers:', TIERS_DATA.length);
        tiersRenduSelect();
        tiersRenduListe();
    } catch(e) {
        console.error('[tiers]', e);
    }
}

// ── Remplir le select Journal de Banque ───────────────────────────────────────
function tiersRenduSelect() {
    var sel = document.getElementById('pay-tiers-id');
    if (!sel) return;

    // Grouper par compte
    var groupes = {};
    TIERS_DATA.forEach(function(t) {
        var g = tiersGroupeLabel(t.compte);
        if (!groupes[g]) groupes[g] = [];
        groupes[g].push(t);
    });

    sel.innerHTML = '<option value="">-- Sélectionner un tiers --</option>';
    Object.keys(groupes).sort().forEach(function(grpLabel) {
        var grp = document.createElement('optgroup');
        grp.label = grpLabel;
        groupes[grpLabel].forEach(function(t) {
            var opt = document.createElement('option');
            opt.value = t.id;
            opt.dataset.compte = t.compte;
            opt.dataset.nom    = t.nom;
            opt.textContent    = t.nom + '  (' + t.compte + ')';
            grp.appendChild(opt);
        });
        sel.appendChild(grp);
    });
    console.log('[tiers] select rempli:', sel.options.length, 'options');
}

// ── Sélection → auto-remplissage ─────────────────────────────────────────────
window.bankTiersChange = function() {
    var sel   = document.getElementById('pay-tiers-id');
    var desc  = document.getElementById('pay-description');
    var code  = document.getElementById('pay-compte-code');
    var typeS = document.getElementById('pay-type');
    var catS  = document.getElementById('pay-categorie');
    var info  = document.getElementById('pay-tiers-info');
    if (!sel || !sel.value) { if (info) info.style.display='none'; return; }

    var opt    = sel.options[sel.selectedIndex];
    var compte = opt ? opt.dataset.compte : '';
    var nom    = opt ? opt.dataset.nom    : '';
    var m      = String(compte).match(/^(\d{3})/);
    var prefix = m ? m[1] : '';

    if (code) code.value = compte;
    if (desc && !desc.value) desc.value = nom;

    if (info) {
        info.style.display = 'block';
        info.innerHTML = '<code style="background:#e0e7ff;padding:1px 6px;border-radius:3px;">'
            + compte + '</code> — <strong>' + nom + '</strong>';
    }

    var autoMap = {
        '411': {type:'Recette', cat:'Soins infirmiers'},
        '431': {type:'Dépense', cat:'URSSAF'},
        '437': {type:'Dépense', cat:'Cotisations CARPIMKO'},
        '401': {type:'Dépense', cat:'Achats matériel'},
        '441': {type:'Dépense', cat:'Autre'},
        '421': {type:'Dépense', cat:'Autre'},
        '455': {type:'Dépense', cat:'Autre'},
    };
    if (prefix && autoMap[prefix]) {
        var a = autoMap[prefix];
        if (typeS) for(var i=0;i<typeS.options.length;i++) { if(typeS.options[i].value===a.type){typeS.selectedIndex=i;break;} }
        if (catS)  for(var i=0;i<catS.options.length;i++)  { if(catS.options[i].value===a.cat) {catS.selectedIndex=i;break;}  }
    }
};

// ── Patch ajouterPaiement ─────────────────────────────────────────────────────
window.addEventListener('load', function() {
    setTimeout(function() {
        if (typeof window.ajouterPaiement === 'function' && !window._tiersPatch) {
            window._tiersPatch = true;
            var orig = window.ajouterPaiement;
            window.ajouterPaiement = async function() {
                var sel     = document.getElementById('pay-tiers-id');
                var tiersId = sel ? sel.value : null;
                await orig.apply(this, arguments);
                if (tiersId) {
                    var sc = window.supabaseClient;
                    if (sc) {
                        var r = await sc.from('transactions').select('id')
                            .order('created_at',{ascending:false}).limit(1);
                        if (r.data && r.data.length) {
                            var t = TIERS_DATA.find(function(x){ return String(x.id)===String(tiersId); });
                            await sc.from('transactions').update({
                                tiers_id:             tiersId,
                                compte_tiers_code:    t ? t.compte : null,
                                compte_tiers_libelle: t ? t.compte+' — '+t.nom : null,
                                nom_tiers:            t ? t.nom : null,
                            }).eq('id', r.data[0].id);
                        }
                    }
                    if (sel) sel.value = '';
                    var inf = document.getElementById('pay-tiers-info');
                    if (inf) inf.style.display = 'none';
                }
            };
        }
    }, 1000);
});

// ── CRUD Tiers ────────────────────────────────────────────────────────────────
function tiersRenduListe() {
    var el = document.getElementById('tiersListe'); if (!el) return;
    if (!TIERS_DATA.length) {
        el.innerHTML = '<p style="color:#94a3b8;text-align:center;padding:15px;">Aucun tiers.</p>';
        return;
    }
    var groupes = {};
    TIERS_DATA.forEach(function(t) {
        var g = tiersGroupeLabel(t.compte);
        if (!groupes[g]) groupes[g] = [];
        groupes[g].push(t);
    });
    var html = '';
    Object.keys(groupes).sort().forEach(function(g) {
        html += '<div style="margin-bottom:12px;"><div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;padding:4px 0;border-bottom:1px solid #e2e8f0;margin-bottom:6px;">' + g + '</div>'
            + groupes[g].map(function(t) {
                return '<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 10px;background:white;border:1px solid #e2e8f0;border-radius:6px;margin-bottom:4px;">'
                    + '<div><code style="background:#f1f5f9;padding:1px 6px;border-radius:3px;font-size:11px;">' + t.compte + '</code>'
                    + ' <strong>' + t.nom + '</strong>'
                    + (t.siret ? ' <span style="font-size:11px;color:#64748b;">SIRET: '+t.siret+'</span>' : '')
                    + '</div>'
                    + '<div style="display:flex;gap:6px;">'
                    + '<button onclick="tiersEditer(\''+t.id+'\')" style="background:#f8fafc;border:1px solid #e2e8f0;padding:3px 8px;border-radius:4px;cursor:pointer;font-size:12px;">✏️</button>'
                    + '<button onclick="tiersSupprimer(\''+t.id+'\')" style="background:#fef2f2;border:1px solid #fecaca;color:#dc2626;padding:3px 8px;border-radius:4px;cursor:pointer;font-size:12px;">🗑️</button>'
                    + '</div></div>';
            }).join('') + '</div>';
    });
    el.innerHTML = html;
}

window.tiersOuvrirModal = function(id) {
    window._tiersEditeId = null;
    var m = document.getElementById('tiersModal'); if (!m) return;
    var f = document.getElementById('tiersForm'); if (f) f.reset();
    m.style.display = 'flex';
};
window.tiersFermerModal = function() {
    var m = document.getElementById('tiersModal'); if (m) m.style.display = 'none';
};
window.tiersEditer = function(id) {
    var t = TIERS_DATA.find(function(x){ return String(x.id)===String(id); });
    if (!t) return;
    window._tiersEditeId = id;
    var m = document.getElementById('tiersModal'); if (!m) return;
    var f = document.getElementById('tiersForm'); if (f) f.reset();
    var map = {tiersCompte:t.compte, tiersNom:t.nom, tiersSiret:t.siret||'', tiersIban:t.iban||'', tiersNotes:t.notes||''};
    Object.keys(map).forEach(function(k){ var e=document.getElementById(k); if(e) e.value=map[k]; });
    m.style.display = 'flex';
};
window.tiersSauvegarder = async function(e) {
    if (e) e.preventDefault();
    var sc = window.supabaseClient; if (!sc) return;
    var data = {
        compte:    (document.getElementById('tiersCompte')||{}).value,
        nom:       ((document.getElementById('tiersNom')||{}).value||'').trim(),
        categorie: 'tiers',
        siret:     ((document.getElementById('tiersSiret')||{}).value||'').trim() || null,
        iban:      ((document.getElementById('tiersIban')||{}).value||'').trim()  || null,
        notes:     ((document.getElementById('tiersNotes')||{}).value||'').trim() || null,
        actif:     true,
    };
    if (!data.compte || !data.nom) { alert('Compte et nom obligatoires'); return; }
    var r = window._tiersEditeId
        ? await sc.from('tiers').update(data).eq('id', window._tiersEditeId)
        : await sc.from('tiers').insert([data]);
    if (r.error) { alert('Erreur : '+r.error.message); return; }
    window.tiersFermerModal();
    await tiersCharger();
};
window.tiersSupprimer = async function(id) {
    if (!confirm('Supprimer ce tiers ?')) return;
    var sc = window.supabaseClient; if (!sc) return;
    await sc.from('tiers').update({actif:false}).eq('id', id);
    await tiersCharger();
};
window.initTiers = async function() { await tiersCharger(); };

// Démarrage auto
document.addEventListener('DOMContentLoaded', function() {
    var n=0, iv=setInterval(function(){
        n++;
        if (window.supabaseClient) { clearInterval(iv); tiersCharger(); }
        if (n>20) clearInterval(iv);
    }, 500);
});
