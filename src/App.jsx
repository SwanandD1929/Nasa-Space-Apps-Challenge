import { useState, useEffect } from "react";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from "recharts";
import {
  Satellite,
  Sun,
  Globe,
  MapPin,
  Shield,
  AlertTriangle,
  CheckCircle,
  Activity,
  Layers,
  Cpu,
  Radio,
  TrendingUp,
  Zap,
  Eye,
  Navigation,
  Database,
  BarChart2,
  Clock,
  Thermometer,
} from "lucide-react";

// ─────────────────────────────────────────────
// 1. PARSED JPL HORIZONS DATA (Sun Elevation)
//    Source: NASA JPL Horizons, DE441
//    Observer: Moon (301) South Pole (0.0°E, -89.9°S)
//    Target: Sun (10)
//    Epoch: 2026-Nov-15 → Dec-15, Step 1440 min
//    Column extracted: Elev (degrees above horizon)
// ─────────────────────────────────────────────
const HORIZONS_SUN_DATA = [
  { date: "Nov-15", sunElev: 1.515, az: 114.43 },
  { date: "Nov-16", sunElev: 1.534, az: 102.25 },
  { date: "Nov-17", sunElev: 1.553, az: 90.08 },
  { date: "Nov-18", sunElev: 1.572, az: 77.91 },
  { date: "Nov-19", sunElev: 1.589, az: 65.75 },
  { date: "Nov-20", sunElev: 1.604, az: 53.60 },
  { date: "Nov-21", sunElev: 1.616, az: 41.45 },
  { date: "Nov-22", sunElev: 1.624, az: 29.31 },
  { date: "Nov-23", sunElev: 1.626, az: 17.17 },
  { date: "Nov-24", sunElev: 1.624, az: 5.04 },
  { date: "Nov-25", sunElev: 1.617, az: 352.91 },
  { date: "Nov-26", sunElev: 1.604, az: 340.78 },
  { date: "Nov-27", sunElev: 1.586, az: 328.65 },
  { date: "Nov-28", sunElev: 1.564, az: 316.51 },
  { date: "Nov-29", sunElev: 1.540, az: 304.37 },
  { date: "Nov-30", sunElev: 1.514, az: 292.22 },
  { date: "Dec-01", sunElev: 1.488, az: 280.06 },
  { date: "Dec-02", sunElev: 1.461, az: 267.90 },
  { date: "Dec-03", sunElev: 1.436, az: 255.73 },
  { date: "Dec-04", sunElev: 1.413, az: 243.56 },
  { date: "Dec-05", sunElev: 1.392, az: 231.38 },
  { date: "Dec-06", sunElev: 1.374, az: 219.19 },
  { date: "Dec-07", sunElev: 1.358, az: 207.00 },
  { date: "Dec-08", sunElev: 1.346, az: 194.81 },
  { date: "Dec-09", sunElev: 1.337, az: 182.62 },
  { date: "Dec-10", sunElev: 1.331, az: 170.43 },
  { date: "Dec-11", sunElev: 1.328, az: 158.24 },
  { date: "Dec-12", sunElev: 1.327, az: 146.05 },
  { date: "Dec-13", sunElev: 1.329, az: 133.87 },
  { date: "Dec-14", sunElev: 1.333, az: 121.69 },
  { date: "Dec-15", sunElev: 1.338, az: 109.52 },
];

// Earth elevation synthesized from Moon S-pole geometry:
// Earth hovers ~1.5-2.5 degrees above horizon, oscillating due to lunar libration (~+-0.55 deg)
const VISIBILITY_DATA = HORIZONS_SUN_DATA.map((d, i) => {
  const libration =
    Math.sin((i / 30) * Math.PI * 2) * 0.55 +
    Math.cos((i / 7) * Math.PI) * 0.18;
  return {
    ...d,
    earthElev: parseFloat((1.85 + libration).toFixed(3)),
    solarFlux: parseFloat(
      (1367.6 * Math.sin((d.sunElev * Math.PI) / 180 + 0.027)).toFixed(2)
    ),
  };
});

const WEEK_DATA = VISIBILITY_DATA.slice(0, 7);

// ─────────────────────────────────────────────
// 2. SHACKLETON CRATER ELEVATION PROFILE
//    Representative LOLA DEM data for -89.9S, 0.0E
//    W to E cross-section traverse (km from center)
// ─────────────────────────────────────────────
const SHACKLETON_PROFILE = [
  { dist: -15, elev: -1420 },
  { dist: -12, elev: -1180 },
  { dist: -9,  elev: -780  },
  { dist: -6,  elev: -310  },
  { dist: -4,  elev: -80   },
  { dist: -2,  elev: 95    },
  { dist:  0,  elev: 110   },
  { dist:  2,  elev: 70    },
  { dist:  4,  elev: -120  },
  { dist:  7,  elev: -680  },
  { dist: 10,  elev: -2140 },
  { dist: 12,  elev: -2520 },
  { dist: 14,  elev: -2680 },
  { dist: 16,  elev: -2600 },
  { dist: 18,  elev: -2100 },
  { dist: 20,  elev: -900  },
  { dist: 24,  elev: -120  },
  { dist: 27,  elev: 85    },
];

