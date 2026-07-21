import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { DocumentData } from '../types';
import { documentTotal, lineAmount } from '../types';
import { formatMoney, safeUrl } from './format';

type AutoTableDoc = jsPDF & {
  lastAutoTable?: { finalY: number };
};

function titleFor(type: DocumentData['type']): string {
  return type === 'PI' ? 'PROFORMA INVOICE' : 'COMMERCIAL INVOICE';
}

export async function exportPdf(doc: DocumentData): Promise<void> {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const margin = 14;
  let y = 16;

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(16);
  pdf.setTextColor(15, 45, 58);
  pdf.text(titleFor(doc.type), margin, y);

  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(80, 90, 95);
  pdf.text(`No. ${doc.number}`, pageWidth - margin, y, { align: 'right' });
  y += 6;
  pdf.text(`Date: ${doc.date}`, pageWidth - margin, y, { align: 'right' });
  y += 10;

  const colW = (pageWidth - margin * 2 - 8) / 2;
  drawPartyBlock(pdf, 'Seller / Exporter', doc.seller, margin, y, colW);
  drawPartyBlock(pdf, 'Buyer / Consignee', doc.buyer, margin + colW + 8, y, colW);
  y += 42;

  pdf.setDrawColor(210, 218, 220);
  pdf.setFillColor(245, 248, 249);
  pdf.roundedRect(margin, y, pageWidth - margin * 2, 16, 2, 2, 'FD');
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  pdf.setTextColor(40, 50, 55);
  const leftTerms = [
    `Currency: ${doc.currency}`,
    doc.paymentTerms ? `Payment: ${doc.paymentTerms}` : '',
  ].filter(Boolean);
  const rightTerms = [
    doc.deliveryTerms ? `Delivery: ${doc.deliveryTerms}` : '',
    doc.validity ? `Validity: ${doc.validity}` : '',
  ].filter(Boolean);
  leftTerms.forEach((t, i) =>
    pdf.text(pdf.splitTextToSize(t, colW - 2)[0], margin + 3, y + 5.5 + i * 5),
  );
  rightTerms.forEach((t, i) =>
    pdf.text(pdf.splitTextToSize(t, colW - 2)[0], margin + colW + 8, y + 5.5 + i * 5),
  );
  y += 22;

  const body = doc.items.map((item, idx) => {
    const params = item.parameters.trim() || '—';
    return [
      String(idx + 1),
      `${item.name || '—'}${item.model ? `\nModel: ${item.model}` : ''}`,
      params,
      `${item.quantity} ${item.unit}`,
      formatMoney(item.unitPrice, doc.currency),
      formatMoney(lineAmount(item), doc.currency),
      '', // media links drawn in didDrawCell
    ];
  });

  autoTable(pdf, {
    startY: y,
    head: [['#', 'Description', 'Parameters', 'Qty', 'Unit Price', 'Amount', 'Media']],
    body,
    styles: {
      fontSize: 8,
      cellPadding: 2.2,
      valign: 'top',
      textColor: [30, 40, 45],
      lineColor: [220, 226, 228],
      lineWidth: 0.2,
      minCellHeight: 12,
    },
    headStyles: {
      fillColor: [15, 45, 58],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
    },
    columnStyles: {
      0: { cellWidth: 8 },
      1: { cellWidth: 38 },
      2: { cellWidth: 48 },
      3: { cellWidth: 18 },
      4: { cellWidth: 24 },
      5: { cellWidth: 24 },
      6: { cellWidth: 22 },
    },
    margin: { left: margin, right: margin },
    didDrawCell: (data) => {
      if (data.section !== 'body' || data.column.index !== 6) return;
      const item = doc.items[data.row.index];
      if (!item) return;
      const video = safeUrl(item.videoUrl);
      const image = safeUrl(item.imageUrl);
      const cell = data.cell;
      let linkY = cell.y + 4.5;
      pdf.setFontSize(7);

      if (video) {
        pdf.setTextColor(0, 102, 140);
        pdf.textWithLink('Watch video', cell.x + 1.5, linkY, { url: video });
        linkY += 4.2;
      }
      if (image) {
        pdf.setTextColor(0, 102, 140);
        pdf.textWithLink('View image', cell.x + 1.5, linkY, { url: image });
      }
      if (!video && !image) {
        pdf.setTextColor(140, 150, 155);
        pdf.text('—', cell.x + 1.5, linkY);
      }
    },
  });

  const tableDoc = pdf as AutoTableDoc;
  let afterY = (tableDoc.lastAutoTable?.finalY ?? y) + 8;

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(11);
  pdf.setTextColor(15, 45, 58);
  pdf.text(
    `Total: ${formatMoney(documentTotal(doc), doc.currency)}`,
    pageWidth - margin,
    afterY,
    { align: 'right' },
  );
  afterY += 10;

  if (doc.bankInfo.trim()) {
    afterY = ensureSpace(pdf, afterY, 28);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9);
    pdf.text('Bank Information', margin, afterY);
    afterY += 5;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(50, 60, 65);
    const bankLines = pdf.splitTextToSize(doc.bankInfo, pageWidth - margin * 2);
    pdf.text(bankLines, margin, afterY);
    afterY += bankLines.length * 4 + 4;
  }

  if (doc.notes.trim()) {
    afterY = ensureSpace(pdf, afterY, 24);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9);
    pdf.setTextColor(15, 45, 58);
    pdf.text('Notes', margin, afterY);
    afterY += 5;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(50, 60, 65);
    const noteLines = pdf.splitTextToSize(doc.notes, pageWidth - margin * 2);
    pdf.text(noteLines, margin, afterY);
    afterY += noteLines.length * 4 + 6;
  }

  const hasMedia = doc.items.some((i) => safeUrl(i.videoUrl) || safeUrl(i.imageUrl));
  if (hasMedia) {
    afterY = ensureSpace(pdf, afterY, 30);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9);
    pdf.setTextColor(15, 45, 58);
    pdf.text('Equipment Media Links (click to open)', margin, afterY);
    afterY += 6;

    for (let i = 0; i < doc.items.length; i++) {
      const item = doc.items[i];
      const video = safeUrl(item.videoUrl);
      const image = safeUrl(item.imageUrl);
      if (!video && !image) continue;

      afterY = ensureSpace(pdf, afterY, 16);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8);
      pdf.setTextColor(30, 40, 45);
      const label = `${i + 1}. ${item.name || 'Item'}${item.model ? ` (${item.model})` : ''}`;
      pdf.text(label, margin, afterY);
      afterY += 4.5;

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(7.5);
      pdf.setTextColor(0, 102, 140);
      if (video) {
        pdf.textWithLink(`Video: ${truncate(video, 90)}`, margin + 2, afterY, { url: video });
        afterY += 4;
      }
      if (image) {
        pdf.textWithLink(`Image: ${truncate(image, 90)}`, margin + 2, afterY, { url: image });
        afterY += 4;
      }
      afterY += 2;
    }
  }

  const pageCount = pdf.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    pdf.setPage(p);
    pdf.setFontSize(7);
    pdf.setTextColor(140, 150, 155);
    pdf.text(
      `${titleFor(doc.type)} ${doc.number}  ·  Page ${p}/${pageCount}`,
      pageWidth / 2,
      pdf.internal.pageSize.getHeight() - 8,
      { align: 'center' },
    );
  }

  pdf.save(`${doc.number || 'document'}.pdf`);
}

function drawPartyBlock(
  pdf: jsPDF,
  title: string,
  party: DocumentData['seller'],
  x: number,
  y: number,
  w: number,
): void {
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8);
  pdf.setTextColor(120, 130, 135);
  pdf.text(title.toUpperCase(), x, y);
  pdf.setTextColor(20, 35, 42);
  pdf.setFontSize(10);
  pdf.text(party.name || '—', x, y + 6);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  pdf.setTextColor(60, 70, 75);
  const lines: string[] = [];
  if (party.address) lines.push(...pdf.splitTextToSize(party.address, w));
  if (party.contact) lines.push(`Attn: ${party.contact}`);
  if (party.email) lines.push(party.email);
  if (party.phone) lines.push(party.phone);
  if (party.taxId) lines.push(`Tax ID: ${party.taxId}`);
  pdf.text(lines.slice(0, 6), x, y + 12);
}

function ensureSpace(pdf: jsPDF, y: number, need: number): number {
  const pageH = pdf.internal.pageSize.getHeight();
  if (y + need > pageH - 16) {
    pdf.addPage();
    return 16;
  }
  return y;
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}
