// daf-client.js — Client frontend Pivot pour le worker PDF DAF/DOE
// À inclure dans pivot-entrepreneur.html via <script src="worker/daf-client.js">
// ou copier-coller le contenu directement dans le <script> de la page

const WORKER_URL = 'https://pivot-pdf.YOUR_SUBDOMAIN.workers.dev'; // à remplacer après déploiement

// ============================================================
// PALETTES (synchronisées avec worker.js)
// ============================================================
const DAF_PALETTES = [
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

// Lit un fichier et retourne son contenu en base64
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Télécharge un PDF depuis une URL Supabase et retourne son base64
async function urlToBase64(url) {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Impossible de charger ${url}`);
  const buf = await resp.arrayBuffer();
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

// Déclenche le téléchargement d'un Blob PDF dans le navigateur
function downloadPdf(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// ============================================================
// CONFIG — charge depuis Supabase (chantier_config)
// ============================================================

let _configCache = {}; // chantier_id → config

async function loadChantierConfig(chantierId) {
  if (_configCache[chantierId]) return _configCache[chantierId];
  const { data } = await db.from('chantier_config').select('*').eq('chantier_id', chantierId).maybeSingle();
  const config = data || { bandeau_bg: '#1a2e44', bandeau_text: '#ffffff' };
  _configCache[chantierId] = config;
  return config;
}

async function saveChantierConfig(chantierId, updates) {
  const existing = await loadChantierConfig(chantierId);
  if (existing.id) {
    await db.from('chantier_config').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', existing.id);
  } else {
    await db.from('chantier_config').insert({ chantier_id: chantierId, ...updates });
  }
  delete _configCache[chantierId];
}

// ============================================================
// GÉNÉRATION DAF
// ============================================================

/**
 * Génère et télécharge le PDF d'une DAF.
 *
 * @param {Object} daf       — données de la DAF depuis Supabase
 * @param {Object} chantier  — données du chantier
 * @param {Array}  fichesUrls — URLs des fiches techniques annexées (Supabase Storage)
 */
async function generateDAF(daf, chantier, fichesUrls = []) {
  const config = await loadChantierConfig(chantier.id);

  // Construire le payload DAF
  const dafPayload = {
    numero:        daf.numero || daf.id?.slice(0, 8).toUpperCase(),
    designation:   daf.designation,
    reference:     daf.reference,
    fabricant:     daf.fabricant,
    famille:       daf.famille,
    fournisseur:   daf.fournisseur_nom || daf.fournisseur,
    qte:           daf.qte,
    unite:         daf.unite || 'U',
    prix_unit_ht:  daf.prix_unit_ht,
    statut:        daf.statut || 'brouillon',
    version:       daf.version || 1,
    date_emission: daf.date_emission ? new Date(daf.date_emission).toLocaleDateString('fr-FR') : '',
    date_livraison: daf.date_livraison ? new Date(daf.date_livraison).toLocaleDateString('fr-FR') : '',
    date_commande: daf.date_commande ? new Date(daf.date_commande).toLocaleDateString('fr-FR') : '',
    chantier:      chantier.nom,
    caracteristiques: daf.caracteristiques || [],
    visa: daf.visa || null,
  };

  // Charger le logo entrepreneur si présent
  if (config.logo_entrepreneur_url) {
    try { dafPayload.logo_base64 = await urlToBase64(config.logo_entrepreneur_url); } catch {}
  }

  // Charger les annexes (fiches techniques)
  const annexes = [];
  for (const url of fichesUrls) {
    if (!url) continue;
    try {
      const b64 = await urlToBase64(url);
      const nom = url.split('/').pop().replace(/%[0-9A-F]{2}/gi, '').replace(/^\d+_/, '');
      annexes.push({ nom, base64: b64 });
    } catch {}
  }

  // Appel worker
  const resp = await fetch(`${WORKER_URL}/generate-daf`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      config: { bandeau_bg: config.bandeau_bg, bandeau_text: config.bandeau_text },
      daf: dafPayload,
      annexes,
    }),
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: resp.statusText }));
    throw new Error(err.error || 'Erreur worker DAF');
  }

  const blob = await resp.blob();
  downloadPdf(blob, `DAF-${dafPayload.numero || 'pivot'}.pdf`);
}

// ============================================================
// GÉNÉRATION DOE COMPLET
// ============================================================

/**
 * Génère et télécharge le DOE complet d'un chantier.
 *
 * @param {Object} chantier     — données du chantier
 * @param {Object} doeConfig    — config DOE depuis Supabase (ref_doe, chapitres)
 * @param {Array}  dafs         — toutes les DAF validées du chantier
 * @param {Array}  doeFichiers  — fichiers uploadés (doe_fichiers)
 * @param {Object} acteurs      — { entrepreneur, moe, mo } avec leurs données
 */
async function generateDOE(chantier, doeConfig, dafs, doeFichiers, acteurs = {}) {
  const config = await loadChantierConfig(chantier.id);

  // Page de garde
  const doe = {
    ref_doe: doeConfig.ref_doe || `DOE-${chantier.nom?.slice(0,4).toUpperCase() || 'CHANT'}-v1`,
    date_emission: new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }),
    chantier: chantier.nom,
    adresse: chantier.adresse || '',
    entrepreneur: acteurs.entrepreneur || null,
    moe: acteurs.moe || null,
    mo: acteurs.mo || null,
    chapitres: [], // calculé par le worker
  };

  // Charger logos acteurs
  for (const role of ['entrepreneur', 'moe', 'mo']) {
    if (doe[role]?.logo_url) {
      try { doe[role].logo_base64 = await urlToBase64(doe[role].logo_url); } catch {}
    }
  }

  // Construire les chapitres
  const chapitres = [];
  for (const chap of doeConfig.chapitres || []) {
    if (chap.type === 'fournitures') {
      // DAF filtrées par famille + converties en fiches DOE
      const chapFiches = dafs
        .filter(d => !chap.famille || d.famille === chap.famille)
        .map(d => ({
          chapitre_num:       chap.num,
          chapitre_nom:       chap.nom,
          famille:            d.famille,
          designation:        d.designation,
          entrepreneur:       acteurs.entrepreneur?.nom,
          date_mise_en_oeuvre: d.date_livraison ? new Date(d.date_livraison).toLocaleDateString('fr-FR') : '',
          lignes: [{
            designation: d.designation,
            fabricant:   d.fabricant,
            reference:   d.reference,
            qte:         d.qte,
            unite:       d.unite || 'U',
            prix_unit_ht: d.prix_unit_ht,
          }],
          livraison: {
            fournisseur: d.fournisseur_nom || d.fournisseur,
            livraison:   d.date_livraison ? new Date(d.date_livraison).toLocaleDateString('fr-FR') : '',
            garantie:    d.garantie || '',
            maintenance: d.maintenance || '',
          },
        }));
      chapitres.push({ ...chap, fiches: chapFiches });

    } else if (chap.type === 'pdfs') {
      // Fichiers uploadés pour ce chapitre
      const chapFichiers = doeFichiers
        .filter(f => f.chapitre_code === chap.code)
        .sort((a, b) => a.ordre - b.ordre);
      const fichiersAvecB64 = [];
      for (const f of chapFichiers) {
        try {
          const { data: { publicUrl } } = db.storage.from('doe-fichiers').getPublicUrl(f.storage_path);
          const b64 = await urlToBase64(publicUrl);
          fichiersAvecB64.push({ nom: f.nom, base64: b64 });
        } catch {}
      }
      chapitres.push({ ...chap, fichiers: fichiersAvecB64 });

    } else if (chap.type === 'manuel') {
      // Pages manuelles (définies dans doeConfig.chapitres)
      chapitres.push(chap);
    }
  }

  // Appel worker
  const resp = await fetch(`${WORKER_URL}/generate-doe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      config: { bandeau_bg: config.bandeau_bg, bandeau_text: config.bandeau_text },
      doe,
      chapitres,
    }),
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: resp.statusText }));
    throw new Error(err.error || 'Erreur worker DOE');
  }

  const blob = await resp.blob();
  downloadPdf(blob, `${doe.ref_doe}.pdf`);
}

