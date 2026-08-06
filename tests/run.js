// Lance toutes les vérifications de non-régression.
//
//   node tests/run.js
//
// À exécuter avant chaque `git push` touchant un portail ou le worker. Un test qui échoue sur
// « extraction impossible » signale un renommage : soit le test suit, soit la règle a changé — et
// alors REGLES.md doit changer d'abord.

const fs = require('fs');
const path = require('path');

// Contrôle de syntaxe des portails : un fichier HTML autonome ne compile nulle part ailleurs.
function verifierSyntaxe() {
  const racine = path.join(__dirname, '..');
  let echecs = 0;
  for (const nom of fs.readdirSync(racine).filter(f => /^pivot-.*\.html$/.test(f))) {
    const html = fs.readFileSync(path.join(racine, nom), 'utf8');
    const re = /<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/g;
    let m, bloc = 0;
    while ((m = re.exec(html))) {
      bloc++;
      try { new Function(m[1]); }
      catch (e) { echecs++; console.log(`  ÉCHEC ${nom} bloc ${bloc} : ${e.message}`); }
    }
  }
  if (!echecs) console.log('  ok   tous les portails compilent');
  return echecs;
}

console.log('syntaxe');
let echecs = verifierSyntaxe();

const { bilan } = require('./outils');
for (const f of fs.readdirSync(__dirname).filter(f => f.endsWith('.test.js')).sort()) {
  console.log('');
  require(path.join(__dirname, f));
}
console.log('');
echecs += bilan();

process.exit(echecs ? 1 : 0);
