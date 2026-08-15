/**
 * export_comptable.js - Module d'exportation, impression et sauvegarde
 */

// Récupération asynchrone des transactions (Supabase avec fallback LocalStorage)
async function obtenirTransactions() {
  if (window.supabaseClient) {
    try {
      const { data, error } = await window.supabaseClient
        .from('transactions')
        .select('*');
      if (!error && data && data.length > 0) return data;
    } catch (e) {
      console.warn("Supabase indisponible, bascule sur LocalStorage", e);
    }
  }
  return JSON.parse(localStorage.getItem('transactions') || '[]');
}

async function genererFichierJSON() {
  const transactions = await obtenirTransactions();
  const donnees = {
    transactions: transactions,
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

async function importerFichierJSON(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async function(e) {
    try {
      const donnees = JSON.parse(e.target.result);
      if (donnees.transactions) {
        localStorage.setItem('transactions', JSON.stringify(donnees.transactions));
        if (window.supabaseClient) {
          await window.supabaseClient.from('transactions').upsert(donnees.transactions);
        }
      }
      alert("✅ Sauvegarde restaurée avec succès !");
      location.reload();
    } catch (err) {
      alert("❌ Erreur lors de la lecture du fichier de sauvegarde.");
    }
  };
  reader.readAsText(file);
}

async function genererCSVJournal() {
  const transactions = await obtenirTransactions();
  if (!transactions || transactions.length === 0) {
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

// Fonction d'impression optimisée pour les documents comptables
async function imprimerRapportComptable() {
  const transactions = await obtenirTransactions();
  
  let totalRecettes = 0;
  let totalDepenses = 0;
  let lignesTableau = '';

  transactions.forEach(t => {
    const val = parseFloat(t.montant) || 0;
    if (t.type === 'Recette') totalRecettes += val;
    else if (t.type === 'Dépense') totalDepenses += val;

    lignesTableau += `
      <tr style="border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 6px 8px;">${t.date || '-'}</td>
        <td style="padding: 6px 8px;">${t.type || '-'}</td>
        <td style="padding: 6px 8px;">${t.categorie || '-'}</td>
        <td style="padding: 6px 8px;">${t.description || '-'}</td>
        <td style="padding: 6px 8px; text-align: right; font-weight: bold; color: ${t.type === 'Recette' ? '#047857' : '#b91c1c'};">
          ${val.toFixed(2)} €
        </td>
      </tr>
    `;
  });

  const benefice = totalRecettes - totalDepenses;

  const contenuImpression = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Impression Document Comptable BNC</title>
      <style>
        body { font-family: Arial, sans-serif; font-size: 12px; color: #1e293b; padding: 20px; }
        h1 { font-size: 18px; border-bottom: 2px solid #0284c7; padding-bottom: 5px; margin-bottom: 15px; }
        .summary-box { display: flex; gap: 15px; margin-bottom: 20px; background: #f8fafc; padding: 12px; border-radius: 6px; border: 1px solid #e2e8f0; }
        .summary-item { flex: 1; text-align: center; }
        .summary-item div { font-size: 10px; color: #64748b; text-transform: uppercase; font-weight: bold; }
        .summary-item span { font-size: 14px; font-weight: bold; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th { background: #f1f5f9; padding: 8px; text-align: left; font-size: 11px; border-bottom: 2px solid #cbd5e1; }
        @media print {
          body { padding: 0; }
          button { display: none; }
        }
      </style>
    </head>
    <body>
      <h1>JOURNAL COMPTABLE & SYNTHÈSE D'EXERCICE</h1>
      <p style="font-size: 10px; color: #64748b;">Édité le ${new Date().toLocaleDateString('fr-FR')} - Comptabilité Libérale BNC</p>

      <div class="summary-box">
        <div class="summary-item">
          <div>Transactions</div>
          <span>${transactions.length}</span>
        </div>
        <div class="summary-item">
          <div>Total Recettes</div>
          <span style="color: #047857;">${totalRecettes.toFixed(2)} €</span>
        </div>
        <div class="summary-item">
          <div>Total Dépenses</div>
          <span style="color: #b91c1c;">${totalDepenses.toFixed(2)} €</span>
        </div>
        <div class="summary-item">
          <div>Résultat Net (BNC)</div>
          <span style="color: #0284c7;">${benefice.toFixed(2)} €</span>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Type</th>
            <th>Catégorie</th>
            <th>Description</th>
            <th style="text-align: right;">Montant</th>
          </tr>
        </thead>
        <tbody>
          ${lignesTableau || '<tr><td colspan="5" style="text-align:center; padding: 10px;">Aucune donnée enregistrée</td></tr>'}
        </tbody>
      </table>
    </body>
    </html>
  `;

  const fenetre = window.open('', '_blank');
  fenetre.document.write(contenuImpression);
  fenetre.document.close();
  fenetre.focus();

  setTimeout(() => {
    fenetre.print();
  }, 500);
}

async function genererDonneesMail() {
  const email = document.getElementById('expert-email')?.value || '';
  const nomComptable = document.getElementById('expert-nom')?.value || 'Cabinet Comptable';
  const messagePerso = document.getElementById('expert-message')?.value || '';
  const transactions = await obtenirTransactions();

  let totalRecettes = 0;
  let totalDepenses = 0;
  transactions.forEach(t => {
    const val = parseFloat(t.montant) || 0;
    if (t.type === 'Recette') totalRecettes += val;
    else if (t.type === 'Dépense') totalDepenses += val;
  });
  const benefice = totalRecettes - totalDepenses;

  const corpsBrut = `Bonjour ${nomComptable},\n\nVeuillez trouver la synthèse comptable de l'exercice ci-dessous :\n\n--- RÉSUMÉ DES OPÉRATIONS ---\n• Nombre de transactions : ${transactions.length}\n• Recettes Totales : ${totalRecettes.toFixed(2)} €\n• Dépenses Totales : ${totalDepenses.toFixed(2)} €\n• Résultat Net (BNC) : ${benefice.toFixed(2)} €\n\n${messagePerso ? `Note du praticien : ${messagePerso}\n\n` : ''}📌 N.B. N'oubliez pas d'attacher à ce mail le fichier CSV du journal et le fichier JSON de sauvegarde téléchargés depuis l'application.\n\nCordialement,`;

  return { email, sujet: "Transmission de la comptabilité BNC - Bilan Annuel", corpsBrut };
}

async function ouvrirAppMail() {
  const { email, sujet, corpsBrut } = await genererDonneesMail();
  if (!email) return alert("Veuillez saisir l'adresse e-mail de votre expert-comptable.");
  window.location.href = `mailto:${email}?subject=${encodeURIComponent(sujet)}&body=${encodeURIComponent(corpsBrut)}`;
}

async function ouvrirGmailWeb() {
  const { email, sujet, corpsBrut } = await genererDonneesMail();
  if (!email) return alert("Veuillez saisir l'adresse e-mail de votre expert-comptable.");
  window.open(`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(email)}&su=${encodeURIComponent(sujet)}&body=${encodeURIComponent(corpsBrut)}`, '_blank');
}

async function copierSynthese() {
  const { corpsBrut } = await genererDonneesMail();
  navigator.clipboard.writeText(corpsBrut).then(() => {
    alert("📋 Synthèse copiée dans le presse-papier !");
  });
}

function renderExportUI() {
  const container = document.getElementById('export-container');
  if (!container) return;

  container.innerHTML = `
    <div class="space-y-6 max-w-5xl mx-auto p-4 font-sans text-slate-800">

      <!-- ENTÊTE AVEC BOUTON IMPRESSION GLOBALE -->
      <div class="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex flex-wrap justify-between items-center gap-4">
        <div>
          <h2 class="text-xl font-bold text-slate-800 flex items-center gap-2">
            💾 Sauvegarde, Export & Impression
          </h2>
          <p class="text-xs text-slate-500 mt-1">Générez vos fichiers comptables, imprimez vos états ou transmettez-les à votre cabinet</p>
        </div>
        <button type="button" onclick="imprimerRapportComptable()" class="bg-slate-800 hover:bg-slate-900 text-white font-semibold text-xs py-2.5 px-4 rounded-lg transition-colors flex items-center gap-2 shadow-sm">
          🖨️ Imprimer les Documents Comptables
        </button>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">

        <!-- SAUVEGARDE & RESTAURATION LOCALE -->
        <div class="bg-white p-5 rounded-xl shadow-sm border border-slate-200 space-y-4">
          <h3 class="text-sm font-bold uppercase tracking-wider text-blue-700 flex items-center gap-2">
            📂 Sauvegarde et Exports Fichiers
          </h3>
          <p class="text-xs text-slate-600">
            Téléchargez une sauvegarde globale ou le journal complet sous forme de fichier.
          </p>

          <div class="flex flex-col gap-3 pt-2">
            <button type="button" onclick="genererFichierJSON()" class="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs py-2.5 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 shadow-sm">
              ⬇️ Exporter la Sauvegarde Globale (.JSON)
            </button>

            <button type="button" onclick="genererCSVJournal()" class="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs py-2.5 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 shadow-sm">
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
            Préparez l'e-mail de transmission incluant les totaux d'exercice.
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
              <textarea id="expert-message" rows="3" placeholder="Notes particulières..." class="w-full text-xs border border-slate-300 rounded-lg p-2 bg-slate-50"></textarea>
            </div>

            <div class="flex flex-col gap-2 pt-1">
              <div class="grid grid-cols-2 gap-2">
                <button type="button" onclick="ouvrirAppMail()" class="bg-slate-800 hover:bg-slate-900 text-white font-semibold text-xs py-2.5 px-2 rounded-lg transition-colors flex items-center justify-center gap-1 shadow-sm">
                  💻 App Mail
                </button>
                <button type="button" onclick="ouvrirGmailWeb()" class="bg-red-600 hover:bg-red-700 text-white font-semibold text-xs py-2.5 px-2 rounded-lg transition-colors flex items-center justify-center gap-1 shadow-sm">
                  ✉️ Gmail Web
                </button>
              </div>
              <button type="button" onclick="copierSynthese()" class="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 font-semibold text-xs py-2 px-3 rounded-lg transition-colors flex items-center justify-center gap-2 shadow-sm">
                📋 Copier le texte du message
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
