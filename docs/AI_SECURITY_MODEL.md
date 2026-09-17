# AI Security Model

The AI Router is an untrusted reasoning and provider-execution component. It
does not decide user identity, authorization, billing, credit balance, or tool
permission.

Controls already present include backend-signed execution grants, issuer and
audience validation, one-time replay protection, user/workspace rate limits,
provider circuit breakers, model registry allow-lists, bounded token/cost
claims, settlement HMACs, structured decision audit, and sandbox build paths.

Required execution sequence:

```text
authenticate -> authorize -> reserve -> grant -> execute -> measure -> settle/refund -> audit
```

Prompt and retrieved content remain data. Tool calls require an independent
policy decision and resource scope. Provider output is validated before it can
affect durable state. Production verification must cover prompt injection,
data exfiltration, model abuse, provider spend limits, RAG tenant predicates,
and kill-switch behavior.
