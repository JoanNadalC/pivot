function importDevis(event) {
  const file = event.target.files[0];
  if (!file) return;
  event.target.value = '';

  if (file.name.toLowerCase().endsWith('.pdf')) {
    importDevisPdf(file);
  } else {
    importDevisExcelCsv(file);
  }
}

// ============================================================
// COLLER TABLEAU
// ============================================================
const _CT_FIELDS_DEVIS = [
  { value: '',              label: '— Ignorer —' },
  { value: 'numero_poste',  label: 'N° poste' },
  { value: 'designation',   label: 'Désignation *' },
  { value: 'description',   label: 'Description' },
  { value: 'unite',         label: 'Unité' },
  { value: 'qte',           label: 'Quantité' },
  { value: 'prix_etude_ht', label: 'Prix HT' },
  { value: 'reference',     label: 'Référence' },
];
const _CT_FIELDS_BPU = [
  { value: '',              label: '— Ignorer —' },
  { value: 'numero_poste',  label: 'N° poste' },
  { value: 'designation',   label: 'Désignation *' },
  { value: 'description',   label: 'Description' },
  { value: 'unite',         label: 'Unité' },
  { value: 'prix_etude_ht', label: 'Prix HT' },
  { value: 'reference',     label: 'Référence' },
  { value: '__caract__',    label: '⚙ Caractéristique' },
];
// alias pour rétrocompatibilité
const _CT_FIELDS = _CT_FIELDS_DEVIS;

function _ctAutoMap(header, mode) {
  const h = header.toLowerCase();
  if (/n[°o]|num[eé]ro|poste|lot/.test(h) && !/d[eé]sig/.test(h)) return 'numero_poste';
  if (/d[eé]sig|libell[eé]|intitul[eé]|prestation|ouvrage/.test(h)) return 'designation';
  if (/description|d[eé]tail/.test(h)) return 'description';
  if (/^u$|unit[eé]|u\.m/.test(h)) return 'unite';
  if (mode !== 'bpu' && /qt[eé]|quantit[eé]|^nb$|nbre/.test(h)) return 'qte';
  if (/prix|p\.u\.|unitaire/.test(h)) return 'prix_etude_ht';
  if (/r[eé]f|code|article/.test(h)) return 'reference';
  // En mode BPU, les colonnes non reconnues sont des caractéristiques
  if (mode === 'bpu' && h) return '__caract__';
  return '';
}

function openCollerTableauModal(mode = 'devis') {
  window._ctMode = mode;
  const isBpu = mode === 'bpu';
  const title = isBpu ? '📐 Coller un BPU' : '📋 Coller un devis';
  const color = isBpu ? 'blue' : 'purple';
  showModal(`
    <div class="flex items-center justify-between mb-3">
      <h2 class="text-lg font-semibold text-gray-800">${title}</h2>
      <button onclick="closeModal()" class="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
    </div>
    <p class="text-sm text-gray-500 mb-3">Sélectionnez votre tableau dans Excel ou Word, copiez-le (Ctrl+C), puis cliquez dans la zone ci-dessous et collez (Ctrl+V).</p>
    ${isBpu ? '<p class="text-xs text-blue-600 bg-blue-50 rounded-lg px-3 py-2 mb-3">💡 Les colonnes marquées <strong>⚙ Caractéristique</strong> seront importées comme caractéristiques techniques de chaque poste.</p>' : ''}
    <div id="ct-paste-zone"
      tabindex="0"
      class="w-full min-h-[120px] border-2 border-dashed border-purple-300 rounded-xl flex items-center justify-center text-gray-400 text-sm cursor-text focus:outline-none focus:border-purple-500 focus:bg-purple-50 transition"
      style="user-select:none">
      📋 Cliquez ici puis Ctrl+V
    </div>
    <p class="text-xs text-gray-400 mt-2">Compatible Excel, Calc, Word, tableaux web…</p>
    <button onclick="closeModal()" class="w-full mt-4 border py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Annuler</button>`);

  setTimeout(() => {
    const zone = document.getElementById('ct-paste-zone');
    if (!zone) return;
    zone.focus();
    zone.addEventListener('paste', e => {
      e.preventDefault();
      // Essayer d'abord le HTML (Excel/Word gardent la structure)
      const html = e.clipboardData.getData('text/html');
      const text = e.clipboardData.getData('text/plain');
      let rows = html ? _ctParseHtml(html) : null;
      if (!rows || rows.length < 1) rows = _ctParseText(text);
      if (!rows || rows.length < 1) return toast('Aucune donnée détectée', 'err');
      _ctRenderGrid(rows);
    });
  }, 80);
}

function _ctParseHtml(html) {
  const div = document.createElement('div');
  div.innerHTML = html;
  const trs = div.querySelectorAll('tr');
  if (!trs.length) return null;
  return Array.from(trs).map(tr =>
    Array.from(tr.querySelectorAll('td,th')).map(td => td.innerText.trim())
  ).filter(r => r.length);
}

function _ctParseText(text) {
  if (!text.trim()) return null;
  const lines = text.trim().split('\n').map(l => l.replace(/\r$/, ''));
  const sep = lines[0].includes('\t') ? '\t' : lines[0].includes(';') ? ';' : ',';
  return lines.map(l => l.split(sep).map(c => c.trim().replace(/^"|"$/g, '')));
}

function _ctRenderGrid(rows) {
  window._ctRows = rows;
  const mode = window._ctMode || 'devis';
  const isBpu = mode === 'bpu';
  const FIELDS = isBpu ? _CT_FIELDS_BPU : _CT_FIELDS_DEVIS;
  const accentColor = isBpu ? 'blue' : 'purple';
  const nbCols = Math.max(...rows.map(r => r.length));
  const firstRow = rows[0] || [];

  const headerSelects = Array.from({length: nbCols}, (_, i) => {
    const auto = _ctAutoMap(firstRow[i] || '', mode);
    return `<th class="p-1 bg-${accentColor}-50 min-w-[110px]">
      <select data-col="${i}" class="ct-map w-full border rounded px-1 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-${accentColor}-400">
        ${FIELDS.map(f => `<option value="${f.value}"${auto===f.value?' selected':''}>${f.label}</option>`).join('')}
      </select>
    </th>`;
  }).join('');

  const bodyRows = rows.map((row, ri) => {
    const isHeader = ri === 0;
    const tds = Array.from({length: nbCols}, (_, ci) =>
      `<td contenteditable="true" data-row="${ri}" data-col="${ci}"
        class="ct-cell px-2 py-1 text-xs border border-gray-100 focus:outline-none focus:bg-yellow-50 min-w-[80px] max-w-[200px]
          ${isHeader ? 'bg-gray-50 text-gray-400 italic' : ''}"
        >${escHtml(row[ci] || '')}</td>`
    ).join('');
    return `<tr>${tds}</tr>`;
  }).join('');

  const count = rows.length > 1 ? rows.length - 1 : rows.length;

  document.getElementById('modal-content').innerHTML = `
    <div class="flex items-center justify-between mb-3">
      <h2 class="text-lg font-semibold text-gray-800">📋 Assigner les colonnes</h2>
      <button onclick="closeModal()" class="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
    </div>
    <div class="flex items-center gap-4 mb-3">
      <p class="text-sm text-gray-500 flex-1">${rows.length} lignes • assignez chaque colonne à un champ</p>
      <label class="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer whitespace-nowrap">
        <input type="checkbox" id="ct-has-header" checked onchange="ctToggleHeader()" class="accent-purple-600">
        1ère ligne = en-têtes
      </label>
    </div>
    <div class="overflow-auto border rounded-lg mb-3" style="max-height:340px">
      <table class="border-collapse text-left" id="ct-table">
        <thead><tr>${headerSelects}</tr></thead>
        <tbody>${bodyRows}</tbody>
      </table>
    </div>
    <div class="flex flex-wrap gap-2">
      <button onclick="ctImporter()" id="ct-btn-import"
        class="flex-1 bg-green-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-green-700 whitespace-nowrap">
        ✓ Importer ${count} lignes
      </button>
      <button onclick="openCollerTableauModal(window._ctMode)" class="border py-2 px-3 rounded-lg text-sm text-gray-600 hover:bg-gray-50 whitespace-nowrap">← Retour</button>
      <div class="relative" id="ct-suppr-wrap">
        <button onclick="document.getElementById('ct-suppr-menu').classList.toggle('hidden')"
          class="border border-orange-300 text-orange-700 py-2 px-3 rounded-lg text-sm hover:bg-orange-50 flex items-center gap-1 whitespace-nowrap">
          🗑 ▾
        </button>
        <div id="ct-suppr-menu" class="hidden absolute bottom-full mb-1 right-0 bg-white border rounded-lg shadow-lg text-sm z-10 whitespace-nowrap">
          <button onclick="ctSupprimerLignes('qte');document.getElementById('ct-suppr-menu').classList.add('hidden')"
            class="block w-full text-left px-4 py-2 hover:bg-orange-50 text-orange-700">Sans quantité</button>
          <button onclick="ctSupprimerLignes('unite');document.getElementById('ct-suppr-menu').classList.add('hidden')"
            class="block w-full text-left px-4 py-2 hover:bg-orange-50 text-orange-700">Sans unité</button>
          <button onclick="ctSupprimerLignes('both');document.getElementById('ct-suppr-menu').classList.add('hidden')"
            class="block w-full text-left px-4 py-2 hover:bg-orange-50 text-orange-700">Sans quantité et sans unité</button>
          <hr class="my-1">
          <button onclick="ctFusionnerDoublons();document.getElementById('ct-suppr-menu').classList.add('hidden')"
            class="block w-full text-left px-4 py-2 hover:bg-blue-50 text-blue-700">Fusionner les doublons (même N° poste + désignation)</button>
        </div>
      </div>
    </div>`;

  // Sync edits back to _ctRows
  document.getElementById('ct-table').addEventListener('input', e => {
    const td = e.target.closest('td.ct-cell');
    if (!td) return;
    const r = parseInt(td.dataset.row), c = parseInt(td.dataset.col);
    if (!window._ctRows[r]) window._ctRows[r] = [];
    window._ctRows[r][c] = td.innerText.trim();
  });
}

