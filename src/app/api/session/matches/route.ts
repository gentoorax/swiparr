import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { getSessionOptions } from "@/lib/session";
import { db, likes, sessionMembers, userProfiles } from "@/lib/db";
import { eq, and, desc, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { SessionData } from "@/types";
import { AuthService } from "@/lib/services/auth-service";
import { getMediaProvider } from "@/lib/providers/factory";
import { handleApiError } from "@/lib/api-utils";
import { MediaIdentityService } from "@/lib/services/media-identity-service";

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const session = await getIronSession<SessionData>(cookieStore, await getSessionOptions());
  if (!session.isLoggedIn) return new NextResponse("Unauthorized", { status: 401 });

  if (!session.sessionCode) return NextResponse.json([]);

  try {
    const auth = await AuthService.getEffectiveCredentials(session);
    const provider = getMediaProvider(auth.provider);

    const matches = await db.select().from(likes)
      .where(and(
        eq(likes.sessionCode, session.sessionCode as string),
        eq(likes.isMatch, true),
      ))
      .orderBy(desc(likes.createdAt));

    if (matches.length === 0) return NextResponse.json([]);

    const groups = new Map<string, { canonicalId: string; externalIds: Set<string> }>();
    for (const m of matches as any[]) {
      const canonicalId = m.canonicalId || MediaIdentityService.resolveCanonicalId({ Id: m.externalId }) || `external:${m.externalId}`;
      const existing = groups.get(canonicalId);
      if (existing) {
        existing.externalIds.add(m.externalId);
      } else {
        groups.set(canonicalId, { canonicalId, externalIds: new Set([m.externalId]) });
      }
    }

    const itemsResult = await Promise.all(
      Array.from(groups.values()).map(async (group) => {
        for (const externalId of group.externalIds) {
          try {
            const item = await provider.getItemDetails(externalId, auth, { includeUserState: true });
            return {
              item,
              canonicalId: group.canonicalId,
            };
          } catch {
            // Try next provider-specific ID in the same canonical group.
          }
        }
        return null;
      })
    );

    const items = itemsResult.filter((entry): entry is { item: any; canonicalId: string } => entry !== null);

    const [allLikesInSession, members] = await Promise.all([
        db.select().from(likes).where(eq(likes.sessionCode, session.sessionCode as string)),
        db.select({
            externalUserId: sessionMembers.externalUserId,
            externalUserName: sessionMembers.externalUserName,
            hasCustomProfilePicture: sql<boolean>`CASE WHEN ${userProfiles.userId} IS NOT NULL THEN 1 ELSE 0 END`,
            profileUpdatedAt: userProfiles.updatedAt,
        })
        .from(sessionMembers)
        .leftJoin(userProfiles, eq(sessionMembers.externalUserId, userProfiles.userId))
        .where(eq(sessionMembers.sessionCode, session.sessionCode as string))
    ]);

    const finalItems = items.map(({ item, canonicalId }) => {
        const itemLikes = allLikesInSession.filter((l: any) => {
          const likeCanonical = l.canonicalId || MediaIdentityService.resolveCanonicalId({ Id: l.externalId });
          return likeCanonical === canonicalId;
        });
        return {
            ...item,
            likedBy: itemLikes.map((lb: any) => {
                const member = members.find((m: any) => m.externalUserId === lb.externalUserId);
                return {
                    userId: lb.externalUserId,
                    userName: member?.externalUserName || "Unknown",
                    sessionCode: lb.sessionCode,
                    hasCustomProfilePicture: !!member?.hasCustomProfilePicture,
                    profileUpdatedAt: member?.profileUpdatedAt,
                };
            })
        };
    });

    return NextResponse.json(finalItems);

  } catch (error) {
    return handleApiError(error, "Failed to fetch matches");
  }
}
