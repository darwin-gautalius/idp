import 'dotenv/config';
import { syncAllUsers } from '../src/services/scim/syncAllUsers';

async function main() {
  console.log('Starting user synchronization with LLM Labs...');
  
  if (!process.env.LLM_LABS_API_KEY) {
    console.error('Error: LLM_LABS_API_KEY is not set in the environment variables');
    process.exit(1);
  }
  
  if (!process.env.LLM_LABS_SCIM_BASE_URL) {
    console.error('Error: LLM_LABS_SCIM_BASE_URL is not set in the environment variables');
    process.exit(1);
  }
  
  try {
    const results = await syncAllUsers();
    
    console.log('\nSynchronization complete!');
    console.log(`✅ ${results.success} users synchronized successfully`);
    
    if (results.failed > 0) {
      console.log(`❌ ${results.failed} users failed to synchronize`);
      console.log('\nFailures:');
      results.failures.forEach(failure => console.log(` - ${failure}`));
    }
  } catch (error) {
    console.error('An error occurred during synchronization:', error);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Unhandled error:', err);
  process.exit(1);
}); 