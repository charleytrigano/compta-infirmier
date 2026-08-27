// ============================================================================
// ngap.js — Nomenclature NGAP Infirmières Libérales 2025-2026
// ============================================================================

const NGAP_ACTES = [
    { code:'AMI 1',   categorie:'Soins généraux', description:'Injection sous-cutanée ou intramusculaire (insuline, anticoagulant...)', coeff:1,   tarif:3.15 },
    { code:'AMI 1,5', categorie:'Soins généraux', description:'Prélèvement sanguin veineux au domicile du patient', coeff:1.5, tarif:4.73 },
    { code:'AMI 2',   categorie:'Soins généraux', description:'Injection intraveineuse directe', coeff:2, tarif:6.30 },
    { code:'AMI 2',   categorie:'Soins généraux', description:'Pansement simple (plaie superficielle, ablation de points)', coeff:2, tarif:6.30 },
    { code:'AMI 2',   categorie:'Soins généraux', description:'Soins de stomie urinaire ou digestive (entretien)', coeff:2, tarif:6.30 },
    { code:'AMI 3',   categorie:'Soins généraux', description:'Pansement complexe : escarre stade 1-2, plaie chronique simple', coeff:3, tarif:9.45 },
    { code:'AMI 3',   categorie:'Soins généraux', description:'Sondage vésical aller-retour chez la femme', coeff:3, tarif:9.45 },
    { code:'AMI 3',   categorie:'Soins généraux', description:'Pose de sonde naso-gastrique', coeff:3, tarif:9.45 },
    { code:'AMI 3',   categorie:'Soins généraux', description:'Lavement évacuateur', coeff:3, tarif:9.45 },
    { code:'AMI 3,5', categorie:'Soins généraux', description:'Sondage vésical à demeure (homme) — pose et surveillance', coeff:3.5, tarif:11.03 },
    { code:'AMI 4',   categorie:'Soins généraux', description:'Séance de soins infirmiers (SSI) — soins de base complets', coeff:4, tarif:12.60 },
    { code:'AMI 4',   categorie:'Soins généraux', description:'Pansement très complexe : escarre stade 3-4, brûlure étendue', coeff:4, tarif:12.60 },
    { code:'AMI 4',   categorie:'Soins généraux', description:'Pansement chirurgical complexe post-opératoire évolutif', coeff:4, tarif:12.60 },
    { code:'AMI 4',   categorie:'Soins généraux', description:'Soins de trachéotomie (aspiration, pansement)', coeff:4, tarif:12.60 },
    { code:'AMI 6',   categorie:'Soins généraux', description:'Séance de soins palliatifs à domicile (nursing lourd)', coeff:6, tarif:18.90 },
    { code:'AMI 4',   categorie:'Perfusion', description:'Perfusion simple sous-cutanée (hypodermoclyse)', coeff:4, tarif:12.60 },
    { code:'AMI 8',   categorie:'Perfusion', description:'Perfusion IV périphérique (durée < 1h)', coeff:8, tarif:25.20 },
    { code:'AMI 12',  categorie:'Perfusion', description:'Perfusion IV longue durée (> 1h) ou nutrition parentérale', coeff:12, tarif:37.80 },
    { code:'AMI 1,5', categorie:'Prélèvement', description:'Prélèvement sanguin veineux (prise de sang à domicile)', coeff:1.5, tarif:4.73 },
    { code:'AMI 1',   categorie:'Prélèvement', description:'Prélèvement capillaire (glycémie, INR...)', coeff:1, tarif:3.15 },
    { code:'AMI 2',   categorie:'Prélèvement', description:'Prélèvement bactériologique (ECBU, plaie, gorge...)', coeff:2, tarif:6.30 },
    { code:'AIS 3',   categorie:'Psychiatrie', description:'Séance de soins infirmiers psychiatriques (GIR 4-5-6)', coeff:3, tarif:9.45 },
    { code:'AIS 5',   categorie:'Psychiatrie', description:'Séance de soins infirmiers psychiatriques (GIR 1-2-3, dépendance lourde)', coeff:5, tarif:15.75 },
    { code:'BSI Init.',categorie:'Bilan', description:'Bilan de Soins Infirmiers — Évaluation initiale de la dépendance', coeff:null, tarif:65.69 },
    { code:'BSI Inter.',categorie:'Bilan', description:'Bilan de Soins Infirmiers — Réévaluation intermédiaire', coeff:null, tarif:32.85 },
    { code:'BSI Fin', categorie:'Bilan', description:'Bilan de Soins Infirmiers — Bilan de fin de prise en charge', coeff:null, tarif:32.85 },
    { code:'MAU',     categorie:'Majoration', description:'Majoration Acte Unique : seul acte lors du passage', coeff:null, tarif:3.50 },
    { code:'MIE',     categorie:'Majoration', description:'Majoration Infirmière Exclusive : patient suivi uniquement par infirmière', coeff:null, tarif:3.15 },
    { code:'MDD',     categorie:'Majoration', description:'Majoration Dimanche et Jours Fériés', coeff:null, tarif:8.35 },
    { code:'MN',      categorie:'Majoration', description:'Majoration Nuit (20h–minuit et 6h–8h)', coeff:null, tarif:9.15 },
    { code:'MSN',     categorie:'Majoration', description:'Majoration Nuit Profonde (minuit–6h)', coeff:null, tarif:19.50 },
    { code:'IK Plaine',  categorie:'Indemnité', description:'Indemnité kilométrique — zone plate ou urbaine', coeff:null, tarif:0.35 },
    { code:'IK Montagne',categorie:'Indemnité', description:'Indemnité kilométrique — zone montagneuse', coeff:null, tarif:0.50 },
];

