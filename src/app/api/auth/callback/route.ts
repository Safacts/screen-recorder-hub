import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const REDIRECT_URI = process.env.VERCEL_ENV === "production"
  ? "https://screen-recorder-hub.vercel.app/api/auth/callback"
  : "http://localhost:3000/api/auth/callback";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  if (!code) {
    return NextResponse.redirect(new URL("/recorder?drive=error", req.url));
  }

  const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
  const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
  if (!CLIENT_ID || !CLIENT_SECRET) {
    return NextResponse.json({ error: "Google Drive not configured" }, { status: 500 });
  }

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
      grant_type: "authorization_code",
    }),
  });

  const tokens = await tokenResponse.json();

  if (!tokens.refresh_token) {
    console.error("No refresh_token in response:", tokens);
    return NextResponse.redirect(new URL("/recorder?drive=error", req.url));
  }

  const cookieStore = await cookies();
  cookieStore.set("drive_refresh_token", tokens.refresh_token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  return NextResponse.redirect(new URL("/recorder?drive=ready", req.url));
}
