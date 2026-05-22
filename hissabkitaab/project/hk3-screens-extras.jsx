
// hk3-screens-extras.jsx — Purchases, Banking, Transactions, Notes

const { useTheme, useIsMobile, Card, Button, IconButton, Input, Select, Chip, StatusChip, Avatar, Sheet, EmptyState, Section, Money, Skeleton, ErrorState,
  C, FONT, BRAND, DISPLAY, MONO, TYPE, typo, RADIUS,
  fmt, fmtFull,
  USER, PARTIES, BILLS, PURCHASES, PAYMENTS, NOTES, TRANSFERS, BANK_ACCOUNTS,
  getParty, ICONS, OverdueBanner } = window;

// shared helpers
function useSimulatedFetch({delay=600, failChance=0}={}){
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);
  const [retryKey, setRetryKey] = React.useState(0);
  React.useEffect(()=>{
    setLoading(true); setError(null);
    const t = setTimeout(()=>{
      if(failChance > Math.random()) setError('Network problem. Phir try karo.');
      setLoading(false);
    }, delay);
    return ()=>clearTimeout(t);
  },[retryKey]);
  return { loading, error, retry: ()=>setRetryKey(k=>k+1) };
}

function ListRowSkel(){
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

// ─── PURCHASES SCREEN ────────────────────────────────────────────────────────

function PurchasesScreen({ isMobile, onNavigate, onOpenPurchase, onNewPurchase }){
  const {theme:T} = useTheme();
  const { loading, error, retry } = useSimulatedFetch({delay:450});
  const [search,setSearch]=React.useState('');
  const [filter,setFilter]=React.useState('ALL');

  if(error) return <div style={{padding:'48px 14px'}}><ErrorState title="Purchases load nahi ho sake" body={error} onRetry={retry}/></div>;

  const monthData = PURCHASES.filter(p=>p.date.startsWith('2026-05')&&p.status!=='CANCELLED');
  const kulKharida = monthData.filter(p=>p.status==='FINAL').reduce((s,p)=>s+p.amount,0);
  const paid = monthData.reduce((s,p)=>s+p.paid,0);
  const baaki = kulKharida - paid;

  const counts = {
    ALL: PURCHASES.length,
    FINAL: PURCHASES.filter(p=>p.status==='FINAL').length,
    DRAFT: PURCHASES.filter(p=>p.status==='DRAFT').length,
    CANCELLED: PURCHASES.filter(p=>p.status==='CANCELLED').length,
  };
  const filters = [
    {k:'ALL',l:`Sab (${counts.ALL})`},
    {k:'FINAL',l:`Final (${counts.FINAL})`},
    {k:'DRAFT',l:`Draft (${counts.DRAFT})`},
    {k:'CANCELLED',l:`Cancel (${counts.CANCELLED})`},
  ];

  const filtered = PURCHASES.filter(p=>{
    if(filter!=='ALL' && p.status!==filter) return false;
    if(search){
      const party = getParty(p.partyId);
      const q = search.toLowerCase();
      return p.no.toLowerCase().includes(q) || party?.name.toLowerCase().includes(q);
    }
    return true;
  });

  const groups = filtered.reduce((acc,p)=>{
    const k = p.date.slice(0,7);
    (acc[k]=acc[k]||[]).push(p);
    return acc;
  },{});

  return(
    <div style={{padding:isMobile?'18px 14px 100px':'24px 28px'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:18,gap:12,flexWrap:'wrap'}}>
        <div>
          <h1 style={{fontFamily:DISPLAY,fontSize:isMobile?24:30,fontWeight:600,color:T.text,letterSpacing:'-0.01em',margin:0}}>Kharidari</h1>
          <p style={{...typo('bodySm'),color:T.textMuted,margin:'4px 0 0'}}>Supplier se aayi bills</p>
        </div>
        <Button onClick={onNewPurchase} icon={ICONS.plus()}>Purchase Record Karo</Button>
      </div>

      {/* Money metrics */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,marginBottom:18}}>
        {[
          { l:'Kul Kharida', v:kulKharida, sub:'is mahine', color:T.text },
          { l:'Diya',        v:paid,       sub:'paid out',  color:C.positive },
          { l:'Baaki',       v:baaki,      sub:'dena hai',  color:C.primary },
        ].map((m,i)=>(
          <Card key={i} padding={isMobile?12:16}>
            <p style={{...typo('caption'),color:T.textMuted,marginBottom:4,fontWeight:600}}>{m.l}</p>
            <p style={{fontFamily:FONT,fontWeight:700,color:m.color,fontSize:isMobile?16:22,letterSpacing:'-0.4px',lineHeight:1.1,fontVariantNumeric:'tabular-nums'}}>{fmtFull(m.v)}</p>
            <p style={{...typo('caption'),color:T.textLight,marginTop:2,fontWeight:500}}>{m.sub}</p>
          </Card>
        ))}
      </div>

      <div style={{display:'flex',gap:10,marginBottom:14,flexWrap:'wrap'}}>
        <div style={{flex:1,minWidth:200,position:'relative'}}>
          <span style={{position:'absolute',left:14,top:'50%',transform:'translateY(-50%)',color:T.textLight}}>{ICONS.search()}</span>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Bill ya supplier dhundho..."
            style={{width:'100%',height:44,padding:'0 14px 0 38px',borderRadius:RADIUS.md,border:`1.5px solid ${T.border}`,background:T.surface,color:T.text,fontFamily:FONT,...typo('body'),outline:'none',boxSizing:'border-box'}}/>
        </div>
      </div>

      <div style={{display:'flex',gap:6,marginBottom:18,overflowX:'auto',paddingBottom:2}}>
        {filters.map(f=>{
          const active = filter===f.k;
          return(
            <button key={f.k} onClick={()=>setFilter(f.k)} style={{
              padding:'7px 14px',borderRadius:RADIUS.pill,border:`1px solid ${active?C.primary:T.border}`,
              background: active?C.primary:T.surface, color: active?'#fff':T.textMuted,
              ...typo('caption'),fontWeight:600, cursor:'pointer', whiteSpace:'nowrap', fontFamily:FONT,
            }}>{f.l}</button>
          );
        })}
      </div>

      {loading ? (
        <Card padding={0}>{[1,2,3,4].map(i=><ListRowSkel key={i}/>)}</Card>
      ) : filtered.length===0 ? (
        <Card><EmptyState
          icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>}
          title={search||filter!=='ALL'?'Koi purchase nahi mila':'Pehla purchase record karo'}
          body={search||filter!=='ALL'?'Filter ya search clear karke try karo':'Supplier se kharide saaman ka record karo.'}
          action={search||filter!=='ALL'
            ? <Button variant="secondary" onClick={()=>{setSearch('');setFilter('ALL');}}>Filter Clear Karo</Button>
            : <Button onClick={onNewPurchase} icon={ICONS.plus()}>Purchase Record Karo</Button>}/></Card>
      ) : Object.entries(groups).sort(([a],[b])=>b.localeCompare(a)).map(([month,purs])=>{
        const total = purs.filter(p=>p.status!=='CANCELLED').reduce((s,p)=>s+p.amount,0);
        return(
          <div key={month} style={{marginBottom:18}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 4px 10px'}}>
              <h3 style={{...typo('label'),color:T.textMuted,margin:0,fontWeight:600,textTransform:'uppercase'}}>
                {new Date(month+'-01').toLocaleDateString('en-IN',{month:'long',year:'numeric'})} · {purs.length} bills
              </h3>
              <Money value={total} size="sm" color={T.textMuted}/>
            </div>
            <Card padding={0}>
              {purs.map((p,i)=>{
                const supplier = getParty(p.partyId);
                const remaining = p.amount - p.paid;
                return(
                  <button key={p.id} onClick={()=>onOpenPurchase&&onOpenPurchase(p)} style={{
                    width:'100%',display:'flex',alignItems:'center',gap:12,padding:'14px 18px',
                    border:'none',background:'transparent',cursor:'pointer',
                    borderBottom:i<purs.length-1?`1px solid ${T.divider}`:'none',textAlign:'left',color:T.text,
                    transition:'background 0.15s',
                  }}
                  onMouseEnter={e=>e.currentTarget.style.background=T.hover}
                  onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                    <Avatar name={supplier?.name||'—'} size={40}/>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:2,flexWrap:'wrap'}}>
                        <span style={{...typo('body'),fontWeight:600,color:T.text}}>{supplier?.name}</span>
                        <StatusChip status={p.status}/>
                        {p.paid>0 && p.paid<p.amount && <Chip tone="warning">Partial</Chip>}
                      </div>
                      <p style={{...typo('caption'),color:T.textMuted,margin:0,fontFamily:MONO}}>
                        {p.no} · {new Date(p.date).toLocaleDateString('en-IN',{day:'numeric',month:'short'})}
                      </p>
                    </div>
                    <div style={{textAlign:'right'}}>
                      <p style={{...typo('numSm'),color:T.text,margin:0,fontVariantNumeric:'tabular-nums'}}>{fmtFull(p.amount)}</p>
                      {remaining>0 && p.status==='FINAL' && (
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

// ─── BANKING SCREEN ──────────────────────────────────────────────────────────

function BankingScreen({ isMobile, onNavigate, onTransfer, onNewAccount }){
  const {theme:T} = useTheme();
  const { loading, error, retry } = useSimulatedFetch({delay:400});

  if(error) return <div style={{padding:'48px 14px'}}><ErrorState title="Banking load nahi ho saka" body={error} onRetry={retry}/></div>;

  const bankAccs = BANK_ACCOUNTS.filter(a=>a.type!=='CASH');
  const cashAcc = BANK_ACCOUNTS.filter(a=>a.type==='CASH');
  const totalBank = bankAccs.reduce((s,a)=>s+a.balance,0);
  const totalCash = cashAcc.reduce((s,a)=>s+a.balance,0);

  return(
    <div style={{padding:isMobile?'18px 14px 100px':'24px 28px',maxWidth:1080,margin:'0 auto'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:18,gap:12,flexWrap:'wrap'}}>
        <div>
          <h1 style={{fontFamily:DISPLAY,fontSize:isMobile?24:30,fontWeight:600,color:T.text,letterSpacing:'-0.01em',margin:0}}>Banking</h1>
          <p style={{...typo('bodySm'),color:T.textMuted,margin:'4px 0 0'}}>Bank aur cash accounts</p>
        </div>
        <div style={{display:'flex',gap:8}}>
          <Button onClick={onTransfer} variant="secondary" icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>}>Transfer</Button>
          <Button onClick={onNewAccount} icon={ICONS.plus()}>Account Jodo</Button>
        </div>
      </div>

      {/* Total balance summary */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:10,marginBottom:18}}>
        <Card padding={isMobile?16:20}>
          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:8,minWidth:0}}>
            <div style={{width:36,height:36,borderRadius:12,background:C.infoSoft,color:C.info,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>{ICONS.bank()}</div>
            <p style={{...typo('caption'),color:T.textMuted,fontWeight:600,margin:0,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',minWidth:0}}>Bank Balance</p>
          </div>
          <p style={{fontFamily:FONT,fontWeight:700,color:T.text,fontSize:isMobile?20:28,letterSpacing:'-0.5px',fontVariantNumeric:'tabular-nums'}}>{fmtFull(totalBank)}</p>
          <p style={{...typo('caption'),color:T.textLight,marginTop:2,whiteSpace:'nowrap'}}>{bankAccs.length} accounts</p>
        </Card>
        <Card padding={isMobile?16:20}>
          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:8,minWidth:0}}>
            <div style={{width:36,height:36,borderRadius:12,background:C.positiveSoft,color:C.positive,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
            </div>
            <p style={{...typo('caption'),color:T.textMuted,fontWeight:600,margin:0,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',minWidth:0}}>Cash in Hand</p>
          </div>
          <p style={{fontFamily:FONT,fontWeight:700,color:T.text,fontSize:isMobile?20:28,letterSpacing:'-0.5px',fontVariantNumeric:'tabular-nums'}}>{fmtFull(totalCash)}</p>
          <p style={{...typo('caption'),color:T.textLight,marginTop:2,whiteSpace:'nowrap'}}>physical cash</p>
        </Card>
      </div>

      <Section title="Bank Accounts" subtitle={`${bankAccs.length} active`} action={
        <button onClick={()=>onNavigate('reconcile')} style={{...typo('caption'),color:C.primary,fontWeight:700,background:'transparent',border:'none',cursor:'pointer'}}>Reconcile →</button>
      }>
        {loading ? (
          <Card padding={0}>{[1,2].map(i=><ListRowSkel key={i}/>)}</Card>
        ) : (
          <div style={{display:'flex',flexDirection:'column',gap:10}}>
            {bankAccs.map(acc=>(
              <Card key={acc.id} hoverable padding={isMobile?14:18}>
                <div style={{display:'flex',alignItems:'center',gap:12}}>
                  <div style={{width:48,height:48,borderRadius:14,background:C.infoSoft,color:C.info,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>{ICONS.bank()}</div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:'flex',alignItems:'center',gap:8,minWidth:0}}>
                      <p style={{...typo('body'),fontWeight:700,color:T.text,margin:0,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',minWidth:0}}>{acc.bank}</p>
                      <Chip>{acc.type}</Chip>
                    </div>
                    <p style={{...typo('caption'),color:T.textMuted,margin:'2px 0 0',fontFamily:MONO,whiteSpace:'nowrap'}}>****{acc.last4}</p>
                  </div>
                  <div style={{textAlign:'right',flexShrink:0}}>
                    <p style={{fontFamily:FONT,fontWeight:700,fontSize:isMobile?16:22,color:T.text,letterSpacing:'-0.3px',fontVariantNumeric:'tabular-nums',whiteSpace:'nowrap'}}>{fmtFull(acc.balance)}</p>
                    <p style={{...typo('caption'),color:T.textLight,marginTop:2,whiteSpace:'nowrap'}}>{isMobile?'balance':'current balance'}</p>
                  </div>
                  {!isMobile && <IconButton variant="surface" label="Manage">{ICONS.chevR()}</IconButton>}
                </div>
              </Card>
            ))}
          </div>
        )}
      </Section>

      <Section title="Cash Accounts">
        {cashAcc.map(acc=>(
          <Card key={acc.id} padding={isMobile?14:18}>
            <div style={{display:'flex',alignItems:'center',gap:12}}>
              <div style={{width:48,height:48,borderRadius:14,background:C.positiveSoft,color:C.positive,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
              </div>
              <div style={{flex:1}}>
                <p style={{...typo('body'),fontWeight:700,color:T.text,margin:0}}>{acc.bank}</p>
                <p style={{...typo('caption'),color:T.textMuted,margin:'2px 0 0'}}>physical cash on hand</p>
              </div>
              <div style={{textAlign:'right'}}>
                <p style={{fontFamily:FONT,fontWeight:700,fontSize:isMobile?18:22,color:T.text,letterSpacing:'-0.3px',fontVariantNumeric:'tabular-nums'}}>{fmtFull(acc.balance)}</p>
              </div>
            </div>
          </Card>
        ))}
      </Section>

      <Section title="Recent Transfers (Contra)">
        {TRANSFERS.length === 0 ? (
          <Card><EmptyState
            icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/></svg>}
            title="Koi transfer nahi"
            body="Bank-to-bank ya bank-to-cash transfer record karo"
            action={<Button variant="secondary" onClick={onTransfer}>Transfer Karo</Button>}/></Card>
        ) : (
          <Card padding={0}>
            {TRANSFERS.map((tr,i)=>{
              const from = BANK_ACCOUNTS.find(a=>a.id===tr.from);
              const to = BANK_ACCOUNTS.find(a=>a.id===tr.to);
              return(
                <div key={tr.id} style={{display:'flex',alignItems:'center',gap:12,padding:'14px 18px',borderBottom:i<TRANSFERS.length-1?`1px solid ${T.divider}`:'none'}}>
                  <div style={{width:40,height:40,borderRadius:12,background:T.surfaceAlt,color:T.textMuted,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <p style={{...typo('body'),fontWeight:600,color:T.text,margin:0}}>
                      {from?.bank} <span style={{color:T.textLight}}>→</span> {to?.bank}
                    </p>
                    <p style={{...typo('caption'),color:T.textMuted,margin:'2px 0 0'}}>
                      {new Date(tr.date).toLocaleDateString('en-IN',{day:'numeric',month:'short'})}
                      {tr.note && ` · ${tr.note}`}
                    </p>
                  </div>
                  <p style={{fontFamily:FONT,fontWeight:700,fontSize:16,color:T.text,fontVariantNumeric:'tabular-nums'}}>{fmtFull(tr.amount)}</p>
                </div>
              );
            })}
          </Card>
        )}
      </Section>
    </div>
  );
}

// ─── CREDIT / DEBIT NOTES SCREEN ─────────────────────────────────────────────

function NotesScreen({ isMobile, onNewNote }){
  const {theme:T} = useTheme();
  const { loading, error, retry } = useSimulatedFetch({delay:400});
  const [filter, setFilter] = React.useState('ALL');

  if(error) return <div style={{padding:'48px 14px'}}><ErrorState title="Notes load nahi ho sake" body={error} onRetry={retry}/></div>;

  const credit = NOTES.filter(n=>n.type==='CREDIT');
  const debit = NOTES.filter(n=>n.type==='DEBIT');
  const totalCredit = credit.reduce((s,n)=>s+n.amount,0);
  const totalDebit = debit.reduce((s,n)=>s+n.amount,0);

  const filters = [
    {k:'ALL',l:`Sab (${NOTES.length})`},
    {k:'CREDIT',l:`Credit (${credit.length})`},
    {k:'DEBIT',l:`Debit (${debit.length})`},
  ];

  const filtered = NOTES.filter(n=>filter==='ALL'||n.type===filter);

  return(
    <div style={{padding:isMobile?'18px 14px 100px':'24px 28px',maxWidth:1080,margin:'0 auto'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:18,gap:12,flexWrap:'wrap'}}>
        <div>
          <h1 style={{fontFamily:DISPLAY,fontSize:isMobile?24:30,fontWeight:600,color:T.text,letterSpacing:'-0.01em',margin:0}}>Credit / Debit Notes</h1>
          <p style={{...typo('bodySm'),color:T.textMuted,margin:'4px 0 0'}}>Sales returns aur purchase returns</p>
        </div>
        <div style={{display:'flex',gap:8}}>
          <Button onClick={()=>onNewNote('DEBIT')} variant="secondary" icon={ICONS.plus()}>Debit Note</Button>
          <Button onClick={()=>onNewNote('CREDIT')} icon={ICONS.plus()}>Credit Note</Button>
        </div>
      </div>

      {/* Summary */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:10,marginBottom:18}}>
        <Card padding={isMobile?14:18}>
          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6,minWidth:0}}>
            <span style={{width:8,height:8,borderRadius:'50%',background:C.warning,flexShrink:0}}/>
            <p style={{...typo('caption'),color:T.textMuted,fontWeight:600,margin:0,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',minWidth:0}}>Credit Notes</p>
          </div>
          <p style={{fontFamily:FONT,fontWeight:700,color:C.warning,fontSize:isMobile?18:22,letterSpacing:'-0.4px',fontVariantNumeric:'tabular-nums'}}>{fmtFull(totalCredit)}</p>
          <p style={{...typo('caption'),color:T.textLight,marginTop:2}}>{credit.length} · sales return</p>
        </Card>
        <Card padding={isMobile?14:18}>
          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6,minWidth:0}}>
            <span style={{width:8,height:8,borderRadius:'50%',background:C.negative,flexShrink:0}}/>
            <p style={{...typo('caption'),color:T.textMuted,fontWeight:600,margin:0,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',minWidth:0}}>Debit Notes</p>
          </div>
          <p style={{fontFamily:FONT,fontWeight:700,color:C.negative,fontSize:isMobile?18:22,letterSpacing:'-0.4px',fontVariantNumeric:'tabular-nums'}}>{fmtFull(totalDebit)}</p>
          <p style={{...typo('caption'),color:T.textLight,marginTop:2}}>{debit.length} · purchase return</p>
        </Card>
      </div>

      <div style={{display:'flex',gap:6,marginBottom:18,overflowX:'auto',paddingBottom:2}}>
        {filters.map(f=>{
          const active = filter===f.k;
          return(
            <button key={f.k} onClick={()=>setFilter(f.k)} style={{
              padding:'7px 14px',borderRadius:RADIUS.pill,border:`1px solid ${active?C.primary:T.border}`,
              background: active?C.primary:T.surface, color: active?'#fff':T.textMuted,
              ...typo('caption'),fontWeight:600, cursor:'pointer', fontFamily:FONT,
              whiteSpace:'nowrap', flexShrink:0,
            }}>{f.l}</button>
          );
        })}
      </div>

      {loading ? (
        <Card padding={0}>{[1,2,3].map(i=><ListRowSkel key={i}/>)}</Card>
      ) : filtered.length===0 ? (
        <Card><EmptyState
          icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/></svg>}
          title={filter!=='ALL'?'Koi note nahi mila':'Pehla note banao'}
          body={filter!=='ALL'?'Filter clear karo':'Returns aur adjustments yahaan record karo.'}
          action={filter!=='ALL'
            ? <Button variant="secondary" onClick={()=>setFilter('ALL')}>Filter Clear</Button>
            : <Button onClick={()=>onNewNote('CREDIT')} icon={ICONS.plus()}>Credit Note Banao</Button>}/></Card>
      ) : (
        <Card padding={0}>
          {filtered.map((n,i)=>{
            const party = getParty(n.partyId);
            const isCredit = n.type==='CREDIT';
            return(
              <div key={n.id} style={{display:'flex',alignItems:'center',gap:12,padding:'14px 18px',borderBottom:i<filtered.length-1?`1px solid ${T.divider}`:'none'}}>
                <div style={{width:40,height:40,borderRadius:12,background:isCredit?C.warningSoft:C.negativeSoft,color:isCredit?C.warning:C.negative,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    {isCredit
                      ? <><path d="M3 6h18M3 12h18M3 18h12"/></>
                      : <><path d="M3 6h18M3 12h18M3 18h12"/></>}
                  </svg>
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:2,flexWrap:'wrap'}}>
                    <span style={{...typo('body'),fontWeight:600,color:T.text}}>{party?.name||'—'}</span>
                    <Chip tone={isCredit?'warning':'negative'}>{isCredit?'Credit':'Debit'} Note</Chip>
                  </div>
                  <p style={{...typo('caption'),color:T.textMuted,margin:0,fontFamily:MONO}}>
                    {n.no} · {new Date(n.date).toLocaleDateString('en-IN',{day:'numeric',month:'short'})}
                    {n.billNo && ` · against ${n.billNo}`}
                  </p>
                  {n.reason && <p style={{...typo('caption'),color:T.textLight,margin:'2px 0 0',fontStyle:'italic'}}>"{n.reason}"</p>}
                </div>
                <div style={{textAlign:'right'}}>
                  <p style={{fontFamily:FONT,fontWeight:700,fontSize:16,color:isCredit?C.warning:C.negative,margin:0,fontVariantNumeric:'tabular-nums'}}>
                    {fmtFull(n.amount)}
                  </p>
                </div>
              </div>
            );
          })}
        </Card>
      )}
    </div>
  );
}

// ─── TRANSACTIONS (JOURNAL REGISTER) ────────────────────────────────────────

function TransactionsScreen({ isMobile, onNavigate, onBack }){
  const {theme:T} = useTheme();
  const { loading, error, retry } = useSimulatedFetch({delay:500});
  const [filter, setFilter] = React.useState('ALL');

  if(error) return <div style={{padding:'48px 14px'}}><ErrorState title="Transactions load nahi ho sake" body={error} onRetry={retry}/></div>;

  // Synthesize journal entries from all sources
  const journal = React.useMemo(()=>{
    const entries = [];
    BILLS.forEach(b => {
      const party = getParty(b.partyId);
      const subtotal = Math.round(b.amount/(1+b.gst/100));
      const tax = b.amount - subtotal;
      entries.push({
        id:b.id, ref:b.no, type:'SALES', date:b.date, party:party?.name,
        narration:`Sales bill to ${party?.name}`,
        lines:[
          { account: party?.name, debit: b.amount, credit: 0 },
          { account: 'Sales',     debit: 0,        credit: subtotal },
          { account: 'GST Output',debit: 0,        credit: tax },
        ],
        status: b.status,
      });
    });
    PURCHASES.forEach(p => {
      const party = getParty(p.partyId);
      const subtotal = Math.round(p.amount/(1+p.gst/100));
      const tax = p.amount - subtotal;
      entries.push({
        id:p.id, ref:p.no, type:'PURCHASE', date:p.date, party:party?.name,
        narration:`Purchase from ${party?.name}`,
        lines:[
          { account: 'Purchase', debit: subtotal, credit: 0 },
          { account: 'GST Input',debit: tax,      credit: 0 },
          { account: party?.name,debit: 0,        credit: p.amount },
        ],
        status: p.status,
      });
    });
    PAYMENTS.filter(p=>p.status==='COMPLETED').forEach(p => {
      const party = getParty(p.partyId);
      const isIn = p.direction==='INCOMING';
      entries.push({
        id:p.id, ref:p.id.toUpperCase(), type: isIn?'RECEIPT':'PAYMENT',
        date:p.date, party:party?.name,
        narration: isIn?`Receipt from ${party?.name} via ${p.mode}`:`Payment to ${party?.name} via ${p.mode}`,
        lines: isIn ? [
          { account: p.mode,      debit: p.amount, credit: 0 },
          { account: party?.name, debit: 0,        credit: p.amount },
        ] : [
          { account: party?.name, debit: p.amount, credit: 0 },
          { account: p.mode,      debit: 0,        credit: p.amount },
        ],
        status: 'COMPLETED',
      });
    });
    NOTES.forEach(n => {
      const party = getParty(n.partyId);
      const isCredit = n.type==='CREDIT';
      entries.push({
        id:n.id, ref:n.no, type: isCredit?'CREDIT_NOTE':'DEBIT_NOTE',
        date:n.date, party:party?.name, narration:n.reason,
        lines: isCredit ? [
          { account: 'Sales Returns', debit: n.amount, credit: 0 },
          { account: party?.name,     debit: 0,        credit: n.amount },
        ] : [
          { account: party?.name,         debit: n.amount, credit: 0 },
          { account: 'Purchase Returns',  debit: 0,        credit: n.amount },
        ],
        status: 'FINAL',
      });
    });
    return entries.sort((a,b)=>b.date.localeCompare(a.date));
  }, []);

  const filtered = journal.filter(e => filter==='ALL' || e.type===filter);

  const types = [
    {k:'ALL',l:'Sab'},
    {k:'SALES',l:'Sales'},
    {k:'PURCHASE',l:'Purchase'},
    {k:'RECEIPT',l:'Receipt'},
    {k:'PAYMENT',l:'Payment'},
    {k:'CREDIT_NOTE',l:'Credit Note'},
    {k:'DEBIT_NOTE',l:'Debit Note'},
  ];

  const typeColors = {
    SALES: C.positive, PURCHASE: C.info, RECEIPT: C.positive, PAYMENT: C.negative,
    CREDIT_NOTE: C.warning, DEBIT_NOTE: C.negative,
  };

  function exportCsv(){
    const rows = [['Date','Type','Reference','Particulars','Debit','Credit']];
    filtered.forEach(e => {
      e.lines.forEach(l => {
        rows.push([e.date, e.type, e.ref, l.account, l.debit, l.credit]);
      });
    });
    const csv = rows.map(r => r.map(c=>`"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], {type:'text/csv'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `transactions-${TODAY.toISOString().slice(0,10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
    if(window.__hk3_showToast) window.__hk3_showToast('CSV download ho gaya');
  }

  return(
    <div style={{padding:isMobile?'14px 14px 100px':'24px 28px',maxWidth:1280,margin:'0 auto'}}>
      <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:18}}>
        {onBack && <IconButton onClick={onBack} variant="surface" label="Back">{ICONS.chevL()}</IconButton>}
        <div style={{flex:1}}>
          <h1 style={{fontFamily:DISPLAY,fontSize:isMobile?24:30,fontWeight:600,color:T.text,letterSpacing:'-0.01em',margin:0}}>Transaction Register</h1>
          <p style={{...typo('bodySm'),color:T.textMuted,margin:'4px 0 0'}}>Double-entry journal — sab accounts ek jagah</p>
        </div>
        <Button onClick={exportCsv} variant="secondary" icon={ICONS.download()}>Export CSV</Button>
      </div>

      <div style={{display:'flex',gap:6,marginBottom:18,overflowX:'auto',paddingBottom:2}}>
        {types.map(t=>{
          const active = filter===t.k;
          return(
            <button key={t.k} onClick={()=>setFilter(t.k)} style={{
              padding:'7px 14px',borderRadius:RADIUS.pill,border:`1px solid ${active?C.primary:T.border}`,
              background: active?C.primary:T.surface, color: active?'#fff':T.textMuted,
              ...typo('caption'),fontWeight:600, cursor:'pointer', whiteSpace:'nowrap', fontFamily:FONT,
            }}>{t.l}</button>
          );
        })}
      </div>

      {loading ? (
        <Card padding={0}>{[1,2,3,4,5].map(i=><ListRowSkel key={i}/>)}</Card>
      ) : filtered.length === 0 ? (
        <Card><EmptyState
          icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>}
          title={filter!=='ALL'?'Is type ka koi transaction nahi':'Koi transactions nahi'}
          body={filter!=='ALL'?'Filter change karke try karo':'Bills, payments, notes — sab yahaan dikhega.'}
          action={filter!=='ALL' && <Button variant="secondary" onClick={()=>setFilter('ALL')}>Sab Dikhao</Button>}/></Card>
      ) : isMobile ? (
        // Mobile: card list — stacked rows so account name + Dr/Cr don't collide
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          {filtered.map(e=>(
            <Card key={e.id} padding={14}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:10,gap:10}}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:4,flexWrap:'wrap'}}>
                    <Chip tone={e.type==='SALES'||e.type==='RECEIPT'?'positive':e.type==='PURCHASE'?'info':e.type==='CREDIT_NOTE'?'warning':'negative'}>
                      {e.type.replace('_',' ')}
                    </Chip>
                    <span style={{...typo('caption'),fontFamily:MONO,color:T.textMuted,whiteSpace:'nowrap'}}>{e.ref}</span>
                  </div>
                  <p style={{...typo('bodySm'),color:T.text,fontWeight:600,margin:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{e.party}</p>
                </div>
                <span style={{...typo('caption'),color:T.textMuted,whiteSpace:'nowrap',flexShrink:0}}>{new Date(e.date).toLocaleDateString('en-IN',{day:'numeric',month:'short'})}</span>
              </div>
              <div style={{background:T.surfaceAlt,borderRadius:RADIUS.sm,padding:'8px 10px'}}>
                {e.lines.map((l,i)=>(
                  <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'6px 0',gap:10,borderTop:i>0?`1px solid ${T.divider}`:'none'}}>
                    <span style={{...typo('caption'),color:T.text,flex:1,minWidth:0,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{l.account}</span>
                    <span style={{fontFamily:FONT,fontWeight:700,fontVariantNumeric:'tabular-nums',fontSize:12,whiteSpace:'nowrap',flexShrink:0}}>
                      {l.debit>0 && <span style={{color:C.negative}}>Dr {fmtFull(l.debit)}</span>}
                      {l.credit>0 && <span style={{color:C.positive}}>Cr {fmtFull(l.credit)}</span>}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      ) : (
        // Desktop: table
        <Card padding={0} style={{overflow:'hidden'}}>
          <div style={{overflowX:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontFamily:FONT}}>
              <thead>
                <tr style={{background:T.surfaceAlt,borderBottom:`1px solid ${T.border}`}}>
                  {['Date','Voucher','Particulars','Debit','Credit'].map((h,i)=>(
                    <th key={h} style={{padding:'12px 16px',textAlign:i>=3?'right':'left',...typo('caption'),color:T.textMuted,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.3px',whiteSpace:'nowrap'}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(e =>
                  e.lines.map((l,i) => (
                    <tr key={`${e.id}-${i}`} style={{borderBottom:i===e.lines.length-1?`1px solid ${T.border}`:`1px solid ${T.divider}`}}>
                      <td style={{padding:'10px 16px',...typo('bodySm'),color:T.textMuted,whiteSpace:'nowrap'}}>
                        {i===0 ? new Date(e.date).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'2-digit'}) : ''}
                      </td>
                      <td style={{padding:'10px 16px',whiteSpace:'nowrap'}}>
                        {i===0 && (
                          <div>
                            <Chip tone={e.type==='SALES'||e.type==='RECEIPT'?'positive':e.type==='PURCHASE'?'info':e.type==='CREDIT_NOTE'?'warning':'negative'}>
                              {e.type.replace('_',' ')}
                            </Chip>
                            <p style={{...typo('caption'),fontFamily:MONO,color:T.textLight,margin:'4px 0 0'}}>{e.ref}</p>
                          </div>
                        )}
                      </td>
                      <td style={{padding:'10px 16px',...typo('bodySm'),color:T.text}}>
                        <p style={{margin:0,fontWeight:600}}>{l.account}</p>
                        {i===0 && e.narration && <p style={{...typo('caption'),color:T.textMuted,margin:'2px 0 0',fontStyle:'italic'}}>{e.narration}</p>}
                      </td>
                      <td style={{padding:'10px 16px',textAlign:'right',fontFamily:FONT,fontVariantNumeric:'tabular-nums',color:l.debit>0?C.negative:T.textLight,fontWeight:l.debit>0?700:400,...typo('bodySm')}}>
                        {l.debit>0?fmtFull(l.debit):'—'}
                      </td>
                      <td style={{padding:'10px 16px',textAlign:'right',fontFamily:FONT,fontVariantNumeric:'tabular-nums',color:l.credit>0?C.positive:T.textLight,fontWeight:l.credit>0?700:400,...typo('bodySm')}}>
                        {l.credit>0?fmtFull(l.credit):'—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

// ─── NEW NOTE SHEET ──────────────────────────────────────────────────────────

function NewNoteSheet({ open, onClose, isMobile, defaultType='CREDIT' }){
  const {theme:T} = useTheme();
  const [type, setType] = React.useState(defaultType);
  const [partyId, setPartyId] = React.useState(PARTIES[0].id);
  const [billNo, setBillNo] = React.useState('');
  const [amount, setAmount] = React.useState('');
  const [reason, setReason] = React.useState('');
  const [saving, setSaving] = React.useState(false);

  React.useEffect(()=>{ setType(defaultType); }, [defaultType]);

  const eligibleParties = type==='CREDIT'
    ? PARTIES.filter(p=>p.type==='CUSTOMER')
    : PARTIES.filter(p=>p.type==='SUPPLIER');

  React.useEffect(()=>{
    if(eligibleParties.length > 0 && !eligibleParties.find(p=>p.id===partyId)){
      setPartyId(eligibleParties[0].id);
    }
  }, [type]);

  async function handleSave(){
    setSaving(true);
    await new Promise(r=>setTimeout(r,500));
    setSaving(false);
    onClose();
    if(window.__hk3_showToast) window.__hk3_showToast(`${type==='CREDIT'?'Credit':'Debit'} note ho gaya`);
  }

  return(
    <Sheet open={open} onClose={onClose} title={`Naya ${type==='CREDIT'?'Credit':'Debit'} Note`} isMobile={isMobile} width={460}
      footer={<Button onClick={handleSave} disabled={!amount||saving} fullWidth icon={saving?null:ICONS.check()}>{saving?'Saving...':'Save'}</Button>}>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:16}}>
        {[
          {id:'CREDIT',label:'Credit Note',sub:'Sales return',color:C.warning},
          {id:'DEBIT', label:'Debit Note', sub:'Purchase return',color:C.negative},
        ].map(d=>{
          const active = type===d.id;
          return(
            <button key={d.id} onClick={()=>setType(d.id)} style={{
              padding:'14px',borderRadius:RADIUS.md,
              border:`1.5px solid ${active?d.color:T.border}`,
              background:active?d.color+'10':T.surface,
              cursor:'pointer',color:active?d.color:T.text,
              display:'flex',flexDirection:'column',alignItems:'center',gap:2,
            }}>
              <span style={{...typo('h3'),fontWeight:700}}>{d.label}</span>
              <span style={{...typo('caption'),color:T.textMuted}}>{d.sub}</span>
            </button>
          );
        })}
      </div>

      <div style={{display:'flex',flexDirection:'column',gap:14}}>
        <Select label={type==='CREDIT'?'Customer':'Supplier'} value={partyId} onChange={setPartyId}
          options={eligibleParties.map(p=>({value:p.id,label:p.name}))} required/>
        <Input label="Against Bill" value={billNo} onChange={setBillNo} placeholder="B-2605-018" optional/>
        <Input label="Amount" type="number" value={amount} onChange={setAmount} placeholder="0" prefix="₹" required/>
        <Input label="Reason" value={reason} onChange={setReason} placeholder="Saman wapasi, discount, quality issue..." required/>
      </div>
    </Sheet>
  );
}

// ─── TRANSFER SHEET ──────────────────────────────────────────────────────────

function TransferSheet({ open, onClose, isMobile }){
  const {theme:T} = useTheme();
  const [from, setFrom] = React.useState(BANK_ACCOUNTS[0].id);
  const [to, setTo] = React.useState(BANK_ACCOUNTS[1].id);
  const [amount, setAmount] = React.useState('');
  const [note, setNote] = React.useState('');
  const [saving, setSaving] = React.useState(false);

  async function handleSave(){
    setSaving(true);
    await new Promise(r=>setTimeout(r,500));
    setSaving(false);
    onClose();
    if(window.__hk3_showToast) window.__hk3_showToast('Transfer record ho gaya');
  }

  return(
    <Sheet open={open} onClose={onClose} title="Transfer (Contra)" subtitle="Bank to bank ya cash" isMobile={isMobile} width={440}
      footer={<Button onClick={handleSave} disabled={!amount||from===to||saving} fullWidth icon={saving?null:ICONS.check()}>{saving?'Saving...':'Transfer Karo'}</Button>}>
      <div style={{display:'flex',flexDirection:'column',gap:14}}>
        <Select label="Kahan se (From)" value={from} onChange={setFrom}
          options={BANK_ACCOUNTS.map(a=>({value:a.id,label:`${a.bank}${a.last4?' ****'+a.last4:''} · ${fmtFull(a.balance)}`}))}/>
        <div style={{display:'flex',justifyContent:'center'}}>
          <div style={{width:36,height:36,borderRadius:12,background:T.surfaceAlt,color:T.textMuted,display:'flex',alignItems:'center',justifyContent:'center'}}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>
          </div>
        </div>
        <Select label="Kahan ko (To)" value={to} onChange={setTo}
          options={BANK_ACCOUNTS.filter(a=>a.id!==from).map(a=>({value:a.id,label:`${a.bank}${a.last4?' ****'+a.last4:''}`}))}/>
        <Input label="Amount" type="number" value={amount} onChange={setAmount} placeholder="0" prefix="₹" required/>
        <Input label="Note" value={note} onChange={setNote} placeholder="Cash withdrawal, deposit..." optional/>
        {from===to && <p style={{...typo('caption'),color:C.negative}}>Same account select kiya hai. Different choose karo.</p>}
      </div>
    </Sheet>
  );
}

Object.assign(window, {
  PurchasesScreen, BankingScreen, NotesScreen, TransactionsScreen,
  NewNoteSheet, TransferSheet,
});
