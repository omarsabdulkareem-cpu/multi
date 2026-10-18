import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export interface PdfGenerationOptions {
  fileName?: string;
  landscape?: boolean;
}

/**
 * Renders an HTML element onto high-resolution canvas and compiles a multi-page A4 PDF.
 */
export async function generateAndDownloadPdfFromElement(
  element: HTMLElement,
  options: PdfGenerationOptions = {}
): Promise<void> {
  const isLandscape = options.landscape ?? false;
  const orientation = isLandscape ? 'landscape' : 'portrait';
  const fileName =
    options.fileName ||
    `AlKarwan_Safety_Stock_Deficit_Outreach_${new Date().toISOString().slice(0, 10)}.pdf`;

  // Capture element using html2canvas
  const canvas = await html2canvas(element, {
    scale: 2, // 2x for sharp print quality
    useCORS: true,
    logging: false,
    backgroundColor: '#ffffff',
    windowWidth: 1200,
  });

  const pdf = new jsPDF({
    orientation,
    unit: 'mm',
    format: 'a4',
  });

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

  // Additional pages if needed
  while (heightLeft > 0) {
    position = -(imgHeight - heightLeft);
    pdf.addPage();
    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
    heightLeft -= pageHeight;
  }

  // Save the PDF
  pdf.save(fileName);
}
