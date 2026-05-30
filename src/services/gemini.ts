import { GoogleGenerativeAI, SchemaType, type Schema } from '@google/generative-ai';
import { Bill } from '../types';

// Precise low-temperature JSON-enforced generation schema
const billSchema: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    invoiceNumber: {
      type: SchemaType.STRING,
      description: "The invoice / bill number printed on the document (e.g. 'INV-001', 'FL/2025/123', 'Bill No: 45'). Extract the exact value as printed. Leave empty string if not found."
    },
    company: { 
      type: SchemaType.STRING, 
      description: "Trading partner's company name. CRITICAL: If the invoice is issued BY 'Frank Link Logistics' (Sales), you MUST extract the buyer/customer name (from 'M/S :-', 'Bill To', 'Consignee', or 'Buyer' section). If the invoice is issued TO 'Frank Link Logistics' (Purchase), you MUST extract the seller/vendor name (from the top/letterhead). NEVER output 'Frank Link Logistics' or 'Frank Link' as the company name." 
    },
    gstin: { 
      type: SchemaType.STRING, 
      description: "GST Identification Number of the trading partner. CRITICAL: NEVER output Frank Link Logistics' own GSTIN ('27AADFF7532P1ZY') here. If it's a Sales bill, extract the buyer's/customer's GSTIN. If it's a Purchase bill, extract the seller's/vendor's GSTIN." 
    },
    date: { 
      type: SchemaType.STRING, 
      description: "Bill date in DD.MM.YYYY format. CRITICAL: Indian invoices write dates in DD/MM/YYYY or DD-MM-YYYY format. If you see '03/05/2026', it represents May 3rd, 2026, so you MUST output '03.05.2026'. DO NOT interpret it in US format (MM/DD/YYYY) where '03/05' would be March 5th." 
    },
    billType: { 
      type: SchemaType.STRING, 
      format: "enum",
      description: "CRITICAL: Set to 'PURCHASE' if the invoice is issued BY a vendor/supplier TO 'Frank Link Logistics' (i.e. 'Frank Link Logistics' or its GSTIN '27AADFF7532P1ZY' is the buyer/recipient/consignee). Set to 'SALES' if the invoice is issued BY 'Frank Link Logistics' TO a customer (i.e. 'Frank Link Logistics' is the seller/issuer at the top). Check both company names and GSTINs carefully to determine this.",
      enum: ["SALES", "PURCHASE"]
    },
    netAmount: { type: SchemaType.NUMBER, description: "numeric value of net/taxable base amount" },
    cgstAmount: { type: SchemaType.NUMBER, description: "numeric value of CGST amount (0 if not present)" },
    sgstAmount: { type: SchemaType.NUMBER, description: "numeric value of SGST amount (0 if not present)" },
    igstAmount: { type: SchemaType.NUMBER, description: "numeric value of IGST amount (0 if not present)" },
    jwrAmount: { 
      type: SchemaType.NUMBER, 
      description: "numeric value of any SEPARATE, ADDITIONAL Job Work (JWR) or Freight charges listed as a separate line item (0 if not present or if already included in the base net_amount)." 
    },
    totalAmount: { type: SchemaType.NUMBER, description: "numeric value of total/grand total amount" },
    rawText: { 
      type: SchemaType.STRING, 
      description: "A full, verbatim transcript/OCR of all text printed on this invoice/PDF, including all lines, numbers, headers, and descriptions." 
    }
  },
  required: ["invoiceNumber", "company", "gstin", "date", "billType", "netAmount", "cgstAmount", "sgstAmount", "igstAmount", "jwrAmount", "totalAmount"]
};

// Known vendors list for direct correction match
export const KNOWN_VENDORS: { [key: string]: string } = {
  'Aakash Logistics': '27AATFA2231Q1ZZ',
  'Godi Seal Kamgar': '27AAAAG0098F1ZW',
  'Skylink Freight': '27AAFCS1941N1Z0',
  'Sarveshwar Logistics': '27AAOCS1721K1Z3',
  'Allcargo Global': '27AAZCA2505N1Z4',
  'Pulsotronic India': '27ABDFP3805G1ZD',
  'Lifeline Technologies': '27AAHFA1108L1ZN',
};

/**
 * Process raw text extracted from a digital PDF
 */
export async function processPdfText(pdfText: string, apiKey: string): Promise<Omit<Bill, 'id' | 'syncedToSheets'>> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: billSchema,
      temperature: 0.1
    },
    systemInstruction: "You are an automated logistics bill extractor for Frank Link Logistics. Under no circumstances should you ever output 'Frank Link Logistics' or its GSTIN '27AADFF7532P1ZY' in the 'company' or 'gstin' fields. Instead, you must always extract the other trading partner's details (vendor/customer name and their GSTIN). If the bill is issued by Frank Link Logistics, the partner is the customer under 'Bill To'. If the bill is issued to Frank Link Logistics, the partner is the vendor/seller at the top."
  });

  const prompt = `Analyze the raw text extracted from this digital PDF bill and extract the required invoice parameters according to the response schema:

"""
${pdfText}
"""`;

  const result = await model.generateContent(prompt);
  const responseText = result.response.text();
  const parsed = JSON.parse(responseText);

  return postProcessBill(parsed, pdfText);
}

