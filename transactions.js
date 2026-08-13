// ------------------------------------------
// 5. ONGLET : GRAND LIVRE (Avec numéros de comptes)
// ------------------------------------------
window.afficherGrandLivre = function(transactions) {
    let conteneur = document.getElementById('grand-livre') || 
                    document.getElementById('section-grand-livre') || 
                    document.getElementById('tab-grand-livre') ||
                    document.querySelector('[data-tab="grand-livre"]');

    if (!conteneur) {
        const tousLesTitres = document.querySelectorAll('h2, h3');
        tousLesTitres.forEach(el => {
            if (el.textContent.includes('Grand Livre')) conteneur = el.parentElement;
        });
    }

    if (!conteneur) return;

    if (transactions.length === 0) {
        conteneur.innerHTML = `
            <h2 style="color:#1e293b; margin-bottom:15px;">Grand Livre</h2>
            <p style="text-align:center; color:#94a3b8; padding:20px;">Le Grand Livre est vide.</p>
        `;
        return;
    }

    // Dictionnaire des comptes du Plan Comptable
    const tablePlanComptable = {
        'urssaf': '438100 - URSSAF (Compte de tiers)',
        'carpimko': '437100 - CARPIMKO (Compte de tiers)',
        'cotisations carpimko': '437100 - CARPIMKO (Compte de tiers)',
        'soins infirmiers': '706000 - Honoraires / Soins infirmiers',
        'achats matériel': '606400 - Achats de petit matériel',
        'frais bancaires': '627000 - Services bancaires'
    };

    const groupes = {};
    const nomsCatOriginal = {};

    transactions.forEach(tx => {
        let catBrute = tx[window.schemaColonnes.categorie] || tx.categorie || tx.category || 'Non classé';
        const cleNormale = catBrute.toString().toLowerCase().replace(/\s+/g, ' ').trim();

        if (!groupes[cleNormale]) {
            groupes[cleNormale] = [];
            
            // Si le compte existe dans notre plan comptable, on l'utilise, sinon on garde le nom brut
            const compteOfficiel = tablePlanComptable[cleNormale] || catBrute.toString().replace(/\s+/g, ' ').trim();
            nomsCatOriginal[cleNormale] = compteOfficiel;
        }
        groupes[cleNormale].push(tx);
    });

    let htmlComplet = `<h2 style="color:#1e293b; margin-bottom:15px;">📖 Grand Livre des comptes</h2>`;

    Object.keys(groupes).sort().forEach(cle => {
        const nomAffiche = nomsCatOriginal[cle] || cle;
        let totalCategorie = 0;
        let lignesHtml = '';

        groupes[cle].forEach(tx => {
            const typeBrut = (tx[window.schemaColonnes.type] || tx.type || '').toString().toLowerCase();
            const estRecette = typeBrut === 'recette';

            let valeurMontant = tx[window.schemaColonnes.montant] !== undefined ? tx[window.schemaColonnes.montant] : (tx.montant || tx.amount || 0);
            if (typeof valeurMontant === 'string') valeurMontant = valeurMontant.replace(',', '.');
            const montantNum = parseFloat(valeurMontant) || 0;

            if (estRecette) totalCategorie += Math.abs(montantNum);
            else totalCategorie -= Math.abs(montantNum);

            lignesHtml += `
                <tr style="border-bottom:1px solid #f1f5f9;">
                    <td style="padding:8px 12px;">${tx[window.schemaColonnes.date] || tx.date || ''}</td>
                    <td style="padding:8px 12px;">${tx[window.schemaColonnes.description] || tx.description || ''}</td>
                    <td style="padding:8px 12px; color:${estRecette ? '#16a34a' : '#dc2626'}; font-weight:bold;">
                        ${estRecette ? '+' : '-'} ${Math.abs(montantNum).toFixed(2)} €
                    </td>
                    <td style="padding:8px 12px;">
                        <button class="btn-edit" onclick="window.ouvrirModalModification('${tx.id}')">✏️</button>
                        <button class="btn-delete" onclick="window.supprimerTransaction('${tx.id}')">🗑️</button>
                    </td>
                </tr>
            `;
        });

        const couleurTotal = totalCategorie >= 0 ? '#16a34a' : '#dc2626';

        htmlComplet += `
            <div style="margin-bottom:20px; background:#fff; border:1px solid #e2e8f0; border-radius:8px; overflow:hidden;">
                <div style="background:#f8fafc; padding:12px 16px; border-bottom:1px solid #e2e8f0; display:flex; justify-content:space-between; align-items:center;">
                    <h3 style="margin:0; font-size:1.05rem; color:#1e293b;">📂 Compte ${nomAffiche}</h3>
                    <span style="font-weight:bold; color:${couleurTotal};">Solde : ${totalCategorie.toFixed(2)} €</span>
                </div>
                <table style="width:100%; border-collapse:collapse; text-align:left;">
                    <thead>
                        <tr style="background:#f1f5f9; font-size:0.85rem; color:#64748b;">
                            <th style="padding:8px 12px;">Date</th>
                            <th style="padding:8px 12px;">Description</th>
                            <th style="padding:8px 12px;">Montant</th>
                            <th style="padding:8px 12px;">Actions</th>
                        </tr>
                    </thead>
                    <tbody>${lignesHtml}</tbody>
                </table>
            </div>
        `;
    });

    conteneur.innerHTML = htmlComplet;
};
