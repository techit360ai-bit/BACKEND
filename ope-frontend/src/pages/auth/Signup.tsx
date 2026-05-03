import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Eye, EyeOff, Zap, ArrowRight, ArrowLeft, Check, AlertCircle, X } from 'lucide-react'
import { useAuth, type Role } from '../../contexts/AuthContext'
import { Button } from '../../components/ui'
import { cn } from '../../lib/utils'

// Enhanced Toast Component
const Toast = ({ message, type, onClose }: { message: string; type: 'success' | 'error' | 'info'; onClose: () => void }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 5000)
    return () => clearTimeout(timer)
  }, [onClose])

  const colors = {
    success: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500',
    error: 'bg-red-500/10 border-red-500/30 text-red-500',
    info: 'bg-blue-500/10 border-blue-500/30 text-blue-500'
  }

  return (
    <div className={cn('fixed top-4 right-4 z-50 p-4 rounded-xl border backdrop-blur-sm animate-in slide-in-from-top-2', colors[type])}>
      <div className="flex items-center gap-3">
        <AlertCircle className="h-5 w-5" />
        <p className="text-sm">{message}</p>
        <button onClick={onClose} className="ml-4 hover:opacity-70">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

const ROLES: { id: Role; label: string; desc: string }[] = [
  { id: 'founder', label: 'Founder', desc: 'Launch startups & find your team' },
  { id: 'collaborator', label: 'Collaborator', desc: 'Join projects & earn credits' },
  { id: 'investor', label: 'Investor', desc: 'Discover & fund startups' },
  { id: 'organisation', label: 'Organisation', desc: 'Find talent & post challenges' },
]

const COUNTRIES = [
  { code: 'NG', name: 'Nigeria', dial: '+234' }, { code: 'GH', name: 'Ghana', dial: '+233' },
  { code: 'ZA', name: 'South Africa', dial: '+27' }, { code: 'KE', name: 'Kenya', dial: '+254' },
  { code: 'US', name: 'United States', dial: '+1' }, { code: 'GB', name: 'United Kingdom', dial: '+44' },
  { code: 'IN', name: 'India', dial: '+91' }, { code: 'DE', name: 'Germany', dial: '+49' },
  { code: 'CA', name: 'Canada', dial: '+1' }, { code: 'AU', name: 'Australia', dial: '+61' },
  { code: 'SG', name: 'Singapore', dial: '+65' }, { code: 'OTHER', name: 'Other', dial: '' },
]

const ROLE_SETUP: Record<Role, string> = {
  founder: '/founder/setup', collaborator: '/collaborator/setup',
  investor: '/investor/setup', organisation: '/org/setup',
}

// Validation utilities
const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@([^\s@]+\.)+[^\s@]+$/
  return emailRegex.test(email)
}

const validatePassword = (password: string): { isValid: boolean; errors: string[] } => {
  const errors: string[] = []
  
  if (password.length < 8) errors.push('at least 8 characters')
  if (!/[A-Z]/.test(password)) errors.push('one uppercase letter')
  if (!/[a-z]/.test(password)) errors.push('one lowercase letter')
  if (!/[0-9]/.test(password)) errors.push('one number')
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) errors.push('one special character')
  
  return { isValid: errors.length === 0, errors }
}

const validatePhone = (phone: string): boolean => {
  const phoneRegex = /^[0-9\s\-+()]{8,20}$/
  return phoneRegex.test(phone)
}

const sanitizeInput = (input: string): string => {
  return input.replace(/[<>]/g, '').trim()
}

