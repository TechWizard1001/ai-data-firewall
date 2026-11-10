// ================== BLOCKED: HUMAN ONLY ==================
// AI was not permitted. Build the case for a human, start the clock, fail safe.
return $input.all().map((item, i) => {
  const j = item.json, P = j._policy;
  const received = new Date(j.received_at);
  const days = j.priority === 'URGENT' ? P.sla.resolve_days_urgent : P.sla.resolve_days;
  return {
    json: {
      ...j,
      ai_used: false,
      llm_status: 'not_called',
      output_leak_blocked: false,
      triage: null,
      is_complaint: true, // unknown: treat as complaint so the regulatory clock still runs
      route_to: j.forced_route || 'Human Review Queue',
      review_required: true,
      review_reasons: [...new Set([...j.block_reasons.map(r => `blocked:${r}`), ...j.review_reasons])],
      acknowledge_due: new Date(received.getTime() + P.sla.acknowledge_hours * 3600e3).toISOString(),
      resolve_due: new Date(received.getTime() + days * 86400e3).toISOString(),
      llm_usage: null,
      ai_finished_at: null,
    },
    pairedItem: { item: i },
  };
});
