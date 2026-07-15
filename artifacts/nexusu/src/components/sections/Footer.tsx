const year = new Date().getFullYear();

export function Footer() {
  return (
    <footer className="bg-[#030F1F] py-8 border-t border-white/8">
      <div className="container mx-auto px-6 max-w-5xl flex flex-col sm:flex-row items-center justify-between gap-4">
        <a href="/" className="flex items-center gap-2" aria-label="Nexusu home">
          <div className="w-7 h-7 rounded-md overflow-hidden bg-white flex items-center justify-center" aria-hidden="true">
            <img src="/logo.png" alt="" className="w-full h-full object-contain" />
          </div>
          <span className="font-display font-semibold text-white text-sm">Nexusu</span>
        </a>
        <p className="text-white/30 text-xs">© {year} Nexusu</p>
        <nav className="flex gap-5 text-xs" aria-label="Footer links">
          <a href="/docs" className="text-white/40 hover:text-white transition-colors">Docs</a>
          <a href="#faq" className="text-white/40 hover:text-white transition-colors">FAQ</a>
          <a href="/app" className="text-white/40 hover:text-white transition-colors">App</a>
        </nav>
      </div>
    </footer>
  );
}