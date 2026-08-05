// Pivot PDF Worker — DAF + DOE generator
// pdf-lib + Noto Sans via KV

import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';

// ============================================================
// PALETTES
// ============================================================
const PALETTES = [
  { name: 'Marine',     bg: '#1a2e44', text: '#ffffff' },
  { name: 'Forêt',      bg: '#0F6E56', text: '#ffffff' },
  { name: 'Bleu',       bg: '#185fa5', text: '#ffffff' },
  { name: 'Violet',     bg: '#534AB7', text: '#ffffff' },
  { name: 'Terre',      bg: '#993C1D', text: '#ffffff' },
  { name: 'Anthracite', bg: '#444441', text: '#ffffff' },
  { name: 'Noir chaud', bg: '#2C2C2A', text: '#f0ede6' },
  { name: 'Sable',      bg: '#f1efe8', text: '#2C2C2A' },
];

// ============================================================
// UTILS
// ============================================================
function hexToRgb(hex) {
  const r = parseInt(hex.slice(1,3),16)/255;
  const g = parseInt(hex.slice(3,5),16)/255;
  const b = parseInt(hex.slice(5,7),16)/255;
  return rgb(r,g,b);
}

function clamp(val, min, max) { return Math.max(min, Math.min(max, val)); }

// Wrap texte manuel (pdf-lib ne wrap pas)
function wrapText(text, font, size, maxWidth) {
  const words = String(text || '').split(' ');
  const lines = [];
  let current = '';
  for (const word of words) {
    const test = current ? current + ' ' + word : word;
    if (font.widthOfTextAtSize(test, size) <= maxWidth) {
      current = test;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

// ============================================================
// FONTS
// ============================================================
async function loadFonts(pdfDoc, env) {
  pdfDoc.registerFontkit(fontkit);
  try {
    const [regularBytes, boldBytes] = await Promise.all([
      env.FONTS.get('NotoSans-Regular', { type: 'arrayBuffer' }),
      env.FONTS.get('NotoSans-Bold',    { type: 'arrayBuffer' }),
    ]);
    if (!regularBytes || !boldBytes) throw new Error('fonts manquantes dans KV');
    return {
      regular: await pdfDoc.embedFont(regularBytes),
      bold:    await pdfDoc.embedFont(boldBytes),
    };
  } catch {
    // Fallback Helvetica (sans accents) — utilisé en dev
    return {
      regular: await pdfDoc.embedFont(StandardFonts.Helvetica),
      bold:    await pdfDoc.embedFont(StandardFonts.HelveticaBold),
    };
  }
}

// ============================================================
// BANDEAU COMMUN (toutes les pages)
// ============================================================
const BANDEAU_H = 28; // hauteur bandeau bas en pts
const A4W = 595.28;
const A4H = 841.89;
const MARGIN = 40;
const CONTENT_W = A4W - MARGIN * 2;

function drawBandeauBas(page, fonts, config, label, pageNum, totalPages) {
  const bgColor  = hexToRgb(config.bandeau_bg  || '#1a2e44');
  const txtColor = hexToRgb(config.bandeau_text || '#ffffff');
  page.drawRectangle({ x:0, y:0, width:A4W, height:BANDEAU_H, color:bgColor });
  page.drawText(label || 'Pivot', {
    x: MARGIN, y: 9, font: fonts.regular, size: 7, color: txtColor,
  });
  const pageStr = `${pageNum} / ${totalPages}`;
  const pw = fonts.regular.widthOfTextAtSize(pageStr, 7);
  page.drawText(pageStr, {
    x: A4W - MARGIN - pw, y: 9, font: fonts.regular, size: 7, color: txtColor,
  });
}

// ============================================================
// BANDEAU HAUT DAF (bande colorée avec titre + infos chantier)
// ============================================================
const HEADER_H = 76;

function drawHeaderDAF(page, fonts, config, daf) {
  const bgColor  = hexToRgb(config.bandeau_bg  || '#1a2e44');
  const txtColor = hexToRgb(config.bandeau_text || '#ffffff');
  const dimColor = hexToRgb(config.bandeau_text === '#2C2C2A' ? '#666666' : '#aaaacc');
  const sepColor = hexToRgb(config.bandeau_text === '#2C2C2A' ? '#cccccc' : '#ffffff');

  page.drawRectangle({ x:0, y:A4H-HEADER_H, width:A4W, height:HEADER_H, color:bgColor });

  // Breadcrumb discret en haut (numéro uniquement, pas de doublon)
  const breadcrumb = ['Pivot · DAF', daf.numero].filter(Boolean).join(' · ');
  page.drawText(breadcrumb, { x:MARGIN, y:A4H-13, font:fonts.regular, size:6.5, color:dimColor });

  // Ligne 1 : Chantier + Ville (grand)
  let cx = MARGIN;
  const line1Y = A4H - 34;
  if (daf.chantier) {
    page.drawText(daf.chantier, { x:cx, y:line1Y, font:fonts.bold, size:14, color:txtColor });
    cx += fonts.bold.widthOfTextAtSize(daf.chantier, 14) + 16;
  }
  if (daf.ville) {
    if (daf.chantier) {
      page.drawLine({ start:{x:cx-8, y:line1Y+12}, end:{x:cx-8, y:line1Y-2}, thickness:0.6, color:sepColor });
    }
    page.drawText(daf.ville, { x:cx, y:line1Y, font:fonts.bold, size:14, color:txtColor });
  }

  // Ligne 2 : Désignation fourniture
  const line2Y = A4H - 58;
  page.drawText(daf.designation || '', { x:MARGIN, y:line2Y, font:fonts.regular, size:11, color:txtColor });

  // MOA + MOE discrets à droite
  const rightY = line2Y;
  if (daf.moa_nom) {
    const moaStr = `MOA · ${daf.moa_nom}`;
    const moaW = fonts.regular.widthOfTextAtSize(moaStr, 7.5);
    page.drawText(moaStr, { x:A4W-MARGIN-moaW, y:rightY+10, font:fonts.regular, size:7.5, color:dimColor });
  }
  if (daf.moe_nom) {
    const moeStr = `MOE · ${daf.moe_nom}`;
    const moeW = fonts.regular.widthOfTextAtSize(moeStr, 7.5);
    page.drawText(moeStr, { x:A4W-MARGIN-moeW, y:rightY, font:fonts.regular, size:7.5, color:dimColor });
  }
}

// ============================================================
// PAGE 1 DAF
// ============================================================
async function buildPage1DAF(pdfDoc, fonts, config, daf, pageNum, totalPages) {
  const page = pdfDoc.addPage([A4W, A4H]);
  const bgColor  = hexToRgb(config.bandeau_bg  || '#1a2e44');
  const txtColor = hexToRgb(config.bandeau_text || '#ffffff');
  const GREY  = rgb(0.45,0.45,0.45);
  const BLACK = rgb(0.1,0.1,0.1);
  const LIGHT = rgb(0.96,0.96,0.96);

  // Header
  drawHeaderDAF(page, fonts, config, daf);

  // Logo entrepreneur (si disponible)
  if (config.logo_base64) {
    try {
      const logoBytes = Uint8Array.from(atob(config.logo_base64.replace(/^data:[^;]+;base64,/,'')), c => c.charCodeAt(0));
      const logoImg = config.logo_base64.includes('png')
        ? await pdfDoc.embedPng(logoBytes)
        : await pdfDoc.embedJpg(logoBytes);
      const dims = logoImg.scale(0.25);
      page.drawImage(logoImg, { x: A4W - MARGIN - clamp(dims.width,20,80), y: A4H - HEADER_H + 6, width: clamp(dims.width,20,80), height: clamp(dims.height,10,46) });
    } catch {}
  }

  let y = A4H - HEADER_H - 22;

  // Badges statut + version
  const statutColors = {
    brouillon:       { bg: rgb(0.9,0.9,0.9),    txt: GREY },
    soumise:         { bg: rgb(0.85,0.92,1),     txt: rgb(0.1,0.3,0.8) },
    visa_ok:         { bg: rgb(0.85,0.97,0.88),  txt: rgb(0.1,0.55,0.2) },
    visa_remarques:  { bg: rgb(1,0.95,0.8),      txt: rgb(0.6,0.4,0) },
    refusee:         { bg: rgb(1,0.88,0.88),     txt: rgb(0.7,0.1,0.1) },
    commandee:       { bg: rgb(0.88,0.85,1),     txt: rgb(0.3,0.1,0.7) },
  };
  const sc = statutColors[daf.statut] || statutColors.brouillon;
  const statutLabel = { brouillon:'Brouillon', soumise:'Soumise', visa_ok:'Visa sans remarque',
    visa_remarques:'Visa avec remarques', refusee:'Refusée', commandee:'Commandée' }[daf.statut] || daf.statut || '';
  const badgeW = fonts.bold.widthOfTextAtSize(statutLabel, 8) + 12;
  page.drawRectangle({ x: MARGIN, y: y - 6, width: badgeW, height: 16, color: sc.bg, borderRadius: 4 });
  page.drawText(statutLabel, { x: MARGIN + 6, y: y - 1, font: fonts.bold, size: 8, color: sc.txt });
  if (daf.version && daf.version > 1) {
    const vLabel = `v${daf.version}`;
    page.drawRectangle({ x: MARGIN + badgeW + 6, y: y - 6, width: fonts.bold.widthOfTextAtSize(vLabel, 8)+12, height: 16, color: rgb(0.9,0.85,1), borderRadius: 4 });
    page.drawText(vLabel, { x: MARGIN + badgeW + 12, y: y - 1, font: fonts.bold, size: 8, color: rgb(0.3,0.1,0.7) });
  }
  y -= 30;

  // ---- Tableau principal ----
  const ROW_H = 20;
  const COL1 = 130; // largeur col label

  function drawRow(label, value, highlight) {
    const rowBottom = y - 7;
    if (highlight) page.drawRectangle({ x: MARGIN, y: rowBottom, width: CONTENT_W, height: ROW_H, color: LIGHT });
    page.drawText(label, { x: MARGIN + 6, y, font: fonts.bold, size: 8, color: GREY });
    const lines = wrapText(value || '—', fonts.regular, 8.5, CONTENT_W - COL1 - 12);
    lines.forEach((l, i) => {
      page.drawText(l, { x: MARGIN + COL1, y: y - i * 11, font: fonts.regular, size: 8.5, color: BLACK });
    });
    const rowLines = Math.max(1, lines.length);
    page.drawLine({ start:{x:MARGIN,y:rowBottom}, end:{x:MARGIN+CONTENT_W,y:rowBottom}, thickness:0.3, color:rgb(0.88,0.88,0.88) });
    y -= ROW_H * rowLines;
  }

  // Lignes optionnelles masquables depuis "Paramètres DAF"
  const hidden = new Set(daf.champs_masques || []);

  // Section identité
  page.drawText('IDENTIFICATION', { x: MARGIN, y, font: fonts.bold, size: 7.5, color: hexToRgb(config.bandeau_bg||'#1a2e44') });
  y -= 16;
  drawRow('N° DAF', daf.numero, false);
  drawRow('Désignation', daf.designation, true);
  if (!hidden.has('reference')) drawRow('Référence', daf.reference, false);
  if (!hidden.has('fabricant')) drawRow('Fabricant', daf.fabricant, true);
  if (!hidden.has('famille'))   drawRow('Famille', daf.famille, false);
  if (!hidden.has('fournisseur')) {
    drawRow('Fournisseur retenu', daf.fournisseur, true);
    const fournLoc = [daf.fournisseur_adresse, daf.fournisseur_pays].filter(Boolean).join(' — ');
    if (fournLoc) drawRow('Adresse fournisseur', fournLoc, false);
  }
  y -= 8;

  // Section quantités + prix
  page.drawText('QUANTITÉS & PRIX', { x: MARGIN, y, font: fonts.bold, size: 7.5, color: hexToRgb(config.bandeau_bg||'#1a2e44') });
  y -= 16;
  drawRow('Quantité', daf.qte ? `${daf.qte} ${daf.unite || 'U'}` : '—', false);
  if (!hidden.has('prix')) {
    drawRow('Prix unitaire HT', daf.prix_unit_ht ? `${parseFloat(daf.prix_unit_ht).toFixed(2)} €` : '—', true);
    drawRow('Total HT', (daf.qte && daf.prix_unit_ht) ? `${(parseFloat(daf.qte)*parseFloat(daf.prix_unit_ht)).toFixed(2)} €` : '—', false);
  }
  y -= 8;

  // Caractéristiques techniques
  if (!hidden.has('caracteristiques') && daf.caracteristiques && daf.caracteristiques.length) {
    page.drawText('CARACTÉRISTIQUES TECHNIQUES', { x: MARGIN, y, font: fonts.bold, size: 7.5, color: hexToRgb(config.bandeau_bg||'#1a2e44') });
    y -= 16;
    daf.caracteristiques.forEach((c, i) => drawRow(c.cle || '', c.valeur || '', i%2===0));
    y -= 8;
  }

  // Dates
  page.drawText('DATES', { x: MARGIN, y, font: fonts.bold, size: 7.5, color: hexToRgb(config.bandeau_bg||'#1a2e44') });
  y -= 16;
  drawRow('Date émission', daf.date_emission || '—', false);
  if (!hidden.has('delai')) drawRow('Délai indicatif', daf.date_livraison || '—', true);
  if (daf.date_commande && !hidden.has('date_commande')) drawRow('Date commande', daf.date_commande, false);
  y -= 8;

  // Section VISA (si visé)
  if (daf.visa) {
    page.drawText('VISA MAÎTRE D\'ŒUVRE', { x: MARGIN, y, font: fonts.bold, size: 7.5, color: hexToRgb(config.bandeau_bg||'#1a2e44') });
    y -= 16;
    drawRow('Décision', daf.visa.type === 'sans_remarque' ? 'Visé sans remarque' : daf.visa.type === 'avec_remarques' ? 'Visé avec remarques' : 'Refusé', false);
    if (daf.visa.remarques) drawRow('Remarques', daf.visa.remarques, true);
    drawRow('Date visa', daf.visa.date || '—', false);
    drawRow('MOE', daf.visa.moe || '—', true);
    y -= 8;
  }

  // Zone signatures
  if (y > 120) {
    y = Math.min(y, 180);
    page.drawLine({ start:{x:MARGIN,y}, end:{x:MARGIN+CONTENT_W,y}, thickness:0.5, color:rgb(0.85,0.85,0.85) });
    y -= 20;
    page.drawText('Établi par l\'entrepreneur', { x: MARGIN, y, font: fonts.bold, size: 7.5, color: GREY });
    page.drawText('Visa maître d\'œuvre', { x: MARGIN + CONTENT_W/2, y, font: fonts.bold, size: 7.5, color: GREY });
    y -= 50;
    page.drawLine({ start:{x:MARGIN,y}, end:{x:MARGIN+CONTENT_W/2-20,y}, thickness:0.4, color:rgb(0.8,0.8,0.8) });
    page.drawLine({ start:{x:MARGIN+CONTENT_W/2,y}, end:{x:MARGIN+CONTENT_W,y}, thickness:0.4, color:rgb(0.8,0.8,0.8) });
  }

  const breadcrumb = ['Pivot · DAF', daf.chantier, daf.numero].filter(Boolean).join(' · ');
  drawBandeauBas(page, fonts, config, breadcrumb, pageNum, totalPages);
  return page;
}

// ============================================================
// PAGES ANNEXES (PDF uploadés)
// ============================================================
// pdfMode : 'bandeau' (défaut) = overlay bandeau en bas, taille originale
//           'original'         = copie brute sans aucun overlay
// ctx = { chantier, ville, ref_doe }
async function buildAnnexPages(pdfDoc, fonts, config, annexPdfBytes, chapLabel, startPageNum, totalPages, pdfMode, ctx) {
  const annexDoc = await PDFDocument.load(annexPdfBytes);
  const pageCount = annexDoc.getPageCount();
  const bgColor  = hexToRgb(config.bandeau_bg  || '#1a2e44');
  const txtColor = hexToRgb(config.bandeau_text || '#ffffff');
  const GREY_LT  = hexToRgb('#aaaaaa');
  const TOP_H = 28;

  const refLigne = `Pivot · ${ctx?.ref_doe || 'DOE'}`;

  for (let pi = 0; pi < pageCount; pi++) {
    const pNum = startPageNum + pi;

    if (pdfMode === 'original') {
      const [copied] = await pdfDoc.copyPages(annexDoc, [pi]);
      pdfDoc.addPage(copied);
      continue;
    }

    const embedded = await pdfDoc.embedPage(annexDoc.getPage(pi));
    const srcW = embedded.width;
    const srcH = embedded.height;
    const newPage = pdfDoc.addPage([srcW, srcH]);

    const areaW = srcW;
    const areaH = srcH - TOP_H - BANDEAU_H;
    const scale = Math.min(areaW / srcW, areaH / srcH);
    const scaledW = srcW * scale;
    const scaledH = srcH * scale;

    newPage.drawPage(embedded, {
      x: (areaW - scaledW) / 2,
      y: BANDEAU_H + (areaH - scaledH) / 2,
      width: scaledW,
      height: scaledH,
    });

    // Bandeau bas : Pivot · ref_doe à gauche, pagination à droite
    newPage.drawRectangle({ x:0, y:0, width:srcW, height:BANDEAU_H, color:bgColor });
    newPage.drawText(refLigne, { x:MARGIN, y:9, font:fonts.regular, size:7, color:txtColor });
    const ps = `${pNum} / ${totalPages}`;
    newPage.drawText(ps, { x:srcW-MARGIN-fonts.regular.widthOfTextAtSize(ps,7), y:9, font:fonts.regular, size:7, color:txtColor });

    // Bandeau haut : une seule ligne, caractères bien lisibles
    newPage.drawRectangle({ x:0, y:srcH-TOP_H, width:srcW, height:TOP_H, color:bgColor });
    newPage.drawText(chapLabel || '', { x:MARGIN, y:srcH-18, font:fonts.bold, size:11, color:txtColor });
  }
  return pageCount;
}

// ============================================================
// PAGE PHOTO FOURNISSEUR (auto-intégrée depuis Pivot Photos)
// ============================================================
// Une photo par page : on ne tente pas d'en placer plusieurs par page pour
// rester fiable quelle que soit l'orientation/taille des photos envoyées.
async function buildPhotoPage(pdfDoc, fonts, config, base64, label, pageNum, totalPages) {
  const page = pdfDoc.addPage([A4W, A4H]);
  const clean = base64.replace(/^data:[^;]+;base64,/, '');
  const imgBytes = Uint8Array.from(atob(clean), c => c.charCodeAt(0));
  // Détection du format par octets magiques (le base64 fourni n'a pas de préfixe data:mime)
  const isPng = imgBytes[0] === 0x89 && imgBytes[1] === 0x50 && imgBytes[2] === 0x4E && imgBytes[3] === 0x47;
  const img = isPng ? await pdfDoc.embedPng(imgBytes) : await pdfDoc.embedJpg(imgBytes);

  const areaTop = A4H - MARGIN;
  const areaBottom = BANDEAU_H + MARGIN;
  const areaW = CONTENT_W;
  const areaH = areaTop - areaBottom;

  const scale = Math.min(areaW / img.width, areaH / img.height, 3);
  const w = img.width * scale;
  const h = img.height * scale;
  const x = MARGIN + (areaW - w) / 2;
  const y = areaBottom + (areaH - h) / 2;

  page.drawRectangle({ x: MARGIN, y: areaBottom, width: areaW, height: areaH, borderColor: rgb(0.9,0.9,0.9), borderWidth: 0.5 });
  page.drawImage(img, { x, y, width: w, height: h });

  drawBandeauBas(page, fonts, config, label, pageNum, totalPages);
  return page;
}

// ============================================================
// FICHE FOURNITURE DOE
// ============================================================
async function buildFicheFournitureDOE(pdfDoc, fonts, config, doeData, fiche, pageNum, totalPages) {
  const page = pdfDoc.addPage([A4W, A4H]);
  const GREY  = rgb(0.45,0.45,0.45);
  const BLACK = rgb(0.1,0.1,0.1);
  const LIGHT = rgb(0.96,0.96,0.96);
  const bgColor = hexToRgb(config.bandeau_bg || '#1a2e44');

  // Header
  drawHeaderDAF(page, fonts, config, {
    designation: fiche.chapitre_nom || 'Fournitures',
    chantier: doeData.chantier,
    ville: doeData.ville || '',
    moe_nom: doeData.moe?.nom || '',
    numero: `Chap. ${fiche.chapitre_num || ''}`,
  });

  let y = A4H - HEADER_H - 22;
  const ROW_H = 20;
  const COL1 = 130;

  function drawRow(label, value, highlight) {
    const rowBottom = y - 7;
    if (highlight) page.drawRectangle({ x:MARGIN, y:rowBottom, width:CONTENT_W, height:ROW_H, color:LIGHT });
    page.drawText(label, { x:MARGIN+6, y, font:fonts.bold, size:8, color:GREY });
    const lines = wrapText(value||'—', fonts.regular, 8.5, CONTENT_W-COL1-12);
    lines.forEach((l, i) => page.drawText(l, { x:MARGIN+COL1, y:y-i*11, font:fonts.regular, size:8.5, color:BLACK }));
    const rowLines = Math.max(1, lines.length);
    page.drawLine({ start:{x:MARGIN,y:rowBottom}, end:{x:MARGIN+CONTENT_W,y:rowBottom}, thickness:0.3, color:rgb(0.88,0.88,0.88) });
    y -= ROW_H * rowLines;
  }

  // Infos chantier
  page.drawText('CHANTIER', { x:MARGIN, y, font:fonts.bold, size:7.5, color:bgColor });
  y -= 16;
  drawRow('Chantier', doeData.chantier, false);
  drawRow('Entrepreneur', fiche.entrepreneur || doeData.entrepreneur?.nom, true);
  drawRow('Date mise en œuvre', fiche.date_mise_en_oeuvre || '—', false);
  y -= 8;

  // Lignes fournitures
  if (fiche.lignes?.length) {
    page.drawText('FOURNITURES', { x:MARGIN, y, font:fonts.bold, size:7.5, color:bgColor });
    y -= 16;

    // En-tête tableau
    const cols = [
      { label:'Désignation', x:MARGIN,    w:200 },
      { label:'Fabricant',   x:MARGIN+205, w:120 },
      { label:'Réf.',        x:MARGIN+330, w:80  },
      { label:'Qté',         x:MARGIN+415, w:40  },
      { label:'U.',          x:MARGIN+460, w:30  },
      { label:'Prix HT',     x:MARGIN+495, w:60  },
    ];
    page.drawRectangle({ x:MARGIN, y:y-14, width:CONTENT_W, height:18, color:bgColor });
    cols.forEach(c => page.drawText(c.label, { x:c.x+4, y:y-10, font:fonts.bold, size:7, color:hexToRgb(config.bandeau_text||'#ffffff') }));
    y -= 18;

    fiche.lignes.forEach((l, i) => {
      const even = i%2===0;
      if (even) page.drawRectangle({ x:MARGIN, y:y-7, width:CONTENT_W, height:ROW_H, color:LIGHT });
      const txt = (s, x) => page.drawText(String(s||''), { x:x+4, y:y-2, font:fonts.regular, size:8, color:BLACK });
      txt(l.designation, MARGIN);
      txt(l.fabricant||'', MARGIN+205);
      txt(l.reference||'', MARGIN+330);
      txt(l.qte||'', MARGIN+415);
      txt(l.unite||'U', MARGIN+460);
      txt(l.prix_unit_ht ? parseFloat(l.prix_unit_ht).toFixed(2)+' €' : '', MARGIN+495);
      page.drawLine({ start:{x:MARGIN,y:y-7}, end:{x:MARGIN+CONTENT_W,y:y-7}, thickness:0.3, color:rgb(0.88,0.88,0.88) });
      y -= ROW_H;
    });
    y -= 8;
  }

  // Infos livraison
  if (fiche.livraison) {
    page.drawText('LIVRAISON & GARANTIE', { x:MARGIN, y, font:fonts.bold, size:7.5, color:bgColor });
    y -= 16;
    const lv = fiche.livraison;
    if (lv.fournisseur)  drawRow('Fournisseur', lv.fournisseur, false);
    if (lv.livraison)    drawRow('Délai indicatif', lv.livraison, true);
    if (lv.garantie)     drawRow('Garantie', lv.garantie, false);
    if (lv.maintenance)  drawRow('Maintenance', lv.maintenance, true);
  }

  const breadcrumb = `Pivot · DOE · Chap. ${fiche.chapitre_num || ''} — ${fiche.chapitre_nom || 'Fournitures'}`;
  drawBandeauBas(page, fonts, config, breadcrumb, pageNum, totalPages);
}

// ============================================================
// PAGE MANUELLE (blocs texte / tableau / liste / pdf)
// ============================================================
async function buildPageManuelle(pdfDoc, fonts, config, doeData, pageManuelle, startPageNum, totalPages) {
  let pagesCreated = 0;
  const GREY  = rgb(0.45,0.45,0.45);
  const BLACK = rgb(0.1,0.1,0.1);
  const LIGHT = rgb(0.96,0.96,0.96);
  const bgColor = hexToRgb(config.bandeau_bg || '#1a2e44');
  const breadcrumb = `Pivot · DOE · ${pageManuelle.titre || 'Page'}`;

  const newPage = () => {
    pagesCreated++;
    const p = pdfDoc.addPage([A4W, A4H]);
    page.drawRectangle({ x:0, y:A4H-HEADER_H, width:A4W, height:HEADER_H, color:bgColor });
    page.drawText(breadcrumb, { x:MARGIN, y:A4H-18, font:fonts.regular, size:7, color:rgb(0.6,0.6,0.6) });
    page.drawText(pageManuelle.titre||'', { x:MARGIN, y:A4H-38, font:fonts.bold, size:13, color:hexToRgb(config.bandeau_text||'#ffffff') });
    return p;
  };

  let page = pdfDoc.addPage([A4W, A4H]);
  pagesCreated++;
  page.drawRectangle({ x:0, y:A4H-HEADER_H, width:A4W, height:HEADER_H, color:bgColor });
  page.drawText(breadcrumb, { x:MARGIN, y:A4H-18, font:fonts.regular, size:7, color:rgb(0.6,0.6,0.6) });
  page.drawText(pageManuelle.titre||'', { x:MARGIN, y:A4H-38, font:fonts.bold, size:13, color:hexToRgb(config.bandeau_text||'#ffffff') });

  let y = A4H - HEADER_H - 24;
  const minY = BANDEAU_H + 20;

  const checkY = (needed) => {
    if (y - needed < minY) {
      drawBandeauBas(page, fonts, config, breadcrumb, startPageNum + pagesCreated - 1, totalPages);
      page = newPage();
      y = A4H - HEADER_H - 24;
    }
  };

  for (const bloc of pageManuelle.blocs || []) {
    if (bloc.type === 'texte') {
      checkY(30);
      if (bloc.titre) {
        page.drawText(bloc.titre, { x:MARGIN, y, font:fonts.bold, size:9, color:BLACK });
        y -= 14;
      }
      const lines = wrapText(bloc.contenu || '', fonts.regular, 8.5, CONTENT_W);
      for (const l of lines) {
        checkY(13);
        page.drawText(l, { x:MARGIN, y, font:fonts.regular, size:8.5, color:GREY });
        y -= 13;
      }
      y -= 10;

    } else if (bloc.type === 'liste') {
      checkY(30);
      if (bloc.titre) {
        page.drawText(bloc.titre, { x:MARGIN, y, font:fonts.bold, size:9, color:BLACK });
        y -= 14;
      }
      for (const item of bloc.items || []) {
        checkY(13);
        page.drawText('•', { x:MARGIN, y, font:fonts.regular, size:8, color:bgColor });
        const lines = wrapText(item, fonts.regular, 8.5, CONTENT_W - 14);
        lines.forEach(l => {
          page.drawText(l, { x:MARGIN+12, y, font:fonts.regular, size:8.5, color:GREY });
          y -= 13;
        });
      }
      y -= 10;

    } else if (bloc.type === 'tableau') {
      checkY(40);
      if (bloc.titre) {
        page.drawText(bloc.titre, { x:MARGIN, y, font:fonts.bold, size:9, color:BLACK });
        y -= 14;
      }
      const cols = bloc.colonnes || [];
      const colW = cols.length ? CONTENT_W / cols.length : CONTENT_W;
      // En-tête
      page.drawRectangle({ x:MARGIN, y:y-14, width:CONTENT_W, height:18, color:bgColor });
      cols.forEach((c, i) => page.drawText(c, { x:MARGIN+i*colW+4, y:y-10, font:fonts.bold, size:7.5, color:hexToRgb(config.bandeau_text||'#ffffff') }));
      y -= 18;
      // Lignes
      for (const [ri, row] of (bloc.lignes||[]).entries()) {
        checkY(18);
        if (ri%2===0) page.drawRectangle({ x:MARGIN, y:y-14, width:CONTENT_W, height:18, color:LIGHT });
        row.forEach((cell, i) => page.drawText(String(cell||''), { x:MARGIN+i*colW+4, y:y-10, font:fonts.regular, size:8, color:rgb(0.1,0.1,0.1) }));
        page.drawLine({ start:{x:MARGIN,y:y-14}, end:{x:MARGIN+CONTENT_W,y:y-14}, thickness:0.3, color:rgb(0.88,0.88,0.88) });
        y -= 18;
      }
      y -= 10;

    } else if (bloc.type === 'pdf_upload' && bloc.base64) {
      try {
        const pdfBytes = Uint8Array.from(atob(bloc.base64), c => c.charCodeAt(0));
        drawBandeauBas(page, fonts, config, breadcrumb, startPageNum + pagesCreated - 1, totalPages);
        const added = await buildAnnexPages(pdfDoc, fonts, config, pdfBytes, breadcrumb, startPageNum + pagesCreated, totalPages);
        pagesCreated += added;
        page = pdfDoc.addPage([A4W, A4H]);
        pagesCreated++;
        y = A4H - HEADER_H - 24;
      } catch {}
    }
  }

  drawBandeauBas(page, fonts, config, breadcrumb, startPageNum + pagesCreated - 1, totalPages);
  return pagesCreated;
}

// ============================================================
// PAGE DE GARDE DOE  — Variante C "Bandeau & fiche chantier"
// ============================================================
async function buildPageDeGarde(pdfDoc, fonts, config, doe) {
  const page = pdfDoc.addPage([A4W, A4H]);
  const bgColor = hexToRgb(config.bandeau_bg  || '#1C3A2A');
  const txtColor= hexToRgb(config.bandeau_text || '#F5F0E8');
  const CUIVRE  = hexToRgb('#B87333');
  const BLACK   = rgb(0.08,0.08,0.08);
  const GRIS    = hexToRgb('#6B7280');
  const GRIS_LT = hexToRgb('#E8E4DC');
  const GRIS_BG = hexToRgb('#F4F1EC');

  // ── BANDEAU HAUT (45%) ─────────────────────────────────────
  const HDR = Math.round(A4H * 0.45);
  const hY  = A4H - HDR;
  page.drawRectangle({ x:0, y:hY, width:A4W, height:HDR, color:bgColor });

  // Trame grille blanche légère
  for (let gx=0; gx<A4W; gx+=36)
    page.drawLine({ start:{x:gx,y:hY}, end:{x:gx,y:A4H}, thickness:0.4, color:rgb(1,1,1), opacity:0.05 });
  for (let gy=hY; gy<A4H; gy+=36)
    page.drawLine({ start:{x:0,y:gy}, end:{x:A4W,y:gy}, thickness:0.4, color:rgb(1,1,1), opacity:0.05 });

  // Lueur radiale coin haut-droit
  page.drawEllipse({ x:A4W-60, y:A4H-60, xScale:160, yScale:110, color:rgb(1,1,1), opacity:0.07 });
  page.drawEllipse({ x:A4W-60, y:A4H-60, xScale:70,  yScale:50,  color:rgb(1,1,1), opacity:0.05 });

  // Logo  Pivot. La Racine  — fidèle à la nav du portail
  // "Pivot" bold + point cuivre + "La Racine" regular grisé
  page.drawText('Pivot', { x:MARGIN, y:A4H-27, font:fonts.bold, size:16, color:txtColor });
  const pW = fonts.bold.widthOfTextAtSize('Pivot', 16);
  page.drawText('.', { x:MARGIN+pW+1, y:A4H-27, font:fonts.bold, size:16, color:CUIVRE });
  const dotW = fonts.bold.widthOfTextAtSize('.', 16);
  page.drawText('La Racine', { x:MARGIN+pW+dotW+5, y:A4H-27, font:fonts.regular, size:10, color:txtColor, opacity:0.32 });

  // Eyebrow pastille cuivre
  const eyeTxt = 'DOSSIER DES OUVRAGES EXECUTES';
  const eyeW   = fonts.bold.widthOfTextAtSize(eyeTxt, 7) + 18;
  page.drawRectangle({ x:MARGIN, y:A4H-66, width:eyeW, height:15, color:CUIVRE, borderRadius:2 });
  page.drawText(eyeTxt, { x:MARGIN+9, y:A4H-60, font:fonts.bold, size:7, color:txtColor });

  // Titre chantier (grand)
  const titleLines = wrapText(doe.chantier || 'Chantier', fonts.bold, 28, CONTENT_W);
  let ty = A4H - 108;
  for (const l of titleLines) {
    page.drawText(l, { x:MARGIN, y:ty, font:fonts.bold, size:28, color:txtColor });
    ty -= 36;
  }

  // Adresse / ville
  if (doe.adresse) {
    page.drawText(doe.adresse, { x:MARGIN, y:ty-2, font:fonts.regular, size:11, color:txtColor, opacity:0.6 });
    ty -= 18;
  }

  // Ligne de lot
  if (doe.lot) {
    page.drawRectangle({ x:MARGIN, y:ty-14, width:3, height:13, color:CUIVRE });
    page.drawText(`Lot ${doe.lot.numero}  —  ${doe.lot.nom}`,
      { x:MARGIN+10, y:ty-10, font:fonts.regular, size:9.5, color:CUIVRE });
  }

  // Badges en bas du bandeau
  const bdgY = hY + 13;
  const badges = [
    doe.ref_doe       && `Réf. ${doe.ref_doe}`,
    doe.date_emission && `Émis le ${doe.date_emission}`,
    doe.chapitres     && `${doe.chapitres.length} chapitre(s)`,
  ].filter(Boolean);
  let bx = MARGIN;
  for (const b of badges) {
    const bw = fonts.regular.widthOfTextAtSize(b,7)+14;
    page.drawRectangle({ x:bx, y:bdgY-3, width:bw, height:13, color:rgb(1,1,1), opacity:0.12, borderRadius:2 });
    page.drawText(b, { x:bx+7, y:bdgY+1, font:fonts.regular, size:7, color:txtColor, opacity:0.75 });
    bx += bw+8;
  }

  // ── FILET CUIVRE 4px ───────────────────────────────────────
  page.drawRectangle({ x:0, y:hY-4, width:A4W, height:4, color:CUIVRE });

  // ── PHOTO ou PLACEHOLDER ──────────────────────────────────
  const PHOTO_H = 108;
  const photoTop = hY - 4 - 20;
  const photoBot = photoTop - PHOTO_H;
  if (doe.photo_base64) {
    try {
      const b64 = doe.photo_base64.replace(/^data:[^;]+;base64,/, '');
      const imgBytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
      const img = doe.photo_base64.includes('image/png') ? await pdfDoc.embedPng(imgBytes) : await pdfDoc.embedJpg(imgBytes);
      const iDims = img.scaleToFit(CONTENT_W, PHOTO_H);
      page.drawImage(img, { x: MARGIN + (CONTENT_W - iDims.width) / 2, y: photoBot, width: iDims.width, height: iDims.height });
    } catch {}
  } else {
    // Pas de photo → on réduit juste l'espace, pas de placeholder
  }

  // ── 2 COLONNES : Entreprise + Acteurs/Infos ────────────────
  const COL1W = CONTENT_W * 0.54;
  const COL2X = MARGIN + COL1W + 16;
  const COL2W = CONTENT_W - COL1W - 16;
  // Si photo présente on part en dessous, sinon on part directement sous le filet cuivre
  const colStartY = doe.photo_base64 ? photoBot - 20 : hY - 4 - 20;
  let y1 = colStartY;
  let y2 = colStartY;

  // Colonne gauche — Entreprise réalisatrice
  page.drawText('ENTREPRISE REALISATRICE', { x:MARGIN, y:y1, font:fonts.bold, size:6.5, color:CUIVRE });
  y1 -= 13;
  if (doe.entrepreneur?.nom) {
    page.drawText(doe.entrepreneur.nom, { x:MARGIN, y:y1, font:fonts.bold, size:13, color:BLACK });
    y1 -= 17;
  }
  if (doe.entrepreneur?.email) {
    page.drawText(doe.entrepreneur.email, { x:MARGIN, y:y1, font:fonts.regular, size:7.5, color:GRIS });
    y1 -= 12;
  }

  // Séparateur vertical
  const sepX = MARGIN + COL1W + 7;
  page.drawLine({ start:{x:sepX, y:y2+4}, end:{x:sepX, y:Math.min(y1,y2)-40}, thickness:0.5, color:GRIS_LT });

  // Colonne droite — MOE / MOA / Infos
  const drawActRow = (label, val) => {
    page.drawText(label, { x:COL2X, y:y2, font:fonts.bold, size:6.5, color:CUIVRE });
    y2 -= 11;
    if (val) { page.drawText(val, { x:COL2X, y:y2, font:fonts.bold, size:9, color:BLACK }); y2 -= 14; }
  };
  if (doe.moe?.nom)            drawActRow("MAITRE D'OEUVRE", doe.moe.nom);
  if (doe.mo?.nom)             drawActRow("MAITRE D'OUVRAGE", doe.mo.nom);
  page.drawText(`N° ${doe.ref_doe || '—'}`, { x:COL2X, y:y2, font:fonts.regular, size:7.5, color:GRIS }); y2 -= 12;
  page.drawText(doe.date_emission || '', { x:COL2X, y:y2, font:fonts.regular, size:7.5, color:GRIS }); y2 -= 12;

  // ── SOMMAIRE ───────────────────────────────────────────────
  const somTop = Math.min(y1, y2) - 18;
  page.drawLine({ start:{x:MARGIN,y:somTop+12}, end:{x:MARGIN+CONTENT_W,y:somTop+12}, thickness:0.5, color:GRIS_LT });
  page.drawText('SOMMAIRE', { x:MARGIN, y:somTop, font:fonts.bold, size:8, color:bgColor });

  let sy = somTop - 15;
  for (const chap of doe.chapitres || []) {
    if (sy < BANDEAU_H+16) break;
    const lbl = `${chap.num}. ${chap.nom}`;
    page.drawText(lbl, { x:MARGIN, y:sy, font:fonts.bold, size:8.5, color:BLACK });
    const ps  = `p. ${chap.page_debut || '—'}`;
    const psW = fonts.regular.widthOfTextAtSize(ps, 8);
    page.drawText(ps, { x:MARGIN+CONTENT_W-psW, y:sy, font:fonts.regular, size:8, color:GRIS });
    const lS = MARGIN+fonts.bold.widthOfTextAtSize(lbl,8.5)+5;
    const lE = MARGIN+CONTENT_W-psW-5;
    if (lE>lS) { let lx=lS; while(lx<lE){ page.drawText('.', {x:lx,y:sy,font:fonts.regular,size:7,color:GRIS_LT}); lx+=4; } }
    sy -= 15;
  }

  // ── BANDEAU BAS ────────────────────────────────────────────
  page.drawRectangle({ x:0, y:0, width:A4W, height:BANDEAU_H, color:bgColor });
  page.drawText('Pivot · pivotlaracine.com', { x:MARGIN, y:9, font:fonts.regular, size:7, color:txtColor, opacity:0.6 });
  const fr = `${doe.ref_doe||'DOE'} · ${doe.date_emission||''}`;
  page.drawText(fr, { x:A4W-MARGIN-fonts.regular.widthOfTextAtSize(fr,7), y:9, font:fonts.regular, size:7, color:txtColor, opacity:0.6 });
}

// ============================================================
// DOE — PAGE LISTE PAR FOURNISSEUR
// ============================================================
async function buildListeFournisseurDOE(pdfDoc, fonts, config, doe, chap, fournisseur, fiches, pageNum, totalPages) {
  const page = pdfDoc.addPage([A4W, A4H]);
  const bgColor = hexToRgb(config.bandeau_bg || '#1a2e44');
  const txtColor = hexToRgb(config.bandeau_text || '#ffffff');
  const BLACK = rgb(0.1, 0.1, 0.1);
  const GREY  = rgb(0.45, 0.45, 0.45);
  const LIGHT = rgb(0.95, 0.95, 0.95);

  // Bandeau haut — une seule ligne
  const BAND_H = 28;
  page.drawRectangle({ x:0, y:A4H-BAND_H, width:A4W, height:BAND_H, color:bgColor });
  page.drawText(`DOE — Chapitre ${chap.num} — ${chap.nom}`, { x:MARGIN, y:A4H-18, font:fonts.bold, size:11, color:txtColor });

  // Titre section
  let y = A4H - BAND_H - 18;
  page.drawText(`${chap.nom} · Fournisseur : ${fournisseur}`, { x:MARGIN, y, font:fonts.bold, size:10, color:BLACK });
  y -= 14;

  // En-têtes colonnes
  const cols = [
    { label: 'N°',          x: MARGIN,        w: 22 },
    { label: 'Désignation', x: MARGIN + 22,   w: 120 },
    { label: 'Référence',   x: MARGIN + 142,  w: 70 },
    { label: 'Fabricant',   x: MARGIN + 212,  w: 60 },
    { label: 'Qté',         x: MARGIN + 272,  w: 22 },
    { label: 'Unité',       x: MARGIN + 294,  w: 22 },
    { label: 'Délai',       x: MARGIN + 316,  w: 40 },
    { label: 'Entretien',   x: MARGIN + 356,  w: 65 },
  ];
  const ROW_H = 14;
  page.drawRectangle({ x:MARGIN-2, y:y-3, width:A4W-MARGIN*2+4, height:ROW_H, color:bgColor });
  for (const col of cols) {
    page.drawText(col.label, { x:col.x, y:y+2, font:fonts.bold, size:7, color:txtColor });
  }
  y -= ROW_H + 2;

  // Lignes
  fiches.forEach((fiche, idx) => {
    if (y < 30) return; // débordement de page non géré
    const ligne = fiche.lignes?.[0] || {};
    const rowColor = idx % 2 === 0 ? LIGHT : rgb(1,1,1);
    page.drawRectangle({ x:MARGIN-2, y:y-3, width:A4W-MARGIN*2+4, height:ROW_H, color:rowColor });
    const trunc = (str, max) => { const s = String(str||''); return s.length > max ? s.slice(0,max-1)+'…' : s; };
    page.drawText(trunc(ligne.reference ? (idx+1) : (idx+1), 4), { x:cols[0].x, y:y+2, font:fonts.regular, size:7.5, color:GREY });
    page.drawText(trunc(fiche.designation||'', 28), { x:cols[1].x, y:y+2, font:fonts.regular, size:7.5, color:BLACK });
    page.drawText(trunc(ligne.reference||'', 16), { x:cols[2].x, y:y+2, font:fonts.regular, size:7.5, color:BLACK });
    page.drawText(trunc(ligne.fabricant||'', 12), { x:cols[3].x, y:y+2, font:fonts.regular, size:7.5, color:GREY });
    page.drawText(trunc(ligne.qte||'', 5),  { x:cols[4].x, y:y+2, font:fonts.regular, size:7.5, color:BLACK });
    page.drawText(trunc(ligne.unite||'', 5), { x:cols[5].x, y:y+2, font:fonts.regular, size:7.5, color:GREY });
    page.drawText(trunc(fiche.livraison?.livraison||'', 10), { x:cols[6].x, y:y+2, font:fonts.regular, size:7.5, color:GREY });
    page.drawText(trunc(fiche.livraison?.maintenance||'', 15), { x:cols[7].x, y:y+2, font:fonts.regular, size:7.5, color:GREY });
    y -= ROW_H;
  });

  // Pied de page
  const label = `Pivot · DOE · Chap. ${chap.num} — ${chap.nom}`;
  drawBandeauBas(page, fonts, config, label, pageNum, totalPages);
}

// ============================================================
// ASSEMBLEUR DOE COMPLET
// ============================================================
async function buildDOE(payload, env) {
  const { config = {}, doe = {}, chapitres = [] } = payload;
  const pdfDoc = await PDFDocument.create();
  const fonts = await loadFonts(pdfDoc, env);

  // Pré-fetcher les PDFs externes pour connaître leur vrai nombre de pages
  for (const chap of chapitres) {
    if (chap.type === 'pdfs') {
      for (const fichier of chap.fichiers || []) {
        try {
          if (fichier.base64) {
            fichier._bytes = Uint8Array.from(atob(fichier.base64), c => c.charCodeAt(0));
          } else if (fichier.url) {
            const r = await fetch(fichier.url);
            if (r.ok) fichier._bytes = new Uint8Array(await r.arrayBuffer());
          }
          if (fichier._bytes) {
            const tmp = await PDFDocument.load(fichier._bytes);
            fichier._pageCount = tmp.getPageCount();
          }
        } catch { fichier._pageCount = 1; }
      }
    }
  }

  // Calculer le nombre de pages total exact (page de garde = 1)
  let totalPages = 1;
  function _chapPages(chap) {
    if (chap.type === 'pdfs') return (chap.fichiers || []).reduce((s, f) => s + (f._pageCount || 1), 0);
    if (chap.type === 'manuel') return Math.max(1, (chap.pages || []).length);
    if (chap.mode === 'liste') {
      const fours = new Set((chap.fiches || []).map(f => f.livraison?.fournisseur || '—'));
      return (fours.size || 1) + _sousPages(chap);
    }
    return (chap.fiches || []).length + _sousPages(chap);
  }
  function _sousPages(chap) {
    return (chap.sousPages || []).reduce((acc, sp) => {
      if (sp.type === 'pdfs') return acc + (sp.url ? 1 : 0);
      if (sp.type === 'manuel') return acc + Math.max(1, (sp.pages || []).length);
      return acc;
    }, 0);
  }
  for (const chap of chapitres) totalPages += _chapPages(chap);

  // Calculer les pages de début des chapitres pour le sommaire
  let currentPage = 2;
  const chapitresAvecPages = chapitres.map(chap => {
    const pageDebut = currentPage;
    currentPage += _chapPages(chap);
    return { ...chap, page_debut: pageDebut };
  });

  doe.chapitres = chapitresAvecPages;

  // Page de garde
  await buildPageDeGarde(pdfDoc, fonts, config, doe);
  let pageNum = 2;

  // Chapitres
  for (const chap of chapitresAvecPages) {
    if (chap.type === 'fournitures') {
      if (chap.mode === 'liste') {
        // Une page par fournisseur avec tableau récapitulatif
        const grouped = {};
        for (const fiche of chap.fiches || []) {
          const four = fiche.livraison?.fournisseur || '—';
          if (!grouped[four]) grouped[four] = [];
          grouped[four].push(fiche);
        }
        for (const [fournisseur, fiches] of Object.entries(grouped)) {
          await buildListeFournisseurDOE(pdfDoc, fonts, config, doe, chap, fournisseur, fiches, pageNum, totalPages);
          pageNum++;
        }
      } else {
        for (const fiche of chap.fiches || []) {
          await buildFicheFournitureDOE(pdfDoc, fonts, config, doe, { ...fiche, chapitre_num: chap.num, chapitre_nom: chap.nom }, pageNum, totalPages);
          pageNum++;
        }
      }
    } else if (chap.type === 'pdfs') {
      for (const fichier of chap.fichiers || []) {
        if (!fichier._bytes) continue;
        try {
          const chapLabel = `DOE — Chapitre ${chap.num} — ${chap.nom}`;
          const ctx = { chantier: doe.chantier, ville: doe.adresse, ref_doe: doe.ref_doe };
          const added = await buildAnnexPages(pdfDoc, fonts, config, fichier._bytes, chapLabel, pageNum, totalPages, chap.pdf_mode, ctx);
          pageNum += added;
        } catch {}
      }
    } else if (chap.type === 'manuel') {
      for (const pg of chap.pages || []) {
        const added = await buildPageManuelle(pdfDoc, fonts, config, doe, pg, pageNum, totalPages);
        pageNum += added;
      }
    }

    // Sous-pages des chapitres fournitures (PDFs et pages manuelles ajoutées dans le chapitre)
    for (const sp of chap.sousPages || []) {
      const chapLabel = `DOE — Chapitre ${chap.num} — ${chap.nom}`;
      const ctx = { chantier: doe.chantier, ville: doe.adresse, ref_doe: doe.ref_doe };
      if (sp.type === 'pdfs' && sp.base64) {
        try {
          const pdfBytes = Uint8Array.from(atob(sp.base64), c => c.charCodeAt(0));
          const added = await buildAnnexPages(pdfDoc, fonts, config, pdfBytes, chapLabel, pageNum, totalPages, chap.pdf_mode, ctx);
          pageNum += added;
        } catch {}
      } else if (sp.type === 'manuel') {
        for (const pg of sp.pages || []) {
          const added = await buildPageManuelle(pdfDoc, fonts, config, doe, pg, pageNum, totalPages);
          pageNum += added;
        }
      }
    }
  }

  return await pdfDoc.save();
}

// ============================================================
// HANDLERS
// ============================================================
async function handleDAF(request, env) {
  const payload = await request.json();
  const { config = {}, daf = {}, annexes = [], photos = [] } = payload;

  const pdfDoc = await PDFDocument.create();
  const fonts = await loadFonts(pdfDoc, env);

  // Pré-charger les annexes pour compter le vrai nombre de pages (chaque PDF peut en avoir plusieurs)
  const prepared = [];
  let totalPages = 1;
  for (const annexe of annexes) {
    if (!annexe.base64) continue;
    try {
      const bytes = Uint8Array.from(atob(annexe.base64), c => c.charCodeAt(0));
      const doc = await PDFDocument.load(bytes);
      const count = doc.getPageCount();
      prepared.push({ annexe, bytes, count });
      totalPages += count;
    } catch {}
  }
  // Photos envoyées par le fournisseur retenu (validées) : une page par photo
  const validPhotos = photos.filter(p => p.base64);
  totalPages += validPhotos.length;

  await buildPage1DAF(pdfDoc, fonts, config, daf, 1, totalPages);

  let pageNum = 2;
  for (const { annexe, bytes } of prepared) {
    try {
      const label = `Pivot · DAF · ${daf.numero || ''} · ${annexe.nom || 'Annexe'}`;
      const added = await buildAnnexPages(pdfDoc, fonts, config, bytes, label, pageNum, totalPages);
      pageNum += added;
    } catch {}
  }
  for (const photo of validPhotos) {
    try {
      const label = `Pivot · DAF · ${daf.numero || ''} · Photo fournisseur`;
      await buildPhotoPage(pdfDoc, fonts, config, photo.base64, label, pageNum, totalPages);
      pageNum++;
    } catch {}
  }

  const pdfBytes = await pdfDoc.save();
  return new Response(pdfBytes, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${encodeURIComponent('DAF-' + (daf.numero||'pivot') + '.pdf')}"`,
      'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '*',
    }
  });
}

async function handleDOE(request, env) {
  const payload = await request.json();
  const pdfBytes = await buildDOE(payload, env);
  const ref = payload.doe?.ref_doe || 'DOE';
  return new Response(pdfBytes, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(ref + '.pdf')}"`,
      'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '*',
    }
  });
}

