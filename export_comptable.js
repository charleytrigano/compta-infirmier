/**
 * export_comptable.js - Module de sauvegarde et transmission expert-comptable
 */

function genererFichierJSON() {
  const donnees = {
    transactions: JSON.parse(localStorage.getItem('transactions') || '[]'),
    paiements: JSON.parse(localStorage.getItem('paiements') || '[]'),
    dateExport: new Date().toISOString()
  };

  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(donnees, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", `sauvegarde_compta_${new Date().toISOString().slice(0,10)}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

function importerFichierJSON(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const donnees = JSON.parse(e.target.result);
      if (donnees.transactions) localStorage.setItem('transactions', JSON.stringify(donnees.transactions));
      if (donnees.paiements) localStorage.setItem('paiements', JSON.stringify(donnees.paiements));
      alert("✅ Sauvegarde restaurée avec succès !");
      location.reload();
    } catch (err) {
      alert("❌ Erreur lors de la lecture du fichier de sauvegarde.");
    }
  };
  reader.readAsText(file);
}

function genererCSVJournal() {
  const transactions = JSON.parse(localStorage.getItem('transactions') || '[]');
  if (transactions.length === 0) {
    alert("Aucune transaction à exporter.");
    return;
  }

  let csvContent = "data:text/csv;charset=utf-8,ID;Date;Type;Categorie;Description;Montant (€)\n";
  transactions.forEach(t => {
    csvContent += `"${t.id || ''}";"${t.date || ''}";"${t.type || ''}";"${t.categorie || ''}";"${(t.description || '').replace(/"/g, '""')}";"${t.montant || 0}"\n`;
  });

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `journal_comptable_${new Date().toISOString().slice(0,10)}.csv`);
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function genererTexteMail() {
  const email = document.getElementById('expert-email')?.value || '';
  const nomComptable = document.getElementById('expert-nom')?.value || 'Cabinet Comptable';
  const messagePerso = document.getElementById('expert-message')?.value || '';
  const transactions = JSON.parse(localStorage.getItem('transactions') || '[]');

  let totalRecettes = 0;
  let totalDepenses = 0;
  transactions.forEach(t => {
    const val = parseFloat(t.montant) || 0;
    if (t.type === 'Recette') totalRecettes += val;
    else if (t.type === 'Dépense') totalDepenses += val;
  });
  const benefice = totalRecettes - totalDepenses;

  const corpsBrut = `Bonjour ${nomComptable},

Veuillez trouver la synthèse comptable de l'exercice ci-dessous :

--- RÉSUMÉ DES OPÉRATIONS ---
• Nombre de transactions : ${transactions.length}
• Recettes Totales : ${totalRecettes.toFixed(2)} €
• Dépenses Totales : ${totalDepenses.toFixed(2)} €
• Résultat Net (BNC) : ${benefice.toFixed(2)} €

${messagePerso ? `Note du praticien : ${messagePerso}\n\n` : ''}📌 N.B. N'oubliez pas d'attacher à ce mail le fichier CSV du journal et le fichier JSON de sauvegarde téléchargés depuis l'application.

Cordialement,`;

  return { email, sujet: "Transmission de la comptabilité BNC - Bilan Annuel", corpsBrut };
}

