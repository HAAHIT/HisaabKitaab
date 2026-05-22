
// hk3-design.jsx — Minimalist design system
// Restraint-first. Color used sparingly. White space generously.

const C = {
  // Accent (used sparingly — primary action, focus rings)
  primary:   '#2563eb',
  primarySoft: '#e8f0fe',
  primaryDark: '#13224a',

  // Semantic (only on amounts / status indicators)
  positive:  '#0a8754',   // money in (deeper than before for AAA contrast)
  negative:  '#c43e1c',   // money out (deeper red-orange)
  warning:   '#b07a00',   // drafts / pending
  info:      '#5b4dbf',

  // Backgrounds for tints
  positiveSoft: '#e6f5ee',
  negativeSoft: '#fdebe5',
  warningSoft:  '#fff5d9',
  infoSoft:     '#efedfb',
};

// Dark / light theme tokens — only surface, never accent
const LIGHT = {
  id: 'light',
  bg:        '#faf7f0',   // subtle paper cream — khata identity in light mode
  surface:   '#ffffff',
  surfaceAlt:'#f5f1e7',
  border:    'rgba(60,40,15,0.10)',
  borderStrong:'rgba(60,40,15,0.18)',
  text:      '#1a1410',
  textMuted: '#5c5340',
  textLight: '#9a8e72',
  divider:   'rgba(60,40,15,0.07)',
  hover:     'rgba(60,40,15,0.04)',
  shadow:    '0 1px 2px rgba(60,40,15,0.04), 0 0 0 1px rgba(60,40,15,0.05)',
  shadowLg:  '0 24px 60px -16px rgba(60,40,15,0.18)',
  overlay:   'rgba(15,15,25,0.45)',
};
const DARK = {
  id: 'dark',
  bg:        '#0b0b14',
  surface:   '#141420',
  surfaceAlt:'#1c1c2a',
  border:    'rgba(255,255,255,0.08)',
  borderStrong:'rgba(255,255,255,0.18)',
  text:      '#eef0f7',
  textMuted: '#9498ab',
  textLight: '#5e6177',
  divider:   'rgba(255,255,255,0.06)',
  hover:     'rgba(255,255,255,0.04)',
  shadow:    '0 1px 2px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.06)',
  shadowLg:  '0 24px 60px -16px rgba(0,0,0,0.6)',
  overlay:   'rgba(0,0,0,0.62)',
};

const FONT = `'Inter', -apple-system, BlinkMacSystemFont, sans-serif`;
const BRAND = `'Tiro Devanagari Hindi', 'Eczar', Georgia, serif`;   // warm khata-era serif for headings + wordmark
const DISPLAY = `'Eczar', Georgia, serif`;                          // Indian-designed display for h1 / hero numbers
const MONO = `'JetBrains Mono', ui-monospace, monospace`;

// Typography scale — readable for 40-60+ audience
const TYPE = {
  display: { size: 32, weight: 700, height: 1.15, tracking: '-0.6px' },
  h1:      { size: 26, weight: 700, height: 1.2,  tracking: '-0.5px' },
  h2:      { size: 19, weight: 700, height: 1.3,  tracking: '-0.3px' },
  h3:      { size: 16, weight: 600, height: 1.4,  tracking: '-0.1px' },
  body:    { size: 15, weight: 500, height: 1.5,  tracking: '0' },
  bodySm:  { size: 14, weight: 500, height: 1.45, tracking: '0' },
  label:   { size: 13, weight: 600, height: 1.3,  tracking: '0.1px' },
  caption: { size: 12, weight: 500, height: 1.3,  tracking: '0.1px' },
  num:     { size: 22, weight: 700, height: 1.1,  tracking: '-0.5px' },
  numSm:   { size: 16, weight: 700, height: 1.1,  tracking: '-0.2px' },
};

function typo(t){
  const v=TYPE[t]||TYPE.body;
  return { fontSize:v.size, fontWeight:v.weight, lineHeight:v.height, letterSpacing:v.tracking };
}

