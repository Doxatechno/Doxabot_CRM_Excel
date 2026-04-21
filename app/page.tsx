'use client'
import { useEffect, useState, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

async function checkAuth() {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) window.location.href = '/login'
}

type Lead = {
  id: string; phone: string; name: string; category: string; lead_cat: string
  status: string; usage_type: string; product_name: string; product_variant: string
  customer_city: string; budget_range: string; units: string; bot_step: number
  language: string; converted: boolean; order_value: number; lost_reason: string
  notes: string; converted_at: string; created_at: string; updated_at: string
}
type Message = { id: string; lead_phone: string; direction: string; body: string; created_at: string }
type Call = { id: string; lead_phone: string; status: string; duration: number; recording_url: string | null; transcript: string | null; created_at: string }
type FollowUp = { id: string; lead_phone: string; category: string; day_number: number; status: string; scheduled_at: string; sent_at: string | null; created_at: string }

const CAT_CONFIG: any = {
  hot:  { grad:'linear-gradient(135deg,#FF416C,#FF4B2B)', glow:'rgba(255,65,108,0.4)', pulse:'#FF416C', light:'rgba(255,65,108,0.1)', border:'rgba(255,65,108,0.3)' },
  warm: { grad:'linear-gradient(135deg,#F7971E,#FFD200)', glow:'rgba(247,151,30,0.4)', pulse:'#F7971E', light:'rgba(247,151,30,0.1)', border:'rgba(247,151,30,0.3)' },
  cold: { grad:'linear-gradient(135deg,#4facfe,#00f2fe)', glow:'rgba(79,172,254,0.4)', pulse:'#4facfe', light:'rgba(79,172,254,0.1)', border:'rgba(79,172,254,0.3)' },
}

function timeAgo(ts: string) {
  const diff = Date.now() - new Date(ts).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function Avatar({ name, size = 40, cat }: { name: string; size?: number; cat: string }) {
  const cc = CAT_CONFIG[cat] || CAT_CONFIG.cold
  const initials = (name || 'U').split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()
  return (
    <div style={{ width: size, height: size, borderRadius: size * 0.28, background: cc.grad, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: size * 0.35, color: '#fff', flexShrink: 0, boxShadow: `0 4px 14px ${cc.glow}` }}>
      {initials}
    </div>
  )
}

function RadialGauge({ value, max, color, size = 80, label }: any) {
  const pct = Math.min(value / max, 1)
  const r = (size / 2) - 8
  const circ = 2 * Math.PI * r
  const dash = pct * circ
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#EAE6FF" strokeWidth="7" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="7"
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" />
        <text x={size / 2} y={size / 2} textAnchor="middle" dominantBaseline="middle"
          style={{ fontSize: size * 0.22, fontWeight: 800, fill: '#160D35', fontFamily: 'Space Grotesk', transform: 'rotate(90deg)', transformOrigin: `${size / 2}px ${size / 2}px` }}>
          {Math.round(pct * 100)}%
        </text>
      </svg>
      {label && <div style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>}
    </div>
  )
}

