// ==========================================
// 1. CONFIGURATION & INITIALISATION SUPABASE
// ==========================================
// ID de projet configuré d'après votre tableau de bord Supabase
const SUPABASE_URL = 'https://qfwhzuhwldurnmhirgil.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtudGtmY3pmeGVoZ2RzcnVoYWJ1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTkzMzU0NSwiZXhwIjoyMDg3NTA5NTQ1fQ.hMpVK2ky6uoU7mauBeoTOR8THCUpycmUogBKyO8Wsmg';

let supabaseClient = null;
let currentTransactions = [];

document.addEventListener('DOMContentLoaded', async () => {
    try {
        if (window.supabase) {
            supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        }

        // Retrait de l'écran d'attente et affichage de l'application
        const loadingEl = document.getElementById('loading');
        const appEl = document.getElementById('app');
        if (loadingEl) loadingEl.classList.add('hidden');
        if (appEl) appEl.classList.remove('hidden');

        const syncStatus = document.getElementById('syncStatus');
        if (syncStatus) syncStatus.textContent = '☁️ Connecté à Supabase';

        // Vue par défaut sur l'onglet Profil
        showTab('profil');
        updateCategories();

        // Chargement des données réelles
        await chargerProfil();
        await chargerTransactions();

    } catch (err) {
        console.error('Erreur au démarrage :', err);
        const syncStatus = document.getElementById('syncStatus');
        if (syncStatus) syncStatus.textContent = '⚠️ Erreur de connexion';
    }
});

// ==========================================
// 2. GESTION DES ONGLETS
// ==========================================
function showTab(tabName) {
    const allTabs = document.querySelectorAll('[id^="tab-"]');
    allTabs.forEach(tab => tab.style.display = 'none');

    const buttons = document.querySelectorAll('.tab');
    buttons.forEach(btn => btn.classList.remove('active'));

    const target = document.getElementById(`tab-${tabName}`);
    if (target) {
        target.style.display = 'block';
    }

    const activeBtn = Array.from(buttons).find(btn => 
        btn.getAttribute('onclick') && btn.getAttribute('onclick').includes(tabName)
    );
    if (activeBtn) {
        activeBtn.classList.add('active');
    }
}

// ==========================================
// 3. CHARGEMENT & SAUVEGARDE DU PROFIL
// ==========================================
async function chargerProfil() {
    if (!supabaseClient) return;

    // Utilisation du nom de table 'profile' (avec un 'e')
    const { data, error } = await supabaseClient
        .from('profile')
        .select('*')
        .maybeSingle();

    if (error) {
        console.warn('Erreur ou profil non trouvé :', error.message);
        return;
    }

    if (data) {
        const fields = [
            'nom', 'prenom', 'siret', 'rpps', 'adeli', 'num_urssaf',
            'adresse', 'code_postal', 'ville', 'telephone', 'email',
            'comptable_cabinet', 'comptable_adresse', 'comptable_tel', 'comptable_email'
        ];

        fields.forEach(field => {
            const el = document.getElementById(field);
            if (el && data[field] !== undefined && data[field] !== null) {
                el.value = data[field];
            }
        });
    }
}

async function saveProfile() {
    if (!supabaseClient) return;

    const profilData = {
        nom: document.getElementById('nom')?.value || '',
        prenom: document.getElementById('prenom')?.value || '',
        siret: document.getElementById('siret')?.value || null,
        rpps: document.getElementById('rpps')?.value || null,
        adeli: document.getElementById('adeli')?.value || null,
        num_urssaf: document.getElementById('num_urssaf')?.value || null,
        adresse: document.getElementById('adresse')?.value || '',
        code_postal: document.getElementById('code_postal')?.value || '',
        ville: document.getElementById('ville')?.value || '',
        telephone: document.getElementById('telephone')?.value || '',
        email: document.getElementById('email')?.value || '',
        comptable_cabinet: document.getElementById('comptable_cabinet')?.value || '',
        comptable_adresse: document.getElementById('comptable_adresse')?.value || '',
        comptable_tel: document.getElementById('comptable_tel')?.value || '',
        comptable_email: document.getElementById('comptable_email')?.value || ''
    };

    const { error } = await supabaseClient
        .from('profile')
        .upsert(profilData);

    if (error) {
        alert('Erreur lors de la sauvegarde du profil : ' + error.message);
    } else {
        alert('✅ Profil sauvegardé avec succès !');
    }
}

