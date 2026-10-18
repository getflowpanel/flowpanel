/** English strings only the server shows, kept out of `DEFAULT_LABELS` so the browser bundle does not carry them. */
export const SERVER_LABELS = {
  form: {
    invalidEmail: "{label} must be an email address like name@example.com",
    invalidUrl: "{label} must be a full web address like https://example.com",
    invalidColor: "{label} must be a colour like #2563eb",
    invalidTime: "{label} must be a time like 09:30",
  },
  fields: {
    id: "ID",
    createdAt: "Created at",
    created_at: "Created at",
    updatedAt: "Updated at",
    updated_at: "Updated at",
    deletedAt: "Deleted at",
    deleted_at: "Deleted at",
  },
} as const;

export type ServerFormLabel = keyof typeof SERVER_LABELS.form;
