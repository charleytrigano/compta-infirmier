// journal.js - Gestion dynamique des journaux comptables et sous-onglets

(function () {
    function getSupabase() {
        return window.supabaseClient || (window.supabase && typeof window.supabase.from === 'function' ? window.supabase : null);
    }

    let state = {
        transactions: [],
        ecritures: [],
        currentTab: 'encaissements' // 'encaissements', 'depenses', 've', 'ha', 'bq'
    };

    async function chargerDonneesJournal() {
        const supabase = getSupabase();
        if (!supabase) return;

        try {
            // Chargement des transactions brutes
            const { data: txData } = await supabase.from('transactions').select('*').order('date', { ascending: false });
            state.transactions = txData || [];

            // Chargement des écritures en partie double si disponibles
            const { data: ecrData } = await supabase.from('ecritures_comptables').select('*').order('date', { ascending: false });
            state.ecritures = ecrData || [];
        } catch (err) {
            console.error("Erreur chargement journal :", err);
        }

        mettreAJourCompteurs();
        afficherContenuJournal();
    }

    function mettreAJourCompteurs() {
        const encaissementsAttente = state.transactions.filter(t => {
            const isRec = String(t.type || '').toLowerCase().includes('rec') || String(t.category || '').toLowerCase().includes('soins');
            return isRec && (t.encaisse === false || t.encaisse === null || t.encaisse === undefined);
        });

        const depensesAttente = state.transactions.filter(t => {
            const isDep = String(t.type || '').toLowerCase().includes('dep') || String(t.type || '').toLowerCase().includes('dép');
            return isDep && (t.encaisse === false || t.encaisse === null || t.encaisse === undefined);
        });

        // Mise à jour du texte des boutons
        const btnEnc = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Encaissements'));
        if (btnEnc) btnEnc.innerHTML = `🟢 Encaissements à Valider (${encaissementsAttente.length || state.transactions.filter(t => String(t.type || '').toLowerCase().includes('rec')).length})`;

        const btnDep = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Dépenses à Régler'));
        if (btnDep) btnDep.innerHTML = `🔴 Dépenses à Régler (${depensesAttente.length || state.transactions.filter(t => String(t.type || '').toLowerCase().includes('dep')).length})`;
    }

    function afficherContenuJournal() {
        let tbody = document.querySelector('table tbody');
        if (!tbody) {
            const table = document.querySelector('table');
            if (table) {
                tbody = document.createElement('tbody');
                table.appendChild(tbody);
            }
        }
        if (!tbody) return;

        tbody.innerHTML = '';

        let donneesAffichage = [];

        // Filtre selon le sous-onglet actif
        if (state.currentTab === 'encaissements') {
            donneesAffichage = state.transactions.filter(t => 
                String(t.type || '').toLowerCase().includes('rec') || 
                String(t.category || '').toLowerCase().includes('soins')
            );
        } else if (state.currentTab === 'depenses') {
            donneesAffichage = state.transactions.filter(t => 
                String(t.type || '').toLowerCase().includes('dep') || 
                String(t.type || '').toLowerCase().includes('dép')
            );
        } else if (state.currentTab === 've') {
            donneesAffichage = state.transactions.filter(t => String(t.type || '').toLowerCase().includes('rec'));
        } else if (state.currentTab === 'ha') {
            donneesAffichage = state.transactions.filter(t => String(t.type || '').toLowerCase().includes('dep'));
        } else if (state.currentTab === 'bq') {
            donneesAffichage = state.ecritures.length > 0 ? state.ecritures : state.transactions;
        }

        if (donneesAffichage.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 25px; color: #64748b;">Aucune opération trouvée pour ce journal.</td></tr>`;
            return;
        }

        donneesAffichage.forEach(row => {
            const tr = document.createElement('tr');
            tr.style.borderBottom = '1px solid #f1f5f9';

            const amt = Math.abs(parseFloat(row.amount || row.debit || row.credit || row.montant || 0)).toFixed(2);
            const isRec = String(row.type || '').toLowerCase().includes('rec') || (row.debit > 0);
            const isEncaisse = row.encaisse === true;

            tr.innerHTML = `
                <td style="padding: 10px 12px; color: #334155;">${row.date || '-'}</td>
                <td style="padding: 10px 12px; color: #334155;">${row.category || row.compte_code || '-'}</td>
                <td style="padding: 10px 12px; color: #334155;">${row.description || row.compte_libelle || '-'}</td>
                <td style="padding: 10px 12px; text-align: right; color: #dc2626; font-weight: 500;">${!isRec ? amt + ' €' : '-'}</td>
                <td style="padding: 10px 12px; text-align: right; color: #16a34a; font-weight: 500;">${isRec ? amt + ' €' : '-'}</td>
                <td style="padding: 10px 12px; text-align: center;">
                    <span style="background-color: ${isEncaisse ? '#dcfce7' : '#fef3c7'}; color: ${isEncaisse ? '#15803d' : '#d97706'}; padding: 3px 8px; border-radius: 4px; font-weight: 600; font-size: 0.75rem;">
                        ${isEncaisse ? 'Encaissé' : 'En attente'}
                    </span>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    // Association des événements de clics aux sous-boutons du Journal
    function attacherEvenementsBoutons() {
        const btns = document.querySelectorAll('div > button');
        btns.forEach(btn => {
            const txt = btn.textContent.toLowerCase();
            btn.addEventListener('click', () => {
                if (txt.includes('encaissement')) state.currentTab = 'encaissements';
                else if (txt.includes('dépenses à régler')) state.currentTab = 'depenses';
                else if (txt.includes('ventes') || txt.includes('(ve)')) state.currentTab = 've';
                else if (txt.includes('dépenses') || txt.includes('(ha)')) state.currentTab = 'ha';
                else if (txt.includes('banque') || txt.includes('(bq)')) state.currentTab = 'bq';
                
                afficherContenuJournal();
            });
        });
    }

    window.chargerDonneesJournal = chargerDonneesJournal;

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        setTimeout(() => {
            attacherEvenementsBoutons();
            chargerDonneesJournal();
        }, 200);
    } else {
        document.addEventListener('DOMContentLoaded', () => {
            attacherEvenementsBoutons();
            chargerDonneesJournal();
        });
    }
})();
