import { useState, useEffect, useRef } from 'react';
import ScrollReveal from './ScrollReveal';


function StarRating({ rating }) {
  return (
    <div className="cr-stars" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <svg
          key={star}
          className={`cr-star ${star <= rating ? 'cr-star--filled' : ''}`}
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
}

function ReviewCard({ review, index }) {
  return (
    <ScrollReveal delay={index * 100}>
      <article className="cr-card">
        <div className="cr-card-header">
          <div className="cr-avatar" style={{ '--hue': (review.id * 55) % 360 }}>
            {review.name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase()}
          </div>
          <div className="cr-meta">
            <div className="cr-name-row">
              <h3 className="cr-name">{review.name}</h3>
            </div>
            <span className="cr-date">{new Date(review.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })} · {review.product_name}</span>
          </div>
        </div>

        <StarRating rating={review.rating} />

        <p className="cr-text">{review.comment}</p>
      </article>
    </ScrollReveal>
  );
}

export default function CustomerReviews() {
  const scrollRef = useRef(null);
  const [data, setData] = useState({ reviews: [], total: 0, averageRating: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let controller;
    const load = async () => {
      controller?.abort();
      const request = new AbortController();
      controller = request;
      try {
        const response = await fetch('/api/operations/reviews/approved', { signal: request.signal, cache: 'no-store' });
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error('Could not load reviews.');
        if (!request.signal.aborted) {
          setData(result);
          setError('');
        }
      } catch {
        if (!request.signal.aborted) {
          setData({ reviews: [], total: 0, averageRating: 0 });
          setError('Reviews are temporarily unavailable. Please try again shortly.');
        }
      } finally {
        if (!request.signal.aborted) setLoading(false);
      }
    };
    const refresh = () => { if (!document.hidden) void load(); };
    void load();
    const timer = window.setInterval(refresh, 30000);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      controller?.abort();
      window.clearInterval(timer);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, []);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 8);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 8);
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    checkScroll();
    el.addEventListener('scroll', checkScroll, { passive: true });
    window.addEventListener('resize', checkScroll);
    return () => {
      el.removeEventListener('scroll', checkScroll);
      window.removeEventListener('resize', checkScroll);
    };
  }, [data.reviews]);

  const scroll = (direction) => {
    const el = scrollRef.current;
    if (!el) return;
    const amount = el.clientWidth * 0.75;
    el.scrollBy({ left: direction === 'left' ? -amount : amount, behavior: 'smooth' });
  };

  const avgRating = Number(data.averageRating).toFixed(1);

  return (
    <section className="cr-section" aria-label="Customer Reviews">
      <div className="cr-inner">
        {/* Header */}
        <ScrollReveal className="cr-header">
          <div className="cr-header-left">
            <span className="cr-eyebrow">Customer Reviews</span>
            <h2 className="cr-heading">What Our Customers Say</h2>
            <p className="cr-subheading">Reviews shared by our customers</p>
          </div>
          <div className="cr-header-right">
            {data.total > 0 && <div className="cr-stats">
              <div className="cr-stat-rating">
                <span className="cr-stat-number">{avgRating}</span>
                <StarRating rating={Math.round(Number(avgRating))} />
              </div>
              <span className="cr-stat-label">Based on {data.total} {data.total === 1 ? 'review' : 'reviews'}</span>
            </div>}
            <div className="cr-nav-arrows">
              <button
                onClick={() => scroll('left')}
                disabled={!canScrollLeft}
                className="cr-arrow"
                aria-label="Scroll reviews left"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 12H5m6-6-6 6 6 6" />
                </svg>
              </button>
              <button
                onClick={() => scroll('right')}
                disabled={!canScrollRight}
                className="cr-arrow"
                aria-label="Scroll reviews right"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14m-6-6 6 6-6 6" />
                </svg>
              </button>
            </div>
          </div>
        </ScrollReveal>

        {loading && <p role="status">Loading customer reviews...</p>}
        {error && <p role="status">{error}</p>}
        {!loading && !error && data.total === 0 && (
          <p className="cr-subheading">No published reviews yet. Share your experience from a product page; your review will appear after approval.</p>
        )}
        {/* Cards */}
        <div className="cr-track-wrapper">
          {canScrollLeft && <div className="cr-fade cr-fade--left" />}
          {canScrollRight && <div className="cr-fade cr-fade--right" />}
          <div className="cr-track" ref={scrollRef}>
            {data.reviews.map((review, i) => (
              <ReviewCard key={review.id} review={review} index={i} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
