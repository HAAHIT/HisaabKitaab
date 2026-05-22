
// hk3-data.jsx — Mock data + helpers

const TODAY = new Date('2026-05-15');

const USER = {
  name: 'Raj Sharma',
  business: 'Sharma Cloth Store',
  email: 'raj@sharma.com',
  phone: '98765-43210',
  state: 'Maharashtra',
  gstin: '27AAAAA0000A1Z5',
  role: 'ADMIN',
  isOnboardingComplete: true,
};

const PARTIES = [
  // Customers
  { id: 'p1', name: 'Ramesh Cloth Store',  type:'CUSTOMER', phone:'98765-43211', city:'Mumbai',    balance:-89000, lastPayDays:48, isOverdue:true,  gstin:'27ABCDE1234F1Z5' },
  { id: 'p2', name: 'Sunita Enterprises',  type:'CUSTOMER', phone:'97654-32109', city:'Pune',      balance:-67000, lastPayDays:35, isOverdue:true,  gstin:'27FGHIJ5678K1Z9' },
  { id: 'p3', name: 'Sharma Electronics',  type:'CUSTOMER', phone:'95432-10987', city:'Mumbai',    balance:-45000, lastPayDays:8,  isOverdue:false, gstin:'27KLMNO9012P1Z3' },
  { id: 'p4', name: 'Agarwal Traders',     type:'CUSTOMER', phone:'94321-09876', city:'Nashik',    balance:-22000, lastPayDays:60, isOverdue:true,  gstin:'27QRSTU3456V1Z7' },
  { id: 'p5', name: 'Mehta Fabrics',       type:'CUSTOMER', phone:'92109-87654', city:'Thane',     balance:18000,  lastPayDays:12, isOverdue:false },
  { id: 'p6', name: 'Khan Brothers',       type:'CUSTOMER', phone:'93210-98765', city:'Mumbai',    balance:0,      lastPayDays:5,  isOverdue:false },
  // Suppliers
  { id: 'p7', name: 'Patel Textiles',      type:'SUPPLIER', phone:'96543-21098', city:'Surat',     balance:32000,  lastPayDays:6,  isOverdue:false, gstin:'24WXYZ7890A1Z2' },
  { id: 'p8', name: 'Gupta Hardware',      type:'SUPPLIER', phone:'98123-45678', city:'Pune',      balance:-15000, lastPayDays:0,  isOverdue:false },
];

const BILLS = [
  { id: 'b1',  no:'B-2605-018', partyId:'p1', amount:52000, gst:18, status:'FINAL',    date:'2026-05-14', paid:0,     items:3 },
  { id: 'b2',  no:'B-2605-017', partyId:'p3', amount:45000, gst:18, status:'FINAL',    date:'2026-05-13', paid:45000, items:2 },
  { id: 'b3',  no:'B-2605-016', partyId:'p5', amount:18000, gst:12, status:'DRAFT',    date:'2026-05-12', paid:0,     items:1 },
  { id: 'b4',  no:'B-2605-015', partyId:'p2', amount:67000, gst:18, status:'FINAL',    date:'2026-05-10', paid:0,     items:4 },
  { id: 'b5',  no:'B-2605-014', partyId:'p4', amount:28900, gst:18, status:'FINAL',    date:'2026-05-08', paid:6900,  items:2 },
  { id: 'b6',  no:'B-2604-013', partyId:'p3', amount:89000, gst:18, status:'FINAL',    date:'2026-04-28', paid:89000, items:5 },
  { id: 'b7',  no:'B-2604-012', partyId:'p1', amount:34500, gst:12, status:'FINAL',    date:'2026-04-25', paid:0,     items:2 },
  { id: 'b8',  no:'B-2604-011', partyId:'p6', amount:15600, gst:5,  status:'CANCELLED',date:'2026-04-22', paid:0,     items:1 },
];

