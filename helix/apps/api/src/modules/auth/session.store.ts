import { Injectable } from '@nestjs/common';
import { AuthUser } from '@helix/types';

interface SessionEntry {
  user: AuthUser;
  lastActiveAt: Date;
}

@Injectable()
export class SessionStore {
  private readonly sessions = new Map<string, SessionEntry>();
  private readonly pendingStates = new Map<string, Date>();

  create(user: AuthUser): string {
    const sessionId = crypto.randomUUID();
    this.sessions.set(sessionId, { user, lastActiveAt: new Date() });
    return sessionId;
  }

  get(id: string): SessionEntry | undefined {
    return this.sessions.get(id);
  }

  delete(id: string): void {
    this.sessions.delete(id);
  }

  extend(id: string): void {
    const entry = this.sessions.get(id);
    if (entry) {
      entry.lastActiveAt = new Date();
    }
  }

  pruneExpired(ttlMs: number): void {
    const now = Date.now();
    for (const [id, entry] of this.sessions) {
      if (now - entry.lastActiveAt.getTime() > ttlMs) {
        this.sessions.delete(id);
      }
    }
  }

  createState(): string {
    const state = crypto.randomUUID();
    this.pendingStates.set(state, new Date());
    this.pruneStates();
    return state;
  }

  private pruneStates(): void {
    const cutoff = Date.now() - 5 * 60 * 1000;
    for (const [key, created] of this.pendingStates) {
      if (created.getTime() < cutoff) {
        this.pendingStates.delete(key);
      }
    }
  }

  validateAndConsumeState(state: string): boolean {
    const created = this.pendingStates.get(state);
    if (!created) return false;
    this.pendingStates.delete(state);
    return Date.now() - created.getTime() < 5 * 60 * 1000;
  }
}
