import { motion } from 'framer-motion';
import { Layers, Cpu, Database, Network, Shield, Zap } from 'lucide-react';
import { useState, useEffect } from 'react';

const layers = [
  {
    id: 1,
    num: '01',
    name: 'Member Agents',
    icon: Network,
    desc: 'Personal AI agents managing contributions, loan applications, and wallet interactions.',
    iconColor: '#F59E0B',
    bg: 'bg-amber-50 dark:bg-amber-400/10',
    text: 'text-amber-600 dark:text-amber-400',
    activeBorder: 'border-amber-300 dark:border-amber-400/40',
    activeBar: '#F59E0B',
  },
  {
    id: 2,
    num: '02',
    name: 'Cooperative Agents',
    icon: Layers,
    desc: 'Collective intelligence coordinating members, enforcing bylaws, and maintaining consensus.',
    iconColor: '#F97316',
    bg: 'bg-orange-50 dark:bg-orange-400/10',
    text: 'text-orange-500 dark:text-orange-400',
    activeBorder: 'border-orange-300 dark:border-orange-400/40',
    activeBar: '#F97316',
  },
  {
    id: 3,
    num: '03',
    name: 'AI Decision Layer',
    icon: Cpu,
    desc: 'Predictive models evaluating creditworthiness and liquidity risks in real-time.',
    iconColor: '#E8461E',
    bg: 'bg-red-50 dark:bg-red-400/10',
    text: 'text-red-500 dark:text-red-400',
    activeBorder: 'border-red-300 dark:border-red-400/40',
    activeBar: '#E8461E',
  },
  {
    id: 4,
    num: '04',
    name: 'Treasury & Governance',
    icon: Database,
    desc: 'Smart contracts managing fund escrows, distributions, and immutable voting records.',
    iconColor: '#EA580C',
    bg: 'bg-orange-50 dark:bg-orange-500/10',
    text: 'text-orange-700 dark:text-orange-300',
    activeBorder: 'border-orange-400 dark:border-orange-400/40',
    activeBar: '#EA580C',
  },
  {
    id: 5,
    num: '05',
    name: 'Unicity Secure Compute',
    icon: Shield,
    desc: 'Decentralized cryptographic infrastructure providing persistent runtime for all agents.',
    iconColor: '#DC2626',
    bg: 'bg-red-50 dark:bg-red-500/10',
    text: 'text-red-700 dark:text-red-300',
    activeBorder: 'border-red-400 dark:border-red-400/40',
    activeBar: '#DC2626',
  },
];

const ACTIVITY_LOG = [
  { agent: 'Loan Agent', action: 'Approved $1,200 loan for Amina K.', color: '#F59E0B', delay: 0 },
  { agent: 'Treasury Agent', action: 'Distributed $8,750 contributions', color: '#F97316', delay: 1.8 },
  { agent: 'AI Decision', action: 'Risk score updated — 22 members', color: '#E8461E', delay: 3.4 },
  { agent: 'Gov. Agent', action: 'Proposal #7 passed (18/22 votes)', color: '#EA580C', delay: 5.1 },
  { agent: 'Fraud Guard', action: 'Anomaly flagged & resolved', color: '#DC2626', delay: 6.7 },
];

const NODES = [
  { id: 'member',   label: 'Member',   icon: Network,  color: '#F59E0B', x: 50,  y: 12  },
  { id: 'coop',     label: 'Coop',     icon: Layers,   color: '#F97316', x: 88,  y: 38  },
  { id: 'treasury', label: 'Treasury', icon: Database, color: '#EA580C', x: 75,  y: 80  },
  { id: 'secure',   label: 'Security', icon: Shield,   color: '#DC2626', x: 25,  y: 80  },
  { id: 'ai',       label: 'AI',       icon: Cpu,      color: '#E8461E', x: 12,  y: 38  },
];

