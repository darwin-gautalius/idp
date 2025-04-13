import * as dotenv from 'dotenv';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import session from 'express-session';
import samlRoutes from './routes/saml';
import scimRoutes from './routes/scim';
import { ScimError } from './types';

// Load environment variables early
dotenv.config();

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

// SCIM Bearer token middleware
function validateScimToken(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    const error: ScimError = {
      schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
      detail: 'Unauthorized'
    };
    return res.status(401).json(error);
  }
  const token = authHeader.split(' ')[1];
  if (token !== process.env.SCIM_TOKEN) {
    const error: ScimError = {
      schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
      detail: 'Invalid token'
    };
    return res.status(401).json(error);
  }
  next();
}

// Routes
app.use('/saml', samlRoutes);
app.use('/scim/v2', validateScimToken, scimRoutes);

// Home route
app.get('/', function(req: Request, res: Response) {
  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.headers['x-forwarded-host'] || req.get('host');
  const baseUrl = `${protocol}://${host}`;
  
  res.send(`
    <h1>Identity Provider is running</h1>
    <p>Important URLs:</p>
    <ul>
      <li>SAML Metadata URL: <a href="${baseUrl}/saml/metadata">${baseUrl}/saml/metadata</a></li>
      <li>SAML Login URL: <a href="${baseUrl}/saml/login">${baseUrl}/saml/login</a></li>
      <li>SCIM Base URL: ${baseUrl}/scim/v2</li>
    </ul>
    <p>Configure these URLs in your LLM Labs integration settings.</p>
  `);
});

app.listen(port, function() {
  console.log(`⚡️ Identity Provider server running at http://localhost:${port}`);
  console.log(`🔑 SAML endpoint available at http://localhost:${port}/saml`);
  console.log(`👥 SCIM endpoint available at http://localhost:${port}/scim/v2`);
}); 