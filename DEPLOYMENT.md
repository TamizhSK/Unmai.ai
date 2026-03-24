# Unmai.ai — Production Deployment Guide

Deploy Unmai.ai to Google Cloud Run using Cloud Build, and map a custom domain.

---

## Prerequisites

1. **Google Cloud CLI** installed and authenticated:
   ```bash
   gcloud auth login
   gcloud config set project unmai-ai-2025
   ```

2. **APIs enabled**:
   ```bash
   gcloud services enable \
     cloudbuild.googleapis.com \
     run.googleapis.com \
     artifactregistry.googleapis.com \
     secretmanager.googleapis.com \
     domains.googleapis.com
   ```

---

## Step 1: Create Artifact Registry Repository

```bash
gcloud artifacts repositories create unmai-repo \
  --repository-format=docker \
  --location=us-central1 \
  --description="Unmai.ai Docker images"
```

---

## Step 2: Create Secrets in Secret Manager

```bash
# Gemini API key
echo -n "YOUR_GEMINI_API_KEY" | \
  gcloud secrets create gemini-api-key --data-file=-

# JWT secret for auth
echo -n "YOUR_JWT_SECRET_HERE" | \
  gcloud secrets create jwt-secret --data-file=-
```

Grant the Cloud Run compute service account access to read secrets:

```bash
gcloud secrets add-iam-policy-binding gemini-api-key \
  --member="serviceAccount:1011862643582-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding jwt-secret \
  --member="serviceAccount:1011862643582-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

---

## Step 3: Grant Cloud Build Permissions

```bash
# Cloud Build -> Cloud Run Admin (deploy + set IAM policies)
gcloud projects add-iam-policy-binding unmai-ai-2025 \
  --member="serviceAccount:1011862643582-compute@developer.gserviceaccount.com" \
  --role="roles/run.admin"

# Cloud Build -> Service Account User
gcloud iam service-accounts add-iam-policy-binding \
  1011862643582-compute@developer.gserviceaccount.com \
  --member="serviceAccount:1011862643582-compute@developer.gserviceaccount.com" \
  --role="roles/iam.serviceAccountUser"
```

---

## Step 4: Allow Public Access (Unauthenticated Invocations)

After the first deploy, allow public access to both services:

```bash
gcloud run services add-iam-policy-binding unmai-backend \
  --region=us-central1 \
  --member=allUsers \
  --role=roles/run.invoker

gcloud run services add-iam-policy-binding unmai-frontend \
  --region=us-central1 \
  --member=allUsers \
  --role=roles/run.invoker
```

Or do it from the **Cloud Console**:
1. Go to [Cloud Run](https://console.cloud.google.com/run?project=unmai-ai-2025)
2. Click on each service -> **Security** tab
3. Under **Authentication**, select **Allow unauthenticated invocations**

---

## Step 5: Deploy with Cloud Build

From the project root:

```bash
gcloud builds submit --config=cloudbuild-minimal.yaml
```

Pipeline steps:

| Step | What it does |
|------|-------------|
| 1 | Configure Docker auth for Artifact Registry |
| 2 | Build backend Docker image |
| 3 | Push backend image |
| 4 | Deploy backend to Cloud Run (port 8080) |
| 5 | Get backend URL, write frontend `.env.production` |
| 6 | Build frontend Docker image (bakes in backend URL) |
| 7 | Push frontend image |
| 8 | Deploy frontend to Cloud Run (port 3000) |
| 9 | Verify health checks and connectivity |

Build takes ~7-10 minutes.

```bash
# Monitor build progress
gcloud builds log --stream $(gcloud builds list --limit=1 --format='value(id)')
```

---

## Step 6: Verify Deployment

```bash
# Get service URLs
gcloud run services describe unmai-backend --region=us-central1 --format='value(status.url)'
gcloud run services describe unmai-frontend --region=us-central1 --format='value(status.url)'

# Test backend health
curl -s "$(gcloud run services describe unmai-backend --region=us-central1 --format='value(status.url)')/health"
```

---

## Step 7: Map Custom Domain

### 7a. Verify Domain Ownership

Before mapping a domain, Google requires you to prove you own it.

1. Go to [Google Search Console](https://search.google.com/search-console/welcome)
2. Click **Domain** and enter `unmai-ai.run.place`
3. Google will give you a **TXT record** to add to your DNS
4. Add the TXT record at your domain registrar (e.g., Namecheap, Cloudflare, GoDaddy)
5. Click **Verify** in Search Console
6. Wait for verification to complete (usually 5-15 minutes)

**Alternative**: Verify via the `gcloud` CLI:

```bash
# Open the Webmaster Central verification page
gcloud domains verify unmai-ai.run.place
```

This opens a browser where you can complete verification.

### 7b. Create Domain Mapping

Once verified:

```bash
gcloud beta run domain-mappings create \
  --service=unmai-frontend \
  --domain=unmai-ai.run.place \
  --region=us-central1
