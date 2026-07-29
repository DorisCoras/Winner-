/* ==========================================================================
   Winner Marble — Etkileşim motoru
   Bağımlılık yok. Yerel kaydırma korunur (position:fixed bozulmaz),
   akıcılık lerp'lenmiş bir rAF döngüsüyle sağlanır.
   ========================================================================== */
(function () {
  'use strict';

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var supportsHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }

  /* ------------------------------------------------------------------
     Merkezi kaydırma döngüsü — tüm efektler tek rAF üzerinden çalışır
     ------------------------------------------------------------------ */
  var scrollY = window.pageYOffset || 0;
  var smoothY = scrollY;
  var viewportH = window.innerHeight;
  var docH = 0;
  // Global görevler bir kez kaydedilir; sayfaya bağlı olanlar her
  // içerik değişiminde sıfırlanır (tek dosyalık sürümde sayfa geçişleri için).
  var frameTasks = [];
  var pageTasks = [];
  var pageResize = [];

  function onFrame(fn) { frameTasks.push(fn); }
  function onPageFrame(fn) { pageTasks.push(fn); }
  function onPageResize(fn) { pageResize.push(fn); }

  function measure() {
    viewportH = window.innerHeight;
    docH = Math.max(
      document.body.scrollHeight,
      document.documentElement.scrollHeight
    );
  }

  function tick() {
    scrollY = window.pageYOffset || document.documentElement.scrollTop || 0;
    smoothY = reduced ? scrollY : lerp(smoothY, scrollY, 0.12);
    if (Math.abs(smoothY - scrollY) < 0.08) smoothY = scrollY;

    var i;
    for (i = 0; i < frameTasks.length; i++) {
      try { frameTasks[i](scrollY, smoothY); } catch (e) { /* tek görev tüm döngüyü düşürmesin */ }
    }
    for (i = 0; i < pageTasks.length; i++) {
      try { pageTasks[i](scrollY, smoothY); } catch (e) { /* aynı şekilde */ }
    }
    requestAnimationFrame(tick);
  }

  /* ------------------------------------------------------------------
     1. Yükleme perdesi
     ------------------------------------------------------------------ */
  function initLoader() {
    var loader = $('.loader');
    if (!loader) return;
    var bar = $('.loader__bar i', loader);
    var imgs = $$('img');
    var total = imgs.length || 1;
    var done = 0;

    function bump() {
      done++;
      if (bar) bar.style.width = Math.min(100, (done / total) * 100) + '%';
    }

    imgs.forEach(function (img) {
      if (img.complete) { bump(); return; }
      img.addEventListener('load', bump, { once: true });
      img.addEventListener('error', bump, { once: true });
    });

    function finish() {
      if (bar) bar.style.width = '100%';
      setTimeout(function () {
        loader.classList.add('is-done');
        document.body.classList.remove('is-locked');
        document.documentElement.classList.add('is-loaded');
        var hero = $('[data-hero]');
        if (hero) hero.classList.add('is-revealed');
      }, 260);
    }

    window.addEventListener('load', finish);
    // Ağ yavaşsa sayfayı sonsuza kadar kilitli tutma
    setTimeout(finish, 3500);
  }

  /* ------------------------------------------------------------------
     2. Üst menü davranışı
     ------------------------------------------------------------------ */
  function initNav() {
    var nav = $('.site-nav');
    if (!nav) return;

    var lastY = 0;
    var toggle = $('.nav-toggle');
    var drawer = $('.nav-drawer');

    onFrame(function (y) {
      nav.classList.toggle('is-stuck', y > 40);

      // Aşağı kaydırırken gizle, yukarı kaydırırken göster
      var open = drawer && drawer.classList.contains('is-open');
      if (!open && y > 260 && y > lastY + 4) {
        nav.classList.add('is-hidden');
      } else if (y < lastY - 4 || y < 120) {
        nav.classList.remove('is-hidden');
      }
      lastY = y;
    });

    // Mobil çekmece
    if (toggle && drawer) {
      var links = $$('.nav-drawer__link', drawer);
      links.forEach(function (l, i) {
        l.style.transitionDelay = (0.06 + i * 0.045) + 's';
      });

      toggle.addEventListener('click', function () {
        var open = drawer.classList.toggle('is-open');
        toggle.classList.toggle('is-open', open);
        toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
        document.body.classList.toggle('is-locked', open);
      });

      drawer.addEventListener('click', function (e) {
        if (e.target.closest('a')) {
          drawer.classList.remove('is-open');
          toggle.classList.remove('is-open');
          toggle.setAttribute('aria-expanded', 'false');
          document.body.classList.remove('is-locked');
        }
      });

      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && drawer.classList.contains('is-open')) {
          toggle.click();
        }
      });
    }

    // Mega menü — dokunmatik cihazlarda ilk dokunuşta açılır
    $$('.has-mega').forEach(function (item) {
      var trigger = $('.nav-link', item);
      var mega = $('.mega', item);
      if (!trigger || !mega) return;
      if (!supportsHover) {
        trigger.addEventListener('click', function (e) {
          if (!mega.classList.contains('is-open')) {
            e.preventDefault();
            mega.classList.add('is-open');
          }
        });
        document.addEventListener('click', function (e) {
          if (!item.contains(e.target)) mega.classList.remove('is-open');
        });
      }
    });
  }

  /* ------------------------------------------------------------------
     3. Kaydırma ilerleme çubuğu
     ------------------------------------------------------------------ */
  function initProgress() {
    var bar = $('.scroll-progress');
    if (!bar) return;
    onFrame(function (y) {
      var max = docH - viewportH;
      bar.style.setProperty('--progress', max > 0 ? clamp(y / max, 0, 1) : 0);
    });
  }

  /* ------------------------------------------------------------------
     4. Görünüre girince ortaya çıkma
     ------------------------------------------------------------------ */
  function initReveal() {
    var items = $$('[data-reveal], [data-reveal-stagger]');
    if (!items.length) return;

    if (reduced || !('IntersectionObserver' in window)) {
      items.forEach(function (el) { el.classList.add('is-in'); });
      return;
    }

    // Sıralı gecikmeleri uygula
    $$('[data-reveal-stagger]').forEach(function (group) {
      var step = parseFloat(group.getAttribute('data-reveal-stagger')) || 0.08;
      Array.prototype.forEach.call(group.children, function (child, i) {
        child.style.transitionDelay = (i * step) + 's';
      });
    });

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        var delay = parseFloat(el.getAttribute('data-reveal-delay')) || 0;
        if (delay) el.style.transitionDelay = delay + 's';
        el.classList.add('is-in');
        io.unobserve(el);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });

    items.forEach(function (el) { io.observe(el); });
  }

  /* ------------------------------------------------------------------
     5. Paralaks katmanlar
     ------------------------------------------------------------------ */
  function initParallax() {
    var layers = $$('[data-parallax]');
    if (!layers.length || reduced) return;

    var cache = [];
    function remeasure() {
      cache = layers.map(function (el) {
        var r = el.getBoundingClientRect();
        return {
          el: el,
          speed: parseFloat(el.getAttribute('data-parallax')) || 0.15,
          top: r.top + (window.pageYOffset || 0),
          h: r.height
        };
      });
    }
    remeasure();
    onPageResize(remeasure);
    window.addEventListener('load', remeasure);

    onPageFrame(function (y, sy) {
      for (var i = 0; i < cache.length; i++) {
        var c = cache[i];
        // Öğe görünür alandayken -1..1 arası konum
        var rel = (sy + viewportH - c.top) / (viewportH + c.h);
        if (rel < -0.25 || rel > 1.25) continue;
        var shift = (rel - 0.5) * c.speed * 200;
        c.el.style.transform = 'translate3d(0,' + shift.toFixed(2) + 'px,0)';
      }
    });
  }

  /* ------------------------------------------------------------------
     6. Yatay kaydırmalı galeri (sticky ile sabitlenir)
     ------------------------------------------------------------------ */
  function initHScroll() {
    $$('.hscroll').forEach(function (section) {
      var track = $('.hscroll__track', section);
      if (!track) return;

      var isMobile = window.matchMedia('(max-width: 900px)').matches;
      if (isMobile) return; // mobilde doğal dokunmatik kaydırma

      function distance() {
        return Math.max(0, track.scrollWidth - window.innerWidth + 32);
      }

      function sizeSection() {
        // Yatay mesafe kadar dikey alan ayır
        section.style.height = (window.innerHeight + distance()) + 'px';
      }
      sizeSection();
      onPageResize(sizeSection);
      window.addEventListener('load', sizeSection);

      onPageFrame(function (y, sy) {
        var rect = section.getBoundingClientRect();
        var start = sy + rect.top;
        var d = distance();
        if (d <= 0) return;
        var p = clamp((sy - start) / d, 0, 1);
        track.style.transform = 'translate3d(' + (-p * d).toFixed(2) + 'px,0,0)';
      });
    });
  }

  /* ------------------------------------------------------------------
     7. Sayaç animasyonu
     ------------------------------------------------------------------ */
  function initCounters() {
    var els = $$('[data-count]');
    if (!els.length) return;

    if (reduced || !('IntersectionObserver' in window)) {
      els.forEach(function (el) { el.textContent = el.getAttribute('data-count'); });
      return;
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        io.unobserve(el);

        var target = parseFloat(el.getAttribute('data-count')) || 0;
        var decimals = (el.getAttribute('data-count').split('.')[1] || '').length;
        var dur = 1700;
        var t0 = performance.now();

        (function step(now) {
          var p = clamp((now - t0) / dur, 0, 1);
          // easeOutExpo
          var e = p === 1 ? 1 : 1 - Math.pow(2, -10 * p);
          el.textContent = (target * e).toFixed(decimals);
          if (p < 1) requestAnimationFrame(step);
          else el.textContent = target.toFixed(decimals);
        })(t0);
      });
    }, { threshold: 0.5 });

    els.forEach(function (el) { el.textContent = '0'; io.observe(el); });
  }

  /* ------------------------------------------------------------------
     8. Akordiyon
     ------------------------------------------------------------------ */
  function initAccordion() {
    $$('.acc-trigger').forEach(function (btn) {
      var item = btn.closest('.acc-item');
      var panel = $('.acc-panel', item);
      if (!panel) return;

      btn.setAttribute('aria-expanded', 'false');

      btn.addEventListener('click', function () {
        var open = item.classList.contains('is-open');

        // Aynı grupta tek panel açık kalsın
        var group = item.closest('.accordion');
        if (group && !open) {
          $$('.acc-item.is-open', group).forEach(function (other) {
            other.classList.remove('is-open');
            var op = $('.acc-panel', other);
            var ob = $('.acc-trigger', other);
            if (op) op.style.height = '0px';
            if (ob) ob.setAttribute('aria-expanded', 'false');
          });
        }

        item.classList.toggle('is-open', !open);
        btn.setAttribute('aria-expanded', !open ? 'true' : 'false');
        panel.style.height = !open ? panel.scrollHeight + 'px' : '0px';
      });
    });

    onPageResize(function () {
      $$('.acc-item.is-open .acc-panel').forEach(function (p) {
        p.style.height = p.scrollHeight + 'px';
      });
    });
  }

  /* ------------------------------------------------------------------
     9. Kayan yazı şeridi — kesintisiz döngü için içerik ikilenir
     ------------------------------------------------------------------ */
  function initMarquee() {
    $$('.marquee__track').forEach(function (track) {
      if (track.getAttribute('data-cloned') === '1') return;
      track.innerHTML += track.innerHTML;
      track.setAttribute('data-cloned', '1');
    });
  }

  /* ------------------------------------------------------------------
     10. Cam yüzeyde imleç parlaması + mıknatıs düğmeler
     ------------------------------------------------------------------ */
  function initGlassPointer() {
    if (!supportsHover) return;

    $$('.glass').forEach(function (el) {
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect();
        el.style.setProperty('--mx', ((e.clientX - r.left) / r.width * 100) + '%');
        el.style.setProperty('--my', ((e.clientY - r.top) / r.height * 100) + '%');
      });
    });

    $$('.btn--magnetic').forEach(function (el) {
      var strength = 0.28;
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect();
        el.style.setProperty('--tx', ((e.clientX - r.left - r.width / 2) * strength).toFixed(1) + 'px');
        el.style.setProperty('--ty', ((e.clientY - r.top - r.height / 2) * strength).toFixed(1) + 'px');
      });
      el.addEventListener('pointerleave', function () {
        el.style.setProperty('--tx', '0px');
        el.style.setProperty('--ty', '0px');
      });
    });
  }

  /* ------------------------------------------------------------------
     11. Özel imleç
     ------------------------------------------------------------------ */
  function initCursor() {
    if (!supportsHover || reduced) return;

    var ring = document.createElement('div');
    ring.className = 'cursor';
    var dot = document.createElement('div');
    dot.className = 'cursor-dot';
    document.body.appendChild(ring);
    document.body.appendChild(dot);

    var mx = window.innerWidth / 2, my = window.innerHeight / 2;
    var rx = mx, ry = my;

    document.addEventListener('pointermove', function (e) {
      mx = e.clientX; my = e.clientY;
      dot.style.transform = 'translate3d(' + (mx - 2.5) + 'px,' + (my - 2.5) + 'px,0)';
    });

    (function loop() {
      rx = lerp(rx, mx, 0.16);
      ry = lerp(ry, my, 0.16);
      var s = ring.classList.contains('is-hover') ? 31 : 17;
      ring.style.transform = 'translate3d(' + (rx - s) + 'px,' + (ry - s) + 'px,0)';
      requestAnimationFrame(loop);
    })();

    var hoverSel = 'a, button, .stone-card, .cat-card, .acc-trigger, input, select, textarea, .stone-viewer';
    document.addEventListener('pointerover', function (e) {
      if (e.target.closest(hoverSel)) ring.classList.add('is-hover');
    });
    document.addEventListener('pointerout', function (e) {
      if (e.target.closest(hoverSel)) ring.classList.remove('is-hover');
    });
  }

  /* ------------------------------------------------------------------
     12. Yukarı çık düğmesi
     ------------------------------------------------------------------ */
  function initToTop() {
    var btn = $('.to-top');
    if (!btn) return;
    onFrame(function (y) { btn.classList.toggle('is-visible', y > viewportH * 0.9); });
    btn.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
    });
  }

  /* ------------------------------------------------------------------
     13. İç bağlantılarda yumuşak geçiş (sabit menü payı ile)
     ------------------------------------------------------------------ */
  function initAnchors() {
    document.addEventListener('click', function (e) {
      var a = e.target.closest('a[href^="#"]');
      if (!a) return;
      var id = a.getAttribute('href');
      if (!id || id === '#' || id.length < 2) return;
      var target = document.getElementById(id.slice(1));
      if (!target) return;
      e.preventDefault();
      var top = target.getBoundingClientRect().top + (window.pageYOffset || 0) - 84;
      window.scrollTo({ top: top, behavior: reduced ? 'auto' : 'smooth' });
    });
  }

  /* ------------------------------------------------------------------
     14. İletişim formu
         Sunucuda form-handler.php varsa oraya gönderir,
         yoksa kullanıcının e-posta istemcisini açar.
     ------------------------------------------------------------------ */
  function initForm() {
    var form = $('[data-contact-form]');
    if (!form) return;

    var status = $('.form__status', form);

    function say(msg, ok) {
      if (!status) { window.alert(msg); return; }
      status.textContent = msg;
      status.classList.add('is-visible');
      status.classList.toggle('form__status--ok', !!ok);
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();

      // Bot tuzağı
      var trap = form.querySelector('[name="website"]');
      if (trap && trap.value) return;

      var data = new FormData(form);
      var name = (data.get('name') || '').toString().trim();
      var email = (data.get('email') || '').toString().trim();
      var message = (data.get('message') || '').toString().trim();

      if (!name || !email || !message) {
        say('Lütfen ad, e-posta ve mesaj alanlarını doldurun.', false);
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
        say('Lütfen geçerli bir e-posta adresi girin.', false);
        return;
      }

      var btn = form.querySelector('[type="submit"]');
      if (btn) btn.disabled = true;
      say('Gönderiliyor…', true);

      fetch('form-handler.php', { method: 'POST', body: data })
        .then(function (r) {
          if (!r.ok) throw new Error('endpoint');
          return r.json();
        })
        .then(function (res) {
          if (res && res.ok) {
            form.reset();
            say('Mesajınız alındı. En kısa sürede size dönüş yapacağız.', true);
          } else {
            throw new Error('rejected');
          }
        })
        .catch(function () {
          // Sunucu tarafı yoksa e-posta istemcisine devret
          var subject = 'Web sitesi teklif talebi — ' + name;
          var body =
            'Ad Soyad: ' + name + '\n' +
            'E-posta: ' + email + '\n' +
            'Telefon: ' + (data.get('phone') || '-') + '\n' +
            'Konu: ' + (data.get('subject') || '-') + '\n\n' +
            message;
          window.location.href = 'mailto:info@winnermarble.com' +
            '?subject=' + encodeURIComponent(subject) +
            '&body=' + encodeURIComponent(body);
          say('E-posta uygulamanız açılıyor. Açılmazsa info@winnermarble.com adresine yazabilirsiniz.', true);
        })
        .then(function () { if (btn) btn.disabled = false; });
    });
  }

  /* ------------------------------------------------------------------
     15. Koleksiyon filtreleme (kategori sayfalarında)
     ------------------------------------------------------------------ */
  function initFilter() {
    var bar = $('[data-filter-bar]');
    var grid = $('[data-filter-grid]');
    if (!bar || !grid) return;

    var cards = $$('[data-cat]', grid);

    bar.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-filter]');
      if (!btn) return;

      $$('[data-filter]', bar).forEach(function (b) {
        b.classList.toggle('is-active', b === btn);
        b.setAttribute('aria-pressed', b === btn ? 'true' : 'false');
      });

      var key = btn.getAttribute('data-filter');
      cards.forEach(function (card) {
        var show = key === 'all' || card.getAttribute('data-cat') === key;
        card.style.display = show ? '' : 'none';
      });
    });
  }

  /* ------------------------------------------------------------------
     Başlat
     ------------------------------------------------------------------ */
  /* Sayfa içeriğine bağlı kurulum. İçerik değişirse yeniden çağrılabilir. */
  function mount() {
    pageTasks.length = 0;
    pageResize.length = 0;

    initReveal();
    initParallax();
    initHScroll();
    initCounters();
    initAccordion();
    initMarquee();
    initGlassPointer();
    initForm();
    initFilter();

    measure();
  }

  /* Yalnızca bir kez kurulan, sayfadan bağımsız parçalar. */
  function bootOnce() {
    document.documentElement.classList.add('js');
    measure();

    initLoader();
    initNav();
    initProgress();
    initCursor();
    initToTop();
    initAnchors();

    window.addEventListener('resize', function () {
      measure();
      for (var i = 0; i < pageResize.length; i++) {
        try { pageResize[i](); } catch (e) { /* yoksay */ }
      }
    });
    window.addEventListener('load', measure);
    setInterval(measure, 1200); // görsel yüklenmeleri sayfa yüksekliğini değiştirir

    requestAnimationFrame(tick);
  }

  function boot() {
    bootOnce();
    mount();
  }

  // Tek dosyalık sürümdeki yönlendirici, sayfa değişiminde mount()'u çağırır.
  window.WinnerSite = { mount: mount };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
