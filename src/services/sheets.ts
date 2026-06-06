import { Bill } from '../types';
import { db } from '../database/db';

let cachedToken: string | null = null;
let tokenExpiry = 0;

/* ── Base64 & WebCrypto Helpers ────────────────────────────────────────── */

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

function arrayBufferToBase64Url(arrayBuffer: ArrayBuffer): string {
  const bytes = new Uint8Array(arrayBuffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = window.btoa(binary);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function strToBase64Url(str: string): string {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(str);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const pemHeader = "-----BEGIN PRIVATE KEY-----";
  const pemFooter = "-----END PRIVATE KEY-----";
  
  let pemContents = pem.replace(/\\n/g, '\n');
  if (pemContents.includes(pemHeader)) {
    pemContents = pemContents.substring(pemContents.indexOf(pemHeader) + pemHeader.length);
  }
  if (pemContents.includes(pemFooter)) {
    pemContents = pemContents.substring(0, pemContents.indexOf(pemFooter));
  }
  pemContents = pemContents.replace(/\s+/g, '');
  
  const derBuffer = base64ToArrayBuffer(pemContents);
  
  return await window.crypto.subtle.importKey(
    "pkcs8",
    derBuffer,
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: { name: "SHA-256" }
    },
    false,
    ["sign"]
  );
}

/* ── Google Sheets Auth (OAuth Service Account) ────────────────────────── */

async function getAccessToken(saJsonString: string): Promise<string | null> {
  if (cachedToken && Date.now() < tokenExpiry - 120000) {
    return cachedToken;
  }

  if (!saJsonString || !saJsonString.trim()) {
    return null;
  }

  let sa: any;
  try {
    sa = JSON.parse(saJsonString);
  } catch (e) {
    console.error('[Sheets] Failed to parse service account JSON:', e);
    return null;
  }

  if (!sa.private_key || !sa.client_email) {
    console.warn('[Sheets] Service Account missing client_email or private_key.');
    return null;
  }

  const header = {
    alg: "RS256",
    typ: "JWT"
  };

  const now = Math.floor(Date.now() / 1000);
  const claimSet = {
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/spreadsheets",
    aud: sa.token_uri || "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now
  };

  const tokenInput = `${strToBase64Url(JSON.stringify(header))}.${strToBase64Url(JSON.stringify(claimSet))}`;
  const key = await importPrivateKey(sa.private_key);
  
  const encoder = new TextEncoder();
  const signatureBuffer = await window.crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    encoder.encode(tokenInput)
  );

  const jwt = `${tokenInput}.${arrayBufferToBase64Url(signatureBuffer)}`;
  const tokenUrl = sa.token_uri || "https://oauth2.googleapis.com/token";
  
  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OAuth token exchange failed: ${err}`);
  }

  const tokenData = await res.json();
  cachedToken = tokenData.access_token;
  tokenExpiry = Date.now() + (tokenData.expires_in * 1000);
  
  return cachedToken;
}

/* ── API Query Helpers ─────────────────────────────────────────────────── */

async function apiCall(path: string, options: any = {}, sheetsId: string, saJson: string, apiKey: string): Promise<any> {
  if (!sheetsId) throw new Error('Spreadsheet ID is not configured. Go to Settings.');

  const token = await getAccessToken(saJson);
  let url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetsId}${path}`;
  
  const headers = options.headers || {};
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  } else {
    if (!apiKey) throw new Error('Google Credentials (Service Account or API Key) not configured.');
    const separator = url.includes('?') ? '&' : '?';
    url += `${separator}key=${apiKey}`;
  }

  headers['Content-Type'] = 'application/json';
  options.headers = headers;

  const res = await fetch(url, options);
  if (!res.ok) {
    const body = await res.text();
    let message = body;
    try {
      const parsed = JSON.parse(body);
      message = parsed.error?.message || body;
    } catch {}
    throw new Error(`Google Sheets API error (${res.status}): ${message}`);
  }
  return await res.json();
}

/* ── Month Sheet Creator and Formatting ────────────────────────────────── */

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

async function writeSkeleton(sheetName: string, billDate: string, sheetsId: string, saJson: string, apiKey: string) {
  const dateParts = billDate.split('.');
  const monthIndex = parseInt(dateParts[1]) - 1;
  const year = dateParts[2];
  const monthName = MONTHS[monthIndex] || 'MONTH';

  const skeleton = [
    ['FRANK LINK LOGISTICS', '', '27AADFF7532P1ZY', '', 'password', 'Franklink@18'],
    [],
    [`FOR THE MONTH OF ${monthName.toUpperCase()} ${year}`],
    [],
    ['SALES INVOICES (OUTGOING BILLS)'],
    ['INVOICE NO', 'PARTICULARS', 'GSTIN', 'Date', 'Non taxable', 'Net', 'IGST', 'CGST', 'SGST', 'TOTAL', 'Rate'],
    [],
    ['', '', '', '', '', '', '', '', '', '', ''],
    ['', '', '', '', `=SUM(E8:E8)`, `=SUM(F8:F8)`, `=SUM(G8:G8)`, `=SUM(H8:H8)`, `=SUM(I8:I8)`, `=SUM(J8:J8)`, ''],
    [],
    [],
    ['PURCHASE INVOICES (INCOMING BILLS)'],
    ['SR NO', 'PARTICULARS', 'GSTIN', 'Date', 'Non taxable', 'Net', 'IGST', 'CGST', 'SGST', 'TOTAL', 'Rate'],
    [],
    [1, '', '', '', '', '', '', '', '', '', ''],
    ['', '', '', '', '', `=SUM(F15:F15)`, `=SUM(G15:G15)`, `=SUM(H15:H15)`, `=SUM(I15:I15)`, `=SUM(J15:J15)`, ''],
    [],
    [],
    ['', 'Payment of Tax'],
    ['', '', '', '', 'ITC', '', '=SUM(C20:F20)'],
    ['', 'Particulars', 'Tax payable', 'IGST', 'CGST', 'SGST', 'Tax Payable'],
    [],
    ['', 'IGST', '=+G9', '=+G16', 0, 0, '=C23-D23-E23-F23'],
    ['', 'CGST', '=+H9', '', '=+H16', '', '=C24-E24'],
    ['', 'SGST', '=+I9', '', '', '=+I16', '=C25-F25'],
    ['', 'Cess', 0, '', '', 0, '=C26-F26'],
    [],
    ['', '', '=SUM(C23:C26)', '=SUM(D23:D26)', '=SUM(E23:E26)', '=SUM(F23:F26)', '=SUM(G23:G26)']
  ];

  await apiCall(`/values/${encodeURIComponent(sheetName)}!A1:K28?valueInputOption=USER_ENTERED`, {
    method: 'PUT',
    body: JSON.stringify({ values: skeleton })
  }, sheetsId, saJson, apiKey);
}

async function ensureSheetExists(sheetName: string, billDate: string, sheetsId: string, saJson: string, apiKey: string): Promise<number> {
  const metadata = await apiCall('?fields=sheets.properties.title,sheets.properties.sheetId', {}, sheetsId, saJson, apiKey);
  const existing = metadata.sheets.find((s: any) => s.properties.title.toLowerCase() === sheetName.toLowerCase());
  
  if (existing) {
    return existing.properties.sheetId;
  }

  const addResult = await apiCall(':batchUpdate', {
    method: 'POST',
    body: JSON.stringify({
      requests: [{
        addSheet: {
          properties: { title: sheetName }
        }
      }]
    })
  }, sheetsId, saJson, apiKey);

  const newSheetId = addResult.replies[0].addSheet.properties.sheetId;
  await writeSkeleton(sheetName, billDate, sheetsId, saJson, apiKey);
  return newSheetId;
}

