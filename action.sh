#!/system/bin/sh
# ============================================================
#  DAVION09 ENGINE — Action Handler
#  Author: Jeric Aparicio
#  Action = Fetch latest files from GitHub
# ============================================================

MODID="GovThermal"
MODDIR="/data/adb/modules/$MODID"
TMP="/data/local/tmp/davion_ota"
LOG="$MODDIR/ota.log"
BB="$MODDIR/busybox"

GITHUB_USER="Jeric2294"
GITHUB_REPO="Python-Project"
BRANCH="main"
RAW="https://raw.githubusercontent.com/$GITHUB_USER/$GITHUB_REPO/$BRANCH"

log() { echo "[$(date '+%H:%M:%S')] $1" | tee -a "$LOG"; }

# === Files to update — URLs built from RAW automatically ===
FILES="
action.sh
service.sh
post-fs-data.sh
customize.sh
system.prop
module.prop
service.d/davion_engine_webui.sh
script_runner/refresh_rate_locker
script_runner/rr_guard
script_runner/idle60_daemon
script_runner/sf_controller
script_runner/thermal_watchdog
script_runner/thermal_toggle
script_runner/battery_guard
script_runner/headset_daemon
script_runner/ai_thermal_predict
script_runner/ai_adaptive_freq
script_runner/ai_app_classifier
script_runner/encore_app_daemon
script_runner/hot_reload_daemon
script_runner/de_toast
script_runner/cool_mode
script_runner/global
script_runner/display_mode
script_runner/davion_engine_eem_boot
script_runner/davion_engine_manual
logcat_detection/logcat
logcat_detection/dumpsys2
webroot/index.html
webroot/style.css
webroot/script.js
webroot/config.json
webroot/cgi-bin/exec.sh
webroot/cgi-bin/icon.sh
webroot/cgi-bin/test.sh
DAVION_ENGINE/AI_MODE/azenith_cpu_engine
DAVION_ENGINE/AI_MODE/cpu_governor_control
DAVION_ENGINE/AI_MODE/de_cpu_engine
"

# ── HEADER ───────────────────────────────────────────────────
ui_print "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
ui_print "  DAVION09 ENGINE — OTA Update"
ui_print "  github.com/$GITHUB_USER/$GITHUB_REPO"
ui_print "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log "=== ACTION START ==="

# ── CHECK NETWORK ────────────────────────────────────────────
ui_print ""
ui_print "⚙ Checking network..."
if ! "$BB" wget -q --timeout=5 -O /dev/null "https://1.1.1.1" 2>/dev/null; then
    ui_print "✗ No internet connection!"
    log "ERROR: No network"
    ui_print "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    exit 1
fi
ui_print "✔ Network OK"

# ── FETCH FILES ──────────────────────────────────────────────
ui_print "↓ Downloading latest files..."
mkdir -p "$TMP"
updated=0
failed=0

for rel_path in $FILES; do
    [ -z "$rel_path" ] && continue

    url="$RAW/$rel_path"
    target="$MODDIR/$rel_path"
    mkdir -p "$(dirname "$target")" 2>/dev/null

    if "$BB" wget -q --timeout=15 \
        -O "$TMP/tmpfile" "$url" 2>/dev/null \
        && [ -s "$TMP/tmpfile" ]; then
        cp "$TMP/tmpfile" "$target"
        chmod 755 "$target" 2>/dev/null
        log "✔ $rel_path"
        updated=$((updated + 1))
    else
        log "✗ FAILED: $rel_path"
        failed=$((failed + 1))
    fi
done

# ── FIX PERMISSIONS ──────────────────────────────────────────
find "$MODDIR" -name "*.sh" -exec chmod +x {} \; 2>/dev/null
find "$MODDIR/script_runner" -type f -exec chmod +x {} \; 2>/dev/null
find "$MODDIR/logcat_detection" -type f -exec chmod +x {} \; 2>/dev/null
find "$MODDIR/webroot/cgi-bin" -type f -exec chmod +x {} \; 2>/dev/null
chmod +x "$MODDIR/busybox" 2>/dev/null

# ── RESTART WEBUI ────────────────────────────────────────────
if [ "$updated" -gt 0 ]; then
    ui_print "⚙ Restarting WebUI..."
    pkill -f "httpd.*8080" 2>/dev/null
    pkill -f "busybox.*8080" 2>/dev/null
    sleep 1
    "$BB" httpd \
        -p 8080 \
        -h "$MODDIR/webroot" \
        -c "$MODDIR/httpd.conf" \
        >>"$LOG" 2>&1 &
    sleep 1
    ui_print "✔ WebUI restarted"
    log "httpd restarted"
fi

# ── CLEANUP ──────────────────────────────────────────────────
rm -rf "$TMP"
log "Cleanup done"

# ── DONE ─────────────────────────────────────────────────────
ui_print ""
ui_print "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ "$updated" -gt 0 ]; then
    ui_print "  ✔ Updated $updated file(s)!"
    [ "$failed" -gt 0 ] && ui_print "  ⚠ Failed: $failed file(s)"
else
    ui_print "  ✔ Already up to date!"
fi
ui_print "  No reboot needed."
ui_print "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log "=== ACTION DONE (updated=$updated failed=$failed) ==="
exit 0
