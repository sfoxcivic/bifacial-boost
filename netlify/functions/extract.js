import pdfParse from 'pdf-parse';

export const handler = async (event) => {
  try {
    const body = JSON.parse(event.body);
    const fileBase64 = body.file;
    const pdfBuffer = Buffer.from(fileBase64, "base64");

    const data = await pdfParse(pdfBuffer);
    const text = data.text;

    return {
      statusCode: 200,
      body: JSON.stringify({ extractedText: text.slice(0, 500) })
    };

  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
