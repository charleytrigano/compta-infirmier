// ==========================================
// COMPTABILITÉ LIBÉRALE - PLAN COMPTABLE
// Fichier complet : Gestion dynamique du Plan Comptable avec Supabase
// ==========================================

window.listePlanComptable = [];

// ------------------------------------------
// 1. CHARGEMENT DU PLAN COMPTABLE
// ------------------------------------------
window.chargerPlanComptable = async function() {
    if (!window.supabaseClient) {
        console.error("❌ Supabase n'est pas initialisé.");
        return;
    }

    try {
        const { data, error } = await window.supabaseClient
            .from('plan_comptable')
            .select('*')
            .order('code', { ascending: true });

        if (error) throw error;

        window.listePlanComptable = data || [];
        window.afficherPlanComptable();
        window.mettreAJourSelectsCategories();

    } catch (err) {
        console.error("Erreur lors du chargement du plan comptable :", err.message);
    }
};

// ------------------------------------------
// 2. AFFICHAGE DU TABLEAU DU PLAN COMPTABLE
// ------------------------------------------
window.afficherPlanComptable = function() {
    const tbody = document.getElementById('body-tableau-plan-comptable');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (window.listePlanComptable.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:#94a3b8; padding:20px;">Aucun compte dans le plan comptable.</td></tr>`;
        return;
    }

    window.listePlanComptable.forEach(compte => {
        const estRecette = compte.type === 'recette';
        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid #e2e8f0';
        tr.innerHTML = `
            <td style="padding:10px; font-weight:bold;">${compte.code}</td>
            <td style="padding:10px;">${compte.nom}</td>
            <td style="padding:10px;">
                <span style="background:${estRecette ? '#dcfce7' : '#fee2e2'}; color:${estRecette ? '#166534' : '#991b1b'}; padding:4px 8px; border-radius:4px; font-size:0.85rem; font-weight:bold;">
                    ${estRecette ? 'Recette (Classe 7)' : 'Dépense (Classe 6)'}
                </span>
            </td>
            <td style="padding:10px;">
                <button style="background:none; border:none; cursor:pointer; font-size:1.1rem;" onclick="window.supprimerCompteComptable('${compte.id}')" title="Supprimer le compte">🗑️</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
};

// ------------------------------------------
// 3. MISE À JOUR DYNAMIQUE DES SELECTS DE CATEGORIE
// ------------------------------------------
window.mettreAJourSelectsCategories = function() {
    // Ciblage des listes déroulantes de catégories dans tous les formulaires
    const selectsCategorie = document.querySelectorAll('select[id*="categorie"], select[id*="Catégorie"], select[name*="categorie"]');
    
    selectsCategorie.forEach(select => {
        const valeurActuelle = select.value;
        select.innerHTML = '';

        if (window.listePlanComptable.length === 0) {
            const optionDefaut = document.createElement('option');
            optionDefaut.value = 'Divers';
            optionDefaut.textContent = 'Divers';
            select.appendChild(optionDefaut);
            return;
        }

        window.listePlanComptable.forEach(compte => {
            const option = document.createElement('option');
            option.value = compte.nom;
            option.textContent = `${compte.code} - ${compte.nom}`;
            select.appendChild(option);
        });

        if (valeurActuelle) {
            select.value = valeurActuelle;
        }
    });
};

// ------------------------------------------
// 4. CRÉATION D'UN NOUVEAU COMPTE COMPTABLE
// ------------------------------------------
window.ajouterCompteComptable = async function(event) {
    if (event) event.preventDefault();

    if (!window.supabaseClient) {
        alert("❌ Connexion à Supabase introuvable.");
        return;
    }

    const inputCode = document.getElementById('pcg-code');
    const inputNom = document.getElementById('pcg-nom');
    const selectType = document.getElementById('pcg-type');

    const codeVal = inputCode ? inputCode.value.trim() : '';
    const nomVal = inputNom ? inputNom.value.trim() : '';
    const typeVal = selectType ? selectType.value : 'depense';

    if (!codeVal || !nomVal) {
        alert("⚠️ Veuillez saisir un numéro de compte et un intitulé.");
        return;
    }

    try {
        const { error } = await window.supabaseClient
            .from('plan_comptable')
            .insert([{ code: codeVal, nom: nomVal, type: typeVal }]);

        if (error) throw error;

        if (inputCode) inputCode.value = '';
        if (inputNom) inputNom.value = '';

        await window.chargerPlanComptable();

    } catch (err) {
        console.error("Erreur lors de la création du compte :", err.message);
        alert("Erreur lors de la création du compte : " + err.message);
    }
};

// ------------------------------------------
// 5. SUPPRESSION D'UN COMPTE COMPTABLE
// ------------------------------------------
window.supprimerCompteComptable = async function(id) {
    const confirmation = confirm("Voulez-vous vraiment supprimer ce compte comptable ?");
    if (!confirmation) return;

    try {
        const { error } = await window.supabaseClient
            .from('plan_comptable')
            .delete()
            .eq('id', id);

        if (error) throw error;

        await window.chargerPlanComptable();

    } catch (err) {
        console.error("Erreur lors de la suppression du compte :", err.message);
        alert("Erreur de suppression : " + err.message);
    }
};

// ------------------------------------------
// INITIALISATION AUTOMATIQUE
// ------------------------------------------
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(function() {
        if (window.supabaseClient) {
            window.chargerPlanComptable();
        }
    }, 350);
});