function envoyerEmailExpert() {
  const { email, sujet, corpsBrut } = genererTexteMail();

  if (!email) {
    alert("Veuillez saisir l'adresse e-mail de votre expert-comptable.");
    return;
  }

  // Tente d'ouvrir l'application mail locale
  const mailtoUrl = `mailto:${email}?subject=${encodeURIComponent(sujet)}&body=${encodeURIComponent(corpsBrut)}`;
  window.open(mailtoUrl, '_self');

  // Secours si mailto ne se déclenche pas : redirige vers Gmail Web dans un nouvel onglet après 500ms
  setTimeout(() => {
    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(email)}&su=${encodeURIComponent(sujet)}&body=${encodeURIComponent(corpsBrut)}`;
    window.open(gmailUrl, '_blank');
  }, 500);
}

function copierSynthese() {
  const { corpsBrut } = genererTexteMail();
  navigator.clipboard.writeText(corpsBrut).then(() => {
    alert("📋 Synthèse copiée dans le presse-papier ! Vous pouvez la coller directement dans votre logiciel de messagerie.");
  }).catch(() => {
    alert("Impossible de copier automatiquement. Veuillez sélectionner et copier le texte manuellement.");
  });
}

function renderExportUI() {
  const container = document.getElementById('export-container');
  if (!container) return;

  container.innerHTML = `
    <div class="space-y-6 max-w-5xl mx-auto p-4 font-sans text-slate-800">

      <!-- ENTÊTE -->
      <div class="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex flex-wrap justify-between items-center gap-4">
        <div>
          <h2 class="text-xl font-bold text-slate-800 flex items-center gap-2">
            💾 Sauvegarde & Envoi Expert-Comptable
          </h2>
          <p class="text-xs text-slate-500 mt-1">Exportez vos données au format standard ou transmettez la synthèse à votre cabinet</p>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">

        <!-- SAUVEGARDE & RESTAURATION LOCALE -->
        <div class="bg-white p-5 rounded-xl shadow-sm border border-slate-200 space-y-4">
          <h3 class="text-sm font-bold uppercase tracking-wider text-blue-700 flex items-center gap-2">
            📂 Sauvegarde et Données
          </h3>
          <p class="text-xs text-slate-600">
            Téléchargez une sauvegarde de la base de données locale ou réimportez un fichier de restauration.
          </p>

          <div class="flex flex-col gap-3 pt-2">
            <button onclick="genererFichierJSON()" class="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs py-2.5 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 shadow-sm">
              ⬇️ Exporter la Sauvegarde Globale (.JSON)
            </button>

            <button onclick="genererCSVJournal()" class="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs py-2.5 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 shadow-sm">
              📊 Télécharger le Journal des Écritures (.CSV)
            </button>

            <div class="border-t border-slate-200 pt-3 mt-2">
              <label class="block text-xs font-semibold text-slate-700 mb-1">Restaurer depuis un fichier JSON :</label>
              <input type="file" accept=".json" onchange="importerFichierJSON(event)" class="text-xs w-full text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer">
            </div>
          </div>
        </div>

        <!-- ENVOI À L'EXPERT COMPTABLE -->
        <div class="bg-white p-5 rounded-xl shadow-sm border border-slate-200 space-y-4">
          <h3 class="text-sm font-bold uppercase tracking-wider text-blue-700 flex items-center gap-2">
            ✉️ Transmission Cabinet Comptable
          </h3>
          <p class="text-xs text-slate-600">
            Préparez l'e-mail de transmission incluant les totaux d'exercice calculés automatiquement.
          </p>

          <div class="space-y-3 pt-1">
            <div>
              <label class="block text-xs font-semibold text-slate-700 mb-1">Nom / Cabinet Comptable :</label>
              <input type="text" id="expert-nom" placeholder="Ex: Cabinet Audit & Conseils" class="w-full text-xs border border-slate-300 rounded-lg p-2 bg-slate-50">
            </div>

            <div>
              <label class="block text-xs font-semibold text-slate-700 mb-1">Adresse E-mail du Comptable :</label>
              <input type="email" id="expert-email" placeholder="comptable@cabinet.fr" class="w-full text-xs border border-slate-300 rounded-lg p-2 bg-slate-50">
            </div>

            <div>
              <label class="block text-xs font-semibold text-slate-700 mb-1">Message personnel (facultatif) :</label>
              <textarea id="expert-message" rows="3" placeholder="Notes particulières sur l'exercice..." class="w-full text-xs border border-slate-300 rounded-lg p-2 bg-slate-50"></textarea>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              <button onclick="envoyerEmailExpert()" class="bg-slate-800 hover:bg-slate-900 text-white font-semibold text-xs py-2.5 px-3 rounded-lg transition-colors flex items-center justify-center gap-2 shadow-sm">
                📧 Ouvrir dans la Messagerie
              </button>
              <button onclick="copierSynthese()" class="bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 font-semibold text-xs py-2.5 px-3 rounded-lg transition-colors flex items-center justify-center gap-2 shadow-sm">
                📋 Copier le texte
              </button>
            </div>
          </div>
        </div>

      </div>

    </div>
  `;
}

window.initExportModule = function() {
  renderExportUI();
};

document.addEventListener('DOMContentLoaded', window.initExportModule);
