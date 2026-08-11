// ============================================================================
// 1. CONFIGURATION ET INITIALISATION SUPABASE
// ============================================================================
// Nouveaux identifiants issus de votre projet "compta-infirmier"
const SUPABASE_URL = 'https://qfwhzuhwldurnmhirgil.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFmd2h6dWh3bGR1cm5taGlyZ2lsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU0OTQ0MTgsImV4cCI6MjEwMTA3MDQxOH0.Lt7eU9UBVY94tIIMUNOzLeJOpWnkGkvszy_gENkUkLg';

let supabaseClient = null;
let currentTransactions = [];

document.addEventListener('DOMContentLoaded', async () => {
    console.log("🚀 Initialisation de l'application Compta...");

    const loadingEl = document.getElementById('loading');
    const appEl = document.getElementById('app');
    const syncStatus = document.getElementById('syncStatus');

    // 1. Déblocage visuel immédiat de l'interface utilisateur
    if (loadingEl) {
        loadingEl.style.display = 'none';
        loadingEl.classList.add('hidden');
    }
    if (appEl) {
        appEl.style.display = 'block';
        appEl.classList.remove('hidden');
    }

    try {
        // 2. Initialisation du client Supabase
        if (window.supabase) {
            supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
            if (syncStatus) syncStatus.textContent = '☁️ Connexion à Supabase...';
        } else {
            if (syncStatus) syncStatus.textContent = '⚠️ SDK Supabase manquant dans le HTML';
            return;
        }

        // 3. Affichage de l'onglet par défaut (Transactions)
        showTab('transactions');
        updateCategories();

        // 4. Chargement des données distantes depuis Supabase
        await chargerProfil();
        await chargerTransactions();

    } catch (err) {
        console.error('Erreur au démarrage :', err);
        if (syncStatus) syncStatus.textContent = '⚠️ Erreur d\'initialisation';
    }
});

// ============================================================================
// 2. GESTION DE LA NAVIGATION
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
}

// ============================================================================
// 3. GESTION DES TRANSACTIONS (LECTURE, AJOUT, SUPPRESSION)
// ============================================================================
async function chargerTransactions() {
    if (!supabaseClient) return;

    const container = document.getElementById('transactions');
    const syncStatus = document.getElementById('syncStatus');

    if (container) {
        container.innerHTML = '<p style="color:#666; padding:1rem;">⏳ Chargement des opérations depuis Supabase...</p>';
    }

    try {
        const { data, error } = await supabaseClient
            .from('transactions')
            .select('*')
            .order('date', { ascending: false });

        if (error) {
            console.error('Erreur Supabase :', error.message);
            if (container) {
                container.innerHTML = `<p style="color:#cc0000; padding:1rem;">⚠️ Erreur Supabase : ${error.message}</p>`;
            }
            if (syncStatus) syncStatus.textContent = '⚠️ Erreur de lecture';
            return;
        }

        if (syncStatus) syncStatus.textContent = '☁️ Connecté à Supabase';
        currentTransactions = data || [];
        afficherTransactions(currentTransactions);

    } catch (e) {
        console.error("Erreur réseau :", e);
        if (syncStatus) syncStatus.textContent = '❌ Serveur non joignable';
        if (container) {
            container.innerHTML = `
                <div style="padding:1rem; background-color:#fff3f3; border:1px solid #ffcdd2; border-radius:8px; color:#c62828;">
                    <strong>❌ Connexion impossible au serveur Supabase.</strong><br>
                    Veuillez vérifier votre connexion Internet ou réactualiser la page.
                </div>
            `;
        }
    }
}

function afficherTransactions(liste) {
    const container = document.getElementById('transactions');
    if (!container) return;

    if (liste.length === 0) {
        container.innerHTML = '<p style="color:#666; padding:1rem;">Aucune opération enregistrée pour le moment.</p>';
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
        alert('Veuillez indiquer au moins une date et un montant valide.');
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

        if (uploadError) {
            alert('Erreur lors de l\'envoi du fichier : ' + uploadError.message);
            return;
        }

        const { data: urlData } = supabaseClient
            .storage
            .from('documents')
            .getPublicUrl(filePath);

        pieceJointeUrl = urlData.publicUrl;
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
    if (!supabaseClient || !confirm('Voulez-vous vraiment supprimer cette opération ?')) return;

    const { error } = await supabaseClient.from('transactions').delete().eq('id', id);

    if (!error) {
        await chargerTransactions();
    } else {
        alert('Erreur lors de la suppression : ' + error.message);
    }
}

// ============================================================================
// 4. PROFIL PROFESSIONNEL
// ============================================================================
async function chargerProfil() {
    if (!supabaseClient) return;

    try {
        const { data } = await supabaseClient.from('profil').select('*').maybeSingle();

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
    } catch (e) {
        console.warn("Remarque profil :", e);
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

    const { error } = await supabaseClient.from('profil').upsert(profilData);

    if (error) {
        alert('Erreur de sauvegarde : ' + error.message);
    } else {
        alert('✅ Profil sauvegardé sur Supabase !');
    }
}

// ============================================================================
// 5. FONCTIONS UTILITAIRES
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
            <option value="Matériel médical">Matériel médical</option>
            <option value="Loyer professionnel">Loyer professionnel</option>
            <option value="Assurance Pro">Assurance Pro</option>
            <option value="Carburant / Déplacements">Carburant / Déplacements</option>
            <option value="Cotisations URSSAF/CARPIMKO">Cotisations URSSAF/CARPIMKO</option>
            <option value="Autre dépense">Autre dépense</option>
        `;
    }
}
