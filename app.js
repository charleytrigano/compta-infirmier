// ============================================================================
// 1. CONFIGURATION ET VARIABLES GLOBALES
// ============================================================================
const SUPABASE_URL = 'https://qfwhzuhwldurnmhirgil.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFmd2h6dWh3bGR1cm5taGlyZ2lsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU0OTQ0MTgsImV4cCI6MjEwMTA3MDQxOH0.Lt7eU9UBVY94tIIMUNOzLeJOpWnkGkvszy_gENkUkLg';

let supabaseClient = null;
let currentTransactions = [];
let currentPlanComptable = [];
let currentProfileId = null;

// ============================================================================
// 2. UTILITAIRES ET RENDU D'AFFICHAGE
// ============================================================================
function remplir(id, valeur) {
    const el = document.getElementById(id);
    if (!el) return;
    const valFormatee = typeof valeur === 'number' ? valeur.toFixed(2) + ' €' : valeur;
    if (el.tagName === 'INPUT' || el.tagName === 'SELECT') {
        el.value = typeof valeur === 'number' ? valeur.toFixed(2) : valeur;
    } else {
        el.textContent = valFormatee;
    }
}

function updateCategories() {
    const typeSelect = document.getElementById('type');
    const catSelect = document.getElementById('category');
    if (!typeSelect || !catSelect) return;

    const type = typeSelect.value;
    if (type === 'recette') {
        catSelect.innerHTML = `
            <option value="Honoraires PAI">Honoraires PAI / Mutuelles</option>
            <option value="Honoraires Patients">Honoraires Patients</option>
            <option value="Autre recette">Autre recette</option>
        `;
    } else {
        catSelect.innerHTML = `
            <option value="Cotisations URSSAF">Cotisations URSSAF</option>
            <option value="Cotisations CARPIMKO">Cotisations CARPIMKO</option>
            <option value="Matériel médical">Matériel médical</option>
            <option value="Loyer professionnel">Loyer professionnel</option>
            <option value="Assurance Pro">Assurance Pro</option>
            <option value="Carburant / Déplacements">Carburant / Déplacements</option>
            <option value="Autre dépense">Autre dépense</option>
        `;
    }
}

function obtenirComptePCG(transaction) {
    const isRecette = (transaction.type || '').toLowerCase().includes('recette');
    const cat = (transaction.category || '').toLowerCase();
    const desc = (transaction.description || '').toLowerCase();
    const texteComplet = `${cat} ${desc}`;

    if (isRecette) {
        if (texteComplet.includes('autre')) return { num: '708000', nom: 'Produits annexes' };
        return { num: '706000', nom: 'Honoraires / Prestations de services' };
    }

    if (texteComplet.includes('base')) return { num: '645210', nom: 'CARPIMKO - Régime de base' };
    if (texteComplet.includes('comp')) return { num: '645220', nom: 'CARPIMKO - Régime complémentaire' };
    if (texteComplet.includes('asv')) return { num: '645230', nom: 'CARPIMKO - ASV' };
    if (texteComplet.includes('invalidité') || texteComplet.includes('deces') || texteComplet.includes('décès')) return { num: '645240', nom: 'CARPIMKO - Invalidité / Décès' };
    if (texteComplet.includes('carpimko')) return { num: '645200', nom: 'Cotisations CARPIMKO' };
    
    if (texteComplet.includes('urssaf maladie')) return { num: '645110', nom: 'URSSAF - Assurance Maladie' };
    if (texteComplet.includes('urssaf af') || texteComplet.includes('allocations')) return { num: '645120', nom: 'URSSAF - Allocations Familiales' };
    if (texteComplet.includes('csg ded') || texteComplet.includes('déductible')) return { num: '645130', nom: 'URSSAF - CSG Déductible' };
    if (texteComplet.includes('csg non') || texteComplet.includes('crds')) return { num: '635800', nom: 'URSSAF - CSG Non Déductible / CRDS' };
    if (texteComplet.includes('cfp') || texteComplet.includes('formation')) return { num: '637800', nom: 'URSSAF - Formation Professionnelle' };
    if (texteComplet.includes('curps')) return { num: '637810', nom: 'URSSAF - CURPS' };
    if (texteComplet.includes('urssaf')) return { num: '645100', nom: 'Cotisations URSSAF Globales' };

    if (texteComplet.includes('matériel') || texteComplet.includes('materiel')) return { num: '606300', nom: 'Petit matériel médical' };
    if (texteComplet.includes('loyer') || texteComplet.includes('location')) return { num: '613200', nom: 'Loyer professionnel' };
    if (texteComplet.includes('assurance')) return { num: '616000', nom: 'Assurance professionnelle' };
    if (texteComplet.includes('carburant') || texteComplet.includes('déplacement')) return { num: '625100', nom: 'Frais de déplacements' };

    return { num: '628000', nom: 'Divers services extérieurs' };
}

// ============================================================================
// 3. INITIALISATION DE L'APPLICATION
// ============================================================================
document.addEventListener('DOMContentLoaded', async () => {
    const loadingEl = document.getElementById('loading');
    const appEl = document.getElementById('app');
    const syncStatus = document.getElementById('syncStatus');

    if (loadingEl) loadingEl.style.display = 'none';
    if (appEl) appEl.classList.remove('hidden');

    try {
        if (window.supabase) {
            supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
            if (syncStatus) syncStatus.textContent = '☁️ Connecté à Supabase';
        } else {
            if (syncStatus) syncStatus.textContent = '⚠️ SDK Supabase non disponible';
        }

        updateCategories();
        const inputDate = document.getElementById('date');
        if (inputDate) inputDate.value = new Date().toISOString().split('T')[0];

        await chargerProfil();
        await chargerPlanComptable();
        await chargerTransactions();

    } catch (err) {
        console.error('Erreur au chargement :', err);
        if (syncStatus) syncStatus.textContent = '⚠️ Erreur de chargement';
    }
});