// ============================================================
// UI — PANNEAU CONFIG COULEUR
// ============================================================

/**
 * Affiche un mini-panneau de sélection de palette pour un chantier.
 * À appeler depuis le bouton "Personnaliser" dans l'interface entrepreneur.
 *
 * @param {string} chantierId
 * @param {Function} onSave — callback après sauvegarde
 */
async function showConfigPalettePanel(chantierId, onSave) {
  const config = await loadChantierConfig(chantierId);

  // Supprimer un panel existant
  document.getElementById('daf-palette-panel')?.remove();

  const panel = document.createElement('div');
  panel.id = 'daf-palette-panel';
  panel.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black/40';
  panel.innerHTML = `
    <div class="bg-white rounded-xl shadow-2xl p-6 w-80 max-w-full">
      <h3 class="text-base font-bold text-gray-800 mb-4">Couleur du bandeau PDF</h3>
      <div class="grid grid-cols-4 gap-2 mb-4">
        ${DAF_PALETTES.map(p => `
          <button
            class="daf-palette-btn h-10 rounded-lg border-2 transition-all ${config.bandeau_bg === p.bg ? 'border-gray-800 scale-110' : 'border-transparent'}"
            style="background:${p.bg}"
            data-bg="${p.bg}" data-text="${p.text}"
            title="${p.name}"
          ></button>
        `).join('')}
      </div>
      <div class="flex items-center gap-2 mb-4">
        <label class="text-xs text-gray-500 w-20">Personnalisé</label>
        <input type="color" id="daf-custom-color" value="${config.bandeau_bg || '#1a2e44'}" class="w-10 h-8 rounded cursor-pointer border border-gray-200">
        <span class="text-xs text-gray-400">Clair/sombre auto</span>
      </div>
      <div class="flex justify-end gap-2">
        <button id="daf-palette-cancel" class="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Annuler</button>
        <button id="daf-palette-save" class="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">Enregistrer</button>
      </div>
    </div>
  `;

  document.body.appendChild(panel);

  let selectedBg   = config.bandeau_bg   || '#1a2e44';
  let selectedText = config.bandeau_text || '#ffffff';

  // Sélection palette
  panel.querySelectorAll('.daf-palette-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      panel.querySelectorAll('.daf-palette-btn').forEach(b => b.classList.replace('border-gray-800','border-transparent') && b.classList.remove('scale-110'));
      btn.classList.add('border-gray-800', 'scale-110');
      selectedBg   = btn.dataset.bg;
      selectedText = btn.dataset.text;
      document.getElementById('daf-custom-color').value = selectedBg;
    });
  });

  // Couleur personnalisée
  document.getElementById('daf-custom-color').addEventListener('input', e => {
    selectedBg = e.target.value;
    // Luminosité auto
    const r = parseInt(selectedBg.slice(1,3),16), g = parseInt(selectedBg.slice(3,5),16), b = parseInt(selectedBg.slice(5,7),16);
    const lum = 0.299*r + 0.587*g + 0.114*b;
    selectedText = lum > 140 ? '#2C2C2A' : '#ffffff';
    panel.querySelectorAll('.daf-palette-btn').forEach(b => { b.classList.replace('border-gray-800','border-transparent'); b.classList.remove('scale-110'); });
  });

  // Annuler
  document.getElementById('daf-palette-cancel').addEventListener('click', () => panel.remove());

  // Sauvegarder
  document.getElementById('daf-palette-save').addEventListener('click', async () => {
    await saveChantierConfig(chantierId, { bandeau_bg: selectedBg, bandeau_text: selectedText });
    panel.remove();
    if (onSave) onSave({ bandeau_bg: selectedBg, bandeau_text: selectedText });
  });

  // Fermer en cliquant l'overlay
  panel.addEventListener('click', e => { if (e.target === panel) panel.remove(); });
}
