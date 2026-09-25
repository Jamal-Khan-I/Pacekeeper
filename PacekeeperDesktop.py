"""
Pacekeeper Desktop Application Launcher.
Bundles React Frontend + FastAPI Backend into a single native desktop app.
- Auto-starts backend server sidecar (port 8000)
- Auto-starts frontend server (port 5173)
- Opens Pacekeeper as a standalone native app window (no browser tabs, no manual uvicorn/npm commands required).
"""

import sys
import os
import time
import socket
import subprocess
import urllib.request

PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))
FRONTEND_DIR = os.path.join(PROJECT_ROOT, "frontend")
PYTHON_EXE = sys.executable


def is_port_open(port: int) -> bool:
    """Checks if a local port is currently listening."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(0.5)
        return s.connect_ex(('127.0.0.1', port)) == 0


def ensure_backend_running():
    """Starts FastAPI backend sidecar if not already running."""
    if is_port_open(8000):
        print("[Pacekeeper Desktop] Backend sidecar already active on port 8000.")
        return

    print("[Pacekeeper Desktop] Auto-starting FastAPI backend sidecar process...")
    cmd = [PYTHON_EXE, "-m", "uvicorn", "backend.app.main:app", "--host", "127.0.0.1", "--port", "8000"]
    subprocess.Popen(cmd, cwd=PROJECT_ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    # Wait for backend to accept connections
    for _ in range(15):
        if is_port_open(8000):
            print("[Pacekeeper Desktop] Backend sidecar initialized successfully.")
            return
        time.sleep(0.5)


def ensure_frontend_running():
    """Starts Vite frontend dev server if not already running."""
    if is_port_open(5173):
        print("[Pacekeeper Desktop] Frontend UI server already active on port 5173.")
        return

    print("[Pacekeeper Desktop] Auto-starting Frontend UI server...")
    cmd = ["cmd.exe", "/c", "npm", "run", "dev"]
    subprocess.Popen(cmd, cwd=FRONTEND_DIR, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    # Wait for frontend to accept connections
    for _ in range(15):
        if is_port_open(5173):
            print("[Pacekeeper Desktop] Frontend UI server initialized successfully.")
            return
        time.sleep(0.5)


def launch_native_window():
    """Launches Pacekeeper as a standalone native desktop app window."""
    app_url = "http://localhost:5173"
    print(f"[Pacekeeper Desktop] Opening native window for {app_url}...")

    # Look for Microsoft Edge or Chrome executable for native window mode
    edge_paths = [
        r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    ]

    browser_exe = None
    for p in edge_paths:
        if os.path.exists(p):
            browser_exe = p
            break

    if browser_exe:
        # App mode opens URL in a native desktop window without tabs or navigation bar
        cmd = [browser_exe, f"--app={app_url}", "--name=Pacekeeper Desktop", "--window-size=1300,850"]
        subprocess.Popen(cmd)
        print("[Pacekeeper Desktop] Native application window launched successfully!")
    else:
        # Fallback to default browser
        import webbrowser
        webbrowser.open(app_url)


def main():
    print("=" * 60)
    print(" PACEKEEPER NATIVE DESKTOP APPLICATION ")
    print("=" * 60)
    ensure_backend_running()
    ensure_frontend_running()
    launch_native_window()


if __name__ == "__main__":
    main()
