import test from 'node:test';
import assert from 'node:assert/strict';

import { DEFAULT_INDEX_KEY, DEFAULT_READINESS_KEY, syncWorkouts } from '../src/module1/sync';
import type { JsonStorage, Workout } from '../src/module1/types';

class InMemoryStorage implements JsonStorage {
  public readonly store = new Map<string, unknown>();

  public async getJson<T>(key: string): Promise<T | undefined> {
    return this.store.get(key) as T | undefined;
  }

  public async putJson<T>(key: string, value: T): Promise<void> {
    this.store.set(key, JSON.parse(JSON.stringify(value)) as T);
  }
}

function createWorkout(id: string, overrides: Partial<Workout> = {}): Workout {
  return {
    id,
    name: `Workout ${id}`,
    type: 'cycling',
    startDate: '2026-09-20T08:00:00.000Z',
    durationSeconds: 3600,
    averagePowerWatts: 225,
    zones: { power: { thresholdWatts: 300 } },
    ...overrides,
  };
}

test('syncWorkouts skips workouts already stored in S3 and updates the index', async () => {
  const storage = new InMemoryStorage();
  const publicStorage = new InMemoryStorage();
  const existingWorkout = createWorkout('100');
  await storage.putJson('workouts/100.json', existingWorkout);

  const result = await syncWorkouts({
    storage,
    publicReadinessStorage: publicStorage,
    now: new Date('2026-09-24T10:00:00.000Z'),
    stravaClient: {
      async listWorkouts(): Promise<Workout[]> {
        return [existingWorkout, createWorkout('200', { type: 'running', averagePaceMetersPerSecond: 4, zones: { pace: { thresholdMetersPerSecond: 5 } } })];
      },
    },
  });

  const index = await storage.getJson<{ workouts: Array<{ id: string }> }>(DEFAULT_INDEX_KEY);
  const readiness = await storage.getJson<{ workoutsConsidered: number }>(DEFAULT_READINESS_KEY);
  const publicReadiness = await publicStorage.getJson<{ workoutsConsidered: number }>(DEFAULT_READINESS_KEY);

  assert.deepEqual(result, {
    downloaded: 1,
    skipped: 1,
    totalIndexed: 2,
    readinessKey: DEFAULT_READINESS_KEY,
  });
  assert.deepEqual(
    index?.workouts.map((entry) => entry.id),
    ['100', '200'],
  );
  assert.equal(readiness?.workoutsConsidered, 2);
  assert.equal(publicReadiness?.workoutsConsidered, 2);
});

test('syncWorkouts requests only workouts after the newest indexed entry', async () => {
  const storage = new InMemoryStorage();
  await storage.putJson(DEFAULT_INDEX_KEY, {
    updatedAt: '2026-09-20T10:00:00.000Z',
    workouts: [
      {
        id: '100',
        key: 'workouts/100.json',
        type: 'cycling',
        startDate: '2026-09-20T08:00:00.000Z',
        downloadedAt: '2026-09-20T10:00:00.000Z',
      },
    ],
  });
  await storage.putJson('workouts/100.json', createWorkout('100'));

  let requestedAfter: Date | undefined;

  await syncWorkouts({
    storage,
    now: new Date('2026-09-24T10:00:00.000Z'),
    stravaClient: {
      async listWorkouts(after?: Date): Promise<Workout[]> {
        requestedAfter = after;
        return [];
      },
    },
  });

  assert.equal(requestedAfter?.toISOString(), '2026-09-20T08:00:00.000Z');
});
