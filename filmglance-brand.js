document.addEventListener('DOMContentLoaded', function() {

  /* ================================================================
     FILM GLANCE FORUM — BRANDING + AUTH UI
     Features:
       1. Branding bar with Sign In / Register buttons
       2. Registration success drop-down notification
       3. 100-thread guest viewing limit with registration modal
       4. Login/register modal on guest post/reply/topic attempt
     ================================================================ */

  var GUEST_THREAD_LIMIT = 100;
  var STORAGE_KEY = 'fg_threads_viewed';
  var REG_FLAG_KEY = 'fg_just_registered';
  var FORUM_BASE = '/discuss';

  /* ── Helpers ────────────────────────────────────────────────────── */

  function isLoggedIn() {
    /* NodeBB exposes config.loggedIn globally */
    if (window.config && typeof window.config.loggedIn !== 'undefined') {
      return !!window.config.loggedIn;
    }
    /* Fallback: check for user menu elements */
    var userIcon = document.querySelector('[component="header/avatar"]');
    return !!userIcon;
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
    var path = window.location.pathname;
    return /\/discuss\/topic\//.test(path);
  }


  /* ── 1. Branding Bar ───────────────────────────────────────────── */

  function buildBrandBar() {
    if (document.querySelector('.fg-brand-bar')) {
      updateAuthButtons();
      return;
    }

    var bar = document.createElement('div');
    bar.className = 'fg-brand-bar';
    bar.style.cssText = 'display:flex;align-items:center;justify-content:space-between;'
      + 'padding:10px 20px;background:#050505;border-bottom:1px solid rgba(255,215,0,0.12);'
      + 'font-family:Helvetica Neue,Helvetica,Arial,sans-serif;position:relative;z-index:1000;';

    /* Left side: logo + nav */
    var left = document.createElement('div');
    left.style.cssText = 'display:flex;align-items:center;gap:10px;';
    left.innerHTML =
      '<span style="font-family:Georgia,Times New Roman,serif;font-size:18px;font-weight:700;color:#fff;letter-spacing:-0.3px;">'
      + 'Film <span style="color:#FFD700;">Glance</span></span>'
      + '<span style="color:rgba(255,215,0,0.3);font-size:14px;">|</span>'
      + '<span style="color:#999;font-size:13px;">Discussion Forum</span>';

    /* Right side: auth buttons or user info */
    var right = document.createElement('div');
    right.className = 'fg-auth-buttons';
    right.style.cssText = 'display:flex;align-items:center;gap:10px;';

    bar.appendChild(left);
    bar.appendChild(right);
    document.body.insertBefore(bar, document.body.firstChild);

    updateAuthButtons();
  }

  function updateAuthButtons() {
    var container = document.querySelector('.fg-auth-buttons');
    if (!container) return;

    if (isLoggedIn()) {
      /* Show back link only when logged in */
      container.innerHTML =
        '<a href="https://filmglance.com" style="color:#888;font-size:12px;text-decoration:none;'
        + 'transition:color 0.2s;" onmouseover="this.style.color=\'#FFD700\'" '
        + 'onmouseout="this.style.color=\'#888\'">\u2190 Back to Film Glance</a>';
    } else {
      /* Show Sign In + Register buttons */
      container.innerHTML =
        '<a href="' + FORUM_BASE + '/login" class="fg-btn-signin" style="'
        + 'padding:7px 18px;font-size:12px;font-weight:600;color:#FFD700;'
        + 'background:transparent;border:1px solid rgba(255,215,0,0.3);'
        + 'border-radius:8px;text-decoration:none;transition:all 0.2s;'
        + 'letter-spacing:0.3px;" '
        + 'onmouseover="this.style.borderColor=\'rgba(255,215,0,0.6)\';this.style.boxShadow=\'0 0 12px rgba(255,215,0,0.15)\'" '
        + 'onmouseout="this.style.borderColor=\'rgba(255,215,0,0.3)\';this.style.boxShadow=\'none\'">'
        + 'Sign In</a>'
        + '<a href="' + FORUM_BASE + '/register" class="fg-btn-register" style="'
        + 'padding:7px 18px;font-size:12px;font-weight:700;color:#050505;'
        + 'background:linear-gradient(135deg,#FFD700,#E8A000);'
        + 'border:1px solid #FFD700;border-radius:8px;text-decoration:none;'
        + 'transition:all 0.2s;letter-spacing:0.3px;" '
        + 'onmouseover="this.style.boxShadow=\'0 0 16px rgba(255,215,0,0.3)\'" '
        + 'onmouseout="this.style.boxShadow=\'none\'">'
        + 'Register</a>'
        + '<a href="https://filmglance.com" style="color:#555;font-size:11px;text-decoration:none;'
        + 'margin-left:6px;transition:color 0.2s;" onmouseover="this.style.color=\'#FFD700\'" '
        + 'onmouseout="this.style.color=\'#555\'">\u2190 Film Glance</a>';
    }
  }


  /* ── 2. Drop-Down Notification ─────────────────────────────────── */

  function showFGNotification(message, duration) {
    duration = duration || 6000;
    if (document.querySelector('.fg-notification')) return;

    var notif = document.createElement('div');
    notif.className = 'fg-notification';
    notif.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99999;'
      + 'transform:translateY(-100%);transition:transform 0.4s cubic-bezier(0.16,1,0.3,1);';

    notif.innerHTML =
      '<div style="max-width:560px;margin:0 auto;padding:16px 24px;'
      + 'background:linear-gradient(135deg,#0a0a0a,#111);'
      + 'border:1px solid rgba(255,215,0,0.25);border-top:none;'
      + 'border-radius:0 0 12px 12px;display:flex;align-items:center;gap:12px;'
      + 'box-shadow:0 4px 24px rgba(0,0,0,0.6),0 0 20px rgba(255,215,0,0.08);'
      + 'font-family:Helvetica Neue,Helvetica,Arial,sans-serif;">'
      + '<span style="display:flex;align-items:center;justify-content:center;'
      + 'width:28px;height:28px;min-width:28px;border-radius:50%;'
      + 'background:linear-gradient(135deg,#FFD700,#E8A000);'
      + 'color:#050505;font-size:14px;font-weight:700;">\u2713</span>'
      + '<span style="flex:1;font-size:14px;font-weight:600;color:#fff;line-height:1.4;">'
      + message + '</span>'
      + '<span class="fg-notif-close" style="cursor:pointer;color:#666;font-size:20px;'
      + 'padding:0 4px;transition:color 0.2s;">\u00D7</span>'
      + '</div>';

    document.body.appendChild(notif);

    var closeBtn = notif.querySelector('.fg-notif-close');
    closeBtn.onmouseover = function() { closeBtn.style.color = '#FFD700'; };
    closeBtn.onmouseout = function() { closeBtn.style.color = '#666'; };
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
      setTimeout(function() {
        if (notif.parentNode) notif.parentNode.removeChild(notif);
      }, 400);
    }
  }


  /* ── 3. Auth Modal (Sign In / Register) ────────────────────────── */

  function showAuthModal(reason) {
    if (document.querySelector('.fg-auth-overlay')) return;

    var messages = {
      'thread_limit': {
        title: "You've reached your guest viewing limit",
        body: "Guests can browse up to 100 threads. Create a free account to get unlimited access to all discussions, archived IMDb posts, and community features."
      },
      'post': {
        title: "Join the conversation",
        body: "Sign in or create a free account to reply to threads, start new topics, and be part of the Film Glance community."
      },
      'topic': {
        title: "Join the conversation",
        body: "Sign in or create a free account to start new discussion topics and engage with the Film Glance community."
      }
    };

    var msg = messages[reason] || messages['post'];

    var overlay = document.createElement('div');
    overlay.className = 'fg-auth-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:99998;'
      + 'background:rgba(0,0,0,0.75);backdrop-filter:blur(4px);'
      + 'display:flex;align-items:center;justify-content:center;'
      + 'opacity:0;transition:opacity 0.3s;';

    overlay.innerHTML =
      '<div class="fg-auth-modal" style="'
      + 'width:90%;max-width:420px;background:#0a0a0a;'
      + 'border:1px solid rgba(255,215,0,0.12);border-radius:16px;'
      + 'padding:36px 32px;text-align:center;position:relative;'
      + 'box-shadow:0 8px 40px rgba(0,0,0,0.5),0 0 30px rgba(255,215,0,0.05);'
      + 'font-family:Helvetica Neue,Helvetica,Arial,sans-serif;'
      + 'transform:scale(0.95);transition:transform 0.3s cubic-bezier(0.16,1,0.3,1);">'

      /* Close button */
      + (reason !== 'thread_limit'
        ? '<span class="fg-modal-close" style="position:absolute;top:14px;right:18px;'
          + 'color:#555;font-size:22px;cursor:pointer;transition:color 0.2s;'
          + 'line-height:1;">\u00D7</span>'
        : '')

      /* Logo */
      + '<div style="margin-bottom:20px;">'
      + '<span style="font-family:Georgia,Times New Roman,serif;font-size:22px;font-weight:700;'
      + 'color:#fff;letter-spacing:-0.3px;">Film <span style="color:#FFD700;">Glance</span></span>'
      + '</div>'

      /* Divider */
      + '<div style="height:1px;background:linear-gradient(90deg,transparent,rgba(255,215,0,0.15),transparent);'
      + 'margin-bottom:20px;"></div>'

      /* Title */
      + '<h2 style="margin:0 0 10px;font-size:20px;font-weight:700;color:#fff;">'
      + msg.title + '</h2>'

      /* Body */
      + '<p style="margin:0 0 28px;font-size:13px;color:#999;line-height:1.6;">'
      + msg.body + '</p>'

      /* Buttons */
      + '<div style="display:flex;flex-direction:column;gap:10px;">'

      + '<a href="' + FORUM_BASE + '/register" style="display:block;padding:13px 24px;'
      + 'background:linear-gradient(135deg,#FFD700,#E8A000);color:#050505;'
      + 'font-size:14px;font-weight:700;text-decoration:none;border-radius:10px;'
      + 'letter-spacing:0.3px;transition:box-shadow 0.2s;" '
      + 'onmouseover="this.style.boxShadow=\'0 0 20px rgba(255,215,0,0.3)\'" '
      + 'onmouseout="this.style.boxShadow=\'none\'">Create Free Account</a>'

      + '<a href="' + FORUM_BASE + '/login" style="display:block;padding:13px 24px;'
      + 'background:transparent;color:#FFD700;'
      + 'font-size:13px;font-weight:600;text-decoration:none;border-radius:10px;'
      + 'border:1px solid rgba(255,215,0,0.25);transition:all 0.2s;" '
      + 'onmouseover="this.style.borderColor=\'rgba(255,215,0,0.5)\';this.style.boxShadow=\'0 0 12px rgba(255,215,0,0.12)\'" '
      + 'onmouseout="this.style.borderColor=\'rgba(255,215,0,0.25)\';this.style.boxShadow=\'none\'">'
      + 'Already have an account? Sign In</a>'

      + '</div>'
      + '</div>';

    document.body.appendChild(overlay);

    /* Animate in */
    requestAnimationFrame(function() {
      requestAnimationFrame(function() {
        overlay.style.opacity = '1';
        var modal = overlay.querySelector('.fg-auth-modal');
        if (modal) modal.style.transform = 'scale(1)';
      });
    });

    /* Close handlers (not for thread limit — that one is mandatory) */
    var closeBtn = overlay.querySelector('.fg-modal-close');
    if (closeBtn) {
      closeBtn.onmouseover = function() { closeBtn.style.color = '#FFD700'; };
      closeBtn.onmouseout = function() { closeBtn.style.color = '#555'; };
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
      setTimeout(function() {
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      }, 300);
    }
  }


  /* ── 4. Guest Thread Limit Tracker ─────────────────────────────── */

  function checkThreadLimit() {
    if (isLoggedIn()) return;
    if (!isTopicPage()) return;

    var count = incrementThreadCount();

    if (count >= GUEST_THREAD_LIMIT) {
      showAuthModal('thread_limit');
    }
  }


  /* ── 5. Intercept Guest Post/Reply/Topic Actions ───────────────── */

  function interceptGuestActions() {
    if (isLoggedIn()) return;

    document.body.addEventListener('click', function(e) {
      if (isLoggedIn()) return;

      var target = e.target;
      var el = target.closest ? target.closest('[component], [data-action], a, button') : target;
      if (!el) return;

      var component = el.getAttribute('component') || '';
      var action = el.getAttribute('data-action') || '';
      var href = (el.getAttribute('href') || '').toLowerCase();
      var text = (el.textContent || '').trim().toLowerCase();

      /* Detect new topic button */
      if (component === 'category/post'
          || action === 'topics.new_topic'
          || text === 'new topic'
          || href.indexOf('/compose') > -1) {
        e.preventDefault();
        e.stopPropagation();
        showAuthModal('topic');
        return;
      }

      /* Detect reply button */
      if (component === 'post/reply'
          || component === 'topic/reply'
          || action === 'posts.reply'
          || text === 'reply'
          || (el.tagName === 'BUTTON' && text.indexOf('reply') > -1)) {
        e.preventDefault();
        e.stopPropagation();
        showAuthModal('post');
        return;
      }

      /* Detect quote button */
      if (component === 'post/quote'
          || action === 'posts.quote') {
        e.preventDefault();
        e.stopPropagation();
        showAuthModal('post');
        return;
      }
    }, true); /* useCapture to intercept before NodeBB handlers */
  }


  /* ── 6. Registration Success Detection ─────────────────────────── */

  function detectRegistrationSuccess() {
    /* Method 1: Check sessionStorage flag from form submission */
    try {
      if (sessionStorage.getItem(REG_FLAG_KEY) === '1') {
        sessionStorage.removeItem(REG_FLAG_KEY);
        setTimeout(function() {
          showFGNotification('Registration Successful! Check Your Inbox To Verify Your Account', 7000);
        }, 500);
      }
    } catch(e) {}

    /* Method 2: MutationObserver for NodeBB's native alerts */
    var observer = new MutationObserver(function(mutations) {
      mutations.forEach(function(m) {
        m.addedNodes.forEach(function(node) {
          if (node.nodeType !== 1) return;
          var text = (node.textContent || '').toLowerCase();
          if ((text.indexOf('confirm') > -1 && text.indexOf('email') > -1)
              || (text.indexOf('account') > -1 && text.indexOf('created') > -1)
              || (text.indexOf('verification') > -1 && text.indexOf('sent') > -1)) {
            if (node.classList && (node.classList.contains('alert')
                || node.classList.contains('alert-success')
                || node.querySelector && node.querySelector('.alert-success'))) {
              showFGNotification('Registration Successful! Check Your Inbox To Verify Your Account', 7000);
            }
          }
        });
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });

    /* Method 3: Hook registration form submission to set flag */
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

  buildBrandBar();
  checkThreadLimit();
  interceptGuestActions();
  detectRegistrationSuccess();

  /* Re-initialize on NodeBB SPA page transitions */
  if (window.$ && window.$(window)) {
    window.$(window).on('action:ajaxify.end', function() {
      buildBrandBar();
      checkThreadLimit();
      hookRegistrationForm();
    });
  }

});
