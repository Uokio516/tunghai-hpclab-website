#!/usr/bin/env bash
# Run as root over the existing authenticated SSH connection. No package installs,
# firewall changes, GPU configuration changes or replacement of existing listeners.
set -u -o pipefail
umask 022

NODE_VERSION=''
NODE_SHA256=''
NODE_ARCHIVE=''
GPU_VERSION=''
GPU_SHA256=''
GPU_ARCHIVE=''
SKIP_NODE=0
SKIP_GPU=0
LISTEN='0.0.0.0'
PREFIX='/opt/hpclab-exporters'
SERVICE_USER='hpclab_exporter'
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"

report() { printf '%s\n' "$*"; }
die() { report "ERROR: $*"; exit 1; }
while (($#)); do
  case "$1" in
    --node-version) NODE_VERSION="${2:?missing version}"; shift 2 ;;
    --node-sha256) NODE_SHA256="${2:?missing SHA256}"; shift 2 ;;
    --node-archive) NODE_ARCHIVE="${2:?missing archive}"; shift 2 ;;
    --gpu-version) GPU_VERSION="${2:?missing version}"; shift 2 ;;
    --gpu-sha256) GPU_SHA256="${2:?missing SHA256}"; shift 2 ;;
    --gpu-archive) GPU_ARCHIVE="${2:?missing archive}"; shift 2 ;;
    --listen) LISTEN="${2:?missing listen address}"; shift 2 ;;
    --skip-node) SKIP_NODE=1; shift ;;
    --skip-gpu) SKIP_GPU=1; shift ;;
    *) die "Unknown option $1" ;;
  esac
done
[[ $EUID -eq 0 ]] || die 'Root or passwordless sudo is required.'
[[ "$(uname -s)" == Linux ]] || die 'Unsupported OS; this installer only handles Linux.'
command -v systemctl >/dev/null && [[ -d /run/systemd/system ]] || die 'No active systemd; skipped without changes.'
PYTHON="$(command -v python3 || true)"
[[ -n "$PYTHON" ]] || die 'python3 is required; skipped without package changes.'
command -v runuser >/dev/null || die 'runuser is required for non-root preflight.'
[[ "$LISTEN" =~ ^[0-9a-fA-F:.]+$ ]] || die 'Invalid listen address.'
[[ -z "$NODE_VERSION" || "$NODE_VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || die 'Invalid node_exporter version.'
[[ -z "$NODE_SHA256" || "$NODE_SHA256" =~ ^[0-9a-fA-F]{64}$ ]] || die 'Invalid SHA256.'
[[ -z "$GPU_VERSION" || "$GPU_VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || die 'Invalid GPU exporter version.'
[[ -z "$GPU_SHA256" || "$GPU_SHA256" =~ ^[0-9a-fA-F]{64}$ ]] || die 'Invalid GPU SHA256.'
LISTEN_ARG="$LISTEN"
[[ "$LISTEN" != *:* ]] || LISTEN_ARG="[$LISTEN]"

ARCH=''
case "$(uname -m)" in
  x86_64) ARCH=amd64 ;;
  aarch64|arm64) ARCH=arm64 ;;
  armv7l) ARCH=armv7 ;;
  armv6l) ARCH=armv6 ;;
  i386|i686) ARCH=386 ;;
esac

port_state() {
  # Inspect both IPv4 and IPv6 listener tables without changing any service.
  "$PYTHON" - "$1" <<'PY'
import pathlib, sys, urllib.request
port = int(sys.argv[1])
listening = False
available_tables = 0
for table in ('/proc/net/tcp', '/proc/net/tcp6'):
    try:
        content = pathlib.Path(table).read_text()
        available_tables += 1
        for line in content.splitlines()[1:]:
            fields = line.split()
            if fields[3] == '0A' and int(fields[1].split(':')[1], 16) == port:
                listening = True
    except FileNotFoundError:
        pass
if not available_tables:
    print('unknown')
elif not listening:
    print('free')
else:
    try:
        opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
        with opener.open('http://127.0.0.1:%d/metrics' % port, timeout=5) as response:
            data = response.read(1024 * 1024).decode('utf-8', errors='replace')
        expected = 'node_exporter_build_info' if port == 9100 else 'nvidia_smi_'
        print('exporter' if expected in data else 'occupied')
    except Exception:
        print('occupied')
PY
}

