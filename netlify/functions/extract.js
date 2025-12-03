import pdfParse from 'pdf-parse';

const NOISE_KEYWORDS = ['bifacial', 'bifi', 'rear', 'gain', 'boost'];

function containsNoise(line) {
  const l = (line || '').toLowerCase();
  return NOISE_KEYWORDS.some(k => l.includes(k));
}

export const handler = async (event) => {
  try {
    if (!event.body) {
      return { statusCode: 400, body: JSON.stringify({ error: 'No body' }) };
    }
    const payload = JSON.parse(event.body);
    const fileBase64 = payload.file;
    if (!fileBase64) {
      return { statusCode: 400, body: JSON.stringify({ error: 'No file provided' }) };
    }

    const pdfBuffer = Buffer.from(fileBase64, 'base64');
    const data = await pdfParse(pdfBuffer);
    const text = (data.text || '').replace(/\u00A0/g, ' ');

    // Split into lines, filter out empty and noise-only lines
    const rawLines = text.split(/\r?\n/).map(s => s.trim()).filter(s => s.length > 0);
    const lines = rawLines.filter(l => !containsNoise(l)); // remove lines mentioning bifacial/boost

    const modules = [];

    // Strategy A: look for tabular rows: modelString  Pmax  Voc  Isc  Vmp  Imp  (common layout)
    const tableRowRegex = /([A-Z0-9\-]{6,})\s+(\d{3,4})\s+(\d{1,3}\.\d+)\s+(\d{1,3}\.\d+)\s+(\d{1,3}\.\d+)\s+(\d{1,3}\.\d+)/i;
    for (const line of lines) {
      const m = line.match(tableRowRegex);
      if (m) {
        const model = m[1];
        const watts = parseInt(m[2], 10);
        const isc = parseFloat(m[4]);
        const imp = parseFloat(m[6]);
        modules.push({ model, watts, isc, imp });
      }
    }

    // Strategy B: fallback scanning for blocks where Pmax/XW appears then find nearby Isc/Imp
    if (modules.length === 0) {
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const pmaxMatch = line.match(/(Pmax|Maximum Power|Max Power|Power Max)[:\s]*?(\d{3,4})\s*W?/i);
        const wattOnly = line.match(/^(\d{3,4})\s*W$/i) || line.match(/\b(\d{3,4})W\b/i);
        if (pmaxMatch || wattOnly) {
          const watts = pmaxMatch ? parseInt(pmaxMatch[2],10) : parseInt((wattOnly[1] || wattOnly[0]).replace(/\D/g,''),10);
          let model = null;
          for (let j = Math.max(0, i-3); j <= i; j++) {
            const cand = lines[j];
            if (/[A-Z0-9\-]{6,}/.test(cand) && !/VOC|Isc|Imp|Vmp|Pmax/i.test(cand)) {
              model = cand.split(/\s+/)[0];
              break;
            }
          }
          let isc = null, imp = null, fuse = null;
          for (let k = i; k < Math.min(lines.length, i+8); k++) {
            const l = lines[k];
            const iscMatch = l.match(/Isc[^\d\n\r:]*?(\d{1,3}\.\d{1,3}|\d{1,3})/i);
            if (iscMatch && !isc) isc = parseFloat(iscMatch[1]);
            const impMatch = l.match(/Imp[^\d\n\r:]*?(\d{1,3}\.\d{1,3}|\d{1,3})/i);
            if (impMatch && !imp) imp = parseFloat(impMatch[1]);
            const fuseMatch = l.match(/(Max(imum)?\s+Series\s+Fuse|Max\s+Fuse)[^\d]*(\d{1,3}(?:\.\d+)?)/i);
            if (fuseMatch && !fuse) fuse = parseFloat(fuseMatch[2]);
          }
          modules.push({ model, watts, isc, imp, fuse });
        }
      }
    }

    // De-duplicate modules by watts+model
    const unique = [];
    const seen = new Set();
    for (const m of modules) {
      const key = (m.watts || 'NA') + '|' + (m.model || '');
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(m);
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        modules: unique,
        raw: text.slice(0,2000),
        extractedText: text.slice(0,2000)
      })
    };

  } catch (err) {
    console.error('extract error', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
