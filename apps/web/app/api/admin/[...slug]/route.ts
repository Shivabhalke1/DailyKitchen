import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

const BACKEND_BASE_URL =
  process.env.INTERNAL_BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'https://dailykitchen.onrender.com/api/v1';

const REFRESH_COOKIE_NAME = 'dk_refresh_token';

async function authenticateAdminSession(): Promise<
  | { success: true; accessToken: string; user: any }
  | { success: false; status: number; error: string }
> {
  const cookieStore = cookies();
  const refreshToken = cookieStore.get(REFRESH_COOKIE_NAME)?.value;

  if (!refreshToken) {
    return {
      success: false,
      status: 401,
      error: 'Authentication required. Please log in as an administrator.',
    };
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
      cookieStore.delete(REFRESH_COOKIE_NAME);
      return {
        success: false,
        status: 401,
        error: 'Session expired or invalidated. Please sign in again.',
      };
    }

    const payload = await res.json();
    const tokenData = payload.data || payload;

    if (!tokenData.user || tokenData.user.role !== 'admin' || !tokenData.user.is_active) {
      return {
        success: false,
        status: 403,
        error: 'Forbidden. Administrator privileges required.',
      };
    }

    return {
      success: true,
      accessToken: tokenData.access_token,
      user: tokenData.user,
    };
  } catch {
    return {
      success: false,
      status: 502,
      error: 'Failed to communicate with authentication authority.',
    };
  }
}

async function handleProxy(req: NextRequest, params: { slug: string[] }) {
  const auth = await authenticateAdminSession();
  if (!auth.success) {
    return NextResponse.json({ detail: auth.error }, { status: auth.status });
  }

  const slugPath = params.slug.join('/');
  const targetUrl = new URL(`${BACKEND_BASE_URL}/admin/${slugPath}`);
  targetUrl.search = req.nextUrl.search;

  const headers = new Headers();
  headers.set('Authorization', `Bearer ${auth.accessToken}`);
  headers.set('Accept', 'application/json');

  const contentType = req.headers.get('content-type');
  if (contentType) {
    headers.set('content-type', contentType);
  }

  let body: BodyInit | null = null;
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    try {
      body = await req.text();
    } catch {
      body = null;
    }
  }

  try {
    const backendRes = await fetch(targetUrl.toString(), {
      method: req.method,
      headers,
      body,
    });

    const responseContentType = backendRes.headers.get('content-type') || '';
    if (responseContentType.includes('application/json')) {
      const data = await backendRes.json();
      return NextResponse.json(data, { status: backendRes.status });
    }

    const text = await backendRes.text();
    return new NextResponse(text, {
      status: backendRes.status,
      headers: { 'content-type': responseContentType },
    });
  } catch (err: any) {
    return NextResponse.json(
      { detail: `Admin BFF Proxy Error: ${err?.message || 'Failed to connect to backend'}` },
      { status: 502 }
    );
  }
}

export async function GET(req: NextRequest, { params }: { params: { slug: string[] } }) {
  return handleProxy(req, params);
}

export async function POST(req: NextRequest, { params }: { params: { slug: string[] } }) {
  return handleProxy(req, params);
}

export async function PUT(req: NextRequest, { params }: { params: { slug: string[] } }) {
  return handleProxy(req, params);
}

export async function PATCH(req: NextRequest, { params }: { params: { slug: string[] } }) {
  return handleProxy(req, params);
}

export async function DELETE(req: NextRequest, { params }: { params: { slug: string[] } }) {
  return handleProxy(req, params);
}