// Touch targets
const TOUCH = { primary: 48, secondary: 44, icon: 40 };

const RADIUS = { sm:8, md:12, lg:16, xl:20, pill:999 };

// ── Currency ──────────────────────────────────────────────────────────────────

function fmt(n){
  const abs=Math.abs(n||0);
  if(abs>=10000000) return '₹'+(abs/10000000).toFixed(1)+' Cr';
  if(abs>=100000)   return '₹'+(abs/100000).toFixed(1)+' L';
  if(abs>=1000)     return '₹'+Math.round(abs/1000)+'K';
  return '₹'+abs;
}
function fmtFull(n){
  return new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(n||0);
}

// ── Hook: viewport ────────────────────────────────────────────────────────────

function useIsMobile(){
  const [m,setM]=React.useState(window.innerWidth<768);
  React.useEffect(()=>{
    const h=()=>setM(window.innerWidth<768);
    window.addEventListener('resize',h);
    return()=>window.removeEventListener('resize',h);
  },[]);
  return m;
}

// ── Theme context ─────────────────────────────────────────────────────────────

const ThemeContext = React.createContext({theme: LIGHT, toggleTheme: ()=>{}});
function useTheme(){ return React.useContext(ThemeContext); }

// ── Card ──────────────────────────────────────────────────────────────────────

function Card({children, style={}, onClick, hoverable=false, padding=20}){
  const {theme:T} = useTheme();
  const [h,setH]=React.useState(false);
  return(
    <div onClick={onClick}
      onMouseEnter={()=>hoverable&&setH(true)}
      onMouseLeave={()=>hoverable&&setH(false)}
      style={{
        background: T.surface,
        borderRadius: RADIUS.lg,
        border: `1px solid ${h?T.borderStrong:T.border}`,
        padding,
        transition: 'border-color 0.15s, transform 0.15s, box-shadow 0.15s',
        cursor: onClick?'pointer':'default',
        ...(h && hoverable ? {boxShadow: T.shadow} : {}),
        ...style
      }}>{children}</div>
  );
}

// ── Button ────────────────────────────────────────────────────────────────────

function Button({children, onClick, variant='primary', size='md', icon, fullWidth, disabled, type='button', style={}}){
  const {theme:T} = useTheme();
  const sizes = {
    sm: { h:36, px:14, fz:13 },
    md: { h:44, px:18, fz:14 },
    lg: { h:50, px:24, fz:15 },
  };
  const s = sizes[size];

  const variants = {
    primary: {
      bg: C.primary, color: '#fff', border: C.primary,
      hoverBg: '#1d4ed8',
    },
    secondary: {
      bg: T.surface, color: T.text, border: T.borderStrong,
      hoverBg: T.hover,
    },
    ghost: {
      bg: 'transparent', color: T.textMuted, border: 'transparent',
      hoverBg: T.hover,
    },
    danger: {
      bg: 'transparent', color: C.negative, border: C.negative+'40',
      hoverBg: C.negativeSoft,
    },
    success: {
      bg: C.positive, color: '#fff', border: C.positive,
      hoverBg: '#076b41',
    },
  };
  const v = variants[variant] || variants.primary;
  const [h,setH]=React.useState(false);

  return(
    <button type={type} onClick={onClick} disabled={disabled}
      onMouseEnter={()=>setH(true)} onMouseLeave={()=>setH(false)}
      style={{
        display:'inline-flex',alignItems:'center',justifyContent:'center',gap:7,
        height: s.h, padding: `0 ${s.px}px`,
        borderRadius: RADIUS.md, border: `1px solid ${v.border}`,
        background: h && !disabled ? v.hoverBg : v.bg,
        color: v.color, fontFamily: FONT, fontSize: s.fz, fontWeight: 600,
        cursor: disabled?'not-allowed':'pointer', opacity: disabled?0.5:1,
        width: fullWidth?'100%':'auto', whiteSpace:'nowrap',
        transition: 'background 0.15s, border-color 0.15s',
        ...style,
      }}>
      {icon}{children}
    </button>
  );
}

