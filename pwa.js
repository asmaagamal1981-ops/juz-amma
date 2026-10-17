/* =========================================================
   PWA — تسجيل Service Worker + زر «ثبّت التطبيق»
   يُحمَّل في كل صفحات الموقع
   ========================================================= */
(function () {
  'use strict';

  var DISMISS_KEY = 'juz_install_dismissed';

  /* ---------- تسجيل Service Worker ---------- */
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js')
        .then(function (reg) {
          reg.addEventListener('updatefound', function () {
            var sw = reg.installing;
            if (!sw) return;
            sw.addEventListener('statechange', function () {
              if (sw.state === 'installed' && navigator.serviceWorker.controller) {
                showUpdate(reg);
              }
            });
          });
        })
        .catch(function () { /* التسجيل غير مدعوم — الموقع يعمل بدونه */ });
    });

    /* تحديث تلقائي عند فتح أقدم نسخة مخزّنة */
    var reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (reloading) return;
      reloading = true;
      location.reload();
    });
  }

  function showUpdate(reg) {
    var bar = document.createElement('div');
    bar.className = 'pwa-update';
    bar.innerHTML = '<span>توجد نسخة جديدة من التطبيق</span>' +
      '<button type="button" class="pwa-btn">تحديث الآن</button>';
    bar.querySelector('.pwa-btn').onclick = function () {
      if (reg.waiting) reg.waiting.postMessage('skip-waiting');
      else location.reload();
    };
    document.body.appendChild(bar);
  }

  /* ---------- زر التثبيت ---------- */
  var deferredPrompt = null;

  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferredPrompt = e;
    if (!isDismissed()) showInstallBar();
  });

  window.addEventListener('appinstalled', function () {
    deferredPrompt = null;
    hideInstallBar();
    try { localStorage.setItem(DISMISS_KEY, '1'); } catch (err) {}
  });

  function isDismissed() {
    try { return localStorage.getItem(DISMISS_KEY) === '1'; } catch (e) { return false; }
  }

  function isStandalone() {
    return (window.matchMedia('(display-mode: standalone)').matches) ||
           (window.navigator.standalone === true);
  }

  function isIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  }

  function showInstallBar() {
    if (isStandalone() || document.querySelector('.pwa-install')) return;
    var ios = !deferredPrompt && isIOS();
    var bar = document.createElement('div');
    bar.className = 'pwa-install';
    bar.innerHTML =
      '<div class="pwa-ico">📲</div>' +
      '<div class="pwa-txt"><b>' + (ios ? 'أضف التطبيق للشاشة' : 'ثبّت التطبيق على جهازك') + '</b>' +
      '<small>' + (ios
        ? 'من متصفح سفاري: زر المشاركة ثم «إضافة إلى الشاشة الرئيسية»'
        : 'يعمل دون إنترنت • وصول أسرع • أيقونة على جهازك') + '</small></div>' +
      '<button type="button" class="pwa-btn pwa-main">' + (ios ? 'كيف؟' : 'تثبيت') + '</button>' +
      '<button type="button" class="pwa-x" title="إخفاء" aria-label="إخفاء">✕</button>';

    var main = bar.querySelector('.pwa-main');
    main.onclick = function () {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then(function (choice) {
          if (choice.outcome === 'accepted') hideInstallBar();
          deferredPrompt = null;
        });
      } else {
        alert('لتثبيت التطبيق على الآيفون:\n1) اضغط زر المشاركة (المربّع والسهم) في سفاري.\n2) اختر «إضافة إلى الشاشة الرئيسية».\n3) اضغط «إضافة».');
      }
    };
    bar.querySelector('.pwa-x').onclick = function () {
      hideInstallBar();
      try { localStorage.setItem(DISMISS_KEY, '1'); } catch (e) {}
    };
    document.body.appendChild(bar);
  }

  function hideInstallBar() {
    var el = document.querySelector('.pwa-install');
    if (el && el.parentNode) el.parentNode.removeChild(el);
  }

  /* زر يدوي دائمًا على الجوال لو مرّر المستخدمDismiss */
  function addManualButton() {
    if (isStandalone() || document.querySelector('.pwa-install-mini')) return;
    if (window.innerWidth > 900) return;
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'pwa-install-mini';
    b.title = 'تثبيت التطبيق';
    b.textContent = '📲';
    b.onclick = function () {
      try { localStorage.removeItem(DISMISS_KEY); } catch (e) {}
      if (deferredPrompt) { showInstallBar(); }
      else { alert('لتثبيت التطبيق:\n• أندرويد: القائمة ⋮ ثم «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية».\n• آيفون: المشاركة ثم «إضافة إلى الشاشة الرئيسية».'); }
    };
    document.body.appendChild(b);
  }

  window.addEventListener('load', function () {
    addManualButton();
  });
})();