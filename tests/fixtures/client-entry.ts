import * as client from '../../src/lib/client';

// Bundle the real client into an isolated VM; never replace globals used by server tests.
(globalThis as unknown as { testClient: typeof client }).testClient = client;
