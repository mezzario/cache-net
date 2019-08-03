import Webpack from 'webpack'
import Path from 'path'

const {NODE_ENV} = process.env

export default {
  mode: NODE_ENV,

  entry: [
    './src',
  ],

  output: {
    path: Path.join(__dirname, 'dist'),
    filename: `cache-net${NODE_ENV === 'production' ? '.min' : ''}.js`,
    library: 'CacheNet',
    libraryTarget: 'umd',
    //pathinfo: true,
  },

  module: {
    rules: [{
      test: /\.js$/,
      loader: 'babel-loader',
      exclude: /node_modules/,
    }],
  },

  optimization: {
    minimize: NODE_ENV === 'production',
  },

  plugins: [
    new Webpack.optimize.OccurrenceOrderPlugin(),
    new Webpack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify(NODE_ENV),
    }),
  ],
}
