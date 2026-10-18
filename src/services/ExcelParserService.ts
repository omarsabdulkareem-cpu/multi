import * as XLSX from 'xlsx';

// ============================================================================
// AL-KARWAN FACTORY EXCEL PARSER SERVICE
// Robust Hierarchical Parsing Engine, Merged Cell Coordinate Tracking,
// Arbitrary Header Row Discovery, and Pre-Validation Row Classification
// ============================================================================

/**
 * 0-based cell coordinates in the worksheet matrix
 */
export interface CellCoordinate {
  row: number; // 0-based row index
  col: number; // 0-based col index
}

/**
 * 0-based inclusive range representing a merged bounding box
 */
export interface MergeRange {
  startRow: number; // 0-based
  endRow: number;   // 0-based
  startCol: number; // 0-based
  endCol: number;   // 0-based
}

/**
 * Metadata for an individual cell tracked within a merged region
 */
export interface MergedCellInfo {
  anchor: CellCoordinate;   // Origin cell containing the primary value
  range: MergeRange;        // Full extent of the merge rectangle
  rowSpan: number;          // Total rows spanned
  colSpan: number;          // Total columns spanned
  anchorValue: any;         // Raw value in the anchor cell
  isAnchor: boolean;        // True if this cell is the top-left origin
  horizontalExtent: number; // Columns spanned
  verticalExtent: number;   // Rows spanned
}

/**
 * Coordinate Tracker interface for 2D cell and merge coordinate resolution
 */
export interface ICoordinateTracker {
  /** Check if a cell is part of any merged region */
  isMerged(row: number, col: number): boolean;
  /** Get merge details for a cell, or null if unmerged */
  getMergeInfo(row: number, col: number): MergedCellInfo | null;
  /** Retrieve the anchor coordinate of a merged cell */
  getAnchorCoordinate(row: number, col: number): CellCoordinate;
  /** Resolve the value of a cell with merge inheritance applied */
  resolveValue(row: number, col: number, rawMatrix: any[][]): any;
  /** Get all tracked merge ranges */
  getAllMergeRanges(): MergeRange[];
  /** Get all merge ranges that overlap a specific row */
  getMergesOverlappingRow(row: number): MergeRange[];
  /** Get all merge ranges that overlap a specific column */
  getMergesOverlappingCol(col: number): MergeRange[];
}

/**
 * Structural category for spreadsheet rows before validation occurs
 */
export type RowCategory =
  | 'TITLE_ROW'            // Document title, enterprise banner, date metadata
  | 'SUPER_HEADER_ROW'     // Multi-tier parent category header
  | 'HEADER_ROW'           // Primary column headers (field names)
  | 'SECTION_HEADER_ROW'   // In-table category divider or grouping row
  | 'TRANSACTION_ROW'      // Real operational inventory/production data record
  | 'SUMMARY_TOTAL_ROW'    // Subtotals, grand totals, balances, sums
  | 'FOOTER_NOTE_ROW'      // Signatures, approvals, notes, warehouse keeper stamps
  | 'EMPTY_TEMPLATE_ROW'   // Pre-printed serial numbers (1..9295) with empty fields
  | 'HIDDEN_ROW';          // Row explicitly hidden in Excel settings

/**
 * Detailed classification of a spreadsheet row
 */
export interface ClassifiedRow {
  rowIndex: number;              // 0-based index
  excelRowNumber: number;        // 1-based Excel row number
  category: RowCategory;
  confidence: number;            // 0.0 to 1.0
  categoryLabelAr: string;
  categoryLabelEn: string;
  rawValues: any[];              // Raw cell values across columns
  normalizedValues: any[];       // Values after merge tracking & trimming
  reasons: string[];             // Detailed diagnostic reasons for this classification
  isTransactionCandidate: boolean; // True ONLY if it should be sent to domain validators
  isExcludedFromValidation: boolean;// True for headers, summaries, templates, footers
  totalKeywordsFound?: string[]; // Keywords that triggered summary classification
  extractedSummaryValues?: Record<string, number>; // Extracted totals if parsed
  templateSequenceNumber?: number;// Pre-numbered sequence index if empty template
}

/**
 * Detected column header with coordinate and hierarchy details
 */
export interface DetectedColumnHeader {
  colIndex: number;              // 0-based column index
  colLetter: string;             // Excel letter (A, B, AA, etc.)
  rawHeader: string;             // Raw text in header cell
  normalizedHeader: string;      // Trimmed and lower-cased text
  compositePath: string;         // e.g. "بيانات الميزان > الوزن الصافي (كغم)"
  parentHeaders: string[];       // Ancestor header labels from upper tiers
  isMerged: boolean;             // True if part of horizontal or vertical merge
  mergeRange?: MergeRange;       // Merge coordinates if applicable
  mappedField: string;           // Canonical factory field mapped to this column
  fieldLabelAr: string;          // Arabic field label
  fieldLabelEn: string;          // English field label
  confidence: number;            // Confidence in the column header detection
}

/**
 * Result of the header detection engine
 */
export interface HeaderDetectionResult {
  headerRowIndex: number;        // 0-based start row of column headers
  headerEndRowIndex: number;     // 0-based end row (for multi-level headers)
  headerDepth: number;           // Number of header tiers (1, 2, or 3+)
  detectedColumns: DetectedColumnHeader[];
  confidence: number;            // Overall header detection confidence
  scoringDetails: {
    rowIndex: number;
    score: number;
    keywordCount: number;
    textRatio: number;
    distinctCount: number;
  }[];
}

