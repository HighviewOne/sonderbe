import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import dotenv from 'dotenv'
import { rateLimit } from 'express-rate-limit'

dotenv.config()

import { errorHandler } from './middleware/errorHandler.js'
import profileRoutes from './routes/profile.js'
import checklistRoutes from './routes/checklist.js'
import submissionsRoutes from './routes/submissions.js'
import documentsRoutes from './routes/documents.js'
import adminRoutes from './routes/admin.js'
import investorRoutes from './routes/investor.js'
import stripeRoutes from './routes/stripe.js'

const app = express()
const PORT = process.env.PORT || 3001

// Render terminates TLS at one proxy hop; trust it so req.ip is the real client IP
// (the rate limiters key on req.ip)
app.set('trust proxy', 1)

app.use(helmet())

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}))

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 200,
  standardHeaders: true,
  legacyHeaders: false,
  // Stripe webhook deliveries are signature-verified and must never be throttled
  skip: (req) => req.path === '/api/stripe/webhook'
})
app.use(globalLimiter)

app.get('/health', (_req, res) => res.json({ ok: true }))

// Stripe webhook needs the raw body for signature verification — must run before express.json()
app.use('/api/stripe/webhook', express.raw({ type: 'application/json' }))
app.use(express.json({ limit: '1mb' }))

app.use('/api/profile', profileRoutes)
app.use('/api/checklist', checklistRoutes)
app.use('/api/submissions', submissionsRoutes)
app.use('/api/documents', documentsRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/investor', investorRoutes)
app.use('/api/stripe', stripeRoutes)

app.use((_req, res) => res.status(404).json({ error: 'Not found' }))
app.use(errorHandler)

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})
