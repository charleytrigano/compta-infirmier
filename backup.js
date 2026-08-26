const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// 1. Définir le dossier de destination
const DOSSIER_DESTINATION = path.join(__dirname, 'Sauvegarde_Comptabilite');

// 2. Liste de tous vos fichiers programme
const FICHIERS_PROGRAMME = [
  'index.html',
  'config.js',
  'transactions.js',
  'bilan.js',
  'declaration2035.js',
  'plan_comptable.js',
  'urssaf.js',
  'carpimko.js',
  'ir.js',
  'export_comptable.js',
  'profil.js'
];

async function executerSauvegarde() {
  console.log('🚀 Démarrage de la sauvegarde complète...');

  // Création du dossier principal
  if (!fs.existsSync(DOSSIER_DESTINATION)) {
    fs.mkdirSync(DOSSIER_DESTINATION, { recursive: true });
  }

  // Création du sous-dossier Supabase
  const dossierSupabase = path.join(DOSSIER_DESTINATION, 'supabase');
  if (!fs.existsSync(dossierSupabase)) {
    fs.mkdirSync(dossierSupabase, { recursive: true });
  }

  // --- A. SAUVEGARDE DES FICHIERS PROGRAMME ---
  console.log('📁 Copie des fichiers du programme...');
  FICHIERS_PROGRAMME.forEach((fichier) => {
    const srcPath = path.join(__dirname, fichier);
    const destPath = path.join(DOSSIER_DESTINATION, fichier);

    if (fs.existsSync(srcPath)) {
      fs.copyFileSync(srcPath, destPath);
      console.log(`  ✅ ${fichier} sauvegardé`);
    } else {
      console.warn(`  ⚠️ Fichier introuvable : ${fichier}`);
    }
  });

  // --- B. SAUVEGARDE DE LA BASE DE DONNÉES SUPABASE ---
  console.log('🗄️ Sauvegarde des données Supabase...');

  // Renseignez vos identifiants Supabase si besoin
  const SUPABASE_URL = process.env.SUPABASE_URL || 'VOTRE_SUPABASE_URL';
  const SUPABASE_KEY = process.env.SUPABASE_KEY || 'VOTRE_SUPABASE_ANON_KEY';

  // Mêmes tables que le bouton "Sauvegarde Globale (Supabase)" du logiciel
  // (onglet Sauvegarde & Exportation, fonction window.exporterSauvegardeGlobale
  // dans index.html) : les deux sauvegardes doivent rester synchronisées, et
  // chaque fichier <table>_backup.json généré ici peut être réimporté tel quel
  // via "Restaurer une sauvegarde" dans ce même onglet.
  const TABLES_SUPABASE = [
    'attachments',
    'declarations',
    'ecritures_comptables',
    'plan_comptable',
    'profile',
    'transactions'
  ];

  if (SUPABASE_URL !== 'VOTRE_SUPABASE_URL') {
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    for (const table of TABLES_SUPABASE) {
      try {
        const { data, error } = await supabase.from(table).select('*');
        if (error) {
          console.error(`  ❌ Erreur sur la table "${table}" :`, error.message);
        } else {
          fs.writeFileSync(
            path.join(dossierSupabase, `${table}_backup.json`),
            JSON.stringify(data || [], null, 2)
          );
          console.log(`  ✅ Table "${table}" exportée en JSON (${(data || []).length} ligne(s))`);
        }
      } catch (err) {
        console.error(`  ❌ Exception sur la table "${table}" :`, err.message);
      }
    }

    // --- C. SAUVEGARDE DES JUSTIFICATIFS (fichiers scannés du bucket Supabase Storage "justificatifs") ---
    // Les données ci-dessus ne sont que les LIGNES des tables (avec un lien vers chaque fichier),
    // pas les fichiers eux-mêmes. On télécharge ici les fichiers réels pour que la sauvegarde reste
    // exploitable même si le projet Supabase devient un jour inaccessible.
    console.log('📎 Sauvegarde des justificatifs (fichiers scannés)...');
    const dossierJustificatifs = path.join(DOSSIER_DESTINATION, 'justificatifs');
    try {
      const { data: fichiers, error: errList } = await supabase.storage.from('justificatifs').list('', { limit: 1000 });
      if (errList) {
        console.error('  ❌ Erreur liste des justificatifs :', errList.message);
      } else if (fichiers && fichiers.length > 0) {
        if (!fs.existsSync(dossierJustificatifs)) {
          fs.mkdirSync(dossierJustificatifs, { recursive: true });
        }
        let copies = 0;
        for (const fichier of fichiers) {
          try {
            const { data: blob, error: errDownload } = await supabase.storage.from('justificatifs').download(fichier.name);
            if (errDownload || !blob) {
              console.error(`  ❌ Erreur téléchargement "${fichier.name}" :`, errDownload ? errDownload.message : 'fichier vide');
              continue;
            }
            fs.writeFileSync(path.join(dossierJustificatifs, fichier.name), Buffer.from(await blob.arrayBuffer()));
            copies++;
          } catch (err) {
            console.error(`  ❌ Exception sur "${fichier.name}" :`, err.message);
          }
        }
        console.log(`  ✅ ${copies}/${fichiers.length} justificatif(s) sauvegardé(s)`);
      } else {
        console.log('  ℹ️ Aucun justificatif dans le bucket Supabase Storage.');
      }
    } catch (err) {
      console.error('  ❌ Exception sauvegarde justificatifs :', err.message);
    }
  } else {
    console.log("  ℹ️ Configurez vos clés Supabase (secrets GitHub SUPABASE_URL / SUPABASE_SERVICE_KEY) pour l'export automatique des données.");
  }

  console.log(`\n🎉 Sauvegarde terminée dans : ${DOSSIER_DESTINATION}`);
}

executerSauvegarde();
