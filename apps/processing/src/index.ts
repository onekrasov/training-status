import { S3Client, PutObjectCommand, CreateBucketCommand, HeadBucketCommand, GetObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { config } from './config.js';
import { calculateTss, calculateTrainingMetrics } from './tss.js';
import { fetchActivitiesWithLatestToken } from './strava.js';
import type { ActivityType, AthleteConfig } from '@training-status/shared';

export function filterRecentActivities(activities: ActivityType[], days: number): ActivityType[] {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return activities
    .filter((activity) => new Date(activity.startDate).getTime() > cutoff)
    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
}

export function getUnseenActivities(activities: ActivityType[], seenIds: Set<string>): ActivityType[] {
  return activities.filter((activity) => !seenIds.has(activity.id));
}

export function mergeRecentActivities(previous: ActivityType[], latest: ActivityType[], days = 42): ActivityType[] {
  const byId = new Map<string, ActivityType>();

  [...previous, ...latest].forEach((activity) => {
    byId.set(activity.id, activity);
  });

  return filterRecentActivities(Array.from(byId.values()), days);
}

const s3 = new S3Client({
  region: config.awsRegion,
  endpoint: config.awsEndpoint,
  forcePathStyle: !!config.awsEndpoint,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? 'test',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? 'test',
  },
});

export function buildSampleActivities(): ActivityType[] {
  const now = Date.now();
  const seed = Date.now() + Math.floor(Math.random() * 1000000);
  const daysAgo = (days: number) => new Date(now - days * 24 * 60 * 60 * 1000).toISOString();

  return [
    {
      id: `sample-ride-${seed}`,
      sportType: 'ride',
      startDate: daysAgo(3),
      durationSeconds: 5400,
      powerAvgWatts: 220,
    },
    {
      id: `sample-run-${seed + 1}`,
      sportType: 'run',
      startDate: daysAgo(6),
      durationSeconds: 3600,
      distanceMeters: 10000,
      heartRateAvg: 156,
    },
    {
      id: `sample-gym-${seed + 2}`,
      sportType: 'gym',
      startDate: daysAgo(10),
      durationSeconds: 1800,
      heartRateAvg: 118,
    },
    {
      id: `sample-yoga-${seed + 3}`,
      sportType: 'yoga',
      startDate: daysAgo(14),
      durationSeconds: 1200,
      heartRateAvg: 90,
    },
  ];
}

const athlete: AthleteConfig = {
  athleteName: config.athleteName,
  ftp: config.ftp,
  thresholdHeartRate: config.thresholdHeartRate,
  thresholdPace: config.thresholdPace,
  sportMultipliers: {
    run: 1,
    ride: 1,
    swim: 0.9,
    gym: 0.65,
    hike: 0.7,
    yoga: 0.5,
  },
};

async function ensureBucket(bucketName: string) {
  try {
    await s3.send(new HeadBucketCommand({ Bucket: bucketName }));
    return;
  } catch {
    await s3.send(new CreateBucketCommand({ Bucket: bucketName }));
  }
}

async function readJsonIfExists(bucketName: string, key: string): Promise<unknown | null> {
  try {
    const response = await s3.send(new GetObjectCommand({ Bucket: bucketName, Key: key }));
    const bytes = await response.Body?.transformToString();
    return bytes ? JSON.parse(bytes) : null;
  } catch {
    return null;
  }
}

async function loadCachedIds(bucketName: string): Promise<Set<string>> {
  const index = (await readJsonIfExists(bucketName, 'index.json')) as { ids?: string[] } | null;
  return new Set(index?.ids ?? []);
}

async function loadActivities(): Promise<ActivityType[]> {
  const hasStravaConfig = Boolean(config.strava.clientId && config.strava.clientSecret && config.strava.refreshToken);
  const sampleActivities = buildSampleActivities();

  if (!hasStravaConfig) {
    console.log('No Strava credentials found; using sample activities for local development.');
    return sampleActivities;
  }

  try {
    const cachedIds = await loadCachedIds(config.rawBucket);
    const fetched = await fetchActivitiesWithLatestToken();
    const unseen = getUnseenActivities(fetched, cachedIds);
    const filtered = filterRecentActivities(unseen.length > 0 ? unseen : fetched, 42);
    return filtered.length > 0 ? filtered : sampleActivities;
  } catch (error) {
    console.warn('Unable to fetch live Strava data, using sample activities instead:', error);
    return sampleActivities;
  }
}

async function uploadJson(bucketName: string, key: string, payload: unknown) {
  await s3.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: JSON.stringify(payload, null, 2),
      ContentType: 'application/json',
    }),
  );
}

export async function run() {
  await ensureBucket(config.rawBucket);
  await ensureBucket(config.processedBucket);
  if (config.webBucket) await ensureBucket(config.webBucket);

  const rawIndex = await readJsonIfExists(config.rawBucket, 'index.json');
  const cachedIds = new Set((rawIndex as { ids?: string[] } | null)?.ids ?? []);
  const existingRaw = (await readJsonIfExists(config.rawBucket, 'raw/activities.json')) as { activities?: ActivityType[] } | null;
  const freshActivities = await loadActivities();
  const activities = mergeRecentActivities(existingRaw?.activities ?? [], freshActivities, 42);
  const processedActivities = activities.map((activity) => ({
    ...activity,
    tss: calculateTss(activity, athlete),
  }));

  const metrics = calculateTrainingMetrics(activities, athlete, new Date().toISOString());
  const nextIds = Array.from(new Set([...(rawIndex as { ids?: string[] } | null)?.ids ?? [], ...activities.map((activity) => activity.id)]));

  await uploadJson(config.rawBucket, 'raw/activities.json', { generatedAt: new Date().toISOString(), activities });
  await uploadJson(config.rawBucket, 'index.json', { generatedAt: new Date().toISOString(), ids: nextIds });
  const processedPayload = {
    athlete,
    generatedAt: new Date().toISOString(),
    metrics,
    activities: processedActivities,
  };
  await uploadJson(config.processedBucket, 'training-status.json', processedPayload);
  if (config.webBucket) await uploadJson(config.webBucket, 'data/training-status.json', processedPayload);

  console.log('Local processing complete.');
  console.log(JSON.stringify({ metrics, activityCount: activities.length }, null, 2));
}

const isCliInvocation = process.argv[1]?.endsWith('/index.ts') || process.argv[1]?.endsWith('/index.js');

if (isCliInvocation) {
  run().catch((error) => {
    console.error('Local processing failed:', error);
    process.exit(1);
  });
}
