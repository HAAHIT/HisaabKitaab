
// hk-v2-newbill.jsx — New Bill slide-in panel (desktop) / full-screen (mobile)

const { OR, PU, GR, AM, SG, IN, fmt, fmtFull, PARTIES_DATA } = window;

function NewBillModal({T, isMobile, onClose, onSuccess}){
  const [party, setParty] = React.useState('Ramesh Cloth Store');
  const [items, setItems] = React.useState([
    {desc:'Cotton Fabric (50m)', qty:50, rate:180, total:9000},
    {desc:'Silk Thread',         qty:10, rate:450, total:4500},
  ]);
  const [tax, setTax] = React.useState(18);
  const [note, setNote] = React.useState('');
  const [saving, setSaving] = React.useState(false);

  const subtotal = items.reduce((s,i)=>s+i.total, 0);
  const taxAmt   = Math.round(subtotal * tax / 100);
  const grandTotal = subtotal + taxAmt;

  function updateItem(idx, field, val){
    setItems(prev => prev.map((it,i)=>{
      if(i!==idx) return it;
      const updated = {...it, [field]: field==='desc'?val:Number(val)||0};
      if(field==='qty'||field==='rate') updated.total = (field==='qty'?updated.qty:it.qty) * (field==='rate'?updated.rate:it.rate);
      return updated;
    }));
  }

  function addItem(){ setItems(prev=>[...prev,{desc:'',qty:1,rate:0,total:0}]); }
  function removeItem(idx){ setItems(prev=>prev.filter((_,i)=>i!==idx)); }

  async function handleSave(finalize){
    setSaving(true);
    await new Promise(r=>setTimeout(r,800));
    setSaving(false);
    onSuccess && onSuccess();
  }

  const panelW = isMobile ? '100%' : 480;
  const panelStyle = isMobile
    ? {position:'fixed',inset:0,zIndex:500,display:'flex',flexDirection:'column',background:T.bg,fontFamily:SG}
    : {position:'fixed',top:0,right:0,bottom:0,width:panelW,zIndex:500,display:'flex',flexDirection:'column',background:T.card,borderLeft:`1px solid ${T.border}`,boxShadow:'-16px 0 48px rgba(0,0,0,0.35)',fontFamily:SG};

  const inputStyle = {
    width:'100%',padding:'9px 12px',borderRadius:10,border:`1.5px solid ${T.border}`,
    background:T.input,color:T.text,fontSize:13,fontFamily:SG,outline:'none',boxSizing:'border-box',
  };

  return(
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.55)',zIndex:499,backdropFilter:'blur(4px)',WebkitBackdropFilter:'blur(4px)'}}/>

      {/* Panel */}
      <div style={panelStyle}>
        {/* Header */}
        <div style={{display:'flex',alignItems:'center',gap:12,padding:'16px 20px',borderBottom:`1px solid ${T.border}`,flexShrink:0}}>
          <button onClick={onClose} style={{width:34,height:34,borderRadius:9,border:`1px solid ${T.border}`,background:T.badge,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',color:T.sub,flexShrink:0}}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="m15 18-6-6 6-6"/></svg>
          </button>
          <div>
            <h2 style={{fontSize:17,fontWeight:700,color:T.text,letterSpacing:'-0.3px'}}>Naya Bill Banao</h2>
            <p style={{fontSize:11,color:T.sub,marginTop:1}}>B-2504-025 · Draft</p>
          </div>
          <div style={{marginLeft:'auto',padding:'3px 10px',borderRadius:7,background:AM+'22',border:`1px solid ${AM}33`}}>
            <span style={{fontSize:11,fontWeight:700,color:AM}}>Draft</span>
          </div>
        </div>

        {/* Scrollable body */}
        <div style={{flex:1,overflowY:'auto',padding:'16px 20px',display:'flex',flexDirection:'column',gap:14}}>

          {/* Party selector */}
          <div>
            <label style={{display:'block',fontSize:11,fontWeight:700,color:T.sub,textTransform:'uppercase',letterSpacing:'0.6px',marginBottom:6}}>Grahak / Party</label>
            <div style={{position:'relative'}}>
              <select value={party} onChange={e=>setParty(e.target.value)}
                style={{...inputStyle, appearance:'none', cursor:'pointer', paddingRight:32}}>
                {PARTIES_DATA.filter(p=>p.type==='CUSTOMER').map(p=>(
                  <option key={p.id}>{p.name}</option>
                ))}
              </select>
              <svg style={{position:'absolute',right:10,top:'50%',transform:'translateY(-50%)',pointerEvents:'none',color:T.sub}} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="m6 9 6 6 6-6"/></svg>
            </div>
          </div>

          {/* Items table */}
          <div>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
              <label style={{fontSize:11,fontWeight:700,color:T.sub,textTransform:'uppercase',letterSpacing:'0.6px'}}>Saman / Items</label>
              <button onClick={addItem} style={{fontSize:12,fontWeight:700,color:OR,background:OR+'18',border:'none',padding:'4px 10px',borderRadius:7,cursor:'pointer',fontFamily:SG}}>+ Jodo</button>
            </div>

            {/* Column headers */}
            <div style={{display:'grid',gridTemplateColumns:'1fr 52px 72px 72px 24px',gap:6,marginBottom:5}}>
              {['Item','Qty','Rate','Total',''].map((h,i)=>(
                <span key={i} style={{fontSize:10,fontWeight:700,color:T.muted,textTransform:'uppercase',letterSpacing:'0.4px',textAlign:i>=2?'right':'left'}}>{h}</span>
              ))}
            </div>

            {items.map((item,idx)=>(
              <div key={idx} style={{display:'grid',gridTemplateColumns:'1fr 52px 72px 72px 24px',gap:6,marginBottom:6,alignItems:'center'}}>
                <input value={item.desc} onChange={e=>updateItem(idx,'desc',e.target.value)}
                  placeholder="Item naam" style={{...inputStyle,padding:'8px 10px',fontSize:12}}
                  onFocus={e=>e.target.style.borderColor=OR} onBlur={e=>e.target.style.borderColor=T.border}/>
                <input type="number" value={item.qty} onChange={e=>updateItem(idx,'qty',e.target.value)}
                  style={{...inputStyle,padding:'8px 6px',fontSize:12,textAlign:'center'}}
                  onFocus={e=>e.target.style.borderColor=OR} onBlur={e=>e.target.style.borderColor=T.border}/>
                <input type="number" value={item.rate} onChange={e=>updateItem(idx,'rate',e.target.value)}
                  style={{...inputStyle,padding:'8px 6px',fontSize:12,textAlign:'right'}}
                  onFocus={e=>e.target.style.borderColor=OR} onBlur={e=>e.target.style.borderColor=T.border}/>
                <span style={{fontSize:12,fontWeight:700,color:T.text,textAlign:'right',fontFamily:IN}}>₹{item.total.toLocaleString('en-IN')}</span>
                <button onClick={()=>removeItem(idx)} style={{width:22,height:22,borderRadius:6,border:'none',background:OR+'18',color:OR,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',fontSize:14,fontWeight:700}}>×</button>
              </div>
            ))}
          </div>

          {/* Tax + Note */}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
            <div>
              <label style={{display:'block',fontSize:11,fontWeight:700,color:T.sub,textTransform:'uppercase',letterSpacing:'0.6px',marginBottom:6}}>GST (%)</label>
              <div style={{position:'relative'}}>
                <select value={tax} onChange={e=>setTax(Number(e.target.value))} style={{...inputStyle,appearance:'none',cursor:'pointer',paddingRight:28}}>
                  {[0,5,12,18,28].map(v=><option key={v} value={v}>{v}%</option>)}
                </select>
                <svg style={{position:'absolute',right:8,top:'50%',transform:'translateY(-50%)',pointerEvents:'none',color:T.sub}} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="m6 9 6 6 6-6"/></svg>
              </div>
            </div>
            <div>
              <label style={{display:'block',fontSize:11,fontWeight:700,color:T.sub,textTransform:'uppercase',letterSpacing:'0.6px',marginBottom:6}}>Note</label>
              <input value={note} onChange={e=>setNote(e.target.value)} placeholder="Kuch likhna ho toh..."
                style={{...inputStyle}} onFocus={e=>e.target.style.borderColor=OR} onBlur={e=>e.target.style.borderColor=T.border}/>
            </div>
          </div>

          {/* Totals */}
          <div style={{padding:'14px 16px',borderRadius:14,background:T.badge,border:`1px solid ${T.border}`}}>
            {[
              {label:'Subtotal',        value:fmtFull(subtotal)},
              {label:`GST @ ${tax}%`,   value:fmtFull(taxAmt)},
            ].map(row=>(
              <div key={row.label} style={{display:'flex',justifyContent:'space-between',padding:'5px 0',borderBottom:`1px solid ${T.border}`}}>
                <span style={{color:T.sub,fontSize:13,fontFamily:SG}}>{row.label}</span>
                <span style={{color:T.text,fontSize:13,fontFamily:IN,fontWeight:600}}>{row.value}</span>
              </div>
            ))}
            <div style={{display:'flex',justifyContent:'space-between',padding:'10px 0 0'}}>
              <span style={{color:T.text,fontSize:15,fontWeight:800,fontFamily:SG}}>Kul Total</span>
              <span style={{color:OR,fontSize:20,fontWeight:800,fontFamily:IN}}>{fmtFull(grandTotal)}</span>
            </div>
          </div>
        </div>

        {/* Action footer */}
        <div style={{padding:'14px 20px',borderTop:`1px solid ${T.border}`,display:'flex',gap:10,flexShrink:0,background:T.id==='dark'?T.card:T.bg}}>
          <button onClick={()=>handleSave(false)} disabled={saving}
            style={{flex:1,padding:'12px',borderRadius:12,background:T.badge,border:`1px solid ${T.border}`,color:T.sub,fontWeight:600,fontSize:14,cursor:'pointer',fontFamily:SG}}>
            Draft Rakho
          </button>
          <button onClick={()=>handleSave(true)} disabled={saving}
            style={{flex:2,padding:'12px',borderRadius:12,background:`linear-gradient(135deg,${OR},${PU})`,color:'#fff',fontWeight:700,fontSize:14,cursor:'pointer',border:'none',fontFamily:SG,boxShadow:`0 4px 16px ${OR}44`,opacity:saving?0.7:1,display:'flex',alignItems:'center',justifyContent:'center',gap:8}}>
            {saving
              ? <><span style={{width:16,height:16,borderRadius:'50%',border:'2.5px solid rgba(255,255,255,0.3)',borderTopColor:'white',display:'inline-block',animation:'spin 0.7s linear infinite'}}/> Saving...</>
              : '✓ Bill Pakka Karo'
            }
          </button>
        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </>
  );
}

Object.assign(window, {NewBillModal});
