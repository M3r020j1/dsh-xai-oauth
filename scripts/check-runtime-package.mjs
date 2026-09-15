import { readFile } from 'node:fs/promises'

const hostBundle = new URL('../lib/index.mjs', import.meta.url)
const source = await readFile(hostBundle, 'utf8')
const runtimeImport = /(?:from\s*|import\s*\(\s*)['"]@deepseek-ai\//

if (runtimeImport.test(source)) {
  throw new Error('Host bundle contains a runtime import from @deepseek-ai')
}

console.log('check-runtime-package: host bundle is self-contained')
