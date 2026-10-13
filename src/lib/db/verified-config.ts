import {
  stagingPoolConfig,
  type StagingDatabaseConfig,
} from "./staging-config";
import {
  isNeonOperationConfig,
  neonOperationPoolConfig,
  type NeonOperationConfig,
} from "./neon-operation-config";
export type VerifiedDatabaseConfig =
  StagingDatabaseConfig | NeonOperationConfig;
/** Both parsers retain separate private registration and environment contracts. */
export function verifiedPoolConfig(config: VerifiedDatabaseConfig) {
  return isNeonOperationConfig(config)
    ? neonOperationPoolConfig(config)
    : stagingPoolConfig(config as StagingDatabaseConfig);
}
