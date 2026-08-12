// ==========================================
// 1. CONFIGURATION ET VARIABLES GLOBALES
// ==========================================

// Identifiants Supabase
const SUPABASE_URL = 'https://qfwhzuhwldurnmhirgil.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFmd2h6dWh3bGR1cm5taGlyZ2lsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU0OTQ0MTgsImV4cCI6MjEwMTA3MDQxOH0.Lt7eU9UBVY94tIIMUNOzLeJOpWnkGkvszy_gENkUkLg';

// Variables d'état
let supabaseClient = null;
let currentTransactions = [];
let currentProfileId = null;


// ==========================================
// 2. FONCTIONS UTILITAIRES DE L'INTERFACE
// ==========================================

/**
 * Insère une valeur texte ou champ dans un élément du DOM
 */
function remplir(id, valeur) {
  const el = document.getElementById(id);
  if (!el) return;
  if (el.tagName === 'INPUT' || el.tagName === 'SELECT') {
    el.value = valeur || '';
  } else {
    el.textContent = valeur || '-';
  }
}

/**
 * Formate un nombre en Euros (€)
 */
function formatMonnaie(montant) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(montant || 0);
}

/**
 * Change dynamiquement les options du menu déroulant "Catégorie"
 */
function updateCategories() {
  const typeEl = document.getElementById('type');
  const categorieEl = document.getElementById('categorie');
  if (!typeEl || !categorieEl) return;

  const type = typeEl.value;
  categorieEl.innerHTML = '';

  const recettesCategories = [
    'Honoraires conventionnés',
    'Honoraires libres',
    'Rétrocession reçue',
    'Gains divers / Aides',
    'Autre recette'
  ];

  const depensesCategories = [
    'CARPIMKO',
    'URSSAF',
    'Loyer / Charges locatives',
    'Matériel médical / Consommables',
    'Assurances professionnelles',
    'Frais de déplacement / Carburant',
    'Télécoms / Internet / Logiciels',
    'Formations / Documentation',
    'Honoraires comptables / Conseil',
    'Rétrocession versée',
    'Autre dépense'
  ];

  const liste = (type === 'Recette') ? recettesCategories : depensesCategories;

  liste.forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat;
    opt.textContent = cat;
    categorieEl.appendChild(opt);
  });
}


// ==========================================
// 3. INTERACTIONS AVEC LA BASE SUPABASE
// ==========================================

/**
 * Charge le profil depuis la table 'profile' (au singulier)
 */
async function chargerProfil() {
  if (!supabaseClient) return;

  try {
    const { data, error } = await supabaseClient
      .from('profile') // Nom de la table corrigé d'après ta capture
      .select('*')
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('Erreur chargement profil :', error);
      return;
    }

    if (data) {
      currentProfileId = data.id;
      remplir('nom', data.nom);
      remplir('prenom', data.prenom);
      remplir('siret', data.siret);
      remplir('adresse', data.adresse);
    }
  } catch (err) {
    console.error('Erreur dans la fonction chargerProfil :', err);
  }
}

/**
 * Charge les opérations depuis la table 'transactions'
 */
async function chargerTransactions() {
  if (!supabaseClient) return;

  try {
    const { data, error } = await supabaseClient
      .from('transactions')
      .select('*')
      .order('date', { ascending: false });

    if (error) {
      console.error('Erreur chargement transactions :', error);
      return;
    }

    currentTransactions = data || [];
    afficherTransactions();
  } catch (err) {
    console.error('Erreur dans la fonction chargerTransactions :', err);
  }
}

/**
 * Rendu visuel du tableau des transactions
 */
function afficherTransactions() {
  const tbody = document.getElementById('transactions-tbody');
  if (!tbody) return;

  tbody.innerHTML = '';

  if (currentTransactions.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">Aucune transaction enregistrée</td></tr>';
    return;
  }

  currentTransactions.forEach(t => {
    const tr = document.createElement('tr');
    
    const isRecette = t.type === 'Recette';
    const classMontant = isRecette ? 'text-success' : 'text-danger';
    const signe = isRecette ? '+' : '-';

    tr.innerHTML = `
      <td>${t.date || ''}</td>
      <td><span class="badge ${isRecette ? 'bg-success' : 'bg-warning text-dark'}">${t.type}</span></td>
      <td>${t.categorie || ''}</td>
      <td>${t.description || ''}</td>
      <td class="${classMontant}" style="font-weight: bold; text-align: right;">
        ${signe} ${formatMonnaie(t.montant)}
      </td>
    `;
    tbody.appendChild(tr);
  });
}

