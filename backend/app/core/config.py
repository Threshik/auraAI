from dotenv import load_dotenv
import os

load_dotenv(override=True)

APP_NAME = os.getenv("APP_NAME", "AI Chat Backend")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")

AZURE_OPENAI_API_KEY = os.getenv("AZURE_OPENAI_API_KEY")
AZURE_OPENAI_ENDPOINT = os.getenv("AZURE_OPENAI_ENDPOINT")
AZURE_OPENAI_DEPLOYMENT = os.getenv("AZURE_OPENAI_DEPLOYMENT")
AZURE_OPENAI_API_VERSION = os.getenv("AZURE_OPENAI_API_VERSION", "2025-01-01-preview")
DATABASE_URL = os.getenv("DATABASE_URL")

KEYCLOAK_URL = os.getenv("KEYCLOAK_URL", "http://localhost:8080")
KEYCLOAK_REALM = os.getenv("KEYCLOAK_REALM", "myrealm")
KEYCLOAK_CLIENT_ID = os.getenv("KEYCLOAK_CLIENT_ID", "myclient")

# Azure DevOps integration (optional — enables live pipeline/workitem data)
AZURE_DEVOPS_ORG = os.getenv("AZURE_DEVOPS_ORG")         # e.g. myorg
AZURE_DEVOPS_PROJECT = os.getenv("AZURE_DEVOPS_PROJECT") # e.g. MyProject
AZURE_DEVOPS_PAT = os.getenv("AZURE_DEVOPS_PAT")         # Personal Access Token