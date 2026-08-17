/**
 * scanner_justificatif.js - Upload direct vers Supabase Storage 'justificatifs'
 */

// Téléverse un fichier (scan/photo/PDF) vers Supabase Storage et retourne son URL publique
async function uploaderJustificatif(fileObject) {
  const supabase = window.supabaseClient || window.supabase;
  if (!supabase) {
    alert("Supabase non connecté.");
    return null;
  }

  try {
    // Génération d'un nom de fichier unique
    const fileExt = fileObject.name.split('.').pop();
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${fileExt}`;
    const filePath = `${fileName}`;

    // Upload dans le bucket 'justificatifs'
    const { data, error } = await supabase.storage
      .from('justificatifs')
      .upload(filePath, fileObject, {
        cacheControl: '3600',
        upsert: false
      });

    if (error) throw error;

    // Récupération de l'URL publique
    const { data: publicUrlData } = supabase.storage
      .from('justificatifs')
      .getPublicUrl(filePath);

    return publicUrlData.publicUrl;

  } catch (err) {
    console.error("Erreur d'upload du justificatif :", err);
    alert("Impossible d'envoyer le justificatif.");
    return null;
  }
}

// Composant HTML à intégrer dans le formulaire d'ajout/édition de transaction
function genererChampScanHTML(transactionId = '') {
  return `
    <div class="space-y-2 border border-dashed border-slate-300 p-3 rounded-lg bg-slate-50">
      <label class="block text-xs font-bold text-slate-700">📸 Justificatif / Scan de pièce</label>
      <input type="file" id="input-scan-doc" accept="image/*,application/pdf" capture="environment" 
             class="text-xs w-full text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700 cursor-pointer">
      <input type="hidden" id="url-justificatif-hdn" value="">
      <div id="preview-scan" class="text-xs text-slate-500 italic mt-1"></div>
    </div>
  `;
}

// Écouteur pour effectuer l'upload dès la sélection du fichier/photo
document.addEventListener('change', async (e) => {
  if (e.target && e.target.id === 'input-scan-doc') {
    const file = e.target.files[0];
    if (!file) return;

    const previewDiv = document.getElementById('preview-scan');
    if (previewDiv) previewDiv.innerHTML = "⏳ Envoi du document en cours...";

    const publicUrl = await uploaderJustificatif(file);

    if (publicUrl) {
      document.getElementById('url-justificatif-hdn').value = publicUrl;
      if (previewDiv) {
        previewDiv.innerHTML = `✅ Document rattaché : <a href="${publicUrl}" target="_blank" class="text-blue-600 underline font-semibold">Voir la pièce</a>`;
      }
    } else {
      if (previewDiv) previewDiv.innerHTML = "❌ Échec du transfert.";
    }
  }
});
