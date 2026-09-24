import { describe, it, expect } from 'vitest';
import { calculateTss, calculateTrainingMetrics } from './tss.js';
import { buildSampleActivities, filterRecentActivities, getUnseenActivities } from './index.js';
import type { ActivityType, AthleteConfig } from '@training-status/shared';

const athlete: AthleteConfig = {
  athleteName: 'Athlete',
  ftp: 250,
  thresholdHeartRate: 170,
  thresholdPace: 4.8,
  sportMultipliers: {
    run: 1,
    ride: 1,
    swim: 0.9,
    gym: 0.65,
    hike: 0.7,
    yoga: 0.5,
  },
};

describe('TSS calculation', () => {
  it('uses power as preferred source when available', () => {
    const activity: ActivityType = {
      id: '1',
      sportType: 'ride',
      startDate: '2024-01-01T00:00:00Z',
      durationSeconds: 3600,
      powerAvgWatts: 200,
    };

    expect(calculateTss(activity, athlete)).toBeGreaterThan(0);
  });

  it('returns a realistic composite metrics object', () => {
    const activities: ActivityType[] = [
      {
        id: 'a1',
        sportType: 'ride',
        startDate: '2024-01-01T00:00:00Z',
        durationSeconds: 3600,
        powerAvgWatts: 200,
      },
      {
        id: 'a2',
        sportType: 'gym',
        startDate: '2024-01-02T00:00:00Z',
        durationSeconds: 1800,
        heartRateAvg: 120,
      },
    ];

    const metrics = calculateTrainingMetrics(activities, athlete, '2024-01-02');

    expect(metrics.tss).toBeGreaterThan(0);
    expect(metrics.fatigue).toBeGreaterThan(0);
    expect(metrics.readiness).toBeGreaterThanOrEqual(0);
  });

  it('reports only the current day TSS', () => {
    const metrics = calculateTrainingMetrics(
      [
        { id: 'today', sportType: 'ride', startDate: '2024-01-02T12:00:00Z', durationSeconds: 3600, powerAvgWatts: 200 },
        { id: 'yesterday', sportType: 'ride', startDate: '2024-01-01T12:00:00Z', durationSeconds: 3600, powerAvgWatts: 200 },
      ],
      athlete,
      '2024-01-02T18:00:00Z',
    );

    expect(metrics.tss).toBe(64);
  });

  it('reports zero current TSS on a rest day', () => {
    const metrics = calculateTrainingMetrics(
      [{ id: 'yesterday', sportType: 'ride', startDate: '2024-01-01T12:00:00Z', durationSeconds: 3600, powerAvgWatts: 200 }],
      athlete,
      '2024-01-02T18:00:00Z',
    );

    expect(metrics.tss).toBe(0);
  });

  it('uses acute weekly load for fatigue instead of the entire 42-day total', () => {
    const metrics = calculateTrainingMetrics(
      [
        { id: 'recent', sportType: 'ride', startDate: '2024-01-02T00:00:00Z', durationSeconds: 3600, powerAvgWatts: 200 },
        { id: 'older', sportType: 'ride', startDate: '2023-12-10T00:00:00Z', durationSeconds: 3600, powerAvgWatts: 200 },
      ],
      athlete,
      '2024-01-03T00:00:00Z',
    );

    expect(metrics.tss).toBe(0);
    expect(metrics.fatigue).toBe(8);
    expect(metrics.load).toBe(2);
    expect(metrics.readiness).toBe(45);
  });

  it('interprets a configured pace threshold in minutes per kilometer', () => {
    const activity: ActivityType = {
      id: 'pace',
      sportType: 'run',
      startDate: '2024-01-01T00:00:00Z',
      durationSeconds: 3600,
      paceAvgSecondsPerKm: 300,
    };

    expect(calculateTss(activity, athlete)).toBe(92);
  });

  it('keeps only the most recent 42 days of activities', () => {
    const now = Date.now();
    const fortyTwoDaysAgo = new Date(now - 42 * 24 * 60 * 60 * 1000).toISOString();
    const tenDaysAgo = new Date(now - 10 * 24 * 60 * 60 * 1000).toISOString();
    const activities: ActivityType[] = [
      { id: 'old', sportType: 'run', startDate: fortyTwoDaysAgo, durationSeconds: 1800 },
      { id: 'recent', sportType: 'ride', startDate: tenDaysAgo, durationSeconds: 5400, powerAvgWatts: 200 },
    ];

    const filtered = filterRecentActivities(activities, 42);
    expect(filtered.map((activity) => activity.id)).toEqual(['recent']);
  });

  it('skips activity IDs that are already cached', () => {
    const activities: ActivityType[] = [
      { id: 'new', sportType: 'run', startDate: '2024-01-12T00:00:00Z', durationSeconds: 3600 },
      { id: 'cached', sportType: 'ride', startDate: '2024-01-13T00:00:00Z', durationSeconds: 3600, powerAvgWatts: 210 },
    ];

    const unseen = getUnseenActivities(activities, new Set(['cached']));
    expect(unseen.map((activity) => activity.id)).toEqual(['new']);
  });

  it('builds recent sample activities for local development', () => {
    const activities = buildSampleActivities();

    expect(activities.length).toBeGreaterThan(0);
    activities.forEach((activity) => {
      const ageDays = (Date.now() - new Date(activity.startDate).getTime()) / (24 * 60 * 60 * 1000);
      expect(ageDays).toBeLessThan(42);
    });
  });

  it('generates fresh sample IDs so they are not treated as cached duplicates', () => {
    const first = buildSampleActivities().map((activity) => activity.id);
    const second = buildSampleActivities().map((activity) => activity.id);

    expect(first).not.toEqual(second);
  });

  it('keeps recent activity data even when every ID is already cached', () => {
    const now = Date.now();
    const recent = [
      { id: 'cached-1', sportType: 'ride', startDate: new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString(), durationSeconds: 5400, powerAvgWatts: 220 },
      { id: 'cached-2', sportType: 'run', startDate: new Date(now - 5 * 24 * 60 * 60 * 1000).toISOString(), durationSeconds: 3600, heartRateAvg: 156 },
    ] as ActivityType[];

    const next = filterRecentActivities(recent, 42);
    expect(next).toHaveLength(2);
    expect(next.map((activity) => activity.id)).toEqual(['cached-2', 'cached-1']);
  });
});
