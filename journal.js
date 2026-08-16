// journal.js - Rendu direct et robuste du Journal des Écritures

(function () {
    function getSupabase() {
        return window.supabaseClient || (window.supabase && typeof window.supabase.from === 'function' ? window.supabase : null);
    }

    let filterActif = 'TOUS';

    async function initialiserRenduJournal() {
        // 1. Détection de la zone "Journal des écritures"
        let conteneurTitre = Array.from(document.querySelectorAll('h1, h2, h3, h4, div, span, p'))
            .find(el => el.textContent && el.textContent.trim().toLowerCase() === 'journal des écritures');

        if (!conteneurTitre) return;

        let zoneJournal = conteneurTitre.closest('div.card, div.bg-white, section, main') || conteneurTitre.parentElement;
        if (!zoneJournal) return;

        // 2. Vérification/Injection de la barre de boutons de filtres
        let filterBar = zoneJournal.querySelector('#journal-filter-bar');
        if (!filterBar) {
            filterBar = document.createElement('div');
            filterBar.id = 'journal-filter-bar';
            filterBar.style.cssText = 'display: flex; gap: 10px; margin: 15px 0; flex-wrap: wrap;';
            filterBar.innerHTML = `
                <button data-f="TOUS" style="padding: 6px 14px; border-radius: 6px; border: none; background-color: #2563eb; color: white; cursor: pointer; font-weight: 600;">Tous les journaux</button>
                <button data-f="REC" style="padding: 6px 14px; border-radius: 6px; border: 1px solid #cbd5e1; background-color: #f8fafc; color: #334155; cursor: pointer; font-weight: 500;">🟢 Encaissements (VE)</button>
                <button data-f="DEP" style="padding: 6px 14px; border-radius: 6px; border: 1px solid #cbd5e1; background-color: #f8fafc; color: #334155; cursor: pointer; font-weight: 500;">🔴 Dépenses (HA)</button>
                <button data-f="BQ" style="padding: 6px 14px; border-radius: 6px; border: 1px solid #cbd5e1; background-color: #f8fafc; color: #334155; cursor: pointer; font-weight: 500;">🏦 Banque (512)</button>
            `;
            conteneurTitre.parentNode.insertBefore(filterBar, conteneurTitre.nextSibling);

            filterBar.querySelectorAll('button').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    filterBar.querySelectorAll('button').forEach(b => {
                        b.style.backgroundColor = '#f8fafc';
                        b.style.color = '#334155';
                        b.style.border = '1px solid #cbd5e1';
                    });
                    btn.style.backgroundColor = '#2563eb';
                    btn.style.color = 'white';
                    btn.style.border = 'none';
                    filterActif = btn.getAttribute('data-f');
                    chargerDonneesEtRendre();
                });
            });
        }

        // 3. Ciblage du tableau HTML dans la zone
        let table = zoneJournal.querySelector('table');
        if (!table) return;

        let tbody = table.querySelector('tbody');
        if (!tbody) {
            tbody = document.createElement('tbody');
            table.appendChild(tbody);
        }

        await chargerDonneesEtRendre(tbody);
    }

    async function chargerDonneesEtRendre(tbodyTarget) {
        let tbody = tbodyTarget;
        if (!tbody) {
            let table = document.querySelector('table');
            if (table) tbody = table.querySelector('tbody') || table.appendChild(document.createElement('tbody'));
        }
        if (!tbody) return;

        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 20px; color: #64748b;">Chargement des données...</td></tr>`;

        const supabase = getSupabase();
        let ecritures = [];

        try {
            if (supabase) {
                const { data: ecr } = await supabase.from('ecritures_comptables').select('*').order('date', { ascending: false });
                if (ecr && ecr.length > 0) {
                    ecritures = ecr;
                } else {
                    const { data: tx } = await supabase.from('transactions').select('*').order('date', { ascending: false });
                    ecritures = tx || [];
                }
            } else {
                ecritures = JSON.parse(localStorage.getItem('transactions') || '[]');
            }
        } catch (e) {
            console.error("Erreur Supabase Journal:", e);
        }

        // Filtrage
        const donnesFiltrees = ecritures.filter(row => {
            const cat = String(row.category || row.compte_code || '').toLowerCase();
            const type = String(row.type || '').toLowerCase();

            if (filterActif === 'REC') return type.includes('rec') || cat.includes('soins') || row.credit > 0;
            if (filterActif === 'DEP') return type.includes('dep') || type.includes('dép') || (row.debit > 0 && row.compte_code !== '512000');
            if (filterActif === 'BQ') return (row.compte_code && row.compte_code.startsWith('512')) || row.payment_method;
            return true;
        });

        tbody.innerHTML = '';

        if (donnesFiltrees.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 25px; color: #94a3b8;">Aucune donnée disponible.</td></tr>`;
            return;
        }

        donnesFiltrees.forEach(row => {
            const tr = document.createElement('tr');
            tr.style.borderBottom = '1px solid #f1f5f9';

            let debitVal = parseFloat(row.debit || 0);
            let creditVal = parseFloat(row.credit || 0);

            if (!row.compte_code && row.amount) {
                const amt = Math.abs(parseFloat(row.amount));
                const isRec = String(row.type || '').toLowerCase().includes('rec') || String(row.category || '').toLowerCase().includes('soins');
                if (isRec) creditVal = amt;
                else debitVal = amt;
            }

            tr.innerHTML = `
                <td style="padding: 10px 12px; color: #334155;">${row.date || '-'}</td>
                <td style="padding: 10px 12px; color: #334155; font-weight: 600;">${row.category || row.compte_code || '-'}</td>
                <td style="padding: 10px 12px; color: #334155;">${row.description || row.compte_libelle || '-'}</td>
                <td style="padding: 10px 12px; text-align: right; color: #dc2626; font-weight: 500;">${debitVal > 0 ? debitVal.toFixed(2) + ' €' : '-'}</td>
                <td style="padding: 10px 12px; text-align: right; color: #16a34a; font-weight: 500;">${creditVal > 0 ? creditVal.toFixed(2) + ' €' : '-'}</td>
                <td style="padding: 10px 12px; text-align: center;">
                    <span style="background-color: #dcfce7; color: #15803d; padding: 3px 8px; border-radius: 4px; font-weight: 600; font-size: 0.75rem;">Comptabilisé</span>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    // Écouteur global pour réagir immédiatement au clic sur l'onglet Journal
    document.addEventListener('click', (e) => {
        const btn = e.target.closest('button, a, div');
        if (btn && btn.textContent && btn.textContent.trim().toLowerCase().includes('journal')) {
            setTimeout(initialiserRenduJournal, 100);
            setTimeout(initialiserRenduJournal, 400);
        }
    });

    window.initialiserRenduJournal = initialiserRenduJournal;

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        setTimeout(initialiserRenduJournal, 300);
    } else {
        document.addEventListener('DOMContentLoaded', initialiserRenduJournal);
    }
})();
