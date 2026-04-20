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
  id: string
  phone: string
  name: string
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
  converted: boolean
  order_value: number
  lost_reason: string
  notes: string
  converted_at: string
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

const formatTime = (ts: string) => ts ? new Date(ts).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'
const formatDate = (ts: string) => ts ? new Date(ts).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'

export default function CRMDashboard() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [calls, setCalls] = useState<Call[]>([])
  const [followUps, setFollowUps] = useState<FollowUp[]>([])
  const [allFollowUps, setAllFollowUps] = useState<FollowUp[]>([])
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [activeTab, setActiveTab] = useState<'chat' | 'calls' | 'followups' | 'details' | 'convert'>('chat')
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [activeNav, setActiveNav] = useState('dashboard')
  const [mounted, setMounted] = useState(false)
  const [newLeadPing, setNewLeadPing] = useState(false)
  const [showExport, setShowExport] = useState(false)
  const [exportDateFrom, setExportDateFrom] = useState('')
  const [exportDateTo, setExportDateTo] = useState('')
  const [notes, setNotes] = useState('')
  const [savingNotes, setSavingNotes] = useState(false)
  const [orderValue, setOrderValue] = useState('')
  const [lostReason, setLostReason] = useState('')
  const chatEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    checkAuth()
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
      setNotes(selectedLead.notes || '')
      setOrderValue(selectedLead.order_value?.toString() || '')
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

  async function saveNotes() {
    if (!selectedLead) return
    setSavingNotes(true)
    await supabase.from('leads').update({ notes }).eq('phone', selectedLead.phone)
    setSavingNotes(false)
    fetchAll()
  }

  async function markConverted() {
    if (!selectedLead) return
    await supabase.from('leads').update({
      converted: true,
      order_value: parseInt(orderValue) || 0,
      status: 'converted',
      converted_at: new Date().toISOString()
    }).eq('phone', selectedLead.phone)
    setSelectedLead({ ...selectedLead, converted: true, order_value: parseInt(orderValue) || 0 })
    fetchAll()
    alert('✅ Lead marked as WON!')
  }

  async function markLost() {
    if (!selectedLead) return
    await supabase.from('leads').update({
      converted: false,
      lost_reason: lostReason,
      status: 'lost'
    }).eq('phone', selectedLead.phone)
    setSelectedLead({ ...selectedLead, status: 'lost' })
    fetchAll()
    alert('❌ Lead marked as Lost')
  }

  const filtered = leads.filter(l => {
    const matchHWC = filter === 'all' || l.category === filter ||
      (filter === 'converted' && l.converted) ||
      (filter === 'lost' && l.status === 'lost')
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
    converted: leads.filter(l => l.converted).length,
    lost: leads.filter(l => l.status === 'lost').length,
    revenue: leads.filter(l => l.converted).reduce((sum, l) => sum + (l.order_value || 0), 0),
  }

  const conversionRate = stats.qualified > 0 ? Math.round((stats.converted / stats.qualified) * 100) : 0

  const catStats = {
    A: leads.filter(l => l.lead_cat === 'A').length,
    B: leads.filter(l => l.lead_cat === 'B').length,
    C: leads.filter(l => l.lead_cat === 'C').length,
    D: leads.filter(l => l.lead_cat === 'D').length,
  }

  const pendingFollowUps = allFollowUps.filter(f => f.status === 'pending').length
  const whatsappMessages = messages.filter(m => !m.body?.startsWith('[Kate Call') && !m.body?.startsWith('[Follow-up'))

  function exportLeads(leadsToExport: Lead[], filename: string) {
    let data = leadsToExport
    if (exportDateFrom) data = data.filter(l => new Date(l.created_at) >= new Date(exportDateFrom))
    if (exportDateTo) data = data.filter(l => new Date(l.created_at) <= new Date(exportDateTo + 'T23:59:59'))
    const headers = ['Name', 'Phone', 'Category', 'CAT', 'Product', 'City', 'Budget', 'Units', 'Language', 'Status', 'Converted', 'Order Value', 'Notes', 'Created']
    const rows = data.map(l => [
      l.name ?? '', l.phone ?? '', l.category ?? '', l.lead_cat ?? '',
      l.product_name ?? '', l.customer_city ?? '',
      l.budget_range?.replace('budget_', '') ?? '', l.units ?? '',
      l.language ?? '', l.status ?? '',
      l.converted ? 'Yes' : 'No',
      l.order_value ? `₹${l.order_value}` : '',
      l.notes ?? '',
      new Date(l.created_at).toLocaleDateString('en-IN')
    ])
    const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = filename; a.click()
    URL.revokeObjectURL(url)
  }

  // Analytics data
  const productBreakdown = Object.entries(
    leads.reduce((acc, l) => {
      if (l.product_name) acc[l.product_name] = (acc[l.product_name] || 0) + 1
      return acc
    }, {} as Record<string, number>)
  ).sort((a, b) => b[1] - a[1]).slice(0, 6)

  const cityBreakdown = Object.entries(
    leads.reduce((acc, l) => {
      if (l.customer_city) acc[l.customer_city] = (acc[l.customer_city] || 0) + 1
      return acc
    }, {} as Record<string, number>)
  ).sort((a, b) => b[1] - a[1]).slice(0, 6)

  const languageBreakdown = Object.entries(
    leads.reduce((acc, l) => {
      if (l.language) acc[l.language] = (acc[l.language] || 0) + 1
      return acc
    }, {} as Record<string, number>)
  ).sort((a, b) => b[1] - a[1])

  const maxProduct = productBreakdown[0]?.[1] || 1
  const maxCity = cityBreakdown[0]?.[1] || 1

  const navItems = [
    { id: 'dashboard', icon: '▦', label: 'Leads' },
    { id: 'analytics', icon: '📊', label: 'Analytics' },
    { id: 'calls', icon: '📞', label: 'Calls' },
    { id: 'followups', icon: '📅', label: 'Follow-ups' },
    { id: 'settings', icon: '⚙', label: 'Settings' },
  ]

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Outfit:wght@300;400;500;600;700&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        :root {
          --bg: #f0f2f8; --surface: #ffffff; --surface2: #f7f8fc; --border: #e8eaf2;
          --accent: #4361ee; --accent-light: #eef0fd;
          --hot: #ef233c; --hot-light: #fef0f2;
          --warm: #f77f00; --warm-light: #fff4e6;
          --cold: #4895ef; --cold-light: #eef6ff;
          --green: #06d6a0; --green-light: #edfaf6;
          --purple: #7b2d8b; --purple-light: #f5eef8;
          --text: #1a1d2e; --text2: #6b7280; --text3: #9ca3af;
          --shadow: 0 2px 12px rgba(0,0,0,0.06);
          --shadow-md: 0 4px 24px rgba(0,0,0,0.09);
          --radius: 16px; --radius-sm: 10px;
        }
        body { background: var(--bg); color: var(--text); font-family: 'Outfit', sans-serif; overflow: hidden; }
        .app { display: flex; height: 100vh; }
        .sidebar { width: 80px; background: var(--surface); display: flex; flex-direction: column; align-items: center; padding: 20px 0; gap: 4px; box-shadow: var(--shadow); z-index: 10; }
        .logo-wrap { width: 52px; height: 52px; border-radius: 14px; overflow: hidden; margin-bottom: 20px; box-shadow: 0 4px 16px rgba(67,97,238,0.2); }
        .logo-wrap img { width: 100%; height: 100%; object-fit: cover; }
        .logo-fallback { width: 52px; height: 52px; border-radius: 14px; background: var(--accent); display: flex; align-items: center; justify-content: center; font-size: 22px; margin-bottom: 20px; }
        .nav-item { width: 60px; border-radius: 14px; padding: 10px 0; display: flex; flex-direction: column; align-items: center; gap: 4px; cursor: pointer; transition: all 0.2s; border: none; background: transparent; font-family: 'Outfit'; position: relative; }
        .nav-item:hover { background: var(--accent-light); }
        .nav-item.active { background: var(--accent-light); }
        .nav-icon { font-size: 18px; }
        .nav-label { font-size: 9px; font-weight: 600; color: var(--text3); text-transform: uppercase; letter-spacing: 0.04em; }
        .nav-item.active .nav-label { color: var(--accent); }
        .nav-dot { position: absolute; top: 6px; right: 6px; width: 8px; height: 8px; border-radius: 50%; background: var(--hot); border: 2px solid white; }
        .main { flex: 1; display: flex; flex-direction: column; overflow: hidden; min-width: 0; }
        .topbar { height: 64px; background: var(--surface); display: flex; align-items: center; padding: 0 24px; gap: 16px; box-shadow: var(--shadow); }
        .brand-logo { height: 36px; object-fit: contain; }
        .brand-text { display: flex; flex-direction: column; }
        .brand-name { font-family: 'Plus Jakarta Sans'; font-size: 16px; font-weight: 800; color: var(--text); }
        .brand-sub { font-size: 10px; color: var(--text3); font-weight: 500; }
        .topbar-right { margin-left: auto; display: flex; align-items: center; gap: 10px; }
        .pill { display: flex; align-items: center; gap: 6px; padding: 5px 12px; border-radius: 30px; font-size: 11px; font-weight: 600; font-family: 'Outfit'; }
        .pill-hot { background: var(--hot-light); color: var(--hot); }
        .pill-warm { background: var(--warm-light); color: var(--warm); }
        .pill-live { background: var(--green-light); color: var(--green); }
        .live-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--green); animation: pulse 1.5s infinite; }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        .btn { padding: 7px 16px; border-radius: 10px; border: none; cursor: pointer; font-family: 'Outfit'; font-size: 12px; font-weight: 600; transition: all 0.15s; display: flex; align-items: center; gap: 6px; }
        .btn-primary { background: var(--accent); color: #fff; box-shadow: 0 4px 12px rgba(67,97,238,0.3); }
        .btn-primary:hover { background: #3451d1; }
        .btn-ghost { background: var(--surface2); color: var(--text2); border: 1px solid var(--border); }
        .btn-ghost:hover { background: var(--border); }
        .btn-green { background: var(--green-light); color: var(--green); border: 1px solid rgba(6,214,160,0.3); }
        .btn-green:hover { background: rgba(6,214,160,0.2); }
        .btn-red { background: var(--hot-light); color: var(--hot); border: 1px solid rgba(239,35,60,0.3); }
        .btn-red:hover { background: rgba(239,35,60,0.15); }
        .content { flex: 1; display: flex; overflow: hidden; background: var(--bg); }
        .left-panel { width: 340px; display: flex; flex-direction: column; background: var(--surface); border-right: 1px solid var(--border); overflow: hidden; }
        .stats-bar { display: grid; grid-template-columns: repeat(4, 1fr); border-bottom: 1px solid var(--border); }
        .stat-cell { padding: 12px 10px; cursor: pointer; transition: background 0.15s; border-right: 1px solid var(--border); }
        .stat-cell:last-child { border-right: none; }
        .stat-cell:hover, .stat-cell.active { background: var(--accent-light); }
        .stat-num { font-family: 'Plus Jakarta Sans'; font-size: 20px; font-weight: 800; }
        .stat-lbl { font-size: 9px; font-weight: 600; color: var(--text3); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 2px; }
        .cat-bar { display: flex; gap: 5px; padding: 8px 12px; border-bottom: 1px solid var(--border); flex-wrap: wrap; }
        .cat-pill { padding: 3px 10px; border-radius: 20px; font-size: 10px; font-weight: 700; border: 1.5px solid; }
        .search-wrap { padding: 10px 12px; border-bottom: 1px solid var(--border); }
        .search-box { position: relative; margin-bottom: 8px; }
        .search-box input { width: 100%; padding: 8px 12px 8px 34px; border: 1.5px solid var(--border); border-radius: var(--radius-sm); font-size: 13px; font-family: 'Outfit'; color: var(--text); background: var(--surface2); outline: none; transition: border 0.15s; }
        .search-box input:focus { border-color: var(--accent); background: #fff; }
        .search-box .icon { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: var(--text3); }
        .filter-row { display: flex; gap: 5px; flex-wrap: wrap; }
        .filter-chip { padding: 3px 10px; border-radius: 20px; border: 1.5px solid var(--border); background: transparent; color: var(--text3); font-size: 10px; font-weight: 600; cursor: pointer; transition: all 0.15s; font-family: 'Outfit'; }
        .filter-chip:hover { border-color: var(--accent); color: var(--accent); }
        .f-all { border-color: var(--accent); background: var(--accent-light); color: var(--accent); }
        .f-hot { border-color: var(--hot); background: var(--hot-light); color: var(--hot); }
        .f-warm { border-color: var(--warm); background: var(--warm-light); color: var(--warm); }
        .f-cold { border-color: var(--cold); background: var(--cold-light); color: var(--cold); }
        .f-converted { border-color: var(--green); background: var(--green-light); color: var(--green); }
        .f-lost { border-color: #6b7280; background: #f3f4f6; color: #6b7280; }
        .lead-list { flex: 1; overflow-y: auto; }
        .lead-list::-webkit-scrollbar { width: 3px; }
        .lead-list::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }
        .lead-row { padding: 12px 14px; border-bottom: 1px solid var(--border); cursor: pointer; transition: background 0.12s; display: flex; align-items: center; gap: 10px; position: relative; }
        .lead-row:hover { background: var(--surface2); }
        .lead-row.sel { background: var(--accent-light); border-left: 3px solid var(--accent); }
        .lead-row.won { border-left: 3px solid var(--green); }
        .lead-row.lost { opacity: 0.6; }
        .lead-avatar { width: 36px; height: 36px; border-radius: 10px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 14px; font-family: 'Plus Jakarta Sans'; }
        .lead-info { flex: 1; min-width: 0; }
        .lead-name { font-weight: 600; font-size: 13px; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .lead-meta { font-size: 11px; color: var(--text3); margin-top: 1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .lead-badges { display: flex; flex-direction: column; align-items: flex-end; gap: 3px; flex-shrink: 0; }
        .tag { font-size: 9px; font-weight: 700; padding: 2px 7px; border-radius: 20px; text-transform: uppercase; letter-spacing: 0.04em; white-space: nowrap; }
        .tag-hot { background: var(--hot-light); color: var(--hot); }
        .tag-warm { background: var(--warm-light); color: var(--warm); }
        .tag-cold { background: var(--cold-light); color: var(--cold); }
        .tag-cat { background: var(--purple-light); color: var(--purple); }
        .tag-green { background: var(--green-light); color: var(--green); }
        .tag-gray { background: #f3f4f6; color: #6b7280; }
        .step-bar { height: 2px; background: var(--border); border-radius: 2px; margin-top: 4px; overflow: hidden; }
        .step-fill { height: 100%; background: linear-gradient(90deg, var(--accent), #7c3aed); border-radius: 2px; }
        .shimmer { background: linear-gradient(90deg, var(--surface2) 25%, var(--border) 50%, var(--surface2) 75%); background-size: 200% 100%; animation: shimmer 1.5s infinite; border-radius: var(--radius-sm); height: 54px; margin: 6px 12px; }
        @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
        .right-panel { flex: 1; display: flex; flex-direction: column; overflow: hidden; min-width: 0; }
        .empty-state { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; color: var(--text3); }
        .empty-icon { width: 64px; height: 64px; border-radius: 18px; background: var(--accent-light); display: flex; align-items: center; justify-content: center; font-size: 28px; animation: float 3s ease-in-out infinite; }
        @keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
        .lead-hdr { padding: 16px 20px; background: var(--surface); border-bottom: 1px solid var(--border); }
        .lead-hdr-top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; }
        .lead-hdr-name { font-family: 'Plus Jakarta Sans'; font-size: 18px; font-weight: 800; color: var(--text); }
        .lead-hdr-sub { font-size: 12px; color: var(--text3); margin-top: 2px; }
        .info-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
        .info-card { background: var(--surface2); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 7px 10px; }
        .info-key { font-size: 9px; font-weight: 700; color: var(--text3); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 2px; }
        .info-val { font-size: 12px; font-weight: 600; color: var(--text); }
        .tabs { display: flex; background: var(--surface); border-bottom: 1px solid var(--border); overflow-x: auto; }
        .tabs::-webkit-scrollbar { display: none; }
        .tab { padding: 12px 14px; font-size: 11px; font-weight: 600; color: var(--text3); border: none; background: transparent; cursor: pointer; font-family: 'Outfit'; border-bottom: 2px solid transparent; transition: all 0.15s; white-space: nowrap; }
        .tab:hover { color: var(--text); }
        .tab.active { color: var(--accent); border-bottom-color: var(--accent); }
        .chat-body { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 8px; background: var(--bg); }
        .chat-body::-webkit-scrollbar { width: 3px; }
        .chat-body::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }
        .bubble-wrap { display: flex; }
        .bubble-wrap.in { justify-content: flex-start; }
        .bubble-wrap.out { justify-content: flex-end; }
        .bubble { max-width: 72%; padding: 9px 13px; border-radius: 14px; font-size: 13px; line-height: 1.5; }
        .bubble.in { background: var(--surface); border: 1px solid var(--border); color: var(--text); border-radius: 4px 14px 14px 14px; box-shadow: var(--shadow); }
        .bubble.out { background: var(--accent); color: #fff; border-radius: 14px 4px 14px 14px; }
        .bubble-time { font-size: 10px; color: var(--text3); margin-top: 3px; padding: 0 4px; }
        .panel-body { flex: 1; overflow-y: auto; padding: 14px; display: flex; flex-direction: column; gap: 10px; }
        .panel-body::-webkit-scrollbar { width: 3px; }
        .panel-body::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }
        .card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 14px; box-shadow: var(--shadow); }
        .full-view { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
        .full-hdr { padding: 16px 24px; background: var(--surface); border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; }
        .full-hdr-title { font-family: 'Plus Jakarta Sans'; font-size: 17px; font-weight: 800; color: var(--text); }
        .full-body { flex: 1; overflow-y: auto; padding: 20px 24px; }
        .full-body::-webkit-scrollbar { width: 3px; }
        .full-body::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }
        .analytics-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 20px; }
        .analytics-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 18px; box-shadow: var(--shadow); }
        .analytics-num { font-family: 'Plus Jakarta Sans'; font-size: 28px; font-weight: 800; margin-bottom: 4px; }
        .analytics-lbl { font-size: 11px; font-weight: 600; color: var(--text3); text-transform: uppercase; letter-spacing: 0.05em; }
        .analytics-sub { font-size: 12px; color: var(--text3); margin-top: 4px; }
        .chart-row { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 14px; margin-bottom: 20px; }
        .chart-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 18px; box-shadow: var(--shadow); }
        .chart-title { font-size: 13px; font-weight: 700; color: var(--text); margin-bottom: 14px; }
        .bar-item { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
        .bar-label { font-size: 11px; color: var(--text2); width: 80px; flex-shrink: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-transform: capitalize; }
        .bar-track { flex: 1; height: 8px; background: var(--border); border-radius: 4px; overflow: hidden; }
        .bar-fill { height: 100%; border-radius: 4px; transition: width 0.5s; }
        .bar-num { font-size: 11px; font-weight: 700; color: var(--text2); width: 24px; text-align: right; }
        .funnel-row { display: flex; align-items: center; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid var(--border); }
        .funnel-row:last-child { border-bottom: none; }
        .funnel-label { font-size: 13px; color: var(--text2); }
        .funnel-value { font-family: 'Plus Jakarta Sans'; font-size: 16px; font-weight: 700; }
        .won-badge { background: var(--green-light); color: var(--green); padding: 2px 10px; border-radius: 20px; font-size: 11px; font-weight: 700; }
        .lost-badge { background: var(--hot-light); color: var(--hot); padding: 2px 10px; border-radius: 20px; font-size: 11px; font-weight: 700; }
        textarea { width: 100%; border: 1.5px solid var(--border); border-radius: var(--radius-sm); padding: 10px 12px; font-size: 13px; font-family: 'Outfit'; color: var(--text); background: var(--surface2); outline: none; resize: vertical; min-height: 80px; }
        textarea:focus { border-color: var(--accent); background: #fff; }
        input[type="number"], input[type="text"], input[type="date"] { width: 100%; border: 1.5px solid var(--border); border-radius: var(--radius-sm); padding: 9px 12px; font-size: 13px; font-family: 'Outfit'; color: var(--text); background: var(--surface2); outline: none; }
        input:focus { border-color: var(--accent); background: #fff; }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        .fade-up { animation: fadeUp 0.25s ease both; }
        .powered-tag { font-size: 10px; color: var(--text3); }
        .powered-tag span { color: var(--accent); font-weight: 600; }
      `}</style>

      <div className="app" style={{ opacity: mounted ? 1 : 0, transition: 'opacity 0.4s' }}>

        {/* Sidebar */}
        <aside className="sidebar">
          <div className="logo-wrap">
            <img src="/favicon.png" alt="Excel" onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
          </div>
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
            <img src="/logo.webp" className="brand-logo" alt="Excel Fit India"
              onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
            <div className="brand-text">
              <div className="brand-name">Excel Sales CRM</div>
              <div className="brand-sub powered-tag">Powered by <span>Doxa Techno Solutions</span></div>
            </div>

            <div className="topbar-right">
              {newLeadPing && <div className="pill pill-hot">🔥 New Lead!</div>}
              {pendingFollowUps > 0 && <div className="pill pill-warm">📅 {pendingFollowUps} pending</div>}

              {/* Export with date range */}
              <div style={{ position: 'relative' }} className="export-wrapper">
                <button className="btn btn-ghost" onClick={() => setShowExport(!showExport)}>⬇️ Export</button>
                {showExport && (
                  <div style={{ position: 'absolute', right: 0, top: 38, background: '#fff', border: '1px solid var(--border)', borderRadius: 14, padding: 12, zIndex: 100, minWidth: 240, boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}>
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', marginBottom: 6 }}>Date Range</div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <input type="date" value={exportDateFrom} onChange={e => setExportDateFrom(e.target.value)} style={{ flex: 1, fontSize: 11, padding: '5px 8px' }} />
                        <input type="date" value={exportDateTo} onChange={e => setExportDateTo(e.target.value)} style={{ flex: 1, fontSize: 11, padding: '5px 8px' }} />
                      </div>
                    </div>
                    <div style={{ height: 1, background: 'var(--border)', margin: '8px 0' }} />
                    {[
                      { label: '🔥 Hot Leads', f: (l: Lead) => l.category === 'hot', file: 'hot-leads.csv' },
                      { label: '🌡️ Warm Leads', f: (l: Lead) => l.category === 'warm', file: 'warm-leads.csv' },
                      { label: '❄️ Cold Leads', f: (l: Lead) => l.category === 'cold', file: 'cold-leads.csv' },
                      { label: '✅ Converted', f: (l: Lead) => l.converted === true, file: 'converted.csv' },
                      { label: '❌ Lost', f: (l: Lead) => l.status === 'lost', file: 'lost.csv' },
                      { label: '🏠 CAT A', f: (l: Lead) => l.lead_cat === 'A', file: 'cat-a.csv' },
                      { label: '🏢 CAT B', f: (l: Lead) => l.lead_cat === 'B', file: 'cat-b.csv' },
                      { label: '📋 All Leads', f: (_: Lead) => true, file: 'all-leads.csv' },
                    ].map(opt => (
                      <button key={opt.file}
                        onClick={() => { exportLeads(leads.filter(opt.f), opt.file); setShowExport(false) }}
                        style={{ width: '100%', padding: '7px 10px', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 12, color: '#1a1d2e', textAlign: 'left', borderRadius: 8, fontFamily: 'Outfit' }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#f7f8fc')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="pill pill-live"><div className="live-dot" /> Live</div>

              <button className="btn btn-ghost" style={{ fontSize: 11 }} onClick={async () => {
                await supabase.auth.signOut()
                window.location.href = '/login'
              }}>🚪 Sign Out</button>
            </div>
          </div>

          {/* Content */}
          <div className="content">

            {/* ANALYTICS VIEW */}
            {activeNav === 'analytics' && (
              <div className="full-view">
                <div className="full-hdr">
                  <div className="full-hdr-title">📊 Sales Analytics</div>
                  <div style={{ fontSize: 12, color: 'var(--text3)' }}>All time performance</div>
                </div>
                <div className="full-body">

                  {/* KPI Cards */}
                  <div className="analytics-grid">
                    {[
                      { lbl: 'Total Leads', num: stats.total, color: 'var(--accent)', sub: `${stats.qualified} qualified` },
                      { lbl: 'Converted', num: stats.converted, color: 'var(--green)', sub: `${conversionRate}% conversion rate` },
                      { lbl: 'Revenue', num: `₹${(stats.revenue / 1000).toFixed(0)}K`, color: 'var(--purple)', sub: `avg ₹${stats.converted > 0 ? Math.round(stats.revenue / stats.converted).toLocaleString() : 0} per deal` },
                      { lbl: 'Lost Leads', num: stats.lost, color: 'var(--hot)', sub: `${stats.qualified > 0 ? Math.round((stats.lost / stats.qualified) * 100) : 0}% loss rate` },
                    ].map(s => (
                      <div key={s.lbl} className="analytics-card fade-up">
                        <div className="analytics-lbl">{s.lbl}</div>
                        <div className="analytics-num" style={{ color: s.color }}>{s.num}</div>
                        <div className="analytics-sub">{s.sub}</div>
                      </div>
                    ))}
                  </div>

                  {/* Charts Row */}
                  <div className="chart-row">

                    {/* Sales Funnel */}
                    <div className="chart-card fade-up">
                      <div className="chart-title">🔽 Sales Funnel</div>
                      {[
                        { label: 'Total Leads', value: stats.total, color: 'var(--accent)' },
                        { label: 'Qualified', value: stats.qualified, color: 'var(--warm)' },
                        { label: 'Hot Leads', value: stats.hot, color: 'var(--hot)' },
                        { label: 'Converted', value: stats.converted, color: 'var(--green)' },
                        { label: 'Lost', value: stats.lost, color: '#9ca3af' },
                      ].map(f => (
                        <div key={f.label} className="funnel-row">
                          <div className="funnel-label">{f.label}</div>
                          <div className="funnel-value" style={{ color: f.color }}>{f.value}</div>
                        </div>
                      ))}
                    </div>

                    {/* Product Breakdown */}
                    <div className="chart-card fade-up">
                      <div className="chart-title">📦 Top Products</div>
                      {productBreakdown.map(([product, count]) => (
                        <div key={product} className="bar-item">
                          <div className="bar-label">{product}</div>
                          <div className="bar-track">
                            <div className="bar-fill" style={{ width: `${(count / maxProduct) * 100}%`, background: 'var(--accent)' }} />
                          </div>
                          <div className="bar-num">{count}</div>
                        </div>
                      ))}
                    </div>

                    {/* City Breakdown */}
                    <div className="chart-card fade-up">
                      <div className="chart-title">📍 Top Cities</div>
                      {cityBreakdown.map(([city, count]) => (
                        <div key={city} className="bar-item">
                          <div className="bar-label">{city}</div>
                          <div className="bar-track">
                            <div className="bar-fill" style={{ width: `${(count / maxCity) * 100}%`, background: 'var(--purple)' }} />
                          </div>
                          <div className="bar-num">{count}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Second row */}
                  <div className="chart-row">

                    {/* Category breakdown */}
                    <div className="chart-card fade-up">
                      <div className="chart-title">🏷️ Lead Categories</div>
                      {[
                        { label: 'CAT A — Home', value: catStats.A, color: 'var(--green)' },
                        { label: 'CAT B — Gym', value: catStats.B, color: 'var(--purple)' },
                        { label: 'CAT C — Corp', value: catStats.C, color: 'var(--warm)' },
                        { label: 'CAT D — Dealer', value: catStats.D, color: 'var(--hot)' },
                      ].map(c => (
                        <div key={c.label} className="bar-item">
                          <div className="bar-label">{c.label}</div>
                          <div className="bar-track">
                            <div className="bar-fill" style={{ width: `${(c.value / (stats.total || 1)) * 100}%`, background: c.color }} />
                          </div>
                          <div className="bar-num">{c.value}</div>
                        </div>
                      ))}
                    </div>

                    {/* Language breakdown */}
                    <div className="chart-card fade-up">
                      <div className="chart-title">🌐 Languages Detected</div>
                      {languageBreakdown.map(([lang, count]) => (
                        <div key={lang} className="bar-item">
                          <div className="bar-label">{lang}</div>
                          <div className="bar-track">
                            <div className="bar-fill" style={{ width: `${(count / (stats.total || 1)) * 100}%`, background: 'var(--cold)' }} />
                          </div>
                          <div className="bar-num">{count}</div>
                        </div>
                      ))}
                    </div>

                    {/* Conversion by CAT */}
                    <div className="chart-card fade-up">
                      <div className="chart-title">✅ Conversions</div>
                      {[
                        { label: '🔥 Hot → Won', total: stats.hot, won: leads.filter(l => l.category === 'hot' && l.converted).length },
                        { label: '🌡️ Warm → Won', total: stats.warm, won: leads.filter(l => l.category === 'warm' && l.converted).length },
                        { label: '❄️ Cold → Won', total: stats.cold, won: leads.filter(l => l.category === 'cold' && l.converted).length },
                      ].map(c => (
                        <div key={c.label} className="funnel-row">
                          <div className="funnel-label" style={{ fontSize: 12 }}>{c.label}</div>
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <span className="won-badge">{c.won}</span>
                            <span style={{ fontSize: 11, color: 'var(--text3)' }}>/ {c.total}</span>
                          </div>
                        </div>
                      ))}
                      <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                        <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Total Revenue</div>
                        <div style={{ fontFamily: 'Plus Jakarta Sans', fontSize: 22, fontWeight: 800, color: 'var(--green)' }}>
                          ₹{stats.revenue.toLocaleString()}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* CALLS VIEW */}
            {activeNav === 'calls' && (
              <div className="full-view">
                <div className="full-hdr">
                  <div className="full-hdr-title">📞 All Calls</div>
                  <span style={{ fontSize: 12, color: 'var(--text3)' }}>{leads.filter(l => l.status === 'called' || l.category === 'hot').length} leads called</span>
                </div>
                <div className="full-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {leads.filter(l => l.status === 'called' || l.category === 'hot').map(lead => (
                    <div key={lead.id} className="card fade-up" style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                      onClick={() => { setSelectedLead(lead); setActiveNav('dashboard'); setActiveTab('calls') }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--accent-light)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14 }}>
                          {(lead.name || 'U')[0].toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 600 }}>{lead.name || 'Unknown'}</div>
                          <div style={{ fontSize: 12, color: 'var(--text3)' }}>📱 {lead.phone} {lead.customer_city ? `• ${lead.customer_city}` : ''}</div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <span className={`tag tag-${lead.category || 'cold'}`}>{lead.category?.toUpperCase()}</span>
                        {lead.converted && <span className="tag tag-green">WON</span>}
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
                <div className="full-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
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
                            <div style={{ width: 36, height: 36, borderRadius: 10, background: isCall ? 'var(--accent-light)' : 'var(--purple-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>
                              {isCall ? '📞' : '💬'}
                            </div>
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 600 }}>{lead?.name || fu.lead_phone} — Day {fu.day_number}</div>
                              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{isCall ? 'Kate AI Call' : 'WhatsApp'} • {formatDate(fu.scheduled_at)}</div>
                              {lead?.product_name && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>📦 {lead.product_name} • 📍 {lead.customer_city}</div>}
                            </div>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
                            <span className="tag" style={{ background: isPending ? 'var(--warm-light)' : isSent ? 'var(--green-light)' : 'var(--hot-light)', color: isPending ? 'var(--warm)' : isSent ? 'var(--green)' : 'var(--hot)' }}>
                              {fu.status.toUpperCase()}
                            </span>
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
                  <div className="full-hdr-title">⚙️ System Configuration</div>
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
                          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', marginBottom: 4 }}>{s.label}</div>
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
                <div className="left-panel">
                  <div className="stats-bar">
                    {[
                      { lbl: 'Total', num: stats.total, color: 'var(--accent)', f: 'all' },
                      { lbl: '🔥 Hot', num: stats.hot, color: 'var(--hot)', f: 'hot' },
                      { lbl: '🌡 Warm', num: stats.warm, color: 'var(--warm)', f: 'warm' },
                      { lbl: '✅ Won', num: stats.converted, color: 'var(--green)', f: 'converted' },
                    ].map(s => (
                      <div key={s.lbl} className={`stat-cell ${filter === s.f ? 'active' : ''}`} onClick={() => setFilter(s.f)}>
                        <div className="stat-lbl">{s.lbl}</div>
                        <div className="stat-num" style={{ color: s.color }}>{s.num}</div>
                      </div>
                    ))}
                  </div>

                  <div className="cat-bar">
                    {[
                      { cat: 'A', label: 'Home', color: 'var(--green)' },
                      { cat: 'B', label: 'Gym', color: 'var(--purple)' },
                      { cat: 'C', label: 'Corp', color: 'var(--warm)' },
                      { cat: 'D', label: 'Dealer', color: 'var(--hot)' },
                    ].map(c => (
                      <div key={c.cat} className="cat-pill" style={{ borderColor: c.color, background: `${c.color}15`, color: c.color }}>
                        {c.cat}·{catStats[c.cat as keyof typeof catStats]} {c.label}
                      </div>
                    ))}
                  </div>

                  <div className="search-wrap">
                    <div className="search-box">
                      <span className="icon">🔍</span>
                      <input placeholder="Search leads..." value={search} onChange={e => setSearch(e.target.value)} />
                    </div>
                    <div className="filter-row">
                      {[
                        { f: 'all', label: `All (${stats.total})` },
                        { f: 'hot', label: `🔥 Hot` },
                        { f: 'warm', label: `🌡 Warm` },
                        { f: 'cold', label: `❄️ Cold` },
                        { f: 'converted', label: `✅ Won` },
                        { f: 'lost', label: `❌ Lost` },
                      ].map(item => (
                        <button key={item.f} className={`filter-chip ${filter === item.f ? `f-${item.f}` : ''}`}
                          onClick={() => setFilter(item.f)}>
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="lead-list">
                    {loading ? (
                      Array(5).fill(0).map((_, i) => <div key={i} className="shimmer" style={{ animationDelay: `${i * 0.08}s` }} />)
                    ) : filtered.length === 0 ? (
                      <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>No leads found</div>
                    ) : filtered.map((lead) => {
                      const initial = (lead.name || lead.phone || 'U')[0].toUpperCase()
                      const avatarColors: any = {
                        hot: ['var(--hot-light)', 'var(--hot)'],
                        warm: ['var(--warm-light)', 'var(--warm)'],
                        cold: ['var(--cold-light)', 'var(--cold)']
                      }
                      const [abg, afg] = avatarColors[lead.category] ?? ['var(--accent-light)', 'var(--accent)']
                      return (
                        <div key={lead.id}
                          className={`lead-row ${selectedLead?.id === lead.id ? 'sel' : ''} ${lead.converted ? 'won' : ''} ${lead.status === 'lost' ? 'lost' : ''}`}
                          onClick={() => { setSelectedLead(lead); setActiveTab('chat') }}>
                          <div className="lead-avatar" style={{ background: abg, color: afg }}>{initial}</div>
                          <div className="lead-info">
                            <div className="lead-name">{lead.name || 'Unknown'}</div>
                            <div className="lead-meta">📱 {lead.phone}{lead.customer_city ? ` · ${lead.customer_city}` : ''}</div>
                            {lead.product_name && <div className="lead-meta">📦 {lead.product_name}</div>}
                            <div className="step-bar"><div className="step-fill" style={{ width: `${(lead.bot_step / 9) * 100}%` }} /></div>
                          </div>
                          <div className="lead-badges">
                            {lead.converted && <span className="tag tag-green">WON</span>}
                            {lead.status === 'lost' && <span className="tag tag-gray">LOST</span>}
                            {!lead.converted && lead.status !== 'lost' && (
                              <>
                                {lead.lead_cat && <span className="tag tag-cat">CAT {lead.lead_cat}</span>}
                                <span className={`tag tag-${lead.category || 'cold'}`}>{lead.category?.toUpperCase() || 'NEW'}</span>
                              </>
                            )}
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
                      <div style={{ fontFamily: 'Plus Jakarta Sans', fontSize: 15, fontWeight: 700, color: 'var(--text2)' }}>Select a lead</div>
                      <div style={{ fontSize: 13, color: 'var(--text3)' }}>Click any lead to view details</div>
                    </div>
                  ) : (
                    <>
                      <div className="lead-hdr fade-up">
                        <div className="lead-hdr-top">
                          <div>
                            <div className="lead-hdr-name">
                              {selectedLead.converted && '✅ '}{selectedLead.status === 'lost' && '❌ '}
                              {selectedLead.name || 'Unknown'}
                              {selectedLead.converted && selectedLead.order_value ? ` — ₹${selectedLead.order_value.toLocaleString()}` : ''}
                            </div>
                            <div className="lead-hdr-sub">📱 {selectedLead.phone}{selectedLead.language ? ` · 🌐 ${selectedLead.language}` : ''}</div>
                          </div>
                          <div style={{ display: 'flex', gap: 5 }}>
                            {selectedLead.lead_cat && <span className="tag tag-cat" style={{ fontSize: 10, padding: '3px 10px' }}>CAT {selectedLead.lead_cat}</span>}
                            <span className={`tag tag-${selectedLead.category || 'cold'}`} style={{ fontSize: 10, padding: '3px 10px' }}>{selectedLead.category?.toUpperCase()}</span>
                            {selectedLead.converted && <span className="tag tag-green" style={{ fontSize: 10, padding: '3px 10px' }}>WON</span>}
                            {selectedLead.status === 'lost' && <span className="tag tag-gray" style={{ fontSize: 10, padding: '3px 10px' }}>LOST</span>}
                          </div>
                        </div>
                        <div className="info-grid">
                          {[
                            { k: 'Product', v: selectedLead.product_name },
                            { k: 'City', v: selectedLead.customer_city },
                            { k: 'Budget', v: selectedLead.budget_range?.replace('budget_', '') },
                            { k: 'Variant', v: selectedLead.product_variant?.replace('q4_', '') },
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

                      <div className="tabs">
                        {[
                          { id: 'chat', label: '💬 Chat' },
                          { id: 'calls', label: `📞 Calls (${calls.length})` },
                          { id: 'followups', label: `📅 Follow-ups (${followUps.length})` },
                          { id: 'convert', label: selectedLead.converted ? '✅ Won' : '💰 Convert' },
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
                            <div key={msg.id} className={`bubble-wrap ${msg.direction === 'inbound' ? 'in' : 'out'}`}>
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
                            <div key={call.id} className="card fade-up" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <div style={{ width: 36, height: 36, borderRadius: 10, background: call.status === 'completed' ? 'var(--green-light)' : 'var(--hot-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>
                                  {call.status === 'completed' ? '✅' : '📞'}
                                </div>
                                <div style={{ flex: 1 }}>
                                  <div style={{ fontSize: 13, fontWeight: 600 }}>Kate AI Call</div>
                                  <div style={{ fontSize: 11, color: 'var(--text3)' }}>{formatTime(call.created_at)}{call.duration ? ` · ${call.duration}s` : ''}</div>
                                </div>
                                <span className="tag" style={{ background: call.status === 'completed' ? 'var(--green-light)' : 'var(--hot-light)', color: call.status === 'completed' ? 'var(--green)' : 'var(--hot)' }}>
                                  {call.status?.toUpperCase()}
                                </span>
                              </div>
                              {call.recording_url && (
                                <div style={{ background: 'var(--surface2)', borderRadius: 8, padding: '10px 12px', border: '1px solid var(--border)' }}>
                                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', marginBottom: 6 }}>🎙️ Recording</div>
                                  <audio controls preload="none" style={{ width: '100%', height: 32 }}>
                                    <source src={call.recording_url} type="audio/wav" />
                                    <source src={call.recording_url} type="audio/mpeg" />
                                  </audio>
                                </div>
                              )}
                              {call.transcript && (
                                <div style={{ background: 'var(--surface2)', borderRadius: 8, padding: '10px 12px', border: '1px solid var(--border)', maxHeight: 160, overflowY: 'auto' }}>
                                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', marginBottom: 6 }}>📝 Transcript</div>
                                  {call.transcript.split('\n').filter(Boolean).map((line, i) => {
                                    const isAI = line.startsWith('AI:')
                                    return (
                                      <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 5, alignItems: 'flex-start' }}>
                                        <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4, flexShrink: 0, background: isAI ? 'var(--accent-light)' : 'var(--purple-light)', color: isAI ? 'var(--accent)' : 'var(--purple)' }}>
                                          {isAI ? 'KATE' : 'USER'}
                                        </span>
                                        <span style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.4 }}>{line.replace(/^(AI:|User:)\s*/, '')}</span>
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
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 4 }}>
                                {[
                                  { lbl: 'Total', num: followUps.length, color: 'var(--accent)' },
                                  { lbl: 'Pending', num: followUps.filter(f => f.status === 'pending').length, color: 'var(--warm)' },
                                  { lbl: 'Sent', num: followUps.filter(f => f.status === 'sent').length, color: 'var(--green)' },
                                ].map(s => (
                                  <div key={s.lbl} className="card" style={{ padding: '10px 12px' }}>
                                    <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', marginBottom: 3 }}>{s.lbl}</div>
                                    <div style={{ fontFamily: 'Plus Jakarta Sans', fontSize: 22, fontWeight: 800, color: s.color }}>{s.num}</div>
                                  </div>
                                ))}
                              </div>
                              {followUps.map(fu => {
                                const isCall = fu.day_number === 7 && fu.category === 'warm'
                                const isPending = fu.status === 'pending'
                                const isSent = fu.status === 'sent'
                                return (
                                  <div key={fu.id} className="card fade-up">
                                    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                                      <div style={{ width: 32, height: 32, borderRadius: 8, background: isCall ? 'var(--accent-light)' : 'var(--purple-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>
                                        {isCall ? '📞' : '💬'}
                                      </div>
                                      <div style={{ flex: 1 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                                          <div style={{ fontSize: 13, fontWeight: 600 }}>Day {fu.day_number} — {isCall ? 'Kate Call' : 'WhatsApp'}</div>
                                          <span className="tag" style={{ background: isPending ? 'var(--warm-light)' : isSent ? 'var(--green-light)' : 'var(--hot-light)', color: isPending ? 'var(--warm)' : isSent ? 'var(--green)' : 'var(--hot)' }}>
                                            {fu.status.toUpperCase()}
                                          </span>
                                        </div>
                                        <div style={{ fontSize: 11, color: 'var(--text3)' }}>📅 {formatDate(fu.scheduled_at)}</div>
                                        {fu.sent_at && <div style={{ fontSize: 11, color: 'var(--green)', marginTop: 2 }}>✅ {formatDate(fu.sent_at)}</div>}
                                      </div>
                                    </div>
                                  </div>
                                )
                              })}
                            </>
                          )}
                        </div>
                      )}

                      {/* Convert Tab */}
                      {activeTab === 'convert' && (
                        <div className="panel-body">
                          {selectedLead.converted ? (
                            <div className="card fade-up" style={{ textAlign: 'center', padding: 32 }}>
                              <div style={{ fontSize: 48, marginBottom: 12 }}>🎉</div>
                              <div style={{ fontFamily: 'Plus Jakarta Sans', fontSize: 20, fontWeight: 800, color: 'var(--green)', marginBottom: 8 }}>Lead Converted!</div>
                              <div style={{ fontSize: 14, color: 'var(--text2)', marginBottom: 16 }}>Order Value: <strong>₹{selectedLead.order_value?.toLocaleString()}</strong></div>
                              <div style={{ fontSize: 12, color: 'var(--text3)' }}>Converted: {formatDate(selectedLead.converted_at)}</div>
                            </div>
                          ) : selectedLead.status === 'lost' ? (
                            <div className="card fade-up" style={{ textAlign: 'center', padding: 32 }}>
                              <div style={{ fontSize: 48, marginBottom: 12 }}>❌</div>
                              <div style={{ fontFamily: 'Plus Jakarta Sans', fontSize: 20, fontWeight: 800, color: 'var(--hot)', marginBottom: 8 }}>Lead Lost</div>
                              <div style={{ fontSize: 14, color: 'var(--text2)' }}>Reason: {selectedLead.lost_reason || 'Not specified'}</div>
                            </div>
                          ) : (
                            <>
                              {/* Mark as Won */}
                              <div className="card fade-up">
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                                  <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--green-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>✅</div>
                                  <div style={{ fontWeight: 700, fontSize: 15 }}>Mark as WON</div>
                                </div>
                                <div style={{ marginBottom: 10 }}>
                                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', marginBottom: 6 }}>Order Value (₹)</div>
                                  <input type="number" placeholder="e.g. 29500" value={orderValue} onChange={e => setOrderValue(e.target.value)} />
                                </div>
                                <button className="btn btn-green" style={{ width: '100%', justifyContent: 'center', padding: 12 }} onClick={markConverted}>
                                  ✅ Confirm — Lead Won!
                                </button>
                              </div>

                              {/* Mark as Lost */}
                              <div className="card fade-up">
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                                  <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--hot-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>❌</div>
                                  <div style={{ fontWeight: 700, fontSize: 15 }}>Mark as Lost</div>
                                </div>
                                <div style={{ marginBottom: 10 }}>
                                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', marginBottom: 6 }}>Reason for Loss</div>
                                  <input type="text" placeholder="e.g. Budget too low, bought competitor" value={lostReason} onChange={e => setLostReason(e.target.value)} />
                                </div>
                                <button className="btn btn-red" style={{ width: '100%', justifyContent: 'center', padding: 12 }} onClick={markLost}>
                                  ❌ Mark as Lost
                                </button>
                              </div>

                              {/* Notes */}
                              <div className="card fade-up">
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                                  <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--accent-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>📝</div>
                                  <div style={{ fontWeight: 700, fontSize: 15 }}>Sales Notes</div>
                                </div>
                                <textarea placeholder="Add notes about this lead..." value={notes} onChange={e => setNotes(e.target.value)} style={{ marginBottom: 10 }} />
                                <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={saveNotes} disabled={savingNotes}>
                                  {savingNotes ? 'Saving...' : '💾 Save Notes'}
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      )}

                      {/* Details */}
                      {activeTab === 'details' && (
                        <div className="panel-body">
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                            {[
                              { k: 'Bot Step', v: getBotStepLabel(selectedLead.bot_step) },
                              { k: 'Usage Type', v: selectedLead.usage_type },
                              { k: 'Language', v: selectedLead.language },
                              { k: 'Status', v: selectedLead.status },
                              { k: 'First Contact', v: formatTime(selectedLead.created_at) },
                              { k: 'Last Activity', v: formatTime(selectedLead.updated_at) },
                              { k: 'Converted', v: selectedLead.converted ? `Yes — ₹${selectedLead.order_value?.toLocaleString()}` : 'No' },
                              { k: 'Lost Reason', v: selectedLead.lost_reason },
                              { k: 'WhatsApp Msgs', v: `${whatsappMessages.length} total` },
                              { k: 'Calls Made', v: `${calls.length} total` },
                              { k: 'Follow-ups', v: `${followUps.length} scheduled` },
                              { k: 'Category', v: `CAT ${selectedLead.lead_cat || '—'}` },
                            ].filter(d => d.v).map(d => (
                              <div key={d.k} className="info-card" style={{ padding: '10px 12px' }}>
                                <div className="info-key">{d.k}</div>
                                <div className="info-val" style={{ fontSize: 13, marginTop: 3 }}>{d.v}</div>
                              </div>
                            ))}
                          </div>
                          {selectedLead.notes && (
                            <div className="card" style={{ marginTop: 8 }}>
                              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', marginBottom: 6 }}>📝 Notes</div>
                              <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.6 }}>{selectedLead.notes}</div>
                            </div>
                          )}
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