const PAYMENTS = [
  // EXPECTED (action needed)
  { id:'pay1', partyId:'p1', amount:25000, direction:'INCOMING', mode:'UPI',    date:'2026-05-16', status:'EXPECTED', billNo:'B-2605-018', note:'Promised on call' },
  { id:'pay2', partyId:'p2', amount:30000, direction:'INCOMING', mode:'NEFT',   date:'2026-05-17', status:'EXPECTED', note:'Quarterly schedule' },
  { id:'pay3', partyId:'p7', amount:12000, direction:'OUTGOING', mode:'Cheque', date:'2026-05-20', status:'EXPECTED', note:'Pending material order' },
  // COMPLETED
  { id:'pay4', partyId:'p3', amount:45000, direction:'INCOMING', mode:'NEFT', date:'2026-05-13', status:'COMPLETED', billNo:'B-2605-017' },
  { id:'pay5', partyId:'p5', amount:15000, direction:'INCOMING', mode:'UPI',  date:'2026-05-12', status:'COMPLETED' },
  { id:'pay6', partyId:'p3', amount:89000, direction:'INCOMING', mode:'NEFT', date:'2026-04-28', status:'COMPLETED', billNo:'B-2604-013' },
  { id:'pay7', partyId:'p7', amount:22000, direction:'OUTGOING', mode:'Cash', date:'2026-04-27', status:'COMPLETED', note:'Material payment' },
  { id:'pay8', partyId:'p4', amount:6900,  direction:'INCOMING', mode:'UPI',  date:'2026-04-26', status:'COMPLETED', billNo:'B-2605-014' },
  { id:'pay9', partyId:'p8', amount:18000, direction:'OUTGOING', mode:'UPI',  date:'2026-04-22', status:'COMPLETED', note:'Quarter advance' },
];

const ITEMS = [
  { id:'i1', name:'Cotton Fabric',   hsn:'5208', unit:'METRES', rate:180, gst:5  },
  { id:'i2', name:'Silk Thread',     hsn:'5403', unit:'METRES', rate:450, gst:12 },
  { id:'i3', name:'Polyester Cloth', hsn:'5407', unit:'METRES', rate:220, gst:5  },
  { id:'i4', name:'Wool Blend',      hsn:'5111', unit:'METRES', rate:380, gst:12 },
  { id:'i5', name:'Cotton Yarn',     hsn:'5205', unit:'KG',     rate:280, gst:5  },
];

const BANK_ACCOUNTS = [
  { id:'ba1', bank:'HDFC Bank', last4:'4567', type:'CURRENT',  balance:284500 },
  { id:'ba2', bank:'SBI',       last4:'2341', type:'SAVINGS',  balance:48200  },
  { id:'ba3', bank:'Cash',      last4:'',     type:'CASH',     balance:18500  },
];

const PURCHASES = [
  { id:'pu1', no:'P-2605-009', partyId:'p7', amount:48000, gst:18, status:'FINAL',    date:'2026-05-13', paid:48000, items:3 },
  { id:'pu2', no:'P-2605-008', partyId:'p8', amount:22000, gst:12, status:'FINAL',    date:'2026-05-11', paid:0,     items:2 },
  { id:'pu3', no:'P-2605-007', partyId:'p7', amount:15500, gst:18, status:'DRAFT',    date:'2026-05-09', paid:0,     items:1 },
  { id:'pu4', no:'P-2604-006', partyId:'p7', amount:67000, gst:18, status:'FINAL',    date:'2026-04-28', paid:67000, items:4 },
  { id:'pu5', no:'P-2604-005', partyId:'p8', amount:18000, gst:12, status:'FINAL',    date:'2026-04-22', paid:18000, items:1 },
  { id:'pu6', no:'P-2604-004', partyId:'p7', amount:34000, gst:18, status:'CANCELLED',date:'2026-04-15', paid:0,     items:2 },
];

