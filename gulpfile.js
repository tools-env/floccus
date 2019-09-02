const gulp = require('gulp')
const rollupEach = require('gulp-rollup-each')
const resolve = require('rollup-plugin-node-resolve')
const commonjs = require('rollup-plugin-commonjs')
const json = require('rollup-plugin-json')
const jsx = require('rollup-plugin-jsx')
const builtins = require('rollup-plugin-node-builtins')
const globals = require('rollup-plugin-node-globals')
const inject = require('rollup-plugin-inject')
const acornJsx = require('acorn-jsx')
const createZip = require('gulp-zip')
const createCrx = require('./lib/gulp-crx')
const shell = require('spawn-shell')
const webstoreClient = require('chrome-webstore-upload')
const fs = require('fs')
const path = require('path')

const VERSION = require('./package.json').version
const paths = {
  zip: [
    '**',
    '!builds/**',
    '!src/**',
    '!node_modules/**',
    '!img/**',
    '!ISSUE_TEMPLATE.md',
    '!gulpfile.js',
    '!key.pem'
  ],
  views: './views/*.html',
  entries: 'src/entries/*.js',
  js: 'src/**',
  builds: './builds/'
}
const WEBSTORE_ID = 'fnaicdffflnofjppbagibeoednhnbjhg'

let WEBSTORE_CREDENTIALS
let webstore
try {
  WEBSTORE_CREDENTIALS = require('./builds/google-api.json')
  webstore = webstoreClient(
    Object.assign({}, WEBSTORE_CREDENTIALS, {
      extensionId: WEBSTORE_ID
    })
  )
} catch (e) {}

const js = () => {
  return gulp
    .src(paths.entries)
    .pipe(
      rollupEach(
        {
          // inputOptions
          plugins: [
            builtins(),
            json(),
            resolve({ preferBuiltins: false }),
            commonjs(),
            jsx({ factory: 'h' }),
            inject({
              h: ['hyperapp', 'h']
            }),
            globals()
          ],
          isCache: true, // enable Rollup cache
          acornInjectPlugins: [acornJsx()]
        },
        file => {
          return {
            format: 'iife',
            name: path.basename(file.path, '.js'),
            dir: 'dist/js/'
          }
        }
      )
    )
    .pipe(gulp.dest('dist/js/'))
}

const html = () => {
  return gulp.src(paths.views).pipe(gulp.dest('./dist/html/'))
}

const mochajs = () => {
  return gulp.src('./node_modules/mocha/mocha.js').pipe(gulp.dest('./dist/js/'))
}
const mochacss = () => {
  return gulp
    .src('./node_modules/mocha/mocha.css')
    .pipe(gulp.dest('./dist/css/'))
}

const mocha = gulp.parallel(mochajs, mochacss)

const main = gulp.parallel(html, js, mocha)

const zip = function() {
  return gulp
    .src(paths.zip)
    .pipe(createZip(`floccus-build-v${VERSION}.zip`))
    .pipe(gulp.dest(paths.builds))
}

const xpi = function() {
  return gulp
    .src(paths.zip)
    .pipe(createZip(`floccus-build-v${VERSION}.xpi`))
    .pipe(gulp.dest(paths.builds))
}

const crx = function() {
  return gulp
    .src(paths.zip)
    .pipe(
      createCrx({
        privateKey: fs.readFileSync('./key.pem', 'utf8'),
        filename: `floccus-build-v${VERSION}.crx`
      })
    )
    .pipe(gulp.dest(paths.builds))
}

const keygen = function() {
  return shell(
    'openssl genpkey' +
      ' -algorithm RSA -out ./key.pem -pkeyopt rsa_keygen_bits:2048',
    { env: process.env }
  ).exitPromise
}

const pushWebstore = function() {
  return webstore
    .uploadExisting(
      fs.createReadStream(`${paths.builds}floccus-build-v${VERSION}.zip`)
    )
    .then(function() {
      return webstore.publish('main')
    })
}
const release = gulp.series(main, gulp.parallel(zip, xpi, crx))

const watch = function() {
  gulp.watch(paths.js, js)
  gulp.watch(paths.views, html)
}

module.exports = {
  keygen,
  pushWebstore,
  release,
  default: main,
  watch,
  xpi,
  crx,
  zip,
  html,
  js,
  mocha
}
