from __future__ import annotations

from dataclasses import dataclass, asdict, field
from datetime import datetime
from typing import List, Optional


def _now_iso() -> str:
    return datetime.utcnow().isoformat() + "Z"


@dataclass
class Milestone:
    id: str
    project_id: str
    title: str
    description: str = ""
    status: str = "backlog"  # backlog | in_progress | done
    order_index: int = 0
    due_date: Optional[str] = None  # ISO date string or None
    estimated_duration: Optional[str] = None
    created_at: str = field(default_factory=_now_iso)
    updated_at: str = field(default_factory=_now_iso)

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class Project:
    id: str
    name: str
    description: str = ""
    color: str = "indigo"
    archived: bool = False
    estimated_duration: Optional[str] = None
    created_at: str = field(default_factory=_now_iso)
    updated_at: str = field(default_factory=_now_iso)

    def to_dict(self) -> dict:
        return asdict(self)


def attach_milestones_to_projects(
    projects: List[Project], milestones: List[Milestone]
) -> List[dict]:
    by_project: dict[str, list[dict]] = {}
    for m in milestones:
        by_project.setdefault(m.project_id, []).append(m.to_dict())

    for m_list in by_project.values():
        m_list.sort(key=lambda m: (m["status"], m["order_index"]))

    result: List[dict] = []
    for p in projects:
        data = p.to_dict()
        data["milestones"] = by_project.get(p.id, [])
        result.append(data)
    return result

