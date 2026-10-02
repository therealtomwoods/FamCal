#!/bin/bash
# ==============================================================================
# FamCal Kiosk — Master Display & Browser Launcher for Raspberry Pi 3B+
# Handles power loss recovery, screen blanking prevention, rotation,
# network router delay handling, Openbox hotkeys, and Chromium kiosk mode.
# ==============================================================================

export DISPLAY="${DISPLAY:-:0}"
export XAUTHORITY="${XAUTHORITY:-$HOME/.Xauthority}"

CONFIG_BOOT="/boot/firmware/famcal-url.txt"
CONFIG_BOOT_LEGACY="/boot/famcal-url.txt"
CONFIG_ETC="/etc/famcal-kiosk/url.conf"
CONFIG_USER="$HOME/.config/famcal-kiosk/url.conf"

ORIENT_BOOT="/boot/firmware/famcal-orientation.txt"
ORIENT_BOOT_LEGACY="/boot/famcal-orientation.txt"
ORIENT_ETC="/etc/famcal-kiosk/orientation.conf"

DEFAULT_URL="http://localhost:8080"

# 1. Disable screen sleep, screensaver, and DPMS (keep screen on 24/7)
xset s noblank 2>/dev/null || true
xset s off 2>/dev/null || true
xset -dpms 2>/dev/null || true

# 2. Hide mouse cursor when inactive
if command -v unclutter >/dev/null 2>&1; then
    pkill -f unclutter 2>/dev/null || true
    unclutter -idle 0.5 -root &
fi

# 3. Apply Screen Orientation (useful for 9:16 portrait display on wall monitors)
get_orientation() {
    if [ -f "$ORIENT_BOOT" ]; then
        head -n 1 "$ORIENT_BOOT" | tr -d '[:space:]'
    elif [ -f "$ORIENT_BOOT_LEGACY" ]; then
        head -n 1 "$ORIENT_BOOT_LEGACY" | tr -d '[:space:]'
    elif [ -f "$ORIENT_ETC" ]; then
        head -n 1 "$ORIENT_ETC" | tr -d '[:space:]'
    else
        echo "normal"
    fi
}

ORIENTATION=$(get_orientation)
case "$ORIENTATION" in
    right|left|inverted|normal)
        xrandr -o "$ORIENTATION" 2>/dev/null || true
        ;;
    *)
        xrandr -o normal 2>/dev/null || true
        ;;
esac

# 4. Start Openbox Window Manager (handles hotkeys Ctrl+Alt+U / F8)
if ! pgrep -x "openbox" >/dev/null; then
    OPENBOX_CONFIG="/etc/famcal-kiosk/openbox-rc.xml"
    if [ ! -f "$OPENBOX_CONFIG" ]; then
        OPENBOX_CONFIG="$HOME/.config/openbox/rc.xml"
    fi
    if [ -f "$OPENBOX_CONFIG" ]; then
        openbox --config-file "$OPENBOX_CONFIG" &
    else
        openbox &
    fi
fi

# Function to read active kiosk URL
get_target_url() {
    local url=""
    if [ -f "$CONFIG_BOOT" ]; then
        url=$(grep -v '^#' "$CONFIG_BOOT" | head -n 1 | tr -d '[:space:]')
    elif [ -f "$CONFIG_BOOT_LEGACY" ]; then
        url=$(grep -v '^#' "$CONFIG_BOOT_LEGACY" | head -n 1 | tr -d '[:space:]')
    elif [ -f "$CONFIG_ETC" ]; then
        url=$(grep -v '^#' "$CONFIG_ETC" | head -n 1 | tr -d '[:space:]')
    elif [ -f "$CONFIG_USER" ]; then
        url=$(grep -v '^#' "$CONFIG_USER" | head -n 1 | tr -d '[:space:]')
    fi

    if [ -z "$url" ]; then
        url="$DEFAULT_URL"
    fi
    echo "$url"
}

