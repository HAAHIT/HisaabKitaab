
// hk3-screens-core.jsx — Dashboard, Bills, Parties, Payments

const { useTheme, useIsMobile, Card, Button, IconButton, Input, Select, Chip, StatusChip, Avatar, Sheet, EmptyState, Section, Money, Skeleton, ErrorState,
  C, FONT, BRAND, DISPLAY, MONO, TYPE, typo, RADIUS,
  fmt, fmtFull, USER, PARTIES, BILLS, PAYMENTS, MONTHLY_TREND, ITEMS,
  getParty, getBill, dashboardSummary, waLink, telLink,
  ICONS, OverdueBanner } = window;

// ── Simulated data-fetch hook ────────────────────────────────────────────────

function useSimulatedFetch({delay=600, failChance=0}={}){
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);
  const [retryKey, setRetryKey] = React.useState(0);

  React.useEffect(()=>{
    setLoading(true);
    setError(null);
    const t = setTimeout(()=>{
      if(failChance > Math.random()){
        setError('Network connection lost. Phir try karo.');
      }
      setLoading(false);
    }, delay);
    return ()=>clearTimeout(t);
  },[retryKey]);

  return { loading, error, retry: ()=>setRetryKey(k=>k+1) };
}

// ── Reusable skeleton blocks ─────────────────────────────────────────────────

function MetricCardSkeleton({isMobile}){
  return(
    <Card padding={isMobile?14:18}>
      <Skeleton width="60%" height={12} style={{marginBottom:10}}/>
      <Skeleton width="80%" height={isMobile?20:26}/>
    </Card>
  );
}

function ListRowSkeleton(){
  const {theme:T} = useTheme();
  return(
    <div style={{display:'flex',alignItems:'center',gap:12,padding:'14px 18px',borderBottom:`1px solid ${T.divider}`}}>
      <Skeleton width={42} height={42} radius={14}/>
      <div style={{flex:1}}>
        <Skeleton width="40%" height={14} style={{marginBottom:6}}/>
        <Skeleton width="60%" height={11}/>
      </div>
      <Skeleton width={70} height={14}/>
    </div>
  );
}

// ─── DASHBOARD ───────────────────────────────────────────────────────────────

