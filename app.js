// ============================================================================
// 1. CONFIGURATION ET INITIALISATION SUPABASE
// ============================================================================
const SUPABASE_URL = 'https://kntkfczfxehgdsruhabu.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtudGtmY3pmeGVoZ2RzcnVoYWJ1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTkzMzU0NSwiZXhwIjoyMDg3NTA5NTQ1fQ.hMpVK2ky6uoU7mauBeoTOR8THCUpycmUogBKyO8Wsmg';

let supabaseClient = null;
let currentTransactions = [];
let currentDocuments = [];

// Déclenchement automatique au chargement complet du DOM
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Initialisation du client via le SDK Supabase
        if (window.supabase) {
            supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        }

        // Masquage de l'écran d'attente et affichage de l'application
        const loadingEl = document.getElementById('loading');
        const appEl = document.getElementById('app');
        if (loadingEl) loadingEl.classList.add('hidden');
        if (appEl) appEl.classList.remove('hidden');

        // Indication du statut de connexion
        const syncStatus = document.getElementById('syncStatus');
        if (syncStatus) syncStatus.textContent = '☁️ Connecté à Supabase';

        // Vue initiale et catégories
        showTab('profil');
        updateCategories();

        // Chargement des données distantes
        await chargerProfil();
        await chargerTransactions();
        await chargerDocuments();

    } catch (err) {
        console.error('Erreur lors de l\'initialisation :', err);
        const syncStatus = document.getElementById('syncStatus');
        if (syncStatus) syncStatus.textContent = '⚠️ Erreur de connexion';
    }
});

// ============================================================================
// 2. GESTION DE LA NAVIGATION PAR ONGLETS
// ============================================================================
function showTab(tabName) {
    // Masquer tous les panneaux d'onglets
    const allTabs = document.querySelectorAll('[id^="tab-"]');
    allTabs.forEach(tab => {
        tab.style.display = 'none';
    });

    // Réinitialiser le style des boutons d'onglets
    const buttons = document.querySelectorAll('.tab');
    buttons.forEach(btn => btn.classList.remove('active'));

    // Afficher le panneau demandé
    const targetTab = document.getElementById(`tab-${tabName}`);
    if (targetTab) {
        targetTab.style.display = 'block';
    }

    // Activer visuellement le bouton cliqué
    const activeBtn = Array.from(buttons).find(btn => 
        btn.getAttribute('onclick') && btn.getAttribute('onclick').includes(tabName)
    );
    if (activeBtn) {
        activeBtn.classList.add('active');
    }
}

// ============================================================================
// 3. GESTION DU PROFIL PROFESSIONNEL
// ============================================================================
async function chargerProfil() {
    if (!supabaseClient) return;

    const { data, error } = await supabaseClient
        .from('profil')
        .select('*')
        .maybeSingle();

    if (error) {
        console.warn('Impossible de charger le profil :', error.message);
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
        id: 1, // Clef primaire unique pour le profil
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
        alert('✅ Profil sauvegardé avec succès !');
    }
}

