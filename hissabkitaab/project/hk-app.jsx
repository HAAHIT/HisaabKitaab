
// HisaabKitaab — App Shell (Navigation + Themes + Tweaks)

const THEMES = {
  khata: {
    themeName: 'khata',
    label: 'Khata — Warm & Desi',
    bg: '#faf5ec',
    surface: '#ffffff',
    surfaceAlt: '#f5ede0',
    surfaceElevated: '#fffcf7',
    border: '#e8d9c3',
    borderStrong: '#c4a882',
    accent: '#e07a10',
    accentHover: '#c96d0a',
    accentFg: '#ffffff',
    accentLight: '#fff4e0',
    accentLightFg: '#92400e',
    text: '#1c1208',
    textMuted: '#7a6248',
    textLight: '#b09878',
    danger: '#c0392b',
    dangerBg: '#fdf0ef',
    success: '#1a7a45',
    successBg: '#edfaf3',
    warning: '#b86c0a',
    warningBg: '#fffaeb',
    cardShadow: '0 1px 12px rgba(120,80,20,0.09), 0 0 0 1px rgba(200,160,90,0.1)',
    navBg: 'rgba(250,245,236,0.96)',
    sidebarBg: '#ffffff',
    font: '"Plus Jakarta Sans", sans-serif',
    fontMono: '"DM Mono", monospace',
    r: '12px', rSm: '8px', rLg: '18px', rXl: '24px', rFull: '999px',
    backdropBlur: null,
  },
  daftar: {
    themeName: 'daftar',
    label: 'Daftar Pro — Dark & Modern',
    bg: '#0c1021',
    surface: 'rgba(255,255,255,0.06)',
    surfaceAlt: 'rgba(255,255,255,0.03)',
    surfaceElevated: 'rgba(255,255,255,0.09)',
    border: 'rgba(255,255,255,0.09)',
    borderStrong: 'rgba(255,255,255,0.2)',
    accent: '#00d9a3',
    accentHover: '#00c492',
    accentFg: '#0c1021',
    accentLight: 'rgba(0,217,163,0.12)',
    accentLightFg: '#00d9a3',
    text: '#eef2f8',
    textMuted: '#8a9ab5',
    textLight: '#5a6b85',
    danger: '#ff7070',
    dangerBg: 'rgba(255,112,112,0.1)',
    success: '#00d9a3',
    successBg: 'rgba(0,217,163,0.1)',
    warning: '#fbbf24',
    warningBg: 'rgba(251,191,36,0.1)',
    cardShadow: '0 4px 30px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.08)',
    navBg: 'rgba(12,16,33,0.9)',
    sidebarBg: 'rgba(255,255,255,0.04)',
    font: '"DM Sans", sans-serif',
    fontMono: '"DM Mono", monospace',
    r: '12px', rSm: '8px', rLg: '18px', rXl: '24px', rFull: '999px',
    backdropBlur: 'blur(20px)',
  }
};

const NAV_ITEMS = [
  {
    id: 'dashboard', label: 'Home', labelHi: 'होम',
    icon: (active, color) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? color : 'none'} stroke={active ? color : 'currentColor'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
      </svg>
    )
  },
  {
    id: 'bills', label: 'Bills', labelHi: 'बिल',
    icon: (active, color) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? color + '22' : 'none'} stroke={active ? color : 'currentColor'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="13" y2="17"/>
      </svg>
    )
  },
  {
    id: 'fab', label: '', labelHi: '',
    icon: () => null
  },
  {
    id: 'parties', label: 'Khata', labelHi: 'खाता',
    icon: (active, color) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? color : 'currentColor'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    )
  },
  {
    id: 'more', label: 'Aur', labelHi: 'और',
    icon: (active, color) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? color : 'currentColor'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>
      </svg>
    )
  },
];

