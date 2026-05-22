
// hk3-screens-misc.jsx — Login, Settings, Reports, Tally hub

const { useTheme, useIsMobile, Card, Button, IconButton, Input, Select, Chip, Avatar, Sheet, EmptyState, Section,
  C, FONT, MONO, TYPE, typo, RADIUS, fmt, fmtFull,
  USER, PARTIES, BILLS, PAYMENTS, ITEMS, BANK_ACCOUNTS, ICONS, Logo } = window;

// ─── LOGIN SCREEN ────────────────────────────────────────────────────────────

function LoginScreen({ onLogin, isMobile }){
  const {theme:T, toggleTheme} = useTheme();
  const [phone,setPhone]=React.useState('');
  const [pw,setPw]=React.useState('');
  const [loading,setLoading]=React.useState(false);

  async function submit(){
    setLoading(true);
    await new Promise(r=>setTimeout(r,800));
    setLoading(false);
    onLogin();
  }

  return(
    <div style={{minHeight:'100vh',background:T.bg,color:T.text,fontFamily:FONT,display:'flex',flexDirection:'column'}}>
      <div style={{padding:'18px 20px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <Logo size={34}/>
          <span style={{...typo('h3'),color:T.text,letterSpacing:'-0.3px'}}>HisaabKitaab</span>
        </div>
        <IconButton onClick={toggleTheme} label="Theme">{T.id==='dark'?ICONS.sun():ICONS.moon()}</IconButton>
      </div>

      <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',padding:'24px 16px'}}>
        <div style={{width:'100%',maxWidth:400}}>
          <div style={{textAlign:'center',marginBottom:32}}>
            <div style={{
              width:72,height:72,borderRadius:24,background:C.primary,
              display:'inline-flex',alignItems:'center',justifyContent:'center',
              boxShadow:`0 10px 30px ${C.primary}40`,marginBottom:18,
              color:'#fff',
            }}>
              <span style={{fontFamily:FONT,fontSize:32,fontWeight:800,letterSpacing:'-1px'}}>हK</span>
            </div>
            <h1 style={{...typo('h1'),color:T.text,marginBottom:4}}>Wapas Aaye! 👋</h1>
            <p style={{...typo('body'),color:T.textMuted}}>Apne karobaar mein wapas chalo</p>
          </div>

          <Card padding={isMobile?20:28}>
            <div style={{display:'flex',flexDirection:'column',gap:14}}>
              <Input label="Phone ya Email" value={phone} onChange={setPhone} placeholder="98765-43210 / you@example.com" autoFocus/>
              <Input label="Password" type="password" value={pw} onChange={setPw} placeholder="••••••••"/>
              <a href="#" style={{...typo('caption'),color:C.primary,fontWeight:600,textAlign:'right',textDecoration:'none'}}>Password bhool gaye?</a>
              <Button onClick={submit} disabled={!phone || !pw || loading} fullWidth size="lg">
                {loading ? 'Sign in ho raha hai...' : 'Sign In →'}
              </Button>
            </div>

            <div style={{margin:'20px 0',display:'flex',alignItems:'center',gap:10}}>
              <div style={{flex:1,height:1,background:T.divider}}/>
              <span style={{...typo('caption'),color:T.textLight}}>OR</span>
              <div style={{flex:1,height:1,background:T.divider}}/>
            </div>

            <Button variant="secondary" fullWidth>
              <span style={{fontSize:14,marginRight:6}}>📞</span> Continue with OTP
            </Button>
          </Card>

          <p style={{textAlign:'center',marginTop:18,...typo('bodySm'),color:T.textMuted}}>
            Naye ho? <a href="#" style={{color:C.primary,fontWeight:700,textDecoration:'none'}}>Free mein account banao</a>
          </p>
        </div>
      </div>

      <footer style={{padding:'18px',textAlign:'center',...typo('caption'),color:T.textLight}}>
        MSME Bookkeeping · v3.0
      </footer>
    </div>
  );
}

// ─── SETTINGS HUB ────────────────────────────────────────────────────────────

function SettingsScreen({ isMobile, onNavigate, onBack }){
  const {theme:T} = useTheme();
  const [tab, setTab] = React.useState('business');

  const tabs = [
    {id:'business', label:'Business Profile'},
    {id:'team',     label:'Team & Users'},
    {id:'items',    label:'Items / Saman'},
    {id:'bank',     label:'Bank Accounts'},
    {id:'tax',      label:'Tax & GST'},
    {id:'export',   label:'Export & Import'},
  ];

  return(
    <div style={{padding: isMobile?'14px 14px 100px':'24px 28px',maxWidth:1080,margin:'0 auto'}}>
      <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:20}}>
        <IconButton onClick={onBack} variant="surface" label="Back">{ICONS.chevL()}</IconButton>
        <div>
          <h1 style={{...typo('h1'),color:T.text,margin:0}}>Settings</h1>
          <p style={{...typo('bodySm'),color:T.textMuted,margin:'4px 0 0'}}>Business profile aur preferences</p>
        </div>
      </div>

      <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr':'220px 1fr',gap:18}}>
        <div>
          <Card padding={6}>
            {tabs.map(t=>{
              const active = tab===t.id;
              return(
                <button key={t.id} onClick={()=>setTab(t.id)} style={{
                  width:'100%',padding:'10px 14px',borderRadius:RADIUS.sm,border:'none',
                  background: active?T.surfaceAlt:'transparent',
                  color: active?T.text:T.textMuted, ...typo('bodySm'),fontWeight:active?700:500,
                  fontFamily:FONT,textAlign:'left',cursor:'pointer',marginBottom:2,
                }}>{t.label}</button>
              );
            })}
          </Card>
        </div>

        <div>
          {tab==='business' && <BusinessSettings T={T} isMobile={isMobile}/>}
          {tab==='team'     && <TeamSettings T={T} isMobile={isMobile}/>}
          {tab==='items'    && <ItemsSettings T={T} isMobile={isMobile}/>}
          {tab==='bank'     && <BankSettings T={T} isMobile={isMobile}/>}
          {tab==='tax'      && <TaxSettings T={T} isMobile={isMobile}/>}
          {tab==='export'   && <ExportSettings T={T} isMobile={isMobile} onNavigate={onNavigate}/>}
        </div>
      </div>
    </div>
  );
}

