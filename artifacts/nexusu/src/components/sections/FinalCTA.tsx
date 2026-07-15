import { ArrowRight } from 'lucide-react';

export function FinalCTA() {
  return (
    <section className="py-20 sm:py-24 bg-[#030F1F] border-t border-[#1A2A3A]" aria-labelledby="cta-heading">
      <div className="container mx-auto px-5 sm:px-6 text-center max-w-2xl">
        <h2
          id="cta-heading"
          className="text-3xl sm:text-4xl md:text-5xl font-display font-bold text-white mb-4 leading-tight"
        >
          Ready to launch your cooperative?
        </h2>
        <p className="text-white/60 mb-8 text-base sm:text-lg leading-relaxed">
          Create a group, invite members, and let agents handle the rest.
        </p>
        <a
          href="/app"
          className="inline-flex items-center gap-2 bg-[#6393C4] hover:bg-[#5289B8] text-white px-7 py-3.5 rounded-lg text-sm font-semibold transition-colors"
        >
          Launch App
          <ArrowRight className="w-4 h-4" aria-hidden="true" />
        </a>
      </div>
    </section>
  );
}