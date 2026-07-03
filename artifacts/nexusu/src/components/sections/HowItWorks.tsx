import { motion } from 'framer-motion';

export function HowItWorks() {
  const steps = [
    { num: "01", title: "Create a Cooperative", desc: "Set contribution amounts, cycle frequency, and loan parameters in minutes." },
    { num: "02", title: "Invite Members", desc: "Members join via link. Their personal AI agent and secure wallet are created instantly." },
    { num: "03", title: "AI Agents Manage Contributions", desc: "Agents monitor accounts, pull contributions, and send reminders automatically." },
    { num: "04", title: "Members Request Loans", desc: "Members request capital directly through the platform—no negotiation needed." },
    { num: "05", title: "Autonomous Credit Evaluation", desc: "The Cooperative Agent evaluates treasury health and member reputation instantly." },
    { num: "06", title: "Funds Settle Automatically", desc: "Approved loans deploy via smart contract. No paperwork, no manual transfers." },
    { num: "07", title: "Credit Scores Update", desc: "Each repayment automatically updates the member's portable global credit score." }
  ];

  return (
    <section className="py-32 bg-[#F9EDE3] dark:bg-[#1B1917] relative overflow-hidden">
      <div className="container mx-auto px-6 max-w-4xl relative z-10">
        <div className="text-center mb-20">
          <h2 className="text-4xl md:text-5xl font-display font-bold text-[#1B1917] dark:text-white mb-4">
            From Savings Group to{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#E8461E] to-[#F97316]">Autonomous Bank in Minutes</span>
          </h2>
        </div>

        <div className="relative">
          <div className="absolute left-4 md:left-1/2 top-0 bottom-0 w-px bg-orange-200 dark:bg-white/10 md:-translate-x-1/2" />

          <motion.div
            className="absolute left-4 md:left-1/2 top-0 w-[3px] h-24 bg-gradient-to-b from-transparent via-[#E8461E] to-transparent md:-translate-x-1/2"
            animate={{ top: ['-10%', '110%'] }}
            transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
          />

          <div className="space-y-10">
            {steps.map((step, i) => (
              <div
                key={i}
                className={`flex flex-col md:flex-row gap-8 md:gap-0 items-start md:items-center ${i % 2 === 0 ? 'md:flex-row' : 'md:flex-row-reverse'}`}
              >
                <motion.div
                  initial={{ opacity: 0, x: i % 2 === 0 ? -50 : 50 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: "-100px" }}
                  className={`w-full md:w-1/2 pl-12 md:pl-0 ${i % 2 === 0 ? 'md:pr-14 md:text-right' : 'md:pl-14 md:text-left'}`}
                >
                  <div className="bg-white dark:bg-white/4 border border-stone-200 dark:border-white/8 rounded-2xl p-6 hover:border-[#E8461E]/25 hover:shadow-sm transition-all duration-300">
                    <h3 className="text-lg font-display font-bold text-[#1B1917] dark:text-white mb-1">{step.title}</h3>
                    <p className="text-stone-500 dark:text-white/60 text-sm leading-relaxed">{step.desc}</p>
                  </div>
                </motion.div>

                <div className="absolute left-4 md:left-1/2 w-8 h-8 rounded-full bg-white dark:bg-[#1B1917] border-2 border-[#E8461E] flex items-center justify-center md:-translate-x-1/2 z-10 mt-1 md:mt-0">
                  <span className="text-[10px] font-mono font-bold text-[#E8461E]">{step.num}</span>
                </div>

                <div className="hidden md:block w-1/2" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
