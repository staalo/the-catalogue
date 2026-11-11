# Media metadata examples

The Catalogue builds its library from JSON metadata files in the configured
movies and TV root folders. It does not discover titles by scanning every
video file. Each JSON file describes a title and points to the media files
that belong to it.

Copy and adapt these examples:

- [`big-fish.json`](big-fish.json): a movie with bonus features
- [`jackie-brown.json`](jackie-brown.json): a movie without bonus features
- [`northern-exposure.json`](northern-exposure.json): a TV series with one
  season of single-file episodes
- [`twin-peaks.json`](twin-peaks.json): a TV series with alternate episode
  versions, season extras, and nested series extras

## Movie metadata

The `DVD` object describes the main feature:

- `Title`: title used in the catalogue and for metadata lookup
- `Year`: release year, which improves metadata matching
- `Runtime`: main-feature duration in minutes
- `File`: path to the video file or HLS playlist, relative to the configured
  movies root

The optional `Extras` object contains bonus features. Its keys only need to be
unique within the file. Each extra can provide:

- `Title`: name displayed for the bonus feature
- `Runtime`: duration as a string such as `8:46`
- `File`: path relative to the configured movies root

For example, if the movies root is `C:\Media\Movies`, this entry:

```json
"File": "Big Fish\\master.m3u8"
```

resolves to `C:\Media\Movies\Big Fish\master.m3u8`.

## TV-series metadata

The `DVD` object identifies the series with `Title` and `Year`. A series has
no single feature file. Episodes and extras live under `Seasons`, and every
`File` path is relative to the configured TV root.

A season key is the season number. Episodes can be listed in two ways:

- Directly on the season, as in
  [`northern-exposure.json`](northern-exposure.json). The key is the episode
  label and the value has a `File`.
- Inside an `Episodes` object, as in [`twin-peaks.json`](twin-peaks.json).
  Keys are usually episode numbers. A value with `File` is the only cut of
  that episode. A value without `File` has more than one version, such as
  `Original` and `Alternate`, and each version has its own `File` and
  `Runtime`.

Episodes usually have no `Title`. When `Title` is present, that name is kept.
Extras usually have a title, either in `Title` or as the object key itself.

`Extras` can sit beside the numbered seasons (the whole series), inside one
season, or at the top level next to `DVD` and `Seasons`. A value with `File`
is playable. A value without `File` is a group, and its children can be
playable items or further groups. `Runtime` is a duration string such as
`44:31` or `1:30:09`.

## Placement

Place movie JSON files directly in the configured movies root and TV-series
JSON files directly in the configured TV root:

```text
C:\Media
├── Movies
│   ├── big-fish.json
│   ├── jackie-brown.json
│   ├── Big Fish
│   │   └── master.m3u8
│   └── Jackie Brown
│       └── master.m3u8
└── TV
    ├── northern-exposure.json
    └── Northern Exposure
        ├── northern-exposure-s1e1.mp4
        └── northern-exposure-s1e2.mp4
```

Paths may use `\` as shown in the examples or `/`. Keep every referenced path
inside its configured library root. JSON must be valid: use double quotes and
do not leave a trailing comma after the final property.
