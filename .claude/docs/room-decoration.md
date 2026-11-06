# Room decoration (REMOVED)

User decision: the in-room "Decorar" feature is no longer needed, because rooms now get their
whole look from a map template made in the editor (see `map-format.md`).

Removed: web (`DecorEditor`, `DecorationManager`, decor store/catalog/services, i18n `decor`),
API (controller, use case, repository, entity, request, catalog, module wiring) and the game-server
`decor_changed` relay. The `room_decoration` table and its migration `1772200000000` were left in
the database on purpose (no data was dropped); a later migration can drop the table if wanted.
