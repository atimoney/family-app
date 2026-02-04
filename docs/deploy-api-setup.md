# API Deployment to Azure Container Apps

This document explains how to set up the GitHub Actions workflow for deploying the Family API to Azure Container Apps.

## Overview

The deployment workflow (`.github/workflows/deploy-api.yml`) uses:

- **OIDC authentication** (no long-lived secrets) via Azure AD federated credentials
- **Azure Container Registry (ACR)** for storing Docker images
- **Azure Container Apps (ACA)** for running the containerized API
- **GitHub Environments** for environment-specific configuration and approvals

## Prerequisites

1. Azure subscription with Container Apps and Container Registry
2. GitHub repository with Actions enabled
3. Azure CLI installed locally for initial setup

## Azure Setup

### 1. Create Azure Resources

If not already created, set up the required Azure resources:

```bash
# Variables (adjust as needed)
RESOURCE_GROUP="rg-familyapp"
LOCATION="australiasoutheast"
ACR_NAME_STAGING="acrfamilyappstaging"
ACR_NAME_PROD="acrfamilyappprod"
CONTAINERAPP_ENV_STAGING="cae-familyapp-staging"
CONTAINERAPP_ENV_PROD="cae-familyapp-prod"
CONTAINERAPP_NAME_STAGING="ca-familyapi-staging"
CONTAINERAPP_NAME_PROD="ca-familyapi-prod"

# Create Resource Groups
az group create --name "${RESOURCE_GROUP}-staging" --location $LOCATION
az group create --name "${RESOURCE_GROUP}-prod" --location $LOCATION

# Create Container Registries
az acr create \
  --name $ACR_NAME_STAGING \
  --resource-group "${RESOURCE_GROUP}-staging" \
  --sku Basic \
  --admin-enabled false

az acr create \
  --name $ACR_NAME_PROD \
  --resource-group "${RESOURCE_GROUP}-prod" \
  --sku Standard \
  --admin-enabled false

# Create Container App Environments
az containerapp env create \
  --name $CONTAINERAPP_ENV_STAGING \
  --resource-group "${RESOURCE_GROUP}-staging" \
  --location $LOCATION

az containerapp env create \
  --name $CONTAINERAPP_ENV_PROD \
  --resource-group "${RESOURCE_GROUP}-prod" \
  --location $LOCATION

# Create Container Apps (initial placeholder image)
az containerapp create \
  --name $CONTAINERAPP_NAME_STAGING \
  --resource-group "${RESOURCE_GROUP}-staging" \
  --environment $CONTAINERAPP_ENV_STAGING \
  --image mcr.microsoft.com/azuredocs/containerapps-helloworld:latest \
  --target-port 3000 \
  --ingress external \
  --min-replicas 0 \
  --max-replicas 3

az containerapp create \
  --name $CONTAINERAPP_NAME_PROD \
  --resource-group "${RESOURCE_GROUP}-prod" \
  --environment $CONTAINERAPP_ENV_PROD \
  --image mcr.microsoft.com/azuredocs/containerapps-helloworld:latest \
  --target-port 3000 \
  --ingress external \
  --min-replicas 1 \
  --max-replicas 10
```

### 2. Create Azure AD App Registration for OIDC

```bash
# Create App Registration
APP_NAME="github-actions-family-app"
APP_ID=$(az ad app create --display-name $APP_NAME --query appId -o tsv)
echo "App ID: $APP_ID"

# Create Service Principal
SP_ID=$(az ad sp create --id $APP_ID --query id -o tsv)
echo "Service Principal Object ID: $SP_ID"

# Get Tenant and Subscription IDs
TENANT_ID=$(az account show --query tenantId -o tsv)
SUBSCRIPTION_ID=$(az account show --query id -o tsv)
echo "Tenant ID: $TENANT_ID"
echo "Subscription ID: $SUBSCRIPTION_ID"
```

### 3. Configure Federated Credentials

Create federated credentials for each GitHub environment:

```bash
# For STAGING environment
az ad app federated-credential create \
  --id $APP_ID \
  --parameters '{
    "name": "github-actions-staging",
    "issuer": "https://token.actions.githubusercontent.com",
    "subject": "repo:atimoney/family-app:environment:staging",
    "audiences": ["api://AzureADTokenExchange"],
    "description": "GitHub Actions - Staging Environment"
  }'

# For PROD environment
az ad app federated-credential create \
  --id $APP_ID \
  --parameters '{
    "name": "github-actions-prod",
    "issuer": "https://token.actions.githubusercontent.com",
    "subject": "repo:atimoney/family-app:environment:prod",
    "audiences": ["api://AzureADTokenExchange"],
    "description": "GitHub Actions - Production Environment"
  }'
```

### 4. Assign RBAC Roles

Grant the Service Principal access to push images and manage Container Apps:

