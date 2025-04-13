import { Router, Request, Response } from 'express';
import { idp, sp } from '../config/saml';
import { findUserByEmail } from '../db/users';
import * as zlib from 'zlib';
import * as crypto from 'crypto';

const acsUrl = process.env.SP_ACS_URL || 'https://app.datasaur.ai/api/auth/multi-saml/redirect';

const router = Router();

// Helper function to decode SAML request
function decodeBase64Deflated(input: string): string {
  try {
    // Convert base64 to buffer
    const buffer = Buffer.from(input, 'base64');
    
    // Try to inflate (decompress) the buffer
    try {
      const inflated = zlib.inflateRawSync(buffer);
      return inflated.toString('utf8');
    } catch (e) {
      // If inflation fails, it might not be compressed
      return buffer.toString('utf8');
    }
  } catch (error) {
    console.error('Error decoding SAML request:', error);
    return '';
  }
}

// Extract SAML request details for response
function extractSamlRequestInfo(samlRequest: string): any {
  try {
    const decodedRequest = decodeBase64Deflated(samlRequest);
    
    // Extract request ID using regex - in production you should use proper XML parsing
    const idMatch = decodedRequest.match(/ID=['"]([^'"]+)['"]/);
    const requestId = idMatch ? idMatch[1] : `_${crypto.randomBytes(16).toString('hex')}`;
    
    return {
      extract: {
        request: {
          id: requestId,
          issueInstant: new Date().toISOString(),
          destination: acsUrl
        }
      }
    };
  } catch (error) {
    console.error('Error extracting SAML request info:', error);
    return {};
  }
}

// Create SAML response using samlify
async function createSamlResponse(user: any, acsUrl: string, requestInfo: any = {}) {
  try {
    // Generate session index
    const sessionIndex = `_${crypto.randomBytes(16).toString('hex')}`;
    
    // Create user object with attributes
    const userData = {
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role
    };
    
    // Create a basic request info if none provided
    const samlRequestInfo = {
      ...requestInfo,
      extract: {
        request: {
          id: `_${crypto.randomBytes(16).toString('hex')}`,
          issueInstant: new Date().toISOString(),
          destination: acsUrl
        }
      }
    };
    
    console.log('SAML Debug - IdP Certificate:', idp.entitySetting.signingCert ? 'Certificate loaded' : 'No certificate');
    console.log('SAML Debug - IdP Private Key:', idp.entitySetting.privateKey ? 'Private key loaded' : 'No private key');
    console.log('SAML Debug - SP Entity ID:', sp.entitySetting.entityID);
    console.log('SAML Debug - ACS URL:', acsUrl);
    
    // Use samlify's IdP to create login response
    const loginResponse = await idp.createLoginResponse(
      sp,
      samlRequestInfo,
      'post',
      userData
    );
    
    console.log('SAML Debug - Response generated successfully');
    
    return loginResponse;
  } catch (error) {
    console.error('Error creating SAML response:', error);
    throw error;
  }
}

// Metadata endpoint
router.get('/metadata', function(req: Request, res: Response) {
  res.header('Content-Type', 'text/xml').send(idp.getMetadata());
});

// SSO initiation endpoint with SAML request handling
router.get('/login', function(req: Request, res: Response) {
  // Check if there's a SAML request coming from LLM Labs
  const samlRequest = req.query.SAMLRequest as string;
  const relayState = req.query.RelayState as string;
  
  if (samlRequest) {
    try {
      // Extract request information
      const requestInfo = extractSamlRequestInfo(samlRequest);
      
      // Check if this is a direct auto-process request with debug=true query param
      if (req.query.auto === 'true') {
        // Auto-process with test user
        const testEmail = 'test@example.com';
        const user = findUserByEmail(testEmail);
        
        if (!user) {
          return res.status(401).send('Test user not found. Please check your user database.');
        }
        
        // Get the ACS URL from the SAML configuration
        const companyId = process.env.COMPANY_ID || 'your-company-id';
        
        try {
          // Generate SAML response
          createSamlResponse(user, acsUrl, requestInfo)
            .then(loginResponse => {
              // Format RelayState as required by Datasaur
              const companyIdStr = `{ "companyId": "${companyId}" }`;
              
              // Use the samlResponse.ejs template to create a form that auto-submits to the ACS URL
              return res.render('samlResponse', {
                AcsUrl: acsUrl,
                SAMLResponse: loginResponse.context,
                RelayState: relayState || companyIdStr
              });
            })
            .catch(error => {
              console.error('Error auto-processing SAML request:', error);
              return res.status(500).send('Error auto-processing SAML login');
            });
        } catch (error) {
          console.error('Error auto-processing SAML request:', error);
          return res.status(500).send('Error auto-processing SAML login');
        }
      } else {
        // Display login form with SAML request and RelayState
        res.render('login', { 
          samlRequest: samlRequest,
          relayState: relayState || ''
        });
      }
    } catch (error) {
      console.error('Error processing SAML request:', error);
      res.status(400).send('Invalid SAML request');
    }
  } else {
    // Regular login form without SAML request
    res.render('login', { samlRequest: '', relayState: '' });
  }
});

// Process login and send SAML response
router.post('/login', function(req: Request, res: Response) {
  const { email, samlRequest, relayState } = req.body;
  const user = findUserByEmail(email);
  
  if (!user) {
    return res.status(401).json({ error: 'User not found' });
  }

  // Get company ID from environment variables
  const companyId = process.env.COMPANY_ID || 'your-company-id';
  
  if (samlRequest) {
    // Extract request information if available
    const requestInfo = samlRequest ? extractSamlRequestInfo(samlRequest) : {};
    
    // Generate SAML response using samlify
    createSamlResponse(user, acsUrl, requestInfo)
      .then(loginResponse => {
        // Ensure RelayState is properly formatted as required by Datasaur
        const companyIdStr = `{ "companyId": "${companyId}" }`;
        
        // Log SAML response details for debugging
        console.log('SAML Debug - Full Response:', loginResponse.context ? 'Response exists (too large to log)' : 'No response');
        // Log the first 100 characters of the response to check format
        if (loginResponse.context) {
          console.log('SAML Debug - Response Sample:', loginResponse.context.substring(0, 100) + '...');
        }
        
        // Use the samlResponse.ejs template to create a form that auto-submits to the ACS URL
        res.render('samlResponse', {
          AcsUrl: acsUrl,
          SAMLResponse: loginResponse.context,
          RelayState: relayState || companyIdStr
        });
      })
      .catch(error => {
        console.error('Error generating SAML response:', error);
        res.status(500).send('Error processing SAML login');
      });
  } else {
    // Fall back to our token-based approach if we don't have a SAML request
    const llmLabsLoginUrl = process.env.LLM_LABS_LOGIN_URL || 'https://app.datasaur.ai/api/auth/multi-saml/redirect';
    
    // Creating a token with user details
    const userData = {
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      issuer: 'custom-idp',
      exp: Math.floor(Date.now() / 1000) + (60 * 60) // 1 hour expiration
    };
    
    // Base64 encode the token
    const token = Buffer.from(JSON.stringify(userData)).toString('base64');
    
    // Use the same RelayState format for token-based approach
    const companyIdStr = `{ "companyId": "${companyId}" }`;
    
    res.render('redirect', { 
      redirectUrl: `${llmLabsLoginUrl}?token=${token}`,
      relayState: companyIdStr
    });
  }
});

export default router; 