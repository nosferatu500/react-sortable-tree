import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import typescript from "@rollup/plugin-typescript";
import postcss from "rollup-plugin-postcss";
import dts from "rollup-plugin-dts";
import { createRequire } from 'node:module';

const requireFile = createRequire(import.meta.url);
const packageJson = requireFile('./package.json');

// React Compiler is opt-in via REACT_COMPILER=true environment variable
const useReactCompiler = process.env.REACT_COMPILER === 'true';

// Conditionally load babel plugin for React Compiler
const getBabelPlugin = async () => {
  if (!useReactCompiler) return null;
  const { default: babel } = await import('@rollup/plugin-babel');
  return babel({
    babelHelpers: 'bundled',
    extensions: ['.ts', '.tsx'],
    plugins: [['babel-plugin-react-compiler', {}]],
  });
};

export default (async () => {
  const babelPlugin = await getBabelPlugin();

  if (useReactCompiler) {
    console.log('🚀 Building with React Compiler enabled');
  }

  return [{
    input: "src/index.ts",
    output: [
      {
        file: packageJson.module,
        format: "esm",
        sourcemap: true
      }
    ],
    external: (id) => {
      if (id.includes('style-inject')) return false;

      return /node_modules/.test(id);
    },
    plugins: [
      resolve(),
      commonjs(),
      postcss({
        extensions: ['.css']
      }),
      typescript({
        tsconfig: './tsconfig.json',
        declaration: true,
        declarationDir: 'lib/types',
        outDir: 'lib'
      }),
      // React Compiler (when enabled via REACT_COMPILER=true)
      babelPlugin,
    ].filter(Boolean),
  }, {
    input: 'lib/types/index.d.ts',
    output: [{ file: 'lib/index.d.ts', format: 'es' }],
    plugins: [dts()],
    external: [/\.css$/]
  }];
})();