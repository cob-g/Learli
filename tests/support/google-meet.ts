import { googleMeetConfig } from "@/features/google-meet/config";
import type {
  GoogleMeetProvider,
  GoogleGrant,
  MeetReceipt,
} from "@/features/google-meet/provider";

export function testMeetConfig() {
  const config = googleMeetConfig({
    GOOGLE_MEET_ENABLED: "true",
    APP_ENV: "development",
    AUTH_MODE: "local",
    DATABASE_MODE: "local",
    LOCAL_WORKFLOW_MODE: "enabled",
    APP_URL: "http://127.0.0.1:3100",
    DATABASE_URL:
      "postgresql://learli_app:synthetic@127.0.0.1:55432/learli_dev",
    BETTER_AUTH_SECRET: "synthetic-secret-".repeat(4),
    GOOGLE_MEET_CLIENT_ID: "synthetic.apps.googleusercontent.com",
    GOOGLE_MEET_CLIENT_SECRET: "synthetic-client-secret",
    GOOGLE_MEET_REDIRECT_URI:
      "http://127.0.0.1:3100/api/tutor/meeting-providers/google/callback",
    GOOGLE_MEET_KEY_ID: "test",
    GOOGLE_MEET_KEYS: JSON.stringify({ test: "a".repeat(64) }),
  });
  if (!config) throw new Error("Expected synthetic connector configuration.");
  return config;
}
export class FakeGoogle implements GoogleMeetProvider {
  calls = 0;
  refreshes = 0;
  revocations = 0;
  grant: GoogleGrant = {
    subject: "synthetic-google-subject",
    label: "host@learli.test",
    scopes: [
      "openid",
      "email",
      "https://www.googleapis.com/auth/meetings.space.created",
    ],
    refreshToken: "synthetic-only-refresh-value",
  };
  beforeCreate?: () => Promise<void>;
  beforeExchange?: () => Promise<void>;
  beforeRefresh?: () => Promise<void>;
  authorize(state: string, nonce: string, challenge: string) {
    return `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({ state, nonce, code_challenge: challenge })}`;
  }
  async exchange() {
    await this.beforeExchange?.();
    return this.grant;
  }
  async accessToken() {
    this.refreshes++;
    await this.beforeRefresh?.();
    return "synthetic-only-access-value";
  }
  async createSpace(): Promise<MeetReceipt> {
    this.calls++;
    await this.beforeCreate?.();
    const suffix = String.fromCharCode(97 + (this.calls % 26));
    return {
      name: `spaces/fixture_${this.calls}`,
      uri: `https://meet.google.com/aaa-bbbb-aa${suffix}`,
    };
  }
  async revoke() {
    this.revocations++;
  }
}
