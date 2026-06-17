-- ============================================================
-- PIVOT — Schéma Supabase Complet v1.0
-- Plateforme de gestion des achats de chantier
-- ============================================================

-- ============================================================
-- TABLES COMPTES UTILISATEURS
-- ============================================================

CREATE TABLE compte_entrepreneur (
  id            uuid PRIMARY KEY DEFAULT auth.uid(),
  nom           text,
  societe       text,
  email         text,
  siret         text,
  tva_intra     text,
  adresse_complete text,
  telephone     text,
  logo_url      text,
  langue        text DEFAULT 'fr',
  delai_paiement    text,
  penalites_retard  text,
  mentions_legales  text,
  bc_counter    int DEFAULT 0,
  created_at    timestamptz DEFAULT now()
);

CREATE TABLE compte_fournisseur (
  id              uuid PRIMARY KEY DEFAULT auth.uid(),
  fournisseur_id  uuid,  -- FK ajoutée après création de fournisseurs
  nom             text,
  nom_entreprise  text,
  email           text,
  tel             text,
  adresse         text,
  siret           text,
  notif_preference text DEFAULT 'each',  -- 'each'|'daily'|'none'
  langue          text DEFAULT 'fr',
  created_at      timestamptz DEFAULT now()
);

CREATE TABLE compte_moe (
  id         uuid PRIMARY KEY DEFAULT auth.uid(),
  nom        text,
  societe    text,
  email      text,
  tel        text,
  adresse    text,
  langue     text DEFAULT 'fr',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE fournisseurs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entrepreneur_id uuid REFERENCES compte_entrepreneur(id) ON DELETE CASCADE,
  nom             text,
  email           text,
  tel             text,
  adresse         text,
  notes           text,
  familles        text[],
  created_at      timestamptz DEFAULT now()
);

-- FK différée (fournisseurs créé après compte_fournisseur)
ALTER TABLE compte_fournisseur
  ADD CONSTRAINT fk_cf_fournisseur
  FOREIGN KEY (fournisseur_id) REFERENCES fournisseurs(id);

-- ============================================================
-- FAMILLES DE FOURNITURES
-- ============================================================

CREATE TABLE familles_fournitures (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nom         text NOT NULL,
  icone       text,
  couleur     text,
  ordre       int,
  est_systeme bool DEFAULT false
);

INSERT INTO familles_fournitures (nom, icone, couleur, ordre, est_systeme) VALUES
  ('Végétaux',                  '🌿', '#22c55e', 1,  true),
  ('Substrats',                 '🪨', '#a8a29e', 2,  true),
  ('Semis & gazons',            '🌱', '#86efac', 3,  true),
  ('Accessoires plantation',    '🔧', '#f97316', 4,  true),
  ('Arrosage',                  '💧', '#38bdf8', 5,  true),
  ('Mobilier urbain',           '🪑', '#c084fc', 6,  true),
  ('Bordures & délimitations',  '🔲', '#94a3b8', 7,  true),
  ('Clôtures & portails',       '🚧', '#fbbf24', 8,  true),
  ('Minéraux décoratifs',       '🏔️', '#78716c', 9,  true),
  ('Revêtements sols',          '🛣️', '#6b7280', 10, true),
  ('Réseaux enterrés',          '🕳️', '#92400e', 11, true),
  ('Éclairage extérieur',       '💡', '#fde047', 12, true),
  ('Réseaux électriques',       '🔌', '#dc2626', 13, true),
  ('Bassins & fontainerie',     '🌊', '#0284c7', 14, true),
  ('Maçonnerie',                '🧱', '#b45309', 15, true),
  ('Charpente & ossature',      '⚙️', '#64748b', 16, true),
  ('Couverture & étanchéité',   '🏠', '#7c3aed', 17, true),
  ('Menuiseries extérieures',   '🚪', '#0f766e', 18, true),
  ('Menuiseries intérieures',   '🪟', '#0369a1', 19, true),
  ('Plomberie & chauffage',     '🔥', '#ea580c', 20, true),
  ('Électricité intérieure',    '⚡', '#ca8a04', 21, true),
  ('Peinture & revêtements int.','🎨','#e11d48', 22, true),
  ('Ventilation & climatisation','❄️','#0891b2', 23, true),
  ('Ferraillage & coffrages',   '🏗️', '#57534e', 24, true),
  ('Équipements parking',       '🚗', '#374151', 25, true),
  ('Accessibilité PMR',         '♿', '#1d4ed8', 26, true),
  ('Jeux & loisirs',            '🎪', '#d946ef', 27, true),
  ('Sécurité & contrôle accès', '🔒', '#991b1b', 28, true),
  ('Courants faibles',          '📡', '#1e3a5f', 29, true),
  ('Autres fournitures',        '📦', '#6b7280', 30, true);

