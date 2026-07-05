import express, { Request, Response } from 'express';
import cors from 'cors';
import db from './models';
import routes from './routes';
import { authIpThrottle } from './middleware/rateLimiter';

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 4000;

app.use(cors({
    origin: [
        'http://localhost:3003', // Local development
        'https://diamond-ui.vercel.app/', // Deployed test UI
        'https://ui.staging.bit.diamonds', // staging frontend
        'https://ui.bit.diamonds' // frontend
    ],
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'Origin']
}));

app.use(express.json());

app.get('/', (req: Request, res: Response) => {
    res.send('Hello from Express with Sequelize and TypeScript!');
});

// Per-IP guard ahead of the authenticated routers
app.use(authIpThrottle);

app.use(routes);

app.use((req: Request, res: Response) => {
    res.status(404).json({ error: 'Not Found' });
});

const startServer = async () => {
    try {
        await db.sequelize.authenticate();
        console.log('Database connected!');
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.warn('Database connection failed - some endpoints may not work:', errorMessage);
    } finally {
        // Start server regardless of database connection status
        const HOST = process.env.HOST || '0.0.0.0';
        app.listen(Number(PORT), HOST, () => console.log(`Server running on ${HOST}:${PORT}`));
    }
};

startServer();
