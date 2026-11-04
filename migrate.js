/**
 * migrate.js — importazione one-shot dei dati dal vecchio gestionale.
 * Viene eseguito UNA SOLA VOLTA: se cabb.migrated === '1' non fa nulla.
 */

const MIGRATION_KEY = 'cabb.migrated';

const SOURCE = {"items":[{"id":"mvz5rkp81v83","w":100,"h":100,"min":2,"code":"","note":"","qty":5},{"id":"mvz5s74fbiqi","w":80,"h":100,"min":5,"code":"","note":"","qty":15},{"id":"mvz5wtzxvnjg","w":60,"h":100,"min":4,"code":"","note":"","qty":9},{"id":"mvz5x8vhxarb","w":40,"h":100,"min":2,"code":"","note":"","qty":3},{"id":"mvz5xpkkrzqs","w":25,"h":100,"min":1,"code":"","note":"","qty":4},{"id":"mvz61za9jlo0","w":100,"h":80,"min":2,"code":"","note":"","qty":1},{"id":"mvz62xkj8qcz","w":80,"h":80,"min":2,"code":"","note":"","qty":1},{"id":"mvz639dl83gk","w":25,"h":80,"min":1,"code":"","note":"","qty":2},{"id":"mvz63w1fnzj4","w":40,"h":80,"min":1,"code":"","note":"Usata per quadri T&T","qty":2},{"id":"mvz648alvxv7","w":60,"h":80,"min":2,"code":"","note":"","qty":4},{"id":"mvz65c350jyq","w":60,"h":60,"min":1,"code":"","note":"","qty":2},{"id":"mvz671izhxau","w":25,"h":60,"min":1,"code":"","note":"","qty":3},{"id":"mvz67eaurn72","w":40,"h":60,"min":2,"code":"","note":"","qty":6},{"id":"mvz68jfvfwcw","w":60,"h":40,"min":0,"code":"","note":"","qty":1},{"id":"mvz68zsb7zx7","w":40,"h":40,"min":1,"code":"","note":"","qty":5},{"id":"mvz69gk32cou","w":25,"h":40,"min":1,"code":"","note":"Usate per il cablaggio","qty":2}],"log":[{"u":"mvz5rkp8n1td","t":1793617863308,"id":"mvz5rkp81v83","d":5,"k":"init","by":"Marco"},{"u":"mvz5s74fcyai","t":1793617892367,"id":"mvz5s74fbiqi","d":15,"k":"init","by":"Marco"},{"u":"mvz5wtzx2ujx","t":1793618108637,"id":"mvz5wtzxvnjg","d":9,"k":"init","by":"Marco"},{"u":"mvz5x8vh2mx8","t":1793618127917,"id":"mvz5x8vhxarb","d":3,"k":"init","by":"Marco"},{"u":"mvz5xpkkbrwj","t":1793618149556,"id":"mvz5xpkkrzqs","d":4,"k":"init","by":"Marco"},{"u":"mvz61za93xt1","t":1793618348769,"id":"mvz61za9jlo0","d":2,"k":"init","by":"Marco"},{"u":"mvz62xkj744h","t":1793618393203,"id":"mvz62xkj8qcz","d":2,"k":"init","by":"Marco"},{"u":"mvz639dlsv7p","t":1793618408505,"id":"mvz639dl83gk","d":2,"k":"init","by":"Marco"},{"u":"mvz63w1fnwk7","t":1793618437875,"id":"mvz63w1fnzj4","d":2,"k":"init","by":"Marco"},{"u":"mvz648al908d","t":1793618453757,"id":"mvz648alvxv7","d":4,"k":"init","by":"Marco"},{"u":"mvz65c3581ls","t":1793618505329,"id":"mvz65c350jyq","d":2,"k":"init","by":"Marco"},{"u":"mvz671izpib4","t":1793618584955,"id":"mvz671izhxau","d":3,"k":"init","by":"Marco"},{"u":"mvz67eauf3qv","t":1793618601510,"id":"mvz67eaurn72","d":6,"k":"init","by":"Marco"},{"u":"mvz68jfv95y2","t":1793618654827,"id":"mvz68jfvfwcw","d":1,"k":"init","by":"Marco"},{"u":"mvz68zsbsv1o","t":1793618676011,"id":"mvz68zsb7zx7","d":5,"k":"init","by":"Marco"},{"u":"mvz69gk32eiz","t":1793618697747,"id":"mvz69gk32cou","d":2,"k":"init","by":"Marco"},{"u":"mw0jgz31y8fy","t":1793701349533,"id":"mvz61za9jlo0","d":-1,"k":"mov","by":"alessio"},{"u":"mw1ykj40l02w","t":1793787175872,"id":"mvz62xkj8qcz","d":-1,"k":"mov","by":"alessio"},{"u":"mw1zn4x0k78j","t":1793788977060,"id":"mvz5xpkkrzqs","d":1,"k":"mov","by":"alessio"},{"u":"mw1zn58egd6h","t":1793788977470,"id":"mvz5xpkkrzqs","d":-1,"k":"mov","by":"alessio"},{"u":"mw21m7l0bb57","t":1793792293091,"id":"mvz5xpkkrzqs","d":1,"k":"mov","by":"alessio"},{"u":"mw21m7wvu19u","t":1793792293519,"id":"mvz5xpkkrzqs","d":-1,"k":"mov","by":"alessio"}],"lead":7,"safety":3};

export function runMigration() {
  if (localStorage.getItem(MIGRATION_KEY) === '1') return; // già fatto

  // ── Items ──
  const items = SOURCE.items.map(x => ({
    id:           x.id,
    larghezza:    x.w,
    altezza:      x.h,
    codice:       x.code || '',
    descrizione:  `Canalina ${x.w}×${x.h}`,
    quantita:     x.qty,
    unita:        'pz',
    scorta_minima: x.min,
    ubicazione:   '',
    note:         x.note || ''
  }));
  localStorage.setItem('cabb.items', JSON.stringify(items));

  // ── Movimenti ──
  // Mappa id → item per recuperare larghezza/altezza
  const itemMap = Object.fromEntries(items.map(i => [i.id, i]));

  const movs = SOURCE.log
    .slice()
    .sort((a, b) => b.t - a.t)   // più recenti prima (come vuole listMovements)
    .map(e => {
      const it = itemMap[e.id];
      const qty = Math.abs(e.d);
      const tipo = e.d >= 0 ? 'carico' : 'scarico';
      return {
        id:          e.u,
        item_id:     e.id,
        larghezza:   it?.larghezza ?? null,
        altezza:     it?.altezza   ?? null,
        codice:      it?.codice    || '',
        descrizione: it?.descrizione || '',
        tipo,
        qty,
        note:        e.k === 'init' ? 'carico iniziale' : '',
        utente:      e.by || '',
        created_at:  new Date(e.t).toISOString()
      };
    });
  localStorage.setItem('cabb.movs', JSON.stringify(movs));

  // ── Parametri Consegna/Sicurezza ──
  localStorage.setItem('cabb.lead',   String(SOURCE.lead));
  localStorage.setItem('cabb.safety', String(SOURCE.safety));

  // Segna come fatto
  localStorage.setItem(MIGRATION_KEY, '1');
  console.info('[migrate] Importati', items.length, 'articoli e', movs.length, 'movimenti.');
}
