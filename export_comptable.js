/**
 * export_comptable.js - Module d'exportation, impression, sauvegarde, pièces justificatives et clôture
 */

// Récupération de l'ensemble des écritures (Banque + Contreparties)
async function obtenirEcritures() {
  if (window.supabaseClient) {
    try {
      const { data, error } = await window.supabaseClient
        .from('ecritures_comptables')
        .select('*')
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

// Génération du CSV avec Partie Double (Compte + Contrepartie + Débit / Crédit)
async function genererCSVJournal() {
  const ecritures = await obtenirEcritures();
  if (!ecritures || ecritures.length === 0) {
    alert("Aucune écriture comptable à exporter.");
    return;
  }

  const headers = ["ID", "Date", "Compte", "Compte Contrepartie", "Categorie", "Description", "Debit (€)", "Credit (€)", "Lien Justificatif"];
  
  const rows = ecritures.map(row => {
    let debit = parseFloat(row.debit || 0);
    let credit = parseFloat(row.credit || 0);
    
    // Déduction Débit/Crédit si seule la valeur 'amount' est stockée
    if (debit === 0 && credit === 0 && row.amount) {
      const val = parseFloat(row.amount);
      const isRecette = (row.type || '').toLowerCase().includes('recette');
      if (isRecette) {
        debit = val;
      } else {
        credit = val;
      }
    }

    const categorie = row.category || row.categorie || "Général";
    const description = (row.description || '').replace(/"/g, '""');
    const compteContrepartie = row.compte_contrepartie || row.contrepartie_code || (debit > 0 ? "706000" : "600000");
    const justificatifUrl = row.justificatif_url || row.receipt_url || row.document_url || '';

    return [
      `"${row.id || ''}"`,
      `"${row.date || ''}"`,
      `"${row.compte_code || '512000'}"`,
      `"${compteContrepartie}"`,
      `"${categorie}"`,
      `"${description}"`,
      debit > 0 ? debit.toFixed(2).replace('.', ',') : "0,00",
      credit > 0 ? credit.toFixed(2).replace('.', ',') : "0,00",
      `"${justificatifUrl}"`
    ].join(';');
  });

  // \ufeff pour forcer l'encodage UTF-8 sous Excel
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

// Exporter l'index HTML de tous les justificatifs scannés
async function exporterIndexJustificatifs() {
  const ecritures = await obtenirEcritures();
  const pieces = ecritures.filter(e => e.justificatif_url || e.receipt_url || e.document_url);

  if (pieces.length === 0) {
    alert("Aucun justificatif scanné n'a été trouvé.");
    return;
  }

  let htmlContent = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Justificatifs Comptables</title><style>body{font-family:sans-serif;padding:20px;color:#333;} table{width:100%;border-collapse:collapse;margin-top:15px;} th,td{border:1px solid #ddd;padding:10px;text-align:left;} th{background:#f4f4f4;} a{color:#2563eb;text-decoration:none;font-weight:bold;} a:hover{text-decoration:underline;}</style></head><body>`;
  htmlContent += `<h2>📁 Relevé des Pièces Justificatives Scannées</h2><p>Généré le : ${new Date().toLocaleDateString('fr-FR')}</p><table><tr><th>Date</th><th>Description</th><th>Montant</th><th>Lien de la Pièce Jointe</th></tr>`;

  pieces.forEach(p => {
    const url = p.justificatif_url || p.receipt_url || p.document_url;
    const montant = parseFloat(p.amount || p.montant || p.debit || p.credit || 0).toFixed(2);
    htmlContent += `<tr><td>${p.date || ''}</td><td>${p.description || 'Saisie sans libellé'}</td><td>${montant} €</td><td><a href="${url}" target="_blank">Consulter la pièce</a></td></tr>`;
  });

  htmlContent += `</table></body></html>`;

  const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute("href", url);
  link.setAttribute("download", `dossier_pieces_justificatives_${new Date().toISOString().slice(0,10)}.html`);
  document.body.appendChild(link);
  link.click();
  link.remove();
}

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
  let totalPieces = 0;

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

    if (row.justificatif_url || row.receipt_url || row.document_url) {
      totalPieces++;
    }
  });

  const benefice = totalRecettes - totalDepenses;

  const corpsBrut = `Bonjour ${nomComptable},\n\nVeuillez trouver la synthèse comptable de l'exercice ci-dessous :\n\n--- RÉSUMÉ DES OPÉRATIONS ---\n• Nombre d'opérations : ${ecritures.length}\n• Pièces justificatives scannées : ${totalPieces}\n• Recettes Totales : ${totalRecettes.toFixed(2)} €\n• Dépenses Totales : ${totalDepenses.toFixed(2)} €\n• Résultat Net (BNC) : ${benefice.toFixed(2)} €\n\n${messagePerso ? `Note du praticien : ${messagePerso}\n\n` : ''}📌 N.B. N'oubliez pas d'attacher à ce mail le fichier CSV du journal, le fichier HTML des pièces justificatives et le fichier JSON de sauvegarde téléchargés depuis l'application.\n\nCordialement,`;

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

      <!-- Bloc Clôture d'exercice -->
      <div class="bg-white p-5 rounded-xl shadow-sm border border-slate-200 space-y-3">
        <h3 class="text-sm font-bold uppercase tracking-wider text-red-700 flex items-center gap-2">
          🔒 Clôture d'Exercice & Reports à Nouveau
        </h3>
        <p class="text-xs text-slate-600">
          Cette action solde les comptes de charges/produits (classes 6 à 9) et calcule le solde reporté des comptes de bilan (classes 1 à 5) au 1er janvier de l'exercice suivant dans le Journal OD.
        </p>
        
        <div class="flex flex-wrap items-center gap-4 pt-2">
          <div class="flex items-center gap-2">
            <label for="cloture-annee" class="text-xs font-semibold text-slate-700">Exercice à clôturer :</label>
            <select id="cloture-annee" class="form-control text-xs w-28 h-9 border border-slate-300 rounded-lg px-2">
              <option value="2025">2025</option>
              <option value="2026" selected>2026</option>
            </select>
          </div>

          <button type="button" 
                  onclick="if(typeof window.cloturerEtGenererRAN === 'function'){ window.cloturerEtGenererRAN(document.getElementById('cloture-annee').value); } else { alert('Module exercice.js non chargé.'); }" 
                  class="bg-red-600 hover:bg-red-700 text-white font-semibold text-xs py-2 px-4 rounded-lg transition-colors flex items-center gap-2 shadow-sm">
            🔒 Clôturer et générer les A-Nouveaux
          </button>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">

        <div class="bg-white p-5 rounded-xl shadow-sm border border-slate-200 space-y-4">
          <h3 class="text-sm font-bold uppercase tracking-wider text-blue-700 flex items-center gap-2">
            📂 Sauvegarde et Exports Fichiers
          </h3>
          <p class="text-xs text-slate-600">
            Téléchargez une sauvegarde globale, le journal complet ou l'index des pièces justificatives.
          </p>

          <div class="flex flex-col gap-3 pt-2">
            <button type="button" onclick="genererFichierJSON()" class="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs py-2.5 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 shadow-sm">
              ⬇️ Exporter la Sauvegarde Globale (.JSON)
            </button>

            <button type="button" onclick="genererCSVJournal()" class="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs py-2.5 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 shadow-sm">
              📊 Télécharger le Journal des Écritures (.CSV)
            </button>

            <button type="button" onclick="exporterIndexJustificatifs()" class="bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs py-2.5 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 shadow-sm">
              📁 Exporter le Dossier des Pièces Scannées (.HTML)
            </button>

            <div class="border-t border-slate-200 pt-3 mt-2">
              <label class="block text-xs font-semibold text-slate-700 mb-1">Restaurer depuis un fichier JSON :</label>
              <input type="file" accept=".json" onchange="importerFichierJSON(event)" class="text-xs w-full text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer">
            </div>
          </div>
        </div>

        <div class="bg-white p-5 rounded-xl shadow-sm border border-slate-200 space-y-4">
          <h3 class="text-sm font-bold uppercase tracking-wider text-blue-700 flex items-center gap-2">
            ✉️ Transmission Cabinet Comptable
          </h3>
          <p class="text-xs text-slate-600">
            Préparez l'e-mail de transmission incluant les totaux d'exercice et le récapitulatif des justificatifs.
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
