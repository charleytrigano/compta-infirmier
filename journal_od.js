// journal_od.js - Gestion du Journal d'Opérations Diverses (OD)

(function () {
    function getSupabase() {
        return window.supabaseClient || (window.supabase && typeof window.supabase.from === 'function' ? window.supabase : null);
    }

    function formatEuro(amount) {
        return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount || 0);
    }

    /**
     * Valide et enregistre une écriture OD manuelle (Partie Double)
     */
    async function enregistrerEcritureOD(e) {
        if (e) e.preventDefault();

        const dateVal = document.getElementById('od-date')?.value;
        const compteDebit = document.getElementById('od-compte-debit')?.value.trim();
        const compteCredit = document.getElementById('od-compte-credit')?.value.trim();
        const libelleCompteDebit = document.getElementById('od-libelle-debit')?.value.trim() || `Compte ${compteDebit}`;
        const libelleCompteCredit = document.getElementById('od-libelle-credit')?.value.trim() || `Compte ${compteCredit}`;
        const libelleVal = document.getElementById('od-description')?.value.trim();
        const montantVal = parseFloat(document.getElementById('od-montant')?.value);

        if (!dateVal || !compteDebit || !compteCredit || isNaN(montantVal) || montantVal <= 0) {
            alert("Veuillez remplir correctement la date, les deux comptes et un montant valide supérieur à 0.");
            return;
        }

        if (compteDebit === compteCredit) {
            alert("Le compte de débit et le compte de crédit doivent être différents.");
            return;
        }

        const supabase = getSupabase();
        if (!supabase) {
            alert("Erreur de connexion à la base de données.");
            return;
        }

        const transactionId = crypto.randomUUID ? crypto.randomUUID() : 'od_' + Date.now();

        // Ligne DEBIT
        const ligneDebit = {
            transaction_id: transactionId,
            date: dateVal,
            compte_code: compteDebit,
            compte_libelle: `${compteDebit} - ${libelleCompteDebit}`,
            category: 'Opération Diverse',
            description: libelleVal || 'Écriture OD',
            debit: montantVal,
            credit: 0
        };

        // Ligne CREDIT
        const ligneCredit = {
            transaction_id: transactionId,
            date: dateVal,
            compte_code: compteCredit,
            compte_libelle: `${compteCredit} - ${libelleCompteCredit}`,
            category: 'Opération Diverse',
            description: libelleVal || 'Écriture OD',
            debit: 0,
            credit: montantVal
        };

        const { error } = await supabase.from('ecritures_comptables').insert([ligneDebit, ligneCredit]);

        if (error) {
            alert("Erreur lors de l'enregistrement de l'OD : " + error.message);
        } else {
            alert("Écriture OD enregistrée avec succès !");
            
            // Réinitialisation des champs du formulaire
            document.getElementById('od-description').value = '';
            document.getElementById('od-montant').value = '';
            
            await chargerJournalOD();
        }
    }

    /**
     * Charge et affiche la liste des écritures OD enregistrées
     */
    async function chargerJournalOD() {
        const tbody = document.getElementById('body-tableau-od');
        if (!tbody) return;

        const supabase = getSupabase();
        if (!supabase) return;

        try {
            // Récupère les écritures qui ne passent ni par le compte 512 (Banque) ni par le compte 530 (Caisse)
            const { data, error } = await supabase
                .from('ecritures_comptables')
                .select('*')
                .not('compte_code', 'like', '512%')
                .not('compte_code', 'like', '530%')
                .eq('category', 'Opération Diverse')
                .order('date', { ascending: false });

            if (error) {
                console.error("Erreur récupération OD :", error.message);
                return;
            }

            if (!data || data.length === 0) {
                tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #94a3b8; padding: 20px;">Aucune écriture d'opération diverse enregistrée.</td></tr>`;
                return;
            }

            tbody.innerHTML = data.map(row => {
                const debit = parseFloat(row.debit || 0);
                const credit = parseFloat(row.credit || 0);

                return `
                    <tr style="border-bottom: 1px solid #f1f5f9;">
                        <td style="padding: 10px; color: #334155;">${row.date || '-'}</td>
                        <td style="padding: 10px; font-weight: 600; color: #1e293b;">${row.compte_code}</td>
                        <td style="padding: 10px; color: #475569;">${row.compte_libelle || '-'}</td>
                        <td style="padding: 10px; color: #1e293b;">${row.description || '-'}</td>
                        <td style="padding: 10px; color: #2563eb; font-weight: 600; text-align: right;">${debit > 0 ? formatEuro(debit) : '-'}</td>
                        <td style="padding: 10px; color: #dc2626; font-weight: 600; text-align: right;">${credit > 0 ? formatEuro(credit) : '-'}</td>
                    </tr>
                `;
            }).join('');

        } catch (err) {
            console.error("Erreur d'affichage du journal OD :", err);
        }
    }

    // Expositions globales
    window.enregistrerEcritureOD = enregistrerEcritureOD;
    window.chargerJournalOD = chargerJournalOD;

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        setTimeout(chargerJournalOD, 200);
    } else {
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(chargerJournalOD, 200);
        });
    }
})();
