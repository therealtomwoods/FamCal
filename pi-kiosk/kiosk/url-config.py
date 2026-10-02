#!/usr/bin/env python3
"""
FamCal Kiosk — URL, Display & Wi-Fi Configuration Utility
Triggered via Hotkey (Ctrl+Alt+U or F8) or command-line.
Provides an interactive GUI to configure:
1. Target Kiosk URL & Presets
2. Screen Rotation (0° Landscape / 90° & 270° Portrait for FamCal 9:16 layout)
3. Wi-Fi Network Scanning, Selection, and Connection
All settings are persistently saved across power cycles and sudden power loss.
"""

import os
import sys
import subprocess
import shutil
import socket
import threading
import time

# Configuration paths in priority order
CONFIG_PATHS = [
    "/boot/firmware/famcal-url.txt",  # Bookworm FAT32 boot partition (writable & editable on PC/Mac)
    "/boot/famcal-url.txt",           # Bullseye/Buster boot partition
    "/etc/famcal-kiosk/url.conf",     # System-wide configuration
    os.path.expanduser("~/.config/famcal-kiosk/url.conf") # User configuration
]

ORIENTATION_PATHS = [
    "/boot/firmware/famcal-orientation.txt",
    "/boot/famcal-orientation.txt",
    "/etc/famcal-kiosk/orientation.conf"
]

DEFAULT_URL = "http://localhost:8080"


def get_current_url():
    """Reads the configured URL from persistent files, falling back to default."""
    for path in CONFIG_PATHS:
        if os.path.exists(path):
            try:
                with open(path, "r", encoding="utf-8") as f:
                    for line in f:
                        line = line.strip()
                        if line and not line.startswith("#"):
                            return line
            except Exception:
                pass
    return DEFAULT_URL


def get_current_orientation():
    """Reads the configured screen orientation: normal, right, left, inverted."""
    for path in ORIENTATION_PATHS:
        if os.path.exists(path):
            try:
                with open(path, "r", encoding="utf-8") as f:
                    content = f.read().strip().lower()
                    if content in ["normal", "right", "left", "inverted"]:
                        return content
            except Exception:
                pass
    return "normal"


def get_network_ip():
    """Returns local IP addresses for display in the configuration window."""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.settimeout(0.5)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "Not Connected / Offline"


def get_current_wifi_ssid():
    """Gets the currently connected Wi-Fi SSID if available."""
    if shutil.which("nmcli"):
        try:
            res = subprocess.run(
                ["nmcli", "-t", "-f", "ACTIVE,SSID", "dev", "wifi"],
                stdout=subprocess.PIPE,
                stderr=subprocess.DEVNULL,
                text=True,
                timeout=3
            )
            for line in res.stdout.strip().split("\n"):
                if line.startswith("yes:"):
                    return line.split(":", 1)[1].strip()
        except Exception:
            pass

    if shutil.which("iwgetid"):
        try:
            res = subprocess.run(["iwgetid", "-r"], stdout=subprocess.PIPE, text=True, timeout=2)
            ssid = res.stdout.strip()
            if ssid:
                return ssid
        except Exception:
            pass

    return "None (Disconnected)"


def scan_wifi_networks():
    """Scans and returns a list of unique Wi-Fi network dictionaries."""
    networks = []
    seen = set()

    if shutil.which("nmcli"):
        try:
            # Trigger background rescan
            subprocess.run(["nmcli", "dev", "wifi", "rescan"], stderr=subprocess.DEVNULL, timeout=4)
            res = subprocess.run(
                ["nmcli", "-t", "-f", "SSID,SIGNAL,SECURITY,IN-USE", "dev", "wifi", "list"],
                stdout=subprocess.PIPE,
                stderr=subprocess.DEVNULL,
                text=True,
                timeout=5
            )
            for line in res.stdout.strip().split("\n"):
                parts = line.split(":")
                if len(parts) >= 3:
                    ssid = parts[0].strip()
                    signal = parts[1].strip()
                    sec = parts[2].strip() or "Open"
                    in_use = (len(parts) >= 4 and parts[3].strip() == "*")
                    if ssid and ssid not in seen:
                        seen.add(ssid)
                        networks.append({
                            "ssid": ssid,
                            "signal": signal,
                            "security": sec,
                            "active": in_use
                        })
            return networks
        except Exception:
            pass

    return networks


