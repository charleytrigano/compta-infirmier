// ============================================================================
// ngap.js — Nomenclature NGAP Infirmières Libérales — Multi-années
// ============================================================================

// Valeurs de référence par année (AMI + montants fixes)
// Source : CNAM / Avenant conventionnel
const NGAP_TARIFS_ANNEE = {
    2022: { ami: 3.15, bsiInit: 62.50, bsiInter: 31.25, bsiFin: 31.25,
            mau: 3.50, mie: 3.15, mdd: 8.00, mn: 9.15, msn: 19.00,
            ikPlaine: 0.35, ikMontagne: 0.50 },
    2023: { ami: 3.15, bsiInit: 65.69, bsiInter: 32.85, bsiFin: 32.85,
            mau: 3.50, mie: 3.15, mdd: 8.35, mn: 9.15, msn: 19.50,
            ikPlaine: 0.35, ikMontagne: 0.50 },
    2024: { ami: 3.15, bsiInit: 65.69, bsiInter: 32.85, bsiFin: 32.85,
            mau: 3.50, mie: 3.15, mdd: 8.35, mn: 9.15, msn: 19.50,
            ikPlaine: 0.35, ikMontagne: 0.50 },
    2025: { ami: 3.15, bsiInit: 65.69, bsiInter: 32.85, bsiFin: 32.85,
            mau: 3.50, mie: 3.15, mdd: 8.35, mn: 9.15, msn: 19.50,
            ikPlaine: 0.35, ikMontagne: 0.50 },
    2026: { ami: 3.15, bsiInit: 65.69, bsiInter: 32.85, bsiFin: 32.85,
            mau: 3.50, mie: 3.15, mdd: 8.35, mn: 9.15, msn: 19.50,
            ikPlaine: 0.35, ikMontagne: 0.50 },
};