// ============================================================
// ENTRY POINT
// ============================================================
// ============================================================
// STRIPE HELPERS
// ============================================================
async function stripeRequest(env, method, path, body) {
  const resp = await fetch(`https://api.stripe.com/v1${path}`, {
    method,
    headers: {
      'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body ? new URLSearchParams(body).toString() : undefined,
  });
  return resp.json();
}

async function verifyStripeWebhook(request, env) {
  const body = await request.text();
  const sig  = request.headers.get('stripe-signature');
  if (!sig || !env.STRIPE_WEBHOOK_SECRET) return { ok: false, body };

  // Parse signature header
  const pairs = Object.fromEntries(sig.split(',').map(p => p.split('=')));
  const timestamp = pairs.t;
  const sigHex    = pairs.v1;

  // HMAC-SHA256 via Web Crypto
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(env.STRIPE_WEBHOOK_SECRET),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const payload = `${timestamp}.${body}`;
  const signed  = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  const computed = Array.from(new Uint8Array(signed)).map(b => b.toString(16).padStart(2,'0')).join('');

  // Constant-time compare
  const ok = computed.length === sigHex.length &&
    [...computed].every((c, i) => c === sigHex[i]);
  return { ok, body };
}

const SUPABASE_URL = 'https://djegdtlcvyjtrayrodxj.supabase.co';

async function supabasePost(env, table, body) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`Supabase POST ${table}: ${await r.text()}`);
}

