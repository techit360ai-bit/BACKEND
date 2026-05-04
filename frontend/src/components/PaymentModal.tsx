import { useState } from "react";
import {
  X,
  CreditCard,
  Building2,
  CheckCircle2,
  Lock,
  Loader2,
} from "lucide-react";

// Helper function to generate reference (outside of component render)
function generateBankRef(): string {
  return `TECHIT-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

// Types
interface Plan {
  name: string;
  priceNGN: string;
  priceUSD: string;
  credits: string;
}

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  plan: Plan;
  currency: "NGN" | "USD";
}

// Provider configuration with logos, accent colors and descriptions
const providers = [
  {
    id: "paystack",
    label: "Paystack",
    description: "Cards, bank transfer & USSD",
    badge: "Recommended",
    accentColor: "#00C3F7",
    logoEl: (size = 36) => (
      <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
        <rect width="36" height="36" rx="8" fill="#00C3F7" />
        <path
          d="M9 18h18M9 12h18M9 24h12"
          stroke="white"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    id: "flutterwave",
    label: "Flutterwave",
    description: "Cards, mobile money & more",
    badge: null,
    accentColor: "#F5A623",
    logoEl: (size = 36) => (
      <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
        <rect width="36" height="36" rx="8" fill="#F5A623" />
        <path
          d="M10 26 Q18 10 26 26"
          stroke="white"
          strokeWidth="2.5"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M13 22 Q18 14 23 22"
          stroke="white"
          strokeWidth="2.5"
          strokeLinecap="round"
          fill="none"
        />
      </svg>
    ),
  },
  {
    id: "mastercard",
    label: "Mastercard",
    description: "Debit or credit card",
    badge: null,
    accentColor: "#FF5F00",
    logoEl: (size = 36) => (
      <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
        <rect width="36" height="36" rx="8" fill="#1A1F36" />
        <circle cx="14" cy="18" r="7" fill="#EB001B" />
        <circle cx="22" cy="18" r="7" fill="#F79E1B" fillOpacity="0.92" />
        <path d="M18 12.5a7 7 0 010 11A7 7 0 0118 12.5z" fill="#FF5F00" />
      </svg>
    ),
  },
  {
    id: "bank",
    label: "Bank Transfer",
    description: "Direct bank account payment",
    badge: null,
    accentColor: "#10b981",
    logoEl: (size = 36) => (
      <div
        style={{ width: size, height: size }}
        className="rounded-lg bg-emerald-700 flex items-center justify-center shrink-0"
      >
        <Building2
          className="text-white"
          style={{ width: size * 0.5, height: size * 0.5 }}
        />
      </div>
    ),
  },
];

// Shared helpers

const inputCls =
  "w-full rounded-lg bg-slate-800 border border-slate-700 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/20 outline-none px-3.5 py-2.5 text-sm text-white placeholder-slate-500 transition-all";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400">
        {label}
      </label>
      {children}
    </div>
  );
}

// Right panel: Mastercard card form

function CardFormPanel({ provider }: { provider: (typeof providers)[0] }) {
  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");
  const [name, setName] = useState("");

  const fmtCard = (v: string) =>
    v
      .replace(/\D/g, "")
      .slice(0, 16)
      .replace(/(.{4})/g, "$1 ")
      .trim();
  const fmtExpiry = (v: string) => {
    const d = v.replace(/\D/g, "").slice(0, 4);
    return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 pb-3 border-b border-slate-700/60">
        {provider.logoEl(34)}
        <div>
          <p className="text-sm font-semibold text-white">{provider.label}</p>
          <p className="text-xs text-slate-400">{provider.description}</p>
        </div>
      </div>

      <Field label="Cardholder Name">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="John Doe"
          className={inputCls}
        />
      </Field>

      <Field label="Card Number">
        <div className="relative">
          <input
            type="text"
            value={cardNumber}
            onChange={(e) => setCardNumber(fmtCard(e.target.value))}
            placeholder="0000 0000 0000 0000"
            className={`${inputCls} pr-10`}
          />
          <CreditCard className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 pointer-events-none" />
        </div>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Expiry">
          <input
            type="text"
            value={expiry}
            onChange={(e) => setExpiry(fmtExpiry(e.target.value))}
            placeholder="MM / YY"
            className={inputCls}
          />
        </Field>
        <Field label="CVV">
          <input
            type="password"
            value={cvv}
            onChange={(e) =>
              setCvv(e.target.value.replace(/\D/g, "").slice(0, 4))
            }
            placeholder="•••"
            className={inputCls}
          />
        </Field>
      </div>

      {/* Live card preview */}
      <div className="rounded-xl bg-slate-800 border border-slate-700 px-5 py-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="w-8 h-5 rounded bg-amber-400/80" />
          {provider.logoEl(28)}
        </div>
        <p className="font-mono text-sm tracking-widest text-slate-300">
          {cardNumber || "•••• •••• •••• ••••"}
        </p>
        <div className="flex justify-between items-end">
          <div>
            <p className="text-[10px] text-slate-500 uppercase tracking-wide">
              Card Holder
            </p>
            <p className="text-xs text-white font-medium">
              {name || "YOUR NAME"}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-slate-500 uppercase tracking-wide">
              Expires
            </p>
            <p className="text-xs text-white font-medium">
              {expiry || "MM/YY"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Right panel: Redirect (Paystack / Flutterwave)

function RedirectPanel({ provider }: { provider: (typeof providers)[0] }) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center space-y-5 py-6">
      <div className="scale-[1.6] mb-2">{provider.logoEl(36)}</div>
      <div>
        <p className="text-base font-semibold text-white">
          Continue with {provider.label}
        </p>
        <p className="text-sm text-slate-400 mt-2 leading-relaxed max-w-xs">
          You'll be securely redirected to {provider.label} to complete payment.
          Supports cards, bank transfer, USSD &amp; mobile money.
        </p>
      </div>
      <div className="flex flex-wrap gap-2 justify-center">
        {["Visa", "Mastercard", "Verve", "USSD", "Bank Transfer"].map((t) => (
          <span
            key={t}
            className="text-xs px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-400"
          >
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}

// Right panel: Bank transfer

function BankPanel({ amount }: { amount: string }) {
  const [ref] = useState(() => generateBankRef());
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 pb-3 border-b border-slate-700/60">
        {providers.find((p) => p.id === "bank")!.logoEl(34)}
        <div>
          <p className="text-sm font-semibold text-white">Bank Transfer</p>
          <p className="text-xs text-slate-400">Direct bank account payment</p>
        </div>
      </div>
      <div className="rounded-xl bg-slate-800/60 border border-slate-700 divide-y divide-slate-700/60">
        {[
          { label: "Bank", value: "Providus Bank" },
          { label: "Account Name", value: "TechIT Technologies Ltd" },
          { label: "Account Number", value: "5901234567" },
          { label: "Amount", value: amount },
          { label: "Reference", value: ref },
        ].map(({ label, value }) => (
          <div
            key={label}
            className="flex justify-between items-center px-4 py-3"
          >
            <span className="text-xs text-slate-500">{label}</span>
            <span
              className={`text-sm font-semibold ${label === "Amount" ? "text-cyan-400" : "text-white"}`}
            >
              {value}
            </span>
          </div>
        ))}
      </div>
      <p className="text-xs text-slate-400 text-center leading-relaxed">
        Credits activate within{" "}
        <span className="text-cyan-400 font-medium">5–15 minutes</span> after
        payment confirmation.
      </p>
    </div>
  );
}

// Success screen

function SuccessScreen({ plan, onClose }: { plan: Plan; onClose: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 space-y-5 text-center">
      <div className="relative">
        <div className="h-20 w-20 rounded-full bg-emerald-500/20 flex items-center justify-center">
          <CheckCircle2 className="h-10 w-10 text-emerald-400" />
        </div>
        <div className="absolute inset-0 rounded-full border-2 border-emerald-400/30 animate-ping" />
      </div>
      <div>
        <h3 className="text-xl font-bold text-white">Payment Successful!</h3>
        <p className="text-sm text-slate-400 mt-1">
          Your <span className="text-cyan-400 font-semibold">{plan.name}</span>{" "}
          plan is now active.
        </p>
      </div>
      <div className="w-full max-w-xs rounded-xl bg-slate-800/70 border border-slate-700 px-5 py-4">
        <p className="text-xs text-slate-400">Credits added to your wallet</p>
        <p className="text-3xl font-bold text-cyan-400 mt-1">{plan.credits}</p>
      </div>
      <button
        onClick={onClose}
        className="w-full max-w-xs rounded-xl bg-cyan-500 hover:bg-cyan-600 text-white font-semibold py-3 transition-colors"
      >
        Back to Wallet
      </button>
    </div>
  );
}

// Main modal

export default function PaymentModal({
  isOpen,
  onClose,
  plan,
  currency,
}: PaymentModalProps) {
  const [selectedId, setSelectedId] = useState("paystack");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const amount = currency === "NGN" ? plan.priceNGN : plan.priceUSD;
  const selected = providers.find((p) => p.id === selectedId)!;

  const handleClose = () => {
    setSelectedId("paystack");
    setLoading(false);
    setSuccess(false);
    onClose();
  };
  const handlePay = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setSuccess(true);
    }, 2200);
  };

  const payLabel =
    selected.id === "bank"
      ? "I've Made the Transfer"
      : selected.id === "paystack" || selected.id === "flutterwave"
        ? `Continue to ${selected.label}`
        : `Pay ${amount}`;

  const payBtnCls =
    selected.id === "bank"
      ? "bg-emerald-600 hover:bg-emerald-700"
      : "bg-cyan-500 hover:bg-cyan-600";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Shell */}
      <div className="relative bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl shadow-black/60 overflow-hidden">
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2 text-xs">
            <Lock className="h-3.5 w-3.5 text-emerald-400" />
            <span className="text-emerald-400 font-semibold">
              Secure Payment
            </span>
            <span className="text-slate-600 mx-1">·</span>
            <span className="text-slate-400">
              {plan.name} Plan — {plan.credits}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm font-bold text-cyan-400">{amount}</span>
            <button
              onClick={handleClose}
              className="p-1.5 hover:bg-slate-800 rounded-lg transition-colors"
            >
              <X className="h-4 w-4 text-slate-400 hover:text-white" />
            </button>
          </div>
        </div>

        {success ? (
          <div className="px-8 pb-6">
            <SuccessScreen plan={plan} onClose={handleClose} />
          </div>
        ) : (
          <div className="flex" style={{ minHeight: 440 }}>
            {/* ── LEFT: provider list ── */}
            <div className="w-52 shrink-0 border-r border-slate-800 bg-slate-950/60 p-4 flex flex-col gap-1">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 px-1">
                Pay with
              </p>

              {providers.map((p) => {
                const isActive = selectedId === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => setSelectedId(p.id)}
                    className="w-full flex items-center gap-2.5 rounded-xl px-2.5 py-2.5 text-left transition-all duration-150 focus:outline-none"
                    style={{
                      background: isActive
                        ? "rgba(30,41,59,0.9)"
                        : "transparent",
                      border: isActive
                        ? `1.5px solid ${p.accentColor}`
                        : "1.5px solid transparent",
                      boxShadow: isActive
                        ? `0 0 0 1px ${p.accentColor}22`
                        : "none",
                    }}
                  >
                    {/* Logo */}
                    <div className="shrink-0">{p.logoEl(34)}</div>

                    {/* Text */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-semibold text-white leading-tight">
                          {p.label}
                        </span>
                        {p.badge && (
                          <span className="text-[9px] bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 px-1.5 py-px rounded-full font-bold">
                            {p.badge}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-500 mt-0.5 truncate leading-tight">
                        {p.description}
                      </p>
                    </div>

                    {/* Active indicator dot */}
                    <div
                      className="shrink-0 w-2 h-2 rounded-full transition-all duration-150"
                      style={{
                        background: isActive ? p.accentColor : "transparent",
                      }}
                    />
                  </button>
                );
              })}

              {/* Trust badges */}
              <div className="mt-auto pt-5 space-y-2">
                {[
                  "256-bit SSL encrypted",
                  "PCI DSS compliant",
                  "Credits never expire",
                ].map((t) => (
                  <div key={t} className="flex items-center gap-2 px-1">
                    <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0" />
                    <span className="text-[10px] text-slate-500 leading-tight">
                      {t}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* ── RIGHT: dynamic panel ── */}
            <div className="flex-1 flex flex-col p-6 overflow-y-auto">
              {/* Accent top bar — matches selected provider colour */}
              <div
                className="absolute top-0 left-52 right-0 h-0.5 transition-colors duration-300"
                style={{ background: selected.accentColor }}
              />

              <div className="flex-1">
                {selected.id === "mastercard" && (
                  <CardFormPanel provider={selected} />
                )}
                {(selected.id === "paystack" ||
                  selected.id === "flutterwave") && (
                  <RedirectPanel provider={selected} />
                )}
                {selected.id === "bank" && <BankPanel amount={amount} />}
              </div>

              {/* Pay button */}
              <div className="pt-5 space-y-2.5">
                <button
                  onClick={handlePay}
                  disabled={loading}
                  className={`w-full rounded-xl font-semibold py-3 text-sm text-white transition-colors flex items-center justify-center gap-2 disabled:opacity-60 ${payBtnCls}`}
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Processing…
                    </>
                  ) : (
                    <>
                      <Lock className="h-3.5 w-3.5" />
                      {payLabel}
                    </>
                  )}
                </button>
                <p className="text-center text-xs text-slate-500">
                  Current balance:{" "}
                  <span className="text-white font-medium">1,240 credits</span>
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
