// declaration2035.js - Rendu complet, filtre par année et dessin dynamique sur le Cerfa 2035 PDF

(function () {
    window.annee2035Selectionnee = window.annee2035Selectionnee || new Date().getFullYear().toString();

    function getSupabase() {
        return window.supabaseClient || (window.supabase && typeof window.supabase.from === 'function' ? window.supabase : null);
    }

    function formatEuro(amount) {
        return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount || 0);
    }

    // --- GENERATION ET REMPLISSAGE VISUEL SUR LE CERFA 2035 PDF ---
    async function genererEtTelechargerCerfa2035(annee, totalRecettes, totalDepenses, benefice) {
        if (typeof window.PDFLib === 'undefined') {
            alert("La bibliothèque PDF-Lib n'est pas chargée. Veuillez vérifier son inclusion dans votre HTML.");
            return;
        }

        try {
            const urlPdfModele = './cerfa_2035.pdf';
            const res = await fetch(urlPdfModele);
            if (!res.ok) {
                throw new Error("Impossible de trouver le fichier 'cerfa_2035.pdf' à la racine du projet.");
            }
            const existingPdfBytes = await res.arrayBuffer();

            const { PDFDocument, rgb, StandardFonts } = window.PDFLib;
            const pdfDoc = await PDFDocument.load(existingPdfBytes);
            
            const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
            const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
            const pages = pdfDoc.getPages();
            const page1 = pages[0];

            const couleurBleue = rgb(0, 0.2, 0.6); // Couleur d'écriture bleue

            // Récupération des infos du profil
            const profilNom = localStorage.getItem('user_fullname') || '';
            const profilSiret = localStorage.getItem('user_siret') || '';
            const profilAdresse = localStorage.getItem('user_address') || '';

            // --- EN-TÊTE PAGE 1 ---
            // Nom et Prénom
            if (profilNom) page1.drawText(profilNom, { x: 45, y: 725, size: 9, font: fontBold, color: couleurBleue });
            // Adresse
            if (profilAdresse) page1.drawText(profilAdresse, { x: 45, y: 685, size: 8, font: fontRegular, color: couleurBleue });
            // N° SIRET
            if (profilSiret) page1.drawText(profilSiret, { x: 110, y: 602, size: 9, font: fontBold, color: couleurBleue });

            // --- PÉRIODE DE L'EXERCICE ---
            page1.drawText(`01/01/${annee}`, { x: 410, y: 393, size: 9, font: fontBold, color: couleurBleue });
            page1.drawText(`31/12/${annee}`, { x: 505, y: 393, size: 9, font: fontBold, color: couleurBleue });

            // --- RÉCAPITULATION DES ÉLÉMENTS D'IMPOSITION (Cadre 1 - Bénéfice / Déficit) ---
            if (benefice >= 0) {
                // Case Bénéfice
                page1.drawText(benefice.toFixed(2) + ' €', { x: 525, y: 350, size: 9, font: fontBold, color: couleurBleue });
            } else {
                // Case Déficit
                page1.drawText(Math.abs(benefice).toFixed(2) + ' €', { x: 715, y: 350, size: 9, font: fontBold, color: couleurBleue });
            }

            const pdfBytes = await pdfDoc.save();
            const blob = new Blob([pdfBytes], { type: 'application/pdf' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `Cerfa_2035_${annee}_Rempli.pdf`;
            link.click();

        } catch (err) {
            console.error("Erreur génération Cerfa 2035 :", err);
            alert("Erreur lors de la génération du PDF : " + err.message);
        }
    }

    async function chargerDeclaration2035() {
        let container = document.getElementById('vue-2035');
        if (!container) {
            const candidates = Array.from(document.querySelectorAll('div, section, main'));
            container = candidates.find(el => el.textContent.includes('Chargement de la déclaration 2035') || el.getAttribute('data-view') === '2035');
        }

        if (!container) return;

        const supabase = getSupabase();
        if (!supabase) {
            container.innerHTML = `<div style="padding:20px; color:#ef4444; text-align:center;">Erreur : Connexion Supabase indisponible.</div>`;
            return;
        }

        try {
            // 1. Récupération des écritures
            const { data: toutesEcritures, error: errToutes } = await supabase
                .from('ecritures_comptables')
                .select('*')
                .order('date', { ascending: false });

            if (errToutes) {
                console.error("Erreur Supabase 2035:", errToutes);
                return;
            }

            // Extraction des années disponibles
            const anneesDispo = Array.from(new Set((toutesEcritures || []).map(e => {
                return e.date ? new Date(e.date).getFullYear().toString() : null;
            }).filter(Boolean))).sort((a, b) => b - a);

            if (anneesDispo.length > 0 && !anneesDispo.includes(window.annee2035Selectionnee)) {
                window.annee2035Selectionnee = anneesDispo[0];
            }

            const anneeActive = window.annee2035Selectionnee;

            // 2. Filtrage des écritures pour l'année active
            const ecrituresAnnee = (toutesEcritures || []).filter(e => {
                return e.date && new Date(e.date).getFullYear().toString() === anneeActive;
            });

            let aaHonoraires = 0;
            let bwCarpimko = 0;
            let bxUrssaf = 0;
            let autresDepenses = 0;

            ecrituresAnnee.forEach(row => {
                const debit = parseFloat(row.debit || 0);
                const credit = parseFloat(row.credit || 0);
                const code = String(row.compte_code || '').trim();

                if (code.startsWith('7')) {
                    aaHonoraires += (credit - debit);
                } else if (code.startsWith('6')) {
                    const montantCharge = debit - credit;
                    if (code === '646100' || code.includes('CARPIMKO')) {
                        bwCarpimko += montantCharge;
                    } else if (code === '646200' || code.includes('URSSAF')) {
                        bxUrssaf += montantCharge;
                    } else {
                        autresDepenses += montantCharge;
                    }
                }
            });

            const totalRecettesAG = aaHonoraires;
            const totalDepensesCH = bwCarpimko + bxUrssaf + autresDepenses;
            const beneficeCP = totalRecettesAG - totalDepensesCH;

            // Déclaration de la fonction d'export globale pour cette session
            window.exporterCerfaActuel = () => {
                genererEtTelechargerCerfa2035(anneeActive, totalRecettesAG, totalDepensesCH, beneficeCP);
            };

            const optionsAnnees = (anneesDispo.length > 0 ? anneesDispo : [anneeActive]).map(a => 
                `<option value="${a}" ${a === anneeActive ? 'selected' : ''}>${a}</option>`
            ).join('');

            container.innerHTML = `
                <div style="background: white; border-radius: 12px; padding: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); margin-top: 10px;">
                    <!-- En-tête avec Sélection, Impression et Génération Cerfa PDF -->
                    <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 15px; margin-bottom: 20px; padding-bottom: 16px; border-bottom: 1px solid #e2e8f0;">
                        <div>
                            <h2 style="font-size: 1.25rem; font-weight: 700; color: #1e293b; margin: 0;">
                                📄 Déclaration des Bénéfices Non Commerciaux (2035)
                            </h2>
                            <p style="margin: 4px 0 0 0; color: #64748b; font-size: 0.875rem;">
                                Régime de la déclaration contrôlée
                            </p>
                        </div>
                        
                        <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
                            <div style="display: flex; align-items: center; gap: 8px; background: #f8fafc; border: 1px solid #cbd5e1; padding: 6px 12px; border-radius: 8px;">
                                <label for="select-annee-2035" style="font-size: 0.85rem; font-weight: 700; color: #475569;">Exercice :</label>
                                <select id="select-annee-2035" onchange="window.changerAnnee2035(this.value)" style="background: white; border: 1px solid #cbd5e1; font-weight: 700; color: #0f172a; padding: 4px 8px; border-radius: 4px; cursor: pointer; outline: none;">
                                    ${optionsAnnees}
                                </select>
                            </div>

                            <button onclick="window.exporterCerfaActuel()" style="background: #059669; color: white; border: none; padding: 8px 16px; border-radius: 8px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 8px;">
                                📄 Exporter Cerfa 2035 (PDF)
                            </button>

                            <button onclick="window.print()" style="background: #4f46e5; color: white; border: none; padding: 8px 16px; border-radius: 8px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 8px;">
                                🖨️ Imprimer
                            </button>
                        </div>
                    </div>

                    <!-- I. RECETTES BRUTES -->
                    <div style="margin-bottom: 24px;">
                        <h3 style="color: #16a34a; font-size: 1rem; font-weight: 700; margin-bottom: 12px;">I. RECETTES BRUTES</h3>
                        <table style="width: 100%; border-collapse: collapse; border: 1px solid #e2e8f0; font-size: 0.9rem;">
                            <thead>
                                <tr style="background: #f8fafc; border-bottom: 1px solid #e2e8f0; text-align: left; color: #64748b;">
                                    <th style="padding: 10px; width: 60px;">Ligne</th>
                                    <th style="padding: 10px; width: 60px;">Code</th>
                                    <th style="padding: 10px;">Intitulé de la rubrique fiscale</th>
                                    <th style="padding: 10px; text-align: right; width: 140px;">Montant (€)</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr style="border-bottom: 1px solid #f1f5f9;">
                                    <td style="padding: 10px;">1</td>
                                    <td style="padding: 10px; font-weight: 700; color: #16a34a;">AA</td>
                                    <td style="padding: 10px; color: #334155;">Honoraires encaissés (y compris dépassements)</td>
                                    <td style="padding: 10px; text-align: right; font-weight: 600;">${formatEuro(aaHonoraires)}</td>
                                </tr>
                                <tr style="border-bottom: 1px solid #f1f5f9;">
                                    <td style="padding: 10px;">3</td>
                                    <td style="padding: 10px; font-weight: 700; color: #16a34a;">AC</td>
                                    <td style="padding: 10px; color: #334155;">Remboursements de frais et débours</td>
                                    <td style="padding: 10px; text-align: right; font-weight: 600;">0,00 €</td>
                                </tr>
                            </tbody>
                        </table>
                        <div style="background: #dcfce7; color: #14532d; padding: 12px 16px; border-radius: 6px; font-weight: 700; display: flex; justify-content: space-between; margin-top: 8px;">
                            <span>TOTAL DES RECETTES BRUTES (Ligne 6 / Code AG) :</span>
                            <span>${formatEuro(totalRecettesAG)}</span>
                        </div>
                    </div>

                    <!-- II. DÉPENSES PROFESSIONNELLES -->
                    <div style="margin-bottom: 24px;">
                        <h3 style="color: #dc2626; font-size: 1rem; font-weight: 700; margin-bottom: 12px;">II. DÉPENSES PROFESSIONNELLES</h3>
                        <table style="width: 100%; border-collapse: collapse; border: 1px solid #e2e8f0; font-size: 0.9rem;">
                            <thead>
                                <tr style="background: #f8fafc; border-bottom: 1px solid #e2e8f0; text-align: left; color: #64748b;">
                                    <th style="padding: 10px; width: 60px;">Ligne</th>
                                    <th style="padding: 10px; width: 60px;">Code</th>
                                    <th style="padding: 10px;">Intitulé de la rubrique fiscale</th>
                                    <th style="padding: 10px; text-align: right; width: 140px;">Montant (€)</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr style="border-bottom: 1px solid #f1f5f9;">
                                    <td style="padding: 10px;">15</td>
                                    <td style="padding: 10px; font-weight: 700; color: #dc2626;">BW</td>
                                    <td style="padding: 10px; color: #334155;">Cotisations sociales obligatoires : CARPIMKO</td>
                                    <td style="padding: 10px; text-align: right; font-weight: 600;">${formatEuro(bwCarpimko)}</td>
                                </tr>
                                <tr style="border-bottom: 1px solid #f1f5f9;">
                                    <td style="padding: 10px;">16</td>
                                    <td style="padding: 10px; font-weight: 700; color: #dc2626;">BX</td>
                                    <td style="padding: 10px; color: #334155;">Cotisations sociales obligatoires : URSSAF</td>
                                    <td style="padding: 10px; text-align: right; font-weight: 600;">${formatEuro(bxUrssaf)}</td>
                                </tr>
                            </tbody>
                        </table>
                        <div style="background: #fee2e2; color: #7f1d1d; padding: 12px 16px; border-radius: 6px; font-weight: 700; display: flex; justify-content: space-between; margin-top: 8px;">
                            <span>TOTAL DES DÉPENSES DÉDUCTIBLES (Code CH) :</span>
                            <span>${formatEuro(totalDepensesCH)}</span>
                        </div>
                    </div>

                    <!-- RÉSULTAT FISCAL -->
                    <div style="background: #f0fdf4; border: 2px solid #22c55e; color: #15803d; padding: 16px; border-radius: 8px; font-weight: 800; font-size: 1.1rem; display: flex; justify-content: space-between; align-items: center;">
                        <span>BÉNÉFICE FISCAL (${anneeActive}) - Ligne 46 / Code CP</span>
                        <span style="font-size: 1.25rem;">${formatEuro(beneficeCP)}</span>
                    </div>
                </div>
            `;

        } catch (err) {
            console.error("Erreur 2035:", err);
        }
    }

    window.changerAnnee2035 = function(annee) {
        window.annee2035Selectionnee = String(annee);
        chargerDeclaration2035();
    };

    window.chargerDeclaration2035 = chargerDeclaration2035;

    document.addEventListener('click', (e) => {
        const el = e.target.closest('button, a, div');
        if (el && el.textContent && el.textContent.trim().includes('2035')) {
            setTimeout(chargerDeclaration2035, 50);
            setTimeout(chargerDeclaration2035, 200);
        }
    });

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        setTimeout(chargerDeclaration2035, 200);
    } else {
        document.addEventListener('DOMContentLoaded', chargerDeclaration2035);
    }
})();
