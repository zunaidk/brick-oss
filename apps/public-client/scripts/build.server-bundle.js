'use strict'

// Builds the server-side rendering bundle (build/server-bundle.js) that the API server
// requires at runtime to render public pages. See config/webpack.config.server-bundle.js.

process.env.BABEL_ENV = 'production'
process.env.NODE_ENV = 'production'

process.on('unhandledRejection', err => {
  throw err
})

require('../config/env')

const webpack = require('webpack')
const configFactory = require('../config/webpack.config.server-bundle')
const formatWebpackMessages = require('react-dev-utils/formatWebpackMessages')

const config = configFactory('production')

console.log('Building server bundle (public-client)...')
webpack(config).run((err, stats) => {
  let messages
  if (err) {
    console.error(err.message || err)
    process.exit(1)
  }
  messages = formatWebpackMessages(stats.toJson({ all: false, warnings: true, errors: true }))
  if (messages.errors.length) {
    console.error('Failed to compile server bundle.\n')
    console.error(messages.errors[0])
    process.exit(1)
  }
  if (messages.warnings.length) {
    console.log('Compiled with warnings.\n')
    console.log(messages.warnings.join('\n\n'))
  } else {
    console.log('Server bundle compiled successfully.')
  }
})
