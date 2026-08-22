// --- MODULE JOURNAL DES OPÉRATIONS DIVERSES (OD) ---

// Charger les écritures OD depuis Supabase ou le stockage local
window.chargerJournalOD = async function() {
    const supabase = window.supabaseClient || (window.supabase && typeof window.supabase.from === 'function' ? window.supabase : null);
    let ecritures = [];

    if (supabase) {
        try {
            const { data, error } = await supabase
                .from('ecritures_comptables')
                .select('*')
                .order('date', { ascending: false });

            if (!error && data) {
                // Filtrer pour ne garder que les écritures OD si nécessaire ou afficher toutes les écritures
                ecritures = data;
            }
        } catch (err) {
            console.error("Erreur de chargement des OD :", err);
        }
    }

    window.afficherEcrituresOD(ecritures);
};

// Afficher les écritures dans le tableau du Journal OD avec boutons Modifier/Supprimer
window.afficherEcrituresOD = function(ecritures) {
    const tbody = document.getElementById('body-tableau-od');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (!ecritures || ecritures.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; color:#64748b; padding:20px;">Aucune écriture OD enregistrée.</td></tr>`;
        return;
    }

    ecritures.forEach(item => {
        const tr = document.createElement('tr');
        
        const fileLink = item.file_url || item.justificatif_url 
            ? `<a href="${item.file_url || item.justificatif_url}" target="_blank" style="color:#2563eb;">📎 Voir</a>` 
            : '-';

        tr.innerHTML = `
            <td>${item.date || ''}</td>
            <td><strong>${item.compte_debit || item.compte || ''}</strong></td>
            <td>${item.libelle_debit || item.libelle_compte || ''}</td>
            <td>${item.description || ''}</td>
            <td style="text-align: right; color:#dc2626;">${item.debit ? Number(item.debit).toFixed(2) + ' €' : '-'}</td>
            <td style="text-align: right; color:#16a34a;">${item.credit ? Number(item.credit).toFixed(2) + ' €' : '-'}</td>
            <td style="text-align: center;">${fileLink}</td>
            <td style="text-align: center; white-space: nowrap;">
                <button onclick="window.ouvrirModalModifierOD('${item.id}')" style="background:none; border:none; cursor:pointer; font-size:1.1rem; margin-right:8px;" title="Modifier">✏️</button>
                <button onclick="window.supprimerEcritureOD('${item.id}')" style="background:none; border:none; cursor:pointer; font-size:1.1rem;" title="Supprimer">🗑️</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
};

// Enregistrer une nouvelle écriture OD
window.enregistrerEcritureOD = async function(event) {
    event.preventDefault();

    const date = document.getElementById('od-date').value;
    const compteDebit = document.getElementById('od-compte-debit').value;
    const libelleDebit = document.getElementById('od-libelle-debit').value;
    const compteCredit = document.getElementById('od-compte-credit').value;
    const libelleCredit = document.getElementById('od-libelle-credit').value;
    const description = document.getElementById('od-description').value;
    const montant = parseFloat(document.getElementById('od-montant').value);

    if (!date || !compteDebit || !compteCredit || isNaN(montant)) {
        alert("Veuillez remplir correctement tous les champs obligatoires (*).");
        return;
    }

    const supabase = window.supabaseClient || (window.supabase && typeof window.supabase.from === 'function' ? window.supabase : null);

    const nouvelleEcriture = {
        date: date,
        compte_debit: compteDebit,
        libelle_debit: libelleDebit,
        compte_credit: compteCredit,
        libelle_credit: libelleCredit,
        description: description,
        debit: montant,
        credit: montant
    };

    if (supabase) {
        try {
            const { error } = await supabase.from('ecritures_comptables').insert([nouvelleEcriture]);
            if (error) throw error;
            alert("Écriture OD enregistrée avec succès !");
            document.querySelector('#vue-od form').reset();
            window.chargerJournalOD();
        } catch (err) {
            console.error("Erreur lors de l'enregistrement OD :", err);
            alert("Erreur lors de l'enregistrement dans la base de données.");
        }
    }
};

// Supprimer une écriture OD
window.supprimerEcritureOD = async function(id) {
    if (!confirm("Es-tu sûr(e) de vouloir supprimer cette écriture OD ?")) return;

    const supabase = window.supabaseClient || (window.supabase && typeof window.supabase.from === 'function' ? window.supabase : null);

    if (supabase) {
        try {
            const { error } = await supabase.from('ecritures_comptables').delete().eq('id', id);
            if (error) throw error;
            alert("Écriture supprimée.");
            window.chargerJournalOD();
        } catch (err) {
            console.error("Erreur de suppression :", err);
            alert("Impossible de supprimer l'écriture.");
        }
    }
};

// Ouvrir la modale pour modifier une écriture OD
window.ouvrirModalModifierOD = async function(id) {
    const supabase = window.supabaseClient || (window.supabase && typeof window.supabase.from === 'function' ? window.supabase : null);
    if (!supabase) return;

    try {
        const { data, error } = await supabase.from('ecritures_comptables').select('*').eq('id', id).single();
        if (error || !data) throw error;

        // Remplir la modale avec les données actuelles
        document.getElementById('edit-id').value = data.id;
        document.getElementById('edit-date').value = data.date || '';
        document.getElementById('edit-description').value = data.description || '';
        document.getElementById('edit-montant').value = data.debit || data.credit || 0;

        // Afficher la modale
        const modal = document.getElementById('modal-modifier');
        if (modal) modal.style.display = 'flex';
    } catch (err) {
        console.error("Erreur de récupération pour modification :", err);
    }
};
