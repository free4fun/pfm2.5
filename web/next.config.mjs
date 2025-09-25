/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: [
    'dockerode',
    'docker-modem',
    'ssh2',
    'cpu-features'
  ],
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals.push({
        'cpu-features': 'commonjs cpu-features',
        'ssh2': 'commonjs ssh2'
      });
    }
    return config;
  }
};

export default nextConfig;
