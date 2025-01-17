<div align="center">

# HLN-A

A Discord bot that serves us well

</div>

```shell
docker pull ghcr.io/axieum/hln-a
```

<details>
<summary>docker-compose.yaml</summary>

```yaml
services:
  # HLN-A (Discord Bot)
  hln-a:
    image: ghcr.io/axieum/hln-a
    container_name: hln-a
    restart: unless-stopped
    volumes:
      - ./hln-a:/data
```
</details>
