/**
 * auth.js - Authentification par compte, un compte = un infirmier.
 *
 * Tant qu'aucun compte n'est connecté, seul l'écran de connexion (#auth-overlay,
 * dans index.html) est visible ; le reste de l'application (#app-content) reste
 * masqué. Une fois connecté, chaque requête vers Supabase porte automatiquement
 * l'identité de l'infirmier connecté : les règles de sécurité (Row Level Security)
 * activées côté Supabase (voir migration_multi_infirmiers.sql) font le reste --
 * chaque infirmier ne voit et ne modifie QUE ses propres données (transactions,
 * écritures, profil, déclarations, justificatifs). Le plan comptable reste
 * volontairement partagé entre tous les infirmiers.
 *
 * Aucune autre partie du logiciel n'a besoin d'être modifiée pour ça : les
 * nouvelles lignes sont automatiquement rattachées au bon infirmier par
 * Supabase lui-même (colonne user_id avec la valeur par défaut auth.uid()).
 */

function afficherAuthOverlay(afficher) {
    const overlay = document.getElementById('auth-overlay');
    const app = document.getElementById('app-content');
    if (overlay) overlay.style.display = afficher ? 'flex' : 'none';
    if (app) app.style.display = afficher ? 'none' : 'block';
}

function afficherMessageAuth(message, estErreur) {
    const zoneErreur = document.getElementById('auth-erreur');
    const zoneInfo = document.getElementById('auth-info');
    if (zoneErreur) {
        zoneErreur.style.display = (message && estErreur) ? 'block' : 'none';
        zoneErreur.textContent = (message && estErreur) ? message : '';
    }
    if (zoneInfo) {
        zoneInfo.style.display = (message && !estErreur) ? 'block' : 'none';
        zoneInfo.textContent = (message && !estErreur) ? message : '';
    }
}

async function connexionInfirmier(event) {
    event.preventDefault();
    afficherMessageAuth('', true);

    if (!window.supabaseClient) {
        afficherMessageAuth("Connexion à Supabase indisponible.", true);
        return;
    }

    const email = document.getElementById('auth-email').value.trim();
    const motDePasse = document.getElementById('auth-password').value;

    const { error } = await window.supabaseClient.auth.signInWithPassword({ email, password: motDePasse });
    if (error) {
        afficherMessageAuth("Échec de connexion : " + error.message, true);
    }
}

async function inscriptionInfirmier(event) {
    event.preventDefault();
    afficherMessageAuth('', true);

    if (!window.supabaseClient) {
        afficherMessageAuth("Connexion à Supabase indisponible.", true);
        return;
    }

    const email = document.getElementById('auth-email').value.trim();
    const motDePasse = document.getElementById('auth-password').value;

    if (!email || motDePasse.length < 6) {
        afficherMessageAuth("Renseignez un email et un mot de passe d'au moins 6 caractères.", true);
        return;
    }

    const { data, error } = await window.supabaseClient.auth.signUp({ email, password: motDePasse });
    if (error) {
        afficherMessageAuth("Échec de la création du compte : " + error.message, true);
        return;
    }

    if (data && data.session) {
        // Confirmation par email désactivée côté Supabase : la session démarre tout de suite.
        return;
    }

    afficherMessageAuth("✅ Compte créé ! Vérifiez votre boîte mail pour confirmer votre adresse, puis connectez-vous.", false);
}

async function deconnexionInfirmier() {
    if (window.supabaseClient) {
        await window.supabaseClient.auth.signOut();
    }
}

function majEnTeteUtilisateur(session) {
    const zone = document.getElementById('auth-user-info');
    if (!zone) return;
    if (session && session.user) {
        zone.style.display = 'flex';
        const email = document.getElementById('auth-user-email');
        if (email) email.textContent = session.user.email;
    } else {
        zone.style.display = 'none';
    }
}

async function initAuthGate() {
    if (!window.supabaseClient) {
        // Pas de Supabase configuré (mode dégradé) : on n'impose pas de connexion.
        afficherAuthOverlay(false);
        return;
    }

    const { data: { session } } = await window.supabaseClient.auth.getSession();
    afficherAuthOverlay(!session);
    majEnTeteUtilisateur(session);

    window.supabaseClient.auth.onAuthStateChange((event, session) => {
        afficherAuthOverlay(!session);
        majEnTeteUtilisateur(session);

        // Uniquement lors d'une VRAIE connexion (pas au chargement initial de la
        // page, qui déclenche aussi cet événement) : on recharge la page pour que
        // tous les onglets rechargent leurs données avec le bon compte.
        if (event === 'SIGNED_IN') {
            location.reload();
        }
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAuthGate);
} else {
    initAuthGate();
}
