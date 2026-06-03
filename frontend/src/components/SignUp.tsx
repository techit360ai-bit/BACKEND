import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Eye, EyeOff, Zap, ArrowRight, ArrowLeft,
  Check, AlertCircle, X, Mail, ShieldCheck, RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";

const API = import.meta.env.VITE_API_URL || "http://localhost:3000/api";

type Role = "founder" | "collaborator" | "investor" | "organisation";

// ── Toast ─────────────────────────────────────────────────────────────────────
const Toast = ({
  message, type, onClose,
}: { message: string; type: "success" | "error" | "info"; onClose: () => void }) => {
  useEffect(() => {
    const t = setTimeout(onClose, 5000);
    return () => clearTimeout(t);
  }, [onClose]);

  const colors = {
    success: "bg-emerald-500/10 border-emerald-500/30 text-emerald-500",
    error:   "bg-red-500/10 border-red-500/30 text-red-500",
    info:    "bg-violet-500/10 border-violet-500/30 text-violet-400",
  };
  return (
    <div className={cn("fixed top-4 right-4 z-50 p-4 rounded-2xl border backdrop-blur-sm shadow-lg max-w-sm animate-in", colors[type])}>
      <div className="flex items-start gap-3">
        <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
        <p className="text-sm flex-1">{message}</p>
        <button onClick={onClose} className="hover:opacity-70 ml-2 shrink-0">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

// ── OTP digit input ───────────────────────────────────────────────────────────
function OtpInput({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled?: boolean }) {
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);
  const digits = value.padEnd(6, "").split("").slice(0, 6);

  const handleChange = (i: number, char: string) => {
    const d = char.replace(/\D/g, "").slice(-1);
    const next = digits.map((c, idx) => (idx === i ? d : c)).join("");
    onChange(next.slice(0, 6));
    if (d && i < 5) inputsRef.current[i + 1]?.focus();
  };

  const handleKeyDown = (i: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !digits[i] && i > 0) {
      inputsRef.current[i - 1]?.focus();
      const next = digits.map((c, idx) => (idx === i - 1 ? "" : c)).join("");
      onChange(next);
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    onChange(pasted.padEnd(6, "").slice(0, 6));
    const focusIdx = Math.min(pasted.length, 5);
    inputsRef.current[focusIdx]?.focus();
  };

  return (
    <div className="flex gap-2 justify-between" onPaste={handlePaste}>
      {Array.from({ length: 6 }, (_, i) => (
        <input
          key={i}
          ref={el => { inputsRef.current[i] = el; }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={digits[i] || ""}
          onChange={e => handleChange(i, e.target.value)}
          onKeyDown={e => handleKeyDown(i, e)}
          disabled={disabled}
          className={cn(
            "w-12 h-14 rounded-xl border-2 text-center text-xl font-bold",
            "bg-[color:var(--input)] text-[color:var(--foreground)]",
            "focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20",
            "transition-all duration-150 disabled:opacity-50",
            digits[i]
              ? "border-violet-500 bg-violet-500/5"
              : "border-[color:var(--border)]",
          )}
        />
      ))}
    </div>
  );
}

// ── Roles ─────────────────────────────────────────────────────────────────────
const ROLES: { id: Role; label: string; desc: string; emoji: string }[] = [
  { id: "founder",      label: "Founder",      desc: "Launch & find your team",    emoji: "🚀" },
  { id: "collaborator", label: "Collaborator",  desc: "Join projects & earn",       emoji: "⚡" },
  { id: "investor",     label: "Investor",      desc: "Discover & fund startups",   emoji: "💎" },
  { id: "organisation", label: "Organisation",  desc: "Find talent & post challenges", emoji: "🏛️" },
];

// ── Validation ────────────────────────────────────────────────────────────────
const validateEmail = (e: string) => /^[^\s@]+@([^\s@]+\.)+[^\s@]+$/.test(e);

const validatePassword = (p: string) => {
  const errors: string[] = [];
  if (p.length < 8)                              errors.push("at least 8 characters");
  if (!/[A-Z]/.test(p))                          errors.push("one uppercase letter");
  if (!/[a-z]/.test(p))                          errors.push("one lowercase letter");
  if (!/[0-9]/.test(p))                          errors.push("one number");
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(p))        errors.push("one special character");
  return { isValid: errors.length === 0, errors };
};

// ── Signup component ──────────────────────────────────────────────────────────
export default function Signup() {
  const navigate  = useNavigate();
  const { signUp } = useAuth();

  // 4 steps: 1=Name, 2=Role+Email, 3=OTP, 4=Password
  const [step, setStep]       = useState(1);
  const TOTAL_STEPS            = 4;

  const [loading, setLoading] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [toast, setToast]     = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

  // OTP state
  const [otpCode,     setOtpCode]     = useState("");
  const [otpVerified, setOtpVerified] = useState(false);
  const [otpError,    setOtpError]    = useState("");
  const [cooldown,    setCooldown]    = useState(0);          // seconds remaining
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [form, setForm] = useState({
    firstName:       "",
    lastName:        "",
    email:           "",
    role:            "founder" as Role,
    password:        "",
    confirmPassword: "",
    agreeTerms:      false,
  });
  const set = (k: string, v: unknown) => setForm(p => ({ ...p, [k]: v }));

  const passwordErrors = useMemo(() => {
    if (form.password) return validatePassword(form.password).errors;
    return [];
  }, [form.password]);

  const canNext = useMemo(() => {
    if (step === 1) return form.firstName.trim().length >= 2 && form.lastName.trim().length >= 2;
    if (step === 2) return validateEmail(form.email);
    if (step === 3) return otpVerified;
    return (
      form.password.length >= 8 &&
      form.password === form.confirmPassword &&
      form.agreeTerms &&
      validatePassword(form.password).isValid
    );
  }, [step, form, otpVerified]);

  // ── Cooldown timer ────────────────────────────────────────────────────────
  const startCooldown = useCallback((secs: number) => {
    setCooldown(secs);
    if (cooldownRef.current) clearInterval(cooldownRef.current);
    cooldownRef.current = setInterval(() => {
      setCooldown(c => {
        if (c <= 1) { clearInterval(cooldownRef.current!); return 0; }
        return c - 1;
      });
    }, 1000);
  }, []);

  useEffect(() => () => { if (cooldownRef.current) clearInterval(cooldownRef.current); }, []);

  // ── Send OTP ──────────────────────────────────────────────────────────────
  const sendOtp = useCallback(async () => {
    setLoading(true);
    setOtpError("");
    try {
      const res  = await fetch(`${API}/auth/send-otp`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ email: form.email }),
      });
      const json = await res.json();
      if (!res.ok) {
        if (res.status === 429) { startCooldown(json.retryAfter || 60); }
        setToast({ message: json.error || "Failed to send code", type: "error" });
      } else {
        setToast({ message: `Verification code sent to ${form.email}`, type: "success" });
        startCooldown(60);
        setStep(3);
      }
    } catch {
      setToast({ message: "Network error. Is the server running?", type: "error" });
    } finally {
      setLoading(false);
    }
  }, [form.email, startCooldown]);

  // ── Verify OTP ────────────────────────────────────────────────────────────
  const verifyOtp = async () => {
    if (otpCode.length !== 6) { setOtpError("Enter the full 6-digit code"); return; }
    setLoading(true);
    setOtpError("");
    try {
      const res  = await fetch(`${API}/auth/verify-otp`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ email: form.email, code: otpCode }),
      });
      const json = await res.json();
      if (!res.ok) {
        setOtpError(json.error || "Incorrect code");
      } else {
        setOtpVerified(true);
        setToast({ message: "Email verified! Set your password.", type: "success" });
        setStep(4);
      }
    } catch {
      setOtpError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // ── Navigation helpers ────────────────────────────────────────────────────
  const goNext = async () => {
    if (step === 1) {
      if (form.firstName.trim().length < 2) { setToast({ message: "First name must be at least 2 characters", type: "error" }); return; }
      if (form.lastName.trim().length < 2)  { setToast({ message: "Last name must be at least 2 characters",  type: "error" }); return; }
      setStep(2);
    } else if (step === 2) {
      if (!validateEmail(form.email)) { setToast({ message: "Enter a valid email address", type: "error" }); return; }
      await sendOtp();
    }
  };

  // ── Final submit ──────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!otpVerified) { setToast({ message: "Please verify your email first", type: "error" }); return; }
    if (form.password !== form.confirmPassword) { setToast({ message: "Passwords do not match", type: "error" }); return; }
    const pv = validatePassword(form.password);
    if (!pv.isValid) { setToast({ message: `Password must contain: ${pv.errors.join(", ")}`, type: "error" }); return; }
    if (!form.agreeTerms) { setToast({ message: "Please agree to the Terms of Service", type: "error" }); return; }

    setLoading(true);
    const { error } = await signUp({
      email:       form.email,
      password:    form.password,
      firstName:   form.firstName,
      lastName:    form.lastName,
      phone:       "",
      country:     "",
      countryCode: "",
      role:        form.role,
      // @ts-expect-error – extra field passed to backend
      otpVerified: true,
    });
    if (error) {
      setToast({ message: error.message, type: "error" });
      setLoading(false);
    } else {
      setToast({ message: "Account created! Redirecting…", type: "success" });
      setTimeout(() => navigate(`/${form.role}/setup`), 1200);
    }
  };

  const inputCls =
    "w-full h-11 rounded-xl border border-[color:var(--border)] bg-[color:var(--input)] px-4 text-sm text-[color:var(--foreground)] placeholder:text-[color:var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed";

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[color:var(--background)] flex">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* ── Left panel ─────────────────────────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-5/12 relative bg-gradient-to-br from-violet-600/15 via-indigo-500/8 to-[color:var(--background)] overflow-hidden flex-col justify-between p-12">
        <div className="orb orb-violet w-[400px] h-[400px] -top-20 -left-20 absolute" />
        <div className="relative z-10">
          <Link to="/" className="flex items-center gap-2.5 mb-12">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-violet-500/30">
              <Zap className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="font-bold leading-none tracking-tight">TECHIT</div>
              <div className="font-mono text-[0.6rem] text-violet-500 tracking-widest">NETWORK</div>
            </div>
          </Link>
          <h2 className="font-bold text-4xl leading-tight tracking-tight mb-3">
            Build.<br />Connect.<br />Ship.
          </h2>
          <p className="text-[color:var(--muted-foreground)] text-sm leading-relaxed max-w-xs">
            Join the global network where founders find co-builders, investors discover deals, and experts build their legacy.
          </p>
        </div>
        <div className="relative z-10 p-5 rounded-2xl bg-[color:var(--card)]/60 border border-[color:var(--border)] backdrop-blur">
          <p className="text-sm text-[color:var(--muted-foreground)] italic leading-relaxed mb-4">
            "Found my technical co-founder in 3 days through TechIT. The AI matching is unlike anything else."
          </p>
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center text-white text-xs font-bold">AK</div>
            <div>
              <div className="text-sm font-semibold">Amara Kone</div>
              <div className="text-xs text-[color:var(--muted-foreground)]">Founder · Lagos · Seed Funded</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Right form ─────────────────────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 overflow-y-auto">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <Link to="/" className="lg:hidden flex items-center gap-2.5 mb-8">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-violet-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-violet-500/30">
              <Zap className="h-4 w-4 text-white" />
            </div>
            <span className="font-bold text-sm tracking-tight">TECHIT NETWORK</span>
          </Link>

          <div className="mb-8">
            <h1 className="font-bold text-3xl tracking-tight">Create Account</h1>
            <p className="text-[color:var(--muted-foreground)] text-sm mt-2">
              Already a member?{" "}
              <Link to="/signin" className="text-violet-500 font-medium hover:underline">Sign in</Link>
            </p>
          </div>

          {/* Progress bar */}
          <div className="flex gap-1.5 mb-8">
            {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map(n => (
              <div
                key={n}
                className={cn(
                  "h-1 flex-1 rounded-full transition-all duration-500",
                  n < step  ? "bg-emerald-500"
                  : n === step ? "bg-violet-500"
                  : "bg-[color:var(--muted)]",
                )}
              />
            ))}
          </div>

          {/* ── Step 1 — Name ─────────────────────────────────────────────── */}
          {step === 1 && (
            <div className="space-y-5 animate-in">
              <p className="font-mono text-xs text-violet-500 uppercase tracking-widest">Step 01 — Your Details</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <input value={form.firstName} onChange={e => set("firstName", e.target.value)}
                    placeholder="First Name" className={inputCls} disabled={loading} />
                  {form.firstName && form.firstName.length < 2 && (
                    <p className="text-xs text-red-500 mt-1">Minimum 2 characters</p>
                  )}
                </div>
                <div>
                  <input value={form.lastName} onChange={e => set("lastName", e.target.value)}
                    placeholder="Last Name" className={inputCls} disabled={loading} />
                  {form.lastName && form.lastName.length < 2 && (
                    <p className="text-xs text-red-500 mt-1">Minimum 2 characters</p>
                  )}
                </div>
              </div>
              <Button onClick={goNext} disabled={!canNext || loading} loading={loading} className="w-full" size="lg">
                Continue <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* ── Step 2 — Role & Email ─────────────────────────────────────── */}
          {step === 2 && (
            <div className="space-y-4 animate-in">
              <p className="font-mono text-xs text-violet-500 uppercase tracking-widest">Step 02 — Role &amp; Email</p>
              <div className="grid grid-cols-2 gap-2.5">
                {ROLES.map(role => (
                  <button key={role.id} onClick={() => set("role", role.id)} disabled={loading}
                    className={cn(
                      "p-3.5 rounded-xl border text-left transition-all duration-150",
                      form.role === role.id
                        ? "border-violet-500 bg-violet-500/10 shadow-sm shadow-violet-500/20"
                        : "border-[color:var(--border)] bg-[color:var(--card)] hover:border-violet-400/50",
                    )}>
                    <div className="text-base mb-1">{role.emoji}</div>
                    <div className="text-sm font-semibold">{role.label}</div>
                    <div className="text-xs text-[color:var(--muted-foreground)] mt-0.5">{role.desc}</div>
                    {form.role === role.id && (
                      <div className="mt-2 h-4 w-4 rounded-full bg-violet-500 flex items-center justify-center">
                        <Check className="h-2.5 w-2.5 text-white" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
              <div>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[color:var(--muted-foreground)]" />
                  <input type="email" value={form.email} onChange={e => set("email", e.target.value)}
                    placeholder="Email Address" className={cn(inputCls, "pl-10")} disabled={loading} />
                </div>
                {form.email && !validateEmail(form.email) && (
                  <p className="text-xs text-red-500 mt-1">Enter a valid email address</p>
                )}
              </div>
              <div className="flex gap-3">
                <Button type="button" variant="outline" size="icon" onClick={() => setStep(1)} disabled={loading} className="shrink-0">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <Button onClick={goNext} disabled={!canNext || loading} loading={loading} className="flex-1" size="lg">
                  Send Verification Code <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* ── Step 3 — OTP Verification ─────────────────────────────────── */}
          {step === 3 && (
            <div className="space-y-5 animate-in">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-violet-500/15 flex items-center justify-center shrink-0">
                  <ShieldCheck className="h-5 w-5 text-violet-500" />
                </div>
                <div>
                  <p className="font-mono text-xs text-violet-500 uppercase tracking-widest">Step 03 — Verify Email</p>
                  <p className="text-xs text-[color:var(--muted-foreground)] mt-0.5">
                    Code sent to <span className="font-medium text-[color:var(--foreground)]">{form.email}</span>
                  </p>
                </div>
              </div>

              <OtpInput value={otpCode} onChange={v => { setOtpCode(v); setOtpError(""); }} disabled={loading || otpVerified} />

              {otpError && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-500">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {otpError}
                </div>
              )}

              {otpVerified && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-sm text-emerald-500">
                  <Check className="h-4 w-4 shrink-0" />
                  Email verified successfully!
                </div>
              )}

              <Button
                onClick={verifyOtp}
                disabled={otpCode.length !== 6 || loading || otpVerified}
                loading={loading}
                className="w-full"
                size="lg"
              >
                {otpVerified ? "Verified ✓" : "Verify Code"}
              </Button>

              {/* Resend */}
              <div className="flex items-center justify-between text-sm">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)] flex items-center gap-1.5 transition-colors"
                >
                  <ArrowLeft className="h-3.5 w-3.5" /> Wrong email?
                </button>
                <button
                  type="button"
                  disabled={cooldown > 0 || loading}
                  onClick={sendOtp}
                  className="flex items-center gap-1.5 text-violet-500 hover:text-violet-400 disabled:text-[color:var(--muted-foreground)] disabled:cursor-not-allowed transition-colors font-medium"
                >
                  <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
                  {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
                </button>
              </div>
            </div>
          )}

          {/* ── Step 4 — Password ─────────────────────────────────────────── */}
          {step === 4 && (
            <div className="space-y-4 animate-in">
              <p className="font-mono text-xs text-violet-500 uppercase tracking-widest">Step 04 — Secure Your Account</p>

              <div>
                <div className="relative">
                  <input
                    type={showPwd ? "text" : "password"}
                    value={form.password}
                    onChange={e => set("password", e.target.value)}
                    placeholder="Password (min. 8 chars)"
                    className={cn(inputCls, "pr-11")}
                    disabled={loading}
                  />
                  <button type="button" onClick={() => setShowPwd(s => !s)} disabled={loading}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)] transition-colors">
                    {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {form.password && passwordErrors.length > 0 && (
                  <div className="mt-2 p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
                    <p className="text-xs text-yellow-600 font-medium mb-1.5">Password must include:</p>
                    <ul className="text-xs text-yellow-600/90 space-y-0.5">
                      {passwordErrors.map(err => <li key={err}>• {err}</li>)}
                    </ul>
                  </div>
                )}
              </div>

              <div>
                <input
                  type="password"
                  value={form.confirmPassword}
                  onChange={e => set("confirmPassword", e.target.value)}
                  placeholder="Confirm Password"
                  className={inputCls}
                  disabled={loading}
                />
                {form.confirmPassword && form.password !== form.confirmPassword && (
                  <p className="text-xs text-red-500 mt-1">Passwords do not match</p>
                )}
              </div>

              <label className="flex items-start gap-3 cursor-pointer select-none">
                <div
                  onClick={() => !loading && set("agreeTerms", !form.agreeTerms)}
                  className={cn(
                    "mt-0.5 h-5 w-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all",
                    form.agreeTerms ? "bg-violet-600 border-violet-600" : "border-[color:var(--border)]",
                    !loading && "cursor-pointer",
                  )}
                >
                  {form.agreeTerms && <Check className="h-3 w-3 text-white" />}
                </div>
                <span className="text-sm text-[color:var(--muted-foreground)] leading-relaxed">
                  I agree to the{" "}
                  <a href="/terms" className="text-violet-500 hover:underline">Terms of Service</a>
                  {" "}and{" "}
                  <a href="/privacy" className="text-violet-500 hover:underline">Privacy Policy</a>.
                </span>
              </label>

              <div className="flex gap-3">
                <Button type="button" variant="outline" size="icon" onClick={() => setStep(3)} disabled={loading} className="shrink-0">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <Button onClick={handleSubmit} disabled={!canNext || loading} loading={loading} className="flex-1" size="lg">
                  Create Account
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        .animate-in { animation: fadeUp 0.28s ease-out both; }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
