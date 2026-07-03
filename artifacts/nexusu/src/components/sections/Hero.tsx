import { motion } from 'framer-motion';
import { ArrowRight, BookOpen } from 'lucide-react';

/* ─────────────────────────────────────────────
   Stacked isometric architecture layers
   Three diamond platforms stacked in 3-D space:
     1. COMMUNITIES  — top (glass)
     2. COOPERATIVE OS — middle (orange glow core)
     3. UNICITY NETWORK — bottom (proof layer)
───────────────────────────────────────────── */
const ArchitectureLayers = () => {
  const cx = 240;         // SVG center-x
  const hx = 132;         // half horizontal span
  const hy = 58;          // half vertical span of top face
  const thick = 20;       // visible thickness of each slab

  const layers = [
    {
      label: 'COMMUNITIES',
      sub: 'Member Layer',
      cy: 88,
      topFill: 'rgba(255,255,255,0.045)',
      topStroke: 'rgba(255,255,255,0.38)',
      leftFill: 'rgba(255,255,255,0.018)',
      rightFill: 'rgba(255,255,255,0.07)',
      sideStroke: 'rgba(255,255,255,0.18)',
      labelColor: 'rgba(255,255,255,0.92)',
      subColor: 'rgba(255,255,255,0.40)',
      glow: false,
      delay: 0.15,
    },
    {
      label: 'COOPERATIVE OS',
      sub: 'Nexusu Kernel',
      cy: 255,
      topFill: 'rgba(232,70,30,0.82)',
      topStroke: '#F97316',
      leftFill: 'rgba(160,36,12,0.92)',
      rightFill: 'rgba(200,55,18,0.9)',
      sideStroke: '#F97316',
      labelColor: '#ffffff',
      subColor: 'rgba(255,220,180,0.70)',
      glow: true,
      delay: 0.35,
    },
    {
      label: 'UNICITY NETWORK',
      sub: 'Proof System',
      cy: 422,
      topFill: 'rgba(232,70,30,0.07)',
      topStroke: 'rgba(232,70,30,0.55)',
      leftFill: 'rgba(90,25,8,0.35)',
      rightFill: 'rgba(110,32,10,0.45)',
      sideStroke: 'rgba(232,70,30,0.35)',
      labelColor: 'rgba(255,255,255,0.68)',
      subColor: 'rgba(255,255,255,0.32)',
      glow: false,
      delay: 0.55,
    },
  ];

  function diamondPoints(cY: number) {
    const T = [cx, cY - hy];
    const R = [cx + hx, cY];
    const B = [cx, cY + hy];
    const L = [cx - hx, cY];
    const top = `${T[0]},${T[1]} ${R[0]},${R[1]} ${B[0]},${B[1]} ${L[0]},${L[1]}`;
    const left = `${L[0]},${L[1]} ${L[0]},${L[1] + thick} ${B[0]},${B[1] + thick} ${B[0]},${B[1]}`;
    const right = `${R[0]},${R[1]} ${R[0]},${R[1] + thick} ${B[0]},${B[1] + thick} ${B[0]},${B[1]}`;
    return { top, left, right };
  }

  return (
    <motion.div
      className="relative w-full select-none"
      style={{ maxWidth: 480, margin: '0 auto' }}
      animate={{ y: [0, -10, 0] }}
      transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
    >
      {/* Orange radial glow behind the middle layer */}
      <motion.div
        aria-hidden="true"
        className="absolute pointer-events-none"
        style={{
          top: '47%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 320,
          height: 120,
          background:
            'radial-gradient(ellipse at center, rgba(232,70,30,0.38) 0%, rgba(232,70,30,0.12) 45%, transparent 70%)',
          filter: 'blur(28px)',
        }}
        animate={{ opacity: [0.75, 1, 0.75], scale: [1, 1.08, 1] }}
        transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
      />

      <svg
        viewBox="0 0 480 510"
        width="100%"
        style={{ height: 'auto' }}
        aria-label="Nexusu architecture: Communities, Cooperative OS, and Unicity Network layers"
      >
        <defs>
          {/* Soft edge glow for the orange layer */}
          <filter id="layer-glow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="9" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          {/* Subtle drop shadow for glass layer */}
          <filter id="glass-shadow" x="-10%" y="-10%" width="120%" height="120%">
            <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="#000000" floodOpacity="0.18" />
          </filter>
        </defs>

        {layers.map((layer) => {
          const pts = diamondPoints(layer.cy);
          const textY = layer.cy - 6;
          return (
            <motion.g
              key={layer.label}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: layer.delay, duration: 0.9, ease: 'easeOut' }}
              filter={layer.glow ? 'url(#layer-glow)' : 'url(#glass-shadow)'}
            >
              {/* Side faces rendered first (below top face) */}
              <polygon
                points={pts.left}
                fill={layer.leftFill}
                stroke={layer.sideStroke}
                strokeWidth="1"
                strokeLinejoin="round"
              />
              <polygon
                points={pts.right}
                fill={layer.rightFill}
                stroke={layer.sideStroke}
                strokeWidth="1"
                strokeLinejoin="round"
              />
              {/* Top diamond face */}
              <polygon
                points={pts.top}
                fill={layer.topFill}
                stroke={layer.topStroke}
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
              {/* Label */}
              <text
                x={cx}
                y={textY}
                textAnchor="middle"
                fill={layer.labelColor}
                fontSize="11.5"
                fontWeight="700"
                fontFamily="'JetBrains Mono', 'Fira Mono', monospace"
                letterSpacing="3"
                style={{ userSelect: 'none' }}
              >
                {layer.label}
              </text>
              <text
                x={cx}
                y={textY + 15}
                textAnchor="middle"
                fill={layer.subColor}
                fontSize="8.5"
                fontFamily="'JetBrains Mono', 'Fira Mono', monospace"
                letterSpacing="2"
                style={{ userSelect: 'none' }}
              >
                {layer.sub}
              </text>
            </motion.g>
          );
        })}

        {/* Animated data particles flowing between layers */}
        {[0, 0.6, 1.2, 1.8].map((delay, i) => (
          <motion.circle
            key={i}
            r="2.5"
            fill="#F97316"
            opacity={0.7}
            cx={cx + (i % 2 === 0 ? 18 : -22)}
            initial={{ cy: 175, opacity: 0 }}
            animate={{
              cy: [175, 238, 238],
              opacity: [0, 0.9, 0],
            }}
            transition={{
              duration: 1.8,
              delay: delay + 0.8,
              repeat: Infinity,
              ease: 'easeInOut',
              repeatDelay: 1.2,
            }}
          />
        ))}
        {[0, 0.7, 1.4].map((delay, i) => (
          <motion.circle
            key={`d2-${i}`}
            r="2.5"
            fill="#E8461E"
            opacity={0.6}
            cx={cx + (i % 2 === 0 ? -15 : 25)}
            initial={{ cy: 343, opacity: 0 }}
            animate={{
              cy: [343, 400, 400],
              opacity: [0, 0.85, 0],
            }}
            transition={{
              duration: 1.8,
              delay: delay + 1.4,
              repeat: Infinity,
              ease: 'easeInOut',
              repeatDelay: 1.4,
            }}
          />
        ))}
      </svg>
    </motion.div>
  );
};

