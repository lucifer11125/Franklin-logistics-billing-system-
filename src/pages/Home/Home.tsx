import React, { useState, useRef, useEffect } from 'react';
import { Bill, AppSettings } from '../../types';
import { db } from '../../database/db';
import { processPdfText, processBillImage } from '../../services/gemini';
import { extractTextFromPdf } from '../../services/pdf';
import { appendBillToSheets } from '../../services/sheets';
import BottomSheet from '../../components/BottomSheet';
import LoadingShimmer from '../../components/LoadingShimmer';
import ReviewWorkspace from './ReviewWorkspace';

type Page = 'home' | 'history' | 'summary' | 'settings';

interface HomeProps {
  settings: AppSettings;
  onNavigate: (page: Page) => void;
  showToast: (text: string, type: 'success' | 'error' | 'info') => void;
}

export const Home: React.FC<HomeProps> = ({ settings, onNavigate, showToast }) => {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [extractedData, setExtractedData] = useState<Omit<Bill, 'id' | 'syncedToSheets'> | null>(null);

  const [todayCount, setTodayCount] = useState(0);
  const [monthlyProfit, setMonthlyProfit] = useState(0);
  const [unsyncedCount, setUnsyncedCount] = useState(0);

  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [similarDuplicateData, setSimilarDuplicateData] = useState<{ newBill: Omit<Bill, 'id' | 'syncedToSheets'>; existingBill: Bill } | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchStats();
  }, [extractedData]);

  async function fetchStats() {
    try {
      const bills = await db.getAllBills();
      const todayStr = todayFormatted();
      const scannedToday = bills.filter(b => {
        try {
          const d = new Date(b.processedAt);
          return `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${d.getFullYear()}` === todayStr;
        } catch { return false; }
      }).length;
      setTodayCount(scannedToday);

      const curM = new Date().getMonth(), curY = new Date().getFullYear();
      let sales = 0, purchases = 0;
      bills.forEach(b => {
        try {
          const d = new Date(b.processedAt);
          if (d.getMonth() === curM && d.getFullYear() === curY) {
            if (b.billType === 'SALES') sales += b.totalAmount - (b.cgstAmount + b.sgstAmount + b.igstAmount);
            else purchases += b.netAmount;
          }
        } catch {}
      });
      setMonthlyProfit(Math.max(sales - purchases, 0));
      setUnsyncedCount(bills.filter(b => !b.syncedToSheets).length);
    } catch (err) {
      console.error('Failed to compute dashboard statistics:', err);
    }
  }

  const todayFormatted = (): string => {
    const d = new Date();
    return `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${d.getFullYear()}`;
  };

  const processFile = async (selectedFile: File) => {
    if (!settings.geminiApiKey) {
      showToast('Please configure your Gemini API Key in Settings first.', 'error');
      onNavigate('settings');
      return;
    }
    setFile(selectedFile);
    setLoading(true);
    try {
      let data: Omit<Bill, 'id' | 'syncedToSheets'>;
      if (selectedFile.type === 'application/pdf') {
        showToast('Extracting PDF invoice content...', 'info');
        const pdfText = await extractTextFromPdf(selectedFile);
        if (pdfText && pdfText.trim().length > 30) {
          showToast('AI analyzing PDF structure...', 'info');
          data = await processPdfText(pdfText, settings.geminiApiKey);
        } else {
          showToast('Image-based PDF detected. Running AI OCR...', 'info');
          data = await processBillImage(selectedFile, settings.geminiApiKey);
        }
      } else {
        showToast('AI OCR image analysis in progress...', 'info');
        data = await processBillImage(selectedFile, settings.geminiApiKey);
      }
      setExtractedData(data);
      showToast('Invoice parsed successfully!', 'success');
    } catch (err: any) {
      showToast(err.message || 'Scanning failed. Check API Keys.', 'error');
      setFile(null);
      setExtractedData(null);
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    await processFile(selectedFile);
    e.target.value = '';
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) await processFile(droppedFile);
  };

  const executeSave = async (finalData: Omit<Bill, 'id' | 'syncedToSheets'>) => {
    setIsSaving(true);
    try {
      showToast('Saving to local database...', 'info');
      const savedBill = await db.saveBill({ ...finalData, syncedToSheets: false });
      let synced = false, targetTab = '';
      if (settings.autoSync && navigator.onLine && settings.sheetsId) {
        try {
          showToast('Syncing with Google Sheets...', 'info');
          synced = await appendBillToSheets(savedBill, settings.sheetsId, settings.serviceAccountJson, settings.sheetsApiKey || settings.geminiApiKey);
          if (synced) {
            await db.markBillSynced(savedBill.id!);
            const parts = (savedBill.date || '').split('.');
            if (parts.length === 3) {
              const mName = ['January','February','March','April','May','June','July','August','September','October','November','December'][parseInt(parts[1])-1];
              if (mName) targetTab = `${mName} ${parts[2]}`;
            }
          }
        } catch (syncErr) {
          showToast('Saved offline. Cloud sync bypassed.', 'info');
        }
      }
      if (synced) showToast(`Synced to '${targetTab}' ✓`, 'success');
      else if (!navigator.onLine) showToast('Saved locally. Internet offline.', 'info');
      else if (!settings.autoSync) showToast('Saved locally. Auto-sync is OFF.', 'success');
      else if (!settings.sheetsId) showToast('Saved locally. Sheet ID missing.', 'info');
      setFile(null); setExtractedData(null);
    } catch (err: any) {
      showToast('Save failed: ' + err.message, 'error');
    } finally {
      setIsSaving(false);
      setSimilarDuplicateData(null);
    }
  };

  const handleSave = async (finalData: Omit<Bill, 'id' | 'syncedToSheets'>) => {
    if (isSaving) return;
    if (!finalData.company.trim()) { showToast('Company name cannot be blank.', 'error'); return; }
    if (!finalData.date.match(/^\d{2}\.\d{2}\.\d{4}$/)) { showToast('Date must be DD.MM.YYYY format.', 'error'); return; }
    try {
      const allBills = await db.getAllBills();
      const exact = allBills.find(b =>
        b.company.toLowerCase().trim() === finalData.company.toLowerCase().trim() &&
        b.gstin.toLowerCase().trim() === finalData.gstin.toLowerCase().trim() &&
        b.date.trim() === finalData.date.trim() &&
        b.totalAmount === finalData.totalAmount &&
        b.billType === finalData.billType
      );
      if (exact) { showToast('Duplicate Found: Identical bill already saved.', 'error'); return; }
      const similar = allBills.find(b =>
        b.company.toLowerCase().trim() === finalData.company.toLowerCase().trim() &&
        b.totalAmount === finalData.totalAmount &&
        b.date.trim() !== finalData.date.trim()
      );
      if (similar) { setSimilarDuplicateData({ newBill: finalData, existingBill: similar }); return; }
      await executeSave(finalData);
    } catch (err: any) {
      showToast('Validation failed: ' + err.message, 'error');
    }
  };

  const handleDiscard = () => {
    if (window.confirm('Discard current document scan?')) {
      setFile(null); setExtractedData(null);
      showToast('Buffer cleared.', 'info');
    }
  };

  // ─── METRICS data ────────────────────────────────────────────────────────
  const metrics = [
    { label: 'Scanned Today', value: todayCount, icon: 'receipt_long', color: '#818cf8', accent: 'rgba(129,140,248,0.1)', border: 'rgba(129,140,248,0.15)', onClick: () => onNavigate('history') },
    { label: 'Monthly Profit', value: `₹${monthlyProfit.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, icon: 'payments', color: 'var(--gold)', accent: 'rgba(245,158,11,0.08)', border: 'var(--gold-border)', onClick: () => onNavigate('summary'), isGold: true },
    { label: 'Awaiting Sync', value: unsyncedCount, icon: unsyncedCount > 0 ? 'cloud_off' : 'cloud_done', color: unsyncedCount > 0 ? '#fb7185' : '#34d399', accent: unsyncedCount > 0 ? 'rgba(244,63,94,0.08)' : 'rgba(16,185,129,0.06)', border: unsyncedCount > 0 ? 'rgba(244,63,94,0.15)' : 'rgba(16,185,129,0.12)', onClick: () => onNavigate('history') },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, paddingBottom: 24 }}>

      {/* Loading Shimmer */}
      {loading && <LoadingShimmer />}

      {/* Review Workspace */}
      {!loading && extractedData && file && (
        <ReviewWorkspace file={file} extractedData={extractedData} onSave={handleSave} onDiscard={handleDiscard} isSaving={isSaving} />
      )}

      {!loading && !extractedData && (
        <div className="anim-slide-up" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

          {/* API Key Warning */}
          {!settings.geminiApiKey && (
            <div
              onClick={() => onNavigate('settings')}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '14px 20px', borderRadius: 14,
                background: 'rgba(245,158,11,0.07)', border: '1px solid var(--gold-border)',
                cursor: 'pointer', transition: 'all 0.2s ease',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(245,158,11,0.12)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'rgba(245,158,11,0.07)')}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span className="material-symbols-rounded" style={{ fontSize: 18, color: 'var(--gold)', fontVariationSettings: "'FILL' 1" }}>warning</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--gold)', letterSpacing: '0.05em', textTransform: 'uppercase', fontFamily: 'Space Grotesk' }}>
                  Gemini API Key Required — Configure in Settings
                </span>
              </div>
              <span className="material-symbols-rounded" style={{ fontSize: 16, color: 'var(--gold)' }}>arrow_forward</span>
            </div>
          )}

          {/* ── Metrics Grid ─────────────────────────────────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            {metrics.map((m, i) => (
              <div
                key={i}
                onClick={m.onClick}
                className="cs-card cs-card-interactive"
                style={{ padding: 20, background: m.accent, border: `1px solid ${m.border}`, cursor: 'pointer' }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
                  <div style={{
                    width: 38, height: 38, borderRadius: 10,
                    background: `${m.accent}`, border: `1px solid ${m.border}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <span className="material-symbols-rounded" style={{ fontSize: 18, color: m.color, fontVariationSettings: "'FILL' 1" }}>{m.icon}</span>
                  </div>
                  <span className="material-symbols-rounded" style={{ fontSize: 14, color: 'var(--text-muted)' }}>open_in_new</span>
                </div>
                <p className="metric-number" style={{ color: m.isGold ? 'var(--gold)' : 'var(--text-primary)', fontSize: '1.75rem' }}>{m.value}</p>
                <p className="text-label" style={{ marginTop: 6 }}>{m.label}</p>
              </div>
            ))}
          </div>

          {/* ── Scan Drop Zone ───────────────────────────────────────────── */}
          <div
            className="scan-zone"
            style={{
              minHeight: 280, display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', gap: 20, padding: 40, cursor: 'pointer', textAlign: 'center',
              borderColor: isDragOver ? 'rgba(245,158,11,0.6)' : undefined,
              background: isDragOver ? 'rgba(245,158,11,0.06)' : undefined,
            }}
            onClick={() => setIsSheetOpen(true)}
            onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
          >
            {/* Gold icon ring */}
            <div style={{
              width: 80, height: 80, borderRadius: '50%',
              background: 'rgba(245,158,11,0.08)',
              border: '2px dashed rgba(245,158,11,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: isDragOver ? '0 0 40px rgba(245,158,11,0.2)' : undefined,
              transition: 'all 0.3s ease',
            }}>
              <span className="material-symbols-rounded" style={{ fontSize: 34, color: 'var(--gold)', fontVariationSettings: isDragOver ? "'FILL' 1" : "'FILL' 0" }}>
                {isDragOver ? 'file_upload' : 'receipt_long'}
              </span>
            </div>

            <div>
              <h2 style={{ fontFamily: 'Sora', fontWeight: 700, fontSize: 18, color: 'var(--text-primary)', marginBottom: 8 }}>
                {isDragOver ? 'Drop to Analyze' : 'Scan Invoice or Import PDF'}
              </h2>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'Space Grotesk', lineHeight: 1.6, maxWidth: 340 }}>
                Drag & drop a bill here, or click to capture a photo / upload a digital PDF invoice.
              </p>
            </div>

            <button
              className="cs-btn-primary"
              onClick={e => { e.stopPropagation(); setIsSheetOpen(true); }}
            >
              <span className="material-symbols-rounded" style={{ fontSize: 16, fontVariationSettings: "'FILL' 1" }}>add_circle</span>
              Select Document
            </button>
          </div>

          {/* ── Workflow Guide ───────────────────────────────────────────── */}
          <div className="cs-card" style={{ padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span className="material-symbols-rounded" style={{ fontSize: 14, color: '#34d399', fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
              </div>
              <div>
                <p className="text-label" style={{ color: '#34d399' }}>Automated Pipeline</p>
                <p style={{ fontFamily: 'Sora', fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>Smart PWA Workflow</p>
              </div>
            </div>
            <div className="gold-line" style={{ marginBottom: 20 }} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
              {[
                { step: '01', icon: 'photo_camera', text: 'Capture a photo or upload a PDF of any Purchase or Sales bill', color: 'var(--gold)' },
                { step: '02', icon: 'text_snippet', text: 'Client-side PDF parser extracts raw text, bypassing heavy OCR wait times', color: '#818cf8' },
                { step: '03', icon: 'psychology', text: 'Gemini 2.5 Flash analyzes raw tables and schema parameters in real-time', color: '#34d399' },
                { step: '04', icon: 'cloud_sync', text: 'Verify math balances, confirm details, and sync to Google Sheets instantly', color: '#38bdf8' },
              ].map(({ step, icon, text, color }) => (
                <div key={step} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: 14, borderRadius: 12, background: 'rgba(255,255,255,0.02)' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                    <span style={{ fontSize: 8, fontWeight: 800, color: 'var(--text-muted)', fontFamily: 'Space Mono', letterSpacing: '0.05em' }}>{step}</span>
                    <span className="material-symbols-rounded" style={{ fontSize: 18, color, fontVariationSettings: "'FILL' 1" }}>{icon}</span>
                  </div>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'Space Grotesk', lineHeight: 1.6 }}>{text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Hidden file inputs */}
      <input type="file" accept="image/*" capture="environment" ref={cameraRef} onChange={handleFileChange} style={{ display: 'none' }} />
      <input type="file" accept="image/*,application/pdf" ref={galleryRef} onChange={handleFileChange} style={{ display: 'none' }} />

      {/* Document source selector */}
      <BottomSheet
        isOpen={isSheetOpen}
        onClose={() => setIsSheetOpen(false)}
        onSelectCamera={() => cameraRef.current?.click()}
        onSelectGallery={() => galleryRef.current?.click()}
      />

      {/* ── Similar Duplicate Modal ──────────────────────────────────────── */}
      {similarDuplicateData && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-6" style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(16px)' }}>
          <div className="anim-scale-in cs-card" style={{ maxWidth: 520, width: '100%', padding: 32 }}>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <div style={{ width: 52, height: 52, borderRadius: 16, background: 'rgba(245,158,11,0.1)', border: '1px solid var(--gold-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <span className="material-symbols-rounded" style={{ fontSize: 24, color: 'var(--gold)', fontVariationSettings: "'FILL' 1" }}>warning</span>
              </div>
              <h3 style={{ fontFamily: 'Sora', fontWeight: 800, fontSize: 18, color: 'var(--text-primary)', marginBottom: 8 }}>Possible Duplicate</h3>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'Space Grotesk', lineHeight: 1.6, maxWidth: 360, margin: '0 auto' }}>
                This invoice closely matches an existing record. Please verify before saving.
              </p>
            </div>

            <div className="gold-line" style={{ marginBottom: 20 }} />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
              {/* Existing bill */}
              <div style={{ padding: 16, borderRadius: 14, background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-subtle)' }}>
                <p className="text-label" style={{ marginBottom: 8 }}>Saved Bill</p>
                <p style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 12, color: 'var(--text-primary)', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{similarDuplicateData.existingBill.company}</p>
                <p style={{ fontFamily: 'Sora', fontWeight: 800, fontSize: 18, color: 'var(--text-primary)' }}>₹{similarDuplicateData.existingBill.totalAmount.toLocaleString('en-IN')}</p>
                <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4, fontFamily: 'Space Mono' }}>{similarDuplicateData.existingBill.date}</p>
              </div>
              {/* New bill */}
              <div style={{ padding: 16, borderRadius: 14, background: 'rgba(245,158,11,0.06)', border: '1px solid var(--gold-border)' }}>
                <p className="text-label" style={{ color: 'var(--gold)', marginBottom: 8 }}>New Scan</p>
                <p style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 12, color: 'var(--text-primary)', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{similarDuplicateData.newBill.company}</p>
                <p style={{ fontFamily: 'Sora', fontWeight: 800, fontSize: 18, color: 'var(--gold)' }}>₹{similarDuplicateData.newBill.totalAmount.toLocaleString('en-IN')}</p>
                <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4, fontFamily: 'Space Mono' }}>{similarDuplicateData.newBill.date}</p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button className="cs-btn-danger" style={{ flex: 1 }} onClick={() => setSimilarDuplicateData(null)}>
                <span className="material-symbols-rounded" style={{ fontSize: 16 }}>close</span>
                Cancel
              </button>
              <button className="cs-btn-primary" style={{ flex: 1 }} onClick={() => executeSave(similarDuplicateData.newBill)}>
                <span className="material-symbols-rounded" style={{ fontSize: 16, fontVariationSettings: "'FILL' 1" }}>save</span>
                Keep Both
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Home;