export default function Signup() {
  const { signUp } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()

  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [showPwd, setShowPwd] = useState(false)
  const [countryCode, setCountryCode] = useState('NG')
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)
  const [passwordErrors, setPasswordErrors] = useState<string[]>([])

  const [form, setForm] = useState({
    firstName: '', lastName: '', phone: '', country: 'Nigeria', countryCode: '+234',
    email: '', role: (params.get('role') as Role) || 'founder',
    password: '', confirmPassword: '', agreeTerms: false,
  })

  const set = (k: string, v: unknown) => setForm(p => ({ ...p, [k]: v }))

  const selectedCountry = COUNTRIES.find(c => c.code === countryCode) ?? COUNTRIES[0]

  const selectCountry = (code: string) => {
    const c = COUNTRIES.find(x => x.code === code)
    if (!c) return
    setCountryCode(code)
    set('country', c.name); set('countryCode', c.dial)
  }

  // Real-time password validation
  useEffect(() => {
    if (form.password) {
      const { errors } = validatePassword(form.password)
      setPasswordErrors(errors)
    } else {
      setPasswordErrors([])
    }
  }, [form.password])

  const canNext = step === 1
    ? form.firstName.trim().length >= 2 && 
      form.lastName.trim().length >= 2 && 
      form.phone.trim().length > 0 &&
      validatePhone(form.phone)
    : step === 2
      ? validateEmail(form.email)
      : form.password.length >= 8 && 
        form.password === form.confirmPassword && 
        form.agreeTerms &&
        validatePassword(form.password).isValid
    
  const goNext = () => {
    if (step === 1 && !validatePhone(form.phone)) {
      setToast({ message: 'Please enter a valid phone number', type: 'error' })
      return
    }
    if (step === 2 && !validateEmail(form.email)) {
      setToast({ message: 'Please enter a valid email address', type: 'error' })
      return
    }
    if (canNext) setStep(s => s + 1)
  }

  const handleSubmit = async () => {
    try {
      // Comprehensive validation
      if (form.password !== form.confirmPassword) {
        setToast({ message: 'Passwords do not match', type: 'error' })
        return
      }
      
      const passwordValidation = validatePassword(form.password)
      if (!passwordValidation.isValid) {
        setToast({ 
          message: `Password must contain: ${passwordValidation.errors.join(', ')}`, 
          type: 'error' 
        })
        return
      }
      
      if (!form.agreeTerms) {
        setToast({ message: 'Please agree to the Terms of Service', type: 'error' })
        return
      }

      if (!validatePhone(form.phone)) {
        setToast({ message: 'Please enter a valid phone number', type: 'error' })
        return
      }

      if (!validateEmail(form.email)) {
        setToast({ message: 'Please enter a valid email address', type: 'error' })
        return
      }

      setLoading(true)
      
      // Sanitize inputs
      const sanitizedData = {
        email: form.email.toLowerCase().trim(),
        password: form.password,
        firstName: sanitizeInput(form.firstName),
        lastName: sanitizeInput(form.lastName),
        phone: `${form.countryCode}${form.phone.replace(/\s/g, '')}`,
        country: selectedCountry.name,
        countryCode: form.countryCode,
        role: form.role,
      }
      // navigate('/founder/setup')
      
      const response = await signUp(sanitizedData)
      
      // Handle HTTP status codes

      // my error starts here
      if (response && 'status' in response) {
        const apiMessage = 'message' in response && typeof response.message === 'string'
          ? response.message
          : undefined

        const status = response.status as number; // my error end
        navigate('/founder/setup')
        if (status >= 200 && status < 300) {
          setToast({ message: 'Account created successfully! Redirecting...', type: 'success' })
          setTimeout(() => navigate('/founder/setup'), 1500)
        } else if (status === 400) {
          setToast({ message: apiMessage || 'Invalid input data', type: 'error' })
        } else if (status === 409) {
          setToast({ message: 'An account with this email already exists. Please log in instead.', type: 'error' })
        } else if (status === 429) {
          setToast({ message: 'Too many attempts. Please try again later.', type: 'error' })
        } else if (status === 500) {
          setToast({ message: 'Server error. Please try again later.', type: 'error' })
        } else {
          setToast({ message: apiMessage || 'Signup failed. Please try again.', type: 'error' })
        }
      } else if (response && 'error' in response && response.error) {
        setToast({ message: response.error instanceof Error ? response.error.message : String(response.error), type: 'error' })
      } else {
        setToast({ message: 'Account created successfully! Redirecting...', type: 'success' })
        navigate('/founder/setup')
      }
    } catch (e) {
      console.error('Signup error:', e)
      setToast({ 
        message: e instanceof Error ? e.message : 'An unexpected error occurred. Please try again.', 
        type: 'error' 
      })
    } finally {
      setLoading(false)
    }
  }

  const inputCls = 'w-full h-10 rounded-xl border border-[color:var(--border)] bg-[color:var(--input)] px-3 text-sm text-[color:var(--foreground)] placeholder:text-[color:var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[color:var(--ring)] transition-all disabled:opacity-50 disabled:cursor-not-allowed'

  return (
    <div className="min-h-screen bg-[color:var(--background)] flex">
      {/* Toast Notifications */}
      {toast && (
        <Toast 
          message={toast.message} 
          type={toast.type} 
          onClose={() => setToast(null)} 
        />
      )}

      {/* Left decorative */}
      <div className="hidden lg:flex lg:w-5/12 relative bg-gradient-to-br from-[color:var(--primary)]/15 via-blue-500/8 to-[color:var(--background)] overflow-hidden flex-col justify-between p-12">
        <div className="orb orb-violet w-[400px] h-[400px] -top-20 -left-20 absolute" />
        <div className="relative z-10">
          <Link to="/" className="flex items-center gap-2.5 mb-12">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-[color:var(--primary)] to-blue-400 flex items-center justify-center shadow-lg">
              <Zap className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="font-bold leading-none">TECHIT</div>
              <div className="font-mono text-[0.6rem] text-[color:var(--primary)] tracking-widest">NETWORK</div>
            </div>
          </Link>
          <h2 className="font-bold text-4xl leading-tight tracking-tight mb-3">Build.<br/>Connect.<br/>Ship.</h2>
          <p className="text-[color:var(--muted-foreground)] text-sm leading-relaxed max-w-xs">
            Join the global network where founders find co-builders, investors discover deals, and experts build their legacy.
          </p>
        </div>
        <div className="relative z-10 p-5 rounded-2xl bg-[color:var(--card)]/60 border border-[color:var(--border)] backdrop-blur">
          <p className="text-sm text-[color:var(--muted-foreground)] italic leading-relaxed mb-4">
            "Found my technical co-founder in 3 days through TechIT. The AI matching is unlike anything else."
          </p>
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center text-white text-xs font-bold">
              AK
            </div>
            <div>
              <div className="text-sm font-semibold">Amara Kone</div>
              <div className="text-xs text-[color:var(--muted-foreground)]">Founder · Lagos · Seed Funded</div>
            </div>
          </div>
        </div>
      </div>

      {/* Right form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 overflow-y-auto">
        <div className="w-full max-w-md">
          <Link to="/" className="lg:hidden flex items-center gap-2.5 mb-8">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-[color:var(--primary)] to-blue-400 flex items-center justify-center">
              <Zap className="h-4 w-4 text-white" />
            </div>
            <span className="font-bold text-sm">TECHIT NETWORK</span>
          </Link>

          <div className="mb-8">
            <h1 className="font-bold text-3xl tracking-tight">Create Account</h1>
            <p className="text-[color:var(--muted-foreground)] text-sm mt-2">
              Already a member? <Link to="/login" className="text-[color:var(--primary)] font-medium hover:underline">Sign in</Link>
            </p>
          </div>

          {/* Step indicators */}
          <div className="flex gap-2 mb-8">
            {[1, 2, 3].map(n => (
              <div 
                key={n} 
                className={cn(
                  'h-1 flex-1 rounded-full transition-all duration-500',
                  n < step ? 'bg-emerald-500' : n === step ? 'bg-[color:var(--primary)]' : 'bg-[color:var(--muted)]'
                )} 
              />
            ))}
          </div>

          {/* Step 1 */}
          {step === 1 && (
            <div className="space-y-4 animate-in fade-in duration-300">
              <p className="font-mono text-xs text-[color:var(--primary)] uppercase tracking-widest">Step 01 — Your Details</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <input 
                    value={form.firstName} 
                    onChange={e => set('firstName', e.target.value)} 
                    placeholder="First Name" 
                    className={inputCls} 
                    disabled={loading}
                  />
                  {form.firstName && form.firstName.length < 2 && (
                    <p className="text-xs text-red-500 mt-1">Minimum 2 characters</p>
                  )}
                </div>
                <div>
                  <input 
                    value={form.lastName} 
                    onChange={e => set('lastName', e.target.value)} 
                    placeholder="Last Name" 
                    className={inputCls} 
                    disabled={loading}
                  />
                  {form.lastName && form.lastName.length < 2 && (
                    <p className="text-xs text-red-500 mt-1">Minimum 2 characters</p>
                  )}
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted-foreground)]">Country</label>
                <select 
                  value={countryCode} 
                  onChange={e => selectCountry(e.target.value)} 
                  className={inputCls}
                  disabled={loading}
                >
                  {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <div className="flex rounded-xl border border-[color:var(--border)] overflow-hidden focus-within:ring-2 focus-within:ring-[color:var(--ring)]">
                  <div className="flex items-center px-3 bg-[color:var(--muted)]/50 border-r border-[color:var(--border)] text-sm text-[color:var(--muted-foreground)] font-mono flex-shrink-0">
                    {selectedCountry.dial || '+?'}
                  </div>
                  <input 
                    type="tel" 
                    value={form.phone} 
                    onChange={e => set('phone', e.target.value)} 
                    placeholder="800 000 0000"
                    className="flex-1 h-10 bg-[color:var(--input)] px-3 text-sm text-[color:var(--foreground)] outline-none placeholder:text-[color:var(--muted-foreground)] disabled:opacity-50" 
                    disabled={loading}
                  />
                </div>
                {form.phone && !validatePhone(form.phone) && (
                  <p className="text-xs text-red-500 mt-1">Enter a valid phone number (8-20 digits)</p>
                )}
              </div>
              <Button 
                size="lg" 
                className="w-full mt-2" 
                onClick={goNext} 
                disabled={!canNext || loading}
              >
                Continue <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Step 2 */}
          {step === 2 && (
            <div className="space-y-4 animate-in fade-in duration-300">
              <p className="font-mono text-xs text-[color:var(--primary)] uppercase tracking-widest">Step 02 — Role & Email</p>
              <div className="grid grid-cols-2 gap-3">
                {ROLES.map(role => (
                  <button 
                    key={role.id} 
                    onClick={() => set('role', role.id)}
                    className={cn(
                      'p-4 rounded-xl border text-left transition-all',
                      form.role === role.id 
                        ? 'border-[color:var(--primary)] bg-[color:var(--primary)]/10' 
                        : 'border-[color:var(--border)] bg-[color:var(--card)] hover:border-[color:var(--primary)]/40'
                    )}
                    disabled={loading}
                  >
                    <div className="text-sm font-semibold">{role.label}</div>
                    <div className="text-xs text-[color:var(--muted-foreground)] mt-0.5">{role.desc}</div>
                    {form.role === role.id && (
                      <div className="mt-2 h-4 w-4 rounded-full bg-[color:var(--primary)] flex items-center justify-center">
                        <Check className="h-2.5 w-2.5 text-white" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
              <div>
                <input 
                  type="email" 
                  value={form.email} 
                  onChange={e => set('email', e.target.value)} 
                  placeholder="Email Address" 
                  className={inputCls} 
                  disabled={loading}
                />
                {form.email && !validateEmail(form.email) && (
                  <p className="text-xs text-red-500 mt-1">Enter a valid email address</p>
                )}
              </div>
              <div className="flex gap-3">
                <Button 
                  variant="outline" 
                  size="lg" 
                  onClick={() => setStep(1)} 
                  className="w-12 flex-shrink-0 px-0 justify-center"
                  disabled={loading}
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <Button 
                  size="lg" 
                  className="flex-1" 
                  onClick={goNext} 
                  disabled={!canNext || loading}
                >
                  Continue <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 3 */}
          {step === 3 && (
            <div className="space-y-4 animate-in fade-in duration-300">
              <p className="font-mono text-xs text-[color:var(--primary)] uppercase tracking-widest">Step 03 — Secure Your Account</p>
              <div>
                <div className="relative">
                  <input 
                    type={showPwd ? 'text' : 'password'} 
                    value={form.password} 
                    onChange={e => set('password', e.target.value)} 
                    placeholder="Password (min. 8 chars)" 
                    className={cn(inputCls, 'pr-10')} 
                    disabled={loading}
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowPwd(s => !s)} 
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]"
                    disabled={loading}
                  >
                    {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {form.password && passwordErrors.length > 0 && (
                  <div className="mt-2 p-2 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
                    <p className="text-xs text-yellow-600 mb-1">Password must contain:</p>
                    <ul className="text-xs text-yellow-600 space-y-0.5">
                      {passwordErrors.map(err => (
                        <li key={err}>• {err}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              <div>
                <input 
                  type="password" 
                  value={form.confirmPassword} 
                  onChange={e => set('confirmPassword', e.target.value)} 
                  placeholder="Confirm Password" 
                  className={inputCls} 
                  disabled={loading}
                />
                {form.confirmPassword && form.password !== form.confirmPassword && (
                  <p className="text-xs text-red-500 mt-1">Passwords do not match</p>
                )}
              </div>
              <label className="flex items-start gap-3 cursor-pointer">
                <div 
                  onClick={() => !loading && set('agreeTerms', !form.agreeTerms)}
                  className={cn(
                    'mt-0.5 h-5 w-5 rounded-md border flex items-center justify-center flex-shrink-0 transition-all',
                    form.agreeTerms ? 'bg-[color:var(--primary)] border-[color:var(--primary)]' : 'border-[color:var(--border)]',
                    !loading && 'cursor-pointer'
                  )}
                >
                  {form.agreeTerms && <Check className="h-3 w-3 text-white" />}
                </div>
                <span className="text-sm text-[color:var(--muted-foreground)] leading-relaxed">
                  I agree to the <a href="/terms" className="text-[color:var(--primary)] hover:underline">Terms of Service</a> and <a href="/privacy" className="text-[color:var(--primary)] hover:underline">Privacy Policy</a>.
                </span>
              </label>
              <div className="flex gap-3">
                <Button 
                  variant="outline" 
                  size="lg" 
                  onClick={() => setStep(2)} 
                  className="w-12 flex-shrink-0 px-0 justify-center"
                  disabled={loading}
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <Button 
                  size="lg" 
                  className="flex-1" 
                  onClick={handleSubmit} 
                  loading={loading}
                  disabled={!canNext}
                >
                  Create Account
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-in {
          animation: fadeIn 0.3s ease-out;
        }
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        .slide-in-from-top-2 {
          animation: slideIn 0.3s ease-out;
        }
      `}</style>
    </div>
  )
}