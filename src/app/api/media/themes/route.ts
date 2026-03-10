import { NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { getSessionOptions } from "@/lib/session";
import { cookies } from "next/headers";
import { SessionData } from "@/types";
import { DEFAULT_THEMES } from "@/lib/constants";

export async function GET() {
    const cookieStore = await cookies();
    const session = await getIronSession<SessionData>(cookieStore, await getSessionOptions());
    if (!session.isLoggedIn) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        return NextResponse.json(DEFAULT_THEMES);
    } catch {
        return NextResponse.json({ error: "Failed to fetch themes" }, { status: 500 });
    }
}
