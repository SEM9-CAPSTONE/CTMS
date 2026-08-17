import * as pg from "pg";

interface PgModuleWithDefault {
	default?: { Pool?: typeof pg.Pool };
}

const pgWithDefault = pg as unknown as PgModuleWithDefault;

console.log("pg:", pg);
console.log("pg.Pool:", pg.Pool);
console.log("pg.default:", pgWithDefault.default);
if (pgWithDefault.default) {
	console.log("pg.default.Pool:", pgWithDefault.default.Pool);
}
const PoolConstructor = pg.Pool || pgWithDefault.default?.Pool;
console.log("Selected PoolConstructor:", PoolConstructor);
try {
	const _pool = new PoolConstructor();
	console.log("Successfully created pool!");
} catch (e) {
	console.error("Failed to create pool:", e);
}
