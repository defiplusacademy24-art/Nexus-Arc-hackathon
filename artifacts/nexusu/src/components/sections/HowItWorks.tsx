const steps = [
  {
    num: '01',
    title: 'Create a cooperative',
    desc: 'Define contribution schedules, treasury rules, lending policies, and governance settings in minutes.',
  },
  {
    num: '02',
    title: 'Invite members',
    desc: 'Members join through Arc smart accounts and participate in contributions, governance, and treasury activities.',
  },
  {
    num: '03',
    title: 'Agents operate the treasury',
    desc: 'Treasury agents monitor contributions, manage reserves, coordinate payouts, and enforce cooperative rules automatically.',
  },
  {
    num: '04',
    title: 'Borrow and repay',
    desc: 'Lending agents evaluate requests using contribution history and cooperative reputation while repayments build portable financial identity.',
  },
];

export function HowItWorks() {
  return (
    <section
      id="how"
      className="py-20 sm:py-24 bg-white dark:bg-[#030F1F] border-t border-stone-200/80 dark:border-[#1A2A3A]"
      aria-labelledby="how-heading"
    >
      <div className="container mx-auto px-5 sm:px-6 max-w-3xl">
        <header className="text-center mb-12 sm:mb-14 max-w-2xl mx-auto">
          <p className="text-xs font-semibold text-[#6393C4] tracking-[0.16em] uppercase mb-3">
            How it works
          </p>
          <h2
            id="how-heading"
            className="text-3xl sm:text-4xl md:text-5xl font-display font-bold text-[#030F1F] dark:text-white leading-tight"
          >
            Launch an autonomous cooperative in four steps
          </h2>
        </header>

        <ol className="space-y-0 list-none m-0 p-0">
          {steps.map((step, i) => {
            const stepId = `how-step-${step.num}`;
            return (
              <li
                key={step.num}
                className={`relative flex gap-5 sm:gap-6 pb-10 sm:pb-12 ${
                  i < steps.length - 1
                    ? 'border-l border-stone-200 dark:border-[#1A2A3A] ml-4 sm:ml-5 pl-8 sm:pl-10'
                    : 'ml-4 sm:ml-5 pl-8 sm:pl-10'
                }`}
                aria-labelledby={stepId}
              >
                <span
                  className="absolute -left-4 sm:-left-5 flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-full border-2 border-[#6393C4] bg-white dark:bg-[#030F1F] text-[10px] sm:text-xs font-mono font-bold text-[#6393C4]"
                  aria-hidden="true"
                >
                  {step.num}
                </span>
                <div className="pt-0.5">
                  <h3
                    id={stepId}
                    className="text-xl sm:text-2xl font-display font-semibold text-[#030F1F] dark:text-white mb-2"
                  >
                    {step.title}
                  </h3>
                  <p className="text-sm sm:text-base text-stone-500 dark:text-white/60 leading-relaxed">
                    {step.desc}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}