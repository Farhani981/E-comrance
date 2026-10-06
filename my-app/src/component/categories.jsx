import React from 'react';
import { Link } from 'react-router-dom';
import { useProducts } from '../context/ProductContext';
import ScrollReveal from './ScrollReveal';

const Categories = () => {
  const { categories: contextCategories } = useProducts();
  const localFallbackImage = 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?q=80&w=600&auto=format&fit=crop';

  const categoriesList = (contextCategories && contextCategories.length > 0 ? contextCategories : [
    {
      id: 1,
      name: 'Casual Shirts',
      count: '140+ Products',
      img: 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?auto=format&fit=crop&w=400&q=80',
      link: '/shop?category=Casual-Shirts',
      isVisible: true
    },
    {
      id: 2,
      name: 'Formal Shirts',
      count: '95+ Products',
      img: 'https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?auto=format&fit=crop&w=400&q=80',
      link: '/shop?category=Formal-Shirts',
      isVisible: true
    },
    {
      id: 3,
      name: 'T-Shirts & Polos',
      count: '210+ Products',
      img: 'https://images.unsplash.com/photo-1571945153237-4929e783af4a?q=80&w=387',
      link: '/shop?category=T-Shirts',
      isVisible: true
    },
    {
      id: 4,
      name: 'Denim Jeans',
      count: '180+ Products',
      img: 'https://images.unsplash.com/photo-1638247025967-b4e38f787b76?q=80&w=435',
      link: '/shop?category=Jeans',
      isVisible: true
    },
    {
      id: 5,
      name: 'Jackets & Coats',
      count: '75+ Products',
      img: 'https://images.unsplash.com/photo-1551028719-00167b16eac5?auto=format&fit=crop&w=400&q=80',
      link: '/shop?category=Jackets',
      isVisible: true
    },
    {
      id: 6,
      name: 'Eastern Wear',
      count: '110+ Products',
      img: 'https://images.unsplash.com/photo-1617137984095-74e4e5e3613f?auto=format&fit=crop&w=400&q=80',
      link: '/shop?category=Shalwar-Kameez',
      isVisible: true
    },
    {
      id: 7,
      name: 'Sneakers & Shoes',
      count: '160+ Products',
      img: 'https://images.unsplash.com/photo-1549298916-b41d501d3772?auto=format&fit=crop&w=400&q=80',
      link: '/shop?category=Footwear',
      isVisible: true
    },
    {
      id: 8,
      name: 'Accessories',
      count: '90+ Products',
      img: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=400&q=80',
      link: '/shop?category=Accessories',
      isVisible: true
    }
  ]).filter(c => c.isVisible !== false);

  return (
    <>
      {/* Categories Section */}
      <section id="categories" style={{ scrollMarginTop: 130 }} className="my-12 px-4 max-w-7xl mx-auto">

        {/* Header Row */}
        <ScrollReveal className="relative flex items-center justify-between mb-8">
          <div className="text-left">
            <span className="text-[11px] font-bold uppercase tracking-[0.25em] text-orange-500 mb-1 block">Explore</span>
            <h2 className="text-2xl md:text-3xl font-extrabold text-slate-900">Men's Top Categories</h2>
            <p className="text-sm md:text-base text-slate-500 mt-1">Explore high quality premium men's collection</p>
          </div>

          <Link
            to="/shop"
            className="flex items-center gap-1 text-sm font-semibold text-slate-600 hover:text-orange-500 bg-slate-100 hover:bg-orange-50 border border-slate-200 hover:border-orange-200 px-4 md:px-5 py-2 md:py-2.5 rounded-full transition-all duration-200 whitespace-nowrap"
          >
            View All
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </ScrollReveal>

        {/* Horizontal Scrollable Container */}
        <div className="flex gap-5 overflow-x-auto pb-6 scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent scroll-smooth snap-x snap-mandatory -mx-1 px-1">
          {categoriesList.map((category, i) => (
            <Link
              key={category.id}
              to={`/shop?category=${encodeURIComponent(category.name)}`}
              className="snap-start group shrink-0 w-56 flex flex-col items-center p-4 bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-xl hover:border-orange-200 hover:-translate-y-2 transition-all duration-300 no-underline"
              style={{ transitionDelay: `${i * 30}ms` }}
            >
              <div className="w-full h-44 mb-4 rounded-xl overflow-hidden bg-slate-100">
                <img
                  src={(typeof category.img === 'string' && category.img.trim() !== '') ? category.img : localFallbackImage}
                  alt={category.name}
                  loading="lazy"
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                  onError={event => {
                    event.currentTarget.onerror = null;
                    event.currentTarget.src = localFallbackImage;
                  }}
                />
              </div>
              <h3 className="font-bold text-slate-800 text-sm group-hover:text-orange-500 transition-colors duration-200 text-center">
                {category.name}
              </h3>
              <span className="text-xs text-slate-400 mt-1">{category.count}</span>
            </Link>
          ))}
        </div>

      </section>
    </>
  );
};

export default Categories;