/* ── Dynamic Layout Parser & Sweep Operations ──────────────────────────── */

export interface SheetLayout {
  salesHeaderIdx: number;
  salesColsHeaderIdx: number;
  salesStartIdx: number;
  salesTotalIdx: number;
  purchHeaderIdx: number;
  purchColsHeaderIdx: number;
  purchStartIdx: number;
  purchTotalIdx: number;
  payTaxIdx: number;
}

export function parseSheetLayout(rows: any[][]): SheetLayout {
  let salesHeaderIdx = -1;
  let purchHeaderIdx = -1;
  let payTaxIdx = -1;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] || [];
    const valStr = row.map((v: any) => String(v)).join(' ').toLowerCase();
    
    if (valStr.includes('sales invoices') || valStr.includes('outgoing bills')) {
      salesHeaderIdx = i;
    }
    if (valStr.includes('purchase invoices') || valStr.includes('incoming bills')) {
      purchHeaderIdx = i;
    }
    if (valStr.includes('payment of tax')) {
      payTaxIdx = i;
    }
  }

  // Now, calculate the boundaries based on these headers
  let salesColsHeaderIdx = -1;
  let salesStartIdx = -1;
  let salesTotalIdx = -1;
  
  if (salesHeaderIdx !== -1) {
    salesColsHeaderIdx = salesHeaderIdx + 1;
    salesStartIdx = salesColsHeaderIdx + 2;
    const endSearchLimit = purchHeaderIdx !== -1 ? purchHeaderIdx : rows.length;
    for (let i = salesStartIdx; i < endSearchLimit; i++) {
      const row = rows[i] || [];
      if (String(row[4] || '').includes('=SUM(') || String(row[5] || '').includes('=SUM(')) {
        salesTotalIdx = i;
        break;
      }
    }
  }

  let purchColsHeaderIdx = -1;
  let purchStartIdx = -1;
  let purchTotalIdx = -1;
  
  if (purchHeaderIdx !== -1) {
    purchColsHeaderIdx = purchHeaderIdx + 1;
    purchStartIdx = purchColsHeaderIdx + 2;
    const endSearchLimit = payTaxIdx !== -1 ? payTaxIdx : rows.length;
    for (let i = purchStartIdx; i < endSearchLimit; i++) {
      const row = rows[i] || [];
      if (String(row[5] || '').includes('=SUM(')) {
        purchTotalIdx = i;
        break;
      }
    }
  }

  // Fallbacks if not found
  if (salesHeaderIdx === -1) {
    salesHeaderIdx = 4;
    salesColsHeaderIdx = 5;
    salesStartIdx = 7;
    salesTotalIdx = 8;
  }
  if (purchHeaderIdx === -1) {
    purchHeaderIdx = 11;
    purchColsHeaderIdx = 12;
    purchStartIdx = 14;
    purchTotalIdx = 15;
  }
  if (payTaxIdx === -1) {
    payTaxIdx = 18;
  }

  return {
    salesHeaderIdx,
    salesColsHeaderIdx,
    salesStartIdx,
    salesTotalIdx,
    purchHeaderIdx,
    purchColsHeaderIdx,
    purchStartIdx,
    purchTotalIdx,
    payTaxIdx
  };
}

export async function cleanupSectionRows(
  sheetId: number,
  sheetName: string,
  startIdx: number,
  totalIdx: number,
  sheetsId: string,
  saJson: string,
  apiKey: string
): Promise<number> {
  const valRes = await apiCall(`/values/${encodeURIComponent(sheetName)}!A1:K300?valueRenderOption=FORMULA`, {}, sheetsId, saJson, apiKey);
  const rows = valRes.values || [];
  
  const deleteIndices: number[] = [];
  const dataRowCount = totalIdx - startIdx;
  
  if (dataRowCount <= 1) {
    return 0; 
  }
  
  for (let i = startIdx; i < totalIdx; i++) {
    const row = rows[i] || [];
    const hasCompany = !!String(row[1] || '').trim();
    const hasGstin = !!String(row[2] || '').trim();
    const hasNet = !!String(row[5] || '').trim();
    
    if (!hasCompany && !hasGstin && !hasNet) {
      deleteIndices.push(i);
    }
  }
  
  if (deleteIndices.length === 0) {
    return 0;
  }
  
  deleteIndices.sort((a, b) => b - a);
  
  if (deleteIndices.length >= dataRowCount) {
    deleteIndices.pop(); 
  }
  
  if (deleteIndices.length === 0) {
    return 0;
  }
  
  const requests = deleteIndices.map(idx => ({
    deleteDimension: {
      range: {
        sheetId,
        dimension: "ROWS",
        startIndex: idx,
        endIndex: idx + 1
      }
    }
  }));
  
  await apiCall(':batchUpdate', {
    method: 'POST',
    body: JSON.stringify({ requests })
  }, sheetsId, saJson, apiKey);
  
  return deleteIndices.length;
}

export function parseDateString(dateStr: string): number {
  if (!dateStr) return 0;
  const parts = dateStr.split('.');
  if (parts.length === 3) {
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const year = parseInt(parts[2], 10);
    const d = new Date(year, month, day);
    return isNaN(d.getTime()) ? 0 : d.getTime();
  }
  return 0;
}

