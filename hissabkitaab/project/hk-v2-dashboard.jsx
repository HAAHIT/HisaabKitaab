
// hk-v2-dashboard.jsx — Dashboard screen with all chart cards

const { OR, PU, GR, AM, SG, IN, fmt, fmtFull, MONTHLY_DATA, WEEKLY_DATA, PAY6M_DATA,
  Card, CardHead, DateBadge, DeltaBadge, IconBtn } = window;

// ── SVG chart helpers ─────────────────────────────────────────────────────────

function makePts(data,key,W,H,max){
  return data.map((d,i)=>({x:(i/(data.length-1))*W, y:H-(d[key]/max)*(H-12)-6}));
}
function bezier(P){
  if(!P||P.length<2) return '';
  let d=`M${P[0].x.toFixed(1)},${P[0].y.toFixed(1)}`;
  for(let i=1;i<P.length;i++){
    const cp=(P[i-1].x+P[i].x)/2;
    d+=` C${cp.toFixed(1)},${P[i-1].y.toFixed(1)} ${cp.toFixed(1)},${P[i].y.toFixed(1)} ${P[i].x.toFixed(1)},${P[i].y.toFixed(1)}`;
  }
  return d;
}
function areaPath(P,H){ return bezier(P)+` L${P[P.length-1].x.toFixed(1)},${H} L${P[0].x.toFixed(1)},${H} Z`; }

// ── Overview Card ─────────────────────────────────────────────────────────────

