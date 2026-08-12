// ============================================================================
// 1. CONFIGURATION ET VARIABLES GLOBALES
// ============================================================================
const SUPABASE_URL = 'https://qfwhzuhwldurnmhirgil.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFmd2h6dWh3bGR1cm5taGlyZ2lsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU0OTQ0MTgsImV4cCI6MjEwMTA3MDQxOH0.Lt7eU9UBVY94tIIMUNOzLeJOpWnkGkvszy_gENkUkLg';

let supabaseClient = null;
let currentTransactions = [];
let currentProfileId = null;

// ============================================================================
// 2. DÉTECTION ET VENTILATION DES COMPTES PCG
// ============================================================================
function obtenirComptePCG(transaction) {
    const isRecette = (transaction.type || '').toLowerCase().includes('recette');
    const cat = (transaction.category || '').toLowerCase();
    const desc = (transaction.description || '').toLowerCase();
    const texteComplet = `${cat} ${desc}`;

    if (isRecette) {
        if (texteComplet.includes('autre')) {
            return { num: '708000', nom: 'Produits annexes' };
        }
        return { num: '706000', nom: 'Honoraires / Prestations de services' };
    }

    // Sous-comptes individuels CARPIMKO
    if (texteComplet.includes('carpimko base') || texteComplet.includes('régime de base')) {
        return { num: '645210', nom: 'CARPIMKO - Régime de base' };
    }
    if (texteComplet.includes('carpimko comp') || texteComplet.includes('complémentaire')) {
        return { num: '645220', nom: 'CARPIMKO - Régime complémentaire' };
    }
    if (texteComplet.includes('asv') || texteComplet.includes('avantage social')) {
        return { num: '645230', nom: 'CARPIMKO - ASV' };
    }
    if (texteComplet.includes('invalidité') || texteComplet.includes('deces') || texteComplet.includes('décès')) {
        return { num: '645240', nom: 'CARPIMKO - Invalidité / Décès' };
    }
    if (texteComplet.includes('carpimko')) {
        return { num: '645200', nom: 'Cotisations CARPIMKO Globales' };
    }

    if (texteComplet.includes('urssaf')) {
        return { num: '645100', nom: 'Cotisations URSSAF' };
    }
    if (texteComplet.includes('matériel') || texteComplet.includes('materiel') || texteComplet.includes('soins')) {
        return { num: '606300', nom: 'Petit matériel médical et fournitures' };
    }
    if (texteComplet.includes('loyer') || texteComplet.includes('location')) {
        return { num: '613200', nom: 'Loyer professionnel' };
    }
    if (texteComplet.includes('assurance')) {
        return { num: '616000', nom: 'Assurance professionnelle' };
    }
    if (texteComplet.includes('carburant') || texteComplet.includes('essence') || texteComplet.includes('déplacement')) {
        return { num: '625100', nom: 'Frais de déplacements et carburant' };
    }

    return { num: '628000', nom: 'Divers services extérieurs' };
}

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

// ============================================================================
// 3. INITIALISATION
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
            if (syncStatus) syncStatus.textContent = '⚠️ SDK Supabase manquant';
            return;
        }

        updateCategories();
        
        const inputDate = document.getElementById('date');
        if (inputDate) inputDate.value = new Date().toISOString().split('T')[0];

        await chargerProfil();
        await chargerTransactions();

    } catch (err) {
        console.error('Erreur d\'initialisation :', err);
        if (syncStatus) syncStatus.textContent = '⚠️ Erreur de chargement';
    }
});

// ============================================================================
// 4. NAVIGATION
// ============================================================================
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

    actualiserTousLesCalculs();
}