export async function sortAndResequenceSection(
  sheetName: string,
  startIdx: number,
  totalIdx: number,
  sheetsId: string,
  saJson: string,
  apiKey: string
) {
  if (totalIdx <= startIdx) return;

  const valRes = await apiCall(`/values/${encodeURIComponent(sheetName)}!A1:K300?valueRenderOption=FORMULA`, {}, sheetsId, saJson, apiKey);
  const rows = valRes.values || [];
  
  const dataRows = rows.slice(startIdx, totalIdx);
  
  const cleanDataRows = dataRows.filter((row: any) => {
    const hasCompany = !!String(row[1] || '').trim();
    const hasGstin = !!String(row[2] || '').trim();
    const hasNet = !!String(row[5] || '').trim();
    return hasCompany || hasGstin || hasNet;
  });

  if (cleanDataRows.length === 0) {
    const placeholder = [1, "", "", "", "", "", "", "", "", "", ""];
    const writeRange = `${sheetName}!A${startIdx + 1}:K${startIdx + 1}`;
    await apiCall(`/values/${encodeURIComponent(writeRange)}?valueInputOption=USER_ENTERED`, {
      method: 'PUT',
      body: JSON.stringify({ values: [placeholder] })
    }, sheetsId, saJson, apiKey);
    return;
  }

  // Sort: group by company name first (so all bills for the same vendor are together),
  // then sort by date within each company group.
  cleanDataRows.sort((a: any, b: any) => {
    const companyA = String(a[1] || '').trim().toLowerCase();
    const companyB = String(b[1] || '').trim().toLowerCase();
    if (companyA !== companyB) return companyA.localeCompare(companyB);
    const timeA = parseDateString(String(a[3] || ''));
    const timeB = parseDateString(String(b[3] || ''));
    return timeA - timeB;
  });

  cleanDataRows.forEach((row: any, index: number) => {
    // Preserve non-numeric invoice numbers (e.g. "INV-001", "FL/2025/42")
    // Only assign sequential number if column A is empty or already a plain integer
    const existingColA = String(row[0] || '').trim();
    const isSequential = existingColA === '' || /^\d+$/.test(existingColA);
    row[0] = isSequential ? (index + 1) : existingColA;

    if (row[4] !== undefined && row[4] !== "") row[4] = parseFloat(String(row[4])) || "";
    if (row[5] !== undefined && row[5] !== "") row[5] = parseFloat(String(row[5])) || 0;
    if (row[6] !== undefined && row[6] !== "") row[6] = parseFloat(String(row[6])) || "";
    if (row[7] !== undefined && row[7] !== "") row[7] = parseFloat(String(row[7])) || "";
    if (row[8] !== undefined && row[8] !== "") row[8] = parseFloat(String(row[8])) || "";
    if (row[9] !== undefined && row[9] !== "") row[9] = parseFloat(String(row[9])) || 0;
  });


  const writeValues = cleanDataRows.map((row: any) => {
    const fullRow = Array(11).fill("");
    for (let col = 0; col < 11; col++) {
      fullRow[col] = row[col] !== undefined ? row[col] : "";
    }
    return fullRow;
  });

  const oldRowCount = dataRows.length;
  const newRowCount = writeValues.length;

  if (newRowCount < oldRowCount) {
    const clearRange = `${sheetName}!A${startIdx + 1}:K${totalIdx}`;
    await apiCall(`/values/${encodeURIComponent(clearRange)}:clear`, { method: 'POST' }, sheetsId, saJson, apiKey);
  }

  const writeRange = `${sheetName}!A${startIdx + 1}:K${startIdx + 1 + newRowCount - 1}`;
  await apiCall(`/values/${encodeURIComponent(writeRange)}?valueInputOption=USER_ENTERED`, {
    method: 'PUT',
    body: JSON.stringify({ values: writeValues })
  }, sheetsId, saJson, apiKey);
}

/**
 * When the SUM formula row cannot be found (it may have been displaced or
 * accidentally overwritten), estimate its 0-based index by scanning for the
 * last non-empty data row in the section and placing the total right after it.
 * Returns the original totalIdx unchanged if it is already valid.
 */
function resolveTotalIdx(
  rows: any[][],
  startIdx: number,
  totalIdx: number,
  upperBound: number   // exclusive — first row that belongs to the NEXT section
): number {
  if (totalIdx >= 0 && totalIdx > startIdx) return totalIdx; // already valid

  let lastDataRow = startIdx - 1;
  const limit = Math.min(upperBound, rows.length);
  for (let i = startIdx; i < limit; i++) {
    const r = rows[i] || [];
    const hasContent = String(r[1] || '').trim() || String(r[5] || '').trim();
    if (hasContent) lastDataRow = i;
  }
  // Place total right after last data row (or at startIdx+1 if section is empty)
  return Math.max(lastDataRow + 1, startIdx + 1);
}