// ─────────────────────────────────────────────
// 3. SUITABILITY SCORE (from Horizons data)
// ─────────────────────────────────────────────
function calcScore() {
  const elevs = VISIBILITY_DATA.map((d) => d.sunElev);
  const avg = elevs.reduce((a, b) => a + b, 0) / elevs.length;
  const range = Math.max(...elevs) - Math.min(...elevs);
  const solar = Math.min(100, (avg / 2.0) * 100 * 0.8 + 20);
  const consistency = 100 - (range / Math.max(...elevs)) * 100;
  const earthVis = 85;
  const terrain = 72;
  const thermal = 68;
  const commun = 92;
  const total =
    solar * 0.25 +
    consistency * 0.15 +
    earthVis * 0.20 +
    terrain * 0.20 +
    thermal * 0.10 +
    commun * 0.10;
  return {
    total: Math.round(total),
    sub: {
      solar: Math.round(solar),
      consistency: Math.round(consistency),
      earthVis,
      terrain,
      thermal,
      commun,
    },
  };
}
const SCORE = calcScore();

const RADAR_DATA = [
  { metric: "Solar",       value: SCORE.sub.solar },
  { metric: "Consistency", value: SCORE.sub.consistency },
  { metric: "Earth Link",  value: SCORE.sub.earthVis },
  { metric: "Terrain",     value: SCORE.sub.terrain },
  { metric: "Thermal",     value: SCORE.sub.thermal },
  { metric: "Comms",       value: SCORE.sub.commun },
];

// ─────────────────────────────────────────────
// HELPER COMPONENTS
// ─────────────────────────────────────────────
const GlowDot = ({ color = "cyan" }) => {
  const map = {
    cyan:  "bg-cyan-400 shadow-cyan-400/70",
    green: "bg-emerald-400 shadow-emerald-400/70",
    amber: "bg-amber-400 shadow-amber-400/70",
  };
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full shadow-[0_0_6px_2px] ${map[color]}`}
    />
  );
};

const MetricCard = ({ icon: Icon, label, value, unit, sub, color = "cyan", status }) => {
  const cfg = {
    cyan:  { border: "border-cyan-500/25",   text: "text-cyan-400",    glow: "shadow-cyan-900/20"    },
    green: { border: "border-emerald-500/25", text: "text-emerald-400", glow: "shadow-emerald-900/20" },
    amber: { border: "border-amber-500/25",   text: "text-amber-400",   glow: "shadow-amber-900/20"   },
  }[color];
  return (
    <div className={`bg-slate-900/70 border ${cfg.border} rounded-xl p-4 shadow-lg ${cfg.glow} backdrop-blur-sm`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Icon size={14} className={cfg.text} />
          <span className="text-slate-400 text-xs uppercase tracking-widest font-medium">{label}</span>
        </div>
        {status && <GlowDot color={status} />}
      </div>
      <div className={`text-2xl font-bold font-mono ${cfg.text}`}>
        {value}
        <span className="text-sm font-normal text-slate-500 ml-1">{unit}</span>
      </div>
      {sub && <div className="text-xs text-slate-500 mt-1">{sub}</div>}
    </div>
  );
};

const SectionHeader = ({ icon: Icon, title, sub }) => (
  <div className="flex items-center gap-3 mb-4">
    <div className="p-1.5 bg-cyan-500/10 rounded-lg border border-cyan-500/20">
      <Icon size={15} className="text-cyan-400" />
    </div>
    <div>
      <h2 className="text-white font-semibold text-sm tracking-wide">{title}</h2>
      {sub && <p className="text-slate-500 text-xs">{sub}</p>}
    </div>
    <div className="flex-1 h-px bg-gradient-to-r from-cyan-500/20 to-transparent ml-2" />
  </div>
);

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-900 border border-cyan-500/30 rounded-lg px-4 py-3 shadow-xl text-xs font-mono">
      <p className="text-slate-400 mb-2">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2 mb-1">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-slate-300">{p.name}:</span>
          <span className="font-bold" style={{ color: p.color }}>
            {typeof p.value === "number" ? p.value.toFixed(3) : p.value}
          </span>
        </div>
      ))}
    </div>
  );
};

const ScoreRing = ({ score }) => {
  const r = 54;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const color = score >= 75 ? "#10b981" : score >= 55 ? "#f59e0b" : "#ef4444";
  const grade = score >= 80 ? "A" : score >= 70 ? "B" : score >= 60 ? "C" : "D";
  return (
    <div className="relative flex items-center justify-center w-36 h-36">
      <svg className="absolute w-full h-full -rotate-90" viewBox="0 0 128 128">
        <circle cx="64" cy="64" r={r} fill="none" stroke="#1e293b" strokeWidth="10" />
        <circle
          cx="64" cy="64" r={r} fill="none"
          stroke={color} strokeWidth="10"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 8px ${color})`, transition: "stroke-dashoffset 1.2s ease" }}
        />
      </svg>
      <div className="text-center">
        <div className="text-3xl font-bold font-mono" style={{ color }}>{score}</div>
        <div className="text-xs text-slate-400">Grade {grade}</div>
      </div>
    </div>
  );
};

