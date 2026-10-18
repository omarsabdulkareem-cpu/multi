import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export interface ReportPdfOptions {
  fileName?: string;
  landscape?: boolean;
  scale?: number;
  reportTitle?: string;
  documentNumber?: string;
  author?: string;
}

/**
 * Renders an HTML element onto high-resolution canvas and compiles a multi-page A4 PDF using jsPDF.
 * Preserves Arabic glyphs, RTL direction, badges, tables, barcodes, and styles accurately.
 */
export async function generateReportPdfFromElement(
  element: HTMLElement,
  options: ReportPdfOptions = {}
): Promise<void> {
  const isLandscape = options.landscape ?? false;
  const orientation = isLandscape ? 'landscape' : 'portrait';
  const fileName =
    options.fileName ||
    `AL_KARWAN_OPERATIONS_REPORT_${new Date().toISOString().slice(0, 10)}.pdf`;

  // Capture element using html2canvas with sharp print resolution
  const canvas = await html2canvas(element, {
    scale: options.scale ?? 2, // 2x for sharp print quality
    useCORS: true,
    logging: false,
    backgroundColor: '#ffffff',
    windowWidth: isLandscape ? 1400 : 1200,
  });

  const pdf = new jsPDF({
    orientation,
    unit: 'mm',
    format: 'a4',
  });

  // Set document metadata in jsPDF
  if (options.reportTitle) {
    pdf.setProperties({
      title: options.reportTitle,
      subject: options.documentNumber || 'Factory Daily Operations Report',
      author: options.author || 'Al-Karwan Plastic Industry ERP',
      creator: 'jsPDF Client Engine',
    });
  }

  // A4 dimensions in mm:
  // Portrait: 210 x 297 mm
  // Landscape: 297 x 210 mm
  const pageWidth = isLandscape ? 297 : 210;
  const pageHeight = isLandscape ? 210 : 297;

  const imgWidth = pageWidth;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  let heightLeft = imgHeight;
  let position = 0;

  // First page
  pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
  heightLeft -= pageHeight;

  // Additional pages if content exceeds A4 height
  while (heightLeft > 0) {
    position = -(imgHeight - heightLeft);
    pdf.addPage();
    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
    heightLeft -= pageHeight;
  }

  // Save the PDF
  pdf.save(fileName);
}
