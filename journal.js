// journal.js - Gestion du Journal de Banque et Calcul du Solde Supabase

(function () {
    function getSupabase() {
        return window.supabaseClient || (window.supabase && typeof window.supabase.from === 'function' ? window.supabase : null);
    }

    async function initialiserJournal() {
        // Attachement du bouton Valider le paiement
        const btnValider = Array.from(document.querySelectorAll('button')).find(btn => 
            btn.textContent.includes('Valider') || btn.textContent.includes('paiement')
        );

        if (btnValider && !btnValider.dataset.bound) {
            btnValider.dataset.bound = "true";
            btnValider.onclick = enregistrerPaiement;
        }

        await chargerMouvements();
    }

    async function chargerMouvements() {
        const supabase = getSupabase();
        if (!supabase) return;

        // Détection du tableau dans la page
        const tables = document.querySelectorAll('table');
        let tbody = null;
        tables.forEach(t => {
            if (t.textContent.includes('Débit') || t.textContent.includes('Crédit') || t.textContent.includes('Sens') || t.textContent.includes('Mouvements')) {
                tbody = t.querySelector('tbody') || t.appendChild(document.createElement('tbody'));
            }
        });

        if (!tbody) return;

        // Lecture des données de la table Supabase
        let data = null;
        const tablesAessayer = ['ecritures_comptables', 'journal', 'journal_banque', 'transactions'];
        
        for (const tableName of tablesAessayer) {
            const res = await supabase.from(tableName).select('*');
            if (!res.error && res.data) {
                data = res.data;
                break;
            }
        }

        if (!data || data.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 20px; color: #94a3b8;">Aucun mouvement bancaire enregistré.</td></tr>`;
            mettreAJourSolde(0);
            return;
        }

        let totalSolde = 0;
        tbody.innerHTML = '';

        data.forEach((row, idx) => {
            const date = row.date_valeur || row.date || '-';
            const sens = row.sens || (row.credit > 0 ? 'Encaissement (Recette)' : 'Décaissement (Dépense)');
            const categorie = row.categorie || '-';
            const description = row.libelle || row.description || row.tiers || '-';
            
            let debit = parseFloat(row.debit) || 0;
            let credit = parseFloat(row.credit) || 0;
            const montant = parseFloat(row.montant) || 0;

            if (debit === 0 && credit === 0 && montant > 0) {
                if (sens.toLowerCase().includes('encaissement') || sens.toLowerCase().includes('recette')) {
                    credit = montant;
                } else {
                    debit = montant;
                }
            }

            totalSolde += (credit - debit);

            const tr = document.createElement('tr');
            tr.style.borderBottom = '1px solid #f1f5f9';
            tr.innerHTML = `
                <td style="padding: 10px; color: #475569;">${date}</td>
                <td style="padding: 10px;">
                    <span style="background: ${credit > 0 ? '#dcfce7' : '#fee2e2'}; color: ${credit > 0 ? '#15803d' : '#b91c1c'}; padding: 3px 8px; border-radius: 4px; font-size: 0.8rem; font-weight: 600;">
                        ${sens}
                    </span>
                </td>
                <td style="padding: 10px; color: #334155;">${categorie}</td>
                <td style="padding: 10px; color: #1e293b; font-weight: 500;">${description}</td>
                <td style="padding: 10px; color: #ef4444; font-weight: 600;">${debit > 0 ? debit.toFixed(2) + ' €' : '-'}</td>
                <td style="padding: 10px; color: #16a34a; font-weight: 600;">${credit > 0 ? credit.toFixed(2) + ' €' : '-'}</td>
                <td style="padding: 10px; text-align: center;">
                    <button onclick="supprimerMouvement('${row.id}')" style="background: none; border: none; color: #ef4444; cursor: pointer; font-weight: bold;">✕</button>
                </td>
            `;
            tbody.appendChild(tr);
        });

        mettreAJourSolde(totalSolde);
    }

    function mettreAJourSolde(solde) {
        const elSolde = Array.from(document.querySelectorAll('div, span, p, h2, h3')).find(el => 
            el.textContent && el.textContent.includes('Solde du compte bancaire')
        );

        if (elSolde) {
            const couleur = solde >= 0 ? '#2563eb' : '#dc2626';
            elSolde.innerHTML = `Solde du compte bancaire : <strong style="color: ${couleur}; font-size: 1.25rem;">${solde.toFixed(2)} €</strong>`;
        }
    }

    async function enregistrerPaiement(e) {
        if (e && e.preventDefault) e.preventDefault();

        const supabase = getSupabase();
        if (!supabase) {
            alert("Erreur de connexion avec Supabase.");
            return;
        }

        const inputs = document.querySelectorAll('input, select');
        let dateVal = '', sensVal = '', catVal = '', libelleVal = '', montantVal = 0;

        inputs.forEach(i => {
            if (i.type === 'date') dateVal = i.value;
            else if (i.tagName === 'SELECT' && i.options[i.selectedIndex]?.text.includes('Encaissement')) sensVal = i.value || i.options[i.selectedIndex].text;
            else if (i.tagName === 'SELECT') catVal = i.value || i.options[i.selectedIndex].text;
            else if (i.type === 'text' || i.placeholder?.includes('Virement')) libelleVal = i.value;
            else if (i.type === 'number' || i.placeholder === '0.00') montantVal = parseFloat(i.value) || 0;
        });

        if (!dateVal || !montantVal || montantVal <= 0) {
            alert("Veuillez remplir la date et le montant.");
            return;
        }

        const estRecette = sensVal.toLowerCase().includes('encaissement') || sensVal.toLowerCase().includes('recette');
        const payload = {
            date_valeur: dateVal,
            sens: sensVal,
            categorie: catVal,
            libelle: libelleVal,
            montant: montantVal,
            credit: estRecette ? montantVal : 0,
            debit: estRecette ? 0 : montantVal
        };

        const tablesAessayer = ['ecritures_comptables', 'journal', 'journal_banque', 'transactions'];
        let reussi = false;

        for (const tableName of tablesAessayer) {
            const { error } = await supabase.from(tableName).insert([payload]);
            if (!error) {
                reussi = true;
                break;
            }
        }

        if (reussi) {
            alert("Paiement enregistré avec succès !");
            chargerMouvements();
        } else {
            alert("Erreur lors de la sauvegarde dans Supabase.");
        }
    }

    window.supprimerMouvement = async function(id) {
        if (!confirm("Voulez-vous supprimer cette écriture ?")) return;
        const supabase = getSupabase();
        if (!supabase) return;

        const tablesAessayer = ['ecritures_comptables', 'journal', 'journal_banque', 'transactions'];
        for (const tableName of tablesAessayer) {
            const { error } = await supabase.from(tableName).delete().eq('id', id);
            if (!error) break;
        }
        chargerMouvements();
    };

    window.initialiserJournal = initialiserJournal;

    // Écouteur de changement d'onglet
    document.addEventListener('click', (e) => {
        const el = e.target.closest('button, a, div');
        if (el && el.textContent && el.textContent.trim().toLowerCase().includes('journal')) {
            setTimeout(initialiserJournal, 150);
        }
    });

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        setTimeout(initialiserJournal, 200);
    } else {
        document.addEventListener('DOMContentLoaded', initialiserJournal);
    }
})();