/**
 * Enregistre une nouvelle transaction
 */
async function ajouterOperation(e) {
  if (e) e.preventDefault();

  const date = document.getElementById('date')?.value;
  const type = document.getElementById('type')?.value;
  const categorie = document.getElementById('categorie')?.value;
  const description = document.getElementById('description')?.value;
  const montant = parseFloat(document.getElementById('montant')?.value || 0);

  if (!date || isNaN(montant) || montant <= 0) {
    alert('Veuillez saisir une date et un montant supérieur à 0.');
    return;
  }

  if (!supabaseClient) {
    alert('Connexion Supabase non établie.');
    return;
  }

  try {
    const { error } = await supabaseClient
      .from('transactions')
      .insert([{ date, type, categorie, description, montant }]);

    if (error) {
      console.error('Erreur insertion transaction :', error);
      alert('Erreur lors de l\'enregistrement de la transaction.');
      return;
    }

    // Vider les champs après validation
    if (document.getElementById('description')) document.getElementById('description').value = '';
    if (document.getElementById('montant')) document.getElementById('montant').value = '0.00';

    // Rafraîchir l'affichage
    await chargerTransactions();

  } catch (err) {
    console.error('Erreur lors de l\'ajout :', err);
  }
}


// ==========================================
// 4. GESTION DU BASCULEMENT DES ONGLETS
// ==========================================

function showTab(tabName) {
  // Masque tous les contenus d'onglets
  const allTabs = document.querySelectorAll('.tab-content');
  allTabs.forEach(tab => tab.classList.add('hidden'));

  // Retire l'état actif de tous les boutons
  const buttons = document.querySelectorAll('.tab-btn');
  buttons.forEach(btn => btn.classList.remove('active'));

  // Affiche l'onglet demandé
  const targetTab = document.getElementById(`tab-${tabName}`);
  if (targetTab) {
    targetTab.classList.remove('hidden');
  }

  // Active le bouton correspondant
  const activeBtn = Array.from(buttons).find(btn => btn.getAttribute('onclick')?.includes(`'${tabName}'`));
  if (activeBtn) {
    activeBtn.classList.add('active');
  }
}


// ==========================================
// 5. DEMARRAGE DE L'APPLICATION (DOM LOADED)
// ==========================================

document.addEventListener('DOMContentLoaded', async () => {
  const loadingEl = document.getElementById('loading');
  const appEl = document.getElementById('app');
  const syncStatus = document.getElementById('sync-status');

  // Masquer l'écran de chargement
  if (loadingEl) loadingEl.style.display = 'none';
  if (appEl) appEl.classList.remove('hidden');

  // Écouteurs sur les sélecteurs et le formulaire
  const typeSelect = document.getElementById('type');
  if (typeSelect) {
    typeSelect.addEventListener('change', updateCategories);
  }

  const formOperation = document.getElementById('form-operation');
  if (formOperation) {
    formOperation.addEventListener('submit', ajouterOperation);
  }

  // Initialisation de la date du jour par défaut
  const inputDate = document.getElementById('date');
  if (inputDate) {
    inputDate.value = new Date().toISOString().split('T')[0];
  }

  // Initialisation des catégories
  updateCategories();

  // Connexion Supabase
  try {
    if (window.supabase) {
      supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

      if (syncStatus) {
        syncStatus.className = 'badge bg-success';
        syncStatus.textContent = '☁️ Connecté à Supabase';
      }

      // Chargement initial des données
      await chargerProfil();
      await chargerTransactions();

    } else {
      if (syncStatus) {
        syncStatus.className = 'badge bg-danger';
        syncStatus.textContent = '⚠️ SDK non chargé';
      }
    }
  } catch (err) {
    console.error('Erreur initialisation Supabase :', err);
    if (syncStatus) {
      syncStatus.className = 'badge bg-warning text-dark';
      syncStatus.textContent = '⚠️ Erreur de connexion';
    }
  }
});
