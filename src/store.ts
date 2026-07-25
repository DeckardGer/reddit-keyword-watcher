import { Database } from "bun:sqlite";

export class Store {
	private db: Database;

	constructor(path: string) {
		this.db = new Database(path, { create: true });
		this.db.run("PRAGMA journal_mode = WAL");
		this.db.run(
			"CREATE TABLE IF NOT EXISTS seen (id TEXT PRIMARY KEY, ts INTEGER NOT NULL)",
		);
		this.db.run(
			"CREATE TABLE IF NOT EXISTS cursors (key TEXT PRIMARY KEY, value INTEGER NOT NULL)",
		);
		this.db.run(
			"CREATE TABLE IF NOT EXISTS stats (day TEXT PRIMARY KEY, scanned INTEGER NOT NULL DEFAULT 0, hits INTEGER NOT NULL DEFAULT 0, sent INTEGER NOT NULL DEFAULT 0)",
		);
	}

	/** Returns true if the id was NOT seen before (and marks it seen). */
	markSeen(id: string): boolean {
		const res = this.db
			.query("INSERT OR IGNORE INTO seen (id, ts) VALUES (?, ?)")
			.run(id, Date.now());
		return res.changes > 0;
	}

	/**
	 * True once a target's first fetch has been absorbed. The first fetch of
	 * any feed returns a backlog of already-existing items; alerting on those
	 * would bombard the user every time a new sub or keyword is added.
	 */
	isPrimed(target: string): boolean {
		const row = this.db
			.query("SELECT value FROM cursors WHERE key = ?")
			.get(`primed:${target}`) as { value: number } | null;
		return row !== null;
	}

	setPrimed(target: string): void {
		this.setCursor(`primed:${target}`, 1);
	}

	getCursor(key: string, fallback: number): number {
		const row = this.db
			.query("SELECT value FROM cursors WHERE key = ?")
			.get(key) as { value: number } | null;
		return row?.value ?? fallback;
	}

	setCursor(key: string, value: number): void {
		this.db
			.query(
				"INSERT INTO cursors (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
			)
			.run(key, value);
	}

	bumpStats(scanned: number, hits: number, sent: number): void {
		const day = new Date().toISOString().slice(0, 10);
		this.db
			.query(
				`INSERT INTO stats (day, scanned, hits, sent) VALUES (?, ?, ?, ?)
         ON CONFLICT(day) DO UPDATE SET scanned = scanned + excluded.scanned,
           hits = hits + excluded.hits, sent = sent + excluded.sent`,
			)
			.run(day, scanned, hits, sent);
	}

	statsForDay(day: string): { scanned: number; hits: number; sent: number } {
		const row = this.db
			.query("SELECT scanned, hits, sent FROM stats WHERE day = ?")
			.get(day) as { scanned: number; hits: number; sent: number } | null;
		return row ?? { scanned: 0, hits: 0, sent: 0 };
	}

	/** Drop seen-ids older than `days` to keep the DB small. */
	prune(days: number): void {
		const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
		this.db.query("DELETE FROM seen WHERE ts < ?").run(cutoff);
	}

	close(): void {
		this.db.close();
	}
}
