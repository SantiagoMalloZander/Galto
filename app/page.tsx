import { Navigation } from '@/components/landing/navigation'
import { Hero } from '@/components/landing/hero'
import { StorySection } from '@/components/landing/story-section'
import { ProductSection } from '@/components/landing/product-section'
import { ResultsSection } from '@/components/landing/results-section'
import { PricingSection } from '@/components/landing/pricing-section'
import { FAQSection } from '@/components/landing/faq-section'
import { CTASection } from '@/components/landing/cta-section'
import { Footer } from '@/components/landing/footer'

export default function Page() {
  return (
    <main className="min-h-screen bg-background">
      <Navigation />
      <Hero />
      <StorySection />
      <ProductSection />
      <ResultsSection />
      <PricingSection />
      <FAQSection />
      <CTASection />
      <Footer />
    </main>
  )
}