```bash
# Get Service Principal's Object ID (for role assignments)
SP_OBJECT_ID=$(az ad sp show --id $APP_ID --query id -o tsv)

# STAGING: ACR Push role
az role assignment create \
  --assignee-object-id $SP_OBJECT_ID \
  --assignee-principal-type ServicePrincipal \
  --role "AcrPush" \
  --scope "/subscriptions/${SUBSCRIPTION_ID}/resourceGroups/${RESOURCE_GROUP}-staging/providers/Microsoft.ContainerRegistry/registries/${ACR_NAME_STAGING}"

# STAGING: Contributor on Container App
az role assignment create \
  --assignee-object-id $SP_OBJECT_ID \
  --assignee-principal-type ServicePrincipal \
  --role "Contributor" \
  --scope "/subscriptions/${SUBSCRIPTION_ID}/resourceGroups/${RESOURCE_GROUP}-staging/providers/Microsoft.App/containerApps/${CONTAINERAPP_NAME_STAGING}"

# PROD: ACR Push role
az role assignment create \
  --assignee-object-id $SP_OBJECT_ID \
  --assignee-principal-type ServicePrincipal \
  --role "AcrPush" \
  --scope "/subscriptions/${SUBSCRIPTION_ID}/resourceGroups/${RESOURCE_GROUP}-prod/providers/Microsoft.ContainerRegistry/registries/${ACR_NAME_PROD}"

# PROD: Contributor on Container App
az role assignment create \
  --assignee-object-id $SP_OBJECT_ID \
  --assignee-principal-type ServicePrincipal \
  --role "Contributor" \
  --scope "/subscriptions/${SUBSCRIPTION_ID}/resourceGroups/${RESOURCE_GROUP}-prod/providers/Microsoft.App/containerApps/${CONTAINERAPP_NAME_PROD}"
```

### 5. Enable ACR Pull from Container Apps

Allow Container Apps to pull images from ACR:

```bash
# Enable managed identity on Container Apps (if not already enabled)
az containerapp identity assign \
  --name $CONTAINERAPP_NAME_STAGING \
  --resource-group "${RESOURCE_GROUP}-staging" \
  --system-assigned

az containerapp identity assign \
  --name $CONTAINERAPP_NAME_PROD \
  --resource-group "${RESOURCE_GROUP}-prod" \
  --system-assigned

# Get Container App's identity principal IDs
CA_STAGING_IDENTITY=$(az containerapp show \
  --name $CONTAINERAPP_NAME_STAGING \
  --resource-group "${RESOURCE_GROUP}-staging" \
  --query identity.principalId -o tsv)

CA_PROD_IDENTITY=$(az containerapp show \
  --name $CONTAINERAPP_NAME_PROD \
  --resource-group "${RESOURCE_GROUP}-prod" \
  --query identity.principalId -o tsv)

# Grant AcrPull role to Container Apps
az role assignment create \
  --assignee-object-id $CA_STAGING_IDENTITY \
  --assignee-principal-type ServicePrincipal \
  --role "AcrPull" \
  --scope "/subscriptions/${SUBSCRIPTION_ID}/resourceGroups/${RESOURCE_GROUP}-staging/providers/Microsoft.ContainerRegistry/registries/${ACR_NAME_STAGING}"

az role assignment create \
  --assignee-object-id $CA_PROD_IDENTITY \
  --assignee-principal-type ServicePrincipal \
  --role "AcrPull" \
  --scope "/subscriptions/${SUBSCRIPTION_ID}/resourceGroups/${RESOURCE_GROUP}-prod/providers/Microsoft.ContainerRegistry/registries/${ACR_NAME_PROD}"

# Configure Container Apps to use managed identity for ACR
az containerapp registry set \
  --name $CONTAINERAPP_NAME_STAGING \
  --resource-group "${RESOURCE_GROUP}-staging" \
  --server "${ACR_NAME_STAGING}.azurecr.io" \
  --identity system

az containerapp registry set \
  --name $CONTAINERAPP_NAME_PROD \
  --resource-group "${RESOURCE_GROUP}-prod" \
  --server "${ACR_NAME_PROD}.azurecr.io" \
  --identity system
```

## GitHub Configuration

### 1. Create GitHub Environments

Go to **Settings → Environments** in your GitHub repository and create:

1. **`staging`** environment
2. **`prod`** environment

For the `prod` environment, consider adding:
- Required reviewers
- Wait timer (e.g., 5 minutes)
- Deployment branch rules (only `main`)

### 2. Configure Environment Secrets

For **each environment**, add these secrets:

| Secret Name | Description | Example |
|-------------|-------------|---------|
| `AZURE_CLIENT_ID` | App Registration Client ID | `12345678-1234-1234-1234-123456789012` |
| `AZURE_TENANT_ID` | Azure AD Tenant ID | `12345678-1234-1234-1234-123456789012` |
| `AZURE_SUBSCRIPTION_ID` | Azure Subscription ID | `12345678-1234-1234-1234-123456789012` |
| `ACR_NAME` | ACR name (without .azurecr.io) | `acrfamilyappstaging` |
| `RESOURCE_GROUP` | Resource group name | `rg-familyapp-staging` |
| `CONTAINERAPP_NAME` | Container App name | `ca-familyapi-staging` |

