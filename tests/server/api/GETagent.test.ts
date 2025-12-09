import { describe, it, expect } from 'vitest';
import { GET } from '../../../src/routes/api/agents/[agentId]/+server';
import type { RequestEvent } from '@sveltejs/kit';
import { TEST_USER_MS_HEADERS, type TestRequestEvent } from './test-requests-data';
import { MS_AUTH_PRINCIPAL_CLAIMS_HEADER } from '$lib/server/auth/auth-constants';

// This only tests mock data, so not actually a useful test in itself, just an example
describe('server route GET api/agents/[agentId]/+server', () => {
  it('returns 400 when agentId is missing', async () => {
    const requestEvent: TestRequestEvent = {
      params: {},
      request: new Request('http://localhost/api/agents/{id}', {
        method: 'GET',
        headers: new Headers({ [MS_AUTH_PRINCIPAL_CLAIMS_HEADER]: TEST_USER_MS_HEADERS.employee }),
      })
    }
    const response = await GET(requestEvent as RequestEvent);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.message).toBe('agentId is required');
  })
  it('returns 404 when agent is not found', async () => {
    const requestEvent: TestRequestEvent = {
      params: { agentId: 'non-existing-agent' },
      request: new Request('http://localhost/api/agents/non-existing-agent', {
        method: 'GET',
        headers: new Headers({ [MS_AUTH_PRINCIPAL_CLAIMS_HEADER]: TEST_USER_MS_HEADERS.employee }),
      })
    }
    const response = await GET(requestEvent as RequestEvent);
    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.message).toBe('Agent non-existing-agent not found');
  })
  it('returns 403 when user is member of agent authorized group', async () => {
    const requestEvent: TestRequestEvent = {
      params: { agentId: 'test-agent-4' },
      request: new Request('http://localhost/api/agents/test-agent-4', {
        method: 'GET',
        headers: new Headers({ [MS_AUTH_PRINCIPAL_CLAIMS_HEADER]: TEST_USER_MS_HEADERS.employee }),
      })
    }
    const response = await GET(requestEvent as RequestEvent);
    expect(response.status).toBe(403);
  })
  it('returns 200 and agent when user is in authorized group', async () => {
    const requestEvent: TestRequestEvent = {
      params: { agentId: 'test-agent-3' },
      request: new Request('http://localhost/api/agents/test-agent-3', {
        method: 'GET',
        headers: new Headers({ [MS_AUTH_PRINCIPAL_CLAIMS_HEADER]: TEST_USER_MS_HEADERS.employee }),
      })
    }
    const response = await GET(requestEvent as RequestEvent);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.agent._id).toBe('test-agent-3');
  })
  it('returns 200 and agent when user has admin role', async () => {
    const requestEvent: TestRequestEvent = {
      params: { agentId: 'test-agent-3' },
      request: new Request('http://localhost/api/agents/test-agent-3', {
        method: 'GET',
        headers: new Headers({ [MS_AUTH_PRINCIPAL_CLAIMS_HEADER]: TEST_USER_MS_HEADERS.admin }),
      })
    }
    const response = await GET(requestEvent as RequestEvent);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.agent._id).toBe('test-agent-3');
  })
});