ensure_user() {
  if ! id "$SERVICE_USER" >/dev/null 2>&1; then
    command -v useradd >/dev/null || return 1
    useradd --system --no-create-home --shell /usr/sbin/nologin "$SERVICE_USER" || return 1
  fi
  [[ "$(id -u "$SERVICE_USER")" != 0 ]] || return 1
  install -d -m 0755 "$PREFIX" || return 1
}

unit_available() {
  local path fragment
  path="/etc/systemd/system/$1.service"
  fragment="$(systemctl show --property=FragmentPath --value "$1.service" 2>/dev/null || true)"
  if [[ -e "$path" || -L "$path" ]]; then
    grep -q '^# Managed by hpclab exporter installer$' "$path"
  elif [[ -n "$fragment" ]]; then
    return 1
  fi
}

fetch_https() {
  "$PYTHON" - "$1" "$2" <<'PY'
import hashlib, json, pathlib, sys, urllib.request
url, target = sys.argv[1:]
origins = ('https://github.com/prometheus/node_exporter/releases/download/',
           'https://github.com/utkuozdemir/nvidia_gpu_exporter/releases/download/')
if not url.startswith(origins):
    raise SystemExit('Unexpected release origin')
headers = {'User-Agent': 'hpclab-exporter-installer', 'Accept': 'application/octet-stream'}
def read_asset(address):
    request = urllib.request.Request(address, headers=headers)
    with urllib.request.urlopen(request, timeout=30) as response:
        if not response.url.startswith('https://'):
            raise ValueError('Insecure redirect rejected')
        return response.read(40 * 1024 * 1024)
try:
    data = read_asset(url)
except Exception:
    # Some networks reject github.com release downloads but allow the official
    # GitHub asset API. Resolve the exact pinned release and requested filename.
    parts = url.removeprefix('https://github.com/').split('/')
    repo, tag, filename = '/'.join(parts[:2]), parts[4], parts[5]
    api = 'https://api.github.com/repos/%s/releases/tags/%s' % (repo, tag)
    request = urllib.request.Request(api, headers={**headers, 'Accept': 'application/vnd.github+json'})
    with urllib.request.urlopen(request, timeout=30) as response:
        release = json.load(response)
    matches = [asset for asset in release.get('assets', []) if asset['name'] == filename]
    if len(matches) != 1:
        raise SystemExit('No unique matching official release asset')
    asset = matches[0]
    expected_origin = 'https://api.github.com/repos/%s/releases/assets/' % repo
    if not asset['url'].startswith(expected_origin):
        raise SystemExit('Unexpected asset API origin')
    data = read_asset(asset['url'] + '?download=1')
    digest = asset.get('digest', '')
    if digest.startswith('sha256:') and hashlib.sha256(data).hexdigest() != digest[7:]:
        raise SystemExit('Official asset API digest mismatch')
pathlib.Path(target).write_bytes(data)
PY
}

write_unit() {
  local name="$1" command_line="$2"
  # Never overwrite a preexisting unit unless it is marked as our installer output.
  local path="/etc/systemd/system/$name.service"
  if [[ -f "$path" ]] && ! grep -q '^# Managed by hpclab exporter installer$' "$path"; then
    report "$name: SKIP existing unmanaged unit"
    return 1
  fi
  cat > "$path" <<EOF
# Managed by hpclab exporter installer
[Unit]
Description=HPC Lab read-only metrics ($name)
After=network.target

[Service]
User=$SERVICE_USER
Group=$(id -gn "$SERVICE_USER")
ExecStart=$command_line
Restart=on-failure
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=full
ProtectHome=true
UMask=0022
Nice=10

[Install]
WantedBy=multi-user.target
EOF
  systemctl daemon-reload && systemctl enable --now "$name.service"
}

