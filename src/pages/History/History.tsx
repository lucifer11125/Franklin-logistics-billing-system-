import React, { useState, useEffect, useRef } from 'react';
import { Bill, AppSettings } from '../../types';
import { db } from '../../database/db';
import { appendBillToSheets, syncPending, deleteBillFromSheets } from '../../services/sheets';
import { exportToExcel, downloadBackup, importBackup } from '../../services/exporter';

interface HistoryProps {
  settings: AppSettings;
  showToast: (text: string, type: 'success' | 'error' | 'info') => void;
}

type FilterType = 'all' | 'sales' | 'purchases' | 'unsynced';

export const History: React.FC<HistoryProps> = ({ settings, showToast }) => {
  const [bills, setBills] = useState<Bill[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [editingBillId, setEditingBillId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<Omit<Bill, 'id' | 'syncedToSheets'> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { loadBills(); }, [filter, searchQuery]);

  const loadBills = async () => {
    try {
      let list = await db.getAllBills();
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        list = list.filter(b => b.company.toLowerCase().includes(q) || b.gstin.toLowerCase().includes(q) || b.date.includes(q));
      }
      if (filter === 'sales') list = list.filter(b => b.billType === 'SALES');
      else if (filter === 'purchases') list = list.filter(b => b.billType === 'PURCHASE');
      else if (filter === 'unsynced') list = list.filter(b => !b.syncedToSheets);
      setBills(list);
    } catch (err) { console.error('Failed to load bills:', err); }
  };

  const handleStartEdit = (bill: Bill) => {
    setEditingBillId(bill.id!);
    setEditFormData({ invoiceNumber: bill.invoiceNumber || '', company: bill.company, gstin: bill.gstin, date: bill.date, billType: bill.billType, netAmount: bill.netAmount, cgstAmount: bill.cgstAmount, sgstAmount: bill.sgstAmount, igstAmount: bill.igstAmount, jwrAmount: bill.jwrAmount, totalAmount: bill.totalAmount, processedAt: bill.processedAt });
  };

  const handleCancelEdit = () => { setEditingBillId(null); setEditFormData(null); };

  const handleEditChange = (key: keyof Omit<Bill, 'id' | 'syncedToSheets'>, val: any) => {
    setEditFormData(prev => {
      if (!prev) return null;
      const next = { ...prev, [key]: val } as any;
      if (['netAmount','cgstAmount','sgstAmount','igstAmount','jwrAmount'].includes(key as string)) {
        next.totalAmount = parseFloat(((parseFloat(next.netAmount)||0)+(parseFloat(next.cgstAmount)||0)+(parseFloat(next.sgstAmount)||0)+(parseFloat(next.igstAmount)||0)+(parseFloat(next.jwrAmount)||0)).toFixed(2));
      }
      return next;
    });
  };

  const handleSaveEdit = async (id: string) => {
    if (!editFormData) return;
    if (!editFormData.company.trim()) { showToast('Company Name is required.', 'error'); return; }
    if (!editFormData.date.match(/^\d{2}\.\d{2}\.\d{4}$/)) { showToast('Date must be DD.MM.YYYY format.', 'error'); return; }
    try {
      await db.saveBill({ ...editFormData, id, syncedToSheets: false });
      showToast('Record updated.', 'success');
      setEditingBillId(null); setEditFormData(null);
      loadBills();
    } catch (err: any) { showToast('Save failed: ' + err.message, 'error'); }
  };

  const handleDelete = async (id: string) => {
    const bill = bills.find(b => b.id === id);
    if (!bill) return;
    const msg = bill.syncedToSheets ? 'Delete this record? It will also be purged from Google Sheets.' : 'Delete this bill? This is irreversible.';
    if (!window.confirm(msg)) return;
    try {
      if (bill.syncedToSheets && settings.sheetsId) {
        try { await deleteBillFromSheets(bill, settings.sheetsId, settings.serviceAccountJson, settings.sheetsApiKey || settings.geminiApiKey); }
        catch { showToast('Local deleted. Sheets delete failed.', 'error'); }
      }
      await db.deleteBill(id);
      showToast('Bill deleted.', 'success');
      setExpandedId(null);
      loadBills();
    } catch (err: any) { showToast('Delete failed: ' + (err.message || ''), 'error'); }
  };

  const handleSyncSingle = async (bill: Bill) => {
    if (syncingId || !navigator.onLine) return;
    setSyncingId(bill.id!);
    try {
      if (!settings.sheetsId) { showToast('Sheet ID missing.', 'error'); return; }
      const ok = await appendBillToSheets(bill, settings.sheetsId, settings.serviceAccountJson, settings.sheetsApiKey || settings.geminiApiKey);
      if (ok) { await db.markBillSynced(bill.id!); showToast('Synced ✓', 'success'); loadBills(); }
    } catch (err: any) { showToast(err.message || 'Sync failed.', 'error'); }
    finally { setSyncingId(null); }
  };

  const handleSyncAll = async () => {
    if (isSyncingAll || !navigator.onLine) return;
    setIsSyncingAll(true);
    try {
      // Always fetch ALL unsynced bills from DB — not just the currently-filtered view.
      // This prevents purchase bills from being skipped when the Sales filter is active.
      const allBills = await db.getAllBills();
      const unsynced = allBills.filter(b => !b.syncedToSheets);
      if (!unsynced.length) { showToast('No pending records.', 'info'); return; }
      if (!settings.sheetsId) { showToast('Sheet ID missing.', 'error'); return; }
      const count = await syncPending(unsynced, settings.sheetsId, settings.serviceAccountJson, settings.sheetsApiKey || settings.geminiApiKey);
      showToast(`Synced ${count} records ✓`, 'success');
      loadBills();
    } catch (err: any) { showToast(err.message || 'Batch sync failed.', 'error'); }
    finally { setIsSyncingAll(false); }
  };

  const unsyncedCount = bills.filter(b => !b.syncedToSheets).length;

  const TABS: { id: FilterType; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'sales', label: 'Sales' },
    { id: 'purchases', label: 'Purchases' },
    { id: 'unsynced', label: `Unsynced (${unsyncedCount})` },
  ];

  return (
    <div className="anim-slide-up" style={{ display: 'flex', flexDirection: 'column', gap: 20, paddingBottom: 24 }}>

      {/* ── Page header ───────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          <p className="text-label" style={{ color: 'var(--gold)' }}>Billing Ledger</p>
          <h2 className="text-headline" style={{ fontSize: 20, marginTop: 2 }}>Transaction History</h2>
        </div>
        {/* Data utilities */}
        <div style={{ display: 'flex', gap: 10 }}>
          {[
            { label: 'Export', icon: 'download', onClick: () => { if (bills.length) { exportToExcel(bills, filter.toUpperCase()); showToast('Excel downloaded.', 'success'); } } },
            { label: 'Backup', icon: 'save', onClick: () => { downloadBackup(bills); showToast('Backup ready.', 'success'); } },
            { label: 'Restore', icon: 'upload', onClick: () => fileInputRef.current?.click() },
          ].map(btn => (
            <button key={btn.label} className="cs-btn-ghost" style={{ padding: '8px 14px', fontSize: 11, gap: 6 }} onClick={btn.onClick} disabled={btn.label !== 'Restore' && bills.length === 0}>
              <span className="material-symbols-rounded" style={{ fontSize: 15 }}>{btn.icon}</span>
              {btn.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Search ────────────────────────────────────────────────────────── */}
      <div style={{ position: 'relative' }}>
        <span className="material-symbols-rounded" style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', fontSize: 18, color: 'var(--text-muted)', pointerEvents: 'none' }}>search</span>
        <input
          type="text"
          placeholder="Search company, GSTIN, or date..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="cs-input"
          style={{ paddingLeft: 48 }}
        />
      </div>

      {/* ── Filter Tabs ───────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 4, background: 'var(--navy-1)', borderRadius: 12, padding: 4, border: '1px solid var(--border-subtle)' }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setFilter(tab.id)}
            style={{
              flex: 1, padding: '8px 4px', borderRadius: 9, border: 'none', cursor: 'pointer', transition: 'all 0.2s ease',
              fontFamily: 'Space Grotesk', fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase',
              background: filter === tab.id ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' : 'transparent',
              color: filter === tab.id ? '#08091a' : 'var(--text-muted)',
              boxShadow: filter === tab.id ? '0 2px 12px rgba(245,158,11,0.25)' : 'none',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Pending sync banner ───────────────────────────────────────────── */}
      {unsyncedCount > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderRadius: 14, background: 'rgba(245,158,11,0.06)', border: '1px solid var(--gold-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="material-symbols-rounded" style={{ fontSize: 18, color: 'var(--gold)', animation: 'pulse-amber 1.5s infinite' }}>sync</span>
            <span style={{ fontFamily: 'Space Grotesk', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
              <strong style={{ color: 'var(--gold)' }}>{unsyncedCount}</strong> invoice{unsyncedCount !== 1 ? 's' : ''} waiting to sync to Google Sheets
            </span>
          </div>
          <button className="cs-btn-primary" style={{ padding: '8px 18px', fontSize: 11 }} onClick={handleSyncAll} disabled={isSyncingAll || !navigator.onLine}>
            {isSyncingAll ? 'Uploading...' : 'Sync All'}
          </button>
        </div>
      )}

      {/* ── Ledger List ───────────────────────────────────────────────────── */}
      <div className="cs-card" style={{ overflow: 'hidden', padding: 0 }}>
        {bills.length === 0 ? (
          <div style={{ padding: '64px 24px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 52, height: 52, borderRadius: 14, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span className="material-symbols-rounded" style={{ fontSize: 24, color: 'var(--text-muted)' }}>folder_off</span>
            </div>
            <p className="text-label">No Billing Records Found</p>
          </div>
        ) : (
          bills.map((b) => {
            const isOpen = expandedId === b.id;
            const isSales = b.billType === 'SALES';
            return (
              <div key={b.id} className="ledger-row" style={{ paddingBottom: isOpen ? 0 : undefined }}>
                {/* Row header */}
                <div
                  style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 20px', cursor: 'pointer' }}
                  onClick={() => setExpandedId(prev => prev === b.id ? null : b.id!)}
                >
                  {/* Type indicator */}
                  <div style={{
                    width: 36, height: 36, borderRadius: 10, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: isSales ? 'rgba(52,211,153,0.1)' : 'rgba(129,140,248,0.1)',
                    border: `1px solid ${isSales ? 'rgba(52,211,153,0.2)' : 'rgba(129,140,248,0.2)'}`,
                  }}>
                    <span className="material-symbols-rounded" style={{ fontSize: 16, color: isSales ? '#34d399' : '#818cf8', fontVariationSettings: "'FILL' 1" }}>
                      {isSales ? 'arrow_outward' : 'call_received'}
                    </span>
                  </div>

                  {/* Company info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 13, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: '0.03em' }}>{b.company}</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3 }}>
                      {b.invoiceNumber && (
                        <span style={{ fontFamily: 'Space Mono', fontSize: 9, fontWeight: 700, color: 'var(--gold)', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 4, padding: '1px 6px', letterSpacing: '0.05em' }}>
                          #{b.invoiceNumber}
                        </span>
                      )}
                      <p style={{ fontFamily: 'Space Mono', fontSize: 9, color: 'var(--text-muted)' }}>{b.gstin || 'NO GSTIN'} · {b.date}</p>
                    </div>
                  </div>

                  {/* Amount + sync badge */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                    <p style={{ fontFamily: 'Sora', fontWeight: 800, fontSize: 15, color: 'var(--text-primary)' }}>
                      ₹{b.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </p>
                    <div className={b.syncedToSheets ? 'cs-badge cs-badge-green' : 'cs-badge cs-badge-gold'}>
                      {b.syncedToSheets ? 'Synced' : 'Pending'}
                    </div>
                    <span className="material-symbols-rounded" style={{ fontSize: 16, color: 'var(--text-muted)', transition: 'transform 0.2s ease', transform: isOpen ? 'rotate(180deg)' : undefined }}>expand_more</span>
                  </div>
                </div>

                {/* Expanded details */}
                {isOpen && (
                  <div className="anim-fade-in" style={{ padding: '0 20px 20px', borderTop: '1px solid var(--border-subtle)' }}>
                    {editingBillId === b.id && editFormData ? (
                      /* ── Edit form ─────────────────────────────────────── */
                      <div style={{ paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                          <div>
                            <label className="field-label">Company Name</label>
                            <input type="text" className="cs-input" value={editFormData.company} onChange={e => handleEditChange('company', e.target.value)} />
                          </div>
                          <div>
                            <label className="field-label">Category</label>
                            <select className="cs-input" style={{ appearance: 'none', cursor: 'pointer' }} value={editFormData.billType} onChange={e => handleEditChange('billType', e.target.value)}>
                              <option style={{ background: 'var(--navy-2)' }} value="PURCHASE">Purchase</option>
                              <option style={{ background: 'var(--navy-2)' }} value="SALES">Sales</option>
                            </select>
                          </div>
                          <div>
                            <label className="field-label">Invoice Number</label>
                            <input type="text" className="cs-input" style={{ fontFamily: 'Space Mono', textTransform: 'uppercase', fontSize: 12 }} value={(editFormData as any).invoiceNumber || ''} onChange={e => handleEditChange('invoiceNumber' as any, e.target.value.toUpperCase())} placeholder="e.g. INV-001" />
                          </div>
                          <div>
                            <label className="field-label">GSTIN</label>
                            <input type="text" className="cs-input" style={{ fontFamily: 'Space Mono', textTransform: 'uppercase' }} value={editFormData.gstin} onChange={e => handleEditChange('gstin', e.target.value.toUpperCase())} />
                          </div>
                          <div>
                            <label className="field-label">Date (DD.MM.YYYY)</label>
                            <input type="text" className="cs-input" value={editFormData.date} onChange={e => handleEditChange('date', e.target.value)} />
                          </div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                          {[
                            { l: 'Base Amount', k: 'netAmount' }, { l: 'CGST', k: 'cgstAmount' }, { l: 'SGST', k: 'sgstAmount' },
                            { l: 'IGST', k: 'igstAmount' }, { l: 'Freight', k: 'jwrAmount' }, { l: 'Grand Total', k: 'totalAmount' },
                          ].map(({ l, k }) => (
                            <div key={k}>
                              <label className="field-label" style={k === 'totalAmount' ? { color: 'var(--gold)' } : {}}>{l} (₹)</label>
                              <input type="number" step="0.01" className="cs-input" style={{ textAlign: 'right', ...(k === 'totalAmount' ? { color: 'var(--gold)', borderColor: 'var(--gold-border)', background: 'rgba(245,158,11,0.04)' } : {}) }} value={(editFormData as any)[k] || ''} onChange={e => handleEditChange(k as any, parseFloat(e.target.value) || 0)} />
                            </div>
                          ))}
                        </div>
                        <div style={{ display: 'flex', gap: 10 }}>
                          <button className="cs-btn-ghost" onClick={handleCancelEdit} style={{ flex: 1, fontSize: 11, padding: '10px' }}>Cancel</button>
                          <button className="cs-btn-primary" onClick={() => handleSaveEdit(b.id!)} style={{ flex: 2, fontSize: 11, padding: '10px' }}>Save Changes</button>
                        </div>
                      </div>
                    ) : (
                      /* ── View mode ─────────────────────────────────────── */
                      <div style={{ paddingTop: 16 }}>
                        {/* Tax breakdown */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: 12, marginBottom: 16 }}>
                          {[
                            { l: 'Base', v: b.netAmount },
                            ...(b.cgstAmount > 0 ? [{ l: 'CGST', v: b.cgstAmount }] : []),
                            ...(b.sgstAmount > 0 ? [{ l: 'SGST', v: b.sgstAmount }] : []),
                            ...(b.igstAmount > 0 ? [{ l: 'IGST', v: b.igstAmount }] : []),
                            ...(b.jwrAmount > 0 ? [{ l: 'Freight', v: b.jwrAmount }] : []),
                          ].map(({ l, v }) => (
                            <div key={l} style={{ padding: '10px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-subtle)' }}>
                              <p className="text-label" style={{ marginBottom: 4 }}>{l}</p>
                              <p style={{ fontFamily: 'Space Mono', fontSize: 11, fontWeight: 700, color: 'var(--text-primary)' }}>₹{v.toFixed(2)}</p>
                            </div>
                          ))}
                        </div>

                        {/* Month tab tag */}
                        {(() => {
                          const parts = (b.date || '').split('.');
                          if (parts.length === 3) {
                            const mName = ['January','February','March','April','May','June','July','August','September','October','November','December'][parseInt(parts[1])-1];
                            if (mName) return (
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 6, background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.12)', marginBottom: 14 }}>
                                <span className="material-symbols-rounded" style={{ fontSize: 12, color: '#34d399' }}>grid_on</span>
                                <span style={{ fontFamily: 'Space Grotesk', fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                                  Sheet Tab: <strong style={{ color: '#34d399' }}>{mName} {parts[2]}</strong>
                                </span>
                              </div>
                            );
                          }
                          return null;
                        })()}

                        {/* Actions */}
                        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10, paddingTop: 12, borderTop: '1px solid var(--border-subtle)' }}>
                          <button
                            onClick={() => handleDelete(b.id!)}
                            style={{ width: 34, height: 34, borderRadius: 9, border: '1px solid var(--border-subtle)', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', transition: 'all 0.2s ease' }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#fb7185'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(244,63,94,0.3)'; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-subtle)'; }}
                          >
                            <span className="material-symbols-rounded" style={{ fontSize: 16 }}>delete</span>
                          </button>
                          <button
                            onClick={() => handleStartEdit(b)}
                            style={{ width: 34, height: 34, borderRadius: 9, border: '1px solid var(--border-subtle)', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', transition: 'all 0.2s ease' }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.15)'; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-subtle)'; }}
                          >
                            <span className="material-symbols-rounded" style={{ fontSize: 16 }}>edit</span>
                          </button>
                          <button
                            className="cs-btn-primary"
                            style={{ padding: '7px 16px', fontSize: 10 }}
                            onClick={() => handleSyncSingle(b)}
                            disabled={!!syncingId || !navigator.onLine}
                          >
                            {syncingId === b.id ? 'Syncing...' : b.syncedToSheets ? 'Re-Sync' : 'Sync Now'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Hidden inputs */}
      <input type="file" accept=".json" ref={fileInputRef} onChange={async e => {
        const f = e.target.files?.[0]; if (!f) return;
        showToast('Importing backup...', 'info');
        const res = await importBackup(f);
        showToast(res.message, res.failed ? 'error' : 'success');
        if (!res.failed) loadBills();
        e.target.value = '';
      }} style={{ display: 'none' }} />
    </div>
  );
};

export default History;
