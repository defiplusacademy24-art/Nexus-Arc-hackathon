import { ArrowRight, BookOpen } from 'lucide-react';
import { Link } from 'wouter';

export function Hero() {
  return (
    <section
      className="relative bg-white dark:bg-[#030F1F] border-b border-stone-200/80 dark:border-[#1A2A3A]"
      aria-labelledby="hero-heading"
    >
      <div
        className="absolute inset-0 pointer-events-none bg-[linear-gradient(to_right,#00000004_1px,transparent_1px),linear-gradient(to_bottom,#00000004_1px,transparent_1px)] dark:bg-[linear-gradient(to_right,#ffffff04_1px,transparent_1px),linear-gradient(to_bottom,#ffffff04_1px,transparent_1px)] bg-[size:48px_48px]"
        aria-hidden="true"
      />

      <div className="relative container mx-auto px-5 sm:px-6 max-w-5xl pt-28 sm:pt-32 pb-20 sm:pb-28 text-center">
        <p className="text-sm font-semibold text-[#6393C4] tracking-[0.16em] uppercase mb-6">
          Autonomous Cooperatives on Arc
        </p>

        <h1
          id="hero-heading"
          className="text-4xl sm:text-6xl md:text-7xl font-display font-bold leading-[1.08] tracking-tight text-[#030F1F] dark:text-white mb-6 sm:mb-8"
        >
          Run your cooperative.{' '}
          <span className="text-[#6393C4]">Let agents handle the rest.</span>
        </h1>

        <p className="text-lg sm:text-xl text-stone-500 dark:text-white/60 max-w-3xl mx-auto mb-8 sm:mb-10 leading-relaxed">
          Turn your savings group into an autonomous financial institution. Manage contributions, treasury, lending, and governance with AI agents and USDC on Arc Network.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center items-stretch sm:items-center max-w-md sm:max-w-none mx-auto">
          <Link
            href="/app"
            className="bg-[#6393C4] hover:bg-[#5289B8] text-white px-7 py-3.5 rounded-lg text-sm font-semibold transition-colors inline-flex items-center justify-center gap-2"
          >
            Launch App
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </Link>
          <Link
            href="/docs"
            className="px-7 py-3.5 rounded-lg text-sm font-semibold text-stone-700 dark:text-white/85 border border-stone-200 dark:border-[#1A2A3A] hover:bg-stone-50 dark:hover:bg-[#2E3B4B]/40 transition-colors inline-flex items-center justify-center gap-2 bg-white dark:bg-transparent"
          >
            <BookOpen className="w-4 h-4" aria-hidden="true" />
            Read Docs
          </Link>
        </div>
      </div>
    </section>
  );
}