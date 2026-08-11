// ============================================================================
// 1. CONFIGURATION ET INITIALISATION SUPABASE
// ============================================================================
const SUPABASE_URL = 'https://qfwhzuhwldurnmhirgil.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFmd2h6dWh3bGR1cm5taGlyZ2lsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU0OTQ0MTgsImV4cCI6MjEwMTA3MDQxOH0.Lt7eU9UBVY94tIIMUNOzLeJOpWnkGkvszy_gENkUkLg';

let supabaseClient = null;
let currentTransactions = [];

document.addEventListener('DOMContentLoaded', async () => {
    console.log("🚀 Initialisation de l'application Compta...");

    const loadingEl = document.getElementById('loading');
    const appEl = document.getElementById('app');
    const syncStatus = document.getElementById('syncStatus');

    // Déblocage visuel de l'interface
    if (loadingEl) {
        loadingEl.style.display = 'none';
        loadingEl.classList.add('hidden');
    }
    if (appEl) {
        appEl.style.display = 'block';
        appEl.classList.remove('hidden');
    }

    try {
        if (window.supabase) {
            supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
            if (syncStatus) syncStatus.textContent = '☁️ Connecté à Supabase';
        } else {
            if (syncStatus) syncStatus.textContent = '⚠️ SDK Supabase manquant';
            return;
        }

        showTab('transactions');
        updateCategories();

        // Chargement initial des données
        await chargerProfil();
        await chargerTransactions();

    } catch (err) {
        console.error('Erreur d\'initialisation :', err);
        if (syncStatus) syncStatus.textContent = '⚠️ Erreur de chargement';
    }
});

// ============================================================================
// 2. GESTION DE LA NAVIGATION PAR ONGLETS
// ============================================================================
function showTab(tabName) {
    const allTabs = document.querySelectorAll('[id^="tab-"]');
    allTabs.forEach(tab => tab.style.display = 'none');

    const buttons = document.querySelectorAll('.tab');
    buttons.forEach(btn => btn.classList.remove('active'));

    const targetTab = document.getElementById(`tab-${tabName}`);
    if (targetTab) targetTab.style.display = 'block';

    const activeBtn = Array.from(buttons).find(btn => 
        btn.getAttribute('onclick') && btn.getAttribute('onclick').includes(tabName)
    );
    if (activeBtn) activeBtn.classList.add('active');

    // Réactualiser tous les calculs à chaque changement d'onglet
    actualiserTousLesCalculs();
}

// ============================================================================
// 3. TRANSACTIONS (LECTURE, AJOUT, SUPPRESSION)
// ============================================================================
async function chargerTransactions() {
    if (!supabaseClient) return;

    const container = document.getElementById('transactions');
    if (container) {
        container.innerHTML = '<p style="color:#666; padding:1rem;">⏳ Chargement des opérations...</p>';
    }

    try {
        const { data, error } = await supabaseClient
            .from('transactions')
            .select('*')
            .order('date', { ascending: false });

        if (error) {
            console.error('Erreur Supabase :', error.message);
            if (container) {
                container.innerHTML = `<p style="color:#cc0000; padding:1rem;">⚠️ Erreur : ${error.message}</p>`;
            }
            return;
        }

        currentTransactions = data || [];
        afficherTransactions(currentTransactions);
        
        // 🔄 Calculer automatiquement les résultats pour tous les onglets
        actualiserTousLesCalculs();

    } catch (e) {
        console.error("Erreur réseau :", e);
    }
}

