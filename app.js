const SUPABASE_URL='https://qfwhzuhwldurnmhirgil.supabase.co';
const SUPABASE_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFmd2h6dWh3bGR1cm5taGlyZ2lsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU0OTQ0MTgsImV4cCI6MjEwMTA3MDQxOH0.Lt7eU9UBVY94tIIMUNOzLeJOpWnkGkvszy_gENkUkLg';
const CATEGORIES={
recette:['Soins infirmiers','Actes techniques','Indemnités kilométriques','Remplacements','Forfaits','Autres recettes'],
depense:['CARPIMKO','URSSAF','Matmut (RC Pro)','Prévoyance','Mutuelle santé','Cotisation INFIRMIERS','CSG/CRDS','Autres charges sociales','Carburant','Fournitures médicales','Matériel médical','Téléphone/Internet','Assurance professionnelle','Formation','Comptable','Entretien véhicule','Loyer cabinet','Frais bancaires','Documentation','Frais postaux','Autres dépenses']
};
const PLAN_COMPTABLE={
'Soins infirmiers':'706100',
'Actes techniques':'706200',
'Indemnités kilométriques':'706300',
'Remplacements':'706400',
'Forfaits':'706500',
'Autres recettes':'708000',
'Carburant':'606100',
'Fournitures médicales':'606200',
'Téléphone/Internet':'626000',
'Assurance professionnelle':'616000',
'Formation':'618500',
'Comptable':'622600',
'Entretien véhicule':'615500',
'Loyer cabinet':'613000',
'Frais bancaires':'627000',
'Documentation':'618100',
'Frais postaux':'626100',
'Matériel médical':'606300',
'CARPIMKO':'646100',
'URSSAF':'646200',
'Matmut (RC Pro)':'616100',
'Prévoyance':'616200',
'Mutuelle santé':'616300',
'Cotisation INFIRMIERS':'646300',
'CSG/CRDS':'646400',
'Autres charges sociales':'646000',
'Autres dépenses':'628000'
};
let profile=null,transactions=[],allTransactions=[],attachedFiles=[],socialDocs=[],currentExercice='',recurrents=[],bankOps=[];

