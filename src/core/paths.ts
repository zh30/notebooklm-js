import os from "os";
import path from "path";
import fs from "fs";

/**
 * Get NotebookLM home directory.
 * Precedence: NOTEBOOKLM_HOME env var > ~/.notebooklm
 */
export function getHomeDir(create = false): string {
  const home = process.env.NOTEBOOKLM_HOME || path.join(os.homedir(), ".notebooklm");

  if (create) {
    if (!fs.existsSync(home)) {
      fs.mkdirSync(home, { recursive: true, mode: 0o700 });
    } else {
      // Ensure correct permissions
      fs.chmodSync(home, 0o700);
    }
  }
  return home;
}

/**
 * Get storage_state.json path.
 */
export function getStoragePath(): string {
  return path.join(getHomeDir(), "storage_state.json");
}

/**
 * Get context.json path.
 */
export function getContextPath(): string {
  return path.join(getHomeDir(), "context.json");
}

/**
 * Get browser_profile directory.
 */
export function getBrowserProfileDir(): string {
  return path.join(getHomeDir(), "browser_profile");
}

/**
 * Get config.json path.
 */
export function getConfigPath(): string {
  return path.join(getHomeDir(), "config.json");
}

export function getPathInfo(): Record<string, string> {
  const homeFromEnv = process.env.NOTEBOOKLM_HOME;
  return {
    homeDir: getHomeDir(),
    homeSource: homeFromEnv ? "NOTEBOOKLM_HOME" : "default (~/.notebooklm)",
    storagePath: getStoragePath(),
    contextPath: getContextPath(),
    configPath: getConfigPath(),
    browserProfileDir: getBrowserProfileDir(),
  };
}
