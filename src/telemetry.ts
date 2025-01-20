import * as Sentry from '@sentry/node';
import { TelemetryConfig, TelemetryError } from './types';
import { ConfigManager } from './config';
import { PostHog } from 'posthog-node';
import { TELEMETRY_KEYS, POSTHOG_URL } from './constants';

export class Telemetry {
  private config: TelemetryConfig;
  private posthog?: PostHog;
  private sentryInitialized: boolean = false;
  private appName: string;

  private constructor(
    config: TelemetryConfig,
    posthogClient?: PostHog,
    appName: string = 'unknown'
  ) {
    this.config = config;
    this.posthog = posthogClient;
    this.appName = appName;
  }

  private async reconnectPostHog(): Promise<void> {
    if (this.config.enabled && !this.posthog) {
      try {
        this.posthog = new PostHog(
          TELEMETRY_KEYS.posthogKey,
          {
            host: POSTHOG_URL,
          }
        );
      } catch (error) {
        console.error('Failed to reconnect to PostHog:', error);
      }
    }
  }

  private async reconnectSentry(): Promise<void> {
    if (this.config.enabled && !this.sentryInitialized) {
      try {
        Sentry.init({
          dsn: TELEMETRY_KEYS.sentryDsn,
          release: process.env.npm_package_version,
          initialScope: {
            tags: {
              app: this.appName,
              version: process.env.npm_package_version || 'unknown',
              platform: process.platform
            }
          }
        });
        this.sentryInitialized = true;
      } catch (error) {
        console.error('Failed to reconnect to Sentry:', error);
      }
    }
  }

  static async initialize(
    appName: string,
    customConfigPath?: string
  ): Promise<Telemetry> {
    const config = await ConfigManager.load(appName, customConfigPath);

    // Only initialize clients if telemetry is enabled
    if (config.enabled) {
      let posthogClient: PostHog | undefined;
      let sentryInitialized = false;

      try {
        posthogClient = new PostHog(
          TELEMETRY_KEYS.posthogKey,
          {
            host: POSTHOG_URL,
          }
        );
      } catch (error) {
        console.error('Failed to initialize PostHog:', error);
      }

      try {
        Sentry.init({
          dsn: TELEMETRY_KEYS.sentryDsn,
          release: process.env.npm_package_version,
          initialScope: {
            tags: {
              app: appName,
              version: process.env.npm_package_version || 'unknown',
              platform: process.platform
            }
          }
        });
        sentryInitialized = true;
      } catch (error) {
        console.error('Failed to initialize Sentry:', error);
      }

      const telemetry = new Telemetry(
        config,
        posthogClient,
        appName
      );
      telemetry.sentryInitialized = sentryInitialized;
      return telemetry;
    }

    return new Telemetry(config, undefined, appName);
  }

  async trackEvent(
    eventName: string,
    properties: Record<string, any> = {}
  ): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    // Try to reconnect if PostHog is not available
    if (!this.posthog) {
      await this.reconnectPostHog();
      if (!this.posthog) {
        return; // Still not available after reconnection attempt
      }
    }

    try {
      const enrichedProperties = {
        ...properties,
        distinct_id: this.config.instanceId,
        platform: process.platform,
        version: process.env.npm_package_version || 'unknown',
        node_version: process.version
      };

      await this.posthog.capture({
        distinctId: this.config.instanceId,
        event: eventName,
        properties: enrichedProperties
      });
    } catch (error) {
      throw new TelemetryError(
        `Failed to track event: ${error}`,
        'EVENT_TRACKING_ERROR'
      );
    }
  }

  trackError(error: Error, context: Record<string, any> = {}): void {
    if (!this.config.enabled) {
      return;
    }

    // Try to reconnect if Sentry is not initialized
    if (!this.sentryInitialized) {
      this.reconnectSentry().catch(error => {
        console.error('Failed to reconnect to Sentry:', error);
      });
      if (!this.sentryInitialized) {
        return; // Still not initialized after reconnection attempt
      }
    }

    Sentry.withScope((scope) => {
      scope.setExtras({
        ...context,
        platform: process.platform,
        version: process.env.npm_package_version,
        instanceId: this.config.instanceId
      });

      Sentry.captureException(error);
    });
  }

  async updateConsent(enabled: boolean): Promise<void> {
    await ConfigManager.updateConsent(this.config, enabled);
    this.config.enabled = enabled;

    // If enabling telemetry, try to reconnect services
    if (enabled) {
      await Promise.all([
        this.reconnectPostHog(),
        this.reconnectSentry()
      ]);
    }
  }

  async shutdown(): Promise<void> {
    if (this.posthog) {
      await this.posthog.shutdown();
      this.posthog = undefined;
    }
    
    if (this.sentryInitialized) {
      await Sentry.close(2000);
      this.sentryInitialized = false;
    }
  }
}