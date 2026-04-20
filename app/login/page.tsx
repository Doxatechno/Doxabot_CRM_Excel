'use client'
import { useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import Image from 'next/image'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(error.message)
    else window.location.href = '/'
    setLoading(false)
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Outfit:wght@300;400;500;600;700&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Outfit', sans-serif; background: #f0f2f8; }
        .login-wrap {
          min-height: 100vh; display: flex; align-items: center; justify-content: center;
          background: linear-gradient(135deg, #f0f2f8 0%, #e8eaf2 100%);
          padding: 20px;
        }
        .login-card {
          background: #fff; border-radius: 24px; padding: 48px 40px;
          width: 100%; max-width: 420px;
          box-shadow: 0 8px 40px rgba(0,0,0,0.10);
        }
        .login-logo { display: flex; flex-direction: column; align-items: center; margin-bottom: 32px; gap: 12px; }
        .login-logo img { height: 48px; object-fit: contain; }
        .login-title { font-family: 'Plus Jakarta Sans'; font-size: 22px; font-weight: 800; color: #1a1d2e; text-align: center; }
        .login-sub { font-size: 13px; color: #9ca3af; text-align: center; margin-top: 4px; }
        .divider { height: 1px; background: #e8eaf2; margin: 24px 0; }
        .form-group { margin-bottom: 16px; }
        .form-label { font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px; display: block; }
        .form-input {
          width: 100%; padding: 12px 16px; border: 1.5px solid #e8eaf2; border-radius: 10px;
          font-size: 14px; font-family: 'Outfit'; color: #1a1d2e; outline: none;
          transition: border 0.15s; background: #f7f8fc;
        }
        .form-input:focus { border-color: #4361ee; background: #fff; }
        .btn-login {
          width: 100%; padding: 14px; background: #4361ee; color: #fff;
          border: none; border-radius: 12px; font-size: 15px; font-weight: 700;
          font-family: 'Outfit'; cursor: pointer; transition: all 0.15s; margin-top: 8px;
          box-shadow: 0 4px 16px rgba(67,97,238,0.35);
        }
        .btn-login:hover { background: #3451d1; transform: translateY(-1px); }
        .btn-login:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }
        .error-msg { background: #fef0f2; color: #ef233c; padding: 10px 14px; border-radius: 8px; font-size: 13px; margin-top: 12px; border: 1px solid #fecdd3; }
        .powered { text-align: center; font-size: 12px; color: #9ca3af; margin-top: 32px; }
        .powered span { color: #4361ee; font-weight: 600; }
      `}</style>
      <div className="login-wrap">
        <div className="login-card">
          <div className="login-logo">
            <img src="/logo.webp" alt="Excel Fit India" onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
            <div>
              <div className="login-title">Excel Sales CRM</div>
              <div className="login-sub">Sign in to your account</div>
            </div>
          </div>
          <div className="divider" />
          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input className="form-input" type="email" placeholder="you@excelfitindia.com"
                value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <input className="form-input" type="password" placeholder="••••••••"
                value={password} onChange={e => setPassword(e.target.value)} required />
            </div>
            <button className="btn-login" type="submit" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In →'}
            </button>
            {error && <div className="error-msg">⚠️ {error}</div>}
          </form>
          <div className="powered">Powered by <span>Doxa Techno Solutions</span></div>
        </div>
      </div>
    </>
  )
}