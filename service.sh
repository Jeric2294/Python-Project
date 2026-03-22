#!/system/bin/sh
# =============================================================================
#  DAVION ENGINE — Service Script v2 (Optimized)
# =============================================================================

MODDIR="/data/adb/modules/GovThermal"
LOG="/sdcard/GovThermal/GovThermal.log"
CFG_DIR="/sdcard/GovThermal/config"
DE_ENGINE="$MODDIR/DAVION_ENGINE/AI_MODE/de_cpu_engine"
RR_CFG="/sdcard/DAVION_ENGINE/config"
RR_DIR="/sdcard/DAVION_ENGINE/refresh_locks"
GUARD_DIR="$MODDIR/.guard"

# NOTE: mkdir-p for /sdcard paths is intentionally deferred until after
# wait_for_boot + wait_for_sdcard so /sdcard is guaranteed to be mounted.
mkdir -p "$GUARD_DIR"   # only MODDIR (always available) at this stage

log_msg() { echo "[$(date '+%H:%M:%S')] $1" >> "$LOG"; }

# ── Rotate log file if > 512KB ───────────────────────────────
rotate_log() {
    if [ -f "$LOG" ]; then
        local size; size=$(wc -c < "$LOG" 2>/dev/null || echo 0)
        if [ "$size" -gt 524288 ]; then
            mv "$LOG" "${LOG}.bak" 2>/dev/null
            log_msg "Log rotated (previous: ${LOG}.bak)"
        fi
    fi
}

# ── Wait for boot ────────────────────────────────────────────
wait_for_boot() {
    local tries=0
    while [ "$(getprop sys.boot_completed)" != "1" ]; do
        sleep 3
        tries=$((tries + 1))
        [ "$tries" -gt 80 ] && log_msg "Boot timeout after 4min" && break
    done
    sleep 2
}

wait_for_boot
rotate_log

# ── Wait for /sdcard to be mounted ───────────────────────────
wait_for_sdcard() {
    local _tries=0
    while [ ! -d "/sdcard/Android" ] && [ $_tries -lt 30 ]; do
        sleep 1
        _tries=$((_tries + 1))
    done
    [ $_tries -ge 30 ] && log_msg "WARNING: /sdcard not confirmed after 30s"
}
wait_for_sdcard

# Create /sdcard-based dirs now that the mount is guaranteed
mkdir -p "$CFG_DIR" "$RR_CFG" "$RR_DIR"

log_msg "Boot complete — DAVION ENGINE starting"

# ── Permissions (consolidated, single pass) ──────────────────
chmod 755 "$MODDIR/busybox"            2>/dev/null
chmod 755 "$DE_ENGINE"                 2>/dev/null
find "$MODDIR/script_runner"  -type f -exec chmod 755 {} \; 2>/dev/null &
chmod 755 "$MODDIR/logcat_detection/logcat"   2>/dev/null
chmod 755 "$MODDIR/logcat_detection/dumpsys2" 2>/dev/null

# ── Start WebUI immediately (not delayed — user needs UI access) ──
pkill -f "busybox.*httpd.*8080" 2>/dev/null
pkill -f "httpd.*8080" 2>/dev/null
sleep 0.5
"$MODDIR/busybox" httpd -p 8080 -h "$MODDIR/webroot/" -c "$MODDIR/httpd.conf" >>"$MODDIR/httpd.log" 2>&1 &
echo $! > "$MODDIR/httpd.pid"
log_msg "WebUI on :8080 (PID $!)"

# ── DE CPU Engine — source functions immediately (needed by profile) ──
if [ -x "$DE_ENGINE" ]; then
    chmod 755 "$DE_ENGINE" 2>/dev/null
    . "$DE_ENGINE"
    log_msg "DE CPU engine loaded"
fi

