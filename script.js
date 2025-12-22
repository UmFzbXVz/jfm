const PROXY = "https://corsproxy.io/?";
const urlInput = document.getElementById('urlInput');
const output = document.getElementById('output');
const copyShareBtn = document.getElementById('copyShareBtn');
let currentUrl = "";
function updatePageTitle(title) {
  document.title = title || "JFM AiO";
}
function updateSocialMetadata(title, description, image, originalUrl) {
  document.getElementById('og-title').setAttribute('content', title);
  document.getElementById('og-description').setAttribute('content', description);
  document.getElementById('twitter-title').setAttribute('content', title);
  document.getElementById('twitter-description').setAttribute('content', description);
  if (image) {
    document.getElementById('og-image').setAttribute('content', image);
    document.getElementById('twitter-image').setAttribute('content', image);
  } else {
    document.getElementById('og-image').setAttribute('content', '');
    document.getElementById('twitter-image').setAttribute('content', '');
  }
  const fullOriginalUrl = originalUrl ? 'https://' + originalUrl.replace(/^https?:\/\//, '') : window.location.href;
  document.getElementById('og-url').setAttribute('content', fullOriginalUrl);
}
function isJfmLink(str) {
  if (!str) return false;
  const t = str.trim();
  return (/^https?:\/\//i.test(t) || /jfmplay\.dk|stiften\.dk|jv\.dk|fyens\.dk|ugeavisen\.dk|hsfo\.dk|faa\.dk|erhvervplus\.dk|dagbladet-holstebro-struer\.dk|viborg-folkeblad\.dk|amtsavisen\.dk|vafo\.dk|helsingordagblad\.dk|frdb\.dk/i.test(t));
}
function normalizeUrl(input) {
  let t = input.trim();
  if (/^https?:\/\//i.test(t)) return t;
  if (/jfmplay\.dk/i.test(t)) return `https://${t}`;
  const domainMatch = t.match(/^(stiften|jv|fyens|ugeavisen|hsfo|faa|erhvervplus|dagbladet-holstebro-struer|viborg-folkeblad|amtsavisen|vafo|helsingor|frdb)\.dk/i);
  if (domainMatch) return `https://${t}`;
  return t;
}
function getCleanUrl(urlStr) {
  let clean = urlStr;
  try {
    const url = new URL(urlStr);
    clean = url.origin + url.pathname;
  } catch (e) {
    clean = urlStr.split('?')[0];
  }
  return clean;
}
urlInput.addEventListener('input', () => {
  const val = urlInput.value.trim();
  if (val !== currentUrl) setCopyButtonEnabled(false);
});
urlInput.addEventListener('paste', () => {
  setTimeout(() => {
    const val = urlInput.value.trim();
    if (isJfmLink(val) && val !== currentUrl) processUrl(val);
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
  const clean = getCleanUrl(currentUrl).replace(/^https?:\/\//i, '');
  const shareUrl = `https://jfmaio.netlify.app?url=${clean}`;
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
async function processUrl(inputUrl) {
  const cleanUrl = normalizeUrl(inputUrl);
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
      updateSocialMetadata("JFM AiO", "Forbedret visning af artikler og videoer fra JFM", "", "");
    }
  }
  enableInput();
}
async function loadVideo(pageUrl, container) {
  const uuidMatch = pageUrl.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  if (!uuidMatch) {
    container.innerHTML = '<p style="color:#f66;text-align:center">Ugyldigt JFM Play link</p>';
    return "JFM Play";
  }
  const uuid = uuidMatch[0];
  const isLive = pageUrl.includes('live-sport') && !pageUrl.includes('video-on-demand');
  const badgeText = isLive ? 'LIVE' : 'HØJDEPUNKTER';
  const badgeClass = isLive ? 'live-badge' : 'vod-badge';

  let title = "JFM Play stream";

  if (!isLive) {
    try {
      const apiUrl = `https://jfmplay.dk/flowplayer/api/videos-on-demand/${uuid}?workspaceId=8de32d80-db7d-47d2-867d-cd1e640f2745`;
      const apiResp = await fetch(PROXY + encodeURIComponent(apiUrl));
      if (apiResp.ok) {
        const data = await apiResp.json();
        title = data.headline || title;
        if (data.imageUrl) {
          posterUrl = data.imageUrl;
        }
      }
    } catch (e) {}
  } else {
    title = "Live: JFM Play";
  }

  const primaryUrl = `https://cf1318f5d.lwcdn.com/hls/${uuid}/playlist.m3u8`;
  const posterAttr = posterUrl ? `poster="${posterUrl}"` : '';

  let out = `<div class="article-header">
    <span class="${badgeClass} article-label">${badgeText}</span>
    <a href="${pageUrl}" target="_blank" rel="noopener" class="original-article-link">
      jfmplay.dk <span class="external-icon">↗</span>
    </a>
  </div>`;

  out += `<h3 class="stream-headline">${title}</h3>`;

  out += `<div class="article-video-wrapper">
    <video class="article-video stream-video" controls autoplay playsinline ${posterAttr}></video>
  </div>`;

  container.innerHTML = out;

  const video = container.querySelector('.stream-video');
  shaka.polyfill.installAll();
  if (shaka.Player.isBrowserSupported()) {
    const player = new shaka.Player(video);
    player.load(primaryUrl).catch(err => {
      container.innerHTML += '<p style="color:red;text-align:center;margin-top:1rem">Video kunne ikke afspilles</p>';
    });
  } else {
    container.innerHTML += '<p style="color:red;text-align:center;margin-top:1rem">Browser understøtter ikke afspilning</p>';
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
  const videoScripts = Array.from(asyncDoc.querySelectorAll('script[type="text/javascript"]'))
    .filter(script => script.textContent.includes('_bp.push') && script.textContent.includes('"video"'));
  const videos = videoScripts.map(script => {
    try {
      const fullMatch = script.textContent.match(/obj:\s*\{\s*id:\s*"([^"]+)"[^}]*"video":\s*"([^"]+)"[^}]*\}/);
      if (fullMatch) {
        const partnerId = fullMatch[1];
        const videoId = fullMatch[2];
        return { partnerId, videoId };
      }
      const videoMatch = script.textContent.match(/"video":\s*"([^"]+)"/);
      if (videoMatch) {
        const videoId = videoMatch[1];
        return { partnerId: '25547', videoId };
      }
    } catch (e) {}
    return null;
  }).filter(Boolean);
  const videoDataList = [];
  for (const v of videos) {
    let initialPlayerId = v.partnerId || '25547';
    const videoId = v.videoId;
    let primaryUrl = null;
    let isHls = false;
    let partnerId = initialPlayerId;
    try {
      const jsonUrl = `https://player.videosyndicate.io/services/get/video/${initialPlayerId}/${videoId}.json`;
      const jsonResp = await fetch(PROXY + encodeURIComponent(jsonUrl));
      if (jsonResp.ok) {
        const data = await jsonResp.json();
        if (data.Player?.partner_id) {
          partnerId = data.Player.partner_id;
        }
        const videoObj = data.Video?.[0];
        if (videoObj) {
          const source = videoObj.source || {};
          if (source.streaming && source.streaming.endsWith('.m3u8')) {
            primaryUrl = source.streaming;
            isHls = true;
          } else {
            const preferred = data.Player?.video_source || 'hd';
            const qualityMap = { ld: 'ld', sd: 'sd', hsd: 'hsd', hd: 'hd', fhd: 'fhd' };
            const key = qualityMap[preferred] || 'hd';
            let candidate = source[key] || source.hd || source.fhd || source.hsd || source.sd || source.ld;
            if (candidate && candidate.includes('video_no_longer_exists.mp4')) {
              candidate = null;
            }
            if (candidate) {
              primaryUrl = candidate;
            }
          }
        }
      }
    } catch (err) {}
    if (!primaryUrl) {
      primaryUrl = `https://cdn.videosyndicate.io/live/partners/${partnerId}/streaming/${videoId}/${videoId}.m3u8`;
      isHls = true;
    }
    if (primaryUrl) {
      videoDataList.push({ url: primaryUrl, isHls });
    }
  }
  const cleanOriginalUrl = getCleanUrl(url);
  const originalUrlObj = new URL(cleanOriginalUrl);
  const baseDomain = originalUrlObj.hostname.replace(/^www\./, '');
  let out = '<div class="article-header">';
  if (label) {
    out += `<div class="article-label">${label}</div>`;
  }
  out += `
  <a href="${cleanOriginalUrl}"
     target="_blank"
     rel="noopener"
     class="original-article-link">
     ${baseDomain} <span class="external-icon">↗</span>
  </a>`;
  out += '</div>';
  out += `<h1 class="article-headline">${headline}</h1>`;
  if (lead) out += `<p class="article-lead">${lead}</p>`;
  if (byline || date) out += `<div class="article-meta">${byline}${byline && date ? ' – ' : ''}${date}</div>`;
  paragraphs.forEach(p => out += `<p class="article-text">${p}</p>`);
  videoDataList.forEach((vid, index) => {
    out += `<div class="article-video-wrapper">
              <video class="article-video" controls playsinline></video>
              <p class="article-video-caption">Video fra artiklen</p>
            </div>`;
    out += `<script class="video-data" type="application/json" data-index="${index}">${vid.url}</script>
            <script class="video-is-hls" type="application/json" data-index="${index}">${vid.isHls}</script>`;
  });
  images.forEach(img => {
    out += `<figure class="article-figure">
              <img src="${img.src}" class="article-image" alt="${img.caption}">
              ${img.caption ? `<figcaption>${img.caption}</figcaption>` : ''}
            </figure>`;
  });
  container.innerHTML = out;
  const videoElements = container.querySelectorAll('video.article-video');
  videoElements.forEach((videoEl, idx) => {
    const wrapper = videoEl.closest('.article-video-wrapper');
    const dataScript = wrapper?.nextElementSibling;
    const hlsScript = dataScript?.nextElementSibling;
    if (!dataScript || !dataScript.classList.contains('video-data')) {
      return;
    }
    const url = dataScript.textContent.trim();
    const isHls = hlsScript && hlsScript.classList.contains('video-is-hls') ? JSON.parse(hlsScript.textContent) : false;
    if (isHls) {
      shaka.polyfill.installAll();
      if (shaka.Player.isBrowserSupported()) {
        const player = new shaka.Player(videoEl);
        player.load(url).catch(err => {
          wrapper.innerHTML += '<p style="color:red;text-align:center">Video kunne ikke afspilles (HLS fejl)</p>';
        });
      } else {
        wrapper.innerHTML += '<p style="color:red;text-align:center">Browser understøtter ikke HLS</p>';
      }
    } else {
      videoEl.src = url;
      videoEl.load();
    }
  });
  const description = lead || (paragraphs[0] ? paragraphs[0].substring(0, 200) + '...' : '');
  const firstImage = images[0]?.src || '';
  updateSocialMetadata(headline, description, firstImage, url);
  return headline;
}
setCopyButtonEnabled(false);
document.querySelector('h1, .logo, [href="#"], header')?.addEventListener('click', e => {
  if (e.target.textContent.trim() === 'JFM AiO') {
    e.preventDefault();
    window.location.href = 'https://jfmaio.netlify.app';
  }
});
const urlFromParam = getUrlParameter();
if (urlFromParam && isJfmLink(urlFromParam)) {
  urlInput.value = urlFromParam;
  processUrl(urlFromParam);
} else {
  updatePageTitle("JFM AiO");
  updateSocialMetadata("JFM AiO", "Forbedret visning af artikler og videoer fra JFM", "", "");
}