function BusinessSettings({T, isMobile}){
  return(
    <Card padding={isMobile?20:28}>
      <h2 style={{...typo('h2'),color:T.text,marginBottom:18}}>Business Profile</h2>
      <div style={{display:'flex',alignItems:'center',gap:16,marginBottom:24}}>
        <Avatar name={USER.business} size={72} />
        <div style={{flex:1}}>
          <p style={{...typo('h2'),color:T.text}}>{USER.business}</p>
          <p style={{...typo('bodySm'),color:T.textMuted}}>{USER.state} · GSTIN {USER.gstin}</p>
        </div>
        <Button variant="secondary" icon={ICONS.edit()}>Edit</Button>
      </div>

      <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr':'1fr 1fr',gap:14}}>
        <Input label="Business name" value={USER.business} onChange={()=>{}}/>
        <Select label="Business type" value="Retail" onChange={()=>{}} options={['Retail','Wholesale','Manufacturing','Service']}/>
        <Select label="State" value={USER.state} onChange={()=>{}} options={['Maharashtra','Karnataka','Gujarat']}/>
        <Input label="City" value="Mumbai" onChange={()=>{}}/>
        <Input label="GSTIN" value={USER.gstin} onChange={()=>{}}/>
        <Input label="PAN" value="AAAAA0000A" onChange={()=>{}}/>
      </div>

      <div style={{marginTop:24,padding:'16px',borderRadius:RADIUS.md,background:T.surfaceAlt}}>
        <h3 style={{...typo('h3'),color:T.text,marginBottom:8}}>CA Contact</h3>
        <p style={{...typo('caption'),color:T.textMuted,marginBottom:14}}>Tally file bhejte waqt auto-fill ho jayega</p>
        <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr':'1fr 1fr 1fr',gap:10}}>
          <Input label="Name" value="Pradeep Sharma" onChange={()=>{}}/>
          <Input label="Email" value="pradeep@ca.com" onChange={()=>{}}/>
          <Input label="Phone" value="98765-12345" onChange={()=>{}}/>
        </div>
      </div>
    </Card>
  );
}

