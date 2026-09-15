# Run Catalogue on Minikube

Run these commands in PowerShell from the repository root (`the-catalogue`).

## 1. Start Minikube and mount the movie library

```powershell
minikube start
```

In a second PowerShell window, mount the Windows movie directory into the
Minikube node. Keep this command running while Catalogue is running:

```powershell
minikube mount "C:\temp\leffat:/mnt/catalogue-movies"
```

Change `C:\temp\leffat` to the directory containing your movies. The target
(`/mnt/catalogue-movies`) must remain unchanged unless `deployment.yaml` is
updated to match.

## 2. Build and load the image

The Dockerfile builds both the UI and API, so its context must be the
repository root. Build it with Docker Desktop, then copy it into Minikube:

```powershell
docker build -t catalogue:local .
minikube image load catalogue:local
```

This two-command flow avoids a Windows path-handling issue that can make
`minikube image build` report that an existing Dockerfile is missing.

## 3. Create the local secret

Create the namespace, generate a session secret, and store it in Kubernetes:

```powershell
kubectl apply -f k8s/minikube/namespace.yaml
$sessionSecret = [guid]::NewGuid().ToString("N") + [guid]::NewGuid().ToString("N")
kubectl -n catalogue create secret generic catalogue-secrets `
  --from-literal="SESSION_SECRET=$sessionSecret" `
  --dry-run=client -o yaml | kubectl apply -f -
```

To enable TMDB metadata, add
`--from-literal="TMDB_API_KEY=your-api-key"` before `--dry-run=client`.

## 4. Deploy

```powershell
kubectl apply -k k8s/minikube
kubectl -n catalogue rollout status deployment/catalogue
kubectl -n catalogue get pods,service,pvc
```

## 5. Open it on this laptop

This prints a URL and, depending on the Minikube driver, may keep a tunnel
running. Keep the command open if it says it started a tunnel:

```powershell
minikube service catalogue -n catalogue --url
```

Open the printed URL in a browser. A direct NodePort URL may also work:

```powershell
"http://$(minikube ip):30080"
```

## 6. Open it from an Xbox or another LAN device

Minikube's node or service tunnel is often only reachable from the laptop.
Forward the service on every laptop network interface instead:

```powershell
kubectl -n catalogue port-forward --address 0.0.0.0 service/catalogue 3000:3000
```

Keep that PowerShell window open. In an elevated PowerShell window, allow the
port through Windows Firewall once:

```powershell
New-NetFirewallRule -DisplayName "Catalogue local Kubernetes" `
  -Direction Inbound -Action Allow -Protocol TCP -LocalPort 3000 `
  -Profile Private
```

Run `ipconfig`, find the laptop's Wi-Fi or Ethernet IPv4 address, and open this
URL in the Xbox browser:

```text
http://LAPTOP_IPV4_ADDRESS:3000
```

For example: `http://192.168.1.50:3000`.

The laptop and Xbox must be on the same LAN, the Windows network profile must
be Private, and the mount and port-forward commands must remain running.
Guest Wi-Fi/client isolation can prevent devices from reaching each other.

## Updating and troubleshooting

After code changes, rebuild and restart:

```powershell
docker build -t catalogue:local .
minikube image load catalogue:local
kubectl -n catalogue rollout restart deployment/catalogue
kubectl -n catalogue rollout status deployment/catalogue
```

Useful diagnostics:

```powershell
kubectl -n catalogue get pods
kubectl -n catalogue describe pod -l app.kubernetes.io/name=catalogue
kubectl -n catalogue logs deployment/catalogue
```

The SQLite database is stored in the `catalogue-data` persistent volume and
survives pod/deployment restarts. `minikube delete` also deletes that local
cluster data.

To remove the workload:

```powershell
kubectl delete -k k8s/minikube
```
