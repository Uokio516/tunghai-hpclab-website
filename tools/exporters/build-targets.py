"""Build the server-only target list from verified installation results.

Never writes workbook credentials. Private addresses are already part of the
server inventory and must never be returned by public API handlers.
"""
import json, os, pathlib

ROOT = pathlib.Path(__file__).resolve().parents[2]
PRIVATE = pathlib.Path(os.environ.get('TEMP', '/tmp')) / 'hpclab-exporter-private'
VM_CAPACITY = {'inv-52': 'inv-37', 'inv-53': 'inv-38', 'inv-54': 'inv-39'}

def build():
    machines = {m['id']: m for m in json.loads((ROOT/'lab-inventory.default.json').read_text(encoding='utf8'))['machines']}
    installs = json.loads((PRIVATE/'fleet-installs.json').read_text(encoding='utf8'))
    targets = []
    for result in installs:
        machine = machines[result['id']]
        if not machine.get('include'):continue
        for kind, port, key in [('node',9100,'node'),('nvidia',9835,'gpu')]:
            if result.get('verification',{}).get(key,{}).get('metricsValid'):
                targets.append({'machineId':machine['id'],'capacityHostId':VM_CAPACITY.get(machine['id'],machine['id']),
                                'kind':kind,'url':'http://%s:%d/metrics'%(machine['ip'],port),
                                **({'transport':'push'} if machine['id']=='inv-25' else {})})
    # Existing exporters outside the original Prometheus target list.
    for id in ['inv-10','inv-12']:
        machine=machines[id]
        for kind,port in [('node',9100),('nvidia',9835)]:
            targets.append({'machineId':id,'capacityHostId':id,'kind':kind,'url':'http://%s:%d/metrics'%(machine['ip'],port)})
    # GPU-cluster's two physical nodes can run a node exporter under the
    # existing Kubernetes administrator. The second node's site-facing route
    # goes through a small, source-restricted relay on the reachable cc3 VM.
    targets.append({'machineId':'inv-58','capacityHostId':'inv-58','kind':'node',
                    'url':'http://%s:9100/metrics'%machines['inv-58']['ip']})
    targets.append({'machineId':'inv-72','capacityHostId':'inv-72','kind':'node',
                    'url':'http://%s:9300/metrics'%machines['inv-54']['ip']})
    # These GPU-cluster nodes lack usable SSH credentials, but the existing
    # NVIDIA RuntimeClass can run a read-only, no-GPU-request exporter pod.
    nodes = json.loads((ROOT/'tools/data/gpu-cluster-nodes.json').read_text(encoding='utf8'))['items']
    pve3 = next(n for n in nodes if n['metadata']['name']=='pk-gpu-pve3')
    pve3_ip = next(a['address'] for a in pve3['status']['addresses'] if a['type']=='InternalIP')
    targets.extend([
        {'machineId':'inv-42','capacityHostId':'inv-42','kind':'nvidia','url':'http://%s:9835/metrics'%pve3_ip},
        {'machineId':'inv-58','capacityHostId':'inv-58','kind':'nvidia','url':'http://%s:9835/metrics'%machines['inv-58']['ip']},
        {'machineId':'inv-72','capacityHostId':'inv-72','kind':'nvidia','url':'http://%s:9301/metrics'%machines['inv-54']['ip']},
    ])
    targets.sort(key=lambda target:(target['machineId'],target['kind']))
    (ROOT/'exporter-targets.default.json').write_text(json.dumps({'targets':targets},indent=2)+'\n',encoding='utf8')
    print(json.dumps({'targets':len(targets),'machines':len({x['machineId'] for x in targets}),
                      'node':sum(x['kind']=='node' for x in targets),'gpu':sum(x['kind']=='nvidia' for x in targets)}))

if __name__=='__main__':build()
