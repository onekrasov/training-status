import { calculateReadiness } from './analysis';
import type { JsonStorage, SyncResult, Workout, WorkoutIndex, WorkoutIndexEntry } from './types';

export const DEFAULT_INDEX_KEY = 'index.json';
export const DEFAULT_READINESS_KEY = 'readiness/latest.json';

export interface WorkoutProvider {
  listWorkouts(after?: Date): Promise<Workout[]>;
}

function workoutStorageKey(id: string): string {
  return `workouts/${id}.json`;
}

function ensureIndexedWorkout(
  index: WorkoutIndex,
  workout: Workout,
  downloadedAt: string,
): WorkoutIndexEntry {
  const entry: WorkoutIndexEntry = {
    id: workout.id,
    key: workoutStorageKey(workout.id),
    type: workout.type,
    startDate: workout.startDate,
    downloadedAt,
  };

  index.workouts.push(entry);
  return entry;
}

export async function syncWorkouts(options: {
  storage: JsonStorage;
  stravaClient: WorkoutProvider;
  publicReadinessStorage?: JsonStorage;
  now?: Date;
  indexKey?: string;
  readinessKey?: string;
  publicReadinessKey?: string;
}): Promise<SyncResult> {
  const now = options.now ?? new Date();
  const indexKey = options.indexKey ?? DEFAULT_INDEX_KEY;
  const readinessKey = options.readinessKey ?? DEFAULT_READINESS_KEY;
  const timestamp = now.toISOString();
  const storage = options.storage;

  const index =
    (await storage.getJson<WorkoutIndex>(indexKey)) ??
    ({
      updatedAt: timestamp,
      workouts: [],
    } satisfies WorkoutIndex);

  const indexedIds = new Set(index.workouts.map((entry) => entry.id));
  const newestIndexedWorkout = index.workouts[index.workouts.length - 1];
  const workouts = await options.stravaClient.listWorkouts(
    newestIndexedWorkout ? new Date(newestIndexedWorkout.startDate) : undefined,
  );

  let downloaded = 0;
  let skipped = 0;

  for (const workout of workouts) {
    if (indexedIds.has(workout.id)) {
      skipped += 1;
      continue;
    }

    const key = workoutStorageKey(workout.id);
    const existingWorkout = await storage.getJson<Workout>(key);

    if (existingWorkout) {
      ensureIndexedWorkout(index, existingWorkout, timestamp);
      indexedIds.add(existingWorkout.id);
      skipped += 1;
      continue;
    }

    await storage.putJson(key, workout);
    ensureIndexedWorkout(index, workout, timestamp);
    indexedIds.add(workout.id);
    downloaded += 1;
  }

  index.updatedAt = timestamp;
  index.workouts.sort((left, right) => left.startDate.localeCompare(right.startDate));

  await storage.putJson(indexKey, index);

  const storedWorkouts = (
    await Promise.all(index.workouts.map(async (entry) => storage.getJson<Workout>(entry.key)))
  ).filter((workout): workout is Workout => Boolean(workout));

  const readiness = calculateReadiness(storedWorkouts, now);
  await storage.putJson(readinessKey, readiness);
  if (options.publicReadinessStorage) {
    await options.publicReadinessStorage.putJson(options.publicReadinessKey ?? readinessKey, readiness);
  }

  return {
    downloaded,
    skipped,
    totalIndexed: index.workouts.length,
    readinessKey,
  };
}