// ============================================================================
// 4. GESTION DES TRANSACTIONS COMPTABLES
// ============================================================================
async function chargerTransactions() {
    if (!supabaseClient) return;

    const { data, error } = await supabaseClient
        .from('transactions')
        .select('*')
        .order('date', { ascending: false });

    if (error) {
        console.error('Erreur de chargement des transactions :', error.message);
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
        container.innerHTML = '<p style="color:#666;">Aucune opération enregistrée pour le moment.</p>';
        return;
    }

    container.innerHTML = liste.map(t => `
        <div class="transaction ${t.type}">
            <div class="transaction-actions">
                <button class="btn btn-danger" onclick="supprimerTransaction('${t.id}')">🗑️</button>
            </div>
            <strong>${t.date}</strong> - <span>${t.description || 'Sans description'}</span>
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
        alert('Veuillez renseigner une date et un montant valide.');
        return;
    }

    const { error } = await supabaseClient
        .from('transactions')
        .insert([{ date, type, category, description, amount }]);

    if (error) {
        alert('Erreur lors de l\'ajout de l\'opération : ' + error.message);
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

// ============================================================================
// 5. GESTION DES DOCUMENTS ET PIÈCES JUSTIFICATIVES (STORAGE)
// ============================================================================
async function uploadDocument() {
    if (!supabaseClient) return;

    const fileInput = document.getElementById('docFile');
    const category = document.getElementById('docCategory').value;
    const notes = document.getElementById('docNotes').value;

    if (!fileInput.files || fileInput.files.length === 0) {
        alert('Veuillez sélectionner un fichier à téléverser.');
        return;
    }

    const file = fileInput.files[0];
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
    const filePath = `justificatifs/${fileName}`;

    // Téléversement du fichier binaire dans le bucket
    const { error: uploadError } = await supabaseClient
        .storage
        .from('documents')
        .upload(filePath, file);

    if (uploadError) {
        alert('Erreur lors de l\'envoi du fichier : ' + uploadError.message);
        return;
    }

    // Récupération de l'accès public
    const { data: urlData } = supabaseClient
        .storage
        .from('documents')
        .getPublicUrl(filePath);

    // Enregistrement des métadonnées dans la BDD
    const { error: dbError } = await supabaseClient
        .from('documents')
        .insert([{
            nom_fichier: file.name,
            fichier_path: filePath,
            fichier_url: urlData.publicUrl,
            categorie: category,
            notes: notes
        }]);

    if (dbError) {
        alert('Erreur lors de l\'enregistrement en base : ' + dbError.message);
    } else {
        alert('✅ Document téléversé avec succès !');
        fileInput.value = '';
        document.getElementById('docNotes').value = '';
        await chargerDocuments();
    }
}

async function chargerDocuments() {
    if (!supabaseClient) return;

    const { data, error } = await supabaseClient
        .from('documents')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Erreur lors de la récupération des documents :', error.message);
        return;
    }

    currentDocuments = data || [];
    afficherDocuments(currentDocuments);
}

function afficherDocuments(liste) {
    const container = document.getElementById('listeDocuments');
    if (!container) return;

    if (liste.length === 0) {
        container.innerHTML = '<p style="color:#666;">Aucun document enregistré.</p>';
        return;
    }

    container.innerHTML = liste.map(doc => `
        <div class="transaction">
            <div class="transaction-actions">
                <a href="${doc.fichier_url}" target="_blank" class="btn btn-secondary" style="text-decoration:none;">📄 Voir</a>
                <button class="btn btn-danger" onclick="supprimerDocument('${doc.id}', '${doc.fichier_path}')">🗑️</button>
            </div>
            <strong>${doc.categorie}</strong> - <span>${doc.nom_fichier}</span>
            <div><small>${doc.notes ? doc.notes : ''}</small></div>
        </div>
    `).join('');
}

async function supprimerDocument(id, filePath) {
    if (!supabaseClient || !confirm('Voulez-vous supprimer ce document ?')) return;

    // Suppression dans le stockage
    await supabaseClient.storage.from('documents').remove([filePath]);

    // Suppression de l'entrée en base
    const { error } = await supabaseClient
        .from('documents')
        .delete()
        .eq('id', id);

    if (!error) {
        await chargerDocuments();
    }
}

// ============================================================================
// 6. TRANSMISSION ET EXPORTATION POUR L'EXPERT-COMPTABLE
// ============================================================================
async function exporterPackComptable() {
    if (typeof JSZip === 'undefined' || typeof XLSX === 'undefined') {
        alert('Les bibliothèques requises (JSZip / SheetJS) ne sont pas chargées.');
        return;
    }

    alert('⏳ Préparation de l\'archive ZIP en cours...');

    const zip = new JSZip();

    // Création de la feuille de calcul Excel
    const worksheetData = [
        ['Date', 'Type', 'Catégorie', 'Description', 'Montant (€)']
    ];

    currentTransactions.forEach(t => {
        worksheetData.push([t.date, t.type, t.category, t.description, t.amount]);
    });

    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Comptabilite');

    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    zip.file('Recapitulatif_Comptable.xlsx', excelBuffer);

    // Ajout des fichiers téléversés dans un sous-dossier du ZIP
    const folderJustificatifs = zip.folder('Justificatifs');

    for (let doc of currentDocuments) {
        try {
            const response = await fetch(doc.fichier_url);
            const blob = await response.blob();
            folderJustificatifs.file(doc.nom_fichier, blob);
        } catch (e) {
            console.warn(`Erreur lors de l'ajout du fichier ${doc.nom_fichier} au ZIP`, e);
        }
    }

    // Téléchargement du fichier ZIP final
    zip.generateAsync({ type: 'blob' }).then(function(content) {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(content);
        link.download = `Pack_Comptable_${new Date().toISOString().slice(0, 10)}.zip`;
        link.click();
    });
}

function preparerEmailComptable() {
    const emailTo = document.getElementById('comptable_email')?.value || '';
    const nom = document.getElementById('nom')?.value || 'Infirmier(e)';
    const prenom = document.getElementById('prenom')?.value || '';

    const subject = encodeURIComponent(`Comptabilité - Pièces et Bilan - ${prenom} ${nom}`);
    const body = encodeURIComponent(
        `Bonjour,\n\nVeuillez trouver ci-joint le récapitulatif comptable ainsi que les pièces justificatives associés.\n\nCordialement,\n${prenom} ${nom}`
    );

    window.location.href = `mailto:${emailTo}?subject=${subject}&body=${body}`;
}

// ============================================================================
// 7. FONCTIONS UTILITAIRES (STATISTIQUES & CATÉGORIES)
// ============================================================================
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