export async function appendBillToSheets(bill: Bill, sheetsId: string, saJson: string, apiKey: string): Promise<boolean> {
  const dateParts = (bill.date || '').split('.');
  if (dateParts.length !== 3) {
    throw new Error(`Invalid bill date format: "${bill.date}". Expected DD.MM.YYYY`);
  }

  const monthIndex = parseInt(dateParts[1]) - 1;
  const year = dateParts[2];
  const monthName = MONTHS[monthIndex];
  if (!monthName) throw new Error(`Invalid month index in bill date: "${bill.date}"`);

  const sheetName = `${monthName} ${year}`;
  const newSheetId = await ensureSheetExists(sheetName, bill.date, sheetsId, saJson, apiKey);

  let valRes = await apiCall(`/values/${encodeURIComponent(sheetName)}!A1:K300?valueRenderOption=FORMULA`, {}, sheetsId, saJson, apiKey);
  let rows = valRes.values || [];

  // Scan the raw rows directly for section-header keywords.
  // parseSheetLayout cannot be used here because it applies fallback hardcoded
  // indices when a section is not found, so its output never contains -1 — we
  // would always see a "valid" layout even on a completely blank sheet.
  // Only write the skeleton when the sheet is genuinely empty / unrecognisable
  // — NEVER when the sections already exist, because writeSkeleton does a full
  // PUT on A1:K28 that would overwrite all existing bill rows.
  let hasSalesSection = false;
  let hasPurchSection = false;
  for (const r of rows) {
    const rowStr = (r || []).map((v: any) => String(v)).join(' ').toLowerCase();
    if (rowStr.includes('sales invoices') || rowStr.includes('outgoing bills')) hasSalesSection = true;
    if (rowStr.includes('purchase invoices') || rowStr.includes('incoming bills')) hasPurchSection = true;
    if (hasSalesSection && hasPurchSection) break;
  }
  const skeletonIsValid = hasSalesSection && hasPurchSection;
  if (!skeletonIsValid) {
    await writeSkeleton(sheetName, bill.date, sheetsId, saJson, apiKey);
    const reValRes = await apiCall(`/values/${encodeURIComponent(sheetName)}!A1:K300?valueRenderOption=FORMULA`, {}, sheetsId, saJson, apiKey);
    rows = reValRes.values || [];
  }

  let layout = parseSheetLayout(rows);
  const isSales = bill.billType === 'SALES';
  // Use `let` so both indices can be refreshed after cleanupSectionRows
  let startIdx = isSales ? layout.salesStartIdx : layout.purchStartIdx;
  let totalIdx = resolveTotalIdx(
    rows,
    startIdx >= 0 ? startIdx : 0,
    isSales ? layout.salesTotalIdx : layout.purchTotalIdx,
    isSales
      ? (layout.purchHeaderIdx > 0 ? layout.purchHeaderIdx : rows.length)
      : (layout.payTaxIdx > 0 ? layout.payTaxIdx : rows.length)
  );

  const deletedCount = await cleanupSectionRows(newSheetId, sheetName, startIdx, totalIdx, sheetsId, saJson, apiKey);
  if (deletedCount > 0) {
    valRes = await apiCall(`/values/${encodeURIComponent(sheetName)}!A1:K300?valueRenderOption=FORMULA`, {}, sheetsId, saJson, apiKey);
    rows = valRes.values || [];
    layout = parseSheetLayout(rows);
    // Refresh BOTH indices — only totalIdx was refreshed before, leaving startIdx stale
    startIdx = isSales ? layout.salesStartIdx : layout.purchStartIdx;
    totalIdx = resolveTotalIdx(
      rows,
      startIdx >= 0 ? startIdx : 0,
      isSales ? layout.salesTotalIdx : layout.purchTotalIdx,
      isSales
        ? (layout.purchHeaderIdx > 0 ? layout.purchHeaderIdx : rows.length)
        : (layout.payTaxIdx > 0 ? layout.payTaxIdx : rows.length)
    );
  }

  // Final safety: if section start itself is not found, bail out
  if (startIdx < 0 || totalIdx <= startIdx) {
    throw new Error(
      `Could not locate the ${isSales ? 'sales' : 'purchase'} section in sheet "${sheetName}". ` +
      `The sheet structure may be corrupted. Please re-open the sheet and try again.`
    );
  }

  const colJwr = bill.jwrAmount > 0 ? bill.jwrAmount : "";
  const colIgst = bill.igstAmount > 0 ? bill.igstAmount : "";
  const colCgst = bill.cgstAmount > 0 ? bill.cgstAmount : "";
  const colSgst = bill.sgstAmount > 0 ? bill.sgstAmount : "";

  const rowData = [
    "", 
    bill.company,
    bill.gstin,
    bill.date,
    colJwr,
    bill.netAmount,
    colIgst,
    colCgst,
    colSgst,
    bill.totalAmount,
    "" 
  ];

  let targetInsertIdx = -1;
  let srNo = 1;

  const firstRow = rows[startIdx] || [];
  const isPlaceholderEmpty = !firstRow[1] && !firstRow[2];

  if (isPlaceholderEmpty) {
    // Replace the empty placeholder row in-place (no insertDimension needed)
    targetInsertIdx = startIdx;
    srNo = 1;
  } else {
    // Always append at the end of the section — sortAndResequenceSection will
    // re-order everything by company name + date immediately after this write,
    // so the pre-insert position doesn't need to be calculated by date.
    targetInsertIdx = totalIdx;
    srNo = (totalIdx - startIdx) + 1;
  }

  rowData[0] = isSales
    ? (bill.invoiceNumber && bill.invoiceNumber.trim() ? bill.invoiceNumber.trim() : srNo)
    : srNo;

  if (!isPlaceholderEmpty) {
    // Last-resort safety check before the API call — a negative index causes a
    // hard 400 error from Google Sheets that is very confusing to users.
    if (targetInsertIdx < 0) {
      throw new Error(
        `Cannot insert row: computed position ${targetInsertIdx} is invalid for sheet "${sheetName}". ` +
        `Please try again or delete the bill and re-scan.`
      );
    }
    await apiCall(':batchUpdate', {
      method: 'POST',
      body: JSON.stringify({
        requests: [{
          insertDimension: {
            range: {
              sheetId: newSheetId,
              dimension: "ROWS",
              startIndex: targetInsertIdx,
              endIndex: targetInsertIdx + 1
            },
            // Use false so inserting at index 0 never fails (no prior row to inherit from)
            inheritFromBefore: targetInsertIdx > 0
          }
        }]
      })
    }, sheetsId, saJson, apiKey);
  }

  const writeRange = `${sheetName}!A${targetInsertIdx + 1}:K${targetInsertIdx + 1}`;
  await apiCall(`/values/${encodeURIComponent(writeRange)}?valueInputOption=USER_ENTERED`, {
    method: 'PUT',
    body: JSON.stringify({ values: [rowData] })
  }, sheetsId, saJson, apiKey);

  const postInsertRes = await apiCall(`/values/${encodeURIComponent(sheetName)}!A1:K300?valueRenderOption=FORMULA`, {}, sheetsId, saJson, apiKey);
  const postInsertRows = postInsertRes.values || [];
  const postInsertLayout = parseSheetLayout(postInsertRows);
  const postInsertStartIdx = isSales ? postInsertLayout.salesStartIdx : postInsertLayout.purchStartIdx;
  // Resolve totalIdx here too — the SUM formula may still be absent after insert
  const postInsertTotalIdx = resolveTotalIdx(
    postInsertRows,
    postInsertStartIdx >= 0 ? postInsertStartIdx : 0,
    isSales ? postInsertLayout.salesTotalIdx : postInsertLayout.purchTotalIdx,
    isSales
      ? (postInsertLayout.purchHeaderIdx > 0 ? postInsertLayout.purchHeaderIdx : postInsertRows.length)
      : (postInsertLayout.payTaxIdx > 0 ? postInsertLayout.payTaxIdx : postInsertRows.length)
  );

  await sortAndResequenceSection(sheetName, postInsertStartIdx, postInsertTotalIdx, sheetsId, saJson, apiKey);

  const finalRes = await apiCall(`/values/${encodeURIComponent(sheetName)}!A1:K300?valueRenderOption=FORMULA`, {}, sheetsId, saJson, apiKey);
  const finalRows = finalRes.values || [];
  const finalLayout = parseSheetLayout(finalRows);

  if (finalLayout.salesTotalIdx !== -1 && finalLayout.salesStartIdx !== -1) {
    const salesStartRow = finalLayout.salesStartIdx + 1; // 1-indexed first data row
    const endSalesRow = finalLayout.salesTotalIdx;        // 1-indexed total row (0-idx + 1)
    const salesTotalRange = `${sheetName}!E${finalLayout.salesTotalIdx + 1}:J${finalLayout.salesTotalIdx + 1}`;
    const salesTotalFormulas = [
      `=SUM(E${salesStartRow}:E${endSalesRow})`,
      `=SUM(F${salesStartRow}:F${endSalesRow})`,
      `=SUM(G${salesStartRow}:G${endSalesRow})`,
      `=SUM(H${salesStartRow}:H${endSalesRow})`,
      `=SUM(I${salesStartRow}:I${endSalesRow})`,
      `=SUM(J${salesStartRow}:J${endSalesRow})`
    ];
    await apiCall(`/values/${encodeURIComponent(salesTotalRange)}?valueInputOption=USER_ENTERED`, {
      method: 'PUT',
      body: JSON.stringify({ values: [salesTotalFormulas] })
    }, sheetsId, saJson, apiKey);
  }

  // Resolve final purchase total — writes SUM formula even if it was previously missing
  const finalPurchTotalIdx = resolveTotalIdx(
    finalRows,
    finalLayout.purchStartIdx >= 0 ? finalLayout.purchStartIdx : 0,
    finalLayout.purchTotalIdx,
    finalLayout.payTaxIdx > 0 ? finalLayout.payTaxIdx : finalRows.length
  );

  if (finalLayout.purchStartIdx !== -1 && finalPurchTotalIdx > finalLayout.purchStartIdx) {
    const startRow = finalLayout.purchStartIdx + 1;
    const endRow = finalPurchTotalIdx;   // 0-indexed → 1-indexed last-data-row
    const purchTotalRange = `${sheetName}!E${finalPurchTotalIdx + 1}:J${finalPurchTotalIdx + 1}`;
    const purchTotalFormulas = [
      `=SUM(E${startRow}:E${endRow})`,
      `=SUM(F${startRow}:F${endRow})`,
      `=SUM(G${startRow}:G${endRow})`,
      `=SUM(H${startRow}:H${endRow})`,
      `=SUM(I${startRow}:I${endRow})`,
      `=SUM(J${startRow}:J${endRow})`
    ];
    await apiCall(`/values/${encodeURIComponent(purchTotalRange)}?valueInputOption=USER_ENTERED`, {
      method: 'PUT',
      body: JSON.stringify({ values: [purchTotalFormulas] })
    }, sheetsId, saJson, apiKey);
  }

  if (finalLayout.payTaxIdx !== -1 && finalLayout.salesTotalIdx !== -1) {
    const payTaxHeaderIdx = finalLayout.payTaxIdx;
    const igstRow = payTaxHeaderIdx + 5;
    const cgstRow = payTaxHeaderIdx + 6;
    const sgstRow = payTaxHeaderIdx + 7;
    const cessRow = payTaxHeaderIdx + 8;
    const purchTotalRowStr = (finalLayout.purchStartIdx !== -1 && finalPurchTotalIdx > finalLayout.purchStartIdx)
      ? `${finalPurchTotalIdx + 1}`
      : `14`;


    const paymentTableValues = [
      ['', '', '', '', `=SUM(C${payTaxHeaderIdx + 3}:F${payTaxHeaderIdx + 3})`],
      ['Tax payable', 'IGST', 'CGST', 'SGST', 'Tax Payable'],
      ['', '', '', '', ''],
      [`=+G${finalLayout.salesTotalIdx + 1}`, `=+G${purchTotalRowStr}`, 0, 0, `=C${igstRow}-D${igstRow}-E${igstRow}-F${igstRow}`],
      [`=+H${finalLayout.salesTotalIdx + 1}`, '', `=+H${purchTotalRowStr}`, '', `=C${cgstRow}-E${cgstRow}`],
      [`=+I${finalLayout.salesTotalIdx + 1}`, '', '', `=+I${purchTotalRowStr}`, `=C${sgstRow}-F${sgstRow}`],
      [0, '', '', 0, `=C${cessRow}-F${cessRow}`],
      ['', '', '', '', ''],
      [
        `=SUM(C${igstRow}:C${cessRow})`,
        `=SUM(D${igstRow}:D${cessRow})`,
        `=SUM(E${igstRow}:E${cessRow})`,
        `=SUM(F${igstRow}:F${cessRow})`,
        `=SUM(G${igstRow}:G${cessRow})`
      ]
    ];

    const paymentRange = `${sheetName}!C${payTaxHeaderIdx + 2}:G${payTaxHeaderIdx + 10}`;
    await apiCall(`/values/${encodeURIComponent(paymentRange)}?valueInputOption=USER_ENTERED`, {
      method: 'PUT',
      body: JSON.stringify({ values: paymentTableValues })
    }, sheetsId, saJson, apiKey);
  }

  try {
    await applySheetsFormatting(newSheetId, sheetName, sheetsId, saJson, apiKey);
  } catch (err) {
    console.error('[Sheets] Formatting failed:', err);
  }

  return true;
}