function BottomNav({ T, screen, navigate }) {
  const isKhata = T.themeName === 'khata';
  const activeColor = T.accent;

  return (
    <div style={{
      position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
      width: '100%', maxWidth: 430, height: 70,
      background: T.navBg, borderTop: `1px solid ${T.border}`,
      backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
      display: 'flex', alignItems: 'center', justifyContent: 'space-around',
      zIndex: 100, padding: '0 8px', boxSizing: 'border-box',
    }}>
      {NAV_ITEMS.map((item) => {
        if (item.id === 'fab') {
          return (
            <button key="fab" onClick={() => navigate('new-bill')}
              style={{
                width: 52, height: 52, borderRadius: T.rLg, border: 'none', cursor: 'pointer',
                background: isKhata ? 'linear-gradient(135deg, #f59e0b, #e07a10)' : 'linear-gradient(135deg, #00d9a3, #0a9e78)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                boxShadow: isKhata ? '0 4px 20px rgba(224,122,16,0.45)' : '0 4px 20px rgba(0,217,163,0.4)',
                transform: 'translateY(-8px)',
                transition: 'transform 0.15s, box-shadow 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-10px) scale(1.05)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(-8px)'; }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={isKhata ? '#fff' : '#0c1021'} strokeWidth="2.5" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
            </button>
          );
        }
        const active = screen === item.id;
        return (
          <button key={item.id} onClick={() => item.id !== 'more' && navigate(item.id)}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, background: 'none', border: 'none', cursor: 'pointer', padding: '6px 12px', borderRadius: T.r, position: 'relative', flex: 1 }}>
            {active && (
              <div style={{ position: 'absolute', top: -1, left: '50%', transform: 'translateX(-50%)', width: 24, height: 2.5, borderRadius: 2, background: activeColor }} />
            )}
            <span style={{ color: active ? activeColor : T.textMuted, transition: 'color 0.15s' }}>
              {item.icon(active, activeColor)}
            </span>
            <span style={{ fontSize: 10, fontWeight: active ? 700 : 500, color: active ? activeColor : T.textMuted, fontFamily: T.font, letterSpacing: '0.2px' }}>
              {item.labelHi || item.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function DesktopSidebar({ T, screen, navigate }) {
  const isKhata = T.themeName === 'khata';
  const items = [
    { id: 'dashboard', label: 'Dashboard', labelHi: 'होम' },
    { id: 'bills', label: 'Bills', labelHi: 'बिल' },
    { id: 'parties', label: 'Udhar Khata', labelHi: 'उधार खाता' },
    { id: 'new-bill', label: 'New Bill', labelHi: 'नया बिल', highlight: true },
  ];

  return (
    <div style={{ width: 230, flexShrink: 0, height: '100%', background: isKhata ? T.sidebarBg : T.sidebarBg, borderRight: `1px solid ${T.border}`, display: 'flex', flexDirection: 'column', ...(T.backdropBlur ? { backdropFilter: T.backdropBlur, WebkitBackdropFilter: T.backdropBlur } : {}) }}>
      {/* Logo */}
      <div style={{ padding: '20px 16px', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 36, height: 36, borderRadius: T.r, background: isKhata ? 'linear-gradient(135deg, #f59e0b, #e07a10)' : 'linear-gradient(135deg, #00d9a3, #0a9e78)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={isKhata ? 'white' : '#0c1021'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
          </svg>
        </div>
        <div>
          <p style={{ fontSize: 14, fontWeight: 800, color: T.text, margin: 0, letterSpacing: '-0.3px' }}>HisaabKitaab</p>
          <p style={{ fontSize: 10, color: T.textMuted, margin: 0 }}>MSME Bookkeeping</p>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '12px 10px', overflowY: 'auto' }}>
        {items.map(item => {
          const active = screen === item.id;
          if (item.highlight) return (
            <button key={item.id} onClick={() => navigate(item.id)}
              style={{ width: '100%', padding: '10px 14px', borderRadius: T.r, background: isKhata ? 'linear-gradient(135deg, #f59e0b, #e07a10)' : 'linear-gradient(135deg, #00d9a3, #0a9e78)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4, color: isKhata ? '#fff' : '#0c1021', fontFamily: T.font, fontWeight: 700, fontSize: 14, boxShadow: isKhata ? '0 4px 12px rgba(224,122,16,0.3)' : '0 4px 12px rgba(0,217,163,0.3)' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              {item.labelHi}
            </button>
          );
          return (
            <button key={item.id} onClick={() => navigate(item.id)}
              style={{ width: '100%', padding: '10px 14px', borderRadius: T.r, background: active ? T.accentLight : 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 2, color: active ? T.accentLightFg : T.textMuted, fontFamily: T.font, fontWeight: active ? 700 : 500, fontSize: 14, textAlign: 'left', transition: 'background 0.15s, color 0.15s' }}
              onMouseEnter={e => { if (!active) e.currentTarget.style.background = T.surfaceAlt; }}
              onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
            >
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: active ? T.accent : 'transparent', flexShrink: 0, transition: 'background 0.15s' }} />
              {item.labelHi}
            </button>
          );
        })}
      </nav>

      {/* User */}
      <div style={{ padding: '12px', borderTop: `1px solid ${T.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: T.r, background: T.surfaceAlt }}>
          <div style={{ width: 32, height: 32, borderRadius: T.rSm, background: isKhata ? 'linear-gradient(135deg, #f59e0b, #e07a10)' : 'linear-gradient(135deg, #00d9a3, #0a9e78)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span style={{ fontSize: 12, fontWeight: 800, color: isKhata ? '#fff' : '#0c1021' }}>RS</span>
          </div>
          <div>
            <p style={{ fontSize: 12, fontWeight: 700, color: T.text, margin: 0 }}>Raj Sharma</p>
            <p style={{ fontSize: 10, color: T.textMuted, margin: 0 }}>Admin</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function App() {
  const [screen, setScreen] = React.useState('dashboard');
  const [showMobileSidebar, setShowMobileSidebar] = React.useState(false);
  const [isDesktop, setIsDesktop] = React.useState(window.innerWidth >= 860);

  const { useTweaks, TweaksPanel, TweakSection, TweakRadio, TweakToggle } = window;

  const [tweaks, setTweak] = useTweaks(/*EDITMODE-BEGIN*/{
    "theme": "khata",
    "showDesktop": false,
    "showHindi": true
  }/*EDITMODE-END*/);

  React.useEffect(() => {
    const handler = () => setIsDesktop(window.innerWidth >= 860);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  const T = THEMES[tweaks.theme] || THEMES.khata;
  const showDesktop = tweaks.showDesktop || isDesktop;
  const navigate = (s) => setScreen(s);

  const screens = {
    login:     <LoginScreen T={T} navigate={navigate} />,
    dashboard: <DashboardScreen T={T} navigate={navigate} />,
    bills:     <BillsScreen T={T} navigate={navigate} />,
    'new-bill':<NewBillScreen T={T} navigate={navigate} />,
    parties:   <PartiesScreen T={T} navigate={navigate} />,
  };

  const showNav = screen !== 'login';

  return (
    <div style={{ minHeight: '100vh', background: showDesktop ? T.bg : '#1a1a2e', display: 'flex', alignItems: showDesktop ? 'stretch' : 'center', justifyContent: 'center', fontFamily: T.font }}>
      {showDesktop ? (
        // Desktop layout
        <div style={{ display: 'flex', width: '100%', height: '100vh', overflow: 'hidden' }}>
          {showNav && <DesktopSidebar T={T} screen={screen} navigate={navigate} />}
          <main style={{ flex: 1, overflowY: 'auto', background: T.bg }}>
            {screens[screen] || screens.dashboard}
          </main>
        </div>
      ) : (
        // Mobile frame
        <div style={{ width: '100%', maxWidth: 430, minHeight: '100vh', background: T.bg, position: 'relative', overflow: 'hidden', boxShadow: '0 0 80px rgba(0,0,0,0.5)' }}>
          <div style={{ height: '100vh', overflowY: 'auto', overflowX: 'hidden', paddingBottom: showNav ? 72 : 0 }}>
            {screens[screen] || screens.dashboard}
          </div>
          {showNav && <BottomNav T={T} screen={screen} navigate={navigate} />}
        </div>
      )}

      {/* Tweaks */}
      <TweaksPanel>
        <TweakSection label="Direction">
          <TweakRadio label="Theme" value={tweaks.theme} options={[
            { value: 'khata', label: 'Khata 🟧' },
            { value: 'daftar', label: 'Daftar Pro 🟩' },
          ]} onChange={(v) => setTweak('theme', v)} />
        </TweakSection>
        <TweakSection label="Layout">
          <TweakToggle label="Desktop View" value={tweaks.showDesktop} onChange={(v) => setTweak('showDesktop', v)} />
        </TweakSection>
        <TweakSection label="Screen">
          <TweakRadio label="Go to" value={screen} options={[
            { value: 'login', label: 'Login' },
            { value: 'dashboard', label: 'Home' },
            { value: 'bills', label: 'Bills' },
            { value: 'new-bill', label: 'New Bill' },
            { value: 'parties', label: 'Parties' },
          ]} onChange={(v) => navigate(v)} />
        </TweakSection>
      </TweaksPanel>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
