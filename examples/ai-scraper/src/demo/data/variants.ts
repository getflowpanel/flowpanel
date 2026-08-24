import type { ListingVariant } from "./types";

interface VariantSetInput {
  exactTitle: string;
  candidateTitle: string;
  candidateKind: ListingVariant["kind"];
  candidateStatus: ListingVariant["status"];
  candidateConfidence: number;
  bundleTitle: string;
  bundleStatus: ListingVariant["status"];
  bundleConfidence: number;
  accessoryTitle: string;
}

/** Four commercially plausible marketplace results for one catalog product. */
export function variantSet(input: VariantSetInput): readonly ListingVariant[] {
  return [
    {
      kind: "exact",
      title: input.exactTitle,
      confidence: 0.98,
      status: "confirmed",
      priceFactor: 0.96,
    },
    {
      kind: input.candidateKind,
      title: input.candidateTitle,
      confidence: input.candidateConfidence,
      status: input.candidateStatus,
      priceFactor: 0.91,
    },
    {
      kind: "refurbished_bundle",
      title: input.bundleTitle,
      confidence: input.bundleConfidence,
      status: input.bundleStatus,
      priceFactor: 0.82,
    },
    {
      kind: "accessory",
      title: input.accessoryTitle,
      confidence: 0.32,
      status: "rejected",
      priceFactor: 0.14,
    },
  ];
}
