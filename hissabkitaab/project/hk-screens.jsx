
// HisaabKitaab — Screen Components

const MOCK = {
  user: { name: 'Raj Sharma', biz: 'Sharma Enterprises' },
  summary: { receivable: 187500, payable: 34200, collected: 62000, billCount: 23, billTotal: 456780, overdue: 3 },
  cashFlow: [
    { m: 'Nov', r: 45000, p: 22000 }, { m: 'Dec', r: 67000, p: 18000 },
    { m: 'Jan', r: 38000, p: 41000 }, { m: 'Feb', r: 89000, p: 25000 },
    { m: 'Mar', r: 54000, p: 30000 }, { m: 'Apr', r: 62000, p: 34000 },
  ],
  payments: [
    { id: 1, name: 'Ramesh Cloth Store', amount: 15000, dir: 'in', mode: 'UPI', date: 'Aaj' },
    { id: 2, name: 'Gupta Hardware', amount: 22000, dir: 'in', mode: 'NEFT', date: 'Kal' },
    { id: 3, name: 'Sunita Enterprises', amount: 8500, dir: 'out', mode: 'Cash', date: '27 Apr' },
    { id: 4, name: 'Patel Textiles', amount: 12000, dir: 'out', mode: 'UPI', date: '26 Apr' },
  ],
  bills: [
    { id: 'B-2504-023', customer: 'Ramesh Cloth Store', amount: 45000, status: 'FINAL', date: '28 Apr' },
    { id: 'B-2504-022', customer: 'Sunita Enterprises', amount: 12450, status: 'DRAFT', date: '27 Apr' },
    { id: 'B-2504-021', customer: 'Gupta Hardware', amount: 67800, status: 'FINAL', date: '25 Apr' },
    { id: 'B-2503-020', customer: 'Agarwal Traders', amount: 28900, status: 'CANCELLED', date: '30 Mar' },
    { id: 'B-2503-019', customer: 'Sharma Electronics', amount: 89000, status: 'FINAL', date: '28 Mar' },
    { id: 'B-2503-018', customer: 'Mehta Fabrics', amount: 34500, status: 'FINAL', date: '25 Mar' },
  ],
  parties: [
    { id: 1, name: 'Ramesh Cloth Store', init: 'RC', type: 'CUSTOMER', balance: 45000 },
    { id: 2, name: 'Sunita Enterprises', init: 'SE', type: 'CUSTOMER', balance: -8500 },
    { id: 3, name: 'Gupta Hardware', init: 'GH', type: 'SUPPLIER', balance: 34200 },
    { id: 4, name: 'Agarwal Traders', init: 'AT', type: 'CUSTOMER', balance: 22000 },
    { id: 5, name: 'Sharma Electronics', init: 'SH', type: 'CUSTOMER', balance: 89000 },
    { id: 6, name: 'Patel Textiles', init: 'PT', type: 'SUPPLIER', balance: -15000 },
  ]
};

function fmt(n) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Math.abs(n));
}

