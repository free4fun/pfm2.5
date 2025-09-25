// Re-export the main Docker management entry point so consumers can import
// from the package root instead of deep module paths.
export { DockerManager } from './DockerManager';
export type {
  NetworkCreateOptions,
  ContainerOptions,
  NetworkInfo,
  ContainerInfo,
  ExecOptions,
  LogsOptions,
  UpdateResources
} from './types';
