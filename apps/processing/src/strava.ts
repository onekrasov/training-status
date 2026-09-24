import { config } from './config.js';
import type { ActivityType, SportType } from '@training-status/shared';

const STRAVA_OAUTH_URL = 'https://www.strava.com/oauth/token';
const STRAVA_API_URL = 'https://www.strava.com/api/v3';

const sportTypeMap: Record<string, SportType> = {
  Run: 'run',
  Ride: 'ride',
  VirtualRide: 'ride',
  Swim: 'swim',
  WeightTraining: 'gym',
  Workout: 'gym',
  Hike: 'hike',
  Walk: 'hike',
  Yoga: 'yoga',
  RockClimbing: 'gym',
  AlpineSki: 'hike',
  NordicSki: 'run',
  TrailRun: 'run',
};

export type StravaActivity = {
  id: number;
  type: string;
  start_date: string;
  elapsed_time: number;
  distance?: number;
  average_heartrate?: number;
  average_watts?: number;
  average_speed?: number;
  moving_time?: number;
};

export type StravaStreamResponse = {
  data: number[];
  series_type?: string;
  original_size?: number;
  resolution?: string;
};

export type StravaAccessTokenResponse = {
  access_token: string;
  expires_at: number;
  refresh_token: string;
};

function average(values: number[] | undefined): number | undefined {
  if (!values || values.length === 0) return undefined;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export async function getStravaAccessToken(): Promise<string> {
  const response = await fetch(STRAVA_OAUTH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: Number(config.strava.clientId),
      client_secret: config.strava.clientSecret,
      refresh_token: config.strava.refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to refresh Strava token: ${response.status} ${text}`);
  }

  const payload = (await response.json()) as StravaAccessTokenResponse;
  return payload.access_token;
}

export async function fetchStravaActivityStreams(accessToken: string, activityId: number): Promise<Partial<ActivityType>> {
  const response = await fetch(`${STRAVA_API_URL}/activities/${activityId}/streams?keys=watts,heartrate,velocity_smooth&key_by_type=true`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    return {};
  }

  const raw = (await response.json()) as Record<string, StravaStreamResponse>;
  const powerStream = raw.watts?.data;
  const heartRateStream = raw.heartrate?.data;
  const paceStream = raw.velocity_smooth?.data?.map((value) => (value > 0 ? 1000 / value : 0)).filter((value) => Number.isFinite(value) && value > 0);

  return {
    powerAvgWatts: average(powerStream),
    heartRateAvg: average(heartRateStream),
    paceAvgSecondsPerKm: average(paceStream),
    powerStream,
    heartRateStream,
    paceStream,
  };
}

export async function fetchStravaActivities(accessToken: string): Promise<ActivityType[]> {
  const response = await fetch(`${STRAVA_API_URL}/athlete/activities?per_page=30`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Unable to fetch Strava activities: ${response.status} ${text}`);
  }

  const items = (await response.json()) as StravaActivity[];

  const activities = await Promise.all(
    items.map(async (activity) => {
      const sportType = sportTypeMap[activity.type] ?? 'run';
      const durationSeconds = Number(activity.elapsed_time ?? activity.moving_time ?? 0);
      const distanceMeters = activity.distance ? Math.round(activity.distance) : undefined;

      let paceAvgSecondsPerKm: number | undefined;
      if (distanceMeters && durationSeconds > 0 && (sportType === 'run' || sportType === 'hike' || sportType === 'swim')) {
        paceAvgSecondsPerKm = Math.round((durationSeconds / distanceMeters) * 1000);
      }

      const streamData = await fetchStravaActivityStreams(accessToken, activity.id);

      return {
        id: String(activity.id),
        sportType,
        startDate: activity.start_date,
        durationSeconds,
        distanceMeters,
        heartRateAvg: streamData.heartRateAvg ?? activity.average_heartrate,
        powerAvgWatts: streamData.powerAvgWatts ?? activity.average_watts,
        paceAvgSecondsPerKm: streamData.paceAvgSecondsPerKm ?? paceAvgSecondsPerKm,
        powerStream: streamData.powerStream,
        heartRateStream: streamData.heartRateStream,
        paceStream: streamData.paceStream,
      };
    }),
  );

  return activities;
}

export async function fetchActivitiesWithLatestToken(): Promise<ActivityType[]> {
  const accessToken = await getStravaAccessToken();
  return fetchStravaActivities(accessToken);
}
