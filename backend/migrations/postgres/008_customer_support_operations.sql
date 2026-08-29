-- Additive Customer Care operations extension. Existing support evidence is preserved.
ALTER TABLE support_teams ADD COLUMN IF NOT EXISTS member_admin_ids JSONB NOT NULL DEFAULT '[]';
ALTER TABLE support_teams ADD COLUMN IF NOT EXISTS notification_emails JSONB NOT NULL DEFAULT '[]';
ALTER TABLE support_teams ADD COLUMN IF NOT EXISTS whatsapp_numbers JSONB NOT NULL DEFAULT '[]';
ALTER TABLE support_teams ADD COLUMN IF NOT EXISTS notify_email BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE support_teams ADD COLUMN IF NOT EXISTS notify_whatsapp BOOLEAN NOT NULL DEFAULT TRUE;

CREATE TABLE IF NOT EXISTS support_assignments (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES support_cases(id),
  previous_admin_id TEXT,
  previous_team TEXT,
  admin_id TEXT,
  team TEXT,
  assigned_at TIMESTAMPTZ NOT NULL,
  unassigned_at TIMESTAMPTZ,
  reason TEXT
);
CREATE INDEX IF NOT EXISTS idx_support_assignments_case ON support_assignments(case_id, assigned_at DESC);

ALTER TABLE support_assignments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS support_assignment_scope ON support_assignments;
CREATE POLICY support_assignment_scope ON support_assignments USING (
  techit_support_admin() OR EXISTS (
    SELECT 1 FROM support_cases c WHERE c.id = case_id AND techit_support_user(c.user_id)
  )
);
DROP TRIGGER IF EXISTS trg_support_assignments_immutable ON support_assignments;
CREATE TRIGGER trg_support_assignments_immutable BEFORE UPDATE OR DELETE ON support_assignments FOR EACH ROW EXECUTE FUNCTION support_append_only();
REVOKE UPDATE, DELETE ON support_assignments FROM PUBLIC;
