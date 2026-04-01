"""Spawn additional PMM Flask processes on free ports (local / dev use)."""

from __future__ import annotations

import errno
import os
import socket
import subprocess
import sys
import time
from pathlib import Path

# Spawned instances use high ports to avoid colliding with common local services.
SPAWNED_PM_PORT_MIN = 50101


def _env_for_spawned_child() -> dict[str, str]:
    """
    Copy the parent environment but drop Werkzeug reloader variables.

    If the parent is `python app.py` / `flask run` with the reloader, the worker
    process sets WERKZEUG_RUN_MAIN and WERKZEUG_SERVER_FD. A spawned child would
    inherit those and Werkzeug would try socket.fromfd() on a bogus FD → WinError
    10038 on Windows.
    """
    return {
        k: v
        for k, v in os.environ.items()
        if not k.startswith("WERKZEUG_")
    }


def _no_active_listener(host: str, port: int) -> bool:
    """
    True if nothing is accepting TCP on this port (child can bind it).

    We avoid bind()-probing the port in the parent: on Windows a bind test can
    leave the port in a state where the child's Flask bind fails or races.
    """
    try:
        with socket.create_connection((host, port), timeout=0.25):
            return False
    except ConnectionRefusedError:
        return True
    except TimeoutError:
        return True
    except OSError as exc:
        if sys.platform == "win32" and getattr(exc, "winerror", None) == 10061:
            return True
        if exc.errno == errno.ECONNREFUSED:
            return True
        return True


def find_next_available_port(start_port: int, host: str = "127.0.0.1") -> int:
    port = max(1, int(start_port))
    for _ in range(8192):
        if _no_active_listener(host, port):
            return port
        port += 1
    raise RuntimeError("No free TCP port found in range")


def _read_log_tail(path: Path, max_chars: int = 5000) -> str:
    try:
        text = path.read_text(encoding="utf-8", errors="replace")
        if len(text) > max_chars:
            return "…\n" + text[-max_chars:]
        return text or "(empty log)"
    except OSError as exc:
        return f"(could not read log: {exc})"


def _wait_for_child_http_listener(
    proc: subprocess.Popen,
    host: str,
    port: int,
    log_path: Path,
    timeout_sec: float = 45.0,
) -> None:
    deadline = time.monotonic() + timeout_sec
    delay = 0.1
    while time.monotonic() < deadline:
        rc = proc.poll()
        if rc is not None:
            tail = _read_log_tail(log_path)
            raise RuntimeError(
                f"Child process exited with code {rc} before listening on {host}:{port}. "
                f"Output log ({log_path}):\n{tail}"
            )
        try:
            with socket.create_connection((host, port), timeout=0.3):
                return
        except OSError:
            time.sleep(delay)
            delay = min(delay * 1.12, 0.45)
    tail = _read_log_tail(log_path)
    raise RuntimeError(
        f"Nothing accepted connections on {host}:{port} within {timeout_sec:.0f}s. "
        f"Output log ({log_path}):\n{tail}"
    )


def spawn_new_instance(display_name: str, base_dir: Path, after_port: int) -> tuple[int, str]:
    display_name = (display_name or "").strip()
    if not display_name:
        raise ValueError("Instance name is required")

    first_try = max(after_port + 1, SPAWNED_PM_PORT_MIN)
    next_port = find_next_available_port(first_try)
    data_filename = f"pmm-{next_port}.json"

    env = _env_for_spawned_child()
    env["PMM_PORT"] = str(next_port)
    env["PMM_INSTANCE_TITLE"] = display_name
    env["PMM_DATA_FILE"] = data_filename
    env["PMM_CHILD_INSTANCE"] = "1"

    app_py = (base_dir / "app.py").resolve()
    cmd = [sys.executable, "-u", str(app_py)]

    data_dir = base_dir / "data"
    data_dir.mkdir(parents=True, exist_ok=True)
    log_path = data_dir / f".pmm-spawn-{next_port}.log"

    # Background child with all output to a log file (reliable on Windows).
    # Avoid CREATE_NEW_CONSOLE — it often prevents a clean Flask start when the
    # parent is itself a Flask / IDE subprocess.
    with open(log_path, "w", encoding="utf-8") as log_f:
        popen_kw: dict = {
            "cwd": str(base_dir),
            "env": env,
            "stdin": subprocess.DEVNULL,
            "stdout": log_f,
            "stderr": subprocess.STDOUT,
        }
        if sys.platform == "win32":
            if hasattr(subprocess, "CREATE_NO_WINDOW"):
                popen_kw["creationflags"] = subprocess.CREATE_NO_WINDOW
        else:
            popen_kw["start_new_session"] = True

        proc = subprocess.Popen(cmd, **popen_kw)

    host = "127.0.0.1"
    _wait_for_child_http_listener(proc, host, next_port, log_path)
    url = f"http://{host}:{next_port}/"
    return next_port, url
