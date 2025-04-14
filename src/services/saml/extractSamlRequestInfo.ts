import * as crypto from 'crypto';
import { decodeBase64Deflated } from '../../utils/decodeBase64Deflated';

const acsUrl = process.env.SP_ACS_URL || 'https://app.datasaur.ai/api/auth/multi-saml/redirect';

// Extract SAML request details for response
export function extractSamlRequestInfo(samlRequest: string): any {
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
