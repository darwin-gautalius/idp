# SAML Identity Provider

A custom Identity Provider (IdP) for SAML-based authentication.

## Pre-requisites

### Dependencies

- NodeJS v18.x (< 20)
   - NodeJS v20 and above has some changes around OpenSSL that breaks the signing processs.

### Environment Configuration

Make sure to configure your `.env` file correctly.

## Certificate Generation

This application requires SSL certificates for SAML signing operations. Certificates are automatically generated when the server starts if they don't exist already. The generated certificates will be saved in the `certs` directory.

If you need to manually generate certificates, you can use the following command:

```bash
npm run generate-cert
```

This will create:
- `certs/idp-private-key.pem` - Private key used for signing SAML assertions
- `certs/idp-public-cert.pem` - Public certificate that can be shared with Service Providers

For production environments, you may want to use your own certificates instead of the auto-generated ones.

## Tunneling

For testing with external Service Providers (SPs) that need to access your locally running IdP, you'll need to set up tunneling to expose your local server to the internet.

### Using ngrok

1. This project includes ngrok as a dependency, so you don't need to install it separately
2. Start the IdP server:
   ```bash
   npm run dev
   ```
3. In a separate terminal, start the tunneling using the provided npm script:
   ```bash
   npm run tunnel
   ```
4. Ngrok will provide a public URL (e.g., `https://abc123.ngrok.io`) that can be used by external SPs to reach your IdP
5. Update your SP configuration to use this URL for the IdP endpoints
6. You should also update your `.env` file with the new URL for:
   - `BASE_URL`
   - `IDP_LOGIN_URL`
   - `IDP_LOGOUT_URL`
   - `CERT_COMMON_NAME`

### Using other tunneling solutions

You can also use other tunneling solutions like:
- Cloudflare Tunnel
- LocalTunnel
- SSH tunneling

Remember to update your IdP configuration to match the public URL when using tunneling.

## Running the Application

Just run the application - everything else happens automatically:

```bash
# Install dependencies
npm install

# Start the development server
npm run dev
```

The SAML IdP will be available at http://localhost:3000/saml.
