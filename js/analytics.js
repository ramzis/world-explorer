const GA_MEASUREMENT_ID = 'G-LWE127EKVY';
const CONSENT_COOKIE = 'analytics_consent';
const CONSENT_MAX_AGE = 30 * 24 * 60 * 60; // 1 month, seconds

export function getConsent() {
  const m = document.cookie.match(new RegExp('(?:^|;\\s*)' + CONSENT_COOKIE + '=([^;]*)'));
  return m ? m[1] : null; // 'granted' | 'denied' | null
}

export function setConsent(granted) {
  document.cookie =
    `${CONSENT_COOKIE}=${granted ? 'granted' : 'denied'}` +
    `;max-age=${CONSENT_MAX_AGE};path=/;samesite=lax`;
}

function loadGoogleAnalytics() {
  if (GA_MEASUREMENT_ID === 'G-XXXXXXXXXX' || !/^G-[A-Z0-9]+$/.test(GA_MEASUREMENT_ID)) {
    console.info('Analytics: set GA_MEASUREMENT_ID in js/analytics.js to enable tracking.');
    return;
  }
  const s = document.createElement('script');
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
  document.head.appendChild(s);
  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { window.dataLayer.push(arguments); };
  window.gtag('js', new Date());
  window.gtag('config', GA_MEASUREMENT_ID, { anonymize_ip: true });
}

function track(name, params) {
  if (typeof window.gtag !== 'function') return;
  window.gtag('event', name, params);
}

// Purchase-click funnel. surface is where the lead was shown or the buy
// button lived: landing | gems_panel | guesser_modal.
export function trackLeadView(surface) {
  track('lead_view', { surface });
}

export function trackPurchaseClick(surface) {
  track('purchase_click', { surface, currency: 'EUR', value: 1 });
}

export function initAnalytics() {
  const stored = getConsent();
  if (stored === 'granted') {
    loadGoogleAnalytics();
    return;
  }
  if (stored === 'denied') return;

  const banner = document.createElement('div');
  banner.id = 'cookieBanner';
  banner.className =
    'glass fixed bottom-[70px] left-1/2 -translate-x-1/2 z-[70] ' +
    'flex flex-col gap-2.5 w-[min(92vw,420px)] p-3.5 rounded-3xl ' +
    'text-sm leading-relaxed';
  banner.innerHTML =
    '<div class="flex items-center justify-center gap-2.5 text-center">' +
    '<span class="text-[22px]">🍪</span>' +
    '<span>This app uses Google Analytics to see how it\'s used.</span>' +
    '</div>' +
    '<div class="flex items-center gap-2">' +
    '<button id="cookieOk" type="button" class="modal-btn primary grow">OK</button>' +
    '<button id="cookieNo" type="button" class="modal-btn grow">Not OK</button>' +
    '</div>';
  document.body.appendChild(banner);

  const close = (granted) => {
    setConsent(granted);
    banner.remove();
    if (granted) loadGoogleAnalytics();
  };
  document.getElementById('cookieOk').addEventListener('click', () => close(true));
  document.getElementById('cookieNo').addEventListener('click', () => close(false));
}
