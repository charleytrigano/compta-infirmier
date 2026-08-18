// Gestion des exercices comptables et des reports à nouveau (RAN)
window.exerciceCourant = new Date().getFullYear();

/**
 * Filtre les transactions d'une liste selon l'année d'exercice
 * Pour les classes 6 à 9 : uniquement l'année sélectionnée
 * Pour les classes 1 à 5 : toutes les écritures jusqu'à la fin de l'année sélectionnée
 */
window.filtrerParExercice = function(transactions, annee, classeCompte) {
    var classeNum = parseInt(classeCompte.toString().charAt(0), 10);
    
    return transactions.filter(function(t) {
        var dateTx = new Date(t.date || t.created_at);
        var anneeTx = dateTx.getFullYear();

        // Comptes de gestion (6 à 9) : uniquement l'exercice courant
        if (classeNum >= 6 && classeNum <= 9) {
            return anneeTx === annee;
        } 
        // Comptes de bilan (1 à 5) : cumul jusqu'à la fin de l'exercice
        else {
            return anneeTx <= annee;
        }
    });
};

/**
 * Génère automatiquement les écritures de Report à Nouveau dans le Journal OD
 * pour passer de l'exercice (N-1) à l'exercice N
 */
window.cloturerEtGenererRAN = async function(anneeCloture) {
    if (!confirm("Voulez-vous clôturer l'exercice " + anneeCloture + " et générer les A-Nouveaux au 01/01/" + (anneeCloture + 1) + " ?")) {
        return;
    }

    try {
        // 1. Récupérer toutes les transactions du Bilan (classes 1 à 5) jusqu'à N
        var transactions = window.transactions || [];
        var soldesComptes = {};

        transactions.forEach(function(t) {
            var dateTx = new Date(t.date || t.created_at);
            var compte = t.compte || "";
            var classeNum = parseInt(compte.charAt(0), 10);

            // On ne prend que les comptes 1 à 5 jusqu'à l'année de clôture
            if (dateTx.getFullYear() <= anneeCloture && classeNum >= 1 && classeNum <= 5) {
                if (!soldesComptes[compte]) soldesComptes[compte] = 0;
                var montant = parseFloat(t.montant) || 0;
                soldesComptes[compte] += (t.type === 'Recette' || t.credit) ? montant : -montant;
            }
        });

        // 2. Insérer les ouvertures de solde au 01/01/(anneeCloture + 1) dans les OD
        var dateOuverture = (anneeCloture + 1) + "-01-01";
        var ecrituresRAN = [];

        for (var compte in soldesComptes) {
            var solde = soldesComptes[compte];
            if (solde !== 0) {
                ecrituresRAN.push({
                    date: dateOuverture,
                    compte_debit: solde < 0 ? compte : '890000', // 890 = Bilan d'ouverture
                    compte_credit: solde > 0 ? compte : '890000',
                    description: 'Report à nouveau ' + (anneeCloture + 1) + ' (Solde N-1)',
                    montant: Math.abs(solde)
                });
            }
        }

        // Sauvegarde Supabase
        if (window.supabaseClient && ecrituresRAN.length > 0) {
            var { error } = await window.supabaseClient.from('journal_od').insert(ecrituresRAN);
            if (error) throw error;
            alert("Clôture réussie ! Les A-Nouveaux ont été enregistrés au 01/01/" + (anneeCloture + 1));
            location.reload();
        }
    } catch (err) {
        console.error("Erreur clôture :", err);
        alert("Erreur lors de la génération des A-Nouveaux.");
    }
};
