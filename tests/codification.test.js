// Règle 2 de REGLES.md : codification unique pour DAF et documents, briques vides omises,
// ordre par défaut retenu à l'usage.

const { extraire, verifie } = require('./outils');

const m = extraire('pivot-entrepreneur.html', [
  /const CODE_BRIQUES = \[[\s\S]*?\n\];/,
  /const CODE_DEFAUT = \[[\s\S]*?\n\];/,
  /const CODE_SEPARATEUR_DEFAUT = '_';/,
  /const _codeBrique = [^\n]*\n/,
  /const _CODE_ANCIENS = [^\n]*\n/,
  /function _codeNormaliser[\s\S]*?\n}\n/,
  /function _codeConfig[\s\S]*?\n}\n/,
  /function _composerCode[\s\S]*?\n}\n/,
  /function _codeMot[\s\S]*?\n}\n/,
], ['CODE_DEFAUT', '_codeConfig', '_composerCode']);

const commun = {
  chantier: 'Casino grande Motte', ville: 'Grande Motte', client: 'Ville de la Grande Motte',
  entreprise: 'Vert Horizon', version: 'v1', annee: '2026', date: '20260806',
};
const daf = { ...commun, poste: '2.1', type: 'Végétaux', objet: 'Phillyrea angustifolia' };
const doc = { ...commun, poste: '', type: 'PAQ', objet: "Plan d'assurance qualité" };

console.log('codification');

const ordre = m._codeConfig({});
verifie("ordre par défaut : ville, chantier, entreprise, poste, objet, version",
  ordre.map(b => b.id), ['ville', 'chantier', 'entreprise', 'poste', 'objet', 'version']);

verifie('DAF composée avec les valeurs réelles',
  m._composerCode(ordre, daf, '_'),
  'GRANDEMOTTE_CASINO_VERTHORIZON_2.1_PHILLYREAA_v1');

verifie('document : le poste absent ne laisse pas de séparateur orphelin',
  m._composerCode(ordre, doc, '_'),
  'GRANDEMOTTE_CASINO_VERTHORIZON_PLANDASSUR_v1');

verifie('une règle personnalisée est respectée',
  m._composerCode([{ id: 'entreprise', n: 4 }, { id: 'annee' }, { id: 'objet', n: 6 }], daf, '-'),
  'VERT-2026-PHILLY');

verifie('les anciennes configurations par type se ramènent à la liste unique',
  m._composerCode(m._codeConfig({ code_format: { daf: ['chantier', 'famille', 'designation'] } }), daf, '_'),
  'CASIN_VÉG_PHILLYRE');
