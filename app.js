// ==========================================
// CONFIGURATION & INITIALISATION SUPABASE
// ==========================================
const SUPABASE_URL = 'https://kntkfczfxehgdsruhabu.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtudGtmY3pmeGVoZ2RzcnVoYWJ1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTkzMzU0NSwiZXhwIjoyMDg3NTA5NTQ1fQ.hMpVK2ky6uoU7mauBeoTOR8THCUpycmUogBKyO8Wsmg';

let supabaseClient = null;
let currentTransactions = [];

document.addEventListener('DOMContentLoaded', async () => {
    try {
        if (window.supabase) {
            supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        }

        // Déblocage de l'interface graphique
        document.getElementById('loading').classList.add('hidden');
        document.getElementById('app').classList.remove('hidden');

        const syncStatus = document.getElementById('syncStatus');
        if (syncStatus) syncStatus.textContent = '☁️ Connecté à Supabase';

        // Initialisation de la vue sur l'onglet Profil
        showTab('profil');
        updateCategories();

        // Récupération des données réseau
        await chargerProfil();
        await chargerTransactions();

    } catch (err) {
        console.error('Erreur de démarrage :', err);
        const syncStatus = document.getElementById('syncStatus');
        if (syncStatus) syncStatus.textContent = '⚠️ Erreur de connexion';
    }
});

// ==========================================
// GESTION DYNAMIQUE DES ONGLETS
// ==========================================
function showTab(tabName) {
    // 1. Masquer tous les onglets présents
    const allTabs = document.querySelectorAll('[id^="tab-"]');
    allTabs.forEach(tab => tab.style.display = 'none');

    // 2. Réinitialiser la surbrillance des boutons
    const buttons = document.querySelectorAll('.tab');
    buttons.forEach(btn => btn.classList.remove('active'));

    // 3. Afficher l'onglet sélectionné
    const target = document.getElementById(`tab-${tabName}`);
    if (target) {
        target.style.display = 'block';
    }

    // 4. Mettre en surbrillance le bouton sélectionné
    const activeBtn = Array.from(buttons).find(btn => 
        btn.getAttribute('onclick') && btn.getAttribute('onclick').includes(tabName)
    );
    if (activeBtn) {
        activeBtn.classList.add('active');
    }
}

// ==========================================
// BDD SUPABASE : PROFIL UTILISATEUR
// ==========================================
async function chargerProfil() {
    if (!supabaseClient) return;

    const { data, error } = await supabaseClient
        .from('profil')
        .select('*')
        .maybeSingle();

    if (error) {
        console.warn('Information profil indisponible :', error.message);
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
            if (el && data[field] !== undefined) {
                el.value = data[field];
            }
        });
    }
}

async function saveProfile() {
    if (!supabaseClient) return;

    const profilData = {
        id: 1, // Clef primaire unique pour le profil utilisateur
        nom: document.getElementById('nom')?.value || '',
        prenom: document.getElementById('prenom')?.value || '',
        siret: document.getElementById('siret')?.value || '',
        rpps: document.getElementById('rpps')?.value || '',
        adeli: document.getElementById('adeli')?.value || '',
        num_urssaf: document.getElementById('num_urssaf')?.value || '',
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
        .from('profil')
        .upsert(profilData);

    if (error) {
        alert('Erreur lors de la sauvegarde du profil : ' + error.message);
    } else {
        alert('✅ Profil enregistré dans Supabase !');
    }
}

// ==========================================
// BDD SUPABASE : TRANSACTIONS
// ==========================================
async function chargerTransactions() {
    if (!supabaseClient) return;

    const { data, error } = await supabaseClient
        .from('transactions')
        .select('*')
        .order('date', { ascending: false });

    if (error) {
        console.error('Erreur chargement opérations :', error.message);
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
        container.innerHTML = '<p style="color:#666;">Aucune opération trouvée.</p>';
        return;
    }

    container.innerHTML = liste.map(t => `
        <div class="transaction ${t.type}">
            <div class="transaction-actions">
                <button class="btn btn-danger" onclick="supprimerTransaction('${t.id}')">🗑️</button>
            </div>
            <strong>${t.date}</strong> - <span>${t.description || 'Sans libellé'}</span>
            <div><strong>${t.amount} €</strong> (${t.type.toUpperCase()}) - <em>${t.category || ''}</em></div>
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

    if (!date || isNaN(amount)) {
        alert('Veuillez spécifier une date et un montant valide.');
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
    if (!supabaseClient || !confirm('Voulez-vous vraiment supprimer cette opération ?')) return;

    const { error } = await supabaseClient
        .from('transactions')
        .delete()
        .eq('id', id);

    if (!error) {
        await chargerTransactions();
    }
}

function calculerStatistiques(liste) {
    let recettes = 0;
    let depenses = 0;

    liste.forEach(t => {
        if (t.type === 'recette') recettes += Number(t.amount || 0);
        if (t.type === 'depense') depenses += Number(t.amount || 0);
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
            <option>Honoraires PAI</option>
            <option>Honoraires Mutuelles</option>
            <option>Honoraires Patients</option>
            <option>Autre recette</option>
        `;
    } else {
        catSelect.innerHTML = `
            <option>Matériel médical</option>
            <option>Loyer professionnel</option>
            <option>Assurance Pro</option>
            <option>Carburant / Déplacements</option>
            <option>Cotisations URSSAF/CARPIMKO</option>
            <option>Autre dépense</option>
        `;
    }
}
