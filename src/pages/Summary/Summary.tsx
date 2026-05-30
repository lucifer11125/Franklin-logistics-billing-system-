import React, { useState, useEffect } from 'react';
import { Bill } from '../../types';
import { db } from '../../database/db';
import AreaChart from '../../components/Charts/AreaChart';
import DonutChart from '../../components/Charts/DonutChart';

export const Summary: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [bills, setBills] = useState<Bill[]>([]);
  const [totalSales, setTotalSales] = useState(0);
  const [totalPurchases, setTotalPurchases] = useState(0);
  const [netProfit, setNetProfit] = useState(0);
  const [monthlyProfits, setMonthlyProfits] = useState<{ label: string; value: number }[]>([]);
  const [taxAllocation, setTaxAllocation] = useState<{ label: string; value: number; color: string }[]>([]);

  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  useEffect(() => { loadSummaryData(); }, [selectedDate]);

  const loadSummaryData = async () => {
    try {
      const allBills = await db.getAllBills();
      const curM = selectedDate.getMonth(), curY = selectedDate.getFullYear();
      const curBills = allBills.filter(b => {
        try { const d = new Date(b.processedAt); return d.getMonth() === curM && d.getFullYear() === curY; } catch { return false; }
      });
      setBills(curBills);

      let sales = 0, purchases = 0, cgst = 0, sgst = 0, igst = 0;
      curBills.forEach(b => {
        cgst += b.cgstAmount || 0; sgst += b.sgstAmount || 0; igst += b.igstAmount || 0;
        if (b.billType === 'SALES') sales += b.totalAmount - (b.cgstAmount + b.sgstAmount + b.igstAmount);
        else purchases += b.netAmount;
      });
      setTotalSales(sales); setTotalPurchases(purchases); setNetProfit(sales - purchases);
      setTaxAllocation([
        { label: 'IGST', value: igst, color: '#818cf8' },
        { label: 'SGST', value: sgst, color: '#38bdf8' },
        { label: 'CGST', value: cgst, color: 'var(--gold)' },
      ]);

      const past6: { label: string; value: number }[] = [];
      const temp = new Date(selectedDate);
      temp.setMonth(selectedDate.getMonth() - 5);
      for (let i = 0; i < 6; i++) {
        const m = temp.getMonth(), y = temp.getFullYear();
        let mp = 0;
        allBills.forEach(b => {
          try {
            const d = new Date(b.processedAt);
            if (d.getMonth() === m && d.getFullYear() === y) {
              if (b.billType === 'SALES') mp += b.totalAmount - (b.cgstAmount + b.sgstAmount + b.igstAmount);
              else mp -= b.netAmount;
            }
          } catch {}
        });
        past6.push({ label: `${MONTHS[m].substring(0, 3)} '${String(y).substring(2)}`, value: Math.max(mp, 0) });
        temp.setMonth(temp.getMonth() + 1);
      }
      setMonthlyProfits(past6);
    } catch (err) { console.error('Summary load failed:', err); }
  };

  const handlePrevMonth = () => setSelectedDate(prev => { const d = new Date(prev); d.setMonth(prev.getMonth() - 1); return d; });
  const handleNextMonth = () => setSelectedDate(prev => { const d = new Date(prev); d.setMonth(prev.getMonth() + 1); return d; });

  const formattedMonth = `${MONTHS[selectedDate.getMonth()]} ${selectedDate.getFullYear()}`;
  const profitPositive = netProfit >= 0;

  const statsCards = [
    { label: 'Total Sales Revenue', value: totalSales, icon: 'trending_up', color: '#34d399', accent: 'rgba(52,211,153,0.08)', border: 'rgba(52,211,153,0.15)' },
    { label: 'Total Purchase Expenses', value: totalPurchases, icon: 'trending_down', color: '#818cf8', accent: 'rgba(129,140,248,0.08)', border: 'rgba(129,140,248,0.15)' },
    { label: 'Net Balance', value: netProfit, icon: 'account_balance', color: profitPositive ? 'var(--gold)' : '#fb7185', accent: profitPositive ? 'rgba(245,158,11,0.07)' : 'rgba(244,63,94,0.08)', border: profitPositive ? 'var(--gold-border)' : 'rgba(244,63,94,0.2)' },
  ];

  return (
    <div className="anim-slide-up" style={{ display: 'flex', flexDirection: 'column', gap: 24, paddingBottom: 24 }}>

      {/* ── Header + Month Picker ─────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          <p className="text-label" style={{ color: 'var(--gold)' }}>Insights & Analytics</p>
          <h2 className="text-headline" style={{ fontSize: 20, marginTop: 2 }}>Performance Overview</h2>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 14px', background: 'var(--navy-1)', border: '1px solid var(--border-default)', borderRadius: 12 }}>
          <button onClick={handlePrevMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', padding: 2, transition: 'color 0.2s' }} onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-primary)')} onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}>
            <span className="material-symbols-rounded" style={{ fontSize: 18 }}>chevron_left</span>
          </button>
          <span className="text-headline" style={{ fontSize: 13, minWidth: 110, textAlign: 'center' }}>{formattedMonth}</span>
          <button onClick={handleNextMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', padding: 2, transition: 'color 0.2s' }} onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-primary)')} onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}>
            <span className="material-symbols-rounded" style={{ fontSize: 18 }}>chevron_right</span>
          </button>
        </div>
      </div>

      {/* ── Metric Cards ──────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        {statsCards.map((m, i) => (
          <div key={i} className="cs-card" style={{ padding: 22, background: m.accent, border: `1px solid ${m.border}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <p className="text-label">{m.label}</p>
              <div style={{ width: 32, height: 32, borderRadius: 9, background: `${m.accent}`, border: `1px solid ${m.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span className="material-symbols-rounded" style={{ fontSize: 16, color: m.color, fontVariationSettings: "'FILL' 1" }}>{m.icon}</span>
              </div>
            </div>
            <p style={{ fontFamily: 'Sora', fontWeight: 800, fontSize: 24, letterSpacing: '-0.03em', color: m.color }}>
              ₹{m.value.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </p>
          </div>
        ))}
      </div>

      {/* ── Area Chart ────────────────────────────────────────────────────── */}
      <div className="cs-card" style={{ padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(129,140,248,0.1)', border: '1px solid rgba(129,140,248,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span className="material-symbols-rounded" style={{ fontSize: 14, color: '#818cf8', fontVariationSettings: "'FILL' 1" }}>show_chart</span>
          </div>
          <div>
            <p className="text-label" style={{ color: '#818cf8' }}>6-Month View</p>
            <p className="text-headline" style={{ fontSize: 13 }}>Revenue Trend</p>
          </div>
        </div>
        <div className="gold-line" style={{ marginBottom: 20 }} />
        <AreaChart data={monthlyProfits} />
      </div>

      {/* ── Bottom bento: Tax donut + Ratio bars ─────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Donut chart */}
        <div className="cs-card" style={{ padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(245,158,11,0.1)', border: '1px solid var(--gold-border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span className="material-symbols-rounded" style={{ fontSize: 14, color: 'var(--gold)', fontVariationSettings: "'FILL' 1" }}>donut_small</span>
            </div>
            <p className="text-headline" style={{ fontSize: 13 }}>Tax Allocation</p>
          </div>
          <div className="gold-line" style={{ marginBottom: 20 }} />
          <DonutChart data={taxAllocation} />
        </div>

        {/* Ratio bars */}
        <div className="cs-card" style={{ padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span className="material-symbols-rounded" style={{ fontSize: 14, color: '#34d399', fontVariationSettings: "'FILL' 1" }}>balance</span>
            </div>
            <p className="text-headline" style={{ fontSize: 13 }}>Volume Ratio</p>
          </div>
          <div className="gold-line" style={{ marginBottom: 20 }} />

          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {[
              { label: 'Sales Income', value: totalSales, total: totalSales + totalPurchases, color: '#818cf8' },
              { label: 'Purchase Expenses', value: totalPurchases, total: totalSales + totalPurchases, color: '#34d399' },
            ].map(({ label, value, total, color }) => {
              const pct = total > 0 ? (value / total) * 100 : 0;
              return (
                <div key={label}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                    <p className="text-label">{label}</p>
                    <p style={{ fontFamily: 'Sora', fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>
                      ₹{value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                    </p>
                  </div>
                  <div style={{ height: 6, background: 'rgba(255,255,255,0.05)', borderRadius: 999, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 999, transition: 'width 1s cubic-bezier(0.16, 1, 0.3, 1)', boxShadow: `0 0 8px ${color}40` }} />
                  </div>
                  <p style={{ fontFamily: 'Space Mono', fontSize: 9, color: 'var(--text-muted)', marginTop: 4, textAlign: 'right' }}>{pct.toFixed(1)}%</p>
                </div>
              );
            })}

            {/* System metrics */}
            <div style={{ paddingTop: 8, borderTop: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { label: 'AI Extraction Accuracy', value: '99.4%', icon: 'psychology', color: 'var(--gold)' },
                { label: 'Avg Processing Speed', value: '1.2s', icon: 'speed', color: '#38bdf8' },
                { label: 'Bills This Month', value: bills.length, icon: 'receipt_long', color: '#818cf8' },
              ].map(({ label, value, icon, color }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="material-symbols-rounded" style={{ fontSize: 14, color, fontVariationSettings: "'FILL' 1" }}>{icon}</span>
                    <p className="text-label">{label}</p>
                  </div>
                  <p style={{ fontFamily: 'Space Mono', fontSize: 11, fontWeight: 700, color: 'var(--text-primary)' }}>{value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Top Suppliers Leaderboard ─────────────────────────────────────── */}
      <div className="cs-card" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(245,158,11,0.1)', border: '1px solid var(--gold-border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span className="material-symbols-rounded" style={{ fontSize: 14, color: 'var(--gold)', fontVariationSettings: "'FILL' 1" }}>leaderboard</span>
          </div>
          <p className="text-headline" style={{ fontSize: 13 }}>Top Partner Volume</p>
        </div>
        {bills.length === 0 ? (
          <div style={{ padding: '40px 24px', textAlign: 'center' }}>
            <p className="text-label">No transaction records this month.</p>
          </div>
        ) : (
          Object.entries(
            bills.reduce((acc: { [k: string]: { value: number; type: string } }, b) => {
              const name = b.company || 'Unknown';
              if (!acc[name]) acc[name] = { value: 0, type: b.billType };
              acc[name].value += b.totalAmount;
              return acc;
            }, {})
          )
            .sort((a, b) => b[1].value - a[1].value)
            .slice(0, 6)
            .map(([name, data], idx) => (
              <div key={idx} className="ledger-row" style={{ padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: idx === 0 ? 'rgba(245,158,11,0.12)' : 'rgba(255,255,255,0.03)', border: `1px solid ${idx === 0 ? 'var(--gold-border)' : 'var(--border-subtle)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ fontFamily: 'Space Mono', fontSize: 10, fontWeight: 700, color: idx === 0 ? 'var(--gold)' : 'var(--text-muted)' }}>{idx + 1}</span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 12, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.03em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</p>
                  <p className="text-label" style={{ marginTop: 2 }}>{data.type === 'SALES' ? 'Sales' : 'Purchase'}</p>
                </div>
                <p style={{ fontFamily: 'Sora', fontWeight: 800, fontSize: 14, color: idx === 0 ? 'var(--gold)' : 'var(--text-primary)' }}>
                  ₹{data.value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                </p>
              </div>
            ))
        )}
      </div>
    </div>
  );
};

export default Summary;