function AgentNetworkViz({ activeId }: { activeId: number | null }) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 80);
    return () => clearInterval(id);
  }, []);

  const cx = 50;
  const cy = 50;

  const activeNode = activeId
    ? NODES[activeId - 1] ?? null
    : null;

  return (
    <div className="relative w-full aspect-square max-w-[380px] mx-auto select-none" aria-hidden="true">

      {/* Background glow */}
      <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-[#E8461E]/8 via-[#F97316]/4 to-transparent" />

      {/* Outer pulse rings on the centre */}
      {[1, 2, 3].map((ring) => (
        <motion.div
          key={ring}
          className="absolute rounded-full border border-[#E8461E]/15"
          style={{ inset: `${15 + ring * 8}%` }}
          animate={{ scale: [1, 1.06, 1], opacity: [0.5, 0.15, 0.5] }}
          transition={{ duration: 3 + ring * 0.8, repeat: Infinity, delay: ring * 0.6, ease: 'easeInOut' }}
        />
      ))}

      {/* SVG for lines */}
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100">
        {NODES.map((node, i) => {
          const isActive = activeNode?.id === node.id;
          const progress = ((tick + i * 17) % 100) / 100;
          const lx = cx + (node.x - cx) * progress;
          const ly = cy + (node.y - cy) * progress;
          return (
            <g key={node.id}>
              {/* Connection line */}
              <line
                x1={cx} y1={cy} x2={node.x} y2={node.y}
                stroke={isActive ? node.color : '#ffffff'}
                strokeWidth={isActive ? 0.6 : 0.25}
                strokeOpacity={isActive ? 0.7 : 0.12}
                strokeDasharray={isActive ? '0' : '1.5 2'}
              />
              {/* Traveling data packet */}
              <circle
                cx={lx} cy={ly} r={isActive ? 1.4 : 0.9}
                fill={node.color}
                fillOpacity={isActive ? 1 : 0.6}
              />
            </g>
          );
        })}
      </svg>

      {/* Centre node — Nexusu OS */}
      <div className="absolute" style={{ left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }}>
        <motion.div
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
          className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#E8461E] to-[#F97316] shadow-lg shadow-[#E8461E]/30 flex items-center justify-center"
        >
          <Zap className="w-7 h-7 text-white" />
        </motion.div>
        <div className="text-center mt-1.5">
          <span className="text-[9px] font-semibold text-stone-500 dark:text-white/40 tracking-wide uppercase">Nexusu OS</span>
        </div>
      </div>

      {/* Outer agent nodes */}
      {NODES.map((node, i) => {
        const isActive = activeNode?.id === node.id;
        const Icon = node.icon;
        return (
          <div
            key={node.id}
            className="absolute"
            style={{
              left: `${node.x}%`,
              top: `${node.y}%`,
              transform: 'translate(-50%, -50%)',
            }}
          >
            <motion.div
              animate={isActive ? { scale: [1, 1.15, 1], boxShadow: [`0 0 0px ${node.color}00`, `0 0 18px ${node.color}88`, `0 0 0px ${node.color}00`] } : {}}
              transition={{ duration: 1.2, repeat: Infinity }}
              className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-all duration-200 ${
                isActive
                  ? 'bg-[#1B1917] border-current shadow-lg'
                  : 'bg-[#1B1917]/80 dark:bg-white/6 border-white/10'
              }`}
              style={isActive ? { borderColor: node.color, color: node.color } : {}}
            >
              <Icon className="w-4 h-4" style={{ color: isActive ? node.color : '#ffffff80' }} />
            </motion.div>
            <div className="text-center mt-1">
              <span className="text-[8px] font-medium text-stone-400 dark:text-white/35 tracking-wide">{node.label}</span>
            </div>
          </div>
        );
      })}

      {/* Live activity log at bottom of card */}
      <div className="absolute -bottom-24 left-0 right-0">
        <div className="rounded-2xl bg-[#111110]/95 dark:bg-white/4 border border-white/8 p-3 overflow-hidden" style={{ height: 88 }}>
          <div className="flex items-center gap-1.5 mb-2">
            <motion.div
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 1.2, repeat: Infinity }}
              className="w-1.5 h-1.5 rounded-full bg-emerald-400"
            />
            <span className="text-[9px] font-mono font-semibold text-white/30 tracking-widest uppercase">Live Agent Activity</span>
          </div>
          <div className="space-y-1 overflow-hidden">
            {ACTIVITY_LOG.slice(0, 3).map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: item.delay % 2, duration: 0.4 }}
                className="flex items-center gap-2"
              >
                <span className="text-[9px] font-semibold whitespace-nowrap" style={{ color: item.color }}>
                  {item.agent}
                </span>
                <span className="text-[9px] text-white/40 truncate">{item.action}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function Architecture() {
  const [activeId, setActiveId] = useState<number | null>(null);

  return (
    <section id="architecture" className="py-24 lg:py-32 bg-[#F9EDE3] dark:bg-[#1B1917] relative overflow-hidden">
      <div className="absolute bottom-0 left-1/3 w-[500px] h-[300px] bg-[#E8461E]/5 blur-[100px] pointer-events-none" aria-hidden="true" />

      <div className="container mx-auto px-6 max-w-7xl relative z-10">

        {/* Header */}
        <div className="max-w-xl mb-14">
          <h2 className="text-4xl md:text-5xl font-display font-bold text-[#1B1917] dark:text-white mb-4 leading-tight">
            Powered by<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#E8461E] to-[#F97316]">
              Autonomous Agents
            </span>
          </h2>
          <p className="text-base text-stone-500 dark:text-white/55 leading-relaxed">
            A multi-agent architecture where personal, cooperative, and system agents negotiate and execute financial operations securely.
          </p>
        </div>

        {/* Mobile: clean vertical list */}
        <ul className="flex flex-col gap-3 lg:hidden" aria-label="Architecture layers">
          {layers.map((layer) => (
            <li
              key={layer.id}
              className="bg-white dark:bg-white/5 border border-stone-200 dark:border-white/10 rounded-2xl p-4 flex items-start gap-4"
            >
              <div className={`w-11 h-11 flex-shrink-0 rounded-xl ${layer.bg} flex items-center justify-center`} aria-hidden="true">
                <layer.icon className={`w-5 h-5 ${layer.text}`} />
              </div>
              <div className="min-w-0 pt-0.5">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[10px] font-mono text-stone-300 dark:text-white/30" aria-hidden="true">{layer.num}</span>
                  <h3 className="text-sm font-semibold text-[#1B1917] dark:text-white">{layer.name}</h3>
                </div>
                <p className="text-xs text-stone-400 dark:text-white/50 leading-relaxed">{layer.desc}</p>
              </div>
            </li>
          ))}
        </ul>

        {/* Desktop: two-column */}
        <div className="hidden lg:grid lg:grid-cols-2 gap-20 items-start">

          {/* Left: interactive list */}
          <ul aria-label="Architecture layers — hover to explore" className="space-y-2">
            {layers.map((layer) => {
              const isActive = activeId === layer.id;
              return (
                <li key={layer.id}>
                  <div
                    role="button"
                    tabIndex={0}
                    aria-expanded={isActive}
                    aria-label={`${layer.name}: ${layer.desc}`}
                    onMouseEnter={() => setActiveId(layer.id)}
                    onMouseLeave={() => setActiveId(null)}
                    onFocus={() => setActiveId(layer.id)}
                    onBlur={() => setActiveId(null)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setActiveId(isActive ? null : layer.id);
                      }
                    }}
                    className={`group rounded-2xl border p-5 flex items-center gap-4 cursor-pointer transition-all duration-200 select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E8461E] ${
                      isActive
                        ? `bg-white dark:bg-white/8 ${layer.activeBorder} shadow-sm dark:shadow-none`
                        : 'bg-white dark:bg-white/4 border-stone-150 dark:border-white/8 hover:border-stone-200 dark:hover:border-white/15'
                    }`}
                  >
                    <div className={`w-11 h-11 flex-shrink-0 rounded-xl ${layer.bg} flex items-center justify-center`} aria-hidden="true">
                      <layer.icon className={`w-5 h-5 ${layer.text}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono text-stone-300 dark:text-white/30" aria-hidden="true">{layer.num}</span>
                        <span className="text-sm font-semibold text-[#1B1917] dark:text-white">{layer.name}</span>
                      </div>
                      <p
                        className={`text-xs text-stone-400 dark:text-white/50 leading-relaxed mt-0.5 overflow-hidden transition-all duration-200 ${
                          isActive ? 'max-h-12 opacity-100' : 'max-h-0 opacity-0'
                        }`}
                      >
                        {layer.desc}
                      </p>
                    </div>
                    <div
                      aria-hidden="true"
                      className={`w-1.5 h-8 rounded-full flex-shrink-0 transition-opacity duration-200 ${isActive ? 'opacity-100' : 'opacity-0'}`}
                      style={{ background: layer.activeBar }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>

          {/* Right: live agent network visualization */}
          <div className="sticky top-32 pb-28">
            <AgentNetworkViz activeId={activeId} />
          </div>

        </div>
      </div>
    </section>
  );
}