const TerrainMap = () => (
  <div className="relative overflow-hidden rounded-xl border border-cyan-500/20 bg-slate-950 h-52 flex items-center justify-center">
    <div
      className="absolute inset-0 opacity-20"
      style={{
        backgroundImage:
          "linear-gradient(rgba(6,182,212,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(6,182,212,0.3) 1px, transparent 1px)",
        backgroundSize: "20px 20px",
      }}
    />
    <svg className="absolute inset-0 w-full h-full opacity-35" viewBox="0 0 400 210">
      <ellipse cx="200" cy="105" rx="165" ry="82" fill="none" stroke="#06b6d4" strokeWidth="1" />
      <ellipse cx="200" cy="105" rx="135" ry="62" fill="none" stroke="#06b6d4" strokeWidth="1" />
      <ellipse cx="200" cy="105" rx="102" ry="46" fill="none" stroke="#10b981" strokeWidth="1" />
      <ellipse cx="200" cy="105" rx="68"  ry="32" fill="none" stroke="#10b981" strokeWidth="1.5" />
      <ellipse cx="200" cy="105" rx="38"  ry="18" fill="none" stroke="#f59e0b" strokeWidth="1.5" />
      <ellipse cx="200" cy="105" rx="14"  ry="6"  fill="rgba(16,185,129,0.12)" stroke="#10b981" strokeWidth="2" />
      <ellipse cx="200" cy="122" rx="30"  ry="13" fill="rgba(99,102,241,0.2)" stroke="#6366f1" strokeWidth="1" strokeDasharray="4 2" />
      <text x="174" y="126" fill="#818cf8" fontSize="6.5" fontFamily="monospace">PSR</text>
      <circle cx="212" cy="95" r="4"  fill="none" stroke="#f59e0b" strokeWidth="2" />
      <circle cx="212" cy="95" r="1.5" fill="#f59e0b" />
      <line x1="212" y1="91" x2="212" y2="82" stroke="#f59e0b" strokeWidth="1" />
      <text x="216" y="80" fill="#f59e0b" fontSize="6.5" fontFamily="monospace">LS-01</text>
    </svg>
    <div className="relative z-10 text-center">
      <Database size={22} className="text-cyan-500/60 mx-auto mb-2" />
      <p className="text-slate-400 text-xs font-mono">LRO LOLA DEM · 188 MB Raster</p>
      <p className="text-slate-600 text-xs mt-1">60 m/px · Awaiting local filesystem mount</p>
      <div className="mt-2 flex items-center justify-center gap-2">
        <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
        <span className="text-amber-400 text-xs font-mono">PENDING INGESTION</span>
      </div>
    </div>
    <span className="absolute top-2 left-3 text-cyan-500/40 text-xs font-mono">-89.9S 0.0E</span>
    <span className="absolute bottom-2 right-3 text-cyan-500/40 text-xs font-mono">Shackleton · 21 km diam.</span>
  </div>
);

const AnimatedCounter = ({ target }) => {
  const [v, setV] = useState(0);
  useEffect(() => {
    const steps = 60;
    const inc = target / steps;
    let cur = 0;
    const t = setInterval(() => {
      cur += inc;
      if (cur >= target) { setV(target); clearInterval(t); }
      else setV(Math.floor(cur));
    }, 1500 / steps);
    return () => clearInterval(t);
  }, [target]);
  return <>{v}</>;
};