async function createSupabaseUser(env, { email, prenom, nom, societe, portail = 'entreprise', plan, licences }) {
  const role = portail;
  const adminHeaders = {
    'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
    'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
  };

  // Créer l'utilisateur sans envoyer d'email automatique
  const resp = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ email, email_confirm: false, user_metadata: { prenom, nom, societe, role } }),
  });
  if (!resp.ok) throw new Error(`Supabase create user failed: ${await resp.text()}`);
  const user = await resp.json();
  const userId = user.id;

  await supabasePost(env, 'profiles', { id: userId, nom: `${prenom} ${nom}`.trim(), email, role });

  if (portail === 'entreprise') {
    await supabasePost(env, 'compte_entrepreneur', { id: userId, prenom, nom, societe, email });
  } else if (portail === 'fournisseur') {
    await supabasePost(env, 'compte_fournisseur', { id: userId, nom: `${prenom} ${nom}`.trim(), nom_entreprise: societe, email, plan: plan || 'decouverte' });
  } else if (portail === 'moe') {
    await supabasePost(env, 'compte_moe', { id: userId, nom: `${prenom} ${nom}`.trim(), societe, email });
  }

  // Générer un lien pour définir le mot de passe
  const linkResp = await fetch(`${SUPABASE_URL}/auth/v1/admin/generate_link`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ type: 'recovery', email }),
  });
  const linkData = linkResp.ok ? await linkResp.json() : null;
  let setPasswordLink = linkData?.action_link || null;
  // Remplacer le redirect_to par SITE_URL pour pointer vers localhost en dev
  if (setPasswordLink && env.SITE_URL) {
    try {
      const u = new URL(setPasswordLink);
      u.searchParams.set('redirect_to', env.SITE_URL + '/pivot-reset-password.html?mode=creation');
      setPasswordLink = u.toString();
    } catch (_) {}
  }

  return { userId, setPasswordLink };
}

const PRIX_ENTREPRISE  = (n) => n <= 1 ? 30 : n <= 5 ? 25 : 20;

// Portail fournisseur : prix par utilisateur affiché sur la page tarifs (= tarif pour 1 utilisateur),
// auquel s'applique une remise par volume. Une seule règle plutôt qu'une grille par formule, pour
// que le prix annoncé et le prix facturé ne puissent plus diverger (Studio était vendu 20 € et
// facturé 30 €). Toute modification ici doit être répercutée dans pivot-inscription-fournisseur.html,
// qui recalcule le même montant côté navigateur pour l'afficher avant paiement.
const PRIX_BASE_FOURNISSEUR = { decouverte: 0, essentiel: 10, studio: 20, marche: 50 };
const REMISE_VOLUME = (n) => n >= 10 ? 0.4 : n >= 4 ? 0.2 : 0;
const PRIX_FOURNISSEUR = (plan, n) => {
  const base = PRIX_BASE_FOURNISSEUR[plan];
  return base == null ? null : Math.round(base * (1 - REMISE_VOLUME(n)));
};
// Même règle de remise que le portail fournisseur, sur un prix de base de 10 € par utilisateur.
const PRIX_MOE = (n) => Math.round(10 * (1 - REMISE_VOLUME(n)));

