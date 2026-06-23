import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST() {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get("drive_refresh_token")?.value;

  if (!refreshToken) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
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
      refresh_token: refreshToken,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: "refresh_token",
    }),
  });

  const tokens = await tokenResponse.json();

  if (!tokens.access_token) {
    console.error("Failed to refresh token:", tokens);
    return NextResponse.json({ error: "Token refresh failed" }, { status: 401 });
  }

  return NextResponse.json({ accessToken: tokens.access_token });
}
