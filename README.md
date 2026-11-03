# Sito CV · Roberto Berrettino

Sito statico: nessuna installazione, nessun passaggio di build.

```
index.html              contenuti della pagina (testi, esperienze, competenze, certificazioni)
en.html                 la stessa pagina in inglese
assets/css/style.css    colori, font, impaginazione
assets/js/main.js       scroll, indicatore laterale, competenze che volano nel cerchio
assets/js/scene.js      scena 3D (Three.js 0.160, caricato da CDN)
```

## Com'è fatto

- **Scena 3D**: una città blu attraversata dalla telecamera mentre si scorre. In fondo c'è la piazza con la Stazione Centrale, il Pirellone, Porta Nuova e CityLife, e l'anello luminoso.
- **Sezioni**: intro, Chi sono, quattro capitoli del percorso, Competenze, Certificazioni, Contatti.
- **Chip che volano**: ogni scheda porta un chip. Nelle quattro aziende è la competenza acquisita in quel ruolo (Sviluppo Dynamics NAV/BC, Design funzionale operations, Project management, Solution architecture); in Chi sono, Competenze e Certificazioni è il nome della sezione. Superata la scheda, il chip si stacca e vola sulla linea dell'anello luminoso in fondo alla città, dove resta come punto di luce. Un mirino disegnato segue l'anello e conta i chip raccolti (3/7…). Ai Contatti i chip formano un cerchio di link attorno al link LinkedIn (sul telefono sopra il link). Ognuno riporta alla sua scheda.
- **Contatti**: solo il link al profilo LinkedIn, al centro dell'anello.

## Versione inglese

`en.html` è la copia inglese di `index.html`: stessa struttura e stessi `data-key`, ma testi e `id` delle sezioni tradotti. Il pulsante EN/IT in alto a destra passa da una pagina all'altra. I pochi testi generati da `main.js` (contatore "3/7 raccolte", etichette per i lettori di schermo) sono nel blocco `TEXTS` e seguono il `lang` della pagina.

Quando modifichi un testo in `index.html`, aggiorna anche `en.html`.

## LinkedIn

Il link al profilo (https://www.linkedin.com/in/roberto-berrettino-8a164790/) è nell'attributo `href` dell'elemento `id="linkedinLink"` in `index.html`.

## Provarlo sul computer

Il sito usa moduli JavaScript, quindi il doppio clic su `index.html` non basta: serve un piccolo server locale.

```
cd cartella-del-sito
python3 -m http.server 8000
```

Poi apri http://localhost:8000. In alternativa: `npx serve` oppure l'estensione "Live Server" di VS Code.

Dopo una modifica, se il browser mostra ancora la versione vecchia, ricarica con **Ctrl+F5**.

## Metterlo online (gratis)

- **Netlify Drop**: vai su app.netlify.com/drop e trascina la cartella. In 30 secondi hai un link.
- **Vercel**: `npx vercel` dentro la cartella, oppure importa la cartella da GitHub.
- **GitHub Pages**: carica i file in un repository, poi Settings → Pages → branch `main`.

Il dominio personale (es. robertoberrettino.it) si collega dalle impostazioni di Netlify o Vercel.

## Modifiche frequenti

- **Colori**: in cima a `style.css`, blocco `:root` (`--signal` è il blu principale, `--signal-hot` il celeste dei dettagli). Il blu della scena 3D è `RED` in cima a `scene.js` (nome storico).
- **Font**: Space Grotesk per i titoli, IBM Plex Sans per il testo, IBM Plex Mono per le date. Si cambiano nel blocco `:root` di `style.css` e nel link a Google Fonts in `index.html`.
- **Testi dei capitoli**: in `index.html`, una `<section>` per capitolo.
- **Chip che volano**: in ogni scheda, il testo dentro `<span class="carry__chip" data-carry>`. Il cerchio si costruisce da solo, nell'ordine delle schede. Per aggiungerne uno basta aggiungere un `data-carry` in una scheda.
- **Durata del volo**: `FLIGHT` in `main.js` (in millisecondi).
- **Edifici di Milano**: blocco `MILANO` in cima a `scene.js`, un gruppo di pezzi per edificio.
- **Movimento della telecamera**: array `KEYS` in `scene.js`, un punto per sezione (posizione, punto guardato, nebbia).

Se aggiungi o togli una sezione con `data-key`, aggiungi o togli anche il punto corrispondente in `KEYS`.

## Note

- Con "riduci movimento" attivo nel sistema o senza WebGL i chip non volano: compaiono come elenco di link nella sezione Contatti.
- Chi ha attivato "riduci movimento" vede un'inquadratura fissa, senza animazioni. Su Windows è l'opzione Impostazioni → Accessibilità → Effetti visivi → Animazioni.
- Se il browser non supporta WebGL, il sito mostra uno sfondo blu sfumato e resta leggibile.