# 5. Clean Chromium preferences to prevent "Restore Pages / Crash" popup after power loss
clean_chromium_crash_flags() {
    local prefs_file="$HOME/.config/chromium/Default/Preferences"
    if [ -f "$prefs_file" ]; then
        sed -i 's/"exited_cleanly":false/"exited_cleanly":true/' "$prefs_file" 2>/dev/null || true
        sed -i 's/"exit_type":"Crashed"/"exit_type":"Normal"/' "$prefs_file" 2>/dev/null || true
        sed -i 's/"exit_type":"SessionCrashed"/"exit_type":"Normal"/' "$prefs_file" 2>/dev/null || true
    fi

    local state_file="$HOME/.config/chromium/Local State"
    if [ -f "$state_file" ]; then
        sed -i 's/"exited_cleanly":false/"exited_cleanly":true/' "$state_file" 2>/dev/null || true
    fi
}

# 6. Wait for network connection if target URL is external
# After a power outage, home Wi-Fi routers often take 60-120 seconds to boot.
wait_for_network_if_needed() {
    local target="$1"
    # Local URLs don't need external network
    if [[ "$target" =~ ^http://(localhost|127\.0\.0\.1|0\.0\.0\.0) ]]; then
        return 0
    fi

    echo "Checking network connectivity for $target..."
    local max_attempts=30
    local attempt=1

    # Check if network route exists
    while [ $attempt -le $max_attempts ]; do
        if ping -c 1 -W 2 8.8.8.8 >/dev/null 2>&1 || ping -c 1 -W 2 1.1.1.1 >/dev/null 2>&1; then
            echo "Internet connection verified."
            return 0
        fi
        echo "Waiting for router/network after power loss (Attempt $attempt/$max_attempts)..."
        sleep 2
        attempt=$((attempt + 1))
    done
    echo "Network wait timeout reached. Launching browser anyway..."
}

# Find Chromium executable
CHROMIUM_BIN=""
if command -v chromium-browser >/dev/null 2>&1; then
    CHROMIUM_BIN="chromium-browser"
elif command -v chromium >/dev/null 2>&1; then
    CHROMIUM_BIN="chromium"
elif command -v google-chrome >/dev/null 2>&1; then
    CHROMIUM_BIN="google-chrome"
fi

if [ -z "$CHROMIUM_BIN" ]; then
    echo "ERROR: Chromium browser not found! Please run the installer script." >&2
    sleep 10
    exit 1
fi

# Ensure disk cache directory on tmpfs (saves SD card writes & prevents corruption)
mkdir -p /tmp/chromium-cache 2>/dev/null || true

# 7. Chromium Launch Loop
# If Chromium crashes or is restarted via URL configuration dialog (Ctrl+Alt+U),
# it immediately re-reads the URL and relaunches!
while true; do
    TARGET_URL=$(get_target_url)
    clean_chromium_crash_flags

    # If first boot after power loss and external URL, verify network
    if [ ! -f /tmp/famcal_network_checked ]; then
        wait_for_network_if_needed "$TARGET_URL"
        touch /tmp/famcal_network_checked
    fi

    echo "Launching $CHROMIUM_BIN in Kiosk Mode pointing to: $TARGET_URL"

    # Chromium flags optimized for Raspberry Pi 3B+ (1GB RAM)
    $CHROMIUM_BIN \
        --kiosk \
        --noerrdialogs \
        --disable-infobars \
        --disable-session-crashed-bubble \
        --check-for-update-interval=31536000 \
        --disable-features=Translate \
        --no-first-run \
        --fast \
        --fast-start \
        --disable-pinch \
        --overscroll-history-navigation=0 \
        --autoplay-policy=no-user-gesture-required \
        --disable-component-update \
        --password-store=basic \
        --disk-cache-dir=/tmp/chromium-cache \
        --disk-cache-size=104857600 \
        --disable-suggestions-ui \
        --disable-sync \
        --disable-default-apps \
        --disable-notifications \
        --disable-background-networking \
        --disable-breakpad \
        --disable-component-cloud-policy \
        --enable-gpu-rasterization \
        "$TARGET_URL"

    EXIT_CODE=$?
    echo "Chromium exited with code $EXIT_CODE. Relaunching in 1s..."
    sleep 1
done
