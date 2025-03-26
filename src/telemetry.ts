import * as Sentry from '@sentry/node';
import { TelemetryConfig, TelemetryError } from './types';
import { ConfigManager } from './config';
import { PostHog, PostHogOptions } from 'posthog-node';

const posthogOptions: PostHogOptions = {
  enableExceptionAutocapture: false,
  disableGeoip: false,
  flushAt: 1,
  flushInterval: 0,
};

export class Telemetry {
  private config: TelemetryConfig;
  private posthog?: PostHog;
  private posthogKey?: string;
  private sentryInitialized: boolean = false;
  private sentryDsn?: string;
  private appName: string;
  private appVersion: string;

  private constructor(
    config: TelemetryConfig,
    posthogClient?: PostHog,
    posthogKey?: string,
    sentryInitialized: boolean = false,
    sentryDsn?: string,
    appName: string = 'unknown',
    appVersion: string = 'unknown',
  ) {
    this.config = config;
    this.posthog = posthogClient;
    this.posthogKey = posthogKey;
    this.appName = appName;
    this.appVersion = appVersion;
    this.sentryInitialized = sentryInitialized;
    this.sentryDsn = sentryDsn;
  }

  private reconnectPostHog(): void {
    if (this.config.enabled && this.posthogKey && !this.posthog) {
      try {
        this.posthog = new PostHog(this.posthogKey, posthogOptions);
      } catch (error) {
        throw new TelemetryError(
          `Failed to reconnect to PostHog: ${error}`,
          'INITIALIZATION_ERROR',
        );
      }
    }
  }

  private reconnectSentry(): void {
    if (this.config.enabled && this.sentryDsn && !this.sentryInitialized) {
      try {
        Sentry.init({
          dsn: this.sentryDsn,
          release: process.env.npm_package_version,
          initialScope: {
            tags: Telemetry.getDefaultEventProps(this.appName, this.appVersion),
          },
        });
        this.sentryInitialized = true;
      } catch (error) {
        throw new TelemetryError(
          `Failed to reconnect to Sentry: ${error}`,
          'INITIALIZATION_ERROR',
        );
      }
    }
  }

  static initialize(
    appName: string,
    appVersion: string,
    configName: string,
    posthogKey?: string,
    sentryDsn?: string,
    customConfigPath?: string,
  ): Telemetry {
    const config = ConfigManager.load(configName, customConfigPath);
    let posthogClient: PostHog | undefined;
    let sentryInitialized = false;

    // Only initialize clients if telemetry is enabled
    if (config.enabled) {
      if (posthogKey) {
        try {
          posthogClient = new PostHog(posthogKey, posthogOptions);
        } catch (error) {
          throw new TelemetryError(
            `Failed to initialize PostHog: ${error}`,
            'INITIALIZATION_ERROR',
          );
        }
      }

      if (sentryDsn) {
        try {
          Sentry.init({
            dsn: sentryDsn,
            release: process.env.npm_package_version,
            initialScope: {
              tags: Telemetry.getDefaultEventProps(appName, appVersion),
            },
          });
          sentryInitialized = true;
        } catch (error) {
          throw new TelemetryError(
            `Failed to initialize Sentry: ${error}`,
            'INITIALIZATION_ERROR',
          );
        }
      }
    }

    return new Telemetry(
      config,
      posthogClient,
      posthogKey,
      sentryInitialized,
      sentryDsn,
      appName,
      appVersion,
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  trackEvent(eventName: string, properties: Record<string, any> = {}): void {
    if (!this.config.enabled) {
      return;
    }

    // Try to reconnect if PostHog is not available
    this.reconnectPostHog();
    if (!this.posthog) {
      return; // Still not available after reconnection attempt
    }

    try {
      const enrichedProperties = {
        ...properties,
        ...Telemetry.getDefaultEventProps(this.appName, this.appVersion),
      };

      this.posthog.capture({
        distinctId: this.config.instance_id,
        event: eventName,
        properties: {
          props: enrichedProperties,
        },
      });
    } catch (error) {
      throw new TelemetryError(
        `Failed to track event: ${error}`,
        'EVENT_TRACKING_ERROR',
      );
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  trackError(error: Error, context: Record<string, any> = {}): void {
    if (!this.config.enabled) {
      return;
    }

    if (this.sentryDsn) {
      // Try to reconnect if Sentry is not initialized
      this.reconnectSentry();
      if (!this.sentryInitialized) {
        return; // Still not initialized after reconnection attempt
      }

      Sentry.withScope((scope) => {
        scope.setExtras({
          ...context,
          ...Telemetry.getDefaultEventProps(this.appName, this.appVersion),
          instanceId: this.config.instance_id,
        });

        Sentry.captureException(error);
      });
    } else if (this.posthogKey) {
      // Try to reconnect if PostHog is not available
      this.reconnectPostHog();
      if (!this.posthog) {
        return; // Still not available after reconnection attempt
      }

      try {
        this.posthog.captureException(error, this.config.instance_id, {
          props: {
            ...Telemetry.getDefaultEventProps(this.appName, this.appVersion),
            ...context,
          },
        });
      } catch (error) {
        throw new TelemetryError(
          `Failed to track error: ${error}`,
          'EVENT_TRACKING_ERROR',
        );
      }
    }
  }

  private static getDefaultEventProps(appName: string, appVersion: string) {
    return {
      app: appName,
      app_version: appVersion,
      platform: process.platform,
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      zksync_telemetry_version: require('../package.json').version || 'unknown',
      node_version: process.version,
    };
  }

  updateConsent(enabled: boolean): void {
    ConfigManager.updateConsent(this.config, enabled);
    this.config.enabled = enabled;

    // If enabling telemetry, try to reconnect services
    if (enabled) {
      this.reconnectPostHog();
      this.reconnectSentry();
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
