// ============================================================================
// 1. CONFIGURATION ET VARIABLES GLOBALES
// ============================================================================
const SUPABASE_URL = 'https://qfwhzuhwldurnmhirgil.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFmd2h6dWh3bGR1cm5taGlyZ2lsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU0OTQ0MTgsImV4cCI6MjEwMTA3MDQxOH0.Lt7eU9UBVY94tIIMUNOzLeJOpWnkGkvszy_gENkUkLg';

let supabaseClient = null;
let currentTransactions = [];
let currentProfileId = null;

// ============================================================================
// 2. FONCTIONS UTILITAIRES
// ============================================================================
function remplir(id, valeur) {
    const el = document.getElementById(id);
    if (!el) return;

    const valFormatee = typeof valeur === 'number' ? valeur.toFixed(2) + ' €' : valeur;
    
    if (el.tagName === 'INPUT' || el.tagName === 'SELECT') {
        el.value = typeof valeur === 'number' ? valeur.toFixed(2) : valeur;
    } else {
        el.textContent = valFormatee;
    }
}

function updateCategories() {
    const typeSelect = document.getElementById('type');
    const catSelect = document.getElementById('category');
    if (!typeSelect || !catSelect) return;

    const type = typeSelect.value;

    if (type === 'recette') {
        catSelect.innerHTML = `
            <option value="Honoraires PAI">Honoraires PAI / Mutuelles</option>
            <option value="Honoraires Patients">Honoraires Patients</option>
            <option value="Autre recette">Autre recette</option>
        `;
    } else {
        catSelect.innerHTML = `
            <option value="Cotisations URSSAF/CARPIMKO">Cotisations URSSAF/CARPIMKO</option>
            <option value="Matériel médical">Matériel médical</option>
            <option value="Loyer professionnel">Loyer professionnel</option>
            <option value="Assurance Pro">Assurance Pro</option>
            <option value="Carburant / Déplacements">Carburant / Déplacements</option>
            <option value="Autre dépense">Autre dépense</option>
        `;
    }
}

// ============================================================================
// 3. INITIALISATION DE L'APPLICATION
// ============================================================================
document.addEventListener('DOMContentLoaded', async () => {
    console.log("🚀 Initialisation de l'application Compta...");

    const loadingEl = document.getElementById('loading');
    const appEl = document.getElementById('app');
    const syncStatus = document.getElementById('syncStatus');

    if (loadingEl) loadingEl.style.display = 'none';
    if (appEl) appEl.classList.remove('hidden');

    try {
        if (window.supabase) {
            supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
            if (syncStatus) syncStatus.textContent = '☁️ Connecté à Supabase';
        } else {
            if (syncStatus) syncStatus.textContent = '⚠️ SDK Supabase manquant';
            return;
        }

        updateCategories();
        
        const inputDate = document.getElementById('date');
        if (inputDate) inputDate.value = new Date().toISOString().split('T')[0];

        await chargerProfil();
        await chargerTransactions();

    } catch (err) {
        console.error('Erreur d\'initialisation :', err);
        if (syncStatus) syncStatus.textContent = '⚠️ Erreur de chargement';
    }
});

// ============================================================================
// 4. NAVIGATION PAR ONGLETS
// ============================================================================
function showTab(tabName) {
    const allTabs = document.querySelectorAll('[id^="tab-"]');
    allTabs.forEach(tab => tab.classList.add('hidden'));

    const buttons = document.querySelectorAll('.tab');
    buttons.forEach(btn => btn.classList.remove('active'));

    const targetTab = document.getElementById(`tab-${tabName}`);
    if (targetTab) targetTab.classList.remove('hidden');

    const activeBtn = Array.from(buttons).find(btn => 
        btn.getAttribute('onclick') && btn.getAttribute('onclick').includes(tabName)
    );
    if (activeBtn) activeBtn.classList.add('active');

    actualiserTousLesCalculs();
}

