const PROXY = "https://corsproxy.io/?";
const urlInput = document.getElementById('urlInput');
const output = document.getElementById('output');
const copyShareBtn = document.getElementById('copyShareBtn');

let currentUrl = "";

function updatePageTitle(title) {
  document.title = title || "JFM AiO";
}

function isJfmLink(str) {
  if (!str) return false;
  const t = str.trim();
  return /^https?:\/\//i.test(t) && (
    t.includes('jfmplay.dk') ||
    /stiften\.dk|jv\.dk|fyens\.dk|ugeavisen\.dk|hsfo\.dk|faa\.dk|erhvervplus\.dk|dagbladet-holstebro-struer\.dk|viborg-folkeblad\.dk|amtsavisen\.dk|vafo\.dk|helsingordagblad\.dk|frdb\.dk/i.test(t)
  );
}

urlInput.addEventListener('input', () => {
  const val = urlInput.value.trim();
  if (val !== currentUrl) {
    setCopyButtonEnabled(false);
  }
});

urlInput.addEventListener('paste', () => {
  setTimeout(() => {
    const val = urlInput.value.trim();
    if (isJfmLink(val) && val !== currentUrl) {
      processUrl(val);
    }
  }, 50);
});

urlInput.addEventListener('keypress', e => {
  if (e.key === 'Enter') {
    const val = urlInput.value.trim();
    if (isJfmLink(val) && val !== currentUrl) {
      e.preventDefault();
      processUrl(val);
    }
  }
});

urlInput.addEventListener('focus', () => urlInput.select());
urlInput.addEventListener('click', () => urlInput.select());

document.getElementById('infoBtn').onclick = () => document.getElementById('infoModal').classList.add('show');
document.querySelector('.close-modal').onclick = () => document.getElementById('infoModal').classList.remove('show');
document.getElementById('infoModal').onclick = e => {
  if (e.target === document.getElementById('infoModal')) document.getElementById('infoModal').classList.remove('show');
};

copyShareBtn.addEventListener('click', async () => {
  if (!currentUrl) return;
  let urlToCopy = currentUrl;
  if (urlToCopy.includes('?teaser-referral=')) urlToCopy = urlToCopy.split('?')[0];
  const shareUrl = `https://umfzbxvz.github.io/jfm?url=${encodeURIComponent(urlToCopy)}`;
  try {
    await navigator.clipboard.writeText(shareUrl);
  } catch {
    const t = document.createElement('textarea');
    t.value = shareUrl;
    document.body.appendChild(t);
    t.select();
    document.execCommand('copy');
    document.body.removeChild(t);
  }
  copyShareBtn.classList.add('copied');
  setTimeout(() => copyShareBtn.classList.remove('copied'), 2000);
});

function setCopyButtonEnabled(enabled) {
  copyShareBtn.disabled = !enabled;
  if (!enabled) copyShareBtn.classList.remove('copied');
}

function disableInput() {
  urlInput.disabled = true;
}

function enableInput() {
  urlInput.disabled = false;
  urlInput.focus();
  urlInput.select();
}

function getUrlParameter() {
  const params = new URLSearchParams(location.search);
  return params.get('link') || params.get('url') || '';
}

async function processUrl(url) {
  const cleanUrl = url.trim();

  output.innerHTML = '<p style="text-align:center;color:#aaa;padding:2rem">Indlæser…</p>';
  disableInput();
  updatePageTitle("Indlæser...");

  let success = false;
  let title = null;

  try {
    if (cleanUrl.includes('jfmplay.dk')) {
      title = await loadVideo(cleanUrl, output);
      success = true;
    } else if (/stiften\.dk|jv\.dk|fyens\.dk|ugeavisen\.dk|hsfo\.dk|faa\.dk|erhvervplus\.dk|dagbladet-holstebro-struer\.dk|viborg-folkeblad\.dk|amtsavisen\.dk|vafo\.dk|helsingordagblad\.dk|frdb\.dk/i.test(cleanUrl)) {
      title = await loadFullArticle(cleanUrl, output);
      success = true;
    }
  } catch {}

  if (success && title) {
    updatePageTitle(title);
    currentUrl = cleanUrl;
    urlInput.value = cleanUrl;
    setCopyButtonEnabled(true);
  } else {
    if (cleanUrl !== currentUrl) {
      output.innerHTML = '<p style="color:#f66;text-align:center;padding:2rem">Kunne ikke hente indholdet – tjek linket</p>';
      updatePageTitle("JFM AiO");
      currentUrl = "";
    }
  }

  enableInput();
}

