document.addEventListener('DOMContentLoaded', function() {

  /* ================================================================
     FILM GLANCE FORUM — BRANDING + AUTH UI v3
     Exact match of filmglance.com header styling
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


  /* ── 1. Branding Bar (exact filmglance.com match) ──────────────── */

  function buildBrandBar() {
    if (document.querySelector('.fg-brand-bar')) {
      updateAuthSection();
      return;
    }

    var bar = document.createElement('div');
    bar.className = 'fg-brand-bar';
    /* Exact header style from film-glance.jsx line 937 */
    bar.style.cssText =
      'display:flex;justify-content:space-between;align-items:center;'
      + 'padding:16px 24px;'
      + 'border-bottom:1px solid rgba(255,255,255,0.03);'
      + 'position:sticky;top:0;z-index:1050;'
      + 'background:rgba(5,5,5,0.7);'
      + 'backdrop-filter:blur(24px) saturate(1.3);'
      + '-webkit-backdrop-filter:blur(24px) saturate(1.3);';

    /* Left: Logo — exact match of film-glance.jsx lines 938-944 */
    var left = document.createElement('a');
    left.href = FORUM_BASE;
    left.style.cssText = 'display:flex;align-items:center;gap:9px;text-decoration:none;cursor:pointer;';
    left.innerHTML =
      /* Icon box: 28x28, borderRadius 7, gradient */
      '<div style="width:28px;height:28px;border-radius:7px;'
      + 'background:linear-gradient(135deg,rgba(255,215,0,0.12),rgba(255,165,0,0.05));'
      + 'display:flex;align-items:center;justify-content:center;'
      + 'border:1px solid rgba(255,215,0,0.08);">'
      /* SVG film icon matching lucide Film */
      + '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FFD700" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
      + '<rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/>'
      + '<line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/>'
      + '<line x1="2" y1="12" x2="22" y2="12"/>'
      + '<line x1="2" y1="7" x2="7" y2="7"/><line x1="2" y1="17" x2="7" y2="17"/>'
      + '<line x1="17" y1="7" x2="22" y2="7"/><line x1="17" y1="17" x2="22" y2="17"/>'
      + '</svg>'
      + '</div>'
      /* Title: Playfair Display, 18px, 700 — exact match */
      + '<span style="font-family:\'Playfair Display\',serif;font-size:18px;font-weight:700;letter-spacing:-0.5px;color:#fff;">'
      + 'Film <span style="color:#FFD700;">Glance</span>'
      + '</span>';

    /* Right: auth section */
    var right = document.createElement('div');
    right.className = 'fg-auth-section';
    right.style.cssText = 'display:flex;align-items:center;gap:12px;';

    bar.appendChild(left);
    bar.appendChild(right);
    document.body.insertBefore(bar, document.body.firstChild);

    updateAuthSection();
    hideNodeBBBranding();
  }

  function updateAuthSection() {
    var container = document.querySelector('.fg-auth-section');
    if (!container) return;

    if (isLoggedIn()) {
      var username = getUsername();
      /* When logged in: show username button (matches "My Account" style from film-glance.jsx line 957) */
      container.innerHTML =
        '<a href="' + FORUM_BASE + '/user/' + username + '" style="'
        + 'padding:6px 14px;border-radius:9px;'
        + 'border:1px solid rgba(255,215,0,0.18);'
        + 'background:rgba(255,215,0,0.03);'
        + 'color:#FFD700;font-size:11.5px;font-weight:600;'
        + 'cursor:pointer;display:flex;align-items:center;gap:6px;'
        + 'text-decoration:none;transition:all 0.3s;'
        + 'font-family:system-ui,-apple-system,sans-serif;"'
        + ' onmouseover="this.style.borderColor=\'rgba(255,215,0,0.6)\';this.style.background=\'rgba(255,215,0,0.08)\';this.style.boxShadow=\'0 0 20px rgba(255,215,0,0.25),0 0 40px rgba(255,215,0,0.1)\'"'
        + ' onmouseout="this.style.borderColor=\'rgba(255,215,0,0.18)\';this.style.background=\'rgba(255,215,0,0.03)\';this.style.boxShadow=\'none\'">'
        /* User icon SVG */
        + '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
        + '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>'
        + '<circle cx="12" cy="7" r="4"/></svg>'
        + (username || 'Account')
        + '</a>';
    } else {
      /* When logged out: single "Sign In" button — exact match of film-glance.jsx line 974 */
      container.innerHTML =
        '<a href="' + FORUM_BASE + '/login" style="'
        + 'padding:6px 16px;border-radius:9px;'
        + 'border:1px solid rgba(255,215,0,0.18);'
        + 'background:rgba(255,215,0,0.03);'
        + 'color:#FFD700;font-size:11.5px;font-weight:600;'
        + 'cursor:pointer;text-decoration:none;transition:all 0.3s;'
        + 'font-family:system-ui,-apple-system,sans-serif;"'
        + ' onmouseover="this.style.borderColor=\'rgba(255,215,0,0.6)\';this.style.background=\'rgba(255,215,0,0.08)\';this.style.boxShadow=\'0 0 20px rgba(255,215,0,0.25),0 0 40px rgba(255,215,0,0.1)\'"'
        + ' onmouseout="this.style.borderColor=\'rgba(255,215,0,0.18)\';this.style.background=\'rgba(255,215,0,0.03)\';this.style.boxShadow=\'none\'">'
        + 'Sign In</a>';
    }
  }

  function hideNodeBBBranding() {
    /* Aggressively hide ALL NodeBB brand elements that create redundancy */
    var selectors = [
      '.navbar-brand',
      '[component="brand/wrapper"]',
      'a.navbar-brand',
      '.brand-wrapper',
      '#header-menu .brand',
      '.title-wrapper'
    ];
    selectors.forEach(function(sel) {
      document.querySelectorAll(sel).forEach(function(el) {
        el.style.display = 'none';
      });
    });

    /* Also hide the NodeBB nav header if our brand bar is present */
    var nodebbNav = document.querySelector('#header-menu, nav.navbar');
    if (nodebbNav && document.querySelector('.fg-brand-bar')) {
      nodebbNav.style.display = 'none';
    }
  }


  /* ── 2. Drop-Down Notification ─────────────────────────────────── */

  function showFGNotification(message, duration) {
    duration = duration || 6000;
    if (document.querySelector('.fg-notification')) return;

    var notif = document.createElement('div');
    notif.className = 'fg-notification';
    notif.style.cssText =
      'position:fixed;top:0;left:0;right:0;z-index:99999;'
      + 'transform:translateY(-100%);transition:transform 0.4s cubic-bezier(0.16,1,0.3,1);';

    /* Matches Film Glance daily limit notification style (line 1023-1051) */
    notif.innerHTML =
      '<div style="max-width:520px;margin:12px auto 0;padding:14px 18px;'
      + 'background:#070707;border-radius:14px;'
      + 'border:1px solid rgba(255,215,0,0.07);'
      + 'display:flex;align-items:center;gap:12px;'
      + 'box-shadow:0 4px 24px rgba(0,0,0,0.6);'
      + 'font-family:system-ui,-apple-system,sans-serif;">'
      /* Gold icon box matching Film Glance style (line 1031-1036) */
      + '<div style="width:36px;height:36px;border-radius:10px;flex-shrink:0;'
      + 'background:linear-gradient(135deg,rgba(255,215,0,0.12),rgba(255,165,0,0.06));'
      + 'border:1px solid rgba(255,215,0,0.15);'
      + 'display:flex;align-items:center;justify-content:center;">'
      + '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FFD700" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">'
      + '<polyline points="20 6 9 17 4 12"/></svg>'
      + '</div>'
      + '<div style="flex:1;">'
      + '<p style="font-size:13px;font-weight:700;color:#fff;margin:0 0 2px;'
      + 'font-family:\'Syne\',sans-serif;">' + message + '</p>'
      + '</div>'
      + '<span class="fg-notif-close" style="cursor:pointer;color:#444;font-size:18px;'
      + 'padding:2px;flex-shrink:0;transition:color 0.2s;">\u00D7</span>'
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


  /* ── 3. Auth Modal (matches film-glance.jsx auth modal exactly) ── */

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
    /* Exact match: film-glance.jsx line 1057 */
    overlay.style.cssText =
      'position:fixed;inset:0;z-index:99998;'
      + 'display:flex;align-items:center;justify-content:center;'
      + 'background:rgba(0,0,0,0.88);'
      + 'backdrop-filter:blur(22px);-webkit-backdrop-filter:blur(22px);'
      + 'opacity:0;transition:opacity 0.25s;';

    /* Exact match: film-glance.jsx line 1058 */
    overlay.innerHTML =
      '<div class="fg-auth-modal" style="'
      + 'width:100%;max-width:390px;'
      + 'background:#070707;border-radius:20px;'
      + 'border:1px solid rgba(255,215,0,0.07);'
      + 'padding:36px 30px;position:relative;'
      + 'transform:scale(0.95);transition:transform 0.4s cubic-bezier(0.16,1,0.3,1);'
      + 'font-family:system-ui,-apple-system,sans-serif;">'

      /* Close X — exact match line 1059 (not shown for thread limit) */
      + (reason !== 'thread_limit'
        ? '<span class="fg-modal-close" style="position:absolute;top:14px;right:14px;'
          + 'color:#444;font-size:17px;cursor:pointer;transition:color 0.2s;">\u00D7</span>'
        : '')

      /* Icon + heading — exact match lines 1060-1063 */
      + '<div style="text-align:center;margin-bottom:26px;">'
      + '<div style="width:44px;height:44px;border-radius:12px;margin:0 auto 12px;'
      + 'background:linear-gradient(135deg,rgba(255,215,0,0.12),rgba(255,165,0,0.06));'
      + 'display:flex;align-items:center;justify-content:center;'
      + 'border:1px solid rgba(255,215,0,0.1);">'
      + '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFD700" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
      + '<rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/>'
      + '<line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/>'
      + '<line x1="2" y1="12" x2="22" y2="12"/>'
      + '<line x1="2" y1="7" x2="7" y2="7"/><line x1="2" y1="17" x2="7" y2="17"/>'
      + '<line x1="17" y1="7" x2="22" y2="7"/><line x1="17" y1="17" x2="22" y2="17"/>'
      + '</svg></div>'
      + '<h2 style="font-family:\'Playfair Display\',serif;font-size:22px;color:#fff;margin:0;">'
      + msg.heading + '</h2>'
      + '<p style="color:#444;font-size:12px;margin-top:6px;">' + msg.sub + '</p>'
      + '</div>'

      /* Divider — matches line 1067-1070 */
      + '<div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;">'
      + '<div style="flex:1;height:1px;background:#1a1a1a;"></div>'
      + '</div>'

      /* Body text */
      + '<p style="color:#666;font-size:12.5px;line-height:1.6;text-align:center;margin:0 0 20px;">'
      + msg.body + '</p>'

      /* Primary CTA — matches line 1089-1091 gold gradient button */
      + '<a href="' + FORUM_BASE + '/register" style="'
      + 'display:block;width:100%;padding:12px;text-align:center;'
      + 'border-radius:11px;border:none;'
      + 'background:linear-gradient(135deg,#FFD700,#E8A000);'
      + 'color:#050505;font-size:13.5px;font-weight:700;'
      + 'text-decoration:none;margin-bottom:14px;'
      + 'box-sizing:border-box;">Create Free Account</a>'

      /* Toggle to sign in — matches line 1093-1098 */
      + '<p style="text-align:center;font-size:11.5px;color:#444;margin:0;">'
      + 'Already have an account? '
      + '<a href="' + FORUM_BASE + '/login" style="color:#FFD700;font-weight:600;text-decoration:none;">'
      + 'Sign In</a></p>'

      + '</div>';

    document.body.appendChild(overlay);

    requestAnimationFrame(function() {
      requestAnimationFrame(function() {
        overlay.style.opacity = '1';
        var modal = overlay.querySelector('.fg-auth-modal');
        if (modal) modal.style.transform = 'scale(1)';
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
      overlay.style.opacity = '0';
      var modal = overlay.querySelector('.fg-auth-modal');
      if (modal) modal.style.transform = 'scale(0.95)';
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
        showAuthModal('topic');
        return;
      }

      if (component === 'post/reply' || component === 'topic/reply'
          || action === 'posts.reply' || (el.tagName === 'BUTTON' && text === 'reply')) {
        e.preventDefault(); e.stopPropagation();
        showAuthModal('post');
        return;
      }

      if (component === 'post/quote' || action === 'posts.quote') {
        e.preventDefault(); e.stopPropagation();
        showAuthModal('post');
        return;
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
    buildBrandBar();
    checkThreadLimit();
    interceptGuestActions();
    detectRegistrationSuccess();
  }

  if (window.$ && window.$(window)) {
    window.$(window).on('action:app.load', function() { init(); });
    window.$(window).on('action:ajaxify.end', function() {
      updateAuthSection();
      hideNodeBBBranding();
      checkThreadLimit();
      hookRegistrationForm();
    });
  }

  setTimeout(init, 800);

});