/**
 * Comprehensive structural analysis of a single Excel worksheet
 */
export interface SheetStructureAnalysis {
  sheetName: string;
  isSheetHidden: boolean;
  dimensions: {
    totalRows: number;
    totalCols: number;
    usedRange: string;
    boundingBox: {
      minRow: number;
      maxRow: number;
      minCol: number;
      maxCol: number;
    };
  };
  coordinateTracker: ICoordinateTracker;
  mergeRanges: MergeRange[];
  header: HeaderDetectionResult;
  allRows: ClassifiedRow[];
  transactionRows: ClassifiedRow[];
  summaryTotalRows: ClassifiedRow[];
  emptyTemplateRows: ClassifiedRow[];
  footerNoteRows: ClassifiedRow[];
  titleRows: ClassifiedRow[];
  hiddenRows: ClassifiedRow[];
  statistics: {
    totalRows: number;
    transactionCount: number;
    summaryCount: number;
    emptyTemplateCount: number;
    hiddenCount: number;
    headerDepth: number;
    cleanDataRatio: number; // transactions / (transactions + emptyTemplate)
  };
}

/**
 * Full workbook parse report
 */
export interface ParsedWorkbookResult {
  fileName: string;
  sheetNames: string[];
  activeSheetName: string;
  sheets: Record<string, SheetStructureAnalysis>;
  summary: {
    totalSheets: number;
    totalTransactions: number;
    totalSummaryRowsIsolated: number;
    totalTemplateRowsIsolated: number;
    totalHiddenRowsIsolated: number;
  };
}

/**
 * Options for configuring ExcelParserService
 */
export interface ParserOptions {
  /** Explicitly override header row index if known (0-based) */
  forceHeaderRowIndex?: number;
  /** Maximum candidate rows to search for headers (default: 40) */
  maxHeaderSearchRows?: number;
  /** Minimum keyword matches required to identify a header (default: 2) */
  minHeaderKeywords?: number;
  /** Include hidden rows in analysis or quarantine them (default: quarantine/isolate) */
  quarantineHiddenRows?: boolean;
  /** Custom additional header keywords in Arabic or English */
  additionalHeaderKeywords?: string[];
  /** Custom additional summary/total keywords in Arabic or English */
  additionalSummaryKeywords?: string[];
}

// ============================================================================
// COORDINATE TRACKER IMPLEMENTATION
// ============================================================================

export class CoordinateTracker implements ICoordinateTracker {
  private mergeMap: Map<string, MergedCellInfo> = new Map();
  private allRanges: MergeRange[] = [];

  constructor(rawMerges?: XLSX.Range[], matrix?: any[][]) {
    if (!rawMerges || rawMerges.length === 0) return;

    for (const m of rawMerges) {
      const range: MergeRange = {
        startRow: Math.min(m.s.r, m.e.r),
        endRow: Math.max(m.s.r, m.e.r),
        startCol: Math.min(m.s.c, m.e.c),
        endCol: Math.max(m.s.c, m.e.c),
      };
      this.allRanges.push(range);

      const anchor: CellCoordinate = { row: range.startRow, col: range.startCol };
      const rowSpan = range.endRow - range.startRow + 1;
      const colSpan = range.endCol - range.startCol + 1;
      const anchorValue = matrix && matrix[anchor.row] ? matrix[anchor.row][anchor.col] : undefined;

      for (let r = range.startRow; r <= range.endRow; r++) {
        for (let c = range.startCol; c <= range.endCol; c++) {
          const isAnchor = r === range.startRow && c === range.startCol;
          const info: MergedCellInfo = {
            anchor,
            range,
            rowSpan,
            colSpan,
            anchorValue,
            isAnchor,
            horizontalExtent: colSpan,
            verticalExtent: rowSpan,
          };
          this.mergeMap.set(`${r}:${c}`, info);
        }
      }
    }
  }

  isMerged(row: number, col: number): boolean {
    return this.mergeMap.has(`${row}:${col}`);
  }

  getMergeInfo(row: number, col: number): MergedCellInfo | null {
    return this.mergeMap.get(`${row}:${col}`) || null;
  }

  getAnchorCoordinate(row: number, col: number): CellCoordinate {
    const info = this.mergeMap.get(`${row}:${col}`);
    return info ? info.anchor : { row, col };
  }

  resolveValue(row: number, col: number, rawMatrix: any[][]): any {
    const info = this.mergeMap.get(`${row}:${col}`);
    if (!info) {
      return rawMatrix[row] ? rawMatrix[row][col] : undefined;
    }
    const anchor = info.anchor;
    return rawMatrix[anchor.row] ? rawMatrix[anchor.row][anchor.col] : undefined;
  }

  getAllMergeRanges(): MergeRange[] {
    return [...this.allRanges];
  }

  getMergesOverlappingRow(row: number): MergeRange[] {
    return this.allRanges.filter((m) => row >= m.startRow && row <= m.endRow);
  }

  getMergesOverlappingCol(col: number): MergeRange[] {
    return this.allRanges.filter((m) => col >= m.startCol && col <= m.endCol);
  }
}

// ============================================================================
// VOCABULARY & REGEX RULES FOR DETECTION & CLASSIFICATION
// ============================================================================

