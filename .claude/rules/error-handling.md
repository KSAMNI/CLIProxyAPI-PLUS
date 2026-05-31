# Error Handling

## Taxonomy
- Distinguish expected business errors from system errors.
- User-facing errors and internal errors must differ; never leak internal detail outward.

## Verifiable rules
- No silent catch.
- Catch an error only if you log it or rethrow it with context.
- Retry only transient failures; never retry business errors.

## Error format
- Standard error shape: `{ error: string }` at the HTTP boundary, with richer context only where the code already supports it.
- Error code / HTTP status mapping: use non-2xx status codes when the failure is a real transport or contract failure; keep body payloads stable for the frontend clients.
