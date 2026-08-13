// ==========================================
// COMPTABILITÉ LIBÉRALE - PLAN COMPTABLE
// Fichier complet : Chargement robuste et sécurisé
// ==========================================

window.listePlanComptable = [];

// Catégories par défaut en cas de délai de réponse Supabase
const CATEGORIES_DEFAUT = [
    { code: "706000", nom: "Soins infirmiers / Honoraires", type: "recette" },
    { code: "645200", nom: "Cotisations CARPIMKO", type: "depense" },
    { code: "645100", nom: "Cotisations URSSAF", type: "depense" },
    { code: "616000", nom: "Assurances & RCP", type: "depense" },
    { code: "625100", nom: "Frais de déplacement / Carburant", type: "depense" },
    { code: "606300", nom: "Petit matériel médical", type: "depense" },
    { code: "622600", nom: "Frais de comptabilité & Logiciels", type: "depense" },
    { code: "613200", nom: "Loyer & Charges locatives", type: "depense" },
    { code: "627000", nom: "Frais bancaires", type: "depense" }
];

// ------------------------------------------
// 1. CHARGEMENT DU PLAN COMPTABLE
// ------------------------------------------
window.chargerPlanComptable = async function() {
    // Initialisation immédiate avec les données par défaut pour éviter le blocage
    if (window.listePlanComptable.length === 0) {
        window.listePlanComptable = CATEGORIES_DEFAUT;
        window.afficherPlanComptable();
        window.mettreAJourSelectsCategories();
    }

    if (!window.supabaseClient) {
        console.warn("⚠️ Client Supabase non encore prêt, utilisation des catégories locales.");
        return;
    }

    try {
        const { data, error } = await window.supabaseClient
            .from('plan_comptable')
            .select('*')
            .order('code', { ascending: true });

        if (error) throw error;

        if (data && data.length > 0) {
            window.listePlanComptable = data;
            window.afficherPlanComptable();
            window.mettreAJourSelectsCategories();
        }
    } catch (err) {
        console.error("Erreur chargement plan comptable :", err.message);
    }
};

// ------------------------------------------
// 2. REMPLISSAGE DU SELECT DE CATÉGORIES
// ------------------------------------------
window.mettreAJourSelectsCategories = function() {
    const selectCat = document.getElementById('categorie');
    if (!selectCat) return;

    const valeurSelectionnee = selectCat.value;
    selectCat.innerHTML = '';

    window.listePlanComptable.forEach(compte => {
        const option = document.createElement('option');
        option.value = compte.nom;
        option.textContent = `${compte.code} - ${compte.nom}`;
        selectCat.appendChild(option);
    });

    if (valeurSelectionnee && Array.from(selectCat.options).some(o => o.value === valeurSelectionnee)) {
        selectCat.value = valeurSelectionnee;
    }
};

// ------------------------------------------
// 3. AFFICHAGE DU TABLEAU DU PLAN COMPTABLE
// ------------------------------------------
window.afficherPlanComptable = function() {
    const tbody = document.getElementById('body-tableau-plan-comptable');
    if (!tbody) return;

    tbody.innerHTML = '';

    window.listePlanComptable.forEach(compte => {
        const estRecette = compte.type === 'recette';
        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid #e2e8f0';
        tr.innerHTML = `
            <td style="padding:10px; font-weight:bold;">${compte.code}</td>
            <td style="padding:10px;">${compte.nom}</td>
            <td style="padding:10px;">
                <span class="${estRecette ? 'badge-recette' : 'badge-depense'}">
                    ${estRecette ? 'Recette (Classe 7)' : 'Dépense (Classe 6)'}
                </span>
            </td>
            <td style="padding:10px;">
                ${compte.id ? `<button style="background:none; border:none; cursor:pointer;" onclick="window.supprimerCompteComptable('${compte.id}')">🗑️</button>` : ''}
            </td>
        `;
        tbody.appendChild(tr);
    });
};

// ------------------------------------------
// 4. CRÉATION D'UN NOUVEAU COMPTE
// ------------------------------------------
window.ajouterCompteComptable = async function(event) {
    if (event) event.preventDefault();

    const inputCode = document.getElementById('pcg-code');
    const inputNom = document.getElementById('pcg-nom');
    const selectType = document.getElementById('pcg-type');

    const codeVal = inputCode ? inputCode.value.trim() : '';
    const nomVal = inputNom ? inputNom.value.trim() : '';
    const typeVal = selectType ? selectType.value : 'depense';

    if (!codeVal || !nomVal) {
        alert("⚠️ Veuillez remplir le numéro et l'intitulé du compte.");
        return;
    }

    try {
        if (window.supabaseClient) {
            const { error } = await window.supabaseClient
                .from('plan_comptable')
                .insert([{ code: codeVal, nom: nomVal, type: typeVal }]);

            if (error) throw error;
        }

        inputCode.value = '';
        inputNom.value = '';

        await window.chargerPlanComptable();

    } catch (err) {
        alert("Erreur lors de l'enregistrement : " + err.message);
    }
};

// ------------------------------------------
// 5. SUPPRESSION D'UN COMPTE
// ------------------------------------------
window.supprimerCompteComptable = async function(id) {
    if (!confirm("Supprimer ce compte comptable ?")) return;

    try {
        if (window.supabaseClient) {
            const { error } = await window.supabaseClient
                .from('plan_comptable')
                .delete()
                .eq('id', id);

            if (error) throw error;
        }

        await window.chargerPlanComptable();
    } catch (err) {
        alert("Erreur de suppression : " + err.message);
    }
};

// Lancement automatique instantané + re-vérification après chargement DOM
window.chargerPlanComptable();
document.addEventListener('DOMContentLoaded', window.chargerPlanComptable);
