import React, { useState, useRef, useEffect } from 'react';
import { AppSettings, Bill } from '../../types';
import { db } from '../../database/db';
import { testGeminiConnection } from '../../services/gemini';
import { testSheetsConnection, repairAndRebuildSheet } from '../../services/sheets';

interface SettingsProps {
  settings: AppSettings;
  saveSettings: (newSettings: Partial<AppSettings>) => void;
  showToast: (text: string, type: 'success' | 'error' | 'info') => void;
}

export const Settings: React.FC<SettingsProps> = ({ settings, saveSettings, showToast }) => {
  const [geminiKey, setGeminiKey] = useState(settings.geminiApiKey);
  const [sheetsId, setSheetsId] = useState(settings.sheetsId);
  const [sheetsKey, setSheetsKey] = useState(settings.sheetsApiKey);
  const [saJson, setSaJson] = useState(settings.serviceAccountJson);
  const [isOcrTesting, setIsOcrTesting] = useState(false);
  const [isSheetsTesting, setIsSheetsTesting] = useState(false);
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [showSheetsKey, setShowSheetsKey] = useState(false);
  const saFileInputRef = useRef<HTMLInputElement>(null);

  // Repair state
  const [showRepairModal, setShowRepairModal] = useState(false);
  const [repairMonth, setRepairMonth] = useState('');
  const [isRepairing, setIsRepairing] = useState(false);
  const [repairLog, setRepairLog] = useState<string[]>([]);

  // Build list of available month options (current + previous 11 months)
  const monthOptions = (() => {
    const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const opts: string[] = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      opts.push(`${MONTHS[d.getMonth()]} ${d.getFullYear()}`);
    }
    return opts;
  })();

  useEffect(() => {
    setGeminiKey(settings.geminiApiKey);
    setSheetsId(settings.sheetsId);
    setSheetsKey(settings.sheetsApiKey);
    setSaJson(settings.serviceAccountJson);
  }, [settings]);

  let clientEmail = '';
  if (saJson) { try { clientEmail = JSON.parse(saJson).client_email || ''; } catch {} }

  const handleFieldBlur = (field: keyof AppSettings, value: string) => {
    const v = value.trim();
    if (field === 'serviceAccountJson' && v) { try { JSON.parse(v); } catch { return; } }
    saveSettings({ [field]: v });
  };

  const handleSave = () => {
    if (saJson.trim()) { try { JSON.parse(saJson); } catch { showToast('Invalid Service Account JSON.', 'error'); return; } }
    saveSettings({ geminiApiKey: geminiKey.trim(), sheetsId: sheetsId.trim(), sheetsApiKey: sheetsKey.trim(), serviceAccountJson: saJson.trim() });
    showToast('Settings saved ✓', 'success');
  };

  const handleTestOcr = async () => {
    if (isOcrTesting || !geminiKey.trim()) { showToast('Gemini API Key is empty.', 'error'); return; }
    setIsOcrTesting(true);
    showToast('Testing Gemini AI connection...', 'info');
    const ok = await testGeminiConnection(geminiKey.trim());
    showToast(ok ? 'Gemini Connected ✓' : 'Gemini Connection Failed ✗', ok ? 'success' : 'error');
    setIsOcrTesting(false);
  };

  const handleTestSheets = async () => {
    if (isSheetsTesting || !sheetsId.trim()) { showToast('Spreadsheet ID is empty.', 'error'); return; }
    setIsSheetsTesting(true);
    showToast('Testing Google Sheets connection...', 'info');
    const ok = await testSheetsConnection(sheetsId.trim(), saJson.trim(), sheetsKey.trim() || geminiKey.trim());
    showToast(ok ? 'Google Sheets Connected ✓' : 'Sheets Connection Failed ✗', ok ? 'success' : 'error');
    setIsSheetsTesting(false);
  };

  const handleWipeData = async () => {
    if (!window.confirm('Wipe ALL local billing records? This cannot be undone.')) return;
    try { await db.wipeAllBills(); showToast('Database wiped.', 'success'); setTimeout(() => location.reload(), 800); }
    catch { showToast('Wipe failed.', 'error'); }
  };

  const handleRepairSheet = async () => {
    if (!repairMonth) { showToast('Select a month to repair.', 'error'); return; }
    if (!settings.sheetsId) { showToast('Google Sheets ID is not configured.', 'error'); return; }
    setIsRepairing(true);
    setRepairLog([`Starting repair for "${repairMonth}"…`]);
    try {
      const allBills = await db.getAllBills();
      const count = await repairAndRebuildSheet(
        repairMonth,
        allBills,
        settings.sheetsId,
        settings.serviceAccountJson,
        settings.sheetsApiKey || settings.geminiApiKey,
        (msg) => setRepairLog(prev => [...prev, msg])
      );
      // Mark all repaired bills as synced in local DB
      for (const b of allBills) {
        if (!b.syncedToSheets) {
          const parts = (b.date || '').split('.');
          const MONTHS_ARR = ['January','February','March','April','May','June','July','August','September','October','November','December'];
          const bMonthYear = parts.length === 3
            ? `${MONTHS_ARR[parseInt(parts[1]) - 1]} ${parts[2]}`
            : '';
          if (bMonthYear === repairMonth) await db.markBillSynced(b.id!);
        }
      }
      showToast(`Sheet repaired! ${count} bill(s) restored.`, 'success');
    } catch (err: any) {
      setRepairLog(prev => [...prev, `❌ Error: ${err.message}`]);
      showToast('Repair failed: ' + err.message, 'error');
    } finally {
      setIsRepairing(false);
    }
  };

  const handleLoadDemo = async () => {
    if (!window.confirm('Load realistic demo invoices for testing?')) return;
    const today = new Date();
    const ds = (o: number) => { const d = new Date(today); d.setDate(today.getDate()-o); return `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${d.getFullYear()}`; };
    const demos: Omit<Bill, 'id' | 'syncedToSheets'>[] = [
      { company: 'Sarveshwar Logistics', gstin: '27AAOCS1721K1Z3', date: ds(1), billType: 'PURCHASE', netAmount: 24500, cgstAmount: 2205, sgstAmount: 2205, igstAmount: 0, jwrAmount: 1800, totalAmount: 30710, processedAt: new Date(today.getTime()-86400000).toISOString() },
      { company: 'Pulsotronic India', gstin: '27ABDFP3805G1ZD', date: ds(3), billType: 'SALES', netAmount: 58000, cgstAmount: 5220, sgstAmount: 5220, igstAmount: 0, jwrAmount: 0, totalAmount: 68440, processedAt: new Date(today.getTime()-259200000).toISOString() },
      { company: 'Godi Seal Kamgar', gstin: '27AAAAG0098F1ZW', date: ds(5), billType: 'PURCHASE', netAmount: 8500, cgstAmount: 0, sgstAmount: 0, igstAmount: 1530, jwrAmount: 950, totalAmount: 10980, processedAt: new Date(today.getTime()-432000000).toISOString() },
      { company: 'Aakash Logistics', gstin: '27AATFA2231Q1ZZ', date: ds(7), billType: 'SALES', netAmount: 42000, cgstAmount: 3780, sgstAmount: 3780, igstAmount: 0, jwrAmount: 2500, totalAmount: 52060, processedAt: new Date(today.getTime()-604800000).toISOString() },
    ];
    try { for (const b of demos) await db.saveBill({ ...b, syncedToSheets: false }); showToast('Demo data loaded ✓', 'success'); }
    catch { showToast('Demo load failed.', 'error'); }
  };

  const handleForceReload = async () => {
    showToast('Clearing PWA cache...', 'info');
    try {
      if ('serviceWorker' in navigator) { const regs = await navigator.serviceWorker.getRegistrations(); for (const r of regs) await r.unregister(); }
      if ('caches' in window) { const keys = await caches.keys(); for (const k of keys) await caches.delete(k); }
      showToast('Cache cleared. Reloading...', 'success');
      setTimeout(() => window.location.reload(), 1000);
    } catch { showToast('Cache clear failed.', 'error'); }
  };

  const PasswordField = ({ label, value, onChange, onBlur, placeholder, show, onToggle }: any) => (
    <div>
      <label className="field-label">{label}</label>
      <div style={{ position: 'relative' }}>
        <input
          type={show ? 'text' : 'password'}
          className="cs-input"
          value={value}
          onChange={e => onChange(e.target.value)}
          onBlur={onBlur}
          placeholder={placeholder}
        />
        <button onClick={onToggle} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}>
          <span className="material-symbols-rounded" style={{ fontSize: 17 }}>{show ? 'visibility_off' : 'visibility'}</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="anim-slide-up" style={{ display: 'flex', flexDirection: 'column', gap: 24, paddingBottom: 24 }}>

      {/* ── Page header ───────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          <p className="text-label" style={{ color: 'var(--gold)' }}>App Configuration</p>
          <h2 className="text-headline" style={{ fontSize: 20, marginTop: 2 }}>Settings & API Vault</h2>
        </div>
        <div className="cs-badge cs-badge-green">
          <span className="material-symbols-rounded" style={{ fontSize: 10, fontVariationSettings: "'FILL' 1" }}>lock</span>
          Secure
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 20 }}>

        {/* ── Left: Profile card ────────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="cs-card" style={{ padding: 28, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
            {/* Avatar */}
            <div style={{ position: 'relative' }}>
              <div style={{ width: 80, height: 80, borderRadius: 22, background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 50%, #818cf8 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 32px rgba(245,158,11,0.25)' }}>
                <span className="material-symbols-rounded" style={{ fontSize: 36, color: '#fff', fontVariationSettings: "'FILL' 1" }}>person</span>
              </div>
              <div style={{ position: 'absolute', bottom: -4, right: -4, width: 22, height: 22, borderRadius: 7, background: '#0d0e24', border: '2px solid #0d0e24', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div className="status-dot status-dot-green" style={{ width: 10, height: 10 }} />
              </div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <p className="text-headline" style={{ fontSize: 15 }}>Logistics Admin</p>
              <p className="text-label" style={{ marginTop: 4 }}>Billing Controller</p>
            </div>
            <div className="gold-line" style={{ width: '100%' }} />
            <div style={{ width: '100%' }}>
              <label className="field-label">User Role</label>
              <div style={{ position: 'relative' }}>
                <select className="cs-input" style={{ appearance: 'none', cursor: 'pointer', paddingRight: 36 }}>
                  <option style={{ background: 'var(--navy-2)' }}>Global Administrator</option>
                  <option style={{ background: 'var(--navy-2)' }}>Financial Analyst</option>
                  <option style={{ background: 'var(--navy-2)' }}>Logistics Officer</option>
                </select>
                <span className="material-symbols-rounded" style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 16, color: 'var(--text-muted)', pointerEvents: 'none' }}>expand_more</span>
              </div>
            </div>
          </div>

          {/* Active connections */}
          <div className="cs-card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p className="text-headline" style={{ fontSize: 13 }}>Active Integrations</p>
            <div className="gold-line" />
            {[
              { label: 'Google Sheets', sub: 'Cloud Ledger', icon: 'grid_on', color: '#34d399', test: handleTestSheets, testing: isSheetsTesting },
              { label: 'Gemini 2.5 Flash', sub: 'AI Engine', icon: 'psychology', color: 'var(--gold)', test: handleTestOcr, testing: isOcrTesting },
            ].map(({ label, sub, icon, color, test, testing }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 12, background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ width: 32, height: 32, borderRadius: 9, background: `rgba(${color === 'var(--gold)' ? '245,158,11' : '52,211,153'},0.1)`, border: `1px solid rgba(${color === 'var(--gold)' ? '245,158,11' : '52,211,153'},0.2)`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span className="material-symbols-rounded" style={{ fontSize: 15, color, fontVariationSettings: "'FILL' 1" }}>{icon}</span>
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 12, color: 'var(--text-primary)' }}>{label}</p>
                  <p className="text-label" style={{ marginTop: 1, color }}>{sub}</p>
                </div>
                <button onClick={test} disabled={testing} style={{ background: 'none', border: 'none', cursor: testing ? 'wait' : 'pointer', color: 'var(--text-muted)', transition: 'color 0.2s', display: 'flex' }} onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-primary)')} onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}>
                  <span className="material-symbols-rounded" style={{ fontSize: 17, animation: testing ? 'pulse-amber 0.8s infinite' : undefined }}>
                    {testing ? 'hourglass_top' : 'cable'}
                  </span>
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* ── Right: Credentials + Preferences ─────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* API Keys */}
          <div className="cs-card" style={{ padding: 28 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(245,158,11,0.1)', border: '1px solid var(--gold-border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span className="material-symbols-rounded" style={{ fontSize: 14, color: 'var(--gold)', fontVariationSettings: "'FILL' 1" }}>key</span>
              </div>
              <p className="text-headline" style={{ fontSize: 13 }}>API Credentials</p>
            </div>
            <div className="gold-line" style={{ marginBottom: 20 }} />

            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <PasswordField
                label="Gemini API Key"
                value={geminiKey}
                onChange={setGeminiKey}
                onBlur={() => handleFieldBlur('geminiApiKey', geminiKey)}
                placeholder="AIzaSy..."
                show={showGeminiKey}
                onToggle={() => setShowGeminiKey(v => !v)}
              />

              {/* Info note */}
              <div style={{ padding: '12px 16px', borderRadius: 12, background: 'rgba(129,140,248,0.05)', border: '1px solid rgba(129,140,248,0.15)', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <span className="material-symbols-rounded" style={{ fontSize: 16, color: '#818cf8', flexShrink: 0, fontVariationSettings: "'FILL' 1" }}>info</span>
                <p style={{ fontFamily: 'Space Grotesk', fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                  Get a free API key from <a href="https://aistudio.google.com/" target="_blank" rel="noreferrer" style={{ color: 'var(--gold)', fontWeight: 700 }}>Google AI Studio</a> and paste it above.
                </p>
              </div>

              <div>
                <label className="field-label">Google Sheets ID</label>
                <input type="text" className="cs-input" placeholder="1e8mB_p3x..." value={sheetsId} onChange={e => setSheetsId(e.target.value)} onBlur={() => handleFieldBlur('sheetsId', sheetsId)} />
                <p style={{ fontFamily: 'Space Grotesk', fontSize: 9, color: 'var(--text-muted)', marginTop: 5, letterSpacing: '0.03em' }}>
                  docs.google.com/spreadsheets/d/<strong style={{ color: 'var(--text-secondary)' }}>[SPREADSHEET_ID]</strong>
                </p>
              </div>

              <PasswordField
                label="Sheets API Key (Optional)"
                value={sheetsKey}
                onChange={setSheetsKey}
                onBlur={() => handleFieldBlur('sheetsApiKey', sheetsKey)}
                placeholder="Defaults to Gemini key if empty"
                show={showSheetsKey}
                onToggle={() => setShowSheetsKey(v => !v)}
              />

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <label className="field-label">Service Account JSON</label>
                  <button className="cs-btn-ghost" style={{ padding: '6px 12px', fontSize: 10, gap: 6 }} onClick={() => saFileInputRef.current?.click()}>
                    <span className="material-symbols-rounded" style={{ fontSize: 14 }}>upload_file</span>
                    Upload JSON
                  </button>
                </div>
                <textarea
                  className="cs-input"
                  style={{ fontFamily: 'Space Mono', fontSize: 10, minHeight: 100, resize: 'vertical', lineHeight: 1.6 }}
                  placeholder='{ "type": "service_account", ... }'
                  value={saJson}
                  onChange={e => setSaJson(e.target.value)}
                  onBlur={() => handleFieldBlur('serviceAccountJson', saJson)}
                />
              </div>

              {clientEmail && (
                <div style={{ padding: '14px 16px', borderRadius: 12, background: 'rgba(52,211,153,0.06)', border: '1px solid rgba(52,211,153,0.15)', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <span className="material-symbols-rounded" style={{ fontSize: 16, color: '#34d399', flexShrink: 0, fontVariationSettings: "'FILL' 1" }}>share</span>
                  <div>
                    <p style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 11, color: '#34d399', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Share Sheet Access</p>
                    <p style={{ fontFamily: 'Space Grotesk', fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 8 }}>
                      Share your Google Sheet with this email as an <strong style={{ color: 'var(--text-primary)' }}>Editor</strong>:
                    </p>
                    <code style={{ display: 'block', padding: '6px 10px', borderRadius: 7, background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.05)', fontFamily: 'Space Mono', fontSize: 9, color: '#34d399', wordBreak: 'break-all' }}>{clientEmail}</code>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Preferences */}
          <div className="cs-card" style={{ padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span className="material-symbols-rounded" style={{ fontSize: 14, color: '#38bdf8', fontVariationSettings: "'FILL' 1" }}>tune</span>
              </div>
              <p className="text-headline" style={{ fontSize: 13 }}>Preferences</p>
            </div>
            <div className="gold-line" style={{ marginBottom: 20 }} />

            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {/* Auto-sync toggle */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <p style={{ fontFamily: 'Space Grotesk', fontWeight: 600, fontSize: 12, color: 'var(--text-primary)' }}>Auto-Sync to Google Sheets</p>
                  <p className="text-label" style={{ marginTop: 3 }}>Auto upload after each invoice scan</p>
                </div>
                <label className="cs-toggle" style={{ cursor: 'pointer' }}>
                  <input type="checkbox" checked={settings.autoSync} onChange={e => saveSettings({ autoSync: e.target.checked })} style={{ position: 'absolute', opacity: 0 }} />
                  <div style={{
                    width: 44, height: 24, borderRadius: 999, border: '1px solid', cursor: 'pointer', position: 'relative', transition: 'all 0.25s ease',
                    background: settings.autoSync ? 'rgba(245,158,11,0.2)' : 'rgba(255,255,255,0.06)',
                    borderColor: settings.autoSync ? 'var(--gold-border)' : 'var(--border-subtle)',
                    boxShadow: settings.autoSync ? '0 0 12px rgba(245,158,11,0.15)' : 'none',
                  }}>
                    <div style={{
                      position: 'absolute', top: 2, left: settings.autoSync ? 22 : 2, width: 18, height: 18, borderRadius: '50%', transition: 'all 0.25s cubic-bezier(0.16,1,0.3,1)',
                      background: settings.autoSync ? 'var(--gold)' : 'var(--text-muted)',
                      boxShadow: settings.autoSync ? '0 0 8px rgba(245,158,11,0.4)' : 'none',
                    }} />
                  </div>
                </label>
              </div>

              <div className="gold-line" />

              {/* Dark mode / Aura toggle */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <p style={{ fontFamily: 'Space Grotesk', fontWeight: 600, fontSize: 12, color: 'var(--text-primary)' }}>Cosmic Aura Glows</p>
                  <p className="text-label" style={{ marginTop: 3 }}>Background nebula & blur animations</p>
                </div>
                <label className="cs-toggle" style={{ cursor: 'pointer' }}>
                  <input type="checkbox" checked={settings.darkMode} onChange={e => saveSettings({ darkMode: e.target.checked })} style={{ position: 'absolute', opacity: 0 }} />
                  <div style={{
                    width: 44, height: 24, borderRadius: 999, border: '1px solid', cursor: 'pointer', position: 'relative', transition: 'all 0.25s ease',
                    background: settings.darkMode ? 'rgba(245,158,11,0.2)' : 'rgba(255,255,255,0.06)',
                    borderColor: settings.darkMode ? 'var(--gold-border)' : 'var(--border-subtle)',
                    boxShadow: settings.darkMode ? '0 0 12px rgba(245,158,11,0.15)' : 'none',
                  }}>
                    <div style={{
                      position: 'absolute', top: 2, left: settings.darkMode ? 22 : 2, width: 18, height: 18, borderRadius: '50%', transition: 'all 0.25s cubic-bezier(0.16,1,0.3,1)',
                      background: settings.darkMode ? 'var(--gold)' : 'var(--text-muted)',
                      boxShadow: settings.darkMode ? '0 0 8px rgba(245,158,11,0.4)' : 'none',
                    }} />
                  </div>
                </label>
              </div>

              <div className="gold-line" />

              {/* Sensitivity slider */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                  <p style={{ fontFamily: 'Space Grotesk', fontWeight: 600, fontSize: 12, color: 'var(--text-primary)' }}>Duplicate Detection</p>
                  <span style={{ fontFamily: 'Space Mono', fontSize: 11, color: 'var(--gold)', fontWeight: 700 }}>98%</span>
                </div>
                <input type="range" min="50" max="100" defaultValue="98" style={{ width: '100%', accentColor: 'var(--gold)' }} />
              </div>
            </div>
          </div>

          {/* System utilities */}
          <div className="cs-card" style={{ padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span className="material-symbols-rounded" style={{ fontSize: 14, color: '#fb7185', fontVariationSettings: "'FILL' 1" }}>database</span>
              </div>
              <p className="text-headline" style={{ fontSize: 13 }}>System Utilities</p>
            </div>
            <div className="gold-line" style={{ marginBottom: 20 }} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              <button className="cs-btn-ghost" style={{ flexDirection: 'column', gap: 6, padding: '16px 8px', fontSize: 10, letterSpacing: '0.04em' }} onClick={handleLoadDemo}>
                <span className="material-symbols-rounded" style={{ fontSize: 20, color: 'var(--gold)' }}>data_object</span>
                Load Demo Data
              </button>
              <button className="cs-btn-ghost" style={{ flexDirection: 'column', gap: 6, padding: '16px 8px', fontSize: 10, letterSpacing: '0.04em' }} onClick={handleForceReload}>
                <span className="material-symbols-rounded" style={{ fontSize: 20, color: '#38bdf8' }}>refresh</span>
                Clear Cache
              </button>
              <button className="cs-btn-danger" style={{ flexDirection: 'column', gap: 6, padding: '16px 8px', fontSize: 10, letterSpacing: '0.04em' }} onClick={handleWipeData}>
                <span className="material-symbols-rounded" style={{ fontSize: 20 }}>delete_forever</span>
                Wipe Database
              </button>
            </div>
          </div>

          {/* Sheet Repair */}
          <div className="cs-card" style={{ padding: 24, border: '1px solid rgba(245,158,11,0.2)', background: 'rgba(245,158,11,0.04)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(245,158,11,0.12)', border: '1px solid var(--gold-border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span className="material-symbols-rounded" style={{ fontSize: 14, color: 'var(--gold)', fontVariationSettings: "'FILL' 1" }}>build_circle</span>
              </div>
              <div>
                <p className="text-headline" style={{ fontSize: 13 }}>Repair Scrambled Sheet</p>
                <p className="text-label" style={{ marginTop: 2, fontSize: 10 }}>Rebuild a month tab from local data</p>
              </div>
            </div>
            <div className="gold-line" style={{ marginBottom: 16 }} />
            <p style={{ fontFamily: 'Space Grotesk', fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.7, marginBottom: 14 }}>
              If a sheet tab was scrambled by an upload, use this to <strong style={{ color: 'var(--text-primary)' }}>wipe and fully rebuild</strong> it from your locally-saved bills. All data saved in this app is safe.
            </p>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <select
                  className="cs-input"
                  style={{ appearance: 'none', cursor: 'pointer', paddingRight: 36, fontSize: 11 }}
                  value={repairMonth}
                  onChange={e => setRepairMonth(e.target.value)}
                >
                  <option value="" style={{ background: 'var(--navy-2)' }}>Select month to repair…</option>
                  {monthOptions.map(m => (
                    <option key={m} value={m} style={{ background: 'var(--navy-2)' }}>{m}</option>
                  ))}
                </select>
                <span className="material-symbols-rounded" style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 16, color: 'var(--text-muted)', pointerEvents: 'none' }}>expand_more</span>
              </div>
              <button
                className="cs-btn-primary"
                style={{ padding: '10px 18px', fontSize: 11, flexShrink: 0 }}
                onClick={() => { setRepairLog([]); setShowRepairModal(true); }}
                disabled={!repairMonth}
              >
                <span className="material-symbols-rounded" style={{ fontSize: 15, fontVariationSettings: "'FILL' 1" }}>build</span>
                Repair Sheet
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Save button ───────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 4 }}>
        <button className="cs-btn-primary" onClick={handleSave} style={{ padding: '13px 36px', fontSize: 12 }}>
          <span className="material-symbols-rounded" style={{ fontSize: 16, fontVariationSettings: "'FILL' 1" }}>save</span>
          Save Configuration
        </button>
      </div>

      {/* ── Repair Modal ───────────────────────────────────────────────────── */}
      {showRepairModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(16px)' }}>
          <div className="anim-scale-in cs-card" style={{ maxWidth: 560, width: '100%', padding: 32, display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 44, height: 44, borderRadius: 14, background: 'rgba(245,158,11,0.12)', border: '1px solid var(--gold-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span className="material-symbols-rounded" style={{ fontSize: 22, color: 'var(--gold)', fontVariationSettings: "'FILL' 1", animation: isRepairing ? 'pulse-amber 0.8s infinite' : undefined }}>build_circle</span>
              </div>
              <div>
                <p style={{ fontFamily: 'Sora', fontWeight: 800, fontSize: 16, color: 'var(--text-primary)' }}>Repair — {repairMonth}</p>
                <p className="text-label" style={{ marginTop: 3 }}>{isRepairing ? 'Rebuilding sheet from local database…' : repairLog.length === 0 ? 'Ready to start' : 'Repair finished'}</p>
              </div>
            </div>

            <div className="gold-line" />

            {/* Warning */}
            {!isRepairing && repairLog.length === 0 && (
              <div style={{ padding: '14px 16px', borderRadius: 12, background: 'rgba(244,63,94,0.07)', border: '1px solid rgba(244,63,94,0.2)', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <span className="material-symbols-rounded" style={{ fontSize: 16, color: '#fb7185', flexShrink: 0, fontVariationSettings: "'FILL' 1" }}>warning</span>
                <p style={{ fontFamily: 'Space Grotesk', fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.7 }}>
                  This will <strong style={{ color: '#fb7185' }}>wipe the entire "{repairMonth}" tab</strong> in Google Sheets and rebuild it from your local bill records. Your local data is never deleted.
                </p>
              </div>
            )}

            {/* Live log */}
            {repairLog.length > 0 && (
              <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: '14px 16px', maxHeight: 220, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {repairLog.map((line, i) => (
                  <p key={i} style={{ fontFamily: 'Space Mono', fontSize: 10, color: line.startsWith('✓') ? '#34d399' : line.startsWith('⚠') ? '#fbbf24' : line.startsWith('❌') ? '#fb7185' : 'var(--text-muted)', lineHeight: 1.6 }}>{line}</p>
                ))}
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                className="cs-btn-ghost"
                style={{ flex: 1 }}
                onClick={() => { if (!isRepairing) { setShowRepairModal(false); setRepairLog([]); } }}
                disabled={isRepairing}
              >
                <span className="material-symbols-rounded" style={{ fontSize: 16 }}>close</span>
                {repairLog.some(l => l.startsWith('✓')) ? 'Close' : 'Cancel'}
              </button>
              {(!isRepairing && !repairLog.some(l => l.startsWith('✓'))) && (
                <button
                  className="cs-btn-primary"
                  style={{ flex: 1 }}
                  onClick={handleRepairSheet}
                >
                  <span className="material-symbols-rounded" style={{ fontSize: 16, fontVariationSettings: "'FILL' 1" }}>build</span>
                  Start Repair
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <input type="file" accept=".json" ref={saFileInputRef} onChange={e => {
        const f = e.target.files?.[0]; if (!f) return;
        const r = new FileReader();
        r.onload = ev => {
          try {
            const parsed = JSON.parse(ev.target?.result as string);
            const pretty = JSON.stringify(parsed, null, 2);
            setSaJson(pretty); saveSettings({ serviceAccountJson: pretty });
            showToast('Service Account JSON loaded ✓', 'success');
          } catch (err: any) { showToast('JSON validation failed: ' + err.message, 'error'); }
        };
        r.readAsText(f);
        e.target.value = '';
      }} style={{ display: 'none' }} />
    </div>
  );
};

export default Settings;
