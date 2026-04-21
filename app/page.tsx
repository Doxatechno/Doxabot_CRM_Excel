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
  hot:  { grad:'linear-gradient(135deg,#FF416C,#FF4B2B)', glow:'rgba(255,65,108,0.4)', pulse:'#FF416C', light:'#FFF0F2', border:'#FFB3C6', label:'🔥 HOT' },
  warm: { grad:'linear-gradient(135deg,#F7971E,#FFD200)', glow:'rgba(247,151,30,0.4)', pulse:'#F7971E', light:'#FFF8EC', border:'#FFD166', label:'🌡 WARM' },
  cold: { grad:'linear-gradient(135deg,#4facfe,#00f2fe)', glow:'rgba(79,172,254,0.4)', pulse:'#4facfe', light:'#EFF8FF', border:'#93C5FD', label:'❄️ COLD' },
}

function timeAgo(ts: string) {
  if (!ts) return ''
  const diff = Date.now() - new Date(ts).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function formatTime(ts: string) {
  if (!ts) return '—'
  return new Date(ts).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function formatDate(ts: string) {
  if (!ts) return '—'
  return new Date(ts).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function Avatar({ name, size = 38, cat }: { name: string; size?: number; cat: string }) {
  const gradients: any = {
    hot: 'linear-gradient(135deg,#FF6B6B,#EE0979)',
    warm: 'linear-gradient(135deg,#FFD93D,#FF6B35)',
    cold: 'linear-gradient(135deg,#74EBD5,#4F86F7)',
    default: 'linear-gradient(135deg,#A18CD1,#FBC2EB)',
  }
  const g = gradients[cat] || gradients.default
  const letter = (name || 'U')[0].toUpperCase()
  return (
    <div style={{ width: size, height: size, borderRadius: size * 0.28, background: g, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: size * 0.42, color: '#fff', flexShrink: 0, fontFamily: 'Space Grotesk', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
      {letter}
    </div>
  )
}

function CatBadge({ cat }: { cat: string }) {
  const cc = CAT_CONFIG[cat]
  if (!cc) return null
  return (
    <span style={{ background: cc.light, color: cc.pulse, border: `1.5px solid ${cc.border}`, borderRadius: 20, padding: '2px 8px', fontSize: 9, fontWeight: 800, letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>
      {cc.label}
    </span>
  )
}

function RadialGauge({ value, max, color, size = 88, label }: any) {
  const pct = Math.min(value / max, 1)
  const r = (size / 2) - 8
  const circ = 2 * Math.PI * r
  const dash = pct * circ
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#EAE6FF" strokeWidth="7" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="7"
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" style={{ transition: 'stroke-dasharray 1s ease' }} />
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
  const [activeNav, setActiveNav] = useState('dashboard')
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
  const [replyText, setReplyText] = useState('')
  const [sendingReply, setSendingReply] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    checkAuth()
    setMounted(true)
    fetchAll()
    fetchAllFollowUps()
    const ch = supabase.channel('crm')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => {
        fetchAll()
        setNewLeadPing(true)
        setTimeout(() => setNewLeadPing(false), 3000)
      })
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
      setReplyText('')
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
  async function sendReply() {
    if (!selectedLead || !replyText.trim()) return
    setSendingReply(true)
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/send-message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        },
        body: JSON.stringify({ phone: selectedLead.phone, message: replyText.trim() }),
      })
      const data = await res.json()
      if (data.success) {
        setReplyText('')
        setTimeout(() => fetchMessages(selectedLead.phone), 1000)
      } else {
        alert('Failed: ' + (data.error || 'Unknown error'))
      }
    } catch {
      alert('Send failed. Check connection.')
    }
    setSendingReply(false)
  }

  function exportLeads(data: Lead[], filename: string) {
    let d = data
    if (exportFrom) d = d.filter(l => new Date(l.created_at) >= new Date(exportFrom))
    if (exportTo) d = d.filter(l => new Date(l.created_at) <= new Date(exportTo + 'T23:59:59'))
    const h = ['Name', 'Phone', 'Category', 'CAT', 'Product', 'City', 'Budget', 'Units', 'Language', 'Status', 'Converted', 'Order Value', 'Notes', 'Created']
    const rows = d.map(l => [l.name ?? '', l.phone ?? '', l.category ?? '', l.lead_cat ?? '', l.product_name ?? '', l.customer_city ?? '', l.budget_range?.replace('budget_', '') ?? '', l.units ?? '', l.language ?? '', l.status ?? '', l.converted ? 'Yes' : 'No', l.order_value ? `₹${l.order_value}` : '', l.notes ?? '', new Date(l.created_at).toLocaleDateString('en-IN')])
    const csv = [h, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = filename; a.click()
  }

  const filtered = leads.filter(l => {
    const mf = filter === 'all' || l.category === filter || (filter === 'converted' && l.converted) || (filter === 'lost' && l.status === 'lost')
    const ms = !search || l.name?.toLowerCase().includes(search.toLowerCase()) || l.phone?.includes(search) || l.customer_city?.toLowerCase().includes(search.toLowerCase()) || l.product_name?.toLowerCase().includes(search.toLowerCase())
    return mf && ms
  })

  const stats = {
    total: leads.length,
    hot: leads.filter(l => l.category === 'hot').length,
    warm: leads.filter(l => l.category === 'warm').length,
    cold: leads.filter(l => l.category === 'cold').length,
    qualified: leads.filter(l => l.status === 'qualified').length,
    converted: leads.filter(l => l.converted).length,
    lost: leads.filter(l => l.status === 'lost').length,
    revenue: leads.filter(l => l.converted).reduce((s, l) => s + (l.order_value || 0), 0),
    catA: leads.filter(l => l.lead_cat === 'A').length,
    catB: leads.filter(l => l.lead_cat === 'B').length,
    catC: leads.filter(l => l.lead_cat === 'C').length,
    catD: leads.filter(l => l.lead_cat === 'D').length,
  }
  const convRate = stats.qualified > 0 ? Math.round((stats.converted / stats.qualified) * 100) : 0
  const pendingFU = allFollowUps.filter(f => f.status === 'pending').length
  const whatsappMsgs = messages.filter(m => !m.body?.startsWith('[Kate Call') && !m.body?.startsWith('[Follow-up'))
  const botSteps = ['New', 'Q1', 'Q2', 'Q3', 'Q4', 'Name', 'City', 'Budget', 'Units', '✅ Done']

  const products = Object.entries(leads.reduce((a, l) => { if (l.product_name) a[l.product_name] = (a[l.product_name] || 0) + 1; return a }, {} as Record<string, number>)).sort((a, b) => b[1] - a[1]).slice(0, 6)
  const cities = Object.entries(leads.reduce((a, l) => { if (l.customer_city) a[l.customer_city] = (a[l.customer_city] || 0) + 1; return a }, {} as Record<string, number>)).sort((a, b) => b[1] - a[1]).slice(0, 6)
  const langs = Object.entries(leads.reduce((a, l) => { if (l.language) a[l.language] = (a[l.language] || 0) + 1; return a }, {} as Record<string, number>)).sort((a, b) => b[1] - a[1])
  const maxP = products[0]?.[1] || 1, maxC = cities[0]?.[1] || 1

  const navItems = [
    { id: 'dashboard', label: 'Leads', icon: (<svg width="20" height="20" fill="none" viewBox="0 0 24 24"><rect x="3" y="3" width="8" height="8" rx="2" fill="currentColor" opacity=".9"/><rect x="13" y="3" width="8" height="8" rx="2" fill="currentColor" opacity=".5"/><rect x="3" y="13" width="8" height="8" rx="2" fill="currentColor" opacity=".5"/><rect x="13" y="13" width="8" height="8" rx="2" fill="currentColor" opacity=".3"/></svg>) },
    { id: 'analytics', label: 'Analytics', icon: (<svg width="20" height="20" fill="none" viewBox="0 0 24 24"><path d="M3 17l4-5 4 3 4-6 4 4" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/><path d="M3 21h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity=".5"/></svg>) },
    { id: 'calls', label: 'Calls', icon: (<svg width="20" height="20" fill="none" viewBox="0 0 24 24"><path d="M6.6 10.8a15 15 0 006.6 6.6l2.2-2.2a1 1 0 011-.25 11.4 11.4 0 003.55.56 1 1 0 011 1v3.5a1 1 0 01-1 1A17 17 0 013 5a1 1 0 011-1h3.5a1 1 0 011 1 11.4 11.4 0 00.56 3.55 1 1 0 01-.25 1L6.6 10.8z" fill="currentColor" opacity=".8"/></svg>) },
    { id: 'followups', label: 'Follow-ups', icon: (<svg width="20" height="20" fill="none" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="3" stroke="currentColor" strokeWidth="2" opacity=".7"/><path d="M16 2v4M8 2v4M3 10h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity=".5"/><circle cx="12" cy="15" r="2" fill="currentColor"/></svg>), badge: pendingFU },
    { id: 'settings', label: 'Settings', icon: (<svg width="20" height="20" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" stroke="currentColor" strokeWidth="2"/></svg>) },
  ]

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700;800&family=DM+Sans:wght@300;400;500;600;700&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { height: 100%; overflow: hidden; background: #F4F1FF; color: #160D35; font-family: 'DM Sans', sans-serif; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #C4B5FD; border-radius: 4px; }
        @keyframes fadeUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes livePulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.5;transform:scale(0.8)} }
        @keyframes heroPing { 0%,100%{opacity:0.6;transform:scale(1)} 50%{opacity:0.2;transform:scale(1.08)} }
        @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
        @keyframes spin { to{transform:rotate(360deg)} }
        @keyframes ping { 0%{transform:scale(1);opacity:1} 75%,100%{transform:scale(2);opacity:0} }
      `}</style>

      <div style={{ display: 'flex', height: '100vh', opacity: mounted ? 1 : 0, transition: 'opacity 0.4s' }}>

        {/* ── SIDEBAR ── */}
        <aside style={{ width: 72, background: 'linear-gradient(180deg,#160D35 0%,#2D1472 50%,#160D35 100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '16px 0 20px', gap: 2, flexShrink: 0, zIndex: 20 }}>
          <div style={{ width: 44, height: 44, borderRadius: 13, overflow: 'hidden', marginBottom: 16, boxShadow: '0 4px 16px rgba(124,58,237,0.4)', flexShrink: 0 }}>
            <img src="/favicon.png" style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Excel" onError={e => (e.target as HTMLImageElement).style.display = 'none'} />
          </div>
          {navItems.map(item => {
            const active = activeNav === item.id
            return (
              <button key={item.id} onClick={() => setActiveNav(item.id)}
                style={{ width: 56, borderRadius: 14, padding: '10px 0 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, cursor: 'pointer', border: 'none', background: active ? 'rgba(255,255,255,0.12)' : 'transparent', color: active ? '#fff' : 'rgba(255,255,255,0.4)', transition: 'all 0.2s', position: 'relative', boxShadow: active ? 'inset 0 0 0 1px rgba(255,255,255,0.15)' : 'none' }}
                onMouseEnter={e => { if (!active) { e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; e.currentTarget.style.color = 'rgba(255,255,255,0.8)' } }}
                onMouseLeave={e => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.4)' } }}>
                {active && <div style={{ position: 'absolute', left: 0, top: '20%', height: '60%', width: 3, background: 'linear-gradient(180deg,#A78BFA,#6D28D9)', borderRadius: '0 3px 3px 0' }} />}
                {(item as any).badge > 0 && <div style={{ position: 'absolute', top: 6, right: 6, width: 16, height: 16, borderRadius: 8, background: '#FF6B35', border: '2px solid #160D35', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 800, color: '#fff' }}>{(item as any).badge > 9 ? '9+' : (item as any).badge}</div>}
                <span style={{ transition: 'transform 0.2s', transform: active ? 'scale(1.1)' : 'scale(1)' }}>{item.icon}</span>
                <span style={{ fontSize: 8.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: 'DM Sans' }}>{item.label}</span>
              </button>
            )
          })}
          <div style={{ marginTop: 'auto', width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg,#7C3AED,#06B6D4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, cursor: 'pointer', boxShadow: '0 2px 10px rgba(124,58,237,0.4)' }}
            onClick={async () => { await supabase.auth.signOut(); window.location.href = '/login' }}
            title="Sign Out">👤</div>
        </aside>

        {/* ── MAIN ── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

          {/* TOPBAR */}
          <div style={{ height: 64, background: '#fff', display: 'flex', alignItems: 'center', padding: '0 24px', gap: 16, borderBottom: '1px solid #EAE6FF', flexShrink: 0, zIndex: 10 }}>
            <img src="/logo.webp" style={{ height: 36, objectFit: 'contain' }} alt="Excel Fit India" onError={e => (e.target as HTMLImageElement).style.display = 'none'} />
            <div>
              <div style={{ fontFamily: 'Space Grotesk', fontSize: 16, fontWeight: 800, color: '#160D35', letterSpacing: '-0.02em' }}>Excel Sales CRM</div>
              <div style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 500 }}>Powered by <span style={{ color: '#7C3AED', fontWeight: 700 }}>Doxa Techno Solutions</span></div>
            </div>
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
              {newLeadPing && <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 30, background: 'linear-gradient(135deg,#FFF0F2,#FFE4EC)', border: '1.5px solid #FFB3C6', fontSize: 11, fontWeight: 700, color: '#EE0979', animation: 'fadeUp 0.3s ease' }}>🔥 New Lead!</div>}
              {pendingFU > 0 && <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 30, background: '#FFF8EC', border: '1.5px solid #FFD166', fontSize: 11, fontWeight: 700, color: '#E85D04' }}>📅 {pendingFU} pending</div>}
              <div style={{ position: 'relative' }} className="exp-wrap">
                <button onClick={() => setShowExport(!showExport)} style={{ padding: '7px 14px', borderRadius: 10, border: '1.5px solid #EAE6FF', background: '#FAFAFF', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#6B7280', fontFamily: 'DM Sans', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <svg width="13" height="13" fill="none" viewBox="0 0 24 24"><path d="M12 4v12m0 0l-4-4m4 4l4-4M4 20h16" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  Export
                </button>
                {showExport && (
                  <div style={{ position: 'absolute', right: 0, top: 40, background: '#fff', border: '1px solid #EAE6FF', borderRadius: 14, padding: 10, zIndex: 200, minWidth: 240, boxShadow: '0 12px 40px rgba(22,13,53,0.15)' }}>
                    <div style={{ display: 'flex', gap: 6, padding: '0 4px 8px', borderBottom: '1px solid #EAE6FF', marginBottom: 6 }}>
                      <input type="date" value={exportFrom} onChange={e => setExportFrom(e.target.value)} style={{ flex: 1, padding: '5px 8px', border: '1px solid #EAE6FF', borderRadius: 8, fontSize: 11, fontFamily: 'DM Sans', outline: 'none' }} />
                      <input type="date" value={exportTo} onChange={e => setExportTo(e.target.value)} style={{ flex: 1, padding: '5px 8px', border: '1px solid #EAE6FF', borderRadius: 8, fontSize: 11, fontFamily: 'DM Sans', outline: 'none' }} />
                    </div>
                    {[
                      { label: '🔥 Hot Leads', f: (l: Lead) => l.category === 'hot', file: 'hot-leads.csv' },
                      { label: '🌡️ Warm Leads', f: (l: Lead) => l.category === 'warm', file: 'warm-leads.csv' },
                      { label: '❄️ Cold Leads', f: (l: Lead) => l.category === 'cold', file: 'cold-leads.csv' },
                      { label: '✅ Converted', f: (l: Lead) => !!l.converted, file: 'converted.csv' },
                      { label: '❌ Lost', f: (l: Lead) => l.status === 'lost', file: 'lost.csv' },
                      { label: '📋 All Leads', f: (_: Lead) => true, file: 'all-leads.csv' },
                    ].map(opt => (
                      <button key={opt.file} onClick={() => { exportLeads(leads.filter(opt.f), opt.file); setShowExport(false) }}
                        style={{ width: '100%', padding: '8px 10px', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 12, color: '#160D35', textAlign: 'left', borderRadius: 8, fontFamily: 'DM Sans', fontWeight: 500 }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#F4F1FF')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 30, background: '#D1FAE5', border: '1.5px solid #6EE7B7', fontSize: 11, fontWeight: 700, color: '#065F46' }}>
                <div style={{ width: 6, height: 6, borderRadius: 3, background: '#10B981', animation: 'livePulse 1.5s infinite' }} />Live
              </div>
              <button onClick={async () => { await supabase.auth.signOut(); window.location.href = '/login' }}
                style={{ padding: '7px 14px', borderRadius: 10, border: '1.5px solid #EAE6FF', background: '#FAFAFF', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#6B7280', fontFamily: 'DM Sans' }}>
                🚪 Sign Out
              </button>
            </div>
          </div>

          {/* CONTENT */}
          <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

            {/* ── ANALYTICS ── */}
            {activeNav === 'analytics' && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <div style={{ padding: '16px 24px', background: '#fff', borderBottom: '1px solid #EAE6FF', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                  <div style={{ fontFamily: 'Space Grotesk', fontSize: 18, fontWeight: 800, color: '#160D35' }}>📊 Sales Analytics</div>
                  <div style={{ fontSize: 12, color: '#9CA3AF' }}>All-time performance</div>
                </div>
                <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 20 }}>
                    {[
                      { label: 'Total Leads', value: stats.total, sub: `${stats.qualified} qualified`, grad: 'linear-gradient(135deg,#7C3AED,#4F46E5)', icon: '👥' },
                      { label: 'Converted', value: stats.converted, sub: `${convRate}% conversion`, grad: 'linear-gradient(135deg,#10B981,#059669)', icon: '✅' },
                      { label: 'Revenue', value: `₹${(stats.revenue / 1000).toFixed(0)}K`, sub: `avg ₹${stats.converted > 0 ? Math.round(stats.revenue / stats.converted).toLocaleString() : 0}/deal`, grad: 'linear-gradient(135deg,#F59E0B,#D97706)', icon: '💰' },
                      { label: 'Lost Leads', value: stats.lost, sub: `${stats.qualified > 0 ? Math.round((stats.lost / stats.qualified) * 100) : 0}% loss rate`, grad: 'linear-gradient(135deg,#EF4444,#DC2626)', icon: '❌' },
                    ].map(k => (
                      <div key={k.label} style={{ borderRadius: 16, padding: 20, background: k.grad, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', color: '#fff' }}>
                        <div style={{ fontSize: 24, marginBottom: 6 }}>{k.icon}</div>
                        <div style={{ fontFamily: 'Space Grotesk', fontSize: 28, fontWeight: 800, marginBottom: 2 }}>{k.value}</div>
                        <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.8, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{k.label}</div>
                        <div style={{ fontSize: 12, opacity: 0.7 }}>{k.sub}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 14 }}>
                    <div style={{ background: '#fff', border: '1px solid #EAE6FF', borderRadius: 16, padding: 18, boxShadow: '0 2px 12px rgba(22,13,53,0.05)' }}>
                      <div style={{ fontFamily: 'Space Grotesk', fontSize: 13, fontWeight: 800, color: '#160D35', marginBottom: 14 }}>🔽 Sales Funnel</div>
                      {[{ label: 'Total Leads', value: stats.total, color: '#7C3AED' }, { label: 'Qualified', value: stats.qualified, color: '#F59E0B' }, { label: 'Hot Leads', value: stats.hot, color: '#EE0979' }, { label: 'Converted', value: stats.converted, color: '#10B981' }, { label: 'Lost', value: stats.lost, color: '#9CA3AF' }].map((f, i) => (
                        <div key={f.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: i < 4 ? '1px solid #F0EEFF' : 'none' }}>
                          <span style={{ fontSize: 12, color: '#6B7280' }}>{f.label}</span>
                          <span style={{ fontFamily: 'Space Grotesk', fontSize: 16, fontWeight: 800, color: f.color }}>{f.value}</span>
                        </div>
                      ))}
                    </div>
                    <div style={{ background: '#fff', border: '1px solid #EAE6FF', borderRadius: 16, padding: 18, boxShadow: '0 2px 12px rgba(22,13,53,0.05)' }}>
                      <div style={{ fontFamily: 'Space Grotesk', fontSize: 13, fontWeight: 800, color: '#160D35', marginBottom: 14 }}>📦 Top Products</div>
                      {products.map(([name, count]) => (
                        <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                          <div style={{ fontSize: 11, color: '#6B7280', width: 90, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
                          <div style={{ flex: 1, height: 8, background: '#F0EEFF', borderRadius: 4, overflow: 'hidden' }}><div style={{ height: '100%', width: `${(count / maxP) * 100}%`, background: 'linear-gradient(90deg,#7C3AED,#4F46E5)', borderRadius: 4 }} /></div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: '#7C3AED', width: 20, textAlign: 'right' }}>{count}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ background: '#fff', border: '1px solid #EAE6FF', borderRadius: 16, padding: 18, boxShadow: '0 2px 12px rgba(22,13,53,0.05)' }}>
                      <div style={{ fontFamily: 'Space Grotesk', fontSize: 13, fontWeight: 800, color: '#160D35', marginBottom: 14 }}>📍 Top Cities</div>
                      {cities.map(([city, count]) => (
                        <div key={city} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                          <div style={{ fontSize: 11, color: '#6B7280', width: 80, flexShrink: 0 }}>{city}</div>
                          <div style={{ flex: 1, height: 8, background: '#FFF8EC', borderRadius: 4, overflow: 'hidden' }}><div style={{ height: '100%', width: `${(count / maxC) * 100}%`, background: 'linear-gradient(90deg,#F59E0B,#D97706)', borderRadius: 4 }} /></div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: '#D97706', width: 20, textAlign: 'right' }}>{count}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
                    <div style={{ background: '#fff', border: '1px solid #EAE6FF', borderRadius: 16, padding: 18, boxShadow: '0 2px 12px rgba(22,13,53,0.05)' }}>
                      <div style={{ fontFamily: 'Space Grotesk', fontSize: 13, fontWeight: 800, color: '#160D35', marginBottom: 14 }}>🏷️ Lead Categories</div>
                      {[{ label: 'CAT A — Home', val: stats.catA, color: '#10B981', bg: '#D1FAE5' }, { label: 'CAT B — Gym', val: stats.catB, color: '#7C3AED', bg: '#EDE9FE' }, { label: 'CAT C — Corp', val: stats.catC, color: '#F59E0B', bg: '#FEF3C7' }, { label: 'CAT D — Dealer', val: stats.catD, color: '#EF4444', bg: '#FEE2E2' }].map(c => (
                        <div key={c.label} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                          <div style={{ fontSize: 11, color: '#6B7280', width: 90, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.label}</div>
                          <div style={{ flex: 1, height: 8, background: c.bg, borderRadius: 4, overflow: 'hidden' }}><div style={{ height: '100%', width: `${(c.val / (stats.total || 1)) * 100}%`, background: c.color, borderRadius: 4 }} /></div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: c.color, width: 20, textAlign: 'right' }}>{c.val}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ background: '#fff', border: '1px solid #EAE6FF', borderRadius: 16, padding: 18, boxShadow: '0 2px 12px rgba(22,13,53,0.05)' }}>
                      <div style={{ fontFamily: 'Space Grotesk', fontSize: 13, fontWeight: 800, color: '#160D35', marginBottom: 14 }}>🌐 Languages</div>
                      {langs.map(([lang, count]) => (
                        <div key={lang} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                          <div style={{ fontSize: 11, color: '#6B7280', width: 80, flexShrink: 0 }}>{lang}</div>
                          <div style={{ flex: 1, height: 8, background: '#EFF8FF', borderRadius: 4, overflow: 'hidden' }}><div style={{ height: '100%', width: `${(count / (stats.total || 1)) * 100}%`, background: 'linear-gradient(90deg,#3B82F6,#1A6DB5)', borderRadius: 4 }} /></div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: '#1A6DB5', width: 20, textAlign: 'right' }}>{count}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ background: '#fff', border: '1px solid #EAE6FF', borderRadius: 16, padding: 18, boxShadow: '0 2px 12px rgba(22,13,53,0.05)' }}>
                      <div style={{ fontFamily: 'Space Grotesk', fontSize: 13, fontWeight: 800, color: '#160D35', marginBottom: 14 }}>✅ Conversions</div>
                      {[{ label: '🔥 Hot → Won', total: stats.hot, won: leads.filter(l => l.category === 'hot' && l.converted).length }, { label: '🌡️ Warm → Won', total: stats.warm, won: leads.filter(l => l.category === 'warm' && l.converted).length }, { label: '❄️ Cold → Won', total: stats.cold, won: leads.filter(l => l.category === 'cold' && l.converted).length }].map(c => (
                        <div key={c.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: '1px solid #F0EEFF' }}>
                          <span style={{ fontSize: 12, color: '#6B7280' }}>{c.label}</span>
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <span style={{ background: '#D1FAE5', color: '#065F46', padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 800 }}>{c.won}</span>
                            <span style={{ fontSize: 11, color: '#9CA3AF' }}>/ {c.total}</span>
                          </div>
                        </div>
                      ))}
                      <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid #F0EEFF' }}>
                        <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 4 }}>Total Revenue</div>
                        <div style={{ fontFamily: 'Space Grotesk', fontSize: 24, fontWeight: 800, color: '#10B981' }}>₹{stats.revenue.toLocaleString()}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── CALLS ── */}
            {activeNav === 'calls' && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <div style={{ padding: '16px 24px', background: '#fff', borderBottom: '1px solid #EAE6FF', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                  <div style={{ fontFamily: 'Space Grotesk', fontSize: 18, fontWeight: 800, color: '#160D35' }}>📞 Kate AI Calls</div>
                  <span style={{ background: '#EDE9FE', color: '#6D28D9', padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>{leads.filter(l => l.status === 'qualified' || l.category === 'hot').length} leads</span>
                </div>
                <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {leads.filter(l => l.status === 'qualified' || l.category === 'hot').map(lead => (
                    <div key={lead.id} onClick={() => { setSelectedLead(lead); setActiveNav('dashboard'); setActiveTab('chat') }}
                      style={{ background: '#fff', border: '1px solid #EAE6FF', borderRadius: 14, padding: 14, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 2px 10px rgba(22,13,53,0.05)', transition: 'transform 0.12s, box-shadow 0.12s' }}
                      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(22,13,53,0.1)' }}
                      onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 2px 10px rgba(22,13,53,0.05)' }}>
                      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                        <Avatar name={lead.name} size={40} cat={lead.category} />
                        <div>
                          <div style={{ fontFamily: 'Space Grotesk', fontSize: 14, fontWeight: 700, color: '#160D35' }}>{lead.name || 'Unknown'}</div>
                          <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>📱 {lead.phone} · {lead.customer_city}</div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <CatBadge cat={lead.category} />
                        {lead.converted && <span style={{ background: '#D1FAE5', color: '#065F46', padding: '3px 10px', borderRadius: 20, fontSize: 9, fontWeight: 800 }}>WON</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── FOLLOW-UPS ── */}
            {activeNav === 'followups' && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <div style={{ padding: '16px 24px', background: '#fff', borderBottom: '1px solid #EAE6FF', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                  <div style={{ fontFamily: 'Space Grotesk', fontSize: 18, fontWeight: 800, color: '#160D35' }}>📅 Follow-up Pipeline</div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <span style={{ background: '#FFF8EC', color: '#E85D04', border: '1.5px solid #FFD166', borderRadius: 20, padding: '4px 12px', fontSize: 11, fontWeight: 700 }}>{allFollowUps.filter(f => f.status === 'pending').length} pending</span>
                    <span style={{ background: '#D1FAE5', color: '#065F46', border: '1.5px solid #6EE7B7', borderRadius: 20, padding: '4px 12px', fontSize: 11, fontWeight: 700 }}>{allFollowUps.filter(f => f.status === 'sent').length} sent</span>
                  </div>
                </div>
                <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {allFollowUps.length === 0 && <div style={{ textAlign: 'center', color: '#C4B5FD', padding: 40, fontSize: 14 }}>No follow-ups yet</div>}
                  {allFollowUps.map(fu => {
                    const lead = leads.find(l => l.phone === fu.lead_phone)
                    const isCall = fu.day_number === 7 && fu.category === 'warm'
                    return (
                      <div key={fu.id} onClick={() => { if (lead) { setSelectedLead(lead); setActiveNav('dashboard') } }}
                        style={{ background: '#fff', border: '1px solid #EAE6FF', borderRadius: 14, padding: 14, cursor: 'pointer', boxShadow: '0 2px 10px rgba(22,13,53,0.05)', transition: 'transform 0.12s' }}
                        onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)' }}
                        onMouseLeave={e => { e.currentTarget.style.transform = 'none' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div style={{ display: 'flex', gap: 12 }}>
                            <div style={{ width: 40, height: 40, borderRadius: 11, background: isCall ? '#EDE9FE' : '#D1FAE5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>{isCall ? '📞' : '💬'}</div>
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 700, color: '#160D35', fontFamily: 'Space Grotesk' }}>{lead?.name || fu.lead_phone} — Day {fu.day_number}</div>
                              <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>{isCall ? 'Kate AI Call' : 'WhatsApp Message'} · {formatDate(fu.scheduled_at)}</div>
                              {lead && <div style={{ fontSize: 11, color: '#A78BFA', marginTop: 2 }}>📦 {lead.product_name} · 📍 {lead.customer_city}</div>}
                            </div>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
                            <span style={{ background: fu.status === 'sent' ? '#D1FAE5' : '#FFF8EC', color: fu.status === 'sent' ? '#065F46' : '#E85D04', padding: '3px 10px', borderRadius: 20, fontSize: 9, fontWeight: 800 }}>{fu.status.toUpperCase()}</span>
                            <CatBadge cat={fu.category} />
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* ── SETTINGS ── */}
            {activeNav === 'settings' && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <div style={{ padding: '16px 24px', background: '#fff', borderBottom: '1px solid #EAE6FF', flexShrink: 0 }}>
                  <div style={{ fontFamily: 'Space Grotesk', fontSize: 18, fontWeight: 800, color: '#160D35' }}>⚙️ System Configuration</div>
                </div>
                <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 }}>
                    {[
                      { icon: '📱', label: 'WhatsApp Number', value: '+91 87540 41170', color: '#10B981' },
                      { icon: '🏢', label: 'Business', value: 'Excel Fit India', color: '#7C3AED' },
                      { icon: '🤖', label: 'AI Agent', value: 'Kate — GPT-4o-mini', color: '#4F46E5' },
                      { icon: '🕐', label: 'Calling Hours', value: '8:00 AM – 9:30 PM IST', color: '#F59E0B' },
                      { icon: '⏰', label: 'Follow-up Cron', value: 'Daily 9:00 AM IST', color: '#7C3AED' },
                      { icon: '🌐', label: 'Language AI', value: 'Auto — City Detection', color: '#10B981' },
                      { icon: '🔥', label: 'Hot Lead', value: 'Instant Kate Call', color: '#EE0979' },
                      { icon: '🌡️', label: 'Warm Lead', value: '5-touch + Day 7 Call', color: '#E85D04' },
                      { icon: '❄️', label: 'Cold Lead', value: '3-touch WhatsApp only', color: '#3B82F6' },
                    ].map(s => (
                      <div key={s.label} style={{ background: '#fff', border: '1px solid #EAE6FF', borderRadius: 16, padding: 18, display: 'flex', gap: 14, alignItems: 'flex-start', boxShadow: '0 2px 10px rgba(22,13,53,0.05)' }}>
                        <div style={{ width: 44, height: 44, borderRadius: 13, background: `${s.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>{s.icon}</div>
                        <div>
                          <div style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5 }}>{s.label}</div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: '#160D35', fontFamily: 'Space Grotesk' }}>{s.value}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── LEADS (main) ── */}
            {activeNav === 'dashboard' && (
              <>
                {/* Left panel */}
                <div style={{ width: 340, display: 'flex', flexDirection: 'column', background: '#fff', borderRight: '1px solid #EAE6FF', overflow: 'hidden', flexShrink: 0 }}>
                  {/* Stats bar */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', borderBottom: '1px solid #EAE6FF' }}>
                    {[
                      { lbl: 'Total', num: stats.total, color: '#7C3AED', f: 'all' },
                      { lbl: '🔥 Hot', num: stats.hot, color: '#EE0979', f: 'hot' },
                      { lbl: '🌡 Warm', num: stats.warm, color: '#E85D04', f: 'warm' },
                      { lbl: '✅ Won', num: stats.converted, color: '#10B981', f: 'converted' },
                    ].map((s, i) => (
                      <div key={s.lbl} onClick={() => setFilter(s.f)}
                        style={{ padding: '12px 10px', cursor: 'pointer', transition: 'background 0.15s', borderRight: i < 3 ? '1px solid #EAE6FF' : 'none', background: filter === s.f ? '#F4F1FF' : 'transparent', textAlign: 'center' }}>
                        <div style={{ fontSize: 9, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>{s.lbl}</div>
                        <div style={{ fontFamily: 'Space Grotesk', fontSize: 20, fontWeight: 800, color: s.color }}>{s.num}</div>
                      </div>
                    ))}
                  </div>
                  {/* Search + filters */}
                  <div style={{ padding: '10px 12px', borderBottom: '1px solid #EAE6FF' }}>
                    <div style={{ position: 'relative', marginBottom: 8 }}>
                      <svg style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF' }} width="14" height="14" fill="none" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2"/><path d="m21 21-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                      <input placeholder="Search leads..." value={search} onChange={e => setSearch(e.target.value)}
                        style={{ width: '100%', padding: '9px 12px 9px 32px', border: '1.5px solid #EAE6FF', borderRadius: 10, fontSize: 13, fontFamily: 'DM Sans', color: '#160D35', background: '#FAFAFF', outline: 'none' }}
                        onFocus={e => e.target.style.borderColor = '#7C3AED'}
                        onBlur={e => e.target.style.borderColor = '#EAE6FF'} />
                    </div>
                    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                      {[{ f: 'all', label: `All (${stats.total})`, ac: '#7C3AED', ab: '#F4F1FF', bc: '#EAE6FF' }, { f: 'hot', label: '🔥 Hot', ac: '#EE0979', ab: '#FFF0F2', bc: '#FFB3C6' }, { f: 'warm', label: '🌡 Warm', ac: '#E85D04', ab: '#FFF8EC', bc: '#FFD166' }, { f: 'cold', label: '❄️ Cold', ac: '#1A6DB5', ab: '#EFF8FF', bc: '#93C5FD' }, { f: 'converted', label: '✅ Won', ac: '#065F46', ab: '#D1FAE5', bc: '#6EE7B7' }, { f: 'lost', label: '❌ Lost', ac: '#6B7280', ab: '#F1F5F9', bc: '#CBD5E1' }].map(item => (
                        <button key={item.f} onClick={() => setFilter(item.f)}
                          style={{ padding: '3px 10px', borderRadius: 20, border: `1.5px solid ${filter === item.f ? item.bc : '#EAE6FF'}`, background: filter === item.f ? item.ab : 'transparent', color: filter === item.f ? item.ac : '#9CA3AF', fontSize: 10, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans', transition: 'all 0.15s' }}>
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  {/* Lead list */}
                  <div style={{ flex: 1, overflowY: 'auto' }}>
                    {loading ? Array(5).fill(0).map((_, i) => (
                      <div key={i} style={{ margin: '6px 12px', height: 54, borderRadius: 11, background: 'linear-gradient(90deg,#F4F1FF 25%,#EAE6FF 50%,#F4F1FF 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite' }} />
                    )) : filtered.length === 0 ? (
                      <div style={{ padding: 40, textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>No leads found</div>
                    ) : filtered.map(lead => (
                      <div key={lead.id} onClick={() => { setSelectedLead(lead); setActiveTab('chat') }}
                        style={{ padding: '11px 14px', borderBottom: '1px solid #F0EEFF', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, background: selectedLead?.id === lead.id ? '#F4F1FF' : 'transparent', borderLeft: `3px solid ${selectedLead?.id === lead.id ? '#7C3AED' : lead.converted ? '#10B981' : 'transparent'}`, opacity: lead.status === 'lost' ? 0.65 : 1, transition: 'background 0.12s' }}
                        onMouseEnter={e => { if (selectedLead?.id !== lead.id) e.currentTarget.style.background = '#FAFAFF' }}
                        onMouseLeave={e => { if (selectedLead?.id !== lead.id) e.currentTarget.style.background = 'transparent' }}>
                        <Avatar name={lead.name} size={36} cat={lead.category} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: 13, color: '#160D35', fontFamily: 'Space Grotesk', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{lead.name || 'Unknown'}</div>
                          <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{lead.product_name} · {lead.customer_city}</div>
                          <div style={{ height: 2, background: '#EAE6FF', borderRadius: 2, marginTop: 5, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${(lead.bot_step / 9) * 100}%`, background: 'linear-gradient(90deg,#7C3AED,#4F46E5)', borderRadius: 2 }} />
                          </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3, flexShrink: 0 }}>
                          <CatBadge cat={lead.category} />
                          {lead.converted ? <span style={{ fontSize: 9, fontWeight: 800, background: '#D1FAE5', color: '#065F46', padding: '2px 7px', borderRadius: 20 }}>WON</span>
                            : lead.status === 'lost' ? <span style={{ fontSize: 9, fontWeight: 800, background: '#FEE2E2', color: '#991B1B', padding: '2px 7px', borderRadius: 20 }}>LOST</span>
                              : <span style={{ fontSize: 9, color: '#9CA3AF' }}>{timeAgo(lead.updated_at)}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Right panel */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0, background: '#F4F1FF' }}>
                  {!selectedLead ? (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, color: '#9CA3AF' }}>
                      <div style={{ width: 80, height: 80, borderRadius: 22, background: 'linear-gradient(135deg,#7C3AED,#4F46E5)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36, boxShadow: '0 8px 28px rgba(124,58,237,0.35)', animation: 'float 3s ease-in-out infinite' }}>💬</div>
                      <div style={{ fontFamily: 'Space Grotesk', fontSize: 16, fontWeight: 800, color: '#6B7280' }}>Select a lead</div>
                      <div style={{ fontSize: 13, color: '#9CA3AF' }}>Click any lead to view conversation</div>
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
                        <div style={{ background: cc.grad, padding: '20px 22px 0', flexShrink: 0, position: 'relative', overflow: 'hidden' }}>
                          <div style={{ position: 'absolute', top: -40, right: -40, width: 180, height: 180, borderRadius: '50%', background: 'rgba(255,255,255,0.08)', pointerEvents: 'none' }} />
                          <div style={{ position: 'absolute', bottom: -60, left: 60, width: 140, height: 140, borderRadius: '50%', background: 'rgba(255,255,255,0.05)', pointerEvents: 'none' }} />
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, position: 'relative' }}>
                            <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                              <div style={{ position: 'relative', flexShrink: 0 }}>
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
                              <button onClick={() => setActiveTab('chat')} style={{ padding: '8px 14px', borderRadius: 11, border: '1px solid rgba(255,255,255,0.35)', background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'DM Sans' }}
                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.28)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}>💬 Chat</button>
                              {!selectedLead.converted && selectedLead.status !== 'lost' && (
                                <button onClick={() => setActiveTab('convert')} style={{ padding: '8px 14px', borderRadius: 11, border: 'none', background: 'rgba(255,255,255,0.95)', color: '#160D35', fontSize: 12, fontWeight: 800, cursor: 'pointer', fontFamily: 'Space Grotesk', boxShadow: '0 4px 16px rgba(0,0,0,0.2)' }}
                                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.transform = 'scale(1.04)'}
                                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.transform = 'scale(1)'}>🏆 Close Deal</button>
                              )}
                            </div>
                          </div>
                          {/* Stats strip */}
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 1, background: 'rgba(255,255,255,0.15)', borderRadius: '12px 12px 0 0', overflow: 'hidden', backdropFilter: 'blur(8px)' }}>
                            {[{ icon: '💬', val: msgCount, label: 'Messages' }, { icon: '📞', val: callCount || '—', label: 'Calls' }, { icon: '📅', val: fuCount, label: 'Follow-ups' }, { icon: '📆', val: `${daysActive}d`, label: 'Active' }].map((s, i) => (
                              <div key={s.label} style={{ padding: '10px 0', textAlign: 'center', borderRight: i < 3 ? '1px solid rgba(255,255,255,0.15)' : 'none' }}>
                                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', marginBottom: 3 }}>{s.icon} {s.label}</div>
                                <div style={{ fontFamily: 'Space Grotesk', fontSize: 18, fontWeight: 800, color: '#fff' }}>{s.val}</div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Bot journey */}
                        <div style={{ background: '#fff', borderBottom: '1px solid #EAE6FF', padding: '12px 18px', flexShrink: 0 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                            <span style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Bot Journey — Step {selectedLead.bot_step}/9</span>
                            <span style={{ fontSize: 10, fontWeight: 800, color: botPct === 100 ? '#10B981' : '#7C3AED' }}>{botPct}% complete</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center' }}>
                            {botSteps.map((step, i) => (
                              <div key={i} style={{ display: 'flex', alignItems: 'center', flex: i < botSteps.length - 1 ? '0 0 auto' : 1 }}>
                                <div style={{ width: 22, height: 22, borderRadius: 11, background: i <= selectedLead.bot_step ? '#7C3AED' : '#EAE6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800, color: i <= selectedLead.bot_step ? '#fff' : '#C4B5FD', boxShadow: i === selectedLead.bot_step ? '0 0 0 3px rgba(124,58,237,0.2)' : 'none', flexShrink: 0 }}>
                                  {i < selectedLead.bot_step ? '✓' : i}
                                </div>
                                {i < botSteps.length - 1 && <div style={{ flex: 1, height: 2, background: i < selectedLead.bot_step ? '#7C3AED' : '#EAE6FF', margin: '0 2px', transition: 'background 0.3s' }} />}
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Tabs */}
                        <div style={{ display: 'flex', background: '#fff', borderBottom: '1px solid #EAE6FF', flexShrink: 0 }}>
                          {[{ id: 'chat', label: '💬', title: 'Chat', badge: msgCount }, { id: 'insights', label: '📊', title: 'Insights' }, { id: 'timeline', label: '🕐', title: 'Timeline' }, { id: 'convert', label: '🏆', title: 'Close Deal' }].map(t => (
                            <button key={t.id} onClick={() => setActiveTab(t.id as any)}
                              style={{ flex: 1, padding: '11px 8px', fontSize: 11, fontWeight: 700, color: activeTab === t.id ? '#7C3AED' : '#9CA3AF', border: 'none', background: activeTab === t.id ? '#FAFAFF' : 'transparent', cursor: 'pointer', fontFamily: 'DM Sans', borderBottom: activeTab === t.id ? '2px solid #7C3AED' : '2px solid transparent', transition: 'all 0.15s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                              <span>{t.label}</span><span>{t.title}</span>
                              {(t as any).badge > 0 && <span style={{ background: '#EDE9FE', color: '#7C3AED', borderRadius: 10, padding: '1px 6px', fontSize: 9, fontWeight: 800 }}>{(t as any).badge}</span>}
                            </button>
                          ))}
                        </div>

                        {/* Tab content */}
                        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

                          {/* ── CHAT ── */}
                          {activeTab === 'chat' && (
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                              <div style={{ padding: '8px 16px', background: '#fff', borderBottom: '1px solid #EAE6FF', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <div style={{ width: 8, height: 8, borderRadius: 4, background: '#10B981', animation: 'livePulse 1.5s infinite' }} />
                                  <span style={{ fontSize: 11, fontWeight: 600, color: '#6B7280' }}>{msgCount} messages</span>
                                </div>
                                <span style={{ fontSize: 10, color: '#C4B5FD', fontWeight: 600 }}>Kate AI · WhatsApp</span>
                              </div>
                              <div style={{ flex: 1, overflowY: 'auto', padding: '16px 14px', display: 'flex', flexDirection: 'column', gap: 10, background: '#F8F7FF' }}>
                                {msgCount === 0 && <div style={{ textAlign: 'center', color: '#C4B5FD', padding: 40, fontSize: 13 }}>No messages yet</div>}
                                {whatsappMsgs.map((msg, idx) => {
                                  const isOut = msg.direction === 'outbound' || msg.direction === 'out'
                                  const showDate = idx === 0 || new Date(whatsappMsgs[idx - 1].created_at).toDateString() !== new Date(msg.created_at).toDateString()
                                  return (
                                    <div key={msg.id}>
                                      {showDate && (
                                        <div style={{ textAlign: 'center', margin: '4px 0' }}>
                                          <span style={{ background: 'rgba(124,58,237,0.08)', color: '#9CA3AF', fontSize: 10, fontWeight: 600, padding: '3px 12px', borderRadius: 20 }}>
                                            {new Date(msg.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                                          </span>
                                        </div>
                                      )}
                                      <div style={{ display: 'flex', justifyContent: isOut ? 'flex-end' : 'flex-start', alignItems: 'flex-end', gap: 6 }}>
                                        {!isOut && (
                                          <div style={{ width: 26, height: 26, borderRadius: 8, background: 'linear-gradient(135deg,#F97316,#FBBF24)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, flexShrink: 0 }}>👤</div>
                                        )}
                                        <div style={{ maxWidth: '72%' }}>
                                          {isOut && <div style={{ fontSize: 9, color: '#C4B5FD', marginBottom: 3, textAlign: 'right', fontWeight: 600 }}>Kate AI 🤖</div>}
                                          <div style={{ padding: '10px 14px', borderRadius: isOut ? '14px 4px 14px 14px' : '4px 14px 14px 14px', background: isOut ? 'linear-gradient(135deg,#7C3AED,#4F46E5)' : '#fff', color: isOut ? '#fff' : '#160D35', fontSize: 13, lineHeight: 1.55, boxShadow: isOut ? '0 4px 14px rgba(124,58,237,0.35)' : '0 2px 8px rgba(0,0,0,0.06)', border: !isOut ? '1px solid #EAE6FF' : 'none' }}>
                                            {msg.body}
                                          </div>
                                          <div style={{ fontSize: 10, color: '#C4B5FD', marginTop: 4, textAlign: isOut ? 'right' : 'left', display: 'flex', alignItems: 'center', gap: 4, justifyContent: isOut ? 'flex-end' : 'flex-start' }}>
                                            {formatTime(msg.created_at)}
                                            {isOut && <span style={{ color: '#A78BFA' }}>✓✓</span>}
                                          </div>
                                        </div>
                                        {isOut && (
                                          <div style={{ width: 26, height: 26, borderRadius: 8, background: 'linear-gradient(135deg,#7C3AED,#4F46E5)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, flexShrink: 0 }}>🤖</div>
                                        )}
                                      </div>
                                    </div>
                                  )
                                })}
                                <div ref={chatEndRef} />
                              </div>

                              {/* ── REPLY BOX ── */}
                              <div style={{ padding: '10px 14px', background: '#fff', borderTop: '1px solid #EAE6FF', display: 'flex', gap: 8, alignItems: 'flex-end', flexShrink: 0 }}>
                                <div style={{ flex: 1, background: '#F8F7FF', border: '1.5px solid #EAE6FF', borderRadius: 14, padding: '8px 14px', display: 'flex', alignItems: 'flex-end', gap: 8, transition: 'border 0.15s' }}>
                                  <textarea
                                    value={replyText}
                                    onChange={e => setReplyText(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendReply() } }}
                                    placeholder="Type a message... (Enter to send, Shift+Enter for new line)"
                                    rows={1}
                                    style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 13, fontFamily: 'DM Sans', color: '#160D35', resize: 'none', lineHeight: 1.5, maxHeight: 100, overflowY: 'auto' }}
                                    onFocus={e => (e.target.parentElement!.style.borderColor = '#7C3AED')}
                                    onBlur={e => (e.target.parentElement!.style.borderColor = '#EAE6FF')}
                                    onInput={e => { const t = e.target as HTMLTextAreaElement; t.style.height = 'auto'; t.style.height = Math.min(t.scrollHeight, 100) + 'px' }}
                                  />
                                </div>
                                <button onClick={sendReply} disabled={sendingReply || !replyText.trim()}
                                  style={{ width: 42, height: 42, borderRadius: 13, border: 'none', background: replyText.trim() ? 'linear-gradient(135deg,#7C3AED,#4F46E5)' : '#EAE6FF', color: replyText.trim() ? '#fff' : '#C4B5FD', cursor: replyText.trim() ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0, boxShadow: replyText.trim() ? '0 4px 14px rgba(124,58,237,0.35)' : 'none', transition: 'all 0.15s' }}>
                                  {sendingReply
                                    ? <div style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: 8, animation: 'spin 0.7s linear infinite' }} />
                                    : '➤'}
                                </button>
                              </div>
                            </div>
                          )}

                          {/* ── INSIGHTS ── */}
                          {activeTab === 'insights' && (
                            <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                              <div style={{ background: '#fff', border: '1px solid #EAE6FF', borderRadius: 16, padding: 18, display: 'flex', justifyContent: 'space-around', alignItems: 'center', boxShadow: '0 2px 12px rgba(22,13,53,0.05)' }}>
                                <RadialGauge value={engScore} max={100} color="#7C3AED" size={88} label="Engagement" />
                                <RadialGauge value={selectedLead.bot_step} max={9} color={selectedLead.category === 'hot' ? '#EE0979' : selectedLead.category === 'warm' ? '#F59E0B' : '#3B82F6'} size={88} label="Qualification" />
                                <RadialGauge value={parseInt(selectedLead.units) || 1} max={10} color="#10B981" size={88} label="Deal Size" />
                              </div>
                              <div style={{ background: '#fff', border: '1px solid #EAE6FF', borderRadius: 16, padding: 18, boxShadow: '0 2px 12px rgba(22,13,53,0.05)' }}>
                                <div style={{ fontFamily: 'Space Grotesk', fontSize: 13, fontWeight: 800, color: '#160D35', marginBottom: 14 }}>📡 Lead Signals</div>
                                {[
                                  { label: 'Product Interest', val: selectedLead.product_name || '—', icon: '📦', color: '#7C3AED' },
                                  { label: 'Budget Range', val: selectedLead.budget_range?.replace('budget_', '') || '—', icon: '💰', color: '#F59E0B' },
                                  { label: 'Units Needed', val: selectedLead.units || '—', icon: '🔢', color: '#10B981' },
                                  { label: 'Usage Type', val: selectedLead.lead_cat === 'A' ? 'Home Use' : selectedLead.lead_cat === 'B' ? 'Gym/Commercial' : selectedLead.lead_cat === 'C' ? 'Corporate' : 'Dealer', icon: '🏢', color: '#4F46E5' },
                                  { label: 'Language', val: selectedLead.language || '—', icon: '🌐', color: '#EE0979' },
                                  { label: 'Location', val: selectedLead.customer_city || '—', icon: '📍', color: '#E85D04' },
                                ].map(s => (
                                  <div key={s.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid #F0EEFF' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                      <div style={{ width: 32, height: 32, borderRadius: 9, background: `${s.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>{s.icon}</div>
                                      <span style={{ fontSize: 12, color: '#6B7280', fontWeight: 500 }}>{s.label}</span>
                                    </div>
                                    <span style={{ fontSize: 13, fontWeight: 700, color: '#160D35', fontFamily: 'Space Grotesk' }}>{s.val}</span>
                                  </div>
                                ))}
                              </div>
                              <div style={{ background: '#fff', border: '1px solid #EAE6FF', borderRadius: 16, padding: 18, boxShadow: '0 2px 12px rgba(22,13,53,0.05)' }}>
                                <div style={{ fontFamily: 'Space Grotesk', fontSize: 13, fontWeight: 800, color: '#160D35', marginBottom: 10 }}>📝 Agent Notes</div>
                                <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Add your notes here..." rows={3}
                                  style={{ width: '100%', border: '1.5px solid #EAE6FF', borderRadius: 10, padding: '10px 12px', fontSize: 13, fontFamily: 'DM Sans', color: '#160D35', background: '#FAFAFF', outline: 'none', resize: 'none' }}
                                  onFocus={e => e.target.style.borderColor = '#7C3AED'}
                                  onBlur={e => e.target.style.borderColor = '#EAE6FF'} />
                                <button onClick={saveNotes} disabled={savingNotes}
                                  style={{ marginTop: 8, padding: '8px 20px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#7C3AED,#4F46E5)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'DM Sans', boxShadow: '0 4px 12px rgba(124,58,237,0.28)' }}>
                                  {savingNotes ? 'Saving...' : 'Save Notes'}
                                </button>
                              </div>
                              {/* Call recordings */}
                              {calls.map(call => (
                                <div key={call.id} style={{ background: '#fff', border: '1px solid #EAE6FF', borderRadius: 16, padding: 16, boxShadow: '0 2px 12px rgba(22,13,53,0.05)', display: 'flex', flexDirection: 'column', gap: 10 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <div style={{ width: 36, height: 36, borderRadius: 10, background: call.status === 'completed' ? '#D1FAE5' : '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>{call.status === 'completed' ? '✅' : '📞'}</div>
                                    <div style={{ flex: 1 }}>
                                      <div style={{ fontSize: 13, fontWeight: 700, fontFamily: 'Space Grotesk' }}>Kate AI Call</div>
                                      <div style={{ fontSize: 11, color: '#9CA3AF' }}>{formatTime(call.created_at)}{call.duration ? ` · ${call.duration}s` : ''}</div>
                                    </div>
                                  </div>
                                  {call.recording_url && (
                                    <div style={{ background: '#F4F1FF', borderRadius: 10, padding: '10px 12px' }}>
                                      <div style={{ fontSize: 10, fontWeight: 700, color: '#7C3AED', textTransform: 'uppercase', marginBottom: 6 }}>🎙️ Recording</div>
                                      <audio controls preload="none" style={{ width: '100%', height: 32 }}>
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

                          {/* ── TIMELINE ── */}
                          {activeTab === 'timeline' && (
                            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
                              <div style={{ fontFamily: 'Space Grotesk', fontSize: 13, fontWeight: 800, color: '#160D35', marginBottom: 16 }}>Lead Journey Timeline</div>
                              {(() => {
                                const events = [
                                  { time: selectedLead.created_at, icon: '🌱', title: 'Lead Created', desc: 'First contacted via WhatsApp', color: '#7C3AED', bg: '#EDE9FE' },
                                  ...whatsappMsgs.slice(0, 1).map(m => ({ time: m.created_at, icon: '💬', title: 'First Message', desc: m.body.slice(0, 80) + (m.body.length > 80 ? '…' : ''), color: '#4F46E5', bg: '#EEF2FF' })),
                                  ...calls.map(c => ({ time: c.created_at, icon: c.status === 'completed' ? '📞' : '📵', title: c.status === 'completed' ? `Kate Call (${Math.floor(c.duration / 60)}m ${c.duration % 60}s)` : 'Call — No Answer', desc: c.transcript ? c.transcript.slice(0, 80) + '…' : 'No transcript', color: c.status === 'completed' ? '#10B981' : '#EF4444', bg: c.status === 'completed' ? '#D1FAE5' : '#FEE2E2' })),
                                  ...followUps.map(f => ({ time: f.scheduled_at, icon: f.status === 'sent' ? '✅' : '⏳', title: `Follow-up Day ${f.day_number}`, desc: `${f.day_number === 7 && f.category === 'warm' ? 'Kate AI Call' : 'WhatsApp'} — ${f.status}`, color: f.status === 'sent' ? '#10B981' : '#F59E0B', bg: f.status === 'sent' ? '#D1FAE5' : '#FEF3C7' })),
                                  ...(selectedLead.converted ? [{ time: selectedLead.updated_at, icon: '🏆', title: 'Deal Won!', desc: `Order value: ₹${selectedLead.order_value?.toLocaleString()}`, color: '#10B981', bg: '#D1FAE5' }] : []),
                                  ...(selectedLead.status === 'lost' ? [{ time: selectedLead.updated_at, icon: '❌', title: 'Lead Lost', desc: selectedLead.lost_reason || 'No reason provided', color: '#EF4444', bg: '#FEE2E2' }] : []),
                                ].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime())

                                return events.map((ev, i) => (
                                  <div key={i} style={{ display: 'flex', gap: 14, marginBottom: 0 }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                                      <div style={{ width: 36, height: 36, borderRadius: 11, background: ev.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0, border: `2px solid ${ev.color}30`, zIndex: 1 }}>{ev.icon}</div>
                                      {i < events.length - 1 && <div style={{ width: 2, flex: 1, background: '#EAE6FF', minHeight: 20, margin: '4px 0' }} />}
                                    </div>
                                    <div style={{ flex: 1, paddingBottom: 16 }}>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                                        <div style={{ fontFamily: 'Space Grotesk', fontSize: 13, fontWeight: 700, color: '#160D35' }}>{ev.title}</div>
                                        <div style={{ fontSize: 10, color: '#C4B5FD', fontWeight: 600, flexShrink: 0, marginLeft: 8 }}>{formatTime(ev.time)}</div>
                                      </div>
                                      <div style={{ fontSize: 12, color: '#6B7280', lineHeight: 1.5, background: '#FAFAFF', border: '1px solid #EAE6FF', borderRadius: 10, padding: '8px 12px' }}>{ev.desc}</div>
                                    </div>
                                  </div>
                                ))
                              })()}
                            </div>
                          )}

                          {/* ── CLOSE DEAL ── */}
                          {activeTab === 'convert' && (
                            <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                              {selectedLead.converted ? (
                                <div style={{ background: 'linear-gradient(135deg,#11998e,#38ef7d)', borderRadius: 20, padding: 28, textAlign: 'center', boxShadow: '0 12px 40px rgba(17,153,142,0.35)' }}>
                                  <div style={{ fontSize: 52, marginBottom: 8, animation: 'float 3s ease-in-out infinite' }}>🏆</div>
                                  <div style={{ fontFamily: 'Space Grotesk', fontSize: 22, fontWeight: 800, color: '#fff', marginBottom: 4 }}>Deal Closed!</div>
                                  <div style={{ fontSize: 32, fontWeight: 800, color: '#fff', fontFamily: 'Space Grotesk', marginBottom: 4 }}>₹{selectedLead.order_value?.toLocaleString()}</div>
                                  <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)' }}>Order confirmed · {formatDate(selectedLead.updated_at)}</div>
                                </div>
                              ) : selectedLead.status === 'lost' ? (
                                <div style={{ background: 'linear-gradient(135deg,#FF416C,#FF4B2B)', borderRadius: 20, padding: 28, textAlign: 'center', boxShadow: '0 12px 40px rgba(255,65,108,0.3)' }}>
                                  <div style={{ fontSize: 52, marginBottom: 8 }}>❌</div>
                                  <div style={{ fontFamily: 'Space Grotesk', fontSize: 22, fontWeight: 800, color: '#fff', marginBottom: 4 }}>Lead Lost</div>
                                  <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)', background: 'rgba(0,0,0,0.15)', borderRadius: 10, padding: '8px 16px', display: 'inline-block' }}>{selectedLead.lost_reason || 'No reason provided'}</div>
                                </div>
                              ) : (
                                <>
                                  <div style={{ background: 'linear-gradient(135deg,#160D35,#2D1472)', borderRadius: 16, padding: 18, color: '#fff', boxShadow: '0 8px 28px rgba(22,13,53,0.25)' }}>
                                    <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>Deal Summary</div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                                      {[{ label: 'Product', val: selectedLead.product_name }, { label: 'Budget', val: selectedLead.budget_range?.replace('budget_', '') }, { label: 'Units', val: selectedLead.units }, { label: 'City', val: selectedLead.customer_city }].map(item => (
                                        <div key={item.label} style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 10, padding: '10px 12px' }}>
                                          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>{item.label}</div>
                                          <div style={{ fontSize: 13, fontWeight: 700 }}>{item.val || '—'}</div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                  <div style={{ background: '#fff', border: '1.5px solid #6EE7B7', borderRadius: 16, padding: 18, boxShadow: '0 4px 20px rgba(16,185,129,0.12)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                                      <div style={{ width: 32, height: 32, borderRadius: 9, background: '#D1FAE5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🏆</div>
                                      <div style={{ fontFamily: 'Space Grotesk', fontSize: 14, fontWeight: 800, color: '#065F46' }}>Mark as Won</div>
                                    </div>
                                    <div style={{ position: 'relative', marginBottom: 12 }}>
                                      <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontFamily: 'Space Grotesk', fontSize: 16, fontWeight: 700, color: '#9CA3AF' }}>₹</span>
                                      <input type="number" value={orderVal} onChange={e => setOrderVal(e.target.value)} placeholder="Enter order value"
                                        style={{ width: '100%', border: '1.5px solid #6EE7B7', borderRadius: 11, padding: '12px 14px 12px 28px', fontSize: 16, fontFamily: 'Space Grotesk', fontWeight: 700, color: '#160D35', background: '#F0FDF4', outline: 'none' }}
                                        onFocus={e => e.target.style.borderColor = '#10B981'}
                                        onBlur={e => e.target.style.borderColor = '#6EE7B7'} />
                                    </div>
                                    <button onClick={markWon}
                                      style={{ width: '100%', padding: '13px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,#10B981,#059669)', color: '#fff', fontSize: 14, fontWeight: 800, cursor: 'pointer', fontFamily: 'Space Grotesk', boxShadow: '0 6px 20px rgba(16,185,129,0.4)', transition: 'transform 0.15s' }}
                                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'}
                                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.transform = 'none'}>
                                      ✅ Confirm Win{orderVal ? ` · ₹${parseInt(orderVal).toLocaleString()}` : ''}
                                    </button>
                                  </div>
                                  <div style={{ background: '#fff', border: '1.5px solid #FCA5A5', borderRadius: 16, padding: 18, boxShadow: '0 4px 20px rgba(239,68,68,0.08)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                                      <div style={{ width: 32, height: 32, borderRadius: 9, background: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>❌</div>
                                      <div style={{ fontFamily: 'Space Grotesk', fontSize: 14, fontWeight: 800, color: '#991B1B' }}>Mark as Lost</div>
                                    </div>
                                    <input type="text" value={lostReason} onChange={e => setLostReason(e.target.value)} placeholder="Why was this lead lost?"
                                      style={{ width: '100%', border: '1.5px solid #FCA5A5', borderRadius: 11, padding: '11px 14px', fontSize: 13, fontFamily: 'DM Sans', color: '#160D35', background: '#FFF5F5', outline: 'none', marginBottom: 12 }}
                                      onFocus={e => e.target.style.borderColor = '#EF4444'}
                                      onBlur={e => e.target.style.borderColor = '#FCA5A5'} />
                                    <button onClick={markLost}
                                      style={{ width: '100%', padding: '11px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,#EF4444,#DC2626)', color: '#fff', fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: 'Space Grotesk', boxShadow: '0 4px 16px rgba(239,68,68,0.28)' }}
                                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'}
                                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.transform = 'none'}>
                                      ❌ Mark Lead as Lost
                                    </button>
                                  </div>
                                </>
                              )}
                            </div>
                          )}

                        </div>
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