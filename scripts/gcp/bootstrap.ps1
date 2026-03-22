param(
  [string]$ProjectId,
  [string]$Region = "asia-south1",
  [string]$Repository = "doorcraft-pro",
  [string]$ServiceAccount = "doorcraft-pro-runner",
  [string]$BucketName
)

if (-not $ProjectId) {
  throw "ProjectId is required."
}

if (-not $BucketName) {
  throw "BucketName is required."
}

$serviceAccountEmail = "$ServiceAccount@$ProjectId.iam.gserviceaccount.com"

gcloud services enable `
  artifactregistry.googleapis.com `
  cloudbuild.googleapis.com `
  logging.googleapis.com `
  monitoring.googleapis.com `
  run.googleapis.com `
  secretmanager.googleapis.com `
  sqladmin.googleapis.com `
  storage.googleapis.com `
  --project=$ProjectId

gcloud artifacts repositories create $Repository `
  --project=$ProjectId `
  --location=$Region `
  --repository-format=docker `
  --description="DoorCraft Pro application images" 2>$null

gcloud iam service-accounts create $ServiceAccount `
  --project=$ProjectId `
  --display-name="DoorCraft Pro runtime" 2>$null

gcloud projects add-iam-policy-binding $ProjectId `
  --member="serviceAccount:$serviceAccountEmail" `
  --role="roles/cloudsql.client"

gcloud projects add-iam-policy-binding $ProjectId `
  --member="serviceAccount:$serviceAccountEmail" `
  --role="roles/secretmanager.secretAccessor"

gcloud storage buckets create "gs://$BucketName" `
  --project=$ProjectId `
  --location=$Region `
  --uniform-bucket-level-access 2>$null

gcloud storage buckets update "gs://$BucketName" `
  --public-access-prevention

gcloud storage buckets add-iam-policy-binding "gs://$BucketName" `
  --member="serviceAccount:$serviceAccountEmail" `
  --role="roles/storage.objectAdmin"
