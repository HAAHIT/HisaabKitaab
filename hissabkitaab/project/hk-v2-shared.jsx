
// hk-v2-shared.jsx — Themes, data, helpers, shared components

const OR = '#f76000', PU = '#7b5ef6', GR = '#00ca88', AM = '#ffb020';
const SG = "'Space Grotesk', sans-serif", IN = "'Inter', sans-serif";

const DARK = {
  id:'dark', bg:'#0d0d1b', nav:'#111120', card:'#161628',
  border:'rgba(255,255,255,0.07)', text:'#e2e4f0', sub:'#888ea8', muted:'#40445a',
  pill:'rgba(255,255,255,0.07)', pillActive:'#1e1e3a',
  badge:'rgba(255,255,255,0.06)', line:'rgba(255,255,255,0.05)', input:'rgba(255,255,255,0.04)',
};
const LIGHT = {
  id:'light', bg:'#eef0f8', nav:'#ffffff', card:'#ffffff',
  border:'rgba(0,0,0,0.07)', text:'#0d0d1b', sub:'#666a82', muted:'#aab0c8',
  pill:'rgba(0,0,0,0.05)', pillActive:'#e8eaf5',
  badge:'rgba(0,0,0,0.05)', line:'rgba(0,0,0,0.05)', input:'rgba(0,0,0,0.04)',
};

function fmt(n){
  if(n>=100000) return '₹'+(n/100000).toFixed(1)+'L';
  if(n>=1000) return '₹'+(n/1000).toFixed(0)+'K';
  return '₹'+n;
}
function fmtFull(n){
  return new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(n);
}

// ── Mock Data ─────────────────────────────────────────────────────────────────

const BILLS_DATA = [
  {id:'B-2504-024',party:'Ramesh Cloth Store', amount:52000, status:'FINAL',    date:'29 Apr 2025'},
  {id:'B-2504-023',party:'Gupta Hardware',     amount:45000, status:'FINAL',    date:'28 Apr 2025'},
  {id:'B-2504-022',party:'Sunita Enterprises', amount:12450, status:'DRAFT',    date:'27 Apr 2025'},
  {id:'B-2504-021',party:'Agarwal Traders',    amount:67800, status:'FINAL',    date:'25 Apr 2025'},
  {id:'B-2503-020',party:'Patel Textiles',     amount:28900, status:'CANCELLED',date:'30 Mar 2025'},
  {id:'B-2503-019',party:'Sharma Electronics', amount:89000, status:'FINAL',    date:'28 Mar 2025'},
  {id:'B-2503-018',party:'Mehta Fabrics',      amount:34500, status:'FINAL',    date:'25 Mar 2025'},
  {id:'B-2503-017',party:'Khan Brothers',      amount:15600, status:'DRAFT',    date:'22 Mar 2025'},
];
const PARTIES_DATA = [
  {id:1,name:'Ramesh Cloth Store',  init:'RC',type:'CUSTOMER', balance:89000, phone:'98765-43210'},
  {id:2,name:'Gupta Hardware',      init:'GH',type:'CUSTOMER', balance:67000, phone:'98123-45678'},
  {id:3,name:'Sunita Enterprises',  init:'SE',type:'CUSTOMER', balance:-8500, phone:'97654-32109'},
  {id:4,name:'Patel Textiles',      init:'PT',type:'SUPPLIER', balance:32000, phone:'96543-21098'},
  {id:5,name:'Sharma Electronics',  init:'SH',type:'CUSTOMER', balance:45000, phone:'95432-10987'},
  {id:6,name:'Agarwal Traders',     init:'AT',type:'CUSTOMER', balance:22000, phone:'94321-09876'},
  {id:7,name:'Khan Brothers',       init:'KB',type:'SUPPLIER', balance:-15000,phone:'93210-98765'},
  {id:8,name:'Mehta Fabrics',       init:'MF',type:'SUPPLIER', balance:18000, phone:'92109-87654'},
];
const PAYMENTS_DATA = [
  {id:1,party:'Ramesh Cloth Store', amount:15000,dir:'IN', mode:'UPI',    date:'29 Apr',note:'April payment'},
  {id:2,party:'Gupta Hardware',     amount:22000,dir:'IN', mode:'NEFT',   date:'28 Apr',note:''},
  {id:3,party:'Patel Textiles',     amount:8500, dir:'OUT',mode:'Cash',   date:'27 Apr',note:'Maal kharida'},
  {id:4,party:'Sunita Enterprises', amount:12000,dir:'IN', mode:'UPI',    date:'26 Apr',note:''},
  {id:5,party:'Khan Brothers',      amount:18000,dir:'OUT',mode:'Cheque', date:'25 Apr',note:'Quarter payment'},
  {id:6,party:'Sharma Electronics', amount:45000,dir:'IN', mode:'NEFT',   date:'24 Apr',note:''},
  {id:7,party:'Agarwal Traders',    amount:5000, dir:'OUT',mode:'UPI',    date:'23 Apr',note:''},
  {id:8,party:'Mehta Fabrics',      amount:34000,dir:'IN', mode:'Cash',   date:'22 Apr',note:''},
];
const MONTHLY_DATA = [
  {m:'Jan',b:120,c:95},{m:'Feb',b:185,c:142},{m:'Mar',b:152,c:168},
  {m:'Apr',b:285,c:195},{m:'May',b:224,c:248},{m:'Jun',b:352,c:284},
  {m:'Jul',b:295,c:316},{m:'Aug',b:418,c:362},{m:'Sep',b:384,c:405},
  {m:'Oct',b:456,c:288},
];
const WEEKLY_DATA = [
  {d:'Mon',a:45,b:32},{d:'Tue',a:78,b:55},{d:'Wed',a:32,b:58},
  {d:'Thu',a:92,b:48},{d:'Fri',a:67,b:38},{d:'Sat',a:54,b:72},{d:'Sun',a:22,b:18},
];
const PAY6M_DATA = [
  {m:'May',r:248,p:142},{m:'Jun',r:284,p:168},{m:'Jul',r:316,p:195},
  {m:'Aug',r:362,p:222},{m:'Sep',r:405,p:285},{m:'Oct',r:288,p:180},
];

