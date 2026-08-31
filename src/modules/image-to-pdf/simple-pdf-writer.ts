import { PdfImagePage } from './pdf-types';

const encoder = new TextEncoder();

function ascii(value: string) {
  return encoder.encode(value);
}

function concat(parts: Uint8Array[]) {
  const total = parts.reduce((sum, part) => sum + part.byteLength, 0);
  const output = new Uint8Array(total);
  let offset = 0;

  for (const part of parts) {
    output.set(part, offset);
    offset += part.byteLength;
  }

  return output;
}

function regularObject(id: number, body: string) {
  return ascii(`${id} 0 obj\n${body}\nendobj\n`);
}

function streamObject(id: number, dictionary: string, data: Uint8Array) {
  return concat([
    ascii(`${id} 0 obj\n${dictionary}\nstream\n`),
    data,
    ascii('\nendstream\nendobj\n'),
  ]);
}

function fixed(value: number) {
  return Number(value.toFixed(3)).toString();
}

export function buildImagePdf(pages: PdfImagePage[]) {
  if (!pages.length || pages.length > 20) {
    throw new Error('PDF page count is outside the supported range.');
  }

  const pageIds = pages.map((_, index) => 3 + index * 3);
  const objects = new Map<number, Uint8Array>();

  objects.set(1, regularObject(1, '<< /Type /Catalog /Pages 2 0 R >>'));
  objects.set(
    2,
    regularObject(
      2,
      `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pages.length} >>`,
    ),
  );

  pages.forEach((page, index) => {
    const pageId = 3 + index * 3;
    const contentId = pageId + 1;
    const imageId = pageId + 2;

    const content = ascii(
      `q\n${fixed(page.drawWidthPt)} 0 0 ${fixed(page.drawHeightPt)} ${fixed(page.drawXPt)} ${fixed(page.drawYPt)} cm\n/Im0 Do\nQ\n`,
    );

    objects.set(
      pageId,
      regularObject(
        pageId,
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${fixed(page.pageWidthPt)} ${fixed(page.pageHeightPt)}] /Resources << /XObject << /Im0 ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>`,
      ),
    );

    objects.set(
      contentId,
      streamObject(contentId, `<< /Length ${content.byteLength} >>`, content),
    );

    objects.set(
      imageId,
      streamObject(
        imageId,
        `<< /Type /XObject /Subtype /Image /Width ${page.widthPx} /Height ${page.heightPx} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${page.jpeg.byteLength} >>`,
        page.jpeg,
      ),
    );
  });

  const size = 3 + pages.length * 3;
  const header = ascii('%PDF-1.4\n%Tayar\n');
  const bodyParts: Uint8Array[] = [header];
  const offsets = new Array<number>(size).fill(0);
  let offset = header.byteLength;

  for (let id = 1; id < size; id += 1) {
    const object = objects.get(id);
    if (!object) throw new Error('PDF object table is incomplete.');
    offsets[id] = offset;
    bodyParts.push(object);
    offset += object.byteLength;
  }

  const xrefOffset = offset;
  const xrefLines = [
    `xref\n0 ${size}\n`,
    '0000000000 65535 f \n',
    ...offsets.slice(1).map((value) => `${String(value).padStart(10, '0')} 00000 n \n`),
  ];

  const trailer = [
    ...xrefLines,
    `trailer\n<< /Size ${size} /Root 1 0 R >>\n`,
    `startxref\n${xrefOffset}\n%%EOF\n`,
  ].join('');

  bodyParts.push(ascii(trailer));
  return new Blob(bodyParts, { type: 'application/pdf' });
}
