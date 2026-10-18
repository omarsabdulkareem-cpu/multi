import * as XLSX from 'xlsx';
import { ColumnMapping, ExcelDocType } from './smartExcelParser';

// ============================================================================
// HIERARCHICAL EXCEL PARSER SERVICE
// Pre-Extraction Structural Discovery, Merged Header Resolution, & Hidden Element Detection
// ============================================================================

export type StructuralBandType =
  | 'TITLE_BAND'        // Header metadata banner (Company name, doc title, dates)
  | 'HEADER_BAND'       // Hierarchical header rows (1, 2, or N levels)
  | 'SECTION_GROUP'     // Internal category / shift / warehouse grouping row
  | 'DATA_BAND'         // Active transactional records
  | 'TOTALS_BAND'       // Subtotals, grand totals, balances
  | 'FOOTER_BAND'       // Signatures, warehouse keeper stamps, notes
  | 'HIDDEN_ROW'        // Rows hidden by Excel (height=0, filter, hidden flag)
  | 'UNFILLED_TEMPLATE';// Pre-numbered empty factory template rows

export interface StructuralBand {
  type: StructuralBandType;
  startRow: number; // 0-based
  endRow: number;   // 0-based
  rowCount: number;
  labelAr: string;
  labelEn: string;
  badgeColor: string;
  description?: string;
  sampleText?: string;
}

export interface HiddenRowInfo {
  rowIndex: number;      // 0-based
  excelRowNumber: number;// 1-based
  reason: 'HIDDEN_FLAG' | 'ZERO_HEIGHT' | 'AUTOFILTER' | 'COLLAPSED_GROUP';
  reasonAr: string;
  reasonEn: string;
  band: StructuralBandType;
  sampleCells: string[];
}

export interface HiddenColInfo {
  colIndex: number;      // 0-based
  colLetter: string;     // e.g. "A", "F"
  width?: number;
  reason: 'HIDDEN_FLAG' | 'ZERO_WIDTH';
  reasonAr: string;
  reasonEn: string;
}

export interface HierarchicalHeaderNode {
  id: string;
  title: string;
  normalizedTitle: string;
  rowStart: number;
  rowEnd: number;
  colStart: number;
  colEnd: number;
  colSpan: number;
  rowSpan: number;
  level: number; // 0 = root/super-header, 1 = sub-header, 2 = leaf
  isMerged: boolean;
  parentId?: string;
  parentTitle?: string;
  children: HierarchicalHeaderNode[];
  leafColIndex?: number;
}

export interface ResolvedColumnHeader {
  colIndex: number;
  colLetter: string;
  leafTitle: string;
  parentHeaders: string[]; // e.g. ["بيانات الميزان والوزن"]
  fullPath: string;        // e.g. "بيانات الميزان والوزن > الصافي (كغم)"
  hierarchyDepth: number;
  mappedField: ColumnMapping['mappedField'];
  fieldLabelAr: string;
  fieldLabelEn: string;
  confidence: number;
  isMerged: boolean;
  mergeRange?: { s: { r: number; c: number }; e: { r: number; c: number } };
  isAutoMapped: boolean;
}

export interface SheetStructuralAnalysis {
  sheetName: string;
  isSheetHidden: boolean;
  dimensions: {
    rowCount: number;
    colCount: number;
    usedRange: string;
  };
  structuralBands: StructuralBand[];
  headerHierarchy: {
    depth: number; // 1, 2, 3...
    tree: HierarchicalHeaderNode[];
    resolvedColumns: ResolvedColumnHeader[];
    mergeRanges: { s: { r: number; c: number }; e: { r: number; c: number } }[];
    headerStartRow: number;
    headerEndRow: number;
  };
  hiddenElements: {
    hiddenRows: HiddenRowInfo[];
    hiddenCols: HiddenColInfo[];
    totalHiddenRows: number;
    totalHiddenCols: number;
  };
  sectionGroups: {
    rowIndex: number;
    title: string;
    colSpan: number;
  }[];
  recommendedExtraction: {
    headerRowIndex: number;
    headerEndRowIndex: number;
    dataStartRow: number;
    dataEndRow: number;
    skipHiddenRows: boolean;
    estimatedDataRows: number;
  };
  rawMatrix: any[][];
}

export interface HierarchicalWorkbookReport {
  fileName: string;
  fileSize: string;
  sheetCount: number;
  visibleSheets: string[];
  hiddenSheets: string[];
  sheets: SheetStructuralAnalysis[];
  overallStats: {
    totalHiddenRows: number;
    totalHiddenCols: number;
    totalHeaderMerges: number;
    maxHeaderDepth: number;
    estimatedDataRecords: number;
  };
  generatedAt: string;
}

export interface ExtractionOptions {
  skipHiddenRows?: boolean;
  skipSectionGroups?: boolean;
  customHeaderRowIndex?: number;
  customHeaderDepth?: number;
  customDataStartRow?: number;
  customDataEndRow?: number;
}

// ----------------------------------------------------
// Arabic Normalization & Cleaning Utilities
// ----------------------------------------------------

export function normalizeArabicText(text: string): string {
  if (!text) return '';
  return String(text)
    .trim()
    .toLowerCase()
    .replace(/[\u064B-\u065F]/g, '') // Tashkeel / Harakat
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[ـ\-_]/g, ' ')
    .replace(/\s+/g, ' ');
}

