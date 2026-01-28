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

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(express.json())

app.use('/api/profile', profileRoutes)
app.use('/api/checklist', checklistRoutes)
app.use('/api/submissions', submissionsRoutes)
app.use('/api/documents', documentsRoutes)
app.use('/api/admin', adminRoutes)

app.use(errorHandler)

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})
