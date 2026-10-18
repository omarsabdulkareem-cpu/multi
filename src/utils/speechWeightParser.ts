/**
 * Speech Weight Parser for Weighbridge Logistics (Scale In / Scale Out)
 * Converts spoken Arabic and English weight dictations into numeric KG and bag counts.
 * Examples:
 * - "ثمانية وعشرين ألف وخمسمية" -> 28500 KG
 * - "تسعة وعشرين طن ونص" -> 29500 KG
 * - "32400 كغم" -> 32400 KG
 * - "عشرين شليف" -> 20 bags
 * - "twenty eight thousand five hundred" -> 28500 KG
 * - "28.5 tons" -> 28500 KG
 */

export interface ParsedVoiceScaleData {
  weightKG: number | null;
  bulkBagsCount: number | null;
  vehiclePlate: string | null;
  rawText: string;
  matchedPattern: string | null;
  explanationAr: string;
  explanationEn: string;
  confidence: number; // 0 to 1
}

// Convert Eastern Arabic numerals (٠-٩) and Persian numerals to Western digits (0-9)
export function normalizeNumerals(text: string): string {
  const easternDigits: { [key: string]: string } = {
    '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
    '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
    '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4',
    '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9',
  };
  return text.replace(/[٠-٩۰-۹]/g, (d) => easternDigits[d] || d);
}

// Arabic number words mapping
const AR_ONES: { [key: string]: number } = {
  'صفر': 0, 'واحد': 1, 'واحدة': 1, 'اثنين': 2, 'اثنان': 2, 'اثنتين': 2,
  'ثلاثة': 3, 'ثلاث': 3, 'تلاتة': 3, 'تلات': 3,
  'أربعة': 4, 'أربع': 4, 'اربعة': 4, 'اربع': 4,
  'خمسة': 5, 'خمس': 5,
  'ستة': 6, 'ست': 6,
  'سبعة': 7, 'سبع': 7,
  'ثمانية': 8, 'ثمان': 8, 'تمنية': 8, 'تمانية': 8,
  'تسعة': 9, 'تسع': 9,
  'عشرة': 10, 'عشر': 10,
  'أحد عشر': 11, 'احد عشر': 11, 'إحدى عشر': 11, 'دعش': 11, 'هدعش': 11, 'داعش': 11,
  'اثنا عشر': 12, 'اثني عشر': 12, 'اثناعش': 12, 'طنعش': 12,
  'ثلاثة عشر': 13, 'تلطعش': 13, 'تلتعش': 13,
  'أربعة عشر': 14, 'اربعه عشر': 14, 'أربعطعش': 14, 'ارباطعش': 14,
  'خمسة عشر': 15, 'خمستعش': 15, 'خمسطعش': 15,
  'ستة عشر': 16, 'ستعش': 16, 'ستطعش': 16,
  'سبعة عشر': 17, 'سبعتعش': 17, 'سبطعش': 17,
  'ثمانية عشر': 18, 'تمنتعش': 18, 'تمانتعش': 18,
  'تسعة عشر': 19, 'تسعتعش': 19, 'تسعطعش': 19,
};

const AR_TENS: { [key: string]: number } = {
  'عشرين': 20, 'عشرون': 20,
  'ثلاثين': 30, 'ثلاثون': 30, 'تلاتين': 30,
  'أربعين': 40, 'أربعون': 40, 'اربعين': 40, 'اربعون': 40,
  'خمسين': 50, 'خمسون': 50,
  'ستين': 60, 'ستون': 60,
  'سبعين': 70, 'سبعون': 70,
  'ثمانين': 80, 'ثمانون': 80, 'تمانين': 80, 'تمنين': 80,
  'تسعين': 90, 'تسعون': 90,
};

