import * as pg from "pg";
console.log("pg:", pg);
console.log("pg.Pool:", pg.Pool);
console.log("pg.default:", (pg as any).default);
if ((pg as any).default) {
	console.log("pg.default.Pool:", (pg as any).default.Pool);
}
const PoolConstructor = pg.Pool || (pg as any).default?.Pool;
console.log("Selected PoolConstructor:", PoolConstructor);
try {
	const pool = new PoolConstructor();
	console.log("Successfully created pool!");
} catch (e) {
	console.error("Failed to create pool:", e);
}
