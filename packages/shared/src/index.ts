export type SportType = 'run' | 'ride' | 'swim' | 'gym' | 'hike' | 'yoga';

export type ActivityType = {
  id: string;
  sportType: SportType;
  startDate: string;
  durationSeconds: number;
  distanceMeters?: number;
  calories?: number;
  powerAvgWatts?: number;
  heartRateAvg?: number;
  paceAvgSecondsPerKm?: number;
  powerStream?: number[];
  heartRateStream?: number[];
  paceStream?: number[];
  tss?: number;
};

export type TrainingMetrics = {
  tss: number;
  fatigue: number;
  readiness: number;
  load: number;
  date: string;
};

export type AthleteConfig = {
  athleteName: string;
  ftp?: number;
  thresholdHeartRate?: number;
  thresholdPace?: number;
  zones?: {
    power?: number[];
    heartRate?: number[];
    pace?: number[];
  };
  sportMultipliers?: Record<SportType, number>;
};

export const defaultSportMultipliers: Record<SportType, number> = {
  run: 1,
  ride: 1,
  swim: 0.9,
  gym: 0.65,
  hike: 0.7,
  yoga: 0.5,
};
