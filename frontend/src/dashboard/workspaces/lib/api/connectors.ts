import type { Connector, ConnectorId, ActivityEvent } from '../types';
import { connectorsFixture } from '../fixtures/connectors';
import { activityFixture } from '../fixtures/activity';
import { delay } from './client';

let connectors: Connector[] = connectorsFixture.map((c) => ({ ...c }));

// GET /api/connectors
export async function listConnectors(): Promise<Connector[]> {
  await delay();
  return connectors.map((c) => ({ ...c }));
}

// GET /api/connectors/:id
export async function getConnector(id: ConnectorId): Promise<Connector | undefined> {
  await delay();
  const c = connectors.find((x) => x.id === id);
  return c ? { ...c } : undefined;
}

// POST /api/connectors/:id/connect  → real backend returns { redirectUrl } (OAuth)
export async function connect(id: ConnectorId): Promise<Connector | undefined> {
  await delay();
  connectors = connectors.map((c) => (c.id === id ? { ...c, status: 'connected' } : c));
  return connectors.find((c) => c.id === id);
}

// POST /api/connectors/:id/disconnect
export async function disconnect(id: ConnectorId): Promise<Connector | undefined> {
  await delay();
  connectors = connectors.map((c) => (c.id === id ? { ...c, status: 'disconnected' } : c));
  return connectors.find((c) => c.id === id);
}

// GET /api/activity?connector=:id
export async function listActivity(id?: ConnectorId): Promise<ActivityEvent[]> {
  await delay();
  return id ? activityFixture.filter((a) => a.connectorId === id) : activityFixture;
}
