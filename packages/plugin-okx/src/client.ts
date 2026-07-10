import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface OnchainosClientOptions {
  /** Path to the onchainos binary. Defaults to "onchainos" on PATH. */
  binary?: string;
  timeoutMs?: number;
}

export class OnchainosError extends Error {
  constructor(
    message: string,
    public readonly args: string[],
    public readonly stderr?: string,
  ) {
    super(message);
    this.name = "OnchainosError";
  }
}

/**
 * Thin typed wrapper around the OKX Onchain OS CLI.
 * Every command returns `{ ok, data }` JSON; this client runs the command,
 * parses the envelope, and returns `data` — nothing more.
 */
export class OnchainosClient {
  private readonly binary: string;
  private readonly timeoutMs: number;

  constructor(options: OnchainosClientOptions = {}) {
    this.binary = options.binary ?? "onchainos";
    this.timeoutMs = options.timeoutMs ?? 30_000;
  }

  async run<T>(args: string[]): Promise<T> {
    let stdout: string;
    try {
      ({ stdout } = await execFileAsync(this.binary, args, {
        timeout: this.timeoutMs,
        maxBuffer: 16 * 1024 * 1024,
      }));
    } catch (error) {
      const stderr = (error as { stderr?: string }).stderr;
      throw new OnchainosError(`onchainos ${args[0]} failed`, args, stderr);
    }

    // The CLI may print status lines before the JSON envelope; take the JSON tail.
    const jsonStart = stdout.indexOf("{");
    if (jsonStart === -1) {
      throw new OnchainosError("no JSON in onchainos output", args);
    }

    const envelope = JSON.parse(stdout.slice(jsonStart)) as { ok: boolean; data?: T };
    if (!envelope.ok) {
      throw new OnchainosError("onchainos returned ok: false", args);
    }
    return envelope.data as T;
  }
}
