DROP TRIGGER IF EXISTS trg_support_assignments_immutable ON support_assignments;
DROP POLICY IF EXISTS support_assignment_scope ON support_assignments;
ALTER TABLE support_assignments DISABLE ROW LEVEL SECURITY;
DROP TABLE IF EXISTS support_assignments;
ALTER TABLE support_teams DROP COLUMN IF EXISTS member_admin_ids;
ALTER TABLE support_teams DROP COLUMN IF EXISTS notification_emails;
ALTER TABLE support_teams DROP COLUMN IF EXISTS whatsapp_numbers;
ALTER TABLE support_teams DROP COLUMN IF EXISTS notify_email;
ALTER TABLE support_teams DROP COLUMN IF EXISTS notify_whatsapp;
