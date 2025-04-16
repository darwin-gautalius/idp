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
  
  res.render('home', { baseUrl });
});

app.listen(port, function() {
  console.log(`⚡️ Identity Provider server running at http://localhost:${port}`);
  console.log(`🔑 SAML endpoint available at http://localhost:${port}/saml`);
  console.log(`👥 SCIM endpoint available at http://localhost:${port}/scim/v2`);
}); 