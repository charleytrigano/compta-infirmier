/**
 * Application de Gestion Comptable Intégrale - Infirmier Libéral
 */

const PASS_VALEUR = 46368; // Plafond Annuel Sécurité Sociale
let currentTransactions = [];

/**
 * Gestion du changement d'onglet
 */
function changerOnglet(tabId, elementClique) {
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.querySelectorAll('.nav-tab-item').forEach(o => o.classList.remove('active'));

    const cible = document.getElementById(tabId);
    if (cible) cible.classList.add('active');
    if (elementClique) elementClique.classList.add('active');
}

function setTxt(id, txt) {
    const el = document.getElementById(id);
    if (el) el.textContent = txt;
}

/**
 * Ajouter une transaction
 */
function ajouterTransaction() {
    const date = document.getElementById('tDate').value;
    const type = document.getElementById('tType').value;
    const montant = parseFloat(document.getElementById('tMontant').value);
    const libelle = document.getElementById('tLibelle').value;

    if (!date || isNaN(montant) || montant <= 0) {
        alert('Veuillez renseigner une date et un montant valide.');
        return;
    }

    currentTransactions.push({ id: Date.now(), date, type, amount: montant, label: libelle || type });

    document.getElementById('tMontant').value = '';
    document.getElementById('tLibelle').value = '';

    afficherTransactions();
    calculerTout(false);
}

/**
 * Supprimer une transaction
 */
function supprimerTransaction(id) {
    currentTransactions = currentTransactions.filter(t => t.id !== id);
    afficherTransactions();
    calculerTout(false);
}

/**
 * Affichage des transactions dans le tableau
 */
function afficherTransactions() {
    const tbody = document.getElementById('listeTransactions');
    if (!tbody) return;

    if (currentTransactions.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Aucune transaction enregistrée.</td></tr>';
        return;
    }

    tbody.innerHTML = '';
    currentTransactions.forEach(t => {
        const tr = document.createElement('tr');
        const couleur = t.type === 'recette' ? 'green' : 'red';
        const signe = t.type === 'recette' ? '+' : '-';

        tr.innerHTML = `
            <td>${t.date}</td>
            <td><strong>${t.type.toUpperCase()}</strong></td>
            <td>${t.label}</td>
            <td style="color:${couleur}; font-weight:bold;">${signe} ${t.amount.toFixed(2)} €</td>
            <td><button class="btn btn-danger" onclick="supprimerTransaction(${t.id})">❌</button></td>
        `;
        tbody.appendChild(tr);
    });
}

/**
 * CALCUL URSSAF
 */
function calculerURSSAF(bnc, estRemplacant) {
    const baseCsg = bnc;
    const mCsg = baseCsg * 0.097;

    const baseMaladie = bnc;
    const mMaladie = baseMaladie * 0.001;

    const baseIj = Math.max(bnc, PASS_VALEUR * 0.40);
    const mIj = baseIj * 0.003;

    const seuilBas = PASS_VALEUR * 1.10;
    const seuilHaut = PASS_VALEUR * 1.40;
    let tauxAlloc = 0;
    if (bnc > seuilHaut) tauxAlloc = 0.031;
    else if (bnc > seuilBas) tauxAlloc = 0.031 * ((bnc - seuilBas) / (seuilHaut - seuilBas));

    const mAlloc = bnc * tauxAlloc;
    const mCurps = estRemplacant ? 0 : Math.min(bnc * 0.001, PASS_VALEUR * 0.005);
    const mCfp = PASS_VALEUR * 0.0025;

    const total = mCsg + mMaladie + mIj + mAlloc + mCurps + mCfp;
    return { bnc, baseCsg, mCsg, baseMaladie, mMaladie, baseIj, mIj, baseAlloc: bnc, tauxAlloc, mAlloc, baseCurps: estRemplacant ? 0 : bnc, mCurps, mCfp, total };
}

/**
 * CALCUL CARPIMKO
 */
function calculerCARPIMKO(bnc) {
    // 1. Régime de Base
    const t1 = Math.min(bnc, PASS_VALEUR) * 0.0823;
    const t2 = Math.min(Math.max(0, bnc - PASS_VALEUR), PASS_VALEUR * 4) * 0.0187;
    const mBase = t1 + t2;

    // 2. Régime Complémentaire (Forfait + Proportionnel)
    const mComp = 1976 + (bnc * 0.03);

    // 3. ASV (Prise en charge partielle CPAM en PAMC)
    const mAsv = 580 + (bnc * 0.004);

    // 4. Invalidité - Décès (Classe A)
    const mId = 890;

    const total = mBase + mComp + mAsv + mId;
    return { mBase, mComp, mAsv, mId, total };
}

