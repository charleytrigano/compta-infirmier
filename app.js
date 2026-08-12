// =======================================================
// 1. CONFIGURATION & INITIALISATION SUPABASE
// =======================================================

const SUPABASE_URL = 'https://qfwhzuhwldurnmhirgil.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFmd2h6dWh3bGR1cm5taGlyZ2lsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU0OTQ0MTgsImV4cCI6MjEwMTA3MDQxOH0.Lt7eU9UBVY94tIIMUNOzLeJOpWnkGkvszy_gENkUkLg';

let supabaseClient = null;

// Initialisation au chargement du document
document.addEventListener('DOMContentLoaded', () => {
    initSupabase();
    chargerPlanComptable();
    chargerTransactions();

    // Définir la date par défaut à aujourd'hui
    const txDateInput = document.getElementById('txDate');
    if (txDateInput) txDateInput.valueAsDate = new Date();
});

function initSupabase() {
    try {
        if (typeof supabase !== 'undefined') {
            supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
            console.log("Connecté à Supabase avec succès.");
        } else {
            console.error("SDK Supabase manquant.");
        }
    } catch (err) {
        console.error("Erreur d'initialisation Supabase :", err);
    }
}

// =======================================================
// 2. GESTION NAVIGATION ONGLETS
// =======================================================

function changerOnglet(idOnglet, boutonElement) {
    // Masquer tous les onglets
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });

    // Décocher tous les boutons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    // Activer l'onglet sélectionné
    document.getElementById(idOnglet).classList.add('active');
    boutonElement.classList.add('active');

    // Rafraîchir les données si nécessaire
    if (idOnglet === 'onglet-journal') chargerTransactions();
    if (idOnglet === 'onglet-saisie') chargerPlanComptable();
}

// =======================================================
// 3. GESTION DU PLAN COMPTABLE
// =======================================================

async function chargerPlanComptable() {
    if (!supabaseClient) return;

    try {
        const { data, error } = await supabaseClient
            .from('plan_comptable')
            .select('*')
            .order('code_compte', { ascending: true });

        if (error) {
            console.error("Erreur Plan Comptable :", error.message);
            return;
        }

        afficherPlanComptableIHM(data || []);
        remplirSelecteurComptes(data || []);

    } catch (e) {
        console.error("Erreur réseau / BDD :", e);
    }
}

