// ================== POLICY REGISTER ==================
// The governance rules live HERE, not in the pipeline logic.
// Risk/privacy owners change this node; engineers never touch the engine.
// Bump `version` on every change: it is stamped on every audit record.
const POLICY = {
  version: '2026.11-v1',
  owner: 'Data Governance Office',

  // Purpose limitation: AI may only process data for approved purposes
  purposes: {
    complaint_triage: { approved: true, description: 'Classify and route inbound customer messages' },
    marketing_personalisation: { approved: false, description: 'Not approved for customer free-text' },
  },

  // Data classification register.
  // TOKENISE = reversible placeholder (vault), REDACT = irreversible, ALLOW = sent as-is
  data_classes: {
    PERSON_NAME:    { tier: 'T2', action: 'TOKENISE', prefix: 'PERSON' },
    EMAIL:          { tier: 'T2', action: 'TOKENISE', prefix: 'EMAIL' },
    PHONE:          { tier: 'T2', action: 'TOKENISE', prefix: 'PHONE' },
    ADDRESS:        { tier: 'T2', action: 'TOKENISE', prefix: 'ADDRESS' },
    DATE_OF_BIRTH:  { tier: 'T2', action: 'TOKENISE', prefix: 'DOB' },
    BSB:            { tier: 'T3', action: 'TOKENISE', prefix: 'BSB' },
    ACCOUNT_NUMBER: { tier: 'T3', action: 'TOKENISE', prefix: 'ACCOUNT' },
    CARD_NUMBER:    { tier: 'T4', action: 'REDACT' },
    TFN:            { tier: 'T4', action: 'REDACT' },
    MEDICARE:       { tier: 'T4', action: 'REDACT' },
  },

  // Sensitive context. AI may read the context (it needs it to triage),
  // but a human must review the outcome. CRISIS never goes to AI.
  sensitive_categories: {
    CRISIS:                { action: 'BLOCK_AI', priority: 'URGENT', route: 'Customer Care - Crisis Response' },
    FAMILY_VIOLENCE:       { action: 'ALLOW_WITH_REVIEW', priority: 'HIGH' },
    ELDER_FINANCIAL_ABUSE: { action: 'ALLOW_WITH_REVIEW', priority: 'HIGH' },
    HEALTH:                { action: 'ALLOW_WITH_REVIEW', priority: 'MEDIUM' },
    FINANCIAL_HARDSHIP:    { action: 'ALLOW_WITH_REVIEW', priority: 'HIGH' },
    GAMBLING:              { action: 'ALLOW_WITH_REVIEW', priority: 'MEDIUM' },
    BEREAVEMENT:           { action: 'ALLOW_WITH_REVIEW', priority: 'MEDIUM' },
  },

  // Approved model register
  models: [
    { id: 'claude-haiku-5-5', provider: 'Anthropic (via n8n managed credits)', hosting: 'cloud', approved: true,
      approved_purposes: ['complaint_triage'], max_input_chars: 8000 },
  ],

  prompt_injection: { action: 'ALLOW_WITH_REVIEW' },
  review_confidence_threshold: 0.75,

  // Service levels for complaints (configurable per industry/regulator)
  sla: { acknowledge_hours: 24, resolve_days: 30, resolve_days_urgent: 21 },

  // Industry config: swap these for insurance, health, telco, super...
  taxonomy: {
    categories: ['complaint', 'enquiry', 'compliment', 'request', 'other'],
    products: ['deposits', 'lending', 'cards', 'digital_banking', 'insurance', 'fees_charges', 'other'],
    routing: {
      deposits: 'Everyday Banking Team', lending: 'Lending Services', cards: 'Cards & Disputes',
      digital_banking: 'Digital Support', insurance: 'Insurance Partners', fees_charges: 'Customer Resolutions',
      other: 'Customer Resolutions',
    },
    complaint_owner: 'Customer Resolutions (IDR)',
  },
};

return $input.all().map((item, i) => ({ json: { ...item.json, _policy: POLICY }, pairedItem: { item: i } }));