function TeamSettings({T, isMobile}){
  const team = [
    {name:'Raj Sharma', role:'ADMIN', email:USER.email, status:'Active'},
    {name:'Anita Kumar',role:'STAFF', email:'anita@sharma.com', status:'Active'},
    {name:'Pradeep Sharma',role:'ACCOUNTANT', email:'pradeep@ca.com', status:'Active'},
  ];
  return(
    <Card padding={isMobile?20:28}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:18}}>
        <h2 style={{...typo('h2'),color:T.text,margin:0}}>Team & Users</h2>
        <Button icon={ICONS.plus()} variant="secondary">Invite User</Button>
      </div>
      <div>
        {team.map((u,i)=>(
          <div key={u.email} style={{display:'flex',alignItems:'center',gap:12,padding:'14px 0',borderBottom:i<team.length-1?`1px solid ${T.divider}`:'none'}}>
            <Avatar name={u.name} size={44}/>
            <div style={{flex:1}}>
              <p style={{...typo('body'),fontWeight:700,color:T.text,margin:0}}>{u.name}</p>
              <p style={{...typo('caption'),color:T.textMuted,margin:'2px 0 0'}}>{u.email}</p>
            </div>
            <Chip tone={u.role==='ADMIN'?'primary':u.role==='ACCOUNTANT'?'info':'neutral'}>{u.role}</Chip>
            <Chip tone="positive">{u.status}</Chip>
          </div>
        ))}
      </div>
    </Card>
  );
}

function ItemsSettings({T, isMobile}){
  return(
    <Card padding={isMobile?20:28}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:18}}>
        <h2 style={{...typo('h2'),color:T.text,margin:0}}>Items / Saman</h2>
        <div style={{display:'flex',gap:8}}>
          <Button variant="secondary" icon={ICONS.upload()}>CSV Import</Button>
          <Button icon={ICONS.plus()}>Naya Item</Button>
        </div>
      </div>
      <div>
        {ITEMS.map((it,i)=>(
          <div key={it.id} style={{display:'flex',alignItems:'center',gap:12,padding:'14px 0',borderBottom:i<ITEMS.length-1?`1px solid ${T.divider}`:'none'}}>
            <div style={{width:42,height:42,borderRadius:12,background:T.surfaceAlt,color:T.textMuted,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,fontSize:18}}>📦</div>
            <div style={{flex:1}}>
              <p style={{...typo('body'),fontWeight:700,color:T.text,margin:0}}>{it.name}</p>
              <p style={{...typo('caption'),color:T.textMuted,margin:'2px 0 0',fontFamily:MONO}}>HSN {it.hsn} · {it.unit}</p>
            </div>
            <Chip>GST {it.gst}%</Chip>
            <p style={{fontFamily:FONT,fontWeight:700,color:T.text,...typo('body')}}>₹{it.rate}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}

function BankSettings({T, isMobile}){
  return(
    <Card padding={isMobile?20:28}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:18}}>
        <h2 style={{...typo('h2'),color:T.text,margin:0}}>Bank Accounts</h2>
        <Button icon={ICONS.plus()}>Account Jodo</Button>
      </div>
      <div style={{display:'flex',flexDirection:'column',gap:10}}>
        {BANK_ACCOUNTS.map((acc,i)=>(
          <div key={acc.id} style={{display:'flex',alignItems:'center',gap:12,padding:'14px 16px',borderRadius:RADIUS.md,border:`1px solid ${T.border}`}}>
            <div style={{width:44,height:44,borderRadius:12,background:C.infoSoft,color:C.info,display:'flex',alignItems:'center',justifyContent:'center'}}>{ICONS.bank()}</div>
            <div style={{flex:1}}>
              <p style={{...typo('body'),fontWeight:700,color:T.text,margin:0}}>{acc.bank}</p>
              <p style={{...typo('caption'),color:T.textMuted,margin:'2px 0 0',fontFamily:MONO}}>****{acc.last4} · {acc.type}</p>
            </div>
            <div style={{textAlign:'right'}}>
              <p style={{fontFamily:FONT,fontWeight:700,color:T.text,...typo('body'),fontVariantNumeric:'tabular-nums'}}>{fmtFull(acc.balance)}</p>
              <p style={{...typo('caption'),color:T.textMuted}}>Current balance</p>
            </div>
            <IconButton variant="surface" label="Edit">{ICONS.edit()}</IconButton>
          </div>
        ))}
      </div>
    </Card>
  );
}

