# 🖥️ FamCal Kiosk OS for Raspberry Pi 3B+

A dedicated, lightweight, and crash-resilient Kiosk Operating System configuration engineered specifically for running **FamCal** (or any web application) on a **Raspberry Pi 3B+** connected to a wall-mounted monitor or smart display.

---

## 🌟 Key Capabilities

- 🚀 **Auto-Launch on Boot & Power Loss**:
  - Automatically starts full-screen Chromium without requiring a desktop environment, display manager, or user login.
  - Recovers cleanly from abrupt power cuts without displaying "Chromium didn't shut down correctly" crash banners or session restore prompts.
  - Built-in router-recovery delay: When a power outage occurs, the Pi boots faster than home Wi-Fi routers. The launcher waits for the network to initialize before loading external URLs, preventing dead `ERR_INTERNET_DISCONNECTED` screens.
- 📶 **On-Screen Wi-Fi Scanning & Connection**:
  - Press `Ctrl+Alt+U` or `F8` anytime to open the setup menu and switch to the **Wi-Fi Setup** tab.
  - Automatically scans nearby Wi-Fi networks, lets you choose your SSID, enter the Wi-Fi password, and connects on the fly with live IP status.
- ⌨️ **Instant Hotkey URL Configuration (`Ctrl+Alt+U` or `F8`)**:
  - Pop up a dark-mode URL configuration modal over the fullscreen display at any time.
  - Allows typing, pasting, or selecting presets, then automatically validates, persists the URL, and relaunches the browser.
- 💾 **Plug-and-Play PC/Mac SD Card Editing**:
  - The URL and display orientation can also be configured simply by plugging the SD card into any Windows PC or Mac and editing `famcal-url.txt` directly on the FAT32 boot partition!
- 🔄 **9:16 Portrait & Landscape Wall Display Support**:
  - Press `Ctrl+Alt+R` or run `famcal-rotate` to rotate the screen 90° (portrait clockwise for FamCal 9:16 layout), 270°, or 0° (landscape).
  - Screen orientation persists across power cuts.
- ⚡ **Optimized for 1GB RAM on Raspberry Pi 3B+**:
  - Eliminates heavy desktop environments (GNOME, LXDE, Wayfire) that consume 400MB+ RAM.
  - Uses an ultra-lean X11 + Openbox stack consuming only ~30MB of system RAM, leaving >700MB for Chromium and smooth Google Photos slideshow transitions.
  - GPU memory allocated to 128MB with VC4 hardware acceleration.
- 🏠 **Dual Cloud & Offline Local Hosting**:
  - Supports loading remote URLs (e.g. GitHub Pages or local network server).
  - Includes a built-in lightweight local web server (`famcal-web.service`) serving the bundled FamCal production build on `http://localhost:8080` for 100% offline standalone operation.
- 🛡️ **100% Power Cut Immunity (Read-Only OverlayFS Support)**:
  - Supports Raspberry Pi OS OverlayFS, rendering the SD card root filesystem read-only to prevent SD card corruption during sudden power drops.

---

## 📁 Repository Structure

```
pi-kiosk/
├── README.md               # Complete architecture & operation documentation
├── install.sh              # 1-step turnkey installer for Raspberry Pi OS Lite
├── setup-sdcard.bat        # Windows 1-click SD card setup batch script
├── setup-sdcard.sh         # macOS/Linux SD card preparation utility
├── build-image.sh          # Flashable image builder for mass provisioning
├── firstrun.sh             # First-boot provisioning hook
├── kiosk/
│   ├── kiosk-launcher.sh   # Master X11 kiosk script (crash recovery, loop relaunch)
│   ├── url-config.py       # Python Tkinter modal dialog (Ctrl+Alt+U / F8) with Wi-Fi & URL controls
│   ├── openbox-rc.xml      # Openbox kiosk rules and global keybindings
│   ├── orientation.sh      # Screen rotation utility (0°, 90°, 180°, 270°)
│   ├── default-url.conf    # Default URL configuration
│   └── default-orientation.conf # Default screen orientation
├── systemd/
│   ├── famcal-kiosk.service# Systemd service for auto-boot & restart on exit
│   └── famcal-web.service  # Systemd service for local FamCal HTTP server
└── web/
    └── serve.py            # Lightweight SPA static server for offline FamCal
```

---

## 💻 Windows Installation Guide using Raspberry Pi Imager

Here is the exact step-by-step process to install and deploy FamCal Kiosk OS using Windows and the official Raspberry Pi Imager:

### Step 1: Download & Install Raspberry Pi Imager
1. Download **Raspberry Pi Imager** for Windows from [raspberrypi.com/software](https://www.raspberrypi.com/software/).
2. Run the installer and launch the app.
3. Insert your MicroSD card (at least 8GB recommended) into your Windows PC.

### Step 2: Configure OS in Raspberry Pi Imager
1. **Choose Device**: Click and select **Raspberry Pi 3**.
2. **Choose OS**:
   - Click **Raspberry Pi OS (other)**.
   - Select **Raspberry Pi OS Lite (64-bit)** *(or 32-bit)*.
   *(Lite is essential: it avoids the heavy desktop GUI so your Pi 3B+ has plenty of RAM).*
3. **Choose Storage**: Select your plugged-in MicroSD card.
4. Click **NEXT**.

### Step 3: Apply OS Customization (Wi-Fi, User & SSH)
When prompted: *"Would you like to apply OS customization settings?"*:
1. Click **EDIT SETTINGS**.
2. In the **GENERAL** tab:
   - **Set hostname**: e.g., `famcal`
   - **Set username and password**: e.g., Username: `pi`, Password: your desired password.
   - **Configure wireless LAN**:
     - **SSID**: Type your home Wi-Fi network name.
     - **Password**: Type your home Wi-Fi password.
     - **Wireless LAN country**: Choose your country (e.g. `US` for United States).
3. In the **SERVICES** tab:
   - Check **Enable SSH**.
   - Select **Use password authentication**.
4. Click **SAVE**, then click **YES** to write the SD card.
5. Wait for the write and verification process to finish.

---

### Step 4: Complete Installation (Choose Option A or Option B)

#### Option A: Zero-Touch via Windows Batch Script (No SSH needed!)
Right after Raspberry Pi Imager finishes, Windows will show the SD card drive (e.g. `D:` or `E:` labeled `bootfs`):
1. In the `FamCal/pi-kiosk` folder, double-click **`setup-sdcard.bat`** (or open Command Prompt and run it).
2. Enter your SD card drive letter (e.g., `E:`).
3. Type the URL you want FamCal to display (or hit Enter to use the built-in local FamCal).
4. Select your display orientation (1 for portrait 9:16 wall monitor).
5. The script copies all kiosk files and configures the SD card to install everything automatically on first boot!
6. Safely Eject the SD card from Windows, insert it into your Raspberry Pi 3B+, and plug in power.
7. The Pi will boot, configure the kiosk OS, and open your URL in full screen!

#### Option B: Via SSH from Windows Terminal / PowerShell
1. Insert the freshly flashed SD card into your Raspberry Pi 3B+ and plug in the power and HDMI monitor.
2. The Pi will connect to your Wi-Fi automatically.
3. On Windows, press `Win + X` and open **PowerShell** or **Windows Terminal**.
4. Connect to the Pi:
   ```powershell
   ssh pi@famcal.local
   ```
   *(Enter the password you created in Raspberry Pi Imager).*
5. Run the one-line installer:
   ```bash
   git clone https://github.com/therealtomwoods/FamCal.git
   cd FamCal/pi-kiosk
   sudo ./install.sh
   ```
6. When prompted, reboot the Pi:
   ```bash
   sudo reboot
   ```
7. Done! The Pi boots directly into full-screen Chromium displaying FamCal.

---

## 📶 Setting Up & Changing Wi-Fi Connections

There are multiple convenient ways to set up or change Wi-Fi:

### 1. On-Screen Wi-Fi Manager (Via Hotkey on the Pi)
If you move your wall display to a new location or change your router:
1. Plug any USB keyboard into the Pi.
2. Press **`Ctrl+Alt+U`** or **`F8`**.
3. In the popup window, click the **"📶 Wi-Fi Setup"** tab.
4. Click **"🔄 Scan Networks"** — all available nearby Wi-Fi routers will appear in the dropdown list with signal strength.
5. Select your Wi-Fi network and enter the password.
6. Click **"Connect to Wi-Fi"**. The Pi connects immediately and updates your IP address on screen!

### 2. Pre-Configuration in Raspberry Pi Imager
Before booting for the first time, entering your Wi-Fi details in the OS Customization menu (as described in Step 3 above) connects the Pi to your Wi-Fi before it even launches.

### 3. Direct SD Card Drop (From Windows PC without booting)
If the Pi cannot connect to Wi-Fi and you don't have a keyboard:
1. Plug the SD card into your Windows PC.
2. Open the `bootfs` drive.
3. Create a text file named `wpa_supplicant.conf` with:
   ```text
   country=US
   ctrl_interface=DIR=/var/run/wpa_supplicant GROUP=netdev
   update_config=1

   network={
       ssid="Your-WiFi-Name"
       psk="Your-WiFi-Password"
   }
   ```
4. Save and eject. Raspberry Pi OS automatically imports this file on boot and connects!

### 4. Over SSH / Terminal (nmtui)
You can also run the standard NetworkManager visual utility:
```bash
sudo nmtui
```
Select "Activate a connection" to connect to any network.

---

## ⌨️ How to Configure the URL

### Option A: The On-Screen Hotkey Dialog (`Ctrl+Alt+U` or `F8`)
Whenever the kiosk is running:
1. Press **`Ctrl+Alt+U`** or **`F8`** on the keyboard.
2. Under the **"🌐 Kiosk URL & Display"** tab:
   - Displays the current active URL.
   - Shows current Wi-Fi/Ethernet IP address.
   - Allows typing or pasting any new URL.
   - Quick preset: **"🏠 Use Local FamCal (http://localhost:8080)"**.
   - Quick orientation buttons (Landscape 0°, Portrait Right 90°, Portrait Left 270°).
3. Click **"✓ Save & Launch URL"** or press **Enter**.
4. Chromium automatically reloads the new URL within 1 second!

### Option B: Direct SD Card Configuration (No Keyboard Needed)
1. Remove the SD card from the Pi and insert it into any Windows, Mac, or Linux computer.
2. Open the partition named **`bootfs`** or **`boot`**.
3. Open the file **`famcal-url.txt`** in Notepad.
4. Replace the URL with your desired address:
   ```text
   # FamCal Kiosk URL Configuration
   https://your-username.github.io/FamCal/
   ```
5. Save the file and insert the SD card back into the Pi.

### Option C: Command Line / SSH
```bash
famcal-url-config --set "https://your-url-here.com"
```

---

## 🔄 Screen Rotation (FamCal 9:16 Portrait Mode)

FamCal is specially tailored for 9:16 vertical wall displays. To rotate the display:
- **Hotkey**: Press **`Ctrl+Alt+R`** on the keyboard to toggle rotation.
- **On-Screen Menu**: Press `Ctrl+Alt+U` and click **"Portrait Right (90°)"**.
- **CLI**: Run `famcal-rotate right` (for 90° clockwise portrait) or `famcal-rotate normal` (for landscape).
- **Boot Drive**: Edit `famcal-orientation.txt` on the boot partition (`normal`, `right`, `inverted`, or `left`).

---

## 🛡️ Power Loss & SD Card Protection (100% Corruption Immunity)

When a wall display loses power abruptly (power outage or unplugging the power adapter), standard Linux operating systems risk filesystem corruption on SD cards. 

FamCal Kiosk OS is designed with multi-tier power loss protections:

1. **Suppressed Chromium Crash Reporting**:
   - `kiosk-launcher.sh` automatically cleans `Preferences` and `Local State` on boot and sets `"exited_cleanly": true` and `"exit_type": "Normal"`.
   - Passes `--disable-session-crashed-bubble` and `--noerrdialogs`.
2. **RAM-Based Browser Caching**:
   - Browser disk cache is written to a volatile `tmpfs` partition in RAM (`/tmp/chromium-cache`).
   - Prevents constant write cycles to the SD card and speeds up page rendering on 1GB RAM.
3. **Router Recovery Delay**:
   - Prevents premature load failures while your home Wi-Fi router is restarting after a blackout.
4. **Read-Only Root Filesystem (OverlayFS)**:
   - Once your setup is finalized, you can make the entire root filesystem read-only by running:
     ```bash
     sudo raspi-config nonint enable_overlayfs
     sudo reboot
     ```
   - With OverlayFS enabled, the SD card cannot be corrupted by power loss.
   - Your URL, Wi-Fi, and rotation settings remain editable because they are stored on the FAT32 boot partition or automatically remounted during edits!

---

## 🛠️ Diagnostics & Useful Commands

| Task | Command |
|---|---|
| View Kiosk Service Logs | `journalctl -u famcal-kiosk.service -f` |
| View Local Web Server Logs | `journalctl -u famcal-web.service -f` |
| Restart Browser / Kiosk | `sudo systemctl restart famcal-kiosk.service` |
| Scan Wi-Fi Networks | `famcal-url-config --wifi-scan` |
| Check Active URL | `famcal-url-config --get` |
| Set New URL | `famcal-url-config --set "https://example.com"` |
| Toggle Orientation | `famcal-rotate toggle` |
| Force Refresh Current Page | Press `F5` on keyboard |
| Safe Reboot | Press `Ctrl+Alt+Delete` or `Ctrl+Alt+B` |