async function ctSupprimerLignes(mode = 'both') {
  // Contexte modal (grille d'import ouverte)
  const tbody = document.querySelector('#ct-table tbody');
  if (tbody) {
    const hasHeader = document.getElementById('ct-has-header')?.checked ?? true;
    const qteCol = [], uniteCol = [];
    document.querySelectorAll('.ct-map').forEach(sel => {
      if (sel.value === 'qte') qteCol.push(parseInt(sel.dataset.col));
      if (sel.value === 'unite') uniteCol.push(parseInt(sel.dataset.col));
    });
    let supprimees = 0;
    Array.from(tbody.querySelectorAll('tr')).forEach((tr, idx) => {
      if (hasHeader && idx === 0) return;
      const cells = tr.querySelectorAll('td.ct-cell');
      const hasQte = qteCol.length ? qteCol.some(ci => cells[ci]?.innerText?.trim()) : false;
      const hasUnite = uniteCol.length ? uniteCol.some(ci => cells[ci]?.innerText?.trim()) : false;
      const suppr = mode === 'qte' ? !hasQte
                  : mode === 'unite' ? !hasUnite
                  : !hasQte && !hasUnite;
      if (suppr) { tr.remove(); supprimees++; }
    });
    if (!supprimees) return toast('Aucune ligne à supprimer');
    window._ctRows = Array.from(tbody.querySelectorAll('tr')).map(tr =>
      Array.from(tr.querySelectorAll('td.ct-cell')).map(td => td.innerText.trim())
    );
    const dataCount = hasHeader ? Math.max(0, window._ctRows.length - 1) : window._ctRows.length;
    const btn = document.getElementById('ct-btn-import');
    if (btn && !btn.disabled) btn.textContent = `✓ Importer ${dataCount} lignes`;
    toast(`${supprimees} ligne(s) supprimée(s)`);
    return;
  }

  // Contexte barre d'outils : opère sur state.fournitures du chantier en cours
  const fournitures = state.fournitures || [];
  let aSupprimer;

  aSupprimer = fournitures.filter(f => {
    const hasQte = f.qte != null && f.qte !== '';
    const hasUnite = f.unite != null && f.unite !== '';
    return mode === 'qte' ? !hasQte
         : mode === 'unite' ? !hasUnite
         : !hasQte && !hasUnite;
  });

  if (!aSupprimer.length) return toast('Aucune ligne à supprimer');

  const label = mode === 'qte' ? 'sans quantité'
              : mode === 'unite' ? 'sans unité'
              : 'sans quantité et sans unité';
  if (!await showConfirm(`Supprimer ${aSupprimer.length} fourniture(s) ${label} ?`)) return;

  pushUndo('delete', aSupprimer);
  const ids = aSupprimer.map(f => f.id);
  _cascadeDeleteFournitures(ids).then(() => {
    aSupprimer.forEach(f => {
      const idx = state.fournitures.findIndex(x => x.id === f.id);
      if (idx >= 0) state.fournitures.splice(idx, 1);
    });
    renderFournitures();
    toast(`${aSupprimer.length} ligne(s) supprimée(s)`);
  }).catch(err => toast(err.message, 'err'));
}

function ctToggleHeader() {
  const hasH = document.getElementById('ct-has-header').checked;
  const rows = window._ctRows || [];
  const tbody = document.querySelector('#ct-table tbody');
  if (tbody) {
    const firstTr = tbody.querySelector('tr');
    if (firstTr) firstTr.querySelectorAll('td').forEach(td => {
      td.classList.toggle('bg-gray-50', hasH);
      td.classList.toggle('text-gray-400', hasH);
      td.classList.toggle('italic', hasH);
    });
  }
  const count = hasH ? Math.max(0, rows.length - 1) : rows.length;
  const btn = document.getElementById('ct-btn-import');
  if (btn) btn.textContent = `✓ Importer ${count} lignes`;
}

async function ctImporter() {
  const rows = window._ctRows || [];
  const mode = window._ctMode || 'devis';
  const hasHeader = document.getElementById('ct-has-header')?.checked ?? true;
  const dataRows = hasHeader ? rows.slice(1) : rows;

  const mappings = {};
  document.querySelectorAll('.ct-map').forEach(sel => {
    if (sel.value) mappings[parseInt(sel.dataset.col)] = sel.value;
  });

  // Récupérer les labels des colonnes caractéristiques (pour le nom de la clé)
  const colLabels = {};
  if (hasHeader) {
    rows[0].forEach((h, i) => { colLabels[i] = h.trim() || `Col ${i+1}`; });
  } else {
    Object.keys(mappings).forEach(i => { colLabels[i] = `Col ${parseInt(i)+1}`; });
  }

  if (!Object.values(mappings).includes('designation'))
    return toast('Assignez au moins la colonne "Désignation"', 'err');

  let ordre = state.fournitures.length
    ? Math.max(...state.fournitures.map(f => f.ordre || 0)) + 1 : 0;

  const toInsert = dataRows
    .filter(row => row?.some(c => c?.trim()))
    .map(row => {
      const obj = {
        chantier_id: state.currentChantier.id,
        lot_id: state.currentLot?.id ?? null,
        ordre: ordre++
      };
      const caracts = [];
      Object.entries(mappings).forEach(([ci, field]) => {
        const val = (row[parseInt(ci)] || '').trim();
        if (!val) return;
        if (field === '__caract__') {
          caracts.push({ cle: colLabels[ci] || `Col ${ci}`, valeur: val });
        } else if (field === 'qte' || field === 'prix_etude_ht') {
          const n = parseFloat(val.replace(/\s/g, '').replace(',', '.'));
          obj[field] = isNaN(n) ? null : n;
        } else {
          obj[field] = val;
        }
      });
      if (caracts.length) obj.caracteristiques = caracts;
      return obj;
    })
    .filter(o => o.designation);

  if (!toInsert.length) return toast('Aucune ligne avec une désignation valide', 'err');

  const btn = document.getElementById('ct-btn-import');
  if (btn) { btn.disabled = true; btn.innerHTML = '⏳ Import en cours…'; }

  try {
    const { error } = await db.from('fournitures').insert(toInsert);
    if (error) throw error;
    closeModal();
    toast(`${toInsert.length} poste(s) importé(s)`);
    await loadFournitures();
  } catch (err) {
    if (btn) { btn.disabled = false; btn.innerHTML = `✓ Importer ${toInsert.length} lignes`; }
    toast(err.message, 'err');
  }
}

function importDevisExcelCsv(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = new Uint8Array(e.target.result);
      const wb = XLSX.read(data, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

      let headerRowIdx = 0;
      for (let i = 0; i < Math.min(10, rows.length); i++) {
        if (rows[i].filter(c => String(c).trim() !== '').length >= 3) {
          headerRowIdx = i; break;
        }
      }
      const headers = rows[headerRowIdx].map(h => String(h).trim());
      const dataRows = rows.slice(headerRowIdx + 1).filter(r =>
        r.some(c => String(c).trim() !== '')
      );
      if (!headers.length || !dataRows.length) {
        return toast('Fichier vide ou non reconnu', 'err');
      }
      openImportMappingModal(headers, dataRows);
    } catch (err) {
      toast('Erreur lecture fichier : ' + err.message, 'err');
    }
  };
  reader.readAsArrayBuffer(file);
}