function showTab(tabName) {
    const allTabs = document.querySelectorAll('.tab-content');
    allTabs.forEach(tab => tab.classList.add('hidden'));

    const buttons = document.querySelectorAll('.tab');
    buttons.forEach(btn => btn.classList.remove('active'));

    const targetTab = document.getElementById(`tab-${tabName}`);
    if (targetTab) targetTab.classList.remove('hidden');

    const activeBtn = Array.from(buttons).find(btn => 
        btn.getAttribute('onclick') && btn.getAttribute('onclick').includes(tabName)
    );
    if (activeBtn) activeBtn.classList.add('active');

    if (tabName === 'ngap') { filtrerNGAP(); calculerSimulateurNGAP(); }
    else { actualiserTousLesCalculs(); }
}

// ============================================================================
// 4. GESTION DU PLAN COMPTABLE (NOUVEAU)
// ============================================================================
async function chargerPlanComptable() {
    if (!supabaseClient) return;
    try {
        const { data, error } = await supabaseClient
            .from('plan_comptable')
            .select('*')
            .order('code_compte', { ascending: true });
        
        if (!error && data) {
            currentPlanComptable = data;
            afficherPlanComptable();
        }
    } catch (e) {
        console.error("Erreur Plan Comptable :", e);
    }
}

function afficherPlanComptable() {
    const tbody = document.getElementById('tbodyPlanComptable');
    if (!tbody) return;

    if (currentPlanComptable.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="color:#718096;">Aucun compte personnalisé trouvé.</td></tr>';
        return;
    }

    tbody.innerHTML = currentPlanComptable.map(c => `
        <tr>
            <td><span class="compte-badge">${c.code_compte}</span></td>
            <td>${c.libelle}</td>
            <td>${c.type_compte || 'Général'}</td>
            <td style="text-align: right;">
                <button class="btn btn-danger" onclick="supprimerComptePC('${c.id}')">🗑️ Supprimer</button>
            </td>
        </tr>
    `).join('');
}

async function ajouterComptePC() {
    if (!supabaseClient) return;
    const code = document.getElementById('pcCode')?.value;
    const libelle = document.getElementById('pcLibelle')?.value;
    const type = document.getElementById('pcType')?.value;

    if (!code || !libelle) {
        alert("Veuillez saisir le code et le libellé du compte.");
        return;
    }

    const { error } = await supabaseClient
        .from('plan_comptable')
        .insert([{ code_compte: code, libelle: libelle, type_compte: type }]);

    if (!error) {
        document.getElementById('pcCode').value = '';
        document.getElementById('pcLibelle').value = '';
        await chargerPlanComptable();
        alert("✅ Compte ajouté au plan comptable.");
    } else {
        alert("Erreur lors de l'ajout : " + error.message);
    }
}

async function supprimerComptePC(id) {
    if (!supabaseClient || !confirm("Supprimer ce compte du plan comptable ?")) return;
    const { error } = await supabaseClient.from('plan_comptable').delete().eq('id', id);
    if (!error) await chargerPlanComptable();
}

// ============================================================================
// 5. CALCULS URSSAF (PAMC 2026)
// ============================================================================
function actualiserCalculsUrssaf() {
    const bnc = parseFloat(document.getElementById('urssafBncReel')?.value) || 0;
    const revConv = parseFloat(document.getElementById('urssafRevConv')?.value) || 0;
    const dejaRegle = parseFloat(document.getElementById('urssafDejaRegle')?.value) || 0;

    const PASS_2026 = 46368;
    const reelMaladie = revConv * 0.0010;

    let tauxAF = 0;
    const seuilBas = 1.1 * PASS_2026;
    const seuilHaut = 1.4 * PASS_2026;

    if (bnc <= seuilBas) {
        tauxAF = 0;
    } else if (bnc >= seuilHaut) {
        tauxAF = 0.0310;
    } else {
        tauxAF = ((bnc - seuilBas) / (seuilHaut - seuilBas)) * 0.0310;
    }
    const reelAF = bnc * tauxAF;

    const csgTotal = bnc * 0.0970;
    const csgDed = bnc * 0.0680;
    const csgNDed = bnc * 0.0290;

    const reelCFP = 123.00;
    const reelCURPS = Math.min(bnc * 0.0050, 231.84);

    const totalReelDu = reelMaladie + reelAF + csgTotal + reelCFP + reelCURPS;
    const soldeReel = totalReelDu - dejaRegle;

    remplir('urssafBaseMaladie', revConv.toFixed(2) + ' €');
    remplir('urssafReelMaladie', reelMaladie.toFixed(2) + ' €');
    remplir('urssafBaseAF', bnc.toFixed(2) + ' € (' + (tauxAF * 100).toFixed(2) + '%)');
    remplir('urssafReelAF', reelAF.toFixed(2) + ' €');
    remplir('urssafBaseCsg', bnc.toFixed(2) + ' €');
    remplir('urssafReelCsg', csgTotal.toFixed(2) + ' €');
    remplir('urssafBaseCfp', 'Forfait annuel');
    remplir('urssafReelCfp', reelCFP.toFixed(2) + ' €');
    remplir('urssafBaseCurps', bnc.toFixed(2) + ' €');
    remplir('urssafReelCurps', reelCURPS.toFixed(2) + ' €');

    remplir('urssafTotalReelDu', totalReelDu.toFixed(2) + ' €');
    remplir('urssafDejaRegleAffichage', '- ' + dejaRegle.toFixed(2) + ' €');
    remplir('urssafSoldeReelPaye', soldeReel.toFixed(2) + ' €');

    remplir('uMaladie', reelMaladie.toFixed(2) + ' €');
    remplir('uAF', reelAF.toFixed(2) + ' €');
    remplir('uCsgDed', csgDed.toFixed(2) + ' €');
    remplir('uCsgNDed', csgNDed.toFixed(2) + ' €');
    remplir('uCFP', reelCFP.toFixed(2) + ' €');
    remplir('uCURPS', reelCURPS.toFixed(2) + ' €');
    remplir('uTotal', totalReelDu.toFixed(2) + ' €');

    const divAnalyse = document.getElementById('analyseEcartUrssaf');
    if (divAnalyse) {
        if (soldeReel > 10) {
            divAnalyse.style.background = '#f8d7da';
            divAnalyse.style.color = '#721c24';
            divAnalyse.innerHTML = `⚠️ Vos cotisations réelles URSSAF dépassent vos acomptes versés. Prévoyez un reste à payer de **+${soldeReel.toFixed(2)} €**.`;
        } else if (soldeReel < -10) {
            divAnalyse.style.background = '#d4edda';
            divAnalyse.style.color = '#155724';
            divAnalyse.innerHTML = `💡 Vos acomptes actuels couvrent vos cotisations réelles. Un trop-perçu de **${Math.abs(soldeReel).toFixed(2)} €** vous sera régularisé.`;
        } else {
            divAnalyse.style.background = '#d1ecf1';
            divAnalyse.style.color = '#0c5460';
            divAnalyse.innerHTML = `✅ Vos versements URSSAF sont parfaitement ajustés.`;
        }
    }
}

