import {
  type ActivityType,
  type ReadinessBreakdown,
  type ReadinessReport,
  type TssSource,
  type Workout,
  type WorkoutTssBreakdown,
} from './types';

const WINDOW_DAYS = 42;
const ACUTE_WINDOW_DAYS = 7;

const SPORT_MULTIPLIERS: Record<ActivityType, number> = {
  cycling: 1,
  running: 1,
  swimming: 0.9,
  gym: 0.6,
  hiking: 0.75,
  yoga: 0.35,
  other: 0.7,
};

const ESTIMATED_TSS_PER_HOUR: Record<ActivityType, number> = {
  cycling: 55,
  running: 60,
  swimming: 50,
  gym: 45,
  hiking: 35,
  yoga: 18,
  other: 30,
};

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function toHours(durationSeconds: number): number {
  return Math.max(durationSeconds, 0) / 3600;
}

function calculateBaseTss(workout: Workout): { source: TssSource; tss: number } {
  const hours = toHours(workout.durationSeconds);

  if (hours === 0) {
    return { source: 'estimated', tss: 0 };
  }

  const powerReading = workout.normalizedPowerWatts ?? workout.averagePowerWatts;
  const powerThreshold = workout.zones.power?.thresholdWatts;
  if (powerReading && powerThreshold && powerThreshold > 0) {
    const intensityFactor = clamp(powerReading / powerThreshold, 0, 1.5);
    return { source: 'power', tss: hours * intensityFactor ** 2 * 100 };
  }

  const heartRateReading = workout.averageHeartRate;
  const heartRateThreshold = workout.zones.heartRate?.thresholdBpm;
  if (heartRateReading && heartRateThreshold && heartRateThreshold > 0) {
    const intensityFactor = clamp(heartRateReading / heartRateThreshold, 0, 1.5);
    return { source: 'heartRate', tss: hours * intensityFactor ** 2 * 100 };
  }

  const paceReading = workout.averagePaceMetersPerSecond;
  const paceThreshold = workout.zones.pace?.thresholdMetersPerSecond;
  if (paceReading && paceThreshold && paceThreshold > 0) {
    const intensityFactor = clamp(paceReading / paceThreshold, 0, 1.5);
    return { source: 'pace', tss: hours * intensityFactor ** 2 * 100 };
  }

  return {
    source: 'estimated',
    tss: hours * ESTIMATED_TSS_PER_HOUR[workout.type],
  };
}

export function calculateWorkoutTss(workout: Workout): WorkoutTssBreakdown {
  const base = calculateBaseTss(workout);
  const adjustment = SPORT_MULTIPLIERS[workout.type];

  return {
    workoutId: workout.id,
    name: workout.name,
    type: workout.type,
    source: base.source,
    tss: round(base.tss * adjustment),
    startDate: workout.startDate,
  };
}

function buildBreakdown(workouts: WorkoutTssBreakdown[]): ReadinessBreakdown[] {
  const bySource = new Map<TssSource, ReadinessBreakdown>();

  for (const workout of workouts) {
    const existing = bySource.get(workout.source) ?? {
      source: workout.source,
      workoutCount: 0,
      tss: 0,
    };

    existing.workoutCount += 1;
    existing.tss = round(existing.tss + workout.tss);
    bySource.set(workout.source, existing);
  }

  return Array.from(bySource.values()).sort((left, right) => right.tss - left.tss);
}

export function calculateReadiness(workouts: Workout[], now = new Date()): ReadinessReport {
  const windowStart = new Date(now);
  windowStart.setUTCDate(windowStart.getUTCDate() - WINDOW_DAYS);

  const acuteWindowStart = new Date(now);
  acuteWindowStart.setUTCDate(acuteWindowStart.getUTCDate() - ACUTE_WINDOW_DAYS);

  const workoutsInWindow = workouts
    .filter((workout) => new Date(workout.startDate) >= windowStart)
    .sort((left, right) => left.startDate.localeCompare(right.startDate));

  const workoutTss = workoutsInWindow.map(calculateWorkoutTss);
  const tss42DayTotal = round(workoutTss.reduce((total, workout) => total + workout.tss, 0));
  const acuteLoad7Day = round(
    workoutTss
      .filter((workout) => new Date(workout.startDate) >= acuteWindowStart)
      .reduce((total, workout) => total + workout.tss, 0),
  );
  const observedWindowDays = workoutsInWindow[0]
    ? clamp(
        Math.ceil((now.getTime() - new Date(workoutsInWindow[0].startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1,
        ACUTE_WINDOW_DAYS,
        WINDOW_DAYS,
      )
    : 0;
  const chronicLoadDailyAverage = observedWindowDays > 0 ? round(tss42DayTotal / observedWindowDays) : 0;
  const chronicWeeklyEquivalent = chronicLoadDailyAverage * ACUTE_WINDOW_DAYS;
  const loadRatio =
    chronicWeeklyEquivalent > 0 ? acuteLoad7Day / chronicWeeklyEquivalent : acuteLoad7Day > 0 ? 1.5 : 1;
  const readinessPenalty = Math.abs(loadRatio - 1) * 45 + Math.max(loadRatio - 1, 0) * 15;
  const readinessScore = round(clamp(100 - readinessPenalty, 0, 100));

  return {
    generatedAt: now.toISOString(),
    windowDays: WINDOW_DAYS,
    workoutsConsidered: workoutsInWindow.length,
    tss42DayTotal,
    acuteLoad7Day,
    chronicLoadDailyAverage,
    readinessScore,
    breakdown: buildBreakdown(workoutTss),
    workouts: workoutTss,
  };
}
