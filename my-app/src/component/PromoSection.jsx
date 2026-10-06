import { useProducts } from '../context/ProductContext';
import { PromoCard } from './Hero.jsx';
import ScrollReveal from './ScrollReveal';

export default function PromoSection() {
  const { twoColumnBanners, bannerLoading } = useProducts();
  const promos = twoColumnBanners.filter((b) => b.isActive).slice(0, 2);

  if (bannerLoading || promos.length === 0) return null;

  return (
    <section className="promo-section" aria-label="Promotional offers">
      <div className="promo-section-inner">
        <ScrollReveal className="promo-section-header">
          <span className="promo-section-eyebrow">Limited Time</span>
          <h2 className="promo-section-title">Special Offers</h2>
          <p className="promo-section-subtitle">Don't miss out on these exclusive deals</p>
        </ScrollReveal>

        <div className={`promo-section-grid ${promos.length === 1 ? 'promo-section-grid--single' : ''}`}>
          {promos.map((banner, i) => (
            <ScrollReveal key={banner.id} delay={i * 120}>
              <PromoCard banner={banner} />
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