// ============================================================================
// 5. GESTION DU PROFIL
// ============================================================================
async function chargerProfil() {
    if (!supabaseClient) return;

    try {
        const { data, error } = await supabaseClient
            .from('profile')
            .select('*')
            .limit(1);

        if (error) {
            console.error("❌ Erreur Supabase :", error.message);
            return;
        }

        if (data && data.length > 0) {
            const profil = data[0];
            currentProfileId = profil.id;

            if (document.getElementById('nom')) document.getElementById('nom').value = profil.nom || '';
            if (document.getElementById('prenom')) document.getElementById('prenom').value = profil.prenom || '';
            if (document.getElementById('siret')) document.getElementById('siret').value = profil.siret || '';
            if (document.getElementById('rpps')) document.getElementById('rpps').value = profil.rpps || '';
            if (document.getElementById('email')) document.getElementById('email').value = profil.email || '';
        }
    } catch (e) {
        console.error("⚠️ Erreur lors du chargement du profil :", e);
    }
}

async function saveProfile() {
    if (!supabaseClient) {
        alert("⚠️ Connexion Supabase indisponible.");
        return;
    }

    const profilData = {
        nom: document.getElementById('nom')?.value || '',
        prenom: document.getElementById('prenom')?.value || '',
        siret: document.getElementById('siret')?.value || '',
        rpps: document.getElementById('rpps')?.value || '',
        email: document.getElementById('email')?.value || ''
    };

    if (currentProfileId) {
        profilData.id = currentProfileId;
    }

    try {
        const { error } = await supabaseClient
            .from('profile')
            .upsert([profilData]);

        if (error) {
            alert("⚠️ Erreur lors de la sauvegarde :\n" + error.message);
        } else {
            alert("✅ Profil enregistré avec succès !");
            await chargerProfil();
        }
    } catch (err) {
        alert("⚠️ Erreur réseau lors de la sauvegarde.");
    }
}

// ============================================================================
// 6. GESTION DES TRANSACTIONS
// ============================================================================
async function chargerTransactions() {
    if (!supabaseClient) return;

    const container = document.getElementById('transactions');
    if (container) container.innerHTML = '<p style="color:#666;">⏳ Chargement...</p>';

    try {
        const { data, error } = await supabaseClient
            .from('transactions')
            .select('*')
            .order('date', { ascending: false });

        if (error) {
            if (container) container.innerHTML = `<p style="color:red;">Erreur : ${error.message}</p>`;
            return;
        }

        currentTransactions = data || [];
        afficherTransactions(currentTransactions);
        actualiserTousLesCalculs();

    } catch (e) {
        console.error(e);
    }
}

function afficherTransactions(liste) {
    const container = document.getElementById('transactions');
    if (!container) return;

    if (liste.length === 0) {
        container.innerHTML = '<p style="color:#666;">Aucune transaction enregistrée.</p>';
        return;
    }

    container.innerHTML = liste.map(t => `
        <div class="transaction ${t.type}">
            <div>
                <strong>${t.date}</strong> - <span>${t.description || 'Sans libellé'}</span><br>
                <small><strong>${parseFloat(t.amount).toFixed(2)} €</strong> (${t.type.toUpperCase()}) - <em>${t.category || ''}</em></small>
            </div>
            <div>
                <button class="btn btn-danger" onclick="supprimerTransaction('${t.id}')">🗑️</button>
            </div>
        </div>
    `).join('');
}

async function addTransaction() {
    if (!supabaseClient) return;

    const date = document.getElementById('date')?.value;
    const type = document.getElementById('type')?.value;
    const category = document.getElementById('category')?.value;
    const description = document.getElementById('description')?.value;
    const amount = parseFloat(document.getElementById('amount')?.value);

    if (!date || isNaN(amount) || !description) {
        alert('Veuillez remplir la date, le montant et le libellé.');
        return;
    }

    const { error } = await supabaseClient
        .from('transactions')
        .insert([{ date, type, category, description, amount }]);

    if (error) {
        alert('Erreur lors de l\'ajout : ' + error.message);
    } else {
        document.getElementById('description').value = '';
        document.getElementById('amount').value = '';
        await chargerTransactions();
    }
}

async function supprimerTransaction(id) {
    if (!supabaseClient || !confirm('Supprimer cette transaction ?')) return;

    const { error } = await supabaseClient.from('transactions').delete().eq('id', id);
    if (!error) await chargerTransactions();
}

// ============================================================================
// 7. CALCULS COMPTABLES AUTOMATISÉS
// ============================================================================
function actualiserTousLesCalculs() {
    genererBilanEtCE();
    genererDeclarations();
    calculerCarpimkoTab();
    afficherJournalEtBalance();
}

