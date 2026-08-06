// Règle 4 de REGLES.md : le filtre de familles exclut ce qui n'est pas classé, et une variante
// suit la famille de sa ligne mère.

const { extraire, verifie } = require('./outils');

const state = {
  fournitures: [
    { id: 'a',  famille_id: 'veg' },
    { id: 'a1', famille_id: null, parent_id: 'a', is_variante: true },
    { id: 'b',  famille_id: 'min' },
    { id: 'c',  famille_id: null },
  ],
};

const { _perimetreConsultation } = extraire('pivot-entrepreneur.html',
  [/function _perimetreConsultation[\s\S]*?\n}\n/], ['_perimetreConsultation'], { state });

console.log('périmètre de consultation');

verifie('sans filtre, tout le chantier',
  _perimetreConsultation([]), ['a', 'a1', 'b', 'c']);

verifie('une famille cochée : la ligne et sa variante, rien d’autre',
  _perimetreConsultation(['veg']), ['a', 'a1']);

verifie('une ligne sans famille est écartée dès qu’un filtre est posé',
  _perimetreConsultation(['min']), ['b']);
