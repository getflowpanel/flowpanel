export async function queueCounts(): Promise<{ waiting: number; failed: number }> {
  return { waiting: new Date().getSeconds(), failed: 0 };
}
