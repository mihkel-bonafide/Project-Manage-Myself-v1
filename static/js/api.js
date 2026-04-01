const Api = (() => {
  async function request(url, options = {}) {
    const resp = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
      },
      ...options,
    });
    if (!resp.ok) {
      let message = resp.statusText;
      try {
        const body = await resp.json();
        if (body && body.error) {
          message = body.error;
        }
      } catch {
        // ignore
      }
      throw new Error(message || "Request failed");
    }
    if (resp.status === 204) {
      return null;
    }
    return resp.json();
  }

  function getProjects() {
    return request("/api/projects");
  }

  function createProject(payload) {
    return request("/api/projects", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  function updateProject(id, payload) {
    return request(`/api/projects/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  }

  function deleteProject(id) {
    return request(`/api/projects/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  }

  function createMilestone(projectId, payload) {
    return request(`/api/projects/${encodeURIComponent(projectId)}/milestones`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  function updateMilestone(id, payload) {
    return request(`/api/milestones/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  }

  function reorderBoard(projectId, columns) {
    return request(
      `/api/projects/${encodeURIComponent(projectId)}/board-order`,
      {
        method: "PUT",
        body: JSON.stringify({ columns }),
      }
    );
  }

  function createInstance(payload) {
    return request("/api/instances", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  return {
    getProjects,
    createProject,
    updateProject,
    deleteProject,
    createMilestone,
    updateMilestone,
    reorderBoard,
    createInstance,
  };
})();