export function getExcelColumnLetter(colIndex: number): string {
  let temp = colIndex;
  let letter = '';
  while (temp >= 0) {
    letter = String.fromCharCode((temp % 26) + 65) + letter;
    temp = Math.floor(temp / 26) - 1;
  }
  return letter;
}

// Check if a row has any non-empty cell
export function isRowCompletelyEmpty(row: any[]): boolean {
  if (!row || row.length === 0) return true;
  return row.every((cell) => cell === undefined || cell === null || String(cell).trim() === '');
}

// ----------------------------------------------------
// Summary and Section Group Pattern Matchers
// ----------------------------------------------------

const SUMMARY_KEYWORDS = [
  'المجموع',
  'المجموع العام',
  'الإجمالي',
  'اجمالي',
  'صافي المجموع',
  'total',
  'grand total',
  'subtotal',
  'sum',
  'totals',
  'توقيع',
  'أمين المخزن',
  'امين المخزن',
  'المسؤول',
  'مدير المخزن',
  'signature',
  'approved by',
  'صفحة',
  'page',
];

const SECTION_PREFIXES = [
  'قسم',
  'مستودع',
  'مخزن',
  'عنبر',
  'وردية',
  'خط',
  'صنف',
  'فئة',
  'group',
  'category',
  'shift',
  'section',
  'line',
];

// Determine if row is a section break/header within the data table
export function isSectionGroupRow(row: any[], totalCols: number): { isGroup: boolean; title: string } {
  if (!row || row.length === 0) return { isGroup: false, title: '' };
  
  // A section group usually has only 1 or 2 filled cells, and is mostly text
  const filledCells = row
    .map((cell, idx) => ({ cell: String(cell || '').trim(), idx }))
    .filter((c) => c.cell.length > 0);

  if (filledCells.length === 1 || (filledCells.length === 2 && filledCells[1].cell.length < 5)) {
    const text = filledCells[0].cell;
    const norm = normalizeArabicText(text);

    // Make sure it is not a summary row
    for (const kw of SUMMARY_KEYWORDS) {
      if (norm.includes(normalizeArabicText(kw))) {
        return { isGroup: false, title: '' };
      }
    }

    // Check if it starts with section prefix or contains dashes like "--- مخزن 2 ---"
    const hasPrefix = SECTION_PREFIXES.some((p) => norm.startsWith(p) || norm.includes(` ${p} `));
    const hasDecorations = text.startsWith('---') || text.startsWith('===') || text.startsWith('***') || text.startsWith('[');

    if (hasPrefix || hasDecorations || (text.length >= 4 && !/^\d+$/.test(text) && filledCells[0].idx === 0)) {
      return { isGroup: true, title: text.replace(/^[-=*\s[\]]+|[-=*\s[\]]+$/g, '') };
    }
  }

  return { isGroup: false, title: '' };
}

// ----------------------------------------------------
// PHASE 1 & 2: HIDDEN ROWS AND HIDDEN COLUMNS DETECTOR
// ----------------------------------------------------

export function detectHiddenRowsAndCols(
  worksheet: XLSX.WorkSheet,
  totalRows: number,
  totalCols: number,
  rawMatrix: any[][]
): {
  hiddenRows: HiddenRowInfo[];
  hiddenCols: HiddenColInfo[];
  hiddenRowSet: Set<number>;
  hiddenColSet: Set<number>;
} {
  const hiddenRows: HiddenRowInfo[] = [];
  const hiddenCols: HiddenColInfo[] = [];
  const hiddenRowSet = new Set<number>();
  const hiddenColSet = new Set<number>();

  // Check rows in worksheet['!rows']
  const wsRows = worksheet['!rows'];
  if (wsRows && Array.isArray(wsRows)) {
    wsRows.forEach((rowInfo, rIdx) => {
      if (!rowInfo) return;
      
      let isHidden = false;
      let reason: HiddenRowInfo['reason'] = 'HIDDEN_FLAG';
      let reasonAr = 'تم إخفاء الصف في ملف Excel';
      let reasonEn = 'Row flagged as hidden in Excel';

      if (rowInfo.hidden === true) {
        isHidden = true;
        reason = 'HIDDEN_FLAG';
        reasonAr = 'خاصية الإخفاء مفعلة للصف (Hidden=true)';
        reasonEn = 'Row hidden property flag active';
      } else if (rowInfo.hpt === 0 || rowInfo.hpx === 0) {
        isHidden = true;
        reason = 'ZERO_HEIGHT';
        reasonAr = 'ارتفاع الصف مضبوط على صفر (Height=0)';
        reasonEn = 'Row height is 0 pt/px';
      } else if ((rowInfo as any).collapsed === true) {
        isHidden = true;
        reason = 'COLLAPSED_GROUP';
        reasonAr = 'صف مطوي ضمن مجموعة هرمية (Collapsed Group)';
        reasonEn = 'Collapsed row in hierarchical outline group';
      }

      if (isHidden) {
        hiddenRowSet.add(rIdx);
        const rowData = rawMatrix[rIdx] || [];
        const sampleCells = rowData
          .slice(0, 5)
          .map((c) => String(c || '').trim())
          .filter((c) => c.length > 0);

        hiddenRows.push({
          rowIndex: rIdx,
          excelRowNumber: rIdx + 1,
          reason,
          reasonAr,
          reasonEn,
          band: 'HIDDEN_ROW',
          sampleCells,
        });
      }
    });
  }

  // Check columns in worksheet['!cols']
  const wsCols = worksheet['!cols'];
  if (wsCols && Array.isArray(wsCols)) {
    wsCols.forEach((colInfo, cIdx) => {
      if (!colInfo) return;

      let isHidden = false;
      let reason: HiddenColInfo['reason'] = 'HIDDEN_FLAG';
      let reasonAr = 'العمود مخفي في ملف Excel';
      let reasonEn = 'Column hidden in Excel';

      if (colInfo.hidden === true) {
        isHidden = true;
        reason = 'HIDDEN_FLAG';
        reasonAr = 'خاصية الإخفاء مفعلة للعمود (Hidden=true)';
        reasonEn = 'Column hidden property flag active';
      } else if (colInfo.wch === 0 || colInfo.width === 0 || colInfo.wpx === 0) {
        isHidden = true;
        reason = 'ZERO_WIDTH';
        reasonAr = 'عرض العمود مضبوط على صفر (Width=0)';
        reasonEn = 'Column width is 0';
      }

      if (isHidden) {
        hiddenColSet.add(cIdx);
        hiddenCols.push({
          colIndex: cIdx,
          colLetter: getExcelColumnLetter(cIdx),
          width: colInfo.wch || colInfo.width || 0,
          reason,
          reasonAr,
          reasonEn,
        });
      }
    });
  }

  return { hiddenRows, hiddenCols, hiddenRowSet, hiddenColSet };
}