// ============================================================================
// 6. CALCULS CARPIMKO
// ============================================================================
function actualiserCalculsCarpimko() {
    const bnc = parseFloat(document.getElementById('carpBncReel')?.value) || 0;
    const revConv = parseFloat(document.getElementById('carpRevConv')?.value) || 0;
    const dejaRegle = parseFloat(document.getElementById('carpDejaRegle')?.value) || 0;

    const PASS_2026 = 46368; 
    const t1Base = Math.min(bnc, PASS_2026);
    const t2Base = bnc;

    const reelT1 = t1Base * 0.0873;
    const reelT2 = t2Base * 0.0187;

    const reelComp = 2091.00;
    const asvForfait = 224.00;
    const reelAsvProp = revConv * 0.004 * 0.40;
    const invDeces = 1022.00;
    const regu2025 = 1027.96 + 220.90;

    const totalReelBase = reelT1 + reelT2 + regu2025;
    const totalReelAsv = asvForfait + reelAsvProp;
    const totalReelDu = totalReelBase + reelComp + totalReelAsv + invDeces;
    const soldeReel = totalReelDu - dejaRegle;

    remplir('baseT1', bnc.toFixed(2) + ' €');
    remplir('baseT2', bnc.toFixed(2) + ' €');
    remplir('reelT1', reelT1.toFixed(2) + ' €');
    remplir('reelT2', reelT2.toFixed(2) + ' €');
    remplir('baseAsv', revConv.toFixed(2) + ' €');
    remplir('reelAsvProp', reelAsvProp.toFixed(2) + ' €');

    remplir('totalReelDu', totalReelDu.toFixed(2) + ' €');
    remplir('dejaRegleAffichage', '- ' + dejaRegle.toFixed(2) + ' €');
    remplir('soldeReelPaye', soldeReel.toFixed(2) + ' €');

    remplir('ciBase', totalReelBase.toFixed(2) + ' €');
    remplir('ciComp', reelComp.toFixed(2) + ' €');
    remplir('ciAsv', totalReelAsv.toFixed(2) + ' €');
    remplir('ciInv', invDeces.toFixed(2) + ' €');
    remplir('ciTotal', totalReelDu.toFixed(2) + ' €');

    const appelOfficielSolde = 8896.86;
    const ecart = soldeReel - appelOfficielSolde;
    const divAnalyse = document.getElementById('analyseEcart');

    if (divAnalyse) {
        if (ecart > 10) {
            divAnalyse.style.background = '#f8d7da';
            divAnalyse.style.color = '#721c24';
            divAnalyse.innerHTML = `⚠️ Vos revenus réels dépassent la base d'appel. Prévoyez une régularisation de **+${ecart.toFixed(2)} €**.`;
        } else if (ecart < -10) {
            divAnalyse.style.background = '#d4edda';
            divAnalyse.style.color = '#155724';
            divAnalyse.innerHTML = `💡 Trop-perçu de **${Math.abs(ecart).toFixed(2)} €** à votre avantage.`;
        } else {
            divAnalyse.style.background = '#d1ecf1';
            divAnalyse.style.color = '#0c5460';
            divAnalyse.innerHTML = `✅ Appel de cotisation parfaitement ajusté.`;
        }
    }
}

// ============================================================================
// 7. TRANSACTIONS & SCAN DE PIÈCES JOINTES
// ============================================================================
async function chargerProfil() {
    if (!supabaseClient) return;
    try {
        const { data } = await supabaseClient.from('profile').select('*').limit(1);
        if (data && data.length > 0) {
            const profil = data[0];
            currentProfileId = profil.id;
            if (document.getElementById('nom')) document.getElementById('nom').value = profil.nom || '';
            if (document.getElementById('prenom')) document.getElementById('prenom').value = profil.prenom || '';
            if (document.getElementById('siret')) document.getElementById('siret').value = profil.siret || '';
            if (document.getElementById('rpps')) document.getElementById('rpps').value = profil.rpps || '';
            if (document.getElementById('email')) document.getElementById('email').value = profil.email || '';
        }
    } catch (e) {
        console.error("Erreur profil:", e);
    }
}

async function saveProfile() {
    if (!supabaseClient) return;
    const profilData = {
        nom: document.getElementById('nom')?.value || '',
        prenom: document.getElementById('prenom')?.value || '',
        siret: document.getElementById('siret')?.value || '',
        rpps: document.getElementById('rpps')?.value || '',
        email: document.getElementById('email')?.value || ''
    };
    if (currentProfileId) profilData.id = currentProfileId;
    const { error } = await supabaseClient.from('profile').upsert([profilData]);
    if (!error) alert("✅ Profil enregistré !");
}