export default function CRMDashboard() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [calls, setCalls] = useState<Call[]>([])
  const [followUps, setFollowUps] = useState<FollowUp[]>([])
  const [allFollowUps, setAllFollowUps] = useState<FollowUp[]>([])
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [activeTab, setActiveTab] = useState<'chat' | 'insights' | 'timeline' | 'convert'>('chat')
  const [activeNav, setActiveNav] = useState('leads')
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [mounted, setMounted] = useState(false)
  const [newLeadPing, setNewLeadPing] = useState(false)
  const [showExport, setShowExport] = useState(false)
  const [exportFrom, setExportFrom] = useState('')
  const [exportTo, setExportTo] = useState('')
  const [notes, setNotes] = useState('')
  const [orderVal, setOrderVal] = useState('')
  const [lostReason, setLostReason] = useState('')
  const [savingNotes, setSavingNotes] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    checkAuth()
    setMounted(true)
    fetchAll()
    fetchAllFollowUps()
    const ch = supabase.channel('crm')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => { fetchAll(); setNewLeadPing(true); setTimeout(() => setNewLeadPing(false), 3000) })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'follow_ups' }, fetchAllFollowUps)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [])

  useEffect(() => {
    const h = (e: MouseEvent) => { if (!(e.target as HTMLElement).closest('.exp-wrap')) setShowExport(false) }
    document.addEventListener('click', h)
    return () => document.removeEventListener('click', h)
  }, [])

  useEffect(() => {
    if (selectedLead) {
      fetchMessages(selectedLead.phone)
      fetchCalls(selectedLead.phone)
      fetchFollowUps(selectedLead.phone)
      setNotes(selectedLead.notes || '')
      setOrderVal(selectedLead.order_value?.toString() || '')
      setLostReason(selectedLead.lost_reason || '')
    }
  }, [selectedLead])

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  async function fetchAll() {
    setLoading(true)
    const { data } = await supabase.from('leads').select('*').order('updated_at', { ascending: false })
    if (data) setLeads(data)
    setLoading(false)
  }
  async function fetchAllFollowUps() {
    const { data } = await supabase.from('follow_ups').select('*').order('scheduled_at', { ascending: true })
    if (data) setAllFollowUps(data)
  }
  async function fetchMessages(phone: string) {
    const { data } = await supabase.from('messages').select('*').eq('lead_phone', phone).order('created_at', { ascending: true })
    if (data) setMessages(data)
  }
  async function fetchCalls(phone: string) {
    const { data } = await supabase.from('calls').select('*').eq('lead_phone', phone).order('created_at', { ascending: false })
    if (data) setCalls(data)
  }
  async function fetchFollowUps(phone: string) {
    const { data } = await supabase.from('follow_ups').select('*').eq('lead_phone', phone).order('scheduled_at', { ascending: true })
    if (data) setFollowUps(data)
  }
  async function saveNotes() {
    if (!selectedLead) return
    setSavingNotes(true)
    await supabase.from('leads').update({ notes }).eq('phone', selectedLead.phone)
    setSavingNotes(false)
    fetchAll()
  }
  async function markWon() {
    if (!selectedLead) return
    await supabase.from('leads').update({ converted: true, order_value: parseInt(orderVal) || 0, status: 'converted', converted_at: new Date().toISOString() }).eq('phone', selectedLead.phone)
    fetchAll()
  }
  async function markLost() {
    if (!selectedLead) return
    await supabase.from('leads').update({ converted: false, lost_reason: lostReason, status: 'lost' }).eq('phone', selectedLead.phone)
    fetchAll()
  }

  function exportLeads(data: Lead[], filename: string) {
    let d = data
    if (exportFrom) d = d.filter(l => new Date(l.created_at) >= new Date(exportFrom))
    if (exportTo) d = d.filter(l => new Date(l.created_at) <= new Date(exportTo + 'T23:59:59'))
    const h = ['Name','Phone','Category','CAT','Product','City','Budget','Units','Language','Status','Converted','Order Value','Notes','Created']
    const rows = d.map(l => [l.name??'',l.phone??'',l.category??'',l.lead_cat??'',l.product_name??'',l.customer_city??'',l.budget_range?.replace('budget_','')??'',l.units??'',l.language??'',l.status??'',l.converted?'Yes':'No',l.order_value?`₹${l.order_value}`:'',l.notes??'',new Date(l.created_at).toLocaleDateString('en-IN')])
    const csv = [h,...rows].map(r=>r.map(v=>`"${v}"`).join(',')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv],{type:'text/csv'}))
    a.download = filename; a.click()
  }

  const filtered = leads.filter(l => {
    const mf = filter==='all'||l.category===filter||(filter==='converted'&&l.converted)||(filter==='lost'&&l.status==='lost')
    const ms = !search||l.name?.toLowerCase().includes(search.toLowerCase())||l.phone?.includes(search)||l.customer_city?.toLowerCase().includes(search.toLowerCase())||l.product_name?.toLowerCase().includes(search.toLowerCase())
    return mf && ms
  })

  const stats = {
    total: leads.length,
    hot: leads.filter(l=>l.category==='hot').length,
    warm: leads.filter(l=>l.category==='warm').length,
    cold: leads.filter(l=>l.category==='cold').length,
    qualified: leads.filter(l=>l.status==='qualified').length,
    converted: leads.filter(l=>l.converted).length,
    lost: leads.filter(l=>l.status==='lost').length,
    revenue: leads.filter(l=>l.converted).reduce((s,l)=>s+(l.order_value||0),0),
  }
  const convRate = stats.qualified > 0 ? Math.round((stats.converted/stats.qualified)*100) : 0
  const pendingFU = allFollowUps.filter(f=>f.status==='pending').length
  const whatsappMsgs = messages.filter(m=>!m.body?.startsWith('[Kate Call')&&!m.body?.startsWith('[Follow-up'))

  const botSteps = ['New','Q1','Q2','Q3','Q4','Name','City','Budget','Units','✅ Done']

  // Analytics breakdowns
  const products = Object.entries(leads.reduce((a,l)=>{if(l.product_name)a[l.product_name]=(a[l.product_name]||0)+1;return a},{} as Record<string,number>)).sort((a,b)=>b[1]-a[1]).slice(0,6)
  const cities = Object.entries(leads.reduce((a,l)=>{if(l.customer_city)a[l.customer_city]=(a[l.customer_city]||0)+1;return a},{} as Record<string,number>)).sort((a,b)=>b[1]-a[1]).slice(0,6)
  const langs = Object.entries(leads.reduce((a,l)=>{if(l.language)a[l.language]=(a[l.language]||0)+1;return a},{} as Record<string,number>)).sort((a,b)=>b[1]-a[1])
  const maxP = products[0]?.[1]||1, maxC = cities[0]?.[1]||1

  const navItems = [
    { id:'leads', icon:'👥', label:'Leads' },
    { id:'analytics', icon:'📊', label:'Analytics' },
    { id:'calls', icon:'📞', label:'Calls' },
    { id:'followups', icon:'📅', label:'Follow-ups' },
    { id:'settings', icon:'⚙️', label:'Settings' },
  ]

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700;800&family=DM+Sans:wght@300;400;500;600;700&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #F4F1FF; color: #160D35; font-family: 'DM Sans', sans-serif; overflow: hidden; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-thumb { background: #D4CCFF; border-radius: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        .app { display: flex; height: 100vh; }

        /* Sidebar */
        .sidebar { width: 76px; background: linear-gradient(180deg,#1C0B4E 0%,#160D35 100%); display: flex; flex-direction: column; align-items: center; padding: 18px 0; gap: 4px; z-index: 10; flex-shrink: 0; }
        .sidebar-logo { width: 44px; height: 44px; border-radius: 13px; overflow: hidden; margin-bottom: 20px; box-shadow: 0 4px 16px rgba(124,58,237,0.4); }
        .sidebar-logo img { width: 100%; height: 100%; object-fit: cover; }
        .nav-item { width: 56px; border-radius: 14px; padding: 9px 0; display: flex; flex-direction: column; align-items: center; gap: 3px; cursor: pointer; transition: all 0.2s; border: none; background: transparent; font-family: 'DM Sans'; position: relative; }
        .nav-item:hover { background: rgba(167,139,250,0.12); }
        .nav-item.active { background: rgba(167,139,250,0.18); box-shadow: 0 0 0 1px rgba(167,139,250,0.3); }
        .nav-icon { font-size: 18px; line-height: 1; }
        .nav-label { font-size: 9px; font-weight: 600; color: rgba(255,255,255,0.4); text-transform: uppercase; letter-spacing: 0.04em; }
        .nav-item.active .nav-label { color: #A78BFA; }
        .nav-badge { position: absolute; top: 5px; right: 5px; width: 15px; height: 15px; border-radius: 8px; background: #FF416C; color: #fff; font-size: 8px; font-weight: 800; display: flex; align-items: center; justify-content: center; border: 2px solid #160D35; }

        /* Main */
        .main { flex: 1; display: flex; flex-direction: column; overflow: hidden; min-width: 0; }

        /* Topbar */
        .topbar { height: 62px; background: #fff; border-bottom: 1px solid #EAE6FF; display: flex; align-items: center; padding: 0 22px; gap: 14px; flex-shrink: 0; box-shadow: 0 2px 8px rgba(22,13,53,0.05); }
        .brand-logo { height: 34px; object-fit: contain; }
        .brand-name { font-family: 'Space Grotesk'; font-size: 16px; font-weight: 800; color: #160D35; }
        .brand-sub { font-size: 10px; color: #9CA3AF; font-weight: 500; }
        .topbar-right { margin-left: auto; display: flex; align-items: center; gap: 10px; }
        .pill { display: flex; align-items: center; gap: 5px; padding: 5px 12px; border-radius: 30px; font-size: 11px; font-weight: 700; font-family: 'DM Sans'; }
        .pill-hot { background: rgba(255,65,108,0.08); color: #FF416C; border: 1px solid rgba(255,65,108,0.2); }
        .pill-warm { background: rgba(247,151,30,0.08); color: #F7971E; border: 1px solid rgba(247,151,30,0.2); }
        .pill-live { background: rgba(16,185,129,0.08); color: #10B981; border: 1px solid rgba(16,185,129,0.2); }
        .live-dot { width: 6px; height: 6px; border-radius: 3px; background: #10B981; animation: livePulse 1.5s infinite; }
        @keyframes livePulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        .btn { padding: 7px 16px; border-radius: 10px; border: none; cursor: pointer; font-family: 'DM Sans'; font-size: 12px; font-weight: 600; transition: all 0.15s; display: flex; align-items: center; gap: 6px; }
        .btn-ghost { background: #F4F1FF; color: #7C3AED; border: 1px solid #EAE6FF; }
        .btn-ghost:hover { background: #EAE6FF; }
        .btn-primary { background: linear-gradient(135deg,#7C3AED,#4F46E5); color: #fff; box-shadow: 0 4px 12px rgba(124,58,237,0.3); }
        .btn-green { background: linear-gradient(135deg,#10B981,#059669); color: #fff; box-shadow: 0 4px 12px rgba(16,185,129,0.3); }
        .btn-red { background: linear-gradient(135deg,#EF4444,#DC2626); color: #fff; box-shadow: 0 4px 12px rgba(239,68,68,0.3); }

        /* Content */
        .content { flex: 1; display: flex; overflow: hidden; }

        /* Left panel */
        .left-panel { width: 340px; display: flex; flex-direction: column; background: #fff; border-right: 1px solid #EAE6FF; overflow: hidden; flex-shrink: 0; }

        /* Stats */
        .stats-bar { display: grid; grid-template-columns: repeat(4,1fr); border-bottom: 1px solid #EAE6FF; }
        .stat-cell { padding: 12px 10px; cursor: pointer; transition: background 0.15s; border-right: 1px solid #EAE6FF; text-align: center; }
        .stat-cell:last-child { border-right: none; }
        .stat-cell:hover, .stat-cell.act { background: #F4F1FF; }
        .stat-num { font-family: 'Space Grotesk'; font-size: 20px; font-weight: 800; }
        .stat-lbl { font-size: 9px; font-weight: 700; color: #9CA3AF; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 2px; }

        /* Search */
        .search-wrap { padding: 10px 12px; border-bottom: 1px solid #EAE6FF; }
        .search-box { position: relative; margin-bottom: 8px; }
        .search-box input { width: 100%; padding: 9px 12px 9px 34px; border: 1.5px solid #EAE6FF; border-radius: 11px; font-size: 13px; font-family: 'DM Sans'; color: #160D35; background: #F4F1FF; outline: none; transition: border 0.15s; }
        .search-box input:focus { border-color: #7C3AED; background: #fff; }
        .search-icon { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: #9CA3AF; }
        .filters { display: flex; gap: 5px; flex-wrap: wrap; }
        .fchip { padding: 3px 10px; border-radius: 20px; border: 1.5px solid #EAE6FF; background: transparent; color: #9CA3AF; font-size: 10px; font-weight: 600; cursor: pointer; transition: all 0.15s; font-family: 'DM Sans'; }
        .fchip:hover { border-color: #7C3AED; color: #7C3AED; }
        .f-all { border-color: #7C3AED; background: #F4F1FF; color: #7C3AED; }
        .f-hot { border-color: #FF416C; background: rgba(255,65,108,0.06); color: #FF416C; }
        .f-warm { border-color: #F7971E; background: rgba(247,151,30,0.06); color: #F7971E; }
        .f-cold { border-color: #4facfe; background: rgba(79,172,254,0.06); color: #4facfe; }
        .f-converted { border-color: #10B981; background: rgba(16,185,129,0.06); color: #10B981; }
        .f-lost { border-color: #9CA3AF; background: #F9FAFB; color: #6B7280; }

        /* Lead list */
        .lead-list { flex: 1; overflow-y: auto; }
        .lead-row { padding: 12px 14px; border-bottom: 1px solid #EAE6FF; cursor: pointer; transition: background 0.12s; display: flex; align-items: center; gap: 10px; }
        .lead-row:hover { background: #F4F1FF; }
        .lead-row.sel { background: linear-gradient(135deg,rgba(124,58,237,0.06),rgba(79,70,229,0.04)); border-left: 3px solid #7C3AED; }
        .lead-row.won { border-left: 3px solid #10B981; }
        .lead-row.lost { opacity: 0.6; }
        .lead-name { font-weight: 700; font-size: 13px; color: #160D35; }
        .lead-meta { font-size: 11px; color: #9CA3AF; margin-top: 1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .step-bar { height: 2px; background: #EAE6FF; border-radius: 2px; margin-top: 5px; overflow: hidden; }
        .step-fill { height: 100%; background: linear-gradient(90deg,#7C3AED,#EC4899); border-radius: 2px; }
        .shimmer { background: linear-gradient(90deg,#F4F1FF 25%,#EAE6FF 50%,#F4F1FF 75%); background-size: 200% 100%; animation: shimmer 1.5s infinite; border-radius: 11px; height: 54px; margin: 6px 12px; }
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }

        /* Right panel */
        .right-panel { flex: 1; display: flex; flex-direction: column; overflow: hidden; min-width: 0; background: #F4F1FF; }

        /* Empty state */
        .empty { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; color: #9CA3AF; }
        .empty-icon { width: 80px; height: 80px; border-radius: 22px; background: linear-gradient(135deg,#7C3AED,#4F46E5); display: flex; align-items: center; justify-content: center; font-size: 36px; box-shadow: 0 8px 28px rgba(124,58,237,0.35); animation: float 3s ease-in-out infinite; }
        @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }

        /* Lead hero */
        .lead-hero { flex-shrink: 0; padding: 20px 22px 0; position: relative; overflow: hidden; }
        .hero-strip { display: grid; grid-template-columns: repeat(4,1fr); gap: 1px; background: rgba(255,255,255,0.15); border-radius: 12px 12px 0 0; overflow: hidden; backdrop-filter: blur(8px); }
        .hero-cell { padding: 10px 0; text-align: center; border-right: 1px solid rgba(255,255,255,0.15); }
        .hero-cell:last-child { border-right: none; }

        /* Bot journey */
        .bot-strip { background: #fff; border-bottom: 1px solid #EAE6FF; padding: 12px 18px; flex-shrink: 0; }

        /* Tabs */
        .tabs { display: flex; background: #fff; border-bottom: 1px solid #EAE6FF; flex-shrink: 0; }
        .tab { padding: 12px 16px; font-size: 12px; font-weight: 600; color: #9CA3AF; border: none; background: transparent; cursor: pointer; font-family: 'DM Sans'; border-bottom: 2px solid transparent; transition: all 0.15s; white-space: nowrap; }
        .tab:hover { color: #160D35; }
        .tab.active { color: #7C3AED; border-bottom-color: #7C3AED; }

        /* Chat */
        .chat-body { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 8px; }
        .bubble-in { align-self: flex-start; max-width: 75%; }
        .bubble-out { align-self: flex-end; max-width: 75%; }
        .bubble { padding: 10px 14px; border-radius: 14px; font-size: 13px; line-height: 1.5; }
        .bubble-in .bubble { background: #fff; border: 1px solid #EAE6FF; color: #160D35; border-radius: 4px 14px 14px 14px; box-shadow: 0 2px 8px rgba(22,13,53,0.06); }
        .bubble-out .bubble { background: linear-gradient(135deg,#7C3AED,#4F46E5); color: #fff; border-radius: 14px 4px 14px 14px; box-shadow: 0 4px 14px rgba(124,58,237,0.3); }
        .btime { font-size: 10px; color: #9CA3AF; margin-top: 3px; padding: 0 4px; }

        /* Panel body */
        .panel-body { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 12px; }
        .card { background: #fff; border: 1px solid #EAE6FF; border-radius: 16px; padding: 16px; box-shadow: 0 2px 12px rgba(22,13,53,0.05); }

        /* Full views */
        .full-view { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
        .full-hdr { padding: 16px 24px; background: #fff; border-bottom: 1px solid #EAE6FF; display: flex; justify-content: space-between; align-items: center; flex-shrink: 0; }
        .full-hdr-title { font-family: 'Space Grotesk'; font-size: 17px; font-weight: 800; color: #160D35; }
        .full-body { flex: 1; overflow-y: auto; padding: 20px 24px; }

        /* Analytics */
        .kpi-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 14px; margin-bottom: 18px; }
        .kpi-card { border-radius: 16px; padding: 20px; color: #fff; box-shadow: 0 8px 24px rgba(0,0,0,0.12); }
        .chart-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 14px; margin-bottom: 14px; }
        .chart-card { background: #fff; border: 1px solid #EAE6FF; border-radius: 16px; padding: 18px; box-shadow: 0 2px 12px rgba(22,13,53,0.05); }
        .chart-title { font-family: 'Space Grotesk'; font-size: 13px; font-weight: 800; color: #160D35; margin-bottom: 14px; }
        .bar-row { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
        .bar-lbl { font-size: 11px; color: #6B7280; width: 85px; flex-shrink: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-transform: capitalize; }
        .bar-track { flex: 1; height: 8px; background: #EAE6FF; border-radius: 4px; overflow: hidden; }
        .bar-fill { height: 100%; border-radius: 4px; }
        .funnel-row { display: flex; justify-content: space-between; align-items: center; padding: 9px 0; border-bottom: 1px solid #F0EEFF; }
        .funnel-row:last-child { border-bottom: none; }

        /* Insights */
        .insights-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .insight-card { background: #fff; border: 1px solid #EAE6FF; border-radius: 14px; padding: 16px; }
        .insight-key { font-size: 10px; font-weight: 700; color: #9CA3AF; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px; }
        .insight-val { font-family: 'Space Grotesk'; font-size: 18px; font-weight: 800; color: #160D35; }

        @keyframes heroPing { 0%,100%{opacity:0.6;transform:scale(1)} 50%{opacity:0.2;transform:scale(1.08)} }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      <div className="app" style={{ opacity: mounted ? 1 : 0, transition: 'opacity 0.4s' }}>

        {/* Sidebar */}
        <aside className="sidebar">
          <div className="sidebar-logo">
            <img src="/favicon.png" alt="Excel" onError={e => (e.target as HTMLImageElement).style.display = 'none'} />
          </div>
          {navItems.map(item => (
            <button key={item.id} className={`nav-item ${activeNav === item.id ? 'active' : ''}`} onClick={() => setActiveNav(item.id)}>
              {item.id === 'followups' && pendingFU > 0 && <div className="nav-badge">{pendingFU > 9 ? '9+' : pendingFU}</div>}
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
            </button>
          ))}
        </aside>

        {/* Main */}
        <div className="main">

          {/* Topbar */}
          <div className="topbar">
            <img src="/logo.webp" className="brand-logo" alt="Excel Fit India" onError={e => (e.target as HTMLImageElement).style.display = 'none'} />
            <div>
              <div className="brand-name">Excel Sales CRM</div>
              <div className="brand-sub" style={{ color: '#A78BFA', fontWeight: 700 }}>Powered by Doxa Techno Solutions</div>
            </div>
            <div className="topbar-right">
              {newLeadPing && <div className="pill pill-hot">🔥 New Lead!</div>}
              {pendingFU > 0 && <div className="pill pill-warm">📅 {pendingFU} pending</div>}

              {/* Export */}
              <div style={{ position: 'relative' }} className="exp-wrap">
                <button className="btn btn-ghost" onClick={() => setShowExport(!showExport)}>⬇️ Export</button>
                {showExport && (
                  <div style={{ position: 'absolute', right: 0, top: 38, background: '#fff', border: '1px solid #EAE6FF', borderRadius: 16, padding: 12, zIndex: 100, minWidth: 240, boxShadow: '0 8px 32px rgba(22,13,53,0.15)' }}>
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', marginBottom: 6 }}>Date Range</div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <input type="date" value={exportFrom} onChange={e => setExportFrom(e.target.value)} style={{ flex: 1, padding: '5px 8px', border: '1px solid #EAE6FF', borderRadius: 8, fontSize: 11, fontFamily: 'DM Sans', outline: 'none' }} />
                        <input type="date" value={exportTo} onChange={e => setExportTo(e.target.value)} style={{ flex: 1, padding: '5px 8px', border: '1px solid #EAE6FF', borderRadius: 8, fontSize: 11, fontFamily: 'DM Sans', outline: 'none' }} />
                      </div>
                    </div>
                    <div style={{ height: 1, background: '#EAE6FF', margin: '8px 0' }} />
                    {[
                      { label: '🔥 Hot Leads', f: (l: Lead) => l.category === 'hot', file: 'hot-leads.csv' },
                      { label: '🌡️ Warm Leads', f: (l: Lead) => l.category === 'warm', file: 'warm-leads.csv' },
                      { label: '❄️ Cold Leads', f: (l: Lead) => l.category === 'cold', file: 'cold-leads.csv' },
                      { label: '✅ Converted', f: (l: Lead) => !!l.converted, file: 'converted.csv' },
                      { label: '❌ Lost', f: (l: Lead) => l.status === 'lost', file: 'lost.csv' },
                      { label: '🏠 CAT A', f: (l: Lead) => l.lead_cat === 'A', file: 'cat-a.csv' },
                      { label: '🏢 CAT B', f: (l: Lead) => l.lead_cat === 'B', file: 'cat-b.csv' },
                      { label: '📋 All Leads', f: (_: Lead) => true, file: 'all-leads.csv' },
                    ].map(opt => (
                      <button key={opt.file} onClick={() => { exportLeads(leads.filter(opt.f), opt.file); setShowExport(false) }}
                        style={{ width: '100%', padding: '7px 10px', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 12, color: '#160D35', textAlign: 'left', borderRadius: 8, fontFamily: 'DM Sans' }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#F4F1FF')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="pill pill-live"><div className="live-dot" /> Live</div>
              <button className="btn btn-ghost" style={{ fontSize: 11 }} onClick={async () => { await supabase.auth.signOut(); window.location.href = '/login' }}>🚪 Out</button>
            </div>
          </div>

          {/* Content */}
          <div className="content">

            {/* ── ANALYTICS ── */}
            {activeNav === 'analytics' && (
              <div className="full-view">
                <div className="full-hdr">
                  <div className="full-hdr-title">📊 Sales Analytics</div>
                  <div style={{ fontSize: 12, color: '#9CA3AF' }}>All-time performance</div>
                </div>
                <div className="full-body">
                  <div className="kpi-grid">
                    {[
                      { label: 'Total Leads', value: stats.total, sub: `${stats.qualified} qualified`, grad: 'linear-gradient(135deg,#7C3AED,#4F46E5)', icon: '👥' },
                      { label: 'Converted', value: stats.converted, sub: `${convRate}% conversion`, grad: 'linear-gradient(135deg,#10B981,#059669)', icon: '✅' },
                      { label: 'Revenue', value: `₹${(stats.revenue / 1000).toFixed(0)}K`, sub: `avg ₹${stats.converted > 0 ? Math.round(stats.revenue / stats.converted).toLocaleString() : 0}/deal`, grad: 'linear-gradient(135deg,#F59E0B,#D97706)', icon: '💰' },
                      { label: 'Lost Leads', value: stats.lost, sub: `${stats.qualified > 0 ? Math.round((stats.lost / stats.qualified) * 100) : 0}% loss rate`, grad: 'linear-gradient(135deg,#EF4444,#DC2626)', icon: '❌' },
                    ].map(k => (
                      <div key={k.label} className="kpi-card" style={{ background: k.grad }}>
                        <div style={{ fontSize: 24, marginBottom: 6 }}>{k.icon}</div>
                        <div style={{ fontFamily: 'Space Grotesk', fontSize: 28, fontWeight: 800, marginBottom: 2 }}>{k.value}</div>
                        <div style={{ fontSize: 10, fontWeight: 700, opacity: 0.8, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{k.label}</div>
                        <div style={{ fontSize: 12, opacity: 0.7 }}>{k.sub}</div>
                      </div>
                    ))}
                  </div>

                  <div className="chart-grid">
                    <div className="chart-card">
                      <div className="chart-title">🔽 Sales Funnel</div>
                      {[
                        { label: 'Total Leads', value: stats.total, color: '#7C3AED' },
                        { label: 'Qualified', value: stats.qualified, color: '#F59E0B' },
                        { label: 'Hot Leads', value: stats.hot, color: '#FF416C' },
                        { label: 'Converted', value: stats.converted, color: '#10B981' },
                        { label: 'Lost', value: stats.lost, color: '#9CA3AF' },
                      ].map((f, i) => (
                        <div key={f.label} className="funnel-row">
                          <span style={{ fontSize: 12, color: '#6B7280' }}>{f.label}</span>
                          <span style={{ fontFamily: 'Space Grotesk', fontSize: 16, fontWeight: 800, color: f.color }}>{f.value}</span>
                        </div>
                      ))}
                    </div>
                    <div className="chart-card">
                      <div className="chart-title">📦 Top Products</div>
                      {products.map(([name, count]) => (
                        <div key={name} className="bar-row">
                          <div className="bar-lbl">{name}</div>
                          <div className="bar-track"><div className="bar-fill" style={{ width: `${(count / maxP) * 100}%`, background: 'linear-gradient(90deg,#7C3AED,#4F46E5)' }} /></div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: '#7C3AED', width: 22, textAlign: 'right' }}>{count}</div>
                        </div>
                      ))}
                    </div>
                    <div className="chart-card">
                      <div className="chart-title">📍 Top Cities</div>
                      {cities.map(([city, count]) => (
                        <div key={city} className="bar-row">
                          <div className="bar-lbl">{city}</div>
                          <div className="bar-track"><div className="bar-fill" style={{ width: `${(count / maxC) * 100}%`, background: 'linear-gradient(90deg,#EC4899,#F43F5E)' }} /></div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: '#EC4899', width: 22, textAlign: 'right' }}>{count}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="chart-grid">
                    <div className="chart-card">
                      <div className="chart-title">🌐 Languages</div>
                      {langs.map(([lang, count]) => (
                        <div key={lang} className="bar-row">
                          <div className="bar-lbl">{lang}</div>
                          <div className="bar-track"><div className="bar-fill" style={{ width: `${(count / (stats.total || 1)) * 100}%`, background: 'linear-gradient(90deg,#4facfe,#00f2fe)' }} /></div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: '#4facfe', width: 22, textAlign: 'right' }}>{count}</div>
                        </div>
                      ))}
                    </div>
                    <div className="chart-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 28 }}>
                      <RadialGauge value={convRate} max={100} color="#10B981" size={90} label="Conv Rate" />
                      <RadialGauge value={stats.hot} max={stats.total || 1} color="#FF416C" size={90} label="Hot %" />
                      <RadialGauge value={stats.qualified} max={stats.total || 1} color="#7C3AED" size={90} label="Qualified" />
                    </div>
                    <div className="chart-card">
                      <div className="chart-title">✅ Win by Category</div>
                      {[
                        { label: '🔥 Hot → Won', total: stats.hot, won: leads.filter(l => l.category === 'hot' && l.converted).length },
                        { label: '🌡️ Warm → Won', total: stats.warm, won: leads.filter(l => l.category === 'warm' && l.converted).length },
                        { label: '❄️ Cold → Won', total: stats.cold, won: leads.filter(l => l.category === 'cold' && l.converted).length },
                      ].map(c => (
                        <div key={c.label} className="funnel-row">
                          <span style={{ fontSize: 12, color: '#6B7280' }}>{c.label}</span>
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <span style={{ fontSize: 12, fontWeight: 800, background: '#D1FAE5', color: '#065F46', padding: '2px 8px', borderRadius: 20 }}>{c.won}</span>
                            <span style={{ fontSize: 11, color: '#9CA3AF' }}>/ {c.total}</span>
                          </div>
                        </div>
                      ))}
                      <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid #EAE6FF' }}>
                        <div style={{ fontSize: 10, color: '#9CA3AF', textTransform: 'uppercase', fontWeight: 700, marginBottom: 4 }}>Total Revenue</div>
                        <div style={{ fontFamily: 'Space Grotesk', fontSize: 24, fontWeight: 800, color: '#10B981' }}>₹{stats.revenue.toLocaleString()}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── CALLS ── */}
            {activeNav === 'calls' && (
              <div className="full-view">
                <div className="full-hdr">
                  <div className="full-hdr-title">📞 All Calls</div>
                  <span style={{ fontSize: 12, color: '#9CA3AF' }}>{leads.filter(l => l.status === 'called' || l.category === 'hot').length} leads</span>
                </div>
                <div className="full-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {leads.filter(l => l.status === 'called' || l.category === 'hot').map(lead => (
                    <div key={lead.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                      onClick={() => { setSelectedLead(lead); setActiveNav('leads'); setActiveTab('chat') }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <Avatar name={lead.name} size={38} cat={lead.category} />
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 700, fontFamily: 'Space Grotesk' }}>{lead.name || 'Unknown'}</div>
                          <div style={{ fontSize: 12, color: '#9CA3AF' }}>📱 {lead.phone}{lead.customer_city ? ` · ${lead.customer_city}` : ''}</div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        {lead.converted && <span style={{ fontSize: 9, fontWeight: 800, background: '#D1FAE5', color: '#065F46', padding: '2px 8px', borderRadius: 20 }}>WON</span>}
                        <span style={{ fontSize: 9, fontWeight: 800, padding: '2px 8px', borderRadius: 20, background: CAT_CONFIG[lead.category]?.light || '#F4F1FF', color: CAT_CONFIG[lead.category]?.pulse || '#7C3AED' }}>{lead.category?.toUpperCase()}</span>
                        <span style={{ fontSize: 10, color: '#9CA3AF' }}>{timeAgo(lead.updated_at)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── FOLLOW-UPS ── */}
            {activeNav === 'followups' && (
              <div className="full-view">
                <div className="full-hdr">
                  <div className="full-hdr-title">📅 Follow-up Pipeline</div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <div className="pill pill-warm">{allFollowUps.filter(f => f.status === 'pending').length} pending</div>
                    <div className="pill" style={{ background: 'rgba(16,185,129,0.08)', color: '#10B981', border: '1px solid rgba(16,185,129,0.2)' }}>{allFollowUps.filter(f => f.status === 'sent').length} sent</div>
                  </div>
                </div>
                <div className="full-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {allFollowUps.map(fu => {
                    const lead = leads.find(l => l.phone === fu.lead_phone)
                    const isCall = fu.day_number === 7 && fu.category === 'warm'
                    const sc = fu.status === 'sent' ? { bg: '#D1FAE5', color: '#065F46' } : fu.status === 'pending' ? { bg: '#FEF3C7', color: '#92400E' } : { bg: '#FEE2E2', color: '#991B1B' }
                    return (
                      <div key={fu.id} className="card" style={{ cursor: 'pointer' }} onClick={() => { if (lead) { setSelectedLead(lead); setActiveNav('leads') } }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div style={{ display: 'flex', gap: 12 }}>
                            <div style={{ width: 38, height: 38, borderRadius: 11, background: isCall ? '#F4F1FF' : '#FDF4FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>{isCall ? '📞' : '💬'}</div>
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 700, fontFamily: 'Space Grotesk' }}>{lead?.name || fu.lead_phone} — Day {fu.day_number}</div>
                              <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>{isCall ? 'Kate AI Call' : 'WhatsApp'} · {new Date(fu.scheduled_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>
                            </div>
                          </div>
                          <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 10px', borderRadius: 20, background: sc.bg, color: sc.color }}>{fu.status.toUpperCase()}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* ── SETTINGS ── */}
            {activeNav === 'settings' && (
              <div className="full-view">
                <div className="full-hdr"><div className="full-hdr-title">⚙️ System Configuration</div></div>
                <div className="full-body">
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
                    {[
                      { icon: '📱', label: 'WhatsApp', value: '+91 87540 41170', color: '#10B981' },
                      { icon: '🏢', label: 'Business', value: 'Excel Fit India', color: '#7C3AED' },
                      { icon: '🤖', label: 'AI Agent', value: 'Kate — GPT-4o-mini', color: '#4F46E5' },
                      { icon: '🕐', label: 'Calling Hours', value: '8 AM – 9:30 PM IST', color: '#F7971E' },
                      { icon: '⏰', label: 'Follow-up Cron', value: 'Daily 9 AM IST', color: '#7C3AED' },
                      { icon: '🌐', label: 'Language AI', value: 'Auto — City Detection', color: '#10B981' },
                      { icon: '🔥', label: 'Hot Lead', value: 'Instant Kate Call', color: '#FF416C' },
                      { icon: '🌡️', label: 'Warm Lead', value: '5-touch + Day 7 Call', color: '#F7971E' },
                      { icon: '❄️', label: 'Cold Lead', value: '3-touch WhatsApp only', color: '#4facfe' },
                    ].map(s => (
                      <div key={s.label} className="card" style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                        <div style={{ width: 42, height: 42, borderRadius: 13, background: `${s.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>{s.icon}</div>
                        <div>
                          <div style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', marginBottom: 4 }}>{s.label}</div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: '#160D35', fontFamily: 'Space Grotesk' }}>{s.value}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── LEADS (main view) ── */}
            {activeNav === 'leads' && (
              <>
                {/* Left panel */}
                <div className="left-panel">
                  <div className="stats-bar">
                    {[
                      { lbl: 'Total', num: stats.total, color: '#7C3AED', f: 'all' },
                      { lbl: '🔥 Hot', num: stats.hot, color: '#FF416C', f: 'hot' },
                      { lbl: '🌡 Warm', num: stats.warm, color: '#F7971E', f: 'warm' },
                      { lbl: '✅ Won', num: stats.converted, color: '#10B981', f: 'converted' },
                    ].map(s => (
                      <div key={s.lbl} className={`stat-cell ${filter === s.f ? 'act' : ''}`} onClick={() => setFilter(s.f)}>
                        <div className="stat-lbl">{s.lbl}</div>
                        <div className="stat-num" style={{ color: s.color }}>{s.num}</div>
                      </div>
                    ))}
                  </div>

                  <div className="search-wrap">
                    <div className="search-box">
                      <span className="search-icon">🔍</span>
                      <input placeholder="Search leads..." value={search} onChange={e => setSearch(e.target.value)} />
                    </div>
                    <div className="filters">
                      {[
                        { f: 'all', label: `All (${stats.total})` },
                        { f: 'hot', label: '🔥 Hot' },
                        { f: 'warm', label: '🌡 Warm' },
                        { f: 'cold', label: '❄️ Cold' },
                        { f: 'converted', label: '✅ Won' },
                        { f: 'lost', label: '❌ Lost' },
                      ].map(item => (
                        <button key={item.f} className={`fchip ${filter === item.f ? `f-${item.f}` : ''}`} onClick={() => setFilter(item.f)}>{item.label}</button>
                      ))}
                    </div>
                  </div>

                  <div className="lead-list">
                    {loading ? Array(5).fill(0).map((_, i) => <div key={i} className="shimmer" style={{ animationDelay: `${i * 0.08}s` }} />) :
                      filtered.length === 0 ? <div style={{ padding: 40, textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>No leads found</div> :
                        filtered.map(lead => (
                          <div key={lead.id}
                            className={`lead-row ${selectedLead?.id === lead.id ? 'sel' : ''} ${lead.converted ? 'won' : ''} ${lead.status === 'lost' ? 'lost' : ''}`}
                            onClick={() => { setSelectedLead(lead); setActiveTab('chat') }}>
                            <Avatar name={lead.name} size={36} cat={lead.category} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div className="lead-name">{lead.name || 'Unknown'}</div>
                              <div className="lead-meta">📱 {lead.phone}{lead.customer_city ? ` · ${lead.customer_city}` : ''}</div>
                              {lead.product_name && <div className="lead-meta">📦 {lead.product_name}</div>}
                              <div className="step-bar"><div className="step-fill" style={{ width: `${(lead.bot_step / 9) * 100}%` }} /></div>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3, flexShrink: 0 }}>
                              {lead.converted ? <span style={{ fontSize: 9, fontWeight: 800, background: '#D1FAE5', color: '#065F46', padding: '2px 7px', borderRadius: 20 }}>WON</span>
                                : lead.status === 'lost' ? <span style={{ fontSize: 9, fontWeight: 800, background: '#FEE2E2', color: '#991B1B', padding: '2px 7px', borderRadius: 20 }}>LOST</span>
                                  : <>
                                    {lead.lead_cat && <span style={{ fontSize: 9, fontWeight: 800, background: '#F4F1FF', color: '#7C3AED', padding: '2px 7px', borderRadius: 20 }}>CAT {lead.lead_cat}</span>}
                                    <span style={{ fontSize: 9, fontWeight: 800, padding: '2px 7px', borderRadius: 20, background: CAT_CONFIG[lead.category]?.light || '#F4F1FF', color: CAT_CONFIG[lead.category]?.pulse || '#7C3AED' }}>{lead.category?.toUpperCase() || 'NEW'}</span>
                                  </>}
                              <span style={{ fontSize: 10, color: '#9CA3AF' }}>{timeAgo(lead.updated_at)}</span>
                            </div>
                          </div>
                        ))}
                  </div>
                </div>

                {/* Right panel */}
                <div className="right-panel">
                  {!selectedLead ? (
                    <div className="empty">
                      <div className="empty-icon">💬</div>
                      <div style={{ fontFamily: 'Space Grotesk', fontSize: 16, fontWeight: 800, color: '#6B7280' }}>Select a lead</div>
                      <div style={{ fontSize: 13, color: '#9CA3AF' }}>Click any lead to view details</div>
                    </div>
                  ) : (() => {
                    const cc = CAT_CONFIG[selectedLead.category] || CAT_CONFIG.cold
                    const msgCount = whatsappMsgs.length
                    const callCount = calls.length
                    const fuCount = followUps.length
                    const daysActive = Math.max(1, Math.ceil((Date.now() - new Date(selectedLead.created_at).getTime()) / 86400000))
                    const engScore = Math.min(100, Math.round(msgCount * 8 + callCount * 20 + fuCount * 5 + selectedLead.bot_step * 7))
                    const botPct = Math.round((selectedLead.bot_step / 9) * 100)

                    return (
                      <>
                        {/* Hero banner */}
                        <div className="lead-hero" style={{ background: cc.grad }}>
                          <div style={{ position: 'absolute', top: -40, right: -40, width: 180, height: 180, borderRadius: '50%', background: 'rgba(255,255,255,0.08)', pointerEvents: 'none' }} />
                          <div style={{ position: 'absolute', bottom: -60, left: 60, width: 140, height: 140, borderRadius: '50%', background: 'rgba(255,255,255,0.05)', pointerEvents: 'none' }} />

                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, position: 'relative' }}>
                            <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                              <div style={{ position: 'relative' }}>
                                <div style={{ position: 'absolute', inset: -4, borderRadius: 20, border: '2px solid rgba(255,255,255,0.5)', animation: 'heroPing 2s ease-in-out infinite' }} />
                                <Avatar name={selectedLead.name} size={52} cat={selectedLead.category} />
                                {selectedLead.converted && <div style={{ position: 'absolute', bottom: -4, right: -4, width: 20, height: 20, borderRadius: 10, background: '#10B981', border: '2px solid #fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10 }}>✓</div>}
                                {selectedLead.status === 'lost' && <div style={{ position: 'absolute', bottom: -4, right: -4, width: 20, height: 20, borderRadius: 10, background: '#EF4444', border: '2px solid #fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10 }}>✗</div>}
                              </div>
                              <div>
                                <div style={{ fontFamily: 'Space Grotesk', fontSize: 20, fontWeight: 800, color: '#fff', letterSpacing: '-0.02em', textShadow: '0 2px 8px rgba(0,0,0,0.2)' }}>{selectedLead.name || 'Unknown'}</div>
                                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 3, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                  <span>📱 {selectedLead.phone}</span>
                                  {selectedLead.customer_city && <><span style={{ opacity: 0.5 }}>·</span><span>📍 {selectedLead.customer_city}</span></>}
                                  {selectedLead.language && <><span style={{ opacity: 0.5 }}>·</span><span>🌐 {selectedLead.language}</span></>}
                                </div>
                                <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                                  {selectedLead.lead_cat && <span style={{ background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(8px)', color: '#fff', padding: '3px 10px', borderRadius: 20, fontSize: 10, fontWeight: 700, border: '1px solid rgba(255,255,255,0.3)' }}>CAT {selectedLead.lead_cat}</span>}
                                  {selectedLead.product_name && <span style={{ background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(8px)', color: '#fff', padding: '3px 10px', borderRadius: 20, fontSize: 10, fontWeight: 700, border: '1px solid rgba(255,255,255,0.3)' }}>{selectedLead.product_name}</span>}
                                  {selectedLead.budget_range && <span style={{ background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(8px)', color: '#fff', padding: '3px 10px', borderRadius: 20, fontSize: 10, fontWeight: 700, border: '1px solid rgba(255,255,255,0.3)' }}>{selectedLead.budget_range.replace('budget_', '')}</span>}
                                </div>
                              </div>
                            </div>
                            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                              <button onClick={() => setActiveTab('chat')} style={{ padding: '8px 14px', borderRadius: 11, border: '1px solid rgba(255,255,255,0.35)', background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'DM Sans' }}>💬 Chat</button>
                              {!selectedLead.converted && selectedLead.status !== 'lost' && (
                                <button onClick={() => setActiveTab('convert')} style={{ padding: '8px 14px', borderRadius: 11, border: 'none', background: 'rgba(255,255,255,0.95)', color: '#160D35', fontSize: 12, fontWeight: 800, cursor: 'pointer', fontFamily: 'Space Grotesk', boxShadow: '0 4px 16px rgba(0,0,0,0.2)' }}>🏆 Close Deal</button>
                              )}
                            </div>
                          </div>

                          <div className="hero-strip">
                            {[
                              { icon: '💬', val: msgCount, label: 'Messages' },
                              { icon: '📞', val: callCount || '—', label: 'Calls' },
                              { icon: '📅', val: fuCount, label: 'Follow-ups' },
                              { icon: '📆', val: `${daysActive}d`, label: 'Active' },
                            ].map((s, i) => (
                              <div key={s.label} className="hero-cell" style={{ borderRight: i < 3 ? '1px solid rgba(255,255,255,0.15)' : 'none' }}>
                                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', marginBottom: 3 }}>{s.icon} {s.label}</div>
                                <div style={{ fontFamily: 'Space Grotesk', fontSize: 18, fontWeight: 800, color: '#fff' }}>{s.val}</div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Bot journey */}
                        <div className="bot-strip">
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                            <span style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Bot Journey — Step {selectedLead.bot_step}/9</span>
                            <span style={{ fontSize: 10, fontWeight: 800, color: botPct === 100 ? '#10B981' : '#7C3AED' }}>{botPct}% complete</span>
                          </div>
                          <div style={{ display: 'flex', gap: 0, alignItems: 'center' }}>
                            {botSteps.map((step, i) => {
                              const done = i <= selectedLead.bot_step
                              const active = i === selectedLead.bot_step
                              return (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', flex: i < botSteps.length - 1 ? '0 0 auto' : 1 }}>
                                  <div style={{ width: 22, height: 22, borderRadius: 11, background: done ? '#7C3AED' : '#EAE6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800, color: done ? '#fff' : '#C4B5FD', boxShadow: active ? '0 0 0 3px rgba(124,58,237,0.2)' : 'none', flexShrink: 0 }}>
                                    {done && !active ? '✓' : i}
                                  </div>
                                  {i < botSteps.length - 1 && <div style={{ flex: 1, height: 2, background: done ? '#7C3AED' : '#EAE6FF', minWidth: 4 }} />}
                                </div>
                              )
                            })}
                          </div>
                        </div>

                        {/* Tabs */}
                        <div className="tabs">
                          {[
                            { id: 'chat', label: `💬 Chat (${msgCount})` },
                            { id: 'insights', label: '📊 Insights' },
                            { id: 'timeline', label: `📅 Follow-ups (${fuCount})` },
                            { id: 'convert', label: selectedLead.converted ? '✅ Won' : '🏆 Close Deal' },
                          ].map(t => (
                            <button key={t.id} className={`tab ${activeTab === t.id ? 'active' : ''}`} onClick={() => setActiveTab(t.id as any)}>{t.label}</button>
                          ))}
                        </div>

                        {/* Chat */}
                        {activeTab === 'chat' && (
                          <div className="chat-body">
                            {whatsappMsgs.length === 0 ? <div style={{ textAlign: 'center', color: '#9CA3AF', padding: 40 }}>No messages yet</div>
                              : whatsappMsgs.map(msg => (
                                <div key={msg.id} className={msg.direction === 'inbound' ? 'bubble-in' : 'bubble-out'} style={{ display: 'flex', flexDirection: 'column' }}>
                                  <div className={`bubble ${msg.direction === 'inbound' ? 'bubble-in' : 'bubble-out'}`}>{msg.body}</div>
                                  <div className="btime" style={{ textAlign: msg.direction === 'inbound' ? 'left' : 'right' }}>{timeAgo(msg.created_at)}</div>
                                </div>
                              ))}
                            <div ref={chatEndRef} />
                          </div>
                        )}

                        {/* Insights */}
                        {activeTab === 'insights' && (
                          <div className="panel-body">
                            <div style={{ display: 'flex', gap: 16, justifyContent: 'center', padding: '8px 0 16px' }}>
                              <RadialGauge value={engScore} max={100} color={cc.pulse} size={90} label="Engagement" />
                              <RadialGauge value={selectedLead.bot_step} max={9} color="#7C3AED" size={90} label="Bot Progress" />
                              <RadialGauge value={callCount} max={Math.max(callCount, 3)} color="#10B981" size={90} label="Calls" />
                            </div>
                            <div className="insights-grid">
                              {[
                                { k: 'Product', v: selectedLead.product_name },
                                { k: 'Variant', v: selectedLead.product_variant?.replace('q4_', '') },
                                { k: 'City', v: selectedLead.customer_city },
                                { k: 'Budget', v: selectedLead.budget_range?.replace('budget_', '') },
                                { k: 'Units', v: selectedLead.units },
                                { k: 'Language', v: selectedLead.language },
                                { k: 'Status', v: selectedLead.status },
                                { k: 'Usage Type', v: selectedLead.usage_type },
                                { k: 'First Contact', v: new Date(selectedLead.created_at).toLocaleDateString('en-IN') },
                                { k: 'Last Active', v: timeAgo(selectedLead.updated_at) },
                                { k: 'Converted', v: selectedLead.converted ? `Yes — ₹${selectedLead.order_value?.toLocaleString()}` : 'No' },
                                { k: 'Lost Reason', v: selectedLead.lost_reason },
                              ].filter(d => d.v).map(d => (
                                <div key={d.k} className="insight-card">
                                  <div className="insight-key">{d.k}</div>
                                  <div className="insight-val" style={{ fontSize: 14 }}>{d.v}</div>
                                </div>
                              ))}
                            </div>
                            {selectedLead.notes && (
                              <div className="card" style={{ marginTop: 4 }}>
                                <div style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', marginBottom: 6 }}>📝 Notes</div>
                                <div style={{ fontSize: 13, color: '#160D35', lineHeight: 1.6 }}>{selectedLead.notes}</div>
                              </div>
                            )}

                            {/* Call recordings */}
                            {calls.length > 0 && (
                              <div>
                                {calls.map(call => (
                                  <div key={call.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                      <div style={{ width: 36, height: 36, borderRadius: 10, background: call.status === 'completed' ? '#D1FAE5' : '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>{call.status === 'completed' ? '✅' : '📞'}</div>
                                      <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: 13, fontWeight: 700, fontFamily: 'Space Grotesk' }}>Kate AI Call</div>
                                        <div style={{ fontSize: 11, color: '#9CA3AF' }}>{timeAgo(call.created_at)}{call.duration ? ` · ${call.duration}s` : ''}</div>
                                      </div>
                                    </div>
                                    {call.recording_url && (
                                      <div style={{ background: '#F4F1FF', borderRadius: 10, padding: '10px 12px' }}>
                                        <div style={{ fontSize: 10, fontWeight: 700, color: '#7C3AED', textTransform: 'uppercase', marginBottom: 6 }}>🎙️ Recording</div>
                                        <audio controls preload="none" style={{ width: '100%', height: 32, accentColor: '#7C3AED' }}>
                                          <source src={call.recording_url} type="audio/wav" />
                                          <source src={call.recording_url} type="audio/mpeg" />
                                        </audio>
                                      </div>
                                    )}
                                    {call.transcript && (
                                      <div style={{ background: '#F4F1FF', borderRadius: 10, padding: '10px 12px', maxHeight: 150, overflowY: 'auto' }}>
                                        <div style={{ fontSize: 10, fontWeight: 700, color: '#7C3AED', textTransform: 'uppercase', marginBottom: 8 }}>📝 Transcript</div>
                                        {call.transcript.split('\n').filter(Boolean).map((line, i) => {
                                          const isAI = line.startsWith('AI:')
                                          return (
                                            <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 5, alignItems: 'flex-start' }}>
                                              <span style={{ fontSize: 9, fontWeight: 800, padding: '2px 6px', borderRadius: 5, flexShrink: 0, background: isAI ? '#EDE9FE' : '#F3F4F6', color: isAI ? '#7C3AED' : '#6B7280' }}>{isAI ? 'KATE' : 'USER'}</span>
                                              <span style={{ fontSize: 12, color: '#160D35', lineHeight: 1.4 }}>{line.replace(/^(AI:|User:)\s*/, '')}</span>
                                            </div>
                                          )
                                        })}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Timeline / Follow-ups */}
                        {activeTab === 'timeline' && (
                          <div className="panel-body">
                            {followUps.length === 0 ? <div style={{ textAlign: 'center', color: '#9CA3AF', padding: 40 }}>No follow-ups scheduled</div> : (
                              <>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 4 }}>
                                  {[
                                    { lbl: 'Total', num: followUps.length, color: '#7C3AED' },
                                    { lbl: 'Pending', num: followUps.filter(f => f.status === 'pending').length, color: '#F7971E' },
                                    { lbl: 'Sent', num: followUps.filter(f => f.status === 'sent').length, color: '#10B981' },
                                  ].map(s => (
                                    <div key={s.lbl} className="card" style={{ padding: '10px 12px', textAlign: 'center' }}>
                                      <div style={{ fontSize: 9, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', marginBottom: 4 }}>{s.lbl}</div>
                                      <div style={{ fontFamily: 'Space Grotesk', fontSize: 22, fontWeight: 800, color: s.color }}>{s.num}</div>
                                    </div>
                                  ))}
                                </div>
                                {followUps.map(fu => {
                                  const isCall = fu.day_number === 7 && fu.category === 'warm'
                                  const sc = fu.status === 'sent' ? { bg: '#D1FAE5', color: '#065F46' } : fu.status === 'pending' ? { bg: '#FEF3C7', color: '#92400E' } : { bg: '#FEE2E2', color: '#991B1B' }
                                  return (
                                    <div key={fu.id} className="card">
                                      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                                        <div style={{ width: 34, height: 34, borderRadius: 10, background: isCall ? '#EDE9FE' : '#FDF4FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>{isCall ? '📞' : '💬'}</div>
                                        <div style={{ flex: 1 }}>
                                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                            <div style={{ fontSize: 13, fontWeight: 700, fontFamily: 'Space Grotesk' }}>Day {fu.day_number} — {isCall ? 'Kate Call' : 'WhatsApp'}</div>
                                            <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 20, background: sc.bg, color: sc.color }}>{fu.status.toUpperCase()}</span>
                                          </div>
                                          <div style={{ fontSize: 11, color: '#9CA3AF' }}>📅 {new Date(fu.scheduled_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>
                                          {fu.sent_at && <div style={{ fontSize: 11, color: '#10B981', marginTop: 2, fontWeight: 600 }}>✅ {new Date(fu.sent_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>}
                                        </div>
                                      </div>
                                    </div>
                                  )
                                })}
                              </>
                            )}
                          </div>
                        )}

                        {/* Convert / Close Deal */}
                        {activeTab === 'convert' && (
                          <div className="panel-body">
                            {selectedLead.converted ? (
                              <div className="card" style={{ textAlign: 'center', padding: 36 }}>
                                <div style={{ fontSize: 52, marginBottom: 12 }}>🎉</div>
                                <div style={{ fontFamily: 'Space Grotesk', fontSize: 22, fontWeight: 800, color: '#10B981', marginBottom: 8 }}>Lead Won!</div>
                                <div style={{ fontSize: 14, color: '#6B7280' }}>Order Value: <strong style={{ color: '#160D35' }}>₹{selectedLead.order_value?.toLocaleString()}</strong></div>
                                {selectedLead.converted_at && <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 6 }}>Converted {new Date(selectedLead.converted_at).toLocaleDateString('en-IN')}</div>}
                              </div>
                            ) : selectedLead.status === 'lost' ? (
                              <div className="card" style={{ textAlign: 'center', padding: 36 }}>
                                <div style={{ fontSize: 52, marginBottom: 12 }}>❌</div>
                                <div style={{ fontFamily: 'Space Grotesk', fontSize: 22, fontWeight: 800, color: '#EF4444', marginBottom: 8 }}>Lead Lost</div>
                                <div style={{ fontSize: 14, color: '#6B7280' }}>Reason: {selectedLead.lost_reason || 'Not specified'}</div>
                              </div>
                            ) : (
                              <>
                                {/* Won form */}
                                <div style={{ background: '#F0FDF4', border: '1.5px solid #6EE7B7', borderRadius: 16, padding: 18 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                                    <div style={{ width: 32, height: 32, borderRadius: 9, background: '#D1FAE5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>✅</div>
                                    <div style={{ fontFamily: 'Space Grotesk', fontSize: 14, fontWeight: 800, color: '#065F46' }}>Mark as WON</div>
                                  </div>
                                  <div style={{ marginBottom: 12 }}>
                                    <div style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', marginBottom: 6 }}>Order Value (₹)</div>
                                    <input type="number" placeholder="e.g. 29500" value={orderVal} onChange={e => setOrderVal(e.target.value)}
                                      style={{ width: '100%', border: '1.5px solid #6EE7B7', borderRadius: 11, padding: '11px 14px', fontSize: 13, fontFamily: 'DM Sans', color: '#160D35', background: '#fff', outline: 'none' }} />
                                  </div>
                                  <button onClick={markWon} style={{ width: '100%', padding: 13, borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,#10B981,#059669)', color: '#fff', fontSize: 14, fontWeight: 800, cursor: 'pointer', fontFamily: 'Space Grotesk', boxShadow: '0 6px 20px rgba(16,185,129,0.4)' }}>
                                    ✅ Confirm Win{orderVal ? ` · ₹${parseInt(orderVal).toLocaleString()}` : ''}
                                  </button>
                                </div>

                                {/* Lost form */}
                                <div style={{ background: '#FFF5F5', border: '1.5px solid #FCA5A5', borderRadius: 16, padding: 18 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                                    <div style={{ width: 32, height: 32, borderRadius: 9, background: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>❌</div>
                                    <div style={{ fontFamily: 'Space Grotesk', fontSize: 14, fontWeight: 800, color: '#991B1B' }}>Mark as Lost</div>
                                  </div>
                                  <input type="text" value={lostReason} onChange={e => setLostReason(e.target.value)} placeholder="Why was this lead lost?"
                                    style={{ width: '100%', border: '1.5px solid #FCA5A5', borderRadius: 11, padding: '11px 14px', fontSize: 13, fontFamily: 'DM Sans', color: '#160D35', background: '#fff', outline: 'none', marginBottom: 12 }} />
                                  <button onClick={markLost} style={{ width: '100%', padding: 11, borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,#EF4444,#DC2626)', color: '#fff', fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: 'Space Grotesk', boxShadow: '0 4px 16px rgba(239,68,68,0.28)' }}>
                                    ❌ Mark Lead as Lost
                                  </button>
                                </div>

                                {/* Notes */}
                                <div className="card">
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                                    <div style={{ width: 32, height: 32, borderRadius: 9, background: '#EDE9FE', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>📝</div>
                                    <div style={{ fontFamily: 'Space Grotesk', fontSize: 14, fontWeight: 800, color: '#160D35' }}>Sales Notes</div>
                                  </div>
                                  <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Add notes..."
                                    style={{ width: '100%', border: '1.5px solid #EAE6FF', borderRadius: 11, padding: '10px 12px', fontSize: 13, fontFamily: 'DM Sans', color: '#160D35', background: '#F4F1FF', outline: 'none', resize: 'vertical', minHeight: 80, marginBottom: 10 }} />
                                  <button onClick={saveNotes} disabled={savingNotes} style={{ width: '100%', padding: 12, borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,#7C3AED,#4F46E5)', color: '#fff', fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: 'Space Grotesk', boxShadow: '0 4px 14px rgba(124,58,237,0.3)' }}>
                                    {savingNotes ? '💾 Saving...' : '💾 Save Notes'}
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        )}
                      </>
                    )
                  })()}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  )
}