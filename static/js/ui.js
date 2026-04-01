(() => {
  const columns = [
    { id: "backlog", title: "Ideas / Backlog" },
    { id: "in_progress", title: "In Progress" },
    { id: "done", title: "Done" },
  ];

  const els = {};

  const viewMode = (() => {
    const path = window.location.pathname;
    const match = path.match(/^\/projects\/([^/]+)\/?$/);
    if (match) {
      return { type: "project", projectId: decodeURIComponent(match[1]) };
    }
    return { type: "home", projectId: null };
  })();

  function qs(id) {
    return document.getElementById(id);
  }

  /** Parses a single milestone duration string into hours (number) or null. */
  function parseMilestoneDurationHours(raw) {
    if (raw == null) return null;
    const s0 = String(raw).trim();
    if (!s0) return null;
    const s = s0.toLowerCase().replace(/\s+/g, " ");

    function multForUnit(u) {
      if (/^(hours?|hrs?|h)$/.test(u)) return 1;
      if (/^(minutes?|mins?|min)$/.test(u)) return 1 / 60;
      return null;
    }

    const UNIT = "(hours?|hrs?|h|minutes?|mins?|min)";

    let m = s.match(
      new RegExp(
        `^(\\d+(?:\\.\\d+)?)\\s*-\\s*(\\d+(?:\\.\\d+)?)\\s*${UNIT}\\b`,
        "i"
      )
    );
    if (m) {
      const mult = multForUnit(m[3].toLowerCase());
      if (mult == null) return null;
      const a = parseFloat(m[1]);
      const b = parseFloat(m[2]);
      if (Number.isNaN(a) || Number.isNaN(b)) return null;
      return Math.max(a, b) * mult;
    }

    m = s.match(new RegExp(`^(\\d+(?:\\.\\d+)?)\\s*${UNIT}\\b`, "i"));
    if (m) {
      const mult = multForUnit(m[2].toLowerCase());
      if (mult == null) return null;
      const n = parseFloat(m[1]);
      if (Number.isNaN(n)) return null;
      return n * mult;
    }

    m = s.match(/^(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*([hm])\b/);
    if (m) {
      const a = parseFloat(m[1]);
      const b = parseFloat(m[2]);
      if (Number.isNaN(a) || Number.isNaN(b)) return null;
      const mult = m[3] === "h" ? 1 : 1 / 60;
      return Math.max(a, b) * mult;
    }

    m = s.match(/^(\d+(?:\.\d+)?)([hm])\b/);
    if (m) {
      const n = parseFloat(m[1]);
      if (Number.isNaN(n)) return null;
      return m[2] === "h" ? n : n / 60;
    }

    return null;
  }

  /**
   * Sum of parseable `estimated_duration` on milestones that are not done.
   * Returns null if no milestone has a parseable estimate; otherwise remaining hours (may be 0).
   */
  function remainingEstimatedHoursFromMilestones(milestones) {
    if (!milestones || !milestones.length) return null;
    let remaining = 0;
    let usesEstimates = false;
    milestones.forEach((m) => {
      const h = parseMilestoneDurationHours(m.estimated_duration);
      if (h == null || h < 0) return;
      usesEstimates = true;
      if (m.status !== "done") {
        remaining += h;
      }
    });
    return usesEstimates ? remaining : null;
  }

  /** Human-readable total from decimal hours. */
  function formatTotalDurationHours(hours) {
    if (hours == null) return null;
    if (hours < 0) return null;
    const totalMins = Math.round(hours * 60);
    if (totalMins <= 0) return "0 mins";
    const totalMinsClamped = Math.max(1, totalMins);
    const hrs = Math.floor(totalMinsClamped / 60);
    const mins = totalMinsClamped % 60;
    const parts = [];
    if (hrs > 0) parts.push(`${hrs} hr${hrs === 1 ? "" : "s"}`);
    if (mins > 0) parts.push(`${mins} min${mins === 1 ? "" : "s"}`);
    return parts.join(" ");
  }

  function initElements() {
    els.projectsList = qs("projectsList");
    els.projectOverview = qs("projectOverview");
    els.board = qs("board");
    els.projectTotalDuration = qs("projectTotalDuration");
    els.appMain = document.querySelector(".app-main");
    els.boardArea = document.querySelector(".board-area");
    els.newProjectBtn = qs("newProjectBtn");
    els.newInstanceBtn = qs("newInstanceBtn");
    els.emptyNewProjectBtn = qs("emptyNewProjectBtn");
    els.themeToggle = qs("themeToggle");
    els.modalBackdrop = qs("modalBackdrop");
    els.modalTitle = qs("modalTitle");
    els.modalBody = qs("modalBody");
    els.modalClose = qs("modalClose");
  }

  function openModal(title, bodyNode) {
    els.modalTitle.textContent = title;
    els.modalBody.innerHTML = "";
    els.modalBody.appendChild(bodyNode);
    els.modalBackdrop.classList.remove("hidden");
  }

  function closeModal() {
    els.modalBackdrop.classList.add("hidden");
  }

  function renderProjectsSidebar() {
    const projects = AppState.getProjects();
    const selected = AppState.getSelectedProject();
    els.projectsList.innerHTML = "";

    projects.forEach((project) => {
      if (project.archived) return;
      const doneCount = (project.milestones || []).filter(
        (m) => m.status === "done"
      ).length;
      const total = (project.milestones || []).length;
      const percent = total === 0 ? 0 : Math.round((doneCount / total) * 100);

      if (viewMode.type === "home") {
        const container = document.createElement("div");
        container.className = "project-list-item home";

        const milestones = project.milestones || [];
        const projectEstimate = project.estimated_duration
          ? `<span class="project-estimate-inline">Est. duration: ${project.estimated_duration}</span>`
          : "";
        const milestonesHtml = milestones
          .map((m) => {
            const estimate = m.estimated_duration
              ? ` — <span class="milestone-estimate-inline">${m.estimated_duration}</span>`
              : "";
            return `<li><span class="pill pill-${m.status}">${labelForStatus(
              m.status
            )}</span> ${m.title}${estimate}</li>`;
          })
          .join("");

        container.innerHTML = `
          <div class="project-main">
            <div class="project-name-row">
              <span class="project-color-dot project-color-${project.color}"></span>
              <span class="project-name">${project.name}</span>
            </div>
            <p class="project-desc">${project.description || ""}</p>
            ${projectEstimate}
          </div>
          <div class="project-meta project-meta-home">
            <span class="project-progress-label">${percent}% complete · ${
          milestones.length
        } milestones</span>
          </div>
          ${
            milestones.length
              ? `<ul class="project-milestones-list">${milestonesHtml}</ul>`
              : `<p class="project-no-milestones">No milestones yet.</p>`
          }
        `;

        container.addEventListener("click", () => {
          window.location.href = `/projects/${encodeURIComponent(project.id)}`;
        });

        els.projectsList.appendChild(container);
      } else {
        const item = document.createElement("button");
        item.type = "button";
        item.className = "project-list-item";
        if (selected && selected.id === project.id) {
          item.classList.add("selected");
        }

        item.innerHTML = `
          <div class="project-main">
            <div class="project-name-row">
              <span class="project-color-dot project-color-${project.color}"></span>
              <span class="project-name">${project.name}</span>
            </div>
            <p class="project-desc">${project.description || ""}</p>
          </div>
          <div class="project-meta">
            <span class="project-progress-label">${percent}%</span>
            <div class="project-progress-bar">
              <div class="project-progress-fill" style="width:${percent}%"></div>
            </div>
          </div>
        `;

        item.addEventListener("click", () => {
          AppState.selectProject(project.id);
          renderProjectsSidebar();
          renderBoard();
        });

        els.projectsList.appendChild(item);
      }
    });
  }

  function renderBoard() {
    const project = AppState.getSelectedProject();
    if (!project) {
      els.board.classList.add("hidden");
      els.projectOverview.classList.add("empty-state");
      if (els.projectTotalDuration) {
        els.projectTotalDuration.classList.add("hidden");
        els.projectTotalDuration.innerHTML = "";
      }
      return;
    }

    els.board.classList.remove("hidden");
    els.projectOverview.classList.remove("empty-state");

    const doneCount = (project.milestones || []).filter(
      (m) => m.status === "done"
    ).length;
    const total = (project.milestones || []).length;
    const percent = total === 0 ? 0 : Math.round((doneCount / total) * 100);

    const remainingHours = remainingEstimatedHoursFromMilestones(
      project.milestones || []
    );
    const remainingLabel = formatTotalDurationHours(remainingHours);
    if (els.projectTotalDuration) {
      if (remainingLabel) {
        els.projectTotalDuration.innerHTML = `<strong>Project Estimated Time Remaining:</strong> ${remainingLabel}`;
        els.projectTotalDuration.classList.remove("hidden");
      } else {
        els.projectTotalDuration.classList.add("hidden");
        els.projectTotalDuration.innerHTML = "";
      }
    }

    els.projectOverview.innerHTML = `
      <div class="overview-left">
        <h2>${project.name}</h2>
        <p>${project.description || ""}</p>
      </div>
      <div class="overview-right">
        <button type="button" class="ghost-button ghost-button-small" id="editProjectInline">
          Edit project
        </button>
        <span class="overview-percent">${percent}% done</span>
        <div class="overview-bar">
          <div class="overview-bar-fill" style="width:${percent}%"></div>
        </div>
      </div>
    `;

    const editBtn = document.getElementById("editProjectInline");
    if (editBtn) {
      editBtn.addEventListener("click", () => openProjectForm(project));
    }

    els.board.innerHTML = "";
    const byStatus = {};
    (project.milestones || []).forEach((m) => {
      if (!byStatus[m.status]) byStatus[m.status] = [];
      byStatus[m.status].push(m);
    });
    columns.forEach((col) => {
      const colEl = document.createElement("div");
      colEl.className = "board-column";
      colEl.dataset.columnId = col.id;
      colEl.innerHTML = `
        <div class="board-column-header">
          <h3>${col.title}</h3>
          <span class="badge">${(byStatus[col.id] || []).length}</span>
        </div>
        <div class="board-column-body" data-dropzone="${col.id}"></div>
        <button type="button" class="text-button add-milestone-btn">+ Add milestone</button>
      `;

      const body = colEl.querySelector(".board-column-body");
      const inColumn = (byStatus[col.id] || []).slice();
      inColumn.sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
      inColumn.forEach((m) => {
        body.appendChild(renderMilestoneCard(m));
      });

      const addBtn = colEl.querySelector(".add-milestone-btn");
      addBtn.addEventListener("click", () => openMilestoneForm(project.id, col.id));

      attachDropzone(colEl, body, col.id);
      els.board.appendChild(colEl);
    });
  }

  function renderMilestoneCard(m) {
    const card = document.createElement("article");
    card.className = "milestone-card";
    card.draggable = true;
    card.dataset.milestoneId = m.id;
    card.dataset.status = m.status;

    const due = m.due_date ? `<span class="milestone-due">Due ${m.due_date}</span>` : "";
    const estimate = m.estimated_duration
      ? `<span class="milestone-estimate">${m.estimated_duration}</span>`
      : "";

    card.innerHTML = `
      <div class="milestone-header">
        <span class="milestone-title">${m.title}</span>
      </div>
      <p class="milestone-desc">${m.description || ""}</p>
      <div class="milestone-footer">
        <div class="milestone-footer-left">
          ${due}
          ${estimate}
        </div>
        <span class="milestone-status milestone-status-${m.status}">${labelForStatus(
          m.status
        )}</span>
      </div>
    `;

    card.addEventListener("click", (ev) => {
      if (ev.target.closest(".drag-handle")) return;
      openMilestoneDetail(m);
    });

    card.addEventListener("dragstart", (ev) => {
      ev.dataTransfer.effectAllowed = "move";
      ev.dataTransfer.setData("text/plain", m.id);
      card.classList.add("dragging");
    });
    card.addEventListener("dragend", () => {
      card.classList.remove("dragging");
      clearMilestoneDropIndicators();
    });

    return card;
  }

  function clearMilestoneDropIndicators() {
    document.querySelectorAll(".milestone-drop-before").forEach((el) => {
      el.classList.remove("milestone-drop-before");
    });
  }

  function orderedColumnIds(project, status) {
    return (project.milestones || [])
      .filter((x) => x.status === status)
      .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
      .map((x) => x.id);
  }

  function insertionIndexForColumn(columnBody, clientY) {
    const cards = [
      ...columnBody.querySelectorAll(".milestone-card:not(.dragging)"),
    ];
    for (let i = 0; i < cards.length; i++) {
      const r = cards[i].getBoundingClientRect();
      const midY = r.top + r.height / 2;
      if (clientY < midY) return i;
    }
    return cards.length;
  }

  function labelForStatus(status) {
    switch (status) {
      case "backlog":
        return "Backlog";
      case "in_progress":
        return "In Progress";
      case "done":
        return "Done";
      default:
        return status;
    }
  }

  /**
   * Drag/drop on the whole column so dragover still fires when the pointer is over a card.
   * `zone` is the column body used to compute vertical insert position.
   */
  function attachDropzone(colEl, zone, status) {
    colEl.addEventListener("dragover", (ev) => {
      ev.preventDefault();
      ev.dataTransfer.dropEffect = "move";
      zone.classList.add("drop-active");
      clearMilestoneDropIndicators();
      const idx = insertionIndexForColumn(zone, ev.clientY);
      const cards = [
        ...zone.querySelectorAll(".milestone-card:not(.dragging)"),
      ];
      if (idx < cards.length) {
        cards[idx].classList.add("milestone-drop-before");
      }
    });

    colEl.addEventListener("dragleave", (ev) => {
      if (ev.relatedTarget && colEl.contains(ev.relatedTarget)) return;
      zone.classList.remove("drop-active");
      clearMilestoneDropIndicators();
    });

    colEl.addEventListener("drop", async (ev) => {
      ev.preventDefault();
      zone.classList.remove("drop-active");
      clearMilestoneDropIndicators();

      const id = ev.dataTransfer.getData("text/plain");
      if (!id) return;
      const project = AppState.getSelectedProject();
      if (!project) return;

      const milestones = project.milestones || [];
      const m = milestones.find((x) => x.id === id);
      if (!m) return;

      const insertIndex = insertionIndexForColumn(zone, ev.clientY);
      const oldStatus = m.status;

      const columns = {
        backlog: orderedColumnIds(project, "backlog"),
        in_progress: orderedColumnIds(project, "in_progress"),
        done: orderedColumnIds(project, "done"),
      };

      columns[oldStatus] = columns[oldStatus].filter((mid) => mid !== id);
      columns[status].splice(insertIndex, 0, id);

      try {
        await Api.reorderBoard(project.id, columns);
        const { projects } = await Api.getProjects();
        AppState.setProjects(projects);
        AppState.selectProject(project.id);
        if (status === "done" && oldStatus !== "done" && typeof triggerConfetti === "function") {
          triggerConfetti(ev.clientX, ev.clientY);
        }
        renderBoard();
        renderProjectsSidebar();
      } catch (err) {
        console.error(err);
        alert("Could not move milestone: " + err.message);
      }
    });
  }

  function openProjectForm(existing) {
    const form = document.createElement("form");
    form.className = "stack-form";
    form.innerHTML = `
      <label>
        <span>Project name</span>
        <input name="name" required value="${existing ? existing.name : ""}" />
      </label>
      <label>
        <span>Description</span>
        <textarea name="description" rows="3">${existing ? existing.description : ""}</textarea>
      </label>
      <label>
        <span>Color mood</span>
        <select name="color">
          <option value="indigo">Indigo</option>
          <option value="teal">Teal</option>
          <option value="amber">Amber</option>
          <option value="rose">Rose</option>
        </select>
      </label>
      <label>
        <span>Project duration (estimate)</span>
        <input
          name="estimated_duration"
          placeholder="e.g., 3 months, 6 weeks"
          value="${existing && existing.estimated_duration ? existing.estimated_duration : ""}"
        />
      </label>
      <div class="form-actions">
        <button type="button" class="ghost-button" data-role="cancel">Cancel</button>
        <button type="submit" class="primary-button">${existing ? "Save" : "Create project"}</button>
      </div>
    `;

    if (existing) {
      form.color.value = existing.color || "indigo";
    }

    form.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const payload = {
        name: form.name.value.trim(),
        description: form.description.value.trim(),
        color: form.color.value,
        estimated_duration: form.estimated_duration.value.trim() || null,
      };
      try {
        let project;
        if (existing) {
          project = await Api.updateProject(existing.id, payload);
        } else {
          project = await Api.createProject(payload);
        }
        const { projects } = await Api.getProjects();
        AppState.setProjects(projects);

        if (viewMode.type === "project") {
          AppState.selectProject(project.id);
          closeModal();
          renderProjectsSidebar();
          renderBoard();
        } else {
          closeModal();
          renderProjectsSidebar();
        }
      } catch (err) {
        console.error(err);
        alert("Could not save project: " + err.message);
      }
    });

    form.querySelector('[data-role="cancel"]').addEventListener("click", () => {
      closeModal();
    });

    openModal(existing ? "Edit project" : "New project", form);
  }

  function openDeleteProjectConfirm() {
    const projectId = viewMode.projectId;
    if (!projectId) return;

    const wrap = document.createElement("div");
    wrap.className = "stack-form delete-project-confirm";
    wrap.innerHTML = `
      <p class="delete-project-confirm-text">Do you want to delete this project?</p>
      <div class="form-actions">
        <button type="button" class="ghost-button" data-role="no">No</button>
        <button type="button" class="delete-project-button" data-role="yes">Yes</button>
      </div>
    `;

    wrap.querySelector('[data-role="no"]').addEventListener("click", () => {
      closeModal();
    });

    wrap.querySelector('[data-role="yes"]').addEventListener("click", async () => {
      try {
        await Api.deleteProject(projectId);
        window.localStorage.removeItem("skepticalpm:lastProject");
        closeModal();
        window.location.href = "/";
      } catch (err) {
        console.error(err);
        alert("Could not delete project: " + err.message);
      }
    });

    openModal("Delete project", wrap);
  }

  function openNewInstanceForm() {
    const form = document.createElement("form");
    form.className = "stack-form";
    form.innerHTML = `
      <label>
        <span>Name</span>
        <input name="name" required maxlength="200" autocomplete="off" />
      </label>
      <div class="form-actions">
        <button type="button" class="ghost-button" data-role="cancel">Cancel</button>
        <button type="submit" class="primary-button">Start instance</button>
      </div>
    `;

    form.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const name = form.name.value.trim();
      if (!name) return;
      const submitBtn = form.querySelector('button[type="submit"]');
      const prevSubmitLabel = submitBtn ? submitBtn.textContent : "";
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Starting…";
      }
      // Open a tab synchronously (still user gesture) so popup blockers allow it
      // after await. Do not use noopener — that makes window.open return null.
      const pendingTab = window.open("about:blank", "_blank");
      try {
        const result = await Api.createInstance({ name });
        closeModal();
        if (result && result.url) {
          if (pendingTab) {
            pendingTab.location.href = result.url;
            pendingTab.opener = null;
          } else {
            window.open(result.url, "_blank");
            alert(
              "If no tab opened, your browser blocked the popup. Open this URL manually:\n\n" +
                result.url
            );
          }
        }
      } catch (err) {
        console.error(err);
        if (pendingTab) {
          pendingTab.close();
        }
        alert("Could not start instance: " + err.message);
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = prevSubmitLabel;
        }
      }
    });

    form.querySelector('[data-role="cancel"]').addEventListener("click", () => {
      closeModal();
    });

    openModal("What would you like to name your new PMM instance?", form);
  }

  function openMilestoneForm(projectId, status, existing) {
    const form = document.createElement("form");
    form.className = "stack-form";
    form.innerHTML = `
      <label>
        <span>Title</span>
        <input name="title" required value="${existing ? existing.title : ""}" />
      </label>
      <label>
        <span>Description</span>
        <textarea name="description" rows="3">${existing ? existing.description : ""}</textarea>
      </label>
      <label>
        <span>Status</span>
        <select name="status">
          <option value="backlog">Backlog</option>
          <option value="in_progress">In Progress</option>
          <option value="done">Done</option>
        </select>
      </label>
      <label>
        <span>Due date (optional)</span>
        <input name="due_date" type="date" value="${existing && existing.due_date ? existing.due_date : ""}" />
      </label>
      <label>
        <span>Estimated duration (optional)</span>
        <input name="estimated_duration" placeholder="e.g., 2h, 3 days, 1 week" value="${
          existing && existing.estimated_duration ? existing.estimated_duration : ""
        }" />
      </label>
      <div class="form-actions">
        <button type="button" class="ghost-button" data-role="cancel">Cancel</button>
        <button type="submit" class="primary-button">${existing ? "Save" : "Add milestone"}</button>
      </div>
    `;

    form.status.value = existing ? existing.status : status || "backlog";

    form.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const payload = {
        title: form.title.value.trim(),
        description: form.description.value.trim(),
        status: form.status.value,
        due_date: form.due_date.value || null,
        estimated_duration: form.estimated_duration.value.trim() || null,
      };
      try {
        const project = AppState.getSelectedProject();
        let result;
        if (existing) {
          result = await Api.updateMilestone(existing.id, payload);
        } else {
          result = await Api.createMilestone(projectId, payload);
        }
        const { projects } = await Api.getProjects();
        AppState.setProjects(projects);
        AppState.selectProject(project.id);
        const nowDone = payload.status === "done";
        const wasDone = existing && existing.status === "done";
        closeModal();
        if (nowDone && !wasDone && typeof triggerConfetti === "function") {
          triggerConfetti();
        }
        renderProjectsSidebar();
        renderBoard();
      } catch (err) {
        console.error(err);
        alert("Could not save milestone: " + err.message);
      }
    });

    form.querySelector('[data-role="cancel"]').addEventListener("click", () => {
      closeModal();
    });

    openModal(existing ? "Edit milestone" : "New milestone", form);
  }

  function openMilestoneDetail(m) {
    openMilestoneForm(m.project_id, m.status, m);
  }

  function toggleTheme() {
    const current = window.localStorage.getItem("skepticalpm:theme") || "vibrant";
    const next = current === "vibrant" ? "minimal" : "vibrant";
    applyTheme(next);
    window.localStorage.setItem("skepticalpm:theme", next);
  }

  function applyTheme(mode) {
    document.body.classList.remove("theme-vibrant", "theme-minimal");
    if (mode === "minimal") {
      document.body.classList.add("theme-minimal");
    } else {
      document.body.classList.add("theme-vibrant");
    }
  }

  function restoreTheme() {
    const stored = window.localStorage.getItem("skepticalpm:theme") || "vibrant";
    applyTheme(stored);
  }

  async function bootstrap() {
    initElements();
    restoreTheme();
    AppState.restoreSelection();

    if (viewMode.type === "home") {
      if (els.appMain) {
        els.appMain.classList.add("home-mode");
      }
      if (els.boardArea) {
        els.boardArea.classList.add("home-hidden");
      }
    }

    const logoPill = document.querySelector(".logo-pill");
    if (logoPill && viewMode.type === "project") {
      logoPill.setAttribute("aria-label", "Back to all projects");
      logoPill.setAttribute("title", "Back to all projects");
    }

    if (viewMode.type === "project") {
      els.newProjectBtn.textContent = "Delete project";
      els.newProjectBtn.classList.remove("primary-button");
      els.newProjectBtn.classList.add("delete-project-button");
      els.newProjectBtn.addEventListener("click", openDeleteProjectConfirm);
    } else {
      els.newProjectBtn.addEventListener("click", () => openProjectForm());
    }
    els.emptyNewProjectBtn.addEventListener("click", () => openProjectForm());
    if (els.newInstanceBtn) {
      els.newInstanceBtn.addEventListener("click", openNewInstanceForm);
    }
    els.themeToggle.addEventListener("click", toggleTheme);
    els.modalClose.addEventListener("click", closeModal);
    els.modalBackdrop.addEventListener("click", (ev) => {
      if (ev.target === els.modalBackdrop) {
        closeModal();
      }
    });

    try {
      const { projects } = await Api.getProjects();
      AppState.setProjects(projects);

      if (viewMode.type === "project" && viewMode.projectId) {
        AppState.selectProject(viewMode.projectId);
      }

      renderProjectsSidebar();

      if (viewMode.type === "project") {
        renderBoard();
      }
    } catch (err) {
      console.error(err);
      alert("Failed to load projects: " + err.message);
    }
  }

  window.addEventListener("DOMContentLoaded", bootstrap);
})();