function afficherTransactions(liste) {
    const container = document.getElementById('transactions');
    if (!container) return;

    if (liste.length === 0) {
        container.innerHTML = '<p style="color:#666; padding:1rem;">Aucune opération enregistrée.</p>';
        return;
    }

    container.innerHTML = liste.map(t => `
        <div class="transaction ${t.type}" style="padding:0.8rem; border-bottom:1px solid #eee; display:flex; justify-content:space-between; align-items:center;">
            <div>
                <strong>${t.date}</strong> - <span>${t.description || 'Sans libellé'}</span><br>
                <small><strong>${t.amount} €</strong> (${t.type.toUpperCase()}) - <em>${t.category || ''}</em></small>
                ${t.piece_jointe_url ? `<br><a href="${t.piece_jointe_url}" target="_blank" style="font-size:0.85rem; color:#0066cc;">📄 Voir le justificatif</a>` : ''}
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
    const fileInput = document.getElementById('docFile');

    if (!date || isNaN(amount)) {
        alert('Veuillez spécifier la date et un montant valide.');
        return;
    }

    let pieceJointeUrl = null;

    if (fileInput && fileInput.files && fileInput.files.length > 0) {
        const file = fileInput.files[0];
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `justificatifs/${fileName}`;

        const { error: uploadError } = await supabaseClient
            .storage
            .from('documents')
            .upload(filePath, file);

        if (!uploadError) {
            const { data: urlData } = supabaseClient
                .storage
                .from('documents')
                .getPublicUrl(filePath);
            pieceJointeUrl = urlData.publicUrl;
        }
    }

    const { error } = await supabaseClient
        .from('transactions')
        .insert([{
            date,
            type,
            category,
            description,
            amount,
            piece_jointe_url: pieceJointeUrl
        }]);

    if (error) {
        alert('Erreur lors de l\'enregistrement : ' + error.message);
    } else {
        if (document.getElementById('description')) document.getElementById('description').value = '';
        if (document.getElementById('amount')) document.getElementById('amount').value = '';
        if (fileInput) fileInput.value = '';

        await chargerTransactions();
    }
}

async function supprimerTransaction(id) {
    if (!supabaseClient || !confirm('Voulez-vous supprimer cette opération ?')) return;

    const { error } = await supabaseClient.from('transactions').delete().eq('id', id);
    if (!error) {
        await chargerTransactions();
    }
}

// ============================================================================
// 4. MOTEUR DE CALCUL POUR BILAN, URSSAF, CARPIMKO & JOURNAL
// ============================================================================
function actualiserTousLesCalculs() {
    calculerBilanEtResultat();
    calculerURSSAFEtImpots();
    calculerCARPIMKO();
    afficherLivreJournalAndBalance();
}

// A. Calculs du Bilan et du Compte de Résultat
function calculerBilanEtResultat() {
    let honoraires = 0;
    let autresRecettes = 0;
    let cotisations = 0;
    let materiel = 0;
    let deplacements = 0;
    let assurances = 0;
    let autresDepenses = 0;

    currentTransactions.forEach(t => {
        const val = parseFloat(t.amount) || 0;
        const cat = (t.category || '').toLowerCase();
        const type = (t.type || '').toLowerCase();

        if (type.includes('recette')) {
            if (cat.includes('honoraires') || cat.includes('pai') || cat.includes('mutuelles') || cat.includes('patients')) {
                honoraires += val;
            } else {
                autresRecettes += val;
            }
        } else if (type.includes('depense') || type.includes('dépense')) {
            if (cat.includes('cotisation') || cat.includes('urssaf') || cat.includes('carpimko')) {
                cotisations += val;
            } else if (cat.includes('matériel') || cat.includes('materiel')) {
                materiel += val;
            } else if (cat.includes('carburant') || cat.includes('déplacement') || cat.includes('deplacement')) {
                deplacements += val;
            } else if (cat.includes('assurance')) {
                assurances += val;
            } else {
                autresDepenses += val;
            }
        }
    });

    const totalProduits = honoraires + autresRecettes;
    const totalCharges = cotisations + materiel + deplacements + assurances + autresDepenses;
    const resultatNet = totalProduits - totalCharges;

    // Mise à jour du DOM si les éléments existent dans votre HTML
    remplirTexteOuInput('res-produits-total', totalProduits.toFixed(2) + ' €');
    remplirTexteOuInput('res-honoraires', honoraires.toFixed(2) + ' €');
    remplirTexteOuInput('res-autres-recettes', autresRecettes.toFixed(2) + ' €');

    remplirTexteOuInput('res-charges-total', totalCharges.toFixed(2) + ' €');
    remplirTexteOuInput('res-cotisations', cotisations.toFixed(2) + ' €');
    remplirTexteOuInput('res-materiel', materiel.toFixed(2) + ' €');
    remplirTexteOuInput('res-deplacements', deplacements.toFixed(2) + ' €');
    remplirTexteOuInput('res-assurances', assurances.toFixed(2) + ' €');
    remplirTexteOuInput('res-autres-charges', autresDepenses.toFixed(2) + ' €');

    remplirTexteOuInput('res-resultat-net', resultatNet.toFixed(2) + ' €');
}

// B. Calculs des déclarations URSSAF par trimestre
function calculerURSSAFEtImpots() {
    let totalRecettes = 0;
    let t1 = 0, t2 = 0, t3 = 0, t4 = 0;

    currentTransactions.forEach(t => {
        const type = (t.type || '').toLowerCase();
        if (type.includes('recette')) {
            const val = parseFloat(t.amount) || 0;
            totalRecettes += val;

            const dateObj = new Date(t.date);
            const mois = dateObj.getMonth() + 1; // 1 à 12

            if (mois >= 1 && mois <= 3) t1 += val;
            else if (mois >= 4 && mois <= 6) t2 += val;
            else if (mois >= 7 && mois <= 9) t3 += val;
            else if (mois >= 10 && mois <= 12) t4 += val;
        }
    });

    remplirTexteOuInput('urssaf-recettes-totales', totalRecettes.toFixed(2) + ' €');
    remplirTexteOuInput('urssaf-t1', t1.toFixed(2) + ' €');
    remplirTexteOuInput('urssaf-t2', t2.toFixed(2) + ' €');
    remplirTexteOuInput('urssaf-t3', t3.toFixed(2) + ' €');
    remplirTexteOuInput('urssaf-t4', t4.toFixed(2) + ' €');
}

// C. Calculs pour la simulation CARPIMKO
function calculerCARPIMKO() {
    let recettes = 0;
    let depenses = 0;

    currentTransactions.forEach(t => {
        const val = parseFloat(t.amount) || 0;
        const type = (t.type || '').toLowerCase();
        if (type.includes('recette')) recettes += val;
        else if (type.includes('depense') || type.includes('dépense')) depenses += val;
    });

    const bncReel = recettes - depenses;
    const estCotisation = Math.max(0, bncReel * 0.14); // Estimation ~14% du BNC

    remplirTexteOuInput('carpimko-bnc-calcule', bncReel.toFixed(2) + ' €');
    remplirTexteOuInput('carpimko-total-du', estCotisation.toFixed(2) + ' €');
    remplirTexteOuInput('carpimko-mensualite', (estCotisation / 12).toFixed(2) + ' €');
    remplirTexteOuInput('carpimko-prelevement-trim', (estCotisation / 4).toFixed(2) + ' €');
}

// D. Affichage du Livre-Journal (Plan PCG) et de la Balance
function afficherLivreJournalAndBalance() {
    const journalContainer = document.querySelector('#tab-livre-journal table tbody, #journal-body, .journal-table tbody');
    const balanceContainer = document.querySelector('#tab-livre-journal .balance-table tbody, #balance-body');

    if (!journalContainer) return;

    if (currentTransactions.length === 0) {
        journalContainer.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:1rem; color:#666;">Aucune écriture enregistrée.</td></tr>';
        if (balanceContainer) balanceContainer.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:1rem; color:#666;">Balance vide.</td></tr>';
        return;
    }

    let journalHTML = '';
    let comptesMap = {};

    currentTransactions.forEach(t => {
        const val = parseFloat(t.amount) || 0;
        const type = (t.type || '').toLowerCase();
        const cat = (t.category || '').toLowerCase();

        // Attribution du compte PCG (Plan Comptable Général)
        let comptePCG = '628000'; // Compte par défaut
        let intituleCompte = 'Autres charges';

        if (type.includes('recette')) {
            comptePCG = '706000';
            intituleCompte = 'Prestations de soins (Honoraires)';
        } else if (cat.includes('cotisation') || cat.includes('urssaf') || cat.includes('carpimko')) {
            comptePCG = '645000';
            intituleCompte = 'Cotisations sociales';
        } else if (cat.includes('matériel') || cat.includes('materiel')) {
            comptePCG = '606000';
            intituleCompte = 'Achats de matériel & fournitures';
        } else if (cat.includes('carburant') || cat.includes('déplacement')) {
            comptePCG = '625100';
            intituleCompte = 'Frais de déplacements';
        } else if (cat.includes('assurance')) {
            comptePCG = '616000';
            intituleCompte = 'Primes d\'assurances';
        }

        const debit = type.includes('recette') ? 0 : val;
        const credit = type.includes('recette') ? val : 0;

        // Ligne du Grand Livre
        journalHTML += `
            <tr>
                <td style="padding:0.5rem; border-bottom:1px solid #eee;">${t.date}</td>
                <td style="padding:0.5rem; border-bottom:1px solid #eee;"><strong>${comptePCG}</strong></td>
                <td style="padding:0.5rem; border-bottom:1px solid #eee;">${t.description || intituleCompte}</td>
                <td style="padding:0.5rem; border-bottom:1px solid #eee; text-align:right;">${debit ? debit.toFixed(2) + ' €' : '-'}</td>
                <td style="padding:0.5rem; border-bottom:1px solid #eee; text-align:right;">${credit ? credit.toFixed(2) + ' €' : '-'}</td>
            </tr>
        `;

        // Cumul pour la Balance
        if (!comptesMap[comptePCG]) {
            comptesMap[comptePCG] = { intitule: intituleCompte, debit: 0, credit: 0 };
        }
        comptesMap[comptePCG].debit += debit;
        comptesMap[comptePCG].credit += credit;
    });

    journalContainer.innerHTML = journalHTML;

    // Génération de la Balance Comptable Générale
    if (balanceContainer) {
        let balanceHTML = '';
        Object.keys(comptesMap).forEach(code => {
            const c = comptesMap[code];
            const soldeDebit = c.debit > c.credit ? c.debit - c.credit : 0;
            const soldeCredit = c.credit > c.debit ? c.credit - c.debit : 0;

            balanceHTML += `
                <tr>
                    <td style="padding:0.5rem; border-bottom:1px solid #eee;"><strong>${code}</strong></td>
                    <td style="padding:0.5rem; border-bottom:1px solid #eee;">${c.intitule}</td>
                    <td style="padding:0.5rem; border-bottom:1px solid #eee; text-align:right;">${c.debit.toFixed(2)} €</td>
                    <td style="padding:0.5rem; border-bottom:1px solid #eee; text-align:right;">${c.credit.toFixed(2)} €</td>
                    <td style="padding:0.5rem; border-bottom:1px solid #eee; text-align:right;">${soldeDebit ? soldeDebit.toFixed(2) + ' €' : '-'}</td>
                    <td style="padding:0.5rem; border-bottom:1px solid #eee; text-align:right;">${soldeCredit ? soldeCredit.toFixed(2) + ' €' : '-'}</td>
                </tr>
            `;
        });
        balanceContainer.innerHTML = balanceHTML;
    }
}

// Fonction utilitaire pour mettre à jour un élément HTML de manière sécurisée
function remplirTexteOuInput(id, valeur) {
    const el = document.getElementById(id);
    if (!el) return;
    if (el.tagName === 'INPUT' || el.tagName === 'SELECT') {
        el.value = valeur;
    } else {
        el.textContent = valeur;
    }
}

// ============================================================================
// 5. PROFIL PROFESSIONNEL (CHARGEMENT & SAUVEGARDE)
// ============================================================================
async function chargerProfil() {
    if (!supabaseClient) return;

    try {
        const { data } = await supabaseClient.from('profil').select('*').maybeSingle();

        if (data) {
            const fields = ['nom', 'prenom', 'siret', 'rpps', 'email'];
            fields.forEach(f => {
                const el = document.getElementById(f);
                if (el && data[f] !== undefined) el.value = data[f];
            });
        }
    } catch (e) {
        console.warn("Remarque Profil :", e);
    }
}

async function saveProfile() {
    if (!supabaseClient) return;

    const profilData = {
        id: 1,
        nom: document.getElementById('nom')?.value || '',
        prenom: document.getElementById('prenom')?.value || '',
        siret: document.getElementById('siret')?.value || '',
        rpps: document.getElementById('rpps')?.value || '',
        email: document.getElementById('email')?.value || ''
    };

    const { error } = await supabaseClient.from('profil').upsert(profilData);

    if (error) {
        alert('Erreur de sauvegarde : ' + error.message);
    } else {
        alert('✅ Profil enregistré avec succès dans Supabase !');
    }
}

// ============================================================================
// 6. UTILITAIRES
// ============================================================================
function updateCategories() {
    const typeSelect = document.getElementById('type');
    const catSelect = document.getElementById('category');
    if (!typeSelect || !catSelect) return;

    const type = typeSelect.value;

    if (type === 'recette' || type === 'Recette (Entrée)') {
        catSelect.innerHTML = `
            <option value="Honoraires PAI">Honoraires PAI</option>
            <option value="Honoraires Mutuelles">Honoraires Mutuelles</option>
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