install_node() {
  local state
  state="$(port_state 9100)" || { report 'node: SKIP listener inspection failed'; return; }
  if [[ "$state" != free ]]; then report "node: PRESERVE $state on port 9100"; return; fi
  unit_available hpclab-node-exporter || { report 'node: SKIP unmanaged service unit'; return; }
  [[ -n "$ARCH" ]] || { report 'node: SKIP unsupported architecture'; return; }
  [[ -n "$NODE_VERSION" ]] || { report 'node: SKIP explicit official release version required'; return; }
  local work archive_name archive expected
  work="$(mktemp -d)" || return
  archive_name="node_exporter-$NODE_VERSION.linux-$ARCH.tar.gz"
  archive="$work/$archive_name"
  if [[ -n "$NODE_ARCHIVE" ]]; then
    [[ -n "$NODE_SHA256" ]] || { report 'node: SKIP local archive requires verified SHA256'; rm -rf -- "$work"; return; }
    cp -- "$NODE_ARCHIVE" "$archive" || { report 'node: SKIP cannot read archive'; rm -rf -- "$work"; return; }
  elif ! fetch_https "https://github.com/prometheus/node_exporter/releases/download/v$NODE_VERSION/$archive_name" "$archive"; then
    report 'node: SKIP official archive download failed'; rm -rf -- "$work"; return
  fi
  expected="$NODE_SHA256"
  if [[ -z "$expected" ]]; then
    if ! fetch_https "https://github.com/prometheus/node_exporter/releases/download/v$NODE_VERSION/sha256sums.txt" "$work/sha256sums.txt"; then
      report 'node: SKIP official checksum download failed'; rm -rf -- "$work"; return
    fi
    expected="$(awk -v file="$archive_name" '$2 == file || $2 == "*"file {print $1}' "$work/sha256sums.txt")"
  fi
  if ! "$PYTHON" - "$archive" "$expected" <<'PY'
import hashlib, pathlib, re, sys
archive, expected = sys.argv[1:]
if not re.fullmatch('[0-9a-fA-F]{64}', expected):
    raise SystemExit('No unique valid official SHA256')
if hashlib.sha256(pathlib.Path(archive).read_bytes()).hexdigest() != expected.lower():
    raise SystemExit('SHA256 mismatch')
PY
  then report 'node: SKIP archive verification failed'; rm -rf -- "$work"; return; fi
  # Extract only the expected binary, never arbitrary tar paths or symlinks.
  if ! "$PYTHON" - "$archive" "$work/node_exporter" "$NODE_VERSION" "$ARCH" <<'PY'
import pathlib, sys, tarfile
archive, destination, version, arch = sys.argv[1:]
with tarfile.open(archive, 'r:gz') as source:
    entry = source.getmember('node_exporter-%s.linux-%s/node_exporter' % (version, arch))
    if not entry.isfile():
        raise SystemExit('Expected a regular binary')
    pathlib.Path(destination).write_bytes(source.extractfile(entry).read())
PY
  then report 'node: SKIP archive extraction failed'; rm -rf -- "$work"; return; fi
  chmod 0755 "$work/node_exporter"
  "$work/node_exporter" --version >/dev/null 2>&1 || { report 'node: SKIP binary cannot execute'; rm -rf -- "$work"; return; }
  ensure_user || { report 'node: SKIP cannot create unprivileged service user'; rm -rf -- "$work"; return; }
  install -m 0755 "$work/node_exporter" "$PREFIX/node_exporter" || { rm -rf -- "$work"; return; }
  rm -rf -- "$work"
  write_unit hpclab-node-exporter "$PREFIX/node_exporter --web.listen-address=$LISTEN_ARG:9100" || { report 'node: FAILED service startup'; return; }
  sleep 2
  report "node: $(port_state 9100) version=$NODE_VERSION"
}

