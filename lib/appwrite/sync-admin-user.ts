import { randomBytes } from "node:crypto";
import { Client, ID, Query, Users } from "node-appwrite";
import type { AppwriteMetadata } from "./metadata";

const ADMIN_LABEL = "admin";

function buildUsersService(meta: AppwriteMetadata): Users {
  const client = new Client()
    .setEndpoint(meta.appwriteEndpoint)
    .setProject(meta.appwriteProjectId)
    .setKey(meta.appwriteApiKey);
  return new Users(client);
}

function randomPassword(): string {
  return randomBytes(32).toString("base64url");
}

export type SyncAdminUserResult = {
  userId: string;
  created: boolean;
  labels: string[];
};

/**
 * Ensures an Appwrite user exists for the installer email and carries the admin label.
 */
export async function ensureAppwriteAdminUser(
  meta: AppwriteMetadata,
  email: string,
  displayName: string,
  adminLabel: string = ADMIN_LABEL,
): Promise<SyncAdminUserResult> {
  const users = buildUsersService(meta);
  const normalizedEmail = email.trim().toLowerCase();

  const existing = await users.list([Query.equal("email", normalizedEmail)]);

  const first = existing.users[0];

  if (first?.$id) {
    const labelArray = Array.from(
      new Set([...(first.labels ?? []), adminLabel]),
    );
    await users.updateLabels(first.$id, labelArray);
    return {
      userId: first.$id,
      created: false,
      labels: labelArray,
    };
  }

  const userId = ID.unique();
  const password = randomPassword();
  const name =
    displayName.trim() || normalizedEmail.split("@")[0] || "Vercel user";

  await users.create(userId, normalizedEmail, undefined, password, name);

  await users.updateLabels(userId, [adminLabel]);

  return {
    userId,
    created: true,
    labels: [adminLabel],
  };
}

export function formatAppwriteError(err: unknown): string {
  if (err && typeof err === "object" && "message" in err) {
    return String((err as { message: string }).message);
  }
  return "Appwrite request failed";
}