// Structure des actes (coefficients, catégories, descriptions)
const NGAP_STRUCTURE = [
    // SOINS GÉNÉRAUX
    { code:'AMI 1',    cat:'Soins généraux', desc:'Injection sous-cutanée ou intramusculaire (insuline, anticoagulant...)',          coeff:1,    type:'ami' },
    { code:'AMI 1,5',  cat:'Soins généraux', desc:'Prélèvement sanguin veineux au domicile du patient',                              coeff:1.5,  type:'ami' },
    { code:'AMI 2',    cat:'Soins généraux', desc:'Injection intraveineuse directe',                                                  coeff:2,    type:'ami' },
    { code:'AMI 2',    cat:'Soins généraux', desc:'Pansement simple — plaie superficielle, ablation de points',                      coeff:2,    type:'ami' },
    { code:'AMI 2',    cat:'Soins généraux', desc:'Soins de stomie urinaire ou digestive (entretien courant)',                        coeff:2,    type:'ami' },
    { code:'AMI 3',    cat:'Soins généraux', desc:'Pansement complexe — escarre stade 1-2, plaie chronique simple',                  coeff:3,    type:'ami' },
    { code:'AMI 3',    cat:'Soins généraux', desc:'Sondage vésical aller-retour chez la femme',                                       coeff:3,    type:'ami' },
    { code:'AMI 3',    cat:'Soins généraux', desc:'Pose de sonde naso-gastrique',                                                     coeff:3,    type:'ami' },
    { code:'AMI 3',    cat:'Soins généraux', desc:'Lavement évacuateur',                                                              coeff:3,    type:'ami' },
    { code:'AMI 3,5',  cat:'Soins généraux', desc:'Sondage vésical à demeure (homme) — pose et surveillance',                        coeff:3.5,  type:'ami' },
    { code:'AMI 4',    cat:'Soins généraux', desc:'Séance de soins infirmiers (SSI) — soins de base complets',                       coeff:4,    type:'ami' },
    { code:'AMI 4',    cat:'Soins généraux', desc:'Pansement très complexe — escarre stade 3-4, brûlure étendue',                   coeff:4,    type:'ami' },
    { code:'AMI 4',    cat:'Soins généraux', desc:'Pansement chirurgical complexe post-opératoire évolutif',                         coeff:4,    type:'ami' },
    { code:'AMI 4',    cat:'Soins généraux', desc:'Soins de trachéotomie (aspiration, pansement)',                                    coeff:4,    type:'ami' },
    { code:'AMI 6',    cat:'Soins généraux', desc:'Séance de soins palliatifs à domicile — nursing lourd',                           coeff:6,    type:'ami' },
    // PERFUSIONS
    { code:'AMI 4',    cat:'Perfusion',      desc:'Perfusion simple sous-cutanée (hypodermoclyse)',                                   coeff:4,    type:'ami' },
    { code:'AMI 8',    cat:'Perfusion',      desc:'Perfusion IV périphérique (durée < 1h)',                                           coeff:8,    type:'ami' },
    { code:'AMI 12',   cat:'Perfusion',      desc:'Perfusion IV longue durée (> 1h) ou nutrition parentérale',                        coeff:12,   type:'ami' },
    // PRÉLÈVEMENTS
    { code:'AMI 1,5',  cat:'Prélèvement',   desc:'Prélèvement sanguin veineux à domicile',                                           coeff:1.5,  type:'ami' },
    { code:'AMI 1',    cat:'Prélèvement',   desc:'Prélèvement capillaire (glycémie, INR, bandelette urinaire...)',                   coeff:1,    type:'ami' },
    { code:'AMI 2',    cat:'Prélèvement',   desc:'Prélèvement bactériologique (ECBU, plaie, gorge...)',                              coeff:2,    type:'ami' },
    // PSYCHIATRIE
    { code:'AIS 3',    cat:'Psychiatrie',    desc:'Séance de soins infirmiers psychiatriques (GIR 4-5-6)',                            coeff:3,    type:'ami' },
    { code:'AIS 5',    cat:'Psychiatrie',    desc:'Séance de soins infirmiers psychiatriques — dépendance lourde (GIR 1-2-3)',        coeff:5,    type:'ami' },
    // BILAN
    { code:'BSI Init.',cat:'Bilan',          desc:'Bilan de Soins Infirmiers — Évaluation initiale de la dépendance',                 coeff:null, type:'bsiInit' },
    { code:'BSI Inter.',cat:'Bilan',         desc:'Bilan de Soins Infirmiers — Réévaluation intermédiaire',                           coeff:null, type:'bsiInter' },
    { code:'BSI Fin',  cat:'Bilan',          desc:'Bilan de Soins Infirmiers — Bilan de fin de prise en charge',                      coeff:null, type:'bsiFin' },
    // MAJORATIONS
    { code:'MAU',      cat:'Majoration',     desc:'Majoration Acte Unique — seul acte lors du passage',                               coeff:null, type:'mau' },
    { code:'MIE',      cat:'Majoration',     desc:'Majoration Infirmière Exclusive — patient suivi uniquement par infirmière',         coeff:null, type:'mie' },
    { code:'MDD',      cat:'Majoration',     desc:'Majoration Dimanche et Jours Fériés',                                              coeff:null, type:'mdd' },
    { code:'MN',       cat:'Majoration',     desc:'Majoration Nuit (20h–minuit et 6h–8h)',                                            coeff:null, type:'mn' },
    { code:'MSN',      cat:'Majoration',     desc:'Majoration Nuit Profonde (minuit–6h)',                                              coeff:null, type:'msn' },
    // INDEMNITÉS
    { code:'IK Plaine',cat:'Indemnité',      desc:'Indemnité kilométrique — zone plate ou urbaine (par km)',                           coeff:null, type:'ikPlaine' },
    { code:'IK Montagne',cat:'Indemnité',    desc:'Indemnité kilométrique — zone montagneuse (par km)',                                coeff:null, type:'ikMontagne' },
];

let ngapStatut = 'titulaire';
let ngapAnnee = 2026;

function getTarifActe(acte, tarifs) {
    if (acte.type === 'ami') return acte.coeff * tarifs.ami;
    return tarifs[acte.type] || 0;
}

window.initNGAP = function() {
    construireSelecteurAnnees();
    window.filtrerNGAP();
    window.calculerSimulateurNGAP();
};

