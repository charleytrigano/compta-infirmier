// ==========================================
// 1. CONFIGURATION ET VARIABLES GLOBALES
// ==========================================

// Identifiants de connexion à Supabase (déclarés UNE SEULE FOIS)
const SUPABASE_URL = 'https://qfwhzuhwldurnmhirgil.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFmd2h6dWh3bGR1cm5taGlyZ2lsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjMwOTQ0OTQsImV4cCI6MjAzODY3MDQ5NH0.Lt7eU9UBVY94tIIMUNOzLeJOpWr';

// Variables d'état globales de l'application
let supabaseClient = null;
let currentTransactions = [];
let currentProfileId = null;

// Éléments du DOM (interface utilisateur)
const loadingEl = document.getElementById('loading');
const appEl = document.getElementById('app');
const syncStatus = document.getElementById('sync-status');


// ==========================================
// 2. UTILITAIRES DE VENTILATION ET D'AFFICHAGE
// ==========================================

/**
 * Remplit la valeur d'un élément HTML par son ID
 * @param {string} id - L'ID de l'élément HTML
 * @param {string|number} valeur - La valeur à afficher
 */
function remplir(id, valeur) {
  const el = document.getElementById(id);
  if (!el) return;
  if (el.tagName === 'INPUT' || el.tagName === 'SELECT') {
    el.value = valeur;
  } else {
    el.textContent = valeur;
  }
}

/**
 * Formate un nombre en montant monétaire (€)
 * @param {number} montant - Le montant à formater
 * @returns {string} - Le montant formaté en Euros
 */
function formatMonnaie(montant) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(montant || 0);
}

/**
 * Met à jour la liste des catégories selon le type d'opération sélectionné (Recette ou Dépense)
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
// 3. CHARGEMENT ET SAUVEGARDE DES DONNÉES
// ==========================================

/**
 * Charge le profil utilisateur depuis Supabase
 */
async function chargerProfil() {
  if (!supabaseClient) return;
  
  try {
    const { data, error } = await supabaseClient
      .from('profiles')
      .select('*')
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Erreur profil :', error);
      return;
    }

    if (data) {
      currentProfileId = data.id;
      remplir('nom', data.nom || '');
      remplir('prenom', data.prenom || '');
      remplir('siret', data.siret || '');
      remplir('adresse', data.adresse || '');
    }
  } catch (err) {
    console.error('Erreur lors du chargement du profil :', err);
  }
}

/**
 * Charge la liste des transactions depuis Supabase et rafraîchit le tableau
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
    console.error('Erreur lors du chargement des transactions :', err);
  }
}

/**
 * Affiche les transactions dans la table HTML
 */
function afficherTransactions() {
  const tbody = document.getElementById('transactions-tbody');
  if (!tbody) return;

  tbody.innerHTML = '';

  if (currentTransactions.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Aucune transaction enregistrée</td></tr>';
    return;
  }

  currentTransactions.forEach(t => {
    const tr = document.createElement('tr');
    
    const isRecette = t.type === 'Recette';
    const classMontant = isRecette ? 'text-success' : 'text-danger';
    const signe = isRecette ? '+' : '-';

    tr.innerHTML = `
      <td>${t.date || ''}</td>
      <td><span class="badge ${isRecette ? 'bg-success' : 'bg-warning'}">${t.type}</span></td>
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
 * Ajoute une nouvelle transaction dans Supabase
 */
async function ajouterOperation(e) {
  if (e) e.preventDefault();

  const date = document.getElementById('date')?.value;
  const type = document.getElementById('type')?.value;
  const categorie = document.getElementById('categorie')?.value;
  const description = document.getElementById('description')?.value;
  const montant = parseFloat(document.getElementById('montant')?.value || 0);

  if (!date || !montant || montant <= 0) {
    alert('Veuillez saisir une date et un montant valide.');
    return;
  }

  if (!supabaseClient) {
    alert('Connexion à la base de données indisponible.');
    return;
  }

  try {
    const { error } = await supabaseClient
      .from('transactions')
      .insert([{ date, type, categorie, description, montant }]);

    if (error) {
      console.error('Erreur ajout transaction :', error);
      alert('Erreur lors de l\'enregistrement de l\'opération.');
      return;
    }

    // Réinitialisation du champ montant et description
    if (document.getElementById('description')) document.getElementById('description').value = '';
    if (document.getElementById('montant')) document.getElementById('montant').value = '0.00';

    // Rechargement des données
    await chargerTransactions();

  } catch (err) {
    console.error('Erreur lors de l\'ajout de l\'opération :', err);
  }
}


// ==========================================
// 4. NAVIGATION ET GESTION DES ONGLETS
// ==========================================

/**
 * Permet d'afficher l'onglet sélectionné et d'masquer les autres
 * @param {string} tabName - Le nom de l'onglet à afficher
 */
function showTab(tabName) {
  const allTabs = document.querySelectorAll('.tab-content');
  allTabs.forEach(tab => tab.classList.add('hidden'));

  const buttons = document.querySelectorAll('.tab-btn');
  buttons.forEach(btn => btn.classList.remove('active'));

  const targetTab = document.getElementById(`tab-${tabName}`);
  if (targetTab) {
    targetTab.classList.remove('hidden');
  }

  const activeBtn = document.querySelector(`[onclick="showTab('${tabName}')"]`);
  if (activeBtn) {
    activeBtn.classList.add('active');
  }
}


// ==========================================
// 5. INITIALISATION AU CHARGEMENT DU DOM
// ==========================================

document.addEventListener('DOMContentLoaded', async () => {
  // Masquage de l'écran de chargement principal
  if (loadingEl) loadingEl.style.display = 'none';
  if (appEl) appEl.classList.remove('hidden');

  // Initialisation de la sélection de type
  const typeSelect = document.getElementById('type');
  if (typeSelect) {
    typeSelect.addEventListener('change', updateCategories);
  }

  // Écouteur sur le formulaire d'ajout d'opération
  const formOperation = document.getElementById('form-operation');
  if (formOperation) {
    formOperation.addEventListener('submit', ajouterOperation);
  }

  // Connexion à Supabase
  try {
    if (window.supabase) {
      supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
      
      if (syncStatus) {
        syncStatus.textContent = '☁️ Connecté à Supabase';
      }

      // Initialisation des éléments
      updateCategories();

      const inputDate = document.getElementById('date');
      if (inputDate && !inputDate.value) {
        inputDate.value = new Date().toISOString().split('T')[0];
      }

      // Chargement initial des données depuis Supabase
      await chargerProfil();
      await chargerTransactions();

    } else {
      if (syncStatus) {
        syncStatus.textContent = '⚠️ SDK Supabase non disponible';
      }
    }
  } catch (err) {
    console.error('Erreur lors de l\'initialisation de l\'application :', err);
    if (syncStatus) {
      syncStatus.textContent = '⚠️ Erreur de chargement';
    }
  }
});
