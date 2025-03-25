"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.Telemetry = void 0;
const Sentry = __importStar(require("@sentry/node"));
const types_1 = require("./types");
const config_1 = require("./config");
const posthog_node_1 = require("posthog-node");
const posthogOptions = {
    enableExceptionAutocapture: false,
    disableGeoip: false,
    flushAt: 1,
    flushInterval: 0,
};
class Telemetry {
    constructor(config, posthogClient, posthogKey, sentryInitialized = false, sentryDsn, appName = 'unknown', appVersion = 'unknown') {
        this.sentryInitialized = false;
        this.config = config;
        this.posthog = posthogClient;
        this.posthogKey = posthogKey;
        this.appName = appName;
        this.appVersion = appVersion;
        this.sentryInitialized = sentryInitialized;
        this.sentryDsn = sentryDsn;
    }
    reconnectPostHog() {
        if (this.config.enabled && this.posthogKey && !this.posthog) {
            try {
                this.posthog = new posthog_node_1.PostHog(this.posthogKey, posthogOptions);
            }
            catch (error) {
                throw new types_1.TelemetryError(`Failed to reconnect to PostHog: ${error}`, 'INITIALIZATION_ERROR');
            }
        }
    }
    reconnectSentry() {
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
            }
            catch (error) {
                throw new types_1.TelemetryError(`Failed to reconnect to Sentry: ${error}`, 'INITIALIZATION_ERROR');
            }
        }
    }
    static initialize(appName, appVersion, configName, posthogKey, sentryDsn, customConfigPath) {
        const config = config_1.ConfigManager.load(configName, customConfigPath);
        let posthogClient;
        let sentryInitialized = false;
        // Only initialize clients if telemetry is enabled
        if (config.enabled) {
            if (posthogKey) {
                try {
                    posthogClient = new posthog_node_1.PostHog(posthogKey, posthogOptions);
                }
                catch (error) {
                    throw new types_1.TelemetryError(`Failed to initialize PostHog: ${error}`, 'INITIALIZATION_ERROR');
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
                }
                catch (error) {
                    throw new types_1.TelemetryError(`Failed to initialize Sentry: ${error}`, 'INITIALIZATION_ERROR');
                }
            }
        }
        return new Telemetry(config, posthogClient, posthogKey, sentryInitialized, sentryDsn, appName, appVersion);
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    trackEvent(eventName, properties = {}) {
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
        }
        catch (error) {
            throw new types_1.TelemetryError(`Failed to track event: ${error}`, 'EVENT_TRACKING_ERROR');
        }
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    trackError(error, context = {}) {
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
        }
        else if (this.posthogKey) {
            // Try to reconnect if PostHog is not available
            this.reconnectPostHog();
            if (!this.posthog) {
                return; // Still not available after reconnection attempt
            }
            try {
                this.posthog.captureException(error, this.config.instance_id, {
                    props: {
                        ...Telemetry.getDefaultEventProps(this.appName, this.appVersion),
                        ...context
                    }
                });
            }
            catch (error) {
                throw new types_1.TelemetryError(`Failed to track error: ${error}`, 'EVENT_TRACKING_ERROR');
            }
        }
    }
    static getDefaultEventProps(appName, appVersion) {
        return {
            app: appName,
            app_version: appVersion,
            platform: process.platform,
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            zksync_telemetry_version: require('../package.json').version || 'unknown',
            node_version: process.version,
        };
    }
    updateConsent(enabled) {
        config_1.ConfigManager.updateConsent(this.config, enabled);
        this.config.enabled = enabled;
        // If enabling telemetry, try to reconnect services
        if (enabled) {
            this.reconnectPostHog();
            this.reconnectSentry();
        }
    }
    async shutdown() {
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
exports.Telemetry = Telemetry;
