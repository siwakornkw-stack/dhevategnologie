const DRAWER_AGENT_URL = 'http://127.0.0.1:7654';

export async function kickDrawer(): Promise<boolean> {
  try {
    const r = await fetch(`${DRAWER_AGENT_URL}/kick`, { method: 'POST' });
    return r.ok;
  } catch {
    return false;
  }
}
