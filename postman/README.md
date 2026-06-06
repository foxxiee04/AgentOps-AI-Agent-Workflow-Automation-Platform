# Postman Tests

This folder contains a Postman collection for the AgentOps MVP API.

## Files

- `AgentOps.postman_collection.json`: API request collection with basic response tests and variable capture.
- `AgentOps.local.postman_environment.json`: safe local environment values for `http://localhost:4000`.

## How To Use

1. Start the API:

```txt
pnpm --filter @agentops/api start
```

2. Import both JSON files into Postman.
3. Select the `AgentOps Local` environment.
4. Run the collection in order.

The collection uses mock/local values only. Do not store real API keys or secrets in exported Postman environments.

