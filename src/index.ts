import 'dotenv/config';
import express, { Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import session from 'express-session';
import samlRoutes from './services/saml/routes';
import scimRoutes from './services/scim/routes';
import { validateScimToken } from './services/scim/validateScimToken';

// Initialize Express app
const app = express();
const port = process.env.PORT || 3000;

// Trust proxy (needed for ngrok)
app.set('trust proxy', true);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false } // Set secure:true in production with HTTPS
}));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Routes
app.use('/saml', samlRoutes);
app.use('/scim/v2', validateScimToken, scimRoutes);

// Simple admin endpoint to trigger sync (without SCIM token for admin use)
app.post('/admin/sync-users', async function(req: Request, res: Response) {
  // For a production app, implement proper authentication here
  try {
    // Forward to the SCIM sync endpoint
    const syncResponse = await fetch(`http://localhost:${port}/scim/v2/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.SCIM_TOKEN}`
      }
    });
    
    const result = await syncResponse.json();
    res.json(result);
  } catch (error: any) {
    console.error('Error triggering sync:', error);
    res.status(500).json({
      success: false,
      message: `Error triggering sync: ${error.message || 'Unknown error'}`
    });
  }
});

// Home route
app.get('/', function(req: Request, res: Response) {
  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.headers['x-forwarded-host'] || req.get('host');
  const baseUrl = `${protocol}://${host}`;
  
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Identity Provider</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          max-width: 800px;
          margin: 0 auto;
          padding: 20px;
          line-height: 1.6;
        }
        h1 {
          color: #333;
          border-bottom: 1px solid #eee;
          padding-bottom: 10px;
        }
        .button {
          display: inline-block;
          background-color: #4CAF50;
          color: white;
          padding: 10px 20px;
          text-align: center;
          text-decoration: none;
          border-radius: 4px;
          border: none;
          cursor: pointer;
          font-size: 16px;
          margin-top: 20px;
        }
        .button:hover {
          background-color: #45a049;
        }
        .button:disabled {
          background-color: #cccccc;
          cursor: not-allowed;
        }
        #syncResult {
          margin-top: 20px;
          padding: 10px;
          border-left: 4px solid #4CAF50;
          background-color: #f9f9f9;
          display: none;
        }
        .error {
          border-left: 4px solid #f44336;
        }
      </style>
    </head>
    <body>
      <h1>Identity Provider is running</h1>
      <p>Important URLs:</p>
      <ul>
        <li>SAML Metadata URL: <a href="${baseUrl}/saml/metadata">${baseUrl}/saml/metadata</a></li>
        <li>SAML Login URL: <a href="${baseUrl}/saml/login">${baseUrl}/saml/login</a></li>
        <li>SCIM Base URL: ${baseUrl}/scim/v2</li>
      </ul>
      <p>Configure these URLs in your LLM Labs integration settings.</p>
      
      <h2>Admin Actions</h2>
      <button id="syncButton" class="button">Sync Users Now</button>
      <div id="syncResult"></div>
      
      <script>
        document.getElementById('syncButton').addEventListener('click', async function() {
          const button = this;
          const resultDiv = document.getElementById('syncResult');
          
          // Disable button while syncing
          button.disabled = true;
          button.textContent = 'Syncing Users...';
          resultDiv.style.display = 'none';
          
          try {
            // Call the admin sync endpoint
            const response = await fetch('${baseUrl}/admin/sync-users', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' }
            });
            
            const result = await response.json();
            
            // Display result
            resultDiv.innerHTML = '<h3>Sync Result</h3>';
            
            if (result.success) {
              resultDiv.classList.remove('error');
              resultDiv.innerHTML += '<p>' + result.message + '</p>';
              
              if (result.results.failures.length > 0) {
                resultDiv.innerHTML += '<p>Failed users:</p><ul>';
                result.results.failures.forEach(failure => {
                  resultDiv.innerHTML += '<li>' + failure + '</li>';
                });
                resultDiv.innerHTML += '</ul>';
              }
            } else {
              resultDiv.classList.add('error');
              resultDiv.innerHTML += '<p>Error: ' + result.message + '</p>';
            }
          } catch (error) {
            resultDiv.classList.add('error');
            resultDiv.innerHTML = '<h3>Sync Error</h3><p>' + error.message + '</p>';
          } finally {
            // Re-enable button and show results
            button.disabled = false;
            button.textContent = 'Sync Users Now';
            resultDiv.style.display = 'block';
          }
        });
      </script>
    </body>
    </html>
  `);
});

app.listen(port, function() {
  console.log(`⚡️ Identity Provider server running at http://localhost:${port}`);
  console.log(`🔑 SAML endpoint available at http://localhost:${port}/saml`);
  console.log(`👥 SCIM endpoint available at http://localhost:${port}/scim/v2`);
}); 