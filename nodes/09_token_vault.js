// ================== TOKEN VAULT ==================
// The only place raw identifiers live, keyed by message + token.
// Restrict access (separate sheet/DB, least privilege). Redacted classes never land here.
const out = [];
$input.all().forEach((item, i) => {
  const j = item.json;
  for (const v of j.vault) {
    out.push({
      json: {
        message_id: j.message_id,
        token: v.token,
        data_class: v.data_class,
        value: v.value,
        created_at: new Date().toISOString(),
        retention_until: new Date(Date.now() + 7 * 365 * 86400e3).toISOString(),
      },
      pairedItem: { item: i },
    });
  }
});
return out;