// ==========================================
// 4. CHARGEMENT & GESTION DES TRANSACTIONS
// ==========================================
async function chargerTransactions() {
    if (!supabaseClient) return;

    const { data, error } = await supabaseClient
        .from('transactions')
        .select('*')
        .order('date', { ascending: false });

    if (error) {
        console.error('Erreur de lecture des transactions :', error.message);
        return;
    }

    currentTransactions = data || [];
    afficherTransactions(currentTransactions);
    calculerStatistiques(currentTransactions);
}

function afficherTransactions(liste) {
    const container = document.getElementById('transactions');
    if (!container) return;

    if (liste.length === 0) {
        container.innerHTML = '<p style="color:#666;">Aucune opération enregistrée.</p>';
        return;
    }

    container.innerHTML = liste.map(t => {
        const isEncaisse = t.encaisse ? 'encaisse' : '';
        const modePaiement = t.payment_method ? ` (${t.payment_method})` : '';
        
        return `
            <div class="transaction ${t.type} ${isEncaisse}">
                <div class="transaction-actions">
                    <button class="btn btn-danger" onclick="supprimerTransaction('${t.id}')">🗑️</button>
                </div>
                <strong>${t.date}</strong> - <span>${t.description || 'Sans description'}</span>
                <div>
                    <strong>${Number(t.amount).toFixed(2)} €</strong> 
                    [${t.type.toUpperCase()}] 
                    <em>${t.category || ''}</em>
                    <small style="color:#666;">${modePaiement}</small>
                </div>
            </div>
        `;
    }).join('');
}

async function addTransaction() {
    if (!supabaseClient) return;

    const date = document.getElementById('date')?.value;
    const type = document.getElementById('type')?.value;
    const category = document.getElementById('category')?.value;
    const description = document.getElementById('description')?.value;
    const amount = parseFloat(document.getElementById('amount')?.value);

    if (!date || isNaN(amount)) {
        alert('Veuillez remplir au moins la date et le montant.');
        return;
    }

    const nouvelleOperation = {
        date,
        type,
        category,
        description,
        amount,
        payment_method: document.getElementById('paymentMethod')?.value || 'Virement',
        has_attachments: false,
        encaisse: false
    };

    const { error } = await supabaseClient
        .from('transactions')
        .insert([nouvelleOperation]);

    if (error) {
        alert('Erreur lors de l\'ajout : ' + error.message);
    } else {
        document.getElementById('description').value = '';
        document.getElementById('amount').value = '';
        await chargerTransactions();
    }
}

async function supprimerTransaction(id) {
    if (!supabaseClient || !confirm('Voulez-vous supprimer cette opération ?')) return;

    const { error } = await supabaseClient
        .from('transactions')
        .delete()
        .eq('id', id);

    if (!error) {
        await chargerTransactions();
    }
}

// ==========================================
// 5. STATISTIQUES & CATÉGORIES
// ==========================================
function calculerStatistiques(liste) {
    let recettes = 0;
    let depenses = 0;

    liste.forEach(t => {
        const val = Number(t.amount || 0);
        if (t.type === 'recette') recettes += val;
        if (t.type === 'depense') depenses += val;
    });

    const balance = recettes - depenses;

    if (document.getElementById('statRecettes')) document.getElementById('statRecettes').textContent = recettes.toFixed(2) + ' €';
    if (document.getElementById('statDepenses')) document.getElementById('statDepenses').textContent = depenses.toFixed(2) + ' €';
    if (document.getElementById('statBalance')) document.getElementById('statBalance').textContent = balance.toFixed(2) + ' €';
    if (document.getElementById('statNb')) document.getElementById('statNb').textContent = liste.length;
    if (document.getElementById('soldeBanque')) document.getElementById('soldeBanque').textContent = balance.toFixed(2) + ' €';
}

function updateCategories() {
    const type = document.getElementById('type')?.value;
    const catSelect = document.getElementById('category');
    if (!catSelect) return;

    if (type === 'recette') {
        catSelect.innerHTML = `
            <option>Soins infirmiers</option>
            <option>Honoraires PAI</option>
            <option>Honoraires Mutuelles</option>
            <option>Honoraires Patients</option>
            <option>Autre recette</option>
        `;
    } else {
        catSelect.innerHTML = `
            <option>CARPIMKO</option>
            <option>URSSAF</option>
            <option>Matériel médical</option>
            <option>Loyer professionnel</option>
            <option>Assurance Pro</option>
            <option>Carburant / Déplacements</option>
            <option>Autre dépense</option>
        `;
    }
}
