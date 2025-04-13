import * as samlify from 'samlify';
import * as validator from '@authenio/samlify-node-xmllint';
import certManager from '../certificates/manager';

samlify.setSchemaValidator(validator);

const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
const loginUrl = process.env.IDP_LOGIN_URL || `${baseUrl}/saml/login`;
const logoutUrl = process.env.IDP_LOGOUT_URL || `${baseUrl}/saml/logout`;
const acsUrl = process.env.SP_ACS_URL || 'https://app.datasaur.ai/api/auth/multi-saml/redirect';

// Function to initialize or reinitialize SAML entities
function createSamlEntities() {
  // Get fresh certificates after they've been generated
  const currentCerts = certManager.getCertificates();
  
  // Create IdP instance with metadata XML
  const idpMetadataXML = `<?xml version="1.0"?>
<EntityDescriptor xmlns="urn:oasis:names:tc:SAML:2.0:metadata" entityID="${process.env.IDP_ENTITY_ID || 'urn:test:idp'}">
  <IDPSSODescriptor protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
    <KeyDescriptor use="signing">
      <KeyInfo xmlns="http://www.w3.org/2000/09/xmldsig#">
        <X509Data>
          <X509Certificate>${certManager.formatCertificateForSaml(currentCerts.certificate)}</X509Certificate>
        </X509Data>
      </KeyInfo>
    </KeyDescriptor>
    <NameIDFormat>urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress</NameIDFormat>
    <SingleSignOnService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST" Location="${loginUrl}"/>
    <SingleLogoutService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST" Location="${logoutUrl}"/>
  </IDPSSODescriptor>
</EntityDescriptor>`;

  const idp = samlify.IdentityProvider({
    entityID: process.env.IDP_ENTITY_ID || 'urn:test:idp',
    signingCert: currentCerts.certificate,
    privateKey: currentCerts.privateKey,
    wantAuthnRequestsSigned: false,
    singleSignOnService: [{
      Binding: 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST',
      Location: loginUrl
    }],
    metadata: idpMetadataXML
  });

  // Create SP instance (to be configured with LLM Labs settings)
  const sp = samlify.ServiceProvider({
    entityID: process.env.SP_ENTITY_ID || 'urn:llm-labs:sp',
    assertionConsumerService: [{
      Binding: 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST',
      Location: acsUrl
    }],
    wantMessageSigned: false,
    wantAssertionsSigned: false,
    authnRequestsSigned: false
  });
  
  return { idp, sp, certs: currentCerts };
}

// Create initial entities (these will be created with empty certs if not available)
const { idp, sp, certs } = createSamlEntities();

export {
  idp,
  sp,
  certs,
}; 