function OverviewCard({T,isMobile}){
  const [active,setActive]=React.useState(9);
  const W=560, H=isMobile?110:148, max=500;
  const bPts=makePts(MONTHLY_DATA,'b',W,H,max);
  const cPts=makePts(MONTHLY_DATA,'c',W,H,max);

  const metrics=[
    {label:'Kul Billed',   value:4567800, color:PU, delta:18},
    {label:'Wapas Mila',   value:2875000, color:OR, delta:12},
    {label:'Baaki Baki',   value:1692800, color:GR, delta:-4},
  ];

  return(
    <Card T={T}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:18}}>
        <div style={{display:'grid',gridTemplateColumns:isMobile?'repeat(3,1fr)':'repeat(3,1fr)',gap:0,flex:1}}>
          {metrics.map((m,i)=>(
            <div key={i} style={{paddingRight:isMobile?10:22,borderRight:i<2?`1px solid ${T.border}`:'none',paddingLeft:i>0?(isMobile?10:22):0}}>
              <p style={{color:T.sub,fontSize:10,fontFamily:SG,marginBottom:4}}>{m.label}</p>
              <div style={{display:'flex',alignItems:'center',gap:6,flexWrap:'wrap'}}>
                <span style={{fontSize:isMobile?16:24,fontWeight:800,color:T.text,fontFamily:IN,letterSpacing:'-1px',lineHeight:1}}>{fmt(m.value)}</span>
                <DeltaBadge T={T} val={m.delta} color={m.color}/>
              </div>
            </div>
          ))}
        </div>
        {!isMobile && (
          <div style={{display:'flex',gap:5,flexShrink:0,marginLeft:16}}>
            {['1M','3M','6M','1Y'].map(f=>(
              <button key={f} style={{padding:'4px 11px',borderRadius:8,border:`1px solid ${f==='1Y'?OR:T.border}`,background:f==='1Y'?OR:T.badge,color:f==='1Y'?'#fff':T.sub,fontSize:12,fontWeight:600,fontFamily:SG,cursor:'pointer'}}>
                {f}
              </button>
            ))}
          </div>
        )}
      </div>

      <div style={{height:1,background:T.border,marginBottom:16}}/>

      <svg viewBox={`0 0 ${W} ${H}`} style={{width:'100%',height:'auto',overflow:'visible',display:'block'}}>
        <defs>
          <linearGradient id="v2gPU" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={PU} stopOpacity="0.28"/><stop offset="100%" stopColor={PU} stopOpacity="0"/>
          </linearGradient>
          <linearGradient id="v2gOR" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={OR} stopOpacity="0.28"/><stop offset="100%" stopColor={OR} stopOpacity="0"/>
          </linearGradient>
        </defs>
        {[100,200,300,400].map(v=>(
          <line key={v} x1="0" y1={H-(v/max)*(H-12)-6} x2={W} y2={H-(v/max)*(H-12)-6} stroke={T.line} strokeWidth="1"/>
        ))}
        <path d={areaPath(bPts,H)} fill="url(#v2gPU)"/>
        <path d={areaPath(cPts,H)} fill="url(#v2gOR)"/>
        <path d={bezier(bPts)} fill="none" stroke={PU} strokeWidth="2.2" strokeLinecap="round"/>
        <path d={bezier(cPts)} fill="none" stroke={OR} strokeWidth="2.2" strokeLinecap="round"/>
        <line x1={bPts[active].x} y1="0" x2={bPts[active].x} y2={H} stroke={T.border} strokeWidth="1.5" strokeDasharray="4 3"/>
        <circle cx={bPts[active].x} cy={bPts[active].y} r="10" fill={PU} fillOpacity="0.18"/>
        <circle cx={bPts[active].x} cy={bPts[active].y} r="5" fill={PU}/>
        <circle cx={cPts[active].x} cy={cPts[active].y} r="10" fill={OR} fillOpacity="0.18"/>
        <circle cx={cPts[active].x} cy={cPts[active].y} r="5" fill={OR}/>
      </svg>

      <div style={{display:'flex',justifyContent:'space-between',marginTop:6}}>
        {MONTHLY_DATA.map((d,i)=>(
          <span key={d.m} onClick={()=>setActive(i)} style={{fontSize:isMobile?9:11,fontFamily:SG,cursor:'pointer',padding:'2px 4px',borderRadius:6,fontWeight:i===active?700:400,color:i===active?T.text:T.muted,background:i===active?T.badge:'transparent',transition:'all 0.15s'}}>
            {d.m}
          </span>
        ))}
      </div>

      <div style={{display:'flex',gap:18,marginTop:12}}>
        {[{c:PU,l:'Kul Billed'},{c:OR,l:'Wapas Mila'}].map(item=>(
          <div key={item.l} style={{display:'flex',alignItems:'center',gap:7}}>
            <div style={{width:20,height:3,borderRadius:2,background:item.c}}/>
            <span style={{fontSize:11,color:T.sub,fontFamily:SG}}>{item.l}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ── Bills Bar Card ────────────────────────────────────────────────────────────

function BillsBarCard({T}){
  const max=Math.max(...WEEKLY_DATA.flatMap(d=>[d.a,d.b]));
  return(
    <Card T={T}>
      <CardHead T={T} label="Bills" title="Is Hafte"
        right={<DateBadge T={T} text="29 Apr"/>}/>
      <div style={{display:'flex',gap:12,marginBottom:14}}>
        {[{c:OR,l:'Is hafte'},{c:PU+'99',l:'Pichla hafte'}].map(item=>(
          <div key={item.l} style={{display:'flex',alignItems:'center',gap:6}}>
            <div style={{width:10,height:10,borderRadius:3,background:item.c}}/>
            <span style={{fontSize:11,color:T.sub,fontFamily:SG}}>{item.l}</span>
          </div>
        ))}
      </div>
      <div style={{display:'flex',alignItems:'flex-end',gap:5,height:140}}>
        {WEEKLY_DATA.map((d)=>(
          <div key={d.d} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:4}}>
            <div style={{width:'100%',display:'flex',gap:2,alignItems:'flex-end',height:110}}>
              <div style={{flex:1,background:`linear-gradient(to top,${OR},${OR}cc)`,borderRadius:'5px 5px 0 0',height:`${(d.a/max)*100}%`,minHeight:4}}/>
              <div style={{flex:1,background:`linear-gradient(to top,${PU}99,${PU}55)`,borderRadius:'5px 5px 0 0',height:`${(d.b/max)*100}%`,minHeight:4}}/>
            </div>
            <span style={{fontSize:9,color:T.muted,fontWeight:600,fontFamily:SG}}>{d.d.slice(0,3)}</span>
          </div>
        ))}
      </div>
      <div style={{marginTop:12,display:'flex',justifyContent:'space-between',alignItems:'center',padding:'9px 12px',borderRadius:12,background:T.badge}}>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <div style={{width:28,height:28,borderRadius:8,background:OR+'22',display:'flex',alignItems:'center',justifyContent:'center'}}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={OR} strokeWidth="2.2" strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          </div>
          <span style={{color:T.sub,fontSize:12,fontFamily:SG}}>Bills ka jaayza</span>
        </div>
        <span style={{color:OR,fontSize:12,fontWeight:600,fontFamily:SG,cursor:'pointer'}}>Dekho →</span>
      </div>
    </Card>
  );
}

// ── Payments Flow Card ────────────────────────────────────────────────────────

function PaymentsFlowCard({T}){
  const max=Math.max(...PAY6M_DATA.flatMap(d=>[d.r,d.p]));
  return(
    <Card T={T}>
      <CardHead T={T} label="Payments" title="6 Mahine"
        right={<DeltaBadge T={T} val={6} color={GR}/>}/>
      <div style={{display:'flex',alignItems:'flex-end',gap:6,height:130}}>
        {PAY6M_DATA.map((d)=>{
          const pct=Math.round((d.r/(d.r+d.p))*100);
          return(
            <div key={d.m} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:3}}>
              <span style={{fontSize:9,color:T.sub,fontWeight:600,fontFamily:SG,marginBottom:1}}>{pct}%</span>
              <div style={{width:'100%',display:'flex',gap:2,alignItems:'flex-end',height:90}}>
                <div style={{flex:1,background:`linear-gradient(to top,${GR},${GR}cc)`,borderRadius:'5px 5px 0 0',height:`${(d.r/max)*100}%`,minHeight:4}}/>
                <div style={{flex:1,background:`linear-gradient(to top,${OR}88,${OR}44)`,borderRadius:'5px 5px 0 0',height:`${(d.p/max)*100}%`,minHeight:4}}/>
              </div>
              <span style={{fontSize:9,color:T.muted,fontWeight:600,fontFamily:SG}}>{d.m}</span>
            </div>
          );
        })}
      </div>
      <div style={{display:'flex',gap:14,marginTop:12}}>
        {[{c:GR,l:'Mila'},{c:OR+'88',l:'Diya'}].map(item=>(
          <div key={item.l} style={{display:'flex',alignItems:'center',gap:6}}>
            <div style={{width:10,height:10,borderRadius:3,background:item.c}}/>
            <span style={{fontSize:11,color:T.sub,fontFamily:SG}}>{item.l}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ── Party Ledger Card ─────────────────────────────────────────────────────────

function LedgerCard({T,PARTIES_DATA}){
  const top4=PARTIES_DATA.slice(0,4);
  const maxBal=Math.max(...top4.map(p=>p.balance));
  const totalRec=PARTIES_DATA.filter(p=>p.balance>0).reduce((s,p)=>s+p.balance,0);
  const totalPay=Math.abs(PARTIES_DATA.filter(p=>p.balance<0).reduce((s,p)=>s+p.balance,0));
  return(
    <Card T={T}>
      <CardHead T={T} label="Udhar Khata" title="Party Ledger"
        right={<span style={{fontSize:12,color:OR,fontWeight:600,fontFamily:SG,cursor:'pointer'}}>Sab Dekho →</span>}/>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:16}}>
        {[{l:'Lena Baki',v:totalRec,c:GR,i:'↑'},{l:'Dena Baki',v:totalPay,c:OR,i:'↓'}].map(item=>(
          <div key={item.l} style={{padding:'10px 12px',borderRadius:12,background:item.c+'14',border:`1px solid ${item.c}22`}}>
            <div style={{display:'flex',alignItems:'center',gap:4,marginBottom:3}}>
              <span style={{fontSize:13,fontWeight:700,color:item.c}}>{item.i}</span>
              <p style={{fontSize:10,fontWeight:600,color:item.c,textTransform:'uppercase',letterSpacing:'0.5px',fontFamily:SG}}>{item.l}</p>
            </div>
            <p style={{fontSize:15,fontWeight:700,color:T.text,fontFamily:IN}}>{fmt(item.v)}</p>
          </div>
        ))}
      </div>
      {top4.map((p,i)=>(
        <div key={i} style={{marginBottom:i<3?12:0}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:5}}>
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              <div style={{width:30,height:30,borderRadius:9,background:(p.balance>0?GR:OR)+'22',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                <span style={{fontSize:10,fontWeight:800,color:p.balance>0?GR:OR,fontFamily:IN}}>{p.init}</span>
              </div>
              <span style={{fontSize:12,fontWeight:600,color:T.text,fontFamily:SG}}>{p.name.split(' ').slice(0,2).join(' ')}</span>
            </div>
            <div style={{display:'flex',alignItems:'center',gap:6}}>
              <span style={{fontSize:13,fontWeight:700,color:T.text,fontFamily:IN}}>{fmt(Math.abs(p.balance))}</span>
            </div>
          </div>
          <div style={{height:4,borderRadius:3,background:T.badge,overflow:'hidden'}}>
            <div style={{height:'100%',borderRadius:3,background:p.balance>0?GR:OR,width:`${(Math.abs(p.balance)/maxBal)*100}%`,transition:'width 0.4s ease'}}/>
          </div>
        </div>
      ))}
    </Card>
  );
}

// ── Collections Donut Card ────────────────────────────────────────────────────

function DonutCard({T}){
  const r=60,cx=93,cy=93;
  const circ=2*Math.PI*r;
  const segs=[
    {pct:.62,color:GR, label:'Collect',val:'+24%'},
    {pct:.28,color:PU, label:'Baaki',  val:'+18%'},
    {pct:.10,color:OR, label:'Overdue',val:'+4%'},
  ];
  let cum=-0.25;
  const arcs=segs.map(s=>{
    const off=-(cum*circ);
    const dash=s.pct*circ;
    cum+=s.pct;
    return{...s,dash:`${dash.toFixed(1)} ${(circ-dash).toFixed(1)}`,off};
  });
  return(
    <Card T={T}>
      <CardHead T={T} label="Collections" title="Breakdown"
        right={<DateBadge T={T} text="Apr 2025"/>}/>
      <div style={{display:'flex',justifyContent:'center',margin:'0 0 14px'}}>
        <svg width="186" height="186" viewBox="0 0 186 186">
          <circle cx={cx} cy={cy} r={r} fill="none" stroke={T.id==='dark'?'rgba(255,255,255,0.06)':'rgba(0,0,0,0.05)'} strokeWidth="18"/>
          {arcs.map((s,i)=>(
            <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={s.color} strokeWidth="18"
              strokeLinecap="round" strokeDasharray={s.dash} strokeDashoffset={s.off}/>
          ))}
          <text x={cx} y={cy-8} textAnchor="middle" fontSize="22" fontWeight="800" fill={T.text} fontFamily={IN}>+24%</text>
          <text x={cx} y={cy+13} textAnchor="middle" fontSize="11" fill={T.sub} fontFamily={SG}>Wapasi</text>
        </svg>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:7}}>
        {segs.map(s=>(
          <div key={s.label} style={{textAlign:'center',padding:'8px 4px',borderRadius:10,background:T.badge}}>
            <div style={{width:24,height:3,borderRadius:2,background:s.color,margin:'0 auto 5px'}}/>
            <p style={{fontSize:10,color:T.sub,fontFamily:SG,marginBottom:2}}>{s.label}</p>
            <p style={{fontSize:13,fontWeight:700,color:s.color,fontFamily:IN}}>{s.val}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ── Dashboard Screen ──────────────────────────────────────────────────────────

function DashboardScreen({T,isMobile,PARTIES_DATA}){
  return(
    <div style={{padding:isMobile?'16px 14px':'24px 28px',maxWidth:1440,margin:'0 auto',paddingBottom:isMobile?90:24}}>
      {/* Page header */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <h1 style={{fontSize:isMobile?20:26,fontWeight:700,color:T.text,letterSpacing:'-0.5px',fontFamily:SG}}>Apna Karobaar</h1>
          <DateBadge T={T} text="29 Apr 2025"/>
        </div>
        {!isMobile && (
          <div style={{display:'flex',gap:8}}>
            <button style={{display:'flex',alignItems:'center',gap:7,padding:'7px 14px',borderRadius:10,border:`1px solid ${T.border}`,background:T.badge,color:T.sub,fontSize:13,fontFamily:SG,cursor:'pointer'}}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
              Filter
            </button>
          </div>
        )}
      </div>

      {isMobile ? (
        <div style={{display:'flex',flexDirection:'column',gap:14}}>
          <OverviewCard T={T} isMobile={true}/>
          <BillsBarCard T={T}/>
          <PaymentsFlowCard T={T}/>
          <LedgerCard T={T} PARTIES_DATA={PARTIES_DATA}/>
          <DonutCard T={T}/>
        </div>
      ) : (
        <>
          <div style={{display:'grid',gridTemplateColumns:'2fr 1fr',gap:16,marginBottom:16}}>
            <OverviewCard T={T} isMobile={false}/>
            <BillsBarCard T={T}/>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:16}}>
            <PaymentsFlowCard T={T}/>
            <LedgerCard T={T} PARTIES_DATA={PARTIES_DATA}/>
            <DonutCard T={T}/>
          </div>
        </>
      )}
    </div>
  );
}

Object.assign(window,{DashboardScreen});
