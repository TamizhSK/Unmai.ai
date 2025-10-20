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
      .update(`${encodedHeader}.${encodedPayload}`)
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
    throw new Error(`Failed to decode JWT token: ${error.message}`);
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
      jwtEnvContent.split('\n').forEach(line => {
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
    console.error(`[ERROR] Failed to load JWT environment: ${error.message}`);
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