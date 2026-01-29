import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'

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

app.use(cors())

// Stripe webhook needs raw body — register before express.json()
app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), (req, res, next) => {
  // Forward to stripe router
  next()
})

app.use(express.json())

app.use('/api/profile', profileRoutes)
app.use('/api/checklist', checklistRoutes)
app.use('/api/submissions', submissionsRoutes)
app.use('/api/documents', documentsRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/investor', investorRoutes)
app.use('/api/stripe', stripeRoutes)

app.use(errorHandler)

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})
