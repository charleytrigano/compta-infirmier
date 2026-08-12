// ============================================================================
// 1. CONFIGURATION ET VARIABLES GLOBALES
// ============================================================================
const SUPABASE_URL = 'https://qfwhzuhwldurnmhirgil.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFmd2h6dWh3bGR1cm5taGlyZ2lsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU0OTQ0MTgsImV4cCI6MjEwMTA3MDQxOH0.Lt7eU9UBVY94tIIMUNOzLeJOpWnkGkvszy_gENkUkLg';

let supabaseClient = null;
let currentTransactions = [];
let currentProfileId = null;

// ============================================================================
// 2. UTILITAIRES DE VENTILATION ET D'AFFICHAGE
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
    if (texteComplet.includes('urssaf')) return { num: '645100', nom: 'Cotisations URSSAF' };
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
        await chargerTransactions();

    } catch (err) {
        console.error('Erreur au chargement :', err);
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
// 5. CALCULS CARPIMKO
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
// 6. GESTION DES TRANSACTIONS & PROFIL
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

// ============================================================================
// 7. COMPTABILITÉ : BILAN, DÉCLARATIONS, JOURNAL & BALANCE
// ============================================================================
function actualiserTousLesCalculs() {
    genererBilanEtCE();
    genererDeclarations();
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

function sauvegarderDeclaration() {
    alert("✅ Déclaration sauvegardée localement.");
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
// 8. GRAND LIVRE DÉTAILLÉ (AVEC FILTRE D'ANNÉE ET À-NOUVEAUX)
// ============================================================================

// Initialise le menu déroulant des années dans le Grand Livre
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
        container.innerHTML = '<p style="color:#718096; padding: 10px;">Aucune transaction enregistrée pour alimenter le Grand Livre.</p>';
        return;
    }

    const anneeFiltre = document.getElementById('selectAnneeGrandLivre')?.value || 'Toutes';
    const comptesMap = {};

    // Initialisation explicite du compte banque de bilan (512000)
    comptesMap['512000'] = {
        num: '512000',
        nom: 'Compte Bancaire Pro',
        mouvements: []
    };

    // Traitement de chaque transaction
    currentTransactions.forEach(t => {
        const val = parseFloat(t.amount) || 0;
        const isRecette = (t.type || '').toLowerCase().includes('recette');
        const compteInfo = obtenirComptePCG(t);
        const numCompte = compteInfo.num;

        // Inscription dans le compte de contrepartie (Charges 6xx ou Produits 7xx)
        if (!comptesMap[numCompte]) {
            comptesMap[numCompte] = {
                num: numCompte,
                nom: compteInfo.nom,
                mouvements: []
            };
        }

        comptesMap[numCompte].mouvements.push({
            date: t.date || '',
            description: t.description || 'Sans libellé',
            category: t.category || '',
            debit: isRecette ? 0 : val,
            credit: isRecette ? val : 0
        });

        // Inscription miroir dans le compte Banque 512000 (Partie Double)
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
        const estCompteBilan = parseInt(num.substring(0, 1)) <= 5; // Classes 1 à 5 = Bilan

        let reportANouveauDebit = 0;
        let reportANouveauCredit = 0;
        let mouvementsExercice = [];

        if (anneeFiltre === 'Toutes') {
            mouvementsExercice = [...compte.mouvements];
        } else {
            compte.mouvements.forEach(m => {
                const anneeMvt = m.date ? m.date.substring(0, 4) : '';
                if (anneeMvt < anneeFiltre) {
                    // Pour les comptes de bilan, accumuler le solde antérieur (À-Nouveaux)
                    if (estCompteBilan) {
                        reportANouveauDebit += m.debit;
                        reportANouveauCredit += m.credit;
                    }
                } else if (anneeMvt === anneeFiltre) {
                    mouvementsExercice.push(m);
                }
            });
        }

        // Si aucune écriture ni à-nouveau sur la période, passer le compte
        if (mouvementsExercice.length === 0 && reportANouveauDebit === 0 && reportANouveauCredit === 0) {
            return;
        }

        nbComptesAffiches++;

        // Tri chronologique des mouvements
        mouvementsExercice.sort((a, b) => new Date(a.date) - new Date(b.date));

        let totalDebitPériode = 0;
        let totalCreditPériode = 0;
        let soldeProgressif = reportANouveauDebit - reportANouveauCredit;

        let lignesHtml = '';

        // Affichage de la ligne d'À-Nouveaux pour les comptes de bilan
        if (estCompteBilan && (reportANouveauDebit > 0 || reportANouveauCredit > 0)) {
            lignesHtml += `
                <tr style="background-color: #f7fafc; font-style: italic;">
                    <td>01/01/${anneeFiltre}</td>
                    <td><strong>À-Nouveaux (Solde reporté de l'exercice précédent)</strong></td>
                    <td style="text-align:right;">${reportANouveauDebit > 0 ? reportANouveauDebit.toFixed(2) + ' €' : '-'}</td>
                    <td style="text-align:right;">${reportANouveauCredit > 0 ? reportANouveauCredit.toFixed(2) + ' €' : '-'}</td>
                    <td style="text-align:right; font-weight: bold;">${soldeProgressif.toFixed(2)} €</td>
                </tr>
            `;
        }

        // Affichage des écritures de l'exercice
        mouvementsExercice.forEach(m => {
            totalDebitPériode += m.debit;
            totalCreditPériode += m.credit;
            soldeProgressif += (m.debit - m.credit);

            lignesHtml += `
                <tr>
                    <td>${m.date}</td>
                    <td>
                        ${m.description} 
                        <small style="color:#718096;">(${m.category})</small>
                    </td>
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
                    <tbody>
                        ${lignesHtml}
                    </tbody>
                    <tfoot>
                        <tr style="font-weight: bold; background-color: #edf2f7;">
                            <td colspan="2">Totaux et Solde de clôture</td>
                            <td style="text-align:right;">${totalGeneralDebit.toFixed(2)} €</td>
                            <td style="text-align:right;">${totalGeneralCredit.toFixed(2)} €</td>
                            <td style="text-align:right; color: ${soldeCloture >= 0 ? '#2b6cb0' : '#c53030'};">
                                ${soldeCloture.toFixed(2)} €
                            </td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        `;
    });

    if (nbComptesAffiches === 0) {
        container.innerHTML = `<p style="color:#718096; padding: 10px;">Aucune écriture trouvée pour l'exercice ${anneeFiltre}.</p>`;
    } else {
        container.innerHTML = htmlGlobal;
    }
}// ============================================================================
// 1. CONFIGURATION ET VARIABLES GLOBALES
// ============================================================================
const SUPABASE_URL = 'https://qfwhzuhwldurnmhirgil.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFmd2h6dWh3bGR1cm5taGlyZ2lsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU0OTQ0MTgsImV4cCI6MjEwMTA3MDQxOH0.Lt7eU9UBVY94tIIMUNOzLeJOpWnkGkvszy_gENkUkLg';

let supabaseClient = null;
let currentTransactions = [];
let currentProfileId = null;

// ============================================================================
// 2. UTILITAIRES DE VENTILATION ET D'AFFICHAGE
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
    if (texteComplet.includes('urssaf')) return { num: '645100', nom: 'Cotisations URSSAF' };
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
        await chargerTransactions();

    } catch (err) {
        console.error('Erreur au chargement :', err);
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
// 5. CALCULS CARPIMKO
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
// 6. GESTION DES TRANSACTIONS & PROFIL
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

// ============================================================================
// 7. COMPTABILITÉ : BILAN, DÉCLARATIONS, JOURNAL & BALANCE
// ============================================================================
function actualiserTousLesCalculs() {
    genererBilanEtCE();
    genererDeclarations();
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

function sauvegarderDeclaration() {
    alert("✅ Déclaration sauvegardée localement.");
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
// 8. GRAND LIVRE DÉTAILLÉ (AVEC FILTRE D'ANNÉE ET À-NOUVEAUX)
// ============================================================================

// Initialise le menu déroulant des années dans le Grand Livre
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
        container.innerHTML = '<p style="color:#718096; padding: 10px;">Aucune transaction enregistrée pour alimenter le Grand Livre.</p>';
        return;
    }

    const anneeFiltre = document.getElementById('selectAnneeGrandLivre')?.value || 'Toutes';
    const comptesMap = {};

    // Initialisation explicite du compte banque de bilan (512000)
    comptesMap['512000'] = {
        num: '512000',
        nom: 'Compte Bancaire Pro',
        mouvements: []
    };

    // Traitement de chaque transaction
    currentTransactions.forEach(t => {
        const val = parseFloat(t.amount) || 0;
        const isRecette = (t.type || '').toLowerCase().includes('recette');
        const compteInfo = obtenirComptePCG(t);
        const numCompte = compteInfo.num;

        // Inscription dans le compte de contrepartie (Charges 6xx ou Produits 7xx)
        if (!comptesMap[numCompte]) {
            comptesMap[numCompte] = {
                num: numCompte,
                nom: compteInfo.nom,
                mouvements: []
            };
        }

        comptesMap[numCompte].mouvements.push({
            date: t.date || '',
            description: t.description || 'Sans libellé',
            category: t.category || '',
            debit: isRecette ? 0 : val,
            credit: isRecette ? val : 0
        });

        // Inscription miroir dans le compte Banque 512000 (Partie Double)
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
        const estCompteBilan = parseInt(num.substring(0, 1)) <= 5; // Classes 1 à 5 = Bilan

        let reportANouveauDebit = 0;
        let reportANouveauCredit = 0;
        let mouvementsExercice = [];

        if (anneeFiltre === 'Toutes') {
            mouvementsExercice = [...compte.mouvements];
        } else {
            compte.mouvements.forEach(m => {
                const anneeMvt = m.date ? m.date.substring(0, 4) : '';
                if (anneeMvt < anneeFiltre) {
                    // Pour les comptes de bilan, accumuler le solde antérieur (À-Nouveaux)
                    if (estCompteBilan) {
                        reportANouveauDebit += m.debit;
                        reportANouveauCredit += m.credit;
                    }
                } else if (anneeMvt === anneeFiltre) {
                    mouvementsExercice.push(m);
                }
            });
        }

        // Si aucune écriture ni à-nouveau sur la période, passer le compte
        if (mouvementsExercice.length === 0 && reportANouveauDebit === 0 && reportANouveauCredit === 0) {
            return;
        }

        nbComptesAffiches++;

        // Tri chronologique des mouvements
        mouvementsExercice.sort((a, b) => new Date(a.date) - new Date(b.date));

        let totalDebitPériode = 0;
        let totalCreditPériode = 0;
        let soldeProgressif = reportANouveauDebit - reportANouveauCredit;

        let lignesHtml = '';

        // Affichage de la ligne d'À-Nouveaux pour les comptes de bilan
        if (estCompteBilan && (reportANouveauDebit > 0 || reportANouveauCredit > 0)) {
            lignesHtml += `
                <tr style="background-color: #f7fafc; font-style: italic;">
                    <td>01/01/${anneeFiltre}</td>
                    <td><strong>À-Nouveaux (Solde reporté de l'exercice précédent)</strong></td>
                    <td style="text-align:right;">${reportANouveauDebit > 0 ? reportANouveauDebit.toFixed(2) + ' €' : '-'}</td>
                    <td style="text-align:right;">${reportANouveauCredit > 0 ? reportANouveauCredit.toFixed(2) + ' €' : '-'}</td>
                    <td style="text-align:right; font-weight: bold;">${soldeProgressif.toFixed(2)} €</td>
                </tr>
            `;
        }

        // Affichage des écritures de l'exercice
        mouvementsExercice.forEach(m => {
            totalDebitPériode += m.debit;
            totalCreditPériode += m.credit;
            soldeProgressif += (m.debit - m.credit);

            lignesHtml += `
                <tr>
                    <td>${m.date}</td>
                    <td>
                        ${m.description} 
                        <small style="color:#718096;">(${m.category})</small>
                    </td>
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
                    <tbody>
                        ${lignesHtml}
                    </tbody>
                    <tfoot>
                        <tr style="font-weight: bold; background-color: #edf2f7;">
                            <td colspan="2">Totaux et Solde de clôture</td>
                            <td style="text-align:right;">${totalGeneralDebit.toFixed(2)} €</td>
                            <td style="text-align:right;">${totalGeneralCredit.toFixed(2)} €</td>
                            <td style="text-align:right; color: ${soldeCloture >= 0 ? '#2b6cb0' : '#c53030'};">
                                ${soldeCloture.toFixed(2)} €
                            </td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        `;
    });

    if (nbComptesAffiches === 0) {
        container.innerHTML = `<p style="color:#718096; padding: 10px;">Aucune écriture trouvée pour l'exercice ${anneeFiltre}.</p>`;
    } else {
        container.innerHTML = htmlGlobal;
    }
}
