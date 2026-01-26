// Express app setup

import express from 'express'

const app = express()
const PORT = 3000;

app.get('/', (req, res) => {
    res.end('Server is running on port 3000!')
})

app.listen(PORT, () => {
    console.log(`Server is running on PORT ${PORT}`)
})