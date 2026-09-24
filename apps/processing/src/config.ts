import 'dotenv/config';

export const config = {
  awsRegion: process.env.AWS_REGION ?? 'eu-west-1',
  awsEndpoint: process.env.LOCALSTACK_ENDPOINT ?? process.env.AWS_ENDPOINT_URL,
  rawBucket: process.env.RAW_S3_BUCKET ?? 'training-status-raw-dev',
  processedBucket: process.env.PROCESSED_S3_BUCKET ?? 'training-status-processed-dev',
  webBucket: process.env.WEB_S3_BUCKET ?? '',
  athleteName: process.env.ATHLETE_NAME ?? 'Athlete',
  ftp: Number(process.env.FTP ?? 250),
  thresholdHeartRate: Number(process.env.THRESHOLD_HEART_RATE ?? 170),
  thresholdPace: Number(process.env.RUN_THRESHOLD_PACE ?? 4.8),
  logLevel: process.env.LOG_LEVEL ?? 'info',
  stravaSecretArn: process.env.STRAVA_SECRET_ARN ?? '',
  strava: {
    clientId: process.env.STRAVA_CLIENT_ID ?? '',
    clientSecret: process.env.STRAVA_CLIENT_SECRET ?? '',
    refreshToken: process.env.STRAVA_REFRESH_TOKEN ?? '',
  },
};

export const getEnv = (key: string, fallback?: string) => process.env[key] ?? fallback ?? '';