async function loadVideo(pageUrl, container) {
  let title = "JFM Play video";
  try {
    const r = await fetch(PROXY + encodeURIComponent(pageUrl));
    const html = await r.text();
    const doc = new DOMParser().parseFromString(html, "text/html");
    const raw = doc.querySelector("title")?.textContent.trim();
    if (raw) title = raw.split("|")[0].trim().replace(/[-–—]\s*JFM Play.*$/i, "").trim();
  } catch {}
  container.innerHTML = '<video controls autoplay></video>';
  const video = container.querySelector('video');
  shaka.polyfill.installAll();
  if (shaka.Player.isBrowserSupported()) {
    const player = new shaka.Player(video);
    const { primary, fallback } = await getVideoUrls(pageUrl);
    let current = primary;
    player.addEventListener('error', () => {
      if (current === primary && fallback) player.load(fallback);
    });
    await player.load(primary);
  }
  return title;
}

async function getVideoUrls(pageUrl) {
  const uuid = pageUrl.match(/[0-9a-f-]{36}/i)?.[0];
  if (!uuid) throw new Error();
  if (pageUrl.includes('video-on-demand')) return { primary: `https://cf1318f5d.lwcdn.com/hls/${uuid}/playlist.m3u8`, fallback: null };
  if (pageUrl.includes('live-sport')) {
    const config = await fetchConfig(uuid);
    const primary = config || `https://cf-live1318f5d.lwcdn.com/live/${uuid}/playlist.m3u8`;
    return { primary, fallback: `https://cf1318f5d.lwcdn.com/hls/${uuid}/playlist.m3u8` };
  }
  throw new Error();
}

async function fetchConfig(uuid) {
  const r = await fetch(PROXY + encodeURIComponent(`https://play.lwcdn.com/web/public/native/config/7e165983-ccb1-453f-bc68-0d8ee7199e66/${uuid}`));
  if (!r.ok) return null;
  const d = await r.json();
  const src = d.src?.[0];
  return src?.startsWith('//') ? 'https:' + src : src;
}

async function loadFullArticle(url, container) {
  const resp = await fetch(PROXY + encodeURIComponent(url));
  const html = await resp.text();
  const doc = new DOMParser().parseFromString(html, "text/html");
  const el = doc.querySelector('[data-load-async-url*="/jfm-load-article-content/"]');
  if (!el) throw new Error();
  const path = el.getAttribute('data-load-async-url');
  const base = new URL(url);
  const asyncUrl = `${base.protocol}//${base.hostname}${path}`;
  const asyncResp = await fetch(PROXY + encodeURIComponent(asyncUrl));
  if (!asyncResp.ok) throw new Error();
  const asyncHtml = await asyncResp.text();
  const asyncDoc = new DOMParser().parseFromString(asyncHtml, "text/html");
  const headline = asyncDoc.querySelector('h1.article__headline')?.textContent.trim();
  if (!headline) throw new Error();

  const label = asyncDoc.querySelector('span.label')?.textContent.trim() || '';
  const lead = asyncDoc.querySelector('div.article__lead')?.textContent.trim() || '';
  const byline = asyncDoc.querySelector('div.article__byline')?.textContent.trim() || '';
  const dateStr = asyncDoc.querySelector('time.article__date')?.getAttribute('datetime');
  const date = dateStr ? new Date(dateStr.replace('Z', '+00:00')).toLocaleDateString('da-DK', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : '';
  const paragraphs = Array.from(asyncDoc.querySelectorAll('div.article__text p'))
    .map(p => p.textContent.trim())
    .filter(t => t.length > 10);
  const images = Array.from(asyncDoc.querySelectorAll('figure.article__figure'))
    .map(fig => {
      const wrapper = fig.querySelector('div.image__wrapper');
      const caption = fig.querySelector('figcaption')?.textContent.trim() || '';
      const src = wrapper?.getAttribute('data-src');
      return src ? { src, caption } : null;
    })
    .filter(Boolean);

  let out = '';
  if (label) out += `<div class="article-label">${label}</div>`;
  out += `<h1 class="article-headline">${headline}</h1>`;
  if (lead) out += `<p class="article-lead">${lead}</p>`;
  if (byline || date) out += `<div class="article-meta">${byline}${byline && date ? ' – ' : ''}${date}</div>`;
  paragraphs.forEach(p => out += `<p class="article-text">${p}</p>`);
  images.forEach(img => {
    out += `<img src="${img.src}" class="article-image" alt="${img.caption}">`;
    if (img.caption) out += `<figcaption>${img.caption}</figcaption>`;
  });

  container.innerHTML = out;
  return headline;
}

setCopyButtonEnabled(false);

const urlFromParam = getUrlParameter();
if (urlFromParam && isJfmLink(urlFromParam)) {
  urlInput.value = urlFromParam;
  processUrl(urlFromParam);
} else {
  updatePageTitle("JFM AiO");
}
