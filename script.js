const PROXY = "https://corsproxy.io/?";
const urlInput = document.getElementById('urlInput');
const output = document.getElementById('output');
const copyShareBtn = document.getElementById('copyShareBtn');

let lastValidUrl = "";

urlInput.addEventListener('keypress', e => {
  if (e.key === 'Enter') {
    const url = urlInput.value.trim();
    if (url) processUrl(url);
  }
});

urlInput.addEventListener('focus', () => urlInput.select());
urlInput.addEventListener('click', () => urlInput.select());

document.getElementById('infoBtn').addEventListener('click', () => {
  document.getElementById('infoModal').classList.add('show');
});

document.querySelector('.close-modal').addEventListener('click', () => document.getElementById('infoModal').classList.remove('show'));

document.getElementById('infoModal').addEventListener('click', e => {
  if (e.target === document.getElementById('infoModal')) document.getElementById('infoModal').classList.remove('show');
});

copyShareBtn.addEventListener('click', async () => {
  if (!lastValidUrl) return;
  let urlToCopy = lastValidUrl;
  if (urlToCopy.includes('?teaser-referral=')) {
    urlToCopy = urlToCopy.split('?teaser-referral=')[0];
    if (urlToCopy.endsWith('?')) urlToCopy = urlToCopy.slice(0, -1);
  }
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
}

function disableInput() {
  urlInput.disabled = true;
  setCopyButtonEnabled(false);
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

async function processUrl(inputUrl) {
  output.innerHTML = '<p style="text-align:center;color:#aaa;padding:2rem">Indlæser…</p>';
  disableInput();
  lastValidUrl = "";
  setCopyButtonEnabled(false);

  let success = false;

  try {
    if (inputUrl.includes('jfmplay.dk')) {
      await loadVideo(inputUrl, output);
      success = true;
    } else if (isJfmNewspaper(inputUrl)) {
      await loadFullArticle(inputUrl, output);
      success = true;
    } else {
      output.innerHTML = '<p style="color:#f66;text-align:center;padding:2rem">Ukendt link – kun JFM Play og JFM-aviser understøttes</p>';
    }
  } catch {
    output.innerHTML = '<p style="color:#f66;text-align:center;padding:2rem">Kunne ikke hente indholdet – prøv igen senere</p>';
  }

  if (success) {
    lastValidUrl = inputUrl;
    setCopyButtonEnabled(true);
  }

  enableInput();
}

function isJfmNewspaper(u) {
  return /stiften\.dk|jv\.dk|fyens\.dk|ugeavisen\.dk|hsfo\.dk|faa\.dk|erhvervplus\.dk|dagbladet-holstebro-struer\.dk|viborg-folkeblad\.dk|amtsavisen\.dk|vafo\.dk|helsingordagblad\.dk|frdb\.dk/i.test(u);
}

async function loadVideo(pageUrl, container) {
  container.innerHTML = '<video controls autoplay></video>';
  const video = container.querySelector('video');
  shaka.polyfill.installAll();
  if (!shaka.Player.isBrowserSupported()) throw new Error();
  const player = new shaka.Player(video);
  const { primary, fallback } = await getVideoUrls(pageUrl);
  let current = primary;
  player.addEventListener('error', () => {
    if (current === primary && fallback) {
      current = fallback;
      player.load(fallback).catch(() => {});
    }
  });
  await player.load(primary);
}

async function getVideoUrls(pageUrl) {
  const uuid = pageUrl.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)?.[0];
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

async function loadFullArticle(originalUrl, container) {
  const pageResp = await fetch(PROXY + encodeURIComponent(originalUrl));
  const pageHtml = await pageResp.text();
  const pageDoc = new DOMParser().parseFromString(pageHtml, "text/html");
  const asyncEl = pageDoc.querySelector('article[data-load-async-url*="/jfm-load-article-content/"], div[data-load-async-url*="/jfm-load-article-content/"]');
  if (!asyncEl) throw new Error();
  const asyncPath = asyncEl.getAttribute('data-load-async-url');
  const base = new URL(originalUrl);
  const asyncUrl = `${base.protocol}//${base.hostname}${asyncPath}`;
  const asyncResp = await fetch(PROXY + encodeURIComponent(asyncUrl));
  if (!asyncResp.ok) throw new Error();
  const asyncHtml = await asyncResp.text();
  const doc = new DOMParser().parseFromString(asyncHtml, "text/html");
  const headline = doc.querySelector('h1.article__headline')?.textContent.trim();
  if (!headline) throw new Error();
  const label = doc.querySelector('span.label')?.textContent.trim() || '';
  const lead = doc.querySelector('div.article__lead')?.textContent.trim() || '';
  const byline = doc.querySelector('div.article__byline')?.textContent.trim() || '';
  const dateStr = doc.querySelector('time.article__date')?.getAttribute('datetime');
  const date = dateStr ? new Date(dateStr.replace('Z', '+00:00')).toLocaleDateString('da-DK', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : '';
  const paragraphs = Array.from(doc.querySelectorAll('div.article__text p')).map(p => p.textContent.trim()).filter(t => t.length > 10);
  const images = Array.from(doc.querySelectorAll('figure.article__figure')).map(fig => {
    const wrapper = fig.querySelector('div.image__wrapper');
    const caption = fig.querySelector('figcaption')?.textContent.trim() || '';
    const src = wrapper?.getAttribute('data-src');
    return src ? { src, caption } : null;
  }).filter(Boolean);
  let html = '';
  if (label) html += `<div class="article-label">${label}</div>`;
  html += `<h1 class="article-headline">${headline}</h1>`;
  if (lead) html += `<p class="article-lead">${lead}</p>`;
  if (byline || date) html += `<div class="article-meta">${byline}${byline && date ? ' – ' : ''}${date}</div>`;
  paragraphs.forEach(p => html += `<p class="article-text">${p}</p>`);
  images.forEach(img => {
    html += `<img src="${img.src}" class="article-image" alt="${img.caption}">`;
    if (img.caption) html += `<figcaption>${img.caption}</figcaption>`;
  });
  container.innerHTML = html;
}

setCopyButtonEnabled(false);

const urlFromParam = getUrlParameter();
if (urlFromParam) {
  urlInput.value = urlFromParam;
  processUrl(urlFromParam);
}
