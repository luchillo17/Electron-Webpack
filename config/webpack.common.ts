// Interfaces
import {
  Configuration,
} from 'webpack';

// Webpack packages
import {
  HotModuleReplacementPlugin,
  LoaderOptionsPlugin,
  DefinePlugin,
} from 'webpack';

// Plugins
import { AotPlugin } from '@ngtools/webpack';
import { CheckerPlugin } from 'awesome-typescript-loader';
import HtmlWebpackPlugin = require('html-webpack-plugin');
import CopyWebpackPlugin = require('copy-webpack-plugin')
import CommonsChunkPlugin = require('webpack/lib/optimize/CommonsChunkPlugin');
import WebpackBuildNotifier = require('webpack-build-notifier');
import ScriptExtHtmlWebpackPlugin = require('script-ext-html-webpack-plugin');
import NormalModuleReplacementPlugin = require('webpack/lib/NormalModuleReplacementPlugin');
// Custom imports
import {
  root,
  delay,
  hasNpmFlag,
  hasProcessFlag,
  isWebpackDevServer,
 } from './helpers';

/**
 * Webpack Constants
 */
const ENV = process.env.ENV = process.env.NODE_ENV = 'test';
const HMR = hasProcessFlag('hot');
const AOT = hasNpmFlag('aot');

const METADATA = {
  title: 'Calendario de tareas',
  // baseUrl: './',
  isDevServer: isWebpackDevServer()
};

// App Configuration ------------------------------------
export const config = (options): Configuration => {
  const isProd = options.env === 'production';
  return {
    entry: {
      polyfills: './src/polyfills.browser.ts',
      main: './src/main.browser.ts'
    },
    resolve: {
      extensions: ['.ts', '.js', '.json'],
      modules: [root('src'), root('node_modules')]
    },
    module: {
      rules: [
        {
          test: /\.ts$/,
          use: [
            // {
            //   loader: '@angularclass/hmr-loader',
            //   options: {
            //     pretty: !isProd,
            //     prod: isProd
            //   }
            // },
            /**
             * Temporal fix for lazy loading not working,
             * see https://github.com/angular/angular-cli/issues/4431
             */
            { // MAKE SURE TO CHAIN VANILLA JS CODE, I.E. TS COMPILATION OUTPUT.
              loader: 'ng-router-loader',
              options: {
                aot: AOT,
              },
            },
            '@ngtools/webpack',
          ],
          exclude: [/\.(spec|e2e)\.ts$/],
        },
        {
          test: /\.css$/,
          use: ['to-string-loader', 'css-loader', 'resolve-url-loader'],
          exclude: [root('src', 'styles')]
        },
        {
          test: /\.scss$/,
          use: [
            'to-string-loader',
            'css-loader',
            'resolve-url-loader',
            {
              loader: 'sass-loader',
              options: {
                root: root('src'),
                sourceMap: true,
                outputStyle: 'expanded',
                includePaths: [
                  root('node_modules'),
                  root('src'),
                ],
              },
            },
          ],
          exclude: [root('src', 'styles')]
        },
        {
          test: /\.json$/,
          use: 'json-loader',
        },
        {
          test: /\.html$/,
          use: 'raw-loader',
          exclude: [root('src/index.html')]
        },
        {
          test: /\.(jpg|png|gif)$/,
          use: 'file-loader'
        },
        {
          test: /\.(eot|woff2?|svg|ttf)([\?]?.*)$/,
          use: 'url-loader?limit=100000'
        },
      ],
    },
    plugins: [
      new CheckerPlugin(),
      new CopyWebpackPlugin([
        { from: 'src/styles/images', to: 'dist/images'}
      ]),
      new LoaderOptionsPlugin({
        options: {
          context: root('src'),
          output: {
            path: root('dist'),
          },
        },
      }),
      new CommonsChunkPlugin({
        name: 'polyfills',
        chunks: ['polyfills']
      }),
      // This enables tree shaking of the vendor modules
      new CommonsChunkPlugin({
        name: ['vendor'],
        chunks: ['main'],
        minChunks: module => /node_modules/.test(module.resource)
      }),
      // Specify the correct order the scripts will be injected in
      new CommonsChunkPlugin({
        name: ['polyfills', 'vendor'].reverse()
      }),
      new HtmlWebpackPlugin({
        template: 'src/index.html',
        title: METADATA.title,
        metadata: METADATA,
        chunksSortMode: 'dependency',
      } as any),
      new ScriptExtHtmlWebpackPlugin({
        defaultAttribute: 'defer'
      }),
      // Fix Angular 2
      new NormalModuleReplacementPlugin(
        /facade(\\|\/)async/,
        root('node_modules/@angular/core/src/facade/async.js')
      ),
      new NormalModuleReplacementPlugin(
        /facade(\\|\/)collection/,
        root('node_modules/@angular/core/src/facade/collection.js')
      ),
      new NormalModuleReplacementPlugin(
        /facade(\\|\/)errors/,
        root('node_modules/@angular/core/src/facade/errors.js')
      ),
      new NormalModuleReplacementPlugin(
        /facade(\\|\/)lang/,
        root('node_modules/@angular/core/src/facade/lang.js')
      ),
      new NormalModuleReplacementPlugin(
        /facade(\\|\/)math/,
        root('node_modules/@angular/core/src/facade/math.js')
      ),
      new AotPlugin({
        mainPath: root('src', 'main.browser.ts'),
        tsConfigPath: 'tsconfig.json',
        skipCodeGeneration: !AOT,
      }),
      new WebpackBuildNotifier({
        title: 'Electron Renderer',
        // logo: 'public/dist/img/favicon.ico',
      }),
    ],
    target: 'electron-renderer',
    node: {
      __dirname: false,
      __filename: false,
      global: true,
      crypto: 'empty',
      process: true,
      module: false,
      clearImmediate: false,
      setImmediate: false,
    },
  };
};

export default config;
