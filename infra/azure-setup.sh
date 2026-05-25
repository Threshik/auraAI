#!/bin/bash
# Run this ONCE in Azure Cloud Shell (https://shell.azure.com)
# Fill in the variables below before running.

# ── Configuration ──────────────────────────────────────────────────────────────
RG="aichat-rg"                          # resource group name
LOCATION="eastus"                       # az account list-locations -o table
ACR="aichatregistry"                    # must be globally unique, letters+numbers only
APP_ENV="aichat-env"                    # container apps environment name
PG_SERVER="aichat-pg"                   # postgres server name (must be globally unique)
PG_USER="pgadmin"
PG_PASS="ChangeMe123!"                  # use a strong password
PG_DB="aichat"

AZURE_OPENAI_KEY="<your-key>"
AZURE_OPENAI_ENDPOINT="<your-endpoint>"
AZURE_OPENAI_DEPLOYMENT="gpt-4o-mini"
AZURE_OPENAI_VERSION="2025-01-01-preview"

# ── 1. Resource Group ──────────────────────────────────────────────────────────
az group create --name $RG --location $LOCATION

# ── 2. Azure Container Registry ───────────────────────────────────────────────
az acr create --name $ACR --resource-group $RG --sku Basic --admin-enabled true

# ── 3. PostgreSQL Flexible Server ─────────────────────────────────────────────
az postgres flexible-server create \
  --name $PG_SERVER \
  --resource-group $RG \
  --location $LOCATION \
  --admin-user $PG_USER \
  --admin-password $PG_PASS \
  --sku-name Standard_B1ms \
  --tier Burstable \
  --public-access 0.0.0.0 \
  --database-name $PG_DB

DATABASE_URL="postgresql://${PG_USER}:${PG_PASS}@${PG_SERVER}.postgres.database.azure.com/${PG_DB}?sslmode=require"

# ── 4. Container Apps Environment ─────────────────────────────────────────────
az containerapp env create \
  --name $APP_ENV \
  --resource-group $RG \
  --location $LOCATION

# ── 5. Deploy backend Container App ───────────────────────────────────────────
az containerapp create \
  --name aichat-backend \
  --resource-group $RG \
  --environment $APP_ENV \
  --image mcr.microsoft.com/azuredocs/containerapps-helloworld:latest \
  --target-port 8000 \
  --ingress external \
  --registry-server ${ACR}.azurecr.io \
  --registry-username $(az acr credential show --name $ACR --query username -o tsv) \
  --registry-password $(az acr credential show --name $ACR --query "passwords[0].value" -o tsv) \
  --env-vars \
    DATABASE_URL="$DATABASE_URL" \
    AZURE_OPENAI_API_KEY="$AZURE_OPENAI_KEY" \
    AZURE_OPENAI_ENDPOINT="$AZURE_OPENAI_ENDPOINT" \
    AZURE_OPENAI_DEPLOYMENT="$AZURE_OPENAI_DEPLOYMENT" \
    AZURE_OPENAI_API_VERSION="$AZURE_OPENAI_VERSION" \
    APP_NAME="AI Chat Platform" \
    FRONTEND_URL="https://aichat-frontend.<your-env-domain>"

BACKEND_URL=$(az containerapp show \
  --name aichat-backend \
  --resource-group $RG \
  --query "properties.configuration.ingress.fqdn" -o tsv)
echo "Backend URL: https://$BACKEND_URL"

# ── 6. Deploy frontend Container App ──────────────────────────────────────────
az containerapp create \
  --name aichat-frontend \
  --resource-group $RG \
  --environment $APP_ENV \
  --image mcr.microsoft.com/azuredocs/containerapps-helloworld:latest \
  --target-port 3000 \
  --ingress external \
  --registry-server ${ACR}.azurecr.io \
  --registry-username $(az acr credential show --name $ACR --query username -o tsv) \
  --registry-password $(az acr credential show --name $ACR --query "passwords[0].value" -o tsv) \
  --env-vars \
    NEXT_PUBLIC_API_URL="https://$BACKEND_URL"

FRONTEND_URL=$(az containerapp show \
  --name aichat-frontend \
  --resource-group $RG \
  --query "properties.configuration.ingress.fqdn" -o tsv)
echo "Frontend URL: https://$FRONTEND_URL"

# ── 7. Update backend FRONTEND_URL now that we know it ────────────────────────
az containerapp update \
  --name aichat-backend \
  --resource-group $RG \
  --set-env-vars FRONTEND_URL="https://$FRONTEND_URL"

# ── 8. Create GitHub Actions service principal ────────────────────────────────
SUBSCRIPTION_ID=$(az account show --query id -o tsv)
az ad sp create-for-rbac \
  --name "github-aichat-deploy" \
  --role contributor \
  --scopes /subscriptions/$SUBSCRIPTION_ID/resourceGroups/$RG \
  --sdk-auth
# ↑ Copy the entire JSON output — paste it into GitHub secret AZURE_CREDENTIALS
