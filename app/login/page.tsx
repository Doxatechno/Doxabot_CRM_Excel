'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [emailFocus, setEmailFocus] = useState(false)
  const [passFocus, setPassFocus] = useState(false)

  useEffect(() => { setTimeout(() => setMounted(true), 100) }, [])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!email) { setError('Please enter your email address'); return }
    if (!password) { setError('Please enter your password'); return }
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError(error.message); setLoading(false) }
    else window.location.href = '/'
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700;800&family=DM+Sans:wght@300;400;500;600;700&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { height: 100%; font-family: 'DM Sans', sans-serif; }
        @keyframes float1 { 0%,100%{transform:translateY(0) rotate(0deg)} 50%{transform:translateY(-20px) rotate(5deg)} }
        @keyframes float2 { 0%,100%{transform:translateY(0) rotate(0deg)} 50%{transform:translateY(20px) rotate(-5deg)} }
        @keyframes float3 { 0%,100%{transform:translateY(0) scale(1)} 50%{transform:translateY(-12px) scale(1.05)} }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.5;transform:scale(0.8)} }
        input::placeholder { color: rgba(255,255,255,0.25); }
      `}</style>

      <div style={{ minHeight:'100vh', display:'flex', overflow:'hidden', position:'relative', background:'linear-gradient(135deg,#0F0820 0%,#1C0B4E 40%,#2D1472 70%,#160D35 100%)' }}>

        {/* Animated background */}
        <div style={{ position:'absolute', inset:0, pointerEvents:'none', overflow:'hidden' }}>
          <div style={{ position:'absolute', top:'-10%', left:'-5%', width:500, height:500, borderRadius:'50%', background:'radial-gradient(circle,rgba(124,58,237,0.25) 0%,transparent 70%)', animation:'float1 8s ease-in-out infinite' }} />
          <div style={{ position:'absolute', bottom:'-10%', right:'-5%', width:600, height:600, borderRadius:'50%', background:'radial-gradient(circle,rgba(79,70,229,0.2) 0%,transparent 70%)', animation:'float2 10s ease-in-out infinite' }} />
          <div style={{ position:'absolute', top:'30%', right:'10%', width:300, height:300, borderRadius:'50%', background:'radial-gradient(circle,rgba(236,72,153,0.12) 0%,transparent 70%)', animation:'float3 7s ease-in-out infinite' }} />
          <div style={{ position:'absolute', inset:0, backgroundImage:'linear-gradient(rgba(124,58,237,0.05) 1px,transparent 1px),linear-gradient(90deg,rgba(124,58,237,0.05) 1px,transparent 1px)', backgroundSize:'48px 48px' }} />
        </div>

        {/* Left panel */}
        <div style={{ flex:1, display:'flex', flexDirection:'column', justifyContent:'center', padding:'60px 80px', position:'relative', opacity: mounted?1:0, transform: mounted?'none':'translateX(-20px)', transition:'all 0.7s ease' }}>
          <div style={{ marginBottom:48 }}>
            <img src="/logo.webp" style={{ height:52, objectFit:'contain', marginBottom:32, filter:'brightness(0) invert(1)', opacity:0.9 }} alt="Excel"
              onError={e => (e.target as HTMLImageElement).style.display='none'} />
            <div style={{ fontFamily:'Space Grotesk', fontSize:42, fontWeight:800, color:'#fff', lineHeight:1.15, letterSpacing:'-0.03em', marginBottom:16 }}>
              Your AI-Powered<br/>
              <span style={{ background:'linear-gradient(135deg,#A78BFA,#EC4899)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>Sales Command Centre</span>
            </div>
            <div style={{ fontSize:16, color:'rgba(255,255,255,0.55)', lineHeight:1.7, maxWidth:420 }}>
              WhatsApp lead capture → AI qualification → Kate voice agent → Automated follow-ups. All in one dashboard.
            </div>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:12, maxWidth:380 }}>
            {[
              { icon:'🤖', text:'Kate AI calls hot leads in Tamil, Telugu, Kannada & more' },
              { icon:'📊', text:'Real-time lead scoring — HOT, WARM, COLD automatically' },
              { icon:'📅', text:'Follow-up sequences run on autopilot, 24/7' },
            ].map(f => (
              <div key={f.text} style={{ display:'flex', gap:12, alignItems:'flex-start' }}>
                <div style={{ width:36, height:36, borderRadius:10, background:'rgba(167,139,250,0.15)', border:'1px solid rgba(167,139,250,0.25)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, flexShrink:0 }}>{f.icon}</div>
                <div style={{ fontSize:13, color:'rgba(255,255,255,0.6)', lineHeight:1.6, paddingTop:8 }}>{f.text}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Right panel — login card */}
        <div style={{ width:480, display:'flex', alignItems:'center', justifyContent:'center', padding:40, position:'relative', opacity: mounted?1:0, transform: mounted?'none':'translateX(20px)', transition:'all 0.7s ease 0.1s' }}>
          <div style={{ width:'100%', background:'rgba(255,255,255,0.04)', backdropFilter:'blur(32px)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:24, padding:'40px 36px', boxShadow:'0 24px 80px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.1)' }}>

            {/* Logo + title */}
            <div style={{ textAlign:'center', marginBottom:28 }}>
              <div style={{ width:72, height:72, borderRadius:20, background:'linear-gradient(135deg,#7C3AED,#4F46E5)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px', boxShadow:'0 8px 24px rgba(124,58,237,0.45)', overflow:'hidden' }}>
                <img src="/favicon.png" style={{ width:'100%', height:'100%', objectFit:'cover' }} alt="Excel"
                  onError={e => { const t = e.target as HTMLImageElement; t.style.display='none'; }} />
              </div>
              <div style={{ fontFamily:'Space Grotesk', fontSize:22, fontWeight:800, color:'#fff', letterSpacing:'-0.02em', marginBottom:6 }}>Welcome back</div>
              <div style={{ fontSize:13, color:'rgba(255,255,255,0.45)' }}>Sign in to Excel Sales CRM</div>
            </div>

            {/* Live indicator */}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:6, marginBottom:28, padding:'6px 14px', background:'rgba(16,185,129,0.1)', border:'1px solid rgba(16,185,129,0.25)', borderRadius:20, width:'fit-content', margin:'0 auto 28px' }}>
              <div style={{ width:6, height:6, borderRadius:3, background:'#10B981', animation:'pulse 1.5s infinite' }} />
              <span style={{ fontSize:11, fontWeight:700, color:'#10B981' }}>Kate AI is live</span>
            </div>

            {/* Form */}
            <form onSubmit={handleLogin}>
              <div style={{ marginBottom:16 }}>
                <label style={{ display:'block', fontSize:11, fontWeight:700, color:'rgba(255,255,255,0.5)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:8 }}>Email Address</label>
                <div style={{ position:'relative' }}>
                  <svg style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', color: emailFocus?'#A78BFA':'rgba(255,255,255,0.3)', transition:'color 0.2s' }} width="16" height="16" fill="none" viewBox="0 0 24 24">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" stroke="currentColor" strokeWidth="2"/>
                    <polyline points="22,6 12,13 2,6" stroke="currentColor" strokeWidth="2"/>
                  </svg>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                    onFocus={() => setEmailFocus(true)} onBlur={() => setEmailFocus(false)}
                    placeholder="you@excelfitindia.com"
                    style={{ width:'100%', padding:'13px 14px 13px 44px', background:'rgba(255,255,255,0.06)', border:`1.5px solid ${emailFocus?'rgba(167,139,250,0.6)':'rgba(255,255,255,0.1)'}`, borderRadius:12, fontSize:14, fontFamily:'DM Sans', color:'#fff', outline:'none', transition:'all 0.2s', boxShadow: emailFocus?'0 0 0 3px rgba(167,139,250,0.12)':'none' }} />
                </div>
              </div>

              <div style={{ marginBottom:20 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                  <label style={{ fontSize:11, fontWeight:700, color:'rgba(255,255,255,0.5)', textTransform:'uppercase', letterSpacing:'0.06em' }}>Password</label>
                </div>
                <div style={{ position:'relative' }}>
                  <svg style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', color: passFocus?'#A78BFA':'rgba(255,255,255,0.3)', transition:'color 0.2s' }} width="16" height="16" fill="none" viewBox="0 0 24 24">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" stroke="currentColor" strokeWidth="2"/>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="currentColor" strokeWidth="2"/>
                  </svg>
                  <input type={showPass?'text':'password'} value={password} onChange={e => setPassword(e.target.value)}
                    onFocus={() => setPassFocus(true)} onBlur={() => setPassFocus(false)}
                    placeholder="••••••••"
                    style={{ width:'100%', padding:'13px 44px 13px 44px', background:'rgba(255,255,255,0.06)', border:`1.5px solid ${passFocus?'rgba(167,139,250,0.6)':'rgba(255,255,255,0.1)'}`, borderRadius:12, fontSize:14, fontFamily:'DM Sans', color:'#fff', outline:'none', transition:'all 0.2s', boxShadow: passFocus?'0 0 0 3px rgba(167,139,250,0.12)':'none' }} />
                  <button type="button" onClick={() => setShowPass(!showPass)} style={{ position:'absolute', right:14, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'rgba(255,255,255,0.4)', fontSize:14, padding:0 }}>
                    {showPass ? '🙈' : '👁️'}
                  </button>
                </div>
              </div>

              {error && (
                <div style={{ background:'rgba(239,68,68,0.12)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:10, padding:'10px 14px', fontSize:12, color:'#FCA5A5', marginBottom:16, display:'flex', alignItems:'center', gap:8 }}>
                  ⚠️ {error}
                </div>
              )}

              <button type="submit" disabled={loading} style={{ width:'100%', padding:'14px', borderRadius:13, border:'none', background: loading?'rgba(124,58,237,0.5)':'linear-gradient(135deg,#7C3AED,#4F46E5)', color:'#fff', fontSize:15, fontWeight:800, cursor: loading?'not-allowed':'pointer', fontFamily:'Space Grotesk', boxShadow: loading?'none':'0 8px 24px rgba(124,58,237,0.45)', transition:'all 0.2s', display:'flex', alignItems:'center', justifyContent:'center', gap:10, letterSpacing:'-0.01em' }}>
                {loading ? (
                  <>
                    <div style={{ width:16, height:16, border:'2px solid rgba(255,255,255,0.3)', borderTopColor:'#fff', borderRadius:8, animation:'spin 0.7s linear infinite' }} />
                    Signing in...
                  </>
                ) : 'Sign In to CRM →'}
              </button>
            </form>

            <div style={{ textAlign:'center', marginTop:28, paddingTop:24, borderTop:'1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ fontSize:11, color:'rgba(255,255,255,0.3)' }}>
                Powered by <span style={{ color:'#A78BFA', fontWeight:700 }}>Doxa Techno Solutions</span>
              </div>
              <div style={{ fontSize:10, color:'rgba(255,255,255,0.2)', marginTop:4 }}>© 2026 Excel Fit India · All rights reserved</div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}