// ── Hooks ─────────────────────────────────────────────────────────────────────

function useIsMobile(){
  const [m,setM]=React.useState(window.innerWidth<768);
  React.useEffect(()=>{
    const h=()=>setM(window.innerWidth<768);
    window.addEventListener('resize',h);
    return()=>window.removeEventListener('resize',h);
  },[]);
  return m;
}

// ── Shared micro-components ───────────────────────────────────────────────────

function IconBtn({T,children,onClick,title}){
  const [hov,setHov]=React.useState(false);
  return(
    <button onClick={onClick} title={title}
      onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      style={{width:36,height:36,borderRadius:10,border:`1px solid ${T.border}`,background:hov?T.pillActive:T.badge,display:'flex',alignItems:'center',justifyContent:'center',color:T.sub,transition:'background 0.15s',cursor:'pointer'}}>
      {children}
    </button>
  );
}

function DateBadge({T,text}){
  return(
    <div style={{display:'flex',alignItems:'center',gap:5,padding:'4px 10px',borderRadius:8,background:T.badge,border:`1px solid ${T.border}`}}>
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={T.sub} strokeWidth="2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
      <span style={{fontSize:11,color:T.sub,fontFamily:SG}}>{text}</span>
    </div>
  );
}

function DeltaBadge({T,val,color}){
  const c=color||(val>=0?GR:OR);
  return(
    <span style={{fontSize:11,fontWeight:700,color:c,background:c+'22',padding:'2px 7px',borderRadius:6,fontFamily:IN}}>
      {val>=0?'+':''}{val}%
    </span>
  );
}

function Card({T,children,style={}}){
  return(
    <div style={{background:T.card,borderRadius:20,border:`1px solid ${T.border}`,padding:'20px 20px',transition:'background 0.25s',...style}}>
      {children}
    </div>
  );
}

function CardHead({T,label,title,right}){
  return(
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:16}}>
      <div>
        <p style={{color:T.sub,fontSize:11,fontWeight:600,letterSpacing:'0.7px',textTransform:'uppercase',fontFamily:SG,marginBottom:3}}>{label}</p>
        <p style={{fontSize:16,fontWeight:700,color:T.text,fontFamily:SG,letterSpacing:'-0.3px'}}>{title}</p>
      </div>
      {right}
    </div>
  );
}

function StatusChip({status}){
  const map={
    FINAL:   {label:'Pakka ✓', bg:GR+'22',   color:GR},
    DRAFT:   {label:'Draft',   bg:AM+'22',    color:AM},
    CANCELLED:{label:'Raddh',  bg:OR+'22',    color:OR},
  };
  const s=map[status]||map.DRAFT;
  return(
    <span style={{fontSize:10,fontWeight:700,color:s.color,background:s.bg,padding:'3px 8px',borderRadius:6,fontFamily:SG,letterSpacing:'0.3px'}}>{s.label}</span>
  );
}

// ── Desktop NavBar ────────────────────────────────────────────────────────────

