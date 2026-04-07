document.addEventListener('DOMContentLoaded', function() {
  if (document.querySelector('.fg-brand-bar')) return;
  var bar = document.createElement('div');
  bar.className = 'fg-brand-bar';
  bar.innerHTML = '<div class="fg-logo">\uD83C\uDFAC</div>'
    + '<span class="fg-title">Film Glance</span>'
    + '<span class="fg-sep">|</span>'
    + '<span class="fg-forum-label">Discussion Forum</span>'
    + '<a href="https://filmglance.com" class="fg-back-link">\u2190 Back to Film Glance</a>';
  document.body.insertBefore(bar, document.body.firstChild);
});
