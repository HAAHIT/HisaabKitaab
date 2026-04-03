param(
  [string]$ProjectId,
  [string]$Region = "asia-south1",
  [string]$Repository = "hisaabkitaab",
  [string]$ServiceName = "hisaabkitaab-web",
  [string]$MigratorJobName = "hisaabkitaab-migrate",
  [string]$ServiceAccount = "hisaabkitaab-runner",
  [string]$CloudSqlInstance,
  [string]$DatabaseUrlSecret = "hisaabkitaab-database-url",
  [string]$JwtSecretSecret = "hisaabkitaab-jwt-secret",
  [string]$GcsBucketName,
  [string]$Cpu = "1",
  [string]$Memory = "1Gi",
  [string]$MinInstances = "0",
  [string]$MaxInstances = "10",
  [string]$Ingress = "all"
)

if (-not $ProjectId) {
  throw "ProjectId is required."
}

if (-not $CloudSqlInstance) {
  throw "CloudSqlInstance is required. Example: my-project:asia-south1:hisaabkitaab-db"
}

if (-not $GcsBucketName) {
  throw "GcsBucketName is required."
}

$substitutions = @(
  "_REGION=$Region",
  "_REPOSITORY=$Repository",
  "_SERVICE_NAME=$ServiceName",
  "_MIGRATOR_JOB_NAME=$MigratorJobName",
  "_SERVICE_ACCOUNT=$ServiceAccount",
  "_CLOUDSQL_INSTANCE=$CloudSqlInstance",
  "_DATABASE_URL_SECRET=$DatabaseUrlSecret",
  "_JWT_SECRET_SECRET=$JwtSecretSecret",
  "_GCS_BUCKET_NAME=$GcsBucketName",
  "_CPU=$Cpu",
  "_MEMORY=$Memory",
  "_MIN_INSTANCES=$MinInstances",
  "_MAX_INSTANCES=$MaxInstances",
  "_INGRESS=$Ingress"
) -join ","

gcloud builds submit `
  --project=$ProjectId `
  --region=$Region `
  --config=cloudbuild.yaml `
  --substitutions=$substitutions `
  .
