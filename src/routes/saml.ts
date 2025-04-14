import { Router, Request, Response } from 'express';
import { idp } from '../services/saml/config';
import { findUserByEmail } from '../db/users';
import { createSamlResponse } from '../services/saml/createSamlResponse';
import { extractSamlRequestInfo } from '../services/saml/extractSamlRequestInfo';

const acsUrl = process.env.SP_ACS_URL || 'https://app.datasaur.ai/api/auth/multi-saml/redirect';

const router = Router();

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