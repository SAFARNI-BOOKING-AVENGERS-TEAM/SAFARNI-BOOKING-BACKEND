# SAFARNI Kubernetes Manifests

These manifests describe a local/demo Kubernetes deployment of the current SAFARNI frontend and backend images. They are intended for validation and documentation evidence; they do not claim that SAFARNI is deployed to a production cluster.

## Images

The manifests reference the same local image tags produced by the documentation evidence workflow:

- `safarni-backend:evidence`
- `safarni-frontend:evidence`

For a real registry deployment, replace these image names with immutable registry tags or digests.

The frontend `NEXT_PUBLIC_API_URL` is a Next.js build-time value. Build the frontend image with the API URL that browsers must reach, for example:

```powershell
docker build --build-arg NEXT_PUBLIC_API_URL=http://localhost:5000 -t safarni-frontend:evidence .
```

For the local port-forward workflow below, the Dockerfile default (`http://localhost:5000`) is appropriate.

## Backend configuration

Non-sensitive runtime values live in `backend-configmap.yaml`.

Sensitive values are intentionally not committed as a Kubernetes Secret. Copy `backend-secret.example.env` to a private file outside Git, replace all placeholders, then create the Secret:

```powershell
kubectl create namespace safarni --dry-run=client -o yaml | kubectl apply -f -
kubectl -n safarni create secret generic safarni-backend-secrets --from-env-file="C:\private\safarni-backend.env" --dry-run=client -o yaml | kubectl apply -f -
```

Do not commit the populated secret file or generated Secret YAML.

## Validate rendered manifests

```powershell
kubectl kustomize .\deploy\k8s
```

If a Kubernetes cluster is available, a server-side dry run can also be used before applying:

```powershell
kubectl apply --dry-run=server -k .\deploy\k8s
```

## Deploy to a local cluster

After the two Docker images exist and the backend Secret has been created:

```powershell
kubectl apply -k .\deploy\k8s
kubectl -n safarni get deployments,pods,services
```

For local browser access without an Ingress:

```powershell
kubectl -n safarni port-forward service/safarni-backend 5000:5000
kubectl -n safarni port-forward service/safarni-frontend 3000:3000
```

Then browse to `http://localhost:3000`. The backend health/root endpoint is available at `http://localhost:5000/`.

## Production differences

A production deployment still requires an actual registry, external MongoDB endpoint, TLS/Ingress or another edge routing layer, secret management, persistent storage policy for uploads if local upload fallback is used, monitoring/log aggregation, scaling policy, and environment-specific URLs. Those items must not be documented as deployed until they are actually provisioned and verified.
