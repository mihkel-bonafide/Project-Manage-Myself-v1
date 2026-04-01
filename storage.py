import json
import os
import uuid
from typing import Any, Dict, List, Tuple, Optional

from config import DATA_FILE_PATH
from models import Milestone, Project, attach_milestones_to_projects


def ensure_data_file_initialized() -> None:
    if not DATA_FILE_PATH.exists():
        DATA_FILE_PATH.parent.mkdir(parents=True, exist_ok=True)
        _atomic_write({"projects": [], "milestones": []})


def _atomic_write(data: Dict[str, Any]) -> None:
    tmp_path = DATA_FILE_PATH.with_suffix(".tmp")
    with tmp_path.open("w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
    os.replace(tmp_path, DATA_FILE_PATH)


def _load_raw() -> Dict[str, Any]:
    ensure_data_file_initialized()
    with DATA_FILE_PATH.open("r", encoding="utf-8") as f:
        return json.load(f)


def _save_raw(data: Dict[str, Any]) -> None:
    _atomic_write(data)


def _deserialize(data: Dict[str, Any]) -> Tuple[List[Project], List[Milestone]]:
    projects = [Project(**p) for p in data.get("projects", [])]
    milestones = [Milestone(**m) for m in data.get("milestones", [])]
    return projects, milestones


def load_projects_with_milestones() -> List[Dict[str, Any]]:
    raw = _load_raw()
    projects, milestones = _deserialize(raw)
    return attach_milestones_to_projects(projects, milestones)


def add_project(
    name: str,
    description: str = "",
    color: str = "indigo",
    estimated_duration: Optional[str] = None,
) -> Dict[str, Any]:
    raw = _load_raw()
    projects, milestones = _deserialize(raw)
    project_id = str(uuid.uuid4())
    project = Project(
        id=project_id,
        name=name,
        description=description,
        color=color,
        estimated_duration=estimated_duration,
    )
    projects.append(project)
    _save_raw(
        {
            "projects": [p.to_dict() for p in projects],
            "milestones": [m.to_dict() for m in milestones],
        }
    )
    return project.to_dict()


def add_milestone(
    project_id: str,
    title: str,
    description: str = "",
    status: str = "backlog",
    due_date: Optional[str] = None,
    estimated_duration: Optional[str] = None,
) -> Dict[str, Any]:
    raw = _load_raw()
    projects, milestones = _deserialize(raw)

    if not any(p.id == project_id for p in projects):
        raise ValueError("Project not found")

    next_index = (
        max((m.order_index for m in milestones if m.project_id == project_id), default=-1)
        + 1
    )
    milestone_id = str(uuid.uuid4())
    milestone = Milestone(
        id=milestone_id,
        project_id=project_id,
        title=title,
        description=description,
        status=status,
        order_index=next_index,
        due_date=due_date,
        estimated_duration=estimated_duration,
    )
    milestones.append(milestone)

    _save_raw(
        {
            "projects": [p.to_dict() for p in projects],
            "milestones": [m.to_dict() for m in milestones],
        }
    )
    return milestone.to_dict()


def update_project(project_id: str, **fields: Any) -> Dict[str, Any]:
    raw = _load_raw()
    projects, milestones = _deserialize(raw)

    updated: Optional[Project] = None
    for p in projects:
        if p.id == project_id:
            for key, value in fields.items():
                if hasattr(p, key) and value is not None:
                    setattr(p, key, value)
            updated = p
            break

    if updated is None:
        raise ValueError("Project not found")

    _save_raw(
        {
            "projects": [p.to_dict() for p in projects],
            "milestones": [m.to_dict() for m in milestones],
        }
    )
    return updated.to_dict()


def archive_project(project_id: str) -> None:
    raw = _load_raw()
    projects, milestones = _deserialize(raw)

    found = False
    for p in projects:
        if p.id == project_id:
            p.archived = True
            found = True
            break

    if not found:
        raise ValueError("Project not found")

    _save_raw(
        {
            "projects": [p.to_dict() for p in projects],
            "milestones": [m.to_dict() for m in milestones],
        }
    )


def reorder_project_board(project_id: str, columns: Dict[str, List[str]]) -> None:
    """Apply full column order: each milestone id appears exactly once across backlog, in_progress, done."""
    required = ("backlog", "in_progress", "done")
    if set(columns.keys()) != set(required):
        raise ValueError("columns must contain backlog, in_progress, and done")

    raw = _load_raw()
    projects, milestones = _deserialize(raw)

    if not any(p.id == project_id for p in projects):
        raise ValueError("Project not found")

    project_ms = [m for m in milestones if m.project_id == project_id]
    id_set = {m.id for m in project_ms}
    id_to_milestone = {m.id: m for m in project_ms}

    seen: set[str] = set()
    for status in required:
        ids = columns.get(status) or []
        for mid in ids:
            if mid in seen:
                raise ValueError("Duplicate milestone id in reorder payload")
            if mid not in id_set:
                raise ValueError("Unknown milestone id in reorder payload")
            seen.add(mid)

    if seen != id_set:
        raise ValueError("Reorder payload must list each project milestone exactly once")

    for status in required:
        ids = columns[status]
        for i, mid in enumerate(ids):
            m = id_to_milestone[mid]
            m.status = status
            m.order_index = i

    _save_raw(
        {
            "projects": [p.to_dict() for p in projects],
            "milestones": [m.to_dict() for m in milestones],
        }
    )


def update_milestone(milestone_id: str, **fields: Any) -> Dict[str, Any]:
    raw = _load_raw()
    projects, milestones = _deserialize(raw)

    updated: Optional[Milestone] = None
    for m in milestones:
        if m.id == milestone_id:
            for key, value in fields.items():
                if hasattr(m, key) and value is not None:
                    setattr(m, key, value)
            updated = m
            break

    if updated is None:
        raise ValueError("Milestone not found")

    _save_raw(
        {
            "projects": [p.to_dict() for p in projects],
            "milestones": [m.to_dict() for m in milestones],
        }
    )
    return updated.to_dict()


