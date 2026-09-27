// sql.js (SQLite'ın JavaScript derlemesi) üzerinde node:sqlite DatabaseSync API'sinin
// sunucu kodunun kullandığı alt kümesi: exec, prepare().all/get/run.

function toBindable(value) {
  if (value === undefined) return null;
  if (typeof value === 'boolean') return value ? 1 : 0;
  return value;
}

function bindParams(params) {
  if (params.length === 1 && params[0] && typeof params[0] === 'object' && !Array.isArray(params[0])) {
    // Adlandırılmış parametreler: sunucu kodu SQL'de ':ad' kullanır, nesnede önek olmadan verir.
    const named = {};
    for (const [key, value] of Object.entries(params[0])) named[`:${key}`] = toBindable(value);
    return named;
  }
  return params.map(toBindable);
}

class Statement {
  constructor(owner, sql) {
    this.owner = owner;
    this.sql = sql;
    this.generation = -1;
    this.stmt = null;
  }

  get raw() {
    return this.owner.raw;
  }

  // sql.js export() tüm hazır ifadeleri kapatır; nesil değiştiyse ifade yeniden hazırlanır.
  // (Sunucu kodu bazı ifadeleri bir kez hazırlayıp istekler boyunca yeniden kullanır.)
  #start(params) {
    if (this.generation !== this.owner.generation) {
      this.stmt = this.raw.prepare(this.sql);
      this.generation = this.owner.generation;
    }
    if (params.length) this.stmt.bind(bindParams(params));
    else this.stmt.reset();
  }

  all(...params) {
    this.#start(params);
    const rows = [];
    try {
      while (this.stmt.step()) rows.push(this.stmt.getAsObject());
    } finally {
      this.stmt.reset();
    }
    return rows;
  }

  get(...params) {
    this.#start(params);
    try {
      return this.stmt.step() ? this.stmt.getAsObject() : undefined;
    } finally {
      this.stmt.reset();
    }
  }

  run(...params) {
    this.#start(params);
    try {
      while (this.stmt.step()) {
        /* sonuç satırları yok sayılır */
      }
    } finally {
      this.stmt.reset();
    }
    const changes = this.raw.getRowsModified();
    const lastInsertRowid = this.raw.exec('SELECT last_insert_rowid()')[0]?.values[0][0] ?? 0;
    return { changes, lastInsertRowid };
  }
}

/** sql.js Database nesnesini DatabaseSync benzeri bir arayüzle sarar. Hazır ifadeler önbelleğe alınır. */
export function wrapDatabase(raw) {
  const cache = new Map();
  const db = {
    raw,
    generation: 0,
    exec(sql) {
      raw.exec(sql);
    },
    prepare(sql) {
      let stmt = cache.get(sql);
      if (!stmt) {
        stmt = new Statement(db, sql);
        cache.set(sql, stmt);
      }
      return stmt;
    },
    /** Veritabanını bayt dizisi olarak dışa aktarır (sql.js ifadeleri kapatır ve PRAGMA'ları sıfırlar). */
    export() {
      const data = raw.export();
      db.generation += 1;
      raw.exec('PRAGMA foreign_keys = ON;');
      return data;
    },
    close() {
      raw.close();
    },
  };
  return db;
}
