const os = require('os');
const path = require('path');
const slsw = require('serverless-webpack');
const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin')
const nodeExternals = require('webpack-node-externals');

module.exports = {
  entry: slsw.lib.entries,
  mode: slsw.lib.webpack.isLocal ? 'development' : 'production',
  devtool: 'source-map',
  resolve: {
    extensions: ['.js', '.json', '.ts']
  },
  externals: [
    /aws-sdk/
  ].concat(nodeExternals({
    whitelist: [
      '@pinpt/fn'
    ]
  })),
  output: {
    libraryTarget: 'commonjs',
    path: path.join(__dirname, '.webpack'),
    filename: '[name].js',
  },
  target: 'node',
  module: {
    rules: [{
      test: /\.ts$/,
      use: [{
        loader: 'cache-loader',
      }, {
        loader: 'thread-loader',
        options: {
          // There should be 1 cpu for the
          // fork-ts-checker-webpack-plugin
          workers: Math.max(os.cpus().length - 2, 1)
        },
      }, {
        loader: 'ts-loader',
        options: {
          // IMPORTANT! use happyPackMode mode to speed-up
          // compilation and reduce errors reported to webpack
          happyPackMode: true,
        },
      }],
    }],
  },
  plugins: [
    new ForkTsCheckerWebpackPlugin({ checkSyntacticErrors: true }),
  ]
};
