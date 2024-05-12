const path = require('path')
const PATHS = {
    src: path.join(__dirname, '../src'),
    dist: path.join(__dirname, '../dist/src')
}

module.exports = {
    entry: {
        index: `${PATHS.src}/index.ts`,
    },
    module: {
      rules: [
        {
          test: /\.ts?$/,
          use: 'ts-loader',
          exclude: /node_modules/,
        },
      ],
    },
    resolve: {
      extensions: ['.tsx', '.ts', '.js'],
    },
    output: {
      path: `${PATHS.dist}`,
    },
    devServer: {
      static: path.join(__dirname, "dist"),
      compress: true,
      port: 4000,
    },
  };
