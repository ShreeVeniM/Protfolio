// Cursor glow
  const glow = document.getElementById('glow');
  document.addEventListener('mousemove', e => {
    glow.style.left = e.clientX + 'px';
    glow.style.top = e.clientY + 'px';
  });

  // Fade in on scroll (progressive enhancement — content is visible by default in CSS;
  // only elements this JS reaches get opted into the hidden/reveal animation)
  const fadeEls = document.querySelectorAll('.fade-up');
  fadeEls.forEach(el => el.classList.add('js-ready'));
  const observer = new IntersectionObserver(entries => {
    entries.forEach((entry, i) => {
      if (entry.isIntersecting) {
        setTimeout(() => entry.target.classList.add('visible'), i * 100);
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });
  fadeEls.forEach(el => observer.observe(el));

  // Project filter
  function filterProjects(category, btn) {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.project-card').forEach(card => {
      if (category === 'all' || card.dataset.category.includes(category)) {
        card.style.display = 'flex';
      } else {
        card.style.display = 'none';
      }
    });
  }

  // Resume download placeholder
  document.getElementById('resume-link').addEventListener('click', e => {
    e.preventDefault();
    alert('Resume PDF coming soon! Please email mshreeveni@gmail.com to request a copy.');
  });
  document.getElementById('resume-btn').addEventListener('click', e => {
    e.preventDefault();
    alert('Resume PDF coming soon! Please email mshreeveni@gmail.com to request a copy.');
  });
