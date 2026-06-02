import type { Metadata } from "next";
import { headers } from "next/headers";
import Image from "next/image";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { isIpRateLimited } from "@/lib/api-rate-limit";
import { GST_STATE_CODES } from "@/lib/gst-states";
import { serializeTenantSettings } from "@/lib/tenant-settings";
import type { ColumnDef } from "@/lib/formula";
import { PrintButton } from "./PrintButton";

// ─── Helpers (duplicated from bill detail — no client import allowed here) ────

const ONES = ["","One","Two","Three","Four","Five","Six","Seven","Eight","Nine",
  "Ten","Eleven","Twelve","Thirteen","Fourteen","Fifteen","Sixteen","Seventeen","Eighteen","Nineteen"];
const TENS = ["","","Twenty","Thirty","Forty","Fifty","Sixty","Seventy","Eighty","Ninety"];
function w(n: number): string {
  if (!n) return "";
  if (n < 20) return ONES[n];
  if (n < 100) return TENS[Math.floor(n/10)] + (n%10?" "+ONES[n%10]:"");
  return ONES[Math.floor(n/100)]+" Hundred"+(n%100?" and "+w(n%100):"");
}
function numberToWords(amount: number): string {
  // Work in paise so 0.25 doesn't round to 0 and produce "Zero Rupees Only".
  const totalPaise = Math.round(Math.abs(amount) * 100);
  if (!totalPaise) return "Zero Rupees Only";
  const rupees = Math.floor(totalPaise / 100);
  const paise = totalPaise % 100;
  const rupeeWords = (() => {
    if (!rupees) return "";
    const cr=Math.floor(rupees/1e7), lk=Math.floor((rupees%1e7)/1e5), th=Math.floor((rupees%1e5)/1e3), rm=rupees%1e3;
    return [(cr?w(cr)+" Crore ":""),(lk?w(lk)+" Lakh ":""),(th?w(th)+" Thousand ":""),(rm?w(rm):"")].join("").trim();
  })();
  const paiseWords = paise ? `${w(paise).trim()} Paise` : "";
  const parts: string[] = [];
  if (rupeeWords) parts.push(`Indian Rupees ${rupeeWords}`);
  if (paiseWords) parts.push(rupeeWords ? `and ${paiseWords}` : paiseWords);
  return `${parts.join(" ")} Only.`;
}
function formatINR(n: number) {
  return new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",minimumFractionDigits:2,maximumFractionDigits:2}).format(n);
}
function formatVal(colName: string, value: number) {
  const l = colName.toLowerCase();
  return (l.includes("rate")||l.includes("price")||l.includes("amount")||l.includes("total")||l.includes("₹")||l.includes("rs"))
    ? formatINR(value)
    : new Intl.NumberFormat("en-IN",{maximumFractionDigits:2}).format(value);
}
function fmtDate(d: Date) {
  return d.toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"});
}
function stateName(code: string|null) {
  return code && GST_STATE_CODES[code] ? GST_STATE_CODES[code] : (code || "");
}

// ─── Data fetch ───────────────────────────────────────────────────────────────

async function getBill(id: string) {
  return prisma.bill.findFirst({
    where: { id, status: "FINAL", isDeleted: false },
    select: {
      id: true,
      billNumber: true,
      customerName: true,
      customerPhone: true,
      customerAddress: true,
      gstin: true,
      rows: true,
      notes: true,
      terms: true,
      subtotal: true,
      taxPercent: true,
      taxAmount: true,
      grandTotal: true,
      roundOff: true,
      isInterState: true,
      placeOfSupply: true,
      hsnCode: true,
      createdAt: true,
      date: true,
      template: { select: { name: true, columns: true } },
      tenant: {
        select: {
          name: true,
          phone: true,
          email: true,
          address: true,
          gstin: true,
          logoUrl: true,
          settings: true,
        },
      },
    },
  });
}

// ─── Metadata ─────────────────────────────────────────────────────────────────