function DashboardScreen({ isMobile, onNavigate, onOpenBill, onOpenParty }){
  const {theme:T} = useTheme();
  const { loading, error, retry } = useSimulatedFetch({delay:500});
  const s = dashboardSummary();
  const recentPayments = PAYMENTS.filter(p=>p.status==='COMPLETED').slice(0,5);
  const recentBills = BILLS.slice(0,4);

  if(error){
    return(
      <div style={{padding:isMobile?'40px 14px':'48px 28px'}}>
        <ErrorState title="Dashboard load nahi ho saka" body={error} onRetry={retry}/>
      </div>
    );
  }

  if(loading){
    return(
      <div style={{padding:isMobile?'18px 14px 100px':'24px 28px'}}>
        <div style={{marginBottom:18}}>
          <Skeleton width={70} height={11} style={{marginBottom:6}}/>
          <Skeleton width={180} height={26} style={{marginBottom:8}}/>
          <Skeleton width={240} height={13}/>
        </div>
        <Skeleton height={64} radius={12} style={{marginBottom:16}}/>
        <div style={{display:'grid',gridTemplateColumns:isMobile?'repeat(2,1fr)':'repeat(4,1fr)',gap:12,marginBottom:18}}>
          {[1,2,3,4].map(i=><MetricCardSkeleton key={i} isMobile={isMobile}/>)}
        </div>
        <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr':'2fr 1fr',gap:14}}>
          <Card padding={22}><Skeleton width="40%" height={18} style={{marginBottom:18}}/><Skeleton height={150} radius={12}/></Card>
          <Card padding={22}><Skeleton width="50%" height={16} style={{marginBottom:18}}/>{[1,2,3].map(i=><div key={i} style={{display:'flex',gap:10,marginBottom:14}}><Skeleton width={36} height={36} radius={12}/><div style={{flex:1}}><Skeleton width="60%" height={13} style={{marginBottom:6}}/><Skeleton width="80%" height={10}/></div></div>)}</Card>
        </div>
      </div>
    );
  }

  const metrics = [
    { label:'Lena Baki',    value:s.receivable, sign:1,  click:()=>onNavigate('parties', {filter:'overdue'}) },
    { label:'Dena Baki',    value:s.payable,    sign:-1, click:()=>onNavigate('parties') },
    { label:'Is Mahine Mila', value:s.collectedMonth, sign:1, click:()=>onNavigate('payments') },
    { label:'Is Mahine Billed',value:s.billedMonth, sign:0, click:()=>onNavigate('bills') },
  ];

  return(
    <div style={{padding: isMobile?'18px 14px 100px':'24px 28px'}}>

      {/* Hero header */}
      <div style={{marginBottom:18,position:'relative',paddingLeft: T.id==='light'?16:0}}>
        {T.id==='light' && (
          <span style={{
            position:'absolute',left:0,top:6,bottom:6,width:3,
            borderRadius:2, background:C.primary, opacity:0.55,
          }}/>
        )}
        <p style={{fontFamily:BRAND,fontSize:14,fontWeight:500,color:T.textMuted,marginBottom:2,fontStyle:'italic'}}>Namaste,</p>
        <h1 style={{fontFamily:DISPLAY,fontSize:isMobile?26:32,fontWeight:600,color:T.text,letterSpacing:'-0.01em',margin:0}}>{USER.name.split(' ')[0]} 👋</h1>
        <p style={{...typo('bodySm'),color:T.textMuted,margin:'4px 0 0'}}>
          {USER.business} · {TODAY.toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long'})}
        </p>
      </div>

      <OverdueBanner onClick={()=>onNavigate('parties', {filter:'overdue'})}/>

      {/* Metric cards */}
      <div style={{
        display:'grid',
        gridTemplateColumns: isMobile?'repeat(2,1fr)':'repeat(4,1fr)',
        gap: 12, marginBottom:18,
      }}>
        {metrics.map((m,i)=>{
          const color = m.sign>0 ? C.positive : m.sign<0 ? C.negative : T.text;
          return(
            <Card key={i} onClick={m.click} hoverable padding={isMobile?14:18}>
              <p style={{...typo('caption'),color:T.textMuted,marginBottom:6,fontWeight:600}}>{m.label}</p>
              <p style={{
                fontFamily:DISPLAY, fontWeight:600, color,
                fontSize: isMobile?22:28, letterSpacing:'-0.02em', lineHeight:1.1,
                fontVariantNumeric:'tabular-nums',
              }}>{fmtFull(m.value)}</p>
            </Card>
          );
        })}
      </div>

      {/* Chart + recent layout */}
      <div style={{
        display:'grid',
        gridTemplateColumns: isMobile?'1fr':'2fr 1fr',
        gap: 14,
      }}>
        {/* Cash flow chart */}
        <Card padding={isMobile?18:22}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:18}}>
            <div>
              <h2 style={{...typo('h3'),color:T.text,margin:0}}>Cash Flow</h2>
              <p style={{...typo('caption'),color:T.textMuted,margin:'2px 0 0'}}>Last 7 months</p>
            </div>
            <div style={{display:'flex',gap:14}}>
              <Legend color={C.positive} label="Mila"/>
              <Legend color={T.borderStrong} label="Billed"/>
            </div>
          </div>
          <CashFlowChart data={MONTHLY_TREND}/>
        </Card>

        {/* Recent payments */}
        <Card padding={isMobile?18:22}>
          <Section title="Recent Activity" action={
            <button onClick={()=>onNavigate('payments')} style={{...typo('caption'),color:C.primary,fontWeight:700,background:'transparent',border:'none',cursor:'pointer',padding:0}}>Sab dekho →</button>
          } subtitle={null}>
          </Section>
          <div style={{display:'flex',flexDirection:'column',gap:4}}>
            {recentPayments.map(p=>{
              const party = getParty(p.partyId);
              return(
                <div key={p.id} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 0',borderBottom:`1px solid ${T.divider}`}}>
                  <div style={{
                    width:36,height:36,borderRadius:12, flexShrink:0,
                    background: p.direction==='INCOMING'?C.positiveSoft:C.negativeSoft,
                    color: p.direction==='INCOMING'?C.positive:C.negative,
                    display:'flex',alignItems:'center',justifyContent:'center',
                  }}>{p.direction==='INCOMING'?ICONS.arrowDown():ICONS.arrowUp()}</div>
                  <div style={{flex:1,minWidth:0}}>
                    <p style={{...typo('bodySm'),color:T.text,margin:0,fontWeight:600,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{party?.name||'—'}</p>
                    <p style={{...typo('caption'),color:T.textMuted,margin:'1px 0 0'}}>{p.mode} · {new Date(p.date).toLocaleDateString('en-IN',{day:'numeric',month:'short'})}</p>
                  </div>
                  <span style={{
                    fontFamily:FONT, fontWeight:700, fontSize:14,
                    fontVariantNumeric:'tabular-nums',
                    color: p.direction==='INCOMING'?C.positive:C.negative,
                  }}>
                    {p.direction==='INCOMING'?'+':'-'}{fmtFull(p.amount)}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* Quick links */}
      <div style={{marginTop:16,display:'grid',gridTemplateColumns:isMobile?'repeat(2,1fr)':'repeat(4,1fr)',gap:10}}>
        {[
          { label:'Tally Bhejo',     sub:'CA ko file', icon:ICONS.tally(),    nav:'tally' },
          { label:'Bank Reconcile',  sub:'Statement upload', icon:ICONS.bank(),     nav:'reconcile' },
          { label:'Reports',         sub:'GST, P&L',  icon:ICONS.reports(),  nav:'reports' },
          { label:'Settings',        sub:'Business profile', icon:ICONS.settings(), nav:'settings' },
        ].map(q=>(
          <Card key={q.label} onClick={()=>onNavigate(q.nav)} hoverable padding={14}>
            <div style={{display:'flex',gap:10,alignItems:'center'}}>
              <div style={{width:36,height:36,borderRadius:12,background:T.surfaceAlt,color:T.textMuted,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>{q.icon}</div>
              <div style={{minWidth:0,flex:1}}>
                <p style={{...typo('bodySm'),color:T.text,margin:0,fontWeight:700,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{q.label}</p>
                <p style={{...typo('caption'),color:T.textMuted,margin:'3px 0 0',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{q.sub}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function Legend({color, label}){
  const {theme:T} = useTheme();
  return(
    <div style={{display:'flex',alignItems:'center',gap:5}}>
      <span style={{width:8,height:8,borderRadius:2,background:color}}/>
      <span style={{...typo('caption'),color:T.textMuted}}>{label}</span>
    </div>
  );
}

function CashFlowChart({data}){
  const {theme:T} = useTheme();
  const W=560, H=140;
  const max = Math.max(...data.flatMap(d=>[d.billed,d.mila]));
  const pts = key => data.map((d,i)=>({x:(i/(data.length-1))*W, y:H-(d[key]/max)*(H-16)-8}));
  const bP = pts('billed'), mP = pts('mila');

  const bezier = P => {
    if(!P||P.length<2) return '';
    let d = `M${P[0].x.toFixed(1)},${P[0].y.toFixed(1)}`;
    for(let i=1;i<P.length;i++){
      const cp=(P[i-1].x+P[i].x)/2;
      d+=` C${cp.toFixed(1)},${P[i-1].y.toFixed(1)} ${cp.toFixed(1)},${P[i].y.toFixed(1)} ${P[i].x.toFixed(1)},${P[i].y.toFixed(1)}`;
    }
    return d;
  };
  const area = P => bezier(P)+` L${P[P.length-1].x},${H} L${P[0].x},${H} Z`;

  return(
    <>
      <svg viewBox={`0 0 ${W} ${H}`} style={{width:'100%',height:'auto',display:'block'}}>
        <defs>
          <linearGradient id="hk3grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={C.positive} stopOpacity="0.16"/>
            <stop offset="100%" stopColor={C.positive} stopOpacity="0"/>
          </linearGradient>
        </defs>
        {[0.25,0.5,0.75,1].map((p,i)=>(
          <line key={i} x1="0" y1={H-(p*(H-16))-8} x2={W} y2={H-(p*(H-16))-8} stroke={T.divider} strokeWidth="1" strokeDasharray="2 4"/>
        ))}
        <path d={area(mP)} fill="url(#hk3grad)"/>
        <path d={bezier(bP)} fill="none" stroke={T.borderStrong} strokeWidth="1.6" strokeLinecap="round" strokeDasharray="5 4"/>
        <path d={bezier(mP)} fill="none" stroke={C.positive} strokeWidth="2.4" strokeLinecap="round"/>
        {mP.map((p,i)=> i===mP.length-1 && <circle key={i} cx={p.x} cy={p.y} r="5" fill={C.positive}/> )}
      </svg>
      <div style={{display:'flex',justifyContent:'space-between',marginTop:6}}>
        {data.map(d=> <span key={d.m} style={{...typo('caption'),color:T.textLight,fontWeight:600}}>{d.m}</span>)}
      </div>
    </>
  );
}

// ─── BILLS LIST ──────────────────────────────────────────────────────────────

function BillsScreen({ isMobile, onOpenBill, onNewBill, onNavigate }){
  const {theme:T} = useTheme();
  const { loading, error, retry } = useSimulatedFetch({delay:450});
  const [search,setSearch]=React.useState('');
  const [filter,setFilter]=React.useState('ALL');

  if(error) return <div style={{padding:'48px 14px'}}><ErrorState title="Bills load nahi ho sake" body={error} onRetry={retry}/></div>;

  // Reframed metrics — money axis, not status counts
  const monthBills = BILLS.filter(b=>b.date.startsWith('2026-05')&&b.status!=='CANCELLED');
  const kulBilled = monthBills.filter(b=>b.status==='FINAL').reduce((s,b)=>s+b.amount,0);
  const mila = monthBills.reduce((s,b)=>s+b.paid,0);
  const baaki = kulBilled - mila;

  const filterCounts = {
    ALL: BILLS.length,
    FINAL: BILLS.filter(b=>b.status==='FINAL').length,
    DRAFT: BILLS.filter(b=>b.status==='DRAFT').length,
    CANCELLED: BILLS.filter(b=>b.status==='CANCELLED').length,
  };
  const filters = [
    {k:'ALL',       l:`Sab (${filterCounts.ALL})`},
    {k:'FINAL',     l:`Final (${filterCounts.FINAL})`},
    {k:'DRAFT',     l:`Draft (${filterCounts.DRAFT})`},
    {k:'CANCELLED', l:`Cancel (${filterCounts.CANCELLED})`},
  ];

  const filtered = BILLS.filter(b=>{
    if(filter!=='ALL' && b.status!==filter) return false;
    if(search){
      const p = getParty(b.partyId);
      const q = search.toLowerCase();
      return b.no.toLowerCase().includes(q) || (p?.name.toLowerCase().includes(q));
    }
    return true;
  });

  // Group by month
  const groups = filtered.reduce((acc,b)=>{
    const k = b.date.slice(0,7);
    (acc[k]=acc[k]||[]).push(b);
    return acc;
  },{});

  return(
    <div style={{padding: isMobile?'18px 14px 100px':'24px 28px'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:18,gap:12,flexWrap:'wrap'}}>
        <div>
          <h1 style={{fontFamily:DISPLAY,fontSize:isMobile?24:30,fontWeight:600,color:T.text,letterSpacing:'-0.01em',margin:0}}>Mere Bills</h1>
          <p style={{...typo('bodySm'),color:T.textMuted,margin:'4px 0 0'}}>Sab bills aur unka hisaab</p>
        </div>
        <Button onClick={onNewBill} icon={ICONS.plus()}>Naya Bill</Button>
      </div>

      <OverdueBanner onClick={()=>onNavigate('parties',{filter:'overdue'})}/>

      {/* Reframed metrics: money, not status counts */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,marginBottom:18}}>
        {[
          { l:'Kul Billed', v:kulBilled, sub:'is mahine', color:T.text },
          { l:'Mila',       v:mila,      sub:'wapas mila', color:C.positive },
          { l:'Baaki',      v:baaki,     sub:'abhi tak', color:C.primary },
        ].map((m,i)=>(
          <Card key={i} padding={isMobile?12:16}>
            <p style={{...typo('caption'),color:T.textMuted,marginBottom:4,fontWeight:600}}>{m.l}</p>
            <p style={{fontFamily:FONT,fontWeight:700,color:m.color,fontSize:isMobile?16:22,letterSpacing:'-0.4px',lineHeight:1.1,fontVariantNumeric:'tabular-nums'}}>{fmtFull(m.v)}</p>
            <p style={{...typo('caption'),color:T.textLight,marginTop:2,fontWeight:500}}>{m.sub}</p>
          </Card>
        ))}
      </div>

      {/* Search + filter */}
      <div style={{display:'flex',gap:10,marginBottom:14,flexWrap:'wrap'}}>
        <div style={{flex:1,minWidth:200,position:'relative'}}>
          <span style={{position:'absolute',left:14,top:'50%',transform:'translateY(-50%)',color:T.textLight}}>{ICONS.search()}</span>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Bill no ya party dhundho..."
            style={{
              width:'100%',height:44,padding:'0 14px 0 38px',
              borderRadius: RADIUS.md, border:`1.5px solid ${T.border}`,
              background: T.surface, color: T.text, fontFamily:FONT, ...typo('body'),
              outline:'none',boxSizing:'border-box',
            }}/>
        </div>
      </div>

      <div style={{display:'flex',gap:6,marginBottom:18,overflowX:'auto',paddingBottom:2}}>
        {filters.map(f=>{
          const active = filter===f.k;
          return(
            <button key={f.k} onClick={()=>setFilter(f.k)} style={{
              padding:'7px 14px',borderRadius:RADIUS.pill,border:`1px solid ${active?C.primary:T.border}`,
              background: active?C.primary:T.surface, color: active?'#fff':T.textMuted,
              ...typo('caption'),fontWeight:600, cursor:'pointer', whiteSpace:'nowrap',
              fontFamily: FONT, transition:'all 0.15s',
            }}>{f.l}</button>
          );
        })}
      </div>

      {loading ? (
        <Card padding={0}>{[1,2,3,4].map(i=><ListRowSkeleton key={i}/>)}</Card>
      ) : filtered.length === 0 ? (
        <Card><EmptyState
          icon={ICONS.bills()}
          title={search||filter!=='ALL'?'Koi bill nahi mila':'Pehla bill banao'}
          body={search||filter!=='ALL'?'Search ya filter clear karke try karo':'Bill banakar customer ko bhejo.'}
          action={search||filter!=='ALL'
            ? <Button variant="secondary" onClick={()=>{setSearch('');setFilter('ALL');}}>Filter Clear Karo</Button>
            : <Button onClick={onNewBill} icon={ICONS.plus()}>Naya Bill Banao</Button>}
        /></Card>
      ) : Object.entries(groups).sort(([a],[b])=>b.localeCompare(a)).map(([month,bills])=>{
        const monthDate = new Date(month+'-01');
        const monthLabel = monthDate.toLocaleDateString('en-IN',{month:'long',year:'numeric'});
        const monthTotal = bills.filter(b=>b.status!=='CANCELLED').reduce((s,b)=>s+b.amount,0);
        return(
          <div key={month} style={{marginBottom:18}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 4px 10px'}}>
              <h3 style={{...typo('label'),color:T.textMuted,margin:0,fontWeight:600,textTransform:'uppercase'}}>{monthLabel} · {bills.length} bills</h3>
              <Money value={monthTotal} size="sm" color={T.textMuted}/>
            </div>
            <Card padding={0}>
              {bills.map((b,i)=>{
                const party = getParty(b.partyId);
                const remaining = b.amount - b.paid;
                return(
                  <button key={b.id} onClick={()=>onOpenBill(b)} style={{
                    width:'100%',display:'flex',alignItems:'center',gap:12,
                    padding:'14px 18px',border:'none',background:'transparent',cursor:'pointer',
                    borderBottom: i<bills.length-1?`1px solid ${T.divider}`:'none',
                    textAlign:'left',color:T.text,transition:'background 0.15s',
                  }}
                  onMouseEnter={e=>e.currentTarget.style.background=T.hover}
                  onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                    <Avatar name={party?.name||'—'} size={40}/>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:2,flexWrap:'wrap'}}>
                        <span style={{...typo('body'),fontWeight:600,color:T.text}}>{party?.name}</span>
                        <StatusChip status={b.status}/>
                        {b.paid>0 && b.paid<b.amount && <Chip tone="warning">Partial</Chip>}
                      </div>
                      <p style={{...typo('caption'),color:T.textMuted,margin:0,fontFamily:MONO}}>
                        {b.no} · {new Date(b.date).toLocaleDateString('en-IN',{day:'numeric',month:'short'})}
                      </p>
                    </div>
                    <div style={{textAlign:'right'}}>
                      <p style={{...typo('numSm'),color:T.text,margin:0,fontVariantNumeric:'tabular-nums'}}>{fmtFull(b.amount)}</p>
                      {remaining>0 && b.status==='FINAL' && (
                        <p style={{...typo('caption'),color:C.primary,margin:'2px 0 0',fontWeight:600}}>{fmtFull(remaining)} baaki</p>
                      )}
                    </div>
                    <span style={{color:T.textLight}}>{ICONS.chevR()}</span>
                  </button>
                );
              })}
            </Card>
          </div>
        );
      })}
    </div>
  );
}

// ─── PARTIES LIST ────────────────────────────────────────────────────────────

function PartiesScreen({ isMobile, onOpenParty, onAddParty, urlFilter, onClearFilter, onNavigate }){
  const {theme:T} = useTheme();
  const { loading, error, retry } = useSimulatedFetch({delay:500});
  const [search,setSearch]=React.useState('');
  const [type,setType]=React.useState('ALL');
  const [sortBy,setSortBy]=React.useState('balance');

  if(error) return <div style={{padding:'48px 14px'}}><ErrorState title="Parties load nahi ho saki" body={error} onRetry={retry}/></div>;

  const summary = dashboardSummary();
  const isOverdueFilter = urlFilter==='overdue';

  let filtered = PARTIES.filter(p=>{
    if(isOverdueFilter && !p.isOverdue) return false;
    if(type!=='ALL' && p.type!==type) return false;
    if(search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });
  filtered = filtered.sort((a,b)=>{
    if(sortBy==='name') return a.name.localeCompare(b.name);
    // balance: most negative (biggest debtors) first
    return a.balance - b.balance;
  });

  return(
    <div style={{padding: isMobile?'18px 14px 100px':'24px 28px'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:18,gap:12,flexWrap:'wrap'}}>
        <div>
          <h1 style={{fontFamily:DISPLAY,fontSize:isMobile?24:30,fontWeight:600,color:T.text,letterSpacing:'-0.01em',margin:0}}>Udhar Khata</h1>
          <p style={{...typo('bodySm'),color:T.textMuted,margin:'4px 0 0'}}>Customer aur supplier ka hisaab</p>
        </div>
        <Button onClick={onAddParty} icon={ICONS.plus()} variant="secondary">Party Jodo</Button>
      </div>

      {!isOverdueFilter && <OverdueBanner onClick={()=>onNavigate('parties',{filter:'overdue'})}/>}

      {/* Summary */}
      {!isOverdueFilter && (
        <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:10,marginBottom:18}}>
          <Card padding={isMobile?14:18}>
            <p style={{...typo('caption'),color:T.textMuted,marginBottom:4,fontWeight:600}}>Lena Baki</p>
            <p style={{fontFamily:FONT,fontWeight:700,color:C.positive,fontSize:isMobile?18:24,letterSpacing:'-0.4px',fontVariantNumeric:'tabular-nums'}}>{fmtFull(summary.receivable)}</p>
            <p style={{...typo('caption'),color:T.textLight,marginTop:2}}>customers se</p>
          </Card>
          <Card padding={isMobile?14:18}>
            <p style={{...typo('caption'),color:T.textMuted,marginBottom:4,fontWeight:600}}>Dena Baki</p>
            <p style={{fontFamily:FONT,fontWeight:700,color:C.negative,fontSize:isMobile?18:24,letterSpacing:'-0.4px',fontVariantNumeric:'tabular-nums'}}>{fmtFull(summary.payable)}</p>
            <p style={{...typo('caption'),color:T.textLight,marginTop:2}}>suppliers ko</p>
          </Card>
        </div>
      )}

      {isOverdueFilter && (
        <Card style={{marginBottom:14,padding:'12px 14px',background:C.primarySoft,border:`1px solid ${C.primary}33`}}>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <Chip tone="primary" size="md">Filter</Chip>
            <span style={{...typo('bodySm'),color:T.text,fontWeight:600}}>Sirf overdue parties dikha rahe hain</span>
            <button onClick={onClearFilter} style={{marginLeft:'auto',background:'transparent',border:'none',color:C.primary,...typo('caption'),fontWeight:700,cursor:'pointer'}}>Clear ✕</button>
          </div>
        </Card>
      )}

      {/* Search + filter */}
      <div style={{display:'flex',gap:10,marginBottom:12,flexWrap:'wrap'}}>
        <div style={{flex:1,minWidth:200,position:'relative'}}>
          <span style={{position:'absolute',left:14,top:'50%',transform:'translateY(-50%)',color:T.textLight}}>{ICONS.search()}</span>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Party dhundho..."
            style={{
              width:'100%',height:44,padding:'0 14px 0 38px',
              borderRadius: RADIUS.md, border:`1.5px solid ${T.border}`,
              background: T.surface, color: T.text, fontFamily:FONT, ...typo('body'),
              outline:'none',boxSizing:'border-box',
            }}/>
        </div>
        <Select value={sortBy} onChange={setSortBy}
          options={[{value:'balance',label:'Sort: Biggest baki'},{value:'name',label:'Sort: Naam (A-Z)'}]}
          style={{minWidth:170}}/>
      </div>

      <div style={{display:'flex',gap:6,marginBottom:18}}>
        {[
          {k:'ALL',v:'Sab'},
          {k:'CUSTOMER',v:'Customers'},
          {k:'SUPPLIER',v:'Suppliers'},
        ].map(f=>{
          const active = type===f.k;
          return(
            <button key={f.k} onClick={()=>setType(f.k)} style={{
              padding:'7px 14px',borderRadius:RADIUS.pill,border:`1px solid ${active?C.primary:T.border}`,
              background: active?C.primary:T.surface, color: active?'#fff':T.textMuted,
              ...typo('caption'),fontWeight:600, cursor:'pointer', fontFamily:FONT, transition:'all 0.15s',
            }}>{f.v}</button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <Card><EmptyState icon={ICONS.parties()} title="Koi party nahi mili" body={isOverdueFilter?'Sab clear! Koi overdue nahi.':search||type!=='ALL'?'Filter ya search clear karke try karo':'Add karo customer ya supplier.'} action={
          isOverdueFilter
            ? <Button variant="secondary" onClick={onClearFilter}>Filter Clear Karo</Button>
            : search || type!=='ALL'
              ? <Button variant="secondary" onClick={()=>{setSearch('');setType('ALL');}}>Filter Clear Karo</Button>
              : <Button onClick={onAddParty} icon={ICONS.plus()} variant="secondary">Party Jodo</Button>
        }/></Card>
      ) : loading ? (
        <Card padding={0}>{[1,2,3,4,5].map(i=><ListRowSkeleton key={i}/>)}</Card>
      ) : (
        <Card padding={0}>
          {filtered.map((p,i)=>(
            <PartyRow key={p.id} party={p} onClick={()=>onOpenParty(p)} divider={i<filtered.length-1} isMobile={isMobile}/>
          ))}
        </Card>
      )}
    </div>
  );
}

function PartyRow({party, onClick, divider, isMobile}){
  const {theme:T} = useTheme();
  const owesUs = party.balance < 0;
  const weOwe = party.balance > 0;
  return(
    <div style={{
      display:'flex',alignItems:'center',gap:12,padding:'14px 18px',
      borderBottom: divider?`1px solid ${T.divider}`:'none',
      transition:'background 0.15s',
    }}>
      <button onClick={onClick} style={{
        display:'flex',alignItems:'center',gap:12,flex:1,minWidth:0,
        background:'transparent',border:'none',cursor:'pointer',padding:0,
        textAlign:'left',color:T.text,
      }}>
        <Avatar name={party.name} size={44}/>
        <div style={{flex:1,minWidth:0}}>
          <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
            <span style={{...typo('body'),fontWeight:700,color:T.text}}>{party.name}</span>
            {party.isOverdue && <Chip tone="primary">Overdue</Chip>}
          </div>
          <p style={{...typo('caption'),color:T.textMuted,margin:'2px 0 0'}}>
            {party.type==='CUSTOMER'?'Customer':'Supplier'} · {party.city} · {party.phone}
          </p>
        </div>
        <div style={{textAlign:'right',marginRight:8}}>
          <p style={{
            fontFamily:FONT,fontWeight:700,fontSize:16,
            color: owesUs?C.positive:weOwe?C.negative:T.textMuted,
            margin:0,fontVariantNumeric:'tabular-nums',
          }}>
            {owesUs?fmtFull(Math.abs(party.balance)):weOwe?fmtFull(party.balance):'Settled'}
          </p>
          {party.balance!==0 && <p style={{...typo('caption'),color:T.textLight,margin:'2px 0 0'}}>
            {owesUs?'lena baki':'dena baki'}
          </p>}
        </div>
      </button>
      {party.phone && !isMobile && (
        <>
          <a href={telLink(party)} style={{textDecoration:'none'}}>
            <IconButton variant="surface" label={`Call ${party.name}`}>{ICONS.call()}</IconButton>
          </a>
          <a href={waLink(party, party.balance)} target="_blank" rel="noopener" style={{textDecoration:'none'}}>
            <IconButton variant="surface" label={`WhatsApp ${party.name}`} style={{color: C.positive}}>{ICONS.whatsapp()}</IconButton>
          </a>
        </>
      )}
    </div>
  );
}

// ─── PAYMENTS ────────────────────────────────────────────────────────────────

function PaymentsScreen({ isMobile, onNewPayment, onNavigate }){
  const {theme:T} = useTheme();
  const { loading, error, retry } = useSimulatedFetch({delay:400});
  const [filter, setFilter] = React.useState('ALL');

  if(error) return <div style={{padding:'48px 14px'}}><ErrorState title="Payments load nahi ho sake" body={error} onRetry={retry}/></div>;

  const expected = PAYMENTS.filter(p=>p.status==='EXPECTED');
  const completed = PAYMENTS.filter(p=>p.status==='COMPLETED').filter(p=>{
    if(filter==='IN')  return p.direction==='INCOMING';
    if(filter==='OUT') return p.direction==='OUTGOING';
    return true;
  });

  const monthIn  = PAYMENTS.filter(p=>p.status==='COMPLETED'&&p.direction==='INCOMING'&&p.date.startsWith('2026-05')).reduce((s,p)=>s+p.amount,0);
  const monthOut = PAYMENTS.filter(p=>p.status==='COMPLETED'&&p.direction==='OUTGOING'&&p.date.startsWith('2026-05')).reduce((s,p)=>s+p.amount,0);

  // Group completed by month
  const groups = completed.reduce((acc,p)=>{
    const k = p.date.slice(0,7);
    (acc[k]=acc[k]||[]).push(p);
    return acc;
  },{});

  return(
    <div style={{padding: isMobile?'18px 14px 100px':'24px 28px'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:18,gap:12,flexWrap:'wrap'}}>
        <div>
          <h1 style={{fontFamily:DISPLAY,fontSize:isMobile?24:30,fontWeight:600,color:T.text,letterSpacing:'-0.01em',margin:0}}>Payments</h1>
          <p style={{...typo('bodySm'),color:T.textMuted,margin:'4px 0 0'}}>Lena-dena ka pura record</p>
        </div>
        <Button onClick={onNewPayment} icon={ICONS.plus()}>Payment Likho</Button>
      </div>

      <OverdueBanner onClick={()=>onNavigate('parties',{filter:'overdue'})}/>

      {/* Summary strip */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,marginBottom:18}}>
        {[
          { l:'Is Mahine Mila',  v:monthIn,            c:C.positive },
          { l:'Is Mahine Diya',  v:monthOut,           c:C.negative },
          { l:'Net Cash Flow',   v:monthIn-monthOut,   c:monthIn-monthOut>=0?C.positive:C.negative },
        ].map((m,i)=>(
          <Card key={i} padding={isMobile?12:16}>
            <p style={{...typo('caption'),color:T.textMuted,marginBottom:4,fontWeight:600}}>{m.l}</p>
            <p style={{fontFamily:FONT,fontWeight:700,color:m.c,fontSize:isMobile?16:22,letterSpacing:'-0.4px',fontVariantNumeric:'tabular-nums'}}>{fmtFull(Math.abs(m.v))}</p>
          </Card>
        ))}
      </div>

      {/* Action Chahiye — pending payments */}
      {expected.length > 0 && (
        <div style={{marginBottom:24}}>
          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:10}}>
            <div style={{width:3,height:18,borderRadius:2,background:C.warning}}/>
            <h2 style={{...typo('h3'),color:T.text,margin:0}}>Action Chahiye</h2>
            <Chip tone="warning">{expected.length} pending</Chip>
          </div>
          <Card padding={0}>
            {expected.map((p,i)=>(
              <PendingPaymentRow key={p.id} payment={p} divider={i<expected.length-1}/>
            ))}
          </Card>
        </div>
      )}

      {/* Hua Hai — completed */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <div style={{width:3,height:18,borderRadius:2,background:T.borderStrong}}/>
          <h2 style={{...typo('h3'),color:T.text,margin:0}}>Hua Hai</h2>
        </div>
        <div style={{display:'flex',gap:6}}>
          {[{k:'ALL',l:'Sab'},{k:'IN',l:'Mila'},{k:'OUT',l:'Diya'}].map(f=>{
            const active = filter===f.k;
            return(
              <button key={f.k} onClick={()=>setFilter(f.k)} style={{
                padding:'5px 12px',borderRadius:RADIUS.pill,border:`1px solid ${active?C.primary:T.border}`,
                background: active?C.primary:T.surface, color: active?'#fff':T.textMuted,
                ...typo('caption'),fontWeight:600, cursor:'pointer', fontFamily:FONT,
              }}>{f.l}</button>
            );
          })}
        </div>
      </div>

      {completed.length === 0 ? (
        <Card><EmptyState icon={ICONS.payments()} title="Koi payment nahi" body={filter!=='ALL'?'Filter clear karke try karo':'Pehli payment likho.'} action={
          filter!=='ALL'
            ? <Button variant="secondary" onClick={()=>setFilter('ALL')}>Filter Clear Karo</Button>
            : <Button onClick={onNewPayment} icon={ICONS.plus()}>Payment Likho</Button>
        }/></Card>
      ) : loading ? (
        <Card padding={0}>{[1,2,3,4].map(i=><ListRowSkeleton key={i}/>)}</Card>
      ) : Object.entries(groups).sort(([a],[b])=>b.localeCompare(a)).map(([month,pays])=>(
        <div key={month} style={{marginBottom:18}}>
          <h3 style={{...typo('label'),color:T.textMuted,margin:'0 0 8px',fontWeight:600,textTransform:'uppercase',padding:'4px'}}>
            {new Date(month+'-01').toLocaleDateString('en-IN',{month:'long',year:'numeric'})}
          </h3>
          <Card padding={0}>
            {pays.map((p,i)=> <PaymentRow key={p.id} payment={p} divider={i<pays.length-1}/>)}
          </Card>
        </div>
      ))}
    </div>
  );
}

function PendingPaymentRow({payment, divider}){
  const {theme:T} = useTheme();
  const party = getParty(payment.partyId);
  return(
    <div style={{
      display:'flex',alignItems:'center',gap:12,padding:'14px 18px',
      borderBottom: divider?`1px solid ${T.divider}`:'none',
      borderLeft: `3px solid ${C.warning}`,
    }}>
      <Avatar name={party?.name||'—'} size={40}/>
      <div style={{flex:1,minWidth:0}}>
        <p style={{...typo('body'),fontWeight:600,color:T.text,margin:0}}>{party?.name}</p>
        <p style={{...typo('caption'),color:T.textMuted,margin:'2px 0 0'}}>
          {payment.direction==='INCOMING'?'Aana hai':'Dena hai'} · {payment.mode} · expected {new Date(payment.date).toLocaleDateString('en-IN',{day:'numeric',month:'short'})}
          {payment.billNo && ` · ${payment.billNo}`}
        </p>
        {payment.note && <p style={{...typo('caption'),color:T.textLight,margin:'2px 0 0',fontStyle:'italic'}}>"{payment.note}"</p>}
      </div>
      <div style={{textAlign:'right',marginRight:8}}>
        <p style={{fontFamily:FONT,fontWeight:700,fontSize:16,color: payment.direction==='INCOMING'?C.positive:C.negative,margin:0,fontVariantNumeric:'tabular-nums'}}>
          {payment.direction==='INCOMING'?'+':'-'}{fmtFull(payment.amount)}
        </p>
      </div>
      <Button size="sm" variant="success" icon={ICONS.check()}>Done</Button>
    </div>
  );
}

function PaymentRow({payment, divider}){
  const {theme:T} = useTheme();
  const party = getParty(payment.partyId);
  const isIn = payment.direction==='INCOMING';
  return(
    <div style={{
      display:'flex',alignItems:'center',gap:12,padding:'14px 18px',
      borderBottom: divider?`1px solid ${T.divider}`:'none',
    }}>
      <div style={{
        width:40,height:40,borderRadius:14,flexShrink:0,
        background: isIn?C.positiveSoft:C.negativeSoft,
        color: isIn?C.positive:C.negative,
        display:'flex',alignItems:'center',justifyContent:'center',
      }}>{isIn?ICONS.arrowDown():ICONS.arrowUp()}</div>
      <div style={{flex:1,minWidth:0}}>
        <p style={{...typo('body'),fontWeight:600,color:T.text,margin:0}}>{party?.name||'—'}</p>
        <p style={{...typo('caption'),color:T.textMuted,margin:'2px 0 0'}}>
          {payment.mode} · {new Date(payment.date).toLocaleDateString('en-IN',{day:'numeric',month:'short'})}
          {payment.billNo && <span style={{fontFamily:MONO}}> · {payment.billNo}</span>}
          {payment.note && ` · ${payment.note}`}
        </p>
      </div>
      <p style={{fontFamily:FONT,fontWeight:700,fontSize:16,color: isIn?C.positive:C.negative,margin:0,fontVariantNumeric:'tabular-nums'}}>
        {isIn?'+':'-'}{fmtFull(payment.amount)}
      </p>
    </div>
  );
}

Object.assign(window, { DashboardScreen, BillsScreen, PartiesScreen, PaymentsScreen, PartyRow, PaymentRow, PendingPaymentRow });
