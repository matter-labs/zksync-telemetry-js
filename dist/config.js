"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfigManager = void 0;
// src/config.ts
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const uuid_1 = require("uuid");
const env_paths_1 = __importDefault(require("env-paths"));
const types_1 = require("./types");
const utils_1 = require("./utils");
class ConfigManager {
    static getDefaultConfigPath(configName) {
        return path_1.default.join(ConfigManager.getDefaultConfigDir(configName), 'telemetry.json');
    }
    static getDefaultConfigDir(configName) {
        // Override for darwin and win32 to match rust lib
        switch (process.platform) {
            case 'darwin':
                return path_1.default.join(process.env.HOME, 'Library', 'Application Support', `com.matter-labs.${configName}`);
            case 'win32':
                return path_1.default.join(process.env.APPDATA, 'matter-labs', configName, 'config');
            default:
                return (0, env_paths_1.default)(configName, { suffix: '' }).config;
        }
    }
    static load(configName, customPath) {
        const configPath = customPath || this.getDefaultConfigPath(configName);
        try {
            // Check if config exists
            fs_1.default.accessSync(configPath);
            const content = fs_1.default.readFileSync(configPath, 'utf-8');
            return JSON.parse(content);
        }
        catch (_a) {
            // Config doesn't exist, create new
            return this.createNew(configPath);
        }
    }
    static createNew(configPath) {
        // In non-interactive mode, disable telemetry
        if (!(0, utils_1.isInteractive)()) {
            return {
                enabled: false,
                instance_id: (0, uuid_1.v4)(),
                created_at: new Date(),
                config_path: configPath,
            };
        }
        // Prompt user for consent
        /* eslint-disable no-console */
        console.log('Help us improve zkSync by sending anonymous usage data.');
        console.log('We collect:');
        console.log('  - Basic usage statistics');
        console.log('  - Error reports');
        console.log('  - Platform information');
        console.log();
        console.log('We DO NOT collect:');
        console.log('  - Personal information');
        console.log('  - Sensitive configuration');
        console.log('  - Private keys or addresses');
        /* eslint-enable no-console */
        const enabled = (0, utils_1.promptYesNo)('Would you like to enable telemetry?');
        const config = {
            enabled,
            instance_id: (0, uuid_1.v4)(),
            created_at: new Date(),
            config_path: configPath,
        };
        // Save config
        try {
            fs_1.default.mkdirSync(path_1.default.dirname(configPath), { recursive: true });
            fs_1.default.writeFileSync(configPath, JSON.stringify(config, null, 2));
        }
        catch (error) {
            throw new types_1.TelemetryError(`Failed to save config: ${error}`, 'CONFIG_SAVE_ERROR');
        }
        return config;
    }
    static updateConsent(config, enabled) {
        if (!config.config_path) {
            throw new types_1.TelemetryError('No config path specified', 'CONFIG_PATH_ERROR');
        }
        config.enabled = enabled;
        fs_1.default.writeFileSync(config.config_path, JSON.stringify(config, null, 2));
    }
}
exports.ConfigManager = ConfigManager;
