import { getLocalWorkflow } from "@/features/local-workflow/runtime";
import { getPrivateWorkflow } from "@/features/private-workflow/runtime";
import type { AuthRuntime } from "@/lib/auth-factory";
import {
  disabledAdmission,
  localAdmissionPolicy,
  validateAdmissionCapability,
} from "./policy";
import type { AdmissionContext } from "./service";
/** Validated ordinary local identity and private readiness select separate policy receipts. */
export function admissionContext(runtime: AuthRuntime): AdmissionContext {
  return {
    runtime,
    admission: getLocalWorkflow(runtime)
      ? validateAdmissionCapability(localAdmissionPolicy)
      : (getPrivateWorkflow(runtime)?.admission ?? disabledAdmission),
  };
}
