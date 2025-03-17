export interface TelemetryConfig {
    enabled: boolean;
    instance_id: string;
    created_at: Date;
    config_path?: string;
}
export interface TelemetryKeys {
    posthogKey: string;
    sentryDsn: string;
}
export declare class TelemetryError extends Error {
    code: string;
    constructor(message: string, code: string);
}
