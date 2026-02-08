import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { ATTACHE_DIR, ensureAttacheDir } from "./utils.ts";

const USER_FILE = join(ATTACHE_DIR, "USER.md");

/**
 * Loads the user profile from ~/.attache/USER.md
 * Returns empty string if no profile exists yet
 */
export function loadUserProfile(): string {
  ensureAttacheDir();

  if (!existsSync(USER_FILE)) {
    return "";
  }

  try {
    return readFileSync(USER_FILE, "utf-8");
  } catch (error) {
    console.error("Error loading user profile:", error);
    return "";
  }
}

/**
 * Saves the user profile to ~/.attache/USER.md
 */
export function saveUserProfile(content: string): void {
  ensureAttacheDir();

  try {
    writeFileSync(USER_FILE, content, "utf-8");
    console.log(`User profile saved to: ${USER_FILE}`);
  } catch (error) {
    console.error("Error saving user profile:", error);
    throw error;
  }
}
