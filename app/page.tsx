import { Navigation } from '@/components/navigation'
import { Hero } from '@/components/hero'
import { StorySection } from '@/components/story-section'
import { ProductSection } from '@/components/product-section'
import { ResultsSection } from '@/components/results-section'
import { PricingSection } from '@/components/pricing-section'
import { FAQSection } from '@/components/faq-section'
import { CTASection } from '@/components/cta-section'
import { Footer } from '@/components/footer'

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