// Factory industrial header keywords
const HEADER_KEYWORD_REGEX =
  /(?:رقم|مستند|تاريخ|مادة|صنف|مورد|شاحنة|سيارة|سائق|وزن|قائم|فارغ|صافي|كمية|عدد|شلايف|أكياس|باليتات|مخزن|موقع|خط|ملاحظات|إدخال|إخراج|صادر|وارد|هالك|تالف|رصيد|وحدة|code|id|doc|date|time|material|item|supplier|vendor|truck|driver|weight|gross|tare|net|qty|quantity|bags|warehouse|loc|notes|balance)/i;

// Summary, total, subtotal, and balance keywords
const SUMMARY_TOTAL_REGEX =
  /(?:المجموع|مجموع|صافي|اجمالي|إجمالي|الرصيد|رصيد|كلي|الجملة|حاصل|المجموع العام|إجمالي عام|صافي الإجمالي|total|subtotal|sub-total|sum|grand total|balance|net total|totals)/i;

// Footer, signature, supervisor stamps
const FOOTER_NOTE_REGEX =
  /(?:أمين|مشرف|توقيع|مدير|المستلم|المدقق|مهندس|مسؤول|اعتماد|ملاحظة|ملاحظات هامة|signature|approved by|supervisor|storekeeper|notes:)/i;

// Title / Metadata header banner
const TITLE_BANNER_REGEX =
  /(?:شركة|معمل|مصنع|سجل|تقرير|كشف|حركة|استلام|صادر|وارد|مستودع|مخزن|لصناعة|البلاستيك|company|factory|report|ledger|log|statement)/i;

// ============================================================================
// CORE EXCEL PARSER SERVICE
// ============================================================================

export class ExcelParserService {
  /**
   * Parse an Excel file (File, ArrayBuffer, or Uint8Array) using hierarchical parsing strategy
   */
  public static async parseWorkbook(
    input: File | ArrayBuffer | Uint8Array,
    fileName: string = 'document.xlsx',
    options?: ParserOptions
  ): Promise<ParsedWorkbookResult> {
    let buffer: ArrayBuffer;

    if (typeof Blob !== 'undefined' && input instanceof Blob) {
      if ('name' in input && typeof (input as any).name === 'string') {
        fileName = (input as any).name;
      }
      buffer = await input.arrayBuffer();
    } else if (input instanceof Uint8Array) {
      buffer = input.buffer.slice(input.byteOffset, input.byteOffset + input.byteLength) as ArrayBuffer;
    } else {
      buffer = input as ArrayBuffer;
    }

    const wb = XLSX.read(buffer, {
      type: 'array',
      cellDates: true,
      cellNF: true,
      cellStyles: true,
    });

    const sheetNames = wb.SheetNames || [];
    const sheets: Record<string, SheetStructureAnalysis> = {};

    let totalTransactions = 0;
    let totalSummaryRowsIsolated = 0;
    let totalTemplateRowsIsolated = 0;
    let totalHiddenRowsIsolated = 0;

    for (const name of sheetNames) {
      const ws = wb.Sheets[name];
      if (!ws) continue;

      const analysis = this.parseWorksheet(ws, name, options);
      sheets[name] = analysis;

      totalTransactions += analysis.statistics.transactionCount;
      totalSummaryRowsIsolated += analysis.statistics.summaryCount;
      totalTemplateRowsIsolated += analysis.statistics.emptyTemplateCount;
      totalHiddenRowsIsolated += analysis.statistics.hiddenCount;
    }

    const activeSheetName = sheetNames[0] || '';

    return {
      fileName,
      sheetNames,
      activeSheetName,
      sheets,
      summary: {
        totalSheets: sheetNames.length,
        totalTransactions,
        totalSummaryRowsIsolated,
        totalTemplateRowsIsolated,
        totalHiddenRowsIsolated,
      },
    };
  }

  /**
   * Parse a single XLSX worksheet into complete structural analysis
   */
  public static parseWorksheet(
    ws: XLSX.WorkSheet,
    sheetName: string = 'Sheet1',
    options?: ParserOptions
  ): SheetStructureAnalysis {
    // 1. Convert sheet cells into a dense 2D matrix
    const rawMatrix = this.worksheetToDenseMatrix(ws);

    // 2. Identify and track merged cell coordinates
    const merges = ws['!merges'] || [];
    const coordinateTracker = new CoordinateTracker(merges, rawMatrix);
    const mergeRanges: MergeRange[] = coordinateTracker.getAllMergeRanges();

    // 3. Detect hidden rows and columns in Excel metadata
    const hiddenRowIndices = this.detectHiddenRows(ws, rawMatrix.length);

    // 4. Calculate bounding box of populated content
    const boundingBox = this.calculateBoundingBox(rawMatrix);
    const totalRows = rawMatrix.length;
    const totalCols = rawMatrix.reduce((max, row) => Math.max(max, row ? row.length : 0), 0);
    const usedRange = ws['!ref'] || `A1:${this.colIndexToLetter(Math.max(0, totalCols - 1))}${totalRows}`;

    // 5. Discover header row irrespective of row index
    const header = this.locateHeaderRow(rawMatrix, coordinateTracker, boundingBox, options);

    // 6. Distinguish and classify all rows BEFORE validation occurs
    const allRows = this.classifyRowsBeforeValidation(
      rawMatrix,
      header,
      coordinateTracker,
      boundingBox,
      hiddenRowIndices,
      options
    );

    // 7. Group classified rows
    const transactionRows = allRows.filter((r) => r.category === 'TRANSACTION_ROW');
    const summaryTotalRows = allRows.filter((r) => r.category === 'SUMMARY_TOTAL_ROW');
    const emptyTemplateRows = allRows.filter((r) => r.category === 'EMPTY_TEMPLATE_ROW');
    const footerNoteRows = allRows.filter((r) => r.category === 'FOOTER_NOTE_ROW');
    const titleRows = allRows.filter((r) => r.category === 'TITLE_ROW');
    const hiddenRows = allRows.filter((r) => r.category === 'HIDDEN_ROW');

    const totalNonHeader = transactionRows.length + emptyTemplateRows.length;
    const cleanDataRatio = totalNonHeader > 0 ? transactionRows.length / totalNonHeader : 1.0;

    return {
      sheetName,
      isSheetHidden: false,
      dimensions: {
        totalRows,
        totalCols,
        usedRange,
        boundingBox,
      },
      coordinateTracker,
      mergeRanges,
      header,
      allRows,
      transactionRows,
      summaryTotalRows,
      emptyTemplateRows,
      footerNoteRows,
      titleRows,
      hiddenRows,
      statistics: {
        totalRows,
        transactionCount: transactionRows.length,
        summaryCount: summaryTotalRows.length,
        emptyTemplateCount: emptyTemplateRows.length,
        hiddenCount: hiddenRows.length,
        headerDepth: header.headerDepth,
        cleanDataRatio: Math.round(cleanDataRatio * 100) / 100,
      },
    };
  }

