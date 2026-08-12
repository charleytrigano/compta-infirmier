// =======================================================
// 1. CONFIGURATION & INITIALISATION SUPABASE
// =======================================================

// Clés d'accès Supabase (À remplacer par tes identifiants)
const SUPABASE_URL = 'https://qfwhzuhwldurnmhirgil.supabase.co';
const SUPABASE_ANON_KEY = 'TON_CLE_ANON_SUPABASE_ICI';

// Variable globale contenant l'instance du client Supabase
let supabaseClient = null;

// Variable stockant le plan comptable chargé en mémoire
let currentPlanComptable = [];

// Initialisation au chargement du DOM
document.addEventListener('DOMContentLoaded', () => {
    initSupabase();
    chargerPlanComptable();
});

/**
 * Initialise le client SDK Supabase
 */
function initSupabase() {
    try {
        if (typeof supabase !== 'undefined') {
            supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
            console.log("Connecté à Supabase avec succès.");
        } else {
            console.error("Le SDK Supabase n'est pas chargé dans le fichier HTML.");
        }
    } catch (error) {
        console.error("Erreur lors de l'initialisation de Supabase :", error);
    }
}

// =======================================================
// 2. GESTION DU PLAN COMPTABLE
// =======================================================

/**
 * Récupère le plan comptable depuis la base de données Supabase
 */
async function chargerPlanComptable() {
    if (!supabaseClient) return;

    try {
        const { data, error } = await supabaseClient
            .from('plan_comptable')
            .select('*')
            .order('code_compte', { ascending: true });

        if (error) {
            console.error("Erreur de récupération du plan comptable :", error.message);
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
 * Affiche les comptes dans la table du Plan Comptable (DOM)
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
                    Aucun compte personnalisé trouvé.
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
                <button onclick="supprimerComptePC('${compte.id}')" style="color: red; cursor: pointer;">
                    Supprimer
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

/**
 * Ajoute un nouveau compte dans la table plan_comptable
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
        alert("Veuillez saisir le Code Compte et le Libellé.");
        return;
    }

    const { data, error } = await supabaseClient
        .from('plan_comptable')
        .insert([{ code_compte: code, libelle: libelle, type_compte: type }]);

    if (error) {
        alert("Erreur lors de l'ajout : " + error.message);
        console.error("Erreur insert plan_comptable :", error);
    } else {
        alert("✅ Compte ajouté au Plan Comptable avec succès !");
        if (codeInput) codeInput.value = '';
        if (libelleInput) libelleInput.value = '';
        await chargerPlanComptable();
    }
}

/**
 * Supprime un compte du plan comptable
 * @param {string} id - UUID du compte
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
// 3. SCAN & TÉLÉVERSEMENT DES JUSTIFICATIFS (STORAGE)
// =======================================================

/**
 * Téléverse le fichier scanné/sélectionné vers le bucket Supabase 'justificatifs'
 * @param {File} fichier - Le fichier issu du champ input
 * @returns {Promise<string|null>} - L'URL publique de la pièce jointe
 */
async function uploaderJustificatif(fichier) {
    if (!supabaseClient) {
        alert("La connexion à Supabase n'est pas initialisée.");
        return null;
    }

    if (!fichier) return null;

    try {
        // Génération d'un nom unique avec horodatage
        const extension = fichier.name.split('.').pop();
        const nomFichierUnique = `scan_${Date.now()}.${extension}`;

        // Transfert du fichier dans le bucket Storage
        const { data, error } = await supabaseClient
            .storage
            .from('justificatifs')
            .upload(nomFichierUnique, fichier, {
                cacheControl: '3600',
                upsert: false
            });

        if (error) {
            console.error("Erreur d'upload Storage :", error.message);
            throw new Error("Échec de l'envoi du justificatif : " + error.message);
        }

        // Récupération de l'URL publique
        const { data: urlData } = supabaseClient
            .storage
            .from('justificatifs')
            .getPublicUrl(nomFichierUnique);

        return urlData.publicUrl;

    } catch (e) {
        console.error("Détails uploaderJustificatif :", e);
        throw e;
    }
}

// =======================================================
// 4. ENREGISTREMENT DE TRANSACTION AVEC SCAN
// =======================================================

/**
 * Traite le formulaire de création de transaction
 * @param {Event} event - Événement submit du formulaire
 */
async function enregistrerTransaction(event) {
    if (event) event.preventDefault();

    if (!supabaseClient) {
        alert("La connexion à la base de données est indisponible.");
        return;
    }

    const date = document.getElementById('txDate')?.value;
    const libelle = document.getElementById('txLibelle')?.value;
    const montant = parseFloat(document.getElementById('txMontant')?.value);
    const codeCompte = document.getElementById('txCompte')?.value;
    const fileInput = document.getElementById('txFile');
    const fichier = fileInput?.files ? fileInput.files[0] : null;

    if (!date || !libelle || isNaN(montant) || !codeCompte) {
        alert("Veuillez remplir tous les champs obligatoires de la transaction.");
        return;
    }

    try {
        let urlJustificatif = null;

        // Étape A : Scan / Upload si un fichier est sélectionné
        if (fichier) {
            urlJustificatif = await uploaderJustificatif(fichier);
        }

        // Étape B : Insertion en base de données
        const { data, error } = await supabaseClient
            .from('transactions')
            .insert([{
                date_transaction: date,
                libelle: libelle,
                montant: montant,
                code_compte: codeCompte,
                justificatif_url: urlJustificatif
            }]);

        if (error) {
            alert("Erreur lors de l'enregistrement de la transaction : " + error.message);
        } else {
            alert("✅ Transaction et justificatif enregistrés avec succès !");
            
            // Reinitialisation des champs du formulaire
            document.getElementById('formTransaction')?.reset();
        }

    } catch (err) {
        alert("Erreur : " + err.message);
    }
}
