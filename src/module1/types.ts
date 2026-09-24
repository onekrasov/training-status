export type ActivityType =
  | 'cycling'
  | 'running'
  | 'swimming'
  | 'gym'
  | 'hiking'
  | 'yoga'
  | 'other';

export type TssSource = 'power' | 'heartRate' | 'pace' | 'estimated';

export interface PowerZones {
  thresholdWatts: number;
}

export interface HeartRateZones {
  thresholdBpm: number;
}

export interface PaceZones {
  thresholdMetersPerSecond: number;
}

export interface WorkoutZones {
  power?: PowerZones;
  heartRate?: HeartRateZones;
  pace?: PaceZones;
}

export interface Workout {
  id: string;
  name: string;
  type: ActivityType;
  startDate: string;
  durationSeconds: number;
  distanceMeters?: number;
  averagePowerWatts?: number;
  normalizedPowerWatts?: number;
  averageHeartRate?: number;
  averagePaceMetersPerSecond?: number;
  zones: WorkoutZones;
}

export interface WorkoutTssBreakdown {
  workoutId: string;
  name: string;
  type: ActivityType;
  source: TssSource;
  tss: number;
  startDate: string;
}

export interface ReadinessBreakdown {
  source: TssSource;
  workoutCount: number;
  tss: number;
}

export interface ReadinessReport {
  generatedAt: string;
  windowDays: number;
  workoutsConsidered: number;
  tss42DayTotal: number;
  acuteLoad7Day: number;
  chronicLoadDailyAverage: number;
  readinessScore: number;
  breakdown: ReadinessBreakdown[];
  workouts: WorkoutTssBreakdown[];
}

export interface WorkoutIndexEntry {
  id: string;
  key: string;
  type: ActivityType;
  startDate: string;
  downloadedAt: string;
}

export interface WorkoutIndex {
  updatedAt: string;
  workouts: WorkoutIndexEntry[];
}

export interface JsonStorage {
  getJson<T>(key: string): Promise<T | undefined>;
  putJson<T>(key: string, value: T): Promise<void>;
}

export interface SyncResult {
  downloaded: number;
  skipped: number;
  totalIndexed: number;
  readinessKey: string;
}
