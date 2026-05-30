"""
OpenAI function/tool definitions.

AZURE_DOCS_TOOLS   — always available; lets the AI search Microsoft Learn.
AZURE_DEVOPS_TOOLS — enabled only when Azure DevOps credentials are configured.
TOOL_DEFINITIONS   — combined list sent to the LLM (assembled in openai_service.py).

Every DevOps tool that is project-scoped accepts an optional `project` parameter
so the AI can query any project in the org, not just the default one.
"""

import json
from app.services import azure_devops as azdo
from app.services import azure_docs

# Shared "project" property injected into every project-scoped tool
_PROJECT_PARAM = {
    "project": {
        "type": "string",
        "description": (
            "Azure DevOps project name to query. "
            "If omitted the default project from configuration is used. "
            "Use list_projects first if you are unsure of the exact name."
        ),
    }
}

# ── Azure Docs tool (always available) ───────────────────────────────────────

AZURE_DOCS_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "search_azure_docs",
            "description": (
                "Search Microsoft Learn for official Azure documentation articles. "
                "Call this whenever the user asks about creating, configuring, securing, "
                "or deploying any Azure resource — BEFORE writing the portal walkthrough — "
                "so you can include real, current doc links in your response. "
                "Also use for best-practice questions, pricing, SLA, limits, and migration guides."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": (
                            "Search query. Be specific: e.g. 'Azure App Service create Web App portal', "
                            "'Azure Key Vault soft delete enable', 'AKS private cluster networking'."
                        ),
                    },
                    "top": {
                        "type": "integer",
                        "description": "Number of results to return. Default 5.",
                        "default": 5,
                    },
                },
                "required": ["query"],
            },
        },
    },
]

# ── Azure DevOps tools (enabled when credentials are configured) ──────────────

AZURE_DEVOPS_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "list_projects",
            "description": (
                "List all Azure DevOps projects in the organisation. "
                "Call this first when the user asks about a project whose name you don't know, "
                "or when they ask to switch to a different project."
            ),
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "list_pipelines",
            "description": (
                "List all pipeline definitions in a project. "
                "Use before querying runs for a specific pipeline, or when the user asks what pipelines exist."
            ),
            "parameters": {
                "type": "object",
                "properties": {**_PROJECT_PARAM},
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_pipeline_runs",
            "description": (
                "Get recent Azure DevOps build/pipeline runs. "
                "Use when the user asks about recent builds, failed pipelines, pipeline history, "
                "or why a deployment didn't happen."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "top": {
                        "type": "integer",
                        "description": "How many runs to fetch. Default 5.",
                        "default": 5,
                    },
                    "status": {
                        "type": "string",
                        "enum": ["failed", "inProgress", "completed", "all"],
                        "description": "Filter by build status. Use 'failed' when diagnosing failures.",
                    },
                    "pipeline_name": {
                        "type": "string",
                        "description": "Filter to a specific pipeline by name (optional).",
                    },
                    **_PROJECT_PARAM,
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_pipeline_logs",
            "description": (
                "Get the detailed task logs for a specific pipeline run. "
                "Use after get_pipeline_runs to drill into WHY a build failed. "
                "Retrieves the last 5 task logs (up to 100 lines each)."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "run_id": {
                        "type": "integer",
                        "description": "The build ID from get_pipeline_runs.",
                    },
                    **_PROJECT_PARAM,
                },
                "required": ["run_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_work_items",
            "description": (
                "Query Azure DevOps work items — bugs, tasks, user stories. "
                "Use when the user asks about active bugs, what's being worked on, "
                "or the current sprint workload."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "top": {
                        "type": "integer",
                        "description": "Number of items to return. Default 10.",
                        "default": 10,
                    },
                    "state": {
                        "type": "string",
                        "enum": ["Active", "Resolved", "Closed", "New", "all"],
                        "description": "Filter by work item state.",
                    },
                    "item_type": {
                        "type": "string",
                        "enum": ["Bug", "Task", "User Story", "Feature", "Epic", "all"],
                        "description": "Filter by work item type.",
                    },
                    **_PROJECT_PARAM,
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_recent_deployments",
            "description": (
                "Get recent release deployments across all environments. "
                "Use when the user asks about recent deployments, what went to production, "
                "or deployment history."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "top": {
                        "type": "integer",
                        "description": "Number of deployments to return. Default 5.",
                        "default": 5,
                    },
                    **_PROJECT_PARAM,
                },
            },
        },
    },
]


# ── Tool executor ─────────────────────────────────────────────────────────────

async def execute_tool(name: str, args: dict) -> dict | list:
    try:
        if name == "search_azure_docs":
            return await azure_docs.search_azure_docs(**args)
        elif name == "list_projects":
            return await azdo.list_projects()
        elif name == "list_pipelines":
            return await azdo.list_pipelines(**args)
        elif name == "get_pipeline_runs":
            return await azdo.get_pipeline_runs(**args)
        elif name == "get_pipeline_logs":
            return await azdo.get_pipeline_logs(**args)
        elif name == "get_work_items":
            return await azdo.get_work_items(**args)
        elif name == "get_recent_deployments":
            return await azdo.get_recent_deployments(**args)
        else:
            return {"error": f"Unknown tool: {name}"}
    except Exception as e:
        return {"error": str(e)}