/**
 * Process visual image file (OCR Multimodal)
 */
export async function processBillImage(file: File, apiKey: string): Promise<Omit<Bill, 'id' | 'syncedToSheets'>> {
  const compressedFile = await compressImage(file);
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: billSchema,
      temperature: 0.1
    },
    systemInstruction: "You are an automated logistics bill extractor for Frank Link Logistics. Under no circumstances should you ever output 'Frank Link Logistics' or its GSTIN '27AADFF7532P1ZY' in the 'company' or 'gstin' fields. Instead, you must always extract the other trading partner's details (vendor/customer name and their GSTIN). If the bill is issued by Frank Link Logistics, the partner is the customer under 'Bill To'. If the bill is issued to Frank Link Logistics, the partner is the vendor/seller at the top."
  });

  const prompt = "Analyze this bill/invoice image and extract all parameters according to the response schema.";
  const imagePart = await fileToGenerativePart(compressedFile);

  const result = await model.generateContent([prompt, imagePart]);
  const responseText = result.response.text();
  const parsed = JSON.parse(responseText);

  return postProcessBill(parsed, parsed.rawText || '');
}

/**
 * Test connectivity to Gemini API
 */
export async function testGeminiConnection(apiKey: string): Promise<boolean> {
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    return res.ok;
  } catch {
    return false;
  }
}

/* ── Fallback Post-Processors & Corrections ───────────────────────────────── */

function postProcessBill(parsed: any, ocrText: string): Omit<Bill, 'id' | 'syncedToSheets'> {
  let company = (parsed.company || '').trim();
  let gstin = (parsed.gstin || '').trim().replace(/[^A-Z0-9]/gi, '').toUpperCase();
  const billType: 'SALES' | 'PURCHASE' = parsed.billType === 'SALES' ? 'SALES' : 'PURCHASE';

  const ownGstin = '27AADFF7532P1ZY';
  const ownPan = 'AADFF7532P';

  // Safety checks to filter out Frank Link Logistics own identities
  const normalizedCompany = company.toLowerCase().replace(/[^a-z]/g, '');
  const isOwnCompany = normalizedCompany.includes('franklink') || 
                       normalizedCompany.includes('franklin') || 
                       normalizedCompany.includes('franklk') || 
                       normalizedCompany.includes('frankln') ||
                       (normalizedCompany.startsWith('frank') && normalizedCompany.includes('link'));

  const isOwnGstin = gstin === ownGstin || gstin.includes(ownPan);

  if (isOwnCompany || isOwnGstin || !company) {
    const matched = findKnownVendorInText(ocrText) || extractClientFromRawText(ocrText);
    if (matched) {
      company = matched.company;
      gstin = matched.gstin;
    } else {
      if (isOwnCompany) company = '';
      if (isOwnGstin) gstin = '';
    }
  }

  // Attempt to fill in missing GSTIN if vendor name is known
  if (company && !gstin) {
    const matchedGstin = matchKnownVendor(company);
    if (matchedGstin) gstin = matchedGstin;
  }

  // Sanitize numeric amounts
  let net = parseFloat(parsed.netAmount) || 0;
  let cgst = parseFloat(parsed.cgstAmount) || 0;
  let sgst = parseFloat(parsed.sgstAmount) || 0;
  let igst = parseFloat(parsed.igstAmount) || 0;
  let jwr = parseFloat(parsed.jwrAmount) || 0;
  let total = parseFloat(parsed.totalAmount) || 0;

  // JWR / Freight duplication prevention
  if (net > 0 && jwr > 0 && Math.abs(jwr - net) < 2) {
    jwr = 0;
  }

  const baseSum = net + cgst + sgst + igst;
  const realTotal = findRealTotalInText(ocrText);
  const targetTotal = realTotal > 0 ? realTotal : total;

  if (Math.abs(baseSum - targetTotal) < 2 && jwr > 0) {
    jwr = 0;
  }

  // Recalculate total with round-off corrections
  const recalculatedTotal = net + cgst + sgst + igst + jwr;
  if (Math.abs(recalculatedTotal - targetTotal) < 1) {
    total = targetTotal;
  } else {
    total = recalculatedTotal;
  }

  // Debug: log what the AI returned for invoice number
  console.log('[Gemini] invoiceNumber extracted:', JSON.stringify(parsed.invoiceNumber), '| final:', (parsed.invoiceNumber || '').trim() || '(empty)');

  return {
    invoiceNumber: (parsed.invoiceNumber || '').trim(),
    company: company.replace(/(?:^M\/S\s*[:-]?\s*)/i, '').trim(),
    gstin,
    date: parsed.date || todayFormatted(),
    billType,
    netAmount: net,
    cgstAmount: cgst,
    sgstAmount: sgst,
    igstAmount: igst,
    jwrAmount: jwr,
    totalAmount: total,
    processedAt: new Date().toISOString()
  };
}

