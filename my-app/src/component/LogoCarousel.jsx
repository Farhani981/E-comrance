import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { brandLogos as defaultBrandLogos } from '../productsData';

export default function LogoCarousel({ 
  brands: customBrands = null, 
  title = "Official Brand Partners",
  speed = 26 
} = {}) {
  const [brands, setBrands] = useState(customBrands || defaultBrandLogos);

  useEffect(() => {
    if (customBrands && customBrands.length > 0) {
      setBrands(customBrands);
    } else {
      // Check for dynamically saved brands in localStorage or fallback to default
      const savedBrands = localStorage.getItem('dynamic_brands');
      if (savedBrands) {
        try {
          const parsed = JSON.parse(savedBrands);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setBrands(parsed);
            return;
          }
        } catch (e) {
          console.error("Failed to parse dynamic brands:", e);
        }
      }
      setBrands(defaultBrandLogos);
    }
  }, [customBrands]);

  if (!brands || brands.length === 0) return null;

  return (
    <div className="w-full bg-linear-to-r from-slate-50 via-slate-100/70 to-slate-50 py-10 my-8 overflow-hidden select-none">
      {/* Dynamic Header Label */}
      {title && (
        <div className="max-w-7xl mx-auto px-4 mb-6 text-center">
          <span className="text-xs uppercase tracking-[0.25em] font-bold text-slate-800 bg-slate-200/80 px-4 py-1.5 rounded-full inline-block">
            {title}
          </span>
        </div>
      )}

      {/* Dynamic Full Width Continuous Carousel Viewport */}
      <div className="relative w-full overflow-hidden">
        {/* Left & Right Smooth Edge Fade Overlays */}
        <div className="absolute left-0 top-0 bottom-0 w-16 md:w-36 bg-linear-to-r from-amber-50 via-amber-50/80 to-transparent z-20 pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-16 md:w-36 bg-linear-to-l from-amber-50 via-amber-50/80 to-transparent z-20 pointer-events-none" />

        {/* Continuous Scrolling Track */}
        <div 
          className="flex w-max items-center py-2 group/marquee"
          style={{
            animation: `continuousScroll ${speed}s linear infinite`,
            willChange: 'transform'
          }}
          onMouseEnter={e => e.currentTarget.style.animationPlayState = 'paused'}
          onMouseLeave={e => e.currentTarget.style.animationPlayState = 'running'}
        >
          {/* Dynamic Set 1 */}
          <div className="flex items-center gap-14 md:gap-24 px-8 shrink-0">
            {brands.map((brand, index) => (
              <Link
                key={`brand-1-${brand.id || index}`}
                to={brand.link || '/shop'}
                className="flex items-center justify-center opacity-75 hover:opacity-100 transition-all duration-300 shrink-0 transform hover:scale-110"
                title={brand.name}
              >
                {typeof brand.image === 'string' && brand.image.trim() !== '' ? (
                  <img
                    src={brand.image}
                    alt={brand.name}
                    className="h-10 md:h-12 w-auto max-w-32.5 md:max-w-[160px] object-contain filter grayscale hover:grayscale-0 transition-all duration-300"
                    onError={(e) => {
                      // Fallback to stylized text if image fails to load
                      e.target.style.display = 'none';
                      if (e.target.nextSibling) e.target.nextSibling.style.display = 'block';
                    }}
                  />
                ) : null}
                <span 
                  style={{ display: (typeof brand.image === 'string' && brand.image.trim() !== '') ? 'none' : 'block' }}
                  className="font-bold text-xl md:text-2xl text-slate-800 tracking-wider uppercase font-sans"
                >
                  {brand.name}
                </span>
              </Link>
            ))}
          </div>

          {/* Dynamic Set 2 (Duplicate for seamless continuous loop) */}
          <div className="flex items-center gap-14 md:gap-24 px-8 shrink-0">
            {brands.map((brand, index) => (
              <Link
                key={`brand-2-${brand.id || index}`}
                to={brand.link || '/shop'}
                className="flex items-center justify-center opacity-75 hover:opacity-100 transition-all duration-300 shrink-0 transform hover:scale-110"
                title={brand.name}
              >
                {typeof brand.image === 'string' && brand.image.trim() !== '' ? (
                  <img
                    src={brand.image}
                    alt={brand.name}
                    className="h-10 md:h-12 w-auto max-w-[130px] md:max-w-[160px] object-contain filter grayscale hover:grayscale-0 transition-all duration-300"
                    onError={(e) => {
                      e.target.style.display = 'none';
                      if (e.target.nextSibling) e.target.nextSibling.style.display = 'block';
                    }}
                  />
                ) : null}
                <span 
                  style={{ display: (typeof brand.image === 'string' && brand.image.trim() !== '') ? 'none' : 'block' }}
                  className="font-bold text-xl md:text-2xl text-slate-800 tracking-wider uppercase font-sans"
                >
                  {brand.name}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Embedded CSS Keyframes for non-stop continuous animation */}
      <style>{`
        @keyframes continuousScroll {
          0% {
            transform: translateX(0%);
          }
          100% {
            transform: translateX(-50%);
          }
        }
      `}</style>
    </div>
  );
}