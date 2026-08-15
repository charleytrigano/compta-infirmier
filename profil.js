/**
 * profil.js - Remplacement forcé et dynamique du bloc Profil
 */

async function obtenirInfosProfil() {
  let user = null;
  if (window.supabaseClient) {
    try {
      const { data } = await window.supabaseClient.auth.getUser();
      user = data?.user;
    } catch (e) {
      console.warn("Supabase auth check:", e);
    }
  }
  return user;
}

async function injecterProfil() {
  // Ciblage prioritaire du bloc #profil de index.html
  let target = document.getElementById('profil') || document.getElementById('profil-container');

  if (!target) {
    const divs = Array.from(document.querySelectorAll('div'));
    target = divs.find(d => d.textContent.includes('Paramètres du compte...') && d.children.length < 5);
  }

  if (!target) return;

  const user = await obtenirInfosProfil();

  target.innerHTML = `
    <div class="space-y-6 max-w-4xl mx-auto p-4 font-sans text-slate-800">
      
      <!-- ENTÊTE PROFIL -->
      <div class="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-wrap justify-between items-center gap-4">
        <div class="flex items-center gap-4">
          <div class="w-12 h-12 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center font-bold text-xl shadow-inner">
            ${user?.email ? user.email.charAt(0).toUpperCase() : '👤'}
          </div>
          <div>
            <h2 class="text-lg font-bold text-slate-800">
              ${user?.email || 'Utilisateur Non Connecté'}
            </h2>
            <p class="text-xs text-slate-500">
              ${user ? `ID Supabase : ${user.id}` : 'Mode Local / Hors-ligne actif'}
            </p>
          </div>
        </div>
        
        <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${user ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}">
          <span class="w-2 h-2 rounded-full ${user ? 'bg-emerald-500' : 'bg-amber-500'}"></span>
          ${user ? 'Session Active' : 'Mode Local'}
        </span>
      </div>

      <!-- FORMULAIRE PRATICIEN & SÉCURITÉ -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">

        <div class="bg-white p-5 rounded-xl shadow-sm border border-slate-200 space-y-4">
          <h3 class="text-sm font-bold uppercase tracking-wider text-blue-700 flex items-center gap-2">
            🩺 Informations du Praticien
          </h3>
          <form id="form-profil-praticien" onsubmit="sauvegarderProfilLocal(event)" class="space-y-3">
            <div>
              <label class="block text-xs font-semibold text-slate-700 mb-1">Nom & Prénom :</label>
              <input type="text" id="prof-nom" placeholder="Ex: Charley Trigano" class="w-full text-xs border border-slate-300 rounded-lg p-2.5 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 transition-all">
            </div>

            <div>
              <label class="block text-xs font-semibold text-slate-700 mb-1">Spécialité / Profession :</label>
              <input type="text" id="prof-metier" placeholder="Ex: Infirmier Libéral (BNC)" class="w-full text-xs border border-slate-300 rounded-lg p-2.5 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 transition-all">
            </div>

            <div>
              <label class="block text-xs font-semibold text-slate-700 mb-1">Numéro ADELI / RPPS :</label>
              <input type="text" id="prof-rpps" placeholder="Ex: 10001234567" class="w-full text-xs border border-slate-300 rounded-lg p-2.5 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 transition-all">
            </div>

            <button type="submit" class="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs py-2.5 rounded-lg transition-colors shadow-sm">
              💾 Enregistrer les modifications
            </button>
          </form>
        </div>

        <div class="bg-white p-5 rounded-xl shadow-sm border border-slate-200 space-y-4 flex flex-col justify-between">
          <div>
            <h3 class="text-sm font-bold uppercase tracking-wider text-blue-700 flex items-center gap-2 mb-2">
              🔒 Sécurité & Base de Données
            </h3>
            <p class="text-xs text-slate-600 mb-4">
              Vos transactions sont sauvegardées en temps réel sur Supabase.
            </p>
            <div class="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-2 text-xs">
              <div class="flex justify-between text-slate-600">
                <span>Statut Supabase :</span>
                <span class="font-bold text-emerald-600">Connecté</span>
              </div>
              <div class="flex justify-between text-slate-600">
                <span>Dernière synchro :</span>
                <span class="font-semibold">${new Date().toLocaleTimeString('fr-FR')}</span>
              </div>
            </div>
          </div>

          <div class="pt-4 border-t border-slate-200">
            <button type="button" onclick="deconnecterSession()" class="w-full bg-slate-100 hover:bg-red-50 text-red-600 border border-slate-300 hover:border-red-200 font-semibold text-xs py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2">
              🚪 Se Déconnecter
            </button>
          </div>
        </div>

      </div>

    </div>
  `;

  chargerProfilLocal();
}

function sauvegarderProfilLocal(e) {
  e.preventDefault();
  const nom = document.getElementById('prof-nom')?.value || '';
  const metier = document.getElementById('prof-metier')?.value || '';
  const rpps = document.getElementById('prof-rpps')?.value || '';
  localStorage.setItem('profil_praticien', JSON.stringify({ nom, metier, rpps }));
  alert("✅ Informations du praticien enregistrées !");
}

function chargerProfilLocal() {
  const profilData = localStorage.getItem('profil_praticien');
  if (!profilData) return;
  try {
    const profil = JSON.parse(profilData);
    if (document.getElementById('prof-nom')) document.getElementById('prof-nom').value = profil.nom || '';
    if (document.getElementById('prof-metier')) document.getElementById('prof-metier').value = profil.metier || '';
    if (document.getElementById('prof-rpps')) document.getElementById('prof-rpps').value = profil.rpps || '';
  } catch (e) {}
}

async function deconnecterSession() {
  if (window.supabaseClient) await window.supabaseClient.auth.signOut();
  localStorage.clear();
  location.reload();
}

window.initProfil = function() {
  injecterProfil();
};

document.addEventListener('click', (e) => {
  if (e.target && e.target.textContent.includes('Profil')) {
    setTimeout(injecterProfil, 20);
  }
});

setInterval(() => {
  if (document.body.textContent.includes('Paramètres du compte...')) {
    injecterProfil();
  }
}, 250);

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', injecterProfil);
} else {
  injecterProfil();
}