function construireSelecteurAnnees() {
    const sel = document.getElementById('ngapAnnee');
    if (!sel) return;
    const annees = Object.keys(NGAP_TARIFS_ANNEE).sort((a,b) => b-a);
    sel.innerHTML = annees.map(a =>
        `<option value="${a}" ${a==2026?'selected':''}>${a}</option>`
    ).join('');
}

window.changerAnneeNGAP = function() {
    const sel = document.getElementById('ngapAnnee');
    ngapAnnee = parseInt(sel?.value) || 2026;
    afficherValeurAMI();
    window.filtrerNGAP();
    window.calculerSimulateurNGAP();
};

function afficherValeurAMI() {
    const t = getTarifs();
    const el = document.getElementById('ngapValeurAMI');
    if(el) el.textContent = t.ami.toFixed(2).replace('.',',') + ' €';
}

function getTarifs() {
    const saved = localStorage.getItem(`ngap_tarifs_${ngapAnnee}`);
    if(saved) return JSON.parse(saved);
    return NGAP_TARIFS_ANNEE[ngapAnnee] || NGAP_TARIFS_ANNEE[2026];
}

window.setStatutNGAP = function(statut) {
    ngapStatut = statut;
    const btnT = document.getElementById('btnTitulaire');
    const btnR = document.getElementById('btnRemplacante');
    const info = document.getElementById('ngapInfoStatut');
    const bandeau = document.getElementById('bandeauRemplacante');
    const colR = document.getElementById('colRetro');
    if(btnT) { btnT.className = statut==='titulaire' ? 'btn-primary' : ''; btnT.style.cssText = statut==='titulaire' ? 'padding:8px 16px;' : 'background:#f1f5f9;border:1px solid #cbd5e1;color:#334155;padding:8px 16px;border-radius:6px;font-weight:600;cursor:pointer;'; }
    if(btnR) { btnR.style.cssText = statut==='remplacante' ? 'background:#2563eb;color:white;border:none;padding:8px 16px;border-radius:6px;font-weight:600;cursor:pointer;' : 'background:#f1f5f9;border:1px solid #cbd5e1;color:#334155;padding:8px 16px;border-radius:6px;font-weight:600;cursor:pointer;'; }
    if(info) info.textContent = statut==='titulaire' ? 'ℹ️ Titulaire : facturation directe à la CPAM' : 'ℹ️ Remplaçante : facture sous n° titulaire — reverse 30-40% en rétrocession';
    if(bandeau) bandeau.style.display = statut==='remplacante' ? 'block' : 'none';
    if(colR) colR.style.display = statut==='remplacante' ? 'table-cell' : 'none';
    window.filtrerNGAP();
};

window.filtrerNGAP = function() {
    const rech = (document.getElementById('ngapSearch')?.value || '').toLowerCase();
    const cat  = document.getElementById('ngapCategorie')?.value || '';
    const tarifs = getTarifs();
    const fmt = n => n.toFixed(2).replace('.',',') + ' €';

    const filtres = NGAP_STRUCTURE.filter(a =>
        (!cat || a.cat === cat) &&
        (!rech || a.code.toLowerCase().includes(rech) ||
                  a.desc.toLowerCase().includes(rech) ||
                  a.cat.toLowerCase().includes(rech))
    );

    const tbody = document.getElementById('ngapTbody');
    if(!tbody) return;
    if(!filtres.length) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#94a3b8;padding:20px;">Aucun acte trouvé</td></tr>';
        return;
    }

    const couleurs = {
        'Soins généraux':'#eff6ff','Psychiatrie':'#faf5ff','Bilan':'#f0fdf4',
        'Prélèvement':'#fffbeb','Perfusion':'#fff5f5','Majoration':'#f8fafc','Indemnité':'#f8fafc'
    };

    tbody.innerHTML = filtres.map(a => {
        const tarif = getTarifActe(a, tarifs);
        const remb  = fmt(tarif * 0.60);
        const retro = fmt(tarif * 0.65);
        const col   = couleurs[a.cat] || '#fff';
        return `<tr style="border-bottom:1px solid #e2e8f0;">
            <td><code style="background:#e2e8f0;padding:2px 6px;border-radius:4px;font-size:12px;font-weight:bold;">${a.code}</code></td>
            <td style="font-size:13px;">${a.desc}</td>
            <td style="text-align:center;color:#94a3b8;font-size:13px;">${a.coeff !== null ? '×'+a.coeff : '—'}</td>
            <td style="text-align:right;font-weight:600;color:#2563eb;">${fmt(tarif)}</td>
            <td style="text-align:right;color:#16a34a;font-size:13px;">${remb}</td>
            ${ngapStatut==='remplacante' ? `<td style="text-align:right;color:#92400e;font-size:13px;">${retro}</td>` : ''}
            <td><span style="background:${col};padding:2px 8px;border-radius:10px;font-size:11px;">${a.cat}</span></td>
        </tr>`;
    }).join('');

    afficherValeurAMI();
};

