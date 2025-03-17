export declare class Telemetry {
    private config;
    private posthog?;
    private posthogKey?;
    private sentryInitialized;
    private sentryDsn?;
    private appName;
    private appVersion;
    private constructor();
    private reconnectPostHog;
    private reconnectSentry;
    static initialize(appName: string, appVersion: string, configName: string, posthogKey?: string, sentryDsn?: string, customConfigPath?: string): Telemetry;
    trackEvent(eventName: string, properties?: Record<string, any>): void;
    trackError(error: Error, context?: Record<string, any>): void;
    private static getDefaultEventProps;
    updateConsent(enabled: boolean): void;
    shutdown(): Promise<void>;
}
