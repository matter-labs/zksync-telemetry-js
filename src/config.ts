// src/config.ts
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import envPaths from 'env-paths';
import { TelemetryConfig, TelemetryError } from './types';
import { isInteractive, promptYesNo } from './utils';

export class ConfigManager {
  private static getDefaultConfigPath(configName: string): string {
    return path.join(
      ConfigManager.getDefaultConfigDir(configName),
      'telemetry.json',
    );
  }

  private static getDefaultConfigDir(configName: string): string {
    // Override for darwin and win32 to match rust lib
    switch (process.platform) {
      case 'darwin':
        return path.join(
          process.env.HOME!,
          'Library',
          'Application Support',
          `com.matter-labs.${configName}`,
        );
      case 'win32':
        return path.join(
          process.env.APPDATA!,
          'matter-labs',
          configName,
          'config',
        );
      default:
        return envPaths(configName, { suffix: '' }).config;
    }
  }

  static load(configName: string, customPath?: string): TelemetryConfig {
    const configPath = customPath || this.getDefaultConfigPath(configName);

    try {
      // Check if config exists
      fs.accessSync(configPath);
      const content = fs.readFileSync(configPath, 'utf-8');
      return JSON.parse(content);
    } catch {
      // Config doesn't exist, create new
      return this.createNew(configPath);
    }
  }

  private static createNew(configPath: string): TelemetryConfig {
    // In non-interactive mode, disable telemetry
    if (!isInteractive()) {
      return {
        enabled: false,
        instance_id: uuidv4(),
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

    const enabled = promptYesNo('Would you like to enable telemetry?');

    const config: TelemetryConfig = {
      enabled,
      instance_id: uuidv4(),
      created_at: new Date(),
      config_path: configPath,
    };

    // Save config
    try {
      fs.mkdirSync(path.dirname(configPath), { recursive: true });
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    } catch (error) {
      throw new TelemetryError(
        `Failed to save config: ${error}`,
        'CONFIG_SAVE_ERROR',
      );
    }

    return config;
  }

  static updateConsent(config: TelemetryConfig, enabled: boolean): void {
    if (!config.config_path) {
      throw new TelemetryError('No config path specified', 'CONFIG_PATH_ERROR');
    }

    config.enabled = enabled;
    fs.writeFileSync(config.config_path, JSON.stringify(config, null, 2));
  }
}