window.calculerSimulateurNGAP = function() {
    const nb    = parseFloat(document.getElementById('simNbPassages')?.value) || 0;
    const tarif = parseFloat(document.getElementById('simActePrincipal')?.value) || 0;
    const jours = parseFloat(document.getElementById('simNbJours')?.value) || 0;
    const pct   = (parseFloat(document.getElementById('simPctMajo')?.value) || 0) / 100;
    const t     = getTarifs();
    const majoMoy = t.mdd * 0.5 + t.mn * 0.5;
    const mois  = (nb * tarif + nb * pct * majoMoy) * jours;
    const annuel = mois * 12;
    const retro  = mois * 0.65;
    const fmt = n => Math.round(n).toLocaleString('fr-FR') + ' €';
    const el = id => document.getElementById(id);
    if(el('simCaMensuel'))  el('simCaMensuel').textContent  = fmt(mois);
    if(el('simCaAnnuel'))   el('simCaAnnuel').textContent   = fmt(annuel);
    if(el('simApresRetro')) el('simApresRetro').textContent = fmt(retro) + '/mois';
};

// Édition des tarifs personnalisés
window.ouvrirEditionTarifs = function() {
    const t = getTarifs();
    const modal = document.getElementById('ngapModalTarifs');
    if(!modal) return;
    document.getElementById('edit_ami').value      = t.ami;
    document.getElementById('edit_bsiInit').value  = t.bsiInit;
    document.getElementById('edit_bsiInter').value = t.bsiInter;
    document.getElementById('edit_bsiFin').value   = t.bsiFin;
    document.getElementById('edit_mau').value      = t.mau;
    document.getElementById('edit_mie').value      = t.mie;
    document.getElementById('edit_mdd').value      = t.mdd;
    document.getElementById('edit_mn').value        = t.mn;
    document.getElementById('edit_msn').value      = t.msn;
    document.getElementById('edit_ikPlaine').value = t.ikPlaine;
    document.getElementById('edit_ikMontagne').value = t.ikMontagne;
    modal.style.display = 'flex';
};

window.sauvegarderTarifsNGAP = function() {
    const val = id => parseFloat(document.getElementById(id)?.value) || 0;
    const t = {
        ami: val('edit_ami'), bsiInit: val('edit_bsiInit'), bsiInter: val('edit_bsiInter'),
        bsiFin: val('edit_bsiFin'), mau: val('edit_mau'), mie: val('edit_mie'),
        mdd: val('edit_mdd'), mn: val('edit_mn'), msn: val('edit_msn'),
        ikPlaine: val('edit_ikPlaine'), ikMontagne: val('edit_ikMontagne')
    };
    localStorage.setItem(`ngap_tarifs_${ngapAnnee}`, JSON.stringify(t));
    document.getElementById('ngapModalTarifs').style.display = 'none';
    window.filtrerNGAP();
    window.calculerSimulateurNGAP();
};

window.resetTarifsNGAP = function() {
    if(!confirm(`Réinitialiser les tarifs ${ngapAnnee} aux valeurs officielles ?`)) return;
    localStorage.removeItem(`ngap_tarifs_${ngapAnnee}`);
    window.filtrerNGAP();
    document.getElementById('ngapModalTarifs').style.display = 'none';
};

window.fermerModalNGAP = function() {
    document.getElementById('ngapModalTarifs').style.display = 'none';
};

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => { if(typeof window.initNGAP==='function') window.initNGAP(); }, 800);
});
