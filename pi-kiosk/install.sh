#!/usr/bin/env bash
# ==============================================================================
# FamCal Kiosk — Automated OS Setup Script for Raspberry Pi 3B+
# Turns a fresh Raspberry Pi OS Lite into a dedicated, crash-resilient Kiosk OS.
# ==============================================================================

set -euo pipefail

# Visual formatting
BOLD="\033[1m"
GREEN="\033[0;32m"
BLUE="\033[0;34m"
YELLOW="\033[1;33m"
RED="\033[0;31m"
RESET="\033[0m"

echo -e "${BOLD}${BLUE}"
echo "======================================================================"
echo "    📅 FamCal Kiosk OS Installer for Raspberry Pi 3B+                 "
echo "======================================================================"
echo -e "${RESET}"

# 1. Verify Root Privileges
if [ "$(id -u)" -ne 0 ]; then
    echo -e "${RED}Error: This script must be run as root. Please run with sudo:${RESET}"
    echo "  sudo ./install.sh"
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
KIOSK_USER="${SUDO_USER:-pi}"
KIOSK_HOME="$(getent passwd "$KIOSK_USER" | cut -d: -f6)"
KIOSK_GROUP="$(id -gn "$KIOSK_USER")"

if [ -z "$KIOSK_HOME" ] || [ ! -d "$KIOSK_HOME" ]; then
    echo -e "${YELLOW}Warning: Home directory for user '$KIOSK_USER' not found. Using /home/$KIOSK_USER${RESET}"
    KIOSK_HOME="/home/$KIOSK_USER"
fi

echo -e "${GREEN}✓ Target Kiosk User:${RESET} ${BOLD}$KIOSK_USER${RESET} ($KIOSK_HOME)"

# 2. Update Apt & Install Minimal Lightweight Stack
echo -e "\n${BOLD}${BLUE}[1/7] Installing minimal X11 & Chromium packages...${RESET}"
echo "Optimized for Raspberry Pi 3B+ (1GB RAM) — No heavy desktop environment"

export DEBIAN_FRONTEND=noninteractive
apt-get update -y

# Detect Chromium package name (chromium-browser or chromium)
CHROMIUM_PKG="chromium-browser"
if ! apt-cache show chromium-browser >/dev/null 2>&1; then
    CHROMIUM_PKG="chromium"
fi

apt-get install -y --no-install-recommends \
    xserver-xorg \
    xinit \
    x11-xserver-utils \
    openbox \
    "$CHROMIUM_PKG" \
    unclutter \
    python3 \
    python3-tk \
    xdotool \
    zenity \
    curl \
    sed \
    sudo

# 3. Create Kiosk System Directories
echo -e "\n${BOLD}${BLUE}[2/7] Configuring Kiosk directories & scripts...${RESET}"
mkdir -p /etc/famcal-kiosk
mkdir -p /var/www/famcal
mkdir -p "$KIOSK_HOME/.config/openbox"
mkdir -p "$KIOSK_HOME/.config/famcal-kiosk"

# Copy Kiosk scripts to /etc/famcal-kiosk
cp "$SCRIPT_DIR/kiosk/kiosk-launcher.sh" /etc/famcal-kiosk/kiosk-launcher.sh
cp "$SCRIPT_DIR/kiosk/openbox-rc.xml" /etc/famcal-kiosk/openbox-rc.xml
chmod +x /etc/famcal-kiosk/kiosk-launcher.sh

# Install global utility binaries in /usr/local/bin
cp "$SCRIPT_DIR/kiosk/url-config.py" /usr/local/bin/famcal-url-config
cp "$SCRIPT_DIR/kiosk/orientation.sh" /usr/local/bin/famcal-rotate
cp "$SCRIPT_DIR/web/serve.py" /usr/local/bin/famcal-web-serve
chmod +x /usr/local/bin/famcal-url-config
chmod +x /usr/local/bin/famcal-rotate
chmod +x /usr/local/bin/famcal-web-serve

# Copy Openbox config for Kiosk user
cp "$SCRIPT_DIR/kiosk/openbox-rc.xml" "$KIOSK_HOME/.config/openbox/rc.xml"
chown -R "$KIOSK_USER:$KIOSK_GROUP" "$KIOSK_HOME/.config"

# 4. Set Default URL and Orientation Configurations
echo -e "\n${BOLD}${BLUE}[3/7] Setting up persistent URL and display configurations...${RESET}"

DEFAULT_URL="http://localhost:8080"
if [ ! -f /etc/famcal-kiosk/url.conf ]; then
    cp "$SCRIPT_DIR/kiosk/default-url.conf" /etc/famcal-kiosk/url.conf
fi
if [ ! -f /etc/famcal-kiosk/orientation.conf ]; then
    cp "$SCRIPT_DIR/kiosk/default-orientation.conf" /etc/famcal-kiosk/orientation.conf
fi

# Detect Boot Partition for PC/Mac direct SD card configuration
BOOT_DIR=""
if [ -d "/boot/firmware" ]; then
    BOOT_DIR="/boot/firmware"
elif [ -d "/boot" ]; then
    BOOT_DIR="/boot"
fi

if [ -n "$BOOT_DIR" ]; then
    if [ ! -f "$BOOT_DIR/famcal-url.txt" ]; then
        echo -e "# FamCal Kiosk URL Configuration\n$DEFAULT_URL" > "$BOOT_DIR/famcal-url.txt"
        echo -e "${GREEN}✓ Created $BOOT_DIR/famcal-url.txt${RESET} (Editable on PC/Mac)"
    fi
    if [ ! -f "$BOOT_DIR/famcal-orientation.txt" ]; then
        echo "normal" > "$BOOT_DIR/famcal-orientation.txt"
    fi
fi