function genererBilanEtCE() {
    let honoraires = 0, autresRecettes = 0;
    let cotisations = 0, materiel = 0, deplacements = 0, assurances = 0, autresCharges = 0;

    currentTransactions.forEach(t => {
        const val = parseFloat(t.amount) || 0;
        const cat = (t.category || '').toLowerCase();
        const type = (t.type || '').toLowerCase();

        if (type.includes('recette')) {
            if (cat.includes('honoraire') || cat.includes('pai')) honoraires += val;
            else autresRecettes += val;
        } else {
            if (cat.includes('cotisation') || cat.includes('urssaf') || cat.includes('carpimko')) cotisations += val;
            else if (cat.includes('matériel') || cat.includes('materiel')) materiel += val;
            else if (cat.includes('carburant') || cat.includes('déplacement') || cat.includes('deplacement')) deplacements += val;
            else if (cat.includes('assurance')) assurances += val;
            else autresCharges += val;
        }
    });

    const totalProduits = honoraires + autresRecettes;
    const totalCharges = cotisations + materiel + deplacements + assurances + autresCharges;

    remplir('ceHonoraires', honoraires);
    remplir('ceAutresRecettes', autresRecettes);
    remplir('ceProduits', totalProduits);

    remplir('ceCotis', cotisations);
    remplir('ceMateriel', materiel);
    remplir('ceFraisDeplacement', deplacements);
    remplir('ceAssurances', assurances);
    remplir('ceAutresCharges', autresCharges);
    remplir('ceCharges', totalCharges);

    remplir('ceResultat', totalProduits - totalCharges);
}

function genererDeclarations() {
    const anneeSelectionnee = document.getElementById('selectAnnee')?.value || 'Toutes';
    
    let totalCA = 0, totalDepenses = 0;
    let t1 = 0, t2 = 0, t3 = 0, t4 = 0;

    const transactionsFiltrees = currentTransactions.filter(t => {
        if (!t.date) return false;
        if (anneeSelectionnee === 'Toutes') return true;
        return t.date.startsWith(anneeSelectionnee);
    });

    transactionsFiltrees.forEach(t => {
        const val = parseFloat(t.amount) || 0;
        const type = (t.type || '').toLowerCase();

        if (type.includes('recette')) {
            totalCA += val;
            const mois = new Date(t.date).getMonth() + 1;

            if (mois >= 1 && mois <= 3) t1 += val;
            else if (mois >= 4 && mois <= 6) t2 += val;
            else if (mois >= 7 && mois <= 9) t3 += val;
            else if (mois >= 10 && mois <= 12) t4 += val;
        } else {
            totalDepenses += val;
        }
    });

    const estRemplacant = document.getElementById('urssafRemplacant')?.checked;
    const tauxUrssaf = estRemplacant ? 0.138 : 0.145;

    remplir('declCA', totalCA);
    remplir('caT1', t1);
    remplir('caT2', t2);
    remplir('caT3', t3);
    remplir('caT4', t4);

    remplir('urssafT1', t1 * tauxUrssaf);
    remplir('urssafT2', t2 * tauxUrssaf);
    remplir('urssafT3', t3 * tauxUrssaf);
    remplir('urssafT4', t4 * tauxUrssaf);

    const abattement = totalCA * 0.34;
    remplir('microCA', totalCA);
    remplir('microAbattement', abattement);
    remplir('microImposable', Math.max(0, totalCA - abattement));

    remplir('reelCA', totalCA);
    remplir('reelDepenses', totalDepenses);
    remplir('reelBenefice', totalCA - totalDepenses);
}

