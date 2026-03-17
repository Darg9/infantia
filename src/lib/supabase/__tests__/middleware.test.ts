import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockGetUser,
  mockCreateServerClient,
  mockCookiesGetAll,
  mockCookiesSet,
  mockResponseCookiesSet,
} = vi.hoisted(() => {
  const mockGetUser = vi.fn();
  const mockSupabaseClient = { auth: { getUser: mockGetUser } };
  const mockCreateServerClient = vi.fn(() => mockSupabaseClient);
  const mockCookiesGetAll = vi.fn(() => [{ name: 'sb-token', value: 'abc' }]);
  const mockCookiesSet = vi.fn();
  const mockResponseCookiesSet = vi.fn();
  return { mockGetUser, mockCreateServerClient, mockCookiesGetAll, mockCookiesSet, mockResponseCookiesSet };
});

vi.mock('@supabase/ssr', () => ({
  createServerClient: mockCreateServerClient,
}));

vi.mock('next/server', () => ({
  NextRequest: vi.fn(),
  NextResponse: {
    next: vi.fn(() => ({
      cookies: { set: mockResponseCookiesSet },
    })),
  },
}));

import { updateSession } from '../middleware';
import { NextResponse } from 'next/server';

describe('updateSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: null } });
  });

  it('crea supabase server client con cookie handlers', async () => {
    const mockRequest = {
      cookies: { getAll: mockCookiesGetAll, set: mockCookiesSet },
    } as any;

    await updateSession(mockRequest);

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
  });

  it('retorna user y supabaseResponse', async () => {
    const mockUser = { id: 'user-1', email: 'test@test.com' };
    mockGetUser.mockResolvedValue({ data: { user: mockUser } });

    const mockRequest = {
      cookies: { getAll: mockCookiesGetAll, set: mockCookiesSet },
    } as any;

    const result = await updateSession(mockRequest);
    expect(result.user).toEqual(mockUser);
    expect(result.supabaseResponse).toBeDefined();
  });

  it('retorna user null si no hay sesión', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const mockRequest = {
      cookies: { getAll: mockCookiesGetAll, set: mockCookiesSet },
    } as any;

    const result = await updateSession(mockRequest);
    expect(result.user).toBeNull();
  });

  it('cookies.getAll delega a request.cookies.getAll', async () => {
    const mockRequest = {
      cookies: { getAll: mockCookiesGetAll, set: mockCookiesSet },
    } as any;

    await updateSession(mockRequest);

    const cookiesConfig = mockCreateServerClient.mock.calls[0][2].cookies;
    cookiesConfig.getAll();
    expect(mockCookiesGetAll).toHaveBeenCalled();
  });

  it('cookies.setAll actualiza request y response cookies', async () => {
    const mockRequest = {
      cookies: { getAll: mockCookiesGetAll, set: mockCookiesSet },
    } as any;

    await updateSession(mockRequest);

    const cookiesConfig = mockCreateServerClient.mock.calls[0][2].cookies;
    cookiesConfig.setAll([
      { name: 'token', value: 'v1', options: { path: '/' } },
    ]);

    expect(mockCookiesSet).toHaveBeenCalledWith('token', 'v1');
    expect(NextResponse.next).toHaveBeenCalled();
    expect(mockResponseCookiesSet).toHaveBeenCalledWith('token', 'v1', { path: '/' });
  });
});
