#!/bin/bash
# ==============================================================================
# FamCal Kiosk — First-Boot Provisioning Script
# Automatically executes on the very first boot of a freshly flashed SD card.
# ==============================================================================

LOG_FILE="/var/log/famcal-firstrun.log"
exec > >(tee -a "$LOG_FILE") 2>&1

echo "========================================================"
echo " Starting FamCal Kiosk First-Boot Provisioning..."
echo " Time: $(date)"
echo "========================================================"

# Locate boot partition
BOOT_DIR="/boot/firmware"
if [ ! -d "$BOOT_DIR" ]; then
    BOOT_DIR="/boot"
fi

# Wait for network connectivity
echo "Waiting for internet connection..."
for i in $(seq 1 40); do
    if ping -c 1 -W 2 8.8.8.8 >/dev/null 2>&1; then
        echo "Internet connection established."
        break
    fi
    sleep 3
done

# If payload is located on boot partition, unpack or run it
PAYLOAD_DIR="$BOOT_DIR/famcal-payload"
if [ -d "$PAYLOAD_DIR" ]; then
    echo "Found local payload at $PAYLOAD_DIR. Running installer..."
    cd "$PAYLOAD_DIR"
    chmod +x install.sh
    ./install.sh
else
    echo "Payload not found in $BOOT_DIR. Cloning from repository..."
    apt-get update -y
    apt-get install -y git
    git clone https://github.com/therealtomwoods/FamCal.git /tmp/FamCal
    cd /tmp/FamCal/pi-kiosk
    chmod +x install.sh
    ./install.sh
fi

# Clean up cmdline.txt so firstrun does not execute again
CMDLINE_FILE="$BOOT_DIR/cmdline.txt"
if [ -f "$CMDLINE_FILE" ]; then
    sed -i 's| systemd.run=[^ ]*||g' "$CMDLINE_FILE"
    echo "Removed firstrun hook from $CMDLINE_FILE"
fi

echo "FamCal Kiosk provisioning finished successfully! Rebooting into Kiosk OS..."
sync
reboot
