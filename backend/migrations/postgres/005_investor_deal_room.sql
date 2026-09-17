CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS investor_deal_rooms (
  id TEXT PRIMARY KEY, project_id TEXT NOT NULL, investor_id TEXT NOT NULL, founder_id TEXT,
  state TEXT NOT NULL CHECK (state IN ('interest','intro_requested','access_pending','diligence_open','diligence_complete','ic_review','term_sheet','negotiation','closing','closed','passed','withdrawn','expired')),
  nda_template_id TEXT, status TEXT NOT NULL DEFAULT 'active', created_at TIMESTAMPTZ NOT NULL, updated_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_investor_deal_rooms_scope ON investor_deal_rooms(investor_id, project_id, state);

CREATE TABLE IF NOT EXISTS investor_deal_participants (
  id TEXT PRIMARY KEY, deal_id TEXT NOT NULL REFERENCES investor_deal_rooms(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL, role TEXT NOT NULL CHECK (role IN ('owner','reviewer','ic_member','legal','finance','read_only','diligence_owner')),
  status TEXT NOT NULL DEFAULT 'active', added_by TEXT, created_at TIMESTAMPTZ NOT NULL,
  UNIQUE(deal_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_investor_deal_participants_user ON investor_deal_participants(user_id, status);

CREATE TABLE IF NOT EXISTS investor_nda_signatures (
  id TEXT PRIMARY KEY, deal_id TEXT NOT NULL REFERENCES investor_deal_rooms(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL, template_version TEXT NOT NULL, signature_hash TEXT NOT NULL,
  accepted BOOLEAN NOT NULL, signed_at TIMESTAMPTZ, revoked_at TIMESTAMPTZ,
  ip_address INET, user_agent TEXT, created_at TIMESTAMPTZ NOT NULL,
  UNIQUE(deal_id, user_id, template_version)
);

CREATE TABLE IF NOT EXISTS investor_diligence_items (
  id TEXT PRIMARY KEY, deal_id TEXT NOT NULL REFERENCES investor_deal_rooms(id) ON DELETE CASCADE,
  category TEXT NOT NULL, title TEXT NOT NULL, status TEXT NOT NULL,
  required BOOLEAN NOT NULL DEFAULT true, priority TEXT NOT NULL DEFAULT 'standard',
  owner_id TEXT, reviewer_id TEXT, due_date TIMESTAMPTZ, comments TEXT,
  created_at TIMESTAMPTZ NOT NULL, updated_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_investor_diligence_deal_status ON investor_diligence_items(deal_id, status, due_date);

CREATE TABLE IF NOT EXISTS investor_data_room_folders (
  id TEXT PRIMARY KEY, deal_id TEXT NOT NULL REFERENCES investor_deal_rooms(id) ON DELETE CASCADE,
  name TEXT NOT NULL, category TEXT NOT NULL, system BOOLEAN NOT NULL DEFAULT false,
  created_by TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL, updated_at TIMESTAMPTZ NOT NULL,
  UNIQUE(deal_id, name)
);
CREATE TABLE IF NOT EXISTS investor_data_room_documents (
  id TEXT PRIMARY KEY, deal_id TEXT NOT NULL REFERENCES investor_deal_rooms(id) ON DELETE CASCADE,
  folder_id TEXT REFERENCES investor_data_room_folders(id) ON DELETE SET NULL,
  name TEXT NOT NULL, category TEXT NOT NULL, content_type TEXT NOT NULL, size_bytes BIGINT NOT NULL,
  visibility TEXT NOT NULL CHECK (visibility IN ('founder_visible','investor_internal','participants')),
  status TEXT NOT NULL, malware_status TEXT NOT NULL, checksum TEXT,
  allow_preview BOOLEAN NOT NULL DEFAULT true, allow_download BOOLEAN NOT NULL DEFAULT true,
  watermark_required BOOLEAN NOT NULL DEFAULT false, expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ, created_by TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL, updated_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_investor_documents_scope ON investor_data_room_documents(deal_id, visibility, status);
CREATE TABLE IF NOT EXISTS investor_data_room_document_versions (
  id TEXT PRIMARY KEY, document_id TEXT NOT NULL REFERENCES investor_data_room_documents(id) ON DELETE CASCADE,
  version INTEGER NOT NULL CHECK (version > 0), checksum TEXT, object_key TEXT, source_url TEXT,
  status TEXT NOT NULL, uploaded_by TEXT NOT NULL, scan JSONB, created_at TIMESTAMPTZ NOT NULL,
  UNIQUE(document_id, version)
);

CREATE TABLE IF NOT EXISTS investor_questionnaire_templates (
  id TEXT PRIMARY KEY, deal_id TEXT NOT NULL REFERENCES investor_deal_rooms(id) ON DELETE CASCADE,
  version INTEGER NOT NULL, questions JSONB NOT NULL, active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL, UNIQUE(deal_id, version)
);
CREATE TABLE IF NOT EXISTS investor_diligence_evidence_requests (
  id TEXT PRIMARY KEY, deal_id TEXT NOT NULL REFERENCES investor_deal_rooms(id) ON DELETE CASCADE,
  title TEXT NOT NULL, category TEXT NOT NULL, required BOOLEAN NOT NULL DEFAULT true,
  visibility TEXT NOT NULL, owner_id TEXT, reviewer_id TEXT, status TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'standard', due_date TIMESTAMPTZ, requested_at TIMESTAMPTZ NOT NULL,
  created_by TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL, updated_at TIMESTAMPTZ NOT NULL
);
CREATE TABLE IF NOT EXISTS investor_questionnaire_submissions (
  id TEXT PRIMARY KEY, deal_id TEXT NOT NULL REFERENCES investor_deal_rooms(id) ON DELETE CASCADE,
  submitted_by TEXT NOT NULL, version INTEGER NOT NULL, answers JSONB NOT NULL,
  source_labels JSONB NOT NULL, status TEXT NOT NULL, submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL, updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS investor_revenue_verifications (
  id TEXT PRIMARY KEY, deal_id TEXT NOT NULL REFERENCES investor_deal_rooms(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('stripe','paystack','flutterwave')),
  status TEXT NOT NULL, aggregate JSONB, confidence TEXT, verified_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}', created_by TEXT NOT NULL, updated_at TIMESTAMPTZ NOT NULL
);
CREATE TABLE IF NOT EXISTS investor_reference_requests (
  id TEXT PRIMARY KEY, deal_id TEXT NOT NULL REFERENCES investor_deal_rooms(id) ON DELETE CASCADE,
  token_hash TEXT, nominee_role TEXT NOT NULL, status TEXT NOT NULL, expires_at TIMESTAMPTZ NOT NULL,
  questions JSONB NOT NULL, anonymized_response JSONB, created_at TIMESTAMPTZ NOT NULL, updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS investor_deal_questions (
  id TEXT PRIMARY KEY, deal_id TEXT NOT NULL REFERENCES investor_deal_rooms(id) ON DELETE CASCADE,
  author_id TEXT NOT NULL, checklist_item_id TEXT, document_id TEXT, assigned_to TEXT,
  visibility TEXT NOT NULL, status TEXT NOT NULL, content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL, updated_at TIMESTAMPTZ NOT NULL
);
CREATE TABLE IF NOT EXISTS investor_deal_question_messages (
  id TEXT PRIMARY KEY, question_id TEXT NOT NULL REFERENCES investor_deal_questions(id) ON DELETE CASCADE,
  deal_id TEXT NOT NULL REFERENCES investor_deal_rooms(id) ON DELETE CASCADE,
  author_id TEXT NOT NULL, visibility TEXT NOT NULL DEFAULT 'participants', content TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS investor_internal_notes (
  id TEXT PRIMARY KEY, deal_id TEXT NOT NULL REFERENCES investor_deal_rooms(id) ON DELETE CASCADE,
  investor_id TEXT NOT NULL, content TEXT NOT NULL, rating TEXT, created_at TIMESTAMPTZ NOT NULL, updated_at TIMESTAMPTZ NOT NULL
);
CREATE TABLE IF NOT EXISTS investor_ic_reviews (
  id TEXT PRIMARY KEY, deal_id TEXT NOT NULL REFERENCES investor_deal_rooms(id) ON DELETE CASCADE,
  investor_id TEXT NOT NULL, thesis TEXT, risks TEXT, mitigants TEXT, strengths TEXT, open_questions TEXT,
  proposed_check TEXT, proposed_valuation TEXT, conditions TEXT, recommendation TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL, updated_at TIMESTAMPTZ NOT NULL
);
CREATE TABLE IF NOT EXISTS investor_ic_approval_history (
  id TEXT PRIMARY KEY, review_id TEXT NOT NULL REFERENCES investor_ic_reviews(id) ON DELETE CASCADE,
  actor_id TEXT NOT NULL, recommendation TEXT NOT NULL, comment TEXT, created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS investor_term_sheet_versions (
  id TEXT PRIMARY KEY, deal_id TEXT NOT NULL REFERENCES investor_deal_rooms(id) ON DELETE CASCADE,
  investor_id TEXT NOT NULL, version INTEGER NOT NULL, status TEXT NOT NULL, terms JSONB NOT NULL,
  comments JSONB NOT NULL DEFAULT '[]', disclaimer TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL, updated_at TIMESTAMPTZ NOT NULL,
  UNIQUE(deal_id, version)
);
CREATE TABLE IF NOT EXISTS investor_packs (
  id TEXT PRIMARY KEY, deal_id TEXT NOT NULL REFERENCES investor_deal_rooms(id) ON DELETE CASCADE,
  generated_by TEXT NOT NULL, payload JSONB NOT NULL, generated_at TIMESTAMPTZ NOT NULL
);
CREATE TABLE IF NOT EXISTS investor_deal_closing_items (
  id TEXT PRIMARY KEY, deal_id TEXT NOT NULL REFERENCES investor_deal_rooms(id) ON DELETE CASCADE,
  label TEXT NOT NULL, required BOOLEAN NOT NULL DEFAULT true, status TEXT NOT NULL,
  owner_id TEXT, due_date TIMESTAMPTZ, evidence_document_id TEXT, created_at TIMESTAMPTZ NOT NULL, updated_at TIMESTAMPTZ NOT NULL
);
CREATE TABLE IF NOT EXISTS investor_comparable_transactions (
  id TEXT PRIMARY KEY, company TEXT NOT NULL, sector TEXT NOT NULL, region TEXT NOT NULL,
  transaction_type TEXT NOT NULL, amount NUMERIC, currency TEXT, announced_at DATE,
  source TEXT NOT NULL, source_url TEXT, active BOOLEAN NOT NULL DEFAULT true, created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS investor_deal_audit_events (
  id TEXT PRIMARY KEY, deal_id TEXT NOT NULL REFERENCES investor_deal_rooms(id) ON DELETE RESTRICT,
  actor_id TEXT, action TEXT NOT NULL, metadata JSONB NOT NULL DEFAULT '{}', source_data_hash TEXT NOT NULL,
  prev_hash TEXT NOT NULL, event_hash TEXT NOT NULL UNIQUE, created_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_investor_deal_audit_chain ON investor_deal_audit_events(deal_id, created_at, id);

CREATE OR REPLACE FUNCTION investor_deal_audit_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'investor deal audit events are append-only';
END $$;
DROP TRIGGER IF EXISTS trg_investor_deal_audit_immutable ON investor_deal_audit_events;
CREATE TRIGGER trg_investor_deal_audit_immutable BEFORE UPDATE OR DELETE ON investor_deal_audit_events
FOR EACH ROW EXECUTE FUNCTION investor_deal_audit_immutable();
REVOKE UPDATE, DELETE ON investor_deal_audit_events FROM PUBLIC;

ALTER TABLE investor_deal_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE investor_deal_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE investor_diligence_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE investor_data_room_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE investor_data_room_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE investor_data_room_document_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE investor_questionnaire_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE investor_diligence_evidence_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE investor_questionnaire_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE investor_revenue_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE investor_reference_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE investor_deal_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE investor_deal_question_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE investor_internal_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE investor_ic_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE investor_ic_approval_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE investor_term_sheet_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE investor_packs ENABLE ROW LEVEL SECURITY;
ALTER TABLE investor_deal_closing_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE investor_deal_audit_events ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION techit_current_user_id() RETURNS TEXT LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.user_id', true), '')
$$;
CREATE OR REPLACE FUNCTION techit_is_deal_participant(target_deal_id TEXT) RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM investor_deal_participants p WHERE p.deal_id = target_deal_id AND p.user_id = techit_current_user_id() AND p.status = 'active')
$$;
CREATE OR REPLACE FUNCTION techit_is_deal_investor(target_deal_id TEXT) RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM investor_deal_rooms d WHERE d.id = target_deal_id AND d.investor_id = techit_current_user_id())
$$;

DROP POLICY IF EXISTS deal_room_participant_policy ON investor_deal_rooms;
CREATE POLICY deal_room_participant_policy ON investor_deal_rooms USING (techit_is_deal_participant(id));
DROP POLICY IF EXISTS deal_participants_read_policy ON investor_deal_participants;
CREATE POLICY deal_participants_read_policy ON investor_deal_participants USING (techit_is_deal_participant(deal_id));

DO $$ DECLARE table_name TEXT; BEGIN
  FOREACH table_name IN ARRAY ARRAY['investor_diligence_items','investor_diligence_evidence_requests','investor_data_room_folders','investor_questionnaire_templates','investor_questionnaire_submissions','investor_revenue_verifications','investor_deal_questions','investor_deal_question_messages','investor_term_sheet_versions','investor_packs','investor_deal_closing_items','investor_deal_audit_events'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS deal_scope_policy ON %I', table_name);
    EXECUTE format('CREATE POLICY deal_scope_policy ON %I USING (techit_is_deal_participant(deal_id))', table_name);
  END LOOP;
END $$;
DROP POLICY IF EXISTS deal_document_scope_policy ON investor_data_room_documents;
CREATE POLICY deal_document_scope_policy ON investor_data_room_documents USING (techit_is_deal_participant(deal_id) AND (visibility <> 'investor_internal' OR techit_is_deal_investor(deal_id)));
DROP POLICY IF EXISTS deal_document_version_scope_policy ON investor_data_room_document_versions;
CREATE POLICY deal_document_version_scope_policy ON investor_data_room_document_versions USING (EXISTS (SELECT 1 FROM investor_data_room_documents d WHERE d.id = document_id AND techit_is_deal_participant(d.deal_id) AND (d.visibility <> 'investor_internal' OR techit_is_deal_investor(d.deal_id))));
DROP POLICY IF EXISTS investor_reference_scope_policy ON investor_reference_requests;
CREATE POLICY investor_reference_scope_policy ON investor_reference_requests USING (techit_is_deal_investor(deal_id));
DROP POLICY IF EXISTS investor_notes_scope_policy ON investor_internal_notes;
CREATE POLICY investor_notes_scope_policy ON investor_internal_notes USING (techit_is_deal_investor(deal_id));
DROP POLICY IF EXISTS investor_ic_scope_policy ON investor_ic_reviews;
CREATE POLICY investor_ic_scope_policy ON investor_ic_reviews USING (techit_is_deal_investor(deal_id));
DROP POLICY IF EXISTS investor_ic_approval_scope_policy ON investor_ic_approval_history;
CREATE POLICY investor_ic_approval_scope_policy ON investor_ic_approval_history USING (EXISTS (SELECT 1 FROM investor_ic_reviews r WHERE r.id = review_id AND techit_is_deal_investor(r.deal_id)));
