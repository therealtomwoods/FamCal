#!/usr/bin/env bash
# ==============================================================================
# FamCal Kiosk — SD Card Provisioning Utility
# Prepares a freshly flashed Raspberry Pi OS Lite SD card so it boots straight
# into FamCal Kiosk OS automatically on first power-up.
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "======================================================================"
echo "    📅 FamCal Kiosk SD Card Setup Utility                             "
echo "======================================================================"

BOOT_MOUNT="${1:-}"

if [ -z "$BOOT_MOUNT" ]; then
    echo "Usage: $0 <path-to-mounted-sd-card-boot-partition>"
    echo ""
    echo "Examples:"
    echo "  Linux:   $0 /media/$USER/bootfs"
    echo "  macOS:   $0 /Volumes/bootfs"
    echo "  Windows (WSL/Git Bash): $0 /e"
    echo ""
    read -rp "Enter the mount path to your SD card's 'bootfs' / 'boot' partition: " BOOT_MOUNT
fi

if [ ! -d "$BOOT_MOUNT" ]; then
    echo "Error: Directory '$BOOT_MOUNT' does not exist." >&2
    exit 1
fi

CMDLINE_PATH=""
if [ -f "$BOOT_MOUNT/firmware/cmdline.txt" ]; then
    CMDLINE_PATH="$BOOT_MOUNT/firmware/cmdline.txt"
    TARGET_BOOT_SUBDIR="firmware"
elif [ -f "$BOOT_MOUNT/cmdline.txt" ]; then
    CMDLINE_PATH="$BOOT_MOUNT/cmdline.txt"
    TARGET_BOOT_SUBDIR=""
else
    echo "Error: Neither $BOOT_MOUNT/cmdline.txt nor $BOOT_MOUNT/firmware/cmdline.txt was found." >&2
    echo "Please ensure you have specified the FAT32 boot partition of the Raspberry Pi SD card." >&2
    exit 1
fi

echo "Found valid boot partition at: $BOOT_MOUNT"

# Prompt for initial URL (optional)
DEFAULT_URL="http://localhost:8080"
echo ""
echo "Enter the URL you want FamCal Kiosk to display on startup."
echo "(Press ENTER to use local FamCal: $DEFAULT_URL)"
read -rp "Kiosk URL [$DEFAULT_URL]: " USER_URL
USER_URL="${USER_URL:-$DEFAULT_URL}"

# Prompt for orientation
echo ""
echo "Select screen orientation for your display:"
echo "  1) Portrait 90° clockwise (FamCal 9:16 vertical wall monitor) [Recommended]"
echo "  2) Landscape 0° (Standard widescreen monitor)"
echo "  3) Portrait 270° counter-clockwise"
read -rp "Selection [1]: " ORIENT_CHOICE

case "${ORIENT_CHOICE:-1}" in
    1) ORIENTATION="right" ;;
    2) ORIENTATION="normal" ;;
    3) ORIENTATION="left" ;;
    *) ORIENTATION="right" ;;
esac

# Write famcal-url.txt and famcal-orientation.txt
echo -e "# FamCal Kiosk URL Configuration\n$USER_URL" > "$BOOT_MOUNT/famcal-url.txt"
echo "$ORIENTATION" > "$BOOT_MOUNT/famcal-orientation.txt"
echo "✓ Configured URL: $USER_URL"
echo "✓ Configured Orientation: $ORIENTATION"

# Copy firstrun.sh
cp "$SCRIPT_DIR/firstrun.sh" "$BOOT_MOUNT/firstrun.sh"
chmod +x "$BOOT_MOUNT/firstrun.sh"
echo "✓ Copied firstrun.sh to boot partition"

# Copy local payload (pi-kiosk + dist)
PAYLOAD_DEST="$BOOT_MOUNT/famcal-payload"
mkdir -p "$PAYLOAD_DEST/kiosk" "$PAYLOAD_DEST/systemd" "$PAYLOAD_DEST/web"
cp "$SCRIPT_DIR/install.sh" "$PAYLOAD_DEST/"
cp -r "$SCRIPT_DIR/kiosk"/* "$PAYLOAD_DEST/kiosk/"
cp -r "$SCRIPT_DIR/systemd"/* "$PAYLOAD_DEST/systemd/"
cp -r "$SCRIPT_DIR/web"/* "$PAYLOAD_DEST/web/"

if [ -d "$REPO_DIR/dist" ]; then
    mkdir -p "$PAYLOAD_DEST/dist"
    cp -r "$REPO_DIR/dist"/* "$PAYLOAD_DEST/dist/"
    echo "✓ Bundled local FamCal production assets"
fi

# Add firstrun hook to cmdline.txt
if ! grep -q "firstrun.sh" "$CMDLINE_PATH"; then
    # In Bookworm, boot partition mounts as /boot/firmware
    if [ "$TARGET_BOOT_SUBDIR" = "firmware" ]; then
        sed -i 's|$| systemd.run=/boot/firmware/firstrun.sh|' "$CMDLINE_PATH"
    else
        sed -i 's|$| systemd.run=/boot/firstrun.sh|' "$CMDLINE_PATH"
    fi
    echo "✓ Injected firstrun execution hook into $(basename "$CMDLINE_PATH")"
fi

sync
echo ""
echo "======================================================================"
echo "    🎉 SD Card successfully prepared for FamCal Kiosk!                "
echo "======================================================================"
echo "Instructions:"
echo " 1. Safely eject the SD card from your computer."
echo " 2. Insert the SD card into your Raspberry Pi 3B+."
echo " 3. Connect HDMI display, Ethernet/Wi-Fi, and power."
echo " 4. The Pi will automatically install packages on first boot and"
echo "    launch into your full-screen FamCal Kiosk!"
echo ""
