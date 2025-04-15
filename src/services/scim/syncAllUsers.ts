import 'dotenv/config';
import { User } from "../../db/types";
import { getAllUsers } from '../../db/users';
import https from 'https';

// Configuration
const LLM_LABS_SCIM_BASE_URL = process.env.LLM_LABS_SCIM_BASE_URL || 'https://app.datasaur.ai/api/teams/:teamId/scim/v2';
const LLM_LABS_API_KEY = process.env.LLM_LABS_API_KEY || '';

// Create an HTTPS agent that accepts self-signed certificates
// Note: In production, it's better to properly set up certificates
const httpsAgent = new https.Agent({
  rejectUnauthorized: process.env.NODE_ENV === 'production'
});

// Convert our user model to SCIM format
function mapUserToScim(user: User) {
  return {
    schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
    userName: user.email,
    name: {
      givenName: user.firstName,
      familyName: user.lastName
    },
    emails: [{
      primary: true,
      value: user.email,
      type: 'work'
    }],
    active: true,
    // Map the user's role to the role in LLM Labs
    // This matches their expected structure
    groups: [{
      value: user.role,
      display: user.role
    }]
  };
}

// Create a user via SCIM
async function syncUser(user: User) {
  try {
    const scimUser = mapUserToScim(user);
    const headers = {
      'Authorization': `Bearer ${LLM_LABS_API_KEY}`,
      'Content-Type': 'application/json'
    };
    
    // Common fetch options with the HTTPS agent for self-signed certs
    const fetchOptions = {
      headers,
      agent: httpsAgent
    };
    
    // Try direct creation first since search is failing
    console.log(`Attempting to create user ${user.email}...`);
    try {
      const createResponse = await fetch(`${LLM_LABS_SCIM_BASE_URL}/Users`, {
        method: 'POST',
        ...fetchOptions,
        body: JSON.stringify(scimUser)
      });
      
      if (createResponse.ok) {
        const data = await createResponse.json();
        console.log(`Successfully created user ${user.email}`);
        return data;
      }
      
      // If creation fails with 409 (conflict), the user likely exists already
      if (createResponse.status === 409) {
        console.log(`User ${user.email} already exists, attempting to find and update...`);
        
        // Try to list all users instead of using search endpoint
        const listResponse = await fetch(`${LLM_LABS_SCIM_BASE_URL}/Users`, {
          method: 'GET',
          ...fetchOptions
        });
        
        if (!listResponse.ok) {
          throw new Error(`User listing failed with status: ${listResponse.status}`);
        }
        
        const users = await listResponse.json();
        const existingUser = users.Resources?.find((u: any) => 
          u.emails?.some((e: any) => e.value === user.email)
        );
        
        if (existingUser) {
          console.log(`Found existing user with ID ${existingUser.id}, updating...`);
          const updateResponse = await fetch(`${LLM_LABS_SCIM_BASE_URL}/Users/${existingUser.id}`, {
            method: 'PUT',
            ...fetchOptions,
            body: JSON.stringify(scimUser)
          });
          
          if (!updateResponse.ok) {
            throw new Error(`Update failed with status: ${updateResponse.status}`);
          }
          
          const data = await updateResponse.json();
          console.log(`Successfully updated user ${user.email}`);
          return data;
        } else {
          throw new Error("User appears to exist but couldn't be found in listing");
        }
      } else {
        throw new Error(`Creation failed with status: ${createResponse.status}`);
      }
    } catch (createError: any) {
      console.log(`Error during user creation/update: ${createError.message}`);
      throw createError;
    }
  } catch (error) {
    console.error(`Error syncing user ${user.email}:`, error);
    throw error;
  }
}

// Sync all users to LLM Labs
export async function syncAllUsers() {
  const users = getAllUsers();
  const results = {
    success: 0,
    failed: 0,
    failures: [] as string[]
  };
  
  console.log(`Starting sync of ${users.length} users...`);
  
  for (const user of users) {
    try {
      await syncUser(user);
      results.success++;
    } catch (error: any) {
      results.failed++;
      results.failures.push(`${user.email}: ${error.message || 'Unknown error'}`);
    }
  }
  
  console.log(`Sync complete: ${results.success} successful, ${results.failed} failed`);
  return results;
}
