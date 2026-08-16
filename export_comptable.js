/**
 * export_comptable.js - Module d'exportation, impression et sauvegarde
 */

// Récupération asynchrone des écritures réelles
async function obtenirEcritures() {
  if (window.supabaseClient) {
    try {
      const { data, error } = await window.supabaseClient
        .from('ecritures_comptables')
        .select('*')
        .or('compte_code.eq.512000,compte_code.like.512%')
        .order('date', { ascending: true });
      if (!error && data && data.length > 0) return data;
    } catch (e) {
      console.warn("Supabase indisponible, bascule sur LocalStorage", e);
    }
  }
  return JSON.parse(localStorage.getItem('ecritures_comptables') || '[]');
}

async function genererFichierJSON() {
  const ecritures = await obtenirEcritures();
  const donnees = {
    ecritures: ecritures,
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
      if (donnees.ecritures) {
        localStorage.setItem('ecritures_comptables', JSON.stringify(donnees.ecritures));
        if (window.supabaseClient) {
          await window.supabaseClient.from('ecritures_comptables').upsert(donnees.ecritures);
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

// Génération du CSV compatible Excel FR avec support de la propriété 'amount'
async function genererCSVJournal() {
  const ecritures = await obtenirEcritures();
  if (!ecritures || ecritures.length === 0) {
    alert("Aucune écriture comptable à exporter.");
    return;
  }

  const headers = ["ID", "Date", "Type", "Categorie", "Description", "Montant (€)", "Compte"];
  const rows = ecritures.map(row => {
    const debit = parseFloat(row.debit || 0);
    const credit = parseFloat(row.credit || 0);

    // Extraction prioritaire de 'amount', fallback sur 'montant' ou debit/credit
    let valMontant = parseFloat(row.amount !== undefined ? row.amount : (row.montant || 0));
    if (isNaN(valMontant) || valMontant === 0) {
      valMontant = debit > 0 ? debit : credit;
    }

    const type = (row.type || (debit > 0 ? "Recette" : "Dépense")).toLowerCase().includes('recette') ? "Recette" : "Dépense";
    const categorie = row.category || row.categorie || (type === "Recette" ? "Soins infirmiers" : "Autre dépense");
    const description = (row.description || '').replace(/"/g, '""');

    return [
      `"${row.id || ''}"`,
      `"${row.date || ''}"`,
      `"${type}"`,
      `"${categorie}"`,
      `"${description}"`,
      valMontant.toFixed(2).replace('.', ','),
      `"${row.compte_code || ''}"`
    ].join(';');
  });

  // \ufeff active le codage UTF-8 sous Excel pour éliminer les bugs d'accents
  const csvContent = "\ufeff" + [headers.join(';'), ...rows].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute("href", url);
  link.setAttribute("download", `journal_comptable_${new Date().toISOString().slice(0,10)}.csv`);
  document.body.appendChild(link);
  link.click();
  link.remove();
}

// Fonction globale d'impression directe de la vue courante
function imprimerPageCourante() {
  window.print();
}

async function genererDonneesMail() {
  const email = document.getElementById('expert-email')?.value || '';
  const nomComptable = document.getElementById('expert-nom')?.value || 'Cabinet Comptable';
  const messagePerso = document.getElementById('expert-message')?.value || '';
  const ecritures = await obtenirEcritures();

  let totalRecettes = 0;
  let totalDepenses = 0;

  ecritures.forEach(row => {
    const debit = parseFloat(row.debit || 0);
    const credit = parseFloat(row.credit || 0);
    let valMontant = parseFloat(row.amount !== undefined ? row.amount : (row.montant || 0));
    
    if (isNaN(valMontant) || valMontant === 0) {
      valMontant = debit > 0 ? debit : credit;
    }

    const isRecette = (row.type || (debit > 0 ? "Recette" : "Dépense")).toLowerCase().includes('recette');
    if (isRecette) {
      totalRecettes += valMontant;
    } else {
      totalDepenses += valMontant;
    }
  });

  const benefice = totalRecettes - totalDepenses;

  const corpsBrut = `Bonjour ${nomComptable},\n\nVeuillez trouver la synthèse comptable de l'exercice ci-dessous :\n\n--- RÉSUMÉ DES OPÉRATIONS ---\n• Nombre d'opérations : ${ecritures.length}\n• Recettes Totales : ${totalRecettes.toFixed(2)} €\n• Dépenses Totales : ${totalDepenses.toFixed(2)} €\n• Résultat Net (BNC) : ${benefice.toFixed(2)} €\n\n${messagePerso ? `Note du praticien : ${messagePerso}\n\n` : ''}📌 N.B. N'oubliez pas d'attacher à ce mail le fichier CSV du journal et le fichier JSON de sauvegarde téléchargés depuis l'application.\n\nCordialement,`;

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

// Injection des styles d'impression dans la page globale
function injecterStylesImpression() {
  if (document.getElementById('style-impression-global')) return;
  const style = document.createElement('style');
  style.id = 'style-impression-global';
  style.innerHTML = `
    @media print {
      nav, header, button, input[type="file"], .no-print, #export-container > div > div:first-child button {
        display: none !important;
      }
      body {
        background: white !important;
        color: black !important;
        font-size: 10pt;
      }
      .bg-white, .shadow-sm, .border {
        box-shadow: none !important;
        border: none !important;
      }
      table {
        width: 100% !important;
        border-collapse: collapse !important;
      }
      th, td {
        border: 1px solid #ddd !important;
        padding: 6px !important;
      }
    }
  `;
  document.head.appendChild(style);
}

function renderExportUI() {
  injecterStylesImpression();
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
        <button type="button" onclick="imprimerPageCourante()" class="bg-slate-800 hover:bg-slate-900 text-white font-semibold text-xs py-2.5 px-4 rounded-lg transition-colors flex items-center gap-2 shadow-sm">
          🖨️ Imprimer la Vue Active
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

if (document.readyState === 'complete' || document.readyState === 'interactive') {
  renderExportUI();
} else {
  document.addEventListener('DOMContentLoaded', renderExportUI);
}
