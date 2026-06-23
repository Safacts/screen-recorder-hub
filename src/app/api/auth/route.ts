import { NextResponse } from "next/server";

export async function GET() {
  const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
  if (!CLIENT_ID) {
    return NextResponse.json({ error: "Google Drive not configured" }, { status: 500 });
  }

  const REDIRECT_URI = process.env.VERCEL_ENV === "production"
    ? "https://screen-recorder-hub.vercel.app/api/auth/callback"
    : "http://localhost:3000/api/auth/callback";

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    scope: "https://www.googleapis.com/auth/drive.file",
    access_type: "offline",
    prompt: "consent",
  });

  return NextResponse.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
  );
}
