/**
 * Headless smoke test for Excel hyperlink export (no browser download).
 * Run: npx tsx scripts/smoke-export.ts
 */
import ExcelJS from 'exceljs';
import { createEmptyDocument, createLineItem } from '../src/types';
import { safeUrl } from '../src/lib/format';

async function main() {
  const doc = createEmptyDocument('PI');
  doc.seller.name = 'Test Seller';
  doc.buyer.name = 'Test Buyer';
  const item = createLineItem();
  item.name = 'Machine A';
  item.model = 'M-1';
  item.parameters = 'Power: 1kW';
  item.videoUrl = 'https://www.youtube.com/watch?v=test123';
  item.imageUrl = 'https://example.com/machine.jpg';
  item.unitPrice = 1000;
  item.quantity = 2;
  doc.items = [item];

  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet('Media Links');
  sheet.columns = [
    { header: 'Video', key: 'video', width: 40 },
    { header: 'Image', key: 'image', width: 40 },
  ];

  for (const row of doc.items) {
    const video = safeUrl(row.videoUrl);
    const image = safeUrl(row.imageUrl);
    const r = sheet.addRow({});
    if (video) {
      r.getCell(1).value = { text: 'Watch video', hyperlink: video };
    }
    if (image) {
      r.getCell(2).value = { text: 'View image', hyperlink: image };
    }
  }

  const buf = await wb.xlsx.writeBuffer();
  const read = new ExcelJS.Workbook();
  await read.xlsx.load(Buffer.from(buf));
  const media = read.getWorksheet('Media Links');
  if (!media) throw new Error('Media Links sheet missing');
  const v = media.getRow(2).getCell(1);
  const i = media.getRow(2).getCell(2);
  const vLink = (v.value as { hyperlink?: string } | null)?.hyperlink;
  const iLink = (i.value as { hyperlink?: string } | null)?.hyperlink;
  if (vLink !== item.videoUrl) throw new Error(`Video hyperlink mismatch: ${vLink}`);
  if (iLink !== item.imageUrl) throw new Error(`Image hyperlink mismatch: ${iLink}`);
  console.log('OK: Excel media hyperlinks round-trip');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
