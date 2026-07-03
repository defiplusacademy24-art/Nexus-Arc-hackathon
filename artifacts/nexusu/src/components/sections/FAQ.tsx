import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export function FAQ() {
  const faqs = [
    {
      q: "What is Nexusu?",
      a: "Nexusu converts savings groups (Esusu, Chamas, Stokvels) into self-governing digital institutions powered by autonomous AI agents—no human administrator required."
    },
    {
      q: "How do autonomous agents work?",
      a: "Agents are persistent AI programs running on decentralized infrastructure. They monitor treasury health, execute contributions, evaluate loans, and communicate with members automatically. See the documentation for technical details."
    },
    {
      q: "Is my cooperative's treasury secure?",
      a: "Yes. Multi-signature smart contracts and the Unicity Secure Compute framework ensure funds are non-custodial—governed by cryptographic rules alone. Nexusu cannot access your treasury."
    },
    {
      q: "Can existing savings groups join?",
      a: "Yes. Import existing member balances and contribution history to establish baseline reputation scores immediately."
    },
    {
      q: "How are loans approved?",
      a: "The Cooperative Agent evaluates each request against treasury liquidity, group bylaws, and the member's on-chain reputation—instantly and transparently."
    },
    {
      q: "What infrastructure powers Nexusu?",
      a: "Nexusu runs on the Unicity Protocol: Sphere Identity, Sphere Wallets, Intent Marketplace, and AstridOS for persistent agent execution. Full technical details are in the documentation."
    }
  ];

  return (
    <section id="faq" className="py-32 bg-[#F9EDE3] dark:bg-[#1B1917]">
      <div className="container mx-auto px-6 max-w-3xl">
        <div className="text-center mb-14">
          <h2 className="text-3xl md:text-4xl font-display font-bold text-[#1B1917] dark:text-white mb-3">
            Frequently Asked Questions
          </h2>
          <p className="text-stone-500 dark:text-white/50 text-sm">
            For deeper answers, visit the{' '}
            <a href="/docs" className="text-[#E8461E] hover:underline">documentation</a>.
          </p>
        </div>

        <Accordion type="single" collapsible className="w-full">
          {faqs.map((faq, i) => (
            <AccordionItem key={i} value={`item-${i}`} className="border-b border-orange-100 dark:border-white/10 py-1">
              <AccordionTrigger className="text-left font-display font-semibold text-base text-[#1B1917] dark:text-white hover:text-[#E8461E] dark:hover:text-[#E8461E] hover:no-underline">
                {faq.q}
              </AccordionTrigger>
              <AccordionContent className="text-stone-500 dark:text-white/60 leading-relaxed text-sm">
                {faq.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
