export interface TelemetryConfig {
  enabled: boolean;
  instance_id: string;
  created_at: Date;
  config_path?: string;
}

// Internal constants interface (not exported)
export interface TelemetryKeys {
  posthogKey: string;
  sentryDsn: string;
}

export class TelemetryError extends Error {
  constructor(
    message: string,
    public code: string,
  ) {
    super(message);
    this.name = 'TelemetryError';
  }
}