let ngapStatut = 'titulaire';

window.setStatutNGAP = function(statut) {
    ngapStatut = statut;
    const btnT = document.getElementById('btnTitulaire');
    const btnR = document.getElementById('btnRemplacante');
    const info = document.getElementById('ngapInfoStatut');
    const bandeau = document.getElementById('bandeauRemplacante');
    const colR = document.getElementById('colRetro');
    if(btnT) { btnT.style.background = statut==='titulaire' ? '#2563eb' : '#f1f5f9'; btnT.style.color = statut==='titulaire' ? 'white' : '#334155'; }
    if(btnR) { btnR.style.background = statut==='remplacante' ? '#2563eb' : '#f1f5f9'; btnR.style.color = statut==='remplacante' ? 'white' : '#334155'; }
    if(info) info.textContent = statut==='titulaire' ? 'ℹ️ Titulaire : facturation directe à la CPAM' : 'ℹ️ Remplaçante : facture sous n° titulaire — reverse 30-40% rétrocession';
    if(bandeau) bandeau.style.display = statut==='remplacante' ? 'block' : 'none';
    if(colR) colR.style.display = statut==='remplacante' ? 'table-cell' : 'none';
    window.filtrerNGAP();
};

window.filtrerNGAP = function() {
    const rech = (document.getElementById('ngapSearch')?.value || '').toLowerCase();
    const cat = document.getElementById('ngapCategorie')?.value || '';
    const filtres = NGAP_ACTES.filter(a =>
        (!cat || a.categorie === cat) &&
        (!rech || a.code.toLowerCase().includes(rech) || a.description.toLowerCase().includes(rech) || a.categorie.toLowerCase().includes(rech))
    );
    const tbody = document.getElementById('ngapTbody');
    if(!tbody) return;
    if(!filtres.length) { tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#94a3b8;padding:20px;">Aucun acte trouvé</td></tr>'; return; }
    const fmt = n => n.toFixed(2).replace('.',',') + ' €';
    const couleurs = {'Soins généraux':'#eff6ff','Psychiatrie':'#faf5ff','Bilan':'#f0fdf4','Prélèvement':'#fffbeb','Perfusion':'#fff5f5','Majoration':'#f8fafc','Indemnité':'#f8fafc'};
    tbody.innerHTML = filtres.map(a => {
        const retro = fmt(a.tarif * 0.65);
        const remb = fmt(a.tarif * 0.60);
        const col = couleurs[a.categorie] || '#fff';
        return `<tr style="border-bottom:1px solid #e2e8f0;">
            <td><code style="background:#e2e8f0;padding:2px 6px;border-radius:4px;font-size:12px;font-weight:bold;">${a.code}</code></td>
            <td style="font-size:13px;">${a.description}</td>
            <td style="text-align:center;color:#94a3b8;font-size:13px;">${a.coeff !== null ? '×'+a.coeff : '—'}</td>
            <td style="text-align:right;font-weight:600;color:#2563eb;">${fmt(a.tarif)}</td>
            <td style="text-align:right;color:#16a34a;font-size:13px;">${remb}</td>
            ${ngapStatut==='remplacante' ? `<td style="text-align:right;color:#92400e;font-size:13px;">${retro}</td>` : ''}
            <td><span style="background:${col};padding:2px 8px;border-radius:10px;font-size:11px;">${a.categorie}</span></td>
        </tr>`;
    }).join('');
};

window.calculerSimulateurNGAP = function() {
    const nb = parseFloat(document.getElementById('simNbPassages')?.value) || 0;
    const tarif = parseFloat(document.getElementById('simActePrincipal')?.value) || 0;
    const jours = parseFloat(document.getElementById('simNbJours')?.value) || 0;
    const pct = (parseFloat(document.getElementById('simPctMajo')?.value) || 0) / 100;
    const majo = 8.75;
    const mois = (nb * tarif + nb * pct * majo) * jours;
    const annuel = mois * 12;
    const retro = mois * 0.65;
    const fmt = n => Math.round(n).toLocaleString('fr-FR') + ' €';
    const el = id => document.getElementById(id);
    if(el('simCaMensuel')) el('simCaMensuel').textContent = fmt(mois);
    if(el('simCaAnnuel')) el('simCaAnnuel').textContent = fmt(annuel);
    if(el('simApresRetro')) el('simApresRetro').textContent = fmt(retro) + '/mois';
};

// Init au chargement de l'onglet
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => { if(typeof window.filtrerNGAP==='function') window.filtrerNGAP(); }, 800);
});