// ── IconButton ────────────────────────────────────────────────────────────────

function IconButton({children, onClick, label, size=40, variant='ghost', style={}}){
  const {theme:T} = useTheme();
  const [h,setH]=React.useState(false);
  const variants = {
    ghost: { bg: 'transparent', color: T.textMuted, border: 'transparent' },
    surface: { bg: T.surface, color: T.text, border: T.border },
    soft: { bg: T.surfaceAlt, color: T.text, border: 'transparent' },
  };
  const v = variants[variant];
  return(
    <button onClick={onClick} aria-label={label} title={label}
      onMouseEnter={()=>setH(true)} onMouseLeave={()=>setH(false)}
      style={{
        width:size,height:size,minWidth:size,
        display:'flex',alignItems:'center',justifyContent:'center',
        borderRadius: RADIUS.md,
        background: h ? T.hover : v.bg,
        color: v.color, border: `1px solid ${v.border}`,
        cursor:'pointer', transition:'background 0.15s',
        ...style,
      }}>
      {children}
    </button>
  );
}

// ── Input ─────────────────────────────────────────────────────────────────────

function Input({label, value, onChange, type='text', placeholder, hint, error, prefix, suffix, required, autoFocus, optional, style={}}){
  const {theme:T} = useTheme();
  const [f,setF]=React.useState(false);
  return(
    <div style={style}>
      {label && (
        <label style={{display:'flex',justifyContent:'space-between',alignItems:'center',width:'100%',marginBottom:6, ...typo('label'), color:T.text}}>
          <span style={{flex:1,minWidth:0}}>{label}{required && <span style={{color:C.primary,marginLeft:3}}>*</span>}</span>
          {optional && <span style={{...typo('caption'),color:T.textLight,fontWeight:500,flexShrink:0,marginLeft:8}}>Optional</span>}
        </label>
      )}
      <div style={{
        display:'flex',alignItems:'center',gap:8,
        padding: `0 ${prefix||suffix?12:14}px`,
        height: 48,
        borderRadius: RADIUS.md,
        background: T.surfaceAlt,
        border: `1.5px solid ${error?C.negative:f?C.primary:'transparent'}`,
        transition: 'border-color 0.15s, background 0.15s',
      }}>
        {prefix && <span style={{color:T.textLight,...typo('body')}}>{prefix}</span>}
        <input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}
          autoFocus={autoFocus} onFocus={()=>setF(true)} onBlur={()=>setF(false)}
          style={{
            flex:1, background:'transparent', border:'none', outline:'none',
            color: T.text, fontFamily: FONT, ...typo('body'),
            width: '100%', minWidth: 0,
          }}/>
        {suffix && <span style={{color:T.textLight,...typo('bodySm')}}>{suffix}</span>}
      </div>
      {error
        ? <p style={{marginTop:6,...typo('caption'),color:C.negative}}>{error}</p>
        : hint && <p style={{marginTop:6,...typo('caption'),color:T.textLight}}>{hint}</p>
      }
    </div>
  );
}

function Select({label, value, onChange, options, required, hint, style={}}){
  const {theme:T} = useTheme();
  return(
    <div style={style}>
      {label && (
        <label style={{display:'block',marginBottom:6, ...typo('label'), color:T.text}}>
          {label}{required && <span style={{color:C.primary,marginLeft:3}}>*</span>}
        </label>
      )}
      <div style={{position:'relative'}}>
        <select value={value} onChange={e=>onChange(e.target.value)} style={{
          width:'100%', height:48, padding:'0 36px 0 14px',
          borderRadius: RADIUS.md,
          background: T.surfaceAlt, border: '1.5px solid transparent',
          color: T.text, fontFamily: FONT, ...typo('body'),
          outline:'none', cursor:'pointer', appearance:'none',
        }}>
          {options.map(o=>(
            <option key={typeof o==='string'?o:o.value} value={typeof o==='string'?o:o.value}>
              {typeof o==='string'?o:o.label}
            </option>
          ))}
        </select>
        <svg style={{position:'absolute',right:14,top:'50%',transform:'translateY(-50%)',pointerEvents:'none',color:T.textMuted}} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="m6 9 6 6 6-6"/></svg>
      </div>
      {hint && <p style={{marginTop:6,...typo('caption'),color:T.textLight}}>{hint}</p>}
    </div>
  );
}

