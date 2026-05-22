param(
  [string]$ProjectId,
  [string]$Region = "asia-south1",
  [string]$Repository = "solobooks",
  [string]$ServiceName = "solobooks-web",
  [string]$MigratorJobName = "solobooks-migrate",
  [string]$ServiceAccount = "solobooks-runner",
  [string]$CloudSqlInstance,
  [string]$DatabaseUrlSecret = "solobooks-database-url",
  [string]$JwtSecretSecret = "solobooks-jwt-secret",
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
  throw "CloudSqlInstance is required. Example: my-project:asia-south1:solobooks-db"
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
