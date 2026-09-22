# 📅 FamCal — 9:16 Portrait Family Organizer & Smart Wall Display

> A modern, glanceable Progressive Web App (PWA) designed for full-screen portrait wall monitors, smart tablets (fridge, countertop, entryway), and mobile devices.

---

## ✨ Key Features

1. **9:16 Portrait Smart Wall Layout**:
   - Tailored specifically for portrait aspect ratio (1080x1920 or vertical tablets).
   - Includes a desktop framing preview mode with ambient glow for testing on standard widescreen monitors.

2. **Top 1/3: Google Photos Album Slideshow**:
   - Smooth crossfade transitions between family photos.
   - Built-in **Album Selector** allowing you to pick any Google Photos album.
   - Subtle overlays showing date taken, caption, and album name.
   - Configurable slideshow rotation interval (5s to 60s).

3. **Bottom 2/3: High-Glanceability Family Agenda**:
   - Easy-to-read agenda grouping: **TODAY**, **TOMORROW**, and upcoming days.
   - **Prominent Location Indicator**: Beside each event title, displays a high-contrast location badge (address, venue, room) with an interactive Google Maps shortcut.
   - **Google Calendar Colors**: Faithfully maps each event and calendar to its native Google Calendar color palette (Tomato, Basil, Flamingo, Peacock, etc.).
   - Multi-calendar support: Toggle any combination of Primary, Secondary (e.g. family members, sports), or Subscribed (school district, holidays) calendars.
   - "Happening Now" live pulse badge for ongoing events.

4. **Floating Ambient Add-on Widgets**:
   - **Live Weather**: Current temperature, high/low, conditions icon, and humidity powered by Open-Meteo (zero API keys needed!).
   - **Stock Ticker**: Horizontal marquee ticker displaying family favorite symbols (e.g., S&P 500, AAPL, GOOGL, NVDA) with real-time price & percentage gain indicators.
   - **Nest Smart Thermostat**: Living room thermostat display showing ambient temp, target setpoint, heating/cooling status, and quick adjustments.
   - **Digital Clock & Date**: Large, stylish time chip with 12h/24h toggle.

5. **Kiosk & Wall Display Controls**:
   - **Screen Wake Lock API**: Keep the screen awake 24/7 on wall tablets without dimming or sleeping.
   - **Fullscreen Kiosk Mode**: Borderless edge-to-edge view hiding browser tabs and navigation bars.
   - **Dual Live & Demo Mode**: Immediate out-of-the-box demo mode with realistic family schedule and photos, ready for instant preview before setting up Google Cloud keys.

---

## 🚀 Hosting & Deployment Guide

### Hosting on GitHub Pages (Recommended)

GitHub Pages is the optimal hosting solution for FamCal:
- **Free**: 100% free static hosting with zero servers or maintenance.
- **HTTPS Enabled**: Required by web browsers for Progressive Web Apps (PWA), Service Workers, and Google OAuth 2.0.
- **Automated**: The repository includes `.github/workflows/deploy.yml` which automatically builds and deploys your PWA whenever you push to `main`.

#### How to Deploy:
1. Initialize git and push this repository to GitHub:
   ```bash
   git init
   git add .
   git commit -m "Initial commit of FamCal PWA"
   git branch -M main
   git remote add origin https://github.com/<your-username>/<your-repo-name>.git
   git push -u origin main
   ```
2. In your GitHub repository:
   - Go to **Settings** → **Pages**.
   - Under **Build and deployment** → **Source**, select **GitHub Actions**.
3. GitHub Actions will run the workflow and publish your app to:
   ```
   https://<your-username>.github.io/<your-repo-name>/
   ```

---

## 🔑 Google OAuth 2.0 Setup

FamCal uses client-side Google Identity Services (GIS) with direct Google API requests (zero backend required).

1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project (e.g., `Family Calendar Display`).
3. In **APIs & Services** → **Library**, enable:
   - **Google Calendar API**
   - **Photos Library API**
4. In **APIs & Services** → **Credentials**:
   - Click **Create Credentials** → **OAuth client ID**.
   - Application type: **Web application**.
   - Name: `FamCal Web Client`.
   - Under **Authorized JavaScript origins**, add:
     - `https://<your-username>.github.io`
     - `http://localhost:5173` (for local development)
5. Copy your **Client ID** (format: `xxxxxxxxxxxx-xxxxxxxxxxxxxxxx.apps.googleusercontent.com`).
6. In FamCal:
   - Tap the **Settings** gear icon (bottom right).
   - Go to the **Google Account** tab.
   - Paste your **Client ID** and tap **Save**.
   - Click **Sign in with Google** to authorize your account.

---

## 📱 Installing as a PWA (Full-Screen Kiosk Mode)

- **On Android / Google Chrome**:
  - Open your deployed URL.
  - Tap the three-dot menu and select **"Install app"** or **"Add to Home screen"**.
  - Open the app from your home screen — it will launch in full-screen portrait kiosk mode without browser address bars!
- **On iPad / iPhone (Safari)**:
  - Open the URL in Safari.
  - Tap the **Share** button and select **"Add to Home Screen"**.
- **On Wall-Mounted Tablet**:
  - Install the PWA.
  - Tap the **Sun icon** in the bottom control bar to activate **Screen Wake Lock**, ensuring the wall tablet stays on 24/7.

---

## 🛠 Local Development

```bash
# Install dependencies
npm install --no-bin-links

# Start local development server
npm run dev

# Build production bundle & PWA assets
npm run build

# Preview production build locally
npm run preview
```
