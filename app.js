// ==========================================
// GENERATION DES JOURNAUX ET BALANCE COMPTABLE
// ==========================================

/**
 * 1. Génère le Livre-Journal (Recettes & Dépenses)
 */
function genererLivreJournal(exercice = 'all') {
    const journalEntries = [];

    currentTransactions.forEach(t => {
        if (!t.date) return;
        const { year } = parseDate(t.date);
        if (exercice !== 'all' && year !== exercice) return;

        const montant = Number(t.amount || 0);

        if (t.type === 'recette') {
            // Ligne Débit Banque
            journalEntries.push({
                date: t.date,
                compte: '512000',
                libelle: `[Banque] ${t.description}`,
                debit: montant,
                credit: 0
            });
            // Ligne Crédit Honoraires
            journalEntries.push({
                date: t.date,
                compte: '706000',
                libelle: `[Recette] ${t.description}`,
                debit: 0,
                credit: montant
            });
        } else if (t.type === 'depense') {
            // Détermination du compte de charge
            let compteCharge = '658000';
            if (t.category === 'cotisations') compteCharge = '645000';
            else if (t.category === 'materiel') compteCharge = '606000';
            else if (t.category === 'deplacement') compteCharge = '625000';
            else if (t.category === 'assurance') compteCharge = '616000';

            // Ligne Débit Charge
            journalEntries.push({
                date: t.date,
                compte: compteCharge,
                libelle: `[Charge] ${t.description}`,
                debit: montant,
                credit: 0
            });
            // Ligne Crédit Banque
            journalEntries.push({
                date: t.date,
                compte: '512000',
                libelle: `[Banque] ${t.description}`,
                debit: 0,
                credit: montant
            });
        }
    });

    return journalEntries;
}

/**
 * 2. Génère la Balance Comptable (Cumul Débit/Crédit et Soldes par Compte)
 */
function genererBalanceComptable(exercice = 'all') {
    const journal = genererLivreJournal(exercice);
    const balanceMap = {};

    const nomsComptes = {
        '512000': 'Banque / Trésorerie',
        '606000': 'Matériel & Consommables Médicaux',
        '616000': 'Assurances Professionnelles',
        '625000': 'Frais de Déplacement',
        '645000': 'Cotisations Sociales (URSSAF/CARPIMKO)',
        '658000': 'Autres Charges de Gestion',
        '706000': 'Honoraires & Prestations de Soins'
    };

    journal.forEach(e => {
        if (!balanceMap[e.compte]) {
            balanceMap[e.compte] = {
                compte: e.compte,
                intitule: nomsComptes[e.compte] || 'Compte Divers',
                totalDebit: 0,
                totalCredit: 0
            };
        }
        balanceMap[e.compte].totalDebit += e.debit;
        balanceMap[e.compte].totalCredit += e.credit;
    });

    // Conversion en tableau avec calcul des soldes
    return Object.values(balanceMap).map(c => {
        const solde = c.totalDebit - c.totalCredit;
        return {
            ...c,
            soldeDebiteur: solde > 0 ? solde : 0,
            soldeCrediteur: solde < 0 ? Math.abs(solde) : 0
        };
    });
}