/* ─────────────────────────────────────────────
   Mobile fallback: stat cards
───────────────────────────────────────────── */
const MobileHeroVisual = () => (
  <div className="grid grid-cols-2 gap-3 mt-8" aria-label="Platform highlights">
    {[
      { value: '10+', label: 'Pilot Communities', color: 'text-[#E8461E]' },
      { value: 'AI', label: 'Powered Governance', color: 'text-[#F97316]' },
      { value: '24/7', label: 'Autonomous Ops', color: 'text-[#E8461E]' },
      { value: 'Unicity', label: 'Infrastructure', color: 'text-[#F97316]' },
    ].map((s, i) => (
      <motion.div
        key={i}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 + i * 0.1 }}
        className="bg-white dark:bg-white/5 border border-orange-100 dark:border-white/10 rounded-2xl p-4 text-center shadow-sm dark:shadow-none"
      >
        <div className={`text-2xl font-display font-bold ${s.color} mb-0.5`}>{s.value}</div>
        <div className="text-xs text-stone-500 dark:text-white/50 font-mono uppercase tracking-wide">{s.label}</div>
      </motion.div>
    ))}
  </div>
);

/* ─────────────────────────────────────────────
   Hero section
───────────────────────────────────────────── */
export function Hero() {
  return (
    <section className="relative min-h-screen pt-28 pb-20 overflow-hidden flex items-center bg-white dark:bg-[#1B1917]">
      {/* Background grid */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#0000000a_1px,transparent_1px),linear-gradient(to_bottom,#0000000a_1px,transparent_1px)] dark:bg-[linear-gradient(to_right,#ffffff08_1px,transparent_1px),linear-gradient(to_bottom,#ffffff08_1px,transparent_1px)] bg-[size:48px_48px]" />
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-[#E8461E]/6 dark:bg-[#E8461E]/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-[#F97316]/6 dark:bg-[#F97316]/8 blur-[100px] rounded-full" />
      </div>

      <div className="container mx-auto px-6 max-w-7xl relative z-10 w-full">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">

          {/* Left: Text */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
          >
            <div className="inline-flex items-center gap-2.5 mb-8">
              <span className="flex h-2 w-2 rounded-full bg-[#E8461E] animate-pulse" aria-hidden="true" />
              <span className="text-xs font-semibold text-[#E8461E] tracking-[0.18em] uppercase">
                Live on Unicity Network
              </span>
            </div>

            <h1 className="text-5xl lg:text-[64px] font-display font-bold leading-[1.08] tracking-tight text-[#1B1917] dark:text-white mb-5">
              Autonomous<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#E8461E] to-[#F97316]">
                Community Banking
              </span>
            </h1>

            <p className="text-lg text-stone-500 dark:text-white/55 mb-10 max-w-md font-light leading-relaxed">
              Empower savings groups to operate as autonomous financial institutions with AI governance, programmable money, and secure digital infrastructure.
            </p>

            <div className="flex flex-col sm:flex-row gap-3">
              <a
                href="/app"
                className="bg-[#E8461E] hover:bg-[#D03D18] text-white px-8 py-3.5 rounded-full text-sm font-semibold transition-colors shadow-[0_4px_24px_rgba(232,70,30,0.30)] flex items-center justify-center gap-2 group"
              >
                Launch App
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" aria-hidden="true" />
              </a>
              <a
                href="/docs"
                className="px-8 py-3.5 rounded-full text-sm font-semibold text-stone-700 dark:text-white/80 border border-stone-200 dark:border-white/20 hover:bg-stone-50 dark:hover:bg-white/5 transition-all flex items-center justify-center gap-2"
              >
                <BookOpen className="w-4 h-4" aria-hidden="true" />
                Read Docs
              </a>
            </div>

            {/* Mobile-only stats */}
            <div className="md:hidden">
              <MobileHeroVisual />
            </div>
          </motion.div>

          {/* Right: Architecture Layers — desktop only */}
          <motion.div
            initial={{ opacity: 0, scale: 0.93 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.9, delay: 0.15 }}
            className="hidden md:block relative"
          >
            <ArchitectureLayers />

            {/* Floating stat badges */}
            <motion.div
              aria-hidden="true"
              className="absolute -top-6 -right-4 lg:-right-10 bg-white dark:bg-white/5 backdrop-blur-xl border border-orange-100 dark:border-white/10 shadow-lg dark:shadow-none p-4 rounded-2xl"
              initial={{ y: 16, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 1.0 }}
            >
              <div className="text-2xl font-display font-bold text-[#1B1917] dark:text-white">10+</div>
              <div className="text-xs text-[#F97316] font-semibold tracking-wide mt-0.5">Pilot Communities</div>
            </motion.div>

            <motion.div
              aria-hidden="true"
              className="absolute -bottom-4 -left-4 lg:-left-10 bg-white dark:bg-white/5 backdrop-blur-xl border border-orange-100 dark:border-white/10 shadow-lg dark:shadow-none p-4 rounded-2xl"
              initial={{ y: 16, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 1.2 }}
            >
              <div className="text-2xl font-display font-bold text-[#1B1917] dark:text-white">24/7</div>
              <div className="text-xs text-[#E8461E] font-semibold tracking-wide mt-0.5">Autonomous Ops</div>
            </motion.div>
          </motion.div>

        </div>
      </div>
    </section>
  );
}
