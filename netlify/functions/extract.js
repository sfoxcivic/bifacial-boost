import pdfParse from 'pdf-parse';

function findHeaderLine(lines) {
  // header: sequence of >=3 numbers of 3-4 digits (watts) possibly with W or Wp
  const headerRe = /(?:\b\d{3,4}\b\s+){2,}\b\d{3,4}\b/;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].replace(/,/g, ' ');
    if (headerRe.test(l) && /Wp|W\b|Pmax|Maximum Power/i.test(l) ) {
      // extract numbers
      const nums = Array.from(l.matchAll(/\b(\d{3,4})\b/g)).map(m => parseInt(m[1],10));
      if (nums.length >= 3) return {index: i, values: nums};
    }
  }
  // fallback: find any line with >=3 numbers and return
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].replace(/,/g,' ');
    const nums = Array.from(l.matchAll(/\b(\d{3,4})\b/g)).map(m => parseInt(m[1],10));
    if (nums.length >= 3) return {index: i, values: nums};
  }
  return null;
}

function extractRowValues(line) {
  // find floats in line
  const vals = Array.from(line.matchAll(/(\d{1,3}\.\d{1,3}|\d{1,3})/g)).map(m => m[0]);
  return vals;
}

export const handler = async (event) => {
  try {
    if (!event.body) return { statusCode: 400, body: JSON.stringify({ error: 'No body' }) };
    const payload = JSON.parse(event.body);
    const fileBase64 = payload.file;
    if (!fileBase64) return { statusCode: 400, body: JSON.stringify({ error: 'No file provided' }) };

    const pdfBuffer = Buffer.from(fileBase64, 'base64');
    const data = await pdfParse(pdfBuffer);
    const text = (data.text || '').replace(/\u00A0/g, ' ');

    const rawLines = text.split(/\r?\n/).map(s => s.trim()).filter(s => s.length > 0);
    // remove obvious noise lines like irradiance or percent signs in header
    const filtered = rawLines.filter(l => !/W\/m|W\/m2|Irradiance|\%\/°C|%/i.test(l));

    const header = findHeaderLine(filtered);
    if (!header) {
      return { statusCode: 200, body: JSON.stringify({ modules: [], raw: text.slice(0,2000), extractedText: text.slice(0,2000) }) };
    }

    const watts = header.values; // array of watt numbers
    const modules = watts.map(w => ({ watts: w, model: null, isc: null, imp: null }));

    // search for lines containing 'Maximum Power Current' or 'Short-circuit Current'
    for (const line of filtered) {
      if (/Maximum Power Current|Maximum Power Current - Imp|Power Current - Imp|I mp|Imp/i.test(line)) {
        const vals = extractRowValues(line);
        // try to map last N numbers to watts length
        const nums = vals.map(v => parseFloat(v));
        if (nums.length >= watts.length) {
          const tail = nums.slice(-watts.length);
          for (let i = 0; i < watts.length; i++) modules[i].imp = tail[i];
        }
      } else if (/Short-?circuit Current|Short circuit current|Isc/i.test(line)) {
        const vals = extractRowValues(line);
        const nums = vals.map(v => parseFloat(v));
        if (nums.length >= watts.length) {
          const tail = nums.slice(-watts.length);
          for (let i = 0; i < watts.length; i++) modules[i].isc = tail[i];
        }
      } else if (/Maximum Power Voltage|Vmp/i.test(line)) {
        // ignore for now
      }
    }

    // attach models if possible (look for a line above header that contains model strings)
    // look up to 3 lines above header index for model names
    const headerIdx = filtered.indexOf(filtered[header.index]);
    for (let j = Math.max(0, headerIdx-3); j < headerIdx; j++) {
      const cand = filtered[j];
      // split tokens and look for tokens with letters and digits (likely model)
      const toks = cand.split(/\s+/);
      for (const t of toks) {
        if (/[A-Z0-9\-]{6,}/.test(t) && !/Maximum|Power|Voltage|Current/i.test(t)) {
          // assign same model to all entries (best-effort)
          modules.forEach(m => m.model = t);
          break;
        }
      }
      if (modules[0].model) break;
    }

    return { statusCode: 200, body: JSON.stringify({ modules, raw: text.slice(0,2000), extractedText: text.slice(0,2000) }) };

  } catch (err) {
    console.error('extract error', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
