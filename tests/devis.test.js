// Règle 4 de REGLES.md : l'écart de certification figure au devis PDF, et rien n'est écrit sur
// une variante — le fournisseur n'y a pas de case à cocher.
//
// La composition vit au milieu de `generateDevis`, non extractible : on en reproduit la logique.
// Le test vaut alors comme spécification — s'il diverge du portail, l'un des deux a bougé.

const { lirePortail, verifie } = require('./outils');

function composer(f, l) {
  let design = l.est_variante ? (l.variante_description || 'Variante') : (f?.designation || '');
  const exigees = (!l.est_variante && Array.isArray(f?.certifications)) ? f.certifications.filter(Boolean) : [];
  if (exigees.length) {
    const detenues = new Set(Array.isArray(l.certifications_ok) ? l.certifications_ok : []);
    const ok = exigees.filter(c => detenues.has(c));
    const sans = exigees.filter(c => !detenues.has(c));
    if (ok.length) design += `\nCertifié : ${ok.join(', ')}`;
    if (sans.length) design += `\nSans certification : ${sans.join(', ')}`;
  }
  return design;
}

const f = { designation: 'Acer campestre', certifications: ['Végétal local', 'Label Rouge'] };

console.log('certifications au devis');

verifie('le portail contient bien la mention',
  /Sans certification/.test(lirePortail('pivot-fournisseur.html')), true);

verifie('tout détenu',
  composer(f, { certifications_ok: ['Végétal local', 'Label Rouge'] }),
  'Acer campestre\nCertifié : Végétal local, Label Rouge');

verifie('partiellement détenu : l’écart est dit',
  composer(f, { certifications_ok: ['Végétal local'] }),
  'Acer campestre\nCertifié : Végétal local\nSans certification : Label Rouge');

verifie('rien de déclaré',
  composer(f, {}),
  'Acer campestre\nSans certification : Végétal local, Label Rouge');

verifie('une variante ne dit rien des certifications',
  composer(f, { est_variante: true, variante_description: 'Acer platanoides' }),
  'Acer platanoides');
