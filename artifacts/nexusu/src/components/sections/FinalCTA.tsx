import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';

export function FinalCTA() {
  return (
    <section className="py-32 bg-[#111009] relative overflow-hidden flex items-center justify-center">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-gradient-to-tr from-[#E8461E]/25 to-[#F97316]/15 blur-[150px] rounded-full pointer-events-none" aria-hidden="true" />

      <div className="container mx-auto px-6 relative z-10 text-center max-w-4xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
        >
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-white overflow-hidden mb-8 shadow-md" aria-hidden="true">
            <img src="/logo.png" alt="" className="w-full h-full object-contain" />
          </div>

          <h2 className="text-5xl md:text-6xl font-display font-bold text-white mb-5 leading-tight">
            The Future of Community Banking<br />
            is <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#E8461E] to-[#F97316]">Autonomous</span>
          </h2>

          <p className="text-lg text-white/60 mb-10 max-w-xl mx-auto font-light leading-relaxed">
            Launch, manage, and scale community financial institutions with intelligent agents.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <a
              href="/app"
              className="w-full sm:w-auto bg-[#E8461E] hover:bg-[#D03D18] text-white px-10 py-4 rounded-full text-base font-semibold transition-colors shadow-[0_4px_24px_rgba(232,70,30,0.40)] flex items-center justify-center gap-2 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#111009]"
            >
              Launch App
              <ArrowRight className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" aria-hidden="true" />
            </a>
            <a
              href="/contact"
              className="w-full sm:w-auto px-10 py-4 rounded-full text-base font-semibold text-white border border-white/20 hover:bg-white/5 transition-all flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#111009]"
            >
              Contact Team
            </a>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
