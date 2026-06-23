import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const error = req.nextUrl.searchParams.get("error");

  if (error || !code) {
    return NextResponse.redirect(
      new URL(`/recorder?drive=error&details=${encodeURIComponent(error || "No code returned")}`, req.url)
    );
  }

  const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
  const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
  if (!CLIENT_ID || !CLIENT_SECRET) {
    return NextResponse.redirect(new URL("/recorder?drive=error&details=Missing+env+vars", req.url));
  }

  const REDIRECT_URI = "https://screen-recorder-hub.vercel.app/api/auth/callback";

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
    console.error("Google token error:", tokens);
    const details = tokens.error
      ? `${tokens.error}: ${tokens.error_description || ""}`
      : "No refresh_token in response";
    return NextResponse.redirect(
      new URL(`/recorder?drive=error&details=${encodeURIComponent(details)}`, req.url)
    );
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
