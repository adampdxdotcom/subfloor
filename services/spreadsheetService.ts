import * as XLSX from 'xlsx';
import { ExcelSheetData, ParsedRow } from '../types';

export const readExcelFile = (file: File): Promise<ExcelSheetData> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        
        // Convert to JSON
        const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        
        if (jsonData.length === 0) {
          reject(new Error("File is empty"));
          return;
        }

        const headers = jsonData[0] as string[];
        const rows = XLSX.utils.sheet_to_json(sheet); // Objects with keys as headers

        resolve({
          fileName: file.name,
          headers,
          rows,
        });
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = (error) => reject(error);
    reader.readAsBinaryString(file);
  });
};

/**
 * Returns the cleaned data as an array of objects, ready for the Column Mapper.
 * Instead of downloading a CSV, we pass this data back to the main app.
 */
export const getCleanedCsvData = (rows: ParsedRow[], targetColumn: string): any[] => {
  return rows.map(row => {
    // Start with a shallow copy of the original data to retain all columns
    const newRow = { ...row.originalData };
    
    // If we have an extracted size, replace the original column's content
    // This effectively "cleans" the messy description column
    if (row.extractedSize) {
      newRow[targetColumn] = row.extractedSize;
    }
    
    return newRow;
  });
};

/**
 * Standardizes size strings for initial automation.
 * If strictly a dimension (12 x 24), formats to 12"x24".
 * Otherwise, returns the raw string trimmed (preserving case/spaces).
 */
export const normalizeSize = (raw: string): string => {
    if (!raw) return '';
    const s = raw.trim();

    // STRICT check: is it a standard number x number pattern?
    // Matches: 12x24, 12.5 x 24.5, 12" x 24", 10mm x 20mm
    const standardPattern = /^(\d+(?:\.\d+)?)\s*(?:["']|mm|cm|in)?\s*[xX]\s*(\d+(?:\.\d+)?)\s*(?:["']|mm|cm|in)?$/i;
    const match = s.match(standardPattern);
    
    if (match) {
        // It is a standard size, standardize it to 12"x12" format
        // This ensures initial scan produces clean output
        return `${match[1]}"x${match[2]}"`;
    }

    // If it's not a strict standard pattern (e.g. "Size Large", "Custom 12x12"), return as is.
    return s;
};