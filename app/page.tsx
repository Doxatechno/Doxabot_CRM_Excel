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
  created_at: string
}

const getBotStepLabel = (step: number) => {
  const steps = ['New', 'Q1', 'Q2', 'Q3', 'Q4', 'Name', 'City', 'Budget', 'Units', 'Qualified']
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
    const headers = ['Name', 'Phone', 'Category', 'CAT', 'Product', 'City', 'Budget', 'Units', 'Language', 'Status', 'Created']
    const rows = leadsToExport.map(l => [
      l.name ?? '', l.phone ?? '', l.category ?? '', l.lead_cat ?? '',
      l.product_name ?? '', l.customer_city ?? '',
      l.budget_range?.replace('budget_', '') ?? '', l.units ?? '',
      l.language ?? '', l.status ?? '',
      new Date(l.created_at).toLocaleDateString('en-IN')
    ])
    const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = filename; a.click()
    URL.revokeObjectURL(url)
  }

  const navItems = [
    { id: 'dashboard', icon: '▦', label: 'Dashboard' },
    { id: 'leads', icon: '👤', label: 'Leads' },
    { id: 'calls', icon: '📞', label: 'Calls' },
    { id: 'followups', icon: '📅', label: 'Follow-ups' },
    { id: 'settings', icon: '⚙', label: 'Settings' },
  ]

  const exportOptions = [
    { label: '🔥 Hot Leads', filter: 'hot', filename: 'hot-leads.csv' },
    { label: '🌡️ Warm Leads', filter: 'warm', filename: 'warm-leads.csv' },
    { label: '❄️ Cold Leads', filter: 'cold', filename: 'cold-leads.csv' },
    { label: '🏠 CAT A Home', filter: 'catA', filename: 'cat-a.csv' },
    { label: '🏢 CAT B Gym', filter: 'catB', filename: 'cat-b.csv' },
    { label: '🏬 CAT C Corp', filter: 'catC', filename: 'cat-c.csv' },
    { label: '🤝 CAT D Dealer', filter: 'catD', filename: 'cat-d.csv' },
    { label: '✅ All Qualified', filter: 'qualified', filename: 'qualified.csv' },
    { label: '📋 All Leads', filter: 'all', filename: 'all-leads.csv' },
  ]

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Outfit:wght@300;400;500;600;700&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        :root {
          --bg: #f0f2f8;
          --surface: #ffffff;
          --surface2: #f7f8fc;
          --border: #e8eaf2;
          --accent: #4361ee;
          --accent-light: #eef0fd;
          --hot: #ef233c;
          --hot-light: #fef0f2;
          --warm: #f77f00;
          --warm-light: #fff4e6;
          --cold: #4895ef;
          --cold-light: #eef6ff;
          --green: #06d6a0;
          --green-light: #edfaf6;
          --purple: #7b2d8b;
          --purple-light: #f5eef8;
          --text: #1a1d2e;
          --text2: #6b7280;
          --text3: #9ca3af;
          --shadow: 0 2px 12px rgba(0,0,0,0.06);
          --shadow-md: 0 4px 24px rgba(0,0,0,0.09);
          --radius: 16px;
          --radius-sm: 10px;
        }
        body { background: var(--bg); color: var(--text); font-family: 'Outfit', sans-serif; overflow: hidden; }
        .app { display: flex; height: 100vh; }

        /* Sidebar */
        .sidebar {
          width: 80px; background: var(--surface);
          display: flex; flex-direction: column; align-items: center;
          padding: 24px 0; gap: 4px;
          box-shadow: var(--shadow); z-index: 10;
        }
        .logo-wrap {
          width: 48px; height: 48px; border-radius: 14px;
          background: var(--accent); display: flex; align-items: center;
          justify-content: center; font-size: 22px; margin-bottom: 24px;
          box-shadow: 0 4px 16px rgba(67,97,238,0.35);
        }
        .nav-item {
          width: 56px; border-radius: 14px; padding: 10px 0;
          display: flex; flex-direction: column; align-items: center; gap: 4px;
          cursor: pointer; transition: all 0.2s; border: none; background: transparent;
          font-family: 'Outfit', sans-serif; position: relative;
        }
        .nav-item:hover { background: var(--accent-light); }
        .nav-item.active { background: var(--accent-light); }
        .nav-icon { font-size: 18px; line-height: 1; }
        .nav-label { font-size: 9px; font-weight: 600; color: var(--text3); text-transform: uppercase; letter-spacing: 0.04em; }
        .nav-item.active .nav-label { color: var(--accent); }
        .nav-item.active .nav-icon { filter: none; }
        .nav-dot {
          position: absolute; top: 6px; right: 6px;
          width: 8px; height: 8px; border-radius: 50%;
          background: var(--hot); border: 2px solid white;
          font-size: 0;
        }

        /* Main */
        .main { flex: 1; display: flex; flex-direction: column; overflow: hidden; min-width: 0; }

        /* Topbar */
        .topbar {
          height: 68px; background: var(--surface);
          display: flex; align-items: center; padding: 0 28px; gap: 16px;
          box-shadow: var(--shadow);
        }
        .topbar-brand { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 20px; font-weight: 800; color: var(--text); }
        .topbar-sub { font-size: 13px; color: var(--text3); }
        .topbar-right { margin-left: auto; display: flex; align-items: center; gap: 12px; }

        .pill {
          display: flex; align-items: center; gap: 6px;
          padding: 6px 14px; border-radius: 30px;
          font-size: 12px; font-weight: 600; font-family: 'Outfit';
        }
        .pill-hot { background: var(--hot-light); color: var(--hot); }
        .pill-warm { background: var(--warm-light); color: var(--warm); }
        .pill-live { background: var(--green-light); color: var(--green); }
        .live-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--green); animation: pulse 1.5s infinite; }
        @keyframes pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.5; transform: scale(0.7); } }

        .btn {
          padding: 8px 18px; border-radius: 10px; border: none; cursor: pointer;
          font-family: 'Outfit'; font-size: 13px; font-weight: 600;
          transition: all 0.15s; display: flex; align-items: center; gap: 6px;
        }
        .btn-primary { background: var(--accent); color: #fff; box-shadow: 0 4px 12px rgba(67,97,238,0.3); }
        .btn-primary:hover { background: #3451d1; }
        .btn-ghost { background: var(--surface2); color: var(--text2); border: 1px solid var(--border); }
        .btn-ghost:hover { background: var(--border); }

        /* Content */
        .content { flex: 1; display: flex; overflow: hidden; background: var(--bg); }

        /* Left panel */
        .left-panel {
          width: 360px; display: flex; flex-direction: column;
          background: var(--surface); border-right: 1px solid var(--border); overflow: hidden;
        }

        /* Stats bar */
        .stats-bar {
          display: grid; grid-template-columns: repeat(4, 1fr);
          border-bottom: 1px solid var(--border);
        }
        .stat-cell {
          padding: 16px 14px; cursor: pointer; transition: background 0.15s;
          border-right: 1px solid var(--border);
        }
        .stat-cell:last-child { border-right: none; }
        .stat-cell:hover { background: var(--surface2); }
        .stat-cell.active { background: var(--accent-light); }
        .stat-num { font-family: 'Plus Jakarta Sans'; font-size: 24px; font-weight: 800; }
        .stat-lbl { font-size: 10px; font-weight: 600; color: var(--text3); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 2px; }

        /* Cat pills */
        .cat-bar { display: flex; gap: 6px; padding: 10px 14px; border-bottom: 1px solid var(--border); flex-wrap: wrap; }
        .cat-pill {
          padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: 700;
          border: 1.5px solid; cursor: pointer; transition: all 0.15s;
        }

        /* Search */
        .search-wrap { padding: 12px 14px; border-bottom: 1px solid var(--border); }
        .search-box {
          position: relative; margin-bottom: 10px;
        }
        .search-box input {
          width: 100%; padding: 9px 12px 9px 36px;
          border: 1.5px solid var(--border); border-radius: var(--radius-sm);
          font-size: 13px; font-family: 'Outfit'; color: var(--text);
          background: var(--surface2); outline: none; transition: border 0.15s;
        }
        .search-box input:focus { border-color: var(--accent); background: #fff; }
        .search-box .icon { position: absolute; left: 11px; top: 50%; transform: translateY(-50%); color: var(--text3); font-size: 15px; }
        .filter-row { display: flex; gap: 6px; }
        .filter-chip {
          padding: 4px 12px; border-radius: 20px; border: 1.5px solid var(--border);
          background: transparent; color: var(--text3); font-size: 11px; font-weight: 600;
          cursor: pointer; transition: all 0.15s; font-family: 'Outfit';
        }
        .filter-chip:hover { border-color: var(--accent); color: var(--accent); }
        .filter-chip.f-all { border-color: var(--accent); background: var(--accent-light); color: var(--accent); }
        .filter-chip.f-hot { border-color: var(--hot); background: var(--hot-light); color: var(--hot); }
        .filter-chip.f-warm { border-color: var(--warm); background: var(--warm-light); color: var(--warm); }
        .filter-chip.f-cold { border-color: var(--cold); background: var(--cold-light); color: var(--cold); }

        /* Lead list */
        .lead-list { flex: 1; overflow-y: auto; }
        .lead-list::-webkit-scrollbar { width: 3px; }
        .lead-list::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }
        .lead-row {
          padding: 14px 16px; border-bottom: 1px solid var(--border);
          cursor: pointer; transition: background 0.12s; position: relative;
          display: flex; align-items: center; gap: 12px;
        }
        .lead-row:hover { background: var(--surface2); }
        .lead-row.sel { background: var(--accent-light); border-left: 3px solid var(--accent); }
        .lead-avatar {
          width: 38px; height: 38px; border-radius: 12px; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          font-weight: 700; font-size: 15px; font-family: 'Plus Jakarta Sans';
        }
        .lead-info { flex: 1; min-width: 0; }
        .lead-name { font-weight: 600; font-size: 14px; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .lead-meta { font-size: 11px; color: var(--text3); margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .lead-badges { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; flex-shrink: 0; }

        .tag {
          font-size: 9px; font-weight: 700; padding: 2px 8px; border-radius: 20px;
          text-transform: uppercase; letter-spacing: 0.04em; white-space: nowrap;
        }
        .tag-hot { background: var(--hot-light); color: var(--hot); }
        .tag-warm { background: var(--warm-light); color: var(--warm); }
        .tag-cold { background: var(--cold-light); color: var(--cold); }
        .tag-cat { background: var(--purple-light); color: var(--purple); }
        .tag-accent { background: var(--accent-light); color: var(--accent); }

        .step-bar { height: 2px; background: var(--border); border-radius: 2px; margin-top: 6px; overflow: hidden; }
        .step-fill { height: 100%; background: linear-gradient(90deg, var(--accent), #7c3aed); border-radius: 2px; transition: width 0.4s; }

        /* Shimmer */
        .shimmer {
          background: linear-gradient(90deg, var(--surface2) 25%, var(--border) 50%, var(--surface2) 75%);
          background-size: 200% 100%; animation: shimmer 1.5s infinite;
          border-radius: var(--radius-sm); height: 58px; margin: 8px 14px;
        }
        @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

        /* Right panel */
        .right-panel { flex: 1; display: flex; flex-direction: column; overflow: hidden; min-width: 0; }

        .empty-state {
          flex: 1; display: flex; flex-direction: column;
          align-items: center; justify-content: center; gap: 12px;
          color: var(--text3);
        }
        .empty-icon {
          width: 72px; height: 72px; border-radius: 20px;
          background: var(--accent-light); display: flex; align-items: center;
          justify-content: center; font-size: 32px;
          animation: float 3s ease-in-out infinite;
        }
        @keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }

        /* Lead header */
        .lead-hdr {
          padding: 20px 24px; background: var(--surface);
          border-bottom: 1px solid var(--border);
        }
        .lead-hdr-top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; }
        .lead-hdr-name { font-family: 'Plus Jakarta Sans'; font-size: 20px; font-weight: 800; color: var(--text); }
        .lead-hdr-sub { font-size: 13px; color: var(--text3); margin-top: 2px; }
        .info-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
        .info-card {
          background: var(--surface2); border: 1px solid var(--border);
          border-radius: var(--radius-sm); padding: 8px 12px;
        }
        .info-key { font-size: 9px; font-weight: 700; color: var(--text3); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 3px; }
        .info-val { font-size: 13px; font-weight: 600; color: var(--text); }

        /* Tabs */
        .tabs { display: flex; background: var(--surface); border-bottom: 1px solid var(--border); padding: 0 4px; }
        .tab {
          padding: 14px 16px; font-size: 12px; font-weight: 600; color: var(--text3);
          border: none; background: transparent; cursor: pointer; font-family: 'Outfit';
          border-bottom: 2px solid transparent; transition: all 0.15s; white-space: nowrap;
        }
        .tab:hover { color: var(--text); }
        .tab.active { color: var(--accent); border-bottom-color: var(--accent); }

        /* Chat */
        .chat-body { flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 10px; background: var(--bg); }
        .chat-body::-webkit-scrollbar { width: 3px; }
        .chat-body::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }
        .bubble-wrap { display: flex; }
        .bubble-wrap.in { justify-content: flex-start; }
        .bubble-wrap.out { justify-content: flex-end; }
        .bubble {
          max-width: 72%; padding: 10px 14px; border-radius: 14px;
          font-size: 13px; line-height: 1.5;
        }
        .bubble.in { background: var(--surface); border: 1px solid var(--border); color: var(--text); border-radius: 4px 14px 14px 14px; box-shadow: var(--shadow); }
        .bubble.out { background: var(--accent); color: #fff; border-radius: 14px 4px 14px 14px; box-shadow: 0 4px 12px rgba(67,97,238,0.3); }
        .bubble-time { font-size: 10px; color: var(--text3); margin-top: 4px; padding: 0 4px; }

        /* Calls */
        .panel-body { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 10px; }
        .panel-body::-webkit-scrollbar { width: 3px; }
        .panel-body::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }
        .card {
          background: var(--surface); border: 1px solid var(--border);
          border-radius: var(--radius); padding: 16px; box-shadow: var(--shadow);
        }

        /* Full views */
        .full-view { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
        .full-hdr {
          padding: 20px 28px; background: var(--surface);
          border-bottom: 1px solid var(--border);
          display: flex; justify-content: space-between; align-items: center;
        }
        .full-hdr-title { font-family: 'Plus Jakarta Sans'; font-size: 18px; font-weight: 800; color: var(--text); }
        .full-body { flex: 1; overflow-y: auto; padding: 20px 28px; display: flex; flex-direction: column; gap: 10px; }
        .full-body::-webkit-scrollbar { width: 3px; }
        .full-body::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }

        /* Summary cards */
        .summary-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 4px; }
        .summary-card {
          background: var(--surface); border: 1px solid var(--border);
          border-radius: var(--radius-sm); padding: 14px 16px; box-shadow: var(--shadow);
        }
        .summary-num { font-family: 'Plus Jakarta Sans'; font-size: 26px; font-weight: 800; }
        .summary-lbl { font-size: 11px; font-weight: 600; color: var(--text3); text-transform: uppercase; margin-bottom: 4px; }

        audio::-webkit-media-controls-panel { background: var(--surface2); }
        audio { accent-color: var(--accent); border-radius: 8px; }

        /* Animations */
        @keyframes fadeUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .fade-up { animation: fadeUp 0.3s ease both; }
      `}</style>

      <div className="app" style={{ opacity: mounted ? 1 : 0, transition: 'opacity 0.4s' }}>

        {/* Sidebar */}
        <aside className="sidebar">
          <div className="logo-wrap">💬</div>
          {navItems.map(item => (
            <button key={item.id} className={`nav-item ${activeNav === item.id ? 'active' : ''}`}
              onClick={() => setActiveNav(item.id)}>
              {item.id === 'followups' && pendingFollowUps > 0 && <div className="nav-dot" />}
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
            </button>
          ))}
        </aside>

        {/* Main */}
        <div className="main">

          {/* Topbar */}
          <div className="topbar">
            <div>
              <div className="topbar-brand">DoxaBot CRM</div>
              <div className="topbar-sub">Excel Fit India · WhatsApp + AI</div>
            </div>
            <div className="topbar-right">
              {newLeadPing && <div className="pill pill-hot">🔥 New Lead!</div>}
              {pendingFollowUps > 0 && <div className="pill pill-warm">📅 {pendingFollowUps} pending</div>}

              {/* Export */}
              <div style={{ position: 'relative' }} className="export-wrapper">
                <button className="btn btn-ghost" onClick={() => setShowExport(!showExport)}>
                  ⬇️ Export
                </button>
                {showExport && (
                  <div style={{ position: 'absolute', right: 0, top: 40, background: '#fff', border: '1px solid var(--border)', borderRadius: 14, padding: 8, zIndex: 100, minWidth: 200, boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}>
                    {exportOptions.map(opt => (
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
                        style={{ width: '100%', padding: '8px 12px', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 13, color: '#1a1d2e', textAlign: 'left', borderRadius: 8, fontFamily: 'Outfit' }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#f7f8fc')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="pill pill-live">
                <div className="live-dot" /> Live
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="content">

            {/* CALLS VIEW */}
            {activeNav === 'calls' && (
              <div className="full-view">
                <div className="full-hdr">
                  <div className="full-hdr-title">📞 All Calls</div>
                  <span style={{ fontSize: 13, color: 'var(--text3)' }}>{leads.filter(l => l.status === 'called' || l.category === 'hot').length} leads</span>
                </div>
                <div className="full-body">
                  {leads.filter(l => l.status === 'called' || l.category === 'hot').map(lead => (
                    <div key={lead.id} className="card fade-up" style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                      onClick={() => { setSelectedLead(lead); setActiveNav('dashboard'); setActiveTab('calls') }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div className="lead-avatar" style={{ background: 'var(--accent-light)', color: 'var(--accent)' }}>
                          {(lead.name || 'U')[0].toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 600 }}>{lead.name || 'Unknown'}</div>
                          <div style={{ fontSize: 12, color: 'var(--text3)' }}>📱 {lead.phone} {lead.customer_city ? `• ${lead.customer_city}` : ''}</div>
                          {lead.product_name && <div style={{ fontSize: 12, color: 'var(--text3)' }}>📦 {lead.product_name}</div>}
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                        <span className={`tag tag-${lead.category || 'cold'}`}>{lead.category?.toUpperCase()}</span>
                        <span style={{ fontSize: 11, color: 'var(--text3)' }}>{formatTime(lead.updated_at)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* FOLLOW-UPS VIEW */}
            {activeNav === 'followups' && (
              <div className="full-view">
                <div className="full-hdr">
                  <div className="full-hdr-title">📅 Follow-up Pipeline</div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <div className="pill pill-warm">{allFollowUps.filter(f => f.status === 'pending').length} pending</div>
                    <div className="pill" style={{ background: 'var(--green-light)', color: 'var(--green)' }}>{allFollowUps.filter(f => f.status === 'sent').length} sent</div>
                  </div>
                </div>
                <div className="full-body">
                  {allFollowUps.length === 0 ? (
                    <div style={{ textAlign: 'center', color: 'var(--text3)', padding: 40 }}>No follow-ups yet</div>
                  ) : allFollowUps.map(fu => {
                    const lead = leads.find(l => l.phone === fu.lead_phone)
                    const isCall = fu.day_number === 7 && fu.category === 'warm'
                    const isPending = fu.status === 'pending'
                    const isSent = fu.status === 'sent'
                    return (
                      <div key={fu.id} className="card fade-up" style={{ cursor: 'pointer' }}
                        onClick={() => { if (lead) { setSelectedLead(lead); setActiveNav('dashboard'); setActiveTab('followups') } }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div style={{ display: 'flex', gap: 12 }}>
                            <div style={{ width: 38, height: 38, borderRadius: 12, background: isCall ? 'var(--accent-light)' : 'var(--purple-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
                              {isCall ? '📞' : '💬'}
                            </div>
                            <div>
                              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
                                {lead?.name || fu.lead_phone} — Day {fu.day_number}
                              </div>
                              <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
                                {isCall ? 'Kate AI Call' : 'WhatsApp Message'} • {formatDate(fu.scheduled_at)}
                              </div>
                              {lead?.product_name && <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>📦 {lead.product_name} • 📍 {lead.customer_city}</div>}
                              {fu.sent_at && <div style={{ fontSize: 11, color: 'var(--green)', marginTop: 4, fontWeight: 600 }}>✅ Sent {formatDate(fu.sent_at)}</div>}
                            </div>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
                            <span className="tag" style={{
                              background: isPending ? 'var(--warm-light)' : isSent ? 'var(--green-light)' : 'var(--hot-light)',
                              color: isPending ? 'var(--warm)' : isSent ? 'var(--green)' : 'var(--hot)'
                            }}>{fu.status.toUpperCase()}</span>
                            <span className="tag" style={{ background: fu.category === 'warm' ? 'var(--warm-light)' : 'var(--cold-light)', color: fu.category === 'warm' ? 'var(--warm)' : 'var(--cold)' }}>
                              {fu.category.toUpperCase()}
                            </span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* SETTINGS VIEW */}
            {activeNav === 'settings' && (
              <div className="full-view">
                <div className="full-hdr">
                  <div className="full-hdr-title">⚙️ System Settings</div>
                </div>
                <div className="full-body">
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
                    {[
                      { icon: '📱', label: 'WhatsApp Number', value: '+91 87540 41170', color: 'var(--green)' },
                      { icon: '🏢', label: 'Business', value: 'Excel Fit India', color: 'var(--accent)' },
                      { icon: '🤖', label: 'AI Agent', value: 'Kate — GPT-4o-mini', color: 'var(--purple)' },
                      { icon: '🕐', label: 'Calling Hours', value: '8:00 AM – 9:30 PM IST', color: 'var(--warm)' },
                      { icon: '⏰', label: 'Follow-up Cron', value: 'Daily 9:00 AM IST', color: 'var(--accent)' },
                      { icon: '🌐', label: 'Language AI', value: 'Auto — City Detection', color: 'var(--green)' },
                      { icon: '🔥', label: 'Hot Lead', value: 'Instant Kate Call', color: 'var(--hot)' },
                      { icon: '🌡️', label: 'Warm Lead', value: '5-touch + Day 7 Call', color: 'var(--warm)' },
                      { icon: '❄️', label: 'Cold Lead', value: '3-touch WhatsApp only', color: 'var(--cold)' },
                    ].map(s => (
                      <div key={s.label} className="card" style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                        <div style={{ width: 40, height: 40, borderRadius: 12, background: `${s.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
                          {s.icon}
                        </div>
                        <div>
                          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{s.label}</div>
                          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{s.value}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* MAIN LEADS VIEW */}
            {(activeNav === 'dashboard' || activeNav === 'leads') && (
              <>
                {/* Left panel */}
                <div className="left-panel">

                  {/* Stats */}
                  <div className="stats-bar">
                    {[
                      { lbl: 'Total', num: stats.total, color: 'var(--accent)', f: 'all' },
                      { lbl: '🔥 Hot', num: stats.hot, color: 'var(--hot)', f: 'hot' },
                      { lbl: '🌡 Warm', num: stats.warm, color: 'var(--warm)', f: 'warm' },
                      { lbl: '❄️ Cold', num: stats.cold, color: 'var(--cold)', f: 'cold' },
                    ].map(s => (
                      <div key={s.lbl} className={`stat-cell ${filter === s.f ? 'active' : ''}`} onClick={() => setFilter(s.f)}>
                        <div className="stat-lbl">{s.lbl}</div>
                        <div className="stat-num" style={{ color: s.color }}>{s.num}</div>
                      </div>
                    ))}
                  </div>

                  {/* CAT pills */}
                  <div className="cat-bar">
                    {[
                      { cat: 'A', label: 'Home', color: 'var(--green)', bg: 'var(--green-light)' },
                      { cat: 'B', label: 'Gym', color: 'var(--purple)', bg: 'var(--purple-light)' },
                      { cat: 'C', label: 'Corp', color: 'var(--warm)', bg: 'var(--warm-light)' },
                      { cat: 'D', label: 'Dealer', color: 'var(--hot)', bg: 'var(--hot-light)' },
                    ].map(c => (
                      <div key={c.cat} className="cat-pill" style={{ borderColor: c.color, background: c.bg, color: c.color }}>
                        CAT {c.cat} · {catStats[c.cat as keyof typeof catStats]} {c.label}
                      </div>
                    ))}
                  </div>

                  {/* Search */}
                  <div className="search-wrap">
                    <div className="search-box">
                      <span className="icon">🔍</span>
                      <input placeholder="Search name, phone, city..." value={search} onChange={e => setSearch(e.target.value)} />
                    </div>
                    <div className="filter-row">
                      {['all', 'hot', 'warm', 'cold'].map(f => (
                        <button key={f} className={`filter-chip ${filter === f ? `f-${f}` : ''}`} onClick={() => setFilter(f)}>
                          {f.charAt(0).toUpperCase() + f.slice(1)} ({f === 'all' ? stats.total : stats[f as keyof typeof stats]})
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Lead list */}
                  <div className="lead-list">
                    {loading ? (
                      Array(5).fill(0).map((_, i) => <div key={i} className="shimmer" style={{ animationDelay: `${i * 0.08}s` }} />)
                    ) : filtered.length === 0 ? (
                      <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>No leads found</div>
                    ) : filtered.map((lead, i) => {
                      const initial = (lead.name || lead.phone || 'U')[0].toUpperCase()
                      const avatarColors: any = { hot: ['var(--hot-light)', 'var(--hot)'], warm: ['var(--warm-light)', 'var(--warm)'], cold: ['var(--cold-light)', 'var(--cold)'] }
                      const [abg, afg] = avatarColors[lead.category] ?? ['var(--accent-light)', 'var(--accent)']
                      return (
                        <div key={lead.id} className={`lead-row ${selectedLead?.id === lead.id ? 'sel' : ''}`}
                          onClick={() => { setSelectedLead(lead); setActiveTab('chat') }}
                          style={{ animationDelay: `${i * 0.03}s` }}>
                          <div className="lead-avatar" style={{ background: abg, color: afg }}>{initial}</div>
                          <div className="lead-info">
                            <div className="lead-name">{lead.name || 'Unknown'}</div>
                            <div className="lead-meta">📱 {lead.phone}{lead.customer_city ? ` · ${lead.customer_city}` : ''}</div>
                            {lead.product_name && <div className="lead-meta">📦 {lead.product_name}</div>}
                            <div className="step-bar"><div className="step-fill" style={{ width: `${(lead.bot_step / 9) * 100}%` }} /></div>
                          </div>
                          <div className="lead-badges">
                            {lead.lead_cat && <span className="tag tag-cat">CAT {lead.lead_cat}</span>}
                            <span className={`tag tag-${lead.category || 'cold'}`}>{lead.category?.toUpperCase() || 'NEW'}</span>
                            <span style={{ fontSize: 10, color: 'var(--text3)' }}>{formatTime(lead.updated_at)}</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Right panel */}
                <div className="right-panel">
                  {!selectedLead ? (
                    <div className="empty-state">
                      <div className="empty-icon">💬</div>
                      <div style={{ fontFamily: 'Plus Jakarta Sans', fontSize: 16, fontWeight: 700, color: 'var(--text2)' }}>Select a lead</div>
                      <div style={{ fontSize: 13, color: 'var(--text3)' }}>Click any lead to view details</div>
                    </div>
                  ) : (
                    <>
                      {/* Lead header */}
                      <div className="lead-hdr fade-up">
                        <div className="lead-hdr-top">
                          <div>
                            <div className="lead-hdr-name">{selectedLead.name || 'Unknown'}</div>
                            <div className="lead-hdr-sub">📱 {selectedLead.phone}{selectedLead.language ? ` · 🌐 ${selectedLead.language}` : ''}</div>
                          </div>
                          <div style={{ display: 'flex', gap: 6 }}>
                            {selectedLead.lead_cat && (
                              <span className="tag tag-cat" style={{ fontSize: 11, padding: '4px 12px' }}>CAT {selectedLead.lead_cat}</span>
                            )}
                            <span className={`tag tag-${selectedLead.category || 'cold'}`} style={{ fontSize: 11, padding: '4px 12px' }}>
                              {selectedLead.category?.toUpperCase()} LEAD
                            </span>
                          </div>
                        </div>
                        <div className="info-grid">
                          {[
                            { k: 'Product', v: selectedLead.product_name },
                            { k: 'Variant', v: selectedLead.product_variant?.replace('q4_', '') },
                            { k: 'City', v: selectedLead.customer_city },
                            { k: 'Budget', v: selectedLead.budget_range?.replace('budget_', '') },
                            { k: 'Units', v: selectedLead.units },
                            { k: 'Step', v: getBotStepLabel(selectedLead.bot_step) },
                          ].filter(d => d.v).map(d => (
                            <div key={d.k} className="info-card">
                              <div className="info-key">{d.k}</div>
                              <div className="info-val">{d.v}</div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Tabs */}
                      <div className="tabs">
                        {[
                          { id: 'chat', label: '💬 WhatsApp' },
                          { id: 'calls', label: `📞 Calls (${calls.length})` },
                          { id: 'followups', label: `📅 Follow-ups (${followUps.length})` },
                          { id: 'details', label: '📊 Details' },
                        ].map(t => (
                          <button key={t.id} className={`tab ${activeTab === t.id ? 'active' : ''}`}
                            onClick={() => setActiveTab(t.id as any)}>
                            {t.label}
                          </button>
                        ))}
                      </div>

                      {/* Chat */}
                      {activeTab === 'chat' && (
                        <div className="chat-body">
                          {whatsappMessages.length === 0 ? (
                            <div style={{ textAlign: 'center', color: 'var(--text3)', padding: 40 }}>No messages yet</div>
                          ) : whatsappMessages.map((msg, i) => (
                            <div key={msg.id} className={`bubble-wrap ${msg.direction === 'inbound' ? 'in' : 'out'}`} style={{ animationDelay: `${i * 0.02}s` }}>
                              <div>
                                <div className={`bubble ${msg.direction === 'inbound' ? 'in' : 'out'}`}>{msg.body}</div>
                                <div className="bubble-time" style={{ textAlign: msg.direction === 'inbound' ? 'left' : 'right' }}>{formatTime(msg.created_at)}</div>
                              </div>
                            </div>
                          ))}
                          <div ref={chatEndRef} />
                        </div>
                      )}

                      {/* Calls */}
                      {activeTab === 'calls' && (
                        <div className="panel-body">
                          {calls.length === 0 ? (
                            <div style={{ textAlign: 'center', color: 'var(--text3)', padding: 40 }}>No calls yet</div>
                          ) : calls.map(call => (
                            <div key={call.id} className="card fade-up" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <div style={{ width: 40, height: 40, borderRadius: 12, background: call.status === 'completed' ? 'var(--green-light)' : 'var(--hot-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
                                  {call.status === 'completed' ? '✅' : '📞'}
                                </div>
                                <div style={{ flex: 1 }}>
                                  <div style={{ fontSize: 14, fontWeight: 600 }}>Kate AI Call</div>
                                  <div style={{ fontSize: 12, color: 'var(--text3)' }}>{formatTime(call.created_at)}{call.duration ? ` · ${call.duration}s` : ''}</div>
                                </div>
                                <span className="tag" style={{ background: call.status === 'completed' ? 'var(--green-light)' : 'var(--hot-light)', color: call.status === 'completed' ? 'var(--green)' : 'var(--hot)' }}>
                                  {call.status?.toUpperCase()}
                                </span>
                              </div>
                              {call.recording_url && (
                                <div style={{ background: 'var(--surface2)', borderRadius: 10, padding: '10px 12px', border: '1px solid var(--border)' }}>
                                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', marginBottom: 8 }}>🎙️ Recording</div>
                                  <audio controls preload="none" style={{ width: '100%', height: 36 }}>
                                    <source src={call.recording_url} type="audio/wav" />
                                    <source src={call.recording_url} type="audio/mpeg" />
                                  </audio>
                                </div>
                              )}
                              {call.transcript && (
                                <div style={{ background: 'var(--surface2)', borderRadius: 10, padding: '10px 12px', border: '1px solid var(--border)', maxHeight: 180, overflowY: 'auto' }}>
                                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', marginBottom: 8 }}>📝 Transcript</div>
                                  {call.transcript.split('\n').filter(Boolean).map((line, i) => {
                                    const isAI = line.startsWith('AI:')
                                    const isUser = line.startsWith('User:')
                                    return (
                                      <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6, alignItems: 'flex-start' }}>
                                        <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 6, flexShrink: 0, marginTop: 2, background: isAI ? 'var(--accent-light)' : 'var(--purple-light)', color: isAI ? 'var(--accent)' : 'var(--purple)' }}>
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
                        <div className="panel-body">
                          {followUps.length === 0 ? (
                            <div style={{ textAlign: 'center', color: 'var(--text3)', padding: 40 }}>No follow-ups scheduled</div>
                          ) : (
                            <>
                              <div className="summary-row">
                                {[
                                  { lbl: 'Total', num: followUps.length, color: 'var(--accent)' },
                                  { lbl: 'Pending', num: followUps.filter(f => f.status === 'pending').length, color: 'var(--warm)' },
                                  { lbl: 'Sent', num: followUps.filter(f => f.status === 'sent').length, color: 'var(--green)' },
                                ].map(s => (
                                  <div key={s.lbl} className="summary-card">
                                    <div className="summary-lbl">{s.lbl}</div>
                                    <div className="summary-num" style={{ color: s.color }}>{s.num}</div>
                                  </div>
                                ))}
                              </div>
                              {followUps.map(fu => {
                                const isCall = fu.day_number === 7 && fu.category === 'warm'
                                const isPending = fu.status === 'pending'
                                const isSent = fu.status === 'sent'
                                return (
                                  <div key={fu.id} className="card fade-up">
                                    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                                      <div style={{ width: 36, height: 36, borderRadius: 10, background: isCall ? 'var(--accent-light)' : 'var(--purple-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>
                                        {isCall ? '📞' : '💬'}
                                      </div>
                                      <div style={{ flex: 1 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                          <div style={{ fontSize: 13, fontWeight: 600 }}>Day {fu.day_number} — {isCall ? 'Kate Call' : 'WhatsApp'}</div>
                                          <span className="tag" style={{ background: isPending ? 'var(--warm-light)' : isSent ? 'var(--green-light)' : 'var(--hot-light)', color: isPending ? 'var(--warm)' : isSent ? 'var(--green)' : 'var(--hot)' }}>
                                            {fu.status.toUpperCase()}
                                          </span>
                                        </div>
                                        <div style={{ fontSize: 11, color: 'var(--text3)' }}>📅 {formatDate(fu.scheduled_at)}</div>
                                        {fu.sent_at && <div style={{ fontSize: 11, color: 'var(--green)', marginTop: 2, fontWeight: 600 }}>✅ {formatDate(fu.sent_at)}</div>}
                                        <div style={{ marginTop: 6 }}>
                                          <span className="tag" style={{ background: fu.category === 'warm' ? 'var(--warm-light)' : 'var(--cold-light)', color: fu.category === 'warm' ? 'var(--warm)' : 'var(--cold)' }}>
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
                        <div className="panel-body">
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                            {[
                              { k: 'Bot Step', v: getBotStepLabel(selectedLead.bot_step) },
                              { k: 'Usage Type', v: selectedLead.usage_type },
                              { k: 'Language', v: selectedLead.language },
                              { k: 'Status', v: selectedLead.status },
                              { k: 'First Contact', v: formatTime(selectedLead.created_at) },
                              { k: 'Last Activity', v: formatTime(selectedLead.updated_at) },
                              { k: 'WhatsApp Msgs', v: `${whatsappMessages.length} total` },
                              { k: 'Calls Made', v: `${calls.length} total` },
                              { k: 'Follow-ups', v: `${followUps.length} scheduled` },
                              { k: 'Category', v: `CAT ${selectedLead.lead_cat || '—'}` },
                            ].map(d => (
                              <div key={d.k} className="info-card" style={{ padding: '12px 14px' }}>
                                <div className="info-key">{d.k}</div>
                                <div className="info-val" style={{ fontSize: 14, marginTop: 4 }}>{d.v || '—'}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  )
}