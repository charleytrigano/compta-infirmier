// ============================================================================
// 1. CONFIGURATION ET INITIALISATION SUPABASE
// ============================================================================
const SUPABASE_URL = 'https://kntkfczfxehgdsruhabu.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtudGtmY3pmeGVoZ2RzcnVoYWJ1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTkzMzU0NSwiZXhwIjoyMDg3NTA5NTQ1fQ.hMpVK2ky6uoU7mauBeoTOR8THCUpycmUogBKyO8Wsmg';

let supabaseClient = null;
let currentTransactions = [];

// Événement déclenché dès que la page HTML est chargée
document.addEventListener('DOMContentLoaded', async () => {
    const loadingEl = document.getElementById('loading');
    const appEl = document.getElementById('app');
    const syncStatus = document.getElementById('syncStatus');

    try {
        // Initialisation du client Supabase
        if (window.supabase) {
            supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        } else {
            throw new Error("Le SDK Supabase n'est pas disponible.");
        }

        // Mise à jour de l'indicateur de statut
        if (syncStatus) syncStatus.textContent = '☁️ Connecté à Supabase';

        // Chargement des données distantes depuis Supabase
        await chargerProfil();
        await chargerTransactions();

        // 🔓 DÉBLOCAGE DE L'INTERFACE : On masque le chargement et on affiche l'app
        if (loadingEl) {
            loadingEl.style.display = 'none';
            loadingEl.classList.add('hidden');
        }
        if (appEl) {
            appEl.style.display = 'block';
            appEl.classList.remove('hidden');
        }

        // Affichage de l'onglet principal et initialisation des catégories
        showTab('transactions');
        updateCategories();

    } catch (err) {
        console.error('Erreur lors du démarrage :', err);
        
        // En cas d'erreur, on débloque aussi l'écran pour afficher le problème à l'utilisateur
        if (loadingEl) loadingEl.style.display = 'none';
        if (appEl) appEl.style.display = 'block';
        if (syncStatus) syncStatus.textContent = '⚠️ Erreur de connexion Supabase';
    }
});

// ============================================================================
// 2. GESTION DE LA NAVIGATION PAR ONGLETS
// ============================================================================
function showTab(tabName) {
    // 1. Masquer tous les conteneurs d'onglets
    const allTabs = document.querySelectorAll('[id^="tab-"]');
    allTabs.forEach(tab => {
        tab.style.display = 'none';
    });

    // 2. Retirer la classe "active" de tous les boutons
    const buttons = document.querySelectorAll('.tab');
    buttons.forEach(btn => btn.classList.remove('active'));

    // 3. Afficher l'onglet sélectionné
    const targetTab = document.getElementById(`tab-${tabName}`);
    if (targetTab) {
        targetTab.style.display = 'block';
    }

    // 4. Mettre en surbrillance le bouton cliqué
    const activeBtn = Array.from(buttons).find(btn => 
        btn.getAttribute('onclick') && btn.getAttribute('onclick').includes(tabName)
    );
    if (activeBtn) {
        activeBtn.classList.add('active');
    }
}

// ============================================================================
// 3. PROFIL PROFESSIONNEL (CHARGEMENT ET SAUVEGARDE)
// ============================================================================
async function chargerProfil() {
    if (!supabaseClient) return;

    const { data, error } = await supabaseClient
        .from('profil')
        .select('*')
        .maybeSingle();

    if (error) {
        console.error('Erreur de lecture du profil Supabase :', error.message);
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

    const { error } = await supabaseClient
        .from('profil')
        .upsert(profilData);

    if (error) {
        alert('Erreur lors de la sauvegarde sur Supabase : ' + error.message);
    } else {
        alert('✅ Profil enregistré sur Supabase avec succès !');
    }
}

// ============================================================================
// 4. TRANSACTIONS (CHARGEMENT, AFFICHAGE, AJOUT, SUPPRESSION)
// ============================================================================
async function chargerTransactions() {
    if (!supabaseClient) return;

    const container = document.getElementById('transactions');
    if (container) {
        container.innerHTML = '<p style="color:#666; padding:1rem;">⏳ Chargement des données Supabase...</p>';
    }

    const { data, error } = await supabaseClient
        .from('transactions')
        .select('*')
        .order('date', { ascending: false });

    if (error) {
        console.error('Erreur de chargement des transactions :', error.message);
        if (container) {
            container.innerHTML = `<p style="color:#cc0000; padding:1rem;">⚠️ Erreur Supabase : ${error.message}</p>`;
        }
        return;
    }

    currentTransactions = data || [];
    afficherTransactions(currentTransactions);
}

function afficherTransactions(liste) {
    const container = document.getElementById('transactions');
    if (!container) return;

    if (liste.length === 0) {
        container.innerHTML = '<p style="color:#666; padding:1rem;">Aucune opération enregistrée pour le moment dans Supabase.</p>';
        return;
    }

    container.innerHTML = liste.map(t => `
        <div class="transaction ${t.type}" style="padding: 0.8rem; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center;">
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
        alert('Veuillez renseigner au moins une date et un montant valide.');
        return;
    }

    let pieceJointeUrl = null;

    // Gestion du fichier joint si présent
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
            alert('Erreur lors de l\'envoi de la pièce jointe : ' + uploadError.message);
            return;
        }

        const { data: urlData } = supabaseClient
            .storage
            .from('documents')
            .getPublicUrl(filePath);

        pieceJointeUrl = urlData.publicUrl;
    }

    // Enregistrement dans la table transactions
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
        alert('Erreur lors de l\'ajout dans Supabase : ' + error.message);
    } else {
        // Réinitialisation des champs du formulaire
        if (document.getElementById('description')) document.getElementById('description').value = '';
        if (document.getElementById('amount')) document.getElementById('amount').value = '';
        if (fileInput) fileInput.value = '';

        await chargerTransactions();
    }
}

async function supprimerTransaction(id) {
    if (!supabaseClient || !confirm('Voulez-vous supprimer cette opération de Supabase ?')) return;

    const { error } = await supabaseClient
        .from('transactions')
        .delete()
        .eq('id', id);

    if (!error) {
        await chargerTransactions();
    } else {
        alert('Erreur de suppression : ' + error.message);
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
