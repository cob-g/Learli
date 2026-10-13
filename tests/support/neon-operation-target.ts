export function operationTarget(
  environment: "development" | "production" = "development",
) {
  return {
    version: 1,
    provider: "neon",
    environment,
    projectId: "fictional-project",
    branchId: environment === "production" ? "br-production" : "br-development",
    endpointId: "ep-fictional",
    hostname: "ep-fictional.ap-southeast-1.aws.neon.tech",
    database: "neondb",
    runtimeRole: "learli_app",
    migrationRole: "learli_migrator",
    bootstrapRole: "neondb_owner",
    approvedPurposes:
      environment === "production"
        ? ["inspect-runtime", "inspect", "migrate", "bootstrap"]
        : ["runtime", "inspect", "migrate", "bootstrap"],
    operatorApproval: {
      approvalId: "fictional-approval",
      approvedBy: "fictional-operator",
      approvedAt: "2026-10-13T00:00:00Z",
      providerVerifiedAt: "2026-10-13T00:00:00Z",
      isolation:
        environment === "production"
          ? "production-schema-operation"
          : "schema-only-development",
      sourceBranchId: "br-production",
    },
  };
}
