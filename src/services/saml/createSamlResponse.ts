import { idp, sp } from './config';
import * as crypto from 'crypto';
import { User } from "../../db/types";

// Create SAML response using samlify
export async function createSamlResponse(user: User, acsUrl: string, requestInfo: any = {}) {
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
