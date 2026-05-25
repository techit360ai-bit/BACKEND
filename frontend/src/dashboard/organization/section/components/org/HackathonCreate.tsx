import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Trophy,
  Calendar,
  DollarSign,
  Scale,
  Handshake,
  Send,
  Plus,
  X,
  Sparkles,
} from "lucide-react";

const judgingDimensions = [
  { id: "problem_clarity", label: "Problem Clarity" },
  { id: "solution_innovation", label: "Solution Innovation" },
  { id: "technical_execution", label: "Technical Execution" },
  { id: "team_communication", label: "Team Communication" },
  { id: "commercial_viability", label: "Commercial Viability" },
];

const defaultPrizes = [
  { rank: "1st place", amount: "$25,000" },
  { rank: "2nd place", amount: "$15,000" },
  { rank: "3rd place", amount: "$10,000" },
];

export function HackathonCreate() {
  const navigate = useNavigate();

  const [title, setTitle] = useState("");
  const [theme, setTheme] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [duration, setDuration] = useState(48);
  const [eligibility, setEligibility] = useState("Open to all builders worldwide");
  const [prizes, setPrizes] = useState(defaultPrizes);
  const [selectedDimensions, setSelectedDimensions] = useState<string[]>(
    judgingDimensions.map((d) => d.id),
  );
  const [partners, setPartners] = useState<string[]>(["TechIT"]);
  const [partnerInput, setPartnerInput] = useState("");
  const [mentorPool, setMentorPool] = useState(12);

  const toggleDimension = (id: string) =>
    setSelectedDimensions((prev) =>
      prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id],
    );

  const addPartner = () => {
    const v = partnerInput.trim();
    if (v && !partners.includes(v)) {
      setPartners([...partners, v]);
      setPartnerInput("");
    }
  };

  const removePartner = (p: string) =>
    setPartners(partners.filter((x) => x !== p));

  const updatePrize = (idx: number, field: "rank" | "amount", value: string) =>
    setPrizes((prev) =>
      prev.map((p, i) => (i === idx ? { ...p, [field]: value } : p)),
    );

  const addPrizeTier = () =>
    setPrizes([...prizes, { rank: `${prizes.length + 1}th place`, amount: "" }]);

  const removePrizeTier = (idx: number) =>
    setPrizes(prizes.filter((_, i) => i !== idx));

  const canPublish =
    title.trim() &&
    theme.trim() &&
    startDate &&
    endDate &&
    selectedDimensions.length >= 3;

  const handlePublish = () => {
    // In a real app this would POST to the API and return an id.
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    navigate(`/org/hackathons/${slug || "new-event"}`);
  };

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto">
      <Link
        to="/org/hackathons"
        className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-indigo-600 transition-colors mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to hackathons
      </Link>

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
          <span className="bg-indigo-100 p-2 rounded-lg">
            <Trophy className="w-7 h-7 text-indigo-600" />
          </span>
          Create new hackathon
        </h1>
        <p className="text-gray-600 mt-2">
          Stage 1 — set the theme, judging framework and partners. The event will
          be published to the Opportunities Board.
        </p>
      </div>

      <div className="space-y-6">
        {/* Theme */}
        <Section icon={Sparkles} title="Theme & basics">
          <Field label="Event title">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. AI for Africa 2026"
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none text-gray-900"
            />
          </Field>
          <Field label="Theme / problem statement">
            <textarea
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              rows={3}
              placeholder="One paragraph describing what you want teams to build."
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none text-gray-900 resize-none"
            />
          </Field>
          <Field label="Eligibility">
            <input
              type="text"
              value={eligibility}
              onChange={(e) => setEligibility(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none text-gray-900"
            />
          </Field>
        </Section>

        {/* Dates */}
        <Section icon={Calendar} title="Dates & duration">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label="Start date">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-indigo-500 outline-none text-gray-900"
              />
            </Field>
            <Field label="End date">
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-indigo-500 outline-none text-gray-900"
              />
            </Field>
            <Field label="Build window (hours)">
              <input
                type="number"
                value={duration}
                onChange={(e) => setDuration(parseInt(e.target.value) || 0)}
                min={6}
                max={336}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-indigo-500 outline-none text-gray-900"
              />
            </Field>
          </div>
        </Section>

        {/* Prizes */}
        <Section icon={DollarSign} title="Prize structure">
          <div className="space-y-3">
            {prizes.map((p, idx) => (
              <div key={idx} className="flex gap-3 items-center">
                <input
                  type="text"
                  value={p.rank}
                  onChange={(e) => updatePrize(idx, "rank", e.target.value)}
                  className="flex-1 px-4 py-2.5 rounded-lg border border-gray-300 focus:border-indigo-500 outline-none text-gray-900"
                />
                <input
                  type="text"
                  value={p.amount}
                  placeholder="$10,000"
                  onChange={(e) => updatePrize(idx, "amount", e.target.value)}
                  className="w-40 px-4 py-2.5 rounded-lg border border-gray-300 focus:border-indigo-500 outline-none text-gray-900"
                />
                <button
                  onClick={() => removePrizeTier(idx)}
                  disabled={prizes.length <= 1}
                  className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  aria-label="Remove tier"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
            <button
              onClick={addPrizeTier}
              className="text-sm text-indigo-600 hover:text-indigo-700 font-semibold flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              Add prize tier
            </button>
          </div>
        </Section>

        {/* Judging */}
        <Section icon={Scale} title="Judging framework">
          <p className="text-xs text-gray-500 mb-3">
            Each enabled dimension is scored 1–10 by judges. These combine with
            three platform-computed metrics (Problem Clarity Score, Team Momentum
            Score, Prototype Demo Readiness time) into a composite Hackathon
            Score per team.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {judgingDimensions.map((d) => {
              const active = selectedDimensions.includes(d.id);
              return (
                <button
                  key={d.id}
                  onClick={() => toggleDimension(d.id)}
                  className={`text-left px-4 py-3 rounded-lg border-2 transition-all ${
                    active
                      ? "border-indigo-500 bg-indigo-50 text-indigo-900"
                      : "border-gray-200 bg-white text-gray-700 hover:border-indigo-200"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">{d.label}</span>
                    <span
                      className={`text-[10px] font-mono uppercase tracking-wider ${active ? "text-indigo-600" : "text-gray-400"}`}
                    >
                      {active ? "On" : "Off"}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
          {selectedDimensions.length < 3 && (
            <p className="text-xs text-amber-600 font-medium mt-3">
              Pick at least 3 dimensions for a meaningful composite score.
            </p>
          )}
        </Section>

        {/* Partners */}
        <Section icon={Handshake} title="Partner organisations">
          <div className="flex gap-2 mb-3">
            <input
              type="text"
              value={partnerInput}
              onChange={(e) => setPartnerInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addPartner()}
              placeholder="Add a partner or sponsor name"
              className="flex-1 px-4 py-2.5 rounded-lg border border-gray-300 focus:border-indigo-500 outline-none text-gray-900"
            />
            <button
              onClick={addPartner}
              className="px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors"
            >
              Add
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {partners.map((p) => (
              <span
                key={p}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-indigo-50 text-indigo-700 text-sm font-medium border border-indigo-100"
              >
                {p}
                <button
                  onClick={() => removePartner(p)}
                  className="text-indigo-400 hover:text-indigo-700"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
          <Field label="Mentor pool size">
            <input
              type="number"
              value={mentorPool}
              onChange={(e) => setMentorPool(parseInt(e.target.value) || 0)}
              min={0}
              className="w-32 px-4 py-2.5 rounded-lg border border-gray-300 focus:border-indigo-500 outline-none text-gray-900"
            />
          </Field>
        </Section>

        {/* Publish row */}
        <div className="flex items-center justify-between bg-white border border-gray-200 rounded-xl p-5">
          <div className="text-sm text-gray-500">
            On publish, the event will be routed to matching builders on the
            Opportunities Board.
          </div>
          <button
            onClick={handlePublish}
            disabled={!canPublish}
            className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-200 disabled:text-gray-500 disabled:cursor-not-allowed text-white rounded-lg font-semibold transition-colors"
          >
            <Send className="w-4 h-4" />
            Publish hackathon
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Trophy;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6">
      <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2 mb-4">
        <Icon className="w-5 h-5 text-indigo-600" />
        {title}
      </h3>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
        {label}
      </label>
      {children}
    </div>
  );
}
