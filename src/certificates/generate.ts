import { generateCertificates } from './manager';

// This script is run directly via npm script to generate certificates
console.log('Starting certificate generation...');

try {
  generateCertificates();
  console.log('Certificate generation completed successfully.');
  process.exit(0);
} catch (error) {
  console.error('Certificate generation failed:', error);
  process.exit(1);
} 