import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockCreateServerClient, mockCookieStore } = vi.hoisted(() => {
  const mockCookieStore = {
    getAll: vi.fn(() => [{ name: 'sb-token', value: 'abc' }]),
    set: vi.fn(),
  };
  const mockSupabaseClient = { auth: { getUser: vi.fn() } };
  const mockCreateServerClient = vi.fn(() => mockSupabaseClient);
  return { mockCreateServerClient, mockCookieStore, mockSupabaseClient };
});

vi.mock('@supabase/ssr', () => ({
  createServerClient: mockCreateServerClient,
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => mockCookieStore),
}));

import { createSupabaseServerClient } from '../server';

describe('createSupabaseServerClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCookieStore.getAll.mockReturnValue([{ name: 'sb-token', value: 'abc' }]);
    mockCookieStore.set.mockImplementation(() => {});
  });

  it('crea server client con las variables de entorno correctas', async () => {
    const client = await createSupabaseServerClient();

    expect(mockCreateServerClient).toHaveBeenCalledWith(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      expect.objectContaining({
        cookies: expect.objectContaining({
          getAll: expect.any(Function),
          setAll: expect.any(Function),
        }),
      }),
    );
    expect(client).toBeDefined();
  });

  it('cookies.getAll() delega al cookieStore', async () => {
    await createSupabaseServerClient();

    const cookiesConfig = (mockCreateServerClient.mock.calls as any)[0][2].cookies;
    const result = cookiesConfig.getAll();
    expect(result).toEqual([{ name: 'sb-token', value: 'abc' }]);
  });

  it('cookies.setAll() llama cookieStore.set para cada cookie', async () => {
    await createSupabaseServerClient();

    const cookiesConfig = (mockCreateServerClient.mock.calls as any)[0][2].cookies;
    const cookiesToSet = [
      { name: 'token', value: 'val1', options: { path: '/' } },
      { name: 'refresh', value: 'val2', options: { path: '/' } },
    ];
    cookiesConfig.setAll(cookiesToSet);
    expect(mockCookieStore.set).toHaveBeenCalledTimes(2);
    expect(mockCookieStore.set).toHaveBeenCalledWith('token', 'val1', { path: '/' });
  });

  it('cookies.setAll() no lanza error si cookieStore.set falla (Server Component)', async () => {
    mockCookieStore.set.mockImplementation(() => {
      throw new Error('Cannot set cookies in Server Component');
    });

    await createSupabaseServerClient();

    const cookiesConfig = (mockCreateServerClient.mock.calls as any)[0][2].cookies;
    expect(() => {
      cookiesConfig.setAll([{ name: 'x', value: 'y', options: {} }]);
    }).not.toThrow();
  });
});