# 5. Deploy Local FamCal Web App Build
echo -e "\n${BOLD}${BLUE}[4/7] Deploying FamCal Web Application locally...${RESET}"
DIST_DIR="$SCRIPT_DIR/../dist"
if [ -d "$DIST_DIR" ] && [ -f "$DIST_DIR/index.html" ]; then
    cp -r "$DIST_DIR"/* /var/www/famcal/
    chown -R www-data:www-data /var/www/famcal 2>/dev/null || chown -R "$KIOSK_USER:$KIOSK_GROUP" /var/www/famcal
    echo -e "${GREEN}✓ FamCal production assets deployed to /var/www/famcal${RESET}"
else
    echo -e "${YELLOW}! Dist folder not found at $DIST_DIR. You can run 'npm run build' and copy files to /var/www/famcal later.${RESET}"
fi

# 6. Install and Enable Systemd Services
echo -e "\n${BOLD}${BLUE}[5/7] Installing Systemd auto-launch services...${RESET}"

# Generate service with actual kiosk user and home directory
sed \
    -e "s|__KIOSK_USER__|$KIOSK_USER|g" \
    -e "s|__KIOSK_GROUP__|$KIOSK_GROUP|g" \
    -e "s|__KIOSK_HOME__|$KIOSK_HOME|g" \
    "$SCRIPT_DIR/systemd/famcal-kiosk.service" > /etc/systemd/system/famcal-kiosk.service

cp "$SCRIPT_DIR/systemd/famcal-web.service" /etc/systemd/system/famcal-web.service

systemctl daemon-reload
systemctl enable famcal-web.service
systemctl enable famcal-kiosk.service

# Ensure multi-user / graphical target
systemctl set-default graphical.target

echo -e "${GREEN}✓ Enabled famcal-kiosk.service (auto-starts browser on power-on)${RESET}"
echo -e "${GREEN}✓ Enabled famcal-web.service (local offline hosting on port 8080)${RESET}"

# 7. Hardware & Boot Optimizations for Raspberry Pi 3B+
echo -e "\n${BOLD}${BLUE}[6/7] Applying Raspberry Pi 3B+ hardware & power-loss optimizations...${RESET}"

# Prevent console blanking on boot
CMDLINE_FILE=""
if [ -f "/boot/firmware/cmdline.txt" ]; then
    CMDLINE_FILE="/boot/firmware/cmdline.txt"
elif [ -f "/boot/cmdline.txt" ]; then
    CMDLINE_FILE="/boot/cmdline.txt"
fi

if [ -n "$CMDLINE_FILE" ]; then
    if ! grep -q "consoleblank=0" "$CMDLINE_FILE"; then
        sed -i 's/$/ consoleblank=0/' "$CMDLINE_FILE"
        echo -e "${GREEN}✓ Added consoleblank=0 to $CMDLINE_FILE (prevents display sleep)${RESET}"
    fi
fi

# Allocate 128MB GPU memory for VC4 hardware acceleration
CONFIG_TXT=""
if [ -f "/boot/firmware/config.txt" ]; then
    CONFIG_TXT="/boot/firmware/config.txt"
elif [ -f "/boot/config.txt" ]; then
    CONFIG_TXT="/boot/config.txt"
fi

if [ -n "$CONFIG_TXT" ]; then
    if ! grep -q "^gpu_mem=" "$CONFIG_TXT"; then
        echo "gpu_mem=128" >> "$CONFIG_TXT"
        echo -e "${GREEN}✓ Set gpu_mem=128 in $CONFIG_TXT for smooth browser animations${RESET}"
    fi
fi

# Allow non-root user to reboot safely from hotkey
if [ ! -f /etc/sudoers.d/010_famcal_kiosk ]; then
    echo "$KIOSK_USER ALL=(ALL) NOPASSWD: /sbin/reboot, /sbin/poweroff, /usr/local/bin/famcal-rotate, /bin/mount" > /etc/sudoers.d/010_famcal_kiosk
    chmod 0440 /etc/sudoers.d/010_famcal_kiosk
    echo -e "${GREEN}✓ Configured safe reboot permissions for hotkey${RESET}"
fi

# 8. Finished & Read-Only / OverlayFS Instructions
echo -e "\n${BOLD}${GREEN}======================================================================${RESET}"
echo -e "${BOLD}${GREEN}    🎉 FamCal Kiosk OS Installation Complete!                        ${RESET}"
echo -e "${BOLD}${GREEN}======================================================================${RESET}"
echo ""
echo -e "  • ${BOLD}Auto-Launch on Boot:${RESET} Chromium will automatically launch full screen."
echo -e "  • ${BOLD}Power Loss Protection:${RESET} Automatic crash recovery & session restore suppression."
echo -e "  • ${BOLD}URL Hotkey:${RESET} Press ${BOLD}Ctrl+Alt+U${RESET} or ${BOLD}F8${RESET} anytime on the Pi to change the URL."
echo -e "  • ${BOLD}PC/Mac URL Config:${RESET} Edit ${BOLD}famcal-url.txt${RESET} directly on the SD card boot partition."
echo -e "  • ${BOLD}Screen Rotation:${RESET} Press ${BOLD}Ctrl+Alt+R${RESET} or run 'famcal-rotate' to switch portrait/landscape."
echo ""
echo -e "${BOLD}${YELLOW}Recommended Final Step for 100% Power-Loss SD-Card Immunity:${RESET}"
echo -e "  Run the following command to enable read-only OverlayFS:"
echo -e "    ${BOLD}sudo raspi-config nonint enable_overlayfs${RESET}"
echo -e "  This guarantees the SD card will never corrupt even if power is abruptly unplugged!"
echo ""
echo -e "You can now reboot your Raspberry Pi with: ${BOLD}sudo reboot${RESET}"