  // ==========================================================================
  // HEADER IDENTIFICATION (IRRESPECTIVE OF ROW INDEX)
  // ==========================================================================

  /**
   * Identify header rows irrespective of row index by scanning candidate rows,
   * scoring keyword density, textual ratio, and examining multi-level merged hierarchy.
   */
  public static locateHeaderRow(
    rawMatrix: any[][],
    tracker: ICoordinateTracker,
    boundingBox: { minRow: number; maxRow: number; minCol: number; maxCol: number },
    options?: ParserOptions
  ): HeaderDetectionResult {
    // If explicitly overridden in options
    if (options?.forceHeaderRowIndex !== undefined && options.forceHeaderRowIndex >= 0) {
      const forcedRow = options.forceHeaderRowIndex;
      const detectedColumns = this.extractHeaderColumns(rawMatrix, forcedRow, forcedRow, tracker, boundingBox);
      return {
        headerRowIndex: forcedRow,
        headerEndRowIndex: forcedRow,
        headerDepth: 1,
        detectedColumns,
        confidence: 1.0,
        scoringDetails: [{ rowIndex: forcedRow, score: 100, keywordCount: 10, textRatio: 1, distinctCount: 10 }],
      };
    }

    const maxSearch = Math.min(rawMatrix.length, options?.maxHeaderSearchRows || 40);
    const startSearch = Math.max(0, boundingBox.minRow);
    const scoringDetails: {
      rowIndex: number;
      score: number;
      keywordCount: number;
      textRatio: number;
      distinctCount: number;
    }[] = [];

    let bestRow = -1;
    let bestScore = -1;

    for (let r = startSearch; r < maxSearch; r++) {
      const row = rawMatrix[r];
      if (!row || row.length === 0) continue;

      const cells = row.filter((c) => c !== undefined && c !== null && String(c).trim() !== '');
      if (cells.length < 2) continue; // Skip single title or sparse cells

      let keywordCount = 0;
      let textCount = 0;
      const textSet = new Set<string>();

      for (let c = 0; c < row.length; c++) {
        const val = tracker.resolveValue(r, c, rawMatrix);
        if (val === undefined || val === null) continue;

        const strVal = String(val).trim();
        if (!strVal) continue;

        // Check if numeric or date
        const isNum = typeof val === 'number' || (!isNaN(Number(strVal)) && strVal.length < 15);
        if (!isNum) {
          textCount++;
          textSet.add(strVal.toLowerCase());
        }

        if (HEADER_KEYWORD_REGEX.test(strVal)) {
          keywordCount++;
        }
      }

      const textRatio = cells.length > 0 ? textCount / cells.length : 0;
      const distinctCount = textSet.size;

      // Check following row characteristics (data contrast)
      let nextRowContrastBonus = 0;
      if (r + 1 < rawMatrix.length) {
        const nextRow = rawMatrix[r + 1] || [];
        const nextNumericCount = nextRow.filter(
          (c) => typeof c === 'number' || (c !== null && !isNaN(Number(c)) && String(c).trim() !== '')
        ).length;
        if (nextNumericCount >= 2) {
          nextRowContrastBonus += 15; // Strong indicator that r is the header above data
        }
      }

      // Calculate composite heuristic score
      let score = keywordCount * 25 + textRatio * 30 + Math.min(distinctCount, 10) * 4 + nextRowContrastBonus;

      // Penalize pure title banners (e.g. "شركة الكروان لصناعة البلاستيك" spanning 1 cell)
      if (cells.length <= 2 && TITLE_BANNER_REGEX.test(String(cells[0]))) {
        score -= 50;
      }

      // Penalize summary rows if mistaken for headers
      if (cells.some((c) => SUMMARY_TOTAL_REGEX.test(String(c)))) {
        score -= 60;
      }

      scoringDetails.push({
        rowIndex: r,
        score,
        keywordCount,
        textRatio,
        distinctCount,
      });

      if (score > bestScore && keywordCount >= (options?.minHeaderKeywords ?? 1)) {
        bestScore = score;
        bestRow = r;
      }
    }

    // Fallback if no high score found
    if (bestRow === -1) {
      // Pick first non-empty row with at least 2 text cells
      for (let r = startSearch; r < maxSearch; r++) {
        const row = rawMatrix[r];
        if (row && row.filter((c) => c !== null && c !== '').length >= 2) {
          bestRow = r;
          break;
        }
      }
      if (bestRow === -1) bestRow = 0;
    }

    // Check for Multi-Level (Hierarchical) Header Depth
    // For example: Row bestRow has merged categories ("بيانات الميزان والوزن"),
    // and Row bestRow+1 has specific fields ("قائم", "فارغ", "صافي")
    let headerEndRow = bestRow;
    if (bestRow + 1 < rawMatrix.length) {
      const nextRow = rawMatrix[bestRow + 1] || [];
      const nextKeywords = nextRow.filter((c) => HEADER_KEYWORD_REGEX.test(String(c || ''))).length;
      const nextCells = nextRow.filter((c) => c !== undefined && c !== null && String(c).trim() !== '').length;

      // If next row also contains prominent header keywords or is directly under merged header spans
      const hasHorizontalMergesInCurrent = tracker
        .getMergesOverlappingRow(bestRow)
        .some((m) => m.endCol > m.startCol);

      if (hasHorizontalMergesInCurrent && (nextKeywords >= 2 || nextCells >= 3)) {
        headerEndRow = bestRow + 1;
      }
    }

    const headerDepth = headerEndRow - bestRow + 1;
    const detectedColumns = this.extractHeaderColumns(
      rawMatrix,
      bestRow,
      headerEndRow,
      tracker,
      boundingBox
    );

    const confidence = Math.min(1.0, Math.max(0.2, (bestScore > 0 ? bestScore : 30) / 100));

    return {
      headerRowIndex: bestRow,
      headerEndRowIndex: headerEndRow,
      headerDepth,
      detectedColumns,
      confidence,
      scoringDetails,
    };
  }