function getPlanLabel(portail, plan) {
  if (portail === 'entreprise') return 'Portail Entreprise · Pivot La Racine';
  if (portail === 'fournisseur') return `Portail Fournisseur ${plan ? '· ' + plan : ''} · Pivot La Racine`;
  if (portail === 'moe') return `Portail MOE ${plan ? '· ' + plan : ''} · Pivot La Racine`;
  return 'Pivot La Racine';
}

async function handleCreateCheckout(request, env) {
  const cors = { 'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '*' };
  const { prenom, nom, societe, email, portail = 'entreprise', plan, licences = 1 } = await request.json();

  if (!email || !prenom || !nom) {
    return new Response(JSON.stringify({ error: 'Champs manquants' }), { status: 400, headers: { 'Content-Type': 'application/json', ...cors } });
  }

  // Calcul du prix
  let unitAmountCents = 0;
  let qty = 1;
  let planLabel = getPlanLabel(portail, plan);

  if (portail === 'entreprise') {
    unitAmountCents = PRIX_ENTREPRISE(licences) * 100;
    qty = licences;
  } else if (portail === 'fournisseur') {
    const pu = PRIX_FOURNISSEUR(plan, licences);
    unitAmountCents = (pu || 0) * 100;
    qty = licences;
  } else if (portail === 'moe') {
    unitAmountCents = PRIX_MOE(licences) * 100;
    qty = licences;
  }

  const origin = request.headers.get('Origin') || 'https://pivotlaracine.com';
  const cancelUrl = portail === 'fournisseur' ? `${origin}/pivot-inscription-fournisseur.html`
    : portail === 'moe' ? `${origin}/pivot-inscription-moe.html`
    : `${origin}/pivot-inscription-entreprise.html`;

  const session = await stripeRequest(env, 'POST', '/checkout/sessions', {
    'payment_method_types[]': 'card',
    'mode': 'subscription',
    'line_items[0][price_data][currency]': 'eur',
    'line_items[0][price_data][recurring][interval]': 'month',
    'line_items[0][price_data][unit_amount]': String(unitAmountCents),
    'line_items[0][price_data][product_data][name]': planLabel,
    'line_items[0][quantity]': String(qty),
    'customer_email': email,
    'metadata[prenom]': prenom,
    'metadata[nom]': nom,
    'metadata[societe]': societe || '',
    'metadata[email]': email,
    'metadata[portail]': portail,
    'metadata[plan]': plan || '',
    'metadata[licences]': String(licences),
    'success_url': `${origin}/pivot-inscription-succes.html?session_id={CHECKOUT_SESSION_ID}&portail=${encodeURIComponent(portail)}&email=${encodeURIComponent(email)}`,
    'cancel_url': cancelUrl,
  });

  if (session.error) {
    return new Response(JSON.stringify({ error: session.error.message }), { status: 400, headers: { 'Content-Type': 'application/json', ...cors } });
  }
  return new Response(JSON.stringify({ url: session.url }), { headers: { 'Content-Type': 'application/json', ...cors } });
}

async function handleSendInvitation(request, env) {
  const cors = { 'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '*' };
  const { email, nom_fournisseur, nom_chantier, ville_chantier, nom_entrepreneur, token, portail } = await request.json();
  if (!email || !token) return new Response(JSON.stringify({ error: 'Paramètres manquants' }), { status: 400, headers: { 'Content-Type': 'application/json', ...cors } });

  const siteUrl = (env.SITE_URL || 'https://pivotlaracine.com').replace(/\/$/, '');
  const isInscription = portail === 'nouveau';
  const lien = isInscription
    ? `${siteUrl}/pivot-inscription-fournisseur.html?invite=${token}`
    : `${siteUrl}/pivot-login-fournisseur.html?invite=${token}`;

  const sujet = `${nom_entrepreneur} vous invite à répondre à une consultation sur Pivot`;
  const html = `
    <div style="font-family:'Inter',Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#1C3A2A;">
      <div style="background:#1C3A2A;padding:32px 40px 24px;">
        <span style="font-family:Georgia,serif;font-size:28px;font-weight:900;color:#F5F0E8;">Pivot</span><span style="font-family:Georgia,serif;font-size:28px;font-weight:900;color:#B87333;">.</span><span style="font-family:Georgia,serif;font-size:16px;font-weight:400;font-style:italic;color:rgba(245,240,232,0.55);margin-left:6px;">la racine</span>
      </div>
      <div style="padding:40px;background:#F5F0E8;">
        <p style="font-size:15px;margin:0 0 16px;">Bonjour${nom_fournisseur ? ' ' + nom_fournisseur : ''},</p>
        <p style="font-size:15px;margin:0 0 16px;"><strong>${nom_entrepreneur}</strong> vous invite à répondre à une consultation pour le chantier <strong>${nom_chantier}</strong>${ville_chantier ? ` à <strong>${ville_chantier}</strong>` : ''}.</p>
        ${isInscription ? `<p style="font-size:14px;color:#6B7280;margin:0 0 24px;">Vous n'avez pas encore de compte Pivot. Créez votre compte gratuit en cliquant ci-dessous — vos consultations en attente seront automatiquement liées.</p>` : `<p style="font-size:14px;color:#6B7280;margin:0 0 24px;">Connectez-vous à votre compte Pivot pour accéder à la consultation et saisir vos prix.</p>`}
        <a href="${lien}" style="display:inline-block;background:#1C3A2A;color:#F5F0E8;text-decoration:none;padding:14px 28px;border-radius:8px;font-size:15px;font-weight:500;">${isInscription ? 'Créer mon compte et répondre' : 'Accéder à la consultation'} →</a>
        <p style="font-size:12px;color:#9CA3AF;margin:32px 0 0;">Ce lien est valable 60 jours. Si vous n'attendiez pas cet email, ignorez-le.</p>
      </div>
    </div>`;

  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: env.RESEND_FROM, to: [email], subject: sujet, html }),
  });

  if (!r.ok) {
    const err = await r.text();
    return new Response(JSON.stringify({ error: `Resend: ${err}` }), { status: 500, headers: { 'Content-Type': 'application/json', ...cors } });
  }
  return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json', ...cors } });
}

// Invitation d'un maître d'œuvre qui n'a pas encore de compte. Aucun droit ne transite par
// l'email : il ne fait qu'inviter à s'inscrire. C'est le rapprochement par adresse, côté base,
// qui reliera ensuite le compte créé aux chantiers qui l'attendaient — un lien porteur d'accès
// se transfère, se copie et ne sait pas à qui il s'adresse.
async function handleInviterMoe(request, env) {
  const cors = { 'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '*' };
  const json = (body, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...cors } });

  const caller = await getAuthUser(request, env);
  if (!caller?.id) return json({ error: 'Non authentifié.' }, 401);

  const { email, nom, nom_chantier, nom_entrepreneur } = await request.json().catch(() => ({}));
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: 'Adresse email invalide.' }, 400);

  const siteUrl = (env.SITE_URL || 'https://pivotlaracine.com').replace(/\/$/, '');
  const lien = `${siteUrl}/pivot-inscription-moe.html?email=${encodeURIComponent(email)}`;
  const inviteur = nom_entrepreneur || 'Une entreprise';

  const html = `
    <div style="font-family:'Inter',Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#1C3A2A;">
      <div style="background:#1C3A2A;padding:32px 40px 24px;">
        <span style="font-family:Georgia,serif;font-size:28px;font-weight:900;color:#F5F0E8;">Pivot</span><span style="font-family:Georgia,serif;font-size:28px;font-weight:900;color:#B87333;">.</span><span style="font-family:Georgia,serif;font-size:16px;font-weight:400;font-style:italic;color:rgba(245,240,232,0.55);margin-left:6px;">la racine</span>
      </div>
      <div style="padding:40px;background:#F5F0E8;">
        <p style="font-size:15px;margin:0 0 16px;">Bonjour${nom ? ' ' + escapeHtmlEmail(nom) : ''},</p>
        <p style="font-size:15px;margin:0 0 16px;"><strong>${escapeHtmlEmail(inviteur)}</strong> vous invite à suivre le chantier <strong>${escapeHtmlEmail(nom_chantier || '')}</strong> en tant que maître d'œuvre sur Pivot.</p>
        <p style="font-size:14px;color:#6B7280;margin:0 0 24px;">Le portail maître d'œuvre est gratuit. Créez votre compte avec cette adresse : les chantiers qui vous attendent y apparaîtront automatiquement.</p>
        <a href="${lien}" style="display:inline-block;background:#1C3A2A;color:#F5F0E8;text-decoration:none;padding:14px 28px;border-radius:8px;font-size:15px;font-weight:500;">Créer mon compte maître d'œuvre →</a>
        <p style="font-size:12px;color:#9CA3AF;margin:32px 0 0;">Inscrivez-vous bien avec l'adresse ${escapeHtmlEmail(email)} : c'est elle qui relie l'invitation à votre compte. Si vous n'attendiez pas cet email, ignorez-le.</p>
      </div>
    </div>`;

  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: env.RESEND_FROM,
      to: [email],
      subject: `${inviteur} vous invite comme maître d'œuvre sur Pivot`,
      html,
    }),
  });
  if (!r.ok) return json({ error: `Resend: ${await r.text()}` }, 500);
  return json({ success: true });
}

// Le nom et le chantier viennent d'une saisie utilisateur : sans échappement, une apostrophe
// suffirait à casser le gabarit, et un fragment de balise à le détourner.
function escapeHtmlEmail(s) {
  return String(s || '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Vérifie le JWT de l'appelant auprès de Supabase Auth et retourne { id, email } ou null
async function getAuthUser(request, env) {
  const authHeader = request.headers.get('Authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { 'apikey': env.SUPABASE_SERVICE_ROLE_KEY, 'Authorization': `Bearer ${token}` }
  });
  if (!r.ok) return null;
  return r.json();
}

// Ouvre le portail de facturation Stripe (changement d'offre, résiliation, moyen de paiement,
// factures). Tout est hébergé par Stripe : rien de sensible ne transite par l'application.
// L'accès est réservé au référent, seul responsable de l'abonnement de sa structure.
async function handleCreatePortalSession(request, env) {
  const cors = { 'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '*' };
  const json = (body, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...cors } });

  const user = await getAuthUser(request, env);
  if (!user?.id) return json({ error: 'Non authentifié.' }, 401);

  const headers = {
    'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
    'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
  };
  // On repart de l'identité vérifiée par le JWT, jamais d'un identifiant fourni par le client :
  // sinon n'importe qui pourrait ouvrir le portail de facturation d'une autre structure.
  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/structures?referent_id=eq.${user.id}&select=id,nom,stripe_customer_id`,
    { headers }
  );
  const [struct] = await r.json();
  if (!struct) return json({ error: "Seul le référent de la structure peut gérer l'abonnement." }, 403);
  if (!struct.stripe_customer_id) {
    return json({ error: "Aucun abonnement Stripe n'est rattaché à cette structure. Contactez contact@pivotlaracine.com." }, 400);
  }

  // L'URL de retour vient du navigateur : on la restreint au site pour éviter une redirection ouverte.
  const siteUrl = (env.SITE_URL || 'https://pivotlaracine.com').replace(/\/$/, '');
  const { return_url } = await request.json().catch(() => ({}));
  const retour = typeof return_url === 'string' && return_url.startsWith(siteUrl) ? return_url : siteUrl;

  const session = await stripeRequest(env, 'POST', '/billing_portal/sessions', {
    customer: struct.stripe_customer_id,
    return_url: retour,
  });
  if (!session?.url) {
    console.error('billing_portal error:', JSON.stringify(session?.error || session));
    return json({ error: session?.error?.message || 'Impossible d\'ouvrir le portail de facturation.' }, 502);
  }
  return json({ url: session.url });
}

async function getCallerRole(env, userId) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=role`, {
    headers: { 'apikey': env.SUPABASE_SERVICE_ROLE_KEY, 'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` }
  });
  const [row] = await r.json();
  return row?.role || null;
}

// Purge les données métier d'une structure résiliée, une fois le délai de conservation écoulé.
// Irréversible, donc jamais automatique : déclenchée à la main depuis le portail admin.
// La ligne `structures` est conservée — elle porte la trace comptable (nom, dates, identifiants
// Stripe) que la facturation impose de garder, alors que le RGPD demande d'effacer le reste.
async function handlePurgerStructure(request, env) {
  const cors = { 'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '*' };
  const json = (body, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...cors } });

  const caller = await getAuthUser(request, env);
  if (!caller?.id) return json({ error: 'Non authentifié.' }, 401);
  if ((await getCallerRole(env, caller.id)) !== 'admin') return json({ error: 'Réservé à l\'administrateur.' }, 403);

  const { structureId } = await request.json().catch(() => ({}));
  if (!structureId) return json({ error: 'structureId manquant.' }, 400);

  const headers = {
    'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
    'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
  };

  // Garde-fou serveur : on ne purge que ce qui est réellement résilié et hors délai. Un identifiant
  // envoyé par erreur depuis l'interface ne doit pas pouvoir effacer une structure active.
  const sRes = await fetch(
    `${SUPABASE_URL}/rest/v1/structures?id=eq.${structureId}&select=id,nom,statut_abonnement,resilie_le,donnees_supprimees_le`,
    { headers }
  );
  const [struct] = await sRes.json();
  if (!struct) return json({ error: 'Structure introuvable.' }, 404);
  if (struct.donnees_supprimees_le) return json({ error: 'Les données de cette structure ont déjà été supprimées.' }, 409);
  if (struct.statut_abonnement !== 'resilie') return json({ error: 'Cette structure n\'est pas résiliée.' }, 409);

  const joursEcoules = struct.resilie_le
    ? Math.floor((Date.now() - new Date(struct.resilie_le).getTime()) / 86400000)
    : null;
  if (joursEcoules === null || joursEcoules < JOURS_AVANT_SUPPRESSION) {
    return json({ error: `Délai non écoulé : ${joursEcoules ?? '?'} jour(s) depuis la résiliation, ${JOURS_AVANT_SUPPRESSION} requis.` }, 409);
  }

  // Membres de la structure : c'est par eux qu'on retrouve les données métier.
  const mRes = await fetch(`${SUPABASE_URL}/rest/v1/structure_membres?structure_id=eq.${structureId}&select=user_id`, { headers });
  const userIds = ((await mRes.json()) || []).map(m => m.user_id).filter(Boolean);

  const supprimees = {};
  const del = async (table, filtre) => {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${filtre}`, {
      method: 'DELETE', headers: { ...headers, 'Prefer': 'return=representation' },
    });
    if (!r.ok) throw new Error(`${table} : ${await r.text()}`);
    supprimees[table] = (supprimees[table] || 0) + ((await r.json()) || []).length;
  };
  const lire = async (chemin) => {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${chemin}`, { headers });
    return r.ok ? (await r.json()) || [] : [];
  };

  // Les adresses des fichiers vivent DANS les lignes que l'on s'apprête à supprimer : il faut les
  // relever avant, sinon les PDF et photos resteraient indéfiniment dans le Storage sans que rien
  // ne permette plus de les retrouver.
  const fichiers = new Set();
  const releverUrl = (u) => {
    if (!u || typeof u !== 'string') return;
    const m = u.match(/\/object\/(?:public|sign)\/([^/]+)\/([^?]+)/);
    if (m) fichiers.add(`${m[1]}::${decodeURIComponent(m[2])}`);
  };

  try {
    if (userIds.length) {
      const liste = `in.(${userIds.join(',')})`;
      // Ordre imposé par les clés étrangères : on part des feuilles vers les racines.
      const { data: chantiers } = await fetch(
        `${SUPABASE_URL}/rest/v1/chantiers?entrepreneur_id=${liste}&select=id`, { headers }
      ).then(async r => ({ data: await r.json() }));
      const chantierIds = (chantiers || []).map(c => c.id);

      if (chantierIds.length) {
        const chListe = `in.(${chantierIds.join(',')})`;

        // Relevé des pièces jointes, avant toute suppression.
        //
        // Certaines n'appartiennent pas qu'à l'entreprise purgée : un devis engage son émetteur et
        // relève de sa conservation comptable ; un visa est un acte du maître d'œuvre, qu'il doit
        // pouvoir produire des années plus tard ; une photo a été prise par le fournisseur sur ses
        // propres végétaux. Leurs fichiers sont épargnés.
        //
        // Les lignes qui les portent, elles, partent encore : leurs clés étrangères pointent vers
        // le chantier et la consultation que la purge supprime. Les rendre autonomes est le
        // chantier suivant. En attendant, un fichier détruit l'est définitivement, tandis qu'un
        // rattachement se reconstruit — le chemin de stockage conserve les identifiants.
        const conserves = [];
        const conserver = (u) => { if (u) conserves.push(u); };

        for (const d of await lire(`daf?chantier_id=${chListe}&select=pdf_url,pdf_visa_url`)) {
          // Une DAF visée est indissociable de son visa : on garde le document soumis avec lui.
          if (d.pdf_visa_url) { conserver(d.pdf_url); conserver(d.pdf_visa_url); }
          else releverUrl(d.pdf_url);
        }
        for (const d of await lire(`documents_viser?chantier_id=${chListe}&select=url,pdf_url,pdf_visa_url`)) {
          if (d.pdf_visa_url) { conserver(d.url); conserver(d.pdf_url); conserver(d.pdf_visa_url); }
          else { releverUrl(d.url); releverUrl(d.pdf_url); }
        }
        // Seul un devis validé est une pièce : une saisie de prix sans devis émis n'engage rien.
        for (const r of await lire(`reponses_fournisseurs?entrepreneur_id=${liste}&select=devis_pdf_url,devis_valide_at`)) {
          if (r.devis_valide_at) conserver(r.devis_pdf_url);
          else releverUrl(r.devis_pdf_url);
        }
        // Les fiches techniques jointes à une DAF sont déjà annexées au PDF visé, et ce sont des
        // documents publics de fabricant : elles partent avec le reste.
        for (const f of await lire(`fournitures?chantier_id=${chListe}&select=fiches_techniques`)) {
          (f.fiches_techniques || []).forEach(ft => releverUrl(ft?.url));
        }
        const consIds = (await lire(`consultations?chantier_id=${chListe}&select=id`)).map(c => c.id);
        if (consIds.length) {
          for (const p of await lire(`photos_fournitures?consultation_id=in.(${consIds.join(',')})&select=url`)) {
            conserver(p.url);
          }
        }
        // Une pièce conservée ne doit pas être effacée parce qu'une autre ligne la référence aussi.
        for (const u of conserves) {
          const m = u.match(/\/object\/(?:public|sign)\/([^/]+)\/([^?]+)/);
          if (m) fichiers.delete(`${m[1]}::${decodeURIComponent(m[2])}`);
        }
        supprimees['fichiers conservés (tiers)'] = conserves.length;

        // `comparatif_selections` se rattache à la consultation et à la fourniture, jamais au
        // chantier : il faut relever ces identifiants avant de supprimer les tables porteuses.
        const fournIds = (await lire(`fournitures?chantier_id=${chListe}&select=id`)).map(f => f.id);

        await del('reponses_fournisseurs', `entrepreneur_id=${liste}`);
        if (consIds.length) await del('comparatif_selections', `consultation_id=in.(${consIds.join(',')})`);
        if (fournIds.length) await del('comparatif_selections', `fourniture_id=in.(${fournIds.join(',')})`);
        await del('comparatif_masques', `chantier_id=${chListe}`);
        // Les lignes de commande se rattachent à leur commande, pas au chantier.
        const cmdIds = (await lire(`commandes?chantier_id=${chListe}&select=id`)).map(c => c.id);
        if (cmdIds.length) await del('commande_lignes', `commande_id=in.(${cmdIds.join(',')})`);
        await del('commandes', `chantier_id=${chListe}`);
        // Les photos étaient relevées pour leurs fichiers, mais leurs lignes restaient en base.
        if (consIds.length) await del('photos_fournitures', `consultation_id=in.(${consIds.join(',')})`);
        await del('daf', `chantier_id=${chListe}`);
        await del('documents_viser', `chantier_id=${chListe}`);
        await del('fournitures', `chantier_id=${chListe}`);
        await del('consultations', `chantier_id=${chListe}`);
        await del('chantiers', `id=${chListe}`);
      }
      await del('fournisseurs', `entrepreneur_id=${liste}`);
      await del('notifications', `user_id=${liste}`);
    }

    // Suppression des fichiers relevés, regroupés par bucket. La clé de service contourne le RLS,
    // y compris la politique qui rend les visas inaltérables pour les comptes utilisateurs.
    const parBucket = {};
    for (const entree of fichiers) {
      const [bucket, chemin] = entree.split('::');
      (parBucket[bucket] ||= []).push(chemin);
    }
    let fichiersSupprimes = 0;
    for (const [bucket, chemins] of Object.entries(parBucket)) {
      // L'API accepte une liste ; on la découpe pour éviter des requêtes démesurées.
      for (let i = 0; i < chemins.length; i += 100) {
        const lot = chemins.slice(i, i + 100);
        const r = await fetch(`${SUPABASE_URL}/storage/v1/object/${bucket}`, {
          method: 'DELETE', headers, body: JSON.stringify({ prefixes: lot }),
        });
        if (r.ok) fichiersSupprimes += lot.length;
        else console.error(`purge storage ${bucket}:`, await r.text());
      }
    }
    if (fichiersSupprimes) supprimees.fichiers = fichiersSupprimes;

    // Suppression des comptes. Elle vient en dernier : les données métier y font référence, et
    // passé le délai de conservation ces données personnelles n'ont plus de finalité (RGPD).
    // Le référent est détaché au préalable, la fiche de structure étant conservée pour la
    // comptabilité : elle ne doit pas pointer vers un compte qui n'existe plus.
    if (userIds.length) {
      await fetch(`${SUPABASE_URL}/rest/v1/structures?id=eq.${structureId}`, {
        method: 'PATCH', headers: { ...headers, 'Prefer': 'return=minimal' },
        body: JSON.stringify({ referent_id: null }),
      });

      const tableCompte = struct.type === 'fournisseur' ? 'compte_fournisseur'
                        : struct.type === 'moe' ? 'compte_moe' : 'compte_entrepreneur';
      let comptesSupprimes = 0;
      for (const uid of userIds) {
        await fetch(`${SUPABASE_URL}/rest/v1/${tableCompte}?id=eq.${uid}`, { method: 'DELETE', headers });
        await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${uid}`, { method: 'DELETE', headers });
        await fetch(`${SUPABASE_URL}/rest/v1/structure_membres?user_id=eq.${uid}`, { method: 'DELETE', headers });
        const rAuth = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${uid}`, { method: 'DELETE', headers });
        if (rAuth.ok) comptesSupprimes++;
        else console.error('purge compte auth', uid, await rAuth.text());
      }
      if (comptesSupprimes) supprimees.comptes = comptesSupprimes;
    }

    await fetch(`${SUPABASE_URL}/rest/v1/structures?id=eq.${structureId}`, {
      method: 'PATCH', headers: { ...headers, 'Prefer': 'return=minimal' },
      body: JSON.stringify({ donnees_supprimees_le: new Date().toISOString() }),
    });

    await notifyAdmin(env, {
      categorie: 'resiliation',
      message: `Données supprimées — ${struct.nom} (${Object.entries(supprimees).map(([t, n]) => `${t}: ${n}`).join(', ') || 'aucune donnée'})`,
      structureId,
    });

    return json({ ok: true, supprimees });
  } catch (e) {
    console.error('purge structure:', e.message);
    return json({ error: 'Suppression interrompue : ' + e.message }, 500);
  }
}