function KCard({ T, children, style = {}, onClick }) {
  const isGlass = T.themeName === 'daftar';
  return (
    <div onClick={onClick} style={{
      background: T.surface, borderRadius: T.rLg, border: `1px solid ${T.border}`,
      boxShadow: T.cardShadow, padding: '16px',
      ...(isGlass ? { backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' } : {}),
      ...(onClick ? { cursor: 'pointer' } : {}),
      ...style
    }}>{children}</div>
  );
}

function KChip({ T, color = 'default', children }) {
  const map = {
    success: { bg: T.successBg, fg: T.success },
    danger:  { bg: T.dangerBg,  fg: T.danger },
    warning: { bg: T.warningBg, fg: T.warning },
    default: { bg: T.surfaceAlt, fg: T.textMuted },
    accent:  { bg: T.accentLight, fg: T.accentLightFg },
  };
  const c = map[color] || map.default;
  return (
    <span style={{ display: 'inline-block', padding: '2px 9px', borderRadius: T.rFull, background: c.bg, color: c.fg, fontSize: 11, fontWeight: 700, letterSpacing: '0.3px', textTransform: 'uppercase' }}>
      {children}
    </span>
  );
}

function KInput({ T, label, placeholder, value, onChange, type = 'text' }) {
  return (
    <div style={{ marginBottom: 14 }}>
      {label && <label style={{ display: 'block', color: T.textMuted, fontSize: 12, fontWeight: 600, marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</label>}
      <input type={type} value={value} onChange={onChange} placeholder={placeholder}
        style={{ width: '100%', padding: '11px 14px', borderRadius: T.r, border: `1.5px solid ${T.border}`, background: T.surfaceAlt, color: T.text, fontSize: 15, outline: 'none', boxSizing: 'border-box', fontFamily: T.font, transition: 'border-color 0.15s' }}
        onFocus={e => e.target.style.borderColor = T.accent}
        onBlur={e => e.target.style.borderColor = T.border}
      />
    </div>
  );
}

function SectionTitle({ T, children, action, onAction }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
      <span style={{ fontSize: 13, fontWeight: 700, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.8px' }}>{children}</span>
      {action && <span onClick={onAction} style={{ fontSize: 12, color: T.accent, cursor: 'pointer', fontWeight: 600 }}>{action}</span>}
    </div>
  );
}

// ─── LOGIN SCREEN ────────────────────────────────────────────────────────────

function LoginScreen({ T, navigate }) {
  const [cred, setCred] = React.useState('');
  const [pass, setPass] = React.useState('');
  const isKhata = T.themeName === 'khata';

  const logoGrad = isKhata
    ? 'linear-gradient(135deg, #f59e0b, #e07a10)'
    : 'linear-gradient(135deg, #00d9a3, #0a9e78)';

  return (
    <div style={{ minHeight: '100%', background: T.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 24px', fontFamily: T.font, position: 'relative', overflow: 'hidden' }}>
      {/* Background blobs */}
      {isKhata ? (
        <>
          <div style={{ position: 'absolute', top: -80, right: -80, width: 220, height: 220, borderRadius: '50%', background: 'radial-gradient(circle, rgba(224,122,16,0.12) 0%, transparent 70%)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', bottom: -60, left: -60, width: 180, height: 180, borderRadius: '50%', background: 'radial-gradient(circle, rgba(224,122,16,0.08) 0%, transparent 70%)', pointerEvents: 'none' }} />
        </>
      ) : (
        <>
          <div style={{ position: 'absolute', top: -100, right: -100, width: 300, height: 300, borderRadius: '50%', background: 'radial-gradient(circle, rgba(0,217,163,0.08) 0%, transparent 70%)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', bottom: -80, left: -80, width: 250, height: 250, borderRadius: '50%', background: 'radial-gradient(circle, rgba(0,217,163,0.05) 0%, transparent 70%)', pointerEvents: 'none' }} />
        </>
      )}

      {/* Logo */}
      <div style={{ textAlign: 'center', marginBottom: 36, zIndex: 1 }}>
        <div style={{ width: 72, height: 72, borderRadius: T.rXl, background: logoGrad, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px', boxShadow: isKhata ? '0 12px 32px rgba(224,122,16,0.35)' : '0 12px 32px rgba(0,217,163,0.3)' }}>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
            <line x1="9" y1="8" x2="15" y2="8"/><line x1="9" y1="12" x2="13" y2="12"/>
          </svg>
        </div>
        <h1 style={{ fontSize: 30, fontWeight: 800, color: T.text, margin: 0, letterSpacing: '-0.8px' }}>HisaabKitaab</h1>
        <p style={{ color: T.textMuted, fontSize: 13, marginTop: 4, fontStyle: isKhata ? 'normal' : 'normal' }}>अपना हिसाब, अपनी किताब</p>
      </div>

      {/* Card */}
      <div style={{ width: '100%', maxWidth: 370, background: T.surface, borderRadius: T.rXl, padding: '28px 24px 24px', boxShadow: T.cardShadow, border: `1px solid ${T.border}`, zIndex: 1, ...(T.backdropBlur ? { backdropFilter: T.backdropBlur, WebkitBackdropFilter: T.backdropBlur } : {}) }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: T.text, marginBottom: 20 }}>लॉग इन करें</h2>

        <KInput T={T} label="Email / Phone" placeholder="raj@sharma.com" value={cred} onChange={e => setCred(e.target.value)} />
        <KInput T={T} label="Password" type="password" placeholder="••••••••" value={pass} onChange={e => setPass(e.target.value)} />

        <button onClick={() => navigate('dashboard')} style={{ width: '100%', padding: '13px', marginTop: 4, borderRadius: T.r, background: isKhata ? 'linear-gradient(135deg, #f59e0b, #e07a10)' : 'linear-gradient(135deg, #00d9a3, #0a9e78)', color: isKhata ? '#fff' : '#0c1021', fontSize: 15, fontWeight: 700, border: 'none', cursor: 'pointer', fontFamily: T.font, letterSpacing: '0.2px', boxShadow: isKhata ? '0 4px 16px rgba(224,122,16,0.35)' : '0 4px 16px rgba(0,217,163,0.3)' }}>
          Sign In →
        </button>

        <p style={{ textAlign: 'center', color: T.textMuted, fontSize: 12, marginTop: 16 }}>
          Password भूल गए? <span style={{ color: T.accent, cursor: 'pointer', fontWeight: 600 }}>Help लें</span>
        </p>
      </div>

      {/* Version note */}
      <p style={{ color: T.textLight, fontSize: 11, marginTop: 24, zIndex: 1 }}>MSME Digital Bookkeeping · v2.0</p>
    </div>
  );
}

// ─── DASHBOARD SCREEN ─────────────────────────────────────────────────────────

function CashFlowChart({ T, data }) {
  const maxVal = Math.max(...data.flatMap(d => [d.r, d.p]), 1);
  const isKhata = T.themeName === 'khata';
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 100, padding: '0 4px' }}>
      {data.map(d => (
        <div key={d.m} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
          <div style={{ width: '100%', display: 'flex', gap: 3, alignItems: 'flex-end', height: 80 }}>
            <div style={{ flex: 1, borderRadius: '4px 4px 0 0', height: `${(d.r / maxVal) * 80}px`, minHeight: d.r > 0 ? 4 : 0, background: isKhata ? 'linear-gradient(to top, #16a34a, #4ade80)' : 'linear-gradient(to top, #00d9a3, #34d39a)', transition: 'height 0.3s' }} />
            <div style={{ flex: 1, borderRadius: '4px 4px 0 0', height: `${(d.p / maxVal) * 80}px`, minHeight: d.p > 0 ? 4 : 0, background: isKhata ? 'linear-gradient(to top, #e07a10, #fbbf24)' : 'linear-gradient(to top, #ff7070, #fbbf24)', transition: 'height 0.3s' }} />
          </div>
          <span style={{ fontSize: 10, color: T.textLight, fontWeight: 600 }}>{d.m}</span>
        </div>
      ))}
    </div>
  );
}

function DashboardScreen({ T, navigate }) {
  const s = MOCK.summary;
  const isKhata = T.themeName === 'khata';

  const cards = [
    { label: 'Lena Baki', sublabel: 'To Receive', value: s.receivable, color: T.success, bg: T.successBg, icon: '↑' },
    { label: 'Dena Baki', sublabel: 'To Pay', value: s.payable, color: T.danger, bg: T.dangerBg, icon: '↓' },
    { label: 'Is Mahine', sublabel: 'Collected', value: s.collected, color: T.accent, bg: T.accentLight, icon: '₹' },
    { label: 'Kul Bills', sublabel: `${s.billCount} bills`, value: s.billTotal, color: T.warning, bg: T.warningBg, icon: '📋' },
  ];

  return (
    <div style={{ fontFamily: T.font, background: T.bg, minHeight: '100%', paddingBottom: 100 }}>
      {/* Header */}
      <div style={{ padding: '20px 16px 12px', background: isKhata ? T.surface : 'transparent', borderBottom: isKhata ? `1px solid ${T.border}` : 'none' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <p style={{ color: T.textMuted, fontSize: 13, margin: 0 }}>नमस्ते,</p>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: T.text, margin: '2px 0 0', letterSpacing: '-0.4px' }}>{MOCK.user.name} 🙏</h1>
            <p style={{ color: T.textMuted, fontSize: 12, margin: '2px 0 0' }}>{MOCK.user.biz} · Aaj, 29 Apr</p>
          </div>
          <div style={{ width: 40, height: 40, borderRadius: T.r, background: isKhata ? `linear-gradient(135deg, #f59e0b, #e07a10)` : `linear-gradient(135deg, #00d9a3, #0a9e78)`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={isKhata ? 'white' : '#0c1021'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          </div>
        </div>

        {/* Overdue alert */}
        {s.overdue > 0 && (
          <div style={{ marginTop: 12, padding: '8px 12px', borderRadius: T.r, background: T.dangerBg, border: `1px solid ${T.danger}30`, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 16 }}>⚠️</span>
            <span style={{ color: T.danger, fontSize: 13, fontWeight: 600 }}>{s.overdue} parties overdue — Baaki collect karein</span>
          </div>
        )}
      </div>

      <div style={{ padding: '16px' }}>
        {/* Summary Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
          {cards.map((c, i) => (
            <KCard key={i} T={T} style={{ padding: '14px' }} onClick={() => navigate(i < 2 ? 'parties' : i === 2 ? 'bills' : 'bills')}>
              <div style={{ width: 32, height: 32, borderRadius: T.rSm, background: c.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8, fontSize: 14 }}>
                <span style={{ color: c.color, fontWeight: 700 }}>{c.icon}</span>
              </div>
              <p style={{ color: T.textMuted, fontSize: 11, fontWeight: 600, margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{c.label}</p>
              <p style={{ color: c.color, fontSize: 18, fontWeight: 800, margin: '2px 0 0', letterSpacing: '-0.5px' }}>{fmt(c.value)}</p>
              <p style={{ color: T.textLight, fontSize: 10, margin: '1px 0 0' }}>{c.sublabel}</p>
            </KCard>
          ))}
        </div>

        {/* Cash Flow */}
        <KCard T={T} style={{ marginBottom: 12 }}>
          <SectionTitle T={T} action="Sab dekho →" onAction={() => navigate('bills')}>Cash Flow</SectionTitle>
          <div style={{ display: 'flex', gap: 12, marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: T.success }} />
              <span style={{ fontSize: 10, color: T.textMuted }}>Mila</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: isKhata ? '#e07a10' : '#ff7070' }} />
              <span style={{ fontSize: 10, color: T.textMuted }}>Diya</span>
            </div>
          </div>
          <CashFlowChart T={T} data={MOCK.cashFlow} />
        </KCard>

        {/* Recent Payments */}
        <KCard T={T}>
          <SectionTitle T={T} action="Sab →" onAction={() => {}}>Recent Payments</SectionTitle>
          {MOCK.payments.map((p, i) => (
            <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: i < MOCK.payments.length - 1 ? `1px solid ${T.border}` : 'none' }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <div style={{ width: 34, height: 34, borderRadius: T.r, background: p.dir === 'in' ? T.successBg : T.dangerBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>
                  <span style={{ color: p.dir === 'in' ? T.success : T.danger }}>{p.dir === 'in' ? '↓' : '↑'}</span>
                </div>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: T.text, margin: 0 }}>{p.name}</p>
                  <p style={{ fontSize: 11, color: T.textMuted, margin: '1px 0 0' }}>{p.date} · {p.mode}</p>
                </div>
              </div>
              <span style={{ fontSize: 14, fontWeight: 700, color: p.dir === 'in' ? T.success : T.danger, fontFamily: T.fontMono }}>
                {p.dir === 'in' ? '+' : '-'}{fmt(p.amount)}
              </span>
            </div>
          ))}
        </KCard>
      </div>
    </div>
  );
}

// ─── BILLS SCREEN ─────────────────────────────────────────────────────────────

function BillsScreen({ T, navigate }) {
  const [search, setSearch] = React.useState('');
  const [filter, setFilter] = React.useState('ALL');
  const isKhata = T.themeName === 'khata';

  const filtered = MOCK.bills.filter(b => {
    const matchSearch = b.customer.toLowerCase().includes(search.toLowerCase()) || b.id.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === 'ALL' || b.status === filter;
    return matchSearch && matchFilter;
  });

  const aprilBills = filtered.filter(b => b.date.includes('Apr'));
  const marchBills = filtered.filter(b => b.date.includes('Mar'));

  const statusColor = { FINAL: 'success', DRAFT: 'warning', CANCELLED: 'danger' };
  const statusLabel = { FINAL: 'Final', DRAFT: 'Draft', CANCELLED: 'Cancel' };

  const BillRow = ({ bill }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: `1px solid ${T.border}`, cursor: 'pointer' }}>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: T.textMuted, fontFamily: T.fontMono }}>{bill.id}</span>
          <KChip T={T} color={statusColor[bill.status]}>{statusLabel[bill.status]}</KChip>
        </div>
        <p style={{ fontSize: 14, fontWeight: 600, color: T.text, margin: '1px 0 0' }}>{bill.customer}</p>
        <p style={{ fontSize: 11, color: T.textLight, margin: '1px 0 0' }}>{bill.date}</p>
      </div>
      <div style={{ textAlign: 'right' }}>
        <p style={{ fontSize: 16, fontWeight: 800, color: T.text, margin: 0, fontFamily: T.fontMono }}>{fmt(bill.amount)}</p>
        <svg style={{ color: T.textLight, marginTop: 2 }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
      </div>
    </div>
  );

  const MonthGroup = ({ label, total, bills }) => bills.length === 0 ? null : (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderRadius: T.r, background: isKhata ? T.accentLight : T.surfaceAlt, marginBottom: 4 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: isKhata ? T.accentLightFg : T.textMuted }}>{label}</span>
        <span style={{ fontSize: 12, fontWeight: 600, color: isKhata ? T.accentLightFg : T.textMuted, fontFamily: T.fontMono }}>{fmt(total)} · {bills.length} bills</span>
      </div>
      <KCard T={T} style={{ padding: '0 12px' }}>
        {bills.map(b => <BillRow key={b.id} bill={b} />)}
      </KCard>
    </div>
  );

  return (
    <div style={{ fontFamily: T.font, background: T.bg, minHeight: '100%', paddingBottom: 100 }}>
      {/* Header */}
      <div style={{ padding: '18px 16px 12px', background: isKhata ? T.surface : 'transparent', borderBottom: `1px solid ${T.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: T.text, margin: 0 }}>Bills</h1>
          <p style={{ color: T.textMuted, fontSize: 12, margin: '2px 0 0' }}>Apne sab bills yahaan</p>
        </div>
        <button onClick={() => navigate('new-bill')} style={{ padding: '8px 16px', borderRadius: T.r, background: isKhata ? 'linear-gradient(135deg, #f59e0b, #e07a10)' : 'linear-gradient(135deg, #00d9a3, #0a9e78)', color: isKhata ? '#fff' : '#0c1021', fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontFamily: T.font, boxShadow: isKhata ? '0 4px 12px rgba(224,122,16,0.3)' : '0 4px 12px rgba(0,217,163,0.3)' }}>
          <span style={{ fontSize: 16, lineHeight: 1 }}>+</span> New Bill
        </button>
      </div>

      <div style={{ padding: '12px 16px' }}>
        {/* Search + Filter */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <svg style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: T.textLight }} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search bills..."
              style={{ width: '100%', padding: '9px 12px 9px 32px', borderRadius: T.r, border: `1.5px solid ${T.border}`, background: T.surface, color: T.text, fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: T.font }} />
          </div>
          <select value={filter} onChange={e => setFilter(e.target.value)}
            style={{ padding: '9px 10px', borderRadius: T.r, border: `1.5px solid ${T.border}`, background: T.surface, color: T.text, fontSize: 13, outline: 'none', fontFamily: T.font, cursor: 'pointer' }}>
            <option value="ALL">Sab</option>
            <option value="FINAL">Final</option>
            <option value="DRAFT">Draft</option>
            <option value="CANCELLED">Cancel</option>
          </select>
        </div>

        <MonthGroup label="April 2025" total={aprilBills.reduce((s, b) => s + b.amount, 0)} bills={aprilBills} />
        <MonthGroup label="March 2025" total={marchBills.reduce((s, b) => s + b.amount, 0)} bills={marchBills} />

        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '48px 0', color: T.textMuted }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
            <p style={{ fontWeight: 600 }}>Koi bill nahi mila</p>
            <p style={{ fontSize: 13 }}>Search change karein ya naya bill banayein</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── NEW BILL SCREEN ───────────────────────────────────────────────────────────

function NewBillScreen({ T, navigate }) {
  const [party, setParty] = React.useState('Ramesh Cloth Store');
  const [items, setItems] = React.useState([
    { desc: 'Cotton Fabric (50m)', qty: 50, rate: 180, total: 9000 },
    { desc: 'Silk Thread', qty: 10, rate: 450, total: 4500 },
  ]);
  const [tax, setTax] = React.useState(18);
  const isKhata = T.themeName === 'khata';
  const subtotal = items.reduce((s, i) => s + i.total, 0);
  const taxAmt = Math.round(subtotal * tax / 100);
  const grandTotal = subtotal + taxAmt;

  const addItem = () => setItems([...items, { desc: '', qty: 1, rate: 0, total: 0 }]);

  return (
    <div style={{ fontFamily: T.font, background: T.bg, minHeight: '100%', paddingBottom: 120 }}>
      {/* Header */}
      <div style={{ padding: '16px', background: isKhata ? T.surface : 'transparent', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => navigate('bills')} style={{ width: 36, height: 36, borderRadius: T.r, background: T.surfaceAlt, border: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={T.text} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
        </button>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: T.text, margin: 0 }}>Naya Bill</h1>
          <p style={{ color: T.textMuted, fontSize: 12, margin: '1px 0 0' }}>B-2504-024 · Draft</p>
        </div>
      </div>

      <div style={{ padding: '14px 16px' }}>
        {/* Party */}
        <KCard T={T} style={{ marginBottom: 12 }}>
          <SectionTitle T={T}>Customer / Party</SectionTitle>
          <select value={party} onChange={e => setParty(e.target.value)}
            style={{ width: '100%', padding: '11px 14px', borderRadius: T.r, border: `1.5px solid ${T.border}`, background: T.surfaceAlt, color: T.text, fontSize: 14, fontWeight: 600, outline: 'none', fontFamily: T.font, cursor: 'pointer' }}>
            {MOCK.parties.filter(p => p.type === 'CUSTOMER').map(p => (
              <option key={p.id}>{p.name}</option>
            ))}
          </select>
        </KCard>

        {/* Items */}
        <KCard T={T} style={{ marginBottom: 12 }}>
          <SectionTitle T={T} action="+ Item Add" onAction={addItem}>Saman / Items</SectionTitle>
          {/* Header row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 50px 70px 70px', gap: 6, marginBottom: 6 }}>
            {['Item', 'Qty', 'Rate', 'Total'].map(h => (
              <span key={h} style={{ fontSize: 10, fontWeight: 700, color: T.textLight, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</span>
            ))}
          </div>
          {items.map((item, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 50px 70px 70px', gap: 6, marginBottom: 6, alignItems: 'center' }}>
              <input value={item.desc} onChange={e => { const n = [...items]; n[i].desc = e.target.value; setItems(n); }}
                style={{ padding: '8px 10px', borderRadius: T.rSm, border: `1px solid ${T.border}`, background: T.surfaceAlt, color: T.text, fontSize: 12, outline: 'none', fontFamily: T.font }} />
              <input value={item.qty} type="number" onChange={e => { const n = [...items]; n[i].qty = +e.target.value; n[i].total = n[i].qty * n[i].rate; setItems(n); }}
                style={{ padding: '8px 6px', borderRadius: T.rSm, border: `1px solid ${T.border}`, background: T.surfaceAlt, color: T.text, fontSize: 12, outline: 'none', textAlign: 'center', fontFamily: T.font }} />
              <input value={item.rate} type="number" onChange={e => { const n = [...items]; n[i].rate = +e.target.value; n[i].total = n[i].qty * n[i].rate; setItems(n); }}
                style={{ padding: '8px 6px', borderRadius: T.rSm, border: `1px solid ${T.border}`, background: T.surfaceAlt, color: T.text, fontSize: 12, outline: 'none', textAlign: 'right', fontFamily: T.font }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: T.text, textAlign: 'right', fontFamily: T.fontMono }}>₹{item.total.toLocaleString('en-IN')}</span>
            </div>
          ))}
        </KCard>

        {/* Totals */}
        <KCard T={T} style={{ marginBottom: 14 }}>
          <SectionTitle T={T}>Hisaab / Totals</SectionTitle>
          {[
            { label: 'Subtotal', value: fmt(subtotal) },
            { label: `GST (${tax}%)`, value: fmt(taxAmt) },
          ].map(row => (
            <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: `1px solid ${T.border}` }}>
              <span style={{ color: T.textMuted, fontSize: 13 }}>{row.label}</span>
              <span style={{ color: T.text, fontSize: 13, fontFamily: T.fontMono }}>{row.value}</span>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0 0' }}>
            <span style={{ color: T.text, fontSize: 15, fontWeight: 800 }}>Kul Total</span>
            <span style={{ color: T.accent, fontSize: 18, fontWeight: 800, fontFamily: T.fontMono }}>{fmt(grandTotal)}</span>
          </div>
        </KCard>
      </div>

      {/* Action buttons — fixed */}
      <div style={{ position: 'fixed', bottom: 72, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 430, padding: '12px 16px', background: T.navBg, borderTop: `1px solid ${T.border}`, display: 'flex', gap: 10, backdropFilter: 'blur(20px)', boxSizing: 'border-box' }}>
        <button style={{ flex: 1, padding: '12px', borderRadius: T.r, background: T.surfaceAlt, border: `1px solid ${T.border}`, color: T.textMuted, fontWeight: 600, fontSize: 14, cursor: 'pointer', fontFamily: T.font }}>
          Draft Save करें
        </button>
        <button style={{ flex: 1.5, padding: '12px', borderRadius: T.r, background: isKhata ? 'linear-gradient(135deg, #f59e0b, #e07a10)' : 'linear-gradient(135deg, #00d9a3, #0a9e78)', color: isKhata ? '#fff' : '#0c1021', fontWeight: 700, fontSize: 14, cursor: 'pointer', border: 'none', fontFamily: T.font, boxShadow: isKhata ? '0 4px 12px rgba(224,122,16,0.3)' : '0 4px 12px rgba(0,217,163,0.3)' }}>
          ✓ Finalize Bill
        </button>
      </div>
    </div>
  );
}

// ─── PARTIES SCREEN ───────────────────────────────────────────────────────────

function PartiesScreen({ T, navigate }) {
  const [search, setSearch] = React.useState('');
  const isKhata = T.themeName === 'khata';
  const filtered = MOCK.parties.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));
  const totalReceivable = MOCK.parties.filter(p => p.balance > 0).reduce((s, p) => s + p.balance, 0);
  const totalPayable = Math.abs(MOCK.parties.filter(p => p.balance < 0).reduce((s, p) => s + p.balance, 0));

  return (
    <div style={{ fontFamily: T.font, background: T.bg, minHeight: '100%', paddingBottom: 100 }}>
      {/* Header */}
      <div style={{ padding: '18px 16px 12px', background: isKhata ? T.surface : 'transparent', borderBottom: `1px solid ${T.border}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: T.text, margin: 0 }}>Udhar Khata</h1>
            <p style={{ color: T.textMuted, fontSize: 12, margin: '2px 0 0' }}>Party-wise hisaab</p>
          </div>
          <button style={{ padding: '8px 14px', borderRadius: T.r, background: isKhata ? 'linear-gradient(135deg, #f59e0b, #e07a10)' : 'linear-gradient(135deg, #00d9a3, #0a9e78)', color: isKhata ? '#fff' : '#0c1021', fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer', fontFamily: T.font, boxShadow: isKhata ? '0 4px 12px rgba(224,122,16,0.3)' : '0 4px 12px rgba(0,217,163,0.3)' }}>
            + Party
          </button>
        </div>

        {/* Summary strip */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
          <div style={{ padding: '10px 12px', borderRadius: T.r, background: T.successBg, border: `1px solid ${T.success}25` }}>
            <p style={{ color: T.success, fontSize: 11, fontWeight: 700, margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Lena Baki ↑</p>
            <p style={{ color: T.success, fontSize: 17, fontWeight: 800, margin: '2px 0 0', fontFamily: T.fontMono }}>{fmt(totalReceivable)}</p>
          </div>
          <div style={{ padding: '10px 12px', borderRadius: T.r, background: T.dangerBg, border: `1px solid ${T.danger}25` }}>
            <p style={{ color: T.danger, fontSize: 11, fontWeight: 700, margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Dena Baki ↓</p>
            <p style={{ color: T.danger, fontSize: 17, fontWeight: 800, margin: '2px 0 0', fontFamily: T.fontMono }}>{fmt(totalPayable)}</p>
          </div>
        </div>

        {/* Search */}
        <div style={{ position: 'relative' }}>
          <svg style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: T.textLight }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Party dhundho..."
            style={{ width: '100%', padding: '9px 12px 9px 30px', borderRadius: T.r, border: `1.5px solid ${T.border}`, background: T.surfaceAlt, color: T.text, fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: T.font }} />
        </div>
      </div>

      <div style={{ padding: '12px 16px' }}>
        <KCard T={T} style={{ padding: '0 12px' }}>
          {filtered.map((p, i) => (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: i < filtered.length - 1 ? `1px solid ${T.border}` : 'none', cursor: 'pointer' }}>
              {/* Avatar */}
              <div style={{ width: 40, height: 40, borderRadius: T.r, background: p.balance >= 0 ? T.successBg : T.dangerBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: p.balance >= 0 ? T.success : T.danger }}>{p.init}</span>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 700, color: T.text, margin: 0 }}>{p.name}</p>
                    <KChip T={T} color={p.type === 'CUSTOMER' ? 'accent' : 'default'}>{p.type === 'CUSTOMER' ? 'Grahak' : 'Supplier'}</KChip>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontSize: 15, fontWeight: 800, color: p.balance >= 0 ? T.success : T.danger, margin: 0, fontFamily: T.fontMono }}>
                      {p.balance >= 0 ? '+' : '-'}{fmt(p.balance)}
                    </p>
                    <p style={{ fontSize: 10, color: T.textLight, margin: '1px 0 0' }}>{p.balance >= 0 ? 'Lena Baki' : 'Dena Baki'}</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </KCard>
      </div>
    </div>
  );
}

Object.assign(window, { LoginScreen, DashboardScreen, BillsScreen, NewBillScreen, PartiesScreen, MOCK, fmt });
