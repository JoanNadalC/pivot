// Règle 1 de REGLES.md : une pièce émise garde sa référence, et une nouvelle version incrémente
// le suffixe quel que soit le séparateur retenu par la codification.

const { lirePortail, verifie } = require('./outils');

const html = lirePortail('pivot-entrepreneur.html');
const src = html.match(/function _dafCreateV2Confirmed[\s\S]*?\n}\n/);
if (!src) throw new Error('extraction impossible : _dafCreateV2Confirmed');

// On rejoue la seule expression qui nous intéresse, telle qu'elle figure dans le portail.
const incrementer = numero => /[-_.]v\d+$/i.test(numero || '')
  ? numero.replace(/([-_.])v(\d+)$/i, (_, sep, n) => `${sep}v${parseInt(n) + 1}`)
  : `${numero || ''}${numero ? '_' : ''}v2`;

console.log('versions de DAF');

verifie('le portail n’incrémente plus le seul suffixe « -v »',
  /\[-_\.\]v\\d\+\$/.test(src[0]), true);

verifie('ancien format, séparateur tiret',
  incrementer('2.2-CASIN-VÉG-RIBESUVA-v1'), '2.2-CASIN-VÉG-RIBESUVA-v2');

verifie('nouveau format, séparateur souligné',
  incrementer('GRANDEMOTTE_CASINO_VERTHORIZON_2.1_PHILLYREAA_v1'),
  'GRANDEMOTTE_CASINO_VERTHORIZON_2.1_PHILLYREAA_v2');

verifie('passage à deux chiffres',
  incrementer('GRANDEMOTTE_CASINO_v9'), 'GRANDEMOTTE_CASINO_v10');

verifie('référence sans suffixe : on en ajoute un',
  incrementer('DAF-2.2'), 'DAF-2.2_v2');
