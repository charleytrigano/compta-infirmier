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

  if (!fs.existsSync(DOSSIER_DESTINATION)) {
    fs.mkdirSync(DOSSIER_DESTINATION, { recursive: true });
  }

  const dossierSupabase = path.join(DOSSIER_DESTINATION, 'supabase');
  if (!fs.existsSync(dossierSupabase)) {
    fs.mkdirSync(dossierSupabase, { recursive: true });
  }

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

  console.log('🗄️ Sauvegarde des données Supabase...');

  const SUPABASE_URL = process.env.SUPABASE_URL || 'VOTRE_SUPABASE_URL';
  const SUPABASE_KEY = process.env.SUPABASE_KEY || 'VOTRE_SUPABASE_ANON_KEY';

  if (SUPABASE_URL !== 'VOTRE_SUPABASE_URL') {
    console.log(`  ℹ️ URL utilisée : ${SUPABASE_URL}`);
    console.log(`  ℹ️ Longueur de la clé : ${SUPABASE_KEY.length} caractères`);

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    const { data: profileData, error: errProfile } = await supabase.from('profile').select('*');
    if (errProfile) {
      console.error('  ❌ Erreur sur la table "profile" :', errProfile.message);
    } else if (profileData) {
      fs.writeFileSync(
        path.join(dossierSupabase, 'profile_backup.json'),
        JSON.stringify(profileData, null, 2)
      );
      console.log('  ✅ Table "profile" exportée en JSON');
    }

    const { data: txData, error: errTx } = await supabase.from('transactions').select('*');
    if (errTx) {
      console.error('  ❌ Erreur sur la table "transactions" :', errTx.message);
    } else if (txData) {
      fs.writeFileSync(
        path.join(dossierSupabase, 'transactions_backup.json'),
        JSON.stringify(txData, null, 2)
      );
      console.log('  ✅ Table "transactions" exportée en JSON');
    }
  } else {
    console.log("  ℹ️ Configurez vos clés Supabase (variables d'environnement SUPABASE_URL / SUPABASE_KEY) pour l'export automatique des données.");
  }

  console.log(`\n🎉 Sauvegarde terminée dans : ${DOSSIER_DESTINATION}`);
}

executerSauvegarde();
