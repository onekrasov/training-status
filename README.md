# training-status

Training status widget and backend sync pipeline that calculate training readiness from Strava workouts.

## Project layout

- `src/module1` – Lambda-ready TypeScript code that downloads workouts, stores them in S3, keeps an `index.json`, and writes the latest readiness JSON.
- `web/index.html` – single-file frontend with inline CSS and JavaScript that reads the readiness JSON from S3.
- `terraform` – minimal AWS infrastructure for the data bucket, website bucket, Lambda, and the every-minute CloudWatch trigger.
- `tests` – focused coverage for TSS/readiness analysis and S3 sync behavior.

## Module 1

The backend pipeline:

1. Refreshes the Strava access token.
2. Downloads athlete activities from Strava.
3. Stores each new workout as `workouts/<id>.json` in S3.
4. Maintains `index.json` with tracked workout keys.
5. Calculates 42-day training load, 7-day acute load, and a readiness score.
6. Publishes the result to `readiness/latest.json`.

TSS source priority is:

1. power
2. heart rate
3. pace
4. estimated fallback for sports such as gym and yoga

Gym and yoga workloads are down-weighted so their TSS stays realistic relative to endurance sessions.

## Module 2

`web/index.html` is a self-contained page with inline CSS and JavaScript so it can be uploaded as a single file to an S3 website bucket. It fetches the backend JSON output and renders the readiness score, load summary, and source breakdown.

## Environment variables

Module 1 expects:

- `TRAINING_BUCKET`
- `TRAINING_PREFIX` (optional)
- `PUBLIC_READINESS_BUCKET` (optional public bucket for the aggregated readiness JSON)
- `PUBLIC_READINESS_PREFIX` (optional)
- `STRAVA_CLIENT_ID`
- `STRAVA_CLIENT_SECRET`
- `STRAVA_REFRESH_TOKEN`
- `STRAVA_PACE_THRESHOLD_METERS_PER_SECOND` (optional pace fallback threshold)

## Commands

```bash
npm install
npm run build
npm test
```

## Terraform

The Terraform configuration provisions:

- S3 bucket for workout and readiness JSON
- S3 website bucket for the single-file UI
- Lambda execution role and policy
- Lambda function configuration
- CloudWatch Events schedule that runs every minute

Set the secret-backed Strava and AWS values through GitHub Actions or your deployment environment rather than committing them to the repository.