async function chargerTransactions() {
    if (!supabaseClient) return;
    try {
        const { data } = await supabaseClient.from('transactions').select('*').order('date', { ascending: false });
        currentTransactions = data || [];
        afficherTransactions(currentTransactions);
        initialiserAnneesGrandLivre();
        actualiserTousLesCalculs();
    } catch (e) {
        console.error("Erreur transactions:", e);
    }
}

function afficherTransactions(liste) {
    const container = document.getElementById('transactions');
    if (!container) return;

    if (liste.length === 0) {
        container.innerHTML = '<p style="color:#718096;">Aucune transaction enregistrée.</p>';
        return;
    }

    container.innerHTML = liste.map(t => `
        <div class="transaction ${t.type}">
            <div>
                <strong>${t.date}</strong> - <span>${t.description || 'Sans libellé'}</span><br>
                <small><strong>${parseFloat(t.amount).toFixed(2)} €</strong> (${t.type.toUpperCase()}) - <em>${t.category || ''}</em></small>
                ${t.file_path ? `<br><small>📎 <a href="${supabaseClient.storage.from('justificatifs').getPublicUrl(t.file_path).data.publicUrl}" target="_blank">Voir le justificatif</a></small>` : ''}
            </div>
            <div>
                <button class="btn btn-danger" onclick="supprimerTransaction('${t.id}')">🗑️</button>
            </div>
        </div>
    `).join('');
}

async function addTransaction() {
    if (!supabaseClient) return;
    const date = document.getElementById('date')?.value;
    const type = document.getElementById('type')?.value;
    const category = document.getElementById('category')?.value;
    const description = document.getElementById('description')?.value;
    const amount = parseFloat(document.getElementById('amount')?.value);
    const fileInput = document.getElementById('fileInput');

    if (!date || isNaN(amount) || !description) {
        alert('Veuillez remplir tous les champs obligatoires.');
        return;
    }

    let filePath = null;

    // Envoi du fichier scanné dans Supabase Storage (bucket justificatifs)
    if (fileInput && fileInput.files.length > 0) {
        const file = fileInput.files[0];
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

        const { data: uploadData, error: uploadError } = await supabaseClient.storage
            .from('justificatifs')
            .upload(fileName, file);

        if (uploadError) {
            console.error("Erreur d'envoi du justificatif :", uploadError);
        } else {
            filePath = fileName;
        }
    }

    const { error } = await supabaseClient.from('transactions').insert([{ 
        date, type, category, description, amount, file_path: filePath 
    }]);

    if (!error) {
        document.getElementById('description').value = '';
        document.getElementById('amount').value = '';
        if (fileInput) fileInput.value = '';
        await chargerTransactions();
    }
}

async function supprimerTransaction(id) {
    if (!supabaseClient || !confirm('Supprimer cette transaction ?')) return;
    const { error } = await supabaseClient.from('transactions').delete().eq('id', id);
    if (!error) await chargerTransactions();
}

