"""Build-only texture derivatives; canonical images and gameplay metadata stay intact."""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from PIL import Image
import hashlib,json,sys
import threading

root=Path(sys.argv[1]).resolve()
manifest_path=root/'assets/manifest.json'
manifest=json.loads(manifest_path.read_text(encoding='utf-8-sig'))
assets=root/'assets'
def strings(value):
    if isinstance(value,str):
        yield value
    elif isinstance(value,dict):
        for v in value.values():yield from strings(v)
    elif isinstance(value,list):
        for v in value:yield from strings(v)
paths=sorted({p for p in strings(manifest) if p.lower().endswith(('.png','.jpg','.jpeg')) and (assets/p).is_file()})
target=assets/'web-runtime'
target.mkdir(exist_ok=True)
locks={}
registry_lock=threading.Lock()
def convert(relative):
    source=assets/relative
    digest=hashlib.sha256(source.read_bytes()).hexdigest()[:24]
    destination=target/(digest+'.webp')
    with registry_lock:lock=locks.setdefault(digest,threading.Lock())
    with Image.open(source) as image:
        alpha='A' in image.getbands() and image.getchannel('A').getextrema()[0]<255
        normalized=image.convert('RGBA' if alpha else 'RGB')
        with lock:
            if not destination.exists():normalized.save(destination,'WEBP',lossless=alpha,quality=100 if alpha else 88,method=4,exact=True,**({'icc_profile':image.info['icc_profile']} if image.info.get('icc_profile') else {}))
        with Image.open(destination) as result:
            if result.size!=image.size:raise RuntimeError('Texture dimensions changed: '+relative)
            if alpha and result.convert('RGBA').getchannel('A').tobytes()!=normalized.getchannel('A').tobytes():raise RuntimeError('Texture alpha changed: '+relative)
        return {'source':relative,'target':'web-runtime/'+destination.name,'width':image.width,'height':image.height,'alphaLossless':alpha,'beforeBytes':source.stat().st_size,'afterBytes':destination.stat().st_size}
with ThreadPoolExecutor(max_workers=4) as pool:records=list(pool.map(convert,paths))
mapping={r['source']:r['target'] for r in records}
def rewrite(value):
    if isinstance(value,str):return mapping.get(value,value)
    if isinstance(value,list):return [rewrite(v) for v in value]
    if isinstance(value,dict):return {k:rewrite(v) for k,v in value.items()}
    return value
manifest_path.write_text(json.dumps(rewrite(manifest),ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
report={'profile':'webp-opaque-q88-transparent-lossless-v1','converted':len(records),'beforeBytes':sum(r['beforeBytes'] for r in records),'afterBytes':sum(r['afterBytes'] for r in records),'records':records}
(root/'web-optimization.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({k:v for k,v in report.items() if k!='records'}))
