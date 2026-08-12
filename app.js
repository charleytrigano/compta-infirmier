// =======================================================
// 1. CONFIGURATION & INITIALISATION SUPABASE
// =======================================================

const SUPABASE_URL = 'https://qfwhzuhwldurnmhirgil.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFmd2h6dWh3bGR1cm5taGlyZ2lsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU0OTQ0MTgsImV4cCI6MjEwMTA3MDQxOH0.Lt7eU9UBVY94tIIMUNOzLeJOpWnkGkvszy_gENkUkLgI'; // Remplace par ta vraie clé ANON si besoin

let supabaseClient = null;
let currentPlanComptable = [];

document.addEventListener('DOMContentLoaded', () => {
    initSupabase();
    chargerPlanComptable();
    
    // Initialise le champ date avec la date du jour
    const fieldDate = document.getElementById('txDate');
    if (fieldDate) fieldDate.valueAsDate = new Date();
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
            console.error("Le SDK Supabase n'est pas chargé.");
        }
    } catch (error) {
        console.error("Erreur d'initialisation Supabase :", error);
    }
}

// =======================================================
// 2. GESTION DU PLAN COMPTABLE
// =======================================================

/**
 * Charge les comptes depuis la table 'plan_comptable'
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
        remplirSelecteurComptes(currentPlanComptable);

    } catch (e) {
        console.error("Erreur inattendue plan comptable :", e);
    }
}

/**
 * Affiche le tableau du Plan Comptable
 */
function afficherPlanComptableDansIHM(listeComptes) {
    const tbody = document.getElementById('tbodyPlanComptable');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (!listeComptes || listeComptes.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="4" style="text-align: center; color: #888;">
                    Aucun compte enregistré.
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
                <button class="btn-delete" onclick="supprimerComptePC('${compte.id}')">
                    Supprimer
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

/**
 * Remplit la liste déroulante des comptes dans le formulaire de transaction
 */
function remplirSelecteurComptes(listeComptes) {
    const select = document.getElementById('txCompte');
    if (!select) return;

    select.innerHTML = '<option value="">-- Sélectionner un compte --</option>';

    listeComptes.forEach(compte => {
        const option = document.createElement('option');
        option.value = compte.code_compte;
        option.textContent = `${compte.code_compte} - ${compte.libelle}`;
        select.appendChild(option);
    });
}

/**
 * Ajoute un compte dans la table plan_comptable
 */
async function ajouterComptePC() {
    if (!supabaseClient) {
        alert("Connexion Supabase inactive.");
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
 */
async function supprimerComptePC(id) {
    if (!confirm("Voulez-vous supprimer ce compte ?")) return;

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
// 3. SCAN, TÉLÉVERSEMENT & ENREGISTREMENT TRANSACTION
// =======================================================

/**
 * Téléverse le fichier scanné vers le Storage Supabase
 */
async function uploaderJustificatif(fichier) {
    if (!supabaseClient || !fichier) return null;

    const extension = fichier.name.split('.').pop();
    const nomFichierUnique = `scan_${Date.now()}.${extension}`;

    const { error } = await supabaseClient
        .storage
        .from('justificatifs')
        .upload(nomFichierUnique, fichier, { cacheControl: '3600', upsert: false });

    if (error) throw new Error("Erreur téléversement : " + error.message);

    const { data: urlData } = supabaseClient
        .storage
        .from('justificatifs')
        .getPublicUrl(nomFichierUnique);

    return urlData.publicUrl;
}

/**
 * Enregistre la transaction avec sa pièce jointe
 */
async function enregistrerTransaction(event) {
    if (event) event.preventDefault();

    if (!supabaseClient) {
        alert("Connexion Supabase indisponible.");
        return;
    }

    const btnSubmit = document.getElementById('btnSubmitTx');
    const date = document.getElementById('txDate')?.value;
    const libelle = document.getElementById('txLibelle')?.value;
    const montant = parseFloat(document.getElementById('txMontant')?.value);
    const codeCompte = document.getElementById('txCompte')?.value;
    const fileInput = document.getElementById('txFile');
    const fichier = fileInput?.files ? fileInput.files[0] : null;

    if (!date || !libelle || isNaN(montant) || !codeCompte) {
        alert("Veuillez remplir tous les champs obligatoires.");
        return;
    }

    try {
        if (btnSubmit) {
            btnSubmit.disabled = true;
            btnSubmit.textContent = "Enregistrement en cours...";
        }

        let urlJustificatif = null;

        // Étape A : Téléversement du scan s'il existe
        if (fichier) {
            urlJustificatif = await uploaderJustificatif(fichier);
        }

        // Étape B : Enregistrement de la transaction
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
            alert("Erreur BDD : " + error.message);
        } else {
            alert("✅ Transaction enregistrée avec succès !");
            document.getElementById('formTransaction')?.reset();
            document.getElementById('txDate').valueAsDate = new Date();
        }

    } catch (err) {
        alert("❌ " + err.message);
    } finally {
        if (btnSubmit) {
            btnSubmit.disabled = false;
            btnSubmit.textContent = "Enregistrer la Transaction";
        }
    }
}
