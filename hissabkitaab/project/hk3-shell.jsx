
// hk3-shell.jsx — App shell: top nav (desktop), bottom nav + smart FAB (mobile)

const { useTheme, useIsMobile, IconButton, Button, Card, Sheet, C, FONT, BRAND, DISPLAY, TYPE, typo, RADIUS } = window;

// ── Logo ──────────────────────────────────────────────────────────────────────

function Logo({size=32}){
  return(
    <div style={{
      width:size, height:size, borderRadius: size/4,
      background: C.primaryDark,
      display:'flex', alignItems:'center', justifyContent:'center',
      flexShrink: 0,
      boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.04)',
    }}>
      <span style={{
        color: '#fafafa', fontFamily: BRAND, fontSize: size*0.6,
        fontWeight: 600, letterSpacing:'-0.02em', lineHeight: 1,
      }}>हK</span>
    </div>
  );
}

// ── Icons ─────────────────────────────────────────────────────────────────────

const ICONS = {
  home: (a)=><svg width="20" height="20" viewBox="0 0 24 24" fill={a?'currentColor':'none'} stroke="currentColor" strokeWidth={a?0:1.8} strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  bills:(a)=><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={a?2.4:1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="13" y2="17"/></svg>,
  parties:(a)=><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={a?2.4:1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  payments:(a)=><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={a?2.4:1.8} strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>,
  more: ()=><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="1.6" fill="currentColor"/><circle cx="19" cy="12" r="1.6" fill="currentColor"/><circle cx="5" cy="12" r="1.6" fill="currentColor"/></svg>,
  sun: ()=><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="4.5"/><line x1="12" y1="2" x2="12" y2="4"/><line x1="12" y1="20" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="6.34" y2="6.34"/><line x1="17.66" y1="17.66" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="4" y2="12"/><line x1="20" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="6.34" y2="17.66"/><line x1="17.66" y1="6.34" x2="19.07" y2="4.93"/></svg>,
  moon:()=><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M20 14.5A8 8 0 0 1 10 4.5c-.3 0-.6 0-.9.1A8 8 0 1 0 21 14.5c-.3 0-.6 0-1 0z"/></svg>,
  bell:()=><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>,
  plus:()=><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  chevR:()=><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>,
  chevL:()=><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>,
  call:()=><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>,
  whatsapp:()=><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>,
  reports:()=><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><path d="m7 14 4-4 4 4 5-5"/></svg>,
  settings:()=><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33 1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
  bank:()=><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="22" x2="21" y2="22"/><line x1="6" y1="18" x2="6" y2="11"/><line x1="10" y1="18" x2="10" y2="11"/><line x1="14" y1="18" x2="14" y2="11"/><line x1="18" y1="18" x2="18" y2="11"/><polygon points="12 2 20 7 4 7"/></svg>,
  tally:()=><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>,
  logout:()=><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
  download:()=><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
  upload:()=><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>,
  search:()=><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>,
  alert:()=><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  check:()=><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
  filter:()=><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>,
  arrowDown:()=><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>,
  arrowUp:()=><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>,
  trash:()=><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>,
  edit:()=><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="m18.5 2.5 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  share:()=><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>,
  user:()=><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
};

// ── Top Bar (Desktop) ─────────────────────────────────────────────────────────

function TopBar({page, setPage, onNewBill, onMore}){
  const {theme:T, toggleTheme} = useTheme();
  const tabs=[
    {id:'dashboard', label:'Home'},
    {id:'bills',     label:'Bills'},
    {id:'purchases', label:'Kharidari'},
    {id:'parties',   label:'Khata'},
    {id:'payments',  label:'Payments'},
    {id:'banking',   label:'Banking'},
  ];
  return(
    <header style={{
      height:64, background: T.surface, borderBottom: `1px solid ${T.border}`,
      display:'flex', alignItems:'center',
      padding:'0 24px', gap:18,
      position:'sticky', top:0, zIndex:50, flexShrink:0,
    }}>
      <div style={{display:'flex',alignItems:'center',gap:10,flexShrink:0}}>
        <Logo size={34}/>
        <span style={{fontFamily:BRAND,fontSize:21,fontWeight:600,color:T.text,letterSpacing:'-0.01em',whiteSpace:'nowrap'}}>HisaabKitaab</span>
      </div>

      <nav style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',gap:2,minWidth:0,overflow:'hidden'}}>
        {tabs.map(t=>{
          const active = page===t.id;
          return(
            <button key={t.id} onClick={()=>setPage(t.id)} style={{
              padding:'8px 14px', borderRadius: RADIUS.md, border:'none',
              background: active?T.surfaceAlt:'transparent',
              color: active?T.text:T.textMuted,
              ...typo('bodySm'), fontWeight:active?700:500,
              fontFamily: FONT, cursor:'pointer', transition:'all 0.15s',
              whiteSpace:'nowrap',flexShrink:0,
            }}>
              {t.label}
            </button>
          );
        })}
      </nav>

      <div style={{display:'flex',alignItems:'center',gap:8,flexShrink:0}}>
        <Button onClick={onNewBill} size="sm" icon={ICONS.plus()}>Naya Bill</Button>
        <IconButton onClick={onMore} label="More menu">{ICONS.more()}</IconButton>
        <IconButton onClick={toggleTheme} label="Toggle theme">
          {T.id==='dark'?ICONS.sun():ICONS.moon()}
        </IconButton>
        <IconButton label="Notifications">{ICONS.bell()}</IconButton>
        <div style={{
          width:36, height:36, borderRadius: 12,
          background: C.primary, color: '#fff',
          display:'flex',alignItems:'center',justifyContent:'center',
          ...typo('bodySm'), fontWeight:700, cursor:'pointer', marginLeft:4,
          flexShrink:0,
        }}>RS</div>
      </div>
    </header>
  );
}

// ── Mobile Top Bar ────────────────────────────────────────────────────────────

function MobileTopBar({title, onMore}){
  const {theme:T, toggleTheme} = useTheme();
  return(
    <header style={{
      height:56, background: T.surface, borderBottom: `1px solid ${T.border}`,
      display:'flex', alignItems:'center', padding:'0 14px', gap:10,
      position:'sticky', top:0, zIndex:50, flexShrink:0,
    }}>
      <Logo size={32}/>
      <h1 style={{...typo('h3'),color:T.text,margin:0,flex:1,marginLeft:6}}>{title}</h1>
      <IconButton onClick={toggleTheme} size={36} label="Theme">{T.id==='dark'?ICONS.sun():ICONS.moon()}</IconButton>
      <IconButton onClick={onMore} size={36} label="Menu">{ICONS.more()}</IconButton>
    </header>
  );
}

// ── Mobile Bottom Nav with FAB ───────────────────────────────────────────────

function BottomNav({page, setPage, onFab}){
  const {theme:T} = useTheme();
  const tabs = [
    {id:'dashboard',label:'Home',     icon:ICONS.home},
    {id:'bills',    label:'Bills',    icon:ICONS.bills},
    null, // FAB
    {id:'parties',  label:'Khata',    icon:ICONS.parties},
    {id:'payments', label:'Payments', icon:ICONS.payments},
  ];
  return(
    <nav style={{
      position:'fixed', left:0, right:0, bottom:0, zIndex:40, height:68,
      background: T.surface, borderTop: `1px solid ${T.border}`,
      display:'flex', alignItems:'center',
      paddingBottom: 'env(safe-area-inset-bottom)',
    }}>
      {tabs.map((t,idx)=>{
        if(!t) return(
          <div key="fab" style={{flex:1,display:'flex',justifyContent:'center'}}>
            <button onClick={onFab} aria-label="Quick add" style={{
              width:54, height:54, borderRadius: 18, border:'none',
              background: C.primary, color:'#fff', cursor:'pointer',
              display:'flex',alignItems:'center',justifyContent:'center',
              transform:'translateY(-14px)',
              boxShadow:`0 6px 18px ${C.primary}66, 0 0 0 4px ${T.surface}`,
              transition:'transform 0.15s',
            }}
            onMouseDown={e=>e.currentTarget.style.transform='translateY(-14px) scale(0.94)'}
            onMouseUp={e=>e.currentTarget.style.transform='translateY(-14px)'}
            onMouseLeave={e=>e.currentTarget.style.transform='translateY(-14px)'}>
              {ICONS.plus()}
            </button>
          </div>
        );
        const active = page===t.id;
        return(
          <button key={t.id} onClick={()=>setPage(t.id)} style={{
            flex:1, height:'100%', border:'none', background:'transparent',
            display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:3,
            color: active?C.primary:T.textMuted, cursor:'pointer',
          }}>
            {t.icon(active)}
            <span style={{...typo('caption'),fontWeight:active?700:500,fontFamily:FONT}}>{t.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

// ── Smart FAB Sheet — 3 quick-create options ──────────────────────────────────

function QuickAddSheet({open, onClose, onCreatePayment, onCreateBill, onCreateParty, isMobile}){
  const {theme:T} = useTheme();
  const opts = [
    { label:'Payment Mila / Diya',  sub:'Paisa aaya ya gaya record karo',     icon:'💸', tone:'positive', action:onCreatePayment },
    { label:'Naya Bill',            sub:'Customer ke liye bill banao',         icon:'🧾', tone:'primary',  action:onCreateBill },
    { label:'Nayi Party',           sub:'Customer ya supplier add karo',       icon:'👤', tone:'info',     action:onCreateParty },
  ];

  return(
    <Sheet open={open} onClose={onClose} title="Kya banana hai?" isMobile={isMobile} width={420}>
      <div style={{display:'flex',flexDirection:'column',gap:8}}>
        {opts.map(o=>(
          <button key={o.label} onClick={()=>{o.action&&o.action();onClose();}} style={{
            display:'flex',alignItems:'center',gap:14,padding:'14px 14px',
            borderRadius: RADIUS.md, background:T.surfaceAlt, border:'none',
            cursor:'pointer', textAlign:'left', width:'100%',
            transition:'background 0.15s',
            color: T.text,
          }}
          onMouseEnter={e=>e.currentTarget.style.background=T.hover}
          onMouseLeave={e=>e.currentTarget.style.background=T.surfaceAlt}>
            <div style={{
              width:48,height:48,borderRadius:RADIUS.md,
              background: T.surface, border: `1px solid ${T.border}`,
              display:'flex',alignItems:'center',justifyContent:'center',
              fontSize:22, flexShrink:0,
            }}>{o.icon}</div>
            <div style={{flex:1,minWidth:0}}>
              <p style={{...typo('h3'),color:T.text,margin:0}}>{o.label}</p>
              <p style={{...typo('caption'),color:T.textMuted,margin:'2px 0 0'}}>{o.sub}</p>
            </div>
            <span style={{color:T.textLight}}>{ICONS.chevR()}</span>
          </button>
        ))}
      </div>
    </Sheet>
  );
}

// ── More Menu Sheet — secondary nav ──────────────────────────────────────────

function MoreMenuSheet({open, onClose, setPage, isMobile, onSignOut, onRestartOnboarding}){
  const {theme:T, toggleTheme} = useTheme();
  const sections = [
    { label: 'Karobaar', items: [
      {id:'notes',       label:'Credit / Debit Notes', icon:()=><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/></svg>},
      {id:'transactions',label:'Transaction Register', icon:()=><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>},
    ]},
    { label: 'Tools', items: [
      {id:'reports',     label:'Reports & Insights',  icon:ICONS.reports},
      {id:'tally',       label:'Tally Export / Import', icon:ICONS.tally},
      {id:'reconcile',   label:'Bank Reconcile',      icon:ICONS.bank},
      {id:'settings',    label:'Settings',            icon:ICONS.settings},
    ]},
  ];
  return(
    <Sheet open={open} onClose={onClose} title={USER.business} subtitle={USER.email} isMobile={isMobile} width={420}>
      <div style={{display:'flex',alignItems:'center',gap:12,padding:'12px 14px',marginBottom:14,borderRadius:RADIUS.md,background:T.surfaceAlt}}>
        <div style={{width:42,height:42,borderRadius:14,background:C.primary,color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',...typo('h3'),fontWeight:700}}>RS</div>
        <div style={{flex:1,minWidth:0}}>
          <p style={{...typo('body'),color:T.text,margin:0,fontWeight:700}}>{USER.name}</p>
          <p style={{...typo('caption'),color:T.textMuted,margin:'2px 0 0'}}>{USER.role} · {USER.phone}</p>
        </div>
      </div>

      {sections.map((sec,si)=>(
        <div key={si} style={{marginBottom:14}}>
          {sec.label && <p style={{...typo('caption'),color:T.textLight,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.4px',padding:'0 14px 6px'}}>{sec.label}</p>}
          {sec.items.map(item=>(
            <button key={item.id} onClick={()=>{ setPage(item.id); onClose(); }} style={{
              width:'100%', display:'flex',alignItems:'center',gap:12,
              padding:'12px 14px', border:'none', background:'transparent',
              cursor:'pointer', textAlign:'left', borderRadius: RADIUS.md,
              color:T.text, transition:'background 0.15s',
            }}
            onMouseEnter={e=>e.currentTarget.style.background=T.hover}
            onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
              <span style={{color:T.textMuted,flexShrink:0}}>{item.icon()}</span>
              <span style={{...typo('body'),fontWeight:600,flex:1,minWidth:0,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{item.label}</span>
              <span style={{marginLeft:'auto',color:T.textLight,flexShrink:0}}>{ICONS.chevR()}</span>
            </button>
          ))}
        </div>
      ))}

      <div style={{height:1,background:T.divider,margin:'8px 0'}}/>

      <button onClick={toggleTheme} style={{
        width:'100%',display:'flex',alignItems:'center',gap:12,padding:'12px 14px',
        border:'none',background:'transparent',cursor:'pointer',textAlign:'left',
        borderRadius:RADIUS.md,color:T.text,
      }}>
        <span style={{color:T.textMuted}}>{T.id==='dark'?ICONS.sun():ICONS.moon()}</span>
        <span style={{...typo('body'),fontWeight:600}}>{T.id==='dark'?'Light Mode':'Dark Mode'}</span>
      </button>

      {onRestartOnboarding && (
        <button onClick={onRestartOnboarding} style={{
          width:'100%',display:'flex',alignItems:'center',gap:12,padding:'12px 14px',
          border:'none',background:'transparent',cursor:'pointer',textAlign:'left',
          borderRadius:RADIUS.md,color:T.text,
        }}>
          <span style={{color:T.textMuted}}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
          </span>
          <span style={{...typo('body'),fontWeight:600}}>Demo: Restart Onboarding</span>
        </button>
      )}

      <button onClick={onSignOut} style={{
        width:'100%',display:'flex',alignItems:'center',gap:12,padding:'12px 14px',
        border:'none',background:'transparent',cursor:'pointer',textAlign:'left',
        borderRadius:RADIUS.md,color:C.negative,
      }}>
        <span>{ICONS.logout()}</span>
        <span style={{...typo('body'),fontWeight:600}}>Sign Out</span>
      </button>
    </Sheet>
  );
}

// ── Overdue Banner — appears on Dashboard, Bills, Parties ─────────────────────

function OverdueBanner({onClick}){
  const {theme:T} = useTheme();
  const s = dashboardSummary();
  if(s.overdueCount === 0) return null;
  return(
    <button onClick={onClick} style={{
      width:'100%', display:'flex',alignItems:'center',gap:12,
      padding:'12px 14px', borderRadius: RADIUS.md, border: `1px solid ${C.primary}33`,
      background: C.primarySoft, cursor:'pointer', textAlign:'left',
      marginBottom: 16, fontFamily: FONT,
      transition:'border-color 0.15s',
    }}
    onMouseEnter={e=>e.currentTarget.style.borderColor=C.primary+'66'}
    onMouseLeave={e=>e.currentTarget.style.borderColor=C.primary+'33'}>
      <div style={{
        width:40,height:40,borderRadius:RADIUS.md,
        background: C.primary, color: '#fff',
        display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,
      }}>
        {ICONS.alert()}
      </div>
      <div style={{flex:1,minWidth:0}}>
        <p style={{...typo('h3'),color:C.primaryDark,margin:0,fontWeight:700}}>
          {fmtFull(s.overdueAmount)} overdue
        </p>
        <p style={{...typo('caption'),color:C.primaryDark,margin:'2px 0 0',opacity:0.7}}>
          {s.overdueCount === 1
            ? `from ${s.overdueParty.name} — chase karo`
            : `from ${s.overdueCount} parties — ek chakkar laga lo`}
        </p>
      </div>
      <span style={{...typo('label'),color:C.primary,fontWeight:700,display:'flex',alignItems:'center',gap:4}}>
        Dekho <span style={{marginTop:1}}>{ICONS.chevR()}</span>
      </span>
    </button>
  );
}

Object.assign(window, { Logo, ICONS, TopBar, MobileTopBar, BottomNav, QuickAddSheet, MoreMenuSheet, OverdueBanner });