function NavBar({T,tab,setTab,dark,setDark,onNewBill,isMobile}){
  const tabs=['Dashboard','Mere Bills','Udhar Khata','Payments'];
  return(
    <div style={{height:60,background:T.nav,borderBottom:`1px solid ${T.border}`,display:'flex',alignItems:'center',padding:'0 20px',gap:14,position:'sticky',top:0,zIndex:200,backdropFilter:'blur(16px)',WebkitBackdropFilter:'blur(16px)'}}>
      {/* Logo */}
      <div style={{display:'flex',alignItems:'center',gap:9,marginRight:isMobile?0:16,flexShrink:0}}>
        <div style={{width:34,height:34,borderRadius:10,background:`linear-gradient(135deg,${OR},${PU})`,display:'flex',alignItems:'center',justifyContent:'center',boxShadow:`0 4px 12px ${OR}44`}}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
            <line x1="9" y1="8" x2="15" y2="8"/><line x1="9" y1="12" x2="12" y2="12"/>
          </svg>
        </div>
        {!isMobile && <span style={{fontSize:15,fontWeight:700,color:T.text,letterSpacing:'-0.3px',fontFamily:SG}}>HisaabKitaab</span>}
      </div>

      {/* Desktop tabs */}
      {!isMobile && (
        <div style={{display:'flex',background:T.pill,borderRadius:12,padding:'4px',gap:2,margin:'0 auto'}}>
          {tabs.map(t=>(
            <button key={t} onClick={()=>setTab(t)}
              style={{padding:'6px 18px',borderRadius:9,fontSize:13,fontWeight:tab===t?600:400,color:tab===t?T.text:T.sub,background:tab===t?T.pillActive:'transparent',transition:'all 0.15s',fontFamily:SG,border:'none',cursor:'pointer'}}>
              {t}
            </button>
          ))}
        </div>
      )}

      {isMobile && <span style={{fontSize:15,fontWeight:700,color:T.text,fontFamily:SG,letterSpacing:'-0.3px',flex:1}}>{tab}</span>}

      {/* Right controls */}
      <div style={{display:'flex',alignItems:'center',gap:8,flexShrink:0,marginLeft:isMobile?0:'auto'}}>
        {!isMobile && (
          <button onClick={onNewBill} style={{display:'flex',alignItems:'center',gap:7,padding:'7px 16px',borderRadius:10,background:`linear-gradient(135deg,${OR},${PU})`,color:'#fff',fontSize:13,fontWeight:600,fontFamily:SG,border:'none',cursor:'pointer',boxShadow:`0 4px 16px ${OR}44`}}>
            + Naya Bill
          </button>
        )}
        <IconBtn T={T} onClick={()=>setDark(!dark)} title={dark?'Light mode':'Dark mode'}>
          {dark
            ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
            : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
          }
        </IconBtn>
        <div style={{width:34,height:34,borderRadius:'50%',background:`linear-gradient(135deg,${PU},${OR})`,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer'}}>
          <span style={{fontSize:12,fontWeight:700,color:'white',fontFamily:IN}}>RS</span>
        </div>
      </div>
    </div>
  );
}

// ── Mobile Bottom Nav ─────────────────────────────────────────────────────────

function BottomNav({T,tab,setTab,onNewBill}){
  const items=[
    {id:'Dashboard', label:'होम',     icon:(a)=><svg width="21" height="21" viewBox="0 0 24 24" fill={a?OR:'none'} stroke={a?OR:T.sub} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>},
    {id:'Mere Bills',label:'बिल',     icon:(a)=><svg width="21" height="21" viewBox="0 0 24 24" fill={a?OR+'22':'none'} stroke={a?OR:T.sub} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/></svg>},
    {id:'__fab',     label:'',         icon:()=>null},
    {id:'Udhar Khata',label:'खाता',  icon:(a)=><svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke={a?OR:T.sub} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>},
    {id:'Payments',  label:'पेमेंट', icon:(a)=><svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke={a?OR:T.sub} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>},
  ];
  return(
    <div style={{position:'fixed',bottom:0,left:0,right:0,height:68,background:T.nav,borderTop:`1px solid ${T.border}`,display:'flex',alignItems:'center',zIndex:200,backdropFilter:'blur(20px)',WebkitBackdropFilter:'blur(20px)'}}>
      {items.map((item)=>{
        if(item.id==='__fab') return(
          <div key="fab" style={{flex:1,display:'flex',justifyContent:'center'}}>
            <button onClick={onNewBill} style={{width:50,height:50,borderRadius:16,background:`linear-gradient(135deg,${OR},${PU})`,display:'flex',alignItems:'center',justifyContent:'center',transform:'translateY(-12px)',boxShadow:`0 8px 24px ${OR}55`,border:'none',cursor:'pointer'}}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            </button>
          </div>
        );
        const a=tab===item.id;
        return(
          <button key={item.id} onClick={()=>setTab(item.id)}
            style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:3,background:'none',border:'none',cursor:'pointer',padding:'6px 0',position:'relative'}}>
            {a && <div style={{position:'absolute',top:0,width:20,height:2.5,borderRadius:2,background:OR}}/>}
            {item.icon(a)}
            {item.label && <span style={{fontSize:9,fontWeight:a?700:500,color:a?OR:T.sub,fontFamily:SG}}>{item.label}</span>}
          </button>
        );
      })}
    </div>
  );
}

Object.assign(window,{
  OR,PU,GR,AM,SG,IN,DARK,LIGHT,fmt,fmtFull,useIsMobile,
  BILLS_DATA,PARTIES_DATA,PAYMENTS_DATA,MONTHLY_DATA,WEEKLY_DATA,PAY6M_DATA,
  IconBtn,DateBadge,DeltaBadge,Card,CardHead,StatusChip,NavBar,BottomNav,
});
