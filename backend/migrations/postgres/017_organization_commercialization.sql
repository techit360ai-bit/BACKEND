CREATE TABLE IF NOT EXISTS organization_entitlements (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  plan TEXT NOT NULL,
  source TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  capabilities JSONB NOT NULL DEFAULT '{}',
  limits JSONB NOT NULL DEFAULT '{}',
  starts_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  payment_intent_id TEXT,
  provider_reference TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_org_entitlements_scope ON organization_entitlements(organization_id, status, expires_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_org_entitlements_provider_reference ON organization_entitlements(provider_reference) WHERE provider_reference IS NOT NULL;

CREATE TABLE IF NOT EXISTS organization_budgets (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  program_id TEXT,
  hackathon_id TEXT,
  source TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  balance NUMERIC NOT NULL DEFAULT 0,
  reserved_balance NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'credits',
  expires_at TIMESTAMPTZ,
  payment_intent_id TEXT,
  provider_reference TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_org_budgets_scope ON organization_budgets(organization_id, status, expires_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_org_budgets_provider_reference ON organization_budgets(provider_reference) WHERE provider_reference IS NOT NULL;

CREATE TABLE IF NOT EXISTS organization_usage (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL UNIQUE,
  organization_id TEXT NOT NULL,
  budget_id TEXT NOT NULL,
  program_id TEXT,
  hackathon_id TEXT,
  credits NUMERIC NOT NULL DEFAULT 0,
  settled_credits NUMERIC NOT NULL DEFAULT 0,
  released_credits NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_org_usage_scope ON organization_usage(organization_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS organization_sponsorship_packages (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  package_type TEXT NOT NULL,
  amount NUMERIC,
  currency TEXT,
  benefits JSONB NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'active',
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_org_sponsor_packages_scope ON organization_sponsorship_packages(organization_id, status);

CREATE TABLE IF NOT EXISTS sponsorship_applications (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  package_id TEXT NOT NULL,
  sponsor_name TEXT NOT NULL,
  sponsor_contact JSONB NOT NULL DEFAULT '{}',
  requested_benefits JSONB NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'submitted',
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sponsor_applications_scope ON sponsorship_applications(organization_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS sponsorship_transactions (
  id TEXT PRIMARY KEY,
  application_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  payment_intent_id TEXT,
  provider TEXT,
  provider_reference TEXT,
  amount NUMERIC NOT NULL DEFAULT 0,
  currency TEXT,
  credits NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_sponsor_transactions_provider_reference ON sponsorship_transactions(provider, provider_reference) WHERE provider_reference IS NOT NULL;

CREATE TABLE IF NOT EXISTS organization_billing_events (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  payment_intent_id TEXT,
  purchase_type TEXT NOT NULL,
  provider TEXT,
  provider_reference TEXT,
  amount NUMERIC NOT NULL DEFAULT 0,
  currency TEXT,
  credits NUMERIC NOT NULL DEFAULT 0,
  plan_id TEXT,
  created_at TIMESTAMPTZ NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_org_billing_events_payment ON organization_billing_events(payment_intent_id) WHERE payment_intent_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_org_billing_events_provider_reference ON organization_billing_events(provider, provider_reference) WHERE provider_reference IS NOT NULL;

CREATE TABLE IF NOT EXISTS sponsorship_benefits (
  id TEXT PRIMARY KEY,
  transaction_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  benefit_type TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  consent_required BOOLEAN NOT NULL DEFAULT false,
  fulfilled_by TEXT,
  fulfilled_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS startup_candidates (
  id TEXT PRIMARY KEY,
  organization_id TEXT,
  hackathon_id TEXT,
  team_id TEXT,
  founder_id TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'candidate',
  consent_at TIMESTAMPTZ NOT NULL,
  consent_version TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  UNIQUE(hackathon_id, team_id)
);
CREATE INDEX IF NOT EXISTS idx_startup_candidates_scope ON startup_candidates(organization_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS managed_hackathon_operations (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  hackathon_id TEXT,
  service_tier TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'requested',
  checklist JSONB NOT NULL DEFAULT '{}',
  sla JSONB NOT NULL DEFAULT '{}',
  assigned_team TEXT,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_managed_hackathon_scope ON managed_hackathon_operations(organization_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS organization_institutional_settings (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL UNIQUE,
  white_label JSONB NOT NULL DEFAULT '{}',
  integrations JSONB NOT NULL DEFAULT '{}',
  sla JSONB NOT NULL DEFAULT '{}',
  support JSONB NOT NULL DEFAULT '{}',
  updated_by TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS organization_abuse_reviews (
  id TEXT PRIMARY KEY,
  organization_id TEXT,
  user_id TEXT,
  hackathon_id TEXT,
  signal_type TEXT NOT NULL,
  score NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'open',
  evidence JSONB NOT NULL DEFAULT '{}',
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_org_abuse_reviews_status ON organization_abuse_reviews(status, created_at DESC);

ALTER TABLE organization_entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_sponsorship_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE sponsorship_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE sponsorship_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_billing_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE sponsorship_benefits ENABLE ROW LEVEL SECURITY;
ALTER TABLE startup_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE managed_hackathon_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_institutional_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_abuse_reviews ENABLE ROW LEVEL SECURITY;

DO $$ DECLARE table_name TEXT; BEGIN
  FOREACH table_name IN ARRAY ARRAY['organization_entitlements','organization_budgets','organization_usage','organization_sponsorship_packages','sponsorship_applications','sponsorship_transactions','sponsorship_benefits','startup_candidates','managed_hackathon_operations','organization_institutional_settings','organization_abuse_reviews','organization_billing_events'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS organization_commercial_scope_policy ON %I', table_name);
    EXECUTE format('CREATE POLICY organization_commercial_scope_policy ON %I USING (techit_org_member(organization_id))', table_name);
  END LOOP;
END $$;
