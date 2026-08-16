// transactions.js - Gestion du Journal de Banque et des Écritures Bancaires (512000)

(function () {
    function getSupabase() {
        return window.supabaseClient || (window.supabase && typeof window.supabase.from === 'function' ? window.supabase : null);
    }

    function formatEuro(amount) {
        return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount || 0);
    }

    /**
     * Charge et affiche les mouvements du Journal de Banque (Compte 512000)
     */
    async function chargerJournalBanque() {
        const vueBanque = document.getElementById('vue-banque');
        const tbody = document.getElementById('body-tableau-banque') || (vueBanque ? vueBanque.querySelector('tbody') : null);
        const soldeEl = document.getElementById('solde-banque') || (vueBanque ? vueBanque.querySelector('span') : null);

        if (!tbody) return;

        const supabase = getSupabase();
        if (!supabase) {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #ef4444; padding: 15px;">Erreur : Client Supabase non initialisé.</td></tr>`;
            return;
        }

        try {
            // Lecture des écritures bancaires (Compte 512000)
            let { data, error } = await supabase
                .from('ecritures_comptables')
                .select('*')
                .or('compte_code.eq.512000,compte_code.like.512%')
                .order('date', { ascending: false });

            // Fallback si la table transactions principale est utilisée
            if ((error || !data || data.length === 0)) {
                const resTrans = await supabase.from('transactions').select('*').order('date', { ascending: false });
                if (!resTrans.error && resTrans.data && resTrans.data.length > 0) {
                    data = resTrans.data;
                }
            }

            if (error && (!data || data.length === 0)) {
                tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #ef4444; padding: 15px;">Erreur : ${error.message}</td></tr>`;
                return;
            }

            if (!data || data.length === 0) {
                tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #94a3b8; padding: 20px;">Aucun mouvement bancaire enregistré.</td></tr>`;
                if (soldeEl) soldeEl.textContent = "0,00 €";
                return;
            }

            let totalDebit = 0;   // Encaissements
            let totalCredit = 0;  // Décaissements

            const html = data.map(row => {
                const debit = parseFloat(row.debit || 0);
                const credit = parseFloat(row.credit || 0);
                
                // Débit sur compte 512 = Encaissement / Recette
                const isEncaissement = debit > 0 || (row.sens && row.sens.toLowerCase().includes('encaissement'));
                const montant = isEncaissement ? (debit || parseFloat(row.montant || 0)) : (credit || parseFloat(row.montant || 0));

                if (isEncaissement) {
                    totalDebit += montant;
                } else {
                    totalCredit += montant;
                }

                const sensLabel = isEncaissement ? 'Encaissement' : 'Décaissement';
                const sensBadge = isEncaissement 
                    ? `<span style="background: #dcfce7; color: #15803d; padding: 3px 8px; border-radius: 4px; font-weight: 600; font-size: 0.8rem;">${sensLabel}</span>`
                    : `<span style="background: #fee2e2; color: #b91c1c; padding: 3px 8px; border-radius: 4px; font-weight: 600; font-size: 0.8rem;">${sensLabel}</span>`;

                const categorie = row.category || row.categorie || 'Soins infirmiers';
                const description = row.description || row.libelle || '-';
                const dateFormatted = row.date || '-';

                return `
                    <tr style="border-bottom: 1px solid #f1f5f9;">
                        <td style="padding: 10px; color: #334155;">${dateFormatted}</td>
                        <td style="padding: 10px;">${sensBadge}</td>
                        <td style="padding: 10px; color: #475569;">${categorie}</td>
                        <td style="padding: 10px; color: #1e293b; font-weight: 500;">${description}</td>
                        <td style="padding: 10px; color: #dc2626; font-weight: 600; text-align: right;">${!isEncaissement ? formatEuro(montant) : '-'}</td>
                        <td style="padding: 10px; color: #16a34a; font-weight: 600; text-align: right;">${isEncaissement ? formatEuro(montant) : '-'}</td>
                        <td style="padding: 10px; text-align: center;">
                            <button onclick="window.supprimerMouvementBanque('${row.id}', '${row.transaction_id || ''}')" style="background: none; border: none; color: #ef4444; cursor: pointer; font-size: 0.9rem;" title="Supprimer">🗑️</button>
                        </td>
                    </tr>
                `;
            }).join('');

            tbody.innerHTML = html;

            // Calcul du Solde = Encaissements - Décaissements
            const solde = totalDebit - totalCredit;
            if (soldeEl) {
                soldeEl.textContent = formatEuro(solde);
            }

        } catch (err) {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #ef4444; padding: 15px;">Erreur : ${err.message}</td></tr>`;
        }
    }

    /**
     * Enregistre un nouveau paiement bancaire dans Supabase
     */
    async function ajouterPaiement(e) {
        if (e) e.preventDefault();

        const vueBanque = document.getElementById('vue-banque');
        if (!vueBanque) return;

        const dateInput = vueBanque.querySelector('input[type="date"]') || document.getElementById('banque-date');
        const selects = vueBanque.querySelectorAll('select');
        const sensSelect = selects[0] || document.getElementById('banque-sens');
        const catSelect = selects.length > 1 ? selects[1] : sensSelect;
        const inputs = vueBanque.querySelectorAll('input');
        const libelleInput = inputs.length > 1 ? inputs[1] : null;
        const montantInput = inputs.length > 2 ? inputs[2] : null;

        const dateVal = dateInput ? dateInput.value : '';
        const sensVal = sensSelect ? sensSelect.value : 'Encaissement (Recette)';
        const catVal = catSelect ? catSelect.value : 'Soins infirmiers';
        const libelleVal = libelleInput ? libelleInput.value.trim() : '';
        const montantVal = montantInput ? parseFloat(montantInput.value) : 0;

        if (!dateVal || !montantVal || montantVal <= 0) {
            alert("Veuillez renseigner une date valide et un montant supérieur à 0.");
            return;
        }

        const supabase = getSupabase();
        if (!supabase) {
            alert("Erreur : Client Supabase introuvable.");
            return;
        }

        const isEncaissement = sensVal.toLowerCase().includes('encaissement') || sensVal.toLowerCase().includes('recette');
        const transactionId = crypto.randomUUID ? crypto.randomUUID() : 'trans_' + Date.now();

        const ligneBanque = {
            transaction_id: transactionId,
            date: dateVal,
            compte_code: '512000',
            compte_libelle: '512000 - Banque / Compte Courant',
            category: catVal,
            description: (isEncaissement ? 'Encaissement : ' : 'Décaissement : ') + (libelleVal || catVal),
            debit: isEncaissement ? montantVal : 0,
            credit: isEncaissement ? 0 : montantVal
        };

        const { error } = await supabase.from('ecritures_comptables').insert([ligneBanque]);

        if (error) {
            alert("Erreur lors de l'enregistrement : " + error.message);
        } else {
            if (libelleInput) libelleInput.value = '';
            if (montantInput) montantInput.value = '';
            await chargerJournalBanque();
        }
    }

    /**
     * Supprime une ligne bancaire
     */
    async function supprimerMouvementBanque(id, transactionId) {
        if (!confirm("Voulez-vous vraiment supprimer cet enregistrement ?")) return;

        const supabase = getSupabase();
        if (!supabase) return;

        let query = supabase.from('ecritures_comptables').delete();
        if (transactionId && transactionId !== 'undefined' && transactionId !== '') {
            query = query.eq('transaction_id', transactionId);
        } else {
            query = query.eq('id', id);
        }

        const { error } = await query;
        if (error) {
            alert("Erreur lors de la suppression : " + error.message);
        } else {
            await chargerJournalBanque();
        }
    }

    // Expositions des méthodes globales
    window.chargerJournalBanque = chargerJournalBanque;
    window.chargerTransactions = chargerJournalBanque;
    window.ajouterPaiement = ajouterPaiement;
    window.supprimerMouvementBanque = supprimerMouvementBanque;

    // Détection de clic sur l'onglet Journal de Banque
    document.addEventListener('click', (e) => {
        const el = e.target.closest('button, a, div');
        if (el && el.textContent && el.textContent.trim().toLowerCase().includes('journal de banque')) {
            setTimeout(chargerJournalBanque, 100);
            setTimeout(chargerJournalBanque, 300);
        }
    });

    // Chargement initial au démarrage
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        setTimeout(chargerJournalBanque, 200);
    } else {
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(chargerJournalBanque, 200);
        });
    }
})();
