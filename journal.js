// journal.js - Rendu dynamique du Journal et des sous-onglets

(function () {
    function getSupabase() {
        return window.supabaseClient || (window.supabase && typeof window.supabase.from === 'function' ? window.supabase : null);
    }

    let currentFilter = 'TOUS';

    async function initJournalUI() {
        const table = document.querySelector('table');
        if (!table) return;

        // 1. Création de la barre de filtres si elle n'existe pas
        let filterBar = document.getElementById('journal-filter-bar');
        if (!filterBar) {
            filterBar = document.createElement('div');
            filterBar.id = 'journal-filter-bar';
            filterBar.style.cssText = 'display: flex; gap: 10px; margin-bottom: 15px; flex-wrap: wrap;';
            filterBar.innerHTML = `
                <button data-filter="TOUS" style="padding: 6px 14px; border-radius: 6px; border: 1px solid #cbd5e1; background-color: #2563eb; color: white; cursor: pointer; font-weight: 600;">
                    Tous les journaux
                </button>
                <button data-filter="RECETTE" style="padding: 6px 14px; border-radius: 6px; border: 1px solid #cbd5e1; background-color: #f1f5f9; color: #334155; cursor: pointer; font-weight: 500;">
                    🟢 Encaissements (VE)
                </button>
                <button data-filter="DEPENSE" style="padding: 6px 14px; border-radius: 6px; border: 1px solid #cbd5e1; background-color: #f1f5f9; color: #334155; cursor: pointer; font-weight: 500;">
                    🔴 Dépenses (HA)
                </button>
                <button data-filter="BANQUE" style="padding: 6px 14px; border-radius: 6px; border: 1px solid #cbd5e1; background-color: #f1f5f9; color: #334155; cursor: pointer; font-weight: 500;">
                    🏦 Journal Banque (512)
                </button>
            `;

            table.parentNode.insertBefore(filterBar, table);

            // Gestionnaires de clic sur les boutons de filtre
            filterBar.querySelectorAll('button').forEach(btn => {
                btn.addEventListener('click', () => {
                    filterBar.querySelectorAll('button').forEach(b => {
                        b.style.backgroundColor = '#f1f5f9';
                        b.style.color = '#334155';
                        b.style.fontWeight = '500';
                    });
                    btn.style.backgroundColor = '#2563eb';
                    btn.style.color = 'white';
                    btn.style.fontWeight = '600';
                    currentFilter = btn.getAttribute('data-filter');
                    chargerEtAfficherJournal();
                });
            });
        }

        await chargerEtAfficherJournal();
    }

    async function chargerEtAfficherJournal() {
        const supabase = getSupabase();
        const table = document.querySelector('table');
        if (!table) return;

        let tbody = table.querySelector('tbody');
        if (!tbody) {
            tbody = document.createElement('tbody');
            table.appendChild(tbody);
        }

        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 20px; color: #64748b;">Chargement des écritures...</td></tr>`;

        let ecritures = [];

        if (supabase) {
            // Tentative de récupération depuis 'ecritures_comptables', fallback sur 'transactions'
            const { data: ecrData } = await supabase.from('ecritures_comptables').select('*').order('date', { ascending: false });
            if (ecrData && ecrData.length > 0) {
                ecritures = ecrData;
            } else {
                const { data: txData } = await supabase.from('transactions').select('*').order('date', { ascending: false });
                ecritures = txData || [];
            }
        } else {
            ecritures = JSON.parse(localStorage.getItem('transactions') || '[]');
        }

        // Filtre selon le sous-onglet sélectionné
        const donneesFiltrees = ecritures.filter(row => {
            const cat = String(row.category || row.compte_code || '').toLowerCase();
            const type = String(row.type || '').toLowerCase();

            if (currentFilter === 'RECETTE') {
                return type.includes('rec') || cat.includes('soins') || row.credit > 0;
            } else if (currentFilter === 'DEPENSE') {
                return type.includes('dep') || type.includes('dép') || (row.debit > 0 && row.compte_code !== '512000');
            } else if (currentFilter === 'BANQUE') {
                return (row.compte_code && row.compte_code.startsWith('512')) || row.payment_method;
            }
            return true;
        });

        tbody.innerHTML = '';

        if (donneesFiltrees.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 20px; color: #94a3b8;">Aucune écriture enregistrée.</td></tr>`;
            return;
        }

        donneesFiltrees.forEach(row => {
            const tr = document.createElement('tr');
            tr.style.borderBottom = '1px solid #f1f5f9';

            const date = row.date || '-';
            const cat = row.category || row.compte_code || '-';
            const desc = row.description || row.compte_libelle || '-';
            
            let debitVal = parseFloat(row.debit || 0);
            let creditVal = parseFloat(row.credit || 0);

            // Rétrocompatibilité si enregistrement direct de transactions
            if (!row.compte_code && row.amount) {
                const amt = Math.abs(parseFloat(row.amount));
                const isRec = String(row.type || '').toLowerCase().includes('rec') || String(row.category || '').toLowerCase().includes('soins');
                if (isRec) creditVal = amt;
                else debitVal = amt;
            }

            tr.innerHTML = `
                <td style="padding: 10px 12px; color: #334155;">${date}</td>
                <td style="padding: 10px 12px; color: #334155; font-weight: 600;">${cat}</td>
                <td style="padding: 10px 12px; color: #334155;">${desc}</td>
                <td style="padding: 10px 12px; text-align: right; color: #dc2626; font-weight: 500;">${debitVal > 0 ? debitVal.toFixed(2) + ' €' : '-'}</td>
                <td style="padding: 10px 12px; text-align: right; color: #16a34a; font-weight: 500;">${creditVal > 0 ? creditVal.toFixed(2) + ' €' : '-'}</td>
                <td style="padding: 10px 12px; text-align: center;">
                    <span style="background-color: #dcfce7; color: #15803d; padding: 3px 8px; border-radius: 4px; font-weight: 600; font-size: 0.75rem;">
                        Comptabilisé
                    </span>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    window.initJournalUI = initJournalUI;

    // Déclenchement automatique au chargement du DOM ou au clic d'onglet
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        setTimeout(initJournalUI, 150);
    } else {
        document.addEventListener('DOMContentLoaded', initJournalUI);
    }

    document.addEventListener('click', (e) => {
        if (e.target && e.target.textContent && e.target.textContent.includes('Journal')) {
            setTimeout(initJournalUI, 150);
        }
    });
})();
