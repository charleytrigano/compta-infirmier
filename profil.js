/**
 * profil.js - Module Profil sans import ES6 (compatible script classique)
 */

let profileRecordId = null;

async function chargerProfilSupabase() {
  if (!window.supabaseClient) return null;
  try {
    let { data, error } = await window.supabaseClient.from('profile').select('*').limit(1);
    if (error || !data || data.length === 0) {
      const res = await window.supabaseClient.from('profiles').select('*').limit(1);
      data = res.data;
    }
    if (data && data.length > 0) {
      profileRecordId = data[0].id;
      return data[0];
    }
  } catch (e) {
    console.warn("Erreur chargement Supabase profil:", e);
  }
  return null;
}

async function exporterSauvegardeGlobale() {
  const btn = document.getElementById('btn-export-global');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '⏳ Exportation en cours...';
  }

  try {
    const backupData = {
      date_export: new Date().toISOString(),
      tables: {}
    };

    if (window.supabaseClient) {
      const tables = ['profile', 'transactions'];
      for (const table of tables) {
        const { data, error } = await window.supabaseClient.from(table).select('*');
        if (!error && data) {
          backupData.tables[table] = data;
        }
      }
    } else {
      backupData.tables['profile'] = [JSON.parse(localStorage.getItem('profil_praticien') || '{}')];
    }

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupData, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `Sauvegarde_Compta_Supabase_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();

    alert("✅ Sauvegarde globale exportée avec succès !");
  } catch (err) {
    console.error("Erreur lors de la sauvegarde :", err);
    alert("⚠️ Erreur lors de la génération de la sauvegarde.");
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '📦 Télécharger la Sauvegarde Globale (Supabase)';
    }
  }
}

async function renderProfilUI() {
  const container = document.getElementById('profil-container');
  if (!container) return;

  const profileData = await chargerProfilSupabase() || JSON.parse(localStorage.getItem('profil_praticien') || '{}');

  if (profileData.id) {
    profileRecordId = profileData.id;
  }

  container.innerHTML = `
    <div class="space-y-6 max-w-5xl mx-auto p-4 font-sans text-slate-800">
      
      <!-- ENTÊTE -->
      <div class="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-wrap justify-between items-center gap-4">
        <div class="flex items-center gap-4">
          <div class="w-12 h-12 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center font-bold text-xl shadow-inner">
            👤
          </div>
          <div>
            <h2 class="text-lg font-bold text-slate-800">
              ${profileData.prenom || profileData.nom ? `${profileData.prenom || ''} ${profileData.nom || ''}` : 'Profil Praticien'}
            </h2>
            <p class="text-xs text-slate-500">
              ${profileData.email || 'Email non renseigné'}
            </p>
          </div>
        </div>
        <div>
          <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${window.supabaseClient ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}">
            <span class="w-2 h-2 rounded-full ${window.supabaseClient ? 'bg-emerald-500' : 'bg-amber-500'}"></span>
            ${window.supabaseClient ? 'Connecté à Supabase' : 'Mode Hors-Ligne'}
          </span>
        </div>
      </div>

      <!-- FORMULAIRE COMPLET -->
      <form id="form-profil-supabase" onsubmit="sauvegarderProfilSupabase(event)" class="space-y-6">
        
        <!-- SECTION 1 : IDENTITÉ & CONTACT -->
        <div class="bg-white p-5 rounded-xl shadow-sm border border-slate-200 space-y-4">
          <h3 class="text-sm font-bold uppercase tracking-wider text-blue-700 border-b pb-2">
            👤 Identité & Contact
          </h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-semibold text-slate-700 mb-1">Nom :</label>
              <input type="text" id="prof-nom" value="${profileData.nom || ''}" placeholder="Ex: DAMIANO" class="w-full text-xs border border-slate-300 rounded-lg p-2.5 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500">
            </div>
            <div>
              <label class="block text-xs font-semibold text-slate-700 mb-1">Prénom :</label>
              <input type="text" id="prof-prenom" value="${profileData.prenom || ''}" placeholder="Ex: Nolwenn" class="w-full text-xs border border-slate-300 rounded-lg p-2.5 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500">
            </div>
            <div>
              <label class="block text-xs font-semibold text-slate-700 mb-1">Email :</label>
              <input type="email" id="prof-email" value="${profileData.email || ''}" placeholder="ex: exemple@gmail.com" class="w-full text-xs border border-slate-300 rounded-lg p-2.5 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500">
            </div>
            <div>
              <label class="block text-xs font-semibold text-slate-700 mb-1">Téléphone :</label>
              <input type="text" id="prof-telephone" value="${profileData.telephone || ''}" placeholder="Ex: 06 10 09 92 07" class="w-full text-xs border border-slate-300 rounded-lg p-2.5 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500">
            </div>
          </div>
        </div>

        <!-- SECTION 2 : ADRESSE PROFESSIONNELLE -->
        <div class="bg-white p-5 rounded-xl shadow-sm border border-slate-200 space-y-4">
          <h3 class="text-sm font-bold uppercase tracking-wider text-blue-700 border-b pb-2">
            📍 Adresse Professionnelle
          </h3>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div class="md:col-span-3">
              <label class="block text-xs font-semibold text-slate-700 mb-1">Adresse :</label>
              <input type="text" id="prof-adresse" value="${profileData.adresse || ''}" placeholder="Ex: 12 Rue des Infirmiers" class="w-full text-xs border border-slate-300 rounded-lg p-2.5 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500">
            </div>
            <div>
              <label class="block text-xs font-semibold text-slate-700 mb-1">Code Postal :</label>
              <input type="text" id="prof-code-postal" value="${profileData.code_postal || ''}" placeholder="Ex: 06000" class="w-full text-xs border border-slate-300 rounded-lg p-2.5 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500">
            </div>
            <div class="md:col-span-2">
              <label class="block text-xs font-semibold text-slate-700 mb-1">Ville :</label>
              <input type="text" id="prof-ville" value="${profileData.ville || ''}" placeholder="Ex: Nice" class="w-full text-xs border border-slate-300 rounded-lg p-2.5 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500">
            </div>
          </div>
        </div>

        <!-- SECTION 3 : IDENTIFIANTS PROFESSIONNELS -->
        <div class="bg-white p-5 rounded-xl shadow-sm border border-slate-200 space-y-4">
          <h3 class="text-sm font-bold uppercase tracking-wider text-blue-700 border-b pb-2">
            🆔 Identifiants Professionnels & Fiscaux
          </h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-semibold text-slate-700 mb-1">SIRET :</label>
              <input type="text" id="prof-siret" value="${profileData.siret || ''}" placeholder="Ex: 123 456 789 00012" class="w-full text-xs border border-slate-300 rounded-lg p-2.5 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500">
            </div>
            <div>
              <label class="block text-xs font-semibold text-slate-700 mb-1">N° RPPS :</label>
              <input type="text" id="prof-rpps" value="${profileData.rpps || ''}" placeholder="Ex: 10101234567" class="w-full text-xs border border-slate-300 rounded-lg p-2.5 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500">
            </div>
            <div>
              <label class="block text-xs font-semibold text-slate-700 mb-1">N° ADELI :</label>
              <input type="text" id="prof-adeli" value="${profileData.adeli || ''}" placeholder="Ex: 066900000" class="w-full text-xs border border-slate-300 rounded-lg p-2.5 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500">
            </div>
            <div>
              <label class="block text-xs font-semibold text-slate-700 mb-1">N° URSSAF :</label>
              <input type="text" id="prof-num-urssaf" value="${profileData.num_urssaf || ''}" placeholder="Ex: 060123456789" class="w-full text-xs border border-slate-300 rounded-lg p-2.5 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500">
            </div>
          </div>
        </div>

        <!-- SECTION 4 : CABINET COMPTABLE & EXERCICE -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div class="bg-white p-5 rounded-xl shadow-sm border border-slate-200 space-y-4">
            <h3 class="text-sm font-bold uppercase tracking-wider text-blue-700 border-b pb-2">
              💼 Cabinet Comptable
            </h3>
            <div class="space-y-3">
              <div>
                <label class="block text-xs font-semibold text-slate-700 mb-1">Cabinet :</label>
                <input type="text" id="prof-comptable-cabinet" value="${profileData.comptable_cabinet || ''}" placeholder="Ex: Cabinet ABC" class="w-full text-xs border border-slate-300 rounded-lg p-2.5 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500">
              </div>
              <div>
                <label class="block text-xs font-semibold text-slate-700 mb-1">Adresse :</label>
                <input type="text" id="prof-comptable-adresse" value="${profileData.comptable_adresse || ''}" placeholder="Ex: 5 Av. des Comptes" class="w-full text-xs border border-slate-300 rounded-lg p-2.5 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500">
              </div>
              <div>
                <label class="block text-xs font-semibold text-slate-700 mb-1">Téléphone :</label>
                <input type="text" id="prof-comptable-tel" value="${profileData.comptable_tel || ''}" placeholder="Ex: 04 93 00 00 00" class="w-full text-xs border border-slate-300 rounded-lg p-2.5 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500">
              </div>
              <div>
                <label class="block text-xs font-semibold text-slate-700 mb-1">Email :</label>
                <input type="email" id="prof-comptable-email" value="${profileData.comptable_email || ''}" placeholder="Ex: contact@comptable.fr" class="w-full text-xs border border-slate-300 rounded-lg p-2.5 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500">
              </div>
            </div>
          </div>

          <div class="bg-white p-5 rounded-xl shadow-sm border border-slate-200 space-y-4 flex flex-col justify-between">
            <div>
              <h3 class="text-sm font-bold uppercase tracking-wider text-blue-700 border-b pb-2 mb-4">
                📅 Exercice Comptable
              </h3>
              <div class="space-y-3">
                <div>
                  <label class="block text-xs font-semibold text-slate-700 mb-1">Début d'exercice :</label>
                  <input type="date" id="prof-exercice-debut" value="${profileData.exercice_debut || '2026-01-01'}" class="w-full text-xs border border-slate-300 rounded-lg p-2.5 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500">
                </div>
                <div>
                  <label class="block text-xs font-semibold text-slate-700 mb-1">Fin d'exercice :</label>
                  <input type="date" id="prof-exercice-fin" value="${profileData.exercice_fin || '2026-12-31'}" class="w-full text-xs border border-slate-300 rounded-lg p-2.5 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500">
                </div>
              </div>
            </div>

            <div class="pt-4 border-t border-slate-200">
              <button type="submit" class="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm py-3 rounded-lg transition-colors shadow-sm flex items-center justify-center gap-2">
                💾 Enregistrer dans Supabase
              </button>
            </div>
          </div>
        </div>

        <!-- SECTION 5 : SAUVEGARDE & SÉCURITÉ -->
        <div class="bg-white p-5 rounded-xl shadow-sm border border-slate-200 space-y-3">
          <h3 class="text-sm font-bold uppercase tracking-wider text-blue-700 border-b pb-2">
            🔒 Sécurité & Exportation des Données
          </h3>
          <p class="text-xs text-slate-600">
            Téléchargez une sauvegarde instantanée de l'ensemble de vos données Supabase ('profile' et 'transactions') sur votre appareil.
          </p>
          <div>
            <button type="button" id="btn-export-global" onclick="exporterSauvegardeGlobale()" class="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs py-3 rounded-lg transition-colors flex items-center justify-center gap-2 shadow-sm">
              📦 Télécharger la Sauvegarde Globale (Supabase)
            </button>
          </div>
        </div>

      </form>
    </div>
  `;
}

async function sauvegarderProfilSupabase(e) {
  e.preventDefault();

  const payload = {
    nom: document.getElementById('prof-nom')?.value || null,
    prenom: document.getElementById('prof-prenom')?.value || null,
    email: document.getElementById('prof-email')?.value || null,
    telephone: document.getElementById('prof-telephone')?.value || null,
    adresse: document.getElementById('prof-adresse')?.value || null,
    code_postal: document.getElementById('prof-code-postal')?.value || null,
    ville: document.getElementById('prof-ville')?.value || null,
    siret: document.getElementById('prof-siret')?.value || null,
    rpps: document.getElementById('prof-rpps')?.value || null,
    adeli: document.getElementById('prof-adeli')?.value || null,
    num_urssaf: document.getElementById('prof-num-urssaf')?.value || null,
    comptable_cabinet: document.getElementById('prof-comptable-cabinet')?.value || null,
    comptable_adresse: document.getElementById('prof-comptable-adresse')?.value || null,
    comptable_tel: document.getElementById('prof-comptable-tel')?.value || null,
    comptable_email: document.getElementById('prof-comptable-email')?.value || null,
    exercice_debut: document.getElementById('prof-exercice-debut')?.value || null,
    exercice_fin: document.getElementById('prof-exercice-fin')?.value || null
  };

  localStorage.setItem('profil_praticien', JSON.stringify(payload));

  if (window.supabaseClient) {
    try {
      let res;
      if (profileRecordId) {
        res = await window.supabaseClient.from('profile').update(payload).eq('id', profileRecordId);
      } else {
        res = await window.supabaseClient.from('profile').insert([payload]).select();
        if (res.data && res.data.length > 0) {
          profileRecordId = res.data[0].id;
        }
      }

      if (res.error) {
        if (profileRecordId) {
          await window.supabaseClient.from('profiles').update(payload).eq('id', profileRecordId);
        } else {
          await window.supabaseClient.from('profiles').insert([payload]);
        }
      }
      alert("✅ Profil enregistré avec succès dans Supabase !");
    } catch (err) {
      console.error("Erreur sauvegarde Supabase:", err);
      alert("⚠️ Enregistré en local (erreur Supabase).");
    }
  } else {
    alert("✅ Profil enregistré localement.");
  }

  renderProfilUI();
}

window.initProfil = function() {
  renderProfilUI();
};

document.addEventListener('DOMContentLoaded', window.initProfil);
