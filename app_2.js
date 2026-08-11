(function(){
var h = `<div id="tab-profil" style="display:none">
<div class="card">
<h2>👤 Informations professionnelles</h2>
<div class="form-row"><input type="text" id="nom" placeholder="Nom"><input type="text" id="prenom" placeholder="Prénom"></div>
<div class="form-row"><input type="text" id="siret" placeholder="SIRET"><input type="text" id="rpps" placeholder="RPPS"></div>
<div class="form-row"><input type="text" id="adeli" placeholder="ADELI"><input type="text" id="num_urssaf" placeholder="N° URSSAF"></div>
<input type="text" id="adresse" placeholder="Adresse">
<div class="form-row"><input type="text" id="code_postal" placeholder="Code postal"><input type="text" id="ville" placeholder="Ville"></div>
<div class="form-row"><input type="tel" id="telephone" placeholder="Téléphone (06...)"><input type="email" id="email" placeholder="Email professionnel"></div>
<button class="btn btn-primary" onclick="saveProfile()">💾 Enregistrer</button>
</div>
<div class="card">
<h2>👨‍💼 Expert-comptable</h2>
<input type="text" id="comptable_cabinet" placeholder="Nom du cabinet">
<input type="text" id="comptable_adresse" placeholder="Adresse du cabinet">
<div class="form-row"><input type="tel" id="comptable_tel" placeholder="Téléphone"><input type="email" id="comptable_email" placeholder="Email"></div>
<button class="btn btn-primary" onclick="saveProfile()">💾 Enregistrer</button>
</div>
</div>

<div id="tab-operations" style="display:none">
<div class="card">
<h2>➕ Nouvelle opération</h2>
<input type="date" id="date">
<select id="type" onchange="updateCategories()"><option value="recette">💚 Recette</option><option value="depense">🔴 Dépense</option></select>
<select id="category"></select>
<input type="text" id="description" placeholder="Description">
<input type="number" id="amount" placeholder="Montant" step="0.01">
<select id="paymentMethod"><option>Virement</option><option>Chèque</option><option>Espèces</option><option>Carte bancaire</option></select>
<button class="btn btn-primary" onclick="addTransaction()">✅ Ajouter</button>
</div>
<div class="card">
<h2>📋 Liste des opérations</h2>
<div id="transactions"></div>
</div>
</div>

<div id="tab-banque" style="display:none">
<div class="card">
<h2>🏦 Journal de banque</h2>
<div class="stat-card" style="margin-bottom:1.5rem;">
<div class="stat-label">Solde bancaire</div>
<div class="stat-value" id="soldeBanque">0,00 €</div>
</div>
</div>
</div>

<div id="tab-recurrentes" style="display:none">
<div class="card">
<h2>🔄 Dépenses récurrentes</h2>
<p style="margin-bottom:1rem;color:#666;">Gestion automatique de vos récurrences.</p>
</div>
</div>

<div id="tab-documents" style="display:none">
<div class="card">
<h2>📤 Ajouter un justificatif / document</h2>
<div class="form-row">
  <select id="docCategory">
    <option value="Facture Dépense">Facture Dépense</option>
    <option value="Recette / Encaissement">Recette / Encaissement</option>
    <option value="Relevé Bancaire">Relevé Bancaire</option>
    <option value="Cotisation Sociale">Cotisation Sociale (URSSAF / CARPIMKO)</option>
    <option value="Autre">Autre document</option>
  </select>
  <input type="text" id="docNotes" placeholder="Note / Description rapide (ex: Matériel infirmier)">
</div>
<input type="file" id="docFile" accept="image/*,application/pdf">
<button class="btn btn-primary" onclick="uploadDocument()">☁️ Sauvegarder dans Supabase</button>
</div>

<div class="card">
<h2>📧 Transmettre à l'expert-comptable</h2>
<p style="margin-bottom:1rem;color:#666;">Générez un paquet complet au format <strong>.ZIP</strong> comprenant le bilan Excel comptable et l'ensemble des pièces justificatives.</p>
<button class="btn btn-success" onclick="exporterPackComptable()">📦 Télécharger le Pack Comptable (.ZIP)</button>
<button class="btn btn-secondary" onclick="preparerEmailComptable()">✉️ Préparer l'e-mail pour le comptable</button>
</div>

<div class="card">
<h2>📑 Documents sauvegardés</h2>
<div id="listeDocuments" class="loading"><p>Chargement des documents...</p></div>
</div>
</div>

<div id="tab-stats" style="display:none">
<div class="stats">
<div class="stat-card"><div class="stat-label">Total Recettes</div><div class="stat-value" id="statRecettes">0,00 €</div></div>
<div class="stat-card"><div class="stat-label">Total Dépenses</div><div class="stat-value" id="statDepenses">0,00 €</div></div>
<div class="stat-card"><div class="stat-label">Balance</div><div class="stat-value" id="statBalance">0,00 €</div></div>
<div class="stat-card"><div class="stat-label">Nb opérations</div><div class="stat-value" id="statNb">0</div></div>
</div>
</div>

<div id="tab-simulateur" style="display:none">
<div class="card">
<h2>🧮 Simulateur de charges</h2>
<p style="color:#666;">Accédez ici à vos calculs prévisionnels.</p>
</div>
</div>`;

var app = document.getElementById('app');
var modal = document.getElementById('aiModal');
var tmp = document.createElement('div');
tmp.innerHTML = h;
while(tmp.firstChild) app.insertBefore(tmp.firstChild, modal);
})();
