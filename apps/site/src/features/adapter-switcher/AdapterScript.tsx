import { ADAPTER_COOKIE, ADAPTERS, DEFAULT_ADAPTER } from "@/shared/lib/adapter";

/**
 * Applies the stored adapter before first paint, so every page stays static:
 * reading the cookie on the server would opt the whole site out of prerendering.
 */
const SOURCE = `try{var m=document.cookie.match(/(?:^|;\\s*)${ADAPTER_COOKIE}=([^;]*)/);
if(m&&${JSON.stringify(ADAPTERS)}.indexOf(m[1])>-1)document.documentElement.dataset.adapter=m[1]}catch(e){}`;

export function AdapterScript() {
  return (
    // biome-ignore lint/security/noDangerouslySetInnerHtml: the source is a build-time constant.
    <script suppressHydrationWarning dangerouslySetInnerHTML={{ __html: SOURCE }} />
  );
}

export { DEFAULT_ADAPTER };