function TaxSettings({T, isMobile}){
  return(
    <Card padding={isMobile?20:28}>
      <h2 style={{...typo('h2'),color:T.text,marginBottom:18}}>Tax & GST Settings</h2>
      <div style={{display:'flex',flexDirection:'column',gap:14}}>
        <Input label="Default GST rate (%)" value="18" onChange={()=>{}} suffix="%"/>
        <Select label="Bill prefix" value="B" onChange={()=>{}} options={['B','INV','HK']}/>
        <Input label="Starting bill number" value="001" onChange={()=>{}}/>
        <div style={{padding:'16px',borderRadius:RADIUS.md,background:T.surfaceAlt}}>
          <p style={{...typo('body'),fontWeight:600,color:T.text,marginBottom:4}}>Place of supply</p>
          <p style={{...typo('caption'),color:T.textMuted,marginBottom:10}}>Default state for invoices</p>
          <Select label={null} value="Maharashtra" onChange={()=>{}} options={['Maharashtra','Karnataka','Gujarat']}/>
        </div>
      </div>
    </Card>
  );
}

function ExportSettings({T, isMobile, onNavigate}){
  const opts = [
    {id:'tally',     label:'Tally Export / Import', sub:'CA ko Tally file bhejo ya laao',           icon:ICONS.tally(),   action:()=>onNavigate('tally') },
    {id:'reconcile', label:'Bank Reconcile',         sub:'Statement upload karke match karo',         icon:ICONS.bank(),    action:()=>onNavigate('reconcile') },
    {id:'gst',       label:'GST Reports',            sub:'GSTR-1, GSTR-3B reports',                   icon:ICONS.reports(), action:()=>onNavigate('reports') },
    {id:'csv',       label:'CSV Export',             sub:'Transactions, party ledger CSV',            icon:ICONS.download(),action:()=>{} },
  ];
  return(
    <Card padding={isMobile?20:28}>
      <h2 style={{...typo('h2'),color:T.text,marginBottom:18}}>Export & Import</h2>
      <div style={{display:'flex',flexDirection:'column',gap:10}}>
        {opts.map(o=>(
          <button key={o.id} onClick={o.action} style={{
            display:'flex',alignItems:'center',gap:12,padding:'14px 16px',
            borderRadius:RADIUS.md, border:`1px solid ${T.border}`,background:T.surface,
            cursor:'pointer',textAlign:'left',color:T.text,transition:'background 0.15s',
          }}
          onMouseEnter={e=>e.currentTarget.style.background=T.hover}
          onMouseLeave={e=>e.currentTarget.style.background=T.surface}>
            <div style={{width:42,height:42,borderRadius:12,background:T.surfaceAlt,color:T.textMuted,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>{o.icon}</div>
            <div style={{flex:1}}>
              <p style={{...typo('body'),fontWeight:700,color:T.text,margin:0}}>{o.label}</p>
              <p style={{...typo('caption'),color:T.textMuted,margin:'2px 0 0'}}>{o.sub}</p>
            </div>
            <span style={{color:T.textLight}}>{ICONS.chevR()}</span>
          </button>
        ))}
      </div>
    </Card>
  );
}

// ─── REPORTS SCREEN ──────────────────────────────────────────────────────────

function ReportsScreen({ isMobile, onNavigate }){
  const {theme:T} = useTheme();
  const reports = [
    {id:'gst',       label:'GST Returns',       sub:'GSTR-1, GSTR-3B summaries',  icon:'📊', color:C.info },
    {id:'pl',        label:'Profit & Loss',     sub:'Revenue aur kharcha',         icon:'📈', color:C.positive },
    {id:'ledger',    label:'Party Ledger',      sub:'Detailed party-wise statement',icon:'📒', color:C.warning },
    {id:'trial',     label:'Trial Balance',     sub:'Account-wise summary',        icon:'⚖️', color:C.primary },
    {id:'sales',     label:'Sales Report',      sub:'Month-wise sales trend',      icon:'💰', color:C.positive },
    {id:'overdue',   label:'Overdue Receivables',sub:'Pending baki ka detail',     icon:'⚠️', color:C.primary },
  ];

  return(
    <div style={{padding:isMobile?'18px 14px 100px':'24px 28px',maxWidth:1080,margin:'0 auto'}}>
      <div style={{marginBottom:18}}>
        <h1 style={{...typo('h1'),color:T.text,margin:0}}>Reports</h1>
        <p style={{...typo('bodySm'),color:T.textMuted,margin:'4px 0 0'}}>Apne karobaar ka pura analysis</p>
      </div>

      {/* Quick KPIs */}
      <div style={{display:'grid',gridTemplateColumns:isMobile?'repeat(2,1fr)':'repeat(4,1fr)',gap:10,marginBottom:18}}>
        {[
          {l:'Is Saal Sales', v:4567800, c:T.text },
          {l:'Is Saal Profit',v:892000,  c:C.positive },
          {l:'GST Liability', v:248000,  c:C.warning },
          {l:'Overdue',       v:223000,  c:C.primary },
        ].map((m,i)=>(
          <Card key={i} padding={isMobile?14:18}>
            <p style={{...typo('caption'),color:T.textMuted,marginBottom:6,fontWeight:600}}>{m.l}</p>
            <p style={{fontFamily:FONT,fontWeight:700,color:m.c,fontSize:isMobile?18:22,letterSpacing:'-0.4px',fontVariantNumeric:'tabular-nums'}}>{fmtFull(m.v)}</p>
          </Card>
        ))}
      </div>

      <Section title="Reports">
        <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr':'repeat(2,1fr)',gap:10}}>
          {reports.map(r=>(
            <Card key={r.id} hoverable padding={18}>
              <div style={{display:'flex',gap:12,alignItems:'center'}}>
                <div style={{width:44,height:44,borderRadius:14,background:r.color+'15',display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,flexShrink:0}}>{r.icon}</div>
                <div style={{flex:1}}>
                  <p style={{...typo('body'),fontWeight:700,color:T.text,margin:0}}>{r.label}</p>
                  <p style={{...typo('caption'),color:T.textMuted,margin:'2px 0 0'}}>{r.sub}</p>
                </div>
                <span style={{color:T.textLight}}>{ICONS.chevR()}</span>
              </div>
            </Card>
          ))}
        </div>
      </Section>
    </div>
  );
}

// ─── TALLY HUB (entry to export + import) ───────────────────────────────────

function TallyHubScreen({ isMobile, onBack, onExport, onImport }){
  const {theme:T} = useTheme();
  return(
    <div style={{padding:isMobile?'14px 14px 100px':'24px 28px',maxWidth:880,margin:'0 auto'}}>
      <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:18}}>
        <IconButton onClick={onBack} variant="surface" label="Back">{ICONS.chevL()}</IconButton>
        <div>
          <h1 style={{...typo('h1'),color:T.text,margin:0}}>Tally</h1>
          <p style={{...typo('bodySm'),color:T.textMuted,margin:'4px 0 0'}}>CA ko data bhejo ya laao</p>
        </div>
      </div>

      <Card style={{marginBottom:14,background:C.primarySoft,border:`1px solid ${C.primary}33`}} padding={16}>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <span style={{fontSize:24}}>💡</span>
          <div>
            <p style={{...typo('body'),color:C.primaryDark,fontWeight:700,margin:0}}>Quarter end aa raha hai</p>
            <p style={{...typo('caption'),color:C.primaryDark,opacity:0.7,marginTop:2}}>Q1 FY27 ka Tally file CA ko bhejo</p>
          </div>
        </div>
      </Card>

      <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr':'1fr 1fr',gap:14}}>
        <button onClick={onExport} style={{
          padding:isMobile?20:28, borderRadius:RADIUS.lg,border:`1px solid ${T.border}`,
          background:T.surface, cursor:'pointer', textAlign:'left',
          color:T.text, transition:'all 0.15s',
        }}
        onMouseEnter={e=>e.currentTarget.style.borderColor=C.primary}
        onMouseLeave={e=>e.currentTarget.style.borderColor=T.border}>
          <div style={{width:48,height:48,borderRadius:14,background:C.primarySoft,color:C.primary,display:'flex',alignItems:'center',justifyContent:'center',marginBottom:14}}>{ICONS.download()}</div>
          <h2 style={{...typo('h2'),color:T.text,margin:0,marginBottom:4}}>Tally ko Bhejo</h2>
          <p style={{...typo('bodySm'),color:T.textMuted,marginBottom:10}}>Sales, purchases, payments, ledgers — sab Tally XML mein convert karke CA ko bhej do.</p>
          <span style={{...typo('label'),color:C.primary,fontWeight:700}}>Export start karo →</span>
        </button>

        <button onClick={onImport} style={{
          padding:isMobile?20:28, borderRadius:RADIUS.lg,border:`1px solid ${T.border}`,
          background:T.surface, cursor:'pointer', textAlign:'left',
          color:T.text, transition:'all 0.15s',
        }}
        onMouseEnter={e=>e.currentTarget.style.borderColor=C.positive}
        onMouseLeave={e=>e.currentTarget.style.borderColor=T.border}>
          <div style={{width:48,height:48,borderRadius:14,background:C.positiveSoft,color:C.positive,display:'flex',alignItems:'center',justifyContent:'center',marginBottom:14}}>{ICONS.upload()}</div>
          <h2 style={{...typo('h2'),color:T.text,margin:0,marginBottom:4}}>Tally se Laao</h2>
          <p style={{...typo('bodySm'),color:T.textMuted,marginBottom:10}}>Purana Tally data ek baar import karo — sab vouchers, parties, balances aa jayenge.</p>
          <span style={{...typo('label'),color:C.positive,fontWeight:700}}>Import start karo →</span>
        </button>
      </div>

      <Section title="Recent Exports" style={{marginTop:24}}>
        <Card padding={0}>
          {[
            {date:'15 Apr 2026', period:'FY 2025-26', count:284, sent:'pradeep@ca.com'},
            {date:'15 Jan 2026', period:'Q3 FY26',    count:142, sent:'pradeep@ca.com'},
            {date:'15 Oct 2025', period:'Q2 FY26',    count:118, sent:'pradeep@ca.com'},
          ].map((e,i,arr)=>(
            <div key={i} style={{display:'flex',alignItems:'center',gap:12,padding:'14px 18px',borderBottom:i<arr.length-1?`1px solid ${T.divider}`:'none'}}>
              <div style={{width:36,height:36,borderRadius:10,background:T.surfaceAlt,color:T.textMuted,display:'flex',alignItems:'center',justifyContent:'center'}}>{ICONS.tally()}</div>
              <div style={{flex:1}}>
                <p style={{...typo('body'),fontWeight:600,color:T.text,margin:0}}>{e.period}</p>
                <p style={{...typo('caption'),color:T.textMuted,margin:'2px 0 0'}}>{e.count} vouchers · sent to {e.sent}</p>
              </div>
              <span style={{...typo('caption'),color:T.textMuted}}>{e.date}</span>
              <IconButton variant="surface" label="Download">{ICONS.download()}</IconButton>
            </div>
          ))}
        </Card>
      </Section>
    </div>
  );
}