def connect_wifi(ssid, password):
    """Attempts to connect to a Wi-Fi network using nmcli or raspi-config."""
    if shutil.which("nmcli"):
        try:
            cmd = ["sudo", "nmcli", "dev", "wifi", "connect", ssid]
            if password:
                cmd.extend(["password", password])
            res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=25)
            if res.returncode == 0:
                return True, "Connected successfully!"
            else:
                err = res.stderr.strip() or res.stdout.strip()
                return False, f"Failed: {err}"
        except Exception as e:
            return False, f"Error: {e}"

    # Fallback to raspi-config
    try:
        res = subprocess.run(["sudo", "raspi-config", "nonint", "do_wifi_ssid_passphrase", ssid, password], timeout=15)
        if res.returncode == 0:
            return True, "Wi-Fi configured! Connecting..."
        return False, "Failed to apply Wi-Fi configuration."
    except Exception as e:
        return False, f"Error: {e}"


def normalize_url(url):
    """Ensures URL has a proper scheme."""
    url = url.strip()
    if not url:
        return DEFAULT_URL
    if not (url.startswith("http://") or url.startswith("https://") or url.startswith("file://")):
        if "localhost" in url or url.startswith("127.") or url.startswith("192.168.") or url.startswith("10."):
            url = "http://" + url
        else:
            url = "https://" + url
    return url


def save_url(new_url):
    """Saves URL to persistent boot/system configs and handles read-only FS."""
    new_url = normalize_url(new_url)
    saved = False

    for path in CONFIG_PATHS:
        target_dir = os.path.dirname(path)
        if not os.path.exists(target_dir):
            try:
                os.makedirs(target_dir, exist_ok=True)
            except Exception:
                continue

        is_boot = "/boot" in path
        if is_boot:
            subprocess.run(["sudo", "mount", "-o", "remount,rw", target_dir], stderr=subprocess.DEVNULL)

        try:
            with open(path, "w", encoding="utf-8") as f:
                f.write(f"# FamCal Kiosk URL Configuration\n{new_url}\n")
            saved = True
        except PermissionError:
            try:
                cmd = f"echo '{new_url}' | sudo tee '{path}' > /dev/null"
                subprocess.run(cmd, shell=True, check=True)
                saved = True
            except Exception:
                pass
        except Exception:
            pass

    return saved


def save_orientation(orientation):
    """Saves screen orientation setting."""
    for path in ORIENTATION_PATHS:
        target_dir = os.path.dirname(path)
        if os.path.exists(target_dir):
            try:
                cmd = f"echo '{orientation}' | sudo tee '{path}' > /dev/null"
                subprocess.run(cmd, shell=True)
            except Exception:
                pass


def restart_browser():
    """Restarts Chromium to apply the new URL immediately."""
    subprocess.run(["pkill", "-TERM", "-f", "chromium"], stderr=subprocess.DEVNULL)


def apply_orientation(orientation):
    """Applies xrandr screen rotation immediately."""
    save_orientation(orientation)
    subprocess.run(["xrandr", "-o", orientation], stderr=subprocess.DEVNULL)