  /**
   * Extract columns and build composite hierarchical paths across merged header tiers
   */
  private static extractHeaderColumns(
    rawMatrix: any[][],
    headerStartRow: number,
    headerEndRow: number,
    tracker: ICoordinateTracker,
    boundingBox: { minCol: number; maxCol: number }
  ): DetectedColumnHeader[] {
    const columns: DetectedColumnHeader[] = [];
    const maxCol = Math.max(
      boundingBox.maxCol,
      rawMatrix[headerStartRow]?.length || 0,
      rawMatrix[headerEndRow]?.length || 0
    );

    for (let c = 0; c <= maxCol; c++) {
      const colLetter = this.colIndexToLetter(c);
      const parentHeaders: string[] = [];

      // Collect ancestor tiers if multi-level
      for (let r = headerStartRow; r < headerEndRow; r++) {
        const val = tracker.resolveValue(r, c, rawMatrix);
        if (val !== undefined && val !== null) {
          const str = String(val).trim();
          if (str && !parentHeaders.includes(str)) {
            parentHeaders.push(str);
          }
        }
      }

      // Leaf header at bottom tier
      const leafVal = tracker.resolveValue(headerEndRow, c, rawMatrix);
      const leafHeader = leafVal !== undefined && leafVal !== null ? String(leafVal).trim() : '';

      // Skip columns that have no text in any tier and are outside bounding box
      if (!leafHeader && parentHeaders.length === 0 && c > boundingBox.maxCol) {
        continue;
      }

      // Build composite path
      const pathParts = [...parentHeaders];
      if (leafHeader && !pathParts.includes(leafHeader)) {
        pathParts.push(leafHeader);
      }
      const compositePath = pathParts.join(' > ') || leafHeader || `عمود ${colLetter}`;
      const rawHeader = leafHeader || (parentHeaders.length > 0 ? parentHeaders[parentHeaders.length - 1] : `عمود ${colLetter}`);

      const mergeInfo = tracker.getMergeInfo(headerEndRow, c) || tracker.getMergeInfo(headerStartRow, c);

      // Automatic mapping heuristic to standard factory fields
      const { mappedField, fieldLabelAr, fieldLabelEn, confidence } = this.mapFieldHeuristic(compositePath, rawHeader);

      columns.push({
        colIndex: c,
        colLetter,
        rawHeader,
        normalizedHeader: rawHeader.toLowerCase(),
        compositePath,
        parentHeaders,
        isMerged: !!mergeInfo,
        mergeRange: mergeInfo?.range,
        mappedField,
        fieldLabelAr,
        fieldLabelEn,
        confidence,
      });
    }

    return columns;
  }

  // ==========================================================================
  // ROW CLASSIFICATION BEFORE VALIDATION OCCURS
  // ==========================================================================

