// journal.js - Gestion sécurisée du Journal de Banque

(function () {
    function getSupabase() {
        return window.supabaseClient || (window.supabase && typeof window.supabase.from === 'function' ? window.supabase : null);
    }

    function getAppContent() {
        return document.getElementById('app-content');
    }

    async function chargerJournal() {
        const target = getAppContent();
        if (!target) return;

        target.innerHTML = `
            <div class="bg-white p-6 rounded-xl shadow-sm mb-6 border border-slate-200">
                <h2 class="text-lg font-bold text-slate-800 mb-2">🏦 Journal de Banque & Règlements</h2>
                <div class="p-4 bg-blue-50 border-l-4 border-blue-600 rounded-r-lg mb-6">
                    <p class="text-slate-700 font-medium">
                        Solde du compte bancaire : <strong id="solde-affichage" class="text-blue-600 text-xl">0.00 €</strong>
                    </p>
                </div>

                <!-- Formulaire -->
                <form id="form-paiement" class="grid grid-cols-1 md:grid-cols-5 gap-3 mb-6 bg-slate-50 p-4 rounded-lg border border-slate-200">
                    <div>
                        <label class="block text-xs font-semibold text-slate-600 mb-1">Date de valeur *</label>
                        <input type="date" id="input-date" required class="w-full p-2 border rounded-md text-sm">
                    </div>
                    <div>
                        <label class="block text-xs font-semibold text-slate-600 mb-1">Sens du flux *</label>
                        <select id="input-sens" class="w-full p-2 border rounded-md text-sm">
                            <option value="Encaissement (Recette)">Encaissement (Recette)</option>
                            <option value="Décaissement (Dépense)">Décaissement (Dépense)</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-xs font-semibold text-slate-600 mb-1">Catégorie *</label>
                        <select id="input-cat" class="w-full p-2 border rounded-md text-sm">
                            <option>Soins infirmiers</option>
                            <option>URSSAF</option>
                            <option>CARPIMKO</option>
                            <option>Frais généraux</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-xs font-semibold text-slate-600 mb-1">Libellé / Tiers *</label>
                        <input type="text" id="input-libelle" placeholder="Ex: Virement CPAM..." required class="w-full p-2 border rounded-md text-sm">
                    </div>
                    <div>
                        <label class="block text-xs font-semibold text-slate-600 mb-1">Montant (€) *</label>
                        <input type="number" step="0.01" id="input-montant" placeholder="0.00" required class="w-full p-2 border rounded-md text-sm">
                    </div>
                    <div class="md:col-span-5 text-right mt-2">
                        <button type="submit" class="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-5 py-2 rounded-lg text-sm transition">
                            💳 Valider le paiement
                        </button>
                    </div>
                </form>

                <!-- Tableau -->
                <div class="overflow-x-auto">
                    <table class="w-full text-left text-sm border-collapse">
                        <thead>
                            <tr class="bg-slate-50 border-b text-slate-600">
                                <th class="p-3">Date</th>
                                <th class="p-3">Sens</th>
                                <th class="p-3">Catégorie</th>
                                <th class="p-3">Description</th>
                                <th class="p-3 text-red-600">Débit (-)</th>
                                <th class="p-3 text-emerald-600">Crédit (+)</th>
                                <th class="p-3 text-center">Action</th>
                            </tr>
                        </thead>
                        <tbody id="mouvements-tbody">
                            <tr><td colspan="7" class="text-center p-4 text-slate-400">Chargement des données...</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        document.getElementById('form-paiement').onsubmit = enregistrerPaiement;
        await rafraichirMouvements();
    }

    async function rafraichirMouvements() {
        const supabase = getSupabase();
        const tbody = document.getElementById('mouvements-tbody');
        const soldeEl = document.getElementById('solde-affichage');
        if (!supabase || !tbody) return;

        let data = null;
        const tables = ['ecritures_comptables', 'journal_banque', 'journal', 'transactions'];

        for (const t of tables) {
            const res = await supabase.from(t).select('*');
            if (!res.error && res.data) { data = res.data; break; }
        }

        if (!data || data.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="text-center p-4 text-slate-400">Aucun mouvement enregistré.</td></tr>`;
            if (soldeEl) soldeEl.textContent = '0.00 €';
            return;
        }

        let totalSolde = 0;
        tbody.innerHTML = data.map(row => {
            const date = row.date_valeur || row.date || '-';
            const sens = row.sens || (row.credit > 0 ? 'Encaissement (Recette)' : 'Décaissement (Dépense)');
            const cat = row.categorie || '-';
            const lib = row.libelle || row.description || '-';
            
            let debit = parseFloat(row.debit) || 0;
            let credit = parseFloat(row.credit) || 0;
            const montant = parseFloat(row.montant) || 0;

            if (debit === 0 && credit === 0 && montant > 0) {
                if (sens.toLowerCase().includes('encaissement') || sens.toLowerCase().includes('recette')) credit = montant;
                else debit = montant;
            }

            totalSolde += (credit - debit);

            return `
                <tr class="border-b hover:bg-slate-50">
                    <td class="p-3 text-slate-600">${date}</td>
                    <td class="p-3"><span class="px-2 py-1 text-xs font-semibold rounded ${credit > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}">${sens}</span></td>
                    <td class="p-3 text-slate-700">${cat}</td>
                    <td class="p-3 font-medium text-slate-900">${lib}</td>
                    <td class="p-3 text-red-600 font-semibold">${debit > 0 ? debit.toFixed(2) + ' €' : '-'}</td>
                    <td class="p-3 text-emerald-600 font-semibold">${credit > 0 ? credit.toFixed(2) + ' €' : '-'}</td>
                    <td class="p-3 text-center">
                        <button onclick="window.supprimerEcriture('${row.id}')" class="text-red-500 hover:text-red-700 font-bold">✕</button>
                    </td>
                </tr>
            `;
        }).join('');

        if (soldeEl) {
            soldeEl.textContent = `${totalSolde.toFixed(2)} €`;
            soldeEl.className = totalSolde >= 0 ? "text-blue-600 text-xl font-bold" : "text-red-600 text-xl font-bold";
        }
    }

    async function enregistrerPaiement(e) {
        e.preventDefault();
        const supabase = getSupabase();
        if (!supabase) return;

        const dateVal = document.getElementById('input-date').value;
        const sensVal = document.getElementById('input-sens').value;
        const catVal = document.getElementById('input-cat').value;
        const libelleVal = document.getElementById('input-libelle').value;
        const montantVal = parseFloat(document.getElementById('input-montant').value) || 0;

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

        const tables = ['ecritures_comptables', 'journal_banque', 'journal', 'transactions'];
        for (const t of tables) {
            const { error } = await supabase.from(t).insert([payload]);
            if (!error) {
                alert("Paiement enregistré !");
                chargerJournal();
                return;
            }
        }
        alert("Erreur lors de l'enregistrement Supabase.");
    }

    window.supprimerEcriture = async function(id) {
        if (!confirm("Supprimer cette ligne ?")) return;
        const supabase = getSupabase();
        const tables = ['ecritures_comptables', 'journal_banque', 'journal', 'transactions'];
        for (const t of tables) {
            const { error } = await supabase.from(t).delete().eq('id', id);
            if (!error) break;
        }
        chargerJournal();
    };

    window.chargerJournal = chargerJournal;
})();
