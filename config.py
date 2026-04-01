import os
from pathlib import Path

BASE_DIR = Path(__file__).parent.resolve()
DATA_DIR = BASE_DIR / "data"

_pmm_data = os.environ.get("PMM_DATA_FILE", "").strip()
if _pmm_data:
    p = Path(_pmm_data)
    DATA_FILE_PATH = (p if p.is_absolute() else (DATA_DIR / p.name)).resolve()
else:
    DATA_FILE_PATH = (DATA_DIR / "pmm.json").resolve()

_title = os.environ.get("PMM_INSTANCE_TITLE", "").strip()
INSTANCE_DISPLAY_TITLE = _title if _title else "Project Manage Myself"

# Set by instance_spawner for extra servers (50101+); drives header subtitle text.
IS_SPAWNED_INSTANCE = os.environ.get("PMM_CHILD_INSTANCE") == "1"

