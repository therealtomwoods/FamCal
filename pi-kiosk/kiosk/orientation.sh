#!/bin/bash
# ==============================================================================
# FamCal Kiosk — Screen Rotation Helper
# Rotates between Normal (0° landscape), Right (90° portrait), Inverted (180°),
# and Left (270° portrait). Persists the choice so it survives power loss!
# ==============================================================================

ORIENT_BOOT="/boot/firmware/famcal-orientation.txt"
ORIENT_BOOT_LEGACY="/boot/famcal-orientation.txt"
ORIENT_ETC="/etc/famcal-kiosk/orientation.conf"

get_current() {
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

save_and_apply() {
    local target="$1"
    echo "Setting orientation to: $target"
    xrandr -o "$target" 2>/dev/null || true

    # Save to configs
    if [ -d "/boot/firmware" ]; then
        sudo mount -o remount,rw /boot/firmware 2>/dev/null || true
        echo "$target" | sudo tee "$ORIENT_BOOT" >/dev/null 2>&1 || true
    fi
    if [ -d "/boot" ] && [ ! -d "/boot/firmware" ]; then
        sudo mount -o remount,rw /boot 2>/dev/null || true
        echo "$target" | sudo tee "$ORIENT_BOOT_LEGACY" >/dev/null 2>&1 || true
    fi
    if [ -d "/etc/famcal-kiosk" ]; then
        echo "$target" | sudo tee "$ORIENT_ETC" >/dev/null 2>&1 || true
    fi
}

TARGET="$1"

if [ -z "$TARGET" ] || [ "$TARGET" = "toggle" ]; then
    CURRENT=$(get_current)
    case "$CURRENT" in
        normal) TARGET="right" ;;
        right) TARGET="inverted" ;;
        inverted) TARGET="left" ;;
        left) TARGET="normal" ;;
        *) TARGET="right" ;;
    esac
fi

case "$TARGET" in
    normal|right|left|inverted)
        save_and_apply "$TARGET"
        ;;
    0)
        save_and_apply "normal"
        ;;
    90)
        save_and_apply "right"
        ;;
    180)
        save_and_apply "inverted"
        ;;
    270)
        save_and_apply "left"
        ;;
    *)
        echo "Usage: $0 [normal|right|left|inverted|0|90|180|270|toggle]"
        exit 1
        ;;
esac
