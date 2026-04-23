const NAME_KEY = 'repartija.name';
const HOST_PREFIX = 'repartija.host.';
const PID_PREFIX = 'repartija.pid.';
const PAY_TARGET_KEY = 'repartija.pay.target.v3';

export function getSavedName(): string {
  try { return localStorage.getItem(NAME_KEY) ?? ''; } catch { return ''; }
}
export function saveName(name: string) {
  try { localStorage.setItem(NAME_KEY, name); } catch {}
}

export function getHostToken(code: string): string | null {
  try { return localStorage.getItem(HOST_PREFIX + code); } catch { return null; }
}
export function saveHostToken(code: string, token: string) {
  try { localStorage.setItem(HOST_PREFIX + code, token); } catch {}
}

export function getParticipantId(code: string): string | null {
  try { return localStorage.getItem(PID_PREFIX + code); } catch { return null; }
}
export function saveParticipantId(code: string, id: string) {
  try { localStorage.setItem(PID_PREFIX + code, id); } catch {}
}
export function getOrCreateParticipantId(code: string): string {
  const existing = getParticipantId(code);
  if (existing) return existing;
  const id = 'c_' + Math.random().toString(36).slice(2, 14) + Date.now().toString(36).slice(-4);
  saveParticipantId(code, id);
  return id;
}

export type SavedPayTarget = {
  identifier: string;
  label: string;
};

export function getSavedPayTarget(): SavedPayTarget | null {
  try {
    const raw = localStorage.getItem(PAY_TARGET_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedPayTarget;
    if (!parsed.identifier) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function savePayTarget(t: SavedPayTarget | null) {
  try {
    if (t && t.identifier) localStorage.setItem(PAY_TARGET_KEY, JSON.stringify(t));
    else localStorage.removeItem(PAY_TARGET_KEY);
  } catch {}
}
