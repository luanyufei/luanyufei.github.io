---
title: 狒狒音乐盒
date: 2026-08-04 18:30:00
type: "music"
---

<!-- APlayer & MetingJS CDN dependencies -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/aplayer@1.10.1/dist/APlayer.min.css">
<script src="https://cdn.jsdelivr.net/npm/aplayer@1.10.1/dist/APlayer.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/meting@2.0.1/dist/Meting.min.js"></script>

<div class="music-page-shell">
  <div class="music-hero-card">
    <div class="music-card-header">
      <span class="music-tag">NETEASE MUSIC / AUDIO STREAM</span>
      <h2 class="music-card-title">网易云随身听</h2>
      <p class="music-card-desc">音乐、声音碎片与长期喜爱的歌单记录。</p>
    </div>
    <div class="music-net-actions">
      <a class="music-btn-net" href="https://music.163.com/#/user?id=1387620746" target="_blank" rel="noopener">
        <i class="fas fa-music"></i> 乱与狒的网易云主页 ↗
      </a>
      <div class="music-input-group">
        <input id="music-playlist-input" type="text" placeholder="输入网易云歌单 ID (如 24381616)" value="24381616">
        <button id="music-load-btn" type="button">载入歌单</button>
      </div>
    </div>
  </div>

  <div class="music-player-container" id="music-player-box">
    <!-- Default MetingJS Player initialized dynamically -->
    <meting-js 
      id="24381616" 
      server="netease" 
      type="playlist" 
      theme="#bdff35" 
      preload="auto" 
      order="list" 
      list-folded="false" 
      lrc-type="1">
    </meting-js>
  </div>
</div>

<script>
(() => {
  const input = document.getElementById('music-playlist-input');
  const loadBtn = document.getElementById('music-load-btn');
  const box = document.getElementById('music-player-box');

  if (!input || !loadBtn || !box) return;

  const loadPlaylist = (id) => {
    const cleanId = String(id).trim().replace(/\D/g, '');
    if (!cleanId) return;

    box.innerHTML = '';
    const playerEl = document.createElement('meting-js');
    playerEl.setAttribute('id', cleanId);
    playerEl.setAttribute('server', 'netease');
    playerEl.setAttribute('type', 'playlist');
    playerEl.setAttribute('theme', '#bdff35');
    playerEl.setAttribute('preload', 'auto');
    playerEl.setAttribute('order', 'list');
    playerEl.setAttribute('list-folded', 'false');
    playerEl.setAttribute('lrc-type', '1');

    box.appendChild(playerEl);
    if (window.Meting) {
      window.Meting.init?.();
    }
  };

  loadBtn.addEventListener('click', () => loadPlaylist(input.value));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') loadPlaylist(input.value);
  });
})();
</script>
