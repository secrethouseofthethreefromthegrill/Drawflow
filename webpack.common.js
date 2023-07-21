module.exports = {
  entry: "./src/drawflow.ts",
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: "ts-loader",
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: [".tsx", ".ts", ".js", ".css"],
  },
  output: {
    library: "Drawflow",
    libraryTarget: "umd",
    libraryExport: "default",
    filename: "drawflow.min.js",
    globalObject: `(typeof self !== 'undefined' ? self : this)`,
  },
};
