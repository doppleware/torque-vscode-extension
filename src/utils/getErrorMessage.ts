// Utility function for safe error message extraction
export function getErrorMessage(error: unknown): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
  ) {
    return (error as { message: string }).message;
  } else if (typeof error === "string") {
    return error;
  }
  return "Unknown error";
}
