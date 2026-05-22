
// hk3-screens-detail.jsx — Detail screens + creation sheets

const { useTheme, useIsMobile, Card, Button, IconButton, Input, Select, Chip, StatusChip, Avatar, Sheet, EmptyState, Section, Money,
  C, FONT, MONO, TYPE, typo, RADIUS,
  fmt, fmtFull, USER, PARTIES, BILLS, PAYMENTS, ITEMS,
  getParty, getBill, waLink, telLink,
  ICONS, PartyRow, PaymentRow } = window;

// ─── BILL DETAIL ─────────────────────────────────────────────────────────────

function BillDetail({ bill, onBack, onPaymentRecord, isMobile }){
  const {theme:T} = useTheme();
  if(!bill) return null;
  const party = getParty(bill.partyId);
  const subtotal = Math.round(bill.amount / (1 + bill.gst/100));
  const tax = bill.amount - subtotal;
  const remaining = bill.amount - bill.paid;

  return(
    <div style={{padding: isMobile?'14px 14px 100px':'24px 28px',maxWidth:880,margin:'0 auto'}}>
      {/* Back + header */}
      <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:18}}>
        <IconButton onClick={onBack} variant="surface" label="Back">{ICONS.chevL()}</IconButton>
        <div style={{flex:1,minWidth:0}}>
          <p style={{...typo('caption'),color:T.textMuted,margin:0,fontFamily:MONO}}>{bill.no}</p>
          <h1 style={{...typo('h1'),color:T.text,margin:'2px 0 0'}}>Bill Detail</h1>
        </div>
        <StatusChip status={bill.status}/>
      </div>

      <Card style={{marginBottom:14}} padding={isMobile?18:24}>
        {/* Party + amount header */}
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:18,flexWrap:'wrap',gap:14}}>
          <div style={{display:'flex',alignItems:'center',gap:12}}>
            <Avatar name={party?.name||'—'} size={52}/>
            <div>
              <p style={{...typo('h2'),color:T.text,margin:0}}>{party?.name}</p>
              <p style={{...typo('caption'),color:T.textMuted,margin:'2px 0 0'}}>{party?.city} · {party?.phone}</p>
            </div>
          </div>
          <div style={{textAlign:'right'}}>
            <p style={{...typo('caption'),color:T.textMuted,margin:0}}>Total amount</p>
            <p style={{fontFamily:FONT,fontWeight:700,fontSize:32,color:T.text,margin:'2px 0 0',letterSpacing:'-0.8px',fontVariantNumeric:'tabular-nums'}}>{fmtFull(bill.amount)}</p>
            {bill.paid > 0 && (
              <p style={{...typo('caption'),color:C.positive,margin:'4px 0 0',fontWeight:600}}>{fmtFull(bill.paid)} mila</p>
            )}
          </div>
        </div>

        <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr 1fr':'repeat(4,1fr)',gap:14,padding:'14px 0',borderTop:`1px solid ${T.divider}`,borderBottom:`1px solid ${T.divider}`,marginBottom:18}}>
          <DetailField label="Bill Date" value={new Date(bill.date).toLocaleDateString('en-IN',{day:'numeric',month:'long',year:'numeric'})}/>
          <DetailField label="Items" value={`${bill.items} items`}/>
          <DetailField label="GST" value={`${bill.gst}%`}/>
          <DetailField label="Status" value={bill.status==='FINAL'?'Final':bill.status==='DRAFT'?'Draft':'Cancelled'}/>
        </div>

        {/* Item lines */}
        <div style={{marginBottom:18}}>
          <h3 style={{...typo('h3'),color:T.text,marginBottom:10}}>Items</h3>
          <div style={{background:T.surfaceAlt,borderRadius:RADIUS.md,padding:'8px 14px'}}>
            {[
              {n:'Cotton Fabric',  q:50, r:180, t:9000},
              {n:'Silk Thread',    q:10, r:450, t:4500},
              {n:'Polyester Cloth',q:30, r:220, t:6600},
            ].slice(0,bill.items).map((item,i)=>(
              <div key={i} style={{display:'flex',justifyContent:'space-between',padding:'10px 0',borderBottom:i<bill.items-1?`1px solid ${T.divider}`:'none',gap:10}}>
                <div style={{flex:1,minWidth:0}}>
                  <p style={{...typo('bodySm'),color:T.text,fontWeight:600,margin:0}}>{item.n}</p>
                  <p style={{...typo('caption'),color:T.textMuted,margin:'2px 0 0'}}>{item.q} × ₹{item.r}</p>
                </div>
                <p style={{fontFamily:FONT,fontWeight:700,fontSize:14,color:T.text,fontVariantNumeric:'tabular-nums'}}>{fmtFull(item.t)}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Totals */}
        <div style={{maxWidth:isMobile?'none':320,marginLeft:'auto'}}>
          {[
            {l:'Subtotal',     v:subtotal,        muted:true},
            {l:`GST @ ${bill.gst}%`, v:tax,         muted:true},
            {l:'Total',        v:bill.amount,     bold:true},
            ...(bill.paid>0 ? [{l:'Paid',v:bill.paid,positive:true}] : []),
            ...(remaining>0 && bill.status==='FINAL' ? [{l:'Balance',v:remaining,negative:true,bold:true}] : []),
          ].map((row,i)=>(
            <div key={i} style={{display:'flex',justifyContent:'space-between',padding:'6px 0',borderTop:row.bold && i>0?`1px solid ${T.divider}`:'none',marginTop:row.bold && i>0?6:0,paddingTop:row.bold && i>0?12:6}}>
              <span style={{...typo(row.bold?'body':'bodySm'),color:row.muted?T.textMuted:T.text,fontWeight:row.bold?700:500}}>{row.l}</span>
              <span style={{fontFamily:FONT,fontWeight:row.bold?700:600,fontSize:row.bold?16:14,color:row.positive?C.positive:row.negative?C.primary:row.muted?T.textMuted:T.text,fontVariantNumeric:'tabular-nums'}}>
                {row.positive?'-':''}{fmtFull(row.v)}
              </span>
            </div>
          ))}
        </div>
      </Card>

      {/* Action bar */}
      <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
        {remaining > 0 && bill.status==='FINAL' && (
          <Button onClick={()=>onPaymentRecord(bill)} variant="success" icon={ICONS.arrowDown()}>Payment Likho</Button>
        )}
        {party && (
          <a href={waLink(party, remaining || bill.amount)} target="_blank" rel="noopener" style={{textDecoration:'none'}}>
            <Button variant="secondary" icon={ICONS.whatsapp()}>WhatsApp Reminder</Button>
          </a>
        )}
        <Button variant="secondary" icon={ICONS.share()}>Share PDF</Button>
        <Button variant="secondary" icon={ICONS.download()}>Download</Button>
        {bill.status==='DRAFT' && <Button variant="secondary" icon={ICONS.edit()}>Edit</Button>}
      </div>
    </div>
  );
}

