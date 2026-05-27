function transformImportMetaEnvForJest({ types: t }) {
  return {
    visitor: {
      MemberExpression(path) {
        const { node } = path
        const envExpression = node.object

        if (
          !t.isMemberExpression(envExpression)
          || !t.isMetaProperty(envExpression.object)
          || envExpression.object.meta.name !== 'import'
          || envExpression.object.property.name !== 'meta'
          || !t.isIdentifier(envExpression.property, { name: 'env' })
          || !t.isIdentifier(node.property)
        ) {
          return
        }

        path.replaceWith(
          t.memberExpression(
            t.memberExpression(t.identifier('process'), t.identifier('env')),
            t.identifier(node.property.name)
          )
        )
      }
    }
  }
}

module.exports = (api) => ({
  presets: [
    ['@babel/preset-env', { targets: { node: 'current' } }],
    ['@babel/preset-react', { runtime: 'automatic' }]
  ],
  plugins: api.env('test') ? [transformImportMetaEnvForJest] : []
})
