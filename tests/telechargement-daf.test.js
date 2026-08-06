// Règle 1 de REGLES.md : une pièce émise se télécharge, elle ne se régénère pas. Le bouton PDF de
// l'onglet DAF doit servir le fichier stocké — la version visée si elle existe, sinon celle émise.

const { lirePortail, verifie } = require('./outils');

const html = lirePortail('pivot-entrepreneur.html');
const fn = html.match(/async function dafTelechargerPdf[\s\S]*?\n}\n/);
if (!fn) throw new Error('extraction impossible : dafTelechargerPdf');

console.log('téléchargement d’une DAF');

verifie('le bouton de la ligne appelle le téléchargement, non la génération',
  /onclick="dafTelechargerPdf\('\$\{f\.id\}'\)"/.test(html), true);

verifie('la version visée prime sur la version émise',
  /pdf_visa_url \|\| d\?\.pdf_url/.test(fn[0]), true);

verifie('une DAF émise sans PDF n’est pas reconstituée',
  /statut !== 'brouillon'/.test(fn[0]), true);

verifie('le dépôt du PDF émis est attendu et vérifié',
  /if \(upErr\) throw upErr;/.test(html), true);
