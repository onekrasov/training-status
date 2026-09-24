# Local development

This project is designed to be developed and validated locally without deploying to AWS.

## Requirements

- Docker
- Node.js 20+
- npm

## Start LocalStack

```bash
npm run local:up
```

This starts LocalStack with the S3 service on port 4566.

## Run the processing job locally

```bash
npm run local:process
```

The processing job will:

- create the raw and processed S3 buckets if missing
- fetch Strava activities when valid credentials are present
- otherwise use sample activities for local testing
- write raw JSON to the raw bucket
- compute TSS/fatigue/readiness and write processed JSON to the processed bucket

## Serve the dashboard locally

```bash
npm run dev:web
```

Then open:

http://localhost:4173

## Stop LocalStack

```bash
npm run local:down
```

## Environment variables

Copy `.env.example` into `.env` and populate the required values.

The app expects:

- AWS_REGION
- AWS_ACCESS_KEY_ID
- AWS_SECRET_ACCESS_KEY
- LOCALSTACK_ENDPOINT
- STRAVA_CLIENT_ID
- STRAVA_CLIENT_SECRET
- STRAVA_REFRESH_TOKEN
- RAW_S3_BUCKET
- PROCESSED_S3_BUCKET
- ATHLETE_NAME
- FTP
- THRESHOLD_HEART_RATE
- RUN_THRESHOLD_PACE
