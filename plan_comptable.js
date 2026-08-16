// plan_comptable.js - Enregistrement d'un nouveau compte plan comptable

function getSupabase() {
    return window.supabaseClient || (window.supabase && typeof window.supabase.from === 'function' ? window.supabase : null);
}

window.enregistrerNouveauCompte = async function () {
    const supabase = getSupabase();

    if (!supabase) {
        alert("Erreur : Le client Supabase n'est pas initialisé.");
        return;
    }

    const codeInput = document.getElementById('code_compte') || document.querySelector('input[placeholder*="606100"]') || document.querySelectorAll('.modal input')[0];
    const intituleInput = document.getElementById('intitule_compte') || document.querySelectorAll('.modal input')[1];
    const typeSelect = document.getElementById('type_compte') || document.querySelector('.modal select');

    const code = codeInput ? codeInput.value.trim() : '';
    const intitule = intituleInput ? intituleInput.value.trim() : '';
    const typeCompte = typeSelect ? typeSelect.value : '';

    if (!code || !intitule) {
        alert("Veuillez remplir le code et l'intitulé du compte.");
        return;
    }

    try {
        const { data, error } = await supabase
            .from('plan_comptable')
            .insert([
                {
                    code_compte: code,
                    intitule: intitule,
                    type: typeCompte || 'Général'
                }
            ]);

        if (error) {
            console.error("Erreur lors de la création du compte :", error);
            alert("Erreur lors de l'enregistrement : " + error.message);
        } else {
            alert("Compte enregistré avec succès !");
            
            // Fermeture de la modale si présente
            const modal = document.querySelector('.modal, [id*="modal"]');
            if (modal) modal.style.display = 'none';

            // Rechargement du plan comptable
            if (typeof window.chargerPlanComptable === 'function') {
                window.chargerPlanComptable();
            } else {
                location.reload();
            }
        }
    } catch (err) {
        console.error("Erreur inattendue :", err);
        alert("Une erreur est survenue lors de la sauvegarde.");
    }
};
