// ================== OUTPUT GUARD ==================
// Trust nothing the model returns: validate schema, check for leaked or invented
// personal data, apply confidence threshold, then attach SLA + routing.
const out = [];
const items = $input.all();
for (let i = 0; i < items.length; i++) {
  const resp = items[i].json;
  const ctx = $('Policy Engine').itemMatching(i).json;
  const P = ctx._policy, T = P.taxonomy;
  const review = [...ctx.review_reasons];
  let triage = null, llmStatus = 'ok';

  // 1. Parse
  const pickText = (r) => {
    if (!r) return null;
    if (Array.isArray(r.content)) { const t = r.content.find(c => c && c.type === 'text'); if (t) return t.text; }
    if (typeof r.content === 'string') return r.content;
    if (typeof r.merged_response === 'string') return r.merged_response;
    if (typeof r.text === 'string') return r.text;
    if (typeof r.message?.content === 'string') return r.message.content;
    return null;
  };
  const text = pickText(resp);
  if (!text || resp.error) {
    const e = resp?.error;
    const why = typeof e === 'string' ? e : (e?.type || e?.message || 'no_content');
    llmStatus = 'llm_error'; review.push(`llm_error:${String(why).slice(0, 60)}`);
  }
  else {
    try { triage = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)); }
    catch (e) { llmStatus = 'unparseable'; review.push('llm_output_unparseable'); }
  }

  // 2. Schema validation
  if (triage) {
    const bad = [];
    if (!T.categories.includes(triage.category)) bad.push('category');
    if (!T.products.includes(triage.product)) bad.push('product');
    if (!['low', 'medium', 'high'].includes(triage.urgency)) bad.push('urgency');
    if (typeof triage.is_complaint !== 'boolean') bad.push('is_complaint');
    if (typeof triage.confidence !== 'number') bad.push('confidence');
    if (!Array.isArray(triage.vulnerability_indicators)) triage.vulnerability_indicators = [];
    if (bad.length) { llmStatus = 'schema_invalid'; review.push(`schema_invalid:${bad.join('|')}`); }
  }

  // 3. Leak checks: raw vault values, fresh PII, or tokens the model made up
  let leak = false;
  if (triage) {
    const blob = `${triage.summary || ''} ${triage.recommended_action || ''} ${(triage.vulnerability_indicators || []).join(' ')}`;
    const norm = s => s.toLowerCase().replace(/[\s-]/g, '');
    if (ctx.vault.some(v => norm(blob).includes(norm(v.value)))) { leak = true; review.push('output_leak:vault_value'); }
    const fresh = LIB.detect(blob.replace(/\[[A-Z_]+(?:_\d+|_REDACTED)\]/g, ' '));
    if (fresh.length) { leak = true; review.push(`output_leak:${fresh.map(f => f.cls).join('|')}`); }
    const known = new Set(ctx.vault.map(v => v.token));
    const invented = (blob.match(/\[[A-Z]+_\d+\]/g) || []).filter(t => !known.has(t));
    if (invented.length) review.push('hallucinated_token');
    if (leak) { triage.summary = '[WITHHELD: output failed leak check]'; triage.recommended_action = '[WITHHELD]'; }
    if (triage.confidence < P.review_confidence_threshold) review.push(`low_confidence:${triage.confidence}`);
    if (triage.vulnerability_indicators.length && !ctx.review_reasons.some(r => r.startsWith('sensitive:'))) review.push('model_flagged_vulnerability');
  }

  // 4. SLA + routing
  const received = new Date(ctx.received_at);
  const isComplaint = triage ? triage.is_complaint === true : true; // unknown = treat as complaint (fail safe)
  let priority = ctx.priority;
  if (triage?.urgency === 'high' && priority === 'NORMAL') priority = 'HIGH';
  const resolveDays = priority === 'URGENT' ? P.sla.resolve_days_urgent : P.sla.resolve_days;
  const route = isComplaint ? T.complaint_owner : (T.routing[triage?.product] || T.routing.other);

  out.push({
    json: {
      ...ctx,
      ai_used: true,
      llm_status: llmStatus,
      output_leak_blocked: leak,
      triage,
      is_complaint: isComplaint,
      priority,
      route_to: route,
      review_required: review.length > 0,
      review_reasons: [...new Set(review)],
      acknowledge_due: isComplaint ? new Date(received.getTime() + P.sla.acknowledge_hours * 3600e3).toISOString() : null,
      resolve_due: isComplaint ? new Date(received.getTime() + resolveDays * 86400e3).toISOString() : null,
      llm_usage: resp?.usage || null,
      ai_finished_at: new Date().toISOString(),
    },
    pairedItem: { item: i },
  });
}
return out;