async function handleDeleteUser(request, env) {
  const cors = { 'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '*' };
  const { userId, type } = await request.json();
  if (!userId) return new Response(JSON.stringify({ error: 'userId manquant' }), { status: 400, headers: { 'Content-Type': 'application/json', ...cors } });

  // Authentification + autorisation : admin, l'utilisateur lui-même, ou le référent de la structure du membre visé
  const caller = await getAuthUser(request, env);
  if (!caller?.id) {
    return new Response(JSON.stringify({ error: 'Non authentifié' }), { status: 401, headers: { 'Content-Type': 'application/json', ...cors } });
  }
  const headers = {
    'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
    'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
  };
  const callerRole = await getCallerRole(env, caller.id);
  let authorized = callerRole === 'admin' || caller.id === userId;
  if (!authorized) {
    const targetMemRes = await fetch(`${SUPABASE_URL}/rest/v1/structure_membres?user_id=eq.${userId}&select=structure_id`, { headers });
    const [targetMem] = await targetMemRes.json();
    if (targetMem?.structure_id) {
      const callerMemRes = await fetch(`${SUPABASE_URL}/rest/v1/structure_membres?user_id=eq.${caller.id}&structure_id=eq.${targetMem.structure_id}&role=eq.referent&select=user_id`, { headers });
      const [callerMem] = await callerMemRes.json();
      authorized = !!callerMem;
    }
  }
  if (!authorized) {
    return new Response(JSON.stringify({ error: 'Non autorisé' }), { status: 403, headers: { 'Content-Type': 'application/json', ...cors } });
  }

  // Supprimer dans la table métier selon le type
  const table = type === 'entrepreneur' ? 'compte_entrepreneur' : type === 'fournisseur' ? 'compte_fournisseur' : 'compte_moe';
  await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${userId}`, { method: 'DELETE', headers });
  await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`, { method: 'DELETE', headers });
  await fetch(`${SUPABASE_URL}/rest/v1/structure_membres?user_id=eq.${userId}`, { method: 'DELETE', headers });

  // Supprimer l'utilisateur auth (Admin API)
  const r = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, { method: 'DELETE', headers });
  if (!r.ok) {
    const err = await r.text();
    return new Response(JSON.stringify({ error: `Auth delete failed: ${err}` }), { status: 500, headers: { 'Content-Type': 'application/json', ...cors } });
  }

  return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json', ...cors } });
}

// Création de compte pour un collègue invité via team_invitations (structure déjà abonnée,
// pas de choix de plan) : tout se fait en une requête serveur (compte + rattachement à la
// structure + invitation marquée acceptée), pour éviter de perdre le contexte de l'invitation
// à travers la chaîne de redirections (email → définir mot de passe → portail).
async function handleRegisterTeamMember(request, env) {
  const cors = { 'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '*' };
  const { prenom, nom, token } = await request.json();
  if (!prenom || !nom || !token) {
    return new Response(JSON.stringify({ error: 'Champs manquants' }), { status: 400, headers: { 'Content-Type': 'application/json', ...cors } });
  }
  const headers = {
    'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
    'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
  };
  try {
    const invRes = await fetch(`${SUPABASE_URL}/rest/v1/team_invitations?token=eq.${encodeURIComponent(token)}&select=id,structure_id,email_invite,statut`, { headers });
    const [inv] = await invRes.json();
    if (!inv) return new Response(JSON.stringify({ error: 'Invitation introuvable' }), { status: 404, headers: { 'Content-Type': 'application/json', ...cors } });
    if (inv.statut !== 'pending') return new Response(JSON.stringify({ error: 'Invitation déjà utilisée' }), { status: 400, headers: { 'Content-Type': 'application/json', ...cors } });

    const structRes = await fetch(`${SUPABASE_URL}/rest/v1/structures?id=eq.${inv.structure_id}&select=type,nom`, { headers });
    const [struct] = await structRes.json();
    const portailMap = { entrepreneur: 'entreprise', fournisseur: 'fournisseur', moe: 'moe' };
    const portail = portailMap[struct?.type] || struct?.type || 'entreprise';

    const { userId, setPasswordLink } = await createSupabaseUser(env, { email: inv.email_invite, prenom, nom, societe: struct?.nom, portail });
    if (!userId) throw new Error('Création du compte : identifiant utilisateur manquant');

    const membreRes = await fetch(`${SUPABASE_URL}/rest/v1/structure_membres`, {
      method: 'POST', headers: { ...headers, 'Prefer': 'return=minimal' },
      body: JSON.stringify({ user_id: userId, structure_id: inv.structure_id, role: 'membre' }),
    });
    if (!membreRes.ok) throw new Error(`Rattachement à l'équipe : ${await membreRes.text()}`);

    const profilRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`, {
      method: 'PATCH', headers: { ...headers, 'Prefer': 'return=minimal' },
      body: JSON.stringify({ structure_id: inv.structure_id }),
    });
    if (!profilRes.ok) throw new Error(`Mise à jour du profil : ${await profilRes.text()}`);

    // On ne marque l'invitation acceptée qu'une fois tout le reste confirmé réussi.
    const invUpdRes = await fetch(`${SUPABASE_URL}/rest/v1/team_invitations?id=eq.${inv.id}`, {
      method: 'PATCH', headers: { ...headers, 'Prefer': 'return=minimal' },
      body: JSON.stringify({ statut: 'accepted' }),
    });
    if (!invUpdRes.ok) throw new Error(`Mise à jour de l'invitation : ${await invUpdRes.text()}`);

    if (setPasswordLink) {
      const portailLabel = portail === 'fournisseur' ? 'Fournisseur' : portail === 'moe' ? 'Maître d\'œuvre' : 'Entreprise';
      const siteUrl = (env.SITE_URL || 'https://pivotlaracine.com').replace(/\/$/, '');
      await sendResendEmail(env, {
        to: inv.email_invite,
        subject: 'Bienvenue sur Pivot La Racine — définissez votre mot de passe',
        html: teamInviteWelcomeEmailHtml({
          prenom, structureNom: struct?.nom, portailLabel,
          actionLink: setPasswordLink,
          permanentLink: `${siteUrl}/${PORTAIL_URL[portail === 'entreprise' ? 'entrepreneur' : portail]}`,
        }),
      });
    }

    return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json', ...cors } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json', ...cors } });
  }
}

async function handleRegisterFree(request, env) {
  const cors = { 'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '*' };
  const { prenom, nom, societe, email, portail, plan, inviteToken } = await request.json();

  if (!email || !prenom || !nom) {
    return new Response(JSON.stringify({ error: 'Champs manquants' }), { status: 400, headers: { 'Content-Type': 'application/json', ...cors } });
  }

  try {
    const { userId, setPasswordLink } = await createSupabaseUser(env, { email, prenom, nom, societe, portail, plan });

    // Lier les invitations en attente sur cet email au nouveau compte
    if (userId) {
      const headers = {
        'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      };
      await fetch(`${SUPABASE_URL}/rest/v1/invitations?email_fournisseur=eq.${encodeURIComponent(email)}&statut=eq.pending`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ fournisseur_id: userId, auth_fournisseur_id: userId }),
      });
    }

    // Envoyer notre propre email de bienvenue avec le lien pour définir le mot de passe
    if (setPasswordLink) {
      const portailLabel = portail === 'fournisseur' ? 'Fournisseur' : portail === 'moe' ? 'Maître d\'œuvre' : 'Entreprise';
      const html = `
        <div style="font-family:'Inter',Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#1C3A2A;">
          <div style="background:#1C3A2A;padding:32px 40px 24px;">
            <span style="font-family:Georgia,serif;font-size:28px;font-weight:900;color:#F5F0E8;">Pivot</span><span style="font-family:Georgia,serif;font-size:28px;font-weight:900;color:#B87333;">.</span><span style="font-family:Georgia,serif;font-size:16px;font-style:italic;color:rgba(245,240,232,0.55);margin-left:6px;">la racine</span>
          </div>
          <div style="padding:40px;background:#F5F0E8;">
            <p style="font-size:15px;margin:0 0 16px;">Bonjour ${prenom},</p>
            <p style="font-size:15px;margin:0 0 16px;">Votre compte <strong>Portail ${portailLabel}</strong> a bien été créé.</p>
            <p style="font-size:14px;color:#6B7280;margin:0 0 24px;">Cliquez ci-dessous pour définir votre mot de passe et accéder à votre espace.</p>
            <a href="${setPasswordLink}" style="display:inline-block;background:#1C3A2A;color:#F5F0E8;text-decoration:none;padding:14px 28px;border-radius:8px;font-size:15px;font-weight:500;">Définir mon mot de passe →</a>
            <p style="font-size:12px;color:#9CA3AF;margin:32px 0 0;">Ce lien expire dans 24h.</p>
          </div>
        </div>`;
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: env.RESEND_FROM, to: [email], subject: 'Bienvenue sur Pivot La Racine — définissez votre mot de passe', html }),
      });
    }

    return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json', ...cors } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json', ...cors } });
  }
}