// ── Chip / Badge ──────────────────────────────────────────────────────────────

function Chip({children, tone='neutral', size='sm', icon}){
  const {theme:T} = useTheme();
  const tones = {
    neutral:  { bg: T.surfaceAlt, color: T.textMuted },
    primary:  { bg: C.primarySoft, color: C.primary },
    positive: { bg: C.positiveSoft, color: C.positive },
    negative: { bg: C.negativeSoft, color: C.negative },
    warning:  { bg: C.warningSoft, color: C.warning },
    info:     { bg: C.infoSoft, color: C.info },
  };
  const t = tones[tone] || tones.neutral;
  const sizes = { sm: { h:22, fz:11, px:8 }, md: { h:26, fz:12, px:10 } };
  const s = sizes[size];
  return(
    <span style={{
      display:'inline-flex',alignItems:'center',gap:4,
      height: s.h, padding: `0 ${s.px}px`,
      borderRadius: RADIUS.sm,
      background: t.bg, color: t.color,
      fontFamily: FONT, fontSize: s.fz, fontWeight: 600,
      letterSpacing: '0.1px',
    }}>
      {icon}{children}
    </span>
  );
}

function StatusChip({status}){
  const map = {
    FINAL:     {label:'Final',  tone:'positive'},
    DRAFT:     {label:'Draft',  tone:'warning'},
    CANCELLED: {label:'Cancel', tone:'negative'},
    EXPECTED:  {label:'Pending',tone:'warning'},
    COMPLETED: {label:'Done',   tone:'positive'},
  };
  const m = map[status] || {label:status, tone:'neutral'};
  return <Chip tone={m.tone}>{m.label}</Chip>;
}

// ── Avatar with initials ──────────────────────────────────────────────────────
// Decorative palette — deliberately separate from semantic positive/negative/warning
// so a party's avatar never accidentally reads as "money in" or "money out".
const AVATAR_PALETTE = [
  { fg: '#6366f1', bg: '#eef0fe' }, // indigo
  { fg: '#8b5cf6', bg: '#f3eefe' }, // violet
  { fg: '#ec4899', bg: '#fdeef6' }, // pink
  { fg: '#0891b2', bg: '#e8f4f7' }, // cyan
  { fg: '#7c5e3c', bg: '#f5eee2' }, // tan / khata
  { fg: '#475569', bg: '#eef1f5' }, // slate
  { fg: '#a16207', bg: '#fbf0d9' }, // amber-brown
  { fg: '#9333ea', bg: '#f4e8fc' }, // purple
];

function Avatar({name, size=40, tone}){
  const {theme:T} = useTheme();
  const init = name.split(' ').map(w=>w[0]).slice(0,2).join('').toUpperCase();
  const seed = name.split('').reduce((a,c)=>a+c.charCodeAt(0),0);
  const swatch = AVATAR_PALETTE[seed % AVATAR_PALETTE.length];
  return(
    <div style={{
      width:size, height:size, minWidth:size,
      borderRadius: size/3,
      background: T.id==='dark' ? swatch.fg+'25' : swatch.bg,
      color: T.id==='dark' ? swatch.fg : swatch.fg,
      display:'flex',alignItems:'center',justifyContent:'center',
      fontFamily: FONT, fontWeight: 700, fontSize: size*0.36,
    }}>
      {init}
    </div>
  );
}

// ── Sheet — consistent modal pattern (bottom on mobile, right on desktop) ───