/* ── Sheet Repair: wipe & rebuild from local DB ────────────────────────── */

/**
 * Completely wipes the scrambled month tab and rebuilds it from scratch
 * using only the bills stored in the local IndexedDB for that month/year.
 *
 * Progress is reported via the onProgress callback so the UI can display
 * a live status message.
 *
 * @param monthYear  e.g. "May 2026"
 * @param allBills   All bills from local DB (we filter to the target month)
 * @param sheetsId   Google Sheets spreadsheet ID
 * @param saJson     Service account JSON string
 * @param apiKey     Fallback API key
 * @param onProgress Optional callback for progress updates
 * @returns Number of bills re-synced
 */
export async function repairAndRebuildSheet(
  monthYear: string,
  allBills: Bill[],
  sheetsId: string,
  saJson: string,
  apiKey: string,
  onProgress?: (msg: string) => void
): Promise<number> {
  const report = (msg: string) => { onProgress?.(msg); console.log('[Repair]', msg); };

  // Parse month/year from tab name
  const [monthName, year] = monthYear.split(' ');
  const monthIdx = MONTHS.indexOf(monthName);
  if (monthIdx === -1 || !year) throw new Error(`Invalid month tab name: "${monthYear}"`);

  // Filter local bills to this month + year
  const billsForMonth = allBills.filter(b => {
    const parts = (b.date || '').split('.');
    if (parts.length !== 3) return false;
    const bMonth = MONTHS[parseInt(parts[1]) - 1];
    return bMonth === monthName && parts[2] === year;
  });

  report(`Found ${billsForMonth.length} local bill(s) for ${monthYear}.`);

  // Step 1: Get the sheet ID (create tab if it doesn't exist yet)
  const metadata = await apiCall('?fields=sheets.properties.title,sheets.properties.sheetId', {}, sheetsId, saJson, apiKey);
  const existingTab = metadata.sheets.find((s: any) => s.properties.title.toLowerCase() === monthYear.toLowerCase());

  if (existingTab) {
    report(`Clearing scrambled tab "${monthYear}"…`);
    // Clear the entire sheet content so writeSkeleton starts from scratch
    await apiCall(`/values/${encodeURIComponent(monthYear)}!A1:K500:clear`, { method: 'POST' }, sheetsId, saJson, apiKey);
  }

  // Step 2: Write a fresh, clean skeleton
  report(`Writing fresh skeleton for "${monthYear}"…`);
  // Pick any bill date in the month to derive the skeleton header, or synthesise one
  const sampleDate = billsForMonth.length > 0
    ? billsForMonth[0].date
    : `01.${String(monthIdx + 1).padStart(2, '0')}.${year}`;
  await writeSkeleton(monthYear, sampleDate, sheetsId, saJson, apiKey);

  if (billsForMonth.length === 0) {
    report('No local bills found for this month. Skeleton written with empty placeholders.');
    return 0;
  }

  // Step 3: Re-insert each bill one by one using the standard appendBillToSheets
  // Sort: SALES first, then PURCHASE, each group sorted by date ascending
  const sorted = [...billsForMonth].sort((a, b) => {
    if (a.billType !== b.billType) return a.billType === 'SALES' ? -1 : 1;
    return parseDateString(a.date) - parseDateString(b.date);
  });

  let synced = 0;
  for (const bill of sorted) {
    try {
      report(`Syncing [${bill.billType}] ${bill.company} — ₹${bill.totalAmount.toLocaleString('en-IN')}…`);
      await appendBillToSheets(bill, sheetsId, saJson, apiKey);
      synced++;
    } catch (err: any) {
      console.error(`[Repair] Failed to sync bill for ${bill.company}:`, err);
      report(`⚠ Skipped ${bill.company}: ${err.message}`);
    }
  }

  report(`✓ Repair complete. ${synced}/${billsForMonth.length} bills restored.`);
  return synced;
}

