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
    user: root
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - /home/ark/docker-compose.yaml:/home/ark/docker-compose.yaml
      - ./hln-a:/data
```
</details>