#### Optional Application Secrets

These are passed as environment variables to your container:

| Secret Name | Description |
|-------------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_ANON_KEY` | Supabase anonymous key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key |
| `JWT_SECRET` | JWT signing secret |
| `CORS_ORIGIN` | Allowed CORS origins |

### 3. Required Values Summary

Get these values from Azure:

```bash
# Print all values needed for GitHub secrets
echo "=== GitHub Secrets for STAGING ==="
echo "AZURE_CLIENT_ID: $APP_ID"
echo "AZURE_TENANT_ID: $TENANT_ID"
echo "AZURE_SUBSCRIPTION_ID: $SUBSCRIPTION_ID"
echo "ACR_NAME: $ACR_NAME_STAGING"
echo "RESOURCE_GROUP: ${RESOURCE_GROUP}-staging"
echo "CONTAINERAPP_NAME: $CONTAINERAPP_NAME_STAGING"
echo ""
echo "=== GitHub Secrets for PROD ==="
echo "AZURE_CLIENT_ID: $APP_ID"
echo "AZURE_TENANT_ID: $TENANT_ID"
echo "AZURE_SUBSCRIPTION_ID: $SUBSCRIPTION_ID"
echo "ACR_NAME: $ACR_NAME_PROD"
echo "RESOURCE_GROUP: ${RESOURCE_GROUP}-prod"
echo "CONTAINERAPP_NAME: $CONTAINERAPP_NAME_PROD"
```

## Usage

### Automatic Deployment (Push to main)

Any push to `main` that changes files in `apps/api/`, `packages/shared/`, or the workflow itself will automatically deploy to **staging**.

### Manual Deployment

1. Go to **Actions** → **Deploy API to Azure Container Apps**
2. Click **Run workflow**
3. Select:
   - **Target environment**: `staging` or `prod`
   - **Custom image tag** (optional): e.g., `v1.2.3`
4. Click **Run workflow**

### Deploy Specific Version to Production

```bash
# Via GitHub CLI
gh workflow run deploy-api.yml \
  -f environment=prod \
  -f image_tag=sha-abc1234
```

## Troubleshooting

### OIDC Login Fails

1. Verify federated credential subject matches exactly:
   - Format: `repo:OWNER/REPO:environment:ENVIRONMENT_NAME`
   - Case-sensitive!

2. Check App Registration has correct permissions

3. Verify the environment name in GitHub matches the federated credential

### Container App Fails to Start

1. Check Container App logs:
   ```bash
   az containerapp logs show \
     --name $CONTAINERAPP_NAME \
     --resource-group $RESOURCE_GROUP \
     --type console
   ```

2. Verify environment variables are set correctly:
   ```bash
   az containerapp show \
     --name $CONTAINERAPP_NAME \
     --resource-group $RESOURCE_GROUP \
     --query properties.template.containers[0].env
   ```

### Health Check Fails

1. Ensure `/healthz` endpoint is implemented in your API
2. Check the Container App's ingress is enabled and external
3. Verify the container is listening on port 3000

### ACR Pull Fails

1. Verify Container App has system-assigned managed identity
2. Check the managed identity has `AcrPull` role on ACR
3. Verify the registry is configured:
   ```bash
   az containerapp registry list \
     --name $CONTAINERAPP_NAME \
     --resource-group $RESOURCE_GROUP
   ```

## Architecture Diagram

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   GitHub Repo   │────▶│  GitHub Actions │────▶│  Azure Login    │
│   (push/manual) │     │  (ubuntu-latest)│     │  (OIDC/fedcred) │
└─────────────────┘     └─────────────────┘     └────────┬────────┘
                                                         │
                        ┌────────────────────────────────┘
                        ▼
         ┌──────────────────────────────┐
         │  Azure Container Registry    │
         │  - Build & push image        │
         │  - Tag: sha, latest, custom  │
         └──────────────┬───────────────┘
                        │
                        ▼
         ┌──────────────────────────────┐
         │  Azure Container Apps        │
         │  - Update container image    │
         │  - Set environment vars      │
         │  - Wait for healthy revision │
         └──────────────┬───────────────┘
                        │
                        ▼
         ┌──────────────────────────────┐
         │  Health Check                │
         │  - GET /healthz              │
         │  - Expect HTTP 200           │
         └──────────────────────────────┘
```

## Security Notes

1. **No long-lived secrets**: OIDC federation means no client secrets stored in GitHub
2. **Least privilege**: Service Principal only has access to specific resources
3. **Environment isolation**: Staging and prod use separate ACRs and Container Apps
4. **Secret management**: Application secrets are stored in GitHub Environments, not in code
5. **Audit trail**: All deployments are tracked in GitHub Actions logs
