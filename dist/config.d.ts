import { TelemetryConfig } from './types';
export declare class ConfigManager {
    private static getDefaultConfigPath;
    private static getDefaultConfigDir;
    static load(configName: string, customPath?: string): TelemetryConfig;
    private static createNew;
    static updateConsent(config: TelemetryConfig, enabled: boolean): void;
}