export async function deleteBillFromSheets(bill: Bill, sheetsId: string, saJson: string, apiKey: string): Promise<boolean> {
  const dateParts = (bill.date || '').split('.');
  if (dateParts.length !== 3) {
    throw new Error(`Invalid bill date format for deletion: "${bill.date}". Expected DD.MM.YYYY`);
  }

  const monthIndex = parseInt(dateParts[1]) - 1;
  const year = dateParts[2];
  const monthName = MONTHS[monthIndex];
  if (!monthName) throw new Error(`Invalid month index in bill date: "${bill.date}"`);

  const sheetName = `${monthName} ${year}`;
  
  const metadata = await apiCall('?fields=sheets.properties.title,sheets.properties.sheetId', {}, sheetsId, saJson, apiKey);
  const existing = metadata.sheets.find((s: any) => s.properties.title.toLowerCase() === sheetName.toLowerCase());
  if (!existing) {
    console.warn(`[Sheets] Tab "${sheetName}" does not exist. Skipping deletion.`);
    return true; 
  }
  const sheetId = existing.properties.sheetId;

  const valRes = await apiCall(`/values/${encodeURIComponent(sheetName)}!A1:K300?valueRenderOption=FORMULA`, {}, sheetsId, saJson, apiKey);
  const rows = valRes.values || [];

  const layout = parseSheetLayout(rows);
  const isSales = bill.billType === 'SALES';
  const startIdx = isSales ? layout.salesStartIdx : layout.purchStartIdx;
  const totalIdx = isSales ? layout.salesTotalIdx : layout.purchTotalIdx;

  if (startIdx === -1 || totalIdx === -1 || totalIdx <= startIdx) {
    console.warn(`[Sheets] No transactions found in section. Skipping deletion.`);
    return true;
  }

  let matchRowIdx = -1;
  
  for (let i = startIdx; i < totalIdx; i++) {
    const row = rows[i] || [];
    const rowCompany = String(row[1] || '').trim().toLowerCase();
    const rowDate = String(row[3] || '').trim();
    const rowNet = parseFloat(String(row[5] || '').replace(/[^\d\.]/g, '')) || 0;
    const rowTotal = parseFloat(String(row[9] || '').replace(/[^\d\.]/g, '')) || 0;

    const targetCompany = bill.company.trim().toLowerCase();
    const targetDate = bill.date.trim();
    const targetNet = bill.netAmount;
    const targetTotal = bill.totalAmount;

    const isCompanyMatch = rowCompany.includes(targetCompany) || targetCompany.includes(rowCompany);
    const isDateMatch = rowDate === targetDate;
    const isAmountMatch = Math.abs(rowNet - targetNet) < 2 || Math.abs(rowTotal - targetTotal) < 2;

    if (isCompanyMatch && isDateMatch && isAmountMatch) {
      matchRowIdx = i;
      break;
    }
  }

  if (matchRowIdx === -1) {
    console.warn(`[Sheets] Could not locate matching row in tab "${sheetName}" for bill:`, bill.company, bill.totalAmount);
    return false;
  }

  const dataRowCount = totalIdx - startIdx;
  if (dataRowCount <= 1) {
    const writeRange = `${sheetName}!A${matchRowIdx + 1}:K${matchRowIdx + 1}`;
    const placeholderRow = [1, "", "", "", "", "", "", "", "", "", ""];
    await apiCall(`/values/${encodeURIComponent(writeRange)}?valueInputOption=USER_ENTERED`, {
      method: 'PUT',
      body: JSON.stringify({ values: [placeholderRow] })
    }, sheetsId, saJson, apiKey);
  } else {
    await apiCall(':batchUpdate', {
      method: 'POST',
      body: JSON.stringify({
        requests: [{
          deleteDimension: {
            range: {
              sheetId,
              dimension: "ROWS",
              startIndex: matchRowIdx,
              endIndex: matchRowIdx + 1
            }
          }
        }]
      })
    }, sheetsId, saJson, apiKey);
  }

  const postDelRes = await apiCall(`/values/${encodeURIComponent(sheetName)}!A1:K300?valueRenderOption=FORMULA`, {}, sheetsId, saJson, apiKey);
  let postDelRows = postDelRes.values || [];
  let postDelLayout = parseSheetLayout(postDelRows);
  
  const postDelStartIdx = isSales ? postDelLayout.salesStartIdx : postDelLayout.purchStartIdx;
  let postDelTotalIdx = isSales ? postDelLayout.salesTotalIdx : postDelLayout.purchTotalIdx;

  const deletedCount = await cleanupSectionRows(sheetId, sheetName, postDelStartIdx, postDelTotalIdx, sheetsId, saJson, apiKey);
  if (deletedCount > 0) {
    const postSweepRes = await apiCall(`/values/${encodeURIComponent(sheetName)}!A1:K300?valueRenderOption=FORMULA`, {}, sheetsId, saJson, apiKey);
    postDelRows = postSweepRes.values || [];
    postDelLayout = parseSheetLayout(postDelRows);
  }

  const finalStartIdx = isSales ? postDelLayout.salesStartIdx : postDelLayout.purchStartIdx;
  const finalTotalIdx = isSales ? postDelLayout.salesTotalIdx : postDelLayout.purchTotalIdx;
  await sortAndResequenceSection(sheetName, finalStartIdx, finalTotalIdx, sheetsId, saJson, apiKey);

  const finalRes = await apiCall(`/values/${encodeURIComponent(sheetName)}!A1:K300?valueRenderOption=FORMULA`, {}, sheetsId, saJson, apiKey);
  const finalRows = finalRes.values || [];
  const finalLayout = parseSheetLayout(finalRows);

  if (finalLayout.salesTotalIdx !== -1 && finalLayout.salesStartIdx !== -1) {
    const salesStartRow = finalLayout.salesStartIdx + 1;
    const endSalesRow = finalLayout.salesTotalIdx;
    const salesTotalRange = `${sheetName}!E${finalLayout.salesTotalIdx + 1}:J${finalLayout.salesTotalIdx + 1}`;
    const salesTotalFormulas = [
      `=SUM(E${salesStartRow}:E${endSalesRow})`,
      `=SUM(F${salesStartRow}:F${endSalesRow})`,
      `=SUM(G${salesStartRow}:G${endSalesRow})`,
      `=SUM(H${salesStartRow}:H${endSalesRow})`,
      `=SUM(I${salesStartRow}:I${endSalesRow})`,
      `=SUM(J${salesStartRow}:J${endSalesRow})`
    ];
    await apiCall(`/values/${encodeURIComponent(salesTotalRange)}?valueInputOption=USER_ENTERED`, {
      method: 'PUT',
      body: JSON.stringify({ values: [salesTotalFormulas] })
    }, sheetsId, saJson, apiKey);
  }

  if (finalLayout.purchStartIdx !== -1 && finalLayout.purchTotalIdx !== -1) {
    const startRow = finalLayout.purchStartIdx + 1;
    const endRow = finalLayout.purchTotalIdx;
    const purchTotalRange = `${sheetName}!E${finalLayout.purchTotalIdx + 1}:J${finalLayout.purchTotalIdx + 1}`;
    const purchTotalFormulas = [
      `=SUM(E${startRow}:E${endRow})`,
      `=SUM(F${startRow}:F${endRow})`,
      `=SUM(G${startRow}:G${endRow})`,
      `=SUM(H${startRow}:H${endRow})`,
      `=SUM(I${startRow}:I${endRow})`,
      `=SUM(J${startRow}:J${endRow})`
    ];
    await apiCall(`/values/${encodeURIComponent(purchTotalRange)}?valueInputOption=USER_ENTERED`, {
      method: 'PUT',
      body: JSON.stringify({ values: [purchTotalFormulas] })
    }, sheetsId, saJson, apiKey);
  }

  if (finalLayout.payTaxIdx !== -1 && finalLayout.salesTotalIdx !== -1) {
    const payTaxHeaderIdx = finalLayout.payTaxIdx;
    const igstRow = payTaxHeaderIdx + 5;
    const cgstRow = payTaxHeaderIdx + 6;
    const sgstRow = payTaxHeaderIdx + 7;
    const cessRow = payTaxHeaderIdx + 8;
    const purchTotalRowStr = (finalLayout.purchStartIdx !== -1 && finalLayout.purchTotalIdx !== -1) ? `${finalLayout.purchTotalIdx + 1}` : `14`;

    const paymentTableValues = [
      ['', '', '', '', `=SUM(C${payTaxHeaderIdx + 3}:F${payTaxHeaderIdx + 3})`],
      ['Tax payable', 'IGST', 'CGST', 'SGST', 'Tax Payable'],
      ['', '', '', '', ''],
      [`=+G${finalLayout.salesTotalIdx + 1}`, `=+G${purchTotalRowStr}`, 0, 0, `=C${igstRow}-D${igstRow}-E${igstRow}-F${igstRow}`],
      [`=+H${finalLayout.salesTotalIdx + 1}`, '', `=+H${purchTotalRowStr}`, '', `=C${cgstRow}-E${cgstRow}`],
      [`=+I${finalLayout.salesTotalIdx + 1}`, '', '', `=+I${purchTotalRowStr}`, `=C${sgstRow}-F${sgstRow}`],
      [0, '', '', 0, `=C${cessRow}-F${cessRow}`],
      ['', '', '', '', ''],
      [
        `=SUM(C${igstRow}:C${cessRow})`,
        `=SUM(D${igstRow}:D${cessRow})`,
        `=SUM(E${igstRow}:E${cessRow})`,
        `=SUM(F${igstRow}:F${cessRow})`,
        `=SUM(G${igstRow}:G${cessRow})`
      ]
    ];

    const paymentRange = `${sheetName}!C${payTaxHeaderIdx + 2}:G${payTaxHeaderIdx + 10}`;
    await apiCall(`/values/${encodeURIComponent(paymentRange)}?valueInputOption=USER_ENTERED`, {
      method: 'PUT',
      body: JSON.stringify({ values: paymentTableValues })
    }, sheetsId, saJson, apiKey);
  }

  try {
    await applySheetsFormatting(sheetId, sheetName, sheetsId, saJson, apiKey);
  } catch (err) {
    console.error('[Sheets] Formatting failed:', err);
  }

  return true;
}

