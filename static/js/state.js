const AppState = (() => {
  let projects = [];
  let selectedProjectId = null;

  function setProjects(list) {
    projects = list || [];
    if (!selectedProjectId && projects.length > 0) {
      selectedProjectId = projects[0].id;
    }
  }

  function getProjects() {
    return projects;
  }

  function getSelectedProject() {
    return projects.find((p) => p.id === selectedProjectId) || null;
  }

  function selectProject(id) {
    selectedProjectId = id;
    window.localStorage.setItem("skepticalpm:lastProject", id);
  }

  function restoreSelection() {
    const last = window.localStorage.getItem("skepticalpm:lastProject");
    if (last) {
      selectedProjectId = last;
    }
  }

  function upsertProject(project) {
    const idx = projects.findIndex((p) => p.id === project.id);
    if (idx >= 0) {
      projects[idx] = project;
    } else {
      projects.push(project);
    }
  }

  function replaceProjectMilestones(projectId, milestones) {
    const project = projects.find((p) => p.id === projectId);
    if (project) {
      project.milestones = milestones;
    }
  }

  return {
    setProjects,
    getProjects,
    getSelectedProject,
    selectProject,
    restoreSelection,
    upsertProject,
    replaceProjectMilestones,
  };
})();

