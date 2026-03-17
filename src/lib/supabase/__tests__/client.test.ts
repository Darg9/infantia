import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockClient, mockCreateBrowserClient } = vi.hoisted(() => {
  const mockClient = { auth: { getUser: vi.fn() } };
  const mockCreateBrowserClient = vi.fn(() => mockClient);
  return { mockClient, mockCreateBrowserClient };
});

vi.mock('@supabase/ssr', () => ({
  createBrowserClient: mockCreateBrowserClient,
}));

describe('createSupabaseBrowserClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('crea un cliente browser con las variables de entorno correctas', async () => {
    const { createSupabaseBrowserClient } = await import('../client');
    const client = createSupabaseBrowserClient();

    expect(mockCreateBrowserClient).toHaveBeenCalledWith(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    );
    expect(client).toBe(mockClient);
  });

  it('retorna singleton en la segunda llamada (no crea otro client)', async () => {
    const { createSupabaseBrowserClient } = await import('../client');
    const first = createSupabaseBrowserClient();
    const second = createSupabaseBrowserClient();

    expect(first).toBe(second);
    expect(mockCreateBrowserClient).toHaveBeenCalledTimes(1);
  });
});