function fmt(n){return n.toLocaleString('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2})+' €'}

async function api(e,t={}){const a=await fetch(`${SUPABASE_URL}/rest/v1/${e}`,{...t,headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${SUPABASE_KEY}`,'Content-Type':'application/json',Prefer:'return=representation',...t.headers}});if(!a.ok)throw new Error(await a.text());const r=await a.text();return r?JSON.parse(r):null}

async function uploadFile(file,transactionId){
const path=`${transactionId}/${Date.now()}_${file.name}`;
const res=await fetch(`${SUPABASE_URL}/storage/v1/object/justificatifs/${path}`,{method:'POST',headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${SUPABASE_KEY}`},body:file});
if(!res.ok)throw new Error('Upload failed');
return{storage_path:path,file_name:file.name,file_type:file.type,file_size:file.size};
}

async function init(){
try{
showMessage('⏳ Connexion à Supabase...','warning');
const profiles=await api('profile?select=*');
if(profiles&&profiles.length>0){
profile=profiles[0];
Object.keys(profile).forEach(key=>{
const el=document.getElementById(key);
if(el)el.value=profile[key]||'';
});
updateExerciceSelect();
}
allTransactions=await api('transactions?select=*&order=date.desc')||[];
transactions=allTransactions;
recurrents=JSON.parse(localStorage.getItem('recurrents')||'[]');
bankOps=JSON.parse(localStorage.getItem('bankOps')||'[]');

// Afficher l'app EN PREMIER
document.getElementById('loading').classList.add('hidden');
document.getElementById('app').classList.remove('hidden');
// Forcer l'affichage de l'onglet opérations
document.querySelectorAll('[id^="tab-"]').forEach(t=>t.classList.add('hidden'));
document.getElementById('tab-operations').classList.remove('hidden');
document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
document.querySelector('[onclick*="operations"]').classList.add('active');
document.getElementById('syncStatus').textContent='✅ '+allTransactions.length+' opérations';

// Puis remplir les onglets
try{displayTransactions();}catch(e){console.error('displayTransactions:',e);}
try{displayRecurrents();}catch(e){console.error('displayRecurrents:',e);}
try{displayBankOps();}catch(e){console.error('displayBankOps:',e);}
try{updateStats();}catch(e){console.error('updateStats:',e);}
try{updateCategories();}catch(e){console.error('updateCategories:',e);}
try{checkRecurrents();}catch(e){console.error('checkRecurrents:',e);}
try{chargerBareme(true);}catch(e){console.error('chargerBareme:',e);}
showMessage('✅ Connecté - '+allTransactions.length+' opérations chargées','success');
}catch(error){
document.getElementById('loading').innerHTML=`
<div style="text-align:center;padding:2rem;">
<p style="font-size:1.5rem;margin-bottom:1rem;">❌ Erreur de connexion</p>
<p style="color:#666;margin-bottom:1rem;">${error.message}</p>
<p style="color:#999;font-size:0.85rem;">Vérifiez votre connexion internet et que Supabase est actif</p>
<button onclick="init()" style="margin-top:1rem;padding:0.75rem 2rem;background:#0A7373;color:white;border:none;border-radius:8px;cursor:pointer;font-size:1rem;">🔄 Réessayer</button>
</div>`;
}
}

function updateExerciceSelect(){
const select=document.getElementById('exerciceSelect');
select.innerHTML='<option value="">Toutes les périodes</option>';
if(profile&&profile.exercice_debut&&profile.exercice_fin){
const debut=profile.exercice_debut;
const fin=profile.exercice_fin;
select.innerHTML+=`<option value="${debut}|${fin}">Exercice ${debut} - ${fin}</option>`;
}
}

function filterByExercice(){
const val=document.getElementById('exerciceSelect').value;
if(!val){
transactions=allTransactions;
currentExercice='';
}else{
const[debut,fin]=val.split('|');
transactions=allTransactions.filter(t=>t.date>=debut&&t.date<=fin);
currentExercice=`${debut}_${fin}`;
}
displayTransactions();
updateStats();
}

async function saveProfile(){
const data={nom:document.getElementById('nom').value,prenom:document.getElementById('prenom').value,siret:document.getElementById('siret').value,rpps:document.getElementById('rpps').value,adeli:document.getElementById('adeli').value,num_urssaf:document.getElementById('num_urssaf').value,adresse:document.getElementById('adresse').value,code_postal:document.getElementById('code_postal').value,ville:document.getElementById('ville').value,telephone:document.getElementById('telephone').value,email:document.getElementById('email').value,comptable_cabinet:document.getElementById('comptable_cabinet').value,comptable_adresse:document.getElementById('comptable_adresse').value,comptable_tel:document.getElementById('comptable_tel').value,comptable_email:document.getElementById('comptable_email').value};
try{
if(profile){await api(`profile?id=eq.${profile.id}`,{method:'PATCH',body:JSON.stringify(data)})}
else{profile=(await api('profile',{method:'POST',body:JSON.stringify(data)}))[0]}
showMessage('✅ Profil enregistré','success');
}catch(error){showMessage('❌ '+error.message,'error')}
}

async function saveExercice(){
const data={exercice_debut:document.getElementById('exercice_debut').value,exercice_fin:document.getElementById('exercice_fin').value};
try{
await api(`profile?id=eq.${profile.id}`,{method:'PATCH',body:JSON.stringify(data)});
profile={...profile,...data};
updateExerciceSelect();
showMessage('✅ Exercice enregistré','success');
}catch(error){showMessage('❌ '+error.message,'error')}
}

async function addTransaction(){
const data={date:document.getElementById('date').value,type:document.getElementById('type').value,category:document.getElementById('category').value,description:document.getElementById('description').value,amount:parseFloat(document.getElementById('amount').value),payment_method:document.getElementById('paymentMethod').value,has_attachments:attachedFiles.length>0,encaisse:false};
try{
const transaction=(await api('transactions',{method:'POST',body:JSON.stringify(data)}))[0];
for(const file of attachedFiles){
const fileData=await uploadFile(file,transaction.id);
await api('attachments',{method:'POST',body:JSON.stringify({transaction_id:transaction.id,...fileData})});
}
allTransactions.unshift(transaction);
transactions=allTransactions;
displayTransactions();
updateStats();
document.getElementById('description').value='';
document.getElementById('amount').value='';
document.getElementById('filePreview').innerHTML='';
attachedFiles=[];
showMessage('✅ Opération ajoutée','success');
}catch(error){showMessage('❌ '+error.message,'error')}
}

function previewFiles(){
const files=document.getElementById('fileInput').files;
attachedFiles=Array.from(files);
const preview=document.getElementById('filePreview');
preview.innerHTML='';
attachedFiles.forEach(file=>{
if(file.type.startsWith('image/')){
const img=document.createElement('img');
img.src=URL.createObjectURL(file);
preview.appendChild(img);
}else{
const div=document.createElement('div');
div.textContent=`📄 ${file.name}`;
div.style.padding='0.5rem';
preview.appendChild(div);
}
});
}

function updateCategories(){
const type=document.getElementById('type').value;
const select=document.getElementById('category');
const recurSelect=document.getElementById('recurCategory');
select.innerHTML=CATEGORIES[type].map(c=>`<option>${c}</option>`).join('');
if(recurSelect)recurSelect.innerHTML=CATEGORIES.depense.map(c=>`<option>${c}</option>`).join('');
}

function displayTransactions(){
const html=transactions.map(t=>`
<div class="transaction ${t.type} ${t.encaisse?'encaisse':''}">
<div class="transaction-actions">
${t.type==='recette'&&!t.encaisse?`<button class="btn-success" onclick="marquerEncaisse('${t.id}')" style="margin-right:0.5rem;">✓ Encaisser</button>`:''}
<button class="btn-danger" onclick="deleteTransaction('${t.id}')">🗑️</button>
</div>
<strong>${t.date}</strong> | ${t.category}<br>${t.description}<br>
<span style="color:${t.type==='recette'?'#34A853':'#F28B82'};font-weight:bold;font-size:1.2rem;">${t.type==='recette'?'+':'-'}${fmt(t.amount)}</span> 
${t.has_attachments?'📎':''}
${t.encaisse?'<span style="color:#34A853;font-weight:bold;margin-left:1rem;">✓ Encaissé</span>':''}
</div>
`).join('');
document.getElementById('transactions').innerHTML=html||'<p style="color:#999;">Aucune opération</p>';
}

async function marquerEncaisse(id){
try{
await api(`transactions?id=eq.${id}`,{method:'PATCH',body:JSON.stringify({encaisse:true})});
const t=allTransactions.find(t=>t.id===id);
if(t){
t.encaisse=true;
bankOps.push({id,date:new Date().toISOString().split('T')[0],desc:t.description,amount:t.amount});
localStorage.setItem('bankOps',JSON.stringify(bankOps));
}
displayTransactions();
displayBankOps();
updateStats();
showMessage('✅ Marqué comme encaissé','success');
}catch(error){showMessage('❌ '+error.message,'error')}
}

function displayBankOps(){
const nonEnc=allTransactions.filter(t=>t.type==='recette'&&!t.encaisse);
const html1=nonEnc.map(t=>`
<div class="bank-operation">
<div><strong>${t.date}</strong> - ${t.description}<br><small>${t.category}</small></div>
<div style="text-align:right;">
<strong style="color:#34A853;">${fmt(t.amount)}</strong><br>
<button class="btn-success" onclick="marquerEncaisse('${t.id}')">✓ Encaisser</button>
</div>
</div>
`).join('');
document.getElementById('nonEncaisses').innerHTML=html1||'<p style="color:#999;">Tout est encaissé !</p>';

const html2=bankOps.slice(0,10).map(op=>`
<div class="bank-operation">
<div><strong>${op.date}</strong> - ${op.desc}</div>
<div><strong style="color:#34A853;">${fmt(op.amount)}</strong></div>
</div>
`).join('');
document.getElementById('encaissements').innerHTML=html2||'<p style="color:#999;">Aucun encaissement</p>';

const solde=bankOps.reduce((s,op)=>s+op.amount,0);
document.getElementById('soldeBanque').textContent=fmt(solde);
}

function addRecurrent(){
const recur={
category:document.getElementById('recurCategory').value,
description:document.getElementById('recurDescription').value,
amount:parseFloat(document.getElementById('recurAmount').value),
day:parseInt(document.getElementById('recurDay').value)
};
recurrents.push(recur);
localStorage.setItem('recurrents',JSON.stringify(recurrents));
document.getElementById('recurDescription').value='';
document.getElementById('recurAmount').value='';
document.getElementById('recurDay').value='';
displayRecurrents();
showMessage('✅ Récurrence ajoutée','success');
}

function displayRecurrents(){
const html=recurrents.map((r,i)=>`
<div class="recurrent-item">
<div><strong>${r.description}</strong><br>
<small>${r.category} - ${fmt(r.amount)} - Jour ${r.day} du mois</small></div>
<button class="btn-danger" onclick="deleteRecurrent(${i})">🗑️</button>
</div>
`).join('');
document.getElementById('recurrentsList').innerHTML=html||'<p style="color:#999;">Aucune récurrence</p>';
}

function deleteRecurrent(i){
recurrents.splice(i,1);
localStorage.setItem('recurrents',JSON.stringify(recurrents));
displayRecurrents();
showMessage('✅ Récurrence supprimée','success');
}

async function checkRecurrents(){
const today=new Date();
const day=today.getDate();
for(const r of recurrents){
if(r.day===day){
const thisMonth=today.toISOString().substring(0,7);
const exists=allTransactions.some(t=>t.description===r.description&&t.date.startsWith(thisMonth));
if(!exists){
const data={date:today.toISOString().split('T')[0],type:'depense',category:r.category,description:r.description,amount:r.amount,payment_method:'Virement',has_attachments:false};
try{
const transaction=(await api('transactions',{method:'POST',body:JSON.stringify(data)}))[0];
allTransactions.unshift(transaction);
transactions=allTransactions;
displayTransactions();
updateStats();
showMessage(`✅ Dépense automatique: ${r.description}`,'success');
}catch(error){console.error(error)}
}
}
}
}

async function deleteTransaction(id){
if(!confirm('Supprimer ?'))return;
try{
await api(`transactions?id=eq.${id}`,{method:'DELETE'});
allTransactions=allTransactions.filter(t=>t.id!==id);
transactions=allTransactions;
displayTransactions();
updateStats();
showMessage('✅ Supprimé','success');
}catch(error){showMessage('❌ '+error.message,'error')}
}

function updateStats(){
const recettes=transactions.filter(t=>t.type==='recette').reduce((s,t)=>s+t.amount,0);
const depenses=transactions.filter(t=>t.type==='depense').reduce((s,t)=>s+t.amount,0);
document.getElementById('statRecettes').textContent=fmt(recettes);
document.getElementById('statDepenses').textContent=fmt(depenses);
document.getElementById('statBalance').textContent=fmt(recettes-depenses);
document.getElementById('statNb').textContent=transactions.length;
updateChart();
}

function updateChart(){
try{
const ctx=document.getElementById('chart');
if(!ctx)return;
if(window.myChart)window.myChart.destroy();
const months={};
transactions.forEach(t=>{
const month=t.date.substring(0,7);
if(!months[month])months[month]={recettes:0,depenses:0};
if(t.type==='recette')months[month].recettes+=t.amount;
else months[month].depenses+=t.amount;
});
const labels=Object.keys(months).sort();
const recettes=labels.map(m=>months[m].recettes);
const depenses=labels.map(m=>months[m].depenses);
if(typeof Chart==='undefined')return;
window.myChart=new Chart(ctx,{type:'bar',data:{labels,datasets:[{label:'Recettes',data:recettes,backgroundColor:'#34A853'},{label:'Dépenses',data:depenses,backgroundColor:'#F28B82'}]},options:{responsive:true,maintainAspectRatio:true}});
}catch(e){console.warn('Chart error:',e);}
}

function exportFECPro(){
const wb=XLSX.utils.book_new();
const data=[['JournalCode','JournalLib','EcritureNum','EcritureDate','CompteNum','CompteLib','CompAuxNum','CompAuxLib','PieceRef','PieceDate','EcritureLib','Debit','Credit','EcritureLet','DateLet','ValidDate','Montantdevise','Idevise']];
transactions.forEach((t,i)=>{
const compte=PLAN_COMPTABLE[t.category]||'708000';
const montant=t.amount.toFixed(2);
const date=t.date.replace(/-/g,'');
if(t.type==='recette'){
data.push(['VE','Ventes',i+1,date,compte,t.category,'','',t.id,date,t.description,montant,'0','','','','','']);
data.push(['VE','Ventes',i+1,date,'411000','Clients','','',t.id,date,t.description,'0',montant,'','','','','']);
}else{
data.push(['AC','Achats',i+1,date,compte,t.category,'','',t.id,date,t.description,montant,'0','','','','','']);
data.push(['AC','Achats',i+1,date,'401000','Fournisseurs','','',t.id,date,t.description,'0',montant,'','','','','']);
}
});
const ws=XLSX.utils.aoa_to_sheet(data);
ws['!cols']=[{wch:10},{wch:15},{wch:10},{wch:10},{wch:10},{wch:25},{wch:10},{wch:15},{wch:15},{wch:10},{wch:30},{wch:12},{wch:12},{wch:5},{wch:10},{wch:10},{wch:10},{wch:5}];
XLSX.utils.book_append_sheet(wb,ws,'FEC');
const filename=currentExercice?`FEC_${currentExercice}.xlsx`:`FEC_${new Date().toISOString().split('T')[0]}.xlsx`;
XLSX.writeFile(wb,filename);
showMessage('✅ FEC professionnel téléchargé','success');
}

function exportGrandLivrePro(){
const wb=XLSX.utils.book_new();
const comptes={};
transactions.forEach(t=>{
const compte=PLAN_COMPTABLE[t.category]||'708000';
if(!comptes[compte])comptes[compte]={lib:t.category,ops:[]};
comptes[compte].ops.push({date:t.date,lib:t.description,debit:t.type==='depense'?t.amount:0,credit:t.type==='recette'?t.amount:0});
});
Object.keys(comptes).sort().forEach(num=>{
const c=comptes[num];
const data=[[`COMPTE ${num} - ${c.lib.toUpperCase()}`],[],['Date','Libellé','Débit','Crédit','Solde']];
let solde=0;
c.ops.forEach(op=>{
solde+=op.credit-op.debit;
data.push([op.date,op.lib,op.debit?op.debit.toFixed(2):'',op.credit?op.credit.toFixed(2):'',solde.toFixed(2)]);
});
data.push([],[`SOLDE FINAL: ${solde.toFixed(2)} €`]);
const ws=XLSX.utils.aoa_to_sheet(data);
ws['!cols']=[{wch:12},{wch:40},{wch:15},{wch:15},{wch:15}];
const range=XLSX.utils.decode_range(ws['!ref']);
for(let R=0;R<=range.e.r;R++){
for(let C=0;C<=range.e.c;C++){
const cell_address={c:C,r:R};
const cell_ref=XLSX.utils.encode_cell(cell_address);
if(!ws[cell_ref])continue;
if(R===0||R===2||R===range.e.r-1){ws[cell_ref].s={font:{bold:true},fill:{fgColor:{rgb:"34A853"}},alignment:{horizontal:"center"}}}
if(R>2&&R<range.e.r-1&&(C===2||C===3||C===4)){ws[cell_ref].z='#,##0.00 "€"'}
}
}
XLSX.utils.book_append_sheet(wb,ws,num.substring(0,30));
});
const filename=currentExercice?`GrandLivre_${currentExercice}.xlsx`:`GrandLivre_${new Date().toISOString().split('T')[0]}.xlsx`;
XLSX.writeFile(wb,filename);
showMessage('✅ Grand livre professionnel téléchargé','success');
}

function exportBalancePro(){
const data=[['N° Compte','Libellé','Total Débit','Total Crédit','Solde']];
const comptes={};
transactions.forEach(t=>{
const compte=PLAN_COMPTABLE[t.category]||'708000';
if(!comptes[compte])comptes[compte]={lib:t.category,debit:0,credit:0};
if(t.type==='depense')comptes[compte].debit+=t.amount;
else comptes[compte].credit+=t.amount;
});
Object.keys(comptes).sort().forEach(num=>{
const c=comptes[num];
const solde=c.credit-c.debit;
data.push([num,c.lib,c.debit.toFixed(2),c.credit.toFixed(2),solde.toFixed(2)]);
});
const totD=Object.values(comptes).reduce((s,c)=>s+c.debit,0);
const totC=Object.values(comptes).reduce((s,c)=>s+c.credit,0);
data.push(['','TOTAUX',totD.toFixed(2),totC.toFixed(2),(totC-totD).toFixed(2)]);
const ws=XLSX.utils.aoa_to_sheet(data);
ws['!cols']=[{wch:12},{wch:30},{wch:18},{wch:18},{wch:18}];
const range=XLSX.utils.decode_range(ws['!ref']);
for(let R=0;R<=range.e.r;R++){
for(let C=0;C<=range.e.c;C++){
const cell_address={c:C,r:R};
const cell_ref=XLSX.utils.encode_cell(cell_address);
if(!ws[cell_ref])continue;
if(R===0||R===range.e.r){ws[cell_ref].s={font:{bold:true,color:{rgb:"FFFFFF"}},fill:{fgColor:{rgb:"0A7373"}},alignment:{horizontal:"center"}}}
if(R>0&&(C===2||C===3||C===4)){ws[cell_ref].z='#,##0.00 "€"'}
}
}
const wb=XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb,ws,'Balance');
const filename=currentExercice?`Balance_${currentExercice}.xlsx`:`Balance_${new Date().toISOString().split('T')[0]}.xlsx`;
XLSX.writeFile(wb,filename);
showMessage('✅ Balance professionnelle téléchargée','success');
}

