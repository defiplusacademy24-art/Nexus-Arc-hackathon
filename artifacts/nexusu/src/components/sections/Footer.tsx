import { Twitter, Linkedin } from 'lucide-react';

const year = new Date().getFullYear();

const social = [
  { icon: Twitter, label: 'Follow Nexusu on Twitter', href: 'https://twitter.com/nexusu' },
  { icon: Linkedin, label: 'Nexusu on LinkedIn', href: 'https://linkedin.com/company/nexusu' },
];

const links: Record<string, { label: string; href: string }[]> = {
  Product: [
    { label: 'Features', href: '#features' },
    { label: 'Architecture', href: '#architecture' },
    { label: 'Use Cases', href: '#use-cases' },
    { label: 'Technology', href: '#technology' },
  ],
  Company: [
    { label: 'Documentation', href: '/docs' },
    { label: 'Contact', href: '/contact' },
  ],
};

export function Footer() {
  return (
    <footer className="bg-[#111009] pt-20 pb-10 border-t border-white/8">
      <div className="container mx-auto px-6 max-w-7xl">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10 mb-14">

          {/* Brand */}
          <div className="col-span-2">
            <a href="/" className="flex items-center gap-2.5 mb-5 group" aria-label="Nexusu home">
              <div className="w-8 h-8 rounded-lg overflow-hidden bg-white flex-shrink-0 flex items-center justify-center shadow-sm" aria-hidden="true">
                <img src="/logo.png" alt="" className="w-full h-full object-contain" />
              </div>
              <span className="font-display font-bold text-xl tracking-tight text-white">
                Nexusu
              </span>
            </a>
            <p className="text-white/40 text-sm max-w-xs leading-relaxed mb-6">
              The Autonomous Community Banking Network.
            </p>
            <nav aria-label="Social media links" className="flex gap-4">
              {social.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  aria-label={s.label}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-white/40 hover:text-[#F97316] transition-colors focus-visible:outline-none focus-visible:text-[#F97316]"
                >
                  <s.icon className="w-4 h-4" aria-hidden="true" />
                </a>
              ))}
            </nav>
          </div>

          {/* Link columns */}
          {Object.entries(links).map(([title, items]) => (
            <nav key={title} aria-label={`${title} links`}>
              <h2 className="text-white font-semibold mb-5 text-sm">{title}</h2>
              <ul className="space-y-3">
                {items.map((item) => (
                  <li key={item.label}>
                    <a
                      href={item.href}
                      className="text-white/40 hover:text-white text-sm transition-colors focus-visible:outline-none focus-visible:text-white"
                    >
                      {item.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="pt-6 border-t border-white/8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-white/30 text-xs">
            © {year} Nexusu — The Autonomous Community Banking Network
          </p>
          <nav aria-label="Legal links" className="flex gap-5 text-xs">
            <a href="/privacy" className="text-white/30 hover:text-white transition-colors focus-visible:outline-none focus-visible:text-white">
              Privacy Policy
            </a>
            <a href="/terms" className="text-white/30 hover:text-white transition-colors focus-visible:outline-none focus-visible:text-white">
              Terms of Service
            </a>
          </nav>
        </div>
      </div>
    </footer>
  );
}
