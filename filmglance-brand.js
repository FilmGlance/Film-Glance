document.addEventListener('DOMContentLoaded', function() {

  /* ================================================================
     FILM GLANCE FORUM — BRANDING + AUTH UI v2
     Features:
       1. Branded header bar matching Film Glance site aesthetic
       2. Sign In / Register buttons (gold-styled)
       3. Registration success drop-down notification
       4. 100-thread guest viewing limit with registration modal
       5. Login/register modal on guest post/reply/topic attempt
       6. Hides redundant NodeBB site title
     ================================================================ */

  var GUEST_THREAD_LIMIT = 100;
  var STORAGE_KEY = 'fg_threads_viewed';
  var REG_FLAG_KEY = 'fg_just_registered';
  var FORUM_BASE = '/discuss';

  /* ── Helpers ────────────────────────────────────────────────────── */

  function isLoggedIn() {
    /* NodeBB exposes app.user.uid after boot — 0 means guest */
    if (window.app && window.app.user && window.app.user.uid > 0) return true;
    /* Fallback: config object */
    if (window.config && window.config.loggedIn) return true;
    /* Fallback: check for logged-in-only DOM elements */
    if (document.querySelector('[component="header/avatar"], [component="sidebar/me"]')) return true;
    /* Fallback: check body class */
    if (document.body.classList.contains('loggedIn')) return true;
    return false;
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


  /* ── 1. Branding Bar ───────────────────────────────────────────── */

  function buildBrandBar() {
    if (document.querySelector('.fg-brand-bar')) {
      updateAuthButtons();
      return;
    }

    var bar = document.createElement('div');
    bar.className = 'fg-brand-bar';

    /* Left side: Film Glance logo */
    var left = document.createElement('div');
    left.className = 'fg-brand-left';

    left.innerHTML =
      '<a href="https://filmglance.com" style="text-decoration:none;display:flex;align-items:center;gap:12px;">'
      + '<div class="fg-logo">\uD83C\uDFAC</div>'
      + '<div style="display:flex;flex-direction:column;line-height:1.2;">'
      + '<span style="font-family:Syne,Georgia,serif;font-size:18px;font-weight:800;letter-spacing:-0.5px;">'
      + '<span style="color:#ffffff;">Film</span> <span style="color:#FFD700;">Glance</span></span>'
      + '<span style="font-family:Syne,sans-serif;font-size:10px;color:rgba(255,215,0,0.6);'
      + 'letter-spacing:2.5px;text-transform:uppercase;font-weight:600;">Discussion Forum</span>'
      + '</div>'
      + '</a>';

    /* Right side: auth buttons */
    var right = document.createElement('div');
    right.className = 'fg-auth-buttons';

    bar.appendChild(left);
    bar.appendChild(right);
    document.body.insertBefore(bar, document.body.firstChild);

    updateAuthButtons();
    hideNodeBBHeader();
  }

  function updateAuthButtons() {
    var container = document.querySelector('.fg-auth-buttons');
    if (!container) return;

    if (isLoggedIn()) {
      container.innerHTML =
        '<a href="https://filmglance.com" class="fg-back-link">'
        + '\u2190 Back to Film Glance</a>';
    } else {
      container.innerHTML =
        '<a href="' + FORUM_BASE + '/login" class="fg-btn-signin">Sign In</a>'
        + '<a href="' + FORUM_BASE + '/register" class="fg-btn-register">Register</a>';
    }
  }

  function hideNodeBBHeader() {
    /* Hide the redundant NodeBB brand/title in the navbar */
    var selectors = [
      '.navbar-brand',
      '[component="brand/wrapper"]',
      'a.navbar-brand'
    ];
    selectors.forEach(function(sel) {
      var el = document.querySelector(sel);
      if (el) el.style.display = 'none';
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
      + '<span class="fg-notif-icon">\u2713</span>'
      + '<span class="fg-notif-text">' + message + '</span>'
      + '<span class="fg-notif-close">\u00D7</span>'
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
        title: "You\u2019ve reached your guest viewing limit",
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

    overlay.innerHTML =
      '<div class="fg-auth-modal">'

      /* Close button — not shown for thread limit */
      + (reason !== 'thread_limit'
        ? '<span class="fg-modal-close">\u00D7</span>'
        : '')

      /* Logo */
      + '<div class="fg-modal-logo">'
      + '<span style="font-family:Syne,Georgia,serif;font-size:22px;font-weight:800;letter-spacing:-0.3px;">'
      + '<span style="color:#ffffff;">Film</span> <span style="color:#FFD700;">Glance</span></span>'
      + '</div>'

      /* Divider */
      + '<div class="fg-modal-divider"></div>'

      /* Title */
      + '<h2 class="fg-modal-title">' + msg.title + '</h2>'

      /* Body */
      + '<p class="fg-modal-body">' + msg.body + '</p>'

      /* Buttons */
      + '<div class="fg-modal-buttons">'
      + '<a href="' + FORUM_BASE + '/register" class="fg-modal-btn-primary">Create Free Account</a>'
      + '<a href="' + FORUM_BASE + '/login" class="fg-modal-btn-secondary">'
      + 'Already have an account? Sign In</a>'
      + '</div>'
      + '</div>';

    document.body.appendChild(overlay);

    /* Animate in */
    requestAnimationFrame(function() {
      requestAnimationFrame(function() {
        overlay.classList.add('fg-visible');
      });
    });

    /* Close handlers */
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
      overlay.classList.remove('fg-visible');
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
      /* Re-check on every click in case login state changed */
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
          || href.indexOf('/compose') > -1
          || (el.tagName === 'A' && text === 'new topic')) {
        e.preventDefault();
        e.stopPropagation();
        showAuthModal('topic');
        return;
      }

      /* Detect reply button */
      if (component === 'post/reply'
          || component === 'topic/reply'
          || action === 'posts.reply'
          || (el.tagName === 'BUTTON' && text === 'reply')) {
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
          var text = (node.textContent || '').toLowerCase();
          if ((text.indexOf('confirm') > -1 && text.indexOf('email') > -1)
              || (text.indexOf('account') > -1 && text.indexOf('created') > -1)
              || (text.indexOf('verification') > -1 && text.indexOf('sent') > -1)) {
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

  /* Wait briefly for NodeBB to populate config/app objects */
  function init() {
    buildBrandBar();
    checkThreadLimit();
    interceptGuestActions();
    detectRegistrationSuccess();
  }

  /* NodeBB fires this when it's fully ready */
  if (window.$ && window.$(window)) {
    window.$(window).on('action:app.load', function() {
      init();
    });
    window.$(window).on('action:ajaxify.end', function() {
      buildBrandBar();
      checkThreadLimit();
      hookRegistrationForm();
    });
  }

  /* Fallback: run after short delay if NodeBB events don't fire */
  setTimeout(init, 800);

});
