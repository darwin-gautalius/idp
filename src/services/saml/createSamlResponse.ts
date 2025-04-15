import { idp, sp } from './config';
import * as crypto from 'crypto';
import { User } from "../../db/types";
import { BindingContext } from 'samlify/types/src/entity';
import { SamlLib, Constants } from 'samlify';

/**
 * Create SAML response using samlify and customTagReplacement
 */
export async function createSamlResponse(user: User, acsUrl: string, requestInfo: any = {}) {
  try {
    // Generate session index
    const sessionIndex = `_${crypto.randomBytes(16).toString('hex')}`;
    
    // Create user object with basic data
    const userData = {
      nameID: user.email,
      nameIDFormat: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
      sessionIndex: sessionIndex,
      email: user.email
    };

    const requestId = requestInfo?.extract?.request?.id || '';
    const id = requestId || `_${crypto.randomBytes(16).toString('hex')}`;
    
    // Create a basic request info if none provided
    const samlRequestInfo = {
      ...requestInfo,
      extract: {
        request: {
          id,
          issueInstant: new Date().toISOString(),
          destination: acsUrl
        }
      }
    };
    
    
    // Define the custom tag replacement function
    function customTagReplacer(template: string): BindingContext {
      console.log('SAML Debug - Custom tag replacement running');

      const nowTime = new Date();
      const now = nowTime.toISOString();

      const fiveMinutesLaterTime = new Date(nowTime.getTime());
      fiveMinutesLaterTime.setMinutes(fiveMinutesLaterTime.getMinutes() + 5);
      const fiveMinutesLater = fiveMinutesLaterTime.toISOString();

      const spEntityID = sp.entityMeta.getEntityID();
      const acl = sp.entityMeta.getAssertionConsumerService('post');

      const context = SamlLib.replaceTagsByValue(template, {
        ID: idp.entitySetting.generateID!(),
        AssertionID: idp.entitySetting.generateID!(),
        Destination: sp.entityMeta.getAssertionConsumerService('post'),
        Audience: spEntityID,
        EntityID: spEntityID,
        SubjectRecipient: acl,
        Issuer: idp.entityMeta.getEntityID(),
        IssueInstant: now,
        AssertionConsumerServiceURL: acl,
        StatusCode: Constants.StatusCode.Success,
        // can be customized
        ConditionsNotBefore: now,
        ConditionsNotOnOrAfter: fiveMinutesLater,
        SubjectConfirmationDataNotOnOrAfter: fiveMinutesLater,
        NameIDFormat: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
        NameID: user.email || '',
        InResponseTo: requestId,
        AuthnStatement: '',

        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role
      });
      
      return { context, id };
    }
    
    
    // Call createLoginResponse with all parameters including customTagReplacement
    const samlResponse = await idp.createLoginResponse(
      sp,
      samlRequestInfo,
      'post',
      userData,
      customTagReplacer
    );
    
    console.log('SAML Debug - SAML Response generated successfully');
    
    // Log part of response to verify attributes are included
    if (samlResponse.context) {
      const attributeSection = samlResponse.context.indexOf('<saml:AttributeStatement>');
      if (attributeSection > 0) {
        console.log('SAML Debug - AttributeStatement found at position', attributeSection);
        // Log a portion of the attribute section
        const excerpt = samlResponse.context.substring(
          attributeSection, 
          Math.min(attributeSection + 300, samlResponse.context.length)
        );
        console.log('SAML Debug - Attribute section excerpt:', excerpt);
      } else {
        console.warn('SAML Debug - No AttributeStatement found in response!');
      }
    }
    
    return samlResponse;
  } catch (error) {
    console.error('Error creating SAML response:', error);
    throw error;
  }
}