async function importBpu(event) {
  const file = event.target.files?.[0];
  event.target.value = '';
  if (!file) return;
  toast('Lecture du BPU…');
  try {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
    if (!rows.length) return toast('Fichier vide ou non reconnu', 'err');

    // Colonnes attendues (insensible à la casse) :
    // N°Poste, Désignation, Qté, Unité, Prix étude HT, + toutes autres colonnes = caractéristiques
    const FIXED = ['n°poste','numero_poste','poste','désignation','designation','libellé','libelle',
                   'qté','qte','quantité','quantite','unité','unite','u.',
                   'prix','prix etude ht','prix_etude_ht','p.u.ht'];
    const get = (row, ...keys) => {
      for (const k of keys) {
        const found = Object.keys(row).find(rk => rk.toLowerCase().trim() === k);
        if (found && String(row[found]).trim()) return String(row[found]).trim();
      }
      return '';
    };

    let count = 0, ordre = (state.fournitures.length ? Math.max(...state.fournitures.map(f => f.ordre || 0)) + 1 : 0);
    const famId = state.activeFamilles?.[0] || state.fournitures[0]?.famille_id || null;

    for (const row of rows) {
      const designation = get(row, 'désignation', 'designation', 'libellé', 'libelle');
      if (!designation) continue;

      // Caractéristiques = toutes les colonnes qui ne sont pas des colonnes fixes
      const caract = Object.entries(row)
        .filter(([k, v]) => !FIXED.includes(k.toLowerCase().trim()) && String(v).trim())
        .map(([k, v]) => ({ cle: k.trim(), valeur: String(v).trim() }));

      const { data, error } = await db.from('fournitures').insert({
        chantier_id: state.currentChantier.id,
        lot_id: state.currentLot?.id ?? null,
        famille_id: famId,
        numero_poste: get(row, 'n°poste', 'numero_poste', 'poste') || null,
        designation,
        qte: parseFloat(get(row, 'qté', 'qte', 'quantité', 'quantite')) || null,
        unite: get(row, 'unité', 'unite', 'u.') || 'U',
        prix_etude_ht: parseFloat(get(row, 'prix etude ht', 'prix_etude_ht', 'prix', 'p.u.ht')) || null,
        caracteristiques: caract.length ? caract : null,
        ordre: ordre++
      }).select('*, famille:familles_fournitures(nom,icone,couleur)').single();
      if (!error) { state.fournitures.push(data); count++; }
    }
    renderFournitures();
    toast(`✅ ${count} fourniture(s) BPU importée(s) !`);
  } catch(err) { toast('Erreur BPU : ' + err.message, 'err'); }
}

async function importDevisPdf(file) {
  toast('Lecture du PDF en cours…');
  try {
    // Configurer le worker PDF.js
    const pdfjsLib = window['pdfjs-dist/build/pdf'];
    if (!pdfjsLib) throw new Error('PDF.js non chargé — vérifiez votre connexion');
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    console.log('[PDF] pdfjsLib ok, version:', pdfjsLib.version);

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    // Extraire tous les items texte avec leurs coordonnées
    const allItems = [];
    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const viewport = page.getViewport({ scale: 1 });
      const content = await page.getTextContent();
      content.items.forEach(item => {
        if (!item.str.trim()) return;
        allItems.push({
          text: item.str.trim(),
          x:    Math.round(item.transform[4]),
          y:    Math.round(viewport.height - item.transform[5]),
          w:    Math.round(item.width || 0),  // largeur fournie par PDF.js en pts viewport
          page: p
        });
      });
    }

    if (!allItems.length) return toast('Aucun texte détecté dans ce PDF', 'err');

    // Regrouper les items par ligne (y proche à ±5px, même page)
    allItems.sort((a, b) => a.page - b.page || a.y - b.y || a.x - b.x);

    const lineGroups = [];
    let curLine = [allItems[0]];
    for (let i = 1; i < allItems.length; i++) {
      const prev = allItems[i - 1];
      const cur  = allItems[i];
      if (cur.page === prev.page && Math.abs(cur.y - prev.y) <= 5) {
        curLine.push(cur);
      } else {
        lineGroups.push(curLine);
        curLine = [cur];
      }
    }
    lineGroups.push(curLine);

    if (!lineGroups.length) return toast('Impossible de reconstruire le tableau depuis ce PDF', 'err');

    window._pdfLineGroups = lineGroups;
    toast(`PDF lu : ${lineGroups.length} lignes — analyse des colonnes…`);
    // Ouvrir le modal avec tableau vide d'abord, puis remplir après rendu
    openPdfRowPickerModal(null);
  } catch (err) {
    console.error('PDF import error', err);
    toast('Erreur lecture PDF : ' + err.message, 'err');
  }
}

function buildTableRows(lineGroups, gapMin) {
  return lineGroups
    .filter(line => line.length >= 1)
    .map(line => {
      const sorted = [...line].sort((a, b) => a.x - b.x);
      const cells = [];
      let currentCell = sorted[0].text;
      let currentEndX = sorted[0].x + (sorted[0].w || sorted[0].text.length * 6);
      for (let i = 1; i < sorted.length; i++) {
        const gap = sorted[i].x - currentEndX;
        if (gap > gapMin) {
          cells.push(currentCell.trim());
          currentCell = sorted[i].text;
        } else {
          currentCell += ' ' + sorted[i].text;
        }
        currentEndX = sorted[i].x + (sorted[i].w || sorted[i].text.length * 6);
      }
      cells.push(currentCell.trim());
      return cells.filter(c => c !== '');
    })
    .filter(row => row.length >= 1);
}

