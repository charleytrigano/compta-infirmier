// declaration2035.js - Rendu complet 2035 + Récapitulatif 2042 C PRO + PDF Cerfa

(function () {
    window.annee2035Selectionnee = window.annee2035Selectionnee || new Date().getFullYear().toString();

    function getSupabase() {
        return window.supabaseClient || (window.supabase && typeof window.supabase.from === 'function' ? window.supabase : null);
    }

    function formatEuro(amount) {
        return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount || 0);
    }

    // --- GÉNÉRATION DU CERFA 2035 PDF ---
    async function genererEtTelechargerCerfa2035(annee, totalRecettes, totalDepenses, benefice, profilInfo) {
        if (typeof window.PDFLib === 'undefined') {
            alert("La bibliothèque PDF-Lib n'est pas chargée.");
            return;
        }

        try {
            const urlPdfModele = './cerfa_2035.pdf';
            const res = await fetch(urlPdfModele);
            if (!res.ok) throw new Error("Fichier 'cerfa_2035.pdf' introuvable.");
            
            const existingPdfBytes = await res.arrayBuffer();
            const { PDFDocument, rgb, StandardFonts } = window.PDFLib;
            const pdfDoc = await PDFDocument.load(existingPdfBytes);
            
            const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
            const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
            const page1 = pdfDoc.getPages()[0];
            const couleurBleue = rgb(0, 0.2, 0.6);

            // Extraction profil
            const nomPrenom = profilInfo.nom || localStorage.getItem('nom_complet') || '';
            const adresse = profilInfo.adresse || localStorage.getItem('adresse') || '';
            const siret = profilInfo.siret || localStorage.getItem('siret') || '';
            const email = profilInfo.email || '';
            const tel = profilInfo.tel || '';
            const activite = profilInfo.activite || '';

            // En-tête Page 1
            if (nomPrenom) page1.drawText(nomPrenom, { x: 45, y: 720, size: 9, font: fontBold, color: couleurBleue });
            if (adresse) page1.drawText(adresse, { x: 45, y: 680, size: 8, font: fontRegular, color: couleurBleue });
            if (siret) page1.drawText(siret, { x: 90, y: 602, size: 9, font: fontBold, color: couleurBleue });
            if (email) page1.drawText(email, { x: 100, y: 585, size: 8, font: fontRegular, color: couleurBleue });
            if (tel) page1.drawText(tel, { x: 110, y: 568, size: 8, font: fontRegular, color: couleurBleue });
            if (activite) page1.drawText(activite, { x: 130, y: 470, size: 8, font: fontRegular, color: couleurBleue });

            // Période exercice
            page1.drawText(`01/01/${annee}`, { x: 410, y: 393, size: 9, font: fontBold, color: couleurBleue });
            page1.drawText(`31/12/${annee}`, { x: 505, y: 393, size: 9, font: fontBold, color: couleurBleue });

            // Bénéfice / Déficit (Cadre 1)
            if (benefice >= 0) {
                page1.drawText(benefice.toFixed(2) + ' €', { x: 525, y: 350, size: 9, font: fontBold, color: couleurBleue });
            } else {
                page1.drawText(Math.abs(benefice).toFixed(2) + ' €', { x: 715, y: 350, size: 9, font: fontBold, color: couleurBleue });
            }

            const pdfBytes = await pdfDoc.save();
            const blob = new Blob([pdfBytes], { type: 'application/pdf' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `Cerfa_2035_${annee}_Rempli.pdf`;
            link.click();

        } catch (err) {
            console.error("Erreur PDF 2035 :", err);
            alert("Erreur lors de la génération du PDF : " + err.message);
        }
    }

    // --- CHARGEMENT PRINCIPAL ---
    async function chargerDeclaration2035() {
        let container = document.getElementById('vue-2035');
        if (!container) {
            const candidates = Array.from(document.querySelectorAll('div, section, main'));
            container = candidates.find(el => el.textContent.includes('Chargement de la déclaration 2035') || el.getAttribute('data-view') === '2035');
        }
        if (!container) return;

        const supabase = getSupabase();
        if (!supabase) {
            container.innerHTML = `<div style="padding:20px; color:#ef4444; text-align:center;">Erreur : Supabase indisponible.</div>`;
            return;
        }

        try {
            // 1. Récupération profil
            let profilInfo = { nom: '', adresse: '', siret: '', email: '', tel: '', activite: '' };
            const { data: authData } = await supabase.auth.getUser();
            const user = authData?.user;
            if (user) {
                profilInfo.email = user.email || '';
                const meta = user.user_metadata || {};
                profilInfo.nom = meta.full_name || meta.nom_complet || `${meta.prenom || ''} ${meta.nom || ''}`.trim();
                profilInfo.siret = meta.siret || '';
                profilInfo.adresse = meta.adresse || '';
                profilInfo.tel = meta.telephone || meta.phone || '';
                profilInfo.activite = meta.activite || meta.profession || '';
            }

            const { data: userProfil } = await supabase.from('profil').select('*').maybeSingle();
            if (userProfil) {
                if (userProfil.nom || userProfil.prenom) profilInfo.nom = `${userProfil.prenom || ''} ${userProfil.nom || ''}`.trim();
                if (userProfil.adresse) profilInfo.adresse = `${userProfil.adresse || ''} ${userProfil.code_postal || ''} ${userProfil.ville || ''}`.trim();
                if (userProfil.siret) profilInfo.siret = userProfil.siret;
                if (userProfil.email) profilInfo.email = userProfil.email;
                if (userProfil.telephone) profilInfo.tel = userProfil.telephone;
                if (userProfil.activite) profilInfo.activite = userProfil.activite;
            }

            // 2. Écritures comptables
            const { data: toutesEcritures } = await supabase.from('ecritures_comptables').select('*').order('date', { ascending: false });

            const anneesDispo = Array.from(new Set((toutesEcritures || []).map(e => e.date ? new Date(e.date).getFullYear().toString() : null).filter(Boolean))).sort((a, b) => b - a);
            if (anneesDispo.length > 0 && !anneesDispo.includes(window.annee2035Selectionnee)) {
                window.annee2035Selectionnee = anneesDispo[0];
            }
            const anneeActive = window.annee2035Selectionnee;

            const ecrituresAnnee = (toutesEcritures || []).filter(e => e.date && new Date(e.date).getFullYear().toString() === anneeActive);

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
                    const charge = debit - credit;
                    if (code === '646100' || code.includes('CARPIMKO')) bwCarpimko += charge;
                    else if (code === '646200' || code.includes('URSSAF')) bxUrssaf += charge;
                    else autresDepenses += charge;
                }
            });

            const totalRecettesAG = aaHonoraires;
            const totalDepensesCH = bwCarpimko + bxUrssaf + autresDepenses;
            const beneficeCP = totalRecettesAG - totalDepensesCH;
            const beneficeArrondi = Math.round(Math.max(0, beneficeCP));

            window.exporterCerfaActuel = () => {
                genererEtTelechargerCerfa2035(anneeActive, totalRecettesAG, totalDepensesCH, beneficeCP, profilInfo);
            };

            const optionsAnnees = (anneesDispo.length > 0 ? anneesDispo : [anneeActive]).map(a => 
                `<option value="${a}" ${a === anneeActive ? 'selected' : ''}>${a}</option>`
            ).join('');

            // Rendu HTML
            container.innerHTML = `
                <div style="background: white; border-radius: 12px; padding: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                    <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 15px; margin-bottom: 20px; padding-bottom: 16px; border-bottom: 1px solid #e2e8f0;">
                        <div>
                            <h2 style="font-size: 1.25rem; font-weight: 700; color: #1e293b; margin: 0;">📄 Déclaration 2035 & Report 2042 C PRO</h2>
                            <p style="margin: 4px 0 0 0; color: #64748b; font-size: 0.875rem;">Exercice ${anneeActive}</p>
                        </div>
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <select id="select-annee-2035" onchange="window.changerAnnee2035(this.value)" style="padding: 6px 12px; border-radius: 6px; border: 1px solid #cbd5e1; font-weight: 700;">
                                ${optionsAnnees}
                            </select>
                            <button onclick="window.exporterCerfaActuel()" style="background: #059669; color: white; border: none; padding: 8px 16px; border-radius: 8px; font-weight: 600; cursor: pointer;">
                                📄 Exporter Cerfa 2035 (PDF)
                            </button>
                        </div>
                    </div>

                    <!-- TABLEAU CERFA 2035 -->
                    <div style="margin-bottom: 24px;">
                        <h3 style="color: #1e293b; font-size: 1rem; font-weight: 700;">1. Synthèse Cerfa 2035</h3>
                        <table style="width: 100%; border-collapse: collapse; border: 1px solid #e2e8f0; font-size: 0.9rem; margin-top: 8px;">
                            <thead>
                                <tr style="background: #f8fafc; text-align: left; color: #64748b;">
                                    <th style="padding: 8px;">Cadre</th>
                                    <th style="padding: 8px;">Case</th>
                                    <th style="padding: 8px;">Libellé</th>
                                    <th style="padding: 8px; text-align: right;">Montant</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr style="border-bottom: 1px solid #f1f5f9;">
                                    <td style="padding: 8px;">Recettes</td>
                                    <td style="padding: 8px; font-weight: 700;">AA / AG</td>
                                    <td style="padding: 8px;">Honoraires encaissés / Total recettes brutes</td>
                                    <td style="padding: 8px; text-align: right; font-weight: 600;">${formatEuro(totalRecettesAG)}</td>
                                </tr>
                                <tr style="border-bottom: 1px solid #f1f5f9;">
                                    <td style="padding: 8px;">Dépenses</td>
                                    <td style="padding: 8px; font-weight: 700;">BW</td>
                                    <td style="padding: 8px;">CARPIMKO</td>
                                    <td style="padding: 8px; text-align: right;">${formatEuro(bwCarpimko)}</td>
                                </tr>
                                <tr style="border-bottom: 1px solid #f1f5f9;">
                                    <td style="padding: 8px;">Dépenses</td>
                                    <td style="padding: 8px; font-weight: 700;">BX</td>
                                    <td style="padding: 8px;">URSSAF</td>
                                    <td style="padding: 8px; text-align: right;">${formatEuro(bxUrssaf)}</td>
                                </tr>
                                <tr style="border-bottom: 1px solid #f1f5f9;">
                                    <td style="padding: 8px;">Dépenses</td>
                                    <td style="padding: 8px; font-weight: 700;">CH</td>
                                    <td style="padding: 8px;">Total des dépenses déductibles</td>
                                    <td style="padding: 8px; text-align: right; font-weight: 600;">${formatEuro(totalDepensesCH)}</td>
                                </tr>
                                <tr style="background: #f0fdf4; font-weight: 700;">
                                    <td style="padding: 8px; color: #166534;">Résultat</td>
                                    <td style="padding: 8px; color: #166534;">CP (Ligne 46)</td>
                                    <td style="padding: 8px; color: #166534;">BÉNÉFICE FISCAL</td>
                                    <td style="padding: 8px; text-align: right; color: #166534; font-size: 1rem;">${formatEuro(beneficeCP)}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <!-- MODULE REPORT 2042 C PRO -->
                    <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 16px;">
                        <h3 style="color: #1e40af; font-size: 1rem; font-weight: 700; margin: 0 0 8px 0;">
                            📌 Cases à remplir sur la 2042 C PRO (Impôt sur le revenu)
                        </h3>
                        <p style="font-size: 0.85rem; color: #1e3a8a; margin-bottom: 12px;">
                            Reportez ces données dans le cadre <strong>"Revenus non commerciaux professionnels - Régime de la déclaration contrôlée"</strong> :
                        </p>
                        <table style="width: 100%; border-collapse: collapse; background: white; border-radius: 6px; overflow: hidden; font-size: 0.9rem;">
                            <thead>
                                <tr style="background: #dbeafe; text-align: left; color: #1e40af;">
                                    <th style="padding: 8px;">Case</th>
                                    <th style="padding: 8px;">Description</th>
                                    <th style="padding: 8px; text-align: right;">Valeur à déclarer</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr style="border-bottom: 1px solid #e2e8f0;">
                                    <td style="padding: 8px; font-weight: 800; color: #1d4ed8;">5QC</td>
                                    <td style="padding: 8px;">Revenus imposables cas général (Déclarant 1)</td>
                                    <td style="padding: 8px; text-align: right; font-weight: 700; color: #0f172a;">${beneficeArrondi} €</td>
                                </tr>
                                <tr>
                                    <td style="padding: 8px; font-weight: 800; color: #1d4ed8;">5QI</td>
                                    <td style="padding: 8px;">Durée de l'exercice (en mois)</td>
                                    <td style="padding: 8px; text-align: right; font-weight: 700; color: #0f172a;">12</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            `;

        } catch (err) {
            console.error("Erreur chargement 2035:", err);
        }
    }

    window.changerAnnee2035 = function(annee) {
        window.annee2035Selectionnee = String(annee);
        chargerDeclaration2035();
    };

    window.chargerDeclaration2035 = chargerDeclaration2035;

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        setTimeout(chargerDeclaration2035, 100);
    } else {
        document.addEventListener('DOMContentLoaded', chargerDeclaration2035);
    }
})();