-- ============================================================
-- CHANTIERS ET FOURNITURES
-- ============================================================

CREATE TABLE chantiers (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entrepreneur_id  uuid REFERENCES compte_entrepreneur(id) ON DELETE CASCADE,
  moe_id           uuid REFERENCES compte_moe(id),
  moe_invite_token text,
  affaire          text NOT NULL,
  ville            text,
  numero_marche    text,
  date_debut       date,
  date_fin_prevue  date,
  remarques        text,
  statut           text DEFAULT 'en_cours',
  created_at       timestamptz DEFAULT now()
);

CREATE TABLE fournitures (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chantier_id     uuid REFERENCES chantiers(id) ON DELETE CASCADE,
  entrepreneur_id uuid,                          -- dénormalisé pour RLS
  famille_id      uuid REFERENCES familles_fournitures(id),
  numero_poste    text,
  designation     text NOT NULL,
  description     text,
  reference       text,
  unite           text DEFAULT 'U',
  qte             numeric,
  prix_etude_ht   numeric,
  ordre           int,
  is_variante     bool DEFAULT false,
  parent_id       uuid REFERENCES fournitures(id),
  created_at      timestamptz DEFAULT now()
);

-- ============================================================
-- CONSULTATIONS FOURNISSEURS
-- ============================================================

CREATE TABLE consultations (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chantier_id           uuid REFERENCES chantiers(id) ON DELETE CASCADE,
  entrepreneur_id       uuid,                    -- dénormalisé
  titre                 text,
  date_envoi            timestamptz,
  date_limite_reponse   date,
  remarques             text,
  statut                text DEFAULT 'brouillon',
  created_at            timestamptz DEFAULT now()
);

CREATE TABLE consultation_fournisseurs (
  consultation_id uuid REFERENCES consultations(id) ON DELETE CASCADE,
  fournisseur_id  uuid REFERENCES fournisseurs(id) ON DELETE CASCADE,
  entrepreneur_id uuid,                          -- dénormalisé
  ordre           int,
  PRIMARY KEY (consultation_id, fournisseur_id)
);

CREATE TABLE invitations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consultation_id uuid REFERENCES consultations(id) ON DELETE CASCADE,
  fournisseur_id  uuid REFERENCES fournisseurs(id) ON DELETE CASCADE,
  entrepreneur_id uuid,                          -- dénormalisé
  token           text DEFAULT gen_random_uuid()::text,
  expires_at      timestamptz DEFAULT now() + interval '60 days',
  created_at      timestamptz DEFAULT now(),
  UNIQUE(consultation_id, fournisseur_id)
);

CREATE TABLE reponses_fournisseurs (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consultation_id       uuid REFERENCES consultations(id) ON DELETE CASCADE,
  fourniture_id         uuid REFERENCES fournitures(id) ON DELETE CASCADE,
  fournisseur_id        uuid,                    -- dénormalisé (ref fournisseurs.id)
  entrepreneur_id       uuid,                    -- dénormalisé
  prix_unit_ht          numeric,
  commentaire           text,
  frais_port            numeric,
  delai_livraison       text,
  est_variante          bool DEFAULT false,
  variante_ordre        int DEFAULT 0,
  variante_description  text,
  fiche_technique_url   text,
  fiche_technique_storage text,
  historique            jsonb DEFAULT '[]',
  updated_at            timestamptz,             -- null = sauvegardé non envoyé
  created_at            timestamptz DEFAULT now(),
  UNIQUE(fourniture_id, fournisseur_id, variante_ordre)
);

CREATE TABLE catalogue_fournisseur (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fournisseur_id          uuid,                  -- dénormalisé
  designation             text NOT NULL,
  reference               text,
  famille                 text,
  unite                   text,
  prix_unit_ht            numeric,
  fiche_technique_url     text,
  fiche_technique_storage text,
  updated_at              timestamptz DEFAULT now(),
  UNIQUE(fournisseur_id, designation, reference)
);

