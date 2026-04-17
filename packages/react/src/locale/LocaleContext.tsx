import type React from "react";
import { createContext, useContext } from "react";
import { defaultLocale, type FlowPanelLocale } from "./defaultLocale";

const LocaleContext = createContext<FlowPanelLocale>(defaultLocale);

export function LocaleProvider({
  locale,
  children,
}: {
  locale?: Partial<FlowPanelLocale>;
  children: React.ReactNode;
}) {
  const merged = locale ? { ...defaultLocale, ...locale } : defaultLocale;
  return <LocaleContext.Provider value={merged}>{children}</LocaleContext.Provider>;
}

export function useLocale(): FlowPanelLocale {
  return useContext(LocaleContext);
}