  /**
   * Distinguish between header rows, summary/total rows, empty template rows,
   * footer/signature rows, and actual transaction data rows BEFORE any validation occurs.
   */
  public static classifyRowsBeforeValidation(
    rawMatrix: any[][],
    header: HeaderDetectionResult,
    tracker: ICoordinateTracker,
    boundingBox: { minRow: number; maxRow: number; minCol: number; maxCol: number },
    hiddenRowsSet: Set<number>,
    options?: ParserOptions
  ): ClassifiedRow[] {
    const classified: ClassifiedRow[] = [];

    for (let r = 0; r < rawMatrix.length; r++) {
      const row = rawMatrix[r] || [];
      const excelRowNumber = r + 1;
      const reasons: string[] = [];

      // 1. Check if row is explicitly hidden in Excel settings
      if (hiddenRowsSet.has(r)) {
        classified.push({
          rowIndex: r,
          excelRowNumber,
          category: 'HIDDEN_ROW',
          confidence: 1.0,
          categoryLabelAr: 'صف مخفي في إكسل (معزول)',
          categoryLabelEn: 'Hidden Row (Quarantined)',
          rawValues: row,
          normalizedValues: row,
          reasons: ['Row marked hidden or height=0 in worksheet metadata'],
          isTransactionCandidate: false,
          isExcludedFromValidation: true,
        });
        continue;
      }

      // 2. Rows before header start: Title banners, enterprise metadata, print stamps
      if (r < header.headerRowIndex) {
        classified.push({
          rowIndex: r,
          excelRowNumber,
          category: 'TITLE_ROW',
          confidence: 0.95,
          categoryLabelAr: 'ترويسة / عنوان الوثيقة',
          categoryLabelEn: 'Document Title / Metadata Banner',
          rawValues: row,
          normalizedValues: row,
          reasons: ['Precedes detected header row index'],
          isTransactionCandidate: false,
          isExcludedFromValidation: true,
        });
        continue;
      }

      // 3. Header rows (including multi-tier super headers)
      if (r >= header.headerRowIndex && r <= header.headerEndRowIndex) {
        const isSuper = r < header.headerEndRowIndex;
        classified.push({
          rowIndex: r,
          excelRowNumber,
          category: isSuper ? 'SUPER_HEADER_ROW' : 'HEADER_ROW',
          confidence: 1.0,
          categoryLabelAr: isSuper ? 'رأس فرعي هرمي مدمج' : 'رأس الأعمدة الرئيسي',
          categoryLabelEn: isSuper ? 'Super Header (Hierarchical)' : 'Primary Column Header',
          rawValues: row,
          normalizedValues: row,
          reasons: ['Part of the confirmed multi-tier header range'],
          isTransactionCandidate: false,
          isExcludedFromValidation: true,
        });
        continue;
      }

      // 4. Rows after header: Evaluate content to distinguish summaries, templates, and data
      // Normalize values via coordinate tracker (inheriting vertically merged transaction info)
      const normalizedValues: any[] = [];
      const numCols = Math.max(row.length, boundingBox.maxCol + 1);

      for (let c = 0; c < numCols; c++) {
        normalizedValues.push(tracker.resolveValue(r, c, rawMatrix));
      }

      const nonBlankCells = normalizedValues.filter((v) => v !== undefined && v !== null && String(v).trim() !== '');

      // Completely empty row
      if (nonBlankCells.length === 0) {
        classified.push({
          rowIndex: r,
          excelRowNumber,
          category: 'EMPTY_TEMPLATE_ROW',
          confidence: 1.0,
          categoryLabelAr: 'سطر فارغ تماماً',
          categoryLabelEn: 'Completely Blank Row',
          rawValues: row,
          normalizedValues,
          reasons: ['No populated cells across all columns'],
          isTransactionCandidate: false,
          isExcludedFromValidation: true,
        });
        continue;
      }

      const rowTextCombined = nonBlankCells.map((v) => String(v).trim()).join(' ');

      // 5. SUMMARY / TOTALS DETECTION
      // Matches "المجموع", "الإجمالي", "صافي", "رصيد", "total", "sum", "balance"
      const summaryMatches: string[] = [];
      for (const cell of nonBlankCells) {
        const str = String(cell).trim();
        if (SUMMARY_TOTAL_REGEX.test(str)) {
          summaryMatches.push(str);
        }
      }

      if (summaryMatches.length > 0 || SUMMARY_TOTAL_REGEX.test(rowTextCombined)) {
        // Extract numeric values from this summary row
        const extractedSummary: Record<string, number> = {};
        for (let c = 0; c < normalizedValues.length; c++) {
          const val = normalizedValues[c];
          if (typeof val === 'number' && !isNaN(val)) {
            const colHeader = header.detectedColumns.find((h) => h.colIndex === c);
            const key = colHeader ? colHeader.mappedField : `col_${c}`;
            extractedSummary[key] = val;
          }
        }

        reasons.push(`Contains total/summary keywords: ${summaryMatches.join(', ')}`);
        reasons.push('Isolated to prevent false validation alerts ("Material name missing", "Invalid weight")');

        classified.push({
          rowIndex: r,
          excelRowNumber,
          category: 'SUMMARY_TOTAL_ROW',
          confidence: 0.98,
          categoryLabelAr: 'مجاميع / ملخص إجمالي',
          categoryLabelEn: 'Summary / Grand Total Row',
          rawValues: row,
          normalizedValues,
          reasons,
          isTransactionCandidate: false,
          isExcludedFromValidation: true,
          totalKeywordsFound: summaryMatches,
          extractedSummaryValues: extractedSummary,
        });
        continue;
      }

      // 6. FOOTER / SIGNATURES / NOTES
      // Matches "أمين المخزن", "مدير المصنع", "توقيع", "supervisor"
      if (FOOTER_NOTE_REGEX.test(rowTextCombined)) {
        reasons.push('Matches supervisory approval, signature, or warehouse keeper footer note');
        classified.push({
          rowIndex: r,
          excelRowNumber,
          category: 'FOOTER_NOTE_ROW',
          confidence: 0.95,
          categoryLabelAr: 'توقيعات وملاحظات ختامية',
          categoryLabelEn: 'Footer Notes & Signatures',
          rawValues: row,
          normalizedValues,
          reasons,
          isTransactionCandidate: false,
          isExcludedFromValidation: true,
        });
        continue;
      }

      // 7. PRE-NUMBERED EMPTY TEMPLATE ROWS (e.g. 1..9295 empty factory form)
      // If the row only has 1 or 2 cells populated, and one is just a serial integer (1, 2, 3...)
      // while material, weights, supplier are completely empty.
      const firstCell = normalizedValues[0];
      const secondCell = normalizedValues[1];
      const isFirstSeq = typeof firstCell === 'number' && firstCell >= 1 && firstCell <= 50000;
      const isSecondSeq = typeof secondCell === 'number' && secondCell >= 1 && secondCell <= 50000;

      if ((isFirstSeq || isSecondSeq) && nonBlankCells.length <= 2) {
        const seqNum = isFirstSeq ? (firstCell as number) : (secondCell as number);
        reasons.push(`Pre-printed template row #${seqNum} with no operational transaction data`);
        reasons.push('Safely isolated from validation to eliminate thousands of phantom alarms');

        classified.push({
          rowIndex: r,
          excelRowNumber,
          category: 'EMPTY_TEMPLATE_ROW',
          confidence: 0.99,
          categoryLabelAr: 'قالب فارغ مرقم تسلسلياً',
          categoryLabelEn: 'Pre-numbered Empty Template Row',
          rawValues: row,
          normalizedValues,
          reasons,
          isTransactionCandidate: false,
          isExcludedFromValidation: true,
          templateSequenceNumber: seqNum,
        });
        continue;
      }

      // 8. SECTION / CATEGORY DIVIDER
      // When a single cell spans across all columns with category titles like "قسم البولي إيثيلين"
      if (nonBlankCells.length === 1 && typeof nonBlankCells[0] === 'string' && nonBlankCells[0].length > 4) {
        const titleStr = nonBlankCells[0];
        const isHeaderMerge = tracker.getMergesOverlappingRow(r).some((m) => m.endCol - m.startCol >= 3);
        if (isHeaderMerge || TITLE_BANNER_REGEX.test(titleStr)) {
          classified.push({
            rowIndex: r,
            excelRowNumber,
            category: 'SECTION_HEADER_ROW',
            confidence: 0.9,
            categoryLabelAr: 'فاصل أقسام / تصنيف فرعي',
            categoryLabelEn: 'Section Group / Category Divider',
            rawValues: row,
            normalizedValues,
            reasons: ['Single wide text cell acting as internal section divider'],
            isTransactionCandidate: false,
            isExcludedFromValidation: true,
          });
          continue;
        }
      }

      // 9. ACTUAL TRANSACTION ROW
      // The row has authentic transactional data candidates!
      reasons.push('Operational record containing material, weight, or inventory movement fields');
      classified.push({
        rowIndex: r,
        excelRowNumber,
        category: 'TRANSACTION_ROW',
        confidence: 0.95,
        categoryLabelAr: 'حركة تشغيلية فعلية',
        categoryLabelEn: 'Actual Transaction Record',
        rawValues: row,
        normalizedValues,
        reasons,
        isTransactionCandidate: true,
        isExcludedFromValidation: false,
      });
    }

    return classified;
  }