// ── Parser BPU à structure en blocs (pas de tableau) ──────────────────────────
function parseBpuBlocks(lineGroups) {
  const POSTE_RE = /^(\d{3,4}(-\d{2})?(-[A-Z])?(-\d+)?|M-\d{2})$/;
  const UNITE_MAP = [
    [/^LE FORFAIT/i,          'Forfait'],
    [/^L[''']UNITE/i,         'U'],
    [/^LE METRE CARRE/i,      'm²'],
    [/^LE METRE CUBE/i,       'm³'],
    [/^LE METRE LINEAIRE/i,   'ml'],
  ];

  // Construire des lignes triées par X
  const lines = lineGroups.map(lg => [...lg].sort((a, b) => a.x - b.x));

  // Trouver le seuil X de la colonne gauche à partir des postes détectés
  const leftXs = lines
    .filter(l => l.length >= 1 && POSTE_RE.test(l[0].text.trim()))
    .map(l => l[0].x);
  if (leftXs.length < 2) return [];
  const maxLeftX = Math.max(...leftXs) + 30;

  const blocks = [];
  let cur = null;

  for (const line of lines) {
    const firstText = line[0].text.trim();

    if (POSTE_RE.test(firstText) && line[0].x <= maxLeftX) {
      if (cur) blocks.push(cur);
      const restText = line.slice(1).map(i => i.text).join(' ').trim();
      cur = { poste: firstText, textLines: restText ? [restText] : [], unite: '' };
    } else if (cur) {
      const lineText = line.map(i => i.text).join(' ').trim();
      if (!lineText) continue;

      let isUnite = false;
      for (const [re, val] of UNITE_MAP) {
        if (re.test(lineText)) { cur.unite = val; isUnite = true; break; }
      }
      if (!isUnite &&
          !lineText.match(/^-\s*\d+\s*-$/) &&
          !lineText.includes('Phase DCE') &&
          !lineText.includes('Désimperméabilisation') &&
          !lineText.includes('DEPARTEMENT') &&
          !lineText.match(/^\d+$/)
      ) {
        cur.textLines.push(lineText);
      }
    }
  }
  if (cur) blocks.push(cur);

  return blocks
    .filter(b => b.textLines.length > 0)
    .map(b => {
      const nonEmpty = b.textLines.filter(l => l.trim());
      const designation = nonEmpty[0] || b.poste;
      const caracteristiques = nonEmpty.slice(1)
        .filter(l => !l.match(/^Ce prix tient compte/i))
        .join('\n');
      return { poste: b.poste, designation, unite: b.unite, caracteristiques };
    })
    .filter(b => b.designation && b.designation.length > 2);
}

function openBpuBlocksModal(blocks) {
  closeModal();
  const rows = blocks.map((b, i) => `
    <tr class="hover:bg-gray-50">
      <td class="px-2 py-1 border text-xs font-mono font-bold text-amber-700">${escHtml(b.poste)}</td>
      <td class="px-2 py-1 border text-xs max-w-xs truncate" title="${escHtml(b.designation)}">${escHtml(b.designation.slice(0, 60))}${b.designation.length > 60 ? '…' : ''}</td>
      <td class="px-2 py-1 border text-xs text-center text-gray-500">${escHtml(b.unite || '—')}</td>
      <td class="px-2 py-1 border text-xs text-gray-400">${b.caracteristiques ? '✓' : ''}</td>
    </tr>`).join('');

  showModal(`
    <h2 class="text-lg font-bold mb-1">📐 Import BPU structuré</h2>
    <p class="text-xs text-gray-500 mb-3">${blocks.length} postes reconnus dans ce BPU. Choisissez l'action :</p>
    <div class="overflow-auto max-h-64 border rounded mb-3">
      <table class="w-full">
        <thead class="bg-gray-50 sticky top-0">
          <tr>
            <th class="px-2 py-1 border text-xs text-left font-semibold">N° poste</th>
            <th class="px-2 py-1 border text-xs text-left font-semibold">Désignation</th>
            <th class="px-2 py-1 border text-xs text-center font-semibold">Unité</th>
            <th class="px-2 py-1 border text-xs text-center font-semibold">Caract.</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <div class="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-xs text-blue-800 mb-3">
      <strong>Mettre à jour :</strong> enrichit les caractéristiques des fournitures existantes (même N° poste). Aucune nouvelle ligne créée.<br>
      <strong>Créer les fournitures :</strong> ajoute toutes les lignes comme nouvelles fournitures du chantier.
    </div>
    <div class="flex gap-2">
      <button onclick="executeBpuBlocksImport('update')" class="flex-1 bg-amber-500 text-white py-2 rounded-lg text-sm font-medium hover:bg-amber-600">Mettre à jour caractéristiques</button>
      <button onclick="executeBpuBlocksImport('create')" class="flex-1 bg-green-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-green-700">Créer les fournitures</button>
      <button onclick="closeModal()" class="border px-4 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Annuler</button>
    </div>
  `);
}

async function executeBpuBlocksImport(mode) {
  const blocks = window._pdfBpuBlocks;
  if (!blocks || !blocks.length) return;
  closeModal();

  if (mode === 'update') {
    toast('Mise à jour des caractéristiques BPU…');
    let updated = 0, notFound = 0;
    for (const b of blocks) {
      const fourn = state.fournitures.find(f => f.numero_poste === b.poste);
      if (!fourn) { notFound++; continue; }
      const merged = { ...(fourn.caracteristiques || {}), ...Object.fromEntries(
        b.caracteristiques.split('\n')
          .filter(l => l.trim())
          .map((l, i) => [`spec_${i+1}`, l.trim()])
      )};
      if (b.designation) merged['designation_bpu'] = b.designation;
      if (b.unite)       merged['unite_bpu'] = b.unite;
      try {
        const { error } = await db.from('fournitures')
          .update({ caracteristiques: merged })
          .eq('id', fourn.id);
        if (error) throw error;
        fourn.caracteristiques = merged;
        updated++;
      } catch(err) { console.error('bpu update', err); }
    }
    toast(`BPU : ${updated} poste(s) mis à jour${notFound ? `, ${notFound} non trouvés` : ''}`, updated ? 'ok' : 'err');
    renderFournitures();

  } else {
    // Créer les fournitures
    toast('Création des fournitures BPU…');
    if (!state.currentChantier) return toast('Aucun chantier sélectionné', 'err');

    const toInsert = blocks.map((b, i) => ({
      chantier_id:      state.currentChantier.id,
      lot_id:           state.currentLot?.id ?? null,
      numero_poste:     b.poste,
      designation:      b.designation,
      unite:            b.unite || null,
      ordre:            (state.fournitures.length + i + 1) * 10,
      caracteristiques: b.caracteristiques
        ? Object.fromEntries(
            b.caracteristiques.split('\n')
              .filter(l => l.trim())
              .map((l, i) => [`spec_${i+1}`, l.trim()])
          )
        : null,
    }));

    const snap = [...state.fournitures];
    const { data, error } = await db.from('fournitures').insert(toInsert).select();
    if (error) { toast('Erreur insertion : ' + error.message, 'err'); return; }
    state.fournitures = [...state.fournitures, ...(data || [])];
    pushUndo('delete', snap);
    toast(`${toInsert.length} fournitures créées depuis le BPU`, 'ok');
    renderFournitures();
  }
}

function openPdfRowPickerModal(tableRows) {
  window._pdfTableRows = tableRows;
  window._pdfPickedIdx = 0;

  showModal(`
    <h2 class="text-lg font-bold mb-1">Sélectionner la ligne d'en-tête</h2>
    <p class="text-xs text-gray-500 mb-2">Cliquez sur la ligne qui contient les noms de colonnes. Les lignes au-dessus seront ignorées.</p>
    <div class="flex items-center gap-3 mb-3 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
      <span class="text-xs text-amber-700 whitespace-nowrap">Séparation colonnes :</span>
      <input type="range" id="pdf-gap-slider" min="2" max="40" value="8" step="1"
        class="flex-1" oninput="pdfUpdateGap(this.value)">
      <span id="pdf-gap-val" class="text-xs font-mono w-8 text-amber-800">8px</span>
    </div>
    <div class="overflow-auto max-h-72 border rounded mb-3">
      <table class="w-full" id="pdf-row-picker-table">
        <tbody><tr><td colspan="10" class="px-4 py-8 text-center text-gray-400">
          <div class="text-2xl mb-2">⏳</div>
          <div class="text-sm">Analyse des colonnes en cours…</div>
        </td></tr></tbody>
      </table>
    </div>
    <p class="text-xs text-gray-400 mb-3" id="pdf-picker-info"> </p>
    <div class="flex gap-3">
      <button onclick="confirmPdfHeader()" class="flex-1 bg-green-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-green-700">Confirmer et mapper les colonnes →</button>
      <button onclick="closeModal()" class="flex-1 border py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Annuler</button>
    </div>
  `);

  setTimeout(() => {
    const rows = buildTableRows(window._pdfLineGroups, 8);
    window._pdfTableRows = rows;
    const headerKeywords = ['designation','libelle','description','intitule','article','ouvrage','poste','qte','quantite','unite','prix','pu'];
    const norm = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').trim();
    const suggested = rows.findIndex(row =>
      row.filter(Boolean).length >= 2 &&
      row.some(c => headerKeywords.some(kw => norm(c).includes(kw)))
    );
    window._pdfPickedIdx = suggested >= 0 ? suggested : 0;
    pdfRenderTableBody(rows, window._pdfPickedIdx);

    // Pré-calculer les blocs BPU pour usage si l'utilisateur bascule en mode BPU
    window._pdfBpuBlocks = parseBpuBlocks(window._pdfLineGroups);
  }, 0);
}

function pdfRenderTableBody(tableRows, selIdx) {
  const tbody = document.querySelector('#pdf-row-picker-table tbody');
  if (!tbody) return;
  tbody.innerHTML = tableRows.map((row, i) => {
    const isSel   = i === selIdx;
    const isAbove = i < selIdx;
    const cells   = row.filter(Boolean).slice(0, 8).map(c =>
      `<td class="px-2 py-1 border text-xs max-w-32 truncate">${escHtml(String(c).slice(0,40))}</td>`
    ).join('');
    return `<tr class="cursor-pointer ${isSel ? 'bg-green-100 font-semibold' : isAbove ? 'bg-gray-50 opacity-40' : 'hover:bg-blue-50'}"
      onclick="pdfPickRow(${i})">
      <td class="px-2 py-1 border text-xs text-gray-400 w-8">${i+1}</td>
      ${cells}
      <td class="px-2 py-1 border text-center text-xs">${isSel ? '✅' : ''}</td>
    </tr>`;
  }).join('');
  const info = document.getElementById('pdf-picker-info');
  if (info) info.textContent = `Ligne ${selIdx + 1} sélectionnée · ${tableRows.length - selIdx - 1} lignes de données`;
}

function pdfPickRow(idx) {
  window._pdfPickedIdx = idx;
  pdfRenderTableBody(window._pdfTableRows, idx);
}

function pdfUpdateGap(val) {
  document.getElementById('pdf-gap-val').textContent = val + 'px';
  // Afficher sablier sur le tableau pendant le recalcul
  const tbody = document.querySelector('#pdf-row-picker-table tbody');
  if (tbody) tbody.innerHTML = '<tr><td colspan="10" class="px-4 py-6 text-center text-gray-400 text-sm">⏳ Recalcul en cours…</td></tr>';
  // setTimeout 0 pour laisser le DOM se mettre à jour avant le calcul lourd
  setTimeout(() => {
    const tableRows = buildTableRows(window._pdfLineGroups, parseInt(val));
    window._pdfTableRows = tableRows;
    const sel = Math.min(window._pdfPickedIdx ?? 0, tableRows.length - 1);
    window._pdfPickedIdx = sel;
    pdfRenderTableBody(tableRows, sel);
  }, 0);
}

function confirmPdfHeader() {
  const tableRows = window._pdfTableRows;
  const idx       = window._pdfPickedIdx ?? 0;
  const headers   = tableRows[idx].map((h, i) => h || `Colonne ${i + 1}`);
  const dataRows  = tableRows.slice(idx + 1).filter(r => r.some(c => c !== ''));
  if (!dataRows.length) { toast('Aucune ligne de données sous cet en-tête', 'err'); return; }
  window._pdfTableRows = null;
  openImportMappingModal(headers, dataRows);
}

// Regroupe un tableau de valeurs numériques en clusters séparés par un gap minimum
function clusterValues(values, minGap) {
  if (!values.length) return [];
  const clusters = [values[0]];
  for (let i = 1; i < values.length; i++) {
    if (values[i] - values[i - 1] > minGap) {
      clusters.push(values[i]);
    }
  }
  return clusters;
}

function openImportMappingModal(headers, dataRows) {
  // Détection automatique des colonnes (heuristique sur les noms)
  const normalize = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
  const detect = (...keywords) => {
    const idx = headers.findIndex(h => keywords.some(kw => normalize(h).includes(kw)));
    return idx >= 0 ? idx : '';
  };

  const guessPoste      = detect('poste', 'n°', 'num', 'article', 'ref lot');
  const guessDesign     = detect('designation', 'libelle', 'description', 'intitule', 'travaux');
  const guessQte        = detect('qte', 'quantite', 'quant');
  const guessUnite      = detect('unite', 'unité', ' u ', 'unit');
  const guessPrix       = detect('pu ht', 'prix unit', 'prix ht', 'p.u', 'tarif', 'montant u');

  const opts = (selected) => headers.map((h, i) =>
    `<option value="${i}" ${selected === i ? 'selected' : ''}>${h || '(col ' + (i+1) + ')'}</option>`
  ).join('');
  const noneOpt = '<option value="">— ignorer —</option>';

  // Aperçu des 3 premières lignes
  const preview = dataRows.slice(0, 3).map(r =>
    `<tr>${r.slice(0, Math.min(headers.length, 8)).map(c =>
      `<td class="px-2 py-1 text-xs border text-gray-600 max-w-28 truncate">${String(c).slice(0, 30)}</td>`
    ).join('')}</tr>`
  ).join('');
  const previewHeaders = headers.slice(0, 8).map(h =>
    `<th class="px-2 py-1 text-xs border bg-gray-100 max-w-28 truncate">${h || '?'}</th>`
  ).join('');

  showModal(`
    <h2 class="text-lg font-bold mb-1">Import — Mapping des colonnes</h2>
    <p class="text-xs text-gray-400 mb-3">${dataRows.length} lignes détectées</p>

    <!-- Mode import -->
    <div class="flex gap-2 mb-4">
      <button id="mode-btn-devis" onclick="setImportMode('devis')"
        class="flex-1 py-2 rounded-lg text-sm font-medium border-2 border-green-600 bg-green-600 text-white">
        📋 Devis / Fournitures
      </button>
      <button id="mode-btn-bpu" onclick="setImportMode('bpu')"
        class="flex-1 py-2 rounded-lg text-sm font-medium border-2 border-gray-300 text-gray-600 hover:bg-gray-50">
        📐 BPU (caractéristiques)
      </button>
    </div>
    <div id="mode-bpu-info" class="hidden bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3 text-xs text-amber-800">
      Mode BPU : les lignes sont <strong>mises à jour</strong> par correspondance sur le N° de poste. Aucune nouvelle fourniture ne sera créée. Mappez les colonnes de caractéristiques ci-dessous.
    </div>
    <div id="mode-devis-info" class="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 mb-3 text-xs text-blue-800">
      Mode devis : de nouvelles fournitures sont créées pour chaque ligne.
    </div>

    <div class="overflow-x-auto mb-4 border rounded">
      <table class="text-xs"><thead><tr>${previewHeaders}</tr></thead><tbody>${preview}</tbody></table>
    </div>

    <!-- Colonnes communes -->
    <div class="grid grid-cols-2 gap-3 mb-2 text-sm">
      <div>
        <label class="block text-xs text-gray-500 mb-1 font-semibold">N° de poste *</label>
        <select id="map-poste" class="w-full border rounded px-2 py-1 text-sm">${noneOpt}${opts(guessPoste)}</select>
      </div>
      <div id="map-design-wrap">
        <label class="block text-xs text-gray-500 mb-1 font-semibold">Désignation *</label>
        <select id="map-design" class="w-full border rounded px-2 py-1 text-sm">${noneOpt}${opts(guessDesign)}</select>
      </div>
      <div id="map-desc-wrap">
        <label class="block text-xs text-gray-500 mb-1">Description / détail</label>
        <select id="map-desc" class="w-full border rounded px-2 py-1 text-sm">${noneOpt}${opts('')}</select>
      </div>
      <div id="map-qte-wrap">
        <label class="block text-xs text-gray-500 mb-1">Quantité</label>
        <select id="map-qte" class="w-full border rounded px-2 py-1 text-sm">${noneOpt}${opts(guessQte)}</select>
      </div>
      <div id="map-unite-wrap">
        <label class="block text-xs text-gray-500 mb-1">Unité</label>
        <select id="map-unite" class="w-full border rounded px-2 py-1 text-sm">${noneOpt}${opts(guessUnite)}</select>
      </div>
      <div id="map-prix-wrap">
        <label class="block text-xs text-gray-500 mb-1">Prix unitaire HT marché <span class="text-green-700 font-semibold">(DQE / devis)</span></label>
        <select id="map-prix-marche" class="w-full border rounded px-2 py-1 text-sm">${noneOpt}${opts(guessPrix)}</select>
      </div>
      <div id="map-prix-etude-wrap">
        <label class="block text-xs text-gray-500 mb-1">Prix unitaire HT étude</label>
        <select id="map-prix" class="w-full border rounded px-2 py-1 text-sm">${noneOpt}${opts('')}</select>
      </div>
    </div>

    <!-- Colonnes caractéristiques (mode BPU) -->
    <div id="bpu-caract-section" class="hidden mb-3">
      <p class="text-xs font-semibold text-gray-600 mb-2">Colonnes à importer comme caractéristiques :</p>
      <div id="bpu-caract-cols" class="space-y-1 max-h-36 overflow-y-auto border rounded p-2">
        ${headers.map((h, i) => `
          <label class="flex items-center gap-2 text-xs hover:bg-gray-50 p-1 rounded cursor-pointer">
            <input type="checkbox" class="bpu-col-cb" value="${i}" ${i > 0 ? 'checked' : ''}>
            <span class="font-medium">${h || '(col ' + (i+1) + ')'}</span>
            → nom de la caractéristique :
            <input type="text" class="bpu-col-name border rounded px-1 py-0.5 text-xs flex-1" value="${h || ''}">
          </label>
        `).join('')}
      </div>
    </div>

    <div class="flex gap-3 mt-4">
      <button onclick="executeImport()" class="flex-1 bg-green-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-green-700">
        Importer ${dataRows.length} lignes
      </button>
      <button onclick="closeModal()" class="flex-1 border py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Annuler</button>
    </div>
  `);

  // Stocker les données en variable globale (évite l'injection dans l'attribut onclick)
  window._importRows = dataRows;
}

function setImportMode(mode) {
  window._importMode = mode;
  const isBpu = mode === 'bpu';
  document.getElementById('mode-btn-devis').className =
    `flex-1 py-2 rounded-lg text-sm font-medium border-2 ${!isBpu ? 'border-green-600 bg-green-600 text-white' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`;
  document.getElementById('mode-btn-bpu').className =
    `flex-1 py-2 rounded-lg text-sm font-medium border-2 ${isBpu ? 'border-amber-500 bg-amber-500 text-white' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`;
  document.getElementById('mode-bpu-info').classList.toggle('hidden', !isBpu);
  document.getElementById('mode-devis-info').classList.toggle('hidden', isBpu);
  document.getElementById('bpu-caract-section').classList.toggle('hidden', !isBpu);
  // En mode BPU, masquer les champs non pertinents
  ['map-design-wrap','map-desc-wrap','map-qte-wrap','map-unite-wrap','map-prix-wrap','map-prix-etude-wrap'].forEach(id => {
    document.getElementById(id)?.classList.toggle('hidden', isBpu);
  });
}

// ── Parsing végétaux : extrait Type (forme), Taille/Calibre et Conditionnement ──
// Aligne sur les 3 champs de FAMILLE_CHAMPS végétaux
function _parseVegetalDesignation(text) {
  if (!text) return null;
  let s = String(text).trim();

  // 1. Conditionnement : mode de culture / emballage
  //    C3L, C5L, C2L, CT, MG, MA, RN, HB, BA, BR, Godet 9, Pot 5L
  const condRe = [
    /\bC\s?\d{1,3}\s?L\b/i,                  // C3L, C5L, C2L, C35L
    /\bGodet\s*\d+\b/i,                        // Godet 9
    /\bAirpot\s*\d*\s*[Ll]?\b/i,              // Airpot, Airpot 45L
    /\bPot\s*\d+\s*[Ll]?\b/i,                 // Pot 5L
    /\b(CT|MG|MA|RN|HB|BA|BR)\b/,             // CT=Conteneur, MG=Motte Grillagée, MA=Motte Arrosée, RN=Racine Nue, HB=Hors-Botte, BA=Balle-Arrosée, BR=Bare Root
  ];
  let conditionnement = null;
  for (const re of condRe) {
    const m = s.match(re);
    if (m) {
      conditionnement = m[0].replace(/\s+/g, '');
      s = s.replace(re, ' ');
      break;
    }
  }

  // 2. Type (forme de la plante) : Tige, Cépée, Baliveau, Touffe...
  const typeRe = /\b(Tige|Tiges|C[eé]p[eé]e|Baliveau|Touffe?|Touffu|Buisson|Multi[-\s]?tronc|Baliv\.?|Multitronc)\b/i;
  let type = null;
  const tm = s.match(typeRe);
  if (tm) { type = tm[0].trim(); s = s.replace(typeRe, ' '); }

  // 3. Taille / Calibre numérique : 18/20, 100/125, 150-175, P9, 120cm
  const tailleRe = [
    /\b\d{1,3}\s?[\/]\s?\d{1,3}\b/,    // 18/20, 100/125
    /\b\d{1,3}\s?[-–]\s?\d{1,3}\b/,    // 80-100
    /\bP\s?\d{1,2}\b/i,                 // P9, P11
    /\b\d{2,3}\s?cm\b/i,               // 120cm
  ];
  let taille = null;
  for (const re of tailleRe) {
    const m = s.match(re);
    if (m) { taille = m[0].trim(); s = s.replace(re, ' '); break; }
  }

  // Nettoyer la désignation restante
  s = s.replace(/\s*\([^)]*\)\s*/g, ' ')  // supprimer "(nom commun)" entre parenthèses
       .replace(/['']/g, "'")
       .replace(/\s{2,}/g, ' ')
       .replace(/[,;.\s'-]+$/, '')
       .trim();

  return { designation: s || text, type, taille, conditionnement };
}

// Patterns végétaux sur la désignation brute (genres courants + terminaisons)
// Genres botaniques courants en paysagisme français — liste élargie
const _VEGETAL_GENERA = /\b(ACER|BETULA|QUERCUS|FAGUS|FRAXINUS|TILIA|PLATANUS|PRUNUS|SORBUS|CARPINUS|CORYLUS|ALNUS|SALIX|POPULUS|PINUS|PICEA|ABIES|TAXUS|THUJA|CUPRESSUS|CHAMAECYPARIS|JUNIPERUS|CELTIS|KOELREUTERIA|SOPHORA|ULMUS|OLEA|CERCIS|PUNICA|GLEDITSIA|CATALPA|LIRIODENDRON|GINKGO|LIQUIDAMBAR|PYRUS|MALUS|CRATAEGUS|AMELANCHIER|MORUS|FICUS|MAGNOLIA|ROBINIA|GLEDITSIA|ROSA|LONICERA|VIBURNUM|CORNUS|SAMBUCUS|SPIRAEA|FORSYTHIA|BUDDLEJA|LAVANDULA|ROSMARINUS|BUXUS|LIGUSTRUM|EUONYMUS|BERBERIS|PYRACANTHA|COTONEASTER|POTENTILLA|WEIGELA|DEUTZIA|PHILADELPHUS|SYRINGA|HEDERA|PARTHENOCISSUS|WISTERIA|CLEMATIS|HYDRANGEA|CAMELLIA|RHODODENDRON|AZALEA|PHOTINIA|PITTOSPORUM|ESCALLONIA|AUCUBA|ILEX|MAHONIA|OSMANTHUS|SKIMMIA|VINCA|PACHYSANDRA|PHILLYREA|PISTACIA|PISCTACHIA|RIBES|VACCINIUM|VACCINUM|ARBUTUS|CISTUS|ATRIPLEX|TEUCRIUM|CALLISTEMON|LEUCOPHYLLUM|FEIJOA|CORONILLA|MYRTUS|SANTOLINA|HELICHRYSUM|CONVOLVULUS|PHLOMIS|EPILOBIUM|TULBAGHIA|TRACHELOSPERMUM|PASSIFLORA|JASMINUM|PLUMBAGO|CERATOSTIGMA|CEANOTHUS|RHAMNUS|ELAEAGNUS|TAMARIX|NERIUM|VITEX|LANTANA|AGAVE|YUCCA|CORDYLINE|PHORMIUM|NANDINA|FATSIA|ABELIA|CALYCANTHUS|CARYOPTERIS|PEROVSKIA|CAREX|FESTUCA|MISCANTHUS|PENNISETUM|STIPA|MOLINIA|DESCHAMPSIA|AGAPANTHUS|ACHILLEA|ASTER|ECHINACEA|GERANIUM|HEMEROCALLIS|HOSTA|IRIS|LIRIOPE|RUDBECKIA|SALVIA|SEDUM|PHLOX|GAURA|EUPHORBIA|ALLIUM|PERSICARIA|ORIGANUM|THYMUS|ARTEMISIA|CYMBOPOGON|RUMEX|SAGITTARIA|NYMPHAEA|NYMPHEA|BUTOMUS|PONTEDERIA|CALTHA|JUNCUS|LYTHRUM|ERAGROSTIS|TYPHA|PHRAGMITES|SCIRPUS|GLYCERIA)\b/i;

// Conditionnement pépinière : C3L, C5L, C2L, Godet 9, Tige 18/20, Cépée 150/175, MH...
const _VEGETAL_COND = /\bC\d+L\b|\bGodet\s*\d|\bTige\s+\d|\bCépée\s+\d|\bCepee\s+\d|\bMH\s*\d|\b(CT|MG|MA|RN|HB|BA|BR)\b/i;

function _isLikelyVegetal(text) {
  if (!text) return false;
  return _VEGETAL_GENERA.test(text) || _VEGETAL_COND.test(text);
}

// Normalise le texte pour les comparaisons (supprime accents, met en minuscules)
function _norm(s) {
  return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

// Mappage explicite chapitre → famille — testé sur texte NORMALISÉ (sans accents, minuscules)
const _CHAPTER_MAP = [
  { test: /fourniture.*veget|vegetaux|massif|arbres?\s+en\s+conteneur|vivaces?|grimpantes?|plantes?\s+potager|semi\s+de\s+prairie/i, fam: /végét|arbre|arbust/i },
  { test: /substrat|apport.*terre|travaux.*aratoire|terres?\s+veget|fosse.*arbre|apport.*substrat/i,                                  fam: /substrat/i },
  { test: /arrosage|irrigat|bouche.*arrosage/i,                                                                                        fam: /arrosage|irrigat/i },
  { test: /cloture|portail|palissade|grillage/i,                                                                                       fam: /clôture|portail/i },
  { test: /mobilier.*urbain|urbain.*mobilier|banquette|pergola|table.*pique|poubelle.*voirie|abri.*velo|totem|borne/i,                  fam: /mobilier/i },
  { test: /jeux?|aire.*jeux?|equip.*sport|structure.*multi|parcours.*equil|parcours.*motric|agrès|toboggan|balancoire|bascule/i,        fam: /jeux?|aire.*jeux?/i },
  { test: /eclairage.*ext/i,                                                                                                            fam: /éclairage.*ext|eclairage.*ext/i },
  { test: /plan\s+d.eau|bassin.*ornement|fontain|noue|mare|etang/i,                                                                    fam: /bassin|fontain/i },
  { test: /maconn|mur.*soutenement|beton.*arme|ouvrage.*beton/i,                                                                       fam: /maçonn/i },
  { test: /charpente|ossature.*bois/i,                                                                                                  fam: /charpente|ossature/i },
  { test: /revetement.*sol|dallage|pavage|enrobe/i,                                                                                    fam: /revêtement.*sol/i },
  { test: /bordure|delinit|caniveau/i,                                                                                                  fam: /bordure|délinit/i },
  { test: /semis|gazon/i,                                                                                                               fam: /semis|gazon/i },
  { test: /reseau.*enterr|assainiss|vrd/i,                                                                                              fam: /réseau.*enterr/i },
  { test: /reseau.*elec|armoire.*elec/i,                                                                                                fam: /réseau.*élec/i },
  { test: /copeaux.*bois|traverses.*bois|paillage|mulch|protection.*plant|maintien.*plant/i,                                           fam: /accessoire.*plant|plantation.*access/i },
];

// Détection au niveau de la ligne individuelle — texte normalisé
function _rowFamilyTest(text) {
  const t = _norm(String(text));
  // Substrat : priorité absolue — "terre végétale", "compost", "bentonite", etc.
  if (/terre\s+veget|compost\s+veget|bentonite|tourbe|substrat|humus|amendement|melange.*terre|fosse.*terre|mélange.*terre/i.test(t))
    return /substrat/i;
  // Végétal : nom latin (genre botanique) ou format pépinière (C3L, Godet, Tige XX/XX, Cépée)
  const raw = String(text);
  if (_VEGETAL_GENERA.test(raw) || _VEGETAL_COND.test(raw))
    return /végét|arbre|arbust/i;
  // Tuteur / paillage / protection (ligne individuelle)
  if (/\b(tuteur|tuteurage|toile\s+de\s+jute|paillage|mulch|echalas|membrane.*racinaire)\b/i.test(t))
    return /accessoire.*plant|plantation.*access/i;
  // Jeux / équipements sportifs
  if (/\b(jeux?|toboggan|balancoire|bascule|tourniquet|structure.*multi|multi.*activ|parcours.*equil|parcours.*motric|agres|filet.*grimpe|mur.*grimpe)\b/i.test(t))
    return /jeux?|aire.*jeux?/i;
  // Mobilier urbain
  if (/\b(banquette|banc\b|table.*pique|poubelle|corbeille.*voirie|abri.*velo|pergola|brise.*vent|totem|borne.*beton)\b/i.test(t))
    return /mobilier/i;
  return null;
}

// Extrait un conditionnement depuis un texte quelconque (titre de chapitre ou désignation)
// Reconnaît aussi les mots complets en plus des abréviations
function _extractCond(text) {
  const s  = String(text);
  const sn = _norm(s); // sans accents, minuscules

  // Codes explicites (priorité)
  const m = s.match(/\bC\s?\d{1,3}\s?L\b/i) ||
            s.match(/\bAirpot\s*\d*\s*[Ll]?\b/i) ||
            s.match(/\bGodet\s*\d+\b/i) ||
            s.match(/\bPot\s*\d+\s*[Ll]?\b/i) ||
            s.match(/\b(CT|MG|MA|RN|HB|BA|BR)\b/);
  if (m) return m[0].replace(/\s+/g, '');

  // Mots complets → code normalisé
  if (/conteneur|container/i.test(sn))       return 'CT';
  if (/motte\s+grillag/i.test(sn))           return 'MG';
  if (/motte\s+arros/i.test(sn))             return 'MA';
  if (/racine\s+nue/i.test(sn))              return 'RN';
  if (/hors[\s-]botte/i.test(sn))            return 'HB';
  if (/balle\s+arros/i.test(sn))             return 'BA';
  if (/\bairpot\b/i.test(sn))                return 'Airpot';
  if (/\bgodet\b/i.test(sn))                 return 'Godet';
  return null;
}

function _detectFamiliesFromRows(rows, cPoste, cDesign, cQte, cPrixCol, cUnite) {
  const result = [];
  let currentChapterFamTest = null; // regex famille du chapitre courant
  let currentChapterCond    = null; // conditionnement par défaut extrait du titre de chapitre

  const getFamilleDb = (famTestRegex) => {
    if (!famTestRegex) return null;
    return state.familles.find(f => famTestRegex.test(f.nom)) || null;
  };

  // Vide strict (null / '' )
  const isEmpty = v => v === null || v === undefined || String(v).trim() === '';
  // Vide "PDF" : 0, 0.00, -, - € — fréquent sur les lignes chapitres extraites de PDF
  const isPdfEmpty = v => {
    if (isEmpty(v)) return true;
    const s = String(v).trim().replace(/\s*€\s*$/, '');
    return s === '0' || s === '0.00' || s === '0,00' || s === '-';
  };
  // Poste entier pur (100, 200, 501…) sans tiret ni point → indique un chapitre
  const isRoundPoste = p => p && /^\d{1,4}$/.test(p);

  for (const row of rows) {
    const design   = String(row[cDesign] ?? '').trim();
    const qteVal   = cQte !== null ? row[cQte] : null;
    const prixVal  = cPrixCol !== null ? row[cPrixCol] : null;
    const posteVal = cPoste !== null ? String(row[cPoste] ?? '').trim() : '';
    const uniteVal = cUnite !== null ? String(row[cUnite] ?? '').trim() : '';

    // Chapitre = ligne vraiment vide (qté+prix), OU poste entier avec valeurs PDF-nulles
    const isChapter = (isEmpty(qteVal) && isEmpty(prixVal) && design.length > 2) ||
                      (isRoundPoste(posteVal) && isPdfEmpty(qteVal) && isPdfEmpty(prixVal) && design.length > 2);

    if (isChapter) {
      const ch = _CHAPTER_MAP.find(m => m.test.test(_norm(design)));
      currentChapterFamTest = ch ? ch.fam : null;
      lastChapterPostePrefix = posteVal;

      // Conditionnement dans le titre du chapitre végétaux (ex: "Massif d'arbustes C3L")
      if (ch && /végét|arbre|arbust/i.test(ch.fam.toString())) {
        currentChapterCond = _extractCond(design);
      } else {
        currentChapterCond = null;
      }
    }

    // Priorité 1 : détection individuelle sur la ligne
    const rowFamTest = _rowFamilyTest(design);
    // Priorité 2 : contexte chapitre
    const famTest = rowFamTest || currentChapterFamTest;
    const famille_db = getFamilleDb(famTest);

    // Végétaux : parsing si nom latin OU conditionnement pépinière détecté (désignation OU colonne unité)
    const isVegetalFam = famTest && /végét|arbre|arbust/i.test(famTest.toString());
    const condInUnite  = _extractCond(uniteVal); // C3L parfois extrait dans la colonne Unité par Excel
    const isVegetalRow = _VEGETAL_GENERA.test(design) || _VEGETAL_COND.test(design) || !!condInUnite;
    let parsed = null;
    if (isVegetalFam && isVegetalRow && !isChapter) {
      parsed = _parseVegetalDesignation(design);
      // Fallback 1 : conditionnement dans la colonne Unité (ex: Excel split le PDF différemment)
      if (parsed && !parsed.conditionnement && condInUnite) {
        parsed.conditionnement = condInUnite;
      }
      // Fallback 2 : conditionnement dans le titre du chapitre
      if (parsed && !parsed.conditionnement && currentChapterCond) {
        parsed.conditionnement = currentChapterCond;
      }
      // Rien à extraire : pas de parsing
      if (!parsed.taille && !parsed.conditionnement && !parsed.type) parsed = null;
    }

    result.push({ famille_db, isVegetal: !!parsed, parsed, rawDesignation: design });
  }

  return result;
}

async function executeImport() {
  const rows = window._importRows;
  if (!rows) return;
  const isBpu = window._importMode === 'bpu';

  const col = id => {
    const v = document.getElementById(id)?.value;
    return v !== '' && v !== undefined ? parseInt(v) : null;
  };
  const get    = (row, idx) => idx !== null && idx !== undefined ? String(row[idx] ?? '').trim() : '';
  const getNum = (row, idx) => {
    const v = get(row, idx).replace(',', '.').replace(/[^\d.-]/g, '');
    return parseFloat(v) || null;
  };

  const cPoste = col('map-poste');

  closeModal();

  // Afficher le sablier dans le conteneur pendant l'import
  const _fourCont = document.getElementById('fournitures-container');
  if (_fourCont) _fourCont.innerHTML = '<div class="flex flex-col items-center justify-center py-16 text-gray-400"><div style="font-size:2rem;animation:spin 1.2s linear infinite;display:inline-block">⏳</div><p class="text-sm mt-3">Import en cours…</p></div>';

  if (isBpu) {
    // ── MODE BPU : mise à jour caractéristiques par n° de poste ──
    if (cPoste === null) return toast('N° de poste requis en mode BPU', 'err');

    // Collecter les colonnes cochées et leurs noms
    const caractCols = [...document.querySelectorAll('.bpu-col-cb:checked')].map(cb => {
      const idx  = parseInt(cb.value);
      const name = cb.closest('label')?.querySelector('.bpu-col-name')?.value.trim() || `Col ${idx + 1}`;
      return { idx, name };
    });
    if (!caractCols.length) return toast('Cochez au moins une colonne de caractéristiques', 'err');

    toast('Import BPU en cours…');
    let updated = 0, notFound = 0;

    for (const row of rows) {
      const poste = get(row, cPoste);
      if (!poste) continue;
      const fourniture = state.fournitures.find(f => f.numero_poste === poste);
      if (!fourniture) { notFound++; continue; }

      // Construire les nouvelles caractéristiques (fusionner avec l'existant)
      const existing = Array.isArray(fourniture.caracteristiques) ? fourniture.caracteristiques : [];
      const nouveaux = caractCols
        .map(({ idx, name }) => ({ cle: name, valeur: get(row, idx) }))
        .filter(c => c.valeur !== '');
      // Remplacer les clés existantes, ajouter les nouvelles
      const merged = [...existing];
      for (const nc of nouveaux) {
        const i = merged.findIndex(c => c.cle === nc.cle);
        if (i >= 0) merged[i] = nc; else merged.push(nc);
      }

      try {
        const { error } = await db.from('fournitures')
          .update({ caracteristiques: merged })
          .eq('id', fourniture.id);
        if (error) throw error;
        fourniture.caracteristiques = merged;
        updated++;
      } catch (err) { console.error('bpu row', err); }
    }

    renderFournitures();
    const msg = `✅ BPU : ${updated} poste(s) mis à jour${notFound ? ` · ${notFound} poste(s) non trouvé(s)` : ''}`;
    toast(msg);

  } else {
    // ── MODE DEVIS : création de nouvelles fournitures ──
    const cDesign      = col('map-design');
    const cDesc        = col('map-desc');
    const cQte         = col('map-qte');
    const cUnite       = col('map-unite');
    const cPrix        = col('map-prix');
    const cPrixMarche  = col('map-prix-marche');
    if (cDesign === null) return toast('Sélectionnez au moins la colonne Désignation', 'err');

    // ── Détection familles sur TOUS les rows (avant filtrage) ──
    // Nécessaire pour que les titres de chapitres propagent leur contexte même s'ils sont filtrés ensuite
    const allDetected = _detectFamiliesFromRows(rows, cPoste, cDesign, cQte, cPrixMarche !== null ? cPrixMarche : cPrix, cUnite);

    // Filtrer les lignes vides — en gardant la correspondance avec allDetected
    const validPairs = rows.map((row, i) => ({ row, det: allDetected[i] }))
      .filter(({ row }) => { const d = get(row, cDesign); return d && d.length >= 2; });
    const validRows = validPairs.map(p => p.row);

    // Détecter doublons dans l'import (même numero_poste)
    if (cPoste !== null) {
      const postes = validRows.map(r => get(r, cPoste)).filter(Boolean);
      const doublons = postes.filter((p, i) => postes.indexOf(p) !== i);
      const uniqueDoublons = [...new Set(doublons)];
      if (uniqueDoublons.length) {
        const exemples = uniqueDoublons.slice(0, 5).join(', ');
        const choix = await new Promise(resolve => {
          showModal(`
            <h2 class="text-lg font-bold mb-3">⚠️ Doublons détectés</h2>
            <p class="text-sm text-gray-600 mb-2">${uniqueDoublons.length} n° de poste apparaissent plusieurs fois dans le fichier :</p>
            <p class="text-xs font-mono bg-gray-100 rounded p-2 mb-4">${exemples}${uniqueDoublons.length > 5 ? '…' : ''}</p>
            <p class="text-sm text-gray-600 mb-4">Que souhaitez-vous faire ?</p>
            <div class="space-y-2">
              <button onclick="document.dispatchEvent(new CustomEvent('dedup-choice',{detail:'keep_first'}))"
                class="w-full bg-green-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-green-700">
                Garder uniquement la 1ère occurrence de chaque doublon
              </button>
              <button onclick="document.dispatchEvent(new CustomEvent('dedup-choice',{detail:'keep_all'}))"
                class="w-full border py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
                Tout importer (conserver les doublons)
              </button>
              <button onclick="document.dispatchEvent(new CustomEvent('dedup-choice',{detail:'cancel'}))"
                class="w-full border py-2 rounded-lg text-sm text-red-500 hover:bg-red-50">
                Annuler l'import
              </button>
            </div>
          `);
          const handler = e => { document.removeEventListener('dedup-choice', handler); resolve(e.detail); };
          document.addEventListener('dedup-choice', handler);
        });
        closeModal();
        if (choix === 'cancel') { window._importRows = null; window._importMode = null; return; }
        if (choix === 'keep_first') {
          const seen = new Set();
          const deduped = validPairs.filter(({ row }) => {
            const p = get(row, cPoste);
            if (!p) return true;
            if (seen.has(p)) return false;
            seen.add(p); return true;
          });
          validPairs.splice(0, validPairs.length, ...deduped);
          validRows.splice(0, validRows.length, ...validPairs.map(p => p.row));
        }
      }
    }

    // ── Détection automatique des familles (déjà calculée sur tous les rows) ──
    // Resynchroniser validPairs après éventuelle déduplication
    const detected = validPairs.map(p => p.det);
    const anyDetected = detected.some(d => d.famille_db);
    const hasVegetaux = detected.some(d => d.isVegetal);

    if (anyDetected) {
      // Résumé par famille
      const countByFam = {};
      detected.forEach(d => {
        if (!d.famille_db) return;
        const k = d.famille_db.nom;
        countByFam[k] = (countByFam[k] || 0) + 1;
      });
      const noFamCount = detected.filter(d => !d.famille_db).length;
      const famRows = Object.entries(countByFam)
        .sort((a, b) => b[1] - a[1])
        .map(([nom, n]) => `<tr><td class="py-1 pr-4 text-sm">${nom}</td><td class="py-1 text-sm font-semibold text-green-700">${n} ligne${n>1?'s':''}</td></tr>`)
        .join('');

      // Exemples végétaux parsés
      let vegetalExamples = '';
      if (hasVegetaux) {
        const examples = detected.filter(d => d.parsed).slice(0, 3);
        vegetalExamples = `
          <div class="mt-3 border-t pt-3">
            <p class="text-xs font-semibold text-green-800 mb-2">🌿 Exemple de structuration végétaux :</p>
            <table class="w-full text-xs">
              <tr class="text-gray-500"><th class="text-left pb-1">Brut</th><th class="text-left pb-1">Nom nettoyé</th><th class="text-left pb-1">Type</th><th class="text-left pb-1">Calibre</th><th class="text-left pb-1">Cond.</th></tr>
              ${examples.map(d => `<tr class="border-t">
                <td class="py-1 pr-2 text-gray-500 max-w-24 truncate" title="${d.rawDesignation}">${d.rawDesignation}</td>
                <td class="py-1 pr-2">${d.parsed.designation}</td>
                <td class="py-1 pr-2 text-green-700">${d.parsed.type || '—'}</td>
                <td class="py-1 pr-2 text-green-700">${d.parsed.taille || '—'}</td>
                <td class="py-1 text-green-700">${d.parsed.conditionnement || '—'}</td>
              </tr>`).join('')}
            </table>
            <label class="flex items-center gap-2 mt-2 text-xs cursor-pointer">
              <input type="checkbox" id="chk-parse-vegetal" checked class="accent-green-600">
              Extraire automatiquement Taille/Calibre et Conditionnement depuis la désignation
            </label>
          </div>`;
      }

      const confirmed = await new Promise(resolve => {
        showModal(`
          <h2 class="text-lg font-bold mb-1">🔍 Familles détectées</h2>
          <p class="text-xs text-gray-500 mb-3">L'analyse automatique a identifié les familles suivantes :</p>
          <table class="w-full mb-2">${famRows}</table>
          ${noFamCount ? `<p class="text-xs text-gray-400">${noFamCount} ligne(s) sans famille détectée</p>` : ''}
          ${vegetalExamples}
          <label class="flex items-center gap-2 mt-3 text-sm cursor-pointer">
            <input type="checkbox" id="chk-apply-familles" checked class="accent-green-600">
            Appliquer l'affectation automatique des familles
          </label>
          <div class="flex gap-2 mt-4">
            <button onclick="document.dispatchEvent(new CustomEvent('detect-confirm',{detail:true}))"
              class="flex-1 bg-green-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-green-700">
              Confirmer l'import
            </button>
            <button onclick="document.dispatchEvent(new CustomEvent('detect-confirm',{detail:false}))"
              class="flex-1 border py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
              Ignorer (importer sans familles)
            </button>
          </div>
        `, 'lg');
        const handler = e => { document.removeEventListener('detect-confirm', handler); resolve(e.detail); };
        document.addEventListener('detect-confirm', handler);
      });

      window._importApplyFamilles = confirmed && document.getElementById('chk-apply-familles')?.checked;
      window._importParseVegetal = confirmed && hasVegetaux && document.getElementById('chk-parse-vegetal')?.checked;
      closeModal();
    } else {
      window._importApplyFamilles = false;
      window._importParseVegetal = false;
    }

    toast('Import en cours…');
    let count = 0;
    let ordre = state.fournitures.length;

    for (let i = 0; i < validRows.length; i++) {
      const row = validRows[i];
      const det = detected[i] || {};
      try {
        let designation = get(row, cDesign);
        let caract = null;
        let famille_id = null;

        if (window._importApplyFamilles && det.famille_db) {
          famille_id = det.famille_db.id;
        }
        if (window._importParseVegetal && det.parsed) {
          designation = det.parsed.designation;
          caract = [];
          if (det.parsed.type)           caract.push({ cle: 'Type',            valeur: det.parsed.type });
          if (det.parsed.taille)         caract.push({ cle: 'Taille / Calibre', valeur: det.parsed.taille });
          if (det.parsed.conditionnement) caract.push({ cle: 'Conditionnement', valeur: det.parsed.conditionnement });
        }

        const { data, error } = await db.from('fournitures').insert({
          chantier_id:     state.currentChantier.id,
          lot_id:          state.currentLot?.id ?? null,
          famille_id,
          numero_poste:    cPoste !== null ? get(row, cPoste) : null,
          designation,
          description:     get(row, cDesc),
          qte:             getNum(row, cQte),
          unite:           get(row, cUnite) || 'U',
          prix_marche_ht:  getNum(row, cPrixMarche),
          prix_etude_ht:   getNum(row, cPrix),
          caracteristiques: caract,
          ordre:           ordre++
        }).select('*, famille:familles_fournitures(nom, icone, couleur)').single();
        if (error) { console.error('row error', error); continue; }
        state.fournitures.push(data);
        count++;
      } catch (err) { console.error('import row', err); }
    }

    renderFournitures();
    toast(`✅ ${count} fourniture(s) importée(s) !`);
  }

  window._importRows = null;
  window._importMode = null;
}
