---
"@flowpanel/next": minor
---

Decode resource form submissions through the same path as action dialogs.

The two form surfaces had two decoders, and only the action dialog's understood
what the controls actually post. A resource create or edit form containing a
boolean column was therefore unusable: the generated checkbox submits the native
`"on"` token, `coerceRowByColumns` accepted only `true/1/false/0`, and the write
came back 422 with `"on" is not a valid boolean`. An unticked checkbox submits
nothing at all, so a boolean could never be set back to false either. A `tags` or
`multiselect` field stored the literal string `["a","b"]` rather than the array,
because the list encoding those controls submit was decoded on the action path
only.

Both surfaces now share `readFormValues`. A field the server withholds — one
declared `hidden` — is left out of the decode rather than being read as an empty
submission, so a withheld field is still absent from the write instead of being
cleared.

Separately, the generated form now offers only the columns a write may carry.
`AutoForm` received every introspected column while `assertWritableInput` accepts
only the resource's declared `columns`, so a resource listing a subset rendered
inputs whose submission always failed with `Unknown field`. Both sides now read
the same `declaredWriteFields`.
