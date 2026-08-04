---
title: 狒狒音乐盒
date: 2026-08-04 18:30:00
type: "music"
---

<div class="music-page-shell">
  <div class="music-hero-card">
    <div class="music-card-header">
      <span class="music-tag">NETEASE MUSIC / OFFICIAL PLAYER</span>
      <h2 class="music-card-title">网易云官方播放器</h2>
      <p class="music-card-desc">基于网易云官方引擎。若你在浏览器中登录了网易云 VIP 账号，可直接在网页播放完整 VIP 歌曲。</p>
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

  <div class="music-official-frame-box" id="music-player-box">
    <iframe 
      id="music-iframe" 
      border="0" 
      marginwidth="0" 
      marginheight="0" 
      width="100%" 
      height="450" 
      src="//music.163.com/outchain/player?type=0&id=24381616&auto=0&height=430"
      aria-label="网易云音乐官方播放器">
    </iframe>
  </div>
</div>

<script>
(() => {
  const input = document.getElementById('music-playlist-input');
  const loadBtn = document.getElementById('music-load-btn');
  const iframe = document.getElementById('music-iframe');

  if (!input || !loadBtn || !iframe) return;

  const loadPlaylist = (id) => {
    const cleanId = String(id).trim().replace(/\D/g, '');
    if (!cleanId) return;

    iframe.src = `//music.163.com/outchain/player?type=0&id=${cleanId}&auto=0&height=430`;
  };

  loadBtn.addEventListener('click', () => loadPlaylist(input.value));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') loadPlaylist(input.value);
  });
})();
</script>
