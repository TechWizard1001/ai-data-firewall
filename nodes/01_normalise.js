// Normalise every inbound channel into one envelope.
// Works for webhook payloads (body may be one message or {messages:[...]}) and the demo loader.
const out = [];
$input.all().forEach((item, i) => {
  const src = item.json.body ?? item.json;
  const msgs = Array.isArray(src.messages) ? src.messages : [src];
  msgs.forEach((m, j) => {
    const text = String(m.text ?? m.message ?? '').trim();
    out.push({
      json: {
        message_id: m.message_id || `MSG-${Date.now().toString(36)}-${i}${j}${Math.random().toString(36).slice(2, 6)}`,
        channel: m.channel || 'webhook',
        received_at: m.received_at || new Date().toISOString(),
        customer_ref: m.customer_ref || null,
        customer_name: m.customer_name || null,
        purpose: m.purpose || 'complaint_triage',
        text: text.slice(0, 8000),
        truncated: text.length > 8000,
      },
      pairedItem: { item: i },
    });
  });
});
return out.filter(o => o.json.text.length > 0);