  // ==========================================================================
  // HELPER UTILITIES
  // ==========================================================================

  /**
   * Convert XLSX Sheet object to a dense, 2D array representation
   */
  public static worksheetToDenseMatrix(ws: XLSX.WorkSheet): any[][] {
    return XLSX.utils.sheet_to_json(ws, {
      header: 1,
      raw: true,
      defval: null,
      blankrows: true,
    }) as any[][];
  }

  /**
   * Detect rows marked hidden or height=0 in worksheet metadata
   */
  private static detectHiddenRows(ws: XLSX.WorkSheet, totalRows: number): Set<number> {
    const hiddenSet = new Set<number>();
    const wsRows = ws['!rows'];

    if (Array.isArray(wsRows)) {
      for (let r = 0; r < wsRows.length; r++) {
        const rowProps = wsRows[r];
        if (!rowProps) continue;

        if (rowProps.hidden === true || rowProps.hpt === 0 || rowProps.hpx === 0) {
          hiddenSet.add(r);
        }
      }
    }

    return hiddenSet;
  }

  /**
   * Calculate exact 2D bounding box of populated cells
   */
  public static calculateBoundingBox(rawMatrix: any[][]): {
    minRow: number;
    maxRow: number;
    minCol: number;
    maxCol: number;
  } {
    let minRow = -1;
    let maxRow = -1;
    let minCol = -1;
    let maxCol = -1;

    for (let r = 0; r < rawMatrix.length; r++) {
      const row = rawMatrix[r];
      if (!row) continue;

      for (let c = 0; c < row.length; c++) {
        const val = row[c];
        if (val !== undefined && val !== null && String(val).trim() !== '') {
          if (minRow === -1 || r < minRow) minRow = r;
          if (maxRow === -1 || r > maxRow) maxRow = r;
          if (minCol === -1 || c < minCol) minCol = c;
          if (maxCol === -1 || c > maxCol) maxCol = c;
        }
      }
    }

    return {
      minRow: minRow === -1 ? 0 : minRow,
      maxRow: maxRow === -1 ? Math.max(0, rawMatrix.length - 1) : maxRow,
      minCol: minCol === -1 ? 0 : minCol,
      maxCol: maxCol === -1 ? 0 : maxCol,
    };
  }

