/**
 * Application de Gestion Comptable URSSAF (Régime PAMC)
 */

// Constantes réglementaires
const PASS_VALEUR = 46368; // Plafond Annuel de la Sécurité Sociale

// Liste des transactions comptables (pour le calcul automatique si renseigné)
let currentTransactions = [];

/**
 * Fonction utilitaire pour mettre à jour un texte DOM en toute sécurité
 */
function setTxt(elementId, texte) {
    const el = document.getElementById(elementId);
    if (el) {
        el.textContent = texte;
    }
}

/**
 * Analyse une date au format YYYY-MM-DD
 */
function parseDate(dateString) {
    if (!dateString) return { year: 'all' };
    const parts = dateString.split('-');
    return { year: parts[0] };
}

/**
 * Moteur de calcul détaillé des Cotisations URSSAF PAMC
 * @param {number} bnc - Bénéfice Net Comptable
 * @param {boolean} estRemplacant - Indique si exonération CURPS
 */
function calculerDetailURSSAF(bnc, estRemplacant = false) {
    const bncVal = Math.max(0, parseFloat(bnc) || 0);

    // 1. CSG / CRDS (9.70% appliqué sur le BNC)
    const baseCsg = bncVal;
    const mCsg = baseCsg * 0.097;

    // 2. Assurance Maladie (0.10% à charge du praticien PAMC)
    const baseMaladie = bncVal;
    const mMaladie = baseMaladie * 0.001;

    // 3. Indemnités Journalières (IJ) (0.30%, assiette plancher à 40% PASS = 18 547.20 €)
    const plancherIJ = PASS_VALEUR * 0.40;
    const baseIj = Math.max(bncVal, plancherIJ);
    const mIj = baseIj * 0.003;

    // 4. Allocations Familiales (Taux progressif de 0% à 3.10%)
    const seuilBas = PASS_VALEUR * 1.10; // ~51 004 €
    const seuilHaut = PASS_VALEUR * 1.40; // ~64 915 €
    let tauxAlloc = 0;

    if (bncVal > seuilHaut) {
        tauxAlloc = 0.031;
    } else if (bncVal > seuilBas) {
        tauxAlloc = 0.031 * ((bncVal - seuilBas) / (seuilHaut - seuilBas));
    } else {
        tauxAlloc = 0.0;
    }

    const baseAlloc = bncVal;
    const mAlloc = baseAlloc * tauxAlloc;

    // 5. CURPS (0.10%, plafonné à 0.5% du PASS = 231.84 €)
    let baseCurps = bncVal;
    let mCurps = 0;
    if (!estRemplacant) {
        mCurps = Math.min(baseCurps * 0.001, PASS_VALEUR * 0.005);
    } else {
        baseCurps = 0;
    }

    // 6. Formation Professionnelle (CFP) (0.25% fixe du PASS = 115.92 €)
    const mCfp = PASS_VALEUR * 0.0025;

    // Total des cotisations
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
 * Calcule et met à jour l'ensemble de l'IHM
 * @param {boolean} saisieManuelle - Indique si le champ BNC a été modifié manuellement
 */
function genererDeclarations(saisieManuelle = false) {
    const selectEl = document.getElementById('exerciceDeclSelect');
    const inputBnc = document.getElementById('inputBncUrssaf');
    const anneeSelect = selectEl ? selectEl.value : 'all';
    const estRemplacant = document.getElementById('urssafRemplacant')?.checked || false;

    let bncFinal = 0;

    if (saisieManuelle && inputBnc && inputBnc.value !== '') {
        // Lecture directe depuis l'input utilisateur
        bncFinal = parseFloat(inputBnc.value) || 0;
    } else {
        // Calcul automatique depuis la liste de transactions
        let totalRecettes = 0;
        let totalDepenses = 0;

        currentTransactions.forEach(t => {
            if (!t.date) return;
            const { year } = parseDate(t.date);

            if (anneeSelect !== 'all' && year !== anneeSelect) return;

            const montant = Number(t.amount || 0);
            if (t.type === 'recette') totalRecettes += montant;
            else if (t.type === 'depense') totalDepenses += montant;
        });

        bncFinal = Math.max(0, totalRecettes - totalDepenses);
        if (inputBnc) {
            inputBnc.value = bncFinal > 0 ? bncFinal : '';
        }
    }

    // Exécution du calcul
    const res = calculerDetailURSSAF(bncFinal, estRemplacant);

    // Mise à jour de l'affichage du tableau
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

    // Mise à jour des échéances trimestrielles
    const trim = res.totalTrimestriel;
    setTxt('urssafT1', trim.toFixed(2) + ' €');
    setTxt('urssafT2', trim.toFixed(2) + ' €');
    setTxt('urssafT3', trim.toFixed(2) + ' €');
    setTxt('urssafT4', trim.toFixed(2) + ' €');

    // Mise à jour du comparatif fiscal
    let caBrut = 0;
    currentTransactions.forEach(t => {
        if (t.type === 'recette') caBrut += Number(t.amount || 0);
    });

    setTxt('microCA', caBrut.toFixed(2) + ' €');
    setTxt('microAbattement', (caBrut * 0.34).toFixed(2) + ' €');
    setTxt('microImposable', (caBrut * 0.66).toFixed(2) + ' €');

    setTxt('reelCA', caBrut.toFixed(2) + ' €');
    setTxt('reelDepenses', Math.max(0, caBrut - bncFinal).toFixed(2) + ' €');
    setTxt('reelBenefice', bncFinal.toFixed(2) + ' €');
}

/**
 * Fonction appelée lors du changement d'année dans le sélecteur
 */
function actualiserCalculsUrssaf() {
    genererDeclarations(false);
}

// Initialisation au chargement de la page
document.addEventListener('DOMContentLoaded', () => {
    genererDeclarations(false);
});
