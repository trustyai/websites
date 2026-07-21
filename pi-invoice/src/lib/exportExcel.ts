import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import type { DocumentData } from '../types';
import { documentTotal, lineAmount } from '../types';
import { safeUrl } from './format';

function titleFor(type: DocumentData['type']): string {
  return type === 'PI' ? 'PROFORMA INVOICE' : 'COMMERCIAL INVOICE';
}

export async function exportExcel(doc: DocumentData): Promise<void> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'PI & Invoice Studio';
  wb.created = new Date();

  const sheet = wb.addWorksheet(doc.type === 'PI' ? 'Proforma Invoice' : 'Invoice', {
    views: [{ showGridLines: false }],
  });

  sheet.columns = [
    { key: 'a', width: 6 },
    { key: 'b', width: 26 },
    { key: 'c', width: 34 },
    { key: 'd', width: 10 },
    { key: 'e', width: 10 },
    { key: 'f', width: 12 },
    { key: 'g', width: 12 },
    { key: 'h', width: 22 },
    { key: 'i', width: 22 },
  ];

  const brand = '0F2D3A';
  const muted = '5A6469';
  const linkBlue = '00668C';

  // Title
  sheet.mergeCells('A1:I1');
  const title = sheet.getCell('A1');
  title.value = titleFor(doc.type);
  title.font = { name: 'Calibri', size: 18, bold: true, color: { argb: brand } };
  title.alignment = { vertical: 'middle' };
  sheet.getRow(1).height = 28;

  sheet.getCell('A2').value = `No. ${doc.number}`;
  sheet.getCell('A2').font = { color: { argb: muted }, size: 11 };
  sheet.getCell('E2').value = `Date: ${doc.date}`;
  sheet.getCell('E2').font = { color: { argb: muted }, size: 11 };

  // Parties
  sheet.getCell('A4').value = 'SELLER / EXPORTER';
  sheet.getCell('A4').font = { bold: true, size: 9, color: { argb: muted } };
  sheet.getCell('E4').value = 'BUYER / CONSIGNEE';
  sheet.getCell('E4').font = { bold: true, size: 9, color: { argb: muted } };

  sheet.mergeCells('A5:C5');
  sheet.getCell('A5').value = doc.seller.name || '—';
  sheet.getCell('A5').font = { bold: true, size: 12, color: { argb: brand } };
  sheet.mergeCells('E5:I5');
  sheet.getCell('E5').value = doc.buyer.name || '—';
  sheet.getCell('E5').font = { bold: true, size: 12, color: { argb: brand } };

  const sellerLines = [
    doc.seller.address,
    doc.seller.contact && `Attn: ${doc.seller.contact}`,
    doc.seller.email,
    doc.seller.phone,
    doc.seller.taxId && `Tax ID: ${doc.seller.taxId}`,
  ]
    .filter(Boolean)
    .join('\n');
  const buyerLines = [
    doc.buyer.address,
    doc.buyer.contact && `Attn: ${doc.buyer.contact}`,
    doc.buyer.email,
    doc.buyer.phone,
    doc.buyer.taxId && `Tax ID: ${doc.buyer.taxId}`,
  ]
    .filter(Boolean)
    .join('\n');

  sheet.mergeCells('A6:C8');
  sheet.getCell('A6').value = sellerLines;
  sheet.getCell('A6').alignment = { wrapText: true, vertical: 'top' };
  sheet.mergeCells('E6:I8');
  sheet.getCell('E6').value = buyerLines;
  sheet.getCell('E6').alignment = { wrapText: true, vertical: 'top' };

  // Terms
  sheet.getCell('A10').value = `Currency: ${doc.currency}`;
  sheet.getCell('C10').value = doc.paymentTerms ? `Payment: ${doc.paymentTerms}` : '';
  sheet.getCell('A11').value = doc.deliveryTerms ? `Delivery: ${doc.deliveryTerms}` : '';
  sheet.getCell('C11').value = doc.validity ? `Validity: ${doc.validity}` : '';
  ['A10', 'C10', 'A11', 'C11'].forEach((addr) => {
    sheet.getCell(addr).font = { size: 10, color: { argb: muted } };
  });

  // Header row
  const headerRow = 13;
  const headers = [
    '#',
    'Description',
    'Parameters',
    'Qty',
    'Unit',
    'Unit Price',
    'Amount',
    'Video (click)',
    'Image (click)',
  ];
  headers.forEach((h, i) => {
    const cell = sheet.getCell(headerRow, i + 1);
    cell.value = h;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: brand } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  });
  sheet.getRow(headerRow).height = 22;

  let row = headerRow + 1;
  doc.items.forEach((item, idx) => {
    const desc = [item.name || '—', item.model ? `Model: ${item.model}` : '', item.remarks]
      .filter(Boolean)
      .join('\n');

    sheet.getCell(row, 1).value = idx + 1;
    sheet.getCell(row, 2).value = desc;
    sheet.getCell(row, 2).alignment = { wrapText: true, vertical: 'top' };
    sheet.getCell(row, 3).value = item.parameters || '—';
    sheet.getCell(row, 3).alignment = { wrapText: true, vertical: 'top' };
    sheet.getCell(row, 4).value = item.quantity;
    sheet.getCell(row, 5).value = item.unit;
    sheet.getCell(row, 6).value = item.unitPrice;
    sheet.getCell(row, 6).numFmt = '#,##0.00';
    sheet.getCell(row, 7).value = lineAmount(item);
    sheet.getCell(row, 7).numFmt = '#,##0.00';

    const video = safeUrl(item.videoUrl);
    const image = safeUrl(item.imageUrl);
    const videoCell = sheet.getCell(row, 8);
    const imageCell = sheet.getCell(row, 9);

    if (video) {
      videoCell.value = { text: 'Watch video', hyperlink: video };
      videoCell.font = { color: { argb: linkBlue }, underline: true, size: 10 };
    } else {
      videoCell.value = '—';
    }

    if (image) {
      imageCell.value = { text: 'View image', hyperlink: image };
      imageCell.font = { color: { argb: linkBlue }, underline: true, size: 10 };
    } else {
      imageCell.value = '—';
    }

    const paramLines = (item.parameters || '').split('\n').length;
    const descLines = desc.split('\n').length;
    sheet.getRow(row).height = Math.max(36, Math.min(90, Math.max(paramLines, descLines) * 14 + 8));

    if (idx % 2 === 1) {
      for (let c = 1; c <= 9; c++) {
        sheet.getCell(row, c).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF5F8F9' },
        };
      }
    }

    row += 1;
  });

  // Total
  row += 1;
  sheet.getCell(row, 6).value = 'Total';
  sheet.getCell(row, 6).font = { bold: true, size: 12, color: { argb: brand } };
  sheet.getCell(row, 7).value = documentTotal(doc);
  sheet.getCell(row, 7).numFmt = `"${doc.currency}" #,##0.00`;
  sheet.getCell(row, 7).font = { bold: true, size: 12, color: { argb: brand } };

  // Media link sheet — one row per item with explicit clickable URLs
  const mediaSheet = wb.addWorksheet('Media Links');
  mediaSheet.columns = [
    { header: '#', key: 'idx', width: 6 },
    { header: 'Product', key: 'name', width: 28 },
    { header: 'Model', key: 'model', width: 18 },
    { header: 'Video Link (click)', key: 'video', width: 50 },
    { header: 'Image Link (click)', key: 'image', width: 50 },
  ];
  mediaSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  mediaSheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: brand },
  };

  doc.items.forEach((item, idx) => {
    const r = mediaSheet.addRow({
      idx: idx + 1,
      name: item.name || '—',
      model: item.model || '',
      video: '',
      image: '',
    });
    const video = safeUrl(item.videoUrl);
    const image = safeUrl(item.imageUrl);
    if (video) {
      const cell = r.getCell(4);
      cell.value = { text: video, hyperlink: video };
      cell.font = { color: { argb: linkBlue }, underline: true };
    }
    if (image) {
      const cell = r.getCell(5);
      cell.value = { text: image, hyperlink: image };
      cell.font = { color: { argb: linkBlue }, underline: true };
    }
  });

  // Bank / notes
  row += 2;
  if (doc.bankInfo.trim()) {
    sheet.getCell(row, 1).value = 'Bank Information';
    sheet.getCell(row, 1).font = { bold: true, color: { argb: brand } };
    row += 1;
    sheet.mergeCells(row, 1, row + 2, 9);
    sheet.getCell(row, 1).value = doc.bankInfo;
    sheet.getCell(row, 1).alignment = { wrapText: true, vertical: 'top' };
    row += 4;
  }
  if (doc.notes.trim()) {
    sheet.getCell(row, 1).value = 'Notes';
    sheet.getCell(row, 1).font = { bold: true, color: { argb: brand } };
    row += 1;
    sheet.mergeCells(row, 1, row + 1, 9);
    sheet.getCell(row, 1).value = doc.notes;
    sheet.getCell(row, 1).alignment = { wrapText: true, vertical: 'top' };
  }

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  saveAs(blob, `${doc.number || 'document'}.xlsx`);
}