function DetailField({label, value}){
  const {theme:T} = useTheme();
  return(
    <div>
      <p style={{...typo('caption'),color:T.textMuted,margin:0,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.3px'}}>{label}</p>
      <p style={{...typo('body'),color:T.text,margin:'4px 0 0',fontWeight:600}}>{value}</p>
    </div>
  );
}

// ─── PARTY DETAIL ────────────────────────────────────────────────────────────

function PartyDetail({ party, onBack, onNewBill, onNewPayment, onOpenBill, isMobile }){
  const {theme:T} = useTheme();
  if(!party) return null;
  const partyBills = BILLS.filter(b=>b.partyId===party.id);
  const partyPayments = PAYMENTS.filter(p=>p.partyId===party.id&&p.status==='COMPLETED');
  const balance = Math.abs(party.balance);
  const isOwedToUs = party.balance < 0;

  return(
    <div style={{padding: isMobile?'14px 14px 100px':'24px 28px',maxWidth:1080,margin:'0 auto'}}>
      <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:20}}>
        <IconButton onClick={onBack} variant="surface" label="Back">{ICONS.chevL()}</IconButton>
        <h1 style={{...typo('h1'),color:T.text,margin:0,flex:1}}>Party Detail</h1>
      </div>

      <Card style={{marginBottom:14}} padding={isMobile?20:28}>
        <div style={{display:'flex',gap:16,alignItems:'center',flexWrap:'wrap'}}>
          <Avatar name={party.name} size={64}/>
          <div style={{flex:1,minWidth:200}}>
            <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
              <h2 style={{...typo('h1'),color:T.text,margin:0}}>{party.name}</h2>
              <Chip tone={party.type==='CUSTOMER'?'info':'warning'}>{party.type==='CUSTOMER'?'Customer':'Supplier'}</Chip>
              {party.isOverdue && <Chip tone="primary">Overdue</Chip>}
            </div>
            <p style={{...typo('bodySm'),color:T.textMuted,margin:'6px 0 0'}}>
              {party.city} · {party.phone}
              {party.gstin && <> · <span style={{fontFamily:MONO}}>{party.gstin}</span></>}
            </p>
          </div>
        </div>

        <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr':'1.2fr 1fr 1fr',gap:14,marginTop:24,padding:'18px 0 0',borderTop:`1px solid ${T.divider}`}}>
          <div>
            <p style={{...typo('caption'),color:T.textMuted,marginBottom:6,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.3px'}}>Current Balance</p>
            <p style={{
              fontFamily:FONT,fontWeight:800,
              fontSize:isMobile?28:36,letterSpacing:'-0.8px',
              color: party.balance===0 ? T.textMuted : isOwedToUs ? C.positive : C.negative,
              fontVariantNumeric:'tabular-nums',
            }}>
              {party.balance===0 ? 'Settled ✓' : fmtFull(balance)}
            </p>
            <p style={{...typo('caption'),color:T.textMuted,marginTop:2}}>
              {party.balance===0 ? '' : isOwedToUs ? `${party.name.split(' ')[0]} se lena baki` : `${party.name.split(' ')[0]} ko dena baki`}
            </p>
          </div>
          <div>
            <p style={{...typo('caption'),color:T.textMuted,marginBottom:6,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.3px'}}>Total Billed</p>
            <p style={{fontFamily:FONT,fontWeight:700,fontSize:isMobile?20:24,color:T.text,letterSpacing:'-0.4px',fontVariantNumeric:'tabular-nums'}}>{fmtFull(partyBills.reduce((s,b)=>s+(b.status!=='CANCELLED'?b.amount:0),0))}</p>
            <p style={{...typo('caption'),color:T.textMuted,marginTop:2}}>{partyBills.length} bills</p>
          </div>
          <div>
            <p style={{...typo('caption'),color:T.textMuted,marginBottom:6,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.3px'}}>Last Payment</p>
            <p style={{fontFamily:FONT,fontWeight:700,fontSize:isMobile?20:24,color:T.text,letterSpacing:'-0.4px',fontVariantNumeric:'tabular-nums'}}>{party.lastPayDays} days</p>
            <p style={{...typo('caption'),color:T.textMuted,marginTop:2}}>since last pay</p>
          </div>
        </div>

        <div style={{display:'flex',gap:8,marginTop:18,flexWrap:'wrap'}}>
          <a href={telLink(party)} style={{textDecoration:'none'}}>
            <Button variant="secondary" icon={ICONS.call()}>Call</Button>
          </a>
          <a href={waLink(party, party.balance)} target="_blank" rel="noopener" style={{textDecoration:'none'}}>
            <Button variant="secondary" icon={ICONS.whatsapp()} style={{color:C.positive,borderColor:C.positive+'40'}}>WhatsApp</Button>
          </a>
          {party.type==='CUSTOMER' && <Button onClick={onNewBill} icon={ICONS.plus()}>Naya Bill</Button>}
          <Button onClick={onNewPayment} variant="success" icon={ICONS.arrowDown()}>Payment Mila</Button>
        </div>
      </Card>

      {/* Bills + Payments side by side */}
      <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr':'1fr 1fr',gap:14}}>
        <Card>
          <Section title="Bills" action={
            <span style={{...typo('caption'),color:T.textMuted}}>{partyBills.length}</span>
          }>
          </Section>
          {partyBills.length === 0 ? (
            <EmptyState icon={ICONS.bills()} title="Koi bill nahi" body="Bill banakar shuru karo."/>
          ) : (
            <div>
              {partyBills.slice(0,4).map((b,i)=>(
                <button key={b.id} onClick={()=>onOpenBill(b)} style={{
                  width:'100%',display:'flex',alignItems:'center',gap:10,padding:'10px 0',
                  borderBottom:i<3&&i<partyBills.length-1?`1px solid ${T.divider}`:'none',
                  background:'transparent',border:'none',cursor:'pointer',textAlign:'left',color:T.text,
                }}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:2}}>
                      <span style={{...typo('bodySm'),fontFamily:MONO,color:T.textMuted}}>{b.no}</span>
                      <StatusChip status={b.status}/>
                    </div>
                    <p style={{...typo('caption'),color:T.textMuted,margin:0}}>{new Date(b.date).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}</p>
                  </div>
                  <span style={{fontFamily:FONT,fontWeight:700,fontSize:14,color:T.text,fontVariantNumeric:'tabular-nums'}}>{fmtFull(b.amount)}</span>
                </button>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <Section title="Payments" action={<span style={{...typo('caption'),color:T.textMuted}}>{partyPayments.length}</span>}/>
          {partyPayments.length === 0 ? (
            <EmptyState icon={ICONS.payments()} title="Koi payment nahi" body="Pehli payment likho."/>
          ) : (
            <div>
              {partyPayments.slice(0,4).map((p,i)=>(
                <div key={p.id} style={{
                  display:'flex',alignItems:'center',gap:10,padding:'10px 0',
                  borderBottom:i<3&&i<partyPayments.length-1?`1px solid ${T.divider}`:'none',
                }}>
                  <div style={{width:30,height:30,borderRadius:10,background:p.direction==='INCOMING'?C.positiveSoft:C.negativeSoft,color:p.direction==='INCOMING'?C.positive:C.negative,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                    {p.direction==='INCOMING'?ICONS.arrowDown():ICONS.arrowUp()}
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <p style={{...typo('bodySm'),color:T.text,fontWeight:600,margin:0}}>{p.mode}</p>
                    <p style={{...typo('caption'),color:T.textMuted,margin:'2px 0 0'}}>{new Date(p.date).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}</p>
                  </div>
                  <span style={{fontFamily:FONT,fontWeight:700,fontSize:14,color:p.direction==='INCOMING'?C.positive:C.negative,fontVariantNumeric:'tabular-nums'}}>
                    {p.direction==='INCOMING'?'+':'-'}{fmtFull(p.amount)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

// ─── NEW BILL SHEET ──────────────────────────────────────────────────────────

function NewBillSheet({ open, onClose, isMobile, defaultPartyId }){
  const {theme:T} = useTheme();
  const [partyId, setPartyId] = React.useState(defaultPartyId || PARTIES[0].id);
  const [items, setItems] = React.useState([
    { itemId: 'i1', qty: 50, rate: 180 },
    { itemId: 'i2', qty: 10, rate: 450 },
  ]);
  const [gst, setGst] = React.useState(18);
  const [note, setNote] = React.useState('');
  const [saving, setSaving] = React.useState(false);

  React.useEffect(()=>{
    if(defaultPartyId) setPartyId(defaultPartyId);
  },[defaultPartyId]);

  const customers = PARTIES.filter(p=>p.type==='CUSTOMER');

  const updateItem = (i, field, val) => {
    setItems(prev => prev.map((it,idx)=>{
      if(idx!==i) return it;
      if(field==='itemId'){
        const item = ITEMS.find(x=>x.id===val);
        return {...it, itemId:val, rate: item?.rate || it.rate};
      }
      return {...it, [field]: Number(val) || 0};
    }));
  };
  const addItem  = () => setItems(prev => [...prev, {itemId:ITEMS[0].id, qty:1, rate:ITEMS[0].rate}]);
  const delItem  = (i) => setItems(prev => prev.filter((_,idx)=>idx!==i));

  const subtotal = items.reduce((s,it)=>s + (it.qty * it.rate), 0);
  const taxAmt = Math.round(subtotal * gst / 100);
  const total = subtotal + taxAmt;

  async function handleSubmit(asFinal){
    setSaving(true);
    await new Promise(r=>setTimeout(r,700));
    setSaving(false);
    onClose();
  }

  return(
    <Sheet open={open} onClose={onClose} title="Naya Bill" subtitle="B-2605-019 · Draft" isMobile={isMobile} width={520}
      footer={
        <>
          <Button onClick={()=>handleSubmit(false)} variant="secondary" disabled={saving} fullWidth>Draft Rakho</Button>
          <Button onClick={()=>handleSubmit(true)} disabled={saving} fullWidth icon={saving?null:ICONS.check()} style={{flex:2}}>
            {saving ? 'Saving...' : 'Final Karo'}
          </Button>
        </>
      }>
      <Section title="Customer">
        <Select label={null} value={partyId} onChange={setPartyId}
          options={customers.map(p=>({value:p.id, label:p.name}))}/>
        {getParty(partyId)?.gstin && <p style={{...typo('caption'),color:T.textMuted,margin:'6px 0 0',fontFamily:MONO}}>GSTIN: {getParty(partyId).gstin}</p>}
      </Section>

      <Section title="Items" action={
        <button onClick={addItem} style={{...typo('caption'),color:C.primary,fontWeight:700,background:'transparent',border:'none',cursor:'pointer',padding:0,display:'flex',alignItems:'center',gap:3}}>{ICONS.plus()}Jodo</button>
      }>
        <div style={{display:'flex',flexDirection:'column',gap:8}}>
          {items.map((it,i)=>{
            const item = ITEMS.find(x=>x.id===it.itemId);
            const lineTotal = it.qty * it.rate;
            return(
              <div key={i} style={{
                background:T.surfaceAlt,borderRadius:RADIUS.md,padding:12,
                display:'grid',gridTemplateColumns:'1fr 60px 70px 70px 30px',gap:6,alignItems:'center',
              }}>
                <select value={it.itemId} onChange={e=>updateItem(i,'itemId',e.target.value)} style={{
                  background:'transparent',border:'none',color:T.text,
                  ...typo('bodySm'),fontWeight:600,fontFamily:FONT,outline:'none',cursor:'pointer',padding:0,
                }}>
                  {ITEMS.map(x=>(<option key={x.id} value={x.id}>{x.name}</option>))}
                </select>
                <input type="number" value={it.qty} onChange={e=>updateItem(i,'qty',e.target.value)}
                  style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:8,padding:'6px',color:T.text,...typo('bodySm'),fontFamily:FONT,outline:'none',textAlign:'center',width:'100%'}}/>
                <input type="number" value={it.rate} onChange={e=>updateItem(i,'rate',e.target.value)}
                  style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:8,padding:'6px',color:T.text,...typo('bodySm'),fontFamily:FONT,outline:'none',textAlign:'right',width:'100%'}}/>
                <span style={{fontFamily:FONT,fontWeight:700,fontSize:14,color:T.text,textAlign:'right',fontVariantNumeric:'tabular-nums'}}>{fmtFull(lineTotal)}</span>
                {items.length>1 ? (
                  <button onClick={()=>delItem(i)} style={{
                    width:26,height:26,borderRadius:8,border:'none',background:'transparent',color:T.textLight,
                    cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',
                  }}>{ICONS.trash()}</button>
                ) : <span/>}
              </div>
            );
          })}
        </div>
      </Section>

      <Section title="Tax & Notes">
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:10}}>
          <Select label="GST" value={gst} onChange={v=>setGst(+v)} options={[
            {value:0,label:'0%'},{value:5,label:'5%'},{value:12,label:'12%'},{value:18,label:'18%'},{value:28,label:'28%'},
          ]}/>
        </div>
        <Input label="Note (Optional)" value={note} onChange={setNote} placeholder="Kuch likhna hai?"/>
      </Section>

      <Section title={null}>
        <div style={{background:T.surfaceAlt,borderRadius:RADIUS.md,padding:'14px 16px'}}>
          {[
            {l:'Subtotal',v:subtotal,sub:true},
            {l:`GST @ ${gst}%`,v:taxAmt,sub:true},
          ].map(r=>(
            <div key={r.l} style={{display:'flex',justifyContent:'space-between',padding:'5px 0'}}>
              <span style={{...typo('bodySm'),color:T.textMuted}}>{r.l}</span>
              <span style={{fontFamily:FONT,fontWeight:600,color:T.text,fontVariantNumeric:'tabular-nums'}}>{fmtFull(r.v)}</span>
            </div>
          ))}
          <div style={{display:'flex',justifyContent:'space-between',padding:'10px 0 0',marginTop:6,borderTop:`1px solid ${T.divider}`}}>
            <span style={{...typo('h3'),color:T.text}}>Kul Total</span>
            <span style={{fontFamily:FONT,fontWeight:700,fontSize:22,color:C.primary,letterSpacing:'-0.4px',fontVariantNumeric:'tabular-nums'}}>{fmtFull(total)}</span>
          </div>
        </div>
      </Section>
    </Sheet>
  );
}

// ─── NEW PAYMENT SHEET ───────────────────────────────────────────────────────

function NewPaymentSheet({ open, onClose, isMobile, defaultPartyId, defaultDirection }){
  const {theme:T} = useTheme();
  const [partyId, setPartyId] = React.useState(defaultPartyId || PARTIES[0].id);
  const [direction, setDirection] = React.useState(defaultDirection || 'INCOMING');
  const [amount, setAmount] = React.useState('');
  const [mode, setMode] = React.useState('UPI');
  const [date, setDate] = React.useState('2026-05-15');
  const [note, setNote] = React.useState('');
  const [saving, setSaving] = React.useState(false);

  React.useEffect(()=>{
    if(defaultPartyId) setPartyId(defaultPartyId);
    if(defaultDirection) setDirection(defaultDirection);
  },[defaultPartyId, defaultDirection]);

  const party = getParty(partyId);

  async function handleSave(){
    setSaving(true);
    await new Promise(r=>setTimeout(r,500));
    setSaving(false);
    onClose();
  }

  return(
    <Sheet open={open} onClose={onClose} title="Payment Likho" isMobile={isMobile} width={460}
      footer={
        <Button onClick={handleSave} disabled={!amount || saving} fullWidth icon={saving?null:ICONS.check()}>
          {saving?'Saving...':'Save'}
        </Button>
      }>
      {/* Direction toggle - prominent */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:16}}>
        {[
          {id:'INCOMING',label:'Mila',sub:'Paisa aaya',color:C.positive,icon:ICONS.arrowDown()},
          {id:'OUTGOING',label:'Diya',sub:'Paisa gaya',color:C.negative,icon:ICONS.arrowUp()},
        ].map(d=>{
          const active = direction===d.id;
          return(
            <button key={d.id} onClick={()=>setDirection(d.id)} style={{
              padding:'14px',borderRadius:RADIUS.md,
              border:`1.5px solid ${active?d.color:T.border}`,
              background:active?d.color+'10':T.surface,
              cursor:'pointer',color:active?d.color:T.textMuted,
              display:'flex',flexDirection:'column',alignItems:'center',gap:4,
              transition:'all 0.15s',
            }}>
              {d.icon}
              <span style={{...typo('h3'),fontWeight:700,color:active?d.color:T.text}}>{d.label}</span>
              <span style={{...typo('caption'),color:T.textMuted}}>{d.sub}</span>
            </button>
          );
        })}
      </div>

      <div style={{display:'flex',flexDirection:'column',gap:14}}>
        <Input label="Amount" type="number" value={amount} onChange={setAmount} placeholder="0" prefix="₹" required autoFocus/>
        <Select label="Party" value={partyId} onChange={setPartyId}
          options={PARTIES.map(p=>({value:p.id, label:`${p.name} ${p.balance!==0?`(${p.balance<0?'lena':'dena'} ${fmt(Math.abs(p.balance))})`:''}`}))}
          required/>
        {party && party.balance!==0 && (
          <div style={{padding:'10px 12px',borderRadius:RADIUS.md,background:T.surfaceAlt,...typo('caption'),color:T.textMuted}}>
            Current balance: <strong style={{color:party.balance<0?C.positive:C.negative}}>{party.balance<0?'+':'-'}{fmtFull(Math.abs(party.balance))}</strong>
            {' '}({party.balance<0?'lena baki':'dena baki'})
          </div>
        )}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
          <Select label="Mode" value={mode} onChange={setMode}
            options={['UPI','NEFT','Cash','Cheque','RTGS']}/>
          <Input label="Date" type="date" value={date} onChange={setDate}/>
        </div>
        <Input label="Note" value={note} onChange={setNote} placeholder="Kuch likhna ho toh..." optional/>
      </div>
    </Sheet>
  );
}

// ─── ADD PARTY SHEET ─────────────────────────────────────────────────────────

function AddPartySheet({ open, onClose, isMobile, defaultType='CUSTOMER' }){
  const {theme:T} = useTheme();
  const [type, setType]=React.useState(defaultType);
  const [name, setName]=React.useState('');
  const [phone, setPhone]=React.useState('');
  const [city, setCity]=React.useState('');
  const [gstin, setGstin]=React.useState('');
  const [opening, setOpening]=React.useState('');
  const [saving, setSaving]=React.useState(false);

  async function handleSave(){
    setSaving(true);
    await new Promise(r=>setTimeout(r,400));
    setSaving(false);
    onClose();
  }

  return(
    <Sheet open={open} onClose={onClose} title="Nayi Party Jodo" isMobile={isMobile} width={460}
      footer={<Button onClick={handleSave} disabled={!name || saving} fullWidth icon={saving?null:ICONS.check()}>{saving?'Saving...':'Add Karo'}</Button>}>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:18}}>
        {[
          {id:'CUSTOMER',label:'Customer',sub:'Jisko bechte ho'},
          {id:'SUPPLIER',label:'Supplier',sub:'Jisse kharidte ho'},
        ].map(d=>{
          const active = type===d.id;
          return(
            <button key={d.id} onClick={()=>setType(d.id)} style={{
              padding:'14px',borderRadius:RADIUS.md,
              border:`1.5px solid ${active?C.primary:T.border}`,
              background:active?C.primarySoft:T.surface,
              cursor:'pointer',color:active?C.primary:T.text,
              display:'flex',flexDirection:'column',alignItems:'center',gap:2,
              transition:'all 0.15s',
            }}>
              <span style={{...typo('h3'),fontWeight:700,color:active?C.primary:T.text}}>{d.label}</span>
              <span style={{...typo('caption'),color:T.textMuted}}>{d.sub}</span>
            </button>
          );
        })}
      </div>

      <div style={{display:'flex',flexDirection:'column',gap:14}}>
        <Input label="Naam" value={name} onChange={setName} placeholder="e.g. Ramesh Cloth Store" required autoFocus/>
        <Input label="Phone" value={phone} onChange={setPhone} placeholder="98765-43210" type="tel"/>
        <Input label="City" value={city} onChange={setCity} placeholder="Mumbai" optional/>
        <Input label="GSTIN" value={gstin} onChange={setGstin} placeholder="27AAAAA0000A1Z5" hint="15 digit GSTIN — baad mein bhi add kar sakte ho" optional/>
        <Input label="Opening Balance" type="number" value={opening} onChange={setOpening} placeholder="0" prefix="₹" hint={`+ for ${type==='CUSTOMER'?'lena baki':'dena baki'}, - for ${type==='CUSTOMER'?'advance paid':'advance received'}`} optional/>
      </div>
    </Sheet>
  );
}

Object.assign(window, { BillDetail, PartyDetail, NewBillSheet, NewPaymentSheet, AddPartySheet });
