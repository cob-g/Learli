import type { AuthRuntime } from "@/lib/auth-factory";
import { disabledAdmission } from "./policy";
import type { AdmissionContext } from "./service";
/** Composition seam: shipped routes refuse policy-dependent intake. Root installs
 * an explicitly validated capability after its separate readiness composition. */
export function admissionContext(runtime: AuthRuntime): AdmissionContext {
  return { runtime, admission: disabledAdmission };
}
