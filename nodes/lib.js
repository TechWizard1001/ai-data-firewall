// ===== Shared governance library (inlined into each node by the build) =====
const LIB = (() => {
  const luhn = (s) => {
    const d = s.replace(/\D/g, '');
    if (d.length < 13 || d.length > 19) return false;
    let sum = 0, alt = false;
    for (let i = d.length - 1; i >= 0; i--) {
      let n = +d[i];
      if (alt) { n *= 2; if (n > 9) n -= 9; }
      sum += n; alt = !alt;
    }
    return sum % 10 === 0;
  };
  const tfn = (s) => {
    const d = s.replace(/\D/g, ''); const w = [1, 4, 3, 7, 5, 8, 6, 9, 10];
    return d.length === 9 && d.split('').reduce((a, x, i) => a + +x * w[i], 0) % 11 === 0;
  };
  const medicare = (s) => {
    const d = s.replace(/\D/g, ''); const w = [1, 3, 7, 9, 1, 3, 7, 9];
    if (d.length < 10 || d.length > 11) return false;
    return d.slice(0, 8).split('').reduce((a, x, i) => a + +x * w[i], 0) % 10 === +d[8];
  };

  // Order = priority when matches overlap (earlier wins)
  const DETECTORS = [
    { cls: 'CARD_NUMBER', re: /\b(?:\d[ -]?){12,18}\d\b/g, ok: luhn },
    { cls: 'MEDICARE', re: /\b[2-6]\d{3}[ ]?\d{5}[ ]?\d(?:[ -]?\d)?\b/g, ok: medicare },
    { cls: 'TFN', re: /\b\d{3}[ -]?\d{3}[ -]?\d{3}\b/g, ok: tfn },
    { cls: 'BSB', re: /\bBSB\s*:?\s*(\d{3}[- ]?\d{3})\b/gi, group: 1 },
    { cls: 'ACCOUNT_NUMBER', re: /\b(?:account|acct|acc)\s*(?:no\.?|number|#)?\s*:?\s*(\d{6,10})\b/gi, group: 1 },
    { cls: 'EMAIL', re: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g },
    { cls: 'PHONE', re: /(?<!\d)(?:\+61[ ]?|0)(?:4\d{2}[ ]?\d{3}[ ]?\d{3}|[2378][ ]?\d{4}[ ]?\d{4})(?!\d)/g },
    { cls: 'DATE_OF_BIRTH', re: /\b(?:DOB|D\.O\.B\.?|date of birth|born on)\s*:?\s*(\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4})/gi, group: 1 },
    { cls: 'ADDRESS', re: /\b\d{1,5}[A-Za-z]?\s+(?:[A-Z][a-z]+\s){1,3}(?:St|Street|Rd|Road|Ave|Avenue|Ct|Court|Pl|Place|Dr|Drive|Cres|Crescent|Way|Lane|Ln|Bvd|Boulevard|Pde|Parade|Tce|Terrace)\b\.?(?:,?\s+[A-Z][a-z]+(?:\s[A-Z][a-z]+)?)?(?:,?\s+(?:VIC|NSW|QLD|SA|WA|TAS|NT|ACT))?(?:\s+\d{4})?/g },
    { cls: 'PERSON_NAME', re: /\b(?:my name is|name\s*:)\s*([A-Z][a-z]+(?:\s[A-Z][a-z'-]+)?)/g, group: 1 },
    { cls: 'PERSON_NAME', re: /(?:regards|thanks|thank you|cheers|sincerely)[,!.]?[ \t]*\r?\n+[ \t]*([A-Z][a-z]+(?:[ \t][A-Z][a-z'-]+)?)[ \t]*$/gim, group: 1 },
  ];

  const SENSITIVE = [
    { cat: 'CRISIS', re: /\b(end (my|it all)|kill myself|suicid\w*|no reason to (live|go on)|take my own life)\b/i },
    { cat: 'FAMILY_VIOLENCE', re: /\b(family violence|domestic violence|abusive (partner|husband|wife|ex)|intervention order|AVO|coercive control|scared of (him|her|my (ex|partner|husband|wife)))\b/i },
    { cat: 'ELDER_FINANCIAL_ABUSE', re: /\b(power of attorney|(son|daughter|grandson|granddaughter|carer|nephew) (has been|keeps|is) (taking|using|withdrawing)|without my (permission|knowledge))\b/i },
    { cat: 'HEALTH', re: /\b(cancer|chemo\w*|diagnos\w*|hospital\w*|surgery|mental health|depress\w*|anxiety|disabilit\w*|medication|terminal|illness|NDIS)\b/i },
    { cat: 'FINANCIAL_HARDSHIP', re: /\b(hardship|can'?t (afford|pay|make)|lost my job|made redundant|behind on (my )?(payments|repayments|rent|mortgage)|missed (a |my )?(payment|repayment)s?|struggling (to pay|financially)|centrelink)\b/i },
    { cat: 'GAMBLING', re: /\b(gambling|pokies|betting (app|account|problem)|sportsbet|addicted to bet\w*)\b/i },
    { cat: 'BEREAVEMENT', re: /\b(passed away|died|deceased( estate)?|funeral|bereave\w*)\b/i },
  ];

  const INJECTION = /\b(ignore (all |any )?(the )?(previous|prior|above) (instructions|rules)|disregard (the|your|all) (rules|instructions|policy)|you are now|system prompt|act as (an?|the) |reveal (your|the) (prompt|instructions)|developer mode)\b/i;

  function detect(text, knownNames = []) {
    const raw = [];
    DETECTORS.forEach((d, pri) => {
      d.re.lastIndex = 0; let m;
      while ((m = d.re.exec(text)) !== null) {
        const val = d.group ? m[d.group] : m[0];
        if (!val) continue;
        const start = m.index + (d.group ? m[0].indexOf(val) : 0);
        const v = val.trim();
        if (d.ok && !d.ok(v)) continue;
        raw.push({ cls: d.cls, start, end: start + v.length, value: v, pri });
      }
    });
    knownNames.filter(n => n && n.length > 2).forEach(n => {
      const esc = n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp(`\\b${esc}\\b`, 'g'); let m;
      while ((m = re.exec(text)) !== null) raw.push({ cls: 'PERSON_NAME', start: m.index, end: m.index + n.length, value: n, pri: 50 });
    });
    raw.sort((a, b) => a.pri - b.pri || (b.end - b.start) - (a.end - a.start));
    const kept = [];
    for (const r of raw) if (!kept.some(k => r.start < k.end && k.start < r.end)) kept.push(r);
    return kept.sort((a, b) => a.start - b.start).map(({ pri, ...r }) => r);
  }

  function sensitive(text) {
    return SENSITIVE.map(s => { const m = text.match(s.re); return m ? { category: s.cat, cue: m[0] } : null; }).filter(Boolean);
  }

  // Compact pure-JS SHA-256 (no require() needed, works on n8n Cloud)
  function sha256(ascii) {
    const rr = (v, a) => (v >>> a) | (v << (32 - a));
    const K = [], H = []; let p = 2, n = 0;
    const isP = (x) => { for (let f = 2; f * f <= x; f++) if (x % f === 0) return false; return true; };
    while (n < 64) { if (isP(p)) { if (n < 8) H[n] = (Math.pow(p, 1 / 2) * 4294967296) | 0; K[n++] = (Math.pow(p, 1 / 3) * 4294967296) | 0; } p++; }
    const bytes = unescape(encodeURIComponent(ascii)); const l = bytes.length * 8;
    let s = bytes + '\x80'; while (s.length % 64 - 56) s += '\x00';
    const w = []; for (let i = 0; i < s.length; i++) w[i >> 2] |= s.charCodeAt(i) << ((3 - i) % 4) * 8;
    w[w.length] = (l / 4294967296) | 0; w[w.length] = l;
    let h = H.slice();
    for (let j = 0; j < w.length; j += 16) {
      const W = w.slice(j, j + 16); const old = h.slice();
      for (let i = 0; i < 64; i++) {
        const w15 = W[i - 15], w2 = W[i - 2];
        if (i >= 16) W[i] = (W[i - 16] + (rr(w15, 7) ^ rr(w15, 18) ^ (w15 >>> 3)) + W[i - 7] + (rr(w2, 17) ^ rr(w2, 19) ^ (w2 >>> 10))) | 0;
        const a = h[0], e = h[4];
        const t1 = h[7] + (rr(e, 6) ^ rr(e, 11) ^ rr(e, 25)) + ((e & h[5]) ^ (~e & h[6])) + K[i] + (W[i] | 0);
        const t2 = (rr(a, 2) ^ rr(a, 13) ^ rr(a, 22)) + ((a & h[1]) ^ (a & h[2]) ^ (h[1] & h[2]));
        h = [(t1 + t2) | 0].concat(h); h[4] = (h[4] + t1) | 0; h.length = 8;
      }
      h = h.map((x, i) => (x + old[i]) | 0);
    }
    return h.map(x => (x >>> 0).toString(16).padStart(8, '0')).join('');
  }

  return { detect, sensitive, INJECTION, sha256 };
})();