// ----------------------------------------------------
// PHASE 3: MERGED HEADERS & HIERARCHICAL TREE RESOLVER
// ----------------------------------------------------

export function detectAndResolveMergedHeaders(
  worksheet: XLSX.WorkSheet,
  rawMatrix: any[][],
  maxCandidateHeaderRows: number = 10
): {
  depth: number;
  headerStartRow: number;
  headerEndRow: number;
  tree: HierarchicalHeaderNode[];
  resolvedColumns: ResolvedColumnHeader[];
  mergeRanges: { s: { r: number; c: number }; e: { r: number; c: number } }[];
} {
  const allMerges: { s: { r: number; c: number }; e: { r: number; c: number } }[] =
    worksheet['!merges'] || [];

  const maxRows = Math.min(maxCandidateHeaderRows, rawMatrix.length);
  if (maxRows === 0) {
    return {
      depth: 1,
      headerStartRow: 0,
      headerEndRow: 0,
      tree: [],
      resolvedColumns: [],
      mergeRanges: [],
    };
  }

  // Calculate max columns
  let totalCols = 0;
  for (let r = 0; r < maxRows; r++) {
    if (rawMatrix[r] && rawMatrix[r].length > totalCols) {
      totalCols = rawMatrix[r].length;
    }
  }

  // Step A: Find candidate header start row
  // Score rows to find where table header starts
  let bestStartRow = 0;
  let bestHeaderScore = -1;

  for (let r = 0; r < maxRows; r++) {
    const row = rawMatrix[r] || [];
    if (isRowCompletelyEmpty(row)) continue;

    // Count text density and keywords
    let score = 0;
    const nonBlankCount = row.filter((cell) => cell !== null && cell !== undefined && String(cell).trim() !== '').length;
    
    // Multi-column table header penalty: A row with only 1 or 2 cells populated when sheet has multiple columns
    // is almost always a top title banner, not a table column header!
    if (nonBlankCount < 2 && totalCols >= 3) {
      continue;
    }

    row.forEach((cell) => {
      const str = String(cell || '').trim();
      if (!str) return;
      const norm = normalizeArabicText(str);
      // High score for header-like terms
      if (/(?:مستند|كبان|تاريخ|مورد|ماده|مادة|وزن|قائم|فارغ|صافي|شلايف|شليف|اكياس|مستودع|مخزن|لوحه|سياره|سائق|كميه|كمية|رصيد|مخزون|طاقة|doc|date|material|weight|gross|tare|net|qty|bag|stock|balance)/.test(norm)) {
        score += 20;
      } else if (str.length <= 40 && !/^\d+$/.test(str)) {
        score += 4;
      }
    });

    // Reward rows with multiple populated columns across the matrix
    score += nonBlankCount * 5;

    if (score > bestHeaderScore) {
      bestHeaderScore = score;
      bestStartRow = r;
    }
  }

  // Step B: Determine header depth (how many rows constitute the header)
  // Check if merges span rows downwards from bestStartRow or if row immediately below also has sub-headers
  let headerDepth = 1;
  const headerMerges = allMerges.filter((m) => m.s.r >= bestStartRow && m.s.r <= bestStartRow + 3);

  // Check if any merge starts at bestStartRow and extends to bestStartRow + 1 or bestStartRow + 2
  let maxMergeEndRow = bestStartRow;
  headerMerges.forEach((m) => {
    if (m.s.r === bestStartRow && m.e.r > maxMergeEndRow) {
      maxMergeEndRow = m.e.r;
    }
  });

  // Check if row below bestStartRow contains complementary sub-headers
  const nextRowIdx = bestStartRow + 1;
  if (nextRowIdx < rawMatrix.length) {
    const nextRow = rawMatrix[nextRowIdx] || [];
    let nextRowSubHeaderMatches = 0;
    nextRow.forEach((cell) => {
      const str = String(cell || '').trim();
      const norm = normalizeArabicText(str);
      if (/(?:قائم|فارغ|صافي|كغم|عدد|اسم|رمز|كود|gross|tare|net|kg|code|count)/.test(norm)) {
        nextRowSubHeaderMatches++;
      }
    });

    if (nextRowSubHeaderMatches >= 2 || maxMergeEndRow > bestStartRow) {
      headerDepth = Math.max(2, maxMergeEndRow - bestStartRow + 1);
    }
  }

  // Cap headerDepth at 3
  headerDepth = Math.min(3, headerDepth);
  const headerEndRow = bestStartRow + headerDepth - 1;

  // Step C: Build multi-tier 2D header matrix with merge cell propagation
  // Create a grid of size [headerDepth][totalCols]
  const headerGrid: string[][] = [];
  for (let d = 0; d < headerDepth; d++) {
    const rIdx = bestStartRow + d;
    const row = rawMatrix[rIdx] || [];
    const gridRow: string[] = [];
    for (let c = 0; c < totalCols; c++) {
      gridRow.push(String(row[c] || '').trim());
    }
    headerGrid.push(gridRow);
  }

  // Propagate merged cells across the header grid
  headerMerges.forEach((m) => {
    if (m.s.r < bestStartRow || m.s.r > headerEndRow) return;

    // Top-left cell value
    const sourceVal = String(rawMatrix[m.s.r]?.[m.s.c] || '').trim();
    if (!sourceVal) return;

    const startGridRow = Math.max(0, m.s.r - bestStartRow);
    const endGridRow = Math.min(headerDepth - 1, m.e.r - bestStartRow);
    const startCol = Math.max(0, m.s.c);
    const endCol = Math.min(totalCols - 1, m.e.c);

    for (let gr = startGridRow; gr <= endGridRow; gr++) {
      for (let gc = startCol; gc <= endCol; gc++) {
        // Only fill if cell is empty or at the same grid row
        if (!headerGrid[gr][gc] || gr > startGridRow) {
          headerGrid[gr][gc] = sourceVal;
        }
      }
    }
  });

  // Step D: Build Hierarchical Header Tree
  const tree: HierarchicalHeaderNode[] = [];
  const level0NodesMap = new Map<string, HierarchicalHeaderNode>();

  for (let c = 0; c < totalCols; c++) {
    const topTitle = headerGrid[0][c] || `عمود ${c + 1}`;
    const normTop = normalizeArabicText(topTitle);

    // Find if this topTitle belongs to a merged range spanning columns
    const topMerge = headerMerges.find(
      (m) => m.s.r === bestStartRow && m.s.c <= c && m.e.c >= c
    );

    const colStart = topMerge ? topMerge.s.c : c;
    const colEnd = topMerge ? topMerge.e.c : c;
    const colSpan = colEnd - colStart + 1;
    const rowSpan = topMerge ? topMerge.e.r - topMerge.s.r + 1 : 1;

    const groupKey = `${normTop}_${colStart}_${colEnd}`;

    if (!level0NodesMap.has(groupKey)) {
      const node: HierarchicalHeaderNode = {
        id: `HDR-L0-${c}`,
        title: topTitle,
        normalizedTitle: normTop,
        rowStart: bestStartRow,
        rowEnd: topMerge ? topMerge.e.r : bestStartRow,
        colStart,
        colEnd,
        colSpan,
        rowSpan,
        level: 0,
        isMerged: colSpan > 1 || rowSpan > 1,
        children: [],
        leafColIndex: colSpan === 1 && headerDepth === 1 ? c : undefined,
      };
      level0NodesMap.set(groupKey, node);
      tree.push(node);
    }

    const parentNode = level0NodesMap.get(groupKey)!;

    // If depth > 1, add child sub-header node for this column
    if (headerDepth > 1) {
      const subTitle = headerGrid[headerDepth - 1][c] || topTitle;
      const normSub = normalizeArabicText(subTitle);

      // Check if sub-header already exists under parent
      const existingChild = parentNode.children.find((ch) => ch.leafColIndex === c);
      if (!existingChild) {
        parentNode.children.push({
          id: `HDR-L1-${c}`,
          title: subTitle,
          normalizedTitle: normSub,
          rowStart: headerEndRow,
          rowEnd: headerEndRow,
          colStart: c,
          colEnd: c,
          colSpan: 1,
          rowSpan: 1,
          level: 1,
          isMerged: false,
          parentId: parentNode.id,
          parentTitle: parentNode.title,
          children: [],
          leafColIndex: c,
        });
      }
    }
  }

  // Step E: Generate Resolved Flattened Column Headers with Multi-Level Field Association
  const resolvedColumns: ResolvedColumnHeader[] = [];

  for (let c = 0; c < totalCols; c++) {
    const parentHeaders: string[] = [];
    for (let d = 0; d < headerDepth - 1; d++) {
      const hText = headerGrid[d][c];
      if (hText && !parentHeaders.includes(hText)) {
        parentHeaders.push(hText);
      }
    }

    const leafTitle = headerGrid[headerDepth - 1][c] || `عمود ${c + 1}`;
    
    // Construct compound path
    let fullPath = leafTitle;
    if (parentHeaders.length > 0 && !parentHeaders.every((p) => p === leafTitle)) {
      const filteredParents = parentHeaders.filter((p) => p !== leafTitle);
      if (filteredParents.length > 0) {
        fullPath = `${filteredParents.join(' > ')} > ${leafTitle}`;
      }
    }

    const colLetter = getExcelColumnLetter(c);
    const mergeRange = allMerges.find(
      (m) => m.s.r <= headerEndRow && m.e.r >= bestStartRow && m.s.c <= c && m.e.c >= c
    );

    // Map column based on fullPath and leafTitle
    const { mappedField, fieldLabelAr, fieldLabelEn, confidence } = mapHierarchicalHeaderField(
      fullPath,
      leafTitle,
      parentHeaders
    );

    resolvedColumns.push({
      colIndex: c,
      colLetter,
      leafTitle,
      parentHeaders,
      fullPath,
      hierarchyDepth: headerDepth,
      mappedField,
      fieldLabelAr,
      fieldLabelEn,
      confidence,
      isMerged: !!mergeRange,
      mergeRange,
      isAutoMapped: mappedField !== 'unknown',
    });
  }

  return {
    depth: headerDepth,
    headerStartRow: bestStartRow,
    headerEndRow,
    tree,
    resolvedColumns,
    mergeRanges: headerMerges,
  };
}

