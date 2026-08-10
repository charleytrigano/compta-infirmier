/**
 * Application de Gestion Comptable - Professionnels de Santé
 */

// Constantes réglementaires
const PASS_VALEUR = 46368; // Plafond Annuel de la Sécurité Sociale

// Mémoire des transactions
let currentTransactions = [];

/**
 * GESTION DE LA NAVIGATION PAR ONGLETS
 * @param {string} tabId - L'ID du bloc de contenu à afficher
 * @param {HTMLElement} elementClique - L'élément de menu sur lequel l'utilisateur a cliqué
 */
function changerOnglet(tabId, elementClique) {
    // 1. Masquer tous les contenus d'onglets
    const tousLesContenus = document.querySelectorAll('.tab-content');
    tousLesContenus.forEach(c => c.classList.remove('active'));

    // 2. Désactiver le style de tous les boutons de navigation
    const tousLesOnglets = document.querySelectorAll('.nav-tab-item');
    tousLesOnglets.forEach(o => o.classList.remove('active'));

    // 3. Activer le contenu de l'onglet ciblé
    const ongletCible = document.getElementById(tabId);
    if (ongletCible) {
        ongletCible.classList.add('active');
    }

    // 4. Appliquer le style actif au bouton cliqué
    if (elementClique) {
        elementClique.classList.add('active');
    }
}

/**
 * Fonction utilitaire pour mettre à jour un texte DOM
 */
function setTxt(elementId, texte) {
    const el = document.getElementById(elementId);
    if (el) {
        el.textContent = texte;
    }
}

/**
 * Extraction de l'année d'une date (YYYY-MM-DD)
 */
function parseDate(dateString) {
    if (!dateString) return { year: 'all' };
    const parts = dateString.split('-');
    return { year: parts[0] };
}

/**
 * Gestion des Transactions : Ajouter une transaction
 */
function ajouterTransaction() {
    const date = document.getElementById('tDate').value;
    const type = document.getElementById('tType').value;
    const montant = parseFloat(document.getElementById('tMontant').value);
    const libelle = document.getElementById('tLibelle').value;

    if (!date || isNaN(montant) || montant <= 0) {
        alert('Veuillez remplir correctement la date et le montant.');
        return;
    }

    // Ajout dans le tableau
    currentTransactions.push({
        date: date,
        type: type,
        amount: montant,
        label: libelle || (type === 'recette' ? 'Honoraires' : 'Dépense divers')
    });

    // Réinitialisation des champs de saisie
    document.getElementById('tMontant').value = '';
    document.getElementById('tLibelle').value = '';

    // Mettre à jour l'affichage
    afficherTransactions();
    genererDeclarations(false);
}

/**
 * Affiche la liste des transactions dans le tableau de l'onglet 1
 */
function afficherTransactions() {
    const tbody = document.getElementById('listeTransactions');
    if (!tbody) return;

    if (currentTransactions.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Aucune transaction enregistrée.</td></tr>';
        return;
    }

    tbody.innerHTML = '';
    currentTransactions.forEach(t => {
        const tr = document.createElement('tr');
        const couleurMontant = t.type === 'recette' ? 'green' : 'red';
        const signe = t.type === 'recette' ? '+' : '-';

        tr.innerHTML = `
            <td>${t.date}</td>
            <td><strong>${t.type.toUpperCase()}</strong></td>
            <td>${t.label}</td>
            <td style="color:${couleurMontant}; font-weight:bold;">${signe} ${t.amount.toFixed(2)} €</td>
        `;
        tbody.appendChild(tr);
    });
}

/**
 * Moteur de calcul URSSAF PAMC
 */
function calculerDetailURSSAF(bnc, estRemplacant = false) {
    const bncVal = Math.max(0, parseFloat(bnc) || 0);

    const baseCsg = bncVal;
    const mCsg = baseCsg * 0.097;

    const baseMaladie = bncVal;
    const mMaladie = baseMaladie * 0.001;

    const plancherIJ = PASS_VALEUR * 0.40;
    const baseIj = Math.max(bncVal, plancherIJ);
    const mIj = baseIj * 0.003;

    const seuilBas = PASS_VALEUR * 1.10;
    const seuilHaut = PASS_VALEUR * 1.40;
    let tauxAlloc = 0;

    if (bncVal > seuilHaut) {
        tauxAlloc = 0.031;
    } else if (bncVal > seuilBas) {
        tauxAlloc = 0.031 * ((bncVal - seuilBas) / (seuilHaut - seuilBas));
    }

    const baseAlloc = bncVal;
    const mAlloc = baseAlloc * tauxAlloc;

    let baseCurps = bncVal;
    let mCurps = 0;
    if (!estRemplacant) {
        mCurps = Math.min(baseCurps * 0.001, PASS_VALEUR * 0.005);
    } else {
        baseCurps = 0;
    }

    const mCfp = PASS_VALEUR * 0.0025;

    const totalAnnuel = mCsg + mMaladie + mIj + mAlloc + mCurps + mCfp;
    const totalTrimestriel = totalAnnuel / 4;

    return {
        bncAssiette: bncVal,
        baseCsg, mCsg,
        baseMaladie, mMaladie,
        baseIj, mIj,
        baseAlloc, tauxAlloc, mAlloc,
        baseCurps, mCurps,
        mCfp,
        totalAnnuel,
        totalTrimestriel
    };
}