export async function testSheetsConnection(sheetsId: string, saJson: string, apiKey: string): Promise<boolean> {
  try {
    if (!sheetsId) return false;
    const res = await apiCall('?fields=properties.title', {}, sheetsId, saJson, apiKey);
    return !!res.properties?.title;
  } catch (e) {
    console.error('[Sheets] Connection test failed:', e);
    return false;
  }
}

async function applySheetsFormatting(sheetId: number, sheetName: string, sheetsId: string, saJson: string, apiKey: string) {
  const res = await apiCall(`/values/${encodeURIComponent(sheetName)}!A1:K300?valueRenderOption=FORMULA`, {}, sheetsId, saJson, apiKey);
  const rows = res.values || [];
  const requests: any[] = [];

  requests.push({
    updateSheetProperties: {
      properties: { sheetId, gridlinesVisible: true },
      fields: "gridlinesVisible"
    }
  });

  requests.push({
    repeatCell: {
      range: { sheetId, startRowIndex: 0, endRowIndex: 100, startColumnIndex: 0, endColumnIndex: 11 },
      cell: {
        userEnteredFormat: {
          textFormat: { fontFamily: "Inter", fontSize: 10 },
          verticalAlignment: "MIDDLE"
        }
      },
      fields: "userEnteredFormat(textFormat,verticalAlignment)"
    }
  });

  requests.push({
    repeatCell: {
      range: { sheetId, startRowIndex: 4, endRowIndex: 100, startColumnIndex: 0, endColumnIndex: 1 },
      cell: { userEnteredFormat: { horizontalAlignment: "CENTER" } },
      fields: "userEnteredFormat(horizontalAlignment)"
    }
  });

  requests.push({
    repeatCell: {
      range: { sheetId, startRowIndex: 4, endRowIndex: 100, startColumnIndex: 2, endColumnIndex: 4 },
      cell: { userEnteredFormat: { horizontalAlignment: "CENTER" } },
      fields: "userEnteredFormat(horizontalAlignment)"
    }
  });

  const currencyFormat = {
    numberFormat: { type: "CURRENCY", pattern: "\"₹\"#,##0.00" },
    horizontalAlignment: "RIGHT"
  };
  requests.push({
    repeatCell: {
      range: { sheetId, startRowIndex: 4, endRowIndex: 100, startColumnIndex: 4, endColumnIndex: 10 },
      cell: { userEnteredFormat: currencyFormat },
      fields: "userEnteredFormat(numberFormat,horizontalAlignment)"
    }
  });

  requests.push({
    repeatCell: {
      range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 11 },
      cell: {
        userEnteredFormat: {
          backgroundColor: { red: 0.08, green: 0.12, blue: 0.18 },
          textFormat: { bold: true, fontSize: 12, foregroundColor: { red: 1.0, green: 1.0, blue: 1.0 } },
          horizontalAlignment: "LEFT"
        }
      },
      fields: "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)"
    }
  });

  const layout = parseSheetLayout(rows);
  const salesLabelIdx = layout.salesHeaderIdx;
  const salesHeaderIdx = layout.salesColsHeaderIdx;
  const salesTotalIdx = layout.salesTotalIdx;
  
  const purchaseLabelIdx = layout.purchHeaderIdx;
  const purchaseHeaderIdx = layout.purchColsHeaderIdx;
  const purchaseTotalIdx = layout.purchTotalIdx;
  
  const payTaxIdx = layout.payTaxIdx;

  if (salesLabelIdx !== -1) {
    requests.push({
      unmergeCells: {
        range: { sheetId, startRowIndex: salesLabelIdx, endRowIndex: salesLabelIdx + 1, startColumnIndex: 0, endColumnIndex: 11 }
      }
    });
    requests.push({
      mergeCells: {
        range: { sheetId, startRowIndex: salesLabelIdx, endRowIndex: salesLabelIdx + 1, startColumnIndex: 0, endColumnIndex: 11 },
        mergeType: "MERGE_ALL"
      }
    });
    requests.push({
      repeatCell: {
        range: { sheetId, startRowIndex: salesLabelIdx, endRowIndex: salesLabelIdx + 1, startColumnIndex: 0, endColumnIndex: 11 },
        cell: {
          userEnteredFormat: {
            backgroundColor: { red: 0.88, green: 0.95, blue: 0.90 }, 
            textFormat: { bold: true, fontSize: 11, foregroundColor: { red: 0.08, green: 0.32, blue: 0.16 } },
            horizontalAlignment: "LEFT"
          }
        },
        fields: "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)"
      }
    });
  }

  if (salesHeaderIdx !== -1) {
    requests.push({
      repeatCell: {
        range: { sheetId, startRowIndex: salesHeaderIdx, endRowIndex: salesHeaderIdx + 1, startColumnIndex: 0, endColumnIndex: 11 },
        cell: {
          userEnteredFormat: {
            backgroundColor: { red: 0.15, green: 0.38, blue: 0.23 }, 
            textFormat: { bold: true, fontSize: 10, foregroundColor: { red: 1.0, green: 1.0, blue: 1.0 } },
            horizontalAlignment: "CENTER"
          }
        },
        fields: "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)"
      }
    });
  }

  if (purchaseLabelIdx !== -1) {
    requests.push({
      unmergeCells: {
        range: { sheetId, startRowIndex: purchaseLabelIdx, endRowIndex: purchaseLabelIdx + 1, startColumnIndex: 0, endColumnIndex: 11 }
      }
    });
    requests.push({
      mergeCells: {
        range: { sheetId, startRowIndex: purchaseLabelIdx, endRowIndex: purchaseLabelIdx + 1, startColumnIndex: 0, endColumnIndex: 11 },
        mergeType: "MERGE_ALL"
      }
    });
    requests.push({
      repeatCell: {
        range: { sheetId, startRowIndex: purchaseLabelIdx, endRowIndex: purchaseLabelIdx + 1, startColumnIndex: 0, endColumnIndex: 11 },
        cell: {
          userEnteredFormat: {
            backgroundColor: { red: 0.97, green: 0.88, blue: 0.88 }, 
            textFormat: { bold: true, fontSize: 11, foregroundColor: { red: 0.45, green: 0.10, blue: 0.10 } },
            horizontalAlignment: "LEFT"
          }
        },
        fields: "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)"
      }
    });
  }

  if (purchaseHeaderIdx !== -1) {
    requests.push({
      repeatCell: {
        range: { sheetId, startRowIndex: purchaseHeaderIdx, endRowIndex: purchaseHeaderIdx + 1, startColumnIndex: 0, endColumnIndex: 11 },
        cell: {
          userEnteredFormat: {
            backgroundColor: { red: 0.48, green: 0.18, blue: 0.18 }, 
            textFormat: { bold: true, fontSize: 10, foregroundColor: { red: 1.0, green: 1.0, blue: 1.0 } },
            horizontalAlignment: "CENTER"
          }
        },
        fields: "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)"
      }
    });
  }

  const salesTotalFormat = {
    backgroundColor: { red: 0.93, green: 0.97, blue: 0.94 }, 
    textFormat: { bold: true }
  };
  const purchTotalFormat = {
    backgroundColor: { red: 0.98, green: 0.94, blue: 0.94 }, 
    textFormat: { bold: true }
  };

  if (salesTotalIdx !== -1) {
    requests.push({
      repeatCell: {
        range: { sheetId, startRowIndex: salesTotalIdx, endRowIndex: salesTotalIdx + 1, startColumnIndex: 0, endColumnIndex: 11 },
        cell: { userEnteredFormat: salesTotalFormat },
        fields: "userEnteredFormat(backgroundColor,textFormat)"
      }
    });
  }

  if (purchaseTotalIdx !== -1) {
    requests.push({
      repeatCell: {
        range: { sheetId, startRowIndex: purchaseTotalIdx, endRowIndex: purchaseTotalIdx + 1, startColumnIndex: 0, endColumnIndex: 11 },
        cell: { userEnteredFormat: purchTotalFormat },
        fields: "userEnteredFormat(backgroundColor,textFormat)"
      }
    });
  }

  if (payTaxIdx !== -1) {
    requests.push({
      repeatCell: {
        range: { sheetId, startRowIndex: payTaxIdx, endRowIndex: payTaxIdx + 1, startColumnIndex: 1, endColumnIndex: 11 },
        cell: {
          userEnteredFormat: {
            textFormat: { bold: true, fontSize: 11, foregroundColor: { red: 0.08, green: 0.20, blue: 0.38 } }
          }
        },
        fields: "userEnteredFormat(textFormat)"
      }
    });

    requests.push({
      repeatCell: {
        range: { sheetId, startRowIndex: payTaxIdx + 1, endRowIndex: payTaxIdx + 2, startColumnIndex: 4, endColumnIndex: 7 },
        cell: {
          userEnteredFormat: {
            backgroundColor: { red: 0.92, green: 0.94, blue: 0.98 }, 
            textFormat: { bold: true },
            horizontalAlignment: "CENTER"
          }
        },
        fields: "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)"
      }
    });

    requests.push({
      repeatCell: {
        range: { sheetId, startRowIndex: payTaxIdx + 2, endRowIndex: payTaxIdx + 3, startColumnIndex: 1, endColumnIndex: 7 },
        cell: {
          userEnteredFormat: {
            backgroundColor: { red: 0.18, green: 0.27, blue: 0.42 }, 
            textFormat: { bold: true, foregroundColor: { red: 1.0, green: 1.0, blue: 1.0 } },
            horizontalAlignment: "CENTER"
          }
        },
        fields: "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)"
      }
    });

    requests.push({
      repeatCell: {
        range: { sheetId, startRowIndex: payTaxIdx + 10, endRowIndex: payTaxIdx + 11, startColumnIndex: 2, endColumnIndex: 7 },
        cell: {
          userEnteredFormat: {
            textFormat: { bold: true, fontSize: 10, foregroundColor: { red: 0.08, green: 0.35, blue: 0.15 } },
            backgroundColor: { red: 0.88, green: 0.95, blue: 0.88 } 
          }
        },
        fields: "userEnteredFormat(textFormat,backgroundColor)"
      }
    });
  }

  if (salesHeaderIdx !== -1 && salesTotalIdx !== -1) {
    for (let idx = salesHeaderIdx + 1; idx < salesTotalIdx; idx++) {
      const isOdd = (idx % 2) !== 0;
      requests.push({
        repeatCell: {
          range: { sheetId, startRowIndex: idx, endRowIndex: idx + 1, startColumnIndex: 0, endColumnIndex: 11 },
          cell: {
            userEnteredFormat: {
              backgroundColor: isOdd ? { red: 0.96, green: 0.98, blue: 0.96 } : { red: 1.0, green: 1.0, blue: 1.0 }
            }
          },
          fields: "userEnteredFormat(backgroundColor)"
        }
      });
    }
  }

  if (purchaseHeaderIdx !== -1 && purchaseTotalIdx !== -1) {
    for (let idx = purchaseHeaderIdx + 1; idx < purchaseTotalIdx; idx++) {
      const isOdd = (idx % 2) !== 0;
      requests.push({
        repeatCell: {
          range: { sheetId, startRowIndex: idx, endRowIndex: idx + 1, startColumnIndex: 0, endColumnIndex: 11 },
          cell: {
            userEnteredFormat: {
              backgroundColor: isOdd ? { red: 0.99, green: 0.97, blue: 0.97 } : { red: 1.0, green: 1.0, blue: 1.0 }
            }
          },
          fields: "userEnteredFormat(backgroundColor)"
        }
      });
    }
  }

  requests.push({
    updateDimensionProperties: {
      range: { sheetId, dimension: "ROWS", startIndex: 3, endIndex: 100 },
      properties: { pixelSize: 25 },
      fields: "pixelSize"
    }
  });

  requests.push({
    updateDimensionProperties: {
      range: { sheetId, dimension: "ROWS", startIndex: 0, endIndex: 1 },
      properties: { pixelSize: 38 },
      fields: "pixelSize"
    }
  });

  const columnWidths = [45, 180, 130, 85, 95, 95, 90, 90, 90, 100, 50];
  columnWidths.forEach((width, index) => {
    requests.push({
      repeatCell: {
        range: { sheetId, startRowIndex: 0, endRowIndex: 100, startColumnIndex: index, endColumnIndex: index + 1 },
        cell: { userEnteredFormat: { wrapStrategy: "CLIP" } },
        fields: "userEnteredFormat(wrapStrategy)"
      }
    });
    requests.push({
      updateDimensionProperties: {
        range: { sheetId, dimension: "COLUMNS", startIndex: index, endIndex: index + 1 },
        properties: { pixelSize: width },
        fields: "pixelSize"
      }
    });
  });

  await apiCall(':batchUpdate', {
    method: 'POST',
    body: JSON.stringify({ requests })
  }, sheetsId, saJson, apiKey);
}

export async function syncPending(
  bills: Bill[],
  sheetsId: string,
  saJson: string,
  apiKey: string
): Promise<number> {
  let synced = 0;
  for (const bill of bills) {
    try {
      const success = await appendBillToSheets(bill, sheetsId, saJson, apiKey);
      if (success) {
        await db.markBillSynced(bill.id!);
        synced++;
      }
    } catch (err) {
      console.error(`[Sheets] Failed to sync bill "${bill.company}":`, err);
    }
  }
  return synced;
}
