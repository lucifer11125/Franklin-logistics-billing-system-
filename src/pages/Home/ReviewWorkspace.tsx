import React, { useState, useEffect } from 'react';
import { Bill } from '../../types';

interface ReviewWorkspaceProps {
  file: File;
  extractedData: Omit<Bill, 'id' | 'syncedToSheets'>;
  onSave: (finalData: Omit<Bill, 'id' | 'syncedToSheets'>) => void;
  onDiscard: () => void;
  isSaving: boolean;
}

export const ReviewWorkspace: React.FC<ReviewWorkspaceProps> = ({ file, extractedData, onSave, onDiscard, isSaving }) => {
  const [formData, setFormData] = useState<Omit<Bill, 'id' | 'syncedToSheets'>>({ ...extractedData });
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const isPdf = file.type === 'application/pdf';

  useEffect(() => {
    if (!isPdf) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [file, isPdf]);

  const calculatedSum = formData.netAmount + formData.cgstAmount + formData.sgstAmount + formData.igstAmount + formData.jwrAmount;
  const isMathValid = Math.abs(calculatedSum - formData.totalAmount) < 1;

  const handleChange = (key: keyof Omit<Bill, 'id' | 'syncedToSheets'>, val: any) => {
    setFormData(prev => {
      const next = { ...prev, [key]: val } as any;
      if (['netAmount','cgstAmount','sgstAmount','igstAmount','jwrAmount'].includes(key as string)) {
        const sum = (parseFloat(next.netAmount)||0) + (parseFloat(next.cgstAmount)||0) + (parseFloat(next.sgstAmount)||0) + (parseFloat(next.igstAmount)||0) + (parseFloat(next.jwrAmount)||0);
        next.totalAmount = parseFloat(sum.toFixed(2));
      }
      return next;
    });
  };

  const FieldInput = ({ label, fieldKey, type = 'text', placeholder = '', className = '' }: { label: string; fieldKey: keyof Omit<Bill, 'id' | 'syncedToSheets'>; type?: string; placeholder?: string; className?: string }) => (
    <div>
      <label className="field-label">{label}</label>
      <input
        type={type}
        step={type === 'number' ? '0.01' : undefined}
        className="cs-input"
        style={className ? { textAlign: 'right' } : {}}
        value={(formData as any)[fieldKey] || ''}
        placeholder={placeholder}
        onChange={e => handleChange(fieldKey, type === 'number' ? (parseFloat(e.target.value) || 0) : e.target.value)}
      />
    </div>
  );

  return (
    <div className="anim-slide-up" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <p className="text-label" style={{ color: 'var(--gold)' }}>AI Audit Inspection</p>
          <h2 className="text-headline" style={{ fontSize: 18, color: 'var(--text-primary)', marginTop: 2 }}>Review Extracted Data</h2>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div className={isMathValid ? 'cs-badge cs-badge-green' : 'cs-badge cs-badge-gold'} style={{ gap: 6 }}>
            <span className="material-symbols-rounded" style={{ fontSize: 12, fontVariationSettings: "'FILL' 1" }}>{isMathValid ? 'check_circle' : 'warning'}</span>
            {isMathValid ? 'Balanced' : 'Discrepancy'}
          </div>
        </div>
      </div>

      {/* Two-column layout */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }} className="lg:flex-row">
        <div style={{ display: 'grid', gridTemplateColumns: '5fr 7fr', gap: 20 }}>

          {/* ── Left: Document Preview ─────────────────────────────────── */}
          <div className="cs-card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <p className="text-label">Document Preview</p>
              <p style={{ fontFamily: 'Space Grotesk', fontWeight: 600, fontSize: 12, color: 'var(--text-primary)', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={file.name}>
                {file.name}
              </p>
            </div>
            <div className="gold-line" />

            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 320, background: 'rgba(255,255,255,0.01)', borderRadius: 14, border: '1px solid var(--border-subtle)', overflow: 'hidden' }}>
              {isPdf ? (
                <div style={{ textAlign: 'center', padding: 32 }}>
                  <div style={{ width: 64, height: 64, borderRadius: 18, background: 'rgba(129,140,248,0.1)', border: '1px solid rgba(129,140,248,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                    <span className="material-symbols-rounded" style={{ fontSize: 28, color: '#818cf8', fontVariationSettings: "'FILL' 1" }}>picture_as_pdf</span>
                  </div>
                  <p style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 12, color: 'var(--text-primary)', wordBreak: 'break-all' }}>{file.name}</p>
                  <p style={{ fontFamily: 'Space Mono', fontSize: 10, color: 'var(--text-muted)', marginTop: 6 }}>
                    {(file.size / 1024 / 1024).toFixed(2)} MB · PDF Document
                  </p>
                </div>
              ) : (
                previewUrl && (
                  <img
                    src={previewUrl}
                    alt="Invoice preview"
                    style={{ width: '100%', height: 'auto', maxHeight: 440, objectFit: 'contain', borderRadius: 12 }}
                  />
                )
              )}
            </div>
          </div>

          {/* ── Right: Verification Form ───────────────────────────────── */}
          <div className="cs-card" style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Company name (read-only display) */}
            <div style={{ padding: 16, borderRadius: 14, background: 'rgba(245,158,11,0.05)', border: '1px solid var(--gold-border)', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(245,158,11,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span className="material-symbols-rounded" style={{ fontSize: 18, color: 'var(--gold)', fontVariationSettings: "'FILL' 1" }}>corporate_fare</span>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p className="text-label" style={{ marginBottom: 2 }}>Trading Partner</p>
                <p style={{ fontFamily: 'Sora', fontWeight: 700, fontSize: 15, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {formData.company || '—'}
                </p>
              </div>
            </div>

            {/* GSTIN & Date */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <label className="field-label">GSTIN (Tax ID)</label>
                <input
                  type="text"
                  className="cs-input"
                  style={{ fontFamily: 'Space Mono', fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase' }}
                  value={formData.gstin}
                  placeholder="GSTIN number"
                  onChange={e => handleChange('gstin', e.target.value.toUpperCase())}
                />
              </div>
              <div>
                <label className="field-label">Bill Date</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    className="cs-input"
                    value={formData.date}
                    placeholder="DD.MM.YYYY"
                    onChange={e => handleChange('date', e.target.value)}
                  />
                  <span className="material-symbols-rounded" style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 16, color: 'var(--text-muted)', pointerEvents: 'none' }}>calendar_today</span>
                </div>
              </div>
            </div>

            {/* Bill type */}
            <div>
              <label className="field-label">Billing Category</label>
              <div style={{ position: 'relative' }}>
                <select
                  className="cs-input"
                  style={{ appearance: 'none', cursor: 'pointer' }}
                  value={formData.billType}
                  onChange={e => handleChange('billType', e.target.value)}
                >
                  <option style={{ background: 'var(--navy-2)' }} value="SALES">Sales — Outgoing Credit</option>
                  <option style={{ background: 'var(--navy-2)' }} value="PURCHASE">Purchase — Incoming Debit</option>
                </select>
                <span className="material-symbols-rounded" style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 18, color: 'var(--text-muted)', pointerEvents: 'none' }}>expand_more</span>
              </div>
            </div>

            {/* Amount fields */}
            <div style={{ paddingTop: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <div className="gold-line" style={{ flex: 1 }} />
                <p className="text-label">Amounts (₹)</p>
                <div className="gold-line" style={{ flex: 1 }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
                <FieldInput label="Base Net (₹)" fieldKey="netAmount" type="number" className="right" />
                <FieldInput label="CGST (₹)" fieldKey="cgstAmount" type="number" className="right" />
                <FieldInput label="SGST (₹)" fieldKey="sgstAmount" type="number" className="right" />
                <FieldInput label="IGST (₹)" fieldKey="igstAmount" type="number" className="right" />
                <FieldInput label="Freight (₹)" fieldKey="jwrAmount" type="number" className="right" />

                {/* Grand total - highlighted */}
                <div>
                  <label className="field-label" style={{ color: 'var(--gold)' }}>Grand Total (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="cs-input"
                    style={{ textAlign: 'right', borderColor: 'var(--gold-border)', background: 'rgba(245,158,11,0.05)', color: 'var(--gold)', fontWeight: 700, fontFamily: 'Sora' }}
                    value={formData.totalAmount || ''}
                    onChange={e => handleChange('totalAmount', parseFloat(e.target.value) || 0)}
                  />
                </div>
              </div>
            </div>

            {/* Math check banner */}
            <div style={{
              padding: '12px 16px', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 10,
              background: isMathValid ? 'rgba(16,185,129,0.06)' : 'rgba(245,158,11,0.06)',
              border: `1px solid ${isMathValid ? 'rgba(16,185,129,0.15)' : 'var(--gold-border)'}`,
            }}>
              <span className="material-symbols-rounded" style={{ fontSize: 16, color: isMathValid ? '#34d399' : 'var(--gold)', fontVariationSettings: "'FILL' 1" }}>
                {isMathValid ? 'verified' : 'warning'}
              </span>
              <span style={{ fontSize: 11, fontWeight: 600, color: isMathValid ? '#34d399' : 'var(--gold)', fontFamily: 'Space Grotesk' }}>
                {isMathValid
                  ? 'All calculations balanced — Ready to save and sync ✓'
                  : 'Tax sum discrepancy detected. Double-check figures.'}
              </span>
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: 12 }}>
              <button className="cs-btn-danger" onClick={onDiscard} disabled={isSaving} style={{ flex: '0 0 auto', padding: '12px 20px' }}>
                <span className="material-symbols-rounded" style={{ fontSize: 16 }}>close</span>
                Discard
              </button>
              <button className="cs-btn-primary" onClick={() => onSave(formData)} disabled={isSaving} style={{ flex: 1 }}>
                <span className="material-symbols-rounded" style={{ fontSize: 16, fontVariationSettings: "'FILL' 1", animation: isSaving ? 'spin 1s linear infinite' : undefined }}>
                  {isSaving ? 'sync' : 'cloud_done'}
                </span>
                {isSaving ? 'Saving...' : 'Save & Sync to Sheet'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReviewWorkspace;
