import {
  Coins,
  LineChart,
  Vote,
  Vault,
  Fingerprint,
  ShieldAlert,
} from 'lucide-react';

const features = [
  {
    icon: Coins,
    title: 'Autonomous Contributions',
    desc: 'Members contribute through Arc smart accounts while AI agents verify payments, track participation, send reminders, and enforce cooperative rules automatically.',
  },
  {
    icon: LineChart,
    title: 'Intelligent Lending',
    desc: 'Loan recommendations are generated using contribution history, cooperative reputation, treasury health, and member activity across the network.',
  },
  {
    icon: Vote,
    title: 'Agent Governance',
    desc: 'Members vote on proposals while AI agents monitor outcomes, execute approved actions, and maintain transparent governance records.',
  },
  {
    icon: Vault,
    title: 'Treasury Automation',
    desc: 'AI agents monitor cooperative treasuries, track reserves, manage payout workflows, and provide real-time financial oversight.',
  },
  {
    icon: Fingerprint,
    title: 'Financial Identity',
    desc: 'Contribution consistency, repayment behavior, and cooperative participation build a portable on-chain financial reputation.',
  },
  {
    icon: ShieldAlert,
    title: 'Risk Intelligence',
    desc: 'AI agents identify late contributions, treasury risks, repayment concerns, and unusual activity before they impact the cooperative.',
  },
];

function featureId(title: string) {
  return `feature-${title.replace(/\s+/g, '-').toLowerCase()}`;
}

export function Solution() {
  return (
    <section id="features" className="py-20 sm:py-24 bg-[#EEF2F6] dark:bg-[#030F1F]" aria-labelledby="features-heading">
      <div className="container mx-auto px-5 sm:px-6 max-w-6xl">
        <header className="text-center mb-12 sm:mb-14 max-w-3xl mx-auto">
          <p className="text-xs font-semibold text-[#6393C4] tracking-[0.16em] uppercase mb-3">
            Features
          </p>
          <h2
            id="features-heading"
            className="text-3xl sm:text-4xl md:text-5xl font-display font-bold text-[#030F1F] dark:text-white leading-tight"
          >
            Community finance, automated on Arc
          </h2>
          <p className="mt-4 text-lg text-stone-500 dark:text-white/60">
            Six agent-powered capabilities that run your cooperative end to end.
          </p>
        </header>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {features.map((feat) => (
            <article
              key={feat.title}
              className="bg-white dark:bg-[#2E3B4B]/40 border border-stone-200 dark:border-[#1A2A3A] rounded-xl p-6 sm:p-7"
              aria-labelledby={featureId(feat.title)}
            >
              <div className="w-10 h-10 rounded-lg bg-[#6393C4]/10 flex items-center justify-center mb-4">
                <feat.icon className="w-5 h-5 text-[#6393C4]" aria-hidden="true" />
              </div>
              <h3
                id={featureId(feat.title)}
                className="text-lg sm:text-xl font-display font-semibold text-[#030F1F] dark:text-white mb-2"
              >
                {feat.title}
              </h3>
              <p className="text-sm sm:text-base text-stone-500 dark:text-white/60 leading-relaxed">
                {feat.desc}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}