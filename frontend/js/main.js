// Cosmic AI - Main JS for Landing Page
// No logic needed here for now
// All navigation handled via links

document.addEventListener('DOMContentLoaded', () => {
  // Smooth scroll for explore button
  const exploreBtn = document.querySelector('[data-scroll]');
  if (exploreBtn) {
    exploreBtn.addEventListener('click', () => {
      document.getElementById('boards').scrollIntoView({ behavior: 'smooth' });
    });
  }
});
