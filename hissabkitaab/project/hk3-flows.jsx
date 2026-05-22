
// hk3-flows.jsx — Onboarding wizard, Tally Export, Tally Import, Bank Reconcile

const { useTheme, useIsMobile, Card, Button, IconButton, Input, Select, Chip, Avatar, Sheet, EmptyState, Section,
  C, FONT, MONO, TYPE, typo, RADIUS, fmt, fmtFull,
  USER, PARTIES, BILLS, PAYMENTS, ITEMS, BANK_ACCOUNTS, ICONS, Logo } = window;

// ─── ONBOARDING WIZARD ──────────────────────────────────────────────────────

function OnboardingWizard({ onComplete, isMobile }){
  const {theme:T, toggleTheme} = useTheme();
  const [step, setStep] = React.useState(1);
  const [data, setData] = React.useState({
    businessName: '', businessType: 'Retail', state: 'Maharashtra', city: '',
    gstin: '', pan: '',
    bankAccounts: [],
    parties: [],
    items: [],
    caName: '', caEmail: '', caPhone: '',
  });

  const total = 7;
  const upd = (k,v) => setData(p => ({...p,[k]:v}));

  const stepTitles = [
    'Apna karobaar shuru karo',
    'GSTIN add karo',
    'Bank account jodo',
    'Customers / Suppliers',
    'Items / Saman',
    'CA ka contact',
    'Sab kuch sahi hai?',
  ];

  return(
    <div style={{minHeight:'100vh',background:T.bg,fontFamily:FONT,color:T.text,display:'flex',flexDirection:'column'}}>
      {/* Header */}
      <header style={{padding:'18px 20px',display:'flex',alignItems:'center',gap:10,borderBottom:`1px solid ${T.border}`}}>
        <Logo size={32}/>
        <span style={{...typo('h3'),color:T.text,letterSpacing:'-0.3px'}}>HisaabKitaab</span>
        <div style={{flex:1}}/>
        <IconButton onClick={toggleTheme} label="Toggle theme">{T.id==='dark'?ICONS.sun():ICONS.moon()}</IconButton>
      </header>

      {/* Progress bar */}
      <div style={{padding:isMobile?'14px 16px':'18px 28px',background:T.surface,borderBottom:`1px solid ${T.border}`}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',marginBottom:8}}>
          <span style={{...typo('caption'),color:T.textMuted,fontWeight:600}}>Step {step} of {total}</span>
          <span style={{...typo('caption'),color:T.textMuted}}>{Math.round((step/total)*100)}% complete</span>
        </div>
        <div style={{height:6,background:T.surfaceAlt,borderRadius:3,overflow:'hidden'}}>
          <div style={{height:'100%',background:C.primary,width:`${(step/total)*100}%`,transition:'width 0.3s ease'}}/>
        </div>
      </div>

      {/* Step content */}
      <div style={{flex:1,overflowY:'auto',padding:isMobile?'24px 16px':'40px 28px'}}>
        <div style={{maxWidth:520,margin:'0 auto'}}>
          <p style={{...typo('caption'),color:C.primary,fontWeight:700,marginBottom:6,textTransform:'uppercase',letterSpacing:'0.4px',whiteSpace:'nowrap'}}>Step {step} of {total}</p>
          <h1 style={{...typo('h1'),color:T.text,marginBottom:24}}>{stepTitles[step-1]}</h1>

          {step===1 && (
            <div style={{display:'flex',flexDirection:'column',gap:14}}>
              <Input label="Business ka naam" value={data.businessName} onChange={v=>upd('businessName',v)} placeholder="Sharma Cloth Store" required autoFocus/>
              <Select label="Business kya karta hai?" value={data.businessType} onChange={v=>upd('businessType',v)}
                options={['Retail','Wholesale','Manufacturing','Service','Other']} required/>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                <Select label="State" value={data.state} onChange={v=>upd('state',v)} required
                  options={['Maharashtra','Karnataka','Tamil Nadu','Gujarat','Delhi','Uttar Pradesh','West Bengal']}/>
                <Input label="City" value={data.city} onChange={v=>upd('city',v)} placeholder="Mumbai"/>
              </div>
              <p style={{...typo('caption'),color:T.textMuted,marginTop:6,padding:'10px 12px',borderRadius:RADIUS.md,background:T.surfaceAlt}}>
                💡 Bas itna kaafi hai. <strong>Baaki sab (GSTIN, bank, items) baad mein add kar sakte ho</strong> — niche "Skip — Start using app" dabao seedha dashboard pe jaane ke liye.
              </p>
            </div>
          )}

          {step===2 && (
            <div style={{display:'flex',flexDirection:'column',gap:14}}>
              <Input label="GSTIN" value={data.gstin} onChange={v=>upd('gstin',v.toUpperCase())} placeholder="27AAAAA0000A1Z5" hint="15 character GSTIN. Skip kar sakte ho." optional/>
              <Button variant="secondary" disabled={!data.gstin}>Verify GSTIN</Button>
              <Input label="PAN" value={data.pan} onChange={v=>upd('pan',v.toUpperCase())} placeholder="AAAAA0000A" optional/>
              <p style={{...typo('bodySm'),color:T.textMuted,padding:'12px 14px',borderRadius:RADIUS.md,background:T.surfaceAlt}}>
                💡 GSTIN diye bina bhi app chal sakta hai, lekin invoices par GST nahi aayega.
              </p>
            </div>
          )}

          {step===3 && (
            <div>
              <div style={{display:'flex',flexDirection:'column',gap:10,marginBottom:14}}>
                {data.bankAccounts.map((acc,i)=>(
                  <Card key={i} padding={14}>
                    <div style={{display:'flex',alignItems:'center',gap:10}}>
                      <div style={{width:36,height:36,borderRadius:10,background:C.infoSoft,color:C.info,display:'flex',alignItems:'center',justifyContent:'center'}}>{ICONS.bank()}</div>
                      <div style={{flex:1}}>
                        <p style={{...typo('body'),fontWeight:700,margin:0}}>{acc.bank}</p>
                        <p style={{...typo('caption'),color:T.textMuted,margin:0}}>****{acc.last4} · {acc.type}</p>
                      </div>
                      <IconButton onClick={()=>upd('bankAccounts',data.bankAccounts.filter((_,j)=>j!==i))} label="Remove">{ICONS.trash()}</IconButton>
                    </div>
                  </Card>
                ))}
              </div>
              <BankAccountForm onAdd={(acc)=>upd('bankAccounts',[...data.bankAccounts,acc])} T={T}/>
              <p style={{...typo('bodySm'),color:T.textMuted,padding:'12px 14px',borderRadius:RADIUS.md,background:T.surfaceAlt,marginTop:14}}>
                💡 Account jodo to bank statement upload karke reconcile kar sakte ho.
              </p>
            </div>
          )}

          {step===4 && (
            <div>
              <div style={{display:'flex',gap:10,marginBottom:16,flexWrap:'wrap'}}>
                <Button variant="secondary" icon={ICONS.plus()} style={{flex:1,minWidth:160}}>Manually Jodo</Button>
                <Button variant="secondary" icon={ICONS.tally()} style={{flex:1,minWidth:160}}>Tally se Import</Button>
              </div>
              <Card padding={20} style={{textAlign:'center'}}>
                <div style={{display:'inline-flex',width:48,height:48,borderRadius:RADIUS.md,background:T.surfaceAlt,color:T.textMuted,alignItems:'center',justifyContent:'center',marginBottom:12}}>{ICONS.parties()}</div>
                <p style={{...typo('body'),fontWeight:600,color:T.text,marginBottom:4}}>Abhi tak koi party nahi</p>
                <p style={{...typo('bodySm'),color:T.textMuted}}>Customer aur supplier add karo, ya skip karke baad mein add karo.</p>
              </Card>
            </div>
          )}

          {step===5 && (
            <div>
              <div style={{display:'flex',gap:10,marginBottom:16,flexWrap:'wrap'}}>
                <Button variant="secondary" icon={ICONS.plus()} style={{flex:1,minWidth:160}}>Manually Jodo</Button>
                <Button variant="secondary" icon={ICONS.upload()} style={{flex:1,minWidth:160}}>CSV Upload</Button>
              </div>
              <Card padding={14} style={{background:T.surfaceAlt,marginBottom:14}}>
                <p style={{...typo('caption'),color:T.textMuted,fontWeight:600,marginBottom:6,fontFamily:MONO}}>CSV format:</p>
                <pre style={{...typo('caption'),fontFamily:MONO,color:T.text,margin:0,whiteSpace:'pre-wrap'}}>{`name, hsnCode, unit, rate, taxRate
Cotton Fabric, 5208, METRES, 180, 5
Silk Thread, 5403, METRES, 450, 12`}</pre>
              </Card>
            </div>
          )}

          {step===6 && (
            <div style={{display:'flex',flexDirection:'column',gap:14}}>
              <Input label="CA ka naam" value={data.caName} onChange={v=>upd('caName',v)} placeholder="Pradeep Sharma" optional/>
              <Input label="Email" type="email" value={data.caEmail} onChange={v=>upd('caEmail',v)} placeholder="pradeep@example.com" optional/>
              <Input label="Phone" type="tel" value={data.caPhone} onChange={v=>upd('caPhone',v)} placeholder="98765-12345" optional/>
              <p style={{...typo('bodySm'),color:T.textMuted,padding:'12px 14px',borderRadius:RADIUS.md,background:T.surfaceAlt}}>
                💡 Tally file bhejte waqt CA ka contact auto-fill ho jayega.
              </p>
            </div>
          )}

          {step===7 && (
            <Card padding={isMobile?20:28}>
              <h3 style={{...typo('h2'),color:T.text,marginBottom:18}}>Confirm karo</h3>
              <div style={{display:'flex',flexDirection:'column',gap:12}}>
                {[
                  {l:'Business name', v:data.businessName||'—'},
                  {l:'Business type', v:data.businessType},
                  {l:'State',         v:data.state},
                  {l:'GSTIN',         v:data.gstin||'Skipped'},
                  {l:'Bank accounts', v:`${data.bankAccounts.length} added`},
                  {l:'Parties',       v:`${data.parties.length} added`},
                  {l:'Items',         v:`${data.items.length} added`},
                  {l:'CA contact',    v:data.caName||'Skipped'},
                ].map(r=>(
                  <div key={r.l} style={{display:'flex',justifyContent:'space-between',padding:'8px 0',borderBottom:`1px solid ${T.divider}`}}>
                    <span style={{...typo('bodySm'),color:T.textMuted}}>{r.l}</span>
                    <span style={{...typo('bodySm'),color:T.text,fontWeight:600}}>{r.v}</span>
                  </div>
                ))}
              </div>
              <p style={{...typo('bodySm'),color:T.textMuted,marginTop:18,padding:'12px 14px',borderRadius:RADIUS.md,background:T.surfaceAlt}}>
                💡 Sab kuch baad mein Settings mein edit kar sakte ho. Chinta mat karo!
              </p>
            </Card>
          )}
        </div>
      </div>

      {/* Footer */}
      <footer style={{
        padding:isMobile?'14px 16px':'18px 28px',
        background:T.surface, borderTop:`1px solid ${T.border}`,
        display:'flex',gap:10,
      }}>
        <Button onClick={()=>setStep(Math.max(1,step-1))} variant="secondary" disabled={step===1} icon={ICONS.chevL()}>Wapas</Button>
        {step>=2 && step<=6 && <Button variant="ghost" onClick={()=>setStep(step+1)}>Skip</Button>}
        {step===1 && data.businessName && <Button variant="ghost" onClick={onComplete}>Skip — Start using app</Button>}
        <div style={{flex:1}}/>
        {step<total ? (
          <Button onClick={()=>setStep(step+1)} disabled={step===1 && !data.businessName}>Aage Badho →</Button>
        ) : (
          <Button onClick={onComplete} icon={ICONS.check()} variant="success">Karobaar Shuru Karo</Button>
        )}
      </footer>
    </div>
  );
}

function BankAccountForm({onAdd, T}){
  const [bank, setBank]=React.useState('HDFC Bank');
  const [last4, setLast4]=React.useState('');
  const [type, setType]=React.useState('CURRENT');
  return(
    <Card padding={14}>
      <p style={{...typo('label'),color:T.text,marginBottom:10,fontWeight:700}}>+ Naya account</p>
      <div style={{display:'flex',flexDirection:'column',gap:10}}>
        <Select label="Bank" value={bank} onChange={setBank}
          options={['HDFC Bank','SBI','ICICI Bank','Axis Bank','Kotak Mahindra','PNB','Bank of Baroda','Other']}/>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
          <Input label="Last 4 digits" value={last4} onChange={setLast4} placeholder="4567"/>
          <Select label="Type" value={type} onChange={setType} options={['CURRENT','SAVINGS']}/>
        </div>
        <Button onClick={()=>{onAdd({bank,last4,type}); setLast4('');}} disabled={!last4 || last4.length!==4} variant="secondary" icon={ICONS.plus()} fullWidth>Add</Button>
      </div>
    </Card>
  );
}

// ─── TALLY EXPORT FLOW ──────────────────────────────────────────────────────

function TallyExportScreen({ isMobile, onBack }){
  const {theme:T} = useTheme();
  const [step, setStep] = React.useState(1);
  const [period, setPeriod] = React.useState('FY');
  const [include, setInclude] = React.useState({
    sales:true, purchases:true, receipts:true, payments:true, ledgers:true, journals:false,
  });
  const [generating, setGenerating] = React.useState(false);
  const [done, setDone] = React.useState(false);

  // Mock counts
  const counts = {
    sales:    {n:124, v:1240000},
    purchases:{n:38,  v:420000},
    receipts: {n:88,  v:1010000},
    payments: {n:42,  v:380000},
    ledgers:  {n:24,  v:null},
    journals: {n:2,   v:null},
  };

  async function generate(method){
    setGenerating(true);
    await new Promise(r=>setTimeout(r,1200));
    setGenerating(false);
    setDone(true);
  }

  return(
    <div style={{padding:isMobile?'14px 14px 100px':'24px 28px',maxWidth:720,margin:'0 auto'}}>
      <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:18}}>
        <IconButton onClick={onBack} variant="surface" label="Back">{ICONS.chevL()}</IconButton>
        <div style={{flex:1}}>
          <p style={{...typo('caption'),color:C.primary,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.4px'}}>Tally Export</p>
          <h1 style={{...typo('h1'),color:T.text,margin:0}}>Tally ko Bhejo</h1>
        </div>
      </div>

      {/* Stepper */}
      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:24}}>
        {[1,2,3].map(i=>(
          <React.Fragment key={i}>
            <div style={{
              width:32,height:32,borderRadius:'50%',
              background: step>=i?C.primary:T.surfaceAlt,
              color: step>=i?'#fff':T.textMuted,
              display:'flex',alignItems:'center',justifyContent:'center',
              ...typo('caption'),fontWeight:700,
            }}>{step>i ? <span>{ICONS.check()}</span> : i}</div>
            {i<3 && <div style={{flex:1,height:2,background:step>i?C.primary:T.surfaceAlt}}/>}
          </React.Fragment>
        ))}
      </div>

      {done ? (
        <Card padding={28} style={{textAlign:'center'}}>
          <div style={{width:64,height:64,borderRadius:'50%',background:C.positiveSoft,color:C.positive,display:'inline-flex',alignItems:'center',justifyContent:'center',marginBottom:14}}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <h2 style={{...typo('h2'),color:T.text,marginBottom:6}}>Ho gaya ✓</h2>
          <p style={{...typo('body'),color:T.textMuted,marginBottom:18}}>Tally file ban gayi. CA ko bhej do.</p>
          <Card padding={14} style={{background:T.surfaceAlt,textAlign:'left',marginBottom:16}}>
            <p style={{...typo('caption'),color:T.textMuted,fontFamily:MONO,marginBottom:2}}>FILE</p>
            <p style={{...typo('body'),color:T.text,fontFamily:MONO,fontWeight:600}}>HisaabKitaab-sharma-cloth-store-2025-2026.xml</p>
            <p style={{...typo('caption'),color:T.textMuted,marginTop:4}}>284 vouchers · 2.4 MB</p>
          </Card>
          <div style={{display:'flex',gap:10,justifyContent:'center',flexWrap:'wrap'}}>
            <Button variant="secondary" icon={ICONS.download()}>Download Again</Button>
            <Button onClick={onBack}>Dashboard pe Wapas</Button>
          </div>
        </Card>
      ) : step===1 ? (
        <Card padding={isMobile?20:24}>
          <h2 style={{...typo('h2'),color:T.text,marginBottom:6}}>Kaunsa period?</h2>
          <p style={{...typo('bodySm'),color:T.textMuted,marginBottom:18}}>Tally file kis date range ke liye banana hai?</p>
          <div style={{display:'flex',flexDirection:'column',gap:8}}>
            {[
              {k:'M', label:'Is mahine',         sub:'May 2026'},
              {k:'Q', label:'Is quarter',        sub:'Q4 FY26 (Jan–Mar 2026)'},
              {k:'FY',label:'Is saal',           sub:'FY 2025–26 (Apr 2025 – Mar 2026)'},
              {k:'C', label:'Custom dates',      sub:'Apne dates choose karo'},
            ].map(o=>{
              const active = period===o.k;
              return(
                <button key={o.k} onClick={()=>setPeriod(o.k)} style={{
                  display:'flex',alignItems:'center',gap:12,padding:'14px 16px',
                  borderRadius:RADIUS.md, border:`1.5px solid ${active?C.primary:T.border}`,
                  background:active?C.primarySoft:T.surface,
                  cursor:'pointer', textAlign:'left',
                  color:T.text, transition:'all 0.15s',
                }}>
                  <div style={{
                    width:20,height:20,borderRadius:'50%',
                    border:`2px solid ${active?C.primary:T.borderStrong}`,
                    display:'flex',alignItems:'center',justifyContent:'center',
                  }}>
                    {active && <div style={{width:10,height:10,borderRadius:'50%',background:C.primary}}/>}
                  </div>
                  <div style={{flex:1}}>
                    <p style={{...typo('body'),fontWeight:600,color:T.text,margin:0}}>{o.label}</p>
                    <p style={{...typo('caption'),color:T.textMuted,margin:'2px 0 0'}}>{o.sub}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </Card>
      ) : step===2 ? (
        <Card padding={isMobile?20:24}>
          <h2 style={{...typo('h2'),color:T.text,marginBottom:6}}>Kya kya include karna hai?</h2>
          <p style={{...typo('bodySm'),color:T.textMuted,marginBottom:18}}>Numbers verify karke aage badho.</p>
          <div style={{display:'flex',flexDirection:'column',gap:6}}>
            {[
              {k:'sales',     l:'Sales bills'},
              {k:'purchases', l:'Purchase bills'},
              {k:'receipts',  l:'Receipts (incoming)'},
              {k:'payments',  l:'Payments out'},
              {k:'ledgers',   l:'Party balances'},
              {k:'journals',  l:'Manual journals'},
            ].map(item=>{
              const checked = include[item.k];
              const c = counts[item.k];
              return(
                <button key={item.k} onClick={()=>setInclude({...include,[item.k]:!checked})} style={{
                  display:'flex',alignItems:'center',gap:12,padding:'12px 14px',
                  borderRadius:RADIUS.md,border:`1px solid ${T.border}`,
                  background:T.surface,cursor:'pointer',textAlign:'left',
                  color:T.text,transition:'all 0.15s',
                }}>
                  <div style={{
                    width:22,height:22,borderRadius:6,
                    border:`2px solid ${checked?C.primary:T.borderStrong}`,
                    background: checked?C.primary:'transparent',
                    color:'#fff',
                    display:'flex',alignItems:'center',justifyContent:'center',
                  }}>{checked && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}</div>
                  <div style={{flex:1}}>
                    <p style={{...typo('body'),color:T.text,margin:0,fontWeight:600}}>{item.l}</p>
                    <p style={{...typo('caption'),color:T.textMuted,margin:'2px 0 0'}}>
                      {c.n} {c.n===1?'entry':'entries'}{c.v?` · ${fmtFull(c.v)}`:''}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </Card>
      ) : (
        <Card padding={isMobile?20:24}>
          <h2 style={{...typo('h2'),color:T.text,marginBottom:6}}>Kaise bhejna hai?</h2>
          <p style={{...typo('bodySm'),color:T.textMuted,marginBottom:18}}>File teen tareeke se bhej sakte ho.</p>
          <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr':'repeat(3,1fr)',gap:10}}>
            {[
              {label:'Download',  sub:'XML file phone par', icon:ICONS.download(), color:T.text, action:()=>generate('download')},
              {label:'Email CA',  sub:'pradeep@example.com', icon:ICONS.share(),   color:C.info,  action:()=>generate('email')},
              {label:'WhatsApp',  sub:'98765-12345',         icon:ICONS.whatsapp(),color:C.positive,action:()=>generate('wa')},
            ].map(o=>(
              <button key={o.label} onClick={o.action} disabled={generating} style={{
                padding:'18px',borderRadius:RADIUS.md,
                border:`1.5px solid ${T.border}`,background:T.surface,
                cursor:generating?'not-allowed':'pointer',
                display:'flex',flexDirection:'column',alignItems:'center',gap:8,
                color:T.text,transition:'all 0.15s',
              }}>
                <div style={{width:48,height:48,borderRadius:14,background:T.surfaceAlt,color:o.color,display:'flex',alignItems:'center',justifyContent:'center'}}>{o.icon}</div>
                <p style={{...typo('body'),fontWeight:700,color:T.text,margin:0}}>{o.label}</p>
                <p style={{...typo('caption'),color:T.textMuted,margin:0}}>{o.sub}</p>
              </button>
            ))}
          </div>
          {generating && (
            <div style={{marginTop:18,padding:'14px',borderRadius:RADIUS.md,background:T.surfaceAlt,display:'flex',alignItems:'center',gap:10}}>
              <Spinner color={C.primary}/>
              <span style={{...typo('bodySm'),color:T.text}}>Tally file ban raha hai...</span>
            </div>
          )}
        </Card>
      )}

      {!done && (
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
      border:`2.5px solid ${color}33`,borderTopColor:color,
      animation:'spin 0.7s linear infinite',display:'inline-block',
    }}/>
  );
}

// ─── BANK RECONCILE FLOW ────────────────────────────────────────────────────

function ReconcileScreen({ isMobile, onBack }){
  const {theme:T} = useTheme();
  const [step, setStep] = React.useState(1);
  const [account, setAccount] = React.useState('ba1');
  const [reviewing, setReviewing] = React.useState(0);
  const [decisions, setDecisions] = React.useState({});

  // Mock parsed rows
  const unmatched = [
    {id:'r1', date:'15 May', amount:12000,  type:'CREDIT', desc:'UPI/RAMESH/RAMESHCLOTH@OKICICI/UTR123'},
    {id:'r2', date:'14 May', amount:8500,   type:'DEBIT',  desc:'NEFT/PATEL TEXTILES/SURAT/UTR789'},
    {id:'r3', date:'13 May', amount:25000,  type:'CREDIT', desc:'IMPS/SHARMA ELEC/MUMBAI/UTR456'},
    {id:'r4', date:'12 May', amount:3200,   type:'DEBIT',  desc:'ELECTRICITY BILL MSEB MUMBAI'},
  ];

  function decide(rowId, action){
    setDecisions({...decisions, [rowId]:action});
    if(reviewing < unmatched.length-1) setReviewing(reviewing+1);
  }

  const allReviewed = Object.keys(decisions).length === unmatched.length;

  return(
    <div style={{padding:isMobile?'14px 14px 100px':'24px 28px',maxWidth:720,margin:'0 auto'}}>
      <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:18}}>
        <IconButton onClick={onBack} variant="surface" label="Back">{ICONS.chevL()}</IconButton>
        <div style={{flex:1}}>
          <p style={{...typo('caption'),color:C.primary,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.4px'}}>Bank Reconcile</p>
          <h1 style={{...typo('h1'),color:T.text,margin:0}}>Bank Statement Match</h1>
        </div>
      </div>

      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:24}}>
        {[1,2,3].map(i=>(
          <React.Fragment key={i}>
            <div style={{
              width:32,height:32,borderRadius:'50%',
              background: step>=i?C.primary:T.surfaceAlt,
              color: step>=i?'#fff':T.textMuted,
              display:'flex',alignItems:'center',justifyContent:'center',
              ...typo('caption'),fontWeight:700,
            }}>{step>i ? ICONS.check() : i}</div>
            {i<3 && <div style={{flex:1,height:2,background:step>i?C.primary:T.surfaceAlt}}/>}
          </React.Fragment>
        ))}
      </div>

      {step===1 && (
        <Card padding={isMobile?20:24}>
          <h2 style={{...typo('h2'),color:T.text,marginBottom:6}}>Bank statement upload karo</h2>
          <p style={{...typo('bodySm'),color:T.textMuted,marginBottom:18}}>Net banking se CSV download karo aur upload karo.</p>
          <div style={{display:'flex',flexDirection:'column',gap:14}}>
            <Select label="Bank account" value={account} onChange={setAccount}
              options={BANK_ACCOUNTS.map(a=>({value:a.id, label:`${a.bank} · ****${a.last4} (${a.type})`}))} required/>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
              <Input label="From date" type="date" value="2026-05-01" onChange={()=>{}}/>
              <Input label="To date" type="date" value="2026-05-15" onChange={()=>{}}/>
            </div>
            <div style={{
              border:`2px dashed ${T.border}`,borderRadius:RADIUS.md,
              padding:'32px 18px',textAlign:'center',background:T.surfaceAlt,
            }}>
              <div style={{width:48,height:48,borderRadius:RADIUS.md,background:T.surface,color:T.textMuted,display:'inline-flex',alignItems:'center',justifyContent:'center',marginBottom:10}}>{ICONS.upload()}</div>
              <p style={{...typo('body'),color:T.text,fontWeight:600,marginBottom:4}}>CSV file yahaan drop karo</p>
              <p style={{...typo('caption'),color:T.textMuted,marginBottom:14}}>Date, Description, Debit, Credit, Balance</p>
              <Button variant="secondary" icon={ICONS.upload()}>Choose File</Button>
            </div>
            <p style={{...typo('caption'),color:T.textLight,textAlign:'center'}}>Supported: SBI · HDFC · ICICI · Axis · Kotak · PNB · BoB · Generic CSV</p>
          </div>
        </Card>
      )}

      {step===2 && (
        <Card padding={isMobile?20:24}>
          <h2 style={{...typo('h2'),color:T.text,marginBottom:6}}>Parse complete</h2>
          <p style={{...typo('bodySm'),color:T.textMuted,marginBottom:18}}>142 transactions mil gaye. Kuch help chahiye thi.</p>
          <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr':'1fr 1fr',gap:10,marginBottom:18}}>
            <Card padding={16} style={{background:C.positiveSoft,border:`1px solid ${C.positive}33`}}>
              <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:6}}>
                <span style={{color:C.positive}}>{ICONS.check()}</span>
                <span style={{...typo('label'),color:C.positive,fontWeight:700}}>Auto-matched</span>
              </div>
              <p style={{fontFamily:FONT,fontWeight:700,fontSize:32,color:C.positive,letterSpacing:'-0.6px'}}>118</p>
              <p style={{...typo('caption'),color:C.positive}}>83% — perfect</p>
            </Card>
            <Card padding={16} style={{background:C.warningSoft,border:`1px solid ${C.warning}33`}}>
              <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:6}}>
                <span style={{color:C.warning}}>{ICONS.alert()}</span>
                <span style={{...typo('label'),color:C.warning,fontWeight:700}}>Need your help</span>
              </div>
              <p style={{fontFamily:FONT,fontWeight:700,fontSize:32,color:C.warning,letterSpacing:'-0.6px'}}>{unmatched.length}</p>
              <p style={{...typo('caption'),color:C.warning}}>Categorize karo</p>
            </Card>
          </div>
        </Card>
      )}

      {step===3 && !allReviewed && (
        <Card padding={isMobile?18:22}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
            <h2 style={{...typo('h2'),color:T.text,margin:0}}>Categorize karo</h2>
            <span style={{...typo('caption'),color:T.textMuted}}>{reviewing+1} of {unmatched.length}</span>
          </div>

          {unmatched.slice(reviewing,reviewing+1).map(row=>(
            <div key={row.id}>
              <div style={{padding:'16px',borderRadius:RADIUS.md,background:T.surfaceAlt,marginBottom:16}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
                  <Chip tone={row.type==='CREDIT'?'positive':'negative'}>{row.type==='CREDIT'?'CREDIT':'DEBIT'}</Chip>
                  <span style={{...typo('caption'),color:T.textMuted}}>{row.date} 2026</span>
                </div>
                <p style={{fontFamily:FONT,fontWeight:800,fontSize:24,color:row.type==='CREDIT'?C.positive:C.negative,margin:'8px 0 4px',letterSpacing:'-0.5px',fontVariantNumeric:'tabular-nums'}}>
                  {row.type==='CREDIT'?'+':'-'}{fmtFull(row.amount)}
                </p>
                <p style={{...typo('caption'),color:T.textMuted,fontFamily:MONO,wordBreak:'break-all'}}>{row.desc}</p>
              </div>

              <p style={{...typo('label'),color:T.text,marginBottom:10,fontWeight:600}}>Yeh kya tha?</p>
              <div style={{display:'grid',gridTemplateColumns:isMobile?'repeat(2,1fr)':'repeat(5,1fr)',gap:8}}>
                {[
                  {id:'SALE',     l:'Sale',     icon:'💰', color:C.positive},
                  {id:'PURCHASE', l:'Purchase', icon:'🛒', color:C.negative},
                  {id:'EXPENSE',  l:'Expense',  icon:'💸', color:C.warning},
                  {id:'TRANSFER', l:'Transfer', icon:'🔄', color:C.info},
                  {id:'SKIP',     l:'Skip',     icon:'⏭', color:T.textMuted},
                ].map(opt=>(
                  <button key={opt.id} onClick={()=>decide(row.id,opt.id)} style={{
                    padding:'14px 10px',borderRadius:RADIUS.md,
                    border:`1.5px solid ${T.border}`,background:T.surface,cursor:'pointer',
                    display:'flex',flexDirection:'column',alignItems:'center',gap:6,
                    color:T.text,transition:'all 0.15s',
                  }}
                  onMouseEnter={e=>{e.currentTarget.style.borderColor=opt.color;e.currentTarget.style.background=opt.color+'10';}}
                  onMouseLeave={e=>{e.currentTarget.style.borderColor=T.border;e.currentTarget.style.background=T.surface;}}>
                    <span style={{fontSize:22}}>{opt.icon}</span>
                    <span style={{...typo('caption'),fontWeight:700,color:T.text}}>{opt.l}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </Card>
      )}

      {step===3 && allReviewed && (
        <Card padding={28} style={{textAlign:'center'}}>
          <div style={{width:64,height:64,borderRadius:'50%',background:C.positiveSoft,color:C.positive,display:'inline-flex',alignItems:'center',justifyContent:'center',marginBottom:14}}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <h2 style={{...typo('h2'),color:T.text,marginBottom:6}}>Reconcile ho gaya ✓</h2>
          <p style={{...typo('body'),color:T.textMuted,marginBottom:22}}>Sab match hai! Books ab bank ke saath sync hain.</p>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:18}}>
            <Card padding={14} style={{background:T.surfaceAlt}}>
              <p style={{...typo('caption'),color:T.textMuted,marginBottom:2}}>Bank ne dikhaya</p>
              <p style={{fontFamily:FONT,fontWeight:700,color:T.text,fontSize:18}}>+₹4.2L</p>
            </Card>
            <Card padding={14} style={{background:T.surfaceAlt}}>
              <p style={{...typo('caption'),color:T.textMuted,marginBottom:2}}>HK mein</p>
              <p style={{fontFamily:FONT,fontWeight:700,color:T.text,fontSize:18}}>+₹4.2L</p>
            </Card>
          </div>
          <Button onClick={onBack}>Dashboard pe Wapas</Button>
        </Card>
      )}

      {!allReviewed && (
        <div style={{display:'flex',gap:10,marginTop:18}}>
          {step>1 && <Button onClick={()=>setStep(step-1)} variant="secondary" icon={ICONS.chevL()}>Wapas</Button>}
          <div style={{flex:1}}/>
          {step<3 && <Button onClick={()=>setStep(step+1)}>Aage Badho →</Button>}
        </div>
      )}
    </div>
  );
}

Object.assign(window, { OnboardingWizard, TallyExportScreen, ReconcileScreen });