-- ============================================================
-- DAF ET VISA MOE
-- ============================================================

CREATE TABLE daf (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chantier_id             uuid REFERENCES chantiers(id) ON DELETE CASCADE,
  fourniture_id           uuid REFERENCES fournitures(id),
  fournisseur_id          uuid,
  entrepreneur_id         uuid,                  -- dénormalisé
  moe_id                  uuid,                  -- dénormalisé pour RLS MOE
  numero                  text,
  version                 int DEFAULT 1,
  statut                  text DEFAULT 'brouillon',
  -- 'brouillon'|'soumise'|'visa_ok'|'visa_remarques'|'refusee'|'commandee'
  designation             text,
  description             text,
  reference               text,
  fabricant               text,
  caracteristiques        jsonb,
  fiche_technique_url     text,
  fiche_technique_storage text,
  prix_unit_ht            numeric,
  qte                     numeric,
  unite                   text,
  date_soumission         timestamptz,
  date_livraison_prevue   date,
  date_commande           timestamptz,
  en_stock                bool DEFAULT false,
  notes_entrepreneur      text,
  parent_daf_id           uuid REFERENCES daf(id),
  created_at              timestamptz DEFAULT now()
);

CREATE TABLE visa_moe (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  daf_id          uuid REFERENCES daf(id) ON DELETE CASCADE,
  moe_id          uuid,                          -- dénormalisé
  entrepreneur_id uuid,                          -- dénormalisé
  moe_token       text,
  type            text NOT NULL,                 -- 'sans_remarque'|'avec_remarques'|'refus'
  remarques       text,
  date_visa       timestamptz DEFAULT now(),
  created_at      timestamptz DEFAULT now()
);

-- ============================================================
-- SUIVI ET NOTIFICATIONS
-- ============================================================

CREATE TABLE suivi_fournitures (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chantier_id           uuid REFERENCES chantiers(id) ON DELETE CASCADE,
  fourniture_id         uuid REFERENCES fournitures(id) ON DELETE CASCADE,
  daf_id                uuid REFERENCES daf(id),
  entrepreneur_id       uuid,                    -- dénormalisé
  statut_daf            text,
  date_livraison_prevue date,
  date_livraison_reelle date,
  en_stock              bool DEFAULT false,
  quantite_recue        numeric,
  notes                 text,
  updated_at            timestamptz DEFAULT now()
);

