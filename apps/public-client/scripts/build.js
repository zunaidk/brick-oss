'use strict'

// Production build of the browser bundle (output: build/client). The original ejected-CRA
// scripts were not part of the open-source export; this is a minimal replacement.

process.env.BABEL_ENV = 'production'
process.env.NODE_ENV = 'production'

process.on('unhandledRejection', err => {
  throw err
})

require('../config/env')

const fs = require('fs-extra')
const webpack = require('webpack')
const configFactory = require('../config/webpack.config')
const paths = require('../config/paths')
const formatWebpackMessages = require('react-dev-utils/formatWebpackMessages')

const config = configFactory('production')

function copyPublicFolder() {
  fs.copySync(paths.appPublic, paths.appBuildClient, {
    dereference: true,
    filter: file => file !== paths.appHtml,
  })
}

function build() {
  console.log('Creating an optimized production build (public-client)...')
  const compiler = webpack(config)
  return new Promise((resolve, reject) => {
    compiler.run((err, stats) => {
      let messages
      if (err) {
        if (!err.message) return reject(err)
        messages = formatWebpackMessages({ errors: [err.message], warnings: [] })
      } else {
        messages = formatWebpackMessages(stats.toJson({ all: false, warnings: true, errors: true }))
      }
      if (messages.errors.length) {
        if (messages.errors.length > 1) messages.errors.length = 1
        return reject(new Error(messages.errors.join('\n\n')))
      }
      if (messages.warnings.length) {
        console.log('Compiled with warnings.\n')
        console.log(messages.warnings.join('\n\n'))
      } else {
        console.log('Compiled successfully.')
      }
      resolve()
    })
  })
}

fs.emptyDirSync(paths.appBuild)
copyPublicFolder()
build().catch(err => {
  console.error('Failed to compile.\n')
  console.error(err.message || err)
  process.exit(1)
})
