import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import WidgetsPage from './page';

const authState = vi.hoisted(() => ({ orgId: 'org_a', hasToken: true }));

vi.mock('@clerk/nextjs', () => ({
  useAuth: () => ({
    isLoaded: true,
    userId: 'user_test',
    orgId: authState.orgId,
    getToken: async () =>
      authState.hasToken ? `test-session-token-${authState.orgId}` : null,
  }),
}));

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <WidgetsPage />
    </QueryClientProvider>,
  );
}

describe('widget workspace', () => {
  afterEach(() => {
    authState.orgId = 'org_a';
    authState.hasToken = true;
    vi.unstubAllGlobals();
  });

  it('creates widget through authenticated API and renders persisted list result', async () => {
    const stored: Array<{
      id: string;
      name: string;
      description: null;
      createdAt: string;
      updatedAt: string;
      _links: { self: { href: string }; collection: { href: string } };
    }> = [];
    const requests: Array<{
      url: string;
      token: string | null;
      method: string;
    }> = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init: RequestInit) => {
        requests.push({
          url,
          token: new Headers(init.headers).get('Authorization'),
          method: init.method ?? 'GET',
        });
        if (init.method === 'POST') {
          stored.push({
            id: 'widget-1',
            name: JSON.parse(init.body as string).name,
            description: null,
            createdAt: '2026-09-27T00:00:00.000Z',
            updatedAt: '2026-09-27T00:00:00.000Z',
            _links: {
              self: { href: '/v1/widgets/widget-1' },
              collection: { href: '/v1/widgets' },
            },
          });
          return Response.json(stored[0], { status: 201 });
        }
        return Response.json(stored);
      }),
    );

    renderPage();
    await screen.findByTestId('widget-list');
    await userEvent.type(
      screen.getByRole('textbox', { name: 'Widget name' }),
      '  Blue widget  ',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Create' }));

    expect(
      await within(screen.getByTestId('widget-list')).findByText('Blue widget'),
    ).toBeVisible();
    expect(requests).toContainEqual({
      url: expect.stringMatching(/\/v1\/widgets$/),
      token: 'Bearer test-session-token-org_a',
      method: 'POST',
    });
    expect(requests.filter((request) => request.method === 'GET')).toHaveLength(
      2,
    );
  });

  it('keeps failed widget submission visible for retry', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: RequestInit) =>
        init.method === 'POST'
          ? Response.json({ message: 'Unavailable' }, { status: 503 })
          : Response.json([]),
      ),
    );
    renderPage();
    await screen.findByTestId('widget-list');
    await userEvent.type(
      screen.getByRole('textbox', { name: 'Widget name' }),
      'Keep me',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Could not create widget',
      ),
    );
    expect(screen.getByRole('textbox', { name: 'Widget name' })).toHaveValue(
      'Keep me',
    );
  });

  it('does not request widgets without Clerk token', async () => {
    authState.hasToken = false;
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not load widgets',
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('does not show previous organization widgets after active organization changes', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: RequestInit) =>
        Response.json([
          {
            id: 'widget-1',
            name:
              new Headers(init.headers).get('Authorization') ===
              'Bearer test-session-token-org_a'
                ? 'Organization A widget'
                : 'Organization B widget',
            description: null,
            createdAt: '2026-09-27T00:00:00.000Z',
            updatedAt: '2026-09-27T00:00:00.000Z',
            _links: {
              self: { href: '/v1/widgets/widget-1' },
              collection: { href: '/v1/widgets' },
            },
          },
        ]),
      ),
    );
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: 30_000 } },
    });
    const view = render(
      <QueryClientProvider client={queryClient}>
        <WidgetsPage />
      </QueryClientProvider>,
    );
    expect(await screen.findByText('Organization A widget')).toBeVisible();

    authState.orgId = 'org_b';
    view.rerender(
      <QueryClientProvider client={queryClient}>
        <WidgetsPage />
      </QueryClientProvider>,
    );

    expect(await screen.findByText('Organization B widget')).toBeVisible();
    expect(screen.queryByText('Organization A widget')).not.toBeInTheDocument();
  });
});
