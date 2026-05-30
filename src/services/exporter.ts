import * as XLSX from 'xlsx';
import { Bill } from '../types';
import { db } from '../database/db';

/**
 * Generate and download standard Microsoft Excel spreadsheet offline
 */
export function exportToExcel(bills: Bill[], title = 'Logistics_Bills'): void {
  if (bills.length === 0) return;

  // Find the most frequent month and year among the bills to label the header
  let monthName = 'APRIL';
  let year = '2026';
  
  const dates = bills.map(b => b.date).filter(Boolean);
  if (dates.length > 0) {
    const firstDateParts = dates[0].split('.');
    if (firstDateParts.length === 3) {
      const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
      const mIdx = parseInt(firstDateParts[1]) - 1;
      monthName = (MONTHS[mIdx] || 'APRIL').toUpperCase();
      year = firstDateParts[2];
    }
  }

  const rows: any[][] = [];
  
  // Row 1: Credentials
  rows.push(['FRANK LINK LOGISTICS', '', '27AADFF7532P1ZY', '', 'password', 'Franklink@18']);
  // Row 2: Empty
  rows.push([]);
  // Row 3: Subheader
  rows.push([`FOR THE MONTH OF ${monthName} ${year}`]);
  // Row 4: Empty
  rows.push([]);
  // Row 5: Sales Label
  rows.push(['SALES INVOICES (OUTGOING BILLS)']);
  // Row 6: Columns
  rows.push(['SR NO', 'PARTICULARS', 'GSTIN', 'Date', 'Non taxable', 'Net', 'IGST', 'CGST', 'SGST', 'TOTAL', 'Rate']);
  // Row 7: Empty spacer
  rows.push([]);
  
  const salesBills = bills.filter(b => b.billType === 'SALES');
  const purchaseBills = bills.filter(b => b.billType === 'PURCHASE');
  
  // Sales items start at Row 8
  const salesStartRow = 8;
  if (salesBills.length === 0) {
    rows.push([1, '', '', '', '', '', '', '', '', '', '']);
  } else {
    salesBills.forEach((b, idx) => {
      rows.push([
        idx + 1,
        b.company,
        b.gstin,
        b.date,
        b.jwrAmount || '',
        b.netAmount || '',
        b.igstAmount || '',
        b.cgstAmount || '',
        b.sgstAmount || '',
        b.totalAmount || '',
        ''
      ]);
    });
  }
  
  const salesEndRow = salesStartRow + (salesBills.length > 0 ? salesBills.length - 1 : 0);
  const salesTotalRow = salesEndRow + 1;
  
  // Sales total row
  rows.push([
    '',
    '',
    '',
    '',
    `=SUM(E${salesStartRow}:E${salesEndRow})`,
    `=SUM(F${salesStartRow}:F${salesEndRow})`,
    `=SUM(G${salesStartRow}:G${salesEndRow})`,
    `=SUM(H${salesStartRow}:H${salesEndRow})`,
    `=SUM(I${salesStartRow}:I${salesEndRow})`,
    `=SUM(J${salesStartRow}:J${salesEndRow})`,
    ''
  ]);
  
  // Spacer rows
  rows.push([]);
  rows.push([]);
  
  // Purchases Section
  rows.push(['PURCHASE INVOICES (INCOMING BILLS)']);
  rows.push(['SR NO', 'PARTICULARS', 'GSTIN', 'Date', 'Non taxable', 'Net', 'IGST', 'CGST', 'SGST', 'TOTAL', 'Rate']);
  rows.push([]);
  
  const purchStartRow = rows.length + 1;
  if (purchaseBills.length === 0) {
    rows.push([1, '', '', '', '', '', '', '', '', '', '']);
  } else {
    purchaseBills.forEach((b, idx) => {
      rows.push([
        idx + 1,
        b.company,
        b.gstin,
        b.date,
        b.jwrAmount || '',
        b.netAmount || '',
        b.igstAmount || '',
        b.cgstAmount || '',
        b.sgstAmount || '',
        b.totalAmount || '',
        ''
      ]);
    });
  }
  
  const purchEndRow = purchStartRow + (purchaseBills.length > 0 ? purchaseBills.length - 1 : 0);
  const purchTotalRow = purchEndRow + 1;
  
  // Purchase total row
  rows.push([
    '',
    '',
    '',
    '',
    `=SUM(E${purchStartRow}:E${purchEndRow})`,
    `=SUM(F${purchStartRow}:F${purchEndRow})`,
    `=SUM(G${purchStartRow}:G${purchEndRow})`,
    `=SUM(H${purchStartRow}:H${purchEndRow})`,
    `=SUM(I${purchStartRow}:I${purchEndRow})`,
    `=SUM(J${purchStartRow}:J${purchEndRow})`,
    ''
  ]);
  
  // Spacer rows
  rows.push([]);
  rows.push([]);
  
  // Tax Payment Section
  const payTaxHeaderRow = rows.length + 1;
  rows.push(['', 'Payment of Tax']);
  rows.push(['', '', '', '', 'ITC', '', `=SUM(C${payTaxHeaderRow + 3}:F${payTaxHeaderRow + 3})`]);
  rows.push(['', 'Particulars', 'Tax payable', 'IGST', 'CGST', 'SGST', 'Tax Payable']);
  rows.push([]);
  
  rows.push(['', 'IGST', `=+G${salesTotalRow}`, `=+G${purchTotalRow}`, 0, 0, `=C${payTaxHeaderRow + 4}-D${payTaxHeaderRow + 4}-E${payTaxHeaderRow + 4}-F${payTaxHeaderRow + 4}`]);
  rows.push(['', 'CGST', `=+H${salesTotalRow}`, '', `=+H${purchTotalRow}`, '', `=C${payTaxHeaderRow + 5}-E${payTaxHeaderRow + 5}`]);
  rows.push(['', 'SGST', `=+I${salesTotalRow}`, '', '', `=+I${purchTotalRow}`, `=C${payTaxHeaderRow + 6}-F${payTaxHeaderRow + 6}`]);
  rows.push(['', 'Cess', 0, '', '', 0, `=C${payTaxHeaderRow + 7}-F${payTaxHeaderRow + 7}`]);
  rows.push([]);
  rows.push(['', '', `=SUM(C${payTaxHeaderRow + 4}:C${payTaxHeaderRow + 7})`, `=SUM(D${payTaxHeaderRow + 4}:D${payTaxHeaderRow + 7})`, `=SUM(E${payTaxHeaderRow + 4}:E${payTaxHeaderRow + 7})`, `=SUM(F${payTaxHeaderRow + 4}:F${payTaxHeaderRow + 7})`, `=SUM(G${payTaxHeaderRow + 4}:G${payTaxHeaderRow + 7})`]);

  // Convert AOA to SheetJS cell values (formatting strings starting with '=' into true formulas)
  const cellRows = rows.map(row => {
    return row.map(val => {
      if (typeof val === 'string' && val.startsWith('=')) {
        return { t: 'n', f: val.substring(1) };
      }
      return val;
    });
  });

  const worksheet = XLSX.utils.aoa_to_sheet(cellRows);
  
  // Set column widths matching original template layout exactly
  worksheet['!cols'] = [
    { wch: 6 },   // A: SR NO
    { wch: 30 },  // B: PARTICULARS
    { wch: 18 },  // C: GSTIN
    { wch: 12 },  // D: Date
    { wch: 14 },  // E: Non taxable
    { wch: 14 },  // F: Net
    { wch: 12 },  // G: IGST
    { wch: 12 },  // H: CGST
    { wch: 12 },  // I: SGST
    { wch: 14 },  // J: TOTAL
    { wch: 8 }    // K: Rate
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, `${monthName} ${year}`);

  // Trigger browser binary download
  XLSX.writeFile(workbook, `Frank_Link_Bills_${monthName}_${year}_${title}.xlsx`);
}

