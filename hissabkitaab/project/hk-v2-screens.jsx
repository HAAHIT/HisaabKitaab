
// hk-v2-screens.jsx — Bills, Parties, Payments screens

const { OR, PU, GR, AM, SG, IN, fmt, fmtFull, useIsMobile,
  BILLS_DATA, PARTIES_DATA, PAYMENTS_DATA,
  Card, CardHead, DateBadge, DeltaBadge, StatusChip } = window;

// ─── BILLS SCREEN ─────────────────────────────────────────────────────────────

function BillsScreen({T, isMobile, onNewBill}){
  const [search, setSearch] = React.useState('');
  const [filter, setFilter] = React.useState('SAB');
  const filters = [{k:'SAB',l:'Sab'},{k:'FINAL',l:'Pakka'},{k:'DRAFT',l:'Draft'},{k:'CANCELLED',l:'Raddh'}];

  const filtered = BILLS_DATA.filter(b => {
    const matchS = b.party.toLowerCase().includes(search.toLowerCase()) || b.id.toLowerCase().includes(search.toLowerCase());
    const matchF = filter === 'SAB' || b.status === filter;
    return matchS && matchF;
  });
  const april = filtered.filter(b => b.date.includes('Apr'));
  const march = filtered.filter(b => b.date.includes('Mar'));

  const totalApr = april.reduce((s,b)=>s+b.amount,0);
  const totalMar = march.reduce((s,b)=>s+b.amount,0);

  return(
    <div style={{fontFamily:SG, background:T.bg, minHeight:'100%', paddingBottom: isMobile?90:0}}>
      {/* Page header */}
      <div style={{padding:isMobile?'16px 14px 10px':'20px 28px 10px', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
        <div>
          <h1 style={{fontSize:isMobile?20:24, fontWeight:700, color:T.text, letterSpacing:'-0.5px'}}>Mere Bills</h1>
          <p style={{color:T.sub, fontSize:12, marginTop:3}}>Apne sab bills yahaan</p>
        </div>
        {!isMobile && (
          <button onClick={onNewBill}
            style={{display:'flex',alignItems:'center',gap:7,padding:'9px 20px',borderRadius:12,background:`linear-gradient(135deg,${OR},${PU})`,color:'#fff',fontSize:13,fontWeight:700,fontFamily:SG,border:'none',cursor:'pointer',boxShadow:`0 4px 16px ${OR}44`}}>
            + Naya Bill Banao
          </button>
        )}
      </div>

      <div style={{padding:isMobile?'0 14px':'0 28px'}}>
        {/* Summary strip */}
        <div style={{display:'grid', gridTemplateColumns:`repeat(${isMobile?2:4},1fr)`, gap:10, marginBottom:16}}>
          {[
            {l:'Kul Bills', v:BILLS_DATA.length, sub:'is mahine', c:T.text},
            {l:'Pakka',     v:BILLS_DATA.filter(b=>b.status==='FINAL').length, sub:'finalized', c:GR},
            {l:'Draft',     v:BILLS_DATA.filter(b=>b.status==='DRAFT').length, sub:'pending',  c:AM},
            {l:'Raddh',     v:BILLS_DATA.filter(b=>b.status==='CANCELLED').length, sub:'cancelled', c:OR},
          ].map((item,i)=>(
            <div key={i} style={{padding:'12px 14px',borderRadius:14,background:T.card,border:`1px solid ${T.border}`}}>
              <p style={{fontSize:10,fontWeight:600,color:T.sub,textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:4}}>{item.l}</p>
              <p style={{fontSize:22,fontWeight:800,color:item.c,fontFamily:IN,lineHeight:1}}>{item.v}</p>
              <p style={{fontSize:10,color:T.muted,marginTop:2}}>{item.sub}</p>
            </div>
          ))}
        </div>

        {/* Search + filter bar */}
        <div style={{display:'flex',gap:10,marginBottom:16,flexWrap:'wrap'}}>
          <div style={{flex:1,minWidth:160,position:'relative'}}>
            <svg style={{position:'absolute',left:11,top:'50%',transform:'translateY(-50%)',color:T.muted}} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Bill dhundho..."
              style={{width:'100%',padding:'9px 12px 9px 32px',borderRadius:10,border:`1.5px solid ${T.border}`,background:T.input,color:T.text,fontSize:13,fontFamily:SG,boxSizing:'border-box',outline:'none'}}
              onFocus={e=>e.target.style.borderColor=OR} onBlur={e=>e.target.style.borderColor=T.border}/>
          </div>
          <div style={{display:'flex',gap:5,background:T.pill,borderRadius:10,padding:'4px'}}>
            {filters.map(f=>(
              <button key={f.k} onClick={()=>setFilter(f.k)}
                style={{padding:'6px 12px',borderRadius:7,border:'none',fontSize:12,fontWeight:filter===f.k?700:400,color:filter===f.k?T.text:T.sub,background:filter===f.k?T.pillActive:'transparent',cursor:'pointer',fontFamily:SG,transition:'all 0.15s'}}>
                {f.l}
              </button>
            ))}
          </div>
        </div>

        {/* Bill groups */}
        {[{label:'April 2025', bills:april, total:totalApr}, {label:'March 2025', bills:march, total:totalMar}].map(group=>(
          group.bills.length === 0 ? null :
          <div key={group.label} style={{marginBottom:20}}>
            {/* Month header */}
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'7px 12px',borderRadius:10,background:T.badge,border:`1px solid ${T.border}`,marginBottom:8}}>
              <span style={{fontSize:13,fontWeight:700,color:T.text}}>{group.label}</span>
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <span style={{fontSize:12,fontWeight:600,color:T.sub,fontFamily:IN}}>{fmtFull(group.total)}</span>
                <span style={{fontSize:11,color:T.muted}}>· {group.bills.length} bills</span>
              </div>
            </div>

            {/* Bill rows */}
            <Card T={T} style={{padding:'0 16px'}}>
              {group.bills.map((bill,i)=>(
                <div key={bill.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'13px 0',borderBottom:i<group.bills.length-1?`1px solid ${T.border}`:'none',cursor:'pointer'}}>
                  <div style={{display:'flex',gap:12,alignItems:'center'}}>
                    <div style={{width:36,height:36,borderRadius:10,background:bill.status==='FINAL'?GR+'18':bill.status==='DRAFT'?AM+'18':OR+'18',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={bill.status==='FINAL'?GR:bill.status==='DRAFT'?AM:OR} strokeWidth="2" strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                    </div>
                    <div>
                      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:2}}>
                        <span style={{fontSize:12,fontWeight:700,color:T.muted,fontFamily:IN}}>{bill.id}</span>
                        <StatusChip status={bill.status}/>
                      </div>
                      <p style={{fontSize:13,fontWeight:600,color:T.text,marginBottom:1}}>{bill.party}</p>
                      <p style={{fontSize:11,color:T.muted}}>{bill.date}</p>
                    </div>
                  </div>
                  <div style={{textAlign:'right'}}>
                    <p style={{fontSize:16,fontWeight:800,color:T.text,fontFamily:IN}}>{fmtFull(bill.amount)}</p>
                    <svg style={{color:T.muted,marginTop:2}} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="m9 18 6-6-6-6"/></svg>
                  </div>
                </div>
              ))}
            </Card>
          </div>
        ))}

        {filtered.length===0 && (
          <div style={{textAlign:'center',padding:'60px 20px',color:T.sub}}>
            <div style={{fontSize:44,marginBottom:14}}>📋</div>
            <p style={{fontWeight:700,fontSize:16,color:T.text,marginBottom:6}}>Koi bill nahi mila</p>
            <p style={{fontSize:13}}>Search badlo ya naya bill banao</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── PARTIES / UDHAR KHATA SCREEN ─────────────────────────────────────────────

function PartiesScreen({T, isMobile}){
  const [search, setSearch] = React.useState('');
  const [filter, setFilter] = React.useState('SAB');

  const filtered = PARTIES_DATA.filter(p => {
    const matchS = p.name.toLowerCase().includes(search.toLowerCase());
    const matchF = filter==='SAB' || (filter==='GRAHAK'&&p.type==='CUSTOMER') || (filter==='SUPPLIER'&&p.type==='SUPPLIER');
    return matchS && matchF;
  });

  const totalRec = PARTIES_DATA.filter(p=>p.balance>0).reduce((s,p)=>s+p.balance,0);
  const totalPay = Math.abs(PARTIES_DATA.filter(p=>p.balance<0).reduce((s,p)=>s+p.balance,0));

  return(
    <div style={{fontFamily:SG, background:T.bg, minHeight:'100%', paddingBottom:isMobile?90:0}}>
      {/* Header */}
      <div style={{padding:isMobile?'16px 14px 10px':'20px 28px 10px', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
        <div>
          <h1 style={{fontSize:isMobile?20:24,fontWeight:700,color:T.text,letterSpacing:'-0.5px'}}>Udhar Khata</h1>
          <p style={{color:T.sub,fontSize:12,marginTop:3}}>Party-wise hisaab</p>
        </div>
        <button style={{padding:'8px 16px',borderRadius:10,background:`linear-gradient(135deg,${OR},${PU})`,color:'#fff',fontSize:13,fontWeight:700,fontFamily:SG,border:'none',cursor:'pointer',boxShadow:`0 4px 12px ${OR}44`}}>
          + Party Jodo
        </button>
      </div>

      <div style={{padding:isMobile?'0 14px':'0 28px'}}>
        {/* Summary strip */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:16}}>
          <div style={{padding:'14px 16px',borderRadius:14,background:GR+'14',border:`1px solid ${GR}28`}}>
            <p style={{fontSize:10,fontWeight:700,color:GR,textTransform:'uppercase',letterSpacing:'0.6px',marginBottom:4}}>↑ Lena Baki</p>
            <p style={{fontSize:isMobile?20:24,fontWeight:800,color:T.text,fontFamily:IN,letterSpacing:'-0.5px'}}>{fmtFull(totalRec)}</p>
            <p style={{fontSize:11,color:GR,marginTop:2}}>{PARTIES_DATA.filter(p=>p.balance>0).length} parties se milna hai</p>
          </div>
          <div style={{padding:'14px 16px',borderRadius:14,background:OR+'14',border:`1px solid ${OR}28`}}>
            <p style={{fontSize:10,fontWeight:700,color:OR,textTransform:'uppercase',letterSpacing:'0.6px',marginBottom:4}}>↓ Dena Baki</p>
            <p style={{fontSize:isMobile?20:24,fontWeight:800,color:T.text,fontFamily:IN,letterSpacing:'-0.5px'}}>{fmtFull(totalPay)}</p>
            <p style={{fontSize:11,color:OR,marginTop:2}}>{PARTIES_DATA.filter(p=>p.balance<0).length} parties ko dena hai</p>
          </div>
        </div>

        {/* Search + filter */}
        <div style={{display:'flex',gap:8,marginBottom:16,flexWrap:'wrap'}}>
          <div style={{flex:1,minWidth:160,position:'relative'}}>
            <svg style={{position:'absolute',left:11,top:'50%',transform:'translateY(-50%)',color:T.muted}} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Party dhundho..."
              style={{width:'100%',padding:'9px 12px 9px 32px',borderRadius:10,border:`1.5px solid ${T.border}`,background:T.input,color:T.text,fontSize:13,fontFamily:SG,boxSizing:'border-box',outline:'none'}}
              onFocus={e=>e.target.style.borderColor=OR} onBlur={e=>e.target.style.borderColor=T.border}/>
          </div>
          {['SAB','GRAHAK','SUPPLIER'].map(f=>(
            <button key={f} onClick={()=>setFilter(f)}
              style={{padding:'8px 14px',borderRadius:10,border:`1px solid ${filter===f?OR:T.border}`,background:filter===f?OR+'18':T.badge,color:filter===f?OR:T.sub,fontSize:12,fontWeight:filter===f?700:400,fontFamily:SG,cursor:'pointer',transition:'all 0.15s'}}>
              {f==='SAB'?'Sab':f==='GRAHAK'?'Grahak':'Supplier'}
            </button>
          ))}
        </div>

        {/* Party list */}
        <Card T={T} style={{padding:'0 16px'}}>
          {filtered.map((p,i)=>(
            <div key={p.id} style={{display:'flex',alignItems:'center',gap:12,padding:'13px 0',borderBottom:i<filtered.length-1?`1px solid ${T.border}`:'none',cursor:'pointer'}}>
              <div style={{width:42,height:42,borderRadius:12,background:(p.balance>0?GR:OR)+'20',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                <span style={{fontSize:13,fontWeight:800,color:p.balance>0?GR:OR,fontFamily:IN}}>{p.init}</span>
              </div>
              <div style={{flex:1}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
                  <div>
                    <p style={{fontSize:14,fontWeight:700,color:T.text,marginBottom:2}}>{p.name}</p>
                    <div style={{display:'flex',gap:6,alignItems:'center'}}>
                      <span style={{fontSize:10,fontWeight:600,color:p.type==='CUSTOMER'?PU:T.sub,background:p.type==='CUSTOMER'?PU+'18':T.badge,padding:'2px 7px',borderRadius:5}}>
                        {p.type==='CUSTOMER'?'Grahak':'Supplier'}
                      </span>
                      <span style={{fontSize:11,color:T.muted}}>{p.phone}</span>
                    </div>
                  </div>
                  <div style={{textAlign:'right'}}>
                    <p style={{fontSize:16,fontWeight:800,color:p.balance>0?GR:OR,fontFamily:IN}}>{p.balance>0?'+':'-'}{fmt(Math.abs(p.balance))}</p>
                    <p style={{fontSize:10,color:T.muted,marginTop:2}}>{p.balance>0?'Lena Baki':'Dena Baki'}</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}

// ─── PAYMENTS SCREEN ──────────────────────────────────────────────────────────

function PaymentsScreen({T, isMobile}){
  const [filter, setFilter] = React.useState('SAB');
  const filtered = PAYMENTS_DATA.filter(p => filter==='SAB' || p.dir===filter);
  const totalIn  = PAYMENTS_DATA.filter(p=>p.dir==='IN').reduce((s,p)=>s+p.amount,0);
  const totalOut = PAYMENTS_DATA.filter(p=>p.dir==='OUT').reduce((s,p)=>s+p.amount,0);

  const modeColors = {UPI:PU, NEFT:GR, Cash:AM, Cheque:OR};

  return(
    <div style={{fontFamily:SG, background:T.bg, minHeight:'100%', paddingBottom:isMobile?90:0}}>
      {/* Header */}
      <div style={{padding:isMobile?'16px 14px 10px':'20px 28px 10px', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
        <div>
          <h1 style={{fontSize:isMobile?20:24,fontWeight:700,color:T.text,letterSpacing:'-0.5px'}}>Payments</h1>
          <p style={{color:T.sub,fontSize:12,marginTop:3}}>Aana-jaana sab yahaan</p>
        </div>
        <button style={{padding:'8px 16px',borderRadius:10,background:`linear-gradient(135deg,${GR},#0aab74)`,color:'#fff',fontSize:13,fontWeight:700,fontFamily:SG,border:'none',cursor:'pointer',boxShadow:`0 4px 12px ${GR}44`}}>
          + Payment Likho
        </button>
      </div>

      <div style={{padding:isMobile?'0 14px':'0 28px'}}>
        {/* Summary strip */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10,marginBottom:16}}>
          {[
            {l:'Mila ↓',    v:totalIn,           c:GR,  sub:'received'},
            {l:'Diya ↑',    v:totalOut,          c:OR,  sub:'paid out'},
            {l:'Net',       v:totalIn-totalOut,  c:PU,  sub:'this month'},
          ].map((item,i)=>(
            <div key={i} style={{padding:'12px 14px',borderRadius:14,background:item.c+'14',border:`1px solid ${item.c}25`}}>
              <p style={{fontSize:10,fontWeight:700,color:item.c,textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:4}}>{item.l}</p>
              <p style={{fontSize:isMobile?16:20,fontWeight:800,color:T.text,fontFamily:IN,lineHeight:1}}>{fmt(item.v)}</p>
              <p style={{fontSize:10,color:T.muted,marginTop:2}}>{item.sub}</p>
            </div>
          ))}
        </div>

        {/* Filter */}
        <div style={{display:'flex',gap:5,background:T.pill,borderRadius:10,padding:'4px',marginBottom:14,alignSelf:'flex-start',width:'fit-content'}}>
          {[{k:'SAB',l:'Sab'},{k:'IN',l:'Mila'},{k:'OUT',l:'Diya'}].map(f=>(
            <button key={f.k} onClick={()=>setFilter(f.k)}
              style={{padding:'6px 16px',borderRadius:7,border:'none',fontSize:12,fontWeight:filter===f.k?700:400,color:filter===f.k?T.text:T.sub,background:filter===f.k?T.pillActive:'transparent',cursor:'pointer',fontFamily:SG,transition:'all 0.15s'}}>
              {f.l}
            </button>
          ))}
        </div>

        {/* Payment list */}
        <Card T={T} style={{padding:'0 16px'}}>
          {filtered.map((p,i)=>(
            <div key={p.id} style={{display:'flex',alignItems:'center',gap:12,padding:'13px 0',borderBottom:i<filtered.length-1?`1px solid ${T.border}`:'none',cursor:'pointer'}}>
              <div style={{width:40,height:40,borderRadius:12,background:(p.dir==='IN'?GR:OR)+'18',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={p.dir==='IN'?GR:OR} strokeWidth="2.5" strokeLinecap="round">
                  {p.dir==='IN'
                    ? <><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></>
                    : <><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></>
                  }
                </svg>
              </div>
              <div style={{flex:1}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
                  <div>
                    <p style={{fontSize:14,fontWeight:700,color:T.text,marginBottom:3}}>{p.party}</p>
                    <div style={{display:'flex',gap:7,alignItems:'center'}}>
                      <span style={{fontSize:10,fontWeight:700,color:modeColors[p.mode]||T.sub,background:(modeColors[p.mode]||T.sub)+'18',padding:'2px 7px',borderRadius:5}}>{p.mode}</span>
                      <span style={{fontSize:11,color:T.muted}}>{p.date}</span>
                      {p.note && <span style={{fontSize:11,color:T.muted}}>· {p.note}</span>}
                    </div>
                  </div>
                  <div style={{textAlign:'right'}}>
                    <p style={{fontSize:16,fontWeight:800,color:p.dir==='IN'?GR:OR,fontFamily:IN}}>
                      {p.dir==='IN'?'+':'-'}{fmtFull(p.amount)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}

Object.assign(window, {BillsScreen, PartiesScreen, PaymentsScreen});
