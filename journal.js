// journal.js - Gestion unifiée des vues "Transactions" et "Journal (Écritures)" basée sur ecritures_comptables

(function () {
    // Variable d'année globale par défaut (année en cours)
    window.anneeJournalSelectionnee = window.anneeJournalSelectionnee || new Date().getFullYear().toString();

    function getSupabase() {
        return window.supabaseClient || (window.supabase && typeof window.supabase.from === 'function' ? window.supabase : null);
    }

    function formatEuro(amount) {
        if (!amount || amount === 0) return '-';
        return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);
    }

    // Helper pour générer l'élément HTML du sélecteur d'année
    function injecterSelecteurAnnee(annees, idConteneur, idSelect) {
        let conteneur = document.getElementById(idConteneur);
        if (!conteneur) return;

        const options = annees.map(a => 
            `<option value="${a}" ${a === window.anneeJournalSelectionnee ? 'selected' : ''}>${a}</option>`
        ).join('');

        conteneur.innerHTML = `
            <div style="display: flex; justify-content: flex-end; align-items: center; gap: 8px; margin-bottom: 12px; background: #f8fafc; padding: 6px 12px; border-radius: 8px; border: 1px solid #e2e8f0;">
                <label for="${idSelect}" style="font-size: 0.85rem; font-weight: 700; color: #475569;">Exercice :</label>
                <select id="${idSelect}" onchange="window.changerAnneeJournal(this.value)" style="background: white; border: 1px solid #cbd5e1; font-weight: 700; color: #0f172a; padding: 3px 8px; border-radius: 4px; cursor: pointer; outline: none;">
                    ${options}
                </select>
            </div>
        `;
    }

    // ==========================================
    // 1. VUE TRANSACTIONS (Historique condensé des opérations)
    // ==========================================
    async function chargerHistoriqueTransactions() {
        const vueTrans = document.getElementById('vue-transactions') || document.querySelector('[data-view="transactions"]');
        const tbody = document.getElementById('body-tableau-transactions') || (vueTrans ? vueTrans.querySelector('tbody') : null);

        if (!tbody) return;

        // Préparation de l'emplacement du filtre
        if (!document.getElementById('filtre-annee-trans-container') && tbody.parentElement) {
            const divFiltre = document.createElement('div');
            divFiltre.id = 'filtre-annee-trans-container';
            tbody.parentElement.parentElement.insertBefore(divFiltre, tbody.parentElement);
        }

        const supabase = getSupabase();
        if (!supabase) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #ef4444; padding: 15px;">Erreur : Client Supabase non connecté.</td></tr>`;
            return;
        }

        try {
            const { data, error } = await supabase
                .from('ecritures_comptables')
                .select('*')
                .order('date', { ascending: false });

            if (error) {
                tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #ef4444; padding: 15px;">Erreur : ${error.message}</td></tr>`;
                return;
            }

            if (!data || data.length === 0) {
                tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #94a3b8; padding: 20px;">Aucune écriture enregistrée.</td></tr>`;
                return;
            }

            // Gestion des années disponibles
            const anneesDispo = Array.from(new Set(data.map(e => e.date ? new Date(e.date).getFullYear().toString() : null).filter(Boolean))).sort((a, b) => b - a);
            if (anneesDispo.length > 0 && !anneesDispo.includes(window.anneeJournalSelectionnee)) {
                window.anneeJournalSelectionnee = anneesDispo[0];
            }

            injecterSelecteurAnnee(anneesDispo.length > 0 ? anneesDispo : [window.anneeJournalSelectionnee], 'filtre-annee-trans-container', 'select-annee-trans');

            // Filtrage des données par année
            const dataFiltree = data.filter(e => e.date && new Date(e.date).getFullYear().toString() === window.anneeJournalSelectionnee);

            if (dataFiltree.length === 0) {
                tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #94a3b8; padding: 20px;">Aucune transaction pour l'année ${window.anneeJournalSelectionnee}.</td></tr>`;
                return;
            }

            // Regroupement par transaction_id
            const transactionsMap = new Map();

            dataFiltree.forEach(row => {
                const key = row.transaction_id || row.id;
                const debit = parseFloat(row.debit || 0);
                const credit = parseFloat(row.credit || 0);

                if (!transactionsMap.has(key)) {
                    const isRecette = credit > 0 || (row.compte_code && row.compte_code.startsWith('7'));
                    transactionsMap.set(key, {
                        id: row.id,
                        transaction_id: row.transaction_id,
                        date: row.date,
                        type: isRecette ? 'Recette' : 'Dépense',
                        categorie: row.compte_libelle || row.category || row.compte_code || 'Général',
                        description: row.description || '-',
                        montant: debit || credit
                    });
                }
            });

            const transactions = Array.from(transactionsMap.values());

            const html = transactions.map(t => {
                const isRecette = t.type === 'Recette';
                const typeBadge = isRecette
                    ? `<span style="background: #dcfce7; color: #15803d; padding: 3px 8px; border-radius: 4px; font-weight: 600; font-size: 0.8rem;">Recette</span>`
                    : `<span style="background: #fee2e2; color: #b91c1c; padding: 3px 8px; border-radius: 4px; font-weight: 600; font-size: 0.8rem;">Dépense</span>`;

                return `
                    <tr style="border-bottom: 1px solid #f1f5f9;">
                        <td style="padding: 10px; color: #334155;">${t.date || '-'}</td>
                        <td style="padding: 10px;">${typeBadge}</td>
                        <td style="padding: 10px; color: #475569;">${t.categorie}</td>
                        <td style="padding: 10px; color: #1e293b; font-weight: 500;">${t.description}</td>
                        <td style="padding: 10px; text-align: right; font-weight: 600; color: ${isRecette ? '#16a34a' : '#dc2626'};">
                            ${formatEuro(t.montant)}
                        </td>
                        <td style="padding: 10px; text-align: center;">
                            <button onclick="window.supprimerTransaction('${t.id}', '${t.transaction_id}')" style="background: none; border: none; color: #ef4444; cursor: pointer;" title="Supprimer">🗑️</button>
                        </td>
                    </tr>
                `;
            }).join('');

            tbody.innerHTML = html;

        } catch (err) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #ef4444; padding: 15px;">Erreur : ${err.message}</td></tr>`;
        }
    }

    async function supprimerTransaction(id, transactionId) {
        if (!confirm("Voulez-vous supprimer cette écriture comptable ?")) return;

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
            await chargerHistoriqueTransactions();
            await chargerJournalGeneral();
        }
    }

    // ==========================================
    // 2. VUE JOURNAL GENERAL (Lignes comptables détaillées)
    // ==========================================
    async function chargerJournalGeneral() {
        const vueJournal = document.getElementById('vue-journal') || document.querySelector('[data-view="journal"]') || document.querySelector('[id*="journal"]');
        const tbody = document.getElementById('body-tableau-journal') || (vueJournal ? vueJournal.querySelector('tbody') : null);

        if (!tbody) return;

        // Préparation de l'emplacement du filtre
        if (!document.getElementById('filtre-annee-journal-container') && tbody.parentElement) {
            const divFiltre = document.createElement('div');
            divFiltre.id = 'filtre-annee-journal-container';
            tbody.parentElement.parentElement.insertBefore(divFiltre, tbody.parentElement);
        }

        const supabase = getSupabase();
        if (!supabase) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #ef4444; padding: 15px;">Erreur : Client Supabase non initialisé.</td></tr>`;
            return;
        }

        try {
            const { data, error } = await supabase
                .from('ecritures_comptables')
                .select('*')
                .order('date', { ascending: false });

            if (error) {
                tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #ef4444; padding: 15px;">Erreur : ${error.message}</td></tr>`;
                return;
            }

            if (!data || data.length === 0) {
                tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #94a3b8; padding: 20px;">Aucune écriture enregistrée.</td></tr>`;
                return;
            }

            // Gestion des années disponibles
            const anneesDispo = Array.from(new Set(data.map(e => e.date ? new Date(e.date).getFullYear().toString() : null).filter(Boolean))).sort((a, b) => b - a);
            if (anneesDispo.length > 0 && !anneesDispo.includes(window.anneeJournalSelectionnee)) {
                window.anneeJournalSelectionnee = anneesDispo[0];
            }

            injecterSelecteurAnnee(anneesDispo.length > 0 ? anneesDispo : [window.anneeJournalSelectionnee], 'filtre-annee-journal-container', 'select-annee-journ');

            // Filtrage des données par année
            const dataFiltree = data.filter(e => e.date && new Date(e.date).getFullYear().toString() === window.anneeJournalSelectionnee);

            if (dataFiltree.length === 0) {
                tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #94a3b8; padding: 20px;">Aucune écriture pour l'année ${window.anneeJournalSelectionnee}.</td></tr>`;
                return;
            }

            const html = dataFiltree.map(row => {
                const debit = parseFloat(row.debit || 0);
                const credit = parseFloat(row.credit || 0);
                const compteCode = row.compte_code || '-';
                const compteLibelle = row.compte_libelle || row.description || '-';

                return `
                    <tr style="border-bottom: 1px solid #f1f5f9;">
                        <td style="padding: 10px; color: #334155;">${row.date || '-'}</td>
                        <td style="padding: 10px; color: #475569; font-weight: 600;">${compteCode}</td>
                        <td style="padding: 10px; color: #1e293b; font-weight: 500;">${compteLibelle}</td>
                        <td style="padding: 10px; color: #dc2626; text-align: right; font-weight: 500;">${formatEuro(debit)}</td>
                        <td style="padding: 10px; color: #16a34a; text-align: right; font-weight: 500;">${formatEuro(credit)}</td>
                        <td style="padding: 10px; text-align: center;">
                            <span style="background: #dcfce7; color: #15803d; padding: 3px 8px; border-radius: 4px; font-weight: 600; font-size: 0.8rem;">Validé</span>
                        </td>
                    </tr>
                `;
            }).join('');

            tbody.innerHTML = html;

        } catch (err) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #ef4444; padding: 15px;">Erreur : ${err.message}</td></tr>`;
        }
    }

    // Fonction globale pour réagir au changement d'année dans le menu déroulant
    window.changerAnneeJournal = function (annee) {
        window.anneeJournalSelectionnee = String(annee);
        chargerHistoriqueTransactions();
        chargerJournalGeneral();
    };

    // Expositions globales
    window.chargerHistoriqueTransactions = chargerHistoriqueTransactions;
    window.chargerTransactions = chargerHistoriqueTransactions;
    window.supprimerTransaction = supprimerTransaction;
    window.chargerJournalGeneral = chargerJournalGeneral;
    window.chargerJournal = chargerJournalGeneral;

    document.addEventListener('click', (e) => {
        const el = e.target.closest('button, a, div');
        if (!el || !el.textContent) return;

        const txt = el.textContent.trim().toLowerCase();
        if (txt === 'transactions') {
            setTimeout(chargerHistoriqueTransactions, 100);
        } else if (txt.includes('journal') && !txt.includes('banque')) {
            setTimeout(chargerJournalGeneral, 100);
        }
    });

    function init() {
        setTimeout(chargerHistoriqueTransactions, 150);
        setTimeout(chargerJournalGeneral, 250);
    }

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        init();
    } else {
        document.addEventListener('DOMContentLoaded', init);
    }
})();
