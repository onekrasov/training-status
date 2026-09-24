import type { ActivityType, AthleteConfig, TrainingMetrics } from '@training-status/shared';
import { defaultSportMultipliers } from '@training-status/shared';

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function calculateTss(activity: ActivityType, athlete: AthleteConfig): number {
  const multiplier = athlete.sportMultipliers?.[activity.sportType] ?? defaultSportMultipliers[activity.sportType];

  const powerAvg = activity.powerStream && activity.powerStream.length > 0 ? average(activity.powerStream) : activity.powerAvgWatts;
  if (powerAvg && athlete.ftp) {
    const normalized = powerAvg / athlete.ftp;
    const durationHours = activity.durationSeconds / 3600;
    const base = normalized * normalized * durationHours * 100;
    return Math.round(base * multiplier);
  }

  const heartRateAvg = activity.heartRateStream && activity.heartRateStream.length > 0 ? average(activity.heartRateStream) : activity.heartRateAvg;
  if (heartRateAvg && athlete.thresholdHeartRate) {
    const normalized = heartRateAvg / athlete.thresholdHeartRate;
    const durationHours = activity.durationSeconds / 3600;
    const base = normalized * normalized * durationHours * 100;
    return Math.round(base * multiplier);
  }

  const paceAvg = activity.paceStream && activity.paceStream.length > 0 ? average(activity.paceStream) : activity.paceAvgSecondsPerKm;
  if (paceAvg && athlete.thresholdPace) {
    const thresholdPaceSeconds = athlete.thresholdPace < 20 ? athlete.thresholdPace * 60 : athlete.thresholdPace;
    const paceFactor = thresholdPaceSeconds / paceAvg;
    const durationHours = activity.durationSeconds / 3600;
    const base = paceFactor * paceFactor * durationHours * 100;
    return Math.round(base * multiplier);
  }

  return Math.round((activity.durationSeconds / 60) * 0.5 * multiplier);
}

function dailyTss(activities: ActivityType[], athlete: AthleteConfig): Map<string, number> {
  const totals = new Map<string, number>();

  activities.forEach((activity) => {
    const day = new Date(activity.startDate).toISOString().slice(0, 10);
    totals.set(day, (totals.get(day) ?? 0) + calculateTss(activity, athlete));
  });

  return totals;
}

function exponentiallyWeightedLoad(
  dailyTotals: Map<string, number>,
  referenceTime: number,
  days: number,
): number {
  const alpha = 1 / days;
  let load = 0;

  for (let age = days - 1; age >= 0; age -= 1) {
    const date = new Date(referenceTime - age * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    load += alpha * ((dailyTotals.get(date) ?? 0) - load);
  }

  return load;
}

export function calculateTrainingMetrics(
  activities: ActivityType[],
  athlete: AthleteConfig,
  date: string,
): TrainingMetrics {
  const referenceTime = new Date(date).getTime();
  const referenceDay = new Date(date).toISOString().slice(0, 10);
  const dailyTotals = dailyTss(activities, athlete);
  const currentTss = activities
    .filter((activity) => new Date(activity.startDate).toISOString().slice(0, 10) === referenceDay)
    .reduce((sum, activity) => sum + (calculateTss(activity, athlete) || 0), 0);
  const fatigue = exponentiallyWeightedLoad(dailyTotals, referenceTime, 7);
  const load = exponentiallyWeightedLoad(dailyTotals, referenceTime, 42);
  const form = load - fatigue;
  const readiness = clamp(Math.round(50 + form), 0, 100);

  return {
    tss: Math.round(currentTss),
    fatigue: Math.round(fatigue),
    readiness,
    load: Math.round(load),
    date,
  };
}