// ============================================================================
// 5. COMPTES ET CALCULS CARPIMKO
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

    // Mise à jour de la table principale
    remplir('baseT1', bnc.toFixed(2) + ' €');
    remplir('baseT2', bnc.toFixed(2) + ' €');
    remplir('reelT1', reelT1.toFixed(2) + ' €');
    remplir('reelT2', reelT2.toFixed(2) + ' €');
    remplir('baseAsv', revConv.toFixed(2) + ' €');
    remplir('reelAsvProp', reelAsvProp.toFixed(2) + ' €');

    remplir('totalReelDu', totalReelDu.toFixed(2) + ' €');
    remplir('dejaRegleAffichage', '- ' + dejaRegle.toFixed(2) + ' €');
    remplir('soldeReelPaye', soldeReel.toFixed(2) + ' €');

    // Mise à jour de la table des Comptes Individuels
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
            divAnalyse.innerHTML = `⚠️ Vos revenus réels sont supérieurs à la base d'appel. Prévoyez une régularisation de **+${ecart.toFixed(2)} €**.`;
        } else if (ecart < -10) {
            divAnalyse.style.background = '#d4edda';
            divAnalyse.style.color = '#155724';
            divAnalyse.innerHTML = `💡 Vous payez actuellement plus que ce que vous devez par rapport à votre réel ! Un trop-perçu de **${Math.abs(ecart).toFixed(2)} €** vous sera régularisé.`;
        } else {
            divAnalyse.style.background = '#d1ecf1';
            divAnalyse.style.color = '#0c5460';
            divAnalyse.innerHTML = `✅ L'appel de cotisation est parfaitement ajusté à votre niveau de revenus actuels.`;
        }
    }
}

// ============================================================================
// 6. TRANSACTIONS & PROFIL (DONNÉES)
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
        console.error(e);
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
        actualiserTousLesCalculs();
    } catch (e) {
        console.error(e);
    }
}

function afficherTransactions(liste) {
    const container = document.getElementById('transactions');
    if (!container) return;

    if (liste.length === 0) {
        container.innerHTML = '<p style="color:#666;">Aucune transaction enregistrée.</p>';
        return;
    }

    container.innerHTML = liste.map(t => `
        <div class="transaction ${t.type}">
            <div>
                <strong>${t.date}</strong> - <span>${t.description || 'Sans libellé'}</span><br>
                <small><strong>${parseFloat(t.amount).toFixed(2)} €</strong> (${t.type.toUpperCase()}) - <em>${t.category || ''}</em></small>
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

    if (!date || isNaN(amount) || !description) {
        alert('Veuillez remplir tous les champs.');
        return;
    }

    const { error } = await supabaseClient.from('transactions').insert([{ date, type, category, description, amount }]);
    if (!error) {
        document.getElementById('description').value = '';
        document.getElementById('amount').value = '';
        await chargerTransactions();
    }
}

async function supprimerTransaction(id) {
    if (!supabaseClient || !confirm('Supprimer cette transaction ?')) return;
    const { error } = await supabaseClient.from('transactions').delete().eq('id', id);
    if (!error) await chargerTransactions();
}

function actualiserTousLesCalculs() {
    genererBilanEtCE();
    genererDeclarations();
    actualiserCalculsCarpimko();
    afficherJournalEtBalance();
}

function genererBilanEtCE() {
    let honoraires = 0, autresRecettes = 0;
    let cotisations = 0, materiel = 0, deplacements = 0, assurances = 0, autresCharges = 0;

    currentTransactions.forEach(t => {
        const val = parseFloat(t.amount) || 0;
        const cat = (t.category || '').toLowerCase();
        const type = (t.type || '').toLowerCase();

        if (type.includes('recette')) {
            if (cat.includes('honoraire') || cat.includes('pai')) honoraires += val;
            else autresRecettes += val;
        } else {
            if (cat.includes('cotisation') || cat.includes('urssaf') || cat.includes('carpimko')) cotisations += val;
            else if (cat.includes('matériel') || cat.includes('materiel')) materiel += val;
            else if (cat.includes('carburant') || cat.includes('déplacement')) deplacements += val;
            else if (cat.includes('assurance')) assurances += val;
            else autresCharges += val;
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
    remplir('ceCharges', totalCharges);

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
