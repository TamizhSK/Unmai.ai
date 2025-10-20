/**
 * Enhanced JWT Environment Setup for Unmai.ai
 * Handles secure environment variable management with JWT encoding and GCP integration
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logInfo(message) {
  log(`[INFO] ${message}`, 'blue');
}

function logSuccess(message) {
  log(`[SUCCESS] ${message}`, 'green');
}

function logWarning(message) {
  log(`[WARNING] ${message}`, 'yellow');
}

function logError(message) {
  log(`[ERROR] ${message}`, 'red');
}

// Enhanced JWT-like encoding for environment variables
function createJWTLikeToken(payload, secret) {
  const header = {
    alg: 'HS256',
    typ: 'JWT',
    app: 'unmai'
  };
  
  const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64url');
  
  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

function decodeJWTLikeToken(token, secret) {
  try {
    const [encodedHeader, encodedPayload, signature] = token.split('.');
    
    // Verify signature
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(`${encodedHeader}.${encodedPayload}`)
      .digest('base64url');
    
    if (signature !== expectedSignature) {
      throw new Error('Invalid signature');
    }
    
    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString());
    return payload;
  } catch (error) {
    throw new Error(`Failed to decode token: ${error.message}`);
  }
}

function generateSecret() {
  return crypto.randomBytes(32).toString('hex');
}

function validateEnvironmentVariables() {
  const required = ['GCP_PROJECT_ID', 'GEMINI_API_KEY'];
  const missing = [];
  
  for (const key of required) {
    if (!process.env[key]) {
      missing.push(key);
    }
  }
  
  if (missing.length > 0) {
    logError(`Missing required environment variables: ${missing.join(', ')}`);
    return false;
  }
  
  // Validate GEMINI_API_KEY format
  const apiKeyPattern = /^AIza[0-9A-Za-z_-]{35}$/;
  if (!apiKeyPattern.test(process.env.GEMINI_API_KEY)) {
    logWarning('GEMINI_API_KEY format may be invalid');
  }
  
  return true;
}

function loadEnvironmentFromFiles() {
  const envFiles = ['.env', 'backend/.env'];
  const envVars = {};
  
  envFiles.forEach(envFile => {
    const envPath = path.join(process.cwd(), envFile);
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf8');
      logInfo(`Loading environment from ${envFile}`);
      
      envContent.split('\n').forEach(line => {
        const trimmedLine = line.trim();
        if (trimmedLine && !trimmedLine.startsWith('#')) {
          const [key, ...valueParts] = trimmedLine.split('=');
          if (key && valueParts.length > 0) {
            const value = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
            envVars[key.trim()] = value;
          }
        }
      });
    }
  });
  
  return envVars;
}

function setupJWTEnvironment() {
  logInfo('Setting up enhanced JWT-based environment configuration...');
  
  // Load environment variables from files
  const envVars = loadEnvironmentFromFiles();
  
  // Add current environment variables (they take precedence)
  const sensitiveKeys = ['GEMINI_API_KEY', 'GOOGLE_CUSTOM_SEARCH_API_KEY', 'GOOGLE_SEARCH_ENGINE_ID'];
  sensitiveKeys.forEach(key => {
    if (process.env[key]) {
      envVars[key] = process.env[key];
    }
  });
  
  // Generate or load secret
  const secretPath = path.join(process.cwd(), '.env.secret');
  let secret;
  
  if (fs.existsSync(secretPath)) {
    secret = fs.readFileSync(secretPath, 'utf8').trim();
    logInfo('Loaded existing JWT secret');
  } else {
    secret = generateSecret();
    fs.writeFileSync(secretPath, secret, { mode: 0o600 });
    logSuccess('Generated new JWT secret');
  }
  
  // Create JWT tokens for sensitive data
  const jwtEnvPath = path.join(process.cwd(), '.env.jwt');
  const jwtEnvContent = [];
  
  // Non-sensitive variables
  const nonSensitive = ['GCP_PROJECT_ID', 'NODE_ENV', 'PORT', 'GCP_LOCATION'];
  nonSensitive.forEach(key => {
    const value = envVars[key] || process.env[key];
    if (value) {
      jwtEnvContent.push(`${key}=${value}`);
    }
  });
  
  // Sensitive variables as JWT tokens
  const sensitiveData = {};
  sensitiveKeys.forEach(key => {
    if (envVars[key]) {
      sensitiveData[key] = envVars[key];
    }
  });
  
  if (Object.keys(sensitiveData).length > 0) {
    const jwtToken = createJWTLikeToken({
      data: sensitiveData,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60), // 1 year
      iss: 'unmai-build-system',
      sub: 'environment-variables'
    }, secret);
    
    jwtEnvContent.push(`JWT_ENV_TOKEN=${jwtToken}`);
    logSuccess('Created JWT token for sensitive environment variables');
  }
  
  // Write JWT environment file
  fs.writeFileSync(jwtEnvPath, jwtEnvContent.join('\n') + '\n');
  logSuccess(`JWT environment file created: ${jwtEnvPath}`);
  
  // Create enhanced environment loader
  const loaderPath = path.join(process.cwd(), 'scripts', 'load-jwt-env.js');
  const loaderContent = `
/**
 * Enhanced JWT Environment Loader for Unmai.ai
 * Automatically loads and decodes JWT environment variables with fallbacks
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

function decodeJWTLikeToken(token, secret) {
  try {
    const [encodedHeader, encodedPayload, signature] = token.split('.');
    
    if (!encodedHeader || !encodedPayload || !signature) {
      throw new Error('Invalid JWT token format');
    }
    
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(\`\${encodedHeader}.\${encodedPayload}\`)
      .digest('base64url');
    
    if (signature !== expectedSignature) {
      throw new Error('Invalid JWT signature');
    }
    
    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString());
    
    // Check expiration
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      throw new Error('JWT token has expired');
    }
    
    return payload;
  } catch (error) {
    throw new Error(\`Failed to decode JWT token: \${error.message}\`);
  }
}

function loadJWTEnvironment() {
  try {
    const jwtEnvPath = path.join(process.cwd(), '.env.jwt');
    const secretPath = path.join(process.cwd(), '.env.secret');
    
    // Try JWT environment first
    if (fs.existsSync(jwtEnvPath) && fs.existsSync(secretPath)) {
      const secret = fs.readFileSync(secretPath, 'utf8').trim();
      const jwtEnvContent = fs.readFileSync(jwtEnvPath, 'utf8');
      
      // Load regular environment variables
      jwtEnvContent.split('\\n').forEach(line => {
        const [key, ...valueParts] = line.split('=');
        if (key && valueParts.length > 0 && key.trim() !== 'JWT_ENV_TOKEN') {
          const value = valueParts.join('=').trim();
          if (value && !process.env[key.trim()]) {
            process.env[key.trim()] = value;
          }
        }
      });
      
      // Decode JWT token
      const jwtTokenMatch = jwtEnvContent.match(/JWT_ENV_TOKEN=(.+)/);
      if (jwtTokenMatch) {
        const payload = decodeJWTLikeToken(jwtTokenMatch[1], secret);
        
        // Set sensitive environment variables
        if (payload.data) {
          Object.entries(payload.data).forEach(([key, value]) => {
            if (!process.env[key]) {
              process.env[key] = value;
            }
          });
        }
      }
      
      console.log('[INFO] JWT environment loaded successfully');
      return true;
    }
    
    // Fallback to regular .env files
    console.log('[INFO] JWT environment not found, using .env fallback');
    const envFiles = ['.env', 'backend/.env'];
    
    envFiles.forEach(envFile => {
      const envPath = path.join(process.cwd(), envFile);
      if (fs.existsSync(envPath)) {
        require('dotenv').config({ path: envPath });
      }
    });
    
    return false;
  } catch (error) {
    console.error(\`[ERROR] Failed to load JWT environment: \${error.message}\`);
    console.log('[INFO] Falling back to regular .env file');
    
    // Final fallback
    try {
      require('dotenv').config();
    } catch (dotenvError) {
      console.error('[ERROR] Failed to load any environment configuration');
    }
    
    return false;
  }
}

module.exports = { loadJWTEnvironment };

// Auto-load if this file is run directly
if (require.main === module) {
  loadJWTEnvironment();
}
`;
  
  fs.writeFileSync(loaderPath, loaderContent.trim());
  logSuccess(`Enhanced JWT environment loader created: ${loaderPath}`);
  
  // Update .gitignore
  const gitignorePath = path.join(process.cwd(), '.gitignore');
  let gitignoreContent = '';
  
  if (fs.existsSync(gitignorePath)) {
    gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');
  }
  
  const gitignoreEntries = [
    '.env.secret',
    '.env.jwt',
    '.env.local',
    '.env.production.local'
  ];
  
  let updated = false;
  gitignoreEntries.forEach(entry => {
    if (!gitignoreContent.includes(entry)) {
      gitignoreContent += `\n${entry}`;
      updated = true;
    }
  });
  
  if (updated) {
    fs.writeFileSync(gitignorePath, gitignoreContent);
    logSuccess('Updated .gitignore with JWT environment files');
  }
  
  logSuccess('Enhanced JWT environment setup completed!');
  logInfo('Usage:');
  logInfo('  • In Node.js: require("./scripts/load-jwt-env").loadJWTEnvironment()');
  logInfo('  • In package.json scripts: node -r ./scripts/load-jwt-env.js your-script.js');
}

function main() {
  log('🔐 Enhanced JWT Environment Setup for Unmai.ai', 'cyan');
  
  if (!validateEnvironmentVariables()) {
    process.exit(1);
  }
  
  setupJWTEnvironment();
  
  log('✅ Setup completed successfully!', 'green');
}

if (require.main === module) {
  main();
}

module.exports = {
  createJWTLikeToken,
  decodeJWTLikeToken,
  setupJWTEnvironment
};