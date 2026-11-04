// Livello dati. L'interfaccia è identica per i due archivi, quindi l'app non sa
// dove finiscono i dati: sul dispositivo (LocalStore) o nel database condiviso (SupabaseStore).
//
// Interfaccia:
//   listItems()            -> [{id, larghezza, altezza, codice, descrizione, quantita, scorta_minima, unita, ubicazione, note}]
//   saveItem(item)         -> item   (crea o aggiorna)
//   deleteItem(id)
//   registerMovement({item_id, tipo: 'carico'|'scarico', qty, note, utente})
//   listMovements(limit)   -> [{id, item_id, larghezza, altezza, codice, tipo, qty, note, utente, created_at}]

const uuid = () => (crypto.randomUUID ? crypto.randomUUID()
  : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16);
    }));

/* ---------- Archivio locale (solo questo dispositivo) ---------- */
export class LocalStore {
  kind = 'local';
  #read(k) { try { return JSON.parse(localStorage.getItem(k)) || []; } catch { return []; } }
  #write(k, v) { localStorage.setItem(k, JSON.stringify(v)); }

  async listItems() {
    return this.#read('cabb.items').sort((a, b) => {
      const da = Number(a.altezza) - Number(b.altezza);
      if (da !== 0) return da;
      return Number(a.larghezza) - Number(b.larghezza);
    });
  }
  async saveItem(item) {
    const all = this.#read('cabb.items');
    const it = { ...item, id: item.id || uuid() };
    const i = all.findIndex(x => x.id === it.id);
    i >= 0 ? all[i] = it : all.push(it);
    this.#write('cabb.items', all);
    return it;
  }
  async deleteItem(id) {
    this.#write('cabb.items', this.#read('cabb.items').filter(x => x.id !== id));
  }
  async registerMovement({ item_id, tipo, qty, note, utente }) {
    const items = this.#read('cabb.items');
    const it = items.find(x => x.id === item_id);
    if (!it) throw new Error('Canalina non trovata');
    const delta = tipo === 'carico' ? qty : -qty;
    it.quantita = Math.round((Number(it.quantita) + delta) * 1000) / 1000;
    this.#write('cabb.items', items);
    const movs = this.#read('cabb.movs');
    movs.unshift({ id: uuid(), item_id, larghezza: it.larghezza, altezza: it.altezza,
      codice: it.codice || '', descrizione: it.descrizione || '',
      tipo, qty, note: note || '', utente: utente || '', created_at: new Date().toISOString() });
    this.#write('cabb.movs', movs);
  }
  async listMovements(limit = 200) { return this.#read('cabb.movs').slice(0, limit); }
}

/* ---------- Archivio condiviso (Supabase, via REST) ---------- */
export class SupabaseStore {
  kind = 'supabase';
  constructor(url, key) {
    this.base = url.replace(/\/+$/, '') + '/rest/v1';
    this.h = { apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' };
  }
  async #req(path, opt = {}) {
    const res = await fetch(this.base + path, { ...opt, headers: { ...this.h, ...(opt.headers || {}) } });
    if (!res.ok) throw new Error((await res.text().catch(() => '')) || ('Errore ' + res.status));
    const t = await res.text();
    return t ? JSON.parse(t) : null;
  }
  listItems() { return this.#req('/items?select=*&order=altezza.asc,larghezza.asc'); }
  async saveItem(item) {
    const it = { ...item, id: item.id || uuid() };
    const out = await this.#req('/items', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
      body: JSON.stringify(it)
    });
    return out[0];
  }
  async deleteItem(id) { await this.#req('/items?id=eq.' + encodeURIComponent(id), { method: 'DELETE' }); }
  async registerMovement({ item_id, tipo, qty, note, utente }) {
    // Funzione SQL: aggiorna la giacenza e scrive il movimento in un'unica operazione (vedi schema.sql).
    await this.#req('/rpc/register_movement', {
      method: 'POST',
      body: JSON.stringify({ p_item: item_id, p_tipo: tipo, p_qty: qty, p_note: note || '', p_utente: utente || '' })
    });
  }
  listMovements(limit = 200) {
    return this.#req('/movements_view?select=*&order=created_at.desc&limit=' + limit);
  }
}

/* ---------- Scelta dell'archivio in base alle impostazioni salvate ---------- */
export function createStore() {
  const url = localStorage.getItem('cabb.sbUrl');
  const key = localStorage.getItem('cabb.sbKey');
  return url && key ? new SupabaseStore(url, key) : new LocalStore();
}
