// Règle 1 de REGLES.md : une DAF visée n'est jamais régénérée par l'entreprise — le maître d'œuvre
// tamponne le PDF émis. Le cadre de signature est donc à une position FIXE, connue des deux côtés.
// Si ce test échoue, le visa s'imprimera à côté du cadre.

const { lirePortail, verifie } = require('./outils');
const fs = require('fs');
const path = require('path');

const worker = fs.readFileSync(path.join(__dirname, '..', 'worker', 'worker.js'), 'utf8');
const moe = lirePortail('pivot-moe.html');

const lire = (src, nom) => {
  const m = src.match(new RegExp(`${nom}\\s*=\\s*([0-9.]+)`));
  if (!m) throw new Error(`extraction impossible : ${nom}`);
  return parseFloat(m[1]);
};

console.log('cadre de signature de la DAF');

verifie('le générateur et le portail MOE s’accordent sur la hauteur du cadre',
  lire(worker, 'SIGNATURE_Y'), lire(moe, 'SIGNATURE_Y'));

verifie('le générateur pose le cadre à une hauteur fixe, non calculée',
  /y = SIGNATURE_Y;/.test(worker), true);

verifie('le PDF visé part du PDF émis, jamais d’une régénération',
  /PDFDocument\.load\(origBytes\)/.test(moe), true);

verifie('le visa imprime l’identité du signataire, pas une seule valeur disponible',
  /_identiteSignataire/.test(moe), true);
