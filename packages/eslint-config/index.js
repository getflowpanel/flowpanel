/** @type {import('eslint').Linter.FlatConfig[]} */
module.exports = [
  {
    rules: {
      // Discourage direct DB access bypassing FlowPanel query builder
      "no-restricted-syntax": [
        "warn",
        {
          selector: "CallExpression[callee.property.name='query'][callee.object.name='db']",
          message: "Use FlowPanel queryBuilder instead of raw db.query() for tracked tables.",
        },
      ],
    },
  },
];
