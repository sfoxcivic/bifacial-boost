import pdfParse from 'pdf-parse';

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

    // small helper to find numeric after a label
    const extractValue = (labels) => {
      for (const label of labels) {
        const re = new RegExp(label + '[^\\d\\n\\r]{0,20}?(\\d{1,3}\\.\\d{1,3}|\\d{1,3})', 'i');
        const m = text.match(re);
        if (m && m[1]) {
          return parseFloat(m[1]);
        }
      }
      return null;
    };

    const Isc = extractValue(['Isc', 'Isc\\s*\\(A\\)', 'Short circuit current', 'I sc']);
    const Imp = extractValue(['Imp', 'Imp\\s*\\(A\\)', 'Max power current', 'I mp', 'I\\s*mp']);
    const fuse = extractValue(['Maximum series fuse', 'Max series fuse', 'Max Fuse', 'Max fuse rating']);

    const bifacialNote = /bifacial/i.test(text);

    return {
      statusCode: 200,
      body: JSON.stringify({
        Isc, Imp, fuse, bifacialNote, extractedText: text.slice(0, 2000), raw: text.slice(0,2000)
      })
    };

  } catch (err) {
    console.error('extract error', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
