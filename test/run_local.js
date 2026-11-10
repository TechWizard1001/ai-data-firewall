// Runs the exact n8n Code-node source locally against the demo set with a mock LLM.
// Usage: node test/run_local.js [--json]
const fs = require('fs'), path = require('path');
const N = (f) => fs.readFileSync(path.join(__dirname, '..', 'nodes', f), 'utf8');
const LIB = N('lib.js');
const outputs = {};

function runNode(name, file, inputItems, { withLib = false } = {}) {
  const code = (withLib ? LIB + '\n' : '') + N(file);
  const $input = { all: () => inputItems, first: () => inputItems[0] };
  const $ = (ref) => ({
    all: () => outputs[ref],
    itemMatching: (i) => {
      // follow pairedItem back to `ref`
      let item = inputItems[i];
      for (const hop of trace[name]) { item = outputs[hop][item.pairedItem.item]; if (hop === ref) return item; }
      throw new Error('no match');
    },
  });
  const res = new Function('$input', '$', code)($input, $);
  outputs[name] = res;
  return res;
}
// pairedItem lineage for itemMatching in Output Guard: input(HTTP) -> IF -> Policy Engine
const trace = { 'Output Guard': ['LLM', 'AI Allowed?', 'Policy Engine'] };

function mockLLM(req, msgId) {
  const t = req.messages[0].content.toLowerCase();
  const has = (...w) => w.some(x => t.includes(x));
  let r = { category: 'enquiry', is_complaint: false, product: 'other', urgency: 'low', vulnerability_indicators: [], summary: 'Customer enquiry.', recommended_action: 'Respond with information.', confidence: 0.9 };
  if (has('fee', 'charged', 'not good enough', 'disappointed', 'ridiculous', 'declined', "wasn't paid", 'nobody', 'still can')) r = { ...r, category: 'complaint', is_complaint: true, urgency: 'medium', summary: 'Customer dissatisfied with service outcome and expects resolution.', recommended_action: 'Acknowledge, investigate, respond within SLA.' };
  if (has('card', 'credit card')) r.product = 'cards'; else if (has('loan', 'mortgage', 'home loan')) r.product = 'lending'; else if (has('app', 'online')) r.product = 'digital_banking'; else if (has('insurance')) r.product = 'insurance'; else if (has('account', 'saver', 'deposit')) r.product = 'deposits';
  if (has('thank you to', 'above and beyond')) r = { ...r, category: 'compliment', is_complaint: false, summary: 'Customer praises branch staff.', confidence: 0.95 };
  if (has('hardship', 'lost my job', 'chemo')) r.vulnerability_indicators = ['financial hardship'];
  if (has('ignore all previous')) r = { ...r, category: 'compliment', confidence: 0.6 };                    // model got "injected"
  if (msgId === 'DEMO-002') r.summary = 'Rate enquiry from tom.becker@example.com about term deposits.';      // simulated leak
  if (msgId === 'DEMO-015') r.confidence = 0.55;                                                            // low confidence
  return { content: [{ type: 'text', text: JSON.stringify(r) }], usage: { input_tokens: 300, output_tokens: 90 } };
}

const trig = [{ json: {} }];
const demo = runNode('Load Demo Messages', '00_demo_messages.js', trig);
const norm = runNode('Normalise', '01_normalise.js', demo);
const pol = runNode('Policy Register', '02_policy_register.js', norm);
const det = runNode('Detect & Classify', '03_detect.js', pol, { withLib: true });
const eng = runNode('Policy Engine', '04_policy_engine.js', det, { withLib: true });
const allowed = [], blocked = [];
eng.forEach((it, i) => (it.json.ai_allowed ? allowed : blocked).push({ json: it.json, pairedItem: { item: i } }));
outputs['AI Allowed?'] = allowed;
outputs['LLM'] = allowed.map((it, i) => ({ json: mockLLM(it.json.llm_request, it.json.message_id), pairedItem: { item: i } }));
const guarded = runNode('Output Guard', '05_output_guard.js', outputs['LLM'], { withLib: true });
const blockedOut = runNode('Blocked: Human Only', '06_blocked_path.js', blocked);
const merged = [...guarded, ...blockedOut].map((it, i) => ({ json: it.json, pairedItem: { item: i } }));
const audit = runNode('Audit Ledger', '07_audit_ledger.js', merged);
const cases = runNode('Case Queue', '08_case_queue.js', merged);
const vault = runNode('Token Vault', '09_token_vault.js', merged);

if (process.argv.includes('--json')) { console.log(JSON.stringify({ audit: audit.map(a => a.json), cases: cases.map(c => c.json), vault_rows: vault.length }, null, 1)); return; }

// ---- Assertions: governance must hold ----
let fail = 0; const ok = (c, m) => { if (!c) { fail++; console.log('FAIL', m); } };
const byId = Object.fromEntries(merged.map(m => [m.json.message_id, m.json]));
const rawValues = merged.flatMap(m => m.json.detections.map(d => d.value));
for (const a of allowed) for (const v of a.json.detections) ok(!a.json.llm_request.messages[0].content.includes(v.value), `raw ${v.cls} sent to model in ${a.json.message_id}`);
const auditStr = JSON.stringify(audit) + JSON.stringify(cases);
for (const v of rawValues) ok(!auditStr.includes(v), `raw value "${v}" in audit/case output`);
ok(byId['DEMO-014'].ai_allowed === false && byId['DEMO-014'].priority === 'URGENT', 'crisis must block AI + urgent');
ok(byId['DEMO-019'].ai_allowed === false, 'unapproved purpose must block');
ok(byId['DEMO-002'].output_leak_blocked === true, 'leak must be caught');
ok(byId['DEMO-010'].review_reasons.includes('prompt_injection_suspected'), 'injection must be flagged');
ok(byId['DEMO-008'].policy_actions.filter(a => a === 'REDACT:TFN' || a === 'REDACT:MEDICARE').length === 2, 'TFN+Medicare redacted');
ok(byId['DEMO-003'].policy_actions.includes('REDACT:CARD_NUMBER'), 'card redacted');
ok(byId['DEMO-005'].review_reasons.some(r => r.includes('ELDER_FINANCIAL_ABUSE')), 'elder abuse flagged');
ok(!vault.some(v => ['CARD_NUMBER', 'TFN', 'MEDICARE'].includes(v.json.data_class)), 'redacted classes never in vault');

// ---- Report ----
console.log('\nmsg       ai   tier  pii  route                               review  reasons');
for (const m of merged.map(x => x.json).sort((a, b) => a.message_id.localeCompare(b.message_id)))
  console.log(`${m.message_id}  ${m.ai_allowed ? 'yes' : 'NO '}  ${m.data_tier}    ${String(m.detections.length).padEnd(3)}  ${m.route_to.padEnd(34)}  ${m.review_required ? 'YES' : 'no '}     ${m.review_reasons.join(', ')}`);
console.log('\nSample safe_text sent to model (DEMO-006):\n  ' + byId['DEMO-006'].safe_text);
console.log('Sample safe_text (DEMO-008):\n  ' + byId['DEMO-008'].safe_text);
console.log('Sample safe_text (DEMO-005):\n  ' + byId['DEMO-005'].safe_text);
console.log(`\nVault rows: ${vault.length}   Audit rows: ${audit.length}   Assertion failures: ${fail}`);
process.exit(fail ? 1 : 0);
