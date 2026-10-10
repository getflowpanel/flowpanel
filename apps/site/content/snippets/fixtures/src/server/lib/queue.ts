export async function queueCounts(): Promise<{ waiting: number; failed: number }> {
  return { waiting: 0, failed: 0 };
}
