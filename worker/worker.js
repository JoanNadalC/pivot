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
// BANDEAU HAUT DAF (bande colorée avec titre)
// ============================================================
const HEADER_H = 58;

function drawHeaderDAF(page, fonts, config, title, breadcrumb) {
  const bgColor  = hexToRgb(config.bandeau_bg  || '#1a2e44');
  const txtColor = hexToRgb(config.bandeau_text || '#ffffff');
  page.drawRectangle({ x:0, y:A4H-HEADER_H, width:A4W, height:HEADER_H, color:bgColor });
  page.drawText(breadcrumb || 'Pivot · DAF', {
    x: MARGIN, y: A4H - 18, font: fonts.regular, size: 7, color: hexToRgb('#aaaaaa'),
  });
  page.drawText(title || '', {
    x: MARGIN, y: A4H - 38, font: fonts.bold, size: 15, color: txtColor,
  });
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
  const breadcrumb = `Pivot · DAF · ${daf.chantier || ''} · ${daf.numero || ''}`;
  drawHeaderDAF(page, fonts, config, daf.designation || 'Sans titre', breadcrumb);

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
    if (highlight) page.drawRectangle({ x: MARGIN, y: y - ROW_H + 4, width: CONTENT_W, height: ROW_H, color: LIGHT });
    page.drawText(label, { x: MARGIN + 6, y: y, font: fonts.bold, size: 8, color: GREY });
    const lines = wrapText(value || '—', fonts.regular, 8.5, CONTENT_W - COL1 - 12);
    lines.forEach((l, i) => {
      page.drawText(l, { x: MARGIN + COL1, y: y - i * 11, font: fonts.regular, size: 8.5, color: BLACK });
    });
    const rowLines = Math.max(1, lines.length);
    page.drawLine({ start:{x:MARGIN,y:y-ROW_H+4}, end:{x:MARGIN+CONTENT_W,y:y-ROW_H+4}, thickness:0.4, color:rgb(0.88,0.88,0.88) });
    y -= ROW_H * rowLines;
  }

  // Section identité
  page.drawText('IDENTIFICATION', { x: MARGIN, y, font: fonts.bold, size: 7.5, color: hexToRgb(config.bandeau_bg||'#1a2e44') });
  y -= 16;
  drawRow('N° DAF', daf.numero, false);
  drawRow('Désignation', daf.designation, true);
  drawRow('Référence', daf.reference, false);
  drawRow('Fabricant', daf.fabricant, true);
  drawRow('Famille', daf.famille, false);
  drawRow('Fournisseur retenu', daf.fournisseur, true);
  y -= 8;

  // Section quantités + prix
  page.drawText('QUANTITÉS & PRIX', { x: MARGIN, y, font: fonts.bold, size: 7.5, color: hexToRgb(config.bandeau_bg||'#1a2e44') });
  y -= 16;
  drawRow('Quantité', daf.qte ? `${daf.qte} ${daf.unite || 'U'}` : '—', false);
  drawRow('Prix unitaire HT', daf.prix_unit_ht ? `${parseFloat(daf.prix_unit_ht).toFixed(2)} €` : '—', true);
  drawRow('Total HT', (daf.qte && daf.prix_unit_ht) ? `${(parseFloat(daf.qte)*parseFloat(daf.prix_unit_ht)).toFixed(2)} €` : '—', false);
  y -= 8;

  // Caractéristiques techniques
  if (daf.caracteristiques && daf.caracteristiques.length) {
    page.drawText('CARACTÉRISTIQUES TECHNIQUES', { x: MARGIN, y, font: fonts.bold, size: 7.5, color: hexToRgb(config.bandeau_bg||'#1a2e44') });
    y -= 16;
    daf.caracteristiques.forEach((c, i) => drawRow(c.cle || '', c.valeur || '', i%2===0));
    y -= 8;
  }

  // Dates
  page.drawText('DATES', { x: MARGIN, y, font: fonts.bold, size: 7.5, color: hexToRgb(config.bandeau_bg||'#1a2e44') });
  y -= 16;
  drawRow('Date émission', daf.date_emission || '—', false);
  drawRow('Date livraison prévue', daf.date_livraison || '—', true);
  if (daf.date_commande) drawRow('Date commande', daf.date_commande, false);
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

  drawBandeauBas(page, fonts, config, breadcrumb, pageNum, totalPages);
  return page;
}

