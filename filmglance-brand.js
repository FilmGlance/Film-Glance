document.addEventListener('DOMContentLoaded', function() {

  /* ================================================================
     FILM GLANCE FORUM — BRANDING + AUTH UI v4
     - Full-width banner on every page (links to forum home)
     - Sign In button overlaid on banner (bigger, prominent)
     - Shows username when logged in
     - Auth modals for guest post/reply/topic attempts
     - 100-thread guest viewing limit
     - Registration success notification
     ================================================================ */

  var GUEST_THREAD_LIMIT = 100;
  var STORAGE_KEY = 'fg_threads_viewed';
  var REG_FLAG_KEY = 'fg_just_registered';
  var FORUM_BASE = '/discuss';

  /* ── Helpers ────────────────────────────────────────────────────── */

  function isLoggedIn() {
    if (window.app && window.app.user && window.app.user.uid > 0) return true;
    if (window.config && window.config.loggedIn) return true;
    if (document.querySelector('[component="header/avatar"], [component="sidebar/me"]')) return true;
    if (document.body.classList.contains('loggedIn')) return true;
    return false;
  }

  function getUsername() {
    if (window.app && window.app.user && window.app.user.username) return window.app.user.username;
    if (window.config && window.config.username) return window.config.username;
    var el = document.querySelector('[component="header/username"]');
    if (el) return el.textContent.trim();
    return '';
  }

  function getThreadCount() {
    try { return parseInt(localStorage.getItem(STORAGE_KEY) || '0', 10); }
    catch(e) { return 0; }
  }

  function incrementThreadCount() {
    try {
      var count = getThreadCount() + 1;
      localStorage.setItem(STORAGE_KEY, count.toString());
      return count;
    } catch(e) { return 0; }
  }

  function isTopicPage() {
    return /\/discuss\/topic\//.test(window.location.pathname);
  }


  /* ── 1. Banner + Auth Button ───────────────────────────────────── */

  function buildBanner() {
    if (document.querySelector('.fg-banner-wrap')) {
      updateAuthButton();
      return;
    }

    var wrap = document.createElement('div');
    wrap.className = 'fg-banner-wrap';
    wrap.style.cssText = 'position:relative;z-index:1050;';

    /* Banner — clickable, links to forum home */
    var banner = document.createElement('a');
    banner.href = FORUM_BASE;
    banner.className = 'fg-banner';
    banner.style.cssText =
      'display:block;width:100%;height:150px;position:relative;'
      + 'background:linear-gradient(90deg,#050505,#0a0a0a,#050505);'
      + 'text-decoration:none;overflow:hidden;';

    banner.innerHTML =
      /* Top gold line */
      '<div style="position:absolute;top:0;left:0;right:0;height:1px;'
      + 'background:linear-gradient(90deg,transparent,rgba(255,215,0,0.12),transparent);"></div>'

      /* Bottom gold line */
      + '<div style="position:absolute;bottom:0;left:0;right:0;height:2px;'
      + 'background:linear-gradient(90deg,transparent,rgba(255,215,0,0.25),transparent);"></div>'

      /* Subtle decorative dots */
      + '<div style="position:absolute;top:28px;left:14%;width:5px;height:5px;border-radius:1px;'
      + 'background:rgba(255,215,0,0.03);"></div>'
      + '<div style="position:absolute;bottom:30px;right:16%;width:5px;height:5px;border-radius:1px;'
      + 'background:rgba(255,215,0,0.03);"></div>'
      + '<div style="position:absolute;top:35px;left:27%;width:3px;height:3px;border-radius:50%;'
      + 'background:rgba(255,215,0,0.04);"></div>'
      + '<div style="position:absolute;bottom:35px;right:27%;width:3px;height:3px;border-radius:50%;'
      + 'background:rgba(255,215,0,0.04);"></div>'

      /* Main text — Film Glance */
      + '<div style="position:absolute;inset:0;display:flex;flex-direction:column;'
      + 'align-items:center;justify-content:center;gap:6px;">'

      + '<div style="font-family:Playfair Display,Georgia,serif;font-size:60px;font-weight:700;'
      + 'letter-spacing:-1.5px;line-height:1;">'
      + '<span class="fg-text-white">Film </span>'
      + '<span class="fg-text-gold">Glance</span>'
      + '</div>'

      + '<div style="font-family:Syne,system-ui,sans-serif;font-size:22px;font-weight:600;'
      + 'letter-spacing:8px;line-height:1;" class="fg-text-white">'
      + 'DISCUSSION FORUM</div>'

      /* Thin divider */
      + '<div style="width:320px;height:1px;margin-top:8px;'
      + 'background:linear-gradient(90deg,transparent,rgba(255,215,0,0.1),transparent);"></div>'

      + '</div>';

    /* Auth button — overlaid top-right of banner */
    var authWrap = document.createElement('div');
    authWrap.className = 'fg-banner-auth';
    authWrap.style.cssText =
      'position:absolute;top:16px;right:24px;z-index:10;display:flex;align-items:center;gap:12px;';

    wrap.appendChild(banner);
    wrap.appendChild(authWrap);
    document.body.insertBefore(wrap, document.body.firstChild);

    updateAuthButton();
    hideNodeBBBranding();
  }

  function updateAuthButton() {
    var container = document.querySelector('.fg-banner-auth');
    if (!container) return;

    if (isLoggedIn()) {
      var username = getUsername();
      container.innerHTML =
        '<a href="' + FORUM_BASE + '/user/' + username + '" class="fg-btn-user">'
        + '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" '
        + 'stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
        + '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>'
        + '<circle cx="12" cy="7" r="4"/></svg>'
        + (username || 'Account')
        + '</a>';
    } else {
      container.innerHTML =
        '<a href="' + FORUM_BASE + '/login" class="fg-btn-signin">Sign In</a>';
    }
  }

  function hideNodeBBBranding() {
    var selectors = [
      '#header-menu', 'nav.navbar', '.navbar',
      '[component="brand/wrapper"]', '.navbar-brand', 'a.navbar-brand'
    ];
    selectors.forEach(function(sel) {
      document.querySelectorAll(sel).forEach(function(el) {
        el.style.display = 'none';
      });
    });
  }


  /* ── 2. Drop-Down Notification ─────────────────────────────────── */

  function showFGNotification(message, duration) {
    duration = duration || 6000;
    if (document.querySelector('.fg-notification')) return;

    var notif = document.createElement('div');
    notif.className = 'fg-notification';

    notif.innerHTML =
      '<div class="fg-notif-inner">'
      + '<div class="fg-notif-icon">'
      + '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FFD700" '
      + 'stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">'
      + '<polyline points="20 6 9 17 4 12"/></svg>'
      + '</div>'
      + '<div style="flex:1;">'
      + '<p class="fg-notif-text">' + message + '</p>'
      + '</div>'
      + '<span class="fg-notif-close">\u00D7</span>'
      + '</div>';

    document.body.appendChild(notif);

    var closeBtn = notif.querySelector('.fg-notif-close');
    closeBtn.onmouseover = function() { closeBtn.style.color = '#FFD700'; };
    closeBtn.onmouseout = function() { closeBtn.style.color = '#444'; };
    closeBtn.onclick = function() { dismiss(); };

    requestAnimationFrame(function() {
      requestAnimationFrame(function() {
        notif.style.transform = 'translateY(0)';
      });
    });

    var timer = setTimeout(dismiss, duration);
    function dismiss() {
      clearTimeout(timer);
      notif.style.transform = 'translateY(-100%)';
      setTimeout(function() { if (notif.parentNode) notif.parentNode.removeChild(notif); }, 400);
    }
  }


  /* ── 3. Auth Modal ─────────────────────────────────────────────── */

  function showAuthModal(reason) {
    if (document.querySelector('.fg-auth-overlay')) return;

    var messages = {
      'thread_limit': {
        heading: 'Guest Limit Reached',
        sub: 'Create a free account to continue browsing',
        body: 'Guests can browse up to 100 threads. Sign up for unlimited access to all discussions, archived IMDb posts, and community features.'
      },
      'post': {
        heading: 'Join the Conversation',
        sub: 'Sign in or sign up to reply',
        body: 'Create a free account to reply to threads, start new topics, and be part of the Film Glance community.'
      },
      'topic': {
        heading: 'Join the Conversation',
        sub: 'Sign in or sign up to post',
        body: 'Create a free account to start new discussion topics and engage with the Film Glance community.'
      }
    };

    var msg = messages[reason] || messages['post'];

    var overlay = document.createElement('div');
    overlay.className = 'fg-auth-overlay';

    overlay.innerHTML =
      '<div class="fg-auth-modal">'
      + (reason !== 'thread_limit'
        ? '<span class="fg-modal-close">\u00D7</span>' : '')
      + '<div style="text-align:center;margin-bottom:26px;">'
      + '<div class="fg-modal-icon">'
      + '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFD700" '
      + 'stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
      + '<rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/>'
      + '<line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/>'
      + '<line x1="2" y1="12" x2="22" y2="12"/>'
      + '<line x1="2" y1="7" x2="7" y2="7"/><line x1="2" y1="17" x2="7" y2="17"/>'
      + '<line x1="17" y1="7" x2="22" y2="7"/><line x1="17" y1="17" x2="22" y2="17"/>'
      + '</svg></div>'
      + '<h2 class="fg-modal-heading">' + msg.heading + '</h2>'
      + '<p style="color:#444;font-size:12px;margin-top:6px;">' + msg.sub + '</p>'
      + '</div>'
      + '<div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;">'
      + '<div style="flex:1;height:1px;background:#1a1a1a;"></div></div>'
      + '<p style="color:#666;font-size:12.5px;line-height:1.6;text-align:center;margin:0 0 20px;">'
      + msg.body + '</p>'
      + '<a href="' + FORUM_BASE + '/register" class="fg-modal-btn-primary">Create Free Account</a>'
      + '<p style="text-align:center;font-size:11.5px;color:#444;margin:14px 0 0;">'
      + 'Already have an account? '
      + '<a href="' + FORUM_BASE + '/login" style="color:#FFD700;font-weight:600;text-decoration:none;">'
      + 'Sign In</a></p>'
      + '</div>';

    document.body.appendChild(overlay);

    requestAnimationFrame(function() {
      requestAnimationFrame(function() {
        overlay.classList.add('fg-visible');
      });
    });

    var closeBtn = overlay.querySelector('.fg-modal-close');
    if (closeBtn) {
      closeBtn.onmouseover = function() { closeBtn.style.color = '#FFD700'; };
      closeBtn.onmouseout = function() { closeBtn.style.color = '#444'; };
      closeBtn.onclick = function() { dismissModal(); };
    }
    if (reason !== 'thread_limit') {
      overlay.addEventListener('click', function(e) {
        if (e.target === overlay) dismissModal();
      });
    }

    function dismissModal() {
      overlay.classList.remove('fg-visible');
      setTimeout(function() { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); }, 300);
    }
  }


  /* ── 4. Guest Thread Limit ─────────────────────────────────────── */

  function checkThreadLimit() {
    if (isLoggedIn()) return;
    if (!isTopicPage()) return;
    var count = incrementThreadCount();
    if (count >= GUEST_THREAD_LIMIT) {
      showAuthModal('thread_limit');
    }
  }


  /* ── 5. Intercept Guest Actions ────────────────────────────────── */

  function interceptGuestActions() {
    if (isLoggedIn()) return;

    document.body.addEventListener('click', function(e) {
      if (isLoggedIn()) return;
      var el = e.target.closest ? e.target.closest('[component], [data-action], a, button') : e.target;
      if (!el) return;

      var component = el.getAttribute('component') || '';
      var action = el.getAttribute('data-action') || '';
      var href = (el.getAttribute('href') || '').toLowerCase();
      var text = (el.textContent || '').trim().toLowerCase();

      if (component === 'category/post' || action === 'topics.new_topic'
          || href.indexOf('/compose') > -1 || (el.tagName === 'A' && text === 'new topic')) {
        e.preventDefault(); e.stopPropagation();
        showAuthModal('topic'); return;
      }
      if (component === 'post/reply' || component === 'topic/reply'
          || action === 'posts.reply' || (el.tagName === 'BUTTON' && text === 'reply')) {
        e.preventDefault(); e.stopPropagation();
        showAuthModal('post'); return;
      }
      if (component === 'post/quote' || action === 'posts.quote') {
        e.preventDefault(); e.stopPropagation();
        showAuthModal('post'); return;
      }
    }, true);
  }


  /* ── 6. Registration Success Detection ─────────────────────────── */

  function detectRegistrationSuccess() {
    try {
      if (sessionStorage.getItem(REG_FLAG_KEY) === '1') {
        sessionStorage.removeItem(REG_FLAG_KEY);
        setTimeout(function() {
          showFGNotification('Registration Successful! Check Your Inbox To Verify Your Account', 7000);
        }, 500);
      }
    } catch(e) {}

    var observer = new MutationObserver(function(mutations) {
      mutations.forEach(function(m) {
        m.addedNodes.forEach(function(node) {
          if (node.nodeType !== 1) return;
          var t = (node.textContent || '').toLowerCase();
          if ((t.indexOf('confirm') > -1 && t.indexOf('email') > -1)
              || (t.indexOf('account') > -1 && t.indexOf('created') > -1)
              || (t.indexOf('verification') > -1 && t.indexOf('sent') > -1)) {
            if (node.classList && (node.classList.contains('alert')
                || node.classList.contains('alert-success')
                || (node.querySelector && node.querySelector('.alert-success')))) {
              showFGNotification('Registration Successful! Check Your Inbox To Verify Your Account', 7000);
            }
          }
        });
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });
    hookRegistrationForm();
  }

  function hookRegistrationForm() {
    var form = document.querySelector('[component="register/local"] form, form[action*="register"], #register form, .register form');
    if (!form || form.dataset.fgHooked) return;
    form.dataset.fgHooked = 'true';
    form.addEventListener('submit', function() {
      try { sessionStorage.setItem(REG_FLAG_KEY, '1'); } catch(e) {}
    });
  }


  /* ── Initialize ─────────────────────────────────────────────────── */

  function init() {
    buildBanner();
    checkThreadLimit();
    interceptGuestActions();
    detectRegistrationSuccess();
  }

  if (window.$ && window.$(window)) {
    window.$(window).on('action:app.load', function() { init(); });
    window.$(window).on('action:ajaxify.end', function() {
      updateAuthButton();
      hideNodeBBBranding();
      checkThreadLimit();
      hookRegistrationForm();
    });
  }

  setTimeout(init, 800);

});
