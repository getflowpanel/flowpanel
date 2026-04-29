// `.tpl` files are loaded as raw strings by esbuild's `text` loader
// (configured in tsup.config.ts). At type-check time, TypeScript sees them
// as `string` default exports and nothing more.
declare module "*.tpl" {
  const content: string;
  export default content;
}