function todayFormatted(): string {
  const d = new Date();
  return `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${d.getFullYear()}`;
}

function matchKnownVendor(name: string): string | null {
  const lower = name.toLowerCase();
  for (const [vendor, gstin] of Object.entries(KNOWN_VENDORS)) {
    if (lower.includes(vendor.toLowerCase()) || vendor.toLowerCase().includes(lower)) {
      return gstin;
    }
  }
  return null;
}

function findKnownVendorInText(text: string): { company: string, gstin: string } | null {
  if (!text) return null;
  const lowerText = text.toLowerCase();
  for (const [vendor, gstin] of Object.entries(KNOWN_VENDORS)) {
    if (lowerText.includes(vendor.toLowerCase())) {
      return { company: vendor, gstin };
    }
  }
  return null;
}

function extractClientFromRawText(text: string): { company: string, gstin: string } | null {
  if (!text) return null;
  const lines = text.split('\n');
  const ownGstin = '27AADFF7532P1ZY';
  const ownPan = 'AADFF7532P';
  
  const gstinRegex = /\b\d{2}[A-Z]{5}\d{4}[A-Z\d]{4}\b/gi;
  const matches = text.match(gstinRegex) || [];
  const otherGstins = [...new Set(matches.map(g => g.toUpperCase()))].filter(g => g !== ownGstin && !g.includes(ownPan));
  const partnerGstin = otherGstins[0] || '';
  
  let partnerCompany = '';
  
  const prefixes = [
    /m\/s\s*[:-]?\s*(.+)/i,
    /bill\s+to\s*[:-]?\s*(.+)/i,
    /consignee\s*[:-]?\s*(.+)/i,
    /buyer\s*[:-]?\s*(.+)/i,
    /to\s*[:-]?\s*(.+)/i
  ];
  
  for (const line of lines) {
    const trimmed = line.trim();
    for (const prefix of prefixes) {
      const match = trimmed.match(prefix);
      if (match && match[1]) {
        let potential = match[1].trim().replace(/^[:\-\s\.]+/g, '').trim();
        potential = potential.split(/(?:\s{2,}|\t|Bill\s*No|Date\s*:-|Job\s*No|Inv\s*No|Invoice\s*No|Receipt|A\/c|PAN|GSTIN)/i)[0].trim();
        
        const normPotential = potential.toLowerCase().replace(/[^a-z]/g, '');
        const isOwnPotential = normPotential.includes('franklink') || 
                               normPotential.includes('franklin') || 
                               normPotential.includes('franklk') || 
                               normPotential.includes('frankln') ||
                               (normPotential.startsWith('frank') && normPotential.includes('link'));
                               
        if (potential.length > 3 && !isOwnPotential && !potential.toLowerCase().includes('logistics by')) {
          partnerCompany = potential;
          break;
        }
      }
    }
    if (partnerCompany) break;
  }
  
  if (partnerGstin || partnerCompany) {
    return { company: partnerCompany, gstin: partnerGstin };
  }
  return null;
}

function findRealTotalInText(text: string): number {
  if (!text) return 0;
  const lines = text.split('\n');
  const priorityKeywords = [
    /grand\s+total/i,
    /g\.total/i,
    /invoice\s+value/i,
    /net\s+payable/i,
    /balance\s+bill\s+amt/i
  ];
  
  for (const pattern of priorityKeywords) {
    for (const line of lines) {
      if (line.match(pattern)) {
        const amountMatch = line.match(/([0-9,]+\.[0-9]{2}|[0-9,]+)/);
        if (amountMatch) {
          const cleaned = amountMatch[0].replace(/[₹,\s]/g, '');
          const val = parseFloat(cleaned) || 0;
          if (val > 0) return val;
        }
      }
    }
  }
  return 0;
}

function fileToGenerativePart(file: Blob): Promise<{ inlineData: { data: string, mimeType: string } }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64Data = (reader.result as string).split(',')[1];
      resolve({
        inlineData: {
          data: base64Data,
          mimeType: file.type
        }
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function compressImage(file: File, maxDimension = 1200, quality = 0.7): Promise<Blob> {
  return new Promise((resolve) => {
    if (!file.type.startsWith('image/')) {
      return resolve(file);
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => resolve(blob || file),
          'image/jpeg',
          quality
        );
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}
