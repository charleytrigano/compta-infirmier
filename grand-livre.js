// grand_livre.js - Gestion et ventilation du Grand Livre avec sous-comptes auxiliaires

(function () {
    // 1. Détection dynamique du client Supabase
    function getSupabaseClient() {
        return window.supabaseClient || (window.supabase && typeof window.supabase.from === 'function' ? window.supabase : null);
    }

    // État local du module
    let state = {
        transactions: [],
        planComptable: [],
        compteFiltre: 'TOUS'
    };

    // 2. Initialisation au chargement du DOM
    document.addEventListener('DOMContentLoaded', async () => {
        await chargerDonnees();
        initialiserFiltres();
        afficherGrandLivre();
    });

    // 3. Synchronisation des données (Supabase / Fallback LocalStorage)
    async function chargerDonnees() {
        const supabase = getSupabaseClient();

        if (supabase) {
            try {
                // Chargement des transactions
                const { data: txData, error: txErr } = await supabase
                    .from('transactions')
                    .select('*')
                    .order('date', { ascending: true });

                state.transactions = (!txErr && txData) ? txData : JSON.parse(localStorage.getItem('transactions') || '[]');

                // Chargement du plan comptable
                const { data: planData, error: planErr } = await supabase
                    .from('plan_comptable')
                    .select('*');

                state.planComptable = (!planErr && planData) ? planData : JSON.parse(localStorage.getItem('plan_comptable') || '[]');
            } catch (err) {
                console.warn('Erreur de connexion Supabase, bascule sur le cache local :', err);
                recupererDepuisLocalStorage();
            }
        } else {
            recupererDepuisLocalStorage();
        }
    }

    function recupererDepuisLocalStorage() {
        state.transactions = JSON.parse(localStorage.getItem('transactions') || '[]');
        state.planComptable = JSON.parse(localStorage.getItem('plan_comptable') || '[]');
    }

    // 4. Logique de ventilation : Association des écritures aux comptes auxiliaires
    function determinerCompteEtLibelle(tx) {
        let codeCompte = tx.compte_code || '411000';
        let nomCompte = tx.categorie || 'Soins infirmiers';

        // Traitement particulier du compte collectif 411000 & des recettes
        if (codeCompte === '411000' || tx.type === 'Recette' || nomCompte === 'Soins infirmiers') {
            const desc = (tx.description || '').trim();

            if (desc) {
                if (desc.startsWith('411')) {
                    codeCompte = desc;
                    nomCompte = desc;
                } else {
                    // Construction automatique du compte auxiliaire (ex: 411 Abadie)
                    codeCompte = `411 ${desc}`;
                    nomCompte = `411 ${desc} (Patient / Tiers)`;
                }
            } else {
                codeCompte = '411000';
                nomCompte = 'Patients & Caisses (Collectif)';
            }
        }

        return { code: codeCompte, nom: nomCompte };
    }

    // 5. Génération dynamique du filtre de sélection de comptes
    function initialiserFiltres() {
        const selectFiltre = document.getElementById('filtreCompte');
        if (!selectFiltre) return;

        const comptesUniques = new Map();

        state.transactions.forEach(tx => {
            const c = determinerCompteEtLibelle(tx);
            if (!comptesUniques.has(c.code)) {
                comptesUniques.set(c.code, c.nom);
            }
        });

        selectFiltre.innerHTML = '<option value="TOUS">Tous les comptes (Vue globale)</option>';

        // Trier la liste par code comptable
        const comptesTries = Array.from(comptesUniques.entries()).sort((a, b) => a[0].localeCompare(b[0]));

        comptesTries.forEach(([code, nom]) => {
            const option = document.createElement('option');
            option.value = code;
            option.textContent = `${code} - ${nom}`;
            selectFiltre.appendChild(option);
        });

        selectFiltre.addEventListener('change', (e) => {
            state.compteFiltre = e.target.value;
            afficherGrandLivre();
        });
    }

    // 6. Rendu HTML du tableau du Grand Livre et calcul des solde
    function afficherGrandLivre() {
        const container = document.getElementById('grandLivreTableBody');
        const totalDebitEl = document.getElementById('totalDebit');
        const totalCreditEl = document.getElementById('totalCredit');
        const soldeGlobalEl = document.getElementById('soldeGlobal');

        if (!container) return;
        container.innerHTML = '';

        let totalDebit = 0;
        let totalCredit = 0;

        // Filtrage des transactions selon le compte sélectionné
        const transactionsFiltrees = state.transactions.filter(tx => {
            if (state.compteFiltre === 'TOUS') return true;
            const c = determinerCompteEtLibelle(tx);
            return c.code === state.compteFiltre;
        });

        if (transactionsFiltrees.length === 0) {
            container.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 20px;">Aucune écriture enregistrée pour ce compte.</td></tr>`;
            if (totalDebitEl) totalDebitEl.textContent = '0.00 €';
            if (totalCreditEl) totalCreditEl.textContent = '0.00 €';
            if (soldeGlobalEl) soldeGlobalEl.textContent = '0.00 €';
            return;
        }

        // Rendu des lignes
        transactionsFiltrees.forEach(tx => {
            const c = determinerCompteEtLibelle(tx);
            const montant = parseFloat(tx.montant) || 0;

            const isRecette = tx.type === 'Recette';
            const debit = isRecette ? montant : 0;
            const credit = !isRecette ? montant : 0;

            totalDebit += debit;
            totalCredit += credit;

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${formatDate(tx.date)}</td>
                <td><strong>${c.code}</strong></td>
                <td>${tx.categorie || '-'}</td>
                <td>${tx.description || '-'}</td>
                <td style="text-align: right; color: #2e7d32;">${debit > 0 ? debit.toFixed(2) + ' €' : '-'}</td>
                <td style="text-align: right; color: #c62828;">${credit > 0 ? credit.toFixed(2) + ' €' : '-'}</td>
            `;
            container.appendChild(tr);
        });

        // Mise à jour du pied de tableau
        if (totalDebitEl) totalDebitEl.textContent = totalDebit.toFixed(2) + ' €';
        if (totalCreditEl) totalCreditEl.textContent = totalCredit.toFixed(2) + ' €';
        if (soldeGlobalEl) {
            const solde = totalDebit - totalCredit;
            soldeGlobalEl.textContent = solde.toFixed(2) + ' €';
            soldeGlobalEl.style.color = solde >= 0 ? '#2e7d32' : '#c62828';
        }
    }

    // Formatage de la date en notation française
    function formatDate(dateStr) {
        if (!dateStr) return '-';
        const d = new Date(dateStr);
        return isNaN(d) ? dateStr : d.toLocaleDateString('fr-FR');
    }

    // Fonction d'actualisation globale accessible depuis la page
    window.rafraichirGrandLivre = async function () {
        await chargerDonnees();
        initialiserFiltres();
        afficherGrandLivre();
    };
})();