// ============================================================================
// 8. SAUVEGARDE ET EXPORTATION COMPLÈTE EN ZIP (+ XLSX + SCANS)
// ============================================================================
async function exporterSauvegardeZIP() {
    if (!window.JSZip || !window.XLSX) {
        alert("Les librairies d'exportation sont en cours de chargement, réessayez dans un instant.");
        return;
    }

    try {
        const zip = new JSZip();

        // 1. Feuille de calcul Excel avec Transactions & Plan Comptable
        const workbook = XLSX.utils.book_new();

        // Onglet 1 : Écritures / Journal
        const dataEcritures = currentTransactions.map(t => ({
            Date: t.date,
            Type: t.type,
            Categorie: t.category,
            Description: t.description,
            Montant: t.amount,
            CodeCompte: obtenirComptePCG(t).num,
            NomCompte: obtenirComptePCG(t).nom,
            FichierJoint: t.file_path || 'Aucun'
        }));
        const wsEcritures = XLSX.utils.json_to_sheet(dataEcritures);
        XLSX.utils.book_append_sheet(workbook, wsEcritures, "Ecritures");

        // Onglet 2 : Plan Comptable
        const wsPlan = XLSX.utils.json_to_sheet(currentPlanComptable);
        XLSX.utils.book_append_sheet(workbook, wsPlan, "Plan Comptable");

        // Fichier Excel dans le ZIP
        const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
        zip.file("Comptabilite_Cabinet.xlsx", excelBuffer);

        // 2. Dossier des Pièces Jointes / Scans
        const folderScans = zip.folder("Justificatifs_Scannes");
        let nbFilesDownloaded = 0;

        for (const t of currentTransactions) {
            if (t.file_path) {
                const { data: blob, error } = await supabaseClient.storage
                    .from('justificatifs')
                    .download(t.file_path);

                if (!error && blob) {
                    folderScans.file(`${t.date}_${t.file_path}`, blob);
                    nbFilesDownloaded++;
                }
            }
        }

        // 3. Téléchargement du fichier ZIP global
        const zipBlob = await zip.generateAsync({ type: "blob" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(zipBlob);
        link.download = `Comptabilite_Export_${new Date().toISOString().split('T')[0]}.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        alert(`✅ Export réussi ! Le fichier ZIP contenant le fichier Excel et ${nbFilesDownloaded} justificatif(s) a été téléchargé.`);

    } catch (err) {
        console.error("Erreur Export ZIP :", err);
        alert("Une erreur est survenue lors de la création du fichier ZIP.");
    }
}

// ============================================================================
// 9. BILAN, DECLARATIONS, JOURNAL & BALANCE
// ============================================================================
function actualiserTousLesCalculs() {
    genererBilanEtCE();
    genererDeclarations();
    actualiserCalculsUrssaf();
    actualiserCalculsCarpimko();
    afficherJournalEtBalance();
    afficherGrandLivre();
}

function genererBilanEtCE() {
    let honoraires = 0, autresRecettes = 0;
    let cotisations = 0, materiel = 0, deplacements = 0, assurances = 0, autresCharges = 0;

    currentTransactions.forEach(t => {
        const val = parseFloat(t.amount) || 0;
        const cat = (t.category || '').toLowerCase();
        const desc = (t.description || '').toLowerCase();
        const type = (t.type || '').toLowerCase();
        const texte = `${cat} ${desc}`;

        if (type.includes('recette')) {
            if (texte.includes('honoraire') || texte.includes('pai') || texte.includes('patient') || texte.includes('soins')) {
                honoraires += val;
            } else {
                autresRecettes += val;
            }
        } else {
            if (texte.includes('cotisation') || texte.includes('urssaf') || texte.includes('carpimko')) {
                cotisations += val;
            } else if (texte.includes('matériel') || texte.includes('materiel')) {
                materiel += val;
            } else if (texte.includes('carburant') || texte.includes('déplacement') || texte.includes('essence')) {
                deplacements += val;
            } else if (texte.includes('assurance')) {
                assurances += val;
            } else {
                autresCharges += val;
            }
        }
    });

    const totalProduits = honoraires + autresRecettes;
    const totalCharges = cotisations + materiel + deplacements + assurances + autresCharges;

    remplir('ceHonoraires', honoraires);
    remplir('ceAutresRecettes', autresRecettes);
    remplir('ceProduits', totalProduits);

    remplir('ceCotis', cotisations);
    remplir('ceMateriel', materiel);
    remplir('ceFraisDeplacement', deplacements);
    remplir('ceAssurances', assurances);
    remplir('ceChargesTotal', totalCharges);

    remplir('ceResultat', totalProduits - totalCharges);
}

function genererDeclarations() {
    const anneeSelectionnee = document.getElementById('selectAnnee')?.value || 'Toutes';
    let totalCA = 0;
    let t1 = 0, t2 = 0, t3 = 0, t4 = 0;

    const transactionsFiltrees = currentTransactions.filter(t => {
        if (!t.date) return false;
        if (anneeSelectionnee === 'Toutes') return true;
        return t.date.startsWith(anneeSelectionnee);
    });

    transactionsFiltrees.forEach(t => {
        const val = parseFloat(t.amount) || 0;
        if ((t.type || '').toLowerCase().includes('recette')) {
            totalCA += val;
            const mois = new Date(t.date).getMonth() + 1;
            if (mois <= 3) t1 += val;
            else if (mois <= 6) t2 += val;
            else if (mois <= 9) t3 += val;
            else t4 += val;
        }
    });

    remplir('declCA', totalCA);
    remplir('caT1', t1);
    remplir('caT2', t2);
    remplir('caT3', t3);
    remplir('caT4', t4);
}

function exporterPourComptable() {
    if (currentTransactions.length === 0) {
        alert("Aucune transaction à exporter.");
        return;
    }
    let csv = "Date;Type;Categorie;Description;Montant\n";
    currentTransactions.forEach(t => {
        csv += `${t.date};${t.type};${t.category};${t.description};${t.amount}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "export_comptabilite.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function afficherJournalEtBalance() {
    const tbodyJournal = document.getElementById('tbodyJournal');
    const tbodyBalance = document.getElementById('tbodyBalance');

    if (tbodyJournal) {
        tbodyJournal.innerHTML = currentTransactions.map(t => {
            const val = parseFloat(t.amount) || 0;
            const isRecette = (t.type || '').toLowerCase().includes('recette');
            const compteInfo = obtenirComptePCG(t);

            return `
                <tr>
                    <td>${t.date}</td>
                    <td><span class="compte-badge">${compteInfo.num}</span></td>
                    <td>${t.description || ''}</td>
                    <td>${t.file_path ? '📎 Oui' : '-'}</td>
                    <td style="text-align:right;">${!isRecette ? val.toFixed(2) + ' €' : '-'}</td>
                    <td style="text-align:right;">${isRecette ? val.toFixed(2) + ' €' : '-'}</td>
                </tr>
            `;
        }).join('');
    }

    if (tbodyBalance) {
        const balanceMap = { '512000': { nom: 'Compte Bancaire Pro', debit: 0, credit: 0 } };

        currentTransactions.forEach(t => {
            const val = parseFloat(t.amount) || 0;
            const isRecette = (t.type || '').toLowerCase().includes('recette');
            const compte = obtenirComptePCG(t);

            if (!balanceMap[compte.num]) balanceMap[compte.num] = { nom: compte.nom, debit: 0, credit: 0 };

            if (isRecette) {
                balanceMap[compte.num].credit += val;
                balanceMap['512000'].debit += val;
            } else {
                balanceMap[compte.num].debit += val;
                balanceMap['512000'].credit += val;
            }
        });

        tbodyBalance.innerHTML = Object.keys(balanceMap).sort().map(num => {
            const c = balanceMap[num];
            const solde = c.debit - c.credit;
            return `
                <tr>
                    <td><span class="compte-badge">${num}</span></td>
                    <td>${c.nom}</td>
                    <td style="text-align:right;">${c.debit.toFixed(2)} €</td>
                    <td style="text-align:right;">${c.credit.toFixed(2)} €</td>
                    <td style="text-align:right; font-weight:bold;">${solde.toFixed(2)} €</td>
                </tr>
            `;
        }).join('');
    }
}

// ============================================================================
// 10. GRAND LIVRE
// ============================================================================
function initialiserAnneesGrandLivre() {
    const select = document.getElementById('selectAnneeGrandLivre');
    if (!select) return;

    const anneesSet = new Set();
    const anneeActuelle = new Date().getFullYear().toString();
    anneesSet.add(anneeActuelle);

    currentTransactions.forEach(t => {
        if (t.date && t.date.length >= 4) {
            anneesSet.add(t.date.substring(0, 4));
        }
    });

    const anneesTriees = Array.from(anneesSet).sort().reverse();
    const valeurSelectionneeActuelle = select.value;

    select.innerHTML = '<option value="Toutes">Toutes les années</option>' +
        anneesTriees.map(a => `<option value="${a}">${a}</option>`).join('');

    if (valeurSelectionneeActuelle && Array.from(select.options).some(o => o.value === valeurSelectionneeActuelle)) {
        select.value = valeurSelectionneeActuelle;
    } else {
        select.value = anneeActuelle;
    }
}

function afficherGrandLivre() {
    const container = document.getElementById('grandLivreContainer');
    if (!container) return;

    if (!currentTransactions || currentTransactions.length === 0) {
        container.innerHTML = '<p style="color:#718096; padding: 10px;">Aucune transaction enregistrée.</p>';
        return;
    }

    const anneeFiltre = document.getElementById('selectAnneeGrandLivre')?.value || 'Toutes';
    const comptesMap = {};

    comptesMap['512000'] = { num: '512000', nom: 'Compte Bancaire Pro', mouvements: [] };

    currentTransactions.forEach(t => {
        const val = parseFloat(t.amount) || 0;
        const isRecette = (t.type || '').toLowerCase().includes('recette');
        const compteInfo = obtenirComptePCG(t);
        const numCompte = compteInfo.num;

        if (!comptesMap[numCompte]) {
            comptesMap[numCompte] = { num: numCompte, nom: compteInfo.nom, mouvements: [] };
        }

        comptesMap[numCompte].mouvements.push({
            date: t.date || '',
            description: t.description || 'Sans libellé',
            category: t.category || '',
            debit: isRecette ? 0 : val,
            credit: isRecette ? val : 0
        });

        comptesMap['512000'].mouvements.push({
            date: t.date || '',
            description: t.description || 'Sans libellé',
            category: t.category || '',
            debit: isRecette ? val : 0,
            credit: isRecette ? 0 : val
        });
    });

    const codesComptesTries = Object.keys(comptesMap).sort();
    let htmlGlobal = '';
    let nbComptesAffiches = 0;

    codesComptesTries.forEach(num => {
        const compte = comptesMap[num];
        const estCompteBilan = parseInt(num.substring(0, 1)) <= 5;

        let reportANouveauDebit = 0;
        let reportANouveauCredit = 0;
        let mouvementsExercice = [];

        if (anneeFiltre === 'Toutes') {
            mouvementsExercice = [...compte.mouvements];
        } else {
            compte.mouvements.forEach(m => {
                const anneeMvt = m.date ? m.date.substring(0, 4) : '';
                if (anneeMvt < anneeFiltre) {
                    if (estCompteBilan) {
                        reportANouveauDebit += m.debit;
                        reportANouveauCredit += m.credit;
                    }
                } else if (anneeMvt === anneeFiltre) {
                    mouvementsExercice.push(m);
                }
            });
        }

        if (mouvementsExercice.length === 0 && reportANouveauDebit === 0 && reportANouveauCredit === 0) return;

        nbComptesAffiches++;
        mouvementsExercice.sort((a, b) => new Date(a.date) - new Date(b.date));

        let totalDebitPériode = 0;
        let totalCreditPériode = 0;
        let soldeProgressif = reportANouveauDebit - reportANouveauCredit;
        let lignesHtml = '';

        if (estCompteBilan && (reportANouveauDebit > 0 || reportANouveauCredit > 0)) {
            lignesHtml += `
                <tr style="background-color: #f7fafc; font-style: italic;">
                    <td>01/01/${anneeFiltre}</td>
                    <td><strong>À-Nouveaux (Solde reporté)</strong></td>
                    <td style="text-align:right;">${reportANouveauDebit > 0 ? reportANouveauDebit.toFixed(2) + ' €' : '-'}</td>
                    <td style="text-align:right;">${reportANouveauCredit > 0 ? reportANouveauCredit.toFixed(2) + ' €' : '-'}</td>
                    <td style="text-align:right; font-weight: bold;">${soldeProgressif.toFixed(2)} €</td>
                </tr>
            `;
        }

        mouvementsExercice.forEach(m => {
            totalDebitPériode += m.debit;
            totalCreditPériode += m.credit;
            soldeProgressif += (m.debit - m.credit);

            lignesHtml += `
                <tr>
                    <td>${m.date}</td>
                    <td>${m.description} <small style="color:#718096;">(${m.category})</small></td>
                    <td style="text-align:right;">${m.debit > 0 ? m.debit.toFixed(2) + ' €' : '-'}</td>
                    <td style="text-align:right;">${m.credit > 0 ? m.credit.toFixed(2) + ' €' : '-'}</td>
                    <td style="text-align:right; font-weight: 500;">${soldeProgressif.toFixed(2)} €</td>
                </tr>
            `;
        });

        const totalGeneralDebit = reportANouveauDebit + totalDebitPériode;
        const totalGeneralCredit = reportANouveauCredit + totalCreditPériode;
        const soldeCloture = totalGeneralDebit - totalGeneralCredit;

        htmlGlobal += `
            <div style="margin-bottom: 25px; background: #ffffff; padding: 15px; border-radius: 8px; border: 1px solid #e2e8f0;">
                <h4 style="margin-top: 0; color: #2d3748; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px;">
                    <span class="compte-badge">${compte.num}</span> ${compte.nom}
                </h4>
                <table>
                    <thead>
                        <tr>
                            <th style="width: 110px;">Date</th>
                            <th>Libellé / Catégorie</th>
                            <th style="text-align:right; width: 120px;">Débit</th>
                            <th style="text-align:right; width: 120px;">Crédit</th>
                            <th style="text-align:right; width: 140px;">Solde progressif</th>
                        </tr>
                    </thead>
                    <tbody>${lignesHtml}</tbody>
                    <tfoot>
                        <tr style="font-weight: bold; background-color: #edf2f7;">
                            <td colspan="2">Totaux et Solde de clôture</td>
                            <td style="text-align:right;">${totalGeneralDebit.toFixed(2)} €</td>
                            <td style="text-align:right;">${totalGeneralCredit.toFixed(2)} €</td>
                            <td style="text-align:right; color: ${soldeCloture >= 0 ? '#2b6cb0' : '#c53030'};">${soldeCloture.toFixed(2)} €</td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        `;
    });

    container.innerHTML = htmlGlobal || `<p style="color:#718096; padding: 10px;">Aucune écriture pour l'exercice ${anneeFiltre}.</p>`;
}



// ============================================================================
// NOMENCLATURE NGAP — Base des actes infirmiers 2025-2026
// ============================================================================

const NGAP_ACTES = [
    // ── SOINS GÉNÉRAUX (AMI) ──────────────────────────────────────────────
    { code:'AMI 1',   categorie:'Soins généraux', description:'Injection sous-cutanée ou intramusculaire (insuline, anticoagulant...)', coeff:1, tarif:3.15 },
    { code:'AMI 1,5', categorie:'Soins généraux', description:'Prélèvement sanguin veineux au domicile du patient', coeff:1.5, tarif:4.73 },
    { code:'AMI 2',   categorie:'Soins généraux', description:'Injection intraveineuse directe / Pansement simple (plaie superficielle)', coeff:2, tarif:6.30 },
    { code:'AMI 2',   categorie:'Soins généraux', description:'Ablation de points (pansement inclus) — suture simple', coeff:2, tarif:6.30 },
    { code:'AMI 2',   categorie:'Soins généraux', description:'Soins de stomie urinaire ou digestive (entretien)', coeff:2, tarif:6.30 },
    { code:'AMI 3',   categorie:'Soins généraux', description:'Pansement complexe : escarre stade 1-2, plaie chronique simple', coeff:3, tarif:9.45 },
    { code:'AMI 3',   categorie:'Soins généraux', description:'Sondage vésical aller-retour chez la femme', coeff:3, tarif:9.45 },
    { code:'AMI 3',   categorie:'Soins généraux', description:'Pose de sonde naso-gastrique', coeff:3, tarif:9.45 },
    { code:'AMI 3',   categorie:'Soins généraux', description:'Lavement évacuateur', coeff:3, tarif:9.45 },
    { code:'AMI 3,5', categorie:'Soins généraux', description:'Sondage vésical à demeure (homme) — pose et surveillance', coeff:3.5, tarif:11.03 },
    { code:'AMI 4',   categorie:'Soins généraux', description:'Séance de soins infirmiers (SSI) — soins de base complets', coeff:4, tarif:12.60 },
    { code:'AMI 4',   categorie:'Soins généraux', description:'Pansement très complexe : escarre stade 3-4, brûlure étendue', coeff:4, tarif:12.60 },
    { code:'AMI 4',   categorie:'Soins généraux', description:'Pansement chirurgical complexe (post-opératoire évolutif)', coeff:4, tarif:12.60 },
    { code:'AMI 4',   categorie:'Soins généraux', description:'Soins de trachéotomie (aspiration, pansement)', coeff:4, tarif:12.60 },
    { code:'AMI 6',   categorie:'Soins généraux', description:'Séance de soins palliatifs à domicile (soins de confort + nursing)', coeff:6, tarif:18.90 },

    // ── PERFUSIONS ─────────────────────────────────────────────────────────
    { code:'AMI 4',   categorie:'Perfusion', description:'Perfusion simple par voie sous-cutanée (hypodermoclyse)', coeff:4, tarif:12.60 },
    { code:'AMI 8',   categorie:'Perfusion', description:'Perfusion IV par voie veineuse périphérique (< 1h)', coeff:8, tarif:25.20 },
    { code:'AMI 12',  categorie:'Perfusion', description:'Perfusion IV longue durée (> 1h) ou nutrition parentérale', coeff:12, tarif:37.80 },

    // ── PRÉLÈVEMENTS ───────────────────────────────────────────────────────
    { code:'AMI 1,5', categorie:'Prélèvement', description:'Prélèvement sanguin veineux (prise de sang au domicile)', coeff:1.5, tarif:4.73 },
    { code:'AMI 1',   categorie:'Prélèvement', description:'Prélèvement capillaire (glycémie, INR...)', coeff:1, tarif:3.15 },
    { code:'AMI 2',   categorie:'Prélèvement', description:'Prélèvement bactériologique (ECBU, plaie...)', coeff:2, tarif:6.30 },

    // ── PSYCHIATRIE (AIS) ─────────────────────────────────────────────────
    { code:'AIS 3',   categorie:'Psychiatrie', description:'Séance de soins infirmiers psychiatriques — patient en GIR 4-5-6 ou sans dépendance majeure', coeff:3, tarif:9.45 },
    { code:'AIS 5',   categorie:'Psychiatrie', description:'Séance de soins infirmiers psychiatriques — patient en GIR 1-2-3 (dépendance lourde)', coeff:5, tarif:15.75 },

    // ── BILAN DE SOINS INFIRMIERS (BSI) ────────────────────────────────────
    { code:'BSI Initial',  categorie:'Bilan', description:'Bilan de Soins Infirmiers — Évaluation initiale de la dépendance (remplace la cotation DEP)', coeff:null, tarif:65.69 },
    { code:'BSI Interm.',  categorie:'Bilan', description:'Bilan de Soins Infirmiers — Bilan intermédiaire (réévaluation)', coeff:null, tarif:32.85 },
    { code:'BSI Fin',      categorie:'Bilan', description:'Bilan de Soins Infirmiers — Bilan de fin de prise en charge', coeff:null, tarif:32.85 },

    // ── MAJORATIONS ────────────────────────────────────────────────────────
    { code:'MAU',  categorie:'Majoration', description:'Majoration Acte Unique : seul acte réalisé lors du passage', coeff:null, tarif:3.50 },
    { code:'MIE',  categorie:'Majoration', description:'Majoration Infirmière Exclusive : patient suivi uniquement par une infirmière', coeff:null, tarif:3.15 },
    { code:'MDD',  categorie:'Majoration', description:'Majoration Dimanche et Jours Fériés', coeff:null, tarif:8.35 },
    { code:'MN',   categorie:'Majoration', description:'Majoration Nuit (20h–minuit et 6h–8h)', coeff:null, tarif:9.15 },
    { code:'MSN',  categorie:'Majoration', description:'Majoration Nuit Profonde (minuit–6h)', coeff:null, tarif:19.50 },

    // ── INDEMNITÉS ─────────────────────────────────────────────────────────
    { code:'IK Plaine',    categorie:'Indemnité', description:'Indemnité kilométrique — déplacement en zone plate ou urbaine', coeff:null, tarif:0.35 },
    { code:'IK Montagne',  categorie:'Indemnité', description:'Indemnité kilométrique — déplacement en zone montagneuse', coeff:null, tarif:0.50 },
    { code:'IK Piéton',    categorie:'Indemnité', description:'Indemnité forfaitaire déplacement à pied (si < 500m)', coeff:null, tarif:2.10 },
];

let ngapStatut = 'titulaire';

function setStatutNGAP(statut) {
    ngapStatut = statut;
    document.getElementById('btnTitulaire').style.background = statut === 'titulaire' ? '#2b6cb0' : '#e2e8f0';
    document.getElementById('btnTitulaire').style.color = statut === 'titulaire' ? 'white' : '#2d3748';
    document.getElementById('btnRemplacante').style.background = statut === 'remplacante' ? '#2b6cb0' : '#e2e8f0';
    document.getElementById('btnRemplacante').style.color = statut === 'remplacante' ? 'white' : '#2d3748';
    document.getElementById('bandeauRemplacante').style.display = statut === 'remplacante' ? 'block' : 'none';
    document.getElementById('ngapInfoStatut').textContent = statut === 'titulaire'
        ? 'ℹ️ Titulaire : facturation directe à la CPAM'
        : 'ℹ️ Remplaçante : facture sous numéro titulaire — reverse 30-40% en rétrocession';
    const colR = document.getElementById('colRemplacante');
    if (colR) colR.style.display = statut === 'remplacante' ? '' : 'none';
    filtrerNGAP();
    calculerSimulateurNGAP();
}

function filtrerNGAP() {
    const recherche = (document.getElementById('ngapSearch')?.value || '').toLowerCase();
    const categorie = document.getElementById('ngapCategorie')?.value || '';
    const retro = 0.35; // 35% rétrocession par défaut

    const filtres = NGAP_ACTES.filter(a => {
        const matchCat = !categorie || a.categorie === categorie;
        const matchSearch = !recherche
            || a.code.toLowerCase().includes(recherche)
            || a.description.toLowerCase().includes(recherche)
            || a.categorie.toLowerCase().includes(recherche);
        return matchCat && matchSearch;
    });

    const tbody = document.getElementById('ngapTbody');
    if (!tbody) return;

    if (filtres.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#718096;padding:20px;">Aucun acte trouvé</td></tr>';
        return;
    }

    const fmt = n => n.toFixed(2).replace('.', ',') + ' €';
    const tauxSS = 0.60; // 60% en secteur conventionné standard

    tbody.innerHTML = filtres.map(a => {
        const rembSS = a.tarif * tauxSS;
        const apresRetro = a.tarif * (1 - retro);
        const couleurCat = {
            'Soins généraux': '#ebf8ff',
            'Psychiatrie': '#faf5ff',
            'Bilan': '#f0fff4',
            'Prélèvement': '#fffbeb',
            'Perfusion': '#fff5f5',
            'Majoration': '#f7fafc',
            'Indemnité': '#f7fafc'
        }[a.categorie] || '#fff';

        return `<tr style="border-bottom:1px solid #e2e8f0;">
            <td><span class="compte-badge" style="font-size:0.85em;">${a.code}</span></td>
            <td style="font-size:0.9em;">${a.description}</td>
            <td style="text-align:center;color:#718096;">${a.coeff !== null ? 'x' + a.coeff : '—'}</td>
            <td style="text-align:right;font-weight:600;color:#2b6cb0;">${fmt(a.tarif)}</td>
            <td style="text-align:right;color:#38a169;">${fmt(rembSS)}</td>
            ${ngapStatut === 'remplacante'
                ? `<td style="text-align:right;color:#744210;">${fmt(apresRetro)}</td>`
                : ''}
            <td><span style="background:${couleurCat};padding:2px 8px;border-radius:10px;font-size:0.8em;">${a.categorie}</span></td>
        </tr>`;
    }).join('');
}

function calculerSimulateurNGAP() {
    const nb = parseFloat(document.getElementById('simNbPassages')?.value) || 0;
    const tarif = parseFloat(document.getElementById('simActePrincipal')?.value) || 0;
    const jours = parseFloat(document.getElementById('simNbJours')?.value) || 0;
    const pctMajo = (parseFloat(document.getElementById('simPctMajo')?.value) || 0) / 100;

    const majoMoyenne = 8.75; // MDD moyen
    const caMois = (nb * tarif + nb * pctMajo * majoMoyenne) * jours;
    const caAnnuel = caMois * 12;
    const apresRetro = caMois * 0.65; // 35% rétrocession

    const fmt = n => Math.round(n).toLocaleString('fr-FR') + ' €';
    const el = id => document.getElementById(id);
    if (el('simCaMensuel')) el('simCaMensuel').textContent = fmt(caMois);
    if (el('simCaAnnuel')) el('simCaAnnuel').textContent = fmt(caAnnuel);
    if (el('simApresRetro')) el('simApresRetro').textContent = fmt(apresRetro) + '/mois';
}

// Initialiser au chargement de l'onglet
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        filtrerNGAP();
        calculerSimulateurNGAP();
    }, 500);
});