/**
 * MOTEUR GLOBAL DE CALCUL ET REFRESH IHM
 */
function calculerTout(saisieManuelle = false) {
    const inputBnc = document.getElementById('inputBncUrssaf');
    const estRemplacant = document.getElementById('urssafRemplacant')?.checked || false;

    let caBrut = 0;
    let depenses = 0;

    currentTransactions.forEach(t => {
        if (t.type === 'recette') caBrut += t.amount;
        else if (t.type === 'depense') depenses += t.amount;
    });

    let bnc = 0;
    if (saisieManuelle && inputBnc && inputBnc.value !== '') {
        bnc = parseFloat(inputBnc.value) || 0;
    } else {
        bnc = Math.max(0, caBrut - depenses);
        if (inputBnc) inputBnc.value = bnc > 0 ? bnc : '';
    }

    // --- MISE À JOUR URSSAF ---
    const u = calculerURSSAF(bnc, estRemplacant);
    setTxt('urssafBncAssiette', u.bnc.toFixed(2) + ' €');
    setTxt('uBaseCsg', u.baseCsg.toFixed(2) + ' €');
    setTxt('uMontantCsg', u.mCsg.toFixed(2) + ' €');
    setTxt('uBaseMaladie', u.baseMaladie.toFixed(2) + ' €');
    setTxt('uMontantMaladie', u.mMaladie.toFixed(2) + ' €');
    setTxt('uBaseIj', u.baseIj.toFixed(2) + ' €');
    setTxt('uMontantIj', u.mIj.toFixed(2) + ' €');
    setTxt('uBaseAlloc', u.baseAlloc.toFixed(2) + ' €');
    setTxt('uTauxAlloc', (u.tauxAlloc * 100).toFixed(2) + ' %');
    setTxt('uMontantAlloc', u.mAlloc.toFixed(2) + ' €');
    setTxt('uBaseCurps', u.baseCurps.toFixed(2) + ' €');
    setTxt('uMontantCurps', u.mCurps.toFixed(2) + ' €');
    setTxt('uMontantCfp', u.mCfp.toFixed(2) + ' €');
    setTxt('uTotalAnnuel', u.total.toFixed(2) + ' €');

    const uTrim = u.total / 4;
    setTxt('urssafT1', uTrim.toFixed(2) + ' €');
    setTxt('urssafT2', uTrim.toFixed(2) + ' €');
    setTxt('urssafT3', uTrim.toFixed(2) + ' €');
    setTxt('urssafT4', uTrim.toFixed(2) + ' €');

    // --- MISE À JOUR CARPIMKO ---
    const c = calculerCARPIMKO(bnc);
    setTxt('carpimkoBncAssiette', bnc.toFixed(2) + ' €');
    setTxt('cMontantBase', c.mBase.toFixed(2) + ' €');
    setTxt('cMontantComp', c.mComp.toFixed(2) + ' €');
    setTxt('cMontantAsv', c.mAsv.toFixed(2) + ' €');
    setTxt('cMontantId', c.mId.toFixed(2) + ' €');
    setTxt('cTotalAnnuel', c.total.toFixed(2) + ' €');

    const cTrim = c.total / 4;
    setTxt('carpimkoT1', cTrim.toFixed(2) + ' €');
    setTxt('carpimkoT2', cTrim.toFixed(2) + ' €');
    setTxt('carpimkoT3', cTrim.toFixed(2) + ' €');
    setTxt('carpimkoT4', cTrim.toFixed(2) + ' €');

    // --- MISE À JOUR FISCALITÉ ---
    setTxt('microCA', caBrut.toFixed(2) + ' €');
    setTxt('microAbattement', (caBrut * 0.34).toFixed(2) + ' €');
    setTxt('microImposable', (caBrut * 0.66).toFixed(2) + ' €');

    setTxt('reelCA', caBrut.toFixed(2) + ' €');
    setTxt('reelDepenses', depenses.toFixed(2) + ' €');
    setTxt('reelBenefice', bnc.toFixed(2) + ' €');
}

// Initialisation au chargement
document.addEventListener('DOMContentLoaded', () => {
    const inputDate = document.getElementById('tDate');
    if (inputDate) inputDate.value = new Date().toISOString().split('T')[0];
    calculerTout(false);
});
