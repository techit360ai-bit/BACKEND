if (process.env.NODE_ENV !== 'production') {
  process.env.JWT_SECRET ||= 'startup_import_check_secret_at_least_32_chars'
}

const modules = [
  '../src/app.js',
  '../src/services/aiRouterClient.js',
  '../src/services/trustVerificationService.js',
]

for (const modulePath of modules) {
  await import(modulePath)
}

console.log(`startup import contracts OK: ${modules.length} modules`)