// Map column fields taking both parent context and leaf context into account
export function mapHierarchicalHeaderField(
  fullPath: string,
  leafTitle: string,
  parentHeaders: string[]
): {
  mappedField: ColumnMapping['mappedField'];
  fieldLabelAr: string;
  fieldLabelEn: string;
  confidence: number;
} {
  const normFull = normalizeArabicText(fullPath);
  const normLeaf = normalizeArabicText(leafTitle);
  const normParents = parentHeaders.map(normalizeArabicText).join(' ');

  // 1. Material / Item Master
  if (
    normLeaf.includes('ماده') ||
    normLeaf.includes('مادة') ||
    normLeaf.includes('صنف') ||
    normLeaf.includes('خام') ||
    normLeaf.includes('وصف') ||
    normLeaf.includes('الوصف') ||
    normLeaf.includes('بيان') ||
    normLeaf.includes('البيان') ||
    normLeaf.includes('اسم الماده') ||
    normLeaf.includes('اسم المادة') ||
    normLeaf.includes('material') ||
    normLeaf.includes('description') ||
    normLeaf.includes('item')
  ) {
    return {
      mappedField: 'material',
      fieldLabelAr: 'اسم المادة / الصنف',
      fieldLabelEn: 'Material Name',
      confidence: 95,
    };
  }

  if (
    normLeaf.includes('كود') ||
    normLeaf.includes('رمز') ||
    normLeaf.includes('code')
  ) {
    return {
      mappedField: 'materialCode',
      fieldLabelAr: 'كود / رمز المادة',
      fieldLabelEn: 'Material Code',
      confidence: 95,
    };
  }

  // 2. Weights: Net, Gross, Tare, Input, Output, Damage
  // Disambiguation using parent context (e.g. parent: "بيانات الميزان والوزن" + leaf: "قائم")
  if (
    normLeaf.includes('قائم') ||
    normLeaf.includes('دخول') ||
    normLeaf.includes('gross') ||
    normFull.includes('وزن الدخول') ||
    normFull.includes('الوزن القائم')
  ) {
    return {
      mappedField: 'grossKG',
      fieldLabelAr: 'وزن الدخول (قائم)',
      fieldLabelEn: 'Gross Weight (KG)',
      confidence: 95,
    };
  }

  if (
    normLeaf.includes('فارغ') ||
    normLeaf.includes('خروج') ||
    normLeaf.includes('tare') ||
    normFull.includes('وزن الخروج') ||
    normFull.includes('الوزن الفارغ')
  ) {
    return {
      mappedField: 'tareKG',
      fieldLabelAr: 'وزن الخروج (فارغ)',
      fieldLabelEn: 'Tare Weight (KG)',
      confidence: 95,
    };
  }

  if (
    normLeaf.includes('مثروم') ||
    normLeaf.includes('مفروم') ||
    normLeaf.includes('ناتج') ||
    normLeaf.includes('output') ||
    normLeaf.includes('shredded')
  ) {
    return {
      mappedField: 'outputKG',
      fieldLabelAr: 'الوزن المثروم (الناتج)',
      fieldLabelEn: 'Output / Shredded KG',
      confidence: 95,
    };
  }

  if (
    normLeaf.includes('مدخل') ||
    normLeaf.includes('input')
  ) {
    return {
      mappedField: 'inputKG',
      fieldLabelAr: 'الوزن المدخل للثرم',
      fieldLabelEn: 'Input Weight (KG)',
      confidence: 95,
    };
  }

  if (
    normLeaf.includes('تالف') ||
    normLeaf.includes('هالك') ||
    normLeaf.includes('damage') ||
    normLeaf.includes('scrap loss')
  ) {
    return {
      mappedField: 'damageKG',
      fieldLabelAr: 'تالف إنتاج',
      fieldLabelEn: 'Production Damage (KG)',
      confidence: 95,
    };
  }

  if (
    normLeaf.includes('صافي') ||
    normLeaf.includes('net') ||
    normLeaf.includes('رصيد') ||
    normLeaf.includes('الرصيد') ||
    normLeaf.includes('مخزون') ||
    normLeaf.includes('طاقه') ||
    normLeaf.includes('طاقة') ||
    normLeaf.includes('كميه') ||
    normLeaf.includes('كمية') ||
    normLeaf.includes('وزن') ||
    normLeaf.includes('الوزن') ||
    normLeaf.includes('balance') ||
    normLeaf.includes('stock') ||
    normLeaf.includes('quantity') ||
    normLeaf.includes('qty') ||
    normFull.includes('الوزن الصافي') ||
    normFull.includes('الرصيد الحالي') ||
    normFull.includes('رصيد مخزني') ||
    normFull.includes('طاقة مخزنية')
  ) {
    const isBalance = normLeaf.includes('رصيد') || normLeaf.includes('مخزون') || normLeaf.includes('طاقه') || normLeaf.includes('طاقة') || normLeaf.includes('balance') || normLeaf.includes('stock');
    return {
      mappedField: 'netKG',
      fieldLabelAr: isBalance ? 'الرصيد الحالي (كغم)' : 'الوزن الصافي (كغم)',
      fieldLabelEn: isBalance ? 'Current Balance (KG)' : 'Net Weight (KG)',
      confidence: 95,
    };
  }

  // 3. Bulk bags (شلايف)
  if (
    normLeaf.includes('شلايف') ||
    normLeaf.includes('شليف') ||
    normLeaf.includes('اكياس') ||
    normLeaf.includes('شوال') ||
    normLeaf.includes('شوالات') ||
    normLeaf.includes('bags') ||
    normLeaf.includes('bag') ||
    normLeaf.includes('jumbo') ||
    normLeaf.includes('عدد الشلايف') ||
    normLeaf.includes('عدد الاكياس') ||
    (normLeaf.includes('عدد') && !normLeaf.includes('اسطر') && !normLeaf.includes('صفوف') && !normLeaf.includes('سجلات'))
  ) {
    return {
      mappedField: 'bulkBags',
      fieldLabelAr: 'عدد الشلايف',
      fieldLabelEn: 'Bulk Bags Count',
      confidence: 95,
    };
  }

  // 4. Supplier / Vendor
  if (
    normLeaf.includes('مورد') ||
    normLeaf.includes('مصدر') ||
    normLeaf.includes('supplier') ||
    normLeaf.includes('vendor')
  ) {
    return {
      mappedField: 'supplier',
      fieldLabelAr: 'المورد / المصدر',
      fieldLabelEn: 'Supplier / Source',
      confidence: 95,
    };
  }

  // 5. Document Reference
  if (
    normLeaf.includes('مستند') ||
    normLeaf.includes('وصل') ||
    normLeaf.includes('كبان') ||
    normLeaf.includes('وثيقه') ||
    normLeaf.includes('doc') ||
    normLeaf.includes('ref')
  ) {
    return {
      mappedField: 'docRef',
      fieldLabelAr: 'رقم المستند / الإشعار',
      fieldLabelEn: 'Document Ref No',
      confidence: 90,
    };
  }

  // 6. Date & Time
  if (normLeaf.includes('تاريخ') || normLeaf.includes('date')) {
    return {
      mappedField: 'date',
      fieldLabelAr: 'التاريخ',
      fieldLabelEn: 'Date',
      confidence: 95,
    };
  }

  if (normLeaf.includes('وقت') || normLeaf.includes('time') || normLeaf.includes('ساعه')) {
    return {
      mappedField: 'time',
      fieldLabelAr: 'الوقت',
      fieldLabelEn: 'Time',
      confidence: 95,
    };
  }

  // 7. Warehouse & Location
  if (normLeaf.includes('مستودع') || normLeaf.includes('مخزن') || normLeaf.includes('warehouse') || normLeaf.includes('wh')) {
    return {
      mappedField: 'warehouse',
      fieldLabelAr: 'المستودع / المخزن',
      fieldLabelEn: 'Warehouse',
      confidence: 90,
    };
  }

  if (normLeaf.includes('موقع') || normLeaf.includes('رف') || normLeaf.includes('عنبر') || normLeaf.includes('bay') || normLeaf.includes('rack')) {
    return {
      mappedField: 'location',
      fieldLabelAr: 'الموقع / الرف',
      fieldLabelEn: 'Location / Bay',
      confidence: 90,
    };
  }

  // 8. Driver & Vehicle
  if (normLeaf.includes('سائق') || normLeaf.includes('driver')) {
    return {
      mappedField: 'driver',
      fieldLabelAr: 'اسم السائق',
      fieldLabelEn: 'Driver Name',
      confidence: 95,
    };
  }

  if (normLeaf.includes('شاحنه') || normLeaf.includes('سياره') || normLeaf.includes('لوحه') || normLeaf.includes('truck') || normLeaf.includes('plate')) {
    return {
      mappedField: 'vehicle',
      fieldLabelAr: 'رقم الشاحنة / السيارة',
      fieldLabelEn: 'Vehicle / Truck Plate',
      confidence: 95,
    };
  }

  // 9. Notes
  if (normLeaf.includes('ملاحظ') || normLeaf.includes('بيان') || normLeaf.includes('notes') || normLeaf.includes('remarks')) {
    return {
      mappedField: 'notes',
      fieldLabelAr: 'الملاحظات',
      fieldLabelEn: 'Notes / Remarks',
      confidence: 90,
    };
  }

  return {
    mappedField: 'unknown',
    fieldLabelAr: leafTitle,
    fieldLabelEn: leafTitle,
    confidence: 0,
  };
}