def launch_gui():
    """Launches Tkinter GUI dialog with URL configuration and Wi-Fi manager."""
    import tkinter as tk
    from tkinter import ttk, messagebox

    root = tk.Tk()
    root.title("FamCal Kiosk — System & Network Setup")
    root.geometry("680x540")
    root.configure(bg="#0f172a")  # Dark slate
    root.attributes("-topmost", True)
    root.resizable(False, False)

    # Center dialog on screen
    root.update_idletasks()
    width = 680
    height = 540
    screen_width = root.winfo_screenwidth()
    screen_height = root.winfo_screenheight()
    x = (screen_width // 2) - (width // 2)
    y = (screen_height // 2) - (height // 2)
    root.geometry(f"{width}x{height}+{x}+{y}")

    # Header Card
    header_frame = tk.Frame(root, bg="#1e293b", padx=20, pady=12)
    header_frame.pack(fill="x", padx=14, pady=(14, 8))

    title_label = tk.Label(
        header_frame,
        text="📅 FamCal Kiosk Display & Network Setup",
        font=("Helvetica", 16, "bold"),
        fg="#38bdf8",
        bg="#1e293b"
    )
    title_label.pack(anchor="w")

    ip_str = get_network_ip()
    ssid_str = get_current_wifi_ssid()
    status_label = tk.Label(
        header_frame,
        text=f"Wi-Fi: {ssid_str}  •  IP: {ip_str}  •  Raspberry Pi 3B+",
        font=("Helvetica", 10),
        fg="#94a3b8",
        bg="#1e293b"
    )
    status_label.pack(anchor="w", pady=(3, 0))

    # Styled Notebook Tabs
    style = ttk.Style()
    style.theme_use("default")
    style.configure("TNotebook", background="#0f172a", borderwidth=0)
    style.configure("TNotebook.Tab", background="#334155", foreground="#ffffff", font=("Helvetica", 11, "bold"), padding=[16, 6])
    style.map("TNotebook.Tab", background=[("selected", "#0284c7")], foreground=[("selected", "#ffffff")])

    notebook = ttk.Notebook(root)
    notebook.pack(fill="both", expand=True, padx=14, pady=4)

    # =========================================================================
    # TAB 1: KIOSK URL & SCREEN ORIENTATION
    # =========================================================================
    tab_url = tk.Frame(notebook, bg="#0f172a", padx=16, pady=12)
    notebook.add(tab_url, text="🌐 Kiosk URL & Display")

    lbl_url = tk.Label(
        tab_url,
        text="Target Kiosk URL:",
        font=("Helvetica", 12, "bold"),
        fg="#f1f5f9",
        bg="#0f172a"
    )
    lbl_url.pack(anchor="w", pady=(0, 4))

    entry_var = tk.StringVar(value=get_current_url())
    url_entry = tk.Entry(
        tab_url,
        textvariable=entry_var,
        font=("Helvetica", 12),
        bg="#1e293b",
        fg="#ffffff",
        insertbackground="#38bdf8",
        relief="flat",
        bd=8
    )
    url_entry.pack(fill="x", ipady=4)
    url_entry.focus_set()
    url_entry.select_range(0, tk.END)

    # Preset Buttons
    preset_frame = tk.Frame(tab_url, bg="#0f172a", pady=6)
    preset_frame.pack(fill="x")

    def set_local_url():
        entry_var.set("http://localhost:8080")
        url_entry.focus_set()

    def clear_url():
        entry_var.set("")
        url_entry.focus_set()

    btn_local = tk.Button(
        preset_frame,
        text="🏠 Use Local FamCal (http://localhost:8080)",
        font=("Helvetica", 9),
        bg="#334155",
        fg="#f8fafc",
        relief="flat",
        command=set_local_url,
        padx=10,
        pady=3
    )
    btn_local.pack(side="left", padx=(0, 8))

    btn_clear = tk.Button(
        preset_frame,
        text="✕ Clear",
        font=("Helvetica", 9),
        bg="#334155",
        fg="#f8fafc",
        relief="flat",
        command=clear_url,
        padx=8,
        pady=3
    )
    btn_clear.pack(side="left")

    # Screen Orientation Section
    orient_frame = tk.Frame(tab_url, bg="#1e293b", padx=14, pady=10)
    orient_frame.pack(fill="x", pady=12)

    lbl_orient = tk.Label(
        orient_frame,
        text="Screen Rotation (FamCal 9:16 Portrait Mode):",
        font=("Helvetica", 10, "bold"),
        fg="#e2e8f0",
        bg="#1e293b"
    )
    lbl_orient.pack(anchor="w", pady=(0, 6))

    orient_btn_frame = tk.Frame(orient_frame, bg="#1e293b")
    orient_btn_frame.pack(anchor="w")

    current_orient = get_current_orientation()

    def rotate_to(mode):
        apply_orientation(mode)
        lbl_orient_status.config(text=f"Active: {mode.upper()}")

    btn_landscape = tk.Button(
        orient_btn_frame,
        text="Landscape (0°)",
        font=("Helvetica", 9),
        bg="#475569",
        fg="#ffffff",
        relief="flat",
        padx=8,
        pady=3,
        command=lambda: rotate_to("normal")
    )
    btn_landscape.pack(side="left", padx=(0, 6))

    btn_portrait_r = tk.Button(
        orient_btn_frame,
        text="Portrait Right (90°)",
        font=("Helvetica", 9),
        bg="#475569",
        fg="#ffffff",
        relief="flat",
        padx=8,
        pady=3,
        command=lambda: rotate_to("right")
    )
    btn_portrait_r.pack(side="left", padx=(0, 6))

    btn_portrait_l = tk.Button(
        orient_btn_frame,
        text="Portrait Left (270°)",
        font=("Helvetica", 9),
        bg="#475569",
        fg="#ffffff",
        relief="flat",
        padx=8,
        pady=3,
        command=lambda: rotate_to("left")
    )
    btn_portrait_l.pack(side="left", padx=(0, 6))

    lbl_orient_status = tk.Label(
        orient_frame,
        text=f"Active: {current_orient.upper()}",
        font=("Helvetica", 9, "italic"),
        fg="#38bdf8",
        bg="#1e293b"
    )
    lbl_orient_status.pack(anchor="w", pady=(4, 0))

    # =========================================================================
    # TAB 2: WI-FI SETUP & NETWORKING
    # =========================================================================
    tab_wifi = tk.Frame(notebook, bg="#0f172a", padx=16, pady=12)
    notebook.add(tab_wifi, text="📶 Wi-Fi Setup")

    wifi_top_frame = tk.Frame(tab_wifi, bg="#0f172a")
    wifi_top_frame.pack(fill="x", pady=(0, 6))

    lbl_wifi_select = tk.Label(
        wifi_top_frame,
        text="Select Available Wi-Fi Network:",
        font=("Helvetica", 11, "bold"),
        fg="#f1f5f9",
        bg="#0f172a"
    )
    lbl_wifi_select.pack(side="left")

    wifi_list_var = tk.StringVar()
    wifi_combobox = ttk.Combobox(
        tab_wifi,
        textvariable=wifi_list_var,
        font=("Helvetica", 11),
        state="readonly"
    )
    wifi_combobox.pack(fill="x", pady=(0, 8))

    wifi_pass_frame = tk.Frame(tab_wifi, bg="#0f172a")
    wifi_pass_frame.pack(fill="x", pady=(0, 6))

    lbl_pass = tk.Label(
        wifi_pass_frame,
        text="Wi-Fi Password:",
        font=("Helvetica", 11, "bold"),
        fg="#f1f5f9",
        bg="#0f172a"
    )
    lbl_pass.pack(side="left")

    wifi_pass_var = tk.StringVar()
    wifi_pass_entry = tk.Entry(
        tab_wifi,
        textvariable=wifi_pass_var,
        show="•",
        font=("Helvetica", 12),
        bg="#1e293b",
        fg="#ffffff",
        insertbackground="#38bdf8",
        relief="flat",
        bd=6
    )
    wifi_pass_entry.pack(fill="x", ipady=3, pady=(0, 6))

    show_pass_var = tk.BooleanVar(value=False)
    def toggle_show_password():
        if show_pass_var.get():
            wifi_pass_entry.config(show="")
        else:
            wifi_pass_entry.config(show="•")

    chk_show = tk.Checkbutton(
        tab_wifi,
        text="Show Password",
        variable=show_pass_var,
        command=toggle_show_password,
        font=("Helvetica", 9),
        fg="#94a3b8",
        bg="#0f172a",
        selectcolor="#1e293b",
        activebackground="#0f172a",
        activeforeground="#ffffff"
    )
    chk_show.pack(anchor="w", pady=(0, 10))

    wifi_status_lbl = tk.Label(
        tab_wifi,
        text="Click 'Scan Wi-Fi Networks' to search for nearby Wi-Fi routers.",
        font=("Helvetica", 9, "italic"),
        fg="#94a3b8",
        bg="#0f172a"
    )
    wifi_status_lbl.pack(anchor="w", pady=(0, 10))

    def do_scan_wifi():
        wifi_status_lbl.config(text="Scanning for Wi-Fi networks... please wait", fg="#38bdf8")
        root.update()

        def scan_worker():
            nets = scan_wifi_networks()
            if not nets:
                wifi_status_lbl.config(text="No Wi-Fi networks found. Verify Wi-Fi is enabled.", fg="#f87171")
                return

            items = []
            for n in nets:
                active_mark = " ✓ [Connected]" if n["active"] else ""
                items.append(f"{n['ssid']} ({n['signal']}% signal, {n['security']}){active_mark}")

            wifi_combobox["values"] = items
            if items:
                wifi_combobox.current(0)
            wifi_status_lbl.config(text=f"Found {len(items)} networks. Pick your network and enter password.", fg="#4ade80")

        threading.Thread(target=scan_worker, daemon=True).start()

    def do_connect_wifi():
        selected = wifi_list_var.get().strip()
        if not selected:
            messagebox.showwarning("Wi-Fi Error", "Please select a Wi-Fi network from the list first.")
            return

        ssid = selected.split(" (")[0].strip()
        password = wifi_pass_var.get().strip()

        wifi_status_lbl.config(text=f"Connecting to '{ssid}'...", fg="#38bdf8")
        root.update()

        def connect_worker():
            success, msg = connect_wifi(ssid, password)
            if success:
                time.sleep(1)
                new_ip = get_network_ip()
                wifi_status_lbl.config(text=f"✓ Connected to {ssid}! IP: {new_ip}", fg="#4ade80")
                status_label.config(text=f"Wi-Fi: {ssid}  •  IP: {new_ip}  •  Raspberry Pi 3B+")
            else:
                wifi_status_lbl.config(text=f"✕ Connection failed: {msg}", fg="#f87171")

        threading.Thread(target=connect_worker, daemon=True).start()

    wifi_btn_frame = tk.Frame(tab_wifi, bg="#0f172a")
    wifi_btn_frame.pack(fill="x")

    btn_scan = tk.Button(
        wifi_btn_frame,
        text="🔄 Scan Networks",
        font=("Helvetica", 9, "bold"),
        bg="#334155",
        fg="#ffffff",
        relief="flat",
        padx=10,
        pady=5,
        command=do_scan_wifi
    )
    btn_scan.pack(side="left", padx=(0, 8))

    btn_connect = tk.Button(
        wifi_btn_frame,
        text="Connect to Wi-Fi",
        font=("Helvetica", 9, "bold"),
        bg="#0284c7",
        fg="#ffffff",
        relief="flat",
        padx=12,
        pady=5,
        command=do_connect_wifi
    )
    btn_connect.pack(side="left")

    # =========================================================================
    # BOTTOM ACTION / SAVE BAR
    # =========================================================================
    action_frame = tk.Frame(root, bg="#0f172a", padx=16, pady=12)
    action_frame.pack(fill="x", side="bottom")

    def do_save(event=None):
        target_url = entry_var.get().strip()
        if not target_url:
            target_url = DEFAULT_URL
        target_url = normalize_url(target_url)

        save_url(target_url)
        restart_browser()
        root.destroy()

    def do_cancel(event=None):
        root.destroy()

    root.bind("<Return>", do_save)
    root.bind("<Escape>", do_cancel)

    btn_save = tk.Button(
        action_frame,
        text="✓ Save & Launch URL",
        font=("Helvetica", 11, "bold"),
        bg="#0284c7",
        fg="#ffffff",
        activebackground="#0369a1",
        activeforeground="#ffffff",
        relief="flat",
        padx=16,
        pady=7,
        command=do_save
    )
    btn_save.pack(side="right", padx=(8, 0))

    btn_cancel = tk.Button(
        action_frame,
        text="Cancel (Esc)",
        font=("Helvetica", 10),
        bg="#334155",
        fg="#cbd5e1",
        relief="flat",
        padx=12,
        pady=7,
        command=do_cancel
    )
    btn_cancel.pack(side="right")

    hotkey_hint = tk.Label(
        action_frame,
        text="Hotkey: Ctrl+Alt+U or F8",
        font=("Helvetica", 9),
        fg="#64748b",
        bg="#0f172a"
    )
    hotkey_hint.pack(side="left")

    # Trigger initial scan in background
    root.after(300, do_scan_wifi)

    root.mainloop()


def launch_zenity_fallback():
    """Fallback dialog if Python Tkinter is not installed."""
    current = get_current_url()
    try:
        res = subprocess.run(
            [
                "zenity",
                "--entry",
                "--title=FamCal Kiosk URL Setup",
                f"--text=Current URL: {current}\n\nEnter the new Kiosk URL (Hotkey: Ctrl+Alt+U / F8):",
                f"--entry-text={current}",
                "--width=500"
            ],
            stdout=subprocess.PIPE,
            text=True
        )
        if res.returncode == 0:
            new_url = res.stdout.strip()
            if new_url:
                save_url(new_url)
                restart_browser()
    except Exception as e:
        print(f"Error launching zenity: {e}", file=sys.stderr)


def main():
    if len(sys.argv) > 1:
        arg = sys.argv[1].strip()
        if arg in ["--get", "-g"]:
            print(get_current_url())
            return
        elif arg in ["--set", "-s"] and len(sys.argv) > 2:
            new_url = sys.argv[2].strip()
            save_url(new_url)
            restart_browser()
            print(f"URL updated to: {normalize_url(new_url)}")
            return
        elif arg in ["--wifi-scan"]:
            for n in scan_wifi_networks():
                print(f"{n['ssid']} | {n['signal']}% | {n['security']}")
            return
        elif arg in ["--help", "-h"]:
            print("FamCal Kiosk URL & Wi-Fi Configurator")
            print("Usage:")
            print("  url-config.py             Launch graphical configuration dialog")
            print("  url-config.py --get       Print active URL")
            print("  url-config.py --set <url> Set URL from command line")
            print("  url-config.py --wifi-scan Scan available Wi-Fi networks")
            return

    try:
        launch_gui()
    except ImportError:
        if shutil.which("zenity"):
            launch_zenity_fallback()
        else:
            print("GUI not available. Use: url-config.py --set <URL>", file=sys.stderr)


if __name__ == "__main__":
    main()