function Sheet({open, onClose, title, subtitle, children, width=520, isMobile, footer, headerAction}){
  const {theme:T} = useTheme();

  React.useEffect(()=>{
    if(open){
      document.body.style.overflow='hidden';
      const onKey = (e) => { if(e.key==='Escape') onClose(); };
      window.addEventListener('keydown', onKey);
      return ()=>{
        document.body.style.overflow='';
        window.removeEventListener('keydown', onKey);
      };
    }
  },[open, onClose]);

  if(!open) return null;

  const panelStyle = isMobile ? {
    position:'fixed', left:0, right:0, bottom:0, zIndex:1001,
    background: T.surface, color: T.text,
    borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl,
    maxHeight:'92vh', display:'flex', flexDirection:'column',
    fontFamily: FONT,
    animation: 'sheetUp 0.3s ease-out',
    boxShadow: T.shadowLg,
  } : {
    position:'fixed', top:0, right:0, bottom:0, width, zIndex:1001,
    background: T.surface, color: T.text,
    borderLeft: `1px solid ${T.border}`,
    display:'flex', flexDirection:'column',
    fontFamily: FONT,
    animation: 'sheetRight 0.3s ease-out',
    boxShadow: T.shadowLg,
  };

  return ReactDOM.createPortal(
    <React.Fragment>
      <div onClick={onClose} style={{
        position:'fixed',inset:0,zIndex:1000,background:T.overlay,
        animation:'fade 0.2s ease-out',backdropFilter:'blur(2px)',WebkitBackdropFilter:'blur(2px)',
      }}/>
      <div style={panelStyle}>
        {isMobile && <div style={{margin:'10px auto 4px',width:40,height:4,borderRadius:2,background:T.borderStrong}}/>}
        {(title||subtitle) && (
          <div style={{padding:'14px 20px 16px',borderBottom:`1px solid ${T.divider}`,display:'flex',alignItems:'center',gap:12,flexShrink:0}}>
            <div style={{flex:1,minWidth:0}}>
              {title && <h2 style={{...typo('h2'),color:T.text,margin:0}}>{title}</h2>}
              {subtitle && <p style={{...typo('caption'),color:T.textMuted,margin:'2px 0 0'}}>{subtitle}</p>}
            </div>
            {headerAction}
            <IconButton onClick={onClose} label="Close" size={36}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </IconButton>
          </div>
        )}
        <div style={{flex:1,overflowY:'auto',padding:'18px 20px 20px'}}>{children}</div>
        {footer && (
          <div style={{padding:'14px 20px 16px',borderTop:`1px solid ${T.divider}`,display:'flex',gap:10,flexShrink:0,background:T.surface}}>
            {footer}
          </div>
        )}
      </div>
    </React.Fragment>,
    document.body
  );
}

// ── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({icon, title, body, action}){
  const {theme:T} = useTheme();
  return(
    <div style={{padding:'48px 24px',textAlign:'center'}}>
      {icon && (
        <div style={{width:56,height:56,borderRadius:RADIUS.lg,background:T.surfaceAlt,display:'inline-flex',alignItems:'center',justifyContent:'center',marginBottom:14,color:T.textMuted}}>
          {icon}
        </div>
      )}
      <h3 style={{...typo('h3'),color:T.text,marginBottom:6}}>{title}</h3>
      {body && <p style={{...typo('bodySm'),color:T.textMuted,marginBottom: action?16:0,maxWidth:320,margin:'0 auto'}}>{body}</p>}
      {action && <div style={{marginTop:18}}>{action}</div>}
    </div>
  );
}

// ── Skeleton — shimmer placeholder ───────────────────────────────────────────

function Skeleton({width='100%', height=16, radius=8, style={}}){
  const {theme:T} = useTheme();
  return(
    <div style={{
      width, height, borderRadius:radius,
      background: T.id==='dark'
        ? 'linear-gradient(90deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.09) 50%, rgba(255,255,255,0.04) 100%)'
        : 'linear-gradient(90deg, rgba(15,15,25,0.04) 0%, rgba(15,15,25,0.09) 50%, rgba(15,15,25,0.04) 100%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.4s linear infinite',
      ...style,
    }}/>
  );
}

