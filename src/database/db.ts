import Dexie, { type Table } from 'dexie';
import { Bill } from '../types';

export class FrankLinkDatabase extends Dexie {
  bills!: Table<Bill, string>;

  constructor() {
    super('FrankLinkDatabase');
    this.version(1).stores({
      bills: 'id, company, gstin, date, billType, syncedToSheets, processedAt'
    });
    // v2: added invoiceNumber field
    this.version(2).stores({
      bills: 'id, invoiceNumber, company, gstin, date, billType, syncedToSheets, processedAt'
    });
  }


  // Generate custom compatible legacy-style string ID
  generateId(): string {
    return `bill_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  // Get all bills sorted by processedAt descending
  async getAllBills(): Promise<Bill[]> {
    const list = await this.bills.toArray();
    return list.sort((a, b) => new Date(b.processedAt).getTime() - new Date(a.processedAt).getTime());
  }

  // Get unsynced bills (filter in-memory — IndexedDB doesn't coerce boolean false to 0)
  async getUnsyncedBills(): Promise<Bill[]> {
    const all = await this.bills.toArray();
    return all.filter(b => !b.syncedToSheets);
  }

  // Unified save/insert
  async saveBill(bill: Omit<Bill, 'id'> & { id?: string }): Promise<Bill> {
    const finalBill: Bill = {
      ...bill,
      id: bill.id || this.generateId(),
    };
    await this.bills.put(finalBill);
    return finalBill;
  }

  // Delete bill
  async deleteBill(id: string): Promise<void> {
    await this.bills.delete(id);
  }

  // Mark bill as synced
  async markBillSynced(id: string): Promise<void> {
    const bill = await this.bills.get(id);
    if (bill) {
      bill.syncedToSheets = true;
      await this.bills.put(bill);
    }
  }

  // Wipe database
  async wipeAllBills(): Promise<void> {
    await this.bills.clear();
  }
}

export const db = new FrankLinkDatabase();
