// ================== DETECT & CLASSIFY ==================
// Finds personal data (checksum-validated where possible), sensitive context
// and prompt-injection attempts BEFORE any AI sees the message.
return $input.all().map((item, i) => {
  const j = item.json;
  const names = j.customer_name ? [j.customer_name, ...j.customer_name.split(/\s+/)] : [];
  const detections = LIB.detect(j.text, names);
  const sens = LIB.sensitive(j.text);
  const injection = LIB.INJECTION.test(j.text);
  const counts = detections.reduce((a, d) => (a[d.cls] = (a[d.cls] || 0) + 1, a), {});
  return {
    json: {
      ...j,
      detections,                 // raw values: stay inside the firewall, never logged
      detected_classes: counts,
      sensitive_context: sens,
      injection_suspected: injection,
      input_hash: LIB.sha256(j.text),
    },
    pairedItem: { item: i },
  };
});