// ─── TALLY IMPORT FLOW ───────────────────────────────────────────────────────

function TallyImportScreen({ isMobile, onBack }){
  const {theme:T} = useTheme();
  const [step, setStep] = React.useState(1);
  const [importing, setImporting] = React.useState(false);
  const [done, setDone] = React.useState(false);

  return(
    <div style={{padding:isMobile?'14px 14px 100px':'24px 28px',maxWidth:720,margin:'0 auto'}}>
      <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:18}}>
        <IconButton onClick={onBack} variant="surface" label="Back">{ICONS.chevL()}</IconButton>
        <div>
          <p style={{...typo('caption'),color:C.positive,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.4px'}}>Tally Import</p>
          <h1 style={{...typo('h1'),color:T.text,margin:0}}>Tally se Laao</h1>
        </div>
      </div>

      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:24}}>
        {[1,2,3].map(i=>(
          <React.Fragment key={i}>
            <div style={{
              width:32,height:32,borderRadius:'50%',
              background: step>=i?C.positive:T.surfaceAlt,
              color: step>=i?'#fff':T.textMuted,
              display:'flex',alignItems:'center',justifyContent:'center',
              ...typo('caption'),fontWeight:700,
            }}>{step>i ? ICONS.check() : i}</div>
            {i<3 && <div style={{flex:1,height:2,background:step>i?C.positive:T.surfaceAlt}}/>}
          </React.Fragment>
        ))}
      </div>

      {done ? (
        <Card padding={28} style={{textAlign:'center'}}>
          <div style={{width:64,height:64,borderRadius:'50%',background:C.positiveSoft,color:C.positive,display:'inline-flex',alignItems:'center',justifyContent:'center',marginBottom:14}}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <h2 style={{...typo('h2'),color:T.text,marginBottom:6}}>Ho gaya ✓</h2>
          <p style={{...typo('body'),color:T.textMuted,marginBottom:18}}>1,420 vouchers add ho gaye. 12 duplicates skip kiye.</p>
          <Button onClick={onBack}>Dashboard pe Wapas</Button>
        </Card>
      ) : step===1 ? (
        <Card padding={isMobile?20:24}>
          <h2 style={{...typo('h2'),color:T.text,marginBottom:6}}>Tally file upload karo</h2>
          <p style={{...typo('bodySm'),color:T.textMuted,marginBottom:18}}>Tally se export ki hui .xml file choose karo.</p>
          <div style={{
            border:`2px dashed ${T.border}`,borderRadius:RADIUS.md,
            padding:'40px 18px',textAlign:'center',background:T.surfaceAlt,
          }}>
            <div style={{width:52,height:52,borderRadius:14,background:T.surface,color:T.textMuted,display:'inline-flex',alignItems:'center',justifyContent:'center',marginBottom:12}}>{ICONS.upload()}</div>
            <p style={{...typo('body'),color:T.text,fontWeight:600,marginBottom:4}}>XML file yahaan drop karo</p>
            <p style={{...typo('caption'),color:T.textMuted,marginBottom:14}}>Max 10 MB</p>
            <Button variant="secondary" icon={ICONS.upload()}>Choose File</Button>
          </div>
          <Card padding={14} style={{background:T.surfaceAlt,marginTop:14}}>
            <p style={{...typo('caption'),color:T.textMuted,marginBottom:6,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.3px'}}>Tally se export kaise karte hain?</p>
            <p style={{...typo('caption'),color:T.text,marginBottom:0}}>
              Tally Prime: <strong>Gateway of Tally → Display More Reports → Day Book → Alt+E (Export)</strong> → Format <strong>XML</strong> → Save
            </p>
          </Card>
        </Card>
      ) : step===2 ? (
        <Card padding={isMobile?20:24}>
          <h2 style={{...typo('h2'),color:T.text,marginBottom:6}}>Yeh sab milega</h2>
          <p style={{...typo('bodySm'),color:T.textMuted,marginBottom:18}}>Review karke confirm karo.</p>
          <div style={{display:'flex',flexDirection:'column',gap:8,marginBottom:14}}>
            {[
              {l:'Sales vouchers',    n:800,  v:1520000},
              {l:'Purchase vouchers', n:420,  v:840000},
              {l:'Receipts',          n:380,  v:1410000},
              {l:'Payments',          n:220,  v:620000},
              {l:'Parties',           n:124,  v:null},
              {l:'Ledgers',           n:18,   v:null},
            ].map(r=>(
              <div key={r.l} style={{display:'flex',justifyContent:'space-between',padding:'10px 14px',borderRadius:RADIUS.md,background:T.surfaceAlt}}>
                <span style={{...typo('body'),color:T.text,fontWeight:600}}>{r.l}</span>
                <span style={{...typo('body'),color:T.text,fontFamily:FONT,fontWeight:700,fontVariantNumeric:'tabular-nums'}}>
                  {r.n}{r.v?` · ${fmtFull(r.v)}`:''}
                </span>
              </div>
            ))}
          </div>
          <Card padding={14} style={{background:C.warningSoft,border:`1px solid ${C.warning}33`,marginBottom:6}}>
            <p style={{...typo('bodySm'),color:C.warning,fontWeight:600}}>⚠ 12 duplicates skip honge (already imported)</p>
            <p style={{...typo('caption'),color:C.warning,marginTop:2}}>⚠ 3 unbalanced entries flagged for review</p>
          </Card>
        </Card>
      ) : (
        <Card padding={isMobile?20:24}>
          <h2 style={{...typo('h2'),color:T.text,marginBottom:6}}>Import ho raha hai</h2>
          <p style={{...typo('bodySm'),color:T.textMuted,marginBottom:18}}>Ruko, kuch second lagega...</p>
          {!importing && (
            <Button onClick={async()=>{
              setImporting(true);
              await new Promise(r=>setTimeout(r,1500));
              setImporting(false);
              setDone(true);
            }} fullWidth size="lg" icon={ICONS.check()}>Import Sab Kuch</Button>
          )}
          {importing && (
            <div style={{padding:'24px',textAlign:'center'}}>
              <Spinner color={C.primary} size={32}/>
              <p style={{...typo('body'),color:T.text,marginTop:14,fontWeight:600}}>Vouchers process ho rahe hain...</p>
              <p style={{...typo('caption'),color:T.textMuted,marginTop:4}}>Yeh 10-15 second lagega</p>
            </div>
          )}
        </Card>
      )}

      {!done && !importing && (
        <div style={{display:'flex',gap:10,marginTop:18}}>
          {step>1 && <Button onClick={()=>setStep(step-1)} variant="secondary" icon={ICONS.chevL()}>Wapas</Button>}
          <div style={{flex:1}}/>
          {step<3 && <Button onClick={()=>setStep(step+1)}>Aage Badho →</Button>}
        </div>
      )}
    </div>
  );
}

function Spinner({color='#fff', size=18}){
  return(
    <span style={{
      width:size,height:size,borderRadius:'50%',
      border:`${Math.max(2,size/8)}px solid ${color}33`,borderTopColor:color,
      animation:'spin 0.7s linear infinite',display:'inline-block',
    }}/>
  );
}

Object.assign(window, { LoginScreen, SettingsScreen, ReportsScreen, TallyHubScreen, TallyImportScreen, Spinner });
