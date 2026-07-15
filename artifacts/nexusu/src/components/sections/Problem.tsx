import { motion } from 'framer-motion';
import { FileSpreadsheet, UserX, CreditCard, ShieldAlert, Network, Zap } from 'lucide-react';

export function TrustedBy() {
  const logos = [
    "COMMUNITY COOPERATIVES",
    "DECENTRALIZED DAOS",
    "GLOBAL SAVINGS GROUPS",
    "MICROFINANCE INSTITUTIONS",
    "CREDIT UNIONS",
    "COOPERATIVE BANKS",
  ];

  return (
    <section className="py-12 border-y border-[#1A2A3A]/15 dark:border-white/5 bg-white dark:bg-[#030F1F]">
      <div className="container mx-auto px-6 max-w-7xl">
        <p className="text-center text-sm font-mono text-stone-400 dark:text-white/40 mb-8 uppercase tracking-widest">
          Trusted by Communities Worldwide
        </p>
        <div className="relative overflow-hidden flex [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]">
          <div className="flex animate-[marquee_40s_linear_infinite] whitespace-nowrap gap-16 items-center w-max">
            {[...logos, ...logos, ...logos].map((logo, i) => (
              <span key={i} className="text-stone-300 dark:text-white/20 font-display font-semibold text-xl md:text-2xl tracking-tight">
                {logo}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export function Problem() {
  const problems = [
    {
      icon: FileSpreadsheet,
      title: "Manual Contribution Tracking",
      desc: "Spreadsheets and reconciliation errors drain time and burn out community leaders."
    },
    {
      icon: UserX,
      title: "Human Treasury Management",
      desc: "Centralized control creates opacity, single points of failure, and misplaced trust."
    },
    {
      icon: CreditCard,
      title: "Limited Access to Credit",
      desc: "Capital remains trapped—no intelligent infrastructure to deploy it responsibly."
    },
    {
      icon: ShieldAlert,
      title: "Poor Transparency",
      desc: "Members have no real-time visibility into treasury health or cooperative performance."
    },
    {
      icon: Network,
      title: "No Interoperable Liquidity",
      desc: "Groups operate in isolation. Excess capital cannot flow where it's needed."
    },
    {
      icon: Zap,
      title: "High Operational Friction",
      desc: "The cost and effort of running a group prevents scaling and broader financial inclusion."
    }
  ];

  return (
    <section id="problem" className="py-32 bg-[#EEF2F6] dark:bg-[#030F1F] relative">
      <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-[#6393C4]/5 blur-[120px] rounded-full pointer-events-none" />

      <div className="container mx-auto px-6 max-w-7xl relative z-10">
        <div className="max-w-3xl mb-20">
          <h2 className="text-4xl md:text-5xl font-display font-bold text-[#030F1F] dark:text-white mb-6">
            Community Finance Still Runs on{' '}
            <span className="text-[#6393C4]">Spreadsheets and Trust</span>
          </h2>
          <p className="text-lg text-stone-500 dark:text-white/60 font-light">
            Informal savings groups have long served underserved communities. Manual operations, opaque accounting, and disconnected liquidity are holding them back.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {problems.map((prob, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="bg-white dark:bg-[#2E3B4B]/35 border border-stone-200 dark:border-[#1A2A3A] rounded-2xl p-8 group hover:border-[#6393C4]/30 dark:hover:border-[#6393C4]/30 hover:shadow-sm transition-all duration-300"
            >
              <div className="w-12 h-12 rounded-xl bg-[#6393C4]/8 flex items-center justify-center mb-6 border border-[#6393C4]/15 group-hover:border-[#6393C4]/30 transition-colors">
                <prob.icon className="w-6 h-6 text-[#6393C4]" />
              </div>
              <h3 className="text-lg font-display font-semibold text-[#030F1F] dark:text-white mb-2">
                {prob.title}
              </h3>
              <p className="text-stone-500 dark:text-white/60 text-sm leading-relaxed">
                {prob.desc}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}