// ── Error State — for network / server failures ──────────────────────────────

function ErrorState({title='Kuch gadbad ho gayi', body='Network problem ya server down. Ek baar try karo.', onRetry}){
  const {theme:T} = useTheme();
  return(
    <div style={{padding:'48px 24px',textAlign:'center'}}>
      <div style={{
        width:64,height:64,borderRadius:RADIUS.lg,background:C.negativeSoft,
        display:'inline-flex',alignItems:'center',justifyContent:'center',marginBottom:14,color:C.negative,
      }}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
      </div>
      <h3 style={{...typo('h2'),color:T.text,marginBottom:6}}>{title}</h3>
      <p style={{...typo('body'),color:T.textMuted,marginBottom:18,maxWidth:380,margin:'0 auto 18px'}}>{body}</p>
      {onRetry && <Button onClick={onRetry} variant="secondary">Phir Try Karo</Button>}
    </div>
  );
}

// ── Toast — floating brief feedback ──────────────────────────────────────────

function Toast({message, tone='positive', onDismiss}){
  React.useEffect(()=>{
    if(!onDismiss) return;
    const t = setTimeout(onDismiss, 3500);
    return ()=>clearTimeout(t);
  },[onDismiss]);
  const colors = {
    positive: {bg:C.positive, fg:'#fff'},
    negative: {bg:C.negative, fg:'#fff'},
    info:     {bg:'#0d0d1b', fg:'#fff'},
  };
  const c = colors[tone] || colors.info;
  return ReactDOM.createPortal(
    <div style={{
      position:'fixed', bottom:isMobileViewport()?90:24, left:'50%',
      transform:'translateX(-50%)', zIndex:2000,
      padding:'12px 18px', borderRadius:14,
      background: c.bg, color: c.fg,
      boxShadow: '0 14px 40px rgba(0,0,0,0.25)',
      ...typo('bodySm'), fontWeight:600,
      display:'flex',alignItems:'center',gap:10,
      animation: 'sheetUp 0.25s ease-out',
      maxWidth: 'calc(100vw - 32px)',
    }}>
      <span>{tone==='positive'?'✓':tone==='negative'?'⚠':'ℹ'}</span>
      <span>{message}</span>
    </div>,
    document.body
  );
}

function isMobileViewport(){
  return typeof window!=='undefined' && window.innerWidth<768;
}

// ── Section heading ──────────────────────────────────────────────────────────

function Section({title, action, subtitle, children, style={}}){
  const {theme:T} = useTheme();
  return(
    <section style={{marginBottom:20,...style}}>
      {(title||action) && (
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-end',marginBottom:12,gap:8}}>
          <div>
            {title && <h2 style={{...typo('h3'),color:T.text,margin:0}}>{title}</h2>}
            {subtitle && <p style={{...typo('caption'),color:T.textMuted,margin:'2px 0 0'}}>{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

// ── Money display — strong typographic treatment ─────────────────────────────

function Money({value, size='md', sign=false, color}){
  const {theme:T} = useTheme();
  const sizes={ sm:14, md:17, lg:22, xl:32 };
  const auto = value > 0 ? C.positive : value < 0 ? C.negative : T.text;
  const c = color || (sign ? auto : T.text);
  return(
    <span style={{
      fontFamily: FONT, fontWeight:700,
      fontSize: sizes[size], letterSpacing:'-0.3px',
      color: c, fontVariantNumeric: 'tabular-nums',
    }}>
      {sign && value > 0 ? '+' : ''}
      {fmtFull(value)}
    </span>
  );
}

// Export to window
Object.assign(window, {
  C, LIGHT, DARK, FONT, BRAND, DISPLAY, MONO, TYPE, typo, TOUCH, RADIUS,
  fmt, fmtFull, useIsMobile, ThemeContext, useTheme,
  Card, Button, IconButton, Input, Select, Chip, StatusChip, Avatar,
  Sheet, EmptyState, Section, Money, Skeleton, ErrorState, Toast,
});
