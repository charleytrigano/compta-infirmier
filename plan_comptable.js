// plan_comptable.js - Gestion unifiée du Plan Comptable avec Supabase

(function () {
    // 1. Récupération sécurisée du client Supabase initialisé
    function getSupabase() {
        if (window.supabaseClient && typeof window.supabaseClient.from === 'function') {
            return window.supabaseClient;
        }
        if (window.supabase && typeof window.supabase.from === 'function') {
            return window.supabase;
        }
        return null;
    }

    // 2. Fonction d'enregistrement d'un nouveau compte
    window.enregistrerNouveauCompte = async function (e) {
        if (e && e.preventDefault) e.preventDefault();

        const supabase = getSupabase();
        if (!supabase) {
            alert("Erreur : Le client Supabase n'est pas initialisé correctement.");
            return;
        }

        // Récupération dynamique des champs du formulaire
        const codeInput = document.getElementById('code_compte') || document.querySelector('.modal input[placeholder*="606100"]') || document.querySelectorAll('.modal input')[0];
        const intituleInput = document.getElementById('intitule_compte') || document.querySelectorAll('.modal input')[1];
        const typeSelect = document.getElementById('type_compte') || document.querySelector('.modal select');

        const code = codeInput ? codeInput.value.trim() : '';
        const intitule = intituleInput ? intituleInput.value.trim() : '';
        const typeCompte = typeSelect ? typeSelect.value : 'Général';

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
                        type: typeCompte
                    }
                ]);

            if (error) {
                console.error("Erreur Supabase :", error);
                alert("Erreur lors de l'enregistrement : " + error.message);
            } else {
                alert("Compte " + code + " enregistré avec succès !");

                // Fermeture automatique de la modale
                fermerModalCompte();

                // Rechargement du tableau
                if (typeof window.chargerPlanComptable === 'function') {
                    window.chargerPlanComptable();
                } else {
                    location.reload();
                }
            }
        } catch (err) {
            console.error("Erreur inattendue :", err);
            alert("Une erreur est survenue lors de l'enregistrement.");
        }
    };

    // 3. Fermeture de la modale
    window.fermerModalCompte = function () {
        const modals = document.querySelectorAll('.modal, [id*="modal"], div[class*="fixed"]');
        modals.forEach(m => {
            if (m.style.display !== 'none' && m.innerText.includes('Créer un compte')) {
                m.style.display = 'none';
            }
        });
    };

    // 4. Chargement et affichage des comptes du Plan Comptable
    window.chargerPlanComptable = async function () {
        const supabase = getSupabase();
        const table = document.querySelector('table');
        if (!table) return;

        let tbody = table.querySelector('tbody');
        if (!tbody) {
            tbody = document.createElement('tbody');
            table.appendChild(tbody);
        }

        if (!supabase) return;

        const { data: comptes, error } = await supabase
            .from('plan_comptable')
            .select('*')
            .order('code_compte', { ascending: true });

        if (error || !comptes || comptes.length === 0) {
            return;
        }

        tbody.innerHTML = '';
        comptes.forEach((item, index) => {
            const tr = document.createElement('tr');
            tr.style.borderBottom = '1px solid #f1f5f9';
            tr.innerHTML = `
                <td style="padding: 10px 12px; color: #64748b;">${item.id || index + 1}</td>
                <td style="padding: 10px 12px; font-weight: 700; color: #1e293b;">${item.code_compte || '-'}</td>
                <td style="padding: 10px 12px; color: #334155;">${item.intitule || '-'}</td>
                <td style="padding: 10px 12px;">
                    <span style="background-color: #f1f5f9; color: #475569; padding: 3px 8px; border-radius: 4px; font-size: 0.8rem; font-weight: 500;">
                        ${item.type || 'Général'}
                    </span>
                </td>
            `;
            tbody.appendChild(tr);
        });
    };

    // Attachement automatique aux boutons
    document.addEventListener('DOMContentLoaded', () => {
        if (typeof window.chargerPlanComptable === 'function') {
            window.chargerPlanComptable();
        }
    });
})();
