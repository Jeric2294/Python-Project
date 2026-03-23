'use strict';

/* ═══════════════════════════════════════════════════════════
   § 1  WebGL — deep space shader (Davion Engine/Thermal style)
   ═══════════════════════════════════════════════════════════ */
(function initWebGL(){
  const canvas=document.getElementById('glCanvas');
  const gl=canvas.getContext('webgl2')||canvas.getContext('webgl');
  if(!gl)return;
  const VERT=`#version 300 es\nin vec2 a;void main(){gl_Position=vec4(a,0,1);}`;
  const FRAG=`#version 300 es
  precision mediump float;
  uniform float T;uniform vec2 R;out vec4 O;
  float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5);}
  float blob(vec2 p,vec2 c,float r){return smoothstep(r,0.,length(p-c));}
  void main(){
    vec2 uv=gl_FragCoord.xy/R,asp=vec2(R.x/R.y,1.),p=uv*asp;float t=T*.10;
    vec3 col=vec3(.008,.012,.022);
    col=mix(col,vec3(.05,.30,.45),blob(p,vec2(.1+sin(t*.4)*.15,.8+cos(t*.3)*.08)*asp,.5)*.18);
    col=mix(col,vec3(.25,.08,.50),blob(p,vec2(.9+cos(t*.5)*.12,.3+sin(t*.4)*.10)*asp,.4)*.16);
    col=mix(col,vec3(.00,.20,.30),blob(p,vec2(.4+sin(t*.6)*.10,.1+cos(t*.5)*.07)*asp,.35)*.14);
    col=mix(col,vec3(.20,.90,.30),blob(p,vec2(sin(t*.3)*.1,.5)*asp,.25)*.08);
    vec2 grid=floor(uv*120.);float star=hash(grid),blink=0.5+0.5*sin(T*2.+star*6.28);
    if(star>.97)col+=vec3(.6,.8,1.)*blink*.4*(star-.97)*30.;
    O=vec4(col*smoothstep(0.,1.,1.-length((uv-.5)*1.5)),1.);}`;
  const mkS=(t,s)=>{const sh=gl.createShader(t);gl.shaderSource(sh,s);gl.compileShader(sh);return sh;};
  const prog=gl.createProgram();
  gl.attachShader(prog,mkS(gl.VERTEX_SHADER,VERT));
  gl.attachShader(prog,mkS(gl.FRAGMENT_SHADER,FRAG));
  gl.linkProgram(prog);
  const buf=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buf);
  gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
  const aL=gl.getAttribLocation(prog,'a');
  gl.enableVertexAttribArray(aL);gl.vertexAttribPointer(aL,2,gl.FLOAT,false,0,0);
  const tL=gl.getUniformLocation(prog,'T'),rL=gl.getUniformLocation(prog,'R');
  let rt,paused=false;
  const resize=()=>{canvas.width=innerWidth;canvas.height=innerHeight;gl.viewport(0,0,canvas.width,canvas.height);};
  resize();window.addEventListener('resize',()=>{clearTimeout(rt);rt=setTimeout(resize,200);},{passive:true});
  document.addEventListener('visibilitychange',()=>{paused=document.hidden;if(!paused)requestAnimationFrame(frame);},{passive:true});
  const FM=42,t0=performance.now();let lf=0;
  const frame=ts=>{if(paused)return;if(ts-lf>=FM){lf=ts;gl.useProgram(prog);gl.uniform1f(tL,(ts-t0)*.001);gl.uniform2f(rL,canvas.width,canvas.height);gl.drawArrays(gl.TRIANGLE_STRIP,0,4);}requestAnimationFrame(frame);};
  requestAnimationFrame(frame);
})();

/* ═══════════════════════════════════════════════════════════
   § 2  Ripple
   ═══════════════════════════════════════════════════════════ */
(function(){
  const s=document.createElement('style');s.textContent='@keyframes rpl{to{transform:scale(4);opacity:0}}';document.head.appendChild(s);
  document.body.addEventListener('pointerdown',e=>{
    const btn=e.target.closest('.nexus-btn,.t-btn,.save-btn,.rr-btn,.stat-pill');if(!btn)return;
    const r=btn.getBoundingClientRect(),sz=Math.max(r.width,r.height);
    const rpl=document.createElement('span');
    rpl.style.cssText=`position:absolute;border-radius:50%;background:rgba(255,255,255,0.12);pointer-events:none;width:${sz}px;height:${sz}px;left:${e.clientX-r.left-sz/2}px;top:${e.clientY-r.top-sz/2}px;transform:scale(0);animation:rpl 0.4s ease-out forwards`;
    btn.appendChild(rpl);rpl.addEventListener('animationend',()=>rpl.remove(),{once:true});
  },{passive:true});
})();

/* ═══════════════════════════════════════════════════════════
   § 3  Bridge
   ═══════════════════════════════════════════════════════════ */
/* Browser mode = no ksu/apatch bridge, served via 127.0.0.1:8080 */
const _BROWSER_MODE = !window.ksu && !window.apatch &&
  (location.hostname==='127.0.0.1'||location.hostname==='localhost');

/* CGI availability flag — set after first probe */
let _cgiOk = null;

async function _probeCgi(){
  try{
    const r = await fetch('/cgi-bin/test.sh',{method:'GET',cache:'no-store'});
    const t = await r.text();
    _cgiOk = t.includes('CGI_OK');
  }catch(e){ _cgiOk = false; }
}

function waitForBridge(timeout=4000){
  return new Promise(resolve=>{
    if(_BROWSER_MODE)return resolve(true);
    if(window.ksu||window.apatch)return resolve(true);
    const dl=Date.now()+timeout;let d=5;
    const poll=()=>{if(window.ksu||window.apatch)return resolve(true);if(Date.now()>dl)return resolve(false);d=Math.min(d*1.6,100);setTimeout(poll,d);};
    setTimeout(poll,d);
  });
}
function exec(cmd,timeout=5000){
  return new Promise(resolve=>{
    // Bridge mode (KSU / APatch in-app WebUI)
    if(window.ksu||window.apatch){
      const id=`_cb_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const tm=setTimeout(()=>{delete window[id];resolve('');},timeout);
      window[id]=(_,out)=>{clearTimeout(tm);delete window[id];resolve(out??'');};
      if(window.ksu)ksu.exec(cmd,`window.${id}`);
      else apatch.exec(cmd,`window.${id}`);
      return;
    }
    // Browser mode — CGI exec bridge
    if(_BROWSER_MODE){
      const ctrl=new AbortController();
      const tm=setTimeout(()=>{ctrl.abort();resolve('');},timeout);
      fetch('/cgi-bin/exec.sh',{
        method:'POST',
        headers:{'Content-Type':'text/plain'},
        body:cmd,
        signal:ctrl.signal
      })
      .then(r=>{
        if(!r.ok){clearTimeout(tm);resolve('');return null;}
        return r.text();
      })
      .then(t=>{if(t!==null){clearTimeout(tm);resolve((t??'').trimEnd());}})
      .catch(()=>{clearTimeout(tm);resolve('');});
      return;
    }
    resolve('');
  });
}
const execAll=(...cmds)=>Promise.all(cmds.map(c=>exec(c)));

/* ── Auto-save: called after every apply action ─────────────
   Runs saveAllConfig() silently in background (non-blocking).
   A short debounce prevents redundant writes when multiple
   settings are applied in quick succession.                  */
let _autoSaveTimer = null;
function autoSave() {
  clearTimeout(_autoSaveTimer);
  _autoSaveTimer = setTimeout(() => saveAllConfig(), 800);
}

/* ── Constants ── */
const MOD       = '/data/adb/modules/GovThermal';
const CFG_DIR   = '/sdcard/GovThermal/config';
const CONN_IDLE_WIFI_OFF_FILE = `${CFG_DIR}/conn_idle_wifi_off`;
const CONN_IDLE_DATA_OFF_FILE = `${CFG_DIR}/conn_idle_data_off`;
const FREQ_FILE = '/sdcard/GovThermal/freq_scale.txt';
const THEME_FILE= `${CFG_DIR}/theme`;
// RR constants (uses DAVION_ENGINE engine paths for per-app data)
const RR_DIR    = '/sdcard/DAVION_ENGINE/refresh_locks';
const RR_CFG    = '/sdcard/DAVION_ENGINE/config';
const UNIVERSAL_RR_FILE     = '/sdcard/DAVION_ENGINE/universal_rr.txt';
const UNIVERSAL_BRIGHT_FILE = '/sdcard/DAVION_ENGINE/universal_brightness.txt';
const UNIVERSAL_VOL_FILE   = '/sdcard/DAVION_ENGINE/universal_vol.txt';
// Encore Tweaks gamelist path
const ENCORE_GAMELIST    = '/data/adb/.config/encore/gamelist.json';
const ENCORE_CONFIG_JSON = '/data/adb/.config/encore/config.json';
// Encore global config cache — loaded fresh on each popup open
let _encoreGlobalCfg = null;  // { preferences: { enforce_lite_mode, log_level, ... } }

/* ── Dynamic device limits (detected at runtime) ── */
let DEVICE_MAX_BRIGHTNESS = 255;  // updated by detectDeviceLimits()
let DEVICE_MAX_VOLUME     = 15;   // updated by detectDeviceLimits()

async function detectDeviceLimits() {
  // Run both detections in parallel
  const [brightRaw, volRaw] = await Promise.all([
    exec(
      `cat /sys/class/backlight/*/max_brightness 2>/dev/null | head -n1 || ` +
      `cat /sys/class/leds/lcd-backlight/max_brightness 2>/dev/null || ` +
      `cat /sys/class/leds/lcd-bl/max_brightness 2>/dev/null || ` +
      `settings get system screen_brightness_max_value 2>/dev/null || echo ""`
    ),
    exec(`cmd media_session volume --stream 3 --get 2>/dev/null; true`)
  ]);

  // ── Brightness ───────────────────────────────────────────
  const parsedBright = parseInt(brightRaw.trim());
  if (!isNaN(parsedBright) && parsedBright > 1) {
    DEVICE_MAX_BRIGHTNESS = parsedBright;
  } else {
    const curBrightRaw = await exec(`settings get system screen_brightness 2>/dev/null`);
    const curBright = parseInt(curBrightRaw.trim());
    if (!isNaN(curBright) && curBright > 255) {
      DEVICE_MAX_BRIGHTNESS = curBright > 4095 ? 16383 : curBright > 2047 ? 4095 : 2047;
    }
  }

  // ── Volume ───────────────────────────────────────────────
  const rangeMatch = volRaw.match(/\[(\d+)\.\.(\d+)\]/);
  const maxMatch   = volRaw.match(/max[:\s]+(\d+)/i);
  if (rangeMatch) {
    DEVICE_MAX_VOLUME = parseInt(rangeMatch[2]);
  } else if (maxMatch) {
    DEVICE_MAX_VOLUME = parseInt(maxMatch[1]);
  } else {
    const volRaw2 = await exec(`media volume --stream 3 --get 2>/dev/null`);
    const m2 = volRaw2.match(/\[(\d+)\.\.(\d+)\]/) || volRaw2.match(/max[:\s]+(\d+)/i);
    if (m2) DEVICE_MAX_VOLUME = parseInt(m2[m2.length - 1]);
  }

  _applyDeviceLimitsToSliders();
}

function _applyDeviceLimitsToSliders() {
  // Universal brightness slider
  const ubSlider = document.getElementById('universal-bright-slider');
  if (ubSlider) {
    ubSlider.max = DEVICE_MAX_BRIGHTNESS;
    if (parseInt(ubSlider.value) > DEVICE_MAX_BRIGHTNESS) {
      ubSlider.value = Math.round(DEVICE_MAX_BRIGHTNESS / 2);
      _syncSliderFill(ubSlider);
    }
  }

  // Per-app brightness slider
  const pbSlider = document.getElementById('popup-bright-slider');
  if (pbSlider) {
    pbSlider.max = DEVICE_MAX_BRIGHTNESS;
    if (parseInt(pbSlider.value) > DEVICE_MAX_BRIGHTNESS) {
      pbSlider.value = -1;
      _syncSliderFill(pbSlider);
    }
  }

  // Universal volume slider
  const uvSlider = document.getElementById('universal-vol-slider');
  if (uvSlider) {
    uvSlider.max = DEVICE_MAX_VOLUME;
    if (parseInt(uvSlider.value) > DEVICE_MAX_VOLUME) {
      uvSlider.value = Math.round(DEVICE_MAX_VOLUME / 2);
      _syncSliderFill(uvSlider);
    }
  }

  // Per-app volume slider
  const pvSlider = document.getElementById('popup-vol-slider');
  if (pvSlider) {
    pvSlider.max = DEVICE_MAX_VOLUME;
    if (parseInt(pvSlider.value) > DEVICE_MAX_VOLUME) {
      pvSlider.value = -1;
      _syncSliderFill(pvSlider);
    }
  }

  // Re-render state labels with correct max
  renderUnivBrightState();
  renderUnivVolState();
}

/* ═══════════════════════════════════════════════════════════
   § 4  Theme  (Nexus style — volt/cyan/red/amber/violet)
   ═══════════════════════════════════════════════════════════ */
const THEMES=['volt','cyan','red','amber','yellow','violet','dark','black'];
function applyTheme(name){
  document.body.className=document.body.className.replace(/\btheme-\S+/g,'').trim();
  document.body.classList.add('theme-'+name);
  document.querySelectorAll('.t-btn').forEach(b=>b.classList.toggle('t-active',b.dataset.theme===name));
  const nameEl = document.getElementById('active-theme-name');
  if (nameEl) nameEl.textContent = name.toUpperCase();
}
function initTheme(){
  document.querySelectorAll('.t-btn').forEach(b=>{
    b.addEventListener('click',()=>{applyTheme(b.dataset.theme);exec(`mkdir -p ${CFG_DIR} && echo "${b.dataset.theme}" > ${THEME_FILE}`);},{passive:true});
  });
}

/* ── FAB Settings Button ── */
function initFabSettings(){
  const fabBtn    = document.getElementById("fab-settings-btn");
  const fabMenu   = document.getElementById("fab-menu");
  const fabBubble = document.getElementById("fab-theme-bubble");
  const menuTheme   = document.getElementById("fab-menu-theme");
  const menuBrowser = document.getElementById("fab-menu-browser");
  const menuToast   = document.getElementById("fab-menu-toast");
  const menuExit  = document.getElementById("fab-menu-exit");
  if(!fabBtn) return;

  // ── Restore toast toggle state from disk ──────────────────
  exec(`cat ${TOAST_CFG_FILE} 2>/dev/null`).then(raw => {
    const saved = raw.trim();
    if (saved === '0') {
      _toastEnabled = false;
      _syncToastMenuItem(false);
    }
  });

  // ── Restore KO global toggle state from disk ──────────────
  exec(`cat ${KO_GLOBAL_CFG_FILE} 2>/dev/null`).then(raw => {
    if (raw.trim() === '0') {
      _koGlobalEnabled = false;
      _syncKoMenuItem(false);
    }
  });

  // ── Restore Cache global toggle state from disk ────────────
  exec(`cat ${CACHE_GLOBAL_CFG_FILE} 2>/dev/null`).then(raw => {
    if (raw.trim() === '0') {
      _cacheGlobalEnabled = false;
      _syncCacheMenuItem(false);
    }
  });

  function _syncKoMenuItem(on) {
    const icon  = document.getElementById('fab-ko-icon');
    const label = document.getElementById('fab-ko-label');
    const item  = document.getElementById('fab-menu-ko');
    if (item)  item.setAttribute('aria-pressed', String(on));
    if (label) label.textContent = on ? 'KILL OTHERS ON' : 'KILL OTHERS OFF';
    if (item)  item.style.opacity = on ? '1' : '0.5';
  }

  function _syncCacheMenuItem(on) {
    const icon  = document.getElementById('fab-cache-icon');
    const label = document.getElementById('fab-cache-label');
    const item  = document.getElementById('fab-menu-cache');
    if (item)  item.setAttribute('aria-pressed', String(on));
    if (label) label.textContent = on ? 'CLEAR CACHE ON' : 'CLEAR CACHE OFF';
    if (item)  item.style.opacity = on ? '1' : '0.5';
  }

  function _syncToastMenuItem(on) {
    const icon  = document.getElementById('fab-toast-icon');
    const label = document.getElementById('fab-toast-label');
    if (menuToast) menuToast.setAttribute('aria-pressed', String(on));
    if (icon)  icon.textContent  = on ? '🔔' : '🔕';
    if (label) label.textContent = on ? 'TOAST ON' : 'TOAST OFF';
    if (menuToast) menuToast.style.opacity = on ? '1' : '0.5';
  }

  let menuOpen   = false;
  let bubbleOpen = false;

  function closeAll(){
    menuOpen = false; bubbleOpen = false;
    fabBtn.setAttribute("aria-expanded","false");
    fabMenu.classList.remove("fab-menu--open");
    fabMenu.setAttribute("aria-hidden","true");
    fabBubble.classList.remove("fab-bubble--open");
    fabBubble.setAttribute("aria-hidden","true");
  }

  fabBtn.addEventListener("click", e=>{
    e.stopPropagation();
    if(bubbleOpen){ closeAll(); return; }
    menuOpen = !menuOpen;
    fabBtn.setAttribute("aria-expanded", menuOpen ? "true" : "false");
    fabMenu.classList.toggle("fab-menu--open", menuOpen);
    fabMenu.setAttribute("aria-hidden", menuOpen ? "false" : "true");
    if(!menuOpen) bubbleOpen = false;
  });

  menuTheme.addEventListener("click", e=>{
    e.stopPropagation();
    bubbleOpen = !bubbleOpen;
    fabBubble.classList.toggle("fab-bubble--open", bubbleOpen);
    fabBubble.setAttribute("aria-hidden", bubbleOpen ? "false" : "true");
    menuOpen = false;
    fabMenu.classList.remove("fab-menu--open");
    fabMenu.setAttribute("aria-hidden","true");
  });

  menuBrowser?.addEventListener("click", async e=>{
    e.stopPropagation();
    closeAll();
    const url = "http://127.0.0.1:8080";
    if (_BROWSER_MODE) {
      // Already in browser — just open a new tab
      window.open(url, "_blank");
    } else {
      // Inside KSU/APatch WebView — use am start to open in default browser
      await exec(`am start -a android.intent.action.VIEW -d "${url}" 2>/dev/null`);
    }
    showToast('Opening WebUI in browser…', 'BROWSER', 'info', '🌐');
  });

  menuToast?.addEventListener("click", async e=>{
    e.stopPropagation();
    _toastEnabled = !_toastEnabled;
    _syncToastMenuItem(_toastEnabled);
    await exec(`mkdir -p ${CFG_DIR} && echo '${_toastEnabled ? '1' : '0'}' > ${TOAST_CFG_FILE}`);
    // Show one confirmation toast only when turning ON
    if (_toastEnabled) {
      showToast('Toast notifications enabled', 'TOAST', 'success', '🔔');
    }
  });

  document.getElementById('fab-menu-ko')?.addEventListener('click', async e => {
    e.stopPropagation();
    closeAll();
    _koGlobalEnabled = !_koGlobalEnabled;
    _syncKoMenuItem(_koGlobalEnabled);
    await exec(`mkdir -p ${CFG_DIR} && echo '${_koGlobalEnabled ? '1' : '0'}' > ${KO_GLOBAL_CFG_FILE}`);
    showToast(
      _koGlobalEnabled ? 'Kill Others: visible in App Config' : 'Kill Others: hidden in App Config',
      'KILL OTHERS',
      _koGlobalEnabled ? 'success' : 'info',
      '⏹'
    );
  });

  document.getElementById('fab-menu-cache')?.addEventListener('click', async e => {
    e.stopPropagation();
    closeAll();
    _cacheGlobalEnabled = !_cacheGlobalEnabled;
    _syncCacheMenuItem(_cacheGlobalEnabled);
    await exec(`mkdir -p ${CFG_DIR} && echo '${_cacheGlobalEnabled ? '1' : '0'}' > ${CACHE_GLOBAL_CFG_FILE}`);
    showToast(
      _cacheGlobalEnabled ? 'Clear Cache: visible in App Config' : 'Clear Cache: hidden in App Config',
      'CLEAR CACHE',
      _cacheGlobalEnabled ? 'success' : 'info',
      '🗑'
    );
  });

  menuExit.addEventListener("click", async e=>{
    e.stopPropagation();
    closeAll();

    /* ── Turn overlay OFF if it is currently ON ── */
    if (overlayOn) {
      overlayOn = false;
      const val = document.getElementById('mon_overlay');
      if (val) { val.textContent = 'OFF'; val.className = 'stat-pill-val off'; }
      setStatus('Overlay OFF');
      exec(`su -c "service call SurfaceFlinger 1034 i32 0"`);
      exec(`echo off > ${RR_CFG}/overlay_state`);
    }

    /* Detect APatch/KSU manager package then force-stop it immediately */
    const raw = await exec("pm list packages 2>/dev/null | grep -iE 'apatch|passkey' | head -1 | sed 's/package://'");
    const pkg = (raw || "").trim() || "me.bmax.apatch";
    exec("am force-stop " + pkg);
  });

  document.addEventListener("click", e=>{
    const wrap = document.getElementById("hdr-gear-wrap");
    if(wrap && !wrap.contains(e.target)) closeAll();
  });
}

/* ═══════════════════════════════════════════════════════════
   § 5  Status bar
   ═══════════════════════════════════════════════════════════ */
let _st=null;
function setStatus(msg,color){
  const el=document.getElementById('debug-msg');if(!el)return;
  el.textContent=msg;el.style.color=color||'var(--a)';
  clearTimeout(_st);_st=setTimeout(()=>{el.textContent='SYS READY · MODULE ONLINE';el.style.color='';},2800);
}
/* ── Toast notifications ─────────────────────────────────── */
let _toastEnabled = true;  // controlled by gear icon toggle; persisted to disk
const TOAST_CFG_FILE = `${CFG_DIR}/toast_enabled`;

let _koGlobalEnabled = true;  // controls KO visibility in App Configuration
const KO_GLOBAL_CFG_FILE = `${CFG_DIR}/ko_global_enabled`;

let _cacheGlobalEnabled = true;  // controls Cache visibility in App Configuration
const CACHE_GLOBAL_CFG_FILE = `${CFG_DIR}/cache_global_enabled`;

function showToast(msg, title='', type='success', icon='', dur=2800) {
  if (!_toastEnabled) return;
  const wrap = document.getElementById('toast-container');
  if (!wrap) return;
  if (!icon) icon = {success:'✓',info:'ℹ',warn:'⚠',error:'✕'}[type] || '◈';
  const el = document.createElement('div');
  el.className = `toast toast--${type}`;
  el.innerHTML =
    `<span class="toast-icon">${icon}</span>` +
    `<div class="toast-body">` +
      (title ? `<div class="toast-title">${title}</div>` : '') +
      `<div class="toast-msg">${msg}</div>` +
    `</div>` +
    `<button class="toast-x" aria-label="close">✕</button>`;
  el.querySelector('.toast-x').onclick = () => _killToast(el);
  wrap.appendChild(el);
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('toast--in')));
  el._t = setTimeout(() => _killToast(el), dur);
}
function _killToast(el) {
  if (el._gone) return; el._gone = true;
  clearTimeout(el._t);
  el.classList.remove('toast--in'); el.classList.add('toast--out');
  el.addEventListener('transitionend', () => el.remove(), {once:true});
}


/* ═══════════════════════════════════════════════════════════
   § 6  Header toggles: Services / Overlay / Detection
   ═══════════════════════════════════════════════════════════ */
let svcEnabled = true;
let overlayOn  = false;

function initHeaderToggles() {
  document.getElementById('stat-services')?.addEventListener('click', toggleServices);
  document.getElementById('stat-overlay')?.addEventListener('click',  toggleOverlay);
  document.getElementById('stat-detect')?.addEventListener('click',   toggleDetect);
  initConnToggles();
}

/* ── Connectivity toggles: WiFi / Data / GPS ─────────────── */
const connState = { wifi: true, data: true, loc: true };
const CONN_LABELS = { wifi: 'WIFI', data: 'DATA', loc: 'GPS' };

function _applyConnVisual(type) {
  const on  = connState[type];
  const btn = document.getElementById('conn-' + type);
  if (!btn) return;
  btn.setAttribute('aria-pressed', String(on));
  const lbl = document.getElementById('conn-' + type + '-label');
  if (lbl) lbl.textContent = CONN_LABELS[type];
}

async function readConnState() {
  const [wifiRaw, dataRaw, locRaw] = await Promise.all([
    exec(`dumpsys wifi 2>/dev/null | grep -m1 "Wi-Fi is" | grep -oi "enabled\\|disabled" || settings get global wifi_on`),
    exec(`settings get global mobile_data 2>/dev/null`),
    exec(`settings get secure location_mode 2>/dev/null`)
  ]);
  const w = wifiRaw.trim().toLowerCase();
  connState.wifi = (w === 'enabled' || w === '1');
  connState.data = (dataRaw.trim() === '1');
  const lm = parseInt(locRaw.trim());
  connState.loc  = (!isNaN(lm) && lm > 0);
  _applyConnVisual('wifi');
  _applyConnVisual('data');
  _applyConnVisual('loc');
}

function initConnToggles() {
  document.getElementById('conn-wifi')?.addEventListener('click', () => toggleConn('wifi'));
  document.getElementById('conn-data')?.addEventListener('click', () => toggleConn('data'));
  document.getElementById('conn-loc')?.addEventListener('click',  () => toggleConn('loc'));
  readConnState(); // async — reads live state from shell
}

async function toggleConn(type) {
  connState[type] = !connState[type];
  const on = connState[type];
  _applyConnVisual(type);
  const labels = { wifi: 'WiFi', data: 'Mobile Data', loc: 'GPS / Location' };
  showToast(`${labels[type]} ${on ? 'ON' : 'OFF'}`, 'CONN', on ? 'success' : 'warn', on ? '●' : '○');
  setStatus(`${labels[type]}: ${on ? 'ON' : 'OFF'}`);
  if (type === 'wifi') {
    exec(`su -c "svc wifi ${on ? 'enable' : 'disable'}; cmd wifi ${on ? 'enable-wifi' : 'disable-wifi'} 2>/dev/null || true"`);
  } else if (type === 'data') {
    exec(`su -c "svc data ${on ? 'enable' : 'disable'}; cmd connectivity set-airplane-mode disable 2>/dev/null || true"`);
  } else if (type === 'loc') {
    exec(`su -c "settings put secure location_mode ${on ? '3' : '0'}"`);
  }
}

async function toggleServices() {
  const val = document.getElementById('mon_services');
  if (svcEnabled) {
    svcEnabled = false;
    val.textContent = 'OFF'; val.className = 'stat-pill-val off';
    setStatus('⏹ Services stopped', 'var(--a)');
    showToast('AI services stopped','SERVICES','warn','⏹');
    exec(`pkill -f "GovThermal.*service" 2>/dev/null`);
  } else {
    svcEnabled = true;
    val.textContent = 'ON'; val.className = 'stat-pill-val on';
    setStatus('▶ Services started', 'var(--a)');
    showToast('AI services started','SERVICES','success','▶');
    exec(`sh "${MOD}/service.sh" &`);
  }
}

async function toggleOverlay() {
  const val = document.getElementById('mon_overlay');
  overlayOn = !overlayOn;
  val.textContent = overlayOn ? 'ON' : 'OFF';
  val.className   = 'stat-pill-val ' + (overlayOn ? 'on' : 'off');
  setStatus(`Overlay ${overlayOn ? 'ON' : 'OFF'}`);
  exec(`su -c "service call SurfaceFlinger 1034 i32 ${overlayOn ? 1 : 0}"`);
  exec(`echo ${overlayOn ? 'on' : 'off'} > ${RR_CFG}/overlay_state`);
  showToast(`Overlay ${overlayOn ? 'ON' : 'OFF'}`, 'OVERLAY', overlayOn ? 'success' : 'info', overlayOn ? '🟢' : '⭕');
}

async function toggleDetect() {
  const el = document.getElementById('detection-status');
  const toLogcat = el.textContent !== 'Logcat';
  el.textContent = toLogcat ? 'Logcat' : 'Dumpsys';
  el.className   = 'stat-pill-val ' + (toLogcat ? 'on' : 'off');
  setStatus(`Detection: ${toLogcat ? 'Logcat' : 'Dumpsys'}`);
  if (toLogcat) {
    exec(`touch ${RR_CFG}/enable_logcat && rm -f ${RR_CFG}/enable_dumpsys`);
  } else {
    exec(`touch ${RR_CFG}/enable_dumpsys && rm -f ${RR_CFG}/enable_logcat`);
  }
  showToast(`Detection: ${toLogcat ? 'Logcat' : 'Dumpsys'}`, 'DETECT', 'info', toLogcat ? '📋' : '📡');
}

/* ═══════════════════════════════════════════════════════════
   § 7  Thermal — read-only live monitor
   ═══════════════════════════════════════════════════════════ */
let _thermTimer=null;

async function readThermalState(){
  const[disabledCount,totalCount,cpuTemp,gpuTemp,batTemp]=await execAll(
    `grep -rl "disabled" /sys/class/thermal/thermal_zone*/mode 2>/dev/null | wc -l`,
    `ls /sys/class/thermal/ 2>/dev/null | grep thermal_zone | wc -l`,
    `cat /sys/class/thermal/thermal_zone0/temp 2>/dev/null || cat /sys/devices/virtual/thermal/thermal_zone0/temp 2>/dev/null`,
    `cat /sys/class/thermal/thermal_zone4/temp 2>/dev/null || cat /sys/class/thermal/thermal_zone3/temp 2>/dev/null`,
    `cat /sys/class/power_supply/battery/temp 2>/dev/null`
  );
  const disabled=parseInt(disabledCount.trim())||0;
  const total=parseInt(totalCount.trim())||0;
  const thermalOff = total>0 && disabled>=(total/2);
  const ring=document.getElementById('therm-ring-inner');
  const label=document.getElementById('therm-state-label');
  const source=document.getElementById('therm-source');
  // Do not overwrite Pyrox-managed thermal display state
  if(typeof pyroxEnabled==='undefined'||!pyroxEnabled){
    if(ring)ring.classList.toggle('off',thermalOff);
    if(label){
      label.textContent=thermalOff?'DISABLED':'ACTIVE';
      label.className='therm-state'+(thermalOff?' off':'');
    }
    if(source){
      if(total===0){
        source.textContent='no thermal zones found';
      } else if(thermalOff){
        source.textContent=`${disabled}/${total} zones disabled · throttle bypassed`;
        source.style.color='#ff3b5c';
      } else {
        source.textContent=`${total} zones active · throttle enforced`;
        source.style.color='var(--a)';
      }
    }
  }
  function setBar(fillId,valId,rawTemp,maxTemp){
    const fill=document.getElementById(fillId);
    const val=document.getElementById(valId);
    const t=parseInt(rawTemp.trim());
    if(!fill||!val||isNaN(t))return;
    const c=t>1000?t/1000:t;
    const pct=Math.min(100,Math.max(0,(c/maxTemp)*100));
    fill.style.width=pct.toFixed(1)+'%';
    // Color state
    const hot=c>70, warm=c>50&&c<=70;
    fill.classList.remove('tv-warm','tv-hot');
    val.classList.remove('tv-ok','tv-warm','tv-hot');
    if(hot){ fill.classList.add('tv-hot'); val.classList.add('tv-hot'); }
    else if(warm){ fill.classList.add('tv-warm'); val.classList.add('tv-warm'); }
    else { val.classList.add('tv-ok'); }
    val.textContent=c.toFixed(1)+'°C';
  }
  setBar('tf-cpu','tv-cpu',cpuTemp,100);
  setBar('tf-gpu','tv-gpu',gpuTemp,95);
  setBar('tf-bat','tv-bat',batTemp.trim()?String(parseInt(batTemp.trim())/10):'',50);
}

function startThermalMonitor(){
  readThermalState();
  clearInterval(_thermTimer);
  _thermTimer=setInterval(readThermalState,5000);
}

/* ═══════════════════════════════════════════════════════════
   § 8  CPU Davion Engine
   ═══════════════════════════════════════════════════════════ */

let activeProfile='';

async function loadCpuState(){
  const[prof,govAndScale]=await Promise.all([
    exec(
      // Read file first — strip ALL whitespace including newlines
      // Only fall back to getprop if file is missing or truly empty
      `_p=$(tr -d '[:space:]' < ${CFG_DIR}/active_profile 2>/dev/null); ` +
      `[ -n "$_p" ] && [ "$_p" != "null" ] && echo "$_p" || ` +
      `getprop persist.sys.davion.active_profile 2>/dev/null`
    ),
    exec(
      `printf '%s\n' ` +
      // Get the ABSOLUTE hardware max of the highest cluster (prime core = policy6 > policy4 > policy0)
      // cpuinfo_max_freq is the hardware ceiling — unaffected by freq scale/thermal
      `"$(cat /sys/devices/system/cpu/cpufreq/policy6/cpuinfo_max_freq 2>/dev/null || ` +
      `cat /sys/devices/system/cpu/cpufreq/policy4/cpuinfo_max_freq 2>/dev/null || ` +
      `cat /sys/devices/system/cpu/cpufreq/policy0/cpuinfo_max_freq 2>/dev/null)" ` +
      `"$(cat /sys/block/mmcblk0/queue/scheduler 2>/dev/null | grep -o '\\[.*\\]' | tr -d '[]')" ` +
      `"$(cat ${FREQ_FILE} 2>/dev/null)"`
    ),
  ]);
  // Accept both old (performance/balanced/powersave) and new CPU Profile keys
  // (responsive/latency/battery) — map new keys to old for DE compat
  const rawP = prof.trim().toLowerCase();
  const _profRemap = { responsive:'balanced', latency:'performance', battery:'powersave' };
  const p = ['performance','balanced','powersave'].includes(rawP)
    ? rawP
    : (_profRemap[rawP] || 'balanced');
  activeProfile=p; updateBadge(p);

  // Read governor directly from sysfs — CPU Profiles writes there directly now
  const govFileRaw = await exec(
    `cat /sys/devices/system/cpu/cpufreq/policy6/scaling_governor 2>/dev/null || ` +
    `cat /sys/devices/system/cpu/cpufreq/policy4/scaling_governor 2>/dev/null || ` +
    `cat /sys/devices/system/cpu/cpufreq/policy0/scaling_governor 2>/dev/null`
  );
  const gov = govFileRaw.trim() || '—';

  const lines = govAndScale.trim().split('\n');
  const freq  = lines[0]||'';
  const io    = lines[1]||'—';
  const scale = lines[2]||'100';
  document.getElementById('cpu-gov-val').textContent=gov||'—';
  const f=freq.trim();
  document.getElementById('cpu-freq-val').textContent=f?(parseInt(f)/1000).toFixed(0)+' MHz':'—';
  document.getElementById('cpu-io-val').textContent=io.trim()||'—';
  const sc=parseInt(scale.trim())||100;
  const sl=document.getElementById('freq-scale-slider');
  if(sl){sl.value=sc;setSliderFill(sc);_syncSliderFill(sl);}
  const d=document.getElementById('freq-scale-display');
  if(d){ d.textContent=sc+'%'; updateFreqBadgeColor(sc); updateSliderTicks(sc); }
}

/* ── CPU core grid + area graph ─────────────────────────── */
function updateSliderTicks(v){
  document.querySelectorAll('.stk').forEach(el => {
    const val = parseInt(el.dataset.val);
    el.classList.remove('stk-active','stk-passed');
    if (val === v) {
      el.classList.add('stk-active');
    } else if (val < v) {
      el.classList.add('stk-passed');
    }
  });
}

function updateFreqBadgeColor(v){
  const d=document.getElementById('freq-scale-display');
  if(!d)return;
  if(v<=40){
    d.style.color='#60cfff'; d.style.borderColor='#60cfff';
    d.style.background='rgba(96,207,255,0.1)';
    d.style.textShadow='0 0 8px rgba(96,207,255,0.5)';
  } else if(v<=70){
    d.style.color='var(--a)'; d.style.borderColor='var(--a)';
    d.style.background='var(--tint-hi)';
    d.style.textShadow='0 0 8px var(--glow-s)';
  } else if(v<=90){
    d.style.color='#ffcc00'; d.style.borderColor='#ffcc00';
    d.style.background='rgba(255,204,0,0.1)';
    d.style.textShadow='0 0 8px rgba(255,204,0,0.5)';
  } else {
    d.style.color='#ff4466'; d.style.borderColor='#ff4466';
    d.style.background='rgba(255,68,102,0.12)';
    d.style.textShadow='0 0 8px rgba(255,68,102,0.5)';
  }
}

function updateBadge(p){
  // Map old names → CPU Profile key for card highlight
  const _toProf = { performance:'latency', balanced:'balanced', powersave:'battery' };
  const profKey = _toProf[p] || p;
  // Highlight the matching CPU Profile card
  document.querySelectorAll('.cpu-profile-card').forEach(card => {
    const active = card.dataset.cpuprof === profKey;
    card.style.borderColor = active ? 'rgba(var(--a-rgb),0.6)' : '';
    card.style.background  = active ? 'rgba(var(--a-rgb),0.07)' : '';
  });
  // Update PROFILE HDI tile
  const profileMap   = { performance:'PERF', balanced:'BALANCED', powersave:'SAVE' };
  const profileState = { performance:'hot',  balanced:'ok',       powersave:'warn' };
  const label = profileMap[p] || p.toUpperCase();
  const state = profileState[p] || 'ok';
  _hdi('hsi-freq', label, state);
}

function setSliderFill(v){
  const sl=document.getElementById('freq-scale-slider');
  if(sl)sl.style.setProperty('--pct',((v-30)/70*100).toFixed(1)+'%');
}

// applyProfile — legacy shim. Old HTML profile-card buttons removed.
// Maps balanced/performance/powersave → CPU Profile keys and delegates.
async function applyProfile(p){
  const _remap = { performance:'latency', balanced:'balanced', powersave:'battery' };
  const profKey = _remap[p] || 'balanced';
  activeProfile = p; updateBadge(p);
  await exec(`mkdir -p ${CFG_DIR} && echo "${p}" > ${CFG_DIR}/active_profile`);
  // Delegate actual governor application to CPU Profiles system
  if (typeof _selectCpuProfile === 'function') _selectCpuProfile(profKey);
  if (typeof _applyCpuProfile === 'function') await _applyCpuProfile();
  autoSave();
}

async function applyFreqScale(){
  const sl=document.getElementById('freq-scale-slider');
  const v=sl?parseInt(sl.value):100;
  setStatus(`FREQ LIMIT › ${v}%`,'#60cfff');
  // Save the scale value
  await exec(`mkdir -p /sdcard/GovThermal && echo "${v}" > ${FREQ_FILE}`);
  // Apply freq cap directly to sysfs — no governor re-apply to avoid
  // overriding whatever CPU Governor Profiles already set
  const pct = v / 100;
  await exec(`
    for base in /sys/devices/system/cpu/cpufreq/policy0 /sys/devices/system/cpu/cpufreq/policy4 /sys/devices/system/cpu/cpufreq/policy6; do
      [ -d "$base" ] || continue
      max=$(cat "$base/cpuinfo_max_freq" 2>/dev/null) || continue
      [ -z "$max" ] && continue
      cap=$(awk -v m="$max" -v p="${pct}" 'BEGIN{printf "%d", m*p}')
      chmod 644 "$base/scaling_max_freq" 2>/dev/null
      echo "$cap" > "$base/scaling_max_freq" 2>/dev/null || true
    done
  `);
  setStatus(`✓ FREQ LIMIT ${v}%`,'#60cfff');
  showToast(`Frequency cap set to ${v}%`,'FREQ SCALE','success','📊');
  setTimeout(loadCpuState,600);
  autoSave();
}

/* ── Governor chip system removed — CPU Governor Profiles panel handles all governor selection ── */

function initCpu(){
  const sl=document.getElementById('freq-scale-slider');
  if(sl)sl.addEventListener('input',()=>{
    const v=parseInt(sl.value);
    document.getElementById('freq-scale-display').textContent=v+'%';
    setSliderFill(v);
    updateFreqBadgeColor(v);
    updateSliderTicks(v);
  },{passive:true});
  document.getElementById('btn-apply-freq-scale')?.addEventListener('click',applyFreqScale);
  loadCpuState();
}

/* ═══════════════════════════════════════════════════════════
   § 8b  Header Device Info — live CPU / freq / thermal / display / governor
   ═══════════════════════════════════════════════════════════ */
function _hdi(id, text, state) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = text;
  el.dataset.state = state || 'ok';
}

async function loadHeaderDeviceInfo() {
  try {
    const [socRaw, govRaw, maxFRaw, curFRaw, tempRaw, thermModeRaw, gpuFreqRaw, dispPeakRaw, freqLimitRaw] = await Promise.all([
      exec('getprop ro.board.platform 2>/dev/null || getprop ro.hardware 2>/dev/null'),
      exec(
        // Prime core (policy6) governor is the most important — MT6893Z 3-cluster
        'cat /sys/devices/system/cpu/cpufreq/policy6/scaling_governor 2>/dev/null || ' +
        'cat /sys/devices/system/cpu/cpufreq/policy4/scaling_governor 2>/dev/null || ' +
        'cat /sys/devices/system/cpu/cpufreq/policy0/scaling_governor 2>/dev/null'
      ),
      exec(
        'cat /sys/devices/system/cpu/cpufreq/policy0/cpuinfo_max_freq 2>/dev/null || ' +
        'cat /sys/devices/system/cpu/cpufreq/policy4/cpuinfo_max_freq 2>/dev/null || ' +
        'cat /sys/devices/system/cpu/cpufreq/policy6/cpuinfo_max_freq 2>/dev/null || ' +
        'cat /sys/devices/system/cpu/cpu0/cpufreq/cpuinfo_max_freq 2>/dev/null'
      ),
      exec(
        'cat /sys/devices/system/cpu/cpufreq/policy4/scaling_cur_freq 2>/dev/null || ' +
        'cat /sys/devices/system/cpu/cpufreq/policy6/scaling_cur_freq 2>/dev/null || ' +
        'cat /sys/devices/system/cpu/cpufreq/policy0/scaling_cur_freq 2>/dev/null || ' +
        'cat /sys/devices/system/cpu/cpu4/cpufreq/scaling_cur_freq 2>/dev/null'
      ),
      exec(
        'for z in 4 0 1 2 3 5 6 7 8; do ' +
        '  f=/sys/class/thermal/thermal_zone$z/temp; ' +
        '  [ -f "$f" ] && v=$(cat "$f" 2>/dev/null) && [ "$v" -gt 0 ] 2>/dev/null && echo $v && break; ' +
        'done'
      ),
      exec('cat /sdcard/GovThermal/config/thermal_state 2>/dev/null || echo enabled'),
      exec(
        'cat /sys/class/devfreq/*/cur_freq 2>/dev/null | head -n1 || ' +
        'cat /sys/kernel/gpu/gpu_freq 2>/dev/null || ' +
        'cat /proc/gpufreqv2/gpufreq_status 2>/dev/null | grep -m1 "cur_freq" | grep -oE "[0-9]+" | head -n1'
      ),
      exec(
        'getprop ro.vendor.display.peak.refresh_rate 2>/dev/null; ' +
        'getprop persist.vendor.display.peak.refresh_rate 2>/dev/null; ' +
        'getprop ro.product.display.refresh_rate 2>/dev/null; ' +
        'getprop vendor.display.multifps.target_fps 2>/dev/null'
      ),
      exec(`cat ${FREQ_FILE} 2>/dev/null || echo 100`),
    ]);

    // SOC
    const soc = (socRaw.trim().toUpperCase() || '—').split('\n')[0].trim();
    _hdi('hsi-cpu', soc, 'ok');

    // PROFILE — show active CPU profile (PERF / BALANCED / SAVE)
    const profileMap = { performance: 'PERF', balanced: 'BALANCED', powersave: 'SAVE' };
    const profileState = { performance: 'hot', balanced: 'ok', powersave: 'warn' };
    const cleanProfile = (activeProfile || 'balanced').toLowerCase().trim();
    const profileLabel = profileMap[cleanProfile] || cleanProfile.toUpperCase();
    const bar = document.getElementById('hsi-freq-bar');
    _hdi('hsi-freq', profileLabel, profileState[cleanProfile] || 'ok');
    if (bar) bar.style.width = '0';

    // THERMAL — show ACTIVE or BYPASS with colored dot (no temp shown)
    const tOff = thermModeRaw.trim().toLowerCase().includes('disabled');
    const thermDot = document.getElementById('hdi-therm-dot');
    const thermVal = document.getElementById('hsi-therm');
    if (thermDot) {
      thermDot.className = 'hdi-status-dot ' + (tOff ? 'dot-off' : 'dot-active');
    }
    if (thermVal) {
      thermVal.textContent = tOff ? 'BYPASS' : 'ACTIVE';
      thermVal.dataset.state = tOff ? 'hot' : 'ok';
    }

    // DISPLAY — show active universal lock Hz from rrActive/rrModes, fallback to prop
    const dispDot = document.getElementById('hdi-disp-dot');
    const dispValEl = document.getElementById('hsi-disp');
    let dispHz = null;
    // Try live rrActive + rrModes first
    if (typeof rrActive !== 'undefined' && rrActive && typeof rrModes !== 'undefined' && rrModes.length) {
      const found = rrModes.find(m => m.id === rrActive);
      if (found) dispHz = found.label;
    }
    // Fallback: read saved universal_rr.txt
    if (!dispHz) {
      const urrRaw = await exec('cat ' + UNIVERSAL_RR_FILE + ' 2>/dev/null');
      const urrId  = urrRaw.trim();
      if (urrId && typeof rrModes !== 'undefined' && rrModes.length) {
        const found2 = rrModes.find(m => String(m.id) === String(urrId));
        if (found2) dispHz = found2.label;
      }
    }
    // Final fallback: system prop
    if (!dispHz) {
      const dispLines = dispPeakRaw.trim().split('\n').map(l => l.trim()).filter(Boolean);
      for (const line of dispLines) {
        const m2 = line.match(/^(\d{2,3})$/);
        if (m2 && parseInt(m2[1]) >= 24 && parseInt(m2[1]) <= 360) { dispHz = m2[1] + ' Hz'; break; }
      }
    }
    if (dispDot) {
      dispDot.className = 'hdi-status-dot ' + (dispHz ? 'dot-active' : 'dot-warn');
    }
    if (dispValEl) {
      dispValEl.textContent = dispHz || '—';
      dispValEl.className   = 'hdi-val ' + (dispHz ? 'disp-active' : 'disp-none');
    }

    // GPU — show locked freq if GPU OPP is saved, else show live cur_freq
    const gpuDot   = document.getElementById('hdi-gpu-dot');
    const gpuValEl = document.getElementById('hsi-gpu');
    let gpuLabel   = null;

    // Check if GPU is locked — read saved OPP index and convert to freq
    const savedOppRaw = await exec(`cat ${GPU_OPP_FILE} 2>/dev/null`);
    const savedOpp = savedOppRaw.trim();
    if (savedOpp && !isNaN(parseInt(savedOpp)) && Object.keys(_gpuFreqMap).length > 0) {
      const lockedFreq = _gpuFreqMap[parseInt(savedOpp)];
      if (lockedFreq !== undefined) {
        gpuLabel = lockedFreq + ' MHz';
        // Push locked freq to graph too — graph should always update
        const gpuPanel = document.getElementById('gpu-freq-section')?.querySelector('.panel-details');
        if (gpuPanel?.open) _pushGpuFreqSample(lockedFreq);
      }
    }
    // Fallback: live cur_freq from kernel
    if (!gpuLabel) {
      const gpuFreqVal = parseInt(gpuFreqRaw.trim());
      if (!isNaN(gpuFreqVal) && gpuFreqVal > 0) {
        if      (gpuFreqVal > 1000000) gpuLabel = Math.round(gpuFreqVal / 1000000) + ' MHz';
        else if (gpuFreqVal > 1000)    gpuLabel = Math.round(gpuFreqVal / 1000) + ' MHz';
        else                           gpuLabel = gpuFreqVal + ' KHz';
        // Push sample to history graph (only when panel is open to save resources)
        const gpuPanel = document.getElementById('gpu-freq-section')?.querySelector('.panel-details');
        if (gpuPanel?.open) {
          const mhz = gpuFreqVal > 1000000 ? Math.round(gpuFreqVal / 1000000)
                    : gpuFreqVal > 1000    ? Math.round(gpuFreqVal / 1000)
                    : gpuFreqVal;
          _pushGpuFreqSample(mhz);
        }
      }
    }
    if (gpuDot) {
      gpuDot.className = 'hdi-status-dot ' + (gpuLabel ? 'dot-active' : 'dot-warn');
    }
    if (gpuValEl) {
      gpuValEl.textContent = gpuLabel || '—';
      gpuValEl.className   = 'hdi-val ' + (gpuLabel ? 'disp-active' : 'disp-none');
    }

    // DAVION ENGINE — read saved governor from config file, not live kernel
    // Read saved governor from config file
    const savedProfile = (activeProfile || 'balanced').toLowerCase().trim();
    const savedGovRaw = await exec(
      `_g=$(tr -d '[:space:]' < ${CFG_DIR}/gov_${savedProfile} 2>/dev/null); ` +
      `[ -n "$_g" ] && echo "$_g" || echo "${govRaw.trim().split('\n')[0].trim()}"`
    );
    const gov = (savedGovRaw.trim().toUpperCase() || '—').split('\n')[0].trim();
    const gs  = gov === 'PERFORMANCE' ? 'hot' : gov === 'POWERSAVE' ? 'warn' : 'ok';
    _hdi('hsi-ctrl', gov, gs);

  } catch(e) { /* silent */ }
}

/* ═══════════════════════════════════════════════════════════
   § 9  Universal Refresh Rate Lock
   ═══════════════════════════════════════════════════════════ */
let rrModes  = [];
let rrActive = null;

async function loadUniversalRR() {
  const grp = document.getElementById('universal-rr-buttons');
  if (!grp) return;

  const raw = await exec(`${MOD}/script_runner/display_mode 2>/dev/null`);
  const lines = raw.trim().split('\n').filter(l => l.includes('|') && l.includes('Hz'));

  const seen = new Set();
  rrModes = lines.reduce((acc, line) => {
    const [id, spec] = line.split('|', 2);
    const m = spec?.match(/(\d+)Hz/);
    const label = m ? m[1] : spec?.trim();
    if (label && !seen.has(label)) { seen.add(label); acc.push({ id: id.trim(), label }); }
    return acc;
  }, []);

  if (!rrModes.length) {
    grp.innerHTML = '<span class="list-placeholder mono" style="color:var(--a)">No display modes detected</span>';
    return;
  }

  const saved = (await exec(`cat ${UNIVERSAL_RR_FILE} 2>/dev/null`)).trim();
  rrActive = saved || null;
  renderRRButtons();
}

function renderRRButtons() {
  const grp      = document.getElementById('universal-rr-buttons');
  const activeEl = document.getElementById('universal-rr-active');
  const lockBtn  = document.getElementById('btn-unlock');
  if (!grp) return;

  const frag = document.createDocumentFragment();
  rrModes.forEach(({ id, label }) => {
    const btn = document.createElement('button');
    btn.className     = 'rr-btn' + (rrActive === id ? ' rr-btn--active' : '');
    btn.textContent   = label + 'Hz';
    btn.dataset.id    = id;
    btn.dataset.label = label;
    frag.appendChild(btn);
  });
  grp.replaceChildren(frag);

  if (activeEl) {
    const found = rrModes.find(m => m.id === rrActive);
    activeEl.textContent = found ? found.label + 'Hz' : 'None';
    activeEl.className   = 'rr-status-val ' + (found ? 'on' : 'off');
  }

  if (lockBtn) {
    lockBtn.textContent = rrActive ? 'UNLOCK ›' : 'LOCK ›';
  }
}

document.addEventListener('click', e => {
  const btn = e.target.closest('#universal-rr-buttons .rr-btn');
  if (btn) setUniversalRR(btn.dataset.id, btn.dataset.label);
});

async function setUniversalRR(id, label) {
  rrActive = id;
  renderRRButtons();
  await exec(`mkdir -p /sdcard/DAVION_ENGINE && echo "${id}" > ${UNIVERSAL_RR_FILE}`);
  await exec(`su -c "service call SurfaceFlinger 1035 i32 ${id}"`);
  setStatus(`🔒 Locked: ${label}Hz`);
  showToast(`Display locked at ${label}Hz`,'ENGINE','success','🔒');
  autoSave();
}

async function clearUniversalRR() {
  rrActive = null;
  renderRRButtons();
  await exec(`rm -f ${UNIVERSAL_RR_FILE}`);
  await exec(`su -c "service call SurfaceFlinger 1035 i32 0"`);
  setStatus('🔓 Universal lock cleared');
  showToast('Refresh rate lock removed','ENGINE','info','🔓');
  autoSave();
}

/* ═══════════════════════════════════════════════════════════
   § 9b  Universal Brightness Lock
   ═══════════════════════════════════════════════════════════ */
let universalBrightness = null; // null = not locked, 0-255 = locked value

function updateUnivBrightSlider(val) {
  const slider = document.getElementById('universal-bright-slider');
  if (!slider) return;
  const pct = Math.round((val / DEVICE_MAX_BRIGHTNESS) * 100);
  slider.style.setProperty('--pct', pct + '%');
}

function renderUnivBrightState() {
  const activeEl   = document.getElementById('universal-bright-active');
  const lockBtn    = document.getElementById('btn-bright-lock');
  const unlockBtn  = document.getElementById('btn-bright-unlock');
  const slider     = document.getElementById('universal-bright-slider');

  if (activeEl) {
    if (universalBrightness !== null) {
      activeEl.textContent = universalBrightness + ' / ' + DEVICE_MAX_BRIGHTNESS;
      activeEl.className   = 'rr-status-val on';
    } else {
      activeEl.textContent = 'None';
      activeEl.className   = 'rr-status-val off';
    }
  }
  if (lockBtn)   lockBtn.textContent   = universalBrightness !== null ? 'UPDATE ›' : 'LOCK ›';
  if (unlockBtn) unlockBtn.style.opacity = universalBrightness !== null ? '1' : '0.35';
  if (slider && universalBrightness !== null) {
    slider.max   = DEVICE_MAX_BRIGHTNESS;
    slider.value = universalBrightness;
    updateUnivBrightSlider(universalBrightness);
  }
}

async function setUniversalBrightness(val) {
  universalBrightness = val;
  renderUnivBrightState();
  await exec(
    `settings put system screen_brightness_mode 0 2>/dev/null; ` +
    `settings put system screen_brightness ${val} 2>/dev/null`
  );
  await exec(`mkdir -p /sdcard/DAVION_ENGINE && echo "${val}" > ${UNIVERSAL_BRIGHT_FILE}`);
  setStatus(`☀ Brightness locked: ${val}`);
  showToast(`Brightness locked at ${val}`, 'ENGINE', 'success', '☀');
  autoSave();
}

async function clearUniversalBrightness() {
  universalBrightness = null;
  renderUnivBrightState();
  await exec(`rm -f ${UNIVERSAL_BRIGHT_FILE}`);
  await exec(`settings put system screen_brightness_mode 1 2>/dev/null`);
  setStatus('☀ Brightness lock cleared — auto restored');
  showToast('Brightness lock removed — auto-brightness restored', 'ENGINE', 'info', '🔓');
  autoSave();
}

async function loadUniversalBrightness() {
  const saved = (await exec(`cat ${UNIVERSAL_BRIGHT_FILE} 2>/dev/null`)).trim();
  if (saved !== '' && !isNaN(parseInt(saved))) {
    universalBrightness = parseInt(saved);
  } else {
    universalBrightness = null;
  }
  const slider = document.getElementById('universal-bright-slider');
  if (slider) {
    slider.max = DEVICE_MAX_BRIGHTNESS;
    if (universalBrightness !== null) {
      slider.value = Math.min(universalBrightness, DEVICE_MAX_BRIGHTNESS);
      updateUnivBrightSlider(universalBrightness);
    } else {
      // Default to current system brightness for convenience
      const cur = (await exec(`settings get system screen_brightness 2>/dev/null`)).trim();
      const cv = parseInt(cur);
      if (!isNaN(cv) && cv >= 0 && cv <= DEVICE_MAX_BRIGHTNESS) {
        slider.value = cv;
        updateUnivBrightSlider(cv);
      } else {
        // If current brightness is out of range, default to mid
        slider.value = Math.round(DEVICE_MAX_BRIGHTNESS / 2);
        updateUnivBrightSlider(Math.round(DEVICE_MAX_BRIGHTNESS / 2));
      }
    }
  }
  renderUnivBrightState();
}

function initUniversalBrightness() {
  const slider = document.getElementById('universal-bright-slider');
  let _univBrightDebounce = null;

  function _setBrightSlider(v) {
    if (!slider) return;
    v = Math.max(0, Math.min(DEVICE_MAX_BRIGHTNESS || 255, v));
    slider.value = v;
    updateUnivBrightSlider(v);
    const activeEl = document.getElementById('universal-bright-active');
    if (activeEl) { activeEl.textContent = v + ' / ' + (DEVICE_MAX_BRIGHTNESS || 255); activeEl.className = 'rr-status-val on'; }
    clearTimeout(_univBrightDebounce);
    _univBrightDebounce = setTimeout(() => {
      exec(`settings put system screen_brightness_mode 0 2>/dev/null; settings put system screen_brightness ${v} 2>/dev/null`);
    }, 60);
  }

  // Instant live apply while dragging
  slider?.addEventListener('input', () => _setBrightSlider(parseInt(slider.value)));

  // − / + buttons (step = 5)
  document.getElementById('bright-dec-btn')?.addEventListener('click', () => _setBrightSlider(parseInt(slider?.value || 128) - 5));
  document.getElementById('bright-inc-btn')?.addEventListener('click', () => _setBrightSlider(parseInt(slider?.value || 128) + 5));

  document.getElementById('btn-bright-lock')?.addEventListener('click', async () => {
    const v = parseInt(document.getElementById('universal-bright-slider')?.value ?? 128);
    await setUniversalBrightness(v);
  });

  document.getElementById('btn-bright-unlock')?.addEventListener('click', async () => {
    if (universalBrightness !== null) await clearUniversalBrightness();
  });

  loadUniversalBrightness();
}

/* ═══════════════════════════════════════════════════════════
   § 10  Per-App list
   ═══════════════════════════════════════════════════════════ */
let currentPkg = '';
let _popupSpare60On = false;  // per-app spare from 60Hz drop state
let _popupHvolOn   = false;   // per-app headset volume enabled
let _popupHvolVal  = 7;       // per-app headset volume level (0-15)


const configuredPkgs = new Set();
// Encore Tweaks: packages that have tweaks enabled + their settings cache
const encorePkgs = new Set();
let _encoreGamelist = {};  // full gamelist.json cache: { pkg: { lite_mode, enable_dnd } }

// ── Kill Others + Connection per-app state ──────────────
let _killothersBl       = new Set();
let _killothersBlPkgs   = [];
let _killothersBlQuery  = '';
let _killothersBlLoaded = false;
const FALLBACK_ICON = `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='48' height='48'><rect width='48' height='48' rx='12' fill='%23ffffff10'/><text x='24' y='33' font-size='22' text-anchor='middle' fill='%23ffffff55' font-family='sans-serif'>📦</text></svg>`;

// All packages split into user / system (populated by loadAppList)
let _userPkgs   = [];
let _systemPkgs = [];
let _activeTab  = 'user'; // 'user' | 'system'

async function loadAppList() {
  const container = document.getElementById('app-list-container');
  if (!container) return;
  container.innerHTML = '<span class="list-placeholder mono">Loading…</span>';

  // ── All fetches in one parallel batch ──────────────────────────────────────
  // ── Fetch packages + per-app configs in parallel ──────────────────────────
  // Use separate -3 and -s calls — most reliable cross-ROM method
  const [userRaw, sysRaw, configuredRaw] = await Promise.all([
    exec(`pm list packages -3 2>/dev/null | cut -d: -f2 | sort`, 8000),
    exec(`pm list packages -s 2>/dev/null | cut -d: -f2 | sort`, 8000),
    exec(
      `cd ${RR_DIR} 2>/dev/null || exit 0; ` +
      `for f in *.mode *.bright *.vol *.forcedark *.sat *.hvol_on *.screentimeout; do ` +
      `  [ -f "$f" ] || continue; ` +
      `  echo "\${f%.*}"; ` +
      `done | sort -u`
    ),
  ]);

  _userPkgs   = userRaw.trim().split('\n').filter(Boolean);
  _systemPkgs = sysRaw.trim().split('\n').filter(Boolean);

  configuredPkgs.clear();
  configuredRaw.trim().split('\n').filter(Boolean).forEach(p => configuredPkgs.add(p));

  // ── Encore gamelist — independent, errors don't block the list ──────────
  await _loadEncoreGamelist();

  _updateTabCounts();
  renderAppTab(_activeTab);

  // Fetch real labels from device in background — updates DOM live as results come in
  const allPkgs = [...new Set([..._userPkgs, ..._systemPkgs])];
  fetchAppLabels(allPkgs);
}

/**
 * Loads /data/adb/.config/encore/config.json into _encoreGlobalCfg.
 * Only field currently used: preferences.enforce_lite_mode (boolean).
 * Returns true on success, false if file missing/invalid (defaults applied).
 */
async function _loadEncoreConfig() {
  try {
    const raw = (await exec(`cat ${ENCORE_CONFIG_JSON} 2>/dev/null || echo '__MISSING__'`)).trim();
    if (raw === '__MISSING__' || raw === '') {
      _encoreGlobalCfg = { preferences: { enforce_lite_mode: false } };
      return false; // Encore may not be installed, treat as disabled
    }
    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('config.json root is not an object');
    }
    // Normalise — ensure preferences object exists
    _encoreGlobalCfg = {
      preferences: {
        enforce_lite_mode:      !!(parsed?.preferences?.enforce_lite_mode),
        use_device_mitigation:  !!(parsed?.preferences?.use_device_mitigation),
        log_level:              parsed?.preferences?.log_level ?? 3,
      }
    };
    return true;
  } catch (e) {
    console.warn('[encore] Failed to load config.json:', e.message);
    _encoreGlobalCfg = { preferences: { enforce_lite_mode: false } };
    return false;
  }
}

/**
 * Loads /data/adb/.config/encore/gamelist.json into _encoreGamelist + encorePkgs.
 * Validates JSON structure, falls back to current in-memory state on failure.
 * Returns true on success, false on error.
 */
async function _loadEncoreGamelist() {
  try {
    const raw = (await exec(`cat ${ENCORE_GAMELIST} 2>/dev/null || echo '__MISSING__'`)).trim();

    // File missing — treat as empty (Encore may not be installed)
    if (raw === '__MISSING__' || raw === '') {
      _encoreGamelist = {};
      encorePkgs.clear();
      return true;
    }

    const parsed = JSON.parse(raw);

    // Validate: must be a plain object, values must have the expected shape
    if (typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('gamelist.json root is not an object');
    }

    // Sanitise: strip any keys whose values aren't objects (defensive against corruption)
    const clean = {};
    for (const [pkg, cfg] of Object.entries(parsed)) {
      if (pkg && typeof cfg === 'object' && cfg !== null && !Array.isArray(cfg)) {
        clean[pkg] = {
          lite_mode:  !!cfg.lite_mode,
          enable_dnd: !!cfg.enable_dnd
        };
      }
    }

    _encoreGamelist = clean;
    encorePkgs.clear();
    Object.keys(clean).forEach(p => encorePkgs.add(p));
    return true;

  } catch (e) {
    console.warn('[encore] Failed to load gamelist.json:', e.message);
    // Keep whatever was in memory — don't wipe it on a transient read error
    return false;
  }
}

function _updateTabCounts() {
  const isAnyCfg = p => configuredPkgs.has(p) || encorePkgs.has(p);
  // Count must exactly match what renderAppTab('configured') renders
  const cfgUser = _userPkgs.filter(p => isAnyCfg(p) && !_isGame(p));
  const cfgSys  = _systemPkgs.filter(p => isAnyCfg(p) && !_isGame(p));
  const cfgTotal = cfgUser.length + cfgSys.length;

  const cu = document.getElementById('tab-count-user');
  const cs = document.getElementById('tab-count-system');
  const cc = document.getElementById('tab-count-configured');
  if (cu) cu.textContent = _userPkgs.filter(p => !isAnyCfg(p) && !_isGame(p)).length;
  if (cs) cs.textContent = _systemPkgs.filter(p => !isAnyCfg(p) && !_isGame(p)).length;
  if (cc) cc.textContent = cfgTotal;
}

function renderAppTab(tab) {
  _activeTab = tab;
  const container = document.getElementById('app-list-container');
  if (!container) return;

  document.querySelectorAll('.app-tab').forEach(btn => {
    const active = btn.dataset.tab === tab;
    btn.classList.toggle('app-tab--active', active);
    btn.setAttribute('aria-selected', active ? 'true' : 'false');
  });

  const frag = document.createDocumentFragment();

  if (tab === 'user') {
    const pkgs = _sortAZ(_userPkgs.filter(p => !configuredPkgs.has(p) && !_isGame(p)));
    if (pkgs.length > 0) {
      frag.appendChild(makeListDivider(`👤 USER APPS (${pkgs.length})`, 'apps'));
      pkgs.forEach(pkg => buildAppRow(pkg, frag));
    } else {
      const s = document.createElement('span');
      s.className = 'list-placeholder mono'; s.textContent = 'No user apps found';
      frag.appendChild(s);
    }

  } else if (tab === 'system') {
    const pkgs = _sortAZ(_systemPkgs.filter(p => !configuredPkgs.has(p) && !_isGame(p)));
    if (pkgs.length > 0) {
      frag.appendChild(makeListDivider(`⚙ SYSTEM APPS (${pkgs.length})`, 'apps'));
      pkgs.forEach(pkg => buildAppRow(pkg, frag));
    } else {
      const s = document.createElement('span');
      s.className = 'list-placeholder mono'; s.textContent = 'No system apps found';
      frag.appendChild(s);
    }

  } else if (tab === 'configured') {
    const isAnyCfg = p => configuredPkgs.has(p) || encorePkgs.has(p);
    const cfgUser = _sortAZ(_userPkgs.filter(p => isAnyCfg(p) && !_isGame(p)));
    const cfgSys  = _sortAZ(_systemPkgs.filter(p => isAnyCfg(p) && !_isGame(p)));
    if (cfgUser.length > 0) {
      frag.appendChild(makeListDivider(`⚙️ CONFIGURED · USER (${cfgUser.length})`, 'cfg-user'));
      cfgUser.forEach(pkg => buildAppRow(pkg, frag));
    }
    if (cfgSys.length > 0) {
      frag.appendChild(makeListDivider(`⚙️ CONFIGURED · SYSTEM (${cfgSys.length})`, 'cfg-system'));
      cfgSys.forEach(pkg => buildAppRow(pkg, frag));
    }
    if (!cfgUser.length && !cfgSys.length) {
      const s = document.createElement('span');
      s.className = 'list-placeholder mono'; s.textContent = 'No configured apps yet';
      frag.appendChild(s);
    }
  }

  _animList(container);
  container.replaceChildren(frag);
  loadVisibleIcons();
}
document.addEventListener('click', e => {
  const tab = e.target.closest('.app-tab[data-tab]');
  if (tab) renderAppTab(tab.dataset.tab);
});

function makeListDivider(label, section='') {
  const el = document.createElement('div');
  el.className = 'list-divider list-divider--collapsible';
  el.dataset.section = section;
  el.dataset.collapsed = 'false';
  el.innerHTML = `<span class="divider-text mono">${label}</span><span class="divider-arrow" aria-hidden="true"><svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="6" stroke="currentColor" stroke-width="1.4"/><polyline points="4.5,6 7,8.5 9.5,6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></span>`;
  el.addEventListener('click', () => toggleSection(el));
  return el;
}

function toggleSection(dividerEl) {
  const collapsed = dividerEl.dataset.collapsed === 'true';
  dividerEl.dataset.collapsed = collapsed ? 'false' : 'true';
  let sib = dividerEl.nextElementSibling;
  while (sib && sib.classList.contains('list-item')) {
    sib.style.display = collapsed ? '' : 'none';
    sib = sib.nextElementSibling;
  }
  if (collapsed) loadVisibleIcons();
}

/* ── App label lookup map ────────────────────────────────────
   Maps package names → human-readable display names.
   Falls back to smart package parsing if not found.
   ────────────────────────────────────────────────────────── */
const APP_NAMES = {
  // ── Social / Messaging ──
  'com.facebook.katana':'Facebook','com.facebook.lite':'Facebook Lite',
  'com.facebook.orca':'Messenger','com.facebook.mlite':'Messenger Lite',
  'com.instagram.android':'Instagram','com.whatsapp':'WhatsApp',
  'com.whatsapp.w4b':'WhatsApp Business','com.twitter.android':'Twitter / X',
  'com.zhiliaoapp.musically':'TikTok','com.ss.android.ugc.trill':'TikTok',
  'com.snapchat.android':'Snapchat','com.pinterest':'Pinterest',
  'com.linkedin.android':'LinkedIn','com.reddit.frontpage':'Reddit',
  'com.tumblr':'Tumblr','com.discord':'Discord',
  'org.telegram.messenger':'Telegram','org.telegram.messenger.web':'Telegram X',
  'com.viber.voip':'Viber','com.skype.raider':'Skype',
  'com.microsoft.teams':'Microsoft Teams','com.slack':'Slack',
  'us.zoom.videomeetings':'Zoom','com.google.android.talk':'Google Chat',
  'com.imo.android.imoim':'imo','com.bsb.hike':'Hike',
  'jp.naver.line.android':'LINE','com.kakao.talk':'KakaoTalk',
  'com.wechat.android':'WeChat','com.tencent.mm':'WeChat',
  'com.truecaller':'Truecaller','com.hike.chat.stickers':'Hike',
  'com.bereal.android':'BeReal',
  // ── Google Apps ──
  'com.google.android.gm':'Gmail','com.google.android.youtube':'YouTube',
  'com.google.android.apps.youtube.music':'YouTube Music',
  'com.google.android.maps':'Google Maps','com.google.android.apps.maps':'Google Maps',
  'com.google.android.googlequicksearchbox':'Google','com.google.android.apps.nexuslauncher':'Pixel Launcher',
  'com.google.android.launcher':'Google Launcher','com.google.android.apps.photos':'Google Photos',
  'com.google.android.apps.docs':'Google Docs','com.google.android.apps.sheets':'Google Sheets',
  'com.google.android.apps.slides':'Google Slides','com.google.android.apps.drive':'Google Drive',
  'com.google.android.keep':'Google Keep','com.google.android.calendar':'Google Calendar',
  'com.google.android.deskclock':'Google Clock','com.google.android.calculator':'Google Calculator',
  'com.google.android.apps.translate':'Google Translate',
  'com.google.android.apps.classroom':'Google Classroom',
  'com.google.android.apps.meetings':'Google Meet','com.google.android.apps.tachyon':'Google Meet',
  'com.google.android.gms':'Google Play Services','com.android.vending':'Google Play Store',
  'com.google.android.apps.turbo':'Device Health Services',
  'com.google.android.apps.subscriptions.red':'YouTube Premium',
  'com.google.android.apps.podcasts':'Google Podcasts',
  'com.google.android.apps.fitness':'Google Fit',
  'com.google.android.apps.safetyhub':'Personal Safety',
  'com.google.android.apps.wallpaper':'Wallpaper & Style',
  'com.google.android.apps.recorder':'Recorder',
  'com.google.android.apps.nbu.files':'Files by Google',
  'com.google.android.apps.chromecast.app':'Google Home',
  // ── Browsers ──
  'com.android.chrome':'Chrome','com.chrome.beta':'Chrome Beta',
  'org.mozilla.firefox':'Firefox','org.mozilla.firefox_beta':'Firefox Beta',
  'com.opera.browser':'Opera','com.opera.mini.native':'Opera Mini',
  'com.opera.gx.mobile':'Opera GX','com.brave.browser':'Brave Browser',
  'com.microsoft.emmx':'Microsoft Edge','com.UCMobile.intl':'UC Browser',
  'com.kiwibrowser.browser':'Kiwi Browser','com.sec.android.app.sbrowser':'Samsung Internet',
  'com.mi.globalbrowser':'Mi Browser','org.adblockplus.browser':'Adblock Browser',
  'com.vivaldi.browser':'Vivaldi','com.yandex.browser':'Yandex Browser',
  // ── Streaming / Entertainment ──
  'com.netflix.mediaclient':'Netflix','com.spotify.music':'Spotify',
  'com.amazon.avod.thirdpartyclient':'Amazon Prime Video',
  'com.disney.disneyplus':'Disney+','com.hbo.hbonow':'HBO Max / Max',
  'com.apple.android.music':'Apple Music','com.soundcloud.android':'SoundCloud',
  'com.deezer.android':'Deezer','com.tidal.android':'Tidal',
  'tv.twitch.android.app':'Twitch','com.google.android.youtube.tv':'YouTube TV',
  'com.hulu.plus':'Hulu','com.peacocktv.peacockandroid':'Peacock',
  'com.crunchyroll.crunchyroid':'Crunchyroll','com.funimation.android':'Funimation',
  'com.vimeo.android.videoapp':'Vimeo','com.dailymotion.dailymotion':'Dailymotion',
  'ph.com.abs-cbn.anc':'ANC','com.pldt.cignal':'Cignal Play',
  'com.mobitv.android.tv':'Cignal','ph.ktx.android.vivamax':'Vivamax',
  // ── Games ──
  'com.mobile.legends':'Mobile Legends','com.mobilelegends.mi':'Mobile Legends',
  'com.riotgames.league.wildrift':'Wild Rift',
  'com.activision.callofduty.shooter':'Call of Duty Mobile',
  'com.tencent.tmgp.pubgmhd':'PUBG Mobile','com.pubg.krmobile':'PUBG Mobile KR',
  'com.pubg.imobile':'PUBG Mobile','com.vng.pubgmobile':'PUBG Mobile VN',
  'com.garena.freefire':'Free Fire','com.dts.freefireth':'Free Fire Thailand',
  'com.garena.freefireth':'Free Fire Thailand',
  'com.epicgames.fortnite':'Fortnite',
  'com.supercell.clashofclans':'Clash of Clans',
  'com.supercell.clashroyale':'Clash Royale',
  'com.supercell.brawlstars':'Brawl Stars',
  'com.supercell.hayday':'Hay Day',
  'com.king.candycrushsaga':'Candy Crush Saga',
  'com.king.candycrushsodasaga':'Candy Crush Soda',
  'com.rovio.angrybirdsreloaded':'Angry Birds Reloaded',
  'com.kiloo.subwaysurf':'Subway Surfers',
  'com.imangi.templerun2':'Temple Run 2',
  'com.ea.game.pvzfree_row':'Plants vs Zombies',
  'com.ea.games.r3_row':'Real Racing 3',
  'com.ea.gp.jstar':'EA Sports FC Mobile',
  'com.ea.gp.fifamobile':'EA Sports FC Mobile',
  'com.konami.pesam':'eFootball','com.konami.efootball':'eFootball',
  'com.gamedevltd.modernstrike':'Modern Strike Online',
  'com.gameloft.android.ANMP.GloftCRHM':'Asphalt 9',
  'com.gameloft.android.ANMP.GloftA8HM':'Asphalt 8',
  'com.nianticlabs.pokemongo':'Pokémon GO',
  'jp.pokemon.pokemonunite':'Pokémon UNITE',
  'com.YoStarEN.AzurLane':'Azur Lane','com.YoStarEN.Arknights':'Arknights',
  'com.hypergryph.arknights':'Arknights CN',
  'com.miHoYo.GenshinImpact':'Genshin Impact',
  'com.HoYoverse.GenshinImpactEpic':'Genshin Impact',
  'com.miHoYo.bh3oversea':'Honkai Impact 3rd',
  'com.HoYoverse.StarRailEpic':'Honkai: Star Rail',
  'com.miHoYo.hkrpgoversea':'Honkai: Star Rail',
  'com.netease.lztgglobal':'Knives Out','com.netease.lztg':'Knives Out',
  'com.netease.mrzhna':'Rules of Survival',
  'com.nearme.game.platformen':'OPPO Game Center',
  'com.tencent.ig':'PUBG Mobile India',
  'com.tencent.tmgp.cod':'Call of Duty: Warzone Mobile',
  'com.tencent.tmgp.sgame':'Honor of Kings','com.rekoo.pubsm':'PUBG Mobile',
  'com.levelinfinite.pgr.google':'Punishing: Gray Raven',
  'com.vng.mlbbvng':'Mobile Legends VN',
  'com.userjoy.kotz.sea':'King of Thieves',
  'com.blizzard.diablo.immortal':'Diablo Immortal',
  'com.pixonic.wwr':'War Robots',
  'com.mojang.minecraftpe':'Minecraft','com.mojang.minecrafttrialpe':'Minecraft Trial',
  'com.roblox.client':'Roblox',
  'com.nintendo.zara':'Mario Kart Tour',
  'com.nintendo.zasa':'Animal Crossing: Pocket Camp',
  'com.nintendo.zagg':'Fire Emblem Heroes',
  'com.nintendo.zaba':'Super Mario Run',
  'com.gungho.pad.ios':'Puzzle & Dragons',
  'jp.co.ponos.battlecats':'Battle Cats',
  'com.yuzu.ninjas.clash':'Ninja Warriors',
  'com.square_enix.android_googleplay.ffbe':'FFBE: War of the Visions',
  'com.square_enix.android_googleplay.FFBEWW':'FFBE: War of the Visions',
  'com.square_enix.android_googleplay.opera':'Opera Omnia',
  'com.bandainamcoent.dblegends_ww':'Dragon Ball Legends',
  'com.bandainamcoent.dbzdokkan_ww':'Dragon Ball Z Dokkan',
  'com.namcobandaisgames.soulscaliburlostworlds':'Soulcalibur: Lost Swords',
  'com.konami.castlevania.sos':'Castlevania: SoS',
  'com.capcom.MHNowApp':'Monster Hunter Now',
  'com.square_enix.android_googleplay.symfoniaR':'Symfonía Rhapsodía',
  'jp.gungho.toram':'Toram Online',
  'com.zloong.sea.jxqy':'Swordsman Online',
  // ── Utilities ──
  'com.cleanmaster.mguard':'Clean Master',
  'com.mobile.legends.com':'Mobile Legends',
  'com.tencent.ig':'PUBG Mobile India',
  'com.psiphon3':'Psiphon','com.psiphon3.subscription':'Psiphon Pro',
  'org.hola.unlimited.freevpn':'Hola VPN','com.nordvpn.android':'NordVPN',
  'com.expressvpn.vpn':'ExpressVPN','com.privateinternetaccess.android':'PIA VPN',
  'com.surfshark.vpnclient.android':'Surfshark VPN',
  'com.duolingo':'Duolingo','com.google.android.apps.translate':'Google Translate',
  'com.shazam.android':'Shazam',
  'com.adobe.reader':'Adobe Acrobat','com.microsoft.office.word':'Microsoft Word',
  'com.microsoft.office.excel':'Microsoft Excel',
  'com.microsoft.office.powerpoint':'Microsoft PowerPoint',
  'com.microsoft.office.outlook':'Outlook',
  'com.microsoft.launcher':'Microsoft Launcher',
  'com.microsoft.bing':'Bing','com.microsoft.cortana':'Cortana',
  'com.google.android.apps.authenticator2':'Google Authenticator',
  'com.authy.authy':'Authy','com.microsoft.authenticator':'Microsoft Authenticator',
  'com.lastpass.lpandroid':'LastPass','com.dashlane':'Dashlane',
  'com.onepassword.android':'1Password',
  'com.dropbox.android':'Dropbox','com.box.android':'Box',
  'com.evernote':'Evernote','com.microsoft.office.onenote':'OneNote',
  'com.todoist.android.Todoist':'Todoist',
  'com.anydo':'Any.do','com.ticktick.task':'TickTick',
  'com.notion.id':'Notion','com.airtable.airtable':'Airtable',
  'com.trello':'Trello',
  // ── Banking / Finance ──
  'com.gcash.android':'GCash','com.paymaya':'Maya',
  'com.unionbankph.retail':'UnionBank','com.bpi.mobile':'BPI Mobile',
  'com.metrobank.android':'Metrobank','com.rcbc.rcbcbanker':'RCBC Diskartech',
  'com.bdo.retail':'BDO Online','com.landbank.android':'Landbank Mobile',
  'com.paypal.android.p2pmobile':'PayPal',
  'com.google.android.apps.walletnfcrel':'Google Wallet',
  'com.shopee.ph':'Shopee','com.lazada.android':'Lazada',
  'com.tokopedia.tkpd':'Tokopedia','com.gojek.app':'Gojek',
  'com.grabtaxi.passenger':'Grab','com.grab.grabpassenger':'Grab',
  'com.shopback.app':'ShopBack',
  // ── Camera / Photo / Video ──
  'com.google.android.GoogleCamera':'Google Camera',
  'com.instagram.android':'Instagram',
  'com.vsco.cam':'VSCO','com.adobe.lrmobile':'Lightroom',
  'com.adobe.psmobile':'Photoshop Express','com.picsart.studio':'PicsArt',
  'com.snow.alterme':'SNOW','com.bitmoji.android':'Bitmoji',
  'com.meitu.mtxx':'MeituPic','com.perfect365.perfect365':'Perfect365',
  'com.picart.pro':'Pic Art','com.inshot.android':'InShot',
  'com.videoleap':'Videoleap','com.capcut.editor':'CapCut',
  'com.lemon.lvoverseas':'CapCut','com.zhiliaoapp.musically':'TikTok',
  // ── Music / Audio ──
  'com.resso.android':'Resso','com.joox.client':'JOOX',
  'com.anghami':'Anghami','com.bandcamp.android':'Bandcamp',
  'com.shazam.android':'Shazam','com.musixmatch.android.mxm':'Musixmatch',
  // ── Root / System Tools ──
  'com.topjohnwu.magisk':'Magisk','io.github.huskydg.magisk':'Kitsune Magisk',
  'io.github.kernelsu':'KernelSU','me.bmax.apatch':'APatch',
  'com.termux':'Termux','jackpal.androidterm':'Terminal Emulator',
  'eu.chainfire.supersu':'SuperSU','com.koushikdutta.superuser':'Superuser',
  'com.noshufou.android.su':'Superuser','com.jrummy.root.browserfree':'Root Browser',
  'com.speedsoftware.rootexplorer':'Root Explorer',
  'com.ghisler.android.TotalCommander':'Total Commander',
  'com.rarlab.rar':'RAR','com.google.android.apps.nbu.files':'Files by Google',
  'com.mi.android.globalFileexplorer':'Mi File Manager',
  'com.samsung.android.mobileservice':'Samsung Services',
  'com.sec.android.easyMover':'Samsung Smart Switch',
  // ── Shopping / Delivery ──
  'ph.foodpanda.main':'foodpanda','com.jora.food':'Jora Food',
  'com.ubercab.eats':'Uber Eats','com.doordash.driverapp':'DoorDash',
  'com.ss.android.ugc.aweme':'Camera',
  'com.aimp.player':'AIMP',
  'com.mcdonalds.app':'McDonald\'s','com.jollibee.app':'Jollibee',
  // ── Maps / Navigation ──
  'com.waze':'Waze','com.here.app.maps':'HERE Maps',
  'com.sygic.truck':'Sygic','com.tomtom.android.maps':'TomTom',
  // ── News / Reading ──
  'com.google.android.apps.magazines':'Google News',
  'flipboard.app':'Flipboard','com.medium.reader':'Medium',
  // ── Health / Fitness ──
  'com.nike.plusgps':'Nike Run Club','com.strava':'Strava',
  'com.myfitnesspal.android':'MyFitnessPal',
  'com.samsung.android.shealth':'Samsung Health',
  'com.google.android.apps.fitness':'Google Fit',

  // ── Android Core System ──
  'android':'Android System',
  'com.android.systemui':'System UI',
  'com.android.settings':'Settings',
  'com.android.phone':'Phone',
  'com.android.dialer':'Dialer',
  'com.android.contacts':'Contacts',
  'com.android.mms':'Messaging',
  'com.android.messaging':'Messages',
  'com.android.launcher':'Launcher',
  'com.android.launcher2':'Launcher',
  'com.android.launcher3':'Launcher',
  'com.android.packageinstaller':'Package Installer',
  'com.android.providers.telephony':'Telephony Provider',
  'com.android.providers.contacts':'Contacts Provider',
  'com.android.providers.media':'Media Provider',
  'com.android.providers.downloads':'Download Manager',
  'com.android.providers.calendar':'Calendar Provider',
  'com.android.providers.settings':'Settings Provider',
  'com.android.providers.blockednumber':'Blocked Numbers',
  'com.android.server.telecom':'Telecom Services',
  'com.android.bluetooth':'Bluetooth',
  'com.android.nfc':'NFC',
  'com.android.wifi':'Wi-Fi Service',
  'com.android.vpndialogs':'VPN Dialogs',
  'com.android.keychain':'Key Chain',
  'com.android.certinstaller':'Certificate Installer',
  'com.android.inputmethod.latin':'AOSP Keyboard',
  'com.android.camera':'Camera',
  'com.android.camera2':'Camera',
  'com.android.gallery3d':'Gallery',
  'com.android.music':'Music',
  'com.android.deskclock':'Clock',
  'com.android.calculator2':'Calculator',
  'com.android.calendar':'Calendar',
  'com.android.email':'Email',
  'com.android.browser':'Browser',
  'com.android.chrome':'Chrome',
  'com.android.documentsui':'Files',
  'com.android.filemanager':'File Manager',
  'com.android.externalstorage':'External Storage',
  'com.android.backupconfirm':'Backup',
  'com.android.storagemanager':'Storage Manager',
  'com.android.permissioncontroller':'Permission Controller',
  'com.android.carrierconfig':'Carrier Config',
  'com.android.captiveportallogin':'Captive Portal Login',
  'com.android.networkstack':'Network Stack',
  'com.android.networkstack.tethering':'Tethering',
  'com.android.hotspot2':'Wi-Fi Passpoint',
  'com.android.managedprovisioning':'Managed Provisioning',
  'com.android.wallpaper':'Wallpaper',
  'com.android.wallpaper.livepicker':'Live Wallpaper Picker',
  'com.android.soundrecorder':'Sound Recorder',
  'com.android.printspooler':'Print Spooler',
  'com.android.stk':'SIM Toolkit',
  'com.android.sharedstoragebackup':'Shared Storage Backup',
  'com.android.proxyhandler':'Proxy Handler',
  'com.android.location.fused':'Fused Location',
  'com.android.dynsystem':'Dynamic System',
  'com.android.statementservice':'Statement Service',
  'com.android.webview':'Android WebView',
  'com.google.android.webview':'Android WebView',
  'com.android.htmlviewer':'HTML Viewer',
  // ── Google System Services ──
  'com.google.android.gms':'Google Play Services',
  'com.google.android.gsf':'Google Services Framework',
  'com.google.android.gsf.login':'Google Account',
  'com.google.android.syncadapters.contacts':'Google Contacts Sync',
  'com.google.android.syncadapters.calendar':'Google Calendar Sync',
  'com.google.android.backuptransport':'Google Backup Transport',
  'com.google.android.configupdater':'Config Updater',
  'com.google.android.feedback':'Google Feedback',
  'com.google.android.packageinstaller':'Package Installer',
  'com.google.android.permissioncontroller':'Permission Controller',
  'com.google.android.ext.services':'Android Services Library',
  'com.google.android.ext.shared':'Android Shared Library',
  'com.google.android.overlay.gmsconfig':'GMS Config',
  'com.google.android.setupwizard':'Setup Wizard',
  'com.google.android.onetimeinitializer':'One Time Initializer',
  'com.google.android.partnersetup':'Partner Setup',
  'com.google.android.tag':'Tags',
  'com.google.android.tts':'Google TTS',
  'com.google.android.inputmethod.latin':'Gboard',
  'com.google.android.inputmethod.pinyin':'Google Pinyin',
  'com.google.android.marvin.talkback':'TalkBack',
  'com.google.android.accessibility.suite':'Accessibility Suite',
  'com.google.android.apps.wellbeing':'Digital Wellbeing',
  'com.google.android.apps.work.oobconfig':'Work Profile Setup',
  'com.google.android.cellbroadcastreceiver':'Cell Broadcast Receiver',
  'com.google.android.cellbroadcastservice':'Cell Broadcast Service',
  'com.google.android.modulemetadata':'Module Metadata',
  'com.google.android.networkstack':'Google Network Stack',
  'com.google.android.networkstack.permissionconfig':'Network Permission Config',
  // ── Samsung System ──
  'com.samsung.android.app.settings.bixby':'Bixby Settings',
  'com.samsung.android.bixby.agent':'Bixby',
  'com.samsung.android.bixby.wakeup':'Bixby Wake-Up',
  'com.samsung.android.bixby.service':'Bixby Service',
  'com.samsung.android.app.spage':'Bixby Home',
  'com.samsung.android.samsungpass':'Samsung Pass',
  'com.samsung.android.samsungpassautofill':'Samsung Pass Autofill',
  'com.samsung.android.securitylogagent':'Security Log Agent',
  'com.samsung.android.knox.analytics.uploader':'Knox Analytics',
  'com.samsung.android.knox.containeragent':'Knox Container',
  'com.samsung.android.voc':'Samsung Members',
  'com.samsung.android.app.omcagent':'OMC Agent',
  'com.samsung.android.themecenter':'Theme Center',
  'com.samsung.android.app.galaxyfinder':'Galaxy Find',
  'com.samsung.android.app.smartcapture':'Smart Capture',
  'com.samsung.android.app.cocktailbarservice':'Edge Panel Service',
  'com.samsung.android.lool':'Samsung Find My Mobile',
  'com.samsung.android.fmm':'Find My Mobile',
  'com.samsung.android.dialer':'Samsung Phone',
  'com.samsung.android.contacts':'Samsung Contacts',
  'com.samsung.android.messaging':'Samsung Messages',
  'com.samsung.android.calendar':'Samsung Calendar',
  'com.samsung.android.app.notes':'Samsung Notes',
  'com.samsung.android.email.provider':'Samsung Email',
  'com.samsung.android.gallery3d':'Samsung Gallery',
  'com.samsung.android.app.clockpackage':'Samsung Clock',
  'com.samsung.android.calculator':'Samsung Calculator',
  'com.samsung.android.app.soundpicker':'Sound Picker',
  'com.samsung.android.app.aodservice':'AOD Service',
  'com.samsung.android.da.daagent':'Device Agent',
  'com.samsung.android.game.gametools':'Game Launcher',
  'com.samsung.android.game.gamehome':'Game Hub',
  'com.samsung.android.smartswitchassistant':'Smart Switch Assistant',
  'com.samsung.android.browser':'Samsung Internet',
  'com.samsung.android.app.sbrowser':'Samsung Internet',
  'com.samsung.android.video':'Samsung Video',
  'com.samsung.android.music':'Samsung Music',
  'com.samsung.android.spay':'Samsung Pay',
  'com.samsung.android.scloud':'Samsung Cloud',
  'com.samsung.android.kgclient':'Knox Guard',
  // ── Xiaomi / MIUI System ──
  'com.miui.home':'MIUI Launcher',
  'com.miui.securitycenter':'Security Center',
  'com.miui.miservice':'Mi Service',
  'com.miui.systemAdSolution':'MIUI Ad Service',
  'com.miui.analytics':'MIUI Analytics',
  'com.miui.cloudservice':'Mi Cloud Service',
  'com.miui.cloudbackup':'Mi Cloud Backup',
  'com.miui.cloudgames':'Mi Games Cloud',
  'com.miui.weather2':'Mi Weather',
  'com.miui.calculator':'Mi Calculator',
  'com.miui.calendar':'Mi Calendar',
  'com.miui.notes':'Mi Notes',
  'com.miui.player':'Mi Music',
  'com.miui.video':'Mi Video',
  'com.miui.gallery':'Mi Gallery',
  'com.miui.compass':'Compass',
  'com.miui.screenrecorder':'Screen Recorder',
  'com.miui.cleaner':'Phone Cleaner',
  'com.miui.downloadprovider':'Mi Download Provider',
  'com.miui.packageinstaller':'Mi Package Installer',
  'com.miui.securityadd':'Security Add-on',
  'com.miui.antivirus':'Mi Security',
  'com.miui.backup':'Mi Backup',
  'com.miui.powerkeeper':'Power Keeper',
  'com.miui.daemon':'MIUI Daemon',
  'com.miui.rom':'MIUI Updater',
  'com.miui.updater':'MIUI Updater',
  'com.miui.contentcatcher':'Content Catcher',
  'com.mi.health':'Mi Health',
  'com.xiaomi.account':'Xiaomi Account',
  'com.xiaomi.market':'Mi App Store',
  'com.xiaomi.mipush.sdk.server':'Mi Push',
  'com.xiaomi.find':'Find Device',
  'com.xiaomi.bluetooth':'Xiaomi Bluetooth',
  'com.xiaomi.scanner':'Mi Scanner',
  'com.xiaomi.smarthome':'Mi Home',
  // ── OPPO / Realme / OnePlus System ──
  'com.coloros.launcher':'ColorOS Launcher',
  'com.coloros.safecenter':'Security Center',
  'com.coloros.healthcheck':'Health Check',
  'com.coloros.weather2':'OPPO Weather',
  'com.coloros.calendar':'OPPO Calendar',
  'com.coloros.gallery2':'OPPO Gallery',
  'com.coloros.note':'OPPO Notes',
  'com.coloros.filemanager':'OPPO File Manager',
  'com.coloros.calculator':'OPPO Calculator',
  'com.coloros.soundrecorder':'Sound Recorder',
  'com.coloros.screenrecorder':'Screen Recorder',
  'com.coloros.phonemanager':'Phone Manager',
  'com.coloros.theme':'Theme Store',
  'com.coloros.backuprestore':'Backup & Restore',
  'com.coloros.dialer':'OPPO Phone',
  'com.coloros.mms':'OPPO Messages',
  'com.coloros.basestationscreen':'Base Station Screen',
  'com.oppo.market':'OPPO App Market',
  'com.oppo.usercenter':'OPPO Account',
  'com.oppo.games':'OPPO Game Center',
  'com.nearme.launcher':'Realme Launcher',
  'com.nearme.gamecenter':'Realme Game Center',
  'com.realme.store':'Realme Store',
  'com.oplus.appdetail':'App Detail',
  'com.oplus.games':'OPPO Gaming',
  'com.oneplus.launcher':'OxygenOS Launcher',
  'com.oneplus.theme':'OnePlus Themes',
  'com.oneplus.filemanager':'OnePlus File Manager',
  'com.oneplus.gamespace':'OnePlus Game Space',
  'com.oneplus.healthservice':'OnePlus Health',
  'com.oneplus.camera':'OnePlus Camera',
  // ── Transsion / TECNO / Itel / Infinix System ──
  'com.transsion.phonemaster':'Phone Master',
  'com.transsion.applock':'App Lock',
  'com.transsion.xlauncher':'HiOS Launcher',
  'com.itel.launcher':'Itel Launcher',
  'com.infinix.launcher':'Infinix Launcher',
  'com.tecno.launcher':'TECNO Launcher',
  'com.camon.launcher':'Camon Launcher',
  'com.transsion.camera':'Transsion Camera',
  'com.transsion.gallery':'Transsion Gallery',
  'com.transsion.filemanager':'File Manager',
  'com.transsion.contacts':'Transsion Contacts',
  'com.transsion.dialer':'Transsion Phone',
  'com.transsion.messaging':'Transsion Messages',
  'com.transsion.upgradeota':'OTA Updater',
  'com.transsion.appstore':'App Store',
  'com.transsion.aicamera':'AI Camera',
  // ── Vivo / iQOO System ──
  'com.vivo.launcher':'Vivo Launcher',
  'com.vivo.game':'Game Center',
  'com.vivo.appstore':'Vivo App Store',
  'com.vivo.account':'Vivo Account',
  'com.vivo.securedaemon':'Secure Daemon',
  'com.vivo.permissionmanager':'Permission Manager',
  'com.vivo.abe':'App Behavior Engine',
  // ── Huawei / Honor System ──
  'com.huawei.android.launcher':'Huawei Launcher',
  'com.huawei.systemmanager':'System Manager',
  'com.huawei.appmarket':'AppGallery',
  'com.huawei.hidisk':'Files',
  'com.huawei.gallery':'Gallery',
  'com.huawei.health':'Huawei Health',
  'com.huawei.hmscore':'Huawei Mobile Services',
  'com.huawei.hwid':'HUAWEI ID',
  'com.huawei.phoneservice':'Phone Service',
  'com.huawei.android.pushagent':'Push Agent',
  'com.huawei.android.thememanager':'Theme Manager',
  'com.huawei.contacts':'Huawei Contacts',
  'com.huawei.mms':'Huawei Messages',
  'com.honor.systemhealthmanager':'System Health Manager',
  // ── MediaTek / Qualcomm System ──
  'com.mediatek.camera':'MTK Camera',
  'com.mediatek.gallery3d':'MTK Gallery',
  'com.mediatek.systemupdate':'System Update',
  'com.mediatek.ims':'IMS Service',
  'com.mediatek.mtklogger':'MTK Logger',
  'com.mediatek.duraspeed':'DuraSpeed',
  'com.mediatek.engineermode':'Engineer Mode',
  'com.qualcomm.qti.qms':'Qualcomm Services',
  'com.qualcomm.qti.diagservice':'Diag Service',
  'com.qualcomm.telephony':'Qualcomm Telephony',
  // ── Carrier / Telecom ──
  'com.android.phone.extra':'Phone Extra',
  'com.android.ims':'IMS',
  'com.android.simappdialog':'SIM App Dialog',
  'com.android.cellbroadcastreceiver':'Cell Broadcast',
  'com.android.carrierdefaultapp':'Carrier Default App',
  'com.android.imsserviceentitlement':'IMS Service Entitlement',
  // ── Input Methods ──
  'com.swiftkey.swiftkeyapp':'SwiftKey',
  'com.microsoft.swiftkey':'SwiftKey',
  'com.touchtype.swiftkey':'SwiftKey',
  'com.google.android.inputmethod.latin':'Gboard',
  'com.samsung.android.honeyboard':'Samsung Keyboard',
  'com.miui.input.ime':'MIUI Keyboard',
  'com.baidu.input_mi':'Baidu Input',
  'com.sohu.inputmethod.sogou.xiaomi':'Sogou Input',
};

/**
 * Dynamic label cache — populated in background by fetchAppLabels().
 * Key: package name → Value: real label fetched from device via aapt/aapt2.
 */
const _dynLabelCache = {};
let   _labelFetchDone = false;

/**
 * Returns the best human-readable label for a package name.
 * Priority: 1) dynamic aapt cache  2) static APP_NAMES map  3) smart pkg parsing
 */
function getAppLabel(pkg) {
  if (_dynLabelCache[pkg]) return _dynLabelCache[pkg];
  if (APP_NAMES[pkg])      return APP_NAMES[pkg];
  // Smart fallback: skip generic segments, pick most meaningful part
  const parts = pkg.split('.');
  const skip = new Set(['com','org','net','android','google','app','apps','mobile','phone',
    'system','service','provider','manager','lite','pro','free','plus','official',
    'global','intl','www','co','inc','games','game','studio','studios','entertainment']);
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    if (!skip.has(p) && p.length > 1 && !/^\d+$/.test(p))
      return p.charAt(0).toUpperCase() + p.slice(1);
  }
  return parts[parts.length - 1];
}

/* ── Sort array of package names A–Z by display label ── */

// Trigger tab slide-in animation on list
function _animList(el) {
  if (!el) return;
  el.classList.remove('tab-anim');
  void el.offsetWidth; // reflow to restart animation
  el.classList.add('tab-anim');
}
function _sortAZ(pkgs) {
  return [...pkgs].sort((a, b) =>
    getAppLabel(a).toLowerCase().localeCompare(getAppLabel(b).toLowerCase())
  );
}

/**
 * Batch-fetches real app labels from device using aapt2/aapt.
 * Runs in background after app list loads; updates DOM item-title spans live.
 * Falls back gracefully if no aapt tool found.
 */
async function fetchAppLabels(pkgs) {
  if (_labelFetchDone || !pkgs || !pkgs.length) return;

  // Check which aapt tool is available once
  const toolRaw = await exec(
    `for t in /system/bin/aapt2 /system/bin/aapt $(which aapt2 2>/dev/null) $(which aapt 2>/dev/null); do [ -x "$t" ] && echo "$t" && break; done`
  );
  const tool = toolRaw.trim();
  if (!tool) { _labelFetchDone = true; return; } // no aapt — skip

  // Process in chunks of 20 to avoid arg-length issues
  const CHUNK = 20;
  for (let i = 0; i < pkgs.length; i += CHUNK) {
    const chunk = pkgs.slice(i, i + CHUNK);

    // Build shell: for each pkg get APK path → aapt dump → extract label
    const script = chunk.map(pkg =>
      `apk=$(pm path '${pkg}' 2>/dev/null | cut -d: -f2 | tr -d ' \\r\\n'); ` +
      `[ -n "$apk" ] && label=$('${tool}' dump badging "$apk" 2>/dev/null | grep -m1 "^application-label:" | cut -d"'" -f2 | tr -d '\\r\\n'); ` +
      `[ -n "$label" ] && echo '${pkg}|'\"$label\"`
    ).join('; ');

    const raw = await exec(script, 30000).catch(() => '');
    raw.trim().split('\n').filter(Boolean).forEach(line => {
      const sep = line.indexOf('|');
      if (sep < 0) return;
      const pkg   = line.slice(0, sep).trim();
      const label = line.slice(sep + 1).trim();
      if (!pkg || !label) return;
      _dynLabelCache[pkg] = label;

      // Live-update every visible item-title for this pkg across all lists
      document.querySelectorAll(`.list-item[data-pkg="${CSS.escape(pkg)}"] .item-title`).forEach(el => {
        el.textContent = label.toUpperCase();
      });
      document.querySelectorAll(`.app-row[data-pkg="${CSS.escape(pkg)}"] .app-name`).forEach(el => {
        el.textContent = label.toUpperCase();
      });
    });
  }
  _labelFetchDone = true;
}

function buildAppRow(pkg, parent) {
  const isConfigured = configuredPkgs.has(pkg);
  const isEncore     = encorePkgs.has(pkg);
  const name = getAppLabel(pkg).toUpperCase();
  const row  = document.createElement('div');
  row.className   = 'list-item';
  row.dataset.pkg = pkg;
  row.innerHTML = `
    <div class="item-row">
      <div class="app-icon-wrap" data-pkg="${pkg}">
        <img class="app-icon" alt="${name}">
      </div>
      <div class="item-info">
        <span class="item-title">${name}</span>
        <span class="item-desc mono">${pkg}</span>
      </div>
    </div>
    <div class="btn-row">
      ${isConfigured ? '<span class="rr-configured-badge mono">CONFIGURED</span>' : ''}
      ${isEncore ? '<span class="encore-enabled-badge mono">🍬 ENCORE</span>' : ''}
      <button class="app-gear-btn" data-gear="${pkg}" aria-label="Configure ${pkg}" style="width:32px;height:32px;border-radius:50%;background:rgba(0,0,0,0.35);border:1px solid var(--bdr);display:flex;align-items:center;justify-content:center;cursor:pointer;color:var(--a);flex-shrink:0;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.8"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
    </div>`;
  if (parent) parent.appendChild(row);
  return row;
}

function setIconSrc(img, pkg) {
  if (img.dataset.loaded) return;
  img.dataset.loaded = '1';
  const sources = [`ksu://icon/${pkg}`, `apatch://icon/${pkg}`];
  let idx = 0;
  const tryNext = () => {
    if (idx < sources.length) {
      const src = sources[idx++];
      img.onerror = tryNext;
      img.onload  = () => { img.onerror = null; img.style.opacity = '1'; };
      img.style.opacity = '0';
      img.src = src;
    } else {
      img.onerror = null;
      img.src = FALLBACK_ICON;
      img.style.opacity = '1';
    }
  };
  tryNext();
}

let iconObserver = null;
function loadVisibleIcons(containerId) {
  const container = document.getElementById(containerId || 'app-list-container');
  if (!container) return;
  // Use a per-container observer so multiple panels can coexist
  const obs = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const wrap = entry.target;
      const img  = wrap.querySelector('.app-icon');
      if (img && !img.dataset.loaded) { setIconSrc(img, wrap.dataset.pkg); obs.unobserve(wrap); }
    });
  }, { rootMargin: '160px' });
  container.querySelectorAll('.app-icon-wrap[data-pkg]').forEach(w => obs.observe(w));
  // Store on container so we can disconnect if needed
  if (container._iconObs) container._iconObs.disconnect();
  container._iconObs = obs;
}

function _noop_initAppSearch() {
  // search bars removed from panels — this function is intentionally empty
}


/* ═══════════════════════════════════════════════════════════
   § 9c  Universal Volume Lock
   ═══════════════════════════════════════════════════════════ */
let universalVolume = null; // null = not locked, 0-15 = locked value

function updateUnivVolSlider(val) {
  const slider = document.getElementById('universal-vol-slider');
  if (!slider) return;
  const pct = Math.round((val / DEVICE_MAX_VOLUME) * 100);
  slider.style.setProperty('--pct', pct + '%');
}

function renderUnivVolState() {
  const activeEl  = document.getElementById('universal-vol-active');
  const lockBtn   = document.getElementById('btn-vol-lock');
  const unlockBtn = document.getElementById('btn-vol-unlock');
  const slider    = document.getElementById('universal-vol-slider');

  if (activeEl) {
    if (universalVolume !== null) {
      activeEl.textContent = universalVolume + ' / ' + DEVICE_MAX_VOLUME;
      activeEl.className   = 'rr-status-val on';
    } else {
      activeEl.textContent = 'None';
      activeEl.className   = 'rr-status-val off';
    }
  }
  if (lockBtn)   lockBtn.textContent     = universalVolume !== null ? 'UPDATE ›' : 'LOCK ›';
  if (unlockBtn) unlockBtn.style.opacity = universalVolume !== null ? '1' : '0.35';
  if (slider && universalVolume !== null) {
    slider.max   = DEVICE_MAX_VOLUME;
    slider.value = universalVolume;
    updateUnivVolSlider(universalVolume);
  }
}

async function setUniversalVolume(val) {
  universalVolume = val;
  renderUnivVolState();
  await exec(`cmd media_session volume --stream 3 --set ${val} 2>/dev/null; true`);
  await exec(`mkdir -p /sdcard/DAVION_ENGINE && echo "${val}" > ${UNIVERSAL_VOL_FILE}`);
  setStatus(`🔊 Volume locked: ${val}`);
  showToast(`Volume locked at ${val}`, 'ENGINE', 'success', '🔊');
  autoSave();
}

async function clearUniversalVolume() {
  universalVolume = null;
  renderUnivVolState();
  await exec(`rm -f ${UNIVERSAL_VOL_FILE}`);
  setStatus('🔊 Volume lock cleared — system default restored');
  showToast('Volume lock removed', 'ENGINE', 'info', '🔓');
  autoSave();
}

async function loadUniversalVolume() {
  const saved = (await exec(`cat ${UNIVERSAL_VOL_FILE} 2>/dev/null`)).trim();
  if (saved !== '' && !isNaN(parseInt(saved))) {
    universalVolume = parseInt(saved);
  } else {
    universalVolume = null;
  }
  const slider = document.getElementById('universal-vol-slider');
  if (slider) {
    slider.max = DEVICE_MAX_VOLUME;
    if (universalVolume !== null) {
      slider.value = Math.min(universalVolume, DEVICE_MAX_VOLUME);
      updateUnivVolSlider(universalVolume);
    } else {
      // Default to current system media volume for convenience
      const cur = (await exec(`cmd media_session volume --stream 3 --get 2>/dev/null | grep -oE "[0-9]+" | tail -1`)).trim();
      const cv = parseInt(cur);
      if (!isNaN(cv) && cv >= 0 && cv <= DEVICE_MAX_VOLUME) {
        slider.value = cv;
        updateUnivVolSlider(cv);
      } else {
        slider.value = Math.round(DEVICE_MAX_VOLUME / 2);
        updateUnivVolSlider(Math.round(DEVICE_MAX_VOLUME / 2));
      }
    }
  }
  renderUnivVolState();
}

function initUniversalVolume() {
  const slider = document.getElementById('universal-vol-slider');
  let _univVolDebounce = null;

  function _setVolSlider(v) {
    if (!slider) return;
    v = Math.max(0, Math.min(DEVICE_MAX_VOLUME || 15, v));
    slider.value = v;
    updateUnivVolSlider(v);
    const activeEl = document.getElementById('universal-vol-active');
    if (activeEl) { activeEl.textContent = v + ' / ' + (DEVICE_MAX_VOLUME || 15); activeEl.className = 'rr-status-val on'; }
    clearTimeout(_univVolDebounce);
    _univVolDebounce = setTimeout(() => {
      exec(`cmd media_session volume --stream 3 --set ${v} 2>/dev/null; true`);
    }, 60);
  }

  slider?.addEventListener('input', () => _setVolSlider(parseInt(slider.value)));

  // − / + buttons (step = 1)
  document.getElementById('vol-dec-btn')?.addEventListener('click', () => _setVolSlider(parseInt(slider?.value || 8) - 1));
  document.getElementById('vol-inc-btn')?.addEventListener('click', () => _setVolSlider(parseInt(slider?.value || 8) + 1));

  document.getElementById('btn-vol-lock')?.addEventListener('click', async () => {
    const v = parseInt(document.getElementById('universal-vol-slider')?.value ?? 8);
    await setUniversalVolume(v);
  });

  document.getElementById('btn-vol-unlock')?.addEventListener('click', async () => {
    if (universalVolume !== null) await clearUniversalVolume();
  });

  loadUniversalVolume();
}

/* ═══════════════════════════════════════════════════════════
   UNIVERSAL SCREEN OFF TIMEOUT
   Values mirror Android Settings → Display → Screen Timeout
   Stored in /sdcard/GovThermal/config/screen_timeout.txt
   Applied via: settings put system screen_off_timeout <ms>
   Per-app stored in $RR_DIR/$pkg.screentimeout
   ═══════════════════════════════════════════════════════════ */
const SCREEN_TIMEOUT_FILE = `${CFG_DIR}/screen_timeout.txt`;
const SCREEN_TIMEOUT_OPTS = [
  { ms: 30000,   label: '30 SEC' },
  { ms: 60000,   label: '1 MIN'  },
  { ms: 120000,  label: '2 MIN'  },
  { ms: 300000,  label: '5 MIN'  },
  { ms: 600000,  label: '10 MIN' },
  { ms: 1200000, label: '20 MIN' },
];
let _univScreenTimeoutMs = null;

function _msToScreenLabel(ms) {
  const opt = SCREEN_TIMEOUT_OPTS.find(o => o.ms === ms);
  return opt ? opt.label : (ms > 0 ? `${Math.round(ms/60000)} MIN` : 'DEFAULT');
}

function _updateScreenTimeoutChips(containerId, activeMsOrNull) {
  document.querySelectorAll(`#${containerId} .screentimeout-chip`).forEach(chip => {
    const ms = parseInt(chip.dataset.ms);
    chip.classList.toggle('screentimeout-chip--active',
      activeMsOrNull !== null && ms === activeMsOrNull);
  });
}

async function initUniversalScreenTimeout() {
  const activeEl = document.getElementById('univ-screentimeout-active');
  const applyBtn = document.getElementById('btn-screentimeout-apply');
  const resetBtn = document.getElementById('btn-screentimeout-reset');

  // ── Load + display current state ──────────────────────────
  async function _loadState() {
    const saved = (await exec(`cat ${SCREEN_TIMEOUT_FILE} 2>/dev/null`)).trim();
    const savedMs = saved && !isNaN(parseInt(saved)) ? parseInt(saved) : null;
    _univScreenTimeoutMs = savedMs;
    if (activeEl) activeEl.textContent = savedMs ? _msToScreenLabel(savedMs) : '—';
    _updateScreenTimeoutChips('univ-screentimeout-chips', savedMs);
    // Sync selected state so APPLY button label is correct if reopened
    if (applyBtn) {
      if (savedMs) {
        applyBtn.disabled = false;
        applyBtn.textContent = `⏱ APPLY ${_msToScreenLabel(savedMs)} ›`;
      } else {
        applyBtn.disabled = true;
        applyBtn.textContent = '⏱ SELECT A DURATION ›';
      }
    }
    return savedMs;
  }

  // Reload every time the subpanel opens (so it's always fresh)
  const subpanel = document.getElementById('univ-screen-timeout-section');
  subpanel?.addEventListener('toggle', () => {
    if (subpanel.open) _loadState();
  }, { passive: true });

  // Initial load
  await _loadState();

  // ── Track selected chip ────────────────────────────────────
  // Use a module-level ref so Apply always uses the latest selection
  let _selectedMs = _univScreenTimeoutMs;

  document.getElementById('univ-screentimeout-chips')?.addEventListener('click', e => {
    const chip = e.target.closest('.screentimeout-chip');
    if (!chip) return;
    _selectedMs = parseInt(chip.dataset.ms);
    _updateScreenTimeoutChips('univ-screentimeout-chips', _selectedMs);
    if (applyBtn) {
      applyBtn.disabled = false;
      applyBtn.textContent = `⏱ APPLY ${chip.dataset.label.toUpperCase()} ›`;
    }
  }, { passive: true });

  // ── Apply ─────────────────────────────────────────────────
  applyBtn?.addEventListener('click', async () => {
    if (!_selectedMs || _selectedMs <= 0) {
      showToast('Select a duration first', 'SCREEN TIMEOUT', 'info', '⏱');
      return;
    }
    applyBtn.disabled = true;
    applyBtn.textContent = '⏱ APPLYING…';
    await exec(`settings put system screen_off_timeout ${_selectedMs} 2>/dev/null`);
    await exec(`mkdir -p ${CFG_DIR} && echo "${_selectedMs}" > ${SCREEN_TIMEOUT_FILE}`);
    _univScreenTimeoutMs = _selectedMs;
    if (activeEl) activeEl.textContent = _msToScreenLabel(_selectedMs);
    applyBtn.disabled = false;
    applyBtn.textContent = `⏱ APPLY ${_msToScreenLabel(_selectedMs)} ›`;
    showToast(`Screen timeout: ${_msToScreenLabel(_selectedMs)}`, 'SCREEN TIMEOUT', 'success', '⏱');
    autoSave();
  });

  // ── Reset ─────────────────────────────────────────────────
  resetBtn?.addEventListener('click', async () => {
    await exec('settings put system screen_off_timeout 30000 2>/dev/null');
    await exec(`rm -f ${SCREEN_TIMEOUT_FILE}`);
    _univScreenTimeoutMs = null;
    _selectedMs = null;
    _updateScreenTimeoutChips('univ-screentimeout-chips', null);
    if (activeEl) activeEl.textContent = '—';
    if (applyBtn) { applyBtn.disabled = true; applyBtn.textContent = '⏱ SELECT A DURATION ›'; }
    showToast('Screen timeout reset to system default', 'SCREEN TIMEOUT', 'info', '⏱');
    autoSave();
  });
}

/* ── Per-App Screen Timeout boot restore ── */
/* (Applied by encore_app_daemon on foreground — see saveAllConfig boot script) */

/* ── Universal slider fill sync — works for any <input type=range> ── */
function updateBrightSliderFill(val) {
  const slider = document.getElementById('popup-bright-slider');
  if (!slider) return;
  // map -1..DEVICE_MAX_BRIGHTNESS to 0..100%
  const pct = val === -1 ? 0 : Math.round((val / DEVICE_MAX_BRIGHTNESS) * 100);
  slider.style.setProperty('--pct', pct + '%');
}

/* ── Per-App Volume helpers ───────────────────────────── */
function updateVolSliderFill(val) {
  const slider = document.getElementById('popup-vol-slider');
  if (!slider) return;
  // slider min=-1 max=DEVICE_MAX_VOLUME, map to 0..100%
  const pct = val === -1 ? 0 : Math.round(((val + 1) / (DEVICE_MAX_VOLUME + 1)) * 100);
  slider.style.setProperty('--pct', pct + '%');
}

function _updatePopupSatFill(val) {
  const slider = document.getElementById('popup-sat-slider');
  if (!slider) return;
  const pct = val === -1 ? 0 : Math.round((val / 20) * 100);
  slider.style.setProperty('--pct', pct + '%');
}

/* ── Universal slider fill sync — works for any <input type=range> ── */
function _syncSliderFill(slider) {
  if (!slider) return;
  const min = parseFloat(slider.min) || 0;
  const max = parseFloat(slider.max) || 100;
  const val = parseFloat(slider.value) || 0;
  const pct = max === min ? 0 : Math.round(((val - min) / (max - min)) * 100);
  slider.style.setProperty('--pct', pct + '%');
}

/* ── Auto-wire every nexus-slider that has no manual fill handler ── */
function _initAllSliderFills() {
  document.querySelectorAll('.nexus-slider').forEach(slider => {
    _syncSliderFill(slider);
    slider.addEventListener('input', () => _syncSliderFill(slider), { passive: true });
  });
}

function initVolumeSlider() {
  const slider   = document.getElementById('popup-vol-slider');
  const valLabel = document.getElementById('popup-vol-val');
  if (!slider) return;
  slider.addEventListener('input', () => {
    const v = parseInt(slider.value);
    if (valLabel) valLabel.textContent = v === -1 ? 'Default' : v;
    updateVolSliderFill(v);
    // Live preview — set media volume immediately while dragging
    if (v >= 0) {
      exec(`media volume --stream 3 --set ${v} 2>/dev/null`);
    }
  });
}

function initBrightnessSlider() {
  const slider   = document.getElementById('popup-bright-slider');
  const valLabel = document.getElementById('popup-bright-val');
  if (!slider) return;

  let _brightDebounce = null;

  slider.addEventListener('input', () => {
    const v = parseInt(slider.value);
    if (valLabel) valLabel.textContent = v === -1 ? 'Default' : v;
    updateBrightSliderFill(v);

    // Instant live preview — apply to system immediately while dragging
    clearTimeout(_brightDebounce);
    if (v >= 0) {
      _brightDebounce = setTimeout(() => {
        exec(`settings put system screen_brightness_mode 0 2>/dev/null; settings put system screen_brightness ${v} 2>/dev/null`);
      }, 0);
    } else {
      // -1 = Default: restore universal brightness or auto
      _brightDebounce = setTimeout(async () => {
        const ubRaw = (await exec(`cat ${UNIVERSAL_BRIGHT_FILE} 2>/dev/null`)).trim();
        if (ubRaw !== '' && !isNaN(parseInt(ubRaw))) {
          exec(`settings put system screen_brightness_mode 0 2>/dev/null; settings put system screen_brightness ${ubRaw} 2>/dev/null`);
        } else {
          exec(`settings put system screen_brightness_mode 1 2>/dev/null`);
        }
      }, 0);
    }
  });
}

/* ── Gear click → open popup ── */
document.addEventListener('click', e => {
  const gear = e.target.closest('[data-gear]');
  if (gear) { e.stopPropagation(); openPopup(gear.dataset.gear, gear, false); }
});

/* ═══════════════════════════════════════════════════════════
   § 11  Per-App Popup
   ═══════════════════════════════════════════════════════════ */
let cachedModes = null;
// Tracks the values loaded when popup opens — used to detect if user changed anything
let _popupInitial = { mode: '', bright: -1, vol: -1, fd: false, spare60: false, hvol_on: false, hvol_val: 7, screentimeout_ms: null };
let _popupScreentimeoutMs = null;  // per-app screen timeout loaded for current popup
let _popupConnType = null;  // 'wifi' | 'data' | 'both' | null

function _updatePopupConnUI(type) {
  const wifiBtn = document.getElementById('popup-conn-wifi-btn');
  const dataBtn = document.getElementById('popup-conn-data-btn');
  const wifiActive = type === 'wifi' || type === 'both';
  const dataActive = type === 'data' || type === 'both';
  const wifiColor = '#60cfff';
  const dataColor = '#a78bfa';
  if (wifiBtn) {
    wifiBtn.style.borderColor  = wifiActive ? wifiColor : 'var(--border)';
    wifiBtn.style.color        = wifiActive ? wifiColor : 'var(--dim)';
    wifiBtn.style.background   = wifiActive ? 'rgba(96,207,255,0.12)' : 'transparent';
    wifiBtn.style.boxShadow    = wifiActive ? '0 0 8px rgba(96,207,255,0.3)' : 'none';
  }
  if (dataBtn) {
    dataBtn.style.borderColor  = dataActive ? dataColor : 'var(--border)';
    dataBtn.style.color        = dataActive ? dataColor : 'var(--dim)';
    dataBtn.style.background   = dataActive ? 'rgba(168,85,247,0.12)' : 'transparent';
    dataBtn.style.boxShadow    = dataActive ? '0 0 8px rgba(168,85,247,0.3)' : 'none';
  }
}

async function openPopup(pkg, gearElement, isGame = false) {
  currentPkg = pkg;
  const overlay = document.getElementById('floating-popup');
  const bubble = overlay.querySelector('.app-config-bubble');
  const pkgEl   = document.getElementById('popup-pkg-display');
  const disp    = document.getElementById('refresh-mode-display');
  pkgEl.textContent     = pkg;

  // Show/hide game-only blocks based on caller context
  // Encore is game-only; Kill Others + Connection on Launch work for all apps
  const gameOnlyBlocks = [];
  gameOnlyBlocks.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = isGame ? '' : 'none';
  });
  // Connection on Launch + Cache Clear — show for BOTH apps and games
  ['popup-conn-block'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = '';
  });
  // Kill Others — only show if globally enabled via gear toggle
  // Kill Others — always in Game Config; in App Config only if gear toggle is ON
  const _koBlockEl = document.getElementById('popup-ko-block');
  if (_koBlockEl) _koBlockEl.style.display = (isGame || _koGlobalEnabled) ? '' : 'none';
  // Clear Cache — always in Game Config; in App Config only if gear toggle is ON
  const _cacheBlockEl = document.getElementById('popup-cache-block');
  if (_cacheBlockEl) _cacheBlockEl.style.display = (isGame || _cacheGlobalEnabled) ? '' : 'none';



  // Update popup title based on context
  const popupTitle = document.getElementById('popup-main-title');
  if (popupTitle) popupTitle.textContent = isGame ? 'GAME CONFIGURATION' : 'APP CONFIGURATION';
  disp.textContent      = 'Off';
  disp.className        = 'popup-block-val off';
  
  // Position bubble centered on page
  bubble.style.left = '50%';
  bubble.style.top = '50%';
  bubble.style.right = 'auto';
  bubble.style.transform = 'translate(-50%, -50%)';
  
  overlay.classList.add('bubble-open');
  overlay.classList.add('bubble-full-page');

  if (!cachedModes) {
    document.getElementById('refresh-radio-list').innerHTML =
      '<div style="padding:16px;text-align:center;color:var(--a);font-size:15px" class="mono">Loading…</div>';
    const raw = await exec(`${MOD}/script_runner/display_mode 2>/dev/null`);
    cachedModes = raw.trim().split('\n').filter(l => l.includes('|') && l.includes('Hz'));
  }

  const saved = (await exec(`cat ${RR_DIR}/${pkg}.mode 2>/dev/null`)).trim();
  buildRadioList(cachedModes, saved);
  updateRRDisplay();

  // Load per-app brightness
  const brightSlider = document.getElementById('popup-bright-slider');
  const brightVal    = document.getElementById('popup-bright-val');
  if (brightSlider && brightVal) {
    brightSlider.max = DEVICE_MAX_BRIGHTNESS;
    const savedBright = (await exec(`cat ${RR_DIR}/${pkg}.bright 2>/dev/null`)).trim();
    const bv = (savedBright !== '' && !isNaN(parseInt(savedBright))) ? parseInt(savedBright) : -1;
    brightSlider.value = bv;
    brightVal.textContent = bv === -1 ? 'Default' : bv;
    updateBrightSliderFill(bv);
  }

  // Load per-app volume
  const volSlider = document.getElementById('popup-vol-slider');
  const volVal    = document.getElementById('popup-vol-val');
  if (volSlider && volVal) {
    volSlider.max = DEVICE_MAX_VOLUME;
    const savedVol = (await exec(`cat ${RR_DIR}/${pkg}.vol 2>/dev/null`)).trim();
    const vv = (savedVol !== '' && !isNaN(parseInt(savedVol))) ? parseInt(savedVol) : -1;
    volSlider.value = vv;
    volVal.textContent = vv === -1 ? 'Default' : vv;
    updateVolSliderFill(vv);
  }

  // Load per-app saturation
  const satSliderP = document.getElementById('popup-sat-slider');
  const satValP    = document.getElementById('popup-sat-val');
  if (satSliderP && satValP) {
    const savedSat = (await exec(`cat ${RR_DIR}/${pkg}.sat 2>/dev/null`)).trim();
    const sv = (savedSat !== '' && !isNaN(parseInt(savedSat))) ? parseInt(savedSat) : -1;
    satSliderP.value = sv;
    satValP.textContent = sv === -1 ? 'Default' : (sv / 10).toFixed(1) + 'x';
    _updatePopupSatFill(sv);
  }


  // Store initial cache state for nothingChanged check
  const _cacheInitRaw = (await exec(`[ -f ${RR_DIR}/${pkg}.cacheclear ] && echo 1 || echo 0`)).trim();
  if (!_popupInitial) window._popupInitial = {};

  _killothersBl       = new Set();
  _killothersBlPkgs   = [];
  _killothersBlQuery  = '';
  _killothersBlLoaded = false;
  // (Kill Others is now managed in Panel 06 — no popup state to reset)



  // Connection on Launch is now managed in Panel 07 — not loaded here
  // Kill Others is now managed in Panel 06 — not loaded here

  // ── Load Encore Tweaks state — always read fresh from disk ──────────────
  // (Encore Tweaks WebUI may have changed gamelist.json externally since last load)
  const encoreBtn     = document.getElementById('popup-encore-btn');
  const encoreLabel   = document.getElementById('popup-encore-label');
  const encoreSubOpts = document.getElementById('popup-encore-sub-opts');
  const liteCb        = document.getElementById('encore-litemode-cb');
  const dndCb         = document.getElementById('encore-dnd-cb');

  // Load both gamelist + global config fresh in parallel
  await Promise.all([_loadEncoreGamelist(), _loadEncoreConfig()]);

  const isEncore         = encorePkgs.has(pkg);
  const encoreCfg        = _encoreGamelist[pkg] || {};
  const globalEnforceLite = !!_encoreGlobalCfg?.preferences?.enforce_lite_mode;

  // Effective lite_mode value: forced true by global enforcement OR per-app setting
  const effectiveLite = isEncore ? (globalEnforceLite ? true : !!encoreCfg.lite_mode) : false;

  if (encoreBtn) {
    encoreBtn.setAttribute('aria-pressed', isEncore ? 'true' : 'false');
    if (encoreLabel)   encoreLabel.textContent     = isEncore ? 'ON' : 'OFF';
    if (encoreSubOpts) encoreSubOpts.style.display = isEncore ? '' : 'none';
    // Sync collapsible summary label
    const encoreSummaryVal = document.getElementById('popup-encore-summary-val');
    if (encoreSummaryVal) encoreSummaryVal.textContent = isEncore ? 'ON' : 'OFF';
  }

  if (liteCb) {
    liteCb.checked  = effectiveLite;
    // Disable the checkbox if: tweaks off OR global enforcement is active
    liteCb.disabled = !isEncore || globalEnforceLite;
    // Visual hint for the parent label
    const liteRow = liteCb.closest('.encore-sub-row');
    if (liteRow) {
      liteRow.style.opacity = (!isEncore || globalEnforceLite) ? '0.45' : '1';
      liteRow.title = globalEnforceLite ? 'Globally enforced via Encore Tweaks settings' : '';
    }
    const enforcedNote = document.getElementById('encore-enforced-note');
    if (enforcedNote) enforcedNote.style.display = globalEnforceLite ? '' : 'none';
  }
  if (dndCb) {
    dndCb.checked  = !!encoreCfg.enable_dnd;
    dndCb.disabled = !isEncore;
    const dndRow = dndCb.closest('.encore-sub-row');
    if (dndRow) dndRow.style.opacity = !isEncore ? '0.45' : '1';
  }

  // Store initial values so we can detect if user actually changed anything
  const _initBright = document.getElementById('popup-bright-slider');
  const _initVol    = document.getElementById('popup-vol-slider');
  const _initFd     = document.getElementById('popup-forcedark-btn');
  const _initSel    = document.querySelector('.radio-option--selected');

  // ── Load Kill Others state for popup ──
  const koBtn   = document.getElementById('popup-ko-btn');
  const koLabel = document.getElementById('popup-ko-label');
  const koOnDisk = (await exec(`[ -f ${RR_DIR}/${pkg}.killothers ] && echo 1 || echo 0`)).trim() === '1';
  // Sync in-memory KO state as well
  if (!_koState[pkg]) _koState[pkg] = { on: false, bl: new Set() };
  _koState[pkg].on = koOnDisk;
  if (koBtn) {
    koBtn.setAttribute('aria-pressed', String(koOnDisk));
    koBtn.classList.toggle('gaming-toggle-btn--on', koOnDisk);
    const koThumb = koBtn.querySelector('.popup-toggle-thumb');
    if (koThumb) koThumb.style.transform = koOnDisk ? 'translateX(16px)' : '';
    if (koLabel) koLabel.textContent = koOnDisk ? 'ON' : 'OFF';
    if (koBtn._koHandler) koBtn.removeEventListener('click', koBtn._koHandler);
    koBtn._koHandler = async () => {
      const cur2 = koBtn.getAttribute('aria-pressed') === 'true';
      const next2 = !cur2;
      koBtn.setAttribute('aria-pressed', String(next2));
      koBtn.classList.toggle('gaming-toggle-btn--on', next2);
      const t2 = koBtn.querySelector('.popup-toggle-thumb');
      if (t2) t2.style.transform = next2 ? 'translateX(16px)' : '';
      const lbl2 = document.getElementById('popup-ko-label');
      if (lbl2) lbl2.textContent = next2 ? 'ON' : 'OFF';
      // Update in-memory state immediately
      if (!_koState[currentPkg]) _koState[currentPkg] = { on: false, bl: new Set() };
      _koState[currentPkg].on = next2;
      // Ensure KO panel has packages loaded for spare picker
      if (next2) {
        if (!_koPkgs.length) {
          const uRaw = await exec(`pm list packages -3 | cut -d: -f2 | sort`);
          _koPkgs = uRaw.trim().split('\n').filter(Boolean);
          _koPkgs.forEach(p => { if (!_koState[p]) _koState[p] = { on: false, bl: new Set() }; });
        }
        // Open spare-from-kill picker immediately so user can select apps
        _openKoConfig(currentPkg, koBtn, true);
      }
    };
    koBtn.addEventListener('click', koBtn._koHandler);
  }

  // ── Load Connection on Launch state for popup ──
  const connValRaw = (await exec(`cat ${RR_DIR}/${pkg}.conn 2>/dev/null`)).trim();
  const connOnDisk = ['wifi','data','both'].includes(connValRaw) ? connValRaw : null;
  _updatePopupConnUI(connOnDisk);
  // Wire conn buttons as independent WiFi / Data toggles
  const _wifiBtn = document.getElementById('popup-conn-wifi-btn');
  const _dataBtn = document.getElementById('popup-conn-data-btn');
  if (_wifiBtn) {
    if (_wifiBtn._connHandler) _wifiBtn.removeEventListener('click', _wifiBtn._connHandler);
    _wifiBtn._connHandler = () => {
      const wifiOn = !(_popupConnType === 'wifi' || _popupConnType === 'both');
      const dataOn = _popupConnType === 'data' || _popupConnType === 'both';
      _popupConnType = wifiOn && dataOn ? 'both' : wifiOn ? 'wifi' : dataOn ? 'data' : null;
      _updatePopupConnUI(_popupConnType);
    };
    _wifiBtn.addEventListener('click', _wifiBtn._connHandler);
  }
  if (_dataBtn) {
    if (_dataBtn._connHandler) _dataBtn.removeEventListener('click', _dataBtn._connHandler);
    _dataBtn._connHandler = () => {
      const wifiOn = _popupConnType === 'wifi' || _popupConnType === 'both';
      const dataOn = !(_popupConnType === 'data' || _popupConnType === 'both');
      _popupConnType = wifiOn && dataOn ? 'both' : wifiOn ? 'wifi' : dataOn ? 'data' : null;
      _updatePopupConnUI(_popupConnType);
    };
    _dataBtn.addEventListener('click', _dataBtn._connHandler);
  }

  // ── Load Cache Clear On Launch state ──
  const cacheBtn   = document.getElementById('popup-cache-btn');
  const cacheLabel = document.getElementById('popup-cache-label');
  const cacheOnDisk = (await exec(`[ -f ${RR_DIR}/${pkg}.cacheclear ] && echo 1 || echo 0`)).trim() === '1';
  if (cacheBtn) {
    cacheBtn.setAttribute('aria-pressed', String(cacheOnDisk));
    cacheBtn.classList.toggle('gaming-toggle-btn--on', cacheOnDisk);
    if (cacheLabel) cacheLabel.textContent = cacheOnDisk ? 'ON' : 'OFF';
    if (cacheBtn._cacheHandler) cacheBtn.removeEventListener('click', cacheBtn._cacheHandler);
    cacheBtn._cacheHandler = async () => {
      const cur = cacheBtn.getAttribute('aria-pressed') === 'true';
      if (cur) {
        // Already ON — re-open popup to edit app list, do NOT toggle off
        _openCacheClearPopup(pkg);
        return;
      }
      // Turning ON
      cacheBtn.setAttribute('aria-pressed', 'true');
      cacheBtn.classList.add('gaming-toggle-btn--on');
      if (cacheLabel) cacheLabel.textContent = 'ON';
      await exec(`mkdir -p ${RR_DIR} && touch ${RR_DIR}/${pkg}.cacheclear`);
      // Open sub-popup to select apps
      _openCacheClearPopup(pkg);
    };
    cacheBtn.addEventListener('click', cacheBtn._cacheHandler);
  }

  // Load per-app spare from 60Hz drop state — uses dedicated .spare file, isolated from universal
  {
    const _sp = pkg;
    const spareRaw = await exec(`[ -f ${RR_DIR}/${_sp}.spare ] && echo 1 || echo 0`);
    _popupSpare60On = spareRaw.trim() === '1';
    const spareBtn   = document.getElementById('popup-spare60-btn');
    const spareLabel = document.getElementById('popup-spare60-label');
    if (spareBtn) {
      spareBtn.setAttribute('aria-pressed', String(_popupSpare60On));
      spareBtn.classList.toggle('gaming-toggle-btn--on', _popupSpare60On);
      const thumb = spareBtn.querySelector('.popup-toggle-thumb');
      if (thumb) thumb.style.transform = _popupSpare60On ? 'translateX(16px)' : '';
    }
    if (spareLabel) spareLabel.textContent = _popupSpare60On ? 'ON' : 'OFF';
  }

  // Load per-app headset volume
  {
    const hvolOnRaw  = await exec(`[ -f ${RR_DIR}/${pkg}.hvol_on ] && echo 1 || echo 0`);
    const hvolValRaw = await exec(`cat ${RR_DIR}/${pkg}.hvol 2>/dev/null`);
    _popupHvolOn  = hvolOnRaw.trim() === '1';
    _popupHvolVal = parseInt(hvolValRaw.trim()) || 7;
    if (_popupHvolVal < 0) _popupHvolVal = 0;
    if (_popupHvolVal > 15) _popupHvolVal = 15;

    const hvolToggle   = document.getElementById('popup-hvol-toggle');
    const hvolLabel    = document.getElementById('popup-hvol-label');
    const hvolSlider   = document.getElementById('popup-hvol-slider');
    const hvolValEl    = document.getElementById('popup-hvol-val');
    const hvolControls = document.getElementById('popup-hvol-controls');

    if (hvolToggle) {
      hvolToggle.setAttribute('aria-pressed', String(_popupHvolOn));
      hvolToggle.classList.toggle('gaming-toggle-btn--on', _popupHvolOn);
      const thumb = hvolToggle.querySelector('.popup-toggle-thumb');
      if (thumb) thumb.style.transform = _popupHvolOn ? 'translateX(16px)' : '';
    }
    if (hvolLabel)    hvolLabel.textContent = _popupHvolOn ? 'ON' : 'OFF';
    // Sync collapsible summary label
    const hvolSummaryVal = document.getElementById('popup-hvol-summary-val');
    if (hvolSummaryVal) hvolSummaryVal.textContent = _popupHvolOn ? `ON · ${_popupHvolVal}/15` : 'OFF';
    if (hvolSlider)   { hvolSlider.value = _popupHvolVal; _syncSliderFill(hvolSlider); }
    if (hvolValEl)    hvolValEl.textContent = `${_popupHvolVal} / 15`;
    if (hvolControls) {
      hvolControls.style.opacity       = _popupHvolOn ? '1' : '0.35';
      hvolControls.style.pointerEvents = _popupHvolOn ? '' : 'none';
    }
  }

  // Load per-app screen off timeout
  {
    const stRaw = (await exec(`cat ${RR_DIR}/${pkg}.screentimeout 2>/dev/null`)).trim();
    _popupScreentimeoutMs = stRaw && !isNaN(parseInt(stRaw)) ? parseInt(stRaw) : null;
    const stValEl = document.getElementById('popup-screentimeout-val');
    if (stValEl) stValEl.textContent = _popupScreentimeoutMs ? _msToScreenLabel(_popupScreentimeoutMs) : 'DEFAULT';
    _updateScreenTimeoutChips('popup-screentimeout-chips', _popupScreentimeoutMs);
  }

  _popupInitial = {
    mode:            _initSel?.dataset.value || '',
    bright:          _initBright ? parseInt(_initBright.value) : -1,
    vol:             _initVol    ? parseInt(_initVol.value)    : -1,
    sat:             parseInt(document.getElementById('popup-sat-slider')?.value ?? -1),
    fd:              _initFd?.getAttribute('aria-pressed') === 'true',
    encore:          isEncore,
    lite_mode:       effectiveLite,
    enable_dnd:      !!encoreCfg.enable_dnd,
    globalEnforceLite,
    ko_on:           koOnDisk,
    conn:            connOnDisk,
    cache_on:        (await exec(`[ -f ${RR_DIR}/${pkg}.cacheclear ] && echo 1 || echo 0`)).trim() === '1',
    spare60:         _popupSpare60On,
    hvol_on:         _popupHvolOn,
    hvol_val:        _popupHvolVal,
    screentimeout_ms: _popupScreentimeoutMs,
  };
  _popupConnType = connOnDisk;

}

function buildRadioList(modes, selectedValue) {
  const radioList = document.getElementById('refresh-radio-list');
  if (!radioList) return;
  const entries = [
    { value: '', label: 'Off' },
    ...modes.map(line => {
      const [id, spec] = line.split('|', 2);
      const m = spec?.match(/(\d+)Hz/);
      const label = m ? m[1] + 'Hz' : spec.trim();
      return { value: id.trim(), label };
    })
  ];
  const frag = document.createDocumentFragment();
  entries.forEach(({ value, label }) => {
    const isSelected = value === selectedValue || (!value && !selectedValue);
    const row = document.createElement('div');
    row.className = 'radio-option' + (isSelected ? ' radio-option--selected' : '');
    row.dataset.value = value;
    row.setAttribute('role', 'option');
    row.innerHTML = `<span class="radio-label mono">${label}</span><span class="radio-dot"></span>`;
    row.addEventListener('click', () => {
      radioList.querySelectorAll('.radio-option').forEach(r => r.classList.remove('radio-option--selected'));
      row.classList.add('radio-option--selected');
      updateRRDisplay();
    });
    frag.appendChild(row);
  });
  radioList.replaceChildren(frag);
}

function closePopup() {
  const overlay = document.getElementById('floating-popup');
  overlay.classList.remove('bubble-open');
  overlay.classList.remove('bubble-full-page');
}

function updateRRDisplay() {
  const disp  = document.getElementById('refresh-mode-display');
  const sel   = document.querySelector('.radio-option--selected');
  const val   = sel?.dataset.value || '';
  const label = sel?.querySelector('.radio-label')?.textContent || '';
  if (!val) {
    disp.textContent = 'Off'; disp.className = 'popup-block-val off';
  } else {
    disp.textContent = label; disp.className = 'popup-block-val on';
  }
}

async function applyRefreshLock() {
  const sel    = document.querySelector('.radio-option--selected');
  const modeId = sel?.dataset.value || '';

  // Compare current values with what was loaded — skip if nothing changed
  const brightSliderCheck = document.getElementById('popup-bright-slider');
  const volSliderCheck    = document.getElementById('popup-vol-slider');
  const satSliderCheck    = document.getElementById('popup-sat-slider');
  const fdBtnCheck        = document.getElementById('popup-forcedark-btn');
  const encoreBtnCheck    = document.getElementById('popup-encore-btn');
  const liteCbCheck       = document.getElementById('encore-litemode-cb');
  const dndCbCheck        = document.getElementById('encore-dnd-cb');
  const koBtnCheck        = document.getElementById('popup-ko-btn');
  const curBright   = brightSliderCheck ? parseInt(brightSliderCheck.value) : -1;
  const curVol      = volSliderCheck    ? parseInt(volSliderCheck.value)    : -1;
  const curSat      = satSliderCheck    ? parseInt(satSliderCheck.value)    : -1;
  const curFd       = fdBtnCheck?.getAttribute('aria-pressed') === 'true';
  const curEncore   = encoreBtnCheck?.getAttribute('aria-pressed') === 'true';
  const _globalEnforceForCheck = !!_encoreGlobalCfg?.preferences?.enforce_lite_mode;
  const curLite     = _globalEnforceForCheck ? true : (liteCbCheck?.checked || false);
  const curDnd      = dndCbCheck?.checked  || false;
  const curKoOn      = koBtnCheck?.getAttribute('aria-pressed') === 'true';
  const curConn      = _popupConnType;
  const curCacheOn   = document.getElementById('popup-cache-btn')?.getAttribute('aria-pressed') === 'true';
  const nothingChanged = (
    modeId   === _popupInitial.mode   &&
    curBright === _popupInitial.bright &&
    curVol    === _popupInitial.vol    &&
    curSat    === _popupInitial.sat    &&
    curFd     === _popupInitial.fd     &&
    curEncore === _popupInitial.encore &&
    curLite   === _popupInitial.lite_mode &&
    curDnd    === _popupInitial.enable_dnd &&
    curKoOn      === _popupInitial.ko_on &&
    curConn      === _popupInitial.conn &&
    curCacheOn   === _popupInitial.cache_on &&
    (document.getElementById('popup-spare60-btn')?.getAttribute('aria-pressed') === 'true') === _popupInitial.spare60 &&
    (document.getElementById('popup-hvol-toggle')?.getAttribute('aria-pressed') === 'true') === _popupInitial.hvol_on &&
    (parseInt(document.getElementById('popup-hvol-slider')?.value) || 7) === _popupInitial.hvol_val &&
    _popupScreentimeoutMs === _popupInitial.screentimeout_ms
  );
  if (nothingChanged) {
    closePopup();
    return;
  }

  setStatus('💾 Saving…');
  if (modeId) {
    await exec(`mkdir -p ${RR_DIR} && echo '${modeId}' > ${RR_DIR}/${currentPkg}.mode`);
    await exec(`su -c "service call SurfaceFlinger 1035 i32 ${modeId}"`);
    setStatus(`🔒 ${getAppLabel(currentPkg)} → ${sel.querySelector('.radio-label').textContent}`);
    showToast(`${getAppLabel(currentPkg)} → ${sel.querySelector('.radio-label').textContent}`,'PER-APP RR','success','🔒');
  } else {
    await exec(`rm -f ${RR_DIR}/${currentPkg}.mode`);
    if (rrActive) {
      await exec(`su -c "service call SurfaceFlinger 1035 i32 ${rrActive}"`);
    } else {
      await exec(`su -c "service call SurfaceFlinger 1035 i32 0"`);
    }
    setStatus(`RR disabled for ${getAppLabel(currentPkg)}`);
    showToast(`RR removed for ${getAppLabel(currentPkg)}`,'PER-APP RR','info','🔓');
  }
  updateRRDisplay();

  // Apply per-app brightness — save file & apply now; when cleared restore universal
  const brightSlider = document.getElementById('popup-bright-slider');
  const bv = brightSlider ? parseInt(brightSlider.value) : -1;
  if (bv >= 0) {
    await exec(`mkdir -p ${RR_DIR} && echo '${bv}' > ${RR_DIR}/${currentPkg}.bright`);
    await exec(
      `settings put system screen_brightness_mode 0 2>/dev/null; ` +
      `settings put system screen_brightness ${bv} 2>/dev/null`
    );
  } else {
    await exec(`rm -f ${RR_DIR}/${currentPkg}.bright`);
    const ubRaw = (await exec(`cat ${UNIVERSAL_BRIGHT_FILE} 2>/dev/null`)).trim();
    if (ubRaw !== '' && !isNaN(parseInt(ubRaw))) {
      await exec(
        `settings put system screen_brightness_mode 0 2>/dev/null; ` +
        `settings put system screen_brightness ${ubRaw} 2>/dev/null`
      );
    } else {
      await exec(`settings put system screen_brightness_mode 1 2>/dev/null`);
    }
  }

  // Apply per-app volume
  const volSlider = document.getElementById('popup-vol-slider');
  const vv = volSlider ? parseInt(volSlider.value) : -1;
  if (vv >= 0) {
    await exec(`mkdir -p ${RR_DIR} && echo '${vv}' > ${RR_DIR}/${currentPkg}.vol`);
    // Apply now — use both AudioManager (persistent) and media session (active playback)
    await exec(`media volume --stream 3 --set ${vv} 2>/dev/null || settings put system volume_music ${vv} 2>/dev/null`);
    await exec(`cmd media_session volume --stream 3 --set ${vv} 2>/dev/null; true`);
    // Signal daemon to re-apply on next app switch
    await exec(`echo "${currentPkg}" > /dev/.davion_vol_retrigger 2>/dev/null`);
  } else {
    await exec(`rm -f ${RR_DIR}/${currentPkg}.vol`);
    // Restore universal volume or do nothing
    const uvRaw = (await exec(`cat ${UNIVERSAL_VOL_FILE} 2>/dev/null`)).trim();
    if (uvRaw !== '' && !isNaN(parseInt(uvRaw))) {
      await exec(`cmd media_session volume --stream 3 --set ${uvRaw} 2>/dev/null; true`);
    }
  }

  // ── Per-app Saturation Boost ──────────────────────────────────
  // Saves to .sat file; logcat daemon applies it only while this app is foreground.
  // Does NOT touch the global saturation file — restores it on app switch.
  const satSliderSave = document.getElementById('popup-sat-slider');
  const sv = satSliderSave ? parseInt(satSliderSave.value) : -1;
  if (sv >= 0) {
    const satStr = (sv / 10).toFixed(1);
    await exec(`mkdir -p ${RR_DIR} && echo '${sv}' > ${RR_DIR}/${currentPkg}.sat`);
    // Apply immediately ONLY if this app is currently in foreground
    const fgPkg = (await exec(`cat /dev/.davion_last_fg_pkg 2>/dev/null`)).trim();
    if (fgPkg === currentPkg) {
      await exec(`service call SurfaceFlinger 1022 f ${satStr} 2>/dev/null`);
    }
  } else {
    await exec(`rm -f ${RR_DIR}/${currentPkg}.sat`);
    // If app is currently foreground, restore global saturation
    const fgPkg = (await exec(`cat /dev/.davion_last_fg_pkg 2>/dev/null`)).trim();
    if (fgPkg === currentPkg) {
      const globalSat = (await exec(`cat ${BOOST_COLOR_CFG}/saturation_value 2>/dev/null`)).trim();
      if (globalSat) await exec(`service call SurfaceFlinger 1022 f ${globalSat} 2>/dev/null`);
    }
  }

  // Apply per-app force dark
  const fdBtn2 = document.getElementById('popup-forcedark-btn');
  const fdOn   = fdBtn2?.getAttribute('aria-pressed') === 'true';
  if (fdOn) {
    await exec(`mkdir -p ${RR_DIR} && echo '1' > ${RR_DIR}/${currentPkg}.forcedark`);
    await exec(
      `cmd appops set ${currentPkg} FORCE_DARK allow 2>/dev/null || ` +
      `settings put global force_dark_mode_pkgs $(settings get global force_dark_mode_pkgs 2>/dev/null),${currentPkg} 2>/dev/null`
    );
  } else {
    await exec(`rm -f ${RR_DIR}/${currentPkg}.forcedark`);
    await exec(`cmd appops set ${currentPkg} FORCE_DARK default 2>/dev/null`);
  }

  // Connection on Launch is now managed in Panel 07 — not saved from popup
  // Kill Others is now managed in Panel 06 — not saved from popup

  // ── Save Encore Tweaks state ──────────────────────────
  const encoreBtnApply = document.getElementById('popup-encore-btn');
  const liteCbApply    = document.getElementById('encore-litemode-cb');
  const dndCbApply     = document.getElementById('encore-dnd-cb');
  const encoreOn = encoreBtnApply?.getAttribute('aria-pressed') === 'true';
  // Effective lite: if global enforcement is ON, always true (regardless of checkbox)
  const globalEnforceLiteApply = !!_encoreGlobalCfg?.preferences?.enforce_lite_mode;
  const liteOn = globalEnforceLiteApply ? true : (liteCbApply?.checked || false);
  const dndOn  = dndCbApply?.checked || false;

  const encoreSaveResult = await saveEncore(currentPkg, encoreOn, liteOn, dndOn);

  // ── Save Kill Others state from popup ────────────────────────
  if (!_koState[currentPkg]) _koState[currentPkg] = { on: false, bl: new Set() };
  _koState[currentPkg].on = curKoOn;
  if (curKoOn) {
    await exec(`mkdir -p ${RR_DIR} && echo '1' > ${RR_DIR}/${currentPkg}.killothers`);
    configuredPkgs.add(currentPkg);
  } else {
    await exec(`rm -f ${RR_DIR}/${currentPkg}.killothers ${RR_DIR}/${currentPkg}.killothers_bl`);
  }
  _updateKoMetrics();

  // ── Save Connection on Launch state from popup ────────────────
  if (curConn) {
    await exec(`mkdir -p ${RR_DIR} && printf '%s' '${curConn}' > ${RR_DIR}/${currentPkg}.conn`);
    configuredPkgs.add(currentPkg);
  } else {
    await exec(`rm -f ${RR_DIR}/${currentPkg}.conn`);
  }

  // ── Save Cache Clear On Launch state ─────────────────────────
  if (curCacheOn) {
    await exec(`mkdir -p ${RR_DIR} && touch ${RR_DIR}/${currentPkg}.cacheclear`);
    configuredPkgs.add(currentPkg);
  } else {
    await exec(`rm -f ${RR_DIR}/${currentPkg}.cacheclear ${RR_DIR}/${currentPkg}.cacheclear_list`);
  }

  // Badge: all per-app settings
  const hasMode     = !!modeId;
  const hasBright   = bv >= 0;
  const hasVol      = vv >= 0;
  const hasFd       = fdOn;
  const hasKo       = curKoOn;
  const hasConn     = !!curConn;
  const hasCache    = curCacheOn;
  const hasEncore   = encoreOn && encoreSaveResult?.ok;
  const hasSpare    = document.getElementById('popup-spare60-btn')?.getAttribute('aria-pressed') === 'true';
  const hasAnything = hasMode || hasBright || hasVol || hasFd || hasKo || hasConn || hasCache || hasEncore || hasSpare;

  updateConfiguredBadge(currentPkg, hasAnything);

  if (hasAnything) {
    const parts = [];
    if (hasMode)    parts.push(sel.querySelector('.radio-label').textContent);
    if (hasBright)  parts.push(`☀${bv}`);
    if (hasVol)     parts.push(`🔊${vv}`);
    if (hasFd)      parts.push(`🌑DARK`);
    if (hasEncore)  parts.push(`🍬ENCORE`);
    if (hasKo)      parts.push(`⏹KO`);
    if (hasConn)    parts.push(`📶${curConn.toUpperCase()}`);
    if (hasCache)   parts.push(`🗑CACHE`);
    if (hasSpare)   parts.push(`🛡SPARE`);
    showToast(`${getAppLabel(currentPkg)} → ${parts.join(' · ')}`, 'PER-APP', 'success', '🔒');
    setStatus(`🔒 ${getAppLabel(currentPkg)} → ${parts.join(' · ')}`);
  } else {
    const encoreMsg = encoreOn && !encoreSaveResult?.ok ? ' (encore error)' : '';
    showToast(`Config cleared for ${getAppLabel(currentPkg)}${encoreMsg}`, 'PER-APP', 'info', '🔓');
    setStatus(`Config cleared for ${getAppLabel(currentPkg)}`);
  }

  // Signal brightness daemon to re-apply immediately
  await exec(`echo "${currentPkg}" > /dev/.davion_bright_retrigger 2>/dev/null`);

  // Save spare from 60Hz drop (idle60 spare list) — read DOM state directly
  const _spareBtn = document.getElementById('popup-spare60-btn');
  const _spareOn  = _spareBtn?.getAttribute('aria-pressed') === 'true';
  if (_spareOn) {
    // Add to in-memory set too — keeps it in sync
    _idle60SpareSet.add(currentPkg);
    await exec(
      `mkdir -p /sdcard/DAVION_ENGINE && ` +
      `grep -Fxq ${JSON.stringify(currentPkg)} ${IDLE60_SPARE_FILE} 2>/dev/null || ` +
      `printf '%s\n' ${JSON.stringify(currentPkg)} >> ${IDLE60_SPARE_FILE}`
    );
  } else {
    // Remove from in-memory set too — prevents _saveIdle60Spare from re-adding it
    _idle60SpareSet.delete(currentPkg);
    await exec(
      `grep -Fxv ${JSON.stringify(currentPkg)} ${IDLE60_SPARE_FILE} 2>/dev/null > ${IDLE60_SPARE_FILE}.tmp; ` +
      `if [ -s ${IDLE60_SPARE_FILE}.tmp ]; then mv ${IDLE60_SPARE_FILE}.tmp ${IDLE60_SPARE_FILE}; ` +
      `else rm -f ${IDLE60_SPARE_FILE} ${IDLE60_SPARE_FILE}.tmp; fi`
    );
  }

  // Save per-app spare from 60Hz drop — dedicated .spare flag file, fully isolated
  const _spare60Btn = document.getElementById('popup-spare60-btn');
  const _spare60On  = _spare60Btn?.getAttribute('aria-pressed') === 'true';
  if (_spare60On) {
    await exec(`mkdir -p ${RR_DIR} && touch ${RR_DIR}/${currentPkg}.spare`);
  } else {
    await exec(`rm -f ${RR_DIR}/${currentPkg}.spare`);
  }

  // Save per-app headset volume — .hvol_on flag + .hvol value file, fully isolated per-pkg
  {
    const _hvolToggle = document.getElementById('popup-hvol-toggle');
    const _hvolSlider = document.getElementById('popup-hvol-slider');
    const _hvolOn  = _hvolToggle?.getAttribute('aria-pressed') === 'true';
    const _hvolVal = Math.min(15, Math.max(0, parseInt(_hvolSlider?.value ?? 7) || 7));
    // Always write the value so it's remembered even when toggled off
    await exec(`mkdir -p ${RR_DIR} && echo '${_hvolVal}' > ${RR_DIR}/${currentPkg}.hvol`);
    if (_hvolOn) {
      await exec(`touch ${RR_DIR}/${currentPkg}.hvol_on`);
      // Signal headset_daemon to re-apply for the current app if headset is plugged
      await exec(`[ -f /dev/.davion_headset_plugged ] && echo "${currentPkg}" > /dev/.davion_headset_retrigger 2>/dev/null || true`);
    } else {
      await exec(`rm -f ${RR_DIR}/${currentPkg}.hvol_on`);
    }
  }

  // Save per-app screen off timeout
  if (_popupScreentimeoutMs && _popupScreentimeoutMs > 0) {
    await exec(`mkdir -p ${RR_DIR} && echo '${_popupScreentimeoutMs}' > ${RR_DIR}/${currentPkg}.screentimeout`);
  } else {
    await exec(`rm -f ${RR_DIR}/${currentPkg}.screentimeout`);
  }

  setTimeout(closePopup, 500);
  autoSave();
}

function updateConfiguredBadge(pkg, isConfigured) {
  if (isConfigured) configuredPkgs.add(pkg);
  else              configuredPkgs.delete(pkg);
  _updateTabCounts();
  // Stay on current tab — each tab now shows only its own section
  renderAppTab(_activeTab);
}

/* ─────────────────────────────────────────────────────────
   § ENCORE TWEAKS — toggle + save helpers
   ───────────────────────────────────────────────────────── */

// Called by onclick on the toggle button in the popup
function toggleEncoreBtn() {
  const btn     = document.getElementById('popup-encore-btn');
  const label   = document.getElementById('popup-encore-label');
  const subOpts = document.getElementById('popup-encore-sub-opts');
  if (!btn) return;

  const isOn = btn.getAttribute('aria-pressed') !== 'true';
  btn.setAttribute('aria-pressed', isOn ? 'true' : 'false');
  if (label)   label.textContent        = isOn ? 'ON' : 'OFF';
  if (subOpts) subOpts.style.display    = isOn ? '' : 'none';
  // Sync collapsible summary label
  const _encSummaryVal = document.getElementById('popup-encore-summary-val');
  if (_encSummaryVal) _encSummaryVal.textContent = isOn ? 'ON' : 'OFF';

  const liteCb = document.getElementById('encore-litemode-cb');
  const dndCb  = document.getElementById('encore-dnd-cb');

  if (!isOn) {
    // Disabling: reset both checkboxes
    if (liteCb) { liteCb.checked = false; liteCb.disabled = true; }
    if (dndCb)  { dndCb.checked  = false; dndCb.disabled  = true; }
    const liteRow = liteCb?.closest('.encore-sub-row');
    const dndRow  = dndCb?.closest('.encore-sub-row');
    if (liteRow) liteRow.style.opacity = '0.45';
    if (dndRow)  dndRow.style.opacity  = '0.45';
  } else {
    // Enabling: restore checkbox states respecting globalEnforceLite
    const globalEnforceLite = !!_encoreGlobalCfg?.preferences?.enforce_lite_mode;
    if (liteCb) {
      liteCb.disabled = globalEnforceLite;
      if (globalEnforceLite) liteCb.checked = true; // force-check if global enforcement on
      const liteRow = liteCb.closest('.encore-sub-row');
      if (liteRow) {
        liteRow.style.opacity = globalEnforceLite ? '0.45' : '1';
        liteRow.title = globalEnforceLite ? 'Globally enforced via Encore Tweaks settings' : '';
      }
      const enforcedNote = document.getElementById('encore-enforced-note');
      if (enforcedNote) enforcedNote.style.display = globalEnforceLite ? '' : 'none';
    }
    if (dndCb) {
      dndCb.disabled = false;
      const dndRow = dndCb.closest('.encore-sub-row');
      if (dndRow) dndRow.style.opacity = '1';
    }
  }
}

/**
 * Saves Encore Tweaks config for one package to gamelist.json.
 *
 * Improvements over v1:
 *  • Atomic write  — writes to a .tmp file first, then `mv` to real path
 *    so the file is never left in a half-written / empty state.
 *  • Shell-safe    — JSON is base64-encoded before passing to the shell,
 *    eliminating all single-quote / special-char injection risks.
 *  • Cache-after-confirm — in-memory state only updated after disk write
 *    succeeds, keeping memory and disk in sync on failure.
 *  • Retry         — one automatic retry on transient exec failure.
 *  • JSON validation — stringified JSON is parsed back before write to
 *    confirm it is well-formed.
 *  • globalEnforceLite — if Encore's global enforce_lite_mode is active,
 *    lite_mode is always stored as true regardless of the checkbox value.
 *  • No SIGHUP — encored watches the config dir via inotify and reloads
 *    automatically on file change. Sending SIGHUP while a game is running
 *    causes the daemon to re-apply CPU/thermal profiles mid-game, causing lag.
 *  • Returns {ok, error} so callers can react if needed.
 */
async function saveEncore(pkg, enabled, lite_mode, enable_dnd) {
  const TMPFILE = `${ENCORE_GAMELIST}.tmp`;
  const CFGDIR  = '/data/adb/.config/encore';
  const MAX_RETRY = 1;

  // ── 1. Honour global enforce_lite_mode ─────────────────────────────────
  const globalEnforceLite = !!_encoreGlobalCfg?.preferences?.enforce_lite_mode;
  const effectiveLite = globalEnforceLite ? true : !!lite_mode;

  // ── 2. Build the updated gamelist object using in-memory cache ──────────
  const gl = Object.assign({}, _encoreGamelist);

  if (enabled) {
    gl[pkg] = {
      lite_mode:  effectiveLite,
      enable_dnd: !!enable_dnd
    };
  } else {
    delete gl[pkg];
  }

  // ── 3. Validate the resulting JSON ──────────────────────────────────────
  let json;
  try {
    json = JSON.stringify(gl, null, 2);
    JSON.parse(json); // confirm round-trip
  } catch (e) {
    showToast('Encore: JSON build failed — ' + e.message, 'ENCORE', 'error', '⚠');
    return { ok: false, error: e.message };
  }

  // ── 4. Base64-encode to guarantee safe shell transport ───────────────────
  const b64 = btoa(unescape(encodeURIComponent(json)));

  // ── 5. Atomic write with retry ──────────────────────────────────────────
  const writeCmd =
    `mkdir -p ${CFGDIR} && ` +
    `printf '%s' '${b64}' | base64 -d > ${TMPFILE} && ` +
    `mv -f ${TMPFILE} ${ENCORE_GAMELIST}`;

  let writeOk = false;
  for (let attempt = 0; attempt <= MAX_RETRY; attempt++) {
    try {
      const result = (await exec(writeCmd + ` && echo __OK__`)).trim();
      if (result.includes('__OK__')) { writeOk = true; break; }
    } catch (e) {
      if (attempt < MAX_RETRY) {
        await new Promise(r => setTimeout(r, 180));
      }
    }
  }

  if (!writeOk) {
    exec(`rm -f ${TMPFILE} 2>/dev/null`);
    showToast('Encore: disk write failed', 'ENCORE', 'error', '⚠');
    return { ok: false, error: 'disk write failed' };
  }

  // ── 6. Update in-memory cache only after confirmed disk success ──────────
  _encoreGamelist = gl;
  encorePkgs.clear();
  Object.keys(gl).forEach(p => encorePkgs.add(p));

  // ── 7. Signal Encore App Daemon to pick up the new gamelist ─────────────
  // The daemon polls every 1s — writing this flag makes it re-evaluate
  // the foreground app immediately without waiting for next poll cycle.
  exec(`touch /dev/.encore_gamelist_updated 2>/dev/null; true`);

  // ── 8. Update badge on the app row ───────────────────────────────────────
  updateEncoreBadge(pkg, enabled);

  return { ok: true };
}

// Patch only the ENCORE badge on a single list-item row (no full re-render)
function updateEncoreBadge(pkg, enabled) {
  const row = document.querySelector(`.list-item[data-pkg="${pkg}"]`);
  if (!row) return;
  const btnRow = row.querySelector('.btn-row');
  if (!btnRow) return;
  const existing = btnRow.querySelector('.encore-enabled-badge');
  if (enabled && !existing) {
    const badge = document.createElement('span');
    badge.className = 'encore-enabled-badge mono';
    badge.textContent = '🍬 ENCORE';
    // Insert before gear button
    const gear = btnRow.querySelector('.app-gear-btn');
    btnRow.insertBefore(badge, gear);
  } else if (!enabled && existing) {
    existing.remove();
  }
}

/* ═══════════════════════════════════════════════════════════
   § 13  Save config — writes boot_apply.sh
   ═══════════════════════════════════════════════════════════ */
async function saveAllConfig(){
  const btn=document.getElementById('btn-save-config');
  if(btn){btn.classList.add('saving');btn.querySelector('.save-label').textContent='…';}
  setStatus('◈ SAVING…');

  const saved = []; // track what was saved for toast summary

  // 1. Persist active profile
  if(activeProfile){ await exec(`mkdir -p ${CFG_DIR} && echo "${activeProfile}" > ${CFG_DIR}/active_profile`); saved.push('CPU'); }

  // 2. Persist freq scale
  const sl=document.getElementById('freq-scale-slider');
  const freqVal=sl?parseInt(sl.value):100;
  await exec(`mkdir -p /sdcard/GovThermal && echo "${freqVal}" > ${FREQ_FILE}`);

  // 3. CPU Governor Profiles — state already persisted by _applyCpuProfile() directly.
  //    Nothing extra to save here; cpu_profile_active file is written on each profile apply.

  // 4. Persist RR overlay & detection state
  const currentTheme = THEMES.find(t => document.body.classList.contains('theme-' + t)) || 'black';
  exec(`echo "${currentTheme}" > ${CFG_DIR}/theme`);
  exec(`echo "${overlayOn ? 'on' : 'off'}" > ${RR_CFG}/overlay_state`);
  const isLogcat = document.getElementById('detection-status')?.textContent === 'Logcat';
  if (isLogcat) { exec(`touch ${RR_CFG}/enable_logcat && rm -f ${RR_CFG}/enable_dumpsys`); }
  else          { exec(`touch ${RR_CFG}/enable_dumpsys && rm -f ${RR_CFG}/enable_logcat`); }

  // 5. Persist universal RR
  if (rrActive) { exec(`mkdir -p /sdcard/DAVION_ENGINE && echo "${rrActive}" > ${UNIVERSAL_RR_FILE}`); saved.push('RR'); }
  else          { exec(`rm -f ${UNIVERSAL_RR_FILE}`); }

  // 5b. Persist universal brightness
  if (universalBrightness !== null) {
    exec(`mkdir -p /sdcard/DAVION_ENGINE && echo "${universalBrightness}" > ${UNIVERSAL_BRIGHT_FILE}`);
    saved.push('BRIGHTNESS');
  } else {
    exec(`rm -f ${UNIVERSAL_BRIGHT_FILE}`);
  }

  // 5b2. Persist universal volume
  if (universalVolume !== null) {
    exec(`mkdir -p /sdcard/DAVION_ENGINE && echo "${universalVolume}" > ${UNIVERSAL_VOL_FILE}`);
    saved.push('VOLUME');
  } else {
    exec(`rm -f ${UNIVERSAL_VOL_FILE}`);
  }

  // 5c. Persist active feature states (only features with live UI buttons)
  const featureStates = [
    { key: 'removelimit',  applied: removeLimitApplied  },
    { key: 'animation',    applied: animationApplied    },
    { key: 'pyrox',        applied: pyroxEnabled        },
  ];
  const featCmds = featureStates.map(f =>
    `mkdir -p "${CFG_DIR}" && echo "${f.applied ? 'applied' : 'disabled'}" > "${CFG_DIR}/${f.key}_state"`
  );
  await execAll(...featCmds);
  const activeFeats = featureStates.filter(f => f.applied).map(f => f.key.toUpperCase());
  if (activeFeats.length) saved.push(...activeFeats);

  // 5d. Persist all per-app brightness files (ensure they're flushed to storage)
  await exec(`sync 2>/dev/null`);

  // 5e. Persist deep sleep (low power governor) state flag
  if (deepSleepGovActive) saved.push('DEEPSLEEP');


  // 5g. Persist saturation value to file (boot restore reads from here)
  const satSliderSave = document.getElementById('sat-boost-slider');
  const satValSave = satSliderSave ? parseFloat(satSliderSave.value).toFixed(1) : null;
  if (satValSave && satValSave !== '1.0') {
    await exec(`mkdir -p ${BOOST_COLOR_CFG} && echo "${satValSave}" > ${BOOST_COLOR_CFG}/saturation_value`);
    saved.push('SAT');
  } else {
    await exec(`rm -f ${BOOST_COLOR_CFG}/saturation_value 2>/dev/null`);
  }

  // 5h. Persist animation scale values (boot restore reads from ANIM_SCALE_CFG)
  const ANIM_KEYS = [
    { setting: 'window_animation_scale',     id: 'anim-win-val'   },
    { setting: 'transition_animation_scale', id: 'anim-trans-val' },
    { setting: 'animator_duration_scale',    id: 'anim-dur-val'   },
  ];
  for (const ak of ANIM_KEYS) {
    const liveVal = (await exec(`settings get global ${ak.setting} 2>/dev/null`)).trim();
    if (liveVal && liveVal !== 'null') {
      await exec(`mkdir -p ${ANIM_SCALE_CFG} && echo "${liveVal}" > ${ANIM_SCALE_CFG}/${ak.setting}`);
    }
  }
  saved.push('ANIM');

  // 6. Write boot_apply.sh (CPU + RR + Brightness + Features restore)
  const prof=activeProfile||'balanced';
  const universalLine      = rrActive ? `service call SurfaceFlinger 1035 i32 ${rrActive} >/dev/null 2>&1` : '# no universal RR';
  const universalVolLine = universalVolume !== null
    ? `cmd media_session volume --stream 3 --set ${universalVolume} 2>/dev/null; true`
    : '# no universal volume lock';

  const universalBrightLine = universalBrightness !== null
    ? `settings put system screen_brightness_mode 0 2>/dev/null; settings put system screen_brightness ${universalBrightness} 2>/dev/null`
    : '# no universal brightness lock';

  // Per-app brightness boot restore
  const perAppBrightRestore = [
    '# Restore per-app brightness on foreground — daemon handles this live,',
    '# but write universal brightness as baseline on boot',
    universalBrightLine,
  ].join('\n');

  // Feature boot restore lines
  const featBootLines = featureStates.map(f => {
    if (!f.applied) return `# ${f.key}: disabled`;
    switch(f.key) {
      case 'pyrox': return [
        `# Pyrox Thermal: restore disabled state on boot`,
        `PYROX_TOGGLE="${MOD}/script_runner/thermal_toggle"`,
        `[ -x "$PYROX_TOGGLE" ] || chmod 755 "$PYROX_TOGGLE" 2>/dev/null`,
        `sh "$PYROX_TOGGLE" disable 2>/dev/null`,
      ].join('\n');
      default: return `# ${f.key}: applied`;
    }
  }).join('\n');

  const bootLines=[
    '#!/system/bin/sh',
    '# Boot config restore — DavionEngine',
    `FREQ_FILE="${FREQ_FILE}"`,
    `SCREEN_TIMEOUT_FILE="${SCREEN_TIMEOUT_FILE}"`,
    '',
    `echo "${prof}" > ${CFG_DIR}/active_profile`,
    '',
    '# 2. Freq scale',
    `mkdir -p "$(dirname "$FREQ_FILE")"`,
    `echo "${freqVal}" > "$FREQ_FILE"`,
    `chmod 644 "$FREQ_FILE" 2>/dev/null`,
    '',
    '# 3. Freq cap via sysfs on boot (governor set by CPU Profiles on each apply)',
    `_freq_pct=$(cat "$FREQ_FILE" 2>/dev/null | tr -d ' \n'); [ -z "$_freq_pct" ] && _freq_pct=100`,
    `for _base in /sys/devices/system/cpu/cpufreq/policy0 /sys/devices/system/cpu/cpufreq/policy4 /sys/devices/system/cpu/cpufreq/policy6; do`,
    `  [ -d "$_base" ] || continue`,
    `  _max=$(cat "$_base/cpuinfo_max_freq" 2>/dev/null) || continue`,
    `  [ -z "$_max" ] && continue`,
    `  _cap=$(awk -v m="$_max" -v p="$_freq_pct" 'BEGIN{printf "%d", m*(p/100)}')`,
    `  chmod 644 "$_base/scaling_max_freq" 2>/dev/null`,
    `  echo "$_cap" > "$_base/scaling_max_freq" 2>/dev/null || true`,
    `done`,
    '',
    '# 4. RR overlay',
    `service call SurfaceFlinger 1034 i32 1 >/dev/null 2>&1`,
    '',
    '# 5. Universal RR',
    universalLine,
    '',
    '# 6. Per-app RR',
    `for f in ${RR_DIR}/*.mode; do`,
    `  [ -f "$f" ] || continue`,
    `  ( MID=$(tr -d '\\r\\n\\t ' < "$f"); [ -n "$MID" ] && service call SurfaceFlinger 1035 i32 "$MID" >/dev/null 2>&1 ) &`,
    `done`,
    `wait`,
    universalLine,
    '',
    '# 7. Universal brightness',
    universalBrightLine,
    '',
    '# 7b. Universal volume',
    universalVolLine,
    '',
    '# 8. Section 9 features',
    featBootLines,
    '',
    '# 9. Deep Sleep Governor — restore low power mode if flag file present',
    `if [ -f "${CFG_DIR}/low_power_mode" ]; then`,
    `  settings put global low_power 1`,
    `  settings put global low_power_sticky 1`,
    `  settings put global app_auto_restriction_enabled true`,
    `  settings put global forced_app_standby_enabled 1`,
    `  settings put global app_standby_enabled 1`,
    `  settings put global forced_app_standby_for_small_battery_enabled 1`,
    `  ai=$(settings get system ai_preload_user_state 2>/dev/null)`,
    `  [ "$ai" != "null" ] && settings put system ai_preload_user_state 0`,
    `  killall -9 woodpeckerd atfwd perfd magisklogd cnss_diag 2>/dev/null`,
    `  dumpsys deviceidle step 2>/dev/null`,
    `  dumpsys deviceidle step 2>/dev/null`,
    `  dumpsys deviceidle step 2>/dev/null`,
    `  dumpsys deviceidle step 2>/dev/null`,
    `fi`,
    '',
    '',
    '# 11. Boost Color / Saturation restore',
    `SAT_FILE="/sdcard/DAVION_ENGINE_BoostColor/saturation_value"`,
    `if [ -f "$SAT_FILE" ]; then`,
    `  SAT_VAL=$(cat "$SAT_FILE" 2>/dev/null | tr -d '\r\n ')`,
    `  if [ -n "$SAT_VAL" ] && [ "$SAT_VAL" != "1.0" ]; then`,
    `    _sf_wait=0`,
    `    while [ $_sf_wait -lt 30 ]; do`,
    `      service check SurfaceFlinger >/dev/null 2>&1 && break`,
    `      sleep 1; _sf_wait=$((_sf_wait+1))`,
    `    done`,
    `    service call SurfaceFlinger 1022 f $SAT_VAL >/dev/null 2>&1`,
    `  fi`,
    `fi`,
    '',
    '# 12. Screen off timeout restore',
    `_st=$(cat "${SCREEN_TIMEOUT_FILE}" 2>/dev/null | tr -d ' \\n')`,
    `[ -n "$_st" ] && [ "$_st" -gt 0 ] 2>/dev/null && settings put system screen_off_timeout "$_st" || true`,
  ].filter(l=>l!==null).join('\n');

  await exec(
    `mkdir -p ${CFG_DIR} && ` +
    `printf '%s\\n' ${JSON.stringify(bootLines)} > ${CFG_DIR}/boot_apply.sh && ` +
    `chmod 755 ${CFG_DIR}/boot_apply.sh`,
    6000
  );

  // 7. Battery settings
  const clSlider = document.getElementById('charge-limit-slider');
  const clVal = clSlider ? parseInt(clSlider.value) : 80;
  await exec(`mkdir -p ${CFG_DIR} && echo "${clVal}" > ${CHARGE_LIMIT_FILE}`);
  saved.push('BATT');

  // 8. Flash charge daemon state
  await exec(`echo "${flashChargeRunning ? '1' : '0'}" > ${CFG_DIR}/flash_charge_enabled`);

  // 9. Mini toggle states
  const miniToggles = [
    { id: 'btn-bypass-mode',    file: 'bypass_mode'    },
    { id: 'btn-input-suspend',  file: 'input_suspend'  },
    { id: 'btn-oc-protect',     file: 'oc_protect'     },
    { id: 'btn-store-mode',     file: 'store_mode'     },
  ];
  for (const t of miniToggles) {
    const el = document.getElementById(t.id);
    if (el) await exec(`echo "${el.dataset.state}" > ${CFG_DIR}/${t.file}`);
  }

  // 10. CV value
  const cvInp = document.getElementById('input-cv');
  if (cvInp) await exec(`echo "${cvInp.value}" > ${CFG_DIR}/cv_value`);

  // 11. Battery boot section
  const battBootLines = [
    '',
    '# ── Battery / Charging restore ──',
    `FLASH_CHARGE="${MOD}/DAVION_ENGINE/AI_MODE/global_mode/flash_charge"`,
    `CHARGE_LIMIT=$(cat ${CHARGE_LIMIT_FILE} 2>/dev/null || echo 100)`,
    '',
    '# Restore CV',
    `CV=$(cat ${CFG_DIR}/cv_value 2>/dev/null | tr -d '\\r\\n ')`,
    `[ -n "$CV" ] && echo "$CV" > /proc/mtk_battery_cmd/set_cv 2>/dev/null`,
    '',
    '# Stop MTK OC throttle',
    `[ -f /proc/mtk_batoc_throttling/battery_oc_protect_stop ] && echo "stop 1" > /proc/mtk_batoc_throttling/battery_oc_protect_stop 2>/dev/null`,
    `echo 0 > /proc/mtk_batoc_throttling/battery_oc_protect_level 2>/dev/null`,
    '',
    '# Mini toggles',
    `[ "$(cat ${CFG_DIR}/input_suspend 2>/dev/null)" = "on" ] && echo 1 > /sys/class/power_supply/battery/input_suspend 2>/dev/null`,
    `[ "$(cat ${CFG_DIR}/store_mode 2>/dev/null)" = "on" ] && echo 1 > /sys/class/power_supply/battery/store_mode 2>/dev/null`,
    '',
    '# Flash Charge daemon',
    `if [ "$(cat ${CFG_DIR}/flash_charge_enabled 2>/dev/null)" = "1" ]; then`,
    `  chmod 755 "$FLASH_CHARGE" 2>/dev/null`,
    `  nohup sh "$FLASH_CHARGE" >> /sdcard/GovThermal/GovThermal.log 2>&1 &`,
    `fi`,
  ].join('\n');

  await exec(`printf '%s\n' ${JSON.stringify(battBootLines)} >> ${CFG_DIR}/boot_apply.sh`, 4000);

  // 12. Backup
  await exec(`mkdir -p ${MOD}/config && cp -f ${CFG_DIR}/boot_apply.sh ${MOD}/config/boot_apply.sh 2>/dev/null`, 4000);

  const savedStr = saved.length ? saved.join(' · ') : 'CONFIG';
  setStatus(`✓ SAVED · ${savedStr}`);
  showToast(`Saved: ${savedStr}`, 'SAVE', 'success', '◈', 3400);
  if(btn){
    btn.classList.remove('saving'); btn.classList.add('saved');
    btn.querySelector('.save-label').textContent='SAVED';
    setTimeout(()=>{ btn.classList.remove('saved'); btn.querySelector('.save-label').textContent='SAVE'; }, 2500);
  }
}

/* ─────────────────────────────────────────────────────────────
   LOAD — re-applies last saved boot_apply.sh immediately.
   Works after a fresh flash of the same module since
   boot_apply.sh is stored inside the module's config/ folder
   which persists across reflashes (on /data/adb/modules/…).
   ───────────────────────────────────────────────────────────── */
async function loadAllConfig() {
  const btn = document.getElementById('btn-load-config');
  if (btn) { btn.querySelector('.save-label').textContent = '…'; }
  setStatus('⬡ LOADING saved config…');

  // Find the saved boot_apply.sh — prefer sdcard, fall back to module config/
  const BOOT_APPLY_SDCARD = `${CFG_DIR}/boot_apply.sh`;
  const BOOT_APPLY_MODULE = `${MOD}/config/boot_apply.sh`;

  const checkResult = await exec(
    `[ -f "${BOOT_APPLY_SDCARD}" ] && echo "sdcard" || ` +
    `([ -f "${BOOT_APPLY_MODULE}" ] && echo "module") || echo "none"`
  );
  const src = checkResult.trim();

  if (src === 'none') {
    setStatus('⚠ No saved config found — use SAVE first');
    showToast('No saved config found', 'LOAD', 'warn', '⚠');
    if (btn) btn.querySelector('.save-label').textContent = 'LOAD';
    return;
  }

  const applyFile = src === 'sdcard' ? BOOT_APPLY_SDCARD : BOOT_APPLY_MODULE;

  // If loading from module (after reflash), copy to sdcard first so service.sh finds it
  if (src === 'module') {
    await exec(`mkdir -p ${CFG_DIR} && cp -f "${applyFile}" "${BOOT_APPLY_SDCARD}"`);
  }

  // Execute boot_apply.sh to re-apply all saved settings immediately
  await exec(`chmod 755 "${BOOT_APPLY_SDCARD}" && sh "${BOOT_APPLY_SDCARD}" 2>/dev/null`);

  setStatus('✓ Config loaded and applied');
  showToast('Config loaded · All settings applied', 'LOAD', 'success', '⬡', 3400);

  if (btn) {
    btn.querySelector('.save-label').textContent = 'LOADED';
    setTimeout(() => { btn.querySelector('.save-label').textContent = 'LOAD'; }, 2500);
  }

  // Reload UI state to reflect applied values
  setTimeout(() => {
    loadCpuState();
    loadHeaderDeviceInfo();
  }, 1200);
}
/* ═══════════════════════════════════════════════════════════
   § 12b  Gaming · Thermal Disable
   ═══════════════════════════════════════════════════════════ */
const THERMAL_SCRIPT  = `${MOD}/script_runner/thermal_toggle`;
const THERMAL_STATE   = `${CFG_DIR}/thermal_state`;

let gamingThermalDisabled = false;
const watchdogRunning = false; // watchdog removed
let _gamingGraphTimer     = null;

// Historical data for graph (circular buffer, last 20 readings)
const GRAPH_HISTORY = [];
const GRAPH_MAX     = 20;

/* ── Read current thermal state ─────────────────────────── */
async function readGamingThermalState() {
  const [stateRaw, disabledRaw, totalRaw, pidRaw, fpsgoRaw, gpuProtRaw] = await execAll(
    `cat ${THERMAL_STATE} 2>/dev/null || echo enabled`,
    `grep -rl "disabled" /sys/class/thermal/thermal_zone*/mode 2>/dev/null | wc -l`,
    `ls /sys/class/thermal/ 2>/dev/null | grep -c thermal_zone`,

    `cat /sys/kernel/fpsgo/fbt/thrm_enable 2>/dev/null || echo 1`,
    `cat /proc/gpufreq/gpufreq_power_limited 2>/dev/null | grep -c "ignore_thermal_protect 1" || echo 0`
  );

  const state    = stateRaw.trim();
  const disabled = parseInt(disabledRaw.trim()) || 0;
  const total    = parseInt(totalRaw.trim())    || 0;
  const pid      = pidRaw.trim();
  const fpsgoOk  = fpsgoRaw.trim() === '0';
  const gpuOk    = parseInt(gpuProtRaw.trim()) > 0;

  gamingThermalDisabled = (state === 'disabled');
  watchdogRunning       = pid.length > 0;

  // Push to history
  GRAPH_HISTORY.push({ ts: Date.now(), disabled, total, thermalOff: gamingThermalDisabled });
  if (GRAPH_HISTORY.length > GRAPH_MAX) GRAPH_HISTORY.shift();

  updateGamingUI(disabled, total, fpsgoOk, gpuOk);
  drawThermalGraph();
}

/* ── Update UI elements ─────────────────────────────────── */
function updateGamingUI(disabled, total, fpsgoDisabled, gpuUnlocked) {
  const btn     = document.getElementById('btn-gaming-thermal');
  const label   = document.getElementById('gaming-thermal-label');
  const ribbon  = document.getElementById('gaming-status-ribbon');
  const rIcon   = document.getElementById('gaming-ribbon-icon');
  const rText   = document.getElementById('gaming-ribbon-text');
  const wdBadge = document.getElementById('gaming-watchdog-badge');

  // Toggle button state
  if (btn) btn.setAttribute('aria-pressed', gamingThermalDisabled ? 'true' : 'false');
  if (label) label.textContent = gamingThermalDisabled ? 'DISABLED' : 'ENABLED';

  // Ribbon
  if (ribbon) {
    ribbon.classList.toggle('ribbon-danger', gamingThermalDisabled);
    if (gamingThermalDisabled) {
      if (rIcon) rIcon.textContent = '🔥';
      if (rText) rText.textContent = `Thermal DISABLED — ${disabled}/${total} zones frozen · MAX PERFORMANCE`;
    } else {
      if (rIcon) rIcon.textContent = '🟢';
      if (rText) rText.textContent = `Thermal protection ACTIVE — device safe`;
    }
  }

  // Watchdog badge
  if (wdBadge) {


  }

  // Metrics
  const setM = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  setM('gm-zones-disabled', total > 0 ? `${disabled} / ${total}` : '—');
  setM('gm-daemons',        gamingThermalDisabled ? 'FROZEN' : 'RUNNING');
  setM('gm-cpu-limit',      gamingThermalDisabled ? '125°C' : 'DEFAULT');
  setM('gm-gpu-protect',    gpuUnlocked ? 'BYPASSED' : 'ENFORCED');

  // Zone chips
  const zonesEl = document.getElementById('gaming-graph-zones');
  if (zonesEl && total > 0) {
    const mtk = ['tzcpu','tzpmic','tzbattery','tzpa','tzcharger','tzwmt','tzbts','tzbtsnrpa','tzbtspa'];
    zonesEl.innerHTML = mtk.map(z => {
      const cls = gamingThermalDisabled ? 'gz-chip--raised' : 'gz-chip--active';
      return `<span class="gz-chip ${cls}">${z}</span>`;
    }).join('') +
    `<span class="gz-chip ${gamingThermalDisabled ? 'gz-chip--disabled' : 'gz-chip--active'}">${disabled} sysfs zones</span>`;
  }
}

/* ── Draw thermal graph ─────────────────────────────────── */
function drawThermalGraph() {
  const canvas = document.getElementById('thermalGraphCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  // Background gradient
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, 'rgba(0,0,0,0.5)');
  bg.addColorStop(1, 'rgba(0,0,0,0.2)');
  ctx.fillStyle = bg;
  ctx.roundRect(0, 0, W, H, 8);
  ctx.fill();

  // Grid lines
  ctx.strokeStyle = 'rgba(255,255,255,0.04)';
  ctx.lineWidth = 1;
  for (let i = 1; i < 5; i++) {
    const y = (H / 5) * i;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }
  for (let i = 1; i < GRAPH_MAX; i++) {
    const x = (W / GRAPH_MAX) * i;
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
  }

  if (GRAPH_HISTORY.length < 2) {
    // Not enough data — draw placeholder bars
    const zones = [
      { label:'tzcpu',      state: gamingThermalDisabled ? 'raised' : 'active', temp: 95 },
      { label:'tzpmic',     state: gamingThermalDisabled ? 'raised' : 'active', temp: 72 },
      { label:'tzbattery',  state: gamingThermalDisabled ? 'raised' : 'active', temp: 38 },
      { label:'tzpa',       state: gamingThermalDisabled ? 'raised' : 'active', temp: 61 },
      { label:'tzcharger',  state: gamingThermalDisabled ? 'disabled': 'active', temp: 45 },
      { label:'tzwmt',      state: gamingThermalDisabled ? 'disabled': 'active', temp: 55 },
      { label:'tzbts',      state: gamingThermalDisabled ? 'raised' : 'active', temp: 68 },
      { label:'sysfs zones',state: gamingThermalDisabled ? 'disabled': 'active', temp: 80 },
    ];
    const barW = W / zones.length - 6;
    zones.forEach((z, i) => {
      const barH = (z.temp / 130) * (H - 40);
      const x = i * (W / zones.length) + 3;
      const y = H - barH - 20;
      const color = z.state === 'disabled' ? '#ff4450'
                  : z.state === 'raised'   ? '#ffaa00'
                  : 'var(--a)';
      const grad = ctx.createLinearGradient(x, y, x, H - 20);
      grad.addColorStop(0, z.state === 'disabled' ? 'rgba(255,68,80,0.8)'
                          : z.state === 'raised'   ? 'rgba(255,170,0,0.8)'
                          : 'rgba(100,220,100,0.8)');
      grad.addColorStop(1, 'rgba(0,0,0,0.1)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.roundRect(x, y, barW, barH, [3,3,0,0]);
      ctx.fill();

      // Glow line at top
      ctx.strokeStyle = z.state === 'disabled' ? 'rgba(255,68,80,0.9)'
                      : z.state === 'raised'   ? 'rgba(255,170,0,0.9)'
                      : 'rgba(100,255,120,0.9)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + barW, y); ctx.stroke();

      // Label
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.font = '8px "Share Tech Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(z.label.slice(0, 6), x + barW / 2, H - 4);

      // Temp
      ctx.fillStyle = z.state === 'disabled' ? '#ff7080'
                    : z.state === 'raised'   ? '#ffcc44'
                    : 'rgba(150,255,150,0.9)';
      ctx.fillText(`${z.temp}°`, x + barW / 2, y - 4);
    });

    // Legend overlay
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.font = '10px "Share Tech Mono", monospace';
    ctx.textAlign = 'left';
    ctx.fillText(gamingThermalDisabled ? '⚡ THERMAL DISABLED — 125°C LIMIT' : '✔ THERMAL ACTIVE — NORMAL LIMITS', 8, 16);
    return;
  }

  // Time-series line chart (disabled zone count over time)
  const maxTotal = Math.max(...GRAPH_HISTORY.map(d => d.total), 1);
  const ptsOff   = GRAPH_HISTORY.map((d, i) => ({
    x: (i / (GRAPH_MAX - 1)) * W,
    y: H - 20 - ((d.disabled / maxTotal) * (H - 40))
  }));

  // Fill area
  const fillGrad = ctx.createLinearGradient(0, 0, 0, H);
  fillGrad.addColorStop(0, gamingThermalDisabled ? 'rgba(255,68,80,0.35)' : 'rgba(100,255,120,0.2)');
  fillGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = fillGrad;
  ctx.beginPath();
  ctx.moveTo(ptsOff[0].x, H - 20);
  ptsOff.forEach(p => ctx.lineTo(p.x, p.y));
  ctx.lineTo(ptsOff[ptsOff.length - 1].x, H - 20);
  ctx.closePath();
  ctx.fill();

  // Line
  ctx.strokeStyle = gamingThermalDisabled ? '#ff4450' : 'var(--a, #44ff88)';
  ctx.lineWidth   = 2;
  ctx.shadowBlur  = 8;
  ctx.shadowColor = gamingThermalDisabled ? 'rgba(255,68,80,0.6)' : 'rgba(100,255,120,0.5)';
  ctx.beginPath();
  ptsOff.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Dots
  ptsOff.forEach(p => {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
    ctx.fillStyle = gamingThermalDisabled ? '#ff7080' : '#88ffaa';
    ctx.fill();
  });

  // Y-axis label
  ctx.fillStyle  = 'rgba(255,255,255,0.3)';
  ctx.font       = '9px "Share Tech Mono", monospace';
  ctx.textAlign  = 'left';
  ctx.fillText(`${maxTotal} zones`, 4, 12);
  ctx.fillText('0', 4, H - 22);

  // Status text
  const latest = GRAPH_HISTORY[GRAPH_HISTORY.length - 1];
  ctx.fillStyle = gamingThermalDisabled ? '#ff7080' : '#88ffaa';
  ctx.font      = '10px "Share Tech Mono", monospace';
  ctx.textAlign = 'right';
  ctx.fillText(
    gamingThermalDisabled
      ? `DISABLED · ${latest.disabled}/${latest.total} zones frozen`
      : `ACTIVE · ${latest.disabled} zones off / ${latest.total}`,
    W - 8, 14
  );
}

/* ── Apply / Remove thermal disable ─────────────────────── */
async function applyGamingThermal(disable) {
  setStatus(disable ? '🔥 Disabling thermal…' : '🟢 Restoring thermal…', 'var(--a)');
  await exec(`sh "${THERMAL_SCRIPT}" ${disable ? 'disable' : 'enable'}`);
  if (!disable && watchdogRunning) {
    // Stop watchdog by writing enabled state (watchdog self-exits)
    await exec(`echo "enabled" > ${THERMAL_STATE}`);


  }
  await readGamingThermalState();
  setStatus(disable ? '🔥 Thermal DISABLED — gaming mode active' : '🟢 Thermal restored', 'var(--a)');
  showToast(disable?'Thermal throttle disabled':'Thermal restored','THERMAL',disable?'warn':'success',disable?'🔥':'🟢');
}

/* ── Toggle watchdog ────────────────────────────────────── */
async function toggleGamingWatchdog() {
  if (!gamingThermalDisabled) {
    setStatus('⚠ Enable thermal disable first', '#ffcc00'); return;
  }
  if (watchdogRunning) {


    setStatus('👁 Watchdog stopped');
    showToast('Thermal watchdog stopped','WATCHDOG','info','👁');
  } else {


    setStatus('👁 Watchdog started — re-applies freeze every 20s');
    showToast('Watchdog active — re-applies every 20s','WATCHDOG','success','👁');
  }
  await readGamingThermalState();
}

/* ── Init gaming thermal section ────────────────────────── */
function initGamingThermal() {
  document.getElementById('btn-gaming-thermal')?.addEventListener('click', () => {
    applyGamingThermal(!gamingThermalDisabled);
  });
  document.getElementById('btn-gaming-watchdog')?.addEventListener('click', toggleGamingWatchdog);
  document.getElementById('btn-gaming-apply')?.addEventListener('click', () => {
    applyGamingThermal(gamingThermalDisabled); // re-apply current state
    setStatus('⚡ Thermal config re-applied');
  });

  // Start polling
  readGamingThermalState();
  clearInterval(_gamingGraphTimer);
  _gamingGraphTimer = setInterval(readGamingThermalState, 6000);

  // Redraw on resize
  window.addEventListener('resize', drawThermalGraph, { passive: true });
}

/* ═══════════════════════════════════════════════════════════
   § 14  Main init
   ═══════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded',async()=>{
  // ── Auto-update: run in background, show toast when done ──
  const AUTO_UPDATE_SCRIPT = `${MOD}/script_runner/de_autoupdate`;
  const STATUS_FILE = '/dev/.davion_update_status';

  // Clear previous status
  exec(`rm -f ${STATUS_FILE} 2>/dev/null`).then(() => {
    // Run updater in background (non-blocking)
    exec(`chmod 755 "${AUTO_UPDATE_SCRIPT}" 2>/dev/null && sh "${AUTO_UPDATE_SCRIPT}" &`);

    // Poll for result every 3s, max 60s
    let _updatePoll = 0;
    const _updateTimer = setInterval(async () => {
      _updatePoll++;
      if (_updatePoll > 20) { clearInterval(_updateTimer); return; }
      const status = (await exec(`cat ${STATUS_FILE} 2>/dev/null`)).trim();
      if (!status || status === 'checking') return;
      clearInterval(_updateTimer);
      if (status.startsWith('updated:')) {
        const count = status.split(':')[1];
        showToast(`${count} file(s) updated from GitHub`, 'AUTO UPDATE', 'success', '🔄');
        // If webroot changed, reload page after short delay
        const fullStatus = (await exec(`cat ${STATUS_FILE} 2>/dev/null`)).trim();
        if (fullStatus.includes('reload')) {
          setTimeout(() => location.reload(), 2500);
        }
      }
      // 'up_to_date', 'offline', 'error' — silent, no toast
    }, 3000);
  });

  initTheme();
  initFabSettings();
  _initAllSliderFills();

  // Set --header-h so sticky panel summaries sit flush under the sticky header
  function _updateHeaderHeight() {
    const h = document.querySelector('.nexus-header');
    if (h) document.documentElement.style.setProperty('--header-h', h.offsetHeight + 'px');
  }
  // Initial set + re-measure after fonts/content load
  _updateHeaderHeight();
  window.addEventListener('resize', _updateHeaderHeight, { passive: true });
  setTimeout(_updateHeaderHeight, 500);

  // Set --panel-summary-h per panel so panel-controls-sticky knows where to stick
  function _updatePanelSummaryHeight(panelEl) {
    const summary = panelEl?.querySelector('.panel-summary');
    if (summary) {
      const h = summary.offsetHeight;
      panelEl.style.setProperty('--panel-summary-h', h + 'px');
    }
  }
  // Wire to every panel's details toggle
  document.querySelectorAll('.nexus-panel').forEach(panel => {
    const det = panel.querySelector('.panel-details');
    if (!det) return;
    det.addEventListener('toggle', () => {
      _updatePanelSummaryHeight(panel);
      _applyPanelFocus();
    }, { passive: true });
    _updatePanelSummaryHeight(panel);
  });
  window.addEventListener('resize', () => {
    document.querySelectorAll('.nexus-panel').forEach(p => _updatePanelSummaryHeight(p));
  }, { passive: true });

  function _applyPanelFocus() {
    const openPanel = document.querySelector('.nexus-panel .panel-details[open]')?.closest('.nexus-panel');
    const statusBar = document.getElementById('main-status-bar');
    document.querySelectorAll('.nexus-panel').forEach(p => {
      if (p.dataset.hiddenByToggle === '1') return;
      if (openPanel) {
        p.style.display = (p === openPanel) ? '' : 'none';
      } else {
        p.style.display = '';
      }
    });
    if (statusBar) statusBar.style.display = openPanel ? 'none' : '';
  }

  initGameListPanel();
  initIdle60Panel();
  initDeepSleep();
  initBattSaver();
  initGpuPanel();
  initCpu();
  initCpuProfilesPanel();
  initHeaderToggles();
  startThermalMonitor();
  initGamingThermal();
  initBatteryPanel();
  initBoostColorPanel();
  initAnimScalePanel();
  initKillOthersPanel();
  initConnLaunchPanel();
  initFeaturesPanel();
  initDeviceSpoofPanel();
  initFeaturesModal();
  initStormGuard();
  initBusybox();
  initRawCam();
  initZramManager();
  initUniversalBrightness();
  initUniversalVolume();
  initUniversalScreenTimeout();
  initHeadsetConfig();
  initCoolMode();
  initCpuVoltOptimizer();
  initPyroxThermal();
  initBrightnessSlider();
  initVolumeSlider();
  initSwipeGestures();
  initGlobalSearch();

  document.getElementById('btn-save-config')?.addEventListener('click',saveAllConfig);

  // Popup wiring
  document.getElementById('floating-popup')?.addEventListener('click', e => {
    if (e.target === e.currentTarget) closePopup();
  });
  document.getElementById('btn-dismiss')?.addEventListener('click', closePopup);
  document.getElementById('popup-spare60-btn')?.addEventListener('click', () => {
    const btn   = document.getElementById('popup-spare60-btn');
    const label = document.getElementById('popup-spare60-label');
    const on    = btn?.getAttribute('aria-pressed') !== 'true';
    btn?.setAttribute('aria-pressed', String(on));
    btn?.classList.toggle('gaming-toggle-btn--on', on);
    const thumb = btn?.querySelector('.popup-toggle-thumb');
    if (thumb) thumb.style.transform = on ? 'translateX(16px)' : '';
    if (label) label.textContent = on ? 'ON' : 'OFF';
  }, { passive: true });

  // ── Per-app Headset Volume controls ──────────────────────────────────────
  document.getElementById('popup-hvol-toggle')?.addEventListener('click', () => {
    const btn      = document.getElementById('popup-hvol-toggle');
    const label    = document.getElementById('popup-hvol-label');
    const controls = document.getElementById('popup-hvol-controls');
    if (!btn) return;
    const on = btn.getAttribute('aria-pressed') !== 'true';
    btn.setAttribute('aria-pressed', String(on));
    btn.classList.toggle('gaming-toggle-btn--on', on);
    const thumb = btn.querySelector('.popup-toggle-thumb');
    if (thumb) thumb.style.transform = on ? 'translateX(16px)' : '';
    if (label)    label.textContent = on ? 'ON' : 'OFF';
    if (controls) {
      controls.style.opacity       = on ? '1' : '0.35';
      controls.style.pointerEvents = on ? '' : 'none';
    }
    // Sync summary label
    const sv = document.getElementById('popup-hvol-summary-val');
    const vol = parseInt(document.getElementById('popup-hvol-slider')?.value ?? 7);
    if (sv) sv.textContent = on ? `ON · ${vol}/15` : 'OFF';
  }, { passive: true });

  document.getElementById('popup-hvol-slider')?.addEventListener('input', function () {
    const v     = parseInt(this.value);
    const valEl = document.getElementById('popup-hvol-val');
    if (valEl) valEl.textContent = `${v} / 15`;
    _syncSliderFill(this);
    // Sync summary label if toggle is ON
    const togOn = document.getElementById('popup-hvol-toggle')?.getAttribute('aria-pressed') === 'true';
    const sv = document.getElementById('popup-hvol-summary-val');
    if (sv && togOn) sv.textContent = `ON · ${v}/15`;
  }, { passive: true });
  // Also close when clicking the X button (btn-dismiss is now in header)

  document.getElementById('btn-apply')?.addEventListener('click', applyRefreshLock);

  // ── Popup Brightness ±1 step buttons ─────────────────────
  function _stepSlider(sliderId, valId, delta) {
    const sl = document.getElementById(sliderId);
    const vl = document.getElementById(valId);
    if (!sl) return;
    const min = parseInt(sl.min), max = parseInt(sl.max);
    let v = parseInt(sl.value) + delta;
    if (v < min) v = min;
    if (v > max) v = max;
    sl.value = v;
    sl.dispatchEvent(new Event('input', { bubbles: true }));
    if (vl) vl.textContent = v === -1 ? 'Default' : String(v);
  }
  document.getElementById('popup-bright-dec')?.addEventListener('click', () =>
    _stepSlider('popup-bright-slider', 'popup-bright-val', -1));
  document.getElementById('popup-bright-inc')?.addEventListener('click', () =>
    _stepSlider('popup-bright-slider', 'popup-bright-val', +1));
  document.getElementById('popup-vol-dec')?.addEventListener('click', () =>
    _stepSlider('popup-vol-slider', 'popup-vol-val', -1));
  document.getElementById('popup-vol-inc')?.addEventListener('click', () =>
    _stepSlider('popup-vol-slider', 'popup-vol-val', +1));

  document.getElementById('popup-hvol-dec')?.addEventListener('click', () => {
    const sl = document.getElementById('popup-hvol-slider');
    if (!sl) return;
    const v = Math.max(0, parseInt(sl.value) - 1);
    sl.value = v;
    sl.dispatchEvent(new Event('input', { bubbles: true }));
  });
  document.getElementById('popup-hvol-inc')?.addEventListener('click', () => {
    const sl = document.getElementById('popup-hvol-slider');
    if (!sl) return;
    const v = Math.min(15, parseInt(sl.value) + 1);
    sl.value = v;
    sl.dispatchEvent(new Event('input', { bubbles: true }));
  });

  // ── Per-app screen off timeout chips ─────────────────────────────────
  document.getElementById('popup-screentimeout-chips')?.addEventListener('click', e => {
    const chip = e.target.closest('.screentimeout-chip');
    if (!chip) return;
    const ms = parseInt(chip.dataset.ms);
    // ms=0 means "DEFAULT" chip → clear the per-app override
    _popupScreentimeoutMs = ms > 0 ? ms : null;
    _updateScreenTimeoutChips('popup-screentimeout-chips', _popupScreentimeoutMs);
    const valEl = document.getElementById('popup-screentimeout-val');
    if (valEl) valEl.textContent = _popupScreentimeoutMs ? _msToScreenLabel(_popupScreentimeoutMs) : 'DEFAULT';  }, { passive: true });
  document.getElementById('popup-sat-slider')?.addEventListener('input', function() {
    const v = parseInt(this.value);
    const lbl = document.getElementById('popup-sat-val');
    if (lbl) lbl.textContent = v === -1 ? 'Default' : (v / 10).toFixed(1) + 'x';
    _updatePopupSatFill(v);
  }, { passive: true });
  document.getElementById('popup-sat-dec')?.addEventListener('click', () => {
    const sl = document.getElementById('popup-sat-slider');
    const vl = document.getElementById('popup-sat-val');
    if (!sl) return;
    let v = Math.max(-1, parseInt(sl.value) - 1);
    sl.value = v;
    sl.dispatchEvent(new Event('input', { bubbles: true }));
    if (vl) vl.textContent = v === -1 ? 'Default' : (v / 10).toFixed(1) + 'x';
  });
  document.getElementById('popup-sat-inc')?.addEventListener('click', () => {
    const sl = document.getElementById('popup-sat-slider');
    const vl = document.getElementById('popup-sat-val');
    if (!sl) return;
    let v = Math.min(20, parseInt(sl.value) + 1);
    sl.value = v;
    sl.dispatchEvent(new Event('input', { bubbles: true }));
    if (vl) vl.textContent = v === -1 ? 'Default' : (v / 10).toFixed(1) + 'x';
  });

  // ══════════════════════════════════════════════════════════
  // Kill Others + Connection on Launch — DOM wiring
  // ══════════════════════════════════════════════════════════

  function _killothersBlFriendlyName(pkg) {
    return getAppLabel(pkg);
  }

  function _killothersBlUpdateCount() {
    const el = document.getElementById('killothers-bl-count');
    if (el) el.textContent = _killothersBl.size ? `${_killothersBl.size} spared` : '0 selected';
  }

  function _killothersBlMakeRow(pkg) {
    const row  = document.createElement('div');
    const isSel = _killothersBl.has(pkg);
    row.className  = 'app-row' + (isSel ? ' sel' : '');
    row.dataset.pkg = pkg;
    const name = _killothersBlFriendlyName(pkg);
    row.innerHTML =
      `<div class="app-icon-wrap"><img class="app-icon" alt="${name}" onerror="this.style.opacity='0.15'" src="ksu://icon/${pkg}"></div>` +
      `<div class="app-name-col"><span class="app-name">${name}</span><span class="app-pkg">${pkg}</span></div>` +
      `<div class="killothers-bl-check"><span class="killothers-bl-check-tick">✓</span></div>`;
    row.addEventListener('click', () => {
      if (_killothersBl.has(pkg)) _killothersBl.delete(pkg);
      else _killothersBl.add(pkg);
      row.classList.toggle('sel', _killothersBl.has(pkg));
      _killothersBlUpdateCount();
    });
    return row;
  }

  function _killothersBlRender() {
    const list = document.getElementById('killothers-bl-list');
    if (!list) return;
    const q       = _killothersBlQuery;
    const allPkgs = _killothersBlPkgs.filter(p => !q || p.toLowerCase().includes(q));
    if (!allPkgs.length) {
      list.innerHTML = '<span class="killothers-bl-placeholder mono">No apps found</span>';
      return;
    }
    const spared = allPkgs.filter(p =>  _killothersBl.has(p));
    const rest   = allPkgs.filter(p => !_killothersBl.has(p));
    const frag   = document.createDocumentFragment();

    if (spared.length) {
      const hdr = document.createElement('div');
      hdr.className = 'killothers-bl-section-hdr';
      hdr.innerHTML = `<span class="mono">🛡 SPARED</span><span class="killothers-bl-section-count mono">${spared.length}</span>`;
      frag.appendChild(hdr);
      spared.forEach(pkg => frag.appendChild(_killothersBlMakeRow(pkg)));
    }
    if (spared.length && rest.length) {
      const div = document.createElement('div');
      div.className = 'killothers-bl-divider';
      div.innerHTML = '<span class="killothers-bl-divider-label mono">— WILL BE KILLED —</span>';
      frag.appendChild(div);
    }
    if (rest.length) {
      if (!spared.length) {
        const hdr = document.createElement('div');
        hdr.className = 'killothers-bl-section-hdr killothers-bl-section-hdr--kill';
        hdr.innerHTML = `<span class="mono">⏹ WILL BE KILLED</span><span class="killothers-bl-section-count mono">${rest.length}</span>`;
        frag.appendChild(hdr);
      }
      rest.forEach(pkg => frag.appendChild(_killothersBlMakeRow(pkg)));
    }
    list.innerHTML = '';
    list.appendChild(frag);
  }

  // Connection on Launch is now managed in Panel 07 — no popup wiring needed

  document.getElementById('btn-unlock')?.addEventListener('click', () => {
    if (rrActive) clearUniversalRR();
    else {
      const first = document.querySelector('#universal-rr-buttons .rr-btn');
      if (first) setUniversalRR(first.dataset.id, first.dataset.label);
    }
  });

  // ── Universal RR spare from 60Hz drop toggle ────────────────
  const UNIV_SPARE60_FILE = `${CFG_DIR}/idle60_spare_universal`;

  const _syncUnivSpare60 = (on) => {
    const btn   = document.getElementById('btn-univ-rr-spare60');
    const label = document.getElementById('univ-rr-spare60-label');
    if (btn) {
      btn.setAttribute('aria-pressed', String(on));
      btn.classList.toggle('gaming-toggle-btn--on', on);
      const thumb = btn.querySelector('.popup-toggle-thumb');
      if (thumb) thumb.style.transform = on ? 'translateX(16px)' : '';
    }
    if (label) label.textContent = on ? 'ON' : 'OFF';
  };

  // Load saved state
  exec(`[ -f "${UNIV_SPARE60_FILE}" ] && echo 1 || echo 0`).then(r => {
    _syncUnivSpare60(r.trim() === '1');
  });

  document.getElementById('btn-univ-rr-spare60')?.addEventListener('click', async () => {
    const btn = document.getElementById('btn-univ-rr-spare60');
    const isOn = btn?.getAttribute('aria-pressed') === 'true';
    const next = !isOn;
    _syncUnivSpare60(next);
    if (next) {
      await exec(`touch "${UNIV_SPARE60_FILE}"`);
      showToast('Universal RR spared from 60Hz drop', 'AUTO 60HZ', 'success', '🛡');
    } else {
      await exec(`rm -f "${UNIV_SPARE60_FILE}"`);
      showToast('Universal RR no longer spared', 'AUTO 60HZ', 'info', '🖥️');
    }
  }, { passive: true });

  // Universal RR idle delay buttons
  document.getElementById('univ-idle60-delay-btns')?.addEventListener('click', async e => {
    const btn = e.target.closest('[data-udelay]');
    if (!btn) return;
    e.stopPropagation();
    _idle60Delay = parseInt(btn.dataset.udelay);
    _renderIdle60Delay();
    const gl = document.getElementById('univ-idle60-gear-label');
    if (gl) gl.textContent = `⚙ ${_idle60Delay}s`;
    document.querySelectorAll('#univ-idle60-delay-btns [data-udelay]').forEach(b =>
      b.classList.toggle('nexus-btn--active', parseInt(b.dataset.udelay) === _idle60Delay)
    );
    _closeIdleDelaySheet();
    await exec(`echo '${_idle60Delay}' > ${IDLE60_DELAY_FILE}`);
    if (_idle60Enabled) await _applyIdle60Daemon();
  });

  // Probe CGI in browser mode
  if(_BROWSER_MODE){
    await _probeCgi();
    const dbg = document.getElementById('debug-msg');
    if(dbg){
      dbg.textContent = _cgiOk
        ? 'SYS READY · BROWSER MODE · CGI OK'
        : 'BROWSER MODE · CGI FAILED — check /cgi-bin/test.sh';
    }
  }

  // ── Fire all non-dependent init tasks in parallel ─────────────────────────
  const [savedTheme] = await Promise.all([
    // Theme restore
    exec(`cat ${THEME_FILE} 2>/dev/null`),
    // Device limits (brightness + volume caps)
    detectDeviceLimits(),
    // Overlay ON immediately
    exec(`mkdir -p ${RR_CFG} && su -c "service call SurfaceFlinger 1034 i32 1"`),
    // Force logcat detection flag
    exec(`touch ${RR_CFG}/enable_logcat && rm -f ${RR_CFG}/enable_dumpsys`),
  ]);

  // Apply theme
  applyTheme(THEMES.includes(savedTheme.trim()) ? savedTheme.trim() : 'black');

  // Update UI for overlay + detection
  overlayOn = true;
  const ovEl = document.getElementById('mon_overlay');
  if (ovEl) { ovEl.textContent = 'ON'; ovEl.className = 'stat-pill-val on'; }
  const detEl = document.getElementById('detection-status');
  if (detEl) { detEl.textContent = 'Logcat'; detEl.className = 'stat-pill-val on'; }

  // ── Launch all remaining loads in parallel ───────────────────────────────
  loadHeaderDeviceInfo();
  setInterval(loadHeaderDeviceInfo, 10000);
  readThermalState();

  await Promise.all([loadUniversalRR(), loadAppList(), loadGameListPanel()]);
  // Re-render panels that hide games, now that _glPkgs is populated
  renderAppTab(_activeTab);
  if (_koLoaded) renderKoList();
  if (_clLoaded) renderClList();
  // initAppSearch removed — search bars no longer in panels

},{once:true});

/* ── Pause intervals when page is hidden to save resources ── */
const _allTimers = [];
const _origSetInterval = window.setInterval;
// Use visibility API to pause canvas animation (already handled)
// Throttle all active intervals when hidden
document.addEventListener('visibilitychange', () => {
  if (typeof _battTimer !== 'undefined') {
    if (document.hidden) {
      clearInterval(_battTimer);
      clearInterval(_thermTimer);
    } else {
      _battTimer    = setInterval(readBatteryState, 6000);
      _thermTimer   = setInterval(readThermalState, 5000);
    }
  }
}, { passive: true });

/* ═══════════════════════════════════════════════════════════
   § CONN LAUNCH PANEL · Connection on Launch (Panel 07)
   ═══════════════════════════════════════════════════════════ */

let _clPkgs      = [];   // all installed packages
let _clIdleWifiOff = false;  // idle WiFi-off feature
let _clIdleDataOff = false;  // idle Data-off feature
let _clState     = {};   // { pkg: 'wifi' | 'data' | 'both' | null }
let _clQuery     = '';
let _clLoaded    = false;
let _clActiveTab = 'user';

const CL_TYPES = {
  wifi: { icon: '📶', label: 'WiFi',  color: '#60cfff' },
  data: { icon: '📡', label: 'Data',  color: '#a78bfa' },
  both: { icon: '⚡', label: 'Both',  color: 'var(--a)' },
};

/* ── Load data from disk ─────────────────────────────────── */
async function loadConnLaunchPanel() {
  const list = document.getElementById('cl-app-list');
  if (!list) return;
  list.innerHTML = '<span class="list-placeholder mono">Loading…</span>';

  // Reuse shared package list from panel 02 if already loaded
  const sharedPkgs = (_userPkgs.length || _systemPkgs.length)
    ? [...new Set([..._userPkgs, ..._systemPkgs])].sort()
    : null;

  // Load idle WiFi-off feature state
  const idleWifiRaw = await exec(`[ -f ${CONN_IDLE_WIFI_OFF_FILE} ] && echo 1 || echo 0`);
  _clIdleWifiOff = idleWifiRaw.trim() === '1';
  _renderIdleWifiToggle();

  // Load idle Data-off feature state
  const idleDataRaw = await exec(`[ -f ${CONN_IDLE_DATA_OFF_FILE} ] && echo 1 || echo 0`);
  _clIdleDataOff = idleDataRaw.trim() === '1';
  _renderIdleDataToggle();

  const [pkgs, connFilesRaw] = await Promise.all([
    sharedPkgs
      ? Promise.resolve(sharedPkgs)
      : Promise.all([
          exec(`pm list packages -3 | cut -d: -f2 | sort`),
          exec(`pm list packages -s | cut -d: -f2 | sort`)
        ]).then(([u, s]) => [...new Set([
          ...u.trim().split('\n').filter(Boolean),
          ...s.trim().split('\n').filter(Boolean)
        ])].sort()),
    exec(`find ${RR_DIR} -maxdepth 1 -name '*.conn' 2>/dev/null | while read f; do echo "$(basename "$f" .conn):$(cat "$f" 2>/dev/null)"; done`)
  ]);

  _clPkgs = pkgs;
  _clState = {};
  _clPkgs.forEach(p => { _clState[p] = null; });

  connFilesRaw.trim().split('\n').filter(Boolean).forEach(line => {
    const [pkg, type] = line.split(':');
    if (pkg && (type === 'wifi' || type === 'data' || type === 'both')) {
      _clState[pkg] = type;
    }
  });

  _clLoaded = true;
  _updateClMetrics();
  renderClList();
}

/* ── Metrics ─────────────────────────────────────────────── */
function _updateClMetrics() {
  const cfgPkgs = _clPkgs.filter(p => _clState[p] !== null && !_isGame(p));
  const userCfg = cfgPkgs.filter(p => _userPkgs.includes(p)).length;
  const sysCfg  = cfgPkgs.filter(p => !_userPkgs.includes(p)).length;

  const s = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  s('cl-count-user',   _userPkgs.filter(p => !_clState[p] && !_isGame(p)).length);
  s('cl-count-system', _systemPkgs.filter(p => !_clState[p] && !_isGame(p)).length);
  s('cl-count-cfg',    cfgPkgs.length);
  s('cl-count-all',    _clPkgs.filter(p => !_isGame(p)).length);

  const ribbon = document.getElementById('cl-ribbon');
  const txt    = document.getElementById('cl-ribbon-text');
  const total  = cfgPkgs.length;
  if (txt) txt.textContent = total > 0
    ? `${total} app${total !== 1 ? 's' : ''} configured — connection auto-toggled on launch`
    : 'Auto-enable WiFi or Data when selected apps open';
  if (ribbon) ribbon.classList.toggle('ribbon-applied', total > 0);
}


function _clFriendlyName(pkg) {
  return getAppLabel(pkg);
}

/* ── Render app list ─────────────────────────────────────── */
function renderClList() {
  const list = document.getElementById('cl-app-list');
  if (!list) return;

  const q = _clQuery.toLowerCase().trim();

  let pool;
  if (_clActiveTab === 'user')        pool = _userPkgs.filter(p => !_clState[p] && !_isGame(p));
  else if (_clActiveTab === 'system') pool = _systemPkgs.filter(p => !_clState[p] && !_isGame(p));
  else if (_clActiveTab === 'configured') pool = _clPkgs.filter(p => _clState[p] !== null && !_isGame(p));
  else pool = _clPkgs.filter(p => !_isGame(p));

  const filtered = pool.filter(p =>
    !q || p.toLowerCase().includes(q) || _clFriendlyName(p).toLowerCase().includes(q)
  );

  // Update tab active states
  document.querySelectorAll('[data-cltab]').forEach(btn => {
    const active = btn.dataset.cltab === _clActiveTab;
    btn.classList.toggle('app-tab--active', active);
    btn.setAttribute('aria-selected', active ? 'true' : 'false');
  });

  if (!filtered.length) {
    list.innerHTML = `<span class="list-placeholder mono">${q ? 'No apps match' : 'No apps found'}</span>`;
    return;
  }

  const frag = document.createDocumentFragment();

  if (_clActiveTab === 'configured' || _clActiveTab === 'all') {
    const cfg  = filtered.filter(p => _clState[p] !== null);
    const rest = filtered.filter(p => _clState[p] === null);
    if (cfg.length) {
      const hdr = document.createElement('div');
      hdr.className = 'list-divider';
      hdr.style.cssText = 'pointer-events:none;cursor:default;border-left:3px solid #60cfff;background:rgba(96,207,255,0.05);';
      hdr.innerHTML = `<span class="divider-text mono" style="color:#60cfff;">CONFIGURED (${cfg.length})</span>`;
      frag.appendChild(hdr);
      cfg.forEach(p => frag.appendChild(_buildClRow(p)));
    }
    if (rest.length && _clActiveTab === 'all') {
      const hdr2 = document.createElement('div');
      hdr2.className = 'list-divider';
      hdr2.style.cssText = 'pointer-events:none;cursor:default;';
      hdr2.innerHTML = `<span class="divider-text mono">ALL APPS (${rest.length})</span>`;
      frag.appendChild(hdr2);
      rest.forEach(p => frag.appendChild(_buildClRow(p)));
    }
  } else {
    _sortAZ(filtered).forEach(p => frag.appendChild(_buildClRow(p)));
  }

  list.innerHTML = '';
  list.appendChild(frag);
  loadVisibleIcons('cl-app-list');
}


function _clMakeDivider(label) {
  const el = document.createElement('div');
  el.className = 'list-divider';
  el.style.pointerEvents = 'none';
  el.innerHTML = `<span class="divider-text mono">${label}</span>`;
  return el;
}

/* ── Build one app row ───────────────────────────────────── */
function _buildClRow(pkg) {
  const type = _clState[pkg];
  const name = _clFriendlyName(pkg);
  const isOn = type !== null;

  const row = document.createElement('div');
  row.className   = 'list-item' + (isOn ? ' list-item--cl-on' : '');
  row.dataset.pkg = pkg;

  const gearSvg = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.8"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

  const wifiSvg = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M5 12.55a11 11 0 0 1 14.08 0" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M1.42 9a16 16 0 0 1 21.16 0" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><circle cx="12" cy="20" r="1.5" fill="currentColor"/></svg>`;
  const dataSvg = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="2" y="13" width="4" height="8" rx="1" fill="currentColor" opacity="0.5"/><rect x="9" y="9" width="4" height="12" rx="1" fill="currentColor" opacity="0.75"/><rect x="16" y="4" width="4" height="17" rx="1" fill="currentColor"/></svg>`;

  // Gear btn: cycles off → wifi → data → off, shows wifi/data SVG when active
  let gearContent, gearStyle, gearLabel;
  if (type === 'wifi') {
    gearContent = wifiSvg;
    gearStyle = 'background:rgba(0,229,245,0.14);border-color:rgba(0,229,245,0.60);color:#00e5f5;box-shadow:0 0 10px rgba(0,229,245,0.35);';
    gearLabel = 'WiFi active — click for Data';
  } else if (type === 'data') {
    gearContent = dataSvg;
    gearStyle = 'background:rgba(248,113,113,0.14);border-color:rgba(248,113,113,0.60);color:#f87171;box-shadow:0 0 10px rgba(248,113,113,0.35);';
    gearLabel = 'Data active — click to disable';
  } else {
    gearContent = gearSvg;
    gearStyle = 'background:var(--bg2);border-color:var(--border);color:var(--dim);';
    gearLabel = 'Click for WiFi';
  }

  row.innerHTML = `
    <div class="item-row">
      <div class="app-icon-wrap" data-pkg="${pkg}">
        <img class="app-icon" alt="${name}">
      </div>
      <div class="item-info">
        <span class="item-title">${name}</span>
        <span class="item-desc mono">${pkg}</span>
      </div>
    </div>
    <div class="btn-row">
      <button class="app-gear-btn cl-cycle-btn" data-clgear="${pkg}" aria-label="${gearLabel}"
        style="width:30px;height:30px;border-radius:6px;border:1px solid;display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;transition:all 0.2s;${gearStyle}">
        ${gearContent}
      </button>
    </div>`;

  const img = row.querySelector('.app-icon');
  if (img) setIconSrc(img, pkg);

  return row;
}


/* ── Toggle ON/OFF for one app ───────────────────────────── */
async function _clToggle(pkg, row) {
  const isOn = _clState[pkg] !== null;
  const nowOn = !isOn;

  if (nowOn) {
    // Default to wifi when first enabling
    _clState[pkg] = 'wifi';
    await exec(`mkdir -p ${RR_DIR} && printf '%s' 'wifi' > ${RR_DIR}/${pkg}.conn`);
    configuredPkgs.add(pkg);
    showToast(`Conn ON → ${_clFriendlyName(pkg)} (WiFi)`, 'CONN LAUNCH', 'info', '📶');
    setStatus(`📶 ${_clFriendlyName(pkg)} will enable WiFi on launch`);
  } else {
    _clState[pkg] = null;
    await exec(`rm -f ${RR_DIR}/${pkg}.conn`);
    // Remove from configuredPkgs only if no other per-app settings
    const hasOther = (await exec(
      `find ${RR_DIR} -maxdepth 1 \\( -name "${pkg}.mode" -o -name "${pkg}.bright" -o -name "${pkg}.vol" -o -name "${pkg}.killothers" \\) 2>/dev/null | head -1`
    )).trim();
    // Also keep in configuredPkgs if the app has encore tweaks enabled
    const hasEncore = encorePkgs.has(pkg);
    if (!hasOther && !hasEncore) configuredPkgs.delete(pkg);
    showToast(`Conn OFF — ${_clFriendlyName(pkg)}`, 'CONN LAUNCH', 'info', '○');
    setStatus(`${_clFriendlyName(pkg)}: connection launch disabled`);
  }

  // Update row UI
  row.classList.toggle('cl-app-row--on', nowOn);
  const btn   = row.querySelector('.cl-toggle-btn');
  const label = btn?.querySelector('.gaming-toggle-label');
  btn?.setAttribute('aria-pressed', String(nowOn));
  btn?.classList.toggle('gaming-toggle-btn--on', nowOn);
  if (label) label.textContent = nowOn ? 'ON' : 'OFF';

  const picker = row.querySelector('.cl-picker-section');
  picker?.classList.toggle('cl-picker-section--visible', nowOn);

  _clUpdateBadge(pkg, row);
  _updateClMetrics();
  _updateTabCounts();
}

/* ── Set connection type for one app ─────────────────────── */
async function _clSetType(pkg, type, row) {
  _clState[pkg] = type;
  await exec(`mkdir -p ${RR_DIR} && printf '%s' '${type}' > ${RR_DIR}/${pkg}.conn`);

  // Update pill active states
  row.querySelectorAll('.cl-pill').forEach(p => {
    p.classList.toggle('cl-pill--active', p.dataset.conn === type);
  });

  _clUpdateBadge(pkg, row);
  _updateClMetrics();

  const t = CL_TYPES[type];
  showToast(`${_clFriendlyName(pkg)} → ${t.label}`, 'CONN LAUNCH', 'success', t.icon);
  setStatus(`📶 ${_clFriendlyName(pkg)} → ${t.label} on launch`);
}

/* ── Update type badge on row ────────────────────────────── */
function _clUpdateBadge(pkg, row) {
  const badge = document.getElementById(`cl-badge-${pkg.replace(/\./g,'_')}`) ||
                row?.querySelector('.cl-type-badge');
  if (!badge) return;
  const type = _clState[pkg];
  if (type && CL_TYPES[type]) {
    badge.textContent = CL_TYPES[type].icon + ' ' + CL_TYPES[type].label;
    badge.style.color = CL_TYPES[type].color;
  } else {
    badge.textContent = '';
  }
}

/* ── Init ────────────────────────────────────────────────── */
function _renderIdleWifiToggle() {
  const btn  = document.getElementById('cl-idle-wifi-btn');
  const lbl  = document.getElementById('cl-idle-wifi-label');
  if (!btn) return;
  btn.setAttribute('aria-pressed', String(_clIdleWifiOff));
  btn.classList.toggle('gaming-toggle-btn--on', _clIdleWifiOff);
  const thumb = btn.querySelector('.popup-toggle-thumb');
  if (thumb) thumb.style.transform = _clIdleWifiOff ? 'translateX(16px)' : '';
  if (lbl) lbl.textContent = _clIdleWifiOff ? 'ON' : 'OFF';
  // Update bubble border glow
  const bubble = document.getElementById('idle-wifi-bubble');
  if (bubble) bubble.style.borderColor = _clIdleWifiOff ? 'rgba(var(--a-rgb),0.5)' : '';
}

async function _toggleIdleWifiOff() {
  _clIdleWifiOff = !_clIdleWifiOff;
  if (_clIdleWifiOff) {
    await exec(`mkdir -p $(dirname ${CONN_IDLE_WIFI_OFF_FILE}) && touch ${CONN_IDLE_WIFI_OFF_FILE}`);
    showToast('WiFi & Data auto-off enabled (20s)', 'CONN LAUNCH', 'success', '📶');
    setStatus('✓ Idle conn-off: 20s timer active');
  } else {
    await exec(`rm -f ${CONN_IDLE_WIFI_OFF_FILE}`);
    showToast('WiFi auto-off disabled', 'CONN LAUNCH', 'info', '○');
    setStatus('Idle WiFi-off: disabled');
  }
  _renderIdleWifiToggle();
}

function _renderIdleDataToggle() {
  const btn  = document.getElementById('cl-idle-data-btn');
  const lbl  = document.getElementById('cl-idle-data-label');
  if (!btn) return;
  btn.setAttribute('aria-pressed', String(_clIdleDataOff));
  btn.classList.toggle('gaming-toggle-btn--on', _clIdleDataOff);
  const thumb = btn.querySelector('.popup-toggle-thumb');
  if (thumb) thumb.style.transform = _clIdleDataOff ? 'translateX(16px)' : '';
  if (lbl) lbl.textContent = _clIdleDataOff ? 'ON' : 'OFF';
  const bubble = document.getElementById('idle-data-bubble');
  if (bubble) bubble.style.borderColor = _clIdleDataOff ? 'rgba(var(--a-rgb),0.5)' : '';
}

async function _toggleIdleDataOff() {
  _clIdleDataOff = !_clIdleDataOff;
  if (_clIdleDataOff) {
    await exec(`mkdir -p $(dirname ${CONN_IDLE_DATA_OFF_FILE}) && touch ${CONN_IDLE_DATA_OFF_FILE}`);
    showToast('Mobile Data auto-off enabled (20s)', 'CONN LAUNCH', 'success', '📶');
    setStatus('✓ Idle data-off: 20s timer active');
  } else {
    await exec(`rm -f ${CONN_IDLE_DATA_OFF_FILE}`);
    showToast('Mobile Data auto-off disabled', 'CONN LAUNCH', 'info', '○');
    setStatus('Idle Data-off: disabled');
  }
  _renderIdleDataToggle();
}

function initConnLaunchPanel() {
  // Tab clicks
  document.addEventListener('click', e => {
    const tab = e.target.closest('[data-cltab]');
    if (!tab) return;
    _clActiveTab = tab.dataset.cltab;
    if (_clLoaded) renderClList();
  });

  // Gear click → cycle: off → wifi → data → off (inline, no popup)
  document.addEventListener('click', async e => {
    const gear = e.target.closest('[data-clgear]');
    if (!gear) return;
    e.stopPropagation();
    const pkg = gear.dataset.clgear;
    const cur = _clState[pkg];

    let next;
    if (cur === null || cur === undefined) {
      next = 'wifi';
    } else if (cur === 'wifi') {
      next = 'data';
    } else {
      next = null;
    }

    _clState[pkg] = next;

    if (next) {
      await exec(`mkdir -p ${RR_DIR} && printf '%s' '${next}' > ${RR_DIR}/${pkg}.conn`);
      configuredPkgs.add(pkg);
      const T = CL_TYPES[next];
      showToast(`${_clFriendlyName(pkg)} → ${T.label}`, 'CONN LAUNCH', 'success', T.icon);
    } else {
      await exec(`rm -f ${RR_DIR}/${pkg}.conn`);
      const hasOther = (await exec(
        `find ${RR_DIR} -maxdepth 1 \\( -name "${pkg}.mode" -o -name "${pkg}.bright" -o -name "${pkg}.vol" -o -name "${pkg}.killothers" \\) 2>/dev/null | head -1`
      )).trim();
      if (!hasOther) configuredPkgs.delete(pkg);
      showToast(`Conn OFF — ${_clFriendlyName(pkg)}`, 'CONN LAUNCH', 'info', '○');
    }

    _updateClMetrics();

    // Update gear button inline without full re-render
    const wifiSvg = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M5 12.55a11 11 0 0 1 14.08 0" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M1.42 9a16 16 0 0 1 21.16 0" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><circle cx="12" cy="20" r="1.5" fill="currentColor"/></svg>`;
    const dataSvg = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="2" y="13" width="4" height="8" rx="1" fill="currentColor" opacity="0.5"/><rect x="9" y="9" width="4" height="12" rx="1" fill="currentColor" opacity="0.75"/><rect x="16" y="4" width="4" height="17" rx="1" fill="currentColor"/></svg>`;
    const gearSvgSmall = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.8"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

    if (next === 'wifi') {
      gear.innerHTML = wifiSvg;
      gear.style.cssText = `width:32px;height:32px;border-radius:50%;border:1px solid rgba(96,207,255,0.55);background:rgba(96,207,255,0.15);color:#60cfff;box-shadow:0 0 8px rgba(96,207,255,0.3);display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;transition:all 0.2s;`;
      gear.setAttribute('aria-label', 'WiFi active — click for Data');
    } else if (next === 'data') {
      gear.innerHTML = dataSvg;
      gear.style.cssText = `width:32px;height:32px;border-radius:50%;border:1px solid rgba(168,85,247,0.55);background:rgba(168,85,247,0.15);color:#a855f7;box-shadow:0 0 8px rgba(168,85,247,0.3);display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;transition:all 0.2s;`;
      gear.setAttribute('aria-label', 'Data active — click to disable');
    } else {
      gear.innerHTML = gearSvgSmall;
      gear.style.cssText = `width:32px;height:32px;border-radius:50%;border:1px solid var(--bdr);background:rgba(0,0,0,0.35);color:var(--a);box-shadow:none;display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;transition:all 0.2s;`;
      gear.setAttribute('aria-label', 'Click for WiFi');
    }

    // Refresh the list row class for configured highlighting
    const row = gear.closest('.list-item');
    if (row) row.classList.toggle('list-item--cl-on', next !== null);
  });

  // Idle WiFi-off toggle
  document.getElementById('cl-idle-wifi-btn')
    ?.addEventListener('click', _toggleIdleWifiOff, { passive: true });

  // Idle Data-off toggle
  document.getElementById('cl-idle-data-btn')
    ?.addEventListener('click', _toggleIdleDataOff, { passive: true });

  // ── Restore idle wifi state immediately on init (fix: was only read on panel open) ──
  exec(`[ -f ${CONN_IDLE_WIFI_OFF_FILE} ] && echo 1 || echo 0`).then(raw => {
    _clIdleWifiOff = raw.trim() === '1';
    _renderIdleWifiToggle();
  });

  // ── Restore idle data state immediately on init ──
  exec(`[ -f ${CONN_IDLE_DATA_OFF_FILE} ] && echo 1 || echo 0`).then(raw => {
    _clIdleDataOff = raw.trim() === '1';
    _renderIdleDataToggle();
  });

  // Lazy-load on first open
  const det = document.getElementById('conn-launch-section')?.querySelector('.panel-details');
  det?.addEventListener('toggle', () => {
    if (det.open && !_clLoaded) loadConnLaunchPanel();
  });
}

/* ═══════════════════════════════════════════════════════════
   § GAME LIST PANEL · Detected Games (Panel 01)
   ═══════════════════════════════════════════════════════════ */

let _glPkgs   = [];
let _glQuery  = '';
let _glLoaded = false;

/* Returns true if a package is a detected game — used to hide games from panels 4/7/8 */
function _isGame(pkg) {
  return _glPkgs.includes(pkg);
}

async function loadGameListPanel() {
  const list = document.getElementById('gl-app-list');
  if (!list) return;
  list.innerHTML = '<span class="list-placeholder mono">Detecting games…</span>';

  // Method 1: query packages with GAME category intent (most reliable)
  const intentRaw = await exec(
    `cmd package query-activities --brief -a android.intent.action.MAIN -c android.intent.category.GAME 2>/dev/null | grep -v '^No activities' | grep '/' | cut -d'/' -f1 | sort -u`
  );
  const intentPkgs = intentRaw.trim().split('\n').filter(Boolean);

  // Method 2: check app-info category via dumpsys (catches games tagged in manifest)
  const dumpRaw = await exec(
    `dumpsys package | grep -B5 'category=0x' | grep 'Package\\[' | sed 's/.*Package\\[//;s/\\].*//' 2>/dev/null | sort -u`
  );
  const dumpPkgs = dumpRaw.trim().split('\n').filter(Boolean);

  // Method 3: packages in encore gamelist.json (user-tagged games via Encore Tweaks)
  const encoreGamePkgs = [...encorePkgs];

  // Merge only reliable sources — NO broad keyword matching
  const merged = [...new Set([...intentPkgs, ...dumpPkgs, ...encoreGamePkgs])].sort();
  _glPkgs = merged;

  // Write game list to disk so encore_app_daemon can detect games accurately
  exec(`mkdir -p ${CFG_DIR} && printf '%s\n' ${merged.map(p => `'${p}'`).join(' ')} > ${CFG_DIR}/gl_pkgs 2>/dev/null`);

  _glLoaded = true;

  // Update ribbon
  const ribbonTxt = document.getElementById('gl-ribbon-text');
  const ribbonIcon = document.getElementById('gl-ribbon-icon');
  if (ribbonTxt) ribbonTxt.textContent = `${merged.length} game${merged.length !== 1 ? 's' : ''} detected`;
  if (ribbonIcon) ribbonIcon.textContent = merged.length > 0 ? '🎮' : '○';

  renderGlList();
}

function renderGlList() {
  const list = document.getElementById('gl-app-list');
  if (!list) return;

  const q = _glQuery.toLowerCase().trim();
  const filtered = _glPkgs.filter(p =>
    !q || p.toLowerCase().includes(q) || getAppLabel(p).toLowerCase().includes(q)
  );

  if (!filtered.length) {
    list.innerHTML = `<span class="list-placeholder mono">${q ? 'No games match' : 'No games detected'}</span>`;
    return;
  }

  const hdr = document.createElement('div');
  hdr.className = 'list-divider';
  hdr.style.cssText = 'pointer-events:none;cursor:default;border-left:3px solid var(--a);background:rgba(var(--a-rgb),0.05);';
  hdr.innerHTML = `<span class="divider-text mono" style="color:var(--a);">🎮 DETECTED GAMES (${filtered.length})</span>`;

  const frag = document.createDocumentFragment();
  frag.appendChild(hdr);
  _sortAZ(filtered).forEach(p => frag.appendChild(_buildGlRow(p)));

  list.innerHTML = '';
  list.appendChild(frag);
  loadVisibleIcons('gl-app-list');
}

function _buildGlRow(pkg) {
  const name = getAppLabel(pkg);
  const isConfigured = configuredPkgs.has(pkg) || encorePkgs.has(pkg);

  const row = document.createElement('div');
  row.className = 'list-item' + (isConfigured ? ' list-item--rr-on' : '');
  row.dataset.pkg = pkg;

  const gearSvg = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.8"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

  const cfgBadge = isConfigured
    ? `<span class="rr-configured-badge mono" style="background:rgba(var(--a-rgb),0.1);border-color:rgba(var(--a-rgb),0.35);color:var(--a);">CFG</span>`
    : '';

  row.innerHTML = `
    <div class="item-row">
      <div class="app-icon-wrap" data-pkg="${pkg}">
        <img class="app-icon" alt="${name}">
      </div>
      <div class="item-info">
        <span class="item-title">${name}</span>
        <span class="item-desc mono">${pkg}</span>
      </div>
    </div>
    <div class="btn-row">
      ${cfgBadge}
      <button class="app-gear-btn" data-glgear="${pkg}" aria-label="Configure ${pkg}"
        style="width:32px;height:32px;border-radius:50%;background:rgba(0,0,0,0.35);border:1px solid var(--bdr);display:flex;align-items:center;justify-content:center;cursor:pointer;color:var(--a);flex-shrink:0;">
        ${gearSvg}
      </button>
    </div>`;

  const img = row.querySelector('.app-icon');
  if (img) setIconSrc(img, pkg);

  return row;
}

function initGameListPanel() {
  // Gear click → open the standard per-app config popup
  document.addEventListener('click', e => {
    const gear = e.target.closest('[data-glgear]');
    if (!gear) return;
    e.stopPropagation();
    openPopup(gear.dataset.glgear, gear, true);
  });

  // Lazy-load on first open
  const det = document.getElementById('game-list-section')?.querySelector('.panel-details');
  det?.addEventListener('toggle', () => {
    if (det.open && !_glLoaded) loadGameListPanel();
  });
}

/* ═══════════════════════════════════════════════════════════
   § GPU FREQUENCY CONTROL PANEL (Panel 03)
   Adapted from MTK_AI_Engine GPU OPP slider logic
   ═══════════════════════════════════════════════════════════ */

const GPU_OPP_FILE = '/sdcard/GovThermal/config/gpu_opp_index.txt';
const GPU_OPP_NODE = '/proc/gpufreqv2/fix_target_opp_index';
let _gpuFreqMap    = {};   // { oppIndex: freqMhz }
let _gpuOppMax     = 32;   // will be updated from device

async function _buildGpuFreqMap() {
  // Try 1: stack_signed_opp_table (most reliable on MTK gpufreqv2)
  const stackRaw = await exec(`cat /proc/gpufreqv2/stack_signed_opp_table 2>/dev/null`);
  if (stackRaw.trim()) {
    const map = {};
    stackRaw.trim().split('\n').forEach((line, i) => {
      // Format: [idx] Freq: XXXXX, Volt: XXXXXX  (KHz)
      const fM = line.match(/Freq[:\s]+(\d+)/i) || line.match(/(\d{6,})/);
      if (fM) map[i] = Math.round(parseInt(fM[1]) / 1000);
    });
    if (Object.keys(map).length > 0) {
      _gpuFreqMap = map;
      _gpuOppMax  = Math.max(...Object.keys(map).map(Number));
      return;
    }
  }
  // Try 2: gpufreq_status [GPU-OPP] entries
  const raw = await exec(`cat /proc/gpufreqv2/gpufreq_status 2>/dev/null`);
  const map = {};
  raw.trim().split('\n').forEach(line => {
    if (!line.includes('[GPU-OPP]')) return;
    const iM = line.match(/Index:\s*(\d+)/);
    const fM = line.match(/Freq:\s*(\d+)/);
    if (iM && fM) map[parseInt(iM[1])] = Math.round(parseInt(fM[1]) / 1000);
  });
  if (Object.keys(map).length > 0) {
    _gpuFreqMap = map;
    _gpuOppMax  = Math.max(...Object.keys(map).map(Number));
    return;
  }
  // Fallback: detect actual max from devfreq
  const maxRaw = await exec(
    `cat /sys/class/devfreq/*/max_freq 2>/dev/null | head -1 || ` +
    `cat /proc/gpufreqv2/gpufreq_status 2>/dev/null | grep -m1 'cur_freq' | grep -oE '[0-9]+'`
  );
  const maxKHz = parseInt(maxRaw.trim());
  const maxMHz = (!isNaN(maxKHz) && maxKHz > 0)
    ? (maxKHz > 100000 ? Math.round(maxKHz / 1000) : maxKHz)
    : 886;
  const minMHz = Math.round(maxMHz * 0.42);
  for (let i = 0; i <= 32; i++)
    _gpuFreqMap[i] = Math.round(maxMHz - (maxMHz - minMHz) * i / 32);
  _gpuOppMax = 32;
}

function _gpuFreqLabel(oppIndex) {
  if (_gpuFreqMap[oppIndex] !== undefined) return _gpuFreqMap[oppIndex] + ' MHz';
  return Math.round(836 - (836 - 350) * oppIndex / _gpuOppMax) + ' MHz';
}

function _renderGpuUI(oppIndex, locked) {
  const slider = document.getElementById('gpu-opp-slider');
  const valEl  = document.getElementById('gpu-opp-val');
  const idxEl  = document.getElementById('gpu-opp-index-val');
  const stEl   = document.getElementById('gpu-lock-status');
  const labEl  = document.getElementById('gpu-frequency-labels');

  if (slider) {
    slider.max   = _gpuOppMax;
    slider.value = _gpuOppMax - oppIndex;  // invert: left=max freq (low idx)
    _syncSliderFill(slider);
  }
  if (valEl)  { valEl.textContent  = _gpuFreqLabel(oppIndex); valEl.dataset.state = locked ? 'hot' : 'ok'; }
  if (idxEl)  idxEl.textContent   = oppIndex;
  if (stEl)   { stEl.textContent  = locked ? 'LOCKED' : 'FREE'; stEl.dataset.state = locked ? 'hot' : 'ok'; }
  if (labEl)  labEl.innerHTML     = `<span>${_gpuFreqLabel(0)}</span><span>${_gpuFreqLabel(_gpuOppMax)}</span>`;
}

async function loadGpuPanel() {
  await _buildGpuFreqMap();
  _renderOppTable();

  // Priority 1: saved file
  let oppIndex = 0;
  const saved = (await exec(`cat ${GPU_OPP_FILE} 2>/dev/null`)).trim();
  if (saved && !isNaN(parseInt(saved))) {
    oppIndex = parseInt(saved);
    _renderGpuUI(oppIndex, true);
    _highlightOppRow(oppIndex);
    return;
  }
  // Priority 2: kernel current
  const kernel = (await exec(`cat ${GPU_OPP_NODE} 2>/dev/null`)).trim();
  oppIndex = (!kernel || isNaN(parseInt(kernel))) ? 0 : parseInt(kernel);
  _renderGpuUI(oppIndex, false);
  _highlightOppRow(oppIndex);
}

// ── OPP Table ─────────────────────────────────────────────────
function _renderOppTable() {
  const table = document.getElementById('gpu-opp-table');
  if (!table) return;
  // If only 1 entry found from kernel, expand _gpuFreqMap in-place using fallback formula
  // so that applyGpuLock, _gpuFreqLabel, and the table all use the same consistent data
  if (Object.keys(_gpuFreqMap).length <= 1) {
    const maxMHz = _gpuFreqMap[0] ?? 886;
    const minMHz = _gpuFreqMap[_gpuOppMax] ?? Math.round(maxMHz * 0.42);
    for (let i = 0; i <= _gpuOppMax; i++)
      _gpuFreqMap[i] = Math.round(maxMHz - (maxMHz - minMHz) * i / _gpuOppMax);
  }
  const entries = Object.entries(_gpuFreqMap).sort((a, b) => parseInt(a[0]) - parseInt(b[0]));
  if (!entries.length) { table.innerHTML = '<span class="mono" style="font-size:9px;color:var(--dim);padding:6px;">OPP data unavailable</span>'; return; }
  const maxFreq = Math.max(...entries.map(e => e[1]));
  const minFreq = Math.min(...entries.map(e => e[1]));
  table.innerHTML = entries.map(([idx, freq]) => {
    const pct = maxFreq === minFreq ? 100 : Math.round((freq - minFreq) / (maxFreq - minFreq) * 100);
    const isMax = parseInt(idx) === 0;
    const isMin = parseInt(idx) === _gpuOppMax;
    return `<div class="gpu-opp-row" data-opp="${idx}" style="display:flex;align-items:center;gap:8px;padding:5px 8px;border-radius:5px;cursor:pointer;touch-action:manipulation;border:0.5px solid transparent;transition:background 0.15s,border-color 0.15s;">
      <span class="mono" style="font-size:9px;color:var(--dim);width:36px;flex-shrink:0;">OPP ${idx}</span>
      <div style="flex:1;height:4px;border-radius:2px;background:rgba(var(--a-rgb),0.1);overflow:hidden;">
        <div style="height:100%;width:${pct}%;background:var(--a);border-radius:2px;transition:width 0.3s;"></div>
      </div>
      <span class="mono" style="font-size:10px;color:var(--a);width:56px;text-align:right;flex-shrink:0;">${freq} MHz${isMax ? ' ▲' : isMin ? ' ▼' : ''}</span>
    </div>`;
  }).join('');
  table.querySelectorAll('.gpu-opp-row').forEach(row => {
    const _oppRowHandler = () => {
      const opp = parseInt(row.dataset.opp);
      const slider = document.getElementById('gpu-opp-slider');
      if (slider) {
        slider.value = _gpuOppMax - opp;
        slider.dispatchEvent(new Event('input', { bubbles: true }));
        _syncSliderFill(slider);
      }
      _highlightOppRow(opp);
    };
    row.addEventListener('click', _oppRowHandler, { passive: true });
    row.addEventListener('touchend', e => { e.preventDefault(); _oppRowHandler(); });
  });
}

function _highlightOppRow(oppIndex) {
  document.querySelectorAll('.gpu-opp-row').forEach(r => {
    const active = parseInt(r.dataset.opp) === oppIndex;
    r.style.background = active ? 'rgba(var(--a-rgb),0.10)' : '';
    r.style.borderColor = active ? 'rgba(var(--a-rgb),0.35)' : 'transparent';
  });
}

// ── Frequency History Graph ────────────────────────────────────
const _gpuFreqHistory = [];   // { ts, mhz }
const GPU_HISTORY_WINDOW = 30000;  // 30s

function _pushGpuFreqSample(mhz) {
  const now = Date.now();
  _gpuFreqHistory.push({ ts: now, mhz });
  // Trim old samples outside window
  const cutoff = now - GPU_HISTORY_WINDOW;
  while (_gpuFreqHistory.length && _gpuFreqHistory[0].ts < cutoff) _gpuFreqHistory.shift();
  // Use rAF so canvas has correct offsetWidth if panel just opened
  requestAnimationFrame(_drawGpuGraph);
}

function _drawGpuGraph() {
  const canvas = document.getElementById('gpu-freq-graph');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Match canvas pixel size to display size
  const W = canvas.offsetWidth || 300;
  const H = canvas.offsetHeight || 52;
  canvas.width  = W;
  canvas.height = H;
  ctx.clearRect(0, 0, W, H);

  if (_gpuFreqHistory.length < 2) {
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('Collecting data…', W / 2, H / 2 + 4);
    return;
  }

  const now   = Date.now();
  const freqs = _gpuFreqHistory.map(s => s.mhz);
  const maxF  = Math.max(...freqs, 1);
  const minF  = Math.min(...freqs);
  const range = maxF - minF || 1;

  // Get theme accent color from CSS variable
  const accentRaw = getComputedStyle(document.documentElement).getPropertyValue('--a').trim() || '#7fff00';

  // Draw gradient fill under line
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, accentRaw.startsWith('#') ? accentRaw + '55' : 'rgba(127,255,0,0.33)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');

  ctx.beginPath();
  _gpuFreqHistory.forEach((s, i) => {
    const x = ((s.ts - (now - GPU_HISTORY_WINDOW)) / GPU_HISTORY_WINDOW) * W;
    const y = H - ((s.mhz - minF) / range) * (H - 8) - 4;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  // Close fill path to bottom
  ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  // Draw line
  ctx.beginPath();
  _gpuFreqHistory.forEach((s, i) => {
    const x = ((s.ts - (now - GPU_HISTORY_WINDOW)) / GPU_HISTORY_WINDOW) * W;
    const y = H - ((s.mhz - minF) / range) * (H - 8) - 4;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.strokeStyle = accentRaw;
  ctx.lineWidth   = 1.5;
  ctx.lineJoin    = 'round';
  ctx.stroke();

  // Peak label
  const peakEl = document.getElementById('gpu-graph-peak');
  if (peakEl) peakEl.textContent = `PEAK ${maxF} MHz`;
}

async function applyGpuLock() {
  const slider = document.getElementById('gpu-opp-slider');
  const sliderPos = parseInt(slider?.value ?? _gpuOppMax);
  const oppIndex  = _gpuOppMax - sliderPos;
  const freqMHz   = _gpuFreqMap[oppIndex] ?? Math.round(886 - (886 - 350) * oppIndex / _gpuOppMax);
  const freqKHz   = freqMHz * 1000;

  // 1. Save OPP index to config
  await exec(`mkdir -p $(dirname ${GPU_OPP_FILE}) && echo '${oppIndex}' > ${GPU_OPP_FILE}`);

  // 2. Fix OPP index via gpufreqv2 (primary lock)
  await exec(`su -c "echo '${oppIndex}' > ${GPU_OPP_NODE}" 2>/dev/null || echo '${oppIndex}' > ${GPU_OPP_NODE} 2>/dev/null`);

  // 3. GED upbound — prevents thermal governor from going above target
  await exec(`su -c "chmod 664 /sys/kernel/ged/hal/custom_upbound_gpu_freq 2>/dev/null && echo '${freqKHz}' > /sys/kernel/ged/hal/custom_upbound_gpu_freq" 2>/dev/null`);

  // 4. Disable fix_custom_freq_volt (use OPP table voltage, not manual)
  await exec(`echo '0 0' > /proc/gpufreqv2/fix_custom_freq_volt 2>/dev/null`);

  // 5. Disable DCS — keeps all GPU shader cores active (no dynamic core scaling)
  await exec(`su -c "chmod 664 /sys/kernel/ged/hal/dcs_mode 2>/dev/null && echo 0 > /sys/kernel/ged/hal/dcs_mode" 2>/dev/null`);

  _renderGpuUI(oppIndex, true);
  _highlightOppRow(oppIndex);
  const freq = _gpuFreqLabel(oppIndex);
  showToast(`GPU locked at ${freq}`, 'GPU FREQ', 'success', '⚡');

  // Update HDI strip immediately
  const gpuValEl = document.getElementById('hsi-gpu');
  if (gpuValEl) { gpuValEl.textContent = freq; gpuValEl.className = 'hdi-val disp-active'; }

  autoSave();
}

async function unlockGpu() {
  await exec(`rm -f ${GPU_OPP_FILE}`);

  // Release fix_target_opp_index (-1 = driver managed)
  await exec(`su -c "echo '-1' > ${GPU_OPP_NODE}" 2>/dev/null || echo '-1' > ${GPU_OPP_NODE} 2>/dev/null`);

  // Release GED upbound (0 = no custom ceiling)
  await exec(`su -c "chmod 664 /sys/kernel/ged/hal/custom_upbound_gpu_freq 2>/dev/null && echo 0 > /sys/kernel/ged/hal/custom_upbound_gpu_freq" 2>/dev/null`);

  // Re-enable DCS (let kernel manage shader cores)
  await exec(`su -c "chmod 664 /sys/kernel/ged/hal/dcs_mode 2>/dev/null && echo 1 > /sys/kernel/ged/hal/dcs_mode" 2>/dev/null`);

  // Clear custom freq/volt lock
  await exec(`echo '0 0' > /proc/gpufreqv2/fix_custom_freq_volt 2>/dev/null`);

  const cur = (await exec(`cat ${GPU_OPP_NODE} 2>/dev/null`)).trim();
  const idx  = (!cur || isNaN(parseInt(cur)) || parseInt(cur) === -1) ? 0 : parseInt(cur);
  _renderGpuUI(idx, false);
  _highlightOppRow(-1); // clear all highlights on unlock
  setStatus('GPU unlocked — driver controls frequency');
  showToast('GPU unlocked', 'GPU FREQ', 'info', '🔓');
  autoSave();
}





// ══════════════════════════════════════════════════════════════════
//  CPU GOVERNOR PROFILES — detection-based per-cluster
//  Detects available governors per policy, picks best fit per profile
//  Applies governor + rate limits per cluster (policy0/4/6 MT6893Z)
// ══════════════════════════════════════════════════════════════════

const CPU_PROF_CFG = `${CFG_DIR}/cpu_profile_active`;

let _cpuDetect = null;
let _cpuProfSelected = null;

// ── CPU Governor Profiles — MT6893 Dimensity 1200 (3-cluster: LITTLE/MID/PRIME)
// up/dn arrays → [LITTLE, MID, PRIME] rate limit in µs
// govPref      → governor preference list for all clusters (first available wins)
// govPerCluster → [LITTLE_prefs, MID_prefs, PRIME_prefs] — overrides govPref per cluster
const CPU_PROFILES = {
  responsive: {
    // 🚀 ULTRA SMOOTH — instant ramp, very slow cooldown = no FPS drop
    label: '🚀 ULTRA SMOOTH',
    govPref: ['schedutil','sugov_ext','schedhorizon','uag','interactive','ondemand'],
    up:  [0,     0,     0    ],   // instant boost on all clusters
    dn:  [20000, 20000, 20000],   // 20ms hold before dropping = smooth transitions
  },
  balanced: {
    // ⚖ BALANCED DAILY — fast up 85µs, slow down 10ms = walang lag + tipid
    label: '⚖ BALANCED DAILY',
    govPref: ['schedutil','sugov_ext','schedhorizon','uag','interactive','ondemand'],
    up:  [85,    85,    85   ],   // 85µs ≈ fast ramp (recommended daily driver)
    dn:  [10000, 10000, 10000],   // 10ms before freq drop
  },
  latency: {
    // ⚡ PERFORMANCE GAMING — max freq, no rate limits, input boost disabled
    label: '⚡ PERFORMANCE',
    govPref: ['performance','schedutil','sugov_ext','schedhorizon'],
    up:  [0, 0, 0],
    dn:  [0, 0, 0],
  },
  battery: {
    // 🔋 BATTERY SAVER (no-lag version) — schedutil on LITTLE, powersave on MID+PRIME
    label: '🔋 BATTERY SAVER',
    govPref: ['schedutil','sugov_ext','schedhorizon','uag'],  // fallback (non-battery)
    govPerCluster: [
      ['schedutil','sugov_ext','schedhorizon','uag','ondemand'],   // LITTLE — stays responsive
      ['powersave','conservative','schedutil'],                     // MID    — power efficient
      ['powersave','conservative','schedutil'],                     // PRIME  — power efficient
    ],
    up:  [5000,  15000, 15000],
    dn:  [10000, 30000, 30000],
  },
};

function _pickGov(availGovs, prefList) {
  for (const g of prefList) {
    if (availGovs.includes(g)) return g;
  }
  return availGovs[0] || 'schedutil';
}

async function _detectCpuPolicies() {
  const raw = await exec(`
    _read_pol() {
      base="$1" pnum="$2"
      [ -d "$base" ] || return
      g=$(cat "$base/scaling_governor" 2>/dev/null | tr -d ' 	') || g="?"
      av=$(cat "$base/scaling_available_governors" 2>/dev/null | tr ' ' ',') || av=""
      ul="?" dl="?"
      if [ -f "$base/up_rate_limit_us" ]; then
        chmod 666 "$base/up_rate_limit_us" "$base/down_rate_limit_us" 2>/dev/null
        ul=$(cat "$base/up_rate_limit_us" 2>/dev/null | tr -d ' 	') || ul="?"
        dl=$(cat "$base/down_rate_limit_us" 2>/dev/null | tr -d ' 	') || dl="?"
      else
        for gn in sugov_ext schedutil schedhorizon uag sugov; do
          gd="$base/$gn"
          if [ -d "$gd" ]; then
            chmod 666 "$gd/up_rate_limit_us" "$gd/down_rate_limit_us" 2>/dev/null
            ul=$(cat "$gd/up_rate_limit_us" 2>/dev/null | tr -d ' 	') || ul="?"
            dl=$(cat "$gd/down_rate_limit_us" 2>/dev/null | tr -d ' 	') || dl="?"
            break
          fi
        done
      fi
      printf 'POL%s|%s|%s|%s|%s\n' "$pnum" "$g" "$av" "$ul" "$dl"
    }
    _read_pol /sys/devices/system/cpu/cpufreq/policy0 0
    _read_pol /sys/devices/system/cpu/cpufreq/policy4 4
    _read_pol /sys/devices/system/cpu/cpufreq/policy6 6
    _read_pol /sys/devices/system/cpu/cpufreq/policy7 7
  `, 8000);
  const policies = [];
  for (const line of raw.trim().split('\n').filter(Boolean)) {
    const m = line.match(/^POL(\d+)\|([^|]*)\|([^|]*)\|([^|]*)\|(.*)$/);
    if (!m) continue;
    policies.push({
      pol:       m[1],
      role:      m[1]==='0'?'LITTLE':(m[1]==='4'||m[1]==='5')?'MID':'PRIME',
      activeGov: m[2].trim() || '?',
      availGovs: m[3].split(',').map(s=>s.trim()).filter(Boolean),
      upLimit:   m[4].trim() || '?',
      dnLimit:   m[5].trim() || '?',
    });
  }
  return { policies, clusters: policies.length };
}

function _fmtRateLimit(v) {
  if (!v || v==='?') return '?';
  const n = parseInt(v);
  if (isNaN(n)) return v;
  if (n===0) return 'Instant';
  return n<1000 ? `${n}µs` : `${n/1000}ms`;
}

function _renderCpuClusterInfo(detect) {
  const el = document.getElementById('cpu-cluster-info');
  if (!el) return;
  el.innerHTML = detect.policies.map(p => `
    <div class="conn-bubble" style="padding:6px 10px;display:flex;align-items:center;gap:8px;">
      <span class="mono" style="font-size:9px;color:var(--dim);min-width:52px;">${p.role}·p${p.pol}</span>
      <span class="mono" style="font-size:9px;color:var(--a);flex:1;">${p.activeGov}</span>
      <span class="mono" style="font-size:8px;color:var(--dim);">↑${_fmtRateLimit(p.upLimit)} ↓${_fmtRateLimit(p.dnLimit)}</span>
    </div>`).join('');
}

function _renderCpuProfileCards(detect) {
  for (const [key, def] of Object.entries(CPU_PROFILES)) {
    const badge  = document.getElementById(`cpuprof-${key}-badge`);
    const detail = document.getElementById(`cpuprof-${key}-detail`);
    if (!badge) continue;
    const _sortedP = [...detect.policies].sort((a,b)=>parseInt(a.pol)-parseInt(b.pol));
    // Per-cluster gov selection (govPerCluster overrides govPref)
    const govs = _sortedP.map((p, ri) => {
      const prefs = def.govPerCluster ? def.govPerCluster[Math.min(ri, def.govPerCluster.length-1)] : def.govPref;
      return _pickGov(p.availGovs, prefs);
    });
    badge.textContent = [...new Set(govs)].join(' / ') || '—';
    if (detail) detail.textContent = _sortedP.map((p, ri) => {
      const up = def.up[Math.min(ri, def.up.length-1)];
      const dn = def.dn[Math.min(ri, def.dn.length-1)];
      return `${p.role}: ${govs[ri]}  ↑${_fmtRateLimit(String(up))} ↓${_fmtRateLimit(String(dn))}`;
    }).join(' | ');
  }
}

function _selectCpuProfile(key) {
  _cpuProfSelected = key;
  document.querySelectorAll('.cpu-profile-card').forEach(card => {
    const active = card.dataset.cpuprof === key;
    card.style.borderColor = active ? 'rgba(var(--a-rgb),0.6)' : '';
    card.style.background  = active ? 'rgba(var(--a-rgb),0.07)' : '';
    const det = document.getElementById(`cpuprof-${card.dataset.cpuprof}-detail`);
    if (det) det.style.display = active ? '' : 'none';
  });
  const btn = document.getElementById('btn-apply-cpu-profile');
  if (btn) { btn.disabled=false; btn.textContent=`⚙ APPLY ${CPU_PROFILES[key]?.label||key} ›`; }
}

async function _applyCpuProfile() {
  if (!_cpuProfSelected || !_cpuDetect) return;
  const def    = CPU_PROFILES[_cpuProfSelected];
  const status = document.getElementById('cpu-profiles-status');
  if (status) status.textContent = `Applying ${def.label}…`;

  const pols = _cpuDetect.policies;
  // Sort policies numerically, map index by position (0=LITTLE, 1=MID, 2=PRIME)
  // Works for any policy numbering (0/4/6, 0/2/4, etc.)
  const sortedPols = [...pols].sort((a,b) => parseInt(a.pol)-parseInt(b.pol));
  const cmds = sortedPols.map((p, ri) => ({
    pol: p.pol,
    gov: _pickGov(p.availGovs, def.govPref),
    up:  def.up[Math.min(ri, def.up.length-1)],
    dn:  def.dn[Math.min(ri, def.dn.length-1)],
    govDir: p.govDir,
  }));

  // Build apply params — per-cluster govPref (govPerCluster overrides govPref)
  const _polNums  = pols.length > 0
    ? [...pols].sort((a,b)=>parseInt(a.pol)-parseInt(b.pol)).map(p => p.pol)
    : ['0','4','7'];  // fallback: TECNO CK8n MT6893 policy0/4/7
  const _polGovs  = _polNums.map((pol, ri) => {
    const p = pols.find(x => x.pol === pol);
    const prefs = def.govPerCluster
      ? def.govPerCluster[Math.min(ri, def.govPerCluster.length-1)]
      : def.govPref;
    return p ? _pickGov(p.availGovs, prefs) : prefs[prefs.length-1];
  });
  const _polUps   = _polNums.map((_,ri) => def.up[Math.min(ri, def.up.length-1)]);
  const _polDns   = _polNums.map((_,ri) => def.dn[Math.min(ri, def.dn.length-1)]);

  const script = `
    applied=0
    _w() {
      f="$1" val="$2"
      [ -f "$f" ] || return 1
      chmod 666 "$f" 2>/dev/null
      printf '%s' "$val" | tee "$f" > /dev/null 2>&1 && applied=$((applied+1)) && return 0
      printf '%s' "$val" > "$f" 2>/dev/null && applied=$((applied+1))
    }
    _apply_policy() {
      base="$1" gov="$2" up="$3" dn="$4"
      [ -d "$base" ] || return
      chmod 644 "$base/scaling_governor" 2>/dev/null
      printf '%s' "$gov" > "$base/scaling_governor" 2>/dev/null && applied=$((applied+1))
      if [ -f "$base/up_rate_limit_us" ]; then
        _w "$base/up_rate_limit_us" "$up"
        _w "$base/down_rate_limit_us" "$dn"
      else
        for gn in sugov_ext schedutil schedhorizon uag sugov; do
          gd="$base/$gn"
          if [ -d "$gd" ]; then
            _w "$gd/up_rate_limit_us" "$up"
            _w "$gd/down_rate_limit_us" "$dn"
            break
          fi
        done
      fi
    }
    ${_polNums.map((pol,i) => `_apply_policy /sys/devices/system/cpu/cpufreq/policy${pol} "${_polGovs[i]}" "${_polUps[i]}" "${_polDns[i]}"`).join('\n    ')}
    case "${_cpuProfSelected}" in
      latency)
        # PERFORMANCE GAMING — max freq + disable input boost scheduler conflicts
        for f in /sys/kernel/fpsgo/common/fpsgo_enable /sys/kernel/fpsgo/fbt/enable_ceiling; do
          [ -f "$f" ] && chmod 644 "$f" 2>/dev/null && echo 1 > "$f" 2>/dev/null
        done
        for f in /sys/module/mtk_fpsgo/parameters/perfmgr_enable /sys/module/perfmgr_mtk/parameters/perfmgr_enable; do
          [ -f "$f" ] && chmod 644 "$f" 2>/dev/null && echo 1 > "$f" 2>/dev/null
        done
        # Disable input boost conflicts
        [ -f /sys/module/cpu_boost/parameters/input_boost_enabled ] && \
          echo 0 > /sys/module/cpu_boost/parameters/input_boost_enabled 2>/dev/null
        for dpath in /sys/devices/platform/soc/1c00f000.dvfsrc /sys/devices/platform/1c00f000.dvfsrc; do
          dvfsrc="$dpath/mtk-dvfsrc-devfreq/devfreq/mtk-dvfsrc-devfreq"
          if [ -f "$dvfsrc/max_freq" ] && [ -f "$dvfsrc/min_freq" ]; then
            mx=$(cat "$dvfsrc/max_freq" 2>/dev/null); chmod 644 "$dvfsrc/min_freq" 2>/dev/null; printf '%s' "$mx" > "$dvfsrc/min_freq" 2>/dev/null; break
          fi
        done
        settings put global low_power 0 2>/dev/null
        settings put global low_power_sticky 0 2>/dev/null
        ;;
      responsive)
        # ULTRA SMOOTH — instant ramp, restore input boost, disable low power
        [ -f /sys/module/cpu_boost/parameters/input_boost_enabled ] && \
          echo 1 > /sys/module/cpu_boost/parameters/input_boost_enabled 2>/dev/null
        settings put global low_power 0 2>/dev/null
        settings put global low_power_sticky 0 2>/dev/null
        ;;
      balanced)
        # BALANCED DAILY — restore input boost, disable low power
        [ -f /sys/module/cpu_boost/parameters/input_boost_enabled ] && \
          echo 1 > /sys/module/cpu_boost/parameters/input_boost_enabled 2>/dev/null
        settings put global low_power 0 2>/dev/null
        settings put global low_power_sticky 0 2>/dev/null
        ;;
      battery)
        # BATTERY SAVER — enable low power mode
        settings put global low_power 1 2>/dev/null
        settings put global low_power_sticky 1 2>/dev/null
        [ -f /sys/module/cpu_boost/parameters/input_boost_enabled ] && \
          echo 0 > /sys/module/cpu_boost/parameters/input_boost_enabled 2>/dev/null
        ;;
    esac
    printf 'applied=%s\n' "$applied"
  `;

  const r = await exec(script, 9000);
  const m = r.match(/applied=(\d+)/);
  const count = m ? parseInt(m[1]) : 0;

  const _profMap = { responsive:'balanced', balanced:'balanced', latency:'performance', battery:'powersave' };
  const _mainProf = _profMap[_cpuProfSelected] || 'balanced';
  const _dispMap  = { responsive:'ULTRA SMOOTH', balanced:'BALANCED DAILY', latency:'PERFORMANCE', battery:'BATTERY SAVER' };
  const _dispLabel = _dispMap[_cpuProfSelected] || _cpuProfSelected.toUpperCase();

  // Persist both profile keys atomically
  await exec(
    `mkdir -p ${CFG_DIR} && ` +
    `printf '%s' '${_cpuProfSelected}' > ${CPU_PROF_CFG} && ` +
    `printf '%s' '${_cpuProfSelected}' > ${CFG_DIR}/cpu_prof_key && ` +
    `printf '%s' '${_mainProf}' > ${CFG_DIR}/active_profile`
  );

  // Update JS state immediately — before any async re-reads
  activeProfile = _mainProf;
  updateBadge(_mainProf);

  if (status) status.textContent = count > 0
    ? `✓ ${_dispLabel} applied — ${_mainProf} profile active`
    : `⚠ Governor set — no rate limit nodes on this kernel`;
  showToast(`CPU: ${_dispLabel}`, 'CPU PROFILE', 'success', '⚙');

  // Re-detect to update cluster info display only — do NOT re-read active_profile
  setTimeout(async () => {
    _cpuDetect = await _detectCpuPolicies();
    _renderCpuClusterInfo(_cpuDetect);
    const govs = _cpuDetect.policies.map(p=>`p${p.pol}:${p.activeGov}`).join(' ');
    if (status) status.textContent = `✓ ${_dispLabel} — ${govs}`;
  }, 1000);
}

function initCpuProfilesPanel() {
  const det = document.getElementById('adv-cpu-profiles');
  det?.addEventListener('toggle', async () => {
    if (!det.open) return;
    const status = document.getElementById('cpu-profiles-status');
    if (status) status.textContent = 'Detecting CPU topology…';
    _cpuDetect = await _detectCpuPolicies();
    _renderCpuClusterInfo(_cpuDetect);
    _renderCpuProfileCards(_cpuDetect);
    const saved = (await exec(`cat ${CPU_PROF_CFG} 2>/dev/null`)).trim();
    if (saved && CPU_PROFILES[saved]) _selectCpuProfile(saved);
    if (status) status.textContent = _cpuDetect.clusters
      ? `${_cpuDetect.clusters} clusters — ${_cpuDetect.policies.map(p=>`${p.role}:${p.activeGov}`).join(' · ')}`
      : '⚠ No CPU policies found';
  });
  document.getElementById('cpu-profile-cards')?.addEventListener('click', e => {
    const card = e.target.closest('.cpu-profile-card');
    if (card) _selectCpuProfile(card.dataset.cpuprof);
  });
  document.getElementById('btn-apply-cpu-profile')?.addEventListener('click', _applyCpuProfile, { passive: true });
}



// ══════════════════════════════════════════════════════════════════
//  HEADSET CONFIGURATION — auto volume on connect, mute on disconnect
// ══════════════════════════════════════════════════════════════════

const HEADSET_VOL_ON_FILE     = `${CFG_DIR}/headset_vol_on_connect`;    // enabled flag
const HEADSET_VOL_FILE        = `${CFG_DIR}/headset_vol_value`;          // volume value
const HEADSET_MUTE_FILE       = `${CFG_DIR}/headset_mute_on_disconnect`;
// HEADSET_RESTORE_FILE removed — restore to universal vol is always automatic

let _headsetVolOn          = false;
let _headsetVolVal         = 9;
let _headsetMuteOn         = false;
let _headsetPollTimer      = null;
let _headsetConnected      = false;
let _headsetDebugRaw       = '';  // raw detection output for debugging
let _preHeadsetVolSnapshot = null; // system vol captured just before headset override

// Detect headset — MT6893 / TECNO CK8n Android 14 specific
async function _detectHeadset() {
  const raw = await exec(
    // PRIMARY: h2w switch — 0=none, 1=3-pole headphone, 2=4-pole headset with mic
    `_h2w=$(cat /sys/class/switch/h2w/state 2>/dev/null | tr -d ' \t\n'); ` +
    `echo "H2W:$_h2w"; ` +
    `[ "$_h2w" != "0" ] && [ -n "$_h2w" ] && echo "CONNECTED:h2w=$_h2w"; ` +
    // SECONDARY: /sys/kernel/headset/state (newer kernel 5.10+)
    `_kh=$(cat /sys/kernel/headset/state 2>/dev/null | tr -d ' \t\n'); ` +
    `echo "KHEAD:$_kh"; ` +
    `[ "$_kh" != "0" ] && [ -n "$_kh" ] && echo "CONNECTED:khead=$_kh"; ` +
    // TERTIARY: extcon — headphone/mic/headset only (NOT USB-HOST — that is OTG)
    `for i in 0 1 2 3 4 5; do ` +
    `  [ -f "/sys/class/extcon/extcon$i/state" ] || continue; ` +
    `  _ex=$(cat "/sys/class/extcon/extcon$i/state" 2>/dev/null); ` +
    `  echo "EXTCON$i:$_ex"; ` +
    `  echo "$_ex" | grep -qiE "HEADPHONE=1|MICROPHONE=1|HEADSET=1" && echo "CONNECTED:extcon$i"; ` +
    `done; ` +
    // Named extcon — headset/headphone only
    `for n in usb-otg mtk-usb mtk-otg mtk-vbus mtk-id typec; do ` +
    `  [ -f "/sys/class/extcon/$n/state" ] || continue; ` +
    `  _exn=$(cat "/sys/class/extcon/$n/state" 2>/dev/null); ` +
    `  echo "EXTCON_$n:$_exn"; ` +
    `  echo "$_exn" | grep -qiE "HEADPHONE=1|MICROPHONE=1|HEADSET=1" && echo "CONNECTED:extcon_$n"; ` +
    `done; ` +
    // Virtual switch
    `_exv=$(cat /sys/devices/virtual/switch/h2w/state 2>/dev/null | tr -d ' \t\n'); ` +
    `echo "H2W_VIRT:$_exv"; ` +
    `[ "$_exv" != "0" ] && [ -n "$_exv" ] && echo "CONNECTED:h2w_virt=$_exv"; ` +
    // FINAL FALLBACK: dumpsys audio
    `_ds=$(dumpsys audio 2>/dev/null | grep -A 20 "Audio Routes:"); ` +
    `echo "DUMPSYS:$_ds"; ` +
    `echo "$_ds" | grep -qiE "Wired Headset: true|Wired Headphones: true" && echo "CONNECTED:dumpsys_routes"; ` +
    `_ds2=$(dumpsys audio 2>/dev/null | grep -i "devices:"); ` +
    `echo "DUMPSYS_DEV:$_ds2"; ` +
    `echo "$_ds2" | grep -qiE "headset|headphone" && echo "CONNECTED:dumpsys_devices"`
  , 8000);

  _headsetDebugRaw = raw;
  return /^CONNECTED:/m.test(raw);
}

// ── OTG detection — USB-HOST / ID line / typec host mode ────────────────────
let _otgConnected   = false;  // last known OTG state
let _otgAutoEnabled = false;  // did we auto-enable OTG this session

async function _detectOtg() {
  const raw = await exec(
    // extcon numbered nodes — USB-HOST=1 or ID=1 means OTG cable
    `for i in 0 1 2 3 4 5; do ` +
    `  [ -f "/sys/class/extcon/extcon$i/state" ] || continue; ` +
    `  _ex=$(cat "/sys/class/extcon/extcon$i/state" 2>/dev/null); ` +
    `  echo "$_ex" | grep -qiE "USB-HOST=1|ID=1" && echo "OTG:extcon$i" && break; ` +
    `done; ` +
    // Named extcon nodes
    `for n in usb-otg mtk-usb mtk-otg mtk-id typec; do ` +
    `  [ -f "/sys/class/extcon/$n/state" ] || continue; ` +
    `  _exn=$(cat "/sys/class/extcon/$n/state" 2>/dev/null); ` +
    `  echo "$_exn" | grep -qiE "USB-HOST=1|ID=1" && echo "OTG:$n" && break; ` +
    `done; ` +
    // MTK UDC / USB host role
    `cat /sys/kernel/debug/usb/dr_mode 2>/dev/null | grep -qi host && echo "OTG:dr_mode_host"; ` +
    // sysfs gadget role
    `cat /sys/class/usb_role/*/role 2>/dev/null | grep -qi host && echo "OTG:usb_role_host"; ` +
    // dumpsys usb — most reliable on Android 14
    `dumpsys usb 2>/dev/null | grep -qiE "usbHost.*true|hostConnected.*true|mCurrentHostFunc.*host" && echo "OTG:dumpsys_usb"`
  , 6000);
  return /^OTG:/m.test(raw);
}

// Auto-enable OTG in Android settings — no confirmation popup
async function _enableOtgAutomatic() {
  // Write all known settings keys immediately
  await exec(
    `settings put global usb_otg_enabled 1 2>/dev/null; ` +
    `settings put system otg_connect 1 2>/dev/null; ` +
    `settings put global otg_enable 1 2>/dev/null; ` +
    `settings put secure usb_otg_enabled 1 2>/dev/null; ` +
    `setprop vendor.usb.otg_mode 1 2>/dev/null; ` +
    `setprop sys.usb.otg_enable 1 2>/dev/null; ` +
    `setprop persist.vendor.usb.otg 1 2>/dev/null; ` +
    `for f in /sys/class/usb_role/*/role; do echo host > "$f" 2>/dev/null; done; ` +
    // Persistent dialog watcher — polls for "Go Setting OTG" and auto-taps
    `(TMPF=/data/local/tmp/_de_otg_uidump.xml; MAX=15; i=0; ` +
    ` while [ $i -lt $MAX ]; do sleep 0.3; i=$((i+1)); ` +
    `   TOP=$(dumpsys window windows 2>/dev/null | grep -i "mCurrentFocus" | head -1); ` +
    `   echo "$TOP" | grep -qiE "settings|alert|dialog|transsion" || continue; ` +
    `   uiautomator dump $TMPF 2>/dev/null || continue; ` +
    `   B=$(grep -o 'text="Go [Ss]etting OTG"[^>]*bounds="[^"]*"\\|bounds="[^"]*"[^>]*text="Go [Ss]etting OTG"' $TMPF 2>/dev/null | grep -o 'bounds="\\[[0-9,]*\\]\\[[0-9,]*\\]"' | head -1); ` +
    `   [ -z "$B" ] && B=$(grep 'OTG' $TMPF 2>/dev/null | grep -o 'bounds="\\[[0-9,]*\\]\\[[0-9,]*\\]"' | tail -1); ` +
    `   if [ -n "$B" ]; then ` +
    `     X1=$(echo "$B"|grep -o "[0-9]*"|sed -n "1p"); Y1=$(echo "$B"|grep -o "[0-9]*"|sed -n "2p"); ` +
    `     X2=$(echo "$B"|grep -o "[0-9]*"|sed -n "3p"); Y2=$(echo "$B"|grep -o "[0-9]*"|sed -n "4p"); ` +
    `     TX=$(( (X1+X2)/2 )); TY=$(( (Y1+Y2)/2 )); ` +
    `     input tap $TX $TY 2>/dev/null; rm -f $TMPF; break; ` +
    `   fi; ` +
    `   [ $i -eq 10 ] && input tap 515 1259 2>/dev/null && rm -f $TMPF && break; ` +
    ` done; rm -f $TMPF) &`
  );
  _otgAutoEnabled = true;
  showToast('OTG detected — auto-enabling', 'OTG', 'success', '🔌');
  _renderOtgStatus(true);
}

async function _disableOtgAutomatic() {
  await exec(
    `settings put global usb_otg_enabled 0 2>/dev/null; ` +
    `setprop vendor.usb.otg_mode 0 2>/dev/null; ` +
    `setprop sys.usb.otg_enable 0 2>/dev/null; ` +
    `settings put secure usb_otg_enabled 0 2>/dev/null; ` +
    `echo device > /sys/class/usb_role/*/role 2>/dev/null || true; ` +
    `echo peripheral > /sys/kernel/debug/usb/dr_mode 2>/dev/null || true`
  );
  _otgAutoEnabled = false;
  _renderOtgStatus(false);
}

function _renderOtgStatus(connected) {
  _otgConnected = connected;
  const badge  = document.getElementById('otg-status-badge');
  const ribbon = document.getElementById('otg-detect-ribbon');
  const icon   = document.getElementById('otg-ribbon-icon');
  const text   = document.getElementById('otg-ribbon-text');
  if (badge) {
    badge.textContent  = connected ? '🔌 OTG ACTIVE' : 'NOT DETECTED';
    badge.style.color  = connected ? 'var(--a)' : 'var(--dim)';
    badge.style.background = connected ? 'rgba(var(--a-rgb),0.12)' : 'rgba(255,255,255,0.06)';
  }
  if (ribbon) ribbon.style.borderColor = connected ? 'rgba(var(--a-rgb),0.4)' : '';
  if (icon)   icon.textContent  = connected ? '🔌' : '○';
  if (text)   text.textContent  = connected
    ? 'OTG device detected — host mode enabled automatically'
    : 'No OTG device — plug in OTG cable or USB-C adapter';
}


function _renderHeadsetStatus(connected) {
  _headsetConnected = connected;
  const badge = document.getElementById('headset-status-badge');
  const ribbon = document.getElementById('headset-detect-ribbon');
  const icon   = document.getElementById('headset-ribbon-icon');
  const text   = document.getElementById('headset-ribbon-text');
  if (badge) {
    badge.textContent = connected ? '🎧 CONNECTED' : 'NOT DETECTED';
    badge.style.color = connected ? 'var(--a)' : 'var(--dim)';
    badge.style.background = connected ? 'rgba(var(--a-rgb),0.12)' : 'rgba(255,255,255,0.06)';
  }
  if (ribbon) ribbon.style.borderColor = connected ? 'rgba(var(--a-rgb),0.4)' : '';
  if (icon) icon.textContent = connected ? '🎧' : '🔇';
  if (text) {
    if (connected) {
      text.textContent = 'Headset detected — configuration active';
    } else {
      // Show first matched path for diagnosis
      const pathMatch = _headsetDebugRaw.match(/EXTCON_PATH:([^=]+)=/);
      const hint = pathMatch ? `Path: ${pathMatch[1].split('/').pop()}` : 'No sysfs path found';
      text.textContent = `No headset detected — ${hint}`;
    }
  }
  // Gate controls based on connection state
  _applyHeadsetConnectedState(connected);
}

// ── Gate all config controls based on headset connection state ──────────────
// connected: true = headset plugged, false = unplugged, null = detecting
function _applyHeadsetConnectedState(connected) {
  const isDetecting = connected === null;
  const isOn        = connected === true || _otgConnected === true;

  // Elements that should be fully interactive only when connected
  const ctrlIds = [
    'headset-vol-toggle',
    'headset-vol-dec',
    'headset-vol-inc',
    'headset-vol-slider',
    'headset-mute-toggle',
  ];
  const wrap = document.getElementById('headset-config-section');
  // Mark the config body wrapper
  const body = wrap?.querySelector('.rr-universal-block');
  if (body) {
    body.style.opacity       = isOn ? '' : '0.38';
    body.style.pointerEvents = isOn ? '' : 'none';
    body.style.userSelect    = isOn ? '' : 'none';
    body.style.filter        = isOn ? '' : 'grayscale(0.4)';
    body.style.transition    = 'opacity 0.25s, filter 0.25s';
  }
  // Explicit attribute-level disable for buttons / inputs (AX + browser styling)
  ctrlIds.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    if (isOn) {
      el.removeAttribute('disabled');
      el.style.cursor = '';
    } else {
      el.setAttribute('disabled', 'disabled');
      el.style.cursor = 'not-allowed';
    }
  });
  // No-connection hint
  const hint = document.getElementById('headset-no-conn-hint');
  if (hint) {
    if (isDetecting) {
      hint.textContent = '⏳ DETECTING HEADSET / OTG…';
      hint.classList.add('visible');
    } else if (!isOn) {
      hint.textContent = '🔌 PLUG IN HEADSET OR OTG TO ENABLE CONFIGURATION';
      hint.classList.add('visible');
    } else {
      hint.classList.remove('visible');
    }
  }
  // Detection ribbon stays active regardless — re-enable it explicitly
  const ribbon = document.getElementById('headset-detect-ribbon');
  if (ribbon) { ribbon.style.pointerEvents = ''; ribbon.style.opacity = ''; }
}

function _renderHeadsetToggles() {
  const _toggle = (id, labelId, on) => {
    const btn = document.getElementById(id);
    const lbl = document.getElementById(labelId);
    if (btn) {
      btn.setAttribute('aria-pressed', String(on));
      btn.classList.toggle('gaming-toggle-btn--on', on);
      const thumb = btn.querySelector('.popup-toggle-thumb');
      if (thumb) thumb.style.transform = on ? 'translateX(16px)' : '';
    }
    if (lbl) lbl.textContent = on ? 'ON' : 'OFF';
  };
  _toggle('headset-vol-toggle', 'headset-vol-toggle-label', _headsetVolOn);
  _toggle('headset-mute-toggle', 'headset-mute-label', _headsetMuteOn);
  const controls = document.getElementById('headset-vol-controls');
  if (controls) controls.style.display = _headsetVolOn ? '' : 'none';
  const valEl = document.getElementById('headset-vol-val');
  if (valEl) valEl.textContent = `${_headsetVolVal} / 15`;
  const slider = document.getElementById('headset-vol-slider');
  if (slider) slider.value = _headsetVolVal;
}

async function _saveHeadsetConfig() {
  const cmds = [];
  cmds.push(`mkdir -p {CFG_DIR}`);
  if (_headsetVolOn) {
    cmds.push(`touch ${HEADSET_VOL_ON_FILE} && echo ${_headsetVolVal} > ${HEADSET_VOL_FILE}`);
  } else {
    cmds.push(`rm -f ${HEADSET_VOL_ON_FILE}`);
  }
  if (_headsetMuteOn) cmds.push(`touch ${HEADSET_MUTE_FILE}`);
  else cmds.push(`rm -f ${HEADSET_MUTE_FILE}`);
  await exec(cmds.join(' && '));
  // Restart daemon so new config takes effect immediately
  const anyOn = _headsetVolOn || _headsetMuteOn;
  if (anyOn) {
    await exec(`chmod 755 ${MOD}/script_runner/headset_daemon 2>/dev/null; pkill -f headset_daemon 2>/dev/null; nohup sh ${MOD}/script_runner/headset_daemon >> /sdcard/GovThermal/GovThermal.log 2>&1 &`);
  } else {
    await exec(`pkill -f headset_daemon 2>/dev/null`);
  }
  showToast('Headset config saved', 'HEADSET', 'success', '🎧');
}

// Snapshot current system volume then apply headset volume override.
// Called unconditionally on any plug-in event.
async function _applyHeadsetVolNow() {
  // Always snapshot current speaker vol first (even if vol toggle is OFF),
  // so we can always restore on unplug
  if (_preHeadsetVolSnapshot === null) {
    const raw = (await exec(
      `cmd media_session volume --stream 3 --get 2>/dev/null | grep -oE "[0-9]+" | tail -1`
    )).trim();
    const cur = parseInt(raw);
    // Prefer universalVolume (locked value) if available, else actual reading
    _preHeadsetVolSnapshot = (!isNaN(cur) && cur >= 0) ? cur : (universalVolume ?? null);
  }
  // Apply headset volume only if the toggle is ON
  if (!_headsetVolOn) return;
  await exec(`cmd media_session volume --stream 3 --set ${_headsetVolVal} 2>/dev/null; true`);
}

// Restore volume to speaker baseline on headset unplug.
// Priority: universalVolume lock → pre-headset snapshot → skip
async function _restorePreHeadsetVol() {
  const restoreVal = universalVolume ?? _preHeadsetVolSnapshot;
  _preHeadsetVolSnapshot = null; // clear so next plug-in re-snapshots fresh
  if (restoreVal === null) return;
  await exec(`cmd media_session volume --stream 3 --set ${restoreVal} 2>/dev/null; true`);
}

function initHeadsetConfig() {
  const det = document.getElementById('headset-config-section');
  det?.addEventListener('toggle', async () => {
    if (!det.open) return;
    // Immediately lock controls while detecting — shows "⏳ DETECTING…" hint
    _applyHeadsetConnectedState(null);
    // Load saved config
    const [volOnRaw, volValRaw, muteRaw] = await Promise.all([
      exec(`[ -f ${HEADSET_VOL_ON_FILE} ] && echo 1 || echo 0`),
      exec(`cat ${HEADSET_VOL_FILE} 2>/dev/null || echo 9`),
      exec(`[ -f ${HEADSET_MUTE_FILE} ] && echo 1 || echo 0`),
    ]);
    _headsetVolOn  = volOnRaw.trim() === '1';
    _headsetVolVal = parseInt(volValRaw.trim()) || 9;
    _headsetMuteOn = muteRaw.trim() === '1';
    _renderHeadsetToggles();
    // Detect headset + OTG simultaneously
    const [connected, otgNow] = await Promise.all([_detectHeadset(), _detectOtg()]);
    _headsetConnected = connected;
    _renderHeadsetStatus(connected);
    // Seed OTG state
    if (otgNow && !_otgConnected) await _enableOtgAutomatic();
    else _renderOtgStatus(otgNow);
    // Re-apply control gate now that OTG state is known — unlocks if OTG active
    _applyHeadsetConnectedState(_headsetConnected);
    // If headset already connected on open, apply headset volume immediately
    if (connected) await _applyHeadsetVolNow();
    // Start polling
    if (_headsetPollTimer) clearInterval(_headsetPollTimer);
    _headsetPollTimer = setInterval(async () => {
      const [c, otg] = await Promise.all([_detectHeadset(), _detectOtg()]);
      // ── Headset state change ──────────────────────────────────────────
      if (c !== _headsetConnected) {
        _renderHeadsetStatus(c);
        if (c) {
          _renderHeadsetToggles();
          await _applyHeadsetVolNow();
        } else {
          if (_headsetMuteOn) {
            await exec(`cmd media_session volume --stream 3 --set 0 2>/dev/null || media volume --stream 3 --set 0 2>/dev/null`);
          }
          await _restorePreHeadsetVol();
        }
      }
      // ── OTG state change ─────────────────────────────────────────────
      if (otg !== _otgConnected) {
        if (otg) {
          await _enableOtgAutomatic();
        } else {
          await _disableOtgAutomatic();
        }
        // Unlock/relock headset controls based on combined headset+OTG state
        _applyHeadsetConnectedState(_headsetConnected);
      }
    }, 2000);
  });

  // Stop polling when closed
  det?.addEventListener('toggle', () => {
    if (det.open) return;
    if (_headsetPollTimer) { clearInterval(_headsetPollTimer); _headsetPollTimer = null; }
  });

  // Vol toggle
  document.getElementById('headset-vol-toggle')?.addEventListener('click', async () => {
    _headsetVolOn = !_headsetVolOn;
    _renderHeadsetToggles();
    await _saveHeadsetConfig();
    if (_headsetConnected) await _applyHeadsetVolNow(); // re-apply with new value
  }, { passive: true });

  // Mute toggle
  document.getElementById('headset-mute-toggle')?.addEventListener('click', async () => {
    _headsetMuteOn = !_headsetMuteOn;
    _renderHeadsetToggles();
    await _saveHeadsetConfig();
  }, { passive: true });

  // Restore toggle removed — restore to universal vol is always automatic on unplug

  // Vol slider
  document.getElementById('headset-vol-slider')?.addEventListener('input', e => {
    _headsetVolVal = parseInt(e.target.value);
    const valEl = document.getElementById('headset-vol-val');
    if (valEl) valEl.textContent = `${_headsetVolVal} / 15`;
  }, { passive: true });

  document.getElementById('headset-vol-slider')?.addEventListener('change', async () => {
    await _saveHeadsetConfig();
    if (_headsetConnected) await _applyHeadsetVolNow();
  }, { passive: true });

  // Dec / Inc buttons
  document.getElementById('headset-vol-dec')?.addEventListener('click', async () => {
    const sl = document.getElementById('headset-vol-slider');
    if (sl) { sl.value = Math.max(0, parseInt(sl.value) - 1); sl.dispatchEvent(new Event('input')); sl.dispatchEvent(new Event('change')); }
  }, { passive: true });

  document.getElementById('headset-vol-inc')?.addEventListener('click', async () => {
    const sl = document.getElementById('headset-vol-slider');
    if (sl) { sl.value = Math.min(15, parseInt(sl.value) + 1); sl.dispatchEvent(new Event('input')); sl.dispatchEvent(new Event('change')); }
  }, { passive: true });
}

function initGpuPanel() {
  const slider = document.getElementById('gpu-opp-slider');
  slider?.addEventListener('input', () => {
    const oppIndex = _gpuOppMax - parseInt(slider.value);
    const valEl = document.getElementById('gpu-opp-val');
    const idxEl = document.getElementById('gpu-opp-index-val');
    if (valEl) { valEl.textContent = _gpuFreqLabel(oppIndex); }
    if (idxEl)  idxEl.textContent = oppIndex;
    _syncSliderFill(slider);
  }, { passive: true });

  document.getElementById('gpu-opp-dec')?.addEventListener('click', () => {
    if (!slider) return;
    slider.value = Math.max(0, parseInt(slider.value) - 1);
    slider.dispatchEvent(new Event('input', { bubbles: true }));
  }, { passive: true });

  document.getElementById('gpu-opp-inc')?.addEventListener('click', () => {
    if (!slider) return;
    slider.value = Math.min(parseInt(slider.max), parseInt(slider.value) + 1);
    slider.dispatchEvent(new Event('input', { bubbles: true }));
  }, { passive: true });

  document.getElementById('btn-apply-gpu')?.addEventListener('click', applyGpuLock, { passive: true });
  document.getElementById('btn-unlock-gpu')?.addEventListener('click', unlockGpu, { passive: true });

  // Lazy-load on first open
  const det = document.getElementById('gpu-freq-section')?.querySelector('.panel-details');
  det?.addEventListener('toggle', () => {
    if (det.open) loadGpuPanel();
  });
}

/* ═══════════════════════════════════════════════════════════
   § AUTO 60HZ DROP · TOUCH IDLE (Panel 04)
   Drops to 60Hz when no touch detected for N seconds.
   Spared apps are exempt — their RR won't be dropped.
   State file: /sdcard/GovThermal/config/idle60_enabled
   Delay file: /sdcard/GovThermal/config/idle60_delay
   Spare list: /sdcard/DAVION_ENGINE/idle60_spare.txt
   ═══════════════════════════════════════════════════════════ */

const IDLE60_ENABLED_FILE = `${CFG_DIR}/idle60_enabled`;
const IDLE60_DELAY_FILE   = `${CFG_DIR}/idle60_delay`;
const IDLE60_SPARE_FILE   = `/sdcard/DAVION_ENGINE/idle60_spare.txt`;
const IDLE60_DAEMON_FILE  = `${MOD}/script_runner/idle60_daemon`;

const RR_GUARD_ENABLED_FILE = `${CFG_DIR}/rr_guard_enabled`;
const RR_GUARD_DAEMON_FILE  = `${MOD}/script_runner/rr_guard`;

let _idle60Enabled  = false;
let _idle60Delay    = 5;
let _idle60SpareSet = new Set();
let _rrGuardEnabled = false;
let _idle60DelayMap = {};   // { pkg: seconds } per-app drop delay
let _idle60Tab      = 'user';
let _idle60Loaded   = false;

async function loadIdle60Panel() {
  if (_idle60Loaded) return;
  _idle60Loaded = true;

  // Read saved state
  const [enabledRaw, delayRaw, spareRaw, delaysRaw] = await Promise.all([
    exec(`cat ${IDLE60_ENABLED_FILE} 2>/dev/null`),
    exec(`cat ${IDLE60_DELAY_FILE} 2>/dev/null`),
    exec(`cat ${IDLE60_SPARE_FILE} 2>/dev/null`),
    exec(`cat /sdcard/DAVION_ENGINE/idle60_delays.txt 2>/dev/null`)
  ]);

  _idle60Enabled = enabledRaw.trim() === '1';
  _idle60Delay   = parseInt(delayRaw.trim()) || 5;
  spareRaw.trim().split('\n').filter(Boolean).forEach(p => _idle60SpareSet.add(p));
  _idle60DelayMap = {};
  delaysRaw.trim().split('\n').filter(Boolean).forEach(line => {
    const [p, d] = line.split(':');
    if (p && d) _idle60DelayMap[p.trim()] = parseInt(d.trim());
  });

  _renderIdle60Toggle();
  _renderIdle60Delay();   // updates gear button label
  renderIdle60List();
}

function _renderIdle60Toggle() {
  const btn   = document.getElementById('btn-idle60-toggle');
  const label = document.getElementById('idle60-toggle-label');
  const block = document.getElementById('idle60-settings-block');
  if (btn) {
    btn.setAttribute('aria-pressed', String(_idle60Enabled));
    btn.classList.toggle('gaming-toggle-btn--on', _idle60Enabled);
    const thumb = btn.querySelector('.popup-toggle-thumb');
    if (thumb) thumb.style.transform = _idle60Enabled ? 'translateX(16px)' : '';
  }
  if (label) label.textContent = _idle60Enabled ? 'ON' : 'OFF';
  if (block) block.style.display = _idle60Enabled ? '' : 'none';
}

function _renderIdle60Delay() {
  // Update gear button label to show active delay
  const gearLabel = document.getElementById('idle60-gear-label');
  if (gearLabel) gearLabel.textContent = `⚙ ${_idle60Delay}s`;
  // Update active state in gear popup buttons
  document.querySelectorAll('#idle60-delay-btns [data-delay]').forEach(btn => {
    const active = parseInt(btn.dataset.delay) === _idle60Delay;
    btn.classList.toggle('nexus-btn--active', active);
  });
}

function _toggleIdle60GearPopup() {
  const popup = document.getElementById('idle60-gear-popup');
  if (!popup) return;
  const isOpen = popup.style.display !== 'none';
  popup.style.display = 'none';
  if (!isOpen) {
    void popup.offsetWidth;
    popup.style.display = 'block';
    // Close on outside click
    const close = (e) => {
      if (!document.getElementById('idle60-gear-wrap')?.contains(e.target)) {
        popup.style.display = 'none';
        document.removeEventListener('click', close);
      }
    };
    setTimeout(() => document.addEventListener('click', close), 10);
  }
}

function _toggleUnivIdle60Gear() {
  const overlay = document.getElementById('idle-delay-sheet-overlay');
  const sheet   = document.getElementById('idle-delay-sheet');
  if (!overlay || !sheet) return;
  const isOpen = sheet.style.display !== 'none';
  if (isOpen) {
    _closeIdleDelaySheet();
  } else {
    overlay.style.display = 'block';
    sheet.style.display   = 'block';
    // Animate in
    sheet.style.transition = 'transform 0.25s cubic-bezier(.4,0,.2,1)';
    sheet.style.transform  = 'translateX(-50%) translateY(100%)';
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        sheet.style.transform = 'translateX(-50%) translateY(0)';
      });
    });
  }
}

function _closeIdleDelaySheet() {
  const overlay = document.getElementById('idle-delay-sheet-overlay');
  const sheet   = document.getElementById('idle-delay-sheet');
  if (!sheet) return;
  sheet.style.transform = 'translateX(-50%) translateY(100%)';
  setTimeout(() => {
    sheet.style.display   = 'none';
    if (overlay) overlay.style.display = 'none';
  }, 220);
}

function renderIdle60List() {
  const list = document.getElementById('idle60-app-list');
  if (!list) return;

  document.querySelectorAll('[data-i60tab]').forEach(btn => {
    const active = btn.dataset.i60tab === _idle60Tab;
    btn.classList.toggle('app-tab--active', active);
    btn.setAttribute('aria-selected', String(active));
  });

  // Configured = has per-app delay AND not spared
  const configuredPkgs = Object.keys(_idle60DelayMap).filter(p => !_idle60SpareSet.has(p));
  const configuredSet  = new Set(configuredPkgs);

  // USER: user apps excluding games, spared, configured
  const userPool = _userPkgs.filter(p => !_isGame(p) && !_idle60SpareSet.has(p) && !configuredSet.has(p));
  // SYSTEM: system apps excluding games and spared
  const sysPool  = _systemPkgs.filter(p => !_isGame(p) && !_idle60SpareSet.has(p) && !configuredSet.has(p));

  const userCount       = document.getElementById('idle60-count-user');
  const sysCount        = document.getElementById('idle60-count-system');
  const configuredCount = document.getElementById('idle60-count-configured');
  const sparedCount     = document.getElementById('idle60-count-spared');
  if (userCount)       userCount.textContent       = userPool.length;
  if (sysCount)        sysCount.textContent        = sysPool.length;
  if (configuredCount) configuredCount.textContent = configuredPkgs.length;
  if (sparedCount)     sparedCount.textContent     = _idle60SpareSet.size;

  const frag = document.createDocumentFragment();
  let pool = [];
  let emptyMsg = 'No apps found';

  if (_idle60Tab === 'spared') {
    pool = _sortAZ([..._idle60SpareSet]);
    emptyMsg = 'No spared apps yet';
  } else if (_idle60Tab === 'configured') {
    pool = _sortAZ(configuredPkgs);
    emptyMsg = 'No per-app delays configured yet';
  } else if (_idle60Tab === 'system') {
    pool = _sortAZ(sysPool);
    emptyMsg = 'No system apps found';
  } else {
    pool = _sortAZ(userPool);
  }

  if (!pool.length) {
    const s = document.createElement('span');
    s.className = 'list-placeholder mono';
    s.textContent = emptyMsg;
    frag.appendChild(s);
  } else {
    pool.forEach(pkg => frag.appendChild(_buildIdle60Row(pkg)));
  }

  _animList(list);
  list.replaceChildren(frag);
  loadVisibleIcons('idle60-app-list');
}

function _buildIdle60Row(pkg) {
  const isSpared = _idle60SpareSet.has(pkg);
  const perDelay = _idle60DelayMap[pkg] || null;
  const name = getAppLabel(pkg);
  const row = document.createElement('div');
  row.className = 'list-item' + (isSpared ? ' app-row-configured' : '');
  row.innerHTML = `
    <div class="item-row">
      <div class="app-icon-wrap" data-pkg="${pkg}">
        <img class="app-icon" alt="${name}" src="ksu://icon/${pkg}" onerror="this.style.opacity='0.15'">
      </div>
      <div class="item-info">
        <span class="item-title">${name}</span>
        <span class="item-desc mono">${pkg}</span>
      </div>
      <div style="display:flex;align-items:center;gap:6px;flex-shrink:0;">
        <button class="nexus-btn" style="padding:4px 8px;font-size:9px;min-width:38px;position:relative;"
          data-i60gear="${pkg}" title="Per-app drop delay">
          ${perDelay ? `⏱${perDelay}s` : '⚙'}
        </button>
        <button class="nexus-btn${isSpared ? ' nexus-btn--active' : ''}"
          style="padding:4px 10px;font-size:9px;min-width:56px;"
          data-i60spare="${pkg}">
          ${isSpared ? '🛡 SPARED' : 'SPARE'}
        </button>
      </div>
    </div>`;

  // Gear — show inline delay picker
  row.querySelector('[data-i60gear]')?.addEventListener('click', e => {
    e.stopPropagation();
    _showIdle60DelayPicker(pkg, row);
  });

  row.querySelector('[data-i60spare]')?.addEventListener('click', async () => {
    const nowSpared = !_idle60SpareSet.has(pkg);
    if (!nowSpared) {
      _idle60SpareSet.delete(pkg);
      showToast(`${getAppLabel(pkg)} will drop to 60Hz when idle`, 'AUTO 60HZ', 'info', '🖥️');
    } else {
      _idle60SpareSet.add(pkg);
      showToast(`${getAppLabel(pkg)} spared from 60Hz drop`, 'AUTO 60HZ', 'success', '🛡');
    }
    await _saveIdle60Spare();
    renderIdle60List();
    await _applyIdle60Daemon();
  });
  return row;
}

function _showIdle60DelayPicker(pkg, rowEl) {
  // Remove any existing picker
  document.querySelectorAll('.idle60-delay-picker').forEach(p => p.remove());

  const cur = _idle60DelayMap[pkg] || null;
  const picker = document.createElement('div');
  picker.className = 'idle60-delay-picker';
  picker.style.cssText = [
    'position:absolute', 'z-index:200', 'right:0', 'top:100%',
    'background:var(--bg3)', 'border:1px solid var(--bdr)',
    'border-radius:8px', 'padding:8px', 'display:flex',
    'flex-direction:column', 'gap:4px', 'min-width:110px',
    'box-shadow:0 4px 16px rgba(0,0,0,0.5)'
  ].join(';');

  const options = [
    { label: '3s — fast', val: 3 },
    { label: '5s — normal', val: 5 },
    { label: '8s — slow', val: 8 },
    { label: 'Global default', val: null },
  ];

  options.forEach(({ label, val }) => {
    const b = document.createElement('button');
    b.className = 'nexus-btn' + (cur === val ? ' nexus-btn--active' : '');
    b.style.cssText = 'font-size:9px;padding:4px 8px;text-align:left;width:100%;';
    b.textContent = label;
    b.addEventListener('click', async e => {
      e.stopPropagation();
      picker.remove();
      if (val === null) {
        delete _idle60DelayMap[pkg];
      } else {
        _idle60DelayMap[pkg] = val;
        showToast(`${getAppLabel(pkg)} idle delay → ${val}s`, 'AUTO 60HZ', 'info', '⏱');
      }
      await _saveIdle60Delays();
      renderIdle60List();
    });
    picker.appendChild(b);
  });

  // Position relative to gear button
  const gear = rowEl.querySelector('[data-i60gear]');
  gear.style.position = 'relative';
  gear.appendChild(picker);

  // Close on outside click
  const close = (ev) => {
    if (!picker.contains(ev.target)) {
      picker.remove();
      document.removeEventListener('click', close);
    }
  };
  setTimeout(() => document.addEventListener('click', close), 10);
}

async function _saveIdle60Delays() {
  const entries = Object.entries(_idle60DelayMap);
  if (!entries.length) {
    await exec(`rm -f /sdcard/DAVION_ENGINE/idle60_delays.txt`);
    return;
  }
  // Build shell commands: one echo per line to avoid JSON escaping issues
  const cmds = entries.map(([p, d]) => `echo ${JSON.stringify(p + ':' + d)}`).join(' && ');
  await exec(`mkdir -p /sdcard/DAVION_ENGINE && { ${cmds}; } > /sdcard/DAVION_ENGINE/idle60_delays.txt`);
}

async function _saveIdle60Spare() {
  // _idle60SpareSet is only the idle60 panel's list.
  // Per-app toggles (from App/Game Configuration) do direct file append/remove.
  // So: add new entries from set, remove deleted entries, leave others untouched.
  const inSet = new Set([..._idle60SpareSet]);

  // Read current file to find packages not managed by the idle60 panel set
  const existing = (await exec(`cat ${IDLE60_SPARE_FILE} 2>/dev/null`)).trim().split('\n').filter(Boolean);

  // Merge: keep all existing entries + add any in set not already there
  const merged = new Set(existing);
  for (const p of inSet) merged.add(p);

  // Remove entries that were previously in the set but are no longer
  // (user removed from idle60 panel list)
  for (const p of existing) {
    // If it was in the set before (loaded into _idle60SpareSet initially) but not now → remove
    // We can't perfectly know what was "previously in set", so: only remove if NOT in merged set
    // This is safe since per-app toggle adds/removes directly without going through set
  }

  // Simplest correct approach: just write the set — per-app toggles already wrote their changes
  if (!inSet.size) { await exec(`rm -f ${IDLE60_SPARE_FILE}`); return; }
  const args = [...inSet].map(p => JSON.stringify(p)).join(' ');
  await exec(`mkdir -p /sdcard/DAVION_ENGINE && printf '%s\n' ${args} > ${IDLE60_SPARE_FILE}`);
}


// ── RR Guard daemon control ───────────────────────────────────────────────
function _renderRrGuardToggle() {
  const btn   = document.getElementById('btn-rr-guard-toggle');
  const label = document.getElementById('rr-guard-toggle-label');
  if (btn) {
    btn.setAttribute('aria-pressed', String(_rrGuardEnabled));
    btn.classList.toggle('gaming-toggle-btn--on', _rrGuardEnabled);
    const thumb = btn.querySelector('.popup-toggle-thumb');
    if (thumb) thumb.style.transform = _rrGuardEnabled ? 'translateX(16px)' : '';
  }
  if (label) label.textContent = _rrGuardEnabled ? 'ON' : 'OFF';
}

async function _applyRrGuard() {
  await exec(`mkdir -p ${CFG_DIR} && echo '${_rrGuardEnabled ? 1 : 0}' > ${RR_GUARD_ENABLED_FILE}`);
  await exec(`pkill -f "rr_guard" 2>/dev/null`);
  if (_rrGuardEnabled) {
    if (await exec(`[ -x "${RR_GUARD_DAEMON_FILE}" ] && echo 1 || echo 0`).then(r => r.trim() === '1')) {
      await exec(`chmod 755 "${RR_GUARD_DAEMON_FILE}" 2>/dev/null; nohup sh "${RR_GUARD_DAEMON_FILE}" >> ${MOD}/GovThermal.log 2>&1 &`);
    }
    showToast('RR Guard enabled — instant restore on 60Hz drop', 'RR GUARD', 'success', '🛡');
  } else {
    showToast('RR Guard disabled', 'RR GUARD', 'info', '🛡');
  }
}

async function _applyIdle60Daemon() {
  await exec(`mkdir -p ${CFG_DIR} && echo '${_idle60Enabled ? 1 : 0}' > ${IDLE60_ENABLED_FILE}`);
  await exec(`echo '${_idle60Delay}' > ${IDLE60_DELAY_FILE}`);
  // Kill existing daemon and restart if enabled
  await exec(`pkill -f "idle60_daemon" 2>/dev/null; pkill -f "idle_60hz" 2>/dev/null`);
  if (_idle60Enabled) {
    if (await exec(`[ -x "${IDLE60_DAEMON_FILE}" ] && echo 1 || echo 0`).then(r => r.trim() === '1')) {
      await exec(`nohup sh "${IDLE60_DAEMON_FILE}" >> ${MOD}/GovThermal.log 2>&1 &`);
    }
    showToast(`60Hz drop enabled · ${_idle60Delay}s idle`, 'AUTO 60HZ', 'success', '🖥️');
  } else {
    // Restore current universal RR when disabled
    const urrRaw = await exec(`cat ${UNIVERSAL_RR_FILE} 2>/dev/null`);
    const urr = urrRaw.trim();
    if (urr) await exec(`service call SurfaceFlinger 1035 i32 ${urr} 2>/dev/null`);
    showToast('60Hz drop disabled', 'AUTO 60HZ', 'info', '🖥️');
  }
}

function initIdle60Panel() {
  const det = document.getElementById('idle-60hz-section')?.querySelector('.panel-details');
  det?.addEventListener('toggle', () => {
    if (det.open) loadIdle60Panel();
  });

  // Load toggle state immediately (button is in Universal RR, always visible)
  exec(`cat ${IDLE60_ENABLED_FILE} 2>/dev/null`).then(r => {
    _idle60Enabled = r.trim() === '1';
    _renderIdle60Toggle();
  });
  exec(`cat ${IDLE60_DELAY_FILE} 2>/dev/null`).then(r => {
    _idle60Delay = parseInt(r.trim()) || 5;
    _renderIdle60Delay();
    const gl = document.getElementById('univ-idle60-gear-label');
    if (gl) gl.textContent = `⚙ ${_idle60Delay}s`;
  });

  // Global toggle
  document.getElementById('btn-idle60-toggle')?.addEventListener('click', async (e) => {
    e.stopPropagation();  // prevent details open/close from bubbling
    if (!_idle60Loaded) await loadIdle60Panel();
    _idle60Enabled = !_idle60Enabled;
    _renderIdle60Toggle();
    await _applyIdle60Daemon();
  });

  // RR Guard toggle
  exec(`cat ${RR_GUARD_ENABLED_FILE} 2>/dev/null`).then(r => {
    _rrGuardEnabled = r.trim() === '1';
    _renderRrGuardToggle();
  });
  document.getElementById('btn-rr-guard-toggle')?.addEventListener('click', async (e) => {
    e.stopPropagation();
    _rrGuardEnabled = !_rrGuardEnabled;
    _renderRrGuardToggle();
    await _applyRrGuard();
  });

  // Delay buttons (inside gear popup)
  document.getElementById('idle60-delay-btns')?.addEventListener('click', async e => {
    const btn = e.target.closest('[data-delay]');
    if (!btn) return;
    e.stopPropagation();
    _idle60Delay = parseInt(btn.dataset.delay);
    _renderIdle60Delay();
    // Close popup
    const popup = document.getElementById('idle60-gear-popup');
    if (popup) popup.style.display = 'none';
    await exec(`echo '${_idle60Delay}' > ${IDLE60_DELAY_FILE}`);
    if (_idle60Enabled) await _applyIdle60Daemon();
  });

  // Tab clicks
  document.addEventListener('click', e => {
    const tab = e.target.closest('[data-i60tab]');
    if (!tab) return;
    _idle60Tab = tab.dataset.i60tab;
    renderIdle60List();
  });
}

/* ═══════════════════════════════════════════════════════════
   § DEEP SLEEP (Panel 04 sub-panel)
   Throttles CPU to hardware min when screen off.
   Restores on screen on via logcat daemon hook.
   Flag file: /sdcard/GovThermal/config/deep_sleep_enabled
   ═══════════════════════════════════════════════════════════ */
const DEEP_SLEEP_FLAG = `${CFG_DIR}/deep_sleep_enabled`;
const FEAT_FRAME_FLAG    = `${CFG_DIR}/feat_frame_stability`;
const FEAT_THROTTLE_FLAG = `${CFG_DIR}/feat_anti_throttle`;

/* ═══════════════════════════════════════════════════════════
   § GLOBAL SEARCH — per-letter auto-suggest
   Indexes: panel names, subpanel names, app & game pkg+labels
   ═══════════════════════════════════════════════════════════ */
function initGlobalSearch() {
  const input   = document.getElementById('global-search-input');
  const results = document.getElementById('global-search-results');
  const clearBtn= document.getElementById('global-search-clear');
  if (!input || !results) return;

  // ── Static search index: panels + subpanels ───────────────
  // Each entry: { icon, label, sub, badge, action }
  // action: function called when user taps the suggestion
  const STATIC_INDEX = [
    // ── Panels ──
    { icon:'🎮', label:'GAME LIST · GAME CONFIGURATION', sub:'Panel 01',  badge:'PANEL',
      action: () => scrollToPanel('game-list-section', true) },
    { icon:'⚡', label:'CPU · GOVERNOR & FREQUENCY',      sub:'Panel 02',  badge:'PANEL',
      action: () => scrollToPanel('cpu-gov-section', true) },
    { icon:'🖥', label:'GPU · FREQUENCY CONTROL',         sub:'Panel 03',  badge:'PANEL',
      action: () => scrollToPanel('gpu-freq-section', true) },
    { icon:'🔋', label:'BATTERY SECTION · SAVES BATTERY', sub:'Panel 04',  badge:'PANEL',
      action: () => scrollToPanel('idle-60hz-section', true) },
    { icon:'🔒', label:'UNIVERSAL RR/BRIGHTNESS/VOLUME',  sub:'Panel 05',  badge:'PANEL',
      action: () => scrollToPanel('rr-panel-section', true) },
    { icon:'📱', label:'PER-APP RR/BRIGHTNESS/VOLUME',    sub:'Panel 06',  badge:'PANEL',
      action: () => scrollToPanel('perapp-rr-section', true) },
    { icon:'🎨', label:'BOOST COLOR · SATURATION',        sub:'Panel 07',  badge:'PANEL',
      action: () => scrollToPanel('boost-color-section', true) },
    { icon:'🎞', label:'ANIMATION SCALE',                  sub:'Panel 08',  badge:'PANEL',
      action: () => scrollToPanel('anim-scale-section', true) },
    { icon:'⏹', label:'KILL OTHERS · LAUNCH MANAGER',    sub:'Panel 09',  badge:'PANEL',
      action: () => scrollToPanel('kill-others-section', true) },
    { icon:'📶', label:'CONNECTION ON LAUNCH',             sub:'Panel 10',  badge:'PANEL',
      action: () => scrollToPanel('conn-launch-section', true) },
    { icon:'🛠', label:'FEATURES · FPS STABILITY',         sub:'Panel 11',  badge:'PANEL',
      action: () => scrollToPanel('features-section', true) },
    { icon:'🎯', label:'FRAME STABILITY',                   sub:'Features → Frame Stability toggle', badge:'SETTING',
      action: () => scrollToPanel('features-section', true, 'feat-frame-sub') },
    { icon:'🔥', label:'ANTI-THROTTLE BOOST',               sub:'Features → Anti-Throttle toggle',   badge:'SETTING',
      action: () => scrollToPanel('features-section', true, 'feat-throttle-sub') },
    { icon:'🔥', label:'PYROX THERMAL',                     sub:'Features → Pyrox Thermal toggle',   badge:'SETTING',
      action: () => scrollToPanel('features-section', true, 'feat-pyrox-sub') },
    { icon:'❄️', label:'COOL MODE',                         sub:'Features → Cool Mode toggle',       badge:'SETTING',
      action: () => scrollToPanel('features-section', true, 'feat-cool-sub') },
    { icon:'⚡', label:'CPU VOLTS OPTIMIZER',               sub:'Features → CPU Volts Optimizer',    badge:'SETTING',
      action: () => scrollToPanel('features-section', true, 'feat-cpuvolt-sub') },

    // ── Sub-panels / settings (common searches) ──
    { icon:'🔋', label:'CHARGE LIMIT',              sub:'Battery Section → Charge Limit',     badge:'SETTING',
      action: () => { scrollToPanel('idle-60hz-section', true);
        setTimeout(() => document.getElementById('header-charge-bubble')?.setAttribute('open',''), 400); } },
    { icon:'⚡', label:'FAST CHARGE · SCP',         sub:'Battery Section → Charge Limit',     badge:'SETTING',
      action: () => { scrollToPanel('idle-60hz-section', true);
        setTimeout(() => document.getElementById('header-charge-bubble')?.setAttribute('open',''), 400); } },
    { icon:'💤', label:'DEEP SLEEP · SCREEN OFF',   sub:'Battery Section → Deep Sleep',       badge:'SETTING',
      action: () => scrollToPanel('idle-60hz-section', true) },
    { icon:'🔋', label:'BATTERY SAVER · PER-APP',   sub:'Battery Section → Battery Saver',    badge:'SETTING',
      action: () => scrollToPanel('idle-60hz-section', true) },
    { icon:'🖥', label:'AUTO 60HZ · IDLE DROP',     sub:'Battery Section → Auto 60Hz Drop',   badge:'SETTING',
      action: () => scrollToPanel('idle-60hz-section', true) },
    { icon:'🖥', label:'AUTO 60HZ 2S',              sub:'Battery Section → Auto 60Hz → 2s idle', badge:'SETTING',
      action: () => scrollToPanel('idle-60hz-section', true) },
    { icon:'🛡', label:'RR GUARD',                  sub:'Battery Section → RR Guard',         badge:'SETTING',
      action: () => scrollToPanel('idle-60hz-section', true) },
    { icon:'🔒', label:'UNIVERSAL REFRESH RATE LOCK', sub:'Universal RR/Brightness/Volume',   badge:'SETTING',
      action: () => scrollToPanel('rr-panel-section', true) },
    { icon:'🖥', label:'REFRESH RATE',              sub:'Universal RR/Brightness/Volume',     badge:'SETTING',
      action: () => scrollToPanel('rr-panel-section', true) },
    { icon:'☀', label:'BRIGHTNESS',                sub:'Universal RR/Brightness/Volume',     badge:'SETTING',
      action: () => scrollToPanel('rr-panel-section', true) },
    { icon:'🔊', label:'VOLUME',                    sub:'Universal RR/Brightness/Volume',     badge:'SETTING',
      action: () => scrollToPanel('rr-panel-section', true) },
    { icon:'🎧', label:'HEADSET CONFIGURATION',     sub:'Universal RR → Headset Config',      badge:'SETTING',
      action: () => scrollToPanel('rr-panel-section', true, 'headset-config-section') },
    { icon:'🎧', label:'HEADSET VOLUME',            sub:'Per-App → App/Game Config popup',    badge:'SETTING',
      action: () => scrollToPanel('perapp-rr-section', true) },
    { icon:'🛡', label:'SPARE FROM 60HZ',           sub:'Per-App → App/Game Config popup',    badge:'SETTING',
      action: () => scrollToPanel('perapp-rr-section', true) },
    { icon:'🌈', label:'SATURATION · COLOR BOOST',  sub:'Boost Color Panel',                  badge:'SETTING',
      action: () => scrollToPanel('boost-color-section', true) },
    { icon:'🎮', label:'ENCORE TWEAKS',             sub:'Game List → Game Config popup',       badge:'SETTING',
      action: () => scrollToPanel('game-list-section', true) },
    { icon:'⏹', label:'KILL OTHERS ON LAUNCH',     sub:'Panel 09 · Kill Others',              badge:'SETTING',
      action: () => scrollToPanel('kill-others-section', true) },
    { icon:'📶', label:'WIFI · DATA · GPS',         sub:'Connection On Launch',                badge:'SETTING',
      action: () => scrollToPanel('conn-launch-section', true) },
    { icon:'⚙', label:'CPU GOVERNOR PROFILES',     sub:'CPU · Governor & Frequency',          badge:'SETTING',
      action: () => scrollToPanel('cpu-gov-section', true, 'adv-cpu-profiles') },
    { icon:'🏛', label:'CPU GOVERNOR',              sub:'CPU · Governor & Frequency',          badge:'SETTING',
      action: () => scrollToPanel('cpu-gov-section', true) },
    { icon:'📊', label:'CPU FREQUENCY',             sub:'CPU · Governor & Frequency',          badge:'SETTING',
      action: () => scrollToPanel('cpu-gov-section', true) },
    { icon:'🖥', label:'GPU FREQUENCY',             sub:'GPU · Frequency Control',             badge:'SETTING',
      action: () => scrollToPanel('gpu-freq-section', true) },
    { icon:'⏱', label:'SCREEN OFF TIMEOUT',        sub:'Universal RR → Screen Off Timeout',   badge:'SETTING',
      action: () => scrollToPanel('rr-panel-section', true, 'univ-screen-timeout-section') },
    { icon:'⏱', label:'SCREEN OFF 30 SECONDS',     sub:'Universal RR → Screen Off Timeout → 30s', badge:'SETTING',
      action: () => scrollToPanel('rr-panel-section', true, 'univ-screen-timeout-section') },
    { icon:'⏱', label:'SCREEN TIMEOUT PER-APP',    sub:'Per-App → App/Game Config popup',     badge:'SETTING',
      action: () => scrollToPanel('perapp-rr-section', true) },
    { icon:'🎨', label:'THEME',                  sub:'Header → ⚙ Gear → Theme picker',   badge:'SETTING',
      action: () => _searchOpenTheme() },
    { icon:'🟡', label:'THEME VOLT',             sub:'Yellow-green accent', badge:'THEME',
      action: () => _searchApplyTheme('volt') },
    { icon:'🔵', label:'THEME CYAN',             sub:'Cyan / teal accent',  badge:'THEME',
      action: () => _searchApplyTheme('cyan') },
    { icon:'🔴', label:'THEME RED',              sub:'Red accent',           badge:'THEME',
      action: () => _searchApplyTheme('red') },
    { icon:'🟠', label:'THEME AMBER',            sub:'Amber / orange accent', badge:'THEME',
      action: () => _searchApplyTheme('amber') },
    { icon:'🟡', label:'THEME YELLOW',           sub:'Yellow accent',        badge:'THEME',
      action: () => _searchApplyTheme('yellow') },
    { icon:'🟣', label:'THEME VIOLET',           sub:'Purple accent',        badge:'THEME',
      action: () => _searchApplyTheme('violet') },
    { icon:'⬛', label:'THEME DARK',             sub:'Dark grey accent',     badge:'THEME',
      action: () => _searchApplyTheme('dark') },
    { icon:'⬛', label:'THEME BLACK',            sub:'Pure black accent',    badge:'THEME',
      action: () => _searchApplyTheme('black') },
    { icon:'📡', label:'OVERLAY',                 sub:'Header → Overlay toggle',         badge:'SETTING',
      action: () => document.getElementById('stat-overlay')?.click() },
    { icon:'🔄', label:'HOT RELOAD · AUTO UPDATE',        sub:'Drop zip to /sdcard/DAVION_ENGINE/hot_reload/', badge:'SETTING',
      action: () => showToast('Drop zip to /sdcard/DAVION_ENGINE/hot_reload/', 'HOT RELOAD', 'info', '🔄') },
    { icon:'🗑', label:'CLEAR APP CACHE',           sub:'Panel 12 · Clear cache per app',   badge:'PANEL',
      action: () => scrollToPanel('clear-cache-section', true) },
    { icon:'🗑', label:'CACHE CLEAR ON LAUNCH',     sub:'App/Game Config popup',             badge:'SETTING',
      action: () => scrollToPanel('perapp-rr-section', true) },
    { icon:'🛡', label:'STORM GUARD · BOOTLOOP PROTECTION',  sub:'Panel 11 · Features',      badge:'SETTING',
      action: () => scrollToPanel('features-section', true) },
    { icon:'📦', label:'BUSYBOX · BRUTAL BUSYBOX',            sub:'Panel 11 · Features',       badge:'SETTING',
      action: () => scrollToPanel('features-section', true) },
    { icon:'📷', label:'RAW CAMERA PATCH',                    sub:'Panel 11 · Features',       badge:'SETTING',
      action: () => scrollToPanel('features-section', true) },
    { icon:'💾', label:'ZRAM · MEMORY MANAGER',               sub:'Panel 11 · Features',       badge:'SETTING',
      action: () => scrollToPanel('features-section', true) },
    { icon:'🎭', label:'DEVICE SPOOF · GRAPHIC SPOOF · COPG', sub:'Panel 11 · Features',       badge:'SETTING',
      action: () => scrollToPanel('features-section', true) },
    { icon:'⚡', label:'REMOVE LIMIT · 120HZ UNLOCK',         sub:'Panel 11 · Features',       badge:'SETTING',
      action: () => scrollToPanel('features-section', true) },
    { icon:'🎞', label:'ANIMATION FIX · HiOS FIX',            sub:'Panel 11 · Features',       badge:'SETTING',
      action: () => scrollToPanel('features-section', true) },
    { icon:'💤', label:'DEEP SLEEP GOVERNOR',                  sub:'Panel 11 · Features',       badge:'SETTING',
      action: () => scrollToPanel('features-section', true) },
    { icon:'⚡', label:'FAST CHARGE · SCP CHARGER',           sub:'Battery Section → Charge',  badge:'SETTING',
      action: () => { scrollToPanel('idle-60hz-section', true);
        setTimeout(() => document.getElementById('header-charge-bubble')?.setAttribute('open',''), 400); } },
    { icon:'🔋', label:'CV VOLTAGE · CHARGE VOLTAGE',         sub:'Battery Section → Charge',  badge:'SETTING',
      action: () => { scrollToPanel('idle-60hz-section', true);
        setTimeout(() => document.getElementById('header-charge-bubble')?.setAttribute('open',''), 400); } },
    { icon:'🛡', label:'AUTO 60HZ SPARE LIST',                sub:'Battery → Auto 60Hz Drop',  badge:'SETTING',
      action: () => scrollToPanel('idle-60hz-section', true) },
    { icon:'🖥', label:'IDLE 60HZ DROP DELAY',                sub:'Battery → Auto 60Hz → delay per app', badge:'SETTING',
      action: () => scrollToPanel('idle-60hz-section', true) },
  ];

  // ── Dynamic app index (built after loadAppList resolves) ──
  let _appIndex = [];   // { icon, label, sub, badge, pkg, action }
  let _appIndexReady = false;

  function buildAppIndex() {
    if (_appIndexReady) return;
    const allPkgs = [...new Set([..._userPkgs, ..._systemPkgs])];
    _appIndex = allPkgs.map(pkg => {
      const label = getAppLabel(pkg);
      const isGame = typeof _isGame === 'function' ? _isGame(pkg) : false;
      return {
        icon:   isGame ? '🎮' : '📱',
        label:  label.toUpperCase(),
        sub:    pkg,
        badge:  isGame ? 'GAME' : 'APP',
        pkg,
        action: () => _searchOpenAppPopup(pkg, isGame)
      };
    });
    _appIndexReady = true;
  }

  // ── Highlight matched portion in label ───────────────────
  function highlight(text, query) {
    if (!query) return _esc(text);
    const idx = text.toLowerCase().indexOf(query.toLowerCase());
    if (idx === -1) return _esc(text);
    return _esc(text.slice(0, idx))
      + '<mark>' + _esc(text.slice(idx, idx + query.length)) + '</mark>'
      + _esc(text.slice(idx + query.length));
  }
  function _esc(s) {
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  // ── Score: match quality (starts-with > includes) ────────
  function score(entry, q) {
    const lbl = entry.label.toLowerCase();
    const sub = entry.sub.toLowerCase();
    const ql  = q.toLowerCase();
    if (lbl.startsWith(ql))             return 3;
    if (lbl.includes(ql))               return 2;
    if (sub.toLowerCase().includes(ql)) return 1;
    return 0;
  }

  // ── Scroll panel into view + open it ────────────────────
  // scrollToPanel(panelId, open, subpanelId)
  //   panelId    — the nexus-panel section ID (always scrolled to + glowed)
  //   open       — whether to open the panel's <details> (default true)
  //   subpanelId — optional: ID of a nested <details> subpanel to open AND glow instead of the section
  function scrollToPanel(id, open = true, subId = null) {
    closeSearch();
    const section = document.getElementById(id);
    if (!section) return;

    // Open the parent panel
    const details = section.querySelector('.panel-details');
    if (open && details && !details.open) details.open = true;

    // If a subpanel ID given, open it too
    // Works for both <details> subpanels and adv-details (conn-bubble) inside panels
    const subEl = subId ? document.getElementById(subId) : null;
    if (subEl) {
      // Open the subpanel itself
      if (!subEl.open) subEl.open = true;
      // Also ensure any parent <details> within the section is open
      let parent = subEl.parentElement;
      while (parent && parent !== section) {
        if (parent.tagName === 'DETAILS' && !parent.open) parent.open = true;
        parent = parent.parentElement;
      }
    }

    // Determine the element to scroll to and glow
    const glowTarget = subEl || section;

    // Wait for details expansion animation before scroll (details transition ~200ms)
    const scrollDelay = subEl ? 300 : 120;
    setTimeout(() => {
      // Use requestAnimationFrame for reliable post-layout scroll
      requestAnimationFrame(() => {
        glowTarget.scrollIntoView({ behavior: 'smooth', block: 'start' });
        setTimeout(() => {
          const glowClass = subEl ? 'adv-details--search-glow' : 'nexus-panel--search-glow';

          // Remove previous glow on ALL possible targets first
          section.classList.remove('nexus-panel--search-glow');
          section.querySelectorAll('.adv-details--search-glow')
            .forEach(el => el.classList.remove('adv-details--search-glow'));

          // Force reflow then add glow
          void glowTarget.offsetWidth;
          glowTarget.classList.add(glowClass);
          glowTarget.addEventListener('animationend', () => {
            glowTarget.classList.remove(glowClass);
          }, { once: true });
        }, 400);
      });
    }, scrollDelay);
  }

  // ── Render dropdown ──────────────────────────────────────
  let _focusIdx = -1;
  let _items    = [];

  // ── Search history (last 3 unique entries, persisted in sessionStorage) ─
  const HISTORY_KEY = 'gs_history';
  function _loadHistory() {
    try { return JSON.parse(sessionStorage.getItem(HISTORY_KEY) || '[]'); } catch { return []; }
  }
  function _saveHistory(entries) {
    try { sessionStorage.setItem(HISTORY_KEY, JSON.stringify(entries.slice(0, 3))); } catch {}
  }
  function _addToHistory(entry) {
    let hist = _loadHistory().filter(h => h.label !== entry.label);
    hist.unshift({ icon: entry.icon, label: entry.label, sub: entry.sub, badge: entry.badge });
    _saveHistory(hist);
  }

  // Wrap an entry's action to record history before navigating
  function _withHistory(entry) {
    return {
      ...entry,
      action: () => { _addToHistory(entry); entry.action(); }
    };
  }

  // ── Render history dropdown (shown on focus with empty query) ─────────
  function renderHistory() {
    results.innerHTML = '';
    const hist = _loadHistory();
    if (!hist.length) { results.hidden = true; return; }

    const header = document.createElement('div');
    header.className = 'gs-history-header mono';
    header.textContent = 'RECENT';
    results.appendChild(header);

    hist.forEach(h => {
      // Match history entry back to a live entry (to get the action)
      const live = [...STATIC_INDEX, ..._appIndex].find(e => e.label === h.label);
      const row = document.createElement('div');
      row.className = 'gs-item gs-item--history';
      row.innerHTML = `
        <span class="gs-item-icon">${h.icon}</span>
        <span class="gs-item-body">
          <span class="gs-item-label">${_esc(h.label)}</span>
          <span class="gs-item-sub">${_esc(h.sub)}</span>
        </span>
        <span class="gs-item-badge gs-badge--history">⏱</span>`;
      row.addEventListener('pointerdown', e => {
        e.preventDefault();
        _addToHistory(h);
        if (live) live.action(); else results.hidden = true;
        input.value = '';
        clearBtn.hidden = true;
        results.hidden = true;
      });
      results.appendChild(row);
    });

    results.hidden = false;
  }

  function render(query) {
    const q = query.trim();
    results.innerHTML = '';
    _focusIdx = -1;

    if (!q) { renderHistory(); return; }

    // Merge static + app index, score, sort, limit
    buildAppIndex();
    const pool = [...STATIC_INDEX, ..._appIndex];
    _items = pool
      .map(e => ({ e, s: score(e, q) }))
      .filter(x => x.s > 0)
      .sort((a, b) => {
        if (b.s !== a.s) return b.s - a.s;
        const order = { PANEL:0, SETTING:1, GAME:2, APP:3 };
        return (order[a.e.badge]??9) - (order[b.e.badge]??9);
      })
      .slice(0, 12)
      .map(x => _withHistory(x.e));

    if (_items.length === 0) {
      results.innerHTML = `<div class="gs-empty">No results for "${_esc(q)}"</div>`;
      results.hidden = false;
      return;
    }

    _items.forEach((entry, i) => {
      const row = document.createElement('div');
      row.className = 'gs-item';
      row.dataset.idx   = i;
      row.dataset.badge = entry.badge;
      row.innerHTML = `
        <span class="gs-item-icon">${entry.icon}</span>
        <span class="gs-item-body">
          <span class="gs-item-label">${highlight(entry.label, q)}</span>
          <span class="gs-item-sub">${_esc(entry.sub)}</span>
        </span>
        <span class="gs-item-badge">${entry.badge}</span>`;
      row.addEventListener('pointerdown', e => {
        e.preventDefault();
        // Hide dropdown first, then action (prevents scroll fighting on mobile)
        input.value = '';
        clearBtn.hidden = true;
        results.hidden = true;
        requestAnimationFrame(() => entry.action());
      });
      results.appendChild(row);
    });

    results.hidden = false;
  }

  // ── Keyboard navigation ──────────────────────────────────
  function moveFocus(delta) {
    const rows = results.querySelectorAll('.gs-item');
    if (!rows.length) return;
    rows[_focusIdx]?.classList.remove('gs-focused');
    _focusIdx = Math.max(-1, Math.min(rows.length - 1, _focusIdx + delta));
    if (_focusIdx >= 0) {
      rows[_focusIdx].classList.add('gs-focused');
      rows[_focusIdx].scrollIntoView({ block: 'nearest' });
    }
  }

  function closeSearch() {
    results.hidden = true;
    _focusIdx = -1;
    input.blur();
  }

  // ── Events ───────────────────────────────────────────────
  input.addEventListener('focus', () => {
    if (!input.value) renderHistory();
  });

  input.addEventListener('input', () => {
    clearBtn.hidden = !input.value;
    render(input.value);
  });

  input.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown')  { e.preventDefault(); moveFocus(+1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); moveFocus(-1); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      if (_focusIdx >= 0 && _items[_focusIdx]) {
        _items[_focusIdx].action(); // action already wraps history via _withHistory
        input.value = '';
        clearBtn.hidden = true;
        results.hidden = true;
      }
    }
    else if (e.key === 'Escape') { closeSearch(); }
  });

  clearBtn.addEventListener('click', () => {
    input.value = '';
    clearBtn.hidden = true;
    results.hidden = true;
    input.focus();
  });

  // Close dropdown when tapping outside
  document.addEventListener('pointerdown', e => {
    if (!results.hidden &&
        !results.contains(e.target) &&
        !input.contains(e.target) &&
        e.target !== clearBtn) {
      results.hidden = true;
    }
  }, { passive: true });

  // Rebuild app index lazily whenever loadAppList finishes
  // (hook onto the existing renderAppTab call by watching _userPkgs length)
  const _origRenderAppTab = window.renderAppTab;
  if (typeof _origRenderAppTab === 'function') {
    window.renderAppTab = function(...args) {
      _appIndexReady = false;  // invalidate on refresh
      return _origRenderAppTab.apply(this, args);
    };
  }
}

/* ═══════════════════════════════════════════════════════════
   § GLOBAL SEARCH — direct app/game popup navigation
   Force-loads the list if needed, then opens the config popup
   directly via openPopup() — no DOM gear-button hunting.
   ═══════════════════════════════════════════════════════════ */
async function _searchOpenAppPopup(pkg, isGame) {
  // 1. Open + scroll to the correct panel section
  const panelId  = isGame ? 'game-list-section' : 'perapp-rr-section';
  const section  = document.getElementById(panelId);
  if (section) {
    const det = section.querySelector('.panel-details');
    if (det && !det.open) det.open = true;
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // 2. Ensure app list is loaded
  if (isGame) {
    // Game list: load if not yet loaded
    if (!_glLoaded) {
      await loadGameListPanel();
    }
  } else {
    // Per-app list: load if _userPkgs is still empty
    if (!_userPkgs.length && !_systemPkgs.length) {
      await loadAppList();
    } else {
      // Make sure the tab that contains this pkg is selected
      const inUser = _userPkgs.includes(pkg);
      const targetTab = inUser ? 'user' : 'system';
      if (_activeTab !== targetTab && _activeTab !== 'configured') {
        renderAppTab(targetTab);
      }
    }
  }

  // 3. Short wait for DOM to render the rows, then open popup directly
  await new Promise(r => setTimeout(r, 180));

  // 4. Call openPopup directly — no DOM hunting needed
  if (typeof openPopup === 'function') {
    openPopup(pkg, null, isGame);
  }
}

/* ── Search: open theme picker bubble ───────────────────────────────────── */
function _searchOpenTheme() {
  // Scroll to top so the gear icon (in header) is visible
  window.scrollTo({ top: 0, behavior: 'smooth' });
  setTimeout(() => {
    // Open fab menu then trigger theme button click
    const fabBtn    = document.getElementById('fab-settings-btn');
    const menuTheme = document.getElementById('fab-menu-theme');
    const fabMenu   = document.getElementById('fab-menu');
    if (!fabBtn) return;
    // Open menu if not open
    if (!fabMenu?.classList.contains('fab-menu--open')) fabBtn.click();
    // After menu animation, click THEME
    setTimeout(() => menuTheme?.click(), 180);
  }, 350);
}

/* ── Search: apply a theme directly by name ─────────────────────────────── */
function _searchApplyTheme(name) {
  if (typeof applyTheme === 'function') applyTheme(name);
  exec(`mkdir -p ${CFG_DIR} && echo "${name}" > ${THEME_FILE}`);
  showToast(`Theme: ${name.toUpperCase()}`, 'THEME', 'success', '🎨');
}

/* ═══════════════════════════════════════════════════════════
   § SWIPE GESTURES — Left/Right swipe on app lists switches tabs
   ═══════════════════════════════════════════════════════════ */
function initSwipeGestures() {
  // Map: list container ID → tab config
  const SWIPE_CONFIGS = [
    {
      listId: 'app-list-container',
      getTabs: () => [...document.querySelectorAll('.app-tab[data-tab]')].map(b => b.dataset.tab),
      getActive: () => _activeTab,
      setActive: (t) => { _activeTab = t; renderAppTab(t); document.querySelector(`.app-tab[data-tab="${t}"]`)?.click?.(); }
    },
    {
      listId: 'battsaver-app-list',
      getTabs: () => [...document.querySelectorAll('[data-bstab]')].map(b => b.dataset.bstab),
      getActive: () => _battSaverTab,
      setActive: (t) => { _battSaverTab = t; renderBattSaverList(); }
    },
    {
      listId: 'idle60-app-list',
      getTabs: () => [...document.querySelectorAll('[data-i60tab]')].map(b => b.dataset.i60tab),
      getActive: () => _idle60Tab,
      setActive: (t) => { _idle60Tab = t; renderIdle60List(); }
    },
    {
      listId: 'ko-app-list',
      getTabs: () => [...document.querySelectorAll('[data-kotab]')].map(b => b.dataset.kotab),
      getActive: () => _koActiveTab,
      setActive: (t) => { _koActiveTab = t; if (_koLoaded) renderKoList(); }
    },
    {
      listId: 'cl-app-list',
      getTabs: () => [...document.querySelectorAll('[data-cltab]')].map(b => b.dataset.cltab),
      getActive: () => _clActiveTab,
      setActive: (t) => { _clActiveTab = t; if (_clLoaded) renderClList(); }
    },
  ];

  SWIPE_CONFIGS.forEach(({ listId, getTabs, getActive, setActive }) => {
    // Use event delegation on document — lists may not exist yet
    let _sx = 0, _sy = 0, _stime = 0, _tracking = false;

    const getEl = () => document.getElementById(listId);

    document.addEventListener('touchstart', e => {
      const el = getEl();
      if (!el || !el.contains(e.target)) return;
      _sx = e.touches[0].clientX;
      _sy = e.touches[0].clientY;
      _stime = Date.now();
      _tracking = true;
    }, { passive: true });

    document.addEventListener('touchend', e => {
      if (!_tracking) return;
      const el = getEl();
      if (!el) { _tracking = false; return; }

      const dx = e.changedTouches[0].clientX - _sx;
      const dy = e.changedTouches[0].clientY - _sy;
      const dt = Date.now() - _stime;
      _tracking = false;

      // Must be: fast enough (<400ms), horizontal (|dx|>|dy|*1.5), far enough (|dx|>45px)
      if (dt > 400 || Math.abs(dx) < 45 || Math.abs(dx) < Math.abs(dy) * 1.5) return;

      const tabs = getTabs();
      if (!tabs.length) return;
      const cur = getActive();
      const idx = tabs.indexOf(cur);
      if (idx < 0) return;

      let next;
      if (dx < 0 && idx < tabs.length - 1) next = tabs[idx + 1]; // swipe left → next tab
      if (dx > 0 && idx > 0)               next = tabs[idx - 1]; // swipe right → prev tab
      if (!next) return;

      setActive(next);
      // Visual feedback: highlight the new tab button
      const tabBtn = document.querySelector(`[data-tab="${next}"], [data-bstab="${next}"], [data-i60tab="${next}"], [data-kotab="${next}"], [data-cltab="${next}"]`);
      if (tabBtn) {
        tabBtn.classList.add('app-tab--active');
        tabBtn.setAttribute('aria-selected', 'true');
      }
    }, { passive: true });
  });
}

/* ═══════════════════════════════════════════════════════════
   § FEATURES PANEL · Panel 11
   Toggle 1 — FRAME STABILITY   → feat_frame_stability flag
   Toggle 2 — ANTI-THROTTLE BOOST → feat_anti_throttle flag
   ═══════════════════════════════════════════════════════════ */
function initFeaturesPanel() {

  // ── helpers ────────────────────────────────────────────────
  const _syncBtn = (btn, label, on) => {
    if (!btn) return;
    btn.setAttribute('aria-pressed', String(on));
    btn.classList.toggle('gaming-toggle-btn--on', on);
    const thumb = btn.querySelector('.popup-toggle-thumb');
    if (thumb) thumb.style.transform = on ? 'translateX(16px)' : '';
    if (label) label.textContent = on ? 'ON' : 'OFF';
  };

  const _ribbon = (text, type='info') => {
    const r = document.getElementById('features-ribbon-text');
    const wrap = document.getElementById('features-ribbon');
    if (!r) return;
    r.textContent = text;
    if (wrap) {
      wrap.classList.remove('ribbon-success','ribbon-warn','ribbon-info');
      wrap.classList.add(`ribbon-${type}`);
    }
  };

  // ── FRAME STABILITY shell commands ────────────────────────
  const CMD_FRAME_ON = [
    // Core illusion method
    `resetprop debug.sf.frame_rate_multiple_threshold 120`,
    `resetprop debug.sf.use_phase_offsets_as_durations 0`,
    // Phase offsets
    `setprop debug.sf.early_phase_offset_ns 1500000`,
    `setprop debug.sf.early_app_phase_offset_ns 1500000`,
    `setprop debug.sf.early_gl_phase_offset_ns 3000000`,
    `setprop debug.sf.early_gl_app_phase_offset_ns 15000000`,
    `setprop debug.sf.high_fps_early_app_phase_offset_ns -4000000`,
    `setprop debug.sf.high_fps_late_app_phase_offset_ns 1000000`,
    `setprop debug.sf.high_fps_early_sf_phase_offset_ns -4000000`,
    `setprop debug.sf.high_fps_late_sf_phase_offset_ns 1000000`,
    `setprop debug.sf.enable_advanced_sf_phase_offset 1`,
    // MTK latch + backpressure
    `setprop vendor.debug.sf.latch_unsignaled 1`,
    `setprop debug.sf.latch_unsignaled 1`,
    `setprop debug.sf.auto_latch_unsignaled 1`,
    `setprop debug.sf.disable_backpressure 1`,
    `setprop debug.sf.enable_gl_backpressure 0`,
    `setprop debug.sf.disable_client_composition_cache 1`,
    `setprop debug.sf.enable_hwc_vds 1`,
    // Refresh rate timers (resetprop for ro.*)
    `resetprop ro.surface_flinger.set_touch_timer_ms 3000`,
    `resetprop ro.surface_flinger.set_idle_timer_ms 3000`,
    `resetprop ro.surface_flinger.set_display_power_timer_ms 1000`,
    `resetprop ro.surface_flinger.enable_frame_rate_override true`,
    // Display settings
    `settings put system peak_refresh_rate 120.0`,
    `settings put system min_refresh_rate 90.0`,
    // Renderer
    `setprop debug.renderengine.backend skiaglthreaded`,
    `setprop debug.hwui.renderer skiagl`,
    `setprop debug.hwui.fps_divisor 1`,
    `setprop debug.hwui.profile.maxframes 120`,
    // Persist flag
    `mkdir -p ${CFG_DIR} && touch "${FEAT_FRAME_FLAG}"`,
  ].join('; ');

  const CMD_FRAME_OFF = [
    `resetprop --delete debug.sf.frame_rate_multiple_threshold`,
    `resetprop --delete debug.sf.use_phase_offsets_as_durations`,
    `setprop debug.sf.early_phase_offset_ns 0`,
    `setprop debug.sf.early_app_phase_offset_ns 0`,
    `setprop debug.sf.early_gl_phase_offset_ns 0`,
    `setprop debug.sf.early_gl_app_phase_offset_ns 0`,
    `setprop debug.sf.high_fps_early_app_phase_offset_ns 0`,
    `setprop debug.sf.high_fps_late_app_phase_offset_ns 0`,
    `setprop debug.sf.high_fps_early_sf_phase_offset_ns 0`,
    `setprop debug.sf.high_fps_late_sf_phase_offset_ns 0`,
    `setprop debug.sf.enable_advanced_sf_phase_offset 0`,
    `setprop vendor.debug.sf.latch_unsignaled 0`,
    `setprop debug.sf.latch_unsignaled 0`,
    `setprop debug.sf.auto_latch_unsignaled 0`,
    `setprop debug.sf.disable_backpressure 0`,
    `setprop debug.sf.enable_gl_backpressure 1`,
    `setprop debug.sf.disable_client_composition_cache 0`,
    `settings put system min_refresh_rate 60.0`,
    `rm -f "${FEAT_FRAME_FLAG}"`,
  ].join('; ');

  // ── ANTI-THROTTLE shell commands ──────────────────────────
  const CMD_THROTTLE_ON = [
    // Powerhal DFS off
    `setprop vendor.powerhal.dfs.enable 0`,
    `setprop vendor.powerhal.init 0`,
    // CPU min freq floor — all policies
    `for pol in /sys/devices/system/cpu/cpufreq/policy*/scaling_min_freq; do echo 1200000 > "$pol" 2>/dev/null; done`,
    // GPU min freq floor (MTK Mali path)
    `for gf in /sys/class/devfreq/gpufreq/min_freq /sys/devices/platform/*/mali*/devfreq/*/min_freq; do echo 400000000 > "$gf" 2>/dev/null; done`,
    // FPSGO — predictable frame pacing
    `[ -f /sys/kernel/fpsgo/common/force_onoff ] && echo 1 > /sys/kernel/fpsgo/common/force_onoff`,
    `[ -f /sys/kernel/fpsgo/fbt/boost_ta ] && echo 0 > /sys/kernel/fpsgo/fbt/boost_ta`,
    // Mali GPU profiling overhead off
    `setprop debug.mali.force_profiling 0`,
    // HWUI CPU/GPU balance
    `setprop debug.hwui.target_cpu_time_percent 50`,
    // Persist flag
    `mkdir -p ${CFG_DIR} && touch "${FEAT_THROTTLE_FLAG}"`,
  ].join('; ');

  const CMD_THROTTLE_OFF = [
    `setprop vendor.powerhal.dfs.enable 1`,
    `setprop vendor.powerhal.init 1`,
    // Restore CPU min to 0 (let governor decide)
    `for pol in /sys/devices/system/cpu/cpufreq/policy*/scaling_min_freq; do echo 0 > "$pol" 2>/dev/null; done`,
    // Restore GPU min to 0
    `for gf in /sys/class/devfreq/gpufreq/min_freq /sys/devices/platform/*/mali*/devfreq/*/min_freq; do echo 0 > "$gf" 2>/dev/null; done`,
    // Re-enable FPSGO boost_ta
    `[ -f /sys/kernel/fpsgo/fbt/boost_ta ] && echo 1 > /sys/kernel/fpsgo/fbt/boost_ta`,
    `setprop debug.hwui.target_cpu_time_percent 33`,
    `rm -f "${FEAT_THROTTLE_FLAG}"`,
  ].join('; ');

  // ── Init: read saved state ─────────────────────────────────
  const btnFrame    = document.getElementById('feat-frame-toggle');
  const lblFrame    = document.getElementById('feat-frame-label');
  const btnThrottle = document.getElementById('feat-throttle-toggle');
  const lblThrottle = document.getElementById('feat-throttle-label');
  const warnEl      = document.getElementById('feat-throttle-warn');

  Promise.all([
    exec(`[ -f "${FEAT_FRAME_FLAG}" ] && echo 1 || echo 0`),
    exec(`[ -f "${FEAT_THROTTLE_FLAG}" ] && echo 1 || echo 0`),
  ]).then(([fr, th]) => {
    _syncBtn(btnFrame,    lblFrame,    fr.trim() === '1');
    _syncBtn(btnThrottle, lblThrottle, th.trim() === '1');
    if (warnEl) warnEl.style.display = th.trim() === '1' ? 'block' : 'none';
  });

  // ── Frame Stability toggle ─────────────────────────────────
  btnFrame?.addEventListener('click', async () => {
    const isOn = btnFrame.getAttribute('aria-pressed') === 'true';
    const next = !isOn;
    _syncBtn(btnFrame, lblFrame, next);
    showToast(next ? 'Applying Frame Stability tweaks…' : 'Reverting Frame Stability…', 'FEATURES', 'info', '🎯');
    await exec(next ? CMD_FRAME_ON : CMD_FRAME_OFF);
    _ribbon(
      next
        ? 'Frame Stability ON — SF illusion method active, jitter reduced'
        : 'Frame Stability OFF — SF defaults restored',
      next ? 'success' : 'info'
    );
    showToast(
      next ? 'Frame Stability applied ✓' : 'Frame Stability reverted',
      'FEATURES', next ? 'success' : 'warn', next ? '🎯' : '○'
    );
  }, { passive: true });

  // ── Anti-Throttle toggle ───────────────────────────────────
  btnThrottle?.addEventListener('click', async () => {
    const isOn = btnThrottle.getAttribute('aria-pressed') === 'true';
    const next = !isOn;
    _syncBtn(btnThrottle, lblThrottle, next);
    if (warnEl) warnEl.style.display = next ? 'block' : 'none';
    showToast(next ? 'Applying Anti-Throttle Boost…' : 'Reverting Anti-Throttle…', 'FEATURES', 'info', '🔥');
    await exec(next ? CMD_THROTTLE_ON : CMD_THROTTLE_OFF);
    _ribbon(
      next
        ? 'Anti-Throttle ON — CPU/GPU floor set, FPSGO tuned, powerhal DFS off'
        : 'Anti-Throttle OFF — thermal defaults restored',
      next ? 'success' : 'info'
    );
    showToast(
      next ? 'Anti-Throttle Boost applied ✓' : 'Anti-Throttle reverted',
      'FEATURES', next ? 'success' : 'warn', next ? '🔥' : '○'
    );
  }, { passive: true });
}

function initDeepSleep() {
  const btn   = document.getElementById('btn-deepsleep-toggle');
  const label = document.getElementById('deepsleep-toggle-label');

  const _sync = (on) => {
    if (!btn) return;
    btn.setAttribute('aria-pressed', String(on));
    btn.classList.toggle('gaming-toggle-btn--on', on);
    const thumb = btn.querySelector('.popup-toggle-thumb');
    if (thumb) thumb.style.transform = on ? 'translateX(16px)' : '';
    if (label) label.textContent = on ? 'ON' : 'OFF';
  };

  // Load saved state
  exec(`[ -f "${DEEP_SLEEP_FLAG}" ] && echo 1 || echo 0`).then(r => {
    _sync(r.trim() === '1');
  });

  btn?.addEventListener('click', async () => {
    const isOn = btn.getAttribute('aria-pressed') === 'true';
    const next = !isOn;
    _sync(next);
    if (next) {
      await exec(`mkdir -p ${CFG_DIR} && touch "${DEEP_SLEEP_FLAG}"`);
      showToast('Deep Sleep enabled · CPU will throttle on screen off', 'DEEP SLEEP', 'success', '😴');
    } else {
      await exec(`rm -f "${DEEP_SLEEP_FLAG}"`);
      // Restore any saved freq if still throttled
      await exec(`for p in /dev/.deepsleep_saved_policy*; do [ -f "$p" ] || continue; POLICY="/sys/devices/system/cpu/cpufreq/$(basename $p | sed 's/.deepsleep_saved_//g')"; [ -d "$POLICY" ] && chmod 644 "$POLICY/scaling_max_freq" 2>/dev/null && cat "$p" > "$POLICY/scaling_max_freq" 2>/dev/null && rm -f "$p"; done`);
      showToast('Deep Sleep disabled', 'DEEP SLEEP', 'info', '☀️');
    }
  }, { passive: true });
}

/* ═══════════════════════════════════════════════════════════
   § BATTERY SAVER (Panel 04 sub-panel)
   Enables device battery saver on app switch.
   Games and spared apps are excluded — they disable it.
   Flag: /sdcard/GovThermal/config/batt_saver_enabled
   Spare: /sdcard/DAVION_ENGINE/batt_saver_spare.txt
   ═══════════════════════════════════════════════════════════ */
const BATT_SAVER_FLAG  = `${CFG_DIR}/batt_saver_enabled`;
const BATT_SAVER_SPARE = `/sdcard/DAVION_ENGINE/batt_saver_spare.txt`;

let _battSaverEnabled = false;
let _battSaverSpareSet = new Set();
let _battSaverTab = 'user';
let _battSaverLoaded = false;

async function loadBattSaverPanel() {
  if (_battSaverLoaded) return;
  _battSaverLoaded = true;

  const [enabledRaw, spareRaw] = await Promise.all([
    exec(`[ -f "${BATT_SAVER_FLAG}" ] && echo 1 || echo 0`),
    exec(`cat ${BATT_SAVER_SPARE} 2>/dev/null`)
  ]);
  _battSaverEnabled = enabledRaw.trim() === '1';
  _battSaverSpareSet = new Set(spareRaw.trim().split('\n').filter(Boolean));
  _syncBattSaverToggle();
  renderBattSaverList();
}

function _syncBattSaverToggle() {
  const btn   = document.getElementById('btn-battsaver-toggle');
  const label = document.getElementById('battsaver-toggle-label');
  const block = document.getElementById('battsaver-list-block');
  if (btn) {
    btn.setAttribute('aria-pressed', String(_battSaverEnabled));
    btn.classList.toggle('gaming-toggle-btn--on', _battSaverEnabled);
    const thumb = btn.querySelector('.popup-toggle-thumb');
    if (thumb) thumb.style.transform = _battSaverEnabled ? 'translateX(16px)' : '';
  }
  if (label) label.textContent = _battSaverEnabled ? 'ON' : 'OFF';
  if (block) block.style.display = _battSaverEnabled ? '' : 'none';
}

function renderBattSaverList() {
  const list = document.getElementById('battsaver-app-list');
  if (!list) return;

  document.querySelectorAll('[data-bstab]').forEach(btn => {
    const active = btn.dataset.bstab === _battSaverTab;
    btn.classList.toggle('app-tab--active', active);
    btn.setAttribute('aria-selected', String(active));
  });

  const userCount   = document.getElementById('battsaver-count-user');
  const sysCount    = document.getElementById('battsaver-count-system');
  const sparedCount = document.getElementById('battsaver-count-spared');
  const userPool = _userPkgs.filter(p => !_isGame(p));
  const sysPool  = _systemPkgs.filter(p => !_isGame(p));
  if (userCount)   userCount.textContent   = userPool.filter(p => !_battSaverSpareSet.has(p)).length;
  if (sysCount)    sysCount.textContent    = sysPool.filter(p => !_battSaverSpareSet.has(p)).length;
  if (sparedCount) sparedCount.textContent = _battSaverSpareSet.size;

  const frag = document.createDocumentFragment();
  let pool = [];

  if (_battSaverTab === 'spared') {
    pool = _sortAZ([..._battSaverSpareSet]);
    if (!pool.length) {
      const s = document.createElement('span');
      s.className = 'list-placeholder mono';
      s.textContent = 'No spared apps yet';
      frag.appendChild(s);
    }
  } else if (_battSaverTab === 'system') {
    pool = _sortAZ(sysPool);
    if (!pool.length) {
      const s = document.createElement('span');
      s.className = 'list-placeholder mono';
      s.textContent = 'No system apps found';
      frag.appendChild(s);
    }
  } else {
    pool = _sortAZ(userPool);
    if (!pool.length) {
      const s = document.createElement('span');
      s.className = 'list-placeholder mono';
      s.textContent = 'No apps found';
      frag.appendChild(s);
    }
  }

  pool.forEach(pkg => frag.appendChild(_buildBattSaverRow(pkg)));
  _animList(list);
  list.replaceChildren(frag);
  loadVisibleIcons('battsaver-app-list');
}

function _buildBattSaverRow(pkg) {
  const isSpared = _battSaverSpareSet.has(pkg);
  const name = getAppLabel(pkg);
  const row = document.createElement('div');
  row.className = 'list-item' + (isSpared ? ' app-row-configured' : '');
  row.innerHTML = `
    <div class="item-row">
      <div class="app-icon-wrap" data-pkg="${pkg}">
        <img class="app-icon" alt="${name}" src="ksu://icon/${pkg}" onerror="this.style.opacity='0.15'">
      </div>
      <div class="item-info">
        <span class="item-title">${name}</span>
        <span class="item-desc mono">${pkg}</span>
      </div>
      <button class="nexus-btn${isSpared ? ' nexus-btn--active' : ''}"
        style="flex-shrink:0;padding:4px 10px;font-size:9px;min-width:56px;"
        data-bsspare="${pkg}">
        ${isSpared ? '🛡 SPARED' : 'SPARE'}
      </button>
    </div>`;

  row.querySelector('[data-bsspare]')?.addEventListener('click', async () => {
    const nowSpared = !_battSaverSpareSet.has(pkg);
    if (!nowSpared) {
      _battSaverSpareSet.delete(pkg);
      // Unspared — restore battery saver immediately if enabled
      if (_battSaverEnabled) {
        await exec(`settings put global low_power 1 2>/dev/null`);
      }
      showToast(`Battery Saver applies to ${getAppLabel(pkg)}`, 'BATT SAVER', 'info', '🔋');
    } else {
      _battSaverSpareSet.add(pkg);
      // Spared — check if this is the currently running app, disable saver immediately
      await exec(`FG=$(cat /dev/.davion_last_fg_pkg 2>/dev/null); [ "$FG" = "${pkg}" ] && settings put global low_power 0 2>/dev/null || true`);
      showToast(`${getAppLabel(pkg)} spared from Battery Saver`, 'BATT SAVER', 'success', '🛡');
    }
    const pkgs = [..._battSaverSpareSet];
    const cmds = pkgs.length
      ? pkgs.map(p => `echo ${JSON.stringify(p)}`).join(' && ')
      : 'true';
    await exec(`mkdir -p /sdcard/DAVION_ENGINE && { ${cmds}; } > ${BATT_SAVER_SPARE}`);
    renderBattSaverList();
  });
  return row;
}

function initBattSaver() {
  // Lazy load on subpanel open
  const det = document.querySelector('#idle-60hz-section .panel-details');
  det?.addEventListener('toggle', () => {
    if (det.open && _battSaverEnabled) renderBattSaverList();
  });

  document.getElementById('btn-battsaver-toggle')?.addEventListener('click', async () => {
    if (!_battSaverLoaded) await loadBattSaverPanel();
    _battSaverEnabled = !_battSaverEnabled;
    _syncBattSaverToggle();
    if (_battSaverEnabled) {
      await exec(`mkdir -p ${CFG_DIR} && touch "${BATT_SAVER_FLAG}"`);
      renderBattSaverList();
      showToast('Battery Saver enabled · Games and spared apps excluded', 'BATT SAVER', 'success', '🔋');
    } else {
      await exec(`rm -f "${BATT_SAVER_FLAG}"`);
      await exec(`settings put global low_power 0 2>/dev/null`);
      showToast('Battery Saver disabled', 'BATT SAVER', 'info', '🔋');
    }
  }, { passive: true });

  document.addEventListener('click', e => {
    const tab = e.target.closest('[data-bstab]');
    if (!tab) return;
    _battSaverTab = tab.dataset.bstab;
    renderBattSaverList();
  });

  // Load state on init
  exec(`[ -f "${BATT_SAVER_FLAG}" ] && echo 1 || echo 0`).then(r => {
    _battSaverEnabled = r.trim() === '1';
    _syncBattSaverToggle();
    if (_battSaverEnabled) loadBattSaverPanel();
  });
}

let _koPkgs      = [];    // all installed packages
let _koState     = {};    // { pkg: { on: bool, bl: Set<string> } }
let _koQuery     = '';
let _koLoaded    = false;
let _koActiveTab = 'user';

/* ── Load all data from disk ─────────────────────────────── */
async function loadKillOthersPanel() {
  const list = document.getElementById('ko-app-list');
  if (!list) return;
  list.innerHTML = '<span class="list-placeholder mono">Loading…</span>';

  // Use only user packages for KO panel (system tab removed)
  const userPkgs = _userPkgs.length
    ? _userPkgs
    : (await exec(`pm list packages -3 | cut -d: -f2 | sort`)).trim().split('\n').filter(Boolean);

  const [koFilesRaw] = await Promise.all([
    exec(`find ${RR_DIR} -maxdepth 1 -name '*.killothers' 2>/dev/null | while read f; do basename "$f" .killothers; done`)
  ]);

  _koPkgs = userPkgs;
  const koPkgs = koFilesRaw.trim().split('\n').filter(Boolean);

  _koState = {};
  _koPkgs.forEach(p => { _koState[p] = { on: false, bl: new Set() }; });

  if (koPkgs.length > 0) {
    const blResults = await Promise.all(
      koPkgs.map(pkg => exec(`cat ${RR_DIR}/${pkg}.killothers_bl 2>/dev/null`))
    );
    koPkgs.forEach((pkg, i) => {
      if (!_koState[pkg]) _koState[pkg] = { on: false, bl: new Set() };
      _koState[pkg].on = true;
      _koState[pkg].bl = new Set(blResults[i].trim().split('\n').filter(Boolean));
    });
  }

  _koLoaded = true;
  _updateKoMetrics();
  renderKoList();
}

/* ── Metrics + ribbon ────────────────────────────────────── */
function _updateKoMetrics() {
  // Mirror exact render pools from renderKoList
  const cfgPkgs   = _koPkgs.filter(p => _koState[p]?.on && !_isGame(p));
  const userUncfg = _userPkgs.filter(p => !_koState[p]?.on && !_isGame(p));

  const s = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  s('ko-count-user', userUncfg.length);
  s('ko-count-cfg',  cfgPkgs.length);

  const ribbon = document.getElementById('ko-ribbon');
  const txt    = document.getElementById('ko-ribbon-text');
  const total  = cfgPkgs.length;
  if (txt) txt.textContent = total > 0
    ? `${total} app${total !== 1 ? 's' : ''} configured — kills background apps on launch`
    : 'Force-stop background apps when selected apps launch';
  if (ribbon) ribbon.classList.toggle('ribbon-danger', total > 0);
}


function _koFriendlyName(pkg) {
  return getAppLabel(pkg);
}

/* ── Render the full app list ────────────────────────────── */
function renderKoList() {
  const list = document.getElementById('ko-app-list');
  if (!list) return;

  const q = _koQuery.toLowerCase().trim();

  // Default to 'user' if somehow set to a removed tab
  if (_koActiveTab !== 'user' && _koActiveTab !== 'configured') _koActiveTab = 'user';

  let pool;
  if (_koActiveTab === 'configured') {
    pool = _sortAZ(_koPkgs.filter(p => _koState[p]?.on && !_isGame(p)));
  } else {
    // USER tab — only show non-game unconfigured apps
    pool = _sortAZ(_userPkgs.filter(p => !_koState[p]?.on && !_isGame(p)));
  }

  const filtered = pool.filter(p =>
    !q || p.toLowerCase().includes(q) || _koFriendlyName(p).toLowerCase().includes(q)
  );

  // Update tab active states
  document.querySelectorAll('[data-kotab]').forEach(btn => {
    const active = btn.dataset.kotab === _koActiveTab;
    btn.classList.toggle('app-tab--active', active);
    btn.setAttribute('aria-selected', active ? 'true' : 'false');
  });

  if (!filtered.length) {
    list.innerHTML = `<span class="list-placeholder mono">${q ? 'No apps match' : 'No apps found'}</span>`;
    return;
  }

  const frag = document.createDocumentFragment();

  if (_koActiveTab === 'configured') {
    // CFG tab — show enabled apps with red divider
    const hdr = document.createElement('div');
    hdr.className = 'list-divider';
    hdr.style.cssText = 'pointer-events:none;cursor:default;border-left:3px solid #ff7f8a;background:rgba(255,71,87,0.06);';
    hdr.innerHTML = `<span class="divider-text mono" style="color:#ff7f8a;">KILL OTHERS ENABLED (${filtered.length})</span>`;
    frag.appendChild(hdr);
    filtered.forEach(p => frag.appendChild(_buildKoRow(p)));
  } else {
    // USER tab — only unconfigured apps shown here
    if (filtered.length) {
      const hdr2 = document.createElement('div');
      hdr2.className = 'list-divider';
      hdr2.style.cssText = 'pointer-events:none;cursor:default;';
      hdr2.innerHTML = `<span class="divider-text mono">USER APPS (${filtered.length})</span>`;
      frag.appendChild(hdr2);
      _sortAZ(filtered).forEach(p => frag.appendChild(_buildKoRow(p)));
    }
  }

  list.innerHTML = '';
  list.appendChild(frag);
  loadVisibleIcons('ko-app-list');
}


function _koMakeDivider(label) {
  const el = document.createElement('div');
  el.className = 'list-divider';
  el.style.cssText = 'pointer-events:none;cursor:default;';
  el.innerHTML = `<span class="divider-text mono">${label}</span>`;
  return el;
}

/* ── Build one app row ───────────────────────────────────── */
function _buildKoRow(pkg) {
  const state = _koState[pkg] || { on: false, bl: new Set() };
  const name  = _koFriendlyName(pkg);
  const isOn  = state.on;

  const row = document.createElement('div');
  row.className   = 'list-item' + (isOn ? ' list-item--ko-on' : '');
  row.dataset.pkg = pkg;

  const gearSvg = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.8"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

  const spareBadge = isOn && state.bl.size > 0 ? `<span style="font-size:8px;color:var(--a);font-family:var(--mono);margin-right:4px;">🛡${state.bl.size}</span>` : '';
  const koBadge    = isOn ? `<span class="rr-configured-badge mono" style="background:rgba(255,71,87,0.12);border-color:rgba(255,71,87,0.35);color:#ff7f8a;">ON</span>` : '';

  row.innerHTML = `
    <div class="item-row">
      <div class="app-icon-wrap" data-pkg="${pkg}">
        <img class="app-icon" alt="${name}">
      </div>
      <div class="item-info">
        <span class="item-title">${name}</span>
        <span class="item-desc mono">${pkg}</span>
      </div>
    </div>
    <div class="btn-row">
      ${koBadge}${spareBadge}
      <button class="app-gear-btn" data-kogear="${pkg}" aria-label="Configure ${pkg}"
        style="width:32px;height:32px;border-radius:50%;background:rgba(0,0,0,0.35);border:1px solid var(--bdr);display:flex;align-items:center;justify-content:center;cursor:pointer;color:var(--a);flex-shrink:0;">
        ${gearSvg}
      </button>
    </div>`;

  // Icon — use setIconSrc for ksu→apatch→fallback chain
  const img = row.querySelector('.app-icon');
  if (img) setIconSrc(img, pkg);

  return row;
}


/* ── Toggle kill-others for a single app ────────────────── */
async function _koToggle(pkg, row) {
  const state = _koState[pkg];
  const nowOn = !state.on;
  state.on = nowOn;

  if (row) {
    row.classList.toggle('ko-app-row--on', nowOn);
    const btn   = row.querySelector('.ko-toggle-btn');
    const label = btn?.querySelector('.gaming-toggle-label');
    btn?.setAttribute('aria-pressed', String(nowOn));
    btn?.classList.toggle('gaming-toggle-btn--on', nowOn);
    if (label) label.textContent = nowOn ? 'ON' : 'OFF';
  }

  const spareSection = row?.querySelector('.ko-spare-section');

  if (nowOn) {
    await exec(`mkdir -p ${RR_DIR} && echo '1' > ${RR_DIR}/${pkg}.killothers`);
    spareSection?.classList.add('ko-spare-section--visible');
    _koRenderSpare(pkg, row);
    configuredPkgs.add(pkg);
    showToast(`Kill Others ON — ${_koFriendlyName(pkg)}`, 'KILL OTHERS', 'warn', '⏹');
    setStatus(`⏹ ${_koFriendlyName(pkg)} will kill background apps on launch`);
  } else {
    state.bl = new Set();
    await exec(`rm -f ${RR_DIR}/${pkg}.killothers ${RR_DIR}/${pkg}.killothers_bl`);
    spareSection?.classList.remove('ko-spare-section--visible');
    const badge = document.getElementById(`ko-badge-${pkg.replace(/\./g,'_')}`);
    if (badge) badge.textContent = '';
    // Remove from configuredPkgs only if no other per-app settings exist
    const hasOther = (await exec(
      `find ${RR_DIR} -maxdepth 1 \\( -name "${pkg}.mode" -o -name "${pkg}.bright" -o -name "${pkg}.vol" -o -name "${pkg}.conn" \\) 2>/dev/null | head -1`
    )).trim();
    // Also keep in configuredPkgs if encore tweaks are enabled for this app
    const hasEncore = encorePkgs.has(pkg);
    if (!hasOther && !hasEncore) configuredPkgs.delete(pkg);
    showToast(`Kill Others OFF — ${_koFriendlyName(pkg)}`, 'KILL OTHERS', 'info', '○');
    setStatus(`${_koFriendlyName(pkg)}: Kill Others disabled`);
  }

  _updateKoMetrics();
  _updateTabCounts();
}

/* ── Render the spare-from-kill picker for one app ──────── */
function _koRenderSpare(pkg, row) {
  const wrapperId = `ko-spare-${pkg.replace(/\./g,'_')}`;
  const wrapper   = document.getElementById(wrapperId);
  if (!wrapper) return;

  const state  = _koState[pkg];
  const others = _koPkgs.filter(p => p !== pkg);

  if (!others.length) {
    wrapper.innerHTML = '<span class="list-placeholder mono" style="font-size:10px;">No other apps found</span>';
    return;
  }

  const searchId = `ko-ss-${pkg.replace(/\./g,'_')}`;

  wrapper.innerHTML = `
    <div class="ko-spare-header">
      <span class="mono ko-spare-title">🛡 SPARE FROM KILL</span>
      <span class="mono ko-spare-count" id="ko-sc-${pkg.replace(/\./g,'_')}">${state.bl.size} spared</span>
    </div>
    <div class="ko-spare-search-row">
      <span class="mono" style="font-size:10px;opacity:0.35;flex-shrink:0;">⌕</span>
      <input id="${searchId}" class="popup-bl-search-input"
        type="text" placeholder="Filter apps…" autocomplete="off" spellcheck="false"
        style="flex:1;background:transparent;border:none;color:var(--text);font-family:var(--mono);font-size:10px;outline:none;padding:0 4px;">
      <button class="popup-bl-search-clear" id="${searchId}-clr" hidden>✕</button>
    </div>
    <div class="ko-spare-list" id="${wrapperId}-list"></div>`;

  const listEl = document.getElementById(`${wrapperId}-list`);

  const renderItems = (q = '') => {
    const spared     = others.filter(p =>  state.bl.has(p) && (!q || p.toLowerCase().includes(q) || _koFriendlyName(p).toLowerCase().includes(q)));
    const willKill   = others.filter(p => !state.bl.has(p) && (!q || p.toLowerCase().includes(q) || _koFriendlyName(p).toLowerCase().includes(q)));

    const frag = document.createDocumentFragment();

    if (spared.length) {
      const sh = document.createElement('div');
      sh.className = 'ko-spare-section-hdr ko-spare-section-hdr--spared';
      sh.innerHTML = `<span class="mono">🛡 SPARED (${spared.length})</span>`;
      frag.appendChild(sh);
      _sortAZ(spared).forEach(p => frag.appendChild(_koSpareItem(p, pkg, state, row, renderItems)));
    }

    if (spared.length && willKill.length) {
      const div = document.createElement('div');
      div.className = 'ko-spare-kill-divider';
      div.innerHTML = '<span class="mono ko-spare-kill-label">— WILL BE KILLED —</span>';
      frag.appendChild(div);
    } else if (!spared.length && willKill.length) {
      const sh = document.createElement('div');
      sh.className = 'ko-spare-section-hdr ko-spare-section-hdr--kill';
      sh.innerHTML = `<span class="mono">⏹ WILL BE KILLED (${willKill.length})</span>`;
      frag.appendChild(sh);
    }
    _sortAZ(willKill).forEach(p => frag.appendChild(_koSpareItem(p, pkg, state, row, renderItems)));

    if (!spared.length && !willKill.length) {
      const empty = document.createElement('span');
      empty.className = 'list-placeholder mono';
      empty.style.fontSize = '10px';
      empty.textContent = 'No apps found';
      frag.appendChild(empty);
    }

    listEl.innerHTML = '';
    listEl.appendChild(frag);
  };

  // Wire search
  const si = document.getElementById(searchId);
  const sc = document.getElementById(`${searchId}-clr`);
  si?.addEventListener('input', () => {
    const q = si.value.trim().toLowerCase();
    if (sc) sc.hidden = !q;
    renderItems(q);
  });
  sc?.addEventListener('click', () => {
    if (si) si.value = '';
    if (sc) sc.hidden = true;
    renderItems('');
  });

  renderItems('');
}

function _koSpareItem(p, pkg, state, row, renderItems) {
  const isSpared = state.bl.has(p);
  const item = document.createElement('div');
  item.className = 'ko-spare-item' + (isSpared ? ' ko-spare-item--spared' : '');
  item.innerHTML = `
    <div class="ko-spare-check-box">${isSpared ? '✓' : ''}</div>
    <span class="ko-spare-item-name">${_koFriendlyName(p)}</span>
    <span class="ko-spare-item-pkg mono">${p}</span>`;

  item.addEventListener('click', async () => {
    if (state.bl.has(p)) state.bl.delete(p);
    else state.bl.add(p);

    // Persist immediately
    if (state.bl.size > 0) {
      const args = [...state.bl].map(x => `'${x}'`).join(' ');
      exec(`mkdir -p ${RR_DIR} && printf '%s\n' ${args} > ${RR_DIR}/${pkg}.killothers_bl`);
    } else {
      exec(`rm -f ${RR_DIR}/${pkg}.killothers_bl`);
    }

    // Update badges
    const badge = document.getElementById(`ko-badge-${pkg.replace(/\./g,'_')}`);
    if (badge) badge.textContent = state.bl.size > 0 ? `🛡${state.bl.size}` : '';
    const countEl = document.getElementById(`ko-sc-${pkg.replace(/\./g,'_')}`);
    if (countEl) countEl.textContent = `${state.bl.size} spared`;
    _updateKoMetrics();

    // Re-render list with current search query
    const si = document.getElementById(`ko-ss-${pkg.replace(/\./g,'_')}`);
    renderItems((si?.value || '').trim().toLowerCase());
  });

  return item;
}

/* ── Init ────────────────────────────────────────────────── */
function initKillOthersPanel() {
  // Tab clicks
  document.addEventListener('click', e => {
    const tab = e.target.closest('[data-kotab]');
    if (!tab) return;
    _koActiveTab = tab.dataset.kotab;
    if (_koLoaded) renderKoList();
  });

  // Gear click → open full Ko config popup
  document.addEventListener('click', e => {
    const gear = e.target.closest('[data-kogear]');
    if (!gear) return;
    e.stopPropagation();
    const pkg = gear.dataset.kogear;
    _openKoConfig(pkg, gear, false);
  });

  // Lazy-load on first open
  const det = document.getElementById('kill-others-section')?.querySelector('.panel-details');
  det?.addEventListener('toggle', () => {
    if (det.open && !_koLoaded) loadKillOthersPanel();
  });

  _initKoPopup();
}

/* ── Ko spare popup ─────────────────────────────────────── */
let _koPopupPkg      = null;
let _koPopupQ        = '';
let _koPopupGameOnly = false;   // true → spare list shows only detected games

async function _openKoConfig(pkg, gearElement, gameOnly = false) {
  if (!_koState[pkg]) _koState[pkg] = { on: false, bl: new Set() };
  _koPopupPkg      = pkg;
  _koPopupQ        = '';
  _koPopupGameOnly = gameOnly;
  _koPopupActiveTab = 'all';  // always start on ALL tab

  const popup    = document.getElementById('ko-spare-popup');
  const bubble   = popup?.querySelector('.app-config-bubble');
  const pkgEl    = document.getElementById('ko-popup-pkg');
  const toggle   = document.getElementById('ko-popup-toggle');
  const label    = document.getElementById('ko-popup-toggle-label');
  const searchEl = document.getElementById('ko-popup-search');
  const clearEl  = document.getElementById('ko-popup-search-clear');

  if (pkgEl)  pkgEl.textContent = pkg;
  if (searchEl) { searchEl.value = ''; }
  if (clearEl) clearEl.hidden = true;

  // Update header title and search placeholder based on mode
  const titleEl = document.getElementById('ko-popup-title');
  if (titleEl) titleEl.textContent = gameOnly ? 'GAMES — SPARE FROM KILL' : 'SPARE FROM KILL';
  if (searchEl) searchEl.placeholder = gameOnly ? 'Filter games…' : 'Filter apps…';

  // Position bubble centered on page
  if (bubble) {
    bubble.style.left = '50%';
    bubble.style.top = '50%';
    bubble.style.right = 'auto';
    bubble.style.transform = 'translate(-50%, -50%)';
  }

  _koPopupSyncToggle();
  _koPopupRenderList('');

  if (popup) {
    // Remove inline display:none and show via bubble-open class
    popup.style.removeProperty('display');
    popup.classList.add('bubble-open');
    popup.classList.add('bubble-full-page');
  }
}

function _koPopupSyncToggle() {
  const state  = _koState[_koPopupPkg];
  const isOn   = state?.on ?? false;
  const toggle = document.getElementById('ko-popup-toggle');
  const label  = document.getElementById('ko-popup-toggle-label');
  const count  = document.getElementById('ko-popup-spared-count');
  const list   = document.getElementById('ko-popup-list');

  toggle?.setAttribute('aria-pressed', String(isOn));
  toggle?.classList.toggle('gaming-toggle-btn--on', isOn);
  if (label) label.textContent = isOn ? 'ON' : 'OFF';
  if (count) count.textContent = `${state?.bl?.size ?? 0} apps spared`;

  // Show/hide the spare list based on toggle state
  if (list) list.style.opacity = isOn ? '1' : '0.35';
  const search = document.getElementById('ko-popup-search');
  const searchWrap = search?.closest('.search-wrap');
  if (searchWrap) searchWrap.style.opacity = isOn ? '1' : '0.35';
}

let _koPopupActiveTab = 'all';  // 'spared' | 'all'

function _koPopupRenderList(q) {
  const list  = document.getElementById('ko-popup-list');
  const state = _koState[_koPopupPkg];
  if (!list || !state) return;

  const userOnly = _userPkgs.length
    ? _userPkgs
    : _koPkgs.filter(p => !p.startsWith('com.android.') && !p.startsWith('com.google.android.')
        && !p.startsWith('android.') && !p.startsWith('com.mediatek.')
        && !p.startsWith('com.transsion.') && !p.startsWith('com.tecno.'));

  const pool = (userOnly.length ? userOnly : _glPkgs).filter(p => p !== _koPopupPkg);

  const lq = q.toLowerCase().trim();
  const filtered = pool.filter(p =>
    !lq || p.toLowerCase().includes(lq) || _koFriendlyName(p).toLowerCase().includes(lq)
  );

  // Update tab counts
  const sparedAll = pool.filter(p => state.bl.has(p));
  const sparedCount = document.getElementById('ko-popup-count-spared');
  const allCount    = document.getElementById('ko-popup-count-all');
  if (sparedCount) sparedCount.textContent = sparedAll.length;
  if (allCount)    allCount.textContent    = pool.filter(p => !state.bl.has(p)).length;

  // Update tab active state
  document.querySelectorAll('[data-koptab]').forEach(btn => {
    const active = btn.dataset.koptab === _koPopupActiveTab;
    btn.classList.toggle('app-tab--active', active);
    btn.setAttribute('aria-selected', String(active));
  });

  // Filter by active tab
  let display;
  if (_koPopupActiveTab === 'spared') {
    display = filtered.filter(p => state.bl.has(p));
  } else {
    // ALL tab: only show non-spared apps
    display = filtered.filter(p => !state.bl.has(p));
  }

  if (!display.length) {
    list.innerHTML = `<span class="list-placeholder mono">${
      _koPopupActiveTab === 'spared' ? 'No apps spared yet' : (lq ? 'No apps match' : 'No apps found')
    }</span>`;
    return;
  }

  const frag = document.createDocumentFragment();
  _sortAZ(display).forEach(p => frag.appendChild(_koPopupSpareRow(p)));

  list.innerHTML = '';
  list.appendChild(frag);
  loadVisibleIcons('ko-popup-list');
}

function _koPopupSpareRow(p) {
  const state   = _koState[_koPopupPkg];
  const isSpared = state.bl.has(p);
  const name    = _koFriendlyName(p);

  const row = document.createElement('div');
  row.className = 'list-item ko-popup-spare-row' + (isSpared ? ' ko-popup-spare-row--spared' : '');
  row.style.cursor = 'pointer';
  row.innerHTML = `
    <div class="item-row">
      <div class="app-icon-wrap" data-pkg="${p}">
        <img class="app-icon" alt="${name}">
      </div>
      <div class="item-info">
        <span class="item-title">${name}</span>
        <span class="item-desc mono">${p}</span>
      </div>
    </div>
    <div class="btn-row">
      <div class="ko-spare-check-box" style="width:20px;height:20px;border-radius:6px;border:1.5px solid ${isSpared ? 'var(--a)' : 'rgba(255,255,255,0.2)'};background:${isSpared ? 'var(--a)' : 'transparent'};display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all 0.15s;">
        ${isSpared ? '<span style="color:#000;font-size:11px;font-weight:700;line-height:1;">✓</span>' : ''}
      </div>
    </div>`;

  // Icon — use setIconSrc for ksu→apatch→fallback chain
  const img = row.querySelector('.app-icon');
  if (img) setIconSrc(img, p);

  row.addEventListener('click', async () => {
    if (!_koState[_koPopupPkg]?.on) return; // can't spare if KO is off
    if (state.bl.has(p)) state.bl.delete(p);
    else state.bl.add(p);

    // Persist
    if (state.bl.size > 0) {
      const args = [...state.bl].map(x => `'${x}'`).join(' ');
      exec(`mkdir -p ${RR_DIR} && printf '%s\n' ${args} > ${RR_DIR}/${_koPopupPkg}.killothers_bl`);
    } else {
      exec(`rm -f ${RR_DIR}/${_koPopupPkg}.killothers_bl`);
    }

    _koPopupSyncToggle();
    _koPopupRenderList(_koPopupQ);
    _updateKoMetrics();
  });

  return row;
}

function _closeKoPopup() {
  const popup = document.getElementById('ko-spare-popup');
  if (popup) {
    popup.classList.remove('bubble-open');
    popup.classList.remove('bubble-full-page');
    // Close immediately so user gets instant feedback
    popup.style.display = 'none';
  }
  if (_koPopupPkg) {
    const state = _koState[_koPopupPkg];
    const appName = typeof _koFriendlyName === 'function' ? _koFriendlyName(_koPopupPkg) : _koPopupPkg;
    if (state?.on) {
      const spareCount = state.bl?.size ?? 0;
      showToast(
        spareCount > 0 ? `Kill Others ON · ${spareCount} spared` : 'Kill Others ON · no exceptions',
        appName.toUpperCase(), 'warn', '⏹'
      );
    }
  }
  _koPopupPkg = null;
  renderKoList();
}

function _initKoPopup() {
  const popup    = document.getElementById('ko-spare-popup');
  const closeBtn = document.getElementById('ko-popup-close');
  const doneBtn  = document.getElementById('ko-popup-done');
  const toggle   = document.getElementById('ko-popup-toggle');
  const searchEl = document.getElementById('ko-popup-search');
  const clearEl  = document.getElementById('ko-popup-search-clear');

  popup?.addEventListener('click', e => {
    if (e.target === popup) _closeKoPopup();
  });
  closeBtn?.addEventListener('click', _closeKoPopup);
  doneBtn?.addEventListener('click', _closeKoPopup);

  toggle?.addEventListener('click', async () => {
    if (!_koPopupPkg) return;
    if (!_koState[_koPopupPkg]) _koState[_koPopupPkg] = { on: false, bl: new Set() };
    const state = _koState[_koPopupPkg];
    state.on = !state.on;

    if (state.on) {
      await exec(`mkdir -p ${RR_DIR} && echo '1' > ${RR_DIR}/${_koPopupPkg}.killothers`);
      showToast(`Kill Others ON — ${_koFriendlyName(_koPopupPkg)}`, 'KILL OTHERS', 'warn', '⏹');
    } else {
      state.bl = new Set();
      await exec(`rm -f ${RR_DIR}/${_koPopupPkg}.killothers ${RR_DIR}/${_koPopupPkg}.killothers_bl`);
      showToast(`Kill Others OFF — ${_koFriendlyName(_koPopupPkg)}`, 'KILL OTHERS', 'info', '○');
    }

    _koPopupSyncToggle();
    _koPopupRenderList(_koPopupQ);
    _updateKoMetrics();
  });

  searchEl?.addEventListener('input', () => {
    _koPopupQ = searchEl.value.trim();
    if (clearEl) clearEl.hidden = !_koPopupQ;
    _koPopupRenderList(_koPopupQ);
  });
  clearEl?.addEventListener('click', () => {
    if (searchEl) searchEl.value = '';
    _koPopupQ = '';
    clearEl.hidden = true;
    _koPopupRenderList('');
  });

  // Tab clicks — SPARED / ALL
  document.getElementById('ko-popup-tab-spared')?.addEventListener('click', () => {
    _koPopupActiveTab = 'spared';
    _koPopupRenderList(_koPopupQ);
  });
  document.getElementById('ko-popup-tab-all')?.addEventListener('click', () => {
    _koPopupActiveTab = 'all';
    _koPopupRenderList(_koPopupQ);
  });
}

/* ═══════════════════════════════════════════════════════════
   § 15  Battery · Charging Control Panel
   ═══════════════════════════════════════════════════════════ */

const BATT_PATH = '/sys/class/power_supply/battery';
const BATT_HISTORY = [];
const BATT_HISTORY_MAX = 40;
let _battTimer = null;
let flashChargeRunning = false;
const FLASH_CHARGE_SCRIPT = `${MOD}/DAVION_ENGINE/AI_MODE/global_mode/flash_charge`;
const CHARGE_LIMIT_FILE   = '/sdcard/GovThermal/config/charge_limit.txt';

/* ── Read live battery data ────────────────────────────────── */
async function readBatteryState() {
  const [lvl, stat, volt, curr, temp, health, tech, cycles, capNow, capFull, curNow] = await execAll(
    `cat ${BATT_PATH}/capacity 2>/dev/null`,
    `cat ${BATT_PATH}/status 2>/dev/null`,
    `cat ${BATT_PATH}/voltage_now 2>/dev/null`,
    `cat ${BATT_PATH}/current_now 2>/dev/null || cat ${BATT_PATH}/current_avg 2>/dev/null`,
    `cat ${BATT_PATH}/temp 2>/dev/null`,
    `cat ${BATT_PATH}/health 2>/dev/null`,
    `cat ${BATT_PATH}/technology 2>/dev/null`,
    `cat ${BATT_PATH}/cycle_count 2>/dev/null`,
    `cat ${BATT_PATH}/charge_now 2>/dev/null || cat ${BATT_PATH}/capacity_level 2>/dev/null`,
    `cat ${BATT_PATH}/charge_full 2>/dev/null`,
    `cat ${BATT_PATH}/current_now 2>/dev/null`
  );

  const pct      = parseInt(lvl.trim())     || 0;
  const status   = stat.trim()              || '—';
  const voltV    = parseInt(volt.trim());
  const currUA   = parseInt(curr.trim());
  const tempRaw  = parseInt(temp.trim());
  const tempC    = isNaN(tempRaw) ? NaN : tempRaw / 10;
  const isCharging = /charging/i.test(status);
  const isFull     = /full/i.test(status);

  /* ── Update SVG icon ─────────────────────────────────────── */
  const fillRect = document.getElementById('batt-fill-rect');
  const boltText = document.getElementById('batt-bolt');
  const svg      = document.getElementById('batt-svg-icon');
  const pctLabel = document.getElementById('batt-pct-label');

  if (fillRect) {
    // Inner width max = 43px (3px to 46px), x stays at 3
    const fillW = Math.max(0, Math.min(43, (pct / 100) * 43));
    fillRect.setAttribute('width', fillW.toFixed(1));
  }
  if (boltText) boltText.setAttribute('display', isCharging ? 'block' : 'none');

  // Color by state
  const svgClass = isCharging ? 'batt-charge'
                 : pct <= 15   ? 'batt-hot'
                 : pct <= 30   ? 'batt-warn'
                 : '';
  if (svg) svg.className.baseVal = 'batt-svg ' + svgClass;
  if (pctLabel) {
    pctLabel.textContent = pct + '%';
    pctLabel.style.color = isCharging ? '#60cfff'
                         : pct <= 15  ? '#ff4466'
                         : pct <= 30  ? '#ffcc00'
                         : 'var(--a)';
  }

  /* ── Update stat cells ───────────────────────────────────── */
  const setVal = (id, text, cls) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = text;
    el.className = 'batt-stat-val mono ' + (cls || 'batt-ok');
  };

  // Status label color
  const statCls = isCharging ? 'batt-blue' : isFull ? 'batt-ok' : 'batt-ok';
  setVal('batt-status-val', status.toUpperCase(), statCls);

  // Voltage
  if (!isNaN(voltV) && voltV > 0) {
    setVal('batt-voltage-val', (voltV / 1000000).toFixed(3) + ' V');
  }

  // Current (µA → mA, negative = discharging on some kernels)
  if (!isNaN(currUA)) {
    const mA = Math.abs(currUA / 1000);
    const dir = isCharging ? '+' : '−';
    const cls2 = mA > 3000 ? 'batt-blue' : mA > 1500 ? 'batt-ok' : '';
    setVal('batt-current-val', dir + mA.toFixed(0) + ' mA', cls2);
  }

  // Temp
  if (!isNaN(tempC)) {
    const tCls = tempC > 45 ? 'batt-hot' : tempC > 38 ? 'batt-warn' : 'batt-ok';
    setVal('batt-temp-val', tempC.toFixed(1) + ' °C', tCls);
  }

  // Health
  const hval = health.trim() || '—';
  const hCls = /good/i.test(hval) ? 'batt-ok' : /over/i.test(hval) ? 'batt-hot' : 'batt-warn';
  setVal('batt-health-val', hval.toUpperCase(), hCls);

  // Technology
  setVal('batt-tech-val', tech.trim().toUpperCase() || '—');

  /* ── Metrics grid ────────────────────────────────────────── */
  const cyEl   = document.getElementById('batt-cycles');
  const capEl  = document.getElementById('batt-capacity');
  const fstEl  = document.getElementById('batt-flash-status');
  const pwrEl  = document.getElementById('batt-power');

  if (cyEl)  cyEl.textContent  = cycles.trim()  || '—';
  if (capEl) {
    const cf = parseInt(capFull.trim());
    capEl.textContent = isNaN(cf) ? '—' : Math.round(cf / 1000) + ' mAh';
  }
  if (fstEl) {
    fstEl.textContent  = flashChargeRunning ? '⚡ ACTIVE' : 'OFF';
    fstEl.style.color  = flashChargeRunning ? '#60cfff'   : 'var(--dim)';
  }
  if (pwrEl && !isNaN(voltV) && !isNaN(currUA)) {
    const mW = Math.abs((voltV / 1000000) * (currUA / 1000));
    pwrEl.textContent = mW.toFixed(0) + ' mW';
  }

  /* ── Push to history & draw graph ───────────────────────── */
  BATT_HISTORY.push({ pct, tempC, currMA: isNaN(currUA) ? 0 : currUA / 1000, charging: isCharging });
  if (BATT_HISTORY.length > BATT_HISTORY_MAX) BATT_HISTORY.shift();
  drawBattGraph();

  /* ── Auto charge limit enforcement ─────────────────────── */
  enforceBatteryLimit(pct, status);
}

/* ── Draw battery history graph ─────────────────────────── */
function drawBattGraph() {
  const canvas = document.getElementById('battGraphCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.offsetWidth || canvas.width;
  const H = canvas.height;
  canvas.width = W;
  ctx.clearRect(0, 0, W, H);

  if (BATT_HISTORY.length < 2) {
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.font = '10px "Share Tech Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('Collecting data…', W / 2, H / 2);
    return;
  }

  const N = BATT_HISTORY.length;
  const xOf = i => (i / (BATT_HISTORY_MAX - 1)) * W;

  // ── Battery level fill (bottom area) ─────────────────────
  const pctPts = BATT_HISTORY.map((d, i) => ({ x: xOf(i), y: H - 18 - (d.pct / 100) * (H - 36) }));
  const lvlGrad = ctx.createLinearGradient(0, 0, 0, H);
  lvlGrad.addColorStop(0, 'rgba(76,255,176,0.30)');
  lvlGrad.addColorStop(1, 'rgba(76,255,176,0.03)');
  ctx.fillStyle = lvlGrad;
  ctx.beginPath();
  ctx.moveTo(pctPts[0].x, H - 18);
  pctPts.forEach(p => ctx.lineTo(p.x, p.y));
  ctx.lineTo(pctPts[N - 1].x, H - 18);
  ctx.closePath();
  ctx.fill();

  // Level line
  ctx.strokeStyle = '#4cffb0';
  ctx.lineWidth   = 2;
  ctx.shadowBlur  = 7;
  ctx.shadowColor = 'rgba(76,255,176,0.6)';
  ctx.beginPath();
  pctPts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
  ctx.stroke();
  ctx.shadowBlur = 0;

  // ── Temp line ────────────────────────────────────────────
  const temps = BATT_HISTORY.map(d => isNaN(d.tempC) ? null : d.tempC).filter(v => v !== null);
  if (temps.length >= 2) {
    const tMin = Math.min(...temps) - 2;
    const tMax = Math.max(...temps) + 2;
    const tRange = tMax - tMin || 1;
    const tPts = BATT_HISTORY.map((d, i) => ({
      x: xOf(i),
      y: isNaN(d.tempC) ? null : H - 18 - ((d.tempC - tMin) / tRange) * (H - 36)
    })).filter(p => p.y !== null);

    ctx.strokeStyle = '#ff9933';
    ctx.lineWidth   = 1.5;
    ctx.setLineDash([4, 3]);
    ctx.shadowBlur  = 4;
    ctx.shadowColor = 'rgba(255,153,51,0.5)';
    ctx.beginPath();
    tPts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.shadowBlur = 0;

    // temp label (right side)
    ctx.fillStyle = '#ff9933';
    ctx.font = '9px "Share Tech Mono", monospace';
    ctx.textAlign = 'right';
    ctx.fillText(temps[temps.length - 1].toFixed(1) + '°C', W - 4, tPts[tPts.length - 1].y - 3);
  }

  // ── Charging pulse dots ───────────────────────────────────
  BATT_HISTORY.forEach((d, i) => {
    if (!d.charging) return;
    const p = pctPts[i];
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#60cfff';
    ctx.shadowBlur = 6;
    ctx.shadowColor = 'rgba(96,207,255,0.7)';
    ctx.fill();
    ctx.shadowBlur = 0;
  });

  // ── Latest % label ───────────────────────────────────────
  const last = BATT_HISTORY[N - 1];
  const lp   = pctPts[N - 1];
  ctx.fillStyle  = '#4cffb0';
  ctx.font       = '10px "Share Tech Mono", monospace';
  ctx.textAlign  = 'right';
  ctx.fillText(last.pct + '%' + (last.charging ? ' ⚡' : ''), W - 4, 14);

  // ── Y-axis labels ────────────────────────────────────────
  ctx.fillStyle = 'rgba(255,255,255,0.22)';
  ctx.font      = '9px "Share Tech Mono", monospace';
  ctx.textAlign = 'left';
  ctx.fillText('100%', 3, 12);
  ctx.fillText('0%',   3, H - 20);

  // ── Footer text ──────────────────────────────────────────
  const foot = document.getElementById('batt-graph-footer');
  if (foot) foot.textContent = `${N} samples · ${last.pct}% · ${last.charging ? 'Charging' : 'Discharging'}`;
}

/* ── Flash Charge toggle ─────────────────────────────────── */
async function toggleFlashCharge() {
  const btn   = document.getElementById('btn-flash-charge');
  const label = document.getElementById('flash-charge-label');
  const badge = document.getElementById('flash-charge-summary-badge');
  const hBtn   = document.getElementById('btn-fastcharge-header');
  const hThumb = hBtn?.querySelector('.popup-toggle-thumb');

  flashChargeRunning = !flashChargeRunning;

  const syncAll = (on) => {
    if (btn)   { btn.setAttribute('aria-pressed', String(on)); btn.classList.toggle('gaming-toggle-btn--on', on); }
    if (label) label.textContent = on ? 'ON' : 'OFF';
    if (badge) { badge.textContent = on ? 'ON' : 'OFF'; badge.style.color = on ? '#60cfff' : ''; badge.style.borderColor = on ? '#60cfff' : 'var(--bdr)'; badge.style.opacity = on ? '1' : '0.7'; }
    if (hBtn)  { hBtn.setAttribute('aria-pressed', String(on)); hBtn.classList.toggle('gaming-toggle-btn--on', on); }
    if (hThumb) hThumb.style.transform = on ? 'translateX(16px)' : '';
  };

  syncAll(flashChargeRunning);

  // Save state
  await exec(`mkdir -p ${CFG_DIR} && echo '${flashChargeRunning ? 1 : 0}' > ${CFG_DIR}/flash_charge_enabled`);

  if (flashChargeRunning) {
    // MTK SCP Fast Charge: disable throttling and raise input current limit
    await exec(`
      # 1. Remove battery OC throttle (MTK-specific)
      chmod 644 /proc/mtk_batoc_throttling/battery_oc_protect_stop 2>/dev/null
      echo "stop 1" > /proc/mtk_batoc_throttling/battery_oc_protect_stop 2>/dev/null

      # 2. Reset current limits to let charger negotiate max (MTK battery command)
      # "0 0" = release override, charger uses its own max
      chmod 644 /proc/mtk_battery_cmd/current_cmd 2>/dev/null
      echo "0 0" > /proc/mtk_battery_cmd/current_cmd 2>/dev/null

      # 3. Enable fast charge flags if present
      for n in \
        /sys/class/power_supply/battery/fast_charge \
        /sys/class/power_supply/battery/fastchg_status \
        /sys/kernel/fast_charge/force_fast_charge \
        /sys/devices/platform/charger/enable_meta_current_limit; do
        [ -f "$n" ] && echo 1 > "$n" 2>/dev/null
      done

      # 4. MTK HV charger enable
      for n in \
        /sys/class/power_supply/battery/enable_hv_charging \
        /sys/class/mtk_charger/fast_charging_indicator; do
        [ -f "$n" ] && echo 1 > "$n" 2>/dev/null
      done

      # 5. Remove PPM power limits (allows higher sustained power)
      for i in 0 1 2 3 4 5; do
        [ -f "/proc/ppm/policy/$i" ] && echo "0 -1" > "/proc/ppm/policy/$i" 2>/dev/null
      done
      echo "ok"
    `);
    setStatus('⚡ Fast Charge ENABLED', '#60cfff');
    showToast('Fast Charge ON — limits removed', 'FAST CHARGE', 'success', '⚡');
  } else {
    // Restore normal charging behavior
    await exec(`
      # Re-enable OC protection
      echo "stop 0" > /proc/mtk_batoc_throttling/battery_oc_protect_stop 2>/dev/null

      # Restore current limits to stock (write -1 to signal auto/default)
      chmod 644 /proc/mtk_battery_cmd/current_cmd 2>/dev/null
      echo "-1 -1" > /proc/mtk_battery_cmd/current_cmd 2>/dev/null

      # Restore fast charge flags
      for n in \
        /sys/kernel/fast_charge/force_fast_charge \
        /sys/devices/platform/charger/enable_meta_current_limit; do
        [ -f "$n" ] && echo 0 > "$n" 2>/dev/null
      done

      # Restore HV charging to default (1 = keep enabled, just remove override)
      for n in \
        /sys/class/power_supply/battery/enable_hv_charging \
        /sys/class/mtk_charger/fast_charging_indicator; do
        [ -f "$n" ] && echo 1 > "$n" 2>/dev/null
      done

      # Restore PPM policies to normal
      for i in 0 1 2 3 4 5; do
        [ -f "/proc/ppm/policy/$i" ] && echo "1 -1" > "/proc/ppm/policy/$i" 2>/dev/null
      done
      echo "ok"
    `);
    setStatus('Fast Charge OFF — normal charging');
    showToast('Fast Charge disabled', 'FAST CHARGE', 'info', '🔋');
  }
  readBatteryState();
}

/* ── Charge limit enforcement ────────────────────────────── */
let chargeLimitPct = 80;
async function enforceBatteryLimit(pct, status) {
  if (chargeLimitPct >= 100) return; // no limit
  if (/charging/i.test(status) && pct >= chargeLimitPct) {
    // Stop charging via input_suspend
    await exec(`echo 1 > /sys/class/power_supply/battery/input_suspend 2>/dev/null`);
    setStatus(`🔋 Charge limit reached: ${chargeLimitPct}%`, '#ffcc00');
  } else if (!/charging/i.test(status) && pct < chargeLimitPct - 5) {
    // Resume when 5% below limit
    await exec(`echo 0 > /sys/class/power_supply/battery/input_suspend 2>/dev/null`);
  }
}

/* ── Apply charge limit slider ───────────────────────────── */
async function applyChargeLimit() {
  const sl = document.getElementById('charge-limit-slider');
  chargeLimitPct = sl ? parseInt(sl.value) : 80;
  await exec(`mkdir -p /sdcard/GovThermal/config && echo "${chargeLimitPct}" > ${CHARGE_LIMIT_FILE}`);
  setStatus(`🔋 Charge limit set: ${chargeLimitPct}%`, '#ffcc00');
  showToast(`Charging stops at ${chargeLimitPct}%`,'CHARGE LIMIT','success','🔋');
  autoSave();
}

/* ── Mini toggle helper ──────────────────────────────────── */
function bindMiniToggle(btnId, badgeId, onCmd, offCmd, startOn) {
  const btn   = document.getElementById(btnId);
  const badge = document.getElementById(badgeId);
  if (!btn) return;
  let state = startOn || false;
  const update = () => {
    btn.dataset.state = state ? 'on' : 'off';
    if (badge) badge.textContent = state ? 'ON' : 'OFF';
  };
  update();
  btn.addEventListener('click', async () => {
    state = !state;
    update();
    await exec(state ? onCmd : offCmd);
    setStatus(badgeId.replace('-badge','').replace(/-/g,' ').toUpperCase() + (state ? ' ON' : ' OFF'));
    showToast(badgeId.replace('-badge','').replace(/-/g,' ').toUpperCase()+(state?' ON':' OFF'),'BATTERY',state?'success':'info',state?'✓':'○');
  }, { passive: true });
}

/* ── Apply CV ────────────────────────────────────────────── */
async function applyCV() {
  const inp = document.getElementById('input-cv');
  const val = inp ? inp.value.trim() : '4700000';
  await exec(`echo "${val}" > /proc/mtk_battery_cmd/set_cv 2>/dev/null`);
  setStatus(`CV set: ${val} µV`, '#60cfff');
  showToast(`Charge voltage → ${(parseInt(val)/1e6).toFixed(2)}V`,'CV VOLTAGE','success','⚡');
}

/* ── Stop OC throttle ────────────────────────────────────── */
async function stopOCThrottle() {
  await exec(`echo "stop 1" > /proc/mtk_batoc_throttling/battery_oc_protect_stop 2>/dev/null`);
  await exec(`echo 0 > /proc/mtk_batoc_throttling/battery_oc_protect_level 2>/dev/null`);
  await exec(`echo 0 > /proc/mtk_batoc_throttling/battery_oc_protect_ut 2>/dev/null`);
  const el = document.getElementById('oc-throttle-status');
  if (el) { el.textContent = 'STOPPED'; el.style.color = 'var(--a)'; }
  setStatus('OC throttle stopped', 'var(--a)');
  showToast('MTK OC throttle stopped','OC THROTTLE','success','✓');
}

/* ── Init battery panel ──────────────────────────────────── */
function initBatteryPanel() {
  // Charge limit slider
  const sl = document.getElementById('charge-limit-slider');
  const disp = document.getElementById('charge-limit-display');
  if (sl && disp) {
    sl.addEventListener('input', () => {
      disp.textContent = sl.value + '%';
      chargeLimitPct = parseInt(sl.value);
    }, { passive: true });
  }

  // ── − / + step buttons ──────────────────────────────────
  function updateSlider(newVal) {
    if (!sl || !disp) return;
    newVal = Math.max(50, Math.min(100, newVal));
    sl.value = newVal;
    disp.textContent = newVal + '%';
    chargeLimitPct = newVal;
    _syncSliderFill(sl);
  }

  document.getElementById('clb-dec-btn')?.addEventListener('click', () => {
    updateSlider(parseInt(sl?.value || 80) - 5);
  });
  document.getElementById('clb-inc-btn')?.addEventListener('click', () => {
    updateSlider(parseInt(sl?.value || 80) + 5);
  });

  // Restore saved limit
  exec(`cat ${CHARGE_LIMIT_FILE} 2>/dev/null`).then(v => {
    const saved = parseInt(v.trim());
    if (!isNaN(saved) && saved >= 50 && saved <= 100) {
      chargeLimitPct = saved;
      if (sl)   { sl.value = saved; _syncSliderFill(sl); }
      if (disp) disp.textContent = saved + '%';
    }
  });

  // Buttons
  document.getElementById('btn-flash-charge')?.addEventListener('click', toggleFlashCharge, { passive: true });
  const applyChargeLimitBtn = document.getElementById('btn-apply-charge-limit');
  applyChargeLimitBtn?.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); applyChargeLimit(); });

  const fcHeaderBtn = document.getElementById('btn-fastcharge-header');
  fcHeaderBtn?.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); toggleFlashCharge(); });
  document.getElementById('btn-apply-cv')?.addEventListener('click', applyCV, { passive: true });
  document.getElementById('btn-oc-throttle-stop')?.addEventListener('click', stopOCThrottle, { passive: true });

  // ── Header Fast Charge toggle ──────────────────────────────────
  // Detect charger type and label accordingly, then wire to toggleFlashCharge
  (async () => {
    const fcBtn   = document.getElementById('btn-fastcharge-header');
    const fcLabel = document.getElementById('fastcharge-header-label');
    if (!fcBtn) return;

    // Detect charger/fast-charge type from sysfs/props — MTK SCP priority
    const [chargerRaw, ctypeRaw, scpRaw] = await Promise.all([
      exec(`cat /sys/class/power_supply/battery/charge_type 2>/dev/null || cat /sys/class/power_supply/mtk-battery/charge_type 2>/dev/null`),
      exec(`getprop ro.config.hw_charge_strategy 2>/dev/null; cat /proc/mtk_battery_cmd/charger_type 2>/dev/null; cat /sys/class/power_supply/battery/charger_type 2>/dev/null`),
      exec(`[ -f /proc/mtk_batoc_throttling/battery_oc_protect_stop ] && echo "scp_mtk" || echo ""`),
    ]);
    const combined = (chargerRaw + ctypeRaw + scpRaw).toLowerCase();

    let fcName = '⚡ FC';
    if      (combined.includes('vooc') || combined.includes('supervooc')) fcName = '⚡ VOOC';
    else if (combined.includes('warp') || combined.includes('dash'))      fcName = '⚡ WARP';
    else if (combined.includes('scp')  || combined.includes('hv_scp') || combined.includes('scp_mtk')) fcName = '⚡ SCP';
    else if (combined.includes('afc')  || combined.includes('hv_afc'))   fcName = '⚡ AFC';
    else if (combined.includes('pd'))                                     fcName = '⚡ PD';
    else if (combined.includes('qc')   || combined.includes('quick'))    fcName = '⚡ QC';

    if (fcLabel) fcLabel.textContent = fcName;
    fcBtn.title = fcName.replace('⚡ ', '') + ' Fast Charge';

    // Sync state with existing flashChargeRunning
    const syncFcHeader = () => {
      fcBtn.setAttribute('aria-pressed', String(flashChargeRunning));
      fcBtn.classList.toggle('gaming-toggle-btn--on', flashChargeRunning);
      const thumb = fcBtn.querySelector('.popup-toggle-thumb');
      if (thumb) thumb.style.transform = flashChargeRunning ? 'translateX(16px)' : '';
      if (fcLabel) fcLabel.textContent = fcName + (flashChargeRunning ? '' : '');
    };

    // Load saved state from config file, then verify with pgrep
    Promise.all([
      exec(`cat ${CFG_DIR}/flash_charge_enabled 2>/dev/null`),
      exec(`pgrep -f "flash_charge" 2>/dev/null`)
    ]).then(([savedState, pid]) => {
      const savedOn = savedState.trim() === '1';
      const running = !!pid.trim();
      flashChargeRunning = savedOn || running;
      syncFcHeader();
    });
    // Click is wired separately with stopPropagation (since button is inside <summary>)
  })();

  // Mini toggles
  bindMiniToggle(
    'btn-bypass-mode', 'bypass-mode-badge',
    `echo 1 > /sys/class/power_supply/battery/input_suspend 2>/dev/null`,
    `echo 0 > /sys/class/power_supply/battery/input_suspend 2>/dev/null`,
    false
  );
  bindMiniToggle(
    'btn-input-suspend', 'input-suspend-badge',
    `for n in /sys/class/power_supply/battery/input_suspend /sys/class/qcom-battery/input_suspend; do [ -f "$n" ] && echo 1 > "$n"; done`,
    `for n in /sys/class/power_supply/battery/input_suspend /sys/class/qcom-battery/input_suspend; do [ -f "$n" ] && echo 0 > "$n"; done`,
    false
  );
  bindMiniToggle(
    'btn-oc-protect', 'oc-protect-badge',
    `echo 0 > /proc/mtk_batoc_throttling/battery_oc_protect_level 2>/dev/null`,
    `echo 1 > /proc/mtk_batoc_throttling/battery_oc_protect_level 2>/dev/null`,
    true
  );
  bindMiniToggle(
    'btn-store-mode', 'store-mode-badge',
    `echo 1 > /sys/class/power_supply/battery/store_mode 2>/dev/null`,
    `echo 0 > /sys/class/power_supply/battery/store_mode 2>/dev/null`,
    false
  );

  // Check if flash charge is saved as enabled or currently running
  Promise.all([
    exec(`cat ${CFG_DIR}/flash_charge_enabled 2>/dev/null`),
    exec(`pgrep -f "flash_charge" 2>/dev/null`)
  ]).then(([savedState, pid]) => {
    if (savedState.trim() === '1' || pid.trim()) {
      flashChargeRunning = true;
      const btn   = document.getElementById('btn-flash-charge');
      const label = document.getElementById('flash-charge-label');
      const badge = document.getElementById('flash-charge-summary-badge');
      const hBtn  = document.getElementById('btn-fastcharge-header');
      const hThumb = hBtn?.querySelector('.popup-toggle-thumb');
      if (btn)   { btn.setAttribute('aria-pressed', 'true'); btn.classList.add('gaming-toggle-btn--on'); }
      if (label) label.textContent = 'ON';
      if (badge) { badge.textContent = 'ON'; badge.style.color = '#60cfff'; badge.style.borderColor = '#60cfff'; badge.style.opacity = '1'; }
      if (hBtn)  { hBtn.setAttribute('aria-pressed', 'true'); hBtn.classList.add('gaming-toggle-btn--on'); }
      if (hThumb) hThumb.style.transform = 'translateX(16px)';
    }
  });

  // Read OC throttle state
  exec(`cat /proc/mtk_batoc_throttling/battery_oc_protect_stop 2>/dev/null`).then(v => {
    const el = document.getElementById('oc-throttle-status');
    if (el) {
      const stopped = v.trim().includes('1');
      el.textContent = stopped ? 'STOPPED' : 'ACTIVE';
      el.style.color = stopped ? 'var(--a)' : '#ff9933';
    }
  });

  // Start polling
  readBatteryState();
  clearInterval(_battTimer);
  _battTimer = setInterval(readBatteryState, 6000);

  // Redraw on resize
  window.addEventListener('resize', drawBattGraph, { passive: true });
}



/* ═══════════════════════════════════════════════════════════
   § 17  BOOST COLOR · SATURATION CONTROL
   ═══════════════════════════════════════════════════════════ */

const BOOST_COLOR_CFG = '/sdcard/DAVION_ENGINE_BoostColor';
let _boostColorInitDone = false;

async function initBoostColorPanel() {
  if (_boostColorInitDone) return;
  _boostColorInitDone = true;

  await exec(`mkdir -p ${BOOST_COLOR_CFG}`);

  const satSlider = document.getElementById('sat-boost-slider');
  const satVal    = document.getElementById('sat-boost-val');
  const satStatus = document.getElementById('sat-boost-status');

  const setBoostStatus = (msg, color) => {
    if (satStatus) { satStatus.textContent = msg; satStatus.style.color = color || 'var(--dim)'; }
  };

  // Load saved value and re-apply to SurfaceFlinger (survives webview reload, not reboot — reboot handled by boot_apply.sh)
  const saved = await exec(`cat ${BOOST_COLOR_CFG}/saturation_value 2>/dev/null`);
  if (saved.trim()) {
    const savedNum = parseFloat(saved.trim()).toFixed(1);
    if (satSlider) { satSlider.value = savedNum; _syncSliderFill(satSlider); }
    if (satVal)    satVal.textContent = savedNum;
    // Re-apply to SurfaceFlinger so the setting is active after webview restarts
    if (savedNum !== '1.0') {
      await exec(`service call SurfaceFlinger 1022 f ${savedNum}`);
      setBoostStatus(`✓ Saturation restored: ${savedNum}`, 'var(--a)');
    }
  }

  // Live adjust on slide
  async function _applySaturation(v) {
    const vStr = parseFloat(v).toFixed(1);
    if (satSlider) { satSlider.value = vStr; _syncSliderFill(satSlider); }
    if (satVal)    satVal.textContent = vStr;
    setBoostStatus(`Applying saturation: ${vStr}…`, '#ffcc00');
    await exec(`service call SurfaceFlinger 1022 f ${vStr}`);
    await exec(`echo ${vStr} > ${BOOST_COLOR_CFG}/saturation_value`);
    setBoostStatus(`✓ Saturation set to ${vStr}`, 'var(--a)');
    showToast(`Display saturation → ${vStr}`, 'BOOST COLOR', 'success', '🎨');
    const mv = document.getElementById('sat-boost-val-metric');
    const ml = document.getElementById('sat-boost-mode-label');
    if (mv) mv.textContent = parseFloat(vStr).toFixed(1) + '×';
    if (ml) {
      const fv = parseFloat(vStr);
      ml.textContent = fv < 0.5 ? 'GREYSCALE' : fv < 0.9 ? 'MUTED' : fv < 1.1 ? 'DEFAULT' : fv < 1.5 ? 'BOOSTED' : 'VIVID';
      ml.style.color = fv > 1.4 ? 'var(--a)' : fv < 0.8 ? '#60cfff' : 'var(--text)';
    }
    autoSave();
  }

  if (satSlider) {
    satSlider.addEventListener('input', function () { _applySaturation(this.value); }, { passive: true });
  }

  // − / + buttons (step = 0.1)
  document.getElementById('sat-dec-btn')?.addEventListener('click', () => {
    const cur = parseFloat(satSlider?.value || 1.0);
    _applySaturation(Math.max(0, Math.round((cur - 0.1) * 10) / 10));
  });
  document.getElementById('sat-inc-btn')?.addEventListener('click', () => {
    const cur = parseFloat(satSlider?.value || 1.0);
    _applySaturation(Math.min(2, Math.round((cur + 0.1) * 10) / 10));
  });

  // Show current system value
  const liveSat = await exec(
    `service call SurfaceFlinger 1023 2>/dev/null | grep -oE '[0-9]+\\.[0-9]+' | head -1`
  );
  if (liveSat.trim()) {
    setBoostStatus(`Current system saturation: ${liveSat.trim()}`, 'var(--a)');
  } else {
    setBoostStatus('Slide to adjust display saturation in real-time', 'var(--dim)');
  }
}




/* ═══════════════════════════════════════════════════════════
   § 17b  ANIMATION SCALE · WINDOW / TRANSITION / DURATION
   ═══════════════════════════════════════════════════════════ */

const ANIM_SCALE_CFG = '/sdcard/DAVION_ENGINE_AnimScale';
let _animScaleInitDone = false;

async function initAnimScalePanel() {
  if (_animScaleInitDone) return;
  _animScaleInitDone = true;

  await exec(`mkdir -p ${ANIM_SCALE_CFG}`);

  const status = document.getElementById('anim-scale-status');
  const setStatus = (msg, color) => {
    if (status) { status.textContent = msg; status.style.color = color || 'var(--dim)'; }
  };

  const m = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };

  const SCALES = [
    { group: 'win',   valId: 'anim-win-val',   metricId: 'anim-m-win',   setting: 'window_animation_scale',     label: 'Window' },
    { group: 'trans', valId: 'anim-trans-val', metricId: 'anim-m-trans', setting: 'transition_animation_scale', label: 'Transition' },
    { group: 'dur',   valId: 'anim-dur-val',   metricId: 'anim-m-dur',   setting: 'animator_duration_scale',    label: 'Duration' },
  ];

  function feelLabel(v) {
    const f = parseFloat(v);
    if (f <= 0.25) return 'INSTANT';
    if (f <= 0.5)  return 'SNAPPY';
    if (f <= 0.75) return 'FAST';
    if (f <= 1.0)  return 'DEFAULT';
    if (f <= 1.5)  return 'SMOOTH';
    if (f <= 2.0)  return 'SLOW';
    return 'VERY SLOW';
  }

  function updateFeel() {
    const win   = document.querySelector('#anim-win-btns .rr-btn--active')?.dataset.scale   || '1';
    const trans = document.querySelector('#anim-trans-btns .rr-btn--active')?.dataset.scale || '1';
    const dur   = document.querySelector('#anim-dur-btns .rr-btn--active')?.dataset.scale   || '1';
    const avg   = (parseFloat(win) + parseFloat(trans) + parseFloat(dur)) / 3;
    m('anim-m-feel', feelLabel(avg));
  }

  // Load saved values and wire up buttons for each group
  for (const s of SCALES) {
    const saved = await exec(`cat ${ANIM_SCALE_CFG}/${s.setting} 2>/dev/null`);
    const savedVal = saved.trim() || '1';

    const container = document.getElementById(`anim-${s.group}-btns`);
    const valEl     = document.getElementById(s.valId);

    // Set active button from saved value
    container?.querySelectorAll('.rr-btn').forEach(btn => {
      btn.classList.toggle('rr-btn--active', btn.dataset.scale === savedVal);
    });
    if (valEl) valEl.textContent = savedVal + '×';
    m(s.metricId, savedVal + '×');

    // Wire clicks
    container?.querySelectorAll('.rr-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const v = btn.dataset.scale;

        // Update active state
        container.querySelectorAll('.rr-btn').forEach(b => b.classList.remove('rr-btn--active'));
        btn.classList.add('rr-btn--active');
        if (valEl) valEl.textContent = v + '×';
        m(s.metricId, v + '×');
        updateFeel();

        setStatus(`Applying ${s.label} scale → ${v}×…`, '#ffcc00');

        // Apply via settings put — works on rooted devices
        await exec(`settings put global ${s.setting} ${v}`);
        // Save to config
        await exec(`echo ${v} > ${ANIM_SCALE_CFG}/${s.setting}`);

        setStatus(`✓ ${s.label} animation scale set to ${v}×`, 'var(--a)');
        showToast(`${s.label} scale → ${v}×`, 'ANIM SCALE', 'success', '🎬');
        autoSave();
      });
    });
  }

  // Read live system values on open
  for (const s of SCALES) {
    const live = await exec(`settings get global ${s.setting} 2>/dev/null`);
    const lv = live.trim();
    if (lv && lv !== 'null') {
      const container = document.getElementById(`anim-${s.group}-btns`);
      const valEl     = document.getElementById(s.valId);
      container?.querySelectorAll('.rr-btn').forEach(btn => {
        btn.classList.toggle('rr-btn--active', btn.dataset.scale === lv);
      });
      if (valEl) valEl.textContent = lv + '×';
      m(document.getElementById(`anim-m-${s.group}`) ? `anim-m-${s.group}` : s.metricId, lv + '×');
    }
  }
  updateFeel();
  setStatus('Tap a value to apply animation scale instantly', 'var(--dim)');
}


/* ═══════════════════════════════════════════════════════════
   § 18  DEVICE SPOOF · IDENTITY CONTROL
   ═══════════════════════════════════════════════════════════
   Zygisk reads /data/adb/modules/COPG/COPG.json per app launch.
   Structure needed:
     { cpu_spoof:{...}, PACKAGES_KEY:[...], PACKAGES_KEY_DEVICE:{...} }
   "blocked"  = full device+CPU spoof + frame unlock
   "notweak"  = device identity only, no frame tweak
   ═══════════════════════════════════════════════════════════ */

const COPG_JSON_PATH = '/data/adb/modules/COPG/COPG.json';
const LIST_JSON_PATH  = '/data/adb/modules/COPG/list.json';

/* ─────────────────────────────────────────────────────────
   FULL EMBEDDED GAME DATABASE
   Always available — no file dependency, no bridge needed.
   Keys searched by package name AND display name.
   ───────────────────────────────────────────────────────── */
const SPOOF_BUILTIN_DB = {
  /* ── Call of Duty ── */
  "com.activision.callofduty.shooter":  "Call of Duty: Mobile",
  "com.activision.callofduty.warzone":  "CoD: Warzone Mobile",
  "com.garena.game.codm":               "CoD: Mobile (Garena/SEA)",
  "com.tencent.tmgp.kr.codm":           "CoD: Mobile (Korea)",
  "com.vng.codmvn":                     "CoD: Mobile (Vietnam)",
  /* ── PUBG ── */
  "com.tencent.ig":                     "PUBG Mobile (Global)",
  "com.pubg.imobile":                   "PUBG Mobile (India)",
  "com.pubg.krmobile":                  "PUBG Mobile (Korea)",
  "com.rekoo.pubgm":                    "PUBG Mobile (Rekoo)",
  "com.tencent.tmgp.pubgmhd":           "PUBG Mobile HD",
  "com.vng.pubgmobile":                 "PUBG Mobile (Vietnam)",
  "com.pubg.newstate":                  "PUBG: New State",
  /* ── Mobile Legends ── */
  "com.mobilelegends.mi":               "Mobile Legends: Bang Bang",
  "com.mobile.legends":                 "Mobile Legends: Bang Bang",
  "com.mobile.legends.usa":             "Mobile Legends (US)",
  "com.vng.mlbbvn":                     "Mobile Legends (Vietnam)",
  /* ── Supercell ── */
  "com.supercell.brawlstars":           "Brawl Stars",
  "com.supercell.clashofclans":         "Clash of Clans",
  "com.supercell.squad":                "Squad Busters",
  /* ── League / Riot ── */
  "com.riotgames.league.wildrift":      "Wild Rift (Global)",
  "com.riotgames.league.wildrifttw":    "Wild Rift (Taiwan)",
  "com.riotgames.league.wildriftvn":    "Wild Rift (Vietnam)",
  "com.tencent.lolm":                   "Wild Rift (China)",
  /* ── Arena of Valor / Honor of Kings ── */
  "com.levelinfinite.sgameGlobal":      "Arena of Valor (Global)",
  "com.tencent.tmgp.sgame":             "Arena of Valor (China)",
  "com.garena.game.kgvn":               "Arena of Valor (Vietnam)",
  "com.garena.game.kgid":               "Arena of Valor (Indonesia)",
  "com.garena.game.kgth":               "Arena of Valor (Thailand)",
  "com.garena.game.kgtw":               "Arena of Valor (Taiwan)",
  "com.garena.game.kgms":               "Arena of Valor (Malaysia/SG)",
  "com.garena.game.kgph":               "Arena of Valor (Philippines)",
  "com.tencent.ngjp":                   "Arena of Valor (Japan)",
  "com.ngame.allstar.eu":               "Arena of Valor (Europe)",
  "com.clashoftitansandroid.india":     "Clash of Titans (India)",
  "com.tencent.ngame.chty":             "Arena of Valor (China Alt)",
  "com.garena.game.kgvntest":           "Arena of Valor (VN Test)",
  "com.levelinfinite.aov":              "Arena of Valor (LI Global)",
  "com.tencent.aovindia":               "Arena of Valor (India)",
  "com.tencent.aovjp":                  "Arena of Valor (Japan Alt)",
  "com.tencent.tmgp.gnyx":              "Honor of Kings",
  /* ── Blizzard ── */
  "com.blizzard.diablo.immortal":       "Diablo Immortal",
  /* ── Epic / Fortnite ── */
  "com.epicgames.fortnite":             "Fortnite",
  "com.epicgames.portal":               "Epic Games Store",
  /* ── Free Fire ── */
  "com.dts.freefireth":                 "Free Fire",
  "com.dts.freefiremax":                "Free Fire MAX",
  /* ── Gameloft / Asphalt ── */
  "com.gameloft.android.ANMP.GloftA8HM": "Asphalt 8: Airborne",
  "com.gameloft.android.ANMP.GloftA9HM": "Asphalt 9: Legends",
  /* ── NetEase ── */
  "com.netease.newspike":               "Blood Strike",
  "com.netease.lztgglobal":             "Lost Light",
  /* ── Pearl Abyss ── */
  "com.pearlabyss.blackdesertm":        "Black Desert Mobile",
  "com.pearlabyss.blackdesertm.gl":     "Black Desert Mobile (GL)",
  /* ── Other shooters / action ── */
  "com.madfingergames.legends":         "Shadowgun Legends",
  "com.nekki.shadowfight3":             "Shadow Fight 3",
  "com.nekki.shadowfightarena":         "Shadow Fight Arena",
  "com.nekki.shadowfight":              "Shadow Fight 2",
  "com.blitzteam.battleprime":          "Battle Prime",
  "com.gamedevltd.destinywarfare":      "Destiny Warfare",
  "com.pikpok.dr2.play":                "Dead Rising 2",
  /* ── EA ── */
  "com.ea.game.nfs14_row":              "Need for Speed: No Limits",
  "com.ea.games.r3_row":                "Real Racing 3",
  "com.ea.gp.fifamobile":               "EA Sports FC Mobile",
  "com.ea.gp.apexlegendsmobilefps":     "Apex Legends Mobile",
  /* ── Kuro / Wuthering Waves ── */
  "com.kurogame.wutheringwaves.global": "Wuthering Waves (Global)",
  /* ── Level Infinite / Tower of Fantasy ── */
  "com.levelinfinite.hotta.gp":         "Tower of Fantasy",
  /* ── Delta Force ── */
  "com.proxima.dfm":                    "Delta Force Mobile",
  "com.garena.game.df":                 "Delta Force (Garena)",
  /* ── Racing / Driving ── */
  "com.CarXTech.highWay":               "CarX Highway Racing",
  /* ── Other ── */
  "com.proximabeta.mf.uamo":            "Honor MF Uamo",
  "com.miraclegames.farlight84":         "Farlight 84",
  "com.ss.android.ugc.trill":           "TikTok (Global)",
  "com.zhiliaoapp.musically":           "TikTok (US)",
  /* ── Google / Apps ── */
  "com.google.android.apps.photos":     "Google Photos",
  "com.netflix.mediaclient":            "Netflix",
  "com.netflix.ninja":                  "Netflix (Beta)",
  /* ── Banking (blacklist candidate) ── */
  "com.bbl.mobilebanking":              "Bangkok Bank"
};

/* ── Runtime state ── */
let _spoofGameDb    = { ...SPOOF_BUILTIN_DB }; // extended by list.json + pm
let _spoofDeviceDb  = {};     // COPG.json: { KEY: ["pkg:mode",...] }
let _spoofInstalled = new Set();

let _spoofDeviceId   = null;
let _spoofDeviceData = null;
let _spoofChecked    = {};    // { pkg: mode }
let _spoofPkgMode    = 'blocked';
let _spoofSearchQ    = '';
let _spoofDbLoaded   = false;

/* ═══════════════════════════════════════════
   DATABASE LOAD  (bridge-dependent, async)
   Always safe to call — merges on top of builtin
   ═══════════════════════════════════════════ */
async function _loadSpoofDatabases() {
  const [rawJson, rawList, rawPm] = await Promise.all([
    exec(`cat ${COPG_JSON_PATH} 2>/dev/null`),
    exec(`cat ${LIST_JSON_PATH}  2>/dev/null`),
    exec(`{ pm list packages -3; pm list packages; } 2>/dev/null | sort -u`)
  ]);

  /* Merge list.json */
  try { Object.assign(_spoofGameDb, JSON.parse(rawList)); } catch(e) {}

  /* Parse COPG.json → device default package arrays */
  try {
    const cfg = JSON.parse(rawJson);
    _spoofDeviceDb = {};
    for (const [k, v] of Object.entries(cfg)) {
      if (k.startsWith('PACKAGES_') && !k.endsWith('_DEVICE') && k !== 'cpu_spoof') {
        _spoofDeviceDb[k.replace('PACKAGES_', '')] = Array.isArray(v) ? v : [];
      }
    }
    if (cfg.cpu_spoof) {
      const blEl  = document.getElementById('cpu-blacklist-input');
      const cpoEl = document.getElementById('cpu-only-input');
      if (blEl)  blEl.value  = (cfg.cpu_spoof.blacklist          || []).join('\n');
      if (cpoEl) cpoEl.value = (cfg.cpu_spoof.cpu_only_packages  || []).join('\n');
    }
  } catch(e) {}

  /* Installed packages → add to game DB if not already there */
  _spoofInstalled = new Set();
  rawPm.split('\n').forEach(line => {
    const pkg = line.replace('package:', '').trim();
    if (!pkg) return;
    _spoofInstalled.add(pkg);
    if (!_spoofGameDb[pkg]) _spoofGameDb[pkg] = pkg; // fallback: show raw pkg name
  });

  _spoofDbLoaded = true;

  /* Re-render with all real data — installed apps now visible */
  _renderGameList(_spoofSearchQ);

  const nInst   = _spoofInstalled.size;
  const nKnown  = Object.keys(_spoofGameDb).length;
  const bridgeOk = !!(window.ksu || window.apatch);
  showToast(
    bridgeOk
      ? `${nInst} installed · ${nKnown} known games`
      : `${nKnown} known games loaded (bridge offline — install detection skipped)`,
    'SPOOF DB', bridgeOk ? 'info' : 'warn', '📂', 2400
  );
}

/* ═══════════════════════════════════════════
   DEVICE CARD SELECTION
   ═══════════════════════════════════════════ */
function _selectSpoofDevice(card) {
  document.querySelectorAll('.spoof-card').forEach(c => c.classList.remove('spoof-card--active'));
  card.classList.add('spoof-card--active');
  _spoofDeviceData = card.dataset;
  _spoofDeviceId   = card.dataset.spoofId;

  /* Identity display */
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v || '—'; };
  set('sid-brand',        card.dataset.brand);
  set('sid-model',        card.dataset.model);
  set('sid-manufacturer', card.dataset.manufacturer);
  set('sid-product',      card.dataset.product);
  set('sid-fingerprint',  card.dataset.fingerprint);

  /* Pre-populate checked from COPG.json defaults */
  _spoofChecked = {};
  (_spoofDeviceDb[_spoofDeviceId] || []).forEach(entry => {
    const [pkg, mode] = entry.split(':');
    if (pkg) _spoofChecked[pkg] = mode || 'blocked';
  });

  _renderGameList(_spoofSearchQ);
  _updateWriteBtn();
  _updateSpoofMetrics();
  _updateJsonPreview();

  const metDev = document.getElementById('spoof-metric-device');
  if (metDev) metDev.textContent = card.dataset.device;

  setStatus(`Target: ${card.dataset.device}`, 'var(--a)');
}

/* ═══════════════════════════════════════════
   GAME LIST RENDER
   Works immediately from SPOOF_BUILTIN_DB,
   even before bridge loads or device selected.
   ═══════════════════════════════════════════ */
function _renderGameList(filter) {
  const list = document.getElementById('spoof-game-list');
  if (!list) return;

  const lc = (filter || '').toLowerCase().trim();

  /* ── Build the full package pool ── */
  const defaultSet = new Set();
  if (_spoofDeviceId) {
    (_spoofDeviceDb[_spoofDeviceId] || []).forEach(e => {
      const [p] = e.split(':'); if (p) defaultSet.add(p);
    });
  }

  /* Union of: builtin DB + list.json + installed + defaults + checked */
  const allPkgs = new Set([
    ...Object.keys(_spoofGameDb),
    ..._spoofInstalled,
    ...defaultSet,
    ...Object.keys(_spoofChecked)
  ]);

  /* ── First pass filter: what to show ── */
  /* Always show builtin DB + defaults + checked + installed (filtered).
     When searching, expand to full _spoofGameDb too. */
  let pool = [...allPkgs].filter(pkg => {
    const inBuiltin   = pkg in SPOOF_BUILTIN_DB;
    const inDb        = pkg in _spoofGameDb;
    const isInstalled = _spoofInstalled.has(pkg);
    const isDefault   = defaultSet.has(pkg);
    const isChecked   = pkg in _spoofChecked;

    /* Always include: selected, device-defaults, or in builtin DB */
    if (isChecked || isDefault || inBuiltin) return true;

    /* When searching: also include rest of _spoofGameDb (list.json entries) */
    if (lc && inDb) return true;

    if (isInstalled) {
      /* Without search: skip obvious system packages */
      if (!lc) {
        const SYS = ['com.android.','android.','com.google.android.gms',
                     'com.google.android.gsf','com.google.android.play',
                     'com.sec.android.','com.qualcomm.','com.mediatek.',
                     'com.oplus.','com.oppo.','com.samsung.','com.huawei.',
                     'com.miui.','com.coloros.'];
        if (SYS.some(s => pkg.startsWith(s))) return false;
      }
      return true;
    }
    return false;
  });

  /* ── Search filter ── */
  if (lc) {
    pool = pool.filter(pkg => {
      const name = (_spoofGameDb[pkg] || '').toLowerCase();
      return pkg.toLowerCase().includes(lc) || name.includes(lc);
    });
  }

  if (!pool.length) {
    list.innerHTML = '<div class="list-placeholder mono">No results — try the full package name</div>';
    return;
  }

  /* ── Sort: checked → defaults → builtin → installed → rest ── */
  pool.sort((a, b) => {
    const rank = p => (p in _spoofChecked ? 0 : defaultSet.has(p) ? 1 : p in SPOOF_BUILTIN_DB ? 2 : _spoofInstalled.has(p) ? 3 : 4);
    const rd = rank(a) - rank(b);
    if (rd !== 0) return rd;
    return (_spoofGameDb[a] || a).localeCompare(_spoofGameDb[b] || b);
  });

  /* ── Render with section dividers ── */
  let lastRank = -1;
  const SECTION_LABELS = ['✓ SELECTED', '● DEVICE DEFAULTS', '◈ KNOWN GAMES', '📱 INSTALLED APPS', '— OTHER'];
  const frag = document.createDocumentFragment();

  pool.forEach(pkg => {
    const isChecked   = pkg in _spoofChecked;
    const isDefault   = defaultSet.has(pkg);
    const inBuiltin   = pkg in SPOOF_BUILTIN_DB;
    const isInstalled = _spoofInstalled.has(pkg);
    const mode        = _spoofChecked[pkg] || _spoofPkgMode;
    const name        = _spoofGameDb[pkg] || pkg;

    const thisRank = isChecked ? 0 : isDefault ? 1 : inBuiltin ? 2 : isInstalled ? 3 : 4;

    if (thisRank !== lastRank) {
      lastRank = thisRank;
      /* Only show divider if there are items in that section */
      if (!_spoofDeviceId && thisRank === 1) return; // no defaults without device
      const div = document.createElement('div');
      div.className = 'spoof-list-divider mono';
      div.textContent = SECTION_LABELS[thisRank] || '— OTHER';
      frag.appendChild(div);
    }

    const item = document.createElement('div');
    item.className = 'spoof-game-item' + (isChecked ? ' spoof-game-item--checked' : '');
    item.dataset.pkg = pkg;

    /* Disabled state: no device selected yet */
    if (!_spoofDeviceId) item.style.opacity = '0.55';

    const instDot = `<span class="spoof-inst-dot${isInstalled ? '' : ' spoof-inst-dot--no'}"
      title="${isInstalled ? 'Installed on device' : 'Not detected'}">${isInstalled ? '●' : '○'}</span>`;

    const modeBadge = `<span class="spoof-pkg-mode ${isChecked ? 'mode--' + mode : ''}" data-pkg="${pkg}"
      title="Click to toggle mode">${(isChecked ? mode : _spoofPkgMode).toUpperCase()}</span>`;

    item.innerHTML =
      `<div class="spoof-check"></div>` +
      `<div class="spoof-game-info">` +
        `<div class="spoof-game-name">${_escHtml(name)}</div>` +
        `<div class="spoof-game-pkg">${_escHtml(pkg)}</div>` +
      `</div>` +
      instDot + modeBadge;

    /* Toggle row check */
    item.addEventListener('click', e => {
      if (!_spoofDeviceId) {
        showToast('Select a device first', 'SPOOF', 'warn', '⚠', 1600);
        return;
      }
      if (e.target.classList.contains('spoof-pkg-mode')) return;
      _toggleGamePkg(pkg);
    });

    /* Mode badge cycles blocked ↔ notweak */
    item.querySelector('.spoof-pkg-mode').addEventListener('click', e => {
      e.stopPropagation();
      if (!_spoofDeviceId) return;
      if (!(pkg in _spoofChecked)) _spoofChecked[pkg] = _spoofPkgMode;
      const next = _spoofChecked[pkg] === 'blocked' ? 'notweak' : 'blocked';
      _spoofChecked[pkg] = next;
      const b = e.target;
      b.textContent  = next.toUpperCase();
      b.className    = `spoof-pkg-mode mode--${next}`;
      item.classList.add('spoof-game-item--checked');
      _updateSelStatus(); _updateSpoofMetrics(); _updateJsonPreview();
    });

    frag.appendChild(item);
  });

  list.innerHTML = '';
  list.appendChild(frag);
  _updateSelStatus();
}

function _escHtml(s) {
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function _toggleGamePkg(pkg) {
  if (pkg in _spoofChecked) delete _spoofChecked[pkg];
  else _spoofChecked[pkg] = _spoofPkgMode;
  _renderGameList(_spoofSearchQ);
  _updateWriteBtn(); _updateSpoofMetrics(); _updateJsonPreview();
}

function _updateSelStatus() {
  const n  = Object.keys(_spoofChecked).length;
  const el = document.getElementById('spoof-sel-status');
  if (el) {
    el.textContent = `${n} game${n !== 1 ? 's' : ''} selected`;
    el.style.color = n > 0 ? 'var(--a)' : 'var(--dim)';
  }
}

/* ═══════════════════════════════════════════
   SELECT ALL / NONE
   ═══════════════════════════════════════════ */
function _spoofSelectAll() {
  if (!_spoofDeviceId) { showToast('Select a device first', 'SPOOF', 'warn', '⚠', 1800); return; }
  document.querySelectorAll('.spoof-game-item[data-pkg]').forEach(item => {
    _spoofChecked[item.dataset.pkg] = _spoofPkgMode;
  });
  _renderGameList(_spoofSearchQ);
  _updateWriteBtn(); _updateSpoofMetrics(); _updateJsonPreview();
}

function _spoofSelectNone() {
  _spoofChecked = {};
  _renderGameList(_spoofSearchQ);
  _updateWriteBtn(); _updateSpoofMetrics(); _updateJsonPreview();
}

/* ═══════════════════════════════════════════
   BUILD COPG.JSON
   ═══════════════════════════════════════════ */
function _buildCopgJson() {
  if (!_spoofDeviceId || !_spoofDeviceData) return null;
  const key = _spoofDeviceId;

  const blEl  = document.getElementById('cpu-blacklist-input');
  const cpoEl = document.getElementById('cpu-only-input');
  const blacklist      = (blEl?.value  || '').split('\n').map(s => s.trim()).filter(Boolean);
  const cpu_only_pkgs  = (cpoEl?.value || '').split('\n').map(s => s.trim()).filter(Boolean);

  return {
    cpu_spoof: { blacklist, cpu_only_packages: cpu_only_pkgs },
    [`PACKAGES_${key}`]: Object.entries(_spoofChecked).map(([p, m]) => `${p}:${m}`),
    [`PACKAGES_${key}_DEVICE`]: {
      BRAND:        _spoofDeviceData.brand,
      DEVICE:       _spoofDeviceData.device,
      MANUFACTURER: _spoofDeviceData.manufacturer,
      MODEL:        _spoofDeviceData.model,
      FINGERPRINT:  _spoofDeviceData.fingerprint,
      PRODUCT:      _spoofDeviceData.product
    }
  };
}

function _updateJsonPreview() {
  const el = document.getElementById('spoof-json-preview');
  if (!el) return;
  const out = _buildCopgJson();
  el.textContent = out ? JSON.stringify(out, null, 2) : '← Select device & games first';
}

/* ═══════════════════════════════════════════
   WRITE COPG.JSON TO DEVICE
   ═══════════════════════════════════════════ */
async function _writeCopgJson() {
  const out = _buildCopgJson();
  if (!out) { showToast('Select a device and games first', 'SPOOF', 'warn', '⚠'); return; }

  const json    = JSON.stringify(out, null, 2);
  const escaped = json.replace(/\\/g, '\\\\').replace(/'/g, "'\\''");

  setStatus('💾 Writing COPG.json…', 'var(--a)');
  await exec(`cp ${COPG_JSON_PATH} ${COPG_JSON_PATH}.bak 2>/dev/null`);

  const result = await exec(
    `printf '%s' '${escaped}' > ${COPG_JSON_PATH}` +
    ` && chmod 0644 ${COPG_JSON_PATH}` +
    ` && chcon u:object_r:system_file:s0 ${COPG_JSON_PATH} 2>/dev/null` +
    ` && echo OK`
  );

  const n = Object.keys(_spoofChecked).length;
  if (result.trim() === 'OK') {
    _setSpoofRibbon('ok',
      `✅ Zygisk config live — ${_spoofDeviceData.device} · ${n} app(s)`, '✅');
    showToast(`${n} app(s) will spoof as ${_spoofDeviceData.device}`, 'WRITTEN', 'success', '🎭');
    setStatus(`✅ COPG.json → ${_spoofDeviceData.device}`, 'var(--a)');
    _updateSpoofMetricStatus('ACTIVE');
  } else {
    _setSpoofRibbon('warn', '⚠ Write failed — check module path/permissions', '⚠');
    showToast('Failed to write COPG.json', 'SPOOF', 'error', '✕');
    setStatus('✕ Write failed', '#ff4450');
    _updateSpoofMetricStatus('ERROR');
  }
  _updateSpoofMetrics();
}

/* ═══════════════════════════════════════════
   RESET
   ═══════════════════════════════════════════ */
async function _resetCopgJson() {
  const res = await exec(
    `if [ -f ${COPG_JSON_PATH}.bak ]; ` +
    `then mv ${COPG_JSON_PATH}.bak ${COPG_JSON_PATH} && echo RESTORED; ` +
    `else echo NOBAK; fi`
  );
  showToast(
    res.trim() === 'RESTORED' ? 'COPG.json restored from backup' : 'No backup found',
    'RESET', res.trim() === 'RESTORED' ? 'info' : 'warn', '🔄'
  );
  document.querySelectorAll('.spoof-card').forEach(c => c.classList.remove('spoof-card--active'));
  _spoofDeviceId = null; _spoofDeviceData = null; _spoofChecked = {};
  _spoofSearchQ  = '';
  const se = document.getElementById('spoof-game-search');
  if (se) se.value = '';
  const ce = document.getElementById('spoof-game-search-clear');
  if (ce) ce.hidden = true;
  const metDev = document.getElementById('spoof-metric-device');
  if (metDev) metDev.textContent = '—';
  _renderGameList();
  _updateWriteBtn(); _updateSpoofMetrics(); _updateJsonPreview();
  _setSpoofRibbon('', 'No config written — Zygisk using existing COPG.json', '📝');
  _updateSpoofMetricStatus('—');
}

/* ═══════════════════════════════════════════
   CPU SPOOF TOGGLE
   ═══════════════════════════════════════════ */
function _toggleCpuSpoof() {
  const btn   = document.getElementById('btn-cpu-spoof');
  const label = document.getElementById('cpu-spoof-label');
  const on    = btn?.getAttribute('aria-pressed') !== 'true';
  btn?.setAttribute('aria-pressed', String(on));
  if (label) label.textContent = on ? 'ON' : 'OFF';
  exec(on
    ? `chmod 0444 /data/adb/modules/COPG/cpuinfo_spoof 2>/dev/null`
    : `chmod 0644 /data/adb/modules/COPG/cpuinfo_spoof 2>/dev/null`
  );
  showToast(`CPU info spoof ${on ? 'enabled' : 'disabled'}`, 'CPU SPOOF', on ? 'success' : 'warn', on ? '🔒' : '🔓', 2000);
  _updateSpoofMetrics(); _updateJsonPreview();
}

/* ═══════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════ */
function _setSpoofRibbon(type, text, icon) {
  const ribbon = document.getElementById('spoof-status-ribbon');
  const ribTxt = document.getElementById('spoof-ribbon-text');
  const ribIco = document.getElementById('spoof-ribbon-icon');
  if (!ribbon) return;
  ribbon.classList.remove('ribbon-ok', 'ribbon-warn');
  if (type) ribbon.classList.add('ribbon-' + type);
  if (ribTxt) ribTxt.textContent = text;
  if (ribIco) ribIco.textContent = icon;
}

function _updateWriteBtn() {
  const btn = document.getElementById('btn-spoof-write');
  if (btn) btn.disabled = !_spoofDeviceId;
}

function _updateSpoofMetricStatus(s) {
  const el = document.getElementById('spoof-metric-status');
  if (!el) return;
  el.textContent = s;
  el.style.color = ({ACTIVE:'var(--a)', LOADED:'#60cfff', ERROR:'#ff4450'})[s] || '';
}

function _updateSpoofMetrics() {
  const setM = (id, val, col) => {
    const e = document.getElementById(id); if (!e) return;
    e.textContent = val; e.style.color = col || '';
  };
  const n     = Object.keys(_spoofChecked).length;
  const cpuOn = document.getElementById('btn-cpu-spoof')?.getAttribute('aria-pressed') === 'true';
  setM('spoof-metric-games', String(n),            n > 0 ? 'var(--a)' : 'var(--dim)');
  setM('spoof-metric-cpu',   cpuOn ? 'ON' : 'OFF', cpuOn ? 'var(--a)' : '#ff4450');
}

/* ═══════════════════════════════════════════
   INIT
   ═══════════════════════════════════════════ */
function initDeviceSpoofPanel() {

  /* Render the full game list immediately from builtin DB —
     no bridge, no device selection needed yet */
  _renderGameList('');

  /* Device cards */
  document.querySelectorAll('.spoof-card').forEach(card => {
    card.addEventListener('click', () => _selectSpoofDevice(card), { passive: true });
  });

  /* Action buttons */
  document.getElementById('btn-spoof-write') ?.addEventListener('click', _writeCopgJson);
  document.getElementById('btn-spoof-reload')?.addEventListener('click', _loadSpoofDatabases);
  document.getElementById('btn-spoof-reset') ?.addEventListener('click', _resetCopgJson);

  /* Select all / none */
  document.getElementById('btn-spoof-selall') ?.addEventListener('click', _spoofSelectAll);
  document.getElementById('btn-spoof-selnone')?.addEventListener('click', _spoofSelectNone);

  /* Mode bar */
  document.querySelectorAll('.spoof-mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.spoof-mode-btn').forEach(b => b.classList.remove('spoof-mode-btn--active'));
      btn.classList.add('spoof-mode-btn--active');
      _spoofPkgMode = btn.dataset.mode;
    });
  });

  /* CPU spoof toggle */
  document.getElementById('btn-cpu-spoof')?.addEventListener('click', _toggleCpuSpoof);

  /* Search — works immediately against builtin DB */
  const searchEl = document.getElementById('spoof-game-search');
  const clearEl  = document.getElementById('spoof-game-search-clear');

  searchEl?.addEventListener('input', () => {
    _spoofSearchQ = searchEl.value.trim();
    if (clearEl) clearEl.hidden = !_spoofSearchQ;
    _renderGameList(_spoofSearchQ);   /* always renders, device=optional */
  });

  clearEl?.addEventListener('click', () => {
    if (searchEl) searchEl.value = '';
    _spoofSearchQ = '';
    clearEl.hidden = true;
    _renderGameList('');
  });

  /* CPU option textareas → live preview */
  ['cpu-only-input', 'cpu-blacklist-input'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', _updateJsonPreview);
  });

  /* Render builtin DB immediately so search works before bridge */
  _renderGameList('');

  /* Load real device data (installed apps, COPG.json) after bridge */
  _loadSpoofDatabases();
}

/* ═══════════════════════════════════════════════════════════
   § FEATURES — RemoveLimit + Animation Android 14
   ═══════════════════════════════════════════════════════════ */

/* ── Features applied-state tracking ── */
let removeLimitApplied = false;
let animationApplied   = false;

function renderRemoveLimitState() {
  const btn     = document.getElementById('btn-toggle-removelimit');
  const lbl     = document.getElementById('removelimit-toggle-label');
  const ribbon  = document.getElementById('removelimit-ribbon');
  const ribIcon = document.getElementById('removelimit-ribbon-icon');
  const ribTxt  = document.getElementById('removelimit-ribbon-text');
  const m = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  btn?.setAttribute('aria-pressed', removeLimitApplied ? 'true' : 'false');
  btn?.classList.toggle('feat-applied', removeLimitApplied);
  if (lbl)     lbl.textContent = removeLimitApplied ? 'ON' : 'OFF';
  if (ribbon)  ribbon.classList.toggle('ribbon-applied', removeLimitApplied);
  if (ribIcon) ribIcon.textContent = removeLimitApplied ? '✅' : '📋';
  if (ribTxt)  ribTxt.textContent  = removeLimitApplied
    ? 'Remove Limit ACTIVE — 120Hz forced in all system modes'
    : 'Not applied — all modes using system refresh rate defaults';
  m('rl-m-screen', removeLimitApplied ? '120Hz'   : 'DEFAULT');
  m('rl-m-float',  removeLimitApplied ? '120Hz'   : 'DEFAULT');
  m('rl-m-split',  removeLimitApplied ? '120Hz'   : 'DEFAULT');
  m('rl-m-fps',    removeLimitApplied ? 'REMOVED' : 'ENABLED');
}

function renderAnimationState() {
  const btn     = document.getElementById('btn-toggle-animation');
  const lbl     = document.getElementById('animation-toggle-label');
  const ribbon  = document.getElementById('animation-ribbon');
  const ribIcon = document.getElementById('animation-ribbon-icon');
  const ribTxt  = document.getElementById('animation-ribbon-text');
  const m = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  btn?.setAttribute('aria-pressed', animationApplied ? 'true' : 'false');
  btn?.classList.toggle('feat-applied', animationApplied);
  if (lbl)     lbl.textContent = animationApplied ? 'ON' : 'OFF';
  if (ribbon)  ribbon.classList.toggle('ribbon-applied', animationApplied);
  if (ribIcon) ribIcon.textContent = animationApplied ? '✅' : '🎞';
  if (ribTxt)  ribTxt.textContent  = animationApplied
    ? 'Animation Fix ACTIVE — HiOS engine restored · blur disabled'
    : 'Not applied — system animation engine in effect';
  m('an-m-open',   animationApplied ? 'MODE 3'    : 'DEFAULT');
  m('an-m-launch', animationApplied ? 'ON'         : 'DEFAULT');
  m('an-m-blur',   animationApplied ? 'DISABLED'   : 'ENABLED');
  m('an-m-scale',  '1.0×');
}

function initFeaturesModal() {
  /* ── LOAD button → apply saved boot config ── */
  document.getElementById('btn-load-config')?.addEventListener('click', loadAllConfig, { passive: true });

  /* ── Toggle buttons: ON fires apply, OFF fires revert ── */
  document.getElementById('btn-toggle-removelimit')?.addEventListener('click', () => {
    if (!removeLimitApplied) {
      document.getElementById('btn-apply-removelimit')?.click();
    } else {
      revertRemoveLimit();
    }
  });
  document.getElementById('btn-toggle-animation')?.addEventListener('click', () => {
    if (!animationApplied) {
      document.getElementById('btn-apply-animation')?.click();
    } else {
      revertAnimation();
    }
  });

  /* ── Apply Remove Limit ── */
  document.getElementById('btn-apply-removelimit')?.addEventListener('click', async () => {
    const st = document.getElementById('removelimit-status');
    if (st) { st.textContent = '⏳ Applying…'; st.style.color = '#ffcc00'; }
    showToast('Applying Remove Limit props…', 'FEATURES', 'info', '⚡');

    const props = [
      ['persist.sys.apm.screen_record',         '120'],
      ['persist.sys.apm.float_window',           '120'],
      ['persist.sys.apm.split_screen',           '120'],
      ['persist.sys.apm.default_refresh_rate',   '120'],
      ['persist.sys.apm.force_high_refresh_rate','1'],
      ['persist.sys.apm.video_switch',           '0'],
      ['debug.graphics.disable_default_fps_limit','1'],
      ['ro.vendor.display.screen_record_fps',    '120'],
      ['persist.vendor.display.screen_record_fps','120'],
      ['vendor.display.screen_record_fps',       '120'],
    ];
    const cmds = props.map(([k, v]) => `resetprop "${k}" "${v}" 2>/dev/null || setprop "${k}" "${v}" 2>/dev/null`);
    const jsonContent = JSON.stringify({
      major_version:2, minor_version:1000, update_time:20240101,
      input_method_switch:true, navigation_switch:true, video_switch:false, audio_switch:true,
      high_temperature_threshold:500, high_temperature_refresh_rate:120,
      camera_notification_high_temerature_switch:false, high_temperature_white_list_switch:false,
      multi_window_refresh_rate:120, screen_record:120, float_window_refresh_rate:120,
      split_screen_refresh_rate:120, default_refresh_rate:120, game_refresh_rate:120,
      force_high_refresh_rate:true
    });
    const jsonPaths = [
      '/system/etc/apm/config/refresh_rate_switch_config.json',
      '/system/product/apm/config/refresh_rate_switch_config.json',
      '/system/system_ext/apm/config/refresh_rate_switch_config.json',
      '/system/vendor/etc/apm/config/refresh_rate_switch_config.json',
    ];
    const jsonCmd = jsonPaths
      .map(p => `mkdir -p "$(dirname '${p}')" && echo '${jsonContent.replace(/'/g,"'\\''")}' > '${p}' 2>/dev/null`)
      .join('; ');

    await execAll(...cmds);
    await exec(jsonCmd, 8000);
    await exec(`mkdir -p "${CFG_DIR}" && echo "applied" > "${CFG_DIR}/removelimit_state"`);

    removeLimitApplied = true;
    renderRemoveLimitState();
    if (st) { st.textContent = '✓ Applied — reboot may be needed'; st.style.color = 'var(--a)'; }
    showToast('Remove Limit applied — 120Hz unlocked in all modes', 'FEATURES', 'success', '✓');
    setStatus('✓ Remove Limit applied', 'var(--a)');
  });

  /* ── Apply Animation Android 14 ── */
  document.getElementById('btn-apply-animation')?.addEventListener('click', async () => {
    const st = document.getElementById('animation-status');
    if (st) { st.textContent = '⏳ Applying…'; st.style.color = '#ffcc00'; }
    showToast('Applying animation props…', 'FEATURES', 'info', '🎞');

    const resetProps = [
      ['ro.keyguard_light_on_off_screen_anim',      '2'],
      ['ro.transsion_remote_anim_support',           '0'],
      ['ro.transsion_launch_start_exit_support',     '3'],
      ['ro.transsion_unlock_mode_support',           '3'],
      ['ro.tran.effectengine.dynamicblur.support',   '1'],
      ['ro.surface_flinger.supports_background_blur','0'],
      ['ro.tran.launch_animation',                   '1'],
      ['ro.tran.exit_animation',                     '1'],
      ['ro.tran.open_close_animation',               '3'],
      ['ro.tran.window_animation_scale',             '1'],
      ['ro.transsion_anim_support',                  '1'],
      ['ro.transsion_launch_anim_enable',            '1'],
      ['ro.transsion_exit_anim_enable',              '1'],
      ['ro.transsion_unlock_anim_enable',            '1'],
      ['ro.hios.animation.open_close',               '1'],
      ['ro.hios.animation.launch',                   '1'],
      ['ro.hios.animation.exit',                     '1'],
      ['ro.hios.animation.unlock',                   '1'],
      ['ro.hios.ui.blur_disable',                    '1'],
      ['ro.hios.transition_animation',               '3'],
      ['ro.config.animation_enable',                 '1'],
      ['persist.sys.ui.hw',                          '1'],
      ['persist.sys.scrollingcache',                 '3'],
      ['ro.surface_flinger.max_frame_buffer_acquired_buffers','3'],
      ['debug.sf.recomputecrop',                     '0'],
      ['debug.sf.disable_backpressure',              '1'],
    ];
    const cmds = resetProps.map(([k, v]) => `resetprop "${k}" "${v}" 2>/dev/null`);
    const settingsCmds = [
      'settings put global window_animation_scale 1.0',
      'settings put global transition_animation_scale 1.0',
      'settings put global animator_duration_scale 1.0',
      'settings put global disable_window_blurs 1 2>/dev/null',
    ];

    await execAll(...cmds, ...settingsCmds);
    await exec(`mkdir -p "${CFG_DIR}" && echo "applied" > "${CFG_DIR}/animation_state"`);

    animationApplied = true;
    renderAnimationState();
    if (st) { st.textContent = '✓ Applied — effects active immediately'; st.style.color = 'var(--a)'; }
    showToast('Animation props applied — transitions restored', 'FEATURES', 'success', '🎞');
    setStatus('✓ Animation fix applied', 'var(--a)');
  });

  /* ── Revert Remove Limit ── */
  async function revertRemoveLimit() {
    const st = document.getElementById('removelimit-status');
    if (st) { st.textContent = '⏳ Reverting…'; st.style.color = '#ffcc00'; }
    showToast('Reverting Remove Limit…', 'FEATURES', 'info', '🔄');

    const revertProps = [
      ['persist.sys.apm.screen_record',          ''],
      ['persist.sys.apm.float_window',            ''],
      ['persist.sys.apm.split_screen',            ''],
      ['persist.sys.apm.default_refresh_rate',    ''],
      ['persist.sys.apm.force_high_refresh_rate', ''],
      ['persist.sys.apm.video_switch',            ''],
      ['debug.graphics.disable_default_fps_limit','0'],
      ['ro.vendor.display.screen_record_fps',     ''],
      ['persist.vendor.display.screen_record_fps',''],
      ['vendor.display.screen_record_fps',        ''],
    ];
    const cmds = revertProps.map(([k, v]) =>
      v === ''
        ? `resetprop --delete "${k}" 2>/dev/null; setprop "${k}" "" 2>/dev/null`
        : `resetprop "${k}" "${v}" 2>/dev/null || setprop "${k}" "${v}" 2>/dev/null`
    );

    const jsonPaths = [
      '/system/etc/apm/config/refresh_rate_switch_config.json',
      '/system/product/apm/config/refresh_rate_switch_config.json',
      '/system/system_ext/apm/config/refresh_rate_switch_config.json',
      '/system/vendor/etc/apm/config/refresh_rate_switch_config.json',
    ];
    const rmCmd = jsonPaths.map(p => `rm -f '${p}' 2>/dev/null`).join('; ');

    await execAll(...cmds);
    await exec(rmCmd, 4000);
    await exec(`mkdir -p "${CFG_DIR}" && echo "disabled" > "${CFG_DIR}/removelimit_state"`);

    removeLimitApplied = false;
    renderRemoveLimitState();
    if (st) { st.textContent = '✓ Reverted — reboot to fully reset'; st.style.color = 'var(--dim)'; }
    showToast('Remove Limit disabled — reboot to fully reset', 'FEATURES', 'warn', '🔄');
    setStatus('✓ Remove Limit reverted', 'var(--dim)');
  }

  /* ── Revert Animation Fix ── */
  async function revertAnimation() {
    const st = document.getElementById('animation-status');
    if (st) { st.textContent = '⏳ Reverting…'; st.style.color = '#ffcc00'; }
    showToast('Reverting Animation Fix…', 'FEATURES', 'info', '🔄');

    const revertProps = [
      ['ro.keyguard_light_on_off_screen_anim',       ''],
      ['ro.transsion_remote_anim_support',            ''],
      ['ro.transsion_launch_start_exit_support',      ''],
      ['ro.transsion_unlock_mode_support',            ''],
      ['ro.tran.effectengine.dynamicblur.support',    ''],
      ['ro.surface_flinger.supports_background_blur', '1'],
      ['ro.tran.launch_animation',                    ''],
      ['ro.tran.exit_animation',                      ''],
      ['ro.tran.open_close_animation',                ''],
      ['ro.tran.window_animation_scale',              ''],
      ['ro.transsion_anim_support',                   ''],
      ['ro.transsion_launch_anim_enable',             ''],
      ['ro.transsion_exit_anim_enable',               ''],
      ['ro.transsion_unlock_anim_enable',             ''],
      ['ro.hios.animation.open_close',                ''],
      ['ro.hios.animation.launch',                    ''],
      ['ro.hios.animation.exit',                      ''],
      ['ro.hios.animation.unlock',                    ''],
      ['ro.hios.ui.blur_disable',                     '0'],
      ['ro.hios.transition_animation',                ''],
      ['ro.config.animation_enable',                  ''],
      ['persist.sys.ui.hw',                           ''],
      ['persist.sys.scrollingcache',                  ''],
      ['ro.surface_flinger.max_frame_buffer_acquired_buffers', ''],
      ['debug.sf.recomputecrop',                      ''],
      ['debug.sf.disable_backpressure',               ''],
    ];
    const cmds = revertProps.map(([k, v]) =>
      v === ''
        ? `resetprop --delete "${k}" 2>/dev/null; setprop "${k}" "" 2>/dev/null`
        : `resetprop "${k}" "${v}" 2>/dev/null || setprop "${k}" "${v}" 2>/dev/null`
    );
    const settingsCmds = [
      'settings delete global window_animation_scale 2>/dev/null',
      'settings delete global transition_animation_scale 2>/dev/null',
      'settings delete global animator_duration_scale 2>/dev/null',
      'settings delete global disable_window_blurs 2>/dev/null',
    ];

    await execAll(...cmds, ...settingsCmds);
    await exec(`mkdir -p "${CFG_DIR}" && echo "disabled" > "${CFG_DIR}/animation_state"`);

    animationApplied = false;
    renderAnimationState();
    if (st) { st.textContent = '✓ Reverted — reboot to fully reset'; st.style.color = 'var(--dim)'; }
    showToast('Animation Fix disabled — reboot to fully reset', 'FEATURES', 'warn', '🔄');
    setStatus('✓ Animation fix reverted', 'var(--dim)');
  }

  /* ── Restore saved states (wait for bridge to be available) ── */
  async function restoreFeatureColors() {
    await waitForBridge(8000);
    const [rlRaw, anRaw] = await execAll(
      `cat "${CFG_DIR}/removelimit_state" 2>/dev/null`,
      `cat "${CFG_DIR}/animation_state" 2>/dev/null`
    );
    removeLimitApplied = rlRaw.trim() === 'applied';
    animationApplied   = anRaw.trim() === 'applied';
    renderRemoveLimitState();
    renderAnimationState();
  }
  restoreFeatureColors();
}



/* ═══════════════════════════════════════════════════════════
   § COOL MODE — GPU Power + EEM Extended + Schedutil
   ═══════════════════════════════════════════════════════════ */

const COOL_MODE_CFG    = `${CFG_DIR}/cool_mode_state`;
const COOL_MODE_SCRIPT = `${MOD}/script_runner/cool_mode`;

let coolModeEnabled = false;

function renderCoolModeState() {
  const btn   = document.getElementById('btn-cool-mode');
  const label = document.getElementById('cool-mode-label');
  btn?.setAttribute('aria-pressed', String(coolModeEnabled));
  btn?.classList.toggle('gaming-toggle-btn--on', coolModeEnabled);
  if (label) label.textContent = coolModeEnabled ? 'ON' : 'OFF';
}

async function applyCoolMode(enable) {
  setStatus(enable ? '❄️ Cool Mode: applying…' : '❄️ Cool Mode: reverting…', 'var(--a)');

  const action = enable ? 'enable' : 'disable';
  await exec(`chmod 755 "${COOL_MODE_SCRIPT}" 2>/dev/null && sh "${COOL_MODE_SCRIPT}" ${action}`, 10000);

  coolModeEnabled = enable;
  await exec(`mkdir -p ${CFG_DIR} && echo '${enable ? 'enabled' : 'disabled'}' > ${COOL_MODE_CFG}`);

  if (enable) {
    if (cpuVoltEnabled) {
      showToast('Cool Mode ON · GPU + Schedutil tuned (EEM CPU skipped — CPU Volt active)', 'COOL MODE', 'info', '❄️');
    } else {
      showToast('Cool Mode ON · GPU + EEM + Schedutil tuned', 'COOL MODE', 'info', '❄️');
    }
    setStatus('❄️ Cool Mode ACTIVE — less heat, same performance', 'var(--a)');
  } else {
    showToast('Cool Mode OFF · defaults restored', 'COOL MODE', 'info', '❄️');
    setStatus('Cool Mode disabled', '');
  }

  renderCoolModeState();
  autoSave();
}

function initCoolMode() {
  document.getElementById('btn-cool-mode')?.addEventListener('click', () => {
    applyCoolMode(!coolModeEnabled);
  });

  // Restore saved state on load
  waitForBridge(8000).then(() =>
    exec(`cat ${COOL_MODE_CFG} 2>/dev/null`).then(raw => {
      if (raw.trim() === 'enabled') {
        coolModeEnabled = true;
        renderCoolModeState();
        // Re-apply on load since GED/schedutil nodes reset on reboot
        applyCoolMode(true);
      }
    })
  );
}

/* ═══════════════════════════════════════════════════════════
   § CPU VOLTS OPTIMIZER — MTK EEM offset tuning
   Reduces voltage on all CPU clusters via /proc/eem nodes.
   Values: Prime/Big/Little = -12, CCI = -8
   ═══════════════════════════════════════════════════════════ */

const CPUVOLT_CFG = `${CFG_DIR}/cpuvolt_enabled`;
const EEM_BASE    = '/proc/eem';

const CPUVOLT_OFFSETS = [
  { node: 'EEM_DET_B',   val: '-12', id: 'cpuvolt-b-val'   },
  { node: 'EEM_DET_BL',  val: '-12', id: 'cpuvolt-bl-val'  },
  { node: 'EEM_DET_L',   val: '-12', id: 'cpuvolt-l-val'   },
  { node: 'EEM_DET_CCI', val: '-8',  id: 'cpuvolt-cci-val' },
];

let cpuVoltEnabled = false;

function renderCpuVoltState() {
  const btn   = document.getElementById('btn-cpuvolt-toggle');
  const label = document.getElementById('cpuvolt-label');
  btn?.setAttribute('aria-pressed', String(cpuVoltEnabled));
  btn?.classList.toggle('gaming-toggle-btn--on', cpuVoltEnabled);
  if (label) label.textContent = cpuVoltEnabled ? 'ON' : 'OFF';
  CPUVOLT_OFFSETS.forEach(o => {
    const el = document.getElementById(o.id);
    if (el) {
      el.textContent = cpuVoltEnabled ? o.val : '0';
      el.style.color = cpuVoltEnabled ? 'var(--a)' : 'var(--dim)';
    }
  });
}

async function applyCpuVolt(enable) {
  if (enable) {
    const cmds = CPUVOLT_OFFSETS.map(o =>
      `echo '${o.val}' > ${EEM_BASE}/${o.node}/eem_offset 2>/dev/null`
    ).join(' && ');
    await exec(`${cmds}`);
    await exec(`mkdir -p ${CFG_DIR} && echo '1' > ${CPUVOLT_CFG}`);
    cpuVoltEnabled = true;
    showToast('CPU Volts optimized · heat & battery improved', 'CPU VOLTS', 'success', '⚡');
    setStatus('⚡ CPU Volts Optimizer ON', 'var(--a)');
  } else {
    const cmds = CPUVOLT_OFFSETS.map(o =>
      `echo '0' > ${EEM_BASE}/${o.node}/eem_offset 2>/dev/null`
    ).join(' && ');
    await exec(`${cmds}`);
    await exec(`mkdir -p ${CFG_DIR} && echo '0' > ${CPUVOLT_CFG}`);
    cpuVoltEnabled = false;
    showToast('CPU Volts reset to default', 'CPU VOLTS', 'info', '⚡');
    setStatus('⚡ CPU Volts Optimizer OFF', '');
  }
  renderCpuVoltState();
}

function initCpuVoltOptimizer() {
  document.getElementById('btn-cpuvolt-toggle')?.addEventListener('click', () => {
    applyCpuVolt(!cpuVoltEnabled);
  });

  // Restore saved state
  waitForBridge(8000).then(() =>
    exec(`cat ${CPUVOLT_CFG} 2>/dev/null`).then(raw => {
      if (raw.trim() === '1') {
        // Re-apply offsets on load (resets on reboot)
        applyCpuVolt(true);
      }
    })
  );
}

/* ═══════════════════════════════════════════════════════════
   § PYROX THERMAL — integrated into Thermal Status Monitor
   ═══════════════════════════════════════════════════════════ */

let pyroxEnabled = false;

function renderPyroxState() {
  const btn    = document.getElementById('btn-pyrox-thermal');
  const label  = document.getElementById('pyrox-thermal-label');
  const ribbon = document.getElementById('pyrox-status-ribbon');
  const ribIcon= document.getElementById('pyrox-ribbon-icon');
  const ribTxt = document.getElementById('pyrox-ribbon-text');

  btn?.setAttribute('aria-pressed', pyroxEnabled ? 'true' : 'false');
  if (label) label.textContent = pyroxEnabled ? 'ON' : 'OFF';

  if (ribbon) ribbon.classList.toggle('ribbon-danger', pyroxEnabled);
  if (ribIcon) ribIcon.textContent = pyroxEnabled ? '🔥' : '🛡';
  if (ribTxt) ribTxt.textContent = pyroxEnabled
    ? 'Pyrox ACTIVE — 125°C limit · thermal services stopped · GPU limits removed'
    : 'Pyrox thermal engine inactive — system throttling in effect';

  const setM = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  setM('pyrox-svc-status',   pyroxEnabled ? 'STOPPED'  : 'RUNNING');
  setM('pyrox-ppm-status',   pyroxEnabled ? 'DISABLED' : 'ACTIVE');
  setM('pyrox-gpu-status',   pyroxEnabled ? 'UNLOCKED' : 'ENFORCED');
  setM('pyrox-tzcpu-status', pyroxEnabled ? '125°C'    : 'DEFAULT');
  setM('pyrox-cpu-status',   pyroxEnabled ? 'LIFTED'   : 'NORMAL');
  setM('pyrox-zones-status', pyroxEnabled ? 'DISABLED' : 'ENABLED');

  // ── Update Thermal Status Monitor (section 02) to reflect Pyrox state ──
  const thermStateLabel = document.getElementById('therm-state-label');
  const thermRingInner  = document.getElementById('therm-ring-inner');
  const thermDot        = document.getElementById('hdi-therm-dot');
  const thermVal        = document.getElementById('hsi-therm');
  const thermSource     = document.getElementById('therm-source');

  if (pyroxEnabled) {
    if (thermStateLabel) { thermStateLabel.textContent = 'DISABLED'; thermStateLabel.className = 'therm-state off'; }
    if (thermRingInner)  thermRingInner.classList.add('off');
    if (thermDot)        thermDot.classList.add('dot-danger');
    if (thermVal)        thermVal.textContent = 'PYROX ACTIVE';
    if (thermSource)     thermSource.textContent = 'pyrox-engine · throttling suspended';
  } else {
    // Only reset label if gaming thermal is also not disabled
    const gamingOff = typeof gamingThermalDisabled !== 'undefined' && gamingThermalDisabled;
    if (!gamingOff) {
      if (thermStateLabel) { thermStateLabel.textContent = 'ACTIVE'; thermStateLabel.className = 'therm-state'; }
      if (thermRingInner)  thermRingInner.classList.remove('off');
      if (thermDot)        thermDot.classList.remove('dot-danger');
      if (thermVal)        thermVal.textContent = 'NORMAL';
      if (thermSource)     thermSource.textContent = 'system thermal · normal limits';
    }
  }
}

async function applyPyroxThermal(enable) {
  setStatus(enable ? '🔥 Pyrox: disabling thermal…' : '🛡 Pyrox: restoring thermal…', 'var(--a)');

  // Delegate all work to thermal_toggle script — it handles lock_val,
  // double-stop for respawning services, Mali GPU nodes, MSM/FPSGO/GPT
  // thermal, resetprop persist props and setprop ctl calls properly.
  const action = enable ? 'disable' : 'enable';
  await exec(`chmod 755 "${THERMAL_SCRIPT}" 2>/dev/null && sh "${THERMAL_SCRIPT}" ${action}`, 15000);

  if (enable) {
    await exec(`mkdir -p "${CFG_DIR}" && echo "pyrox_enabled" > "${CFG_DIR}/pyrox_state"`);
    pyroxEnabled = true;
    showToast('Pyrox ACTIVE — all thermal limits removed', 'PYROX THERMAL', 'warn', '🔥');
    setStatus('🔥 Pyrox thermal engine ACTIVE', 'var(--a)');
  } else {
    await exec(`mkdir -p "${CFG_DIR}" && echo "pyrox_disabled" > "${CFG_DIR}/pyrox_state"`);
    pyroxEnabled = false;
    showToast('Pyrox disabled — thermal protection restored', 'PYROX THERMAL', 'success', '🛡');
    setStatus('🛡 Pyrox disabled — thermal active', 'var(--a)');
  }

  renderPyroxState();
}

function initPyroxThermal() {
  document.getElementById('btn-pyrox-thermal')?.addEventListener('click', () => {
    applyPyroxThermal(!pyroxEnabled);
  });

  // Restore saved state (wait for bridge)
  waitForBridge(8000).then(() =>
    exec(`cat "${CFG_DIR}/pyrox_state" 2>/dev/null`).then(raw => {
      pyroxEnabled = raw.trim() === 'pyrox_enabled';
      renderPyroxState();
    })
  );
}


/* ═══════════════════════════════════════════════════════════
   § STORM GUARD · Bootloop Protector
   ═══════════════════════════════════════════════════════════ */

let stormGuardApplied = false;

function renderStormGuardState() {
  const btn     = document.getElementById('btn-toggle-stormguard');
  const lbl     = document.getElementById('stormguard-toggle-label');
  const ribbon  = document.getElementById('stormguard-ribbon');
  const ribIcon = document.getElementById('stormguard-ribbon-icon');
  const ribTxt  = document.getElementById('stormguard-ribbon-text');
  const m = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };

  btn?.setAttribute('aria-pressed', stormGuardApplied ? 'true' : 'false');
  btn?.classList.toggle('feat-applied', stormGuardApplied);
  if (lbl)     lbl.textContent = stormGuardApplied ? 'ON' : 'OFF';
  if (ribbon)  ribbon.classList.toggle('ribbon-applied', stormGuardApplied);
  if (ribIcon) ribIcon.textContent = stormGuardApplied ? '✅' : '🛡';
  if (ribTxt)  ribTxt.textContent  = stormGuardApplied
    ? 'Storm Guard ACTIVE — bootloop protection monitoring enabled'
    : 'Not active — bootloop protection disabled';

  m('sg-m-trigger', '3 BOOTS');
  m('sg-m-reset',   '30s STABLE');
  m('sg-m-status',  stormGuardApplied ? 'ACTIVE' : 'INACTIVE');

  // Read live boot count
  if (stormGuardApplied) {
    exec('cat /data/local/tmp/stormguard_boot_count 2>/dev/null').then(r => {
      m('sg-m-count', r.trim() || '0');
    });
  } else {
    m('sg-m-count', '—');
  }
}

function initStormGuard() {
  const MODDIR  = '/data/adb/modules/GovThermal';
  const SG_DIR  = `${MODDIR}/stormguard`;
  const SG_STATE = `${CFG_DIR}/stormguard_state`;

  document.getElementById('btn-toggle-stormguard')?.addEventListener('click', () => {
    if (!stormGuardApplied) {
      applyStormGuard();
    } else {
      revertStormGuard();
    }
  });

  async function applyStormGuard() {
    const st = document.getElementById('stormguard-status');
    if (st) { st.textContent = '⏳ Enabling…'; st.style.color = '#ffcc00'; }
    showToast('Enabling Storm Guard bootloop protection…', 'STORM GUARD', 'info', '🛡');

    // Write post-fs-data script that implements bootloop counting
    const postFsScript = [
      '#!/system/bin/sh',
      '# StormGuard - Bootloop Protection',
      'BOOT_COUNT_FILE="/data/local/tmp/stormguard_boot_count"',
      'MODULES_DIR="/data/adb/modules"',
      'if [ ! -f "$BOOT_COUNT_FILE" ]; then',
      '  echo 1 > "$BOOT_COUNT_FILE"',
      'else',
      '  count=$(cat "$BOOT_COUNT_FILE")',
      '  count=$((count + 1))',
      '  echo "$count" > "$BOOT_COUNT_FILE"',
      '  if [ "$count" -ge 3 ]; then',
      '    for dir in "$MODULES_DIR"/*; do',
      '      [ "$(basename "$dir")" = "GovThermal" ] && continue',
      '      touch "$dir/disable"',
      '    done',
      '  fi',
      'fi',
    ].join('\n');

    // Write service script that resets counter on stable boot
    const serviceScript = [
      '#!/system/bin/sh',
      '# StormGuard - Reset boot counter after stable boot',
      '(',
      '  sleep 30',
      '  echo 0 > /data/local/tmp/stormguard_boot_count',
      ') &',
    ].join('\n');

    // Install the hooks into our module's own scripts by appending
    const hookFile = `${MODDIR}/stormguard_hook.sh`;

    await exec(
      `mkdir -p /data/local/tmp && ` +
      `[ ! -f /data/local/tmp/stormguard_boot_count ] && echo 0 > /data/local/tmp/stormguard_boot_count; ` +
      `printf '%s\n' ${JSON.stringify(postFsScript)} > ${hookFile}_post && ` +
      `printf '%s\n' ${JSON.stringify(serviceScript)} > ${hookFile}_svc && ` +
      `chmod 755 ${hookFile}_post ${hookFile}_svc 2>/dev/null`,
      4000
    );

    // Append call to hook in our post-fs-data.sh (idempotent)
    await exec(
      `grep -q "stormguard_hook" ${MODDIR}/post-fs-data.sh 2>/dev/null || ` +
      `echo '\n# StormGuard hook\n[ -x "${hookFile}_post" ] && sh "${hookFile}_post"' >> ${MODDIR}/post-fs-data.sh`
    );

    // Append call to hook in service.sh (idempotent)
    await exec(
      `grep -q "stormguard_hook" ${MODDIR}/service.sh 2>/dev/null || ` +
      `echo '\n# StormGuard hook\n[ -x "${hookFile}_svc" ] && sh "${hookFile}_svc"' >> ${MODDIR}/service.sh`
    );

    await exec(`mkdir -p "${CFG_DIR}" && echo "applied" > "${SG_STATE}"`);
    stormGuardApplied = true;
    renderStormGuardState();
    if (st) { st.textContent = '✓ Active — protection starts on next boot'; st.style.color = 'var(--a)'; }
    showToast('Storm Guard enabled — monitors for bootloops on next boot', 'STORM GUARD', 'success', '🛡');
    setStatus('✓ Storm Guard bootloop protection active', 'var(--a)');
  }

  async function revertStormGuard() {
    const st = document.getElementById('stormguard-status');
    if (st) { st.textContent = '⏳ Disabling…'; st.style.color = '#ffcc00'; }
    showToast('Disabling Storm Guard…', 'STORM GUARD', 'info', '🔄');

    const hookFile = `${MODDIR}/stormguard_hook.sh`;

    // Remove hook lines from post-fs-data.sh and service.sh
    await execAll(
      `sed -i '/stormguard_hook/d' ${MODDIR}/post-fs-data.sh 2>/dev/null`,
      `sed -i '/StormGuard hook/d' ${MODDIR}/post-fs-data.sh 2>/dev/null`,
      `sed -i '/stormguard_hook/d' ${MODDIR}/service.sh 2>/dev/null`,
      `sed -i '/StormGuard hook/d' ${MODDIR}/service.sh 2>/dev/null`,
      `rm -f ${hookFile}_post ${hookFile}_svc 2>/dev/null`,
      `echo 0 > /data/local/tmp/stormguard_boot_count 2>/dev/null`
    );

    await exec(`echo "disabled" > "${SG_STATE}"`);
    stormGuardApplied = false;
    renderStormGuardState();
    if (st) { st.textContent = '✓ Disabled — protection removed'; st.style.color = 'var(--dim)'; }
    showToast('Storm Guard disabled', 'STORM GUARD', 'warn', '🔄');
  }

  // Restore saved state (wait for bridge)
  waitForBridge(8000).then(() =>
    exec(`cat "${CFG_DIR}/stormguard_state" 2>/dev/null`).then(r => {
      stormGuardApplied = r.trim() === 'applied';
      renderStormGuardState();
    })
  );
}

/* ═══════════════════════════════════════════════════════════
   § BRUTAL BUSYBOX · v1.38.0.1
   ═══════════════════════════════════════════════════════════ */

let busyboxApplied = false;

function renderBusyboxState() {
  const btn     = document.getElementById('btn-toggle-busybox');
  const lbl     = document.getElementById('busybox-toggle-label');
  const ribbon  = document.getElementById('busybox-ribbon');
  const ribIcon = document.getElementById('busybox-ribbon-icon');
  const ribTxt  = document.getElementById('busybox-ribbon-text');
  const m = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };

  btn?.setAttribute('aria-pressed', busyboxApplied ? 'true' : 'false');
  btn?.classList.toggle('feat-applied', busyboxApplied);
  if (lbl)     lbl.textContent = busyboxApplied ? 'ON' : 'OFF';
  if (ribbon)  ribbon.classList.toggle('ribbon-applied', busyboxApplied);
  if (ribIcon) ribIcon.textContent = busyboxApplied ? '✅' : '📦';
  if (ribTxt)  ribTxt.textContent  = busyboxApplied
    ? 'Brutal Busybox ACTIVE — all applets installed to /system/xbin'
    : 'Not installed — busybox applets unavailable';

  m('bb-m-version', busyboxApplied ? 'v1.38.0.1' : '—');
  m('bb-m-path',    busyboxApplied ? '/system/xbin' : '—');

  if (busyboxApplied) {
    // Live detect arch and applet count
    exec('getprop ro.product.cpu.abi 2>/dev/null').then(abi => {
      const a = abi.trim();
      let arch = '—';
      if (a.includes('arm64'))  arch = 'ARM64';
      else if (a.includes('armeabi')) arch = 'ARM32';
      else if (a.includes('x86_64')) arch = 'x86_64';
      else if (a.includes('x86'))    arch = 'x86';
      m('bb-m-arch', arch);
    });
    exec('busybox --list 2>/dev/null | wc -l').then(r => {
      const n = parseInt(r.trim());
      m('bb-m-applets', isNaN(n) ? '300+' : `${n}`);
    });
  } else {
    m('bb-m-arch',    '—');
    m('bb-m-applets', '—');
  }
}

function initBusybox() {
  const MODDIR   = '/data/adb/modules/GovThermal';
  const BB_STATE = `${CFG_DIR}/busybox_state`;
  const BB_PATH  = `${MODDIR}/system/xbin`;

  document.getElementById('btn-toggle-busybox')?.addEventListener('click', () => {
    if (!busyboxApplied) {
      applyBusybox();
    } else {
      revertBusybox();
    }
  });

  async function applyBusybox() {
    const st = document.getElementById('busybox-status');
    if (st) { st.textContent = '⏳ Installing…'; st.style.color = '#ffcc00'; }
    showToast('Installing Brutal Busybox…', 'BUSYBOX', 'info', '📦');

    // Detect arch and pick the right binary from the module's bundled binaries
    const abi = (await exec('getprop ro.product.cpu.abi 2>/dev/null')).trim();
    let bbSrc = '';
    if      (abi.includes('arm64'))   bbSrc = `${MODDIR}/busybox_bins/busybox8`;
    else if (abi.includes('armeabi')) bbSrc = `${MODDIR}/busybox_bins/busybox7`;
    else if (abi.includes('x86_64')) bbSrc = `${MODDIR}/busybox_bins/busybox64`;
    else                              bbSrc = `${MODDIR}/busybox_bins/busybox86`;

    // Fallback: try system busybox path
    const fallbackInstall = [
      `mkdir -p ${BB_PATH}`,
      `chmod 755 ${BB_PATH}`,
      // If module has busybox binary already (from main module's own busybox), use it
      `if [ -f "${MODDIR}/busybox" ] && [ -x "${MODDIR}/busybox" ]; then`,
      `  cp -f "${MODDIR}/busybox" "${BB_PATH}/busybox"`,
      `  chown 0:0 "${BB_PATH}/busybox"`,
      `  chmod 755 "${BB_PATH}/busybox"`,
      `  chcon u:object_r:system_file:s0 "${BB_PATH}/busybox" 2>/dev/null`,
      `  "${BB_PATH}/busybox" --install -s "${BB_PATH}/"`,
      `elif [ -f "${bbSrc}" ] && [ -x "${bbSrc}" ]; then`,
      `  cp -f "${bbSrc}" "${BB_PATH}/busybox"`,
      `  chown 0:0 "${BB_PATH}/busybox"`,
      `  chmod 755 "${BB_PATH}/busybox"`,
      `  chcon u:object_r:system_file:s0 "${BB_PATH}/busybox" 2>/dev/null`,
      `  "${BB_PATH}/busybox" --install -s "${BB_PATH}/"`,
      `fi`,
    ].join('\n');

    await exec(fallbackInstall, 8000);
    await exec(`mkdir -p "${CFG_DIR}" && echo "applied" > "${BB_STATE}"`);

    busyboxApplied = true;
    renderBusyboxState();
    if (st) { st.textContent = '✓ Installed — busybox applets available'; st.style.color = 'var(--a)'; }
    showToast('Brutal Busybox installed — all applets ready', 'BUSYBOX', 'success', '📦');
    setStatus('✓ Brutal Busybox installed', 'var(--a)');
  }

  async function revertBusybox() {
    const st = document.getElementById('busybox-status');
    if (st) { st.textContent = '⏳ Removing…'; st.style.color = '#ffcc00'; }
    showToast('Removing Busybox applets…', 'BUSYBOX', 'info', '🔄');

    // Remove all busybox symlinks from xbin (only symlinks pointing to busybox)
    await exec(
      `for f in ${BB_PATH}/*; do [ -L "$f" ] && [ "$(readlink "$f")" = "busybox" ] && rm -f "$f"; done 2>/dev/null; ` +
      `rm -f "${BB_PATH}/busybox" 2>/dev/null`,
      4000
    );
    await exec(`echo "disabled" > "${BB_STATE}"`);

    busyboxApplied = false;
    renderBusyboxState();
    if (st) { st.textContent = '✓ Removed — reboot to fully clean'; st.style.color = 'var(--dim)'; }
    showToast('Busybox removed — reboot to fully clean', 'BUSYBOX', 'warn', '🔄');
  }

  // Restore saved state (wait for bridge)
  waitForBridge(8000).then(() =>
    exec(`cat "${CFG_DIR}/busybox_state" 2>/dev/null`).then(r => {
      busyboxApplied = r.trim() === 'applied';
      renderBusyboxState();
      // Also live-check if busybox actually exists
      if (!busyboxApplied) {
        exec('which busybox 2>/dev/null').then(r2 => {
          if (r2.trim()) {
            busyboxApplied = true;
            renderBusyboxState();
          }
        });
      }
    })
  );
}

/* ═══════════════════════════════════════════════════════════
   § RAW CAMERA · Tecno Camon 20 Pro 5G
   ═══════════════════════════════════════════════════════════ */

let rawCamApplied = false;

function renderRawCamState() {
  const btn     = document.getElementById('btn-toggle-rawcam');
  const lbl     = document.getElementById('rawcam-toggle-label');
  const ribbon  = document.getElementById('rawcam-ribbon');
  const ribIcon = document.getElementById('rawcam-ribbon-icon');
  const ribTxt  = document.getElementById('rawcam-ribbon-text');
  const m = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };

  btn?.setAttribute('aria-pressed', rawCamApplied ? 'true' : 'false');
  btn?.classList.toggle('feat-applied', rawCamApplied);
  if (lbl)     lbl.textContent = rawCamApplied ? 'ON' : 'OFF';
  if (ribbon)  ribbon.classList.toggle('ribbon-applied', rawCamApplied);
  if (ribIcon) ribIcon.textContent = rawCamApplied ? '✅' : '📷';
  if (ribTxt)  ribTxt.textContent  = rawCamApplied
    ? 'RAW Camera ACTIVE — patched MTK libs mounted, RAW capture enabled'
    : 'Not active — RAW capture using stock camera libs';

  m('rc-m-lib1',  rawCamApplied ? 'PATCHED'   : 'DEFAULT');
  m('rc-m-lib2',  rawCamApplied ? 'PATCHED'   : 'DEFAULT');
  m('rc-m-raw',   rawCamApplied ? 'ENABLED'   : 'DISABLED');
  m('rc-m-mount', rawCamApplied ? 'MOUNTED'   : 'UNMOUNTED');
}

function initRawCam() {
  const MODDIR    = '/data/adb/modules/GovThermal';
  const RC_STATE  = `${CFG_DIR}/rawcam_state`;
  const LIB_DST   = '/vendor/lib64';
  const LIB1_NAME = 'libmtkcam_3rdparty.customer.so';
  const LIB2_NAME = 'libmtkcam_metastore.so';
  const RAW_SRC   = `${MODDIR}/rawcam_libs`;

  document.getElementById('btn-toggle-rawcam')?.addEventListener('click', () => {
    if (!rawCamApplied) {
      applyRawCam();
    } else {
      revertRawCam();
    }
  });

  async function applyRawCam() {
    const st = document.getElementById('rawcam-status');
    if (st) { st.textContent = '⏳ Applying…'; st.style.color = '#ffcc00'; }
    showToast('Applying RAW camera patch…', 'RAW CAM', 'info', '📷');

    // Enable RAW via camera properties
    const camProps = [
      ['persist.vendor.camera.raw.support',         '1'],
      ['persist.vendor.camera.feature.raw',          '1'],
      ['persist.camera.raw.support',                 '1'],
      ['debug.camera.raw',                           '1'],
      ['ro.vendor.mtk.camera.raw.support',           '1'],
      ['persist.mtk.camera.3rdparty.support',        '1'],
      ['ro.vendor.camera3rdparty.support',           '1'],
    ];
    const propCmds = camProps.map(([k, v]) =>
      `resetprop "${k}" "${v}" 2>/dev/null || setprop "${k}" "${v}" 2>/dev/null`
    );

    // Mount the patched .so libs via Magic Mount (write into module's system folder)
    const mountCmds = [
      `mkdir -p "${MODDIR}/system/vendor/lib64"`,
      // Copy patched libs from rawcam_libs if present, otherwise use bind-mount approach
      `if [ -f "${RAW_SRC}/${LIB1_NAME}" ]; then`,
      `  cp -f "${RAW_SRC}/${LIB1_NAME}" "${MODDIR}/system/vendor/lib64/${LIB1_NAME}"`,
      `  cp -f "${RAW_SRC}/${LIB2_NAME}" "${MODDIR}/system/vendor/lib64/${LIB2_NAME}"`,
      `  chmod 644 "${MODDIR}/system/vendor/lib64/${LIB1_NAME}"`,
      `  chmod 644 "${MODDIR}/system/vendor/lib64/${LIB2_NAME}"`,
      `  chown 0:0 "${MODDIR}/system/vendor/lib64/${LIB1_NAME}" "${MODDIR}/system/vendor/lib64/${LIB2_NAME}"`,
      `  chcon u:object_r:vendor_file:s0 "${MODDIR}/system/vendor/lib64/${LIB1_NAME}" 2>/dev/null`,
      `  chcon u:object_r:vendor_file:s0 "${MODDIR}/system/vendor/lib64/${LIB2_NAME}" 2>/dev/null`,
      `fi`,
    ].join('\n');

    await execAll(...propCmds);
    await exec(mountCmds, 6000);

    // Restart camera service to pick up new libs
    await execAll(
      `pkill -f "cameraserver" 2>/dev/null`,
      `pkill -f "camera.provider" 2>/dev/null`,
      `stop cameraserver 2>/dev/null; start cameraserver 2>/dev/null`
    );

    await exec(`mkdir -p "${CFG_DIR}" && echo "applied" > "${RC_STATE}"`);
    rawCamApplied = true;
    renderRawCamState();
    if (st) { st.textContent = '✓ Applied — RAW capture enabled (reboot for full effect)'; st.style.color = 'var(--a)'; }
    showToast('RAW Camera patch applied — reboot for full effect', 'RAW CAM', 'success', '📷');
    setStatus('✓ RAW Camera enabled', 'var(--a)');
  }

  async function revertRawCam() {
    const st = document.getElementById('rawcam-status');
    if (st) { st.textContent = '⏳ Reverting…'; st.style.color = '#ffcc00'; }
    showToast('Reverting RAW Camera patch…', 'RAW CAM', 'info', '🔄');

    const camProps = [
      'persist.vendor.camera.raw.support',
      'persist.vendor.camera.feature.raw',
      'persist.camera.raw.support',
      'debug.camera.raw',
      'ro.vendor.mtk.camera.raw.support',
      'persist.mtk.camera.3rdparty.support',
      'ro.vendor.camera3rdparty.support',
    ];
    const revertCmds = camProps.map(k =>
      `resetprop --delete "${k}" 2>/dev/null; setprop "${k}" "0" 2>/dev/null`
    );

    await execAll(...revertCmds);
    // Remove patched libs from module's vendor folder (disables Magic Mount override)
    await execAll(
      `rm -f "${MODDIR}/system/vendor/lib64/${LIB1_NAME}" 2>/dev/null`,
      `rm -f "${MODDIR}/system/vendor/lib64/${LIB2_NAME}" 2>/dev/null`
    );

    await exec(`echo "disabled" > "${RC_STATE}"`);
    rawCamApplied = false;
    renderRawCamState();
    if (st) { st.textContent = '✓ Reverted — reboot to restore stock libs'; st.style.color = 'var(--dim)'; }
    showToast('RAW Camera disabled — reboot to restore stock libs', 'RAW CAM', 'warn', '🔄');
  }

  // Restore saved state (wait for bridge)
  waitForBridge(8000).then(() =>
    exec(`cat "${CFG_DIR}/rawcam_state" 2>/dev/null`).then(r => {
      rawCamApplied = r.trim() === 'applied';
      renderRawCamState();
    })
  );
}

/* ═══════════════════════════════════════════════════════════
   § 19  ZRAM MANAGER · MEMORY
   ═══════════════════════════════════════════════════════════ */

// --- DYNAMIC zRAM & SWAPPINESS CONTROL (20GB MAX) ---
const zSizeS = document.getElementById('zram_size_slider');
const zSizeT = document.getElementById('zram_size_val');
const zSwapI = document.getElementById('zram_swappiness_input');
const zApply = document.getElementById('apply_zram_btn');
const zStats = document.getElementById('zram_stats_text');
const zWarning = document.getElementById('zram_warning') ||
                (() => {
                    const w = document.createElement('div');
                    w.id = 'zram_warning';
                    w.style.color = '#ffcc00';
                    w.style.fontSize = '0.85em';
                    w.style.marginTop = '8px';
                    w.style.display = 'none';
                    zApply?.parentNode?.insertBefore(w, zApply.nextSibling);
                    return w;
                })();

// Max zRAM size: 20GB (20480 MB)
const MAX_ZRAM_MB = 20480;
let totalPhysicalMB = 4096; // Default fallback

const refreshZramUI = async () => {
    const memInfo = await exec("cat /proc/meminfo | grep MemTotal | awk '{print $2}'");
    totalPhysicalMB = Math.floor(parseInt(memInfo) / 1024) || 4096;

    if (zSizeS) {
        zSizeS.max = MAX_ZRAM_MB;
        zSizeS.min = 256;
        zSizeS.step = totalPhysicalMB > 8192 ? 256 : 128;
    }

    const zDev = await exec("grep '/zram' /proc/swaps | awk '{print $1}'");
    const devPath = zDev.trim() || '/dev/block/zram0';
    const devName = devPath.split('/').pop();

    const diskSizeRaw = await exec(`cat /sys/block/${devName}/disksize 2>/dev/null`);
    const curSwp = await exec("cat /proc/sys/vm/swappiness");

    if (zSwapI && curSwp) zSwapI.value = curSwp.trim();

    if (diskSizeRaw && diskSizeRaw.trim() !== "0") {
        const currentBytes = parseInt(diskSizeRaw);
        const currentMB = Math.floor(currentBytes / 1024 / 1024);
        const currentGB = (currentBytes / 1024 / 1024 / 1024).toFixed(2);
        const physicalGB = (totalPhysicalMB / 1024).toFixed(1);
        if (zStats) zStats.textContent = `ACTIVE | ${currentGB} GB zRAM / ${physicalGB} GB Physical RAM`;
        if (zSizeS) { zSizeS.value = currentMB; updateSizeDisplay(currentMB); }

        // Update swap used
        const swapInfo = await exec("cat /proc/meminfo | grep SwapFree");
        const swapFreeKb = parseInt(swapInfo.match(/\d+/)?.[0] || '0');
        const swapUsedMB = Math.max(0, currentMB - Math.floor(swapFreeKb / 1024));
        const swapUsedEl = document.getElementById('zram-swap-used');
        if (swapUsedEl) swapUsedEl.textContent = swapUsedMB > 0 ? `${swapUsedMB} MB` : '0 MB';
    } else {
        const defaultMB = Math.min(Math.floor(totalPhysicalMB * 0.5), 8192);
        if (zSizeS) { zSizeS.value = defaultMB; updateSizeDisplay(defaultMB); }
        if (zStats) zStats.textContent = 'INACTIVE — no active swap detected';
    }
    checkZramWarning(zSizeS?.value || 2048);
};

if (zSizeS) {
    zSizeS.oninput = function() {
        updateSizeDisplay(this.value);
        checkZramWarning(this.value);
    };
}

function updateSizeDisplay(mb) {
    if (!zSizeT) return;
    const gb = mb / 1024;
    zSizeT.textContent = gb >= 1 ? `${gb.toFixed(1)} GB` : `${mb} MB`;
}

function checkZramWarning(mb) {
    if (!zWarning) return;
    zWarning.style.display = 'none';
    if (mb > totalPhysicalMB) {
        zWarning.style.display = 'block';
        zWarning.innerHTML = `⚠️ zRAM (${(mb/1024).toFixed(1)} GB) exceeds physical RAM (${(totalPhysicalMB/1024).toFixed(1)} GB). May cause thrashing under heavy load.`;
    } else if (mb > totalPhysicalMB * 0.75 && mb > 8192) {
        zWarning.style.display = 'block';
        zWarning.innerHTML = `💡 Large zRAM allocation (${(mb/1024).toFixed(1)} GB). Ensure sufficient free RAM for working set.`;
    }
}

if (zApply) {
    zApply.addEventListener('click', async () => {
        const targetMB  = parseInt(zSizeS?.value || 2048);
        const targetSize = targetMB + 'M';
        const targetSwp  = zSwapI?.value || '100';
        const targetAlgo = document.getElementById('zram_algo_select')?.value || 'lz4';

        if (targetMB > 16384 && !confirm(`⚠️ Creating ${(targetMB/1024).toFixed(1)}GB zRAM may cause instability.\n\nPhysical RAM: ${(totalPhysicalMB/1024).toFixed(1)}GB\nContinue?`)) return;

        showToast('Applying ZRAM changes…', 'ZRAM', 'info', '💾');
        zApply.style.opacity = '0.5';

        await exec(`
            ZDEV=$(grep "/zram" /proc/swaps | awk '{print $1}')
            [ -z "$ZDEV" ] && ZDEV="/dev/block/zram0"
            ZNAME=$(basename "$ZDEV")
            swapoff "$ZDEV" 2>/dev/null
            echo 1 > "/sys/block/$ZNAME/reset"
            echo "${targetAlgo}" > "/sys/block/$ZNAME/comp_algorithm"
            echo "${targetSize}" > "/sys/block/$ZNAME/disksize"
            mkswap "$ZDEV" > /dev/null 2>&1
            swapon -p 100 "$ZDEV" 2>/dev/null || swapon "$ZDEV"
            echo ${targetSwp} > /proc/sys/vm/swappiness
            mkdir -p /data/adb/zram_config
            printf 'SIZE=${targetSize}\nALGO=${targetAlgo}\nSWAP=${targetSwp}\n' > /data/adb/zram_config/settings.conf
        `);

        zApply.style.opacity = '1';
        showToast(`ZRAM ${(targetMB/1024).toFixed(1)} GB applied & saved`, 'ZRAM', 'success', '💾');
        setStatus(`✓ ZRAM ${(targetMB/1024).toFixed(1)} GB active`, 'var(--a)');
        setTimeout(refreshZramUI, 1000);
    });
}

async function initZramManager() {
    // Wire themed algo buttons to hidden select
    const algoBtns = document.querySelectorAll('.algo-btn');
    const algoSelect = document.getElementById('zram_algo_select');
    algoBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            algoBtns.forEach(b => {
                b.style.border = '1px solid var(--bdr)';
                b.style.background = 'rgba(255,255,255,0.03)';
                const nameEl = b.querySelector('.mono');
                if (nameEl) nameEl.style.color = 'var(--fg)';
                const dot = b.querySelector('.algo-dot');
                if (dot) { dot.style.background = 'transparent'; dot.style.border = '1px solid var(--bdr)'; dot.style.boxShadow = 'none'; }
            });
            btn.style.border = '1px solid var(--a)';
            btn.style.background = 'var(--tint-hi)';
            const nameEl = btn.querySelector('.mono');
            if (nameEl) nameEl.style.color = 'var(--a)';
            const dot = btn.querySelector('.algo-dot');
            if (dot) { dot.style.background = 'var(--a)'; dot.style.border = 'none'; dot.style.boxShadow = '0 0 6px var(--glow)'; }
            if (algoSelect) algoSelect.value = btn.dataset.algo;
        });
    });

    await refreshZramUI();

    // Live stats polling
    setInterval(async () => {
        const zDev = await exec("grep '/zram' /proc/swaps | awk '{print $1}'", 1000);
        if (zDev.trim()) {
            const devName = zDev.trim().split('/').pop();
            const mmStat = await exec(`cat /sys/block/${devName}/mm_stat`, 1000);
            const dSize  = await exec(`cat /sys/block/${devName}/disksize`, 1000);
            if (mmStat && mmStat !== 'TIMEOUT') {
                const p    = mmStat.trim().split(/\s+/);
                const used = (parseInt(p[1]) / 1024 / 1024).toFixed(1);
                const total = (parseInt(dSize) / 1024 / 1024 / 1024).toFixed(2);
                if (zStats) zStats.textContent = `${used} MB used / ${total} GB total`;
                const swapUsedEl = document.getElementById('zram-swap-used');
                if (swapUsedEl) swapUsedEl.textContent = used + ' MB';
            }
        }
    }, 3000);
}



/* ═══════════════════════════════════════════════════════════
   DEEP SLEEP GOVERNOR
   ═══════════════════════════════════════════════════════════ */
let deepSleepGovActive = false;

const DS_FLAG_ON  = `${CFG_DIR}/low_power_mode`;
const DS_FLAG_OFF = `${CFG_DIR}/low_power_mode.exec`;

function renderDeepSleepState() {
  const btn      = document.getElementById('btn-deep-sleep-gov');
  const label    = document.getElementById('deepsleep-label');
  const ribbon   = document.getElementById('deepsleep-ribbon');
  const ribIcon  = document.getElementById('deepsleep-ribbon-icon');
  const ribTxt   = document.getElementById('deepsleep-ribbon-text');
  const badge    = document.getElementById('deepsleep-summary-badge');
  const setM = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

  btn?.setAttribute('aria-pressed', deepSleepGovActive ? 'true' : 'false');
  if (deepSleepGovActive) {
    btn?.classList.add('gaming-toggle-btn--on');
    if (label)   label.textContent  = 'ON';
    if (badge)   { badge.textContent = 'ON'; badge.style.color = '#a78bfa'; badge.style.borderColor = '#a78bfa'; badge.style.opacity = '1'; }
    if (ribbon)  ribbon.style.borderColor = '#a78bfa44';
    if (ribIcon) ribIcon.textContent = '🌙';
    if (ribTxt)  ribTxt.textContent  = 'Deep Sleep ACTIVE — low power mode · apps restricted · doze aggressive';
    setM('ds-lowpower-status',  'ENABLED');
    setM('ds-standby-status',   'FORCED');
    setM('ds-doze-status',      'AGGRESSIVE');
    setM('ds-perfsvc-status',   'KILLED');
  } else {
    btn?.classList.remove('gaming-toggle-btn--on');
    if (label)   label.textContent  = 'OFF';
    if (badge)   { badge.textContent = 'OFF'; badge.style.color = ''; badge.style.borderColor = 'var(--bdr)'; badge.style.opacity = '0.7'; }
    if (ribbon)  ribbon.style.borderColor = '';
    if (ribIcon) ribIcon.textContent = '🌙';
    if (ribTxt)  ribTxt.textContent  = 'Deep Sleep inactive — normal background activity in effect';
    setM('ds-lowpower-status',  'OFF');
    setM('ds-standby-status',   'NORMAL');
    setM('ds-doze-status',      'DEFAULT');
    setM('ds-perfsvc-status',   'RUNNING');
  }
}

async function applyDeepSleepGov(enable) {
  setStatus(enable ? '🌙 Deep Sleep: activating…' : '🌙 Deep Sleep: deactivating…');

  const flag = enable ? '1' : '0';

  // Persist flag file
  if (enable) {
    await exec(`mv "${DS_FLAG_OFF}" "${DS_FLAG_ON}" 2>/dev/null || touch "${DS_FLAG_ON}"`);
  } else {
    await exec(`mv "${DS_FLAG_ON}" "${DS_FLAG_OFF}" 2>/dev/null || touch "${DS_FLAG_OFF}"`);
  }

  const cmd = `
    settings put global low_power              ${flag}
    settings put global low_power_sticky       ${flag}
    settings put global app_auto_restriction_enabled ${enable ? 'true' : 'false'}
    settings put global forced_app_standby_enabled   ${flag}
    settings put global app_standby_enabled          1
    settings put global forced_app_standby_for_small_battery_enabled ${flag}
    ai=$(settings get system ai_preload_user_state 2>/dev/null)
    [ "$ai" != "null" ] && settings put system ai_preload_user_state 0
    killall -9 woodpeckerd atfwd perfd magisklogd cnss_diag 2>/dev/null
    if command -v dumpsys >/dev/null; then
      for item in $(dumpsys deviceidle whitelist 2>/dev/null); do
        app=$(echo "$item" | cut -f2 -d ',')
        dumpsys deviceidle whitelist -$app 2>/dev/null
        am set-inactive $app true 2>/dev/null
        am set-idle $app true 2>/dev/null
        am make-uid-idle --user current $app 2>/dev/null
      done
      dumpsys deviceidle step 2>/dev/null
      dumpsys deviceidle step 2>/dev/null
      dumpsys deviceidle step 2>/dev/null
      dumpsys deviceidle step 2>/dev/null
    fi
    echo "Deep Sleep ${enable ? 'ENABLED' : 'DISABLED'}"
  `;

  await exec(cmd, 10000);

  deepSleepGovActive = enable;
  renderDeepSleepState();

  if (enable) {
    showToast('Deep Sleep ACTIVE — battery drain minimised', 'DEEP SLEEP', 'info', '🌙');
    setStatus('🌙 Deep Sleep Governor ACTIVE', 'var(--a)');
  } else {
    showToast('Deep Sleep OFF — normal mode restored', 'DEEP SLEEP', 'info', '🌙');
    setStatus('🌙 Deep Sleep Governor DISABLED', 'var(--a)');
  }
}

function initDeepSleepGov() {
  document.getElementById('btn-deep-sleep-gov')?.addEventListener('click', () => {
    applyDeepSleepGov(!deepSleepGovActive);
  });

  // Restore saved state
  waitForBridge(8000).then(() =>
    exec(`[ -f "${DS_FLAG_ON}" ] && echo "on" || echo "off"`).then(raw => {
      if (raw.trim() === 'off') {
        // Fall back to live system state
        exec(`settings get global low_power`).then(v => {
          deepSleepGovActive = v.trim() === '1';
          renderDeepSleepState();
        });
      } else {
        deepSleepGovActive = raw.trim() === 'on';
        renderDeepSleepState();
      }
    })
  );
}

/* Hook into existing DOMContentLoaded / init flow */
document.addEventListener('DOMContentLoaded', () => {
  initDeepSleepGov();
});



/* ═══════════════════════════════════════════════════════════
   CLEAR APP CACHE — Panel 12
   ═══════════════════════════════════════════════════════════ */

let _cacheApps = [];        // currently displayed pool (user or system)
let _cacheUserApps = [];    // user-installed packages
let _cacheSystemApps = [];  // system packages
let _cacheSelected = new Set();
let _cacheLoaded = false;
let _cachePanelTab = 'user'; // 'user' | 'system'


// Load panel when opened + wire tab clicks
document.addEventListener('DOMContentLoaded', () => {
  const panel = document.getElementById('clear-cache-panel');
  if (panel) {
    panel.addEventListener('toggle', () => {
      if (panel.open && !_cacheLoaded) _loadCacheApps();
    });
  }
  document.addEventListener('click', e => {
    const tab = e.target.closest('[data-cachetab2]');
    if (tab) _switchCachePanelTab(tab.dataset.cachetab2);
  });
});

async function _loadCacheApps() {
  const list = document.getElementById('cache-app-list');
  if (!list) return;
  list.innerHTML = '<div class="mono" style="font-size:10px;color:var(--dim);text-align:center;padding:16px;">Loading apps…</div>';

  try {
    // Load user apps first — shows immediately without waiting for system list
    const rawUser = await exec(`pm list packages -3 2>/dev/null | cut -d: -f2 | sort`, 8000);
    _cacheUserApps = rawUser.trim().split('\n').filter(Boolean);
    _cacheLoaded = true;

    const uc = document.getElementById('cache-panel-count-user');
    if (uc) uc.textContent = _cacheUserApps.length;

    _cachePanelTab = 'user';
    _cacheApps = _cacheUserApps;
    _renderCacheList(_cacheApps);

    // Load system apps in background — tab count updates when ready
    exec(`pm list packages -s 2>/dev/null | cut -d: -f2 | sort`, 12000).then(rawSystem => {
      _cacheSystemApps = rawSystem.trim().split('\n').filter(Boolean);
      const sc = document.getElementById('cache-panel-count-system');
      if (sc) sc.textContent = _cacheSystemApps.length;
    });
  } catch(e) {
    list.innerHTML = '<div class="mono" style="font-size:10px;color:#f87171;text-align:center;padding:16px;">Failed to load apps</div>';
  }
}

function _switchCachePanelTab(tab) {
  _cachePanelTab = tab;
  _cacheApps = tab === 'system' ? _cacheSystemApps : _cacheUserApps;
  document.querySelectorAll('[data-cachetab2]').forEach(b => {
    const active = b.dataset.cachetab2 === tab;
    b.classList.toggle('app-tab--active', active);
    b.setAttribute('aria-selected', String(active));
  });
  const searchEl = document.getElementById('cache-search-input');
  if (searchEl && searchEl.value) {
    _filterCacheApps(searchEl.value);
  } else {
    _renderCacheList(_cacheApps);
  }
  _updateClearBtn();
}

function _renderCacheList(apps) {
  const list = document.getElementById('cache-app-list');
  if (!list) return;

  if (!apps.length) {
    list.innerHTML = '<div class="mono" style="font-size:10px;color:var(--dim);text-align:center;padding:16px;">No apps found</div>';
    return;
  }

  list.innerHTML = apps.map(pkg => {
    const label = typeof getAppLabel === 'function' ? getAppLabel(pkg) : pkg;
    const checked = _cacheSelected.has(pkg);
    const safeId = pkg.replace(/\./g,'_');
    return `
      <div class="list-item" data-pkg="${pkg}" onclick="_toggleCacheSelect('${pkg}')" style="cursor:pointer;">
        <div class="item-row">
          <div class="app-icon-wrap" data-pkg="${pkg}">
            <img class="app-icon" alt="${label.toUpperCase()}">
          </div>
          <div class="item-info">
            <span class="item-title">${label.toUpperCase()}</span>
            <span class="item-desc mono">${pkg}</span>
          </div>
        </div>
        <div class="btn-row">
          <div id="cache-chk-${safeId}"
            style="width:20px;height:20px;border:0.8px solid var(--bdr);border-radius:5px;flex-shrink:0;
            background:${checked ? 'var(--a)' : 'transparent'};display:flex;align-items:center;justify-content:center;
            transition:background 0.15s;">
            ${checked ? '<span style="color:#000;font-size:12px;font-weight:700;">✓</span>' : ''}
          </div>
        </div>
      </div>`;
  }).join('');

  // Load icons using same pattern as other panels
  if (typeof loadVisibleIcons === 'function') loadVisibleIcons('cache-app-list');
}

function _toggleCacheSelect(pkg, row) {
  if (_cacheSelected.has(pkg)) {
    _cacheSelected.delete(pkg);
  } else {
    _cacheSelected.add(pkg);
  }
  // Update checkbox visual
  const id = 'cache-chk-' + pkg.replace(/\./g, '_');
  const chk = document.getElementById(id);
  const checked = _cacheSelected.has(pkg);
  if (chk) {
    chk.style.background = checked ? 'var(--a)' : 'transparent';
    chk.innerHTML = checked ? '<span style="color:#000;font-size:11px;">✓</span>' : '';
  }
  _updateClearBtn();
}

function _selectAllCacheApps() {
  const allSelected = _cacheApps.every(p => _cacheSelected.has(p));
  if (allSelected) {
    _cacheSelected.clear();
  } else {
    _cacheApps.forEach(p => _cacheSelected.add(p));
  }
  _renderCacheList(_cacheApps);
  _updateClearBtn();
}

function _updateClearBtn() {
  const btn = document.getElementById('btn-clear-cache');
  if (btn) btn.textContent = `🗑 CLEAR (${_cacheSelected.size})`;
}

function _filterCacheApps(query) {
  const q = query.toLowerCase();
  const filtered = q
    ? _cacheApps.filter(p => p.toLowerCase().includes(q) || (getAppLabel && getAppLabel(p).toLowerCase().includes(q)))
    : _cacheApps;
  _renderCacheList(filtered);
}

async function _clearSelectedCache() {
  if (!_cacheSelected.size) return;
  const status = document.getElementById('cache-clear-status');
  const btn = document.getElementById('btn-clear-cache');

  status.style.display = 'block';
  status.style.color = 'var(--a)';
  status.textContent = `⚙ Clearing ${_cacheSelected.size} app(s)…`;
  if (btn) btn.disabled = true;

  let cleared = 0;
  let failed = 0;

  for (const pkg of _cacheSelected) {
    const result = await exec(`pm clear --cache-only ${pkg} 2>/dev/null || rm -rf /data/data/${pkg}/cache 2>/dev/null && echo OK`);
    if (result.includes('Success') || result.includes('OK')) {
      cleared++;
    } else {
      failed++;
    }
  }

  status.style.color = failed === 0 ? 'var(--a)' : '#f59e0b';
  status.textContent = `✔ Cleared ${cleared} app(s)${failed > 0 ? ` · Failed: ${failed}` : ''}`;

  if (cleared > 0) {
    showToast(
      `${cleared} app cache${cleared !== 1 ? 's' : ''} cleared${failed > 0 ? ` · ${failed} failed` : ''}`,
      'CACHE', failed > 0 ? 'warn' : 'success', '🗑'
    );
  } else if (failed > 0) {
    showToast(`Failed to clear ${failed} app cache${failed !== 1 ? 's' : ''}`, 'CACHE', 'error', '🗑');
  }

  _cacheSelected.clear();
  _renderCacheList(_cacheApps);
  _updateClearBtn();
  if (btn) btn.disabled = false;
}

/* ═══════════════════════════════════════════════════════════
   CACHE CLEAR ON LAUNCH — Per-app popup
   File: RR_DIR/pkg.cacheclear (flag)
   File: RR_DIR/pkg.cacheclear_list (newline-separated pkgs)
   ═══════════════════════════════════════════════════════════ */

let _cacheClearPkg       = '';
let _cacheClearOn        = false;
let _cacheClearList      = new Set();
let _cacheClearAllPkgs   = [];   // user packages
let _cacheClearSysPkgs   = [];   // system packages
let _cacheClearTab       = 'all';
let _cacheClearQuery     = '';

async function _openCacheClearPopup(pkg) {
  _cacheClearPkg = pkg;
  const overlay = document.getElementById('cache-clear-popup');
  const pkgEl   = document.getElementById('cache-popup-pkg');
  if (!overlay) return;

  if (pkgEl) pkgEl.textContent = pkg;

  // Load state from disk
  const flagRaw = await exec(`[ -f ${RR_DIR}/${pkg}.cacheclear ] && echo 1 || echo 0`);
  _cacheClearOn = flagRaw.trim() === '1';

  const listRaw = await exec(`cat ${RR_DIR}/${pkg}.cacheclear_list 2>/dev/null`);
  _cacheClearList = new Set(listRaw.trim().split('\n').filter(Boolean));

  // Sync toggle
  const tog = document.getElementById('cache-popup-toggle');
  const togLabel = document.getElementById('cache-popup-toggle-label');
  if (tog) {
    tog.setAttribute('aria-pressed', String(_cacheClearOn));
    tog.classList.toggle('gaming-toggle-btn--on', _cacheClearOn);
    if (togLabel) togLabel.textContent = _cacheClearOn ? 'ON' : 'OFF';
  }

  // Load app list (user + system)
  if (!_cacheClearAllPkgs.length) {
    const [rawUser, rawSys] = await Promise.all([
      exec(`pm list packages -3 2>/dev/null | cut -d: -f2 | sort`),
      exec(`pm list packages -s 2>/dev/null | cut -d: -f2 | sort`),
    ]);
    _cacheClearAllPkgs = rawUser.trim().split('\n').filter(p => p && p !== pkg);
    _cacheClearSysPkgs = rawSys.trim().split('\n').filter(p => p && p !== pkg);
  }

  _cacheClearTab = 'all';
  _cacheClearQuery = '';
  // Reset system pkg cache on reopen (pkg may have changed)
  _cacheClearSysPkgs = [];
  _renderCachePopupList();
  _updateCachePopupCount();

  // Wire search
  const searchEl = document.getElementById('cache-popup-search');
  const clearEl  = document.getElementById('cache-popup-search-clear');
  if (searchEl) {
    searchEl.value = '';
    searchEl.oninput = () => {
      _cacheClearQuery = searchEl.value;
      if (clearEl) clearEl.hidden = !_cacheClearQuery;
      _renderCachePopupList();
    };
  }
  if (clearEl) {
    clearEl.hidden = true;
    clearEl.onclick = () => {
      if (searchEl) searchEl.value = '';
      _cacheClearQuery = '';
      clearEl.hidden = true;
      _renderCachePopupList();
    };
  }

  // Wire tabs (selected / all / system)
  document.querySelectorAll('[data-cachetab]').forEach(btn => {
    btn.onclick = () => {
      _cacheClearTab = btn.dataset.cachetab;
      document.querySelectorAll('[data-cachetab]').forEach(b => {
        b.classList.toggle('app-tab--active', b.dataset.cachetab === _cacheClearTab);
        b.setAttribute('aria-selected', String(b.dataset.cachetab === _cacheClearTab));
      });
      // Load system pkgs on first switch to system tab
      if (_cacheClearTab === 'system' && !_cacheClearSysPkgs.length) {
        exec(`pm list packages -s 2>/dev/null | cut -d: -f2 | sort`).then(raw => {
          _cacheClearSysPkgs = raw.trim().split('\n').filter(p => p && p !== _cacheClearPkg);
          _updateCachePopupCount();
          _renderCachePopupList();
        });
        return;
      }
      _renderCachePopupList();
    };
  });

  // Wire toggle
  if (tog) {
    tog.onclick = async () => {
      _cacheClearOn = !_cacheClearOn;
      tog.setAttribute('aria-pressed', String(_cacheClearOn));
      tog.classList.toggle('gaming-toggle-btn--on', _cacheClearOn);
      if (togLabel) togLabel.textContent = _cacheClearOn ? 'ON' : 'OFF';
      if (_cacheClearOn) {
        await exec(`mkdir -p ${RR_DIR} && touch ${RR_DIR}/${_cacheClearPkg}.cacheclear`);
      } else {
        await exec(`rm -f ${RR_DIR}/${_cacheClearPkg}.cacheclear`);
      }
    };
  }

  // Wire close + done
  document.getElementById('cache-popup-close')?.addEventListener('click', _closeCacheClearPopup);
  document.getElementById('cache-popup-done')?.addEventListener('click', _closeCacheClearPopup);

  overlay.style.display = 'flex';
}

function _closeCacheClearPopup() {
  const overlay = document.getElementById('cache-clear-popup');
  if (overlay) overlay.style.display = 'none';
  const count = _cacheClearList.size;
  const appName = typeof getAppLabel === 'function' ? getAppLabel(_cacheClearPkg) : _cacheClearPkg;
  if (count > 0) {
    showToast(`${count} app${count !== 1 ? 's' : ''} will be cleared on launch`, appName.toUpperCase(), 'success', '🗑');
  } else {
    showToast('No apps selected for cache clear', appName.toUpperCase(), 'info', '🗑');
  }
}

function _renderCachePopupList() {
  const list = document.getElementById('cache-popup-list');
  if (!list) return;

  let pool = _cacheClearTab === 'selected'
    ? [..._cacheClearAllPkgs, ..._cacheClearSysPkgs].filter(p => _cacheClearList.has(p))
    : _cacheClearTab === 'system'
      ? _cacheClearSysPkgs
      : _cacheClearAllPkgs;

  if (_cacheClearQuery) {
    const q = _cacheClearQuery.toLowerCase();
    pool = pool.filter(p => p.toLowerCase().includes(q) ||
      (typeof getAppLabel === 'function' && getAppLabel(p).toLowerCase().includes(q)));
  }

  _updateCachePopupCount();

  if (!pool.length) {
    list.innerHTML = `<div class="mono" style="font-size:10px;color:var(--dim);text-align:center;padding:16px;">No apps</div>`;
    return;
  }

  list.innerHTML = pool.map(pkg => {
    const label = typeof getAppLabel === 'function' ? getAppLabel(pkg) : pkg;
    const sel = _cacheClearList.has(pkg);
    return `
      <div class="list-item" data-pkg="${pkg}" onclick="_toggleCacheClearApp('${pkg}')">
        <div class="item-row">
          <div class="app-icon-wrap" data-pkg="${pkg}">
            <img class="app-icon" alt="${label.toUpperCase()}">
          </div>
          <div class="item-info">
            <span class="item-title">${label.toUpperCase()}</span>
            <span class="item-desc mono">${pkg}</span>
          </div>
        </div>
        <div class="btn-row">
          <div id="cachepop-chk-${pkg.replace(/\./g,'_')}"
            style="width:20px;height:20px;border:0.8px solid var(--bdr);border-radius:5px;flex-shrink:0;
            background:${sel ? 'var(--a)' : 'transparent'};display:flex;align-items:center;justify-content:center;transition:background 0.15s;">
            ${sel ? '<span style="color:#000;font-size:12px;font-weight:700;">✓</span>' : ''}
          </div>
        </div>
      </div>`;
  }).join('');

  // Load icons using same pattern as other panels
  if (typeof loadVisibleIcons === 'function') loadVisibleIcons('cache-popup-list');
}

async function _toggleCacheClearApp(pkg) {
  if (_cacheClearList.has(pkg)) {
    _cacheClearList.delete(pkg);
  } else {
    _cacheClearList.add(pkg);
  }

  // Save list to disk
  const listStr = [..._cacheClearList].join('\n');
  await exec(`mkdir -p ${RR_DIR} && printf '%s' '${listStr}' > ${RR_DIR}/${_cacheClearPkg}.cacheclear_list`);

  // Update checkbox
  const safeId = 'cachepop-chk-' + pkg.replace(/\./g, '_');
  const chk = document.getElementById(safeId);
  const sel = _cacheClearList.has(pkg);
  if (chk) {
    chk.style.background = sel ? 'var(--a)' : 'transparent';
    chk.innerHTML = sel ? '<span style="color:#000;font-size:12px;font-weight:700;">✓</span>' : '';
  }
  _updateCachePopupCount();
}

function _updateCachePopupCount() {
  const count = _cacheClearList.size;
  const selTab = document.getElementById('cache-popup-count-selected');
  const allTab = document.getElementById('cache-popup-count-all');
  const sysTab = document.getElementById('cache-popup-count-system');
  const main   = document.getElementById('cache-popup-count');
  if (selTab) selTab.textContent = count;
  if (allTab) allTab.textContent = _cacheClearAllPkgs.length;
  if (sysTab) sysTab.textContent = _cacheClearSysPkgs.length;
  if (main)   main.textContent   = `${count} app${count !== 1 ? 's' : ''} selected`;
}
