# Delivery route selection

astack selects a route from the requested outcome, then applies its owning skill. Direct invocation of a focused skill works without loading the coordinator. These are decision guides, not compulsory phases; read only the relevant skill and supporting references.

| Route | Owning skill |
| --- | --- |
| Feature | [implement](../../implement/SKILL.md) |
| Bug fix | [bug-fix](../../bug-fix/SKILL.md) |
| Refactor | [refactor](../../refactor/SKILL.md) |
| Performance | [performance](../../performance/SKILL.md) |
| Investigation | [investigate](../../investigate/SKILL.md) |
| Pull request | [pr](../../pr/SKILL.md) |
| App control | [app-control](../../app-control/SKILL.md) |

A hosting request selects [cloud-transition](../../cloud-transition/SKILL.md); new apps remain local until the owner chooses hosting. Setup, domain modeling, web UI and platform skills supply the jobs a selected delivery route actually needs.
