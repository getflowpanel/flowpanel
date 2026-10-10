/** The palette's record search, as its route answers it and the palette reads it. */
export const MIN_RECORD_QUERY = 2;

export interface RecordSearchItem {
  title: string;
  detail?: string;
  href: string;
}

export interface RecordSearchGroup {
  resource: string;
  label: string;
  items: RecordSearchItem[];
}