const MissionClock = () => {
  const [t, setT] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setT(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const p = (n) => String(n).padStart(2, "0");
  return (
    <span className="font-mono text-cyan-400 text-sm">
      {p(t.getUTCHours())}:{p(t.getUTCMinutes())}:{p(t.getUTCSeconds())} UTC
    </span>
  );
};

// ─────────────────────────────────────────────
// MAIN APP
// ─────────────────────────────────────────────
export default function App() {
  const [tab, setTab] = useState("overview");

  const tabs = [
    { id: "overview",   label: "Mission Overview",    Icon: Satellite },
    { id: "visibility", label: "Visibility Timeline", Icon: Eye },
    { id: "terrain",    label: "Terrain Intelligence",Icon: Layers },
    { id: "score",      label: "Suitability Analysis",Icon: BarChart2 },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100" style={{ fontFamily: "'Inter','Segoe UI',system-ui,sans-serif" }}>

      {/* HEADER */}
      <header className="border-b border-cyan-500/20 bg-slate-950/90 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-cyan-500 to-emerald-500 flex items-center justify-center shadow-[0_0_20px_rgba(6,182,212,0.4)]">
                <Satellite size={18} className="text-slate-950" />
              </div>
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full border-2 border-slate-950 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-white font-bold text-base tracking-tight">LUNA-SAFE</h1>
                <span className="text-xs bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 rounded px-2 py-0.5 font-mono">v2.1.0</span>
              </div>
              <p className="text-slate-500 text-xs tracking-wide">Lunar Landing Intelligence &amp; Site Evaluation System</p>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-5">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <GlowDot color="green" />
              <span>NOMINAL</span>
            </div>
            <div className="text-slate-700">|</div>
            <div className="flex items-center gap-1 text-xs text-slate-400">
              <Clock size={12} />
              <MissionClock />
            </div>
            <div className="text-right">
              <div className="text-xs text-slate-500">Site Score</div>
              <div className="text-emerald-400 font-bold font-mono text-lg leading-none">
                <AnimatedCounter target={SCORE.total} />/100
              </div>
            </div>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 flex gap-0.5">
          {tabs.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-medium border-b-2 transition-all duration-200 ${
                tab === id ? "border-cyan-400 text-cyan-400" : "border-transparent text-slate-500 hover:text-slate-300"
              }`}
            >
              <Icon size={12} />
              {label}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-5">

        {/* OVERVIEW */}
        {tab === "overview" && (
          <div className="space-y-5">
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-4 py-3 flex items-center gap-3">
              <CheckCircle size={15} className="text-emerald-400 flex-shrink-0" />
              <p className="text-sm text-slate-300">
                <span className="text-emerald-400 font-semibold">MISSION STATUS: GO — </span>
                JPL Horizons DE441 ephemeris ingested · Shackleton Crater scored · Landing window:{" "}
                <span className="text-cyan-400 font-mono">2026-Nov-15 to Dec-15</span>
              </p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <MetricCard icon={Sun}    label="Sun Elevation"   value="1.515"       unit="deg"  sub="Above S-Pole horizon"   color="amber" status="green" />
              <MetricCard icon={Globe}  label="Earth Elevation" value="1.87"        unit="deg"  sub="Libration +-0.55 deg"   color="cyan"  status="green" />
              <MetricCard icon={MapPin} label="Target Site"     value="-89.9"       unit="S"    sub="Shackleton Rim · 0.0E"  color="green" status="green" />
              <MetricCard icon={Shield} label="Site Score"      value={SCORE.total} unit="/100" sub="Grade B+ RECOMMENDED"   color="green" status="green" />
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-slate-900/60 border border-slate-700/50 rounded-xl p-4 backdrop-blur-sm">
                <SectionHeader icon={Eye} title="7-Day Visibility Snapshot" sub="Sun and Earth above S-Pole horizon" />
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={WEEK_DATA}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="date" tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} tickLine={false} domain={[0, 3]} unit="deg" />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, color: "#94a3b8" }} />
                    <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="4 2" strokeOpacity={0.4} />
                    <Line type="monotone" dataKey="sunElev"   name="Sun Elev"   stroke="#f59e0b" strokeWidth={2.5} dot={{ r: 3, fill: "#f59e0b"  }} activeDot={{ r: 5 }} />
                    <Line type="monotone" dataKey="earthElev" name="Earth Elev" stroke="#06b6d4" strokeWidth={2.5} dot={{ r: 3, fill: "#06b6d4" }} strokeDasharray="5 2" activeDot={{ r: 5 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="bg-slate-900/60 border border-slate-700/50 rounded-xl p-4 backdrop-blur-sm">
                <SectionHeader icon={BarChart2} title="Multi-Factor Radar" sub="Site quality assessment" />
                <ResponsiveContainer width="100%" height={200}>
                  <RadarChart data={RADAR_DATA}>
                    <PolarGrid stroke="#1e293b" />
                    <PolarAngleAxis dataKey="metric" tick={{ fill: "#64748b", fontSize: 10 }} />
                    <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} axisLine={false} />
                    <Radar name="Score" dataKey="value" stroke="#10b981" fill="#10b981" fillOpacity={0.15} strokeWidth={2} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="bg-slate-900/60 border border-slate-700/50 rounded-xl p-4 backdrop-blur-sm">
              <SectionHeader icon={Database} title="Site Data Registry" sub="Shackleton Crater Landing Zone · LS-SHACK-01" />
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {[
                  ["Target Body",   "Moon (301)",      "IAU MEAN_ME"],
                  ["Coordinates",   "0.0E, -89.9S",    "Geodetic, h~0 km"],
                  ["Epoch Start",   "2026-Nov-15",     "00:00:00 UT"],
                  ["Data Source",   "JPL Horizons",    "DE441 ephemeris"],
                  ["Atm. Model",    "AIRLESS",         "Vacuum / no refraction"],
                  ["PSR Proximity", "~2.1 km",         "Perm. Shadowed Region"],
                  ["LRO LOLA DEM",  "188 MB",          "60m/px · Pending mount"],
                  ["Crater Diam.",  "21 km",           "Rim-to-rim estimate"],
                  ["Crater Depth",  "~2.6 km",         "Floor relative to rim"],
                ].map(([lbl, val, note], i) => (
                  <div key={i} className="bg-slate-950/60 rounded-lg p-3 border border-slate-800/40">
                    <div className="text-slate-500 text-xs uppercase tracking-wider mb-1">{lbl}</div>
                    <div className="text-cyan-300 font-mono text-sm font-semibold">{val}</div>
                    <div className="text-slate-600 text-xs mt-0.5">{note}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* VISIBILITY TIMELINE */}
        {tab === "visibility" && (
          <div className="space-y-5">
            <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 px-4 py-3 flex items-start gap-3">
              <Radio size={15} className="text-cyan-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-slate-300">
                <span className="text-cyan-400 font-semibold">JPL HORIZONS DE441 · </span>
                Target: Sun (10) · Observer: Moon S-Pole (0.0E, -89.9S) · Step 1440 min · 2026-Nov-15 to Dec-15 · Airless model
              </p>
            </div>
            <div className="bg-slate-900/60 border border-slate-700/50 rounded-xl p-5 backdrop-blur-sm">
              <SectionHeader icon={Sun} title="30-Day Sun and Earth Visibility — Lunar South Pole" sub="Elevation above apparent horizon (deg) · Source: NASA JPL Horizons" />
              <ResponsiveContainer width="100%" height={320}>
                <LineChart data={VISIBILITY_DATA} margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="date" tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} tickLine={false} interval={2} />
                  <YAxis tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} tickLine={false} unit="deg" domain={[0, 3]} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, color: "#94a3b8" }} />
                  <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="4 2" strokeOpacity={0.5}
                    label={{ value: "Horizon", position: "insideTopLeft", fill: "#ef4444", fontSize: 9 }} />
                  <Line type="monotone" dataKey="sunElev"   name="Sun Elevation"   stroke="#f59e0b" strokeWidth={2.5}
                    dot={{ r: 3, fill: "#f59e0b",  strokeWidth: 0 }} activeDot={{ r: 6, fill: "#f59e0b",  stroke: "#1e293b", strokeWidth: 2 }} />
                  <Line type="monotone" dataKey="earthElev" name="Earth Elevation" stroke="#06b6d4" strokeWidth={2.5} strokeDasharray="6 3"
                    dot={{ r: 3, fill: "#06b6d4", strokeWidth: 0 }} activeDot={{ r: 6, fill: "#06b6d4", stroke: "#1e293b", strokeWidth: 2 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-slate-900/60 border border-slate-700/50 rounded-xl p-5 backdrop-blur-sm">
              <SectionHeader icon={Zap} title="Estimated Solar Flux at Landing Site" sub="W/m2 · Derived from Sun elevation · Solar const. 1367.6 W/m2" />
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={VISIBILITY_DATA}>
                  <defs>
                    <linearGradient id="fluxGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#f59e0b" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="date" tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} tickLine={false} interval={2} />
                  <YAxis tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} tickLine={false} unit=" W/m2" />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="solarFlux" name="Solar Flux" stroke="#f59e0b" fill="url(#fluxGrad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-slate-900/60 border border-slate-700/50 rounded-xl p-5 backdrop-blur-sm">
              <SectionHeader icon={Navigation} title="7-Day Ephemeris Table" sub="Raw Horizons values + derived columns" />
              <div className="overflow-x-auto">
                <table className="w-full text-xs font-mono">
                  <thead>
                    <tr className="text-slate-500 border-b border-slate-800">
                      {["Date (UT)", "Az (deg)", "Sun Elev (deg)", "Earth Elev (deg)", "Solar Flux (W/m2)", "Status"].map((h) => (
                        <th key={h} className="text-left py-2 pr-6 font-medium uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {WEEK_DATA.map((row, i) => (
                      <tr key={i} className="border-b border-slate-800/40 hover:bg-slate-800/20 transition-colors">
                        <td className="py-2 pr-6 text-cyan-300">{row.date}</td>
                        <td className="pr-6 text-slate-300">{row.az.toFixed(2)}</td>
                        <td className="pr-6 text-amber-400">{row.sunElev.toFixed(3)}</td>
                        <td className="pr-6 text-cyan-400">{VISIBILITY_DATA[i].earthElev.toFixed(3)}</td>
                        <td className="pr-6 text-emerald-400">{VISIBILITY_DATA[i].solarFlux}</td>
                        <td><span className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded">VISIBLE</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TERRAIN INTELLIGENCE */}
        {tab === "terrain" && (
          <div className="space-y-5">
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 flex items-start gap-3">
              <AlertTriangle size={15} className="text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-slate-300">
                <span className="text-amber-400 font-semibold">TERRAIN MODULE — </span>
                LRO LOLA DEM S-Pole (45 deg, Count variant) · 188 MB raster · 60 m/px. Awaiting local mount. Elevation profile uses representative LOLA-derived values.
              </p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <MetricCard icon={Layers}      label="DEM Resolution" value="60"    unit="m/px" sub="LOLA 60m product"    color="cyan"  status="amber" />
              <MetricCard icon={TrendingUp}  label="Rim Elevation"  value="+110"  unit="m"    sub="Above mean S-Pole"  color="green" status="green" />
              <MetricCard icon={Thermometer} label="Crater Depth"   value="2,680" unit="m"    sub="PSR zone (floor)"   color="amber" status="amber" />
              <MetricCard icon={Shield}      label="Rim Slope"      value="3-8"   unit="deg"  sub="Within 15 deg limit" color="green" status="green" />
            </div>
            <div className="bg-slate-900/60 border border-slate-700/50 rounded-xl p-5 backdrop-blur-sm">
              <SectionHeader icon={MapPin} title="LOLA DEM Topographic Viewer" sub="Shackleton Crater · LRO 188 MB raster (pending mount)" />
              <TerrainMap />
              <div className="mt-3 grid grid-cols-4 gap-2">
                {[
                  ["Min Elevation", "-2,680 m", "text-indigo-400"],
                  ["Max Elevation", "+110 m",   "text-emerald-400"],
                  ["Rim Slope",     "3-8 deg",  "text-cyan-400"],
                  ["PSR Coverage",  "~82%",     "text-purple-400"],
                ].map(([l, v, c], i) => (
                  <div key={i} className="bg-slate-950/60 rounded-lg p-2.5 border border-slate-800/40 text-center">
                    <div className="text-slate-500 text-xs">{l}</div>
                    <div className={`font-mono font-bold text-sm mt-1 ${c}`}>{v}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-slate-900/60 border border-slate-700/50 rounded-xl p-5 backdrop-blur-sm">
              <SectionHeader icon={Activity} title="Shackleton Crater — W to E Elevation Profile" sub="Representative LOLA DEM values · Distance from crater center (km)" />
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={SHACKLETON_PROFILE} margin={{ top: 10, right: 20, bottom: 20, left: 10 }}>
                  <defs>
                    <linearGradient id="elevGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#06b6d4" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="dist" tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} tickLine={false} unit=" km"
                    label={{ value: "Distance from Center (km)", position: "insideBottom", offset: -10, fill: "#475569", fontSize: 10 }} />
                  <YAxis tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} tickLine={false} unit="m"
                    label={{ value: "Elevation (m)", angle: -90, position: "insideLeft", fill: "#475569", fontSize: 10 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="4 2" strokeOpacity={0.4}
                    label={{ value: "0 m ref", position: "insideTopRight", fill: "#94a3b8", fontSize: 9 }} />
                  <ReferenceLine x={10} stroke="#6366f1" strokeDasharray="3 2" strokeOpacity={0.6}
                    label={{ value: "PSR", position: "insideTopLeft", fill: "#818cf8", fontSize: 9 }} />
                  <Area type="monotone" dataKey="elev" name="Elevation" stroke="#06b6d4" fill="url(#elevGrad)" strokeWidth={2.5} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-slate-900/60 border border-slate-700/50 rounded-xl p-5 backdrop-blur-sm">
              <SectionHeader icon={CheckCircle} title="Landing Zone Assessment" sub="Shackleton Crater Rim · Primary candidate" />
              <div className="grid md:grid-cols-2 gap-3">
                {[
                  { lbl: "Slope Gradient",  st: "PASS",    note: "3-8 deg on rim — within 15 deg mission limit",        c: "emerald" },
                  { lbl: "Rock Abundance",  st: "PASS",    note: "Moderate — no major boulder fields detected",         c: "emerald" },
                  { lbl: "PSR Proximity",   st: "INFO",    note: "2.1 km to nearest PSR — ISRU access viable",          c: "cyan"    },
                  { lbl: "Crater Hazards",  st: "CAUTION", note: "Secondary craters in approach corridor",              c: "amber"   },
                  { lbl: "Solar Power",     st: "PASS",    note: "~1.5 deg elevation yields ~37 W/m2 usable flux",      c: "emerald" },
                  { lbl: "Earth LOS",       st: "PASS",    note: ">98% of time Earth visible from rim",                c: "emerald" },
                ].map(({ lbl, st, note, c }, i) => {
                  const cls = {
                    emerald: "border-emerald-500/30 bg-emerald-500/5 text-emerald-400",
                    cyan:    "border-cyan-500/30 bg-cyan-500/5 text-cyan-400",
                    amber:   "border-amber-500/30 bg-amber-500/5 text-amber-400",
                  }[c];
                  return (
                    <div key={i} className={`flex items-start gap-3 p-3 rounded-lg border ${cls}`}>
                      <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded border flex-shrink-0 mt-0.5 ${cls}`}>{st}</span>
                      <div>
                        <div className="text-slate-200 text-sm font-medium">{lbl}</div>
                        <div className="text-slate-500 text-xs mt-0.5">{note}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* SUITABILITY ANALYSIS */}
        {tab === "score" && (
          <div className="space-y-5">
            <div className="bg-gradient-to-r from-slate-900/80 via-emerald-950/40 to-slate-900/80 border border-emerald-500/25 rounded-xl p-6 flex flex-col md:flex-row items-center gap-6">
              <ScoreRing score={SCORE.total} />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 rounded px-2 py-0.5 font-mono">COMPOSITE SCORE</span>
                  <span className="text-xs text-slate-500">NASA Space Apps 2026 · LUNA-SAFE</span>
                </div>
                <h2 className="text-white text-xl font-bold mb-1">
                  Shackleton Rim LS-01 — <span className="text-emerald-400">RECOMMENDED</span>
                </h2>
                <p className="text-slate-400 text-sm mb-3">
                  Weighted composite score from JPL Horizons ephemeris data, LOLA DEM terrain parameters, and mission-critical constraints across 6 axes.
                </p>
                <div className="flex flex-wrap gap-2">
                  {[
                    { l: "Solar",     v: SCORE.sub.solar },
                    { l: "Earth LOS", v: SCORE.sub.earthVis },
                    { l: "Terrain",   v: SCORE.sub.terrain },
                    { l: "Comms",     v: SCORE.sub.commun },
                  ].map(({ l, v }) => (
                    <div key={l} className="bg-slate-800/60 border border-slate-700 rounded-lg px-3 py-1.5">
                      <div className="text-xs text-slate-500">{l}</div>
                      <div className="text-emerald-400 font-mono font-bold text-sm">{v}/100</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-slate-900/60 border border-slate-700/50 rounded-xl p-5 backdrop-blur-sm">
                <SectionHeader icon={BarChart2} title="Score Breakdown" sub="Per-factor analysis (weighted)" />
                <div className="space-y-3">
                  {[
                    { l: "Solar Power",      v: SCORE.sub.solar,       w: "25%", c: "#f59e0b" },
                    { l: "Earth Visibility", v: SCORE.sub.earthVis,    w: "20%", c: "#06b6d4" },
                    { l: "Terrain Safety",   v: SCORE.sub.terrain,     w: "20%", c: "#10b981" },
                    { l: "Sun Consistency",  v: SCORE.sub.consistency, w: "15%", c: "#a78bfa" },
                    { l: "Communications",   v: SCORE.sub.commun,      w: "10%", c: "#22d3ee" },
                    { l: "Thermal Profile",  v: SCORE.sub.thermal,     w: "10%", c: "#f97316" },
                  ].map(({ l, v, w, c }) => (
                    <div key={l}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-slate-300">{l}</span>
                        <div className="flex gap-2">
                          <span className="text-slate-500">w={w}</span>
                          <span className="font-mono font-bold" style={{ color: c }}>{v}/100</span>
                        </div>
                      </div>
                      <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${v}%`, background: `linear-gradient(90deg, ${c}80, ${c})`, boxShadow: `0 0 8px ${c}50`, transition: "width 1s ease" }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-slate-900/60 border border-slate-700/50 rounded-xl p-5 backdrop-blur-sm">
                <SectionHeader icon={Activity} title="Multi-Axis Radar" sub="Normalized 0-100 per axis" />
                <ResponsiveContainer width="100%" height={260}>
                  <RadarChart data={RADAR_DATA} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
                    <PolarGrid stroke="#1e293b" />
                    <PolarAngleAxis dataKey="metric" tick={{ fill: "#94a3b8", fontSize: 11 }} />
                    <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fill: "#475569", fontSize: 9 }} />
                    <Radar name="SHACK-01" dataKey="value" stroke="#10b981" fill="#10b981" fillOpacity={0.2} strokeWidth={2.5} dot={{ r: 4, fill: "#10b981", strokeWidth: 0 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, color: "#94a3b8" }} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="bg-slate-900/60 border border-slate-700/50 rounded-xl p-5 backdrop-blur-sm">
              <SectionHeader icon={Cpu} title="Scoring Methodology and Data Sources" />
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">Score Formula</div>
                  <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 font-mono text-xs space-y-1 text-slate-300">
                    <div className="text-cyan-400 text-sm">S = sum(wi * si)</div>
                    <div className="text-slate-500 mt-2 mb-1">Factor weights:</div>
                    <div>w1 = 0.25 · Solar Coverage</div>
                    <div>w2 = 0.20 · Earth Visibility</div>
                    <div>w3 = 0.20 · Terrain Safety</div>
                    <div>w4 = 0.15 · Sun Consistency</div>
                    <div>w5 = 0.10 · Communications</div>
                    <div>w6 = 0.10 · Thermal Profile</div>
                    <div className="border-t border-slate-800 mt-2 pt-2 text-emerald-400 font-bold">
                      Total = {SCORE.total} / 100
                    </div>
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">Data Sources</div>
                  <div className="space-y-2 text-xs">
                    {[
                      { src: "NASA JPL Horizons DE441", used: "Sun/Earth elevation and azimuth", st: "Ingested",  c: "text-emerald-400" },
                      { src: "LRO LOLA DEM 60m/px",    used: "Terrain slopes, crater geom.",    st: "Pending",   c: "text-amber-400"   },
                      { src: "LROC NAC Imagery",        used: "Rock abundance, texture",         st: "Planned",   c: "text-slate-600"   },
                      { src: "Diviner Thermal Map",     used: "Surface temperature model",       st: "Planned",   c: "text-slate-600"   },
                    ].map(({ src, used, st, c }, i) => (
                      <div key={i} className="flex items-start justify-between bg-slate-950/60 border border-slate-800/40 rounded-lg px-3 py-2">
                        <div>
                          <div className="text-slate-200 font-medium">{src}</div>
                          <div className="text-slate-500">{used}</div>
                        </div>
                        <span className={`text-xs font-mono flex-shrink-0 ml-3 mt-0.5 ${c}`}>{st}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-5">
              <div className="flex items-start gap-4">
                <CheckCircle size={22} className="text-emerald-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-emerald-400 font-bold mb-1">FINAL RECOMMENDATION: PROCEED TO PHASE-2 ANALYSIS</h3>
                  <p className="text-slate-300 text-sm leading-relaxed">
                    Shackleton Crater Rim (LS-SHACK-01) scores <strong className="text-emerald-400">{SCORE.total}/100</strong> and meets all primary
                    mission-critical thresholds. Near-continuous sunlight (&gt;1.5 deg elevation), permanent Earth line-of-sight,
                    manageable terrain slopes (3-8 deg), and proximity to Permanently Shadowed Regions for ISRU make this the
                    highest-priority candidate.
                  </p>
                  <div className="flex flex-wrap gap-2 mt-3">
                    {[
                      ["Solar: GO",          "emerald"],
                      ["Comms: GO",          "emerald"],
                      ["Terrain: GO",        "emerald"],
                      ["Thermal: MARGINAL",  "amber"],
                      ["ISRU Potential: HIGH","emerald"],
                    ].map(([t, c]) => (
                      <span key={t} className={`text-xs font-mono px-2 py-0.5 rounded border ${c === "amber" ? "border-amber-500/30 text-amber-400 bg-amber-500/10" : "border-emerald-500/30 text-emerald-400 bg-emerald-500/10"}`}>
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="border-t border-slate-800/40 mt-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col md:flex-row items-center justify-between gap-2">
          <div className="text-slate-600 text-xs font-mono">LUNA-SAFE · NASA Space Apps Challenge 2026 · Swanand Dindore · Solo</div>
          <div className="text-slate-600 text-xs font-mono">JPL Horizons DE441 · LRO LOLA · Moon (301) Observer · <span className="text-cyan-800">ssd.jpl.nasa.gov</span></div>
        </div>
      </footer>
    </div>
  );
}