const AR_HUNDREDS: { [key: string]: number } = {
  'مئة': 100, 'مائة': 100, 'مية': 100,
  'مئتان': 200, 'مئتين': 200, 'ميتين': 200,
  'ثلاثمئة': 300, 'ثلاثمائة': 300, 'تلت مية': 300, 'تلتماية': 300, 'ثلاث مية': 300,
  'أربعمئة': 400, 'أربعمائة': 400, 'اربعمية': 400, 'اربع مية': 400, 'أربع مية': 400,
  'خمسمئة': 500, 'خمسمائة': 500, 'خمس مية': 500, 'خمسمية': 500,
  'ستمئة': 600, 'ستمائة': 600, 'ست مية': 600, 'ستمية': 600,
  'سبعمئة': 700, 'سبعمائة': 700, 'سبع مية': 700, 'سبعمية': 700,
  'ثمانمئة': 800, 'ثمانمائة': 800, 'تمان مية': 800, 'تمنمية': 800, 'ثمان مية': 800,
  'تسعمئة': 900, 'تسعمائة': 900, 'تسع مية': 900, 'تسعمية': 900,
};

const EN_WORDS: { [key: string]: number } = {
  'zero': 0, 'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
  'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
  'eleven': 11, 'twelve': 12, 'thirteen': 13, 'fourteen': 14, 'fifteen': 15,
  'sixteen': 16, 'seventeen': 17, 'eighteen': 18, 'nineteen': 19,
  'twenty': 20, 'thirty': 30, 'forty': 40, 'fifty': 50,
  'sixty': 60, 'seventy': 70, 'eighty': 80, 'ninety': 90,
  'hundred': 100, 'thousand': 1000,
};

/**
 * Parse verbal Arabic number segment (up to 999)
 */
function parseArabicSubThousand(phrase: string): number {
  let total = 0;
  const cleaned = phrase.replace(/\s+و\s+/g, ' ').replace(/^و\s+/, '').trim();
  const tokens = cleaned.split(/\s+/);

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    // Check hundreds
    if (AR_HUNDREDS[token] !== undefined) {
      total += AR_HUNDREDS[token];
      continue;
    }
    // Check two-word hundreds like "تلت مية" or "خمس مية"
    if (i < tokens.length - 1) {
      const twoWord = `${token} ${tokens[i + 1]}`;
      if (AR_HUNDREDS[twoWord] !== undefined) {
        total += AR_HUNDREDS[twoWord];
        i++;
        continue;
      }
    }
    // Check tens
    if (AR_TENS[token] !== undefined) {
      total += AR_TENS[token];
      continue;
    }
    // Check compound teens like "أحد عشر"
    if (i < tokens.length - 1) {
      const twoWord = `${token} ${tokens[i + 1]}`;
      if (AR_ONES[twoWord] !== undefined) {
        total += AR_ONES[twoWord];
        i++;
        continue;
      }
    }
    // Check ones
    if (AR_ONES[token] !== undefined) {
      total += AR_ONES[token];
      continue;
    }
  }

  return total;
}

/**
 * Comprehensive parser for Arabic Spoken Numbers like:
 * "ثمانية وعشرين ألف وخمسمية" -> 28500
 * "خمسة وثلاثين ألف وأربعمائة وعشرين" -> 35420
 * "ألفين وسبعمية" -> 2700
 */
