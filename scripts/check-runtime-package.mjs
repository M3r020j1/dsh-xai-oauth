import { readFile } from 'node:fs/promises'

const packageJson = JSON.parse(
  await readFile(new URL('../package.json', import.meta.url), 'utf8'),
)
const allowedPeers = new Set(Object.keys(packageJson.peerDependencies ?? {}))

const hostBundle = new URL('../lib/index.mjs', import.meta.url)
const source = await readFile(hostBundle, 'utf8')
const runtimeImport = /(?:from\s+|import\s*\(\s*)['"](@deepseek-ai\/[^'"]+)['"]/g

const forbidden = []
for (const match of source.matchAll(runtimeImport)) {
  const specifier = match[1]
  if (!allowedPeers.has(specifier)) forbidden.push(specifier)
}

if (forbidden.length > 0) {
  throw new Error(
    'Host bundle contains undeclared @deepseek-ai runtime imports: '
      + [...new Set(forbidden)].join(', '),
  )
}

console.log('check-runtime-package: host bundle only imports declared DSH peers')