// ----------------------------------------------------
// PHASE 4: STRUCTURAL BANDS SEGMENTATION
// ----------------------------------------------------

export function detectStructuralBands(
  rawMatrix: any[][],
  headerStartRow: number,
  headerEndRow: number,
  hiddenRowSet: Set<number>,
  totalCols: number
): {
  bands: StructuralBand[];
  sectionGroups: { rowIndex: number; title: string; colSpan: number }[];
  dataStartRow: number;
  dataEndRow: number;
} {
  const bands: StructuralBand[] = [];
  const sectionGroups: { rowIndex: number; title: string; colSpan: number }[] = [];
  const totalRows = rawMatrix.length;

  // 1. TITLE BAND (Upper metadata before table header)
  if (headerStartRow > 0) {
    const titleSample = rawMatrix
      .slice(0, headerStartRow)
      .map((r) => r.find((c: any) => c !== undefined && c !== null && String(c).trim() !== ''))
      .filter(Boolean)
      .join(' | ');

    bands.push({
      type: 'TITLE_BAND',
      startRow: 0,
      endRow: headerStartRow - 1,
      rowCount: headerStartRow,
      labelAr: 'عنوان وترويسة الوثيقة',
      labelEn: 'Document Title & Banner',
      badgeColor: 'bg-blue-950 text-blue-300 border-blue-500/40',
      description: 'بيانات الشركة، أرقام النماذج الرسمية، وتواريخ الإصدار',
      sampleText: titleSample || 'ترويسة المستند الرسمية',
    });
  }

  // 2. HEADER BAND (Hierarchical headers)
  bands.push({
    type: 'HEADER_BAND',
    startRow: headerStartRow,
    endRow: headerEndRow,
    rowCount: headerEndRow - headerStartRow + 1,
    labelAr: 'رؤوس الأعمدة الهرمية المدمجة',
    labelEn: 'Hierarchical Column Headers',
    badgeColor: 'bg-emerald-950 text-emerald-300 border-emerald-500/40',
    description: `عناوين الأعمدة بعمق ${headerEndRow - headerStartRow + 1} صفوف مع دمج الخلايا`,
  });

  // 3. SCAN DATA REGION FOR SECTIONS, TOTALS, AND TEMPLATES
  const candidateDataStart = headerEndRow + 1;
  let dataEndRow = candidateDataStart;
  let hasFoundTotals = false;
  let totalsStartRow = -1;
  let totalsEndRow = -1;
  let footerStartRow = -1;
  let unfilledTemplateCount = 0;

  for (let r = candidateDataStart; r < totalRows; r++) {
    // If hidden row, don't count towards normal summary unless needed
    if (hiddenRowSet.has(r)) {
      continue;
    }

    const row = rawMatrix[r] || [];

    // Check if row is completely empty or empty factory template
    if (isRowCompletelyEmpty(row)) {
      unfilledTemplateCount++;
      continue;
    }

    // Check if it's an unfilled pre-numbered template row:
    // e.g. Col 0 is a number "10", but all other columns are empty
    const nonNumberCells = row.slice(1).filter((c) => c !== undefined && c !== null && String(c).trim() !== '');
    if (/^\d+$/.test(String(row[0] || '').trim()) && nonNumberCells.length === 0) {
      unfilledTemplateCount++;
      continue;
    }

    // Check for summary keywords
    let isSummary = false;
    let summaryText = '';
    for (const cell of row) {
      if (!cell) continue;
      const str = String(cell).trim();
      const norm = normalizeArabicText(str);
      for (const kw of SUMMARY_KEYWORDS) {
        if (norm.includes(normalizeArabicText(kw))) {
          isSummary = true;
          summaryText = str;
          break;
        }
      }
      if (isSummary) break;
    }

    if (isSummary) {
      hasFoundTotals = true;
      if (totalsStartRow === -1) totalsStartRow = r;
      totalsEndRow = r;
      continue;
    }

    // If totals already found and we see more rows, they belong to footers/signatures
    if (hasFoundTotals) {
      if (footerStartRow === -1) footerStartRow = r;
      continue;
    }

    // Check for section group
    const { isGroup, title } = isSectionGroupRow(row, totalCols);
    if (isGroup) {
      sectionGroups.push({ rowIndex: r, title, colSpan: totalCols });
      continue;
    }

    // It's a genuine data row
    dataEndRow = r;
  }

  // 4. DATA BAND
  if (dataEndRow >= candidateDataStart) {
    const dataRowCount = dataEndRow - candidateDataStart + 1 - sectionGroups.length;
    bands.push({
      type: 'DATA_BAND',
      startRow: candidateDataStart,
      endRow: dataEndRow,
      rowCount: Math.max(0, dataRowCount),
      labelAr: 'نطاق الحركات التشغيلية الفعلية',
      labelEn: 'Active Transaction Records',
      badgeColor: 'bg-cyan-950 text-cyan-300 border-cyan-500/40',
      description: 'صفوف العمليات اليومية (استلام، صرف، ثرم، تشغيل)',
    });
  }

  // 5. TOTALS BAND
  if (totalsStartRow !== -1) {
    bands.push({
      type: 'TOTALS_BAND',
      startRow: totalsStartRow,
      endRow: totalsEndRow,
      rowCount: totalsEndRow - totalsStartRow + 1,
      labelAr: 'المجاميع العامة والأرصدة',
      labelEn: 'Summary Totals & Balances',
      badgeColor: 'bg-amber-950 text-amber-300 border-amber-500/40',
      description: 'صفوف تجميع الأوزان والشلايف وموازين الإغلاق',
    });
  }

  // 6. FOOTER BAND
  if (footerStartRow !== -1) {
    bands.push({
      type: 'FOOTER_BAND',
      startRow: footerStartRow,
      endRow: totalRows - 1,
      rowCount: totalRows - footerStartRow,
      labelAr: 'تذييل التواقيع والاعتمادات',
      labelEn: 'Signatures & Audit Footers',
      badgeColor: 'bg-purple-950 text-purple-300 border-purple-500/40',
      description: 'تواقيع أمناء المخازن، المشرفين، وملاحظات التفتيش',
    });
  }

  // 7. UNFILLED TEMPLATE ROWS BAND (if substantial)
  if (unfilledTemplateCount > 0) {
    bands.push({
      type: 'UNFILLED_TEMPLATE',
      startRow: dataEndRow + 1,
      endRow: totalRows - 1,
      rowCount: unfilledTemplateCount,
      labelAr: 'صفوف قوالب فارغة مستبعدة',
      labelEn: 'Isolated Empty Template Rows',
      badgeColor: 'bg-slate-950 text-slate-500 border-slate-800',
      description: `تم عزل ${unfilledTemplateCount} صف قالب فارغ مسبق الترقيم لتجنب الأخطاء الوهمية`,
    });
  }

  return {
    bands,
    sectionGroups,
    dataStartRow: candidateDataStart,
    dataEndRow,
  };
}

