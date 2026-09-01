export type ErrorCode =
  | 'E_SCHEMA'
  | 'E_FOOTPRINT_INVALID'
  | 'E_FOOTPRINT_TOO_SMALL'
  | 'E_ENVELOPE_TOO_LOW'
  | 'E_FLOORKINDS_MISMATCH'
  | 'E_APERTURE_UNREACHABLE'
  | 'E_APERTURE_INVALID'
  | 'E_APERTURE_OVERLAP'
  | 'E_SIGNAGE_TEXT_TOO_LONG'
  | 'E_MATERIAL_UNRESOLVED'
  | 'E_INVARIANT';

export class ExteriorError extends Error {
  readonly code: ErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(code: ErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'ExteriorError';
    this.code = code;
    this.details = details;
  }
}
