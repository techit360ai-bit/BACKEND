import app from './app.js'
import { validateDatabaseConfig } from './config/database.js'

const PORT = process.env.PORT || 3000

validateDatabaseConfig()

app.listen(PORT, () => {
  console.log(`TechIT API running on PORT ${PORT}`)
})