// ----------------------------------------------------
// FULL SHEET STRUCTURAL ANALYZER
// ----------------------------------------------------

export function analyzeSheetStructure(
  worksheet: XLSX.WorkSheet,
  sheetName: string,
  isSheetHidden: boolean = false
): SheetStructuralAnalysis {
  const usedRange = worksheet['!ref'] || 'A1:A1';
  const rawMatrix: any[][] = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    raw: true,
    defval: '',
  });

  const totalRows = rawMatrix.length;
  let totalCols = 0;
  rawMatrix.forEach((r) => {
    if (r && r.length > totalCols) totalCols = r.length;
  });

  // Step 1: Detect Hidden Rows and Columns
  const { hiddenRows, hiddenCols, hiddenRowSet } = detectHiddenRowsAndCols(
    worksheet,
    totalRows,
    totalCols,
    rawMatrix
  );

  // Step 2: Detect Merged Headers and Hierarchy
  const { depth, headerStartRow, headerEndRow, tree, resolvedColumns, mergeRanges } =
    detectAndResolveMergedHeaders(worksheet, rawMatrix, 12);

  // Step 3: Segment Structural Bands
  const { bands, sectionGroups, dataStartRow, dataEndRow } = detectStructuralBands(
    rawMatrix,
    headerStartRow,
    headerEndRow,
    hiddenRowSet,
    totalCols
  );

  // Step 4: Formulate Recommended Extraction Coordinates
  const estimatedDataRows = Math.max(0, dataEndRow - dataStartRow + 1 - hiddenRows.filter((hr) => hr.rowIndex >= dataStartRow && hr.rowIndex <= dataEndRow).length);

  return {
    sheetName,
    isSheetHidden,
    dimensions: {
      rowCount: totalRows,
      colCount: totalCols,
      usedRange,
    },
    structuralBands: bands,
    headerHierarchy: {
      depth,
      tree,
      resolvedColumns,
      mergeRanges,
      headerStartRow,
      headerEndRow,
    },
    hiddenElements: {
      hiddenRows,
      hiddenCols,
      totalHiddenRows: hiddenRows.length,
      totalHiddenCols: hiddenCols.length,
    },
    sectionGroups,
    recommendedExtraction: {
      headerRowIndex: headerStartRow,
      headerEndRowIndex: headerEndRow,
      dataStartRow,
      dataEndRow,
      skipHiddenRows: true,
      estimatedDataRows,
    },
    rawMatrix,
  };
}

