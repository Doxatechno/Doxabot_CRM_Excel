'use client'
import { useEffect, useState, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type Lead = {
  id: string
  phone: string
  name: string
  last_message: string
  category: string
  lead_cat: string
  status: string
  usage_type: string
  product_name: string
  product_variant: string
  customer_city: string
  budget_range: string
  units: string
  bot_step: number
  language: string
  created_at: string
  updated_at: string
}

type Message = {
  id: string
  lead_phone: string
  direction: string
  body: string
  created_at: string
}

type Call = {
  id: string
  lead_phone: string
  status: string
  duration: number
  recording_url: string | null
  transcript: string | null
  created_at: string
}

type FollowUp = {
  id: string
  lead_phone: string
  category: string
  day_number: number
  status: string
  scheduled_at: string
  sent_at: string | null
  message: string | null
  created_at: string
}

const getBotStepLabel = (step: number) => {
  const steps = ['New', 'Q1 Done', 'Q2 Done', 'Q3 Done', 'Q4 Done', 'Q5 Done', 'Q6 Done', 'Q7 Done', 'Q8 Done', 'Qualified']
  return steps[Math.min(step, 9)] ?? 'Qualified'
}

const formatTime = (ts: string) => new Date(ts).toLocaleString('en-IN', {
  day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
})

const formatDate = (ts: string) => new Date(ts).toLocaleString('en-IN', {
  day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
})

export default function CRMDashboard() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [calls, setCalls] = useState<Call[]>([])
  const [followUps, setFollowUps] = useState<FollowUp[]>([])
  const [allFollowUps, setAllFollowUps] = useState<FollowUp[]>([])
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [activeTab, setActiveTab] = useState<'chat' | 'calls' | 'followups' | 'details'>('chat')
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [activeNav, setActiveNav] = useState('dashboard')
  const [mounted, setMounted] = useState(false)
  const [newLeadPing, setNewLeadPing] = useState(false)
  const [showExport, setShowExport] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setMounted(true)
    fetchAll()
    fetchAllFollowUps()
    const channel = supabase.channel('realtime-crm')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => {
        fetchAll()
        setNewLeadPing(true)
        setTimeout(() => setNewLeadPing(false), 3000)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'follow_ups' }, fetchAllFollowUps)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])
  useEffect(() => {
  const handleClick = (e: MouseEvent) => {
    const target = e.target as HTMLElement
    if (!target.closest('.export-wrapper')) setShowExport(false)
  }
  document.addEventListener('click', handleClick)
  return () => document.removeEventListener('click', handleClick)
}, [])

  useEffect(() => {
    if (selectedLead) {
      fetchMessages(selectedLead.phone)
      fetchCalls(selectedLead.phone)
      fetchFollowUps(selectedLead.phone)
    }
  }, [selectedLead])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

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

  const filtered = leads.filter(l => {
    const matchHWC = filter === 'all' || l.category === filter
    const matchSearch = !search ||
      l.name?.toLowerCase().includes(search.toLowerCase()) ||
      l.phone?.includes(search) ||
      l.customer_city?.toLowerCase().includes(search.toLowerCase()) ||
      l.product_name?.toLowerCase().includes(search.toLowerCase())
    return matchHWC && matchSearch
  })

  const stats = {
    total: leads.length,
    hot: leads.filter(l => l.category === 'hot').length,
    warm: leads.filter(l => l.category === 'warm').length,
    cold: leads.filter(l => l.category === 'cold').length,
    qualified: leads.filter(l => l.status === 'qualified').length,
  }

  const catStats = {
    A: leads.filter(l => l.lead_cat === 'A').length,
    B: leads.filter(l => l.lead_cat === 'B').length,
    C: leads.filter(l => l.lead_cat === 'C').length,
    D: leads.filter(l => l.lead_cat === 'D').length,
  }

  const pendingFollowUps = allFollowUps.filter(f => f.status === 'pending').length
  const whatsappMessages = messages.filter(m => !m.body?.startsWith('[Kate Call') && !m.body?.startsWith('[Follow-up'))
  function exportLeads(leadsToExport: Lead[], filename: string) {
  const headers = ['Name', 'Phone', 'Category', 'CAT', 'Product', 'Variant', 'City', 'Budget', 'Units', 'Language', 'Status', 'Bot Step', 'Created']
  const rows = leadsToExport.map(l => [
    l.name ?? '',
    l.phone ?? '',
    l.category ?? '',
    l.lead_cat ?? '',
    l.product_name ?? '',
    l.product_variant?.replace('q4_', '') ?? '',
    l.customer_city ?? '',
    l.budget_range?.replace('budget_', '') ?? '',
    l.units ?? '',
    l.language ?? '',
    l.status ?? '',
    getBotStepLabel(l.bot_step),
    new Date(l.created_at).toLocaleDateString('en-IN')
  ])
  const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

  const getStatusColor = (status: string) => {
    if (status === 'sent') return { bg: 'rgba(6,214,160,0.15)', color: '#06d6a0', border: 'rgba(6,214,160,0.3)' }
    if (status === 'pending') return { bg: 'rgba(255,159,28,0.15)', color: '#ff9f1c', border: 'rgba(255,159,28,0.3)' }
    if (status === 'failed') return { bg: 'rgba(255,77,109,0.15)', color: '#ff4d6d', border: 'rgba(255,77,109,0.3)' }
    return { bg: 'rgba(74,96,128,0.15)', color: '#4a6080', border: 'rgba(74,96,128,0.3)' }
  }

  const getDayIcon = (day: number, category: string) => {
    if (day === 7 && category === 'warm') return '📞'
    return '💬'
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:wght@300;400;500;600&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        :root {
          --bg: #070a12;
          --surface: #0d1117;
          --surface2: #131b2e;
          --border: #1e2d45;
          --accent: #00e5ff;
          --accent2: #7c3aed;
          --hot: #ff4d6d;
          --warm: #ff9f1c;
          --cold: #4cc9f0;
          --green: #06d6a0;
          --text: #e2e8f0;
          --muted: #4a6080;
        }
        body { background: var(--bg); color: var(--text); font-family: 'DM Sans', sans-serif; overflow: hidden; }
        .app { display: flex; height: 100vh; }
        .sidebar {
          width: 72px; background: var(--surface);
          border-right: 1px solid var(--border);
          display: flex; flex-direction: column; align-items: center;
          padding: 20px 0; gap: 8px; position: relative; z-index: 10;
        }
        .logo-mark {
          width: 40px; height: 40px;
          background: linear-gradient(135deg, var(--accent), var(--accent2));
          border-radius: 12px; display: flex; align-items: center; justify-content: center;
          font-size: 20px; margin-bottom: 16px;
          animation: logoPulse 3s ease-in-out infinite;
        }
        @keyframes logoPulse {
          0%, 100% { box-shadow: 0 0 20px rgba(0,229,255,0.3); }
          50% { box-shadow: 0 0 35px rgba(0,229,255,0.6), 0 0 60px rgba(124,58,237,0.3); }
        }
        .nav-btn {
          width: 44px; height: 44px; border-radius: 12px;
          border: none; cursor: pointer; display: flex; align-items: center; justify-content: center;
          font-size: 18px; transition: all 0.2s; background: transparent; color: var(--muted); position: relative;
        }
        .nav-btn:hover { background: var(--surface2); color: var(--text); }
        .nav-btn.active {
          background: linear-gradient(135deg, rgba(0,229,255,0.15), rgba(124,58,237,0.15));
          color: var(--accent); box-shadow: 0 0 0 1px rgba(0,229,255,0.3);
        }
        .nav-btn.active::before {
          content: ''; position: absolute; left: -1px; top: 50%; transform: translateY(-50%);
          width: 3px; height: 20px; background: var(--accent); border-radius: 0 3px 3px 0;
        }
        .main { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
        .topbar {
          height: 60px; background: var(--surface);
          border-bottom: 1px solid var(--border);
          display: flex; align-items: center; padding: 0 24px; gap: 16px;
        }
        .topbar-title { font-family: 'Syne', sans-serif; font-size: 18px; font-weight: 700; color: var(--text); }
        .topbar-sub { font-size: 12px; color: var(--muted); margin-left: 4px; }
        .live-indicator {
          display: flex; align-items: center; gap: 6px;
          font-size: 12px; color: var(--green);
          background: rgba(6,214,160,0.08); padding: 4px 12px; border-radius: 20px;
          border: 1px solid rgba(6,214,160,0.2);
        }
        .live-dot { width: 7px; height: 7px; background: var(--green); border-radius: 50%; animation: livePulse 1.5s ease-in-out infinite; }
        @keyframes livePulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.5; transform: scale(0.7); } }
        .content { flex: 1; display: flex; overflow: hidden; }
        .left-panel { width: 380px; display: flex; flex-direction: column; border-right: 1px solid var(--border); overflow: hidden; }
        .stats-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1px; background: var(--border); border-bottom: 1px solid var(--border); }
        .stat-box { background: var(--surface); padding: 14px 16px; cursor: pointer; transition: background 0.2s; }
        .stat-box:hover { background: var(--surface2); }
        .stat-label { font-size: 10px; color: var(--muted); font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 4px; }
        .stat-value { font-family: 'Syne', sans-serif; font-size: 22px; font-weight: 700; }
        .search-area { padding: 12px 16px; background: var(--surface); border-bottom: 1px solid var(--border); }
        .search-input {
          width: 100%; background: var(--surface2); border: 1px solid var(--border);
          border-radius: 8px; padding: 8px 12px 8px 32px; font-size: 13px; color: var(--text);
          outline: none; transition: border 0.2s; font-family: 'DM Sans', sans-serif;
        }
        .search-input:focus { border-color: var(--accent); box-shadow: 0 0 0 2px rgba(0,229,255,0.1); }
        .search-wrapper { position: relative; margin-bottom: 10px; }
        .search-icon { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: var(--muted); font-size: 14px; }
        .filter-chips { display: flex; gap: 6px; }
        .chip {
          padding: 4px 12px; border-radius: 20px; border: 1px solid var(--border);
          background: transparent; color: var(--muted); font-size: 11px; font-weight: 600;
          cursor: pointer; transition: all 0.2s; font-family: 'DM Sans', sans-serif;
        }
        .chip:hover { border-color: var(--accent); color: var(--accent); }
        .chip.active-all { background: rgba(0,229,255,0.1); border-color: var(--accent); color: var(--accent); }
        .chip.active-hot { background: rgba(255,77,109,0.15); border-color: var(--hot); color: var(--hot); }
        .chip.active-warm { background: rgba(255,159,28,0.15); border-color: var(--warm); color: var(--warm); }
        .chip.active-cold { background: rgba(76,201,240,0.15); border-color: var(--cold); color: var(--cold); }
        .lead-list { flex: 1; overflow-y: auto; }
        .lead-list::-webkit-scrollbar { width: 3px; }
        .lead-list::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }
        .lead-item {
          padding: 14px 16px; border-bottom: 1px solid var(--border);
          cursor: pointer; transition: all 0.2s; position: relative;
          animation: fadeSlideIn 0.3s ease both;
        }
        @keyframes fadeSlideIn { from { opacity: 0; transform: translateX(-10px); } to { opacity: 1; transform: translateX(0); } }
        .lead-item:hover { background: var(--surface2); }
        .lead-item.selected { background: rgba(0,229,255,0.05); }
        .lead-item::before {
          content: ''; position: absolute; left: 0; top: 0; bottom: 0;
          width: 3px; border-radius: 0 3px 3px 0;
        }
        .lead-item[data-cat="hot"]::before { background: var(--hot); }
        .lead-item[data-cat="warm"]::before { background: var(--warm); }
        .lead-item[data-cat="cold"]::before { background: var(--cold); }
        .lead-top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 4px; }
        .lead-name { font-weight: 600; font-size: 14px; color: var(--text); }
        .lead-phone { font-size: 11px; color: var(--muted); margin-bottom: 3px; }
        .lead-msg { font-size: 12px; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 220px; }
        .badges { display: flex; gap: 4px; flex-wrap: wrap; }
        .badge { font-size: 9px; font-weight: 700; padding: 2px 7px; border-radius: 20px; text-transform: uppercase; letter-spacing: 0.04em; }
        .badge-hot { background: rgba(255,77,109,0.15); color: var(--hot); border: 1px solid rgba(255,77,109,0.3); }
        .badge-warm { background: rgba(255,159,28,0.15); color: var(--warm); border: 1px solid rgba(255,159,28,0.3); }
        .badge-cold { background: rgba(76,201,240,0.15); color: var(--cold); border: 1px solid rgba(76,201,240,0.3); }
        .badge-cat { background: rgba(124,58,237,0.15); color: #a78bfa; border: 1px solid rgba(124,58,237,0.3); }
        .right-panel { flex: 1; display: flex; flex-direction: column; overflow: hidden; background: var(--bg); }
        .empty-state { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px; color: var(--muted); }
        .empty-orb {
          width: 80px; height: 80px; border-radius: 50%;
          background: radial-gradient(circle, rgba(0,229,255,0.1), transparent);
          border: 1px solid rgba(0,229,255,0.2);
          display: flex; align-items: center; justify-content: center; font-size: 36px;
          animation: orbFloat 4s ease-in-out infinite;
        }
        @keyframes orbFloat {
          0%, 100% { transform: translateY(0); box-shadow: 0 0 20px rgba(0,229,255,0.1); }
          50% { transform: translateY(-8px); box-shadow: 0 20px 40px rgba(0,229,255,0.2); }
        }
        .lead-header { padding: 20px 24px; background: var(--surface); border-bottom: 1px solid var(--border); animation: fadeIn 0.3s ease; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-5px); } to { opacity: 1; transform: translateY(0); } }
        .lead-header-top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 14px; }
        .lead-header-name { font-family: 'Syne', sans-serif; font-size: 20px; font-weight: 700; color: var(--text); }
        .lead-header-phone { font-size: 13px; color: var(--muted); margin-top: 2px; }
        .detail-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
        .detail-item { background: var(--surface2); border: 1px solid var(--border); border-radius: 8px; padding: 8px 12px; }
        .detail-key { font-size: 10px; color: var(--muted); font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 3px; }
        .detail-val { font-size: 13px; color: var(--text); font-weight: 500; }
        .tabs { display: flex; background: var(--surface); border-bottom: 1px solid var(--border); }
        .tab-btn {
          flex: 1; padding: 10px 6px; border: none; cursor: pointer;
          font-size: 11px; font-weight: 600; color: var(--muted); background: transparent;
          transition: all 0.2s; font-family: 'DM Sans', sans-serif; border-bottom: 2px solid transparent;
        }
        .tab-btn:hover { color: var(--text); }
        .tab-btn.active { color: var(--accent); border-bottom-color: var(--accent); }
        .chat-area {
          flex: 1; overflow-y: auto; padding: 20px;
          display: flex; flex-direction: column; gap: 10px; background: var(--bg);
        }
        .chat-area::-webkit-scrollbar { width: 3px; }
        .chat-area::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }
        .msg { max-width: 75%; animation: msgPop 0.2s ease both; }
        @keyframes msgPop { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        .msg.inbound { align-self: flex-start; }
        .msg.outbound { align-self: flex-end; }
        .msg-bubble { padding: 10px 14px; border-radius: 14px; font-size: 13px; line-height: 1.5; }
        .msg.inbound .msg-bubble { background: var(--surface); border: 1px solid var(--border); color: var(--text); border-radius: 4px 14px 14px 14px; }
        .msg.outbound .msg-bubble { background: linear-gradient(135deg, #00b8d9, #006fe6); color: #fff; border-radius: 14px 4px 14px 14px; box-shadow: 0 4px 15px rgba(0,111,230,0.3); }
        .msg-time { font-size: 10px; color: var(--muted); margin-top: 4px; text-align: right; padding: 0 4px; }
        .calls-area { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 12px; }
        .calls-area::-webkit-scrollbar { width: 3px; }
        .calls-area::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }
        .call-item { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 14px 16px; display: flex; align-items: center; gap: 12px; animation: fadeSlideIn 0.3s ease both; }
        .call-icon { width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 18px; flex-shrink: 0; }
        .cat-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1px; background: var(--border); border-bottom: 1px solid var(--border); }
        .cat-box { background: var(--surface); padding: 10px 14px; cursor: pointer; transition: background 0.2s; }
        .cat-box:hover { background: var(--surface2); }
        .cat-label { font-size: 10px; color: var(--muted); font-weight: 600; text-transform: uppercase; margin-bottom: 2px; }
        .cat-value { font-family: 'Syne', sans-serif; font-size: 18px; font-weight: 700; color: #a78bfa; }
        .step-bar { height: 3px; background: var(--border); border-radius: 3px; overflow: hidden; margin-top: 6px; }
        .step-fill { height: 100%; background: linear-gradient(90deg, var(--accent), var(--accent2)); border-radius: 3px; transition: width 0.5s ease; }
        .loading-shimmer {
          background: linear-gradient(90deg, var(--surface) 25%, var(--surface2) 50%, var(--surface) 75%);
          background-size: 200% 100%; animation: shimmer 1.5s infinite;
          border-radius: 8px; height: 60px; margin: 8px 16px;
        }
        @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
        audio { accent-color: var(--accent); }
        .followups-area { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 8px; }
        .followups-area::-webkit-scrollbar { width: 3px; }
        .followups-area::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }
        .followup-item { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 12px 14px; animation: fadeSlideIn 0.3s ease both; }
        .followup-timeline { display: flex; gap: 12px; align-items: flex-start; }
        .followup-dot { width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 14px; flex-shrink: 0; }
        .notification-badge {
          position: absolute; top: 6px; right: 6px;
          width: 16px; height: 16px; border-radius: 50%;
          background: var(--hot); color: #fff;
          font-size: 9px; font-weight: 700;
          display: flex; align-items: center; justify-content: center;
        }
      `}</style>

      <div className="app" style={{ opacity: mounted ? 1 : 0, transition: 'opacity 0.5s' }}>

        {/* Sidebar */}
        <aside className="sidebar">
          <div className="logo-mark">💬</div>
          {[
            { id: 'dashboard', icon: '⊞' },
            { id: 'leads', icon: '👥' },
            { id: 'calls', icon: '📞' },
            { id: 'followups', icon: '📅' },
            { id: 'settings', icon: '⚙️' },
          ].map(item => (
            <button key={item.id} className={`nav-btn ${activeNav === item.id ? 'active' : ''}`}
              onClick={() => setActiveNav(item.id)} title={item.id} style={{ position: 'relative' }}>
              {item.icon}
              {item.id === 'followups' && pendingFollowUps > 0 && (
                <div className="notification-badge">{pendingFollowUps > 9 ? '9+' : pendingFollowUps}</div>
              )}
            </button>
          ))}
        </aside>

        {/* Main */}
        <div className="main">

          {/* Topbar */}
          <div className="topbar">
            <span className="topbar-title">DoxaBot CRM</span>
            <span className="topbar-sub">/ Excel Fit India</span>
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
              {newLeadPing && (
                <div style={{ fontSize: 12, color: 'var(--hot)', background: 'rgba(255,77,109,0.1)', padding: '4px 12px', borderRadius: 20, border: '1px solid rgba(255,77,109,0.3)', animation: 'fadeIn 0.3s ease' }}>
                  🔥 New lead!
                </div>
              )}
              {pendingFollowUps > 0 && (
                <div style={{ fontSize: 12, color: 'var(--warm)', background: 'rgba(255,159,28,0.1)', padding: '4px 12px', borderRadius: 20, border: '1px solid rgba(255,159,28,0.3)' }}>
                  📅 {pendingFollowUps} follow-ups pending
                </div>
              )}
              <div style={{ position: 'relative' }} className="export-wrapper">
  <button
    onClick={() => setShowExport(!showExport)}
    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', fontSize: 12, color: 'var(--text)', fontFamily: 'DM Sans' }}>
    ⬇️ Export
  </button>
  {showExport && (
    <div style={{ position: 'absolute', right: 0, top: 36, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 8, zIndex: 100, minWidth: 180, boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
      {[
        { label: '🔥 Hot Leads', filter: 'hot', filename: 'hot-leads.csv' },
        { label: '🌡️ Warm Leads', filter: 'warm', filename: 'warm-leads.csv' },
        { label: '❄️ Cold Leads', filter: 'cold', filename: 'cold-leads.csv' },
        { label: '🏠 CAT A (Home)', filter: 'catA', filename: 'cat-a-leads.csv' },
        { label: '🏢 CAT B (Gym)', filter: 'catB', filename: 'cat-b-leads.csv' },
        { label: '🏬 CAT C (Corp)', filter: 'catC', filename: 'cat-c-leads.csv' },
        { label: '🤝 CAT D (Dealer)', filter: 'catD', filename: 'cat-d-leads.csv' },
        { label: '✅ All Qualified', filter: 'qualified', filename: 'qualified-leads.csv' },
        { label: '📋 All Leads', filter: 'all', filename: 'all-leads.csv' },
      ].map(opt => (
        <button key={opt.filter}
          onClick={() => {
            const toExport = opt.filter === 'all' ? leads
              : opt.filter === 'qualified' ? leads.filter(l => l.status === 'qualified')
              : opt.filter === 'catA' ? leads.filter(l => l.lead_cat === 'A')
              : opt.filter === 'catB' ? leads.filter(l => l.lead_cat === 'B')
              : opt.filter === 'catC' ? leads.filter(l => l.lead_cat === 'C')
              : opt.filter === 'catD' ? leads.filter(l => l.lead_cat === 'D')
              : leads.filter(l => l.category === opt.filter)
            exportLeads(toExport, opt.filename)
            setShowExport(false)
          }}
          style={{ width: '100%', padding: '8px 12px', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--text)', textAlign: 'left', borderRadius: 6, fontFamily: 'DM Sans' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface2)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
          {opt.label}
        </button>
      ))}
    </div>
  )}
</div>
              <div className="live-indicator">
                <div className="live-dot" />
                Live
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="content">

            {/* Left panel */}
            <div className="left-panel">
              <div className="stats-row">
                {[
                  { label: 'Total', value: stats.total, color: 'var(--accent)', f: 'all' },
                  { label: '🔥 Hot', value: stats.hot, color: 'var(--hot)', f: 'hot' },
                  { label: '🌡 Warm', value: stats.warm, color: 'var(--warm)', f: 'warm' },
                  { label: '❄️ Cold', value: stats.cold, color: 'var(--cold)', f: 'cold' },
                ].map(s => (
                  <div key={s.label} className="stat-box" onClick={() => setFilter(s.f)}>
                    <div className="stat-label">{s.label}</div>
                    <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
                  </div>
                ))}
              </div>

              <div className="cat-row">
                {(['A', 'B', 'C', 'D'] as const).map(cat => (
                  <div key={cat} className="cat-box">
                    <div className="cat-label">CAT {cat}</div>
                    <div className="cat-value">{catStats[cat]}</div>
                  </div>
                ))}
              </div>

              <div className="search-area">
                <div className="search-wrapper">
                  <span className="search-icon">🔍</span>
                  <input className="search-input" placeholder="Search leads..." value={search}
                    onChange={e => setSearch(e.target.value)} />
                </div>
                <div className="filter-chips">
                  {['all', 'hot', 'warm', 'cold'].map(f => (
                    <button key={f} className={`chip ${filter === f ? `active-${f}` : ''}`}
                      onClick={() => setFilter(f)}>
                      {f.charAt(0).toUpperCase() + f.slice(1)} ({f === 'all' ? stats.total : stats[f as keyof typeof stats]})
                    </button>
                  ))}
                </div>
              </div>

              <div className="lead-list">
                {loading ? (
                  Array(4).fill(0).map((_, i) => <div key={i} className="loading-shimmer" style={{ animationDelay: `${i * 0.1}s` }} />)
                ) : filtered.length === 0 ? (
                  <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>No leads found</div>
                ) : filtered.map((lead, i) => (
                  <div key={lead.id}
                    className={`lead-item ${selectedLead?.id === lead.id ? 'selected' : ''}`}
                    data-cat={lead.category}
                    onClick={() => { setSelectedLead(lead); setActiveTab('chat') }}
                    style={{ animationDelay: `${i * 0.04}s` }}>
                    <div className="lead-top">
                      <div className="lead-name">{lead.name || 'Unknown'}</div>
                      <div className="badges">
                        {lead.lead_cat && <span className="badge badge-cat">CAT {lead.lead_cat}</span>}
                        <span className={`badge badge-${lead.category || 'cold'}`}>{lead.category?.toUpperCase() || 'NEW'}</span>
                      </div>
                    </div>
                    <div className="lead-phone">📱 {lead.phone}{lead.customer_city ? ` • 📍 ${lead.customer_city}` : ''}</div>
                    {lead.product_name && <div className="lead-msg">📦 {lead.product_name}{lead.units ? ` • ${lead.units}u` : ''}</div>}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4 }}>{formatTime(lead.updated_at)}</div>
                      <div style={{ fontSize: 10, color: 'var(--muted)' }}>{getBotStepLabel(lead.bot_step)}</div>
                    </div>
                    <div className="step-bar">
                      <div className="step-fill" style={{ width: `${(lead.bot_step / 9) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right panel */}
            <div className="right-panel">
              {!selectedLead ? (
                <div className="empty-state">
                  <div className="empty-orb">💬</div>
                  <div style={{ fontFamily: 'Syne', fontSize: 16, fontWeight: 700 }}>Select a lead</div>
                  <div style={{ fontSize: 13 }}>Click any lead to view details</div>
                </div>
              ) : (
                <>
                  {/* Lead header */}
                  <div className="lead-header">
                    <div className="lead-header-top">
                      <div>
                        <div className="lead-header-name">{selectedLead.name || 'Unknown'}</div>
                        <div className="lead-header-phone">📱 {selectedLead.phone} {selectedLead.language ? `• 🌐 ${selectedLead.language}` : ''}</div>
                      </div>
                      <div className="badges" style={{ gap: 6 }}>
                        {selectedLead.lead_cat && (
                          <span className="badge badge-cat" style={{ fontSize: 11, padding: '4px 12px' }}>
                            CAT {selectedLead.lead_cat}
                          </span>
                        )}
                        <span className={`badge badge-${selectedLead.category || 'cold'}`} style={{ fontSize: 11, padding: '4px 12px' }}>
                          {selectedLead.category?.toUpperCase()} LEAD
                        </span>
                      </div>
                    </div>
                    <div className="detail-grid">
                      {[
                        { k: 'Product', v: selectedLead.product_name },
                        { k: 'Variant', v: selectedLead.product_variant?.replace('q4_', '') },
                        { k: 'City', v: selectedLead.customer_city },
                        { k: 'Budget', v: selectedLead.budget_range?.replace('budget_', '') },
                        { k: 'Units', v: selectedLead.units },
                        { k: 'Status', v: getBotStepLabel(selectedLead.bot_step) },
                      ].filter(d => d.v).map(d => (
                        <div key={d.k} className="detail-item">
                          <div className="detail-key">{d.k}</div>
                          <div className="detail-val">{d.v}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Tabs */}
                  <div className="tabs">
                    {[
                      { id: 'chat', label: '💬 Chat' },
                      { id: 'calls', label: `📞 Calls (${calls.length})` },
                      { id: 'followups', label: `📅 Follow-ups (${followUps.length})` },
                      { id: 'details', label: '📊 Details' },
                    ].map(t => (
                      <button key={t.id} className={`tab-btn ${activeTab === t.id ? 'active' : ''}`}
                        onClick={() => setActiveTab(t.id as any)}>
                        {t.label}
                      </button>
                    ))}
                  </div>

                  {/* WhatsApp Chat */}
                  {activeTab === 'chat' && (
                    <div className="chat-area">
                      {whatsappMessages.length === 0 ? (
                        <div style={{ textAlign: 'center', color: 'var(--muted)', padding: 40, fontSize: 13 }}>No WhatsApp messages yet</div>
                      ) : whatsappMessages.map((msg, i) => (
                        <div key={msg.id} className={`msg ${msg.direction}`} style={{ animationDelay: `${i * 0.03}s` }}>
                          <div className="msg-bubble">{msg.body}</div>
                          <div className="msg-time">{formatTime(msg.created_at)}</div>
                        </div>
                      ))}
                      <div ref={chatEndRef} />
                    </div>
                  )}

                  {/* Calls */}
                  {activeTab === 'calls' && (
                    <div className="calls-area">
                      {calls.length === 0 ? (
                        <div style={{ textAlign: 'center', color: 'var(--muted)', padding: 40, fontSize: 13 }}>No calls yet</div>
                      ) : calls.map(call => (
                        <div key={call.id} className="call-item" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 12 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%' }}>
                            <div className="call-icon" style={{ background: call.status === 'completed' ? 'rgba(6,214,160,0.1)' : 'rgba(255,77,109,0.1)', flexShrink: 0 }}>
                              {call.status === 'completed' ? '✅' : '📞'}
                            </div>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Kate AI Call</div>
                              <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                                {formatTime(call.created_at)}{call.duration ? ` • ${call.duration}s` : ''}
                              </div>
                            </div>
                            <span className={`badge ${call.status === 'completed' ? 'badge-cold' : 'badge-hot'}`} style={{ fontSize: 11 }}>
                              {call.status}
                            </span>
                          </div>
                          {call.recording_url && (
                            <div style={{ width: '100%', background: 'var(--surface2)', borderRadius: 10, padding: '12px 14px', border: '1px solid var(--border)' }}>
                              <div style={{ fontSize: 10, color: 'var(--accent)', fontWeight: 700, marginBottom: 8, textTransform: 'uppercase' }}>
                                🎙️ Call Recording
                              </div>
                              <audio controls preload="none" style={{ width: '100%', height: 36 }}>
                                <source src={call.recording_url} type="audio/wav" />
                                <source src={call.recording_url} type="audio/mpeg" />
                              </audio>
                            </div>
                          )}
                          {call.transcript && (
                            <div style={{ width: '100%', background: 'var(--surface2)', borderRadius: 10, padding: '12px 14px', border: '1px solid var(--border)', maxHeight: 200, overflowY: 'auto' }}>
                              <div style={{ fontSize: 10, color: 'var(--accent)', fontWeight: 700, marginBottom: 10, textTransform: 'uppercase' }}>
                                📝 Transcript
                              </div>
                              {call.transcript.split('\n').filter(Boolean).map((line, i) => {
                                const isAI = line.startsWith('AI:')
                                const isUser = line.startsWith('User:')
                                return (
                                  <div key={i} style={{ marginBottom: 8, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                                    <span style={{
                                      fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4, flexShrink: 0, marginTop: 2,
                                      background: isAI ? 'rgba(0,229,255,0.15)' : 'rgba(124,58,237,0.15)',
                                      color: isAI ? 'var(--accent)' : '#a78bfa'
                                    }}>
                                      {isAI ? 'KATE' : isUser ? 'USER' : '—'}
                                    </span>
                                    <span style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.5 }}>
                                      {line.replace(/^(AI:|User:)\s*/, '')}
                                    </span>
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Follow-ups */}
                  {activeTab === 'followups' && (
                    <div className="followups-area">
                      {followUps.length === 0 ? (
                        <div style={{ textAlign: 'center', color: 'var(--muted)', padding: 40, fontSize: 13 }}>
                          No follow-ups scheduled
                        </div>
                      ) : (
                        <>
                          {/* Summary row */}
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 8 }}>
                            {[
                              { label: 'Total', value: followUps.length, color: 'var(--accent)' },
                              { label: 'Pending', value: followUps.filter(f => f.status === 'pending').length, color: 'var(--warm)' },
                              { label: 'Sent', value: followUps.filter(f => f.status === 'sent').length, color: 'var(--green)' },
                            ].map(s => (
                              <div key={s.label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px' }}>
                                <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>{s.label}</div>
                                <div style={{ fontSize: 20, fontWeight: 700, color: s.color, fontFamily: 'Syne' }}>{s.value}</div>
                              </div>
                            ))}
                          </div>

                          {/* Timeline */}
                          {followUps.map((fu, i) => {
                            const sc = getStatusColor(fu.status)
                            const isCall = fu.day_number === 7 && fu.category === 'warm'
                            return (
                              <div key={fu.id} className="followup-item">
                                <div className="followup-timeline">
                                  <div className="followup-dot" style={{ background: isCall ? 'rgba(0,229,255,0.1)' : 'rgba(124,58,237,0.1)' }}>
                                    {getDayIcon(fu.day_number, fu.category)}
                                  </div>
                                  <div style={{ flex: 1 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                                        Day {fu.day_number} — {isCall ? 'Kate Call' : 'WhatsApp Message'}
                                      </div>
                                      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: sc.bg, color: sc.color, border: `1px solid ${sc.border}` }}>
                                        {fu.status.toUpperCase()}
                                      </span>
                                    </div>
                                    <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: fu.sent_at ? 4 : 0 }}>
                                      📅 Scheduled: {formatDate(fu.scheduled_at)}
                                    </div>
                                    {fu.sent_at && (
                                      <div style={{ fontSize: 11, color: 'var(--green)' }}>
                                        ✅ Sent: {formatDate(fu.sent_at)}
                                      </div>
                                    )}
                                    <div style={{ marginTop: 6 }}>
                                      <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: fu.category === 'warm' ? 'rgba(255,159,28,0.15)' : 'rgba(76,201,240,0.15)', color: fu.category === 'warm' ? 'var(--warm)' : 'var(--cold)', fontWeight: 600 }}>
                                        {fu.category.toUpperCase()} SEQUENCE
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                        </>
                      )}
                    </div>
                  )}

                  {/* Details */}
                  {activeTab === 'details' && (
                    <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        {[
                          { k: 'Bot Step', v: getBotStepLabel(selectedLead.bot_step) },
                          { k: 'Usage Type', v: selectedLead.usage_type },
                          { k: 'Language', v: selectedLead.language },
                          { k: 'Status', v: selectedLead.status },
                          { k: 'First Contact', v: formatTime(selectedLead.created_at) },
                          { k: 'Last Activity', v: formatTime(selectedLead.updated_at) },
                          { k: 'WhatsApp Messages', v: `${whatsappMessages.length} total` },
                          { k: 'Calls Made', v: `${calls.length} total` },
                          { k: 'Follow-ups', v: `${followUps.length} scheduled` },
                          { k: 'Category', v: `CAT ${selectedLead.lead_cat || '—'}` },
                        ].map(d => (
                          <div key={d.k} className="detail-item" style={{ padding: '12px 14px' }}>
                            <div className="detail-key">{d.k}</div>
                            <div className="detail-val" style={{ fontSize: 14, marginTop: 4 }}>{d.v || '—'}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}