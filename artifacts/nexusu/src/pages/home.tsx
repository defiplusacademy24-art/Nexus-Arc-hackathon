import { Navbar } from '@/components/sections/Navbar';
import { Hero } from '@/components/sections/Hero';
import { TrustedBy, Problem } from '@/components/sections/Problem';
import { Solution } from '@/components/sections/Solution';
import { Architecture } from '@/components/sections/Architecture';
import { Technology } from '@/components/sections/Technology';
import { HowItWorks } from '@/components/sections/HowItWorks';
import { UseCases } from '@/components/sections/UseCases';
import { Metrics } from '@/components/sections/Metrics';
import { Testimonials } from '@/components/sections/Testimonials';
import { FAQ } from '@/components/sections/FAQ';
import { FinalCTA } from '@/components/sections/FinalCTA';
import { Footer } from '@/components/sections/Footer';

export default function Home() {
  return (
    <div className="min-h-screen bg-background selection:bg-[#E8461E]/25 selection:text-[#1B1917] dark:selection:text-white">
      <Navbar />
      <main>
        <Hero />
        <TrustedBy />
        <Problem />
        <Solution />
        <Architecture />
        <Technology />
        <HowItWorks />
        <UseCases />
        <Metrics />
        <Testimonials />
        <FAQ />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  );
}