// ----------------------------------------------------
// FULL WORKBOOK HIERARCHICAL STRUCTURE DETECTOR
// ----------------------------------------------------

export function detectWorkbookHierarchy(
  workbook: XLSX.WorkBook,
  fileName: string,
  fileSize: string
): HierarchicalWorkbookReport {
  const visibleSheets: string[] = [];
  const hiddenSheets: string[] = [];
  const sheetAnalyses: SheetStructuralAnalysis[] = [];

  const wbSheetsMetadata = workbook.Workbook?.Sheets || [];

  workbook.SheetNames.forEach((name, idx) => {
    // Check if sheet is hidden
    const meta = wbSheetsMetadata[idx];
    const isHidden = meta ? meta.Hidden === 1 || meta.Hidden === 2 : false;

    if (isHidden) {
      hiddenSheets.push(name);
    } else {
      visibleSheets.push(name);
    }

    const worksheet = workbook.Sheets[name];
    if (worksheet) {
      const sheetAnalysis = analyzeSheetStructure(worksheet, name, isHidden);
      sheetAnalyses.push(sheetAnalysis);
    }
  });

  const totalHiddenRows = sheetAnalyses.reduce((sum, s) => sum + s.hiddenElements.totalHiddenRows, 0);
  const totalHiddenCols = sheetAnalyses.reduce((sum, s) => sum + s.hiddenElements.totalHiddenCols, 0);
  const totalHeaderMerges = sheetAnalyses.reduce((sum, s) => sum + s.headerHierarchy.mergeRanges.length, 0);
  const maxHeaderDepth = Math.max(...sheetAnalyses.map((s) => s.headerHierarchy.depth), 1);
  const estimatedDataRecords = sheetAnalyses.reduce((sum, s) => sum + s.recommendedExtraction.estimatedDataRows, 0);

  return {
    fileName,
    fileSize,
    sheetCount: workbook.SheetNames.length,
    visibleSheets,
    hiddenSheets,
    sheets: sheetAnalyses,
    overallStats: {
      totalHiddenRows,
      totalHiddenCols,
      totalHeaderMerges,
      maxHeaderDepth,
      estimatedDataRecords,
    },
    generatedAt: new Date().toISOString(),
  };
}
