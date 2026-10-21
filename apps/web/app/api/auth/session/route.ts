import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

const BACKEND_BASE_URL =
  process.env.INTERNAL_BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'https://dailykitchen.onrender.com/api/v1';

const REFRESH_COOKIE_NAME = 'dk_refresh_token';
const SEVEN_DAYS_SECONDS = 7 * 24 * 60 * 60;

export const dynamic = 'force-dynamic';

/**
 * GET /api/auth/session
 * Silent session check & token refresh using HttpOnly cookie.
 */
export async function GET() {
  const cookieStore = cookies();
  const refreshToken = cookieStore.get(REFRESH_COOKIE_NAME)?.value;

  if (!refreshToken) {
    return NextResponse.json({ authenticated: false }, { status: 200 });
  }

  try {
    const res = await fetch(`${BACKEND_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (!res.ok) {
      // Refresh token is revoked or expired - clear cookie
      const response = NextResponse.json({ authenticated: false }, { status: 200 });
      response.cookies.delete(REFRESH_COOKIE_NAME);
      return response;
    }

    const payload = await res.json();
    const tokenData = payload.data || payload;

    const response = NextResponse.json({
      authenticated: true,
      access_token: tokenData.access_token,
      user: tokenData.user,
    });

    // Rotate refresh token cookie
    if (tokenData.refresh_token) {
      response.cookies.set({
        name: REFRESH_COOKIE_NAME,
        value: tokenData.refresh_token,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/',
        maxAge: SEVEN_DAYS_SECONDS,
      });
    }

    return response;
  } catch (error) {
    return NextResponse.json({ authenticated: false }, { status: 200 });
  }
}

/**
 * POST /api/auth/session
 * Establish session after successful OTP or password verification.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { refresh_token, access_token, user } = body;

    if (!refresh_token || !access_token) {
      return NextResponse.json(
        { error: 'Missing token parameters' },
        { status: 400 }
      );
    }

    const response = NextResponse.json({
      success: true,
      access_token,
      user,
    });

    response.cookies.set({
      name: REFRESH_COOKIE_NAME,
      value: refresh_token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: SEVEN_DAYS_SECONDS,
    });

    return response;
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Failed to establish session' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/auth/session
 * Logout and clear session.
 */
export async function DELETE() {
  const cookieStore = cookies();
  const refreshToken = cookieStore.get(REFRESH_COOKIE_NAME)?.value;

  if (refreshToken) {
    try {
      await fetch(`${BACKEND_BASE_URL}/auth/logout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
    } catch {
      // Best-effort backend revocation
    }
  }

  const response = NextResponse.json({ success: true, logged_out: true });
  response.cookies.delete(REFRESH_COOKIE_NAME);
  return response;
}
