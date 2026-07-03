import React from 'react';
import { motion } from 'framer-motion';
import { Users, Globe2, Shapes, Landmark } from 'lucide-react';

export function UseCases() {
  const cases = [
    { name: "Esusu Groups", region: "West Africa", icon: Users },
    { name: "Ajo Savings Clubs", region: "Nigeria", icon: Landmark },
    { name: "Chamas", region: "East Africa", icon: Users },
    { name: "Stokvels", region: "South Africa", icon: Landmark },
    { name: "Community Banks", region: "Global", icon: Globe2 },
    { name: "Cooperatives", region: "Global", icon: Shapes },
    { name: "Credit Unions", region: "North America", icon: Landmark },
    { name: "Investment DAOs", region: "Web3", icon: Network }
  ];

  return (
    <section id="use-cases" className="py-32 bg-white dark:bg-[#201E1C] relative">
      <div className="container mx-auto px-6 max-w-7xl">
        <div className="text-center mb-14">
          <h2 className="text-4xl md:text-5xl font-display font-bold text-[#1B1917] dark:text-white mb-4">
            Built for Every{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#E8461E] to-[#F97316]">Community Finance Model</span>
          </h2>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-5">
          {cases.map((c, i) => (
            <motion.div
              key={i}
              whileHover={{ y: -4, scale: 1.02 }}
              className="bg-[#F9EDE3] dark:bg-white/5 rounded-2xl p-6 border border-orange-100 dark:border-white/10 flex flex-col items-center justify-center text-center group transition-all hover:shadow-md dark:hover:shadow-none hover:border-[#E8461E]/30 dark:hover:border-[#E8461E]/40 cursor-pointer"
            >
              <div className="w-11 h-11 rounded-full bg-white dark:bg-white/10 shadow-sm flex items-center justify-center mb-3 text-stone-500 dark:text-white group-hover:text-[#E8461E] transition-colors">
                <c.icon className="w-5 h-5" />
              </div>
              <h3 className="font-display font-semibold text-[#1B1917] dark:text-white text-sm mb-1">{c.name}</h3>
              <span className="text-xs font-mono text-stone-400 dark:text-white/50 bg-orange-50 dark:bg-white/10 px-2 py-0.5 rounded-full">{c.region}</span>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Network(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="16" y="16" width="6" height="6" rx="1" />
      <rect x="2" y="16" width="6" height="6" rx="1" />
      <rect x="9" y="2" width="6" height="6" rx="1" />
      <path d="M5 16v-3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3" />
      <path d="M12 12V8" />
    </svg>
  );
}
