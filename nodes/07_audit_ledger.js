// ================== AUDIT LEDGER ==================
// One immutable row per message: what came in (hash only), what was found,
// what policy did, what the model saw (hash), what it decided, who must review.
// Contains NO raw personal data.
return $input.all().map((item, i) => {
  const j = item.json;
  return {
    json: {
      audit_id: `AUD-${j.message_id}`,
      logged_at: new Date().toISOString(),
      message_id: j.message_id,
      channel: j.channel,
      purpose: j.purpose,
      policy_version: j._policy.version,
      input_sha256: j.input_hash,
      detected_classes: JSON.stringify(j.detected_classes),
      pii_items_found: j.detections.length,
      tokens_issued: j.vault.length,
      items_redacted: j.policy_actions.filter(a => a.startsWith('REDACT')).length,
      sensitive_categories: j.sensitive_context.map(s => s.category).join('|'),
      injection_suspected: j.injection_suspected,
      data_tier: j.data_tier,
      ai_allowed: j.ai_allowed,
      block_reasons: j.block_reasons.join('|'),
      model_id: j.model_id || null,
      prompt_sha256: j.prompt_hash || null,
      llm_status: j.llm_status,
      output_leak_blocked: j.output_leak_blocked,
      category: j.triage?.category || null,
      is_complaint: j.is_complaint,
      product: j.triage?.product || null,
      confidence: typeof j.triage?.confidence === 'number' ? j.triage.confidence : null,
      priority: j.priority,
      route_to: j.route_to,
      review_required: j.review_required,
      review_reasons: j.review_reasons.join('|'),
      input_tokens: j.llm_usage?.input_tokens ?? null,
      output_tokens: j.llm_usage?.output_tokens ?? null,
    },
    pairedItem: { item: i },
  };
});