  /**
   * Convert 0-based column index to Excel column letter (0 -> A, 27 -> AB)
   */
  public static colIndexToLetter(colIndex: number): string {
    let temp = colIndex;
    let letter = '';
    while (temp >= 0) {
      letter = String.fromCharCode((temp % 26) + 65) + letter;
      temp = Math.floor(temp / 26) - 1;
    }
    return letter;
  }

  /**
   * Map header strings to standard Al-Karwan factory fields
   */
  private static mapFieldHeuristic(
    compositePath: string,
    leafHeader: string
  ): { mappedField: string; fieldLabelAr: string; fieldLabelEn: string; confidence: number } {
    const combined = `${compositePath} ${leafHeader}`.toLowerCase();

    // 1. Material
    if (/(?:اسم المادة|المادة|الصنف|مادة|نوع الخامة|material|item)/i.test(combined)) {
      return { mappedField: 'material', fieldLabelAr: 'اسم المادة الخام', fieldLabelEn: 'Material Name', confidence: 0.95 };
    }
    // 2. Material Code
    if (/(?:كود المادة|رمز المادة|كود|code|sku)/i.test(combined)) {
      return { mappedField: 'materialCode', fieldLabelAr: 'كود المادة', fieldLabelEn: 'Material Code', confidence: 0.92 };
    }
    // 3. Gross Weight (قائم)
    if (/(?:قائم|وزن الدخول|الوزن القائم|gross)/i.test(combined)) {
      return { mappedField: 'grossKG', fieldLabelAr: 'الوزن القائم (كغم)', fieldLabelEn: 'Gross Weight (KG)', confidence: 0.95 };
    }
    // 4. Tare Weight (فارغ)
    if (/(?:فارغ|وزن الخروج|الوزن الفارغ|tare)/i.test(combined)) {
      return { mappedField: 'tareKG', fieldLabelAr: 'الوزن الفارغ (كغم)', fieldLabelEn: 'Tare Weight (KG)', confidence: 0.95 };
    }
    // 5. Net Weight (الصافي)
    if (/(?:صافي|الصافي|الوزن الصافي|net)/i.test(combined)) {
      return { mappedField: 'netKG', fieldLabelAr: 'الوزن الصافي (كغم)', fieldLabelEn: 'Net Weight (KG)', confidence: 0.98 };
    }
    // 6. Generic Weight
    if (/(?:وزن|الوزن|weight|kg|كغم)/i.test(combined)) {
      return { mappedField: 'weight', fieldLabelAr: 'الوزن (كغم)', fieldLabelEn: 'Weight (KG)', confidence: 0.85 };
    }
    // 7. Bulk Bags / Packages
    if (/(?:شلايف|شليف|أكياس|كيس|عدد الشلايف|bags|bulk bags|qty)/i.test(combined)) {
      return { mappedField: 'bulkBags', fieldLabelAr: 'عدد الشلايف / الأكياس', fieldLabelEn: 'Bulk Bags Count', confidence: 0.95 };
    }
    // 8. Supplier
    if (/(?:مورد|المورد|جهة التوريد|supplier|vendor)/i.test(combined)) {
      return { mappedField: 'supplier', fieldLabelAr: 'اسم المورد', fieldLabelEn: 'Supplier', confidence: 0.95 };
    }
    // 9. Document Ref #
    if (/(?:رقم المستند|رقم الوصل|رقم السند|مستند|doc|ref|invoice)/i.test(combined)) {
      return { mappedField: 'docRef', fieldLabelAr: 'رقم المستند', fieldLabelEn: 'Document Ref', confidence: 0.92 };
    }
    // 10. Date
    if (/(?:تاريخ|التاريخ|date)/i.test(combined)) {
      return { mappedField: 'date', fieldLabelAr: 'التاريخ', fieldLabelEn: 'Date', confidence: 0.96 };
    }
    // 11. Truck / Vehicle
    if (/(?:سيارة|شاحنة|رقم السيارة|رقم الشاحنة|truck|vehicle)/i.test(combined)) {
      return { mappedField: 'vehicle', fieldLabelAr: 'رقم الشاحنة', fieldLabelEn: 'Vehicle / Truck #', confidence: 0.9 };
    }
    // 12. Driver
    if (/(?:سائق|اسم السائق|driver)/i.test(combined)) {
      return { mappedField: 'driver', fieldLabelAr: 'اسم السائق', fieldLabelEn: 'Driver Name', confidence: 0.9 };
    }
    // 13. Warehouse / Location
    if (/(?:مخزن|مستودع|موقع|warehouse|location|loc)/i.test(combined)) {
      return { mappedField: 'warehouse', fieldLabelAr: 'المخزن / المستودع', fieldLabelEn: 'Warehouse Location', confidence: 0.88 };
    }
    // 14. Notes
    if (/(?:ملاحظات|ملاحظة|بيان|notes|remarks)/i.test(combined)) {
      return { mappedField: 'notes', fieldLabelAr: 'ملاحظات', fieldLabelEn: 'Notes & Remarks', confidence: 0.85 };
    }

    return { mappedField: 'unknown', fieldLabelAr: 'غير محدد', fieldLabelEn: 'Unmapped Field', confidence: 0.1 };
  }
}
