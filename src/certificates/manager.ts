import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const certPath = path.resolve('./certs/cert.pem');
const keyPath = path.resolve('./certs/key.pem');

export interface Certificate {
  certificate: string;
  privateKey: string;
}

// Get certificate configuration from environment variables
export function getCertificateConfig() {
  return {
    country: process.env.CERT_COUNTRY || 'ID',
    state: process.env.CERT_STATE || 'Banten',
    locality: process.env.CERT_LOCALITY || 'Kabupaten Tangerang',
    organization: process.env.CERT_ORGANIZATION || 'YourCompany',
    organizationalUnit: process.env.CERT_ORG_UNIT || 'YourDepartment',
    commonName: process.env.CERT_COMMON_NAME || 'localhost',
    email: process.env.CERT_EMAIL || '',
    outputDir: process.env.CERT_OUTPUT_DIR || './certs'
  };
}

// Load certificates from the filesystem
export function loadCertificates(): Certificate {
  try {
    // Check if certificate files exist
    if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
      throw new Error('Certificate files not found.');
    }
    
    const certificate = fs.readFileSync(certPath, 'utf8');
    const privateKey = fs.readFileSync(keyPath, 'utf8');
    
    if (!certificate || !privateKey) {
      throw new Error('Empty certificate or private key. Certificates will be regenerated.');
    }
    
    return { certificate, privateKey };
  } catch (err) {
    throw new Error('Error loading certificates. The server will attempt to generate them.');
  }
}

// Generate new certificates
export function generateCertificates() {
  const config = getCertificateConfig();
  
  // Create certificate directory if it doesn't exist
  const certDir = path.resolve(config.outputDir);
  if (!fs.existsSync(certDir)) {
    console.log(`Creating certificate directory: ${certDir}`);
    fs.mkdirSync(certDir, { recursive: true });
  }
  
  // Construct the subject string for OpenSSL
  let subject = `/CN=${config.commonName}/C=${config.country}/ST=${config.state}/L=${config.locality}/O=${config.organization}/OU=${config.organizationalUnit}`;
  if (config.email) {
    subject += `/emailAddress=${config.email}`;
  }
  
  // File paths
  const keyPath = path.join(certDir, 'key.pem');
  const certPath = path.join(certDir, 'cert.pem');
  
  // Command to generate certificates
  const opensslCommand = `openssl req -x509 -new -newkey rsa:2048 -keyout "${keyPath}" -out "${certPath}" -days 7300 -nodes -subj "${subject}"`;
  
  console.log('Generating certificates with configuration:');
  console.log(config);
  console.log(`\nExecuting: ${opensslCommand}\n`);
  
  // Execute OpenSSL command
  execSync(opensslCommand, { stdio: 'inherit' });
}

function displayCertificateInfo() {
  const certInfo = execSync(`openssl x509 -in "${certPath}" -noout -subject -issuer -dates`, { encoding: 'utf8' });
  console.log('\nCertificate Information:');
  console.log(certInfo);
}

// Ensure certificates exist, generating them if needed
export function getCertificates(): Certificate {
  try {
    return loadCertificates();
  } catch (error) {
    console.log(error);
  }
  
  try {
    console.log('Generating certificates automatically...');
    generateCertificates();
    displayCertificateInfo();
  } catch (error) {
    throw new Error('Could not read certificate information.');
  }
  
  return loadCertificates();
}

// Normalize certificate by ensuring proper PEM format
function normalizeCertificate(cert: string): string {
  // Remove any whitespace
  cert = cert.trim();
  
  // Ensure it has proper begin/end markers
  if (!cert.startsWith('-----BEGIN CERTIFICATE-----')) {
    cert = '-----BEGIN CERTIFICATE-----\n' + cert;
  }
  
  if (!cert.endsWith('-----END CERTIFICATE-----')) {
    cert = cert + '\n-----END CERTIFICATE-----';
  }
  
  // Normalize line breaks
  cert = cert
    .replace(/-----BEGIN CERTIFICATE-----/, '-----BEGIN CERTIFICATE-----\n')
    .replace(/-----END CERTIFICATE-----/, '\n-----END CERTIFICATE-----');
    
  // Ensure proper line wrapping at 64 characters for the base64 content
  const beginMarker = '-----BEGIN CERTIFICATE-----\n';
  const endMarker = '\n-----END CERTIFICATE-----';
  
  let content = cert.substring(
    beginMarker.length,
    cert.length - endMarker.length
  );
  
  // Remove all existing line breaks
  content = content.replace(/\n/g, '');
  
  // Add line breaks every 64 characters
  let formattedContent = '';
  for (let i = 0; i < content.length; i += 64) {
    formattedContent += content.substring(i, i + 64) + '\n';
  }
  
  return beginMarker + formattedContent + endMarker;
}

// Format certificate for SAML metadata
export function formatCertificateForSaml(cert: string): string {
  // First ensure the certificate is properly formatted
  cert = normalizeCertificate(cert);
  
  // Then extract only the base64 content without headers and line breaks
  return cert
    .replace(/-----BEGIN CERTIFICATE-----\n/, '')
    .replace(/\n-----END CERTIFICATE-----/, '')
    .replace(/\n/g, '');
}

// Export helper functions and certificate interface
export default {
  getCertificates,
  formatCertificateForSaml,
}; 