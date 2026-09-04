// The ACME (Let's Encrypt) account key was not part of the open-source export.
// Provide one through the ACME_ACCOUNT_KEY env var (PEM, newlines may be escaped as \n)
// if you want the server to issue certificates for custom domains itself.
export const acmeAccountKey: string = (process.env.ACME_ACCOUNT_KEY || '').replace(/\\n/g, '\n')
