// grand_livre.js - Gestion intégrale de la partie double (Classes 4, 5, 6, 7)

(function () {
    function getSupabaseClient() {
        return window.supabaseClient || (window.supabase && typeof window.supabase.from === 'function' ? window.supabase : null);
    }

    let state = {
        transactions: [],
        compteFiltre: 'TOUS'
    };

    const NOMS_CLASSES = {
        '1': 'Classe 1 - Comptes de capitaux',
        '2': 'Classe 2 - Comptes d\'immobilisations',
        '3': 'Classe 3 - Comptes de stocks et en-cours',
        '4': 'Classe 4 - Comptes de tiers (Patients / Mutuelles)',
        '5': 'Classe 5 - Comptes financiers (Banque / Caisse)',
        '6': 'Classe 6 - Comptes de charges (URSSAF / CARPIMKO / Frais)',
        '7': 'Classe 7 - Comptes de produits (Honoraires)',
        '8': 'Classe 8 - Comptes spéciaux',
        '9': 'Classe 9 - Comptes analytiques'
    };

    function trouverConteneurGrandLivre() {
        const elements = document.querySelectorAll('div, section, main');
        for (let i = elements.length - 1; i >= 0; i--) {
            const el = elements[i];
            if (el.children.length <= 4 && el.textContent.includes('Chargement du grand livre...')) {
                return el;
            }
        }
        return document.getElementById('grand-livre-content') || document.querySelector('.card');
    }

    async function initGrandLivre() {
        const container = trouverConteneurGrandLivre();
        if (!container) return;

        container.innerHTML = `
            <div style="padding: 10px;">
                <div style="display: flex; justify-content: flex-end; align-items: center; margin-bottom: 15px;">
                    <div style="min-width: 320px; display: flex; align-items: center; gap: 8px;">
                        <label for="filtreCompte" style="font-weight: 600; font-size: 0.875rem; color: #374151; white-space: nowrap;">Filtrer par compte :</label>
                        <select id="filtreCompte" style="padding: 6px 12px; border: 1px solid #d1d5db; border-radius: 6px; width: 100%; background-color: #fff;">
                            <option value="TOUS">Tous les comptes (Vue globale)</option>
                        </select>
                    </div>
                </div>

                <div id="grandLivreContainer" style="display: flex; flex-direction: column; gap: 20px;">
                    <div style="text-align: center; padding: 20px; color: #6b7280;">Chargement du Grand Livre...</div>
                </div>

                <div style="margin-top: 25px; padding: 15px; background-color: #1e293b; color: white; border-radius: 8px; font-weight: bold; font-size: 1rem; display: flex; justify-content: space-between; flex-wrap: wrap; gap: 10px;">
                    <span>TOTAL GÉNÉRAL DU GRAND LIVRE :</span>
                    <div style="display: flex; gap: 30px;">
                        <span style="color: #4ade80;">Débit : <span id="totalGeneralDebit">0.00 €</span></span>
                        <span style="color: #f87171;">Crédit : <span id="totalGeneralCredit">0.00 €</span></span>
                        <span>Solde : <span id="totalGeneralSolde">0.00 €</span></span>
                    </div>
                </div>
            </div>
        `;

        await chargerDonnees();
        initialiserFiltres();
        afficherGrandLivre();
    }

    async function chargerDonnees() {
        const supabase = getSupabaseClient();
        if (supabase) {
            try {
                const { data: txData } = await supabase.from('transactions').select('*').order('date', { ascending: true });
                state.transactions = txData || [];
            } catch (err) {
                state.transactions = JSON.parse(localStorage.getItem('transactions') || '[]');
            }
        } else {
            state.transactions = JSON.parse(localStorage.getItem('transactions') || '[]');
        }
    }

    // Génération des 2 écritures en partie double pour chaque transaction
    function genererEcrituresPartieDouble(tx) {
        const val = Math.abs(parseFloat(tx.amount || tx.montant || 0));
        const type = String(tx.type || '').toLowerCase();
        const cat = (tx.category || tx.categorie || '').toLowerCase();
        const desc = (tx.description || '').trim();
        const date = tx.date || '-';

        const ecritures = [];
        const isRecette = type.includes('recette') || type.includes('rec') || cat.includes('soins');

        if (isRecette) {
            // Écriture 1 : Entrée de trésorerie (Classe 5 - Banque DÉBIT)
            ecritures.push({
                date: date,
                compteCode: '512000',
                compteNom: '512000 - Banque / Compte Courant',
                category: tx.category || 'Soins infirmiers',
                description: `Encaissement : ${desc || 'Patient'}`,
                debit: val,
                credit: 0
            });

            // Écriture 2 : Compte Tiers Patient (Classe 4 - CRÉDIT)
            const codePatient = desc ? `411${desc.replace(/[^a-zA-Z0-9]/g, '').substring(0, 4).toUpperCase()}` : '411000';
            ecritures.push({
                date: date,
                compteCode: codePatient,
                compteNom: `${codePatient} - Patient / Tiers (${desc || 'Divers'})`,
                category: tx.category || 'Soins infirmiers',
                description: `Règlement soins : ${desc || 'Patient'}`,
                debit: 0,
                credit: val
            });
        } else {
            // Écriture 1 : Charge (Classe 6 - DÉBIT)
            let codeCharge = '606000';
            let nomCharge = '606000 - Achats et fournitures';

            if (cat.includes('carpimko')) {
                codeCharge = '646000';
                nomCharge = '646000 - Cotisations sociales CARPIMKO';
            } else if (cat.includes('urssaf')) {
                codeCharge = '645000';
                nomCharge = '645000 - Cotisations URSSAF';
            }

            ecritures.push({
                date: date,
                compteCode: codeCharge,
                compteNom: nomCharge,
                category: tx.category || 'Dépense',
                description: desc || 'Paiement charge',
                debit: val,
                credit: 0
            });

            // Écriture 2 : Sortie de trésorerie (Classe 5 - Banque CRÉDIT)
            ecritures.push({
                date: date,
                compteCode: '512000',
                compteNom: '512000 - Banque / Compte Courant',
                category: tx.category || 'Dépense',
                description: `Décaissement : ${desc || 'Charge'}`,
                debit: 0,
                credit: val
            });
        }

        return ecritures;
    }

    function obtenirToutesLesEcritures() {
        let toutes = [];
        state.transactions.forEach(tx => {
            toutes = toutes.concat(genererEcrituresPartieDouble(tx));
        });
        return toutes;
    }

    function initialiserFiltres() {
        const select = document.getElementById('filtreCompte');
        if (!select) return;

        const comptesMap = new Map();
        const ecritures = obtenirToutesLesEcritures();

        ecritures.forEach(e => {
            if (!comptesMap.has(e.compteCode)) comptesMap.set(e.compteCode, e.compteNom);
        });

        select.innerHTML = '<option value="TOUS">Tous les comptes (Vue globale)</option>';
        Array.from(comptesMap.entries())
            .sort((a, b) => a[0].localeCompare(b[0]))
            .forEach(([code, nom]) => {
                const opt = document.createElement('option');
                opt.value = code;
                opt.textContent = nom;
                select.appendChild(opt);
            });

        select.addEventListener('change', (e) => {
            state.compteFiltre = e.target.value;
            afficherGrandLivre();
        });
    }

    function afficherGrandLivre() {
        const container = document.getElementById('grandLivreContainer');
        const totDebitEl = document.getElementById('totalGeneralDebit');
        const totCreditEl = document.getElementById('totalGeneralCredit');
        const totSoldeEl = document.getElementById('totalGeneralSolde');

        if (!container) return;
        container.innerHTML = '';

        let totalGeneralDebit = 0;
        let totalGeneralCredit = 0;

        const arborescence = {};
        for (let i = 1; i <= 9; i++) {
            arborescence[String(i)] = {};
        }

        const ecritures = obtenirToutesLesEcritures();

        ecritures.forEach(e => {
            if (state.compteFiltre !== 'TOUS' && e.compteCode !== state.compteFiltre) return;

            const numClasse = e.compteCode.charAt(0);
            const numCompte = e.compteCode;

            if (arborescence[numClasse]) {
                if (!arborescence[numClasse][numCompte]) {
                    arborescence[numClasse][numCompte] = {
                        nom: e.compteNom,
                        ecritures: []
                    };
                }
                arborescence[numClasse][numCompte].ecritures.push(e);
            }
        });

        for (let i = 1; i <= 9; i++) {
            const numClasse = String(i);
            const comptes = arborescence[numClasse];
            const comptesTries = Object.keys(comptes).sort();

            let totalClasseDebit = 0;
            let totalClasseCredit = 0;

            const classBloc = document.createElement('div');
            classBloc.style.border = '1px solid #cbd5e1';
            classBloc.style.borderRadius = '8px';
            classBloc.style.overflow = 'hidden';

            const classHeader = document.createElement('div');
            classHeader.style.backgroundColor = '#0f172a';
            classHeader.style.color = '#ffffff';
            classHeader.style.padding = '10px 15px';
            classHeader.style.fontWeight = 'bold';
            classHeader.style.fontSize = '1rem';
            classHeader.textContent = NOMS_CLASSES[numClasse];
            classBloc.appendChild(classHeader);

            if (comptesTries.length === 0) {
                const emptyDiv = document.createElement('div');
                emptyDiv.style.padding = '12px 15px';
                emptyDiv.style.color = '#94a3b8';
                emptyDiv.style.fontSize = '0.875rem';
                emptyDiv.style.fontStyle = 'italic';
                emptyDiv.textContent = 'Aucune écriture pour cette classe.';
                classBloc.appendChild(emptyDiv);
            } else {
                comptesTries.forEach(numCompte => {
                    const compteData = comptes[numCompte];
                    let subTotalDebit = 0;
                    let subTotalCredit = 0;

                    const table = document.createElement('table');
                    table.style.width = '100%';
                    table.style.borderCollapse = 'collapse';
                    table.style.fontSize = '0.875rem';

                    let htmlContent = `
                        <thead>
                            <tr style="background-color: #f1f5f9; border-bottom: 1px solid #cbd5e1;">
                                <th colspan="6" style="padding: 8px 12px; color: #1e293b; text-align: left; font-size: 0.9rem;">
                                    📁 <strong>${compteData.nom}</strong>
                                </th>
                            </tr>
                            <tr style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0; color: #64748b;">
                                <th style="padding: 6px 12px; text-align: left; width: 100px;">Date</th>
                                <th style="padding: 6px 12px; text-align: left; width: 100px;">Compte</th>
                                <th style="padding: 6px 12px; text-align: left;">Catégorie</th>
                                <th style="padding: 6px 12px; text-align: left;">Description</th>
                                <th style="padding: 6px 12px; text-align: right; width: 120px;">Débit (€)</th>
                                <th style="padding: 6px 12px; text-align: right; width: 120px;">Crédit (€)</th>
                            </tr>
                        </thead>
                        <tbody>
                    `;

                    compteData.ecritures.forEach(e => {
                        subTotalDebit += e.debit;
                        subTotalCredit += e.credit;

                        htmlContent += `
                            <tr style="border-bottom: 1px solid #f1f5f9;">
                                <td style="padding: 6px 12px;">${e.date}</td>
                                <td style="padding: 6px 12px;"><strong>${numCompte}</strong></td>
                                <td style="padding: 6px 12px;">${e.category}</td>
                                <td style="padding: 6px 12px;">${e.description}</td>
                                <td style="padding: 6px 12px; text-align: right; color: #16a34a; font-weight: 500;">${e.debit > 0 ? e.debit.toFixed(2) + ' €' : '-'}</td>
                                <td style="padding: 6px 12px; text-align: right; color: #dc2626; font-weight: 500;">${e.credit > 0 ? e.credit.toFixed(2) + ' €' : '-'}</td>
                            </tr>
                        `;
                    });

                    totalClasseDebit += subTotalDebit;
                    totalClasseCredit += subTotalCredit;

                    const subSolde = subTotalDebit - subTotalCredit;
                    htmlContent += `
                        </tbody>
                        <tfoot>
                            <tr style="background-color: #f8fafc; border-top: 2px solid #cbd5e1; font-weight: 600;">
                                <td colspan="4" style="text-align: right; padding: 6px 12px; color: #334155;">Sous-total (${numCompte}) :</td>
                                <td style="text-align: right; padding: 6px 12px; color: #16a34a;">${subTotalDebit.toFixed(2)} €</td>
                                <td style="text-align: right; padding: 6px 12px; color: #dc2626;">${subTotalCredit.toFixed(2)} €</td>
                            </tr>
                            <tr style="background-color: #f1f5f9; border-bottom: 2px solid #e2e8f0; font-weight: 600;">
                                <td colspan="4" style="text-align: right; padding: 6px 12px; color: #475569;">Solde Compte :</td>
                                <td colspan="2" style="text-align: right; padding: 6px 12px; color: ${subSolde >= 0 ? '#16a34a' : '#dc2626'};">${subSolde.toFixed(2)} €</td>
                            </tr>
                        </tfoot>
                    `;

                    table.innerHTML = htmlContent;
                    classBloc.appendChild(table);
                });
            }

            totalGeneralDebit += totalClasseDebit;
            totalGeneralCredit += totalClasseCredit;

            const soldeClasse = totalClasseDebit - totalClasseCredit;
            const classFooter = document.createElement('div');
            classFooter.style.backgroundColor = '#e2e8f0';
            classFooter.style.padding = '8px 15px';
            classFooter.style.fontWeight = 'bold';
            classFooter.style.fontSize = '0.9rem';
            classFooter.style.display = 'flex';
            classFooter.style.justifyContent = 'space-between';
            classFooter.innerHTML = `
                <span>TOTAL CLASSE ${numClasse} :</span>
                <div style="display: flex; gap: 20px;">
                    <span style="color: #16a34a;">Débit : ${totalClasseDebit.toFixed(2)} €</span>
                    <span style="color: #dc2626;">Crédit : ${totalClasseCredit.toFixed(2)} €</span>
                    <span>Solde : ${soldeClasse.toFixed(2)} €</span>
                </div>
            `;
            classBloc.appendChild(classFooter);
            container.appendChild(classBloc);
        }

        if (totDebitEl) totDebitEl.textContent = totalGeneralDebit.toFixed(2) + ' €';
        if (totCreditEl) totCreditEl.textContent = totalGeneralCredit.toFixed(2) + ' €';
        if (totSoldeEl) {
            const soldeG = totalGeneralDebit - totalGeneralCredit;
            totSoldeEl.textContent = soldeG.toFixed(2) + ' €';
            totSoldeEl.style.color = soldeG >= 0 ? '#4ade80' : '#f87171';
        }
    }

    window.initGrandLivre = initGrandLivre;

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        setTimeout(initGrandLivre, 100);
    } else {
        document.addEventListener('DOMContentLoaded', initGrandLivre);
    }

    document.addEventListener('click', (e) => {
        if (e.target && e.target.textContent && e.target.textContent.includes('Grand Livre')) {
            setTimeout(initGrandLivre, 100);
        }
    });
})();
