// Gestion des exercices comptables et des reports à nouveau (RAN)
window.exerciceCourant = new Date().getFullYear();

/**
 * Filtre les transactions d'une liste selon l'année d'exercice
 * Pour les classes 6 à 9 : uniquement l'année sélectionnée
 * Pour les classes 1 à 5 : toutes les écritures jusqu'à la fin de l'année sélectionnée
 */
window.filtrerParExercice = function(transactions, annee, classeCompte) {
    var anneeNum = parseInt(annee, 10);
    var classeNum = parseInt(classeCompte.toString().charAt(0), 10);
    
    return transactions.filter(function(t) {
        var dateTx = new Date(t.date || t.created_at);
        var anneeTx = dateTx.getFullYear();

        if (classeNum >= 6 && classeNum <= 9) {
            return anneeTx === anneeNum;
        } else {
            return anneeTx <= anneeNum;
        }
    });
};

/**
 * Génère automatiquement les écritures de Report à Nouveau dans le Journal OD
 * pour passer de l'exercice (N) à l'exercice (N+1)
 */
window.cloturerEtGenererRAN = async function(anneeCloture) {
    // Conversion explicite en nombre entier
    var anneeN = parseInt(anneeCloture, 10);
    var anneeNPlusUn = anneeN + 1;

    if (!confirm("Voulez-vous clôturer l'exercice " + anneeN + " et générer les A-Nouveaux au 01/01/" + anneeNPlusUn + " ?")) {
        return;
    }

    try {
        var transactions = window.transactions || [];
        var soldesComptes = {};

        // 1. Récupération des soldes de bilan (classes 1 à 5) jusqu'à la fin de l'exercice N
        transactions.forEach(function(t) {
            var dateTx = new Date(t.date || t.created_at);
            var compte = (t.compte || "").toString();
            var classeNum = parseInt(compte.charAt(0), 10);

            if (dateTx.getFullYear() <= anneeN && classeNum >= 1 && classeNum <= 5) {
                if (!soldesComptes[compte]) soldesComptes[compte] = 0;
                var montant = parseFloat(t.montant) || 0;
                soldesComptes[compte] += (t.type === 'Recette' || t.credit) ? montant : -montant;
            }
        });

        // 2. Génération des écritures de Report à Nouveau au 01/01/N+1
        var dateOuverture = anneeNPlusUn + "-01-01";
        var ecrituresRAN = [];

        for (var compte in soldesComptes) {
            var solde = soldesComptes[compte];
            if (solde !== 0) {
                ecrituresRAN.push({
                    date: dateOuverture,
                    compte_debit: solde < 0 ? compte : '890000',
                    compte_credit: solde > 0 ? compte : '890000',
                    description: 'Report à nouveau ' + anneeNPlusUn + ' (Solde N-1)',
                    montant: Math.abs(solde)
                });
            }
        }

        if (ecrituresRAN.length === 0) {
            alert("Aucun solde de bilan à reporter pour l'exercice " + anneeN + ".");
            return;
        }

        // Sauvegarde dans Supabase
        if (window.supabaseClient) {
            var { error } = await window.supabaseClient.from('journal_od').insert(ecrituresRAN);
            if (error) throw error;
            alert("Clôture réussie ! Les A-Nouveaux ont été enregistrés au 01/01/" + anneeNPlusUn);
            location.reload();
        }
    } catch (err) {
        console.error("Erreur clôture :", err);
        alert("Erreur lors de la génération des A-Nouveaux.");
    }
};
