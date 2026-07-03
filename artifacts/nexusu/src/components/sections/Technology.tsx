import { motion } from 'framer-motion';
import { Fingerprint, WalletCards, MessageSquare, HandCoins, Repeat, ArrowRightLeft, Tag, Server } from 'lucide-react';

export function Technology() {
  const techCards = [
    { title: "Sphere Identity", desc: "Machine-native identities for cooperatives and members.", icon: Fingerprint },
    { title: "Sphere Wallets", desc: "Multi-signature treasury and non-custodial member wallets.", icon: WalletCards },
    { title: "Sphere Messaging", desc: "Encrypted communication between member and cooperative agents.", icon: MessageSquare },
    { title: "Payment Requests", desc: "Automated contribution collection and loan repayment protocols.", icon: HandCoins },
    { title: "Intent Marketplace", desc: "Agent-to-agent discovery for autonomous loan negotiations.", icon: Repeat },
    { title: "Swaps & Settlement", desc: "Atomic execution for fast inter-cooperative liquidity settlement.", icon: ArrowRightLeft },
    { title: "Nametags", desc: "Human-readable identifiers for communities and agents.", icon: Tag },
    { title: "AstridOS", desc: "The environment keeping AI agents persistent and always running.", icon: Server }
  ];

  return (
    <section id="technology" className="py-32 bg-white dark:bg-[#201E1C] relative">
      <div className="container mx-auto px-6 max-w-7xl">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-display font-bold text-[#1B1917] dark:text-white mb-4">
            Built on the{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#E8461E] to-[#F97316]">Unicity Stack</span>
          </h2>
          <p className="text-base text-stone-500 dark:text-white/60 max-w-xl mx-auto">
            Enterprise-grade cryptographic primitives and decentralized agent infrastructure for treasury security and operational resilience.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5 relative">
          <div className="absolute inset-0 pointer-events-none hidden lg:block">
            <div className="w-full h-[1px] bg-stone-100 dark:bg-white/5 absolute top-1/2 -translate-y-1/2" />
            <div className="h-full w-[1px] bg-stone-100 dark:bg-white/5 absolute left-1/4 -translate-x-1/2" />
            <div className="h-full w-[1px] bg-stone-100 dark:bg-white/5 absolute left-2/4 -translate-x-1/2" />
            <div className="h-full w-[1px] bg-stone-100 dark:bg-white/5 absolute left-3/4 -translate-x-1/2" />
          </div>

          {techCards.map((tech, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className="bg-white dark:bg-white/5 p-7 rounded-2xl border border-stone-200 dark:border-white/10 hover:border-[#E8461E]/40 dark:hover:border-[#E8461E]/40 hover:shadow-sm dark:hover:shadow-none transition-all group relative z-10"
            >
              <div className="w-11 h-11 rounded-lg bg-gradient-to-br from-[#E8461E]/10 to-[#F97316]/10 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                <tech.icon className="w-5 h-5 text-[#E8461E]" />
              </div>
              <h3 className="font-display font-semibold text-base text-[#1B1917] dark:text-white mb-1.5">{tech.title}</h3>
              <p className="text-sm text-stone-400 dark:text-white/50 leading-relaxed">{tech.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
