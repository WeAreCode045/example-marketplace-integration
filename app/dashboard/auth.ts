import { type OidcClaims, verifyToken } from "@/lib/vercel/auth";
import { cookies } from "next/headers";

const ID_TOKEN_COOKIE = "id-token";

export async function getSessionOrNull(): Promise<OidcClaims | null> {
  const idToken = (await cookies()).get(ID_TOKEN_COOKIE);
  if (!idToken?.value) {
    return null;
  }
  try {
    return await verifyToken(idToken.value);
  } catch {
    return null;
  }
}

export async function getSession(): Promise<OidcClaims> {
  const session = await getSessionOrNull();
  if (!session) {
    throw new Error("ID Token not set");
  }
  return session;
}

export async function createSession(token: string) {
  const store = await cookies();
  store.set(ID_TOKEN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
}
