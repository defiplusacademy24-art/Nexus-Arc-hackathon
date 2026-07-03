import { motion } from 'framer-motion';
import { Bot, LineChart, Banknote, Vote, ArrowLeftRight, Award } from 'lucide-react';

export function Solution() {
  const features = [
    {
      icon: Bot,
      title: "Autonomous Contribution Collection",
      desc: "AI agents collect savings, reconcile payments, and send reminders—automatically.",
      color: "from-[#E8461E]/10 to-[#F97316]/10",
      iconColor: "text-[#E8461E]"
    },
    {
      icon: LineChart,
      title: "Intelligent Lending",
      desc: "Instant credit decisions based on on-chain reputation and real-time treasury health.",
      color: "from-[#F97316]/10 to-amber-500/10",
      iconColor: "text-[#F97316]"
    },
    {
      icon: Banknote,
      title: "Autonomous Treasury Management",
      desc: "Treasury agents balance reserves, manage liquidity, and process payouts continuously.",
      color: "from-amber-500/10 to-yellow-400/10",
      iconColor: "text-amber-500"
    },
    {
      icon: Vote,
      title: "Cooperative Governance",
      desc: "Members vote on parameters. Smart contracts execute approved decisions automatically.",
      color: "from-[#EA580C]/10 to-[#E8461E]/10",
      iconColor: "text-[#EA580C]"
    },
    {
      icon: ArrowLeftRight,
      title: "Inter-Cooperative Liquidity",
      desc: "Cooperatives lend and borrow from each other autonomously across the network.",
      color: "from-[#DC2626]/10 to-[#E8461E]/10",
      iconColor: "text-[#DC2626]"
    },
    {
      icon: Award,
      title: "Community Credit Scores",
      desc: "Portable reputation profiles give members a verifiable financial identity globally.",
      color: "from-[#F59E0B]/10 to-[#F97316]/10",
      iconColor: "text-[#F59E0B]"
    }
  ];

  return (
    <section id="features" className="py-32 bg-white dark:bg-[#201E1C] relative overflow-hidden">
      <div className="absolute top-0 right-0 w-full h-[1px] bg-gradient-to-r from-transparent via-orange-200 dark:via-white/10 to-transparent" />

      <div className="container mx-auto px-6 max-w-7xl relative z-10">
        <div className="text-center max-w-2xl mx-auto mb-20">
          <div className="inline-flex items-center justify-center px-4 py-1.5 rounded-full bg-[#E8461E]/8 border border-[#E8461E]/20 mb-6">
            <span className="text-sm font-semibold text-[#E8461E] tracking-wide uppercase">The Nexusu OS</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-display font-bold text-[#1B1917] dark:text-white mb-4">
            Digitizing and Automating{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#E8461E] to-[#F97316]">Community Finance</span>
          </h2>
          <p className="text-base text-stone-500 dark:text-white/60">
            Human administration replaced by transparent AI agents operating 24/7.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feat, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="group relative bg-white dark:bg-white/5 border border-stone-200 dark:border-white/10 p-7 rounded-2xl hover:shadow-xl dark:hover:shadow-none transition-all duration-500 overflow-hidden"
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${feat.color} opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none`} />
              <div className="relative z-10">
                <div className="w-12 h-12 rounded-xl bg-stone-50 dark:bg-white/5 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-500 border border-stone-100 dark:border-white/10">
                  <feat.icon className={`w-6 h-6 ${feat.iconColor}`} />
                </div>
                <h3 className="text-lg font-display font-bold text-[#1B1917] dark:text-white mb-2">
                  {feat.title}
                </h3>
                <p className="text-stone-500 dark:text-white/60 text-sm leading-relaxed">
                  {feat.desc}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
