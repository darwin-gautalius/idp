import * as samlify from 'samlify';
import * as validator from '@authenio/samlify-node-xmllint';
import certManager from '../../certificates/manager';
import { readFileSync } from 'fs';
import { join } from 'path';

// Configure samlify with validator
samlify.setSchemaValidator(validator);

const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
const loginUrl = process.env.IDP_LOGIN_URL || `${baseUrl}/saml/login`;
const logoutUrl = process.env.IDP_LOGOUT_URL || `${baseUrl}/saml/logout`;
const acsUrl = process.env.SP_ACS_URL || 'https://app.datasaur.ai/api/auth/saml/acs';

// Get the exact SP Entity ID - this is critical to match Datasaur's expectations
const spEntityId = process.env.SP_ENTITY_ID || 'datasaur';

// Create our explicit SAML response template with hardcoded attributes
// This will be directly used when we patch the samlify instance

const explicitSamlTemplate = readFileSync(join(__dirname, 'samlResponseTemplate.xml'), 'utf8');

// Function to initialize or reinitialize SAML entities
function createSamlEntities() {
  // Get fresh certificates
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

  // Configure IdP with explicit signature options
  const idp = samlify.IdentityProvider({
    entityID: process.env.IDP_ENTITY_ID || 'urn:test:idp',
    signingCert: currentCerts.certificate,
    privateKey: currentCerts.privateKey,
    wantAuthnRequestsSigned: false,
    singleSignOnService: [{
      Binding: 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST',
      Location: loginUrl
    }],
    metadata: idpMetadataXML,
    
    // Apply our explicit template by directly patching the idp entity settings
    // This bypasses any type issues and makes sure our template is used
    loginResponseTemplate: {
      context: explicitSamlTemplate,
      attributes: []
    }
  });


  // Force IDP to sign responses
  idp.entitySetting.wantMessageSigned = true;
  idp.entitySetting.isAssertionEncrypted = false;

  // Create SP instance with minimal config
  const sp = samlify.ServiceProvider({
    entityID: spEntityId,
    assertionConsumerService: [{
      Binding: 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST',
      Location: acsUrl
    }],
    wantMessageSigned: true,
    wantAssertionsSigned: true,
    authnRequestsSigned: false
  });
  
  return { idp, sp, certs: currentCerts };
}

// Create entities
const { idp, sp, certs } = createSamlEntities();

// Function to reload SAML config with fresh certificates
function reloadSamlConfig() {
  const newEntities = createSamlEntities();
  Object.assign(idp, newEntities.idp);
  Object.assign(sp, newEntities.sp);
  Object.assign(certs, newEntities.certs);
  console.log('SAML configuration reloaded with fresh certificates.');
}

export {
  idp,
  sp,
  certs,
  reloadSamlConfig
}; 