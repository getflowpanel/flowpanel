/** Where a resource's writes go: its `writeTo` table, else the ref it reads. */
export function writeTarget(resource: { ref: unknown; options: { writeTo?: unknown } }): unknown {
  return resource.options.writeTo ?? resource.ref;
}