async function handleStripeWebhook(request, env) {
  const { ok, body } = await verifyStripeWebhook(request, env);
  if (!ok) return new Response('Signature invalide', { status: 400 });

  const event = JSON.parse(body);
  const serviceHeaders = {
    'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
    'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
  };

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const { prenom, nom, societe, email, portail, plan, licences } = session.metadata || {};
    if (email) {
      try {
        const nbLicences = parseInt(licences) || 1;
        const { userId, setPasswordLink } = await createSupabaseUser(env, {
          email, prenom: prenom || '', nom: nom || '', societe: societe || '',
          portail: portail || 'entreprise', plan, licences: nbLicences,
        });

        // Crée la structure de facturation (référent + licences + lien vers l'abonnement Stripe),
        // jusqu'ici faite manuellement par l'admin faute de lien Stripe ↔ structure.
        if (userId) {
          try {
            const structRes = await fetch(`${SUPABASE_URL}/rest/v1/structures`, {
              method: 'POST',
              headers: { ...serviceHeaders, 'Prefer': 'return=representation' },
              body: JSON.stringify({
                nom: societe || `${prenom || ''} ${nom || ''}`.trim() || email,
                // structures.type n'accepte que 'entrepreneur' | 'fournisseur' | 'moe', alors que le
                // portail entreprise se nomme 'entreprise' partout ailleurs : sans cette conversion
                // la contrainte CHECK rejetait l'insertion et aucune structure n'était créée.
                type: portail === 'entreprise' ? 'entrepreneur' : (portail || 'entrepreneur'),
                referent_id: userId,
                nb_licences_max: nbLicences,
                statut_abonnement: 'actif',
                mode_paiement: 'stripe',
                stripe_customer_id: session.customer || null,
                stripe_subscription_id: session.subscription || null,
              }),
            });
            if (!structRes.ok) throw new Error(await structRes.text());
            const [struct] = await structRes.json();
            if (!struct?.id) throw new Error('structure créée sans identifiant renvoyé');
            {
              await fetch(`${SUPABASE_URL}/rest/v1/structure_membres`, {
                method: 'POST', headers: { ...serviceHeaders, 'Prefer': 'return=minimal' },
                body: JSON.stringify({ structure_id: struct.id, user_id: userId, role: 'referent' }),
              });
              await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`, {
                method: 'PATCH', headers: { ...serviceHeaders, 'Prefer': 'return=minimal' },
                body: JSON.stringify({ structure_id: struct.id }),
              });
            }
          } catch (e) {
            // Un paiement encaissé sans structure = pas de référent, pas de licences et pas de lien
            // vers l'abonnement Stripe (donc résiliation indétectable). Ça doit alerter, pas rester
            // dans les logs : c'est ce silence qui avait masqué un type de structure invalide.
            console.error('création structure Stripe error:', e.message);
            await notifyAdmin(env, {
              categorie: 'inscription',
              message: `⚠️ Paiement encaissé mais structure non créée pour ${email} — ${e.message}`,
            }).catch(() => {});
          }
        }

        if (setPasswordLink) {
          const portailLabel = portail === 'fournisseur' ? 'Fournisseur' : portail === 'moe' ? 'Maître d\'œuvre' : 'Entreprise';
          const html = `
            <div style="font-family:'Inter',Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#1C3A2A;">
              <div style="background:#1C3A2A;padding:32px 40px 24px;">
                <span style="font-family:Georgia,serif;font-size:28px;font-weight:900;color:#F5F0E8;">Pivot</span><span style="font-family:Georgia,serif;font-size:28px;font-weight:900;color:#B87333;">.</span><span style="font-family:Georgia,serif;font-size:16px;font-style:italic;color:rgba(245,240,232,0.55);margin-left:6px;">la racine</span>
              </div>
              <div style="padding:40px;background:#F5F0E8;">
                <p style="font-size:15px;margin:0 0 16px;">Bonjour ${prenom || ''},</p>
                <p style="font-size:15px;margin:0 0 16px;">Votre abonnement <strong>Portail ${portailLabel}</strong> a été activé. Définissez votre mot de passe pour accéder à votre espace.</p>
                <a href="${setPasswordLink}" style="display:inline-block;background:#1C3A2A;color:#F5F0E8;text-decoration:none;padding:14px 28px;border-radius:8px;font-size:15px;font-weight:500;">Définir mon mot de passe →</a>
                <p style="font-size:12px;color:#9CA3AF;margin:32px 0 0;">Ce lien expire dans 24h.</p>
              </div>
            </div>`;
          await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ from: env.RESEND_FROM, to: [email], subject: 'Votre compte Pivot La Racine est actif', html }),
          });
        }
      } catch (e) {
        console.error('createSupabaseUser error:', e.message);
      }
    }
  }

  // Résiliation : l'abonnement Stripe a été annulé (immédiatement, ou en fin de période selon le
  // réglage du client). On retrouve la structure via le stripe_subscription_id sauvegardé au paiement.
  // Résiliation programmée : le client a annulé, mais l'abonnement court jusqu'à la fin de la
  // période payée. C'est le seul moment où l'on connaît la date de fin AVANT qu'elle arrive, donc
  // le bon moment pour prévenir. On ne réagit qu'à la bascule de cancel_at_period_end vers true,
  // sinon chaque mise à jour d'abonnement renverrait l'email.
  if (event.type === 'customer.subscription.updated') {
    const sub = event.data.object;
    const prev = event.data.previous_attributes || {};
    // Deux formes selon la version d'API : historiquement cancel_at_period_end passait à true ;
    // depuis 2026-05-27 c'est cancel_at qui reçoit la date de fin, cancel_at_period_end restant
    // à false. On détecte donc l'apparition d'une date d'annulation, pas un booléen.
    // Se limiter à previous_attributes évite de renvoyer l'email à chaque mise à jour ultérieure
    // (Stripe émet un second événement juste après, pour le motif d'annulation saisi par le client).
    const vientDEtreAnnule =
      ('cancel_at' in prev && !prev.cancel_at && !!sub.cancel_at) ||
      ('cancel_at_period_end' in prev && prev.cancel_at_period_end === false && sub.cancel_at_period_end === true);
    if (vientDEtreAnnule) {
      try {
        const r = await fetch(`${SUPABASE_URL}/rest/v1/structures?stripe_subscription_id=eq.${sub.id}&select=id,nom,type,referent_id`, { headers: serviceHeaders });
        const [struct] = await r.json();
        if (struct) {
          await envoyerEmailResiliation(env, {
            structure: struct,
            finTs: sub.cancel_at || sub.current_period_end,
            future: true,
            headers: serviceHeaders,
          });
          await notifyAdmin(env, { categorie: 'resiliation', message: `Résiliation demandée — ${struct.nom}`, structureId: struct.id });
        } else {
          console.warn('subscription.updated: structure introuvable pour', sub.id);
        }
      } catch (e) {
        console.error('subscription.updated error:', e.message);
      }
    }
  }

  if (event.type === 'customer.subscription.deleted') {
    const sub = event.data.object;
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/structures?stripe_subscription_id=eq.${sub.id}&select=id,nom,type,referent_id`, { headers: serviceHeaders });
      const [struct] = await r.json();
      if (struct) {
        await fetch(`${SUPABASE_URL}/rest/v1/structures?id=eq.${struct.id}`, {
          method: 'PATCH', headers: { ...serviceHeaders, 'Prefer': 'return=minimal' },
          // resilie_le sert de point de départ aux délais de restriction puis de suppression.
          body: JSON.stringify({ statut_abonnement: 'resilie', resilie_le: new Date().toISOString() }),
        });
        await envoyerEmailResiliation(env, {
          structure: struct,
          // current_period_end a migré vers les lignes d'abonnement dans les versions récentes :
          // on se rabat sur la date du jour plutôt que d'envoyer un email sans date d'effet.
          finTs: sub.ended_at || sub.cancel_at || sub.current_period_end || Math.floor(Date.now() / 1000),
          future: false,
          headers: serviceHeaders,
        });
        await notifyAdmin(env, { categorie: 'resiliation', message: `Résiliation d'abonnement — ${struct.nom}`, structureId: struct.id });
      } else {
        console.warn('subscription.deleted: structure introuvable pour', sub.id);
      }
    } catch (e) {
      console.error('subscription.deleted error:', e.message);
    }
  }

  return new Response('ok', { status: 200 });
}

// ============================================================
// ROUTER
// ============================================================
// ============================================================
// RESEND EMAIL
// ============================================================
// ============================================================
// NOTIFY EVENT — envoi immédiat d'un email si préférence "each"
// ============================================================
const PORTAIL_TABLE = { entrepreneur: 'compte_entrepreneur', fournisseur: 'compte_fournisseur', moe: 'compte_moe', photos: 'collaborateurs' };
const PORTAIL_URL   = { entrepreneur: 'pivot-entrepreneur.html', fournisseur: 'pivot-fournisseur.html', moe: 'pivot-moe.html', photos: 'pivot-app-photos.html' };
// Les collaborateurs (table 'collaborateurs') sont identifiés par leur auth_user_id, pas par leur id de ligne, et n'ont pas de colonne notif_preference
const PORTAIL_ID_COL = { photos: 'auth_user_id' };

function escHtml(str) {
  return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function notifEmailHtml({ title, message, link, portail }) {
  const safeLink = link && /^https?:\/\//.test(link) ? link : null;
  return `
    <div style="font-family:'Inter',Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#1C3A2A;">
      <div style="background:#1C3A2A;padding:32px 40px 24px;">
        <span style="font-family:Georgia,serif;font-size:28px;font-weight:900;color:#F5F0E8;">Pivot</span><span style="font-family:Georgia,serif;font-size:28px;font-weight:900;color:#B87333;">.</span><span style="font-family:Georgia,serif;font-size:16px;font-style:italic;color:rgba(245,240,232,0.55);margin-left:6px;">la racine</span>
      </div>
      <div style="padding:40px;background:#F5F0E8;">
        <p style="font-size:15px;margin:0 0 16px;font-weight:600;">${escHtml(title)}</p>
        <p style="font-size:14px;color:#374151;margin:0 0 24px;line-height:1.6;">${message}</p>
        ${safeLink ? `<a href="${escHtml(safeLink)}" style="display:inline-block;background:#1C3A2A;color:#F5F0E8;text-decoration:none;padding:14px 28px;border-radius:8px;font-size:15px;font-weight:500;">Voir sur Pivot →</a>` : ''}
        <p style="font-size:12px;color:#9CA3AF;margin:32px 0 0;">Vous recevez cet email car vos préférences de notification sont réglées sur "Immédiat". Vous pouvez les modifier dans votre espace Pivot, section "Mon compte".</p>
      </div>
    </div>`;
}

// Délai laissé au client, après la fin de son abonnement, pour récupérer ses dossiers.
const RESILIATION_JOURS_TELECHARGEMENT = 30;

function _dateFr(ts) {
  return new Date(ts * 1000).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

// Prévient le référent de la structure que son abonnement se termine (ou s'est terminé), en lui
// indiquant jusqu'à quand ses dossiers restent téléchargeables.
// `finTs` = timestamp Stripe (secondes) de fin d'abonnement ; `future` = l'échéance est à venir.
async function envoyerEmailResiliation(env, { structure, finTs, future, headers }) {
  if (!finTs) { console.warn('résiliation: pas de date de fin, email non envoyé'); return; }
  try {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?id=eq.${structure.referent_id}&select=email`,
      { headers }
    );
    const [referent] = await r.json();
    if (!referent?.email) { console.warn('résiliation: email du référent introuvable', structure.id); return; }

    const finMs = finTs * 1000;
    const limiteTs = Math.floor((finMs + RESILIATION_JOURS_TELECHARGEMENT * 86400000) / 1000);
    const portail = PORTAIL_URL[structure.type] || PORTAIL_URL.entrepreneur;

    await sendResendEmail(env, {
      to: referent.email,
      subject: future ? 'Votre abonnement Pivot prendra fin prochainement' : 'Votre abonnement Pivot a pris fin',
      html: resiliationEmailHtml({
        structureNom: structure.nom || 'votre structure',
        dateEffet: _dateFr(finTs),
        dateLimite: _dateFr(limiteTs),
        future,
        lien: `${(env.SITE_URL || 'https://pivotlaracine.com').replace(/\/$/, '')}/${portail}`,
      }),
    });
  } catch (e) {
    console.error('envoyerEmailResiliation:', e.message);
  }
}

// Email de résiliation. `dateEffet` = date de fin d'abonnement, `dateLimite` = fin du délai pendant
// lequel les dossiers restent téléchargeables. `future` distingue l'annonce (résiliation demandée,
// effet à venir) de la confirmation (abonnement déjà terminé).
function resiliationEmailHtml({ structureNom, dateEffet, dateLimite, future, lien }) {
  const titre = future
    ? `Votre abonnement Pivot prendra fin le ${dateEffet}`
    : `Votre abonnement Pivot a pris fin le ${dateEffet}`;
  const intro = future
    ? `Nous confirmons la résiliation de l'abonnement de <strong>${escHtml(structureNom)}</strong>. Vous conservez l'accès complet à Pivot jusqu'au <strong>${escHtml(dateEffet)}</strong>.`
    : `L'abonnement de <strong>${escHtml(structureNom)}</strong> a pris fin le <strong>${escHtml(dateEffet)}</strong>.`;
  return `
    <div style="font-family:'Inter',Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#1C3A2A;">
      <div style="background:#1C3A2A;padding:32px 40px 24px;">
        <span style="font-family:Georgia,serif;font-size:28px;font-weight:900;color:#F5F0E8;">Pivot</span><span style="font-family:Georgia,serif;font-size:28px;font-weight:900;color:#B87333;">.</span><span style="font-family:Georgia,serif;font-size:16px;font-style:italic;color:rgba(245,240,232,0.55);margin-left:6px;">la racine</span>
      </div>
      <div style="padding:40px;background:#F5F0E8;">
        <p style="font-size:17px;margin:0 0 20px;font-weight:600;">${escHtml(titre)}</p>
        <p style="font-size:14px;color:#374151;margin:0 0 20px;line-height:1.6;">${intro}</p>
        <div style="background:#FFFFFF;border-left:3px solid #B87333;padding:16px 20px;margin:0 0 24px;">
          <p style="font-size:14px;color:#374151;margin:0;line-height:1.6;">
            Vos données restent accessibles en téléchargement jusqu'au <strong>${escHtml(dateLimite)}</strong>.
            Nous vous invitons à récupérer d'ici là les dossiers de vos chantiers : consultations,
            devis fournisseurs, commandes et documents.
          </p>
        </div>
        ${lien ? `<a href="${escHtml(lien)}" style="display:inline-block;background:#1C3A2A;color:#F5F0E8;text-decoration:none;padding:14px 28px;border-radius:8px;font-size:15px;font-weight:500;">Accéder à mes dossiers →</a>` : ''}
        <p style="font-size:13px;color:#6B7280;margin:28px 0 0;line-height:1.6;">
          Vous changez d'avis ? Vous pouvez souscrire à nouveau à tout moment depuis votre espace.
          Pour toute question, écrivez-nous à <a href="mailto:contact@pivotlaracine.com" style="color:#1C3A2A;">contact@pivotlaracine.com</a>.
        </p>
      </div>
    </div>`;
}

function teamInviteWelcomeEmailHtml({ prenom, structureNom, portailLabel, actionLink, permanentLink }) {
  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F5F0E8;font-family:'Inter',Helvetica,Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F0E8;padding:40px 16px">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px">

        <!-- HEADER -->
        <tr><td style="background:#1C3A2A;border-radius:12px 12px 0 0;padding:32px 40px 28px">
          <table cellpadding="0" cellspacing="0"><tr>
            <td style="font-family:Georgia,'Playfair Display','Times New Roman',serif;font-size:26px;font-weight:900;color:#F5F0E8;letter-spacing:-0.02em;line-height:1">Pivot</td>
            <td style="font-family:Georgia,'Playfair Display','Times New Roman',serif;font-size:26px;font-weight:900;color:#B87333;letter-spacing:-0.02em;line-height:1;padding-right:6px">.</td>
            <td style="font-family:Georgia,'Playfair Display','Times New Roman',serif;font-size:13px;font-weight:400;color:rgba(245,240,232,0.38);font-style:italic;vertical-align:bottom;padding-bottom:3px">la racine</td>
          </tr></table>
          <div style="margin-top:20px">
            <div style="display:inline-block;background:rgba(184,115,51,0.15);border:1px solid rgba(184,115,51,0.3);color:#B87333;font-size:10px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;padding:4px 12px;border-radius:20px">
              Invitation d'équipe
            </div>
          </div>
          <h1 style="margin:14px 0 0;font-size:24px;font-weight:700;color:#F5F0E8;line-height:1.2;font-family:Georgia,serif">
            Bienvenue sur Pivot${portailLabel ? `<br>Portail ${escHtml(portailLabel)}` : ''}
          </h1>
        </td></tr>

        <!-- BODY -->
        <tr><td style="background:#FAFAF7;padding:32px 40px">
          <p style="margin:0 0 8px;font-size:15px;color:#1C3A2A;font-weight:600">Bonjour ${escHtml(prenom)},</p>
          <p style="margin:0 0 28px;font-size:14px;color:#6B7280;line-height:1.7">
            Votre compte a bien été créé et vous avez rejoint l'équipe${structureNom ? ` <strong style="color:#1C3A2A">${escHtml(structureNom)}</strong>` : ''} sur Pivot La Racine.
            Cliquez ci-dessous pour définir votre mot de passe et accéder à votre espace.
          </p>

          <table width="100%" cellpadding="0" cellspacing="0">
            <tr><td align="center" style="padding-bottom:20px">
              <a href="${actionLink}"
                style="display:inline-block;background:#1C3A2A;color:#F5F0E8;text-decoration:none;font-size:15px;font-weight:600;padding:14px 32px;border-radius:8px;letter-spacing:0.01em">
                Définir mon mot de passe →
              </a>
            </td></tr>
          </table>

          ${permanentLink ? `
          <div style="background:#F5F0E8;border-radius:8px;padding:16px 20px;text-align:center">
            <p style="margin:0 0 8px;font-size:12px;font-weight:600;color:#1C3A2A;letter-spacing:0.05em;text-transform:uppercase">Votre lien de connexion permanent</p>
            <a href="${permanentLink}" style="font-size:14px;color:#B87333;font-weight:600;text-decoration:none;word-break:break-all">${permanentLink}</a>
          </div>` : ''}
        </td></tr>

        <!-- FOOTER -->
        <tr><td style="background:#1C3A2A;border-radius:0 0 12px 12px;padding:20px 40px;text-align:center">
          <p style="margin:0;font-size:11px;color:rgba(245,240,232,0.4);letter-spacing:0.04em">
            PIVOT LA RACINE · pivotlaracine.com
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

async function handleNotifyEvent(request, env) {
  const cors = { 'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '*' };
  const { user_id, portail, title, message } = await request.json();

  if (!user_id || !portail || !message) {
    return new Response(JSON.stringify({ error: 'Champs manquants' }), { status: 400, headers: { 'Content-Type': 'application/json', ...cors } });
  }

  const table = PORTAIL_TABLE[portail];
  if (!table) return new Response(JSON.stringify({ error: 'Portail invalide' }), { status: 400, headers: { 'Content-Type': 'application/json', ...cors } });

  const headers = {
    'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
    'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
  };

  const idCol = PORTAIL_ID_COL[portail] || 'id';
  const selectCols = portail === 'photos' ? 'email' : 'email,notif_preference';
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=${selectCols}&${idCol}=eq.${user_id}`, { headers });
  const [compte] = await r.json();
  if (!compte?.email) return new Response(JSON.stringify({ success: true, skipped: 'no-account' }), { headers: { 'Content-Type': 'application/json', ...cors } });

  // Seul "each" déclenche un envoi immédiat — daily/weekly sont traités par le cron, none = silence
  // (les collaborateurs n'ont pas de préférence : ils reçoivent toujours l'email)
  if ((compte.notif_preference || 'each') !== 'each') {
    return new Response(JSON.stringify({ success: true, skipped: compte.notif_preference }), { headers: { 'Content-Type': 'application/json', ...cors } });
  }

  await sendResendEmail(env, {
    to: compte.email,
    subject: title || 'Nouvelle notification Pivot',
    html: notifEmailHtml({ title: title || 'Nouvelle notification', message: escHtml(message), link: `${env.SITE_URL || 'https://pivotlaracine.com'}/${PORTAIL_URL[portail]}` }),
  });

  return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json', ...cors } });
}

async function sendResendEmail(env, { to, subject, html }) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: env.RESEND_FROM || 'Pivot La Racine <noreply@pivotlaracine.com>',
      to: [to],
      subject,
      html
    })
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Resend error ${res.status}: ${err}`);
  }
  return res.json();
}

// ============================================================
// NOTIFICATIONS ADMIN — réglages par catégorie (chat / inscription / résiliation)
// ============================================================
const ADMIN_NOTIF_LABEL = { chat: 'Nouvelle conversation chat', inscription: 'Nouvelle inscription', resiliation: 'Résiliation' };

async function getAdminNotifSetting(env, categorie) {
  const headers = { 'apikey': env.SUPABASE_SERVICE_ROLE_KEY, 'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` };
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/admin_notif_settings?categorie=eq.${categorie}&select=actif,frequence`, { headers });
    const [row] = await r.json();
    return row || { actif: true, frequence: 'each' };
  } catch (_) {
    return { actif: true, frequence: 'each' };
  }
}

// Insère une notification admin (alimente la cloche du portail admin) et envoie un email immédiat
// si la catégorie est active et réglée sur "each" — sinon la notification reste en base pour un
// éventuel récap différé (daily/weekly), sans email immédiat.
async function notifyAdmin(env, { categorie, message, structureId }) {
  const setting = await getAdminNotifSetting(env, categorie);
  if (!setting.actif) return;
  const headers = {
    'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
    'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=minimal',
  };
  await fetch(`${SUPABASE_URL}/rest/v1/notifications_admin`, {
    method: 'POST', headers,
    body: JSON.stringify({ type: categorie, message, structure_id: structureId || null, read: false }),
  });
  if (setting.frequence === 'each') {
    try {
      await sendResendEmail(env, {
        to: env.ADMIN_EMAIL || 'jncoutier@gmail.com',
        subject: `[Pivot Admin] ${ADMIN_NOTIF_LABEL[categorie] || categorie}`,
        html: notifEmailHtml({ title: ADMIN_NOTIF_LABEL[categorie] || categorie, message, link: null }),
      });
    } catch (err) { console.error('notifyAdmin email error', err); }
  }
}

// ============================================================
// WAITLIST — confirmation d'inscription à la liste d'attente
// ============================================================
const WAITLIST_ROLE_LABEL = { entrepreneur: 'Entreprise', fournisseur: 'Fournisseur', moe: 'Maître d\'œuvre' };

function waitlistEmailHtml(prenom, role) {
  const label = WAITLIST_ROLE_LABEL[role] || 'Pivot';
  return `
    <div style="font-family:'Inter',Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;color:#1C3A2A;background:#F5F0E8;">
      <div style="background:#1C3A2A;padding:32px 40px 24px;">
        <span style="font-family:Georgia,serif;font-size:28px;font-weight:900;color:#F5F0E8;">Pivot</span><span style="font-family:Georgia,serif;font-size:28px;font-weight:900;color:#B87333;">.</span><span style="font-family:Georgia,serif;font-size:16px;font-style:italic;color:rgba(245,240,232,0.55);margin-left:6px;">la racine</span>
      </div>
      <div style="padding:40px;background:#F5F0E8;">
        <p style="font-size:15px;margin:0 0 16px;">Bonjour ${escHtml(prenom)},</p>
        <p style="font-size:15px;margin:0 0 16px;">Merci pour votre inscription sur la liste d'attente Pivot la racine, côté <strong>${escHtml(label)}</strong> !</p>
        <p style="font-size:14px;color:#374151;margin:0 0 24px;line-height:1.6;">Pivot ouvre dans quelques semaines. Vous serez parmi les premiers prévenus, avec un onboarding personnalisé pour démarrer sereinement.</p>
        <p style="font-size:12px;color:#9CA3AF;margin:32px 0 0;">Si vous n'êtes pas à l'origine de cette inscription, ignorez cet email.</p>
      </div>
    </div>`;
}

function waitlistAdminEmailHtml(prenom, email, role) {
  const label = WAITLIST_ROLE_LABEL[role] || role || '—';
  return `
    <div style="font-family:'Inter',Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;color:#1C3A2A;background:#F5F0E8;">
      <div style="background:#1C3A2A;padding:32px 40px 24px;">
        <span style="font-family:Georgia,serif;font-size:28px;font-weight:900;color:#F5F0E8;">Pivot</span><span style="font-family:Georgia,serif;font-size:28px;font-weight:900;color:#B87333;">.</span><span style="font-family:Georgia,serif;font-size:16px;font-style:italic;color:rgba(245,240,232,0.55);margin-left:6px;">la racine</span>
      </div>
      <div style="padding:40px;background:#F5F0E8;">
        <p style="font-size:15px;margin:0 0 16px;font-weight:600;">🌱 Nouvelle inscription à la liste d'attente</p>
        <table style="font-size:14px;color:#374151;border-collapse:collapse;margin:0 0 24px;">
          <tr><td style="padding:4px 12px 4px 0;color:#9CA3AF;">Prénom</td><td style="padding:4px 0;font-weight:500;">${escHtml(prenom)}</td></tr>
          <tr><td style="padding:4px 12px 4px 0;color:#9CA3AF;">Email</td><td style="padding:4px 0;font-weight:500;">${escHtml(email)}</td></tr>
          <tr><td style="padding:4px 12px 4px 0;color:#9CA3AF;">Portail</td><td style="padding:4px 0;font-weight:500;">${escHtml(label)}</td></tr>
        </table>
      </div>
    </div>`;
}

// ============================================================
// AIDE — chat IA (landing + portails)
// ============================================================
const HELP_CHAT_SYSTEM = `Tu es l'assistant d'aide de Pivot la racine (pivotlaracine.com), un SaaS pour les paysagistes (entreprises, pépinières/fournisseurs, maîtres d'œuvre) qui centralise consultations fournisseurs, DAF (demande d'agrément fournisseur) et DOE (dossier des ouvrages exécutés), pour éviter la ressaisie entre devis, consultation et commande.

Contexte produit :
- 3 portails métier : Entreprise (paysagiste qui consulte des fournisseurs, génère DAF/DOE), Fournisseur (pépinière/fournisseur qui répond aux consultations, gère son catalogue), Maître d'œuvre / MOE (valide les DAF, suit l'avancement du chantier).
- Fonctionnement type entreprise : import d'un DQE/BPU (PDF, Excel, CSV, ou coller un tableau) → détection automatique des familles de fournitures et parsing des végétaux (type/calibre/conditionnement) → consultation envoyée à plusieurs fournisseurs → comparatif des prix reçus par article → sélection du fournisseur retenu → génération automatique de la DAF (structurée, avec fiches techniques et photos annexées) → validation/visa par le MOE → suivi des commandes → DOE généré en quelques clics en fin de chantier.
- Portail fournisseur : reçoit les consultations, répond avec ses prix (pré-remplissage depuis l'historique), gère un catalogue de végétaux/fournitures, peut assigner des collaborateurs (comptes légers, sans licence payante) pour prendre des photos des végétaux ou répondre à des demandes de renseignement via une petite appli mobile dédiée (Pivot Photos).
- Le service est actuellement en bêta privée (accès sur liste d'attente, ouverture progressive).
- Tarifs : chaque portail a sa propre page de tarifs (/pivot-tarifs-entreprise.html, /pivot-tarifs-fournisseur.html, /pivot-tarifs-moe.html). Le portail Fournisseur a 4 formules à connotation végétale (Stipa gratuit, Myrtus, Cercis, Quercus, du moins cher au plus complet) avec rabais dégressif à partir de 3 licences. Si on te demande un prix précis que tu ne connais pas avec certitude, renvoie vers la page tarifs correspondante plutôt que d'inventer un chiffre.
- Contact humain : pour tout ce que tu ne sais pas traiter, ou une question de compte/facturation spécifique, oriente vers contact@pivotlaracine.com.

Consignes de réponse :
- Réponds en français, ton professionnel mais chaleureux, concis (3-6 phrases sauf si une explication plus longue est nécessaire).
- Ne jamais inventer de fonctionnalité, de prix ou de délai que tu ne connais pas — dans le doute, oriente vers contact@pivotlaracine.com.
- Si la question porte sur un problème de compte précis (bug, données manquantes, facture), ne tente pas de le résoudre toi-même : explique que tu transmets et invite à écrire à contact@pivotlaracine.com avec les détails.
- Ne donne jamais d'information confidentielle ou interne (code, clés API, architecture technique détaillée).`;

async function _persistHelpConversation(env, sessionId, context, messages) {
  if (!sessionId) return { ok: false, error: 'no sessionId' };
  if (!env.SUPABASE_SERVICE_ROLE_KEY) return { ok: false, error: 'no SUPABASE_SERVICE_ROLE_KEY' };
  try {
    const headers = {
      'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates',
    };
    const res = await fetch(`${SUPABASE_URL}/rest/v1/help_conversations?on_conflict=session_id`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ session_id: sessionId, context: context || null, messages, updated_at: new Date().toISOString() }),
    });
    if (!res.ok) {
      const errText = await res.text();
      console.error('persist help conversation failed', res.status, errText);
      return { ok: false, error: `${res.status}: ${errText}` };
    }
    return { ok: true };
  } catch (err) {
    console.error('persist help conversation error', err);
    return { ok: false, error: err.message };
  }
}

async function handleHelpChat(request, env) {
  const cors = { 'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '*' };
  const { messages, context, sessionId } = await request.json();
  if (!Array.isArray(messages) || !messages.length) {
    return new Response(JSON.stringify({ error: 'Messages manquants' }), { status: 400, headers: { 'Content-Type': 'application/json', ...cors } });
  }
  const safeMessages = messages
    .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .slice(-12)
    .map(m => ({ role: m.role, content: m.content.slice(0, 4000) }));
  if (!safeMessages.length) {
    return new Response(JSON.stringify({ error: 'Messages invalides' }), { status: 400, headers: { 'Content-Type': 'application/json', ...cors } });
  }

  const system = HELP_CHAT_SYSTEM + (context ? `\n\nContexte actuel : l'utilisateur écrit depuis ${escHtml(context)}.` : '');

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-5',
        max_tokens: 500,
        system,
        messages: safeMessages,
      }),
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Anthropic ${res.status}: ${errText}`);
    }
    const data = await res.json();
    const reply = (data.content || []).map(b => b.text || '').join('').trim() || 'Désolé, je n\'ai pas pu générer de réponse. Écrivez-nous à contact@pivotlaracine.com.';
    const persistResult = await _persistHelpConversation(env, sessionId, context, [...safeMessages, { role: 'assistant', content: reply }]);
    // Notifie l'admin seulement au premier échange d'une nouvelle conversation (pas à chaque message)
    if (safeMessages.length === 1) {
      const firstMsg = (safeMessages[0]?.content || '').slice(0, 200);
      notifyAdmin(env, { categorie: 'chat', message: `Nouvelle conversation chat${context ? ` (${context})` : ''} : « ${firstMsg} »` }).catch(() => {});
    }
    const debugPayload = request.headers.get('x-debug') === '1' ? { persistResult } : {};
    return new Response(JSON.stringify({ reply, ...debugPayload }), { headers: { 'Content-Type': 'application/json', ...cors } });
  } catch (err) {
    console.error('help-chat error', err);
    return new Response(JSON.stringify({ reply: 'Une erreur est survenue. Écrivez-nous directement à contact@pivotlaracine.com, on vous répond rapidement.' }), { headers: { 'Content-Type': 'application/json', ...cors } });
  }
}

async function handleWaitlistConfirm(request, env) {
  const cors = { 'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '*' };
  const { prenom, email, role } = await request.json();
  if (!prenom || !email) {
    return new Response(JSON.stringify({ error: 'Champs manquants' }), { status: 400, headers: { 'Content-Type': 'application/json', ...cors } });
  }
  try {
    await sendResendEmail(env, {
      to: email,
      subject: 'Bienvenue sur la liste d\'attente Pivot la racine',
      html: waitlistEmailHtml(prenom, role),
    });
  } catch (err) {
    console.error('waitlist email error', err);
  }
  try {
    const setting = await getAdminNotifSetting(env, 'inscription');
    if (setting.actif) {
      const headers = { 'apikey': env.SUPABASE_SERVICE_ROLE_KEY, 'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' };
      await fetch(`${SUPABASE_URL}/rest/v1/notifications_admin`, {
        method: 'POST', headers,
        body: JSON.stringify({ type: 'inscription', message: `Nouvelle inscription waitlist — ${prenom} (${email}, ${role})`, read: false }),
      });
      if (setting.frequence === 'each') {
        await sendResendEmail(env, {
          to: env.ADMIN_EMAIL || 'jncoutier@gmail.com',
          subject: `Nouvelle inscription waitlist — ${prenom}`,
          html: waitlistAdminEmailHtml(prenom, email, role),
        });
      }
    }
  } catch (err) {
    console.error('waitlist admin email error', err);
  }
  return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json', ...cors } });
}

// ============================================================
// CRON — RELANCES & NOTIFICATIONS ADMIN
// ============================================================
// Délais du cycle de vie, comptés depuis la date de résiliation effective.
const JOURS_AVANT_RESTRICTION = 30;  // au-delà : lecture et export seulement
const JOURS_AVANT_SUPPRESSION = 90;  // au-delà : purge des données métier, déclenchée par l'admin

// Applique les échéances post-résiliation. Chaque étape est idempotente : elle ne sélectionne que
// les structures qui n'ont pas encore reçu le traitement, pour survivre à plusieurs exécutions.
async function traiterCycleVieResiliations(env, supabaseUrl, headers) {
  const ilYA = j => new Date(Date.now() - j * 86400000).toISOString();
  const patch = (id, corps) => fetch(`${supabaseUrl}/rest/v1/structures?id=eq.${id}`, {
    method: 'PATCH', headers: { ...headers, 'Prefer': 'return=minimal' }, body: JSON.stringify(corps),
  });
  const emailReferent = async (structure, sujet, titre, message) => {
    if (!structure.referent_id) return;
    try {
      const r = await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${structure.referent_id}&select=email`, { headers });
      const [ref] = await r.json();
      if (!ref?.email) return;
      const siteUrl = (env.SITE_URL || 'https://pivotlaracine.com').replace(/\/$/, '');
      const portail = PORTAIL_URL[structure.type] || PORTAIL_URL.entrepreneur;
      await sendResendEmail(env, {
        to: ref.email, subject: sujet,
        html: notifEmailHtml({ title: titre, message, link: `${siteUrl}/${portail}` }),
      });
    } catch (e) { console.error('cycle de vie — email:', e.message); }
  };

  try {
    // 1. Passage en accès restreint
    const r1 = await fetch(
      `${supabaseUrl}/rest/v1/structures?select=id,nom,type,referent_id&statut_abonnement=eq.resilie`
      + `&acces_restreint=eq.false&resilie_le=lt.${ilYA(JOURS_AVANT_RESTRICTION)}`,
      { headers }
    );
    for (const s of (await r1.json()) || []) {
      await patch(s.id, { acces_restreint: true });
      await emailReferent(s, 'Votre accès Pivot passe en lecture seule',
        'Votre espace passe en lecture seule',
        `Votre abonnement ayant pris fin il y a ${JOURS_AVANT_RESTRICTION} jours, votre espace <strong>${escHtml(s.nom || '')}</strong> `
        + `reste consultable mais n'accepte plus de modification. Vous pouvez toujours télécharger l'intégralité de vos dossiers `
        + `depuis « Mon compte », et ce jusqu'au ${new Date(Date.now() + (JOURS_AVANT_SUPPRESSION - JOURS_AVANT_RESTRICTION) * 86400000).toLocaleDateString('fr-FR')}.`);
      await notifyAdmin(env, { categorie: 'resiliation', message: `Accès restreint — ${s.nom}`, structureId: s.id });
    }

    // 2. Avertissement 7 jours avant l'échéance de suppression
    const r2 = await fetch(
      `${supabaseUrl}/rest/v1/structures?select=id,nom,type,referent_id&statut_abonnement=eq.resilie`
      + `&avert_suppression_envoye=eq.false&donnees_supprimees_le=is.null&resilie_le=lt.${ilYA(JOURS_AVANT_SUPPRESSION - 7)}`,
      { headers }
    );
    for (const s of (await r2.json()) || []) {
      await patch(s.id, { avert_suppression_envoye: true });
      await emailReferent(s, 'Vos données Pivot seront supprimées dans 7 jours',
        'Dernier délai pour récupérer vos dossiers',
        `Les données de <strong>${escHtml(s.nom || '')}</strong> seront supprimées dans <strong>7 jours</strong>. `
        + `Téléchargez dès maintenant l'archive complète de vos chantiers depuis « Mon compte » : `
        + `cette suppression est définitive et nous ne pourrons pas restaurer vos dossiers.`);
    }

    // 3. Échéance atteinte : on signale à l'admin, sans rien supprimer.
    const r3 = await fetch(
      `${supabaseUrl}/rest/v1/structures?select=id,nom&statut_abonnement=eq.resilie`
      + `&donnees_supprimees_le=is.null&resilie_le=lt.${ilYA(JOURS_AVANT_SUPPRESSION)}`,
      { headers }
    );
    const aPurger = (await r3.json()) || [];
    if (aPurger.length) {
      await notifyAdmin(env, {
        categorie: 'resiliation',
        message: `${aPurger.length} structure(s) résiliée(s) depuis plus de ${JOURS_AVANT_SUPPRESSION} jours, en attente de suppression : `
               + aPurger.map(s => s.nom).join(', '),
      });
    }
  } catch (e) {
    console.error('traiterCycleVieResiliations:', e.message);
  }
}

async function handleScheduled(env) {
  const supabaseUrl  = env.SUPABASE_URL || 'https://djegdtlcvyjtrayrodxj.supabase.co';
  const serviceKey   = env.SUPABASE_SERVICE_ROLE_KEY;
  const headers      = { 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}`, 'Content-Type': 'application/json' };

  const today   = new Date();
  const in7days = new Date(today); in7days.setDate(today.getDate() + 7);
  const in7str  = in7days.toISOString().slice(0, 10);
  const todayStr = today.toISOString().slice(0, 10);

  // ── 0. Cycle de vie après résiliation ─────────────────────
  // Trois étapes échelonnées depuis resilie_le : restriction à 30 jours (lecture et export
  // conservés, conformément à ce que promet l'email de résiliation), avertissement à J-7 de
  // l'échéance de suppression, puis signalement à l'admin à 90 jours. La suppression elle-même
  // n'est jamais automatique : elle est irréversible et reste déclenchée à la main.
  await traiterCycleVieResiliations(env, supabaseUrl, headers);

  // ── 0 bis. Purge des journaux d'authentification ──────────
  // La politique de confidentialité annonce six mois de conservation ; Supabase ne purge rien de
  // lui-même. Un engagement de durée qu'aucune tâche n'applique n'est pas un engagement.
  try {
    const r = await fetch(`${supabaseUrl}/rest/v1/rpc/purger_journaux_auth`, { method: 'POST', headers });
    if (!r.ok) throw new Error(await r.text());
    const n = await r.json();
    if (n) console.log(`Journaux d'authentification purgés : ${n} entrées.`);
  } catch (e) {
    console.error('purger_journaux_auth:', e.message);
  }

  // ── 1. Relances J-7 ───────────────────────────────────────
  const relRes = await fetch(
    `${supabaseUrl}/rest/v1/structures?select=id,nom,date_echeance,referent_id&mode_paiement=eq.virement&statut_abonnement=eq.actif&relance_envoyee=eq.false&date_echeance=eq.${in7str}`,
    { headers }
  );
  const relances = await relRes.json();

  for (const struct of (relances || [])) {
    // Récupérer email du référent
    const profRes = await fetch(
      `${supabaseUrl}/rest/v1/profiles?select=id&id=eq.${struct.referent_id}`,
      { headers }
    );
    const [prof] = await profRes.json();
    if (!prof) continue;

    // Récupérer email depuis auth via compte_entrepreneur ou compte_fournisseur
    const ceRes = await fetch(
      `${supabaseUrl}/rest/v1/compte_entrepreneur?select=email&id=eq.${struct.referent_id}`,
      { headers }
    );
    const [ce] = await ceRes.json();
    const cfRes = await fetch(
      `${supabaseUrl}/rest/v1/compte_fournisseur?select=email&id=eq.${struct.referent_id}`,
      { headers }
    );
    const [cf] = await cfRes.json();
    const email = ce?.email || cf?.email;
    if (!email) continue;

    const echeance = new Date(struct.date_echeance).toLocaleDateString('fr-FR');
    await sendResendEmail(env, {
      to: email,
      subject: `Renouvellement de votre abonnement Pivot — ${struct.nom}`,
      html: `
        <div style="font-family:Inter,sans-serif;max-width:520px;margin:0 auto;color:#1a2e3c">
          <h2 style="font-size:1.1rem;margin-bottom:12px">Votre abonnement arrive à échéance</h2>
          <p style="color:#6b7280;font-size:0.9rem;line-height:1.6">
            L'abonnement <strong>${struct.nom}</strong> expire le <strong>${echeance}</strong>.<br>
            Pour assurer la continuité de votre accès à Pivot, merci de procéder au renouvellement.
          </p>
          <a href="mailto:contact@pivotlaracine.com?subject=Renouvellement ${encodeURIComponent(struct.nom)}"
            style="display:inline-block;margin-top:20px;background:#1a2e3c;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-size:0.85rem">
            Confirmer le renouvellement
          </a>
          <p style="margin-top:24px;font-size:0.75rem;color:#9ca3af">
            En cas de non-renouvellement, votre accès sera suspendu à la date d'échéance.<br>
            Pivot La Racine · pivotlaracine.com
          </p>
        </div>`
    });

    // Marquer relance envoyée
    await fetch(`${supabaseUrl}/rest/v1/structures?id=eq.${struct.id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ relance_envoyee: true })
    });
  }

  // ── 2. Notifications admin — échéances dépassées (virement + essai) ──
  const expRes = await fetch(
    `${supabaseUrl}/rest/v1/structures?select=id,nom,date_echeance,statut_abonnement&statut_abonnement=in.(actif,essai)&date_echeance=lt.${todayStr}&or=(mode_paiement.eq.virement,statut_abonnement.eq.essai)`,
    { headers }
  );
  const expires = await expRes.json();

  for (const struct of (expires || [])) {
    // Vérifier qu'une notif n'existe pas déjà pour cette structure
    const existRes = await fetch(
      `${supabaseUrl}/rest/v1/notifications_admin?structure_id=eq.${struct.id}&type=eq.echeance_depassee&read=eq.false&select=id`,
      { headers }
    );
    const existing = await existRes.json();
    if (existing?.length > 0) continue;

    const echeance = new Date(struct.date_echeance).toLocaleDateString('fr-FR');
    const isEssai = struct.statut_abonnement === 'essai';
    await fetch(`${supabaseUrl}/rest/v1/notifications_admin`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        type: 'echeance_depassee',
        message: `${isEssai ? 'Essai' : 'Abonnement'} de "${struct.nom}" expiré le ${echeance} — à statuer.`,
        structure_id: struct.id
      })
    });
  }

  // ── 3. Digests notifications (quotidien & hebdomadaire), groupées par chantier puis par catégorie ──
  const isMonday = today.getDay() === 1;
  const notifRes = await fetch(
    `${supabaseUrl}/rest/v1/notifications?emailed_at=is.null&select=id,user_id,type,message,chantier_id,consultation_id,created_at&order=created_at.asc`,
    { headers }
  );
  const pendingNotifs = await notifRes.json();
  let digestsSent = 0;

  const CATEGORY_LABELS = {
    reponse_fournisseur: '💬 Réponses fournisseurs',
    photo_validee: '📷 Photos reçues',
    visa_moe: '✅ Visas DAF',
    visa_document: '📐 Visas documents',
    nouvelle_consultation: '📤 Nouvelles consultations',
    demande_modification: '🔓 Demandes de modification',
    modification_autorisee: '🔓 Modifications de prix',
    demande_photo: '📷 Demandes de photos',
    consultation_ignoree: '❌ Consultations déclinées',
    invitation_acceptee: '👥 Invitations',
    invitation_chantier_moe: '👥 Invitations',
    reassignation_chantier: '👥 Affectations',
  };

  if (pendingNotifs?.length) {
    const byUser = {};
    for (const n of (pendingNotifs || [])) {
      if (!byUser[n.user_id]) byUser[n.user_id] = [];
      byUser[n.user_id].push(n);
    }

    // Résoudre les chantier_id manquants via consultation_id (certains types ne stockent pas chantier_id directement)
    const missingChantierConsIds = [...new Set(pendingNotifs.filter(n => !n.chantier_id && n.consultation_id).map(n => n.consultation_id))];
    const consToChantier = {};
    if (missingChantierConsIds.length) {
      const consRes = await fetch(`${supabaseUrl}/rest/v1/consultations?id=in.(${missingChantierConsIds.join(',')})&select=id,chantier_id`, { headers });
      const consRows = await consRes.json();
      (consRows || []).forEach(c => { consToChantier[c.id] = c.chantier_id; });
    }
    pendingNotifs.forEach(n => { if (!n.chantier_id && n.consultation_id) n.chantier_id = consToChantier[n.consultation_id] || null; });

    const allChantierIds = [...new Set(pendingNotifs.filter(n => n.chantier_id).map(n => n.chantier_id))];
    const chantierNames = {};
    if (allChantierIds.length) {
      const chRes = await fetch(`${supabaseUrl}/rest/v1/chantiers?id=in.(${allChantierIds.join(',')})&select=id,affaire,ville`, { headers });
      const chRows = await chRes.json();
      (chRows || []).forEach(c => { chantierNames[c.id] = [c.ville, c.affaire].filter(Boolean).join(' — ') || 'Chantier'; });
    }

    const sentIds = [];
    for (const [userId, notifs] of Object.entries(byUser)) {
      let compte = null, portail = null;
      for (const [pType, table] of Object.entries(PORTAIL_TABLE)) {
        const r = await fetch(`${supabaseUrl}/rest/v1/${table}?select=email,notif_preference&id=eq.${userId}`, { headers });
        const [row] = await r.json();
        if (row) { compte = row; portail = pType; break; }
      }
      if (!compte?.email) continue;

      const pref = compte.notif_preference || 'each';
      const shouldSend = pref === 'daily' || (pref === 'weekly' && isMonday);
      if (!shouldSend) continue;

      // Groupe par chantier, puis par catégorie de notification à l'intérieur de chaque chantier
      const byChantier = {};
      notifs.forEach(n => { (byChantier[n.chantier_id || '_autres'] ||= []).push(n); });

      const sections = Object.entries(byChantier).map(([chId, chNotifs]) => {
        const byType = {};
        chNotifs.forEach(n => { (byType[n.type] ||= []).push(n); });
        const catBlocks = Object.entries(byType).map(([type, items]) => {
          const label = CATEGORY_LABELS[type] || '📌 Autres';
          const lis = items.map(n => `<li style="margin-bottom:4px;">${escHtml(n.message)}</li>`).join('');
          return `<p style="font-weight:600;margin:12px 0 4px;">${label} (${items.length})</p><ul style="padding-left:18px;margin:0;">${lis}</ul>`;
        }).join('');
        const chantierTitle = chId === '_autres' ? 'Autres notifications' : (chantierNames[chId] || 'Chantier');
        return `<div style="margin-bottom:20px;padding-bottom:16px;border-bottom:1px solid #e5e7eb;">
          <p style="font-weight:700;font-size:15px;margin:0 0 4px;color:#1C3A2A;">🏗️ ${escHtml(chantierTitle)}</p>
          ${catBlocks}
        </div>`;
      }).join('');

      await sendResendEmail(env, {
        to: compte.email,
        subject: pref === 'daily' ? 'Votre récap quotidien Pivot' : 'Votre récap hebdomadaire Pivot',
        html: notifEmailHtml({
          title: pref === 'daily'
            ? `📋 ${notifs.length} nouvelle${notifs.length>1?'s':''} notification${notifs.length>1?'s':''}`
            : `📋 Récap de la semaine — ${notifs.length} notification${notifs.length>1?'s':''}`,
          message: sections,
          link: `${env.SITE_URL || 'https://pivotlaracine.com'}/${PORTAIL_URL[portail]}`,
        }),
      });
      sentIds.push(...notifs.map(n => n.id));
      digestsSent++;
    }

    if (sentIds.length) {
      await fetch(`${supabaseUrl}/rest/v1/notifications?id=in.(${sentIds.join(',')})`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ emailed_at: new Date().toISOString() }),
      });
    }
  }

  return { relances: relances?.length || 0, expires: expires?.length || 0, digestsSent };
}

// ============================================================
// INVITATION D'ÉQUIPE (team_invitations)
// ============================================================
async function handleSendTeamInvite(request, env) {
  const cors = { 'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '*' };
  const { email, token, portail, nom_referent, nom_structure } = await request.json();
  if (!email || !token || !portail) {
    return new Response(JSON.stringify({ error: 'Champs manquants' }), { status: 400, headers: { 'Content-Type': 'application/json', ...cors } });
  }
  const page = PORTAIL_URL[portail];
  if (!page) return new Response(JSON.stringify({ error: 'Portail invalide' }), { status: 400, headers: { 'Content-Type': 'application/json', ...cors } });

  const siteUrl = (env.SITE_URL || 'https://pivotlaracine.com').replace(/\/$/, '');
  const lien = `${siteUrl}/${page}?team_invite=${token}`;

  try {
    await sendResendEmail(env, {
      to: email,
      subject: `${nom_referent || 'Un collègue'} vous invite à rejoindre son équipe sur Pivot`,
      html: notifEmailHtml({
        title: `👥 Invitation à rejoindre ${nom_structure ? `« ${nom_structure} »` : 'une équipe'}`,
        message: `<strong>${escHtml(nom_referent || 'Un collègue')}</strong> vous invite à rejoindre son équipe sur Pivot. Connectez-vous ou créez un compte pour l'accepter.`,
        link: lien,
      }),
    });
    return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json', ...cors } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json', ...cors } });
  }
}