# ════════════════════════════════════════════════════════════════════
# STAGED BOOT — flat 9s delay after boot_completed, then apply all
# ════════════════════════════════════════════════════════════════════
(
    log_msg "[BOOT] Waiting 11s before applying settings..."
    sleep 11
    log_msg "[BOOT] 11s elapsed — applying all settings"

    # ── STAGE 1 (+0s): CPU profile + Freq scale ──────────────────
    log_msg "[BOOT-STAGE 1] CPU profile + freq scale"

    FREQ_SCALE_FILE="/sdcard/GovThermal/freq_scale.txt"
    if [ ! -f "$FREQ_SCALE_FILE" ]; then
        mkdir -p "/sdcard/GovThermal"
        echo "100" > "$FREQ_SCALE_FILE"
    fi
    FREQ_SCALE=$(tr -d '\n ' < "$FREQ_SCALE_FILE" 2>/dev/null)
    if ! ([ "$FREQ_SCALE" -ge 30 ] && [ "$FREQ_SCALE" -le 100 ]) 2>/dev/null; then
        FREQ_SCALE=100
        echo "100" > "$FREQ_SCALE_FILE"
        log_msg "freq_scale invalid, reset to 100"
    fi

    # CPU Governor Profiles — MT6893 Dimensity 1200 per-cluster restore
    CPU_PROF_KEY=$(tr -d '[:space:]' < "$CFG_DIR/cpu_prof_key" 2>/dev/null)
    SAVED_PROFILE=$(tr -d '[:space:]' < "$CFG_DIR/active_profile" 2>/dev/null)
    case "$CPU_PROF_KEY" in
        responsive) SAVED_PROFILE="balanced"    ;;
        balanced)   SAVED_PROFILE="balanced"    ;;
        latency)    SAVED_PROFILE="performance" ;;
        battery)    SAVED_PROFILE="powersave"   ;;
    esac
    case "$SAVED_PROFILE" in
        performance|balanced|powersave) ;;
        *) SAVED_PROFILE=$(getprop persist.sys.davion.active_profile 2>/dev/null) ;;
    esac
    [ -z "$SAVED_PROFILE" ] && SAVED_PROFILE="balanced"

    _apply_gov() {
        local pol="$1" gov="$2" up="$3" dn="$4"
        local base="/sys/devices/system/cpu/cpufreq/policy${pol}"
        [ -d "$base" ] || return
        chmod 644 "$base/scaling_governor" 2>/dev/null
        echo "$gov" > "$base/scaling_governor" 2>/dev/null
        for gd in "$base/sugov_ext" "$base/schedutil" "$base/schedhorizon" "$base/uag"; do
            [ -d "$gd" ] || continue
            [ -f "$gd/up_rate_limit_us"   ] && echo "$up" > "$gd/up_rate_limit_us"   2>/dev/null
            [ -f "$gd/down_rate_limit_us" ] && echo "$dn" > "$gd/down_rate_limit_us" 2>/dev/null
            break
        done
        [ -f "$base/up_rate_limit_us"   ] && echo "$up" > "$base/up_rate_limit_us"   2>/dev/null
        [ -f "$base/down_rate_limit_us" ] && echo "$dn" > "$base/down_rate_limit_us" 2>/dev/null
    }
    _avail=$(cat /sys/devices/system/cpu/cpufreq/policy0/scaling_available_governors 2>/dev/null)
    _pick_gov() { for _g in $1; do echo "$_avail" | grep -qw "$_g" && echo "$_g" && return; done; echo "schedutil"; }

    case "$CPU_PROF_KEY" in
        responsive)
            GOV=$(_pick_gov "schedutil sugov_ext schedhorizon uag interactive")
            _apply_gov 0 "$GOV" 0 20000
            _apply_gov 4 "$GOV" 0 20000
            _apply_gov 7 "$GOV" 0 20000
            [ -f /sys/module/cpu_boost/parameters/input_boost_enabled ] && \
                echo 1 > /sys/module/cpu_boost/parameters/input_boost_enabled 2>/dev/null
            log_msg "CPU: ULTRA SMOOTH (gov=$GOV up=0 dn=20000)"
            ;;
        balanced)
            GOV=$(_pick_gov "schedutil sugov_ext schedhorizon uag interactive")
            _apply_gov 0 "$GOV" 85    10000
            _apply_gov 4 "$GOV" 85    10000
            _apply_gov 7 "$GOV" 85    10000
            [ -f /sys/module/cpu_boost/parameters/input_boost_enabled ] && \
                echo 1 > /sys/module/cpu_boost/parameters/input_boost_enabled 2>/dev/null
            log_msg "CPU: BALANCED DAILY (gov=$GOV up=85 dn=10000)"
            ;;
        latency)
            _apply_gov 0 "performance" 0 0
            _apply_gov 4 "performance" 0 0
            _apply_gov 7 "performance" 0 0
            [ -f /sys/module/cpu_boost/parameters/input_boost_enabled ] && \
                echo 0 > /sys/module/cpu_boost/parameters/input_boost_enabled 2>/dev/null
            log_msg "CPU: PERFORMANCE GAMING (performance all clusters)"
            ;;
        battery)
            GOV_L=$(_pick_gov "schedutil sugov_ext schedhorizon uag")
            GOV_B=$(_pick_gov "powersave conservative schedutil")
            _apply_gov 0 "$GOV_L" 5000  10000
            _apply_gov 4 "$GOV_B" 15000 30000
            _apply_gov 7 "$GOV_B" 15000 30000
            [ -f /sys/module/cpu_boost/parameters/input_boost_enabled ] && \
                echo 0 > /sys/module/cpu_boost/parameters/input_boost_enabled 2>/dev/null
            log_msg "CPU: BATTERY SAVER (little=$GOV_L mid/big=$GOV_B)"
            ;;
        *)
            if [ -f "$DE_ENGINE" ]; then
                . "$DE_ENGINE" 2>/dev/null
                case "$SAVED_PROFILE" in
                    performance) de_performance_cpu; log_msg "CPU: PERFORMANCE (engine)" ;;
                    powersave)   de_powersave_cpu;   log_msg "CPU: POWERSAVE (engine)"   ;;
                    *)           de_balanced_cpu;    log_msg "CPU: BALANCED (engine)"    ;;
                esac
            fi
            ;;
    esac
    echo "$SAVED_PROFILE" > "$CFG_DIR/active_profile"

    # ── STAGE 2 (+3s): boot_apply.sh ─────────────────────────────
    log_msg "[BOOT-STAGE 2] Boot config apply"
    BOOT_APPLY="$CFG_DIR/boot_apply.sh"
    [ ! -f "$BOOT_APPLY" ] && BOOT_APPLY="$MODDIR/config/boot_apply.sh"
    if [ -f "$BOOT_APPLY" ]; then
        chmod 755 "$BOOT_APPLY" 2>/dev/null
        sh "$BOOT_APPLY" 2>/dev/null &
        log_msg "Boot config apply started (PID $!)"
    fi

    # SchedUtil/SchedHorizon tuning restore
    SCHEDUTIL_SAVE="$CFG_DIR/schedutil_params.txt"
    if [ -f "$SCHEDUTIL_SAVE" ]; then
        SU_PARAMS=$(tr -d '[:space:]' < "$SCHEDUTIL_SAVE" 2>/dev/null)
        SU_UP=$(echo "$SU_PARAMS" | cut -d, -f1)
        SU_DOWN=$(echo "$SU_PARAMS" | cut -d, -f2)
        SU_HISPEED=$(echo "$SU_PARAMS" | cut -d, -f3)
        for p in /sys/devices/system/cpu/cpufreq/policy*; do
            for g in "$p/schedutil" "$p/schedhorizon" "$p/uag"; do
                [ -d "$g" ] || continue
                [ -n "$SU_UP" ]      && [ -f "$g/up_rate_limit_us" ]   && echo "$SU_UP"      > "$g/up_rate_limit_us"   2>/dev/null
                [ -n "$SU_DOWN" ]    && [ -f "$g/down_rate_limit_us" ] && echo "$SU_DOWN"    > "$g/down_rate_limit_us" 2>/dev/null
                [ -n "$SU_HISPEED" ] && [ -f "$g/hispeed_load" ]       && echo "$SU_HISPEED" > "$g/hispeed_load"       2>/dev/null
                break
            done
        done
        log_msg "SchedUtil restored: up=$SU_UP down=$SU_DOWN hispeed=$SU_HISPEED"
    fi


    # ── STAGE 3 (+7s): GPU + EEM ──────────────────────────────────
    log_msg "[BOOT-STAGE 3] GPU OPP + EEM restore"

    GPU_OPP_FILE="/sdcard/GovThermal/config/gpu_opp_index.txt"
    if [ -f "$GPU_OPP_FILE" ]; then
        _opp=$(tr -d '\r\n\t ' < "$GPU_OPP_FILE")
        if [ -n "$_opp" ] && [ "$_opp" -ge 0 ] 2>/dev/null; then
            _gw=0
            while [ $_gw -lt 10 ]; do
                [ -f /proc/gpufreqv2/fix_target_opp_index ] && break
                sleep 1; _gw=$((_gw+1))
            done
            if [ -f /proc/gpufreqv2/fix_target_opp_index ]; then
                su -c "echo '$_opp' > /proc/gpufreqv2/fix_target_opp_index" 2>/dev/null
                # GED upbound
                _gfreq=$(awk -v opp="$_opp" 'NR==opp+1{print $3}' \
                    /proc/gpufreqv2/stack_signed_opp_table 2>/dev/null | cut -d',' -f1)
                if [ -n "$_gfreq" ] && [ "$_gfreq" -gt 0 ] 2>/dev/null; then
                    chmod 664 /sys/kernel/ged/hal/custom_upbound_gpu_freq 2>/dev/null
                    echo "$_gfreq" > /sys/kernel/ged/hal/custom_upbound_gpu_freq 2>/dev/null
                    chmod 664 /sys/kernel/ged/hal/dcs_mode 2>/dev/null
                    echo 0 > /sys/kernel/ged/hal/dcs_mode 2>/dev/null
                fi
                log_msg "[GPU-OPP] OPP ${_opp} restored"
            fi
        fi
    fi


    # ── STAGE 4 (+10s): Thermal ───────────────────────────────────
    log_msg "[BOOT-STAGE 4] Thermal restore"
    THERMAL_SCRIPT="$MODDIR/script_runner/thermal_toggle"

    chmod 755 "$THERMAL_SCRIPT" 2>/dev/null

    THERMAL_STATE=$(tr -d '[:space:]' < "$CFG_DIR/thermal_state" 2>/dev/null)
    if [ -z "$THERMAL_STATE" ]; then
        THERMAL_STATE=$(tr -d '[:space:]' < "/data/media/0/GovThermal/config/thermal_state" 2>/dev/null)
    fi
    log_msg "Thermal state at boot: '${THERMAL_STATE}'"
    if [ "$THERMAL_STATE" = "disabled" ]; then
        for svc in thermald vendor.thermal-hal-2-0.mtk vendor.thermal-hal-2-0 thermal_core thermal_manager thermalloadalgod; do
            stop "$svc" 2>/dev/null
            setprop ctl.stop "$svc" 2>/dev/null
        done
        sh "$THERMAL_SCRIPT" disable

        log_msg "Thermal disabled"
    fi


    # ── STAGE 5 (+20s): SurfaceFlinger calls ─────────────────────
    log_msg "[BOOT-STAGE 5] SurfaceFlinger: overlay, RR, saturation"

    # Overlay
    service call SurfaceFlinger 1034 i32 1 >/dev/null 2>&1
    echo "on" > "$RR_CFG/overlay_state"
    log_msg "Overlay: ON"
    (
        sleep 30
        service call SurfaceFlinger 1034 i32 0 >/dev/null 2>&1
        echo "off" > "$RR_CFG/overlay_state"
        log_msg "Overlay: auto-OFF after 30s"
    ) &

    sleep 0

    # Zeta Auto Max-Hz
    ZETA_MAX_RATE=$(cmd display dump 2>/dev/null | grep -Eo 'fps=[0-9.]+' | cut -f2 -d= | sort -nr | head -n1 | cut -d. -f1)
    if [ -n "$ZETA_MAX_RATE" ] && [ "$ZETA_MAX_RATE" -gt 60 ] 2>/dev/null; then
        settings put system min_refresh_rate  "$ZETA_MAX_RATE" 2>/dev/null
        settings put system peak_refresh_rate "$ZETA_MAX_RATE" 2>/dev/null
        resetprop ro.surface_flinger.game_default_frame_rate_override "$ZETA_MAX_RATE" 2>/dev/null
        log_msg "Zeta: max Hz locked to ${ZETA_MAX_RATE}Hz"
    fi

    sleep 0

    # Universal RR lock
    UNIVERSAL_RR_FILE="/sdcard/DAVION_ENGINE/universal_rr.txt"
    if [ -f "$UNIVERSAL_RR_FILE" ]; then
        UNIVERSAL_MODE_ID=$(tr -d '\r\n\t ' < "$UNIVERSAL_RR_FILE")
        if [ -n "$UNIVERSAL_MODE_ID" ] && [ "$UNIVERSAL_MODE_ID" -eq "$UNIVERSAL_MODE_ID" ] 2>/dev/null; then
            service call SurfaceFlinger 1035 i32 "$UNIVERSAL_MODE_ID" >/dev/null 2>&1
            log_msg "Universal RR locked: mode $UNIVERSAL_MODE_ID"
        fi
    else
        service call SurfaceFlinger 1035 i32 0 >/dev/null 2>&1
        log_msg "RR: auto (mode 0)"
    fi

    sleep 0

    # Universal Brightness lock
    UNIVERSAL_BRIGHT_FILE="/sdcard/DAVION_ENGINE/universal_brightness.txt"
    if [ -f "$UNIVERSAL_BRIGHT_FILE" ]; then
        UB=$(tr -d '\r\n\t ' < "$UNIVERSAL_BRIGHT_FILE")
        if [ -n "$UB" ] && [ "$UB" -ge 0 ] 2>/dev/null && [ "$UB" -le 255 ] 2>/dev/null; then
            settings put system screen_brightness_mode 0 2>/dev/null
            settings put system screen_brightness "$UB" 2>/dev/null
            log_msg "Brightness locked: $UB"
        fi
    fi

    sleep 0

    # Saturation restore
    SAT_FILE="$MODDIR/DAVION_ENGINE_BoostColor/saturation_value"
    [ -f "/sdcard/DAVION_ENGINE_BoostColor/saturation_value" ] && \
        SAT_FILE="/sdcard/DAVION_ENGINE_BoostColor/saturation_value"
    if [ -f "$SAT_FILE" ]; then
        SAT_VAL=$(tr -d '\r\n\t ' < "$SAT_FILE")
        if [ -n "$SAT_VAL" ]; then
            service call SurfaceFlinger 1022 f "$SAT_VAL" >/dev/null 2>&1
            log_msg "Saturation restored: ${SAT_VAL}x"
        fi
    fi

    # Fast Charge restore
    if [ "$(tr -d '[:space:]' < "$CFG_DIR/flash_charge_enabled" 2>/dev/null)" = "1" ]; then
        echo "stop 1" > /proc/mtk_batoc_throttling/battery_oc_protect_stop 2>/dev/null
        echo "0 0" > /proc/mtk_battery_cmd/current_cmd 2>/dev/null
        for n in /sys/class/power_supply/battery/enable_hv_charging \
                 /sys/class/mtk_charger/fast_charging_indicator; do
            [ -f "$n" ] && echo 1 > "$n" 2>/dev/null
        done
        for i in 0 1 2 3 4 5; do
            [ -f "/proc/ppm/policy/$i" ] && echo "0 -1" > "/proc/ppm/policy/$i" 2>/dev/null
        done
        log_msg "Fast Charge restored: ON"
    fi


    # ── STAGE 6 (+22s): Feature states ───────────────────────────
    log_msg "[BOOT-STAGE 6] Feature state restore"

    REMOVELIMIT_STATE=$(tr -d '[:space:]' < "$CFG_DIR/removelimit_state" 2>/dev/null)
    ANIMATION_STATE=$(tr -d '[:space:]'   < "$CFG_DIR/animation_state"   2>/dev/null)

    if [ "$REMOVELIMIT_STATE" = "applied" ]; then
        resetprop persist.sys.apm.screen_record           120 2>/dev/null
        resetprop persist.sys.apm.float_window            120 2>/dev/null
        resetprop persist.sys.apm.split_screen            120 2>/dev/null
        resetprop persist.sys.apm.default_refresh_rate    120 2>/dev/null
        resetprop persist.sys.apm.force_high_refresh_rate   1 2>/dev/null
        resetprop persist.sys.apm.video_switch              0 2>/dev/null
        resetprop debug.graphics.disable_default_fps_limit  1 2>/dev/null
        resetprop persist.vendor.display.screen_record_fps 120 2>/dev/null
        log_msg "Remove Limit: applied"
    elif [ "$REMOVELIMIT_STATE" = "disabled" ]; then
        resetprop --delete persist.sys.apm.screen_record           2>/dev/null
        resetprop --delete persist.sys.apm.float_window            2>/dev/null
        resetprop --delete persist.sys.apm.split_screen            2>/dev/null
        resetprop --delete persist.sys.apm.default_refresh_rate    2>/dev/null
        resetprop --delete persist.sys.apm.force_high_refresh_rate 2>/dev/null
        resetprop --delete persist.sys.apm.video_switch            2>/dev/null
        resetprop debug.graphics.disable_default_fps_limit         0 2>/dev/null
        resetprop --delete persist.vendor.display.screen_record_fps 2>/dev/null
        log_msg "Remove Limit: kept off"
    fi

    sleep 0

    if [ "$ANIMATION_STATE" = "applied" ]; then
        resetprop ro.hios.ui.blur_disable                 1 2>/dev/null
        resetprop ro.surface_flinger.supports_background_blur 0 2>/dev/null
        resetprop ro.tran.open_close_animation            3 2>/dev/null
        resetprop ro.hios.transition_animation            3 2>/dev/null
        resetprop ro.transsion_remote_anim_support        0 2>/dev/null
        resetprop ro.hios.animation.open_close            1 2>/dev/null
        resetprop ro.hios.animation.launch                1 2>/dev/null
        resetprop ro.hios.animation.exit                  1 2>/dev/null
        resetprop ro.hios.animation.unlock                1 2>/dev/null
        resetprop persist.sys.ui.hw                       1 2>/dev/null
        resetprop debug.sf.disable_backpressure           1 2>/dev/null
        settings put global disable_window_blurs          1 2>/dev/null
        settings put global window_animation_scale      1.0 2>/dev/null
        settings put global transition_animation_scale  1.0 2>/dev/null
        settings put global animator_duration_scale     1.0 2>/dev/null
        log_msg "Animation Fix: applied"
    elif [ "$ANIMATION_STATE" = "disabled" ]; then
        resetprop --delete ro.hios.ui.blur_disable          2>/dev/null
        resetprop ro.surface_flinger.supports_background_blur 1 2>/dev/null
        resetprop --delete ro.tran.open_close_animation     2>/dev/null
        resetprop --delete ro.hios.transition_animation     2>/dev/null
        resetprop --delete ro.transsion_remote_anim_support 2>/dev/null
        resetprop --delete ro.hios.animation.open_close     2>/dev/null
        resetprop --delete ro.hios.animation.launch         2>/dev/null
        resetprop --delete ro.hios.animation.exit           2>/dev/null
        resetprop --delete ro.hios.animation.unlock         2>/dev/null
        resetprop --delete persist.sys.ui.hw                2>/dev/null
        resetprop --delete debug.sf.disable_backpressure    2>/dev/null
        settings delete global disable_window_blurs         2>/dev/null
        log_msg "Animation Fix: kept off"
    fi

    sleep 0

    # Animation Scale restore — use 0.5x as smooth default if no saved value
    ANIM_CFG="/sdcard/DAVION_ENGINE_AnimScale"
    for SCALE_KEY in window_animation_scale transition_animation_scale animator_duration_scale; do
        if [ -f "$ANIM_CFG/$SCALE_KEY" ]; then
            VAL=$(tr -d '[:space:]' < "$ANIM_CFG/$SCALE_KEY" 2>/dev/null)
            [ -n "$VAL" ] && settings put global "$SCALE_KEY" "$VAL" 2>/dev/null && \
                log_msg "Animation scale: $SCALE_KEY=$VAL"
        else
            # No saved value — apply smooth 0.5x default
            settings put global "$SCALE_KEY" "0.5" 2>/dev/null
            log_msg "Animation scale: $SCALE_KEY=0.5 (smooth default)"
        fi
    done

    sleep 0

    # Charge Limit restore
    CHARGE_LIMIT_FILE="/sdcard/GovThermal/config/charge_limit.txt"
    if [ -f "$CHARGE_LIMIT_FILE" ]; then
        CL=$(tr -d '[:space:]' < "$CHARGE_LIMIT_FILE" 2>/dev/null)
        if [ -n "$CL" ] && [ "$CL" -ge 50 ] && [ "$CL" -le 100 ] 2>/dev/null; then
            for p in \
                /sys/class/power_supply/battery/mmi_charging_enable \
                /sys/devices/platform/battery/stop_charging_level \
                /sys/class/power_supply/battery/charge_control_limit \
                /proc/mtk_battery_cmd/current_cmd; do
                [ -f "$p" ] && echo "$CL" > "$p" 2>/dev/null
            done
            log_msg "Charge limit restored: ${CL}%"
        fi
    fi



    # ── STAGE 6.5 (+28s): SF Illusion Method ─────────────────────
    log_msg "[BOOT-STAGE 6.5] SurfaceFlinger illusion method + phase offsets"

    # Core illusion method: keep 120Hz render pipeline active even when
    # display drops to 60Hz. Apps posting 60fps see 120 as a valid multiple
    # (120÷60=2) so the scheduler never downgrades the display mode.
    resetprop debug.sf.frame_rate_multiple_threshold 120 2>/dev/null

    # Legacy phase offset model — do NOT mix with use_phase_offsets_as_durations=1
    resetprop debug.sf.use_phase_offsets_as_durations 0 2>/dev/null

    # Early mode offsets — activated on transaction pending or missed frame
    setprop debug.sf.early_phase_offset_ns         1500000
    setprop debug.sf.early_app_phase_offset_ns     1500000
    # GPU composition offsets — more time for Mali-G77 MC9 complex scenes
    setprop debug.sf.early_gl_phase_offset_ns      3000000
    setprop debug.sf.early_gl_app_phase_offset_ns  15000000

    # High-FPS offsets (auto-applied when VSYNC period < 15ms = above ~65Hz)
    # Negative value = wakes BEFORE HW_VSYNC fires → more headroom at 120Hz
    setprop debug.sf.high_fps_early_app_phase_offset_ns  -4000000
    setprop debug.sf.high_fps_late_app_phase_offset_ns    1000000
    setprop debug.sf.high_fps_early_sf_phase_offset_ns   -4000000
    setprop debug.sf.high_fps_late_sf_phase_offset_ns     1000000
    # Activate per-display-mode offset selection
    setprop debug.sf.enable_advanced_sf_phase_offset 1

    # MTK-specific: vendor-prefixed latch_unsignaled
    setprop vendor.debug.sf.latch_unsignaled 1
    setprop debug.sf.latch_unsignaled        1
    setprop debug.sf.auto_latch_unsignaled   1

    # Backpressure + composition cache
    setprop debug.sf.disable_backpressure             1
    setprop debug.sf.enable_gl_backpressure           0
    setprop debug.sf.disable_client_composition_cache 1
    setprop debug.sf.enable_hwc_vds                   1

    # Skia GL threaded — optimal for Mali-G77 MC9
    setprop debug.renderengine.backend skiaglthreaded
    setprop debug.hwui.renderer         skiagl
    setprop debug.hwui.fps_divisor      1
    setprop debug.hwui.profile.maxframes 120

    # Refresh rate display settings
    settings put system peak_refresh_rate 120.0 2>/dev/null
    settings put system min_refresh_rate   120.0 2>/dev/null

    # MTK FPSGO kernel governor — disable boost_ta for predictable frame pacing
    [ -f /sys/kernel/fpsgo/common/force_onoff ] && \
        echo 1 > /sys/kernel/fpsgo/common/force_onoff 2>/dev/null
    [ -f /sys/kernel/fpsgo/fbt/boost_ta ] && \
        echo 0 > /sys/kernel/fpsgo/fbt/boost_ta 2>/dev/null

    log_msg "SF illusion method applied: threshold=120 phase_model=legacy FPSGO=tuned"

    # ── Restore Features panel toggles if previously enabled ──
    FEAT_FRAME_FLAG="$CFG_DIR/feat_frame_stability"
    FEAT_THROTTLE_FLAG="$CFG_DIR/feat_anti_throttle"

    if [ -f "$FEAT_FRAME_FLAG" ]; then
        resetprop debug.sf.frame_rate_multiple_threshold 120 2>/dev/null
        resetprop debug.sf.use_phase_offsets_as_durations 0 2>/dev/null
        setprop debug.sf.early_phase_offset_ns 1500000
        setprop debug.sf.early_app_phase_offset_ns 1500000
        setprop debug.sf.early_gl_phase_offset_ns 3000000
        setprop debug.sf.early_gl_app_phase_offset_ns 15000000
        setprop debug.sf.high_fps_early_app_phase_offset_ns -4000000
        setprop debug.sf.high_fps_late_app_phase_offset_ns 1000000
        setprop debug.sf.high_fps_early_sf_phase_offset_ns -4000000
        setprop debug.sf.high_fps_late_sf_phase_offset_ns 1000000
        setprop debug.sf.enable_advanced_sf_phase_offset 1
        setprop vendor.debug.sf.latch_unsignaled 1
        setprop debug.sf.latch_unsignaled 1
        setprop debug.sf.auto_latch_unsignaled 1
        setprop debug.sf.disable_backpressure 1
        setprop debug.sf.enable_gl_backpressure 0
        setprop debug.sf.disable_client_composition_cache 1
        resetprop ro.surface_flinger.set_touch_timer_ms 3000 2>/dev/null
        resetprop ro.surface_flinger.set_idle_timer_ms 3000 2>/dev/null
        resetprop ro.surface_flinger.enable_frame_rate_override true 2>/dev/null
        settings put system peak_refresh_rate 120.0 2>/dev/null
        settings put system min_refresh_rate 90.0 2>/dev/null
        setprop debug.renderengine.backend skiaglthreaded
        setprop debug.hwui.renderer skiagl
        setprop debug.hwui.fps_divisor 1
        setprop debug.hwui.profile.maxframes 120
        log_msg "Features: FRAME STABILITY restored from flag"
    fi

    if [ -f "$FEAT_THROTTLE_FLAG" ]; then
        setprop vendor.powerhal.dfs.enable 0
        setprop vendor.powerhal.init 0
        for pol in /sys/devices/system/cpu/cpufreq/policy*/scaling_min_freq; do
            echo 1200000 > "$pol" 2>/dev/null
        done
        for gf in /sys/class/devfreq/gpufreq/min_freq \
                  /sys/devices/platform/*/mali*/devfreq/*/min_freq; do
            echo 400000000 > "$gf" 2>/dev/null
        done
        [ -f /sys/kernel/fpsgo/common/force_onoff ] && \
            echo 1 > /sys/kernel/fpsgo/common/force_onoff 2>/dev/null
        [ -f /sys/kernel/fpsgo/fbt/boost_ta ] && \
            echo 0 > /sys/kernel/fpsgo/fbt/boost_ta 2>/dev/null
        setprop debug.mali.force_profiling 0
        setprop debug.hwui.target_cpu_time_percent 50
        log_msg "Features: ANTI-THROTTLE BOOST restored from flag"
    fi

    # ── STAGE 7 (+30s): Daemons ───────────────────────────────────
    log_msg "[BOOT-STAGE 7] Starting daemons"

    # Detection daemon (logcat/dumpsys)
    pkill -f "GovThermal.*logcat"   2>/dev/null
    pkill -f "GovThermal.*dumpsys2" 2>/dev/null
    touch "$RR_CFG/enable_logcat" 2>/dev/null
    rm -f "$RR_CFG/enable_dumpsys"  2>/dev/null

    DETECTION_METHOD="logcat"
    if [ -f "$RR_CFG/enable_dumpsys" ] && [ ! -f "$RR_CFG/enable_logcat" ]; then
        DETECTION_METHOD="dumpsys"
    fi
    log_msg "Detection: $DETECTION_METHOD"
    case "$DETECTION_METHOD" in
        logcat)
            SCRIPT="$MODDIR/logcat_detection/logcat"
            if [ -x "$SCRIPT" ]; then
                nohup "$SCRIPT" >/dev/null 2>&1 &
                log_msg "Logcat daemon started (PID $!)"
            fi
            ;;
        dumpsys)
            SCRIPT="$MODDIR/logcat_detection/dumpsys2"
            if [ -x "$SCRIPT" ]; then
                nohup "$SCRIPT" >/dev/null 2>&1 &
                log_msg "Dumpsys daemon started (PID $!)"
            fi
            ;;
    esac

    sleep 0

    # StormGuard
    SG_STATE=$(tr -d '[:space:]' < "$CFG_DIR/stormguard_state" 2>/dev/null)
    SG_HOOK_SVC="$MODDIR/stormguard_hook.sh_svc"
    if [ "$SG_STATE" = "applied" ]; then
        [ -x "$SG_HOOK_SVC" ] && sh "$SG_HOOK_SVC" &
        log_msg "Storm Guard: boot counter service started"
    fi

    sleep 0

    # Encore App Daemon
    ENCORE_APP_DAEMON="$MODDIR/script_runner/encore_app_daemon"
    chmod 755 "$ENCORE_APP_DAEMON" 2>/dev/null
    if [ -x "$ENCORE_APP_DAEMON" ]; then
        pkill -f "encore_app_daemon" 2>/dev/null
        nohup sh "$ENCORE_APP_DAEMON" >> "$LOG" 2>&1 &
        log_msg "Encore App Daemon started (PID $!)"
    fi

    sleep 0

    # Auto 60Hz Drop daemon
    IDLE60_FLAG="$CFG_DIR/idle60_enabled"
    IDLE60_DAEMON="$MODDIR/script_runner/idle60_daemon"
    if [ -f "$IDLE60_FLAG" ] && [ "$(cat "$IDLE60_FLAG" 2>/dev/null | tr -d '[:space:]')" = "1" ]; then
        chmod 755 "$IDLE60_DAEMON" 2>/dev/null
        pkill -f "idle60_daemon" 2>/dev/null
        nohup sh "$IDLE60_DAEMON" >> "$LOG" 2>&1 &
        log_msg "Auto 60Hz Drop daemon started (PID $!)"
    fi

    # ── OTG Auto-Enable Daemon ─────────────────────────────────
    # Listens for OTG plug events via /dev/uevent + extcon + logcat.
    # Writes directly to sysfs -- no dialog, no Settings page, no UI tap.
    # Always started unconditionally (independent of headset config flags).
    OTG_DAEMON="$MODDIR/script_runner/otg_daemon"
    chmod 755 "$OTG_DAEMON" 2>/dev/null
    pkill -f "otg_daemon" 2>/dev/null
    nohup sh "$OTG_DAEMON" >> "$LOG" 2>&1 &
    log_msg "OTG daemon started (PID $!)"
    # ─────────────────────────────────────────────────────────────

    # Headset daemon — auto volume on connect/disconnect
    HEADSET_VOL_FLAG="$CFG_DIR/headset_vol_on_connect"
    HEADSET_MUTE_FLAG="$CFG_DIR/headset_mute_on_disconnect"
    HEADSET_RESTORE_FLAG="$CFG_DIR/headset_restore_on_disconnect"
    HEADSET_DAEMON="$MODDIR/script_runner/headset_daemon"
    if [ -f "$HEADSET_VOL_FLAG" ] || [ -f "$HEADSET_MUTE_FLAG" ] || [ -f "$HEADSET_RESTORE_FLAG" ]; then
        chmod 755 "$HEADSET_DAEMON" 2>/dev/null
        pkill -f "headset_daemon" 2>/dev/null
        nohup sh "$HEADSET_DAEMON" >> "$LOG" 2>&1 &
        log_msg "Headset daemon started (PID $!)"
    fi

    # RR Guard — instant restore on 60Hz drop
    RR_GUARD_FLAG="$CFG_DIR/rr_guard_enabled"
    RR_GUARD_DAEMON="$MODDIR/script_runner/rr_guard"
    if [ -f "$RR_GUARD_FLAG" ] && [ "$(cat "$RR_GUARD_FLAG" 2>/dev/null | tr -d '[:space:]')" = "1" ]; then
        chmod 755 "$RR_GUARD_DAEMON" 2>/dev/null
        pkill -f "rr_guard" 2>/dev/null
        nohup sh "$RR_GUARD_DAEMON" >> "$LOG" 2>&1 &
        log_msg "RR Guard daemon started (PID $!)"
    fi

    # ── Hot Reload Daemon ──────────────────────────────────────
    HOT_RELOAD_DAEMON="$MODDIR/script_runner/hot_reload_daemon"
    chmod 755 "$HOT_RELOAD_DAEMON" 2>/dev/null
    pkill -f "hot_reload_daemon" 2>/dev/null
    nohup sh "$HOT_RELOAD_DAEMON" >> "$LOG" 2>&1 &
    log_msg "Hot Reload daemon started (PID $!)"

    sleep 0


    # ── Per-app configs confirmation ───────────────────────────
    [ -f "$CFG_DIR/conn_idle_wifi_off" ] && \
        log_msg "Idle WiFi/Data-off: ENABLED"
    RR_LOCK_DIR="/sdcard/DAVION_ENGINE/refresh_locks"
    if [ -d "$RR_LOCK_DIR" ]; then
        MODE_COUNT=$(ls "$RR_LOCK_DIR"/*.mode 2>/dev/null | wc -l | tr -d '[:space:]')
        BRIGHT_COUNT=$(ls "$RR_LOCK_DIR"/*.bright 2>/dev/null | wc -l | tr -d '[:space:]')
        VOL_COUNT=$(ls "$RR_LOCK_DIR"/*.vol 2>/dev/null | wc -l | tr -d '[:space:]')
        CONN_COUNT=$(ls "$RR_LOCK_DIR"/*.conn 2>/dev/null | wc -l | tr -d '[:space:]')
        KO_COUNT=$(ls "$RR_LOCK_DIR"/*.killothers 2>/dev/null | wc -l | tr -d '[:space:]')
        log_msg "Per-app: RR=${MODE_COUNT} Bright=${BRIGHT_COUNT} Vol=${VOL_COUNT} Conn=${CONN_COUNT} KO=${KO_COUNT}"
    fi

    log_msg "DAVION ENGINE v2 ready ✓ (all stages complete)"
) &

log_msg "DAVION ENGINE boot staged — SystemUI wait running in background"
