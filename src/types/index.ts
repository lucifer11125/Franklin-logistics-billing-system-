export interface Bill {
  id?: string; // e.g. "bill_1716500000000" or generated uuid
  company: string;
  gstin: string;
  date: string; // DD.MM.YYYY
  billType: 'SALES' | 'PURCHASE';
  netAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  jwrAmount: number;
  totalAmount: number;
  syncedToSheets: boolean;
  processedAt: string; // ISO String
}

export interface AppSettings {
  geminiApiKey: string;
  sheetsId: string;
  sheetsApiKey: string;
  serviceAccountJson: string;
  autoSync: boolean;
  darkMode: boolean;
}
