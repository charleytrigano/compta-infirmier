// journal.js - Gestionnaire robuste du Journal des Écritures

(function () {
    function getSupabase() {
        return window.supabaseClient || (window.supabase && typeof window.supabase.from === 'function' ? window.supabase : null);
    }

    let currentFilter = 'TOUS';

    // Cible la table appartenant spécifiquement au bloc "Journal des écritures"
    function trouverTableJournal() {
        const elTitre = Array.from(document.querySelectorAll('h1, h2, h3, h4, div, span, p'))
            .find(el => el.textContent && el.textContent.trim().toLowerCase().includes('journal des écritures'));
        
        if (elTitre) {
            const conteneur = elTitre.closest('div, section, main') || elTitre.parentElement;
            if (conteneur) {
                const table = conteneur.querySelector('table');
                if (table) return table;
            }
        }
        
        // Fallback : prend la table actuellement visible à l'écran
        const tables = Array.from(document.querySelectorAll('table'));
        return tables.find(t => t.offsetParent !== null) || tables[0];
    }

    async function chargerEtAfficherJournal() {
        const table = trouverTableJournal();
        if (!table) return;

        // 1. Injection de la barre de filtres au-dessus du tableau si elle est absente
        const parent = table.parentNode;
        let filterBar = parent.querySelector('#journal-filter-bar');
        
        if (!filterBar) {
            filterBar = document.createElement('div');
            filterBar.id = 'journal-filter-bar';
            filterBar.style.cssText = 'display: flex; gap: 10px; margin-bottom: 15px; flex-wrap: wrap; margin-top: 10px;';
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

            parent.insertBefore(filterBar, table);

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

        let tbody = table.querySelector('tbody');
        if (!tbody) {
            tbody = document.createElement('tbody');
            table.appendChild(tbody);
        }

        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 20px; color: #64748b;">Chargement des écritures...</td></tr>`;

        // 2. Lecture des données depuis Supabase
        const supabase = getSupabase();
        let ecritures = [];

        if (supabase) {
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

        // 3. Filtrage dynamique selon le sous-onglet actif
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
            tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 20px; color: #94a3b8;">Aucune écriture enregistrée dans Supabase.</td></tr>`;
            return;
        }

        // 4. Génération des lignes du tableau
        donneesFiltrees.forEach(row => {
            const tr = document.createElement('tr');
            tr.style.borderBottom = '1px solid #f1f5f9';

            const date = row.date || '-';
            const cat = row.category || row.compte_code || '-';
            const desc = row.description || row.compte_libelle || '-';
            
            let debitVal = parseFloat(row.debit || 0);
            let creditVal = parseFloat(row.credit || 0);

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

    // Réactualise l'affichage dès que l'utilisateur clique sur le bouton "Journal"
    document.addEventListener('click', (e) => {
        const target = e.target;
        if (target && target.textContent && target.textContent.trim().toLowerCase().includes('journal')) {
            setTimeout(chargerEtAfficherJournal, 100);
            setTimeout(chargerEtAfficherJournal, 300);
        }
    });

    window.chargerEtAfficherJournal = chargerEtAfficherJournal;

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        setTimeout(chargerEtAfficherJournal, 200);
    } else {
        document.addEventListener('DOMContentLoaded', chargerEtAfficherJournal);
    }
})();