/**
 * Initiates local browser JSON backup download
 */
export function downloadBackup(bills: Bill[]): void {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(bills, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", `Frank_Link_Database_Backup_${new Date().toISOString().split('T')[0]}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

/**
 * Read backup JSON file and save to Dexie DB
 */
export function importBackup(file: File): Promise<{ successCount: number; failed: boolean; message: string }> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const content = event.target?.result as string;
        const parsed = JSON.parse(content);
        
        if (!Array.isArray(parsed)) {
          resolve({ successCount: 0, failed: true, message: 'Invalid backup format. Expected a JSON array of bills.' });
          return;
        }

        let count = 0;
        for (const record of parsed) {
          // Validate required parameters dynamically
          if (record.company && record.date && record.billType && record.totalAmount !== undefined) {
            await db.saveBill({
              id: record.id,
              company: record.company,
              gstin: record.gstin || '',
              date: record.date,
              billType: record.billType === 'SALES' ? 'SALES' : 'PURCHASE',
              netAmount: parseFloat(record.netAmount) || 0,
              cgstAmount: parseFloat(record.cgstAmount) || 0,
              sgstAmount: parseFloat(record.sgstAmount) || 0,
              igstAmount: parseFloat(record.igstAmount) || 0,
              jwrAmount: parseFloat(record.jwrAmount) || 0,
              totalAmount: parseFloat(record.totalAmount) || 0,
              syncedToSheets: !!record.syncedToSheets,
              processedAt: record.processedAt || new Date().toISOString()
            });
            count++;
          }
        }

        resolve({ successCount: count, failed: false, message: `Successfully imported ${count} records!` });
      } catch (err: any) {
        resolve({ successCount: 0, failed: true, message: `Import failed: ${err.message}` });
      }
    };
    reader.readAsText(file);
  });
}
