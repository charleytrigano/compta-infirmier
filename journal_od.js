// journal_od.js - Gestion du Journal d'Opérations Diverses (OD)

(function () {
    function getSupabase() {
        return window.supabaseClient || (window.supabase && typeof window.supabase.from === 'function' ? window.supabase : null);
    }

    function formatEuro(amount) {
        return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount || 0);
    }

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

        // 1. Insertion de la transaction parent et récupération de l'UUID attribué par Supabase
        const payloadParent = {
            date: dateVal,
            type: 'od',
            category: 'Opération Diverse',
            journal: 'OD',
            description: libelleVal || 'Écriture OD',
            amount: montantVal,
            has_attachments: false
        };

        const { data: parentData, error: parentError } = await supabase
            .from('transactions')
            .insert([payloadParent])
            .select();

        if (parentError || !parentData || parentData.length === 0) {
            alert("Erreur lors de la création de la transaction OD : " + (parentError ? parentError.message : "Données non renvoyées"));
            return;
        }

        const realTransactionId = parentData[0].id;

        // 2. Insertion des lignes Débit et Crédit liées
        const ligneDebit = {
            transaction_id: realTransactionId,
            date: dateVal,
            compte_code: compteDebit,
            compte_libelle: `${compteDebit} - ${libelleCompteDebit}`,
            category: 'Opération Diverse',
            journal: 'OD',
            description: libelleVal || 'Écriture OD',
            debit: montantVal,
            credit: 0
        };

        const ligneCredit = {
            transaction_id: realTransactionId,
            date: dateVal,
            compte_code: compteCredit,
            compte_libelle: `${compteCredit} - ${libelleCompteCredit}`,
            category: 'Opération Diverse',
            journal: 'OD',
            description: libelleVal || 'Écriture OD',
            debit: 0,
            credit: montantVal
        };

        const { error: ecritureError } = await supabase
            .from('ecritures_comptables')
            .insert([ligneDebit, ligneCredit]);

        if (ecritureError) {
            alert("Erreur lors de l'enregistrement des écritures OD : " + ecritureError.message);
        } else {
            const descEl = document.getElementById('od-description');
            const montantEl = document.getElementById('od-montant');
            if (descEl) descEl.value = '';
            if (montantEl) montantEl.value = '';
            
            // Actualisation du journal OD et du Grand Livre instantanément
            await chargerJournalOD();
            if (typeof window.chargerGrandLivre === 'function') {
                await window.chargerGrandLivre();
            }

            alert("Écriture OD enregistrée avec succès !");
        }
    }

    async function chargerJournalOD() {
        const tbody = document.getElementById('body-tableau-od');
        if (!tbody) return;

        const supabase = getSupabase();
        if (!supabase) return;

        try {
            const { data, error } = await supabase
                .from('ecritures_comptables')
                .select('*')
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
