import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

const faqs = [
  {
    id: 'what-is-nexusu',
    q: 'What is Nexusu?',
    a: 'Nexusu is a cooperative operating system for savings groups on Arc Network. It turns community finance into an autonomous institution — managing contributions, treasury, lending, and governance with AI agents and USDC.',
  },
  {
    id: 'arc-and-usdc',
    q: 'Why Arc Network and USDC?',
    a: 'Arc is built for stable, programmable finance. Members use Arc smart accounts to contribute and participate, while USDC provides predictable value for treasury reserves, payouts, and loan settlements.',
  },
  {
    id: 'how-agents-work',
    q: 'What do the AI agents actually do?',
    a: 'Treasury agents verify contributions, manage reserves, coordinate payouts, and enforce cooperative rules. Lending agents evaluate loan requests using contribution history and reputation. Governance agents execute approved votes and maintain transparent records. Risk agents flag late payments and treasury concerns early.',
  },
  {
    id: 'join-and-contribute',
    q: 'How do members join and contribute?',
    a: 'After a cooperative is created, members join through an invite link and connect via Arc smart accounts. They contribute on the defined schedule, vote on proposals, and participate in treasury activities — with agents handling verification, reminders, and rule enforcement.',
  },
  {
    id: 'lending-repayment',
    q: 'How does lending and repayment work?',
    a: 'Members request loans against cooperative policies. Lending agents generate recommendations from contribution history, cooperative reputation, treasury health, and network activity. Repayments are tracked on-chain and feed each member\'s portable financial identity.',
  },
  {
    id: 'treasury-security',
    q: 'Who controls cooperative funds?',
    a: 'Treasury funds are governed by cooperative rules and on-chain smart contracts — not by Nexusu. Members set policies at creation; agents operate within those rules. Nexusu cannot withdraw or redirect member treasuries.',
  },
  {
    id: 'financial-identity',
    q: 'What is portable financial identity?',
    a: 'Consistent contributions, on-time repayments, and active governance participation build an on-chain reputation profile. This financial identity travels with the member across cooperatives on the network.',
  },
  {
    id: 'learn-more',
    q: 'Where can I learn more?',
    a: 'Architecture, agent design, Arc integration, and setup guides are in the documentation.',
  },
];

export function FAQ() {
  return (
    <section id="faq" className="py-20 sm:py-24 bg-[#EEF2F6] dark:bg-[#030F1F]" aria-labelledby="faq-heading">
      <div className="container mx-auto px-5 sm:px-6 max-w-3xl">
        <header className="text-center mb-10 sm:mb-12">
          <p className="text-xs font-semibold text-[#6393C4] tracking-[0.16em] uppercase mb-3">
            FAQ
          </p>
          <h2
            id="faq-heading"
            className="text-3xl sm:text-4xl md:text-5xl font-display font-bold text-[#030F1F] dark:text-white leading-tight"
          >
            Common questions about Nexusu
          </h2>
        </header>

        <Accordion type="single" collapsible className="w-full">
          {faqs.map((faq) => (
            <AccordionItem key={faq.id} value={faq.id} className="border-b border-stone-200 dark:border-[#1A2A3A]">
              <AccordionTrigger
                id={`${faq.id}-trigger`}
                className="text-left font-display font-semibold text-base sm:text-lg text-[#030F1F] dark:text-white hover:text-[#6393C4] hover:no-underline py-4"
              >
                {faq.q}
              </AccordionTrigger>
              <AccordionContent
                className="text-stone-500 dark:text-white/60 leading-relaxed text-sm sm:text-base pb-4"
                aria-labelledby={`${faq.id}-trigger`}
              >
                {faq.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>

        <p className="text-center text-sm text-stone-400 dark:text-white/45 mt-8">
          More in the{' '}
          <a href="/docs" className="text-[#6393C4] hover:underline">documentation</a>.
        </p>
      </div>
    </section>
  );
}