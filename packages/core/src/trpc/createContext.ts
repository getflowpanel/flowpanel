export type FlowPanelContextBase = {
  db: unknown;
};

export function createFlowPanelContext<TExtra extends Record<string, unknown>>(
  factory: (args: { req: Request }) => TExtra | Promise<TExtra>,
): (args: { req: Request }) => Promise<FlowPanelContextBase & TExtra> {
  return async (args) => {
    const extra = await factory(args);
    return extra as FlowPanelContextBase & TExtra;
  };
}
