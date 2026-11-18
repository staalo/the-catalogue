# The Catalogue

The Catalogue turns a personal collection of movies and TV shows stored on
disk into a private streaming library. It is intended for people who have
backed up their own DVD and Blu-ray collection and would rather browse and
watch it from a web browser than repeatedly find, handle, and load the
physical discs.

Point The Catalogue at your media folders and provide a small JSON manifest
for each movie or TV series. The service reads the media paths and basic title
information from these manifests, builds a browsable catalogue, and streams
the selected title over your local network. It does not search every media
file and try to infer which title it contains.

An optional [TMDB](https://www.themoviedb.org/) API key uses each manifest's
title and year to add artwork, release information, genres, cast, crew, and
trailers.

This product uses the TMDB API but is not endorsed or certified by TMDB.

Playback progress is saved to each profile so viewers can continue
where they left off.

The application is self-hosted: the video files and SQLite catalogue database
remain on hardware you control. A single container includes both the React
web interface and the Node.js service, making it suitable for a desktop,
home server, or local Kubernetes cluster.

> Use The Catalogue only with media you are legally permitted to copy and
> stream. Copyright and copy-protection laws vary by country.

## How it works

1. Back up your discs to a folder on a local disk, NAS mount, or other storage
   visible to the machine running The Catalogue.
2. Add one JSON manifest per movie or TV series to the root of the appropriate
   library folder. Each manifest points to its main feature, episodes, and
   optional extras.
3. Configure one movies folder and, optionally, one TV folder for the
   installation.
4. Start The Catalogue. It imports the JSON metadata and watches the manifests
   for changes.
5. Open the web interface and create a profile with an email address,
   password, and optional username. All profiles use the same configured media
   collection, while account details and playback progress remain separate.

A clear title and release year in the JSON produce better TMDB metadata
matches.

## Video formats

Manifest `File` paths can refer to `.mp4`, `.mkv`, `.avi`, `.mov`, `.m4v`,
`.webm`, and `.m3u8` media. What the player can offer depends on the format.

**HLS (`.m3u8`).** The playlist supplies selectable audio tracks and
subtitles. When the stream includes more than one audio track, playback shows
an audio menu. Subtitle choices come from the playlist itself.

**`.mp4` and `.webm`.** These files play their audio as stored, with no audio
track menu. Subtitles are optional WebVTT files in the same folder as the
video, named `{basename}-{language}.vtt`. Beside `movie.mp4`,
`movie-en.vtt` is offered as English and `movie-fi.vtt` as Finnish. The language tag is two or three letters, optionally followed by a
region such as `en-US`.

**Other formats.** `.mkv`, `.avi`, `.mov`, and `.m4v` play the video file.

## Prepare the media library

The movies and TV root folders must contain JSON manifests. The service uses
these files as the source of truth for media information and file locations;
video files that are not referenced by a manifest are not added to the
catalogue.

A typical movies folder looks like this:

```text
C:\Media\Movies
├── movie.json
├── movie-with-extras.json
├── Movie
│   └── master.m3u8
└── Movie 2
    └── master.m3u8
```

Paths inside a manifest are relative to the configured movies or TV root. For
example, `"File": "Movie\\master.m3u8"` resolves to
`C:\Media\Movies\Movie\master.m3u8`.

See [`examples`](examples/README.md) for complete manifests covering a movie
with extras, a movie without extras, and a TV series.

## Prerequisites

- [Node.js 24](https://nodejs.org/) and npm for local development
- [Docker](https://docs.docker.com/get-docker/) for a container deployment
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) if you
  want Docker and Docker Compose in a desktop application
- Minikube and `kubectl` only if you want the local Kubernetes deployment

## Local development

The UI and service run as separate development processes. From the repository
root, prepare the service environment:

```powershell
Copy-Item catalogue-service/.env.example catalogue-service/.env
```

Edit `catalogue-service/.env` and replace `SESSION_SECRET` with a random value
of at least 32 characters. Set the shared media folders and, optionally, a
TMDB API key:

```dotenv
SESSION_SECRET=replace-with-a-random-secret-at-least-32-characters
MOVIES_PATH=C:/Media/Movies
TV_PATH=C:/Media/TV
TMDB_API_KEY=
PORT=3000
```

Install dependencies and start the API in one PowerShell window:

```powershell
Set-Location catalogue-service
npm install
npm run dev
```

Start the UI in a second PowerShell window:

```powershell
Set-Location catalogue-ui
npm install
npm run dev
```

Open the URL printed by Vite (normally `http://localhost:5173`). The
development server proxies API and authentication requests to
`http://localhost:3000`.

## Docker

Build commands must run from the repository root because the image contains
both `catalogue-ui` and `catalogue-service`:

```powershell
docker build -t catalogue:local .
```

### Run the image directly

Create persistent storage for the SQLite database, generate a session secret,
and mount your media folders read-only:

```powershell
docker volume create catalogue-data
$sessionSecret = [guid]::NewGuid().ToString("N") + [guid]::NewGuid().ToString("N")

docker run --name catalogue --init --restart unless-stopped `
  -p 3000:3000 `
  -e "SESSION_SECRET=$sessionSecret" `
  -e "MOVIES_PATH=/media/movies" `
  -e "TV_PATH=/media/tv" `
  -v "catalogue-data:/data" `
  -v "C:\Media\Movies:/media/movies:ro" `
  -v "C:\Media\TV:/media/tv:ro" `
  catalogue:local
```

Change the two Windows paths to your actual media folders. Omit the `TV_PATH`
environment variable and TV volume if you only have movies. To enable metadata
lookups, add ``-e "TMDB_API_KEY=your-api-key"`` before the volume arguments.

Open `http://localhost:3000`. Stop and remove the container with:

```powershell
docker stop catalogue
docker rm catalogue
```

The named `catalogue-data` volume is not removed, so profiles, catalogue data,
and playback progress survive replacement of the container.

### Run with Docker Desktop and Compose

Copy the example environment files:

```powershell
Copy-Item .env.example .env
Copy-Item catalogue-service/.env.example catalogue-service/.env
```

In the root `.env`, set the host media folders:

```dotenv
MOVIES_HOST_PATH=C:/Media/Movies
TV_HOST_PATH=C:/Media/TV
```

Set a random `SESSION_SECRET` of at least 32 characters in
`catalogue-service/.env`. Add `TMDB_API_KEY` there if desired.

The supplied Compose file enables the movies mount by default. To mount TV
media too, uncomment the `TV_HOST_PATH` volume line in `docker-compose.yml`.
Then use Docker Desktop's terminal, or any PowerShell window with Docker
Desktop running:

```powershell
docker compose up --build -d
docker compose logs -f catalogue
```

Open `http://localhost:3000`. The container also appears in Docker Desktop's
**Containers** view, where it can be started, stopped, and inspected. To stop
the Compose application:

```powershell
docker compose down
```

Its named database volume is retained. Use `docker compose down --volumes`
only when you intentionally want to delete the local Catalogue data.

## Kubernetes with Minikube

The repository includes a local Kubernetes configuration for Minikube,
including the media mount, persistent database volume, application secret,
service exposure, LAN access, updates, and troubleshooting.

Follow the complete
[Run Catalogue on Minikube guide](k8s/minikube/README.md).

## First use

After opening The Catalogue:

1. Create an account using an email address and password. A username is
   optional; the email address is used when no username is supplied.
2. The installation's movies and TV folders are shared by every profile, so
   users do not need to enter filesystem paths.
3. Allow the initial manifest import and optional TMDB metadata lookup to
   finish, then browse the library and select a title to begin streaming.

For another device on the same network, open
`http://HOST_COMPUTER_IP:3000` and allow TCP port 3000 through the host
firewall. Keep The Catalogue private to a trusted LAN; the provided
configuration is not intended to expose the service directly to the public
internet.