install_gpu() {
  local state binary gpu_arch work archive_name archive expected
  state="$(port_state 9835)" || { report 'gpu: SKIP listener inspection failed'; return; }
  if [[ "$state" != free ]]; then report "gpu: PRESERVE $state on port 9835"; return; fi
  unit_available hpclab-nvidia-smi-exporter || { report 'gpu: SKIP unmanaged service unit'; return; }
  if [[ -f /etc/nv_tegra_release ]]; then report 'gpu: SKIP Jetson requires platform telemetry'; return; fi
  binary="$(command -v nvidia-smi || true)"
  [[ -n "$binary" ]] || { report 'gpu: SKIP nvidia-smi unavailable; no driver changes'; return; }
  case "$ARCH" in
    amd64) gpu_arch=x86_64 ;;
    arm64) gpu_arch=arm64 ;;
    *) report 'gpu: SKIP official GPU binary unavailable for this architecture'; return ;;
  esac
  [[ -n "$GPU_VERSION" ]] || { report 'gpu: SKIP explicit official GPU release version required'; return; }
  [[ -f "$SCRIPT_DIR/nvidia_smi_exporter.py" ]] || { report 'gpu: SKIP exporter payload missing'; return; }
  ensure_user || { report 'gpu: SKIP cannot create unprivileged service user'; return; }
  install -m 0755 "$SCRIPT_DIR/nvidia_smi_exporter.py" "$PREFIX/nvidia_smi_exporter.py" || return
  if ! runuser -u "$SERVICE_USER" -- "$PYTHON" "$PREFIX/nvidia_smi_exporter.py" --binary "$binary" --once >/dev/null 2>&1; then
    report 'gpu: SKIP nvidia-smi read failed as unprivileged user; no device permission changes'; return
  fi
  work="$(mktemp -d)" || return
  archive_name="nvidia_gpu_exporter_${GPU_VERSION}_linux_${gpu_arch}.tar.gz"
  archive="$work/$archive_name"
  if [[ -n "$GPU_ARCHIVE" ]]; then
    [[ -n "$GPU_SHA256" ]] || { report 'gpu: SKIP local archive requires verified SHA256'; rm -rf -- "$work"; return; }
    cp -- "$GPU_ARCHIVE" "$archive" || { report 'gpu: SKIP cannot read archive'; rm -rf -- "$work"; return; }
  elif ! fetch_https "https://github.com/utkuozdemir/nvidia_gpu_exporter/releases/download/v$GPU_VERSION/$archive_name" "$archive"; then
    report 'gpu: SKIP official archive download failed'; rm -rf -- "$work"; return
  fi
  expected="$GPU_SHA256"
  if [[ -z "$expected" ]]; then
    if ! fetch_https "https://github.com/utkuozdemir/nvidia_gpu_exporter/releases/download/v$GPU_VERSION/checksums.txt" "$work/checksums.txt"; then
      report 'gpu: SKIP official checksum download failed'; rm -rf -- "$work"; return
    fi
    expected="$(awk -v file="$archive_name" '$2 == file || $2 == "*"file {print $1}' "$work/checksums.txt")"
  fi
  if ! "$PYTHON" - "$archive" "$expected" "$work/nvidia_gpu_exporter" <<'PY'
import hashlib, pathlib, re, sys, tarfile
archive, expected, destination = sys.argv[1:]
if not re.fullmatch('[0-9a-fA-F]{64}', expected):
    raise SystemExit('No unique valid official SHA256')
if hashlib.sha256(pathlib.Path(archive).read_bytes()).hexdigest() != expected.lower():
    raise SystemExit('SHA256 mismatch')
with tarfile.open(archive, 'r:gz') as source:
    entry = source.getmember('nvidia_gpu_exporter')
    if not entry.isfile():
        raise SystemExit('Expected a regular binary')
    pathlib.Path(destination).write_bytes(source.extractfile(entry).read())
PY
  then report 'gpu: SKIP archive verification/extraction failed'; rm -rf -- "$work"; return; fi
  chmod 0755 "$work/nvidia_gpu_exporter"
  local help_text
  help_text="$("$work/nvidia_gpu_exporter" --help 2>&1)" || { report 'gpu: SKIP binary cannot execute'; rm -rf -- "$work"; return; }
  if [[ "$help_text" != *'--collect.interval'* || "$help_text" != *'--collect.timeout'* ]]; then
    report 'gpu: SKIP binary cannot execute or lacks bounded background collection'; rm -rf -- "$work"; return
  fi
  install -m 0755 "$work/nvidia_gpu_exporter" "$PREFIX/nvidia_gpu_exporter" || { rm -rf -- "$work"; return; }
  rm -rf -- "$work"
  write_unit hpclab-nvidia-smi-exporter "$PREFIX/nvidia_gpu_exporter --web.listen-address=$LISTEN_ARG:9835 --nvidia-smi-command=$binary --collect.interval=5s --collect.timeout=4s --log.level=warn" || { report 'gpu: FAILED service startup'; return; }
  sleep 2
  report "gpu: $(port_state 9835) official=$GPU_VERSION read-only nvidia-smi sampling every 5s"
}

report "platform: Linux arch=${ARCH:-unsupported} systemd=yes"
((SKIP_NODE)) || install_node
((SKIP_GPU)) || install_gpu
