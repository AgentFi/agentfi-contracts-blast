module.exports = {
  plugins: [
    "prettier-plugin-solidity",
  ],
  overrides: [
    {
      files: "*.sol",
      options: {
        printWidth: 120,
        bracketSpacing: true,
      },
    },
  ],
};