/**
 * Met à jour les calculs comptables et fiscaux
 */
function genererDeclarations(saisieManuelle = false) {
    const selectEl = document.getElementById('exerciceDeclSelect');
    const inputBnc = document.getElementById('inputBncUrssaf');
    const anneeSelect = selectEl ? selectEl.value : 'all';
    const estRemplacant = document.getElementById('urssafRemplacant')?.checked || false;

    let bncFinal = 0;
    let caBrut = 0;

    // Calcul du CA Brut depuis les transactions
    currentTransactions.forEach(t => {
        if (!t.date) return;
        const { year } = parseDate(t.date);
        if (anneeSelect !== 'all' && year !== anneeSelect) return;

        if (t.type === 'recette') caBrut += Number(t.amount || 0);
    });

    if (saisieManuelle && inputBnc && inputBnc.value !== '') {
        bncFinal = parseFloat(inputBnc.value) || 0;
    } else {
        let totalDepenses = 0;
        currentTransactions.forEach(t => {
            if (!t.date) return;
            const { year } = parseDate(t.date);
            if (anneeSelect !== 'all' && year !== anneeSelect) return;

            if (t.type === 'depense') totalDepenses += Number(t.amount || 0);
        });

        bncFinal = Math.max(0, caBrut - totalDepenses);
        if (inputBnc) {
            inputBnc.value = bncFinal > 0 ? bncFinal : '';
        }
    }

    // Calcul URSSAF
    const res = calculerDetailURSSAF(bncFinal, estRemplacant);

    // Mises à jour DOM
    setTxt('urssafBncAssiette', res.bncAssiette.toFixed(2) + ' €');

    setTxt('uBaseCsg', res.baseCsg.toFixed(2) + ' €');
    setTxt('uMontantCsg', res.mCsg.toFixed(2) + ' €');

    setTxt('uBaseMaladie', res.baseMaladie.toFixed(2) + ' €');
    setTxt('uMontantMaladie', res.mMaladie.toFixed(2) + ' €');

    setTxt('uBaseIj', res.baseIj.toFixed(2) + ' €');
    setTxt('uMontantIj', res.mIj.toFixed(2) + ' €');

    setTxt('uBaseAlloc', res.baseAlloc.toFixed(2) + ' €');
    setTxt('uTauxAlloc', (res.tauxAlloc * 100).toFixed(2) + ' %');
    setTxt('uMontantAlloc', res.mAlloc.toFixed(2) + ' €');

    setTxt('uBaseCurps', res.baseCurps.toFixed(2) + ' €');
    setTxt('uMontantCurps', res.mCurps.toFixed(2) + ' €');

    setTxt('uMontantCfp', res.mCfp.toFixed(2) + ' €');

    setTxt('uTotalAnnuel', res.totalAnnuel.toFixed(2) + ' €');

    const trim = res.totalTrimestriel;
    setTxt('urssafT1', trim.toFixed(2) + ' €');
    setTxt('urssafT2', trim.toFixed(2) + ' €');
    setTxt('urssafT3', trim.toFixed(2) + ' €');
    setTxt('urssafT4', trim.toFixed(2) + ' €');

    // Mise à jour Bilan Fiscal
    setTxt('microCA', caBrut.toFixed(2) + ' €');
    setTxt('microAbattement', (caBrut * 0.34).toFixed(2) + ' €');
    setTxt('microImposable', (caBrut * 0.66).toFixed(2) + ' €');

    setTxt('reelCA', caBrut.toFixed(2) + ' €');
    setTxt('reelDepenses', Math.max(0, caBrut - bncFinal).toFixed(2) + ' €');
    setTxt('reelBenefice', bncFinal.toFixed(2) + ' €');
}

function actualiserCalculsUrssaf() {
    genererDeclarations(false);
}

// Initialisation par défaut
document.addEventListener('DOMContentLoaded', () => {
    // Date du jour par défaut dans le formulaire de transaction
    const inputDate = document.getElementById('tDate');
    if (inputDate) {
        inputDate.value = new Date().toISOString().split('T')[0];
    }
    genererDeclarations(false);
});
