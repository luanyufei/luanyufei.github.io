/* ============================================================
   Footer Brand Injection Script
   Injects "FeeFeeNOON" text before the Butterfly footer
   ============================================================ */
(() => {
  'use strict';

  function createBrandSection() {
    const section = document.createElement('div');
    section.className = 'footer-brand-section';
    section.setAttribute('aria-hidden', 'true');

    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('class', 'footer-brand-svg');
    svg.setAttribute('viewBox', '0 0 810 140');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', 'auto');
    svg.setAttribute('aria-label', 'FeeFeeNOON');

    const text = document.createElementNS(svgNS, 'text');
    text.setAttribute('x', '50%');
    text.setAttribute('y', '108');
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('class', 'footer-brand-text');
    text.textContent = 'FeeFeeNOON';

    svg.appendChild(text);
    section.appendChild(svg);
    return section;
  }

  function inject() {
    const footer = document.getElementById('footer');
    if (!footer) return;

    if (footer.parentNode.querySelector('.footer-brand-section')) return;

    const brandSection = createBrandSection();
    footer.parentNode.insertBefore(brandSection, footer);

    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add('is-visible');
              observer.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.05, rootMargin: '0px 0px -20px 0px' }
      );
      observer.observe(brandSection);
    } else {
      brandSection.classList.add('is-visible');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inject);
  } else {
    inject();
  }
})();
