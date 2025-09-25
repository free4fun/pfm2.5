import path from 'node:path';

export const ENV = {
  DOCKER_SOCKET: process.env.DOCKER_SOCKET ?? '/var/run/docker.sock',
  BESU_BASE_DIR:
    process.env.BESU_BASE_DIR ??
    path.resolve(process.cwd(), '../script/network'),
};