CREATE TABLE notifications (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type            text,
  user_id         uuid,
  message         text,
  chantier_id     uuid,
  consultation_id uuid,
  daf_id          uuid,
  read            bool DEFAULT false,
  created_at      timestamptz DEFAULT now()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE compte_entrepreneur        ENABLE ROW LEVEL SECURITY;
ALTER TABLE compte_fournisseur         ENABLE ROW LEVEL SECURITY;
ALTER TABLE compte_moe                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE fournisseurs               ENABLE ROW LEVEL SECURITY;
ALTER TABLE familles_fournitures       ENABLE ROW LEVEL SECURITY;
ALTER TABLE chantiers                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE fournitures                ENABLE ROW LEVEL SECURITY;
ALTER TABLE consultations              ENABLE ROW LEVEL SECURITY;
ALTER TABLE consultation_fournisseurs  ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitations                ENABLE ROW LEVEL SECURITY;
ALTER TABLE reponses_fournisseurs      ENABLE ROW LEVEL SECURITY;
ALTER TABLE catalogue_fournisseur      ENABLE ROW LEVEL SECURITY;
ALTER TABLE daf                        ENABLE ROW LEVEL SECURITY;
ALTER TABLE visa_moe                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE suivi_fournitures          ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications              ENABLE ROW LEVEL SECURITY;

-- familles_fournitures : lecture publique (données système)
CREATE POLICY "familles_read_all" ON familles_fournitures
  FOR SELECT USING (true);

-- Comptes : propriétaire uniquement
CREATE POLICY "compte_entrepreneur_own" ON compte_entrepreneur
  FOR ALL USING (id = auth.uid());

CREATE POLICY "compte_fournisseur_own" ON compte_fournisseur
  FOR ALL USING (id = auth.uid());

CREATE POLICY "compte_moe_own" ON compte_moe
  FOR ALL USING (id = auth.uid());

-- Fournisseurs (carnet d'adresses entrepreneur)
CREATE POLICY "fournisseurs_owner" ON fournisseurs
  FOR ALL USING (entrepreneur_id = auth.uid());

-- Chantiers
CREATE POLICY "chantiers_owner" ON chantiers
  FOR ALL USING (entrepreneur_id = auth.uid());

CREATE POLICY "chantiers_moe_read" ON chantiers
  FOR SELECT USING (moe_id = auth.uid());

-- Fournitures (entrepreneur CRUD, MOE lecture via chantier)
CREATE POLICY "fournitures_owner" ON fournitures
  FOR ALL USING (entrepreneur_id = auth.uid());

CREATE POLICY "fournitures_moe_read" ON fournitures
  FOR SELECT USING (
    chantier_id IN (SELECT id FROM chantiers WHERE moe_id = auth.uid())
  );

-- Consultations
CREATE POLICY "consultations_owner" ON consultations
  FOR ALL USING (entrepreneur_id = auth.uid());

-- consultation_fournisseurs
CREATE POLICY "cf_owner" ON consultation_fournisseurs
  FOR ALL USING (entrepreneur_id = auth.uid());

-- Invitations
CREATE POLICY "invitations_owner" ON invitations
  FOR ALL USING (entrepreneur_id = auth.uid());

CREATE POLICY "invitations_fournisseur_read" ON invitations
  FOR SELECT USING (
    fournisseur_id IN (
      SELECT fournisseur_id FROM compte_fournisseur WHERE id = auth.uid()
    )
  );

-- Réponses fournisseurs
CREATE POLICY "reponses_owner_read" ON reponses_fournisseurs
  FOR SELECT USING (entrepreneur_id = auth.uid());

CREATE POLICY "reponses_fournisseur_read" ON reponses_fournisseurs
  FOR SELECT USING (
    fournisseur_id IN (
      SELECT fournisseur_id FROM compte_fournisseur WHERE id = auth.uid()
    )
  );

CREATE POLICY "reponses_fournisseur_insert" ON reponses_fournisseurs
  FOR INSERT WITH CHECK (
    fournisseur_id IN (
      SELECT fournisseur_id FROM compte_fournisseur WHERE id = auth.uid()
    )
  );

CREATE POLICY "reponses_fournisseur_update" ON reponses_fournisseurs
  FOR UPDATE USING (
    fournisseur_id IN (
      SELECT fournisseur_id FROM compte_fournisseur WHERE id = auth.uid()
    )
  );

-- Catalogue fournisseur
CREATE POLICY "catalogue_fournisseur_own" ON catalogue_fournisseur
  FOR ALL USING (
    fournisseur_id IN (
      SELECT fournisseur_id FROM compte_fournisseur WHERE id = auth.uid()
    )
  );

-- DAF
CREATE POLICY "daf_owner" ON daf
  FOR ALL USING (entrepreneur_id = auth.uid());

CREATE POLICY "daf_moe_read" ON daf
  FOR SELECT USING (moe_id = auth.uid());

-- VISA MOE
CREATE POLICY "visa_moe_read" ON visa_moe
  FOR SELECT USING (entrepreneur_id = auth.uid() OR moe_id = auth.uid());

CREATE POLICY "visa_moe_insert" ON visa_moe
  FOR INSERT WITH CHECK (moe_id = auth.uid());

-- Suivi fournitures
CREATE POLICY "suivi_owner" ON suivi_fournitures
  FOR ALL USING (entrepreneur_id = auth.uid());

CREATE POLICY "suivi_moe_read" ON suivi_fournitures
  FOR SELECT USING (
    chantier_id IN (SELECT id FROM chantiers WHERE moe_id = auth.uid())
  );

-- Notifications
CREATE POLICY "notifs_own" ON notifications
  FOR ALL USING (user_id = auth.uid());

-- ============================================================
-- FONCTIONS SECURITY DEFINER (accès invité par token)
-- Contournent RLS pour les utilisateurs sans compte authentifié.
-- ============================================================

-- Lire une consultation via token fournisseur invité
CREATE OR REPLACE FUNCTION get_consultation_by_token(p_token text)
RETURNS SETOF consultations
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.*
  FROM consultations c
  JOIN invitations i ON i.consultation_id = c.id
  WHERE i.token = p_token
    AND (i.expires_at IS NULL OR i.expires_at > now());
$$;

-- Lire les fournitures d'une consultation via token
CREATE OR REPLACE FUNCTION get_fournitures_by_token(p_token text)
RETURNS SETOF fournitures
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT f.*
  FROM fournitures f
  JOIN consultations c ON c.chantier_id = f.chantier_id
  JOIN invitations i ON i.consultation_id = c.id
  WHERE i.token = p_token
    AND (i.expires_at IS NULL OR i.expires_at > now());
$$;

-- Lire un chantier via token MOE invité
CREATE OR REPLACE FUNCTION get_chantier_by_moe_token(p_token text)
RETURNS SETOF chantiers
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM chantiers
  WHERE moe_invite_token = p_token;
$$;

-- Lire les DAF d'un chantier via token MOE invité
CREATE OR REPLACE FUNCTION get_daf_by_moe_token(p_token text)
RETURNS SETOF daf
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT d.*
  FROM daf d
  JOIN chantiers ch ON ch.id = d.chantier_id
  WHERE ch.moe_invite_token = p_token;
$$;

-- Écrire une réponse fournisseur via token (invité sans compte)
CREATE OR REPLACE FUNCTION upsert_reponse_by_token(p_token text, p_data jsonb)
RETURNS reponses_fournisseurs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inv    invitations%ROWTYPE;
  v_result reponses_fournisseurs%ROWTYPE;
BEGIN
  SELECT * INTO v_inv
  FROM invitations
  WHERE token = p_token
    AND (expires_at IS NULL OR expires_at > now());

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Token invalide ou expiré';
  END IF;

  INSERT INTO reponses_fournisseurs (
    consultation_id, fourniture_id, fournisseur_id, entrepreneur_id,
    prix_unit_ht, commentaire, frais_port, delai_livraison,
    est_variante, variante_ordre, variante_description,
    fiche_technique_url, updated_at
  ) VALUES (
    v_inv.consultation_id,
    (p_data->>'fourniture_id')::uuid,
    v_inv.fournisseur_id,
    v_inv.entrepreneur_id,
    (p_data->>'prix_unit_ht')::numeric,
    p_data->>'commentaire',
    (p_data->>'frais_port')::numeric,
    p_data->>'delai_livraison',
    COALESCE((p_data->>'est_variante')::bool, false),
    COALESCE((p_data->>'variante_ordre')::int, 0),
    p_data->>'variante_description',
    p_data->>'fiche_technique_url',
    now()
  )
  ON CONFLICT (fourniture_id, fournisseur_id, variante_ordre)
  DO UPDATE SET
    prix_unit_ht         = EXCLUDED.prix_unit_ht,
    commentaire          = EXCLUDED.commentaire,
    frais_port           = EXCLUDED.frais_port,
    delai_livraison      = EXCLUDED.delai_livraison,
    fiche_technique_url  = EXCLUDED.fiche_technique_url,
    updated_at           = now()
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$$;

-- ============================================================
-- INDEX PERFORMANCES
-- ============================================================

CREATE INDEX idx_chantiers_entrepreneur    ON chantiers(entrepreneur_id);
CREATE INDEX idx_fournitures_chantier      ON fournitures(chantier_id);
CREATE INDEX idx_fournitures_entrepreneur  ON fournitures(entrepreneur_id);
CREATE INDEX idx_consultations_chantier    ON consultations(chantier_id);
CREATE INDEX idx_invitations_token         ON invitations(token);
CREATE INDEX idx_reponses_consultation     ON reponses_fournisseurs(consultation_id);
CREATE INDEX idx_reponses_fournisseur      ON reponses_fournisseurs(fournisseur_id);
CREATE INDEX idx_daf_chantier              ON daf(chantier_id);
CREATE INDEX idx_daf_entrepreneur          ON daf(entrepreneur_id);
CREATE INDEX idx_daf_moe                   ON daf(moe_id);
CREATE INDEX idx_notifications_user        ON notifications(user_id);
CREATE INDEX idx_chantiers_moe_token       ON chantiers(moe_invite_token);
