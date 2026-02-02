import { useEffect } from 'react';

export default function App() {
  useEffect(() => {
    const menuToggle = document.getElementById('menuToggle');
    const navLinks = document.getElementById('navLinks');
    const header = document.getElementById('header');

    const toggleMenu = () => {
      if (!navLinks || !menuToggle) return;
      navLinks.classList.toggle('active');
      menuToggle.classList.toggle('active');
    };

    const closeMenu = () => {
      if (!navLinks || !menuToggle) return;
      navLinks.classList.remove('active');
      menuToggle.classList.remove('active');
    };

    if (menuToggle) {
      menuToggle.addEventListener('click', toggleMenu);
    }

    if (navLinks) {
      navLinks.querySelectorAll('a').forEach((link) => {
        link.addEventListener('click', closeMenu);
      });
    }

    const handleScroll = () => {
      if (!header) return;
      if (window.pageYOffset > 100) {
        header.classList.add('scrolled');
      } else {
        header.classList.remove('scrolled');
      }
    };

    window.addEventListener('scroll', handleScroll);
    handleScroll();

    const anchorLinks = Array.from(document.querySelectorAll('a[href^="#"]'));
    const handleAnchorClick = (event) => {
      const href = event.currentTarget.getAttribute('href');
      if (!href || href.length === 1) return;
      const target = document.querySelector(href);
      if (!target) return;
      event.preventDefault();
      const headerHeight = header ? header.offsetHeight : 0;
      const targetPosition = target.offsetTop - headerHeight;
      window.scrollTo({
        top: targetPosition,
        behavior: 'smooth',
      });
    };

    anchorLinks.forEach((anchor) => {
      anchor.addEventListener('click', handleAnchorClick);
    });

    const observerOptions = {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px',
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
        }
      });
    }, observerOptions);

    const fadeIns = document.querySelectorAll('.fade-in');
    fadeIns.forEach((element) => observer.observe(element));

    let cursor = document.querySelector('.custom-cursor');
    const hoverTargets = Array.from(document.querySelectorAll('a, button, .card, .service-card, .btn'));

    const handleMouseMove = (event) => {
      if (!cursor) return;
      cursor.style.display = 'block';
      cursor.style.left = `${event.clientX - 10}px`;
      cursor.style.top = `${event.clientY - 10}px`;
    };

    const handleHoverEnter = () => {
      if (!cursor) return;
      cursor.style.transform = 'scale(2)';
    };

    const handleHoverLeave = () => {
      if (!cursor) return;
      cursor.style.transform = 'scale(1)';
    };

    if (window.innerWidth > 768) {
      if (!cursor) {
        cursor = document.createElement('div');
        cursor.className = 'custom-cursor';
        document.body.appendChild(cursor);
      }

      cursor.style.cssText = `
            position: fixed;
            width: 20px;
            height: 20px;
            border-radius: 50%;
            background: var(--color-sage);
            pointer-events: none;
            z-index: 9999;
            opacity: 0.6;
            transition: transform 0.2s ease;
            display: none;
        `;

      document.addEventListener('mousemove', handleMouseMove);
      hoverTargets.forEach((element) => {
        element.addEventListener('mouseenter', handleHoverEnter);
        element.addEventListener('mouseleave', handleHoverLeave);
      });
    }

    return () => {
      if (menuToggle) {
        menuToggle.removeEventListener('click', toggleMenu);
      }
      if (navLinks) {
        navLinks.querySelectorAll('a').forEach((link) => {
          link.removeEventListener('click', closeMenu);
        });
      }
      window.removeEventListener('scroll', handleScroll);
      anchorLinks.forEach((anchor) => {
        anchor.removeEventListener('click', handleAnchorClick);
      });
      observer.disconnect();
      document.removeEventListener('mousemove', handleMouseMove);
      hoverTargets.forEach((element) => {
        element.removeEventListener('mouseenter', handleHoverEnter);
        element.removeEventListener('mouseleave', handleHoverLeave);
      });
    };
  }, []);

  return (
    <div className="site">
      <header className="header" id="header">
        <nav className="nav">
          <a href="#home" className="logo">
            <img src="/assets/logo1.svg" alt="kreate & co" className="logo-img" />
          </a>

          <ul className="nav-links" id="navLinks">
            <li>
              <a href="#about">About</a>
            </li>
            <li>
              <a href="#services">Services</a>
            </li>
            <li>
              <a href="#contact" className="btn-nav-cta">
                Let's Talk
              </a>
            </li>
          </ul>

          <button className="menu-toggle" id="menuToggle" aria-label="Toggle menu" type="button">
            <span></span>
            <span></span>
            <span></span>
          </button>
        </nav>
      </header>

      <main>
        <section className="hero section" id="home">
          <div className="container">
            <div className="hero-content">
              <div className="hero-text fade-in visible">
                <h1>
                  <span style={{ color: '#70113F', display: 'block' }}>BUILT BY BRANDS.</span>
                  <span>POWERED BY CREATORS.</span>
                </h1>
                <p className="hero-subtitle">Stop chasing creators and start seeing results.</p>

                <div className="hero-cta">
                  <a href="#contact" className="btn btn-primary">
                    Work With Us
                  </a>
                  <a href="#services" className="btn btn-secondary">
                    Our Services
                  </a>
                </div>
              </div>

              <div className="hero-visual fade-in visible">
                <img src="/assets/star.svg" alt="kreate & co" className="star-visual" />
              </div>
            </div>
          </div>
        </section>

        <section className="about section" id="about">
          <div className="container">
            <div className="about-content">
              <div className="about-text fade-in">
                <p
                  style={{
                    fontSize: '0.875rem',
                    letterSpacing: '2px',
                    textTransform: 'uppercase',
                    color: 'var(--color-sage)',
                  }}
                >
                  Who We Are
                </p>
                <h2>About Kreate&Co</h2>

                <p className="about-description">
                  Kreate&Co was built on a simple idea: good content doesn't need to feel forced to perform. We sit at
                  the intersection of brands and creators, helping both sides collaborate in a way that feels clear,
                  intentional, and effective. No overcomplication, no mismatched partnerships, just content that makes
                  sense. We focus on quality, alignment, and execution, making sure every piece of content has a purpose
                  and a place to live.
                </p>
              </div>

              <div className="about-visual fade-in">
                <img src="/assets/arrows.svg" alt="Team" className="animated-arrows" />
              </div>
            </div>
          </div>
        </section>

        <section className="services section scalloped-top scalloped-bottom" id="services">
          <div className="container">
            <div className="section-title fade-in">
              <h2 className="section-heading" style={{ fontWeight: 800, color: '#70113F' }}>
                Our Services
              </h2>
            </div>

            <div className="services-grid">
              <div className="service-card pink fade-in" style={{ color: 'white' }}>
                <div className="service-icon">
                  <img src="/assets/star.svg" alt="star icon" />
                </div>
                <h3 style={{ color: 'white' }}>UGC Content Production</h3>
                <p style={{ marginTop: '1rem', color: 'white' }}>
                  Authentic, creator-led videos and visuals for ads, websites and social platforms.
                </p>
              </div>

              <div className="service-card lavender fade-in" style={{ color: '#70113F' }}>
                <div className="service-icon">
                  <img src="/assets/star.svg" alt="star icon" />
                </div>
                <h3>Influencer Campaigns</h3>
                <p style={{ marginTop: '1rem' }}>
                  End-to-end management, from creator selection and briefing to delivery and coordination.
                </p>
              </div>

              <div className="service-card lime fade-in" style={{ color: 'white' }}>
                <div className="service-icon">
                  <div className="star-icon-green"></div>
                </div>
                <h3>Creator Sourcing</h3>
                <p style={{ marginTop: '1rem' }}>
                  We connect you with the right creators, ones who actually fit your brand and audience.
                </p>
              </div>

              <div className="service-card pink fade-in" style={{ color: '#70113F' }}>
                <div className="service-icon">
                  <img src="/assets/star.svg" alt="star icon" />
                </div>
                <h3>Campaign Strategy</h3>
                <p style={{ marginTop: '1rem' }}>
                  Guidance on what content to create, how to use it, and where it performs best.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="brands" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="brands-title-strip">
            <h3 className="brands-heading">Our Clients</h3>
          </div>

          <div className="brands-marquee-strip">
            <div className="marquee-container">
              <div className="marquee-content">
                <span>Rabbit</span>
                <span>Hankology</span>
                <span>Chez Koukou</span>
                <span>Minilet</span>
                <span>Rabbit</span>
                <span>Hankology</span>
                <span>Chez Koukou</span>
                <span>Minilet</span>
              </div>
            </div>
          </div>
        </section>

        <section className="section contact-section" id="contact">
          <div className="split-contact-wrapper">
            <div className="contact-panel creators-panel fade-in">
              <div className="panel-header">
                <p className="form-label">FOR CREATORS</p>
                <h2>
                  Want to work
                  <br />
                  with real brands?
                </h2>
              </div>

              <a href="creator-form.html" className="btn btn-primary">
                Apply Now
              </a>
            </div>

            <div className="contact-panel brands-panel fade-in">
              <div className="panel-header">
                <p className="form-label">FOR BRANDS</p>
                <h2>
                  Let's build your
                  <br />
                  next campaign.
                </h2>
              </div>

              <a href="brand-form.html" className="btn btn-secondary">
                Work with Us
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="container">
          <div className="footer-content">
            <div className="footer-section">
              <h3>Kreate&Co</h3>
              <p>Built By Brands, Powered By Creators</p>
              <div className="social-links" style={{ marginTop: '1rem' }}>
                <a
                  href="https://www.instagram.com/thekreateandco?igsh=MW51c2ZjeGNwdXFqcQ=="
                  className="social-icon"
                  aria-label="Instagram"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <i className="fab fa-instagram"></i>
                </a>
                <a href="https://www.kreateandco.com/#" className="social-icon" aria-label="TikTok">
                  <i className="fab fa-tiktok"></i>
                </a>
              </div>
            </div>

            <div className="footer-section">
              <h3>Contact</h3>
              <ul className="footer-links">
                <li>
                  <a href="mailto:info@kreateandco.com">info@kreateandco.com</a>
                </li>
                <li>CAI,EG</li>
              </ul>
            </div>
          </div>

          <div className="footer-bottom">
            <p>© 2026 Kreate&Co. All rights reserved.</p>
          </div>
        </div>
      </footer>

      <div className="custom-cursor" aria-hidden="true"></div>
    </div>
  );
}
