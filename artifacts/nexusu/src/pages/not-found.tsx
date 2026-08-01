import { Link } from 'wouter';
import { ArrowLeft, Home } from 'lucide-react';
import { NexusuLogo } from '@/components/NexusuLogo';

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#EEF2F6] dark:bg-[#030F1F] px-4">
      <div className="w-full max-w-md text-center">
        <div className="flex justify-center mb-6">
          <NexusuLogo size="lg" />
        </div>
        <p className="text-xs font-semibold uppercase tracking-wider text-[#6393C4] mb-2">
          404
        </p>
        <h1 className="font-display text-2xl font-bold text-stone-900 dark:text-white mb-2">
          Page not found
        </h1>
        <p className="text-sm text-stone-500 dark:text-white/50 mb-8 leading-relaxed">
          This page doesn’t exist or has moved. Head back home or open the app.
        </p>
        <div className="flex flex-col sm:flex-row gap-2 justify-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#6393C4] text-white text-sm font-semibold hover:bg-[#5289B8] transition-colors"
          >
            <Home className="w-4 h-4" />
            Home
          </Link>
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border border-stone-200 dark:border-white/15 text-sm font-semibold text-stone-700 dark:text-white/80 hover:bg-white dark:hover:bg-white/5 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