export function parseArabicSpokenNumber(text: string): number | null {
  // Normalize text
  let s = text
    .replace(/[,\-_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // If text already has raw digits e.g. "28500" or "28 500"
  const digitMatch = s.match(/\b\d{3,6}\b/);
  if (digitMatch) {
    return parseInt(digitMatch[0], 10);
  }

  // Check thousands pattern e.g. "(...) ألف و (...)" or "(...) الف (...)"
  const thousandSplit = s.split(/\b(ألف|الف|آلاف|الاف)\b/);
  if (thousandSplit.length >= 3) {
    const thousandsPartStr = thousandSplit[0].trim();
    // After thousand keyword, join rest
    const remainderPartStr = thousandSplit.slice(2).join(' ').trim();

    let thousandsCount = 1;
    if (thousandsPartStr === '' || thousandsPartStr === 'واحد') {
      thousandsCount = 1;
    } else if (thousandsPartStr === 'اثنين' || thousandsPartStr === 'ألفين' || thousandsPartStr === 'الفين') {
      thousandsCount = 2;
    } else {
      const parsedThousands = parseArabicSubThousand(thousandsPartStr);
      thousandsCount = parsedThousands > 0 ? parsedThousands : 1;
    }

    const remainder = remainderPartStr ? parseArabicSubThousand(remainderPartStr) : 0;
    return thousandsCount * 1000 + remainder;
  }

  // Check dual thousands "ألفين" / "الفين"
  if (s.includes('ألفين') || s.includes('الفين')) {
    const rest = s.replace(/ألفين|الفين/, '').replace(/^و/, '').trim();
    const rem = rest ? parseArabicSubThousand(rest) : 0;
    return 2000 + rem;
  }

  // Check standalone hundreds/tens e.g. "خمسمية" -> 500
  const subThousand = parseArabicSubThousand(s);
  if (subThousand > 0) {
    return subThousand;
  }

  return null;
}

/**
 * Parse English spoken numbers (e.g., "twenty eight thousand five hundred")
 */
export function parseEnglishSpokenNumber(text: string): number | null {
  const lower = text.toLowerCase().replace(/and\s+/g, '').replace(/[\-_]/g, ' ');
  const tokens = lower.split(/\s+/);

  let current = 0;
  let total = 0;
  let hasNumber = false;

  for (const token of tokens) {
    // Digits directly
    if (/^\d+$/.test(token)) {
      current += parseInt(token, 10);
      hasNumber = true;
      continue;
    }

    const val = EN_WORDS[token];
    if (val !== undefined) {
      hasNumber = true;
      if (val === 1000) {
        current = current === 0 ? 1000 : current * 1000;
        total += current;
        current = 0;
      } else if (val === 100) {
        current = current === 0 ? 100 : current * 100;
      } else {
        current += val;
      }
    }
  }

  total += current;
  return hasNumber ? total : null;
}

/**
 * Main parser entry point for receiving scale voice entry
 */
export function parseVoiceScaleEntry(
  rawTranscript: string,
  mode: 'GROSS' | 'TARE' | 'ALL' = 'ALL'
): ParsedVoiceScaleData {
  const normalized = normalizeNumerals(rawTranscript).trim();

  let weightKG: number | null = null;
  let bulkBagsCount: number | null = null;
  let vehiclePlate: string | null = null;
  let matchedPattern: string | null = null;
  let confidence = 0;

  // 1. Check for Bulk Bags ("شليف", "شلايف", "أكياس", "bags")
  const bagMatch = normalized.match(
    /(\d+|واحد|اثنين|ثلاثة|أربعة|خمسة|ستة|سبعة|ثمانية|تسعة|عشرة|عشرين|ثلاثين|أربعين|خمسين)\s*(?:شليف|شلايف|شليفة|كيس|أكياس|bag|bags)\b/i
  );
  if (bagMatch) {
    const rawBagVal = bagMatch[1];
    if (/^\d+$/.test(rawBagVal)) {
      bulkBagsCount = parseInt(rawBagVal, 10);
    } else {
      const parsedBagNum = parseArabicSubThousand(rawBagVal) || parseEnglishSpokenNumber(rawBagVal);
      if (parsedBagNum) bulkBagsCount = parsedBagNum;
    }
  }

  // 2. Check for Tons pattern: e.g., "28.5 طن", "28 طن ونص", "ثلاثين طن", "29 tons"
  const tonRegex = /(\d+(?:\.\d+)?)\s*(?:طن|اطنان|أطنان|ton|tons)\b/i;
  const tonMatch = normalized.match(tonRegex);

  if (tonMatch) {
    const tons = parseFloat(tonMatch[1]);
    let extraKg = 0;
    if (normalized.includes('ونص') || normalized.includes('ونصف') || normalized.includes('and half')) {
      extraKg = 500;
    } else if (normalized.includes('وربع') || normalized.includes('and quarter')) {
      extraKg = 250;
    } else if (normalized.includes('وثلاث ارباع') || normalized.includes('and three quarter')) {
      extraKg = 750;
    }
    weightKG = Math.round(tons * 1000 + extraKg);
    matchedPattern = 'TON_DECIMAL_PATTERN';
    confidence = 0.95;
  }

  // Verbal tons like "ثمانية وعشرين طن ونص"
  if (weightKG === null) {
    const verbalTonMatch = normalized.match(/(.+?)\s*(?:طن|اطنان|أطنان|ton|tons)/i);
    if (verbalTonMatch) {
      const tonWord = verbalTonMatch[1].trim();
      const tonsVal = parseArabicSpokenNumber(tonWord) || parseEnglishSpokenNumber(tonWord);
      if (tonsVal && tonsVal > 0 && tonsVal < 100) {
        let extraKg = 0;
        if (normalized.includes('ونص') || normalized.includes('ونصف')) extraKg = 500;
        if (normalized.includes('وربع')) extraKg = 250;
        weightKG = tonsVal * 1000 + extraKg;
        matchedPattern = 'VERBAL_TONS_PATTERN';
        confidence = 0.92;
      }
    }
  }

  // 3. Direct numeric extraction (e.g. "28500", "28,500 كغم", "وزن الدخول 31200")
  if (weightKG === null) {
    // Look for numbers typically between 500 KG and 80,000 KG (weighbridge operational range)
    const directNumMatch = normalized.match(/\b(\d{1,2}[\s,.]?\d{3})\b/);
    if (directNumMatch) {
      const cleanedNum = directNumMatch[1].replace(/[\s,.]/g, '');
      const parsed = parseInt(cleanedNum, 10);
      if (parsed >= 100 && parsed <= 90000) {
        weightKG = parsed;
        matchedPattern = 'DIRECT_NUMERIC_DIGITS';
        confidence = 0.98;
      }
    }
  }

  // 4. Arabic Spoken Number parsing e.g. "ثمانية وعشرين ألف وخمسمية"
  if (weightKG === null) {
    // Filter out keywords like "وزن الدخول", "وزن الخروج", "شاحنة", "كغم"
    const cleanedForArabic = normalized
      .replace(/وزن\s+(?:الدخول|الخروج|القائم|الفارغ|الصافي)/g, '')
      .replace(/(?:كيلو|كغم|كيلوغرام|كغ|kg|kilograms?)/gi, '')
      .trim();

    const arabicParsed = parseArabicSpokenNumber(cleanedForArabic);
    if (arabicParsed && arabicParsed >= 100 && arabicParsed <= 90000) {
      weightKG = arabicParsed;
      matchedPattern = 'ARABIC_SPOKEN_NUMBER';
      confidence = 0.90;
    }
  }

  // 5. English Spoken Number parsing e.g. "twenty-eight thousand five hundred"
  if (weightKG === null) {
    const englishParsed = parseEnglishSpokenNumber(normalized);
    if (englishParsed && englishParsed >= 100 && englishParsed <= 90000) {
      weightKG = englishParsed;
      matchedPattern = 'ENGLISH_SPOKEN_NUMBER';
      confidence = 0.88;
    }
  }

  // 6. Check for vehicle plate mention (e.g. "بغداد 12345", "أربيل 8941", "Baghdad 4521")
  const plateMatch = normalized.match(
    /(بغداد|أربيل|اربيل|البصرة|بصرة|النجف|كربلاء|بابل|كركوك|السليمانية|سليمانية|دهوك|نينوى|الانبار|واسط|ميسان|ذي قار|المثنى|صلاح الدين|Baghdad|Erbil|Basra)\s*(\d{3,6})/i
  );
  if (plateMatch) {
    vehiclePlate = `${plateMatch[1]} ${plateMatch[2]}`;
  }

  // Generate clear explanations for the operator
  let explanationAr = '';
  let explanationEn = '';

  if (weightKG !== null) {
    explanationAr = `تم استخراج الوزن: ${weightKG.toLocaleString()} كغم`;
    explanationEn = `Extracted Weight: ${weightKG.toLocaleString()} KG`;
    if (bulkBagsCount !== null) {
      explanationAr += ` | ${bulkBagsCount} شليف`;
      explanationEn += ` | ${bulkBagsCount} Bags`;
    }
    if (vehiclePlate) {
      explanationAr += ` | لوحة: ${vehiclePlate}`;
      explanationEn += ` | Plate: ${vehiclePlate}`;
    }
  } else {
    explanationAr = 'لم يتم تمييز رقم وزن صالح (مثال: "28500 كغم" أو "ثمانية وعشرين ألف وخمسمية")';
    explanationEn = 'Could not detect a valid weight (e.g., "28,500 KG" or "28.5 tons")';
  }

  return {
    weightKG,
    bulkBagsCount,
    vehiclePlate,
    rawText: normalized,
    matchedPattern,
    explanationAr,
    explanationEn,
    confidence,
  };
}
