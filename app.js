// ============================================================================
// 1. CONFIGURATION ET INITIALISATION SUPABASE
// ============================================================================
const SUPABASE_URL = 'https://kntkfczfxehgdsruhabu.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtudGtmY3pmeGVoZ2RzcnVoYWJ1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTkzMzU0NSwiZXhwIjoyMDg3NTA5NTQ1fQ.hMpVK2ky6uoU7mauBeoTOR8THCUpycmUogBKyO8Wsmg';

let supabaseClient = null;
let currentTransactions = [];

document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Initialisation de la connexion Supabase
        if (window.supabase) {
            supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        } else {
            throw new Error("Le SDK Supabase n'est pas chargé dans le HTML.");
        }

        // Mise à jour de l'indicateur d'état
        const syncStatus = document.getElementById('syncStatus');
        if (syncStatus) syncStatus.textContent = '☁️ Connecté à Supabase';

        // Lancement de la lecture des données distantes
        await chargerProfil();
        await chargerTransactions();

    } catch (err) {
        console.error('Erreur d\'initialisation Supabase :', err);
        const syncStatus = document.getElementById('syncStatus');
        if (syncStatus) syncStatus.textContent = '⚠️ Erreur de connexion Supabase';
    }
});

// ============================================================================
// 2. LECTURE ET ÉCRITURE DU PROFIL (SUPABASE)
// ============================================================================
async function chargerProfil() {
    if (!supabaseClient) return;

    const { data, error } = await supabaseClient
        .from('profil')
        .select('*')
        .maybeSingle();

    if (error) {
        console.error('Erreur lecture profil Supabase :', error.message);
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
        alert('Erreur enregistrement profil Supabase : ' + error.message);
    } else {
        alert('✅ Profil sauvegardé sur Supabase !');
    }
}

// ============================================================================
// 3. LECTURE ET GESTION DES TRANSACTIONS (SUPABASE)
// ============================================================================
async function chargerTransactions() {
    if (!supabaseClient) return;

    const container = document.getElementById('transactions');
    if (container) {
        container.innerHTML = '<p style="color:#666;">⏳ Chargement depuis Supabase...</p>';
    }

    // Requête SELECT sur la table transactions
    const { data, error } = await supabaseClient
        .from('transactions')
        .select('*')
        .order('date', { ascending: false });

    if (error) {
        console.error('Erreur chargement transactions Supabase :', error.message);
        if (container) {
            container.innerHTML = `<p style="color:red;">⚠️ Erreur de chargement Supabase : ${error.message}</p>`;
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
        container.innerHTML = '<p style="color:#666; padding:1rem;">Aucune opération enregistrée dans Supabase.</p>';
        return;
    }

    // Génération du rendu HTML pour chaque transaction lue depuis Supabase
    container.innerHTML = liste.map(t => `
        <div class="transaction ${t.type}" style="padding:1rem; border-bottom:1px solid #eee; display:flex; justify-content:space-between; align-items:center;">
            <div>
                <strong>${t.date}</strong> - <span>${t.description || 'Sans libellé'}</span><br>
                <small><strong>${t.amount} €</strong> (${t.type.toUpperCase()}) - <em>${t.category || ''}</em></small>
                ${t.piece_jointe_url ? `<br><a href="${t.piece_jointe_url}" target="_blank" style="font-size:0.85rem; color:#0066cc;">📄 Voir la pièce jointe</a>` : ''}
            </div>
            <div>
                <button class="btn btn-danger" onclick="supprimerTransaction('${t.id}')">🗑️ Supprimer</button>
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
        alert('Veuillez au moins renseigner la date et un montant valide.');
        return;
    }

    let pieceJointeUrl = null;

    // Traitement du téléversement du fichier sur Supabase Storage si sélectionné
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
            alert('Erreur téléversement fichier Supabase Storage : ' + uploadError.message);
            return;
        }

        const { data: urlData } = supabaseClient
            .storage
            .from('documents')
            .getPublicUrl(filePath);

        pieceJointeUrl = urlData.publicUrl;
    }

    // Insertion de la transaction dans la BDD Supabase
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
        alert('Erreur ajout transaction Supabase : ' + error.message);
    } else {
        // Réinitialisation des champs du formulaire
        if (document.getElementById('description')) document.getElementById('description').value = '';
        if (document.getElementById('amount')) document.getElementById('amount').value = '';
        if (fileInput) fileInput.value = '';
        
        // Rechargement dynamique depuis Supabase
        await chargerTransactions();
    }
}

async function supprimerTransaction(id) {
    if (!supabaseClient || !confirm('Voulez-vous supprimer définitivement cette opération de Supabase ?')) return;

    const { error } = await supabaseClient
        .from('transactions')
        .delete()
        .eq('id', id);

    if (error) {
        alert('Erreur suppression Supabase : ' + error.message);
    } else {
        await chargerTransactions();
    }
}

// ============================================================================
// 4. TRANSMISSION COMPTABLE (EXCEL & ZIP DEPUIS SUPABASE)
// ============================================================================
async function exporterPackComptable() {
    if (typeof JSZip === 'undefined' || typeof XLSX === 'undefined') {
        alert('Bibliothèques d\'exportation manquantes (JSZip / XLSX).');
        return;
    }

    alert('⏳ Téléchargement des données Supabase pour l\'expert-comptable...');

    const zip = new JSZip();

    // Génération du tableau Excel
    const worksheetData = [['Date', 'Type', 'Catégorie', 'Description', 'Montant (€)', 'URL Pièce Jointe']];
    currentTransactions.forEach(t => {
        worksheetData.push([t.date, t.type, t.category, t.description, t.amount, t.piece_jointe_url || '']);
    });

    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Comptabilite');

    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    zip.file('Comptabilite_Recapitulatif.xlsx', excelBuffer);

    // Téléchargement compressé
    zip.generateAsync({ type: 'blob' }).then(function(content) {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(content);
        link.download = `Pack_Comptable_${new Date().toISOString().slice(0, 10)}.zip`;
        link.click();
    });
}