// ============================================================================
// 8. ACTIONS : INCORPORATION, SAUVEGARDE ET EXPORT
// ============================================================================
async function incorporerCotisationsUrssaf() {
    if (!supabaseClient) return;

    const estRemplacant = document.getElementById('urssafRemplacant')?.checked;
    const tauxUrssaf = estRemplacant ? 0.138 : 0.145;
    const anneeSel = document.getElementById('selectAnnee')?.value;
    const annee = (anneeSel === 'Toutes') ? new Date().getFullYear().toString() : anneeSel;

    let trimestres = [0, 0, 0, 0];
    currentTransactions.forEach(t => {
        if ((t.type || '').toLowerCase().includes('recette') && t.date && t.date.startsWith(annee)) {
            const mois = new Date(t.date).getMonth() + 1;
            const val = parseFloat(t.amount) || 0;
            if (mois >= 1 && mois <= 3) trimestres[0] += val;
            else if (mois >= 4 && mois <= 6) trimestres[1] += val;
            else if (mois >= 7 && mois <= 9) trimestres[2] += val;
            else if (mois >= 10 && mois <= 12) trimestres[3] += val;
        }
    });

    const datesTrimestres = [`${annee}-03-31`, `${annee}-06-30`, `${annee}-09-30`, `${annee}-12-31`];
    let nouvellesDepenses = [];

    trimestres.forEach((caTrim, index) => {
        const montantUrssaf = caTrim * tauxUrssaf;
        if (montantUrssaf > 0) {
            nouvellesDepenses.push({
                date: datesTrimestres[index],
                type: 'depense',
                category: 'Cotisations URSSAF/CARPIMKO',
                description: `Cotisation URSSAF T${index + 1} (${annee})`,
                amount: parseFloat(montantUrssaf.toFixed(2))
            });
        }
    });

    if (nouvellesDepenses.length === 0) {
        alert("Aucune cotisation URSSAF à incorporer pour cette période.");
        return;
    }

    if (confirm(`Enregistrer ${nouvellesDepenses.length} dépense(s) d'URSSAF dans votre comptabilité ?`)) {
        const { error } = await supabaseClient.from('transactions').insert(nouvellesDepenses);
        if (!error) {
            alert("✅ Cotisations URSSAF ajoutées aux dépenses !");
            await chargerTransactions();
        } else {
            alert("⚠️ Erreur : " + error.message);
        }
    }
}

async function sauvegarderDeclaration() {
    if (!supabaseClient) return;

    const annee = document.getElementById('selectAnnee')?.value || 'Toutes';
    let totalCA = 0, totalDepenses = 0;

    currentTransactions.forEach(t => {
        const val = parseFloat(t.amount) || 0;
        if ((t.type || '').toLowerCase().includes('recette')) totalCA += val;
        else totalDepenses += val;
    });

    const payload = {
        annee: annee,
        recettes_brutes: totalCA,
        depenses_deductibles: totalDepenses,
        benefice_imposable: totalCA - totalDepenses,
        urssaf_estimee: totalCA * 0.145,
        carpimko_estimee: Math.max(0, (totalCA - totalDepenses) * 0.14)
    };

    const { error } = await supabaseClient.from('declarations').insert([payload]);
    if (!error) {
        alert(`✅ Déclaration ${annee} sauvegardée avec succès !`);
    } else {
        alert("⚠️ Note : Assurez-vous d'avoir créé la table 'declarations' dans Supabase.");
    }
}

