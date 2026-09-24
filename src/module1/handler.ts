import { createStravaClient } from './strava';
import { S3JsonStorage } from './storage';
import { syncWorkouts } from './sync';

function requireEnvironmentVariable(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export async function handler(): Promise<Awaited<ReturnType<typeof syncWorkouts>>> {
  const trainingBucket = requireEnvironmentVariable('TRAINING_BUCKET');
  const trainingPrefix = process.env.TRAINING_PREFIX;
  const publicReadinessBucket = process.env.PUBLIC_READINESS_BUCKET;
  const publicReadinessPrefix = process.env.PUBLIC_READINESS_PREFIX;
  const paceThresholdValue = process.env.STRAVA_PACE_THRESHOLD_METERS_PER_SECOND;
  const paceThresholdMetersPerSecond = paceThresholdValue ? Number(paceThresholdValue) : undefined;

  const storage = new S3JsonStorage({
    bucket: trainingBucket,
    prefix: trainingPrefix,
  });
  const publicReadinessStorage = publicReadinessBucket
    ? new S3JsonStorage({
        bucket: publicReadinessBucket,
        prefix: publicReadinessPrefix,
      })
    : undefined;

  const stravaClient = createStravaClient({
    clientId: requireEnvironmentVariable('STRAVA_CLIENT_ID'),
    clientSecret: requireEnvironmentVariable('STRAVA_CLIENT_SECRET'),
    refreshToken: requireEnvironmentVariable('STRAVA_REFRESH_TOKEN'),
    paceThresholdMetersPerSecond:
      paceThresholdMetersPerSecond && Number.isFinite(paceThresholdMetersPerSecond)
        ? paceThresholdMetersPerSecond
        : undefined,
  });

  return syncWorkouts({
    storage,
    publicReadinessStorage,
    stravaClient,
  });
}
