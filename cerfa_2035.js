// cerfa_2035.js - Génération et pré-remplissage automatique du Cerfa 2035-SD (2025)

async function genererEtTelechargerCerfa2035(annee = new Date().getFullYear() - 1) {
    const supabase = window.supabaseClient || (window.supabase && typeof window.supabase.from === 'function' ? window.supabase : null);
    if (!supabase) {
        alert("Erreur de connexion à la base de données.");
        return;
    }

    try {
        // 1. Récupération des données financières cumulées pour l'année ciblée
        const dateDebut = `${annee}-01-01`;
        const dateFin = `${annee}-12-31`;

        const { data: ecritures, error } = await supabase
            .from('ecritures_comptables')
            .select('*')
            .gte('date', dateDebut)
            .lte('date', dateFin);

        if (error) {
            alert("Erreur lors de la récupération des données : " + error.message);
            return;
        }

        // Calcul des totaux par préfixe de compte PCG / BNC
        let totalRecettes (706/758) = 0;
        let totalDepenses (6xx) = 0;

        (ecritures || []).forEach(e => {
            const code = String(e.compte_code || '');
            const credit = parseFloat(e.credit || 0);
            const debit = parseFloat(e.debit || 0);

            if (code.startsWith('7')) {
                totalRecettes += (credit - debit);
            } else if (code.startsWith('6')) {
                totalDepenses += (debit - credit);
            }
        });

        const beneficeOuDeficit = totalRecettes - totalDepenses;

        // 2. Chargement du document officiel Cerfa 2035-SD PDF
        // Remplace le chemin ci-dessous par l'URL ou le chemin relatif vers ton fichier cerfa 2035-sd_4981.pdf
        const urlPdfModele = './cerfa 2035-sd_4981.pdf'; 
        const existingPdfBytes = await fetch(urlPdfModele).then(res => res.arrayBuffer());

        // 3. Charger le document via PDF-Lib
        const { PDFDocument } = PDFLib;
        const pdfDoc = await PDFDocument.load(existingPdfBytes);

        // Accès aux formulaires interactifs (AcroForm)
        const form = pdfDoc.getForm();

        // 4. Remplissage des champs textuels du Cerfa 2035-SD
        // Les noms de champs dépendent du mapping interactif du fichier PDF
        const mapperChamp = (nomChamp, valeur) => {
            try {
                const field = form.getTextField(nomChamp);
                if (field) field.setText(String(valeur));
            } catch (e) {
                // Si le champ n'existe pas sous ce nom exact, on l'ignore proprement
            }
        };

        // Renseignements généraux / Profil
        const profilNom = localStorage.getItem('user_fullname') || 'NOM Prénom';
        const profilSiret = localStorage.getItem('user_siret') || '000 000 000 00000';
        const profilAdresse = localStorage.getItem('user_address') || 'Adresse du déclarant';

        mapperChamp('Nom et Prénom', profilNom);[cite: 11]
        mapperChamp('N° SIRET', profilSiret);[cite: 11]
        mapperChamp('Adresse du déclarant', profilAdresse);[cite: 11]
        mapperChamp('Période du', `01/01/${annee}`);[cite: 11]
        mapperChamp('AU', `31/12/${annee}`);[cite: 11]

        // Résultats fiscaux
        if (beneficeOuDeficit >= 0) {
            mapperChamp('Bénéfice', beneficeOuDeficit.toFixed(2));[cite: 11]
        } else {
            mapperChamp('Déficit', Math.abs(beneficeOuDeficit).toFixed(2));[cite: 11]
        }

        // Marquer la comptabilité comme informatisée
        try {
            const checkboxOuiCompta = form.getCheckBox('Oui');
            if (checkboxOuiCompta) checkboxOuiCompta.check();[cite: 11]
        } catch (e) {}

        // 5. Génération et téléchargement du PDF pré-rempli
        const pdfBytes = await pdfDoc.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `Cerfa_2035_${annee}_Rempli.pdf`;
        link.click();

        alert(`Le Cerfa 2035 pour l'année ${annee} a été généré avec succès !`);

    } catch (err) {
        console.error("Erreur génération Cerfa 2035 :", err);
        alert("Une erreur s'est produite lors du remplissage du Cerfa.");
    }
}

// Exposer la fonction au domaine global
window.genererEtTelechargerCerfa2035 = genererEtTelechargerCerfa2035;