export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> }
): Promise<Metadata> {
  const { id } = await params;
  const bill = await getBill(id);
  if (!bill) return { title: "Invoice Not Found" };
  const settings = serializeTenantSettings(bill.tenant);
  return {
    title: `Invoice ${bill.billNumber} — ${settings.companyName || bill.tenant.name}`,
    description: `Tax Invoice for ${bill.customerName} · ${formatINR(Number(bill.grandTotal))}`,
    robots: { index: false, follow: false },
  };
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function PublicBillPage(
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Rate-limit by IP — these are public, unauthenticated pages, so cap how fast
  // a single client can pull invoices (blunts bill-ID scraping/enumeration).
  const hdrs = await headers();
  const ip =
    hdrs.get("x-forwarded-for")?.split(",").at(-1)?.trim() ||
    hdrs.get("x-real-ip")?.trim() ||
    "unknown";
  if (await isIpRateLimited("public-bill", ip, 60)) {
    return (
      <div style={{ maxWidth: 480, margin: "80px auto", padding: 24, textAlign: "center", fontFamily: "system-ui, sans-serif" }}>
        <h1 style={{ fontSize: 18, fontWeight: 700 }}>Too many requests</h1>
        <p style={{ color: "#666", marginTop: 8 }}>Please wait a minute and try again.</p>
      </div>
    );
  }

  const bill = await getBill(id);
  if (!bill) notFound();

  const settings  = serializeTenantSettings(bill.tenant);
  const cols      = bill.template.columns as unknown as ColumnDef[];
  const isIS      = bill.isInterState;
  const sub       = Number(bill.subtotal);
  const tax       = Number(bill.taxAmount);
  const total     = Number(bill.grandTotal);
  const roundOff  = Number(bill.roundOff);
  const taxRateCol = cols.find(c => c.type === "number" && ["tax rate","tax%","gst rate","gst%"].some(h => c.name.toLowerCase().includes(h)));
  const rowRates = taxRateCol
    ? (bill.rows as Record<string,string|number>[])
        .map(r => typeof r[taxRateCol.id] === "number" ? r[taxRateCol.id] as number : 0)
        .filter(r => r > 0)
    : [];
  const isMultiRate = new Set(rowRates).size > 1;
  const taxPct    = !isMultiRate && rowRates.length > 0 ? rowRates[0] : Number(bill.taxPercent);
  const halfRate  = taxPct / 2;
  const halfTax   = Math.round((tax / 2) * 100) / 100;
  const cgst      = halfTax;
  const sgst      = halfTax;
  const supply    = bill.placeOfSupply ? stateName(bill.placeOfSupply) : "";
  const supplyFull = bill.placeOfSupply ? `${supply} (${bill.placeOfSupply})` : "";
  const upiLink   = settings.upiId
    ? `upi://pay?pa=${encodeURIComponent(settings.upiId)}&pn=${encodeURIComponent(settings.companyName)}&am=${total.toFixed(2)}&tn=${encodeURIComponent("Payment for " + bill.billNumber)}&cu=INR`
    : null;

  const numCols = cols.filter(c => c.type==="number"||c.type==="formula").length;
  const textCols = cols.length - numCols;
  const spanLeft = 1 + textCols;

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight:"100vh", background:"#e5e7eb", padding:"24px 12px 80px", fontFamily:'"Arial","Helvetica",sans-serif' }}>

      {/* Print CSS — safe in server component head via Next.js */}
      <style>{`
        @media print {
          @page { margin: 8mm; size: A4 portrait; }
          html, body { margin: 0 !important; padding: 0 !important; background: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display: none !important; }
          .bill-wrap { background: white !important; padding: 0 !important; min-height: 0 !important; }
          .bill-paper { box-shadow: none !important; border-radius: 0 !important; max-width: 100% !important; width: 100% !important; box-sizing: border-box !important; margin: 0 !important; }
          .bill-pad-row { display: none !important; }
          .bill-paper table th { white-space: normal !important; }
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #e5e7eb; }
      `}</style>

      {/* ── Top action bar (hidden on print) ── */}
      <div className="no-print" style={{ maxWidth:860, margin:"0 auto 16px", display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:10 }}>
        <div style={{ fontSize:13, color:"#374151", fontFamily:"Arial,sans-serif" }}>
          <span style={{ fontWeight:700, color:"#111" }}>{settings.companyName}</span>
          {" · "}Invoice <span style={{ fontFamily:"monospace", fontWeight:700 }}>{bill.billNumber}</span>
        </div>
        <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
          {upiLink && (
            <a href={upiLink} style={{ display:"inline-flex", alignItems:"center", gap:6, padding:"8px 18px", borderRadius:8, background:"#16a34a", color:"white", fontWeight:700, fontSize:13, textDecoration:"none" }}>
              Pay ₹{total.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} via UPI
            </a>
          )}
          <PrintButton />
        </div>
      </div>

      {/* ── Invoice paper ── */}
      <div
        className="bill-paper"
        style={{ maxWidth:860, margin:"0 auto", background:"white", color:"#111", border:"1.5px solid #888", boxShadow:"0 8px 40px rgba(0,0,0,0.15)" }}
      >

        {/* Top meta strip */}
        <div style={{ display:"flex", justifyContent:"space-between", padding:"6px 14px", borderBottom:"1px solid #ccc", fontSize:10 }}>
          <span style={{ fontWeight:700, letterSpacing:1, textTransform:"uppercase", color:"#555" }}>Tax Invoice</span>
          <span style={{ color:"#555" }}>Subject to {supply || "local"} Jurisdiction</span>
        </div>

        {/* Company nameplate */}
        <div style={{ textAlign:"center", padding:"14px 20px 10px", borderBottom:"1.5px solid #333" }}>
          {bill.tenant.logoUrl && (
            <Image
              src={bill.tenant.logoUrl}
              alt="Logo"
              width={200}
              height={56}
              unoptimized
              style={{ height:56, width:"auto", objectFit:"contain", display:"block", margin:"0 auto 8px" }}
            />
          )}
          <div style={{ fontWeight:900, fontSize:28, letterSpacing:0.5, lineHeight:1 }}>
            {settings.companyName || bill.tenant.name}
          </div>
          {settings.companyAddress && (
            <div style={{ fontSize:11, color:"#444", marginTop:5, lineHeight:1.4 }}>
              {settings.companyAddress.replace(/\n/g," · ")}
              {settings.companyPhone ? `  ·  Mo: ${settings.companyPhone}` : ""}
              {settings.companyEmail ? `  ·  ${settings.companyEmail}` : ""}
            </div>
          )}
          {settings.companyGstin && (
            <div style={{ fontSize:11, fontWeight:700, marginTop:4, letterSpacing:0.5 }}>
              GST NO : {settings.companyGstin.toUpperCase()}
            </div>
          )}
        </div>

        {/* Party + Invoice meta */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", borderBottom:"1.5px solid #333" }}>
          <div style={{ padding:"10px 14px", borderRight:"1px solid #999", fontSize:11 }}>
            <div style={{ fontWeight:700, marginBottom:5 }}>Party Name &amp; Address :</div>
            <div style={{ fontWeight:800, fontSize:13 }}>{bill.customerName}</div>
            {bill.customerAddress && (
              <div style={{ color:"#444", lineHeight:1.5, marginTop:3, whiteSpace:"pre-line" }}>{bill.customerAddress}</div>
            )}
            {bill.customerPhone && <div style={{ marginTop:3 }}>Ph: {bill.customerPhone}</div>}
            {bill.gstin && (
              <div style={{ marginTop:5, fontWeight:700 }}>
                GST No: <span style={{ fontFamily:"monospace" }}>{bill.gstin.toUpperCase()}</span>
              </div>
            )}
            {bill.placeOfSupply && (
              <div style={{ marginTop:3, color:"#555" }}>
                State: {supplyFull} ·{" "}
                <span style={{ fontWeight:700, color: isIS ? "#b45309" : "#047857" }}>
                  {isIS ? "Inter-State" : "Intra-State"}
                </span>
              </div>
            )}
          </div>
          <div style={{ padding:"10px 14px", fontSize:11 }}>
            {([
              ["Invoice No", bill.billNumber],
              ["Date", fmtDate(bill.date ?? bill.createdAt)],
              ...(bill.hsnCode ? [["HSN / SAC", bill.hsnCode]] : []),
              ...(bill.placeOfSupply ? [["Place of Supply", supplyFull]] : []),
              ...(bill.terms ? [["Payment Terms", bill.terms]] : []),
            ] as [string,string][]).map(([label, val]) => (
              <div key={label} style={{ display:"flex", gap:8, marginBottom:5 }}>
                <span style={{ minWidth:110, fontWeight:700, color:"#333" }}>{label}</span>
                <span>: &nbsp;{val}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Items table */}
        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
          <thead>
            <tr style={{ background:"#f0f0f0", borderBottom:"1.5px solid #333" }}>
              <th style={TH({ w:36, center:true })}>S.No</th>
              {cols.map((col, i) => (
                <th key={col.id} style={TH({ right:col.type==="number"||col.type==="formula", last:i===cols.length-1 })}>
                  {col.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(bill.rows as Record<string,string|number>[]).map((row, ri) => {
              const rowHsn = typeof row._hsnCode === "string" && row._hsnCode.trim() ? row._hsnCode.trim() : null;
              const firstTextColId = cols.find(c => c.type !== "number" && c.type !== "formula")?.id ?? null;
              return (
                <tr key={ri} style={{ borderBottom:"1px solid #ddd", background:ri%2===1?"#fafafa":"white" }}>
                  <td style={TD({ center:true, muted:true })}>{ri+1}</td>
                  {cols.map((col, ci) => (
                    <td key={col.id} style={TD({ right:col.type==="number"||col.type==="formula", bold:col.type==="formula", last:ci===cols.length-1 })}>
                      {(col.type==="number"||col.type==="formula")
                        ? typeof row[col.id]==="number" ? formatVal(col.name, row[col.id] as number) : row[col.id]||"—"
                        : <>
                            {row[col.id]||"—"}
                            {rowHsn && col.id === firstTextColId && (
                              <span style={{ display:"block", fontSize:9, color:"#888", marginTop:1 }}>
                                HSN/SAC: {rowHsn}
                              </span>
                            )}
                          </>
                      }
                    </td>
                  ))}
                </tr>
              );
            })}

            {/* Blank filler */}
            {(bill.rows as unknown[]).length < 5 && Array.from({length:5-(bill.rows as unknown[]).length}).map((_,i) => (
              <tr key={`pad-${i}`} className="bill-pad-row" style={{ borderBottom:"1px solid #e8e8e8", height:28, background:i%2===0?"#fafafa":"white" }}>
                <td style={TD({ center:true })}>&nbsp;</td>
                {cols.map((col,ci) => <td key={col.id} style={TD({ last:ci===cols.length-1 })}>&nbsp;</td>)}
              </tr>
            ))}

            {/* Sub Total */}
            <tr style={{ borderTop:"1.5px solid #555", borderBottom:"1px solid #ddd" }}>
              <td colSpan={spanLeft} style={{ ...TD({}), borderRight:"1px solid #ccc" }}>&nbsp;</td>
              {numCols > 1 && Array.from({length:numCols-1}).map((_,i) => (
                <td key={i} style={{ ...TD({ right:true }), borderRight:"1px solid #ccc" }}>&nbsp;</td>
              ))}
              <td style={{ ...TD({ last:true }), background:"#fafafa" }}>
                <div style={{ display:"flex", justifyContent:"space-between", gap:16 }}>
                  <span style={{ color:"#555", fontWeight:600 }}>Sub Total</span>
                  <span style={{ fontFamily:"monospace", fontWeight:700 }}>{formatINR(sub)}</span>
                </div>
              </td>
            </tr>

            {/* Tax rows */}
            {(isIS
              ? [[`IGST @ ${taxPct}%`, tax]]
              : [[`OUTPUT CENTRAL GST (CGST) @ ${halfRate}%`, cgst],[`OUTPUT STATE GST (SGST) @ ${halfRate}%`, sgst]]
            ).map(([label, amt]) => (
              <tr key={String(label)} style={{ borderBottom:"1px solid #e5e5e5" }}>
                <td colSpan={spanLeft} style={{ ...TD({}), borderRight:"1px solid #ccc" }}>&nbsp;</td>
                {numCols > 1 && Array.from({length:numCols-1}).map((_,i) => (
                  <td key={i} style={{ ...TD({ right:true }), borderRight:"1px solid #ccc" }}>&nbsp;</td>
                ))}
                <td style={{ ...TD({ last:true }), background:"#fffbf5" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", gap:16 }}>
                    <span style={{ color:"#6b4c00", fontSize:11, fontWeight:600 }}>{String(label)}</span>
                    <span style={{ fontFamily:"monospace" }}>{formatINR(Number(amt))}</span>
                  </div>
                </td>
              </tr>
            ))}

            {/* Round off */}
            {roundOff !== 0 && (
              <tr style={{ borderBottom:"1px solid #e5e5e5" }}>
                <td colSpan={spanLeft} style={{ ...TD({}), borderRight:"1px solid #ccc" }}>&nbsp;</td>
                {numCols > 1 && Array.from({length:numCols-1}).map((_,i) => (
                  <td key={i} style={{ ...TD({ right:true }), borderRight:"1px solid #ccc" }}>&nbsp;</td>
                ))}
                <td style={{ ...TD({ last:true }) }}>
                  <div style={{ display:"flex", justifyContent:"space-between", gap:16 }}>
                    <span style={{ color:"#6b7280", fontSize:11 }}>Round Off</span>
                    <span style={{ fontFamily:"monospace", fontSize:11 }}>({roundOff > 0 ? "+" : ""}{formatINR(roundOff)})</span>
                  </div>
                </td>
              </tr>
            )}

            {/* Grand Total */}
            <tr style={{ background:"#1e3a5f", borderTop:"2px solid #1e3a5f" }}>
              <td colSpan={1} style={{ padding:"10px 10px", color:"white", fontWeight:900, fontSize:14, textAlign:"center", borderRight:"1px solid rgba(255,255,255,0.2)" }}>
                Total
              </td>
              {cols.map((col, ci) => {
                const isLast = ci===cols.length-1;
                const isNum  = col.type==="number"||col.type==="formula";
                const isLastVal = ci===cols.length-1 && isNum;
                return (
                  <td key={col.id} style={{ padding:"10px 12px", textAlign:isNum?"right":"left", color:"white", fontFamily:isNum?"monospace":"inherit", fontWeight:isLastVal?900:400, fontSize:isLastVal?16:13, borderRight:isLast?"none":"1px solid rgba(255,255,255,0.2)" }}>
                    {isLastVal ? formatINR(total) : " "}
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>

        {/* Amount in words */}
        <div style={{ padding:"10px 14px", borderTop:"1.5px solid #333", borderBottom:"1px solid #ccc", fontSize:12 }}>
          <span style={{ fontWeight:700 }}>Rs. in words : </span>
          <span>{numberToWords(total)}</span>
        </div>

        {/* Notes */}
        {bill.notes && (
          <div style={{ padding:"8px 14px", borderBottom:"1px solid #ccc", fontSize:11, color:"#444" }}>
            <span style={{ fontWeight:700 }}>Declaration / Notes : </span>{bill.notes}
          </div>
        )}

        {/* Footer: bank + signatures */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", borderTop:"1.5px solid #333" }}>
          <div style={{ padding:"12px 14px", borderRight:"1px solid #999", fontSize:11 }}>
            <div style={{ fontWeight:800, marginBottom:8, fontSize:12 }}>Company&apos;s Bank Details</div>
            {settings.bankName || settings.bankAccountNumber ? (
              <div style={{ lineHeight:1.8 }}>
                {settings.bankName && <div><span style={{ fontWeight:700 }}>Bank Name :</span> {settings.bankName}</div>}
                {settings.bankAccountNumber && <div><span style={{ fontWeight:700 }}>A/c Number :</span> <span style={{ fontFamily:"monospace" }}>{settings.bankAccountNumber}</span></div>}
                {settings.bankBranch && <div><span style={{ fontWeight:700 }}>Branch :</span> {settings.bankBranch}</div>}
                {settings.bankIfscCode && <div><span style={{ fontWeight:700 }}>IFSC Code :</span> <span style={{ fontFamily:"monospace" }}>{settings.bankIfscCode}</span></div>}
                {settings.upiId && <div style={{ marginTop:4 }}><span style={{ fontWeight:700 }}>UPI ID :</span> {settings.upiId}</div>}
              </div>
            ) : settings.upiId ? (
              <>
                <div><span style={{ fontWeight:700 }}>UPI ID :</span> {settings.upiId}</div>
                <div style={{ marginTop:4, fontSize:10, color:"#777" }}>Scan &amp; Pay via any UPI app</div>
              </>
            ) : (
              <div style={{ color:"#999", fontSize:10 }}>Contact us for payment details.</div>
            )}
            {bill.terms && (
              <div style={{ marginTop:10, fontSize:10, color:"#666" }}>
                <span style={{ fontWeight:700 }}>Terms : </span>{bill.terms}
              </div>
            )}
          </div>
          <div style={{ padding:"12px 14px", fontSize:11 }}>
            <div style={{ fontWeight:800, marginBottom:32, textAlign:"right" }}>
              for {settings.companyName || bill.tenant.name}
            </div>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-end", marginTop:24 }}>
              <div style={{ textAlign:"center" }}>
                <div style={{ width:110, borderTop:"1.5px solid #888", paddingTop:4, fontSize:10, color:"#666", textTransform:"uppercase", letterSpacing:0.5 }}>
                  Customer Seal &amp; Signature
                </div>
              </div>
              <div style={{ textAlign:"center" }}>
                <div style={{ width:110, borderTop:"1.5px solid #888", paddingTop:4, fontSize:10, color:"#666", textTransform:"uppercase", letterSpacing:0.5 }}>
                  Authorised Signatory
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Generated by */}
        <div style={{ borderTop:"1px solid #ccc", padding:"6px 14px", background:"#f9f9f9", display:"flex", justifyContent:"space-between", fontSize:9, color:"#aaa" }}>
          <span>E &amp; O.E.</span>
          <span>Computer-generated invoice by <strong style={{ color:"#777" }}>SoloBooks</strong> · No physical signature required</span>
        </div>

      </div>{/* /bill-paper */}

      {/* Mobile UPI pay button */}
      {upiLink && (
        <div className="no-print" style={{ maxWidth:860, margin:"16px auto 0" }}>
          <a href={upiLink}
            style={{ display:"block", textAlign:"center", padding:"14px", borderRadius:10, background:"#16a34a", color:"white", fontWeight:800, fontSize:16, textDecoration:"none" }}>
            💳 Pay ₹{total.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Now via UPI
          </a>
          <p style={{ textAlign:"center", fontSize:11, color:"#666", marginTop:8 }}>
            Opens your UPI app · Google Pay · PhonePe · Paytm
          </p>
        </div>
      )}

    </div>
  );
}

// ─── Table cell helpers ────────────────────────────────────────────────────────

function TH({ w: width, center, right, last }: { w?: number; center?: boolean; right?: boolean; last?: boolean }): React.CSSProperties {
  return { padding:"8px 12px", fontWeight:700, fontSize:11, color:"#222", textAlign:center?"center":right?"right":"left", borderBottom:"1.5px solid #333", borderRight:last?"none":"1px solid #ccc", background:"#f0f0f0", whiteSpace:"nowrap", ...(width?{width}:{}) };
}
function TD({ center, right, bold, muted, last }: { center?: boolean; right?: boolean; bold?: boolean; muted?: boolean; last?: boolean }): React.CSSProperties {
  return { padding:"8px 12px", verticalAlign:"middle", textAlign:center?"center":right?"right":"left", fontFamily:right?"monospace":"inherit", fontWeight:bold?700:400, color:muted?"#888":"#111", borderRight:last?"none":"1px solid #ddd" };
}
