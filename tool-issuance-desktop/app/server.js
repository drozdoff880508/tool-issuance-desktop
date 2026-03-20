const { createServer } = require('http')
const { parse } = require('url')
const next = require('next')
const { existsSync, mkdirSync } = require('fs')
const { join, dirname } = require('path')
const { fileURLToPath } = require('url')

// Ensure db directory exists
const dbDir = join(__dirname, 'db')
if (!existsSync(dbDir)) {
  mkdirSync(dbDir, { recursive: true })
}

// Set database URL
process.env.DATABASE_URL = process.env.DATABASE_URL || `file:${join(dbDir, 'custom.db')}`

const dev = false
const hostname = 'localhost'
const port = 3000

console.log('Starting Next.js server...')
console.log('Database:', process.env.DATABASE_URL)

const app = next({ dev, hostname, port, dir: __dirname })
const handle = app.getRequestHandler()

app.prepare().then(() => {
  console.log(`Server ready on http://${hostname}:${port}`)
  
  createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true)
      await handle(req, res, parsedUrl)
    } catch (err) {
      console.error('Error occurred handling', req.url, err)
      res.statusCode = 500
      res.end('internal server error')
    }
  })
    .once('error', (err) => {
      console.error(err)
      process.exit(1)
    })
    .listen(port, () => {
      console.log(`> Ready on http://${hostname}:${port}`)
    })
})
