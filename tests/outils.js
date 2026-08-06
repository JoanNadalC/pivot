// Outils communs aux tests : extraction de fonctions depuis les portails, et assertions.
//
// Les portails sont des fichiers HTML autonomes : on ne peut pas les importer. On en extrait donc
// les fonctions pures par expression régulière, puis on les évalue dans une portée close. C'est
// fragile par nature — si un test échoue sur « extraction impossible », c'est que la fonction a été
// renommée ou déplacée, ce qui est en soi une information.

const fs = require('fs');
const path = require('path');

const RACINE = path.join(__dirname, '..');

function lirePortail(nom) {
  return fs.readFileSync(path.join(RACINE, nom), 'utf8').replace(/\r\n/g, '\n');
}

// Extrait les fragments demandés et les évalue ensemble, en exposant les noms voulus.
// `contexte` fournit les variables globales que le code attend (state, etc.).
function extraire(portail, motifs, exports, contexte = {}) {
  const html = lirePortail(portail);
  const source = motifs.map(re => {
    const m = html.match(re);
    if (!m) throw new Error(`extraction impossible dans ${portail} : ${re}`);
    return m[0];
  }).join('\n');
  const noms = Object.keys(contexte);
  const fabrique = new Function(...noms, `${source}\nreturn { ${exports.join(', ')} };`);
  return fabrique(...noms.map(n => contexte[n]));
}

let total = 0;
let echecs = 0;

function verifie(intitule, obtenu, attendu) {
  total++;
  const a = JSON.stringify(obtenu);
  const b = JSON.stringify(attendu);
  if (a === b) {
    console.log(`  ok   ${intitule}`);
  } else {
    echecs++;
    console.log(`  ÉCHEC ${intitule}\n        obtenu  ${a}\n        attendu ${b}`);
  }
}

function bilan() {
  console.log(`\n${total - echecs}/${total} vérifications passées.`);
  return echecs;
}

module.exports = { lirePortail, extraire, verifie, bilan };
