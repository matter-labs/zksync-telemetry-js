// src/config.ts
import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { TelemetryConfig, TelemetryError } from './types';
import { isInteractive, promptYesNo } from './utils';

export class ConfigManager {
  private static getDefaultConfigPath(appName: string): string {
    const configDir = process.platform === 'darwin'
      ? path.join(process.env.HOME!, 'Library', 'Application Support', 'com.matter-labs', appName)
      : path.join(process.env.HOME!, '.config', appName);
    
    return path.join(configDir, 'telemetry.json');
  }

  static async load(
    appName: string, 
    customPath?: string
  ): Promise<TelemetryConfig> {
    const configPath = customPath || this.getDefaultConfigPath(appName);

    try {
      // Check if config exists
      await fs.access(configPath);
      const content = await fs.readFile(configPath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      // Config doesn't exist, create new
      return this.createNew(appName, configPath);
    }
  }

  private static async createNew(
    appName: string,
    configPath: string
  ): Promise<TelemetryConfig> {
    // In non-interactive mode, disable telemetry
    if (!isInteractive()) {
      return {
        enabled: false,
        instanceId: uuidv4(),
        createdAt: new Date(),
        configPath
      };
    }

    // Prompt user for consent
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

    const enabled = await promptYesNo('Would you like to enable telemetry?');

    const config: TelemetryConfig = {
      enabled,
      instanceId: uuidv4(),
      createdAt: new Date(),
      configPath
    };

    // Save config
    try {
      await fs.mkdir(path.dirname(configPath), { recursive: true });
      await fs.writeFile(configPath, JSON.stringify(config, null, 2));
    } catch (error) {
      throw new TelemetryError(
        `Failed to save config: ${error}`,
        'CONFIG_SAVE_ERROR'
      );
    }

    return config;
  }

  static async updateConsent(
    config: TelemetryConfig,
    enabled: boolean
  ): Promise<void> {
    if (!config.configPath) {
      throw new TelemetryError(
        'No config path specified',
        'CONFIG_PATH_ERROR'
      );
    }

    config.enabled = enabled;
    await fs.writeFile(
      config.configPath,
      JSON.stringify(config, null, 2)
    );
  }
}