function afficherPlanComptableIHM(liste) {
    const tbody = document.getElementById('tbodyPlanComptable');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (liste.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Aucun compte dans le plan.</td></tr>';
        return;
    }

    liste.forEach(compte => {
        let badgeClass = 'badge-charge';
        if (compte.type_compte === 'Produit') badgeClass = 'badge-produit';
        if (compte.type_compte === 'Trésorerie') badgeClass = 'badge-tresorerie';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${compte.code_compte}</strong></td>
            <td>${compte.libelle}</td>
            <td><span class="badge ${badgeClass}">${compte.type_compte || 'Général'}</span></td>
            <td>
                <button class="btn-delete" onclick="supprimerComptePC('${compte.id}')">Supprimer</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function remplirSelecteurComptes(liste) {
    const select = document.getElementById('txCompte');
    if (!select) return;

    select.innerHTML = '<option value="">-- Sélectionner un compte --</option>';

    liste.forEach(compte => {
        const opt = document.createElement('option');
        opt.value = compte.code_compte;
        opt.textContent = `${compte.code_compte} - ${compte.libelle}`;
        select.appendChild(opt);
    });
}

async function ajouterComptePC() {
    const code = document.getElementById('pcCode').value.trim();
    const libelle = document.getElementById('pcLibelle').value.trim();
    const type = document.getElementById('pcType').value;

    if (!code || !libelle) {
        alert("Veuillez saisir le code et le libellé du compte.");
        return;
    }

    const { error } = await supabaseClient
        .from('plan_comptable')
        .insert([{ code_compte: code, libelle: libelle, type_compte: type }]);

    if (error) {
        alert("Erreur lors de l'ajout : " + error.message);
    } else {
        document.getElementById('pcCode').value = '';
        document.getElementById('pcLibelle').value = '';
        await chargerPlanComptable();
    }
}

async function supprimerComptePC(id) {
    if (!confirm("Voulez-vous vraiment supprimer ce compte ?")) return;

    const { error } = await supabaseClient
        .from('plan_comptable')
        .delete()
        .eq('id', id);

    if (error) {
        alert("Erreur : " + error.message);
    } else {
        await chargerPlanComptable();
    }
}

// =======================================================
// 4. SAISIE, TÉLÉVERSEMENT SCAN & JOURNAL TRANSACTIONS
// =======================================================

async function uploaderFichier(fichier) {
    if (!fichier) return null;

    const extension = fichier.name.split('.').pop();
    const nomFichierUnique = `scan_${Date.now()}.${extension}`;

    const { error } = await supabaseClient
        .storage
        .from('justificatifs')
        .upload(nomFichierUnique, fichier, { cacheControl: '3600', upsert: false });

    if (error) {
        throw new Error("Erreur téléversement du justificatif : " + error.message);
    }

    const { data } = supabaseClient
        .storage
        .from('justificatifs')
        .getPublicUrl(nomFichierUnique);

    return data.publicUrl;
}

async function enregistrerTransaction(event) {
    event.preventDefault();

    const btnSubmit = document.getElementById('btnSubmitTx');
    const date = document.getElementById('txDate').value;
    const libelle = document.getElementById('txLibelle').value;
    const montant = parseFloat(document.getElementById('txMontant').value);
    const codeCompte = document.getElementById('txCompte').value;
    const fileInput = document.getElementById('txFile');
    const fichier = fileInput.files ? fileInput.files[0] : null;

    try {
        btnSubmit.disabled = true;
        btnSubmit.textContent = "Téléversement et enregistrement...";

        // 1. Upload de la pièce jointe (si présente)
        let justificatifUrl = null;
        if (fichier) {
            justificatifUrl = await uploaderFichier(fichier);
        }

        // 2. Écriture en Base de données
        const { error } = await supabaseClient
            .from('transactions')
            .insert([{
                date_transaction: date,
                libelle: libelle,
                montant: montant,
                code_compte: codeCompte,
                justificatif_url: justificatifUrl
            }]);

        if (error) {
            alert("Erreur BDD : " + error.message);
        } else {
            alert("✅ Transaction enregistrée avec succès !");
            document.getElementById('formTransaction').reset();
            document.getElementById('txDate').valueAsDate = new Date();
        }
    } catch (err) {
        alert("❌ " + err.message);
    } finally {
        btnSubmit.disabled = false;
        btnSubmit.textContent = "Enregistrer la Transaction";
    }
}

async function chargerTransactions() {
    if (!supabaseClient) return;

    try {
        const { data, error } = await supabaseClient
            .from('transactions')
            .select('*')
            .order('date_transaction', { ascending: false });

        if (error) {
            console.error("Erreur de chargement des transactions :", error.message);
            return;
        }

        afficherTransactionsIHM(data || []);
    } catch (err) {
        console.error("Erreur :", err);
    }
}

function afficherTransactionsIHM(liste) {
    const tbody = document.getElementById('tbodyTransactions');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (liste.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Aucune transaction enregistrée.</td></tr>';
        return;
    }

    liste.forEach(tx => {
        const dateFr = tx.date_transaction ? new Date(tx.date_transaction).toLocaleDateString('fr-FR') : '-';
        const lienDoc = tx.justificatif_url 
            ? `<a href="${tx.justificatif_url}" target="_blank" class="link-doc">📄 Voir le scan</a>` 
            : '<span style="color:#94a3b8;">Aucun</span>';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${dateFr}</td>
            <td>${tx.libelle}</td>
            <td><strong>${tx.code_compte}</strong></td>
            <td><strong>${parseFloat(tx.montant).toFixed(2)} €</strong></td>
            <td>${lienDoc}</td>
            <td>
                <button class="btn-delete" onclick="supprimerTransaction('${tx.id}')">Supprimer</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

async function supprimerTransaction(id) {
    if (!confirm("Voulez-vous supprimer cette écriture ?")) return;

    const { error } = await supabaseClient
        .from('transactions')
        .delete()
        .eq('id', id);

    if (error) {
        alert("Erreur lors de la suppression : " + error.message);
    } else {
        await chargerTransactions();
    }
}