const NOTES = [
  { id:'n1', no:'CN-2605-003', partyId:'p1', amount:5000,  type:'CREDIT', date:'2026-05-14', reason:'Saman wapasi (sales return)', billNo:'B-2605-018' },
  { id:'n2', no:'CN-2605-002', partyId:'p3', amount:2500,  type:'CREDIT', date:'2026-05-10', reason:'Discount adjustment',         billNo:'B-2605-017' },
  { id:'n3', no:'DN-2605-001', partyId:'p7', amount:3200,  type:'DEBIT',  date:'2026-05-08', reason:'Purchase return — torn item', billNo:'P-2605-009' },
  { id:'n4', no:'CN-2604-001', partyId:'p2', amount:8000,  type:'CREDIT', date:'2026-04-26', reason:'Quality complaint refund',    billNo:'B-2604-013' },
];

const TRANSFERS = [
  { id:'tr1', from:'ba1', to:'ba3', amount:10000, date:'2026-05-14', note:'Cash withdrawal' },
  { id:'tr2', from:'ba3', to:'ba2', amount:5000,  date:'2026-05-10', note:'Deposit to savings' },
];

// ── Computed helpers ─────────────────────────────────────────────────────────

function getParty(id){ return PARTIES.find(p=>p.id===id); }
function getBill(id){  return BILLS.find(b=>b.id===id); }

function dashboardSummary(){
  const receivable = PARTIES.filter(p=>p.balance<0&&p.type==='CUSTOMER').reduce((s,p)=>s+Math.abs(p.balance),0);
  const payable    = PARTIES.filter(p=>p.balance>0&&p.type==='SUPPLIER').reduce((s,p)=>s+p.balance,0);
  const overdue    = PARTIES.filter(p=>p.isOverdue);
  const overdueAmount = overdue.reduce((s,p)=>s+Math.abs(p.balance),0);
  const collectedMonth = PAYMENTS.filter(p=>p.direction==='INCOMING'&&p.status==='COMPLETED'&&p.date.startsWith('2026-05')).reduce((s,p)=>s+p.amount,0);
  const billedMonth = BILLS.filter(b=>b.date.startsWith('2026-05')&&b.status==='FINAL').reduce((s,b)=>s+b.amount,0);
  return { receivable, payable, overdueCount: overdue.length, overdueAmount, overdueParty: overdue[0], collectedMonth, billedMonth, baakiMonth: billedMonth - PAYMENTS.filter(p=>p.direction==='INCOMING'&&p.status==='COMPLETED'&&BILLS.find(b=>b.no===p.billNo)?.date.startsWith('2026-05')).reduce((s,p)=>s+p.amount,0) };
}

const MONTHLY_TREND = [
  {m:'Nov', billed:280000, mila:215000},
  {m:'Dec', billed:340000, mila:298000},
  {m:'Jan', billed:295000, mila:268000},
  {m:'Feb', billed:420000, mila:345000},
  {m:'Mar', billed:385000, mila:412000},
  {m:'Apr', billed:478000, mila:284000},
  {m:'May', billed:182000, mila:60000},
];

// WhatsApp helpers
function normalizePhone(p){
  const d = String(p).replace(/\D/g,'');
  return d.length>=10 ? (d.length===10?'91'+d:d) : d;
}
function waLink(party, amount){
  const phone = normalizePhone(party.phone);
  const firstName = party.name.split(' ')[0];
  const amt = fmtFull(Math.abs(amount));
  const msg = `Namaste ${firstName} ji, aapse ${amt} ka hisaab baaki hai. Jab convenient ho, please clear kar dein. Dhanyavaad.\n— ${USER.business}`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
}
function telLink(party){
  return `tel:+${normalizePhone(party.phone)}`;
}

Object.assign(window, {
  USER, PARTIES, BILLS, PURCHASES, PAYMENTS, NOTES, TRANSFERS, ITEMS, BANK_ACCOUNTS, MONTHLY_TREND, TODAY,
  getParty, getBill, dashboardSummary, normalizePhone, waLink, telLink,
});
