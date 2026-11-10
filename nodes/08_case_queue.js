// ================== CASE QUEUE ==================
// What the operations team works from. Tokenised view only:
// authorised staff resolve tokens via the restricted Token Vault.
return $input.all().map((item, i) => {
  const j = item.json;
  return {
    json: {
      message_id: j.message_id,
      received_at: j.received_at,
      channel: j.channel,
      customer_ref: j.customer_ref || null,
      status: j.review_required ? 'AWAITING_HUMAN_REVIEW' : 'ROUTED',
      priority: j.priority,
      route_to: j.route_to,
      is_complaint: j.is_complaint,
      category: j.triage?.category || 'unclassified',
      product: j.triage?.product || null,
      urgency: j.triage?.urgency || null,
      vulnerability_indicators: (j.triage?.vulnerability_indicators || []).join('; ') || j.sensitive_context.map(s => s.category).join('; '),
      ai_summary: j.triage?.summary || (j.ai_used ? '' : 'AI not permitted: see review reasons'),
      recommended_action: j.triage?.recommended_action || null,
      confidence: typeof j.triage?.confidence === 'number' ? j.triage.confidence : null,
      review_reasons: j.review_reasons.join('; '),
      acknowledge_due: j.acknowledge_due || null,
      resolve_due: j.resolve_due || null,
      tokenised_message: j.safe_text,
      reviewer: null,
      reviewer_decision: null,
    },
    pairedItem: { item: i },
  };
});