function exportCompletComptable(){
showMessage('⏳ Génération du dossier comptable...','warning');
const wb=XLSX.utils.book_new();
const periode=currentExercice?currentExercice.replace('_',' au '):`Période complète`;
const nom=profile?`${profile.prenom} ${profile.nom}`:'';
const siret=profile?`SIRET: ${profile.siret}`:'';
const fmt=n=>parseFloat(n).toLocaleString('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2});
const totRec=transactions.filter(t=>t.type==='recette').reduce((s,t)=>s+t.amount,0);
const totDep=transactions.filter(t=>t.type==='depense').reduce((s,t)=>s+t.amount,0);

// ══════════════════════════════════════
// ONGLET 1 : RÉSUMÉ
// ══════════════════════════════════════
const resume=[
['DOSSIER COMPTABLE - INFIRMIER LIBÉRAL'],
[nom],[siret],[`Période: ${periode}`],[],
['SYNTHÈSE'],
['Total Recettes',fmt(totRec)+' €'],
['Total Dépenses',fmt(totDep)+' €'],
['Résultat (Recettes - Dépenses)',fmt(totRec-totDep)+' €'],
['Nombre d\'opérations',transactions.length],[],
['CONTENU DU DOSSIER'],
['1. Résumé (cette feuille)'],
['2. Compte d\'Exploitation (CE)'],
['3. Journal des Recettes'],
['4. Journal des Dépenses'],
['5. Journal de Banque'],
['6. Grand Livre (toutes écritures)'],
['7. Balance des comptes'],
['8. FEC (norme fiscale)'],
];
const wsResume=XLSX.utils.aoa_to_sheet(resume);
wsResume['!cols']=[{wch:35},{wch:20}];
XLSX.utils.book_append_sheet(wb,wsResume,'Résumé');

// ══════════════════════════════════════
// ONGLET 2 : COMPTE D'EXPLOITATION (CE)
// ══════════════════════════════════════
const parCat={};
transactions.forEach(t=>{
if(!parCat[t.type]) parCat[t.type]={};
if(!parCat[t.type][t.category]) parCat[t.type][t.category]=0;
parCat[t.type][t.category]+=t.amount;
});

const dataCE=[
['COMPTE D\'EXPLOITATION'],
[nom],[siret],[`Période: ${periode}`],[],
['══════════════════════════════════════════'],
['PRODUITS (RECETTES)'],
['══════════════════════════════════════════'],
['Catégorie','Montant','%'],
];
const recettes=parCat['recette']||{};
Object.entries(recettes).sort((a,b)=>b[1]-a[1]).forEach(([cat,mt])=>{
dataCE.push([cat,fmt(mt)+' €',totRec>0?(mt/totRec*100).toFixed(1)+'%':'']);
});
dataCE.push(['TOTAL PRODUITS',fmt(totRec)+' €','100%']);
dataCE.push([]);
dataCE.push(['══════════════════════════════════════════']);
dataCE.push(['CHARGES (DÉPENSES)']);
dataCE.push(['══════════════════════════════════════════']);
dataCE.push(['Catégorie','Montant','% des recettes']);
const depenses=parCat['depense']||{};
Object.entries(depenses).sort((a,b)=>b[1]-a[1]).forEach(([cat,mt])=>{
dataCE.push([cat,fmt(mt)+' €',totRec>0?(mt/totRec*100).toFixed(1)+'%':'']);
});
dataCE.push(['TOTAL CHARGES',fmt(totDep)+' €',totRec>0?(totDep/totRec*100).toFixed(1)+'%':'']);
dataCE.push([]);
dataCE.push(['══════════════════════════════════════════']);
dataCE.push(['RÉSULTAT NET']);
dataCE.push(['══════════════════════════════════════════']);
dataCE.push(['Résultat (Produits - Charges)',fmt(totRec-totDep)+' €','']);
dataCE.push(['Taux de marge',totRec>0?((totRec-totDep)/totRec*100).toFixed(1)+'%':'','']);
const wsCE=XLSX.utils.aoa_to_sheet(dataCE);
wsCE['!cols']=[{wch:35},{wch:18},{wch:15}];
XLSX.utils.book_append_sheet(wb,wsCE,'Compte d\'Exploitation');

// ══════════════════════════════════════
// ONGLET 3 : JOURNAL DES RECETTES
// ══════════════════════════════════════
const txRec=transactions.filter(t=>t.type==='recette').sort((a,b)=>a.date.localeCompare(b.date));
const dataJR=[
['JOURNAL DES RECETTES'],
[nom],[siret],[`Période: ${periode}`],[],
['N°','Date','Description','Catégorie','Compte','Montant HT','Mode paiement'],
];
txRec.forEach((t,i)=>{
dataJR.push([i+1,t.date,t.description,t.category,PLAN_COMPTABLE[t.category]||'706100',fmt(t.amount)+' €',t.payment_method||'']);
});
dataJR.push([]);
dataJR.push(['','','','','TOTAL',fmt(totRec)+' €','']);
const wsJR=XLSX.utils.aoa_to_sheet(dataJR);
wsJR['!cols']=[{wch:5},{wch:12},{wch:35},{wch:25},{wch:10},{wch:15},{wch:15}];
XLSX.utils.book_append_sheet(wb,wsJR,'Journal Recettes');

// ══════════════════════════════════════
// ONGLET 4 : JOURNAL DES DÉPENSES
// ══════════════════════════════════════
const txDep=transactions.filter(t=>t.type==='depense').sort((a,b)=>a.date.localeCompare(b.date));
const dataJD=[
['JOURNAL DES DÉPENSES'],
[nom],[siret],[`Période: ${periode}`],[],
['N°','Date','Description','Catégorie','Compte','Montant','Mode paiement'],
];
txDep.forEach((t,i)=>{
dataJD.push([i+1,t.date,t.description,t.category,PLAN_COMPTABLE[t.category]||'628000',fmt(t.amount)+' €',t.payment_method||'']);
});
dataJD.push([]);
dataJD.push(['','','','','TOTAL',fmt(totDep)+' €','']);
const wsJD=XLSX.utils.aoa_to_sheet(dataJD);
wsJD['!cols']=[{wch:5},{wch:12},{wch:35},{wch:25},{wch:10},{wch:15},{wch:15}];
XLSX.utils.book_append_sheet(wb,wsJD,'Journal Dépenses');

// ══════════════════════════════════════
// ONGLET 5 : JOURNAL DE BANQUE
// ══════════════════════════════════════
const txBanque=transactions.filter(t=>t.encaisse).sort((a,b)=>a.date.localeCompare(b.date));
const totBanque=txBanque.reduce((s,t)=>s+(t.type==='recette'?t.amount:-t.amount),0);
const dataJB=[
['JOURNAL DE BANQUE'],
[nom],[siret],[`Période: ${periode}`],[],
['N°','Date','Description','Débit','Crédit','Solde cumulé'],
];
let soldeCumul=0;
txBanque.forEach((t,i)=>{
const debit=t.type==='depense'?t.amount:0;
const credit=t.type==='recette'?t.amount:0;
soldeCumul+=credit-debit;
dataJB.push([i+1,t.date,t.description,debit?fmt(debit)+' €':'',credit?fmt(credit)+' €':'',fmt(soldeCumul)+' €']);
});
dataJB.push([]);
dataJB.push(['','','SOLDE FINAL','','',fmt(soldeCumul)+' €']);
const wsJB=XLSX.utils.aoa_to_sheet(dataJB);
wsJB['!cols']=[{wch:5},{wch:12},{wch:35},{wch:15},{wch:15},{wch:15}];
XLSX.utils.book_append_sheet(wb,wsJB,'Journal Banque');

// ══════════════════════════════════════
// ONGLET 6 : GRAND LIVRE (consolidé)
// ══════════════════════════════════════
const txTri=transactions.slice().sort((a,b)=>a.date.localeCompare(b.date));
const dataGL=[
['GRAND LIVRE - TOUTES ÉCRITURES'],
[nom],[siret],[`Période: ${periode}`],[],
['Date','N° Compte','Libellé compte','Description','Débit','Crédit','Solde cumulé'],
];
let soldeGL=0;
// Regrouper par compte puis par date
const comptesGL={};
txTri.forEach(t=>{
const compte=PLAN_COMPTABLE[t.category]||'628000';
if(!comptesGL[compte])comptesGL[compte]={lib:t.category,ops:[]};
comptesGL[compte].ops.push(t);
});
Object.keys(comptesGL).sort().forEach(num=>{
const c=comptesGL[num];
dataGL.push([`── COMPTE ${num} - ${c.lib.toUpperCase()} ──`,'','','','','','']);
let soldeCompte=0;
c.ops.forEach(t=>{
const d=t.type==='depense'?t.amount:0;
const cr=t.type==='recette'?t.amount:0;
soldeCompte+=cr-d;
soldeGL+=cr-d;
dataGL.push([t.date,num,c.lib,t.description,d?fmt(d)+' €':'',cr?fmt(cr)+' €':'',fmt(soldeCompte)+' €']);
});
dataGL.push(['','','','Solde compte '+num,'',fmt(soldeCompte)+' €','']);
dataGL.push([]);
});
const wsGL=XLSX.utils.aoa_to_sheet(dataGL);
wsGL['!cols']=[{wch:12},{wch:10},{wch:25},{wch:35},{wch:15},{wch:15},{wch:15}];
XLSX.utils.book_append_sheet(wb,wsGL,'Grand Livre');

// ══════════════════════════════════════
// ONGLET 7 : BALANCE
// ══════════════════════════════════════
const dataBalance=[['BALANCE DES COMPTES'],[nom],[siret],[`Période: ${periode}`],[],
['N° Compte','Libellé','Total Débit','Total Crédit','Solde']];
const comptesB={};
transactions.forEach(t=>{
const compte=PLAN_COMPTABLE[t.category]||'708000';
if(!comptesB[compte])comptesB[compte]={lib:t.category,debit:0,credit:0};
if(t.type==='depense')comptesB[compte].debit+=t.amount;
else comptesB[compte].credit+=t.amount;
});
Object.keys(comptesB).sort().forEach(num=>{
const c=comptesB[num];
dataBalance.push([num,c.lib,fmt(c.debit)+' €',fmt(c.credit)+' €',fmt(c.credit-c.debit)+' €']);
});
const totD=Object.values(comptesB).reduce((s,c)=>s+c.debit,0);
const totC=Object.values(comptesB).reduce((s,c)=>s+c.credit,0);
dataBalance.push(['','TOTAUX',fmt(totD)+' €',fmt(totC)+' €',fmt(totC-totD)+' €']);
const wsBalance=XLSX.utils.aoa_to_sheet(dataBalance);
wsBalance['!cols']=[{wch:12},{wch:30},{wch:18},{wch:18},{wch:18}];
XLSX.utils.book_append_sheet(wb,wsBalance,'Balance');

// ══════════════════════════════════════
// ONGLET 8 : FEC
// ══════════════════════════════════════
const dataFEC=[['JournalCode','JournalLib','EcritureNum','EcritureDate','CompteNum','CompteLib','CompAuxNum','CompAuxLib','PieceRef','PieceDate','EcritureLib','Debit','Credit','EcritureLet','DateLet','ValidDate','Montantdevise','Idevise']];
transactions.forEach((t,i)=>{
const compte=PLAN_COMPTABLE[t.category]||'708000';
const montant=t.amount.toFixed(2);
const date=t.date.replace(/-/g,'');
if(t.type==='recette'){
dataFEC.push(['VE','Ventes',i+1,date,compte,t.category,'','',t.id,date,t.description,montant,'0','','','','','']);
dataFEC.push(['VE','Ventes',i+1,date,'411000','Clients','','',t.id,date,t.description,'0',montant,'','','','','']);
}else{
dataFEC.push(['AC','Achats',i+1,date,compte,t.category,'','',t.id,date,t.description,montant,'0','','','','','']);
dataFEC.push(['AC','Achats',i+1,date,'401000','Fournisseurs','','',t.id,date,t.description,'0',montant,'','','','','']);
}
});
const wsFEC=XLSX.utils.aoa_to_sheet(dataFEC);
wsFEC['!cols']=[{wch:10},{wch:15},{wch:10},{wch:10},{wch:10},{wch:25},{wch:10},{wch:15},{wch:15},{wch:10},{wch:30},{wch:12},{wch:12},{wch:5},{wch:10},{wch:10},{wch:10},{wch:5}];
XLSX.utils.book_append_sheet(wb,wsFEC,'FEC');

const filename=currentExercice?`Comptabilite_${currentExercice}.xlsx`:`Comptabilite_${new Date().toISOString().split('T')[0]}.xlsx`;
XLSX.writeFile(wb,filename);
showMessage('✅ Dossier comptable complet téléchargé (8 onglets)','success');
return filename;
}

async function preparerEnvoiComptable(){
showMessage('⏳ Préparation de l\'envoi...','warning');
try{
// Générer le fichier Excel
const excelFilename=exportCompletComptable();

// Générer le ZIP (en arrière-plan)
const zipGenerated=await generateZipInBackground();

// Préparer l'email
const periode=currentExercice?currentExercice.replace('_',' au '):`toute la période`;
const nom=profile?`${profile.prenom} ${profile.nom}`:'';
const siret=profile?profile.siret:'';
const emailComptable=profile?.comptable_email||'';
const cabinetComptable=profile?.comptable_cabinet||'Cabinet comptable';

const emailBody=`Bonjour,

Veuillez trouver ci-joint les documents comptables pour ${periode}.

DOCUMENTS JOINTS :
✅ ${excelFilename} - Dossier comptable complet
   (Balance + Grand Livre + FEC)
✅ Justificatifs_${currentExercice||'complet'}.zip - Toutes les pièces justificatives

DÉTAILS :
- Professionnel : ${nom}
- SIRET : ${siret}
- Période : ${periode}
- Nombre d'opérations : ${transactions.length}

Les fichiers sont prêts à être joints à cet email.

Cordialement,
${nom}`;

const emailSubject=`Comptabilité IDEL - ${periode}`;

// Afficher le modal avec l'email pré-rempli
document.getElementById('emailContent').innerHTML=`
<div style="background:#f9f9f9;padding:1rem;border-radius:8px;margin-bottom:1rem;">
<p style="margin-bottom:0.5rem;"><strong>📎 Fichiers générés :</strong></p>
<p style="margin:0.25rem 0;color:#34A853;">✅ ${excelFilename}</p>
${zipGenerated?'<p style="margin:0.25rem 0;color:#34A853;">✅ Justificatifs_'+(currentExercice||'complet')+'.zip</p>':'<p style="margin:0.25rem 0;color:#F28B82;">⏳ ZIP en cours de génération...</p>'}
</div>

<div style="margin-bottom:1rem;">
<label style="font-weight:600;display:block;margin-bottom:0.5rem;">Destinataire :</label>
<input type="email" id="emailTo" value="${emailComptable}" placeholder="comptable@exemple.fr" style="width:100%;padding:0.75rem;border:1px solid #ddd;border-radius:8px;">
</div>

<div style="margin-bottom:1rem;">
<label style="font-weight:600;display:block;margin-bottom:0.5rem;">Sujet :</label>
<input type="text" id="emailSubject" value="${emailSubject}" style="width:100%;padding:0.75rem;border:1px solid #ddd;border-radius:8px;">
</div>

<div style="margin-bottom:1rem;">
<label style="font-weight:600;display:block;margin-bottom:0.5rem;">Message :</label>
<textarea id="emailBody" rows="12" style="width:100%;font-family:monospace;font-size:0.9rem;padding:0.75rem;border:1px solid #ddd;border-radius:8px;">${emailBody}</textarea>
</div>

<div style="background:#fff3cd;padding:1rem;border-radius:8px;margin-bottom:1rem;">
<p style="margin:0;"><strong>⚠️ Important :</strong> Les fichiers ont été téléchargés. Vous devez les joindre manuellement à votre email.</p>
</div>

<button class="btn btn-primary" onclick="ouvrirEmail()" style="width:100%;">📧 Ouvrir mon client email</button>
<button class="btn btn-secondary" onclick="copierEmail()" style="width:100%;margin-top:0.5rem;">📋 Copier le message</button>
`;

document.getElementById('emailModal').classList.add('show');
showMessage('✅ Email préparé ! Joignez les fichiers téléchargés.','success');
}catch(error){
showMessage('❌ '+error.message,'error');
}
}

async function generateZipInBackground(){
try{
const transWithFiles=transactions.filter(t=>t.has_attachments);
if(transWithFiles.length===0)return false;
const transIds=transWithFiles.map(t=>t.id);
const allAttachments=await api('attachments?select=*');
const attachments=allAttachments.filter(att=>transIds.includes(att.transaction_id));
if(!attachments||attachments.length===0)return false;
const zip=new JSZip();
let added=0;
for(const att of attachments){
try{
const url=`${SUPABASE_URL}/storage/v1/object/public/justificatifs/${att.storage_path}`;
const response=await fetch(url);
if(response.ok){
const blob=await response.blob();
zip.file(att.file_name,blob);
added++;
}
}catch(err){console.error(err)}
}
if(added===0)return false;
const content=await zip.generateAsync({type:'blob'});
const link=document.createElement('a');
link.href=URL.createObjectURL(content);
const filename=currentExercice?`Justificatifs_${currentExercice}.zip`:`Justificatifs_${new Date().toISOString().split('T')[0]}.zip`;
link.download=filename;
link.click();
return true;
}catch(error){
console.error(error);
return false;
}
}

function ouvrirEmail(){
const to=document.getElementById('emailTo').value;
const subject=encodeURIComponent(document.getElementById('emailSubject').value);
const body=encodeURIComponent(document.getElementById('emailBody').value);
window.location.href=`mailto:${to}?subject=${subject}&body=${body}`;
}

function copierEmail(){
const text=document.getElementById('emailBody').value;
navigator.clipboard.writeText(text).then(()=>{
showMessage('✅ Message copié !','success');
});
}

function closeEmailModal(){
document.getElementById('emailModal').classList.remove('show');
}

async function exportJustificatifs(){
showMessage('⏳ Préparation du ZIP...','warning');
try{
console.log('=== DEBUG EXPORT ZIP ===');
console.log('1. Transactions affichées:',transactions.length);
console.log('2. Transactions complètes:',transactions.map(t=>({id:t.id,date:t.date,desc:t.description,hasFiles:t.has_attachments})));

const transWithFiles=transactions.filter(t=>t.has_attachments);
console.log('3. Transactions AVEC fichiers:',transWithFiles.length,transWithFiles);

if(transWithFiles.length===0){
showMessage('❌ Aucune opération avec justificatif dans cette période','error');
console.log('ERREUR: Aucune transaction n a has_attachments=true');
return;
}

const transIds=transWithFiles.map(t=>t.id);
console.log('4. IDs des transactions:',transIds);

const allAttachments=await api('attachments?select=*');
console.log('5. TOUS les attachments en base:',allAttachments.length,allAttachments);

const attachments=allAttachments.filter(att=>transIds.includes(att.transaction_id));
console.log('6. Attachments filtrés pour cette période:',attachments.length,attachments);

if(!attachments||attachments.length===0){
showMessage('❌ Aucun fichier trouvé pour cette période','error');
console.log('ERREUR: Attachments existent mais transaction_id ne correspond pas');
return;
}

const zip=new JSZip();
let added=0;
for(const att of attachments){
console.log('7. Téléchargement:',att.file_name,'depuis',att.storage_path);
try{
const url=`${SUPABASE_URL}/storage/v1/object/public/justificatifs/${att.storage_path}`;
console.log('URL:',url);
const response=await fetch(url);
console.log('Response status:',response.status,response.ok);
if(response.ok){
const blob=await response.blob();
console.log('Blob size:',blob.size);
zip.file(att.file_name,blob);
added++;
console.log('✓ Fichier ajouté:',att.file_name);
}else{
console.log('✗ Erreur HTTP:',response.status);
}
}catch(err){
console.error('✗ Erreur téléchargement:',att.file_name,err);
}
}

console.log('8. Total fichiers ajoutés au ZIP:',added);

if(added===0){
showMessage('❌ Aucun fichier n a pu être téléchargé','error');
return;
}

const content=await zip.generateAsync({type:'blob'});
console.log('9. ZIP généré, taille:',content.size);
const link=document.createElement('a');
link.href=URL.createObjectURL(content);
const filename=currentExercice?`Justificatifs_${currentExercice}.zip`:`Justificatifs_${new Date().toISOString().split('T')[0]}.zip`;
link.download=filename;
link.click();
showMessage(`✅ ZIP téléchargé (${added} fichiers sur ${attachments.length})`,'success');
console.log('=== FIN DEBUG ===');
}catch(error){
console.error('ERREUR FATALE:',error);
showMessage('❌ Erreur: '+error.message,'error');
}
}

function openAIScan(){document.getElementById('aiModal').classList.add('show')}
function closeAIScan(){document.getElementById('aiModal').classList.remove('show');document.getElementById('aiResult').innerHTML=''}

async function analyzeWithAI(){
const file=document.getElementById('aiInput').files[0];
if(!file)return;
if(!file.type.startsWith('image/')){showMessage('❌ Images uniquement','error');return}
document.getElementById('aiResult').innerHTML='<p>🤖 Analyse...</p>';
try{
const reader=new FileReader();
reader.onload=async(e)=>{
try{
const base64=e.target.result.split(',')[1];
const response=await fetch('https://api.anthropic.com/v1/messages',{
method:'POST',
headers:{'Content-Type':'application/json'},
body:JSON.stringify({
model:'claude-sonnet-4-20250514',
max_tokens:1000,
messages:[{role:'user',content:[
{type:'image',source:{type:'base64',media_type:file.type,data:base64}},
{type:'text',text:'Analyse cette facture: date (YYYY-MM-DD), montant TTC, catégorie (Carburant/Fournitures médicales/Téléphone/Assurance/Formation/Comptable/Entretien véhicule/Loyer/Autres), description. JSON: {"date":"","amount":0,"category":"","description":""}'}
]}]
})
});
const data=await response.json();
const result=JSON.parse(data.content[0].text);
document.getElementById('date').value=result.date;
document.getElementById('amount').value=result.amount;
document.getElementById('type').value='depense';
updateCategories();
document.getElementById('category').value=result.category;
document.getElementById('description').value=result.description;
closeAIScan();
showTab('operations');
showMessage('✅ Analysé !','success');
}catch(err){document.getElementById('aiResult').innerHTML=`<div class="error">❌ ${err.message}</div>`}
};
reader.readAsDataURL(file);
}catch(error){document.getElementById('aiResult').innerHTML=`<div class="error">❌ ${error.message}</div>`}
}

async function uploadSocialDoc(){
const file=document.getElementById('docInput').files[0];
if(!file)return;
try{
const category=document.getElementById('docCategory').value;
const name=document.getElementById('docName').value||file.name;
const path=`social/${Date.now()}_${file.name}`;
await fetch(`${SUPABASE_URL}/storage/v1/object/justificatifs/${path}`,{method:'POST',headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${SUPABASE_KEY}`},body:file});
socialDocs.push({name,category,path});
document.getElementById('docName').value='';
showMessage('✅ Document ajouté','success');
displayDocs();
}catch(error){showMessage('❌ '+error.message,'error')}
}

function displayDocs(){
const html=socialDocs.map((d,i)=>`
<div class="doc-item">
<div><strong>${d.name}</strong><br><small>${d.category}</small></div>
<button class="btn-secondary" onclick="downloadDoc(${i})">📥</button>
</div>
`).join('');
document.getElementById('docsList').innerHTML=html||'<p style="color:#999;">Aucun document</p>';
}

function downloadDoc(i){
window.open(`${SUPABASE_URL}/storage/v1/object/public/justificatifs/${socialDocs[i].path}`);
}

function genererLiasseFiscale(){
const CA=parseFloat(document.getElementById('simRecettes').value)||transactions.filter(t=>t.type==='recette').reduce((s,t)=>s+t.amount,0);
const parts=parseFloat(document.getElementById('sim_parts').value)||2;
const depenses=transactions.filter(t=>t.type==='depense').reduce((s,t)=>s+t.amount,0);
const annee=new Date().getFullYear()-1;
const nom=profile?`${profile.prenom} ${profile.nom}`:'';
const siret=profile?profile.siret:'';
const adresse=profile?`${profile.adresse} ${profile.code_postal} ${profile.ville}`:'';
const fmt2=n=>n.toLocaleString('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2});
const wb=XLSX.utils.book_new();

// ================================================
// FEUILLE 1 : 2042-C PRO (Micro-entreprise BNC)
// ================================================
const abat=CA*0.34;
const base_micro=CA*0.66;
const urssaf_micro=CA*0.233;
const plafond=47253;
const carpimko=Math.min(CA,plafond)*0.0877+Math.min(CA,plafond)*0.0187+Math.min(CA,34033)*0.087+224+Math.min(CA,13913)*0.004+1022;
const base_csg=CA*0.9825;
const csg_ded=base_csg*0.068;
const ir_liberatoire=CA*0.022;

const data2042=[
['DÉCLARATION COMPLÉMENTAIRE DES REVENUS 2042-C PRO'],
[`Année des revenus : ${annee}`],
[''],
['IDENTIFICATION'],
['Nom et prénom',nom],
['SIRET',siret],
['Adresse',adresse],
[''],
['═══════════════════════════════════════════════════'],
['RÉGIME MICRO BNC - PROFESSIONS NON SALARIÉES'],
['═══════════════════════════════════════════════════'],
[''],
['CASE','LIBELLÉ','MONTANT À REPORTER'],
['5HQ','Revenus BNC - Micro (CA brut)',fmt2(CA)+' €'],
['','⚠️  Saisir ce montant case 5HQ sur impots.gouv.fr',''],
[''],
['MEMO CALCUL AUTOMATIQUE (informatif)'],
['CA brut déclaré (case 5HQ)',fmt2(CA)+' €'],
['Abattement forfaitaire 34%',fmt2(abat)+' €'],
['Bénéfice imposable estimé',fmt2(base_micro)+' €'],
[''],
['═══════════════════════════════════════════════════'],
['OPTION VERSEMENT LIBÉRATOIRE (si applicable)'],
['═══════════════════════════════════════════════════'],
[''],
['CASE','LIBELLÉ','MONTANT'],
['5TA','Versement libératoire (2,2% × CA)',fmt2(ir_liberatoire)+' €'],
['','(Si option activée - à vérifier avec votre comptable)',''],
[''],
['═══════════════════════════════════════════════════'],
['CHARGES SOCIALES DÉDUCTIBLES'],
['═══════════════════════════════════════════════════'],
[''],
['CASE','LIBELLÉ','MONTANT'],
['6DE','CSG déductible (6,8% × 98,25% × CA)',fmt2(csg_ded)+' €'],
[''],
['═══════════════════════════════════════════════════'],
['PROCÉDURE'],
['═══════════════════════════════════════════════════'],
['1. Connectez-vous sur impots.gouv.fr'],
['2. Déclaration de revenus → Déclaration annexe 2042-C PRO'],
['3. Section "Revenus non commerciaux professionnels"'],
['4. Régime micro BNC → Reportez le CA brut case 5HQ : '+fmt2(CA)+' €'],
['5. La déduction de 34% est automatique'],
];
const ws2042=XLSX.utils.aoa_to_sheet(data2042);
ws2042['!cols']=[{wch:8},{wch:50},{wch:20}];
ws2042['A1'].s={font:{bold:true,sz:14},fill:{fgColor:{rgb:'003087'}}};
XLSX.utils.book_append_sheet(wb,ws2042,'2042-C PRO');

// ================================================
// FEUILLE 2 : 2035 (BNC Réel - simulation)
// ================================================
const benefice_reel=Math.max(0,CA-depenses);
const urssaf_reel=benefice_reel*0.231;
const carpimko_reel=Math.min(benefice_reel,plafond)*0.0877+Math.min(benefice_reel,plafond)*0.0187+Math.min(benefice_reel,34033)*0.087+224+Math.min(benefice_reel,13913)*0.004+1022;
const csg_reel=benefice_reel*0.9825*0.097;

// Dépenses par catégorie
const parCat={};
transactions.filter(t=>t.type==='depense').forEach(t=>{
if(!parCat[t.category])parCat[t.category]=0;
parCat[t.category]+=t.amount;
});

const data2035=[
['DÉCLARATION 2035 - BNC RÉGIME DE LA DÉCLARATION CONTRÔLÉE (SIMULATION)'],
[`Exercice : ${annee} - Document indicatif - Régime réel simulé`],
[''],
['IDENTIFICATION'],
['Nom et prénom',nom],
['SIRET',siret],
['Adresse',adresse],
[''],
['═══════════════════════════════════════════════════'],
['CADRE A - RECETTES PROFESSIONNELLES'],
['═══════════════════════════════════════════════════'],
[''],
['LIGNE','NATURE','MONTANT'],
['AA','Honoraires et recettes brutes',fmt2(CA)+' €'],
['AB','Débours (remboursements)','0,00 €'],
['AC','Recettes nettes (AA - AB)',fmt2(CA)+' €'],
];

// Recettes par catégorie
transactions.filter(t=>t.type==='recette').forEach(t=>{
data2035.push(['','  '+t.date+' - '+t.description,fmt2(t.amount)+' €']);
});

data2035.push(['']);
data2035.push(['═══════════════════════════════════════════════════']);
data2035.push(['CADRE B - DÉPENSES PROFESSIONNELLES']);
data2035.push(['═══════════════════════════════════════════════════']);
data2035.push(['']);
data2035.push(['LIGNE','NATURE','MONTANT']);
data2035.push(['BA','Achats (fournitures médicales)',fmt2(parCat['Fournitures médicales']||0)+' €']);
data2035.push(['BB','Frais de véhicule (carburant + entretien)',fmt2((parCat['Carburant']||0)+(parCat['Entretien véhicule']||0))+' €']);
data2035.push(['BC','Loyer et charges locatives',fmt2(parCat['Loyer cabinet']||0)+' €']);
data2035.push(['BD','Assurances professionnelles',fmt2((parCat['Assurance professionnelle']||0)+(parCat['Matmut (RC Pro)']||0))+' €']);
data2035.push(['BE','Téléphone / Internet',fmt2(parCat['Téléphone/Internet']||0)+' €']);
data2035.push(['BF','Frais de formation',fmt2(parCat['Formation']||0)+' €']);
data2035.push(['BG','Honoraires comptable',fmt2(parCat['Comptable']||0)+' €']);
data2035.push(['BH','Frais bancaires',fmt2(parCat['Frais bancaires']||0)+' €']);
data2035.push(['BI','Cotisations sociales (URSSAF)',fmt2(parCat['URSSAF']||0)+' €']);
data2035.push(['BJ','Cotisations CARPIMKO',fmt2(parCat['CARPIMKO']||0)+' €']);
data2035.push(['BK','Prévoyance / Mutuelle',fmt2((parCat['Prévoyance']||0)+(parCat['Mutuelle santé']||0))+' €']);
data2035.push(['BL','CSG/CRDS',fmt2(parCat['CSG/CRDS']||0)+' €']);
data2035.push(['BM','Autres charges',fmt2(parCat['Autres dépenses']||0)+' €']);
data2035.push(['','TOTAL DÉPENSES',fmt2(depenses)+' €']);
data2035.push(['']);
data2035.push(['═══════════════════════════════════════════════════']);
data2035.push(['CADRE C - RÉSULTAT FISCAL (SIMULATION BNC RÉEL)']);
data2035.push(['═══════════════════════════════════════════════════']);
data2035.push(['']);
data2035.push(['Recettes nettes',fmt2(CA)+' €']);
data2035.push(['Total dépenses',fmt2(depenses)+' €']);
data2035.push(['BÉNÉFICE BRUT (CA - Dépenses)',fmt2(benefice_reel)+' €']);
data2035.push(['CSG déductible (6,8%)','-'+fmt2(benefice_reel*0.9825*0.068)+' €']);
data2035.push(['BÉNÉFICE NET IMPOSABLE',fmt2(benefice_reel-benefice_reel*0.9825*0.068)+' €']);
data2035.push(['']);
data2035.push(['⚠️ Document de simulation uniquement']);
data2035.push(['⚠️ À faire valider par votre expert-comptable avant dépôt']);

const ws2035=XLSX.utils.aoa_to_sheet(data2035);
ws2035['!cols']=[{wch:8},{wch:50},{wch:20}];
XLSX.utils.book_append_sheet(wb,ws2035,'2035 (simulation réel)');

// ================================================
// FEUILLE 3 : RÉCAPITULATIF COMPTABLE COMPLET
// ================================================
const csg_micro_ded=base_csg*0.068;
const ir_micro=calculerIR(base_micro-csg_micro_ded,parts);
const ir_reel=calculerIR(benefice_reel-benefice_reel*0.9825*0.068,parts);

const dataRecap=[
['RÉCAPITULATIF COMPTABLE COMPLET'],
[`${nom} - SIRET: ${siret} - Exercice ${annee}`],
[''],
['═══════════════════════════════════════════════════'],
['RÉSULTATS COMPARATIFS'],
['═══════════════════════════════════════════════════'],
['','MICRO-ENTREPRISE','BNC RÉEL (simulé)'],
['Chiffre d\'affaires',fmt2(CA)+' €',fmt2(CA)+' €'],
['Abattement / Dépenses',fmt2(abat)+' €',fmt2(depenses)+' €'],
['Base imposable',fmt2(base_micro)+' €',fmt2(benefice_reel)+' €'],
['URSSAF',fmt2(urssaf_micro)+' €',fmt2(urssaf_reel)+' €'],
['CARPIMKO',fmt2(carpimko)+' €',fmt2(carpimko_reel)+' €'],
['CSG/CRDS',fmt2(base_csg*0.097)+' €',fmt2(csg_reel)+' €'],
['Impôt sur le revenu (estimé)',fmt2(ir_micro)+' €',fmt2(ir_reel)+' €'],
['TOTAL PRÉLÈVEMENTS',fmt2(urssaf_micro+carpimko+base_csg*0.097+ir_micro)+' €',fmt2(urssaf_reel+carpimko_reel+csg_reel+ir_reel)+' €'],
['REVENU NET FINAL',fmt2(CA-urssaf_micro-carpimko-base_csg*0.097-ir_micro)+' €',fmt2(benefice_reel-urssaf_reel-carpimko_reel-csg_reel-ir_reel)+' €'],
[''],
['═══════════════════════════════════════════════════'],
['DÉTAIL DES OPÉRATIONS'],
['═══════════════════════════════════════════════════'],
[''],
['RECETTES'],
['Date','Description','Catégorie','Montant'],
...transactions.filter(t=>t.type==='recette').map(t=>[t.date,t.description,t.category,fmt2(t.amount)+' €']),
['','','TOTAL RECETTES',fmt2(CA)+' €'],
[''],
['DÉPENSES'],
['Date','Description','Catégorie','Montant'],
...transactions.filter(t=>t.type==='depense').map(t=>[t.date,t.description,t.category,fmt2(t.amount)+' €']),
['','','TOTAL DÉPENSES',fmt2(depenses)+' €'],
[''],
['═══════════════════════════════════════════════════'],
['INFORMATIONS FISCALES À REPORTER'],
['═══════════════════════════════════════════════════'],
[''],
['Document','Case','Valeur'],
['2042-C PRO - Déclaration principale','5HQ',fmt2(CA)+' €'],
['2042-C PRO - CSG déductible','6DE',fmt2(csg_micro_ded)+' €'],
['(Option) Versement libératoire','5TA',fmt2(ir_liberatoire)+' €'],
];

const wsRecap=XLSX.utils.aoa_to_sheet(dataRecap);
wsRecap['!cols']=[{wch:40},{wch:25},{wch:25}];
XLSX.utils.book_append_sheet(wb,wsRecap,'Récapitulatif complet');

const filename=`Liasse_fiscale_${annee}_${nom.replace(' ','_')}.xlsx`;
XLSX.writeFile(wb,filename);
showMessage('✅ Liasse fiscale générée : '+filename,'success');
}

function lancerComparatif(){
const CA=parseFloat(document.getElementById('simRecettes').value)||0;
const parts=parseFloat(document.getElementById('sim_parts').value)||2;
const autres_revenus=parseFloat(document.getElementById('sim_autres_revenus').value)||0;
if(CA===0){showMessage('⚠️ Entrez d\'abord votre CA dans le simulateur','warning');return;}
const fmt=n=>n.toLocaleString('fr-FR',{minimumFractionDigits:0,maximumFractionDigits:0})+' €';

// ===== MICRO-ENTREPRISE =====
const micro_abat=CA*0.34;
const micro_base=CA*0.66;
const micro_urssaf=CA*0.231+CA*0.002;
const plafond=47253;
const micro_carpimko=Math.min(CA,plafond)*0.0877+Math.min(CA,plafond)*0.0187+Math.min(CA,34033)*0.087+224+Math.min(CA,13913)*0.004+1022;
const micro_base_csg=CA*0.9825;
const micro_csg=micro_base_csg*0.097;
const micro_csg_ded=micro_base_csg*0.068;
const micro_rni=micro_base-micro_csg_ded+autres_revenus;
const micro_ir=calculerIR(micro_rni,parts);
const micro_total=micro_urssaf+micro_carpimko+micro_csg+micro_ir;
const micro_net=CA-micro_total;

// ===== BNC RÉEL =====
const depenses=transactions.filter(t=>t.type==='depense').reduce((s,t)=>s+t.amount,0);
const benefice=Math.max(0,CA-depenses);
// URSSAF TNS réel : ~23% sur bénéfice
const reel_urssaf=benefice*0.231;
const reel_carpimko=Math.min(benefice,plafond)*0.0877+Math.min(benefice,plafond)*0.0187+Math.min(benefice,34033)*0.087+224+Math.min(benefice,13913)*0.004+1022;
const reel_base_csg=benefice*0.9825;
const reel_csg=reel_base_csg*0.097;
const reel_csg_ded=reel_base_csg*0.068;
const reel_rni=benefice-reel_csg_ded+autres_revenus;
const reel_ir=calculerIR(reel_rni,parts);
const reel_total=reel_urssaf+reel_carpimko+reel_csg+reel_ir;
const reel_net=CA-depenses-reel_total;

// Mise à jour UI MICRO
document.getElementById('cmp_micro_ca').textContent=fmt(CA);
document.getElementById('cmp_micro_abat').textContent='-'+fmt(micro_abat);
document.getElementById('cmp_micro_urssaf').textContent='-'+fmt(micro_urssaf);
document.getElementById('cmp_micro_carpimko').textContent='-'+fmt(micro_carpimko);
document.getElementById('cmp_micro_csg').textContent='-'+fmt(micro_csg);
document.getElementById('cmp_micro_ir').textContent='-'+fmt(micro_ir);
document.getElementById('cmp_micro_net').textContent=fmt(micro_net);

// Mise à jour UI RÉEL
document.getElementById('cmp_reel_ca').textContent=fmt(CA);
document.getElementById('cmp_reel_depenses').textContent='-'+fmt(depenses);
document.getElementById('cmp_reel_urssaf').textContent='-'+fmt(reel_urssaf);
document.getElementById('cmp_reel_carpimko').textContent='-'+fmt(reel_carpimko);
document.getElementById('cmp_reel_csg').textContent='-'+fmt(reel_csg);
document.getElementById('cmp_reel_ir').textContent='-'+fmt(reel_ir);
document.getElementById('cmp_reel_net').textContent=fmt(reel_net);

// VERDICT
const diff=reel_net-micro_net;
const verdict=document.getElementById('comparatif_verdict');
const vGain=document.getElementById('verdict_gain');
if(diff>0){
verdict.style.background='#e8f5e9';
verdict.style.color='#2E7D32';
document.getElementById('verdict_titre').textContent='✅ Le BNC Réel est plus avantageux !';
document.getElementById('verdict_detail').textContent='Vos dépenses réelles ('+fmt(depenses)+') dépassent l\'abattement forfaitaire ('+fmt(micro_abat)+')';
vGain.textContent='Gain : +'+fmt(diff)+' de revenu net';
}else if(diff<0){
verdict.style.background='#e3f2fd';
verdict.style.color='#1976D2';
document.getElementById('verdict_titre').textContent='✅ La Micro-entreprise est plus avantageuse !';
document.getElementById('verdict_detail').textContent='L\'abattement forfaitaire ('+fmt(micro_abat)+') est supérieur à vos dépenses réelles ('+fmt(depenses)+')';
vGain.textContent='Gain : +'+fmt(Math.abs(diff))+' de revenu net';
}else{
verdict.style.background='#f5f5f5';
document.getElementById('verdict_titre').textContent='🟰 Les deux régimes sont équivalents';
document.getElementById('verdict_detail').textContent='';
vGain.textContent='';
}

// Détail dépenses par catégorie
const parCategorie={};
transactions.filter(t=>t.type==='depense').forEach(t=>{
if(!parCategorie[t.category])parCategorie[t.category]=0;
parCategorie[t.category]+=t.amount;
});
let html='<table style="width:100%;border-collapse:collapse;">';
html+='<tr style="font-weight:700;border-bottom:1px solid #ddd;"><td>Catégorie</td><td style="text-align:right;">Montant</td></tr>';
Object.entries(parCategorie).sort((a,b)=>b[1]-a[1]).forEach(([cat,mt])=>{
html+=`<tr style="border-bottom:1px solid #eee;"><td style="padding:0.3rem 0;">${cat}</td><td style="text-align:right;font-weight:600;">${fmt(mt)}</td></tr>`;
});
html+=`<tr style="font-weight:700;border-top:2px solid #333;"><td>TOTAL</td><td style="text-align:right;">${fmt(depenses)}</td></tr>`;
html+='</table>';
document.getElementById('cmp_detail_depenses').innerHTML=html;
document.getElementById('comparatif_result').style.display='block';
}

function calculerIR(revenu_net_imposable,parts){
const q=revenu_net_imposable/parts;
const t11=Math.max(0,Math.min(q,28797)-11294)*0.11;
const t30=Math.max(0,Math.min(q,82341)-28797)*0.30;
const t41=Math.max(0,Math.min(q,177106)-82341)*0.41;
const t45=Math.max(0,q-177106)*0.45;
return(t11+t30+t41+t45)*parts;
}

function importerRecettes(){
const r=transactions.filter(t=>t.type==='recette').reduce((s,t)=>s+t.amount,0);
document.getElementById('simRecettes').value=r.toFixed(0);
calculerCharges();
}


// ══════════════════════════════════════
// SIMULATEUR DE CHARGES
// ══════════════════════════════════════

function calculerCharges(){
const CA=parseFloat(document.getElementById('simRecettes').value)||0;
const fmt=n=>n.toLocaleString('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2})+' €';
const anneeEl=document.getElementById('bareme_annee');
const annee=anneeEl?anneeEl.value:'2026';
const b=getBareme(annee);

const abattement=CA*(b.abattement/100);
const base_imposable=CA*(1-b.abattement/100);
const urssaf_total=CA*(b.urssaf_taux/100);
const cfp=CA*(b.urssaf_cfp/100);
const urssaf_avec_cfp=urssaf_total+cfp;
const retraite_base_t1=Math.min(CA,b.pass)*(b.retraite_t1/100);
const retraite_base_t2=Math.max(0,CA-b.pass)*(b.retraite_t2/100);
// Complémentaire 2026 : 100% proportionnel avec plancher/plafond
const comp_brute=CA*(b.comp_taux/100);
const retraite_comp=Math.max(b.comp_min,Math.min(b.comp_max,comp_brute));
// ASV : forfait + proportionnel (part praticien)
const asv=b.asv_forfait+(CA*(b.asv_prop/100));
const carpimko_total=retraite_base_t1+retraite_base_t2+retraite_comp+asv+b.inv_deces;
const base_csg=CA*(b.assiette_csg/100);
const csg_ded=base_csg*(b.csg_ded/100);
const csg_nded=base_csg*(b.csg_nded/100);
const crds=base_csg*(b.crds/100);
const csg_total=csg_ded+csg_nded+crds;
const parts=parseFloat(document.getElementById('sim_parts').value)||2;
const autres_revenus=parseFloat(document.getElementById('sim_autres_revenus').value)||0;
const revenu_net_imposable=base_imposable-csg_ded+autres_revenus;
const quotient=revenu_net_imposable/parts;
const t11=Math.max(0,Math.min(quotient,b.ir_t11)-b.ir_t0)*0.11;
const t30=Math.max(0,Math.min(quotient,b.ir_t30)-b.ir_t11)*0.30;
const t41=Math.max(0,Math.min(quotient,b.ir_t41)-b.ir_t30)*0.41;
const t45=Math.max(0,quotient-b.ir_t41)*0.45;
const ir_total=(t11+t30+t41+t45)*parts;
const ir_liberatoire=CA*(b.liberatoire/100);
const tmi=quotient<=b.ir_t0?0:quotient<=b.ir_t11?11:quotient<=b.ir_t30?30:quotient<=b.ir_t41?41:45;
const total=urssaf_avec_cfp+carpimko_total+csg_total+ir_total;
const net=CA-total;

document.getElementById('sim_ca').textContent=fmt(CA);
document.getElementById('sim_abattement').textContent=fmt(abattement)+' ('+b.abattement+'%)';
document.getElementById('sim_base_imposable').textContent=fmt(base_imposable);
document.getElementById('sim_urssaf_taux').textContent=fmt(urssaf_total);
document.getElementById('sim_cfp').textContent=fmt(cfp);
document.getElementById('sim_urssaf_total').textContent=fmt(urssaf_avec_cfp);
document.getElementById('sim_retraite_base').textContent=fmt(retraite_base_t1+retraite_base_t2);
document.getElementById('sim_retraite_comp').textContent=fmt(retraite_comp);
document.getElementById('sim_prevoyance').textContent=fmt(asv);
document.getElementById('sim_inv_deces').textContent=fmt(b.inv_deces);
document.getElementById('sim_carpimko_total').textContent=fmt(carpimko_total);
document.getElementById('sim_base_csg').textContent=fmt(base_csg);
document.getElementById('sim_csg_ded').textContent=fmt(csg_ded);
document.getElementById('sim_csg_nded').textContent=fmt(csg_nded);
document.getElementById('sim_crds').textContent=fmt(crds);
document.getElementById('sim_csg_total').textContent=fmt(csg_total);
document.getElementById('ir_base_bnc').textContent=fmt(base_imposable);
document.getElementById('ir_csg_ded').textContent='- '+fmt(csg_ded);
document.getElementById('ir_revenu_net_imposable').textContent=fmt(revenu_net_imposable);
document.getElementById('ir_quotient').textContent=fmt(quotient)+' (TMI: '+tmi+'%)';
document.getElementById('ir_t0').textContent=fmt(0);
document.getElementById('ir_t11').textContent=fmt(t11*parts);
document.getElementById('ir_t30').textContent=fmt(t30*parts);
document.getElementById('ir_t41').textContent=fmt(t41*parts);
document.getElementById('ir_t45').textContent=fmt(t45*parts);
document.getElementById('ir_total').textContent=fmt(ir_total);
document.getElementById('ir_liberatoire').textContent=fmt(ir_liberatoire);
document.getElementById('sim_recap_recettes').textContent=fmt(CA);
document.getElementById('sim_recap_urssaf').textContent=fmt(urssaf_avec_cfp);
document.getElementById('sim_recap_carpimko').textContent=fmt(carpimko_total);
document.getElementById('sim_recap_csg').textContent=fmt(csg_total);
document.getElementById('sim_recap_ir').textContent=fmt(ir_total);
document.getElementById('sim_total_charges').textContent=fmt(total);
document.getElementById('sim_revenu_net').textContent=fmt(net);
document.getElementById('sim_taux').textContent=(CA>0?(total/CA*100).toFixed(1):0)+' %';
const recettesActuelles=transactions.filter(t=>t.type==='recette').reduce((s,t)=>s+t.amount,0);
document.getElementById('simRecettesAuto').textContent=fmt(recettesActuelles)+' → cliquez pour importer';
}

// ══════════════════════════════════════
// GESTION DES BARÈMES FISCAUX
// ══════════════════════════════════════

const BAREMES_DEFAUT={
// 2025 : ancien système CARPIMKO (forfait + proportionnel)
'2025':{
urssaf_taux:23.1,urssaf_cfp:0.2,abattement:34,liberatoire:2.2,
pass:46368,
retraite_t1:8.23,retraite_t2:1.87,
// Ancien régime complémentaire 2025
comp_taux:8.70,comp_plafond_min:23184,comp_plafond_max:138918,comp_min:2091,comp_max:12544,
asv_forfait:224,asv_prop:0.16,
inv_deces:1022,
assiette_csg:98.25,csg_ded:6.8,csg_nded:2.4,crds:0.5,
ir_t0:11294,ir_t11:28797,ir_t30:82341,ir_t41:177106
},
// 2026 : RÉFORME CARPIMKO - système 100% proportionnel
'2026':{
urssaf_taux:23.1,urssaf_cfp:0.2,abattement:34,liberatoire:2.2,
pass:48060,
retraite_t1:8.73,retraite_t2:1.87,
// Nouveau régime complémentaire 2026 : 8,70% avec plancher/plafond
comp_taux:8.70,comp_plafond_min:24030,comp_plafond_max:144180,comp_min:2091,comp_max:12544,
asv_forfait:224,asv_prop:0.16,
inv_deces:1022,
assiette_csg:98.25,csg_ded:6.8,csg_nded:2.4,crds:0.5,
ir_t0:11294,ir_t11:28797,ir_t30:82341,ir_t41:177106
},
'2027':{
urssaf_taux:23.1,urssaf_cfp:0.2,abattement:34,liberatoire:2.2,
pass:48060,
retraite_t1:8.73,retraite_t2:1.87,
comp_taux:8.70,comp_plafond_min:24030,comp_plafond_max:144180,comp_min:2091,comp_max:12544,
asv_forfait:224,asv_prop:0.16,
inv_deces:1022,
assiette_csg:98.25,csg_ded:6.8,csg_nded:2.4,crds:0.5,
ir_t0:11294,ir_t11:28797,ir_t30:82341,ir_t41:177106
},
'2028':{
urssaf_taux:23.1,urssaf_cfp:0.2,abattement:34,liberatoire:2.2,
pass:48060,
retraite_t1:8.73,retraite_t2:1.87,
comp_taux:8.70,comp_plafond_min:24030,comp_plafond_max:144180,comp_min:2091,comp_max:12544,
asv_forfait:224,asv_prop:0.16,
inv_deces:1022,
assiette_csg:98.25,csg_ded:6.8,csg_nded:2.4,crds:0.5,
ir_t0:11294,ir_t11:28797,ir_t30:82341,ir_t41:177106
},
};

function getBareme(annee){
const anneeStr=String(annee||new Date().getFullYear());
const saved=localStorage.getItem('bareme_'+anneeStr);
if(saved)return JSON.parse(saved);
return BAREMES_DEFAUT[anneeStr]||BAREMES_DEFAUT['2026'];
}

function chargerBareme(silent=false){
const el=document.getElementById('bareme_annee');
if(!el)return;
const annee=el.value;
const b=getBareme(annee);
const set=(id,val)=>{const e=document.getElementById(id);if(e)e.value=val;};
set('b_urssaf_taux',b.urssaf_taux);
set('b_urssaf_cfp',b.urssaf_cfp);
set('b_abattement',b.abattement);
set('b_liberatoire',b.liberatoire);
set('b_plafond_ss',b.pass);
set('b_retraite_t1',b.retraite_t1);
set('b_retraite_t2',b.retraite_t2);
set('b_retraite_comp',b.comp_taux);
set('b_cot_prop_taux',b.comp_min);
set('b_cot_prop_plafond',b.comp_max);
set('b_asv',b.asv_forfait);
set('b_asv_prop',b.asv_prop);
set('b_inv_deces',b.inv_deces);
set('b_assiette_csg',b.assiette_csg);
set('b_csg_ded',b.csg_ded);
set('b_csg_nded',b.csg_nded);
set('b_crds',b.crds);
set('b_ir_t0',b.ir_t0);
set('b_ir_t11',b.ir_t11);
set('b_ir_t30',b.ir_t30);
set('b_ir_t41',b.ir_t41);
if(!silent)showMessage('✅ Barème '+annee+' chargé','success');
}

function sauvegarderBareme(){
const annee=document.getElementById('bareme_annee').value;
const b={
urssaf_taux:parseFloat(document.getElementById('b_urssaf_taux').value),
urssaf_cfp:parseFloat(document.getElementById('b_urssaf_cfp').value),
abattement:parseFloat(document.getElementById('b_abattement').value),
liberatoire:parseFloat(document.getElementById('b_liberatoire').value),
pass:parseFloat(document.getElementById('b_plafond_ss').value),
retraite_t1:parseFloat(document.getElementById('b_retraite_t1').value),
retraite_t2:parseFloat(document.getElementById('b_retraite_t2').value),
comp_taux:parseFloat(document.getElementById('b_retraite_comp').value),
comp_min:parseFloat(document.getElementById('b_cot_prop_taux').value),
comp_max:parseFloat(document.getElementById('b_cot_prop_plafond').value),
comp_plafond_min:parseFloat(document.getElementById('b_cot_prop_taux').value)/parseFloat(document.getElementById('b_retraite_comp').value)*100,
comp_plafond_max:parseFloat(document.getElementById('b_cot_prop_plafond').value)/parseFloat(document.getElementById('b_retraite_comp').value)*100,
asv_forfait:parseFloat(document.getElementById('b_asv').value),
asv_prop:parseFloat(document.getElementById('b_asv_prop').value),
inv_deces:parseFloat(document.getElementById('b_inv_deces').value),
assiette_csg:parseFloat(document.getElementById('b_assiette_csg').value),
csg_ded:parseFloat(document.getElementById('b_csg_ded').value),
csg_nded:parseFloat(document.getElementById('b_csg_nded').value),
crds:parseFloat(document.getElementById('b_crds').value),
ir_t0:parseFloat(document.getElementById('b_ir_t0').value),
ir_t11:parseFloat(document.getElementById('b_ir_t11').value),
ir_t30:parseFloat(document.getElementById('b_ir_t30').value),
ir_t41:parseFloat(document.getElementById('b_ir_t41').value),
};
localStorage.setItem('bareme_'+annee,JSON.stringify(b));
showMessage('✅ Barème '+annee+' sauvegardé !','success');
}

function resetBareme(){
const annee=document.getElementById('bareme_annee').value;
localStorage.removeItem('bareme_'+annee);
chargerBareme();
showMessage('↺ Barème '+annee+' réinitialisé aux valeurs par défaut','warning');
}

function getBareParam(key){
const annee=document.getElementById('bareme_annee')?document.getElementById('bareme_annee').value:'2026';
return getBareme(annee)[key];
}

function showTab(name){
document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
document.querySelectorAll('[id^="tab-"]').forEach(t=>t.classList.add('hidden'));
const tabEl=document.getElementById(`tab-${name}`);
if(tabEl)tabEl.classList.remove('hidden');
const btn=document.querySelector(`[onclick="showTab('${name}')"]`);
if(btn)btn.classList.add('active');
}

function showMessage(msg,type){
const div=document.createElement('div');
div.className=`message ${type}`;
div.textContent=msg;
document.getElementById('messages').appendChild(div);
setTimeout(()=>div.remove(),3000);
}

document.getElementById('date').value=new Date().toISOString().split('T')[0];
init();