function exporterPourComptable() {
    if (!currentTransactions || currentTransactions.length === 0) {
        alert("Aucune transaction à exporter.");
        return;
    }

    let csvContent = "data:text/csv;charset=utf-8,Date;Type;Categorie;Description;Montant (€)\n";

    currentTransactions.forEach(t => {
        csvContent += `${t.date};${t.type};"${t.category || ''}";"${t.description || ''}";${t.amount}\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `export_compta_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function envoyerEmailComptable() {
    let totalCA = 0, totalDepenses = 0;
    currentTransactions.forEach(t => {
        const val = parseFloat(t.amount) || 0;
        if ((t.type || '').toLowerCase().includes('recette')) totalCA += val;
        else totalDepenses += val;
    });

    const sujet = encodeURIComponent("Bilan Comptable Infirmier");
    const corps = encodeURIComponent(
        `Bonjour,\n\nVoici le bilan de ma comptabilité :\n` +
        `- Recettes brutes : ${totalCA.toFixed(2)} €\n` +
        `- Dépenses déductibles : ${totalDepenses.toFixed(2)} €\n` +
        `- Résultat / Bénéfice : ${(totalCA - totalDepenses).toFixed(2)} €\n\nCordialement,`
    );

    window.location.href = `mailto:?subject=${sujet}&body=${corps}`;
}

function calculerCarpimkoTab() {
    const bnc = parseFloat(document.getElementById('carpBnc')?.value) || 0;
    const statut = document.getElementById('carpStatut')?.value || 'croisiere';

    let totalCarpimko = 0;
    if (statut === 'annee1') totalCarpimko = 3524;
    else if (statut === 'annee2') totalCarpimko = 6080;
    else totalCarpimko = (bnc * 0.14) + 824;

    remplir('carpTotal', totalCarpimko);
    remplir('carpMensuel', totalCarpimko / 12);
    remplir('carpTrim', totalCarpimko / 4);
}

// ============================================================================
// 9. GESTION DU LIVRE-JOURNAL ET DE LA BALANCE DES COMPTES
// ============================================================================
function afficherJournalEtBalance() {
    afficherLivreJournal();
    afficherBalanceComptes();
}

function afficherLivreJournal() {
    const tbodyJournal = document.getElementById('tbodyJournal');
    if (!tbodyJournal) return;

    if (!currentTransactions || currentTransactions.length === 0) {
        tbodyJournal.innerHTML = '<tr><td colspan="5" style="text-align:center;">Aucune écriture enregistrée.</td></tr>';
        return;
    }

    tbodyJournal.innerHTML = currentTransactions.map(t => {
        const val = parseFloat(t.amount) || 0;
        const isRecette = (t.type || '').toLowerCase().includes('recette');
        const compte = isRecette ? '706000' : '628000';

        return `
            <tr>
                <td>${t.date}</td>
                <td><strong>${compte}</strong></td>
                <td>${t.description || ''}</td>
                <td style="text-align:right;">${!isRecette ? val.toFixed(2) + ' €' : '-'}</td>
                <td style="text-align:right;">${isRecette ? val.toFixed(2) + ' €' : '-'}</td>
            </tr>
        `;
    }).join('');
}

function afficherBalanceComptes() {
    const tbodyBalance = document.getElementById('tbodyBalance');
    if (!tbodyBalance) return;

    if (!currentTransactions || currentTransactions.length === 0) {
        tbodyBalance.innerHTML = '<tr><td colspan="5" style="text-align:center;">Aucune donnée pour la balance.</td></tr>';
        return;
    }

    const comptes = {
        '706000': { nom: 'Prestations de services / Honoraires', debit: 0, credit: 0 },
        '628000': { nom: 'Diverses charges professionnelles', debit: 0, credit: 0 },
        '512000': { nom: 'Compte Bancaire Pro', debit: 0, credit: 0 }
    };

    currentTransactions.forEach(t => {
        const val = parseFloat(t.amount) || 0;
        const isRecette = (t.type || '').toLowerCase().includes('recette');

        if (isRecette) {
            comptes['706000'].credit += val;
            comptes['512000'].debit += val;
        } else {
            comptes['628000'].debit += val;
            comptes['512000'].credit += val;
        }
    });

    let html = '';
    let grandTotalDebit = 0;
    let grandTotalCredit = 0;

    Object.keys(comptes).forEach(numCompte => {
        const c = comptes[numCompte];
        const solde = c.debit - c.credit;

        if (c.debit > 0 || c.credit > 0) {
            grandTotalDebit += c.debit;
            grandTotalCredit += c.credit;

            html += `
                <tr>
                    <td><strong>${numCompte}</strong></td>
                    <td>${c.nom}</td>
                    <td style="text-align:right;">${c.debit > 0 ? c.debit.toFixed(2) + ' €' : '-'}</td>
                    <td style="text-align:right;">${c.credit > 0 ? c.credit.toFixed(2) + ' €' : '-'}</td>
                    <td style="text-align:right; font-weight:bold; color: ${solde >= 0 ? 'green' : 'red'};">
                        ${solde.toFixed(2)} €
                    </td>
                </tr>
            `;
        }
    });

    html += `
        <tr style="background-color: #f8f9fa; font-weight: bold;">
            <td colspan="2" style="text-align:right;">TOTAL ÉQUILIBRE :</td>
            <td style="text-align:right; color: var(--primary);">${grandTotalDebit.toFixed(2)} €</td>
            <td style="text-align:right; color: var(--primary);">${grandTotalCredit.toFixed(2)} €</td>
            <td style="text-align:right;">-</td>
        </tr>
    `;

    tbodyBalance.innerHTML = html;
}
