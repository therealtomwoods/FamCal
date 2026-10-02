#!/usr/bin/env bash
# ==============================================================================
# FamCal Kiosk — Image Customization & Generation Script
# Prepares a pre-configured, flashable Raspberry Pi OS image for Raspberry Pi 3B+
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "======================================================================"
echo "    📅 FamCal Kiosk Image Customizer for Raspberry Pi 3B+             "
echo "======================================================================"

IMAGE_INPUT="${1:-}"

if [ -z "$IMAGE_INPUT" ]; then
    echo "Usage: sudo $0 <path-to-raspios-lite.img>"
    echo ""
    echo "Downloads Raspberry Pi OS Lite image if none provided."
    read -rp "Would you like to download the latest Raspberry Pi OS Lite image now? (y/N): " DOWNLOAD_CHOICE
    if [[ "$DOWNLOAD_CHOICE" =~ ^[Yy]$ ]]; then
        IMAGE_XZ="raspios-lite-arm64.img.xz"
        echo "Downloading official Raspberry Pi OS Lite (64-bit)..."
        curl -L -o "$IMAGE_XZ" "https://downloads.raspberrypi.com/raspios_lite_arm64/images/raspios_lite_arm64-2024-07-04/2024-07-04-raspios-bookworm-arm64-lite.img.xz"
        echo "Decompressing image..."
        xz -d "$IMAGE_XZ"
        IMAGE_INPUT="${IMAGE_XZ%.xz}"
    else
        echo "Please provide an image file to customize. Exiting."
        exit 1
    fi
fi

if [ "$(id -u)" -ne 0 ]; then
    echo "Error: This script requires root permissions to mount loop partitions." >&2
    echo "Run with: sudo $0 $IMAGE_INPUT" >&2
    exit 1
fi

CUSTOM_IMAGE="${IMAGE_INPUT%.img}-famcal-kiosk.img"
echo "Creating copy of image to customize: $CUSTOM_IMAGE"
cp "$IMAGE_INPUT" "$CUSTOM_IMAGE"

# Setup loop devices
LOOP_DEV=$(losetup --show -fP "$CUSTOM_IMAGE")
echo "Mounted image on $LOOP_DEV"

cleanup() {
    echo "Unmounting and cleaning up loop devices..."
    sync
    umount /tmp/famcal_boot 2>/dev/null || true
    losetup -d "$LOOP_DEV" 2>/dev/null || true
}
trap cleanup EXIT

mkdir -p /tmp/famcal_boot
# Partition 1 is the FAT32 boot partition
mount "${LOOP_DEV}p1" /tmp/famcal_boot

# Run SD card setup on the mounted boot partition
"$SCRIPT_DIR/setup-sdcard.sh" /tmp/famcal_boot

echo ""
echo "Customized image created successfully at: $CUSTOM_IMAGE"
echo "You can now flash this image directly using Raspberry Pi Imager or dd!"
