// =======================================================
// 1. CONFIGURATION & INITIALISATION SUPABASE
// =======================================================

// Identifiants de connexion Supabase
const SUPABASE_URL = 'https://qfwhzuhwldurnmhirgil.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFmd2h6dWh3bGR1cm5taGlyZ2lsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU0OTQ0MTgsImV4cCI6MjEwMTA3MDQxOH0.Lt7eU9UBVY94tIIMUNOzLeJOpWnkGkvszy_gENkUkLg'; // <-- REMPLACE PAR TA CLÉ ANON SUR SUPABASE

let supabaseClient = null;
let currentPlanComptable = [];

// Exécuté automatiquement dès que le document HTML est prêt
document.addEventListener('DOMContentLoaded', () => {
    initSupabase();
    chargerPlanComptable();
    
    // Initialise la date du jour par défaut dans le formulaire
    const fieldDate = document.getElementById('txDate');
    if (fieldDate) fieldDate.valueAsDate = new Date();
});

/**
 * Initialise l'instance SDK de Supabase
 */
function initSupabase() {
    try {
        if (typeof supabase !== 'undefined') {
            supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
            console.log("Connecté à Supabase avec succès.");
        } else {
            console.error("Le SDK Supabase n'a pas pu être chargé.");
        }
    } catch (error) {
        console.error("Erreur d'initialisation Supabase :", error);
    }
}

// =======================================================
// 2. GESTION DU PLAN COMPTABLE
// =======================================================

/**
 * Charge la liste des comptes depuis la table 'plan_comptable'
 */
async function chargerPlanComptable() {
    if (!supabaseClient) return;

    try {
        const { data, error } = await supabaseClient
            .from('plan_comptable')
            .select('*')
            .order('code_compte', { ascending: true });

        if (error) {
            console.error("Erreur de lecture du plan comptable :", error.message);
            afficherPlanComptableDansIHM([]);
            return;
        }

        currentPlanComptable = data || [];
        afficherPlanComptableDansIHM(currentPlanComptable);

    } catch (e) {
        console.error("Erreur inattendue plan comptable :", e);
    }
}

/**
 * Génère l'affichage HTML du tableau des comptes
 * @param {Array} listeComptes 
 */
function afficherPlanComptableDansIHM(listeComptes) {
    const tbody = document.getElementById('tbodyPlanComptable');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (!listeComptes || listeComptes.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="4" style="text-align: center; color: #888;">
                    Aucun compte enregistré pour le moment.
                </td>
            </tr>`;
        return;
    }

    listeComptes.forEach(compte => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${compte.code_compte}</strong></td>
            <td>${compte.libelle}</td>
            <td>${compte.type_compte || 'Général'}</td>
            <td>
                <button onclick="supprimerComptePC('${compte.id}')" style="background-color: #ef4444; padding: 5px 10px;">
                    Supprimer
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

/**
 * Ajoute un nouveau compte comptable dans la base de données
 */
async function ajouterComptePC() {
    if (!supabaseClient) {
        alert("La connexion à Supabase n'est pas active.");
        return;
    }

    const codeInput = document.getElementById('pcCode');
    const libelleInput = document.getElementById('pcLibelle');
    const typeInput = document.getElementById('pcType');

    const code = codeInput?.value.trim();
    const libelle = libelleInput?.value.trim();
    const type = typeInput?.value || 'Charge';

    if (!code || !libelle) {
        alert("Veuillez remplir le Code Compte et le Libellé.");
        return;
    }

    const { error } = await supabaseClient
        .from('plan_comptable')
        .insert([{ code_compte: code, libelle: libelle, type_compte: type }]);

    if (error) {
        alert("Erreur lors de l'ajout : " + error.message);
    } else {
        alert("✅ Compte ajouté au plan comptable avec succès !");
        if (codeInput) codeInput.value = '';
        if (libelleInput) libelleInput.value = '';
        await chargerPlanComptable();
    }
}

/**
 * Supprime un compte du plan comptable
 * @param {string} id - L'identifiant unique du compte
 */
async function supprimerComptePC(id) {
    if (!confirm("Voulez-vous vraiment supprimer ce compte comptable ?")) return;

    const { error } = await supabaseClient
        .from('plan_comptable')
        .delete()
        .eq('id', id);

    if (error) {
        alert("Erreur lors de la suppression : " + error.message);
    } else {
        await chargerPlanComptable();
    }
}

// =======================================================
// 3. SCAN, TÉLÉVERSEMENT & ENREGISTREMENT
// =======================================================

/**
 * Téléverse le fichier scanné/sélectionné vers le bucket Storage Supabase
 * @param {File} fichier - Le fichier sélectionné
 * @returns {Promise<string|null>} L'URL publique du fichier téléversé
 */
async function uploaderJustificatif(fichier) {
    if (!supabaseClient || !fichier) return null;

    const extension = fichier.name.split('.').pop();
    const nomFichierUnique = `scan_${Date.now()}.${extension}`;

    const { error } = await supabaseClient
        .storage
        .from('justificatifs')
        .upload(nomFichierUnique, fichier, { cacheControl: '3600', upsert: false });

    if (error) throw new Error("Erreur téléversement justificatif : " + error.message);

    const { data: urlData } = supabaseClient
        .storage
        .from('justificatifs')
        .getPublicUrl(nomFichierUnique);

    return urlData.publicUrl;
}

/**
 * Enregistre une nouvelle transaction financière avec sa pièce jointe
 * @param {Event} event - L'événement submit du formulaire
 */
async function enregistrerTransaction(event) {
    if (event) event.preventDefault();

    if (!supabaseClient) {
        alert("Connexion Supabase indisponible.");
        return;
    }

    const date = document.getElementById('txDate')?.value;
    const libelle = document.getElementById('txLibelle')?.value;
    const montant = parseFloat(document.getElementById('txMontant')?.value);
    const codeCompte = document.getElementById('txCompte')?.value;
    const fileInput = document.getElementById('txFile');
    const fichier = fileInput?.files ? fileInput.files[0] : null;

    try {
        let urlJustificatif = null;

        // Téléversement du fichier scanné si présent
        if (fichier) {
            urlJustificatif = await uploaderJustificatif(fichier);
        }

        // Insertion dans la table transactions
        const { error } = await supabaseClient
            .from('transactions')
            .insert([{
                date_transaction: date,
                libelle: libelle,
                montant: montant,
                code_compte: codeCompte,
                justificatif_url: urlJustificatif
            }]);

        if (error) {
            alert("Erreur enregistrement transaction : " + error.message);
        } else {
            alert("✅ Transaction et justificatif enregistrés avec succès !");
            document.getElementById('formTransaction')?.reset();
            document.getElementById('txDate').valueAsDate = new Date();
        }

    } catch (err) {
        alert("❌ " + err.message);
    }
}
