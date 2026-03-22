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
GITHUB_REPO="DAVION09-ENGINE"
BRANCH="main"

MANIFEST_URL="https://raw.githubusercontent.com/$GITHUB_USER/$GITHUB_REPO/$BRANCH/manifest.txt"

log() { echo "[$(date '+%H:%M:%S')] $1" | tee -a "$LOG"; }

# === Required files — hardcoded list ===
REQUIRED_FILES="
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

is_required() {
    target="$1"
    for f in $REQUIRED_FILES; do
        [ "$f" = "$target" ] && return 0
    done
    return 1
}

download() {
    "$BB" wget -q --timeout=15 -O "$2" "$1" 2>/dev/null
}

# ── HEADER ───────────────────────────────────────────────────
ui_print "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
ui_print "  DAVION09 ENGINE — OTA Update"
ui_print "  github.com/$GITHUB_USER/$GITHUB_REPO"
ui_print "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log "=== ACTION START ==="

# ── CHECK NETWORK ────────────────────────────────────────────
ui_print ""
ui_print "⚙ Checking network..."
if ! "$BB" wget -q --timeout=5 -O /dev/null "1.1.1.1" 2>/dev/null; then
    ui_print "✗ No internet connection!"
    log "ERROR: No network"
    ui_print "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    exit 1
fi
ui_print "✔ Network OK"

# ── DOWNLOAD MANIFEST ────────────────────────────────────────
ui_print "⚙ Fetching manifest from GitHub..."
mkdir -p "$TMP"

if ! download "$MANIFEST_URL" "$TMP/manifest.txt" || [ ! -s "$TMP/manifest.txt" ]; then
    ui_print "✗ Cannot reach GitHub. Try again later."
    log "ERROR: manifest download failed"
    rm -rf "$TMP"
    ui_print "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    exit 1
fi
ui_print "✔ Manifest fetched"

# ── FETCH EACH REQUIRED FILE ─────────────────────────────────
ui_print "↓ Downloading latest files..."
updated=0
failed=0

while IFS= read -r line; do
    [ -z "$line" ] && continue
    case "$line" in \#*) continue ;; esac

    rel_path=$(echo "$line" | cut -d' ' -f1)
    url=$(echo "$line"      | cut -d' ' -f2- | xargs)

    [ -z "$rel_path" ] || [ -z "$url" ] && continue

    if is_required "$rel_path"; then
        target="$MODDIR/$rel_path"
        mkdir -p "$(dirname "$target")" 2>/dev/null

        if download "$url" "$TMP/tmpfile" && [ -s "$TMP/tmpfile" ]; then
            cp "$TMP/tmpfile" "$target"
            chmod 755 "$target" 2>/dev/null
            log "✔ $rel_path"
            updated=$((updated + 1))
        else
            log "✗ FAILED: $rel_path"
            failed=$((failed + 1))
        fi
    fi

done < "$TMP/manifest.txt"

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
