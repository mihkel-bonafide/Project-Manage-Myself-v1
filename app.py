import os
from pathlib import Path

from flask import Flask, jsonify, render_template, request, send_from_directory

from config import DATA_DIR, INSTANCE_DISPLAY_TITLE, IS_SPAWNED_INSTANCE
from instance_spawner import spawn_new_instance
from storage import (
    add_milestone,
    add_project,
    archive_project,
    ensure_data_file_initialized,
    load_projects_with_milestones,
    reorder_project_board,
    update_milestone,
    update_project,
)


def create_app() -> Flask:
    base_dir = Path(__file__).parent

    app = Flask(
        __name__,
        template_folder=str(base_dir / "templates"),
        static_folder=str(base_dir / "static"),
    )

    # Ensure data directory/file exist on startup
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    ensure_data_file_initialized()

    @app.context_processor
    def inject_instance_title():
        return {
            "instance_title": INSTANCE_DISPLAY_TITLE,
            "is_spawned_instance": IS_SPAWNED_INSTANCE,
        }

    @app.route("/")
    def index():
        return render_template("index.html")

    @app.route("/projects/<project_id>")
    def project_page(project_id: str):
        # The frontend reads the project ID from the URL and renders
        # the focused board view for that project.
        return render_template("index.html")

    def _listen_port_for_spawn():
        p = os.environ.get("PMM_PORT", "").strip()
        if p.isdigit():
            return int(p)
        host = request.environ.get("HTTP_HOST", "")
        if ":" in host:
            tail = host.rsplit(":", 1)[-1]
            if tail.isdigit():
                return int(tail)
        sp = (request.environ.get("SERVER_PORT") or "").strip()
        if sp.isdigit():
            return int(sp)
        return 5000

    @app.route("/api/instances", methods=["POST"])
    def api_spawn_instance():
        payload = request.get_json(force=True) or {}
        name = (payload.get("name") or "").strip()
        if not name:
            return jsonify({"error": "Instance name is required"}), 400
        server_port = _listen_port_for_spawn()
        try:
            port, url = spawn_new_instance(name, base_dir, after_port=server_port)
        except ValueError as exc:
            return jsonify({"error": str(exc)}), 400
        except OSError as exc:
            return jsonify({"error": f"Could not start instance: {exc}"}), 500
        except RuntimeError as exc:
            return jsonify({"error": str(exc)}), 500
        return jsonify({"port": port, "url": url}), 201

    @app.route("/api/projects", methods=["GET"])
    def api_projects_list():
        projects = load_projects_with_milestones()
        return jsonify({"projects": projects})

    @app.route("/api/projects", methods=["POST"])
    def api_projects_create():
        payload = request.get_json(force=True) or {}
        name = (payload.get("name") or "").strip()
        description = payload.get("description") or ""
        color = payload.get("color") or "indigo"
        estimated_duration = payload.get("estimated_duration")

        if not name:
            return jsonify({"error": "Project name is required"}), 400

        project = add_project(
            name=name,
            description=description,
            color=color,
            estimated_duration=estimated_duration,
        )
        return jsonify(project), 201

    @app.route("/api/projects/<project_id>", methods=["PUT"])
    def api_projects_update(project_id: str):
        payload = request.get_json(force=True) or {}
        try:
            project = update_project(
                project_id,
                name=payload.get("name"),
                description=payload.get("description"),
                color=payload.get("color"),
                archived=payload.get("archived"),
                estimated_duration=payload.get("estimated_duration"),
            )
        except ValueError as exc:
            return jsonify({"error": str(exc)}), 404
        return jsonify(project)

    @app.route("/api/projects/<project_id>", methods=["DELETE"])
    def api_projects_delete(project_id: str):
        try:
            archive_project(project_id)
        except ValueError as exc:
            return jsonify({"error": str(exc)}), 404
        return "", 204

    @app.route("/api/projects/<project_id>/milestones", methods=["POST"])
    def api_milestones_create(project_id: str):
        payload = request.get_json(force=True) or {}
        title = (payload.get("title") or "").strip()
        description = payload.get("description") or ""
        status = payload.get("status") or "backlog"
        due_date = payload.get("due_date")
        estimated_duration = payload.get("estimated_duration")

        if not title:
            return jsonify({"error": "Milestone title is required"}), 400

        try:
            milestone = add_milestone(
                project_id=project_id,
                title=title,
                description=description,
                status=status,
                due_date=due_date,
                estimated_duration=estimated_duration,
            )
        except ValueError as exc:
            return jsonify({"error": str(exc)}), 404
        return jsonify(milestone), 201

    @app.route("/api/projects/<project_id>/board-order", methods=["PUT"])
    def api_project_board_order(project_id: str):
        payload = request.get_json(force=True) or {}
        columns = payload.get("columns")
        if not isinstance(columns, dict):
            return jsonify({"error": "columns object is required"}), 400
        try:
            reorder_project_board(project_id, columns)
        except ValueError as exc:
            return jsonify({"error": str(exc)}), 400
        return "", 204

    @app.route("/api/milestones/<milestone_id>", methods=["PUT"])
    def api_milestones_update(milestone_id: str):
        payload = request.get_json(force=True) or {}
        try:
            milestone = update_milestone(
                milestone_id,
                title=payload.get("title"),
                description=payload.get("description"),
                status=payload.get("status"),
                order_index=payload.get("order_index"),
                due_date=payload.get("due_date"),
                estimated_duration=payload.get("estimated_duration"),
            )
        except ValueError as exc:
            return jsonify({"error": str(exc)}), 404
        return jsonify(milestone)

    # Allow static file serving for JS/CSS (Flask already serves from /static,
    # this helper is mainly for IDEs and explicit paths if needed)
    @app.route("/static/<path:filename>")
    def static_files(filename: str):
        return send_from_directory(app.static_folder, filename)

    return app


app = create_app()


if __name__ == "__main__":
    port = int(os.environ.get("PMM_PORT", "5000"))
    os.environ["PMM_PORT"] = str(port)
    is_child = os.environ.get("PMM_CHILD_INSTANCE") == "1"
    # Spawned children must not use the reloader (second server in one UI).
    # WERKZEUG_* env is stripped in instance_spawner so we are not mistaken for a
    # reloader subprocess (avoids WinError 10038 / socket.fromfd on Windows).
    app.run(
        debug=True,
        host="127.0.0.1",
        port=port,
        use_reloader=not is_child,
    )

