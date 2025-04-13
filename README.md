# SAML Identity Provider

A custom Identity Provider (IdP) for SAML-based authentication.

## Certificate Generation

This application requires SSL certificates for SAML signing operations. Certificates are automatically generated when the server starts if they don't exist already.

### Automatic Certificate Generation

When you start the server with `npm start` or `npm run dev`, the application will:

1. Check if certificates exist in the `certs` directory
2. If missing, automatically generate new certificates using your environment configuration
3. Display information about the certificates before starting the server

No manual steps are required!

### Custom Certificate Configuration

To customize the generated certificates, copy `.env.example` to `.env` and modify the certificate settings:

```bash
cp .env.example .env
```

Certificate settings in `.env`:

```
# Certificate Generation Configuration
CERT_DAYS=365             # Certificate validity in days
CERT_COUNTRY=US           # 2-letter country code
CERT_STATE=California     # State or province
CERT_LOCALITY=San Francisco # City or locality
CERT_ORGANIZATION=YourCompany # Organization name
CERT_ORG_UNIT=Engineering # Organizational unit
CERT_COMMON_NAME=saml.example.com # Common Name (typically your domain)
CERT_EMAIL=admin@example.com # Contact email (optional)
CERT_OUTPUT_DIR=./certs   # Output directory for certificates
```

### Manual Certificate Generation

You can still manually generate certificates if needed:

```bash
npm run generate-certs
```

Or using OpenSSL directly:

```bash
# Create the certs directory
mkdir -p certs

# Generate a private key and self-signed certificate
openssl req -x509 -newkey rsa:2048 -keyout certs/key.pem -out certs/cert.pem -days 365 -nodes \
  -subj "/CN=saml.example.com/C=US/ST=California/L=San Francisco/O=YourCompany/OU=Engineering"
```

## Running the Application

Just run the application - everything else happens automatically:

```bash
# Install dependencies
npm install

# Start the development server
npm run dev
```

The SAML IdP will be available at http://localhost:3000/saml.

## Testing SAML Login

### Method 1: Manual Process

1. Start from your Service Provider (e.g., https://app.datasaur.ai/sign-in)
2. Choose the SAML option and enter the company ID
3. When redirected to this IdP, enter one of the test user emails:
   - darwin+idp1@datasaur.ai
   - darwin+idp2@datasaur.ai
   - darwin+idp3@datasaur.ai
   - darwin+idp4@datasaur.ai
   - darwin+idp5@datasaur.ai
4. You should be redirected back to the Service Provider with a proper SAML response

### Method 2: Auto-Processing (Recommended for Testing)

To avoid getting stuck in a redirect loop, you can use the auto-processing feature:

1. Start from your Service Provider (e.g., https://app.datasaur.ai/sign-in)
2. Choose the SAML option and enter the company ID
3. When redirected to this IdP, add `?auto=true` to the URL
   - For example: `http://localhost:3000/saml/login?SAMLRequest=...&RelayState=...&auto=true`
4. The test user (test@example.com) will be automatically authenticated and sent back to the Service Provider

## Environment Configuration

Make sure to configure your `.env` file correctly:

```
# SAML Configuration
SP_ENTITY_ID=datasaur
SP_ACS_URL=https://app.datasaur.ai/api/auth/multi-saml/redirect
COMPANY_ID=darwintestidp
```

## Troubleshooting

If you encounter the following error:
```
RelayState is empty, this usually happens when redirect URL is called from outside of Datasaur.
```

Ensure that:

1. You have set the correct COMPANY_ID in your .env file
2. The RelayState is correctly formatted as: `{ "companyId": "your-company-id" }`
3. Try using the auto-processing method with the `?auto=true` parameter

## Note on SAML Response

This IdP generates a properly formatted SAML response containing:
- User email, first name, last name, and role
- Required SAML attributes and assertions
- The RelayState with the company ID in the format expected by the Service Provider