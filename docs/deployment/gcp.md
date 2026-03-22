# GCP Deployment

## Target Architecture

- `Cloud Run` for the Next.js app container
- `Cloud SQL for PostgreSQL` for Prisma
- `Cloud Storage` for private media assets
- `Secret Manager` for runtime secrets
- `Artifact Registry` for container images
- `Cloud Run Job` or CI release step for `prisma migrate deploy`
- `Cloud Logging`, `Cloud Monitoring`, and alerting
- `Cloud Armor` and HTTPS load balancing for internet-facing protection

## Required Environment Variables

- `DATABASE_URL`
- `JWT_SECRET`
- `OBJECT_STORAGE_PROVIDER=gcs`
- `GCS_BUCKET_NAME`
- `GCS_PROJECT_ID`

Optional for local development only:

- `STORAGE_ROOT`

## GCP Resource Setup

1. Create a `Cloud SQL for PostgreSQL` instance in the same region as the app.
2. Create a private `Cloud Storage` bucket and enforce public access prevention.
3. Create a dedicated service account for the app.
4. Grant the runtime service account:
   - `Cloud SQL Client`
   - `Storage Object Admin` on the media bucket, or a tighter custom role with create/read/delete
   - `Secret Manager Secret Accessor` for runtime secrets
5. Store `DATABASE_URL` and `JWT_SECRET` in `Secret Manager`.
6. Configure `Cloud Run` to use the dedicated service account.
7. Attach the `Cloud SQL` instance to both the web service and the migration job.

`DATABASE_URL` should be a Cloud SQL socket connection string, for example:

```text
postgresql://APP_USER:APP_PASSWORD@localhost:5432/doorcraft_pro?host=/cloudsql/PROJECT_ID:REGION:INSTANCE
```

## Bootstrap Script

The repo includes [scripts/gcp/bootstrap.ps1](/D:/Sadhguru%20Door/doorcraft-pro/scripts/gcp/bootstrap.ps1) for first-time setup.

It enables required APIs, creates the Artifact Registry repository, creates the runtime service account, creates the storage bucket, enforces public access prevention, and grants the runtime roles.

Example:

```powershell
./scripts/gcp/bootstrap.ps1 `
  -ProjectId "my-gcp-project" `
  -BucketName "doorcraft-pro-media-prod"
```

## Container Build

The app container uses the root [Dockerfile](/D:/Sadhguru%20Door/doorcraft-pro/Dockerfile) with standalone output enabled in [next.config.ts](/D:/Sadhguru%20Door/doorcraft-pro/next.config.ts).

- Web target: `runner`
- Migration target: `migrator`

Example image build flow:

```bash
docker build -t doorcraft-pro:web --target runner .
docker build -t doorcraft-pro:migrator --target migrator .
```

## Cloud Build Pipeline

The repo now includes [cloudbuild.yaml](/D:/Sadhguru%20Door/doorcraft-pro/cloudbuild.yaml). It does five things in one release:

1. Build the web image from the `runner` target.
2. Build the migration image from the `migrator` target.
3. Deploy and execute the migration job.
4. Deploy the Cloud Run web service.
5. Smoke test `GET /api/health` on the deployed service.

The default substitutions are placeholders. You must set at least:

- `_CLOUDSQL_INSTANCE`
- `_GCS_BUCKET_NAME`

You can submit the pipeline from Windows with [scripts/gcp/deploy.ps1](/D:/Sadhguru%20Door/doorcraft-pro/scripts/gcp/deploy.ps1).

Example:

```powershell
./scripts/gcp/deploy.ps1 `
  -ProjectId "my-gcp-project" `
  -CloudSqlInstance "my-gcp-project:asia-south1:doorcraft-db" `
  -GcsBucketName "doorcraft-pro-media-prod"
```

Before the first deploy, create:

- the `doorcraft-database-url` secret
- the `doorcraft-jwt-secret` secret

Your Cloud Build execution identity also needs enough permissions to deploy releases. In practice, that means roles equivalent to:

- `Cloud Run Admin`
- `Service Account User`
- `Artifact Registry Writer`

If you want the app to stay private behind a load balancer later, change the Cloud Run ingress mode and remove the direct public access path in the pipeline.

## Release Flow

1. Build and push the `migrator` image.
2. Run `prisma migrate deploy` as a release step or `Cloud Run Job`.
3. Build and push the `runner` image.
4. Deploy the web image to `Cloud Run`.
5. Confirm `GET /api/health` is green.
6. Smoke test `/login`, `/api/auth/me`, `/api/bills`, and a protected media URL.

Do not run Prisma migrations during the normal web container startup.

## Security And Abuse Protection

- Login throttling is now database-backed in [src/lib/login-rate-limit.ts](/D:/Sadhguru%20Door/doorcraft-pro/src/lib/login-rate-limit.ts).
- The login route records structured success, failure, and throttle events in [src/app/api/auth/login/route.ts](/D:/Sadhguru%20Door/doorcraft-pro/src/app/api/auth/login/route.ts).
- Request IDs are propagated from [src/middleware.ts](/D:/Sadhguru%20Door/doorcraft-pro/src/middleware.ts) and returned in responses.
- Keep `JWT_SECRET` only in `Secret Manager`.
- Put the public hostname behind `Cloud Armor`.
- Keep the Cloud Storage bucket private and rely on the app route for measurement-photo authorization.

## Observability

- Health endpoint: [src/app/api/health/route.ts](/D:/Sadhguru%20Door/doorcraft-pro/src/app/api/health/route.ts)
- Structured JSON logging helper: [src/lib/observability.ts](/D:/Sadhguru%20Door/doorcraft-pro/src/lib/observability.ts)

Recommended alert policies in GCP:

- Cloud Run 5xx error rate spike
- Cloud Run request latency spike
- Cloud Run job execution failure for `doorcraft-pro-migrate`
- Cloud SQL CPU/storage pressure
- Log-based metric for repeated `auth.login.throttled` events
- Log-based metric for repeated `health.check.failed` events

## Media Storage Notes

- New uploaded media is stored in `Cloud Storage` when `OBJECT_STORAGE_PROVIDER=gcs`.
- The app keeps asset authorization in [src/app/api/assets/[id]/route.ts](/D:/Sadhguru%20Door/doorcraft-pro/src/app/api/assets/%5Bid%5D/route.ts) and streams GCS-backed files through the app instead of redirecting to a public object URL.
- Keep the bucket private. Do not expose measurement photos with public object ACLs.

## Remaining Work

- Create the actual alert policies and log-based metrics in GCP.
- Extend structured logging to more business-critical routes if you want broader operational visibility than auth and health.
