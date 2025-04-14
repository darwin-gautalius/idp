declare global {
  namespace NodeJS {
    interface ProcessEnv {
      PORT?: string;
      IDP_ENTITY_ID?: string;
      IDP_LOGIN_URL?: string;
      IDP_LOGOUT_URL?: string;
      SP_ENTITY_ID?: string;
      SP_ACS_URL?: string;
      SCIM_TOKEN: string;
    }
  }
}

export {}; 