// ============================================================
// INVITE COLLABORATEUR PHOTOS
// ============================================================
async function handleInviteCollaborateur(request, env) {
  const cors = { 'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '*' };
  const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...cors } });

  const { email, nom, fournisseur_id } = await request.json();
  if (!email || !nom || !fournisseur_id) return json({ error: 'Paramètres manquants' }, 400);

  const adminHeaders = {
    'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
    'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
  };
  const siteUrl = (env.SITE_URL || 'https://pivotlaracine.com').replace(/\/$/, '');

  // Générer un lien d'invitation Supabase (sans email automatique) vers la page de création de mot de passe
  const genResp = await fetch(`${SUPABASE_URL}/auth/v1/admin/generate_link`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      type: 'invite',
      email,
      data: { nom },
      redirect_to: `${siteUrl}/pivot-setup-password.html`,
    }),
  });

  let authUserId = null;
  let actionLink = null;

  if (genResp.ok) {
    const genData = await genResp.json();
    // generate_link peut retourner l'id à la racine ou dans user
    authUserId = genData.user?.id || genData.id;
    actionLink = genData.action_link || genData.properties?.action_link;
  } else {
    const errText = await genResp.text();
    // Si l'utilisateur existe déjà, générer un lien de récupération à la place
    if (errText.includes('already') || errText.includes('registered')) {
      const recResp = await fetch(`${SUPABASE_URL}/auth/v1/admin/generate_link`, {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({
          type: 'recovery',
          email,
          redirect_to: `${siteUrl}/pivot-setup-password.html`,
        }),
      });
      if (recResp.ok) {
        const recData = await recResp.json();
        authUserId = recData.user?.id;
        actionLink = recData.action_link || recData.properties?.action_link;
      } else {
        return json({ error: `Lien: ${await recResp.text()}` }, 500);
      }
    } else {
      return json({ error: `Invitation: ${errText}` }, 500);
    }
  }

  // Fallback : chercher l'utilisateur par email si l'ID n'a pas été retourné
  if (!authUserId) {
    const lookupRes = await fetch(
      `${SUPABASE_URL}/auth/v1/admin/users?email=${encodeURIComponent(email)}&page=1&per_page=1`,
      { headers: adminHeaders }
    );
    if (lookupRes.ok) {
      const lookupData = await lookupRes.json();
      authUserId = lookupData.users?.[0]?.id || lookupData[0]?.id;
    }
  }

  // Créer/mettre à jour l'entrée collaborateurs
  const colResp = await fetch(`${SUPABASE_URL}/rest/v1/collaborateurs`, {
    method: 'POST',
    headers: { ...adminHeaders, 'Prefer': 'resolution=merge-duplicates,return=minimal', 'on_conflict': 'fournisseur_id,email' },
    body: JSON.stringify({ fournisseur_id, nom, email, auth_user_id: authUserId }),
  });
  if (!colResp.ok) {
    const errText = await colResp.text();
    // Si doublon, mettre à jour auth_user_id via PATCH
    if (errText.includes('23505') || errText.includes('duplicate')) {
      const patchResp = await fetch(`${SUPABASE_URL}/rest/v1/collaborateurs?fournisseur_id=eq.${fournisseur_id}&email=eq.${encodeURIComponent(email)}`, {
        method: 'PATCH',
        headers: { ...adminHeaders, 'Prefer': 'return=minimal' },
        body: JSON.stringify({ auth_user_id: authUserId, nom }),
      });
      if (!patchResp.ok) return json({ error: `DB patch: ${await patchResp.text()}` }, 500);
    } else {
      return json({ error: `DB: ${errText}` }, 500);
    }
  }

  // Email Resend en complément de l'email Supabase (optionnel — branding)
  if (env.RESEND_API_KEY) {
    const html = `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F5F0E8;font-family:'Inter',Helvetica,Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F0E8;padding:40px 16px">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px">

        <!-- HEADER -->
        <tr><td style="background:#1C3A2A;border-radius:12px 12px 0 0;padding:32px 40px 28px">
          <table cellpadding="0" cellspacing="0"><tr>
            <td style="font-family:Georgia,'Playfair Display','Times New Roman',serif;font-size:26px;font-weight:900;color:#F5F0E8;letter-spacing:-0.02em;line-height:1">Pivot</td>
            <td style="font-family:Georgia,'Playfair Display','Times New Roman',serif;font-size:26px;font-weight:900;color:#B87333;letter-spacing:-0.02em;line-height:1;padding-right:6px">.</td>
            <td style="font-family:Georgia,'Playfair Display','Times New Roman',serif;font-size:13px;font-weight:400;color:rgba(245,240,232,0.38);font-style:italic;vertical-align:bottom;padding-bottom:3px">la racine</td>
          </tr></table>
          <div style="margin-top:20px">
            <div style="display:inline-block;background:rgba(184,115,51,0.15);border:1px solid rgba(184,115,51,0.3);color:#B87333;font-size:10px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;padding:4px 12px;border-radius:20px">
              Invitation Photos
            </div>
          </div>
          <h1 style="margin:14px 0 0;font-size:24px;font-weight:700;color:#F5F0E8;line-height:1.2;font-family:Georgia,serif">
            Vous êtes invité(e)<br>à rejoindre Pivot Photos
          </h1>
        </td></tr>

        <!-- BODY -->
        <tr><td style="background:#FAFAF7;padding:32px 40px">
          <p style="margin:0 0 8px;font-size:15px;color:#1C3A2A;font-weight:600">Bonjour ${nom},</p>
          <p style="margin:0 0 24px;font-size:14px;color:#6B7280;line-height:1.7">
            Votre responsable vous a invité(e) à utiliser <strong style="color:#1C3A2A">Pivot Photos</strong>,
            l'application mobile pour photographier les fournitures sur chantier.
          </p>

          <!-- ÉTAPES -->
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px">
            <tr>
              <td style="padding:10px 0;border-bottom:1px solid #E8E4DC;vertical-align:top">
                <span style="display:inline-block;width:22px;height:22px;background:#1C3A2A;color:#F5F0E8;border-radius:50%;font-size:11px;font-weight:700;text-align:center;line-height:22px;margin-right:12px;flex-shrink:0">1</span>
                <span style="font-size:13px;color:#374151">Cliquez sur le bouton ci-dessous pour créer votre mot de passe</span>
              </td>
            </tr>
            <tr>
              <td style="padding:10px 0;border-bottom:1px solid #E8E4DC;vertical-align:top">
                <span style="display:inline-block;width:22px;height:22px;background:#1C3A2A;color:#F5F0E8;border-radius:50%;font-size:11px;font-weight:700;text-align:center;line-height:22px;margin-right:12px">2</span>
                <span style="font-size:13px;color:#374151">Connectez-vous à l'application depuis votre téléphone</span>
              </td>
            </tr>
            <tr>
              <td style="padding:10px 0;vertical-align:top">
                <span style="display:inline-block;width:22px;height:22px;background:#1C3A2A;color:#F5F0E8;border-radius:50%;font-size:11px;font-weight:700;text-align:center;line-height:22px;margin-right:12px">3</span>
                <span style="font-size:13px;color:#374151">Photographiez les fournitures assignées et envoyez vos photos</span>
              </td>
            </tr>
          </table>

          <!-- CTA création mot de passe -->
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr><td align="center" style="padding-bottom:20px">
              <a href="${actionLink || siteUrl + '/pivot-app-photos.html'}"
                style="display:inline-block;background:#1C3A2A;color:#F5F0E8;text-decoration:none;font-size:15px;font-weight:600;padding:14px 32px;border-radius:8px;letter-spacing:0.01em">
                Créer mon mot de passe →
              </a>
            </td></tr>
          </table>

          <!-- Lien de connexion permanent -->
          <div style="background:#F5F0E8;border-radius:8px;padding:16px 20px;margin-bottom:16px;text-align:center">
            <p style="margin:0 0 8px;font-size:12px;font-weight:600;color:#1C3A2A;letter-spacing:0.05em;text-transform:uppercase">Votre lien de connexion permanent</p>
            <a href="${siteUrl}/pivot-app-photos.html"
              style="font-size:14px;color:#B87333;font-weight:600;text-decoration:none;word-break:break-all">
              ${siteUrl}/pivot-app-photos.html
            </a>
            <p style="margin:8px 0 0;font-size:11px;color:#6B7280">Conservez ce lien pour vous connecter après avoir créé votre mot de passe.</p>
          </div>

          <div style="background:#F5F0E8;border-radius:8px;padding:14px 16px">
            <p style="margin:0;font-size:12px;color:#6B7280;line-height:1.6">
              💡 <strong>Astuce :</strong> Installez l'app sur votre téléphone pour un accès rapide —
              ouvrez le lien dans Safari (iPhone) ou Chrome (Android), puis ajoutez-le à votre écran d'accueil.
            </p>
          </div>
        </td></tr>

        <!-- FOOTER -->
        <tr><td style="background:#1C3A2A;border-radius:0 0 12px 12px;padding:20px 40px;text-align:center">
          <p style="margin:0;font-size:11px;color:rgba(245,240,232,0.4);letter-spacing:0.04em">
            PIVOT LA RACINE · pivotlaracine.com
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: env.RESEND_FROM, to: [email], subject: `Invitation Pivot Photos — ${nom}`, html }),
    }).catch(() => {});
  }

  return json({ ok: true });
}

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(handleScheduled(env));
  },

  async fetch(request, env) {
    const cors = {
      'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      // 'Authorization' est indispensable : les endpoints qui identifient l'appelant par son JWT
      // (/create-portal-session, /delete-user) l'envoient, et le navigateur refusait le preflight
      // sans lui — l'appel échouait côté client par un « Failed to fetch » sans trace serveur.
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, stripe-signature',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: cors });
    }

    const url = new URL(request.url);

    // Webhook Stripe — pas de vérification method (Stripe envoie POST)
    if (url.pathname === '/stripe-webhook') return await handleStripeWebhook(request, env);

    if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });

    try {
      if (url.pathname === '/create-checkout-session') return await handleCreateCheckout(request, env);
      if (url.pathname === '/create-portal-session')   return await handleCreatePortalSession(request, env);
      if (url.pathname === '/register-free')           return await handleRegisterFree(request, env);
      if (url.pathname === '/register-team-member')    return await handleRegisterTeamMember(request, env);
      if (url.pathname === '/delete-user')             return await handleDeleteUser(request, env);
      if (url.pathname === '/purger-structure')        return await handlePurgerStructure(request, env);
      if (url.pathname === '/send-invitation')         return await handleSendInvitation(request, env);
      if (url.pathname === '/inviter-moe')              return await handleInviterMoe(request, env);
      if (url.pathname === '/notify-event')            return await handleNotifyEvent(request, env);
      if (url.pathname === '/waitlist-confirm')        return await handleWaitlistConfirm(request, env);
      if (url.pathname === '/help-chat')               return await handleHelpChat(request, env);
      if (url.pathname === '/invite-collaborateur')    return await handleInviteCollaborateur(request, env);
      if (url.pathname === '/send-team-invite')        return await handleSendTeamInvite(request, env);
      if (url.pathname === '/generate-daf') return await handleDAF(request, env);
      if (url.pathname === '/generate-doe') return await handleDOE(request, env);
      if (url.pathname === '/palettes')     return new Response(JSON.stringify(PALETTES), { headers: { 'Content-Type': 'application/json', ...cors } });
      return new Response('Not found', { status: 404 });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message, stack: e.stack }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...cors }
      });
    }
  }
};
