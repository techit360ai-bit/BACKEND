# Render Node Backend Deployment

The production Node API is a different Render service from the Go messaging
service. Its deploy hook must therefore be stored separately as the GitHub
repository secret `RENDER_BACKEND_DEPLOY_HOOK`.

After adding the secret, run the `Deploy Node Backend to Render` workflow. It:

1. triggers only the Node backend service;
2. waits for `/api/support/health`, which distinguishes the current backend
   from the stale deployment that rejected Explorer signup; and
3. submits a non-persisting Explorer signup contract request and verifies the
   response reaches email-verification validation instead of `Role is invalid`.

Render free-tier sleep can delay the first request, but it cannot change role
validation. A `Role is invalid` response for `explorer` means the service is
running a build older than the Explorer role implementation.
