# Facade services

`generateFacadeServices()` turns dimensioned facade faces and reservations into fitted service networks and selective residential detail. It has no filesystem or material-database dependency: callers pass canonical keys and receive geometry records in local and world coordinates.

The exterior generator adapts its floor openings, condenser units, facade relief, and route clearances to the input contract. The GLB mesher consumes the returned networks, units, clotheslines, and pane damage.
