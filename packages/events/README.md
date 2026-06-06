# Events Package

`packages/events` contains Kafka event contracts.

Use it for:

- Topic constants.
- Event envelope type.
- Payload schemas.
- Idempotency key helpers.
- Consumer group naming conventions.

All producers and consumers should import event contracts from this package so topic and payload drift is caught early.

