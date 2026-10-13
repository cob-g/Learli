export const hostedTestOrigin = "https://accounts.learli.test";
export function hostedTestSource() {
  return {
    APP_ENV: "staging",
    AUTH_MODE: "hosted-synthetic",
    APP_URL: hostedTestOrigin,
    BETTER_AUTH_URL: hostedTestOrigin,
    BETTER_AUTH_SECRET: "synthetic-auth-secret-for-configuration-tests",
    HOSTED_INGRESS_SECRET: "different-synthetic-ingress-secret-for-tests",
    HOSTED_AUTH_CONFIG_FILE:
      "/fictional-checkout/.local/hosted-auth/config.json",
  };
}
export function hostedTestPacket(
  emails = [
    "hosted@example.test",
    "second@example.test",
    "new@example.test",
    "admin@example.test",
    "unknown@example.test",
    "failure@example.test",
  ],
) {
  return {
    version: 1,
    purpose: "hosted_synthetic",
    realIntake: "disabled",
    accountEmails: emails,
    STAGING_DATABASE_URL:
      "postgresql://learli_app:fictional-test-credential@ep-fictional-123.us-east-2.aws.neon.tech/learli_staging?sslmode=verify-full",
    target: {
      version: 1,
      provider: "neon",
      environment: "staging",
      projectId: "fictional-project-123",
      branchId: "br-fictional-123",
      endpointId: "ep-fictional-123",
      hostname: "ep-fictional-123.us-east-2.aws.neon.tech",
      database: "learli_staging",
      runtimeRole: "learli_app",
      migrationRole: "learli_migrator",
      approvedPurposes: ["runtime"],
      operatorApproval: {
        approvalId: "fictional-record-123",
        approvedBy: "fictional-operator",
        approvedAt: "2026-10-12T00:00:00Z",
        providerVerifiedAt: "2026-10-12T00:00:00Z",
        isolation: "dedicated-synthetic-staging",
      },
    },
    ingress: {
      mode: "trusted-proxy",
      trustedPeerAddresses: ["127.0.0.1"],
      clientIp: "shared-bucket",
      httpsHeader: "x-forwarded-proto",
    },
    mail: {
      mode: "resend-single-attempt",
      identitySecret: "fictional-message-identity-secret-for-tests",
      transport: {
        enabled: true,
        environment: "staging",
        appOrigin: hostedTestOrigin,
        apiKey: "re_synthetic_not_a_provider_key",
        sender: "sender@example.test",
        verifiedSender: {
          sender: "sender@example.test",
          environment: "staging",
          appOrigin: hostedTestOrigin,
        },
        allowedRecipients: emails,
        timeoutMs: 1000,
      },
    },
  };
}
