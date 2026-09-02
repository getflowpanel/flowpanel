import { Callout } from "fumadocs-ui/components/callout";
import { ServerCodeBlock } from "fumadocs-ui/components/codeblock.rsc";
import { extractApiSymbol } from "@/shared/lib/api-signature";

interface ApiSignatureProps {
  path: string;
  name: string;
}

export async function ApiSignature({ path, name }: ApiSignatureProps) {
  const symbol = extractApiSymbol({ path, name });

  return (
    <section className="my-6 space-y-3" data-api-symbol={symbol.name}>
      {symbol.description ? <p>{symbol.description}</p> : null}
      {symbol.deprecated ? (
        <Callout type="warn" title="Deprecated">
          {symbol.deprecated}
        </Callout>
      ) : null}
      {
        await Promise.all(
          symbol.signatures.map((signature) => (
            <ServerCodeBlock key={signature} code={signature} lang="ts" />
          )),
        )
      }
    </section>
  );
}