// ============================================================
// PAGES ANNEXES (PDF uploadés avec bandeau overlay)
// ============================================================
async function buildAnnexPages(pdfDoc, fonts, config, annexPdfBytes, label, startPageNum, totalPages) {
  const annexDoc = await PDFDocument.load(annexPdfBytes);
  const pages = await pdfDoc.copyPages(annexDoc, annexDoc.getPageIndices());
  let pNum = startPageNum;
  for (const page of pages) {
    pdfDoc.addPage(page);
    const { width, height } = page.getSize();
    const bgColor = hexToRgb(config.bandeau_bg || '#1a2e44');
    // Bandeau bas overlay
    page.drawRectangle({ x:0, y:0, width, height:BANDEAU_H, color:bgColor });
    page.drawText(label || 'Pivot · Annexe', { x:MARGIN, y:9, font:fonts.regular, size:7, color:hexToRgb(config.bandeau_text||'#ffffff') });
    const ps = `${pNum} / ${totalPages}`;
    page.drawText(ps, { x:width-MARGIN-fonts.regular.widthOfTextAtSize(ps,7), y:9, font:fonts.regular, size:7, color:hexToRgb(config.bandeau_text||'#ffffff') });
    pNum++;
  }
  return annexDoc.getPageCount();
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

  const breadcrumb = `Pivot · DOE · Chap. ${fiche.chapitre_num || ''} — ${fiche.famille || fiche.chapitre_nom || ''}`;

  // Header
  drawHeaderDAF(page, fonts, config, fiche.chapitre_nom || 'Fournitures', breadcrumb);

  let y = A4H - HEADER_H - 22;
  const ROW_H = 20;
  const COL1 = 130;

  function drawRow(label, value, highlight) {
    if (highlight) page.drawRectangle({ x:MARGIN, y:y-ROW_H+4, width:CONTENT_W, height:ROW_H, color:LIGHT });
    page.drawText(label, { x:MARGIN+6, y, font:fonts.bold, size:8, color:GREY });
    const lines = wrapText(value||'—', fonts.regular, 8.5, CONTENT_W-COL1-12);
    lines.forEach((l, i) => page.drawText(l, { x:MARGIN+COL1, y:y-i*11, font:fonts.regular, size:8.5, color:BLACK }));
    const rowLines = Math.max(1, lines.length);
    page.drawLine({ start:{x:MARGIN,y:y-ROW_H+4}, end:{x:MARGIN+CONTENT_W,y:y-ROW_H+4}, thickness:0.4, color:rgb(0.88,0.88,0.88) });
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
      if (even) page.drawRectangle({ x:MARGIN, y:y-ROW_H+4, width:CONTENT_W, height:ROW_H, color:LIGHT });
      const txt = (s, x) => page.drawText(String(s||''), { x:x+4, y:y-2, font:fonts.regular, size:8, color:BLACK });
      txt(l.designation, MARGIN);
      txt(l.fabricant||'', MARGIN+205);
      txt(l.reference||'', MARGIN+330);
      txt(l.qte||'', MARGIN+415);
      txt(l.unite||'U', MARGIN+460);
      txt(l.prix_unit_ht ? parseFloat(l.prix_unit_ht).toFixed(2)+' €' : '', MARGIN+495);
      page.drawLine({ start:{x:MARGIN,y:y-ROW_H+4}, end:{x:MARGIN+CONTENT_W,y:y-ROW_H+4}, thickness:0.3, color:rgb(0.88,0.88,0.88) });
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
    if (lv.livraison)    drawRow('Date livraison', lv.livraison, true);
    if (lv.garantie)     drawRow('Garantie', lv.garantie, false);
    if (lv.maintenance)  drawRow('Maintenance', lv.maintenance, true);
  }

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
// PAGE DE GARDE DOE
// ============================================================
async function buildPageDeGarde(pdfDoc, fonts, config, doe) {
  const page = pdfDoc.addPage([A4W, A4H]);
  const bgColor  = hexToRgb(config.bandeau_bg  || '#1a2e44');
  const txtColor = hexToRgb(config.bandeau_text || '#ffffff');
  const BLACK = rgb(0.1,0.1,0.1);
  const GREY  = rgb(0.45,0.45,0.45);

  // Bandeau haut (35% de la page)
  const bandeauH = A4H * 0.35;
  page.drawRectangle({ x:0, y:A4H-bandeauH, width:A4W, height:bandeauH, color:bgColor });

  // Label
  page.drawText('Pivot · Dossier des ouvrages exécutés', { x:MARGIN, y:A4H-30, font:fonts.regular, size:8, color:hexToRgb('#aaaaaa') });

  // Nom chantier
  const chantierLines = wrapText(doe.chantier || 'Chantier sans titre', fonts.bold, 18, CONTENT_W);
  let cy = A4H - 70;
  chantierLines.forEach(l => { page.drawText(l, { x:MARGIN, y:cy, font:fonts.bold, size:18, color:txtColor }); cy -= 24; });

  // Adresse
  if (doe.adresse) page.drawText(doe.adresse, { x:MARGIN, y:cy-6, font:fonts.regular, size:10, color:hexToRgb('#bbbbbb') });

  // Row métadonnées
  const metaY = A4H - bandeauH + 16;
  const metas = [
    doe.ref_doe && `Réf. ${doe.ref_doe}`,
    doe.date_emission && `Émis le ${doe.date_emission}`,
    doe.chapitres && `${doe.chapitres.length} chapitre(s)`,
  ].filter(Boolean);
  let mx = MARGIN;
  metas.forEach(m => {
    page.drawRectangle({ x:mx, y:metaY-5, width:fonts.regular.widthOfTextAtSize(m,7.5)+12, height:14, color:rgb(1,1,1,0.12), borderRadius:3 });
    page.drawText(m, { x:mx+6, y:metaY, font:fonts.regular, size:7.5, color:txtColor });
    mx += fonts.regular.widthOfTextAtSize(m,7.5) + 20;
  });

  // Zone acteurs (3 colonnes)
  const acteurY = A4H - bandeauH - 20;
  const acteurs = [
    { label:'ENTREPRENEUR', data: doe.entrepreneur },
    { label:'MAÎTRE D\'ŒUVRE', data: doe.moe },
    { label:'MAÎTRE D\'OUVRAGE', data: doe.mo },
  ];
  const colW = CONTENT_W / 3;

  for (const [i, act] of acteurs.entries()) {
    if (!act.data) continue;
    const ax = MARGIN + i * colW;
    let ay = acteurY;
    page.drawText(act.label, { x:ax, y:ay, font:fonts.bold, size:7, color:bgColor });
    ay -= 14;
    // Logo acteur
    if (act.data.logo_base64) {
      try {
        const logoBytes = Uint8Array.from(atob(act.data.logo_base64.replace(/^data:[^;]+;base64,/,'')), c => c.charCodeAt(0));
        const img = act.data.logo_base64.includes('png') ? await pdfDoc.embedPng(logoBytes) : await pdfDoc.embedJpg(logoBytes);
        const dims = img.scale(0.15);
        page.drawImage(img, { x:ax, y:ay-clamp(dims.height,10,30), width:clamp(dims.width,10,60), height:clamp(dims.height,10,30) });
        ay -= clamp(dims.height,10,30) + 6;
      } catch {}
    }
    if (act.data.nom)     { page.drawText(act.data.nom,     { x:ax, y:ay, font:fonts.bold,    size:8.5, color:BLACK }); ay -= 12; }
    if (act.data.contact) { page.drawText(act.data.contact, { x:ax, y:ay, font:fonts.regular, size:7.5, color:GREY  }); ay -= 11; }
    if (act.data.tel)     { page.drawText(act.data.tel,     { x:ax, y:ay, font:fonts.regular, size:7.5, color:GREY  }); ay -= 11; }
    if (act.data.email)   { page.drawText(act.data.email,   { x:ax, y:ay, font:fonts.regular, size:7.5, color:GREY  }); ay -= 11; }
    // Séparateur vertical
    if (i < 2) page.drawLine({ start:{x:ax+colW-10,y:acteurY+4}, end:{x:ax+colW-10,y:ay-4}, thickness:0.5, color:rgb(0.88,0.88,0.88) });
  }

  // Ligne séparatrice
  const sepY = acteurY - 100;
  page.drawLine({ start:{x:MARGIN,y:sepY}, end:{x:MARGIN+CONTENT_W,y:sepY}, thickness:0.5, color:rgb(0.85,0.85,0.85) });

  // Sommaire
  let sy = sepY - 20;
  page.drawText('SOMMAIRE', { x:MARGIN, y:sy, font:fonts.bold, size:9, color:bgColor });
  sy -= 16;
  for (const chap of doe.chapitres || []) {
    if (sy < BANDEAU_H + 20) break;
    const chapLabel = `${chap.num}. ${chap.nom}`;
    page.drawText(chapLabel, { x:MARGIN, y:sy, font:fonts.bold, size:8.5, color:BLACK });
    if (chap.nb_fiches) {
      const badge = `${chap.nb_fiches} fiche(s)`;
      page.drawText(badge, { x:MARGIN+200, y:sy, font:fonts.regular, size:7.5, color:GREY });
    }
    const pageStr = `p. ${chap.page_debut || '—'}`;
    const pw = fonts.regular.widthOfTextAtSize(pageStr, 8);
    page.drawText(pageStr, { x:MARGIN+CONTENT_W-pw, y:sy, font:fonts.regular, size:8, color:GREY });
    // Ligne pointillée
    const lineStart = MARGIN + fonts.bold.widthOfTextAtSize(chapLabel, 8.5) + 8;
    const lineEnd   = MARGIN + CONTENT_W - pw - 8;
    if (lineEnd > lineStart) {
      let lx = lineStart;
      while (lx < lineEnd) { page.drawText('.', { x:lx, y:sy, font:fonts.regular, size:8, color:rgb(0.7,0.7,0.7) }); lx += 4; }
    }
    sy -= 16;
  }

  // Bandeau bas page de garde
  page.drawRectangle({ x:0, y:0, width:A4W, height:BANDEAU_H, color:bgColor });
  page.drawText('Pivot · pivotlaracine.com', { x:MARGIN, y:9, font:fonts.regular, size:7, color:hexToRgb(config.bandeau_text||'#ffffff') });
  page.drawText(`${doe.ref_doe || 'DOE'} · ${doe.date_emission || ''}`, { x:A4W-MARGIN-150, y:9, font:fonts.regular, size:7, color:hexToRgb(config.bandeau_text||'#ffffff') });
}

// ============================================================
// ASSEMBLEUR DOE COMPLET
// ============================================================
async function buildDOE(payload, env) {
  const { config = {}, doe = {}, chapitres = [] } = payload;
  const pdfDoc = await PDFDocument.create();
  const fonts = await loadFonts(pdfDoc, env);

  // Pré-calculer le nombre de pages total (approximatif)
  // Page de garde = 1
  let totalPages = 1;
  for (const chap of chapitres) {
    if (chap.type === 'fournitures') totalPages += (chap.fiches || []).length;
    else if (chap.type === 'pdfs')   totalPages += (chap.fichiers || []).length; // approximatif
    else if (chap.type === 'manuel') totalPages += (chap.pages || []).length;
  }

  // Calculer les pages de début des chapitres pour le sommaire
  let currentPage = 2;
  const chapitresAvecPages = chapitres.map(chap => {
    const pageDebut = currentPage;
    if (chap.type === 'fournitures') currentPage += (chap.fiches || []).length;
    else if (chap.type === 'pdfs')   currentPage += (chap.fichiers || []).length;
    else if (chap.type === 'manuel') currentPage += (chap.pages || []).length;
    return { ...chap, page_debut: pageDebut };
  });

  doe.chapitres = chapitresAvecPages;

  // Page de garde
  await buildPageDeGarde(pdfDoc, fonts, config, doe);
  let pageNum = 2;

  // Chapitres
  for (const chap of chapitresAvecPages) {
    if (chap.type === 'fournitures') {
      for (const fiche of chap.fiches || []) {
        await buildFicheFournitureDOE(pdfDoc, fonts, config, doe, { ...fiche, chapitre_num: chap.num, chapitre_nom: chap.nom }, pageNum, totalPages);
        pageNum++;
      }
    } else if (chap.type === 'pdfs') {
      for (const fichier of chap.fichiers || []) {
        if (!fichier.base64) continue;
        try {
          const pdfBytes = Uint8Array.from(atob(fichier.base64), c => c.charCodeAt(0));
          const label = `Pivot · DOE · Chap. ${chap.num} — ${chap.nom}`;
          const added = await buildAnnexPages(pdfDoc, fonts, config, pdfBytes, label, pageNum, totalPages);
          pageNum += added;
        } catch {}
      }
    } else if (chap.type === 'manuel') {
      for (const pg of chap.pages || []) {
        const added = await buildPageManuelle(pdfDoc, fonts, config, doe, pg, pageNum, totalPages);
        pageNum += added;
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
  const { config = {}, daf = {}, annexes = [] } = payload;

  const pdfDoc = await PDFDocument.create();
  const fonts = await loadFonts(pdfDoc, env);

  let totalPages = 1 + annexes.length;
  await buildPage1DAF(pdfDoc, fonts, config, daf, 1, totalPages);

  let pageNum = 2;
  for (const annexe of annexes) {
    if (!annexe.base64) continue;
    try {
      const pdfBytes = Uint8Array.from(atob(annexe.base64), c => c.charCodeAt(0));
      const label = `Pivot · DAF · ${daf.numero || ''} · ${annexe.nom || 'Annexe'}`;
      const added = await buildAnnexPages(pdfDoc, fonts, config, pdfBytes, label, pageNum, totalPages);
      pageNum += added;
    } catch {}
  }

  const pdfBytes = await pdfDoc.save();
  return new Response(pdfBytes, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="DAF-${daf.numero||'pivot'}.pdf"`,
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
      'Content-Disposition': `attachment; filename="${ref}.pdf"`,
      'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '*',
    }
  });
}

// ============================================================
// ENTRY POINT
// ============================================================
export default {
  async fetch(request, env) {
    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        }
      });
    }
    if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });

    const url = new URL(request.url);
    try {
      if (url.pathname === '/generate-daf') return await handleDAF(request, env);
      if (url.pathname === '/generate-doe') return await handleDOE(request, env);
      if (url.pathname === '/palettes')     return new Response(JSON.stringify(PALETTES), { headers: { 'Content-Type': 'application/json' } });
      return new Response('Not found', { status: 404 });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
  }
};
