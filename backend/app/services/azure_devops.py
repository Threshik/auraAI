"""
Azure DevOps REST API client.
AZURE_DEVOPS_ORG and AZURE_DEVOPS_PAT are required.
AZURE_DEVOPS_PROJECT is optional â€” if set it becomes the default project,
but every function accepts an explicit `project` override so the AI can
query any project in the org.
"""

import base64
import httpx
from app.core.config import AZURE_DEVOPS_ORG, AZURE_DEVOPS_PROJECT, AZURE_DEVOPS_PAT


def is_configured() -> bool:
    """Only org + PAT are required; project is optional."""
    return bool(AZURE_DEVOPS_ORG and AZURE_DEVOPS_PAT)


def _headers() -> dict:
    token = base64.b64encode(f":{AZURE_DEVOPS_PAT}".encode()).decode()
    return {
        "Authorization": f"Basic {token}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }


def _resolve_project(project: str | None) -> str | None:
    """Use explicit project arg, fall back to env var, or None (org-level)."""
    return project or AZURE_DEVOPS_PROJECT or None


def _base(project: str | None = None) -> str:
    proj = _resolve_project(project)
    if proj:
        return f"https://dev.azure.com/{AZURE_DEVOPS_ORG}/{proj}/_apis"
    return f"https://dev.azure.com/{AZURE_DEVOPS_ORG}/_apis"


# â”€â”€ Projects â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async def list_projects() -> list[dict]:
    """List all projects in the Azure DevOps organisation."""
    async with httpx.AsyncClient(timeout=15) as c:
        r = await c.get(
            f"https://dev.azure.com/{AZURE_DEVOPS_ORG}/_apis/projects",
            headers=_headers(),
            params={"api-version": "7.1"},
        )
        r.raise_for_status()
        data = r.json()
    return [
        {"id": p["id"], "name": p["name"], "state": p.get("state")}
        for p in data.get("value", [])
    ]


# â”€â”€ Pipelines / Builds â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async def list_pipelines(project: str | None = None) -> list[dict]:
    """List all pipeline definitions in the project."""
    async with httpx.AsyncClient(timeout=15) as c:
        r = await c.get(
            f"{_base(project)}/build/definitions",
            headers=_headers(),
            params={"api-version": "7.1"},
        )
        r.raise_for_status()
        data = r.json()
    return [
        {"id": d["id"], "name": d["name"], "path": d.get("path", "\\")}
        for d in data.get("value", [])
    ]


async def get_pipeline_runs(
    top: int = 5,
    status: str = "all",
    pipeline_name: str | None = None,
    project: str | None = None,
) -> list[dict]:
    """Get recent pipeline runs, optionally filtered by status or pipeline name."""
    params: dict = {"api-version": "7.1", "$top": top}
    if status and status != "all":
        params["statusFilter"] = status

    if pipeline_name:
        pipelines = await list_pipelines(project)
        for p in pipelines:
            if p["name"].lower() == pipeline_name.lower():
                params["definitions"] = p["id"]
                break

    async with httpx.AsyncClient(timeout=15) as c:
        r = await c.get(
            f"{_base(project)}/build/builds",
            headers=_headers(),
            params=params,
        )
        r.raise_for_status()
        data = r.json()

    return [
        {
            "id": b["id"],
            "pipeline_name": b["definition"]["name"],
            "pipeline_id": b["definition"]["id"],
            "status": b["status"],
            "result": b.get("result"),
            "started": b.get("startTime"),
            "finished": b.get("finishTime"),
            "branch": b.get("sourceBranch", "").replace("refs/heads/", ""),
            "triggered_by": b.get("requestedFor", {}).get("displayName"),
            "url": b.get("_links", {}).get("web", {}).get("href"),
        }
        for b in data.get("value", [])
    ]


async def get_pipeline_logs(run_id: int, project: str | None = None) -> dict:
    """Get the error logs for a specific pipeline run (last 5 tasks, 100 lines each)."""
    async with httpx.AsyncClient(timeout=20) as c:
        r = await c.get(
            f"{_base(project)}/build/builds/{run_id}/logs",
            headers=_headers(),
            params={"api-version": "7.1"},
        )
        r.raise_for_status()
        log_entries = r.json().get("value", [])

        logs = []
        for entry in log_entries[-5:]:
            lr = await c.get(
                f"{_base(project)}/build/builds/{run_id}/logs/{entry['id']}",
                headers=_headers(),
                params={"api-version": "7.1"},
            )
            if lr.status_code == 200:
                lines = [l for l in lr.text.splitlines() if l.strip()]
                if lines:
                    logs.append({
                        "log_id": entry["id"],
                        "lines": lines[-100:],
                    })

    return {"build_id": run_id, "logs": logs}


# â”€â”€ Work Items â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async def get_work_items(
    top: int = 10,
    state: str = "Active",
    item_type: str = "all",
    project: str | None = None,
) -> list[dict]:
    """Query Azure DevOps work items (bugs, tasks, stories)."""
    conditions = ["[System.TeamProject] = @project"]
    if state and state != "all":
        conditions.append(f"[System.State] = '{state}'")
    if item_type and item_type != "all":
        conditions.append(f"[System.WorkItemType] = '{item_type}'")

    wiql = (
        "SELECT [System.Id],[System.Title],[System.State],[System.WorkItemType],"
        "[System.AssignedTo],[System.CreatedDate] FROM WorkItems WHERE "
        + " AND ".join(conditions)
        + " ORDER BY [System.CreatedDate] DESC"
    )

    async with httpx.AsyncClient(timeout=15) as c:
        r = await c.post(
            f"{_base(project)}/wit/wiql",
            headers=_headers(),
            params={"api-version": "7.1", "$top": top},
            json={"query": wiql},
        )
        r.raise_for_status()
        ids = [str(wi["id"]) for wi in r.json().get("workItems", [])[:top]]

    if not ids:
        return []

    async with httpx.AsyncClient(timeout=15) as c:
        r = await c.get(
            f"https://dev.azure.com/{AZURE_DEVOPS_ORG}/_apis/wit/workitems",
            headers=_headers(),
            params={"ids": ",".join(ids), "api-version": "7.1"},
        )
        r.raise_for_status()
        data = r.json()

    result = []
    for wi in data.get("value", []):
        f = wi.get("fields", {})
        assigned = f.get("System.AssignedTo")
        result.append({
            "id": wi["id"],
            "title": f.get("System.Title"),
            "type": f.get("System.WorkItemType"),
            "state": f.get("System.State"),
            "assigned_to": assigned.get("displayName") if isinstance(assigned, dict) else assigned,
            "created": f.get("System.CreatedDate"),
            "url": wi.get("_links", {}).get("html", {}).get("href"),
        })
    return result


# â”€â”€ Release / Deployment â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async def get_recent_deployments(top: int = 5, project: str | None = None) -> list[dict]:
    """Get recent release deployments across all environments."""
    proj = _resolve_project(project)
    if not proj:
        return {"error": "A project name is required for deployment queries."}  # type: ignore[return-value]

    async with httpx.AsyncClient(timeout=15) as c:
        r = await c.get(
            f"https://vsrm.dev.azure.com/{AZURE_DEVOPS_ORG}/{proj}/_apis/release/deployments",
            headers=_headers(),
            params={"api-version": "7.1", "$top": top},
        )
        if r.status_code == 404:
            return []
        r.raise_for_status()
        data = r.json()

    return [
        {
            "id": d["id"],
            "release_name": d.get("release", {}).get("name"),
            "pipeline_name": d.get("releaseDefinition", {}).get("name"),
            "environment": d.get("releaseEnvironment", {}).get("name"),
            "status": d.get("deploymentStatus"),
            "started": d.get("startedOn"),
            "completed": d.get("completedOn"),
            "triggered_by": d.get("requestedFor", {}).get("displayName"),
        }
        for d in data.get("value", [])
    ]


