import test from 'node:test';
import assert from 'node:assert/strict';

import { calculateReadiness, calculateWorkoutTss } from '../src/module1/analysis';
import type { Workout } from '../src/module1/types';

function createWorkout(overrides: Partial<Workout>): Workout {
  return {
    id: 'workout-1',
    name: 'Workout',
    type: 'cycling',
    startDate: '2026-09-20T08:00:00.000Z',
    durationSeconds: 3600,
    zones: {},
    ...overrides,
  };
}

test('calculateWorkoutTss prefers power over other sources', () => {
  const workout = createWorkout({
    averagePowerWatts: 210,
    normalizedPowerWatts: 240,
    averageHeartRate: 170,
    averagePaceMetersPerSecond: 4.2,
    zones: {
      power: { thresholdWatts: 300 },
      heartRate: { thresholdBpm: 180 },
      pace: { thresholdMetersPerSecond: 5 },
    },
  });

  const result = calculateWorkoutTss(workout);

  assert.equal(result.source, 'power');
  assert.equal(result.tss, 64);
});

test('calculateWorkoutTss falls back to pace and keeps yoga realistic', () => {
  const paceWorkout = createWorkout({
    id: 'run-1',
    type: 'running',
    averagePaceMetersPerSecond: 4,
    zones: {
      pace: { thresholdMetersPerSecond: 5 },
    },
  });
  const yogaWorkout = createWorkout({
    id: 'yoga-1',
    type: 'yoga',
    averageHeartRate: 120,
    zones: {
      heartRate: { thresholdBpm: 160 },
    },
  });

  const paceResult = calculateWorkoutTss(paceWorkout);
  const yogaResult = calculateWorkoutTss(yogaWorkout);

  assert.equal(paceResult.source, 'pace');
  assert.equal(paceResult.tss, 64);
  assert.equal(yogaResult.source, 'heartRate');
  assert.equal(yogaResult.tss, 19.69);
});

test('calculateReadiness only includes the last 42 days', () => {
  const readiness = calculateReadiness(
    [
      createWorkout({
        id: 'recent-cycle',
        startDate: '2026-09-23T08:00:00.000Z',
        averagePowerWatts: 210,
        zones: { power: { thresholdWatts: 300 } },
      }),
      createWorkout({
        id: 'recent-run',
        type: 'running',
        startDate: '2026-09-22T08:00:00.000Z',
        averagePaceMetersPerSecond: 4,
        zones: { pace: { thresholdMetersPerSecond: 5 } },
      }),
      createWorkout({
        id: 'old-workout',
        startDate: '2026-07-01T08:00:00.000Z',
        averagePowerWatts: 240,
        zones: { power: { thresholdWatts: 300 } },
      }),
    ],
    new Date('2026-09-24T10:00:00.000Z'),
  );

  assert.equal(readiness.workoutsConsidered, 2);
  assert.equal(readiness.tss42DayTotal, 113);
  assert.equal(readiness.acuteLoad7Day, 113);
  assert.equal(
    readiness.breakdown.some((entry) => entry.source === 'power'),
    true,
  );
});
