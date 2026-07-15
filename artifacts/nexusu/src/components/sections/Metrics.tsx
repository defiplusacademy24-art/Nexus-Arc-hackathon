import { motion } from 'framer-motion';
import { Users, Brain, Clock, Layers } from 'lucide-react';

const pillars = [
  {
    icon: Users,
    value: '10+',
    label: 'Pilot Communities',
    desc: 'Active groups running on the network today.',
  },
  {
    icon: Brain,
    value: 'AI-Powered',
    label: 'Governance',
    desc: 'Every decision enforced by autonomous agents, not humans.',
  },
  {
    icon: Clock,
    value: '24/7',
    label: 'Autonomous Operations',
    desc: 'Treasury, lending, and compliance—always running.',
  },
  {
    icon: Layers,
    value: 'Unicity',
    label: 'Infrastructure',
    desc: 'Built on battle-tested decentralised compute and identity rails.',
  },
];

export function Metrics() {
  return (
    <section className="py-24 bg-[#EEF2F6] dark:bg-[#030F1F] border-t border-[#1A2A3A]/15 dark:border-white/5 relative">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-3xl h-full bg-[#6393C4]/6 blur-[120px] pointer-events-none" aria-hidden="true" />

      <div className="container mx-auto px-6 max-w-7xl relative z-10">
        <div className="text-center mb-14">
          <h2 className="text-3xl md:text-4xl font-display font-bold text-[#030F1F] dark:text-white mb-3">
            Built for Real-World Communities
          </h2>
          <p className="text-stone-500 dark:text-white/50 text-sm max-w-md mx-auto">
            Designed from the ground up to be honest, transparent, and production-ready from day one.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {pillars.map((p, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="bg-white dark:bg-[#2E3B4B]/35 border border-stone-200 dark:border-[#1A2A3A] rounded-2xl p-7 flex flex-col gap-4 hover:border-[#6393C4]/30 hover:shadow-sm transition-all duration-300"
            >
              <div className="w-12 h-12 rounded-xl bg-[#6393C4]/8 border border-[#6393C4]/15 flex items-center justify-center flex-shrink-0">
                <p.icon className="w-6 h-6 text-[#6393C4]" />
              </div>
              <div>
                <div className="text-2xl font-display font-bold text-[#6393C4] leading-tight mb-0.5">
                  {p.value}
                </div>
                <div className="text-base font-display font-semibold text-[#030F1F] dark:text-white mb-1">
                  {p.label}
                </div>
                <p className="text-sm text-stone-400 dark:text-white/50 leading-relaxed">
                  {p.desc}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}