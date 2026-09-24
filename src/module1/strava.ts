import type { ActivityType, Workout, WorkoutZones } from './types';

interface StravaTokenResponse {
  access_token: string;
}

interface StravaActivity {
  id: number;
  name: string;
  sport_type?: string;
  type?: string;
  start_date: string;
  elapsed_time?: number;
  moving_time?: number;
  distance?: number;
  average_watts?: number;
  weighted_average_watts?: number;
  average_heartrate?: number;
  average_speed?: number;
}

interface StravaZonesResponse {
  heart_rate?: { zones?: Array<{ min?: number; max?: number }> };
  power?: { zones?: Array<{ min?: number; max?: number }> };
}

export interface StravaClient {
  listWorkouts(): Promise<Workout[]>;
}

function normalizeType(type: string | undefined): ActivityType {
  const value = (type ?? '').toLowerCase();

  if (value.includes('ride') || value.includes('cycle')) {
    return 'cycling';
  }

  if (value.includes('run')) {
    return 'running';
  }

  if (value.includes('swim')) {
    return 'swimming';
  }

  if (value.includes('workout') || value.includes('weight') || value.includes('strength') || value.includes('gym')) {
    return 'gym';
  }

  if (value.includes('hike') || value.includes('walk')) {
    return 'hiking';
  }

  if (value.includes('yoga')) {
    return 'yoga';
  }

  return 'other';
}

function getThreshold(zones: Array<{ min?: number; max?: number }> | undefined): number | undefined {
  const lastZone = zones?.[zones.length - 1];
  return lastZone?.min ?? lastZone?.max;
}

function buildWorkoutZones(
  type: ActivityType,
  zones: StravaZonesResponse,
  paceThresholdMetersPerSecond?: number,
): WorkoutZones {
  const workoutZones: WorkoutZones = {};

  const powerThreshold = getThreshold(zones.power?.zones);
  if (powerThreshold) {
    workoutZones.power = { thresholdWatts: powerThreshold };
  }

  const heartRateThreshold = getThreshold(zones.heart_rate?.zones);
  if (heartRateThreshold) {
    workoutZones.heartRate = { thresholdBpm: heartRateThreshold };
  }

  if (paceThresholdMetersPerSecond && ['running', 'swimming', 'hiking'].includes(type)) {
    workoutZones.pace = { thresholdMetersPerSecond: paceThresholdMetersPerSecond };
  }

  return workoutZones;
}

async function fetchJson<T>(url: string, init: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) {
    throw new Error(`Strava request failed (${response.status} ${response.statusText}) for ${url}`);
  }

  return (await response.json()) as T;
}

export function createStravaClient(options: {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  paceThresholdMetersPerSecond?: number;
}): StravaClient {
  async function getAccessToken(): Promise<string> {
    const response = await fetchJson<StravaTokenResponse>('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        client_id: options.clientId,
        client_secret: options.clientSecret,
        grant_type: 'refresh_token',
        refresh_token: options.refreshToken,
      }),
    });

    return response.access_token;
  }

  async function listActivities(accessToken: string): Promise<StravaActivity[]> {
    const activities: StravaActivity[] = [];

    for (let page = 1; ; page += 1) {
      const pageItems = await fetchJson<StravaActivity[]>(
        `https://www.strava.com/api/v3/athlete/activities?per_page=200&page=${page}`,
        {
          headers: {
            authorization: 'Bearer ' + accessToken,
          },
        },
      );

      activities.push(...pageItems);

      if (pageItems.length < 200) {
        break;
      }
    }

    return activities;
  }

  async function getZones(accessToken: string): Promise<StravaZonesResponse> {
    return fetchJson<StravaZonesResponse>('https://www.strava.com/api/v3/athlete/zones', {
      headers: {
        authorization: 'Bearer ' + accessToken,
      },
    });
  }

  return {
    async listWorkouts(): Promise<Workout[]> {
      const accessToken = await getAccessToken();
      const [activities, zones] = await Promise.all([listActivities(accessToken), getZones(accessToken)]);

      return activities.map((activity) => {
        const type = normalizeType(activity.sport_type ?? activity.type);

        return {
          id: String(activity.id),
          name: activity.name,
          type,
          startDate: activity.start_date,
          durationSeconds: activity.moving_time ?? activity.elapsed_time ?? 0,
          distanceMeters: activity.distance,
          averagePowerWatts: activity.average_watts,
          normalizedPowerWatts: activity.weighted_average_watts,
          averageHeartRate: activity.average_heartrate,
          averagePaceMetersPerSecond: activity.average_speed,
          zones: buildWorkoutZones(type, zones, options.paceThresholdMetersPerSecond),
        };
      });
    },
  };
}
