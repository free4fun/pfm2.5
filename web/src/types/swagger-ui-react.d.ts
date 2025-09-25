// Minimal ambient declaration for swagger-ui-react
declare module 'swagger-ui-react' {
  import * as React from 'react';
  const SwaggerUI: React.ComponentType<{
    url?: string;
    spec?: any;
    docExpansion?: 'list' | 'full' | 'none';
    defaultModelsExpandDepth?: number;
    defaultModelExpandDepth?: number;
  }>;
  export default SwaggerUI;
}
