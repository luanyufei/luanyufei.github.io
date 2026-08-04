---
title: 狒狒音乐盒
date: 2026-08-04 18:30:00
type: "music"
---

<div class="cyber-music-deck">
  <!-- Top Audio Banner -->
  <header class="deck-status-bar">
    <div class="deck-status-item">
      <span class="status-dot"></span>
      <span class="status-label">NETEASE AUDIO ENGINE ACTIVE</span>
    </div>
    <div class="deck-status-item right">
      <span class="status-tag">VIP LOGIN SYNC ENABLED</span>
    </div>
  </header>

  <!-- Control & Playlist Preset Panel -->
  <div class="deck-control-card">
    <div class="deck-card-top">
      <div class="deck-title-group">
        <h2>AUDIO STREAM &amp; SOUNDTRACKS</h2>
        <p>网易云音乐直连播放台 · 在浏览器中登录网易云可同步完整 VIP 会员曲目</p>
      </div>
      <a class="deck-account-btn" href="https://music.163.com/#/user?id=1387620746" target="_blank" rel="noopener">
        <i class="fas fa-compact-disc fa-spin-hover"></i> 乱与狒的网易云主页 ↗
      </a>
    </div>

    <!-- Quick Presets -->
    <div class="deck-presets">
      <span class="preset-title">快捷歌单:</span>
      <button class="preset-chip active" type="button" data-id="24381616">
        <i class="fas fa-play"></i> 狒狒精选
      </button>
      <button class="preset-chip" type="button" data-id="547477546">
        <i class="fas fa-bolt"></i> 赛博朋克 / 电子
      </button>
      <button class="preset-chip" type="button" data-id="26467411">
        <i class="fas fa-moon"></i> 深夜 Chill Out
      </button>
    </div>

    <!-- Custom Playlist Switcher -->
    <div class="deck-input-bar">
      <label for="music-playlist-input">切换自定义歌单</label>
      <div class="input-shell">
        <i class="fas fa-link input-icon"></i>
        <input id="music-playlist-input" type="text" placeholder="输入网易云歌单 ID (例如 24381616)" value="24381616">
        <button id="music-load-btn" type="button">切换音轨 ↗</button>
      </div>
    </div>
  </div>

  <!-- Framed Player Console -->
  <div class="deck-player-frame">
    <div class="frame-header-bar">
      <div class="frame-dots">
        <span></span><span></span><span></span>
      </div>
      <span class="frame-label" id="frame-current-id">PLAYLIST ID: 24381616</span>
    </div>
    <div class="frame-content">
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
</div>

<script>
(() => {
  const input = document.getElementById('music-playlist-input');
  const loadBtn = document.getElementById('music-load-btn');
  const iframe = document.getElementById('music-iframe');
  const currentIdLabel = document.getElementById('frame-current-id');
  const chips = document.querySelectorAll('.preset-chip');

  if (!iframe) return;

  const loadPlaylist = (id) => {
    const cleanId = String(id).trim().replace(/\D/g, '');
    if (!cleanId) return;

    if (input) input.value = cleanId;
    if (currentIdLabel) currentIdLabel.textContent = `PLAYLIST ID: ${cleanId}`;
    iframe.src = `//music.163.com/outchain/player?type=0&id=${cleanId}&auto=0&height=430`;

    chips.forEach(chip => {
      chip.classList.toggle('active', chip.dataset.id === cleanId);
    });
  };

  if (loadBtn && input) {
    loadBtn.addEventListener('click', () => loadPlaylist(input.value));
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') loadPlaylist(input.value);
    });
  }

  chips.forEach(chip => {
    chip.addEventListener('click', () => {
      const id = chip.dataset.id;
      if (id) loadPlaylist(id);
    });
  });
})();
</script>
