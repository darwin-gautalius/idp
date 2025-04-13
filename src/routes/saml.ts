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
    
    // Extract more information from the request
    const issuerMatch = decodedRequest.match(/<saml:Issuer[^>]*>(.*?)<\/saml:Issuer>/);
    const issuer = issuerMatch ? issuerMatch[1] : null;
    
    return {
      extract: {
        request: {
          id: requestId,
          issueInstant: new Date().toISOString(),
          destination: acsUrl,
          issuer: issuer
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
    
    // Create user object with attributes specifically formatted for Passport SAML
    const userData = {
      // Set email as nameID - critical for Passport SAML
      nameID: user.email,
      nameIDFormat: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
      sessionIndex: sessionIndex,
      // Provide attributes in both standard formats to ensure compatibility
      attributes: {
        // Format 1: Simple attributes (key format that Passport SAML looks for)
        "email": user.email,
        "firstName": user.firstName,
        "lastName": user.lastName,
        "role": user.role,
        
        // Format 2: Standard SAML attribute format (as fallback)
        "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress": user.email,
        "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname": user.firstName,
        "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname": user.lastName
      }
    };
    
    // Create a basic request info if none provided
    const samlRequestInfo = {
      ...requestInfo,
      extract: {
        request: {
          id: requestInfo?.extract?.request?.id || `_${crypto.randomBytes(16).toString('hex')}`,
          issueInstant: new Date().toISOString(),
          destination: acsUrl
        }
      }
    };
    
    console.log('SAML Debug - Processing login with:', JSON.stringify({
      requestId: samlRequestInfo?.extract?.request?.id,
      destination: acsUrl,
      userEmail: user.email,
      attributes: userData.attributes
    }, null, 2));
    
    // Use samlify's IdP to create login response
    const loginResponse = await idp.createLoginResponse(
      sp,
      samlRequestInfo,
      'post',
      userData
    );
    
    // Log response sample for debugging
    const responseSample = loginResponse.context ? loginResponse.context.substring(0, 150) : 'No response';
    console.log('SAML Debug - Generated response sample:', responseSample);
    
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
      // Display login form with SAML request and RelayState
      res.render('login', { 
        samlRequest: samlRequest,
        relayState: relayState || ''
      });
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