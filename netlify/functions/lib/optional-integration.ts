/** Public build has no owner-specific service routes or credentials. */
export async function optionalIntegrationRoute(_request: Request, _pathname: string): Promise<Response | null> {
  return null;
}
