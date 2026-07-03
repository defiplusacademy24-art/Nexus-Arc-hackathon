import { motion } from 'framer-motion';
import useEmblaCarousel from 'embla-carousel-react';
import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Quote } from 'lucide-react';

const testimonials = [
  {
    quote: "Nexusu transformed our 200-person cooperative. What used to take three days of manual reconciliation now happens instantly. The agents handle everything—including the uncomfortable work of following up on late payments.",
    name: "Oluwaseun Adebayo",
    role: "President, Lagos Tech Cooperative",
    initials: "OA"
  },
  {
    quote: "Managing our Stokvel across three timezones was a nightmare. Nexusu's autonomous treasury acts as an infallible neutral party. Our loan deployment time went from weeks to seconds.",
    name: "Thabo Mbeki",
    role: "Administrator, Global SA Diaspora Fund",
    initials: "TM"
  },
  {
    quote: "The Inter-Cooperative Liquidity network is a game-changer. When our Chama needed capital, our agent autonomously negotiated a short-term borrow from another verified group. No calls, no delays.",
    name: "Amina Hassan",
    role: "Treasury Lead, Nairobi Market Chama",
    initials: "AH"
  }
];

export function Testimonials() {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true });
  const [selectedIndex, setSelectedIndex] = useState(0);

  const scrollPrev = useCallback(() => emblaApi && emblaApi.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi && emblaApi.scrollNext(), [emblaApi]);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setSelectedIndex(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    onSelect();
    emblaApi.on('select', onSelect);
  }, [emblaApi, onSelect]);

  return (
    <section className="py-32 bg-white dark:bg-[#201E1C] relative overflow-hidden">
      <div className="absolute right-0 top-0 w-[500px] h-[500px] bg-[#E8461E]/5 dark:bg-[#E8461E]/8 blur-[150px] pointer-events-none rounded-full" aria-hidden="true" />

      <div className="container mx-auto px-6 max-w-5xl relative z-10">
        <h2 className="text-3xl md:text-4xl font-display font-bold text-center text-[#1B1917] dark:text-white mb-14">
          Trusted by Cooperative Leaders
        </h2>

        <div className="relative" role="region" aria-label="Testimonials carousel" aria-roledescription="carousel">
          <div className="overflow-hidden" ref={emblaRef}>
            <div className="flex">
              {testimonials.map((t, i) => (
                <div
                  key={i}
                  className="flex-[0_0_100%] min-w-0 px-4"
                  role="group"
                  aria-label={`Testimonial ${i + 1} of ${testimonials.length}`}
                  aria-roledescription="slide"
                >
                  <div className="bg-white dark:bg-white/4 border border-stone-200 dark:border-white/8 rounded-2xl p-8 md:p-10 text-center max-w-3xl mx-auto relative">
                    <Quote className="w-10 h-10 text-[#E8461E]/25 mx-auto mb-5" aria-hidden="true" />
                    <blockquote className="text-lg md:text-xl text-[#1B1917]/80 dark:text-white/90 font-light leading-relaxed mb-7 italic">
                      "{t.quote}"
                    </blockquote>
                    <footer className="flex flex-col items-center">
                      <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#E8461E] to-[#F97316] flex items-center justify-center text-white font-bold text-base mb-2 shadow-lg" aria-hidden="true">
                        {t.initials}
                      </div>
                      <cite className="not-italic">
                        <div className="font-display font-semibold text-[#1B1917] dark:text-white text-sm">{t.name}</div>
                        <div className="text-xs text-stone-400 dark:text-white/50 mt-0.5">{t.role}</div>
                      </cite>
                    </footer>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={scrollPrev}
            aria-label="Previous testimonial"
            className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 md:-translate-x-12 w-10 h-10 rounded-full bg-orange-50 dark:bg-white/10 hover:bg-orange-100 dark:hover:bg-white/20 border border-orange-200 dark:border-white/20 flex items-center justify-center text-[#E8461E] dark:text-white backdrop-blur-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E8461E]"
          >
            <ChevronLeft className="w-5 h-5" aria-hidden="true" />
          </button>

          <button
            onClick={scrollNext}
            aria-label="Next testimonial"
            className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 md:translate-x-12 w-10 h-10 rounded-full bg-orange-50 dark:bg-white/10 hover:bg-orange-100 dark:hover:bg-white/20 border border-orange-200 dark:border-white/20 flex items-center justify-center text-[#E8461E] dark:text-white backdrop-blur-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E8461E]"
          >
            <ChevronRight className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        <div className="flex justify-center gap-2 mt-8" role="tablist" aria-label="Testimonial navigation">
          {testimonials.map((_, i) => (
            <button
              key={i}
              role="tab"
              aria-selected={i === selectedIndex}
              aria-label={`Go to testimonial ${i + 1}`}
              onClick={() => emblaApi?.scrollTo(i)}
              className={`h-2 rounded-full transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E8461E] ${
                i === selectedIndex ? 'w-8 bg-[#E8461E]' : 'w-2 bg-stone-300 dark:bg-white/20'
              }`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