```

Get the required DNS records:

```bash
gcloud beta run domain-mappings describe \
  --domain=unmai-ai.run.place \
  --region=us-central1
```

Add the DNS records at your registrar:

| Type | Name | Value |
|------|------|-------|
| CNAME | unmai-ai.run.place | ghs.googlehosted.com. |

SSL is automatically provisioned by Google after DNS propagates (5-30 minutes).

### 7c. (Alternative) Use a Global Load Balancer

If you need both apex domain and `www`, or want CDN/DDoS protection:

```bash
# 1. Create serverless NEG
gcloud compute network-endpoint-groups create unmai-frontend-neg \
  --region=us-central1 \
  --network-endpoint-type=serverless \
  --cloud-run-service=unmai-frontend

# 2. Create backend service
gcloud compute backend-services create unmai-frontend-bs \
  --global \
  --load-balancing-scheme=EXTERNAL_MANAGED

# 3. Add NEG to backend service
gcloud compute backend-services add-backend unmai-frontend-bs \
  --global \
  --network-endpoint-group=unmai-frontend-neg \
  --network-endpoint-group-region=us-central1

# 4. Create URL map
gcloud compute url-maps create unmai-url-map \
  --default-service=unmai-frontend-bs

# 5. Create managed SSL certificate
gcloud compute ssl-certificates create unmai-cert \
  --domains=unmai-ai.run.place,www.unmai-ai.run.place \
  --global

# 6. Create HTTPS proxy
gcloud compute target-https-proxies create unmai-https-proxy \
  --ssl-certificates=unmai-cert \
  --url-map=unmai-url-map

# 7. Create forwarding rule
gcloud compute forwarding-rules create unmai-https-rule \
  --global \
  --target-https-proxy=unmai-https-proxy \
  --ports=443

# 8. Get the assigned IP
gcloud compute forwarding-rules describe unmai-https-rule \
  --global --format='value(IPAddress)'
```

Point DNS A records to the IP from step 8.

---

## Step 8: Update CORS After Domain Mapping

```bash
gcloud run services update unmai-backend \
  --region=us-central1 \
  --update-env-vars='^|^ALLOWED_ORIGINS=https://unmai-ai.run.place,https://www.unmai-ai.run.place'
```

---

## Redeploying

```bash
gcloud builds submit --config=cloudbuild-minimal.yaml
```

### Deploy only one service manually

```bash
# Backend only
gcloud run deploy unmai-backend \
  --source=./backend \
  --region=us-central1 \
  --port=8080

# Frontend only
gcloud run deploy unmai-frontend \
  --source=./frontend \
  --region=us-central1 \
  --port=3000
```

---

## Architecture

```
               ┌───────────────────┐
               │  unmai-ai.run.place│
               └─────────┬─────────┘
                         │
               ┌─────────▼─────────┐
               │  Cloud Run        │
               │  unmai-frontend   │
               │  (Next.js :3000)  │
               └─────────┬─────────┘
                         │ HTTPS
               ┌─────────▼─────────┐
               │  Cloud Run        │
               │  unmai-backend    │
               │  (Express :8080)  │
               └─────────┬─────────┘
                         │
          ┌──────────────┼──────────────┐
          │              │              │
   ┌──────▼─────┐ ┌─────▼──────┐ ┌────▼──────┐
   │  Gemini    │ │  Firestore │ │  GCP APIs │
   │  API       │ │  Database  │ │  (Vision, │
   │            │ │            │ │  Video,..)│
   └────────────┘ └────────────┘ └───────────┘
```

---

## Troubleshooting

### "Permission denied" on IAM policy binding
The Cloud Build service account needs `roles/run.admin`. See Step 3.
Alternatively, set public access manually via Cloud Console (Step 4).

### "Domain does not appear to be verified"
You must verify domain ownership first. See Step 7a.

### Backend returns 403
Public access not enabled. Run the commands in Step 4.

### Frontend shows "Failed to fetch" / CORS errors
Backend `ALLOWED_ORIGINS` doesn't include the frontend domain. See Step 8.

### Build fails at "push-backend"
Artifact Registry repo may not exist. See Step 1.

### SSL certificate not provisioning
DNS must resolve correctly before Google issues the cert. Check with:
```bash
dig unmai-ai.run.place CNAME
```
Allow up to 24 hours for DNS propagation (usually 5-30 minutes).
